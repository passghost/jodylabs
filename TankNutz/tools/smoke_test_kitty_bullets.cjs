// smoke_test_kitty_bullets.cjs
// Headless diagnostic to verify kitty (kittytank) projectiles move frame-to-frame.
// Usage: node tools/smoke_test_kitty_bullets.cjs

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async () => {
  const ROOT = path.resolve(__dirname, '..');
  const PORT = 8091; // separate port from other smoke tests
  const url = `http://localhost:${PORT}/pixel_tank_game.html`;

  const mime = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon'
  };

  const server = http.createServer((req, res) => {
    try {
      let reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
      if (reqPath === '/') reqPath = '/pixel_tank_game.html';
      const filePath = path.join(ROOT, reqPath.replace(/\\+/g, '/'));
      if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
      fs.stat(filePath, (err, stat) => {
        if (err) { res.statusCode = 404; return res.end('Not found'); }
        if (stat.isDirectory()) { const index = path.join(filePath, 'index.html'); if (fs.existsSync(index)) return fs.createReadStream(index).pipe(res); res.statusCode = 404; return res.end('Not found'); }
        const ext = path.extname(filePath).toLowerCase(); res.setHeader('Content-Type', mime[ext] || 'application/octet-stream'); fs.createReadStream(filePath).pipe(res);
      });
    } catch (e) { res.statusCode = 500; res.end('Server error'); }
  }).listen(PORT);

  await new Promise(r => server.once('listening', r));

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => { try { console.log('[PAGE]', msg.text()); } catch(_){} });

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));

  // Force a few kitty spawns early (if API available)
  try {
    await page.evaluate(() => {
      try {
        if (typeof window.spawnKittyTank === 'function') {
          for (let k=0;k<3;k++) window.spawnKittyTank( (window.tank?window.tank.x:400) + 100 + k*40, (window.tank?window.tank.y:400) - 120, {}, window.enemies );
        }
      } catch(e) { console.log('spawnKittyTank inject fail', e); }
    });
  } catch(e) { console.log('spawn eval error', e); }

  // Enable debug to capture console velocity logs if present
  await page.evaluate(() => { window.__DEBUG_KITTY = true; });

  // Observe bullet traces for a period
  const samples = [];
  for (let s=0; s<20; s++) {
    const traceChunk = await page.evaluate(() => {
      try {
        if (Array.isArray(window.__kittyBulletTrace)) return window.__kittyBulletTrace.slice(-20);
        return null;
      } catch(e){ return { err: String(e) }; }
    });
    samples.push({ t: Date.now(), traceChunk });
    await new Promise(r => setTimeout(r, 250));
  }

  // Analyze movement of first bullet id 0 in collected samples
  let movedTotal = 0; let lastPos = null; let steps = 0;
  for (const group of samples) {
    if (Array.isArray(group.traceChunk)) {
      const latest0 = [...group.traceChunk].reverse().find(e => e.i === 0);
      if (latest0){
        if (lastPos){ movedTotal += Math.hypot(latest0.x - lastPos.x, latest0.y - lastPos.y); steps++; }
        lastPos = { x: latest0.x, y: latest0.y };
      }
    }
  }

  const report = { movedTotal: +movedTotal.toFixed(2), steps, stationary: movedTotal < 1 };
  console.log('[RESULT] kittyBullet movement', report);
  if (report.stationary) {
    const finalTrace = samples[samples.length-1].traceChunk;
    console.log('[RESULT] finalTrace', finalTrace);
  }

  await browser.close();
  server.close();
})();
