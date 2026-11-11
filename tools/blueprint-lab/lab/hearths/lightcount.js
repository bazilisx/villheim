const path=require('path');const LIB=path.resolve(process.argv[2]);const G=require(path.join(LIB,'generate.js'));
const kinds={wall:/walltorch|dvergr_lantern$|^piece_dvergr_lantern$/,hang:/brazierceiling|dvergrprops_lantern$/,floor:/groundtorch|brazierfloor|lantern_pole|deepnorth_lantern/,small:/Candle|Lavalantern|hoodedlantern|lantern_standing/};
const tot={};
for(const t of ['home','longhouse','tavern'])for(const [st,dd] of [['s1','d1'],['s2','d2'],['s3','d3']]){const acc={wall:0,hang:0,floor:0,small:0,area:0,n:0};
 for(const biome of ['Meadows','Black Forest','Swamp','Mountain'])for(const seed of [1,2,3,4]){const d=G.generate({type:t,biome,stage:st,decor:dd,seed});
  // inside only: under a roof within the rooms
  const rooms=d.rooms.filter(r=>!r.upper||true);const inside=p=>rooms.some(r=>p.x>r.x0&&p.x<r.x1&&p.z>r.z0&&p.z<r.z1&&p.y>=r.y-0.3&&p.y<r.y+r.h);
  for(const p of d.pieces){for(const [k,re] of Object.entries(kinds))if(re.test(p.name)&&inside(p)){acc[k]++;break;}}
  acc.area+=rooms.reduce((a,r)=>a+(r.x1-r.x0)*(r.z1-r.z0),0);acc.n++;}
 console.log(t.padEnd(10),st,'per 10 m2:',Object.entries(acc).filter(([k])=>!['area','n'].includes(k)).map(([k,v])=>k+' '+(10*v/acc.area).toFixed(2)).join('  '),' lights per design',((acc.wall+acc.hang+acc.floor+acc.small)/acc.n).toFixed(1));}
