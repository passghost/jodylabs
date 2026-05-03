// smoke_test_ally_follow.js
// Headless diagnostic to compare player anchor (focus) vs ally positions over time.
// Usage: node tools/smoke_test_ally_follow.js

const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const ROOT = path.resolve(__dirname, '..');
  const PORT = 8091; // isolate from other tests
  const url = `http://localhost:${PORT}/pixel_tank_game.html`;

  const mime = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.ico':'image/x-icon' };
  const server = http.createServer((req,res)=>{
    try {
      let reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
      if (reqPath === '/') reqPath = '/pixel_tank_game.html';
      const filePath = path.join(ROOT, reqPath.replace(/\/+/, '/'));
      if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
      fs.stat(filePath, (err, st)=>{
        if (err) { res.statusCode = 404; return res.end('Not found'); }
        if (st.isDirectory()) { const index = path.join(filePath,'index.html'); if (fs.existsSync(index)) return fs.createReadStream(index).pipe(res); res.statusCode=404; return res.end('Not found'); }
        const ext = path.extname(filePath).toLowerCase();
        res.setHeader('Content-Type', mime[ext] || 'application/octet-stream');
        fs.createReadStream(filePath).pipe(res);
      });
    } catch(e){ res.statusCode = 500; res.end('Server error'); }
  }).listen(PORT);
  await new Promise(r=> server.once('listening', r));

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { try { console.log('[PAGE]', m.text()); } catch(_){} });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r=> setTimeout(r, 2200)); // init

  // Force spawn a few allies if none exist
  await page.evaluate(()=>{
    try {
      if (Array.isArray(window.allies) && window.allies.length === 0 && typeof window.spawnAlly === 'function') {
        for (let i=0;i<3;i++) window.spawnAlly((window.tank?window.tank.x:0)+(i*25),(window.tank?window.tank.y:0)+ (i*25), { type: i===0?'pet':'mini' });
      }
      window.__ALLY_DEBUG_MARK = true; // enable markers
    } catch(e) { console.log('spawn fail', e); }
  });

  const samples = [];
  const start = Date.now();
  while (Date.now() - start < 7000) { // 7s sampling
    const snap = await page.evaluate(()=>{
      const out = { t: performance.now(), anchor: { x: window.__PLAYER_ANCHOR_X, y: window.__PLAYER_ANCHOR_Y }, vehicle: { sel: window.selectedVehicle, tx: window.tank && window.tank.x, ty: window.tank && window.tank.y, hx: window.heli && window.heli.x, hy: window.heli && window.heli.y }, allies: [] };
      if (Array.isArray(window.allies)) {
        for (const a of window.allies) out.allies.push({ type: a.allyType, x: a.x, y: a.y });
      }
      return out;
    });
    samples.push(snap);
    await new Promise(r=> setTimeout(r, 250));
  }

  // Analyze horizontal deltas
  let lines = [];
  for (const s of samples) {
    const ax = s.anchor.x; const ay = s.anchor.y;
    if (!Number.isFinite(ax) || !Number.isFinite(ay)) continue;
    for (const a of s.allies) {
      const dx = (a.x - ax).toFixed(1);
      const dy = (a.y - ay).toFixed(1);
      lines.push(`${Math.round(s.t)}ms\t${a.type}\tdx=${dx}\tdy=${dy}`);
    }
  }
  console.log('[ALLY-FOLLOW] sample count', samples.length);
  console.log('[ALLY-FOLLOW] deltas:\n'+lines.slice(0,60).join('\n'));

  // Simple stats: mean absolute horizontal delta per type
  const stats = {};
  for (const s of samples) {
    const ax = s.anchor.x; const ay = s.anchor.y; if (!Number.isFinite(ax)||!Number.isFinite(ay)) continue;
    for (const a of s.allies) {
      const dx = Math.abs(a.x - ax); const dy = Math.abs(a.y - ay);
      stats[a.type] = stats[a.type] || { count:0, sumDx:0, sumDy:0 };
      stats[a.type].count++; stats[a.type].sumDx += dx; stats[a.type].sumDy += dy;
    }
  }
  for (const k of Object.keys(stats)) {
    const st = stats[k];
    st.meanDx = (st.sumDx / st.count).toFixed(2);
    st.meanDy = (st.sumDy / st.count).toFixed(2);
  }
  console.log('[ALLY-FOLLOW] stats', stats);

  await browser.close();
  server.close();
})();
