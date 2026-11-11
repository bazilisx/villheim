# Inner posts in large halls and round or polygon buildings of the corpus (Villheim-blueprints). Read only.
import os, sys, math, json, re, statistics as st
ROOT = sys.argv[1]
POLE = re.compile(r'(pole|pillar|column|_log_|wood_log)', re.I)
FLOOR = re.compile(r'floor', re.I)
WALL = re.compile(r'(wall|window|door|gate)', re.I)
HALLW = re.compile(r'(hall|longhouse|long house|mead|throne|temple|tavern|great|round|church|chapel|keep|lodge|inn|feast|jarl|king|chief|meeting)', re.I)
def yaw(q):
    x, y, z, w = q
    return math.degrees(math.atan2(2 * (w * y + x * z), 1 - 2 * (y * y + x * x)))
def parse(path):
    ps = []; mode = None; name = ''
    with open(path, encoding='utf-8', errors='ignore') as f:
        for raw in f:
            line = raw.strip()
            if not line: continue
            if line[0] == '#':
                k = line[1:].split(':')[0]
                if k == 'Name': name = line.split(':', 1)[1] if ':' in line else ''
                mode = k; continue
            if mode != 'Pieces': continue
            p = line.split(';')
            if len(p) < 9: continue
            try: n = [float(v) for v in p[2:9]]
            except ValueError: continue
            ps.append((p[0], n[0], n[1], n[2], yaw(n[3:7])))
    return name, ps
def fsize(n):
    if '1x1' in n: return 1.0
    if 'floor' in n and ('2x2' in n or n in ('wood_floor', 'darkwood_floor', 'ashwood_floor_2x2', 'blackmarble_floor', 'stone_floor')): return 4.0
    if 'floor' in n: return 4.0
    return 0
out = []
for d, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith('.blueprint'): continue
        path = os.path.join(d, fn)
        try: name, ps = parse(path)
        except Exception: continue
        if len(ps) < 150: continue
        fl = [p for p in ps if FLOOR.search(p[0]) and 'roof' not in p[0].lower()]
        if not fl: continue
        ys = sorted(p[2] for p in fl)
        g0 = ys[int(len(ys) * 0.05)]
        gf = [p for p in fl if abs(p[2] - g0) < 0.6]
        area = sum(fsize(p[0]) for p in gf)
        if area < 300: continue
        xs = [p[1] for p in gf]; zs = [p[3] for p in gf]
        bw, bl = max(xs) - min(xs) + 2, max(zs) - min(zs) + 2
        if max(bw, bl) > 75: continue
        top = max(p[2] for p in ps)
        if top - g0 < 6: continue
        walls = [p for p in ps if WALL.search(p[0]) and 'roof' not in p[0].lower() and abs(p[2] - g0 - 1) < 2.5]
        if len(walls) < 20: continue
        off = sum(1 for p in walls if 8 < (p[4] % 90 + 90) % 90 < 82) / len(walls)
        rel = os.path.relpath(path, ROOT)
        roundp = off > 0.2
        hall = bool(HALLW.search(rel + ' ' + name))
        if not (roundp or hall): continue
        # floor cells of the ground band, 1 m grid
        cells = set()
        for p in gf:
            s = 1 if '1x1' in p[0] else 2
            for i in range(s):
                for j in range(s):
                    cells.add((math.floor(p[1] - s / 2 + i + 0.5), math.floor(p[3] - s / 2 + j + 0.5)))
        cx = st.mean(xs); cz = st.mean(zs)
        # wall points (both ends and middle of each wall piece, 2 m along its yaw)
        wp = []
        for w in walls:
            a = math.radians(w[4]); ux, uz = math.cos(a), -math.sin(a)
            for t in (-1, -0.5, 0, 0.5, 1): wp.append((w[1] + ux * t, w[3] + uz * t))
        # free-standing inner posts: a pole whose foot is within 1.5 m over the ground floor, over a floor cell, 0.7 m
        # or more from every wall point; stacked pieces at one spot count once
        posts = {}
        for p in ps:
            if not POLE.search(p[0]) or 'beam' in p[0] or 'fence' in p[0]: continue
            if not (g0 - 0.6 < p[2] < g0 + 2.6): continue
            if (math.floor(p[1] + 0.5), math.floor(p[3] + 0.5)) not in cells: continue
            if any(abs(p[1] - x) < 0.7 and abs(p[3] - z) < 0.7 for x, z in wp): continue
            posts[(round(p[1] * 2) / 2, round(p[3] * 2) / 2)] = 1
        pts = list(posts)
        rec = dict(f=rel, name=name.strip()[:60], area=round(area), bb=f'{min(bw,bl):.0f}x{max(bw,bl):.0f}', h=round(top - g0, 1), round=roundp, n=len(pts),
                   per100=round(100 * len(pts) / area, 1))
        if pts:
            rs = [math.hypot(x - cx, z - cz) for x, z in pts]
            rec['clearR'] = round(min(rs), 1)
            nn = [min(math.hypot(x - a, z - b) for a, b in pts if (a, b) != (x, z)) for x, z in pts] if len(pts) > 1 else [0]
            rec['nn'] = round(st.median(nn), 1)
            # layout: ring (radii within 15 % and angles round), two rows (along the long axis, |v| alike), else other
            cvr = st.pstdev(rs) / max(0.1, st.mean(rs))
            angs = sorted(math.degrees(math.atan2(x - cx, z - cz)) % 360 for x, z in pts)
            gap = max([(angs[(i + 1) % len(angs)] - angs[i]) % 360 for i in range(len(angs))]) if len(angs) > 1 else 360
            longx = bw >= bl
            vs = [(z - cz) if longx else (x - cx) for x, z in pts]
            av = [abs(v) for v in vs]
            cvv = st.pstdev(av) / max(0.1, st.mean(av))
            if len(pts) >= 5 and cvr < 0.15 and gap < 100: lay = 'ring'
            elif len(pts) >= 4 and cvv < 0.2 and min(vs) < 0 < max(vs): lay = 'two rows'
            elif len(pts) >= 6 and cvr < 0.3 and gap < 100: lay = 'rings'
            else: lay = 'other'
            rec['layout'] = lay
            rec['rowGap'] = round(2 * st.mean(av), 1) if lay == 'two rows' else None
            rec['ringD'] = round(2 * st.mean(rs), 1) if lay in ('ring', 'rings') else None
        else:
            rec['layout'] = 'none'
        out.append(rec)
json.dump(out, sys.stdout)
