const puppeteer = require('puppeteer');
const http = require('http');
const fs = require('fs');
const path = require('path');

(async ()=>{
  const ROOT = path.resolve(__dirname, '..');
  const PORT = 8092;
  const url = `http://localhost:${PORT}/pixel_tank_game.html`;
  const mime = { '.html':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.json':'application/json; charset=utf-8','.ico':'image/x-icon' };
  const server = http.createServer((req,res)=>{ try { let reqPath = decodeURIComponent(new URL(req.url, `http://${req.headers.host}`).pathname); if (reqPath === '/') reqPath = '/pixel_tank_game.html'; const filePath = path.join(ROOT, reqPath.replace(/\/+/,'/')); if (!filePath.startsWith(ROOT)) { res.statusCode = 403; return res.end('Forbidden'); } fs.stat(filePath,(err,st)=>{ if (err){ res.statusCode=404; return res.end('Not found'); } if (st.isDirectory()){ const index = path.join(filePath,'index.html'); if (fs.existsSync(index)) return fs.createReadStream(index).pipe(res); res.statusCode=404; return res.end('Not found'); } const ext = path.extname(filePath).toLowerCase(); res.setHeader('Content-Type', mime[ext] || 'application/octet-stream'); fs.createReadStream(filePath).pipe(res); }); } catch(e){ res.statusCode=500; res.end('Server error'); } }).listen(PORT);
  await new Promise(r=> server.once('listening', r));

  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', m => { try { console.log('[PAGE]', m.text()); } catch(_){} });
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r=> setTimeout(r, 900));

  // Palettes must match the PALETTES in js/tankAlly.js
  const PALETTES = [
    { name: 'beige-white', primary: '#EAD7B7', partner: '#FFFFFF' },
    { name: 'black-red', primary: '#000000', partner: '#E53935' },
    { name: 'red-white', primary: '#D32F2F', partner: '#FFFFFF' },
    { name: 'yellow-black', primary: '#FFEB3B', partner: '#000000' },
    { name: 'purple-green', primary: '#9C27B0', partner: '#4CAF50' }
  ];

  // Ensure screenshots folder
  const outDir = path.join(ROOT, 'screenshots'); if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);

  // Spawn one ally per palette at different offsets and take a screenshot of the canvas area
  await page.evaluate(async (palettes)=>{
    try{
      const { spawnAlly } = await import('/js/tankAlly.js');
      const baseX = (window.tank ? window.tank.x : 2000) || 2000;
      const baseY = (window.tank ? window.tank.y : 1500) || 1500;
      window.__TEST_MINIPETS = window.__TEST_MINIPETS || [];
      for (let i=0;i<palettes.length;i++){
        const p = palettes[i];
        const a = spawnAlly(baseX + (i*60) + 20, baseY + (i%2?60:-60), { color: { primary: p.primary, partner: p.partner, _paletteName: p.name }, autoPosition: false });
        if (a) window.__TEST_MINIPETS.push(a);
      }
      console.log('spawned test minipets', window.__TEST_MINIPETS.length);
    }catch(e){ console.log('spawn fail', ''+e); }
  }, PALETTES);

  // wait a bit for rendering
  await new Promise(r=> setTimeout(r, 700));

  // locate visible canvas
  const canvas = await page.$('canvas');
  if (!canvas) { console.log('No canvas found'); await browser.close(); server.close(); return; }
  const box = await canvas.boundingBox();

  for (const pal of PALETTES){
    // screenshot full canvas clipped to bounding box
    const file = path.join(outDir, `minipet_${pal.name}.png`);
    await canvas.screenshot({ path: file });
    console.log('wrote', file);
    await new Promise(r=> setTimeout(r, 250));
  }

  await browser.close(); server.close();
})();
