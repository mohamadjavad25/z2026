import { createRequire } from 'module'; const { chromium } = createRequire(import.meta.url)('playwright');
const dir = process.argv[2];
const caps = {
  hook: {y:1180, html:'نوبت فردا <em>کنسل</em> شد.'},
  chair:{y:1180, html:'یه صندلی خالی.<br><em>یه روز ضرر.</em>'},
  pay:  {y:1180, html:'۸ دقیقه بعد:<br><em>پر شد.</em>'},
  payB: {y:1180, html:'کنسلی داشتم.<br><em>۸ دقیقه بعد پر شد.</em>'},
  n1:{y:300, top:1, html:'وقت‌های خالیت رو<br><em>خودش پیدا می‌کنه</em>'},
  n2:{y:300, top:1, html:'ظاهرش رو <em>انتخاب کن</em>'},
  n3:{y:300, top:1, html:'بفرست و <em>لینک رو بچسبون</em>'},
  d1:   {y:620, top:1, html:'نوبت‌های خالیت'},
  d2:   {y:620, top:1, html:'بفرست به اینستاگرام'},
  d3:   {y:620, top:1, html:'لینک رو بچسبون'},
};
const b = await chromium.launch(); const p = await b.newPage({viewport:{width:1080,height:1920}});
for (const [k,c] of Object.entries(caps)) {
  await p.setContent(`<html><head><style>
  @font-face{font-family:V;src:url(file://${dir}/vazirmatn-arabic-wght-normal.woff2)}
  @font-face{font-family:V;src:url(file://${dir}/vazirmatn-latin-wght-normal.woff2)}
  html,body{margin:0;background:transparent;width:1080px;height:1920px}
  .b{position:absolute;left:50%;top:${c.y}px;transform:translate(-50%,-50%);direction:rtl;text-align:center;
   font-family:V;font-weight:800;font-size:${c.top?66:72}px;line-height:1.45;color:#fff;white-space:nowrap;
   background:rgba(28,20,36,.82);border-radius:30px;padding:${c.top?'18px 44px':'26px 52px'}}
  em{font-style:normal;color:#ff7db8}</style></head><body><div class="b">${c.html}</div></body></html>`, {waitUntil:'networkidle'});
  await p.evaluate(()=>document.fonts.ready);
  await p.screenshot({path:`${dir}/${k}.png`, omitBackground:true});
}
await b.close();
