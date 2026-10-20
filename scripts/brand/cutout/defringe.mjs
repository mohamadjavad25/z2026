import {createRequire} from 'module'; const sharp=createRequire('C:/Users/novin/z2026/package.json')('sharp');
const [inp,out]=process.argv.slice(2);
const {data,info}=await sharp(inp).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,N=W*H;
// distance (in px, up to 3) from the transparent outside
const d=new Uint8Array(N).fill(255); let q=[];
for(let p=0;p<N;p++) if(data[p*4+3]===0){d[p]=0;q.push(p);}
for(let k=1;k<=3;k++){const nq=[];for(const p of q){const x=p%W,y=(p/W)|0;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){const X=x+dx,Y=y+dy;if(X<0||Y<0||X>=W||Y>=H)continue;const r=Y*W+X;if(d[r]===255){d[r]=k;nq.push(r);}}}q=nq;}
const LB=247, F=[6,4,3], LF=6; let changed=0;
for(let p=0;p<N;p++){if(d[p]<1||d[p]>3)continue;const i=p*4;const r=data[i],g=data[i+1],b=data[i+2];
 const L=(r+g+b)/3, sat=Math.max(r,g,b)-Math.min(r,g,b);
 if(L<=LF+4||sat>45)continue;
 let a=(LB-L)/(LB-LF); a=Math.max(0,Math.min(1,a));
 if(d[p]===1) a=Math.min(a,0.85);
 data[i]=F[0];data[i+1]=F[1];data[i+2]=F[2];data[i+3]=Math.round(a*data[i+3]);changed++;}
await sharp(data,{raw:{width:W,height:H,channels:4}}).png().toFile(out);
console.log('fixed',changed);
