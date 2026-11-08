"""Turn Millenaire building schematics (vanilla Minecraft structure .nbt) into PlanBuild .blueprint files.

Study use only. Millenaire is All Rights Reserved: converted designs go under /home/claude/corpus/mc/ or /tmp, never
into the repo, never into a folder Villheim reads, and are only used to learn rules. See docs/MC_TRANSLATION.md.

Usage:
  python3 -I lab/mc_convert.py <millenaire cultures dir> <out dir> [--culture C] [--levels top|all] [--only ID] [--squash 1]
  python3 -I lab/mc_convert.py --one <plan.json> <variant> <level> <out dir>

Per design it writes <out>/<culture>/<id>_<variant>_<level>.blueprint, a .voxels.json (the original blocks as coloured
cubes, for lab/mc_render.js) and a .stats.json (what happened to every block, rooms, sizes).

Scale: one block is one metre on every axis (see the doc for why). Minecraft (x, y, z) becomes Valheim
(x, y, -z) so the build is not mirrored; Valheim yaw a turns local +z to world (sin a, cos a).
"""
import collections, json, math, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
MAP_PATH = os.path.join(HERE, '..', 'data', 'mc-blockmap.json')

DIRS = {'east': (1, 0), 'west': (-1, 0), 'south': (0, 1), 'north': (0, -1)}  # Minecraft x, z


def load_map(path=MAP_PATH):
    m = json.load(open(path))
    for r in m['rules']:
        r['_re'] = re.compile(r['match'])
        r['_when'] = {k: re.compile(v) for k, v in r.get('when', {}).items()}
    return m


def classify(bm, name, props):
    for r in bm['rules']:
        if r['_re'].search(name) and all(k in props and w.search(str(props[k])) for k, w in r['_when'].items()):
            return r
    return None


# ------------------------------------------------------------------------------------------------ loading
def load_levels(plan_path, variant, level):
    """Compose levels 0..level of one variant. Each level file holds only what changes; air removes."""
    import nbtlib
    base = plan_path[:-5]
    grid, size = {}, [0, 0, 0]
    for lv in range(level + 1):
        f = f'{base}_{variant}_{lv}.nbt'
        if not os.path.exists(f):
            continue
        t = nbtlib.load(f)
        size = [max(size[i], int(t['size'][i])) for i in range(3)]
        pal = []
        for p in t['palette']:
            pal.append((str(p['Name']), {str(k): str(v) for k, v in p.get('Properties', {}).items()}))
        for b in t['blocks']:
            pos = tuple(int(v) for v in b['pos'])
            name, props = pal[int(b['state'])]
            if name in ('minecraft:air', 'minecraft:cave_air', 'minecraft:structure_void'):
                grid.pop(pos, None)
            else:
                grid[pos] = (name, props)
    return grid, size


# ------------------------------------------------------------------------------------------------ helpers
def yaw_of(dx, dz):
    """Valheim yaw that turns local +z to the Valheim direction (dx, dz)."""
    return (math.degrees(math.atan2(dx, dz)) + 360) % 360


def vh_dir(mc_dir):
    dx, dz = DIRS[mc_dir]
    return dx, -dz


def quat(yaw):
    a = math.radians(yaw) / 2
    return [0.0, round(math.sin(a), 6), 0.0, round(math.cos(a), 6)]


class Out:
    def __init__(self, cx, cz, sy):
        self.cx, self.cz, self.sy = cx, cz, sy
        self.pieces = []

    def put(self, name, mx, my, mz, yaw=0.0, src=None):
        """Place a piece at Minecraft coordinates (continuous, block units)."""
        self.pieces.append({'name': name, 'x': round(mx - self.cx, 3), 'y': round(my - self.sy, 3),
                            'z': round(-(mz - self.cz), 3), 'yaw': round(yaw % 360, 1), 'src': src})


def cover(cells, sizes):
    """Greedy exact cover of a 2D set of (u, v) cells with rectangles (w, h), largest first, bottom-left first.
    Returns [(u0, v0, w, h, idx)]."""
    left = set(cells)
    out = []
    for (u, v) in sorted(cells, key=lambda c: (c[1], c[0])):
        if (u, v) not in left:
            continue
        for i, (w, h) in enumerate(sizes):
            if all((u + a, v + b) in left for a in range(w) for b in range(h)):
                for a in range(w):
                    for b in range(h):
                        left.discard((u + a, v + b))
                out.append((u, v, w, h, i))
                break
    return out


def runs(vals, sizes):
    """Split sorted integer positions into consecutive runs and cover each with the given lengths."""
    vals = sorted(vals)
    out, cur = [], []
    for v in vals:
        if cur and v != cur[-1] + 1:
            out.append(cur); cur = []
        cur.append(v)
    if cur:
        out.append(cur)
    res = []
    for r in out:
        i = 0
        while i < len(r):
            rest = len(r) - i
            L = next((s for s in sizes if s <= rest), 1)
            res.append((r[i], L))
            i += L
    return res


# ------------------------------------------------------------------------------------------------ converter
def convert(grid, bm, culture, ground_level, meta=None):
    meta = meta or {}
    cult = dict(bm['cultures']['default'])
    cult.update(bm['cultures'].get(culture, {}))
    fams = bm['families']
    stats = collections.Counter()      # disposition of every non-air block
    unmapped = collections.Counter()
    sy = -(ground_level or 0)

    # classify
    B = {}  # pos -> dict(kind, mat, name, props, rule)
    for pos, (name, props) in grid.items():
        r = classify(bm, name, props)
        if r is None:
            unmapped[name] += 1
            stats['unmapped'] += 1
            continue
        k = r['kind']
        if k == 'air':
            continue
        B[pos] = {'kind': k, 'mat': r.get('mat'), 'name': name, 'props': props, 'rule': r}
    for pos, b in B.items():
        if b['kind'] in ('ground', 'marker', 'ignore', 'partof'):
            stats[b['kind']] += 1

    struct = [p for p, b in B.items() if b['kind'] not in ('ground', 'marker', 'ignore', 'nature')]
    if not struct:
        return None
    xs = [p[0] for p in struct]; zs = [p[2] for p in struct]
    cx, cz = (min(xs) + max(xs) + 1) / 2, (min(zs) + max(zs) + 1) / 2
    O = Out(cx, cz, sy)
    done = set()  # positions translated

    def kind(p):
        b = B.get(p)
        return b['kind'] if b else None

    def family(mat):
        return cult.get(mat, 'wood')

    # sky: top structural y per column
    top = {}
    for (x, y, z), b in B.items():
        if b['kind'] in ('solid', 'stair', 'slab', 'fence', 'window', 'door'):
            top[(x, z)] = max(top.get((x, z), -99), y)

    def open_sky(x, y, z):
        return top.get((x, z), -99) <= y

    # ---- stairs: roof planes, walk stairs, chairs
    stair_cells = {p: b for p, b in B.items() if b['kind'] == 'stair' and b['props'].get('half', 'bottom') == 'bottom'}
    for p, b in B.items():
        if b['kind'] == 'stair' and b['props'].get('half') == 'top':
            b['kind'] = 'solid'  # upside-down stairs fill like a block
    roof_cells = {}  # stair cells that became roof: pos -> (facing, roof family)
    groups = collections.defaultdict(set)
    for (x, y, z), b in stair_cells.items():
        f = b['props'].get('facing', 'north')
        dx, dz = DIRS[f]
        u = x * dx + z * dz
        l = z if dx else x
        groups[(f, u - y)].add((l, u, y, x, z))
    comps = []
    for key, cells in groups.items():
        byl = {(c[0], c[1]): c for c in cells}
        seen = set()
        for c in cells:
            k0 = (c[0], c[1])
            if k0 in seen:
                continue
            stack, comp = [k0], []
            seen.add(k0)
            while stack:
                a = stack.pop(); comp.append(byl[a])
                for d in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    n = (a[0] + d[0], a[1] + d[1])
                    if n in byl and n not in seen:
                        seen.add(n); stack.append(n)
            comps.append((key, comp))
    for (f, s), comp in comps:
        ls = {c[0] for c in comp}
        sky = sum(open_sky(c[3], c[2], c[4]) for c in comp) / len(comp)
        low = min(c[2] for c in comp)
        is_roof = (sky >= 0.5 and low >= sy + 2) or (len(ls) >= 3 and low >= sy + 2)
        mat = B[(comp[0][3], comp[0][2], comp[0][4])]['mat']
        vx, vz = vh_dir(f)
        if is_roof and mat in ('stone', 'lightstone') and cult.get('stoneStairRoof') == 'solid':
            # masonry cultures: stone stairs up high are stepped cornices and tiers, kept as stepped stone
            for c in comp:
                B[(c[3], c[2], c[4])]['kind'] = 'solid'
            stats['stone_stair_steps'] += len(comp)
            continue
        if is_roof and len(comp) <= 2:
            # one or two stairs on their own up on a roof are trim (barge boards, ridge ends); a 2 x 2 roof piece for
            # each makes fins, so they are left out and counted as lost
            stats['roof_trim'] += len(comp)
            continue
        if is_roof:
            rf = bm['roofs'][cult['roofByMat'].get(mat, cult['roof'])]
            yaw = yaw_of(-vx, -vz)  # roof rises toward local -z
            cells = {(c[0], c[1]) for c in comp}
            # 2 along the ridge (l) by 2 up the slope (u), then 2x1 and 1x1 leftovers with overhang
            pcs = cover(cells, [(2, 2), (2, 1), (1, 2), (1, 1)])
            umin = min(c[1] for c in cells)
            dx, dz = DIRS[f]
            for (l0, u0, w, h, _) in pcs:
                stats['roof_pieces'] += 1
                if w * h < 4:
                    stats['roof_overhang_m2'] += 4 - w * h
                # a single row borrows the row below it (overlap) unless it is the eave row (then it reaches up)
                ua = u0 if h == 2 or u0 == umin else u0 - 1
                lc = l0 + 1 if w == 2 else l0 + 0.5
                uc = ua + 1 if (dx > 0 or dz > 0) else -ua  # mean of the two rows' cell centres, in x or z
                # rows ua, ua+1 sit at y = u - s; the stair tops (step noses) lie half a block over the
                # line through the cells' low corners, so the pivot (middle of the top face) goes there
                py = (ua - s) + 1.5
                mx, mz = (uc, lc) if dx else (lc, uc)
                O.put(rf['r45'], mx, py, mz, yaw, 'roof')
            for c in comp:
                done.add((c[3], c[2], c[4]))
                roof_cells[(c[3], c[2], c[4])] = (f, rf)
            continue
        # walk stairs or chairs
        c0 = comp[0]
        lone = len(comp) == 1 and not any(
            (c0[3] + a, c0[2] + b, c0[4] + e) in stair_cells for a in (-1, 0, 1) for b in (-1, 0, 1) for e in (-1, 0, 1)
            if (a, b, e) != (0, 0, 0))
        below = B.get((c0[3], c0[2] - 1, c0[4]))
        on_floor = below is not None and below['kind'] in ('solid', 'slab', 'stair')
        if lone and on_floor and not open_sky(c0[3], c0[2], c0[4]):
            # a single stair on a floor indoors is a Minecraft chair; steps of a spiral stair have stair neighbours
            c = comp[0]
            O.put('piece_chair03', c[3] + 0.5, c[2], c[4] + 0.5, yaw_of(-vx, -vz), 'chair')
            done.add((c[3], c[2], c[4])); stats['chairs'] += 1
            continue
        fam = fams[family(mat)]
        yaw = yaw_of(-vx, -vz)
        byl = collections.defaultdict(list)
        for c in comp:
            byl[c[0]].append(c)
        for l, cs in byl.items():
            cs.sort(key=lambda c: c[1])
            i = 0
            while i < len(cs):
                pair = cs[i:i + 2] if i + 1 < len(cs) and cs[i + 1][1] == cs[i][1] + 1 else cs[i:i + 1]
                mx = sum(c[3] + 0.5 for c in pair) / len(pair)
                mz = sum(c[4] + 0.5 for c in pair) / len(pair)
                my = sum(c[2] + 0.5 for c in pair) / len(pair)
                if len(pair) == 1:
                    my += 0.5; stats['stair_single'] += 1
                O.put(fam['stair'], mx, my, mz, yaw, 'stair')
                for c in pair:
                    done.add((c[3], c[2], c[4]))
                i += len(pair)

    # ---- slabs: 26 degree roofs, floors, trims
    slabs = {p: b for p, b in B.items() if b['kind'] == 'slab'}
    for p, b in slabs.items():
        if b['props'].get('type') == 'double':
            b['kind'] = 'solid'
    slabs = {p: b for p, b in slabs.items() if b['kind'] == 'slab'}

    def sh(p):
        b = slabs.get(p)
        if not b:
            return None
        return p[1] + (0.5 if b['props'].get('type') == 'top' else 0)

    slope = {}
    for p in slabs:
        h = sh(p)
        x, y, z = p
        best = None
        for f, (dx, dz) in DIRS.items():
            ev = 0
            for q, want in (((x + dx, y, z + dz), h + 0.5), ((x + dx, y + 1, z + dz), h + 0.5),
                            ((x - dx, y, z - dz), h - 0.5), ((x - dx, y - 1, z - dz), h - 0.5)):
                if sh(q) == want:
                    ev += 1
            if ev and (best is None or ev > best[1]):
                best = (f, ev)
        if best and open_sky(x, y, z) and y >= sy + 2:
            slope[p] = best[0]
    pairs = collections.defaultdict(dict)
    for p, f in slope.items():
        x, y, z = p
        dx, dz = DIRS[f]
        l = z if dx else x
        u = x * dx + z * dz
        top_ = slabs[p]['props'].get('type') == 'top'
        ub = u - 1 if top_ else u
        pairs[(f, y, ub)][l] = True
    for (f, y, ub), ls in pairs.items():
        rf = bm['roofs'][cult['roofByMat'].get('x', cult['roof'])]
        vx, vz = vh_dir(f)
        yaw = yaw_of(-vx, -vz)
        dx, dz = DIRS[f]
        for (l0, L) in runs(ls.keys(), [2, 1]):
            lc = l0 + L / 2
            # u cells ub, ub+1 -> along-axis coordinate centre
            if dx > 0:
                mx, mz = ub + 1, lc
            elif dx < 0:
                mx, mz = -ub, lc
            elif dz > 0:
                mx, mz = lc, ub + 1
            else:
                mx, mz = lc, -ub
            O.put(rf['r26'], mx, y + 0.5, mz, yaw, 'roof26')  # low edge on the top of the low slab
            stats['roof26_pieces'] += 1
    for p in slope:
        done.add(p)

    # ---- structural solid set
    S = set()
    for p, b in B.items():
        if b['kind'] == 'solid':
            S.add(p)
    flat_slab = {p for p in slabs if p not in slope}

    def solid(p):
        return p in S

    hidden = {p for p in S if all(solid((p[0] + a, p[1] + b, p[2] + c)) for a, b, c in
                                  ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1)))}
    stats['hidden'] += len(hidden)
    done |= hidden

    # ---- floors (and flat slab floors)
    exposed = {p for p in S if not solid((p[0], p[1] + 1, p[2]))}
    under = {p for p in S if solid((p[0], p[1] + 1, p[2]))}
    floorset = exposed | under
    floor_cells = set()
    for p in floorset:
        x, y, z = p
        for a in (0, -1):
            for c in (0, -1):
                win = [(x + a + i, y, z + c + j) for i in (0, 1) for j in (0, 1)]
                if all(q in floorset for q in win) and any(q in exposed for q in win):
                    floor_cells.update(q for q in win if q in exposed or q in under)
    # under-cells only become floor when an exposed cell is next to them (the floor runs under the wall)
    fl = set()
    for p in floor_cells:
        if p in exposed:
            fl.add(p)
        else:
            x, y, z = p
            if any((x + a, y, z + c) in exposed and (x + a, y, z + c) in floor_cells for a in (-1, 0, 1) for c in (-1, 0, 1)):
                fl.add(p)
    floor_cells = fl - hidden
    # slab floors: flat slabs in a 2x2 of flat slabs at the same height
    slab_floor = set()
    for p in flat_slab:
        x, y, z = p
        h = sh(p)
        for a in (0, -1):
            for c in (0, -1):
                win = [(x + a + i, y, z + c + j) for i in (0, 1) for j in (0, 1)]
                if all(q in flat_slab and sh(q) == h for q in win):
                    slab_floor.update(win)
    by_layer = collections.defaultdict(lambda: collections.defaultdict(set))
    for p in floor_cells:
        fam = family(B[p]['mat'])
        if p in under and not fams[fam]['thin']:
            continue  # a thick wall already fills this cell
        by_layer[(p[1] + 1.0, fam)][fam].add((p[0], p[2]))
    for p in slab_floor:
        fam = family(B[p]['mat'])
        by_layer[(sh(p) + 0.5, fam)][fam].add((p[0], p[2]))
        # reach into posts and thin walls beside the slab floor so it rests on them, as the slabs do in Minecraft
        x, y, z = p
        for q in ((x + 1, y, z), (x - 1, y, z), (x, y, z + 1), (x, y, z - 1)):
            if q in S and q not in floor_cells and fams[family(B[q]['mat'])]['thin']:
                by_layer[(sh(p) + 0.5, fam)][fam].add((q[0], q[2]))
    for (ytop, fam), d in by_layer.items():
        F = fams[fam]
        for (u, v, w, h, i) in cover(d[fam], [(2, 2), (1, 1)]):
            name = F['floor2'] if w == 2 else F['floor1']
            depth = F['floorDepth'] if w == 2 or F['floor1'].endswith('floor_1x1') else 1.0
            O.put(name, u + w / 2, ytop - depth / 2, v + h / 2, 0, 'floor')
            stats['floor_pieces'] += 1
    for p in floor_cells | slab_floor:
        if p not in done:
            done.add(p)

    # ---- walls
    W = (S - hidden - (floor_cells & exposed)) | (flat_slab - slab_floor)
    # wall plate: a thin floor (0.25 m at the top of a 1 m block) would float 0.75 m over the wall under it,
    # so the floor block over a wall is also a wall row
    plates = {p for p in floor_cells & exposed if fams[family(B[p]['mat'])]['thin'] and (p[0], p[1] - 1, p[2]) in W}
    W |= plates
    stats['plate_cells'] += len(plates)
    for p in flat_slab - slab_floor:
        B[p]['kind'] = 'solid'
    paper_open = set()
    for p in list(W):
        if B[p]['mat'] == 'paper':
            x, y, z = p
            below = B.get((x, y - 1, z)); below2 = B.get((x, y - 2, z))
            if below and below.get('mat') == 'paper' and not (below2 and below2.get('mat') == 'paper'):
                paper_open.add(p)
    W -= paper_open
    # ridge: a block row with roof rising to it from both sides becomes ridge caps
    ridge = collections.defaultdict(list)
    for p in list(W):
        x, y, z = p
        if not open_sky(x, y, z):
            continue
        for ax, a, b_, fa, fb in (('x', (x, y - 1, z - 1), (x, y - 1, z + 1), 'south', 'north'),
                                   ('z', (x - 1, y - 1, z), (x + 1, y - 1, z), 'east', 'west')):
            ra, rb = roof_cells.get(a), roof_cells.get(b_)
            if ra and rb and ra[0] == fa and rb[0] == fb:
                ridge[(ax, z if ax == 'x' else x, y, ra[1]['top45'])].append(x if ax == 'x' else z)
                W.discard(p); done.add(p); stats['ridge_cells'] += 1
                break
    for (ax, k, y, nm), us in ridge.items():
        for (u0, L) in runs(us, [2, 1]):
            c = u0 + L / 2
            if ax == 'x':
                O.put(nm, c, y + 0.5, k + 0.5, 0, 'ridge')
            else:
                O.put(nm, k + 0.5, y + 0.5, c, 90, 'ridge')
            stats['ridge_pieces'] += 1
    # a thin wall starts on its floor: the floor block under the wall's bottom row is floor only
    base = {p for p in W & floor_cells if fams[family(B[p]['mat'])]['thin'] and (p[0], p[1] - 1, p[2]) not in W}
    W -= base
    openings = {p for p, b in B.items() if b['kind'] in ('door', 'window', 'gate')} | paper_open
    for p in paper_open:
        done.add(p); stats['paper_gap'] += 1

    def wallish(p):
        return p in W or p in openings

    orient = {}
    for p in W:
        x, y, z = p
        nx = wallish((x + 1, y, z)) or wallish((x - 1, y, z))
        nz = wallish((x, y, z + 1)) or wallish((x, y, z - 1))
        orient[p] = 'c' if nx and nz else 'x' if nx else 'z' if nz else 'p'
    for p in W:
        if orient[p] == 'p':
            x, y, z = p
            votes = collections.Counter(orient.get((x, y + d, z)) for d in (-3, -2, -1, 1, 2, 3))
            for o in ('x', 'z'):
                if votes[o] >= 1 and votes[o] >= votes[{'x': 'z', 'z': 'x'}[o]]:
                    orient[p] = o + 'v'
                    break

    def fam_of(p):
        return family(B[p]['mat'])

    # thick families: cell cover per plane
    thick = {p for p in W if not fams[fam_of(p)]['thin']}
    planes = collections.defaultdict(lambda: collections.defaultdict(set))
    for p in thick:
        o = orient[p]
        x, y, z = p
        if o in ('z', 'zv'):
            planes[('z', x, fam_of(p))]['c'].add((z, y))
        else:
            planes[('x', z, fam_of(p))]['c'].add((x, y))
    for (ax, k, fam), d in planes.items():
        F = fams[fam]
        sizes = [(w, h) for w, h, _ in F['walls']]
        for (u, v, w, h, i) in cover(d['c'], sizes):
            for (nm, dy) in F['walls'][i][2]:
                if ax == 'x':
                    O.put(nm, u + w / 2, v + h / 2 + dy, k + 0.5, 0, 'wall')
                else:
                    O.put(nm, k + 0.5, v + h / 2 + dy, u + w / 2, 90, 'wall')
                stats['wall_pieces'] += 1
    for p in thick:
        done.add(p)

    # thin families: walls on the centre lines between cell centres (edge cover)
    thin = W - thick
    edges = collections.defaultdict(set)
    open_edges = 0
    for ax in ('x', 'z'):
        for p in W | openings:
            x, y, z = p
            q = (x + 1, y, z) if ax == 'x' else (x, y, z + 1)
            if q not in W and q not in openings:
                continue
            if p in openings or q in openings:
                open_edges += 1
                continue
            if p not in thin and q not in thin:
                continue
            fp = fam_of(p) if p in thin else None
            fq = fam_of(q) if q in thin else None
            fam = fp or fq
            if fp and fq and fp != fq:
                fam = 'log' if 'log' in (fp, fq) and B[p]['mat'] in ('log', 'darklog') and B[q]['mat'] in ('log', 'darklog') else fp
            if ax == 'x':
                edges[('x', z, fam)].add((x, y))
            else:
                edges[('z', x, fam)].add((z, y))
            if p in thin:
                done.add(p)
            if q in thin:
                done.add(q)
    for (ax, k, fam), cells in edges.items():
        F = fams[fam]
        sizes = [(w, h) for w, h, _ in F['walls']]
        for (u, v, w, h, i) in cover(cells, sizes):
            for (nm, dy) in F['walls'][i][2]:
                c = u + 0.5 + w / 2
                if ax == 'x':
                    O.put(nm, c, v + h / 2 + dy, k + 0.5, 0, 'wall')
                else:
                    O.put(nm, k + 0.5, v + h / 2 + dy, c, 90, 'wall')
                stats['wall_pieces'] += 1
    # posts: timber corners, lone thin cells, vertical logs that end walls
    post_cols = collections.defaultdict(list)
    for p in thin:
        mat = B[p]['mat']
        o = orient[p]
        if o in ('p', 'xv', 'zv') or (mat in ('log', 'darklog') and o == 'c'):
            post_cols[(p[0], p[2], fam_of(p))].append(p[1])
    for (x, z, fam), ys in post_cols.items():
        F = fams[fam]
        lens = [4, 2, 1] if F.get('pole4') else [2, 1]
        for (y0, L) in runs(ys, lens):
            nm = F['pole4'] if L == 4 else F['pole2'] if L == 2 else F['pole1']
            O.put(nm, x + 0.5, y0 + L / 2, z + 0.5, 0, 'pole')
            stats['pole_pieces'] += 1
            for yy in range(y0, y0 + L):
                done.add((x, yy, z))
    for p in thin:
        if p not in done:
            stats['lost_thin'] += 1
    stats['open_edges'] = open_edges

    # ---- doors and windows
    door_cells = {p for p, b in B.items() if b['kind'] in ('door', 'gate')}
    lower = sorted(p for p in door_cells if B[p]['props'].get('half', 'lower') == 'lower')
    used = set()
    for p in lower:
        if p in used:
            continue
        b = B[p]
        f = b['props'].get('facing', 'north')
        dx, dz = DIRS[f]
        ax = 'x' if dz else 'z'  # the wall the door sits in runs along x when it faces north or south
        run = [p]
        while True:
            q = (run[-1][0] + 1, p[1], p[2]) if ax == 'x' else (p[0], p[1], run[-1][2] + 1)
            if q in door_cells and q not in used and B[q]['props'].get('half', 'lower') == 'lower':
                run.append(q)
            else:
                break
        for q in run:
            used.add(q)
        n = max(1, round(len(run) / 2))
        mx0 = sum(q[0] + 0.5 for q in run) / len(run)
        mz0 = sum(q[2] + 0.5 for q in run) / len(run)
        fam = fams['wood']
        nm = 'wood_gate' if b['kind'] == 'gate' else fam['door']
        for i in range(n):
            off = (i - (n - 1) / 2) * 2
            mx, mz = (mx0 + off, mz0) if ax == 'x' else (mx0, mz0 + off)
            O.put(nm, mx, p[1] + 1, mz, 0 if ax == 'x' else 90, 'door')
            stats['doors'] += 1
    for p in door_cells:
        done.add(p)
    for p, b in B.items():
        if b['kind'] == 'window':
            done.add(p); stats['window_cells'] += 1

    # ---- fences: posts where they stack or turn, rails along runs
    fence = {p for p, b in B.items() if b['kind'] == 'fence'}
    fence_edges = collections.defaultdict(set)
    for p in fence:
        x, y, z = p
        for ax, q in (('x', (x + 1, y, z)), ('z', (x, y, z + 1))):
            if q in fence:
                fence_edges[(ax, z if ax == 'x' else x, y)].add(x if ax == 'x' else z)
    for (ax, k, y), us in fence_edges.items():
        for (u0, L) in runs(us, [2, 1]):
            c = u0 + 0.5 + L / 2
            nm = 'wood_fence' if L == 2 else 'wood_beam_1'
            yy = y + 0.5
            if ax == 'x':
                O.put(nm, c, yy, k + 0.5, 0, 'fence')
            else:
                O.put(nm, k + 0.5, yy, c, 90, 'fence')
            stats['fence_pieces'] += 1
    cols = collections.defaultdict(list)
    for p in fence:
        x, y, z = p
        nb = [(x + 1, y, z) in fence, (x - 1, y, z) in fence, (x, y, z + 1) in fence, (x, y, z - 1) in fence]
        straight = (nb[0] and nb[1] and not nb[2] and not nb[3]) or (nb[2] and nb[3] and not nb[0] and not nb[1])
        stacked = (x, y + 1, z) in fence or (x, y - 1, z) in fence or (x, y + 1, z) in S
        if not straight or stacked:
            cols[(x, z, B[p]['mat'])].append(y)
    for (x, z, mat), ys in cols.items():
        fam = fams[family(mat)] if fams[family(mat)]['thin'] else fams['wood']
        for (y0, L) in runs(ys, [2, 1]):
            O.put(fam['pole2'] if L == 2 else fam['pole1'], x + 0.5, y0 + L / 2, z + 0.5, 0, 'pole')
            stats['pole_pieces'] += 1
    for p in fence:
        done.add(p)

    # ---- ladders
    lad = collections.defaultdict(list)
    for p, b in B.items():
        if b['kind'] == 'ladder':
            lad[(p[0], p[2], b['props'].get('facing', 'north'))].append(p[1])
    for (x, z, f), ys in lad.items():
        dx, dz = DIRS[f]
        vx, vz = vh_dir(f)
        for (y0, L) in runs(ys, [2, 1]):
            O.put('wood_stepladder', x + 0.5 - dx * 0.3, y0 + L / 2, z + 0.5 - dz * 0.3, yaw_of(vx, vz), 'ladder')
            stats['ladders'] += 1
        for y in ys:
            done.add((x, y, z))

    # ---- furniture, lights, decor
    furn = []
    for p, b in B.items():
        if b['kind'] != 'furn':
            continue
        r = b['rule']
        x, y, z = p
        f = b['props'].get('facing')
        mx, my, mz = x + 0.5, y, z + 0.5
        normal = r.get('normal', 'none')
        if normal == 'auto' or (normal in ('facing', 'back') and not f):
            # face away from the nearest solid side
            f = None
            for d, (dx, dz) in DIRS.items():
                if solid((x - dx, y, z - dz)) or solid((x - dx, y + 1, z - dz)):
                    f = d
                    break
            normal = 'facing' if f else 'none'
        yaw = 0.0
        if normal != 'none' and f:
            vx, vz = vh_dir(f)
            if normal == 'back':
                vx, vz = -vx, -vz
            yaw = yaw_of(vx, vz) + r.get('rel', 0)
        if r.get('bed') and f:
            dx, dz = DIRS[f]
            mx -= dx * 0.5; mz -= dz * 0.5
        if r.get('mount') == 'wall' and f:
            dx, dz = DIRS[f]
            mx -= dx * 0.35; mz -= dz * 0.35; my = y + 0.5
        nm = r['prefab']
        if nm == 'piece_walltorch' and r.get('mount') == 'wall' and normal == 'none':
            nm = 'piece_groundtorch_wood'; my = y
        O.put(nm, mx, my, mz, yaw, 'furn')
        furn.append((p, r.get('role', 'deco'), nm))
        done.add(p); stats['furniture'] += 1

    # carpets to rugs: one per 2x2, one per lone patch
    carpets = collections.defaultdict(lambda: collections.defaultdict(set))
    for p, b in B.items():
        if b['kind'] == 'carpet':
            col = b['name'].split(':')[1].replace('_carpet', '')
            nm = bm['carpets'].get(col, bm['carpets']['default'])
            carpets[(p[1], nm)]['c'].add((p[0], p[2]))
    for (y, nm), d in carpets.items():
        cells = d['c']
        for (u, v, w, h, i) in cover(cells, [(2, 2), (1, 1)]):
            if w == 2:
                O.put(nm, u + 1, y, v + 1, 0, 'rug'); stats['rugs'] += 1
                furn.append(((u, y, v), 'rug', nm))
        # lone patches with no 2x2 still get one rug
        if not any(all((u + a, v + c) in cells for a in (0, 1) for c in (0, 1)) for (u, v) in cells):
            u, v = sorted(cells)[len(cells) // 2]
            O.put(nm, u + 0.5, y, v + 0.5, 0, 'rug'); stats['rugs'] += 1
            furn.append(((u, y, v), 'rug', nm))
        for (u, v) in cells:
            done.add((u, y, v))

    # crops and trees
    for p, b in B.items():
        x, y, z = p
        if b['kind'] == 'crop':
            crop = b['props'].get('crop') or b['rule'].get('crop') or 'default'
            nm = bm['crops'].get(crop, bm['crops']['default'])
            O.put(nm, x + 0.5, y + 1 if b['name'].endswith('mock_soil') else y, z + 0.5, 0, 'crop')
            done.add(p); stats['crops'] += 1
            furn.append((p, 'farm', nm))
        elif b['kind'] == 'tree':
            t = b['props'].get('tree') or b['name'].split(':')[1].replace('_sapling', '').replace('potted_', '')
            nm = bm['trees'].get(t, bm['trees']['default'])
            O.put(nm, x + 0.5, y, z + 0.5, 0, 'tree')
            done.add(p); stats['trees'] += 1
        elif b['kind'] == 'nature':
            if b['rule'].get('prefab'):
                O.put(b['rule']['prefab'], x + 0.5, y, z + 0.5, 0, 'nature')
                done.add(p)
            else:
                stats['nature'] += 1

    # count once per block: translated, hidden inside a mass, or left over
    BUILD = ('solid', 'stair', 'slab', 'window', 'door', 'gate', 'fence', 'ladder', 'furn', 'carpet', 'crop', 'tree')
    for p, b in B.items():
        if b['kind'] in BUILD or (b['kind'] == 'nature' and b['rule'].get('prefab')):
            if p in hidden:
                continue
            if p in done:
                stats['translated'] += 1
                stats['mat:' + (b['mat'] or b['kind'])] += 1
            else:
                stats['left'] += 1

    # ---- rooms: walkable cells joined on one level, walls and doors split them
    rooms = find_rooms(B, S | set(slabs) | {p for p, b in B.items() if b['kind'] in ('fence', 'window')},
                       {p for p, b in B.items() if b['kind'] in ('door', 'gate')}, furn, sy, meta)

    # ---- terrain surface per column (Valheim coordinates), so a check can count pieces resting on the ground
    terrain = {}
    for (x, y, z), b in B.items():
        if b['kind'] == 'ground':
            k = (x, z)
            terrain[k] = max(terrain.get(k, -999), y + 1)
    for x in range(min(xs) - 1, max(xs) + 2):
        for z in range(min(zs) - 1, max(zs) + 2):
            terrain.setdefault((x, z), sy)
    terrain_vh = [[round(x + 0.5 - cx, 2), round(-(z + 0.5 - cz), 2), t - sy] for (x, z), t in terrain.items()]

    # ---- sizes
    st = [p for p, b in B.items() if b['kind'] in ('solid', 'stair', 'slab', 'fence', 'window', 'door')]
    ys = [p[1] for p in st] or [sy]
    size = {'w': max(xs) - min(xs) + 1, 'd': max(zs) - min(zs) + 1,
            'h_above_ground': max(ys) + 1 - sy, 'h_total': max(ys) + 1 - min(ys)}
    total = sum(1 for b in B.values()) + stats['unmapped']
    build = total - stats['ground'] - stats['marker'] - stats['ignore'] - stats['partof'] - stats['nature']
    res = {'stats': dict(stats), 'unmapped': dict(unmapped), 'size': size, 'rooms': rooms, 'terrain': terrain_vh,
           'blocks_total': total, 'blocks_build': build}
    return O, res


def find_rooms(B, solid, doors, furn, sy, meta):
    """Flood walkable air cells (cell below holds something) level by level. Doors and solids bound a room.
    Each room gets uses from the furniture and markers inside it."""
    markers = collections.defaultdict(list)
    for p, b in B.items():
        if b['name'] == 'millenaire:mock_marker':
            markers[p].append(b['props'].get('type'))
    def free(p):
        return p not in solid and p not in doors
    walk = set()
    roofs = solid | {p for p, b in B.items() if b['kind'] == 'stair'}
    y1 = max([p[1] for p in roofs] or [0])
    xs = [p[0] for p in solid] or [0]; zs = [p[2] for p in solid] or [0]; ys = [p[1] for p in solid] or [0]
    for p in solid:
        q = (p[0], p[1] + 1, p[2])
        if free(q) and free((q[0], q[1] + 1, q[2])):
            walk.add(q)
    seen = set()
    rooms = []
    fur = collections.defaultdict(list)
    for (p, role, nm) in furn:
        fur[p].append((role, nm))
    for p in walk:
        if p in seen:
            continue
        comp, stack = [], [p]
        seen.add(p)
        while stack:
            a = stack.pop(); comp.append(a)
            for d in ((1, 0, 0), (-1, 0, 0), (0, 0, 1), (0, 0, -1)):
                n = (a[0] + d[0], a[1], a[2] + d[2])
                if n in walk and n not in seen:
                    seen.add(n); stack.append(n)
        if len(comp) < 4:
            continue
        cs = set(comp)
        covered = sum(1 for c in comp if any((c[0], yy, c[2]) in roofs for yy in range(c[1] + 2, y1 + 1)))
        indoor = covered / len(comp) >= 0.7
        items = collections.Counter(); uses = collections.Counter()
        for c in comp:
            for dy in (0, 1, -1):
                q = (c[0], c[1] + dy, c[2])
                for role, nm in fur.get(q, []):
                    items[nm] += 1; uses[role] += 1
                for m in markers.get(q, []):
                    uses['m:' + m] += 1
        label = room_label(uses, indoor)
        rooms.append({'cells': len(comp), 'level': comp[0][1] - sy, 'indoor': indoor, 'use': label,
                      'items': dict(items), 'signals': dict(uses)})
    rooms.sort(key=lambda r: -r['cells'])
    return rooms[:40]


def room_label(u, indoor):
    if u['bed'] or u['m:sleeping_pos']:
        return 'bedroom'
    if u['kitchen']:
        return 'kitchen'
    if u['m:selling_pos'] or u['m:stall']:
        return 'shop'
    if u['work'] or u['m:crafting_pos'] or u['m:brick_spot'] or u['m:silkworm_block'] or u['m:snail_soil_block']:
        return 'workshop'
    if u['shrine'] or u['m:healing_spot']:
        return 'shrine'
    if u['farm']:
        return 'field'
    if u['storage'] >= 2:
        return 'storage'
    if u['m:leisure_pos']:
        return 'hall'
    if u['m:defending_pos'] or u['m:shelter_pos']:
        return 'guard'
    return 'room' if indoor else 'yard'


# ------------------------------------------------------------------------------------------------ storey squash
def squash(grid, bm, ground_level, clear=2):
    """Optional: take plain wall rows out of each storey until it has `clear` rows of headroom over its floor.
    A row goes only when, across the whole building, it holds nothing but solid blocks, air and wall-mounted lights
    or banners (those move down a row). Doors (two high) and the rows over each floor stay. Roofs keep their pitch
    because whole rows go and everything above moves down. Returns the new grid and the rows taken out."""
    sy = -(ground_level or 0)
    kinds = {}
    for pos, (name, props) in grid.items():
        r = classify(bm, name, props)
        kinds[pos] = (r['kind'] if r else 'unmapped', r)
    solid = {p for p, (k, r) in kinds.items() if k == 'solid'}
    layers = collections.defaultdict(list)
    for p in kinds:
        layers[p[1]].append(p)
    if not layers:
        return grid, []
    y0, y1 = min(layers), max(layers)
    exposed = {p for p in solid if (p[0], p[1] + 1, p[2]) not in solid}
    floor_y = set()
    for y in range(y0, y1 + 1):
        n = 0
        for p in layers[y]:
            if p in exposed and all((p[0] + a, y, p[2] + c) in exposed for a in (0, 1) for c in (0, 1)):
                n += 1
        if n >= 2:
            floor_y.add(y)
    BLOCK = {'stair', 'slab', 'door', 'gate', 'window', 'ladder', 'carpet', 'crop', 'tree', 'fence', 'unmapped'}

    def plain(y):
        for p in layers[y]:
            k, r = kinds[p]
            if k in BLOCK:
                return False
            if k == 'furn' and not (r.get('mount') == 'wall'):
                return False
        return True

    remove = set()
    fl = sorted(f for f in floor_y if f >= sy - 1)
    for i, f in enumerate(fl):
        nxt = fl[i + 1] if i + 1 < len(fl) else None
        if nxt is None:
            roof = [p[1] for p, (k, r) in kinds.items() if k in ('stair', 'slab') and p[1] > f + clear]
            nxt = min(roof) if roof else None
        if nxt is None:
            continue
        head = nxt - f - 1
        y = nxt - 1
        while head > clear and y > f + clear:
            if plain(y) and y not in floor_y:
                remove.add(y)
                head -= 1
            y -= 1
    if not remove:
        return grid, []
    rem = sorted(remove)
    out = {}
    for (x, y, z), v in grid.items():
        if y in remove:
            k, r = kinds[(x, y, z)]
            if k == 'furn':
                tgt = (x, y - sum(1 for q in rem if q < y) - 1, z)
                out.setdefault(tgt, v)
            continue
        out[(x, y - sum(1 for q in rem if q < y), z)] = v
    return out, rem


# ------------------------------------------------------------------------------------------------ writing
def write_blueprint(path, O, name, desc, category='mc-study'):
    # The word Millenaire stays out of name, description and category: learn.py reads them for the building type and
    # 'mill' in it makes every design a farm.
    lines = [f'#Name:{name}', '#Creator:mc study conversion', f'#Description:"{desc}"', f'#Category:{category}', '#Pieces']
    for p in O.pieces:
        q = quat(p['yaw'])
        lines.append(';'.join([p['name'], 'Building', f"{p['x']:g}", f"{p['y']:g}", f"{p['z']:g}",
                               *(f'{v:g}' for v in q), '""', '1', '1', '1']))
    open(path, 'w').write('\n'.join(lines) + '\n')


def voxels(grid, bm, B_cls, cx, cz, sy):
    """Original blocks as coloured boxes in Valheim coordinates, for the picture check."""
    col = bm['colors']
    out = []
    S = set()
    for pos, (name, props) in grid.items():
        r = B_cls.get(pos)
        if r and r['kind'] == 'solid':
            S.add(pos)
    for pos, (name, props) in grid.items():
        r = B_cls.get(pos)
        if not r or r['kind'] in ('air', 'ground', 'marker', 'ignore', 'partof'):
            continue
        x, y, z = pos
        if pos in S and all((x + a, y + b, z + c) in S for a, b, c in ((1, 0, 0), (-1, 0, 0), (0, 1, 0), (0, -1, 0), (0, 0, 1), (0, 0, -1))):
            continue
        k = r['kind']
        c = col.get(r.get('mat') or k) or col.get(k) or '#999999'
        if k in ('furn',):
            c = col['furn']
        h, yc = 1.0, y + 0.5
        if k == 'slab':
            t = props.get('type', 'bottom')
            if t == 'bottom':
                h, yc = 0.5, y + 0.25
            elif t == 'top':
                h, yc = 0.5, y + 0.75
        if k in ('carpet',):
            h, yc = 0.1, y + 0.05
        if k in ('crop',):
            c = col['crop']
        if k in ('nature', 'tree'):
            c = col['nature']
        if k == 'stair':
            out.append([round(x + 0.5 - cx, 2), round(y + 0.25 - sy, 2), round(-(z + 0.5 - cz), 2), c, 0.5, 1, 1])
            f = props.get('facing', 'north')
            dx, dz = DIRS[f]
            half = props.get('half', 'bottom')
            yy = y + 0.75 if half == 'bottom' else y + 0.25
            out.append([round(x + 0.5 + dx * 0.25 - cx, 2), round(yy - sy, 2), round(-(z + 0.5 + dz * 0.25 - cz), 2), c, 0.5,
                        0.5 if dx else 1, 0.5 if dz else 1])
            continue
        w = d = 1.0
        if k in ('fence', 'ladder', 'window') and r.get('mat') != 'glass':
            w = d = 1.0 if k == 'window' else 0.3
        out.append([round(x + 0.5 - cx, 2), round(yc - sy, 2), round(-(z + 0.5 - cz), 2), c, h, w, d])
    return out


def classify_all(grid, bm):
    out = {}
    for pos, (name, props) in grid.items():
        r = classify(bm, name, props)
        if r:
            out[pos] = r
    return out


def convert_one(plan_path, variant, level, out_dir, bm, culture=None, write_vox=True, squash_storeys=False):
    plan = json.load(open(plan_path))
    culture = culture or plan.get('culture', '').split(':')[-1]
    v = next(v for v in plan['variants'] if v['variant'] == variant)
    grid, size = load_levels(plan_path, variant, level)
    if not grid:
        return None
    gl = v.get('ground_level', 0) or 0
    meta = {'culture': culture, 'id': plan['building_id'], 'category': plan.get('category', ''), 'variant': variant,
            'level': level, 'tags': [t for lv in v.get('levels', []) if lv.get('level', 0) <= level for t in lv.get('tags', [])]}
    orig = grid
    removed = []
    if squash_storeys:
        grid, removed = squash(grid, bm, gl)
    r = convert(grid, bm, culture, gl, meta)
    if r is None:
        return None
    O, res = r
    res['squashed_rows'] = removed
    res['meta'] = meta
    res['meta']['native_name'] = plan.get('native_name', '')
    res['meta']['residents'] = (plan.get('male') or []) + (plan.get('female') or [])
    res['meta']['sub_building'] = bool(plan.get('is_sub_building') or plan.get('parent_building'))
    res['pieces'] = len(O.pieces)
    res['piece_counts'] = dict(collections.Counter(p['name'] for p in O.pieces))
    os.makedirs(os.path.join(out_dir, culture), exist_ok=True)
    base = os.path.join(out_dir, culture, f"{plan['building_id']}_{variant}_{level}")
    nm = f"mc {culture} {plan['building_id']} {variant}{level}"
    desc = ' '.join(['mc', culture, plan.get('category', ''), plan['building_id'].replace('_', ' '),
                     plan.get('native_name', ''), ' '.join(res['meta']['residents']), ' '.join(meta['tags'])])
    write_blueprint(base + '.blueprint', O, nm, re.sub(r'\s+', ' ', desc).strip())
    if write_vox:
        cls = classify_all(orig, bm)
        json.dump(voxels(orig, bm, cls, O.cx, O.cz, O.sy), open(base + '.voxels.json', 'w'), separators=(',', ':'))
    json.dump(res, open(base + '.stats.json', 'w'), indent=1)
    return res


def plans(root, culture=None):
    for c in sorted(os.listdir(root)):
        if culture and c != culture:
            continue
        bdir = os.path.join(root, c, 'buildings')
        if not os.path.isdir(bdir):
            continue
        for cat in sorted(os.listdir(bdir)):
            for f in sorted(os.listdir(os.path.join(bdir, cat))):
                if f.endswith('.json'):
                    yield c, os.path.join(bdir, cat, f)


def main(argv):
    bm = load_map()
    if argv and argv[0] == '--one':
        _, plan, variant, level, out = argv[:5]
        res = convert_one(plan, variant, int(level), out, bm)
        print(json.dumps({k: res[k] for k in ('stats', 'unmapped', 'size', 'pieces')}, indent=1))
        return
    root, out = argv[0], argv[1]
    opts = dict(zip(argv[2::2], argv[3::2]))
    levels = opts.get('--levels', 'top')
    only = opts.get('--only')
    n = 0
    for culture, plan_path in plans(root, opts.get('--culture')):
        plan = json.load(open(plan_path))
        if only and plan.get('building_id') != only:
            continue
        for v in plan.get('variants', []):
            lvls = sorted(l.get('level', 0) for l in v.get('levels', [])) or [0]
            todo = lvls if levels == 'all' else [lvls[-1]]
            for lv in todo:
                try:
                    res = convert_one(plan_path, v['variant'], lv, out, bm, culture,
                                      squash_storeys=opts.get('--squash') == '1')
                except Exception as e:  # keep going; report at the end
                    print('FAILED', plan_path, v['variant'], lv, repr(e), file=sys.stderr)
                    continue
                if res:
                    n += 1
    print('converted', n)


if __name__ == '__main__':
    main(sys.argv[1:])
