// Flat-ground packing: old circle rule against the new footprint rule, pool sizes measured from the 81 files.
const fs=require('fs');const dir='pool';
function rect(name,grown){let r=null;for(const s of grown?[1,2,3]:[1]){let a=1e9,b=-1e9,c=1e9,d=-1e9,rad=0;
 for(const l of fs.readFileSync(`${dir}/norse-${name}_s${s}d1.blueprint`,'utf8').split('\n')){if(!l||l[0]=='#')continue;const p=l.split(';');const x=+p[2],z=+p[4];if(isNaN(x))continue;a=Math.min(a,x);b=Math.max(b,x);c=Math.min(c,z);d=Math.max(d,z);rad=Math.max(rad,Math.hypot(x,z))}
 r=r?{a:Math.min(r.a,a-1),b:Math.max(r.b,b+1),c:Math.min(r.c,c-1),d:Math.max(r.d,d+1),rad:r.rad}:{a:a-1,b:b+1,c:c-1,d:d+1,rad:rad+2}}return r}
const order=[['home-a','House'],['home-b','House'],['home-c','House'],['hall','Hub'],['woodworker','Workshop'],['storehouse','Storage'],['smithy','Workshop'],['farm','Farm'],['barn','Farm'],['home-a','House'],['home-b','House'],['home-c','House']];
const band={Hub:[0,.6],House:[.1,.65],Workshop:[.45,.95],Storage:[.1,.5],Farm:[.45,1]};
function face(x,z){const ang=Math.atan2(-x,-z)*180/Math.PI;return Math.round(ang/90)*90}
function foot(r,x,z,yaw){const t=yaw*Math.PI/180,cs=Math.cos(t),sn=Math.sin(t);const cx=(r.a+r.b)/2,cz=(r.c+r.d)/2;
 return {x:x+cx*cs+cz*sn,z:z-cx*sn+cz*cs,hx:(r.b-r.a)/2,hz:(r.d-r.c)/2,t}}
function local(f,x,z){const dx=x-f.x,dz=z-f.z,cs=Math.cos(-f.t),sn=Math.sin(-f.t);return [dx*cs+dz*sn,-dx*sn+dz*cs]}
function world(f,lx,lz){const cs=Math.cos(f.t),sn=Math.sin(f.t);return [f.x+lx*cs+lz*sn,f.z-lx*sn+lz*cs]}
function sep(a,b){let mnx=1e9,mxx=-1e9,mnz=1e9,mxz=-1e9;for(const [sx,sz] of [[1,1],[1,-1],[-1,1],[-1,-1]]){const w=world(b,sx*b.hx,sz*b.hz);const l=local(a,w[0],w[1]);mnx=Math.min(mnx,l[0]);mxx=Math.max(mxx,l[0]);mnz=Math.min(mnz,l[1]);mxz=Math.max(mxz,l[1])}return mnx>a.hx||mxx<-a.hx||mnz>a.hz||mxz<-a.hz}
function near(a,b,g){a={...a,hx:a.hx+g,hz:a.hz+g};return !sep(a,b)&&!sep(b,a)}
function dist(f,x,z){const l=local(f,x,z);return Math.hypot(Math.max(0,Math.abs(l[0])-f.hx),Math.max(0,Math.abs(l[1])-f.hz))}
function run(mode){const plots=[];const out=[];
 for(const [name,role] of order){const R=60*(1+0.25*(plots.length>=7?2:plots.length>=3?1:0));const g=rect(name,true),r1=rect(name,false);let best=null;
  for(const reach of [1,1.35,1.7,2]){const vr=R*reach;const max=Math.min(vr,vr*band[role][1]+r1.rad*.5);
   const minD=mode=='old'?Math.max(r1.rad+11,vr*band[role][0]):Math.max(Math.min(r1.b-r1.a,r1.d-r1.c)/2+14.5,vr*band[role][0]);
   const step=mode=='old'?Math.max(4,Math.round(r1.rad*.5/4)*4):4;const n=Math.ceil(max/step);
   for(let x=-n;x<=n;x++)for(let z=-n;z<=n;z++){const px=x*step,pz=z*step,d=Math.hypot(px,pz);if(d>max||d<minD)continue;if(best&&d>=best.d)continue;
    let ok=true;
    if(mode=='old'){for(const p of plots)if(Math.hypot(px-p.x,pz-p.z)<p.rad+r1.rad+4){ok=false;break}}
    else{const yaw=face(px,pz);const f=foot(g,px,pz,yaw);if(dist(foot(r1,px,pz,yaw),0,0)<14.5)ok=false;else for(const p of plots)if(near(f,p.f,2.5)){ok=false;break}if(ok)best={x:px,z:pz,d,f,rad:r1.rad}}
    if(ok&&mode=='old')best={x:px,z:pz,d,rad:r1.rad}}
   if(best)break}
  if(best){plots.push(best);out.push(`${name.padEnd(11)} ${best.d.toFixed(0).padStart(3)} m`)}else out.push(`${name.padEnd(11)} no room`)}
 return out}
const o=run('old'),n=run('new');console.log('building     old rule   new rule (distance of the plot from the hearth, flat open ground)');o.forEach((l,i)=>console.log(l.padEnd(22),n[i].slice(12)));
