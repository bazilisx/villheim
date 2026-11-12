const fs=require('fs'),rl=require('readline');const C=JSON.parse(fs.readFileSync('/tmp/catalog/pieces.json','utf8')).pieces;
const T=process.argv[2];const OVER=new Set(['roof','roofTop','roofCorner','floor']);
const res={n:0,cov:0,covHigh:0,covNearStair:0,covDeckEdge:0,builds:new Set(),covBuilds:new Set(),cats:{}};
(async()=>{let bi=0;for await(const line of rl.createInterface({input:fs.createReadStream('/tmp/catalog/compact.jsonl')})){const r=JSON.parse(line);bi++;
 const fs_=r.p.filter(p=>p[0]===T);if(!fs_.length)continue;
 const ys=r.p.map(p=>p[2]).sort((a,b)=>a-b),g=ys[Math.floor(0.03*(ys.length-1))];
 const over=r.p.filter(p=>C[p[0]]&&OVER.has(C[p[0]].kind)),roofs=r.p.filter(p=>C[p[0]]&&/roof/.test(C[p[0]].kind)),stairs=r.p.filter(p=>C[p[0]]&&C[p[0]].kind==='stair');
 for(const f of fs_){res.n++;res.builds.add(bi);
  const above=over.filter(o=>Math.abs(o[1]-f[1])<1.6&&Math.abs(o[3]-f[3])<1.6&&o[2]>f[2]+0.4&&o[2]<f[2]+14);
  if(!above.length)continue;res.cov++;res.covBuilds.add(bi);
  if(f[2]-g>2)res.covHigh++;
  if(stairs.some(s=>Math.hypot(s[1]-f[1],s[3]-f[3])<2.5&&Math.abs(s[2]-f[2])<2))res.covNearStair++;
  if(above.every(o=>/roof/.test(C[o[0]].kind)))res.covDeckEdge++;
 }}
 console.log(T,'placements',res.n,'builds',res.builds.size,'covered',res.cov,'in builds',res.covBuilds.size,'covered and >2 m above ground',res.covHigh,'covered next to stairs',res.covNearStair,'covered only by roof pieces (eaves, porch roofs)',res.covDeckEdge);})();
