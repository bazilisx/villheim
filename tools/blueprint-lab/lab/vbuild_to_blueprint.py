# Turn .vbuild files (one piece per line: name rx ry rz rw x y z, single spaces, comma decimals, blank for 0)
# into PlanBuild .blueprint files so the corpus reader can use them.
# Usage: python3 lab/vbuild_to_blueprint.py <folder with category subfolders of .vbuild> <corpus vh folder>
# A design already present as a .blueprint (same slug before "__") is skipped.
import glob
import os
import sys

src, dst = sys.argv[1], sys.argv[2]


def num(s):
    s = s.strip()
    return 0.0 if s in ('', '-') else float(s.replace(',', '.'))


have = set()
for d, _, fs in os.walk(dst):
    for f in fs:
        if f.endswith('.blueprint'):
            have.add(f.split('__')[0])

written = skipped = 0
for p in glob.glob(os.path.join(src, '*', '*.vbuild')):
    cat = os.path.basename(os.path.dirname(p))
    slug = os.path.basename(p)[:-len('.vbuild')]
    if slug in have:
        skipped += 1
        continue
    rows = []
    for line in open(p, encoding='utf-8-sig', errors='replace'):
        t = line.rstrip('\r\n').split(' ')
        if len(t) != 8 or not t[0]:
            continue
        try:
            rx, ry, rz, rw, x, y, z = map(num, t[1:])
        except ValueError:
            continue
        rows.append(f'{t[0]};;{x:.5f};{y:.5f};{z:.5f};{rx:.6f};{ry:.6f};{rz:.6f};{rw:.6f};"";1;1;1')
    if not rows:
        continue
    os.makedirs(os.path.join(dst, cat), exist_ok=True)
    with open(os.path.join(dst, cat, f'{slug}__vbuild.blueprint'), 'w') as f:
        f.write(f'#Name:{slug}\n#Creator:valheimians\n#Description:""\n#Category:{cat}\n'
                '#SnapPoints\n#Terrain\n#Pieces\n' + '\n'.join(rows) + '\n')
    written += 1
print('written', written, 'skipped', skipped)
