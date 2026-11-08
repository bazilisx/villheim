"""Tests for lab/mc_convert.py on small hand-made block grids (no Millenaire files needed).

Run: python3 -I lab/test_mc_convert.py [out dir for pictures]
"""
import collections, json, math, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import mc_convert as M

BM = M.load_map()


def house(wall='minecraft:oak_planks', roof='minecraft:oak_stairs'):
    """7 x 7 one-room house: plank floor, walls three high, a door and a window in the north wall (-z),
    a stair gable roof with its ridge along x, a bed, a chest and a torch inside."""
    g = {}
    for x in range(-2, 9):
        for z in range(-2, 9):
            g[(x, 0, z)] = ('minecraft:dirt', {})
    for x in range(7):
        for z in range(7):
            g[(x, 1, z)] = ('minecraft:oak_planks', {})
    for y in (2, 3, 4):
        for i in range(7):
            for p in ((i, y, 0), (i, y, 6), (0, y, i), (6, y, i)):
                g[p] = (wall, {})
    g[(3, 2, 0)] = ('minecraft:oak_door', {'facing': 'north', 'half': 'lower'})
    g[(3, 3, 0)] = ('minecraft:oak_door', {'facing': 'north', 'half': 'upper'})
    g[(1, 3, 0)] = ('minecraft:glass_pane', {})
    # gable ends
    for y, zs in ((5, range(1, 6)), (6, range(2, 5)), (7, (3,))):
        for z in zs:
            g[(0, y, z)] = (wall, {}); g[(6, y, z)] = (wall, {})
    # roof: north side rises toward +z (facing south), south side toward -z (facing north)
    for x in range(-1, 8):
        for z, y in ((-1, 4), (0, 5), (1, 6), (2, 7)):
            g[(x, y, z)] = (roof, {'facing': 'south', 'half': 'bottom', 'shape': 'straight'})
        for z, y in ((7, 4), (6, 5), (5, 6), (4, 7)):
            g[(x, y, z)] = (roof, {'facing': 'north', 'half': 'bottom', 'shape': 'straight'})
        g[(x, 8, 3)] = ('minecraft:oak_slab', {'type': 'bottom'})
    g[(1, 2, 5)] = ('minecraft:white_bed', {'facing': 'south', 'part': 'head'})
    g[(5, 2, 5)] = ('millenaire:mock_chest', {'facing': 'north'})
    g[(5, 3, 1)] = ('minecraft:wall_torch', {'facing': 'south'})
    g[(2, 2, 2)] = ('minecraft:red_carpet', {}); g[(3, 2, 2)] = ('minecraft:red_carpet', {})
    g[(2, 2, 3)] = ('minecraft:red_carpet', {}); g[(3, 2, 3)] = ('minecraft:red_carpet', {})
    return g


def run(g, culture='norman'):
    O, res = M.convert(g, BM, culture, -1)
    return O, res


def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print('ok  ', msg)


def test_plank_house():
    O, res = run(house())
    by = collections.defaultdict(list)
    for p in O.pieces:
        by[p['name']].append(p)
    st = res['stats']
    check(st.get('unmapped', 0) == 0 and not res['unmapped'], 'every block in the test house is mapped')
    # the plank between the window and the door is lost: both of its edges are open (walls sit on centre lines)
    check(st.get('left', 0) == 1 and st.get('lost_thin', 0) == 1, 'only the block between window and door is lost')
    check(len([p for p in O.pieces if p['src'] == 'ridge']) == 5, 'nine ridge slabs make five ridge caps')
    # roof: 9 cells along the ridge, 4 rows a side -> 5 x 2 pieces a side (one row of five overhangs half a metre)
    roofs = by['wood_roof_45']
    check(len(roofs) == 20, f'20 roof pieces for two 9 x 4 planes (got {len(roofs)})')
    north = [p for p in roofs if p['z'] > 0]  # Minecraft -z is Valheim +z
    south = [p for p in roofs if p['z'] < 0]
    check(len(north) == len(south) == 10, 'roof pieces split evenly between the two sides')
    # the north side rises toward Minecraft +z = Valheim -z, so local -z must point to world -z: yaw 0
    check(all(abs(p['yaw'] - 0) < 0.1 for p in north), 'north roof side has yaw 0 (rises toward the ridge)')
    check(all(abs(p['yaw'] - 180) < 0.1 for p in south), 'south roof side has yaw 180')
    # eave pieces: rows at Minecraft z -1, 0 -> centre z 0.0 (MC) -> Valheim z = cz - 0 = 3.5;
    # y: halfway up rows 4 and 5 (Minecraft 5) plus half a block to the step noses, minus surface 1 -> 4.5
    eave = sorted(north, key=lambda p: -p['z'])[0]
    check(abs(eave['z'] - 3.5) < 1e-6 and abs(eave['y'] - 4.5) < 1e-6, f'eave piece at z 3.5, y 4.5 (got {eave["z"]}, {eave["y"]})')
    # doors: one 2 m door centred on the door block, in the north wall (Valheim z = 3)
    d = by['wood_door']
    check(len(d) == 1 and abs(d[0]['x'] - 0) < 1e-6 and abs(d[0]['z'] - 3.0) < 1e-6 and abs(d[0]['y'] - 2.0) < 1e-6,
          f'one door at x 0, y 2, z 3 (got {[(p["x"], p["y"], p["z"]) for p in d]})')
    # walls: plank walls on the centre lines; the 6 m between corner centres takes three 2 m pieces where unbroken
    south_wall = [p for p in O.pieces if p['src'] == 'wall' and abs(p['z'] + 3.0) < 1e-6 and p['y'] < 3.1]
    check(sum(1 for p in south_wall if p['name'] == 'woodwall') == 3, 'south wall: three 2x2 wall pieces in the lower 2 m')
    check(all(abs(p['yaw']) < 0.1 for p in south_wall), 'walls along x have yaw 0')
    east = [p for p in O.pieces if p['src'] == 'wall' and abs(p['x'] - 3.0) < 1e-6]
    check(east and all(abs(p['yaw'] - 90) < 0.1 for p in east), 'walls along z have yaw 90')
    # floor: 7 x 7 -> nine 2x2 and thirteen 1x1
    check(len(by['wood_floor']) == 9 and len(by['wood_floor_1x1']) == 13, 'floor 7 x 7 is nine 2x2 and thirteen 1x1')
    check(all(abs(p['y'] - (1 - 0.125)) < 1e-6 for p in by['wood_floor']), 'floor top at the top of the floor blocks (y 1)')
    check(len(by['piece_bed02']) == 1 and len(by['piece_chest_wood']) == 1 and len(by['jute_carpet']) == 1,
          'bed, chest and one rug for a 2 x 2 carpet')
    bed = by['piece_bed02'][0]
    # head at Minecraft z 5 facing south, so its centre is half a block north: z 5.0 -> Valheim 3.5 - 5.0 = -1.5
    check(abs(bed['z'] + 1.5) < 1e-6, f'bed centred between head and foot (z {bed["z"]})')
    rooms = res['rooms']
    check(rooms and rooms[0]['use'] == 'bedroom' and rooms[0]['indoor'], 'the room reads as an indoor bedroom')
    return O, res


def test_stone_house():
    O, res = run(house(wall='minecraft:cobblestone'))
    names = collections.Counter(p['name'] for p in O.pieces)
    check(names['stone_wall_4x2'] + names['stone_wall_2x1'] + names['stone_wall_1x1'] > 0, 'stone walls use the stone family')
    vol = names['stone_wall_4x2'] * 8 + names['stone_wall_2x1'] * 2 + names['stone_wall_1x1']
    stone_blocks = sum(1 for k, v in house(wall='minecraft:cobblestone').items() if v[0] == 'minecraft:cobblestone')
    check(vol == stone_blocks, f'stone pieces cover every stone block exactly once ({vol} m3 for {stone_blocks} blocks)')
    return O, res


def test_slab_roof():
    g = {}
    for x in range(6):
        for z in range(4):
            g[(x, 0, z)] = ('minecraft:stone_bricks', {})
    # slabs stepping up toward +x: bottom, top, bottom, top ... rise 0.5 per block
    for z in range(4):
        for i, x in enumerate(range(6)):
            y = 3 + i // 2
            g[(x, y, z)] = ('minecraft:oak_slab', {'type': 'bottom' if i % 2 == 0 else 'top'})
    O, res = M.convert(g, BM, 'norman', 0)
    r26 = [p for p in O.pieces if p['name'] == 'wood_roof']
    check(len(r26) == 6, f'6 x 4 slab steps make six 26 degree pieces (got {len(r26)})')
    check(all(abs(p['yaw'] - 270) < 0.1 for p in r26), 'rising toward +x gives yaw 270')
    return O, res


def test_coords():
    # Minecraft east (+x) stays +x; Minecraft south (+z) becomes Valheim -z
    check(M.vh_dir('south') == (0, -1) and M.vh_dir('east') == (1, 0), 'Minecraft south maps to Valheim -z')
    check(abs(M.yaw_of(0, 1)) < 1e-9 and abs(M.yaw_of(1, 0) - 90) < 1e-9, 'yaw 0 points +z, yaw 90 points +x')


if __name__ == '__main__':
    test_coords()
    O, res = test_plank_house()
    O2, _ = test_stone_house()
    O3, _ = test_slab_roof()
    if len(sys.argv) > 1:
        out = sys.argv[1]
        os.makedirs(out, exist_ok=True)
        for nm, o, g in (('plank', O, house()), ('stone', O2, house(wall='minecraft:cobblestone'))):
            M.write_blueprint(os.path.join(out, f'test_{nm}.blueprint'), o, f'test {nm}', 'test house')
            cls = M.classify_all(g, BM)
            json.dump(M.voxels(g, BM, cls, o.cx, o.cz, o.sy), open(os.path.join(out, f'test_{nm}.voxels.json'), 'w'))
    print('all tests passed')
