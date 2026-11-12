// For pieces whose front the catalog knows: in each design, which side of the piece faces the nearest wall.
const fs=require('fs'),path=require('path');const lab=process.argv[2];
const yq=p=>{if(p.yaw!=null)return p.yaw;const [x,y,z,w]=p.q||[0,0,0,1];return Math.atan2(2*(w*y+x*z),1-2*(y*y+x*x))*180/Math.PI;};
const BP=require(lab+'/lib/blueprint.js'),P=require(lab+'/lib/pieces.js'),C=require(lab+'/lib/catalog.js');
const WALL=new Set(['wall','gable','door','window']);const AX=['+x','-x','+z','-z'];
const tally={};
for(const f of fs.readdirSync('/tmp/catalog/showcase').sort()){const bp=BP.parse(fs.readFileSync('/tmp/catalog/showcase/'+f,'utf8'));
 const walls=bp.pieces.filter(p=>WALL.has(P.piece(p.name).role));
 for(const p of bp.pieces){const fc=C.facing(p.name);if(!fc||!fc.front||!['high','medium'].includes(fc.sure))continue;
  let best=9,bdx=0,bdz=0;const yaw=yq(p);
  for(const o of walls){const oc=P.piece(o.name);const a=yq(o)*Math.PI/180,ux=Math.cos(a),uz=-Math.sin(a);
   const lo=oc.onPivot?o.y-0.3:o.y-oc.size[1]/2-0.3,hi=oc.onPivot?o.y+oc.size[1]+0.3:o.y+oc.size[1]/2+0.3;if(p.y<lo||p.y>hi)continue;
   let t=(p.x-o.x)*ux+(p.z-o.z)*uz;const hl=oc.size[0]/2;t=Math.max(-hl,Math.min(hl,t));const px=o.x+ux*t,pz=o.z+uz*t;const d=Math.hypot(p.x-px,p.z-pz);if(d<best){best=d;bdx=px-p.x;bdz=pz-p.z;}}
  if(best>(["piece_chest_warderobe","piece_bed02","bed","ashwood_bed"].includes(p.name)?2.5:0.9))continue;
  const a=yaw*Math.PI/180,lx=[Math.cos(a),-Math.sin(a)],lz=[Math.sin(a),Math.cos(a)];const u=bdx*lx[0]+bdz*lx[1],v=bdx*lz[0]+bdz*lz[1];
  const side=Math.abs(u)>Math.abs(v)?(u>0?'+x':'-x'):(v>0?'+z':'-z');
  const t=tally[p.name]=tally[p.name]||{n:0,backToWall:0,frontToWall:0,side:0,expectBack:fc.back};
  t.n++;if(side===fc.back)t.backToWall++;else if(side===fc.front)t.frontToWall++;else t.side++;}}
console.log(JSON.stringify(tally,null,0));fs.writeFileSync('/tmp/catalog/facing-showcase.json',JSON.stringify(tally));
