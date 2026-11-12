const fs=require('fs'),rl=require('readline');const P=require(process.argv[2]+'/lib/pieces.js');
const idx=JSON.parse(fs.readFileSync('/work/models/vhmodels/work/index.json','utf8')).prefabs;
const out=[];const cache=new Map();const inf=n=>{let c=cache.get(n);if(!c){const p=P.piece(n);c={role:p.role,size:p.size,structural:p.structural};cache.set(n,c);}return c;};
(async()=>{for await(const line of rl.createInterface({input:fs.createReadStream('/tmp/catalog/compact.jsonl')})){const r=JSON.parse(line);
let n=0,s=0,floorA=0,mod=0;const cells=new Set();
for(const p of r.p){if(!idx[p[0]]){mod++;continue;}n++;const c=inf(p[0]);if(c.structural)s++;if(c.role==='floor'){floorA+=c.size[0]*c.size[2];}
if(c.structural)cells.add(Math.floor(p[1]/2)+','+Math.floor(p[3]/2));}
out.push({n,s,floorA:Math.round(floorA),foot:cells.size*4,mod,votes:r.votes,cat:r.cat,file:r.file});}
fs.writeFileSync('/tmp/catalog/buildsize.json',JSON.stringify(out));console.log(out.length);})();
