const Q=require(process.cwd()+'/lib/request.js'),sc=require(process.cwd()+'/data/scorer.json'),fs=require('fs');
const lines=[['home-a','home','house',101],['home-b','home','house',202],['home-c','home','house',303],['hall','longhouse','hub',11],['woodworker','sawmill','workshop',21],['smithy','smithy','workshop',22],['farm','farm','farm',31],['barn','barn','farm',32],['storehouse','storage','storage',41]];
// Writes the Norse Meadows test pool (81 designs, same files as 'vh testpool make') in about 30 s.
// Usage, from tools/blueprint-lab: node lab/make_testpool.js [out folder] [--no-gate]; copy the folder into the game's
// blueprints folder. The pool is audited at the end (lib/audit.js, as 'vh testpool make' does in the game): the exit
// code is 1 when any known defect shows, so a pool that fails is never copied over by a script.
const out=process.argv[2]||'out/testpool-norse';fs.mkdirSync(out,{recursive:true});let n=0,bad=[];const t0=Date.now();
for(const [name,type,role,seed] of lines)for(let s=1;s<=3;s++)for(let d=1;d<=3;d++){
 const r=Q.make({type,biome:'Meadows',culture:'norse',stage:'s'+s,decor:'d'+d,seed,tries:1},sc);
 if(!r.blueprint){bad.push(name+s+d);continue}
 const file=`norse-${name}_s${s}d${d}`;
 const desc=`villheim: role=${role} biome=meadows culture=norse ; Test pool ${type} s${s}d${d} seed ${seed} design ${r.name}`;
 const txt=r.blueprint.split('\n').map(l=>{l=l.replace(/\r$/,'');if(l.startsWith('#Name:'))return '#Name:'+file;if(l.startsWith('#Description:'))return '#Description:"'+desc.replace(/"/g,"'")+'"';if(l.startsWith('#Category:'))return '#Category:Villheim';return l}).join('\n').replace(/\n+$/,'')+'\n';
 fs.writeFileSync(`${out}/${file}.blueprint`,txt);n++;
 if((r.failed||[]).length)bad.push(file+':'+r.failed.join(','));
}
console.log(n,'written in',Date.now()-t0,'ms; issues',bad.join(' | '));
// the gate: the same audit as lab/audit_pool.js and the game
if(!process.argv.includes('--no-gate')){
 const A=require(process.cwd()+'/lib/audit.js'),B=require(process.cwd()+'/lib/blueprint.js'),files={};
 for(const f of fs.readdirSync(out).filter(f=>/^norse-.*_s\dd\d\.blueprint$/.test(f)))files[f]=fs.readFileSync(`${out}/${f}`,'utf8');
 const rep=A.pool(A.group(files,B.parse),out);console.log(A.summary(rep,3));
 if(rep.gate!=='pass')process.exitCode=1;
}
