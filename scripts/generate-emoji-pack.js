const fs = require('node:fs');
const path = require('node:path');

const outputDir = path.join(__dirname, '..', 'emojis');
fs.mkdirSync(outputDir, { recursive: true });

// Each icon is intentionally drawn from simple SVG paths so it stays crisp at emoji size.
const icons = [
    ['info', 'معلومة', '<circle cx="64" cy="64" r="34"/><path d="M64 59v25"/><circle cx="64" cy="43" r="3" fill="#6af0d7" stroke="none"/>'],
    ['question', 'سؤال', '<path d="M45 48a20 20 0 1 1 30 17c-8 5-11 9-11 17"/><circle cx="64" cy="94" r="3" fill="#6af0d7" stroke="none"/>'],
    ['sparkles', 'لمعة', '<path d="m64 22 9 29 29 13-29 10-9 31-10-31-29-10 29-13 10-29Z" fill="#6af0d7" fill-opacity=".2"/><path d="m99 22 4 12 12 4-12 4-4 12-4-12-12-4 12-4 4-12Z"/>'],
    ['robot', 'روبوت', '<path d="M64 25V17m-6 0h12"/><rect x="32" y="29" width="64" height="49" rx="15"/><path d="M24 48h8m64 0h8"/><circle cx="48" cy="49" r="4" fill="#6af0d7" stroke="none"/><circle cx="80" cy="49" r="4" fill="#6af0d7" stroke="none"/><path d="M48 66q16 9 32 0M42 83h44l8 25H34l8-25Z"/><rect x="54" y="89" width="20" height="11" rx="3" fill="#6af0d7" fill-opacity=".45"/><path d="M34 88H24V72m70 16h10V72M48 108v7m32-7v7"/>'],
    ['server', 'سيرفر', '<rect x="30" y="26" width="68" height="28" rx="7"/><rect x="30" y="59" width="68" height="28" rx="7"/><rect x="30" y="92" width="68" height="14" rx="6" fill="#6af0d7" fill-opacity=".22"/><circle cx="43" cy="40" r="3" fill="#6af0d7" stroke="none"/><circle cx="43" cy="73" r="3" fill="#6af0d7" stroke="none"/>'],
    ['dashboard', 'لوحة التحكم', '<rect x="25" y="27" width="78" height="74" rx="10"/><path d="M25 48h78M50 48v53M75 48v25"/><path d="M36 38h2m11 0h2m11 0h2" stroke="#6af0d7"/>'],
    ['settings', 'إعدادات', '<path d="m57 22 14 0 3 11 10 4 9-6 10 10-6 9 4 10 11 3v14l-11 3-4 10 6 9-10 10-9-6-10 4-3 11H57l-3-11-10-4-9 6-10-10 6-9-4-10-11-3V60l11-3 4-10-6-9 10-10 9 6 10-4 3-8Z"/><circle cx="64" cy="67" r="15"/>'],
    ['user', 'مستخدم', '<circle cx="64" cy="47" r="17"/><path d="M31 103c2-20 14-31 33-31s31 11 33 31"/><circle cx="64" cy="64" r="43" stroke="#6af0d7" stroke-opacity=".35"/>'],
    ['users', 'أعضاء', '<circle cx="52" cy="48" r="14"/><circle cx="82" cy="53" r="11"/><path d="M23 100c2-18 12-28 29-28 13 0 22 7 27 20m-1 8c2-13 10-20 23-20 10 0 17 6 19 17"/>'],
    ['message', 'رسالة', '<path d="M27 34h74a9 9 0 0 1 9 9v39a9 9 0 0 1-9 9H59l-22 16V91h-10a9 9 0 0 1-9-9V43a9 9 0 0 1 9-9Z"/><path d="M39 55h50M39 70h35"/>'],
    ['mail', 'بريد', '<rect x="22" y="34" width="84" height="60" rx="10"/><path d="m26 42 38 30 38-30"/><path d="M27 88 52 66m49 22L76 66" stroke="#6af0d7"/>'],
    ['bell', 'إشعار', '<path d="M36 82V57a28 28 0 0 1 56 0v25l9 10H27l9-10Z"/><path d="M53 101q11 12 22 0"/><circle cx="96" cy="35" r="9" fill="#6af0d7" stroke="none"/>'],
    ['calendar', 'تقويم', '<rect x="25" y="31" width="78" height="72" rx="9"/><path d="M25 51h78M44 23v16m40-16v16"/><path d="M42 66h8m12 0h8m12 0h8M42 82h8m12 0h8" stroke="#6af0d7"/>'],
    ['clock', 'وقت', '<circle cx="64" cy="64" r="41"/><path d="M64 39v27l20 12" stroke="#6af0d7"/><circle cx="64" cy="64" r="4" fill="#6af0d7" stroke="none"/>'],
    ['link', 'رابط', '<path d="M53 78 43 88a17 17 0 0 1-24-24l19-19a17 17 0 0 1 24 0m13 5 10-10a17 17 0 0 1 24 24L90 83a17 17 0 0 1-24 0"/><path d="m46 70 36-12" stroke="#6af0d7"/>'],
    ['image', 'صورة', '<rect x="23" y="29" width="82" height="70" rx="9"/><circle cx="48" cy="51" r="8" fill="#6af0d7" stroke="none"/><path d="m30 89 23-25 15 14 15-19 22 30"/>'],
    ['file', 'ملف', '<path d="M38 20h35l20 20v68H38a9 9 0 0 1-9-9V29a9 9 0 0 1 9-9Z"/><path d="M73 21v22h20M45 61h39M45 75h39M45 89h26" stroke="#6af0d7"/>'],
    ['download', 'تنزيل', '<path d="M64 24v51m-20-19 20 20 20-20"/><path d="M31 82v18a7 7 0 0 0 7 7h52a7 7 0 0 0 7-7V82"/>'],
    ['upload', 'رفع', '<path d="M64 80V29m-20 20 20-20 20 20"/><path d="M31 82v18a7 7 0 0 0 7 7h52a7 7 0 0 0 7-7V82"/>'],
    ['search', 'بحث', '<circle cx="55" cy="55" r="28"/><path d="m76 76 25 25" stroke="#6af0d7" stroke-width="8"/>'],
    ['filter', 'فلتر', '<path d="M22 28h84L74 63v30l-20 10V63L22 28Z"/><path d="M36 42h56" stroke="#6af0d7"/>'],
    ['chart', 'رسم بياني', '<path d="M28 101V67h17v34m9 0V46h17v55m9 0V28h17v73"/><path d="M21 105h88"/>'],
    ['stats', 'إحصاءات', '<path d="m25 88 24-27 17 13 36-43"/><path d="M81 31h21v21" stroke="#6af0d7"/><circle cx="49" cy="61" r="4" fill="#6af0d7" stroke="none"/>'],
    ['shield', 'حماية', '<path d="M64 18 103 33v26c0 23-14 39-39 51C39 98 25 82 25 59V33l39-15Z"/><rect x="50" y="57" width="28" height="23" rx="4"/><path d="M56 57V50a8 8 0 0 1 16 0v7" stroke="#6af0d7"/>'],
    ['shield-check', 'حماية ناجحة', '<path d="M64 18 103 33v26c0 23-14 39-39 51C39 98 25 82 25 59V33l39-15Z"/><path d="m45 64 13 13 26-29" stroke="#6af0d7"/>'],
    ['shield-alert', 'تحذير أمني', '<path d="M64 18 103 33v26c0 23-14 39-39 51C39 98 25 82 25 59V33l39-15Z"/><path d="M64 43v24"/><circle cx="64" cy="80" r="3" fill="#ffc85b" stroke="none"/>'],
    ['key', 'مفتاح', '<circle cx="48" cy="56" r="20"/><circle cx="48" cy="56" r="6"/><path d="m64 70 34 34m-8-26 11-11m-22 1 11-11" stroke="#6af0d7"/>'],
    ['eye', 'عرض', '<path d="M17 64s17-29 47-29 47 29 47 29-17 29-47 29S17 64 17 64Z"/><circle cx="64" cy="64" r="15"/><circle cx="64" cy="64" r="5" fill="#6af0d7" stroke="none"/>'],
    ['ban', 'حظر', '<circle cx="64" cy="64" r="39"/><path d="m37 37 54 54" stroke="#ff8797" stroke-width="8"/>'],
    ['kick', 'طرد', '<path d="M29 105V24h43v81M39 36l25-6v68l-25-6V36Z"/><circle cx="54" cy="64" r="2.5" fill="#6af0d7" stroke="none"/><path d="M52 64h52m-19-19 19 19-19 19" stroke="#6af0d7" stroke-width="7"/>'],
    ['timeout', 'مهلة', '<path d="M37 23h54M37 105h54M42 27c0 18 9 27 22 37-13 10-22 19-22 37m44-74c0 18-9 27-22 37 13 10 22 19 22 37"/><path d="m51 43 13 15 13-15m-26 42 13-15 13 15" stroke="#6af0d7"/>'],
    ['mute', 'كتم', '<path d="M58 25 39 42H23v39h16l19 17V25Zm21 24 27 27m0-27L79 76"/><path d="m26 26 76 76" stroke="#ff8797"/>'],
    ['unmute', 'إلغاء الكتم', '<path d="M58 25 39 42H23v39h16l19 17V25Zm22 14a34 34 0 0 1 0 46m9-55a47 47 0 0 1 0 64" stroke="#6af0d7"/>'],
    ['raid', 'حماية الغارات', '<path d="M64 18 101 32v25c0 22-13 38-37 51-24-13-37-29-37-51V32l37-14Z"/><circle cx="64" cy="50" r="8" fill="#6af0d7" fill-opacity=".8"/><circle cx="48" cy="56" r="6" fill="#6af0d7" fill-opacity=".55"/><circle cx="80" cy="56" r="6" fill="#6af0d7" fill-opacity=".55"/><path d="M48 77c1-10 6-15 16-15s15 5 16 15m-42 2c1-9 5-13 12-14m40 14c-1-9-5-13-12-14"/>'],
    ['nuke', 'حماية التخريب', '<path d="M64 20 102 35v24c0 22-14 39-38 51-24-12-38-29-38-51V35l38-15Z"/><path d="m43 64 14 14 29-32" stroke="#6af0d7"/><path d="m64 26 5 8 9-2-2 9 8 5-8 5" stroke="#ffd27a"/>'],
    ['anti-spam', 'مكافحة السبام', '<path d="M24 31h80v59H58l-23 17V90h-11V31Z"/><circle cx="46" cy="60" r="4" fill="#6af0d7" stroke="none"/><circle cx="64" cy="60" r="4" fill="#6af0d7" stroke="none"/><circle cx="82" cy="60" r="4" fill="#6af0d7" stroke="none"/><path d="M38 77h52"/>'],
    ['backup', 'نسخ احتياطي', '<path d="M64 20 105 42v44l-41 22-41-22V42l41-22Z"/><path d="m24 42 40 22 40-22M64 64v44m-17-64 40 24" stroke="#6af0d7"/><path d="M50 79h28"/>'],
    ['restore', 'استعادة', '<path d="M27 55a39 39 0 1 1 6 35"/><path d="M27 30v27h27" stroke="#6af0d7"/><path d="m51 67 10 10 19-22"/>'],
    ['ticket', 'تذكرة', '<path d="M25 34h78v19a12 12 0 0 0 0 23v19H25V76a12 12 0 0 0 0-23V34Z"/><path d="M63 43v8m0 9v8m0 9v8" stroke="#6af0d7"/>'],
    ['ticket-open', 'فتح تذكرة', '<path d="M24 34h48v19a12 12 0 0 0 0 23v19H24V76a12 12 0 0 0 0-23V34Z"/><path d="M86 50v30m-15-15h30" stroke="#6af0d7"/>'],
    ['suggestion', 'اقتراح', '<path d="M45 76a29 29 0 1 1 38 0c-6 5-8 10-8 16H53c0-6-2-11-8-16Z"/><path d="M55 102h18m-15 9h12M64 30v12m-27 2 9 8m45-8-9 8" stroke="#6af0d7"/>'],
    ['poll', 'تصويت', '<rect x="28" y="29" width="72" height="70" rx="7"/><path d="M44 49h8m9 0h24M44 65h8m9 0h24M44 81h8m9 0h24"/><path d="m43 49 3 3 5-7m-5 23 3 3 5-7m-5 23 3 3 5-7" stroke="#6af0d7"/>'],
    ['level', 'مستوى جديد', '<path d="M27 99h21V79h19V59h19V39h18"/><path d="M81 28h23v23" stroke="#6af0d7"/><path d="m82 51 22-23"/>'],
    ['trophy', 'إنجاز', '<path d="M43 22h42v24c0 19-9 31-21 31S43 65 43 46V22Z"/><path d="M43 33H25v12c0 14 9 21 22 21m38-33h18v12c0 14-9 21-22 21M64 77v20m-20 9h40M50 96h28"/><path d="m64 31 4 8 9 1-7 6 2 9-8-5-8 5 2-9-7-6 9-1 4-8Z" fill="#6af0d7"/>'],
    ['quran', 'قرآن', '<path d="M22 34q21-11 42 2 21-13 42-2v64q-21-11-42 2-21-13-42-2V34Z"/><path d="M64 36v61M34 48q13-4 23 2m-23 13q13-4 23 2m14-15q11-6 23-2m-23 19q11-6 23-2" stroke="#6af0d7"/>'],
    ['prayer', 'صلاة', '<path d="M31 105V57a33 33 0 0 1 66 0v48H31Z"/><path d="M42 105V61a22 22 0 0 1 44 0v44"/><path d="M50 86q14-19 28 0v12H50V86Z" fill="#6af0d7" fill-opacity=".24"/><path d="M24 49v62m80-62v62M20 55h8m72 0h8"/>'],
    ['mosque', 'مسجد', '<path d="M20 101h88M28 101V61h72v40M21 61l43-31 43 31M54 101V77a10 10 0 0 1 20 0v24M34 51V35h12v25m36-9V35h12v25"/><path d="M64 30V18m-5 7h10" stroke="#6af0d7"/>'],
    ['moon', 'هلال ونجمة', '<circle cx="62" cy="64" r="42" fill="#6af0d7" fill-opacity=".88" stroke="none"/><circle cx="81" cy="60" r="37" fill="#081522" stroke="none"/><path d="m96 47 3.5 7.2 8 1.2-5.8 5.6 1.4 8-7.1-3.8-7.1 3.8 1.4-8-5.8-5.6 8-1.2L96 47Z" fill="#ffe08a" stroke="none"/><circle cx="96" cy="83" r="2.2" fill="#ffe08a" stroke="none"/>'],
    ['dhikr', 'ذكر', '<circle cx="64" cy="64" r="33"/><circle cx="64" cy="31" r="5" fill="#6af0d7" stroke="none"/><circle cx="87" cy="40" r="5" fill="#6af0d7" stroke="none"/><circle cx="97" cy="64" r="5" fill="#6af0d7" stroke="none"/><circle cx="87" cy="88" r="5" fill="#6af0d7" stroke="none"/><circle cx="64" cy="97" r="5" fill="#6af0d7" stroke="none"/><circle cx="41" cy="88" r="5" fill="#6af0d7" stroke="none"/><circle cx="31" cy="64" r="5" fill="#6af0d7" stroke="none"/><circle cx="41" cy="40" r="5" fill="#6af0d7" stroke="none"/>'],
    ['wallet', 'محفظة', '<rect x="25" y="35" width="78" height="61" rx="11"/><path d="M25 48h78"/><path d="M77 60h29v24H77a12 12 0 0 1 0-24Z"/><circle cx="86" cy="72" r="3" fill="#6af0d7" stroke="none"/>'],
    ['coin', 'رصيد', '<circle cx="64" cy="64" r="42"/><circle cx="64" cy="64" r="32"/><path d="M75 47c-3-4-7-6-13-6-7 0-12 4-12 10 0 15 28 7 28 22 0 6-6 11-14 11-6 0-12-2-16-7m16-43v60" stroke="#6af0d7"/>'],
    ['credit-card', 'بطاقة دفع', '<rect x="20" y="33" width="88" height="62" rx="10"/><path d="M20 50h88m-69 27h20"/><rect x="79" y="70" width="18" height="12" rx="3" fill="#6af0d7" fill-opacity=".7" stroke="none"/>'],
    ['receipt', 'فاتورة', '<path d="M33 20h62v89l-10-7-11 7-10-7-10 7-10-7-11 7V20Z"/><path d="M47 42h34m-34 16h34m-34 16h22" stroke="#6af0d7"/>'],
    ['support', 'دعم', '<path d="M25 66v-7a39 39 0 0 1 78 0v7"/><rect x="20" y="62" width="17" height="30" rx="8"/><rect x="91" y="62" width="17" height="30" rx="8"/><path d="M99 89q-3 19-24 19H64"/><circle cx="57" cy="108" r="7" fill="#6af0d7" stroke="none"/>'],
    ['heart', 'قلب', '<path d="M64 101 27 66a23 23 0 0 1 33-32l4 5 4-5a23 23 0 0 1 33 32L64 101Z" fill="#ff718d" fill-opacity=".3" stroke="#ff9bac"/>'],
    ['star', 'نجمة', '<path d="m64 20 12 29 32 3-24 20 8 32-28-17-28 17 8-32-24-20 32-3 12-29Z" fill="#ffe08a" fill-opacity=".3" stroke="#ffe08a"/>'],
];

function renderSvg(name, label, glyph) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="ring" x1="20" y1="15" x2="108" y2="113" gradientUnits="userSpaceOnUse"><stop stop-color="#70f1da"/><stop offset="1" stop-color="#557cff"/></linearGradient>
    <radialGradient id="glow" cx=".3" cy=".24" r=".8"><stop stop-color="#1eb9a7"/><stop offset="1" stop-color="#4774ed"/></radialGradient>
  </defs>
  <circle cx="64" cy="64" r="58" fill="#081522" stroke="url(#ring)" stroke-width="3.5"/>
  <circle cx="64" cy="64" r="46" fill="url(#glow)" opacity=".13"/>
  <g fill="none" stroke="#e8fffb" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">${glyph}</g>
</svg>
`;
}

for (const [name, label, glyph] of icons) {
    fs.writeFileSync(path.join(outputDir, `ys-${name}.svg`), renderSvg(name, label, glyph), 'utf8');
}

const existing = [
    ['ys-logo', 'شعار YS'], ['ys-check', 'نجاح'], ['ys-error', 'خطأ'], ['ys-warning', 'تنبيه'],
    ['ys-loading', 'تحميل'], ['ys-lock', 'قفل'], ['ys-premium', 'Premium'], ['ys-online', 'متصل']
];
const catalog = [...existing, ...icons.map(([name, label]) => [`ys-${name}`, label])];
const cards = catalog.map(([name, label]) => `<article class="emoji-card" data-name="${name} ${label}"><img src="/emojis/${name}.svg" alt="${label}" loading="lazy"><strong>${label}</strong><code>${name}</code><button type="button" data-copy="/emojis/${name}.svg">نسخ الرابط</button></article>`).join('\n');
const page = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="theme-color" content="#081522"><title>إيموجيات YS-Bot</title>
<style>
*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(ellipse at 15% 0%,#123244 0,transparent 36%),linear-gradient(145deg,#081522,#0b1525 55%,#101a2c);color:#eef8fa;font:16px/1.6 system-ui,"Segoe UI",sans-serif;padding:24px}main{max-width:1100px;margin:auto}.hero{display:flex;align-items:center;gap:16px;margin-bottom:20px;padding:19px 22px;border:1px solid #254153;border-radius:20px;background:#0c1b2acc}.hero img{width:56px;height:56px}.hero h1{font-size:clamp(1.3rem,4vw,2rem);margin:0}.hero p{margin:3px 0 0;color:#a5bdc8}.search{display:flex;width:100%;height:48px;margin:0 0 18px;padding:0 14px;border:1px solid #29485a;border-radius:13px;background:#0a1927;color:#fff;font:inherit}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(132px,1fr));gap:12px}.emoji-card{display:grid;justify-items:center;gap:7px;min-width:0;padding:16px 10px 12px;border:1px solid #203a4c;border-radius:18px;background:linear-gradient(145deg,#14283c,#0b1827);text-align:center;transition:transform .2s,border-color .2s,box-shadow .2s}.emoji-card:hover{transform:translateY(-3px);border-color:#4ebfae;box-shadow:0 10px 28px #02071170}.emoji-card img{width:82px;height:82px;object-fit:contain;filter:drop-shadow(0 7px 10px #02071180)}.emoji-card strong{font-size:.88rem}.emoji-card code{max-width:100%;overflow-wrap:anywhere;color:#82dccc;font-size:.7rem}.emoji-card button{width:100%;min-height:34px;border:1px solid #315266;border-radius:9px;background:#112638;color:#dff7f4;font:inherit;font-weight:700;font-size:.76rem;cursor:pointer}.emoji-card button:hover{border-color:#63dccc;background:#153749}.empty{color:#a5bdc8;text-align:center}@media(max-width:480px){body{padding:12px}.hero{padding:14px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}}
</style></head><body><main><header class="hero"><img src="/ys-bot-avatar.svg" alt="YS-Bot"><div><h1>إيموجيات YS-Bot</h1><p>${catalog.length} رمزًا بصيغة SVG · اضغط نسخ الرابط لاستخدامه في الموقع</p></div></header><input id="search" class="search" type="search" placeholder="ابحث عن رمز…" aria-label="ابحث عن رمز"><section id="grid" class="grid">${cards}</section><p id="empty" class="empty" hidden>ما لقيت رمز بهذا الاسم.</p></main><script>const search=document.getElementById('search'),cards=[...document.querySelectorAll('.emoji-card')],empty=document.getElementById('empty');search.addEventListener('input',()=>{const q=search.value.trim().toLocaleLowerCase();let count=0;for(const card of cards){const show=card.dataset.name.toLocaleLowerCase().includes(q);card.hidden=!show;if(show)count++}empty.hidden=count>0});document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{const url=location.origin+button.dataset.copy;try{await navigator.clipboard.writeText(url);button.textContent='تم نسخ الرابط';setTimeout(()=>button.textContent='نسخ الرابط',1300)}catch{button.textContent=url}}));</script></body></html>`;
fs.writeFileSync(path.join(__dirname, '..', 'emoji-pack.html'), page, 'utf8');
console.log(`Generated ${icons.length} new SVG emoji files and a ${catalog.length}-emoji gallery.`);
