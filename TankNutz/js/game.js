// --- Canvas + helpers ---
import { initJournal, updateJournal, recordKill, setHealth } from './journal.js';
// Ensure dialogue module registers itself on window early so startup can show dialogs
import './dialogue.js';
import { allies, spawnAlly, updateAllies, drawAllies } from './tankAlly.js';
// Toggle verbose debug logging without removing calls during development
const DEBUG = false;
const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
ctx.imageSmoothingEnabled = false;
// Pointer debug overlay disabled: keep a safe placeholder so calls elsewhere
// that check for `window.__pointer_debug_update` don't error but nothing
// is rendered to the page.
window.__pointer_debug_update = null;
// Runtime assets map (may be populated async by loadRuntimeAssets)
const ASSETS = {};
// Continuous firing system (hoisted so event listeners can call stop/start safely)
let isFiring = false; // Track if left mouse button is held down
let fireInterval = null; // Interval for continuous firing
const W = canvas.width, H = canvas.height;
// Minimal color map used by generic draw helpers; specific modules may use their own palettes.
const COLORS = { shadow: 'rgba(0,0,0,0.25)' };
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

// Debug: record who last damaged/killed the player so we can display on-screen
let __lastKilledBy = null; // { kind, id, x, y, time, reason }
function recordKilledBy(info){
  try{
    // Normalize input and attach timestamp
    const base = Object.assign({}, info || {});
    base.time = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

    // Try to synthesize a friendly label and richer attacker info when possible
    try{
      // prefer explicit _src label when available (set on projectile creation)
      if (base._src){
        base.attacker = {
          id: base._src.id || null,
          kind: base._src.kind || base._src.type || null,
          label: base._src.label || null,
          x: base._src.x || null,
          y: base._src.y || null,
          hull: base._src.hull || null
        };
      } else if (base.id || base.kind){ base.attacker = { id: base.id || null, kind: base.kind || null, label: base.label || null, x: base.x || null, y: base.y || null }; }

      // attempt to locate a live entity matching attacker id in common arrays for context (non-critical)
      try{
        const lookupLists = [ (typeof window !== 'undefined' && window.enemies) || null, (typeof window !== 'undefined' && window.critters) || null, (typeof window !== 'undefined' && window.animals) || null ];
        for (const L of lookupLists){ if (!L || !base.attacker) continue; if (base.attacker.id != null){ for (const ent of L){ try{ if (ent && (ent.id === base.attacker.id)){ base.attackerEntity = { kind: ent.kind || ent.type || null, id: ent.id || null, x: ent.x, y: ent.y, hp: ent.hp || null }; throw 'FOUND'; } }catch(_){ } } }
          // fallback: match by proximity if id not available
          if (base.attacker.id == null && base.attacker.x != null && base.attacker.y != null){
            for (const ent of L){ try{ if (!ent || typeof ent.x !== 'number' || typeof ent.y !== 'number') continue; const dx = Math.abs(ent.x - base.attacker.x); const dy = Math.abs(ent.y - base.attacker.y); if (dx < 12 && dy < 12){ base.attackerEntity = { kind: ent.kind || ent.type || null, id: ent.id || null, x: ent.x, y: ent.y, hp: ent.hp || null }; throw 'FOUND'; } }catch(_){ } }
          }
        }
      }catch(_){ }
      // Normalize a human-friendly label we can print quickly
      try{
        const rawLabel = (base.attacker && (base.attacker.label || base.attacker.kind)) || (base.attackerEntity && base.attackerEntity.kind) || null;
        let pretty = null;
        if (rawLabel){
          const r = rawLabel.toString().toLowerCase();
          if (r.indexOf('chained') !== -1 || r.indexOf('chain') !== -1) pretty = 'chain tank';
          else if (r.indexOf('kitty') !== -1 || r.indexOf('kitten') !== -1) pretty = 'kitty tank';
          else if (r.indexOf('kraken') !== -1) pretty = 'kraken';
          else if (r.indexOf('squid') !== -1) pretty = 'squid robot';
          else pretty = rawLabel;
        }
        base.prettyAttacker = pretty;
      }catch(_){ }
    }catch(_){ }

  __lastKilledBy = base;
  try{ if (base.prettyAttacker){ console.info('KilledBy:', base.prettyAttacker, base.attackerEntity ? '(id:'+ (base.attackerEntity.id || 'n/a') +')' : '', '@', base.attacker && base.attacker.x != null ? `(${Math.round(base.attacker.x)},${Math.round(base.attacker.y)})` : '', base); } else { console.info('KilledBy', __lastKilledBy); } }catch(_){ }
  }catch(_){ }
}
// Keep the debug state until manually cleared; provide helper
function clearLastKilledBy(){ try{ __lastKilledBy = null; }catch(_){ } }
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
  updateTankMovementAndAim,
  configureTankAssets
} from './tank.js';
// Kitty helpers are provided by `alternativetanks.js` (imported below)
import * as SFX from '../Sounds/sounds.js';
import { triggerTankBump, updateTankBump } from './tank.js';
import { billboardFrames, billboardInstances, initBillboards, startBillboardExplode, updateBillboardBroken, drawBillboardBroken, drawBillboardFragmentsWorld, BILLBOARD_PANEL } from './billboard.js';
import { JUNGLE_KINDS, idleMakers as humansIdleMakers, runMakers as humansRunMakers, initHumansAssets } from './humans.js';
import { gibs as moduleGibs, spawnGibs, updateGibs, drawGibs } from './gibs.js';
import { spawnChainedTank, spawnKittyTank, attachKittyIfNeeded } from './alternativetanks.js';
import { spawnBossTank } from './bosstank.js';
import { spawnBossTank2 } from './bosstank2.js';
import { spawnHelicopter } from './helicopters.js';
import { initCritters, critters, /* animals (deprecated alias) */ spawnCritters, spawnAnimals, updateCritters, drawCritters, /* updateAnimals, drawAnimals removed - use critters equivalents */ critterSprites, CRITTER_SPR_SCALE, CRITTER_DRAW_BASE, ANIMAL_DRAW_BASE, enemyBullets, startNewWave, checkWaveProgress, completeWave, spawnEnemy, spawnInitialJungleGroup, spawnInitialKraken, spawnInitialSquid, jungleIdleMakers as crittersIdleMakers, jungleRunMakers as crittersRunMakers, initCharactersAssets, waveInProgress, currentWave, MAX_WAVES, waveEnemiesSpawned, waveEnemiesDefeated, waveStartTime, incWaveEnemiesDefeated, resetWaves } from './critters.js';
import { bullets, kittyBullets, casings, muzzleFlashes, spawnMuzzleFlash, updateCasings, updateMuzzleFlashes, wrapProjectilesVertically } from './projectiles.js';
import { initNuke, updateNuke, drawNuke, getViewportWorldRect, debugSpawnRing } from './nuke.js';

// wrapper to probe spawnGibs calls (logs caller site then forwards to module)
function callSpawnGibs(x, y, color = '#fff', count = 8, site = ''){
  try{ spawnGibs(x, y, color, count, triggerScreenShake); }catch(e){ try{ console.warn('spawnGibs failed', e); }catch(_){} }
  try{ playGibSfxSafe(); }catch(_){ }
}

// Also play a small gib SFX when spawnGibs is called (best-effort)
function playGibSfxSafe(){ try{ if (SFX && typeof SFX.playGib === 'function') SFX.playGib(); }catch(_){ } }

// play a gib SFX whenever gibs are spawned via this wrapper
// Do NOT initialize the AudioContext here; many browsers block creating/resuming
// an AudioContext until a user gesture. We'll initialize/resume SFX on first
// user interaction in the attachBgmOnGesture handler below.
// try{ SFX && typeof SFX.playGib === 'function' && SFX.init && SFX.init(); }catch(_){ }
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
// Vehicle sprite modules (extracted drawing helpers)
import {
  drawFordFiestaInto,
  drawBlackstarInto, drawBlackstarBodyInto, drawBlackstarTurretInto,
  drawMurkiaInto, drawMurkiaBodyInto, drawMurkiaTurretInto,
  drawDozerInto,
  drawBondtankInto, drawBondTurretInto,
  drawGermanBodyInto, drawGermanTurretInto,
  drawMexicoBodyInto, drawMexicoTurretInto,
  drawChinaBodyInto, drawChinaTurretInto,
  drawMcdsBodyInto, drawMcdsTurretInto,
  drawWaffleBodyInto, drawWaffleTurretInto,
  drawFacebookBodyInto, drawFacebookTurretInto,
  ensureVehiclePreviewRaf
} from './vehicles/vehicleSprites.js';
// HUD module (extracted): import and delegate HUD responsibilities
import { bindHud, installHudStyles as hudInstallHudStyles, ensureHudInView as hudEnsureHudInView, updateHud as hudUpdateHud, showGameOverModal as hudShowGameOverModal, hideGameOverModal as hudHideGameOverModal, showControlsModal as hudShowControlsModal, hideControlsModal as hudHideControlsModal } from './hud.js';

// --- Vehicle preview animation support (for HUD and Journal previews) ---


// initialize tank module runtime config
initTankPosition(WORLD_W, WORLD_H);
// expose module tank to legacy global scope so old code references same object
try{ if (typeof window !== 'undefined' && window){ if (!window.tank || window.tank !== tank) window.tank = tank; } }catch(_){ }
// expose other globals for tankAlly.js
try{ if (typeof window !== 'undefined' && window){ 
  window.WORLD_W = WORLD_W; 
  window.WORLD_H = WORLD_H; 
  try{ initNuke(); }catch(_){ }
  window.bodyCanvas = bodyCanvas; 
  window.turretCanvas = turretCanvas; 
  window.camera = camera; 
  window.ctx = ctx; 
  window.mod = mod; 
  window.wrapDeltaX = wrapDeltaX; 
  window.wrapDeltaY = wrapDeltaY; 
} }catch(_){ }

// initialize billboards (moved into billboard.js)
initBillboards(WORLD_W, WORLD_H);

// ... tank imports already declared above ...
// prefer input module mouse/keys if present, otherwise use local fallbacks
let keys = (window.__game_modules && window.__game_modules.input) ? window.__game_modules.input.keys : new Set();
let mouse = (window.__game_modules && window.__game_modules.input) ? window.__game_modules.input.mouse : { x: W/2, y: H/2 };
// track whether the module init actually succeeded (so we can reliably install fallbacks)
let inputInitOK = false;
// If an input module exists but we created a new Set, ensure module points to our Set so listeners share it
try{ if (window.__game_modules && window.__game_modules.input){ if (!window.__game_modules.input.keys || window.__game_modules.input.keys !== keys){ window.__game_modules.input.keys = keys; } if (!window.__game_modules.input.mouse || window.__game_modules.input.mouse !== mouse){ window.__game_modules.input.mouse = mouse; } } }catch(_){ }

// --- Input: initialize module if present, otherwise fall back to inline listeners ---
if (window.__game_modules && window.__game_modules.input && typeof window.__game_modules.input.initInput === 'function'){
  try{
    window.__game_modules.input.initInput({ canvas, width: canvas.width, height: canvas.height, worldW: WORLD_W, worldH: WORLD_H });
    inputInitOK = true;
    // also listen for the module's pointer event and forward to existing handler
  window.addEventListener('game-pointerdown', (ev)=>{ const d = ev.detail; try{ window.__pointer_debug_update && window.__pointer_debug_update({ mx: d && d.mouse && d.mouse.x, button: d && d.button, buttons: d && d.buttons, evt: 'module-down', lastFire: _lastManualFire }); }catch(_){ } if (d && d.mouse && (d.button === 0 || (d.buttons && (d.buttons & 1)))) startContinuousFiring(); });
  // ensure camera zoom/clamp initial state matches previous behavior
  camera.zoom = window.__game_modules.input.camera.zoom || camera.zoom;
    camera.x = clamp(camera.x, W/(2*camera.zoom), WORLD_W - W/(2*camera.zoom));
    camera.y = clamp(camera.y, H/(2*camera.zoom), WORLD_H - H/(2*camera.zoom));
  }catch(err){
    console.warn('input.initInput failed, falling back to inline listeners', err);
    // ensure local inputs are available so WASD still works
    try{ keys = new Set(); }catch(_){ }
    try{ mouse = { x: W/2, y: H/2 }; }catch(_){ }
    inputInitOK = false;
    // if input module container exists, ensure it points at our fallback objects so listeners and game loop share the same Set
    try{ if (window.__game_modules && window.__game_modules.input){ window.__game_modules.input.keys = keys; window.__game_modules.input.mouse = mouse; } }catch(_){ }
  }
}
// if module wasn't initialized or its init failed, keep legacy listeners so game remains functional
if (!inputInitOK){
  // mouse move
  try{ console.debug && console.debug('[input] attaching legacy listeners (fallback)'); }catch(_){ }
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
  // pointerdown -> start continuous firing
  canvas.addEventListener('pointerdown', (e)=>{ const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * (canvas.width / r.width); mouse.y = (e.clientY - r.top) * (canvas.height / r.height); if (e.button === 0 || (e.buttons && (e.buttons & 1))) startContinuousFiring(); });
  // One-time gesture to enable audio and start background music (SFX.playBgm)
  (function attachBgmOnGesture(){
    let bgmStarted = false;
    const startBgm = (ev)=>{
      try{
        // Initialize/resume audio on first user gesture
        if (SFX && typeof SFX.init === 'function'){
          try{ SFX.init(); }catch(_){ }
        }
        // Some browsers still require resume, but SFX functions attempt resume internally.
        if (SFX && typeof SFX.playBgm === 'function' && !bgmStarted){
          console.log('Game: Calling SFX.playBgm()');
          try{ 
            SFX.playBgm();
            bgmStarted = true; // Mark as started to avoid repeated calls
          }catch(_){ console.log('Game: SFX.playBgm() threw an error'); }
        }
      }catch(_){ }
      // Keep listening for additional gestures in case autoplay was blocked
      if (!bgmStarted) {
        // If music hasn't started yet, keep trying on subsequent interactions
        setTimeout(() => {
          if (SFX && typeof SFX.playBgm === 'function' && !bgmStarted) {
            try {
              SFX.playBgm();
              bgmStarted = true;
            } catch(_) {}
          }
        }, 100);
      }
    };
  window.addEventListener('pointerdown', startBgm);
  window.addEventListener('touchstart', startBgm, { passive: true });
  window.addEventListener('keydown', startBgm);
  })();
  // expose fallbacks as helpers used elsewhere
  screenToWorld = (mx,my) => screenToWorld_local(mx,my);
  worldToScreen = (wx,wy) => worldToScreen_local(wx,wy);
} else {
  // if module is present, delegate the coordinate helpers
  screenToWorld = (mx,my) => window.__game_modules.input.screenToWorld(mx,my);
  worldToScreen = (wx,wy) => window.__game_modules.input.worldToScreen(wx,wy);
}

// Ensure there is a single canonical world->screen implementation available to all modules.
// This avoids different modules using different transforms when an input module is present.
try{
  window.__CANONICAL_WORLD_TO_SCREEN = function(wx, wy){
    // mirror the local implementation while remaining safe if camera not ready
    try{
      const x = (wx - camera.x) * camera.zoom + W/2;
      let dy = wy - camera.y;
      if (dy > WORLD_H/2) dy -= WORLD_H;
      if (dy < -WORLD_H/2) dy += WORLD_H;
      const y = dy * camera.zoom + H/2;
      return { x, y };
    }catch(_){ return { x: wx - (camera?camera.x:0), y: wy - (camera?camera.y:0) }; }
  };
  // Force global helpers to use the canonical implementation so all draws agree
  window.worldToScreen = window.__CANONICAL_WORLD_TO_SCREEN;
  window.screenToWorld = function(mx, my){
    try{
      const wx = (mx - W/2)/camera.zoom + camera.x;
      let wy = (my - H/2)/camera.zoom + camera.y;
      // normalize vertical wrap
      if (typeof WORLD_H !== 'undefined') wy = ((wy % WORLD_H) + WORLD_H) % WORLD_H;
      return { x: wx, y: wy };
    }catch(_){ return { x: mx + (camera?camera.x:0), y: my + (camera?camera.y:0) }; }
  };
}catch(_){ }

  // Spacebar hold to pause vertical auto-scroll (does not set global paused)
  // Holding spacebar will stop the automatic cameraScrollY advance;
  // releasing it resumes scrolling.
  let spacebarHoldScroll = false;

  // Spacebar scroll pause functionality
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !e.repeat) {
      spacebarHoldScroll = true;
      e.preventDefault(); // Prevent page scroll
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      spacebarHoldScroll = false;
    }
  });
  // Spacebar scroll pause is handled by keyboard events above

  // Efficient context menu blocking for right-clicks on canvas
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    e.stopPropagation();
    return false;
  }, true);

  // Helper function to check if event is on canvas (efficient version)
  function _isEventOnCanvas(e) {
    return e.target === canvas || (canvas.contains && canvas.contains(e.target));
  }

  // Spacebar scroll pause is handled by keyboard events above

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
        if (nowt - _lastManualFire > 20){ _lastManualFire = nowt; startContinuousFiring(); }
        try{ window.__pointer_debug_update && window.__pointer_debug_update({ mx: Math.round(e.clientX), button: e.button, buttons: e.buttons, evt: 'doc-mousedown', lastFire: _lastManualFire }); }catch(_){ }
      }
    }catch(_){ }
  }, true);

  // document-level mouseup to stop continuous firing
  document.addEventListener('mouseup', (e) => {
    try{
      // Stop continuous firing when left mouse button is released
      if (e.button === 0) {
        stopContinuousFiring();
      }
    }catch(_){ }
  }, true);

  // Stop firing when window loses focus (user switches applications)
  window.addEventListener('blur', () => {
    stopContinuousFiring();
  });

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

// Gameplay helper moved back from vehicleSprites: compute draw scale for dynamic sprite canvases
function getCanvasDrawScale(spriteCanvas){
  try{
    const nativeW = (spriteCanvas && spriteCanvas.width) ? spriteCanvas.width : SPR_W;
    const logicalSPR = (spriteCanvas && spriteCanvas._logicalSPR) ? spriteCanvas._logicalSPR : SPR_W;
    const effScale = effectiveTankScale();
    return ((logicalSPR * effScale) / nativeW) * camera.zoom;
  }catch(_){ return effectiveTankScale() * camera.zoom; }
}

// Gameplay helper moved back from vehicleSprites: foliage destruction + respawn + powerup drops
function handleFoliageHit(fiIndex, projX, projY, color = '#8adf76'){
  try{
    const f = foliageInstances[fiIndex];
    if (!f) return;
    try{ callSpawnGibs(projX || f.x, projY || f.y, color, 6, 'foliage-projectile-hit'); }catch(_){ }
    f.hp = (f.hp || 1) - 1;
    if (f.hp <= 0){
      const tile = (typeof foliageTiles !== 'undefined') ? foliageTiles[f.idx] : null;
      if (tile && tile.c){
        try{
          const src = tile.c; const w = Math.min(96, src.width|0), h = Math.min(96, src.height|0);
          const pieces = Math.floor(6 + Math.random()*8);
          for (let p=0; p<pieces; p++){
            const pw = 6 + Math.floor(Math.random()*18); const ph = 6 + Math.floor(Math.random()*18);
            const sx = Math.max(0, Math.floor(Math.random()*(w - pw)));
            const sy = Math.max(0, Math.floor(Math.random()*(h - ph)));
            const worldX = f.x + (sx - w/2) * (f.scale || 1);
            const worldY = f.y + (sy - h/2) * (f.scale || 1);
            try{ moduleGibs.push({ src, sx, sy, sw: pw, sh: ph, x: worldX, y: worldY, vx: (Math.random()-0.5)*220, vy: -80 + Math.random()*220, rot: (Math.random()-0.5)*2, vr: (Math.random()-0.5)*6, life: 1.2 + Math.random()*1.2, gravity: 160, scale: f.scale || 1 }); }
            catch(_){ callSpawnGibs(f.x, f.y, color, 12, 'foliage-frag-fallback'); }
          }
        }catch(_){ callSpawnGibs(f.x, f.y, color, 12, 'foliage-frag-err'); }
      } else { try{ callSpawnGibs(f.x, f.y, color, 12, 'foliage-basic'); }catch(_){ } }
      try{ scheduleRespawn('foliage', f, 5000); }catch(_){ }
      try{ tryDropEnvironmentalPowerup(f.x, f.y, 'foliage'); }catch(_){ }
      foliageInstances.splice(fiIndex,1);
      try{ triggerScreenShake(8, 0.12); }catch(_){ }
    }
  }catch(_){ }
  // Ensure language button retains a working onclick even after foliage events
  try{
    const lb = document.getElementById('tn-lang-btn');
    if (lb){
      lb.onclick = function(){
        try{ if (typeof window.openLangMenu === 'function') { window.openLangMenu(); return; } }catch(_){ }
        try{ if (typeof openLangMenu === 'function') { openLangMenu(); return; } }catch(_){ }
      };
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
import { CHAR_TILE_PX, charTileCanvas, idleMakers as charsIdleMakers, runMakers as charsRunMakers, CHAR_PAL, pxC, ellipseShadowC } from './characters.js';
// characters makers will be merged into the local maps later (after idleMakers/runMakers are declared)

// JUNGLE_KINDS is provided by the humans module import near the top of this file.

const idleMakers = {};
const runMakers = {};
// merge makers provided by humans module (e.g., fatsammich)
Object.assign(idleMakers, humansIdleMakers);
Object.assign(runMakers, humansRunMakers);
// merge the makers from the characters module (moved out of game.js)
Object.assign(idleMakers, charsIdleMakers);
Object.assign(runMakers, charsRunMakers);
// merge the jungle makers from critters module
Object.assign(idleMakers, crittersIdleMakers);
Object.assign(runMakers, crittersRunMakers);
// initialize characters module with runtime assets (ASSETS is defined above)
initCharactersAssets(ASSETS);
// fatsammich makers live in `js/humans.js` and are merged into the local makers map above.

// enemy/kitty projectiles live in projectiles.js
// muzzle flashes (short-lived world-space flashes produced when enemies fire)
// powerups (collectible items that give player bonuses)
const powerups = []; // {x,y,type,hue,heartVariant,iconIdx,journalKey,phase}
// guardian helicopters spawned by heli-guard powerup (non-journaled)
const guardianHelis = []; // {ent,_expireTime}
// MIRV projectile support (guardian helicopter) – replicated per-pixel behavior from MIrv.html
// Structure: { x,y,vx,vy,trail:[],color,phase, targetX,targetY, initDist, life }
const guardianMirvBullets = [];
const GUARDIAN_MIRV_COLORS = ['#ff3d3d','#ff8f3d','#ffcf3d','#ffffff'];
let _guardianMirvNextSalvoId = 1;
const guardianMirvSalvos = new Map(); // salvoId -> { targetX, targetY, spawnTime, spreadDuration }

// Nuke wipe: remove all visible enemies and projectiles within the current viewport.
function __wipeVisibleNow(){
  try{
    for (let i = enemies.length - 1; i >= 0; i--){
      const e = enemies[i]; if (!e) continue;
      if (e.type === 'ally' || e._isMiniAlly) continue;
      if (worldObjectVisible(e.x, e.y, 32)){
        try{ recordDeath(e.kind || e.type || '<nuke>', e); }catch(_){ }
        try{ recordKill(e.kind || e.type || '<nuke>', e); }catch(_){ }
        enemies.splice(i,1);
      }
    }
  }catch(_){ }
  try{ for (let i = bullets.length - 1; i >= 0; i--){ const b = bullets[i]; if (worldObjectVisible(b.x, b.y, 16)) bullets.splice(i,1); } }catch(_){ }
  try{ for (let i = enemyBullets.length - 1; i >= 0; i--){ const eb = enemyBullets[i]; if (worldObjectVisible(eb.x, eb.y, 16)) enemyBullets.splice(i,1); } }catch(_){ }
  try{ for (let i = kittyBullets.length - 1; i >= 0; i--){ const kb = kittyBullets[i]; if (worldObjectVisible(kb.x, kb.y, 16)) kittyBullets.splice(i,1); } }catch(_){ }
  try{ triggerScreenShake(28, 0.6); }catch(_){ }
}

// Configure a spawned helicopter entity as a guardian ally (orbit, fire, rotate)
function configureGuardianHeli(ent, durationMs){
  try{
    const GUARD_MS = durationMs || 300000;
    // Tunable rotation parameters (can expose later to debug panel)
    const ROT_CFG = {
      aimSmoothExp: 0.00008,     // ultra slow aim reposition
      angleSmoothExp: 0.14,       // even heavier angle filtering
      angAccel: 8.5,              // very low angular acceleration
      angDamp: 5.2,               // keep some damping
      maxVelBase: 0.95,           // very slow base turn speed
      maxVelBoost: 0.85,          // modest boost on large deltas
      boostThreshold: Math.PI/1.9, // large delta needed for full boost
      lastEnemyHoldMs: 420,       // extended retention
      targetSwitchBlendMs: 360    // slower blend between targets
    };
    ent.type = 'ally'; ent.kind = 'guardian-heli'; ent._expireTime = performance.now() + GUARD_MS; ent._followOffset = { dx: 100, dy: -160 };
    const baseUpdate = ent.update; const baseDraw = ent.draw;
    ent.update = function(dt){
      try{ if (performance.now() > this._expireTime){ this._remove = true; return; } }catch(_){ }
      try{
        const px = (selectedVehicle === 'heli' && heli) ? heli.x : tank.x;
        const py = (selectedVehicle === 'heli' && heli) ? heli.y : tank.y;
        this._orbitAngle = (this._orbitAngle || 0) + dt * 0.6;
        const R = 160; const ox = Math.cos(this._orbitAngle) * R; const oy = Math.sin(this._orbitAngle) * (R*0.55) - 140;
        const targetX = px + ox; const targetY = py + oy; const f = 0.10; // slightly tighter smoothing
        this.x += (targetX - this.x) * f; this.y += (targetY - this.y) * f;
        // Acquire target for firing
        let fireTarget = null;
        const now = performance.now();
        if ((this._lastShotTime || 0) < now - 650){
          let best=null,bestD=1e9; for (const e of enemies){ if (!e||e.type==='ally') continue; const dx=e.x-this.x; const dy=e.y-this.y; const d=dx*dx+dy*dy; if (d<bestD){ bestD=d; best=e; } }
          if (best){
            fireTarget = best;
            spawnGuardianMirv(this.x, this.y - 20, best.x, best.y, this.bodyAngle);
            // Play shoot sound effect (same as player tank)
            try{ if (typeof SFX !== 'undefined' && typeof SFX.playShoot === 'function') SFX.playShoot(); }catch(_){ }
            spawnMuzzleFlash(this.x, this.y - 20, Math.atan2(best.y - this.y, best.x - this.x));
            this._lastShotTime = now;
            this._lastAimEnemy = best; this._lastAimEnemyTime = now;
          }
        }
        // Retain last enemy briefly for smoother transitions
        if (!fireTarget){
          if (this._lastAimEnemy && now - (this._lastAimEnemyTime||0) < ROT_CFG.lastEnemyHoldMs){
            fireTarget = this._lastAimEnemy;
          } else {
            this._lastAimEnemy = null;
          }
        }
        // Aim point selection
        let aimX, aimY;
        if (fireTarget){ aimX = fireTarget.x; aimY = fireTarget.y; }
        else {
          const tangentA = this._orbitAngle + Math.PI/2;
            aimX = this.x + Math.cos(tangentA)*60; aimY = this.y + Math.sin(tangentA)*60;
        }
        // Blend old/new aim direction on target switch to avoid snap
        if (fireTarget){
          const changed = (this._currentEnemyId && fireTarget !== this._currentEnemyIdObj && fireTarget !== this._blendingFromEnemy);
          if (changed){
            this._blendingFromEnemy = this._currentEnemyIdObj || fireTarget;
            this._blendStartTime = now;
            this._blendFromVec = { x: this._smoothAimX != null ? (this._smoothAimX - this.x) : (aimX - this.x), y: this._smoothAimY != null ? (this._smoothAimY - this.y) : (aimY - this.y) };
          }
          this._currentEnemyIdObj = fireTarget;
        } else if (!fireTarget && this._currentEnemyIdObj){
          // begin blend back to tangent
          this._blendingFromEnemy = this._currentEnemyIdObj;
          this._blendStartTime = now;
          this._blendFromVec = { x: (this._smoothAimX||aimX) - this.x, y: (this._smoothAimY||aimY) - this.y };
          this._currentEnemyIdObj = null;
        }
        if (this._blendStartTime){
          const tNorm = Math.min(1, (now - this._blendStartTime) / ROT_CFG.targetSwitchBlendMs);
          if (tNorm < 1 && this._blendFromVec){
            const toNewVec = { x: aimX - this.x, y: aimY - this.y };
            const wOld = (1 - tNorm);
            const wNew = tNorm;
            const bx = this._blendFromVec.x * wOld + toNewVec.x * wNew;
            const by = this._blendFromVec.y * wOld + toNewVec.y * wNew;
            const mag = Math.hypot(bx, by) || 1;
            aimX = this.x + bx / mag * 60;
            aimY = this.y + by / mag * 60;
          } else {
            // blend finished
            this._blendStartTime = null; this._blendFromVec = null; this._blendingFromEnemy = null;
          }
        }
        // Initialize smoothed aim point
        if (this._smoothAimX == null){ this._smoothAimX = aimX; this._smoothAimY = aimY; }
        const aimSmooth = 1 - Math.pow(ROT_CFG.aimSmoothExp, dt*60);
        this._smoothAimX += (aimX - this._smoothAimX) * aimSmooth;
        this._smoothAimY += (aimY - this._smoothAimY) * aimSmooth;
        // Desired angle (raw) and filtered
        let desired = Math.atan2(this._smoothAimY - this.y, this._smoothAimX - this.x);
        if (this._desiredAngleLP == null) this._desiredAngleLP = desired;
        const angleSmooth = 1 - Math.pow(ROT_CFG.angleSmoothExp, dt*60); // moderate filter
        // shortest angular difference for low-pass
        let daLP = desired - this._desiredAngleLP; if (daLP > Math.PI) daLP -= Math.PI*2; if (daLP < -Math.PI) daLP += Math.PI*2;
        this._desiredAngleLP += daLP * angleSmooth;
        desired = this._desiredAngleLP;
        // Angular dynamics
        if (this._angVel == null) this._angVel = 0;
        const cur = this.bodyAngle || (-Math.PI/2);
        let da = desired - cur; if (da > Math.PI) da -= Math.PI*2; if (da < -Math.PI) da += Math.PI*2;
        // Scale max velocity with magnitude of needed turn (eases into large rotations but slows small corrections)
        let maxVel = ROT_CFG.maxVelBase + ROT_CFG.maxVelBoost * Math.min(1, Math.abs(da) / ROT_CFG.boostThreshold);
        const ANG_ACCEL = ROT_CFG.angAccel;      // base angular acceleration (rad/s^2)
        const ANG_DAMP  = ROT_CFG.angDamp;       // damping coefficient
        // Acceleration toward target angle
        const accel = clamp(da * ANG_ACCEL, -ANG_ACCEL, ANG_ACCEL) - this._angVel * ANG_DAMP;
        this._angVel += accel * dt;
        // Clamp velocity
        if (this._angVel > maxVel) this._angVel = maxVel; else if (this._angVel < -maxVel) this._angVel = -maxVel;
        this.bodyAngle = cur + this._angVel * dt;
      }catch(_){ }
      try{ const prevSpd = this.spdY; this.spdY = 0; baseUpdate.call(this, dt); this.spdY = 0; }catch(_){ }
    };
    ent.draw = function(ctx, worldToScreen, camera){
      try{
        const baseAng = (this.bodyAngle != null) ? this.bodyAngle : -Math.PI/2;
        const SPR = (spawnHelicopter._sprC);
        const now = performance.now(); const elapsed = now - (this._spawnTime || now);
        const fi = Math.floor(elapsed / SPR.FRAME_MS) % SPR.FRAME_COUNT; const img = SPR.frames[fi];
        const s = (camera && camera.zoom) || 1; const ws = worldToScreen(this.x, this.y); const sx = Math.round(ws.x), sy = Math.round(ws.y);
        const drawW = Math.round(SPR.W * 0.5 * s); const drawH = Math.round(SPR.H * 0.5 * s);
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(baseAng + Math.PI/2); ctx.drawImage(img, -drawH/2, -drawW/2, drawH, drawW); ctx.restore();
      }catch(_){ baseDraw && baseDraw.call(this, ctx, worldToScreen, camera); }
    };
  }catch(_){ }
  return ent;
}

function spawnGuardianMirv(x, y, tx, ty, heading){
  try{
  const swarmCount = 4; // reduced rocket count (halved from 8)
    const salvoId = _guardianMirvNextSalvoId++;
  const spreadDuration = 0.55; // shorter spread for reliable regroup
    guardianMirvSalvos.set(salvoId, { targetX: tx, targetY: ty, spawnTime: performance.now()/1000, spreadDuration });
    for (let i=0;i<swarmCount;i++){
      const baseAng = (typeof heading === 'number') ? heading : Math.atan2(ty - y, tx - x);
      // slight angular jitter for spread phase
      const jitter = (Math.random()*0.28 - 0.14);
      const launchAng = baseAng + jitter;
      const launchSpeed = 55 + Math.random()*15; // modest forward impulse
      const b = {
        salvoId,
        x: x + (Math.random()*12 - 6),
        y: y + (Math.random()*6 - 3),
        // forward-oriented initial velocity plus minor perpendicular wobble
        vx: Math.cos(launchAng) * launchSpeed + (Math.random()*14 - 7),
        vy: Math.sin(launchAng) * launchSpeed + (Math.random()*14 - 7),
        trail: [],
        color: GUARDIAN_MIRV_COLORS[Math.floor(Math.random()*GUARDIAN_MIRV_COLORS.length)],
        phase: 'spread',
        life: 3.4,
        _kind: 'guardian-mirv'
      };
      b.trail.push({ x: b.x, y: b.y });
      guardianMirvBullets.push(b);
      if (typeof window !== 'undefined' && window.GUARDIAN_MIRV_DEBUG){ try{ console.log('[MIRV] spawn missile', i, 'salvo', salvoId); }catch(_){ } }
    }
  }catch(_){ }
}

function updateGuardianMirvs(dt){
  const speedLimit = 3.4 * 60; // allow slightly higher terminal velocity inward
  const nowSec = performance.now()/1000;
  // Determine any salvos that should phase switch
  for (const [sid, meta] of guardianMirvSalvos){
    if (!meta) continue;
    if (nowSec - meta.spawnTime >= meta.spreadDuration){ meta._phase = 'converge'; }
  }
  for (let i = guardianMirvBullets.length - 1; i >= 0; i--){
    const b = guardianMirvBullets[i];
    if (!b){ continue; }
    if (typeof b.life !== 'number'){ guardianMirvBullets.splice(i,1); continue; }
    b.life -= dt; if (b.life <= 0){ guardianMirvBullets.splice(i,1); if (!guardianMirvBullets.length) break; continue; }
    const meta = guardianMirvSalvos.get(b.salvoId);
    if (!meta){ guardianMirvBullets.splice(i,1); continue; }
    // push trail
    try{ b.trail.push({ x: b.x, y: b.y }); if (b.trail.length > 10) b.trail.shift(); }catch(_){ }
    if (b.phase === 'spread' && meta._phase === 'converge'){ b.phase = 'converge'; }
    if (b.phase === 'spread'){
      let sepX=0, sepY=0; // simple separation inside salvo only
      for (let j=guardianMirvBullets.length-1; j>=0; j--){ if (i===j) continue; const o=guardianMirvBullets[j]; if (!o || o.salvoId !== b.salvoId) continue; const dx=b.x-o.x; const dy=b.y-o.y; const d=Math.hypot(dx,dy); if (d>0 && d<15){ sepX += dx/d; sepY += dy/d; } }
      b.vx += sepX * 0.05 * 60 * dt; b.vy += sepY * 0.05 * 60 * dt;
    } else { // converge
      const dx = meta.targetX - b.x; const dy = meta.targetY - b.y; const d = Math.hypot(dx, dy) || 1;
      // stronger steering & mild proportional slowdown (d factor) for quick collapse
      const steer = 0.22; // base steering multiplier
      b.vx += (dx/d) * steer * 60 * dt;
      b.vy += (dy/d) * steer * 60 * dt;
      // damping to prevent endless outward drift if overshot early
      b.vx *= (1 - 0.18 * dt);
      b.vy *= (1 - 0.18 * dt);
    }
    // limit speed
    const sp = Math.hypot(b.vx, b.vy); if (sp > speedLimit){ b.vx = (b.vx / sp) * speedLimit; b.vy = (b.vy / sp) * speedLimit; }
    b.x += b.vx * dt; b.y += b.vy * dt;
    // Check group impact
    const dTarget = Math.hypot(meta.targetX - b.x, meta.targetY - b.y);
    if (dTarget < 7){
      try{ callSpawnGibs(meta.targetX, meta.targetY, '#ffcf3d', 14, 'guardian-mirv-salvo'); }catch(_){ }
      // remove all missiles for this salvo safely
      for (let k = guardianMirvBullets.length - 1; k >= 0; k--){ const mk = guardianMirvBullets[k]; if (mk && mk.salvoId === b.salvoId) guardianMirvBullets.splice(k,1); }
      guardianMirvSalvos.delete(b.salvoId);
      if (!guardianMirvBullets.length) break; // nothing more to process
      // restart outer loop index at end since array changed extensively
      i = guardianMirvBullets.length; 
      continue;
    }
  }
  // optional debug average distance
  if (typeof window !== 'undefined' && window.GUARDIAN_MIRV_DEBUG){
    try{
      for (const [sid, meta] of guardianMirvSalvos){
        let sum=0,count=0; for (const m of guardianMirvBullets){ if (m.salvoId===sid){ sum += Math.hypot(meta.targetX - m.x, meta.targetY - m.y); count++; } }
        if (count){ console.log('[MIRV] salvo', sid, 'phase', (meta._phase||'spread'), 'avgDist', (sum/count).toFixed(1)); }
      }
    }catch(_){ }
  }
  // cleanup empty salvos (defensive)
  for (const [sid] of guardianMirvSalvos){ if (!guardianMirvBullets.some(b=>b.salvoId===sid)) guardianMirvSalvos.delete(sid); }
}

function drawGuardianMirvs(ctx, worldToScreen){
  for (const b of guardianMirvBullets){
    try{
      const ws = worldToScreen(b.x, b.y); const sx = ws.x, sy = ws.y;
      // trail (exact gradient style from MIrv.html mapped to world)
      for (let i=0;i<b.trail.length;i++){
        const t = b.trail[i]; const tws = worldToScreen(t.x, t.y); const alpha = i / b.trail.length; ctx.fillStyle = `rgba(255,${Math.floor(100+155*alpha)},${Math.floor(100+155*alpha)},${alpha})`; ctx.fillRect(tws.x|0, tws.y|0, 2, 2);
      }
      ctx.fillStyle = b.color; ctx.fillRect((sx-1)|0,(sy-2)|0,2,4);
      ctx.strokeStyle = '#000'; ctx.strokeRect((sx-1)|0,(sy-2)|0,2,4);
    }catch(_){ }
  }
}
// pet tanks (level 5 weapon upgrade) - now imported from tankAlly.js

// Update powerup animations and states
function updatePowerups(dt) {
  for (const p of powerups) {
    // Update animation phase for all powerups
    if (p.type === 'heal' || p.type === 'journal') {
      // Speed up phase for heal/journal so they pulse more noticeably
      p.phase += 0.02;
    } else {
      // Normal phase update for other powerups
      p.phase += 0.01;
    }
  }
}

// Environmental powerup system
let envPowerupStage = 1; // 1, 2, or 3
let envPowerupCooldown = 0; // timestamp when next powerup can be collected
const ENV_COOLDOWN_DURATION = 60000; // 60 seconds

// Continuous firing system (declarations hoisted earlier)

function startContinuousFiring() {
  if (isFiring || gameOver || !selectedVehicle) return; // Already firing or game over
  isFiring = true;
  
  // Fire immediately
  fireBullet();
  
  // Set up continuous firing every 50ms (much faster than cooldown allows)
  fireInterval = setInterval(() => {
    if (isFiring && !gameOver && selectedVehicle) {
      fireBullet();
    } else {
      // Stop if game ended or vehicle changed
      stopContinuousFiring();
    }
  }, 50);
}

function stopContinuousFiring() {
  isFiring = false;
  if (fireInterval) {
    clearInterval(fireInterval);
    fireInterval = null;
  }
}
// expose enemyBullets to other modules that may push into it (e.g., alternativetanks)
try{ window.enemyBullets = enemyBullets; }catch(err){ console.warn('expose enemyBullets failed', err); }
try{ window.kittyBullets = kittyBullets; }catch(err){ console.warn('expose kittyBullets failed', err); }

// throttled debug logging (enable by setting window.__DEBUG_KITTY = true in the browser)
let __lastKittyDbg = 0;

// screen shake state
const screenShake = { time: 0, duration: 0, magnitude: 0 };

function triggerScreenShake(mag = 10, dur = 0.18){
  // Do not add new shake once game over
  try{ if (gameOver) return; }catch(_){ }
  screenShake.time = Math.max(screenShake.time, dur);
  screenShake.duration = Math.max(screenShake.duration, dur);
  screenShake.magnitude = Math.max(screenShake.magnitude, mag);
}
// expose for other modules that might call it directly
window.triggerScreenShake = triggerScreenShake;

// stop all audio and clear any active screen shake
function stopAllAudioAndShake(){
  try{ if (SFX && typeof SFX.stopAll === 'function') SFX.stopAll(); }catch(_){ }
  try{ screenShake.time = 0; screenShake.duration = 0; screenShake.magnitude = 0; }catch(_){ }
}
try{ window.stopAllAudioAndShake = stopAllAudioAndShake; }catch(_){ }

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

// Consolidated powerup spawn function - replaces all specialized spawn functions
function spawnPowerup(x, y, type, config = {}) {
  const powerup = {
    x: mod(x, WORLD_W),
    y: mod(y, WORLD_H),
    type,
    life: 40.0,
    phase: Math.random() * Math.PI * 2,
    hue: config.hue || Math.floor(Math.random() * 360),
    iconIdx: config.iconIdx || Math.floor(Math.random() * 6),
    ...config // Spread any additional config properties
  };
  powerups.push(powerup);
  return powerup;
}

// NOTE: Removed redundant legacy spawn*Powerup wrappers; call spawnPowerup(x,y,type,config) directly.

// --- Shield System ---
let shieldActive = false;
let shieldUntil = 0;
let shieldCooldownUntil = 0;
const SHIELD_DURATION = 60000; // 60 seconds
const SHIELD_COOLDOWN = 120000; // 2 minutes cooldown

// Environmental powerup drop system with 3 stages and cooldown
function tryDropEnvironmentalPowerup(x, y, sourceType = 'building') {
  const now = performance.now();
  
  // Check if cooldown is active
  if (now < envPowerupCooldown) {
    return false; // Can't drop powerup yet
  }
  
  // Determine drop rates based on stage and source type
  let dropChance = 0;
  if (sourceType === 'building') {
    // Buildings: higher chance
    dropChance = envPowerupStage === 1 ? 0.15 : envPowerupStage === 2 ? 0.20 : 0.25;
  } else if (sourceType === 'foliage') {
    // Foliage: lower chance
    dropChance = envPowerupStage === 1 ? 0.04 : envPowerupStage === 2 ? 0.06 : 0.08;
  }
  
  const rand = Math.random();
  if (rand < dropChance) {
    // Determine powerup type based on stage
    let powerupType = 'double';
    if (envPowerupStage === 2) {
      // Stage 2: Mix of double and mini
      powerupType = rand < dropChance * 0.7 ? 'double' : 'mini';
    } else if (envPowerupStage === 3) {
      // Stage 3: All types including shield and heal
      const typeRand = Math.random();
      if (typeRand < 0.4) powerupType = 'double';
      else if (typeRand < 0.6) powerupType = 'mini';
      else if (typeRand < 0.8) powerupType = 'shield';
      else powerupType = 'heal';
    }
    
    // Spawn the powerup using unified function
    const config = {};
    if (powerupType === 'mini') config.hue = 200;
    else if (powerupType === 'shield') { config.hue = 180; config.iconIdx = 0; }
    else if (powerupType === 'heal') { config.hue = 140; config.heartVariant = 'classic'; }
    
    spawnPowerup(x, y, powerupType, config);
    
    // Set cooldown when powerup is dropped (will be reset when collected)
    envPowerupCooldown = now + ENV_COOLDOWN_DURATION;
    
    return true; // Powerup was dropped
  }
  
  return false; // No powerup dropped
}

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

// Consolidated powerup collection effects
function handlePowerupCollection(vx, vy, powerupType = 'powerup-pickup') {
  try { updateHud(); } catch(_) {}
  envPowerupCooldown = 0; // Reset environmental powerup cooldown
  callSpawnGibs(vx, vy, '#ffd54f', 6, powerupType);
  spawnMuzzleFlash(vx, vy, 0);
}

// Special collection effects for specific powerup types
function handleHealCollection(p, vx, vy) {
  // Heal the player by 1 up to MAX_HEALTH
  try {
    health = Math.min(typeof MAX_HEALTH === 'number' ? MAX_HEALTH : 5, (health || 0) + 1);
  } catch(_) {
    health = (health || 0) + 1;
  }
  try { setHealth && setHealth(health); } catch(_) {}

  // Register journal image/count for slot 1 using the heart graphic
  try {
    const c = document.createElement('canvas');
    c.width = POWERUP_TILE_PX;
    c.height = POWERUP_TILE_PX;
    const cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    try {
      if (p && p.journalKey && p.journalKey.startsWith('collect-')) {
        drawCollectLowResIntoPowerup(cc, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now(), p.journalKey);
      } else {
        drawHeartLowResIntoPowerup(cc, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now(), p.heartVariant || 'classic');
      }
    } catch(_) {}
    try { recordKill && recordKill((p && p.journalKey) ? p.journalKey : 'set 1', { tileC: c, spriteIdx: null }); } catch(_) {}
  } catch(_) {}
}

function handleJournalCollection(p, vx, vy) {
  // Add journal entry for "set 1"; reuse recordKill to register an icon and count
  try {
    const c2 = document.createElement('canvas');
    c2.width = POWERUP_TILE_PX;
    c2.height = POWERUP_TILE_PX;
    const cc2 = c2.getContext('2d');
    cc2.imageSmoothingEnabled = false;
    try {
      if (p && p.journalKey && p.journalKey.startsWith('collect-')) {
        drawCollectLowResIntoPowerup(cc2, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now() + (p.phase*60), p.journalKey);
      } else {
        drawHeartLowResIntoPowerup(cc2, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now() + (p.phase*60), p.heartVariant || 'mend');
      }
    } catch(_) {}
    try { recordKill && recordKill((p && p.journalKey) ? p.journalKey : 'set 1', { tileC: c2, spriteIdx: null }); } catch(_) {}
  } catch(_) {}
}

function handleMiniCollection(vx, vy) {
  // Spawn a mini tank ally next to the player
  try {
    spawnAlly(vx, vy, { type: 'mini' });
  } catch(_) {
    console.warn('Failed to spawn mini tank ally', _);
  }
}

function handleShieldCollection(vx, vy) {
  // Activate shield if not on cooldown
  const nowt = performance.now();
  if (nowt > shieldCooldownUntil) {
    shieldActive = true;
    shieldUntil = nowt + SHIELD_DURATION;
    shieldCooldownUntil = nowt + SHIELD_DURATION + SHIELD_COOLDOWN;
    try { updateHud(); } catch(_) {}
    // Record shield activation in the journal
    try{
      const c = document.createElement('canvas');
      c.width = POWERUP_TILE_PX; c.height = POWERUP_TILE_PX;
      const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
      try{
        if (typeof window !== 'undefined' && typeof window.drawCollectLowResIntoPowerup === 'function'){
          window.drawCollectLowResIntoPowerup(cc, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now(), 'collect-saw');
        } else {
          try{ cc.fillStyle = '#2aa'; cc.fillRect(0,0,POWERUP_TILE_PX,POWERUP_TILE_PX); cc.fillStyle = '#fff'; cc.textAlign='center'; cc.textBaseline='middle'; cc.font='18px sans-serif'; cc.fillText('SH', POWERUP_TILE_PX/2, POWERUP_TILE_PX/2); }catch(_){ }
        }
      }catch(_){ }
      try{ recordKill && recordKill('powerup-shield', { tileC: c, spriteIdx: null }); }catch(_){ }
    }catch(_){ }

    handlePowerupCollection(vx, vy, 'powerup-pickup');
  } else {
    // Shield is on cooldown, show feedback but don't activate
    callSpawnGibs(vx, vy, '#666666', 6, 'powerup-pickup-cooldown');
    envPowerupCooldown = 0; // Reset environmental powerup cooldown even when shield is on cooldown
  }
}

  // helper: 20% chance to drop a heal powerup at billboard location
function spawnBillboardDrop(bb){
  try{
    if (!bb) return;
    const r = Math.random();
    if (r < 0.25) {
      spawnPowerup(bb.x, bb.y, 'heal', { hue: 140, heartVariant: 'classic' });
    } else if (r < 0.35) {
      spawnPowerup(bb.x, bb.y, 'journal', { hue: 280, heartVariant: 'mend', journalKey: 'collect-saw' });
    }
  }catch(_){ }
}

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
      // Draw animated mini tank icon using the shared function
      _pctx.clearRect(0, 0, POWERUP_TILE_PX, POWERUP_TILE_PX);
      drawCollectLowResIntoPowerup(_pctx, 32, 32, nowt + (p.phase*60), 'powerup-mini');
    } else {
      _p_drawTechCard(32, 32, p.hue, nowt + (p.phase * 60));
    }
    // draw with bobbing and special heal effects
  const isHeal = (p.type === 'heal' || p.type === 'journal');
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
    // Handle undefined/null keys
    if (!key) {
      ctx.fillStyle = '#444'; ctx.fillRect(0,0,W,H);
      ctx.fillStyle='#ddd'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle';
      ctx.fillText('UNK', W/2, H/2);
      return;
    }

    // Normalize key to lowercase for case-insensitive comparison
    const normalizedKey = (key || '').toLowerCase();

    if (normalizedKey === 'collect-saw'){
      // Saw Halo: glowing rotating saw (restored rotating saw graphic)
      const palette = ['#2b0707','#601010','#b31a1a','#ff3f3f','#ffe6e6','#ff8080'];
      const ang = (time * TWO * 1.2) % TWO;
      ctx.save(); ctx.translate(W/2, H/2);
      // halo
      ctx.globalAlpha = 0.18; ctx.fillStyle = '#ff8080'; ctx.beginPath(); ctx.ellipse(0,0,Math.min(18, W*0.28), Math.min(12, H*0.18),0,0,TWO); ctx.fill(); ctx.globalAlpha = 1;
      // disc layers
      ctx.fillStyle = '#601010'; ctx.beginPath(); ctx.arc(0,0,Math.min(12, W*0.24),0,TWO); ctx.fill();
      ctx.fillStyle = '#b31a1a'; ctx.beginPath(); ctx.arc(0,0,Math.min(8, W*0.16),0,TWO); ctx.fill();
      ctx.fillStyle = '#ff3f3f'; ctx.beginPath(); ctx.arc(0,0,Math.min(4, W*0.08),0,TWO); ctx.fill();
      // teeth
      const teeth = 10; const radius = Math.min(10, W*0.38);
      for (let i=0;i<teeth;i++){ const a = ang + (i/teeth)*TWO; ctx.save(); ctx.rotate(a); ctx.fillStyle = '#ffe6e6'; ctx.fillRect(radius, -1, Math.max(3, W*0.06), 2); ctx.restore(); }
      ctx.restore();
    } else if (normalizedKey === 'collect-peanut'){
      // Plasma Peanut / Jelly: blobby diamond glow
      const pal = ['#071a09','#103a15','#2a8f3c','#55d96e','#e7ffe7','#95ffae'];
      ctx.save(); ctx.translate(W/2, H/2);
      const wob = 1 + 0.12 * Math.sin(time * TWO * 2.0);
      ctx.scale(wob, 1/wob);
      ctx.globalAlpha = 0.16; ctx.fillStyle = pal[5]; ctx.beginPath(); ctx.moveTo(0,-16); ctx.lineTo(12,0); ctx.lineTo(0,16); ctx.lineTo(-12,0); ctx.closePath(); ctx.fill(); ctx.globalAlpha=1;
      ctx.fillStyle = pal[1]; ctx.beginPath(); ctx.moveTo(0,-14); ctx.lineTo(10,0); ctx.lineTo(0,14); ctx.lineTo(-10,0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = pal[3]; ctx.beginPath(); ctx.moveTo(0,-8); ctx.lineTo(6,0); ctx.lineTo(0,8); ctx.lineTo(-6,0); ctx.closePath(); ctx.fill();
      ctx.restore();
    } else if (normalizedKey === 'collect-crescent'){
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
    } else if (normalizedKey === 'powerup-double'){
      // double-shot icon: two stacked bullets / bars
      ctx.save(); ctx.translate(W/2, H/2);
      const pad = Math.round(Math.min(W,H) * 0.18);
      const bw = Math.round((W - pad*2) * 0.6), bh = Math.round((H - pad*2) * 0.22);
      ctx.fillStyle = '#2b7fdb'; ctx.beginPath(); roundRect(ctx, -bw/2, -bh - 4, bw, bh, 4); ctx.fill();
      ctx.fillStyle = '#1c5fb0'; ctx.beginPath(); roundRect(ctx, -bw/2, 4, bw, bh, 4); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = Math.round(Math.min(W,H)*0.25) + 'px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText('DB', 0, 0);
      ctx.restore();
    } else if (normalizedKey === 'powerup-mini'){
      // mini-tank icon: animated tank with enhanced glow effects
      ctx.save(); ctx.translate(W/2, H/2);
      const s = Math.min(W,H) * 0.35;
      const time = t * 0.001; // Convert to seconds
      
      // Simple pulsing body
      const pulse = 1 + 0.05 * Math.sin(time * TWO * 1.5);
      ctx.scale(pulse, pulse);
      
      // Additional dramatic scaling for larger canvases (game version)
      if (W > 40) { // Game canvases are larger than journal
        const scalePulse = 1 + 0.15 * Math.sin(time * TWO * 0.8); // Slower, more dramatic scaling
        ctx.scale(scalePulse, scalePulse);
      }
      
      // Enhanced glow effect (works on all canvas sizes)
      ctx.globalAlpha = 0.4;
      const glowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.2);
      glowGrad.addColorStop(0, 'rgba(51, 102, 153, 0.6)');
      glowGrad.addColorStop(0.7, 'rgba(51, 102, 153, 0.3)');
      glowGrad.addColorStop(1, 'rgba(51, 102, 153, 0)');
      ctx.fillStyle = glowGrad;
      ctx.beginPath();
      ctx.arc(0, 0, s * 1.2, 0, TWO);
      ctx.fill();
      ctx.globalAlpha = 1;
      
      // Main body
      ctx.fillStyle = '#336699';
      ctx.fillRect(-s/2, -s/4, s, s/2);
      
      // Turret with slow rotation
      const turretAngle = time * TWO * 0.2;
      ctx.save();
      ctx.rotate(turretAngle);
      ctx.fillStyle = '#4a7fb8';
      ctx.fillRect(-s/4, -s/3, s/2, s/3);
      ctx.restore();
      
      // Simple tracks
      ctx.fillStyle = '#2a2a2a';
      ctx.fillRect(-s/1.8, -s/3, s/8, s/1.5);
      ctx.fillRect(s/1.8 - s/8, -s/3, s/8, s/1.5);
      
      // Inner glow for extra effect
      ctx.globalAlpha = 0.3;
      const innerGlow = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.8);
      innerGlow.addColorStop(0, 'rgba(74, 127, 184, 0.4)');
      innerGlow.addColorStop(1, 'rgba(74, 127, 184, 0)');
      ctx.fillStyle = innerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, s * 0.8, 0, TWO);
      ctx.fill();
      ctx.globalAlpha = 1;
      
      ctx.restore();
    } else if (normalizedKey === 'powerup-shield'){
      // shield icon: circular disc with rim
      ctx.save(); ctx.translate(W/2, H/2);
      const r = Math.min(W,H) * 0.36;
      const grad = ctx.createRadialGradient(-r*0.3, -r*0.3, r*0.1, 0,0,r);
      grad.addColorStop(0, '#9be7ff'); grad.addColorStop(0.6, '#2aa'); grad.addColorStop(1, '#0b5670');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0,0,r*0.7,0,Math.PI*2); ctx.stroke();
      ctx.restore();
    } else {
      // fallback: simple pill
      ctx.fillStyle = '#444'; ctx.fillRect(0,0,W,H); ctx.fillStyle='#ddd'; ctx.font='12px sans-serif'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(key || 'COL', W/2, H/2);
    }
  }catch(_){ }
}
// expose the collect drawing helper to other modules
try{ if (typeof window !== 'undefined') window.drawCollectLowResIntoPowerup = drawCollectLowResIntoPowerup; }catch(_){ }

// Debug helper: spawn heli-guard powerup near player (for manual testing)
try{
  if (typeof window !== 'undefined' && !window.spawnHeliGuardPowerup){
    window.spawnHeliGuardPowerup = function(){
      try{
        const px = (window.selectedVehicle === 'heli' && window.heli) ? window.heli.x : (window.tank ? window.tank.x : 0);
        const py = (window.selectedVehicle === 'heli' && window.heli) ? window.heli.y : (window.tank ? window.tank.y : 0);
        spawnPowerup(px + 40, py, 'heli-guard', { hue: 58, iconIdx: 1 });
        console.log('[debug] heli-guard powerup spawned');
      }catch(e){ console.warn('spawnHeliGuardPowerup failed', e); }
    };
  }
}catch(_){ }
rebuildHeliSprites();

// tiny helper to draw rounded rects (used by collect icons)
function roundRect(ctx, x, y, w, h, r){
  const radius = r || 4; ctx.beginPath(); ctx.moveTo(x+radius, y); ctx.lineTo(x+w-radius, y); ctx.quadraticCurveTo(x+w, y, x+w, y+radius); ctx.lineTo(x+w, y+h-radius); ctx.quadraticCurveTo(x+w, y+h, x+w-radius, y+h); ctx.lineTo(x+radius, y+h); ctx.quadraticCurveTo(x, y+h, x, y+h-radius); ctx.lineTo(x, y+radius); ctx.quadraticCurveTo(x, y, x+radius, y); ctx.closePath();
}

// heli runtime state (instantiate but used only if selected)
const heli = { x: WORLD_W/2, y: WORLD_H/2, bodyAngle: -Math.PI/2, turretAngle: 0, speed: 115, rotSpeed: Math.PI*1.2, rotorSpin:0, tailSpin:0, rpm:22, tailRpm:44 };
// Make global
try{ if (typeof window !== 'undefined') window.heli = heli; }catch(_){ }

// HUD elements (must be available before UI actions)
const hud = document.getElementById('hud');
const center = document.getElementById('center');

// selection
let selectedVehicle = null; // 'tank' or 'heli'
let selectedVehicleVariant = 'default'; // 'default' or 'fordfiesta'
// Make globals
try{ if (typeof window !== 'undefined') { window.selectedVehicle = selectedVehicle; window.selectedVehicleVariant = selectedVehicleVariant; } }catch(_){ }
// Function to update globals when vehicle changes
function updateVehicleGlobals() {
  try{ if (typeof window !== 'undefined') { window.selectedVehicle = selectedVehicle; window.selectedVehicleVariant = selectedVehicleVariant; } }catch(_){ }
}
// Debug: record which tank variant was first active when the game started (before any slot change)
let FIRST_SPAWN_TANK_VARIANT = null;
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
try{ if (FIRST_SPAWN_TANK_VARIANT == null) FIRST_SPAWN_TANK_VARIANT = selectedVehicleVariant; }catch(_){ }
// Vehicle menu state: first slot is the default tank (unlocked), others may be locked/placeholders
// Slot mapping: 0=default, 1=Fiesta, 2=Murkia, 3=Dozer, 4=Bondtank
// core vehicle slots; add extra placeholder slots ("emptyX") for future vehicles
// ensure the German art preview is placed into the 6th slot (index 5)
const VEHICLE_SLOTS = ['tank', 'fordfiesta', 'murkia', 'dozer', 'bondtank', 'empty6', 'empty7', 'empty8', 'empty9', 'french', 'facebook', 'waffle', 'blackstar'];
// unlock all slots now so they are clickable for testing
const VEHICLE_UNLOCKED = VEHICLE_SLOTS.map(()=> true);
// Bind HUD module to live state/actions
try{
  bindHud({
    getState: ()=>({
      paused,
      shieldActive,
      shieldUntil,
      shieldCooldownUntil,
      envPowerupStage,
      envPowerupCooldown,
      MAX_HEALTH,
      health,
      score,
      VEHICLE_SLOTS,
      VEHICLE_UNLOCKED,
      selectedVehicle,
      selectedVehicleVariant,
    }),
    actions: {
      togglePause: ()=>{ try{ paused = !paused; }catch(_){ } try{ updateHud(); }catch(_){ } },
      selectVehicleSlot: (idx)=>{ try{ selectVehicleSlot(idx); }catch(_){ } },
      restart: ()=>{ try{ restart(); }catch(_){ } }
    }
  });
}catch(_){ }
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
function installHudStyles(){ return hudInstallHudStyles(); }

// Ensure HUD-related floating elements remain within the visible browser viewport.
function ensureHudInView(){ return hudEnsureHudInView(); }

// --- Game objects: bullets, casings & enemies ---
const enemies = []; // {x,y,spd,r}
// Expose for external tooling and diagnostics: keep a non-owning reference on window so
// headless inspectors and late-loading modules can observe or retrofit existing enemies.
try{ if (typeof window !== 'undefined') { window.enemies = enemies; /* bullets exposed by projectiles.js */ } }catch(_){ }
// allies now imported from tankAlly.js
// recent-deaths feature removed: make recordDeath a no-op so existing call sites remain safe
// Helper: treat 'critter' and 'animal' as a single 'wildlife' category (early definition so it's available to other scripts)
function isWildlife(e){ try{ return !!(e && (e.type === 'critter' || e.type === 'animal')); }catch(_){ return false; } }

function recordDeath(kind, e) { 
  /* removed recent-deaths logging */
  // Track wave progress
  if (waveInProgress && e && (e.type === 'jungle' || isWildlife(e) || e.type === 'osprey')) {
  try{ incWaveEnemiesDefeated(); }catch(_){ }
  }
}
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
// default safe-start center (world coords). Assignable on restart().
let START_SAFE_CENTER_X = Math.round(WORLD_W * 0.5);
let START_SAFE_CENTER_Y = Math.round(WORLD_H * 0.85);
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
// Bridge paused state onto window so external modules (e.g., wave dialogue) can reliably pause/unpause.
try{
  if (typeof window !== 'undefined' && !Object.getOwnPropertyDescriptor(window, 'paused')){
    Object.defineProperty(window, 'paused', {
      configurable: true,
      enumerable: false,
      get(){ return paused; },
      set(v){ paused = !!v; try{ if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ } }
    });
  }
}catch(_){ }
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

// Debug key spawning removed to avoid noisy console logs

// initial preview spawns removed: kitten (kittytank)
// (previously spawned here for quick preview; removed to avoid automatic sample entities)// Spawn an osprey that flies in, drops a small group of combatants, then departs
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
  // Clear pet tanks if weapon powerup has expired (but keep them if at level 5)
  if (selectedVehicle === 'tank' && (!tank.shotCount || now >= (tank.powerupUntil || 0))) {
    // Only clear pet tanks if not at level 5 (pet tank level)
    if (tank.shotCount !== 5) {
      // Remove pet tanks from unified allies array
      for (let i = allies.length - 1; i >= 0; i--) {
        if (allies[i].allyType === 'pet') {
          allies.splice(i, 1);
        }
      }
    }
    // Reset shot count if powerup expired (but keep at 5 for permanent pet tanks)
    if (tank.shotCount !== 5) {
      tank.shotCount = 0;
    }
  }
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
    } else if (selectedVehicle === 'tank' && activeShots === 5){
      // Level 5: Same as quad but with enhanced firepower (pet tank provides additional shots)
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
function restart(){ 
  // Stop any continuous firing
  stopContinuousFiring();
  
  bullets.length = 0; enemies.length = 0; score = 0; health = 3; gameOver = false; paused = false; selectedVehicle = 'tank'; center.style.display = 'none'; updateHud(); tank.x = WORLD_W/2; tank.y = WORLD_H/2; heli.x = WORLD_W/2; heli.y = WORLD_H/2; tank.alive = true; tankPieces.length = 0; 
  casings.length = 0;
  try{ respawnQueue.length = 0; }catch(_){ }
  // Reset critters/animals module state so wildlife does not accumulate across restarts
  try{ initCritters(enemies); }catch(_){ }
  // Reset wave system - variables are now managed by critters module
  startNewWave(); // Start the first wave immediately
  // Spawn one of each jungle enemy (exclude squidrobot which is handled separately)
  try{
    const px = (tank && typeof tank.x === 'number') ? tank.x : WORLD_W/2;
    const py = (tank && typeof tank.y === 'number') ? tank.y : WORLD_H/2;
  try{
    if (typeof spawnOneOfEach === 'function'){
      // Debug switch: preview a kitty instead of a chained-heavy in the initial sample ring
      const ENABLE_KITTY_PREVIEW = false; // default off to avoid duplicate kitties
      if (ENABLE_KITTY_PREVIEW){
        const kittySpawner = (x,y,opts={}) => spawnKittyTank(x, y, opts);
        spawnOneOfEach(enemies, px, py, ['squidrobot'], kittySpawner);
      } else {
        // Normal behavior: preview regular mix (heavy uses chained when spawned via critters path)
        spawnOneOfEach(enemies, px, py, ['squidrobot'], spawnChainedTank);
      }
    } else {
      // Fallback removed: do not spawn a kitty directly at restart; let critters/waves handle enemy spawns
      // spawnKittyTank(px + 120, py, {}, enemies);
    }
  }catch(_){ }
  }catch(_){ }
  // spawn critters and animals for jungle atmosphere
  try{ spawnCritters(enemies); }catch(_){ }
  try{ spawnAnimals(enemies); }catch(_){ }
  // (kittytank visual enforcement removed – kitty variant no longer spawns at restart)
  // remove any accidental entities bunched at the extreme top-left (legacy preview artifacts)
  try{
    for (let i = enemies.length - 1; i >= 0; i--){ const e = enemies[i]; if (!e) continue; try{ if ((e.x == null || e.y == null) || (e.x < 12 && e.y < 12)){ enemies.splice(i,1); } }catch(_){ } }
  }catch(_){ }
  // runtime safety: if many entities remain bunched near the top-left, nudge them outward and log diagnostics
  try{
    if (typeof window !== 'undefined' && !window.__topLeftClusterFixed){
      const clustered = (enemies || []).filter(e=>e && typeof e.x === 'number' && typeof e.y === 'number' && e.x < 48 && e.y < 48);
      if (clustered.length > 3){
        window.__topLeftClusterFixed = true;
        try{ console.warn('Detected top-left cluster of enemies; nudging to safe area', { count: clustered.length, sample: clustered.slice(0,4).map(x=>({kind:x.kind,x:x.x,y:x.y,spawn: x.__spawn_stack? x.__spawn_stack.split('\n')[1].trim() : undefined})) }); }catch(_){ }
        for (const e of clustered){ try{ e.x += 400 + Math.random()*200; e.y += 300 + Math.random()*200; }catch(_){ } }
      }
    }
  }catch(_){ }
  // Fallback: if registration for FIRST_ENEMY_TANK was missed by critters instrumentation,
  // scan the enemies array shortly after restart and record the first non-critter/animal enemy.
  try{
    setTimeout(()=>{
      try{
        if (typeof window === 'undefined') return;
        if (window.FIRST_ENEMY_TANK) return; // already set
        if (!enemies || !Array.isArray(enemies)) return;
        for (let i=0;i<enemies.length;i++){
          const e = enemies[i]; if (!e) continue;
          try{ if (isWildlife(e)) continue; }catch(_){ }
          try{ window.FIRST_ENEMY_TANK = { kind: e.kind || '(unknown)', x: (e.x != null ? e.x : null), y: (e.y != null ? e.y : null), dist: null }; console.debug && console.debug('restart: auto-registered FIRST_ENEMY_TANK', window.FIRST_ENEMY_TANK); }catch(_){ }
          break;
        }
      }catch(_){ }
    }, 120);
  }catch(_){ }
  // expose a short-delayed snapshot of critters/animals for automated tests/diagnostics
  try{
    setTimeout(()=>{
      try{
  // Use the module-level `critters` collection as the single wildlife source.
  const critSample = (typeof critters !== 'undefined' ? critters.slice(0,12) : []);
  // Keep an `animals` field for compatibility (alias of critters)
  const sample = { critters: critSample, animals: Array.from(critSample) };
        try{ window.__critters_diag_spawn = sample; }catch(_){ }
  // Removed DIAG_SNAPSHOT debug log
      }catch(_){ }
    }, 200);
  }catch(_){ }
  // spawn a test double-shot powerup near the tank so it can be picked up immediately
  spawnPowerup(tank.x + 40, tank.y, 'double');
  // For diagnostic: spawn one kitty on the left and one on the right of the player so we
  // can observe which side exhibits issues. Guard against duplicating existing kitties.
  try{
    const ENABLE_KITTY_SIDEBYSIDE = false; // default off to avoid duplicates at start
    if (ENABLE_KITTY_SIDEBYSIDE){
      const _px = (tank && typeof tank.x === 'number') ? tank.x : WORLD_W/2;
      const _py = (tank && typeof tank.y === 'number') ? tank.y : WORLD_H/2;
      const leftX = _px - 140; const rightX = _px + 140;
      const hasLeft = Array.isArray(enemies) && enemies.some(e => e && (e.kind === 'kittytank' || (typeof e.kind === 'string' && e.kind.includes('kitty'))) && Math.abs(e.x - leftX) < 32 && Math.abs(e.y - _py) < 48);
      const hasRight = Array.isArray(enemies) && enemies.some(e => e && (e.kind === 'kittytank' || (typeof e.kind === 'string' && e.kind.includes('kitty'))) && Math.abs(e.x - rightX) < 32 && Math.abs(e.y - _py) < 48);
      if (!hasLeft) try{ spawnKittyTank(leftX, _py, {}, enemies); }catch(_){ }
      if (!hasRight) try{ spawnKittyTank(rightX, _py, {}, enemies); }catch(_){ }
    }
  }catch(_){ }
  // set the static safe-area center to the player's spawn and grant a brief safe window
  try{ START_SAFE_CENTER_X = Math.round(tank.x); START_SAFE_CENTER_Y = Math.round(tank.y); }catch(_){ START_SAFE_CENTER_X = Math.round(WORLD_W * 0.5); START_SAFE_CENTER_Y = Math.round(WORLD_H * 0.85); }
  // Safe area is permanent
  try{ startSafeUntil = Infinity; }catch(_){ startSafeUntil = Infinity; }
  // regenerate the flower patch canvas to match configured radius
  try{ startPatchCanvas = createFlowerPatchCanvas(START_SAFE_RADIUS); }catch(_){ startPatchCanvas = null; }

  // Ensure a kitty tank exists near the player after restart.
  // This is a defensive fallback in case critters' spawnOneOfEach or other
  // instrumentation missed placing a kitty tank at restart.
  // ensureKittyAtStart removed: rely on critters/wave spawners to create enemy kitty tanks

  // One-shot first-run retrofit: after the initial frame(s), ensure kitty visuals are attached.
  // This mitigates rare first-load races where modules load late on the very first run.
  try{
    if (typeof window !== 'undefined' && !window.__KITTY_FIRST_RUN_REPAIR_DONE){
      window.__KITTY_FIRST_RUN_REPAIR_DONE = true;
      const doRepair = () => {
        try{
          if (Array.isArray(enemies)){
            for (const ent of enemies){
              if (ent && ent.kind === 'kittytank'){
                try{ if (typeof window !== 'undefined' && window.__KITTY_DEBUG) console.debug('[kitty-instr] first-run repair: attaching to', ent, 'at', (ent && ('x' in ent)?ent.x:'?'), (ent && ('y' in ent)?ent.y:'?')); }catch(_){ }
                try{ attachKittyIfNeeded(ent); }catch(_){ }
              }
            }
          }
        }catch(_){ }
      };
      try{ requestAnimationFrame(() => doRepair()); }catch(_){ doRepair(); }
      try{ setTimeout(() => { try{ doRepair(); }catch(_){ } }, 250); }catch(_){ }
    }
  }catch(_){ }
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
function updateHud(){ return hudUpdateHud(); }

// Game over modal helpers
function showGameOverModal(sc){ return hudShowGameOverModal(sc); }
function hideGameOverModal(){ return hudHideGameOverModal(); }

// Controls modal
function showControlsModal(){ return hudShowControlsModal(); }
function hideControlsModal(){ return hudHideControlsModal(); }

// --- Main loop (supports tank or heli when selected) ---
let last = performance.now();
function loop(now){
  const dt = Math.min(0.033, (now-last)/1000); last = now;
  // Hard dialogue pause override (ensures nothing moves during narrative sequences)
  try{ if (typeof window !== 'undefined' && window.__dialoguePause){ paused = true; } }catch(_){ }
  // process any scheduled respawns (foliage/buildings)
  try{ processRespawns(now); }catch(_){ }
  // occasionally spawn visible ospreys near the camera
  try{ maybeSpawnPeriodicOsprey(now); }catch(_){ }
  // update tank pieces even when paused so explosion animates
  if (tankPieces.length) updateTankPieces(dt);
  // Nuke system: update regardless of pause so animation can complete; it calls wipeVisible() only on trigger.
  try{
    updateNuke(dt, now, {
      WORLD_W,
      WORLD_H,
      tank,
      camera,
      getViewportWorldRect: (cam, w, h, wh) => getViewportWorldRect(camera, W, H, WORLD_H),
      wipeVisible: () => __wipeVisibleNow()
    });
  }catch(_){ }
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

  // persistent overlay removed; reporting uses console only
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
  // MIGRATION: movement + aim handled in tank.updateTankMovementAndAim (original code kept below in comment)
  try{
  // movement diagnostics removed for normal runs
    if (typeof updateTankMovementAndAim === 'function'){
      let handledMovement = false;
      try{
        // Unthrottled gating diagnostics to catch cases where keys exist but movement is blocked
  // movement gating diagnostics removed
        // If keys are present, snapshot tank state before/after to verify movement application
        if (keys && typeof keys.size === 'number' && keys.size > 0){
          try{
            const before = { x: tank.x, y: tank.y, bodyAngle: tank.bodyAngle };
            updateTankMovementAndAim({ dt, keys, mouseWorldX, mouseWorldY, WORLD_W, WORLD_H, clamp, mod, camera, SFX, _sfxState, spawnTankDust, effectiveTankScale, SPR_W, bodyCanvas, selectedVehicleVariant });
            const after = { x: tank.x, y: tank.y, bodyAngle: tank.bodyAngle };
            // movement diagnostics removed
            handledMovement = true;
          }catch(_){ }
        }
      }catch(_){ }
      // fallback: call movement updater normally if keys empty or diagnostics didn't run
      if (!handledMovement){ try{ updateTankMovementAndAim({ dt, keys, mouseWorldX, mouseWorldY, WORLD_W, WORLD_H, clamp, mod, camera, SFX, _sfxState, spawnTankDust, effectiveTankScale, SPR_W, bodyCanvas, selectedVehicleVariant }); }catch(_){ } }
    }
  }catch(_){ }
  /* ORIGINAL_MOVEMENT_BLOCK
  const turn = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0);
  tank.bodyAngle += turn * tank.rotSpeed * dt;
  const forward = (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0);
  const nowShift = keys.has('shift');
  let speedBoost = nowShift ? 1.3 : 1.0;
  try{ if (nowShift && selectedVehicleVariant === 'fordfiesta'){ speedBoost = 2.8; } }catch(_){ }
  try{ if (nowShift && !_sfxState.shiftActive){ _sfxState.shiftActive = true; if (SFX && typeof SFX.startShift === 'function') SFX.startShift(); } else if (!nowShift && _sfxState.shiftActive){ _sfxState.shiftActive = false; if (SFX && typeof SFX.stopShift === 'function') SFX.stopShift(); } }catch(_){ }
  if (forward !== 0){ tank.x += Math.cos(tank.bodyAngle) * tank.speed * speedBoost * forward * dt; tank.y += Math.sin(tank.bodyAngle) * tank.speed * speedBoost * forward * dt; if (speedBoost > 1.01){ tank._dustTimer = (tank._dustTimer || 0) - dt; if (tank._dustTimer <= 0){ spawnTankDust(tank.x - Math.cos(tank.bodyAngle)*8, tank.y - Math.sin(tank.bodyAngle)*8, 6); tank._dustTimer = 0.08; } } }
  try{ const _spriteW = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W; tank.x = clamp(tank.x, _spriteW*effectiveTankScale()*0.5, WORLD_W - _spriteW*effectiveTankScale()*0.5); }catch(_){ tank.x = clamp(tank.x, SPR_W*effectiveTankScale()*0.5, WORLD_W - SPR_W*effectiveTankScale()*0.5); }
  tank.x = mod(tank.x, WORLD_W); tank.y = mod(tank.y, WORLD_H);
  // Extra safety: explicitly destroy critters/animals that the tank runs over.
  // Some spawn paths may not have them in the main enemies loop at the exact
  // moment of collision; ensure we remove them and trigger the same death flow.
  try{
    const _tankR = (tank && tank.r) ? tank.r : 14;
    const _spriteScaleForHit = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
    function _procRunOver(list){
      if (!Array.isArray(list)) return;
      for (let ii = list.length - 1; ii >= 0; ii--){
        const ent = list[ii];
        if (!ent || !ent.alive) continue;
        let dy = ent.y - tank.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H;
        const dx = ent.x - tank.x;
        const dist = Math.hypot(dx, dy);
        const hitR = (ent.r || 8) + (_spriteScaleForHit * effectiveTankScale() * 0.45);
        if (dist < hitR){
          try{ callSpawnGibs(ent.x, ent.y, '#ff8b6b', 14, 'tank-runover'); }catch(_){ }
          try{ recordDeath(ent.kind || '<tank-runover>', ent); }catch(_){ }
          try{ recordKill(ent.kind || (typeof ent.spriteIdx === 'number' ? ('animal-' + ent.spriteIdx) : '<tank-runover>'), ent); }catch(_){ }
          try{ ent.alive = false; }catch(_){ }
          try{ const idx = enemies.indexOf(ent); if (idx >= 0) enemies.splice(idx, 1); }catch(_){ }
          try{ list.splice(ii, 1); }catch(_){ }
          try{ doEnemyHeartDrops(ent, ent.x, ent.y); }catch(_){ }
          try{ score += 1; updateHud(); }catch(_){ }
        }
      }
    }
  // animals are unified into critters; process critters only to avoid double-work
  try{ _procRunOver(critters); }catch(_){ }
  }catch(_){ }
  */
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
              
              // Drop powerups from destroyed buildings using staged system
              tryDropEnvironmentalPowerup(B.x, B.y, 'building');
              
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
heli.x = mod(heli.x, WORLD_W);
heli.y = mod(heli.y, WORLD_H);
const dx = mouseWorldX - heli.x, dy = mouseWorldY - heli.y; heli.turretAngle = Math.atan2(dy, dx);
    // rotor spin
    const rpmBoost = 3 * Math.abs((keys.has('w')?1:0) - (keys.has('s')?1:0));
    heli.rotorSpin += (heli.rpm + rpmBoost) * dt; heli.tailSpin += (heli.tailRpm + rpmBoost*2) * dt;
  }

    // shooting (space) always allowed if selected
    // if (selectedVehicle && keys.has(' ')){ fireBullet(); }

  // difficulty scaling: reduce spawn interval over time and with score
  const elapsed = now; // ms
  const difficultyFactor = Math.min(1, elapsed * DIFFICULTY_ACCEL + Math.max(0, score * 0.002));
  // During waves, spawn faster (reduce interval by wave number factor)
  const waveSpeedFactor = waveInProgress ? Math.max(0.3, 1 - (currentWave - 1) * 0.1) : 1;
  const spawnInterval = Math.max(SPAWN_INTERVAL_MIN, SPAWN_INTERVAL_BASE * (1 - difficultyFactor) * waveSpeedFactor);

  // advance vertical camera scroll (reversed direction) and make scroll speed increase slowly with difficulty
  const scrollSpeedScaled = SCROLL_SPEED * (1 + difficultyFactor * 0.35);
  if (!spacebarHoldScroll){
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
  // Boss tanks: only decrement hp; ignore generic kill flows for bosses
  if (e.kind === 'bosstank' || e.kind === 'bosstank2'){
    if (typeof e.hp === 'number'){
      // If boss2 is in a phase-break window, ignore damage
      if (e.kind === 'bosstank2' && e._phaseBreakUntil && Date.now() < e._phaseBreakUntil){ /* invulnerable briefly */ }
      else {
        e.hp -= 1;
        // Phase break for bosstank2 at 25 HP
        if (e.kind === 'bosstank2' && e._phase !== 2 && e.hp <= 25){
          try{ e._phase = 2; e._phaseTriggered = true; }catch(_){ }
          try{ // spawn a bunch of gibs/parts and play an effect
            callSpawnGibs(e.x, e.y, '#ff8b6b', 40, 'bosstank2-phasebreak');
          }catch(_){ }
          try{ // set a short invulnerability window to avoid instant follow-up kills
            e._phaseBreakUntil = Date.now() + 600;
          }catch(_){ }
          // optionally boost aggressiveness is handled inside the boss update via _phase
        }
        if (e.hp <= 0){
          try{ recordDeath(e.kind, e); }catch(_){ }
          try{ recordKill(e.kind, e); }catch(_){ }
          enemies.splice(ei,1); try{ callSpawnGibs(e.x, e.y, '#ff3030', 24, (e.kind || 'bosstank') + '-destroy'); }catch(_){ }
          score += 5; updateHud();
        }
      }
    }
  } else if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless>'), e); }catch(_){ } score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 8, 'enemy-hit-harmless'); try{ enemyDropChance(e,e.x,e.y); }catch(_){ } }
  else if (isWildlife(e) || e.type === 'jungle'){
    e.hp = (e.hp||1) - 1;
    if (e.hp <= 0){ try{ recordDeath(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ } try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed>'), e); }catch(_){ }
      try{ if (isWildlife(e)) e.alive = false; }catch(_){ }
      enemies.splice(ei,1); score += 1; updateHud(); callSpawnGibs(e.x, e.y, '#ff8b6b', 12, 'enemy-killed-by-bullet'); try{ enemyDropChance(e,e.x,e.y); }catch(_){ }
    }
  } else {
          // osprey: spawn logical osprey gibs
          if (e.type === 'osprey'){
            try{ recordDeath(e.kind || '<osprey-killed>', e); }catch(_){}
            try{ recordKill(e.kind || '<osprey-killed>', e); }catch(_){}
            enemies.splice(ei,1);
            try{ enemyDropChance(e,e.x,e.y); }catch(_){ }
            score += 1; updateHud();
            try{ spawnOspreyGibs(e.x, e.y, e); }catch(_){ callSpawnGibs(e.x, e.y, '#b0c7cf', 18, 'osprey-fallback'); }
            // Always drop the journal powerup on osprey death to make it reliable
            try{ spawnPowerup(e.x, e.y, 'journal', { hue: 280, heartVariant: 'mend', journalKey: 'collect-peanut' }); }catch(_){ }
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
  
  // Drop powerups from destroyed buildings using staged system
  tryDropEnvironmentalPowerup(B.x, B.y, 'building');
  
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
          // If this bullet was fired by an ally and is marked to ignore the player, consume it visually but do not apply damage.
          if (eb && eb._ignorePlayer) {
            enemyBullets.splice(i,1);
            try{ callSpawnGibs(eb.x, eb.y, '#fff', 4, 'projectile-ignored-player'); }catch(_){ }
            // continue to next bullet without damaging the player
          } else {
            enemyBullets.splice(i,1);
            try{ const col = (eb && (eb.color || eb.style === 'guardian-bolt')) ? (eb.color || '#66e0ff') : '#ffd1e8'; callSpawnGibs(eb.x, eb.y, col, 6, 'projectile-hit'); }catch(_){ }
                if (!inStartSafe) {
              // Check if shield is active
              const nowt = performance.now();
              if (shieldActive && nowt < shieldUntil){
                // Shield absorbs the bullet - visual feedback only
                try{ callSpawnGibs(eb.x, eb.y, '#00ffff', 8, 'shield-absorb'); }catch(_){ }
                } else {
                // Normal damage
                // record attacker info: enemy bullet source if present
                try{ if (eb && eb._src){ recordKilledBy({ kind: eb._src.kind || eb._src.type || 'enemy', id: eb._src.id || null, x: eb._src.x, y: eb._src.y, reason: 'enemyBullet' }); } else { recordKilledBy({ kind: 'enemyBullet', id: null, x: eb.x, y: eb.y, reason: 'enemyBullet' }); } }catch(_){ }
                health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ try{ recordKilledBy({ kind: (eb && eb._src && (eb._src.kind || eb._src.type)) || 'enemyBullet', id: (eb && eb._src && eb._src.id) || null, x: (eb&&eb.x)||null, y:(eb&&eb.y)||null, reason: 'death-by-bullet' }); }catch(_){ } if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } }
              }
            } else {
              // visual feedback: small spark but no damage
              try{ callSpawnGibs(eb.x, eb.y, '#fff', 4, 'projectile-absorbed-safe'); }catch(_){ }
            }
          }
        }
      }

      // collision with allies
      let handled = false;
      for (let ai = allies.length - 1; ai >= 0; ai--) {
        const ally = allies[ai];
        // If this projectile was fired by an ally, skip ally collisions so allies don't hit each other
        if (eb && eb._fromAlly) continue;
        const dist = Math.hypot(eb.x - ally.x, eb.y - ally.y);
        if (dist < ((eb.hitR || 8) + ally.r)) {
          // Consume projectile but do not damage allies marked invulnerableToProjectiles
          enemyBullets.splice(i, 1);
          try { const col = (eb && (eb.color || eb.style === 'guardian-bolt')) ? (eb.color || '#66e0ff') : '#ffd1e8'; callSpawnGibs(eb.x, eb.y, col, 6, 'projectile-hit-ally'); } catch (_) { }
          if (!ally.invulnerableToProjectiles) {
            ally.hp -= 1;
            if (ally.hp <= 0) {
              // Ally destroyed
              try { callSpawnGibs(ally.x, ally.y, '#ff6b6b', 12, 'ally-destroyed'); } catch (_) { }
              allies.splice(ai, 1);
            }
          } else {
            // visual feedback only for invulnerable allies
            try { callSpawnGibs(ally.x, ally.y, '#fff', 4, 'projectile-absorbed-ally'); } catch (_) { }
          }
          handled = true;
          break;
        }
      }

      // Enemy bullets: deflect off animals, buildings, and trees; smaller foliage still takes damage
  try{

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
          // If this enemy-bullet was fired by an ally, apply damage to the animal
          // instead of reflecting it. Otherwise keep original deflect behavior.
          if (eb && eb._fromAlly){
            try{ enemyBullets.splice(i,1); }catch(_){ }
            try{ const col = (eb && (eb.color || eb.style === 'guardian-bolt')) ? (eb.color || '#66e0ff') : '#ffd1e8'; callSpawnGibs(eb.x, eb.y, col, 6, 'projectile-hit-ally-animal'); }catch(_){ }
            // apply damage to the obstacle (animal/critter)
            en.hp = (en.hp || 1) - 1;
            if (en.hp <= 0){
              try{ recordDeath(en.kind || (typeof en.spriteIdx === 'number' ? ('animal-' + en.spriteIdx) : '<killed>'), en); }catch(_){ }
              try{ recordKill(en.kind || (typeof en.spriteIdx === 'number' ? ('animal-' + en.spriteIdx) : '<killed>'), en); }catch(_){ }
              // ensure critter/animal modules remove instances too
              try{ if (isWildlife(en)) en.alive = false; }catch(_){ }
              try{ enemies.splice(ei,1); }catch(_){ }
              try{ score += 1; updateHud(); callSpawnGibs(en.x, en.y, '#ff8b6b', 12, 'enemy-killed-by-ally'); }catch(_){ }
              try{ enemyDropChance(en,en.x,en.y); }catch(_){ }
            }
            handled = true; break;
          } else {
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

  // update kittytank-specific bullets separately so they can use unique animation and not affect other projectiles
  for (let i = kittyBullets.length-1; i >= 0; i--){ const kb = kittyBullets[i];
      // instrumentation: initialize trace buffer (ring) once
      try{
        if (typeof window !== 'undefined' && !window.__kittyBulletTrace){
          window.__kittyBulletTrace = []; // entries: {t,i,x,y,dx,dy,spd,a,moved,dt}
        }
      }catch(_){ }
      // ensure dt is defined and non-zero
      const _dt = (typeof dt === 'number' && dt > 0) ? dt : 1/60;
  // track last position for movement diagnostics
  if (window.__DEBUG_KITTY){ if (typeof kb._lx !== 'number'){ kb._lx = kb.x; kb._ly = kb.y; } }
  // (stall detection moved below after we advance position)
      // Accept either dx/dy or older vx/vy names. If only vx/vy exist, copy them.
      try{
        if ((typeof kb.dx !== 'number' || typeof kb.dy !== 'number') && typeof kb.vx === 'number' && typeof kb.vy === 'number'){
          kb.dx = kb.vx; kb.dy = kb.vy;
        }
      }catch(_){ }
      // If dx/dy are absent or near-zero, try to recompute from stored angle and speed or infer from existing fields
      if ((typeof kb.dx !== 'number' || typeof kb.dy !== 'number') || (Math.abs(kb.dx) < 1e-6 && Math.abs(kb.dy) < 1e-6)){
        // If spd/a missing but dx/dy present, populate them
        try{
          if ((typeof kb.spd !== 'number' || typeof kb.a !== 'number') && typeof kb.dx === 'number' && typeof kb.dy === 'number'){
            kb.spd = Math.hypot(kb.dx, kb.dy);
            kb.a = Math.atan2(kb.dy, kb.dx);
          }
        }catch(_){ }
        if ((typeof kb.a === 'number') && (typeof kb.spd === 'number')){
          kb.dx = Math.cos(kb.a) * kb.spd;
          kb.dy = Math.sin(kb.a) * kb.spd;
        }
      }
      // final freeze guard: if still effectively stationary but has an angle, kick velocity so projectile doesn't appear frozen
      if ((Math.abs(kb.dx || 0) + Math.abs(kb.dy || 0)) < 1e-4 && typeof kb.a === 'number'){
        const boost = (typeof kb.spd === 'number' && kb.spd > 5) ? kb.spd : 160;
        kb.dx = Math.cos(kb.a) * boost;
        kb.dy = Math.sin(kb.a) * boost;
      }
      // debug logging (throttled) — enable by setting window.__DEBUG_KITTEN = true in the browser console
      try{
        if (typeof window !== 'undefined' && window.__DEBUG_KITTY){
          const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            if (nowMs - (__lastKittyDbg || 0) > 200){
              __lastKittyDbg = nowMs;
              try{ console.log('kittyBullets.debug', { idx: i, x: kb.x.toFixed(2), y: kb.y.toFixed(2), dx: kb.dx.toFixed(3), dy: kb.dy.toFixed(3), spd: kb.spd, a: kb.a, moved: Math.hypot(kb.x - kb._lx, kb.y - kb._ly).toFixed(3) }); }catch(_){ }
              kb._lx = kb.x; kb._ly = kb.y;
          }
        }
      }catch(_){ }
  const _preX = kb.x, _preY = kb.y;
  kb.x += kb.dx * _dt; kb.y += kb.dy * _dt; kb.life -= _dt; if (kb.life <= 0 || kb.x < -200 || kb.x > WORLD_W+200 || kb.y < -200 || kb.y > WORLD_H+200) { kittyBullets.splice(i,1); continue; }
  try{ kb._lastUpdateT = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }catch(_){ }
      // --- Stall detection AFTER movement: if displacement extremely small, force velocity repair.
      try{
        const moved = Math.hypot(kb.x - _preX, kb.y - _preY);
        // record trace for first few bullets only (limit spam)
        try{
          if (typeof window !== 'undefined' && i < 4){
            const trace = window.__kittyBulletTrace;
            if (trace){
              trace.push({ t: (performance.now ? performance.now(): Date.now()), i, x: +kb.x.toFixed(2), y: +kb.y.toFixed(2), dx: +kb.dx.toFixed(2), dy: +kb.dy.toFixed(2), spd: +((kb.spd)||0).toFixed(2), a: +(kb.a||0).toFixed(3), moved: +moved.toFixed(3), dt: +_dt.toFixed(4) });
              if (trace.length > 240) trace.splice(0, trace.length - 240); // keep last ~240 samples (~4s at 60fps)
            }
          }
        }catch(_){ }
        if (typeof kb._stallFrames !== 'number') kb._stallFrames = 0;
        if (moved < 0.1){ kb._stallFrames++; } else { kb._stallFrames = 0; }
        if (kb._stallFrames > 2){
          let a = (typeof kb.a === 'number') ? kb.a : null;
          if (a === null || !isFinite(a)){
            try{ const px = (selectedVehicle === 'heli') ? heli.x : tank.x; const py = (selectedVehicle === 'heli') ? heli.y : tank.y; a = Math.atan2(py - kb.y, px - kb.x); }catch(_){ a = Math.random()*Math.PI*2; }
            kb.a = a;
          }
          const spdFix = (typeof kb.spd === 'number' && kb.spd > 10) ? kb.spd : 160;
          kb.dx = Math.cos(a) * spdFix;
          kb.dy = Math.sin(a) * spdFix;
          // immediate advance so player perceives motion this frame
          kb.x += kb.dx * (_dt);
          kb.y += kb.dy * (_dt);
          kb._stallFrames = 0;
          if (typeof window !== 'undefined' && window.__DEBUG_KITTY) try{ console.warn('kittybullet: repaired stalled velocity (post-move)', { i, a, spdFix }); }catch(_){ }
        }
        // If still barely moved, attempt real-time delta integration fallback (dt may be 0 in some loops)
        if (moved < 0.02){
          try{
            const nowPerf = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
            const lastT = (typeof kb._lt === 'number') ? kb._lt : (kb.t0 || nowPerf);
            let realDt = (nowPerf - lastT) / 1000; if (!(realDt > 0) || realDt > 0.25) realDt = 1/60;
            // ensure direction
            if (typeof kb.dx !== 'number' || typeof kb.dy !== 'number' || (Math.abs(kb.dx)+Math.abs(kb.dy)) < 1e-5){
              let a2 = (typeof kb.a === 'number') ? kb.a : 0;
              if (!a2 || !isFinite(a2)) a2 = Math.random()*Math.PI*2;
              const sp = (typeof kb.spd === 'number' && kb.spd>5) ? kb.spd : 160;
              kb.dx = Math.cos(a2) * sp; kb.dy = Math.sin(a2) * sp; kb.spd = sp; kb.a = a2;
            }
            kb.x += kb.dx * realDt; kb.y += kb.dy * realDt; kb._lt = nowPerf;
            if (typeof window !== 'undefined' && window.__DEBUG_KITTY) try{ console.warn('kittybullet: realtime fallback move', { i, realDt, dx: kb.dx.toFixed(2), dy: kb.dy.toFixed(2) }); }catch(_){ }
          }catch(_){ }
        }
      }catch(_){ }
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
        kittyBullets.splice(i,1);
        try{ callSpawnGibs(kb.x, kb.y, '#ffd1e8', 6, 'projectile-hit'); }catch(_){ }
        if (!inStartSafe) {
          // damage from collision/other - attempt to log attacker if 'ent' exists
          try{ if (ent){ recordKilledBy({ kind: ent.kind || ent.type || 'enemy', id: ent.id || null, x: ent.x, y: ent.y, reason: 'collision' }); } else { recordKilledBy({ kind: 'unknown', id: null, x: null, y: null, reason: 'collision' }); } }catch(_){ }
          health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ try{ recordKilledBy({ kind: (ent && (ent.kind||ent.type)) || 'enemy', id: (ent && ent.id) || null, x: (ent&&ent.x)||null, y:(ent&&ent.y)||null, reason: 'death-by-collision' }); }catch(_){ } if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } }
        } else {
          try{ callSpawnGibs(kb.x, kb.y, '#fff', 4, 'projectile-absorbed-safe'); }catch(_){ }
        }
      }
    }
  // kitten bullets can hit foliage too
  if (typeof foliageInstances !== 'undefined' && foliageInstances && foliageInstances.length){
  for (let fi = foliageInstances.length - 1; fi >= 0; fi--){ const f = foliageInstances[fi]; if (!f.destructible) continue; const r = (f.isTree) ? ((64 * Math.max(1, f.scale || 1)) * 0.42) : ((96 * Math.max(1, f.scale || 1)) * 0.46); let dy = f.y - kb.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = f.x - kb.x; if (Math.hypot(dx,dy) < r){ kittyBullets.splice(i,1); try{ handleFoliageHit(fi, kb.x, kb.y, '#8adf76'); }catch(_){ } break; } }
  }
  }
  }

    // Late kittytank renderer attachment: if the alternativetanks module loaded AFTER some kittytanks spawned
    // they may have missed attachKittenRenderer. Attempt to retrofit here once per frame.
    try{
      if (Array.isArray(enemies)){
        for (const ent of enemies){
          if (ent && ent.kind === 'kittytank' && !ent._kitten){
            try{ attachKittyIfNeeded(ent); }catch(_){ }
            // one-time check: if after attach there is still no turret canvas, log compact info (first 6 only)
            try{
              if (ent && ent.kind === 'kittytank' && (!ent._kitten || !ent._kitten.turC)){
                if (typeof window !== 'undefined'){
                  window.__kittyMissingTurret = window.__kittyMissingTurret || 0;
                  if (window.__kittyMissingTurret < 6){ window.__kittyMissingTurret++; try{ console.warn('kittytank missing turret after attach', { idx: window.__kittyMissingTurret, kind: ent.kind, x: ent.x, y: ent.y, has_draw: !!ent.draw }); }catch(_){ } }
                }
              }
            }catch(_){ }
          }
        }
      }
    }catch(_){ }

  // update casings (physics + lifetime)
  updateCasings(dt, WORLD_W, WORLD_H);

  // wrap bullets vertically for endless world
  wrapProjectilesVertically(WORLD_H, mod);

  // spawn enemies with dynamic interval
  if (!gameOver && now - lastSpawn > spawnInterval){ lastSpawn = now; spawnEnemy(enemies, spawnChainedTank); }

  // check wave progress
  checkWaveProgress(enemies);

  // update enemies (they target the selected vehicle; fallback to tank)
  // helper: chance to drop one of three collect items from certain enemies
  function doEnemyHeartDrops(e, x, y){
    try{
      if (!e || !e.kind) return;
      if (!(e.kind === 'kraken' || e.kind === 'squidrobot')) return;
      if (Math.random() < 0.5){ // 50% chance
        const picks = ['collect-saw','collect-peanut','collect-crescent'];
        const pick = picks[Math.floor(Math.random() * picks.length)];
  try{ spawnPowerup(x || e.x, y || e.y, 'journal', { hue: 280, heartVariant: 'mend', journalKey: pick }); }catch(_){ }
      }
    }catch(_){ }
  }
  // Centralized enemy drop helper: preserves existing heart/collect drops and
  // adds a 1-in-5 chance to drop a weapon-upgrade powerup ('double' or 'mini').
  function enemyDropChance(e, x, y){
    try{ doEnemyHeartDrops(e, x, y); }catch(_){ }
    // Rare 1% helicopter guardian drop chance first so only one item drops
    try{ if (Math.random() < 0.01){ spawnPowerup(x || e.x, y || e.y, 'heli-guard', { hue: 58, iconIdx: 1 }); return; } }catch(_){ }
    const rand = Math.random();
    if (rand < 0.15) {
      spawnPowerup(x || e.x, y || e.y, 'double');
    } else if (rand < 0.45) {
      spawnPowerup(x || e.x, y || e.y, 'mini', { hue: 200 });
    } else if (rand < 0.5) {
      spawnPowerup(x || e.x, y || e.y, 'shield', { hue: 180, iconIdx: 0 });
    }
  }
  // Helper: treat 'critter' and 'animal' as a single 'wildlife' category
  function isWildlife(e){
    try{ return !!(e && (e.type === 'critter' || e.type === 'animal')); }catch(_){ return false; }
  }
    const targetX = (selectedVehicle === 'heli') ? heli.x : tank.x;
    const targetY = (selectedVehicle === 'heli') ? heli.y : tank.y;
    // Expose a stable per-frame player anchor BEFORE any consumer (allies) recomputes incorrectly.
    try {
      if (typeof window !== 'undefined') {
        window.__PLAYER_ANCHOR_X = targetX;
        window.__PLAYER_ANCHOR_Y = targetY;
        window.__PLAYER_ANCHOR_T = performance.now();
      }
    } catch(_) { }
    for (let ei = enemies.length-1; ei >= 0; ei--){ const e = enemies[ei];
  // compute angle: animals should wander (not seek the player), other enemies target the selected vehicle
  let ang;
  if (isWildlife(e)){
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
          else if (e.kind === 'kittytank'){ // kittytank enemy: medium range, modest speed, larger visible hit radius
            if (dist < 360) shoot = true, spdB = 140, hitR = 12;
          } else if (e.kind === 'kraken'){
            // Kraken (new): use regular single circular projectile like normal enemies (not kitty style)
            if (dist < 400) shoot = true, spdB = 240, hitR = 10;
          }
              if (shoot){ e.lastAttack = now; // use turretAngle if squidrobot to shoot from rotating turret
            const shootA = (e.kind === 'squidrobot') ? (e.turretAngle || ang) : ang;
            try{ if (e.kind === 'kittytank' || e.kind === 'squidrobot'){ e.turretAngle = shootA; } }catch(_){ }
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
                enemyBullets.push({ x: bx, y: by, dx: dxk, dy: dyk, life: 3.0, hitR, _src: { id: e && e.id ? e.id : null, kind: e && (e.kind || e.type) ? (e.kind || e.type) : (e && e._alt && e._alt.kindOrig) ? e._alt.kindOrig : 'enemy', label: (e && e._alt && e._alt.kindOrig) ? e._alt.kindOrig : (e && e.kind) ? e.kind : 'enemy', x: e.x, y: e.y } });
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
                // Route kitten (kittytank) shots into kittyBullets so they are isolated
                if (e.kind === 'kittytank'){
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
                    kittyBullets.push({ x: bx2, y: by2, dx: kdx, dy: kdy, spd: spdB, a: shootA, life: 60.0, hitR: (hitR || 6), anim: true, t0 });
                    if (typeof window !== 'undefined' && window.__DEBUG_KITTY) try{ console.log('kitty-shot', { ex: e.x, ey: e.y, bx: bx2, by: by2, kdx, kdy, muzzleOff }); }catch(_){ }
                  }catch(_){ 
                    const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                    kittyBullets.push({ x: bx, y: by, dx, dy, spd: Math.hypot(dx,dy), a: shootA, life: 60.0, hitR: (hitR || 6), anim: true, t0 }); 
                  }
                    try{ spawnMuzzleFlash(bx, by, shootA); }catch(_){ }
                    try{ if (SFX && typeof SFX.playCannonBlast === 'function') SFX.playCannonBlast(); }catch(_){ }
                } else {
                    enemyBullets.push({ x: bx, y: by, dx, dy, life: 3.0, hitR, _src: { id: e && e.id ? e.id : null, kind: e && (e.kind || e.type) ? (e.kind || e.type) : (e && e._alt && e._alt.kindOrig) ? e._alt.kindOrig : 'enemy', label: (e && e._alt && e._alt.kindOrig) ? e._alt.kindOrig : (e && e.kind) ? e.kind : 'enemy', x: e.x, y: e.y } }); spawnMuzzleFlash(bx, by, shootA);
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
      // Some entity types (critters/animals/kittytank, etc.) were seeing their coordinates become NaN
      // because the shared variable `ang` was not guaranteed to be a finite number for them in this branch.
      // Safely derive an angle from entity properties or fall back to 0. Preserve original `ang` if valid.
      let _ang = (typeof ang === 'number' && isFinite(ang)) ? ang :
        (typeof e.angle === 'number' && isFinite(e.angle)) ? e.angle :
        (typeof e.ang === 'number' && isFinite(e.ang)) ? e.ang :
        (typeof e.a === 'number' && isFinite(e.a)) ? e.a : 0;
      if (!isFinite(_ang)) _ang = 0;
      // Ensure speed is finite; some critter/animal entries might rely on `spd` but if not present use 0.
      if (!isFinite(e.spd)){
        e.spd = (typeof e.speed === 'number' && isFinite(e.speed)) ? e.speed : (typeof e.baseSpd === 'number' ? e.baseSpd : 0);
        if (!isFinite(e.spd)) e.spd = 0;
        if (typeof window !== 'undefined'){
          try{
            window.__NONFINITE_FIXES = (window.__NONFINITE_FIXES||0) + 1;
            if (window.__NONFINITE_FIXES < 25){
              console.warn('[movement-fix] restored non-finite speed', { kind: e.kind, type: e.type, spd: e.spd });
            }
          }catch(_){ }
        }
      }
      const mvx = Math.cos(_ang) * e.spd * dt;
      const mvy = Math.sin(_ang) * e.spd * dt;
      const _mvx = isFinite(mvx) ? mvx : 0;
      const _mvy = isFinite(mvy) ? mvy : 0;
      if ((!isFinite(mvx) || !isFinite(mvy)) && typeof window !== 'undefined'){
        try{
          window.__NONFINITE_MOVES = (window.__NONFINITE_MOVES||0) + 1;
          if (window.__NONFINITE_MOVES < 25){
            console.warn('[movement-fix] suppressed non-finite move', { kind: e.kind, type: e.type, ang: _ang, spd: e.spd, mvx, mvy });
          }
        }catch(_){ }
      }
      e.x += _mvx; e.y += _mvy; e.vx = _mvx / Math.max(dt, 1e-6); e.vy = _mvy / Math.max(dt, 1e-6);
    }

    // collide with player (same as before)
    // use the top-level wrapDist() helper (defined earlier) to compute collision distance
  const _spriteW_for_collide = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
  const collided = (selectedVehicle === 'heli') ? (wrapDist(e.x, e.y, heli.x, heli.y) < (e.r + H_SPR_W*H_SCALE*0.45)) : (wrapDist(e.x, e.y, tank.x, tank.y) < (e.r + _spriteW_for_collide*effectiveTankScale()*0.45));
  if (collided){
  // If this enemy is a mini allied sub-entity, don't let it damage the player.
  // miniChain instances are pushed into `enemies` for update/draw but are ally-owned.
  try{ if (e && e._isMiniAlly) { continue; } }catch(_){ }
      // If the player is the tank, running over things shouldn't damage it.
      // If enemy flagged harmless, remove and score but do not damage player
  if (e.harmless){ if (isWildlife(e) || e.type === 'jungle') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-harmless'); recordDeath(e.kind || '<collision-harmless>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-harmless>'), e); }catch(_){ } try{ if (isWildlife(e)) e.alive = false; }catch(_){ } enemies.splice(ei,1); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud(); }
      else if (selectedVehicle === 'tank'){
  // Boss tank immunity to run-over: do not kill or score; push player back slightly and continue
  if (e && (e.kind === 'bosstank' || e.kind === 'bosstank2')){
    try{
      const dx = tank.x - e.x; let dy = wrapDeltaY(tank.y, e.y); const dist = Math.hypot(dx, dy) || 0.0001;
      const _spriteW_for_overlap = (typeof bodyCanvas !== 'undefined' && bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
      const overlap = (e.r + _spriteW_for_overlap*SPRITE_SCALE*0.45) - dist;
      if (overlap > 0){
        const nx = dx / dist, ny = dy / dist;
        tank.x += nx * overlap;
        tank.y = mod(tank.y + ny * overlap, WORLD_H);
      }
    }catch(_){ }
    try{ triggerTankBump(12, 0.25); }catch(_){ }
    // Skip normal run-over death handling
    continue;
  }
  if (isWildlife(e) || e.type === 'jungle') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-tank');
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
  try{ e.alive = false; }catch(_){ }
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
  if (isWildlife(e) || e.type === 'jungle') callSpawnGibs(e.x, e.y, '#ff8b6b', 14, 'collision-heli');
  recordDeath(e.kind || '<collision-heli>', e);
  try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<collision-heli>'), e); }catch(_){ }
    enemies.splice(ei,1);
  // damage from hazard/unknown - best-effort attacker info if available
  try{ if (hazard && hazard._src){ recordKilledBy({ kind: hazard._src.kind || hazard._src.type || 'hazard', id: hazard._src.id || null, x: hazard._src.x, y: hazard._src.y, reason: 'hazard' }); } else { recordKilledBy({ kind: 'hazard', id: null, x: (hazard&&hazard.x)||null, y:(hazard&&hazard.y)||null, reason: 'hazard' }); } }catch(_){ }
  health -= 1; try{ setHealth(health); }catch(_){ } updateHud(); if (health <= 0){ try{ recordKilledBy({ kind: (hazard && hazard._src && (hazard._src.kind||hazard._src.type)) || 'hazard', id: (hazard && hazard._src && hazard._src.id) || null, x: (hazard&&hazard.x)||null, y:(hazard&&hazard.y)||null, reason: 'death-by-hazard' }); }catch(_){ } if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } }
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
  // Boss tank dedicated bullet handling (second enemy loop)
  if (e.kind === 'bosstank' || e.kind === 'bosstank2'){
    if (typeof e.hp === 'number'){
      if (e.kind === 'bosstank2' && e._phaseBreakUntil && Date.now() < e._phaseBreakUntil){ /* invulnerable briefly */ }
      else {
        e.hp -= 1;
        if (e.kind === 'bosstank2' && e._phase !== 2 && e.hp <= 25){
          try{ e._phase = 2; e._phaseTriggered = true; }catch(_){ }
          try{ callSpawnGibs(e.x, e.y, '#ff8b6b', 40, 'bosstank2-phasebreak'); }catch(_){ }
          try{ if (typeof console !== 'undefined') console.log('[bosstank2] phase break triggered at', e.x, e.y); }catch(_){ }
          try{ e._phaseBreakUntil = Date.now() + 600; }catch(_){ }
        }
        if (e.hp <= 0){
          try{ recordDeath(e.kind, e); }catch(_){ }
          try{ recordKill(e.kind, e); }catch(_){ }
          enemies.splice(ei,1); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ }
          try{ callSpawnGibs(e.x, e.y, '#ff3030', 24, (e.kind || 'bosstank') + '-destroy'); }catch(_){ }
          try{ if (typeof console !== 'undefined') console.log('[bosstank2] destroyed at', e.x, e.y); }catch(_){ }
          score += 5; updateHud();
        }
      }
    }
    continue;
  }
  if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless-c>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless-c>'), e); }catch(_){ } score += 1; updateHud(); }
        else if (isWildlife(e) || e.type === 'jungle'){
          e.hp = (e.hp||1) - 1;
          if (e.hp <= 0){
            try{ if (isWildlife(e)) e.alive = false; }catch(_){ }
            enemies.splice(ei,1); recordDeath(e.kind || '<killed-c>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-c>'), e); }catch(_){ } try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud();
          }
        } else {
          // special-case osprey to spawn logical gibs
          if (e.type === 'osprey'){
            recordDeath(e.kind || '<osprey-killed-c>', e);
            try{ recordKill(e.kind || '<osprey-killed-c>', e); }catch(_){ }
            enemies.splice(ei,1);
            try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ }
            score += 1; updateHud();
            try{ spawnOspreyGibs(e.x, e.y, e); }catch(_){ callSpawnGibs(e.x, e.y, '#b0c7cf', 18, 'osprey-fallback'); }
          } else {
            enemies.splice(ei,1); recordDeath(e.kind || '<killed-other>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-other>'), e); }catch(_){ } try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud();
          }
        }
        break;
    } }

  // guardian MIRV bullets collision (treat like standard player damage, slightly higher power)
  for (let mbi = guardianMirvBullets.length-1; mbi >= 0; mbi--){ const mb = guardianMirvBullets[mbi];
    // Skip if salvo already exploded (meta removed)
    if (mb.salvoId && !guardianMirvSalvos.has(mb.salvoId)) continue;
    let dy2 = e.y - mb.y; if (dy2 > WORLD_H/2) dy2 -= WORLD_H; if (dy2 < -WORLD_H/2) dy2 += WORLD_H; const dx2 = e.x - mb.x; const dist2 = Math.hypot(dx2, dy2);
    // missile is 2x4 px on screen; treat as small radius 4 world units vs enemy radius
    if (dist2 < (e.r + 4)){
      guardianMirvBullets.splice(mbi,1);
      try{ callSpawnGibs(mb.x, mb.y, '#ffcf3d', 10, 'guardian-mirv-hit'); }catch(_){ }
      try{ if (typeof window !== 'undefined' && window.GUARDIAN_MIRV_DEBUG) console.log('[MIRV] hit', e.kind || e.type); }catch(_){ }
      if (e.kind === 'bosstank' || e.kind === 'bosstank2'){
        if (typeof e.hp === 'number'){
          if (e.kind === 'bosstank2' && e._phaseBreakUntil && Date.now() < e._phaseBreakUntil){ /* invulnerable briefly */ }
          else {
            e.hp -= 2; // MIRV higher damage
            if (e.kind === 'bosstank2' && e._phase !== 2 && e.hp <= 25){
              try{ e._phase = 2; e._phaseTriggered = true; }catch(_){ }
              try{ callSpawnGibs(e.x, e.y, '#ff8b6b', 40, 'bosstank2-phasebreak'); }catch(_){ }
              try{ e._phaseBreakUntil = Date.now() + 600; }catch(_){ }
            }
            if (e.hp <= 0){
              try{ recordDeath(e.kind, e); }catch(_){ }
              try{ recordKill(e.kind, e); }catch(_){ }
              enemies.splice(ei,1); try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ }
              try{ callSpawnGibs(e.x, e.y, '#ff3030', 28, (e.kind || 'bosstank') + '-destroy'); }catch(_){ }
              score += 6; updateHud();
            }
          }
        }
        break;
      }
      if (e.harmless){ enemies.splice(ei,1); recordDeath(e.kind || '<harmless-mirv>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<harmless-mirv>'), e); }catch(_){ } score += 1; updateHud(); break; }
      else if (isWildlife(e) || e.type === 'jungle'){
        e.hp = (e.hp||1) - 2; // MIRV 2x damage vs wildlife/jungle
        if (e.hp <= 0){
          try{ if (isWildlife(e)) e.alive = false; }catch(_){ }
          enemies.splice(ei,1); recordDeath(e.kind || '<killed-mirv>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-mirv>'), e); }catch(_){ } try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud();
        }
        break;
      } else {
        if (e.type === 'osprey'){
          recordDeath(e.kind || '<osprey-mirv>', e);
          try{ recordKill(e.kind || '<osprey-mirv>', e); }catch(_){ }
          enemies.splice(ei,1);
          try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ }
          score += 1; updateHud();
          try{ spawnOspreyGibs(e.x, e.y, e); }catch(_){ callSpawnGibs(e.x, e.y, '#b0c7cf', 18, 'osprey-fallback'); }
        } else {
          enemies.splice(ei,1); recordDeath(e.kind || '<killed-mirv-other>', e); try{ recordKill(e.kind || (typeof e.spriteIdx === 'number' ? ('animal-' + e.spriteIdx) : '<killed-mirv-other>'), e); }catch(_){ } try{ doEnemyHeartDrops(e,e.x,e.y); }catch(_){ } score += 1; updateHud();
        }
        break;
      }
    }
  }

  // Update critters and animals to remove dead ones from their arrays
  try{ updateCritters(dt); }catch(_){ }

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

  // Helicopter sound management: check if any helicopters exist and manage sound accordingly
  try{
    const hasEnemyHelicopters = enemies.some(e => e && e.kind === 'helicopter');
    const hasGuardianHelicopters = guardianHelis.some(g => g && (g.kind === 'helicopter' || g.kind === 'guardian-heli'));
    const hasHelicopters = hasEnemyHelicopters || hasGuardianHelicopters;
    if (!hasHelicopters){
      // No helicopters present, stop the sound
      SFX.stopHelicopter();
    }
  }catch(e){ console.warn('Helicopter sound management failed', e); }

  // update powerups and pickup detection (while running)
  if (powerups.length) updatePowerups(dt);
  // update allies (pass player's speedBoost so minis can keep up when sprinting)
  if (allies.length) {
    try{
      const nowShift = keys.has('shift');
      let speedBoost = nowShift ? 1.3 : 1.0;
      try{ if (nowShift && selectedVehicleVariant === 'fordfiesta'){ speedBoost = 2.8; } }catch(_){ }
      updateAllies(dt, speedBoost);
    }catch(_){ updateAllies(dt); }
  }
  // pickup: check vehicle proximity to powerups
  for (let pi = powerups.length-1; pi >= 0; pi--){ const p = powerups[pi]; const vx = (selectedVehicle === 'heli') ? heli.x : tank.x; const vy = (selectedVehicle === 'heli') ? heli.y : tank.y; const dy = (selectedVehicle === 'heli') ? (vy - p.y) : wrapDeltaY(vy, p.y); const dx = vx - p.x; const pickR = (p.type === 'heal' || p.type === 'journal') ? 28 : 20; if (Math.hypot(dx, dy) < pickR){ // picked up
      if (p.type === 'double'){
        const nowt = performance.now();
        if (!tank.shotCount || nowt > (tank.powerupUntil || 0)){
          // fresh pickup -> double
          tank.shotCount = 2; tank.powerupUntil = nowt + 60000;
        } else {
          // already has powerup -> upgrade (double->triple->quad->pet) and preserve remaining time
          const remainingTime = Math.max(0, (tank.powerupUntil || 0) - nowt);
          tank.shotCount = Math.min(5, (tank.shotCount || 2) + 1);
          tank.powerupUntil = nowt + Math.max(remainingTime, 30000); // minimum 30 seconds, preserve remaining time if longer

          // If reaching level 5, spawn pet tank
          if (tank.shotCount === 5) {
            spawnAlly(vx, vy, { type: 'pet' });
          }
        }
            // Record weapon powerup pickup (double)
            try{
              const c = document.createElement('canvas'); c.width = POWERUP_TILE_PX; c.height = POWERUP_TILE_PX; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
              try{ if (typeof window !== 'undefined' && typeof window.drawCollectLowResIntoPowerup === 'function') window.drawCollectLowResIntoPowerup(cc, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now(), 'collect-saw'); else { cc.fillStyle='#444'; cc.fillRect(0,0,POWERUP_TILE_PX,POWERUP_TILE_PX); } }catch(_){ }
              try{ recordKill && recordKill('powerup-double', { tileC: c, spriteIdx: null }); }catch(_){ }
            }catch(_){ }

            handlePowerupCollection(vx, vy);
            powerups.splice(pi,1);
      } else if (p.type === 'heal'){
        handleHealCollection(p, vx, vy);
        handlePowerupCollection(vx, vy);
        powerups.splice(pi,1);
      } else if (p.type === 'journal'){
        handleJournalCollection(p, vx, vy);
        handlePowerupCollection(vx, vy);
        powerups.splice(pi,1);
      } else if (p.type === 'mini'){
        // Record mini-tank powerup pickup
        try{
          const c = document.createElement('canvas'); c.width = POWERUP_TILE_PX; c.height = POWERUP_TILE_PX; const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
    try{ if (typeof window !== 'undefined' && typeof window.drawCollectLowResIntoPowerup === 'function') window.drawCollectLowResIntoPowerup(cc, POWERUP_TILE_PX/2, POWERUP_TILE_PX/2, performance.now(), 'powerup-mini'); else { cc.fillStyle='#336699'; cc.fillRect(0,0,POWERUP_TILE_PX,POWERUP_TILE_PX); } }catch(_){ }
          try{ recordKill && recordKill('powerup-mini', { tileC: c, spriteIdx: null }); }catch(_){ }
        }catch(_){ }

        handleMiniCollection(vx, vy);
        handlePowerupCollection(vx, vy);
        powerups.splice(pi,1);
      } else if (p.type === 'shield'){
        handleShieldCollection(vx, vy);
        powerups.splice(pi,1);
      } else if (p.type === 'heli-guard'){
        // Spawn guardian helicopter ally for 5 minutes (300000 ms)
        handlePowerupCollection(vx, vy);
        try{
          const GUARD_MS = 300000; // 5 minutes
          const ent = spawnHelicopter(vx + 80, vy - 120, { hp: 15, spdY: 0 });
          if (ent){ configureGuardianHeli(ent, GUARD_MS); guardianHelis.push(ent); }
        }catch(_){ }
        powerups.splice(pi,1);
      }
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
  updateMuzzleFlashes(dt);
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
  // draw critters/animals behind the player so the player renders on top
  try{ drawCritters(ctx, camera, now); }catch(_){ }
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
  // update & draw guardian helicopters
  if (guardianHelis.length){
    for (let gi = guardianHelis.length-1; gi >= 0; gi--){ const g = guardianHelis[gi]; try{ g && g.update && g.update(dt); }catch(_){ } if (!g || g._remove){ guardianHelis.splice(gi,1); } }
    try{ for (const g of guardianHelis){ if (g && g.draw) g.draw(ctx, worldToScreen, camera); } }catch(_){ }
  }
  // update / draw guardian MIRV bullets
  if (guardianMirvBullets.length){ updateGuardianMirvs(dt); drawGuardianMirvs(ctx, worldToScreen); }
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
    try{
      if (typeof window !== 'undefined' && window.__ALLY_DEBUG_LOG) {
        console.debug('[ally-screen] player screen', { sx, sy, cam: { x: camera.x, y: camera.y, zoom: camera.zoom }, tankWorld: { x: tank.x, y: tank.y } });
      }
    }catch(_){ }
    // record last player screen transform for visual debugging overlays
    try{
      if (typeof window !== 'undefined') {
        window.__LAST_PLAYER_SCREEN = { sx: sx, sy: sy, worldX: tank.x, worldY: tank.y, cam: { x: camera.x, y: camera.y, zoom: camera.zoom } };
      }
    }catch(_){ }
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

  // --- DEBUG OVERLAY: first spawn tank variant + current selection ---
  try{
    const fontSize = 16; // larger for visibility
    ctx.save();
    ctx.font = `${fontSize}px monospace`;
    ctx.textBaseline = 'top';
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = 0.95;
    const lines = [];
  lines.push(`PLAYER: ${selectedVehicleVariant}`);
  try{ const fe = (typeof window !== 'undefined') ? window.FIRST_ENEMY_TANK : null; if (fe){ lines.push(`FIRST ENEMY: ${fe.kind.toUpperCase()}`); } else { lines.push(`FIRST ENEMY: (none)`); } }catch(_){ lines.push('FIRST ENEMY: (err)'); }
    lines.push(`POS: ${Math.round(tank.x)},${Math.round(tank.y)}`);
  lines.push(`BODY:${(tank.bodyAngle||0).toFixed(2)} TUR:${(tank.turretAngle||0).toFixed(2)}`);
    const pad = 6; const lineH = fontSize + 4; const w = 320; const h = lineH * lines.length + pad*2;
    const x0 = 12; const y0 = 12;
    ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(x0-2, y0-2, w, h);
    ctx.fillStyle = '#9dfd8d';
    for (let i=0;i<lines.length;i++) ctx.fillText(lines[i], x0, y0 + pad + i*lineH);
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
        const caseColors = [brassL, brass, brassD];
        const f = frameIdx % 6; const rimShift = f;
        // outlines for casing only (spent shell, no projectile tip)
        px(ctx, x0-1, y0-1, bodyLen+2, 1, PALETTE.outline);
        px(ctx, x0-1, y0+bodyH, bodyLen+2, 1, PALETTE.outline);
        px(ctx, x0-1, y0, 1, bodyH, PALETTE.outline);
        const topBandH = 2, botBandH = 3; const midH = bodyH - topBandH - botBandH;
        px(ctx, x0, y0,               bodyLen, topBandH, caseColors[0]);
        px(ctx, x0, y0+topBandH,      bodyLen, midH,     caseColors[1]);
        px(ctx, x0, y0+bodyH-botBandH,bodyLen, botBandH, caseColors[2]);
        const rimX = x0 + clamp(2+rimShift*7, 2, bodyLen-3);
        px(ctx, rimX, y0, 1, 1, '#ffffff');
        // subtle inner mouth hint at the open end of the spent casing
        px(ctx, x0 + bodyLen - 1, y0 + Math.floor(bodyH/2), 1, 1, PALETTE.outline);
        // small bottom-left highlight for depth
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
  for (const kb of kittyBullets){
    // Real-time integration fallback (runs every frame; replaces missing update loop)
    try {
      const nowT = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      const lastT = kb._lastUpdateT || nowT; // reuse _lastUpdateT so existing code stays consistent
      let realDt = (nowT - lastT) / 1000; if (!(realDt > 0)) realDt = 1/60; if (realDt > 0.25) realDt = 0.25;
      if (typeof kb.dx === 'number' && typeof kb.dy === 'number') {
        kb.x += kb.dx * realDt; kb.y += kb.dy * realDt; kb.life -= realDt;
      }
      kb._lastUpdateT = nowT;
      // Collision (player) fallback
      try{
        if (selectedVehicle){
          const px = (selectedVehicle === 'heli') ? heli.x : tank.x;
          const py = (selectedVehicle === 'heli') ? heli.y : tank.y;
          const dist = Math.hypot(kb.x - px, kb.y - py);
          if (dist < (kb.hitR || 6)){
            kb.life = -1; kb._culled = true;
            if (typeof window !== 'undefined'){ try{ callSpawnGibs(kb.x, kb.y, '#ffd1e8', 6, 'projectile-hit-fallback'); }catch(_){ } }
            let inStartSafe = false;
            try{
              const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
              if (startSafeUntil && nowMs < startSafeUntil && START_SAFE_CENTERS && START_SAFE_CENTERS.length){
                for (let si = 0; si < START_SAFE_CENTERS.length; si++){ const sc = START_SAFE_CENTERS[si]; if (Math.hypot(px - sc.x, py - sc.y) <= START_SAFE_RADIUS){ inStartSafe = true; break; } }
              }
            }catch(_){ }
            if (!inStartSafe){
              // small damage event - attempt to record attacker metadata (if bullet or colliding ent)
              try{ if (b && b._src){ recordKilledBy({ kind: b._src.kind || b._src.type || 'enemy', id: b._src.id || null, x: b._src.x, y: b._src.y, reason: 'small-damage' }); } else if (b && b.ent){ recordKilledBy({ kind: b.ent.kind || b.ent.type || 'enemy', id: b.ent.id || null, x: b.ent.x, y: b.ent.y, reason: 'small-damage' }); } else { recordKilledBy({ kind: 'small-damage', id: null, x: (b&&b.x)||null, y:(b&&b.y)||null, reason: 'small-damage' }); } }catch(_){ }
              health -= 1; try{ setHealth(health); }catch(_){ } updateHud();
              if (health <= 0){ if (selectedVehicle === 'tank'){ explodeTank(updateHud, center, score); paused = true; gameOver = true; selectedVehicle = null; } else { gameOver = true; showGameOverModal(score); } }
            } else {
              try{ callSpawnGibs(kb.x, kb.y, '#fff', 4, 'projectile-absorbed-safe-fallback'); }catch(_){ }
            }
          }
        }
      }catch(_){ }
      // Collision (foliage) fallback
      try{
        if (!kb._culled && typeof foliageInstances !== 'undefined' && foliageInstances && foliageInstances.length){
          for (let fi = foliageInstances.length - 1; fi >= 0; fi--){
            const f = foliageInstances[fi]; if (!f.destructible) continue;
            const r = (f.isTree) ? ((64 * Math.max(1, f.scale || 1)) * 0.42) : ((96 * Math.max(1, f.scale || 1)) * 0.46);
            let dy = f.y - kb.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const dx = f.x - kb.x;
            if (Math.hypot(dx,dy) < r){ kb.life = -1; kb._culled = true; try{ handleFoliageHit(fi, kb.x, kb.y, '#8adf76'); }catch(_){ } break; }
          }
        }
      }catch(_){ }
      // Trace (first few bullets only)
      try{
        if (typeof window !== 'undefined' && kb && kb.life > 0){
          window.__kittyBulletTrace = window.__kittyBulletTrace || [];
          if (window.__kittyBulletTrace.length < 240 && kittyBullets.indexOf(kb) < 4){
            window.__kittyBulletTrace.push({ t: nowT, i: kittyBullets.indexOf(kb), x: +kb.x.toFixed(2), y: +kb.y.toFixed(2), dx: +(kb.dx||0).toFixed(2), dy: +(kb.dy||0).toFixed(2), spd: +((kb.spd)||0).toFixed(2), a: +(kb.a||0).toFixed(3), moved: +(Math.hypot(kb.dx||0, kb.dy||0)*realDt).toFixed(3), dt: +realDt.toFixed(4) });
          }
        }
      }catch(_){ }
      // life/out-of-bounds cull (mirror update loop intent)
      if (kb.life <= 0 || kb.x < -200 || kb.x > WORLD_W + 200 || kb.y < -200 || kb.y > WORLD_H + 200){ kb._culled = true; }
    } catch(_){ }
    if (kb._culled){ continue; }
    const ks = worldToScreen(kb.x, kb.y); const sx = ks.x, sy = ks.y; if (sx < -10 || sx > W+10 || sy < -10 || sy > H+10) continue;
    // If an external kitten projectile renderer is attached, prefer it
    try{
      if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenProjectile === 'function'){
        // drawKittenProjectile(ctx, kb, screenX, screenY, camera, now)
        try{ globalThis.drawKittenProjectile(ctx, kb, sx, sy, camera, performance.now()); continue; }catch(_){ /* fallthrough to default visual */ }
      }
    }catch(_){ }
    ctx.save(); ctx.shadowBlur = 18 * camera.zoom; ctx.shadowColor = 'rgba(255,120,220,0.95)'; ctx.fillStyle = '#ff8bff'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1,3*camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore(); }

  // draw enemy bullets (custom style for ally/guardian shots vs default red dots)
  function ensureGuardianBoltSprites(){
    try{
      if (typeof window === 'undefined') return;
      if (!window.__boltSprite){
        const w = 64, h = 16; const c = document.createElement('canvas'); c.width = w; c.height = h; const cx = c.getContext('2d');
        cx.clearRect(0,0,w,h);
        // trail
        const grad = cx.createLinearGradient(4, h/2, w-6, h/2);
        grad.addColorStop(0, 'rgba(80,200,255,0)');
        grad.addColorStop(0.6, 'rgba(80,200,255,0.55)');
        grad.addColorStop(1, 'rgba(255,255,255,1)');
        cx.strokeStyle = grad; cx.lineWidth = 4; cx.lineCap = 'round';
        cx.beginPath(); cx.moveTo(4, h/2); cx.lineTo(w-6, h/2); cx.stroke();
        // tip
        cx.fillStyle = 'rgba(255,255,255,0.95)'; cx.beginPath(); cx.arc(w-6, h/2, 3, 0, Math.PI*2); cx.fill();
        // cross spark
        cx.strokeStyle = 'rgba(160,230,255,0.7)'; cx.lineWidth = 2;
        cx.beginPath(); cx.moveTo(w-8, h/2-4); cx.lineTo(w-4, h/2+4); cx.stroke();
        cx.beginPath(); cx.moveTo(w-8, h/2+4); cx.lineTo(w-4, h/2-4); cx.stroke();
        window.__boltSprite = c;
      }
    }catch(_){ }
  }
  function drawGuardianBolt(ctx, sx, sy, eb, camera){
    ensureGuardianBoltSprites();
    const spr = (typeof window !== 'undefined' && window.__boltSprite) ? window.__boltSprite : null; if (!spr){
      // fallback: tiny dot if sprite missing
      ctx.save(); ctx.fillStyle = eb.color || '#66e0ff'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(1,2*camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore(); return;
    }
    const dx = eb.dx || 0, dy = eb.dy || 0; const a = Math.atan2(dy, dx);
    const spd = Math.hypot(dx, dy) || 1;
    const baseScale = Math.min(1.4, Math.max(0.7, spd / 320));
    const scale = baseScale * (camera.zoom || 1);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(a);
    const w = spr.width * scale, h = spr.height * scale;
    ctx.globalAlpha = 0.95;
    // draw so that the right tip of the sprite sits at (0,0)
    ctx.drawImage(spr, -w + 6*scale, -h/2, w, h);
    ctx.restore();
  }

  let drawnGuardian = 0; const BOLT_MAX_VIS = 60;
  for (const eb of enemyBullets){
    const es = worldToScreen(eb.x, eb.y); const sx = es.x, sy = es.y; if (sx < -10 || sx > W+10 || sy < -10 || sy > H+10) continue;
    const isGuardian = !!(eb && (eb._fromAlly || eb.style === 'guardian-bolt'));
    if (isGuardian && drawnGuardian < BOLT_MAX_VIS){ drawGuardianBolt(ctx, sx, sy, eb, camera); drawnGuardian++; }
    else {
      ctx.save(); ctx.shadowBlur = 8 * camera.zoom; ctx.shadowColor = 'rgba(255,100,100,0.8)'; ctx.fillStyle = '#ff6b6b';
      ctx.beginPath(); ctx.arc(sx, sy, Math.max(1,2.5*camera.zoom), 0, Math.PI*2); ctx.fill(); ctx.restore();
    }
  }

  // draw enemies (per-type)
  for (const e of enemies){
    // one-time kitten debug: detect a chained/kitten entity and log key fields for diagnostics
    try{
      if (!window.__kittenDebugLogged){
        const k = (window.enemies||[]).find(en => en && (en._alt || en.kind === 'kittytank' || (en.kind && en.kind.includes('kitty'))));
        if (k){
          window.__kittenDebugLogged = true;
          try {
            if (k.kind === 'kittytank' || (k.kind && String(k.kind).toLowerCase().includes('kitty'))){
              // Kittytank uses the canonical _kitten canvases, not _alt
              let tileW = null, tileH = null, nonZero = null;
              try{
                tileW = k.tileC && k.tileC.width; tileH = k.tileC && k.tileC.height;
                if (k.tileG && tileW && tileH){ const dat = k.tileG.getImageData(0,0,tileW,tileH).data; let c=0; for (let i=3;i<dat.length;i+=4){ if (dat[i]!==0){ c++; if (c>8) break; } } nonZero = c; }
              }catch(_){ }
              console.log('kitten-debug', {
                vx: k.vx, vy: k.vy, angle: k.angle, turretAngle: k.turretAngle,
                type: 'kittytank',
                drawFn: typeof k.draw === 'function',
                kitten: { bodyC: !!(k._kitten && k._kitten.bodyC), turC: !!(k._kitten && k._kitten.turC) },
                tile: { w: tileW, h: tileH, nonZero },
                sample: k
              });
            } else {
              // Chained-heavy and similar alternates use _alt with sub-hulls a/b
              console.log('kitten-debug', {
                vx: k.vx, vy: k.vy, angle: k.angle, turretAngle: k.turretAngle,
                type: k._alt && k._alt.kindOrig || k.kind,
                a_hull: k._alt && k._alt.a && k._alt.a.hullAngle, b_hull: k._alt && k._alt.b && k._alt.b.hullAngle,
                a_trot: k._alt && k._alt.a && k._alt.a.trot, b_trot: k._alt && k._alt.b && k._alt.b.trot,
                sample: k
              });
            }
          }catch(_){ }
        }
      }
    }catch(_){ }
      // heli run-over: damage nearby billboards
      try{
  for (let bi = 0; bi < billboardInstances.length; bi++){ const bb = billboardInstances[bi]; if (bb.broken) continue; const r = 32 * Math.max(bb.scaleX || 1, bb.scaleY || 1); const dx = bb.x - heli.x; const dy = wrapDeltaY(bb.y, heli.y); if (Math.hypot(dx,dy) < r){ bb.hp = (bb.hp||3) - 1; if (bb.hp <= 0){ startBillboardExplode(bb, heli.x, heli.y); } else { try{ triggerScreenShake(4, 0.06); }catch(_){ } } break; } }
      }catch(_){ }
    // prefer custom draw when entity provides one so modules can fully control visuals
    // Defensive: only continue when the custom draw actually ran without throwing.
    let __draw_ok = false;
    if (typeof e.draw === 'function'){
      try{ e.draw(ctx, worldToScreen, camera); __draw_ok = true; }catch(err){ try{ console.warn && console.warn('enemy.draw threw', err); }catch(_){ } }
    }
    if (__draw_ok) continue;
    // If draw existed but failed (or wasn't present) and this looks like a chained tank
    // ensure we render a visible fallback so the entity isn't invisible while still
    // participating in physics/collisions.
    try{
      if (!__draw_ok && e && e._alt && (e._alt.a || e._alt.b)){
        const ws = worldToScreen(e.x, e.y); const sx = ws.x, sy = ws.y;
        // simple visible marker: two hulls and a chain line between them
        try{ drawShadow(sx, sy, 48); }catch(_){ }
        ctx.save();
        ctx.translate(sx, sy);
        ctx.fillStyle = '#7f8f9f'; // body
        ctx.fillRect(-20, -8, 16, 12);
        ctx.fillRect(4, -8, 16, 12);
        ctx.strokeStyle = '#c0c6cf'; ctx.lineWidth = Math.max(1, Math.round(1.5 * ((camera && camera.zoom) ? camera.zoom : 1)));
        ctx.beginPath(); ctx.moveTo(-12, -2); ctx.lineTo(12, -2); ctx.stroke();
        ctx.restore();
        continue;
      }
    }catch(_){ }
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
  // Special-case: kittytank/kitten should rotate freely to face its movement direction
  if (e.kind === 'kittytank'){
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
          // If tile looks invalid (tiny or mostly transparent/single pixel), attempt canonical reattach
          let badTile = false;
          try{
            if (!e.tileC || !e.tileC.width || e.tileC.width < 8 || e.tileC.height < 8) badTile = true;
            else if (e.tileG){ const dat = e.tileG.getImageData(0,0,e.tileC.width,e.tileC.height).data; let non=0; for (let k=3;k<dat.length;k+=4){ if (dat[k] !== 0) { non++; if (non>4) break; } } if (non <= 4) badTile = true; }
          }catch(_){ badTile = true; }
          if (badTile){
            try{ attachKittyIfNeeded(e); }catch(_){ }
            // If a proper draw was attached, use it
            try{ if (typeof e.draw === 'function'){ e.draw(ctx, worldToScreen, camera); continue; } }catch(_){ }
            // Diagnostic: log tile dimensions and a small pixel-sample to help debug giant-dot issues (throttled)
            try{
              if (typeof window !== 'undefined'){
                window.__kittyTileReport = window.__kittyTileReport || 0;
                if (window.__kittyTileReport < 6){
                  window.__kittyTileReport++;
                  try{
                    const w = e.tileC && e.tileC.width, h = e.tileC && e.tileC.height;
                    let sample = null;
                    if (e.tileG && e.tileC && w && h){ const dat = e.tileG.getImageData(0,0,w,h).data; let count=0; for (let i=3;i<dat.length;i+=4){ if (dat[i]!==0){ count++; if (count===1) sample = { r: dat[i-3], g: dat[i-2], b: dat[i-1], a: dat[i] }; if (count>8) break; } } sample = sample || {nonTransparentCount: count}; }
                    console.warn('kittytile-report', { idx: window.__kittyTileReport, kind: e.kind, x: e.x, y: e.y, tileW: w, tileH: h, sample });
                  }catch(_){ console.warn('kittytile-report: failed to read tile data'); }
                }
              }
            }catch(_){ }
            // fallback: draw body and turret canvases if present
            try{ if (e._kitten && e._kitten.bodyC){ const z = camera.zoom * HUMAN_SCALE; ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle); ctx.scale(z,z); ctx.translate(-e._kitten.bodyC.width/2, -e._kitten.bodyC.height/2); ctx.drawImage(e._kitten.bodyC,0,0); ctx.restore(); if (e._kitten.turC){ ctx.save(); ctx.translate(sx, sy); ctx.rotate((e.turretAngle||0)+Math.PI/2); ctx.scale(z,z); ctx.translate(-e._kitten.turC.width/2, -e._kitten.turC.height/2); ctx.drawImage(e._kitten.turC,0,0); ctx.restore(); } continue; } }catch(_){ }
          }
          // Prefer canonical _kitten canvases (body + turret) which are full-size
          if (e._kitten && e._kitten.bodyC){ try{ const z = camera.zoom * HUMAN_SCALE; ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle); ctx.scale(z,z); ctx.translate(-e._kitten.bodyC.width/2, -e._kitten.bodyC.height/2); ctx.drawImage(e._kitten.bodyC,0,0); ctx.restore(); if (e._kitten.turC){ ctx.save(); ctx.translate(sx, sy); ctx.rotate((e.turretAngle||0)+Math.PI/2); ctx.scale(z,z); ctx.translate(-e._kitten.turC.width/2, -e._kitten.turC.height/2); ctx.drawImage(e._kitten.turC,0,0); ctx.restore(); } }catch(_){ drawImageCentered(e.tileC, sx, sy, angle, camera.zoom * HUMAN_SCALE); } }
          else { drawImageCentered(e.tileC, sx, sy, angle, camera.zoom * HUMAN_SCALE); }
        }catch(_){ drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE); }
      } else {
        drawImageCenteredFlipped(e.tileC, sx, sy, flip, camera.zoom * HUMAN_SCALE);
      }
    }
  } else {
    // not in marker mode
  if (e.kind === 'kittytank'){
      try{
        const vx = (typeof e.vx === 'number') ? e.vx : 0;
        const vy = (typeof e.vy === 'number') ? e.vy : 0;
        let angle = 0;
        if (Math.abs(vx) > 0.001 || Math.abs(vy) > 0.001){ angle = Math.atan2(vy, vx) + Math.PI/2; }
        else if (typeof e.angle === 'number') angle = e.angle;
        else if (typeof window !== 'undefined' && window.tank){ const tx = (selectedVehicle === 'heli' && heli) ? heli.x : tank.x; const ty = (selectedVehicle === 'heli' && heli) ? heli.y : tank.y; angle = Math.atan2(ty - e.y, tx - e.x) + Math.PI/2; }
        // If tile looks invalid, attempt reattach and fallback draw to avoid giant pixel markers
        let badTile2 = false;
        try{
          if (!e.tileC || !e.tileC.width || e.tileC.width < 8 || e.tileC.height < 8) badTile2 = true;
          else if (e.tileG){ const dat2 = e.tileG.getImageData(0,0,e.tileC.width,e.tileC.height).data; let non2=0; for (let k=3;k<dat2.length;k+=4){ if (dat2[k] !== 0){ non2++; if (non2>4) break; } } if (non2 <= 4) badTile2 = true; }
        }catch(_){ badTile2 = true; }
  if (badTile2){ try{ attachKittyIfNeeded(e); }catch(_){ }
          try{ if (typeof e.draw === 'function'){ e.draw(ctx, worldToScreen, camera); continue; } }catch(_){ }
          try{
            if (typeof window !== 'undefined'){
              window.__kittyTileReport = window.__kittyTileReport || 0;
              if (window.__kittyTileReport < 6){ window.__kittyTileReport++; try{ const w=e.tileC&&e.tileC.width,h=e.tileC&&e.tileC.height; let sample=null; if (e.tileG && w && h){ const dat=e.tileG.getImageData(0,0,w,h).data; let c=0; for (let i=3;i<dat.length;i+=4){ if (dat[i]!==0){ c++; if (c===1) sample={r:dat[i-3],g:dat[i-2],b:dat[i-1],a:dat[i]}; if (c>8) break; } } sample = sample || {nonTransparentCount:c}; } console.warn('kittytile-report', { idx: window.__kittyTileReport, kind: e.kind, x: e.x, y: e.y, tileW: w, tileH: h, sample }); }catch(_){ console.warn('kittytile-report: failed to read tile data'); } }
            }
          }catch(_){ }
          try{ if (e._kitten && e._kitten.bodyC){ const z = camera.zoom * HUMAN_SCALE; ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle); ctx.scale(z,z); ctx.translate(-e._kitten.bodyC.width/2, -e._kitten.bodyC.height/2); ctx.drawImage(e._kitten.bodyC,0,0); ctx.restore(); if (e._kitten.turC){ ctx.save(); ctx.translate(sx, sy); ctx.rotate((e.turretAngle||0)+Math.PI/2); ctx.scale(z,z); ctx.translate(-e._kitten.turC.width/2, -e._kitten.turC.height/2); ctx.drawImage(e._kitten.turC,0,0); ctx.restore(); } continue; } }catch(_){ }
        }
  // Prefer canonical _kitten canvases (body + turret) which are full-size
  if (e._kitten && e._kitten.bodyC){ try{ const z = camera.zoom * HUMAN_SCALE; ctx.save(); ctx.translate(sx, sy); ctx.rotate(angle); ctx.scale(z,z); ctx.translate(-e._kitten.bodyC.width/2, -e._kitten.bodyC.height/2); ctx.drawImage(e._kitten.bodyC,0,0); ctx.restore(); if (e._kitten.turC){ ctx.save(); ctx.translate(sx, sy); ctx.rotate((e.turretAngle||0)+Math.PI/2); ctx.scale(z,z); ctx.translate(-e._kitten.turC.width/2, -e._kitten.turC.height/2); ctx.drawImage(e._kitten.turC,0,0); ctx.restore(); } }catch(_){ drawImageCentered(e.tileC, sx, sy, angle, camera.zoom * HUMAN_SCALE); } }
  else { drawImageCentered(e.tileC, sx, sy, angle, camera.zoom * HUMAN_SCALE); }
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

  // Nuke overlay (draw last so it overlays the scene)
  try{ drawNuke(ctx, worldToScreen, camera); }catch(_){ }

  // draw critters and animals (moved earlier to render behind player)

  // recent-deaths overlay removed

    // finally, update and draw gibs so they appear on top of world sprites and explosions
    updateGibs(dt);
    drawGibs(ctx, worldToScreen, camera);

  // persistent overlay removed; reporting uses console only

    requestAnimationFrame(loop);
}
// initialize foliage (bake large offscreen grass canvas and tiles) so drawFoliage can run on first frame
try{ initFoliage(WORLD_W, WORLD_H); }catch(e){ console.warn('initFoliage failed or not available yet', e); }
// Ensure game state is initialized and initial spawns occur on load
try{ restart(); }catch(_){ }
// Start the renderer but keep the simulation paused while the pre-game dialog is visible.
try{
  // render the scene so the dialog has the game visible in the background
  paused = true;
  try{ updateHud(); }catch(_){ }
  try{ requestAnimationFrame(loop); }catch(_){ }

  // Show pre-game dialogue if Dialogue is available; otherwise unpause and start immediately
  if (typeof window !== 'undefined' && window.Dialogue && typeof window.Dialogue.playConversation === 'function'){
    try{ console.debug && console.debug('game.js: calling Dialogue.playConversation'); }catch(_){ }
    // play the richer conversation UI; when finished, unpause if user didn't skip
  window.Dialogue.playConversation(null, { nextLabel: 'Next', skipLabel: 'Skip', basePath: './Adimages/', gridCols: 3, gridRows: 3, images: { gir: './js/gir1.png', cub: './js/cub.webp' } })
      .then(didComplete => {
        try{ console.debug && console.debug('game.js: playConversation resolved', didComplete); }catch(_){ }
        if (didComplete){ try{ paused = false; updateHud(); }catch(_){ } 
          // Spawn 5 ephemeral helicopters as an opening effect: quick sweep from south to north
          try{
            const list = (typeof enemies !== 'undefined') ? enemies : (window.enemies || []);
            if (typeof spawnHelicopter === 'function' || (window && window.spawnHelicopter)){
              const spawnFn = (typeof spawnHelicopter === 'function') ? spawnHelicopter : window.spawnHelicopter;
              // distribute across the world width (use world coordinates)
              const cols = 5;
              // Determine the visible world span horizontally for the current camera
              const viewSpan = (camera && camera.zoom) ? (W / camera.zoom) : W;
              const leftEdge = (camera && camera.x != null) ? (camera.x - viewSpan/2) : 0;
              const tightPad = Math.max(40, viewSpan * 0.04); // small inner padding
              // Upside-down V (caret) formation: center highest (enters first), outer lowest (enter latest)
              const formationOffsets = [60, 30, 0, 30, 60]; // in screen px (before converting to world units)
              for (let i=0;i<cols;i++){
                const t = (i + 0.5) / cols; // center each slot
                const sx = Math.round(leftEdge + tightPad + t * (viewSpan - tightPad*2));
                // spawn slightly below the current screen so they visibly come up from the south
                const offPx = 80 + Math.round(Math.random()*40);
                // convert an off-screen pixel offset into world-space using camera.zoom
                const offWorld = offPx / (camera && camera.zoom ? camera.zoom : 1);
                const syWorld = (camera && typeof camera.y === 'number') ? (camera.y + (H/2) / (camera.zoom || 1) + offWorld) : (WORLD_H - offWorld);
                // apply formation vertical offset (outer helicopters start further down so they appear after center)
                const formOffPx = formationOffsets[i] || 0;
                const formOffWorld = formOffPx / (camera && camera.zoom ? camera.zoom : 1);
                let sy = syWorld + formOffWorld;
                if (sy >= WORLD_H) sy -= WORLD_H; else if (sy < 0) sy += WORLD_H;
                // fast northward speed and ephemeral flag
                try{
                  const spawned = spawnFn(sx, sy, { spdY: -420, ephemeral: true, _flybyExpireMs: 4000 }, list);
                  if (spawned){ try{ spawned._flybyExpireAt = (performance.now ? performance.now() : Date.now()) + 4000; }catch(_){ } }
                  try{ console.log('Opening sweep spawned helicopter', {
                    idx: i,
                    worldX: sx,
                    worldY: sy,
                    viewSpan,
                    leftEdge,
                    tightPad,
                    offPx,
                    offWorld,
                    syWorld,
                    formOffPx,
                    formOffWorld,
                    cameraY: camera && camera.y,
                    camZoom: camera && camera.zoom,
                    canvasH: H,
                    worldH: WORLD_H,
                    ent: { x: spawned && spawned.x, y: spawned && spawned.y, spdY: spawned && spawned.spdY }
                  }); }catch(_){ }
                }catch(err){ try{ console.warn('Failed to spawn opening helicopter', err); }catch(_){ } }
              }
            }
          }catch(_){ }
        }
        else { try{ window.Dialogue.say('Game start cancelled. Press Start when ready.'); }catch(_){ } }
      }).catch(err=>{ try{ console.debug && console.debug('game.js: playConversation rejected', err); }catch(_){ } try{ paused = false; updateHud(); }catch(_){ } });
  } else {
    // no dialog available; resume normal play
    paused = false;
    try{ updateHud(); }catch(_){ }
  }
}catch(_){ try{ requestAnimationFrame(loop); }catch(__){ } }

// key shortcuts
window.addEventListener('keydown', e=>{
  try{
    if (e.key.toLowerCase() === 'r'){
      try{ if (typeof resetWaves === 'function') resetWaves(); }catch(_){ }
      restart();
      // replay pre-game dialogue after restart, pause while it plays (if Dialogue available)
      try{
        if (typeof window !== 'undefined' && window.Dialogue && typeof window.Dialogue.playConversation === 'function'){
          paused = true;
          window.Dialogue.playConversation(null, { nextLabel: 'Next', skipLabel: 'Skip', basePath: './Adimages/', gridCols: 3, gridRows: 3, images: { gir: './js/gir1.png', cub: './js/cub.webp' } })
            .then(didComplete => { try{ if (didComplete) paused = false; updateHud(); }catch(_){ } })
            .catch(_=>{ try{ paused = false; updateHud(); }catch(__){} });
        }
      }catch(_){ }
      return;
    }
  }catch(_){ }
  if (e.key.toLowerCase() === 'p'){ palette = randPalette(); redrawSprites(); rebuildHeliSprites(); }
  // (key 'k' test for recent-deaths removed)
  if (e.key.toLowerCase() === 'g'){ showEntityMarkers = !showEntityMarkers; console.log('showEntityMarkers=', showEntityMarkers); }
  if (e.key.toLowerCase() === 'b'){
    try{
      // Shift+B retains old plain helicopter spawn for comparison
      if (e.shiftKey){
        const px = tank.x, py = tank.y; const dist = 160; const ang = Math.random()*Math.PI*2; const sx = px + Math.cos(ang)*dist; const sy = py + Math.sin(ang)*dist;
        const list = (typeof enemies !== 'undefined') ? enemies : (window.enemies || []);
        const heli = (typeof spawnHelicopter === 'function') ? spawnHelicopter(sx, sy, {}, list) : (window && window.spawnHelicopter ? window.spawnHelicopter(sx, sy, {}, list) : null);
        console.log('[B] Spawned plain helicopter (Shift held)', heli); return;
      }
      // Default: spawn bosstank2 for testing
      try{
        const px = tank.x, py = tank.y; const dist = 360 + Math.random()*140; const ang = Math.random()*Math.PI*2; const bx = px + Math.cos(ang)*dist; const by = py + Math.sin(ang)*dist;
        const list = (typeof enemies !== 'undefined') ? enemies : (window.enemies || []);
        let boss2 = null;
        try{ if (typeof spawnBossTank2 === 'function') boss2 = spawnBossTank2(bx, by, {}, list); }
        catch(_){ try{ if (typeof window !== 'undefined' && window.spawnBossTank2) boss2 = window.spawnBossTank2(bx, by, {}, list); }catch(_){ } }
        if (boss2){ window.__bossWave2 = true; console.log('[B] Spawned bosstank2 (test)', boss2); }
        else { console.warn('[B] spawnBossTank2 not available'); }
      }catch(err){ console.warn('Failed to spawn bosstank2 via B key', err); }
    }catch(err){ console.warn('Failed to spawn guardian helicopter', err); }
  }
  if (e.key.toLowerCase() === 'v'){
    try{
      const px = tank.x, py = tank.y; const dist = 360 + Math.random()*140; const ang = Math.random()*Math.PI*2; const bx = px + Math.cos(ang)*dist; const by = py + Math.sin(ang)*dist;
      const list = (typeof enemies !== 'undefined') ? enemies : (window.enemies || []);
      let boss1 = null;
      try{ if (typeof spawnBossTank === 'function') boss1 = spawnBossTank(bx, by, {}, list); }
      catch(_){ try{ if (typeof window !== 'undefined' && window.spawnBossTank) boss1 = window.spawnBossTank(bx, by, {}, list); }catch(_){ } }
      if (boss1){ window.__bossWave = window.__bossWave || { active: false, ent: null }; window.__bossWave.active = true; window.__bossWave.ent = boss1; console.log('[V] Spawned bosstank (boss1) for comparison', boss1); }
      else { console.warn('[V] spawnBossTank not available'); }
    }catch(err){ console.warn('Failed to spawn bosstank via V key', err); }
  }
  if (e.key.toLowerCase() === 'n'){
    try{
      const px = tank.x, py = tank.y;
      const R = 60; const TH = 6;
      const ok = debugSpawnRing ? debugSpawnRing(px, py, { r: R, thick: TH }) : (window.nukeDebugSpawn && window.nukeDebugSpawn(px, py, { r:R, thick:TH }));
      if (ok) console.log('[N] Spawned nuke ring for testing at player', { x:px, y:py, R, TH }); else console.warn('[N] Nuke animation active; cannot spawn ring now.');
    }catch(err){ console.warn('Failed to spawn test nuke ring', err); }
  }
});

// initial HUD
updateHud();
