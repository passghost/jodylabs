// smoke_test_chain_tank_illustration.cjs
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async ()=>{ /* modified for chain tank illustration test */
  const ROOT = path.resolve(__dirname, '..');
  const PORT = 8092; // different port
  const url = `http://localhost:${PORT}/pixel_tank_game.html`;
  const mime = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.ico':'image/x-icon' };
  const server = http.createServer((req,res)=>{ try { let reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname); if (reqPath === '/') reqPath = '/pixel_tank_game.html'; const filePath = path.join(ROOT, reqPath.replace(/\/+/, '/')); if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); } fs.stat(filePath,(err,st)=>{ if (err){ res.statusCode=404; return res.end('Not found'); } if (st.isDirectory()){ const index = path.join(filePath,'index.html'); if (fs.existsSync(index)) return fs.createReadStream(index).pipe(res); res.statusCode=404; return res.end('Not found'); } const ext = path.extname(filePath).toLowerCase(); res.setHeader('Content-Type', mime[ext] || 'application/octet-stream'); fs.createReadStream(filePath).pipe(res); }); } catch(e){ res.statusCode=500; res.end('Server error'); } }).listen(PORT);
  await new Promise(r=> server.once('listening', r));
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { try { console.log('[PAGE]', m.text()); } catch(_){} });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r=> setTimeout(r, 2200));
  await page.evaluate(async ()=>{ 
    try {
      if (!window.__CHAIN_TEST_SPAWNED) {
        const baseX = (window.tank?window.tank.x: (window.heli?window.heli.x:0)) || 100;
        const baseY = (window.tank?window.tank.y: (window.heli?window.heli.y:0)) || 100;
        // Import spawnEnemy and spawnChainedTank
        const { spawnEnemy } = await import('./js/critters.js');
        const { spawnChainedTank } = await import('./js/alternativetanks.js');
  // Spawn a chain tank directly and request a higher minimum forward speed
  // so movement is easier to observe in automated samples.
  const chainTank = spawnChainedTank(1000, 1000, { minSpeed: 120 });
        if (chainTank) {
          // mark this instance so samples can track it specifically
          try{ chainTank._chainTestId = 'spawned_1'; }catch(_){ }
          window.enemies = window.enemies || [];
          window.enemies.push(chainTank);
          console.log('[CHAIN-TEST] spawned chain tank at', chainTank.x, chainTank.y);
        } else {
          console.log('[CHAIN-TEST] failed to spawn chain tank');
        }
        window.__CHAIN_TEST_SPAWNED = true;
      }
    } catch(e) { console.log('spawn fail', e); }
  });
  const samples = []; const start = Date.now();
  // sample more frequently and only the spawned instance so small movement is visible
  const DURATION_MS = 2500; const INTERVAL_MS = 100;
  while (Date.now() - start < DURATION_MS) {
    const snap = await page.evaluate(async ()=>{
      const enemies = window.enemies || [];
      // find our specifically spawned chain tank
      const chainEnemies = enemies.filter(e => e._chainTestId === 'spawned_1');
      const out = { t: performance.now(), chainTanks: [] };
      for (const e of chainEnemies) {
        const hasDrawFunction = typeof e.draw === 'function';
        const hasSprite = e.sprite && e.sprite.width > 0 && e.sprite.height > 0;
        const spriteData = hasSprite ? { width: e.sprite.width, height: e.sprite.height } : null;
        out.chainTanks.push({ x: e.x, y: e.y, hasDrawFunction, hasSprite, spriteData });
      }
      return out;
    });
    samples.push(snap);
    await new Promise(r=> setTimeout(r, INTERVAL_MS));
  }
  console.log('[CHAIN-TANK] sample count', samples.length);
  for (const s of samples) {
    if (s.chainTanks.length > 0) {
      console.log(`[CHAIN-TANK] at ${Math.round(s.t)}ms: ${s.chainTanks.length} chain tanks`);
      for (const ct of s.chainTanks) {
        console.log(`  - Position: (${ct.x.toFixed(1)}, ${ct.y.toFixed(1)}), Has Draw Function: ${ct.hasDrawFunction}, Has Sprite: ${ct.hasSprite}, Size: ${ct.spriteData ? `${ct.spriteData.width}x${ct.spriteData.height}` : 'N/A'}`);
      }
    } else {
      console.log(`[CHAIN-TANK] at ${Math.round(s.t)}ms: No chain tanks found`);
    }
  }
  const hasIllustration = samples.some(s => s.chainTanks.some(ct => ct.hasDrawFunction || ct.hasSprite));
  console.log('[CHAIN-TANK] Illustration check:', hasIllustration ? 'PASS - Chain tank has graphics' : 'FAIL - No graphics found');
  await browser.close(); server.close();
})();
