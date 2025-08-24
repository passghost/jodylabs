const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const ROOT = path.resolve(__dirname, '..');
  const PORT = 8091;
  const url = `http://localhost:${PORT}/pixel_tank_game.html`;
  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };

  const server = http.createServer((req, res) => {
    try{
      let reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
      if (reqPath === '/') reqPath = '/pixel_tank_game.html';
      const filePath = path.join(ROOT, reqPath.replace(/\/+/, '/'));
      if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
      fs.stat(filePath, (err, stat) => {
        if (err) { res.statusCode = 404; return res.end('Not found'); }
        if (stat.isDirectory()){ const index = path.join(filePath, 'index.html'); if (fs.existsSync(index)) return fs.createReadStream(index).pipe(res); res.statusCode = 404; return res.end('Not found'); }
        const ext = path.extname(filePath).toLowerCase(); res.setHeader('Content-Type', mime[ext] || 'application/octet-stream'); fs.createReadStream(filePath).pipe(res);
      });
    }catch(e){ res.statusCode = 500; res.end('Server error'); }
  }).listen(PORT);
  await new Promise((r)=> server.once('listening', r));

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => { try{ const txt = msg.text(); console.log('[PAGE]', txt); }catch(e){} });

  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  // wait for spawns and updates to stabilize
  await new Promise(r => setTimeout(r, 4000));

  // enable overlay to help visual debugging
  await page.evaluate(()=>{ try{ window.__DEBUG_KITTEN_OVERLAY = true; }catch(_){ } });

  const info = await page.evaluate(()=>{
    try{
      const enemies = window.enemies || [];
      // if none, try to force spawn a pinkdot near the player (best-effort)
      if (!enemies || enemies.length === 0){ try{ if (typeof window.spawnEnemy === 'function') window.spawnEnemy({ kind: 'pinkdot', x: 200, y: 200 }); }catch(_){ } }
      const list = (window.enemies || []).slice(0,30).map((k,i)=>({ idx: i, kind: k && k.kind, x: k && k.x, y: k && k.y, vx: k && k.vx, vy: k && k.vy, moving: k && k.moving, hasKitten: !!(k && k._kitten), kittenBodyAngle: (k && k._kitten && typeof k._kitten._bodyAngle === 'number') ? k._kitten._bodyAngle : null }));
      const found = (window.enemies || []).find(e => e && (e.kind === 'pinkdot' || (e._kitten && e.kind)));
      const lastKit = (typeof window !== 'undefined' && window.__lastKitten) ? { kind: window.__lastKitten.kind, x: window.__lastKitten.x, y: window.__lastKitten.y, vx: window.__lastKitten.vx, vy: window.__lastKitten.vy, bodyAngle: window.__lastKitten._kitten && window.__lastKitten._kitten._bodyAngle } : null;
      return { count: (window.enemies || []).length, list, found: !!found, lastKit };
    }catch(e){ return { error: String(e) }; }
  });
  console.log('INSPECT:', JSON.stringify(info, null, 2));

  await browser.close();
  server.close();
})();
