import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const dir = process.argv[2];
const font=`@font-face{font-family:V;src:url(file://${dir}/vazirmatn-arabic-wght-normal.woff2)}@font-face{font-family:V;src:url(file://${dir}/vazirmatn-latin-wght-normal.woff2)}html,body{margin:0;background:transparent;width:1080px;height:1920px}`;
const bars=`<span style="display:inline-flex;gap:5px;align-items:center;margin-inline-end:14px">${[22,30,18,30,8,30,22,30].map(h=>`<i style="display:block;width:5px;height:${h}px;border-radius:3px;background:linear-gradient(#e05aa8,#8a5ae0)"></i>`).join('')}</span>`;
const cards={
  cardChar:{h:324, lines:['غصه نخور.','زیر ۲۰ ثانیه استوری‌ت آماده‌ست.']},
  cardEnd:{h:413, lines:['فرفرو رو از کافه‌بازار بگیر.','آیفون داری؟ سایت <span dir="ltr">frfro.ir</span>']},
};
const b=await chromium.launch(); const p=await b.newPage({viewport:{width:1080,height:1920}});
for (const [k,c] of Object.entries(cards)) {
  await p.setContent(`<style>${font}.c{position:absolute;left:68px;width:944px;top:116px;height:${c.h}px;box-sizing:border-box;background:#fff;border:5px solid #f28bbd;border-radius:46px;direction:rtl;font-family:V;padding:34px 44px 0;display:flex;flex-direction:column;justify-content:center}
  .l{display:flex;align-items:center;color:#7b55d9;font-size:30px;font-weight:600}.t{font-size:60px;font-weight:800;color:#141018;line-height:1.55}</style>
  <div class="c"><div class="l">${bars}<span>گوشی فرفرو می‌خونه</span></div><div class="t">${c.lines.join('<br>')}</div></div>`,{waitUntil:'load'});
  await p.evaluate(()=>document.fonts.ready); await p.screenshot({path:`${dir}/${k}.png`,omitBackground:true});
}
await b.close();
