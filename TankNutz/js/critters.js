// critters.js - manages critters and animals as hittable enemies
import { JUNGLE_KINDS, idleMakers as humansIdleMakers, runMakers as humansRunMakers } from './humans.js';
import { charTileCanvas, idleMakers as charsIdleMakers, runMakers as charsRunMakers } from './characters.js';
import { spawnKittyTank } from './alternativetanks.js';
// Runtime load check (helps diagnose cached/old file issues)
try{ console.log('[critters.js] loaded (module): charTileCanvas=', typeof charTileCanvas); }catch(_){ try{ console.warn('[critters.js] load-check failed'); }catch(__){} }
export const CRITTER_SPR_SCALE = 3; // how many canvas pixels per SVG pixel
export const CRITTER_DRAW_BASE = 0.7; // was 0.9
export const ANIMAL_DRAW_BASE = 0.6;  // reduced so animals render smaller (was 1.35)

export let critters = []; // sprite-based wandering critters (decorative)
export let animals = []; // additional small animals distributed like critters
// Centralize enemy projectile storage in projectiles.js to avoid duplicate arrays
export { enemyBullets } from './projectiles.js';
let __nextCritterId = 1; // unique id per critter instance for individual journal entries
// Helper: register first enemy globally for debug overlay
function registerFirstEnemy(ent){
  try{
    if (typeof window === 'undefined') return;
  // Only treat as 'already registered' when a valid record exists
  try{ if (window.FIRST_ENEMY_TANK != null && window.FIRST_ENEMY_TANK.kind) { return; } }catch(_){ }
  if (!ent) return;
  // Ignore decorative critters/animals as requested
  try{ if (isWildlife(ent)) return; }catch(_){ }
  // Record and expose a short debug trace so runtime issues are easier to spot
  try{ window.FIRST_ENEMY_TANK = { kind: ent.kind || '(unknown)', x: (ent.x != null ? ent.x : null), y: (ent.y != null ? ent.y : null), dist: null }; console.debug && console.debug('registerFirstEnemy: recorded', window.FIRST_ENEMY_TANK); }catch(e){ }
  }catch(_){ }
}

// Helper: treat 'critter' and 'animal' as a single 'wildlife' category
export function isWildlife(e){
  try{ return !!(e && (e.type === 'critter' || e.type === 'animal')); }catch(_){ return false; }
}

// Ensure fatsammich entities have a visible tile and painters attached.
function ensureFatsTile(ent){
  try{
    if (!ent || ent.kind !== 'fatsammich') return;
    let bad = false;
    if (!ent.tileC || !ent.tileG) bad = true;
    else {
      try{
        const dat = ent.tileG.getImageData(0,0,ent.tileC.width, ent.tileC.height).data;
        let non = 0; for (let i=3;i<dat.length;i+=4){ if (dat[i]!==0){ non++; if (non>4) break; } }
        if (non <= 4) bad = true;
      }catch(_){ bad = true; }
    }
    if (!bad) return;
    // construct canonical tile and painters from humans makers if available
    try{
      const { c: nc, g: ng } = charTileCanvas();
      const idle = (humansIdleMakers && humansIdleMakers.fatsammich) ? humansIdleMakers.fatsammich(ng) : (charsIdleMakers && charsIdleMakers.fatsammich) ? charsIdleMakers.fatsammich(ng) : (()=>{});
      const run = (humansRunMakers && humansRunMakers.fatsammich) ? humansRunMakers.fatsammich(ng) : (charsRunMakers && charsRunMakers.fatsammich) ? charsRunMakers.fatsammich(ng) : (()=>{});
      ent.tileC = nc; ent.tileG = ng; ent.idle = idle; ent.run = run;
      try{ if (typeof console !== 'undefined') console.log('ensureFatsTile: attached fatsammich tile for entity', ent); }catch(_){ }
    }catch(_){ }
  }catch(_){ }
}

// Runtime hooks populated by initCritters when called with an options object.
let _cameraRef = null;
let _worldToScreenRef = null;
let _drawCenteredRef = null;
let _drawFlippedRef = null;
let _drawShadowRef = null;
let _enemiesRef = null;
// one-shot diagnostic guard
let _diagLogged = false;
// log once when critters/animals actually exist
let _diagCountsLogged = false;
// visual diagnostic markers to draw N sample markers and then stop
let _diagMarkers = 6;

// World constants (match game.js)
const WORLD_W = 4000;
const WORLD_H = 3000;
const W = 800; // canvas width
const H = 600; // canvas height

// Coordinate wrapping functions
function wrapDeltaX(ax, bx) { 
  let dx = ax - bx; 
  if (dx > WORLD_W/2) dx -= WORLD_W; 
  if (dx < -WORLD_W/2) dx += WORLD_W; 
  return dx; 
}
function wrapDeltaY(ay, by) { 
  let dy = ay - by; 
  if (dy > WORLD_H/2) dy -= WORLD_H; 
  if (dy < -WORLD_H/2) dy += WORLD_H; 
  return dy; 
}

// Critter sprites (from 8_pixel_jungle_critters.html)
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
  {x:1,y:2,w:6,h:4,fill:'#3bb273'}, {x:0,y:4,w:2,h:2,fill:'#2a8956'}, {x:6,y:4,w:2,h:2,fill:'#2a8956'}, {x:2,y:1,w:1,h:1,fill:'#ffffff'}, {x:5,y:1,w:1,h:1,fill:'#ffffff'}, {x:3,y:4,w:2,h:2,fill:'#84cc16'}, {x:2,y:6,w:4,h:1,fill:'#0b442b'}
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

export const critterSprites = critterSpecs.map(s=>makeSpriteCanvas(s, CRITTER_SPR_SCALE));

// Larger animal sprites (from 8_pixel_jungle_critters(2).html)
const largeAnimalSpecs = [];
largeAnimalSpecs.push([
  {x:1,y:2,w:6,h:4,fill:'#3bb273'}, {x:0,y:4,w:2,h:2,fill:'#2a8956'}, {x:6,y:4,w:2,h:2,fill:'#2a8956'}, {x:2,y:1,w:1,h:1,fill:'#ffffff'}, {x:5,y:1,w:1,h:1,fill:'#ffffff'}, {x:3,y:4,w:2,h:2,fill:'#84cc16'}, {x:2,y:6,w:4,h:1,fill:'#0b442b'}
]);
largeAnimalSpecs.push([
  {x:1,y:3,w:5,h:1,fill:'#43b581'}, {x:1,y:2,w:1,h:2,fill:'#2e9d6d'}, {x:5,y:4,w:1,h:2,fill:'#2e9d6d'}, {x:2,y:5,w:4,h:1,fill:'#43b581'}, {x:6,y:4,w:1,h:1,fill:'#43b581'}, {x:7,y:4,w:1,h:1,fill:'#ff3b30'}
]);
largeAnimalSpecs.push([
  {x:2,y:2,w:3,h:3,fill:'#ef4444'}, {x:4,y:1,w:2,h:2,fill:'#ef4444'}, {x:2,y:3,w:2,h:1,fill:'#3b82f6'}, {x:1,y:4,w:1,h:2,fill:'#16a34a'}, {x:6,y:2,w:1,h:1,fill:'#f59e0b'}
]);
largeAnimalSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#8b5e3c'}, {x:3,y:1,w:2,h:2,fill:'#8b5e3c'}, {x:3,y:2,w:2,h:1,fill:'#d7b899'}
]);
largeAnimalSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#f59e0b'}, {x:5,y:2,w:2,h:2,fill:'#f59e0b'}, {x:3,y:3,w:1,h:1,fill:'#222'}
]);
largeAnimalSpecs.push([
  {x:1,y:3,w:5,h:2,fill:'#84cc16'}, {x:6,y:3,w:1,h:2,fill:'#84cc16'}, {x:2,y:2,w:3,h:1,fill:'#65a30d'}
]);
largeAnimalSpecs.push([
  {x:2,y:3,w:3,h:3,fill:'#0b0b0b'}, {x:4,y:2,w:2,h:2,fill:'#0b0b0b'}, {x:6,y:2,w:2,h:1,fill:'#facc15'}, {x:6,y:3,w:2,h:1,fill:'#fb923c'}
]);
largeAnimalSpecs.push([
  {x:3,y:2,w:2,h:4,fill:'#3b82f6'}, {x:2,y:3,w:1,h:3,fill:'#2563eb'}, {x:5,y:3,w:1,h:3,fill:'#2563eb'}
]);

const largeAnimalSprites = largeAnimalSpecs.map(s => makeSpriteCanvas(s, 4));

export function initCritters(enemiesArrayOrOptions) {
  // Accept either an enemies array or an options object with helpers (used by served_game.js)
  critters = [];
  // Keep `animals` as a live alias to `critters` for backwards compatibility so
  // other modules that still reference `animals` continue to see the unified
  // wildlife collection.
  animals = critters;
  __nextCritterId = 1;
  // Reset runtime refs unless provided
  _cameraRef = null;
  _worldToScreenRef = null;
  _drawCenteredRef = null;
  _drawFlippedRef = null;
  _drawShadowRef = null;
  _enemiesRef = null;

  if (!enemiesArrayOrOptions) return;
  if (Array.isArray(enemiesArrayOrOptions)){
    _enemiesRef = enemiesArrayOrOptions;
    return;
  }

  // options object expected by served_game.js (camera, worldToScreen, drawImageCentered, ...)
  try{
    const o = enemiesArrayOrOptions;
    if (o.camera) _cameraRef = o.camera;
    if (o.worldToScreen) _worldToScreenRef = o.worldToScreen;
    if (o.drawImageCentered) _drawCenteredRef = o.drawImageCentered;
    if (o.drawImageCenteredFlipped) _drawFlippedRef = o.drawImageCenteredFlipped;
    if (o.drawShadow) _drawShadowRef = o.drawShadow;
    if (o.enemies && Array.isArray(o.enemies)) _enemiesRef = o.enemies;
    // if no explicit enemies array provided, try to use global window.enemies when available at runtime
    if (!_enemiesRef && typeof window !== 'undefined' && Array.isArray(window.enemies)) _enemiesRef = window.enemies;
  }catch(_){ }
}

export function spawnCritters(enemiesArray) {
  const CRITTER_COUNT = 84; // more critters for jungle life

  // Use provided enemiesArray or fall back to _enemiesRef
  const targetEnemies = enemiesArray || _enemiesRef;
  if (!targetEnemies) {
    console.warn('spawnCritters: no enemies array available');
    return;
  }
  
  // Use grid-based distribution to ensure even spacing
  const GRID_SIZE = Math.ceil(Math.sqrt(CRITTER_COUNT));
  const CELL_WIDTH = WORLD_W / GRID_SIZE;
  const CELL_HEIGHT = WORLD_H / GRID_SIZE;
  
  // Spread critters across the grid by sampling grid cells without replacement.
  // This avoids packing all critters into the first rows when CRITTER_COUNT < GRID_SIZE*GRID_SIZE.
  const totalCells = GRID_SIZE * GRID_SIZE;
  const cells = new Array(totalCells);
  for (let ci = 0; ci < totalCells; ci++) cells[ci] = ci;
  // Fisher-Yates shuffle
  for (let si = cells.length - 1; si > 0; si--) {
    const ri = Math.floor(Math.random() * (si + 1));
    const tmp = cells[si]; cells[si] = cells[ri]; cells[ri] = tmp;
  }
  for (let i = 0; i < CRITTER_COUNT; i++){
    const cellIndex = cells[i];
    // Calculate grid position from shuffled cell index
    const gridX = cellIndex % GRID_SIZE;
    const gridY = Math.floor(cellIndex / GRID_SIZE);

    // Add random offset within each grid cell to avoid perfect grid alignment
    const x = gridX * CELL_WIDTH + Math.random() * CELL_WIDTH;
    const y = gridY * CELL_HEIGHT + Math.random() * CELL_HEIGHT;
    
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
  // slower base speed: ~0.8 - 2.0 (reduced further for a calmer scene)
  const baseCSpd = 0.8 + Math.random()*1.2;
    const critter = {
      x: x,
      y: y,
      speed: baseCSpd,
      spd: baseCSpd,
      angle: ang,
      targetAngle: ang,
      changeAt: performance.now() + 600 + Math.random()*1600, // change a bit more often
      spriteIdx: sidx,
      kind: 'critter-' + uid,
      tileC: tileC,
      phase: Math.random()*Math.PI*2,
        bobAmp: 0.8 + Math.random()*2.0, // livelier bobbing amplitude
      alive: true,
      type: 'critter', // Make critters hittable
      hp: 1, // Low hp for critters
      r: 8, // Radius for collision
      harmless: false,
      hopOffset: 0, // For hopping animation
      lastHop: performance.now(),
  // Slower hops: occur less often so critters appear more relaxed
  hopFrequency: 300 + Math.random()*600 // Hop every ~300-900ms
    };
    critters.push(critter);
    targetEnemies.push(critter); // Add to enemies array so they can be hit
    try{ registerFirstEnemy(critter); }catch(_){ }
  // Instrument: watch for suspicious coordinate mutations bringing entity to top-left or null/NaN
  try{ if (typeof attachCoordWatch === 'function') attachCoordWatch(critter, 'critter'); }catch(_){ }
  }
  // one-shot serializable snapshot to help external automation capture numeric coordinates
  try{
    const snap = critters.slice(0,6).map((c,i)=>({ idx:i, x: c && c.x, y: c && c.y, xFinite: Number.isFinite(c && c.x), yFinite: Number.isFinite(c && c.y), kind: c && c.kind }));
    try{ if (typeof window !== 'undefined') window.__critters_spawn_snapshot = snap; }catch(_){ }
    console.log('critters:spawn_snapshot', snap);
  }catch(_){ }
}

export function spawnAnimals(enemiesArray) {
  const ANIMAL_COUNT = 84; // same distribution/count as critters

  // Use provided enemiesArray or fall back to _enemiesRef
  const targetEnemies = enemiesArray || _enemiesRef;
  if (!targetEnemies) {
    console.warn('spawnAnimals: no enemies array available');
    return;
  }

  // Do not maintain a separate animals array; spawn as unified critters so
  // the engine treats them the same as ordinary critters. (animals is an
  // alias to critters so old code remains compatible.)
  // animals.length = 0; // no-op because animals === critters
  
  // Use grid-based distribution to ensure even spacing
  const GRID_SIZE = Math.ceil(Math.sqrt(ANIMAL_COUNT));
  const CELL_WIDTH = WORLD_W / GRID_SIZE;
  const CELL_HEIGHT = WORLD_H / GRID_SIZE;
  
  // Scatter animals using shuffled grid cells to avoid clustering in early cells.
  const totalCells = GRID_SIZE * GRID_SIZE;
  const cells = new Array(totalCells);
  for (let ci = 0; ci < totalCells; ci++) cells[ci] = ci;
  // Fisher-Yates shuffle
  for (let si = cells.length - 1; si > 0; si--) {
    const ri = Math.floor(Math.random() * (si + 1));
    const tmp = cells[si]; cells[si] = cells[ri]; cells[ri] = tmp;
  }

  for (let i = 0; i < ANIMAL_COUNT; i++){
    const cellIndex = cells[i];
    const gridX = cellIndex % GRID_SIZE;
    const gridY = Math.floor(cellIndex / GRID_SIZE);

    // Add random offset within each grid cell to avoid perfect grid alignment
    const x = gridX * CELL_WIDTH + Math.random() * CELL_WIDTH;
    const y = gridY * CELL_HEIGHT + Math.random() * CELL_HEIGHT;
    
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

    // Prefer larger animal sprite when available
    const largeTile = largeAnimalSprites[sidx] || tileC;

      // Create animals as identical critters so there is a single wildlife category.
      const uid = __nextCritterId++;
  // slower base speed for animals to match calmer critters (~0.8 - 2.0)
  const baseCSpd = 0.8 + Math.random() * 1.2;
      const crit = {
        x: x,
        y: y,
        speed: baseCSpd,
        spd: baseCSpd,
        angle: ang,
        targetAngle: ang,
        changeAt: performance.now() + 800 + Math.random()*2000,
        spriteIdx: sidx,
        kind: 'critter-' + uid,
        tileC: largeTile,
        phase: Math.random()*Math.PI*2,
        bobAmp: 0.8 + Math.random()*2.0, // same bobbing as critters
        alive: true,
        type: 'critter', // unified type
        hp: 1, // same low hp as critters
        r: 8,
        harmless: false,
        hopOffset: 0,
        lastHop: performance.now(),
  // Slower hop frequency to make animals move more relaxed
  hopFrequency: 300 + Math.random()*600
      };
      // Add to the single critters collection and enemies so engine treats them identically
      critters.push(crit);
      targetEnemies.push(crit);
      try{ registerFirstEnemy(crit); }catch(_){ }
      try{ if (typeof attachCoordWatch === 'function') attachCoordWatch(crit, 'critter'); }catch(_){ }
  }
  // one-shot serializable snapshot to help external automation capture numeric coordinates
  try{
    const snap = critters.slice(0,6).map((c,i)=>({ idx:i, x: c && c.x, y: c && c.y, xFinite: Number.isFinite(c && c.x), yFinite: Number.isFinite(c && c.y), kind: c && c.kind }));
    try{ if (typeof window !== 'undefined') { window.__critters_spawn_snapshot = snap; try{ window.__animals_spawn_snapshot = snap; }catch(_){ } } }catch(_){ }
    console.log('animals:spawn_snapshot', snap);
  }catch(_){ }
}

export function updateCritters(now) {
  for (let i = critters.length - 1; i >= 0; i--) {
    const c = critters[i];
    if (!c.alive) {
      critters.splice(i, 1);
      continue;
    }

    // Update hopping animation (keeps lively bob)
    c.phase += 0.016 * 12;
    c.hopOffset = Math.sin(c.phase) * c.bobAmp * 3;

    // When it's time to hop, schedule a smooth interpolated move instead
    if (now > c.lastHop + c.hopFrequency) {
      c.lastHop = now;

      // Occasionally change direction when hopping
      if (Math.random() < 0.55) {
        c.targetAngle = Math.random() * Math.PI * 2;
      }

      // Compute a hop target (keeps original distances but we'll interpolate)
  // shorter hops so movement appears slower and less teleport-y
  const hopDistance = 12 + Math.random() * 30; // ~12-42 units
      const tx = c.x + Math.cos(c.angle) * hopDistance;
      const ty = c.y + Math.sin(c.angle) * hopDistance;

      // store interpolation helpers on the instance
      c._moveStartX = c.x;
      c._moveStartY = c.y;
      c._moveTargetX = tx;
      c._moveTargetY = ty;
      c._moveStartTime = now;
      c._moveDuration = 140 + Math.random() * 260; // ms
      c._moving = true;

      // Update hop frequency for next hop (adds variety)
      c.hopFrequency = 80 + Math.random() * 220;
    }

    // Interpolate smooth movement toward hop target when active
    if (c._moving) {
      const elapsed = now - (c._moveStartTime || 0);
      const dur = c._moveDuration || 120;
      const t = Math.max(0, Math.min(1, elapsed / dur));
      // eased fraction (smoothstep-like)
      const ease = t * (2 - t);
      c.x = c._moveStartX + (c._moveTargetX - c._moveStartX) * ease;
      c.y = c._moveStartY + (c._moveTargetY - c._moveStartY) * ease;
      if (t >= 1) {
        c._moving = false;
      }
    } else {
      // Small wandering drift when not in a hop (subtle, slower motion)
      const wander = 0.12;
      const driftFactor = 0.016 * (0.12 + Math.random() * 0.25); // reduce per-frame movement
      c.x += Math.cos(c.angle) * (c.spd * driftFactor);
      c.y += Math.sin(c.angle) * (c.spd * driftFactor);
      // smaller random jitter so turns are gentle
      c.angle += (Math.random() - 0.5) * 0.012 * (wander + Math.random() * 0.4);
    }

    // Smooth, rate-limited turning toward targetAngle
    const rawDa = (c.targetAngle - c.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    const maxTurnPerMs = 0.0035; // rad per ms (approx 3.5 rad/s)
    const maxTurn = maxTurnPerMs * 16; // scale to approx one frame (16ms)
    const clamped = Math.max(-maxTurn, Math.min(maxTurn, rawDa));
    c.angle += clamped;

    // Wrap around world bounds (keep coords finite and in-range)
    if (c.x < 0) c.x += WORLD_W;
    if (c.x > WORLD_W) c.x -= WORLD_W;
    if (c.y < 0) c.y += WORLD_H;
    if (c.y > WORLD_H) c.y -= WORLD_H;
  }
}

export function updateAnimals(now) {
  // Forward to updateCritters so we don't double-update the unified collection.
  try{ return updateCritters(now); }catch(_){ }
}

export function drawCritters(ctx, camera, now) {
  // compute canvas size from the provided context; fall back to module constants
  const w = (ctx && ctx.canvas && ctx.canvas.width) ? ctx.canvas.width : W;
  const h = (ctx && ctx.canvas && ctx.canvas.height) ? ctx.canvas.height : H;
  // one-shot diagnostic: log canvas and camera info plus a sample entity to help debug clustering
  // Log a one-shot diagnostic immediately, and also log once when critters/animals are present
  if (!_diagLogged) {
    _diagLogged = true;
    try{
      const sample = critters.length ? critters[0] : (animals.length ? animals[0] : null);
      const diagObj = {
        canvasW: w,
        canvasH: h,
        camera: (camera || {}),
        critterCount: critters.length,
        animalCount: animals.length,
        enemiesCount: (_enemiesRef && Array.isArray(_enemiesRef)) ? _enemiesRef.length : (typeof window !== 'undefined' && Array.isArray(window.enemies) ? window.enemies.length : null),
        sampleWorld: sample ? { x: sample.x, y: sample.y } : null
      };
      // expose for automated testing
      try{ if (typeof window !== 'undefined') window.__critters_diag = diagObj; }catch(_){ }
      console.log('critters:diag', diagObj);
    }catch(_){ }
  }
  // Also log once when critters/animals spawn so automation can capture real data after restart
  if (!_diagCountsLogged && (critters.length > 0 || animals.length > 0)){
    _diagCountsLogged = true;
    try{
      const sample = critters.length ? critters[0] : (animals.length ? animals[0] : null);
      // compute a few sample screen positions for the first few critters/animals
      function worldToScreenSample(wx, wy){ let dx = wx - camera.x; if (dx > WORLD_W/2) dx -= WORLD_W; if (dx < -WORLD_W/2) dx += WORLD_W; const sx = dx * camera.zoom + w/2; let dy = wy - camera.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; const sy = dy * camera.zoom + h/2; return { x: wx, y: wy, sx: Math.round(sx), sy: Math.round(sy) }; }
      const sampleCritters = critters.slice(0,6).map(c => worldToScreenSample(c.x, c.y));
      const sampleAnimals = animals.slice(0,6).map(a => worldToScreenSample(a.x, a.y));
      const diagObj2 = {
        canvasW: w,
        canvasH: h,
        camera: (camera || {}),
        critterCount: critters.length,
        animalCount: animals.length,
        enemiesCount: (_enemiesRef && Array.isArray(_enemiesRef)) ? _enemiesRef.length : (typeof window !== 'undefined' && Array.isArray(window.enemies) ? window.enemies.length : null),
        sampleWorld: sample ? { x: sample.x, y: sample.y } : null,
        sampleCritters: sampleCritters,
        sampleAnimals: sampleAnimals
      };
      try{ if (typeof window !== 'undefined') window.__critters_diag_spawn = diagObj2; }catch(_){ }
      console.log('critters:diag_spawn', diagObj2);
      // one-shot raw dump to inspect actual critter/animal objects (help identify NaN/undefined fields)
      try{
        const rawC = critters.slice(0,6).map((c,i)=>({ idx:i, x:c && c.x, y:c && c.y, xFinite: Number.isFinite(c && c.x), yFinite: Number.isFinite(c && c.y), kind: c && c.kind }));
        const rawA = animals.slice(0,6).map((a,i)=>({ idx:i, x:a && a.x, y:a && a.y, xFinite: Number.isFinite(a && a.x), yFinite: Number.isFinite(a && a.y), kind: a && a.kind }));
        console.log('critters:raw', rawC, 'animals:raw', rawA);
      }catch(_){ }
    }catch(_){ }
  }

  for (const c of critters) {
    if (!c.alive) continue;
    
    // Use same world-to-screen transformation as game.js worldToScreen function
    let dx = c.x - camera.x;
    if (dx > WORLD_W/2) dx -= WORLD_W;
    if (dx < -WORLD_W/2) dx += WORLD_W;
    const sx = dx * camera.zoom + w/2;
    let dy = c.y - camera.y;
    if (dy > WORLD_H/2) dy -= WORLD_H;
    if (dy < -WORLD_H/2) dy += WORLD_H;
    const sy = dy * camera.zoom + h/2;
    
    // Only draw if on screen (with some margin)
    if (sx < -50 || sx > w+50 || sy < -50 || sy > h+50) continue;
    // visual diagnostic marker (one-shot limited)
    if (_diagMarkers > 0) {
      try{ ctx.save(); ctx.fillStyle = 'magenta'; ctx.fillRect(Math.round(sx)-1, Math.round(sy)-1, 3, 3); ctx.restore(); }catch(_){ }
      _diagMarkers--;
    }
    
    const spr = critterSprites[c.spriteIdx];
    if (!spr) continue;

    const flip = Math.cos(c.angle) < 0;
    const bob = Math.sin(now * 0.003 + c.phase) * c.bobAmp;
    const drawScale = camera.zoom * CRITTER_DRAW_BASE;

    ctx.save();
    ctx.translate(sx, sy + bob);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(spr, -spr.width/2 * drawScale, -spr.height/2 * drawScale, spr.width * drawScale, spr.height * drawScale);
    ctx.restore();
  }
}

export function drawAnimals(ctx, camera, now) {
  // compute canvas size from the provided context; fall back to module constants
  const w = (ctx && ctx.canvas && ctx.canvas.width) ? ctx.canvas.width : W;
  const h = (ctx && ctx.canvas && ctx.canvas.height) ? ctx.canvas.height : H;

  // Forward to drawCritters so the unified collection is rendered once.
  try{ return drawCritters(ctx, camera, now); }catch(_){ }
}

// Jungle character makers (moved from characters.js)
export const CHAR_TILE_PX = 72;

// module-scoped ASSETS reference (set by initCharactersAssets)
let ASSETS = {};
export function initCharactersAssets(a){ ASSETS = a || {}; return ASSETS; }

// local palette and helpers for character painters
function junglePaletteLocal(){ const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1)); function clamp(v,a,b){return Math.max(a,Math.min(b,v));} const g = 110 + rint(-10,25); const s = 45 + rint(-10,10); const l = 24 + rint(-6,8); return { leaf:`hsl(${g} ${s+8}% ${l}%)`, leafDark:`hsl(${g} ${s}% ${clamp(l-8,6,60)}%)`, cloth1:`hsl(${(g+40)%360} 60% 42%)`, cloth2:`hsl(${(g+180)%360} 55% 52%)`, skinLt:'#f2c6a5', skinMd:'#c78e64', skinDk:'#8a5b39', hair:'#2b221a', bandana:'#d33', metal:'#9ea4aa', shadow:'rgba(0,0,0,.28)', grid:'#000', dust:'rgba(200,200,200,.12)' } }
export let CHAR_PAL = junglePaletteLocal();

// small pixel helpers used by character makers
export function pxC(g,x,y,w=1,h=1,color='#fff'){ g.fillStyle = color; g.fillRect(x|0,y|0,w|0,h|0); }
export function ellipseShadowC(g, cx, cy, rx, ry, col){ g.save(); g.translate(cx, cy); g.scale(rx, ry); g.beginPath(); g.arc(0,0,1,0,Math.PI*2); g.fillStyle = col; g.fill(); g.restore(); }

// body part helpers
export function drawBootsC(g, x, y){ pxC(g,x-2,y,5,2,'#1a1a1a'); }
export function drawLegsC(g, x, y, tone){ pxC(g,x-1,y-6,2,6,tone); pxC(g,x+2,y-6,2,6,tone); }
export function drawPantsC(g, x, y){ pxC(g,x-3,y-7,8,3,CHAR_PAL.cloth1); }
export function drawTorsoC(g, x, y, color){ pxC(g,x-4,y-14,9,7,color); }
export function drawHeadC(g, x, y, skin){ pxC(g,x-3,y-21,7,7,skin); }
export function drawHairC(g, x, y){ pxC(g,x-3,y-21,7,2,CHAR_PAL.hair); }
export function drawBandanaC(g, x, y){ pxC(g,x-3,y-22,7,2,CHAR_PAL.bandana); }
export function drawVestC(g, x, y){ pxC(g,x-4,y-14,9,7, CHAR_PAL.cloth2); pxC(g,x-1,y-14,3,7, CHAR_PAL.cloth1); }
export function drawSatchelC(g, x, y){ pxC(g,x+4,y-13,3,5, '#4a3b28'); }
export function drawShoulderStrapC(g, x, y){ for(let i=0;i<7;i++) pxC(g,x-5+i,y-14+i,1,1,'#4a3b28'); }

export function drawRifleC(g, cx, cy, ang){ const len = 18; const vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++){ const x = cx + vx*i, y = cy + vy*i; pxC(g,x,y,1,1, i<3 ? '#3b2a1a' : (i>len-3?CHAR_PAL.metal:'#221a14')); } }
export function drawPistolC(g, cx, cy, ang){ const len=8, vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++){ const x=cx+vx*i, y=cy+vy*i; pxC(g,x,y,1,1, i>len-2?CHAR_PAL.metal:'#222'); } }
export function drawArmsAimingC(g, x, y, ang, skin){ const ax = x+1, ay = y-11; const len = 6, vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++) pxC(g, ax+vx*i, ay+vy*i, 1,1, skin); for(let i=0;i<len-1;i++) pxC(g, ax-1+vx*i*0.9, ay+1+vy*i*0.9, 1,1, skin); }

// running helpers
export function drawLegsRunC(g, x, y, tone, phase){ const liftL = Math.sin(phase)*1.5; const liftR = Math.sin(phase+Math.PI)*1.5; const foreL = Math.cos(phase)*1.2; const foreR = Math.cos(phase+Math.PI)*1.2; pxC(g, x-1+foreL, y-6-liftL, 2, 6, tone); pxC(g, x+2+foreR, y-6-liftR, 2, 6, tone); drawBootsC(g, x+foreL*0.7, y-0.5-liftL*0.4); drawBootsC(g, x+foreR*0.7+2, y-0.5-liftR*0.4); }
export function drawTorsoRunC(g, x, y, color, bob){ pxC(g,x-4,y-14-bob,9,7,color); }
export function drawHeadRunC(g, x, y, skin, bob){ pxC(g,x-3,y-21-bob,7,7,skin); }
export function drawHairRunC(g,x,y,bob){ pxC(g,x-3,y-21-bob,7,2,CHAR_PAL.hair); }
export function drawArmsRunAimC(g, x, y, ang, skin, swing){ const ax = x+1, ay = y-11 - Math.abs(swing)*0.8; const len = 6, vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++) pxC(g, ax+vx*i, ay+vy*i, 1,1, skin); for(let i=0;i<len-1;i++) pxC(g, ax-1+vx*i*0.9 - swing*0.6, ay+1+vy*i*0.9, 1,1, skin); }
export function drawDustC(g, x, y, phase){ const n = 3; const p = (Math.sin(phase)+1)/2; for(let i=0;i<n;i++){ const a = i*2*Math.PI/n + phase*0.5; const r = 2 + p*3; pxC(g, x + Math.cos(a)*r, y + 1 + Math.sin(a)*r*0.3, 1,1, CHAR_PAL.dust); } }

// Idle makers
export function makeCommandoIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78-1, 12, 3, CHAR_PAL.shadow); const breathe = Math.sin(t*0.004)*1.2; const cx = CHAR_TILE_PX/2, baseY = CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, CHAR_PAL.cloth1); drawVestC(g,cx,baseY); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); drawHairC(g,cx,baseY); drawBandanaC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+breathe,lookA, CHAR_PAL.skinDk); drawRifleC(g,cx+2,baseY-11+breathe,lookA); }; }
export function makeScoutIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const sway = Math.sin(t*0.005)*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, CHAR_PAL.cloth2); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); drawHairC(g,cx,baseY); drawShoulderStrapC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinMd); drawPistolC(g,cx+2,baseY-11+sway,lookA); }; }
export function makeHeavyIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.8, 13, 3.4, CHAR_PAL.shadow); const wob = Math.sin(t*0.003)*0.8; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.8; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); pxC(g,cx-4,baseY-7,10,4,'#3a3a3a'); drawTorsoC(g,cx,baseY, '#2d3b33'); drawSatchelC(g,cx,baseY); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); drawHairC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+wob,lookA, CHAR_PAL.skinDk); drawRifleC(g,cx+1,baseY-11+wob,lookA); }; }
export function makeMedicIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const b = Math.sin(t*0.004)*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinLt); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#3f5148'); pxC(g,cx-1,baseY-12,3,3,'#d33'); drawHeadC(g,cx,baseY, CHAR_PAL.skinLt); drawHairC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+b,lookA, CHAR_PAL.skinLt); drawPistolC(g,cx+2,baseY-11+b,lookA); }; }
export function makeVillager1Idle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 10.5, 3, CHAR_PAL.shadow); const sway = Math.sin(t*0.004)*0.9; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); pxC(g,cx-3,baseY-7,8,3,'#6b5b3a'); drawTorsoC(g,cx,baseY, '#5b7d64'); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); pxC(g,cx-4,baseY-22,9,2,'#caa84a'); pxC(g,cx-5,baseY-21,11,1,'#caa84a'); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinMd); }; }
export function makeVillager2Idle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 10.5, 3, CHAR_PAL.shadow); const sway = Math.cos(t*0.0035)*0.8; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinLt); pxC(g,cx-3,baseY-7,8,3,'#335c4a'); drawTorsoC(g,cx,baseY, '#496b55'); drawHeadC(g,cx,baseY, CHAR_PAL.skinLt); for(let i=0;i<7;i++) pxC(g,cx-5+i,baseY-14+i,1,1,'#2a2a2a'); pxC(g,cx+4,baseY-10,3,4,'#2a2a2a'); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinLt); }; }
export function makeGuideIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const b = Math.sin(t*0.0045)*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#355546'); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); pxC(g,cx+4,baseY-10,4,1,CHAR_PAL.metal); pxC(g,cx+7,baseY-11,1,3,'#3b2a1a'); drawArmsAimingC(g,cx,baseY+b,lookA, CHAR_PAL.skinDk); }; }
export function makeRadioOpIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const wob = Math.sin(t*0.003)*0.9; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#3b4e44'); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); drawHairC(g,cx,baseY); pxC(g,cx-7,baseY-13,4,6,'#2a2f34'); for(let i=0;i<7;i++) pxC(g,cx-8,baseY-14-i,1,1,'#aab'); drawArmsAimingC(g,cx,baseY+wob,lookA, CHAR_PAL.skinMd); drawPistolC(g,cx+2,baseY-11+wob,lookA); }; }

// Running makers
export function makeCommandoRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph = t*0.01*5.5; const bob = Math.abs(Math.sin(ph))*1.5; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY-1,12,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, CHAR_PAL.cloth1, bob); drawVestC(g,cx,baseY, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); drawHairRunC(g,cx,baseY, bob); drawBandanaC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); drawRifleC(g,cx+2,baseY-11+bob,lookA); }; }
export function makeScoutRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*6.0, bob=Math.abs(Math.sin(ph))*1.2; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+1); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, CHAR_PAL.cloth2, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); drawHairRunC(g,cx,baseY, bob); drawShoulderStrapC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }
export function makeHeavyRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.0, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.8; ellipseShadowC(g,cx,baseY,13,3.4,CHAR_PAL.shadow); drawDustC(g,cx-7,baseY+1,ph+0.5); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); pxC(g,cx-4,baseY-7,10,4,'#3a3a3a'); drawTorsoRunC(g,cx,baseY, '#2d3b33', bob); drawSatchelC(g,cx,baseY, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); drawHairRunC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); drawRifleC(g,cx+1,baseY-11+bob,lookA); }; }
export function makeMedicRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.6, bob=Math.abs(Math.sin(ph))*1.2; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-5,baseY+1,ph+2.1); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinLt, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#3f5148', bob); pxC(g,cx-1,baseY-12-bob,3,3,'#d33'); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinLt, bob); drawHairRunC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinLt, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }
export function makeVillager1Run(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.2, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,10.5,3,CHAR_PAL.shadow); drawDustC(g,cx-5,baseY+1,ph+0.7); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); pxC(g,cx-3,baseY-7,8,3,'#6b5b3a'); drawTorsoRunC(g,cx,baseY, '#5b7d64', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); pxC(g,cx-4,baseY-22-bob,9,2,'#caa84a'); pxC(g,cx-5,baseY-21-bob,11,1,'#caa84a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); }; }
export function makeVillager2Run(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.0, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,10.5,3,CHAR_PAL.shadow); drawDustC(g,cx-4,baseY+1,ph+1.4); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinLt, ph); pxC(g,cx-3,baseY-7,8,3,'#335c4a'); drawTorsoRunC(g,cx,baseY, '#496b55', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinLt, bob); for(let i=0;i<7;i++) pxC(g,cx-5+i,baseY-14-bob+i,1,1,'#2a2a2a'); pxC(g,cx+4,baseY-10-bob,3,4,'#2a2a2a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinLt, Math.sin(ph)); }; }
export function makeGuideRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.4, bob=Math.abs(Math.sin(ph))*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+2.8); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#355546', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); pxC(g,cx+4,baseY-10-bob,4,1,CHAR_PAL.metal); pxC(g,cx+7,baseY-11-bob,1,3,'#3b2a1a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); }; }
export function makeRadioOpRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.3, bob=Math.abs(Math.sin(ph))*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+3.5); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#3b4e44', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); drawHairRunC(g,cx,baseY, bob); pxC(g,cx-7,baseY-13-bob,4,6,'#2a2f34'); for(let i=0;i<7;i++) pxC(g,cx-8,baseY-14-bob-i,1,1,'#aab'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }

// Jungle maker maps
export const jungleIdleMakers = {
  commando: makeCommandoIdle,
  scout: makeScoutIdle,
  heavy: makeHeavyIdle,
  medic: makeMedicIdle,
  villager1: makeVillager1Idle,
  villager2: makeVillager2Idle,
  guide: makeGuideIdle,
  radioop: makeRadioOpIdle
};

export const jungleRunMakers = {
  commando: makeCommandoRun,
  scout: makeScoutRun,
  heavy: makeHeavyRun,
  medic: makeMedicRun,
  villager1: makeVillager1Run,
  villager2: makeVillager2Run,
  guide: makeGuideRun,
  radioop: makeRadioOpRun
};

export let currentWave = 1;
export const MAX_WAVES = 10;
export let waveEnemiesSpawned = 0;
export let waveEnemiesDefeated = 0;
export let waveChainedSpawned = 0; // number of chained (alt) tanks spawned this wave
export let gameWon = false; // set true when all waves complete
// Increment helper for external modules that need to record a defeated enemy.
// Exported so importers don't attempt to write to the module's binding (ES module imports are read-only).
export function incWaveEnemiesDefeated(){
  try{ waveEnemiesDefeated++; }catch(_){ }
}
export let waveInProgress = false;
export let waveStartTime = 0;

// Wave configurations: define enemy types and counts for each wave
const WAVE_CONFIGS = {
  1:  { enemies: ['commando', 'scout', 'medic'], count: 8,  chainedChance: 0,    chainMin: 0 },
  2:  { enemies: ['commando', 'scout', 'medic', 'guide'], count: 12, chainedChance: 0,    chainMin: 0 },
  3:  { enemies: ['commando', 'scout', 'medic', 'villager1', 'villager2'], count: 10, chainedChance: 0,    chainMin: 0 },
  4:  { enemies: ['commando', 'scout', 'heavy', 'medic', 'guide'], count: 12, chainedChance: 0.10, chainMin: 0 },
  5:  { enemies: ['commando', 'scout', 'heavy', 'medic', 'guide', 'radioop'], count: 15, chainedChance: 0.15, chainMin: 0 },
  6:  { enemies: ['commando', 'scout', 'heavy', 'medic', 'guide', 'radioop', 'fatsammich'], count: 18, chainedChance: 0.20, chainMin: 1 },
  7:  { enemies: ['commando', 'scout', 'heavy', 'medic', 'guide', 'radioop', 'fatsammich', 'squidrobot'], count: 20, chainedChance: 0.25, chainMin: 1 },
  8:  { enemies: ['commando', 'scout', 'heavy', 'medic', 'guide', 'radioop', 'fatsammich', 'squidrobot', 'kraken'], count: 22, chainedChance: 0.50, chainMin: 2 },
  9:  { enemies: ['commando', 'scout', 'heavy', 'medic', 'guide', 'radioop', 'fatsammich', 'squidrobot', 'kraken', 'kittytank'], count: 25, chainedChance: 0.70, chainMin: 3 },
  10: { enemies: ['heavy', 'guide', 'radioop', 'squidrobot', 'kraken', 'kittytank'], count: 30, chainedChance: 0.90, chainMin: 5 }
};

export function startNewWave() {
  if (currentWave > MAX_WAVES || gameWon) return;
  
  waveInProgress = true;
  waveEnemiesSpawned = 0;
  waveEnemiesDefeated = 0;
  waveChainedSpawned = 0;
  waveStartTime = performance.now();
  
  const cfg = WAVE_CONFIGS[currentWave];
  if (!cfg){
    // No config means we've exceeded defined waves – declare victory.
    completeWave();
    return;
  }
  console.log(`Starting Wave ${currentWave} with ${cfg.count} enemies`);
  // Wave 5 boss spawn hook: defer normal wave completion until boss killed
  try{
    if (currentWave === 5){
      if (typeof window !== 'undefined'){
        if (!window.__bossWave){ window.__bossWave = { active: false, ent: null }; }
        if (!window.__bossWave.active){
          // spawn boss near player
          const tx = (window.tank && window.tank.x) || 0;
          const ty = (window.tank && window.tank.y) || 0;
          const angle = Math.random()*Math.PI*2; const dist = 360 + Math.random()*140;
          const bx = tx + Math.cos(angle)*dist;
          const by = ty + Math.sin(angle)*dist;
          try{
            if (window.spawnBossTank){
              const boss = window.spawnBossTank(bx, by, {}, (window.enemies||[]));
              window.__bossWave.active = true; window.__bossWave.ent = boss;
              console.log('[wave5] Boss spawned at', bx, by);
            }
          }catch(err){ console.warn('Failed to spawn wave 5 boss', err); }
        }
      }
    }
  }catch(_){ }
  
  // Display wave start message (you could add UI for this)
  try {
    // if this is wave 5, show a quick in-world dialogue (Rupert/Kris) — "Sir I've got him" style
    try{
      if (typeof window !== 'undefined' && window.Dialogue && currentWave === 5){
        if (!window.__wave5DialogueShown){
          window.__wave5DialogueShown = true;
          const w5 = [
            { speaker: 'Rupert', text: "This is no ordinary threat… which makes it perfect. I’ve got plenty of experiments to test. No need for the heavy stuff—Mach 1 will do.", img: './js/cub.webp', side: 'right' },
            { speaker: 'Rupert', text: "Are you even listening??", img: './js/cub.webp', side: 'right' },
            { speaker: 'Kris', text: "......", img: './js/gir1.png', side: 'left' },
            { speaker: 'Rupert', text: "Where the hell is she? [grabs radio] RELEASE MACH 1!!", img: './js/cub.webp', side: 'right' },
            { speaker: 'Kris', text: "[sound of vending machine whirring, candy bar dropping] YES SIR!", img: './js/gir1.png', side: 'left' }
          ];
          // Pause gameplay while conversation visible
          try{ window.__wave5PrevPaused = window.paused; window.paused = true; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ }
          try{
            window.Dialogue.playConversation(w5, { gridCols: 3, gridRows: 3, images: { gir: './js/gir1.png', cub: './js/cub.webp' } })
              .then(()=>{ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ } })
              .catch(()=>{ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ } });
          }catch(_){ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(__){} }
        }
      }
    }catch(_){ }
    // if this is wave 10, play short exchange (Kris/Rupert)
    try{
      if (typeof window !== 'undefined' && window.Dialogue && currentWave === 10){
        if (!window.__wave10DialogueShown){
          window.__wave10DialogueShown = true;
          const w10 = [
            { speaker: 'Kris', text: "Mach 2 is prepared and I’m ready, sir!", img: './js/gir1.png', side: 'left' },
            { speaker: 'Rupert', text: "You realize I’m already aggravated with you, right, Commander?", img: './js/cub.webp', side: 'right' },
            { speaker: 'Kris', text: "Yes sir! This time will be diffefwent...", img: './js/gir1.png', side: 'left' },
            { speaker: 'Rupert', text: "Are you eating right now?!", img: './js/cub.webp', side: 'right' },
            { speaker: 'Kris', text: "You’ll see, sir—watft this.", img: './js/gir1.png', side: 'left' }
          ];
          try{ window.__wave10PrevPaused = window.paused; window.paused = true; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ }
          try{
            window.Dialogue.playConversation(w10, { gridCols: 3, gridRows: 3, images: { gir: './js/gir1.png', cub: './js/cub.webp' } })
              .then(()=>{
                try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ }
                // spawn boss2 after dialogue finishes
                try{
                  if (typeof window !== 'undefined' && window.spawnBossTank2){
                    if (!window.__bossWave2) window.__bossWave2 = { active: false, ent: null };
                    if (!window.__bossWave2.active){
                      const tx = (window.tank && window.tank.x) || 0;
                      const ty = (window.tank && window.tank.y) || 0;
                      const angle = Math.random()*Math.PI*2; const dist = 360 + Math.random()*140;
                      const bx = tx + Math.cos(angle)*dist;
                      const by = ty + Math.sin(angle)*dist;
                      const boss2 = window.spawnBossTank2(bx, by, {}, (window.enemies||[]));
                      window.__bossWave2.active = true; window.__bossWave2.ent = boss2;
                      console.log('[wave10] Boss2 spawned at', bx, by);
                    }
                  }
                }catch(_){ }
              })
              .catch(()=>{ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ } });
          }catch(_){ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(__){} }
        }
      }
    }catch(_){ }
    if (typeof window !== 'undefined' && window.alert) {
      // For now, just log it. You could add a proper UI notification
      console.log(`Wave ${currentWave} starting!`);
    }
  } catch(_) {}
}

export function checkWaveProgress(enemies) {
  if (gameWon) return; // already finished
  const cfg = WAVE_CONFIGS[currentWave];
  if (!cfg){
    // Safety: wave index beyond config; trigger victory once.
    if (!gameWon){ gameWon = true; console.log('Victory (auto) – undefined wave config.'); }
    return;
  }
  const currentEnemyCount = enemies.length;
  const expectedTotal = cfg.count;
  const defeatedCount = waveEnemiesSpawned - currentEnemyCount;
  
  // Start next wave if 70% of enemies are defeated OR if wave has been active for 30 seconds
  const defeatRatio = defeatedCount / expectedTotal;
  const waveActiveTime = (performance.now() - waveStartTime) / 1000; // seconds
  
  // Wave 5 gating: require boss death regardless of ratio/time
  if (currentWave === 5){
    let bossAlive = false;
    try{
      if (typeof window !== 'undefined' && window.__bossWave && window.__bossWave.active){
        const ent = window.__bossWave.ent;
        if (ent && enemies.indexOf(ent) !== -1 && ent.hp > 0){
          bossAlive = true;
        } else {
          // boss considered dead — clear marker
          window.__bossWave.active = false; window.__bossWave.ent = null;
          try{
            // Play post-boss dialogue then advance wave
            if (typeof window !== 'undefined' && window.Dialogue){
              // mark that we've handled post-boss sequence so we don't immediately complete the wave
              window.__wave5_postboss_handled = true;
              const postBoss = [
                { speaker: 'Rupert', text: "What happened? Reports indicate Mach 1 was destroyed! What happened?!", img: './js/cub.webp', side: 'right' },
                { speaker: 'Kris', text: "Oh snap, sir! I threw my rucksack in the seat and it must have hit the accelerator! …sir?", img: './js/gir1.png', side: 'left' },
                { speaker: 'Rupert', text: "Are you telling me Mach 1 was destroyed over your SNACKS?!?", img: './js/cub.webp', side: 'right' },
                { speaker: 'Kris', text: "No sir! It’s because of the container holding my snacks! Sir!", img: './js/gir1.png', side: 'left' },
                { speaker: 'Rupert', text: "You half-wit! Prepare Mach 2!", img: './js/cub.webp', side: 'right' }
              ];
              // Pause gameplay while conversation visible
              try{ window.__wave5PrevPaused = window.paused; window.paused = true; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ }
              try{
                // After dialogue completes, resume and complete the wave to start next
                window.Dialogue.playConversation(postBoss, { gridCols: 3, gridRows: 3, images: { gir: './js/gir1.png', cub: './js/cub.webp' } })
                  .then(()=>{ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ };
                    try{ completeWave(); }catch(_){ }
                  })
                  .catch(()=>{ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(_){ };
                    try{ completeWave(); }catch(_){ }
                  });
              }catch(_){ try{ window.paused = false; if (typeof window.updateHud === 'function') window.updateHud(); }catch(__){} try{ completeWave(); }catch(__){} }
            }
          }catch(_){ }
        }
      }
    }catch(_){ }
    if (!bossAlive && waveEnemiesSpawned >= expectedTotal){
      // If we've already queued/played the post-boss dialogue, don't immediately complete here
      try{
        if (typeof window !== 'undefined' && window.__wave5_postboss_handled){
          // already handling post-boss flow — skip immediate completion
        } else {
          completeWave();
        }
      }catch(_){ try{ completeWave(); }catch(__){} }
    }
    return; // do not apply generic logic during wave 5
  }
  if (waveEnemiesSpawned >= expectedTotal && (defeatRatio >= 0.7 || waveActiveTime >= 30)) completeWave();
}

export function completeWave() {
  if (gameWon) return;
  waveInProgress = false;
  console.log(`Wave ${currentWave} completed!`);
  
  // Display wave complete message
  try {
    if (typeof window !== 'undefined' && window.alert) {
      console.log(`Wave ${currentWave} defeated!`);
    }
  } catch(_) {}
  
  currentWave++;
  waveStartTime = 0;
  
  if (currentWave > MAX_WAVES) {
    console.log('All waves completed! Game won!');
    gameWon = true;
    try{ if (typeof window !== 'undefined'){ window.__tn_game_won = true; if (window.showVictoryScreen) window.showVictoryScreen(); } }catch(_){ }
    return;
  } else {
    // Reset for next wave
    waveEnemiesSpawned = 0;
    waveEnemiesDefeated = 0;
    waveChainedSpawned = 0;
  }
}

// Reset wave system to initial state (call on full game restart)
export function resetWaves(){
  try{ currentWave = 1; }catch(_){ }
  try{ waveEnemiesSpawned = 0; }catch(_){ }
  try{ waveEnemiesDefeated = 0; }catch(_){ }
  try{ waveChainedSpawned = 0; }catch(_){ }
  try{ waveInProgress = false; }catch(_){ }
  try{ waveStartTime = 0; }catch(_){ }
  try{ gameWon = false; }catch(_){ }
  try{ if (typeof window !== 'undefined') window.__tn_game_won = false; }catch(_){ }
}

export function spawnEnemy(enemies, spawnChainedTank) {
  if (gameWon) return;
  if (!waveInProgress && currentWave <= MAX_WAVES) { startNewWave(); return; }
  const cfg = WAVE_CONFIGS[currentWave];
  if (!cfg) return; // no more waves
  if (waveEnemiesSpawned >= cfg.count) return;

  // spawn at random edge
  const side = Math.floor(Math.random()*4);
  let x=0,y=0;
  if (side===0){ x = -60; y = Math.random()*WORLD_H; }
  else if (side===1){ x = WORLD_W+60; y = Math.random()*WORLD_H; }
  else if (side===2){ x = Math.random()*WORLD_W; y = -60; }
  else { x = Math.random()*WORLD_W; y = WORLD_H+60; }

  // Get wave configuration
  const waveConfig = cfg;
  const enemyTypes = waveConfig.enemies;
  
  // Choose enemy type for this wave
  const kind = enemyTypes[Math.floor(Math.random() * enemyTypes.length)];
  
  // Check if we should spawn a chained tank instead
  const needGuaranteedChain = (kind === 'heavy') && (waveChainedSpawned < (waveConfig.chainMin||0));
  const rollChain = (kind === 'heavy') && (Math.random() < waveConfig.chainedChance);
  if (needGuaranteedChain || rollChain) {
    try{ 
      const alt = spawnChainedTank(x, y, {}); 
  if (alt){ try{ if (!alt.__spawn_stack) alt.__spawn_stack = (new Error('spawned')).stack; }catch(_){ } enemies.push(alt); waveChainedSpawned++; }
      try{
        if (typeof window !== 'undefined' && !window.FIRST_ENEMY_TANK){
          window.FIRST_ENEMY_TANK = { kind: alt.kind || 'heavy', x: alt.x, y: alt.y, dist: null };
        }
      }catch(_){ }
      waveEnemiesSpawned++;
      return; 
    } catch(_) { }
  }

  // Spawn regular jungle enemy
  const hpMap = { commando:3, scout:2, heavy:4, medic:2, villager1:1, villager2:1, guide:3, radioop:2, squidrobot:2, fatsammich:1, kraken:4, kittytank:2 };
  const spdMap = { commando:45, scout:65, heavy:35, medic:50, villager1:40, villager2:40, guide:55, radioop:40, squidrobot:18, fatsammich:30, kraken:25, kittytank:60 };
  
  const { c: tileC, g: tileG } = charTileCanvas();
  const idleFactory = jungleIdleMakers[kind] || humansIdleMakers[kind] || charsIdleMakers[kind] || (()=>()=>{});  
  const runFactory = jungleRunMakers[kind] || humansRunMakers[kind] || charsRunMakers[kind] || (()=>()=>{});  
  const idle = idleFactory(tileG);
  const run = runFactory(tileG);
  const isFats = (kind === 'fatsammich');
  const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
  
  const ent = { 
    x, y, 
    spd: baseSpd, 
    r: (kind === 'squidrobot' || kind === 'kraken') ? 16 : 14, 
    type: 'jungle', 
    kind, 
    hp: isFats ? 1 : (hpMap[kind] || 2), 
    tileC, tileG, idle, run, 
    angle: 0, turretAngle: 0, 
    lastAttack: 0, 
    attackCD: (kind === 'squidrobot') ? (1000 + Math.random()*600) : (500 + Math.random()*300), 
    dashUntil: 0, 
    moving: false, 
    harmless: isFats 
  };
  
  // Special handling for certain enemy types
  if (kind === 'squidrobot'){ 
    ent.turretAngle = 0; 
  }
  if (kind === 'kittytank'){
    // Use the canonical spawner to ensure renderer and visuals are attached consistently
    try{
      const ke = spawnKittyTank(x, y, {});
      if (ke){
        enemies.push(ke);
        waveEnemiesSpawned++;
        try{ registerFirstEnemy(ke); }catch(_){ }
        return; // early exit; we handled this spawn
      }
    }catch(_){ }
  }
  
  enemies.push(ent);
  waveEnemiesSpawned++;
  try{ registerFirstEnemy(ent); }catch(_){ }
  try{
    // register first enemy tank (heavy) unconditionally on first heavy spawn
    if (ent && ent.kind === 'heavy'){
      try{ if (typeof window !== 'undefined' && !window.FIRST_ENEMY_TANK){ window.FIRST_ENEMY_TANK = { kind: ent.kind, x: ent.x, y: ent.y, dist: null }; } }catch(_){ }
    }
  }catch(_){ }
}

// spawn a small group of jungle NPCs near the player's starting position
export function spawnInitialJungleGroup(enemies, px, py, count = 3, spawnChainedTank){
  try{
    // Defensive: ensure px/py are valid numbers. If caller omitted them,
    // fall back to player position (window.tank) when available, else world center.
    try{
      const tryNum = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
      let _px = tryNum(px); let _py = tryNum(py);
      if (_px === null || _py === null){
        try{
          if (typeof window !== 'undefined' && window.tank && Number.isFinite(window.tank.x) && Number.isFinite(window.tank.y)){
            _px = _px === null ? window.tank.x : _px;
            _py = _py === null ? window.tank.y : _py;
          }
        }catch(_){ }
      }
      if (_px === null) _px = WORLD_W / 2;
      if (_py === null) _py = WORLD_H / 2;
      // clamp to world bounds with small margin
      px = Math.max(8, Math.min(WORLD_W - 8, _px));
      py = Math.max(8, Math.min(WORLD_H - 8, _py));
    }catch(_){ px = (typeof px === 'number' && Number.isFinite(px)) ? px : WORLD_W/2; py = (typeof py === 'number' && Number.isFinite(py)) ? py : WORLD_H/2; }
    const hpMap = { commando:3, scout:2, heavy:4, medic:2, villager1:1, villager2:1, guide:3, radioop:2, squidrobot:2, fatsammich:1 };
    const spdMap = { commando:45, scout:65, heavy:35, medic:50, villager1:40, villager2:40, guide:55, radioop:40, squidrobot:18 };
    for (let i = 0; i < Math.max(0, Math.min(6, count)); i++){
      const ang = (i / Math.max(1, count)) * Math.PI * 2 + (Math.random() * 0.5 - 0.25);
      const dist = 48 + Math.random() * 64;
  const x = (typeof px === 'number' && Number.isFinite(px)) ? (px + Math.cos(ang) * dist) : (WORLD_W/2 + Math.cos(ang) * dist);
  const y = (typeof py === 'number' && Number.isFinite(py)) ? (py + Math.sin(ang) * dist) : (WORLD_H/2 + Math.sin(ang) * dist);
      const kind = (Array.isArray(JUNGLE_KINDS) && JUNGLE_KINDS.length) ? JUNGLE_KINDS[Math.floor(Math.random()*JUNGLE_KINDS.length)] : 'commando';
      // sometimes replace heavy with chained tank for variety
      if (kind === 'heavy' && Math.random() < 0.5){ try{ const alt = spawnChainedTank(x, y, {}); enemies.push(alt); continue; }catch(_){ } }
      const { c: tileC, g: tileG } = charTileCanvas();
  const idle = (jungleIdleMakers && jungleIdleMakers[kind]) ? jungleIdleMakers[kind](tileG) : (humansIdleMakers && humansIdleMakers[kind]) ? humansIdleMakers[kind](tileG) : (charsIdleMakers && charsIdleMakers[kind]) ? charsIdleMakers[kind](tileG) : (()=>{});
  const run = (jungleRunMakers && jungleRunMakers[kind]) ? jungleRunMakers[kind](tileG) : (humansRunMakers && humansRunMakers[kind]) ? humansRunMakers[kind](tileG) : (charsRunMakers && charsRunMakers[kind]) ? charsRunMakers[kind](tileG) : (()=>{});
      const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
      const ent = { x, y, spd: baseSpd, r: 14, type: 'jungle', kind, hp: (hpMap[kind] || 2), tileC, tileG, idle, run, angle: 0, turretAngle: 0, lastAttack: 0, attackCD: 500 + Math.random()*300, dashUntil:0, moving: false, harmless: false };
      enemies.push(ent);
  try{ registerFirstEnemy(ent); }catch(_){ }
    }
  }catch(_){ }
}

export function spawnInitialKraken(enemies, px, py){
  try{
    // Defensive: validate px/py similar to spawnInitialJungleGroup
    try{
      const tryNum = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
      let _px = tryNum(px); let _py = tryNum(py);
      if (_px === null || _py === null){
        try{ if (typeof window !== 'undefined' && window.tank && Number.isFinite(window.tank.x) && Number.isFinite(window.tank.y)){ _px = _px===null? window.tank.x : _px; _py = _py===null? window.tank.y : _py; } }catch(_){ }
      }
      if (_px === null) _px = WORLD_W/2; if (_py === null) _py = WORLD_H/2;
      px = Math.max(8, Math.min(WORLD_W-8, _px)); py = Math.max(8, Math.min(WORLD_H-8, _py));
    }catch(_){ px = (typeof px === 'number' && Number.isFinite(px)) ? px : WORLD_W/2; py = (typeof py === 'number' && Number.isFinite(py)) ? py : WORLD_H/2; }
    const x = px + 180; const y = py;
    const { c: tileC, g: tileG } = charTileCanvas();
    const idle = (jungleIdleMakers && jungleIdleMakers.kraken) ? jungleIdleMakers.kraken(tileG) : (charsIdleMakers && charsIdleMakers.kraken) ? charsIdleMakers.kraken(tileG) : (()=>{});  
    const run = (jungleRunMakers && jungleRunMakers.kraken) ? jungleRunMakers.kraken(tileG) : (charsRunMakers && charsRunMakers.kraken) ? charsRunMakers.kraken(tileG) : (()=>{});  
    const ent = { x, y, spd: 12, r: 20, type: 'jungle', kind: 'kraken', hp: 3, tileC, tileG, idle, run, angle: 0, lastAttack: 0, attackCD: 1200, dashUntil:0, moving: false, harmless: false };
    enemies.push(ent);
    try{ registerFirstEnemy(ent); }catch(_){ }
  try{ ensureFatsTile(ent); }catch(_){}
  }catch(err){ /* fail silently */ }
}

// Spawn a single squidrobot near player start (mirrors spawnInitialKraken style)
export function spawnInitialSquid(enemies, px, py){
  try{
    const tryNum = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
    let _px = tryNum(px); let _py = tryNum(py);
    if (_px === null || _py === null){
      try{ if (typeof window !== 'undefined' && window.tank && Number.isFinite(window.tank.x) && Number.isFinite(window.tank.y)){ _px = _px===null? window.tank.x : _px; _py = _py===null? window.tank.y : _py; } }catch(_){ }
    }
    if (_px === null) _px = WORLD_W/2; if (_py === null) _py = WORLD_H/2;
    px = Math.max(8, Math.min(WORLD_W-8, _px)); py = Math.max(8, Math.min(WORLD_H-8, _py));
    const x = px + 120; const y = py; // closer than kraken spawn offset
    const { c: tileC, g: tileG } = charTileCanvas();
    const idle = (jungleIdleMakers && jungleIdleMakers.squidrobot) ? jungleIdleMakers.squidrobot(tileG) : (charsIdleMakers && charsIdleMakers.squidrobot) ? charsIdleMakers.squidrobot(tileG) : (()=>{});
    const run = (jungleRunMakers && jungleRunMakers.squidrobot) ? jungleRunMakers.squidrobot(tileG) : (charsRunMakers && charsRunMakers.squidrobot) ? charsRunMakers.squidrobot(tileG) : (()=>{});
    const ent = { x, y, spd: 18, r: 16, type: 'jungle', kind: 'squidrobot', hp: 2, tileC, tileG, idle, run, angle: 0, turretAngle: 0, lastAttack: 0, attackCD: 1100, dashUntil:0, moving: false, harmless: false };
    enemies.push(ent);
    try{ registerFirstEnemy(ent); }catch(_){ }
  try{ ensureFatsTile(ent); }catch(_){}
  }catch(_){ }
}

// Spawn one of each registered jungle enemy kinds (useful for deterministic preview at restart)
export function spawnOneOfEach(enemies, px, py, exclude = [], spawnChainedTank){
  try{
    if (!Array.isArray(enemies)) return;
    const tryNum = v => (typeof v === 'number' && Number.isFinite(v)) ? v : null;
    let _px = tryNum(px); let _py = tryNum(py);
    if (_px === null || _py === null){ try{ if (typeof window !== 'undefined' && window.tank && Number.isFinite(window.tank.x) && Number.isFinite(window.tank.y)){ _px = _px===null? window.tank.x : _px; _py = _py===null? window.tank.y : _py; } }catch(_){ }
    }
    if (_px === null) _px = WORLD_W/2; if (_py === null) _py = WORLD_H/2;
    px = Math.max(8, Math.min(WORLD_W-8, _px)); py = Math.max(8, Math.min(WORLD_H-8, _py));

    // maps copied from spawnEnemy for consistency
    const hpMap = { commando:3, scout:2, heavy:4, medic:2, villager1:1, villager2:1, guide:3, radioop:2, squidrobot:2, fatsammich:1, kraken:4, kittytank:2 };
    const spdMap = { commando:45, scout:65, heavy:35, medic:50, villager1:40, villager2:40, guide:55, radioop:40, squidrobot:18, fatsammich:30, kraken:25, kittytank:60 };

    // filter kinds and spawn one each arranged around the player
    const kinds = Array.isArray(JUNGLE_KINDS) ? JUNGLE_KINDS.filter(k=>!exclude.includes(k)) : [];
    if (!kinds.length) return;
    const step = (Math.PI * 2) / kinds.length;
    for (let i=0;i<kinds.length;i++){
      const kind = kinds[i];
      try{
        // Allow chained heavy spawn via provided helper when available
        if (kind === 'heavy' && typeof spawnChainedTank === 'function'){
          const ang = i * step; const dist = 120; const x = px + Math.cos(ang) * dist; const y = py + Math.sin(ang) * dist;
          const alt = spawnChainedTank(x, y, {});
          if (alt) { enemies.push(alt); try{ registerFirstEnemy(alt); }catch(_){ } continue; }
        }

        const ang = i * step; const dist = 120; const x = px + Math.cos(ang) * dist; const y = py + Math.sin(ang) * dist;
        const { c: tileC, g: tileG } = charTileCanvas();
        const idle = (jungleIdleMakers && jungleIdleMakers[kind]) ? jungleIdleMakers[kind](tileG) : (charsIdleMakers && charsIdleMakers[kind]) ? charsIdleMakers[kind](tileG) : (()=>{});
        const run = (jungleRunMakers && jungleRunMakers[kind]) ? jungleRunMakers[kind](tileG) : (charsRunMakers && charsRunMakers[kind]) ? charsRunMakers[kind](tileG) : (()=>{});
        const baseSpd = (spdMap[kind] || 40) + Math.random()*8;
        const ent = { x, y, spd: baseSpd, r: (kind === 'squidrobot' || kind === 'kraken') ? 16 : 14, type: 'jungle', kind, hp: (hpMap[kind] || 2), tileC, tileG, idle, run, angle: 0, turretAngle: 0, lastAttack: 0, attackCD: 500 + Math.random()*300, dashUntil:0, moving: false, harmless: (kind==='fatsammich') };
        enemies.push(ent);
        try{ registerFirstEnemy(ent); }catch(_){ }
      }catch(_){ }
    }
  }catch(_){ }
}
