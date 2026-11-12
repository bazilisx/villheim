const fs=require('fs');
const rows=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const out=fs.openSync(process.argv[3],'w');
let n=0,pc=0;
for(const r of rows){fs.writeSync(out,JSON.stringify(r)+'\n');n++;pc+=r.p.length;}
fs.closeSync(out);console.log(n,pc, Object.keys(rows[0]));
