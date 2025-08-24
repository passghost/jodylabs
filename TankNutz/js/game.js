// --- Canvas + helpers ---
import { initJournal, updateJournal, recordKill, setHealth, initCombos } from './journal.js';
// Toggle verbose debug logging without removing calls during development
const DEBUG = false;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
// Pointer debug overlay disabled: keep a safe placeholder so calls elsewhere
// that check for `window.__pointer_debug_update` don't error but nothing
// is rendered to the page.
window.__pointer_debug_update = null;
const W = canvas.width, H = canvas.height;
// world dimensions (larger than viewport) so foliage/critters can be scattered in map space
// doubled for a bigger jungle: original 2000x1500 -> 4000x3000
const WORLD_W = 4000, WORLD_H = 3000;
// prefer the shared camera from the input module when available (gradual refactor)
const camera = (window.__game_modules && window.__game_modules.input) ? window.__game_modules.input.camera : { x: WORLD_W/2, y: WORLD_H/2, zoom: 1 };
// coordinate helper placeholders (assigned below depending on input module presence)
let screenToWorld, worldToScreen;
// helpers for wrapping
// delegate small utilities to the module namespace when available (allows gradual refactor)
function mod(n,m){ return (window.__game_modules && window.__game_modules.utils ? window.__game_modules.utils.mod(n,m) : ((n % m) + m) % m); }

// continuous vertical scroll state
let cameraScrollY = camera.y;
// vertical runner settings
const SCROLL_SPEED = 90; // base world pixels per second the scene scrolls down visually
// difficulty ramping params
const SPAWN_INTERVAL_BASE = 2400; // base spawn interval ms
const SPAWN_INTERVAL_MIN = 700; // minimum interval at max difficulty
const DIFFICULTY_ACCEL = 0.0008; // how fast difficulty ramps with time
const BOTTOM_MARGIN = 96; // pixels from bottom of canvas that tank must not cross
const TOP_MARGIN = 64; // optional top margin

// --- Palette and small constants reused from original ---
const COLORS = { tread: '#222', treadLight: '#3a3a3a', barrel: '#161616', bolt: '#1a1a1a', shadow: 'rgba(0,0,0,0.25)'};
function randPalette(){ const h=90+Math.floor(Math.random()*40)-20; const s=35+Math.floor(Math.random()*25); const l1=28+Math.floor(Math.random()*8); const l2=l1+10; const l3=l2+8; return { hull:`hsl(${h} ${s}% ${l2}%)`, hullLight:`hsl(${h} ${s}% ${l3}%)`, turret:`hsl(${h} ${s+10}% ${l1}%)` }; }
let palette = randPalette();

// tank sprites are baked inside `js/tank.js` (imports below)
const ASSETS = { fatsammich: null, osprey: null, kraken: null };
// allow humans makers to reference runtime assets
initHumansAssets(ASSETS);
// --- Runtime asset loader -------------------------------------------------
// Load selected external PNG assets into the ASSETS map. For fatsammich we
// process the bitmap and convert the flat background color to transparent so
// the sprite sits on top of the scene correctly.
function _loadImage(url){ return new Promise((resolve,reject)=>{ const img = new Image(); img.onload = ()=>resolve(img); img.onerror = reject; img.src = url; }); }

async function loadRuntimeAssets(){
  try{
    // Consult a small manifest before requesting asset files to avoid server 404 logs
    // If no manifest exists or it contains an empty list, we skip loading runtime PNGs.
    let manifest = null;
    try{ const resp = await fetch('assets/manifest.json'); if (resp && resp.ok) manifest = await resp.json(); }catch(err){ console.warn('failed to load manifest', err); manifest = null; }
    if (!Array.isArray(manifest) || manifest.length === 0){
      // nothing to load
      return;
    }
    const promises = [];
    if (manifest.includes('fatsammich.png') || manifest.includes('assets/fatsammich.png')) promises.push(_loadImage('assets/fatsammich.png').catch(()=>null));
    if (manifest.includes('osprey.png') || manifest.includes('assets/osprey.png')) promises.push(_loadImage('assets/osprey.png').catch(()=>null));
    if (manifest.includes('kraken.png') || manifest.includes('assets/kraken.png')) promises.push(_loadImage('assets/kraken.png').catch(()=>null));
    const [fImg, oImg, kImg] = await Promise.all(promises);
    // Helper to copy an image into a canvas (preserves drawImage compatibility)
    function imageToCanvas(img){ const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0,0,c.width,c.height); g.drawImage(img,0,0); return c; }

    // fatsammich: if present, remove solid-background or connected background color by flood-filling
    if (fImg){
      try{
        const tmp = imageToCanvas(fImg); const tg = tmp.getContext('2d');
        const w = tmp.width, h = tmp.height;
        const data = tg.getImageData(0,0,w,h);

        // sample the four corners and average them to get a robust background color
        function getPixelAt(x,y){ const i = (y*w + x) * 4; return [data.data[i], data.data[i+1], data.data[i+2], data.data[i+3]]; }
        const c1 = getPixelAt(0,0); const c2 = getPixelAt(w-1,0); const c3 = getPixelAt(0,h-1); const c4 = getPixelAt(w-1,h-1);
        const br = Math.round((c1[0]+c2[0]+c3[0]+c4[0]) / 4);
        const bg = Math.round((c1[1]+c2[1]+c3[1]+c4[1]) / 4);
        const bb = Math.round((c1[2]+c2[2]+c3[2]+c4[2]) / 4);
        const tolerance = 30; // allow larger tolerance to cover dithering/anti-aliased halos

        // helper: color distance check
        function closeEnough(r,g,b){ return Math.abs(r-br) <= tolerance && Math.abs(g-bg) <= tolerance && Math.abs(b-bb) <= tolerance; }

        // Flood-fill from the four corners to clear any background-like region connected to edges.
        const visited = new Uint8Array(w*h);
        const stack = [];
        const pushIf = (x,y)=>{ if (x<0||x>=w||y<0||y>=h) return; const idx = y*w + x; if (visited[idx]) return; const i4 = idx*4; const r=data.data[i4], g=data.data[i4+1], b=data.data[i4+2]; if (!closeEnough(r,g,b)) return; visited[idx]=1; stack.push([x,y]); };
        pushIf(0,0); pushIf(w-1,0); pushIf(0,h-1); pushIf(w-1,h-1);
        while(stack.length){ const [x,y] = stack.pop(); const idx = y*w + x; const i4 = idx*4; data.data[i4+3] = 0; // make transparent
          // neighbors
          pushIf(x+1,y); pushIf(x-1,y); pushIf(x,y+1); pushIf(x,y-1);
        }

        // As a fallback, remove any isolated pixels that are very close to background color (helps with halos)
        for (let y=0;y<h;y++){
          for (let x=0;x<w;x++){
            const i = (y*w + x)*4; if (data.data[i+3] === 0) continue; const r=data.data[i], g=data.data[i+1], b=data.data[i+2]; if (closeEnough(r,g,b)) data.data[i+3]=0;
          }
        }

        tg.putImageData(data,0,0);
        ASSETS.fatsammich = tmp; // store canvas (drawImage accepts canvas)
        if (DEBUG && console && console.log) console.log('ASSETS: loaded fatsammich (processed transparent bg via flood-fill)');
      }catch(e){ console.warn('Failed to process fatsammich -> falling back to raw image', e); ASSETS.fatsammich = fImg; }
    }

  if (oImg){ ASSETS.osprey = imageToCanvas(oImg); if (DEBUG && console && console.log) console.log('ASSETS: loaded osprey'); }
  if (kImg){ ASSETS.kraken = imageToCanvas(kImg); if (DEBUG && console && console.log) console.log('ASSETS: loaded kraken'); }
  }catch(err){ console.warn('loadRuntimeAssets failed', err); }
}

// kick off asset loading; it's safe to run async -- makers will also fallback if ASSETS are missing
loadRuntimeAssets().catch(e=>console.warn('Asset loader failed', e));

// --- Tank state ---
import {
  tank,
  SPRITE_SCALE,
  SPR_W,
  SPR_H,
  bodyCanvas,
  turretCanvas,
  redrawSprites,
  tankDust,
  spawnTankDust,
  updateTankDust,
  drawTankDust,
  tankPieces,
  tankLocalToWorld,
  tankPieceDefs,
  spawnTankPiece,
  tankSparks,
  tankSmoke,
  addTankSpark,
  addTankSmoke,
  spawnTankPieceWithFX,
  spawnTiny,
  explodeTank,
  updateTankPieces,
  drawTankPieces,
  updateTankSparks,
  drawTankSparks,
  updateTankSmoke,
  drawTankSmoke,
  initTankPosition,
  configureTankAssets
} from './tank.js';
import * as SFX from '../Sounds/sounds.js';
import { triggerTankBump, updateTankBump } from './tank.js';
import { billboardFrames, billboardInstances, initBillboards, startBillboardExplode, updateBillboardBroken, drawBillboardBroken, drawBillboardFragmentsWorld, BILLBOARD_PANEL } from './billboard.js';
import { JUNGLE_KINDS, idleMakers as humansIdleMakers, runMakers as humansRunMakers, initHumansAssets } from './humans.js';
import { gibs as moduleGibs, spawnGibs, updateGibs, drawGibs } from './gibs.js';
import { spawnChainedTank } from './alternativetanks.js';

// wrapper to probe spawnGibs calls (logs caller site then forwards to module)
function callSpawnGibs(x, y, color = '#fff', count = 8, site = ''){
  try{ spawnGibs(x, y, color, count, triggerScreenShake); }catch(e){ try{ console.warn('spawnGibs failed', e); }catch(_){} }
  try{ playGibSfxSafe(); }catch(_){ }
}

// Also play a small gib SFX when spawnGibs is called (best-effort)
function playGibSfxSafe(){ try{ if (SFX && typeof SFX.playGib === 'function') SFX.playGib(); }catch(_){ } }

// play a gib SFX whenever gibs are spawned via this wrapper
try{ SFX && typeof SFX.playGib === 'function' && SFX.init && SFX.init(); }catch(_){ }
// Apply persisted sound preference (if any)
try{
  const s = (localStorage && localStorage.getItem && localStorage.getItem('tn_sound_enabled'));
  if (s !== null && SFX && typeof SFX.setEnabled === 'function'){
    SFX.setEnabled(s === '1' || s === 'true');
  }
}catch(_){ }

// Keyboard shortcuts: P = pause/resume, M = toggle sound (skip while typing)
try{
  window.addEventListener('keydown', (ev)=>{
    try{
  // keyboard shortcuts (always enabled)
      const ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
      const k = ev.key;
      if (k === 'p' || k === 'P'){
        paused = !paused;
        try{ updateHud(); }catch(_){ }
        ev.preventDefault();
      }else if (k === 'm' || k === 'M'){
        try{
          let enabled = true;
          const s = (localStorage && localStorage.getItem && localStorage.getItem('tn_sound_enabled'));
          if (s !== null) enabled = (s === '1' || s === 'true');
          else if (SFX && typeof SFX.isEnabled === 'function') enabled = SFX.isEnabled();
          enabled = !enabled;
          try{ if (SFX && typeof SFX.setEnabled === 'function') SFX.setEnabled(enabled); }catch(_){ }
          try{ localStorage && localStorage.setItem && localStorage.setItem('tn_sound_enabled', enabled ? '1' : '0'); }catch(_){ }
          try{ updateHud(); }catch(_){ }
        }catch(_){ }
        ev.preventDefault();
      }
    }catch(_){ }
  });
}catch(_){ }

const _sfxState = { shiftActive: false };
import { initFoliage, updateFoliage, drawFoliage, foliageInstances, foliageTiles } from './foliage.js';

// --- Vehicle preview animation support (for HUD and Journal previews) ---
const __vehicle_preview_canvases = []; // { type: 'fordfiesta', canvas }
let __vehicle_preview_raf = null;

// Draw Ford Fiesta tank into a provided 2D context sized targetW x targetH using base 48px art
function drawFordFiestaInto(ctx, targetW, targetH, ts){
  try{
    const BASE = 48; const FRAMES = 6; const FRAME_MS = 120;
    // draw into offscreen base canvas then scale
    const tmp = document.createElement('canvas'); tmp.width = BASE; tmp.height = BASE; const g = tmp.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0,0,BASE,BASE);
    // colors (hardcode to match fordfiestatank.html vars)
    const COL = { tread:'#23272b', lug:'#3a3f2b', paint:'#c7493a', paintD:'#922f29', steel:'#9aa8b2', glass:'#7ec8c8', accent:'#f2d14a' };
    function rect(x,y,w,h,fill){ g.fillStyle = fill; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    function px(x,y,fill){ rect(x,y,1,1,fill); }
    function drawTrack(x,y,w,h,offset){ rect(x,y,w,h,COL.tread); rect(x+1,y+1,w-2,h-2,COL.tread); const step=3; for(let i=0;i<h-2;i+=step){ const yy=y+1+((i+offset)%(h-2)); rect(x+1,yy,w-2,1,COL.lug); if(w>=5){ px(x+1,yy,COL.lug); px(x+w-2,yy,COL.lug); } } px(x+(w-1),y+1,COL.accent); for(let i=y+2;i<y+h-1;i+=6) px(x+(w-1),i,COL.accent); }
    function drawHull(frame){ const bobArr=[0,1,1,0,-1,-1]; const swayArr=[0,0,1,0,0,-1]; const bob=bobArr[frame%FRAMES]; const sway=swayArr[frame%FRAMES]; g.save(); g.translate(0,bob);
      drawTrack(6+sway,6,6,36,frame); drawTrack(BASE-12-6+sway,6,6,36,(frame*2)%36);
      rect(12+sway,32,24,8,COL.paintD);
      rect(12+sway,10,24,24,COL.paint); rect(14+sway,8,20,2,COL.paint); rect(16+sway,7,16,1,COL.paint); rect(14+sway,34,20,2,COL.paintD);
      rect(12+sway,22,24,2,COL.paintD);
      rect(18+sway,11,12,7,COL.glass); const hlx = 18+sway + (frame%3); px(hlx,11,'#ffffff'); px(hlx+1,12,'#ffffff');
      rect(10+sway,14,2,16,COL.steel); rect(BASE-12-(2-sway),14,2,16,COL.steel);
      g.fillStyle = COL.steel; g.beginPath(); g.rect(22+sway,21,4,6); g.fill(); rect(21+sway,22,1,4,COL.steel); rect(26+sway-1,22,1,4,COL.steel);
      const recoilArr=[0,0,1,1,0,0]; const recoil=recoilArr[frame%FRAMES]; rect(24+sway-recoil,17,2,5,COL.steel); px(24+sway-recoil,17,'#ffffff'); px(16+sway,9,COL.accent); px(31+sway,9,COL.accent); px(13+sway,10,COL.accent); for(let i=11;i<16;i++) px(12+sway,i,COL.accent);
      g.restore(); }
    const frame = Math.floor((ts || performance.now()) / FRAME_MS) % FRAMES; drawHull(frame);
    // blit scaled into target context
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(tmp, 0,0,BASE,BASE, 0,0,targetW,targetH);
  }catch(_){ }
}

function __vehicle_preview_tick(ts){
  try{
    __vehicle_preview_canvases.forEach(entry=>{
      try{ const c = entry.canvas; const ctx = c.getContext('2d'); if (entry.type === 'fordfiesta'){ drawFordFiestaInto(ctx, c.width, c.height, ts); } }
      catch(_){ }
    });
  }catch(_){ }
  __vehicle_preview_raf = requestAnimationFrame(__vehicle_preview_tick);
}

// start RAF when needed
function ensureVehiclePreviewRaf(){ if (!__vehicle_preview_raf){ __vehicle_preview_raf = requestAnimationFrame(__vehicle_preview_tick); } }

// expose the fiesta drawing helper for other modules (journal) to reuse
try{ if (typeof window !== 'undefined') window.drawFordFiestaInto = drawFordFiestaInto; }catch(_){ }

// Draw Blackstar preview into a canvas context (scaled to targetW/targetH)
function drawBlackstarInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, FRAMES = 6, FRAME_MS = 120;
    const now = ts || performance.now(); const frame = Math.floor(now / FRAME_MS) % FRAMES;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const C = { clear:'rgba(0,0,0,0)', hull:'#0b0b0f', hull2:'#15151a', rim:'#2f3242', mid:'#232531', steel:'#9ea2a9', red:'#d4002a', redHi:'#ff4554', flash:'#ffc744', tread:'#0a0b10', tread2:'#000000' };
    o.fillStyle = C.clear; o.fillRect(0,0,S,S);
    // faint BG pattern to match demo
    for(let y=0;y<S;y+=8) for(let x=0;x<S;x+=8) { o.fillStyle = (((x+y)>>3)&1) ? '#1a1b24' : '#131421'; o.fillRect(x,y,8,8); }
    const anchor = { x:32, y:32 };

    // small helpers (pixel draw)
    const px = (x,y,w=1,h=1,col)=>{ o.fillStyle = col; o.fillRect(x|0,y|0,w|0,h|0); };
    const rect = (x,y,w,h,col)=> px(x,y,w,h,col);
    const rectOutline = (x,y,w,h,col)=>{ px(x,y,w,1,col); px(x,y+h-1,w,1,col); px(x,y,1,h,col); px(x+w-1,y,1,h,col); };
    const disc = (cx,cy,r,col)=>{ for(let yy=-r; yy<=r; yy++){ const s=Math.floor(Math.sqrt(r*r - yy*yy)); o.fillStyle=col; o.fillRect(cx-s, cy+yy, 2*s+1, 1); } };
    const line = (x0,y0,x1,y1,col)=>{
      x0|=0;y0|=0;x1|=0;y1|=0;
      let dx=Math.abs(x1-x0), sx=x0<x1?1:-1;
      let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
      let err=dx+dy;
      for(;;){ px(x0,y0,1,1,col); if(x0===x1 && y0===y1) break; const e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } }
    };
    const thickLine = (x0,y0,x1,y1,col,th=2)=>{ for(let i=-Math.floor(th/2); i<Math.ceil(th/2); i++){ for(let j=-Math.floor(th/2); j<Math.ceil(th/2); j++){ line(x0+i,y0+j,x1+i,y1+j,col); } } };

    // Tracks
    const trackW=8, trackH=44, trackY=10, lX=6, rX=S-6-trackW;
    rect(lX,trackY,trackW,trackH,C.tread); rect(rX,trackY,trackW,trackH,C.tread);
    for(let y=trackY; y<trackY+trackH; y+=4){ const phase = ((y>>2)+frame)%2; const col = phase? C.tread2 : C.mid; rect(lX+1,y,trackW-2,1,col); rect(rX+1,y,trackW-2,1,col); }

    // Hull
    const hullX=14, hullY=14, hullW=36, hullH=36;
    rect(hullX,hullY,hullW,hullH,C.hull);
    px(hullX, hullY, 2,2, C.mid);
    px(hullX+hullW-2, hullY, 2,2, C.mid);
    px(hullX, hullY+hullH-2, 2,2, C.mid);
    px(hullX+hullW-2, hullY+hullH-2, 2,2, C.mid);
    rect(hullX+3, hullY+3, hullW-6, 1, C.rim);
    rect(hullX+3, hullY+4, hullW-6, 1, C.hull2);
    rect(hullX+4, hullY+8,      hullW-8, 2, C.red);
    rect(hullX+4, hullY+hullH-10, hullW-8, 2, C.red);
    rect(hullX+6, hullY+8,      hullW-12, 1, C.redHi);

    // Turret
    const tx = anchor.x, ty = anchor.y;
    const rotStep = frame % FRAMES;
    const rot = rotStep * (Math.PI*2/FRAMES);
    const recoil = (rotStep===0)? 1 : 0;

    // Turret base and cap
    disc(tx, ty, 10, C.hull2);
    rectOutline(tx-11, ty-11, 22, 22, C.mid);
    disc(tx, ty - recoil, 7, C.mid);
    disc(tx, ty - recoil, 6, C.hull2);
    rect(tx-6, ty-1-recoil, 12, 2, C.red);
    rect(tx-5, ty-1-recoil, 10, 1, C.redHi);

    // Neck + hub
    thickLine(tx, ty-2-recoil, tx, ty-10-recoil, C.hull2, 3);
    disc(tx, ty-12-recoil, 3, C.mid);

    // Rotating barrels (longer than previous tiny variant)
    const baseR=6, tipR=14;
    for(let i=0;i<6;i++){
      const a = rot + i*(Math.PI*2/6);
      const sx = Math.round(tx + Math.cos(a)*baseR);
      const sy = Math.round(ty - recoil + Math.sin(a)*baseR);
      const ex = Math.round(tx + Math.cos(a)*tipR);
      const ey = Math.round(ty - recoil + Math.sin(a)*tipR);
      thickLine(sx, sy, ex, ey, C.steel, 2);
      disc(ex, ey, 1, C.steel);
    }

    // Muzzle flash every 6th frame on the front (up) barrel
    if(rotStep===0){
      const a0 = -Math.PI/2;
      const ex = Math.round(tx + Math.cos(a0)*tipR);
      const ey = Math.round(ty - recoil + Math.sin(a0)*tipR);
      disc(ex, ey, 2, C.flash);
      line(ex-3, ey, ex+3, ey, C.flash);
      line(ex, ey-3, ex, ey+3, C.flash);
    }

    // Rim lights
    rect(hullX+hullW-2, hullY+2, 1, hullH-4, C.rim);
    rect(hullX+2, hullY+2, hullW-4, 1, C.rim);

    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBlackstarInto = drawBlackstarInto; }catch(_){ }

// Draw Murkia (AMERICA) tank preview into a canvas context (64x64 source, scaled to targetW/targetH)
function drawMurkiaInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, SCALE = 4, FRAMES = 24, FRAME_MS = 60;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const palette = {
      outline:'#08101a', black:'#0a0f17', steelDD:'#222a39', steelD:'#2a3344', steelM:'#44506a', steelL:'#6e7c99', steelXL:'#8a98b5', steelSpec:'#b6c1d9', rubber:'#202633', rubberHi:'#323b4f', shadow:'#0a0e16', blue:'#173a9b', red:'#d21f2b', white:'#ffffff', gold:'#f7cc3a', treadHi:'#9fb0cc', green:'#7ee787'
    };
    // helpers (pixel-level) - draw into offscreen 'o' at 64x64 coords
    function px(x,y,c){ if(x<0||y<0||x>=S||y>=S) return; o.fillStyle = c; o.fillRect(x, y, 1, 1); }
    function fillRect(x,y,w,h,c){ o.fillStyle = c; o.fillRect(x, y, w, h); }
    function outlineRect(x,y,w,h,c){ for(let i=x;i<x+w;i++){ px(i,y,c); px(i,y+h-1,c);} for(let j=y;j<y+h;j++){ px(x,j,c); px(x+w-1,j,c);} }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ for(let xx=-r; xx<=r; xx++){ if(xx*xx+yy*yy<=r*r) px(cx+xx, cy+yy, c); } } }
    function circle(cx,cy,r,c){ for(let t=0;t<360;t+=6){ const a=t*Math.PI/180; px(Math.round(cx+Math.cos(a)*r), Math.round(cy+Math.sin(a)*r), c); } }
    function lineThin(x0,y0,x1,y1,c){ let dx=Math.abs(x1-x0), sx=x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy,e2; for(;;){ px(x0,y0,c); if(x0===x1&&y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    function lineThick(x0,y0,x1,y1,c,outline){ let dx=Math.abs(x1-x0),sx=x0<x1?1:-1; let dy=-Math.abs(y1-y0),sy=y0<y1?1:-1; let err=dx+dy,e2; for(;;){ px(x0,y0,c); if(dx>Math.abs(dy)) px(x0,y0+sy,c); else px(x0+sx,y0,c); if(outline){ px(x0-1,y0,outline); px(x0+1,y0,outline); px(x0,y0-1,outline); px(x0,y0+1,outline); } if(x0===x1&&y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    function rot(dx,dy,a){ const ca=Math.cos(a),sa=Math.sin(a); return {x:Math.round(dx*ca-dy*sa), y:Math.round(dx*sa+dy*ca)}; }

    // clear
    o.fillStyle = '#0c1220'; o.fillRect(0,0,S,S);
    const CENTER = {x:32,y:32};
    const frame = Math.floor((ts || performance.now()) / FRAME_MS) % FRAMES;
    const bounce = (frame%6===0 || frame%6===3)? 0 : (frame%6<3 ? 1 : -1);

    // draw tracks
    function drawTrackAssembly(side, phase, bounceY){
      const x0 = (side<0)? 8 : 48; const w=8, h=32, y0=16 + bounceY;
      fillRect(x0, y0, w, h, palette.rubber);
      outlineRect(x0, y0, w, h, palette.outline);
      for(let yy=0; yy<h; yy++){
        const gy = y0 + yy;
        const link = ((yy + phase) % 6) === 0;
        if(link){ px(x0+2, gy, palette.rubberHi); px(x0+3, gy, palette.rubberHi); px(x0+w-3, gy, palette.rubberHi); px(x0+w-4, gy, palette.rubberHi); }
      }
      // wheels
      const wheelY = 40 + bounceY; const wheelXs = (side<0)? [11,13,15,17,19] : [49,51,53,55,57];
      wheelXs.forEach(cx=>{ fillCircle(cx, wheelY, 3, palette.steelD); px(cx, wheelY, palette.steelSpec); });
      const retY = 20 + bounceY; const retXs = (side<0)? [12,18] : [50,56]; retXs.forEach(cx=>{ fillCircle(cx, retY, 2, palette.steelD); px(cx, retY, palette.steelSpec); });
      // skirts
      const skirtY = y0 - 2, skirtH = 4; fillRect(x0-1, skirtY, w+2, skirtH, palette.steelM); outlineRect(x0-1, skirtY, w+2, skirtH, palette.outline);
      for(let i=0;i<4;i++){ px(x0+i*2, skirtY+skirtH-1, palette.steelXL); }
      px(x0, skirtY+1, palette.blue); px(x0+w-1, skirtY+1, palette.blue);
    }
    drawTrackAssembly(-1, frame%6, bounce); drawTrackAssembly(+1, frame%6, bounce);

    // hull
    fillRect(16,18,32,28,palette.steelM); fillRect(18,20,28,24,palette.steelL);
    for(let i=0;i<12;i++){ px(20+i,18, palette.steelD); }
    for(let i=0;i<12;i++){ px(32+i,45, palette.steelD); }
    // turret ring
    const ringR=9; for(let t=0;t<16;t++){ const a=t*(Math.PI*2/16); const x=Math.round(CENTER.x+Math.cos(a)*ringR); const y=Math.round(CENTER.y+Math.sin(a)*ringR); px(x,y,palette.steelD); }
    // intakes
    for(let i=0;i<3;i++){ fillRect(20, 40+i*2, 8, 1, palette.steelDD); px(20,40+i*2, palette.outline); px(27,40+i*2, palette.outline); }
    for(let i=0;i<3;i++){ for(let j=0;j<5;j++){ px(36+j*2, 40+i*2, palette.steelDD); } }
    fillRect(16,30,4,8,palette.steelM); outlineRect(16,30,4,8,palette.outline); px(18,34,palette.steelXL);
    fillRect(44,30,4,8,palette.steelM); outlineRect(44,30,4,8,palette.outline); px(46,34,palette.steelXL);
    px(16,20,palette.steelDD); px(17,20,palette.steelDD); px(47,20,palette.steelDD); px(46,20,palette.steelDD);
    // flag band
    const bandY0=21, bandH=10, bandX0=19, bandW=26; const canton={x:bandX0,y:bandY0,w:12,h:bandH}; fillRect(canton.x,canton.y,canton.w,canton.h,palette.blue);
    const twinkle = frame % 6; const stars=[{x:canton.x+3,y:canton.y+3},{x:canton.x+7,y:canton.y+3},{x:canton.x+5,y:canton.y+6},{x:canton.x+9,y:canton.y+6},{x:canton.x+3,y:canton.y+8},{x:canton.x+7,y:canton.y+8}];
    stars.forEach((s,i)=>{ const col=(i===twinkle)?palette.white:palette.gold; px(s.x,s.y,col); px(s.x-1,s.y,col); px(s.x+1,s.y,col); px(s.x,s.y-1,col); px(s.x,s.y+1,col); });
    for(let y=0;y<bandH;y++){ fillRect(bandX0+canton.w, bandY0+y, bandW-canton.w, 1, (y%2===0)?palette.red:palette.white); }
    outlineRect(bandX0,bandY0,bandW,bandH,palette.outline);
    for(let i=0;i<5;i++){ px(24+i*4, 32, palette.steelDD); }
    outlineRect(16,18,32,28,palette.outline);

    // turret
    const cx=CENTER.x, cy=CENTER.y; fillCircle(cx,cy,7,palette.steelM); fillCircle(cx,cy,6,palette.steelL); circle(cx,cy,7,palette.outline);
    // crest
    px(cx,cy,palette.gold); px(cx-1,cy,palette.gold); px(cx+1,cy,palette.gold); px(cx-2,cy+1,palette.gold); px(cx+2,cy+1,palette.gold); px(cx,cy-1,palette.gold);
    const angle=(frame/FRAMES)*Math.PI*2; const dirx=Math.sin(angle), diry=-Math.cos(angle); const perpX=diry, perpY=-dirx;
    // barrel
    const bLen=20, bx0=cx, by0=cy-1, bx1=Math.round(cx+dirx*bLen), by1=Math.round(cy+diry*bLen);
    lineThick(bx0,by0,bx1,by1,palette.steelM,palette.outline); px(bx1,by1,palette.black);
    px(Math.round(bx1+perpX),Math.round(by1+perpY),palette.black); px(Math.round(bx1-perpX),Math.round(by1-perpY),palette.black);
    // coax
    const mgOff=1; const mgx0=Math.round(bx0+perpX*mgOff), mgy0=Math.round(by0+perpY*mgOff); const mgx1=Math.round(cx+dirx*14+perpX*mgOff), mgy1=Math.round(cy+diry*14+perpY*mgOff);
    lineThin(mgx0,mgy0,mgx1,mgy1,palette.steelM); px(mgx1,mgy1,palette.black);
    // cupola
    const cupOff=rot(3,0,angle); const cupX=cx+cupOff.x, cupY=cy+cupOff.y; fillCircle(cupX,cupY,3,palette.steelL); circle(cupX,cupY,3,palette.outline);
    const hx0=Math.round(cupX-perpX*2), hy0=Math.round(cupY-perpY*2); const hx1=Math.round(cupX+perpX*2), hy1=Math.round(cupY+perpY*2); lineThin(hx0,hy0,hx1,hy1,palette.outline);
    const p1={x:Math.round(cupX+dirx*2),y:Math.round(cupY+diry*2)}; const p2={x:Math.round(cupX+dirx*1 - perpX*1),y:Math.round(cupY+diry*1 - perpY*1)}; px(p1.x,p1.y,palette.white); px(p2.x,p2.y,palette.white);
    // antenna + flag
    const antBase=rot(3,-1,angle); const ax0=cx+antBase.x, ay0=cy+antBase.y; const ax1=Math.round(ax0 - dirx*6 + perpX*1), ay1=Math.round(ay0 - diry*6 + perpY*1);
    lineThin(ax0,ay0,ax1,ay1,palette.steelXL); const flip=(frame%2===0)?1:-1, fx=Math.round(ax1+perpX*flip), fy=Math.round(ay1+perpY*flip); px(ax1,ay1,palette.blue); px(fx,fy,palette.white); px(fx+Math.round(perpX||0), fy+Math.round(perpY||0), palette.red);

    // rim light overlay and hitbox omitted here (preview only)

    // blit scaled into target context
    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawMurkiaInto = drawMurkiaInto; }catch(_){ }

// Split Murkia draw helpers so we can produce separate full-res body and turret canvases
function drawMurkiaBodyInto(ctx, targetW, targetH, ts){
  try{
    const S = 64; const palette = { outline:'#08101a', steelD:'#2a3344', steelM:'#44506a', steelL:'#6e7c99', steelXL:'#8a98b5', steelSpec:'#b6c1d9', rubber:'#202633', rubberHi:'#323b4f', blue:'#173a9b', red:'#d21f2b', white:'#ffffff', gold:'#f7cc3a', treadHi:'#9fb0cc' };
    const o = ctx; // caller provides a 64x64 ctx
    // ensure transparent background
    o.clearRect(0,0,S,S);
    const now = (typeof ts === 'number') ? ts : performance.now(); const frame = Math.floor(now / 80);
    function px(x,y,c){ if(x<0||y<0||x>=S||y>=S) return; o.fillStyle=c; o.fillRect(x,y,1,1); }
    function fillRect(x,y,w,h,c){ o.fillStyle=c; o.fillRect(x,y,w,h); }
    function outlineRect(x,y,w,h,c){ for(let i=x;i<x+w;i++){ px(i,y,c); px(i,y+h-1,c);} for(let j=y;j<y+h;j++){ px(x,j,c); px(x+w-1,j,c);} }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ for(let xx=-r; xx<=r; xx++){ if(xx*xx+yy*yy<=r*r) px(cx+xx, cy+yy, c); } } }
    const CENTER = {x:32,y:32};
    const bounce = (frame%6===0 || frame%6===3)? 0 : (frame%6<3 ? 1 : -1);
    // draw tracks, hull, flag band, panel details and rim
    function drawTrackAssembly(side, phase, bounceY){
      const x0 = (side<0)? 8 : 48; const w=8, h=32, y0=16 + bounceY;
      // track base (transparent around)
      fillRect(x0, y0, w, h, palette.rubber);
      outlineRect(x0, y0, w, h, palette.outline);
      // moving track links: slide along y using phase
      for(let yy=0; yy<h; yy++){ const gy = y0 + yy; const link = ((yy + phase) % 6) === 0; if(link){ px(x0+2, gy, palette.rubberHi); px(x0+3, gy, palette.rubberHi); px(x0+w-3, gy, palette.rubberHi); px(x0+w-4, gy, palette.rubberHi); } }
      // road wheels with animated spoke highlight
      const wheelY = 40 + bounceY; const wheelXs = (side<0)? [11,13,15,17,19] : [49,51,53,55,57];
      wheelXs.forEach((cx, idx)=>{
        fillCircle(cx, wheelY, 3, palette.steelD);
        px(cx, wheelY, palette.steelSpec);
        // rotating spoke: offset pixel moves with frame
        const ang = (now/120) + idx*0.6;
        const sx = Math.round(cx + Math.cos(ang)*2);
        const sy = Math.round(wheelY + Math.sin(ang)*2);
        px(sx, sy, palette.steelSpec);
      });
      const retY = 20 + bounceY; const retXs = (side<0)? [12,18] : [50,56]; retXs.forEach(cx=>{ fillCircle(cx, retY, 2, palette.steelD); px(cx, retY, palette.steelSpec); });
      const skirtY = y0 - 2, skirtH = 4; fillRect(x0-1, skirtY, w+2, skirtH, palette.steelM); outlineRect(x0-1, skirtY, w+2, skirtH, palette.outline); for(let i=0;i<4;i++){ px(x0+i*2, skirtY+skirtH-1, palette.steelXL); } px(x0, skirtY+1, palette.blue); px(x0+w-1, skirtY+1, palette.blue);
    }
    // phase derived from frame to create smooth movement
    drawTrackAssembly(-1, frame%6, bounce); drawTrackAssembly(+1, frame%6, bounce);
    // hull
    fillRect(16,18,32,28,palette.steelM); fillRect(18,20,28,24,palette.steelL);
    for(let i=0;i<12;i++){ px(20+i,18, palette.steelD); }
    for(let i=0;i<12;i++){ px(32+i,45, palette.steelD); }
    const ringR=9; for(let t=0;t<16;t++){ const a=t*(Math.PI*2/16); const x=Math.round(CENTER.x+Math.cos(a)*ringR); const y=Math.round(CENTER.y+Math.sin(a)*ringR); px(x,y,palette.steelD); }
    for(let i=0;i<3;i++){ fillRect(20, 40+i*2, 8, 1, palette.steelD); px(20,40+i*2, palette.outline); px(27,40+i*2, palette.outline); }
    for(let i=0;i<3;i++){ for(let j=0;j<5;j++){ px(36+j*2, 40+i*2, palette.steelD); } }
    fillRect(16,30,4,8,palette.steelM); outlineRect(16,30,4,8,palette.outline); px(18,34,palette.steelXL); fillRect(44,30,4,8,palette.steelM); outlineRect(44,30,4,8,palette.outline); px(46,34,palette.steelXL);
    px(16,20,palette.steelD); px(17,20,palette.steelD); px(47,20,palette.steelD); px(46,20,palette.steelD);
    const bandY0=21, bandH=10, bandX0=19, bandW=26; const canton={x:bandX0,y:bandY0,w:12,h:bandH}; fillRect(canton.x,canton.y,canton.w,canton.h,palette.blue);
    const twinkle = frame % 6; const stars=[{x:canton.x+3,y:canton.y+3},{x:canton.x+7,y:canton.y+3},{x:canton.x+5,y:canton.y+6},{x:canton.x+9,y:canton.y+6},{x:canton.x+3,y:canton.y+8},{x:canton.x+7,y:canton.y+8}]; stars.forEach((s,i)=>{ const col=(i===twinkle)?palette.white:palette.gold; px(s.x,s.y,col); px(s.x-1,s.y,col); px(s.x+1,s.y,col); px(s.x,s.y-1,col); px(s.x,s.y+1,col); });
    for(let y=0;y<bandH;y++){ fillRect(bandX0+canton.w, bandY0+y, bandW-canton.w, 1, (y%2===0)?palette.red:palette.white); }
    outlineRect(bandX0,bandY0,bandW,bandH,palette.outline);
    for(let i=0;i<5;i++){ px(24+i*4, 32, palette.steelD); }
    outlineRect(16,18,32,28,palette.outline);
  }catch(_){ }
}

function drawMurkiaTurretInto(ctx, targetW, targetH, ts){
  try{
    const S = 64; const o = ctx; const palette = { outline:'#08101a', steelM:'#44506a', steelL:'#6e7c99', steelSpec:'#b6c1d9', steel:'#9fb0c2', black:'#0a0f17', blue:'#173a9b', red:'#d21f2b', white:'#ffffff', gold:'#f7cc3a' };
    function px(x,y,c){ if(x<0||y<0||x>=S||y>=S) return; o.fillStyle=c; o.fillRect(x,y,1,1); }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ for(let xx=-r; xx<=r; xx++){ if(xx*xx+yy*yy<=r*r) px(cx+xx, cy+yy, c); } } }
    function lineThin(x0,y0,x1,y1,c){ let dx=Math.abs(x1-x0), sx=x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy,e2; for(;;){ px(x0,y0,c); if(x0===x1&&y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    const now = ts || performance.now(); const frame = Math.floor(now / 60) % 24; const cx=32, cy=32; fillCircle(cx,cy,7,palette.steelM); fillCircle(cx,cy,6,palette.steelL); for(let t=0;t<360;t+=20){ px(Math.round(cx+Math.cos(t*Math.PI/180)*7), Math.round(cy+Math.sin(t*Math.PI/180)*7), palette.outline); }
    // crest
    px(cx,cy,palette.gold); px(cx-1,cy,palette.gold); px(cx+1,cy,palette.gold); px(cx-2,cy+1,palette.gold); px(cx+2,cy+1,palette.gold); px(cx,cy-1,palette.gold);
  // Draw turret graphics in a neutral orientation (barrel pointing to the right).
  // External code rotates the turret canvas by the entity's turretAngle when drawing,
  // so remove any internal animation here to ensure the turret visually points at the cursor.
  const dirx = 1, diry = 0; const perpX = 0, perpY = -1;
    // barrel
    const bLen=20, bx0=cx, by0=cy-1, bx1=Math.round(cx+dirx*bLen), by1=Math.round(cy+diry*bLen);
    // thick line (simple)
    lineThin(bx0,by0,bx1,by1,palette.steelM); px(bx1,by1,palette.black); px(Math.round(bx1+perpX),Math.round(by1+perpY),palette.black); px(Math.round(bx1-perpX),Math.round(by1-perpY),palette.black);
    // coax
    const mgOff=1; const mgx0=Math.round(bx0+perpX*mgOff), mgy0=Math.round(by0+perpY*mgOff); const mgx1=Math.round(cx+dirx*14+perpX*mgOff), mgy1=Math.round(cy+diry*14+perpY*mgOff); lineThin(mgx0,mgy0,mgx1,mgy1,palette.steelM); px(mgx1,mgy1,palette.black);
    // cupola + hatch
    const cupOffX = Math.round(3*Math.cos(angle) - 0*Math.sin(angle)), cupOffY = Math.round(3*Math.sin(angle) + 0*Math.cos(angle)); const cupX=cx+cupOffX, cupY=cy+cupOffY; fillCircle(cupX,cupY,3,palette.steelL); for(let t=0;t<360;t+=20) px(Math.round(cupX+Math.cos(t*Math.PI/180)*3), Math.round(cupY+Math.sin(t*Math.PI/180)*3), palette.outline);
    // hatch lines
    const hx0=Math.round(cupX-perpX*2), hy0=Math.round(cupY-perpY*2); const hx1=Math.round(cupX+perpX*2), hy1=Math.round(cupY+perpY*2); lineThin(hx0,hy0,hx1,hy1,palette.outline);
    const p1x=Math.round(cupX+dirx*2), p1y=Math.round(cupY+diry*2); px(p1x,p1y,palette.white);
    // antenna + flag
    const antBaseX = Math.round(3*Math.cos(angle) - (-1)*Math.sin(angle)), antBaseY = Math.round(3*Math.sin(angle) + (-1)*Math.cos(angle)); const ax0=cx+antBaseX, ay0=cy+antBaseY; const ax1=Math.round(ax0 - dirx*6 + perpX*1), ay1=Math.round(ay0 - diry*6 + perpY*1); lineThin(ax0,ay0,ax1,ay1,palette.steelXL || '#8a98b5'); const flip=(frame%2===0)?1:-1, fx=Math.round(ax1+perpX*flip), fy=Math.round(ay1+perpY*flip); px(ax1,ay1,palette.blue); px(fx,fy,palette.white); px(fx+Math.round(perpX||0), fy+Math.round(perpY||0), palette.red);
  }catch(_){ }
}

// Draw Dozer (64x64) - ported from dozer.html
function drawDozerInto(ctx, targetW, targetH, ts){
  try{
    const S = 64; const o = ctx; const now = ts || performance.now();
    o.clearRect(0,0,S,S);
    function px(x,y,w=1,h=1,c){ o.fillStyle=c; o.fillRect(x,y,w,h); }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ const span = Math.floor(Math.sqrt(r*r - yy*yy)); o.fillStyle=c; o.fillRect(cx-span, cy+yy, span*2+1, 1);} }
    const P = { steelD:'#2a2d32', steelM:'#3c4148', steelL:'#6f7886', tread:'#17191c', blade:'#c6a43a', bladeL:'#edd67a', hazD:'#7a6321', glass:'#9fe3ff', warn:'#ff3b30', shadow:'rgba(0,0,0,0.28)', smokeA:'rgba(160,160,160,0.35)', smokeB:'rgba(110,110,110,0.3)' };
    // draw soft shadow
    for(let i=0;i<7;i++){ const y=48+i; const w=36 - i*3; px(32-Math.floor(w/2), y, w, 1, P.shadow); }
    // tracks
    const yTop = 14, h=36, w=10, leftX=6, rightX=S-6-w;
    px(leftX, yTop, w, h, P.tread); px(rightX,yTop,w,h,P.tread);
    px(leftX+2,yTop+2,w-4,h-4,P.steelD); px(rightX+2,yTop+2,w-4,h-4,P.steelD);
    const shift = Math.floor((now/120)%6);
    for(let y=yTop+2+shift; y<yTop+h-2; y+=6){ px(leftX+1,y,2,2,P.steelL); px(leftX+7,y,2,2,P.steelL); px(rightX+1,y,2,2,P.steelL); px(rightX+7,y,2,2,P.steelL); }
    for(let i=0;i<5;i++){ const wy = yTop + 4 + i*6; fillCircle(leftX+5,wy,1,P.steelM); fillCircle(rightX+5,wy,1,P.steelM); }
    // hull
    const hx=18, hy=18, hw=28, hh=30;
    px(hx,hy,hw,hh,P.steelM); px(hx,hy,hw,2,P.steelL); px(hx,hy+hh-2,hw,2,P.steelD);
    // cabin/glass
    px(hx+8,hy+2,12,6,P.steelD); for(let i=0;i<12;i++){ /* rim */ } px(hx+10,hy+4,8,1,P.glass);
    // beacon
    const blink = ((now/120)|0)%14 < 6; px(hx+hw-4, hy+1, 2,2, blink?P.warn:P.steelL);
    // blade
    const bx=10, by=8, bw=44, bh=6; px(bx,by,bw,bh,P.blade); px(bx,by+bh-1,4,1,P.hazD); px(bx+bw-4,by+bh-1,4,1,P.hazD); px(bx+1,by+1,bw-2,1,P.bladeL);
    for(let x=0;x<bw;x++){ const col = ((x + Math.floor((now/120)/2)) % 6) < 3 ? P.blade : P.hazD; px(bx+x, by+2, 1,2, col); }
    // exhaust puff
    const cycle = Math.floor((now/120)%24); const puffY = 50 + Math.floor(cycle/4);
    if(puffY < 64){ const off = (cycle%8)-4; fillCircle(32+off, puffY, 2, P.smokeA); fillCircle(30+off, puffY+2, 1, P.smokeB); }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawDozerInto = drawDozerInto; }catch(_){ }

// helper: compute scale to draw an arbitrary sprite canvas so it matches game display size
function getCanvasDrawScale(spriteCanvas){ try{ const nativeW = (spriteCanvas && spriteCanvas.width) ? spriteCanvas.width : SPR_W; const effScale = effectiveTankScale(); return ((SPR_W * effScale) / nativeW) * camera.zoom; }catch(_){ return effectiveTankScale() * camera.zoom; } }



// Helper: handle a foliage instance being hit by a projectile
function handleFoliageHit(fiIndex, projX, projY, color = '#8adf76'){
  try{
    const f = foliageInstances[fiIndex];
    if (!f) return;
    // spawn small gibs on every hit
    try{ callSpawnGibs(projX || f.x, projY || f.y, color, 6, 'foliage-projectile-hit'); }catch(_){ }
    // decrement hp and if zero, spawn image fragment gibs and remove
    f.hp = (f.hp || 1) - 1;
    if (f.hp <= 0){
      const tile = (typeof foliageTiles !== 'undefined') ? foliageTiles[f.idx] : null;
      if (tile && tile.c){ try{ const src = tile.c; const w = Math.min(96, src.width|0), h = Math.min(96, src.height|0); const pieces = Math.floor(6 + Math.random()*8); for (let p=0;p<pieces;p++){ const pw = 6 + Math.floor(Math.random()*18); const ph = 6 + Math.floor(Math.random()*18); const sx = Math.max(0, Math.floor(Math.random()*(w - pw))); const sy = Math.max(0, Math.floor(Math.random()*(h - ph))); const worldX = f.x + (sx - w/2) * (f.scale || 1); const worldY = f.y + (sy - h/2) * (f.scale || 1); try{ moduleGibs.push({ src, sx, sy, sw: pw, sh: ph, x: worldX, y: worldY, vx: (Math.random()-0.5)*220, vy: -80 + Math.random()*220, rot: (Math.random()-0.5)*2, vr: (Math.random()-0.5)*6, life: 1.2 + Math.random()*1.2, gravity: 160, scale: f.scale || 1 }); }catch(_){ callSpawnGibs(f.x, f.y, color, 12, 'foliage-frag-fallback'); } } }catch(_){ callSpawnGibs(f.x, f.y, color, 12, 'foliage-frag-err'); } }
      else { try{ callSpawnGibs(f.x, f.y, color, 12, 'foliage-basic'); }catch(_){ } }
      try{ scheduleRespawn('foliage', f, 5000); }catch(_){ }
      // remove instance
      foliageInstances.splice(fiIndex,1);
      try{ triggerScreenShake(8, 0.12); }catch(_){ }
    }
  }catch(_){ }
  // Ensure lang button always has a runtime-resolving onclick so pointerdown->click() will do something
  try{
    const lb = document.getElementById('tn-lang-btn');
    if (lb){
      lb.onclick = function(){
        try{ console.log('DEBUG: unconditional tn-lang-btn onclick'); }catch(_){ }
        try{ if (typeof window.openLangMenu === 'function'){ console.log('DEBUG: unconditional calling window.openLangMenu'); window.openLangMenu(); return; } }catch(_){ }
        try{ if (typeof openLangMenu === 'function'){ console.log('DEBUG: unconditional calling local openLangMenu'); openLangMenu(); return; } }catch(_){ }
        try{ if (typeof window.openLangMenu === 'function'){ window.openLangMenu(); } }catch(_){ }
      };
    }
  }catch(_){ }
}

// initialize tank module runtime config
initTankPosition(WORLD_W, WORLD_H);

// initialize billboards (moved into billboard.js)
initBillboards(WORLD_W, WORLD_H);

// ... tank imports already declared above ...
// prefer input module mouse/keys if present, otherwise use local fallbacks
const keys = (window.__game_modules && window.__game_modules.input) ? window.__game_modules.input.keys : new Set();
let mouse = (window.__game_modules && window.__game_modules.input) ? window.__game_modules.input.mouse : { x: W/2, y: H/2 };

// --- Input: initialize module if present, otherwise fall back to inline listeners ---
if (window.__game_modules && window.__game_modules.input && typeof window.__game_modules.input.initInput === 'function'){
  try{
    window.__game_modules.input.initInput({ canvas, width: canvas.width, height: canvas.height, worldW: WORLD_W, worldH: WORLD_H });
    // also listen for the module's pointer event and forward to existing handler
  window.addEventListener('game-pointerdown', (ev)=>{ const d = ev.detail; try{ window.__pointer_debug_update && window.__pointer_debug_update({ mx: d && d.mouse && d.mouse.x, button: d && d.button, buttons: d && d.buttons, evt: 'module-down', lastFire: _lastManualFire }); }catch(_){ } if (d && d.mouse && (d.button === 0 || (d.buttons && (d.buttons & 1)))) fireBullet(); });
  // ensure camera zoom/clamp initial state matches previous behavior
  camera.zoom = window.__game_modules.input.camera.zoom || camera.zoom;
    camera.x = clamp(camera.x, W/(2*camera.zoom), WORLD_W - W/(2*camera.zoom));
    camera.y = clamp(camera.y, H/(2*camera.zoom), WORLD_H - H/(2*camera.zoom));
  }catch(err){ console.warn('input.initInput failed, falling back to inline listeners', err);
    // ...fallthrough to legacy listeners below
  }
}
// if module wasn't initialized, keep legacy listeners so game remains functional
if (!(window.__game_modules && window.__game_modules.input && typeof window.__game_modules.input.initInput === 'function')){
  // mouse move
  canvas.addEventListener('mousemove', e=>{ const r=canvas.getBoundingClientRect(); mouse.x=(e.clientX-r.left)*(canvas.width/r.width); mouse.y=(e.clientY-r.top)*(canvas.height/r.height); });
  // keyboard
  window.addEventListener('keydown', e=>{ keys.add(e.key.toLowerCase()); if (e.key === ' ') e.preventDefault(); });
  window.addEventListener('keyup', e=>{ keys.delete(e.key.toLowerCase()); });
  canvas.focus();
  // zoom constants and initial zoom
  const MIN_ZOOM = 0.5, MAX_ZOOM = 5.0;
  camera.zoom = MAX_ZOOM;
  camera.x = clamp(camera.x, W/(2*camera.zoom), WORLD_W - W/(2*camera.zoom));
  camera.y = clamp(camera.y, H/(2*camera.zoom), WORLD_H - H/(2*camera.zoom));
  function screenToWorld_local(mx, my){ const wx = (mx - W/2)/camera.zoom + camera.x; let wy = (my - H/2)/camera.zoom + camera.y; wy = mod(wy, WORLD_H); return { x: wx, y: wy }; }
  function worldToScreen_local(wx, wy){ const x = (wx - camera.x) * camera.zoom + W/2; let dy = wy - camera.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const y = dy * camera.zoom + H/2; return { x, y }; }
  canvas.addEventListener('wheel', (ev)=>{ ev.preventDefault(); const dir = (ev.deltaY>0) ? -1 : 1; const factor = dir>0 ? 1.12 : (1/1.12); const mx = mouse.x, my = mouse.y; const before = screenToWorld_local(mx, my); camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor)); camera.x = before.x - (mx - W/2)/camera.zoom; camera.y = before.y - (my - H/2)/camera.zoom; camera.x = clamp(camera.x, W/(2*camera.zoom), WORLD_W - W/(2*camera.zoom)); camera.y = clamp(camera.y, H/(2*camera.zoom), WORLD_H - H/(2*camera.zoom)); }, { passive: false });
  // pointerdown -> fire
  canvas.addEventListener('pointerdown', (e)=>{ const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (canvas.width / r.width); mouse.y = (e.clientY - r.top) * (canvas.height / r.height); if (e.button === 0 || (e.buttons && (e.buttons & 1))) fireBullet(); });
  // One-time gesture to enable audio and start background music (SFX.playBgm)
  (function attachBgmOnGesture(){
    const startBgm = (ev)=>{
      try{ if (SFX && typeof SFX.playBgm === 'function') SFX.playBgm(); }catch(_){ }
      try{ window.removeEventListener('pointerdown', startBgm); window.removeEventListener('keydown', startBgm); }catch(_){ }
    };
    window.addEventListener('pointerdown', startBgm, { once: true });
    window.addEventListener('keydown', startBgm, { once: true });
  })();
  // expose fallbacks as helpers used elsewhere
  screenToWorld = (mx,my) => screenToWorld_local(mx,my);
  worldToScreen = (wx,wy) => worldToScreen_local(wx,wy);
} else {
  // if module is present, delegate the coordinate helpers
  screenToWorld = (mx,my) => window.__game_modules.input.screenToWorld(mx,my);
  worldToScreen = (wx,wy) => window.__game_modules.input.worldToScreen(wx,wy);
}

  // Right-click hold to pause vertical auto-scroll (does not set global paused)
  // Holding right mouse button will stop the automatic cameraScrollY advance;
  // releasing it resumes scrolling. We prevent the context menu so right-click
  // is dedicated to this control while over the canvas.
  let rightClickHoldScroll = false;
  // use pointer capture for right-button so we continue receiving pointer
  // events while the button is held on some browsers/devices.
  let _capturedPointerId = null;
  // dynamic contextmenu blocker state so we can install capture-phase
  // listeners only while right-click hold is active (more robust across
  // browsers and avoids interfering with other page behavior).
  let _contextMenuBlockerInstalled = false;
  let _blockerRefs = {};
  let _contextBlockerKeeper = null;

  function _isEventOnCanvas(e){
    try{
      if (typeof e.composedPath === 'function'){
        const p = e.composedPath(); for (const n of p){ if (n === canvas) return true; }
      } else if (e.path && Array.isArray(e.path)){
        for (const n of e.path){ if (n === canvas) return true; }
      }
    }catch(_){ }
    try{
      // fallback: if event target is the canvas or inside it
      if (e.target === canvas || canvas.contains && canvas.contains(e.target)) return true;
      // final fallback: if event has client coords, check bounding rect
      if (typeof e.clientX === 'number' && typeof e.clientY === 'number'){
        const r = canvas.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return true;
      }
    }catch(_){ }
    return false;
  }

  function _contextMenuBlocker(e){ if (_isEventOnCanvas(e) || rightClickHoldScroll){ try{ e.preventDefault(); e.stopPropagation(); }catch(_){ } } }

  function _installContextMenuBlocker(){ if (_contextMenuBlockerInstalled) return; _contextMenuBlockerInstalled = true; _blockerRefs.context = _contextMenuBlocker; document.addEventListener('contextmenu', _blockerRefs.context, true); _blockerRefs.mdown = _contextMenuBlocker; document.addEventListener('mousedown', _blockerRefs.mdown, true); _blockerRefs.aux = _contextMenuBlocker; document.addEventListener('auxclick', _blockerRefs.aux, true); }

  function _removeContextMenuBlocker(){ if (!_contextMenuBlockerInstalled) return; _contextMenuBlockerInstalled = false; try{ document.removeEventListener('contextmenu', _blockerRefs.context, true); document.removeEventListener('mousedown', _blockerRefs.mdown, true); document.removeEventListener('auxclick', _blockerRefs.aux, true); }catch(_){ } _blockerRefs = {}; }

  canvas.addEventListener('pointerdown', (e) => {
    try{
      if (e.button === 2 && _isEventOnCanvas(e)){
        rightClickHoldScroll = true;
        _capturedPointerId = e.pointerId;
        try{ canvas.setPointerCapture && canvas.setPointerCapture(e.pointerId); }catch(_){ }
        // ensure we have capture-phase blockers active while the button is held
  _installContextMenuBlocker();
  // also ensure a persistent window-level fallback and a keeper to re-install if necessary
  try{ window._saved_oncontextmenu = window.oncontextmenu; window.oncontextmenu = function(ev){ if (_isEventOnCanvas(ev) || rightClickHoldScroll){ try{ ev.preventDefault(); ev.stopPropagation(); ev.stopImmediatePropagation && ev.stopImmediatePropagation(); }catch(_){ } return false; } return true; }; }catch(_){ }
  if (!_contextBlockerKeeper){ _contextBlockerKeeper = setInterval(()=>{ try{ _installContextMenuBlocker(); }catch(_){ } }, 300); }
        e.preventDefault();
      }
    }catch(_){ }
    try{ window.__pointer_debug_update && window.__pointer_debug_update({ mx: e.clientX, button: e.button, buttons: e.buttons, evt: 'canvas-down', lastFire: _lastManualFire }); }catch(err){ }
  });
  window.addEventListener('pointerup', (e) => {
    try{
      if (e.button === 2) rightClickHoldScroll = false;
      if (_capturedPointerId !== null && e.pointerId === _capturedPointerId){
        try{ canvas.releasePointerCapture && canvas.releasePointerCapture(e.pointerId); }catch(_){ }
        _capturedPointerId = null;
      }
  // remove blockers when the right-button is released
  if (e.button === 2) _removeContextMenuBlocker();
  if (e.button === 2){ try{ if (_contextBlockerKeeper){ clearInterval(_contextBlockerKeeper); _contextBlockerKeeper = null; } }catch(_){ } try{ if (window && window._saved_oncontextmenu !== undefined) { window.oncontextmenu = window._saved_oncontextmenu; delete window._saved_oncontextmenu; } }catch(_){ } }
    }catch(_){ }
  });
  // robustly prevent the browser context menu and right-button default behavior
  // when the event occurs on (or inside) the game canvas. Use capture-phase
  // listeners and check the composedPath for shadow-dom friendliness.
  // (no-op here — use the consolidated _isEventOnCanvas defined above)

  // capture-phase handlers to stop the menu before it can appear
  canvas.addEventListener('contextmenu', (e) => { if (_isEventOnCanvas(e)){ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }catch(_){ } } }, true);
  document.addEventListener('contextmenu', (e) => { if (_isEventOnCanvas(e)){ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }catch(_){ } } }, true);
  // global/window-level fallback for any platform that surfaces a native menu before document handlers
  window.addEventListener('contextmenu', (e) => { if (_isEventOnCanvas(e)){ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }catch(_){ } } }, true);
  // also block right-button mousedown/auxclick to be extra safe across browsers
  document.addEventListener('mousedown', (e) => { if (e.button === 2 && _isEventOnCanvas(e)){ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }catch(_){ } } }, true);
  document.addEventListener('auxclick', (e) => { if (e.button === 2 && _isEventOnCanvas(e)){ try{ e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation && e.stopImmediatePropagation(); }catch(_){ } } }, true);

  // As an additional defensive measure, ensure the canvas's oncontextmenu returns false
  try{ if (canvas) canvas.oncontextmenu = function(){ return false; }; }catch(_){ }

  // ensure right-click hold state is cleared on pointercancel/leave (some devices fire these)
  canvas.addEventListener('pointercancel', (e) => { if (e.button === 2) rightClickHoldScroll = false; });
  canvas.addEventListener('pointerleave', (e) => { if (e.buttons === 0) rightClickHoldScroll = false; });

  // ensure we cleanup blockers if pointercancel/leave occur while right-button held
  canvas.addEventListener('pointercancel', (e) => { try{ if (e.button === 2){ rightClickHoldScroll = false; _removeContextMenuBlocker(); } }catch(_){ } });
  canvas.addEventListener('pointerleave', (e) => { try{ if (e.buttons === 0){ rightClickHoldScroll = false; _removeContextMenuBlocker(); } }catch(_){ } });

  // Ensure keeper is cleaned up if pointercancel/leave occur
  canvas.addEventListener('pointercancel', (e) => { try{ if (_contextBlockerKeeper){ clearInterval(_contextBlockerKeeper); _contextBlockerKeeper = null; } if (window && window._saved_oncontextmenu !== undefined){ window.oncontextmenu = window._saved_oncontextmenu; delete window._saved_oncontextmenu; } }catch(_){ } });
  canvas.addEventListener('pointerleave', (e) => { try{ if (_contextBlockerKeeper){ clearInterval(_contextBlockerKeeper); _contextBlockerKeeper = null; } if (window && window._saved_oncontextmenu !== undefined){ window.oncontextmenu = window._saved_oncontextmenu; delete window._saved_oncontextmenu; } }catch(_){ } });

  // Always track pointer position at document level so we continue to get
  // mouse coordinates while buttons are held (pointer capture or not).
  // global buttons state so we can detect rising edges (left button pressed)
  let _globalButtons = 0;
  document.addEventListener('pointermove', (e) => {
    try{
      const r = canvas.getBoundingClientRect();
      const mx = (e.clientX - r.left) * (canvas.width / r.width);
      const my = (e.clientY - r.top) * (canvas.height / r.height);
      // update shared input module if present
      if (window.__game_modules && window.__game_modules.input && window.__game_modules.input.mouse){
        window.__game_modules.input.mouse.x = mx; window.__game_modules.input.mouse.y = my;
      }
      // update local mouse fallback
      mouse.x = mx; mouse.y = my;
      // detect left-button rising edge: if previously left bit wasn't set
      // but now is set, trigger a fire (helps when mousedown isn't delivered)
      try{
        const prev = _globalButtons || 0;
        const nowButtons = e.buttons || 0;
        if (!(prev & 1) && (nowButtons & 1)){
          const nowt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          if (nowt - _lastManualFire > 20){ _lastManualFire = nowt; fireBullet(); }
        }
        _globalButtons = nowButtons;
      }catch(_){ }
      try{ window.__pointer_debug_update && window.__pointer_debug_update({ mx: Math.round(mx), button: e.button, buttons: e.buttons, evt: 'move', lastFire: _lastManualFire }); }catch(_){ }
    }catch(_){ }
  }, { passive: true });

  // document-level mousedown in capture phase to reliably detect left clicks
  // even when right-button pointer capture or other handlers interfere.
  document.addEventListener('mousedown', (e) => {
    try{
      // only respond to left-button presses and only when over canvas
      if ((e.button === 0 || (e.buttons && (e.buttons & 1))) && _isEventOnCanvas(e)){
        const nowt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        if (nowt - _lastManualFire > 20){ _lastManualFire = nowt; fireBullet(); }
        try{ window.__pointer_debug_update && window.__pointer_debug_update({ mx: Math.round(e.clientX), button: e.button, buttons: e.buttons, evt: 'doc-mousedown', lastFire: _lastManualFire }); }catch(_){ }
      }
    }catch(_){ }
  }, true);

// Defensive: ensure left-click firing works even if other buttons are held
// Use a tiny debounce so we don't double-fire when the input module also
// dispatches the same event.
let _lastManualFire = 0;
canvas.addEventListener('pointerdown', (e) => {
  try{
    if (e.button === 0 || (e.buttons && (e.buttons & 1))){
      const nowt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      if (nowt - _lastManualFire > 20){ _lastManualFire = nowt; fireBullet(); }
    }
  }catch(_){ }
});
  // update debug overlay on manual down attempts
  canvas.addEventListener('pointerdown', (e) => { try{ window.__pointer_debug_update && window.__pointer_debug_update({ mx: e.clientX, button: e.button, buttons: e.buttons, evt: 'manual-fire', lastFire: _lastManualFire }); }catch(_){ } });

// foliage implementation moved to js/foliage.js (initFoliage, updateFoliage, drawFoliage)

// --- Building tiles (small pixel houses/huts adapted from top_down_pixel_tank_html.html)
function makeBuildingCanvas(w=64,h=64){ const c = document.createElement('canvas'); c.width=w; c.height=h; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return { c, g }; }
function buildHouse1(b){ const g=b.g; g.clearRect(0,0,64,64); /* red shingled house */ g.fillStyle='#d4c7a1'; g.fillRect(12,18,40,34); g.fillStyle='#b8443f'; g.fillRect(8,10,48,12); g.fillStyle='#6fb2e5'; g.fillRect(16,26,8,8); g.fillRect(40,26,8,8); g.fillStyle='#7a4d2f'; g.fillRect(30,34,8,18); }
function buildHouse2(b){ const g=b.g; g.clearRect(0,0,64,64); /* blue slate cottage */ g.fillStyle='#e0d9c4'; g.fillRect(12,20,40,26); g.fillStyle='#3f5876'; g.fillRect(9,10,46,12); g.fillStyle='#a2d5ff'; g.fillRect(16,24,8,8); g.fillRect(40,24,8,8); g.fillStyle='#6e3e2b'; g.fillRect(30,28,8,18); }
function buildHouse3(b){ const g=b.g; g.clearRect(0,0,64,64); /* thatch hut */ g.fillStyle='#cbb089'; g.fillRect(14,22,36,26); g.fillStyle='#724a2e'; g.fillRect(28,30,8,18); g.fillStyle='#a98547'; g.fillRect(10,14,44,10); g.fillStyle='#7fb7e6'; g.fillRect(30,16,4,4); }
function buildHouse4(b){ const g=b.g; g.clearRect(0,0,64,64); /* stone house (neutral roof) */ g.fillStyle='#c9c9c9'; g.fillRect(14,18,36,28); g.fillStyle='#6b6b6b'; g.fillRect(12,10,40,10); g.fillStyle='#a9dcff'; g.fillRect(18,24,8,8); g.fillRect(38,24,8,8); g.fillStyle='#6a4631'; g.fillRect(28,30,8,16); }
function buildHouse5(b){ const g=b.g; g.clearRect(0,0,64,64); /* barn */ g.fillStyle='#caa071'; g.fillRect(8,22,48,24); g.fillStyle='#c76a27'; g.fillRect(6,12,52,10); g.fillStyle='#7d4f34'; g.fillRect(12,28,10,14); g.fillStyle='#89c7f4'; g.fillRect(26,28,12,6); }
function buildHouse6(b){ const g=b.g; g.clearRect(0,0,64,64); /* teal cabin (desaturated to remove green) */ g.fillStyle='#4a6a7a'; g.fillRect(16,22,32,20); g.fillStyle='#3b5160'; g.fillRect(14,14,36,8); g.fillStyle='#6a4833'; g.fillRect(28,28,8,14); g.fillStyle='#a6ddff'; g.fillRect(20,28,6,6); }
const buildingMakers = [ buildHouse1, buildHouse2, buildHouse3, buildHouse4, buildHouse5, buildHouse6 ];
const buildingTiles = [];
for (let i=0;i<buildingMakers.length;i++){ const b = makeBuildingCanvas(64,64); buildingMakers[i](b); buildingTiles.push(b); }
const buildingInstances = [];
const BUILDING_COUNT = 46;
for (let i=0;i<BUILDING_COUNT;i++){ buildingInstances.push({ x: Math.random()*WORLD_W, y: Math.random()*WORLD_H, idx: Math.floor(Math.random()*buildingTiles.length), scale: 0.7 + Math.random()*0.8, rot: 0, hp: 10 }); }

// Respawn queue for removed world objects (foliage/buildings)
const respawnQueue = [];
function scheduleRespawn(type, data, delayMs = 5000){ try{ const nowt = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); // store a shallow copy to avoid accidental mutation
    const copy = Object.assign({}, data);
    // normalize hp for copies
    if (type === 'foliage'){ copy.hp = (typeof copy.isTree === 'boolean' && copy.isTree) ? (1 + Math.floor(Math.random()*3)) : 1; copy.destructible = true; }
    if (type === 'building'){ copy.hp = copy.hp || 10; }
    respawnQueue.push({ type, data: copy, at: nowt + (delayMs||5000) });
  }catch(_){ }
}
function processRespawns(nowt){ try{
    for (let i = respawnQueue.length - 1; i >= 0; i--){ const r = respawnQueue[i]; const nowTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); if (nowTime >= r.at){ // re-insert into appropriate world array
          if (r.type === 'foliage'){ try{ foliageInstances.push(r.data); }catch(_){ }
          } else if (r.type === 'building'){ try{ buildingInstances.push(r.data); }catch(_){ }
          }
          respawnQueue.splice(i,1);
        }
    }
  }catch(_){ }
}

// Billboards moved to js/billboard.js (makeBillboardFrames, animation frames,
// instances and broken/gibbing code now live in that module)

// --- Critter sprites (from 8_pixel_jungle_critters.html) ---
function makeSpriteCanvas(specs, scale=3){
  const c = document.createElement('canvas');
  c.width = 8*scale; c.height = 8*scale;
  const g = c.getContext('2d');
  // ensure a predictable composite mode so fills always write opaque pixels
  g.globalCompositeOperation = 'source-over';
  g.imageSmoothingEnabled = false;
  for (const r of specs){ g.fillStyle = r.fill; g.fillRect(r.x*scale, r.y*scale, r.w*scale, r.h*scale); }
  // defensive check: if the sprite canvas is completely transparent (some envs
  // can produce empty canvases), stamp a tiny visible probe pixel so the sprite
  // remains visible and easier to diagnose. This is non-destructive for normal
  // sprites because we only write a single 1x1 pixel when the canvas is empty.
  try{
    const data = g.getImageData(0,0,c.width,c.height).data;
    let hasOpaque = false;
    for (let i = 3; i < data.length; i += 4){ if (data[i] !== 0){ hasOpaque = true; break; } }
  if (!hasOpaque){ console.warn('makeSpriteCanvas: produced empty sprite (no probe stamped)'); }
  }catch(e){ /* reading imageData may throw in some contexts; ignore */ }
  return c;
}

const critterSpecs = [];
// Frog
critterSpecs.push([
  {x:1,y:2,w:6,h:4,fill:'#3bb273'}, {x:0,y:4,w:2,h:2,fill:'#2a8956'}, {x:6,y:4,w:2,h:2,fill:'#2a8956'}, {x:2,y:1,w:1,h:1,fill:'#ffffff'}, {x:5,y:1,w:1,h:1,fill:'#ffffff'}, {x:3,y:4,w:2,h:2,fill:'#a5e67c'}, {x:2,y:6,w:4,h:1,fill:'#0b442b'}
]);
// Snake
critterSpecs.push([
  {x:1,y:3,w:5,h:1,fill:'#43b581'}, {x:1,y:2,w:1,h:2,fill:'#2e9d6d'}, {x:5,y:4,w:1,h:2,fill:'#2e9d6d'}, {x:2,y:5,w:4,h:1,fill:'#43b581'}, {x:6,y:4,w:1,h:1,fill:'#43b581'}, {x:7,y:4,w:1,h:1,fill:'#ff3b30'}
]);
// Parrot
critterSpecs.push([
  {x:2,y:2,w:3,h:3,fill:'#ef4444'}, {x:4,y:1,w:2,h:2,fill:'#ef4444'}, {x:2,y:3,w:2,h:1,fill:'#3b82f6'}, {x:1,y:4,w:1,h:2,fill:'#16a34a'}, {x:6,y:2,w:1,h:1,fill:'#f59e0b'}
]);
// Monkey
critterSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#8b5e3c'}, {x:3,y:1,w:2,h:2,fill:'#8b5e3c'}, {x:3,y:2,w:2,h:1,fill:'#d7b899'}
]);
// Jaguar
critterSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#f59e0b'}, {x:5,y:2,w:2,h:2,fill:'#f59e0b'}, {x:3,y:3,w:1,h:1,fill:'#222'}
]);
// Chameleon
critterSpecs.push([
  {x:1,y:3,w:5,h:2,fill:'#84cc16'}, {x:6,y:3,w:1,h:2,fill:'#84cc16'}, {x:2,y:2,w:3,h:1,fill:'#65a30d'}
]);
// Toucan
critterSpecs.push([
  {x:2,y:3,w:3,h:3,fill:'#0b0b0b'}, {x:4,y:2,w:2,h:2,fill:'#0b0b0b'}, {x:6,y:2,w:2,h:1,fill:'#facc15'}, {x:6,y:3,w:2,h:1,fill:'#fb923c'}
]);
// Beetle
critterSpecs.push([
  {x:3,y:2,w:2,h:4,fill:'#3b82f6'}, {x:2,y:3,w:1,h:3,fill:'#2563eb'}, {x:5,y:3,w:1,h:3,fill:'#2563eb'}
]);

const CRITTER_SPR_SCALE = 3; // how many canvas pixels per SVG pixel
// how much to scale critter/animal sprites on top of camera.zoom
// make them a tad smaller overall; critters are smaller than animals
// make critters and animals a bit smaller overall
// visual size multipliers (relative to camera.zoom)
// make critters visibly smaller and animals larger so they read differently in-world
const CRITTER_DRAW_BASE = 0.7; // was 0.9
const ANIMAL_DRAW_BASE = 0.6;  // reduced so animals render smaller (was 1.35)
const critterSprites = critterSpecs.map(s=>makeSpriteCanvas(s, CRITTER_SPR_SCALE));
// Validate critter sprite canvases and rebuild any that are invalid/empty.
// Some environments may create 0x0 canvases if document isn't ready or if
// the canvas context failed; proactively repair those entries.
for (let i = 0; i < critterSprites.length; i++){
  const spr = critterSprites[i];
  if (!spr || !spr.width || !spr.height){
  try{ critterSprites[i] = makeSpriteCanvas(critterSpecs[i], CRITTER_SPR_SCALE); if (DEBUG && console && console.log) console.log('Rebuilt missing critter sprite at idx', i); }catch(e){ console.warn('Failed to rebuild critter sprite', i, e); }
  }
}
// expose critterSprites globally so other modules (journal) can reference them for fallbacks
try{ window.critterSprites = critterSprites; }catch(err){ console.warn('expose critterSprites failed', err); }

// --- Larger animal sprites (from 8_pixel_jungle_critters(2).html) -----------------
function makeLargeSpriteCanvas(specs, scale = 4){
  const TILE = 12; // source tile is 12x12 in the HTML
  const c = document.createElement('canvas'); c.width = TILE * scale; c.height = TILE * scale;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  for (const r of specs){ g.fillStyle = r.fill; g.fillRect(r.x*scale, r.y*scale, r.w*scale, r.h*scale); }
  return c;
}

const largeAnimalSpecs = [];
// Elephant
largeAnimalSpecs.push([
  {x:2,y:5,w:7,h:4,fill:'#8f9da6'}, {x:8,y:4,w:2,h:2,fill:'#8f9da6'}, {x:10,y:5,w:1,h:2,fill:'#8f9da6'}, {x:11,y:6,w:1,h:1,fill:'#8f9da6'}, {x:7,y:3,w:2,h:2,fill:'#aab6be'}, {x:3,y:9,w:1,h:2,fill:'#6f7a83'}, {x:6,y:9,w:1,h:2,fill:'#6f7a83'}, {x:9,y:4,w:1,h:1,fill:'#111'}
]);
// Tiger
largeAnimalSpecs.push([
  {x:2,y:6,w:7,h:3,fill:'#f59e0b'}, {x:8,y:5,w:2,h:2,fill:'#f59e0b'}, {x:3,y:6,w:1,h:1,fill:'#221'}, {x:5,y:7,w:1,h:1,fill:'#221'}, {x:7,y:6,w:1,h:1,fill:'#221'}, {x:1,y:6,w:1,h:1,fill:'#f59e0b'}, {x:0,y:6,w:1,h:1,fill:'#f59e0b'}, {x:0,y:5,w:1,h:1,fill:'#221'}, {x:9,y:5,w:1,h:1,fill:'#111'}
]);
// Gorilla
largeAnimalSpecs.push([
  {x:3,y:6,w:6,h:3,fill:'#3a3a3a'}, {x:2,y:7,w:1,h:2,fill:'#2a2a2a'}, {x:9,y:7,w:1,h:2,fill:'#2a2a2a'}, {x:5,y:4,w:3,h:2,fill:'#3a3a3a'}, {x:6,y:5,w:2,h:1,fill:'#9e9e9e'}, {x:7,y:4,w:1,h:1,fill:'#111'}
]);
// Crocodile
largeAnimalSpecs.push([
  {x:2,y:7,w:7,h:2,fill:'#3b9d5a'}, {x:9,y:6,w:2,h:2,fill:'#3b9d5a'}, {x:10,y:7,w:2,h:1,fill:'#2a7a44'}, {x:3,y:6,w:1,h:1,fill:'#2a7a44'}, {x:5,y:6,w:1,h:1,fill:'#2a7a44'}, {x:7,y:6,w:1,h:1,fill:'#2a7a44'}, {x:10,y:6,w:1,h:1,fill:'#fff'}
]);
// Hippo
largeAnimalSpecs.push([
  {x:3,y:6,w:6,h:3,fill:'#8b7aa8'}, {x:8,y:5,w:2,h:2,fill:'#8b7aa8'}, {x:9,y:5,w:1,h:1,fill:'#111'}, {x:4,y:9,w:1,h:2,fill:'#6e5f87'}, {x:6,y:9,w:1,h:2,fill:'#6e5f87'}, {x:9,y:6,w:1,h:1,fill:'#333'}
]);
// Rhino
largeAnimalSpecs.push([
  {x:3,y:6,w:6,h:3,fill:'#9aa2a7'}, {x:8,y:5,w:2,h:2,fill:'#9aa2a7'}, {x:10,y:5,w:1,h:1,fill:'#cfd6da'}, {x:4,y:9,w:1,h:2,fill:'#7f8a90'}, {x:6,y:9,w:1,h:2,fill:'#7f8a90'}, {x:9,y:5,w:1,h:1,fill:'#111'}
]);
// Orangutan
largeAnimalSpecs.push([
  {x:3,y:6,w:5,h:3,fill:'#b45309'}, {x:2,y:7,w:1,h:2,fill:'#8a3f06'}, {x:8,y:7,w:1,h:2,fill:'#8a3f06'}, {x:6,y:4,w:2,h:2,fill:'#b45309'}, {x:7,y:4,w:1,h:1,fill:'#111'}
]);
// Panther
largeAnimalSpecs.push([
  {x:2,y:6,w:7,h:3,fill:'#0a0a0a'}, {x:8,y:5,w:2,h:2,fill:'#0a0a0a'}, {x:3,y:7,w:1,h:1,fill:'#1a1a1a'}, {x:6,y:7,w:1,h:1,fill:'#1a1a1a'}, {x:9,y:5,w:1,h:1,fill:'#fff'}
]);

const largeAnimalSprites = largeAnimalSpecs.map(s => makeLargeSpriteCanvas(s, 4));
try{ window.largeAnimalSprites = largeAnimalSprites; }catch(err){ console.warn('expose largeAnimalSprites failed', err); }

// ------------------
// Animated jungle character makers (idle + running) — adapted from the two demo files
// Each character will render into an offscreen 72×72 tile; we call the idle/run maker per-frame
// Character makers were moved to `js/characters.js` to keep game.js smaller.
import { CHAR_TILE_PX, charTileCanvas, idleMakers as charsIdleMakers, runMakers as charsRunMakers, initCharactersAssets, CHAR_PAL, pxC, ellipseShadowC } from './characters.js';
// characters makers will be merged into the local maps later (after idleMakers/runMakers are declared)
function makeHeavyIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.8, 13, 3.4, CHAR_PAL.shadow); const wob = Math.sin(t*0.003)*0.8; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.8; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); pxC(g,cx-4,baseY-7,10,4,'#3a3a3a'); drawTorsoC(g,cx,baseY, '#2d3b33'); drawSatchelC(g,cx,baseY); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); drawHairC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+wob,lookA, CHAR_PAL.skinDk); drawRifleC(g,cx+1,baseY-11+wob,lookA); }; }
function makeMedicIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const b = Math.sin(t*0.004)*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinLt); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#3f5148'); pxC(g,cx-1,baseY-12,3,3,'#d33'); drawHeadC(g,cx,baseY, CHAR_PAL.skinLt); drawHairC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+b,lookA, CHAR_PAL.skinLt); drawPistolC(g,cx+2,baseY-11+b,lookA); }; }
function makeVillager1Idle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 10.5, 3, CHAR_PAL.shadow); const sway = Math.sin(t*0.004)*0.9; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); pxC(g,cx-3,baseY-7,8,3,'#6b5b3a'); drawTorsoC(g,cx,baseY, '#5b7d64'); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); pxC(g,cx-4,baseY-22,9,2,'#caa84a'); pxC(g,cx-5,baseY-21,11,1,'#caa84a'); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinMd); }; }
function makeVillager2Idle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 10.5, 3, CHAR_PAL.shadow); const sway = Math.cos(t*0.0035)*0.8; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinLt); pxC(g,cx-3,baseY-7,8,3,'#335c4a'); drawTorsoC(g,cx,baseY, '#496b55'); drawHeadC(g,cx,baseY, CHAR_PAL.skinLt); for(let i=0;i<7;i++) pxC(g,cx-5+i,baseY-14+i,1,1,'#2a2a2a'); pxC(g,cx+4,baseY-10,3,4,'#2a2a2a'); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinLt); }; }
function makeGuideIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const b = Math.sin(t*0.0045)*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#355546'); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); pxC(g,cx+4,baseY-10,4,1,CHAR_PAL.metal); pxC(g,cx+7,baseY-11,1,3,'#3b2a1a'); drawArmsAimingC(g,cx,baseY+b,lookA, CHAR_PAL.skinDk); }; }
function makeRadioOpIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const wob = Math.sin(t*0.0038)*0.9; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#3b4e44'); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); drawHairC(g,cx,baseY); pxC(g,cx-7,baseY-13,4,6,'#2a2f34'); for(let i=0;i<7;i++) pxC(g,cx-8,baseY-14-i,1,1,'#aab'); drawArmsAimingC(g,cx,baseY+wob,lookA, CHAR_PAL.skinMd); drawPistolC(g,cx+2,baseY-11+wob,lookA); }; }

// Running makers
function makeCommandoRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph = t*0.01*5.5; const bob = Math.abs(Math.sin(ph))*1.5; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY-1,12,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, CHAR_PAL.cloth1, bob); drawVestC(g,cx,baseY, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); drawHairRunC(g,cx,baseY, bob); drawBandanaC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); drawRifleC(g,cx+2,baseY-11+bob,lookA); }; }
function makeScoutRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*6.0, bob=Math.abs(Math.sin(ph))*1.2; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+1); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, CHAR_PAL.cloth2, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); drawHairRunC(g,cx,baseY, bob); drawShoulderStrapC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }
function makeHeavyRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.0, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.8; ellipseShadowC(g,cx,baseY,13,3.4,CHAR_PAL.shadow); drawDustC(g,cx-7,baseY+1,ph+0.5); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); pxC(g,cx-4,baseY-7,10,4,'#3a3a3a'); drawTorsoRunC(g,cx,baseY, '#2d3b33', bob); drawSatchelC(g,cx,baseY, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); drawHairRunC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); drawRifleC(g,cx+1,baseY-11+bob,lookA); }; }
function makeMedicRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.6, bob=Math.abs(Math.sin(ph))*1.2; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-5,baseY+1,ph+2.1); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinLt, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#3f5148', bob); pxC(g,cx-1,baseY-12-bob,3,3,'#d33'); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinLt, bob); drawHairRunC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinLt, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }
function makeVillager1Run(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.2, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,10.5,3,CHAR_PAL.shadow); drawDustC(g,cx-5,baseY+1,ph+0.7); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); pxC(g,cx-3,baseY-7,8,3,'#6b5b3a'); drawTorsoRunC(g,cx,baseY, '#5b7d64', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); pxC(g,cx-4,baseY-22-bob,9,2,'#caa84a'); pxC(g,cx-5,baseY-21-bob,11,1,'#caa84a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); }; }
function makeVillager2Run(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.0, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,10.5,3,CHAR_PAL.shadow); drawDustC(g,cx-4,baseY+1,ph+1.4); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinLt, ph); pxC(g,cx-3,baseY-7,8,3,'#335c4a'); drawTorsoRunC(g,cx,baseY, '#496b55', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinLt, bob); for(let i=0;i<7;i++) pxC(g,cx-5+i,baseY-14-bob+i,1,1,'#2a2a2a'); pxC(g,cx+4,baseY-10-bob,3,4,'#2a2a2a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinLt, Math.sin(ph)); }; }
function makeGuideRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.4, bob=Math.abs(Math.sin(ph))*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+2.8); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#355546', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); pxC(g,cx+4,baseY-10-bob,4,1,CHAR_PAL.metal); pxC(g,cx+7,baseY-11-bob,1,3,'#3b2a1a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); }; }
function makeRadioOpRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.3, bob=Math.abs(Math.sin(ph))*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+3.5); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#3b4e44', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); drawHairRunC(g,cx,baseY, bob); pxC(g,cx-7,baseY-13-bob,4,6,'#2a2f34'); for(let i=0;i<7;i++) pxC(g,cx-8,baseY-14-bob-i,1,1,'#aab'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }

// JUNGLE_KINDS is provided by the humans module import near the top of this file.

const idleMakers = {};
const runMakers = {};
// merge makers provided by humans module (e.g., fatsammich)
Object.assign(idleMakers, humansIdleMakers);
Object.assign(runMakers, humansRunMakers);
// merge the makers from the characters module (moved out of game.js)
Object.assign(idleMakers, charsIdleMakers);
Object.assign(runMakers, charsRunMakers);
// initialize characters module with runtime assets (ASSETS is defined above)
initCharactersAssets(ASSETS);
// squidrobot makers (top-down robot with rotating turret)
// pixel-accurate squidrobot maker adapted from Squidrobot.html (body frames + turret)
function makeSquidRobotIdle(g){
  const W = 64, H = 64, CX = 32, CY = 32, FRAMES = 12;
  // build offscreen body frames sized to CHAR_TILE_PX (we'll scale later)
  const bodyFrames = [];
  const bodyBob = [];
  function makeLayer(){ const c = document.createElement('canvas'); c.width = CHAR_TILE_PX; c.height = CHAR_TILE_PX; return c; }
  // pixel helpers (re-using existing small helpers is fine)
  function px(ctx,x,y,col,t=1){ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),t,t); }
  function line(ctx,x0,y0,x1,y1,col,t=1){ x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1); const dx=Math.abs(x1-x0), sx=x0<x1?1:-1; const dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy; while(true){ px(ctx,x0,y0,col,t); if(x0===x1 && y0===y1) break; const e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
  function circleFill(ctx,cx,cy,r,col){ ctx.fillStyle = col; for(let y=-r;y<=r;y++){ const w = Math.floor(Math.sqrt(r*r - y*y)); ctx.fillRect(Math.round(cx-w), Math.round(cy+y), 2*w+1, 1); } }
  function rimLightArc(ctx,cx,cy,r,col){ ctx.fillStyle=col; for(let a=-0.2;a<=0.9;a+=0.05){ const x=Math.round(cx+Math.cos(a)*r); const y=Math.round(cy+Math.sin(a)*r); ctx.fillRect(x,y,1,1); if (Math.random()<0.3) ctx.fillRect(x,y-1,1,1); } }
  function leg(ctx,cx,cy,baseAngle,phase,colors){ const L1=7,L2=6; const swing=Math.sin(phase)*2.0; const lift=Math.cos(phase*0.5)*1.0; const bodyR=12; const bx=cx+Math.cos(baseAngle)*(bodyR-1); const by=cy+Math.sin(baseAngle)*(bodyR-1); const kx=bx+Math.cos(baseAngle)*(L1+swing*0.4); const ky=by+Math.sin(baseAngle)*(L1+swing*0.4)-lift; const fx=kx+Math.cos(baseAngle)*(L2+swing); const fy=ky+Math.sin(baseAngle)*(L2+swing)+lift*0.25; line(ctx,bx,by,kx,ky,colors.dark,2); line(ctx,kx,ky,fx,fy,colors.light,1); px(ctx,fx,fy,colors.light,2); }
  function shadow(ctx){ ctx.save(); ctx.fillStyle = CHAR_PAL.shadow; const rx=16, ry=6, cy = CHAR_TILE_PX*0.78 + 10; for (let y=-ry;y<=ry;y++){ const w = Math.floor(Math.sqrt(1 - (y*y)/(ry*ry)) * rx); ctx.fillRect(CHAR_TILE_PX/2 - w, cy + y, 2*w+1, 1); } ctx.restore(); }
  // build frames
  for (let fi=0; fi<FRAMES; fi++){
    const c = makeLayer(); const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; const t = fi / FRAMES; const bob = Math.round(Math.sin(t * Math.PI*2) * 1);
    // draw shadow
    shadow(ctx);
    // legs
    const legColors = { dark: '#1e2430', light: '#5e7389' };
    for (let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; const phase=(t*Math.PI*2) + (i%2?Math.PI:0); leg(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, a, phase, legColors); }
    // body discs
    circleFill(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, 12, '#11141a');
    circleFill(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, 11, '#1e2430');
    circleFill(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, 9, '#2b3445');
    rimLightArc(ctx, CHAR_TILE_PX/2-2, CHAR_TILE_PX*0.78-2 + bob, 10, '#5e7389');
    bodyFrames.push(c); bodyBob.push(bob);
  }

  // turret draw helper (angle in radians)
  function drawTurretTo(ctx, angle, bob){ // scale down a bit to fit tile size
    const cx = CHAR_TILE_PX/2, cy = CHAR_TILE_PX*0.78 - 1 + bob;
    // cap
    circleFill(ctx, cx, cy, 6, '#1e2430'); circleFill(ctx, cx, cy, 5, '#2b3445'); px(ctx, cx-1, cy-3, '#5e7389', 2);
    // bolts
    for (let k=0;k<6;k++){ const aa = angle + (k/6)*Math.PI*2; const bx = Math.round(cx + Math.cos(aa)*4); const by = Math.round(cy + Math.sin(aa)*4); px(ctx,bx,by,'#8fb4cf',1); }
    // barrel
    const dx=Math.cos(angle), dy=Math.sin(angle);
    for (let s=2;s<=14;s++){ const x = Math.round(cx + dx*s); const y = Math.round(cy + dy*s); px(ctx,x,y,'#5e7389',2); if (s%3===0) px(ctx,x,y,'#5e7389',2); }
    // sight
    const sx = Math.round(cx + Math.cos(angle)*8 - Math.sin(angle)*2); const sy = Math.round(cy + Math.sin(angle)*8 + Math.cos(angle)*2); px(ctx,sx,sy,'#c9d1d9',1);
  }

  // return maker closure
  return (t, lookA) => {
    // If an external kraken sprite is available, draw it scaled into the char tile and return
    if (ASSETS.kraken){
      const img = ASSETS.kraken; const srcW = img.width, srcH = img.height;
      const scale = Math.floor((CHAR_TILE_PX * 0.92) / Math.max(1, srcW));
      const dw = srcW * scale, dh = srcH * scale;
      const dx = Math.round((CHAR_TILE_PX - dw)/2);
      const dy = Math.round((CHAR_TILE_PX - dh)/2 + 2);
      g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX);
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0,0, srcW, srcH, dx, dy, dw, dh);
      return;
    }
    // pick frame based on time
    const idx = Math.floor((t/100) % bodyFrames.length);
    const b = bodyFrames[idx]; const bob = bodyBob[idx]||0;
    g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX);
    g.drawImage(b,0,0);
    drawTurretTo(g, lookA, bob);
  };
}
function makeSquidRobotRun(g){ return makeSquidRobotIdle(g); }
idleMakers.squidrobot = makeSquidRobotIdle; runMakers.squidrobot = makeSquidRobotRun;

// Kraken maker: adapted from kraken.html (64x64, 6 frames). Prefer external ASSETS.kraken if available.
function makeKrakenIdle(g){
  // build 6 frames at CHAR_TILE_PX
  const FRAMES = 6; const frames = []; const bobs = [];
  function px(ctx,x,y,col){ ctx.fillStyle = col; ctx.fillRect(x|0,y|0,1,1); }
  function disc(ctx,cx,cy,r,col){ for(let yy=-r; yy<=r; yy++){ const span = Math.floor(Math.sqrt(r*r - yy*yy)); for(let xx=-span; xx<=span; xx++) px(ctx, cx+xx, cy+yy, col); } }
  function barrel(ctx,cx,cy,angle,len,col){ for(let i=0;i<len;i++){ const x = Math.round(cx + Math.cos(angle) * (6 + i)); const y = Math.round(cy + Math.sin(angle) * (6 + i)); px(ctx,x,y,col); if(i<2){ px(ctx,x+1,y,col); px(ctx,x,y+1,col); } } }
  function tentacle(ctx,cx,cy,baseAngle,tPhase,bodyRadius,frame){ const segs = 9; for(let s=0;s<segs;s++){ const progress = s/(segs-1); const throb = Math.sin((frame + s*0.6 + tPhase) * 0.9); const bend = 0.35 * throb * (0.3 + 0.7*progress); const a = baseAngle + bend; const dist = bodyRadius + 1 + s*3; const x = Math.round(cx + Math.cos(a) * dist); const y = Math.round(cy + Math.sin(a) * dist); const size = (s < 2) ? 3 : (s < 5 ? 2 : 1); const col = (s < 2) ? '#4f6a6d' : (s < 5 ? '#2f4f4f' : '#0a2a2f'); for(let dy=0;dy<size;dy++){ for(let dx=0;dx<size;dx++){ px(ctx, x + dx - (size>>1), y + dy - (size>>1), col); } } if(size >= 2 && (s % 2 === 0)){ const hx = Math.round(x + Math.cos(a + Math.PI/2)); const hy = Math.round(y + Math.sin(a + Math.PI/2)); px(ctx, hx, hy, '#b0c7c9'); } } }
  for (let fi=0; fi<FRAMES; fi++){
    const c = document.createElement('canvas'); c.width = CHAR_TILE_PX; c.height = CHAR_TILE_PX; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false;
    // scale factor from 64->CHAR_TILE_PX
    const s = CHAR_TILE_PX/64;
    ctx.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX);
    const cx = Math.round(CHAR_TILE_PX/2), cy = Math.round(CHAR_TILE_PX/2);
    // layered discs
    disc(ctx, cx, cy, Math.round(14*s), '#2f4f4f');
    disc(ctx, cx + Math.round(1*s), cy + Math.round(2*s), Math.round(13*s), '#4f6a6d');
    disc(ctx, cx, cy, Math.round(11*s), '#0a2a2f');
    disc(ctx, cx - Math.round(1*s), cy - Math.round(2*s), Math.round(9*s), '#4f6a6d');
    disc(ctx, cx - Math.round(2*s), cy - Math.round(3*s), Math.round(7*s), '#b0c7c9');
    // rim light (approx)
    for (let y=-14; y<=14; y++){ const span = Math.floor(Math.sqrt(14*14 - y*y)); for (let x=-span; x<=span; x++){ const rr = x*x + y*y; if (rr <= 14*14 && rr >= (14*14 - 18) && (x + y) < -4){ px(ctx, cx + x, cy + y, '#8fe3f7'); } } }
    // turret dome + barrel
    disc(ctx, cx, cy, Math.round(6*s), '#0b0d0e');
    disc(ctx, cx, cy, Math.round(4*s), '#0a2a2f');
    for (let a=0;a<6;a++) px(ctx, cx - 2 + a%3, cy - 3 + (a/3|0), '#b0c7c9');
    const angle = 0; barrel(ctx, cx, cy, angle, 7, '#0b0d0e');
    // eyes
    const forward = angle; const perp = forward + Math.PI/2; const eyeDist = Math.round(10*s); const eyeSpread = Math.round(3*s);
    const pulse = (fi % 6) < 3 ? '#ff1e2d' : '#ff7a00';
    const ex1 = Math.round(cx + Math.cos(forward)*eyeDist + Math.cos(perp)*eyeSpread);
    const ey1 = Math.round(cy + Math.sin(forward)*eyeDist + Math.sin(perp)*eyeSpread);
    const ex2 = Math.round(cx + Math.cos(forward)*eyeDist - Math.cos(perp)*eyeSpread);
    const ey2 = Math.round(cy + Math.sin(forward)*eyeDist - Math.sin(perp)*eyeSpread);
    [ [ex1,ey1], [ex2,ey2] ].forEach(([x,y])=>{ px(ctx,x,y,pulse); px(ctx,x+1,y,pulse); px(ctx,x,y+1,pulse); px(ctx,x+1,y+1,pulse); px(ctx,x,y-1,'#0b0d0e'); px(ctx,x+1,y-1,'#0b0d0e'); });
    // tentacles
    const baseR = Math.round(14*s);
    for (let k=0;k<8;k++){ const baseAngle = k * (Math.PI/4); tentacle(ctx, cx, cy, baseAngle, k*0.7, baseR, fi); }
    // glacis wedge
    for (let i=0;i<6;i++){ const a = angle; const r = baseR - 2 + i; const x = Math.round(cx + Math.cos(a) * r); const y = Math.round(cy + Math.sin(a) * r); px(ctx,x,y,'#4f6a6d'); if(i<4) px(ctx, x + Math.round(Math.cos(a+Math.PI/2)), y + Math.round(Math.sin(a+Math.PI/2)), '#4f6a6d'); }
    frames.push(c); bobs.push(0);
  }

  // if ASSETS.kraken is present, prefer that
  return (t, lookA) => {
    if (ASSETS.kraken){ const img = ASSETS.kraken; const srcW = img.width, srcH = img.height; const scale = Math.floor((CHAR_TILE_PX * 0.92) / Math.max(1, srcW)); const dw = srcW * scale, dh = srcH * scale; const dx = Math.round((CHAR_TILE_PX - dw)/2); const dy = Math.round((CHAR_TILE_PX - dh)/2 + 2); g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); g.imageSmoothingEnabled = false; g.drawImage(img, 0,0, srcW, srcH, dx, dy, dw, dh); return; }
    const idx = Math.floor((t/120) % frames.length);
    const frame = frames[idx]; g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); g.drawImage(frame, 0,0);
  };
}
function makeKrakenRun(g){ return makeKrakenIdle(g); }
idleMakers.kraken = makeKrakenIdle; runMakers.kraken = makeKrakenRun;

// Osprey maker: adapted pixel-perfect from Osprey.html, draws into CHAR_TILE_PX
function makeOspreyIdle(g){
  // Prefer the osprey maker from the characters module when available so all
  // osprey tiles are generated by the single canonical implementation.
  try{ if (charsIdleMakers && typeof charsIdleMakers.osprey === 'function') return charsIdleMakers.osprey(g); }catch(_){ }
  // Render the original 64x64 Osprey art pixel-for-pixel into the CHAR_TILE_PX tile.
  return (t, lookA) => {
    g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX);
    // If external osprey asset is present, draw it centered and scaled
    if (ASSETS.osprey){
      const img = ASSETS.osprey;
      const srcW = img.width, srcH = img.height;
      const scale = Math.floor((CHAR_TILE_PX * 0.92) / srcW);
      const dw = srcW * scale, dh = srcH * scale;
      const dx = Math.round((CHAR_TILE_PX - dw)/2);
      const dy = Math.round((CHAR_TILE_PX - dh)/2);
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0,0, srcW, srcH, dx, dy, dw, dh);
      return;
    }
    // fallback: bake 12 rotor frames (64x64) and play them based on time; keep bob applied at draw-time
    if (!makeOspreyIdle._cachedFrames){
      const frames = [];
      const COL = { outline: '#1b1e27', steelMid: '#596273', steelLight: '#8f98ab', rim: '#c9d1e4', rotorDark: '#2b303b', rotorBlur: 'rgba(154,163,180,0.35)', glass: '#3a74a6', warn: '#d26b1e' };
      for (let step=0; step<12; step++){
        const spr = document.createElement('canvas'); spr.width = 64; spr.height = 64; const s = spr.getContext('2d'); s.imageSmoothingEnabled = false;
        function pxLocal(x,y,col){ s.fillStyle = col; s.fillRect(x|0,y|0,1,1); }
        function rectLocal(x,y,w,h,col){ s.fillStyle = col; s.fillRect(x|0,y|0,w|0,h|0); }
        function discLocal(cx,cy,r,col){ for (let yy=-r; yy<=r; yy++){ for (let xx=-r; xx<=r; xx++){ if (xx*xx + yy*yy <= r*r) pxLocal(cx+xx, cy+yy, col); } } }
        function lineLocal(x0,y0,x1,y1,col){ x0|=0; y0|=0; x1|=0; y1|=0; let dx=Math.abs(x1-x0), sx = x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy = y0<y1?1:-1; let err = dx+dy; while(true){ pxLocal(x0,y0,col); if (x0===x1 && y0===y1) break; const e2 = 2*err; if (e2>=dy){ err += dy; x0 += sx; } if (e2<=dx){ err += dx; y0 += sy; } } }
        const cx = 32, cy = 32; const bob = 0; const wingY = cy - 2 + bob;
        for (let i=0;i<5;i++){ const alpha = 0.06 - i*0.01; if (alpha <= 0) break; const w = 36 - i*6, h = 8 - i*1; rectLocal(cx - (w>>1), cy + 12 + bob - (h>>1) + i, w, h, `rgba(0,0,0,${alpha})`); }
        rectLocal(cx - 22, wingY, 44, 4, COL.steelMid);
        rectLocal(cx - 22, wingY, 44, 1, COL.rim);
        rectLocal(cx - 4, cy - 12 + bob, 8, 24, COL.steelMid);
        rectLocal(cx - 3, cy - 16 + bob, 6, 4, COL.steelLight);
        rectLocal(cx - 2, cy - 15 + bob, 4, 2, COL.glass);
        rectLocal(cx - 3, cy + 13 + bob, 6, 6, COL.steelMid);
        rectLocal(cx - 14, cy + 15 + bob, 28, 2, COL.steelMid);
        rectLocal(cx - 4, cy - 12 + bob, 8, 1, COL.rim);
        rectLocal(cx - 22, wingY - 1, 44, 1, COL.outline);
        rectLocal(cx - 22, wingY + 4, 44, 1, COL.outline);
        rectLocal(cx - 5, cy - 13 + bob, 1, 24, COL.outline);
        rectLocal(cx + 4, cy - 13 + bob, 1, 24, COL.outline);
        const nxL = cx - 22, nxR = cx + 22; const ny = wingY + 2 + bob;
        rectLocal(nxL - 4, ny - 4, 8, 8, COL.steelMid);
        rectLocal(nxR - 4, ny - 4, 8, 8, COL.steelMid);
        rectLocal(nxL - 4, ny - 4, 8, 1, COL.rim);
        rectLocal(nxR - 4, ny - 4, 8, 1, COL.rim);
        rectLocal(nxL - 4, ny + 4, 3, 1, COL.warn);
        rectLocal(nxR + 1, ny + 4, 3, 1, COL.warn);
        rectLocal(nxL - 5, ny - 5, 10, 1, COL.outline);
        rectLocal(nxL - 5, ny + 4, 10, 1, COL.outline);
        rectLocal(nxR - 5, ny - 5, 10, 1, COL.outline);
        rectLocal(nxR - 5, ny + 4, 10, 1, COL.outline);
        discLocal(nxL, ny, 1, COL.warn);
        discLocal(nxR, ny, 1, COL.warn);
        // rotors for this step
        const ang = (step % 12) * (Math.PI * 2 / 12);
        (function drawRotorAt(cxR, cyR, angR, r){
          for (let i=0;i<3;i++){
            const a = angR + i * (Math.PI*2/3);
            const ex = Math.round(cxR + Math.cos(a) * r);
            const ey = Math.round(cyR + Math.sin(a) * r);
            lineLocal(cxR, cyR, ex, ey, COL.rotorDark);
            const ox = Math.round(-Math.sin(a)), oy = Math.round(Math.cos(a));
            lineLocal(cxR + ox, cyR + oy, ex + ox, ey + oy, COL.rotorDark);
            lineLocal(cxR - ox, cyR - oy, ex - ox, ey - oy, COL.rotorBlur);
          }
          discLocal(cxR, cyR, 2, COL.rotorBlur);
        })(nxL, ny, ang, 10);
        (function drawRotorAt(cxR, cyR, angR, r){
          for (let i=0;i<3;i++){
            const a = angR + i * (Math.PI*2/3);
            const ex = Math.round(cxR + Math.cos(a) * r);
            const ey = Math.round(cyR + Math.sin(a) * r);
            lineLocal(cxR, cyR, ex, ey, COL.rotorDark);
            const ox = Math.round(-Math.sin(a)), oy = Math.round(Math.cos(a));
            lineLocal(cxR + ox, cyR + oy, ex + ox, ey + oy, COL.rotorDark);
            lineLocal(cxR - ox, cyR - oy, ex - ox, ey - oy, COL.rotorBlur);
          }
          discLocal(cxR, cyR, 2, COL.rotorBlur);
        })(nxR, ny, ang, 10);
        frames.push(spr);
      }
      makeOspreyIdle._cachedFrames = frames;
    }
    const frames = makeOspreyIdle._cachedFrames;
    if (frames && frames.length){
      const steps = frames.length;
      const idx = Math.floor((t/60)) % steps;
      const frame = frames[idx];
      const bob = Math.round(Math.sin(t/1200) * 1.5);
      const srcW = frame.width, srcH = frame.height;
      const scaleOut = Math.floor((CHAR_TILE_PX * 0.92) / srcW);
      const dw = srcW * scaleOut, dh = srcH * scaleOut;
      const dx = Math.round((CHAR_TILE_PX - dw)/2);
      // apply bob in destination space (scale proportionally)
      const dy = Math.round((CHAR_TILE_PX - dh)/2 + (bob * (dh / srcH)));
      g.imageSmoothingEnabled = false;
      g.drawImage(frame, 0,0, srcW, srcH, dx, dy, dw, dh);
    }
  };
}
function makeOspreyRun(g){ return makeOspreyIdle(g); }


// fatsammich makers live in `js/humans.js` and are merged into the local makers map above.

// enemy projectiles (fired by jungle characters)
const enemyBullets = []; // {x,y,dx,dy,life,spd}
// kitten-specific projectiles (completely separate from enemyBullets)
// kept separate so an imported animation and behavior won't affect other bullets
const kittenBullets = []; // {x,y,dx,dy,life,hitR,anim?}
// muzzle flashes (short-lived world-space flashes produced when enemies fire)
const muzzleFlashes = []; // {x,y,angle,life}
// expose enemyBullets to other modules that may push into it (e.g., alternativetanks)
try{ window.enemyBullets = enemyBullets; }catch(err){ console.warn('expose enemyBullets failed', err); }
try{ window.kittenBullets = kittenBullets; }catch(err){ console.warn('expose kittenBullets failed', err); }

// screen shake state
const screenShake = { time: 0, duration: 0, magnitude: 0 };

function spawnMuzzleFlash(x, y, angle){ muzzleFlashes.push({ x, y, angle, life: 0.12 + Math.random()*0.06 }); }

function triggerScreenShake(mag = 10, dur = 0.18){ screenShake.time = Math.max(screenShake.time, dur); screenShake.duration = Math.max(screenShake.duration, dur); screenShake.magnitude = Math.max(screenShake.magnitude, mag); }
// expose for other modules that might call it directly
window.triggerScreenShake = triggerScreenShake;
// expose spawnMuzzleFlash so external modules can create muzzle visuals
try{ window.spawnMuzzleFlash = spawnMuzzleFlash; }catch(err){ console.warn('expose spawnMuzzleFlash failed', err); }

// --- osprey gibs: spawn logical fuselage/wing/tail/rotor pieces using image fragments
function spawnOspreyGibs(x, y, ent){
  try{
    // prefer the entity's baked tile when available, otherwise the loaded ASSETS.osprey
    const src = (ent && ent.tileC) ? ent.tileC : (ASSETS && ASSETS.osprey ? ASSETS.osprey : null);
    if (!src){ // fallback to simple gibs if no sprite available
      callSpawnGibs(x, y, '#b0c7cf', 18, 'osprey-fallback');
      return;
    }
    const w = src.width, h = src.height;
    // define a few logical pieces relative to sprite center
    const cx = Math.round(w/2), cy = Math.round(h/2);
    const pieces = [
      { sx: cx-10, sy: cy-6, sw: 20, sh: 14, life: 2.4, gravity: 180 }, // fuselage
      { sx: cx-28, sy: cy-4, sw: 18, sh: 8, life: 1.8, gravity: 120 }, // left wing
      { sx: cx+10, sy: cy-4, sw: 18, sh: 8, life: 1.8, gravity: 120 }, // right wing
      { sx: cx-8, sy: cy+8, sw: 16, sh: 10, life: 1.6, gravity: 140 }, // tail
      { sx: cx-14, sy: cy-26, sw: 28, sh: 10, life: 1.0, gravity: 60 }  // rotor/blur
    ];

    // push each piece (one or more fragments) into the shared gibs array so it is animated/drawn
    for (const pDef of pieces){
      // create 2-4 fragments per logical piece for visual breakup
      const count = 2 + Math.floor(Math.random()*3);
      for (let k=0;k<count;k++){
        const ox = (Math.random()-0.5) * (pDef.sw * 0.6);
        const oy = (Math.random()-0.5) * (pDef.sh * 0.6);
        const speed = 80 + Math.random()*220;
        const ang = Math.random() * Math.PI * 2;
        const vx = Math.cos(ang) * speed * (0.6 + Math.random()*0.9);
        const vy = Math.sin(ang) * speed * (0.6 + Math.random()*0.9) - 20;
        const vr = (Math.random()-0.5) * 8; // angular velocity
        const frag = {
          src: src,
          sx: Math.max(0, Math.round(pDef.sx + (Math.random()-0.5)*4)),
          sy: Math.max(0, Math.round(pDef.sy + (Math.random()-0.5)*4)),
          sw: Math.max(2, Math.round(pDef.sw * (0.6 + Math.random()*0.8))),
          sh: Math.max(2, Math.round(pDef.sh * (0.6 + Math.random()*0.8))),
          x: x + ox,
          y: mod(y + oy, WORLD_H),
          vx: vx,
          vy: vy,
          vr: vr,
          rot: Math.random() * Math.PI * 2,
          life: pDef.life * (0.85 + Math.random()*0.5),
          gravity: pDef.gravity || 120,
          scale: 1 + (Math.random()-0.5) * 0.3
        };
        try{ moduleGibs.push(frag); }catch(_){ /* if moduleGibs missing, fallback */ callSpawnGibs(x, y, '#b0c7cf', 18, 'osprey-fallback'); }
      }
    }
    // shake camera for impact
    try{ triggerScreenShake(20, 0.26); }catch(_){ }
    // small smoke/particles if engine supports it
    try{ if (typeof spawnParticle === 'function'){ for (let i=0;i<8;i++){ const svx = (Math.random()-0.5)*60; const svy = (Math.random()-0.5)*80; spawnParticle(x + (Math.random()-0.5)*24, y + (Math.random()-0.5)*20, svx, svy, { life: 0.7 + Math.random()*0.9, size: 1 + Math.random()*3, color: 'rgba(80,90,100,0.9)' }); } } }catch(_){ }
  }catch(_){ try{ callSpawnGibs(x, y, '#b0c7cf', 18, 'osprey-fallback'); }catch(_){ } }
}
try{ window.spawnOspreyGibs = spawnOspreyGibs; }catch(err){ console.warn('expose spawnOspreyGibs failed', err); }

// small dust cloud particles emitted by the tank during speed boost
// ...existing code...

// --- Powerups (test double-shot) ---
const powerups = []; // {x,y,type,life,phase,hue,iconIdx}
function spawnPowerup(x,y,type='double'){ powerups.push({ x: mod(x, WORLD_W), y: mod(y, WORLD_H), type, life: 40.0, phase: Math.random()*Math.PI*2, hue: Math.floor(Math.random()*360), iconIdx: Math.floor(Math.random()*6) }); }
function updatePowerups(dt){ for (let i=powerups.length-1;i>=0;i--){ const p = powerups[i]; p.phase += dt * 3.0; p.life -= dt; if (p.life <= 0) powerups.splice(i,1); } }

// powerup pixel painter (ported from neon_pixel_pills_grid.html)
const POWERUP_TILE_PX = 64;
const _powerupCanvas = document.createElement('canvas'); _powerupCanvas.width = POWERUP_TILE_PX; _powerupCanvas.height = POWERUP_TILE_PX; const _pctx = _powerupCanvas.getContext('2d'); _pctx.imageSmoothingEnabled = false;
function _p_px(g,x,y,c){ g.fillStyle = c; g.fillRect(x, y, 1, 1); }
function _p_hsv(h,s,v,a=1){ let f=(n,k=(n+h/60)%6)=>v-v*s*Math.max(Math.min(k,4-k,1),0); let [r,g,b]=[f(5),f(3),f(1)]; return `rgba(${(r*255)|0},${(g*255)|0},${(b*255)|0},${a})`; }

function _p_iconTentacles(cx,cy,h,t){ for(let k=0;k<8;k++){ let ang=(t/10+k*45)*Math.PI/180; let len=5+Math.floor(2*Math.sin(t/200+k)); for(let l=1;l<len;l++){ let x=Math.round(Math.cos(ang)*l); let y=Math.round(Math.sin(ang)*l); _p_px(_pctx,cx+x,cy+y,_p_hsv((h+120+l*10+t/5)%360,1,1)); } } }
function _p_iconEyes(cx,cy,h,t){ let blink=(Math.floor(t/300)%6===0); for(let dx=-6;dx<=6;dx+=6){ _p_px(_pctx,cx+dx,cy,blink?'black':'white'); if(!blink) _p_px(_pctx,cx+dx,cy+1,_p_hsv(h,1,1)); } _p_px(_pctx,cx,cy-2,'black'); }
function _p_iconSigil(cx,cy,h,t){ for(let i=-5;i<=5;i+=2){ let col=_p_hsv((h+t/10+i*10)%360,1,1); _p_px(_pctx,cx+i,cy+i,col); _p_px(_pctx,cx-i,cy+i,col); } }
function _p_iconWorm(cx,cy,h,t){ for(let s=-8;s<=8;s++){ let y=Math.round(Math.sin((s+t/30))*4); _p_px(_pctx,cx+s,cy+y,_p_hsv((h+s*10+t/3)%360,1,1)); } }
function _p_iconCore(cx,cy,h,t){ for(let a=0;a<12;a++){ let ang=(a*30+t/15)*Math.PI/180; let r=5+(Math.sin(t/100+a)*3); let x=Math.round(Math.cos(ang)*r); let y=Math.round(Math.sin(ang)*r); _p_px(_pctx,cx+x,cy+y,_p_hsv((h+a*20+t/10)%360,1,1)); } }
function _p_iconMaw(cx,cy,h,t){ let open=2+Math.floor(2*Math.sin(t/150)); for(let i=-6;i<=6;i+=2){ _p_px(_pctx,cx+i,cy-open,'black'); _p_px(_pctx,cx+i,cy+open,'black'); } for(let i=-5;i<=5;i+=5){ _p_px(_pctx,cx+i,cy,_p_hsv(h,1,1)); } }
function _p_iconHeal(cx,cy,h,t){
  // simple green cross / medkit style pixel icon
  const col = _p_hsv((h||120) % 360, 0.85, 0.85);
  for (let dx=-2; dx<=2; dx++){ _p_px(_pctx, cx+dx, cy, col); }
  for (let dy=-2; dy<=2; dy++){ _p_px(_pctx, cx, cy+dy, col); }
  // center highlight
  _p_px(_pctx, cx, cy, 'white');
}

// Heart icon painter adapted from hearts.html (low-res animated heart)
function _p_iconHeart(cx,cy,h,t){
  // classic heart palette (kept compact)
  const palette = { outline:'#3b0d12', dark:'#8b0f1a', mid:'#b51625', light:'#ff4a56', rim:'#ffe4e8', glow:'#ff2a3a' };
  const beat = 0.5 + 0.5 * Math.sin((t || 0) / 150);
  const base = 9.5;
  const s = base * (1 + 0.14 * beat);
  // helper path
  function heartPath(ctx, cxp, cyp, sp){ ctx.moveTo(cxp, cyp + sp * 0.95); ctx.bezierCurveTo(cxp + sp, cyp + sp * 0.55, cxp + sp * 1.05, cyp - sp * 0.35, cxp, cyp - sp * 0.15); ctx.bezierCurveTo(cxp - sp * 1.05, cyp - sp * 0.35, cxp - sp, cyp + sp * 0.55, cxp, cyp + sp * 0.95); }
  // draw into the shared powerup canvas context
  _pctx.save();
  _pctx.translate(0,0);
  // outer glow
  _pctx.globalAlpha = 0.35 * (0.4 + 0.6 * (beat > 0 ? beat : 0));
  _pctx.fillStyle = palette.glow;
  _pctx.beginPath(); heartPath(_pctx, cx, cy, s + 1.8); _pctx.closePath(); _pctx.fill();
  _pctx.globalAlpha = 1;
  // outline
  _pctx.lineJoin = 'round'; _pctx.lineCap = 'round'; _pctx.strokeStyle = palette.outline; _pctx.lineWidth = 3;
  _pctx.beginPath(); heartPath(_pctx, cx, cy, s); _pctx.closePath(); _pctx.stroke();
  // fill with simple vertical gradient (approximate posterized)
  const g = _pctx.createLinearGradient(0, cy - s, 0, cy + s);
  g.addColorStop(0.00, palette.light); g.addColorStop(0.55, palette.mid); g.addColorStop(1.00, palette.dark);
  _pctx.fillStyle = g; _pctx.beginPath(); heartPath(_pctx, cx, cy, s - 0.9); _pctx.closePath(); _pctx.fill();
  // rim light
  _pctx.save(); _pctx.beginPath(); heartPath(_pctx, cx, cy, s - 0.9); _pctx.closePath(); _pctx.clip();
  _pctx.globalCompositeOperation = 'lighter'; _pctx.globalAlpha = 0.9;
  const rg = _pctx.createRadialGradient(cx - s*0.7, cy - s*0.75, 0, cx - s*0.7, cy - s*0.75, s*1.0);
  rg.addColorStop(0.00, palette.rim); rg.addColorStop(0.25, 'rgba(255,255,255,0.55)'); rg.addColorStop(0.60, 'rgba(255,255,255,0.0)');
  _pctx.fillStyle = rg; _pctx.fillRect(cx - s, cy - s, s*2, s*2);
  _pctx.restore();
  // tiny specular pixel glints
  _pctx.fillStyle = palette.rim; _pctx.fillRect(Math.round(cx - s*0.25), Math.round(cy - s*0.50), 1, 1); _pctx.fillRect(Math.round(cx - s*0.10), Math.round(cy - s*0.35), 1, 1);
  _pctx.restore();
}

const _p_icons = [_p_iconMaw, _p_iconTentacles, _p_iconEyes, _p_iconSigil, _p_iconWorm, _p_iconCore, _p_iconHeart];

// spawn a heal powerup with consistent visual (green + heal icon)
function spawnHealPowerup(x,y){ spawnPowerup(x,y,'heal'); try{ const p = powerups[powerups.length-1]; if (p){ p.hue = 140; p.iconIdx = _p_icons.length - 1; p.heartVariant = 'classic'; } }catch(_){ } }
// Generic helper to spawn a specific heart variant powerup and associate it with a journal key
function spawnHeartPowerup(x,y, variant, key){ try{ spawnPowerup(x,y,'journal'); const p = powerups[powerups.length-1]; if (!p) return; p.hue = (variant==='medic')? 10 : (variant==='vital'? 120 : 280); p.heartVariant = variant; // used to draw
  // attach a journalKey so pickup logic can call recordKill with specific key
  // default to a collect key if none provided
  p.journalKey = key || ('collect-saw');
  // slightly larger pickup radius for hearts/collects
  p.pickRadius = 32;
}catch(_){ } }

// spawn a journal powerup that uses a different heart variant and adds a
// journal entry (collect key or set 1 fallback) when picked up. Uses the 'mend' (purple) variant.
function spawnJournalPowerup(x,y, key){ spawnPowerup(x,y,'journal'); try{ const p = powerups[powerups.length-1]; if (p){ p.hue = 280; p.iconIdx = _p_icons.length - 1; p.heartVariant = 'mend'; p.journalKey = key || 'collect-saw'; } }catch(_){ } }

  // helper: 20% chance to drop a heal powerup at billboard location
function spawnBillboardDrop(bb){ try{ if (!bb) return; const r = Math.random(); if (r < 0.2) spawnHealPowerup(bb.x, bb.y); else if (r < 0.3) spawnJournalPowerup(bb.x, bb.y, 'collect-saw'); }catch(_){ } }

function _p_drawSplitPill(cx,cy,hue,t,iconFn){
  // clear
  _pctx.clearRect(0,0,POWERUP_TILE_PX,POWERUP_TILE_PX);
  const pulse = 0.5 + 0.5 * Math.sin(t/150);
  // core ellipse
  for (let x = -16; x <= 16; x++){
    for (let y = -10; y <= 10; y++){
      let inEllipse = (x*x)/(16*16) + (y*y)/(10*10) <= 1;
      if (inEllipse){
        let color = (x < 0) ? _p_hsv(0,0,1 - pulse*0.3) : _p_hsv((hue + t/20) % 360, 0.9, 0.8 + 0.2 * pulse);
        _p_px(_pctx, cx + x, cy + y, color);
      }
    }
  }
  // rim glow (dense)
  for (let ang = 0; ang < 360; ang += 2){
    const rx = Math.round(Math.cos(ang * Math.PI/180) * 16);
    const ry = Math.round(Math.sin(ang * Math.PI/180) * 10);
    const glow = _p_hsv((hue + ang + t/10) % 360, 1, 1, 0.7);
    _p_px(_pctx, cx + rx, cy + ry, glow);
    if (pulse > 0.7){ _p_px(_pctx, cx + ((rx * 1.1) | 0), cy + ((ry * 1.1) | 0), _p_hsv((hue + ang) % 360, 1, 1, 0.3)); }
  }
  // aura outside
  for (let r = 17; r < 22; r++){
    for (let ang = 0; ang < 360; ang += 15){
      const rx = Math.round(Math.cos(ang * Math.PI/180) * r);
      const ry = Math.round(Math.sin(ang * Math.PI/180) * r * 0.6);
      _p_px(_pctx, cx + rx, cy + ry, _p_hsv((hue + t/5) % 360, 1, 1, 0.05 + 0.1 * pulse));
    }
  }
  // overlay details (icon) — call safely
  try{ if (typeof iconFn === 'function') iconFn(cx, cy, hue, t); } catch (_){ /* ignore icon paint errors */ }
}

function drawPowerups(){ const nowt = performance.now(); for (const p of powerups){ const ss = worldToScreen(p.x, p.y); const sx = ss.x, sy = ss.y; // draw animated pixel pill into cached canvas
    // If this is a heal-like powerup (heal or journal), render the pixel-perfect heart
    if (p.type === 'heal' || p.type === 'journal'){
      // if this journal powerup represents one of the collect keys, draw the collect art
      if (p.journalKey && (p.journalKey.startsWith('collect-'))){
        drawCollectLowResIntoPowerup(_pctx, 32, 32, nowt + (p.phase*60), p.journalKey);
      } else {
        // draw heart into the shared powerup canvas at center 32,32
        drawHeartLowResIntoPowerup(_pctx, 32, 32, nowt + (p.phase*60), p.heartVariant || 'classic');
      }
    } else {
      _p_drawSplitPill(32,32,p.hue, nowt + (p.phase*60), _p_icons[p.iconIdx % _p_icons.length]);
    }
    // draw with bobbing and special heal effects
  const isHeal = (p.type === 'heal' || p.type === 'journal');
    // speed up phase for heal so it pulses more noticeably
    if (isHeal) p.phase += 0.02;
    const pulse = 0.5 + 0.5 * Math.sin((nowt + (p.phase*60)) / 120);
    const bob = Math.sin(p.phase*2 + (isHeal ? 0.7 : 0)) * (isHeal ? 4 : 2) * camera.zoom;
    const scale = camera.zoom * (isHeal ? (0.95 + 0.25 * pulse) : 0.6);

    if (isHeal){
  // larger halo behind the heart
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
  // choose halo tint subtly based on variant: heal greenish, journal purple-ish by hue
  const haloTint = (p.type === 'heal') ? ['rgba(90,220,140,0.9)','rgba(90,220,140,0.25)'] : ['rgba(190,120,255,0.9)','rgba(190,120,255,0.25)'];
  ctx.globalAlpha = 0.45 * (0.6 + 0.4 * pulse);
  const haloR = 26 * camera.zoom * (0.9 + 0.25 * pulse);
  const grd = ctx.createRadialGradient(sx, sy + bob - 2, haloR*0.2, sx, sy + bob - 2, haloR);
  grd.addColorStop(0, haloTint[0]);
  grd.addColorStop(0.5, haloTint[1]);
  grd.addColorStop(1, 'rgba(0,0,0,0.0)');
      ctx.fillStyle = grd;
      ctx.beginPath(); ctx.arc(sx, sy + bob - 2, haloR, 0, Math.PI*2); ctx.fill();
      ctx.restore();

      // sparkle particles (cheap pixel dots)
      const sparkleCount = 6;
      for (let si=0; si<sparkleCount; si++){
        const ang = (si / sparkleCount) * Math.PI * 2 + (nowt/500) + p.phase;
        const r = 18 * camera.zoom * (0.9 + 0.15 * Math.sin(nowt/300 + si));
        const px = Math.round(sx + Math.cos(ang) * r);
        const py = Math.round(sy + Math.sin(ang) * r * 0.6 + bob*0.3);
        ctx.globalAlpha = 0.9 * (0.4 + 0.6 * Math.abs(Math.sin(nowt/200 + si)));
        // color sparkles slightly based on powerup type
        ctx.fillStyle = (p.type === 'heal') ? '#e6fff0' : '#f8ecff'; ctx.fillRect(px, py, Math.max(1, Math.round(1 * camera.zoom)), Math.max(1, Math.round(1 * camera.zoom)));
      }
      ctx.globalAlpha = 1;
    }

    drawImageCentered(_powerupCanvas, sx, sy + bob, 0, scale);
  } }


// --- Drawing helpers ---
// clamp is used in several places; prefer module implementation when present
function clamp(v,a,b){ return (window.__game_modules && window.__game_modules.utils ? window.__game_modules.utils.clamp(v,a,b) : Math.max(a,Math.min(b,v))); }
// wrap-aware vertical delta and distance for the toroidal vertical world
function wrapDeltaY(ay, by){ let dy = ay - by; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; return dy; }
function wrapDeltaX(ax, bx){ let dx = ax - bx; if (dx > WORLD_W/2) dx -= WORLD_W; if (dx < -WORLD_W/2) dx += WORLD_W; return dx; }
function wrapDist(ax,ay,bx,by){ const dy = wrapDeltaY(ay, by); const dx = ax - bx; return Math.hypot(dx, dy); }
// generic sprite drawer (works for different sprite sizes)
  function drawImageCentered(spriteCanvas, x, y, angleRad, scale){
    if (window.__game_modules && window.__game_modules.draw){
      return window.__game_modules.draw.drawImageCentered(ctx, spriteCanvas, x, y, angleRad, scale);
    }
    const w = spriteCanvas.width, h = spriteCanvas.height;
    ctx.save();
    // Force drawing state so previous operations can't hide sprites
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.translate(x,y);
    ctx.rotate(angleRad);
    ctx.scale(scale,scale);
    ctx.translate(-w/2, -h/2);
    ctx.drawImage(spriteCanvas,0,0);
    ctx.restore();
  }
// draw centered sprite, optionally flipped horizontally (keeps sprite upright, used for critters/enemies)
  function drawImageCenteredFlipped(spriteCanvas, x, y, flipH=false, scale=1){
    if (window.__game_modules && window.__game_modules.draw){
      return window.__game_modules.draw.drawImageCenteredFlipped(ctx, spriteCanvas, x, y, flipH, scale);
    }
    const w = spriteCanvas.width, h = spriteCanvas.height;
    ctx.save();
    // Force drawing state so previous operations can't hide sprites
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.translate(x,y);
    if (flipH) ctx.scale(-1,1);
    ctx.scale(scale,scale);
    ctx.translate(-w/2, -h/2);
    ctx.drawImage(spriteCanvas,0,0);
    ctx.restore();
  }
  function drawShadow(x,y, spriteW = SPR_W, spriteScale = SPRITE_SCALE){
    if (window.__game_modules && window.__game_modules.draw){ return window.__game_modules.draw.drawShadow(ctx, x, y, spriteW, spriteScale); }
    // compute base radius but clamp so very large zoom values don't create a dominating blob
    const baseR = (spriteW * spriteScale * 0.45) || 8;
    const CLAMP_MAX = 56; // pixels - cap shadow size
    const r = Math.max(6, Math.min(baseR, CLAMP_MAX));
    // tone down vertical scale so shadow remains subtle
    const sx = 1.2, sy = 0.5;
    ctx.save(); ctx.translate(x, y + Math.max(4, Math.round(r*0.12))); ctx.scale(sx, sy); ctx.beginPath(); ctx.arc(0,0, r, 0, Math.PI*2); ctx.fillStyle = COLORS.shadow; ctx.fill(); ctx.restore();
  }

// --- Helicopter sprites & state (from pixel_helicopter.html, adapted) ---
const H_SPR_W = 24, H_SPR_H = 24; const H_SCALE = 2;
const heliBody = document.createElement('canvas'); heliBody.width = H_SPR_W; heliBody.height = H_SPR_H; const hbctx = heliBody.getContext('2d');
const heliRotor = document.createElement('canvas'); heliRotor.width = H_SPR_W; heliRotor.height = H_SPR_H; const hrctx = heliRotor.getContext('2d');
const heliTail = document.createElement('canvas'); heliTail.width = 10; heliTail.height = 10; const htctx = heliTail.getContext('2d');
const heliGun = document.createElement('canvas'); heliGun.width = 8; heliGun.height = 8; const hgctx = heliGun.getContext('2d');

// small helper for heli pixel draw
function pxCtx(g,x,y,w=1,h=1,color='#fff'){ g.fillStyle = color; g.fillRect(x,y,w,h); }

function rebuildHeliSprites(){
  // palette for heli (teal-ish)
  function randHeliPalette(){ const h = 130 + Math.floor(Math.random()*80) - 40; const s = 40 + Math.floor(Math.random()*25); const base = 30 + Math.floor(Math.random()*10); return { hull:`hsl(${h} ${s}% ${base+8}%)`, hullDark:`hsl(${h} ${s}% ${base-4}%)`, hullLight:`hsl(${h} ${s+8}% ${base+16}%)`, canopy:`hsl(${(h+200)%360} ${s+10}% ${base+22}%)`, metal:`hsl(${h} ${Math.max(20,s-15)}% ${base-10}%)` }; }
  const HP = randHeliPalette();
  // body
  hbctx.clearRect(0,0,H_SPR_W,H_SPR_H);
  // skids
  for (let x=4;x<=19;x++) pxCtx(hbctx,x,18,1,1,'#141414');
  for (let x=5;x<=20;x++) pxCtx(hbctx,x,20,1,1,'#141414');
  for (let y=8;y<=17;y++) for (let x=6;x<=17;x++) pxCtx(hbctx,x,y,1,1,HP.hull);
  for (let y=8;y<=13;y++) for (let x=6;x<=10;x++) pxCtx(hbctx,x,y,1,1,HP.hullDark);
  for (let y=8;y<=11;y++) for (let x=12;x<=17;x++) pxCtx(hbctx,x,y,1,1,HP.hullLight);
  for (let y=4;y<=9;y++) for (let x=9;x<=14;x++) pxCtx(hbctx,x,y,1,1,HP.canopy);
  pxCtx(hbctx,10,5,1,1,'#fff'); pxCtx(hbctx,11,5,1,1,'#e0f2ff');
  for (let y=2;y<=9;y++) for (let x=11;x<=12;x++) pxCtx(hbctx,x,y,1,1,HP.hull);
  for (let y=1;y<=2;y++) for (let x=10;x<=13;x++) pxCtx(hbctx,x,y,1,1,HP.hullDark);
  for (let y=2;y<=3;y++) for (let x=15;x<=17;x++) pxCtx(hbctx,x,y,1,1,HP.metal);
  for (let y=12;y<=15;y++) for (let x=8;x<=15;x++) pxCtx(hbctx,x,y,1,1,HP.hullLight);
  for (let y=10;y<=11;y++) for (let x=11;x<=12;x++) pxCtx(hbctx,x,y,1,1,HP.metal);
  pxCtx(hbctx,7,9,1,1,'#000'); pxCtx(hbctx,16,9,1,1,'#000'); pxCtx(hbctx,7,16,1,1,'#000'); pxCtx(hbctx,16,16,1,1,'#000');

  // main rotor
  hrctx.clearRect(0,0,H_SPR_W,H_SPR_H);
  hrctx.save(); hrctx.translate(H_SPR_W/2,H_SPR_H/2);
  const bladeLen = 11, bladeThick = 2;
  for (let i=0;i<3;i++){ hrctx.save(); hrctx.rotate((i*Math.PI*2)/3); hrctx.fillStyle='#1a1a1a'; hrctx.fillRect(-bladeThick/2,-bladeLen,bladeThick,bladeLen); hrctx.fillStyle='rgba(230,230,235,0.08)'; hrctx.fillRect(-bladeThick*2,-bladeLen,bladeThick*4,1); hrctx.restore(); }
  hrctx.fillStyle = HP.metal; hrctx.fillRect(-2,-2,4,4); hrctx.restore();

  // tail rotor
  htctx.clearRect(0,0,htctx.canvas.width, htctx.canvas.height);
  htctx.save(); htctx.translate(htctx.canvas.width/2, htctx.canvas.height/2);
  htctx.fillStyle = '#1a1a1a'; htctx.fillRect(-1,-4,2,8); htctx.fillRect(-4,-1,8,2);
  htctx.fillStyle = HP.metal; htctx.fillRect(-1,-1,2,2); htctx.restore();

  // chin gun
  hgctx.clearRect(0,0,8,8);
  for (let y=3;y<=5;y++) for (let x=2;x<=5;x++) pxCtx(hgctx,x,y,1,1,HP.metal);
  for (let y=0;y<=2;y++) pxCtx(hgctx,3,y,2,1,'#0c0c0c'); pxCtx(hgctx,4,0,1,1,'#666');
}

// Pixel-perfect heart renderer adapted from hearts.html. Draws into the provided
// 2D context at given center coordinates (low-res style used by _powerupCanvas).
function drawHeartLowResIntoPowerup(ctx, cx, cy, t, variant = 'classic'){
  // palettes from hearts.html: outline, dark, mid, light, rim, glow
  const palettes = {
    classic: { outline:'#3b0d12', dark:'#8b0f1a', mid:'#b51625', light:'#ff4a56', rim:'#ffe4e8', glow:'#ff2a3a' },
    medic:   { outline:'#3b0d12', dark:'#8b101d', mid:'#b81e2a', light:'#ff5c68', rim:'#fff2f4', glow:'#ff2a3a' },
    vital:   { outline:'#0f2e1a', dark:'#0c6a32', mid:'#1aa24c', light:'#6cf09b', rim:'#e3ffe5', glow:'#46ff88' },
    mend:    { outline:'#2a123d', dark:'#5a2796', mid:'#8b3fd8', light:'#d7a8ff', rim:'#f4e9ff', glow:'#b06bff' }
  };
  const palette = palettes[variant] || palettes.classic;
  const beat = 0.5 + 0.5 * Math.sin(t / 150);
  const base = 9.5;
  const s = base * (1 + 0.14 * beat);
  const W = ctx.canvas.width, H = ctx.canvas.height;
  // clear
  ctx.clearRect(0,0,W,H);
  ctx.save();
  ctx.translate(W/2, H/2 + 0.5);
  function heartPathFn(c, cxp, cyp, sp){ c.moveTo(cxp, cyp + sp * 0.95); c.bezierCurveTo(cxp + sp, cyp + sp * 0.55, cxp + sp * 1.05, cyp - sp * 0.35, cxp, cyp - sp * 0.15); c.bezierCurveTo(cxp - sp * 1.05, cyp - sp * 0.35, cxp - sp, cyp + sp * 0.55, cxp, cyp + sp * 0.95); }
  // outer glow
  ctx.globalAlpha = 0.35 * (0.4 + 0.6 * (beat > 0 ? beat : 0));
  ctx.fillStyle = palette.glow;
  ctx.beginPath(); heartPathFn(ctx, 0, 0, s + 1.8); ctx.closePath(); ctx.fill();
  ctx.globalAlpha = 1;
  // outline
  ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = palette.outline; ctx.lineWidth = 3;
  ctx.beginPath(); heartPathFn(ctx, 0, 0, s); ctx.closePath(); ctx.stroke();
  // fill gradient (posterized-ish)
  const g = ctx.createLinearGradient(0, -s, 0, s);
  g.addColorStop(0.00, palette.light); g.addColorStop(0.55, palette.mid); g.addColorStop(1.00, palette.dark);
  ctx.fillStyle = g; ctx.beginPath(); heartPathFn(ctx, 0, 0, s - 0.9); ctx.closePath(); ctx.fill();
  // rim light
  ctx.save(); ctx.beginPath(); heartPathFn(ctx, 0, 0, s - 0.9); ctx.closePath(); ctx.clip();
  ctx.globalCompositeOperation = 'lighter'; ctx.globalAlpha = 0.9;
  const rg = ctx.createRadialGradient(-s*0.7, -s*0.75, 0, -s*0.7, -s*0.75, s*1.0);
  rg.addColorStop(0.00, palette.rim); rg.addColorStop(0.25, "rgba(255,255,255,0.55)"); rg.addColorStop(0.60, "rgba(255,255,255,0.0)");
  ctx.fillStyle = rg; ctx.fillRect(-s, -s, s*2, s*2);
  ctx.restore();
  // tiny specular glints
  ctx.fillStyle = palette.rim; ctx.fillRect(Math.round(-s*0.25), Math.round(-s*0.50), 1, 1); ctx.fillRect(Math.round(-s*0.10), Math.round(-s*0.35), 1, 1);
  ctx.restore();
}
// Draw collect-style icons (adapted from Collects.html variants) into powerup canvas
function drawCollectLowResIntoPowerup(ctx, cx, cy, t, key){
  // center-based 48x48 style
  const W = ctx.canvas.width, H = ctx.canvas.height; ctx.clearRect(0,0,W,H);
  const TWO = Math.PI*2; const time = (t||0)/1200;
  try{
    if (key === 'collect-saw'){
      // Saw Halo: glowing rotating saw
      const palette = ['#2b0707','#601010','#b31a1a','#ff3f3f','#ffe6e6','#ff8080'];
      const ang = (time * TWO * 1.2) % TWO;
      ctx.save(); ctx.translate(W/2, H/2);
      // halo
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff8080'; ctx.beginPath(); ctx.ellipse(0,0,18,12,0,0,TWO); ctx.fill(); ctx.globalAlpha = 1;
      // disc
      ctx.fillStyle = '#601010'; ctx.beginPath(); ctx.arc(0,0,12,0,TWO); ctx.fill(); ctx.fillStyle = '#b31a1a'; ctx.beginPath(); ctx.arc(0,0,8,0,TWO); ctx.fill(); ctx.fillStyle = '#ff3f3f'; ctx.beginPath(); ctx.arc(0,0,4,0,TWO); ctx.fill();
      // teeth
      for (let i=0;i<10;i++){ const a = ang + (i/10)*TWO; ctx.save(); ctx.rotate(a); ctx.fillStyle = '#ffe6e6'; ctx.fillRect(10,-1,5,2); ctx.restore(); }
      ctx.restore();
    } else if (key === 'collect-peanut'){
      // Plasma Peanut / Jelly: blobby diamond glow
      const pal = ['#071a09','#103a15','#2a8f3c','#55d96e','#e7ffe7','#95ffae'];
      ctx.save(); ctx.translate(W/2, H/2);
      const wob = 1 + 0.12 * Math.sin(time * TWO * 2.0);
      ctx.scale(wob, 1/wob);
      ctx.globalAlpha = 0.16; ctx.fillStyle = pal[5]; ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(12,0); ctx.lineTo(0,16); ctx.lineTo(-12,0); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(10,0); ctx.lineTo(0,14); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal[3]; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(6,0); ctx.lineTo(0,8); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (key === 'collect-crescent'){
      // Boomer Crescent: crescent shape with rim
      const pal = ['#07071f','#16164a','#3a38a1','#7a7bf0','#e6e7ff','#9ea2ff'];
      ctx.save(); ctx.translate(W/2, H/2);
      const baseAng = Math.sin(time*TWO)*0.3;
      ctx.rotate(baseAng);
      ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.arc(0,0,14, -Math.PI/2, Math.PI/2, false); ctx.arc(0,0,9, Math.PI/2, -Math.PI/2, true); ctx.closePath(); ctx.fill();
      // rim highlight
      ctx.save(); ctx.translate(-2,-2); ctx.fillStyle = pal[4]; ctx.beginPath(); ctx.arc(0,0,10, -Math.PI/2, Math.PI/2, false); ctx.arc(0,0,6, Math.PI/2, -Math.PI/2, true); ctx.closePath(); ctx.fill(); ctx.restore();
      // small trails
      ctx.globalAlpha = 0.22; for (let k=1;k<=2;k++){ ctx.rotate(-0.12*k); ctx.beginPath(); ctx.strokeStyle = pal[5]; ctx.lineWidth=1; ctx.arc(0,0,14-k*2, -Math.PI/3, Math.PI/3); ctx.stroke(); } ctx.globalAlpha=1;
      ctx.restore();
    } else {
      // fallback: simple pill
      ctx.fillStyle = '#444'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#ddd'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(key || 'COL', W/2, H/2);
    }
  }catch(_){ }
}
// expose the collect drawing helper to other modules (journal) so combos can animate
try{ if (typeof window !== 'undefined') window.drawCollectLowResIntoPowerup = drawCollectLowResIntoPowerup; }catch(_){ }
rebuildHeliSprites();

// heli runtime state (instantiate but used only if selected)
const heli = { x: WORLD_W/2, y: WORLD_H/2, bodyAngle: -Math.PI/2, turretAngle: 0, speed: 115, rotSpeed: Math.PI*1.2, rotorSpin:0, tailSpin:0, rpm:22, tailRpm:44 };

// HUD elements (must be available before UI actions)
const hud = document.getElementById('hud');
const center = document.getElementById('center');

// selection
let selectedVehicle = null; // 'tank' or 'heli'
let selectedVehicleVariant = 'default'; // 'default' or 'fordfiesta'
// Murkia (AMERICA) should be visually larger only when selected
// Increase this multiplier to make the playable Murkia noticeably bigger than other tanks
const BLACKSTAR_SCALE = 2.0; // reuse name for multiplier (history)
function effectiveTankScale(){ try{ return SPRITE_SCALE * ((selectedVehicleVariant === 'murkia') ? BLACKSTAR_SCALE : 1); }catch(_){ return SPRITE_SCALE; } }
// start with tank selected and hide center UI
selectedVehicle = 'tank';
center.style.display = 'none';
// Vehicle menu state: first slot is the default tank (unlocked), others may be locked/placeholders
// Slot mapping: 0=default, 1=Fiesta, 2=Murkia, 3=Dozer
const VEHICLE_SLOTS = ['tank', 'fordfiesta', 'murkia', 'dozer'];
const VEHICLE_UNLOCKED = [true, true, true, true];
// NOTE: Fiesta remains locked until the player claims/unlocks it via the Journal.
// Use the debug helper `window.debugUnlockFiesta()` from the console to unlock for testing.
// Helper to select a vehicle by slot index (only if unlocked)
function selectVehicleSlot(idx){
  try{
    if (!VEHICLE_UNLOCKED[idx]) return;
    const v = VEHICLE_SLOTS[idx];
    if (v === 'tank'){
      // default tank selected -> restore default assets
      try{
        selectedVehicle = 'tank'; selectedVehicleVariant = 'default';
        try{ configureTankAssets({}); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
      }catch(_){ selectedVehicle = 'tank'; }
    } else if (v === 'heli'){
      selectedVehicle = 'heli';
    } else if (v === 'fordfiesta'){
    // switch to Fiesta: create small SPR-sized canvases and configure tank assets to use them
    try{
      // create body canvas sized to SPR_W x SPR_H
      if (typeof window !== 'undefined'){
        if (!window.__fiesta_body) {
          const fb = document.createElement('canvas'); fb.width = SPR_W; fb.height = SPR_H; const fbg = fb.getContext('2d'); try{ fbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ drawFordFiestaInto(fbg, SPR_W, SPR_H, performance.now()); }catch(_){ }
          window.__fiesta_body = fb;
        }
        if (!window.__fiesta_turret){
          const ft = document.createElement('canvas'); ft.width = SPR_W; ft.height = SPR_H; const ftg = ft.getContext('2d'); try{ ftg.imageSmoothingEnabled = false; }catch(_){ }
          // draw a little gray turret matching tank.js style
          try{
            // draw an 'X' turret to match tank.js pixel turret
            ftg.clearRect(0,0,SPR_W,SPR_H);
            const cx = Math.floor(SPR_W/2), cy = Math.floor(SPR_H/2);
            ftg.fillStyle = '#9aa8b2';
            const offs = [-3,-2,-1,0,1,2,3];
            for (const o of offs){
              const x1 = cx + o, y1 = cy + o;
              const x2 = cx + o, y2 = cy - o;
              if (x1 >= 0 && x1 < SPR_W && y1 >= 0 && y1 < SPR_H) ftg.fillRect(x1, y1, 1, 1);
              if (x2 >= 0 && x2 < SPR_W && y2 >= 0 && y2 < SPR_H) ftg.fillRect(x2, y2, 1, 1);
            }
            ftg.fillStyle = '#dfe8ea'; ftg.fillRect(cx, cy, 1, 1);
          }catch(_){ }
          window.__fiesta_turret = ft;
        }
        // apply assets to tank module
        try{ configureTankAssets({ bodyCanvas: window.__fiesta_body, turretCanvas: window.__fiesta_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
      }
    }catch(_){ }
      selectedVehicle = 'tank'; selectedVehicleVariant = 'fordfiesta';
    }
    else if (v === 'murkia'){
    // switch to Murkia (AMERICA tank): create small SPR-sized canvases and configure tank assets to use them
    try{
      if (typeof window !== 'undefined'){
        if (!window.__murkia_body){
          // Render full 64x64 Murkia canvases for body and turret so runtime uses pixel-perfect assets
          const off = document.createElement('canvas'); off.width = 64; off.height = 64; const og = off.getContext('2d'); try{ og.imageSmoothingEnabled = false; }catch(_){ }
          try{ drawMurkiaBodyInto(og, 64, 64, performance.now()); }catch(_){ }
          window.__murkia_body = off;
        }
        if (!window.__murkia_turret){
          const off2 = document.createElement('canvas'); off2.width = 64; off2.height = 64; const og2 = off2.getContext('2d'); try{ og2.imageSmoothingEnabled = false; }catch(_){ }
          try{ drawMurkiaTurretInto(og2, 64, 64, performance.now()); }catch(_){ }
          window.__murkia_turret = off2;
        }
        try{ configureTankAssets({ SPR_W:64, SPR_H:64, bodyCanvas: window.__murkia_body, turretCanvas: window.__murkia_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
      }
      }catch(_){ }
      selectedVehicle = 'tank'; selectedVehicleVariant = 'murkia';
    }
    // insert Dozer branch here so it's part of the same if/else chain
    else if (v === 'dozer'){
    try{
      if (typeof window !== 'undefined'){
        if (!window.__dozer_body){
          const off = document.createElement('canvas'); off.width = 64; off.height = 64; const og = off.getContext('2d'); try{ og.imageSmoothingEnabled = false; }catch(_){ }
          try{ drawDozerInto(og, 64, 64, performance.now()); }catch(_){ }
          window.__dozer_body = off;
        }
        if (!window.__dozer_turret){
          // dozer has no separate turret; use a transparent canvas so rotation calls are safe
          const off2 = document.createElement('canvas'); off2.width = 64; off2.height = 64; const og2 = off2.getContext('2d'); try{ og2.imageSmoothingEnabled = false; }catch(_){ }
          og2.clearRect(0,0,64,64);
          window.__dozer_turret = off2;
        }
        try{ configureTankAssets({ SPR_W:64, SPR_H:64, bodyCanvas: window.__dozer_body, turretCanvas: window.__dozer_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
      }
    }catch(_){ }
      selectedVehicle = 'tank'; selectedVehicleVariant = 'dozer';
    }

    try{ updateHud(); }catch(_){ }
  }catch(_){ }
}
// initJournal/initCombos moved down to after MAX_HEALTH/health are declared
function selectVehicle(v){ /* selection disabled at runtime */ }

// Install lightweight metal HUD styles once
function installHudStyles(){
  if (document.getElementById('tanknutz-hud-styles')) return;
  const css = `
  /* HUD bar stays compact at top-left to avoid covering on-screen hints */
  .tn-hud{ position:fixed; left:12px; top:12px; height:56px; display:flex; align-items:stretch; gap:12px; pointer-events:none; z-index:9999; }
  .tn-panel{ background:linear-gradient(180deg,#2b2b2b,#1e1e1e); border:2px solid #111; padding:8px 12px; display:flex; align-items:center; gap:8px; box-shadow:0 4px 10px rgba(0,0,0,0.6); border-radius:6px; pointer-events:auto; }
  .tn-center{ display:none; }
  .tn-left, .tn-right{ width:220px; display:flex; align-items:center; gap:8px; }
  /* separate title block placed bottom-right */
  .tn-title{ position:fixed; right:12px; bottom:12px; background:linear-gradient(180deg,#1d2024,#0f1113); padding:10px 12px; border-radius:6px; border:2px solid #0b0b0b; z-index:9999; display:flex; flex-direction:column; align-items:flex-end; box-shadow:0 6px 18px rgba(0,0,0,0.6); pointer-events:none; }
  .tn-logo{ font-family: monospace; font-weight:900; color:#e6e6e6; letter-spacing:3px; font-size:18px; text-shadow:0 1px 0 #000; }
  .tn-score{ background:#0f7; color:#052; padding:6px 10px; border-radius:4px; font-weight:900; box-shadow:inset 0 -2px 0 rgba(0,0,0,0.25); margin-top:6px; }
  .tn-bolts{ width:10px; height:10px; background:radial-gradient(circle at 30% 30%, #cfcfcf, #8a8a8a); border-radius:50%; box-shadow:inset 0 -1px 0 rgba(0,0,0,0.4); margin-right:6px; }
  .tn-shoot-dots{ display:flex; gap:6px; }
  .tn-dot{ width:10px; height:10px; border-radius:50%; background:#333; border:1px solid #000; }
  .tn-dot.active{ background:linear-gradient(180deg,#ffd36b,#ff9b2e); box-shadow:0 0 6px rgba(255,140,0,0.6); }
  .tn-powerup{ background:linear-gradient(180deg,#264a7a,#16304a); color:#dfefff; padding:6px 8px; border-radius:4px; font-weight:700; }
  .tn-health{ display:flex; gap:6px; align-items:center; }
  .tn-heart{ width:18px; height:14px; background:linear-gradient(180deg,#ff6b6b,#c12b2b); clip-path:polygon(50% 0, 61% 12%, 75% 12%, 88% 25%, 88% 40%, 75% 58%, 50% 78%, 25% 58%, 12% 40%, 12% 25%, 25% 12%, 39% 12%); box-shadow:0 1px 0 rgba(0,0,0,0.3); }
  .tn-controls{ display:flex; gap:8px; margin-left:8px; }
  .tn-btn{ background:#222; color:#fff; border:1px solid #000; padding:6px 8px; border-radius:4px; cursor:pointer; font-weight:700; font-size:12px; }
  .tn-btn.toggled{ background:#0a8440; color:#eaffea; }
  .tn-btn.key-toggle{ background:#2b2b2b; }
  /* prominent control panel (separate from HUD panels) placed on the left under the HUD */
  .tn-controls-panel{ position:fixed; left:12px; top:80px; display:flex; flex-direction:column; gap:8px; z-index:10000; pointer-events:auto; }
  .tn-big-btn{ padding:10px 14px; font-weight:900; border-radius:6px; background:#2b2b2b; color:#fff; border:2px solid #111; cursor:pointer; font-size:14px; min-width:110px; text-align:left; }
  .tn-controls-hint{ font-size:12px; color:#ddd; background:rgba(20,20,20,0.8); padding:6px 8px; border-radius:6px; border:1px solid rgba(255,255,255,0.04); }
  /* vehicle menu: fixed, centered vertically on the left side; 3 columns wide */
  .tn-vehicle-menu{ position:fixed; left:12px; top:50%; transform:translateY(-50%); display:grid; grid-template-columns: repeat(3, 64px); grid-auto-rows: 84px; gap:8px; justify-content:center; align-items:start; z-index:10000; pointer-events:auto; padding:8px; box-sizing:border-box; }
  .vehicle-slot{ width:64px; height:84px; background:linear-gradient(180deg,#222,#111); border:2px solid #000; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#d7d7db; font-weight:800; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,0.6); padding:6px; box-sizing:border-box; }
  .vehicle-slot canvas{ width:100%; height:auto; image-rendering: pixelated; display:block; border-radius:4px; }
  .vehicle-slot.locked{ background:linear-gradient(180deg,#111,#0b0b0b); color:rgba(255,255,255,0.35); cursor:default; }
  .vehicle-slot.selected{ outline:3px solid rgba(0,200,120,0.12); box-shadow:0 8px 26px rgba(0,200,120,0.06), inset 0 -2px 0 rgba(0,0,0,0.25); }
  .vehicle-slot .slot-label{ font-size:12px; color:#d7d7db; }
  .tn-controls-hint .tn-ctrl-line{ margin:2px 0; }
  /* controls modal */
  .tn-controls-modal{ position:fixed; left:0; top:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; z-index:20001; }
  .tn-controls-backdrop{ position:absolute; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.6); }
  .tn-controls-inner{ position:relative; z-index:20002; width:min(720px, 92%); max-height:86%; overflow:auto; background:linear-gradient(180deg,#16181a,#0b0c0d); padding:18px; border-radius:8px; border:2px solid #111; box-shadow:0 12px 40px rgba(0,0,0,0.6); color:#e6e6e6; }
  .tn-controls-title{ font-size:20px; font-weight:900; margin-bottom:8px; }
  .tn-control-row{ display:flex; gap:12px; align-items:center; padding:10px 6px; border-bottom:1px solid rgba(255,255,255,0.02); }
  .tn-control-icon{ width:56px; height:56px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.02); border-radius:8px; }
  .tn-control-label{ font-size:14px; color:#dfe; }
  .tn-controls-close{ margin-top:12px; padding:10px 14px; font-weight:800; border-radius:6px; cursor:pointer; background:#2b2b2b; color:#fff; border:2px solid #111; }
  .tn-big-btn.toggled{ background:#0a8440; color:#eaffea; }
  `;
  const s = document.createElement('style'); s.id = 'tanknutz-hud-styles'; s.innerHTML = css; document.head.appendChild(s);
  // ensure hud root class
  hud.classList.add('tn-hud');
}

// --- Game objects: bullets, casings & enemies ---
const bullets = []; // {x,y,dx,dy,life,color,glow}
const casings = []; // {x,y,vx,vy,life,spin,t0}
const enemies = []; // {x,y,spd,r}
// recent-deaths feature removed: make recordDeath a no-op so existing call sites remain safe
function recordDeath(kind, e) { /* removed recent-deaths logging */ }
// wire recordDeath to also update the journal module
// after journal.js is imported, we'll call recordKill inside recordDeath where deaths are recorded
// (recordDeath remains defined above and is used throughout the code)
const critters = []; // sprite-based wandering critters (decorative)
const animals = []; // additional small animals distributed like critters
let __nextCritterId = 1; // unique id per critter instance for individual journal entries
const CRITTER_COUNT = 84; // more critters for jungle life
configureTankAssets({ gibs: moduleGibs });

// debug: throttle enemy-draw logs so we can see if enemies are being processed
let __lastEnemyDrawLog = 0;
// debug: throttle critter-draw logs
let __lastCritterDrawLog = 0;
// debug: visual markers for critters/animals (toggle with G)
let showEntityMarkers = false;
let lastShot = 0; const SHOT_COOLDOWN = 500; const BULLET_SPEED = 360;
let lastSpawn = 0;
let score = 0; let health = 3; let gameOver = false;
let paused = false; // when true, main game updates pause but explosion pieces still animate
const MAX_HEALTH = 5;
// initialize journal and combos now that MAX_HEALTH and health exist
try {
  initJournal({ hud: hud, maxHealth: MAX_HEALTH, health: health });
} catch (err) { console.warn('initJournal failed', err); }
try {
  initCombos(100);
} catch (err) { console.warn('initCombos failed', err); }

// Debug helper: call `window.debugUnlockFiesta()` from the browser console to
// force-unlock the Ford Fiesta into HUD slot index 1 for testing. To enable
// automatically on load, set localStorage.setItem('tn_debug_unlock_fiesta','1')
// and reload.
try{
  if (typeof window !== 'undefined'){
    window.debugUnlockFiesta = function(){ try{ VEHICLE_SLOTS[1] = 'fordfiesta'; VEHICLE_UNLOCKED[1] = true; try{ updateHud(); }catch(_){ } }catch(_){ } };
    try{ if (localStorage && localStorage.getItem && localStorage.getItem('tn_debug_unlock_fiesta') === '1'){ window.debugUnlockFiesta(); } }catch(_){ }
  }
}catch(_){ }

// listen for combo unlocks to trigger progression (unlock next tank)
try {
  window.addEventListener('comboUnlocked', (ev) => {
    const d = ev && ev.detail;
    try { console.log('Combo unlocked', d); /* TODO: trigger unlock animation / progression */ } catch (e) { console.warn('comboUnlocked handler failed', e); }
  });
} catch (err) { console.warn('Failed to register comboUnlocked listener', err); }

// Listen for journal reset so we can re-lock vehicle slots and reset HUD without reload
try{
  window.addEventListener('journalReset', ()=>{
    try{
      // Lock known unlockable slots (Fiesta slot 1, Murkia slot 2)
      VEHICLE_SLOTS[1] = 'fordfiesta'; VEHICLE_UNLOCKED[1] = false;
      VEHICLE_SLOTS[2] = 'murkia'; VEHICLE_UNLOCKED[2] = false;
      // Reset selection to default tank
      selectedVehicle = 'tank'; selectedVehicleVariant = 'default';
      try{ configureTankAssets({}); }catch(_){ }
      try{ updateHud(); }catch(_){ }
    }catch(_){ }
  });
}catch(_){ }

// When an upgrade is claimed in the journal, spawn the unlocked tank near the player and unlock UI slot
try {
  window.addEventListener('upgradeClaimed', (ev) => {
    try {
      const d = ev && ev.detail;
      console.log('Upgrade claimed', d);
      const px = (tank && tank.x) ? tank.x : WORLD_W/2;
      const py = (tank && tank.y) ? tank.y : WORLD_H/2;
      try { spawnChainedTank(px + 120, py, {}); } catch (e) { console.warn('spawnChainedTank failed', e); }
      // Unlock UI vehicle slot for known sets. Let updateHud() create the preview
      try{
        if (d && typeof d.setIndex === 'number'){
          // Set 1 -> Ford Fiesta in slot index 1
          if (d.setIndex === 0){
            VEHICLE_SLOTS[1] = 'fordfiesta';
            VEHICLE_UNLOCKED[1] = true;
          }
          // Set 2 -> Murkia in slot index 2
          else if (d.setIndex === 1){
            VEHICLE_SLOTS[2] = 'murkia';
            VEHICLE_UNLOCKED[2] = true;
          }
            // Set 3 -> Dozer in slot index 3
            else if (d.setIndex === 2){
              VEHICLE_SLOTS[3] = 'dozer';
              VEHICLE_UNLOCKED[3] = true;
            }
          // Rebuild HUD so the new slot(s) are rendered in the canonical place
          try{ updateHud(); }catch(_){ }
        }
      }catch(_){ }
    } catch (e) { console.warn('upgradeClaimed handler failed', e); }
  });
} catch (err) { console.warn('Failed to register upgradeClaimed listener', err); }
// spawn tiny critters
function spawnCritters(){
  // Ensure critter sprite canvases are valid before spawning critters. Rebuild any invalid ones.
  for (let i = 0; i < critterSprites.length; i++){
    const s = critterSprites[i];
    if (!s || !s.width || !s.height){
      try{ critterSprites[i] = makeSpriteCanvas(critterSpecs[i], CRITTER_SPR_SCALE); if (DEBUG && console && console.log) console.log('spawnCritters: rebuilt missing critter sprite', i); }catch(e){ console.warn('spawnCritters: failed to rebuild sprite', i, e); }
    }
  }

  critters.length = 0;
  for (let i=0;i<CRITTER_COUNT;i++){
    const ang = Math.random()*Math.PI*2;
    const sidx = Math.floor(Math.random()*critterSprites.length);
    // create a per-instance tile canvas so the journal can display a unique image per critter
    let tileC = null;
    try{
      const spr = critterSprites[sidx];
      if (spr && spr.width && spr.height){
        tileC = document.createElement('canvas');
        tileC.width = spr.width; tileC.height = spr.height;
        const tctx = tileC.getContext('2d');
        tctx.drawImage(spr, 0, 0);
      }
    }catch(_){ tileC = null; }
    const uid = __nextCritterId++;
    critters.push({
      x: Math.random()*WORLD_W,
      y: Math.random()*WORLD_H,
      speed: 8 + Math.random()*22,
      angle: ang,
      targetAngle: ang,
      changeAt: performance.now() + 400 + Math.random()*1800,
      spriteIdx: sidx,
      kind: 'critter-' + uid,
      tileC: tileC,
      phase: Math.random()*Math.PI*2,
      bobAmp: 1 + Math.random()*3.0,
      alive: true
    });
  }
}
spawnCritters();

// spawn decorative animals distributed the same way as critters
function spawnAnimals(){
  animals.length = 0;
  const ANIMAL_COUNT = CRITTER_COUNT; // same distribution/count as critters
  for (let i=0;i<ANIMAL_COUNT;i++){
    const ang = Math.random()*Math.PI*2;
    let sidx = Math.floor(Math.random()*critterSprites.length);
    if (sidx < 0 || sidx >= critterSprites.length) sidx = 0;
    // ensure sprite canvas is valid
    if (!critterSprites[sidx] || !critterSprites[sidx].width || !critterSprites[sidx].height){ try{ critterSprites[sidx] = makeSpriteCanvas(critterSpecs[sidx], CRITTER_SPR_SCALE); }catch(_){ sidx = 0; } }
    // create per-instance tile canvas for journal/icon if needed
    let tileC = null;
    try{
      const spr = critterSprites[sidx];
      if (spr && spr.width && spr.height){ tileC = document.createElement('canvas'); tileC.width = spr.width; tileC.height = spr.height; const tctx = tileC.getContext('2d'); tctx.drawImage(spr,0,0); }
    }catch(_){ tileC = null; }
    animals.push({
      x: Math.random()*WORLD_W,
      y: Math.random()*WORLD_H,
      speed: 6 + Math.random()*18,
      angle: ang,
      targetAngle: ang,
      changeAt: performance.now() + 400 + Math.random()*1800,
      spriteIdx: sidx,
      kind: 'animal-' + sidx,
      tileC: tileC,
      phase: Math.random()*Math.PI*2,
      bobAmp: 0.6 + Math.random()*1.6,
      alive: true
    });
  }
}
spawnAnimals();

// initial preview spawns removed: squidrobot
// (previously spawned here for quick preview; removed to avoid automatic sample entities)

// Debug: press 'T' to force-spawn a chained tank near the player for quick verification
addEventListener('keydown', e => { try{ if (e.key && e.key.toLowerCase() === 't'){ try{ const alt = spawnChainedTank(tank.x + 120, tank.y, {}); enemies.push(alt); console.log('debug: forced chained tank spawn near player'); }catch(_){ console.log('debug: spawnChainedTank failed', _); } } }catch(_){ } });

// initial preview spawns removed: kitten (pinkdot)
// (previously spawned here for quick preview; removed to avoid automatic sample entities)

function spawnInitialKraken(){
  try{
    const x = tank.x + 180; const y = tank.y;
    const { c: tileC, g: tileG } = charTileCanvas();
    const idle = (idleMakers && idleMakers.kraken) ? idleMakers.kraken(tileG) : (()=>{});
    const run = (runMakers && runMakers.kraken) ? runMakers.kraken(tileG) : (()=>{});
    const ent = { x, y, spd: 12, r: 20, type: 'jungle', kind: 'kraken', hp: 3, tileC, tileG, idle, run, angle: 0, lastAttack: 0, attackCD: 1200, dashUntil:0, moving: false, harmless: false };
    enemies.push(ent);
  }catch(err){ /* fail silently */ }
}


function spawnEnemy(){
  // spawn at random edge
  const side = Math.floor(Math.random()*4);
  let x=0,y=0;
if (side===0){ x = -60; y = Math.random()*WORLD_H; }
else if (side===1){ x = WORLD_W+60; y = Math.random()*WORLD_H; }
else if (side===2){ x = Math.random()*WORLD_W; y = -60; }
else { x = Math.random()*WORLD_W; y = WORLD_H+60; }
  // remove any leftover basic red-dot enemies before spawning new ones
  for (let i=enemies.length-1;i>=0;i--) if (enemies[i].type === 'basic'){ try{ recordDeath(enemies[i].kind || '<basic>', enemies[i]); }catch(_){ } enemies.splice(i,1); }

  // 40% chance to spawn a jungle NPC (uses jungleSprites) — these will replace the red-dot enemies
  const roll = Math.random();
  if (roll < 0.4){
  // small chance to call in an osprey that drops combatants (increased frequency)
  if (Math.random() < 0.28){ spawnOsprey(x,y); return; }
    // sometimes spawn a small group of jungle NPCs (some standing, some combatants)
    const GROUP_CHANCE = 0.5;
    // hp and speed maps
  const hpMap = { commando:3, scout:2, heavy:4, medic:2, villager1:1, villager2:1, guide:3, radioop:2, squidrobot:2 };
  const spdMap = { commando:45, scout:65, heavy:35, medic:50, villager1:40, villager2:40, guide:55, radioop:40, squidrobot:18 };
  // chance that a 'heavy' kind spawns as a chained tank (increased for testing)
  const CHAINED_SPAWN_CHANCE = 0.6;
  if (Math.random() < GROUP_CHANCE){
      const groupSize = 3 + Math.floor(Math.random()*4); // 3-6
      const combatCount = Math.max(1, Math.round(groupSize * (0.4 + Math.random()*0.3))); // 40-70% combatants
      for (let gi=0; gi<groupSize; gi++){
        const gx = x + (Math.random()-0.5) * 80; const gy = y + (Math.random()-0.5) * 80;
        const kind = JUNGLE_KINDS[Math.floor(Math.random()*JUNGLE_KINDS.length)];
        // if we picked a heavy and roll passes, spawn a roaming chained tank instead
        if (kind === 'heavy' && Math.random() < CHAINED_SPAWN_CHANCE){
          try{ const alt = spawnChainedTank(gx, gy, {}); enemies.push(alt); continue; }catch(_){ }
        }
        const { c: tileC, g: tileG } = charTileCanvas();
        const idle = (idleMakers[kind] || (()=>()=>{}))(tileG);
        const run = (runMakers[kind] || (()=>()=>{}))(tileG);
        const isFats = (kind === 'fatsammich');
        const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
  const ent = { x: gx, y: gy, spd: baseSpd, r: 14, type: 'jungle', kind, hp: isFats ? 1 : (hpMap[kind] || 2), tileC, tileG, idle, run, angle: 0, turretAngle: 0, lastAttack: 0, attackCD: 500 + Math.random()*300, dashUntil:0, moving: false, harmless: isFats };
  try{ if (kind === 'pinkdot' && typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRenderer === 'function') globalThis.attachKittenRenderer(ent); }catch(_){ }
  if (kind === 'squidrobot'){ ent.spd = spdMap.squidrobot; ent.r = 16; ent.turretAngle = 0; ent.attackCD = 1000 + Math.random()*600; }
  // Special-case: freshly spawned kitten (pinkdot) should be able to fire soon after appearing
  if (kind === 'pinkdot'){
    ent.attackCD = 500 + Math.random()*200;
    try{ ent.lastAttack = (typeof performance !== 'undefined' && performance.now) ? (performance.now() - ent.attackCD - 100) : 0; }catch(_){ }
  }
        // mark some as passive/standing around (non-combatants)
        if (gi >= combatCount){ ent.harmless = true; ent.attackCD = 1e9; ent.spd *= 0.6; }
        enemies.push(ent);
      }
    } else {
      // single spawn (as before)
      const kind = JUNGLE_KINDS[Math.floor(Math.random()*JUNGLE_KINDS.length)];
      // single spawn: sometimes replace heavy with chained tank
      if (kind === 'heavy' && Math.random() < CHAINED_SPAWN_CHANCE){
        try{ const alt = spawnChainedTank(x, y, {}); enemies.push(alt); return; }catch(_){ }
      }
      const { c: tileC, g: tileG } = charTileCanvas();
      const idleFactory = idleMakers[kind] || (()=>()=>{});
      const runFactory = runMakers[kind] || (()=>()=>{});
      const idle = idleFactory(tileG);
      const run = runFactory(tileG);
      const isFats = (kind === 'fatsammich');
      const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
    const ent = { x, y, spd: baseSpd, r: 14, type: 'jungle', kind, hp: isFats ? 1 : (hpMap[kind] || 2), tileC, tileG, idle, run, angle: 0, turretAngle: 0, lastAttack: 0, attackCD: 500 + Math.random()*300, dashUntil:0, moving: false, harmless: isFats };
  if (kind === 'squidrobot'){ ent.spd = spdMap.squidrobot; ent.r = 16; ent.turretAngle = 0; ent.attackCD = 1000 + Math.random()*600; }
  if (kind === 'pinkdot'){
    ent.attackCD = 500 + Math.random()*200;
    try{ ent.lastAttack = (typeof performance !== 'undefined' && performance.now) ? (performance.now() - ent.attackCD - 100) : 0; }catch(_){ }
  }
  try{ if (kind === 'pinkdot' && typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRenderer === 'function') globalThis.attachKittenRenderer(ent); }catch(_){ }
      enemies.push(ent);
    }
  } else if (roll < 0.7) {
  // animal critters (decorative but hostile)
  let spriteIdx = Math.floor(Math.random()*critterSprites.length);
  if (spriteIdx < 0 || spriteIdx >= critterSprites.length) spriteIdx = 0;
  // ensure canvas exists (rebuild if needed)
  if (!critterSprites[spriteIdx] || !critterSprites[spriteIdx].width || !critterSprites[spriteIdx].height){ try{ critterSprites[spriteIdx] = makeSpriteCanvas(critterSpecs[spriteIdx], CRITTER_SPR_SCALE); }catch(_){ spriteIdx = 0; } }
  // prefer a larger animal tile when available for better journal/icon fidelity
  const largeTile = (window.largeAnimalSprites && window.largeAnimalSprites[spriteIdx]) ? window.largeAnimalSprites[spriteIdx] : (critterSprites[spriteIdx] || null);
  enemies.push({ x, y, spd: 30 + Math.random()*30, r: 10 + Math.random()*4, type: 'animal', hp: 3, spriteIdx, tileC: largeTile, kind: 'animal-' + spriteIdx, angle: 0 });
    } else {
    // fallback: spawn an animal instead of the old red-dot basic enemy
    let spriteIdx = Math.floor(Math.random()*critterSprites.length);
    if (spriteIdx < 0 || spriteIdx >= critterSprites.length) spriteIdx = 0;
    if (!critterSprites[spriteIdx] || !critterSprites[spriteIdx].width || !critterSprites[spriteIdx].height){ try{ critterSprites[spriteIdx] = makeSpriteCanvas(critterSpecs[spriteIdx], CRITTER_SPR_SCALE); }catch(_){ spriteIdx = 0; } }
  const largeTile2 = (window.largeAnimalSprites && window.largeAnimalSprites[spriteIdx]) ? window.largeAnimalSprites[spriteIdx] : (critterSprites[spriteIdx] || null);
  enemies.push({ x, y, spd: 30 + Math.random()*30, r: 9 + Math.random()*3, type: 'animal', hp: 3, spriteIdx, tileC: largeTile2, kind: 'animal-' + spriteIdx, angle: 0 });
  }
}

// Spawn an osprey that flies in, drops a small group of combatants, then departs
function spawnOsprey(targetX, targetY){
  // pick an approach side offscreen
  const side = Math.random() < 0.5 ? -1 : 1; // -1 left, 1 right
  const startX = (side === -1) ? -120 : (WORLD_W + 120);
  const startY = mod(targetY + (Math.random()-0.5)*200, WORLD_H);
  const { c: tileC, g: tileG } = charTileCanvas();
  const idle = makeOspreyIdle(tileG);
  const run = makeOspreyRun(tileG);
  const ent = {
    x: startX, y: startY, vx: (side===-1? 60 : -60), vy: 0, r: 22,
    type: 'osprey', kind: 'osprey', tileC, tileG, idle, run,
  state: 'approach', // approach -> descend -> drop -> ascend -> leave
  dropAt: mod(targetY, WORLD_H), // y where it will drop
  dropX: targetX, // x world target for drop
  startY: startY,
    dropCount: 2 + Math.floor(Math.random()*3), // 2-4 combatants
    dropDone: false
  };
  enemies.push(ent);
}

// (tank explosion visuals and sprite baking moved to `js/tank.js`)

function updateCritters(now, dt){
  for (const c of critters){
    if (now > c.changeAt){ c.changeAt = now + 400 + Math.random()*1800; c.targetAngle = Math.random()*Math.PI*2; }
    // smooth turn toward targetAngle
    const da = (c.targetAngle - c.angle + Math.PI*3) % (Math.PI*2) - Math.PI;
    c.angle += da * 0.06;
  const vx = Math.cos(c.angle) * c.speed; const vy = Math.sin(c.angle) * c.speed;
  c.vx = vx; c.vy = vy; // store velocity for drawing flip
  c.x += vx * dt; c.y += vy * dt;
    c.phase += dt * 6;
    // wrap around world
  if (c.x < 0) c.x += WORLD_W; if (c.x > WORLD_W) c.x -= WORLD_W;
  // wrap vertically to make the world endless
  if (c.y < 0) c.y += WORLD_H; if (c.y > WORLD_H) c.y -= WORLD_H;
  }
}

// draw sprite-based critters
function drawCritters(now){
  // periodic debug: report critter count and first sprite validity
  if (DEBUG && typeof console !== 'undefined' && performance.now() - __lastCritterDrawLog > 1000){ __lastCritterDrawLog = performance.now(); try{ const sample = critterSprites.slice(0,8).map((s,idx)=>({idx, ok: !!s && !!s.width && !!s.height, w: s && s.width, h: s && s.height})); console.log('drawCritters: count=', critters.length, 'sampleSprites=', sample); }catch(_){ } }

  for (let i=critters.length-1;i>=0;i--){ const c = critters[i]; if (!c.alive) continue; const ss = worldToScreen(c.x, c.y); const sx = ss.x, sy = ss.y; if (sx < -40 || sx > W+40 || sy < -40 || sy > H+40) continue; const bob = Math.sin(c.phase) * c.bobAmp;
  // keep critters vertically locked; flip horizontally if moving left
  const idx = (typeof c.spriteIdx === 'number') ? c.spriteIdx : 0;
  const spr = critterSprites[idx]; const flip = (c.vx && c.vx < 0);
  const drawScale = camera.zoom * CRITTER_DRAW_BASE;
  // fallback: if sprite canvas is empty/invalid, draw a bright circle so it is visible
  if (!spr || !spr.width || !spr.height){ ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy + bob), 8 * camera.zoom, 0, Math.PI*2); ctx.fill(); ctx.restore(); if (showEntityMarkers){ ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.fillRect(Math.round(sx)-3, Math.round(sy)-3, 6, 6); ctx.restore(); } continue; }
  const pad = Math.max(24, Math.round((spr.width * drawScale)/2) + 6);
  if (sx < -pad || sx > W+pad || sy < -pad || sy > H+pad) continue;
  // diagnostics when markers enabled
  if (showEntityMarkers && DEBUG){ try{ console.log('drawCritter', { idx: i, spriteIdx: c.spriteIdx, sprW: spr.width, sprH: spr.height, sx: Math.round(sx), sy: Math.round(sy), drawScale }); }catch(_){ } }
  try{ drawImageCenteredFlipped(spr, Math.round(sx), Math.round(sy + bob), flip, drawScale); }catch(err){ ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy + bob), 8 * camera.zoom, 0, Math.PI*2); ctx.fill(); ctx.restore(); console.warn('drawCritters: drawImage failed, showed fallback marker', err); }
    // tank-only collision: check distance to tank and trigger gibs
    if (selectedVehicle === 'tank'){
      const dx = c.x - tank.x, dy = c.y - tank.y; if (Math.hypot(dx,dy) < 14){ // hit by tank
  c.alive = false; // remove
    callSpawnGibs(c.x, c.y, '#ff8b6b', 16, 'critter-runover');
  // visual bump feedback
  try{ triggerTankBump(6, 0.14); }catch(_){ }
  try{ recordDeath(c.kind || ('critter-' + (c.spriteIdx !== undefined ? c.spriteIdx : '<unknown>')), c); }catch(_){ }
  try{ recordKill(c.kind || ('critter-' + (c.spriteIdx !== undefined ? c.spriteIdx : '<unknown>')), c); }catch(_){ }
        // small shake on gib
        triggerScreenShake(8, 0.12);
      }
    }
  // debug marker
  if (showEntityMarkers){ ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.fillRect(Math.round(sx)-3, Math.round(sy)-3, 6, 6); ctx.restore(); }
  }
}

// mirror critter behavior for smaller decorative animals (same distribution)
function updateAnimals(now, dt){
  for (const a of animals){
    if (now > a.changeAt){ a.changeAt = now + 400 + Math.random()*1800; a.targetAngle = Math.random()*Math.PI*2; }
    const da = (a.targetAngle - a.angle + Math.PI*3) % (Math.PI*2) - Math.PI;
    a.angle += da * 0.06;
    const vx = Math.cos(a.angle) * a.speed; const vy = Math.sin(a.angle) * a.speed;
    a.vx = vx; a.vy = vy; a.x += vx * dt; a.y += vy * dt;
    a.phase += dt * 6;
    if (a.x < 0) a.x += WORLD_W; if (a.x > WORLD_W) a.x -= WORLD_W;
    if (a.y < 0) a.y += WORLD_H; if (a.y > WORLD_H) a.y -= WORLD_H;
  }
}

function drawAnimals(now){
  for (let i=animals.length-1;i>=0;i--){ const a = animals[i]; if (!a.alive) continue; const ss = worldToScreen(a.x, a.y); const sx = ss.x, sy = ss.y; if (sx < -40 || sx > W+40 || sy < -40 || sy > H+40) continue; const bob = Math.sin(a.phase) * a.bobAmp;
    const idx = (typeof a.spriteIdx === 'number') ? a.spriteIdx : 0;
    const spr = (a && a.tileC && a.tileC.width) ? a.tileC : critterSprites[idx];
    const flip = (a.vx && a.vx < 0);
  // compute drawScale similarly to the main enemy animal path: base by camera zoom and ANIMAL_DRAW_BASE,
  // adjust by native sprite width so large tiles render at an appropriate visual size
  const baseSpriteWidth = (critterSprites && critterSprites[0] && critterSprites[0].width) ? critterSprites[0].width : (8 * CRITTER_SPR_SCALE);
  const sizeFactor = (spr && spr.width) ? (spr.width / baseSpriteWidth) : 1;
  const drawScale = camera.zoom * ANIMAL_DRAW_BASE * sizeFactor;
    if (!spr || !spr.width || !spr.height){ ctx.save(); ctx.fillStyle = '#ffd1d1'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy + bob), 6 * camera.zoom, 0, Math.PI*2); ctx.fill(); ctx.restore(); continue; }
    const pad = Math.max(20, Math.round((spr.width * drawScale)/2) + 6); if (sx < -pad || sx > W+pad || sy < -pad || sy > H+pad) continue;
    try{ drawImageCenteredFlipped(spr, Math.round(sx), Math.round(sy + bob), flip, drawScale); }catch(e){ ctx.save(); ctx.fillStyle = '#ffd1d1'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy + bob), 6 * camera.zoom, 0, Math.PI*2); ctx.fill(); ctx.restore(); }
  }
}

function fireBullet(){
  if (gameOver || !selectedVehicle) return;
  const now = performance.now(); if (now - lastShot < SHOT_COOLDOWN) return; lastShot = now;
  let a, sx, sy;
  // convert mouse screen coords to world coords for aiming
  const _mw_fire = screenToWorld(mouse.x, mouse.y);
  const mouseWorldX = _mw_fire.x;
  const mouseWorldY = _mw_fire.y;
  if (selectedVehicle === 'heli'){
    a = Math.atan2(mouseWorldY - heli.y, mouseWorldX - heli.x);
    // place muzzle a bit in front of helicopter nose
    const offset = (H_SPR_W/2) * H_SCALE + 6;
    sx = heli.x + Math.cos(a) * offset;
    sy = heli.y + Math.sin(a) * offset;
    heli.turretAngle = a;
  } else {
    const dyWrap = wrapDeltaY(mouseWorldY, tank.y);
    a = Math.atan2(dyWrap, mouseWorldX - tank.x);
  const _spriteW = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
  const muzzle = (_spriteW/2)*effectiveTankScale() + 6;
    sx = tank.x + Math.cos(a)*muzzle;
    sy = tank.y + Math.sin(a)*muzzle;
    tank.turretAngle = a;
  }
  // default muzzle origin in world coords (may be overridden for variant-specific behavior)
  let muzzleX = sx, muzzleY = sy;
  // Murkia special behaviour: the Murkia tank fires 4 projectiles that rotate with the turret
  if (selectedVehicle === 'tank' && selectedVehicleVariant === 'murkia'){
    // For Murkia, spawn all projectiles from the turret center so they line up
    // visually with the rotating turret. Override the muzzle origin to tank center.
    muzzleX = tank.x;
    muzzleY = tank.y;
    const offsets = [0, Math.PI/2, Math.PI, -Math.PI/2];
    for (const off of offsets){
      const ai = a + off;
      bullets.push({ x: muzzleX, y: muzzleY, dx: Math.cos(ai)*BULLET_SPEED, dy: Math.sin(ai)*BULLET_SPEED, life: 2.0, color: 'hsl(18 95% 58%)' });
    }
    // single muzzle flash at turret center (shows firing and turret orientation)
    try{ spawnMuzzleFlash(muzzleX, muzzleY, a); }catch(_){ }
  } else {
    // heli and other existing behavior: aim at mouse
    const dx = Math.cos(a)*BULLET_SPEED; const dy = Math.sin(a)*BULLET_SPEED;
    // Shot count behavior (1 = normal, 2 = parallel double, 3 = triple angled streams, 4 = five-stream quad)
  let activeShots = (selectedVehicle === 'tank' && tank.shotCount && now < (tank.powerupUntil || 0)) ? tank.shotCount : 1;
  // Dozer is a single-shot design: ignore any multi-shot powerups
  if (selectedVehicleVariant === 'dozer') activeShots = 1;
    const BASE_HUE = 200;
    function colorFor(i, total){ const center = (total-1)/2; const spreadStep = 6; const offset = (i - center) * spreadStep; const h = BASE_HUE + offset; const s = Math.max(60, 92 - Math.abs(i-center)*8); const l = Math.max(44, 60 - Math.abs(i-center)*3); return `hsl(${Math.round(h)} ${s}% ${l}%)`; }
    if (selectedVehicle === 'tank' && activeShots === 2){
      const spread = 6; const ox = Math.cos(a + Math.PI/2) * spread; const oy = Math.sin(a + Math.PI/2) * spread;
      bullets.push({ x: sx - ox, y: sy - oy, dx, dy, life: 2.0, color: colorFor(0,2) });
      bullets.push({ x: sx + ox, y: sy + oy, dx, dy, life: 2.0, color: colorFor(1,2) });
    } else if (selectedVehicle === 'tank' && activeShots === 3){
      bullets.push({ x: sx, y: sy, dx, dy, life: 2.0, color: colorFor(1,3) });
      const angleSpread = 0.18; const a1 = a - angleSpread; const a2 = a + angleSpread;
      bullets.push({ x: sx + Math.cos(a1)*4, y: sy + Math.sin(a1)*4, dx: Math.cos(a1)*BULLET_SPEED, dy: Math.sin(a1)*BULLET_SPEED, life: 2.0, color: colorFor(0,3) });
      bullets.push({ x: sx + Math.cos(a2)*4, y: sy + Math.sin(a2)*4, dx: Math.cos(a2)*BULLET_SPEED, dy: Math.sin(a2)*BULLET_SPEED, life: 2.0, color: colorFor(2,3) });
    } else if (selectedVehicle === 'tank' && activeShots === 4){
      const total = 5; bullets.push({ x: sx, y: sy, dx, dy, life: 2.5, color: colorFor(2,total) });
      const innerSpread = 0.12; const outerSpread = 0.28;
      const a_in_l = a - innerSpread, a_in_r = a + innerSpread;
      const a_out_l = a - outerSpread, a_out_r = a + outerSpread;
      bullets.push({ x: sx + Math.cos(a_in_l)*3, y: sy + Math.sin(a_in_l)*3, dx: Math.cos(a_in_l)*BULLET_SPEED, dy: Math.sin(a_in_l)*BULLET_SPEED, life: 2.0, color: colorFor(1,total) });
      bullets.push({ x: sx + Math.cos(a_in_r)*3, y: sy + Math.sin(a_in_r)*3, dx: Math.cos(a_in_r)*BULLET_SPEED, dy: Math.sin(a_in_r)*BULLET_SPEED, life: 2.0, color: colorFor(3,total) });
      bullets.push({ x: sx + Math.cos(a_out_l)*6, y: sy + Math.sin(a_out_l)*6, dx: Math.cos(a_out_l)*BULLET_SPEED, dy: Math.sin(a_out_l)*BULLET_SPEED, life: 2.0, color: colorFor(0,total) });
      bullets.push({ x: sx + Math.cos(a_out_r)*6, y: sy + Math.sin(a_out_r)*6, dx: Math.cos(a_out_r)*BULLET_SPEED, dy: Math.sin(a_out_r)*BULLET_SPEED, life: 2.0, color: colorFor(4,total) });
    } else {
      bullets.push({ x: sx, y: sy, dx, dy, life: 2.0, color: 'hsl(18 95% 58%)' });
    }
    try{ spawnMuzzleFlash(sx, sy, a); }catch(_){ }
  }

  try{ if (SFX && typeof SFX.playShoot === 'function') SFX.playShoot(); }catch(_){ }

  // eject a brass shell casing to the side of the turret
  try{
    const perp = a + Math.PI/2; // ejection direction (perpendicular to barrel)
    // randomize side slightly so casings sometimes go left/right
    const side = (Math.random() < 0.5) ? 1 : -1;
    const ejectDir = a + (Math.PI/2) * side;
    const shellSpeed = 140 + Math.random() * 100; // px/s
    const svx = Math.cos(ejectDir) * shellSpeed;
    const svy = Math.sin(ejectDir) * shellSpeed - (40 + Math.random()*40);
    // Murkia ejects multiple casings; default tank only ejects one
    if (selectedVehicle === 'tank' && selectedVehicleVariant === 'murkia'){
      for (let ci = 0; ci < 4; ci++){
        const angOffset = (ci - 1.5) * 0.18 + (Math.random() * 0.06 - 0.03); // spread around ejectDir
        const dir = ejectDir + angOffset;
        const speed = shellSpeed * (0.85 + Math.random() * 0.4);
        const svx2 = Math.cos(dir) * speed;
        const svy2 = Math.sin(dir) * speed - (40 + Math.random()*40);
        casings.push({ x: muzzleX + Math.cos(dir)*8 + (Math.random()-0.5)*3, y: muzzleY + Math.sin(dir)*8 + (Math.random()-0.5)*3, vx: svx2, vy: svy2, life: 1.0 + Math.random()*1.0, spin: (Math.random()*8-4), t0: performance.now() });
      }
    } else {
      const dir = ejectDir + (Math.random() * 0.06 - 0.03);
      const speed = shellSpeed * (0.9 + Math.random() * 0.25);
      const svx2 = Math.cos(dir) * speed;
      const svy2 = Math.sin(dir) * speed - (40 + Math.random()*40);
      casings.push({ x: muzzleX + Math.cos(dir)*8 + (Math.random()-0.5)*2, y: muzzleY + Math.sin(dir)*8 + (Math.random()-0.5)*2, vx: svx2, vy: svy2, life: 1.0 + Math.random()*0.6, spin: (Math.random()*6-3), t0: performance.now() });
    }
  }catch(_){ }
}

// collisions
function collideEnemyBullet(e,b){ const dx = e.x - b.x, dy = e.y - b.y; return Math.hypot(dx,dy) < (e.r + 2); }
function collideEnemyTank(e){ const dx = e.x - tank.x, dy = e.y - tank.y; const _spriteW = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W; return Math.hypot(dx,dy) < (e.r + _spriteW*effectiveTankScale()*0.45); }

// enhanced restart to clear explosion pieces and resume
function restart(){ bullets.length = 0; enemies.length = 0; score = 0; health = 3; gameOver = false; paused = false; selectedVehicle = 'tank'; center.style.display = 'none'; updateHud(); tank.x = WORLD_W/2; tank.y = WORLD_H/2; heli.x = WORLD_W/2; heli.y = WORLD_H/2; tank.alive = true; tankPieces.length = 0; 
  casings.length = 0;
  // spawn an initial osprey just off-screen relative to the current camera so you can immediately see it drop troops
  // spawn an initial kraken near the player for preview
  spawnInitialKraken();
  // spawn a test double-shot powerup near the tank so it can be picked up immediately
  spawnPowerup(tank.x + 40, tank.y, 'double');
}

// Spawn an osprey positioned to be visible in the current camera view (comes in from left)
function spawnVisibleOsprey(){
  // removed: preview osprey caused an unwanted brown-rectangle visual.
  // Keep function as a safe no-op so any remaining refs don't spawn the preview.
}

// Periodic osprey caller: occasionally spawn an osprey near the camera so the
// player sees more drops during gameplay. Runs independently of enemy spawns.
let _lastOspreyTick = performance.now();
function maybeSpawnPeriodicOsprey(now){
  try{
    if (now - _lastOspreyTick < 10000) return; // check at most every 10s
    _lastOspreyTick = now + Math.random() * 8000; // next earliest check window randomized
    // small probability per check to spawn one (makes average ~1 every 12-30s)
    if (Math.random() < 0.45){
      // pick a target near camera so it is visible
      const targetX = camera.x + (Math.random()*0.5 - 0.25) * W;
      const targetY = camera.y + (Math.random()*0.5 - 0.25) * H;
      try{ spawnOsprey(mod(targetX, WORLD_W), mod(targetY, WORLD_H)); }catch(_){ }
    }
  }catch(_){ }
}


// stylized HUD: hearts for health and pill-shaped score badge
function updateHud(){
  try{ installHudStyles(); }catch(err){ console.warn('installHudStyles failed', err); }
  // build left (shoot-phase) center (logo + score) right (powerup + health)
  const current = Math.max(1, Math.min(4, (tank.shotCount || 1)));
  let dots = '';
  for (let i=1;i<=4;i++){ dots += `<div class="tn-dot${i<=current? ' active':''}"></div>`; }
  const phaseLabel = (current === 1) ? t('single') : (current === 2 ? t('double') : (current === 3 ? t('triple') : t('quad')));

  // score
  const scoreHTML = `<div class="tn-panel tn-center"><div class="tn-logo">${t('tank_nutz')}</div><div style="margin-top:6px" class="tn-score">${t('score')}: ${score}</div></div>`;

  // left shoot-phase
  const leftHTML = `<div class="tn-panel tn-left"><div class="tn-bolts" title="bolted"></div><div style="display:flex;flex-direction:column;align-items:flex-start"><div class="tn-shoot-dots">${dots}</div><div style="font-size:12px;color:#ccc;margin-top:4px">${phaseLabel}</div></div></div>`;

  // powerup indicator
  let pu = '';
  if (tank.shotCount && tank.powerupUntil && performance.now() < tank.powerupUntil){ const sec = Math.ceil((tank.powerupUntil - performance.now())/1000); let label = 'Double'; if (tank.shotCount === 3) label = 'Triple'; else if (tank.shotCount === 4) label = 'Quad'; pu = `<div class="tn-panel tn-powerup">${label} (${sec}s)</div>`; }

  // health hearts
  let hearts = '';
  const h = Math.max(0, Math.min(typeof MAX_HEALTH === 'number' ? MAX_HEALTH : 5, health || 0));
  for (let i=0;i< (typeof MAX_HEALTH === 'number' ? MAX_HEALTH : 5); i++){ hearts += `<div class="tn-heart" style="opacity:${i < h ? 1 : 0.25}"></div>`; }
  const rightHTML = `<div class="tn-panel tn-right">${pu}<div class="tn-health" style="margin-left:8px">${hearts}</div></div>`;

  // assemble into hud container: left + right; title/score moved to bottom-right
  try{
    // Reuse child panels if present to avoid stomping event handlers elsewhere
    hud.innerHTML = '';
    const left = document.createElement('div'); left.className = 'tn-left'; left.innerHTML = leftHTML; hud.appendChild(left);
  const right = document.createElement('div'); right.className = 'tn-right';
  // keep right panel compact (health/powerup)
  right.innerHTML = rightHTML;
  hud.appendChild(right);
  // create or update vehicle menu (lower-left)
  try{
    let vmenu = document.getElementById('tn-vehicle-menu');
  if (!vmenu){ vmenu = document.createElement('div'); vmenu.id = 'tn-vehicle-menu'; vmenu.className = 'tn-vehicle-menu'; document.body.appendChild(vmenu); }
    // rebuild slots
    vmenu.innerHTML = '';
    for (let i=0;i<VEHICLE_SLOTS.length;i++){
      const slot = document.createElement('div');
      slot.className = 'vehicle-slot' + (VEHICLE_UNLOCKED[i] ? '' : ' locked') + ( ( (VEHICLE_SLOTS[i] === 'tank' && selectedVehicle === 'tank') || (VEHICLE_SLOTS[i] === 'heli' && selectedVehicle === 'heli') ) ? ' selected' : '');
      slot.dataset.idx = i;
      slot.addEventListener('pointerdown', (ev)=>{ try{ const idx = Number(slot.dataset.idx); if (VEHICLE_UNLOCKED[idx]) selectVehicleSlot(idx); ev.stopPropagation(); }catch(_){ } });

      // unlocked slots: render appropriate preview
      if (VEHICLE_UNLOCKED[i]){
        if (VEHICLE_SLOTS[i] === 'tank'){
          try{
            if (typeof bodyCanvas !== 'undefined' && bodyCanvas){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Default';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ } g.clearRect(0,0,cw,ch);
              const bw = bodyCanvas.width || SPR_W * SPRITE_SCALE; const bh = bodyCanvas.height || SPR_H * SPRITE_SCALE;
              const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1);
              const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2);
              try{ g.drawImage(bodyCanvas, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              try{ if (typeof turretCanvas !== 'undefined' && turretCanvas){ const tw = turretCanvas.width, th = turretCanvas.height; g.drawImage(turretCanvas, 0,0,tw,th, dx,dy, Math.round(tw*scale), Math.round(th*scale)); } }catch(_){ }
            } else {
              slot.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:18px">TANK</div><div class="slot-label" style="font-size:11px">Default</div></div>';
              vmenu.appendChild(slot);
            }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">TANK</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'heli'){
          slot.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:18px">HELI</div><div class="slot-label" style="font-size:11px">Unlocked</div></div>';
          vmenu.appendChild(slot);
        }
        else if (VEHICLE_SLOTS[i] === 'fordfiesta'){
          try{
            if (typeof drawFordFiestaInto === 'function'){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Fiesta';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
              try{ drawFordFiestaInto(g, cw, ch, performance.now()); }catch(_){ }
            } else { slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'murkia'){
          try{
            if (typeof drawMurkiaInto === 'function'){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Murkia';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
              try{ drawMurkiaInto(g, cw, ch, performance.now()); }catch(_){ }
            } else { slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'dozer'){
          try{
            if (typeof drawDozerInto === 'function'){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Dozer';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
              try{ drawDozerInto(g, cw, ch, performance.now()); }catch(_){ }
            } else { slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
      } else {
        // locked slot
        slot.innerHTML = '<div style="font-size:22px">?</div>';
        vmenu.appendChild(slot);
      }
    }
  }catch(_){ }
  // create a separate prominent control panel (top-right) so it's obvious to players
  try{
    let ctrl = document.getElementById('tn-controls-panel');
    if (!ctrl){ ctrl = document.createElement('div'); ctrl.id = 'tn-controls-panel'; ctrl.className = 'tn-controls-panel';
      // ensure panel stays on top and accepts pointer events
      try{ ctrl.style.zIndex = '30002'; ctrl.style.pointerEvents = 'auto'; }catch(_){ }
      document.body.appendChild(ctrl); }
    // build big buttons
    ctrl.innerHTML = `
      <button id="tn-pause-btn" class="tn-big-btn">${paused ? t('resume') : t('pause')}</button>
      <button id="tn-sound-btn" class="tn-big-btn">${t('sound')}</button>
      <button id="tn-open-controls" class="tn-big-btn">${t('controls')}</button>
      <button id="tn-lang-btn" class="tn-big-btn">Lang</button>
    `;
    // wire handlers
    // Use event delegation on the controls panel so button clicks still work
    // even when we replace ctrl.innerHTML frequently. Make this idempotent.
    try{
      if (!ctrl._hasDelegate) {
        ctrl.addEventListener('click', (ev)=>{
          try{
            const t1 = ev.target;
            // handle clicks on the lang button (or children inside it)
            if (t1 && (t1.id === 'tn-lang-btn' || (t1.closest && t1.closest && t1.closest('#tn-lang-btn')))){
              try{ console.log('tn-lang-btn delegated click'); }catch(_){ }
              try{
                if (typeof window.openLangMenu === 'function') { window.openLangMenu(); return; }
              }catch(_){ }
              try{ if (typeof openLangMenu === 'function') openLangMenu(); }catch(_){ }
            }
          }catch(_){ }
        });
        ctrl._hasDelegate = true;
      }
    }catch(_){ }
  const pauseBtn = document.getElementById('tn-pause-btn');
  const soundBtn = document.getElementById('tn-sound-btn');
  const langBtn = document.getElementById('tn-lang-btn');
  // defensive listener: trigger the button's click (safe) rather than calling openLangMenu
  try {
      if (langBtn) {
      langBtn.addEventListener('pointerdown', (ev) => {
        try {
          console.log('tn-lang-btn pointerdown');
          // Call click asynchronously so the later code in updateHud() has
          // a chance to assign the onclick handler before the synthetic click
          // runs. This avoids a race where click() happens before onclick exists.
          setTimeout(()=>{ try{ langBtn.click(); }catch(_){ } }, 0);
        } catch (_) { }
      });
    }
  } catch (_) { }
  // Ensure global open/close helpers exist so clicks always resolve to a function.
    try{
    if (typeof window.openLangMenu !== 'function'){
      window.closeLangMenu = function(){ try{ const m = document.getElementById('tn-lang-menu'); if (m) m.remove(); }catch(_){ } };
      window.openLangMenu = function(){ try{ // prefer i18n-backed menu when available
        try{ console.log('DEBUG: installed fallback window.openLangMenu'); }catch(_){ }
          if (typeof window.setLang === 'function' && typeof window.getLang === 'function'){
            // reuse existing languages list if provided, otherwise fallback to ['en']
            const langs = (window.__i18n && window.__i18n.languages) ? window.__i18n.languages : ['en'];
            const langNames = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' };
            try{
              window.closeLangMenu();
              const menu = document.createElement('div'); menu.id = 'tn-lang-menu'; menu.style.position = 'absolute';
              menu.style.background = 'linear-gradient(180deg,#111,#000)'; menu.style.border = '1px solid #222'; menu.style.borderRadius = '6px'; menu.style.padding = '6px'; menu.style.zIndex = 30000; menu.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)'; menu.style.color = '#fff'; menu.style.minWidth = '140px';
              langs.forEach(code=>{ const it = document.createElement('div'); it.style.padding = '8px 10px'; it.style.cursor = 'pointer'; it.style.borderRadius = '4px'; it.style.fontWeight = '700'; it.textContent = (langNames[code] || code) + ' (' + code.toUpperCase() + ')'; it.onclick = ()=>{ try{ if (window.setLang) window.setLang(code); }catch(_){ } try{ menu.remove(); }catch(_){} }; menu.appendChild(it); });
              document.body.appendChild(menu);
              // position to the right of the lang button if possible
              try{
                const btn = document.getElementById('tn-lang-btn'); const rect = btn && btn.getBoundingClientRect();
                if (rect){ menu.style.left = (rect.right + 6 + (window.scrollX||0)) + 'px'; menu.style.top = (rect.top + (window.scrollY||0)) + 'px'; menu.style.right = 'auto'; }
                else { menu.style.right = '12px'; menu.style.top = '120px'; }
                // if overflow on the right, flip to left side of button
                const mrect = menu.getBoundingClientRect();
                if (rect && mrect.right > window.innerWidth){ const newLeft = rect.left - mrect.width - 6 + (window.scrollX||0); menu.style.left = newLeft + 'px'; menu.style.right = 'auto'; }
              }catch(_){ }
              setTimeout(()=>{ const onDoc = (ev)=>{ if (!menu.contains(ev.target)) { try{ menu.remove(); }catch(_){ } document.removeEventListener('pointerdown', onDoc); } }; document.addEventListener('pointerdown', onDoc); }, 10);
            }catch(_){ }
          } else {
            // no i18n API: show a tiny info popup
            try{ window.closeLangMenu(); const menu = document.createElement('div'); menu.id = 'tn-lang-menu'; menu.style.position = 'absolute'; menu.style.background = 'linear-gradient(180deg,#111,#000)'; menu.style.border = '1px solid #222'; menu.style.borderRadius = '6px'; menu.style.padding = '8px'; menu.style.zIndex = 30000; menu.style.color = '#fff'; menu.style.minWidth = '160px'; const it = document.createElement('div'); it.style.padding='6px 8px'; it.style.color='#ccc'; it.textContent = 'No language packs available'; menu.appendChild(it); document.body.appendChild(menu);
              try{ const btn = document.getElementById('tn-lang-btn'); const rect = btn && btn.getBoundingClientRect(); if (rect){ menu.style.left = (rect.right + 6 + (window.scrollX||0)) + 'px'; menu.style.top = (rect.top + (window.scrollY||0)) + 'px'; menu.style.right = 'auto'; } else { menu.style.right = '12px'; menu.style.top = '120px'; } const mrect = menu.getBoundingClientRect(); if (rect && mrect.right > window.innerWidth){ const newLeft = rect.left - mrect.width - 6 + (window.scrollX||0); menu.style.left = newLeft + 'px'; menu.style.right = 'auto'; } }catch(_){ }
              setTimeout(()=>{ const onDoc = (ev)=>{ if (!menu.contains(ev.target)) { try{ menu.remove(); }catch(_){ } document.removeEventListener('pointerdown', onDoc); } }; document.addEventListener('pointerdown', onDoc); }, 10);
            }catch(_){ }
          }
        }catch(_){ }
  };
    }
  }catch(_){ }
  if (pauseBtn){ pauseBtn.onclick = ()=>{ paused = !paused; pauseBtn.textContent = paused ? t('resume') : t('pause'); pauseBtn.classList.toggle('toggled', paused); updateHud(); }; pauseBtn.classList.toggle('toggled', paused); }
    // sound
    try{
      let enabled = true;
      try{ const s = (localStorage && localStorage.getItem && localStorage.getItem('tn_sound_enabled')); if (s !== null) enabled = (s === '1' || s === 'true'); else if (SFX && typeof SFX.isEnabled === 'function') enabled = SFX.isEnabled(); }catch(_){ }
  if (soundBtn){ soundBtn.textContent = enabled ? t('sound_on') : t('sound_off'); soundBtn.classList.toggle('toggled', enabled); soundBtn.onclick = ()=>{ enabled = !enabled; try{ if (SFX && typeof SFX.setEnabled === 'function') SFX.setEnabled(enabled); }catch(_){ } try{ localStorage && localStorage.setItem && localStorage.setItem('tn_sound_enabled', enabled ? '1' : '0'); }catch(_){ } soundBtn.textContent = enabled ? t('sound_on') : t('sound_off'); soundBtn.classList.toggle('toggled', enabled); }; }
    }catch(_){ }
  // (keys toggle removed)
    // hook up controls modal opener
    try{
      const openBtn = document.getElementById('tn-open-controls');
      if (openBtn){ openBtn.onclick = ()=>{ try{ showControlsModal(); }catch(_){ } }; }
    }catch(_){ }
  }catch(_){ }
    // language chooser: open a small dropdown menu with available languages
    try{
      if (typeof window.setLang === 'function' && typeof window.getLang === 'function'){
        const langs = (window.__i18n && window.__i18n.languages) ? window.__i18n.languages : ['en'];
        // mapping of codes to display names (simple)
        const langNames = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' };
        function closeLangMenu(){ try{ const m = document.getElementById('tn-lang-menu'); if (m) m.remove(); }catch(_){ } }
  function openLangMenu(){ try{ try{ console.log('DEBUG: local openLangMenu called'); }catch(_){ } closeLangMenu(); const menu = document.createElement('div'); menu.id = 'tn-lang-menu'; menu.style.position = 'absolute'; menu.style.right = '12px'; menu.style.top = '120px'; menu.style.background = 'linear-gradient(180deg,#111,#000)'; menu.style.border = '1px solid #222'; menu.style.borderRadius = '6px'; menu.style.padding = '6px'; menu.style.zIndex = 30000; menu.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)'; menu.style.color = '#fff'; menu.style.minWidth = '140px';
            langs.forEach(code=>{ const it = document.createElement('div'); it.style.padding = '8px 10px'; it.style.cursor = 'pointer'; it.style.borderRadius = '4px'; it.style.fontWeight = '700'; it.textContent = (langNames[code] || code) + ' (' + code.toUpperCase() + ')'; it.onclick = ()=>{ try{ if (window.setLang(code)){ try{ updateHud(); }catch(_){ } try{ const titleEl = document.getElementById('tn-title'); if (titleEl) titleEl.innerHTML = `<div class="tn-logo">${t('tank_nutz')}</div><div class="tn-score">${t('score')}: ${score}</div>`; }catch(_){ } } closeLangMenu(); }catch(_){ } }; menu.appendChild(it); });
            document.body.appendChild(menu); // clicking outside should close
            setTimeout(()=>{ const onDoc = (ev)=>{ if (!menu.contains(ev.target)) { closeLangMenu(); document.removeEventListener('pointerdown', onDoc); } }; document.addEventListener('pointerdown', onDoc); }, 10);
        }catch(_){ } }
        if (langBtn){
          langBtn.textContent = (window.getLang() || 'en').toUpperCase();
          langBtn.onclick = ()=>{
            try{ console.log('DEBUG: tn-lang-btn onclick'); }catch(_){ }
            try{
              if (typeof window.openLangMenu === 'function') { try{ console.log('DEBUG: calling window.openLangMenu'); }catch(_){ } window.openLangMenu(); return; }
            }catch(_){ }
            try{ if (typeof openLangMenu === 'function') { try{ console.log('DEBUG: calling local openLangMenu'); }catch(_){ } openLangMenu(); } }catch(_){ }
          };
        }
      }
    }catch(_){ }
    // helper to refresh all visible localized text in one place
    function refreshLocalizedText(){ try{ // update hud (buttons, labels)
        try{ updateHud(); }catch(_){ }
        // update language button label
        try{ const lb = document.getElementById('tn-lang-btn'); if (lb) lb.textContent = (window.getLang() || 'en').toUpperCase(); }catch(_){ }
        // update persistent title block
        try{ const titleEl = document.getElementById('tn-title'); if (titleEl) titleEl.innerHTML = `<div class="tn-logo">${t('tank_nutz')}</div><div class="tn-score">${t('score')}: ${score}</div>`; }catch(_){ }
        // update journal/modal text if present
        try{ if (typeof updateJournal === 'function') updateJournal(); }catch(_){ }
        // update gameover modal
        try{ const go = document.getElementById('tn-gameover-inner'); if (go){ const h = go.querySelector('[id="tn-gameover-score"]'); try{ const title = go.querySelector('div'); if (title) title.innerHTML = t('you_died'); }catch(_){ } } }catch(_){ }
      }catch(_){ }
    }
    // react to language changes dispatched from i18n runtime
    try{ if (typeof window !== 'undefined' && typeof window.addEventListener === 'function'){ window.addEventListener('tn-lang-changed', (ev)=>{ try{ refreshLocalizedText(); }catch(_){ } }); } }catch(_){ }
    // create a separate bottom-right persistent title element
    let titleEl = document.getElementById('tn-title');
    if (!titleEl){ titleEl = document.createElement('div'); titleEl.id = 'tn-title'; titleEl.className = 'tn-title'; document.body.appendChild(titleEl); }
  titleEl.innerHTML = `<div class="tn-logo">${t('tank_nutz')}</div><div class="tn-score">${t('score')}: ${score}</div>`;
  }catch(_){ try{ hud.innerHTML = scoreHTML; }catch(__){} }

  // sync journal if available
  try{ updateJournal(); }catch(_){ }

  // wire pause and sound buttons (idempotent)
  try{
    const pauseBtn = document.getElementById('tn-pause-btn');
    const soundBtn = document.getElementById('tn-sound-btn');
    if (pauseBtn){
      pauseBtn.onclick = ()=>{ paused = !paused; pauseBtn.textContent = paused ? t('resume') : t('pause'); pauseBtn.classList.toggle('toggled', paused); updateHud(); };
      pauseBtn.textContent = paused ? t('resume') : t('pause');
      pauseBtn.classList.toggle('toggled', paused);
    }
    if (soundBtn){
      // reflect current preference from localStorage or SFX module
      const s = (localStorage && localStorage.getItem && localStorage.getItem('tn_sound_enabled'));
      let enabled = true;
      if (s !== null) enabled = s === '1' || s === 'true';
      else if (typeof SFX !== 'undefined' && SFX && typeof SFX.isEnabled === 'function') enabled = SFX.isEnabled();
  soundBtn.textContent = enabled ? t('sound_on') : t('sound_off');
      soundBtn.classList.toggle('toggled', enabled);
      soundBtn.onclick = ()=>{
        enabled = !enabled;
        try{ if (SFX && typeof SFX.setEnabled === 'function') SFX.setEnabled(enabled); }catch(_){ }
        try{ localStorage && localStorage.setItem && localStorage.setItem('tn_sound_enabled', enabled ? '1' : '0'); }catch(_){ }
  soundBtn.textContent = enabled ? t('sound_on') : t('sound_off');
        soundBtn.classList.toggle('toggled', enabled);
      };
    }
  // (keys toggle removed)
  }catch(_){ }
}

// Game over modal helpers
function showGameOverModal(sc){
  try{
    let m = document.getElementById('tn-gameover-modal');
    if (!m){
      m = document.createElement('div'); m.id = 'tn-gameover-modal';
      m.style.position = 'fixed'; m.style.left = '0'; m.style.top = '0'; m.style.width = '100%'; m.style.height = '100%'; m.style.display = 'flex'; m.style.alignItems = 'center'; m.style.justifyContent = 'center'; m.style.zIndex = 20000; m.style.pointerEvents = 'auto';
      const inner = document.createElement('div'); inner.id = 'tn-gameover-inner'; inner.style.background = 'linear-gradient(180deg,#221,#000)'; inner.style.padding = '20px 28px'; inner.style.border = '3px solid #111'; inner.style.borderRadius = '8px'; inner.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)'; inner.style.color = '#fff'; inner.style.textAlign = 'center';
  inner.innerHTML = `<div style="font-size:28px;font-weight:900;margin-bottom:6px">${t('you_died')}</div><div style="margin-bottom:12px">${t('score')}: <span id="tn-gameover-score">${sc}</span></div>`;
  const btn = document.createElement('button'); btn.textContent = t('restart'); btn.style.padding = '10px 14px'; btn.style.fontWeight = '800'; btn.style.borderRadius = '6px'; btn.style.cursor = 'pointer'; btn.onclick = ()=>{ try{ hideGameOverModal(); restart(); }catch(_){ } };
      inner.appendChild(btn);
      m.appendChild(inner);
      document.body.appendChild(m);
    } else {
  const scoreEl = document.getElementById('tn-gameover-score'); if (scoreEl) scoreEl.textContent = ''+sc; m.style.display = 'flex';
    }
  }catch(_){ }
}
function hideGameOverModal(){ try{ const m = document.getElementById('tn-gameover-modal'); if (m) m.style.display = 'none'; }catch(_){ } }

// Controls modal
function showControlsModal(){
  try{
    let m = document.getElementById('tn-controls-modal');
    if (!m){
      m = document.createElement('div'); m.id = 'tn-controls-modal'; m.className = 'tn-controls-modal';
      const backdrop = document.createElement('div'); backdrop.className = 'tn-controls-backdrop'; backdrop.onclick = hideControlsModal;
      const inner = document.createElement('div'); inner.className = 'tn-controls-inner';
  inner.innerHTML = `<div class="tn-controls-title">${t('controls_title')}</div>`;
      // helper to create rows
      function row(iconSvg, title, desc){ const r = document.createElement('div'); r.className='tn-control-row'; const ic = document.createElement('div'); ic.className='tn-control-icon'; ic.innerHTML = iconSvg; const lab = document.createElement('div'); lab.innerHTML = `<div class="tn-control-label" style="font-weight:800">${title}</div><div style="font-size:12px;color:#bbb">${desc}</div>`; r.appendChild(ic); r.appendChild(lab); return r; }
  // icons
  const mouseSvg = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#dfe" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="7"/><path d="M12 3v8"/></svg>`;
  const keyboardSvg = `<svg viewBox="0 0 96 64" width="56" height="36" fill="none" stroke="#dfe" stroke-width="2"><rect x="2" y="8" width="92" height="48" rx="6" fill="#0b0c0d" stroke="#2b2b2b"/><g fill="#dfe" font-size="10" font-family="monospace" text-anchor="middle"><rect x="44" y="10" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="48" y="15">W</text><rect x="36" y="22" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="40" y="27">A</text><rect x="44" y="22" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="48" y="27">S</text><rect x="52" y="22" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="56" y="27">D</text></g></svg>`;
  const gamepadSvg = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#dfe" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 10v4M6 12h4"/></svg>`;
  inner.appendChild(row(keyboardSvg, 'W A S D', t('move_desc') || 'Move (forward/left/back/right)'));
  inner.appendChild(row(mouseSvg, t('left_click') || 'Left-click', t('fire_weapon') || 'Fire weapon'));
  inner.appendChild(row(mouseSvg, t('right_click_hold'), t('pause_vertical_scrolling')));
  inner.appendChild(row(keyboardSvg, t('shift_hold') || 'Shift (hold)', t('accel_desc') || 'Accelerate (speed boost)'));
  inner.appendChild(row(keyboardSvg, t('keys_hint_label'), t('keys_hint_desc')));
  inner.appendChild(row(gamepadSvg, t('mouse_aim') || 'Mouse aim', t('mouse_aim_desc') || 'Aim with mouse or touch'));
      const close = document.createElement('button'); close.className='tn-controls-close'; close.textContent = t('close'); close.onclick = hideControlsModal; inner.appendChild(close);
      m.appendChild(backdrop); m.appendChild(inner); document.body.appendChild(m);
    }else{ m.style.display = 'flex'; }
  }catch(_){ }
}
function hideControlsModal(){ try{ const m = document.getElementById('tn-controls-modal'); if (m) m.style.display = 'none'; }catch(_){ } }

// --- Main loop (supports tank or heli when selected) ---
let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now-last)/1000); last = now;
  // process any scheduled respawns (foliage/buildings)
  try{ processRespawns(now); }catch(_){ }
  // occasionally spawn visible ospreys near the camera
  try{ maybeSpawnPeriodicOsprey(now); }catch(_){ }
  // update tank pieces even when paused so explosion animates
  if (tankPieces.length) updateTankPieces(dt);
  // if game over, freeze gameplay state: clear active gameplay arrays so movement/shooting/spawns stop
  // but allow explosion visuals (tankPieces, tankSparks, tankSmoke, gibs) to continue animating
  if (gameOver) {
    bullets.length = 0;
    enemyBullets.length = 0;
    enemies.length = 0;
    powerups.length = 0;
    // enforce paused state and deselect vehicle to prevent input-based actions
    paused = true;
    selectedVehicle = null;
  }

  // If game is over, render a frozen world but continue animating explosion visuals (gibs, tankPieces, sparks, smoke)
  if (gameOver) {
    // compute minimal shake values (difficultyFactor irrelevant when frozen)
    const effectiveShakeMag = screenShake.magnitude || 0;
    const shakeX = (screenShake.time > 0) ? ( (Math.random()*2-1) * effectiveShakeMag ) : 0;
    const shakeY = (screenShake.time > 0) ? ( (Math.random()*2-1) * effectiveShakeMag ) : 0;

    // draw static background (no foliage, critter, enemy, or spawn updates)
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,W,H);
    ctx.save(); ctx.translate(shakeX, shakeY);
  // draw foliage/grass backdrop using the foliage module (frozen world)
  // use a fixed 'now' time to keep animation static (but still draws baked grass)
  try{ drawFoliage(ctx, worldToScreen, camera); }catch(e){ /* if foliage module not ready, skip backdrop */ }

  // draw gibs and explosion visuals
  updateGibs(dt);
  drawGibs(ctx, worldToScreen, camera);
    if (tankPieces.length) drawTankPieces(ctx, worldToScreen, camera);
    if (tankSparks.length) updateTankSparks(dt);
    if (tankSmoke.length) updateTankSmoke(dt);
    if (tankSparks.length) drawTankSparks(ctx, worldToScreen, camera);
    if (tankSmoke.length) drawTankSmoke(ctx, worldToScreen, camera);

    ctx.restore();
    requestAnimationFrame(loop);
    return;
  }
  // convert mouse screen coords to world coords (camera from previous frame)
  const _mw = screenToWorld(mouse.x, mouse.y);
  const mouseWorldX = _mw.x;
  const mouseWorldY = _mw.y;

  // only respond to movement when a vehicle is selected
  if (!paused){
    // normal updates run only when not paused
    if (selectedVehicle === 'tank'){
    const turn = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0);
    tank.bodyAngle += turn * tank.rotSpeed * dt;
    const forward = (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0);
  // holding shift gives a speed boost; Fiesta gets a much larger boost
  const nowShift = keys.has('shift');
  // Default boost for regular tanks
  let speedBoost = nowShift ? 1.3 : 1.0;
  try{
    if (nowShift && selectedVehicleVariant === 'fordfiesta'){
      // make the Ford Fiesta much faster when shift is held
      speedBoost = 2.8; // "way faster" — tuned large multiplier
    }
  }catch(_){ }
  // SFX: start/stop shift hum when the key state changes (reuse nowShift)
  try{
    if (nowShift && !_sfxState.shiftActive){ _sfxState.shiftActive = true; if (SFX && typeof SFX.startShift === 'function') SFX.startShift(); }
    else if (!nowShift && _sfxState.shiftActive){ _sfxState.shiftActive = false; if (SFX && typeof SFX.stopShift === 'function') SFX.stopShift(); }
  }catch(_){ }
  if (forward !== 0){
    const prevX = tank.x, prevY = tank.y;
    tank.x += Math.cos(tank.bodyAngle) * tank.speed * speedBoost * forward * dt; tank.y += Math.sin(tank.bodyAngle) * tank.speed * speedBoost * forward * dt;
    // spawn dust when using shift boost and actually moving (throttle by timer)
    if (speedBoost > 1.01){
      tank._dustTimer = (tank._dustTimer || 0) - dt;
      if (tank._dustTimer <= 0){ spawnTankDust(tank.x - Math.cos(tank.bodyAngle)*8, tank.y - Math.sin(tank.bodyAngle)*8, 6); tank._dustTimer = 0.08; }
    }
  }
  try{ const _spriteW = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W; tank.x = clamp(tank.x, _spriteW*effectiveTankScale()*0.5, WORLD_W - _spriteW*effectiveTankScale()*0.5); }catch(_){ tank.x = clamp(tank.x, SPR_W*effectiveTankScale()*0.5, WORLD_W - SPR_W*effectiveTankScale()*0.5); }
  // allow tank to move freely in world but it will get pushed by the scrolling camera
  tank.y = mod(tank.y, WORLD_H);
    // Tank run-over collision with large foliage (trees)
    try{
      // foliageInstances and foliageTiles are exported by foliage module
      if (typeof foliageInstances !== 'undefined' && foliageInstances && foliageInstances.length){
        for (let fi = foliageInstances.length - 1; fi >= 0; fi--){
          const f = foliageInstances[fi];
          // treat baseline of foliage as f.y; use scaled radius from TILE_PX*scale*0.5
          const r = (96 * Math.max(1, f.scale || 1)) * 0.42; // approximate collision radius
          const dx = f.x - tank.x, dy = wrapDeltaY(f.y, tank.y);
          if (Math.hypot(dx,dy) < r && f.destructible){
            // if tile corresponds to one of the jungle tree makers (we appended them last)
            const tile = (typeof foliageTiles !== 'undefined') ? foliageTiles[f.idx] : null;
            if (tile && tile.c){
              // spawn image-fragment gibs by slicing tile canvas into logical pieces
              try{
                const src = tile.c;
                const w = Math.min(96, src.width|0), h = Math.min(96, src.height|0);
                // create 6-12 fragments: sample rectangular fragments
                const pieces = Math.floor(6 + Math.random()*8);
                for (let p=0;p<pieces;p++){
                  const pw = 6 + Math.floor(Math.random()*18);
                  const ph = 6 + Math.floor(Math.random()*18);
                  const sx = Math.max(0, Math.floor(Math.random()*(w - pw))); const sy = Math.max(0, Math.floor(Math.random()*(h - ph)));
                  const worldX = f.x + (sx - w/2) * (f.scale || 1);
                  const worldY = f.y + (sy - h/2) * (f.scale || 1);
                  // push image fragment into shared gibs array (moduleGibs bound in this file)
                  try{ moduleGibs.push({ src, sx, sy, sw: pw, sh: ph, x: worldX, y: worldY, vx: (Math.random()-0.5)*220, vy: -80 + Math.random()*220, rot: (Math.random()-0.5)*2, vr: (Math.random()-0.5)*6, life: 1.2 + Math.random()*1.2, gravity: 160, scale: f.scale || 1 }); }catch(_){ try{ callSpawnGibs(f.x, f.y, '#8adf76', 18, 'foliage-frag-fallback'); }catch(_){ } }
                }
              }catch(_){ try{ callSpawnGibs(f.x, f.y, '#8adf76', 12, 'foliage-frag-err'); }catch(_){ } }
            } else {
              // fallback to simple colored gibs
              try{ callSpawnGibs(f.x, f.y, '#8adf76', 12, 'foliage-basic'); }catch(_){ }
            }
            // debug log for verification
            try{ if (typeof console !== 'undefined') console.log('tank hit tree at', Math.round(f.x), Math.round(f.y), 'tileIdx=', f.idx); }catch(_){}
            // schedule respawn instead of permanently removing the foliage
            try{ scheduleRespawn('foliage', f, 5000); }catch(_){ }
            foliageInstances.splice(fi,1);
            // visuals
            try{ triggerTankBump(10, 0.18); }catch(_){ }
            try{ triggerScreenShake(10, 0.14); }catch(_){ }
            break; // only hit one per frame
          }
        }
      }
      // tank run-over: damage nearby billboards
      try{
        for (let bi = 0; bi < billboardInstances.length; bi++){
          const bb = billboardInstances[bi];
          if (bb.broken) continue;
          const r = 32 * Math.max(bb.scaleX || 1, bb.scaleY || 1);
          const dx = bb.x - tank.x;
          const dy = wrapDeltaY(bb.y, tank.y);
          if (Math.hypot(dx,dy) < r){
            bb.hp = (bb.hp||3) - 1;
            if (bb.hp <= 0){
              startBillboardExplode(bb, tank.x, tank.y);
              // chance to drop heal powerup
              spawnBillboardDrop(bb);
            } else {
              try{ triggerScreenShake(4, 0.06); }catch(_){ }
            }
            break;
          }
        }
      }catch(_){ }
    }catch(_){ }
  const dx = mouseWorldX - tank.x; const dy = wrapDeltaY(mouseWorldY, tank.y); tank.turretAngle = Math.atan2(dy, dx);
  } else if (selectedVehicle === 'heli'){
    const turn = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0);
    heli.bodyAngle += turn * heli.rotSpeed * dt;
    const forward = (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0);
    if (forward !== 0){ heli.x += Math.cos(heli.bodyAngle) * heli.speed * forward * dt; heli.y += Math.sin(heli.bodyAngle) * heli.speed * forward * dt; }
  // heli also respects shift boost
  const heliBoost = keys.has('shift') ? 1.3 : 1.0;
    if (forward !== 0){ heli.x += Math.cos(heli.bodyAngle) * heli.speed * heliBoost * forward * dt; heli.y += Math.sin(heli.bodyAngle) * heli.speed * heliBoost * forward * dt; }
    // heli run-over: destroy nearby destructible foliage
    try{
      if (typeof foliageInstances !== 'undefined' && foliageInstances && foliageInstances.length){
  for (let fi = foliageInstances.length - 1; fi >= 0; fi--){ const f = foliageInstances[fi]; // smaller collider for trees so hits match the crown
const r = (f.isTree) ? ((64 * Math.max(1, f.scale || 1)) * 0.42) : ((96 * Math.max(1, f.scale || 1)) * 0.46); const dx = f.x - heli.x, dy = wrapDeltaY(f.y, heli.y); if (Math.hypot(dx,dy) < r && f.destructible){ const tile = (typeof foliageTiles !== 'undefined') ? foliageTiles[f.idx] : null; if (tile && tile.c){ try{ const src = tile.c; const w = Math.min(96, src.width|0), h = Math.min(96, src.height|0); const pieces = Math.floor(6 + Math.random()*8); for (let p=0;p<pieces;p++){ const pw = 6 + Math.floor(Math.random()*18); const ph = 6 + Math.floor(Math.random()*18); const sx = Math.max(0, Math.floor(Math.random()*(w - pw))); const sy = Math.max(0, Math.floor(Math.random()*(h - ph))); const worldX = f.x + (sx - w/2) * (f.scale || 1); const worldY = f.y + (sy - h/2) * (f.scale || 1); try{ moduleGibs.push({ src, sx, sy, sw: pw, sh: ph, x: worldX, y: worldY, vx: (Math.random()-0.5)*220, vy: -80 + Math.random()*220, rot: (Math.random()-0.5)*2, vr: (Math.random()-0.5)*6, life: 1.2 + Math.random()*1.2, gravity: 160, scale: f.scale || 1 }); }catch(_){ callSpawnGibs(f.x, f.y, '#8adf76', 12, 'foliage-frag-fallback'); } } }catch(_){ callSpawnGibs(f.x, f.y, '#8adf76', 12, 'foliage-frag-err'); } } else { try{ callSpawnGibs(f.x, f.y, '#8adf76', 12, 'foliage-basic'); }catch(_){ } } foliageInstances.splice(fi,1); try{ triggerScreenShake(8, 0.12); }catch(_){ } break; } }
      }
    }catch(_){ }
const r = (H_SPR_W * H_SCALE) * 0.5 + 6;
heli.x = clamp(heli.x, r, WORLD_W - r); heli.y = clamp(heli.y, r, WORLD_H - r);
const dx = mouseWorldX - heli.x, dy = mouseWorldY - heli.y; heli.turretAngle = Math.atan2(dy, dx);
    // rotor spin
    const rpmBoost = 3 * Math.abs((keys.has('w')?1:0) - (keys.has('s')?1:0));
    heli.rotorSpin += (heli.rpm + rpmBoost) * dt; heli.tailSpin += (heli.tailRpm + rpmBoost*2) * dt;
  }

    // shooting (space) always allowed if selected
    if (selectedVehicle && keys.has(' ')){ fireBullet(); }

  // difficulty scaling: reduce spawn interval over time and with score
  const elapsed = now; // ms
  const difficultyFactor = Math.min(1, elapsed * DIFFICULTY_ACCEL + Math.max(0, score * 0.002));
  const spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE * (1 - difficultyFactor));

  // advance vertical camera scroll (reversed direction) and make scroll speed increase slowly with difficulty
  const scrollSpeedScaled = SCROLL_SPEED * (1 + difficultyFactor * 0.35);
  if (!rightClickHoldScroll){
    cameraScrollY -= scrollSpeedScaled * dt;
    cameraScrollY = mod(cameraScrollY, WORLD_H);
  }

  // update bullets (world coords)
  for (let i = bullets.length-1; i >= 0; i--){
  const b = bullets[i];
  b.x += b.dx * dt; b.y += b.dy * dt; b.life -= dt;
  // wrap vertical position
  b.y = mod(b.y, WORLD_H);
  // player bullets: blocked by Dozer shield if active
  try{
    if (selectedVehicle === 'tank' && selectedVehicleVariant === 'dozer' && dozerShieldIntersects(b.x, b.y)){
      bullets.splice(i,1);
      try{ callSpawnGibs(b.x, b.y, '#ffd54f', 6, 'shield-block'); }catch(_){ }
      try{ triggerTankBump(6, 0.12); }catch(_){ }
      continue;
    }
  }catch(_){ }
  let removed = false;
  // 1) collide with enemies
  for (let ei = enemies.length-1; ei >= 0; ei--) {
    const e = enemies[ei];
    const dy = wrapDeltaY(e.y, b.y); const dx = e.x - b.x;
    const dist = Math.hypot(dx, dy);
  if (dist < (e.r + 2)){
      // hit
  bullets.splice(i,1);
  try{ callSpawnGibs(b.x, b.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ }
      removed = true;
  if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless>'), e); }catch(_){ } score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 8, 'enemy-hit-harmless'); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } if (Math.random() < 0.2) spawnPowerup(e.x, e.y, 'double'); }
      else if (e.type === 'jungle' || e.type === 'animal'){
        e.hp = (e.hp||1) - 1;
  if (e.hp <= 0){ enemies.splice(ei,1); score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 12, 'enemy-killed-by-bullet'); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } if (Math.random() < 0.2) spawnPowerup(e.x, e.y, 'double'); }
  if (e.hp <= 0){ try{ recordDeath(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ } try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ } }
  } else {
          // osprey: spawn logical osprey gibs
          if (e.type === 'osprey'){
            enemies.splice(ei,1);
            try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ }
            try{ recordDeath(e.kind || '<osprey-killed>', e); }catch(_){}
            try{ recordKill(e.kind || '<osprey-killed>', e); }catch(_){}
            score += 1; updateHud();
            try{ spawnOspreyGibs(e.x, e.y, e); }catch(_){ callSpawnGibs(e.x, e.y, '#b0c7cf', 18, 'osprey-fallback'); }
            // Always drop the journal powerup on osprey death to make it reliable
            try{ spawnJournalPowerup(e.x, e.y, 'collect-peanut'); }catch(_){ }
            if (Math.random() < 0.2) spawnPowerup(e.x, e.y, 'double');
          } else {
            enemies.splice(ei,1); try{ recordDeath(e.kind || '<default-killed>', e); }catch(_){ } try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<default-killed>'), e); }catch(_){ } score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 10, 'enemy-default-killed'); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } if (Math.random() < 0.2) spawnPowerup(e.x, e.y, 'double');
          }
        }
      break;
    }
  }
  if (removed) continue;
  // 2) collide with critters
  for (let ci = critters.length-1; ci >= 0; ci--){ const c = critters[ci]; if (!c.alive) continue; const dy = wrapDeltaY(c.y, b.y); const dx = c.x - b.x; if (Math.hypot(dx,dy) < 12){ bullets.splice(i,1); try{ callSpawnGibs(b.x, b.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ } removed = true; c.alive = false; callSpawnGibs(c.x, c.y, '#ff8b6b', 10, 'critter-shot'); try{ recordDeath(c.kind || ('critter-' + (c.spriteIdx !== undefined ? c.spriteIdx : '<unknown>')), c); }catch(_){ } try{ recordKill(c.kind || ('critter-' + (c.spriteIdx !== undefined ? c.spriteIdx : '<unknown>')), c); }catch(_){ } score += 1; updateHud(); break; } }
  // track critter kills in recent-death log
  // critter bullet kills are recorded at the kill site to avoid duplicate logs
  if (removed) continue;
  // 3) collide with buildings (axis-aligned box centered at b.x/b.y, size 64*scale)
  for (let bi = 0; bi < buildingInstances.length; bi++){ const B = buildingInstances[bi]; const bx = B.x, by = B.y; const scale = B.scale || 1; const half = 32 * scale; const dy = wrapDeltaY(by, b.y); const dx = bx - b.x; if (Math.abs(dx) <= half && Math.abs(dy) <= half){ bullets.splice(i,1); removed = true; // impact effect
  // decrement hp; only break into fragments when hp falls to zero
  B.hp = (B.hp||10) - 1;
  try{ spawnMuzzleFlash(B.x, B.y, 0); }catch(_){ }
  if (B.hp <= 0){
    try{
      const tile = (typeof buildingTiles !== 'undefined') ? buildingTiles[B.idx] : null;
      if (tile && tile.c){ const src = tile.c; const w = Math.min(64, src.width|0), h = Math.min(64, src.height|0); const pieces = 8 + Math.floor(Math.random()*10); for (let p=0;p<pieces;p++){ const pw = 6 + Math.floor(Math.random()*26); const ph = 6 + Math.floor(Math.random()*26); const sx = Math.max(0, Math.floor(Math.random()*(w - pw))); const sy = Math.max(0, Math.floor(Math.random()*(h - ph))); const worldX = B.x + (sx - w/2) * (B.scale || 1); const worldY = B.y + (sy - h/2) * (B.scale || 1); try{ moduleGibs.push({ src, sx, sy, sw: pw, sh: ph, x: worldX, y: worldY, vx: (Math.random()-0.5)*260, vy: -80 + Math.random()*260, rot: (Math.random()-0.5)*2, vr: (Math.random()-0.5)*6, life: 1.6 + Math.random()*1.8, gravity: 160, scale: B.scale || 1 }); }catch(_){ callSpawnGibs(B.x, B.y, '#ffd1e8', 20, 'building-frag-fallback'); } }
      } else { callSpawnGibs(B.x, B.y, '#ffd1e8', 18, 'building-basic'); }
    }catch(_){ try{ callSpawnGibs(B.x, B.y, '#ffd1e8', 18, 'building-frag-err'); }catch(_){ } }
  // schedule building respawn after delay and remove instance
  try{ scheduleRespawn('building', B, 5000); }catch(_){ }
  buildingInstances.splice(bi,1);
    try{ triggerScreenShake(18, 0.26); }catch(_){ }
  }
  break; } }
  if (removed) continue;
  // 4) collide with foliage (projectiles can hit any destructible foliage/tree)
  if (typeof foliageInstances !== 'undefined' && foliageInstances && foliageInstances.length){
  for (let fi = foliageInstances.length - 1; fi >= 0; fi--){ const f = foliageInstances[fi]; if (!f.destructible) continue; const r = (f.isTree) ? ((64 * Math.max(1, f.scale || 1)) * 0.42) : ((96 * Math.max(1, f.scale || 1)) * 0.46); let dy = f.y - b.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = f.x - b.x; if (Math.hypot(dx,dy) < r){ // hit foliage
        bullets.splice(i,1); removed = true; try{ handleFoliageHit(fi, b.x, b.y, '#8adf76'); }catch(_){ } break; } }
  }
  // remove if out of bounds or life expired
  if (b.life <= 0 || b.x < -200 || b.x > WORLD_W+200 || b.y < -200 || b.y > WORLD_H+200) bullets.splice(i,1);
}

    // update enemy bullets
    for (let i = enemyBullets.length-1; i >= 0; i--){ const eb = enemyBullets[i]; eb.x += eb.dx * dt; eb.y += eb.dy * dt; eb.life -= dt; if (eb.life <= 0 || eb.x < -200 || eb.x > WORLD_W+200 || eb.y < -200 || eb.y > WORLD_H+200) { enemyBullets.splice(i,1); continue; }
      // collision with player vehicle
  if (selectedVehicle){ const px = (selectedVehicle === 'heli') ? heli.x : tank.x; const py = (selectedVehicle === 'heli') ? heli.y : tank.y; const dist = Math.hypot(eb.x - px, eb.y - py); if (dist < (eb.hitR || 8)) { enemyBullets.splice(i,1); try{ callSpawnGibs(eb.x, eb.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ } health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } } } }
      // Enemy bullets: deflect off animals, buildings, and trees; smaller foliage still takes damage
  try{
    let handled = false;

    // 1) deflect off animals/enemies (treat animals as obstacles)
    // Dozer shield: if active and enemy bullet intersects, consume bullet and apply knock
    try{
      if (!handled && selectedVehicle === 'tank' && selectedVehicleVariant === 'dozer'){
        if (dozerShieldIntersects(eb.x, eb.y)){
          enemyBullets.splice(i,1);
          try{ callSpawnGibs(eb.x, eb.y, '#fff', 6, 'shield-block'); }catch(_){ }
          try{ triggerTankBump(8, 0.18); }catch(_){ }
          handled = true;
        }
      }
    }catch(_){ }

    for (let ei = enemies.length-1; ei >= 0 && !handled; ei--){
      try{
        const en = enemies[ei];
        if (!en) continue;
        // only consider world obstacles (animals/jungle) — skip active hostile logic
        if (en.type !== 'animal' && en.type !== 'jungle') continue;
        const dy = wrapDeltaY(en.y, eb.y); const dx = en.x - eb.x; const dist = Math.hypot(dx, dy);
        const hitR = (en.r || 18) + (eb.hitR || 8);
        if (dist < hitR){
          // reflect bullet velocity about normal from obstacle center to bullet
          const nx = (eb.x - en.x) / (dist || 1);
          const ny = (eb.y - en.y) / (dist || 1);
          const vdot = eb.dx * nx + eb.dy * ny;
          eb.dx = eb.dx - 2 * vdot * nx;
          eb.dy = eb.dy - 2 * vdot * ny;
          // preserve speed but damp slightly
          const spd = Math.hypot(eb.dx, eb.dy) || 1;
          const targetSpd = (eb.spd || spd);
          eb.dx = (eb.dx / spd) * targetSpd * 0.92;
          eb.dy = (eb.dy / spd) * targetSpd * 0.92;
          // nudge outside the obstacle so it doesn't immediately recollide
          eb.x = en.x + (hitR + 1) * nx;
          eb.y = en.y + (hitR + 1) * ny;
          try{ callSpawnGibs(eb.x, eb.y, '#fff', 4, 'projectile-deflect-animal'); }catch(_){ }
          handled = true; break;
        }
      }catch(_){ }
    }

    if (!handled){
  // 2) deflect off buildings (approximate normal from nearest rect edge)
      for (let bi = 0; bi < buildingInstances.length && !handled; bi++){
        try{
          const B = buildingInstances[bi]; const bx = B.x, by = B.y; const scale = B.scale || 1; const half = 32 * scale;
          const dx = eb.x - bx; const dy = wrapDeltaY(by, eb.y);
          // nearest point on AABB to bullet
          const nxp = Math.max(-half, Math.min(half, dx));
          const nyp = Math.max(-half, Math.min(half, dy));
          const nearestX = bx + nxp;
          const nearestY = by + nyp;
          const ndx = eb.x - nearestX; const ndy = eb.y - nearestY;
          const ndist = Math.hypot(ndx, ndy);
          if (ndist < (eb.hitR || 8) + 2){
            // normal from nearest point to bullet
            const nx = ndx / (ndist || 1); const ny = ndy / (ndist || 1);
            const vdot = eb.dx * nx + eb.dy * ny;
            eb.dx = eb.dx - 2 * vdot * nx;
            eb.dy = eb.dy - 2 * vdot * ny;
            const spd = Math.hypot(eb.dx, eb.dy) || 1;
            const targetSpd = (eb.spd || spd);
            eb.dx = (eb.dx / spd) * targetSpd * 0.88;
            eb.dy = (eb.dy / spd) * targetSpd * 0.88;
            // nudge outside
            eb.x = nearestX + ( (eb.hitR || 8) + 1) * nx;
            eb.y = nearestY + ( (eb.hitR || 8) + 1) * ny;
            try{ callSpawnGibs(eb.x, eb.y, '#ffd1e8', 6, 'projectile-deflect-building'); }catch(_){ }
            handled = true; break;
          }
        }catch(_){ }
      }
      // 2b) deflect off billboards/signs (billboardInstances provided by billboard.js)
      if (!handled && typeof billboardInstances !== 'undefined' && billboardInstances && billboardInstances.length){
        for (let bbi = 0; bbi < billboardInstances.length && !handled; bbi++){
          try{
            const bb = billboardInstances[bbi]; if (!bb || bb.broken) continue;
            const bx = bb.x, by = bb.y; const halfW = (32 * (bb.scaleX || 1)); const halfH = (32 * (bb.scaleY || 1));
            const dx = eb.x - bx; const dy = wrapDeltaY(by, eb.y);
            const nxp = Math.max(-halfW, Math.min(halfW, dx));
            const nyp = Math.max(-halfH, Math.min(halfH, dy));
            const nearestX = bx + nxp; const nearestY = by + nyp;
            const ndx = eb.x - nearestX; const ndy = eb.y - nearestY; const ndist = Math.hypot(ndx, ndy);
            if (ndist < (eb.hitR || 8) + 2){
              const nx = ndx / (ndist || 1); const ny = ndy / (ndist || 1);
              const vdot = eb.dx * nx + eb.dy * ny;
              eb.dx = eb.dx - 2 * vdot * nx; eb.dy = eb.dy - 2 * vdot * ny;
              const spd = Math.hypot(eb.dx, eb.dy) || 1; const targetSpd = (eb.spd || spd);
              eb.dx = (eb.dx / spd) * targetSpd * 0.86; eb.dy = (eb.dy / spd) * targetSpd * 0.86;
              eb.x = nearestX + ((eb.hitR || 8) + 1) * nx; eb.y = nearestY + ((eb.hitR || 8) + 1) * ny;
              try{ callSpawnGibs(eb.x, eb.y, '#ffd1e8', 6, 'projectile-deflect-billboard'); }catch(_){ }
              handled = true; break;
            }
          }catch(_){ }
        }
      }
    }

    if (!handled && typeof foliageInstances !== 'undefined' && foliageInstances && foliageInstances.length){
      // 3) foliage — trees deflect, small plants take damage
      for (let fi = foliageInstances.length - 1; fi >= 0; fi--){
        try{
          const f = foliageInstances[fi]; if (!f.destructible) continue; const r = (f.isTree) ? ((64 * Math.max(1, f.scale || 1)) * 0.42) : ((96 * Math.max(1, f.scale || 1)) * 0.46); let dy = f.y - eb.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = f.x - eb.x; const dist = Math.hypot(dx,dy);
          if (dist < r){
            if (f.isTree){
              // deflect off tree crown
              const nx = (eb.x - f.x) / (dist || 1);
              const ny = (eb.y - f.y) / (dist || 1);
              const vdot = eb.dx * nx + eb.dy * ny;
              eb.dx = eb.dx - 2 * vdot * nx;
              eb.dy = eb.dy - 2 * vdot * ny;
              const spd = Math.hypot(eb.dx, eb.dy) || 1;
              const targetSpd = (eb.spd || spd);
              eb.dx = (eb.dx / spd) * targetSpd * 0.9;
              eb.dy = (eb.dy / spd) * targetSpd * 0.9;
              eb.x = f.x + (r + 1) * nx; eb.y = f.y + (r + 1) * ny;
              try{ callSpawnGibs(eb.x, eb.y, '#8adf76', 4, 'projectile-deflect-tree'); }catch(_){ }
              handled = true; break;
            } else {
              // non-tree foliage: destroy/hit as before
              enemyBullets.splice(i,1);
              try{ handleFoliageHit(fi, eb.x, eb.y, '#8adf76'); }catch(_){ }
              handled = true; break;
            }
          }
        }catch(_){ }
      }
    }

    if (handled) { if (handled) continue; }
  }catch(_){ }

    // update kitten-specific bullets separately so they can use unique animation and not affect other projectiles
    for (let i = kittenBullets.length-1; i >= 0; i--){ const kb = kittenBullets[i]; kb.x += kb.dx * dt; kb.y += kb.dy * dt; kb.life -= dt; if (kb.life <= 0 || kb.x < -200 || kb.x > WORLD_W+200 || kb.y < -200 || kb.y > WORLD_H+200) { kittenBullets.splice(i,1); continue; }
  if (selectedVehicle){ const px = (selectedVehicle === 'heli') ? heli.x : tank.x; const py = (selectedVehicle === 'heli') ? heli.y : tank.y; const dist = Math.hypot(kb.x - px, kb.y - py); if (dist < (kb.hitR || 6)) { kittenBullets.splice(i,1); try{ callSpawnGibs(kb.x, kb.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ } health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } } } }
  // kitten bullets can hit foliage too
  if (typeof foliageInstances !== 'undefined' && foliageInstances && foliageInstances.length){
  for (let fi = foliageInstances.length - 1; fi >= 0; fi--){ const f = foliageInstances[fi]; if (!f.destructible) continue; const r = (f.isTree) ? ((64 * Math.max(1, f.scale || 1)) * 0.42) : ((96 * Math.max(1, f.scale || 1)) * 0.46); let dy = f.y - kb.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = f.x - kb.x; if (Math.hypot(dx,dy) < r){ kittenBullets.splice(i,1); try{ handleFoliageHit(fi, kb.x, kb.y, '#8adf76'); }catch(_){ } break; } }
  }
    }
    }

    // update casings (physics + lifetime)
    for (let ci = casings.length-1; ci >= 0; ci--){ const c = casings[ci]; // simple ballistic physics
      c.vy += 380 * dt; // gravity
      c.vx *= 0.995; // air drag
      c.x += c.vx * dt; c.y += c.vy * dt; c.life -= dt;
      if (c.life <= 0 || c.x < -200 || c.x > WORLD_W+200 || c.y > WORLD_H + 400) { casings.splice(ci,1); continue; }
    }

    // wrap bullets vertically for endless world
    for (const b of bullets){ b.y = mod(b.y, WORLD_H); }
    for (const eb of enemyBullets){ eb.y = mod(eb.y, WORLD_H); }

  // spawn enemies with dynamic interval
  if (!gameOver && now - lastSpawn > spawnInterval){ lastSpawn = now; spawnEnemy(); }

  // update enemies (they target the selected vehicle; fallback to tank)
  // helper: chance to drop one of three collect items from certain enemies
  function doEnemyHeartDrops(e, x, y){
    try{
      if (!e || !e.kind) return;
      if (!(e.kind === 'kraken' || e.kind === 'squidrobot')) return;
      if (Math.random() < 0.5){ // 50% chance
        const picks = ['collect-saw','collect-peanut','collect-crescent'];
        const pick = picks[Math.floor(Math.random() * picks.length)];
        try{ spawnHeartPowerup(x || e.x, y || e.y, 'collect', pick); }catch(_){ }
      }
    }catch(_){ }
  }
    const targetX = (selectedVehicle === 'heli') ? heli.x : tank.x;
    const targetY = (selectedVehicle === 'heli') ? heli.y : tank.y;
    for (let ei = enemies.length-1; ei >= 0; ei--){ const e = enemies[ei];
  // compute angle: animals should wander (not seek the player), other enemies target the selected vehicle
  let ang;
  if (e.type === 'animal'){
    // initialize angle if missing
    if (typeof e.angle !== 'number') e.angle = Math.random() * Math.PI * 2;
    // occasional random nudge so animals wander naturally
    if (!e._nextWander || now > e._nextWander){
      e._nextWander = now + 600 + Math.random() * 1200;
      e.angle += (Math.random() - 0.5) * 1.2; // small turn
    }
    ang = e.angle;
  } else {
  // compute angle using wrap-aware shortest vertical delta
  let dy = targetY - e.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H;
  ang = Math.atan2(dy, targetX - e.x);
  }
  // jungle-specific behavior
  if (e.type === 'jungle'){
      e.angle = ang;
      const nowt = now;
      // guide dashes
      if (e.kind === 'guide'){
        // dash toward player occasionally
        if (nowt > e.lastAttack + e.attackCD && Math.hypot(targetX - e.x, targetY - e.y) < 220){ e.lastAttack = nowt; e.dashUntil = nowt + 420; }
  const isDashing = nowt < e.dashUntil;
  const sp = e.spd * (isDashing ? 2.2 : 1.0);
  const mvx = Math.cos(ang) * sp * dt, mvy = Math.sin(ang) * sp * dt;
  e.x += mvx; e.y += mvy; e.moving = Math.hypot(mvx, mvy) > 0.1;
  // wrap vertically to keep enemies in the endless loop
  e.y = mod(e.y, WORLD_H);
  if (e.x < 0) e.x += WORLD_W; if (e.x > WORLD_W) e.x -= WORLD_W;
  e.vx = mvx / Math.max(dt, 1e-6); e.vy = mvy / Math.max(dt, 1e-6);
      } else {
        // normal move
  const mvx = Math.cos(ang) * e.spd * dt, mvy = Math.sin(ang) * e.spd * dt;
  e.x += mvx; e.y += mvy; e.moving = Math.hypot(mvx, mvy) > 0.1;
  e.vx = mvx / Math.max(dt, 1e-6); e.vy = mvy / Math.max(dt, 1e-6);
        // ranged attack for armed kinds
  if (now > e.lastAttack + e.attackCD){ const dist = Math.hypot(targetX - e.x, targetY - e.y);
          let shoot=false, spdB=220, hitR=8;
          if (e.kind === 'commando' || e.kind === 'heavy'){ if (dist < 420) shoot=true, spdB=320, hitR=8; }
          else if (e.kind === 'scout'){ if (dist < 340) shoot=true, spdB=260, hitR=7; }
          else if (e.kind === 'medic' || e.kind === 'radioop' || e.kind === 'villager1' || e.kind === 'villager2'){ if (dist < 280) shoot=true, spdB=200, hitR=6; }
          else if (e.kind === 'squidrobot'){ if (dist < 420) shoot=true, spdB=160, hitR=8; }
          else if (e.kind === 'pinkdot'){ // kitten enemy: use medium range, very slow projectile speed, larger visible hit radius
            if (dist < 360) shoot = true, spdB = 9, hitR = 12; // sped up slightly to ~9 px/s
          }
              if (shoot){ e.lastAttack = now; // use turretAngle if squidrobot to shoot from rotating turret
            const shootA = (e.kind === 'squidrobot') ? (e.turretAngle || ang) : ang;
            try{ if (e.kind === 'pinkdot' || e.kind === 'squidrobot'){ e.turretAngle = shootA; } }catch(_){ }
            const dx = Math.cos(shootA)*spdB, dy = Math.sin(shootA)*spdB;
            // If squidrobot, compute muzzle origin based on the baked turret's local offset
            if (e.kind === 'squidrobot'){
              // spawn a circular burst of bullets around the robot
              const turretCenterOffset = (CHAR_TILE_PX * 0.78 - 1) - (CHAR_TILE_PX/2);
              const barrelLen = 14;
              const count = 12; // number of bullets in the ring
              // small random rotation so multiple robots don't always align perfectly
              const baseRot = (Math.random()-0.5) * 0.6;
              for (let k=0;k<count;k++){
                const a = baseRot + (k * Math.PI*2 / count);
                const dxk = Math.cos(a) * spdB, dyk = Math.sin(a) * spdB;
                const muzzleX = -turretCenterOffset * Math.sin(a) + Math.cos(a) * barrelLen;
                const muzzleY = turretCenterOffset * Math.cos(a) + Math.sin(a) * barrelLen;
                const bx = e.x + muzzleX; const by = e.y + muzzleY;
                enemyBullets.push({ x: bx, y: by, dx: dxk, dy: dyk, life: 3.0, hitR });
              }
              // central muzzle flash for the burst
              spawnMuzzleFlash(e.x, e.y, shootA);
              try{ if (SFX && typeof SFX.playCannonBlast === 'function') SFX.playCannonBlast(); }catch(_){ }
            } else {
              // If this entity is a chained-heavy variant (the chained-tank
              // module will spawn its own muzzles from hull barrels), skip
              // the engine's central bullet and let the module handle all
              // projectile spawns. Still spawn a small central flash for
              // visual parity if desired.
              const isChained = (e && e._alt && e._alt.kindOrig === 'chained-heavy');
              if (isChained){
                // chained-heavy handles its own projectile spawns in alternativetanks; only draw a flash here
                try{ spawnMuzzleFlash(e.x, e.y, shootA); }catch(_){ }
              } else {
                const bx = e.x + Math.cos(shootA)*14, by = e.y + Math.sin(shootA)*14;
                // Route kitten (pinkdot) shots into kittenBullets so they are isolated
                if (e.kind === 'pinkdot'){
                  // give kitten bullets a slightly smaller hit radius and distinct life
                  try{
                    // avoid spawning the bullet inside the player: nudge muzzle origin out if necessary
                    let muzzleOff = 14;
                    try{
                      const px = (selectedVehicle === 'heli') ? heli.x : tank.x;
                      const py = (selectedVehicle === 'heli') ? heli.y : tank.y;
                      const distToPlayer = Math.hypot(e.x - px, e.y - py);
                      const minSafe = (tank && tank.r ? tank.r : 14) + (hitR || 6) + 4;
                      if (distToPlayer < minSafe) muzzleOff = minSafe; // push spawn outside player radius
                    }catch(_){ }
                    const bx2 = e.x + Math.cos(shootA) * muzzleOff;
                    const by2 = e.y + Math.sin(shootA) * muzzleOff;
                    // Recompute velocities explicitly from spdB so kitten speed matches other enemies
                    const kdx = Math.cos(shootA) * spdB;
                    const kdy = Math.sin(shootA) * spdB;
                    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    kittenBullets.push({ x: bx2, y: by2, dx: kdx, dy: kdy, life: 60.0, hitR: (hitR || 6), anim: true, t0 });
                    if (typeof window !== 'undefined' && window.__DEBUG_KITTEN) try{ console.log('kitten-shot', { ex: e.x, ey: e.y, bx: bx2, by: by2, kdx, kdy, muzzleOff }); }catch(_){ }
                  }catch(_){ kittenBullets.push({ x: bx, y: by, dx, dy, life: 60.0, hitR: (hitR || 6), anim: true }); }
                    try{ spawnMuzzleFlash(bx, by, shootA); }catch(_){ }
                    try{ if (SFX && typeof SFX.playCannonBlast === 'function') SFX.playCannonBlast(); }catch(_){ }
                } else {
                  enemyBullets.push({ x: bx, y: by, dx, dy, life: 3.0, hitR }); spawnMuzzleFlash(bx, by, shootA);
                }
              }
            }
          }
        }
      }
    } else if (e.type === 'osprey'){
      // multi-stage flight: approach horizontally to above dropX, descend to dropAt (top-down), spawn payloads, ascend and leave
      const nowt = now;
      // always move horizontally toward intended direction
      e.x += e.vx * dt;
      // state machine
      if (e.state === 'approach'){
        // approach: maintain altitude (startY) while flying horizontally; when roughly above dropX switch to descend
        const dx = wrapDeltaX(e.dropX, e.x);
        // if horizontally near target, begin descent
        if (Math.abs(dx) < 40){ e.state = 'descend'; e.vy = 30 * Math.sign(wrapDeltaY(e.dropAt, e.y) || 1); }
      } else if (e.state === 'descend'){
  // debug: log when starting descent
  if (!e._loggedDescend){ if (DEBUG && console && console.log) console.log('osprey: starting descend', { x: e.x, y: e.y, dropX: e.dropX, dropAt: e.dropAt }); e._loggedDescend = true; }
        // descend toward dropAt (top-down drop). Move vertically toward dropAt
        const dy = wrapDeltaY(e.dropAt, e.y);
        const sign = Math.sign(dy || 1);
        e.y += sign * Math.min(Math.abs(dy), 60 * dt);
        // when close enough vertically, perform drop
        if (Math.abs(dy) < 8){
          // spawn dropCount combatants beneath the osprey
          const payloadCount = e.dropCount;
          for (let i=0;i<payloadCount;i++){
            const kind = ['commando','scout','heavy'][Math.floor(Math.random()*3)];
            const gx = e.x + (Math.random()-0.5)*40; const gy = mod(e.y + 18 + Math.random()*12, WORLD_H);
            const { c: tileC, g: tileG } = charTileCanvas();
            const idle = (idleMakers[kind] || (()=>()=>{}))(tileG);
            const run = (runMakers[kind] || (()=>()=>{}))(tileG);
            const ent2 = { x: gx, y: gy, spd: 45 + Math.random()*20, r: 14, type: 'jungle', kind, hp: 2, tileC, tileG, idle, run, angle: 0, lastAttack: 0, attackCD: 400 + Math.random()*300, dashUntil:0, moving: true, harmless: false };
            enemies.push(ent2);
          }
          e.dropDone = true;
          if (DEBUG && console && console.log) console.log('osprey: dropped payload', { x: e.x, y: e.y, count: payloadCount });
          e.state = 'ascend';
        }
      } else if (e.state === 'ascend'){
        // ascend back toward startY, then mark leave once high enough
        const dyUp = wrapDeltaY(e.startY, e.y);
        const signUp = Math.sign(dyUp || 1);
        e.y += signUp * Math.min(Math.abs(dyUp), 60 * dt);
        if (Math.abs(dyUp) < 8){ e.state = 'leave'; e.vx *= 1.6; }
      } else if (e.state === 'leave'){
        // leaving: maintain speed (don't accelerate too hard) and remove when offscreen
        e.x += e.vx * dt * 1.0; e.y += e.vy * dt;
  if (e.x < -200 || e.x > WORLD_W + 200) { const idx = enemies.indexOf(e); if (idx>=0){ try{ recordDeath(e.kind || '<osprey-leave>', e); }catch(_){ } try{ recordKill(e.kind || '<osprey-leave>', e); }catch(_){ } enemies.splice(idx,1); } }
      }
      // ensure vertical wrap normalization
      e.y = mod(e.y, WORLD_H);

    } else {
      // basic & animal movement
  const mvx = Math.cos(ang) * e.spd * dt, mvy = Math.sin(ang) * e.spd * dt;
  e.x += mvx; e.y += mvy; e.vx = mvx / Math.max(dt, 1e-6); e.vy = mvy / Math.max(dt, 1e-6);
    }

    // collide with player (same as before)
    // use the top-level wrapDist() helper (defined earlier) to compute collision distance
  const _spriteW_for_collide = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
  const collided = (selectedVehicle === 'heli') ? (wrapDist(e.x, e.y, heli.x, heli.y) < (e.r + H_SPR_W*H_SCALE*0.45)) : (wrapDist(e.x, e.y, tank.x, tank.y) < (e.r + _spriteW_for_collide*effectiveTankScale()*0.45));
  if (collided){
      // If the player is the tank, running over things shouldn't damage it.
      // If enemy flagged harmless, remove and score but do not damage player
  if (e.harmless){ if (e.type === 'jungle' || e.type === 'animal') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-harmless'); recordDeath(e.kind || '<collision-harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-harmless>'), e); }catch(_){ } enemies.splice(ei,1); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud(); }
      else if (selectedVehicle === 'tank'){
  if (e.type === 'jungle' || e.type === 'animal') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-tank');
  recordDeath(e.kind || '<collision-tank>', e);
  try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-tank>'), e); }catch(_){ }
  // If this is an osprey, do not allow the tank to run it over; push the tank back and bump
  if (e.type === 'osprey'){
    try{
      const dx = tank.x - e.x; let dy = wrapDeltaY(tank.y, e.y); const dist = Math.hypot(dx, dy) || 0.0001;
  const _spriteW_for_overlap = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
  const overlap = (e.r + _spriteW_for_overlap*SPRITE_SCALE*0.45) - dist;
      if (overlap > 0){
        const nx = dx / dist, ny = dy / dist;
        tank.x += nx * overlap;
        tank.y = mod(tank.y + ny * overlap, WORLD_H);
        try{ triggerTankBump(10, 0.18); }catch(_){ }
      }
    }catch(_){ }
    // keep osprey alive and do not score/remove it
    continue;
  }
  enemies.splice(ei,1);
  score += 1; updateHud();
  // If this enemy is a chained-heavy and it ran over the player's tank,
  // instantly destroy the tank regardless of current health.
  if (e && e._alt && e._alt.kindOrig === 'chained-heavy'){
    try{ explodeTank(updateHud, center, score); }catch(_){ }
    paused = true; gameOver = true; selectedVehicle = null;
  } else {
    // trigger tank bump when running over enemies
    try{ triggerTankBump(8, 0.18); }catch(_){ }
  }
      } else {
        // other vehicles (heli) still take damage on collision
  if (e.type === 'jungle' || e.type === 'animal') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-heli');
  recordDeath(e.kind || '<collision-heli>', e);
  try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-heli>'), e); }catch(_){ }
    enemies.splice(ei,1);
  health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } }
      }
      continue;
    }

    // collide with player bullets — bullets can damage HP for jungle/animal
      // squidrobot: smooth turret rotation toward the player's cursor (mouse), wrap-aware vertically
      if (e.kind === 'squidrobot'){
        // compute desired angle to the mouse in world coordinates (mouseWorldX/Y defined at top of loop)
        let dyMouse = mouseWorldY - e.y; if (dyMouse > WORLD_H/2) dyMouse -= WORLD_H; if (dyMouse < -WORLD_H/2) dyMouse += WORLD_H;
        const desiredA = Math.atan2(dyMouse, mouseWorldX - e.x);
        const ta = e.turretAngle || 0;
        let da = desiredA - ta; if (da > Math.PI) da -= Math.PI*2; if (da < -Math.PI) da += Math.PI*2;
        // smooth the turret rotation; faster smoothing to feel responsive to cursor
        e.turretAngle = ta + da * 0.18;
      }
  // allow custom entities to perform their per-frame update after engine movement
  try{ if (typeof e.update === 'function') e.update(dt, now, { x: targetX, y: targetY }); }catch(_){ }
    
  for (let bi = bullets.length-1; bi >= 0; bi--){ const b = bullets[bi];
    // check bullet collision with wrap-aware distance
    let dy = e.y - b.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = e.x - b.x; const dist = Math.hypot(dx, dy);
    if (dist < (e.r + 2)){
  bullets.splice(bi,1);
  try{ callSpawnGibs(b.x, b.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ }
  if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless-c>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless-c>'), e); }catch(_){ } score += 1; updateHud(); }
        else if (e.type === 'jungle' || e.type === 'animal'){
          e.hp = (e.hp||1) - 1;
          if (e.hp <= 0){ enemies.splice(ei,1); recordDeath(e.kind || '<killed-c>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-c>'), e); }catch(_){ } try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud(); }
        } else {
          // special-case osprey to spawn logical gibs
          if (e.type === 'osprey'){
            enemies.splice(ei,1);
            try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ }
            recordDeath(e.kind || '<osprey-killed-c>', e);
            try{ recordKill(e.kind || '<osprey-killed-c>', e); }catch(_){ }
            score += 1; updateHud();
            try{ spawnOspreyGibs(e.x, e.y, e); }catch(_){ callSpawnGibs(e.x, e.y, '#b0c7cf', 18, 'osprey-fallback'); }
          } else {
            enemies.splice(ei,1); recordDeath(e.kind || '<killed-other>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-other>'), e); }catch(_){ } try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud();
          }
        }
        break;
    } }
  // bullets vs billboards: allow player bullets to damage billboards
  for (let bi = bullets.length-1; bi >= 0; bi--){ const b = bullets[bi];
    for (let i = 0; i < billboardInstances.length; i++){
      const bb = billboardInstances[i]; if (bb.broken) continue; // already exploded
      // compute simple world-space distance (billboard center assumed at bb.x, bb.y)
      const dx = bb.x - b.x; let dy = bb.y - b.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H;
      const dist = Math.hypot(dx, dy);
      const hitR = 32 * Math.max(bb.scaleX, bb.scaleY);
  if (dist < hitR){
    // hit: consume bullet and decrement hp
    bullets.splice(bi,1);
    try{ callSpawnGibs(b.x, b.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ }
    bb.hp = (bb.hp||3) - 1;
    // small effect
    spawnMuzzleFlash(bb.x, bb.y, 0);
  if (bb.hp <= 0){ startBillboardExplode(bb, b.x, b.y); spawnBillboardDrop(bb); }
    break;
  }
    }
  }
  }

  // update powerups and pickup detection (while running)
  if (powerups.length) updatePowerups(dt);
  // pickup: check vehicle proximity to powerups
  for (let pi = powerups.length-1; pi >= 0; pi--){ const p = powerups[pi]; const vx = (selectedVehicle === 'heli') ? heli.x : tank.x; const vy = (selectedVehicle === 'heli') ? heli.y : tank.y; const dy = (selectedVehicle === 'heli') ? (vy - p.y) : wrapDeltaY(vy, p.y); const dx = vx - p.x; const pickR = (p.type === 'heal' || p.type === 'journal') ? 28 : 20; if (Math.hypot(dx, dy) < pickR){ // picked up
      if (p.type === 'double'){
        const nowt = performance.now();
        if (!tank.shotCount || nowt > (tank.powerupUntil || 0)){
          // fresh pickup -> double
          tank.shotCount = 2; tank.powerupUntil = nowt + 60000;
        } else {
          // already has powerup -> upgrade (double->triple->quad) and extend duration
          tank.shotCount = Math.min(4, (tank.shotCount || 2) + 1);
          tank.powerupUntil = nowt + 60000; // reset duration
        }
      } else if (p.type === 'heal'){
        // heal the player by 1 up to MAX_HEALTH
        try{ health = Math.min(typeof MAX_HEALTH === 'number' ? MAX_HEALTH : 5, (health || 0) + 1); }catch(_){ health = (health || 0) + 1; }
        try{ setHealth && setHealth(health); }catch(_){ }
        // register a journal image/count for slot 1 using the heart graphic
        try{
            const c = document.createElement('canvas'); c.width = POWERUP_TILE_PX; c.height = POWERUP_TILE_PX; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
            try{
              if (p && p.journalKey && p.journalKey.startsWith('collect-')) drawCollectLowResIntoPowerup(cc, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now(), p.journalKey);
              else drawHeartLowResIntoPowerup(cc, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now(), p.heartVariant || 'classic');
            }catch(_){ }
            try{ recordKill && recordKill((p && p.journalKey) ? p.journalKey : 'set 1', { tileC: c, spriteIdx: null }); }catch(_){ }
        }catch(_){ }
        try{ updateHud(); }catch(_){ }
      } else if (p.type === 'journal'){
        // add a journal entry for "set 1"; we reuse recordKill to register an icon and count
        try{
          const c2 = document.createElement('canvas'); c2.width = POWERUP_TILE_PX; c2.height = POWERUP_TILE_PX; const cc2 = c2.getContext('2d'); cc2.imageSmoothingEnabled = false;
          try{
            if (p && p.journalKey && p.journalKey.startsWith('collect-')) drawCollectLowResIntoPowerup(cc2, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now() + (p.phase*60), p.journalKey);
            else drawHeartLowResIntoPowerup(cc2, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now() + (p.phase*60), p.heartVariant || 'mend');
          }catch(_){ }
          try{ recordKill && recordKill((p && p.journalKey) ? p.journalKey : 'set 1', { tileC: c2, spriteIdx: null }); }catch(_){ }
        }catch(_){ }
        try{ updateHud(); }catch(_){ }
      }
  // feedback
  callSpawnGibs(vx, vy, '#ffd54f', 6, 'powerup-pickup'); spawnMuzzleFlash(vx, vy, 0);
      powerups.splice(pi,1);
    } }

  // camera follows selected vehicle (or center)
  // For the endless vertical runner, lock camera.y to the scrolling position and optionally follow x based on vehicle
  camera.y = cameraScrollY;
  if (selectedVehicle === 'heli') camera.x = heli.x;
  else if (selectedVehicle === 'tank') camera.x = tank.x;
  else camera.x = WORLD_W/2;
  // wrap camera.x horizontally (world wraps horizontally too)
  camera.x = mod(camera.x, WORLD_W);
  // clamp camera.x to world bounds so viewport doesn't show empty horizontally (account for zoom)
  const halfVW = W/(2*camera.zoom);
  camera.x = clamp(camera.x, halfVW, WORLD_W - halfVW);

  // ensure the tank stays within the visible vertical border: if it reaches bottom margin, push it up along with the scroll
  if (selectedVehicle === 'tank'){
  const ts = worldToScreen(tank.x, tank.y);
  const tankScreenBottom = ts.y + (SPR_H * effectiveTankScale() * camera.zoom)/2;
  if (tankScreenBottom > H - BOTTOM_MARGIN){
    // compute how much to push in screen space, convert to world delta
    const overlap = tankScreenBottom - (H - BOTTOM_MARGIN);
    const worldDelta = overlap / camera.zoom;
    // push tank upward in world space; but since camera is moving down, pushing upward effectively moves tank with the scroll
    tank.y = mod(tank.y - worldDelta, WORLD_H);
  }
  // also prevent tank from going above the top margin
  const tankScreenTop = ts.y - (SPR_H * effectiveTankScale() * camera.zoom)/2;
  if (tankScreenTop < TOP_MARGIN){ const overlap = TOP_MARGIN - tankScreenTop; const worldDelta = overlap / camera.zoom; tank.y = mod(tank.y + worldDelta, WORLD_H); }
    }
  } // end if(!paused)

// draw
  // update muzzle flashes
  for (let i = muzzleFlashes.length-1; i >= 0; i--){ const m = muzzleFlashes[i]; m.life -= dt; if (m.life <= 0) muzzleFlashes.splice(i,1); }
  // update tank dust
  if (tankDust.length) updateTankDust(dt);
  // update tank bump animation state
  try{ updateTankBump(dt); }catch(_){ }

  // screen shake reduces over time
  if (screenShake.time > 0){ const decay = Math.min(1, (dt / screenShake.duration) ); screenShake.time = Math.max(0, screenShake.time - dt); screenShake.magnitude = Math.max(0, screenShake.magnitude * (1 - decay)); }

  // apply screen shake offset to canvas transform (scale subtly with difficulty)
  // difficultyFactor is in [0,1]; multiply magnitude by a small factor of difficulty so shake increases over time
  const effectiveShakeMag = screenShake.magnitude * (1 + (typeof difficultyFactor !== 'undefined' ? difficultyFactor : 0) * 0.6);
  const shakeX = (screenShake.time > 0) ? ( (Math.random()*2-1) * effectiveShakeMag ) : 0;
  const shakeY = (screenShake.time > 0) ? ( (Math.random()*2-1) * effectiveShakeMag ) : 0;
  ctx.setTransform(1,0,0,1,0,0); // reset transform
  ctx.clearRect(0,0,W,H);
  ctx.save(); ctx.translate(shakeX, shakeY);
// grass/backdrop is drawn by the foliage module (init/update/draw) below;
// legacy `grassCanvas` drawing removed when foliage was extracted to `js/foliage.js`.

  // foliage: update and draw via foliage module (handles grass, tiles, instances)
  const windDX = mouse.x - (W/2), windDY = mouse.y - (H/2);
  const windAngle = Math.atan2(windDY, windDX);
  const windMag = Math.max(0, Math.min(1, Math.hypot(windDX, windDY) / (Math.max(W,H)*0.5)));
  updateFoliage(now, windAngle, windMag);
  drawFoliage(ctx, worldToScreen, camera);
  // update & draw critters (decorative sprites) — draw after foliage so they appear on top
  updateCritters(now, dt);
  drawCritters(now);
  // update/draw additional small animals distributed like critters
  updateAnimals(now, dt);
  drawAnimals(now);
  // draw tank pieces (explosion) on top of gibs
  if (tankPieces.length) drawTankPieces(ctx, worldToScreen, camera);
  // update/draw sparks and smoke for tank explosion
  if (tankSparks.length) updateTankSparks(dt);
  if (tankSmoke.length) updateTankSmoke(dt);
  if (tankSparks.length) drawTankSparks(ctx, worldToScreen, camera);
  if (tankSmoke.length) drawTankSmoke(ctx, worldToScreen, camera);


  // draw selected vehicle (or placeholder)
  // Dozer shield helper: curved arc in front of the tank that blocks/knocks things
  function _dozerShieldParams(){
    try{
      if (!tank || !tank.alive) return null;
      const bodyW = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
      // shield radius: ~5x tank width in world units
      const baseScale = effectiveTankScale();
      const radius = bodyW * baseScale * 5;
      const inner = Math.max(16, bodyW * baseScale * 0.6);
      const span = Math.PI * 0.9; // ~162 degrees wide curved shield in front
      const ang = tank.bodyAngle || 0; // align with body
      return { x: tank.x, y: tank.y, ang, inner, outer: radius, span };
    }catch(_){ return null; }
  }

  function dozerShieldIntersects(px, py){
    try{
      if (selectedVehicle !== 'tank' || selectedVehicleVariant !== 'dozer') return false;
      const p = _dozerShieldParams(); if (!p) return false;
      let dy = wrapDeltaY(py, p.y); const dx = px - p.x; const dist = Math.hypot(dx, dy);
      if (dist > p.outer || dist < p.inner) return false;
      const a = Math.atan2(dy, dx);
      let da = a - p.ang; while (da > Math.PI) da -= Math.PI*2; while (da < -Math.PI) da += Math.PI*2;
      return Math.abs(da) <= (p.span/2);
    }catch(_){ return false; }
  }

  function drawDozerShield(ctx, worldToScreen, camera){
    try{
      if (selectedVehicle !== 'tank' || selectedVehicleVariant !== 'dozer') return;
      const p = _dozerShieldParams(); if (!p) return;
      const s = worldToScreen(p.x, p.y);
      // draw as yellow translucent arc
      ctx.save(); ctx.translate(s.x, s.y);
      // convert world radius to screen by camera.zoom
      const screenR = p.outer * camera.zoom;
      ctx.beginPath(); ctx.fillStyle = 'rgba(255,222,77,0.22)'; ctx.strokeStyle = 'rgba(255,210,40,0.9)'; ctx.lineWidth = Math.max(2, 6 * camera.zoom);
      const start = p.ang - p.span/2; const end = p.ang + p.span/2;
      // canvas angles are clockwise from +x; rotate by 0
      ctx.rotate(0);
      ctx.moveTo(0,0);
      ctx.arc(0,0, screenR, start, end);
      ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore();
    }catch(_){ }
  }
  // draw tank dust behind the tank
  if (tankDust.length) drawTankDust(ctx, worldToScreen, camera);
  // draw powerups (under vehicles so they sit on the world)
  if (powerups.length) drawPowerups();
  // draw buildings (world -> screen) so they sit underneath vehicles
  for (const b of buildingInstances){ const bs = worldToScreen(b.x, b.y); const bx = bs.x, by = bs.y; const pad = 64 * b.scale * camera.zoom; if (bx < -pad || bx > W+pad || by < -pad || by > H+pad) continue; const tile = buildingTiles[b.idx]; ctx.save(); ctx.translate(bx, by); ctx.scale(b.scale * camera.zoom, b.scale * camera.zoom); ctx.translate(-32, -32); ctx.drawImage(tile.c,0,0); ctx.restore(); }
  // draw billboards (pixel-accurate canvases)
  for (const bb of billboardInstances){
  // If fragments were spawned around a focus (player/bullet/heli), use that focus
  // for culling and drawing so fragments near the player are not skipped.
  let bx, by;
  if (bb._worldFragments && bb._fragFocus){ const fs = worldToScreen(bb._fragFocus.x, bb._fragFocus.y); bx = fs.x; by = fs.y; }
  else { const bs = worldToScreen(bb.x, bb.y); bx = bs.x; by = bs.y; }
  const pad = 64 * Math.max(bb.scaleX, bb.scaleY) * camera.zoom; if (bx < -pad || bx > W+pad || by < -pad || by > H+pad) continue;
    if (bb.broken){
      // update broken physics using real dt (seconds)
      const squished = updateBillboardBroken(bb, dt, WORLD_H, mod);
      // process squish events: damage nearby jungle enemies
          if (squished && squished.length){
        for (const s of squished){
          for (let ei = enemies.length-1; ei >= 0; ei--){ const e = enemies[ei]; if (e.type !== 'jungle') continue; let dy = e.y - s.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = e.x - s.x; const dist = Math.hypot(dx, dy); if (dist < s.r){ callSpawnGibs(e.x, e.y, '#ff8b6b', 12, 'billboard-squish'); try{ recordDeath(e.kind || '<billboard-squish>', e); }catch(_){ } enemies.splice(ei,1); score += 1; updateHud(); } }
        }
      }
  // draw broken billboard at screen pos; account for camera.zoom and instance scale
  const instScale = Math.max(bb.scaleX || 1, bb.scaleY || 1) * camera.zoom;
  if (bb._worldFragments){
    try{ drawBillboardFragmentsWorld(bb, ctx, worldToScreen, camera); }catch(_){ }
  } else {
    drawBillboardBroken(bb, ctx, bx - 32 * instScale, by - 32 * instScale, instScale);
  }
      continue;
    }
    const t = performance.now(); const idx = Math.floor((t/120 + bb.animOffset) % billboardFrames.length); const frame = billboardFrames[idx];
    ctx.save();
    // translate to world screen pos
    ctx.translate(bx, by);
    // apply non-uniform scale: horizontal and vertical, include camera.zoom
    const sx = bb.scaleX * camera.zoom; const sy = bb.scaleY * camera.zoom;
    ctx.scale(sx, sy);
    // draw from centered origin (-32,-32) in unscaled canvas space
    ctx.translate(-32, -32);
    // draw the frame first
    ctx.drawImage(frame, 0, 0);
    // then draw ad image into panel if available (scale to fit while preserving aspect)
    try{
      const ad = bb._adCanvas || null;
      if (ad){
        // panel rect in billboard module
        const panel = (typeof BILLBOARD_PANEL !== 'undefined') ? BILLBOARD_PANEL : { x:10, y:6, w:44, h:28 };
        // compute fit scale
        const aw = ad.width, ah = ad.height;
        const pw = panel.w, ph = panel.h;
        const scale = Math.min(pw/aw, ph/ah);
        const dw = Math.round(aw * scale), dh = Math.round(ah * scale);
        const dx = panel.x + Math.round((pw - dw)/2);
        const dy = panel.y + Math.round((ph - dh)/2);
        // clip to panel so ad doesn't spill over frame
        ctx.save();
        ctx.beginPath();
        ctx.rect(panel.x, panel.y, panel.w, panel.h);
        ctx.clip();
        ctx.drawImage(ad, 0, 0, aw, ah, dx, dy, dw, dh);
        ctx.restore();
      }
    }catch(_){ }
    ctx.restore();
  }
  if (selectedVehicle === 'tank'){
    const ts = worldToScreen(tank.x, tank.y); const sx = ts.x, sy = ts.y;
    // only draw the tank (and its shadow) when it's alive; hide entirely while exploded
    if (tank.alive){
      // apply bump offset: when bumpTime > 0 interpolate a small vertical and tilt effect
      let bumpOffsetY = 0, bumpRot = 0;
      try{
        if (tank.bumpTime > 0 && tank.bumpDuration > 0){
          const tnorm = 1 - (tank.bumpTime / tank.bumpDuration); // 0..1
          // easing: quick up then settle (sin curve)
          const ease = Math.sin(tnorm * Math.PI);
          bumpOffsetY = -tank.bumpMag * ease; // negative -> tank lifts slightly
          bumpRot = (0.08 * ease) * (Math.random() * 0.6 + 0.7); // small random-tinged rotation
        }
      }catch(_){ }
      // draw shadow slightly offset by bump so it reads as lift
  const effScale = effectiveTankScale();
  drawShadow(sx, sy + Math.max(0, -bumpOffsetY)*0.6, SPR_W * effScale, effScale * camera.zoom);
  try{
    // draw body using its native canvas size so 64x64 sprites remain pixel-perfect
    const bodyScale = getCanvasDrawScale(bodyCanvas);
    ctx.save(); ctx.translate(sx, sy + bumpOffsetY); ctx.rotate(tank.bodyAngle + Math.PI/2 + bumpRot); ctx.scale(bodyScale, bodyScale); ctx.translate(-bodyCanvas.width/2, -bodyCanvas.height/2); ctx.imageSmoothingEnabled = false; ctx.drawImage(bodyCanvas, 0, 0); ctx.restore();
  }catch(_){ drawImageCentered(bodyCanvas, sx, sy + bumpOffsetY, tank.bodyAngle + Math.PI/2 + bumpRot, effScale * camera.zoom); }
  // draw Dozer shield on top of body/turret
  try{ drawDozerShield(ctx, worldToScreen, camera); }catch(_){ }
    try{
  const turretScale = getCanvasDrawScale(turretCanvas);
  // apply a per-variant turret artwork offset: default tank artwork was drawn pointing up,
  // so add PI/2 (90° clockwise) so turretAngle (atan2) maps correctly; other variants
  // (murkia/dozer/fiesta) use neutral artwork and require no offset.
    // Per-variant artwork offset: apply +90deg (clockwise) only for the default tank
    let turretArtworkOffset = 0;
    try{
      if (selectedVehicle === 'tank' && selectedVehicleVariant === 'default') turretArtworkOffset = Math.PI/2;
    }catch(_){ turretArtworkOffset = 0; }
  ctx.save(); ctx.translate(sx, sy + bumpOffsetY); ctx.rotate(tank.turretAngle + bumpRot + turretArtworkOffset); ctx.scale(turretScale, turretScale); ctx.translate(-turretCanvas.width/2, -turretCanvas.height/2); ctx.imageSmoothingEnabled = false; ctx.drawImage(turretCanvas, 0, 0); ctx.restore();
  }catch(_){ drawImageCentered(turretCanvas, sx, sy + bumpOffsetY, tank.turretAngle + bumpRot + turretArtworkOffset, effScale * camera.zoom); }
    }
  } else if (selectedVehicle === 'heli'){
  const wobble = Math.sin(now * 0.006) * 1.2;
  const hs = worldToScreen(heli.x, heli.y); const sx = hs.x, sy = hs.y + wobble*0.2;
  // draw helicopter scaled by camera.zoom so it zooms with the world
  const zScale = H_SCALE * camera.zoom;
  drawShadow(sx, sy, H_SPR_W, zScale);
  // body rotated 180 degrees visually (preserve control math)
  drawImageCentered(heliBody, sx, sy, heli.bodyAngle + Math.PI/2 + Math.PI, zScale);
  // main rotor (rotate with body + visual flip)
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(heli.bodyAngle + Math.PI/2 + Math.PI + heli.rotorSpin); ctx.scale(zScale,zScale); ctx.translate(-heliRotor.width/2,-heliRotor.height/2); ctx.drawImage(heliRotor,0,0); ctx.restore();
  // tail rotor (mount offset) - match original sprite local offset (6,-9) relative to sprite center
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(heli.bodyAngle + Math.PI/2 + Math.PI); ctx.scale(zScale,zScale);
  // use the original local offset in sprite-space (will be scaled by zScale)
  ctx.translate(6, -9);
  ctx.rotate(heli.tailSpin); ctx.translate(-heliTail.width/2, -heliTail.height/2); ctx.drawImage(heliTail,0,0); ctx.restore();
  // chin gun (rotate turret relative to body; add PI to body's visual rotation but keep turret math same)
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(heli.bodyAngle + Math.PI/2 + Math.PI); ctx.scale(zScale,zScale); ctx.translate(0, -8 / camera.zoom); ctx.rotate(heli.turretAngle - heli.bodyAngle); ctx.translate(-heliGun.width/2, -heliGun.height/2); ctx.drawImage(heliGun,0,0); ctx.restore();
  } else {
    // not selected: draw both small previews
  drawShadow(W*0.33, H*0.5);
  try{ const sB = getCanvasDrawScale(bodyCanvas); ctx.save(); ctx.translate(W*0.33, H*0.5); ctx.scale(sB,sB); ctx.translate(-bodyCanvas.width/2, -bodyCanvas.height/2); ctx.imageSmoothingEnabled = false; ctx.drawImage(bodyCanvas,0,0); ctx.restore(); }catch(_){ drawImageCentered(bodyCanvas, W*0.33, H*0.5, 0, 1.6); }
  try{ const sT = getCanvasDrawScale(turretCanvas); ctx.save(); ctx.translate(W*0.33, H*0.5); ctx.scale(sT,sT); ctx.translate(-turretCanvas.width/2, -turretCanvas.height/2); ctx.imageSmoothingEnabled = false; ctx.drawImage(turretCanvas,0,0); ctx.restore(); }catch(_){ drawImageCentered(turretCanvas, W*0.33, H*0.5, 0, 1.6); }
  drawShadow(W*0.66, H*0.5, H_SPR_W, 1.6); drawImageCentered(heliBody, W*0.66, H*0.5, 0, 1.6);
  }

  // draw bullets (player) with per-stream colors
  // Prepare 20mm shell frames (small animated sprite) once.
  // We'll use the AP variant (steel tip, brass case) from 20mmshells.
  if (typeof globalThis.__20mmShellFrames === 'undefined'){
    (function(){
      const PALETTE = { brassLight: '#e7c97a', brass: '#caa64e', brassDark: '#8d6b20', steelLight: '#c8d2df', steel: '#9fb0c2', steelDark: '#5c6a79', outline: '#1b1f24', accentYellow: '#ffd54a', tracerRed: '#ff4a4a' };
      function px(ctx,x,y,w=1,h=1,color){ ctx.fillStyle = color; ctx.fillRect(x,y,w,h); }
      function clamp(n,min,max){ return n<min?min:(n>max?max:n); }

      function drawShellTo(ctx, frameIdx){
        const variant = { key:'ap', name:'AP', tipLen:14, bodyH:12, caseHue:'brass', tracer:false, band:null };
        const W = ctx.canvas.width, H = ctx.canvas.height;
        ctx.clearRect(0,0,W,H);
        const totalLen = 48; const bodyH = variant.bodyH; const tipLen = variant.tipLen; const bodyLen = totalLen - tipLen;
        const x0 = Math.floor((W - totalLen)/2); const y0 = Math.floor((H - bodyH)/2);
        const brassL = PALETTE.brassLight, brass = PALETTE.brass, brassD = PALETTE.brassDark;
        const steelL = PALETTE.steelLight, steel = PALETTE.steel, steelD = PALETTE.steelDark;
        const caseColors = [brassL, brass, brassD]; const tipColors = [steelL, steel, steelD];
        const f = frameIdx % 6; const rimShift = f;
        // outlines
        px(ctx, x0-1, y0-1, bodyLen+2, 1, PALETTE.outline);
        px(ctx, x0-1, y0+bodyH, bodyLen+2, 1, PALETTE.outline);
        px(ctx, x0-1, y0, 1, bodyH, PALETTE.outline);
        const topBandH = 2, botBandH = 3; const midH = bodyH - topBandH - botBandH;
        px(ctx, x0, y0,               bodyLen, topBandH, caseColors[0]);
        px(ctx, x0, y0+topBandH,      bodyLen, midH,     caseColors[1]);
        px(ctx, x0, y0+bodyH-botBandH,bodyLen, botBandH, caseColors[2]);
        const rimX = x0 + clamp(2+rimShift*7, 2, bodyLen-3);
        px(ctx, rimX, y0, 1, 1, '#ffffff');
        // tip
        const slope = (bodyH/2) / tipLen;
        for (let i=0;i<tipLen;i++){
          const x = x0 + bodyLen + i; const t = Math.floor(i * slope); const top = y0 + t; const bot = y0 + bodyH - 1 - t; const h = bot - top + 1; const mid = Math.floor(h*0.5);
          px(ctx, x, top, 1, Math.max(1, Math.min(h,1)), tipColors[0]);
          px(ctx, x, top+1, 1, Math.max(0, mid-1), tipColors[1]);
          px(ctx, x, top+mid, 1, Math.max(0, h-mid), tipColors[2]);
          if ((i + f) % 6 === 0 && h>2){ px(ctx, x, top, 1, 1, '#ffffff'); }
        }
        for (let i=0;i<tipLen;i++){ const x = x0 + bodyLen + i; const t = Math.floor(i * slope); const top = y0 + t; const bot = y0 + bodyH - 1 - t; px(ctx, x, top-1, 1, 1, PALETTE.outline); px(ctx, x, bot+1, 1, 1, PALETTE.outline); }
        px(ctx, x0 + bodyLen + tipLen, y0 + Math.floor(bodyH/2), 1, 1, PALETTE.outline);
        px(ctx, x0, y0+bodyH-1, 2, 1, caseColors[0]);
      }

      const frames = [];
      for (let f=0; f<6; f++){ const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; drawShellTo(g, f); frames.push(c); }
      globalThis.__20mmShellFrames = frames;
    })();
  }

  // draw bullets as the projectile (steel/gray tip) only; brass/gold is drawn as the separate casing
  // steel palette (matches shell tip): steelLight '#c8d2df', steel '#9fb0c2', steelDark '#5c6a79'
  const PROJECTILE_FILL = '#9fb0c2';
  const PROJECTILE_GLOW = 'rgba(159,176,194,0.95)';
  for (const b of bullets){ const bs = worldToScreen(b.x, b.y); const sx = bs.x, sy = bs.y; if (sx < -10 || sx > W+10 || sy < -10 || sy > H+10) continue;
    // draw a steel/gray projectile shaped like the shell tip, rotated along velocity
    let angle = 0;
    try{ const vx = (typeof b.dx === 'number') ? b.dx : (typeof b.vx === 'number' ? b.vx : 0); const vy = (typeof b.dy === 'number') ? b.dy : (typeof b.vy === 'number' ? b.vy : 0); if (Math.abs(vx) > 1e-6 || Math.abs(vy) > 1e-6) angle = Math.atan2(vy, vx); }catch(_){ }
    const L = Math.max(6, 8 * camera.zoom); // capsule length
    const Wc = Math.max(2, 3 * camera.zoom); // capsule width
    const tipLight = '#c8d2df'; const tipMid = PROJECTILE_FILL; const tipDark = '#5c6a79';
    ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle);
  // no glow for player projectiles (shadow removed)
    // capsule body (mid)
    ctx.fillStyle = tipMid;
    ctx.beginPath();
    const halfL = L/2, halfW = Wc/2; const inset = halfW;
    ctx.moveTo(-halfL + inset, -halfW);
    ctx.lineTo(halfL - inset, -halfW);
    ctx.arc(halfL - inset, 0, halfW, -Math.PI/2, Math.PI/2);
    ctx.lineTo(-halfL + inset, halfW);
    ctx.arc(-halfL + inset, 0, halfW, Math.PI/2, -Math.PI/2);
    ctx.fill();
    // small light highlight at the tip
    ctx.fillStyle = tipLight;
    ctx.beginPath(); ctx.ellipse(halfL - inset, 0, halfW * 0.8, halfW * 0.8, 0, 0, Math.PI*2); ctx.fill();
    // slight dark rim toward the rear for depth
    ctx.fillStyle = tipDark; ctx.globalAlpha = 0.12; ctx.beginPath(); ctx.ellipse(-halfL + inset, 0, halfW * 0.9, halfW * 0.9, 0, 0, Math.PI*2); ctx.fill(); ctx.globalAlpha = 1;
    ctx.restore(); }

  // draw ejected casings using shell sprite frames
  const shellFrames = globalThis.__20mmShellFrames;
  if (shellFrames && shellFrames.length){
    for (const c of casings){ const cs = worldToScreen(c.x, c.y); const sx = cs.x, sy = cs.y; if (sx < -40 || sx > W+40 || sy < -40 || sy > H+40) continue;
      const idx = Math.floor(((performance.now() - (c.t0||0))/120) % shellFrames.length);
      const img = shellFrames[idx]; const scale = Math.max(0.5, camera.zoom * 0.6);
      const w = img.width * 0.3 * scale; const h = img.height * 0.3 * scale;
      // angle based on velocity
      let angle = 0; try{ angle = Math.atan2(c.vy, c.vx); }catch(_){ }
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle + (c.spin||0)); ctx.shadowBlur = 6 * camera.zoom; ctx.shadowColor = 'rgba(0,0,0,0.6)'; ctx.drawImage(img, 0, 0, img.width, img.height, -w/2, -h/2, w, h); ctx.restore(); }
  }

  // draw muzzle flashes (world-space)
  for (const m of muzzleFlashes){ const ms = worldToScreen(m.x, m.y); const sx = ms.x, sy = ms.y; ctx.save(); ctx.translate(sx, sy); ctx.rotate(m.angle); const glow = 18 * camera.zoom; ctx.shadowBlur = glow; ctx.shadowColor = 'rgba(255,220,140,0.95)'; ctx.fillStyle = 'rgba(255,240,180,0.95)'; ctx.beginPath(); ctx.ellipse(0,0, Math.max(2,6*camera.zoom), Math.max(1,3*camera.zoom), 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  // draw kitten bullets (exclusive visuals/animation)
  for (const kb of kittenBullets){ const ks = worldToScreen(kb.x, kb.y); const sx = ks.x, sy = ks.y; if (sx < -10 || sx > W+10 || sy < -10 || sy > H+10) continue;
    // If an external kitten projectile renderer is attached, prefer it
    try{
      if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenProjectile === 'function'){
        // drawKittenProjectile(ctx, kb, screenX, screenY, camera, now)
        try{ globalThis.drawKittenProjectile(ctx, kb, sx, sy, camera, performance.now()); continue; }catch(_){ /* fallthrough to default visual */ }
      }
    }catch(_){ }
    ctx.save(); ctx.shadowBlur = 18 * camera.zoom; ctx.shadowColor = 'rgba(255,120,220,0.95)'; ctx.fillStyle = '#ff8bff'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1,3*camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  // draw enemy bullets (red glow to match impact visuals)
  ctx.fillStyle = '#ff6b6b';
  for (const eb of enemyBullets){ const es = worldToScreen(eb.x, eb.y); const sx = es.x, sy = es.y; if (sx < -10 || sx > W+10 || sy < -10 || sy > H+10) continue; ctx.save(); ctx.shadowBlur = 12 * camera.zoom; ctx.shadowColor = 'rgba(255,100,100,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1,3*camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  // draw enemies (per-type)
  for (const e of enemies){
    // one-time kitten debug: detect a chained/kitten entity and log key fields for diagnostics
    try{
      if (!window.__kittenDebugLogged){
        const k = (window.enemies||[]).find(en => en && (en._alt || en.kind === 'pinkdot' || (en.kind && en.kind.includes('kitten'))));
        if (k){
          window.__kittenDebugLogged = true;
          try {
            console.log('kitten-debug', {
              vx: k.vx, vy: k.vy, angle: k.angle, turretAngle: k.turretAngle,
              a_hull: k._alt && k._alt.a && k._alt.a.hullAngle, b_hull: k._alt && k._alt.b && k._alt.b.hullAngle,
              a_trot: k._alt && k._alt.a && k._alt.a.trot, b_trot: k._alt && k._alt.b && k._alt.b.trot,
              sample: k
            });
          }catch(_){ }
        }
      }
    }catch(_){ }
      // heli run-over: damage nearby billboards
      try{
  for (let bi = 0; bi < billboardInstances.length; bi++){ const bb = billboardInstances[bi]; if (bb.broken) continue; const r = 32 * Math.max(bb.scaleX || 1, bb.scaleY || 1); const dx = bb.x - heli.x; const dy = wrapDeltaY(bb.y, heli.y); if (Math.hypot(dx,dy) < r){ bb.hp = (bb.hp||3) - 1; if (bb.hp <= 0){ startBillboardExplode(bb, heli.x, heli.y); } else { try{ triggerScreenShake(4, 0.06); }catch(_){ } } break; } }
      }catch(_){ }
    // prefer custom draw when entity provides one so modules can fully control visuals
    try{ if (typeof e.draw === 'function'){ e.draw(ctx, worldToScreen, camera); continue; } }catch(_){ }
  try{ if (DEBUG && typeof console !== 'undefined' && performance.now() - __lastEnemyDrawLog > 1000) { console.log('draw enemies, count=', enemies.length, 'sample=', enemies[0]); __lastEnemyDrawLog = performance.now(); } }catch(_){ }
    const es = worldToScreen(e.x, e.y); const sx = es.x, sy = es.y;
    if (sx < -40 || sx > W+40 || sy < -40 || sy > H+40) continue;
    if (e.type === 'jungle'){
      // choose idle vs run maker
  // draw humans slightly smaller than tile size
  const HUMAN_SCALE = 0.82;
  try { drawShadow(sx, sy, e.tileC.width, camera.zoom * HUMAN_SCALE); } catch (err) { drawShadow(sx, sy); }
      try {
          const lookA = Math.atan2((selectedVehicle === 'heli' ? heli.y : tank.y) - e.y, (selectedVehicle === 'heli' ? heli.x : tank.x) - e.x);
          if (e.moving) { e.run(performance.now(), lookA); } else { e.idle(performance.now(), lookA); }
      // If the tile canvas ended up empty, stamp a tiny probe pixel so it is
      // visible and diagnostically obvious in console logs.
      try{
  if (e.tileG){ const imgData = e.tileG.getImageData(0,0,e.tileC.width,e.tileC.height).data; let ok=false; for (let k=3;k<imgData.length;k+=4){ if (imgData[k]!==0){ ok=true; break; } } if (!ok){ try{ console.warn('Empty tile for kind=', e.kind); }catch(err){ /* ignore */ } }
        }
      }catch(_){ }
      const flip = (e.vx && e.vx < 0);
  // diagnostics: if marker mode is enabled, log tile info and provide fallback draw if tile is missing
  if (showEntityMarkers){ try{ console.log('drawEnemy:jungle', { kind: e.kind, tileExists: !!e.tileC, tileW: e.tileC && e.tileC.width, tileH: e.tileC && e.tileC.height, sx: Math.round(sx), sy: Math.round(sy) }); }catch(_){ }
    if (!e.tileC || e.tileC.width <= 0){ // fallback visible marker
      ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), Math.max(8, Math.round(e.r * camera.zoom)), 0, Math.PI*2); ctx.fill(); ctx.restore();
    } else {
      // Special-case: pinkdot/kitten should rotate freely to face its movement direction
      if (e.kind === 'pinkdot'){
        try{
          // prefer engine-provided velocity, fallback to ent.angle or face the player
          const vx = (typeof e.vx === 'number') ? e.vx : 0;
          const vy = (typeof e.vy === 'number') ? e.vy : 0;
          let angle = 0;
          if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001){
            // match kitten hull math: face direction of travel (sprite faces "up" by default)
            angle = Math.atan2(vy, vx) + Math.PI/2;
          } else if (typeof e.angle === 'number'){
            angle = e.angle;
          } else if (typeof window !== 'undefined' && window.tank){
            const tx = (selectedVehicle === 'heli' && heli) ? heli.x : tank.x;
            const ty = (selectedVehicle === 'heli' && heli) ? heli.y : tank.y;
            angle = Math.atan2(ty - e.y, tx - e.x) + Math.PI/2;
          }
          drawImageCentered(e.tileC, sx, sy, angle, camera.zoom * HUMAN_SCALE);
        }catch(_){ drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE); }
      } else {
        drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE);
      }
    }
  } else {
    // not in marker mode
    if (e.kind === 'pinkdot'){
      try{
        const vx = (typeof e.vx === 'number') ? e.vx : 0;
        const vy = (typeof e.vy === 'number') ? e.vy : 0;
        let angle = 0;
        if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001){ angle = Math.atan2(vy, vx) + Math.PI/2; }
        else if (typeof e.angle === 'number') angle = e.angle;
        else if (typeof window !== 'undefined' && window.tank){ const tx = (selectedVehicle === 'heli' && heli) ? heli.x : tank.x; const ty = (selectedVehicle === 'heli' && heli) ? heli.y : tank.y; angle = Math.atan2(ty - e.y, tx - e.x) + Math.PI/2; }
        drawImageCentered(e.tileC, sx, sy, angle, camera.zoom * HUMAN_SCALE);
      }catch(_){ drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE); }
    } else {
      drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE);
    }
  }
        } catch (err){
          try{ console.warn('drawEnemy:jungle failed for kind=', e.kind || '<unknown>', 'pos=', Math.round(e.x), Math.round(e.y), err); }catch(_){ }
          // fallback visual so the entity remains visible
          drawShadow(sx, sy);
          ctx.fillStyle = '#b94a4a'; ctx.beginPath(); ctx.arc(sx, sy, e.r, 0, Math.PI*2); ctx.fill();
        }
    } else if (e.type === 'animal'){
      const idx = (typeof e.spriteIdx === 'number') ? e.spriteIdx : 0;
      // prefer per-entity tile (large animal) when available, otherwise use the shared critter sprite
      const spr = (e && e.tileC && e.tileC.width) ? e.tileC : ((typeof critterSprites !== 'undefined') ? critterSprites[idx] : null);
      const flip = (e.vx && e.vx < 0);
      // compute drawScale: base by camera zoom and ANIMAL_DRAW_BASE, adjust by native sprite width so large tiles render larger
      const baseSpriteWidth = (critterSprites && critterSprites[0] && critterSprites[0].width) ? critterSprites[0].width : (8 * CRITTER_SPR_SCALE);
      const sizeFactor = (spr && spr.width) ? (spr.width / baseSpriteWidth) : 1;
      const drawScale = camera.zoom * ANIMAL_DRAW_BASE * sizeFactor;
      // fallback: if sprite missing or invalid, draw a bright marker so the entity remains visible
      if (!spr || !spr.width || !spr.height){ ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), Math.max(6, Math.round(e.r * camera.zoom)), 0, Math.PI*2); ctx.fill(); ctx.restore(); if (showEntityMarkers){ ctx.save(); ctx.fillStyle='#ff8b6b'; ctx.fillRect(Math.round(sx)-4, Math.round(sy)-4, 8, 8); ctx.restore(); } continue; }
      const pad = Math.max(28, Math.round((spr.width * drawScale)/2) + 6);
      if (sx < -pad || sx > W+pad || sy < -pad || sy > H+pad) continue;
      drawImageCenteredFlipped(spr, Math.round(sx), Math.round(sy), flip, drawScale);
      if (showEntityMarkers){ ctx.save(); ctx.fillStyle='#ff8b6b'; ctx.fillRect(Math.round(sx)-4, Math.round(sy)-4, 8, 8); ctx.restore(); }
    } else if (e.type === 'osprey'){
      // draw osprey using its baked tile sprite (ensure idle is invoked so tile is populated)
      try{
  // debug probe: log tile info so we can see if the offscreen canvas exists and has dimensions
  if (DEBUG && typeof console !== 'undefined') console.log('draw osprey', { kind: e.kind, tileC: !!e.tileC, tileW: e.tileC && e.tileC.width, tileH: e.tileC && e.tileC.height, hasIdle: typeof e.idle === 'function' });
        // draw a matching shadow first
        drawShadow(sx, sy, (e.tileC && e.tileC.width) || 48, camera.zoom);
        // allow the idle maker to render into the offscreen tile
        if (typeof e.idle === 'function') e.idle(performance.now(), 0);
        // stamp a tiny magenta pixel into the offscreen tile as a probe so it's visible if previously empty
  try{ /* probe removed: no offscreen stamp */ }catch(_){}
        // draw the tile centered and rotated to match velocity direction
        const ospScale = camera.zoom * 0.95;
        // compute facing angle from velocity (fallback to horizontal direction toward dropX)
        let faceA = 0;
        if (typeof e.vx === 'number' || typeof e.vy === 'number'){
          const vx = e.vx || 0; const vy = e.vy || 0;
          if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001) faceA = Math.atan2(vy, vx);
        }
  // fallback: face toward the dropX horizontally when largely stationary
  if (Math.abs(faceA) < 1e-4){ const dx = wrapDeltaX(e.dropX || e.x + 1, e.x); faceA = Math.atan2(0, dx || 1); }
  // Correct for sprite art orientation: artwork is drawn pointing "up" by default,
  // while atan2(vy,vx) uses 0=righward. Add +90deg so visual nose matches velocity.
  const ORIENT_OFFSET = Math.PI * 0.5;
  drawImageCentered(e.tileC, sx, sy, faceA + ORIENT_OFFSET, ospScale);
      }catch(err){
        // fallback to simple marker so it remains visible if sprite rendering fails
        ctx.fillStyle = '#b94a4a'; ctx.strokeStyle = '#6b2222'; ctx.beginPath(); ctx.arc(sx, sy, e.r, 0, Math.PI*2); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
      }
    } else {
      ctx.fillStyle = '#b94a4a'; ctx.strokeStyle = '#6b2222'; ctx.beginPath(); ctx.arc(sx, sy, e.r, 0, Math.PI*2); ctx.fill(); ctx.lineWidth = 2; ctx.stroke();
    }
  }
  // recent-deaths overlay removed

    // finally, update and draw gibs so they appear on top of world sprites and explosions
    updateGibs(dt);
    drawGibs(ctx, worldToScreen, camera);

    requestAnimationFrame(loop);
}
// initialize foliage (bake large offscreen grass canvas and tiles) so drawFoliage can run on first frame
try{ initFoliage(WORLD_W, WORLD_H); }catch(e){ console.warn('initFoliage failed or not available yet', e); }
requestAnimationFrame(loop);

// key shortcuts
window.addEventListener('keydown', e=>{
if (e.key.toLowerCase() === 'r') restart();
if (e.key.toLowerCase() === 'p'){ palette = randPalette(); redrawSprites(); rebuildHeliSprites(); }
// (key 'k' test for recent-deaths removed)
if (e.key.toLowerCase() === 'g'){ showEntityMarkers = !showEntityMarkers; console.log('showEntityMarkers=', showEntityMarkers); }
});

// initial HUD
updateHud();
