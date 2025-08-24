// --- Canvas + helpers ---
import { initJournal, updateJournal, recordKill, setHealth, setHudRef } from './journal.js';
// Toggle verbose debug logging without removing calls during development
const DEBUG = false;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
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
    try{ const resp = await fetch('assets/manifest.json'); if (resp && resp.ok) manifest = await resp.json(); }catch(_){ manifest = null; }
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

    // fatsammich: if present, remove solid-background color by sampling corner
    if (fImg){
      try{
        const tmp = imageToCanvas(fImg); const tg = tmp.getContext('2d');
        const w = tmp.width, h = tmp.height;
        const data = tg.getImageData(0,0,w,h);
        // sample top-left pixel as the background color (common for pixel assets)
        const br = data.data[0], bg = data.data[1], bb = data.data[2], ba = data.data[3];
        const tolerance = 12; // allow small dithering
        for (let i=0;i<data.data.length;i+=4){ const r=data.data[i], g=data.data[i+1], b=data.data[i+2]; if (Math.abs(r-br)<=tolerance && Math.abs(g-bg)<=tolerance && Math.abs(b-bb)<=tolerance){ data.data[i+3] = 0; } }
        tg.putImageData(data,0,0);
  ASSETS.fatsammich = tmp; // store canvas (drawImage accepts canvas)
  if (DEBUG && console && console.log) console.log('ASSETS: loaded fatsammich (processed transparent bg)');
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
import { triggerTankBump, updateTankBump } from './tank.js';
import { billboardFrames, billboardInstances, initBillboards, startBillboardExplode, updateBillboardBroken, drawBillboardBroken, drawBillboardFragmentsWorld } from './billboard.js';
import { JUNGLE_KINDS, idleMakers as humansIdleMakers, runMakers as humansRunMakers, initHumansAssets } from './humans.js';
import { gibs as moduleGibs, spawnGibs, updateGibs, drawGibs } from './gibs.js';

// wrapper to probe spawnGibs calls (logs caller site then forwards to module)
function callSpawnGibs(x, y, color = '#fff', count = 8, site = ''){
  try{ spawnGibs(x, y, color, count, triggerScreenShake); }catch(e){ try{ console.warn('spawnGibs failed', e); }catch(_){} }
}
import { initFoliage, updateFoliage, drawFoliage } from './foliage.js';

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
    window.addEventListener('game-pointerdown', (ev)=>{ const d = ev.detail; if (d && d.mouse && (d.button === 0)) fireBullet(); });
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
  // expose fallbacks as helpers used elsewhere
  screenToWorld = (mx,my) => screenToWorld_local(mx,my);
  worldToScreen = (wx,wy) => worldToScreen_local(wx,wy);
} else {
  // if module is present, delegate the coordinate helpers
  screenToWorld = (mx,my) => window.__game_modules.input.screenToWorld(mx,my);
  worldToScreen = (wx,wy) => window.__game_modules.input.worldToScreen(wx,wy);
}

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
for (let i=0;i<BUILDING_COUNT;i++){ buildingInstances.push({ x: Math.random()*WORLD_W, y: Math.random()*WORLD_H, idx: Math.floor(Math.random()*buildingTiles.length), scale: 0.7 + Math.random()*0.8, rot: 0 }); }

// Billboards moved to js/billboard.js (makeBillboardFrames, animation frames,
// instances and broken/gibbing code now live in that module)

// Critter & large-animal sprite data moved to `js/critters.js`.
// See: ./js/critters.js

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
// muzzle flashes (short-lived world-space flashes produced when enemies fire)
const muzzleFlashes = []; // {x,y,angle,life}

// screen shake state
const screenShake = { time: 0, duration: 0, magnitude: 0 };

function spawnMuzzleFlash(x, y, angle){ muzzleFlashes.push({ x, y, angle, life: 0.12 + Math.random()*0.06 }); }

function triggerScreenShake(mag = 10, dur = 0.18){ screenShake.time = Math.max(screenShake.time, dur); screenShake.duration = Math.max(screenShake.duration, dur); screenShake.magnitude = Math.max(screenShake.magnitude, mag); }
// expose for other modules that might call it directly
window.triggerScreenShake = triggerScreenShake;

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
const _p_icons = [_p_iconMaw, _p_iconTentacles, _p_iconEyes, _p_iconSigil, _p_iconWorm, _p_iconCore];

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
  // overlay details (icon)
  try{ iconFn(cx, cy, hue, t); } catch (e){}
}

function drawPowerups(){ const nowt = performance.now(); for (const p of powerups){ const ss = worldToScreen(p.x, p.y); const sx = ss.x, sy = ss.y; // draw animated pixel pill into cached canvas
    // draw collect icons or hearts into the powerup canvas when appropriate
    try{
      if ((p.type === 'heal' || p.type === 'journal') && p.journalKey && (p.journalKey.startsWith('collect-'))){
        // draw collect icon
        try{ drawCollectLowResIntoPowerup(_pctx, 32, 32, nowt + (p.phase*60), p.journalKey); }catch(_){ _p_drawSplitPill(32,32,p.hue, nowt + (p.phase*60), _p_icons[p.iconIdx % _p_icons.length]); }
      } else if (p.type === 'heal' || p.type === 'journal'){
        try{ drawHeartLowResIntoPowerup(_pctx, 32, 32, nowt + (p.phase*60), p.heartVariant || 'classic'); }catch(_){ _p_drawSplitPill(32,32,p.hue, nowt + (p.phase*60), _p_icons[p.iconIdx % _p_icons.length]); }
      } else {
        _p_drawSplitPill(32,32,p.hue, nowt + (p.phase*60), _p_icons[p.iconIdx % _p_icons.length]);
      }
    }catch(_){ _p_drawSplitPill(32,32,p.hue, nowt + (p.phase*60), _p_icons[p.iconIdx % _p_icons.length]); }
    // draw with bobbing
    const bob = Math.sin(p.phase*2) * 2 * camera.zoom;
    drawImageCentered(_powerupCanvas, sx, sy + bob, 0, camera.zoom * 0.6);
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
  function drawShadow(x,y, spriteW = SPR_W, spriteScale = SPRITE_SCALE){ if (window.__game_modules && window.__game_modules.draw){ return window.__game_modules.draw.drawShadow(ctx, x, y, spriteW, spriteScale); } ctx.save(); ctx.translate(x,y+6); ctx.scale(1.4,0.6); ctx.beginPath(); ctx.arc(0,0,(spriteW*spriteScale*0.45),0,Math.PI*2); ctx.fillStyle = COLORS.shadow; ctx.fill(); ctx.restore(); }

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
rebuildHeliSprites();

// heli runtime state (instantiate but used only if selected)
const heli = { x: WORLD_W/2, y: WORLD_H/2, bodyAngle: -Math.PI/2, turretAngle: 0, speed: 115, rotSpeed: Math.PI*1.2, rotorSpin:0, tailSpin:0, rpm:22, tailRpm:44 };

// HUD elements (must be available before UI actions)
const hud = document.getElementById('hud');
const center = document.getElementById('center');

// selection
let selectedVehicle = null; // 'tank' or 'heli'
// start with tank selected and hide center UI
selectedVehicle = 'tank';
center.style.display = 'none';
// initialize journal module and populate initial state
try{ initJournal({ hud: hud, maxHealth: MAX_HEALTH, health: health }); }catch(_){ }
function selectVehicle(v){ /* selection disabled at runtime */ }

// --- Game objects: bullets & enemies ---
const bullets = []; // {x,y,dx,dy,life}
const enemies = []; // {x,y,spd,r}
// recent-deaths feature removed: keep a no-op recordDeath so call sites remain valid
function recordDeath(kind, e){ /* removed recent-deaths logging */ }
// wire recordDeath to also update the journal module
// after journal.js is imported, we'll call recordKill inside recordDeath where deaths are recorded
// (recordDeath remains defined above and is used throughout the code)
import { initCritters, critters, animals, spawnCritters, spawnAnimals, updateCritters, drawCritters, updateAnimals, drawAnimals, critterSprites, CRITTER_SPR_SCALE, CRITTER_DRAW_BASE, ANIMAL_DRAW_BASE } from './critters.js';
const __nextCritterId = 1; // unique id placeholder preserved for compatibility
const CRITTER_COUNT = 84; // more critters for jungle life
configureTankAssets({ gibs: moduleGibs });

// debug: throttle enemy-draw logs so we can see if enemies are being processed
let __lastEnemyDrawLog = 0;
// debug: throttle critter-draw logs
let __lastCritterDrawLog = 0;
// debug: visual markers for critters/animals (toggle with G)
let showEntityMarkers = false;
let lastShot = 0; const SHOT_COOLDOWN = 180; const BULLET_SPEED = 360;
let lastSpawn = 0;
let score = 0; let health = 3; let gameOver = false;
let paused = false; // when true, main game updates pause but explosion pieces still animate
const MAX_HEALTH = 5;
// spawn tiny critters
// initialize critters module and spawn populations
initCritters({ WORLD_W, WORLD_H, camera, worldToScreen, drawImageCentered, drawImageCenteredFlipped, drawShadow, callSpawnGibs, triggerTankBump, recordDeath, recordKill, triggerScreenShake, tank, getSelectedVehicle: ()=>selectedVehicle, mod, DEBUG, performance });
spawnCritters();
spawnAnimals();

// initial preview spawns removed: squidrobot
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
  // small chance to call in an osprey that drops combatants
  if (Math.random() < 0.12){ spawnOsprey(x,y); return; }
    // sometimes spawn a small group of jungle NPCs (some standing, some combatants)
    const GROUP_CHANCE = 0.5;
    // hp and speed maps
  const hpMap = { commando:3, scout:2, heavy:4, medic:2, villager1:1, villager2:1, guide:3, radioop:2, squidrobot:2 };
  const spdMap = { commando:45, scout:65, heavy:35, medic:50, villager1:40, villager2:40, guide:55, radioop:40, squidrobot:18 };
    if (Math.random() < GROUP_CHANCE){
      const groupSize = 3 + Math.floor(Math.random()*4); // 3-6
      const combatCount = Math.max(1, Math.round(groupSize * (0.4 + Math.random()*0.3))); // 40-70% combatants
      for (let gi=0; gi<groupSize; gi++){
        const gx = x + (Math.random()-0.5) * 80; const gy = y + (Math.random()-0.5) * 80;
        const kind = JUNGLE_KINDS[Math.floor(Math.random()*JUNGLE_KINDS.length)];
        const { c: tileC, g: tileG } = charTileCanvas();
        const idle = (idleMakers[kind] || (()=>()=>{}))(tileG);
        const run = (runMakers[kind] || (()=>()=>{}))(tileG);
        const isFats = (kind === 'fatsammich');
        const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
  const ent = { x: gx, y: gy, spd: baseSpd, r: 14, type: 'jungle', kind, hp: isFats ? 1 : (hpMap[kind] || 2), tileC, tileG, idle, run, angle: 0, lastAttack: 0, attackCD: 500 + Math.random()*300, dashUntil:0, moving: false, harmless: isFats };
  if (kind === 'squidrobot'){ ent.spd = spdMap.squidrobot; ent.r = 16; ent.turretAngle = 0; ent.attackCD = 1000 + Math.random()*600; }
        // mark some as passive/standing around (non-combatants)
        if (gi >= combatCount){ ent.harmless = true; ent.attackCD = 1e9; ent.spd *= 0.6; }
        enemies.push(ent);
      }
    } else {
      // single spawn (as before)
      const kind = JUNGLE_KINDS[Math.floor(Math.random()*JUNGLE_KINDS.length)];
      const { c: tileC, g: tileG } = charTileCanvas();
      const idleFactory = idleMakers[kind] || (()=>()=>{});
      const runFactory = runMakers[kind] || (()=>()=>{});
      const idle = idleFactory(tileG);
      const run = runFactory(tileG);
      const isFats = (kind === 'fatsammich');
      const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
  const ent = { x, y, spd: baseSpd, r: 14, type: 'jungle', kind, hp: isFats ? 1 : (hpMap[kind] || 2), tileC, tileG, idle, run, angle: 0, lastAttack: 0, attackCD: 500 + Math.random()*300, dashUntil:0, moving: false, harmless: isFats };
  if (kind === 'squidrobot'){ ent.spd = spdMap.squidrobot; ent.r = 16; ent.turretAngle = 0; ent.attackCD = 1000 + Math.random()*600; }
      enemies.push(ent);
    }
  } else if (roll < 0.7) {
  // animal critters (decorative but hostile)
  let spriteIdx = Math.floor(Math.random()*critterSprites.length);
  if (spriteIdx < 0 || spriteIdx >= critterSprites.length) spriteIdx = 0;
  // ensure canvas exists (rebuild if needed)
  if (!critterSprites[spriteIdx] || !critterSprites[spriteIdx].width || !critterSprites[spriteIdx].height){ spriteIdx = 0; }
  // prefer a larger animal tile when available for better journal/icon fidelity
  const largeTile = (window.largeAnimalSprites && window.largeAnimalSprites[spriteIdx]) ? window.largeAnimalSprites[spriteIdx] : (critterSprites[spriteIdx] || null);
  enemies.push({ x, y, spd: 30 + Math.random()*30, r: 10 + Math.random()*4, type: 'animal', hp: 3, spriteIdx, tileC: largeTile, kind: 'animal-' + spriteIdx, angle: 0 });
    } else {
    // fallback: spawn an animal instead of the old red-dot basic enemy
    let spriteIdx = Math.floor(Math.random()*critterSprites.length);
    if (spriteIdx < 0 || spriteIdx >= critterSprites.length) spriteIdx = 0;
  if (!critterSprites[spriteIdx] || !critterSprites[spriteIdx].width || !critterSprites[spriteIdx].height){ spriteIdx = 0; }
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

// critter/animal behavior and drawing are provided by `./critters.js` (imported earlier)

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
    const muzzle = (SPR_W/2)*SPRITE_SCALE + 6;
    sx = tank.x + Math.cos(a)*muzzle;
    sy = tank.y + Math.sin(a)*muzzle;
    tank.turretAngle = a;
  }
  const dx = Math.cos(a)*BULLET_SPEED; const dy = Math.sin(a)*BULLET_SPEED;
  // Shot count behavior (1 = normal, 2 = parallel double, 3 = triple angled streams, 4 = five-stream quad)
  const activeShots = (selectedVehicle === 'tank' && tank.shotCount && now < (tank.powerupUntil || 0)) ? tank.shotCount : 1;
  // helper to produce a coherent palette around a base hue for powered-up streams
  const BASE_HUE = 200; // cyan/blue base for powerup streams
  function colorFor(i, total){ const center = (total-1)/2; const spreadStep = 6; const offset = (i - center) * spreadStep; const h = BASE_HUE + offset; const s = Math.max(60, 92 - Math.abs(i-center)*8); const l = Math.max(44, 60 - Math.abs(i-center)*3); return `hsl(${Math.round(h)} ${s}% ${l}%)`; }

  if (selectedVehicle === 'tank' && activeShots === 2){
    const spread = 6; // world units offset perpendicular to turret
    const ox = Math.cos(a + Math.PI/2) * spread;
    const oy = Math.sin(a + Math.PI/2) * spread;
  bullets.push({ x: sx - ox, y: sy - oy, dx, dy, life: 2.0, color: colorFor(0,2) });
  bullets.push({ x: sx + ox, y: sy + oy, dx, dy, life: 2.0, color: colorFor(1,2) });
  } else if (selectedVehicle === 'tank' && activeShots === 3){
    // central + two angled
  bullets.push({ x: sx, y: sy, dx, dy, life: 2.0, color: colorFor(1,3) });
    const angleSpread = 0.18; // radians (~10 deg)
    const a1 = a - angleSpread; const a2 = a + angleSpread;
  bullets.push({ x: sx + Math.cos(a1)*4, y: sy + Math.sin(a1)*4, dx: Math.cos(a1)*BULLET_SPEED, dy: Math.sin(a1)*BULLET_SPEED, life: 2.0, color: colorFor(0,3) });
  bullets.push({ x: sx + Math.cos(a2)*4, y: sy + Math.sin(a2)*4, dx: Math.cos(a2)*BULLET_SPEED, dy: Math.sin(a2)*BULLET_SPEED, life: 2.0, color: colorFor(2,3) });
  } else if (selectedVehicle === 'tank' && activeShots === 4){
    // five-stream pattern: center + inner pair + outer pair
    const total = 5; bullets.push({ x: sx, y: sy, dx, dy, life: 2.5, color: colorFor(2,total) });
    const innerSpread = 0.12; const outerSpread = 0.28;
    const a_in_l = a - innerSpread, a_in_r = a + innerSpread;
    const a_out_l = a - outerSpread, a_out_r = a + outerSpread;
  bullets.push({ x: sx + Math.cos(a_in_l)*3, y: sy + Math.sin(a_in_l)*3, dx: Math.cos(a_in_l)*BULLET_SPEED, dy: Math.sin(a_in_l)*BULLET_SPEED, life: 2.0, color: colorFor(1,total) });
  bullets.push({ x: sx + Math.cos(a_in_r)*3, y: sy + Math.sin(a_in_r)*3, dx: Math.cos(a_in_r)*BULLET_SPEED, dy: Math.sin(a_in_r)*BULLET_SPEED, life: 2.0, color: colorFor(3,total) });
  bullets.push({ x: sx + Math.cos(a_out_l)*6, y: sy + Math.sin(a_out_l)*6, dx: Math.cos(a_out_l)*BULLET_SPEED, dy: Math.sin(a_out_l)*BULLET_SPEED, life: 2.0, color: colorFor(0,total) });
  bullets.push({ x: sx + Math.cos(a_out_r)*6, y: sy + Math.sin(a_out_r)*6, dx: Math.cos(a_out_r)*BULLET_SPEED, dy: Math.sin(a_out_r)*BULLET_SPEED, life: 2.0, color: colorFor(4,total) });
  } else {
    // default single shot (warm color)
  bullets.push({ x: sx, y: sy, dx, dy, life: 2.0, color: 'hsl(18 95% 58%)' });
  }
  // spawn a muzzle flash at the bullet origin so the tank/heli show firing
  spawnMuzzleFlash(sx, sy, a);
}

// collisions
function collideEnemyBullet(e,b){ const dx = e.x - b.x, dy = e.y - b.y; return Math.hypot(dx,dy) < (e.r + 2); }
function collideEnemyTank(e){ const dx = e.x - tank.x, dy = e.y - tank.y; return Math.hypot(dx,dy) < (e.r + SPR_W*SPRITE_SCALE*0.45); }

// enhanced restart to clear explosion pieces and resume
function restart(){ bullets.length = 0; enemies.length = 0; score = 0; health = 3; gameOver = false; paused = false; selectedVehicle = 'tank'; center.style.display = 'none'; updateHud(); tank.x = WORLD_W/2; tank.y = WORLD_H/2; heli.x = WORLD_W/2; heli.y = WORLD_H/2; tank.alive = true; tankPieces.length = 0; 
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


// stylized HUD: hearts for health and pill-shaped score badge
function updateHud(){
  // score badge
  const scoreHTML = `<span class="score-badge">${score}</span>`;
  // show active powerup indicator (double-shot)
  let puHTML = '';
  if (tank.shotCount && tank.powerupUntil && performance.now() < tank.powerupUntil){ const sec = Math.ceil((tank.powerupUntil - performance.now())/1000); let label = 'Double'; if (tank.shotCount === 3) label = 'Triple'; else if (tank.shotCount === 4) label = 'Quad'; puHTML = ` <span class="powerup">${label} x${sec}s</span>`; }
  // keep HUD minimal; health is shown inside the Journal
  hud.innerHTML = `${scoreHTML}${puHTML}`;
  try{ updateJournal(); }catch(_){ }
}

// --- Main loop (supports tank or heli when selected) ---
let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now-last)/1000); last = now;
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
  // holding shift gives a small speed boost
  const speedBoost = keys.has('shift') ? 1.3 : 1.0;
  if (forward !== 0){
    const prevX = tank.x, prevY = tank.y;
    tank.x += Math.cos(tank.bodyAngle) * tank.speed * speedBoost * forward * dt; tank.y += Math.sin(tank.bodyAngle) * tank.speed * speedBoost * forward * dt;
    // spawn dust when using shift boost and actually moving (throttle by timer)
    if (speedBoost > 1.01){
      tank._dustTimer = (tank._dustTimer || 0) - dt;
      if (tank._dustTimer <= 0){ spawnTankDust(tank.x - Math.cos(tank.bodyAngle)*8, tank.y - Math.sin(tank.bodyAngle)*8, 6); tank._dustTimer = 0.08; }
    }
  }
    tank.x = clamp(tank.x, SPR_W*SPRITE_SCALE*0.5, WORLD_W - SPR_W*SPRITE_SCALE*0.5);
  // allow tank to move freely in world but it will get pushed by the scrolling camera
  tank.y = mod(tank.y, WORLD_H);
  const dx = mouseWorldX - tank.x; const dy = wrapDeltaY(mouseWorldY, tank.y); tank.turretAngle = Math.atan2(dy, dx);
  } else if (selectedVehicle === 'heli'){
    const turn = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0);
    heli.bodyAngle += turn * heli.rotSpeed * dt;
    const forward = (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0);
    if (forward !== 0){ heli.x += Math.cos(heli.bodyAngle) * heli.speed * forward * dt; heli.y += Math.sin(heli.bodyAngle) * heli.speed * forward * dt; }
  // heli also respects shift boost
  const heliBoost = keys.has('shift') ? 1.3 : 1.0;
  if (forward !== 0){ heli.x += Math.cos(heli.bodyAngle) * heli.speed * heliBoost * forward * dt; heli.y += Math.sin(heli.bodyAngle) * heli.speed * heliBoost * forward * dt; }
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
  cameraScrollY -= scrollSpeedScaled * dt;
    cameraScrollY = mod(cameraScrollY, WORLD_H);

  // update bullets (world coords)
  for (let i = bullets.length-1; i >= 0; i--){
  const b = bullets[i];
  b.x += b.dx * dt; b.y += b.dy * dt; b.life -= dt;
  // wrap vertical position
  b.y = mod(b.y, WORLD_H);
  let removed = false;
  // 1) collide with enemies
  for (let ei = enemies.length-1; ei >= 0; ei--) {
    const e = enemies[ei];
    const dy = wrapDeltaY(e.y, b.y); const dx = e.x - b.x;
    const dist = Math.hypot(dx, dy);
  if (dist < (e.r + 2)){
      // hit
      bullets.splice(i,1);
      removed = true;
  if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless>'), e); }catch(_){ } score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 8, 'enemy-hit-harmless'); if (Math.random() < 0.2) spawnPowerup(e.x, e.y, 'double'); }
      else if (e.type === 'jungle' || e.type === 'animal'){
        e.hp = (e.hp||1) - 1;
  if (e.hp <= 0){ enemies.splice(ei,1); score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 12, 'enemy-killed-by-bullet'); if (Math.random() < 0.2) spawnPowerup(e.x, e.y, 'double'); }
  if (e.hp <= 0){ try{ recordDeath(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ } try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ } }
  } else { enemies.splice(ei,1); try{ recordDeath(e.kind || '<default-killed>', e); }catch(_){ } try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<default-killed>'), e); }catch(_){ } score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 10, 'enemy-default-killed'); if (Math.random() < 0.2) spawnPowerup(e.x, e.y, 'double'); }
      break;
    }
  }
  if (removed) continue;
  // 2) collide with critters
  for (let ci = critters.length-1; ci >= 0; ci--){ const c = critters[ci]; if (!c.alive) continue; const dy = wrapDeltaY(c.y, b.y); const dx = c.x - b.x; if (Math.hypot(dx,dy) < 12){ bullets.splice(i,1); removed = true; c.alive = false; callSpawnGibs(c.x, c.y, '#ff8b6b', 10, 'critter-shot'); try{ recordDeath(c.kind || ('critter-' + (c.spriteIdx !== undefined ? c.spriteIdx : '<unknown>')), c); }catch(_){ } try{ recordKill(c.kind || ('critter-' + (c.spriteIdx !== undefined ? c.spriteIdx : '<unknown>')), c); }catch(_){ } score += 1; updateHud(); break; } }
  // track critter kills in recent-death log
  // critter bullet kills are recorded at the kill site to avoid duplicate logs
  if (removed) continue;
  // 3) collide with buildings (axis-aligned box centered at b.x/b.y, size 64*scale)
  for (let bi = 0; bi < buildingInstances.length; bi++){ const B = buildingInstances[bi]; const bx = B.x, by = B.y; const scale = B.scale || 1; const half = 32 * scale; const dy = wrapDeltaY(by, b.y); const dx = bx - b.x; if (Math.abs(dx) <= half && Math.abs(dy) <= half){ bullets.splice(i,1); removed = true; // impact effect
  callSpawnGibs(b.x, b.y, '#ffd1e8', 6, 'building-hit'); break; } }
  if (removed) continue;
  // remove if out of bounds or life expired
  if (b.life <= 0 || b.x < -200 || b.x > WORLD_W+200 || b.y < -200 || b.y > WORLD_H+200) bullets.splice(i,1);
}

    // update enemy bullets
    for (let i = enemyBullets.length-1; i >= 0; i--){ const eb = enemyBullets[i]; eb.x += eb.dx * dt; eb.y += eb.dy * dt; eb.life -= dt; if (eb.life <= 0 || eb.x < -200 || eb.x > WORLD_W+200 || eb.y < -200 || eb.y > WORLD_H+200) { enemyBullets.splice(i,1); continue; }
      // collision with player vehicle
  if (selectedVehicle){ const px = (selectedVehicle === 'heli') ? heli.x : tank.x; const py = (selectedVehicle === 'heli') ? heli.y : tank.y; const dist = Math.hypot(eb.x - px, eb.y - py); if (dist < (eb.hitR || 8)) { enemyBullets.splice(i,1); health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; center.style.display='block'; center.innerHTML = `GAME OVER<br/>Score: ${score}<br/>Press R to restart`; } } } }
    }

    // wrap bullets vertically for endless world
    for (const b of bullets){ b.y = mod(b.y, WORLD_H); }
    for (const eb of enemyBullets){ eb.y = mod(eb.y, WORLD_H); }

  // spawn enemies with dynamic interval
  if (!gameOver && now - lastSpawn > spawnInterval){ lastSpawn = now; spawnEnemy(); }

  // update enemies (they target the selected vehicle; fallback to tank)
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
          if (shoot){ e.lastAttack = now; // use turretAngle if squidrobot to shoot from rotating turret
            const shootA = (e.kind === 'squidrobot') ? (e.turretAngle || ang) : ang;
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
            } else {
              const bx = e.x + Math.cos(shootA)*14, by = e.y + Math.sin(shootA)*14;
              enemyBullets.push({ x: bx, y: by, dx, dy, life: 3.0, hitR }); spawnMuzzleFlash(bx, by, shootA);
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
  // collision distance must consider wrapped vertical difference
  function wrapDist(ax,ay,bx,by){ let dy = ay - by; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = ax - bx; return Math.hypot(dx, dy); }
  const collided = (selectedVehicle === 'heli') ? (wrapDist(e.x,e.y,heli.x,heli.y) < (e.r + H_SPR_W*H_SCALE*0.45)) : (wrapDist(e.x,e.y,tank.x,tank.y) < (e.r + SPR_W*SPRITE_SCALE*0.45));
  if (collided){
      // If the player is the tank, running over things shouldn't damage it.
      // If enemy flagged harmless, remove and score but do not damage player
  if (e.harmless){ if (e.type === 'jungle' || e.type === 'animal') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-harmless'); recordDeath(e.kind || '<collision-harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-harmless>'), e); }catch(_){ } enemies.splice(ei,1); score += 1; updateHud(); }
      else if (selectedVehicle === 'tank'){
  if (e.type === 'jungle' || e.type === 'animal') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-tank');
  recordDeath(e.kind || '<collision-tank>', e);
  try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-tank>'), e); }catch(_){ }
  enemies.splice(ei,1);
  score += 1; updateHud();
  // trigger tank bump when running over enemies
  try{ triggerTankBump(8, 0.18); }catch(_){ }
      } else {
        // other vehicles (heli) still take damage on collision
  if (e.type === 'jungle' || e.type === 'animal') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-heli');
  recordDeath(e.kind || '<collision-heli>', e);
  try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-heli>'), e); }catch(_){ }
    enemies.splice(ei,1);
  health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; center.style.display='block'; center.innerHTML = `GAME OVER<br/>Score: ${score}<br/>Press R to restart`; } }
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
    
  for (let bi = bullets.length-1; bi >= 0; bi--){ const b = bullets[bi];
    // check bullet collision with wrap-aware distance
    let dy = e.y - b.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = e.x - b.x; const dist = Math.hypot(dx, dy);
    if (dist < (e.r + 2)){
        bullets.splice(bi,1);
  if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless-c>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless-c>'), e); }catch(_){ } score += 1; updateHud(); }
        else if (e.type === 'jungle' || e.type === 'animal'){
          e.hp = (e.hp||1) - 1;
          if (e.hp <= 0){ enemies.splice(ei,1); recordDeath(e.kind || '<killed-c>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-c>'), e); }catch(_){ } score += 1; updateHud(); }
        } else {
          enemies.splice(ei,1); recordDeath(e.kind || '<killed-other>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-other>'), e); }catch(_){ } score += 1; updateHud();
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
        bb.hp = (bb.hp||3) - 1;
        // small effect
        spawnMuzzleFlash(bb.x, bb.y, 0);
  if (bb.hp <= 0){ startBillboardExplode(bb, b.x, b.y); }
        break;
      }
    }
  }
  }

  // update powerups and pickup detection (while running)
  if (powerups.length) updatePowerups(dt);
  // pickup: check vehicle proximity to powerups
  for (let pi = powerups.length-1; pi >= 0; pi--){ const p = powerups[pi]; const vx = (selectedVehicle === 'heli') ? heli.x : tank.x; const vy = (selectedVehicle === 'heli') ? heli.y : tank.y; const dy = (selectedVehicle === 'heli') ? (vy - p.y) : wrapDeltaY(vy, p.y); const dx = vx - p.x; if (Math.hypot(dx, dy) < 20){ // picked up
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
  const tankScreenBottom = ts.y + (SPR_H * SPRITE_SCALE * camera.zoom)/2;
  if (tankScreenBottom > H - BOTTOM_MARGIN){
    // compute how much to push in screen space, convert to world delta
    const overlap = tankScreenBottom - (H - BOTTOM_MARGIN);
    const worldDelta = overlap / camera.zoom;
    // push tank upward in world space; but since camera is moving down, pushing upward effectively moves tank with the scroll
    tank.y = mod(tank.y - worldDelta, WORLD_H);
  }
  // also prevent tank from going above the top margin
  const tankScreenTop = ts.y - (SPR_H * SPRITE_SCALE * camera.zoom)/2;
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
  // draw tank dust behind the tank
  if (tankDust.length) drawTankDust(ctx, worldToScreen, camera);
  // draw powerups (under vehicles so they sit on the world)
  if (powerups.length) drawPowerups();
  // draw buildings (world -> screen) so they sit underneath vehicles
  for (const b of buildingInstances){ const bs = worldToScreen(b.x, b.y); const bx = bs.x, by = bs.y; const pad = 64 * b.scale * camera.zoom; if (bx < -pad || bx > W+pad || by < -pad || by > H+pad) continue; const tile = buildingTiles[b.idx]; ctx.save(); ctx.translate(bx, by); ctx.scale(b.scale * camera.zoom, b.scale * camera.zoom); ctx.translate(-32, -32); ctx.drawImage(tile.c,0,0); ctx.restore(); }
  // draw billboards (pixel-accurate canvases)
  for (const bb of billboardInstances){
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
    ctx.drawImage(frame, 0, 0);
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
      drawShadow(sx, sy + Math.max(0, -bumpOffsetY)*0.6, SPR_W * SPRITE_SCALE, SPRITE_SCALE * camera.zoom);
  drawImageCentered(bodyCanvas, sx, sy + bumpOffsetY, tank.bodyAngle + Math.PI/2 + bumpRot, SPRITE_SCALE * camera.zoom);
  drawImageCentered(turretCanvas, sx, sy + bumpOffsetY, tank.turretAngle + bumpRot, SPRITE_SCALE * camera.zoom);
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
    drawShadow(W*0.33, H*0.5); drawImageCentered(bodyCanvas, W*0.33, H*0.5, 0, 1.6); drawImageCentered(turretCanvas, W*0.33, H*0.5, 0, 1.6);
    drawShadow(W*0.66, H*0.5, H_SPR_W, 1.6); drawImageCentered(heliBody, W*0.66, H*0.5, 0, 1.6);
  }

  // draw bullets (player) with per-stream colors
  for (const b of bullets){ const bs = worldToScreen(b.x, b.y); const sx = bs.x, sy = bs.y; if (sx < -10 || sx > W+10 || sy < -10 || sy > H+10) continue;
    const fillCol = b.color || '#ff8b8b';
    let glowCol = b.glow || null;
    if (!glowCol){ if (typeof fillCol === 'string' && fillCol.startsWith('hsl(')) { glowCol = fillCol.replace('hsl(', 'hsla(').replace(')', ',0.95)'); } else { glowCol = 'rgba(255,120,120,0.95)'; } }
    ctx.save(); ctx.shadowBlur = 14 * camera.zoom; ctx.shadowColor = glowCol; ctx.fillStyle = fillCol; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1,3*camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  // draw muzzle flashes (world-space)
  for (const m of muzzleFlashes){ const ms = worldToScreen(m.x, m.y); const sx = ms.x, sy = ms.y; ctx.save(); ctx.translate(sx, sy); ctx.rotate(m.angle); const glow = 18 * camera.zoom; ctx.shadowBlur = glow; ctx.shadowColor = 'rgba(255,220,140,0.95)'; ctx.fillStyle = 'rgba(255,240,180,0.95)'; ctx.beginPath(); ctx.ellipse(0,0, Math.max(2,6*camera.zoom), Math.max(1,3*camera.zoom), 0, 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  // draw enemy bullets (red glow to match impact visuals)
  ctx.fillStyle = '#ff6b6b';
  for (const eb of enemyBullets){ const es = worldToScreen(eb.x, eb.y); const sx = es.x, sy = es.y; if (sx < -10 || sx > W+10 || sy < -10 || sy > H+10) continue; ctx.save(); ctx.shadowBlur = 12 * camera.zoom; ctx.shadowColor = 'rgba(255,100,100,0.95)'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1,3*camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  // draw enemies (per-type)
  for (const e of enemies){
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
  if (e.tileG){ const imgData = e.tileG.getImageData(0,0,e.tileC.width,e.tileC.height).data; let ok=false; for (let k=3;k<imgData.length;k+=4){ if (imgData[k]!==0){ ok=true; break; } } if (!ok){ try{ /* probe removed: no offscreen stamp */ console.warn('Empty tile for kind=', e.kind); }catch(_){ } }
        }
      }catch(_){ }
      const flip = (e.vx && e.vx < 0);
  // diagnostics: if marker mode is enabled, log tile info and provide fallback draw if tile is missing
  if (showEntityMarkers){ try{ console.log('drawEnemy:jungle', { kind: e.kind, tileExists: !!e.tileC, tileW: e.tileC && e.tileC.width, tileH: e.tileC && e.tileC.height, sx: Math.round(sx), sy: Math.round(sy) }); }catch(_){ }
    if (!e.tileC || e.tileC.width <= 0){ // fallback visible marker
  ctx.save(); ctx.fillStyle = '#ff8b6b'; ctx.beginPath(); ctx.arc(Math.round(sx), Math.round(sy), Math.max(8, Math.round(e.r * camera.zoom)), 0, Math.PI*2); ctx.fill(); ctx.restore();
    } else {
      drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE);
    }
    } else {
    drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE);
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
if (e.key.toLowerCase() === 'k'){ // inject test death entry
  try{ const sample = (enemies.length ? enemies[0] : null); recordDeath(sample ? (sample.kind || '<test>') : '<test-death>', sample || { type: 'test' }); }catch(_){ }
}
if (e.key.toLowerCase() === 'g'){ showEntityMarkers = !showEntityMarkers; console.log('showEntityMarkers=', showEntityMarkers); }
});

// initial HUD
updateHud();
