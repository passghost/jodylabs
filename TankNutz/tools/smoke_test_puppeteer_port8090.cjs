// smoke_test_puppeteer_port8090.cjs - CommonJS copy
const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const ROOT = path.resolve(__dirname, '..');
  const PORT = 8090;
  const url = `http://localhost:${PORT}/pixel_tank_game.html`;

  const mime = { '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.json': 'application/json; charset=utf-8', '.ico': 'image/x-icon' };

  const server = http.createServer((req, res) => {
    try{
      let reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname);
      if (reqPath === '/') reqPath = '/pixel_tank_game.html';
      const filePath = path.join(ROOT, reqPath.replace(/\/+/g, '/'));
      if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); }
      fs.stat(filePath, (err, stat) => {
        if (err) { res.statusCode = 404; return res.end('Not found'); }
        if (stat.isDirectory()){ const index = path.join(filePath, 'index.html'); if (fs.existsSync(index)) return fs.createReadStream(index).pipe(res); res.statusCode = 404; return res.end('Not found'); }
        const ext = path.extname(filePath).toLowerCase(); res.setHeader('Content-Type', mime[ext] || 'application/octet-stream'); fs.createReadStream(filePath).pipe(res);
      });
    }catch(e){ res.statusCode = 500; res.end('Server error'); }
  }).listen(PORT);

  await new Promise((resolve, reject)=> server.once('listening', resolve));

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => { try{ const txt = msg.text(); console.log('[PAGE]', txt); }catch(e){} });

  await page.exposeFunction('reportSpawn', (type, data)=>{ console.log('[SPAWN]', type, JSON.stringify(data)); });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  try{
    await page.evaluate(()=>{ try{ if (Array.isArray(window.critters)) window.__critters_serializable = window.critters.slice(0,6).map(c=>({ x: c.x, y: c.y, kind: c.kind })); // animals alias may exist; capture if present
      if (Array.isArray(window.animals) && window.animals !== window.critters) window.__animals_serializable = window.animals.slice(0,6).map(a=>({ x: a.x, y: a.y, kind: a.kind })); }catch(_){ } });
  }catch(_){ }
  try{ const diag = await page.evaluate(()=>{ try{ return window.__critters_diag || null; }catch(_){ return null; } }); console.log('[DIAG]', JSON.stringify(diag)); }catch(_){ }
  try{ const diag2 = await page.evaluate(()=>{ try{ return window.__critters_diag_spawn || null; }catch(_){ return null; } }); console.log('[DIAG_SPAWN]', JSON.stringify(diag2)); }catch(_){ }
  try{ const spawnSnap = await page.evaluate(()=>{ try{ return window.__critters_spawn_snapshot || null; }catch(_){ return null; } }); console.log('[SPAWN_SNAPSHOT]', JSON.stringify(spawnSnap)); }catch(_){ }
  try{ const aspawn = await page.evaluate(()=>{ try{ return window.__animals_spawn_snapshot || null; }catch(_){ return null; } }); console.log('[ANIMALS_SPAWN_SNAPSHOT]', JSON.stringify(aspawn)); }catch(_){ }
  try{
    const summary = await page.evaluate(()=>{
      try{
        const d1 = (window.__critters_diag || null);
        const d2 = (window.__critters_diag_spawn || null);
        const sSnap = (window.__critters_spawn_snapshot || null);
        const aSnap = (window.__animals_spawn_snapshot || null);
        const serC = (window.__critters_serializable || null);
        const serA = (window.__animals_serializable || null);
  const raw = { critters: [], animals: [] };
  try{ if (Array.isArray(window.__critters_sample_list)) raw.critters = window.__critters_sample_list.slice(0,6); }catch(_){ }
  try{ if (Array.isArray(window.critters)) raw.critters = raw.critters.concat(window.critters.slice(0,6).map(c=>({x:c.x,y:c.y,kind:c.kind}))).slice(0,6); }catch(_){ }
  // capture animals only if it's not merely an alias of critters
  try{ if (Array.isArray(window.__animals_sample_list)) raw.animals = window.__animals_sample_list.slice(0,6); }catch(_){ }
  try{ if (Array.isArray(window.animals) && window.animals !== window.critters) raw.animals = raw.animals.concat(window.animals.slice(0,6).map(a=>({x:a.x,y:a.y,kind:a.kind}))).slice(0,6); }catch(_){ }
        return { diag: d1, diag_spawn: d2, spawnSnapshot: sSnap, animalsSpawnSnapshot: aSnap, serializable: { critters: serC, animals: serA }, rawSamples: raw };
      }catch(e){ return { error: String(e) }; }
    });
    console.log('[SUMMARY]', JSON.stringify(summary));
  }catch(_){ }
  try{
    const dataUrl = await page.evaluate(()=>{ try{ const c = document.getElementById('game'); if (!c || !c.toDataURL) return null; return c.toDataURL('image/png'); }catch(_){ return null; } });
    if (dataUrl){ const base64 = dataUrl.replace(/^data:image\/png;base64,/, ''); const outPath = path.join(ROOT, 'tmp_canvas.png'); fs.writeFileSync(outPath, Buffer.from(base64, 'base64')); console.log('[CANVAS_SAVED]', outPath); } else { console.log('[CANVAS_SAVED]', 'no-canvas'); }
  }catch(e){ console.log('[CANVAS_CAPTURE_ERROR]', String(e)); }
  await page.evaluate(()=>{ try{ const origFlash = window.spawnMuzzleFlash; if (typeof origFlash === 'function'){ window.spawnMuzzleFlash = function(x,y,a){ window.reportSpawn('muzzle', { x,y,a, time: Date.now() }); return origFlash.apply(this, arguments); } } if (Array.isArray(window.enemyBullets)){ const origPush = window.enemyBullets.push; window.enemyBullets.push = function(){ try{ for(const b of arguments){ window.reportSpawn('bullet', b); } }catch(_){ } return origPush.apply(this, arguments); } } }catch(e){ console.log('hook failed', e); } });
  await new Promise(r => setTimeout(r, 8000));
  await browser.close();
  server.close();
})();
