"""Learn building rules from the corpus.

Usage: python3 lab/learn.py <corpus.json> [<valheimians index.json>] <out dir>

Writes:
  catalog.csv   one row per design: category, culture, size, decor level, palette, features
  rules.json    what the generator and decorator use: shell numbers per category and culture,
                palettes, furniture lists per room use and decor level, placement rules, furniture groups
  features.json numeric features per design for the scorer
"""
import collections, csv, json, math, os, re, statistics, sys

args = sys.argv[1:]
corpus_path, out_dir = args[0], args[-1]
index_path = args[1] if len(args) == 3 else None
D = json.load(open(corpus_path))
vh_index = {}
if index_path and os.path.exists(index_path):
    for it in json.load(open(index_path)):
        vh_index[it['slug']] = it

# ---------------------------------------------------------------- piece roles (mirror of lib/pieces.js)
ROLE_RULES = [
    (r'roof.*top|_top_45|roof_top', 'roofTop'), (r'roof.*(ocorner|icorner)', 'roofCorner'),
    (r'wall_roof', 'gable'), (r'roof', 'roof'), (r'beam|_log_(26|45|67)', 'beam'),
    (r'pole|pillar|column', 'pole'), (r'floor', 'floor'), (r'stair|ladder', 'stair'), (r'door|gate', 'door'),
    (r'window', 'window'), (r'stake_wall|stakewall|sharpstakes|fence', 'fence'),
    (r'wall|arch|stoneblock|blackmarble_(1x1|2x1x1|2x2x2|2x2x1)', 'wall'),
    (r'bed', 'bed'), (r'table|piece_workbench$', 'table'), (r'bench|throne|chair|stool', 'seat'),
    (r'chest|barrel|drawer|crate', 'storage'), (r'hearth|fire_pit', 'fire'),
    (r'cookingstation|cauldron|oven|forge|smelter|kiln|blastfurnace|anvil|grindstone|tanning|spinning|stonecutter|artisan|magetable|ext\d|workbench|windmill|refinery|fermenter|beehive|bathtub|cart|portal|press', 'craft'),
    (r'itemstand|ArmorStand|sign|banner|trophy|raven|wolf|dragon|xmas|garland|jackoturnip|totem|statue|head|guard_stone', 'deco'),
    (r'rug|carpet', 'rug'), (r'torch|lantern|brazier|candle|Candle|wisplure|lamp', 'light'),
    (r'stack|pile|Placeable_Stone|treasure', 'clutter'),
    (r'Pickable|Bush|bush|Tree|tree|shrub|vines|Vine|Fern|root|Beech|Mushroom|sapling|Plant|Rock|rock|cliff', 'nature'),
]
ROLE_RE = [(re.compile(p), r) for p, r in ROLE_RULES]
_role_cache = {}
def role(n):
    r = _role_cache.get(n)
    if r is None:
        r = next((r for p, r in ROLE_RE if p.search(n)), 'misc')
        _role_cache[n] = r
    return r

STRUCT = {'wall', 'floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair', 'door', 'window', 'fence'}
DECOR = {'bed', 'table', 'seat', 'storage', 'fire', 'craft', 'deco', 'rug', 'light', 'clutter'}

def material(n):
    for pat, m in [(r'crystal|glass', 'glass'), (r'darkwood_roof|KokeraRoof', 'darkroof'), (r'^wood_roof', 'thatch'),
                   (r'darkwood|blackwood', 'darkwood'), (r'ashwood', 'ashwood'), (r'grausten|Ashlands_', 'grausten'),
                   (r'blackmarble', 'marble'), (r'flametal', 'flametal'), (r'dvergr', 'dvergr'),
                   (r'woodiron|iron|metal', 'iron'), (r'stone', 'stone'), (r'_log|corewood|wood_core', 'corewood'),
                   (r'^wood|woodwall|piece_', 'wood')]:
        if re.search(pat, n):
            return m
    return 'other'

TIER = {'wood': 1, 'thatch': 1, 'corewood': 2, 'stone': 2, 'darkwood': 3, 'darkroof': 3, 'iron': 3, 'glass': 4,
        'marble': 6, 'dvergr': 6, 'ashwood': 7, 'grausten': 7, 'flametal': 7}
BIOMES = ['Meadows', 'Black Forest', 'Swamp', 'Mountain', 'Plains', 'Mistlands', 'Ashlands']

# ---------------------------------------------------------------- categories and cultures
CAT_WORDS = [
    ('smithy', r'smith|forge|smelt|blacksmith|anvil|foundry|metalwork|refinery|mine|mining|ore'),
    ('sawmill', r'sawmill|lumber|woodwork|wood.?work|carpent|logging|woodcutter|timber|wood.?shop|woodshed|wood.?yard'),
    ('barn', r'barn|stable|animal|boar|lox|wolf.?(pen|breed|farm)|chicken|hen|coop|pen\b|pigsty|pig|kennel|breeder|pasture'),
    ('farm', r'farm|garden|crop|field|greenhouse|plant|harvest|orchard|apiary|bee|hive|mill|granary|grain|barley|flax'),
    ('tavern', r'tavern|inn\b|mead|pub|feast|hall|bistro|kitchen|cook|bakery'),
    ('longhouse', r'longhouse|long.?house|great.?hall|jarl|lodge|mead.?hall|townhall|town.?hall|manor|mansion'),
    ('harbour', r'dock|harbo|port\b|boat|ship|pier|wharf|fish|lighthouse'),
    ('defence', r'tower|fort|wall|gate|guard|watch|castle|keep|barrack|bastion|palisade|outpost|citadel'),
    ('storage', r'storage|storehouse|warehouse|cellar|vault|shed|depot|pantry'),
    ('temple', r'temple|shrine|church|altar|chapel|sanctuary|stave|mosque|monastery|tomb|mausoleum|crypt'),
    ('market', r'market|stall|shop|merchant|trader|bazaar|vendor|store\b'),
    ('decor', r'decor|well|statue|fountain|bridge|camp|fire.?pit|bench|sign|garden.?decor|outhouse|wagon|cart|arena|portal'),
    ('home', r'house|home|hut|cabin|cottage|starter|shack|hovel|dwelling|bungalow|hobbit|tiny|retreat|villa|chalet'),
]
CAT_FROM_SITE = {'Blacksmith Build': 'smithy', 'Farming Build': 'farm', 'Tavern Build': 'tavern',
                 'Longhouse Build': 'longhouse', 'Boat House Build': 'harbour', 'Tower Build': 'defence',
                 'Castle Build': 'defence', 'Storage Build': 'storage', 'Temple Build': 'temple',
                 'Starter Home Build': 'home', 'Tree House Build': 'home', 'Bridge Build': 'decor',
                 'Statue Build': 'decor', 'Portal Hub Build': 'decor', 'Arena Build': 'decor',
                 'Recreation Build': 'decor', 'Interior Design Build': 'home', 'Village Build': 'village'}
SUBTYPE_TO_CAT = {'Longhouse': 'longhouse', 'Defence': 'defence', 'Hearth': 'decor', 'Farming': 'farm',
                  'Tavern': 'tavern', 'Workshop': 'workshop', 'Harbour': 'harbour', 'Mining': 'smithy',
                  'Decor': 'decor', 'Storage': 'storage', 'Woodworking': 'sawmill', 'Cooking': 'tavern',
                  'Hunting': 'workshop', 'Arcane': 'temple'}

CULTURE_WORDS = [
    ('middle-eastern', r'desert|arab|persian|moor|mosque|egypt|oasis|sultan|bazaar|ottoman|turk|minaret|caliph|mimar|kebab|morocc|sand'),
    ('east-asian', r'japan|asian|pagoda|samurai|shogun|chinese|china|zen|torii|dojo|kokera|wara'),
    ('elven', r'elven|elf|fae|fairy|rivendell|lothlorien'),
    ('dwarven', r'dwar|dvergr|dverger|mountain.?hall|moria|erebor'),
    ('hobbit', r'hobbit|shire|halfling|burrow'),
    ('castle-medieval', r'castle|medieval|keep|knight|gothic|cathedral|manor|mansion|tudor|english|german|skyrim|whiterun|rhovanion'),
    ('slavic-rus', r'slav|rus\b|russian|izba|kievan'),
    ('celtic', r'celt|druid|roundhouse|round.?house|stone.?circle|standing.?stone'),
    ('norse', r'viking|nordic|norse|longhouse|stave|jarl|norse|scandinav|valhalla|asgard|odin|thor'),
]

def text_of(d):
    slug = re.sub(r'^(house|hub|storage|workshop|farm)-', '', d['id'])
    site = vh_index.get(slug) or vh_index.get(re.sub(r'-\d+$', '', slug))
    t = ' '.join([d['id'], d.get('name', ''), d.get('description', ''), d.get('category', '')]).lower()
    if site:
        t += ' ' + (site.get('title') or '').lower()
    return t.replace('_', ' ').replace('-', ' '), site

# ---------------------------------------------------------------- per design features
def yaw_dir(yaw):
    a = math.radians(yaw)
    return math.sin(a), math.cos(a)  # world direction of the piece's local +z

def features(d):
    ps = d['pieces']
    roles = collections.Counter(role(p[0]) for p in ps)
    st = [p for p in ps if role(p[0]) in STRUCT]
    if not st:
        st = ps
    ys = sorted(p[2] for p in st)
    ground = ys[int(len(ys) * 0.05)]
    xs = sorted(p[1] for p in st); zs = sorted(p[3] for p in st)
    q = lambda arr, f: arr[min(len(arr) - 1, int(len(arr) * f))]
    w = q(xs, 0.97) - q(xs, 0.03); l = q(zs, 0.97) - q(zs, 0.03)
    h = q(ys, 0.98) - ground
    mats = collections.Counter(material(p[0]) for p in st)
    tot = sum(mats.values()) or 1
    tier = max((TIER.get(m, 1) for m, c in mats.items() if c / tot > 0.04), default=1)
    roofs = [p for p in ps if role(p[0]) in ('roof', 'roofCorner')]
    r45 = sum('45' in p[0] or '67' in p[0] for p in roofs)
    roofmat = collections.Counter(material(p[0]) for p in roofs).most_common(1)
    floors = [p for p in ps if role(p[0]) == 'floor']
    levels = collections.Counter(round((p[2] - ground) / 0.5) * 0.5 for p in floors)
    nlev = sum(1 for k, v in levels.items() if v >= 6)
    diag = sum(1 for p in st if abs(((p[4] % 90) + 90) % 90 - 45) < 30) / len(st)
    decor = sum(roles[r] for r in DECOR)
    floor_area = sum(4 if '1x1' not in p[0] else 1 for p in floors) or max(1.0, w * l)
    ent = -sum(c / tot * math.log(c / tot) for c in mats.values())
    return {
        'pieces': len(ps), 'w': round(max(w, l), 1), 'l': round(min(w, l), 1), 'h': round(h, 1),
        'ground': ground, 'floor_area': floor_area, 'levels': nlev, 'diag': round(diag, 2),
        'roles': dict(roles), 'mats': dict(mats), 'tier': tier,
        'roof_pitch': (45 if r45 > len(roofs) / 2 else 26) if roofs else 0, 'roof_mat': roofmat[0][0] if roofmat else '',
        'roof_share': len(roofs) / len(ps), 'decor': decor, 'decor_density': decor / floor_area,
        'mat_entropy': ent, 'nature_share': roles['nature'] / len(ps),
    }

def size_stage(f):
    a = f['w'] * f['l']
    if f['pieces'] < 220 and a < 90:
        return 's1'
    if f['pieces'] < 900 and a < 260:
        return 's2'
    return 's3'

def decor_stage(f):
    dd = f['decor_density']
    return 'd1' if dd < 0.08 else ('d2' if dd < 0.25 else 'd3')

def palette_biome(f):
    m = f['mats']
    tot = sum(m.values()) or 1
    share = lambda k: m.get(k, 0) / tot
    if share('grausten') + share('ashwood') + share('flametal') > 0.15: return 'Ashlands'
    if share('marble') + share('dvergr') > 0.15: return 'Mistlands'
    if share('glass') > 0.05: return 'Mountain'
    if share('darkwood') + share('darkroof') + share('iron') > 0.2: return 'Swamp'
    if share('stone') + share('corewood') > 0.2: return 'Black Forest'
    return 'Meadows'

rows, feats = [], {}
for d in D:
    f = features(d)
    t, site = text_of(d)
    cat = None
    if d.get('subtype') in SUBTYPE_TO_CAT:
        cat = SUBTYPE_TO_CAT[d['subtype']]
    elif d.get('type') == 'Home':
        cat = 'home'
    if not cat:
        for c, pat in CAT_WORDS:
            if re.search(pat, t):
                cat = c; break
    if (not cat or cat == 'home') and site and CAT_FROM_SITE.get(site.get('cat')) not in (None, 'home'):
        cat = CAT_FROM_SITE[site['cat']]
    r = f['roles']
    crafts = ' '.join(p[0] for p in d['pieces'] if role(p[0]) == 'craft').lower()
    if not cat or cat == 'home':
        if re.search(r'forge|smelter|blastfurnace|anvil', crafts): cat = cat or 'smithy'
        if re.search(r'beehive|cultivat', crafts): cat = cat or 'farm'
    cat = cat or 'home'
    culture = next((c for c, pat in CULTURE_WORDS if re.search(pat, t)), None)
    if not culture:
        m = f['mats']
        culture = 'norse' if (m.get('thatch', 0) + m.get('darkroof', 0) + m.get('corewood', 0)) > 0 else 'other'
    row = {'id': d['id'], 'number': d.get('number'), 'creator': d['creator'], 'label': d['label'],
           'category': cat, 'culture': culture, 'size': size_stage(f), 'decor': decor_stage(f),
           'palette': palette_biome(f), 'tier': f['tier'], 'pieces': f['pieces'], 'w': f['w'], 'l': f['l'],
           'h': f['h'], 'levels': f['levels'], 'roof_pitch': f['roof_pitch'], 'roof_mat': f['roof_mat'],
           'decor_density': round(f['decor_density'], 3), 'site_cat': (site or {}).get('cat', ''),
           'type': d.get('type') or '', 'subtype': d.get('subtype') or ''}
    rows.append(row)
    feats[d['id']] = f

os.makedirs(out_dir, exist_ok=True)
with open(os.path.join(out_dir, 'catalog.csv'), 'w', newline='') as fo:
    wr = csv.DictWriter(fo, fieldnames=list(rows[0].keys()))
    wr.writeheader(); wr.writerows(rows)
json.dump(feats, open(os.path.join(out_dir, 'features.json'), 'w'))
by_id = {r['id']: r for r in rows}

# ---------------------------------------------------------------- shell numbers per category and palette
def summary(vals):
    vals = [v for v in vals if v is not None]
    if not vals:
        return None
    vals.sort()
    return {'n': len(vals), 'p25': vals[len(vals) // 4], 'p50': vals[len(vals) // 2], 'p75': vals[3 * len(vals) // 4]}

# weight: Tyler's keepers count 3x, unreviewed 1x, dropped 0.3x
def weight(row):
    return 3.0 if row['label'] == 1 else (0.3 if row['label'] == 0 else 1.0)

shell = collections.defaultdict(lambda: collections.defaultdict(list))
pal = collections.defaultdict(collections.Counter)
for d in D:
    row = by_id[d['id']]; f = feats[d['id']]
    if f['diag'] > 0.4 or f['pieces'] < 25:
        continue
    k = row['category']
    wgt = weight(row)
    for key in ('w', 'l', 'h', 'levels', 'roof_pitch', 'pieces'):
        shell[k][key] += [f[key]] * max(1, round(wgt))
    shell[k]['roof_mat'] += [f['roof_mat']] * max(1, round(wgt))
    # palette: structural prefab counts per palette biome and role
    for p in d['pieces']:
        ro = role(p[0])
        if ro in STRUCT:
            pal[(row['palette'], ro)][p[0]] += wgt

rules = {'shell': {}, 'palettes': {}, 'decor': {}, 'placement': {}, 'groups': {}, 'cultures': {}}
for k, v in shell.items():
    rules['shell'][k] = {key: summary(vals) for key, vals in v.items() if key != 'roof_mat'}
    rules['shell'][k]['roof_mat'] = collections.Counter(v['roof_mat']).most_common(3)
for (biome, ro), c in pal.items():
    rules['palettes'].setdefault(biome, {})[ro] = [[n, round(x, 1)] for n, x in c.most_common(12)]

cult = collections.defaultdict(lambda: {'n': 0, 'cats': collections.Counter(), 'roof_pitch': collections.Counter(),
                                       'roof_mat': collections.Counter(), 'mats': collections.Counter(), 'examples': []})
for r in rows:
    c = cult[r['culture']]
    c['n'] += 1; c['cats'][r['category']] += 1; c['roof_pitch'][r['roof_pitch']] += 1; c['roof_mat'][r['roof_mat']] += 1
    for m, x in feats[r['id']]['mats'].items():
        c['mats'][m] += x
    if len(c['examples']) < 12:
        c['examples'].append(r['id'])
for k, c in cult.items():
    tot = sum(c['mats'].values()) or 1
    rules['cultures'][k] = {'n': c['n'], 'cats': c['cats'].most_common(8), 'roof_pitch': c['roof_pitch'].most_common(3),
                            'roof_mat': c['roof_mat'].most_common(3),
                            'mats': [[m, round(x / tot, 3)] for m, x in c['mats'].most_common(8)], 'examples': c['examples']}

# ---------------------------------------------------------------- furniture: what, how much, where
use_of = {'home': 'home', 'longhouse': 'hall', 'tavern': 'hall', 'smithy': 'smithy', 'sawmill': 'workshop',
          'workshop': 'workshop', 'farm': 'farm', 'barn': 'farm', 'storage': 'storage', 'harbour': 'workshop',
          'defence': 'guard', 'temple': 'temple', 'market': 'market', 'decor': 'yard', 'village': 'hall'}
per_use = collections.defaultdict(lambda: collections.defaultdict(list))  # use -> stage -> list of (item counts/area)
place = collections.defaultdict(lambda: {'n': 0, 'wall': 0, 'mount': 0, 'center': 0, 'dist': [], 'rel': collections.Counter(),
                                          'lift': [], 'near': collections.Counter()})
pairs = collections.defaultdict(list)  # (anchor, other) -> list of (dx, dz, relyaw) in anchor frame

def wall_segments(ps, ground):
    segs = []
    for p in ps:
        ro = role(p[0])
        if ro not in ('wall', 'door', 'window') or p[5]:
            continue
        a = math.radians(p[4])
        half = 1.0 if not re.search(r'1x1|1x2|quarterwall_1x1', p[0]) else 0.5
        if re.search(r'4x2|_4x', p[0]): half = 2.0
        ux, uz = math.cos(a), -math.sin(a)  # world direction of local +x
        segs.append((p[1] - ux * half, p[3] - uz * half, p[1] + ux * half, p[3] + uz * half, p[2]))
    return segs

def seg_dist(px, pz, s):
    x0, z0, x1, z1, _ = s
    dx, dz = x1 - x0, z1 - z0
    L = dx * dx + dz * dz or 1e-9
    t = max(0, min(1, ((px - x0) * dx + (pz - z0) * dz) / L))
    cx, cz = x0 + t * dx, z0 + t * dz
    return math.hypot(px - cx, pz - cz), cx, cz

for d in D:
    row = by_id[d['id']]; f = feats[d['id']]
    if f['diag'] > 0.4 or f['decor'] < 3:
        continue
    wgt = weight(row)
    use = use_of.get(row['category'], 'home')
    ps = d['pieces']
    deco = [p for p in ps if role(p[0]) in DECOR]
    cnt = collections.Counter(p[0] for p in deco)
    per_use[use][row['decor']].append(({k: v / f['floor_area'] * 100 for k, v in cnt.items()}, wgt))
    segs = wall_segments(ps, f['ground'])
    floors = [p for p in ps if role(p[0]) == 'floor']
    cx = statistics.mean(p[1] for p in ps); cz = statistics.mean(p[3] for p in ps)
    if len(deco) > 400:
        deco = deco[:400]
    for p in deco:
        k = p[0]
        pl = place[k]; pl['n'] += wgt
        under = [fl[2] for fl in floors if abs(fl[1] - p[1]) < 1.2 and abs(fl[3] - p[3]) < 1.2 and fl[2] <= p[2] + 0.05]
        lift = p[2] - max(under) if under else p[2] - f['ground']
        pl['lift'].append(round(lift, 1))
        near = [s for s in segs if abs(s[4] - p[2]) < 2.5]
        if near:
            dist, wx, wz = min((seg_dist(p[1], p[3], s) for s in near), key=lambda t: t[0])
        else:
            dist, wx, wz = 9.0, cx, cz
        if dist < 0.9:
            if lift > 0.7:
                pl['mount'] += wgt
            else:
                pl['wall'] += wgt
            # inward normal = from wall point toward the piece (or toward the centre when on the line)
            nx, nz = p[1] - wx, p[3] - wz
            if math.hypot(nx, nz) < 0.05:
                nx, nz = cx - wx, cz - wz
            n_yaw = math.degrees(math.atan2(nx, nz))
            rel = round(((p[4] - n_yaw) % 360) / 90) % 4 * 90
            pl['rel'][rel] += wgt
            pl['dist'].append(round(dist, 2))
        else:
            pl['center'] += wgt
        # neighbours for groups
        for o in deco:
            if o is p:
                continue
            dx, dz = o[1] - p[1], o[3] - p[3]
            if abs(dx) > 2.6 or abs(dz) > 2.6 or abs(o[2] - p[2]) > 0.6:
                continue
            a = math.radians(-p[4])
            lx = dx * math.cos(a) + dz * math.sin(a)
            lz = -dx * math.sin(a) + dz * math.cos(a)
            pl['near'][o[0]] += 1
            if role(p[0]) in ('table', 'fire', 'bed', 'craft') and role(o[0]) in ('seat', 'storage', 'light', 'craft', 'rug', 'deco', 'clutter'):
                pairs[(p[0], o[0])].append((round(lx * 2) / 2, round(lz * 2) / 2, round(((o[4] - p[4]) % 360) / 90) % 4 * 90))

for k, pl in place.items():
    if pl['n'] < 3:
        continue
    n = pl['n']
    mode = max(('wall', 'mount', 'center'), key=lambda m: pl[m])
    rules['placement'][k] = {
        'n': round(n, 1), 'role': role(k), 'mode': mode, 'wall': round(pl['wall'] / n, 2), 'mount': round(pl['mount'] / n, 2),
        'center': round(pl['center'] / n, 2), 'rel': pl['rel'].most_common(1)[0][0] if pl['rel'] else 0,
        'dist': statistics.median(pl['dist']) if pl['dist'] else 0.5,
        'lift': statistics.median(pl['lift']) if pl['lift'] else 0,
        'near': [x for x, _ in pl['near'].most_common(6)],
    }

for use, stages in per_use.items():
    rules['decor'][use] = {}
    for stage, lst in stages.items():
        tot_w = sum(w for _, w in lst)
        items = collections.Counter(); seen = collections.Counter()
        for cnt, w in lst:
            for k, v in cnt.items():
                items[k] += v * w; seen[k] += w
        rules['decor'][use][stage] = {
            'designs': len(lst),
            # per 100 m2 of floor, and the share of designs that have it
            'items': [[k, round(items[k] / tot_w, 2), round(seen[k] / tot_w, 2)] for k, _ in
                      sorted(items.items(), key=lambda kv: -seen[kv[0]])[:40] if seen[k] / tot_w >= 0.05],
        }

for (a, b), lst in pairs.items():
    if len(lst) < 6:
        continue
    c = collections.Counter(lst)
    top = [[x, z, r, n] for (x, z, r), n in c.most_common(4) if n >= 3]
    if top:
        rules['groups'].setdefault(a, []).append([b, len(lst), top])
for a in rules['groups']:
    rules['groups'][a].sort(key=lambda t: -t[1])
    rules['groups'][a] = rules['groups'][a][:8]

json.dump(rules, open(os.path.join(out_dir, 'rules.json'), 'w'), indent=1)
cats = collections.Counter(r['category'] for r in rows)
cults = collections.Counter(r['culture'] for r in rows)
print('designs', len(rows)); print('categories', cats.most_common()); print('cultures', cults.most_common())
print('placement rules', len(rules['placement']), 'groups', len(rules['groups']))
