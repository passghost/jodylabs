// smoke_test_puppeteer_new.js
// Lightweight Puppeteer smoke test: open the app, capture console logs and a screenshot
// Usage: npm install puppeteer --save-dev
//        node tools/smoke_test_puppeteer_new.js
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

async function run(){
  const outDir = path.join(__dirname, 'smoke_results');
  try{ fs.mkdirSync(outDir, { recursive: true }); }catch(_){ }
  const url = process.env.SMOKE_URL || 'http://127.0.0.1:8080/pixel_tank_game.html';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  const logs = [];
  page.on('console', msg => {
    try{ const text = msg.text(); const ts = new Date().toISOString(); logs.push({ ts, type: msg.type(), text }); console.log(`[page:${msg.type()}]`, text); }catch(_){ }
  });
  page.on('pageerror', err => { logs.push({ ts: new Date().toISOString(), type: 'pageerror', text: String(err && err.stack || err) }); console.error('[pageerror]', err && err.stack || err); });

  await page.setViewport({ width: 1600, height: 1200 });
  try{
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
  }catch(e){ console.error('goto failed', e && e.message); }

  // Wait a short while for first-frame animations and startup logs
  await page.waitForTimeout(800);

  const screenshotPath = path.join(outDir, 'frame0.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // save captured logs
  try{ fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify(logs, null, 2), 'utf8'); }catch(_){ }

  console.log('Saved screenshot to', screenshotPath);
  console.log('Saved console logs to', path.join(outDir, 'console.json'));
  await browser.close();
}

run().catch(err => { console.error('smoke test failed', err && err.stack || err); process.exit(2); });
