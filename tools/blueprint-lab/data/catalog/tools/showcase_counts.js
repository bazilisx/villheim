const fs=require('fs'),path=require('path');const lab=process.argv[2];
const BP=require(lab+'/lib/blueprint.js'),P=require(lab+'/lib/pieces.js');
const dir='/tmp/catalog/showcase';const out={designs:[],pieces:{}};
for(const f of fs.readdirSync(dir).sort()){ if(!f.endsWith('.blueprint'))continue;
 const bp=BP.parse(fs.readFileSync(path.join(dir,f),'utf8'));let floorA=0;const c={};
 for(const p of bp.pieces){const r=P.piece(p.name);if(r.role==='floor')floorA+=r.size[0]*r.size[2];c[p.name]=(c[p.name]||0)+1;}
 out.designs.push({file:f,pieces:bp.pieces.length,floorA:Math.round(floorA)});
 for(const [n,k] of Object.entries(c)){(out.pieces[n]=out.pieces[n]||[]).push([out.designs.length-1,k]);}
}
const res={};for(const [n,a] of Object.entries(out.pieces)){const ks=a.map(x=>x[1]).sort((x,y)=>x-y);const dens=a.map(([i,k])=>100*k/Math.max(20,out.designs[i].floorA)).sort((x,y)=>x-y);
 res[n]={designs:a.length,median:ks[ks.length>>1],max:ks[ks.length-1],total:ks.reduce((s,v)=>s+v,0),per100m2_median:Math.round(dens[dens.length>>1]*100)/100};}
fs.writeFileSync('/tmp/catalog/showcase-counts.json',JSON.stringify(res));fs.writeFileSync('/tmp/catalog/showcase-designs.json',JSON.stringify(out.designs));
console.log(out.designs.map(d=>d.file.slice(0,30)+' '+d.pieces+' '+d.floorA).join('\n'));
