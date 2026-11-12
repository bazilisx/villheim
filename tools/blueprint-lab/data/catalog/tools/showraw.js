const fs=require('fs');const BP=require(process.argv[2]+'/lib/blueprint.js');const out=[];
for(const f of fs.readdirSync('/tmp/catalog/showcase').sort()){const bp=BP.parse(fs.readFileSync('/tmp/catalog/showcase/'+f,'utf8'));const c={};for(const p of bp.pieces)c[p.name]=(c[p.name]||0)+1;out.push(c);}
fs.writeFileSync('/tmp/catalog/showcase-raw.json',JSON.stringify(out));
