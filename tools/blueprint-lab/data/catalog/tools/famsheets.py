import json, os, sys
from PIL import Image, ImageDraw, ImageFont
C = json.load(open('/tmp/catalog/pieces.json'))['pieces']
L = '/tmp/catalog/look'
font = ImageFont.load_default()
STRUCT = {'wall','floor','roof','roofTop','roofCorner','gable','beam','pole','stair','door','window','fence'}
mode = sys.argv[1]; minb = int(sys.argv[2])
sel = [r for r in C.values() if r['reuse']['builds'] >= minb and ((r['kind'] in STRUCT) == (mode == 'struct')) and r['kind'] not in ('creature','effect','item','food','plant','rock')]
sel.sort(key=lambda r: (r['family'], -r['reuse']['builds']))
COLS, CW, CH, per = 8, 150, 128, 48
for s in range(0, len(sel), per):
    ch = sel[s:s+per]; rows = (len(ch)+COLS-1)//COLS
    img = Image.new('RGB', (COLS*CW, rows*CH), (40, 40, 44)); d = ImageDraw.Draw(img)
    for i, r in enumerate(ch):
        x, y = (i % COLS)*CW, (i//COLS)*CH; n = r['id']
        ic = f'{L}/icons/{n}.png'
        if os.path.exists(ic):
            im = Image.open(ic).convert('RGBA').resize((80, 80)); img.paste(im, (x+4, y+4), im)
        elif r['textures']:
            tf = f"{L}/tex/{r['textures'][0]}.png"
            if os.path.exists(tf): im = Image.open(tf).convert('RGB').resize((80, 80)); img.paste(im, (x+4, y+4)); d.text((x+6, y+6), 'tex', fill=(255,255,0), font=font)
        if r['look']:
            for j, sw in enumerate(r['look']['swatches'][:4]): d.rectangle([x+88, y+4+j*20, x+146, y+22+j*20], fill=sw['hex'])
        d.text((x+3, y+86), n[:24], fill=(235,235,235), font=font)
        d.text((x+3, y+99), r['name'][:24], fill=(170,210,255), font=font)
        d.text((x+3, y+112), r['family'][:24], fill=(255,200,120), font=font)
    img.save(f'/tmp/catalog/sheets/fam_{mode}_{s//per:02d}.png')
print(len(sel))
