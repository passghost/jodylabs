// smoke_test_puppeteer_port8090.js - variant using port 8090 to avoid EADDRINUSE
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
  await page.evaluate(()=>{
    try{
      const origFlash = window.spawnMuzzleFlash;
      if (typeof origFlash === 'function'){
        window.spawnMuzzleFlash = function(x,y,a){ window.reportSpawn('muzzle', { x,y,a, time: Date.now() }); return origFlash.apply(this, arguments); }
      }
      if (Array.isArray(window.enemyBullets)){
        const origPush = window.enemyBullets.push;
        window.enemyBullets.push = function(){ try{ for(const b of arguments){ window.reportSpawn('bullet', b); } }catch(_){ } return origPush.apply(this, arguments); }
      }
    }catch(e){ console.log('hook failed', e); }
  });
  await new Promise(r => setTimeout(r, 8000));
  await browser.close();
  server.close();
})();
