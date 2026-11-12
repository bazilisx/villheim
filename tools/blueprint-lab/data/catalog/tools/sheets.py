import json, os, sys
from PIL import Image, ImageDraw, ImageFont
st = json.load(open('/tmp/catalog/stats.json'))['pieces']
col = json.load(open('/tmp/catalog/colors.json'))
L = '/tmp/catalog/look'
def meta(n):
    f = f'{L}/meta/{n}.json'
    return json.load(open(f)) if os.path.exists(f) else {}
names = sorted(st, key=lambda n: -st[n]['builds'])
# group by main texture so sheets show families together
def tex(n):
    ts = [m.get('tex') for m in meta(n).get('materials', []) if m.get('tex')]
    return ts[0] if ts else 'zz'
names = [n for n in names if st[n]['builds'] >= int(sys.argv[1])]
order = sorted(names, key=lambda n: (tex(n), -st[n]['builds']))
font = ImageFont.load_default()
W, H, CW, CH, COLS = 1200, 0, 150, 120, 8
per = 48
for s in range(0, len(order), per):
    chunk = order[s:s + per]
    rows = (len(chunk) + COLS - 1) // COLS
    img = Image.new('RGB', (COLS * CW, rows * CH), (40, 40, 44))
    d = ImageDraw.Draw(img)
    for i, n in enumerate(chunk):
        x, y = (i % COLS) * CW, (i // COLS) * CH
        ic = f'{L}/icons/{n}.png'
        if os.path.exists(ic):
            im = Image.open(ic).convert('RGBA').resize((80, 80)); img.paste(im, (x + 4, y + 4), im)
        else:
            t = tex(n); tf = f'{L}/tex/{t}.png'
            if os.path.exists(tf):
                im = Image.open(tf).convert('RGB').resize((80, 80)); img.paste(im, (x + 4, y + 4)); d.text((x + 6, y + 6), 'tex', fill=(255, 255, 0), font=font)
        c = col.get(n)
        if c:
            for j, sw in enumerate(c['swatches'][:4]):
                d.rectangle([x + 88, y + 4 + j * 20, x + 146, y + 22 + j * 20], fill=sw['hex'])
        d.text((x + 3, y + 88), n[:24], fill=(230, 230, 230), font=font)
        d.text((x + 3, y + 102), (tex(n) or '')[:24], fill=(150, 150, 160), font=font)
    img.save(f'/tmp/catalog/sheets/sheet_{s // per:02d}.png')
print(len(order), (len(order) + per - 1) // per)
