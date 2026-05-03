const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const URL = 'http://127.0.0.1:8080/pixel_tank_game.html';
  const outDir = path.resolve(__dirname, '..', 'screenshots');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const outPath = path.join(outDir, 'kitten.png');

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => { try{ console.log('[PAGE]', msg.text()); }catch(_){} });

  try{ await page.goto(URL, { waitUntil: 'networkidle2', timeout: 30000 }); }catch(e){ console.log('goto failed', e && e.message); }
  // let the game initialize and spawn enemies (sleep 3s)
  await page.evaluate(()=>new Promise(r=>setTimeout(r,3000)));

  // try to screenshot the game canvas element
  const canvas = await page.$('canvas#game');
  if (canvas){
    await canvas.screenshot({ path: outPath });
    console.log('Saved screenshot to', outPath);
  } else {
    // fallback to full page screenshot
    await page.screenshot({ path: outPath, fullPage: true });
    console.log('Canvas not found; saved full page to', outPath);
  }

  await browser.close();
})();
