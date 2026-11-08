"""Read every blueprint into one corpus file with review labels.

Usage: python3 lab/build_corpus.py <corpus dir> <out json>
The corpus dir holds pb/ (PlanBuild blueprints folder), hs/ (the 12 permitted keepers),
profile/Villheim/*.csv and review.json (the Review tab).
Files from the OverDrive BiomeBlueprints pack are never read, other than the 12 keepers named in Keepers.cs.
"""
import csv, json, math, os, re, sys

root, out = sys.argv[1], sys.argv[2]

def parse(path):
    meta, pieces, snaps, mode = {}, [], [], None
    with open(path, encoding='utf-8', errors='replace') as f:
        for line in f:
            line = line.rstrip('\r\n')
            if not line:
                continue
            if line.startswith('#'):
                key, _, val = line[1:].partition(':')
                if key in ('Pieces', 'SnapPoints', 'Terrain'):
                    mode = key
                else:
                    meta[key] = val.strip().strip('"')
                continue
            p = line.split(';')
            if mode == 'Pieces' and len(p) >= 9:
                try:
                    x, y, z, qx, qy, qz, qw = (float(v) for v in p[2:9])
                except ValueError:
                    continue
                sc = [1.0, 1.0, 1.0]
                if len(p) >= 13:
                    try:
                        sc = [float(v) for v in p[10:13]]
                    except ValueError:
                        pass
                yaw = math.degrees(math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qx * qx)))
                tilt = abs(qx) > 0.02 or abs(qz) > 0.02
                pieces.append([p[0], round(x, 3), round(y, 3), round(z, 3), round(yaw, 1), 1 if tilt else 0,
                               [round(v, 4) for v in (qx, qy, qz, qw)], [round(v, 3) for v in sc],
                               p[9] if len(p) > 9 else '', p[13] if len(p) > 13 else ''])
            elif mode == 'SnapPoints' and len(p) == 3:
                try:
                    snaps.append([float(v) for v in p])
                except ValueError:
                    pass
    return meta, pieces, snaps

files = []
for d, _, fs in os.walk(os.path.join(root, 'pb')):
    files += [os.path.join(d, f) for f in fs if f.endswith('.blueprint')]
hs_ok = set(open(os.path.join(root, 'hs_keepers.txt')).read().split())
for d, _, fs in os.walk(os.path.join(root, 'hs')):
    files += [os.path.join(d, f) for f in fs if f.endswith('.blueprint') and f[:-10] in hs_ok]

# design numbers, review verdicts, sort results
numbers = {}
with open(os.path.join(root, 'profile/Villheim/design-list.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        numbers[r['Name']] = r
review = {}
for r in json.load(open(os.path.join(root, 'review.json')))['values']:
    if len(r) >= 4:
        review[r[1]] = r[2]
sort = {}
with open(os.path.join(root, 'profile/Villheim/design-sort.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f):
        sort[r['Number']] = r

designs = []
for path in sorted(files):
    base = os.path.basename(path)[:-10]
    meta, pieces, snaps = parse(path)
    if not pieces:
        continue
    key = 'bp:' + base
    num = numbers.get(key, {}).get('Number')
    verdict = review.get(num) if num else None
    label = None
    if verdict:
        label = 1 if verdict.lower().startswith('yes') else 0
    s = sort.get(num, {}) if num else {}
    designs.append({
        'id': base, 'number': int(num) if num else None, 'file': os.path.relpath(path, root),
        'name': meta.get('Name', base), 'creator': meta.get('Creator', ''), 'category': meta.get('Category', ''),
        'description': meta.get('Description', '')[:200],
        'own': base.startswith('Báz_') or meta.get('Creator', '') in ('Báz', 'Baz', 'bazilisx'),
        'stage': numbers.get(key, {}).get('Stage', ''), 'label': label, 'verdict': verdict,
        'type': s.get('Type') or None, 'subtype': s.get('Subtype') or None,
        'pieces': pieces, 'snaps': snaps,
    })

json.dump(designs, open(out, 'w'), separators=(',', ':'))
n = len(designs)
print(n, 'designs;', sum(len(d['pieces']) for d in designs), 'pieces;',
      'kept', sum(d['label'] == 1 for d in designs), 'dropped', sum(d['label'] == 0 for d in designs),
      'unreviewed', sum(d['label'] is None for d in designs), 'own', sum(d['own'] for d in designs))
