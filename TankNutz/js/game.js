// --- Canvas + helpers ---
import { initJournal, updateJournal, recordKill, setHealth } from './journal.js';
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
// initialize critters system
initCritters();
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
import { initCritters, critters, animals, spawnCritters, spawnAnimals, updateCritters, drawCritters, updateAnimals, drawAnimals, critterSprites, CRITTER_SPR_SCALE, CRITTER_DRAW_BASE, ANIMAL_DRAW_BASE } from './critters.js';

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

// Draw Blackstar body only (tracks and hull, no background)
function drawBlackstarBodyInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, FRAMES = 6, FRAME_MS = 120;
    const now = ts || performance.now(); const frame = Math.floor(now / FRAME_MS) % FRAMES;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const C = { clear:'rgba(0,0,0,0)', hull:'#0b0b0f', hull2:'#15151a', rim:'#2f3242', mid:'#232531', steel:'#9ea2a9', red:'#d4002a', redHi:'#ff4554', flash:'#ffc744', tread:'#0a0b10', tread2:'#000000' };
    o.fillStyle = C.clear; o.fillRect(0,0,S,S);
    // No background pattern

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

    // Rim lights
    rect(hullX+hullW-2, hullY+2, 1, hullH-4, C.rim);
    rect(hullX+2, hullY+2, hullW-4, 1, C.rim);

    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBlackstarBodyInto = drawBlackstarBodyInto; }catch(_){ }

// Draw Blackstar turret only (grey star and barrel, pointing up)
function drawBlackstarTurretInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, FRAMES = 6, FRAME_MS = 120;
    const now = ts || performance.now(); const frame = Math.floor(now / FRAME_MS) % FRAMES;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const C = { clear:'rgba(0,0,0,0)', hull:'#0b0b0f', hull2:'#15151a', rim:'#2f3242', mid:'#232531', steel:'#9ea2a9', red:'#d4002a', redHi:'#ff4554', flash:'#ffc744', tread:'#0a0b10', tread2:'#000000' };
    o.fillStyle = C.clear; o.fillRect(0,0,S,S);
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

    const tx = anchor.x, ty = anchor.y;
    const rot = 0; // static, pointing up
    const recoil = 0; // no recoil for turret

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

    // Barrels (pointing up)
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

    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBlackstarTurretInto = drawBlackstarTurretInto; }catch(_){ }

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

// Draw Bond-style tank into a canvas by rendering the original 128×128 art and scaling
function drawBondtankInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const G = 128;
    // create logical 128x128 buffer
    const tmp = document.createElement('canvas'); tmp.width = G; tmp.height = G; const octx = tmp.getContext('2d');
    // helpers (port from Bondtank.html)
    function px(x,y,col){ x|=0; y|=0; if(x<0||y<0||x>=G||y>=G) return; octx.fillStyle=col; octx.fillRect(x,y,1,1); }
    function line(x0,y0,x1,y1,col){ x0|=0;y0|=0;x1|=0;y1|=0; let dx=Math.abs(x1-x0), sx = x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy = y0<y1?1:-1; let err = dx+dy, e2; for(;;){ px(x0,y0,col); if(x0===x1 && y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    function rect(x,y,w,h,col){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) px(x+i,y+j,col); }
    function circle(xc,yc,r,col,fill=true){ let x=-r,y=0,err=2-2*r; r=1-err; while(x<0){ if(fill){ for(let i=xc+x;i<=xc-x;i++){ px(i,yc+y,col); px(i,yc-y,col); } } else { px(xc-x,yc+y,col); px(xc-y,yc-x,col); px(xc+y,yc-x,col); px(xc+x,yc-y,col); px(xc+x,yc+y,col); px(xc+y,yc+x,col); px(xc-y,yc+x,col); px(xc-x,yc-y,col); } r=err; if(r<=y){ y++; err+=y*2+1; } if(r>x || err>y){ x++; err+=x*2+1; } } }
    function rot(ax,ay, ang, cx,cy){ const s=Math.sin(ang), c=Math.cos(ang); ax-=cx; ay-=cy; return [ax*c-ay*s+cx, ax*s+ay*c+cy]; }
    function ditherStripe(x,y,ratio){ return ((x^y)&1) ? ratio>0.5 : ratio<=0.5; }

    const P = {
      black:'#0a0a0c', iron:'#1b1c22', steel:'#2b2e36', steel2:'#3a3e49', track:'#15161b', track2:'#262933',
      red_dark:'#3e0005', red:'#6f000a', red_mid:'#990e16', red_bright:'#c91521', red_glint:'#ff2a3a',
      belt:'#1a1a1f', belt2:'#101014', chain:'#c0c6cf', chain_sh:'#8a8f98', rivet:'#d8dee7', highlight:'#fafbfd', soot:'#3b3b44', smoke1:'#676b74', smoke2:'#8b8f99', smoke3:'#b7bcc6', amber:'#f4b45a', glow:'#ffd38a'
    };

    // clear
    octx.clearRect(0,0,G,G);

    // Implement main parts from Bondtank.html
    // drawTracks
    (function drawTracks(t){ const treadOffset = Math.floor((t/2) % 6); rect(10,24,12,80,P.track);  rect(11,25,10,78,P.track2); rect(106,24,12,80,P.track); rect(107,25,10,78,P.track2); for(let k=0;k<15;k++){ const y = 26 + ((k*6 + treadOffset) % 78); line(12,y,20,y+2,P.soot); line(12,y+2,20,y,P.soot); line(108,y,116,y+2,P.soot); line(108,y+2,116,y,P.soot); } for(let i=0;i<5;i++){ const wy=36+i*16; circle(16,wy,4,P.steel,false); circle(112,wy,4,P.steel,false); } })(now);

    // drawHull
    (function drawHull(t){ for(let y=28;y<100;y++){ for(let x=24;x<104;x++){ const col = (y<40?P.red_dark : (y<70?P.red : P.red_mid)); px(x,y,col); } } // rim lines
      for(let i=0;i<80;i++){ px(24+i,28,P.red_dark); px(24+i,99,P.red); }
      for(let j=0;j<72;j++){ px(24,28+j,P.red_dark); px(103,28+j,P.red); }
      for(let y=40;y<88;y+=2){ px(64,y,P.red_bright); if((y&3)===0) px(63,y,P.red_glint); }
      // shaded top
      for(let yy=28; yy<28+10; yy++){ for(let xx=28; xx<28+72; xx++){ /* subtle shading already filled */ } }
    })(now);

    // drawBelts, chains, spikes, turret, top chains, exhaust, lights, handcuffs
    (function drawBelts(t){ const belts = [ {x0:28,y0:42,x1:100,y1:62,w:2},{x0:100,y0:46,x1:28,y1:82,w:2},{x0:32,y0:60,x1:96,y1:92,w:3},{x0:96,y0:38,x1:32,y1:74,w:3} ]; belts.forEach(b=>{ const steps = Math.max(Math.abs(b.x1-b.x0), Math.abs(b.y1-b.y0)); for(let i=0;i<=steps;i++){ const x = Math.round(b.x0 + (b.x1-b.x0)*i/steps); const y = Math.round(b.y0 + (b.y1-b.y0)*i/steps); for(let w=-b.w; w<=b.w; w++){ px(x, y+w, P.belt2); if((i+w)&1) px(x, y+w, P.belt); } } for(let i=12;i<steps;i+=24){ const x = Math.round(b.x0 + (b.x1-b.x0)*i/steps); const y = Math.round(b.y0 + (b.y1-b.y0)*i/steps); rect(x-2,y-1,5,3,P.steel); px(x-2,y-1,P.highlight); px(x+3,y-2,P.chain); px(x+4,y-3,P.chain_sh); } }); })(now);

    (function drawChainsWrapped(t){ const sway = Math.sin(t/28)*2; const loops = [ {x0:30,y0:34,x1:98,y1:34}, {x0:30,y0:96,x1:98,y1:96}, {x0:26,y0:36,x1:26,y1:94}, {x0:102,y0:36,x1:102,y1:94} ]; loops.forEach((L,idx)=>{ const steps = Math.max(Math.abs(L.x1-L.x0), Math.abs(L.y1-L.y0)); for(let i=0;i<=steps;i+=3){ let x = Math.round(L.x0 + (L.x1-L.x0)*i/steps); let y = Math.round(L.y0 + (L.y1-L.y0)*i/steps); if(L.y0===L.y1) y += Math.round(Math.sin((i/steps)*Math.PI)*2 + sway*(idx&1?1:-1)); px(x,y,P.chain); px(x-1,y,P.chain_sh); px(x+1,y,P.chain_sh); if(((i+idx*7+now)|0)%19===0) px(x,y-1,P.highlight); if((i/3|0)%2===0){ px(x,y+1,P.chain_sh); px(x,y+2,P.chain); px(x,y+3,P.chain_sh); } } }); })(now);

    (function drawHullFrontSpikes(){ for(let x=32; x<=96; x+=6){ px(x,27,P.chain_sh); px(x,26,P.chain); px(x,25,P.chain_sh); } })();

    (function drawTurret(t){
      // draw turret dome and rivets only; barrel is rendered separately by the dynamic turret renderer
      circle(64,56,18,P.steel,false);
      const ang = (t/60) % (Math.PI*2);
      for(let yy=-12; yy<=12; yy++){
        for(let xx=-18; xx<=18; xx++){
          if((xx*xx)/360 + (yy*yy)/144 <= 1){
            const [rx,ry] = rot(64+xx,56+yy,ang,64,56);
            const xi = rx|0, yi = ry|0;
            const shade = yy<-6 ? P.red_bright : yy<0 ? P.red : yy<6 ? P.red_mid : P.red_dark;
            px(xi,yi,shade);
          }
        }
      }
      for(let i=0;i<12;i++){
        const a = i/12*Math.PI*2 + ang*0.5;
        const [x,y] = rot(64+Math.cos(a)*18,56+Math.sin(a)*18,0,0,0);
        px(x|0,y|0,P.rivet);
      }
      // intentionally omit barrel drawing here — barrel pixels will come from the rotating turret renderer
    })(now);

    (function drawTopChains(t){ const ang = (t/32); const R = 26; const N = 24; for(let i=0;i<N;i++){ const a = ang + i*(Math.PI*2/N); const x = 64 + Math.cos(a)*R; const y = 56 + Math.sin(a)*R; px(x|0,y|0,P.chain); px((x+1)|0,y|0,P.chain_sh); if((i+now)%3===0) px((x-1)|0,(y-1)|0,P.highlight); const sx = 64 + Math.cos(a)*(R+3); const sy = 56 + Math.sin(a)*(R+3); px(sx|0,sy|0,P.chain_sh); const sx2 = 64 + Math.cos(a)*(R+4); const sy2 = 56 + Math.sin(a)*(R+4); px(sx2|0,sy2|0,P.chain); const sx3 = 64 + Math.cos(a)*(R+5); const sy3 = 56 + Math.sin(a)*(R+5); px(sx3|0,sy3|0,P.chain_sh); } })(now);

    (function drawExhaust(t){ rect(56,96,16,4,P.steel2); for(let i=0;i<8;i++) px(58+i,97,P.black); const seeds = [0,12,24]; seeds.forEach((s,idx)=>{ const life = ((t+s)%120); const y = 96 - Math.floor(life/3); const x = 64 + Math.round(Math.sin((life/10)+(idx*1.7))*4); if(y>20){ px(x,y,P.smoke1); px(x+1,y,P.smoke2); px(x,y-1,P.smoke3); } }); })(now);

    (function drawLights(t){ const on = ((t/6)|0)%2===0; const c = on ? P.glow : P.amber; rect(42,26,4,2,c); rect(84,26,4,2,c); if(((t/8)|0)%6===0){ px(66,30,P.highlight); } })(now);

    (function drawHandcuffs(t){ const anchor = { x:64, y:22 }; const sway = Math.sin(t/26)*0.28; const drop = 6 + Math.abs(Math.sin(t/40))*2; const offset = 14; const baseL = [anchor.x - offset, anchor.y + drop]; const baseR = [anchor.x + offset, anchor.y + drop]; const [cxL, cyL] = rot(baseL[0], baseL[1], sway, anchor.x, anchor.y); const [cxR, cyR] = rot(baseR[0], baseR[1], sway, anchor.x, anchor.y); const steps = 10; for(let i=0;i<=steps;i++){ const x = cxL + (cxR-cxL)*(i/steps); const y = cyL + (cyR-cyL)*(i/steps) + Math.sin(i/2 + t/10)*0.5; px(x|0,y|0,P.chain); if(i%2===0) px((x-1)|0,(y+1)|0,P.chain_sh); } function ring(cx,cy,R,out,inn){ circle(cx|0,cy|0,R,out,true); circle(cx|0,cy|0,R-2,inn,true); circle(cx|0,cy|0,R-4,out,false); } ring(cxL, cyL, 9, P.steel, P.iron); rect((cxL-2)|0,(cyL-10)|0,4,3,P.steel2); rect((cxL-3)|0,(cyL+6)|0,6,3,P.steel2); px((cxL)|0,(cyL+5)|0,P.highlight); ring(cxR, cyR, 9, P.steel, P.iron); rect((cxR-2)|0,(cyR-10)|0,4,3,P.steel2); rect((cxR-3)|0,(cyR+6)|0,6,3,P.steel2); px((cxR)|0,(cyR+5)|0,P.highlight); const midLx = (cxL+anchor.x)/2, midLy = (cyL+anchor.y)/2 + 2; const midRx = (cxR+anchor.x)/2, midRy = (cyR+anchor.y)/2 + 2; line(cxL|0,cyL|0, midLx|0, midLy|0, P.chain); line(cxR|0,cyR|0, midRx|0, midRy|0, P.chain); px(anchor.x, anchor.y, P.chain); })(now);

    // final: draw tmp into target ctx with imageSmoothing disabled so pixels copy exactly
    try{ if (typeof ctx !== 'undefined' && ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(tmp, 0,0,G,G, 0,0,targetW,targetH); }
    }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBondtankInto = drawBondtankInto; }catch(_){ }

// Draw only the Bond turret artwork (centered, pointing up) into a target canvas/context
function drawBondTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const G = 128; // draw at high detail then scale by target dims
    const tmp = document.createElement('canvas'); tmp.width = G; tmp.height = G; const octx = tmp.getContext('2d');
    try{ octx.imageSmoothingEnabled = false; }catch(_){ }
    // helpers
    function px(x,y,col){ x|=0; y|=0; if(x<0||y<0||x>=G||y>=G) return; octx.fillStyle=col; octx.fillRect(x,y,1,1); }
    function rect(x,y,w,h,col){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) px(x+i,y+j,col); }
    function circle(cx,cy,r,col){ for(let yy=-r; yy<=r; yy++) for(let xx=-r; xx<=r; xx++) if(xx*xx+yy*yy <= r*r) px(cx+xx, cy+yy, col); }
    function rotPt(x,y,ang,cx,cy){ const s=Math.sin(ang), c=Math.cos(ang); const dx=x-cx, dy=y-cy; return [Math.round(dx*c - dy*s + cx), Math.round(dx*s + dy*c + cy)]; }

    const P = { steel:'#2b2e36', steel2:'#3a3e49', rivet:'#d8dee7', red:'#6f000a', red_bright:'#c91521', chain:'#c0c6cf', soot:'#3b3b44' };

    octx.clearRect(0,0,G,G);
    // turret base center
    const cx = 64, cy = 56;
    // turret circle
    for(let yy=-18; yy<=18; yy++) for(let xx=-18; xx<=18; xx++){ if((xx*xx)/360 + (yy*yy)/144 <= 1){ const shade = yy<-6 ? P.red_bright : yy<0 ? P.red : yy<6 ? P.red : P.red; px(cx+xx, cy+yy, shade); } }
    // rivets
    for(let i=0;i<12;i++){ const a = i/12*Math.PI*2; const rx = Math.round(cx + Math.cos(a)*18); const ry = Math.round(cy + Math.sin(a)*18); px(rx,ry,P.rivet); }
    // barrel recoil animation
    const ang = (now/60) % (Math.PI*2);
    const recoil = Math.max(0, Math.sin(now/18)*2.0);
    const barrelLen = 44 - recoil; const barrelW = 3;
    const bx = cx, by = cy - 10;
    for(let L=0; L<barrelLen; L++){
      const tx = bx; const ty = by - L;
      for(let w=-barrelW; w<=barrelW; w++) px(tx+w, ty, (w===0||w===-1)?P.red_bright:P.steel2);
    }
    // barrel muzzle
    circle(bx, by - barrelLen, 3, P.soot);

    // top small chains / decorations
    for(let i=0;i<8;i++){ const a = i/8*Math.PI*2 + now*0.002; const x = Math.round(cx + Math.cos(a)*26); const y = Math.round(cy + Math.sin(a)*26); px(x,y,P.chain); }

    // draw tmp into target ctx scaled to targetW/targetH with imageSmoothing disabled
    try{ ctx.save(); try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.drawImage(tmp, 0,0,G,G, 0,0,targetW,targetH); ctx.restore(); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBondTurretInto = drawBondTurretInto; }catch(_){ }

// Draw German tank body into a target canvas/context (pixel-accurate from German.html)
function drawGermanBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // native art in German.html is 384x384 with center offset; recreate and scale down
    const N = 384;
  const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
  // clear temporary canvas to avoid any leftover pixels from previous draws
  try{ o.clearRect(0,0,N,N); }catch(_){ }
    const OFFSET = 32;
    // palette (verbatim from German.html)
    const P = { deB:'#000000', deR:'#DD0000', deG:'#FFCE00', hull:'#6E7B86', hullL:'#8C99A3', hullD:'#3F4750', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', outline:'#000000', shadow:'#00000055' };
    // helpers adapted from German.html
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect((x|0)+OFFSET,(y|0)+OFFSET,w|0,h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };

    function rr(x,y,w,h,r,fill){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); o.restore(); }
    function ro(x,y,w,h,r,stroke){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); o.restore(); }
    function clipRR(x,y,w,h,r){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.clip(); }
    function ellipseShadow(cx,cy,rx,ry){ o.save(); o.translate(OFFSET,OFFSET); o.fillStyle=P.shadow; o.beginPath(); o.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); o.fill(); o.restore(); }

    // Fine seam helpers
    const seamH=(x,y,w)=>R(x,y,w,1,P.hullD);
    const seamV=(x,y,h)=>R(x,y,1,h,P.hullD);

  // leave background transparent for drivable (divable) tank so body can be composited over world

    // running gear (treads)
    function tread(x,y,w,h,t){
      rr(x,y,w,h,8,P.trackD);
      R(x+1,y+1,w-2,1,P.trackL);
      R(x+1,y+h-2,w-2,1,P.trackL);
      for(let i=0;i<6;i++){ R(x+3, y+8+i*((h-16)/5), w-6, 1, P.gun); }
      const step=6, off=Math.floor(t/7)%step;
      for(let i=0;i<h/step;i++){ const yy = y + ((i*step + off) % h); R(x+3, yy, w-6, 2, P.trackL); }
      rr(x+2,y+2,w-4,6,3,P.trackL);
      rr(x+2,y+h-8,w-4,6,3,P.trackL);
      ro(x,y,w,h,8,P.outline);
    }

    // national cross helper
    function balkenCross(cx,cy){ R(cx-3,cy-1,6,2,"#fff"); R(cx-1,cy-3,2,6,"#fff"); R(cx-2,cy-1,4,2,P.deB); R(cx-1,cy-2,2,4,P.deB); }

    // hull draw (verbatim structure)
    function hull(){
      // hull shell
      rr(70,136,180,92,24,P.hullL); ro(70,136,180,92,24,P.outline);
  // tricolor wrap for hull area using clipRR (which saves) and a single restore
  clipRR(70,136,180,92,24);
      R(70,136,180,30,P.deB);
      R(70,166,180,30,P.deR);
      R(70,196,180,32,P.deG);
  o.restore();
      R(72,140,176,2,P.hull);

      balkenCross(86,180); balkenCross(226,180);
      // upper deck: paint tricolor across the deck area so the whole visible body reads as German-themed
      function paintTricolor(x,y,w,h){
        clipRR(x,y,w,h,12);
        const h1 = Math.floor(h/3);
        R(x, y, w, h1, P.deB);
        R(x, y + h1, w, h1, P.deR);
        R(x, y + 2*h1, w, h - 2*h1, P.deG);
        o.restore();
      }
      rr(94,160,132,46,12,P.hull); ro(94,160,132,46,12,P.outline);
      paintTricolor(94,160,132,46);
      seamH(96,172,128); seamH(96,184,128); seamV(120,162,40); seamV(204,162,40);
      for(let i=0;i<7;i++){ R(100+i*18,171,1,1,P.steel); R(100+i*18,183,1,1,P.steel); }
      for(let i=0;i<14;i++){ R(100+i*9,198,6,2,P.gun); }
      rr(90,210,16,12,3,P.hullD); ro(90,210,16,12,3,P.outline); R(92,214,12,2,P.gun);
      rr(218,210,16,12,3,P.hullD); ro(218,210,16,12,3,P.outline); R(220,214,12,2,P.gun);
      rr(66,150,10,70,8,P.hullD); ro(66,150,10,70,8,P.outline);
      rr(244,150,10,70,8,P.hullD); ro(244,150,10,70,8,P.outline);
    }

    // turret draw invoked for preview composition
    function turret(t){
      // shift turret slightly left to better center top elements over hull
      const cx=156, cy=164; o.save(); o.translate(OFFSET+cx,OFFSET+cy); const a=Math.sin(t/120)*0.46; o.rotate(a);
      function TRR(x,y,w,h,r,fill){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); }
      function TRO(x,y,w,h,r,stroke){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); }

      TRR(-44,-34,88,68,20,P.hull); TRO(-44,-34,88,68,20,P.outline);
      o.save(); o.beginPath(); o.moveTo(-40+16,-30); o.arcTo(40,-30,40,30,16); o.arcTo(40,30,-40,30,16); o.arcTo(-40,30,-40,-30,16); o.arcTo(-40,-30,40,-30,16); o.closePath(); o.clip();
      o.fillStyle=P.deB; o.fillRect(-40,-30,80,18);
      o.fillStyle=P.deR; o.fillRect(-40,-12,80,18);
      o.fillStyle=P.deG; o.fillRect(-40,  6,80,18);
      o.restore();

  TRR(14,-10,18,18,8,P.hullL); TRO(14,-10,18,18,8,P.outline);
  // nudge steel cupola panels left for better centering
  R(24,-6,3,2,P.steel); R(24,-1,3,2,P.steel); R(11,-12,3,2,P.steel);

      TRR(-12,-12,24,24,6,P.hullD); TRO(-12,-12,24,24,6,P.outline); R(-4,-2,8,1,P.gun);

      balkenCross(-18,0);

      const sway=Math.sin(t/90)*3; o.fillStyle=P.gun; o.fillRect(-26,-42,2,12); for(let i=0;i<14;i++) o.fillRect(-25+Math.sin((i/14)*Math.PI)*(1+sway/6),-42-i,1,1,P.steel);

  // nudge main armor/steel panels left slightly
  o.fillStyle=P.steel; o.fillRect(12,-6,92,6); o.fillStyle=P.gun; o.fillRect(12,-6,92,2);
  o.fillStyle=P.steel; o.fillRect(12, 6,92,6); o.fillStyle=P.gun; o.fillRect(12,10,92,2);
  o.fillStyle=P.gun;   o.fillRect(104,-6,6,6); o.fillRect(104,6,6,6);
  R(105,-5,1,1,"#888"); R(107,-4,1,1,"#888"); R(109,-5,1,1,"#888");
  R(105, 7,1,1,"#888"); R(107, 8,1,1,"#888"); R(109, 7,1,1,"#888");
      TRR(8,-8,6,16,3,P.hullD); TRO(8,-8,6,16,3,P.outline);

      o.restore();
    }

  // compose frame: treads and hull only (turret rendered separately)
  tread(56,132,36,112, now);
  tread(228,132,36,112, now);
  hull();

    // scale tmp into target ctx while preserving aspect ratio (centered)
    try{
      if (ctx && ctx.drawImage){
        try{ ctx.imageSmoothingEnabled = false; }catch(_){ }
        ctx.clearRect(0,0,targetW,targetH);
        const scale = Math.min(targetW / N, targetH / N);
        const dw = Math.round(N * scale);
        const dh = Math.round(N * scale);
        const dx = Math.floor((targetW - dw) / 2);
        const dy = Math.floor((targetH - dh) / 2);
        ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh);
      }
    }catch(_){ }
  }catch(_){ }
}

// Draw German turret only (for rotating turret canvas)
function drawGermanTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
  const N = 384; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
  // clear temporary turret canvas before drawing
  try{ o.clearRect(0,0,N,N); }catch(_){ }
    const OFFSET = 32;
    const P = { deB:'#000000', deR:'#DD0000', deG:'#FFCE00', hull:'#6E7B86', hullL:'#8C99A3', hullD:'#3F4750', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', outline:'#000000', shadow:'#00000055' };
  function TRR(x,y,w,h,r,fill){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); o.restore(); }
  function TRO(x,y,w,h,r,stroke){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); o.restore(); }
  // small pixel helper used by turret (mirrors drawGermanBodyInto's R)
  const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect((x|0)+OFFSET,(y|0)+OFFSET,w|0,h|0); };
  function balkenCross(cx,cy){ R(cx-3,cy-1,6,2,"#fff"); R(cx-1,cy-3,2,6,"#fff"); R(cx-2,cy-1,4,2,P.deB); R(cx-1,cy-2,2,4,P.deB); }
    // turret draw (verbatim from German.html turret block)
  const cx = 160, cy = 160; o.save(); o.translate(OFFSET+cx,OFFSET+cy);
    function TRR_local(x,y,w,h,r,fill){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); }
    function TRO_local(x,y,w,h,r,stroke){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); }
    TRR_local(-44,-34,88,68,20,P.hull); TRO_local(-44,-34,88,68,20,P.outline);
    o.save(); o.beginPath(); o.moveTo(-40+16,-30); o.arcTo(40,-30,40,30,16); o.arcTo(40,30,-40,30,16); o.arcTo(-40,30,-40,-30,16); o.arcTo(-40,-30,40,-30,16); o.closePath(); o.clip();
    o.fillStyle=P.deB; o.fillRect(-40,-30,80,18);
    o.fillStyle=P.deR; o.fillRect(-40,-12,80,18);
    o.fillStyle=P.deG; o.fillRect(-40,6,80,18);
    o.restore();

    // Cupola ring with periscopes (exact coordinates from German.html)
    TRR_local(14,-10,18,18,8,P.hullL); TRO_local(14,-10,18,18,8,P.outline);
    R(28,-6,3,2,P.steel); R(28,-1,3,2,P.steel); R(15,-12,3,2,P.steel);

    // Vision slit on mantlet
    TRR_local(-12,-12,24,24,6,P.hullD); TRO_local(-12,-12,24,24,6,P.outline); R(-4,-2,8,1,P.gun);

    // Marking
    balkenCross(-18,0);

    // Antenna (static, no sway)
    o.fillStyle=P.gun; o.fillRect(-26,-42,2,12); for(let i=0;i<14;i++) o.fillRect(-25+Math.sin((i/14)*Math.PI)*(1),-42-i,1,1,P.steel);

    // Twin barrels with perforated muzzle brakes
    o.fillStyle=P.steel; o.fillRect(16,-6,92,6); o.fillStyle=P.gun; o.fillRect(16,-6,92,2);
    o.fillStyle=P.steel; o.fillRect(16,6,92,6); o.fillStyle=P.gun; o.fillRect(16,10,92,2);
    o.fillStyle=P.gun; o.fillRect(108,-6,6,6); o.fillRect(108,6,6,6);
    R(109,-5,1,1,"#888"); R(111,-4,1,1,"#888"); R(113,-5,1,1,"#888");
    R(109,7,1,1,"#888"); R(111,8,1,1,"#888"); R(113,7,1,1,"#888");

    // Barrel brace
    TRR_local(8,-8,6,16,3,P.hullD); TRO_local(8,-8,6,16,3,P.outline);
    o.restore();
    try{
      if (ctx && ctx.drawImage){
        try{ ctx.imageSmoothingEnabled = false; }catch(_){ }
        ctx.clearRect(0,0,targetW,targetH);
        const scale = Math.min(targetW / N, targetH / N);
        const dw = Math.round(N * scale);
        const dh = Math.round(N * scale);
        const dx = Math.floor((targetW - dw) / 2);
        const dy = Math.floor((targetH - dh) / 2);
        ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh);
      }
    }catch(_){ }
  }catch(_){ }
}

// Draw Mexican tank body into a target canvas/context (pixel-accurate from Mexico.html)
function drawMexicoBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // native art in Mexico.html is 320x320
    const N = 320;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Palette and helpers (ported from Mexico.html)
    const P = { mxG:'#006847', mxW:'#FFFFFF', mxR:'#CE1126', hullD:'#074D36', hullL:'#1E7F5C', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', gold:'#C8A200', brown:'#7B4B2A', bean:'#9C5B3A', bean2:'#8B4B33', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function rivet(x,y){ R(x,y,2,2,P.steel); }
    function bolt(x,y){ R(x,y,1,1,P.gunD); }
    function ellipseShadow(cx,cy,rx,ry){ o.save(); o.fillStyle=P.shadow; o.beginPath(); o.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); o.fill(); o.restore(); }
    function beanPixel(x,y){ R(x, y, 1, 1, Math.random() < 0.5 ? P.bean : P.bean2); if(Math.random()<0.6) R(x+1, y, 1, 1, P.bean2); if(Math.random()<0.4) R(x, y+1, 1, 1, P.bean); }
    function beanSack(x,y,w=14,h=10,seed=0){ R(x, y, w, h, P.brown); R(x + (w>>1) - 1, y-2, 2, 2, P.gun); R(x, y, w, 1, P.hullL); O(x, y, w, h, P.outline); for(let i=0;i<4;i++){ beanPixel(x + 2 + ((i*3 + seed)% (w-3)), y + 2 + (i%2)); } }
    function beanCrate(x,y,w=22,h=12,open=true,seed=0){ R(x, y, w, h, "#6b4a2f"); O(x, y, w, h, P.outline); for(let i=0;i<Math.floor(w/5);i++){ R(x + i*5, y, 1, h, "#5c3f29"); } R(x-2, y-2, w+4, 2, P.steel); R(x-2, y+h, w+4, 2, P.steel); if(open){ for(let i=0;i<30;i++){ const bx = x + 2 + ((i*3 + seed)% (w-4)); const by = y + 2 + (i% (h-4)); beanPixel(bx, by); } R(x, y-1, w, 1, "#7a5a3a"); } }

    function tread(x,y,w,h,t){ R(x,y,w,h,P.trackD); for(let i=0;i<5;i++){ R(x+2, y+6+i*((h-12)/4), w-4, 2, P.trackL); } const step = 6, off = Math.floor(t/7)%step; for(let i=0;i<h/step;i++){ const yy = y + ((i*step + off) % h); R(x+3, yy, w-6, 2, P.trackL); } O(x,y,w,h,P.outline); }

    function hull(){ R(76,140,168,80,P.hullL); R(78,142,164,76,P.hullL); R(68,146,8,72,P.hullD); R(244,146,8,72,P.hullD); R(88,120,144,20,P.hullL); R(90,120,140,6,P.mxG); O(88,120,144,20,P.outline); R(90,220,140,12,P.hullD); O(90,220,140,12,P.outline); for(let i=0;i<9;i++){ for(let j=0;j<2;j++){ const tx = 94 + i*15, ty = 126 + j*9; R(tx,ty,11,7,P.hullL); O(tx,ty,11,7,P.outline); bolt(tx+5,ty+3); } } R(92,156,136,48,P.hullL); R(94,158,132,44,P.hullL); O(92,156,136,48,P.outline); R(108,164,24,14,P.hullD); O(108,164,24,14,P.outline); rivet(114,168); rivet(122,168); R(188,164,24,14,P.hullD); O(188,164,24,14,P.outline); rivet(194,168); rivet(202,168); for(let i=0;i<10;i++){ R(112+i*10,196,6,2,P.gun); } for(let i=0;i<14;i++){ rivet(70,148+i*5); rivet(250,148+i*5); } O(76,140,168,80,P.outline); }

    function mexicanEmblemTiny(cx,cy){ R(cx-2, cy-1, 4, 3, P.gold); R(cx-4, cy+2, 8, 1, P.bean); R(cx-3, cy+1, 6, 1, P.brown); }

    function turret(t){ const cx=160, cy=164; o.save(); o.translate(cx,cy); const a = Math.sin(t/120)*0.46; o.rotate(a); R(-40,-30,80,60,P.hullL); R(-38,-28,76,56,P.hullL); O(-40,-30,80,60,P.outline); R(-46,-14,6,28,P.hullD); R(40,-14,6,28,P.hullD); O(-46,-14,6,28,P.outline); O(40,-14,6,28,P.outline); R(-10,-12,20,24,P.hullD); O(-10,-12,20,24,P.outline); R(-38,-28,24,56,P.mxG); R(-14,-28,24,56,P.mxW); R(10,-28,24,56,P.mxR); mexicanEmblemTiny(-2,-4); R(-22,-8,12,12,P.hullD); O(-22,-8,12,12,P.outline); rivet(-18,-4); rivet(-12,-4); const sway = Math.sin(t/90)*3; R(-26,-30,2, -12, P.gun); for(let i=0;i<14;i++){ R(-25 + Math.sin((i/14)*Math.PI)*(1+sway/6), -42 - i, 1, 1, P.steel); } R(16,-6,90,6,P.steel);  R(16,-6,90,2,P.gun); R(106,-6,2,6,P.gun); R(16, 6,90,6,P.steel);  R(16,10,90,2,P.gun); R(106,6,2,6,P.gun); R(8,-8,6,16,P.hullD); O(8,-8,6,16,P.outline); for(let i=0;i<6;i++){ bolt(-36+i*12,-28); bolt(-36+i*12,28); } o.restore(); }

    function beanRack(side="left", jiggle=0, tier=0){ const baseY = 146 - tier*18; const height = 64; const xBar = (side==="left") ? 66 : 246; R(xBar, baseY, 2, height, P.gun); R(xBar + ((side==="left")?6:-6), baseY, 2, height, P.gun); R(xBar-1, baseY, 10, 2, P.gun); R(xBar-1, baseY+height-2, 10, 2, P.gun); const xSack = (side==="left") ? xBar-12 : xBar- (14-2); for(let i=0;i<5;i++){ const yS = baseY + 4 + i* ((height-10)/5) + (i%2 ? jiggle : -jiggle); beanSack(xSack, yS, 14, 10, i + (tier*7)); } }

    function deckBeans(t){ R(92,156,136,2,P.steel); R(92,202,136,2,P.steel); const j = Math.round(Math.sin(t/150)); beanSack(96,160 + j, 14, 10, 1); beanSack(112,160 - j, 14, 10, 2); beanSack(202,160 - j, 14, 10, 3); beanSack(218,160 + j, 14, 10, 4); beanCrate(110,206,22,12,true, 11); beanCrate(188,206,22,12,true, 17); for(let i=0;i<10;i++){ beanPixel(110 + 2 + (i%20), 219 + (i%2)); beanPixel(188 + 2 + ((i+5)%20), 219 + (i%2)); } }

  // keep background transparent (no solid fill) so tank body composes over world
  function drawBG(){ ellipseShadow(160,210,105,26); }

  // don't draw turret into the body canvas; turret is rendered from the separate turret canvas
  function frame(t){ drawBG(); tread(56,132,36,112,t); tread(228,132,36,112,t); hull(); const jiggle = Math.round(Math.sin(t/140)); beanRack("left",  jiggle, 0); beanRack("left", -jiggle, 1); beanRack("right", -jiggle, 0); beanRack("right",  jiggle, 1); deckBeans(t); }

    // compose once into tmp
    try{ frame(now); }catch(_){ }

    // scale tmp into target ctx
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw Mexican turret only (for rotating turret canvas)
function drawMexicoTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 320; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Reuse helpers/palette from body draw
    const P = { mxG:'#006847', mxW:'#FFFFFF', mxR:'#CE1126', hullD:'#074D36', hullL:'#1E7F5C', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', gold:'#C8A200', brown:'#7B4B2A', bean:'#9C5B3A', bean2:'#8B4B33', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function mexicanEmblemTiny(cx,cy){ R(cx-2, cy-1, 4, 3, P.gold); R(cx-4, cy+2, 8, 1, P.bean); R(cx-3, cy+1, 6, 1, P.brown); }
  // turret (same pivot as in Mexico.html)
  const cx=160, cy=160; o.save(); o.translate(cx,cy);
    // turret body
    R(-40,-30,80,60,P.hullL); R(-38,-28,76,56,P.hullL); O(-40,-30,80,60,P.outline);
    R(-38,-28,24,56,P.mxG); R(-14,-28,24,56,P.mxW); R(10,-28,24,56,P.mxR);
    mexicanEmblemTiny(-2,-4);
    // cupola and periscopes
    R(-22,-8,12,12,P.hullD); O(-22,-8,12,12,P.outline);
    // antenna (static, no sway)
    R(-26,-30,2, -12, P.gun); for(let i=0;i<14;i++){ R(-25 + Math.sin((i/14)*Math.PI)*(1), -42 - i, 1, 1, P.steel); }
    // heavy twin barrels
    R(16,-6,90,6,P.steel);  R(16,-6,90,2,P.gun); R(106,-6,2,6,P.gun);
    R(16, 6,90,6,P.steel);  R(16,10,90,2,P.gun); R(106,6,2,6,P.gun);
    o.restore();

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw China tank body (256x256 native) into target canvas
function drawChinaBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 256;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { red:'#C8102E', redD:'#660000', redL:'#FF3333', gold:'#FFD700', goldL:'#FFF59D', gun:'#212121', steel:'#B0BEC5', trackD:'#111111', trackL:'#444444', shadow:'#00000066', outline:'#000' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const rectO = (x,y,w,h,c)=>{ px(x,y,w,1,c); px(x,y+h-1,w,1,c); px(x,y,1,h,c); px(x+w-1,y,1,h,c); };
    const rivet = (x,y)=>{ px(x,y,2,2,P.steel); };
    function star(x,y,size,col){ o.fillStyle=col; for(let i=-size;i<=size;i++){ for(let j=-size;j<=size;j++){ if(Math.abs(i)+Math.abs(j)<=size) o.fillRect(x+i,y+j,1,1); } } }
    function tread(x,y,w,h,t){ px(x,y,w,h,P.trackD); let step=6,off=Math.floor(t/8)%step; for(let i=0;i<h/step;i++){ px(x+3,y+((i*step+off)%h),w-6,2,P.trackL); } rectO(x,y,w,h,P.outline); }
    function hull(){ px(64,96,128,64,P.red); px(66,98,124,60,P.redL); px(60,100,4,56,P.redD); px(192,100,4,56,P.redD); px(72,84,112,12,P.red); px(74,84,108,4,P.redL); px(72,160,112,8,P.redD); for(let i=0;i<10;i++){ rivet(64+i*12,96); } for(let i=0;i<10;i++){ rivet(64+i*12,160); } rectO(64,96,128,64,P.outline); rectO(72,84,112,12,P.outline); rectO(72,160,112,8,P.outline); }
    function turretBody(t){ const cx=128,cy=128; o.save(); o.translate(cx,cy); let a=Math.sin(t/100)*0.55; o.rotate(a); px(-28,-24,56,48,P.red); px(-26,-22,52,44,P.redL); px(-32,-12,4,24,P.redD); px(28,-12,4,24,P.redD); px(-6,-12,12,24,P.redD); rivet(-20,-20); rivet(20,-20); rivet(-20,20); rivet(20,20); rectO(-28,-24,56,48,P.outline); px(16,-6,60,6,P.steel);px(16,-6,60,2,P.gun); px(16,6,60,6,P.steel);px(16,10,60,2,P.gun); px(76,-6,2,6,P.gun);px(76,6,2,6,P.gun); star(-12,-12,3,P.gold); px(8,-20,3,3,P.gold); px(16,-12,3,3,P.gold); px(16,-4,3,3,P.gold); px(12,4,3,3,P.gold); o.restore(); }
    function shadow(){ o.fillStyle=P.shadow; o.beginPath(); o.ellipse(128,176,80,20,0,0,Math.PI*2); o.fill(); }

    // keep background transparent and render hull/treads; turret drawn only in turret canvas
    shadow();
    tread(48,88,28,96, now);
    tread(180,88,28,96, now);
    hull();

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw China turret only (for rotating turret canvas)
function drawChinaTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 256; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { red:'#C8102E', redD:'#660000', redL:'#FF3333', gold:'#FFD700', goldL:'#FFF59D', gun:'#212121', steel:'#B0BEC5', trackD:'#111111', trackL:'#444444', shadow:'#00000066', outline:'#000' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const rectO = (x,y,w,h,c)=>{ px(x,y,w,1,c); px(x,y+h-1,w,1,c); px(x,y,1,h,c); px(x+w-1,y,1,h,c); };
    const rivet = (x,y)=>{ px(x,y,2,2,P.steel); };
    const star = (x,y,size,col)=>{ o.fillStyle=col; for(let i=-size;i<=size;i++){ for(let j=-size;j<=size;j++){ if(Math.abs(i)+Math.abs(j)<=size) o.fillRect(x+i,y+j,1,1); } } };
    const cx=128,cy=128; o.save(); o.translate(cx,cy);
    px(-28,-24,56,48,P.red); px(-26,-22,52,44,P.redL); px(-32,-12,4,24,P.redD); px(28,-12,4,24,P.redD); px(-6,-12,12,24,P.redD); rivet(-20,-20); rivet(20,-20); rivet(-20,20); rivet(20,20); rectO(-28,-24,56,48,P.outline); px(16,-6,60,6,P.steel);px(16,-6,60,2,P.gun); px(16,6,60,6,P.steel);px(16,10,60,2,P.gun); px(76,-6,2,6,P.gun);px(76,6,2,6,P.gun); star(-12,-12,3,P.gold); px(8,-20,3,3,P.gold); px(16,-12,3,3,P.gold); px(16,-4,3,3,P.gold); px(12,4,3,3,P.gold);
    o.restore();

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// McD's tank (64x64 native) body + turret
function drawMcdsBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 64; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { bg:'#22252a', trackDark:'#2b2b2b', trackLite:'#777777', hullRed:'#c1121f', hullDeep:'#7a0e14', archGold:'#ffd100', roof:'#6b3e2e', roofLite:'#8a543c', window:'#7cc7ff', shadow:'#141414', white:'#ffffff', black:'#000000', green:'#2f6c3f', bun:'#d8a55a', bunDark:'#b27e39', lettuce:'#4aa54a', cheese:'#f9d65a', patty:'#5a2f1d', tomato:'#c44a3a' };
    const rect = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const px = (x,y,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,1,1); };
  // keep background transparent for McD's body
  function drawGround(){ /* intentionally empty to preserve transparency */ }
    function tread(x,y,offset){ rect(x,y,8,48,P.trackDark); rect(x,y,1,48,P.trackLite); rect(x+7,y,1,48,P.shadow); for(let i=y+(offset%4); i<y+48; i+=4){ rect(x+1,i,6,2,P.black); rect(x+1,i+1,6,1,P.trackLite); } }
    function drawHull(){ rect(13,44,38,8,P.hullDeep); rect(13,12,38,40,P.hullRed); rect(14,16,36,2,P.archGold); rect(14,20,36,1,P.archGold); const wx=[18,26,34,42]; wx.forEach(x=>{ rect(x,23,4,4,P.window); px(x,23,P.white); }); wx.forEach(x=>{ rect(x,29,4,4,P.window); px(x+1,29,P.white); }); rect(30,36,6,8,P.black); rect(31,37,4,6,P.window); px(34,39,P.white); [16,22,40,46].forEach(x=>{ rect(x,43,3,2,P.green); px(x+1,42,P.green); }); facadeM(30,33); }
    function facadeM(fx,fy){ rect(fx-7,fy-8,3,9,P.archGold); rect(fx+5,fy-8,3,9,P.archGold); rect(fx-2,fy-5,2,2,P.archGold); rect(fx,fy-3,2,2,P.archGold); rect(fx+2,fy-5,2,2,P.archGold); rect(fx-7,fy-8,15,1,P.archGold); rect(fx-4,fy-6,2,1,P.hullDeep); rect(fx+2,fy-6,2,1,P.hullDeep); }
    function drawRoof(){ rect(18,10,28,6,P.roof); rect(18,10,28,1,P.roofLite); rect(21,11,2,2,P.shadow); rect(41,11,2,2,P.shadow); }
    function turret(angleRad){ o.save(); o.translate(32,32); o.rotate(angleRad); rect(-8,5,16,2,P.bunDark); rect(-8,3,16,2,P.patty); rect(-9,1,18,2,P.cheese); rect(-8,-1,16,2,P.lettuce); rect(-8,-3,16,2,P.tomato); rect(-8,-7,16,4,P.bun); if (Math.floor(now/120) % 2 === 0){ px(-5,-7,P.white); px(0,-7,P.white); px(5,-7,P.white); } // turret M
      // M
      rect(-5,-7,2,6,P.archGold); rect(3,-7,2,6,P.archGold); rect(-2,-5,2,2,P.archGold); rect(0,-4,2,2,P.archGold); rect(2,-5,2,2,P.archGold); rect(-5,-8,10,1,P.archGold); rect(-3,-6,1,1,P.hullDeep); rect(2,-6,1,1,P.hullDeep);
      rect(8,-1,12,2,P.archGold); px(19,-1,P.white); if (Math.floor(now/120) % 3 === 0) px(20,-1,'#ff4d4d'); o.restore(); }

  // compose (no background fill here; turret is rendered from turret canvas)
  // scale the McD body art down so the body is 75% of the native 64px canvas
  try{ o.save(); o.translate(32,32); o.scale(0.75,0.75); o.translate(-32,-32);
    tread(6,8, Math.floor(now/120)); tread(64-14,8, Math.floor(now/120)); drawHull(); drawRoof();
  }catch(_){ }
  try{ o.restore(); }catch(_){ }
  const angle = ((Math.floor(now/120) % 6) * (Math.PI*2/6));

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

function drawMcdsTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now(); const N = 64; const tmp = document.createElement('canvas'); tmp.width=N; tmp.height=N; const o=tmp.getContext('2d'); try{o.imageSmoothingEnabled=false;}catch(_){ }
    try{o.clearRect(0,0,N,N);}catch(_){ }
    const P = { bun:'#d8a55a', bunDark:'#b27e39', patty:'#5a2f1d', cheese:'#f9d65a', lettuce:'#4aa54a', tomato:'#c44a3a', archGold:'#ffd100', white:'#ffffff' };
    const rect=(x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const px=(x,y,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,1,1); };
  const angle = -Math.PI/2; // -90-degree rotation to flip backwards turret
  o.save(); o.translate(32,32); // pivot
  o.rotate(angle); // use base animation angle (remove extra 180deg rotation)
  o.scale(0.75, 0.75); // reduce turret size by 25%
    rect(-8,5,16,2,P.bunDark); rect(-8,3,16,2,P.patty); rect(-9,1,18,2,P.cheese); rect(-8,-1,16,2,P.lettuce); rect(-8,-3,16,2,P.tomato); rect(-8,-7,16,4,P.bun); rect(-5,-7,2,6,P.archGold); rect(3,-7,2,6,P.archGold); rect(-2,-5,2,2,P.archGold); rect(0,-4,2,2,P.archGold); rect(2,-5,2,2,P.archGold); rect(-5,-8,10,1,P.archGold); rect(-3,-6,1,1,P.patty); rect(2,-6,1,1,P.patty); rect(8,-1,12,2,P.archGold); px(19,-1,P.white); px(20,-1,P.white); o.restore();
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// helper: compute scale to draw an arbitrary sprite canvas so it matches game display size
function getCanvasDrawScale(spriteCanvas){
  try{
    // nativeW: actual pixels in provided canvas
    const nativeW = (spriteCanvas && spriteCanvas.width) ? spriteCanvas.width : SPR_W;
    // logicalSPR: the expected logical sprite width in game units (defaults to SPR_W)
    const logicalSPR = (spriteCanvas && spriteCanvas._logicalSPR) ? spriteCanvas._logicalSPR : SPR_W;
    const effScale = effectiveTankScale();
    // scale so that logicalSPR * effScale maps to nativeW pixels, then apply camera.zoom
    return ((logicalSPR * effScale) / nativeW) * camera.zoom;
  }catch(_){
    return effectiveTankScale() * camera.zoom;
  }
}



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

// Draw French tank body into a target canvas/context (pixel-accurate from French.html)
function drawFrenchBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // native art in French.html is 320x320
    const N = 320;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Palette and helpers (ported from French.html)
    const P = { frB:'#0055A4', frW:'#FFFFFF', frR:'#EF4135', hullB:'#0A3F7A', hullBL:'#1E6BC1', hullBD:'#062846', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#464646', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function rivet(x,y){ R(x,y,2,2,P.steel); }
    function bolt(x,y){ R(x,y,1,1,P.gunD); }
    function ellipseShadow(cx,cy,rx,ry){ o.save(); o.fillStyle=P.shadow; o.beginPath(); o.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); o.fill(); o.restore(); }

    // Treads
    function tread(x,y,w,h,t){
      R(x,y,w,h,P.trackD);
      for (let i=0;i<5;i++){ R(x+2, y+6+i*((h-12)/4), w-4, 2, P.trackL); }
      const step = 6, off = Math.floor(t/7)%step;
      for (let i=0;i<h/step;i++){ const yy = y + ((i*step + off) % h); R(x+3, yy, w-6, 2, P.trackL); }
      O(x,y,w,h,P.outline);
    }

    // Hull
    function hull(){
      R(76,140,168,80,P.hullB);
      R(78,142,164,76,P.hullBL);
      R(68,146,8,72,P.hullBD);
      R(244,146,8,72,P.hullBD);
      R(88,120,144,20,P.hullB);
      R(90,120,140,6,P.hullBL);
      O(88,120,144,20,P.outline);
      R(90,220,140,12,P.hullBD);
      O(90,220,140,12,P.outline);
      for (let i=0;i<9;i++){
        for (let j=0;j<2;j++){
          const tx = 94 + i*15, ty = 126 + j*9;
          R(tx,ty,11,7,P.hullB);
          O(tx,ty,11,7,P.outline);
          bolt(tx+5,ty+3);
        }
      }
      R(92,156,136,48,P.hullB);
      R(94,158,132,44,P.hullBL);
      O(92,156,136,48,P.outline);
      R(108,164,24,14,P.hullBD); O(108,164,24,14,P.outline); rivet(114,168); rivet(122,168);
      R(188,164,24,14,P.hullBD); O(188,164,24,14,P.outline); rivet(194,168); rivet(202,168);
      for (let i=0;i<10;i++){ R(112+i*10,196,6,2,P.gun); }
      for (let i=0;i<14;i++){ rivet(70,148+i*5); rivet(250,148+i*5); }
      O(76,140,168,80,P.outline);
    }

    // Shadow
    ellipseShadow(160,210,105,26);

    // Render treads and hull
    tread(56,132,36,112,now);
    tread(228,132,36,112,now);
    hull();

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw French turret only (for rotating turret canvas)
function drawFrenchTurretInto(ctx, targetW, targetH, ts, angle){
  try{
    const now = ts || performance.now();
    const N = 320; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { frB:'#0055A4', frW:'#FFFFFF', frR:'#EF4135', hullB:'#0A3F7A', hullBL:'#1E6BC1', hullBD:'#062846', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#464646', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function rivet(x,y){ R(x,y,2,2,P.steel); }
    function frenchRoundel(cx,cy){ R(cx-6,cy-6,12,12,P.frB); R(cx-4,cy-4,8,8,P.frW); R(cx-2,cy-2,4,4,P.frR); }

    const cx=160, cy=164; o.save(); o.translate(cx,cy);
    // Draw turret pointing to the right (forward direction) by default
    // The game engine will rotate this canvas to point toward the cursor
    const defaultAngle = angle !== undefined ? angle : Math.PI/2; // 90 degrees (right) by default
    o.rotate(defaultAngle);

    R(-40,-30,80,60,P.hullB);
    R(-38,-28,76,56,P.hullBL);
    O(-40,-30,80,60,P.outline);
    R(-46,-14,6,28,P.hullBD);
    R(40,-14,6,28,P.hullBD);
    O(-46,-14,6,28,P.outline);
    O(40,-14,6,28,P.outline);
    R(-10,-12,20,24,P.hullBD);
    O(-10,-12,20,24,P.outline);
    R(-38,-28,24,56,P.frB);
    R(-14,-28,24,56,P.frW);
    R(10,-28,24,56,P.frR);
    R(-36,-28,72,2,P.hullBL);
    frenchRoundel(18,-10);
    R(-22,-8,12,12,P.hullBD); O(-22,-8,12,12,P.outline); rivet(-18,-4); rivet(-12,-4);
    // Fixed gun position pointing forward (right)
    R(30,-2,2, 4, P.gun); // Main gun barrel pointing right
    for(let i=0;i<16;i++){ R(32 + i, -1, 1, 1, P.steel); } // Long barrel extension
    // Side guns
    R(16,-6,60,6,P.steel); R(16,-6,60,2,P.gun); // Top side gun
    R(76,-6,2,6,P.gun);
    R(16, 6,60,6,P.steel); R(16,10,60,2,P.gun); // Bottom side gun
    R(76,6,2,6,P.gun);
    R(8,-8,6,16,P.hullBD); O(8,-8,6,16,P.outline);
    for(let i=0;i<6;i++){ R(-36+i*12,-28,1,1,P.gunD); R(-36+i*12,28,1,1,P.gunD); }
    o.restore();

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawFrenchBodyInto = drawFrenchBodyInto; }catch(_){ }
try{ if (typeof window !== 'undefined') window.drawFrenchTurretInto = drawFrenchTurretInto; }catch(_){ }

// Draw Waffle tank body into a target canvas/context (pixel-accurate from Waffel.html)
function drawWaffleBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // Original 64x64 resolution
    const N = 64;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }

    // Color palette from Waffel.html
    const COL = {
      waffleL: '#F4CC7A', waffle: '#E3AF52', waffleD: '#C88D35', waffleX: '#9F6B23',
      waffleEdgeD: '#7F531B', syrup: '#7B3A14', syrupD: '#5E2B0F', syrupL: '#9C4B1B',
      syrupHL: '#C76934', butter: '#FFF2AC', butterD: '#E5D07C', steelL: '#9AA0A8',
      steel: '#6F7781', steelD: '#3D4249', tread: '#1B1C1F', treadL: '#2A2C31',
      treadHL: '#3A3D45', shadow: 'rgba(0,0,0,0.25)', rim: 'rgba(255,255,255,0.06)',
      bolt: '#A18F64'
    };

    // Helper functions
    const px = (x, y, c) => { o.fillStyle = c; o.fillRect(x|0, y|0, 1, 1); };
    const rect = (x, y, w, h, c) => { o.fillStyle = c; o.fillRect(x|0, y|0, w|0, h|0); };
    const hline = (x, y, w, c) => { rect(x, y, w, 1, c); };
    const vline = (x, y, h, c) => { rect(x, y, 1, h, c); };
    const fillCircle = (cx, cy, r, c) => {
      o.fillStyle = c; o.beginPath(); o.arc(cx+0.5, cy+0.5, r, 0, Math.PI*2); o.closePath(); o.fill();
    };
    function roundRect(x, y, w, h, r, c) {
      o.fillStyle = c; o.beginPath();
      o.moveTo(x+r, y); o.lineTo(x+w-r, y); o.lineTo(x+w, y+r); o.lineTo(x+w, y+h-r);
      o.lineTo(x+w-r, y+h); o.lineTo(x+r, y+h); o.lineTo(x, y+h-r); o.lineTo(x, y+r);
      o.closePath(); o.fill();
    }

    // Tank geometry - scaled down to 75% size
    const scale = 0.75;
    const cx = 32, cy = 32;
    const hull = { x: cx - 15*scale, y: cy - 15*scale, w: 30*scale, h: 30*scale, r: 4.5*scale };
    const treadL = { x: cx - 20*scale, y: cy - 14*scale, w: 6*scale, h: 33*scale };
    const treadR = { x: cx + 14*scale, y: cy - 14*scale, w: 6*scale, h: 33*scale };

    // Draw treads
    roundRect(treadL.x, treadL.y, treadL.w, treadL.h, 3, COL.tread);
    rect(treadL.x+1, treadL.y+1, treadL.w-2, treadL.h-2, COL.treadL);
    roundRect(treadR.x, treadR.y, treadR.w, treadR.h, 3, COL.tread);
    rect(treadR.x+1, treadR.y+1, treadR.w-2, treadR.h-2, COL.treadL);

    // Lug pattern on treads
    const step = 4.5 * scale;
    for (let y=treadL.y+1.5*scale; y<treadL.y+treadL.h-1.5*scale; y+=step) {
      rect(treadL.x+1.5*scale, y, 3*scale, 1.5*scale, COL.treadHL);
    }
    for (let y=treadR.y+1.5*scale; y<treadR.y+treadR.h-1.5*scale; y+=step) {
      rect(treadR.x+1.5*scale, y, 3*scale, 1.5*scale, COL.treadHL);
    }

    // Tiny steel rollers
    for (let y=treadL.y+4.5*scale; y<treadL.y+treadL.h-4.5*scale; y+=7.5*scale) {
      fillCircle(treadL.x+3*scale, y, 0.9*scale, COL.steel);
      fillCircle(treadR.x+3*scale, y, 0.9*scale, COL.steel);
    }

    // Draw hull (waffle body)
    roundRect(hull.x, hull.y, hull.w, hull.h, hull.r, COL.waffle);

    // Edge shading
    rect(hull.x, hull.y+hull.h-4, hull.w, 4, COL.waffleD);
    rect(hull.x+hull.w-4, hull.y, 4, hull.h, COL.waffleD);
    rect(hull.x+hull.w-1, hull.y+2, 1, hull.h-4, COL.waffleEdgeD);
    rect(hull.x+2, hull.y+hull.h-1, hull.w-4, 1, COL.waffleEdgeD);

    // Top-left rim light
    rect(hull.x, hull.y, hull.w-6, 1, COL.waffleL);
    rect(hull.x, hull.y+1, 1, hull.h-6, COL.waffleL);

    // Waffle grid pattern
    const gridStep = 4.5 * scale; // Scaled grid spacing
    const gx0 = hull.x + 2.25*scale, gx1 = hull.x + hull.w - 2.25*scale;
    const gy0 = hull.y + 2.25*scale, gy1 = hull.y + hull.h - 2.25*scale;
    for (let x = gx0; x <= gx1; x += gridStep) vline(x, gy0, gy1-gy0, COL.waffleX);
    for (let y = gy0; y <= gy1; y += gridStep) hline(gx0, y, gx1-gx0, COL.waffleX);

    // Intersection nubs
    for (let x = gx0; x <= gx1; x += gridStep) {
      for (let y = gy0; y <= gy1; y += gridStep) {
        px(x, y, COL.waffleD);
      }
    }

    // Hull bolts
    const bolts = [
      [hull.x + 4.5*scale, hull.y + 4.5*scale], 
      [hull.x + hull.w - 5.25*scale, hull.y + 4.5*scale],
      [hull.x + 4.5*scale, hull.y + hull.h - 5.25*scale], 
      [hull.x + hull.w - 5.25*scale, hull.y + hull.h - 5.25*scale]
    ];
    bolts.forEach(([x,y]) => { fillCircle(x, y, 0.75*scale, COL.bolt); });

    // Inner vignette for depth
    o.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(hull.x + 1.5*scale, hull.y + 1.5*scale, hull.w - 3*scale, hull.h - 3*scale, hull.r - 1.5*scale, o.fillStyle);

    // Syrup blob - scaled
    o.fillStyle = COL.syrup;
    o.beginPath();
    o.moveTo(cx - 4.5*scale, cy - 7.5*scale); 
    o.lineTo(cx + 5.25*scale, cy - 6.75*scale); 
    o.lineTo(cx + 8.25*scale, cy - 3*scale);
    o.lineTo(cx + 6*scale, cy + 3*scale); 
    o.lineTo(cx + 1.5*scale, cy + 6*scale); 
    o.lineTo(cx - 6*scale, cy + 4.5*scale);
    o.lineTo(cx - 8.25*scale, cy - 0.75*scale); 
    o.lineTo(cx - 6*scale, cy - 5.25*scale); 
    o.closePath();
    o.fill();

    // Syrup shading & highlight
    roundRect(cx - 3.75*scale, cy - 3*scale, 9*scale, 4.5*scale, 1.5*scale, COL.syrupD);
    roundRect(cx - 1.5*scale, cy - 5.25*scale, 4.5*scale, 2.25*scale, 0.75*scale, COL.syrupHL);

    // Butter pat
    o.save();
    o.translate(cx + 3.75*scale, cy - 1.5*scale);
    o.rotate(-0.15);
    rect(-2.25*scale, -2.25*scale, 5.25*scale, 5.25*scale, COL.butter);
    rect(-2.25*scale, 0.75*scale, 5.25*scale, 2.25*scale, COL.butterD);
    o.restore();

    // Rim light
    o.fillStyle = COL.rim;
    roundRect(hull.x - 1.5*scale, hull.y - 1.5*scale, hull.w - 4.5*scale, 1.5*scale, 1.5*scale, o.fillStyle);
    roundRect(hull.x - 1.5*scale, hull.y - 1.5*scale, 1.5*scale, hull.h - 4.5*scale, 1.5*scale, o.fillStyle);

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw Waffle tank turret into a target canvas/context (pixel-accurate from Waffel.html)
function drawWaffleTurretInto(ctx, targetW, targetH, ts, angle){
  try{
    const now = ts || performance.now();
    // Original 64x64 resolution
    const N = 64;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }

    // Color palette from Waffel.html
    const COL = {
      waffleL: '#F4CC7A', waffle: '#E3AF52', waffleD: '#C88D35', waffleX: '#9F6B23',
      waffleEdgeD: '#7F531B', syrup: '#7B3A14', syrupD: '#5E2B0F', syrupL: '#9C4B1B',
      syrupHL: '#C76934', butter: '#FFF2AC', butterD: '#E5D07C', steelL: '#9AA0A8',
      steel: '#6F7781', steelD: '#3D4249', tread: '#1B1C1F', treadL: '#2A2C31',
      treadHL: '#3A3D45', shadow: 'rgba(0,0,0,0.25)', rim: 'rgba(255,255,255,0.06)',
      bolt: '#A18F64'
    };

    // Helper functions
    const rect = (x, y, w, h, c) => { o.fillStyle = c; o.fillRect(x|0, y|0, w|0, h|0); };
    const fillCircle = (cx, cy, r, c) => {
      o.fillStyle = c; o.beginPath(); o.arc(cx+0.5, cy+0.5, r, 0, Math.PI*2); o.closePath(); o.fill();
    };

    // Tank geometry - scaled down to 75% size
    const scale = 0.75;
    const cx = 32, cy = 32;

    // Save/rotate around center
    o.save();
    o.translate(cx, cy);
    const defaultAngle = angle !== undefined ? angle : 0;
    o.rotate(defaultAngle);
    o.translate(-cx, -cy);

    // Turret ring (steel)
    fillCircle(cx, cy, 6*scale, COL.steelD);
    fillCircle(cx, cy, 5.25*scale, COL.steel);

    // Rotate pitcher-style turret around center
    o.save();
    o.translate(cx, cy);
    o.rotate(0); // No additional rotation for static turret
    o.translate(-cx, -cy);

    // Base dome
    fillCircle(cx, cy, 4.5*scale, COL.steelL);

    // Spout/barrel (wide → narrow)
    o.fillStyle = COL.steel;
    o.beginPath();
    o.moveTo(cx + 1.5*scale, cy - 1.5*scale); 
    o.lineTo(cx + 8.25*scale, cy - 1.25*scale); 
    o.lineTo(cx + 10.5*scale, cy + 0*scale);
    o.lineTo(cx + 8.25*scale, cy + 1.25*scale); 
    o.lineTo(cx + 1.5*scale, cy + 1.5*scale); 
    o.closePath();
    o.fill();

    // Spout lip highlight
    rect(cx + 8.25*scale, cy - 1.25*scale, 1.5*scale, 0.75*scale, '#B8C0CA');

    // Top hatch highlight & rim
    rect(cx - 2.25*scale, cy - 3*scale, 4.5*scale, 0.75*scale, 'rgba(255,255,255,0.2)');
    rect(cx - 3*scale, cy + 2.25*scale, 6*scale, 0.75*scale, 'rgba(0,0,0,0.2)');

    o.restore();
    o.restore();

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawWaffleBodyInto = drawWaffleBodyInto; }catch(_){ }
try{ if (typeof window !== 'undefined') window.drawWaffleTurretInto = drawWaffleTurretInto; }catch(_){ }

// Draw Facebook tank body into a target canvas/context (pixel-accurate from facebook.html)
function drawFacebookBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // Keep original 64x64 resolution but scale down for smaller appearance
    const N = 64;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Palette and helpers (ported from facebook.html)
    const P = { blue:'#1877F2', blueDark:'#0E5AAB', blueLite:'#7FB3FF', steelDark:'#2C3E50', steelMid:'#3C556B', steelLite:'#8EA1B2', night:'#12233A', white:'#FFFFFF' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const lineH = (x,y,w,c)=>px(x,y,w,1,c);
    const lineV = (x,y,h,c)=>px(x,y,1,h,c);

    function chunkyRect(x,y,w,h,fill,edge){
      px(x,y+1,1,h-2,edge);
      px(x+w-1,y+1,1,h-2,edge);
      px(x+1,y,w-2,1,edge);
      px(x+1,y+h-1,w-2,1,edge);
      px(x,y,2,1,edge); px(x,y,1,2,edge);
      px(x+w-2,y,2,1,edge); px(x+w-1,y,1,2,edge);
      px(x,y+h-1,1,2,edge); px(x,y+h-2,2,1,edge);
      px(x+w-2,y+h-1,2,1,edge); px(x+w-1,y+h-2,1,2,edge);
      px(x+1,y+1,w-2,h-2,fill);
    }

    const CX = 32, CY = 32;
    const bodyW = 36, bodyH = 24;
    const bodyX = CX - (bodyW>>1), bodyY = CY - (bodyH>>1);
    const treadW = 6;
    const treadTop = bodyY - 4;
    const treadBot = bodyY + bodyH + 4;
    // Move treads closer to the body (reduced gap from 8 to 4 pixels)
    const leftTreadX = bodyX - (treadW + 1);
    const rightTreadX = bodyX + bodyW + 1;

    function drawTracks(offset){
      chunkyRect(leftTreadX, treadTop, treadW, (treadBot - treadTop), P.steelMid, P.steelDark);
      chunkyRect(rightTreadX, treadTop, treadW, (treadBot - treadTop), P.steelMid, P.steelDark);

      // Create rolling animation by using time-based offset
      const treadHeight = treadBot - treadTop;
      const patternHeight = 8; // Match the offset range for smoother animation

      for (let y = treadTop + 2; y < treadBot - 2; y++){
        // Calculate rolling position based on time and vertical position
        const rollingPhase = ((y - treadTop + offset) % patternHeight) / patternHeight;
        const col = (rollingPhase < 0.5) ? P.steelDark : P.steelLite;
        lineH(leftTreadX+1, y, treadW-2, col);
        lineH(rightTreadX+1, y, treadW-2, col);
      }

      // Animate studs with rolling motion
      const numStuds = 5;
      const studSpacing = (treadBot - treadTop - 8) / (numStuds - 1);
      for (let i = 0; i < numStuds; i++) {
        const baseY = treadTop + 4 + (i * studSpacing);
        // Add rolling offset to stud position with consistent timing
        const rollingY = baseY + Math.sin((now * 0.008) + (i * 0.8)) * 1.5;
        if (rollingY >= treadTop + 2 && rollingY <= treadBot - 4) {
          px(leftTreadX + 2, Math.round(rollingY), 2, 2, P.steelDark);
          px(leftTreadX + 2, Math.round(rollingY), 1, 1, P.steelLite);
          px(rightTreadX + 2, Math.round(rollingY), 2, 2, P.steelDark);
          px(rightTreadX + 2, Math.round(rollingY), 1, 1, P.steelLite);
        }
      }
    }

    function drawBody(){
      chunkyRect(bodyX, bodyY+1, bodyW, bodyH, P.night, P.night);
      chunkyRect(bodyX, bodyY, bodyW, bodyH, P.blue, P.steelDark);
      px(bodyX+1, bodyY+1, 3, bodyH-2, P.blueDark);
      px(bodyX+1, bodyY+bodyH-4, bodyW-2, 3, P.blueDark);
      px(bodyX+2, bodyY+1, bodyW-4, 1, P.blueLite);
      px(bodyX+bodyW-3, bodyY+2, 1, bodyH-4, P.blueLite);
      for (let i = 0; i < 6; i++) {
        lineH(bodyX+5, bodyY+4 + i*3, bodyW-10, P.steelMid);
      }
      px(bodyX+3, bodyY+3, 1,1, P.steelLite);
      px(bodyX+bodyW-4, bodyY+3, 1,1, P.steelLite);
      px(bodyX+3, bodyY+bodyH-4, 1,1, P.steelLite);
      px(bodyX+bodyW-4, bodyY+bodyH-4, 1,1, P.steelLite);
    }

    // Removed blue background - now transparent
    // px(0, 0, 64, 64, '#0b1522');

    // Render tracks and body with enhanced rolling animation
    const treadOffset = Math.floor(now * 0.008) % 8; // Faster, smoother rolling
    drawTracks(treadOffset);
    drawBody();

    // draw into target with scaling to make it appear smaller
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N) * 0.5; const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawFacebookBodyInto = drawFacebookBodyInto; }catch(_){ }

// Draw Facebook turret only (for rotating turret canvas)
function drawFacebookTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 64; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { blue:'#1877F2', blueDark:'#0E5AAB', blueLite:'#7FB3FF', steelDark:'#2C3E50', steelMid:'#3C556B', steelLite:'#8EA1B2', night:'#12233A', white:'#FFFFFF' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const lineH = (x,y,w,c)=>px(x,y,w,1,c);
    const lineV = (x,y,h,c)=>px(x,y,1,h,c);

    function chunkyRect(x,y,w,h,fill,edge){
      px(x,y+1,1,h-2,edge);
      px(x+w-1,y+1,1,h-2,edge);
      px(x+1,y,w-2,1,edge);
      px(x+1,y+h-1,w-2,1,edge);
      px(x,y,2,1,edge); px(x,y,1,2,edge);
      px(x+w-2,y,2,1,edge); px(x+w-1,y,1,2,edge);
      px(x,y+h-1,1,2,edge); px(x,y+h-2,2,1,edge);
      px(x+w-2,y+h-1,2,1,edge); px(x+w-1,y+h-2,1,2,edge);
      px(x+1,y+1,w-2,h-2,fill);
    }

    function glyphF(gx,gy,color){
      lineH(gx+1, gy+0, 4, color);
      lineV(gx+2, gy+0, 7, color);
      lineH(gx+2, gy+3, 2, color);
    }

    const CX = 32, CY = 32;
    const barrelLen = 14;
    const barrelW = 3;

    function drawTurret(statusBlink){
      const tW = 18, tH = 14;
      const tx = CX - (tW>>1), ty = CY - (tH>>1);
      chunkyRect(tx, ty, tW, tH, P.blue, P.steelDark);
      px(tx+1, ty+1, 3, tH-2, P.blueDark);
      px(tx+2, ty+1, tW-4, 1, P.blueLite);
      const bx = CX - ((barrelW)>>1);
      const by = ty - 1;
      px(bx, by - barrelLen + 2, barrelW, barrelLen, P.steelDark);
      px(bx, by - barrelLen, barrelW, 2, P.steelLite);
      px(tx + tW - 4, ty + 3, 2, 2, P.steelLite);
      glyphF(CX - 3, CY - 3, P.white);
      const ledCol = statusBlink ? P.white : P.blueLite;
      px(tx + 2, ty + 2, 1, 1, ledCol);
    }

    // Render turret
    const statusBlink = (Math.floor(now/120) % 2) === 0;
    drawTurret(statusBlink);

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N) * 0.5; const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawFacebookTurretInto = drawFacebookTurretInto; }catch(_){ }

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
  const MIN_ZOOM = 0.818, MAX_ZOOM = 5.0;
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

// Helper: check if a world-space object at (wx,wy) is within the camera view plus optional pad (in screen pixels)
function worldObjectVisible(wx, wy, padScreen = 64){
  try{
    // Compute world-space delta to camera, accounting for vertical wrap
    let dy = wy - camera.y;
    if (dy > WORLD_H/2) dy -= WORLD_H;
    if (dy < -WORLD_H/2) dy += WORLD_H;
    const dx = wx - camera.x;
    // Project to screen space (camera.zoom already included)
    const sx = dx * camera.zoom + W/2;
    const sy = dy * camera.zoom + H/2;
    if (sx < -padScreen || sx > W + padScreen || sy < -padScreen || sy > H + padScreen) return false;
    return true;
  }catch(_){ return true; }
}

// Billboards moved to js/billboard.js (makeBillboardFrames, animation frames,
// instances and broken/gibbing code now live in that module)

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

// throttled debug logging (enable by setting window.__DEBUG_KITTEN = true in the browser)
let __lastKittenDbg = 0;

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

// --- Mini Tank Ally System ---
function spawnMiniTankAlly(x, y) {
  // Spawn a mini tank ally based on the player's current tank variant
  const miniScale = 0.6; // Make it smaller than the player tank
  const offsetX = (Math.random() - 0.5) * 80; // Random offset around player
  const offsetY = (Math.random() - 0.5) * 80;

  const ally = {
    x: x + offsetX,
    y: y + offsetY,
    vx: 0,
    vy: 0,
    spd: 25, // Slightly slower than player
    r: 12, // Smaller hit radius
    type: 'miniTank',
    hp: 2,
    lastAttack: 0,
    attackCD: 800 + Math.random() * 400, // Similar to jungle enemies
    turretAngle: 0,
    angle: 0,
    scale: miniScale,
    tankVariant: selectedVehicleVariant || 'default',
    // Visual properties
    treadPhase: 0,
    dust: 0
  };

  // Limit to 3 allies max
  if (allies.length < 3) {
    allies.push(ally);
  }
}

function updateAllies(dt) {
  for (let i = allies.length - 1; i >= 0; i--) {
    const ally = allies[i];

    // Find nearest enemy
    let nearestEnemy = null;
    let nearestDist = Infinity;
    for (const enemy of enemies) {
      if (enemy.harmless) continue; // Skip harmless enemies
      const dx = enemy.x - ally.x;
      const dy = enemy.y - ally.y;
      const dist = Math.hypot(dx, dy);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestEnemy = enemy;
      }
    }

    // Move towards nearest enemy or follow player
    if (nearestEnemy && nearestDist < 200) {
      // Move towards enemy
      const dx = nearestEnemy.x - ally.x;
      const dy = nearestEnemy.y - ally.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        ally.vx = (dx / dist) * ally.spd;
        ally.vy = (dy / dist) * ally.spd;
        ally.angle = Math.atan2(dy, dx);
        ally.turretAngle = ally.angle;
      }
    } else {
      // Follow player loosely
      const playerX = selectedVehicle === 'heli' ? heli.x : tank.x;
      const playerY = selectedVehicle === 'heli' ? heli.y : tank.y;
      const dx = playerX - ally.x;
      const dy = playerY - ally.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 60) { // Keep some distance from player
        ally.vx = (dx / dist) * ally.spd * 0.5;
        ally.vy = (dy / dist) * ally.spd * 0.5;
        ally.angle = Math.atan2(dy, dx);
        ally.turretAngle = ally.angle;
      } else {
        ally.vx *= 0.9; // Slow down when close to player
        ally.vy *= 0.9;
      }
    }

    // Update position
    ally.x += ally.vx * dt;
    ally.y += ally.vy * dt;

    // Update tread animation
    ally.treadPhase += dt * 4;

    // Update dust effect
    const speed = Math.hypot(ally.vx, ally.vy);
    ally.dust = Math.max(0, ally.dust - dt * 2);
    if (speed > 10) {
      ally.dust = Math.min(1, ally.dust + dt * 0.5);
    }

    // Shooting logic
    const now = performance.now();
    if (nearestEnemy && nearestDist < 150 && now - ally.lastAttack > ally.attackCD) {
      // Shoot at enemy
      const dx = nearestEnemy.x - ally.x;
      const dy = nearestEnemy.y - ally.y;
      const dist = Math.hypot(dx, dy);
      if (dist > 0) {
        const bulletSpeed = 200;
        const bulletDx = (dx / dist) * bulletSpeed;
        const bulletDy = (dy / dist) * bulletSpeed;

        // Spawn bullet from turret position
        const turretOffset = 8 * ally.scale;
        const bulletX = ally.x + Math.cos(ally.turretAngle) * turretOffset;
        const bulletY = ally.y + Math.sin(ally.turretAngle) * turretOffset;

        bullets.push({
          x: bulletX,
          y: bulletY,
          dx: bulletDx,
          dy: bulletDy,
          life: 2.0,
          color: 'hsl(45 100% 60%)' // Yellow bullets for allies
        });

        ally.lastAttack = now;
        spawnMuzzleFlash(bulletX, bulletY, ally.turretAngle);
      }
    }

    // Remove if too far from player or dead
    const playerX = selectedVehicle === 'heli' ? heli.x : tank.x;
    const playerY = selectedVehicle === 'heli' ? heli.y : tank.y;
    const distFromPlayer = Math.hypot(ally.x - playerX, ally.y - playerY);

    if (distFromPlayer > 400 || ally.hp <= 0) {
      allies.splice(i, 1);
    }
  }
}

function drawAllies() {
  for (const ally of allies) {
    // Draw mini tank using simple shapes
    const effectiveScale = (effectiveTankScale ? effectiveTankScale() : 1) * ally.scale;

    // Save context
    ctx.save();
    ctx.translate(ally.x - camera.x, ally.y - camera.y);

    // Apply camera zoom
    if (camera.zoom !== 1) {
      ctx.scale(camera.zoom, camera.zoom);
    }

    // Draw tank body and turret using simple shapes
    ctx.save();
    ctx.rotate(ally.angle);
    ctx.scale(effectiveScale, effectiveScale);

    // Draw body (simple rectangle)
    ctx.fillStyle = '#666';
    ctx.fillRect(-12, -8, 24, 16);

    // Draw turret (simple circle)
    ctx.save();
    ctx.rotate(ally.turretAngle - ally.angle);
    ctx.fillStyle = '#888';
    ctx.beginPath();
    ctx.arc(0, 0, 6, 0, Math.PI * 2);
    ctx.fill();

    // Draw barrel
    ctx.fillStyle = '#444';
    ctx.fillRect(6, -2, 8, 4);
    ctx.restore();

    ctx.restore();

    // Draw dust effect
    if (ally.dust > 0.1) {
      const dustCount = Math.floor(ally.dust * 6);
      ctx.fillStyle = 'rgba(150, 150, 150, 0.6)';
      for (let i = 0; i < dustCount; i++) {
        const rx = (Math.random() - 0.5) * 20;
        const ry = (Math.random() - 0.5) * 20 + 10;
        ctx.fillRect(rx, ry, 2, 2);
      }
    }

    ctx.restore();
  }
}

// --- Powerups (test double-shot) ---
const powerups = []; // {x,y,type,life,phase,hue,iconIdx}
function spawnPowerup(x,y,type='double'){ powerups.push({ x: mod(x, WORLD_W), y: mod(y, WORLD_H), type, life: 40.0, phase: Math.random()*Math.PI*2, hue: Math.floor(Math.random()*360), iconIdx: Math.floor(Math.random()*6) }); }
function updatePowerups(dt){ for (let i=powerups.length-1;i>=0;i--){ const p = powerups[i]; p.phase += dt * 3.0; p.life -= dt; if (p.life <= 0) powerups.splice(i,1); } }

// --- Shield System ---
let shieldActive = false;
let shieldUntil = 0;
let shieldCooldownUntil = 0;
const SHIELD_DURATION = 60000; // 60 seconds
const SHIELD_COOLDOWN = 120000; // 2 minutes cooldown

function spawnShieldPowerup(x,y){ spawnPowerup(x,y,'shield'); try{ const p = powerups[powerups.length-1]; if (p){ p.hue = 180; p.iconIdx = 0; } }catch(_){ } }

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

// Tech card powerup painter (adapted from techcard.html)
function _p_drawTechCard(cx, cy, hue, t) {
  // Clear the area
  _pctx.clearRect(0, 0, POWERUP_TILE_PX, POWERUP_TILE_PX);
  
  // Scale factor for 64x64 canvas (techcard is designed for 64x64)
  const SCALE = 1;
  const W = 64, H = 64;
  
  // Palette (adapted from techcard)
  const C = {
    bg: '#0b0f1a', 
    edge: '#0e2847', 
    edge2: '#153a66', 
    base: '#1b2f4d',
    neon: '#00a2ff', 
    aqua: '#0eead6', 
    glow: '#8dfcf0', 
    white: '#ffffff'
  };
  
  // Helpers
  function px(x, y, c) { _pctx.fillStyle = c; _pctx.fillRect(x, y, 1, 1); }
  function rect(x, y, w, h, c) { _pctx.fillStyle = c; _pctx.fillRect(x, y, w, h); }
  
  // Animation frame (6 frames, 120ms each)
  const frame = Math.floor((t / 120) % 6);
  const bounce = [0, 2, 4, 2, 0, -2][frame];
  
  // Card metrics (scaled for powerup size) - made smaller
  const PIVOT = { x: cx, y: cy };
  const CARD = { w: 28, h: 38, cut: 6 }; // Reduced from 38x52 to 28x38, cut from 8 to 6
  const CARD_POS = () => ({ x: PIVOT.x - (CARD.w >> 1), y: PIVOT.y - (CARD.h >> 1) + bounce });
  
  // Shape helpers for clipped rectangle
  function cutCornerFill(x, y, w, h, cut, fillColor) {
    rect(x, y, w, h, fillColor);
    for (let i = 0; i < cut; i++) {
      rect(x + w - cut + i, y + i, cut - i, 1, C.bg);
    }
  }
  
  function outlineWithCut(x, y, w, h, cut, color) {
    for (let i = 0; i < w - cut; i++) px(x + i, y, color);
    for (let j = cut; j < h; j++) px(x + w - 1, y + j, color);
    for (let i = 0; i < w; i++) px(x + i, y + h - 1, color);
    for (let j = 0; j < h; j++) px(x, y + j, color);
    // Diagonal cut line
    let dx = x + w - cut, dy = y;
    let ex = x + w - 1, ey = y + cut - 1;
    let ddx = Math.abs(ex - dx), sdx = dx < ex ? 1 : -1;
    let ddy = -Math.abs(ey - dy), sdy = dy < ey ? 1 : -1;
    let err = ddx + ddy;
    for (;;) {
      px(dx, dy, color);
      if (dx === ex && dy === ey) break;
      const e2 = 2 * err;
      if (e2 >= ddy) { err += ddy; dx += sdx; }
      if (e2 <= ddx) { err += ddx; dy += sdy; }
    }
  }
  
  const pos = CARD_POS();
  const x = pos.x, y = pos.y, w = CARD.w, h = CARD.h, cut = CARD.cut;
  
  // Ground shadow - scaled down proportionally
  rect(PIVOT.x - 12, PIVOT.y + (h >> 1) - 2 + bounce, 24, 3, '#07101c');
  rect(PIVOT.x - 10, PIVOT.y + (h >> 1) - 1 + bounce, 20, 1, '#060c16');
  
  // Base card
  cutCornerFill(x, y, w, h, cut, C.base);
  
  // Bevels
  rect(x + w - 1, y + cut, 1, h - cut, C.edge);
  rect(x + w - 2, y + cut, 1, h - cut, C.edge2);
  rect(x + 1, y + h - 1, w - 2, 1, C.edge);
  rect(x + 1, y + h - 2, w - 2, 1, C.edge2);
  rect(x + 1, y, w - cut - 1, 1, C.glow);
  rect(x, y + 1, 1, h - 2, C.aqua);
  
  // Diagonal cut bevel
  let dx = x + w - cut, dy = y;
  let ex = x + w - 1, ey = y + cut - 1;
  let ddx = Math.abs(ex - dx), sdx = dx < ex ? 1 : -1;
  let ddy = -Math.abs(ey - dy), sdy = dy < ey ? 1 : -1;
  let err = ddx + ddy;
  for (;;) {
    px(dx, dy, C.glow);
    if (dx === ex && dy === ey) break;
    const e2 = 2 * err;
    if (e2 >= ddy) { err += ddy; dx += sdx; }
    if (e2 <= ddx) { err += ddx; dy += sdy; }
  }
  
  dx = x + w - cut; dy = y + 1;
  ex = x + w - 2; ey = y + cut - 1;
  ddx = Math.abs(ex - dx); sdx = dx < ex ? 1 : -1;
  ddy = -Math.abs(ey - dy); sdy = dy < ey ? 1 : -1;
  err = ddx + ddy;
  for (;;) {
    px(dx, dy, C.aqua);
    if (dx === ex && dy === ey) break;
    const e2 = 2 * err;
    if (e2 >= ddy) { err += ddy; dx += sdx; }
    if (e2 <= ddx) { err += ddx; dy += sdy; }
  }
  
  // Inner frame - adjusted inset for smaller card
  const inset = 2; // Reduced from 3 to 2 for smaller card
  const ix = x + inset, iy = y + inset, iw = w - 2 * inset, ih = h - 2 * inset, icut = Math.max(1, cut - 2); // Adjusted icut calculation
  outlineWithCut(ix, iy, iw, ih, icut, C.edge2);
  
  // Central chip
  rect(PIVOT.x - 4, PIVOT.y + bounce - 5, 8, 8, '#142a47');
  outlineWithCut(PIVOT.x - 4, PIVOT.y + bounce - 5, 8, 8, 0, C.neon);
  
  // Chip pins
  for (let i = -3; i <= 3; i += 2) {
    px(PIVOT.x - 5, PIVOT.y + bounce - 5 + i, C.glow);
    px(PIVOT.x + 4, PIVOT.y + bounce - 5 + i, C.glow);
  }
  
  // Lightning bolt
  px(PIVOT.x - 1, PIVOT.y + bounce - 4, C.white);
  px(PIVOT.x + 1, PIVOT.y + bounce - 2, C.white);
  px(PIVOT.x, PIVOT.y + bounce, C.white);
  px(PIVOT.x + 2, PIVOT.y + bounce + 2, C.white);
  px(PIVOT.x - 1, PIVOT.y + bounce + 1, C.aqua);
  px(PIVOT.x + 1, PIVOT.y + bounce - 1, C.aqua);
  
  // PCB traces - adjusted for smaller card
  const topSpineY = Math.max(iy + 1, y + cut + 1);
  for (let i = 0; i <= 5; i++) px(PIVOT.x, topSpineY + i, C.neon); // Reduced spine length from 6 to 5
  for (let i = 0; i < 5; i++) px(ix + 4 + i, topSpineY, C.neon); // Moved from 6 to 4, reduced length from 6 to 5
  for (let i = 0; i < 6; i++) px(ix + iw - 6 + i, topSpineY, C.neon); // Adjusted for smaller width
  
  // NFC arcs - adjusted for smaller inner frame
  for (let r = 4; r <= 8; r += 2) { // Reduced radius range from 6-10 to 4-8
    for (let tt = 0; tt <= r; tt++) {
      px(ix + 4 + tt, iy + 4, C.aqua);         // small horizontal - moved from 6 to 4
      px(ix + 4,   iy + 4 + tt, C.aqua);       // small vertical - moved from 6 to 4
    }
  }
  
  // Gold contact pads - adjusted spacing for smaller card
  const padY = y + h - 10; // Moved up slightly for smaller card
  for (let i = 0; i < 5; i++) {
    rect(x + 5 + i * 4, padY, 3, 5, '#d4c37a'); // Reduced spacing from 5 to 4, height from 6 to 5
    px(x + 5 + i * 4, padY - 1, '#fff6b0');
  }
  
  // Serial micro-text
  for (let j = 0; j < 10; j += 2) {
    if (y + cut + 2 + j < y + h - 2) px(x + w - 3, y + cut + 2 + j, C.glow);
  }
  
  // Scanline
  const scanY = iy + 1 + ((frame * 4) % (ih - 2));
  for (let xx = ix + 1; xx < ix + iw - 1; xx++) {
    px(xx, scanY, C.glow);
    if (scanY + 1 < iy + ih - 1) px(xx, scanY + 1, C.aqua);
  }
  
  // Pulse overlay
  const pulse = (frame % 2) === 0 ? 0.10 : 0.04;
  for (let yy = iy + 1; yy < iy + ih - 1; yy++) {
    for (let xx = ix + 1; xx < ix + iw - 1; xx++) {
      if (((xx + yy) & 1) === 0) {
        _pctx.fillStyle = `rgba(141,252,240,${pulse})`;
        _pctx.fillRect(xx, yy, 1, 1);
      }
    }
  }
  
  // Outer silhouette
  outlineWithCut(x, y, w, h, cut, C.edge);
  
  // Corner indicator
  dx = x + w - cut + 1; dy = y + 2;
  ex = x + w - 3; ey = y + cut - 2;
  ddx = Math.abs(ex - dx); sdx = dx < ex ? 1 : -1;
  ddy = -Math.abs(ey - dy); sdy = dy < ey ? 1 : -1;
  err = ddx + ddy;
  for (;;) {
    px(dx, dy, C.white);
    if (dx === ex && dy === ey) break;
    const e2 = 2 * err;
    if (e2 >= ddy) { err += ddy; dx += sdx; }
    if (e2 <= ddx) { err += ddx; dy += sdy; }
  }
}

// spawn a heal powerup with consistent visual (green + heal icon)
function spawnHealPowerup(x,y){ spawnPowerup(x,y,'heal'); try{ const p = powerups[powerups.length-1]; if (p){ p.hue = 140; p.iconIdx = _p_icons.length - 1; p.heartVariant = 'classic'; } }catch(_){ } }
function spawnMiniPowerup(x,y){ spawnPowerup(x,y,'mini'); try{ const p = powerups[powerups.length-1]; if (p){ p.hue = 200; p.iconIdx = Math.floor(Math.random()*6); } }catch(_){ } }
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
function spawnBillboardDrop(bb){ try{ if (!bb) return; const r = Math.random(); if (r < 0.25) spawnHealPowerup(bb.x, bb.y); else if (r < 0.35) spawnJournalPowerup(bb.x, bb.y, 'collect-saw'); }catch(_){ } }

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
    } else if (p.type === 'mini'){
      // Draw mini tank icon
      _pctx.clearRect(0, 0, POWERUP_TILE_PX, POWERUP_TILE_PX);
      const cx = 32, cy = 32;
      // Draw a simple tank silhouette
      _pctx.fillStyle = _p_hsv(p.hue, 0.8, 0.7);
      // Body
      _pctx.fillRect(cx - 8, cy - 6, 16, 12);
      // Turret
      _pctx.fillRect(cx - 4, cy - 8, 8, 6);
      // Tracks
      _pctx.fillStyle = _p_hsv(p.hue, 0.6, 0.4);
      _pctx.fillRect(cx - 10, cy - 8, 2, 16);
      _pctx.fillRect(cx + 8, cy - 8, 2, 16);
      // Barrel
      _pctx.fillStyle = _p_hsv(p.hue, 0.9, 0.5);
      _pctx.fillRect(cx + 4, cy - 9, 6, 2);
    } else {
      _p_drawTechCard(32, 32, p.hue, nowt + (p.phase * 60));
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
// expose the collect drawing helper to other modules
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
function effectiveTankScale(){ try{ 
    if (selectedVehicleVariant === 'murkia') return SPRITE_SCALE * BLACKSTAR_SCALE;
    if (selectedVehicleVariant === 'bondtank') return SPRITE_SCALE * 3; // Bondtank is 3x larger
    if (selectedVehicleVariant === 'blackstar') return SPRITE_SCALE * 0.4;
    return SPRITE_SCALE;
  }catch(_){ return SPRITE_SCALE; } }
// start with tank selected and hide center UI
selectedVehicle = 'tank';
center.style.display = 'none';
// Vehicle menu state: first slot is the default tank (unlocked), others may be locked/placeholders
// Slot mapping: 0=default, 1=Fiesta, 2=Murkia, 3=Dozer, 4=Bondtank
// core vehicle slots; add extra placeholder slots ("emptyX") for future vehicles
// ensure the German art preview is placed into the 6th slot (index 5)
const VEHICLE_SLOTS = ['tank', 'fordfiesta', 'murkia', 'dozer', 'bondtank', 'empty6', 'empty7', 'empty8', 'empty9', 'french', 'facebook', 'waffle', 'blackstar'];
// unlock all slots now so they are clickable for testing
const VEHICLE_UNLOCKED = VEHICLE_SLOTS.map(()=> true);
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
    } else if (v === 'empty6'){
      // populate slot 6 with the German tank art from German.html (pixel-perfect bake)
      try{
        if (typeof window !== 'undefined'){
          // create body canvas at SPR_W x SPR_H
            // always recreate native-size German canvases to pick up the latest drawing code
            const NATIVE = 384;
            const gb = document.createElement('canvas'); gb.width = NATIVE; gb.height = NATIVE; const gbg = gb.getContext('2d'); try{ gbg.imageSmoothingEnabled = false; }catch(_){ }
            try{ gbg.clearRect(0,0,NATIVE,NATIVE); drawGermanBodyInto(gbg, NATIVE, NATIVE, performance.now()); }catch(_){ }
            try{ gb._logicalSPR = 64; }catch(_){ }
            window.__german_body = gb;
            // recreate turret canvas at native size
            const gt = document.createElement('canvas'); gt.width = NATIVE; gt.height = NATIVE; const gtg = gt.getContext('2d'); try{ gtg.imageSmoothingEnabled = false; }catch(_){ }
            try{ gtg.clearRect(0,0,NATIVE,NATIVE); drawGermanTurretInto(gtg, NATIVE, NATIVE, performance.now()); }catch(_){ }
            try{ gt._logicalSPR = 64; }catch(_){ }
            window.__german_turret = gt;
            // apply assets and mark selected variant; set SPR_W/SPR_H to native so no scaling is applied
            try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'german'; configureTankAssets({ SPR_W:384, SPR_H:384, bodyCanvas: window.__german_body, turretCanvas: window.__german_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
    }
    else if (v === 'empty7'){
      // populate slot 7 with the Mexican heavy tank art from Mexico.html (pixel-perfect bake)
      try{
        if (typeof window !== 'undefined'){
          // always recreate native-size Mexico canvases to pick up the latest drawing code
          const NATIVE_MX = 320;
          const mb = document.createElement('canvas'); mb.width = NATIVE_MX; mb.height = NATIVE_MX; const mbg = mb.getContext('2d'); try{ mbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ mbg.clearRect(0,0,NATIVE_MX,NATIVE_MX); drawMexicoBodyInto(mbg, NATIVE_MX, NATIVE_MX, performance.now()); }catch(_){ }
          try{ mb._logicalSPR = 64; }catch(_){ }
          window.__mexico_body = mb;
          const mt = document.createElement('canvas'); mt.width = NATIVE_MX; mt.height = NATIVE_MX; const mtg = mt.getContext('2d'); try{ mtg.imageSmoothingEnabled = false; }catch(_){ }
          try{ mtg.clearRect(0,0,NATIVE_MX,NATIVE_MX); drawMexicoTurretInto(mtg, NATIVE_MX, NATIVE_MX, performance.now()); }catch(_){ }
          try{ mt._logicalSPR = 64; }catch(_){ }
          window.__mexico_turret = mt;
          // apply assets to tank module
          try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'mexico'; configureTankAssets({ SPR_W:NATIVE_MX, SPR_H:NATIVE_MX, bodyCanvas: window.__mexico_body, turretCanvas: window.__mexico_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
    }
    else if (v === 'empty8'){
      // populate slot 8 with the China tank art from China.html (pixel-perfect bake)
      try{
        if (typeof window !== 'undefined'){
          const NATIVE_CH = 256;
          const cb = document.createElement('canvas'); cb.width = NATIVE_CH; cb.height = NATIVE_CH; const cbg = cb.getContext('2d'); try{ cbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ cbg.clearRect(0,0,NATIVE_CH,NATIVE_CH); drawChinaBodyInto(cbg, NATIVE_CH, NATIVE_CH, performance.now()); }catch(_){ }
          try{ cb._logicalSPR = 64; }catch(_){ }
          window.__china_body = cb;
          const ct = document.createElement('canvas'); ct.width = NATIVE_CH; ct.height = NATIVE_CH; const ctg = ct.getContext('2d'); try{ ctg.imageSmoothingEnabled = false; }catch(_){ }
          try{ ctg.clearRect(0,0,NATIVE_CH,NATIVE_CH); drawChinaTurretInto(ctg, NATIVE_CH, NATIVE_CH, performance.now()); }catch(_){ }
          try{ ct._logicalSPR = 64; }catch(_){ }
          window.__china_turret = ct;
          try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'china'; configureTankAssets({ SPR_W:NATIVE_CH, SPR_H:NATIVE_CH, bodyCanvas: window.__china_body, turretCanvas: window.__china_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
    }
    else if (v === 'empty9'){
      // populate slot 9 with McD's tank (pixel-perfect 64x64)
      try{
        if (typeof window !== 'undefined'){
          const NATIVE_MCD = 64;
          const mb = document.createElement('canvas'); mb.width = NATIVE_MCD; mb.height = NATIVE_MCD; const mbg = mb.getContext('2d'); try{ mbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ mbg.clearRect(0,0,NATIVE_MCD,NATIVE_MCD); drawMcdsBodyInto(mbg, NATIVE_MCD, NATIVE_MCD, performance.now()); }catch(_){ }
          try{ mb._logicalSPR = 64; }catch(_){ }
          window.__mcds_body = mb;
          const mt = document.createElement('canvas'); mt.width = NATIVE_MCD; mt.height = NATIVE_MCD; const mtg = mt.getContext('2d'); try{ mtg.imageSmoothingEnabled = false; }catch(_){ }
          try{ mtg.clearRect(0,0,NATIVE_MCD,NATIVE_MCD); drawMcdsTurretInto(mtg, NATIVE_MCD, NATIVE_MCD, performance.now()); }catch(_){ }
          try{ mt._logicalSPR = 64; }catch(_){ }
          window.__mcds_turret = mt;
          try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'mcds'; configureTankAssets({ SPR_W:NATIVE_MCD, SPR_H:NATIVE_MCD, bodyCanvas: window.__mcds_body, turretCanvas: window.__mcds_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
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
    else if (v === 'bondtank'){
    try{
      if (typeof window !== 'undefined'){
        if (!window.__bondtank_body){
          const off = document.createElement('canvas'); off.width = 64; off.height = 64; const og = off.getContext('2d'); try{ og.imageSmoothingEnabled = false; }catch(_){ }
          try{ drawBondtankInto(og, 64, 64, performance.now()); }catch(_){ }
          window.__bondtank_body = off;
        }
        if (!window.__bondtank_turret){
          const off2 = document.createElement('canvas'); off2.width = 64; off2.height = 64; const og2 = off2.getContext('2d'); try{ og2.imageSmoothingEnabled = false; }catch(_){ }
          // turret baked into body for this art; keep a transparent turret canvas
          og2.clearRect(0,0,64,64);
          window.__bondtank_turret = off2;
        }
        try{ configureTankAssets({ SPR_W:64, SPR_H:64, bodyCanvas: window.__bondtank_body, turretCanvas: window.__bondtank_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
      }
    }catch(_){ }
      selectedVehicle = 'tank'; selectedVehicleVariant = 'bondtank';
    }
    else if (v === 'french'){
      // populate slot 9 with the French tank art from French.html (pixel-perfect bake)
      try{
        if (typeof window !== 'undefined'){
          const NATIVE_FR = 320;
          const fb = document.createElement('canvas'); fb.width = NATIVE_FR; fb.height = NATIVE_FR; const fbg = fb.getContext('2d'); try{ fbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ fbg.clearRect(0,0,NATIVE_FR,NATIVE_FR); drawFrenchBodyInto(fbg, NATIVE_FR, NATIVE_FR, performance.now()); }catch(_){ }
          try{ fb._logicalSPR = 64; }catch(_){ }
          window.__french_body = fb;
          const ft = document.createElement('canvas'); ft.width = NATIVE_FR; ft.height = NATIVE_FR; const ftg = ft.getContext('2d'); try{ ftg.imageSmoothingEnabled = false; }catch(_){ }
          try{ ftg.clearRect(0,0,NATIVE_FR,NATIVE_FR); drawFrenchTurretInto(ftg, NATIVE_FR, NATIVE_FR, performance.now(), Math.PI/2); }catch(_){ }
          try{ ft._logicalSPR = 64; }catch(_){ }
          window.__french_turret = ft;
          try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'french'; configureTankAssets({ SPR_W:NATIVE_FR, SPR_H:NATIVE_FR, bodyCanvas: window.__french_body, turretCanvas: window.__french_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
    }
    else if (v === 'facebook'){
      // populate slot 10 with the Facebook tank art from facebook.html (pixel-perfect bake)
      try{
        if (typeof window !== 'undefined'){
          const NATIVE_FB = 64;
          const fbb = document.createElement('canvas'); fbb.width = NATIVE_FB; fbb.height = NATIVE_FB; const fbbg = fbb.getContext('2d'); try{ fbbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ fbbg.clearRect(0,0,NATIVE_FB,NATIVE_FB); drawFacebookBodyInto(fbbg, NATIVE_FB, NATIVE_FB, performance.now()); }catch(_){ }
          try{ fbb._logicalSPR = 64; }catch(_){ }
          window.__facebook_body = fbb;
          const fbt = document.createElement('canvas'); fbt.width = NATIVE_FB; fbt.height = NATIVE_FB; const fbtg = fbt.getContext('2d'); try{ fbtg.imageSmoothingEnabled = false; }catch(_){ }
          try{ fbtg.clearRect(0,0,NATIVE_FB,NATIVE_FB); drawFacebookTurretInto(fbtg, NATIVE_FB, NATIVE_FB, performance.now()); }catch(_){ }
          try{ fbt._logicalSPR = 64; }catch(_){ }
          window.__facebook_turret = fbt;
          try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'facebook'; configureTankAssets({ SPR_W:NATIVE_FB, SPR_H:NATIVE_FB, bodyCanvas: window.__facebook_body, turretCanvas: window.__facebook_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
    }
    else if (v === 'waffle'){
      // populate slot 12 with the Waffle tank art from Waffel.html (pixel-perfect bake)
      try{
        if (typeof window !== 'undefined'){
          const NATIVE_WF = 64;
          const wb = document.createElement('canvas'); wb.width = NATIVE_WF; wb.height = NATIVE_WF; const wbg = wb.getContext('2d'); try{ wbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ wbg.clearRect(0,0,NATIVE_WF,NATIVE_WF); drawWaffleBodyInto(wbg, NATIVE_WF, NATIVE_WF, performance.now()); }catch(_){ }
          try{ wb._logicalSPR = 64; }catch(_){ }
          window.__waffle_body = wb;
          const wt = document.createElement('canvas'); wt.width = NATIVE_WF; wt.height = NATIVE_WF; const wtg = wt.getContext('2d'); try{ wtg.imageSmoothingEnabled = false; }catch(_){ }
          try{ wtg.clearRect(0,0,NATIVE_WF,NATIVE_WF); drawWaffleTurretInto(wtg, NATIVE_WF, NATIVE_WF, performance.now()); }catch(_){ }
          try{ wt._logicalSPR = 64; }catch(_){ }
          window.__waffle_turret = wt;
          try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'waffle'; configureTankAssets({ SPR_W:NATIVE_WF, SPR_H:NATIVE_WF, bodyCanvas: window.__waffle_body, turretCanvas: window.__waffle_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
    }
    else if (v === 'blackstar'){
      // populate slot 13 with the Blackstar tank art (pixel-perfect 64x64)
      try{
        if (typeof window !== 'undefined'){
          const NATIVE_BS = 64;
          const bb = document.createElement('canvas'); bb.width = NATIVE_BS; bb.height = NATIVE_BS; const bbg = bb.getContext('2d'); try{ bbg.imageSmoothingEnabled = false; }catch(_){ }
          try{ bbg.clearRect(0,0,NATIVE_BS,NATIVE_BS); drawBlackstarBodyInto(bbg, NATIVE_BS, NATIVE_BS, performance.now()); }catch(_){ }
          try{ bb._logicalSPR = 64; }catch(_){ }
          window.__blackstar_body = bb;
          const bt = document.createElement('canvas'); bt.width = NATIVE_BS; bt.height = NATIVE_BS; const btg = bt.getContext('2d'); try{ btg.imageSmoothingEnabled = false; }catch(_){ }
          try{ btg.clearRect(0,0,NATIVE_BS,NATIVE_BS); drawBlackstarTurretInto(btg, NATIVE_BS, NATIVE_BS, performance.now()); }catch(_){ }
          try{ bt._logicalSPR = 64; }catch(_){ }
          window.__blackstar_turret = bt;
          try{ selectedVehicle = 'tank'; selectedVehicleVariant = 'blackstar'; configureTankAssets({ SPR_W:NATIVE_BS, SPR_H:NATIVE_BS, bodyCanvas: window.__blackstar_body, turretCanvas: window.__blackstar_turret }); try{ redrawSprites && typeof redrawSprites === 'function' && redrawSprites(); }catch(_){ } }catch(_){ }
        }
      }catch(_){ }
    }

    try{ updateHud(); }catch(_){ }
  }catch(_){ }
}
// initJournal moved down to after MAX_HEALTH/health are declared
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
  /* vehicle menu: fixed on right side, expandable like journal */
  .tn-vehicle-menu{ position:fixed; right:20px; display:grid; grid-template-columns: repeat(3, 64px); grid-auto-rows: 84px; gap:8px; justify-content:center; align-items:start; z-index:9998; pointer-events:auto; padding:8px; box-sizing:border-box; background:linear-gradient(180deg,#151719,#0f1113); border:2px solid #0b0b0b; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,0.6); max-height:60vh; overflow:hidden; transition: transform 0.3s ease; }
  .tn-vehicle-menu.closed{ transform: translateX(120%); }
  .tn-vehicle-toggle{ position:fixed; right:20px; background:linear-gradient(180deg,#111,#0b0b0b); color:#e6e6e6; padding:6px 8px; border-radius:6px; cursor:pointer; z-index:9999; border:1px solid #222; font-family:monospace; font-size:12px; transition: transform 0.3s ease; }
  .tn-vehicle-toggle.closed{ /* No transform - keep button visible */ }
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
const allies = []; // {x,y,spd,r,type,hp,lastAttack,attackCD}
// recent-deaths feature removed: make recordDeath a no-op so existing call sites remain safe
function recordDeath(kind, e) { /* removed recent-deaths logging */ }
// wire recordDeath to also update the journal module
// after journal.js is imported, we'll call recordKill inside recordDeath where deaths are recorded
// (recordDeath remains defined above and is used throughout the code)
configureTankAssets({ gibs: moduleGibs });

// debug: throttle enemy-draw logs so we can see if enemies are being processed
let __lastEnemyDrawLog = 0;
// debug: throttle critter-draw logs
let __lastCritterDrawLog = 0;
// debug: visual markers for critters/animals (toggle with G)
let showEntityMarkers = false;
let lastShot = 0; const SHOT_COOLDOWN = 500; const BULLET_SPEED = 360;
// Safe-start area: player is immune to enemy projectiles while inside this radius
// for the first START_SAFE_DURATION seconds after spawn/restart.
const START_SAFE_RADIUS = 120; // world pixels
// Previously this was a timed window; set to Infinity so the safe area is permanent
const START_SAFE_DURATION = Infinity; // unused when permanent
let startSafeUntil = Infinity;
// flower patch canvas for visualizing the safe area
let startPatchCanvas = null;

function createFlowerPatchCanvas(radius){
  try{
    const size = Math.max(48, Math.round(radius*2));
    const c = document.createElement('canvas'); c.width = size; c.height = size;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = true;
    // simple palette (adapted from flowerpatch.html)
    const palette = {
      grassA: '#183b1f', grassB: '#24512c', grassC: '#2c6a36',
      leafA: '#2d7a37', leafB: '#2a6d33',
      centers: ['#f2c84b', '#f4a83a', '#ffc95e'],
      petals: [ ['#ff9eb6','#ffd4e0'], ['#ffd166','#ffeaa3'], ['#8ecae6','#d6efff'], ['#b794f4','#e8d9ff'], ['#ff9f6e','#ffd0b7'] ]
    };
  // transparent background — keep canvas clear so the patch can be drawn under the tank
  const W = size, H = size;
  g.clearRect(0,0,W,H);
  // define an interior margin and clip to it so flowers never draw outside the square
  // increase margin to move flowers away from edges (keeps visual breathing room)
  const margin = Math.max(6, Math.round(size * 0.12));
  g.save(); g.beginPath(); g.rect(margin, margin, W - margin*2, H - margin*2); g.clip();

    // helper draw functions (simplified)
  function drawLeaf(ctx,x,y,rMajor,rMinor,rot){ ctx.save(); ctx.translate(x,y); ctx.rotate(rot); const grad=ctx.createLinearGradient(-rMajor,0,rMajor,0); grad.addColorStop(0,palette.leafB); grad.addColorStop(1,palette.leafA); ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(-rMajor*0.7,0); ctx.quadraticCurveTo(0,-rMinor*0.9,rMajor*0.7,0); ctx.quadraticCurveTo(0,rMinor*0.8,-rMajor*0.7,0); ctx.closePath(); ctx.fill(); ctx.restore(); }

    function drawFlower(ctx,fx,fy,sizeF,petals,colors,centerCol,rot){ ctx.save(); ctx.translate(fx,fy); ctx.rotate(rot); // leaves
      for(let i=0;i<3;i++){ const ang = (i/3)*Math.PI*2 + (Math.random()-0.5)*0.4; drawLeaf(ctx,0,0,sizeF*0.35,sizeF*0.12,ang); }
      const [petalBase,petalTip] = colors;
  for(let i=0;i<petals;i++){ const a=(i/petals)*Math.PI*2; const dist=sizeF*0.48; const px=Math.cos(a)*dist, py=Math.sin(a)*dist; ctx.save(); ctx.translate(px,py); ctx.rotate(a); const rx=sizeF*1.15, ry=sizeF*0.85; const grad=ctx.createLinearGradient(-rx*0.2,0,rx*1.05,0); grad.addColorStop(0,petalBase); grad.addColorStop(1,petalTip); ctx.fillStyle=grad; ctx.beginPath(); ctx.moveTo(-rx*0.18,0); ctx.bezierCurveTo(rx*0.18,-ry,rx*0.95,-ry*0.6,rx,0); ctx.bezierCurveTo(rx*0.95,ry*0.6,rx*0.18,ry,-rx*0.18,0); ctx.closePath(); ctx.fill(); ctx.restore(); }
      const cg = ctx.createRadialGradient(0,0,sizeF*0.04,0,0,sizeF*0.36); cg.addColorStop(0,'#fff6c9'); cg.addColorStop(0.55,centerCol); cg.addColorStop(1,'#8a5a1f'); ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(0,0,sizeF*0.36,0,Math.PI*2); ctx.fill(); ctx.restore(); }

  // dense packed grid placement: step is small to create overlap and no gaps
  const innerW = W - margin*2, innerH = H - margin*2;
  // reduce step so cells are smaller (denser packing). Keep a modest minimum.
  const step = Math.max(4, Math.round(size * 0.04));
    const cols = Math.ceil(innerW / step);
    const rows = Math.ceil(innerH / step);
    // loop grid and place a flower in each cell, clamping to avoid edge clipping
    // to avoid a uniform filled edge, create an "edge band" where placement is randomized
    const edgeBand = Math.max(step * 3, Math.round(Math.min(innerW, innerH) * 0.18));
    for (let ry = 0; ry < rows; ry++){
      for (let cx = 0; cx < cols; cx++){
        // base center for this cell
        const baseX = margin + cx * step + Math.floor(step * 0.5);
        const baseY = margin + ry * step + Math.floor(step * 0.5);

        // compute distance to nearest inner-rect edge for this cell center
        const distLeft = baseX - margin;
        const distRight = margin + innerW - baseX;
        const distTop = baseY - margin;
        const distBottom = margin + innerH - baseY;
        const distToEdge = Math.min(distLeft, distRight, distTop, distBottom);

        // if inside the main inner area (outside edgeBand) always draw; otherwise
        // use a distance-based probability so flowers near the edge appear as patches
        if (distToEdge < edgeBand){
          const p = Math.max(0.08, Math.min(1, distToEdge / edgeBand));
          // square the prob to bias against very-outer cells (sparser at extreme edges)
          const prob = p * p;
          if (Math.random() > prob) continue; // skip this cell to create patchy edges
        }

        // pick a smaller varied size so each flower is much smaller
        const fs = Math.max(3, Math.round(step * (0.42 + (Math.random()*0.2 - 0.1))));
        const petals = Math.floor(Math.random()*3) + 5;
        const maxExtent = Math.ceil(fs * 1.25);
        // clamp center so full extent remains inside inner rect
        // reduce jitter so flowers stay nicely inside grid cells and away from edges
        const jitter = Math.round(step * 0.18);
        const x = Math.min(margin + innerW - maxExtent, Math.max(margin + maxExtent, baseX + (Math.random()* (jitter*2) - jitter)));
        const y = Math.min(margin + innerH - maxExtent, Math.max(margin + maxExtent, baseY + (Math.random()* (jitter*2) - jitter)));
        const colors = palette.petals[Math.floor(Math.random()*palette.petals.length)];
        const centerCol = palette.centers[Math.floor(Math.random()*palette.centers.length)];
        const rot = (Math.random()-0.5)*0.6;
        drawFlower(g, x, y, fs, petals, colors, centerCol, rot);
      }
    }
    // restore clipping
    g.restore();
    return c;
  }catch(_){ return null; }
}
// static safe area center (world coords). Mutable so we can set it to the player's start position.
// safe patch centers (world coords). We'll create multiple fixed patches around the map.
let START_SAFE_CENTERS = [];
// populate four sample centers spaced around the world (tweak as desired)
try{
  START_SAFE_CENTERS = [
    { x: Math.round(WORLD_W * 0.2), y: Math.round(WORLD_H * 0.25) },
    { x: Math.round(WORLD_W * 0.8), y: Math.round(WORLD_H * 0.25) },
    { x: Math.round(WORLD_W * 0.2), y: Math.round(WORLD_H * 0.75) },
    { x: Math.round(WORLD_W * 0.8), y: Math.round(WORLD_H * 0.75) }
  ];
}catch(_){ START_SAFE_CENTERS = []; }
// hide-while-in-patch relocation: if player accumulates this much hide time (while
// inside any patch) then randomize the other patches' locations. The timer is shared
// across all patches and pauses when the player leaves flowers (it does not reset).
const SAFE_RELOCATE_ON_HIDE_MS = 20000; // 20 seconds
let hideAccumMs = 0;       // accumulated hide time (ms) while player is inside flowers
let hideActive = false;    // whether player is currently inside any flower patch
let hideLastMs = 0;        // last timestamp used to increment accumulator
// relocation flash/debug state
let relocateFlashUntil = 0;
let relocateFlashCenters = [];

function randomizeOtherSafeCenters(excludeIndex){
  try{
    if (!START_SAFE_CENTERS || !START_SAFE_CENTERS.length) return;
    const minMarginX = Math.max(32, Math.round(WORLD_W * 0.08));
    const minMarginY = Math.max(32, Math.round(WORLD_H * 0.08));
    const minDist = Math.max(START_SAFE_RADIUS * 2 + 48, 120);
    const newCenters = START_SAFE_CENTERS.map((c,i) => ({ x: c.x, y: c.y }));
    for (let i = 0; i < newCenters.length; i++){
      // randomize every center (including the one player is hiding in) so hiding cannot be indefinite
      let attempts = 0;
      let chosen = null;
      while (attempts++ < 128){
        const rx = Math.round(minMarginX + Math.random() * (WORLD_W - minMarginX*2));
        const ry = Math.round(minMarginY + Math.random() * (WORLD_H - minMarginY*2));
        // ensure not too close to any already-chosen new center
        // ensure not too close to any already-chosen new center
        let ok = true;
        for (let j = 0; j < newCenters.length; j++){
          if (j === i) continue;
          const nc = newCenters[j]; if (!nc) continue;
          const d2 = Math.hypot(rx - nc.x, ry - nc.y); if (d2 < minDist) { ok = false; break; }
        }
        if (!ok) continue;
        chosen = { x: rx, y: ry }; break;
      }
      // fallback: if not found, pick a somewhat distant point anyway
      if (!chosen){
        chosen = { x: Math.round(minMarginX + Math.random() * (WORLD_W - minMarginX*2)), y: Math.round(minMarginY + Math.random() * (WORLD_H - minMarginY*2)) };
      }
      newCenters[i] = chosen;
    }
  // commit new centers
  START_SAFE_CENTERS = newCenters;
  // debug/log so we can confirm relocation happened in runtime
  try{ if (typeof console !== 'undefined' && console.info) console.info('safe-centers randomized', START_SAFE_CENTERS); }catch(_){ }
  // set a brief visual flash window and remember centers
  try{ const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); relocateFlashUntil = now + 900; relocateFlashCenters = newCenters.map(n=>({x:n.x,y:n.y})); }catch(_){ }
  // reset shared hide accumulator so player must hide again at new locations
  hideAccumMs = 0; hideActive = false; hideLastMs = 0;
  }catch(_){ }
}
// prepare initial flower patch canvas sized to START_SAFE_RADIUS (if DOM available)
try{ if (typeof document !== 'undefined' && document.createElement){ startPatchCanvas = createFlowerPatchCanvas(START_SAFE_RADIUS); } }catch(_){ startPatchCanvas = null; }
let lastSpawn = 0;
let score = 0; let health = 3; let gameOver = false;
let paused = false; // when true, main game updates pause but explosion pieces still animate
const MAX_HEALTH = 5;
// initialize journal now that MAX_HEALTH and health exist
try {
  initJournal({ hud: hud, maxHealth: MAX_HEALTH, health: health });
} catch (err) { console.warn('initJournal failed', err); }

// Debug helper: call `window.debugUnlockFiesta()` from the browser console to
// force-unlock the Ford Fiesta into HUD slot index 1 for testing. To enable
// automatically on load, set localStorage.setItem('tn_debug_unlock_fiesta','1')
// and reload.
try{
  if (typeof window !== 'undefined'){
    window.debugUnlockFiesta = function(){ try{ VEHICLE_SLOTS[1] = 'fordfiesta'; VEHICLE_UNLOCKED[1] = true; try{ updateHud(); }catch(_){ } }catch(_){ } };
  window.debugUnlockBond = function(){ try{ VEHICLE_SLOTS[4] = 'bondtank'; VEHICLE_UNLOCKED[4] = true; try{ updateHud(); }catch(_){ } }catch(_){ } };
    window.debugUnlockAndSelectBond = function(){ try{ VEHICLE_SLOTS[4] = 'bondtank'; VEHICLE_UNLOCKED[4] = true; try{ updateHud(); }catch(_){ } try{ selectVehicleSlot(4); }catch(_){ } }catch(_){ } };
    window.debugSelectGerman = function(){ try{ VEHICLE_SLOTS[5] = 'empty6'; VEHICLE_UNLOCKED[5] = true; try{ updateHud(); }catch(_){ } try{ selectVehicleSlot(5); }catch(_){ } }catch(_){ } };

  window.debugSelectMexico = function(){ try{ VEHICLE_SLOTS[6] = 'empty7'; VEHICLE_UNLOCKED[6] = true; try{ updateHud(); }catch(_){ } try{ selectVehicleSlot(6); }catch(_){ } }catch(_){ } };

  window.debugSelectChina = function(){ try{ VEHICLE_SLOTS[7] = 'empty8'; VEHICLE_UNLOCKED[7] = true; try{ updateHud(); }catch(_){ } try{ selectVehicleSlot(7); }catch(_){ } }catch(_){ } };

  window.debugSelectMcds = function(){ try{ VEHICLE_SLOTS[8] = 'empty9'; VEHICLE_UNLOCKED[8] = true; try{ updateHud(); }catch(_){ } try{ selectVehicleSlot(8); }catch(_){ } }catch(_){ } };
    window.debugUnlockAndSelectGerman = window.debugSelectGerman;
    try{ if (localStorage && localStorage.getItem && localStorage.getItem('tn_debug_unlock_fiesta') === '1'){ window.debugUnlockFiesta(); } }catch(_){ }
  try{ if (localStorage && localStorage.getItem && localStorage.getItem('tn_debug_unlock_bond') === '1'){ window.debugUnlockBond(); } }catch(_){ }
  }
}catch(_){ }

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

// spawn a small group of jungle NPCs near the player's starting position
function spawnInitialJungleGroup(count = 3){
  try{
    const px = (tank && typeof tank.x === 'number') ? tank.x : WORLD_W/2;
    const py = (tank && typeof tank.y === 'number') ? tank.y : WORLD_H/2;
    const hpMap = { commando:3, scout:2, heavy:4, medic:2, villager1:1, villager2:1, guide:3, radioop:2, squidrobot:2, fatsammich:1 };
    const spdMap = { commando:45, scout:65, heavy:35, medic:50, villager1:40, villager2:40, guide:55, radioop:40, squidrobot:18 };
    for (let i = 0; i < Math.max(0, Math.min(6, count)); i++){
      const ang = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() * 0.5 - 0.25);
      const dist = 48 + Math.random() * 64;
      const x = px + Math.cos(ang) * dist;
      const y = py + Math.sin(ang) * dist;
      const kind = (Array.isArray(JUNGLE_KINDS) && JUNGLE_KINDS.length) ? JUNGLE_KINDS[Math.floor(Math.random()*JUNGLE_KINDS.length)] : 'commando';
      // sometimes replace heavy with chained tank for variety
      if (kind === 'heavy' && Math.random() < 0.5){ try{ const alt = spawnChainedTank(x, y, {}); enemies.push(alt); continue; }catch(_){ } }
      const { c: tileC, g: tileG } = charTileCanvas();
      const idle = (idleMakers && idleMakers[kind]) ? idleMakers[kind](tileG) : (()=>{});
      const run = (runMakers && runMakers[kind]) ? runMakers[kind](tileG) : (()=>{});
      const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
      const ent = { x, y, spd: baseSpd, r: 14, type: 'jungle', kind, hp: (hpMap[kind] || 2), tileC, tileG, idle, run, angle: 0, turretAngle: 0, lastAttack: 0, attackCD: 500 + Math.random()*300, dashUntil:0, moving: false, harmless: false };
      enemies.push(ent);
    }
  }catch(_){ }
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
  // small chance to call in an osprey that drops combatants (disabled here to avoid overload)
  // previously: if (Math.random() < 0.28){ spawnOsprey(x,y); return; }
  // Use periodic spawner (maybeSpawnPeriodicOsprey) which ensures visibility and rate-limits.
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
  const idle = charsIdleMakers.osprey(tileG);
  const run = charsRunMakers.osprey(tileG);
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
  try{
    // Prefer precise barrel-tip coordinates derived from tank piece definitions when available.
    // This aligns muzzle flash and shell ejection to the actual sprite barrel end.
    if (selectedVehicle === 'tank'){
      const defs = (typeof tankPieceDefs === 'function') ? tankPieceDefs() : null;
      let barrelDef = null;
      if (Array.isArray(defs)) barrelDef = defs.find(d => d.base === 'turret' && d.barrel);
      if (barrelDef && typeof tankLocalToWorld === 'function'){
        // compute top-center of the barrel piece (muzzle tip)
        const cx = barrelDef.sx + (barrelDef.sw / 2);
        const cy = barrelDef.sy; // top edge = muzzle
        const lx = cx - SPR_W / 2;
        const ly = cy - SPR_H / 2;
        const baseAng = tank.turretAngle + Math.PI/2;
        try{ const p = tankLocalToWorld(lx, ly, baseAng); if (p && typeof p.x === 'number'){ muzzleX = p.x; muzzleY = p.y; } }catch(_){ }
      } else if (selectedVehicleVariant === 'bondtank' && typeof turretCanvas !== 'undefined' && turretCanvas && turretCanvas.width){
        // Bond turret artwork tends to place the muzzle near the top-center of its turret canvas.
        // Use a normalized guess and inset slightly forward so the flash appears at the barrel tip.
        const tx = turretCanvas.width * 0.5;
        const ty = Math.max(1, Math.round(turretCanvas.height * 0.05));
        // Tunable inset (pixels) to nudge muzzle closer to barrel tip in the turret local coords
  const bondMuzzleInset = 0; // tuned: 0 places muzzle at top-center of turret canvas (closer to barrel tip)
        const lx = tx - SPR_W / 2;
        const ly = Math.max(0, ty - bondMuzzleInset) - SPR_H / 2;
        const baseAng = tank.turretAngle + Math.PI/2;
        try{ const p = tankLocalToWorld(lx, ly, baseAng); if (p && typeof p.x === 'number'){ muzzleX = p.x; muzzleY = p.y; } }catch(_){ }
      }
    }
  }catch(_){ /* fallback to earlier computed sx/sy */ }
  // Bond-specific fine-tune: nudge muzzle in world-space toward turret base (negative = closer)
  try{
    if (selectedVehicle === 'tank' && selectedVehicleVariant === 'bondtank'){
  const bondMuzzleWorldShift = 56; // nudged outward additional 10px
      muzzleX += Math.cos(a) * bondMuzzleWorldShift;
      muzzleY += Math.sin(a) * bondMuzzleWorldShift;
    }
  }catch(_){ }
  // Default tank small outward nudge so projectiles appear slightly in front of the barrel
  try{
    if (selectedVehicle === 'tank' && selectedVehicleVariant === 'default'){
  const defaultMuzzleWorldShift = 20; // 20px outward (moved 10px closer to barrel tip)
      muzzleX += Math.cos(a) * defaultMuzzleWorldShift;
      muzzleY += Math.sin(a) * defaultMuzzleWorldShift;
    }
  }catch(_){ }
  // Murkia special behaviour: the Murkia tank fires 4 projectiles that rotate with the turret
  if (selectedVehicle === 'tank' && selectedVehicleVariant === 'murkia'){
    // For Murkia, spawn all projectiles from the turret center so they line up
    // visually with the rotating turret. Override the muzzle origin to tank center.
    muzzleX = tank.x;
    muzzleY = tank.y;
    try{
      // nudge Murkia muzzle forward a small amount so shots appear from the barrel
  const murkiaMuzzleWorldShift = 40; // positive moves outward along turret dir (moved +10px)
      muzzleX += Math.cos(a) * murkiaMuzzleWorldShift;
      muzzleY += Math.sin(a) * murkiaMuzzleWorldShift;
    }catch(_){ }
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
      bullets.push({ x: muzzleX - ox, y: muzzleY - oy, dx, dy, life: 2.0, color: colorFor(0,2) });
      bullets.push({ x: muzzleX + ox, y: muzzleY + oy, dx, dy, life: 2.0, color: colorFor(1,2) });
    } else if (selectedVehicle === 'tank' && activeShots === 3){
      bullets.push({ x: muzzleX, y: muzzleY, dx, dy, life: 2.0, color: colorFor(1,3) });
      const angleSpread = 0.18; const a1 = a - angleSpread; const a2 = a + angleSpread;
      bullets.push({ x: muzzleX + Math.cos(a1)*4, y: muzzleY + Math.sin(a1)*4, dx: Math.cos(a1)*BULLET_SPEED, dy: Math.sin(a1)*BULLET_SPEED, life: 2.0, color: colorFor(0,3) });
      bullets.push({ x: muzzleX + Math.cos(a2)*4, y: muzzleY + Math.sin(a2)*4, dx: Math.cos(a2)*BULLET_SPEED, dy: Math.sin(a2)*BULLET_SPEED, life: 2.0, color: colorFor(2,3) });
    } else if (selectedVehicle === 'tank' && activeShots === 4){
      const total = 5; bullets.push({ x: muzzleX, y: muzzleY, dx, dy, life: 2.5, color: colorFor(2,total) });
      const innerSpread = 0.12; const outerSpread = 0.28;
      const a_in_l = a - innerSpread, a_in_r = a + innerSpread;
      const a_out_l = a - outerSpread, a_out_r = a + outerSpread;
      bullets.push({ x: muzzleX + Math.cos(a_in_l)*3, y: muzzleY + Math.sin(a_in_l)*3, dx: Math.cos(a_in_l)*BULLET_SPEED, dy: Math.sin(a_in_l)*BULLET_SPEED, life: 2.0, color: colorFor(1,total) });
      bullets.push({ x: muzzleX + Math.cos(a_in_r)*3, y: muzzleY + Math.sin(a_in_r)*3, dx: Math.cos(a_in_r)*BULLET_SPEED, dy: Math.sin(a_in_r)*BULLET_SPEED, life: 2.0, color: colorFor(3,total) });
      bullets.push({ x: muzzleX + Math.cos(a_out_l)*6, y: muzzleY + Math.sin(a_out_l)*6, dx: Math.cos(a_out_l)*BULLET_SPEED, dy: Math.sin(a_out_l)*BULLET_SPEED, life: 2.0, color: colorFor(0,total) });
      bullets.push({ x: muzzleX + Math.cos(a_out_r)*6, y: muzzleY + Math.sin(a_out_r)*6, dx: Math.cos(a_out_r)*BULLET_SPEED, dy: Math.sin(a_out_r)*BULLET_SPEED, life: 2.0, color: colorFor(4,total) });
    } else {
      bullets.push({ x: muzzleX, y: muzzleY, dx, dy, life: 2.0, color: 'hsl(18 95% 58%)' });
    }
  try{ spawnMuzzleFlash(muzzleX, muzzleY, a); }catch(_){ }
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
  // spawn a single jungle NPC near the player for a minimal preview
  try{ spawnInitialJungleGroup(1); }catch(_){ }
  // spawn critters and animals for jungle atmosphere
  try{ spawnCritters(enemies); }catch(_){ }
  try{ spawnAnimals(enemies); }catch(_){ }
  // spawn a test double-shot powerup near the tank so it can be picked up immediately
  spawnPowerup(tank.x + 40, tank.y, 'double');
  // set the static safe-area center to the player's spawn and grant a brief safe window
  try{ START_SAFE_CENTER_X = Math.round(tank.x); START_SAFE_CENTER_Y = Math.round(tank.y); }catch(_){ START_SAFE_CENTER_X = Math.round(WORLD_W * 0.5); START_SAFE_CENTER_Y = Math.round(WORLD_H * 0.85); }
  // Safe area is permanent
  try{ startSafeUntil = Infinity; }catch(_){ startSafeUntil = Infinity; }
  // regenerate the flower patch canvas to match configured radius
  try{ startPatchCanvas = createFlowerPatchCanvas(START_SAFE_RADIUS); }catch(_){ startPatchCanvas = null; }
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
  // small probability per check to spawn one (reduced to avoid overload)
  // also skip spawning if more than 1 osprey already present
  const existingOspreys = enemies.filter(e=>e && e.type === 'osprey').length;
  if (existingOspreys > 1) return;
  if (Math.random() < 0.18){
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
  const nowt = performance.now();
  if (tank.shotCount && tank.powerupUntil && nowt < tank.powerupUntil){
    const sec = Math.ceil((tank.powerupUntil - nowt)/1000);
    let label = 'Double';
    if (tank.shotCount === 3) label = 'Triple';
    else if (tank.shotCount === 4) label = 'Quad';
    pu = `<div class="tn-panel tn-powerup">${label} (${sec}s)</div>`;
  }

  // shield indicator
  let shieldInfo = '';
  if (shieldActive && nowt < shieldUntil){
    const sec = Math.ceil((shieldUntil - nowt)/1000);
    shieldInfo = `<div class="tn-panel tn-shield" style="margin-top:4px">Shield (${sec}s)</div>`;
  } else if (nowt < shieldCooldownUntil){
    const sec = Math.ceil((shieldCooldownUntil - nowt)/1000);
    shieldInfo = `<div class="tn-panel tn-shield-cooldown" style="margin-top:4px">Shield CD (${sec}s)</div>`;
  }

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
  // create or update vehicle menu (right side, expandable)
  try{
    if (typeof window !== 'undefined' && window.__debugVehicleSlots) try{ console.log('DEBUG: updateHud vehicle slots before rebuild', VEHICLE_SLOTS, VEHICLE_UNLOCKED); }catch(_){ }
    let vmenu = document.getElementById('tn-vehicle-menu');
    let vtoggle = document.getElementById('tn-vehicle-toggle');
    if (!vmenu){ 
      vmenu = document.createElement('div'); 
      vmenu.id = 'tn-vehicle-menu'; 
      vmenu.className = 'tn-vehicle-menu closed'; 
      document.body.appendChild(vmenu); 
    }
    if (!vtoggle){
      vtoggle = document.createElement('div');
      vtoggle.id = 'tn-vehicle-toggle';
      vtoggle.className = 'tn-vehicle-toggle';
      vtoggle.innerText = 'Tanks off';
      vtoggle.addEventListener('click', ()=>{
        const journal = document.getElementById('journal');
        const isClosed = vmenu.classList.contains('closed');
        if (isClosed){ 
          vmenu.classList.remove('closed'); 
          vmenu.classList.add('open');
          vtoggle.innerText = 'Tanks';
          vtoggle.classList.remove('closed');
          // Close journal if it's open
          if (journal && !journal.classList.contains('closed')) {
            journal.classList.add('closed');
            journal.classList.remove('open');
            const jtoggle = document.getElementById('journalToggle');
            if (jtoggle) jtoggle.innerText = 'Journal off';
            if (jtoggle) jtoggle.classList.add('closed');
          }
        } else { 
          vmenu.classList.add('closed'); 
          vmenu.classList.remove('open');
          vtoggle.innerText = 'Tanks off'; 
          vtoggle.classList.add('closed');
        }
      });
      document.body.appendChild(vtoggle);
    }
    // Position the toggle and menu relative to journal position
    try{
      const journalTop = (hud && hud.classList && hud.classList.contains('tn-hud')) ? '94px' : '12px';
      const tankTop = `calc(${journalTop} + 48px)`; // 48px below journal
      vtoggle.style.top = tankTop;
      vtoggle.style.right = '20px';
      vmenu.style.top = tankTop;
      vmenu.style.right = '20px';
    }catch(_){ }
    // rebuild slots
    vmenu.innerHTML = '';
    const title = document.createElement('div');
    title.style.fontFamily = 'monospace';
    title.style.fontSize = '12px';
    title.style.fontWeight = '800';
    title.style.color = '#e6e6e6';
    title.style.marginBottom = '8px';
    title.style.textAlign = 'center';
    title.innerText = 'TANK SELECTION';
    vmenu.appendChild(title);
    // rebuild slots
    vmenu.innerHTML = '';
    for (let i=0;i<VEHICLE_SLOTS.length;i++){
      if (typeof window !== 'undefined' && window.__debugVehicleSlots) try{ console.log('DEBUG: building slot', i, VEHICLE_SLOTS[i], VEHICLE_UNLOCKED[i]); }catch(_){ }
      const slot = document.createElement('div');
      slot.className = 'vehicle-slot' + (VEHICLE_UNLOCKED[i] ? '' : ' locked') + ( ( (VEHICLE_SLOTS[i] === 'tank' && selectedVehicle === 'tank' && selectedVehicleVariant === 'default') || (VEHICLE_SLOTS[i] === 'fordfiesta' && selectedVehicleVariant === 'fordfiesta') || (VEHICLE_SLOTS[i] === 'murkia' && selectedVehicleVariant === 'murkia') || (VEHICLE_SLOTS[i] === 'dozer' && selectedVehicleVariant === 'dozer') || (VEHICLE_SLOTS[i] === 'bondtank' && selectedVehicleVariant === 'bondtank') || (VEHICLE_SLOTS[i] === 'empty6' && selectedVehicleVariant === 'german') || (VEHICLE_SLOTS[i] === 'empty7' && selectedVehicleVariant === 'mexico') || (VEHICLE_SLOTS[i] === 'empty8' && selectedVehicleVariant === 'china') || (VEHICLE_SLOTS[i] === 'empty9' && selectedVehicleVariant === 'mcds') || (VEHICLE_SLOTS[i] === 'french' && selectedVehicleVariant === 'french') || (VEHICLE_SLOTS[i] === 'facebook' && selectedVehicleVariant === 'facebook') || (VEHICLE_SLOTS[i] === 'waffle' && selectedVehicleVariant === 'waffle') || (VEHICLE_SLOTS[i] === 'blackstar' && selectedVehicleVariant === 'blackstar') || (VEHICLE_SLOTS[i] === 'heli' && selectedVehicle === 'heli') ) ? ' selected' : '');
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
        else if (VEHICLE_SLOTS[i] === 'empty6'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'German';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__german_body){ const bw = window.__german_body.width, bh = window.__german_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__german_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawGermanBodyInto === 'function'){
                try{ drawGermanBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'empty7'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Mexico';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__mexico_body){ const bw = window.__mexico_body.width, bh = window.__mexico_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__mexico_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawMexicoBodyInto === 'function'){
                try{ drawMexicoBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'empty8'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'China';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__china_body){ const bw = window.__china_body.width, bh = window.__china_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__china_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawChinaBodyInto === 'function'){
                try{ drawChinaBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'empty9'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = "McD's";
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__mcds_body){ const bw = window.__mcds_body.width, bh = window.__mcds_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__mcds_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawMcdsBodyInto === 'function'){
                try{ drawMcdsBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
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
        else if (VEHICLE_SLOTS[i] === 'bondtank'){
          try{
            // Always create a small preview canvas and label like other slots
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Bond';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }

            // If we don't yet have a baked 64x64 body canvas, create one so we can copy pixels
            try{
              if (typeof window !== 'undefined' && !window.__bondtank_body && typeof drawBondtankInto === 'function'){
                const off = document.createElement('canvas'); off.width = 64; off.height = 64; const og = off.getContext('2d'); try{ og.imageSmoothingEnabled = false; }catch(_){ }
                try{ drawBondtankInto(og, 64, 64, performance.now()); }catch(_){ }
                window.__bondtank_body = off;
                // turret canvas is left transparent (Bond art baked into body)
                const off2 = document.createElement('canvas'); off2.width = 64; off2.height = 64; const og2 = off2.getContext('2d'); try{ og2.imageSmoothingEnabled = false; }catch(_){ }
                og2.clearRect(0,0,64,64); window.__bondtank_turret = off2;
              }
            }catch(_){ }

            // If we have a baked body canvas, draw it pixel-perfect scaled into the preview
            if (typeof window !== 'undefined' && window.__bondtank_body){
              try{
                const bw = window.__bondtank_body.width || SPR_W * SPRITE_SCALE; const bh = window.__bondtank_body.height || SPR_H * SPRITE_SCALE;
                const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1);
                const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2);
                try{ g.drawImage(window.__bondtank_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
                try{ if (typeof window.__bondtank_turret !== 'undefined' && window.__bondtank_turret){ const tw = window.__bondtank_turret.width, th = window.__bondtank_turret.height; g.drawImage(window.__bondtank_turret, 0,0,tw,th, dx,dy, Math.round(tw*scale), Math.round(th*scale)); } }catch(_){ }
              }catch(_){ /* ignore preview draw errors */ }
            } else {
              // fallback: draw directly into the preview using the renderer
              try{ if (typeof drawBondtankInto === 'function') drawBondtankInto(g, cw, ch, performance.now()); }catch(_){ }
            }

            }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'french'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'French';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__french_body){ const bw = window.__french_body.width, bh = window.__french_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__french_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawFrenchBodyInto === 'function'){
                try{ drawFrenchBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'facebook'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Facebook';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__facebook_body){ const bw = window.__facebook_body.width, bh = window.__facebook_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__facebook_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawFacebookBodyInto === 'function'){
                try{ drawFacebookBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'waffle'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Waffle';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__waffle_body){ const bw = window.__waffle_body.width, bh = window.__waffle_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__waffle_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawWaffleBodyInto === 'function'){
                try{ drawWaffleBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'blackstar'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Blackstar';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              // Draw body
              if (typeof drawBlackstarBodyInto === 'function'){
                try{ drawBlackstarBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
              // Draw turret on top
              if (typeof drawBlackstarTurretInto === 'function'){
                try{ drawBlackstarTurretInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] && VEHICLE_SLOTS[i].startsWith && VEHICLE_SLOTS[i].startsWith('empty')){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px';
            const idx = i + 1; label.textContent = 'Empty ' + idx;
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              // simple neutral placeholder preview
              g.fillStyle = '#1f1f1f'; g.fillRect(0,0,cw,ch);
              g.fillStyle = '#2f2f2f'; g.fillRect(6,6, Math.max(8,cw-12), Math.max(8,ch-12));
              g.fillStyle = '#cfcfcf'; g.font = Math.max(10, Math.floor(ch/5)) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
              g.fillText('Empty', cw/2, ch/2);
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
      } else {
        // locked slot - show a preview for bond if we have the baked asset or renderer so testers see the art
        if (VEHICLE_SLOTS[i] === 'bondtank'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Bond (locked)';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }

            if (typeof window !== 'undefined' && window.__bondtank_body){
              try{
                const bw = window.__bondtank_body.width || SPR_W * SPRITE_SCALE; const bh = window.__bondtank_body.height || SPR_H * SPRITE_SCALE;
                const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1);
                const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2);
                try{ g.drawImage(window.__bondtank_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              }catch(_){ }
            } else if (typeof drawBondtankInto === 'function'){
              try{ drawBondtankInto(g, cw, ch, performance.now()); }catch(_){ }
            } else {
              slot.innerHTML = '<div style="font-size:22px">?</div>';
              vmenu.appendChild(slot);
            }
          }catch(_){ slot.innerHTML = '<div style="font-size:22px">?</div>'; vmenu.appendChild(slot); }
        } else if (VEHICLE_SLOTS[i] === 'empty6'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'German (locked)';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__german_body){ const bw = window.__german_body.width, bh = window.__german_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__german_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawGermanBodyInto === 'function'){
                try{ drawGermanBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:22px">?</div>'; vmenu.appendChild(slot); }
        } else if (VEHICLE_SLOTS[i] && VEHICLE_SLOTS[i].startsWith && VEHICLE_SLOTS[i].startsWith('empty')){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px';
            const idx = i + 1; label.textContent = 'Empty ' + idx + ' (locked)';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              g.fillStyle = '#111'; g.fillRect(0,0,cw,ch);
              g.fillStyle = '#262626'; g.fillRect(6,6, Math.max(8,cw-12), Math.max(8,ch-12));
              g.fillStyle = '#999'; g.font = Math.max(10, Math.floor(ch/6)) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
              g.fillText('Locked', cw/2, ch/2);
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:22px">?</div>'; vmenu.appendChild(slot); }
        } else {
          slot.innerHTML = '<div style="font-size:22px">?</div>';
          vmenu.appendChild(slot);
        }
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
      // tank run-over: damage nearby buildings (houses/huts)
      try{
        for (let bi = buildingInstances.length - 1; bi >= 0; bi--){
          const B = buildingInstances[bi];
          const scale = B.scale || 1;
          const half = 32 * scale; // collision radius (same as bullet collision)
          const dx = B.x - tank.x;
          const dy = wrapDeltaY(B.y, tank.y);
          if (Math.hypot(dx, dy) < half){
            // damage the building
            B.hp = (B.hp || 10) - 1;
            try{ spawnMuzzleFlash(B.x, B.y, 0); }catch(_){ }
            if (B.hp <= 0){
              // building destroyed - spawn fragments
              try{
                const tile = (typeof buildingTiles !== 'undefined') ? buildingTiles[B.idx] : null;
                if (tile && tile.c){
                  const src = tile.c;
                  const w = Math.min(64, src.width|0), h = Math.min(64, src.height|0);
                  const pieces = 8 + Math.floor(Math.random()*10);
                  for (let p=0;p<pieces;p++){
                    const pw = 6 + Math.floor(Math.random()*26);
                    const ph = 6 + Math.floor(Math.random()*26);
                    const sx = Math.max(0, Math.floor(Math.random()*(w - pw)));
                    const sy = Math.max(0, Math.floor(Math.random()*(h - ph)));
                    const worldX = B.x + (sx - w/2) * scale;
                    const worldY = B.y + (sy - h/2) * scale;
                    try{ moduleGibs.push({ src, sx, sy, sw: pw, sh: ph, x: worldX, y: worldY, vx: (Math.random()-0.5)*260, vy: -80 + Math.random()*260, rot: (Math.random()-0.5)*2, vr: (Math.random()-0.5)*6, life: 1.6 + Math.random()*1.8, gravity: 160, scale: scale }); }catch(_){ callSpawnGibs(B.x, B.y, '#ffd1e8', 20, 'building-frag-fallback'); }
                  }
                } else {
                  callSpawnGibs(B.x, B.y, '#ffd1e8', 18, 'building-basic');
                }
              }catch(_){ try{ callSpawnGibs(B.x, B.y, '#ffd1e8', 18, 'building-frag-err'); }catch(_){ } }
              // schedule building respawn
              try{ scheduleRespawn('building', B, 5000); }catch(_){ }
              buildingInstances.splice(bi, 1);
              // visuals and effects
              try{ triggerTankBump(12, 0.22); }catch(_){ }
              try{ triggerScreenShake(18, 0.26); }catch(_){ }
            } else {
              // building damaged but not destroyed
              try{ triggerTankBump(8, 0.16); }catch(_){ }
              try{ triggerScreenShake(12, 0.18); }catch(_){ }
            }
            break; // only hit one building per frame
          }
        }
      }catch(_){ }
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
  if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless>'), e); }catch(_){ } score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 8, 'enemy-hit-harmless'); try{ enemyDropChance(e,e.x,e.y); }catch(_){ } }
      else if (e.type === 'jungle' || e.type === 'animal' || e.type === 'critter'){
        e.hp = (e.hp||1) - 1;
  if (e.hp <= 0){ enemies.splice(ei,1); score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 12, 'enemy-killed-by-bullet'); try{ enemyDropChance(e,e.x,e.y); }catch(_){ } }
  if (e.hp <= 0){ try{ recordDeath(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ } try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ } }
  } else {
          // osprey: spawn logical osprey gibs
          if (e.type === 'osprey'){
            enemies.splice(ei,1);
            try{ enemyDropChance(e,e.x,e.y); }catch(_){ }
            try{ recordDeath(e.kind || '<osprey-killed>', e); }catch(_){}
            try{ recordKill(e.kind || '<osprey-killed>', e); }catch(_){}
            score += 1; updateHud();
            try{ spawnOspreyGibs(e.x, e.y, e); }catch(_){ callSpawnGibs(e.x, e.y, '#b0c7cf', 18, 'osprey-fallback'); }
            // Always drop the journal powerup on osprey death to make it reliable
            try{ spawnJournalPowerup(e.x, e.y, 'collect-peanut'); }catch(_){ }
            try{ enemyDropChance(e,e.x,e.y); }catch(_){ }
          } else {
            enemies.splice(ei,1); try{ recordDeath(e.kind || '<default-killed>', e); }catch(_){ } try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<default-killed>'), e); }catch(_){ } score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 10, 'enemy-default-killed'); try{ enemyDropChance(e,e.x,e.y); }catch(_){ }
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
      // collision with player vehicle (respect start-safe immunity)
    if (selectedVehicle){ const px = (selectedVehicle === 'heli') ? heli.x : tank.x; const py = (selectedVehicle === 'heli') ? heli.y : tank.y; const dist = Math.hypot(eb.x - px, eb.y - py);
        // if within initial safe window and inside safe radius, ignore damage
        const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  let inStartSafe = false;
  if (startSafeUntil && nowMs < startSafeUntil && START_SAFE_CENTERS && START_SAFE_CENTERS.length){
    for (let si = 0; si < START_SAFE_CENTERS.length; si++){
      const sc = START_SAFE_CENTERS[si];
      if (Math.hypot(px - sc.x, py - sc.y) <= START_SAFE_RADIUS){ inStartSafe = true; break; }
    }
  }
        if (dist < (eb.hitR || 8)) {
          enemyBullets.splice(i,1);
          try{ callSpawnGibs(eb.x, eb.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ }
          if (!inStartSafe) {
            // Check if shield is active
            const nowt = performance.now();
            if (shieldActive && nowt < shieldUntil){
              // Shield absorbs the bullet - visual feedback only
              try{ callSpawnGibs(eb.x, eb.y, '#00ffff', 8, 'shield-absorb'); }catch(_){ }
            } else {
              // Normal damage
              health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } }
            }
          } else {
            // visual feedback: small spark but no damage
            try{ callSpawnGibs(eb.x, eb.y, '#fff', 4, 'projectile-absorbed-safe'); }catch(_){ }
          }
        }
      }

      // collision with allies
      for (let ai = allies.length - 1; ai >= 0; ai--) {
        const ally = allies[ai];
        const dist = Math.hypot(eb.x - ally.x, eb.y - ally.y);
        if (dist < (eb.hitR || 8)) {
          enemyBullets.splice(i, 1);
          try { callSpawnGibs(eb.x, eb.y, '#ffd1e8', 6, 'projectile-hit-ally'); } catch (_) { }
          ally.hp -= 1;
          if (ally.hp <= 0) {
            // Ally destroyed
            try { callSpawnGibs(ally.x, ally.y, '#ff6b6b', 12, 'ally-destroyed'); } catch (_) { }
            allies.splice(ai, 1);
          }
          handled = true;
          break;
        }
      }

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
    for (let i = kittenBullets.length-1; i >= 0; i--){ const kb = kittenBullets[i];
      // ensure dt is defined and non-zero
      const _dt = (typeof dt === 'number' && dt > 0) ? dt : 1/60;
      // if dx/dy are absent or near-zero, recompute from stored angle and speed
      if ((!kb.dx && !kb.dy) || (Math.abs(kb.dx) < 1e-6 && Math.abs(kb.dy) < 1e-6)){
        if (typeof kb.a === 'number' && typeof kb.spd === 'number'){
          kb.dx = Math.cos(kb.a) * kb.spd;
          kb.dy = Math.sin(kb.a) * kb.spd;
        }
      }
      // debug logging (throttled) — enable by setting window.__DEBUG_KITTEN = true in the browser console
      try{
        if (typeof window !== 'undefined' && window.__DEBUG_KITTEN){
          const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
          if (nowMs - (__lastKittenDbg || 0) > 200){
            __lastKittenDbg = nowMs;
            try{ console.log('kittenBullets.debug', { idx: i, x: kb.x.toFixed(2), y: kb.y.toFixed(2), dx: kb.dx.toFixed(3), dy: kb.dy.toFixed(3), spd: kb.spd, a: kb.a }); }catch(_){ }
          }
        }
      }catch(_){ }
      kb.x += kb.dx * _dt; kb.y += kb.dy * _dt; kb.life -= _dt; if (kb.life <= 0 || kb.x < -200 || kb.x > WORLD_W+200 || kb.y < -200 || kb.y > WORLD_H+200) { kittenBullets.splice(i,1); continue; }
  if (selectedVehicle){ const px = (selectedVehicle === 'heli') ? heli.x : tank.x; const py = (selectedVehicle === 'heli') ? heli.y : tank.y; const dist = Math.hypot(kb.x - px, kb.y - py);
  const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  let inStartSafe = false;
  if (startSafeUntil && nowMs < startSafeUntil && START_SAFE_CENTERS && START_SAFE_CENTERS.length){
    for (let si = 0; si < START_SAFE_CENTERS.length; si++){
      const sc = START_SAFE_CENTERS[si];
      if (Math.hypot(px - sc.x, py - sc.y) <= START_SAFE_RADIUS){ inStartSafe = true; break; }
    }
  }
      if (dist < (kb.hitR || 6)) {
        kittenBullets.splice(i,1);
        try{ callSpawnGibs(kb.x, kb.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ }
        if (!inStartSafe) {
          health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } }
        } else {
          try{ callSpawnGibs(kb.x, kb.y, '#fff', 4, 'projectile-absorbed-safe'); }catch(_){ }
        }
      }
    }
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
  // Centralized enemy drop helper: preserves existing heart/collect drops and
  // adds a 1-in-5 chance to drop a weapon-upgrade powerup ('double' or 'mini').
  function enemyDropChance(e, x, y){
    try{ doEnemyHeartDrops(e, x, y); }catch(_){ }
    const rand = Math.random();
    if (rand < 0.15) {
      spawnPowerup(x || e.x, y || e.y, 'double');
    } else if (rand < 0.2) {
      spawnMiniPowerup(x || e.x, y || e.y);
    } else if (rand < 0.25) {
      spawnShieldPowerup(x || e.x, y || e.y);
    }
  }
    const targetX = (selectedVehicle === 'heli') ? heli.x : tank.x;
    const targetY = (selectedVehicle === 'heli') ? heli.y : tank.y;
    for (let ei = enemies.length-1; ei >= 0; ei--){ const e = enemies[ei];
  // compute angle: animals should wander (not seek the player), other enemies target the selected vehicle
  let ang;
  if (e.type === 'animal' || e.type === 'critter'){
    // initialize angle if missing
    if (typeof e.angle !== 'number') e.angle = Math.random() * Math.PI * 2;
    // occasional random nudge so animals/critters wander naturally
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
          else if (e.kind === 'pinkdot'){ // kitten enemy: use medium range, slow projectile speed, larger visible hit radius
            // Increase speed so kitten projectiles are visible and travel reliably.
            if (dist < 360) shoot = true, spdB = 140, hitR = 12;
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
                    kittenBullets.push({ x: bx2, y: by2, dx: kdx, dy: kdy, spd: spdB, a: shootA, life: 60.0, hitR: (hitR || 6), anim: true, t0 });
                    if (typeof window !== 'undefined' && window.__DEBUG_KITTEN) try{ console.log('kitten-shot', { ex: e.x, ey: e.y, bx: bx2, by: by2, kdx, kdy, muzzleOff }); }catch(_){ }
                  }catch(_){ 
                    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    kittenBullets.push({ x: bx, y: by, dx, dy, spd: Math.hypot(dx,dy), a: shootA, life: 60.0, hitR: (hitR || 6), anim: true, t0 }); 
                  }
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
  if (e.harmless){ if (e.type === 'jungle' || e.type === 'animal' || e.type === 'critter') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-harmless'); recordDeath(e.kind || '<collision-harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-harmless>'), e); }catch(_){ } enemies.splice(ei,1); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud(); }
      else if (selectedVehicle === 'tank'){
  if (e.type === 'jungle' || e.type === 'animal' || e.type === 'critter') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-tank');
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
  if (e.type === 'jungle' || e.type === 'animal' || e.type === 'critter') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-heli');
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
        else if (e.type === 'jungle' || e.type === 'animal' || e.type === 'critter'){
          e.hp = (e.hp||1) - 1;
          if (e.hp <= 0){
            if (e.type === 'critter' || e.type === 'animal') e.alive = false; // Mark for removal from critters/animals arrays
            enemies.splice(ei,1); recordDeath(e.kind || '<killed-c>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-c>'), e); }catch(_){ } try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud();
          }
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

  // Update critters and animals to remove dead ones from their arrays
  try{ updateCritters(dt); }catch(_){ }
  try{ updateAnimals(dt); }catch(_){ }

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
  // update allies
  if (allies.length) updateAllies(dt);
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
      } else if (p.type === 'mini'){
        // spawn a mini tank ally next to the player
        try{
          spawnMiniTankAlly(vx, vy);
        }catch(_){ console.warn('Failed to spawn mini tank ally', _); }
      } else if (p.type === 'shield'){
        // activate shield if not on cooldown
        const nowt = performance.now();
        if (nowt > shieldCooldownUntil){
          shieldActive = true;
          shieldUntil = nowt + SHIELD_DURATION;
          shieldCooldownUntil = nowt + SHIELD_DURATION + SHIELD_COOLDOWN;
        }
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
  // draw start-safe visual area near the beginning while the safe timer is active
  try{
    const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    if (startSafeUntil && nowMs < startSafeUntil){
      // draw the pre-rendered flower patch under the tank at the start center
      try{
        if (!startPatchCanvas) startPatchCanvas = createFlowerPatchCanvas(START_SAFE_RADIUS);
        if (startPatchCanvas && START_SAFE_CENTERS && START_SAFE_CENTERS.length){
          const desiredPx = START_SAFE_RADIUS * 2;
          const baseW = startPatchCanvas.width;
          const visualScale = 0.5;
          const scaleForWorldBase = desiredPx / baseW * camera.zoom * visualScale;
          for (let i = 0; i < START_SAFE_CENTERS.length; i++){
            try{
              const c = START_SAFE_CENTERS[i];
              const ss = worldToScreen(c.x, c.y);
              const scaleForWorld = scaleForWorldBase; // same visual scale for all
              ctx.save();
              ctx.globalAlpha = 0.98;
              ctx.imageSmoothingEnabled = true;
              ctx.translate(ss.x - (baseW*0.5*scaleForWorld), ss.y - (startPatchCanvas.height*0.5*scaleForWorld));
              ctx.scale(scaleForWorld, scaleForWorld);
              ctx.drawImage(startPatchCanvas, 0, 0);
              ctx.restore();
              // faint circular overlay (keeps the previous ring but faded)
              ctx.save();
              ctx.globalCompositeOperation = 'lighter';
              ctx.globalAlpha = 0.12;
              const ringRadius = desiredPx * 0.5 * visualScale * camera.zoom;
              ctx.beginPath(); ctx.arc(ss.x, ss.y, ringRadius, 0, Math.PI*2); ctx.fillStyle = 'rgba(160,220,255,0.06)'; ctx.fill();
              ctx.lineWidth = Math.max(1, 2 * camera.zoom * visualScale);
              ctx.strokeStyle = 'rgba(160,220,255,0.12)'; ctx.beginPath(); ctx.arc(ss.x, ss.y, ringRadius, 0, Math.PI*2); ctx.stroke();
              ctx.restore();

              // timer ring: show shared hide accumulator depletion across all patches
              try{
                const remaining = Math.max(0, SAFE_RELOCATE_ON_HIDE_MS - hideAccumMs);
                const frac = Math.max(0, Math.min(1, remaining / SAFE_RELOCATE_ON_HIDE_MS));
                // stroke arc: from -90deg clockwise to represent depletion
                const startA = -Math.PI/2; const endA = startA + frac * Math.PI * 2;
                ctx.save();
                ctx.lineWidth = Math.max(2, 3 * camera.zoom * visualScale);
                // color varies when accumulator active
                const ringCol = (hideActive && hideAccumMs > 0) ? 'rgba(255,180,70,0.95)' : 'rgba(160,220,255,0.6)';
                ctx.strokeStyle = ringCol;
                ctx.beginPath(); ctx.arc(ss.x, ss.y, ringRadius + 6 * camera.zoom * visualScale, startA, endA, false); ctx.stroke();
                ctx.restore();
                // relocation flash: if recent randomize occurred, highlight new centers briefly
                try{
                  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                  if (relocateFlashUntil && now < relocateFlashUntil && relocateFlashCenters && relocateFlashCenters.length){
                    // if this center was among relocated ones, draw a glow pulse
                    for (let rf = 0; rf < relocateFlashCenters.length; rf++){
                      const rc = relocateFlashCenters[rf];
                      if (rc.x === c.x && rc.y === c.y){
                        ctx.save(); ctx.globalAlpha = 0.85; ctx.fillStyle = 'rgba(255,220,140,0.14)'; ctx.beginPath(); ctx.arc(ss.x, ss.y, ringRadius + 18 * camera.zoom * visualScale, 0, Math.PI*2); ctx.fill(); ctx.restore();
                        break;
                      }
                    }
                  }
                }catch(_){ }
              }catch(_){ }
            }catch(_){ }
          }
        }
      }catch(_){ }
    }
  }catch(_){ }
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

  function drawShield(ctx, worldToScreen, camera){
    try{
      if (!shieldActive || selectedVehicle !== 'tank') return;
      const nowt = performance.now();
      if (nowt > shieldUntil) return;

      const s = worldToScreen(tank.x, tank.y);
      const shieldRadius = 80 * camera.zoom; // quarter circle shield radius
      const rotationSpeed = 2; // radians per second
      const currentAngle = (nowt / 1000) * rotationSpeed;

      ctx.save();
      ctx.translate(s.x, s.y);
      ctx.rotate(currentAngle);

      // Draw quarter circle shield (90 degrees)
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, shieldRadius, -Math.PI/4, Math.PI/4); // 90 degree arc
      ctx.closePath();

      // Create gradient for shield effect
      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, shieldRadius);
      gradient.addColorStop(0, 'rgba(0, 255, 255, 0.8)');
      gradient.addColorStop(0.7, 'rgba(0, 255, 255, 0.4)');
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0.1)');

      ctx.fillStyle = gradient;
      ctx.fill();

      // Add border
      ctx.strokeStyle = 'rgba(0, 255, 255, 0.9)';
      ctx.lineWidth = Math.max(2, 4 * camera.zoom);
      ctx.stroke();

      ctx.restore();
    }catch(_){ }
  }
  // draw tank dust behind the tank
  if (tankDust.length) drawTankDust(ctx, worldToScreen, camera);
  // draw powerups (under vehicles so they sit on the world)
  if (powerups.length) drawPowerups();
  // draw buildings (world -> screen) so they sit underneath vehicles
  for (const b of buildingInstances){
    // fast cull: skip offscreen buildings
    if (!worldObjectVisible(b.x, b.y, Math.max(32, 64 * (b.scale || 1) * camera.zoom))) continue;
    const bs = worldToScreen(b.x, b.y); const bx = bs.x, by = bs.y; const tile = buildingTiles[b.idx]; ctx.save(); ctx.translate(bx, by); ctx.scale(b.scale * camera.zoom, b.scale * camera.zoom); ctx.translate(-32, -32); ctx.drawImage(tile.c,0,0); ctx.restore();
  }
  // draw billboards (pixel-accurate canvases)
  for (const bb of billboardInstances){
  // If fragments were spawned around a focus (player/bullet/heli), use that focus
  // for culling and drawing so fragments near the player are not skipped.
  let bx, by;
  if (bb._worldFragments && bb._fragFocus){ const fs = worldToScreen(bb._fragFocus.x, bb._fragFocus.y); bx = fs.x; by = fs.y; }
  else { const bs = worldToScreen(bb.x, bb.y); bx = bs.x; by = bs.y; }
  const padFor = Math.max(32, 64 * Math.max(bb.scaleX || 1, bb.scaleY || 1) * camera.zoom);
  if (!worldObjectVisible((bb._fragFocus && bb._fragFocus.x) ? bb._fragFocus.x : bb.x, (bb._fragFocus && bb._fragFocus.y) ? bb._fragFocus.y : bb.y, padFor)) continue;
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
        // stretch to fill the panel
        const aw = ad.width, ah = ad.height;
        const pw = panel.w, ph = panel.h;
        const dw = pw, dh = ph;
        const dx = panel.x, dy = panel.y;
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

  // If the tank is inside the start-safe flower patch, hide the body (so it looks
  // like the tank is hiding in the flowers) but leave the turret exposed.
  let hideTankBase = false;
  try{
    const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
    const safeActive = (typeof startSafeUntil !== 'undefined' && startSafeUntil !== null) && (startSafeUntil === Infinity || nowMs < startSafeUntil);
    if (safeActive && START_SAFE_CENTERS && START_SAFE_CENTERS.length){
      const visualScale = 0.5;
      const effectiveHideRadius = (START_SAFE_RADIUS || 0) * visualScale;
      // determine if tank is inside any patch and track continuous hide time for relocations
      let foundIndex = -1;
      for (let si = 0; si < START_SAFE_CENTERS.length; si++){
        const sc = START_SAFE_CENTERS[si];
        const dx = tank.x - sc.x;
        const dy = wrapDeltaY(tank.y, sc.y);
        if (Math.hypot(dx, dy) <= effectiveHideRadius){ foundIndex = si; hideTankBase = true; break; }
      }
        if (foundIndex >= 0){
          // player is inside a patch -> accumulate hide time
          if (!hideActive){
            hideActive = true; hideLastMs = nowMs;
          }
          // increment accumulator
          if (hideLastMs) { hideAccumMs += Math.max(0, nowMs - hideLastMs); hideLastMs = nowMs; }
          // check threshold using the current patch as excludeIndex
          if (hideAccumMs >= SAFE_RELOCATE_ON_HIDE_MS){
            randomizeOtherSafeCenters(foundIndex);
            hideAccumMs = 0; // reset accumulator after relocation
            hideLastMs = nowMs; // continue timing if player remains inside
          }
        } else {
          // player is outside all patches -> pause accumulator but do not reset
          hideActive = false; hideLastMs = 0;
        }
    }
  }catch(_){ hideTankBase = false; }

  // draw body only when not hidden by flowers
  if (!hideTankBase){
    try{
      // draw body using its native canvas size so 64x64 sprites remain pixel-perfect
      const bodyScale = getCanvasDrawScale(bodyCanvas);
      ctx.save(); ctx.translate(sx, sy + bumpOffsetY); ctx.rotate(tank.bodyAngle + Math.PI/2 + bumpRot); ctx.scale(bodyScale, bodyScale); ctx.translate(-bodyCanvas.width/2, -bodyCanvas.height/2); ctx.imageSmoothingEnabled = false; ctx.drawImage(bodyCanvas, 0, 0); ctx.restore();
    }catch(_){ drawImageCentered(bodyCanvas, sx, sy + bumpOffsetY, tank.bodyAngle + Math.PI/2 + bumpRot, effScale * camera.zoom); }
    // draw Dozer shield on top of body/turret
    try{ drawDozerShield(ctx, worldToScreen, camera); }catch(_){ }
  }
    try{
  const turretScale = getCanvasDrawScale(turretCanvas);
    // apply a per-variant turret artwork offset using an explicit lookup table so
    // each variant's artwork orientation is independent and can't leak between variants.
    let turretArtworkOffset = 0;
    try{
      if (selectedVehicle === 'tank'){
        // explicit per-variant map: key -> artwork rotation to add so turretAngle maps to image
        const VARIANT_TURRET_OFFSETS = {
          // artworks authored pointing up (need +90deg)
          'default': Math.PI/2,
          'bondtank': Math.PI/2,
          'mcds': Math.PI/2,
          // artworks authored pointing right (no offset)
          'german': 0,
          'mexico': 0,
          'china': 0,
          'french': -Math.PI/2,
          // other known variants keep default +90deg mapping for safety
          'murkia': Math.PI/2,
          'dozer': Math.PI/2,
          'fordfiesta': Math.PI/2,
          'waffle': 0,
          'blackstar': Math.PI/2
        };
        turretArtworkOffset = (typeof selectedVehicleVariant === 'string' && selectedVehicleVariant in VARIANT_TURRET_OFFSETS) ? VARIANT_TURRET_OFFSETS[selectedVehicleVariant] : Math.PI/2;
      }
    }catch(_){ turretArtworkOffset = 0; }
  // If Bondtank is active, render animated turret artwork into the turret canvas first
  try{
    if (selectedVehicle === 'tank' && selectedVehicleVariant === 'bondtank' && typeof drawBondTurretInto === 'function'){
      try{ drawBondTurretInto(turretCanvas.getContext('2d'), turretCanvas.width, turretCanvas.height, performance.now()); }catch(_){ }
    }
  }catch(_){ }
  ctx.save(); ctx.translate(sx, sy + bumpOffsetY); ctx.rotate(tank.turretAngle + bumpRot + turretArtworkOffset); ctx.scale(turretScale, turretScale); ctx.translate(-turretCanvas.width/2, -turretCanvas.height/2); ctx.imageSmoothingEnabled = false; ctx.drawImage(turretCanvas, 0, 0); ctx.restore();
  }catch(_){ drawImageCentered(turretCanvas, sx, sy + bumpOffsetY, tank.turretAngle + bumpRot + turretArtworkOffset, effScale * camera.zoom); }

  // Draw shield if active
  try{ drawShield(ctx, worldToScreen, camera); }catch(_){ }
  // Debug visuals: draw pivot and forward muzzle vector for player tank when enabled
  try{
    if (typeof window !== 'undefined' && window.DEBUG_TURRET_VISUALS){
      const pivotX = sx; const pivotY = sy + bumpOffsetY;
      // draw pivot
      ctx.save(); ctx.fillStyle = 'rgba(255,0,0,0.9)'; ctx.beginPath(); ctx.arc(pivotX, pivotY, 3 * Math.max(1, camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore();
      // draw forward muzzle vector (length 24 world px)
      const len = 24 * camera.zoom;
      const ang = tank.turretAngle + turretArtworkOffset;
      const mx = pivotX + Math.cos(ang) * len;
      const my = pivotY + Math.sin(ang) * len;
      ctx.save(); ctx.strokeStyle = 'rgba(0,255,0,0.9)'; ctx.lineWidth = Math.max(1, 2 * camera.zoom); ctx.beginPath(); ctx.moveTo(pivotX, pivotY); ctx.lineTo(mx, my); ctx.stroke(); ctx.restore();
    }
  }catch(_){ }
  // draw a small faded forward arrow on the tank body to indicate forward direction
  try{
  const arrowAlpha = 0.28; // keep subtle
  const arrowLen = 16 * camera.zoom * effScale; // doubled length (was 8)
  const arrowW = Math.max(1, Math.round(6 * camera.zoom)); // doubled width (was 3)
  // forward direction is tank.bodyAngle (use bodyAngle directly so guide arrow aligns for all tanks)
  const forwardAngle = tank.bodyAngle;
    // place the arrow farther ahead of the tank
    const ahead = arrowLen * 1.0;
    const ax = sx + Math.cos(forwardAngle) * ahead;
    const ay = sy + bumpOffsetY + Math.sin(forwardAngle) * ahead;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(forwardAngle);
    ctx.globalAlpha = arrowAlpha;
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, -arrowW);
    ctx.lineTo(arrowLen * 0.5, 0);
    ctx.lineTo(0, arrowW);
    ctx.closePath();
    ctx.fill();
    // thin stem (scaled with arrowLen/arrowW)
  ctx.fillRect(-Math.round(arrowLen*0.22), -Math.round(arrowW*0.45), Math.round(arrowLen*0.38), Math.max(1, Math.round(arrowW*0.9)));
    ctx.restore();
  }catch(_){ }
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
      
      // Apply hopping animation offset
      const hopY = sy + (e.hopOffset || 0) * camera.zoom * 0.4;
      drawImageCenteredFlipped(spr, Math.round(sx), Math.round(hopY), flip, drawScale);
      if (showEntityMarkers){ ctx.save(); ctx.fillStyle='#ff8b6b'; ctx.fillRect(Math.round(sx)-4, Math.round(hopY)-4, 8, 8); ctx.restore(); }
    } else if (e.type === 'critter'){
      const idx = (typeof e.spriteIdx === 'number') ? e.spriteIdx : 0;
      // prefer per-entity tile when available, otherwise use the shared critter sprite
      const spr = (e && e.tileC && e.tileC.width) ? e.tileC : ((typeof critterSprites !== 'undefined') ? critterSprites[idx] : null);
      const flip = (e.vx && e.vx < 0);
      // compute drawScale: base by camera zoom and CRITTER_DRAW_BASE
      const drawScale = camera.zoom * CRITTER_DRAW_BASE;
      // fallback: if sprite missing or invalid, draw a bright marker so the entity remains visible
      if (!spr || !spr.width || !spr.height){ ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), Math.max(6, Math.round(e.r * camera.zoom)), 0, Math.PI*2); ctx.fill(); ctx.restore(); if (showEntityMarkers){ ctx.save(); ctx.fillStyle='#ff8b6b'; ctx.fillRect(Math.round(sx)-4, Math.round(sy)-4, 8, 8); ctx.restore(); } continue; }
      const pad = Math.max(24, Math.round((spr.width * drawScale)/2) + 6);
      if (sx < -pad || sx > W+pad || sy < -pad || sy > H+pad) continue;
      
      // Apply hopping animation offset
      const hopY = sy + (e.hopOffset || 0) * camera.zoom * 0.5;
      drawImageCenteredFlipped(spr, Math.round(sx), Math.round(hopY), flip, drawScale);
      if (showEntityMarkers){ ctx.save(); ctx.fillStyle='#ff8b6b'; ctx.fillRect(Math.round(sx)-4, Math.round(hopY)-4, 8, 8); ctx.restore(); }
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

  // draw allies
  drawAllies();

  // recent-deaths overlay removed

    // finally, update and draw gibs so they appear on top of world sprites and explosions
    updateGibs(dt);
    drawGibs(ctx, worldToScreen, camera);

    requestAnimationFrame(loop);
}
// initialize foliage (bake large offscreen grass canvas and tiles) so drawFoliage can run on first frame
try{ initFoliage(WORLD_W, WORLD_H); }catch(e){ console.warn('initFoliage failed or not available yet', e); }
// Ensure game state is initialized and initial spawns occur on load
try{ restart(); }catch(_){ }
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
