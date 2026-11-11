# Writes data/landscape/road-kit.json: the road and junction greenery sets (D-143). python3 -I lab/make_road_kit.py
import json, random, math
random.seed(144)
def q(lo, mid, hi):
    z = max(-1.5, min(1.5, random.gauss(0, 1)))
    return mid * (lo/mid) ** (-z/0.6745) if z < 0 else mid * (hi/mid) ** (z/0.6745)
sets = []
road = lambda xs, z=0, yaw=0: [[x, z, yaw] for x in xs]
# 1, 2: verge runs along one road edge (road along x, its edge at z = 1)
for sid, label, L in [('verge-a', 'road edge run, bushes and flowers', 18), ('verge-b', 'road edge run, flowers with a tree', 20)]:
    slots, x = [], -L/2 + random.uniform(0, 1.5)
    while x < L/2:
        # a short run of 1 to 4 plants at the corpus path-edge spacing, then a gap
        k = random.choices(['bush', 'flower'], [107, 43])[0]
        for i in range(random.choice([1, 2, 3, 3, 4, 4])):
            if x >= L/2: break
            slots.append({'k': k, 'x': round(x, 2), 'z': round(1 + (random.uniform(1.0, 1.6) if k == 'bush' else random.uniform(0.5, 1.6)), 2), 'stage': 's2' if random.random() < 0.5 else 's3'})
            x += max(0.6, q(0.73, 1.72, 3.82) if k == 'bush' else q(0.93, 1.35, 2.68))  # never on the last one
            if random.random() < 0.3: k = 'flower' if k == 'bush' else 'bush'
        x += random.uniform(1.5, 3.5)
    if sid == 'verge-b':
        slots.append({'k': 'tree', 'x': round(L/2 - 3.9, 2), 'z': 2.4, 'stage': 's3'})
        slots.append({'k': 'tree', 'x': round(-L/2 + 1.2, 2), 'z': 2.6, 'stage': 's3'})
    sets.append({'id': sid, 'label': label, 'place': 'verge', 'road': road(range(-int(L/2), int(L/2)+1, 2)), 'keep': [{'x0': -L/2, 'x1': L/2, 'z0': -1, 'z1': 1.3, 'why': 'the road and 0.3 m off its edge'}], 'slots': slots})
# 3: T junction, the outside corner: a bush cluster with flowers at its foot (s2), a tree (s3); 1.5 m back from both edges
def cluster(cx, cz, n, stage, spread=(0.77, 1.14, 2.23)):
    out, a = [], random.uniform(0, 6.28)
    for i in range(n):
        r = 0 if i == 0 else q(*spread)
        a += random.uniform(1.2, 2.6)
        zz = cz + r*math.sin(a)
        zz = max(zz, 2.6) if cz > 0 else min(zz, -2.6)
        out.append({'k': 'bush', 'x': round(cx + r*math.cos(a), 2), 'z': round(zz, 2), 'stage': stage})
    return out
t = cluster(-4.4, 4.2, 3, 's2') + [{'k': 'flower', 'x': -2.6, 'z': 2.7, 'stage': 's2'}, {'k': 'flower', 'x': -3.5, 'z': 3.4, 'stage': 's2'}, {'k': 'flower', 'x': -4.4, 'z': 2.6, 'stage': 's2'}, {'k': 'tree', 'x': -5.1, 'z': 5.0, 'stage': 's3'}]
sets.append({'id': 'junction-t', 'label': 'T junction island on the outside corner', 'place': 'junction',
    'road': road(range(-8, 9, 2)) + [[0, z, 0] for z in range(-2, -9, -2)],
    'keep': [{'x0': -9, 'x1': 9, 'z0': -1, 'z1': 2.5, 'why': 'the through road and 1.5 m back'}, {'x0': -2.5, 'x1': 2.5, 'z0': -9, 'z1': 1, 'why': 'the side road and 1.5 m back'}, {'x0': -2.5, 'x1': 2.5, 'z0': -1, 'z1': 3, 'why': 'sight line across the mouth of the side road'}],
    'slots': t})
# 4: crossroads: two of the four outside corners
x = cluster(4.2, 4.0, 2, 's2') + [{'k': 'flower', 'x': 2.7, 'z': 2.8, 'stage': 's2'}, {'k': 'tree', 'x': -4.6, 'z': -4.4, 'stage': 's3'}, {'k': 'bush', 'x': -3.3, 'z': -3.0, 'stage': 's3'}, {'k': 'flower', 'x': -2.6, 'z': -3.9, 'stage': 's3'}]
sets.append({'id': 'junction-x', 'label': 'crossroads, planting on two outside corners', 'place': 'junction',
    'road': road(range(-8, 9, 2)) + [[0, z, 0] for z in list(range(-8, -1, 2)) + list(range(2, 9, 2))],
    'keep': [{'x0': -9, 'x1': 9, 'z0': -2.5, 'z1': 2.5, 'why': 'the road and 1.5 m back'}, {'x0': -2.5, 'x1': 2.5, 'z0': -9, 'z1': 9, 'why': 'the cross road and 1.5 m back'}], 'slots': x})
# 5: a well: flowers round its foot, bushes behind, the front 1.5 m kept clear to draw water
w = [{'k': 'flower', 'x': round(1.6*math.cos(a), 2), 'z': round(1.6*math.sin(a), 2), 'stage': 's2'} for a in [0.5, 1.4, 2.2, 3.4]] + cluster(0.3, 3.0, 2, 's3')
sets.append({'id': 'well', 'label': 'planting round a well', 'place': 'well', 'road': [], 'anchor': {'x': 0, 'z': 0, 'r': 1.1, 'front': [0, -1]},
    'keep': [{'x0': -1.2, 'x1': 1.2, 'z0': -3, 'z1': -1, 'why': 'in front of the well'}], 'slots': w})
# 6: a notice board: flowers at its feet either side, a bush behind, 1.5 m in front kept clear to read it
nb = [{'k': 'flower', 'x': -1.5, 'z': 0.3, 'stage': 's2'}, {'k': 'flower', 'x': 1.6, 'z': 0.2, 'stage': 's2'}, {'k': 'flower', 'x': 2.4, 'z': 0.6, 'stage': 's3'}, {'k': 'bush', 'x': -0.6, 'z': 1.9, 'stage': 's3'}]
sets.append({'id': 'notice-board', 'label': 'planting by a notice board', 'place': 'notice', 'road': [], 'anchor': {'x': 0, 'z': 0, 'r': 1.0, 'front': [0, -1]},
    'keep': [{'x0': -1.2, 'x1': 1.2, 'z0': -1.6, 'z1': 0.4, 'why': 'in front of the board'}], 'slots': nb})
# every slot out of its set's kept boxes, by the plant's spread on the ground (bushes and trees 0.6 m, flowers 0.2 m)
for st in sets:
    for sl in st['slots']:
        r = 0.2 if sl['k'] == 'flower' else 0.6
        for _ in range(4):
            for b in st['keep']:
                if sl['x'] + r > b['x0'] and sl['x'] - r < b['x1'] and sl['z'] + r > b['z0'] and sl['z'] - r < b['z1']:
                    moves = [(b['x0'] - r - 0.05 - sl['x'], 0), (b['x1'] + r + 0.05 - sl['x'], 0), (0, b['z0'] - r - 0.05 - sl['z']), (0, b['z1'] + r + 0.05 - sl['z'])]
                    dx, dz = min(moves, key=lambda m: abs(m[0]) + abs(m[1]))
                    sl['x'] = round(sl['x'] + dx, 2); sl['z'] = round(sl['z'] + dz, 2)
for s in sets: s['render_biomes'] = ['Meadows', 'Black Forest', 'Plains', 'Ashlands']
doc = {
 'about': 'Small greenery sets for the village layout to place along roads, at junctions and round a well or a notice board (D-143). Road greenery belongs to no building: owner shared. Data only; the lab has no roads. Each set lies in its own frame in metres: a road runs along x with its middle at z = 0 and its edges at z = -1 and 1 (the yards path is 2 m wide); a junction road runs along z. A slot is a class (bush, flower, tree), a place and the stage it goes in at; lib/landscape.js kitPieces picks the prefab for the village biome (gathered nearby, or a stand-in, D-145), the scale (corpus) and the marks. keep: boxes no plant may stand in (the road, sight lines, the front of a well or a board). The layout may mirror and turn a set.',
 'version': '2026-11-11',
 'source': 'Verge distances and spacing from data/landscape/corpus-greenery.json path edge: off the edge 0.3 to 1.6 m (place definition), bushes 0.73/1.72/3.82 m, flowers 0.93/1.35/2.68 m, trees 3.9 m (p25/median/p75); bush clusters from the yard spacing 0.77/1.14/2.23 m. Junction set-back 1.5 m, the well and notice board sets and the stages are proposals (placement-plan.json junctions; the corpus has no roads or junctions to measure). Slot positions were drawn once from those distributions (seed 144) and kept.',
 'road_half_width': 1,
 'sets': sets,
}
import os
json.dump(doc, open(os.path.join(os.path.dirname(os.path.abspath(__file__)), '../data/landscape/road-kit.json'), 'w'), indent=1)
print([ (s['id'], len(s['slots'])) for s in sets])
