import { createRequire } from 'module'; const { chromium } = createRequire('/home/user/z2026/package.json')('playwright');
import fs from 'node:fs';
const BASE='http://localhost:3200', OUT=process.argv[2], R='/home/user/z2026/scripts/screens/samples/';
const b64=(f)=>'data:image/jpeg;base64,'+fs.readFileSync(f).toString('base64');
let cookie='';
async function call(route, method='GET', body){ const r=await fetch(BASE+route,{method,headers:{'Content-Type':'application/json',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)}); const sc=r.headers.get('set-cookie'); if(sc) cookie=sc.split(';')[0]; return {ok:r.ok,status:r.status,p:await r.json().catch(()=>({}))}; }
const phone='09126660002', password='reel-pass-123';
let r=await call('/api/auth/login','POST',{phone,password});
if(false){ r=await call('/api/auth/register','POST',{phone,password,type:'artist',name:'آیلین مهرآرا'}); console.log('register',r.status, JSON.stringify(r.p).slice(0,200));
  for (const [name,price,duration] of [['کاشت ناخن','800000','۹۰ دقیقه'],['لاک ژل','450000','۶۰ دقیقه'],['ترمیم ناخن','500000','۶۰ دقیقه']]) console.log('svc',(await call('/api/artist/me','POST',{name,price,duration})).status);
  for (const [f,title] of [['work-2.jpg','ژلیش صورتی'],['work-1.jpg','کاشت ناخن'],['work-3.jpg','ناخن']]) console.log('post',(await call('/api/posts','POST',{title,tag:'ناخن',image:b64(R+f)})).status);
  const pr=(await call('/api/profile','POST',{data:{avatar:b64(process.argv[3]),service:'ناخن',instagram:'ailin.nails',area:'تهران، یوسف‌آباد',geo:{lat:35.7342,lng:51.4069}}})); console.log('profile',pr.status,JSON.stringify(pr.p).slice(0,200));
}
const br=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome'});
const ctx=await br.newContext({viewport:{width:390,height:844},deviceScaleFactor:3,locale:'fa-IR',isMobile:true,hasTouch:true});
await ctx.addInitScript({content:`try{localStorage.setItem("frfro-entered","1");localStorage.setItem("frfro-welcome-seen","1");const g=Storage.prototype.getItem;Storage.prototype.getItem=function(k){return String(k).startsWith("frfro-tip")||k==="frfro-due-later"?"1":g.call(this,k)};}catch(e){}
navigator.canShare=()=>true; navigator.share=async()=>{}; try{navigator.clipboard.writeText=async()=>{}}catch(e){}`});
console.log('cookie',!!cookie); const [n,...rest]=cookie.split('='); await ctx.addCookies([{name:n,value:rest.join('='),url:BASE}]);
const p=await ctx.newPage();

const grab=async(name)=>{ const src=await p.evaluate(()=>{ const ims=[...document.querySelectorAll('img')].filter(x=>x.src.startsWith('data:image')||x.src.startsWith('blob:')); ims.sort((a,b)=>b.naturalWidth*b.naturalHeight-a.naturalWidth*a.naturalHeight); const im=ims[0]; if(!im) return null; const c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight; c.getContext('2d').drawImage(im,0,0); return c.toDataURL('image/png'); }); if(src){ fs.writeFileSync(`${OUT}/${name}.png`, Buffer.from(src.split(',')[1],'base64')); console.log('grab',name);} else console.log('nograb',name); };
const shot=async(name)=>{ await p.screenshot({path:`${OUT}/${name}.png`}); console.log('shot',name); };
await p.goto(BASE+'/'); await p.waitForTimeout(4000); await shot('s-home');
await p.locator('.storyNudgeMain').first().click({timeout:6000});
await p.waitForTimeout(4500); await shot('s-maker'); await grab('story-night');
await p.locator('.igLookDot[aria-label="صورتی"]').first().click({timeout:5000}); await p.waitForTimeout(3500); await grab('story-pink');
await p.locator('.igLookDot[aria-label="نمونه‌کار و ساعت"]').first().click({timeout:5000}); await p.waitForTimeout(3500); await grab('story-works'); await shot('s-works');
await p.locator('.igLookDot').first().click({timeout:5000}); await p.waitForTimeout(3500);
await p.locator('.igStudioMain').first().click({timeout:5000}); await p.waitForTimeout(2500); await shot('s-guide');
await br.close();
