#!/usr/bin/env python3
"""Build data/catalog/pieces.json from the measured inputs.

    python3 -I build_catalog.py <work dir> <out pieces.json>

<work dir> holds what the other scripts in this folder wrote:
  stats.json      corpus_pass.js: placements and reuse per prefab over compact.json
  buildsize.json  per build: vanilla pieces, floor area (m2), footprint, votes
  colors.json     colors.py: area-weighted colors of each piece's measured mesh (game textures sampled at the mesh UVs)
  meshdir.json    where the tall part of each mesh sits (backrests, headboards)
  look/meta/*.json, look/icons/*.png, look/tex/*.png, look/names-en.json   icons.py on Tyler's PC (game files)
  showcase-counts.json (optional) counts in the 16 showcase designs
Everything here is derived data: hex colors, shares and counts. No game art is written."""
import json, os, re, sys, math
import numpy as np
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from families import FAMILIES, FAMILY_BY_TEX, FAMILY_BY_ID, NAMES, DESC

W = sys.argv[1]
OUT = sys.argv[2]
L = os.path.join(W, 'look')
stats = json.load(open(os.path.join(W, 'stats.json')))
ST = stats['pieces']
NB = stats['builds']
TOTW = stats['totalW']
COL = json.load(open(os.path.join(W, 'colors.json')))
MD = json.load(open(os.path.join(W, 'meshdir.json')))
EN = json.load(open(os.path.join(L, 'names-en.json')))
BS = json.load(open(os.path.join(W, 'buildsize.json')))
GEN = {n: f for n, f in json.load(open(os.path.join(W, 'gen-names.json')))}
SHOW = json.load(open(os.path.join(W, 'showcase-counts.json'))) if os.path.exists(os.path.join(W, 'showcase-counts.json')) else {}

def meta(n):
    f = os.path.join(L, 'meta', n + '.json')
    return json.load(open(f)) if os.path.exists(f) else {}

def srgb2lab(c):
    c = np.asarray(c, float)
    lin = np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)
    M = np.array([[0.4124, 0.3576, 0.1805], [0.2126, 0.7152, 0.0722], [0.0193, 0.1192, 0.9505]])
    xyz = lin @ M.T / np.array([0.95047, 1.0, 1.08883])
    f = np.where(xyz > 0.008856, np.cbrt(xyz), 7.787 * xyz + 16 / 116)
    return np.stack([116 * f[..., 1] - 16, 500 * (f[..., 0] - f[..., 1]), 200 * (f[..., 1] - f[..., 2])], -1)

def hexc(c):
    c = np.clip(c, 0, 1); return '#%02x%02x%02x' % tuple(int(round(v * 255)) for v in c)

def img_colors(path, tint=None, k=3):
    """Dominant colors of an image's opaque pixels (icon or texture thumbnail)."""
    try:
        im = Image.open(path).convert('RGBA').resize((48, 48))
    except Exception:
        return None
    a = np.asarray(im, float) / 255
    m = a[..., 3] > 0.5
    px = a[..., :3][m]
    if len(px) < 10: return None
    if tint: px = px * np.array(tint[:3])[None, :]
    lab = srgb2lab(px)
    rng = np.random.default_rng(0)
    cent = lab[rng.choice(len(lab), k, replace=False)]
    for _ in range(15):
        d = ((lab[:, None] - cent[None]) ** 2).sum(-1); asg = d.argmin(1)
        for j in range(k):
            if (asg == j).any(): cent[j] = lab[asg == j].mean(0)
    out = []
    for j in range(k):
        mm = asg == j
        if mm.sum() / len(px) < 0.06: continue
        rgb = px[mm].mean(0)
        out.append({'hex': hexc(rgb), 'share': round(float(mm.mean()), 2), 'L': round(float(srgb2lab(rgb)[0]))})
    out.sort(key=lambda s: -s['share'])
    mean = px.mean(0)
    return {'mean': hexc(mean), 'L': round(float(srgb2lab(mean)[0])), 'chroma': round(float(np.hypot(lab[:, 1], lab[:, 2]).mean())), 'swatches': out}

def value_word(L):
    return 'very dark' if L < 18 else 'dark' if L < 32 else 'mid' if L < 52 else 'light' if L < 72 else 'very light'

def hue_word(hexs):
    """Color name from HSV hue, with brown for dim warm colors and gray or black for unsaturated ones."""
    import colorsys
    r, g, bl = (int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5))
    h, s, v = colorsys.rgb_to_hsv(r, g, bl); h *= 360
    if v < 0.13: return 'black'
    if s < 0.15: return 'gray' if v > 0.3 else 'black'
    if v < 0.22 and s < 0.45: return 'black-brown'
    warm = h < 65 or h >= 345
    if warm and (v < 0.62 or s < 0.45): return 'brown' if h >= 15 or s < 0.6 else 'red-brown'
    if h < 15 or h >= 345: return 'red'
    if h < 40: return 'orange'
    if h < 65: return 'yellow'
    if h < 80: return 'olive' if v < 0.6 else 'yellow-green'
    if h < 170: return 'green'
    if h < 200: return 'cyan'
    if h < 255: return 'blue'
    if h < 290: return 'purple'
    return 'magenta'

def warmth(hexs):
    c = np.array([int(hexs[i:i + 2], 16) / 255 for i in (1, 3, 5)])
    lab = srgb2lab(c)
    return 'warm' if lab[2] > 8 else 'cool' if lab[2] < -3 else 'neutral'

def q(a, f):
    if not a: return None
    b = sorted(a); return b[min(len(b) - 1, int(f * (len(b) - 1) + 0.5))]

def wq(vals, ws, f):
    if not vals: return None
    o = sorted(zip(vals, ws)); tot = sum(w for _, w in o); acc = 0
    for v, w in o:
        acc += w
        if acc >= f * tot: return v
    return o[-1][0]

MATW = [('copper', r'copper|brass|bronze'), ('iron', r'iron|metal|chain|grill|blackmetal'), ('marble', r'marble'),
        ('grausten', r'grausten'), ('stone', r'stone|rock|oven|hearth'), ('cloth', r'cloth|banner|jute|carpet|curtain|cushion'),
        ('hide', r'hide|(?<!ni)fur(?!n)|rug|pelt|skin'), ('glass', r'glass|crystal'), ('straw', r'straw|thatch'), ('ceramic', r'ceramic|pot'),
        ('bone', r'bone|skull'), ('candle', r'candle|wax'), ('wood', r'wood|plank|log|beam|stake|timber')]
def mat_word(s):
    s = s.lower()
    for k, rx in MATW:
        if re.search(rx, s): return k
    return None
GLOW_NOTES = {
    'piece_magetable_ext': 'purple rune glow (Tyler: "blackmarble and purple glowing accents")',
'piece_pot1_cracked': 'red-orange glowing cracks',
    'piece_pot2_cracked': 'red-orange glowing cracks', 'piece_pot3_cracked': 'red-orange glowing cracks',
}

# kind: what the piece is for, from the lab's role plus the game folder
STRUCT = {'wall', 'floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair', 'door', 'window', 'fence'}
def kind_of(n, role, path, m):
    p = m.get('piece') or {}
    if '/Characters/' in path or n.startswith('Spawner') or 'Spawner' in n: return 'creature'
    if '/StatusEffects/' in path or n.startswith('vfx_') or n.startswith('fx_') or n in ('LocationProxy',): return 'effect'
    if '/consumables/' in path or re.match(r'^(Mead|Feast|BarleyWine)', n): return 'food'
    if n.startswith('Pickable_') and not re.search(r'Stone|Flint|Branch|Crystal|Remains|Meteorite|Core|Shard|Dvergr|Hairstrands|MeatPile', n): return 'plant'
    if '/Items/' in path and not p: return 'item'
    if re.search(r'Pickable_|/Vegetation/|/Bush|/Beech|/Birch|/FirTree|/Pine|/Oak|/SwampTree|/Shoots|Fern|vines|Vine', path + n) and not re.search(r'Stone|Flint|Branch|Crystal|Remains|Meteorite|Core', n): return 'plant'
    if re.search(r'Rock|rock|cliff|widestone|Placeable_|bigrock|caverock|MineRock', n): return 'rock'
    if role in STRUCT: return role
    if re.search(r'_ext\d|ext\d_|_ext$', n) and (p.get('m_category') == 1 or 'forge' in n or 'cauldron' in n or 'workbench' in n or 'magetable' in n or 'artisan' in n): return 'station-addon'
    if p.get('m_category') == 1: return 'station'
    if role == 'craft': return 'station'
    if role == 'clutter' or re.search(r'_stack$|_pile$', n): return 'resource-stack'
    if role in ('seat', 'table', 'bed', 'storage', 'light', 'fire', 'rug'): return role
    if re.search(r'banner|cloth_hanging|curtain|drape', n, re.I): return 'hanging-cloth'
    if re.search(r'^itemstand|ArmorStand|WeaponStand', n): return 'display-stand'
    if re.search(r'^sign', n): return 'sign'
    if re.search(r'raven|wolf$|dragon|head|Statue|statue|totem|skull', n): return 'carving'
    if re.search(r'^piece_pot|ashland_pot|bucket|box', n): return 'container-decor'
    if re.search(r'^piece_(xmas|gift|mistletoe|jackoturnip|maypole|.*Garland)', n): return 'seasonal-decor'
    if role == 'deco': return 'decor'
    if role == 'nature': return 'plant'
    return 'misc'

def family_of(n, m, kind):
    for rx, fam in FAMILY_BY_ID:
        if re.search(rx, n): return fam, 'id series ' + rx
    ts = [x.get('tex') for x in m.get('materials', []) if x.get('tex')]
    for t in ts[:1]:
        if t in FAMILY_BY_TEX: return FAMILY_BY_TEX[t], 'texture ' + t
    if kind == 'food': return 'food', 'kind'
    if kind == 'plant': return 'plant', 'kind'
    if kind == 'rock': return 'rock', 'kind'
    if kind == 'resource-stack': return 'resource_stack', 'kind'
    return 'other', ('texture ' + ts[0]) if ts else 'none'

def glow_of(m):
    g = {}
    for L_ in m.get('lights', []):
        if L_.get('color'):
            g['light'] = hexc(L_['color'][:3]); g['range_m'] = L_.get('range'); g['hue'] = hue_word(g['light'])
            break
    em = [x for x in m.get('materials', []) if (x.get('EmissionColor') and sum(x['EmissionColor'][:3]) > 0.05)]
    if em:
        e = em[0]['EmissionColor'][:3]; mx = max(e) or 1
        g['emissive'] = hexc([v / mx for v in e]); g['emissive_hue'] = hue_word(g['emissive']); g['emissive_on'] = em[0].get('name')
        if g['emissive_hue'] == 'gray' and em[0].get('emitTex'): g['emissive_hue'] = 'from map ' + em[0]['emitTex']
    if m.get('particles'): g['particles'] = m['particles']
    return g or None

def size_class(sz):
    mx = max(sz)
    return 'tiny' if mx < 0.35 else 'small' if mx < 0.8 else 'medium' if mx < 1.6 else 'large' if mx < 3.2 else 'huge'

AX = ['+x', '-x', '+z', '-z']
OPP = {'+x': '-x', '-x': '+x', '+z': '-z', '-z': '+z'}

def facing(n, s, kind, md):
    """Front side in the piece's own frame. Sources: the side corpus builders put against a wall (the back), and the
    side the mesh's tall part sits on (backrests, headboards)."""
    res = {}
    if s and s.get('dirB'):
        d = s['dirB']; tot = sum(d)
        if tot > 0:
            i = int(np.argmax(d)); share = d[i] / tot
            back = AX[i]
            res['corpus_back'] = back; res['corpus_share'] = round(share, 2); res['corpus_builds'] = s.get('dirBn', 0)
    if md and md.get('top') and kind in ('seat', 'bed', 'storage', 'light', 'display-stand', 'carving', 'station', 'station-addon', 'table', 'sign', 'decor'):
        tx, tz = md['top']
        if max(abs(tx), abs(tz)) >= 0.3:
            side = ('+x' if tx > 0 else '-x') if abs(tx) > abs(tz) else ('+z' if tz > 0 else '-z')
            res['mesh_tall_side'] = side
    back, sure = None, 'unknown'
    cb, cs, cn = res.get('corpus_back'), res.get('corpus_share', 0), res.get('corpus_builds', 0)
    mt = res.get('mesh_tall_side')
    if kind in ('seat', 'bed') and mt:
        back = mt
        sure = 'high' if (cb == mt and cs >= 0.4) else 'medium'
        if kind == 'bed': res['note'] = 'back = headboard end'
    elif cb and cs >= 0.55 and cn >= 10:
        back, sure = cb, 'high' if cs >= 0.7 and cn >= 25 else 'medium'
    elif cb and cs >= 0.4 and cn >= 5:
        back, sure = cb, 'low'
    if back:
        res['back'] = back; res['front'] = OPP[back]
    res['sure'] = sure
    return res

# piece pairs from the corpus pass: [builds with both, builds where both stand under cover within 4 m and 1.5 m height]
NB_PAIRS = {}
for k_, e_ in stats.get('pairs', {}).items():
    a_, b_ = k_.split('|')
    NB_PAIRS.setdefault(a_, []).append((b_, e_[0], e_[1]))
    NB_PAIRS.setdefault(b_, []).append((a_, e_[0], e_[1]))
NOPAIR = {'wall', 'floor', 'roof', 'roofTop', 'roofCorner', 'gable', 'beam', 'pole', 'stair', 'door', 'window', 'fence', 'creature', 'effect', 'rock'}
def pair_lists(n, kinds):
    rows = [(o, both, area) for o, both, area in NB_PAIRS.get(n, []) if kinds.get(o) and kinds[o] not in NOPAIR and both >= 8]
    if not rows: return None, None
    tot_b = sum(r[1] for r in rows); tot_a = sum(r[2] for r in rows)
    base = tot_a / tot_b if tot_b else 0
    good = sorted([r for r in rows if r[2] >= 4 and r[2] / r[1] >= max(0.2, 1.5 * base)], key=lambda r: -r[2])[:8]
    rare = sorted([r for r in rows if r[1] >= 30 and r[2] / r[1] <= 0.25 * max(base, 0.04)], key=lambda r: -r[1])[:8]
    fmt = lambda r: {'id': r[0], 'builds_both': r[1], 'same_area': r[2], 'rate': round(r[2] / r[1], 2)}
    return [fmt(r) for r in good], [fmt(r) for r in rare]

# per-build size, for counts per 100 m2 of floor
BUILD = BS
out = {}
for n, s in ST.items():
    m = meta(n)
    path = m.get('path', '')
    p = m.get('piece') or {}
    it = m.get('item') or {}
    role = s['role']
    kind = kind_of(n, role, path, m)
    fam, fam_src = family_of(n, m, kind)
    F = FAMILIES[fam]
    key = (p.get('m_name') or it.get('m_name') or '').lstrip('$')
    game_name = EN.get(key) or None
    # colors: measured mesh first, then the icon, then the texture thumbnail with the material tint
    col = COL.get(n); csrc = 'mesh' if col else None
    if col and any(x.get('tex') in ('transparent',) for x in m.get('materials', [])): col = None
    icon = os.path.join(L, 'icons', n + '.png')
    icol = img_colors(icon) if os.path.exists(icon) else None
    if not col:
        mats = [x for x in m.get('materials', []) if x.get('tex')]
        if mats:
            tf = os.path.join(L, 'tex', mats[0]['tex'] + '.png')
            if os.path.exists(tf):
                col = img_colors(tf, mats[0].get('Color')); csrc = 'texture'
        if not col and icol:
            col = icol; csrc = 'icon'
    look = None
    if col:
        main = col['swatches'][0]['hex'] if col.get('swatches') else col['mean']
        look = {'mean': col['mean'], 'swatches': [{'hex': w['hex'], 'share': w['share']} for w in col.get('swatches', [])][:4],
                'L': col['L'], 'value': value_word(col['L']), 'hue': hue_word(col['mean']), 'warmth': warmth(col['mean']),
                'chroma': col.get('chroma'), 'saturation': 'muted' if (col.get('chroma') or 0) < 18 else 'colored' if (col.get('chroma') or 0) < 40 else 'vivid',
                'source': csrc}
        if col.get('parts') and len(col['parts']) > 1:
            look['parts'] = [{'mat': x['mat'], 'hex': x['hex'], 'share': x['share']} for x in col['parts'][:4]]
        if icol and csrc != 'icon':
            look['icon_mean'] = icol['mean']
    glow = glow_of(m)
    if n in GLOW_NOTES: glow = dict(glow or {}, note=GLOW_NOTES[n])
    mix = {}
    for prt in (COL.get(n, {}).get('parts') or []):
        if prt.get('tex') == 'transparent': continue  # the armor stand's invisible body
        k = mat_word(prt['mat'] + ' ' + (prt.get('tex') or ''))
        if k: mix[k] = round(mix.get(k, 0) + prt['share'], 2)
    mats = sorted({x.get('name') for x in m.get('materials', []) if x.get('name') and not x['name'].startswith('snow')})
    texs = sorted({x.get('tex') for x in m.get('materials', []) if x.get('tex')})
    metal = any((x.get('f') or {}).get('Metallic', 0) > 0.5 for x in m.get('materials', []))
    gloss = max([(x.get('f') or {}).get('Glossiness', 0) for x in m.get('materials', [])] or [0])
    size = COL.get(n, {}).get('size') or (MD.get(n) and [round(MD[n]['hi'][i] - MD[n]['lo'][i], 2) for i in range(3)])
    # placement from the corpus: per build shares, averaged with vote weights (each build counts once)
    pb = s.get('pb') or []
    place = None
    if pb:
        ws = [r[0] for r in pb]; tw = sum(ws)
        avg = lambda i: round(sum(r[0] * r[i] for r in pb) / tw, 2)
        hfs = [r[10] for r in pb if r[10] is not None]
        place = {'covered': avg(1), 'on_roof': avg(2), 'by_gable_outside': avg(3), 'yard_ground': avg(4), 'open_deck': avg(5),
                 'against_wall': avg(6), 'wall_hung': avg(7), 'under_ceiling': avg(8), 'on_furniture': avg(9),
                 'height_m': {'p10': round(q(hfs, 0.1), 2) if hfs else None, 'median': round(q(hfs, 0.5), 2) if hfs else None, 'p90': round(q(hfs, 0.9), 2) if hfs else None},
                 'builds': len(pb)}
    elif s.get('cov') is not None and s['n']:
        place = {'covered': round(s['cov'] / s['n'], 2), 'builds': s['builds']}
    # where it belongs, in words
    zone, mount = None, None
    if place and place.get('builds', 0) >= 3:
        cv = place['covered']; rf = place.get('on_roof', 0) + place.get('by_gable_outside', 0) * 0.5; yd = place.get('yard_ground', 0)
        if rf >= 0.3: zone = 'roof and gable outside'
        elif cv >= 0.75: zone = 'indoors'
        elif cv <= 0.3 and yd >= 0.3: zone = 'yard and grounds'
        elif cv <= 0.35: zone = 'outdoors'
        else: zone = 'indoors or outdoors'
        if 'wall_hung' in place:
            if place['wall_hung'] >= 0.45: mount = 'wall-hung'
            elif place.get('under_ceiling', 0) >= 0.3: mount = 'ceiling-hung'
            elif place.get('on_furniture', 0) >= 0.3: mount = 'on furniture'
            elif place['height_m']['median'] is not None and place['height_m']['median'] < 0.6: mount = 'floor-standing'
            else: mount = 'raised or mixed'
    # reuse: share of builds using it, and how many when used (unweighted and vote-weighted)
    per = s.get('per') or []
    ks = [e[0] for e in per]; kw = [e[1] for e in per]
    dens = []
    for k_, w_, bi in per:
        fa = BUILD[bi]['floorA'] or BUILD[bi]['foot']
        if fa >= 20: dens.append(100 * k_ / fa)
    share = s['builds'] / NB
    wshare = s['wshare']
    tier = 'staple' if share >= 0.2 else 'common' if share >= 0.08 else 'occasional' if share >= 0.025 else 'rare' if s['builds'] >= 5 else 'very rare'
    reuse = {'builds': s['builds'], 'share': round(share, 3), 'vote_share': round(wshare, 3), 'placements': s['n'],
             'per_build': {'p50': q(ks, 0.5), 'p75': q(ks, 0.75), 'p90': q(ks, 0.9), 'max': max(ks) if ks else None,
                           'vote_p50': wq(ks, kw, 0.5), 'vote_p90': wq(ks, kw, 0.9)},
             'per_100m2_floor': {'p50': round(q(dens, 0.5), 2) if dens else None, 'p90': round(q(dens, 0.9), 2) if dens else None},
             'tier': tier}
    if n in SHOW: reuse['showcase'] = SHOW[n]
    # build kinds it shows up in more than its base rate
    cats = s.get('cats', {})
    kinds = []
    for c, k_ in cats.items():
        base = stats['catCount'].get(c, 1) / NB
        lift = (k_ / s['builds']) / base if s['builds'] else 0
        if k_ >= 3 and lift >= 1.4: kinds.append([c, k_, round(lift, 1)])
    kinds.sort(key=lambda x: -x[2])
    face = facing(n, s, kind, MD.get(n)) if kind not in STRUCT and kind not in ('plant', 'rock', 'food', 'creature', 'effect', 'item') else None
    name = NAMES.get(n)
    name_src = 'ours' if name else 'game' if game_name else 'id'
    if not name:
        name = (game_name or re.sub(r'([a-z])([A-Z])', r'\1 \2', n).replace('_', ' ')).lower()
    buildable = bool(p) and '/GameElements/Pieces' in path
    tags = set()
    tags.add('kind:' + kind); tags.add('family:' + fam); tags.add('material:' + F[1])
    if look: tags.update(['value:' + look['value'].replace(' ', '-'), 'hue:' + look['hue'], 'warmth:' + look['warmth'], 'saturation:' + look['saturation']])
    if glow:
        if glow.get('light'): tags.add('light:' + glow['hue'])
        if glow.get('emissive'): tags.add('glow:' + glow['emissive_hue'])
    if zone: tags.add('zone:' + zone.split(' ')[0])
    if mount: tags.add('mount:' + mount.split(' ')[0])
    tags.add('reuse:' + tier.replace(' ', '-'))
    tags.add('formality:' + ['rough', 'plain', 'fine', 'grand'][F[3] - 1])
    if size: tags.add('size:' + size_class(size))
    if metal: tags.add('finish:metallic')
    if gloss >= 0.5: tags.add('finish:glossy')
    if p.get('m_comfort'): tags.add('comfort:%d' % p['m_comfort'])
    if not buildable: tags.add('not-buildable')
    if n in GEN: tags.add('generator')
    rec = {
        'id': n, 'name': name, 'name_src': name_src, 'game_name': game_name,
        'kind': kind, 'lab_role': role, 'family': fam, 'family_label': F[0], 'family_src': fam_src,
        'material': (max(mix, key=mix.get) if mix and sum(mix.values()) >= 0.6 else F[1]), 'material_mix': mix or None, 'finish': F[2], 'formality': F[3], 'tier_biome': F[4],
        'look': look, 'glow': glow, 'materials': mats[:6], 'textures': texs[:6],
        'size_m': size, 'size_class': size_class(size) if size else None,
        'zone': zone, 'mount': mount, 'placement': place, 'reuse': reuse, 'build_kinds': kinds[:6],
        'facing': face, 'buildable': buildable, 'game_tab': p.get('m_category'), 'comfort': p.get('m_comfort') or 0,
        'comfort_group': p.get('m_comfortGroup') or 0, 'generator_files': GEN.get(n), 'tags': sorted(tags),
    }
    out[n] = rec

# Track B's room-level pairs (tools/blueprint-lab/data/rooms-corpus/pairs.json on design/wip-corpus-rooms), when present
BP = os.environ.get('ROOM_PAIRS', '/home/claude/wt/corpus-rooms/tools/blueprint-lab/data/rooms-corpus/pairs.json')
ROOMP = json.load(open(BP)).get('items', {}) if os.path.exists(BP) else {}
for n, it in ROOMP.items():
    if n not in out: continue
    out[n]['room_pairs'] = {'rooms': it.get('rooms'), 'pairs_well_with': [{'id': a, 'rooms': r, 'expected': e, 'lift': l} for a, r, e, l in (it.get('pairsWellWith') or [])[:10]],
                            'rarely_with': [{'id': a, 'rooms': r, 'expected': e, 'lift': l} for a, r, e, l in (it.get('rarelyWith') or [])[:10]],
                            'source': 'track B rooms-corpus/pairs.json (room level)'}

KINDS = {k: v['kind'] for k, v in out.items()}
for n, rec in out.items():
    if rec['kind'] not in NOPAIR and rec['kind'] not in ('plant', 'item'):
        g, r = pair_lists(n, KINDS)
        if g: rec['pairs_with'] = g
        if r: rec['rarely_with'] = r
    # a plain description of the look, from the measured colors and the family
    lk = rec['look']; F = FAMILIES[rec['family']]
    parts = []
    if lk: parts.append('%s %s' % (lk['value'], lk['hue']))
    parts.append(rec['material'].replace('+', ' and '))
    if F[2]: parts.append('(' + F[2] + ')')
    d = ' '.join(parts)
    if rec['glow']:
        gl = rec['glow']
        if gl.get('note'): d += '; ' + gl['note']
        elif gl.get('light'): d += '; gives %s light' % gl['hue']
        elif gl.get('emissive'): d += '; %s glow' % gl['emissive_hue']
    rec['description'] = DESC.get(n, d)

doc = {
    'about': 'Villheim piece catalog: one record per vanilla prefab placed in the corpus (compact.json, 2,128 builds) or by the generator. '
             'Built by data/catalog/tools/build_catalog.py; fields in data/catalog/README.md, method in docs/PIECE_CATALOG.md.',
    'version': 1, 'corpus_builds': NB, 'families': {k: {'label': v[0], 'material': v[1], 'finish': v[2], 'formality': v[3], 'biome': v[4], 'look': v[5]} for k, v in FAMILIES.items()},
    'pieces': dict(sorted(out.items())),
}
json.dump(doc, open(OUT, 'w'), indent=None, separators=(',', ':'))
print(len(out), 'pieces', os.path.getsize(OUT), 'bytes')
