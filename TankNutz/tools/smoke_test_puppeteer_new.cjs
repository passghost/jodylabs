// smoke_test_puppeteer_new.cjs
// Lightweight Puppeteer smoke test (CommonJS): open the app, capture console logs and a screenshot
// Usage: npm install puppeteer --save-dev
//        node tools/smoke_test_puppeteer_new.cjs
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer');

(async function run(){
  const outDir = path.join(__dirname, 'smoke_results');
  try{ fs.mkdirSync(outDir, { recursive: true }); }catch(_){ }
  const url = process.env.SMOKE_URL || 'http://127.0.0.1:8080/pixel_tank_game.html';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  // Ensure debug flags are set before any page script executes so instrumented code logs
  try{ await page.evaluateOnNewDocument(() => { try{ window.__KITTY_DEBUG = true; window.__KITTY_DEBUG_WATCH = true; window.__KITTY_DEBUG_FORCE_WATCH = true; }catch(_){ } }); }catch(_){ }
  const logs = [];
  page.on('console', msg => {
    try{ const text = msg.text(); const ts = new Date().toISOString(); logs.push({ ts, type: msg.type(), text }); console.log(`[page:${msg.type()}]`, text); }catch(_){ }
  });
  page.on('pageerror', err => { logs.push({ ts: new Date().toISOString(), type: 'pageerror', text: String(err && err.stack || err) }); console.error('[pageerror]', err && err.stack || err); });
  page.on('response', resp => { try{ if (resp.status() >= 400) logs.push({ ts: new Date().toISOString(), type: 'response', status: resp.status(), url: resp.url() }); }catch(_){ } });

  await page.setViewport({ width: 1600, height: 1200 });
  try{
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
  }catch(e){ console.error('goto failed', e && e.message); }

  // Wait a short while for first-frame animations and startup logs
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  await sleep(3000);

  // If the page exposes a helper to force-install watchers, call it now so
  // per-entity forced watchers are active and can log overwrites.
  try{
    const forced = await page.evaluate(() => { try{ if (typeof globalThis.__forceInstallKittyWatches === 'function') return globalThis.__forceInstallKittyWatches(); return 0; }catch(_){ return 0; } });
    console.log('forceInstallKittyWatches applied to', forced, 'entities');
  }catch(_){ }

  // Allow a little extra time after forcing watches so any late overwrites are logged
  await sleep(1200);

  // Ensure we have at least one kitty entity to inspect. Some runtimes set
  // up enemy arrays lazily or via non-array numeric assignments; explicitly
  // spawn a kitty if the factory is available so instrumentation can attach
  // and we can capture any overwrites. This is non-destructive for the test.
  try{
    const spawned = await page.evaluate(() => {
      try{
        // Prefer global spawn helper if present
        const spawnFn = (typeof globalThis.spawnKittyTank === 'function') ? globalThis.spawnKittyTank : null;
        const enemiesArr = (typeof window !== 'undefined' && window.enemies) ? window.enemies : (globalThis.enemies || null);
        if (spawnFn){ try{ const e = spawnFn(2100, 1500, {}, enemiesArr); return { ok: true, kind: e && e.kind, x: e && e.x, y: e && e.y }; }catch(_){ return { ok: false }; } }
        return { ok: false };
      }catch(_){ return { ok: false }; }
    });
    try{ console.log('spawnKittyTank invoked (guarantee):', spawned); }catch(_){ }
  }catch(_){ }

  // Allow a little extra time after forcing/spawning so any late overwrites are logged
  await sleep(2400);

  // Wait/poll for a kitten or any enemies to appear (short timeout)
  try{
    try{
      await page.waitForFunction(() => {
        try{ return !!(window.__lastKitten) || (Array.isArray(window.enemies) && window.enemies.length > 0); }catch(_){ return false; }
      }, { timeout: 3000 });
    }catch(_){ /* continue even if timeout - we'll snapshot what's available */ }

    // Capture runtime state of the first kitty entity (if present) to help debug
    // whether tileC/_kitten canvases exist or are later removed. Only capture
    // shallow, serializable fields to avoid JSHandle issues.
  const kittyState = await page.evaluate(() => {
      try{
        const snapshotEntity = (e) => {
          if (!e) return null;
          try{
            return {
              kind: e.kind || e.type || null,
              x: (typeof e.x === 'number') ? e.x : null,
              y: (typeof e.y === 'number') ? e.y : null,
              hasTileC: !!e.tileC,
              tileC_w: (e.tileC && typeof e.tileC.width === 'number') ? e.tileC.width : null,
              hasKitten: !!e._kitten,
              bodyC_w: (e._kitten && e._kitten.bodyC && typeof e._kitten.bodyC.width === 'number') ? e._kitten.bodyC.width : null,
              turC_w: (e._kitten && e._kitten.turC && typeof e._kitten.turC.width === 'number') ? e._kitten.turC.width : null,
              drawType: typeof e.draw,
              spawnStack: e.__spawn_stack ? String(e.__spawn_stack).split('\n').slice(0,2).join(' | ') : null
            };
          }catch(_){ return { error: String(_) }; }
        };

        // Try multiple places where enemies may be stored or proxied.
        const containers = [];
        try{ if (Array.isArray(window.enemies)) containers.push({ name: 'window.enemies', list: window.enemies }); }catch(_){ }
        try{ if (!containers.length && window.enemies && typeof window.enemies === 'object') containers.push({ name: 'window.enemies', list: window.enemies }); }catch(_){ }
        try{ if (typeof globalThis !== 'undefined' && globalThis.enemies && globalThis.enemies !== window.enemies) containers.push({ name: 'globalThis.enemies', list: globalThis.enemies }); }catch(_){ }
        try{ if (Array.isArray(window.critters)) containers.push({ name: 'window.critters', list: window.critters }); }catch(_){ }
        try{ if (Array.isArray(window.animals)) containers.push({ name: 'window.animals', list: window.animals }); }catch(_){ }

        let chosen = null; let sample = [];
        for (const c of containers){
          try{
            const list = c.list;
            // If it's a real array, slice safely
            if (Array.isArray(list) && list.length > 0){ chosen = { name: c.name, len: list.length }; sample = list.slice(0,10).map(snapshotEntity); break; }
            // If it's array-like (Proxy), try indexed access up to a cap
            if (list && typeof list === 'object'){
              const out = [];
              try{ const L = typeof list.length === 'number' ? Math.min(200, list.length) : 50; for (let i=0;i<L && out.length<10;i++){ try{ const it = list[i]; if (it) out.push(snapshotEntity(it)); }catch(_){ } } }catch(_){ }
              if (out.length){ chosen = { name: c.name, len: (typeof list.length === 'number' ? list.length : out.length) }; sample = out; break; }
            }
          }catch(_){ }
        }

        // fallback: try scanning a few globals directly
        if (!chosen){
          const found = (window.__lastKitten) ? window.__lastKitten : null;
          if (found){ chosen = { name: '__lastKitten', len: 1 }; sample = [snapshotEntity(found)]; }
        }

        // prefer explicit lastKitten to build lastKitten snapshot
        let lastKitten = null;
        try{ if (window.__lastKitten) lastKitten = snapshotEntity(window.__lastKitten); }catch(_){ }
        const foundAnyEnemies = !!chosen;
        const enemiesCount = chosen ? chosen.len : 0;
        return { foundAnyEnemies, enemiesCount, container: chosen && chosen.name, enemiesSample: sample, lastKitten };
      }catch(_){ return { found: false, error: String(_) }; }
    });
    try{ fs.writeFileSync(path.join(outDir, 'kitty_state.json'), JSON.stringify(kittyState, null, 2), 'utf8'); }catch(_){ }
    console.log('Saved kitty_state to', path.join(outDir, 'kitty_state.json'));
  }catch(_){ console.error('failed to capture kitty state', _); }

  const screenshotPath = path.join(outDir, 'frame0.png');
  await page.screenshot({ path: screenshotPath, fullPage: false });

  // save captured logs
  try{ fs.writeFileSync(path.join(outDir, 'console.json'), JSON.stringify(logs, null, 2), 'utf8'); }catch(_){ }

  console.log('Saved screenshot to', screenshotPath);
  console.log('Saved console logs to', path.join(outDir, 'console.json'));
  await browser.close();
})().catch(err => { console.error('smoke test failed', err && err.stack || err); process.exit(2); });
