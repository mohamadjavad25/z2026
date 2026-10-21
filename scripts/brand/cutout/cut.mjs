import {createRequire} from 'module'; const sharp=createRequire('C:/Users/novin/z2026/package.json')('sharp');
const [inp,out,tolArg]=process.argv.slice(2); const tol=+(tolArg||28);
const {data,info}=await sharp(inp).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height; const bg=[data[0],data[1],data[2]];
const seen=new Uint8Array(W*H); const st=[];
const near=p=>{const i=p*4;return Math.abs(data[i]-bg[0])+Math.abs(data[i+1]-bg[1])+Math.abs(data[i+2]-bg[2])<tol*3;};
for(let x=0;x<W;x++){st.push(x,(H-1)*W+x);} for(let y=0;y<H;y++){st.push(y*W,y*W+W-1);}
while(st.length){const p=st.pop(); if(seen[p]||!near(p))continue; seen[p]=1; data[p*4+3]=0; const x=p%W,y=(p/W)|0;
 if(x>0)st.push(p-1); if(x<W-1)st.push(p+1); if(y>0)st.push(p-W); if(y<H-1)st.push(p+W);}
await sharp(data,{raw:{width:W,height:H,channels:4}}).trim().png().toFile(out);
