const fs=require('fs');const dir=process.argv[2];
const rows={};
for(const f of fs.readdirSync(dir).sort()){
  const m=f.match(/^norse-(.+)_s(\d)d(\d)\.blueprint$/);if(!m)continue;
  let minx=1e9,maxx=-1e9,minz=1e9,maxz=-1e9,r=0,n=0;
  for(const l of fs.readFileSync(dir+'/'+f,'utf8').split('\n')){
    if(!l||l.startsWith('#'))continue;const p=l.split(';');if(p.length<5)continue;
    const x=+p[2],z=+p[4];if(isNaN(x)||isNaN(z))continue;n++;
    minx=Math.min(minx,x);maxx=Math.max(maxx,x);minz=Math.min(minz,z);maxz=Math.max(maxz,z);r=Math.max(r,Math.hypot(x,z));
  }
  (rows[m[1]]=rows[m[1]]||{})['s'+m[2]+'d'+m[3]]={w:maxx-minx,d:maxz-minz,r:r+2,n,cx:(minx+maxx)/2,cz:(minz+maxz)/2};
}
console.log('line        stage  width x depth (m)   code radius   pieces  center offset');
for(const k in rows)for(const s of ['s1d1','s2d1','s3d1','s3d3']){const v=rows[k][s];console.log(k.padEnd(12),s,'  ',v.w.toFixed(1).padStart(5),'x',v.d.toFixed(1).padStart(5),'      ',v.r.toFixed(1).padStart(5),'      ',String(v.n).padStart(4),'  ',v.cx.toFixed(1),v.cz.toFixed(1))}
