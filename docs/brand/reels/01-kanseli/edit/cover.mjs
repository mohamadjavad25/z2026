import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const dir = process.argv[2], out = process.argv[3];
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1080,height:1920}});
await p.setContent(`<html><head><style>
@font-face{font-family:V;src:url(file://${dir}/vazirmatn-arabic-wght-normal.woff2)}
@font-face{font-family:V;src:url(file://${dir}/vazirmatn-latin-wght-normal.woff2)}
html,body{margin:0;background:transparent;width:1080px;height:1920px}
.w{position:absolute;left:0;right:0;top:330px;direction:rtl;text-align:center;font-family:V}
.pill{display:inline-block;background:#5b3fd6;color:#fff;font-weight:700;font-size:44px;border-radius:44px;padding:14px 46px 18px}
.h{font-weight:900;font-size:104px;color:#141018;margin-top:26px;line-height:1.3}
.g{font-weight:800;font-size:76px;line-height:1.45;margin-top:14px;background:linear-gradient(270deg,#8b6cff,#f07cc0);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
</style></head><body><div class="w"><div class="pill">نوبت فردا کنسل شد؟</div><div class="h">غصه نخور!</div><div class="g">زیر ۲۰ ثانیه<br>استوری‌ت آماده‌ست</div></div></body></html>`,{waitUntil:'load'});
await p.evaluate(()=>document.fonts.ready);
console.log(JSON.stringify(await p.evaluate(()=>{const r=document.querySelector('.w').getBoundingClientRect();const g=document.querySelector('.g').getBoundingClientRect();return {top:r.top,bottom:r.bottom,gw:g.width}})));
await p.screenshot({path:out, omitBackground:true}); await b.close();
