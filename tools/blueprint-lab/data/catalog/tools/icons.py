#!/usr/bin/env python3
"""Piece icons, main textures and look facts (materials, emission, lights, particles) for a list of prefabs.
    python3 icons.py index <Valheim_Data> <work>
    python3 icons.py run <Valheim_Data> <work> <names.txt> [seconds]
Reads the game files only; writes <work>/icons/<name>.png, <work>/tex/<tex>.png (128 px), <work>/meta/<name>.json."""
import json, os, sys, time

def build_index(data_dir, work):
    man = os.path.join(data_dir, 'StreamingAssets/SoftRef/manifest_extended')
    deps, idx, cur, sect, asset = {}, {}, None, None, None
    with open(man, encoding='utf-8-sig') as f:
        for line in f:
            line = line.rstrip('\r\n')
            if line.startswith('bundle dependencies'): sect = 'deps'; continue
            if line.startswith('asset locations'): sect = 'assets'; continue
            if sect == 'deps':
                if line.startswith('- bundle: '): cur = line[10:].strip(); deps[cur] = []
                elif line.startswith('  - ') and cur: deps[cur].append(line[4:].strip())
            elif sect == 'assets':
                if line.startswith('  bundle: '): asset = line[10:].strip()
                elif line.startswith('  path in bundle: '):
                    p = line[18:].strip()
                    if p.endswith('.prefab'):
                        idx.setdefault(p.rsplit('/', 1)[-1][:-7], []).append([asset, p])
    for name, c in idx.items():
        c.sort(key=lambda c: (0 if '/GameElements/Pieces/' in c[1] else 1 if '/GameElements/' in c[1] else 2, len(c[1])))
    os.makedirs(work, exist_ok=True)
    json.dump({'deps': deps, 'prefabs': idx}, open(os.path.join(work, 'index.json'), 'w'))
    print('prefabs', len(idx))

def col(v):
    try: return [round(v.r, 3), round(v.g, 3), round(v.b, 3), round(v.a, 3)]
    except Exception: return None

def nodes(go):
    out, st = [], [go]
    while st:
        g = st.pop(); out.append(g)
        try:
            tr = None
            for c in g.m_Component:
                o = c.component.deref()
                if o.type.name in ('Transform', 'RectTransform'): tr = o.read(); break
            for ch in (tr.m_Children if tr else []):
                st.append(ch.read().m_GameObject.read())
        except Exception: pass
    return out

def save_tex(ptr, work, done):
    try:
        t = ptr.read(); nm = t.m_Name
        if nm in done: return nm
        f = os.path.join(work, 'tex', nm + '.png')
        if not os.path.exists(f):
            img = t.image.convert('RGBA'); img.thumbnail((128, 128)); img.save(f)
        done.add(nm); return nm
    except Exception as e:
        return None

def material(mp, work, done):
    m = mp.read(); d = {'name': m.m_Name}
    try: d['shader'] = m.m_Shader.read().m_Name
    except Exception: pass
    sp = m.m_SavedProperties
    for k, v in sp.m_TexEnvs:
        if v.m_Texture.m_PathID != 0 and k in ('_MainTex', '_BaseMap', '_EmissionMap', '_EmissiveTex', '_EmissionTex', '_BumpMap'):
            if k == '_BumpMap': d['normal'] = True; continue
            nm = save_tex(v.m_Texture, work, done) if k in ('_MainTex', '_BaseMap') else None
            if k in ('_MainTex', '_BaseMap'): d['tex'] = nm
            else:
                try: d['emitTex'] = v.m_Texture.read().m_Name
                except Exception: d['emitTex'] = '?'
    for k, v in sp.m_Colors:
        if k in ('_Color', '_BaseColor', '_EmissionColor', '_EmissiveColor', '_SnowColor', '_ColorTint'):
            d[k.strip('_')] = col(v)
    fl = {}
    for k, v in sp.m_Floats:
        if k in ('_Glossiness', '_Metallic', '_EmissionStrength', '_Snow', '_Cutoff', '_RippleDistance'): fl[k.strip('_')] = round(v, 3)
    if fl: d['f'] = fl
    try: d['kw'] = m.m_ValidKeywords if hasattr(m, 'm_ValidKeywords') else m.m_ShaderKeywords
    except Exception: pass
    return d

def do(env, root, name, work, done):
    res = {'name': name, 'materials': [], 'lights': [], 'particles': 0, 'piece': None, 'scripts': []}
    seen = set()
    for g in nodes(root):
        for c in g.m_Component:
            try: o = c.component.deref()
            except Exception: continue
            t = o.type.name
            if t in ('MeshRenderer', 'SkinnedMeshRenderer'):
                try:
                    r = o.read()
                    if not getattr(r, 'm_Enabled', True): continue
                    for mp in r.m_Materials:
                        if mp.m_PathID in seen: continue
                        seen.add(mp.m_PathID)
                        try:
                            md = material(mp, work, done); md['go'] = g.m_Name; res['materials'].append(md)
                        except Exception: pass
                except Exception: pass
            elif t == 'Light':
                try:
                    L = o.read(); res['lights'].append({'go': g.m_Name, 'color': col(L.m_Color), 'intensity': round(L.m_Intensity, 2), 'range': round(L.m_Range, 2)})
                except Exception: res['lights'].append({'go': g.m_Name})
            elif t == 'ParticleSystem':
                res['particles'] += 1
            elif t == 'MonoBehaviour':
                try:
                    tt = o.read_typetree()
                except Exception:
                    continue
                try:
                    sc = o.read().m_Script.read().m_ClassName
                except Exception:
                    sc = '?'
                res['scripts'].append(sc)
                if 'm_icon' in tt and 'm_category' in tt and res['piece'] is None:
                    p = {k: tt[k] for k in ('m_name', 'm_description', 'm_category', 'm_comfort', 'm_comfortGroup', 'm_groundPiece', 'm_groundOnly', 'm_cultivatedGroundOnly', 'm_waterPiece', 'm_noInWater', 'm_notOnFloor', 'm_onlyInTeleportArea', 'm_allowedInDungeons', 'm_canBeRemoved', 'm_allowRotatedOverlap', 'm_vegetationGroundOnly', 'm_inCeilingOnly', 'm_notOnWood', 'm_notOnTiltingSurface', 'm_spaceRequirement', 'm_clipGround', 'm_clipEverything', 'm_harvest', 'm_dlc', 'm_craftingStation') if k in tt and not isinstance(tt[k], dict)}
                    try:
                        mb = o.read(); spr = mb.m_icon.read(); img = spr.image
                        img.save(os.path.join(work, 'icons', name + '.png')); p['icon'] = list(img.size)
                    except Exception as e:
                        p['icon_error'] = repr(e)[:120]
                    try:
                        rq = []
                        for r in tt.get('m_resources', []):
                            try:
                                rq.append([r.get('m_amount'), r.get('m_resItem', {}).get('m_PathID')])
                            except Exception: pass
                        p['n_res'] = len(rq)
                    except Exception: pass
                    res['piece'] = p
                if 'm_itemData' in tt and res.get('item') is None:
                    try:
                        sh = tt['m_itemData']['m_shared']; res['item'] = {'m_name': sh.get('m_name'), 'type': sh.get('m_itemType')}
                        mb = o.read(); spr = mb.m_itemData.m_shared.m_icons[0].read(); img = spr.image
                        img.save(os.path.join(work, 'icons', name + '.png')); res['item']['icon'] = list(img.size)
                    except Exception as e:
                        res.setdefault('item', {})['icon_error'] = repr(e)[:120]
    return res

def run(data_dir, work, names_file, seconds=160):
    import UnityPy
    t0 = time.time()
    idx = json.load(open(os.path.join(work, 'index.json')))
    for d in ('icons', 'tex', 'meta'): os.makedirs(os.path.join(work, d), exist_ok=True)
    names = [n.strip() for n in open(names_file) if n.strip()]
    todo = {}
    for n in names:
        if os.path.exists(os.path.join(work, 'meta', n + '.json')): continue
        c = idx['prefabs'].get(n)
        if not c:
            json.dump({'name': n, 'error': 'not in index'}, open(os.path.join(work, 'meta', n + '.json'), 'w')); continue
        todo.setdefault(c[0][0], []).append((n, c[0][1]))
    done = set(f[:-4] for f in os.listdir(os.path.join(work, 'tex')))
    bdir = os.path.join(data_dir, 'StreamingAssets/SoftRef/Bundles')
    while todo and time.time() - t0 < seconds:
        bundle, items = max(todo.items(), key=lambda kv: len(kv[1]))
        files = [os.path.join(bdir, bundle)] + [os.path.join(bdir, d) for d in idx['deps'].get(bundle, [])]
        env = UnityPy.load(*files); cont = env.container
        print('loaded', bundle, len(items), round(time.time() - t0, 1), flush=True)
        for n, p in list(items):
            if time.time() - t0 > seconds: break
            json.dump({'name': n, 'error': 'crashed'}, open(os.path.join(work, 'meta', n + '.json'), 'w'))
            try: res = do(env, cont[p].read(), n, work, done); res['path'] = p
            except Exception as e: res = {'name': n, 'path': p, 'error': repr(e)[:300]}
            json.dump(res, open(os.path.join(work, 'meta', n + '.json'), 'w'))
            items.remove((n, p))
        if not items: del todo[bundle]
    print('left', sum(len(v) for v in todo.values()), round(time.time() - t0, 1))

if __name__ == '__main__':
    if sys.argv[1] == 'index': build_index(sys.argv[2], sys.argv[3])
    else: run(sys.argv[2], sys.argv[3], sys.argv[4], float(sys.argv[5]) if len(sys.argv) > 5 else 160)
