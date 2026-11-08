"""What the Millenaire translations would add to the lab, per culture. Learns only from the mc designs, into its own
folder; never reads or writes the lab's data/ beyond reading the current numbers for comparison.

Usage: python3 -I lab/mc_compare.py <converted dir> <eval.json> <learn-mc dir>

1. Picks the top level of each whole building (sub-buildings left out) and links them under <learn-mc>/src/vh/.
2. Runs lab/build_corpus.py, lab/learn.py and lab/shapes.py on all of them and on each culture alone, into
   <learn-mc>/all and <learn-mc>/<culture>.
3. Writes <learn-mc>/compare.json and prints a markdown summary: plans, roofs, walls, room uses, furniture per room
   use, furniture groups, materials that change in Valheim, next to the lab's current corpus numbers.
"""
import collections, json, os, shutil, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
LAB_DATA = os.path.join(HERE, '..', 'data')
conv, eval_path, out = sys.argv[1:4]

# Materials that change look or kind on the way to Valheim (kept geometry, other material)
SUBST = {'lightstone': 'light masonry (sandstone, mud brick, quartz, painted brick) as grey stone',
         'tile': 'roof tile blocks as stone', 'snow': 'snow and ice brick as stone', 'metal': 'metal blocks as stone',
         'plaster': 'white timber-frame plaster as plank walls', 'dirtwall': 'earth walls as plank walls',
         'cloth': 'wool as plank walls', 'paper': 'paper screens as plank walls and gaps', 'sod': 'sod as plank walls',
         'thatch': 'thatch blocks as plank walls'}
# Which lab culture each Millenaire culture would feed; 'new' means the lab has no such culture today
LAB_CULTURE = {'seljuk': 'middle-eastern', 'japanese': 'east-asian', 'indian': 'new: south-asian',
               'mayan': 'new: mesoamerican', 'byzantines': 'new: byzantine', 'inuits': 'new: arctic',
               'norman': 'castle-medieval'}

ev = json.load(open(eval_path))
top = {}
for r in ev['rows']:
    if r['sub']:
        continue
    k = (r['culture'], r['id'], r['variant'])
    if k not in top or r['level'] > top[k]['level']:
        top[k] = r

src = os.path.join(out, 'src')
if os.path.exists(src):
    shutil.rmtree(src)
for d in ('pb', 'hs', 'profile/Villheim', 'vh'):
    os.makedirs(os.path.join(src, d), exist_ok=True)
open(os.path.join(src, 'hs_keepers.txt'), 'w').close()
open(os.path.join(src, 'profile/Villheim/design-list.csv'), 'w').write('Name,Number,Stage\n')
open(os.path.join(src, 'profile/Villheim/design-sort.csv'), 'w').write('Number,Type,Subtype\n')
open(os.path.join(src, 'review.json'), 'w').write('{"values":[]}')
for (c, i, v), r in top.items():
    os.makedirs(os.path.join(src, 'vh', c), exist_ok=True)
    b = f"{i}_{v}_{r['level']}"
    os.symlink(os.path.abspath(os.path.join(conv, c, b + '.blueprint')), os.path.join(src, 'vh', c, f'mc-{c}-{b}.blueprint'))


def run(args):
    subprocess.run([sys.executable, '-I'] + args, check=True, stdout=subprocess.DEVNULL)


def learn(name, corpus):
    d = os.path.join(out, name)
    os.makedirs(d, exist_ok=True)
    cpath = os.path.join(d, 'corpus.json')
    json.dump(corpus, open(cpath, 'w'), separators=(',', ':'))
    run([os.path.join(HERE, 'learn.py'), cpath, os.path.join(d, 'learn')])
    run([os.path.join(HERE, 'shapes.py'), cpath, os.path.join(d, 'learn', 'catalog.csv'), os.path.join(d, 'shapes.json')])
    return json.load(open(os.path.join(d, 'learn', 'rules.json'))), json.load(open(os.path.join(d, 'shapes.json')))


os.makedirs(os.path.join(out, 'all'), exist_ok=True)
run([os.path.join(HERE, 'build_corpus.py'), src, os.path.join(out, 'all', 'corpus.json')])
corpus = json.load(open(os.path.join(out, 'all', 'corpus.json')))
learn('all', corpus)

lab_rules = json.load(open(os.path.join(LAB_DATA, 'rules.json')))
lab_shapes = json.load(open(os.path.join(LAB_DATA, 'shapes-summary.json')))
lab_cult = {k: v['n'] for k, v in lab_rules['cultures'].items()}

res = {'lab': {'designs': lab_shapes['n'], 'cultures': lab_cult, 'groups': len(lab_rules['groups']),
               'placement': len(lab_rules['placement'])}, 'cultures': {}}
for culture in sorted({c for (c, _, _) in top}):
    sub = [d for d in corpus if d['id'].startswith(f'mc-{culture}-')]
    rules, shapes = learn(culture, sub)
    ds = shapes['designs']
    rooms = collections.Counter(); items = collections.defaultdict(collections.Counter); mats = collections.Counter()
    for (c, i, v), r in top.items():
        if c != culture:
            continue
        st = json.load(open(os.path.join(conv, c, f"{i}_{v}_{r['level']}.stats.json")))
        for room in st['rooms']:
            if room['indoor'] and room['use'] not in ('room', 'yard'):
                rooms[room['use']] += 1
                for nm, n in room['items'].items():
                    items[room['use']][nm] += n
        for k, n in st['stats'].items():
            if k.startswith('mat:'):
                mats[k[4:]] += n
    tot = sum(mats.values()) or 1
    res['cultures'][culture] = {
        'lab_culture': LAB_CULTURE.get(culture), 'designs': len(sub),
        'plan': collections.Counter(d['plan'] for d in ds).most_common(),
        'roof': collections.Counter(d['roof'] for d in ds).most_common(),
        'walls': collections.Counter(d['walls'] for d in ds).most_common(),
        'window': collections.Counter(d['window'] for d in ds).most_common(),
        'room_uses': rooms.most_common(),
        'room_items': {u: c.most_common(6) for u, c in items.items()},
        'groups': {a: [[g[0], g[1]] for g in lst[:4]] for a, lst in rules['groups'].items()},
        'placement_rules': len(rules['placement']),
        'decor_uses': {u: {s: v['designs'] for s, v in st_.items()} for u, st_ in rules['decor'].items()},
        'materials': [[m, round(n / tot, 3)] for m, n in mats.most_common()],
        'substituted_share': round(sum(n for m, n in mats.items() if m in SUBST) / tot, 3),
        'learn_py_culture': collections.Counter(d['culture'] for d in ds).most_common(),
    }
json.dump(res, open(os.path.join(out, 'compare.json'), 'w'), indent=1)

# markdown summary
print('| Culture | Feeds | Designs | Plans (top 3) | Roofs (top 3) | Walls (top 2) | Indoor rooms by use | Materials changed |')
print('|---|---|---|---|---|---|---|---|')
for c, r in res['cultures'].items():
    f = lambda lst, n: ', '.join(f'{k} {v}' for k, v in lst[:n])
    print(f"| {c} | {r['lab_culture']} | {r['designs']} | {f(r['plan'], 3)} | {f(r['roof'], 3)} | {f(r['walls'], 2)} | "
          f"{f(r['room_uses'], 5)} | {round(r['substituted_share'] * 100)} % |")
print()
print('lab today:', res['lab'])
for c, r in res['cultures'].items():
    print(c, 'groups', len(r['groups']), 'placement', r['placement_rules'], 'learn.py culture', r['learn_py_culture'])
    for u, its in r['room_items'].items():
        print('   ', u, its[:5])
