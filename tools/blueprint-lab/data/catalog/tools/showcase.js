const fs=require('fs'),path=require('path');
const lab=process.argv[2];
const R=require(lab+'/lib/request.js'),BP=require(lab+'/lib/blueprint.js');
const scorer=JSON.parse(fs.readFileSync(lab+'/data/scorer.json','utf8')),rules=JSON.parse(fs.readFileSync(lab+'/data/rules-lite.json','utf8'));
const L=[["hub","md","norse","s5d3",2],["hub","pl","byzantine","s5d3",1],["hub","bf","celtic","s4d3",2],["temple","ml","byzantine","s3d3",1],["longhouse","bf","norse-forest","s3d3",3],["tavern","pl","byzantine","s3d3",1],["tavern","pl","steppe","s3d3",2],["home","pl","middle-eastern","s3d3",1],["home","sw","baltic","s3d3",2],["home","bf","slavic","s3d3",3],["home","md","anglo-saxon","s2d3",2],["home","ml","lamari","s2d3",2],["smithy","mt","norse-highland","s2d3",1],["tower","mt","norse-highland","s3d3",1],["workshop","al","castle-medieval","s2d3",3],["home","al","castle-medieval","s3d3",1]];
const only=process.argv[3]?+process.argv[3]:-1;
L.forEach((s,i)=>{ if(only>=0&&i!==only)return; const t=Date.now();
 const r=R.make({type:s[0],biome:s[1],culture:s[2],stage:s[3],seed:s[4],tries:1},scorer,rules);
 const nm=`showcase-${String(i+1).padStart(2,'0')}-${s.join('-')}`;
 if(r.error){console.log(nm,'ERR',r.error);return;}
 fs.writeFileSync(`/tmp/catalog/showcase/${nm}.blueprint`,r.blueprint); console.log(nm,r.pieces,(Date.now()-t)+'ms');});
