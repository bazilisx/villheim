// Four views (roof cut off) and a ground floor plan of one design, for judging rooms by eye.
// Usage, from tools/blueprint-lab: node lab/render_views.js lib <type> <biome> <stage> <decor> <seed> <out.png> [culture]
const L=require('path').resolve(process.argv[2])+'/';
const G=require(L+'generate.js'),R=require(L+'render.js'),PC=require(L+'pieces.js');
const {createCanvas}=require(require('path').join(__dirname, '../node_modules/@napi-rs/canvas'));
const [,, ,type,biome,stage,decor,seed,out,culture]=process.argv;
const d=G.generate({type,biome,stage,decor,seed:+seed,culture:culture||undefined,yard:false});
const fl=d.pieces.filter(p=>PC.piece(p.name).role==='floor').map(p=>p.y).sort((a,b)=>a-b);const f0=fl.length?fl[0]:0;
const tiles=[];
for(const v of [{az:35,el:55,cut:f0+2.6},{az:215,el:55,cut:f0+2.6},{az:125,el:40,cut:f0+2.6},{az:305,el:40,cut:f0+2.6}]){const c=createCanvas(700,520);R.draw(c.getContext('2d'),d.pieces,{width:700,height:520,az:v.az,el:v.el,cut:v.cut,background:'#e9e4d8',ss:1});tiles.push(c)}
const shell=d.pieces.filter(p=>PC.piece(p.name).structural);const sz=R.planSize(shell,{ppm:34});const pc=createCanvas(sz.width,sz.height);R.plan(pc.getContext('2d'),d.pieces,{cut:f0+1.9,ppm:34,crop:sz.crop,background:'#e9e4d8',ss:2});
const W=Math.max(1400,pc.width),H=1040+pc.height+30;const S=createCanvas(W,H);const g=S.getContext('2d');g.fillStyle='#fff';g.fillRect(0,0,W,H);
tiles.forEach((t,i)=>g.drawImage(t,(i%2)*700,Math.floor(i/2)*520));g.drawImage(pc,0,1040+30);g.fillStyle='#222';g.font='20px sans-serif';g.fillText(d.meta.Name+' ('+d.pieces.filter(p=>p.decor).length+' decor)',8,1040+22);
require('fs').writeFileSync(out,S.toBuffer('image/png'));console.log('ok',d.meta.Name);
