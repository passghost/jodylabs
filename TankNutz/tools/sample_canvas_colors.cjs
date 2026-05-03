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
  // wait for assets to load
  await new Promise(r=> setTimeout(r, 1200));

  const res = await page.evaluate(()=>{
    function isCanvasReady(c){ return c && c.getContext && c.width>0 && c.height>0; }
    const result = {};
    try{
      const bodyC = window.bodyCanvas;
      const turC = window.turretCanvas || window.turretCanvas;
      const canvases = [{name:'bodyCanvas', c: bodyC}, {name:'turretCanvas', c: turC}];
      for (const item of canvases){
        const name = item.name;
        const c = item.c;
        if (!isCanvasReady(c)) { result[name] = { ok:false, reason:'no-canvas' }; continue; }
        try{
          const ctx = c.getContext('2d');
          const w = c.width, h = c.height;
          const img = ctx.getImageData(0,0,w,h).data;
          let blackCount = 0, greenCount = 0, total = 0;
          for (let i=0;i<img.length;i+=4){
            const r = img[i], g = img[i+1], b = img[i+2], a = img[i+3];
            if (a===0) continue; total++;
            const maxch = Math.max(r,g,b);
            if (maxch < 50) blackCount++;
            if (g > 100 && g > r * 1.2 && g > b * 1.2) greenCount++;
          }
          result[name] = { ok:true, w, h, total, blackCount, greenCount };
        }catch(e){ result[name] = { ok:false, reason: 'getImageData-failed', msg: ''+e }; }
      }
    }catch(e){ return { error: ''+e }; }
    return result;
  });

  console.log('Canvas color sample:', JSON.stringify(res, null, 2));
  await browser.close(); server.close();
})();
