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
      const filePath = path.join(ROOT, reqPath.replace(/\/+/g, '/'));
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
  // wait for spawns and updates to stabilize by polling several globals so we avoid a timing race
  const POLL_TIMEOUT = 8000; const POLL_INTERVAL = 300;
  await new Promise(r=>setTimeout(r,100)); // tiny yield (compat for older puppeteer)
  const waited = await page.evaluate(async (POLL_TIMEOUT, POLL_INTERVAL)=>{
    const until = Date.now() + POLL_TIMEOUT;
    function ready(){
      try{
        if (Array.isArray(window.critters) && window.critters.length>0) return true;
        if (Array.isArray(window.enemies) && window.enemies.length>0) return true;
        if (window.__critters_sample_list && window.__critters_sample_list.length>0) return true;
        if (window.__kitty_debug) return true;
      }catch(_){ }
      return false;
    }
    while(Date.now() < until){ if (ready()) return true; await new Promise(r=>setTimeout(r,POLL_INTERVAL)); }
    return false;
  }, POLL_TIMEOUT, POLL_INTERVAL);
  // if poll didn't detect any spawns, still wait a short grace period before proceeding
  if (!waited) await new Promise(r => setTimeout(r, 1500));

  // enable overlay to help visual debugging
  await page.evaluate(()=>{ try{ window.__DEBUG_KITTY_OVERLAY = true; }catch(_){ } });

  // Evaluate several diagnostics: enemies, critters, and kitten draw debug flags
  const info = await page.evaluate(async ()=>{
    try{
      // ensure draw helpers are loaded (they set global drawKittenTile / attachers)
      try{
        if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenTile !== 'function'){
          // import the alternative tank module (module path relative to server root)
          try{ await import('/js/alternativetanks.js'); }catch(_){ }
        }
      }catch(_){ }
      try{
        if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenTile !== 'function'){
          try{ await import('/js/tank.js'); }catch(_){ }
        }
      }catch(_){ }

      // attempt to force-spawn a kittytank if none exist
      const enemies = window.enemies || [];
      if (!enemies || enemies.length === 0){ try{ if (typeof window.spawnEnemy === 'function') window.spawnEnemy({ kind: 'kittytank', x: 200, y: 200 }); }catch(_){ } }

      // If attachers exist, run them on existing enemies to ensure _kitten/tile canvases are created
      try{
        const attach = (typeof globalThis !== 'undefined' && (globalThis.attachKittenRendererCanonical || globalThis.attachKittenRenderer)) ? (globalThis.attachKittenRendererCanonical || globalThis.attachKittenRenderer) : null;
        if (attach && Array.isArray(window.enemies)){
          for (let i=0;i<Math.min(60, window.enemies.length); i++){
            try{ attach(window.enemies[i]); }catch(_){ }
          }
        }
      }catch(_){ }

      // give a moment for attachers/draws to run if spawn or attach happened
      await new Promise(r=>setTimeout(r, 350));

      // Force-call drawKittenTile into a temporary canvas to exercise the helper and populate diagnostics
      try{
        if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenTile === 'function'){
          try{
            if (typeof window !== 'undefined') window.__kitty_debug = window.__kitty_debug || {};
            try{ window.__kitty_debug.drawKittenTile = true; }catch(_){ }
            const c = document.createElement('canvas'); c.width = 64; c.height = 64;
            let ctx = null;
            try{ ctx = c.getContext('2d', { willReadFrequently: true }); }catch(_){ try{ ctx = c.getContext('2d'); }catch(__){ ctx = null; } }
            if (ctx){ try{ globalThis.drawKittenTile(ctx, performance.now()); }catch(_){ try{ globalThis.drawKittenTile(ctx); }catch(__){} }
              try{
                const img = ctx.getImageData(0,0,c.width,c.height).data; let any=false; for (let i=3;i<img.length;i+=4){ if (img[i]!==0){ any=true; break; } }
                if (typeof window !== 'undefined'){
                  window.__kitty_last_draw_info = window.__kitty_last_draw_info || {};
                  window.__kitty_last_draw_info.drawCalled = true;
                  window.__kitty_last_draw_info.hasPixels = any;
                }
              }catch(err2){ if (typeof window !== 'undefined') window.__kitty_last_draw_info = { getImageDataError: String(err2) }; }
            }
          }catch(_){ }
        }
      }catch(_){ }

      const es = (window.enemies || []).slice(0,60);
      const list = es.map((k,i)=>({ idx: i, kind: k && k.kind, x: k && k.x, y: k && k.y, vx: k && k.vx, vy: k && k.vy, moving: k && k.moving, hasKitten: !!(k && k._kitten), kittenBodyAngle: (k && k._kitten && typeof k._kitten._bodyAngle === 'number') ? k._kitten._bodyAngle : null }));
      const found = es.find(e => e && (e.kind === 'kittytank' || (e._kitten && e.kind)));
      const lastKit = (typeof window !== 'undefined' && window.__lastKitten) ? { kind: window.__lastKitten.kind, x: window.__lastKitten.x, y: window.__lastKitten.y, vx: window.__lastKitten.vx, vy: window.__lastKitten.vy, bodyAngle: window.__lastKitten._kitten && window.__lastKitten._kitten._bodyAngle } : null;
  const critSample = (Array.isArray(window.critters) ? window.critters.slice(0,8).map(c=>({x:c.x,y:c.y,kind:c.kind,alive:c.alive})) : []);
  // read any diagnostic snapshots exposed by critters module
  const crit_diag = (typeof window.__critters_diag !== 'undefined') ? window.__critters_diag : null;
  const crit_spawn = (typeof window.__critters_spawn_snapshot !== 'undefined') ? window.__critters_spawn_snapshot : null;
  const crit_diag_spawn = (typeof window.__critters_diag_spawn !== 'undefined') ? window.__critters_diag_spawn : null;
  const crit_raw = (typeof window.__critters_sample_list !== 'undefined') ? window.__critters_sample_list : null;
  return { count: (window.enemies || []).length, list, found: !!found, lastKit, critSample, crit_diag, crit_spawn, crit_diag_spawn, crit_raw, FIRST_ENEMY_TANK: window.FIRST_ENEMY_TANK || null, __kitty_debug: window.__kitty_debug || null, __kitty_last_draw_info: window.__kitty_last_draw_info || null, __KITTY_ANIM_DEBUG: window.__KITTY_ANIM_DEBUG || null };
    }catch(e){ return { error: String(e) }; }
  });
  console.log('INSPECT:', JSON.stringify(info, null, 2));

  await browser.close();
  server.close();
})();
