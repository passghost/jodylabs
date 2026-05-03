const puppeteer = require('puppeteer');
(async ()=>{
  const url = 'http://localhost:8080/pixel_tank_game.html';
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => { try{ console.log('[PAGE]', msg.text()); }catch(_){} });
  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r=>setTimeout(r,1000));
  // click the language button if present
  const clicked = await page.evaluate(()=>{
    try{
      const b = document.getElementById('tn-lang-btn');
      if (!b) return 'no-button';
      // dispatch pointerdown then click to simulate user gesture
      try{ b.dispatchEvent(new PointerEvent('pointerdown', { bubbles:true, cancelable:true, pointerId:1, button:0 })); }catch(_){ }
      try{ b.click(); }catch(_){ }
      return 'clicked';
    }catch(e){ return 'err-'+(e && e.message); }
  });
  console.log('Click result:', clicked);
  await new Promise(r=>setTimeout(r,1500));
  await browser.close();
  console.log('done');
})().catch(e=>{ console.error(e); process.exit(1); });
