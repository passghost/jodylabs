// Billboards module - extracted from game.js
// create 6 animation frames (64x64) reproducing the original pixel art
export function makeBillboardFrames(){
  const w = 64, h = 64;
  const P = { bgDark:'#0f0f12', baseShadow:'#1b2026', steelDark:'#2f3640', steelMid:'#3f4753', steelLight:'#5b6673', panelShadow:'#8f9aa8', panelLight:'#cfd6e3', panelWhite:'#f3f7ff', neonCyan:'#9feaf9' };
  function R(ctx,x,y,ww,hh,fill){ ctx.fillStyle = fill; ctx.fillRect(x|0,y|0,ww|0,hh|0); }
  function px(ctx,x,y,fill){ R(ctx,x,y,1,1,fill); }
  function cable(ctx, points, color){ for(let i=0;i<points.length;i++){ const [x,y]=points[i]; R(ctx,x,y,2,2,color); } }
  function hexToRgb(hex){ const h = hex.replace('#',''); const n = parseInt(h,16); return { r:(n>>16)&255, g:(n>>8)&255, b:n&255 }; }
  function blend(hexA, hexB, t){ const a = hexToRgb(hexA), b = hexToRgb(hexB); const m = (k)=>Math.round(a[k] + (b[k]-a[k])*t); return `rgb(${m('r')},${m('g')},${m('b')})`; }

  const frames = [];
  for (let f=0; f<6; f++){
    const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  // draw frame (ported from bilboardsingle.html drawFrame)
  // NOTE: removed opaque background so the billboard canvas stays transparent
    R(g,8,56,48,2,P.baseShadow);
    R(g,12,58,40,1,'#0b0d10');
    // Posts
    R(g,16,22,4,34,P.steelDark);
    R(g,16,22,4,12,P.steelLight);
    R(g,16,34,4,12,P.steelMid);
    R(g,44,22,4,34,P.steelDark);
    R(g,44,22,4,12,P.steelLight);
    R(g,44,34,4,12,P.steelMid);
    // Feet
    R(g,12,56,12,4,P.steelMid);
    R(g,40,56,12,4,P.steelMid);
    R(g,11,60,14,1,P.baseShadow);
    R(g,39,60,14,1,P.baseShadow);
    // Braces
    R(g,20,32,4,2,P.steelLight); R(g,24,30,4,2,P.steelLight); R(g,28,28,4,2,P.steelLight);
    R(g,40,32,4,2,P.steelLight); R(g,36,30,4,2,P.steelLight); R(g,32,28,4,2,P.steelLight);
    // Panel frame
    const panel = { x:10, y:6, w:44, h:28 };
    R(g,panel.x-2,panel.y-2,panel.w+4,2,P.steelDark);
    R(g,panel.x-2,panel.y+panel.h,panel.w+4,2,P.steelDark);
    R(g,panel.x-2,panel.y,2,panel.h,P.steelDark);
    R(g,panel.x+panel.w,panel.y,2,panel.h,P.steelDark);
    R(g,panel.x-1,panel.y-1,panel.w+2,1,P.steelLight);
    R(g,panel.x-1,panel.y+panel.h,panel.w+2,1,P.steelMid);
    R(g,panel.x-1,panel.y,1,panel.h,P.steelMid);
    R(g,panel.x+panel.w,panel.y,1,panel.h,P.steelLight);
    // Panel face + flicker
    const flickArr = [0.20,0.55,1.00,0.80,0.40,0.90];
    const flick = flickArr[f%6];
    const base = blend(P.panelLight, P.panelWhite, flick*0.6);
    R(g,panel.x,panel.y,panel.w,panel.h,base);
    // vignette
    R(g,panel.x,panel.y,panel.w,2,P.panelShadow);
    R(g,panel.x,panel.y+panel.h-2,panel.w,2,P.panelShadow);
    R(g,panel.x,panel.y+2,2,panel.h-4,P.panelShadow);
    R(g,panel.x+panel.w-2,panel.y+2,2,panel.h-4,P.panelShadow);
    // scanlines (approx)
    const scan = Math.floor(40 * (1.0 - flick));
    g.globalAlpha = 0.12 + 0.10*(1.0 - flick);
    for (let y=panel.y+2; y<panel.y+panel.h-2; y+=2){ R(g,panel.x+2, y, panel.w-4, 1, `rgb(${220-scan},${225-scan},${232-scan})`); }
    g.globalAlpha = 1;
    // neon rim
    const neonOnArr = [0,1,1,0,1,1];
    if (neonOnArr[f%6]){
      const glow = P.neonCyan;
      for (let x=panel.x-3; x<panel.x+panel.w+3; x++){ px(g,x,panel.y-3,glow); px(g,x,panel.y+panel.h+2,glow); }
      for (let y=panel.y-3; y<panel.y+panel.h+3; y++){ px(g,panel.x-3,y,glow); px(g,panel.x+panel.w+2,y,glow); }
    }
    // bolts
    const bolts = [ [panel.x+2,panel.y+2],[panel.x+panel.w-3,panel.y+2],[panel.x+2,panel.y+panel.h-3],[panel.x+panel.w-3,panel.y+panel.h-3],[panel.x+(panel.w>>1),panel.y+2],[panel.x+(panel.w>>1),panel.y+panel.h-3] ];
    bolts.forEach(([bx,by])=>{ px(g,bx,by,P.steelDark); px(g,bx+1,by+1,P.steelLight); });
    // service box + cable
    R(g,12,40,6,8,P.steelDark);
    R(g,12,40,6,2,P.steelLight);
    cable(g, [[18,48],[20,46],[22,44],[24,42],[26,40],[28,38],[30,36]], P.steelMid);
    // anchor crosshair subtle
    const ax=32, ay=60; g.globalAlpha = 0.25; px(g,ax,ay,P.baseShadow); px(g,ax-1,ay,P.baseShadow); px(g,ax+1,ay,P.baseShadow); px(g,ax,ay-1,P.baseShadow); px(g,ax,ay+1,P.baseShadow); g.globalAlpha = 1;
    frames.push(c);
  }
  return frames;
}

export const billboardFrames = makeBillboardFrames();
export const billboardInstances = [];
// panel rectangle inside the 64x64 billboard canvas where ad images should be drawn
export const BILLBOARD_PANEL = { x: 10, y: 6, w: 44, h: 28 };
// loaded ad canvases (drawImage accepts canvas elements)
export const billboardAdCanvases = [];

// attempt to load ad images from assets/Adimages. We look for a small manifest first
// (assets/Adimages/manifest.json). If missing, fall back to probing a small
// numbered filename pattern (ad1.png..ad12.png). All failures are tolerated.
async function _loadAdImage(url){ return new Promise((resolve)=>{ try{ const img = new Image(); img.onload = ()=>{ try{ const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img,0,0); resolve(c); }catch(_){ resolve(null); } }; img.onerror = ()=>resolve(null); img.src = url; }catch(_){ resolve(null); } }); }

export async function loadAdImages(){
  // Try multiple strategies to discover any image files under common ad folders.
  // Strategies (in order): manifest.json, directory listing HTML parsing, numeric probe.
  // Prefer the project's top-level `Adimages` directory if present, then legacy `assets/Adimages`.
  const bases = ['Adimages', 'assets/Adimages', 'assets/Adimages/', 'assets'];
  const tried = [];
  try{
    for (const baseOrig of bases){
      const base = baseOrig.replace(/\\/g, '/');
        // Track whether the base path exists (manifest or directory listing succeeded)
        let baseAccessible = false;
        // 1) manifest.json
        try{
          const manifestUrl = (base.endsWith('/') ? base : base + '/') + 'manifest.json';
          const resp = await fetch(manifestUrl);
          if (resp && resp.ok){
            baseAccessible = true;
            const list = await resp.json();
            if (Array.isArray(list) && list.length){
              for (const name of list){ const url = (base.endsWith('/')? base : base + '/') + name; tried.push(url); const c = await _loadAdImage(url); if (c) billboardAdCanvases.push(c); }
            }
          }
        }catch(_){ }
        if (billboardAdCanvases.length) break;

        // 2) try to fetch directory HTML listing (http-server exposes a simple index)
        try{
          const dirUrl = (base.endsWith('/') ? base : base + '/') ;
          const resp = await fetch(dirUrl);
          if (resp && resp.ok){
            baseAccessible = true;
            const ct = resp.headers.get('content-type') || '';
            if (ct.indexOf('text/html') !== -1){
              const html = await resp.text();
              // find href values
              const hrefRe = /href\s*=\s*"([^"]+)"/g;
              let m; const found = [];
              while((m = hrefRe.exec(html)) !== null){ const href = m[1]; if (!href || href === '../') continue; const lower = href.toLowerCase(); if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg') || lower.endsWith('.webp') || lower.endsWith('.gif')){ found.push(href); } }
              for (const href of found){
                // resolve relative href to absolute path under base
                let url;
                try{ url = new URL(href, window.location.origin + '/' + dirUrl).toString(); }catch(_){ url = dirUrl + href; }
                tried.push(url);
                const c = await _loadAdImage(url);
                if (c) billboardAdCanvases.push(c);
              }
            }
          }
        }catch(_){ }
        if (billboardAdCanvases.length) break;

        // 3) numeric probe as a last resort — only probe if the base path looks accessible
        if (baseAccessible){
          try{
            for (let i=1;i<=12;i++){ const url = (base.endsWith('/')? base : base + '/') + `ad${i}.png`; tried.push(url); const c = await _loadAdImage(url); if (c) billboardAdCanvases.push(c); }
          }catch(_){ }
        }
      if (billboardAdCanvases.length) break;
    }
  }catch(e){ if (typeof console !== 'undefined' && console.warn) console.warn('loadAdImages failed', e); }
  if (billboardAdCanvases.length === 0){ if (typeof console !== 'undefined' && console.log) console.log('billboards: no ad images found; tried', tried.slice(0,40)); }
  else { if (typeof console !== 'undefined' && console.log) console.log('billboards: loaded', billboardAdCanvases.length, 'ad canvases'); }
  return billboardAdCanvases;
}

// If loader found nothing, attempt quick local fallbacks (screenshots, favicon)
async function _loadFallbacks(){
  if (billboardAdCanvases.length) return billboardAdCanvases;
  const fallbacks = ['screenshots/kitten.png','favicon.ico','assets/fatsammich.png'];
  for (const f of fallbacks){ try{ const c = await _loadAdImage(f); if (c) billboardAdCanvases.push(c); }catch(_){} }
  if (billboardAdCanvases.length && typeof console !== 'undefined' && console.log) console.log('billboards: loaded fallbacks', billboardAdCanvases.length);
  return billboardAdCanvases;
}

function _makePlaceholderAd(w = 44, h = 28){
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  // gradient background
  const ggrad = g.createLinearGradient(0,0,w, h); ggrad.addColorStop(0, '#ffcc66'); ggrad.addColorStop(1, '#ff8866'); g.fillStyle = ggrad; g.fillRect(0,0,w,h);
  // big AD text (pixel-style)
  g.fillStyle = '#222'; g.font = 'bold 14px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AD', w/2, h/2 - 2);
  // small caption
  g.font = '9px sans-serif'; g.fillText('PLACEHOLDER', w/2, h - 6);
  return c;
}
export const BILLBOARD_COUNT = 20;
// Doubled default size: scale values were increased so billboards render at 2x
// Shrink billboards by 25% (previously doubled twice)
export const UNIFORM_BASE = 2.4; // vertical scale for all billboards (reduced by 25%)
export const WIDTH_FACTOR = 3.60; // horizontal widen factor (reduced by 25%)

export function initBillboards(WORLD_W, WORLD_H){
  // populate instances using provided world dimensions
  for (let i=0;i<BILLBOARD_COUNT;i++){
    billboardInstances.push({ x: Math.random()*WORLD_W, y: Math.random()*WORLD_H, animOffset: Math.floor(Math.random()*6), scaleX: WIDTH_FACTOR, scaleY: UNIFORM_BASE,
      hp: 3, broken: false, _chunks: null, _shake:0, _raf: null, _fragTimer:0, _adCanvas: _makePlaceholderAd()
    });
  }
  // asynchronously load ad images and replace placeholders with actual images when available
  loadAdImages().then((list)=>{
    if (!list || list.length === 0) return;
    for (let i = 0; i < billboardInstances.length; i++) {
      billboardInstances[i]._adCanvas = list[i % list.length];
    }
  }).catch(()=>{});
  try{
    // expose for quick runtime inspection and one-time log
    try{ if (typeof window !== 'undefined'){ window.__billboardInstances = billboardInstances; } }catch(_){ }
    if (typeof console !== 'undefined' && console.log){ console.log('billboards: created', billboardInstances.length, 'instances; placeholders assigned'); }
  }catch(_){ }
}

// --- Billboard broken/gibbing animation ---
function _makeBillboardChunks(){
  const P = { bgDark:'#0f0f12', baseShadow:'#1b2026', steelDark:'#2f3640', steelMid:'#3f4753', steelLight:'#5b6673', panelShadow:'#8f9aa8', panelLight:'#cfd6e3', panelWhite:'#f3f7ff', neonCyan:'#9feaf9' };
  const panel = {x:10,y:6,w:44,h:28};
  const chunks = [];
  const addChunk = (x,y,w,h,blocks)=>{ const bb={x,y,w,h,ox:x,oy:y,blocks:blocks||[{dx:0,dy:0,w,h,fill:'#fff'}],vx:0,vy:0,settled:false}; chunks.push(bb); return bb; };
  // Posts
  addChunk(16,22,4,34,[{dx:0,dy:0,w:4,h:12,fill:P.steelLight},{dx:0,dy:12,w:4,h:12,fill:P.steelMid},{dx:0,dy:24,w:4,h:10,fill:P.steelDark}]);
  addChunk(44,22,4,34,[{dx:0,dy:0,w:4,h:12,fill:P.steelLight},{dx:0,dy:12,w:4,h:12,fill:P.steelMid},{dx:0,dy:24,w:4,h:10,fill:P.steelDark}]);
  // Feet
  addChunk(12,56,12,5,[{dx:0,dy:0,w:12,h:4,fill:P.steelMid},{dx:-1,dy:4,w:14,h:1,fill:P.baseShadow}]);
  addChunk(40,56,12,5,[{dx:0,dy:0,w:12,h:4,fill:P.steelMid},{dx:-1,dy:4,w:14,h:1,fill:P.baseShadow}]);
  // Braces
  addChunk(20,28,12,6,[{dx:0,dy:4,w:4,h:2,fill:P.steelLight},{dx:4,dy:2,w:4,h:2,fill:P.steelLight},{dx:8,dy:0,w:4,h:2,fill:P.steelLight}]);
  addChunk(32,28,12,6,[{dx:8,dy:4,w:4,h:2,fill:P.steelLight},{dx:4,dy:2,w:4,h:2,fill:P.steelLight},{dx:0,dy:0,w:4,h:2,fill:P.steelLight}]);
  // Frame sides/top/bottom and panel tiles
  addChunk(panel.x-2,panel.y,2,panel.h,[{dx:0,dy:0,w:2,h:panel.h,fill:P.steelDark}]);
  addChunk(panel.x+panel.w,panel.y,2,panel.h,[{dx:0,dy:0,w:2,h:panel.h,fill:P.steelDark}]);
  addChunk(panel.x-2,panel.y-2,panel.w+4,3,[{dx:0,dy:0,w:panel.w+4,h:2,fill:P.steelDark},{dx:1,dy:2,w:panel.w+2,h:1,fill:P.steelLight}]);
  addChunk(panel.x-2,panel.y+panel.h,panel.w+4,3,[{dx:0,dy:0,w:panel.w+4,h:2,fill:P.steelDark},{dx:1,dy:2,w:panel.w+2,h:1,fill:P.steelMid}]);
  const tw=11, th=14;
  for(let j=0;j<2;j++) for(let i=0;i<4;i++){ const x=panel.x+i*tw, y=panel.y+j*th; const f = 0.25 + 0.15*(i) + 0.05*(j); const fill = (f < 0.9) ? '#cfd6e3' : '#f3f7ff'; const blocks=[{dx:0,dy:0,w:tw,h:th,fill},{dx:0,dy:0,w:tw,h:2,fill:P.panelShadow},{dx:0,dy:th-2,w:tw,h:2,fill:P.panelShadow}]; addChunk(x,y,tw,th,blocks); }
  // Service box
  addChunk(12,40,6,8,[{dx:0,dy:0,w:6,h:8,fill:P.steelDark},{dx:0,dy:0,w:6,h:2,fill:P.steelLight}]);
  // Cable
  const cablePts=[[18,48],[20,46],[22,44],[24,42],[26,40],[28,38],[30,36]];
  const cblocks=cablePts.map(([x,y])=>({dx:x-18,dy:y-36,w:2,h:2,fill:P.steelMid}));
  addChunk(18,36,14,14,cblocks);
  return chunks;
}

export function startBillboardExplode(bb, focusX, focusY){
  if (bb.broken) return;
  // mark broken and create fragments
  bb.broken = true; bb._fragTimer = 0;
  // clear ad immediately so it disappears when billboard starts gibbing
  try{ bb._adCanvas = null; }catch(_){ }

  // explosion visual scale: base tiles are 64px; use instance scale to make gibs larger
  const sFactor = Math.max((bb.scaleX || WIDTH_FACTOR), (bb.scaleY || UNIFORM_BASE), 1);
  bb._explScale = sFactor;
  // amplify shake with scale so larger billboards shake more
  bb._shake = 8 * sFactor;

  // If a focus position is provided (player, bullet, heli), spawn many small world-space
  // fragments above that focus so they fall around the player instead of the scaled
  // billboard-local gib animation. Otherwise fall back to the original billboard chunks.
  if (typeof focusX === 'number' && typeof focusY === 'number'){
    // create world-space fragments
    const chunks = [];
  const sCap = Math.min(sFactor, 4);
  // fewer pieces overall but larger on average
  const count = Math.max(16, Math.round(16 * sCap));
    const palette = ['#cfd6e3','#f3f7ff','#5b6673','#2f3640','#1b2026'];
    for (let i=0;i<count;i++){
      // randomized size distribution: mostly small, some medium, a few large pieces
      let w, h;
      const rsize = Math.random();
      if (rsize < 0.30) {
        // small pieces (30%)
        w = Math.floor(Math.random() * 2) + 2; h = Math.floor(Math.random() * 2) + 2;
      } else if (rsize < 0.80) {
        // medium pieces (50%)
        w = Math.floor(Math.random() * 4) + 5; h = Math.floor(Math.random() * 4) + 5;
      } else {
        // large chunky pieces (20%)
        w = Math.floor(Math.random() * 12) + 10; h = Math.floor(Math.random() * 12) + 10;
      }
  // Localize fragments so they originate near the billboard center (not the player)
  // use billboard world coords as the spawn focus to keep explosion area tight
  const centerX = bb.x || focusX || 0;
  const centerY = bb.y || focusY || 0;
  // small horizontal spread tied to billboard size (increased slightly for better spread)
  const rx = (Math.random() - 0.5) * (48 * sCap);
  // spawn above the billboard top so pieces fall down to the billboard base
  const ry = - (12 + Math.random() * 28 * sCap);
  const x = centerX + rx;
  const y = centerY + ry;
    // give fragments a modest horizontal kick and upward velocity so they arc
    // but don't fly off-screen — scale with sCap but keep smaller than before
    const vx = (Math.random() - 0.5) * (1.0 + sCap * 0.6);
    const vy = - (2 + Math.random() * 4) * (0.9 + sCap * 0.2);
      const fill = palette[Math.floor(Math.random()*palette.length)];
      // sometimes spawn a taller pole-like fragment for variety
      const isPole = (Math.random() < 0.12);
      if (isPole){
        // narrow, tall pole
        w = Math.max(2, Math.floor(Math.random()*3) + 2);
        h = Math.floor(Math.random()*18) + 18; // tall
      }
      const ch = { x, y, w, h, ox: x, oy: y, vx, vy, settled:false, _squished:false, _landed:false, _removeTimer:0, _removed:false, _isPole: !!isPole, blocks:[{dx:0,dy:0,w,h,fill}], _seed: Math.random() };
      chunks.push(ch);
    }
    bb._chunks = chunks;
    bb._worldFragments = true;
  // ground Y should be near the billboard base (a bit below its center)
  bb._fragGroundY = (bb.y || focusY) + Math.round(16 * (bb.scaleY || 1));
  // remember the focus point (billboard center) so rendering/culling can use it
  bb._fragFocus = { x: (bb.x || focusX), y: (bb.y || focusY) };
    return;
  }

  // fallback: original billboard-local chunked gib animation
  bb._chunks = _makeBillboardChunks();
  for (const ch of bb._chunks){
    const cx = ch.x + ch.w/2, cy = ch.y + ch.h/2; const ang = Math.atan2(cy - 32, cx - 32);
    // base speed scaled up for larger billboards
    const sp = (2.0 + Math.random()*2.5) * (1.0 + 0.6 * (sFactor - 1));
    ch.vx = Math.cos(ang) * sp + (Math.random() - 0.5) * sFactor;
    ch.vy = Math.sin(ang) * sp - (3 + Math.random() * 2) * sFactor;
  }
}

// update physics; returns array of "squish" events: {x, y, r}
export function updateBillboardBroken(bb, dt, WORLD_H, mod){
  if (!bb.broken || !bb._chunks) return [];
  // stronger gravity for overhead view so pieces fall and settle more quickly
  const GRAV = 0.55; const gStep = GRAV * (dt * 60);
  bb._shake = Math.max(0, bb._shake - 0.4 * (dt * 60));
  let allSettled = true;
  const squished = [];
  if (bb._worldFragments){
    // world-space fragments fall around the provided focus position
    const groundY = (typeof bb._fragGroundY === 'number') ? bb._fragGroundY : (bb.y || 0) + 12;
  for (const ch of bb._chunks){
      const s = bb._explScale || 1;
      const sCapLoc = Math.min(s, 4);
      // If fragment has already landed, only simulate horizontal slide with damping
      if (ch._landed){
        // horizontal damping while sliding
        ch.vx *= Math.max(0, 1 - (0.12 + 0.02 * sCapLoc) * (dt * 60));
        ch.x += ch.vx * (dt * 60);
        // consider settled when horizontal velocity is very small
        if (Math.abs(ch.vx) <= 0.03){ ch.vx = 0; ch.settled = true; } else { ch.settled = false; allSettled = false; }
        // start removal timer once landed; remove after a short delay so user sees the result
        ch._removeTimer = (ch._removeTimer || 0) + dt;
        const removeAfter = ch._isPole ? 2.2 : 1.2; // poles stay a bit longer
        if (ch._removeTimer >= removeAfter){ ch._removed = true; }
        continue;
      }

      // apply in-air drag so pieces slow horizontally while airborne
      const airDrag = 0.06 + 0.02 * sCapLoc; // stronger drag for larger billboards
      ch.vx *= Math.max(0, 1 - airDrag * (dt * 60));
      // clamp horizontal speed to avoid pieces flying off-screen
      const maxVx = 1.6 + sCapLoc * 0.6;
      if (ch.vx > maxVx) ch.vx = maxVx; if (ch.vx < -maxVx) ch.vx = -maxVx;

      ch.vy += gStep;
      ch.x += ch.vx * (dt * 60);
      ch.y += ch.vy * (dt * 60);
  if (ch.y + ch.h >= groundY){
        // compute a deterministic local random based on seed + original spawn x so nearby
        // fragments differ but results are stable regardless of intermediate movement
        const localRand = Math.abs(Math.sin((ch._Seed || ch._seed || 0.5) * 12.9898 + ch.ox * 0.017));
        // vertical jitter up to about the fragment height plus a small extra so landings vary
        const maxVertJitter = Math.min(24, Math.max(2, Math.round(ch.h * 1.2)));
        const vjit = Math.round(localRand * maxVertJitter);
        // land with small vertical offset so pieces don't all share identical world Y
        ch.y = groundY - ch.h - vjit;
        // stop vertical bounce entirely for a realistic landing
        ch.vy = 0;
        // larger lateral spread impulse, then damping so pieces spread but don't slide unrealistically
        ch.vx += (localRand - 0.5) * (0.6 + s * 0.25);
        // clamp and damp horizontal velocity after landing
        const landMaxVx = 1.2 + s * 0.6;
        if (ch.vx > landMaxVx) ch.vx = landMaxVx;
        if (ch.vx < -landMaxVx) ch.vx = -landMaxVx;
        ch.vx *= 0.45;
        // mark landed so we don't re-apply vertical physics
  ch._landed = true;
  // initialize remove timer so landed fragments will disappear after a short period
  ch._removeTimer = 0;
        // if still moving horizontally, not settled
        if (Math.abs(ch.vx) > 0.03) allSettled = false;
      } else {
        if (Math.abs(ch.vx) > 0.02 || Math.abs(ch.vy) > 0.02) ch.settled = false; else ch.settled = true;
        if (!ch.settled) allSettled = false;
      }
    }
  } else {
    // original billboard-local physics inside 64x64 canvas
    for (const ch of bb._chunks){ ch.vy += gStep; ch.x += ch.vx * (dt * 60); ch.y += ch.vy * (dt * 60); if (ch.y + ch.h >= 60){ ch.y = 60 - ch.h; ch.vy *= -0.35; ch.vx *= 0.92; if (Math.abs(ch.vy) < 0.25) ch.vy = 0; } if (Math.abs(ch.vx) > 0.02 || Math.abs(ch.vy) > 0.02) ch.settled = false; else ch.settled = true; if (!ch.settled) allSettled = false; }
  }
  // collect squish events for chunks that have settled and are not removed
  for (const ch of bb._chunks){
    if (ch._removed) continue;
    if (ch.settled && !ch._squished){
      ch._squished = true;
      if (bb._worldFragments){
        const worldX = ch.x;
        let worldY = ch.y; worldY = mod(worldY, WORLD_H);
        const killR = Math.max(ch.w, ch.h) * 0.6;
        squished.push({ x: worldX, y: worldY, r: killR });
      } else {
        const cx_local = ch.x + ch.w/2 - 32;
        const cy_local = ch.y + ch.h/2 - 32;
        // account for billboard instance explosion scale when mapping local->world
        const s = bb._explScale || 1;
        const worldX = bb.x + cx_local * s;
        let worldY = bb.y + cy_local * s; worldY = mod(worldY, WORLD_H);
        const killR = Math.max(ch.w, ch.h) * 0.6 * s;
        squished.push({ x: worldX, y: worldY, r: killR });
      }
    }
  }

  // remove any chunks that were flagged for removal
  if (bb._chunks.some(ch => ch._removed)){
    bb._chunks = bb._chunks.filter(ch => !ch._removed);
  }
  bb._fragTimer += dt;
  if (bb._fragTimer >= 5.0){
    resetBillboard(bb);
  }
  return squished;
}

export function resetBillboard(bb){ bb.broken = false; bb._chunks = null; bb._shake = 0; bb._fragTimer = 0; bb.hp = 3; bb.animOffset = Math.floor(Math.random()*6); }

export function drawBillboardBroken(bb, ctx, screenX, screenY, scale){
  if (!bb.broken || !bb._chunks) return;
  const sx = Math.random()*bb._shake - bb._shake*0.5; const sy = Math.random()*bb._shake - bb._shake*0.5;
  ctx.save(); ctx.translate(screenX, screenY); ctx.scale(scale, scale);
  // removed filling the full 64x64 with an opaque dark color so background is transparent
  ctx.fillStyle = '#1b2026'; ctx.fillRect(8 + sx, 56 + sy, 48, 2);
  ctx.fillStyle = '#0b0d10'; ctx.fillRect(12 + sx, 58 + sy, 40, 1);
  for (const ch of bb._chunks){ for (const b of ch.blocks){ ctx.fillStyle = b.fill; ctx.fillRect(Math.round(ch.x + b.dx + sx), Math.round(ch.y + b.dy + sy), b.w, b.h); } }
  ctx.restore();
}

// draw world-space fragments: use provided worldToScreen() and camera to map to screen.
export function drawBillboardFragmentsWorld(bb, ctx, worldToScreen, camera){
  if (!bb.broken || !bb._chunks || !bb._worldFragments) return;
  const zoom = (camera && camera.zoom) ? camera.zoom : 1;
  for (const ch of bb._chunks){
    for (const b of ch.blocks){
      ctx.fillStyle = b.fill;
      // fragment world position
      const wx = ch.x + (b.dx || 0);
      const wy = ch.y + (b.dy || 0);
      const s = worldToScreen(wx, wy);
      const dw = Math.max(1, Math.round(b.w * zoom));
      const dh = Math.max(1, Math.round(b.h * zoom));
      ctx.fillRect(Math.round(s.x - dw/2), Math.round(s.y - dh/2), dw, dh);
    }
  // (no debug marker) small fragments are drawn as filled rects above
  }
}
