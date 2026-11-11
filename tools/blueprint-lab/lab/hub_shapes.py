# Plan shapes of big halls and round buildings in the corpus (Villheim-blueprints, on Tyler's PC; read only), the 300 m2
# set of lab/hub_roofs.py: python3 lab/hub_shapes.py <corpus dir> (writes shapes.json, prints the spreads that
# lib/hub.js SHAPE_Q holds). Per build, turned back by its commonest wall turn as hub_posts.py does:
#   area     ground floor in m2 (floor pieces within 0.6 m of the lowest floor level)
#   sides    round and polygon builds: wall directions of the ground storey (2.5 degree bins holding 3 % of its walls or
#            more), twice that many sides
#   dia      round and polygon builds: twice the median distance of the ground storey's walls from the floor's middle
#   occ      halls: floor cells over the cells of their box (under 0.8: a branched plan, L, T, U or cross)
#   aspect   halls: long side over short side of the box
#   arm      branched halls: the commonest width of a run of floor across the plan (both ways), over the long side
#   inner    inner wall lines of the ground storey (2 or more wall pieces, 1.5 m or more inside the floor's edge): halls,
#            lines across the long axis as the share of the length from the nearer end; round builds, distance from
#            the middle over the radius
#   porch    poles and columns standing on the ground outside the floor, within 8 m of it (distinct spots)
#   annex    floor outside the main body: halls without branching, rows narrower than 0.7 of the widest row; round
#            builds, cells farther than 1.15 times the wall radius; as a share of the floor, and lobes of 6 m2 or more
import os, sys, math, json, re, collections, statistics as st
ROOT = sys.argv[1]
FLOOR = re.compile(r'floor', re.I); WALL = re.compile(r'(wall|window)', re.I); ROOF = re.compile(r'roof', re.I)
POLE = re.compile(r'(pole|pillar|column|_log_|wood_log)', re.I)
HALLW = re.compile(r'(hall|longhouse|long house|longhus|mead|throne|jarl|chief|feast|langhus)', re.I)
EXC = re.compile(r'^(arena|artistic|advanced-base|castle|portal-hub|tree-house|storage|statue|bridge|farming|interior-design|_tests|_errors|village|starter-home)/')
def yaw(q):
    x, y, z, w = q
    return math.degrees(math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)))
def parse(path):
    ps = []; mode = None
    with open(path, encoding='utf-8', errors='ignore') as f:
        for raw in f:
            line = raw.strip()
            if not line: continue
            if line[0] == '#': mode = line[1:].split(':')[0]; continue
            if mode != 'Pieces': continue
            p = line.split(';')
            if len(p) < 9: continue
            try: n = [float(v) for v in p[2:9]]
            except ValueError: continue
            ps.append((p[0], n[0], n[1], n[2], yaw(n[3:7])))
    return ps
def lines(vals, tol=1.0):
    vals = sorted(vals); out = []; cur = []
    for v in vals:
        if cur and v - cur[-1] > tol:
            if len(cur) >= 2: out.append(st.median(cur))
            cur = []
        cur.append(v)
    if len(cur) >= 2: out.append(st.median(cur))
    return out
def lobes(cells):
    left = set(cells); n = 0
    while left:
        stack = [left.pop()]; k = 1
        while stack:
            i, j = stack.pop()
            for c in ((i + 1, j), (i - 1, j), (i, j + 1), (i, j - 1)):
                if c in left: left.remove(c); stack.append(c); k += 1
        if k >= 6: n += 1
    return n
out = []
for d, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith('.blueprint'): continue
        path = os.path.join(d, fn); rel = os.path.relpath(path, ROOT)
        if EXC.search(rel): continue
        try: ps = parse(path)
        except Exception: continue
        if len(ps) < 150: continue
        wa = [p for p in ps if WALL.search(p[0]) and 'roof' not in p[0].lower()]
        if not wa: continue
        dd = collections.Counter(round(p[4] % 90) % 90 for p in wa).most_common(1)[0][0]
        a = math.radians(dd); ca, sa = math.cos(a), math.sin(a)
        ps = [(p[0], p[1] * ca - p[3] * sa, p[2], p[1] * sa + p[3] * ca, p[4] - dd) for p in ps]
        fl = [p for p in ps if FLOOR.search(p[0]) and not ROOF.search(p[0])]
        if not fl: continue
        ys = sorted(p[2] for p in fl); g0 = ys[int(len(ys) * 0.05)]
        gf = [p for p in fl if abs(p[2] - g0) < 0.6]
        area = sum(1 if '1x1' in p[0] else 4 for p in gf)
        if area < 300: continue
        xs = [p[1] for p in gf]; zs = [p[3] for p in gf]
        w, l = sorted([max(xs) - min(xs) + 2, max(zs) - min(zs) + 2])
        if l > 73: continue
        walls = [p for p in ps if WALL.search(p[0]) and 'roof' not in p[0].lower() and g0 + 0.2 < p[2] < g0 + 2.6]
        if len(walls) < 20: continue
        off = sum(1 for p in walls if 8 < (p[4] % 90 + 90) % 90 < 82) / len(walls)
        if not (off >= 0.3 or HALLW.search(rel)): continue
        rf = [p for p in ps if ROOF.search(p[0]) and 'wall' not in p[0].lower()]
        if len(rf) < 20 or max(p[2] for p in rf) - g0 > 60: continue
        rnd = off >= 0.3
        # floor cells of 1 m
        cells = set()
        for p in gf:
            h = 0 if '1x1' in p[0] else 1
            for i in range(-h, h + 1 if h else 1):
                for j in range(-h, h + 1 if h else 1):
                    if h and (i == h or j == h): continue
                    cells.add((math.floor(p[1] + (i + 0.5 if h else 0)), math.floor(p[3] + (j + 0.5 if h else 0))))
        cx = st.mean(c[0] + 0.5 for c in cells); cz = st.mean(c[1] + 0.5 for c in cells)
        inside = lambda x, z, m: all((math.floor(x + dx), math.floor(z + dz)) in cells for dx, dz in ((m, 0), (-m, 0), (0, m), (0, -m), (m, m), (-m, -m), (m, -m), (-m, m)))
        r = dict(f=rel, round=rnd, area=area, w=round(w, 1), l=round(l, 1))
        inner = [p for p in walls if inside(p[1], p[3], 1.5)]
        if rnd:
            hist = collections.Counter(round(((p[4] % 180) + 180) % 180 / 2.5) % 72 for p in walls)
            r['sides'] = 2 * sum(1 for v in hist.values() if v >= 0.03 * len(walls))
            rad = st.median(math.hypot(p[1] - cx, p[3] - cz) for p in walls if not inside(p[1], p[3], 1.5))
            r['dia'] = round(2 * rad, 1)
            r['inner'] = [round(v / rad, 2) for v in lines([math.hypot(p[1] - cx, p[3] - cz) for p in inner], 1.0)]
            outc = [c for c in cells if math.hypot(c[0] + 0.5 - cx, c[1] + 0.5 - cz) > 1.15 * rad]
            r['annex'] = round(len(outc) / len(cells), 3); r['lobes'] = lobes(outc)
        else:
            x0 = min(c[0] for c in cells); x1 = max(c[0] for c in cells); z0 = min(c[1] for c in cells); z1 = max(c[1] for c in cells)
            r['occ'] = round(len(cells) / ((x1 - x0 + 1) * (z1 - z0 + 1)), 2)
            r['aspect'] = round(l / w, 2)
            longx = (x1 - x0) >= (z1 - z0)
            L = (x1 - x0 + 1) if longx else (z1 - z0 + 1)
            if r['occ'] < 0.8:
                runs = collections.Counter()
                for axis in (0, 1):
                    by = collections.defaultdict(list)
                    for c in cells: by[c[axis]].append(c[1 - axis])
                    for v in by.values():
                        v.sort(); n = 1
                        for a0, a1 in zip(v, v[1:]):
                            if a1 == a0 + 1: n += 1
                            else: runs[n] += 1; n = 1
                        runs[n] += 1
                arm = max((k for k in runs if 4 <= k < L - 2), key=lambda k: runs[k], default=None)
                if arm: r['arm'] = round(arm / L, 2)
            lo = x0 if longx else z0
            pos = [(p[1] if longx else p[3]) for p in inner if abs(((p[4] - (90 if longx else 0)) % 180 + 180) % 180 - 90) > 45]
            r['inner'] = [round(min(v - lo, lo + L - v) / L, 2) for v in lines(pos, 1.0)]
            if r['occ'] >= 0.8:
                by = collections.defaultdict(int)
                for c in cells: by[c[0] if longx else c[1]] += 1
                mx = max(by.values()); thin = {k for k, v in by.items() if v < 0.7 * mx}
                outc = [c for c in cells if (c[0] if longx else c[1]) in thin]
                r['annex'] = round(len(outc) / len(cells), 3); r['lobes'] = lobes(outc)
        spots = set()
        for p in ps:
            if not POLE.search(p[0]) or not (g0 - 0.6 < p[2] < g0 + 1.6): continue
            if (math.floor(p[1]), math.floor(p[3])) in cells or any((math.floor(p[1] + dx), math.floor(p[3] + dz)) in cells for dx, dz in ((0.6, 0), (-0.6, 0), (0, 0.6), (0, -0.6))): continue
            if not any(abs(c[0] + 0.5 - p[1]) < 8 and abs(c[1] + 0.5 - p[3]) < 8 for c in cells): continue
            spots.add((round(p[1] * 2) / 2, round(p[3] * 2) / 2))
        r['porch'] = len(spots)
        out.append(r)
json.dump(out, open('shapes.json', 'w'))
def q(v): v = sorted(v); return [v[int(f * (len(v) - 1))] for f in (0.1, 0.25, 0.5, 0.75, 0.9)] if v else []
for lab, rows in [('round', [r for r in out if r['round']]), ('halls', [r for r in out if not r['round']])]:
    print(f"{lab}: {len(rows)} builds; area q10..q90 {q([r['area'] for r in rows])}; porch posts {q([r['porch'] for r in rows])}; porch 0-1 / 2-5 / 6+: {sum(r['porch'] <= 1 for r in rows)} / {sum(2 <= r['porch'] <= 5 for r in rows)} / {sum(r['porch'] >= 6 for r in rows)}")
    inn = [v for r in rows for v in r['inner']]
    print(f"  inner wall lines: {sum(1 for r in rows if r['inner'])} builds with any; per build {q([len(r['inner']) for r in rows])}; place {q(inn)}")
    an = [r for r in rows if 'annex' in r]
    print(f"  annex share {q([r['annex'] for r in an])}; builds with a lobe {sum(1 for r in an if r['lobes'])} of {len(an)}; lobes {collections.Counter(r['lobes'] for r in an)}")
    if lab == 'round':
        print(f"  sides {collections.Counter(r['sides'] for r in rows).most_common()}; dia {q([r['dia'] for r in rows])}")
    else:
        print(f"  aspect {q([r['aspect'] for r in rows])}; branched {sum(1 for r in rows if r['occ'] < 0.8)}; occ {q([r['occ'] for r in rows])}; arm/long {q([r['arm'] for r in rows if 'arm' in r])}")
