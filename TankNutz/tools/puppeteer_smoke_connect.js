const puppeteer = require('puppeteer');
(async ()=>{
  const url = 'http://localhost:8080/pixel_tank_game.html';
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  page.on('console', msg => { try{ console.log('[PAGE]', msg.text()); }catch(_){} });
  console.log('Opening', url);
  await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
  await new Promise(r => setTimeout(r, 2000));
  console.log('Injecting hooks');
  await page.exposeFunction('reportSpawn', (type, data)=>{ console.log('[SPAWN]', type, JSON.stringify(data)); });
  await page.evaluate(()=>{
    try{
      const orig = window.spawnMuzzleFlash;
      if (typeof orig === 'function'){
        window.spawnMuzzleFlash = function(x,y,a){ window.reportSpawn('muzzle',{x,y,a,time:Date.now()}); return orig.apply(this, arguments); };
      }
    }catch(_){ }
    try{
      if (Array.isArray(window.enemyBullets)){
        const origPush = window.enemyBullets.push;
        window.enemyBullets.push = function(){ try{ for(const b of arguments){ window.reportSpawn('bullet', b); } }catch(_){} return origPush.apply(this, arguments); };
      }
    }catch(_){ }
  });
  await new Promise(r => setTimeout(r, 8000));
  await browser.close();
  console.log('done');
})().catch(e=>{ console.error(e); process.exit(1); });
