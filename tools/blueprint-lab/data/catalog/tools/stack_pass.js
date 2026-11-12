// chests stacked on chests, corpus and showcase
const fs=require('fs'),rl=require('readline'),path=require('path');const lab=process.argv[2];
const P=require(lab+'/lib/pieces.js'),BP=require(lab+'/lib/blueprint.js');
const isStore=n=>/^(piece_chest|piece_chest_wood|piece_chest_blackmetal|piece_chest_barrel|piece_chest_private|piece_chest_treasure|piece_chest_warderobe|piece_chest_grausten|dvergrprops_crate|dvergrprops_crate_long|dvergrprops_barrel|barrell)$/.test(n);
function one(ps){let chests=0,stacked=0;const st=ps.filter(p=>isStore(p[0]));
 for(const a of st){chests++;for(const b of st){if(a===b)continue;const dy=a[2]-b[2];if(dy>0.4&&dy<1.3&&Math.hypot(a[1]-b[1],a[3]-b[3])<0.5){stacked++;break;}}}
 return [chests,stacked];}
(async()=>{const corpus=[];
for await(const line of rl.createInterface({input:fs.createReadStream('/tmp/catalog/compact.jsonl')})){const r=JSON.parse(line);corpus.push(one(r.p));}
const show=[];for(const f of fs.readdirSync('/tmp/catalog/showcase').sort()){const bp=BP.parse(fs.readFileSync('/tmp/catalog/showcase/'+f,'utf8'));show.push(one(bp.pieces.map(p=>[p.name,p.x,p.y,p.z])));}
fs.writeFileSync('/tmp/catalog/stacks.json',JSON.stringify({corpus,show}));
const withC=corpus.filter(c=>c[0]>0),withS=corpus.filter(c=>c[1]>0);
const sum=(a,i)=>a.reduce((s,c)=>s+c[i],0);
console.log('corpus builds with storage',withC.length,'with a stack',withS.length,'stacked share of storage pieces',(sum(corpus,1)/sum(corpus,0)).toFixed(3));
console.log('showcase',JSON.stringify(show),'stacked share',(sum(show,1)/sum(show,0)).toFixed(3),'designs with a stack',show.filter(c=>c[1]>0).length);
})();
