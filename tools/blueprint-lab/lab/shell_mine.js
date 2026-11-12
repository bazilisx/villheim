// Corpus measures for the shell rules of the showcase review (track D, 2026-11-12): what builders put on the open
// edges of raised floors (railings), how stone and grausten mix, how crossed boards (wood_wall_roof_top_45) sit against
// the 45 degree beams and ridge caps beside them, which plants stand above the ground, and what lies under windows.
// Usage: node --max-old-space-size=4000 lab/shell_mine.js <compact.json> <out dir>
// compact.json is the private repo's corpus summary (file, title, cat, dls, votes, verdict, p = [name, x, y, z, yaw]);
// nothing from it is written here but counts. Writes <out>/shell-mine.json (counts) and <out>/cross.json (offsets).
const fs=require('fs'),path=require('path');
const P=require(path.join(__dirname,'../lib/pieces.js'));
const [,, SRC, OUTD] = process.argv;
const all=JSON.parse(fs.readFileSync(SRC,'utf8'));
const out={builds:all.length};
const role=n=>P.piece(n).role;
const rail={},railBuilds={},plantsUp={},plantsUpBuilds={},plantsGround={};let nRailEdges=0,buildsWithUpper=0;
const mas={both:0,stoneOnly:0,grauOnly:0,mixPairs:{horiz:0,vert:0},mixedList:[]};
const crossRel=[];const sill={},sillBuilds={};let nWin=0;
const isStoneWall=n=>/^stone_(wall|arch|pillar|floor|stair)/.test(n), isGrau=n=>/^Piece_grausten/i.test(n);
for(const b of all){
  const p=b.p; if(!p||p.length<20) continue;
  const ys=p.filter(q=>P.piece(q[0]).structural).map(q=>q[2]).sort((a,c)=>a-c); if(!ys.length) continue;
  const g=ys[Math.floor(ys.length*0.03)];
  // ---- masonry
  const st=p.filter(q=>/^stone_wall|^stone_arch|^stone_pillar/.test(q[0])), gr=p.filter(q=>/^Piece_grausten_wall|^Piece_grausten_pillar|^Piece_grausten_arch/i.test(q[0]));
  if(st.length>=4&&gr.length>=4){mas.both++; let h=0,v=0; for(const a of st) for(const c of gr){const dx=Math.abs(a[1]-c[1]),dz=Math.abs(a[3]-c[3]),dy=Math.abs(a[2]-c[2]); if(Math.hypot(dx,dz)<1.6&&dy<0.6)h++; else if(Math.hypot(dx,dz)<0.6&&dy<2.2)v++;} mas.mixPairs.horiz+=h;mas.mixPairs.vert+=v; mas.mixedList.push([st.length,gr.length,h,v]);}
  else if(st.length>=4)mas.stoneOnly++; else if(gr.length>=4)mas.grauOnly++;
  // ---- plants above ground
  let up=false;
  for(const q of p){ if(/^Pickable_|^vines$|^Beech_small|^Bush|^FirTree_small|^sapling|^Pickable/.test(q[0])||role(q[0])==='nature'){ const h=q[2]-g; if(h>0.6){plantsUp[q[0]]=(plantsUp[q[0]]||0)+1; up=true;} else plantsGround[q[0]]=(plantsGround[q[0]]||0)+1; } }
  if(up) for(const n of new Set(p.filter(q=>(/^Pickable_/.test(q[0])||role(q[0])==='nature')&&q[2]-g>0.6).map(q=>q[0]))) plantsUpBuilds[n]=(plantsUpBuilds[n]||0)+1;
  // ---- crossed boards
  for(const c of p){ if(c[0]!=='wood_wall_roof_top_45') continue;
    const a=c[4]*Math.PI/180, ux=Math.cos(a), uz=-Math.sin(a), nx=Math.sin(a), nz=Math.cos(a);
    const rel={beams:[],caps:[]};
    for(const q of p){ if(q===c) continue; const dx=q[1]-c[1],dz=q[3]-c[3],dy=q[2]-c[2]; if(Math.hypot(dx,dz)>3.2||Math.abs(dy)>3.2) continue;
      const along=dx*ux+dz*uz, norm=dx*nx+dz*nz;
      if(/_beam_45$|beam_45$/.test(q[0])) rel.beams.push([q[0],+along.toFixed(2),+dy.toFixed(2),+norm.toFixed(2),((q[4]-c[4])%360+360)%360]);
      if(/roof_top_45$/.test(q[0])&&!/wall_roof_top/.test(q[0])) rel.caps.push([q[0],+along.toFixed(2),+dy.toFixed(2),+norm.toFixed(2),((q[4]-c[4])%360+360)%360]);
    }
    crossRel.push(rel);}
  // ---- railings: open edges of floors 1.2 m or more over the ground
  const fl=p.filter(q=>role(q[0])==='floor'&&/wood_floor$|darkwood_floor|stone_floor_2x2|blackmarble_floor$|ashwood_floor_2x2|Piece_grausten_floor_2x2/.test(q[0])&&q[2]-g>1.2);
  if(fl.length) buildsWithUpper++;
  const key=(x,y,z)=>`${Math.round(x)},${Math.round(y*2)},${Math.round(z)}`; const fset=new Set(fl.map(q=>key(q[1],q[2],q[3])));
  const seen=new Set();
  for(const f of fl){ for(const [dx,dz] of [[2,0],[-2,0],[0,2],[0,-2]]){ if(fset.has(key(f[1]+dx,f[2],f[3]+dz))) continue;
      const ex=f[1]+dx/2, ez=f[3]+dz/2;
      // a wall on the edge: not open
      const near=p.filter(q=>Math.abs(q[1]-ex)<(dx?0.45:1.05)&&Math.abs(q[3]-ez)<(dz?0.45:1.05)&&q[2]>f[2]-0.1&&q[2]<f[2]+1.6&&q!==f);
      if(near.some(q=>['wall','door','window','gable'].includes(role(q[0]))&&!/quarter|half/.test(q[0]))) continue;
      // no floor under past the edge (a real drop), roughly
      nRailEdges++;
      for(const q of near){ const r=role(q[0]); if(['floor','rug','light','nature','misc'].includes(r)) continue; rail[q[0]]=(rail[q[0]]||0)+1; const k=b.file+'|'+q[0]; if(!seen.has(k)){seen.add(k); railBuilds[q[0]]=(railBuilds[q[0]]||0)+1;} }
  }}
  // ---- sills: what is right under ground-floor windows, outside
  for(const w of p){ if(role(w[0])!=='window') continue; nWin++;
    const a=w[4]*Math.PI/180, ux=Math.cos(a), uz=-Math.sin(a);
    const near=p.filter(q=>q!==w&&Math.abs((q[1]-w[1])*ux+(q[3]-w[3])*uz)<1.2&&Math.abs((q[1]-w[1])*Math.sin(a)+(q[3]-w[3])*Math.cos(a))<0.9&&q[2]<w[2]-0.4&&q[2]>w[2]-1.6);
    const s=new Set(near.map(q=>q[0])); for(const n of s){sill[n]=(sill[n]||0)+1;}
  }
}
const top=(o,k=40)=>Object.entries(o).sort((a,c)=>c[1]-a[1]).slice(0,k);
out.rail={edges:nRailEdges,buildsWithUpper,pieces:top(rail),builds:top(railBuilds)};
out.masonry={both:mas.both,stoneOnly:mas.stoneOnly,grauOnly:mas.grauOnly,pairs:mas.mixPairs,mixed:mas.mixedList.slice(0,40)};
out.plantsUp=top(plantsUp,50);out.plantsUpBuilds=top(plantsUpBuilds,50);out.plantsGround=top(plantsGround,30);
out.sill={windows:nWin,under:top(sill,50)};
// crossed boards: the board's line through its crossing (1 m over the pivot) against each in-plane 45 degree beam,
// and the height of the nearest ridge cap over the cross's pivot
const resid={},capdy={};let inPlaneBeams=0;
for(const r of crossRel){
  for(const b of r.beams){ if(Math.abs(b[3])>=0.35||b[0]!=='wood_beam_45'||Math.round(b[4])%180!==0) continue; inPlaneBeams++;
    const s=Math.round(b[4])%360===0?1:-1, k=Math.round((b[2]-s*b[1]-1)*4)/4; resid[k]=(resid[k]||0)+1; }
  for(const c of r.caps){ if(Math.abs(c[3])<2.2&&Math.abs(c[1])<0.6){ const k=Math.round(c[2]*4)/4; capdy[k]=(capdy[k]||0)+1; } }
}
out.crossed={crosses:crossRel.length,inPlaneBeams,offFromBoardLine:top(resid,12),capOverPivot:top(capdy,10)};
fs.mkdirSync(OUTD,{recursive:true});
fs.writeFileSync(path.join(OUTD,'shell-mine.json'),JSON.stringify(out,null,1));
console.log('done', crossRel.length, 'crosses');
