const path=require('path');const LIB=path.resolve(process.argv[2]);const G=require(path.join(LIB,'generate.js')),S=require(path.join(LIB,'styles.js'));
const tally={},byStage={s1:{},s2:{},s3:{}};let jumps=0,lines=0;
for(const [key,C] of Object.entries(S.CULTURES)){if(!C.village)continue;for(const biome of C.biomes.slice(0,2))for(let seed=1;seed<=6;seed++){const seq=[];
 for(const st of ['s1','s2','s3']){const d=G.generate({type:'home',biome,culture:key,stage:st,decor:'d1',seed,skipDecor:true});const h=d.request.hearth||'round';seq.push(h);tally[h]=(tally[h]||0)+1;byStage[st][h]=(byStage[st][h]||0)+1;}
 lines++;if(new Set(seq.map(h=>h==='stack'?'end':h)).size>1)jumps++;}}
const n=Object.values(tally).reduce((a,b)=>a+b,0);console.log('homes',n,Object.entries(tally).map(([k,v])=>`${k} ${(100*v/n).toFixed(0)}%`).join(', '));
for(const [s,t] of Object.entries(byStage)){const m=Object.values(t).reduce((a,b)=>a+b,0);console.log(s,Object.entries(t).map(([k,v])=>`${k} ${(100*v/m).toFixed(0)}%`).join(', '));}
console.log('lines',lines,'where the fire changes kind between stages',jumps);
