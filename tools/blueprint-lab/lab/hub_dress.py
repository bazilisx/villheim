# Rug overlap (all builds with two rugs or more) and wall dressing (halls and round buildings of 300 m2 and more) in the
# corpus (Villheim-blueprints, on Tyler's PC; read only): python3 lab/hub_dress.py <corpus dir> writes dress.json.
# Summaries in docs/handoffs/2026-11-10-design/hub-gen.md, round 5.
import os, sys, math, json, re, collections
ROOT = sys.argv[1]
RUGS = {'rug_deer': (3.11, 3.11), 'rug_wolf': (2.55, 3.46), 'jute_carpet': (3.99, 3), 'rug_fur': (3.06, 3.97), 'rug_straw': (2.12, 2.6),
        'rug_hare': (2, 2.5), 'jute_carpet_blue': (3, 3), 'rug_asksvin': (3, 3), 'rug_bogwitch_deer': (3.11, 3.11), 'rug_moose': (3.11, 3.11), 'rug_seal': (3.11, 3.11), 'rug_Bjorn': (3.11, 3.11)}
ME = re.compile(r'(ottoman|turk|persia|arab|desert|oasis|caravan|bazaar|morocc|sultan|mosque|harem|egypt|sahara|agrabah|souk|riad|middle.?east)', re.I)
FLOOR = re.compile(r'floor', re.I); WALL = re.compile(r'(wall|window)', re.I)
HALLW = re.compile(r'(hall|longhouse|long house|longhus|mead|throne|jarl|chief|feast|langhus)', re.I)
EXC = re.compile(r'^(arena|artistic|advanced-base|castle|portal-hub|tree-house|storage|statue|bridge|farming|interior-design|_tests|_errors|village|starter-home)/')
KIND = [('seat', r'(bench|chair|throne|stool|logbench)'), ('storage', r'(chest|crate|barrel)'), ('stand', r'(itemstand|armorstand|trophy|_stand)'),
        ('banner', r'(banner|cloth_hanging|hanging|tapestr)'), ('table', r'table'), ('light', r'(torch|lantern|brazier|candle|sconce)'),
        ('craft', r'(workbench|forge|cauldron|fermenter|anvil|oven|smelter|kiln|spinning|loom|stonecutter|artisan|preptable|butcher|cooking|grill|windmill|press)'),
        ('bed', r'bed'), ('shelf', r'(shelf|rack|dvergrprops)'), ('sign', r'sign')]
KIND = [(k, re.compile(p, re.I)) for k, p in KIND]
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
def inrug(r, x, z):
    w, l = RUGS[r[0]]; a = math.radians(r[4]); dx, dz = x - r[1], z - r[3]
    u = dx * math.cos(a) - dz * math.sin(a); v = dx * math.sin(a) + dz * math.cos(a)
    return abs(u) <= w / 2 and abs(v) <= l / 2
rugrows = []; dress = []
for d, _, files in os.walk(ROOT):
    for fn in files:
        if not fn.endswith('.blueprint'): continue
        path = os.path.join(d, fn); rel = os.path.relpath(path, ROOT)
        try: name, ps = parse(path)
        except Exception: continue
        me = bool(ME.search(rel + ' ' + name)) or 'ottoman-turkish-house' in rel
        # rugs: the share of each rug's area (8 x 8 samples) lying on other rugs at the same height
        rugs = [p for p in ps if p[0] in RUGS]
        if len(rugs) >= 2:
            for i, r in enumerate(rugs):
                w, l = RUGS[r[0]]; a = math.radians(r[4]); tot = hit = 0
                for iu in range(8):
                    for iv in range(8):
                        u = -w / 2 + w * (iu + 0.5) / 8; v = -l / 2 + l * (iv + 0.5) / 8
                        x = r[1] + u * math.cos(a) + v * math.sin(a); z = r[3] - u * math.sin(a) + v * math.cos(a)
                        tot += 1
                        if any(abs(o[2] - r[2]) < 0.3 and abs(o[1] - x) < 3 and abs(o[3] - z) < 3 and inrug(o, x, z) for j, o in enumerate(rugs) if j != i): hit += 1
                rugrows.append((rel, me, hit / tot))
        # wall dressing: the 300 m2 set of lab/hub_posts.py
        if len(ps) < 150 or EXC.search(rel): continue
        wa = [p for p in ps if WALL.search(p[0]) and 'roof' not in p[0].lower()]
        if not wa: continue
        hist = collections.Counter(round(p[4] % 90) % 90 for p in wa); dd = hist.most_common(1)[0][0]
        a = math.radians(dd); ca, sa = math.cos(a), math.sin(a)
        ps = [(p[0], p[1] * ca - p[3] * sa, p[2], p[1] * sa + p[3] * ca, p[4] - dd) for p in ps]
        fl = [p for p in ps if FLOOR.search(p[0]) and 'roof' not in p[0].lower()]
        if not fl: continue
        ys = sorted(p[2] for p in fl); g0 = ys[int(len(ys) * 0.05)]
        gf = [p for p in fl if abs(p[2] - g0) < 0.6]
        area = sum(1 if '1x1' in p[0] else 4 for p in gf)
        if area < 300: continue
        xs = [p[1] for p in gf]; zs = [p[3] for p in gf]
        if max(max(xs) - min(xs), max(zs) - min(zs)) > 73: continue
        if max(p[2] for p in ps) - g0 < 6: continue
        walls = [p for p in ps if WALL.search(p[0]) and 'roof' not in p[0].lower() and g0 + 0.2 < p[2] < g0 + 2.6]
        if len(walls) < 20: continue
        off = sum(1 for p in walls if 8 < (p[4] % 90 + 90) % 90 < 82) / len(walls)
        if not (off >= 0.3 or HALLW.search(rel + ' ' + name)): continue
        cells = set()
        for p in gf:
            s = 1 if '1x1' in p[0] else 2
            for i in range(s):
                for j in range(s): cells.add((math.floor(p[1] - s / 2 + i + 0.5), math.floor(p[3] - s / 2 + j + 0.5)))
        decor = []
        for p in ps:
            k = next((k for k, rx in KIND if rx.search(p[0])), None)
            if k and g0 - 0.3 < p[2] < g0 + 3.5: decor.append((k, p[1], p[3]))
        n = dressed = 0; kinds = collections.Counter()
        seen = set()
        for w in walls:
            key = (round(w[1] * 2), round(w[3] * 2), round(w[4]) % 180)
            if key in seen: continue
            seen.add(key)
            a = math.radians(w[4]); tx, tz, nx, nz = math.cos(a), -math.sin(a), math.sin(a), math.cos(a)
            inside = [sg for sg in (-1, 1) if (math.floor(w[1] + nx * sg * 1.2 + 0.5), math.floor(w[3] + nz * sg * 1.2 + 0.5)) in cells]
            if not inside: continue
            n += 1
            ks = set()
            for k, x, z in decor:
                dx, dz = x - w[1], z - w[3]; u = dx * tx + dz * tz; v = dx * nx + dz * nz
                if abs(u) <= 1.1 and any(0 < v * sg <= 1.3 for sg in inside): ks.add(k)
            if ks: dressed += 1; kinds.update(ks)
        if n >= 10: dress.append(dict(f=rel, area=area, round=off >= 0.3, n=n, share=dressed / n, kinds={k: v / n for k, v in kinds.items()}))
json.dump({'rugs': rugrows, 'dress': dress}, open('dress.json', 'w'))
print(len(rugrows), len(dress))
