import {createRequire} from 'module'; const sharp=createRequire('C:/Users/novin/z2026/package.json')('sharp');
const [inp,out,maxArg]=process.argv.slice(2); const MAX=+(maxArg||600);
const {data,info}=await sharp(inp).ensureAlpha().raw().toBuffer({resolveWithObject:true});
const W=info.width,H=info.height,N=W*H;
const light=p=>{const i=p*4;if(data[i+3]<100)return false;const r=data[i],g=data[i+1],b=data[i+2];return r>236&&g>232&&b<246&&r-b>=8&&g-b>=6;};
const lab=new Int32Array(N).fill(-1);const comps=[];
for(let s=0;s<N;s++){if(lab[s]!==-1||!light(s))continue;const st=[s],px=[];lab[s]=comps.length;
 while(st.length){const p=st.pop();px.push(p);const x=p%W,y=(p/W)|0;for(const r of [x>0?p-1:-1,x<W-1?p+1:-1,y>0?p-W:-1,y<H-1?p+W:-1]){if(r>=0&&lab[r]===-1&&light(r)){lab[r]=comps.length;st.push(r);}}}
 comps.push(px);}
let removed=0;
for(const px of comps){if(px.length>=MAX)continue;
 // a speck touches transparency or dark outline only: drop it to transparent
 for(const p of px){data[p*4+3]=0;removed++;}}
console.log('components',comps.length,'big',comps.filter(c=>c.length>=MAX).map(c=>c.length).join(','),'removed px',removed);
await sharp(data,{raw:{width:W,height:H,channels:4}}).png().toFile(out);
