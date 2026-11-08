"""Learn how builders furnish rooms, from the best-liked blueprints in the corpus.

Usage: python3 lab/learn_interior.py <corpus dir> <out json> [--top 0.5] [--list chosen.csv]

The corpus dir is the one lab/build_corpus.py reads: vh/ (valheimians downloads and vh/index-all.json with
downloads, votes and views), pb/ and hs/ (PlanBuild and the permitted keepers), review.json and
profile/Villheim/design-list.csv (Tyler's Yes and No, and the game's notes on what each design needs).

Chosen designs: valheimians builds in the top share by popularity (downloads, votes and downloads per view, as
percentiles), plus every design Tyler marked Yes. A design counts only if it has an interior: furniture standing
on a floor inside a room that has walls round it and a roof or floor over it.

For every room found it records the room's kind, size, doors and windows, and for every piece of furniture in it:
distance to the nearest wall and which way it faces from that wall, corner or not, height above the floor, distance
to doors and to the fire, whether it stands on a rug, whether a wall-hung piece is over a window or door, and how
far it sits from the middle of its wall. Then pairs (what stands next to what, in the first piece's frame) and the
free depth inside each door. Writes one JSON file the decorator reads (data/interior.json).
"""
import collections, csv, json, math, os, re, statistics, sys

args = [a for a in sys.argv[1:] if not a.startswith('--')]
opts = {}
for i, a in enumerate(sys.argv):
    if a.startswith('--') and i + 1 < len(sys.argv):
        opts[a[2:]] = sys.argv[i + 1]
root, out_path = args[0], args[1]
TOP = float(opts.get('top', 0.5))

# ---------------------------------------------------------------- roles (rug and bed before the deco words)
ROLE_RULES = [
    (r'rug|carpet', 'rug'),
    (r'roof.*top|_top_45|roof_top', 'roofTop'), (r'roof.*(ocorner|icorner)', 'roofCorner'),
    (r'wall_roof', 'gable'), (r'roof', 'roof'), (r'beam|_log_(26|45|67)', 'beam'),
    (r'pole|pillar|column', 'pole'), (r'floor', 'floor'), (r'stair|ladder', 'stair'), (r'door|gate', 'door'),
    (r'window|crystal_wall|glass', 'window'), (r'stake_wall|stakewall|sharpstakes|fence', 'fence'),
    (r'walltorch|sconce', 'light'),
    (r'wall|arch|stoneblock|blackmarble_(1x1|2x1x1|2x2x2|2x2x1)|blackmarble_tile_wall', 'wall'),
    (r'bed', 'bed'), (r'table|piece_workbench$', 'table'), (r'bench|throne|chair|stool', 'seat'),
    (r'chest|barrel|drawer|crate', 'storage'), (r'hearth|fire_pit', 'fire'),
    (r'cookingstation|cauldron|oven|forge|smelter|kiln|blastfurnace|anvil|grindstone|tanning|spinning|stonecutter|'
     r'artisan|magetable|ext\d|workbench|windmill|refinery|fermenter|beehive|bathtub|cart|portal|press|preptable', 'craft'),
    (r'torch|lantern|brazier|candle|Candle|wisplure|lamp', 'light'),
    (r'itemstand|ArmorStand|sign|banner|trophy|raven|wolf|dragon|xmas|garland|jackoturnip|totem|statue|head|guard_stone', 'deco'),
    (r'stack|pile|Placeable_Stone|treasure', 'clutter'),
]
ROLE_RE = [(re.compile(p), r) for p, r in ROLE_RULES]
_rc = {}
def role(n):
    r = _rc.get(n)
    if r is None:
        r = next((r for p, r in ROLE_RE if p.search(n)), 'misc')
        _rc[n] = r
    return r

WALLISH = {'wall', 'door', 'window', 'fence'}
BLOCK = {'wall', 'door', 'window', 'fence', 'pole', 'stair'}
FURN = {'bed', 'table', 'seat', 'storage', 'fire', 'craft', 'deco', 'rug', 'light', 'clutter'}
OVER = {'roof', 'roofTop', 'roofCorner', 'floor', 'beam', 'gable'}

def size_of(n):
    """Footprint and height in the piece's frame: [x, h, z]. Rough, by name (as lib/pieces.js)."""
    r = role(n)
    if r == 'floor':
        if re.search(r'4x4', n): return [4, 0.25, 4]
        if re.search(r'1x1|triangle', n): return [1, 0.25, 1]
        if n == 'stone_floor_2x2': return [2, 1, 2]
        return [2, 0.25, 2]
    if r in ('wall', 'door', 'window', 'fence'):
        w = 2.0
        if re.search(r'4x2|_4x', n): w = 4.0
        elif re.search(r'1x1|1x2|_1m', n): w = 1.0
        h = 2.0
        if re.search(r'2x1|_half|halfwall', n): h = 1.0
        if re.search(r'quarter', n): h = 0.5
        if re.search(r'1x1', n): h = 1.0
        if n == 'wood_wall_log': h = 0.5
        if re.search(r'stake', n): w, h = 4.0, 3.0
        if r == 'window' and not re.search(r'crystal', n): w, h = 1.0, 1.0
        d = 1.0 if re.search(r'2x1x1|2x2x1|stone_wall_2x1|stone_wall_1x1|stone_wall_4x2', n) else 0.3
        return [w, h, d]
    if r == 'pole': return [0.3, 4 if re.search(r'4', n) else (1 if re.search(r'_1m|pole$', n) and 'pole2' not in n else 2), 0.3]
    if r == 'stair': return [2, 2, 2]
    if r == 'beam': return [2, 0.25, 0.25]
    return [0.8, 0.8, 0.8]

# ---------------------------------------------------------------- choose designs
def num(s):
    s = str(s or '0').strip().lower().replace(',', '')
    m = 1
    if s.endswith('k'): m, s = 1000, s[:-1]
    try: return float(s) * m
    except ValueError: return 0.0

index = {}
for r in json.load(open(os.path.join(root, 'vh/index-all.json'))):
    if 'dls' in r or r['slug'] not in index:
        index[r['slug']] = r

def pct_rank(vals):
    s = sorted(vals)
    return lambda v: (sum(1 for x in s if x < v) + 0.5 * sum(1 for x in s if x == v)) / len(s)

metric = [r for r in index.values() if 'dls' in r and num(r['views']) > 0]
p_dl = pct_rank([num(r['dls']) for r in metric])
p_vo = pct_rank([num(r['votes']) for r in metric])
p_cv = pct_rank([num(r['dls']) / num(r['views']) for r in metric])
popularity = {r['slug']: 0.5 * p_dl(num(r['dls'])) + 0.3 * p_vo(num(r['votes'])) + 0.2 * p_cv(num(r['dls']) / num(r['views']))
              for r in metric}

review = {}
for r in json.load(open(os.path.join(root, 'review.json')))['values']:
    if len(r) >= 4: review[r[3]] = r[2]
numbers = {}
with open(os.path.join(root, 'profile/Villheim/design-list.csv'), encoding='utf-8') as f:
    for r in csv.DictReader(f): numbers[r['Name']] = r

cands = []
for sub in ('vh', 'pb', 'hs'):
    for d, _, fs in os.walk(os.path.join(root, sub)):
        for f in sorted(fs):
            if not f.endswith('.blueprint'): continue
            base = f[:-10]
            path = os.path.join(d, f)
            if sub == 'vh':
                slug = base.split('__')[0]
                pop = popularity.get(slug)
                if pop is None or pop < 1 - TOP: continue
                cands.append({'path': path, 'id': base, 'slug': slug, 'pop': pop, 'why': 'valheimians', 'cat': d.split('/')[-1]})
            else:
                v = review.get(base, '')
                if v.lower().startswith('yes'):
                    cands.append({'path': path, 'id': base, 'slug': base, 'pop': 1.0, 'why': 'Tyler Yes', 'cat': sub})

def parse(path):
    pieces, mode = [], None
    for line in open(path, encoding='utf-8', errors='replace'):
        line = line.rstrip('\r\n')
        if line.startswith('#'):
            mode = line[1:].split(':')[0]
            continue
        if mode != 'Pieces': continue
        p = line.split(';')
        if len(p) < 9: continue
        try:
            x, y, z, qx, qy, qz, qw = (float(v) for v in p[2:9])
        except ValueError:
            continue
        if len(p) >= 13:
            try:
                if any(abs(float(v) - 1) > 0.05 for v in p[10:13]): continue  # scaled pieces are not vanilla sizes
            except ValueError:
                pass
        yaw = math.degrees(math.atan2(2 * (qw * qy + qx * qz), 1 - 2 * (qy * qy + qx * qx)))
        tilt = abs(qx) > 0.05 or abs(qz) > 0.05
        pieces.append([p[0], x, y, z, yaw % 360, tilt])
    return pieces

# ---------------------------------------------------------------- geometry helpers
def axes(yaw):
    a = math.radians(yaw)
    return (math.cos(a), -math.sin(a)), (math.sin(a), math.cos(a))  # local +x, local +z in world (x, z)

def obb_dist(px, pz, p, w, d):
    """Distance from a point to a piece's footprint rectangle (0 inside)."""
    (ux, uz), (vx, vz) = axes(p[4])
    dx, dz = px - p[1], pz - p[3]
    a, b = dx * ux + dz * uz, dx * vx + dz * vz
    ea, eb = max(0.0, abs(a) - w / 2), max(0.0, abs(b) - d / 2)
    return math.hypot(ea, eb)

def to_local(dx, dz, yaw):
    (ux, uz), (vx, vz) = axes(yaw)
    return dx * ux + dz * uz, dx * vx + dz * vz

def norm_yaw(a): return a % 360

def q90(a):
    a = norm_yaw(a)
    k = round(a / 90) % 4
    return k * 90 if abs(((a - k * 90 + 180) % 360) - 180) < 20 else None

# ---------------------------------------------------------------- accumulators
items = collections.defaultdict(lambda: collections.defaultdict(list))
item_n = collections.Counter()
room_rows = []
pairs = collections.defaultdict(list)
door_free = []
door_free_by = collections.defaultdict(list)
stand = collections.defaultdict(list)   # floor prefab -> furniture y - floor y
same_gap = collections.defaultdict(list)  # item -> side-by-side spacing of two of the same, same facing
chosen = []
seen_sig = set()

GRID = 0.5

def analyse(c):
    ps = parse(c['path'])
    if len(ps) < 30: return
    sig = (len(ps), tuple(sorted((p[0], round(p[1] - ps[0][1]), round(p[2] - ps[0][2]), round(p[3] - ps[0][3])) for p in ps[:200])))
    if sig in seen_sig: return
    seen_sig.add(sig)
    furn_all = [p for p in ps if role(p[0]) in FURN and not p[5]]
    if len(furn_all) < 6: return
    # turn the build so its walls run along the axes
    hist = collections.Counter()
    for p in ps:
        if role(p[0]) in WALLISH and not p[5]: hist[round(p[4] % 90)] += 1
    if not hist: return
    rot = hist.most_common(1)[0][0]
    if rot > 45: rot -= 90
    if abs(rot) > 0.5:
        a = math.radians(rot)  # rotate by -rot about y: yaw - rot
        ca, sa = math.cos(a), math.sin(a)
        for p in ps:
            x, z = p[1], p[3]
            p[1], p[3] = x * ca - z * sa, x * sa + z * ca
            p[4] = norm_yaw(p[4] - rot)
    floors = [p for p in ps if role(p[0]) == 'floor' and not p[5]]
    walls = [p for p in ps if role(p[0]) in BLOCK and not p[5]]
    overs = [p for p in ps if role(p[0]) in OVER]
    if not floors or not walls: return
    # floor tops, measured: furniture standing on a floor piece sits this far above its pivot
    def top_of(f):
        n = f[0]
        if n == 'stone_floor_2x2': return f[2] + 0.5
        if re.search(r'blackmarble_floor|grausten_floor|dvergr.*floor', n): return f[2] + 0.1
        return f[2] + 0.1
    for p in furn_all:
        r = role(p[0])
        if r not in ('bed', 'storage', 'table', 'seat', 'craft'): continue
        for f in floors:
            sz = size_of(f[0])
            if abs(f[1] - p[1]) < sz[0] / 2 and abs(f[3] - p[3]) < sz[2] / 2 and -0.1 < p[2] - f[2] < 0.8:
                stand[f[0]].append(round(p[2] - f[2], 2))
                break
    # floor levels
    support = {}
    for i, p in enumerate(furn_all):
        best = None
        for f in floors:
            sz = size_of(f[0])
            if abs(f[1] - p[1]) > sz[0] / 2 + 0.05 or abs(f[3] - p[3]) > sz[2] / 2 + 0.05: continue
            t = top_of(f)
            dy = p[2] - t
            r = role(p[0])
            mount = r in ('deco', 'light') and dy > 0.6
            if (-0.2 < dy < 0.35) or (mount and dy < 4.5):
                if best is None or t > best: best = t
        if best is not None: support[i] = round(best * 4) / 4
    levels = collections.Counter(v for i, v in support.items() if -0.2 < furn_all[i][2] - v < 0.35)
    if not levels: return
    rooms_here = []
    c['_ground'] = min(levels)
    for L, nlev in levels.items():
        if nlev < 3: continue
        rooms_here += rooms_at(c, ps, L, floors, walls, overs, furn_all, support, top_of)
    if len([r for r in rooms_here if r['furn'] >= 3]) == 0: return
    chosen.append({'id': c['id'], 'slug': c['slug'], 'why': c['why'], 'pop': round(c['pop'], 3), 'cat': c['cat'],
                   'rooms': len(rooms_here), 'pieces': len(ps)})

def rooms_at(c, ps, L, floors, walls, overs, furn_all, support, top_of):
    global overs_g
    overs_g = overs
    lvl_floors = [f for f in floors if abs(top_of(f) - L) < 0.3]
    if not lvl_floors: return []
    xs = [f[1] for f in lvl_floors]; zs = [f[3] for f in lvl_floors]
    x0, x1, z0, z1 = min(xs) - 3, max(xs) + 3, min(zs) - 3, max(zs) + 3
    nx, nz = int((x1 - x0) / GRID) + 1, int((z1 - z0) / GRID) + 1
    if nx * nz > 160000: return []
    cell = lambda i, j: (x0 + (i + 0.5) * GRID, z0 + (j + 0.5) * GRID)
    floor_c = set()
    for f in lvl_floors:
        sz = size_of(f[0])
        for i in range(int((f[1] - sz[0] / 2 - x0) / GRID) - 1, int((f[1] + sz[0] / 2 - x0) / GRID) + 2):
            for j in range(int((f[3] - sz[2] / 2 - z0) / GRID) - 1, int((f[3] + sz[2] / 2 - z0) / GRID) + 2):
                if 0 <= i < nx and 0 <= j < nz:
                    cx, cz = cell(i, j)
                    if obb_dist(cx, cz, f, sz[0], sz[2]) < 0.01: floor_c.add((i, j))
    band = [w for w in walls if w[2] - size_of(w[0])[1] / 2 < L + 1.4 and w[2] + size_of(w[0])[1] / 2 > L + 0.4]
    blocked = {}
    for w in band:
        sz = size_of(w[0])
        rr = max(sz[0], sz[2]) / 2 + 0.5
        for i in range(int((w[1] - rr - x0) / GRID), int((w[1] + rr - x0) / GRID) + 1):
            for j in range(int((w[3] - rr - z0) / GRID), int((w[3] + rr - z0) / GRID) + 1):
                if (i, j) in floor_c:
                    cx, cz = cell(i, j)
                    if obb_dist(cx, cz, w, sz[0], sz[2]) <= 0.2: blocked[(i, j)] = w
    free = floor_c - set(blocked)
    # rooms: connected free cells
    comp = {}
    rooms = []
    for s in free:
        if s in comp: continue
        k = len(rooms); stack = [s]; comp[s] = k; cells = []
        while stack:
            a = stack.pop(); cells.append(a)
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                b = (a[0] + d[0], a[1] + d[1])
                if b in free and b not in comp:
                    comp[b] = k; stack.append(b)
        rooms.append(cells)
    out = []
    lvl_furn = [(i, p) for i, p in enumerate(furn_all) if i in support and support[i] == L]
    for k, cells in enumerate(rooms):
        area = len(cells) * GRID * GRID
        if area < 3 or area > 500: continue
        cs = set(cells)
        # enclosure: border cells next to a blocked cell rather than open floor edge
        edge_wall = edge_open = 0
        for a in cells:
            for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                b = (a[0] + d[0], a[1] + d[1])
                if b in cs: continue
                if b in blocked: edge_wall += 1
                else: edge_open += 1
        if edge_wall < 0.6 * (edge_wall + edge_open): continue
        # covered: something over most cells
        cov = 0; ceil = []
        sample = cells[::max(1, len(cells) // 60)]
        for a in sample:
            cx, cz = cell(*a)
            hs = [o[2] for o in overs if L + 1.5 < o[2] < L + 14 and abs(o[1] - cx) < 2.2 and abs(o[3] - cz) < 2.2]
            if hs: cov += 1; ceil.append(min(hs))
        if cov < 0.7 * len(sample): continue
        ceiling = statistics.median(ceil) - L if ceil else 3
        # furniture in this room
        mine = []
        for i, p in lvl_furn:
            gi, gj = int((p[1] - x0) / GRID), int((p[3] - z0) / GRID)
            hit = (gi, gj) in cs or any((gi + a, gj + b) in cs for a in (-1, 0, 1) for b in (-1, 0, 1))
            if hit: mine.append(p)
        # wall-hung pieces whose floor is this level
        for i, p in enumerate(furn_all):
            if i not in support or support[i] != L: continue
            if p[2] - L <= 0.6: continue
            gi, gj = int((p[1] - x0) / GRID), int((p[3] - z0) / GRID)
            if any((gi + a, gj + b) in cs for a in (-2, -1, 0, 1, 2) for b in (-2, -1, 0, 1, 2)) and p not in mine:
                mine.append(p)
        if len(mine) < 2: continue
        # doors and windows touching the room
        near_walls = {id(w): w for a in cells for d in ((1, 0), (-1, 0), (0, 1), (0, -1), (2, 0), (-2, 0), (0, 2), (0, -2))
                      for w in [blocked.get((a[0] + d[0], a[1] + d[1]))] if w is not None}
        doors = [w for w in near_walls.values() if role(w[0]) == 'door']
        wins = [w for w in walls if role(w[0]) == 'window' and any(
            obb_dist(*cell(*a), w, size_of(w[0])[0], 0.3) < 0.8 for a in cells[::max(1, len(cells) // 80)])]
        room_walls = [w for w in near_walls.values() if role(w[0]) in ('wall', 'window', 'door')]
        out.append(describe(c, L, cells, cs, cell, area, ceiling, mine, doors, wins, room_walls, walls))
    return out

def describe(c, L, cells, cs, cell, area, ceiling, mine, doors, wins, room_walls, all_walls):
    cnt = collections.Counter(p[0] for p in mine)
    rcnt = collections.Counter(role(p[0]) for p in mine)
    kind = classify(cnt, rcnt)
    xs = [cell(*a)[0] for a in cells]; zs = [cell(*a)[1] for a in cells]
    rcx, rcz = statistics.mean(xs), statistics.mean(zs)
    fires = [p for p in mine if role(p[0]) == 'fire']
    rugs = [p for p in mine if role(p[0]) == 'rug']
    upper = L > c.get('_ground', L) + 1.5
    row = {'upper': upper, 'kind': kind, 'area': area, 'ceiling': round(ceiling, 2), 'level': L, 'doors': len(doors), 'windows': len(wins),
           'items': dict(cnt), 'design': c['id'], 'furn': sum(1 for p in mine if role(p[0]) not in ('rug',))}
    room_rows.append(row)
    # walls of this room for distances: wall-ish pieces near the room, by segment
    segs = []
    for w in all_walls:
        r = role(w[0])
        if r not in ('wall', 'window', 'door'): continue
        sz = size_of(w[0])
        if w[2] + sz[1] / 2 < L + 0.2 or w[2] - sz[1] / 2 > L + 3.5: continue
        if abs(w[1] - rcx) > math.sqrt(area) + 6 or abs(w[3] - rcz) > math.sqrt(area) + 6: continue
        (ux, uz), _ = axes(w[4])
        h = sz[0] / 2
        segs.append((w[1] - ux * h, w[3] - uz * h, w[1] + ux * h, w[3] + uz * h, w, r, w[2] - sz[1] / 2, w[2] + sz[1] / 2))
    def nearest_seg(px, pz, y0, y1, skip=None):
        best = None
        for s in segs:
            if s[7] < y0 or s[6] > y1 or s is skip: continue
            dx, dz = s[2] - s[0], s[3] - s[1]
            LL = dx * dx + dz * dz or 1e-9
            t = max(0, min(1, ((px - s[0]) * dx + (pz - s[1]) * dz) / LL))
            qx, qz = s[0] + t * dx, s[1] + t * dz
            d = math.hypot(px - qx, pz - qz)
            if best is None or d < best[0]: best = (d, qx, qz, s)
        return best
    for p in mine:
        n = p[0]; r = role(n)
        lift = p[2] - L
        mounted = lift > 0.6 and r in ('deco', 'light')
        on_table = lift > 0.6 and not mounted
        it = items[n]
        item_n[n] += 1
        it['room'].append(kind)
        it['lift'].append(round(lift, 2))
        y0, y1 = (L + lift - 0.2, L + lift + 0.4) if mounted else (L + 0.2, L + 1.0)
        ns = nearest_seg(p[1], p[3], y0, y1)
        if ns:
            d, qx, qz, s = ns
            it['wall'].append(round(d, 2))
            nxw, nzw = rcx - qx, rcz - qz
            (ux, uz) = (s[2] - s[0], s[3] - s[1])
            ln = math.hypot(ux, uz) or 1
            ux, uz = ux / ln, uz / ln
            nvx, nvz = -uz, ux
            if (p[1] - qx) * nvx + (p[3] - qz) * nvz < -0.02 or (abs((p[1] - qx) * nvx + (p[3] - qz) * nvz) <= 0.02 and nxw * nvx + nzw * nvz < 0):
                nvx, nvz = -nvx, -nvz
            n_yaw = math.degrees(math.atan2(nvx, nvz))
            if d < 0.9:
                rel = q90(p[4] - n_yaw)
                it['rel'].append(rel if rel is not None else -1)
                # corner: another wall across, within 1.3 m
                ns2 = None
                for s2 in segs:
                    if s2 is s or s2[7] < y0 or s2[6] > y1: continue
                    vx, vz = s2[2] - s2[0], s2[3] - s2[1]
                    lv = math.hypot(vx, vz) or 1
                    if abs((vx * ux + vz * uz) / lv) > 0.3: continue
                    dd = seg_point(p[1], p[3], s2)
                    if dd < 1.3: ns2 = dd; break
                it['corner'].append(1 if ns2 is not None else 0)
                if mounted:
                    # over a window or door on the same wall line, and offset from the middle of the wall face
                    over = 0
                    for s2 in segs:
                        if s2[5] not in ('window', 'door'): continue
                        if abs(((s2[0] + s2[2]) / 2 - qx) * nvx + ((s2[1] + s2[3]) / 2 - qz) * nvz) > 0.4: continue
                        along = abs(((s2[0] + s2[2]) / 2 - qx) * ux + ((s2[1] + s2[3]) / 2 - qz) * uz)
                        half = math.hypot(s2[2] - s2[0], s2[3] - s2[1]) / 2
                        if along < half + 0.2: over = 1
                    it['overOpening'].append(over)
                    off_face, off_run = face_offsets(qx, qz, ux, uz, nvx, nvz, segs, L, lift)
                    it['faceOff'].append(off_face)
                    it['runOff'].append(off_run)
        else:
            it['wall'].append(9)
        # walls along the piece's own axes: behind (-z), in front (+z), left (-x), right (+x)
        if not mounted and not on_table:
            (ax, az), (bx, bz) = axes(p[4])
            for key, (dx, dz) in (('back', (-bx, -bz)), ('front', (bx, bz)), ('left', (-ax, -az)), ('right', (ax, az))):
                hit = ray(p[1], p[3], dx, dz, segs, L + 0.2, L + 1.0)
                if hit is not None: it[key].append(round(hit, 2))
        if mounted:
            above = [o for o in overs_g if o[2] > p[2] + 0.05 and o[2] < p[2] + 3 and abs(o[1] - p[1]) < 1.2 and abs(o[3] - p[3]) < 1.2]
            if above: it['underCeiling'].append(round(min(o[2] for o in above) - p[2], 2))
        if doors:
            dd = min(math.hypot(p[1] - w[1], p[3] - w[3]) for w in doors)
            it['door'].append(round(dd, 2))
        fs = [f for f in mine if role(f[0]) == 'fire' and f is not p]
        if fs:
            it['fire'].append(round(min(math.hypot(p[1] - f[1], p[3] - f[3]) for f in fs), 2))
        if r != 'rug' and not mounted:
            it['onRug'].append(1 if any(abs(to_local(p[1] - g[1], p[3] - g[3], g[4])[0]) < 1.1 and abs(to_local(p[1] - g[1], p[3] - g[3], g[4])[1]) < 1.4 for g in rugs) else 0)
        if r == 'light' and not mounted:
            others = [o for o in mine if o is not p and role(o[0]) in ('bed', 'table', 'seat', 'storage', 'craft') and abs(o[2] - p[2]) < 0.5]
            if others: it['furnGap'].append(round(min(math.hypot(o[1] - p[1], o[3] - p[3]) for o in others), 2))
        # pairs in the anchor's frame
        if r in ('bed', 'table', 'fire', 'craft', 'storage', 'seat', 'light', 'deco') and not on_table:
            for o in mine:
                if o is p: continue
                dx, dz = o[1] - p[1], o[3] - p[3]
                if abs(dx) > 3.2 or abs(dz) > 3.2: continue
                lx, lz = to_local(dx, dz, p[4])
                ry = q90(o[4] - p[4])
                pairs[(n, o[0])].append((round(lx * 4) / 4, round((o[2] - p[2]) * 4) / 4, round(lz * 4) / 4, ry if ry is not None else -1, kind))
                if o[0] == n and ry == 0 and abs(o[2] - p[2]) < 0.1 and abs(lz) < 0.3 and abs(lx) < 3.2:
                    same_gap[n].append(round(abs(lx), 2))
    # free depth inside each door: walk in along the door's normal; first furniture within 0.6 m of the line
    for w in doors:
        (ux, uz), (vx, vz) = axes(w[4])
        sgn = 1 if (rcx - w[1]) * vx + (rcz - w[3]) * vz > 0 else -1
        vx, vz = vx * sgn, vz * sgn
        depth = 4.0
        for o in mine:
            ro = role(o[0])
            if ro in ('rug',) or o[2] - L > 0.6: continue
            a = (o[1] - w[1]) * ux + (o[3] - w[3]) * uz
            b = (o[1] - w[1]) * vx + (o[3] - w[3]) * vz
            if b > 0 and abs(a) < 1.1: depth = min(depth, b)
        door_free.append(round(depth, 2))
        door_free_by[kind].append(round(depth, 2))
    return row

def ray(px, pz, dx, dz, segs, y0, y1, far=4.0):
    best = None
    for s in segs:
        if s[7] < y0 or s[6] > y1: continue
        ex, ez = s[2] - s[0], s[3] - s[1]
        den = dx * ez - dz * ex
        if abs(den) < 1e-6: continue
        t = ((s[0] - px) * ez - (s[1] - pz) * ex) / den
        u = ((s[0] - px) * dz - (s[1] - pz) * dx) / den
        if t > 0 and -0.05 <= u <= 1.05 and t < far and (best is None or t < best): best = t
    return best

def seg_point(px, pz, s):
    dx, dz = s[2] - s[0], s[3] - s[1]
    LL = dx * dx + dz * dz or 1e-9
    t = max(0, min(1, ((px - s[0]) * dx + (pz - s[1]) * dz) / LL))
    return math.hypot(px - (s[0] + t * dx), pz - (s[1] + t * dz))

def face_offsets(qx, qz, ux, uz, nvx, nvz, segs, L, lift):
    """Offset of a wall point from the middle of its wall face (all collinear pieces that touch, openings included)
    and from the middle of the run of plain wall it sits on (openings break the run)."""
    line = []
    for s in segs:
        mx, mz = (s[0] + s[2]) / 2, (s[1] + s[3]) / 2
        if abs((mx - qx) * nvx + (mz - qz) * nvz) > 0.3: continue
        vx, vz = s[2] - s[0], s[3] - s[1]
        lv = math.hypot(vx, vz) or 1
        if abs((vx * ux + vz * uz) / lv) < 0.95: continue
        if s[7] < L + lift - 0.3 or s[6] > L + lift + 0.3: continue
        a0 = (s[0] - qx) * ux + (s[1] - qz) * uz
        a1 = (s[2] - qx) * ux + (s[3] - qz) * uz
        line.append((min(a0, a1), max(a0, a1), s[5]))
    if not line: return None, None
    line.sort()
    def run(ok):
        lo = hi = None
        segs_ok = [l for l in line if ok(l)]
        # grow from the piece under the point (a = 0)
        cur = [l for l in segs_ok if l[0] - 0.05 <= 0 <= l[1] + 0.05]
        if not cur: return None
        lo, hi = min(l[0] for l in cur), max(l[1] for l in cur)
        changed = True
        while changed:
            changed = False
            for l in segs_ok:
                if l[0] <= hi + 0.1 and l[1] > hi: hi = l[1]; changed = True
                if l[1] >= lo - 0.1 and l[0] < lo: lo = l[0]; changed = True
        return round(abs((lo + hi) / 2), 2), round(hi - lo, 2)
    f = run(lambda l: True)
    r = run(lambda l: l[2] == 'wall')
    return f, r

def classify(cnt, rcnt):
    names = ' '.join(cnt)
    beds = rcnt['bed']; seats = rcnt['seat']; tables = rcnt['table']
    fire = rcnt['fire']
    if re.search(r'forge|smelter|blastfurnace|charcoal_kiln', names) and beds == 0: return 'smithy'
    if re.search(r'workbench|stonecutter|artisan|spinningwheel|magetable', names) and beds == 0 and tables <= 2 and seats < 4: return 'workshop'
    if beds >= 1 and (seats + tables) <= max(3, beds * 2) and not fire: return 'sleeping'
    if beds >= 1: return 'home'
    stor = rcnt['storage']
    total = sum(cnt.values()) - rcnt['rug'] - rcnt['light']
    if stor >= 3 and stor >= 0.5 * max(1, total): return 'storage'
    if seats >= 8 or tables >= 3: return 'tavern'
    if re.search(r'cauldron|oven|preptable|cookingstation|MeadCauldron', names) and seats <= 4: return 'kitchen'
    if fire or re.search(r'throne', names): return 'hall'
    if seats + tables >= 2: return 'living'
    return 'other'

# ---------------------------------------------------------------- run
cands.sort(key=lambda c: -c['pop'])
for i, c in enumerate(cands):
    try:
        analyse(c)
    except RecursionError:
        pass
    if (i + 1) % 100 == 0:
        print(i + 1, '/', len(cands), 'designs read,', len(chosen), 'with interiors,', len(room_rows), 'rooms', file=sys.stderr)

def pq(vals, qs=(0.1, 0.25, 0.5, 0.75, 0.9)):
    v = sorted(x for x in vals if x is not None)
    if not v: return None
    return [round(v[min(len(v) - 1, int(len(v) * q))], 2) for q in qs]

def hist(vals):
    c = collections.Counter(round(v * 4) / 4 for v in vals if v < 2.5)
    return [[k, n] for k, n in c.most_common(4)]

def share(vals):
    v = [x for x in vals if x is not None]
    return round(sum(v) / len(v), 2) if v else None

out = {'meta': {}, 'items': {}, 'rooms': {}, 'pairs': {}, 'doors': {}, 'stand': {}}
for n, it in items.items():
    if item_n[n] < 8: continue
    rel = collections.Counter(x for x in it['rel'])
    walln = [d for d in it['wall'] if d < 0.9]
    lifts = it['lift']
    mount = sum(1 for x in lifts if x > 0.6)
    out['items'][n] = {
        'n': item_n[n], 'role': role(n),
        'againstWall': round(len(walln) / len(it['wall']), 2) if it['wall'] else 0,
        'wallDist': pq(walln, (0.25, 0.5, 0.75)),
        'rel': [[k, round(v / max(1, len(it['rel'])), 2)] for k, v in rel.most_common(3)],
        'corner': share(it['corner']),
        'mounted': round(mount / len(lifts), 2),
        'lift': pq([x for x in lifts if x > 0.6] if mount > len(lifts) / 2 else [x for x in lifts if x <= 0.6], (0.25, 0.5, 0.75)),
        'door': pq(it['door'], (0.1, 0.25, 0.5)),
        'fire': pq(it['fire'], (0.1, 0.5, 0.9)),
        'onRug': share(it['onRug']),
        'overOpening': share(it['overOpening']),
        'faceCentered': share([1 if (f and f[0] is not None and f[0] <= 0.3) else 0 for f in it['faceOff']]) if it['faceOff'] else None,
        'runCentered': share([1 if (f and f[0] is not None and f[0] <= 0.3) else 0 for f in it['runOff']]) if it['runOff'] else None,
        'furnGap': pq(it['furnGap'], (0.1, 0.25, 0.5)),
        'rooms': collections.Counter(it['room']).most_common(6),
        'sideBySide': pq(same_gap.get(n, []), (0.1, 0.25, 0.5)),
        'back': pq(it['back'], (0.1, 0.25, 0.5)), 'front': pq(it['front'], (0.1, 0.25, 0.5)),
        'left': pq(it['left'], (0.1, 0.25, 0.5)), 'right': pq(it['right'], (0.1, 0.25, 0.5)),
        'backHist': hist(it['back']), 'frontHist': hist(it['front']), 'sideHist': hist(it['left'] + it['right']),
        'underCeiling': pq(it['underCeiling'], (0.25, 0.5, 0.75)),
    }

by_kind = collections.defaultdict(list)
for r in room_rows: by_kind[r['kind']].append(r)
for k, rs in by_kind.items():
    have = collections.Counter(); tot = collections.Counter()
    for r in rs:
        for n, v in r['items'].items():
            have[n] += 1; tot[n] += v
    dens = [r['furn'] / r['area'] * 10 for r in rs]
    out['rooms'][k] = {
        'n': len(rs), 'area': pq([r['area'] for r in rs], (0.25, 0.5, 0.75)), 'ceiling': pq([r['ceiling'] for r in rs], (0.25, 0.5, 0.75)),
        'perTenM2': pq(dens, (0.25, 0.5, 0.75)), 'kinds': pq([len(r['items']) for r in rs], (0.25, 0.5, 0.75)),
        'windows': pq([r['windows'] for r in rs], (0.25, 0.5, 0.75)),
        'items': [[n, round(have[n] / len(rs), 2), round(tot[n] / have[n], 1)] for n, _ in have.most_common(45) if have[n] >= 3],
    }

for (a, b), lst in pairs.items():
    if len(lst) < 6 or item_n[a] < 8: continue
    c = collections.Counter((x, y, z, r) for x, y, z, r, _ in lst)
    top = [[x, y, z, r, k] for (x, y, z, r), k in c.most_common(5) if k >= 3]
    if not top: continue
    out['pairs'].setdefault(a, []).append([b, len(lst), round(len(lst) / item_n[a], 2), top])
for a in out['pairs']:
    out['pairs'][a].sort(key=lambda t: -t[1]); out['pairs'][a] = out['pairs'][a][:14]

out['doors'] = {'freeDepth': pq(door_free), 'byRoom': {k: pq(v, (0.1, 0.25, 0.5)) for k, v in door_free_by.items() if len(v) >= 5}}
for f, v in stand.items():
    if len(v) >= 10:
        out['stand'][f] = {'n': len(v), 'mode': collections.Counter(v).most_common(1)[0][0], 'p': pq(v, (0.25, 0.5, 0.75))}
out['meta'] = {
    'candidates': len(cands), 'designs': len(chosen), 'rooms': len(room_rows),
    'byWhy': collections.Counter(c['why'] for c in chosen), 'roomKinds': {k: len(v) for k, v in by_kind.items()},
    'top': TOP, 'popularity': '0.5 downloads + 0.3 votes + 0.2 downloads per view, each as a percentile among valheimians builds',
}
json.dump(out, open(out_path, 'w'), indent=1)
if opts.get('list'):
    with open(opts['list'], 'w', newline='') as f:
        w = csv.DictWriter(f, fieldnames=list(chosen[0].keys()))
        w.writeheader(); w.writerows(chosen)
print('candidates', len(cands), 'designs with interiors', len(chosen), 'rooms', len(room_rows))
print('rooms by kind', {k: len(v) for k, v in by_kind.items()})
