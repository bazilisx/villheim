"""Study floor plans, roofs, walls, windows and gable ends in the corpus.

Usage: python3 lab/shapes.py <corpus.json> <catalog.csv> <out.json>

Per design (structural pieces only):
  plan   rectangle, long, square, L, T, U, cross, octagon/round, irregular (from the main floor level on a 1 m grid)
  roof   gable, hip, half-hip, cross-gable, shed, flat, conical, mixed, none (from roof piece facings and corner pieces)
  walls  plank, log, stone, half-timber, stone-base, marble, mixed (from wall materials by height)
  window half-wall gap, window piece, glass, grate, arch, none
  gable  roof-wall pieces, plain walls, open, none
Then counts of each pairing (plan x roof, roof x walls, culture x roof) to guide the generator.
"""
import collections, csv, json, math, re, sys

D = json.load(open(sys.argv[1]))
cat = {r['id']: r for r in csv.DictReader(open(sys.argv[2]))}

def role(n):
    for pat, r in [(r'roof.*(ocorner|icorner)', 'corner'), (r'roof.*top|_top_45', 'ridge'), (r'wall_roof', 'gable'), (r'roof', 'roof'),
                   (r'floor', 'floor'), (r'door|gate', 'door'), (r'window|crystal|grate|arch', 'window'),
                   (r'beam', 'beam'), (r'pole|pillar|column', 'pole'), (r'wall|stoneblock|blackmarble_(1x1|2x1x1|2x2x2)', 'wall')]:
        if re.search(pat, n):
            return r
    return None

def yaw(p):
    return p[4] % 360

def plan_shape(floors, diag_share):
    if len(floors) < 4:
        return 'none'
    ys = collections.Counter(round(p[2] * 2) / 2 for p in floors)
    main_y = max(ys, key=lambda k: ys[k])
    cells = set()
    for p in floors:
        if abs(p[2] - main_y) > 0.6:
            continue
        s = 1 if '1x1' in p[0] else (4 if '4x4' in p[0] else 2)
        for i in range(s):
            for j in range(s):
                cells.add((math.floor(p[1] - s / 2 + i + 0.5), math.floor(p[3] - s / 2 + j + 0.5)))
    if len(cells) < 6:
        return 'none'
    xs = [c[0] for c in cells]; zs = [c[1] for c in cells]
    x0, x1, z0, z1 = min(xs), max(xs), min(zs), max(zs)
    w, l = x1 - x0 + 1, z1 - z0 + 1
    fill = len(cells) / (w * l)
    aspect = max(w, l) / max(1, min(w, l))
    if diag_share > 0.35 and aspect < 1.4 and 0.6 < fill < 0.92:
        return 'octagon/round'
    if fill > 0.88:
        if aspect >= 2.2:
            return 'long'
        return 'square' if aspect < 1.25 else 'rectangle'
    # quadrant occupancy
    def occ(ax0, ax1, az0, az1):
        tot = (ax1 - ax0) * (az1 - az0)
        if tot <= 0:
            return 1
        n = sum(1 for (x, z) in cells if ax0 <= x < ax1 and az0 <= z < az1)
        return n / tot
    mx, mz = (x0 + x1 + 1) / 2, (z0 + z1 + 1) / 2
    q = [occ(x0, mx, z0, mz), occ(mx, x1 + 1, z0, mz), occ(x0, mx, mz, z1 + 1), occ(mx, x1 + 1, mz, z1 + 1)]
    empty = [v < 0.35 for v in q]
    # thirds for T, U and cross
    tx = [x0 + (w) * k / 3 for k in range(4)]; tz = [z0 + (l) * k / 3 for k in range(4)]
    g = [[occ(tx[i], tx[i + 1], tz[j], tz[j + 1]) for i in range(3)] for j in range(3)]
    corners_empty = sum(1 for (i, j) in [(0, 0), (2, 0), (0, 2), (2, 2)] if g[j][i] < 0.3)
    if corners_empty == 4 and g[1][1] > 0.6:
        return 'cross'
    if sum(empty) == 1:
        return 'L'
    if g[1][1] < 0.3 and sum(1 for j in range(3) for i in range(3) if g[j][i] > 0.6) >= 5:
        return 'U/courtyard'
    if corners_empty == 2:
        return 'T'
    if sum(empty) == 2:
        return 'U/courtyard' if fill < 0.7 else 'T'
    return 'irregular'

def roof_type(ps, floors_top):
    roofs = [p for p in ps if role(p[0]) == 'roof' and not p[5]]
    corners = [p for p in ps if role(p[0]) == 'corner']
    if len(roofs) < 4:
        return 'flat' if floors_top else 'none'
    facings = collections.Counter(int(((yaw(p) + 45) % 360) // 90) for p in roofs)
    tot = sum(facings.values())
    odd = sum(1 for p in roofs if 10 < (yaw(p) % 90) < 80) / len(roofs)
    if odd > 0.35:
        return 'conical'
    dirs = [k for k, v in facings.items() if v / tot > 0.08]
    if len(dirs) == 1:
        return 'shed'
    if len(dirs) == 2 and (dirs[0] - dirs[1]) % 2 == 0:
        return 'gable'
    if len(dirs) >= 3:
        if len(corners) >= 4:
            oc = sum(1 for p in corners if 'ocorner' in p[0]); ic = len(corners) - oc
            if ic >= 2:
                return 'cross-gable'
            minor = min(facings[d] for d in dirs) / max(facings[d] for d in dirs)
            return 'half-hip' if minor < 0.25 else 'hip'
        return 'cross-gable'
    return 'mixed'

def walls(ps, ground):
    w = [p for p in ps if role(p[0]) == 'wall']
    if not w:
        return 'none'
    def mat(n):
        if 'blackmarble' in n: return 'marble'
        if 'grausten' in n: return 'grausten'
        if 'stone' in n: return 'stone'
        if '_log' in n: return 'log'
        if 'decowall' in n or 'beam' in n: return 'timber'
        return 'plank'
    low = collections.Counter(mat(p[0]) for p in w if p[2] - ground < 1.6)
    high = collections.Counter(mat(p[0]) for p in w if p[2] - ground >= 1.6)
    top_low = low.most_common(1)[0][0] if low else None
    top_high = high.most_common(1)[0][0] if high else top_low
    diag_beams = sum(1 for p in ps if re.search(r'beam_(26|45)', p[0]) and abs(p[2] - ground) < 6)
    if top_low in ('stone', 'grausten', 'marble') and top_high in ('plank', 'log'):
        return 'stone-base'
    if top_high == 'plank' and diag_beams > 6 and sum(1 for p in ps if role(p[0]) == 'pole') > 10:
        return 'half-timber'
    return top_high or 'mixed'

def window(ps):
    names = ' '.join(p[0] for p in ps if role(p[0]) == 'window')
    if 'crystal' in names: return 'glass'
    if 'grate' in names: return 'grate'
    if 'arch' in names: return 'arch'
    if 'window' in names: return 'window piece'
    halves = sum(1 for p in ps if 'wall_half' in p[0] or 'quarter' in p[0])
    return 'half-wall gap' if halves > 6 else 'none'

def gable_end(ps):
    g = sum(1 for p in ps if role(p[0]) == 'gable')
    if g >= 2: return 'roof-wall pieces'
    roofs = sum(1 for p in ps if role(p[0]) == 'roof')
    if roofs < 4: return 'none'
    tri = sum(1 for p in ps if re.search(r'triangle|wall_1x1|quarter', p[0]))
    return 'stepped walls' if tri > 8 else 'open or plain'

def align(ps):
    # turn the design so its main walls run along the axes (many builds are saved at an angle)
    c = collections.Counter(round((p[4] % 90) / 5) * 5 % 90 for p in ps if role(p[0]) in ('wall', 'floor', 'roof') and not p[5])
    a0 = c.most_common(1)[0][0] if c else 0
    if a0 == 0:
        return ps
    t = math.radians(a0)
    out = []
    for p in ps:
        x, z = p[1], p[3]
        # Unity yaw a about +y maps local (x, z) to (x cos a + z sin a, -x sin a + z cos a); undo a0
        nx = x * math.cos(t) - z * math.sin(t); nz = x * math.sin(t) + z * math.cos(t)
        q = list(p); q[1], q[3], q[4] = nx, nz, (p[4] - a0) % 360
        out.append(q)
    return out

out = []
for d in D:
    ps = align(d['pieces'])
    st = [p for p in ps if role(p[0])]
    if len(st) < 20:
        continue
    ys = sorted(p[2] for p in st); ground = ys[int(len(ys) * 0.05)]
    floors = [p for p in st if role(p[0]) == 'floor']
    diag = sum(1 for p in st if 15 < (p[4] % 90) < 75) / len(st)
    top_y = ys[int(len(ys) * 0.97)]
    floors_top = sum(1 for p in floors if p[2] > top_y - 1.2) >= 4
    row = cat.get(d['id'], {})
    out.append({'id': d['id'], 'label': d['label'], 'category': row.get('category'), 'culture': row.get('culture'),
                'palette': row.get('palette'), 'plan': plan_shape(floors, diag), 'roof': roof_type(st, floors_top),
                'walls': walls(st, ground), 'window': window(st), 'gable': gable_end(st)})

def table(a, b, rows):
    c = collections.Counter((r[a], r[b]) for r in rows)
    return [[x, y, n] for (x, y), n in c.most_common(60)]

summary = {
    'n': len(out),
    'plan': collections.Counter(r['plan'] for r in out).most_common(),
    'roof': collections.Counter(r['roof'] for r in out).most_common(),
    'walls': collections.Counter(r['walls'] for r in out).most_common(),
    'window': collections.Counter(r['window'] for r in out).most_common(),
    'gable': collections.Counter(r['gable'] for r in out).most_common(),
    'plan_x_roof': table('plan', 'roof', out), 'roof_x_walls': table('roof', 'walls', out),
    'category_x_plan': table('category', 'plan', out), 'category_x_roof': table('category', 'roof', out),
    'culture_x_roof': table('culture', 'roof', out), 'palette_x_walls': table('palette', 'walls', out),
    'kept_plan': collections.Counter(r['plan'] for r in out if r['label'] == 1).most_common(),
    'kept_roof': collections.Counter(r['roof'] for r in out if r['label'] == 1).most_common(),
    'examples': {k: [r['id'] for r in out if r['plan'] == k or r['roof'] == k][:8] for k in
                 ['L', 'T', 'U/courtyard', 'cross', 'octagon/round', 'hip', 'half-hip', 'cross-gable', 'conical', 'shed', 'flat']},
}
json.dump({'summary': summary, 'designs': out}, open(sys.argv[3], 'w'), indent=1)
for k in ('plan', 'roof', 'walls', 'window', 'gable', 'kept_plan', 'kept_roof'):
    print(k, summary[k])
print('plan x roof', summary['plan_x_roof'][:25])
print('category x roof', summary['category_x_roof'][:30])
