// One house for six households (or six layouts) as ground floor plans side by side.
// Usage, from tools/blueprint-lab: node lab/households_sheet.js <type> <biome> <s1-3> <d1-3> <seed> households|layouts <out.png>
const L=require('path').join(__dirname, '../')+'/';
const G=require(L+'lib/generate.js'),R=require(L+'lib/render.js'),PC=require(L+'lib/pieces.js');
const {createCanvas}=require(L+'node_modules/@napi-rs/canvas');
const [type,biome,stage,decor,seed,mode,out]=process.argv.slice(2);
const HH=['neat','messy','cosy','plants','crafts','collector'];
const reqs=HH.map((h,i)=>mode==='layouts'?{type,biome,stage,decor,seed:+seed,layout:{seed:i+1},yard:false,label:'layout '+(i+1)}:{type,biome,stage,decor,seed:+seed,persona:h,yard:false,label:h});
const tiles=[];
for (const q of reqs){ const d=G.generate(q); const fl=d.pieces.filter(p=>PC.piece(p.name).role==='floor').map(p=>p.y).sort((a,b)=>a-b); const f0=fl.length?fl[0]:0;
 const shell=d.pieces.filter(p=>PC.piece(p.name).structural); const sz=R.planSize(shell,{ppm:40}); const c=createCanvas(sz.width,sz.height);
 R.plan(c.getContext('2d'),d.pieces,{cut:f0+1.9,ppm:40,crop:sz.crop,background:'#e9e4d8',ss:2});
 const furn=d.pieces.filter(p=>p.decor&&Math.abs(p.y-f0)<2.5).length; tiles.push({c,label:q.label+' ('+furn+')',meta:d.meta}); }
const W=Math.max(...tiles.map(t=>t.c.width)),H=Math.max(...tiles.map(t=>t.c.height))+24, cols=3;
const S=createCanvas(W*cols,H*Math.ceil(tiles.length/cols)); const g=S.getContext('2d'); g.fillStyle='#fff'; g.fillRect(0,0,S.width,S.height);
tiles.forEach((t,i)=>{ const x=(i%cols)*W,y=Math.floor(i/cols)*H; g.drawImage(t.c,x,y+24); g.fillStyle='#222'; g.font='18px sans-serif'; g.fillText(t.label,x+6,y+18); });
require('fs').writeFileSync(out,S.toBuffer('image/png')); console.log('ok', tiles.map(t=>t.label).join(', '));
