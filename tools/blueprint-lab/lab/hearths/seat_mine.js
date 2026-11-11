// Seats round fires and candles by beds in the corpus (rough, pivots only). node seatmine.js <dir>
const fs=require('fs'),path=require('path');
const MOD=/^(kg_|GB_|CastleKit_|MB|mm_|BBH|rk_|Piece_vf|OdinsKingdom|h_|\$|Hayze|rae_|teq_|tkd_|rkc_)/;
const FIRE=/^(hearth|fire_pit|fire_pit_iron|fire_pit_hildir)$/,SEAT=/bench|chair|stool|throne/i,BED=/^(bed|piece_bed02|ashwood_bed|dvergrprops_bed)$/,WALL=/wall(?!torch)|_pole|log_/i;
function kindOf(t){t=t.toLowerCase();
if(/tavern|\binn\b|pub|mead ?hall|alehouse|brewery/.test(t))return'tavern';if(/longhouse|long house|great ?hall|\bhall\b|jarl|chieftain|throne/.test(t))return'hall';
if(/temple|church|shrine|chapel/.test(t))return'temple';if(/smith|forge|workshop|crafting/.test(t))return'work';if(/castle|fort|keep|tower/.test(t))return'castle';
if(/village|town|city|settlement/.test(t))return'village';if(/starter|house|home|cabin|cottage|hut|hovel|lodge|farmhouse|dwelling|homestead|croft|shack|bungalow|interior/.test(t))return'home';return'other';}
const files=[];const walk=p=>{for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(/biomeblueprint|overdrive/i.test(f))continue;if(e.isDirectory()){if(!/^_/.test(e.name))walk(f)}else if(/\.blueprint$/i.test(e.name)&&!/^hs_/i.test(e.name))files.push(f)}};walk(process.argv[2]);
const T={},C={n:0,byBed:0,surf:{}};const seen=new Set();let nb=0;
for(const f of files){let t;try{t=fs.readFileSync(f,'utf8')}catch(e){continue}
 const ps=[];let mode=null,name='';for(const raw of t.split(/\r?\n/)){const l=raw.trim();if(!l)continue;if(l[0]==='#'){if(/^#Name:/.test(l))name=l.slice(6);mode=/^#Pieces/.test(l)?'P':/^#[A-Za-z]+$/.test(l)?'x':mode;continue}
  if(mode!=='P')continue;const p=l.split(';');if(p.length<9)continue;const x=+p[2],y=+p[3],z=+p[4];if([x,y,z].some(isNaN))continue;ps.push({n:p[0],x,y,z})}
 if(ps.length<20)continue;const sig=ps.length+'|'+ps.slice(0,30).map(p=>p.n+p.x.toFixed(1)).join(',');if(seen.has(sig))continue;seen.add(sig);
 if(ps.filter(p=>MOD.test(p.n)).length/ps.length>0.05)continue;nb++;
 const kind=kindOf(path.relative(process.argv[2],f)+' '+name);
 for(const fp of ps.filter(p=>FIRE.test(p.n))){
  const roofed=ps.some(q=>/roof/i.test(q.n)&&q.y>fp.y+2&&q.y<fp.y+12&&Math.hypot(q.x-fp.x,q.z-fp.z)<4);if(!roofed)continue;
  const wall=ps.some(q=>WALL.test(q.n)&&q.y>fp.y-0.5&&q.y<fp.y+2.5&&Math.hypot(q.x-fp.x,q.z-fp.z)<1.8);
  const s35=ps.filter(q=>SEAT.test(q.n)&&Math.abs(q.y-fp.y)<1&&Math.hypot(q.x-fp.x,q.z-fp.z)<3.5).length;
  const s4=ps.filter(q=>SEAT.test(q.n)&&Math.abs(q.y-fp.y)<1&&Math.hypot(q.x-fp.x,q.z-fp.z)<4).length;
  const k=kind+'|'+(wall?'wall':'free');const o=T[k]=T[k]||{n:0,any35:0,any4:0,two4:0,sum4:0};o.n++;if(s35)o.any35++;if(s4)o.any4++;if(s4>=2)o.two4++;o.sum4+=s4;}
 for(const c of ps.filter(p=>/^Candle_resin/.test(p.n))){
  const bed=ps.some(q=>BED.test(q.n)&&Math.abs(q.y-c.y)<1.5&&Math.hypot(q.x-c.x,q.z-c.z)<1.5);
  if(kind!=='home'&&kind!=='hall'&&kind!=='tavern')continue;C.n++;if(!bed)continue;C.byBed++;
  const under=ps.filter(q=>q!==c&&q.y<c.y-0.05&&q.y>c.y-1.6&&Math.hypot(q.x-c.x,q.z-c.z)<0.6).sort((a,b)=>b.y-a.y)[0];
  const s=under?under.n.replace(/_?\d+$/,''):'none';C.surf[s]=(C.surf[s]||0)+1;}
}
console.log('builds',nb);for(const k of Object.keys(T).sort())console.log(k,JSON.stringify(T[k]));
console.log('candles home/hall/tavern',C.n,'by bed',C.byBed);console.log(JSON.stringify(Object.entries(C.surf).sort((a,b)=>b[1]-a[1]).slice(0,25)));
