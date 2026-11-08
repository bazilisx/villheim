"""Sort valheimians downloads into Downloads/Villheim-blueprints/<category>/.

Usage: python3 sort_downloads.py [downloads folder]   (default ~/Downloads)

The download job in the browser saves each build as vh__<category>__<slug>.bin and the build list as
vh__index.json (and vh__index-keywords.json for the keyword search). A .bin is a PlanBuild blueprint (#Name...),
a zip of several (each .blueprint or .vbuild inside is unpacked beside it), the game's own .vbuild text, or an
error page (kept apart in _errors).
"""
import os, shutil, sys, zipfile

D = os.path.expanduser(sys.argv[1] if len(sys.argv) > 1 else '~/Downloads')
OUT = os.path.join(D, 'Villheim-blueprints')
os.makedirs(OUT, exist_ok=True)
stats = {}
for f in sorted(os.listdir(D)):
    p = os.path.join(D, f)
    if f.startswith('vh__index') and f.endswith('.json'):
        shutil.move(p, os.path.join(OUT, f[4:]))  # index.json, index-keywords.json
        continue
    if f.startswith('vhtest'):
        os.makedirs(os.path.join(OUT, '_tests'), exist_ok=True)
        shutil.move(p, os.path.join(OUT, '_tests', f))
        continue
    if not (f.startswith('vh__') and f.endswith('.bin')):
        continue
    _, cat, slug = f[:-4].split('__', 2)
    cd = os.path.join(OUT, cat)
    os.makedirs(cd, exist_ok=True)
    head = open(p, 'rb').read(4)
    if head.startswith(b'#'):
        shutil.move(p, os.path.join(cd, slug + '.blueprint')); k = 'blueprint'
    elif head.startswith(b'PK'):
        try:
            z = zipfile.ZipFile(p); n = 0
            for m in z.namelist():
                if m.lower().endswith(('.blueprint', '.vbuild')) and not m.endswith('/'):
                    with open(os.path.join(cd, slug + '__' + os.path.basename(m)), 'wb') as o:
                        o.write(z.read(m))
                    n += 1
            z.close()
            shutil.move(p, os.path.join(cd, slug + '.zip')); k = 'zip with %d' % min(n, 9)
        except Exception:
            shutil.move(p, os.path.join(cd, slug + '.bad.zip')); k = 'bad zip'
    elif head.startswith(b'<!') or head.startswith(b'<h'):
        os.makedirs(os.path.join(OUT, '_errors'), exist_ok=True)
        shutil.move(p, os.path.join(OUT, '_errors', slug + '.html')); k = 'error page'
    else:
        shutil.move(p, os.path.join(cd, slug + '.vbuild')); k = 'vbuild'
    stats[k] = stats.get(k, 0) + 1
print(stats)
