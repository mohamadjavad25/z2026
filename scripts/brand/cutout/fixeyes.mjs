import {createRequire} from 'module'; const sharp=createRequire('C:/Users/novin/z2026/package.json')('sharp');
const [inp,out]=process.argv.slice(2);
const {data,info}=await sharp(inp).raw().toBuffer({resolveWithObject:true});
const i=(560*info.width+470)*info.channels; const face="rgb(37,36,34)";
console.log('face',face);
const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${info.width}" height="${info.height}">
<rect x="388" y="418" width="256" height="108" rx="20" fill="${face}"/>
<path d="M398,452 L484,468 L484,478 A43,36 0 0 1 398,478 Z" fill="#ffffff"/>
<path d="M534,468 L632,452 L632,479 A49,36 0 0 1 534,479 Z" fill="#ffffff"/>
</svg>`;
await sharp(inp).composite([{input:Buffer.from(svg)}]).png().toFile(out);
