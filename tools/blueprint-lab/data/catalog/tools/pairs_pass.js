// Look family co-occurrence: in the same build, and (for furniture and decor) in the same covered area.
const fs=require('fs'),rl=require('readline');
const C=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).pieces;
const SKIP=new Set(['plant','rock','food','item','creature','effect','misc']);
const STRUCT=new Set(['wall','floor','roof','roofTop','roofCorner','gable','beam','pole','stair','door','window','fence']);
const OVER=new Set(['roof','roofTop','roofCorner','floor']);
const nb={n:0},famB={},pairB={},pairA={},pairBothIn={},structB={},spairB={};
const key=(a,b)=>a<b?a+'|'+b:b+'|'+a;
(async()=>{for await(const line of rl.createInterface({input:fs.createReadStream('/tmp/catalog/compact.jsonl')})){
 const r=JSON.parse(line);nb.n++;
 const items=[],over=new Map(),fams=new Set(),sf=new Set();
 for(const p of r.p){const c=C[p[0]];if(!c)continue;
   if(OVER.has(c.kind)){const k=Math.floor(p[1]/2)+','+Math.floor(p[3]/2);let a=over.get(k);if(!a)over.set(k,a=[]);a.push(p[2]);}
   if(STRUCT.has(c.kind)){sf.add(c.family);continue;}
   if(SKIP.has(c.kind)||c.family==='other')continue;
   items.push([c.family,p[1],p[2],p[3]]);fams.add(c.family);}
 const cov=it=>{for(let i=-1;i<=1;i++)for(let k=-1;k<=1;k++){const a=over.get((Math.floor(it[1]/2)+i)+','+(Math.floor(it[3]/2)+k));if(a)for(const y of a)if(y>it[2]+0.4&&y<it[2]+14)return true;}return false;};
 const inside=items.filter(cov);
 const fin=new Set(inside.map(i=>i[0]));
 for(const f of fams)famB[f]=(famB[f]||0)+1;
 const fl=[...fams];for(let i=0;i<fl.length;i++)for(let j=i+1;j<fl.length;j++){const k=key(fl[i],fl[j]);pairB[k]=(pairB[k]||0)+1;}
 const fi=[...fin];for(let i=0;i<fi.length;i++)for(let j=i+1;j<fi.length;j++){const k=key(fi[i],fi[j]);pairBothIn[k]=(pairBothIn[k]||0)+1;}
 const seen=new Set();const g=new Map();for(const it of inside){const k=Math.floor(it[1]/4)+','+Math.floor(it[3]/4);let a=g.get(k);if(!a)g.set(k,a=[]);a.push(it);}
 for(const it of inside){const gx=Math.floor(it[1]/4),gz=Math.floor(it[3]/4);for(let i=-1;i<=1;i++)for(let k=-1;k<=1;k++){const a=g.get((gx+i)+','+(gz+k));if(!a)continue;for(const o of a){if(o[0]===it[0])continue;if(Math.hypot(o[1]-it[1],o[3]-it[3])<4&&Math.abs(o[2]-it[2])<1.5)seen.add(key(it[0],o[0]));}}}
 for(const k of seen)pairA[k]=(pairA[k]||0)+1;
 for(const f of sf)structB[f]=(structB[f]||0)+1;
 const sl=[...sf];for(let i=0;i<sl.length;i++)for(let j=i+1;j<sl.length;j++){const k=key(sl[i],sl[j]);spairB[k]=(spairB[k]||0)+1;}
}
fs.writeFileSync('/tmp/catalog/pairs-raw.json',JSON.stringify({builds:nb.n,famB,pairB,pairA,pairBothIn,structB,spairB}));console.log('ok',nb.n);})();
