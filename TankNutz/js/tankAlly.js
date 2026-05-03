// Tank Ally module: unified system for mini tank allies and pet tanks

// import mini chained tank renderer so we can spawn scaled "mini-chain" pets
import { spawnChainedTank } from './alternativetanks.js';

// --- Arrays ---
export const allies = []; // Unified array for all ally types: {x,y,spd,r,type,hp,lastAttack,attackCD,turretAngle,angle,scale,tankVariant,spawnTime,treadPhase,dust,allyType,followDistance,followAngle,lastShot,shotCooldown,color}

// Cache for recolored canvases: key -> offscreen canvas
const _allyRecolorCache = new Map();

function hexToRgb(hex) {
  if (!hex) return { r: 255, g: 255, b: 255 };
  const h = hex.replace('#','');
  const bigint = parseInt(h.length === 3 ? h.split('').map(c=>c+c).join('') : h, 16);
  return { r: (bigint >> 16) & 255, g: (bigint >> 8) & 255, b: bigint & 255 };
}

function clamp(v, a=0, b=255){ return Math.max(a, Math.min(b, v)); }
function shadeRgb(rgb, percent){ // percent -100..100
  const f = 1 + (percent/100);
  return { r: clamp(Math.round(rgb.r * f)), g: clamp(Math.round(rgb.g * f)), b: clamp(Math.round(rgb.b * f)) };
}

function lerpRgb(a, b, t){ return { r: Math.round(a.r + (b.r - a.r) * t), g: Math.round(a.g + (b.g - a.g) * t), b: Math.round(a.b + (b.b - a.b) * t) }; }

function recolorSpriteCanvas(srcCanvas, bodyHex, accentHex, cacheKey) {
  try {
    if (!srcCanvas || !srcCanvas.getContext) return srcCanvas;
    const key = `${cacheKey}:${bodyHex}:${accentHex}:${srcCanvas.width}x${srcCanvas.height}`;
    if (_allyRecolorCache.has(key)) return _allyRecolorCache.get(key);

    const w = srcCanvas.width, h = srcCanvas.height;
    // create offscreen
    const oc = (typeof document !== 'undefined' && typeof document.createElement === 'function') ? document.createElement('canvas') : null;
    if (!oc) return srcCanvas;
    oc.width = w; oc.height = h;
    const octx = oc.getContext('2d');
    octx.drawImage(srcCanvas, 0, 0);
    let img;
    try { img = octx.getImageData(0,0,w,h); } catch(e) { return srcCanvas; }

    const bodyRgb = hexToRgb(bodyHex || '#000000');
    const accRgb = hexToRgb(accentHex || '#00ff00');

    // Prepare shaded variants to preserve artwork definition
    const bodyDark = shadeRgb(bodyRgb, -30); // darker for deep shadows
    const bodyLight = shadeRgb(bodyRgb, 12); // slight highlight
    const accDark = shadeRgb(accRgb, -20);
    const accLight = shadeRgb(accRgb, 10);

    // Replace black and green pixels with shaded blends.
    // heuristics: black => max(r,g,b) < 50. green => g > 100 && g > r*1.2 && g > b*1.2
    const data = img.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i+1], b = data[i+2], a = data[i+3];
      if (a === 0) continue;
      const maxch = Math.max(r,g,b);
      // compute a local normalized intensity for shading (0..1)
      // use the max channel relative to the black/green thresholds
      if (maxch < 50) {
        // black-like: map between bodyDark (deepest) and bodyRgb (normal) using original brightness
        const t = Math.max(0, Math.min(1, maxch / 50));
        const mixed = lerpRgb(bodyDark, bodyRgb, t);
        // preserve slight highlights from original if any
        const final = lerpRgb(mixed, bodyLight, Math.max(0, (maxch - 30) / 40));
        data[i] = final.r; data[i+1] = final.g; data[i+2] = final.b;
      } else if (g > 100 && g > r * 1.2 && g > b * 1.2) {
        // green-like: compute normalized green intensity and map to partner shades
        const gNorm = Math.max(0, Math.min(1, (g - 100) / (255 - 100)));
        const mixed = lerpRgb(accDark, accRgb, gNorm);
        const final = lerpRgb(mixed, accLight, Math.max(0, (g - 180) / 75));
        data[i] = final.r; data[i+1] = final.g; data[i+2] = final.b;
      }
      // leave other pixels intact to preserve shading and artwork
    }
    octx.putImageData(img, 0, 0);
    _allyRecolorCache.set(key, oc);
    return oc;
  } catch (_) { return srcCanvas; }
}

// Local helpers (avoid relying on external load order)
function lerp(a, b, t) {
  return a + (b - a) * (t < 0 ? 0 : (t > 1 ? 1 : t));
}

function effectiveTankScale() {
  try {
    if (window.selectedVehicleVariant === 'murkia') return 1 * 0.4;
    if (window.selectedVehicleVariant === 'bondtank') return 1 * 3;
    if (window.selectedVehicleVariant === 'blackstar') return 1 * 0.4;
    return 1;
  } catch(_) { return 1; }
}

// Simple player position: just the tank/heli coordinates
function resolvePlayerPosStrict(){
  try{
    if (typeof window === 'undefined') return { x: 0, y: 0, ok:false };
    const sel = window.selectedVehicle;
    if (sel === 'heli' && window.heli && Number.isFinite(window.heli.x) && Number.isFinite(window.heli.y)){
      return { x: window.heli.x, y: window.heli.y, ok:true };
    }
    if (window.tank && Number.isFinite(window.tank.x) && Number.isFinite(window.tank.y)){
      return { x: window.tank.x, y: window.tank.y, ok:true };
    }
    // fallback
    return { x: (window.WORLD_W||4000)/2, y: (window.WORLD_H||3000)/2, ok:false };
  }catch(_){ return { x:0,y:0, ok:false }; }
}

// --- Unified Ally Spawn System ---
export function spawnAlly(x, y, config = {}) {
  // Defensive: ensure x,y are sane. fall back to player position or map center
  try{
    const ok = v=> (typeof v==='number' && Number.isFinite(v));
    if (!ok(x) || !ok(y)){
      try{ if (typeof window !== 'undefined' && window.tank && Number.isFinite(window.tank.x) && Number.isFinite(window.tank.y)){ x = ok(x)? x : window.tank.x; y = ok(y)? y : window.tank.y; } }catch(_){ }
    }
    if (!ok(x)) x = (typeof window !== 'undefined' && window.WORLD_W) ? window.WORLD_W/2 : 2000; if (!ok(y)) y = (typeof window !== 'undefined' && window.WORLD_H) ? window.WORLD_H/2 : 1500;
  }catch(_){ x = (typeof x==='number'&&Number.isFinite(x))?x:2000; y = (typeof y==='number'&&Number.isFinite(y))?y:1500; }

  // Consolidate all spawned allies into a single "mini-pet" class
  const requestedType = config.type || 'mini';
  const allyType = 'mini-pet';
  const isMini = true; // legacy alias kept for compatibility within this module
  const isPet = true;  // legacy alias kept for compatibility within this module

  // Optional: auto-place at current player focus instead of raw (0,0) / provided when omitted
  // Triggers when caller did not explicitly pass coordinates OR they are (0,0) which is suspicious for late-loading assets.
  try {
    if ((x === 0 && y === 0) || (config.autoPosition !== false && (typeof config.x === 'undefined' && typeof config.y === 'undefined'))) {
      if (typeof window !== 'undefined') {
        // Resolve focus similar to updateAllies logic (prefer anchor, then heli/tank)
        let fx = window.__PLAYER_ANCHOR_X; let fy = window.__PLAYER_ANCHOR_Y; let ft = window.__PLAYER_ANCHOR_T || 0;
        const fresh = performance.now() - ft < 250 && Number.isFinite(fx) && Number.isFinite(fy);
        if (!fresh) {
          if (window.selectedVehicle === 'heli' && window.heli) { fx = window.heli.x; fy = window.heli.y; }
          else if (window.tank) { fx = window.tank.x; fy = window.tank.y; }
        }
        if (!Number.isFinite(fx) || !Number.isFinite(fy)) { fx = (window.WORLD_W||4000)/2; fy = (window.WORLD_H||3000)/2; }
        // Position at the same spot as player, with small offset to the right
        x = fx + 10;
        y = fy;
      }
    }
  } catch(_) { }

  // Get player's current variant
  const playerVariant = (typeof window !== 'undefined' && window.selectedVehicleVariant) || 'default';

  // Choose a color palette for visible differentiation. These are body/accent pairs.
  // Palettes include an approximate hue-rotate value to recolor the source sprite while preserving shading.
  // hueRotate is an approximation — tweak values if you want a different tint angle.
  // NOTE: per request, use the partner/second color as the tank body and the first color as the accent.
  // Palette pairs: replace black-like pixels with `primary` and green-like pixels with `partner`.
  // Mapping per user's request:
  // Beige & White: primary = #EAD7B7, partner = #FFFFFF
  // Black & Red:   primary = #000000, partner = #E53935
  // Red & White:   primary = #D32F2F, partner = #FFFFFF
  // Yellow & Black:primary = #FFEB3B, partner = #000000
  // Purple & Green:primary = #9C27B0, partner = #4CAF50
  const PALETTES = [
    { _paletteName: 'beige-white', primary: '#EAD7B7', partner: '#FFFFFF' },
    { _paletteName: 'black-red', primary: '#000000', partner: '#E53935' },
    { _paletteName: 'red-white', primary: '#D32F2F', partner: '#FFFFFF' },
    { _paletteName: 'yellow-black', primary: '#FFEB3B', partner: '#000000' },
    { _paletteName: 'purple-green', primary: '#9C27B0', partner: '#4CAF50' }
  ];
  // Accept legacy color shapes: string or {body,accent} or new {primary,partner}
  const palette = (() => {
    if (config.color) {
      if (typeof config.color === 'string') return { primary: config.color, partner: config.color, _paletteName: 'custom' };
      if (config.color.primary && config.color.partner) return config.color;
      if (config.color.body && config.color.accent) return { primary: config.color.body, partner: config.color.accent, _paletteName: config.color._paletteName || 'custom' };
      // fallback to single-color string-like object
      if (config.color.body) return { primary: config.color.body, partner: config.color.body, _paletteName: 'custom' };
    }
    return PALETTES[Math.floor(Math.random() * PALETTES.length)];
  })();

  const ally = {
    x: (typeof window !== 'undefined' && window.mod) ? window.mod((x || 0), window.WORLD_W) : (x || 0),
    y: (typeof window !== 'undefined' && window.mod) ? window.mod((y || 0), window.WORLD_H) : (y || 0),
    vx: 0,
    vy: 0,
  // Increase default ally speed so minis keep up with player movement better
  spd: (typeof window !== 'undefined' && window.tank && window.tank.speed) ? Math.max((window.tank.speed || 140), 220) : 220,
    r: 24, // Always full-size hit radius
    type: 'ally',
    hp: 7, // unified mini-pet HP
    lastAttack: 0,
    attackCD: isMini ? 800 + Math.random() * 400 : 0,
    turretAngle: 0,
    angle: 0,
    scale: 1.0, // Always render high-def full size
    tankVariant: playerVariant,
    spawnTime: performance.now(),
    treadPhase: 0,
    dust: 0,
    allyType: allyType,
  // Unified follow defaults for both minis and pets so movement behavior is identical
  followDistance: (typeof config.followDistance === 'number') ? config.followDistance : 60,
    followAngle: (typeof config.followAngle === 'number') ? config.followAngle : (Math.random() * Math.PI * 2),
  // Shooting: default 1 shot per second unless overridden via config.shotCooldown
  shotCooldown: (typeof config.shotCooldown === 'number') ? config.shotCooldown : 1000,
  lastShot: (typeof performance !== 'undefined') ? (performance.now() - (Math.random() * ((typeof config.shotCooldown === 'number') ? config.shotCooldown : 1000))) : 0,
    // assign the chosen palette and normalize to explicit { body, accent, _paletteName }
    // NOTE: we treat the PALETTE.partner as the tank body color and PALETTE.primary as the accent
    color: (function(){
      // string -> both fields same
      if (typeof config.color === 'string') return { body: config.color, accent: config.color, _paletteName: 'custom' };
      // new shape provided (primary/partner)
      if (config.color && config.color.primary && config.color.partner) return { body: config.color.partner, accent: config.color.primary, _paletteName: config.color._paletteName || 'custom' };
      // legacy shape (body/accent)
      if (config.color && config.color.body && config.color.accent) return { body: config.color.body, accent: config.color.accent, _paletteName: config.color._paletteName || 'custom' };
      // fallback: normalize selected palette from PALETTES
      return { body: palette.partner, accent: palette.primary, _paletteName: palette._paletteName };
    })(),
    noTint: false // allow tint overlays/differentation
  ,
    // Allies should ignore projectile damage and persist for the full spawn duration (handled by updateAllies)
    invulnerableToProjectiles: true
  };

  // Unified limit: allow up to 10 mini-pets total
  const miniPetCount = allies.filter(a => a.allyType === 'mini-pet').length;
  if (miniPetCount < 10) {
    // Rarely, replace a normal mini-pet with a MINI chained tank variant
    try{
      const roll = Math.random();
      // ~15% chance to spawn a mini chained tank instead of a regular ally
      if (roll < 0.15 && typeof spawnChainedTank === 'function'){
        // create a chained tank enemy at the ally location and then wrap it for ally behaviors
        // Use same hp as enemy (6) so this is functionally identical but visually smaller.
  const miniChain = spawnChainedTank(ally.x, ally.y, { hp: 6, minSpeed: 12, maxSpeed: 60, _allySpawn: true });
  // mark as ally-owned so game collision logic can ignore projectile damage if needed
  miniChain._isMiniAlly = true;
  try{ if (console && console.debug) console.debug('[tankAlly] created miniChain', { x: miniChain.x, y: miniChain.y, hp: miniChain.hp, _spawn_stack: miniChain.__spawn_stack }); }catch(_){ }
        // store palette on the chained entity so its draw can be recolored by our pipeline when composing
        miniChain._allyPalette = ally.color;
        // we will keep a lightweight wrapper object in allies array that proxies update/draw to the chained entity
        const wrapper = Object.assign({}, ally, {
          // keep physics on wrapper for steering but delegate rendering to chained sub-entity
          _miniChain: miniChain,
          // lower HP since this is a mini variant
          hp: miniChain.hp || ally.hp,
          // override draw to render the chained entity via its own draw method when present
          drawOverride: function(ctx, worldToScreen, camera){
            try{
              if (!this._miniChain) return;
              // compute screen position for this wrapper
              let ws = null;
              try{ ws = (typeof worldToScreen === 'function') ? worldToScreen(this.x, this.y) : { x: this.x, y: this.y }; }catch(_){ ws = { x: this.x, y: this.y }; }
              try{
                const SIZE = 96; // offscreen render size
                const oc = document.createElement('canvas'); oc.width = SIZE; oc.height = SIZE;
                const octx = oc.getContext('2d');

                // Sync miniChain world-space positions and full subpart state to this wrapper so draw sees correct double-hull layout
                const pad = (this._miniChain && this._miniChain._alt && Number.isFinite(this._miniChain._alt.padding)) ? this._miniChain._alt.padding : 28;
                try{
                  if (!this._miniChain._alt) this._miniChain._alt = {};
                  // Ensure both subparts exist and populate full expected fields
                  if (!this._miniChain._alt.a) this._miniChain._alt.a = { x: this.x - pad, y: this.y, vx:0, vy:0, hullAngle: this.angle || 0, trot:0, trotPhase:0, turretAngle: this.turretAngle || 0, _lastShot:0 };
                  if (!this._miniChain._alt.b) this._miniChain._alt.b = { x: this.x + pad, y: this.y, vx:0, vy:0, hullAngle: this.angle || 0, trot:0, trotPhase:0, turretAngle: this.turretAngle || 0, _lastShot:0 };
                  // write current wrapper-aligned positions/angles
                  this._miniChain.x = this.x; this._miniChain.y = this.y; this._miniChain.angle = this.angle || 0; this._miniChain.turretAngle = this.turretAngle || 0;
                  // sync linear velocity so the chained hulls compute hullAngle from vx/vy like the standard enemy
                  try{
                    const avx = (Number.isFinite(this.vx) ? this.vx : 0);
                    const avy = (Number.isFinite(this.vy) ? this.vy : 0);
                    this._miniChain.vx = avx; this._miniChain.vy = avy;
                    this._miniChain._alt.a.vx = avx; this._miniChain._alt.a.vy = avy; this._miniChain._alt.b.vx = avx; this._miniChain._alt.b.vy = avy;
                    // derive hullAngle from velocity when movement present so hulls face travel
                    const sp = Math.hypot(avx, avy);
                    const derivedAngle = (sp > 0.5) ? Math.atan2(avy, avx) : (this.angle || 0);
                    this._miniChain._alt.a.hullAngle = derivedAngle; this._miniChain._alt.b.hullAngle = derivedAngle; this._miniChain.angle = derivedAngle;
                  }catch(_){ this._miniChain._alt.a.hullAngle = this.angle || 0; this._miniChain._alt.b.hullAngle = this.angle || 0; }
                  this._miniChain._alt.a.x = this.x - pad; this._miniChain._alt.a.y = this.y; 
                  this._miniChain._alt.b.x = this.x + pad; this._miniChain._alt.b.y = this.y;

                  // Compute turret angles toward nearest valid target so turrets point at enemies like the real chained tank
                  try{
                    const tgt = findNearestAllyTarget(this) || (typeof window !== 'undefined' && window.tank) || null;
                    if (tgt && typeof tgt.x === 'number'){
                      // compute per-subpart aim
                      const ax = this._miniChain._alt.a.x; const ay = this._miniChain._alt.a.y;
                      const bx = this._miniChain._alt.b.x; const by = this._miniChain._alt.b.y;
                      let dax = tgt.x - ax; let day = tgt.y - ay; let dbx = tgt.x - bx; let dby = tgt.y - by;
                      try{ if (window.wrapDeltaX) { dax = window.wrapDeltaX(tgt.x, ax); dbx = window.wrapDeltaX(tgt.x, bx); } }catch(_){ }
                      try{ if (window.wrapDeltaY) { day = window.wrapDeltaY(tgt.y, ay); dby = window.wrapDeltaY(tgt.y, by); } }catch(_){ }
                      this._miniChain._alt.a.turretAngle = Math.atan2(day, dax);
                      this._miniChain._alt.b.turretAngle = Math.atan2(dby, dbx);
                      // also set averaged turretAngle on main entity for compatibility
                      this._miniChain.turretAngle = (this._miniChain._alt.a.turretAngle + this._miniChain._alt.b.turretAngle) * 0.5;
                    } else {
                      this._miniChain._alt.a.turretAngle = this.turretAngle || 0;
                      this._miniChain._alt.b.turretAngle = this.turretAngle || 0;
                      this._miniChain.turretAngle = this.turretAngle || 0;
                    }
                  }catch(_){ this._miniChain._alt.a.turretAngle = this.turretAngle || 0; this._miniChain._alt.b.turretAngle = this.turretAngle || 0; }
                }catch(_){ }

                // fake worldToScreen mapping that preserves relative offsets so chain anchors don't collapse
                const fakeW2S = (x,y)=>{
                  // map world delta around wrapper to offscreen pixel offsets
                  const dx = (x - this.x) || 0; const dy = (y - this.y) || 0;
                  // small scale so pad appears within the offscreen
                  const localScale = 1.0;
                  return { x: (SIZE/2) + dx * localScale, y: (SIZE/2) + dy * localScale };
                };
                const fakeCam = { zoom: 1 };

                // Draw the chained entity into offscreen using synced positions
                try{ if (typeof this._miniChain.draw === 'function') this._miniChain.draw(octx, fakeW2S, fakeCam); }
                catch(_){ try{ /* fallback to drawing a simple hull if draw fails */ }catch(__){} }

                // Blit offscreen scaled down so it's visually tiny and preserves the two-hull chain
                try{
                  const scaleDown = 0.45; // tinier than before
                  ctx.save();
                  const z = (camera && camera.zoom) ? camera.zoom : 1;
                  ctx.translate(ws.x, ws.y);
                  ctx.scale(z * scaleDown, z * scaleDown);
                  ctx.drawImage(oc, -oc.width/2, -oc.height/2);
                  ctx.restore();
                }catch(_){ }
              }catch(_){
                // fallback: draw the chained entity directly into main ctx
                try{ if (typeof this._miniChain.draw === 'function') this._miniChain.draw(ctx, worldToScreen, camera); }catch(__){}
              }
            }catch(_){ }
          }
        });
        // push both the chained entity into the global enemies list if present so it receives updates,
        // and push the wrapper into allies for existing ally update/draw loops to interact with.
  // Do not push the miniChain into the global enemies list here. The wrapper
  // will drive the miniChain's update/draw to avoid creating a separate
  // full-sized enemy instance. This prevents duplicate visible/interactive
  // spawns when spawnChainedTank also registers entities.
  try{ /* intentionally skip pushing miniChain into window.enemies */ }catch(_){ }
        allies.push(wrapper);
      } else {
        allies.push(ally);
      }
    }catch(_){ allies.push(ally); }
  }
}

export function updateAllies(dt, playerSpeedBoost = 1.0) {
  const now = performance.now();

  // Retain last non-origin focus so early (0,0) frames don't mislead allies
  if (typeof window !== 'undefined') {
    if (!window.__ALLY_LAST_FOCUS) window.__ALLY_LAST_FOCUS = { x: NaN, y: NaN };
    if (!window.__ALLY_LAST_LOG_TIME) window.__ALLY_LAST_LOG_TIME = 0;
  }

  // STRICT mode: always use the exact projectile anchor (no camera midpoint, no last-focus smoothing)
  const strict = (typeof window !== 'undefined' && window.__ALLY_STRICT) ? true : true; // default true to force identical targeting
  let focusX, focusY;
  if (strict){
    const p = resolvePlayerPosStrict();
    focusX = p.x; focusY = p.y;
  } else {
    const p = resolvePlayerPosStrict(); focusX = p.x; focusY = p.y;
  }

  // Log every 5 seconds: player position vs ally focus
  if (now - window.__ALLY_LAST_LOG_TIME > 5000) {
    const playerX = window.tank ? window.tank.x : (window.heli ? window.heli.x : 'N/A');
    const playerY = window.tank ? window.tank.y : (window.heli ? window.heli.y : 'N/A');
    console.log('[DEBUG] Player pos:', playerX, playerY, 'Ally focus:', focusX, focusY);
    window.__ALLY_LAST_LOG_TIME = now;
  }

  // Optional lightweight debug hook
  if (typeof window !== 'undefined' && window.__ALLY_DEBUG_LOG && (Math.random() < 0.01)) {
    console.log('[ally-debug] focusPos(strict)', { focusX, focusY });
  }

  for (let i = allies.length - 1; i >= 0; i--) {
    const ally = allies[i];

    // Check duration
    if (now - ally.spawnTime > 60000) {
      allies.splice(i, 1);
      continue;
    }

  // Unified movement: both pets and minis use mini-behavior steering so they move identically.
  updateMiniBehavior(ally, focusX, focusY, dt, now, playerSpeedBoost);
    // Copy angles from player tank (safe to copy, minis will steer independently)
    try {
      if (typeof window !== 'undefined' && window.tank) {
        // Do not force positions for pets. Both minis and pets use steering logic
        // to compute their positions; here we only sync visual orientation/turret.
        ally.angle = ally.angle || window.tank.bodyAngle || 0;
        ally.turretAngle = ally.turretAngle || (window.tank.turretAngle || 0);
        ally.scale = (typeof window !== 'undefined' && typeof effectiveTankScale === 'function') ? effectiveTankScale() : (ally.scale || 1);
      } else {
        // No tank available: do not overwrite ally positions. Keep steering fallback.
      }
    } catch(_) {
      // swallow errors - do not force ally positions as a fallback
    }

    // Optional debug: when enabled, print any large discrepancy between tank and ally world coords
    try {
      if (typeof window !== 'undefined' && window.__ALLY_DEBUG_LOG) {
        const tx = window.tank ? window.tank.x : NaN; const ty = window.tank ? window.tank.y : NaN;
        if (Number.isFinite(tx) && Number.isFinite(ty)) {
          const d = Math.hypot(window.wrapDeltaX ? window.wrapDeltaX(ally.x, tx) : (ally.x - tx), window.wrapDeltaY ? window.wrapDeltaY(ally.y, ty) : (ally.y - ty));
          if (d > 40) console.debug('[ally-anchor] large world delta', { ally: { x: ally.x, y: ally.y }, tank: { x: tx, y: ty }, d });
        }
      }
    } catch(_) {}

    // If this ally wraps a miniChain enemy, call its update so turret aiming, shooting
    // and internal animation run as if it were an enemy, but keep it out of the global
    // enemies list to avoid duplicate full-sized behavior.
    try{
      if (ally && ally._miniChain && typeof ally._miniChain.update === 'function'){
        // call with a safe small dt (approximate) so update logic runs; prefer provided dt when meaningful
        try{ ally._miniChain.update(dt, 0, { x: ally.x, y: ally.y }); }catch(_){ try{ ally._miniChain.update(dt); }catch(__){} }
      }
    }catch(_){ }

    // Wrap around world boundaries (same as player)
    if (typeof window !== 'undefined' && window.mod && window.WORLD_W && window.WORLD_H) {
      ally.x = window.mod(ally.x, window.WORLD_W);
      ally.y = window.mod(ally.y, window.WORLD_H);
    }

    // Debug instrumentation: log occasional distance samples
    try {
      if (typeof window !== 'undefined' && window.__ALLY_DIST_DEBUG && Math.random() < 0.01) {
        let dxD = focusX - ally.x; let dyD = focusY - ally.y;
        if (window.wrapDeltaX) dxD = window.wrapDeltaX(focusX, ally.x);
        if (window.wrapDeltaY) dyD = window.wrapDeltaY(focusY, ally.y);
        const d = Math.hypot(dxD, dyD);
        console.debug('[ally-dist]', { d: d.toFixed(1), ax: ally.x.toFixed(1), ay: ally.y.toFixed(1), fx: focusX.toFixed(1), fy: focusY.toFixed(1), vx: ally.vx.toFixed(1), vy: ally.vy.toFixed(1) });
      }
    } catch(_) { }

    // Update tread animation
    ally.treadPhase += dt * 4;

    // Update dust effect
    const speed = Math.hypot(ally.vx, ally.vy);
    ally.dust = Math.max(0, ally.dust - dt * 2);
    if (speed > 10) {
      ally.dust = Math.min(1, ally.dust + dt * 0.5);
    }

    // Remove if dead (since clamped to canvas, no need for dist check)
    if (ally.hp <= 0) {
      allies.splice(i, 1);
    }
  }

  // Optional debug render: draw a small marker at the resolved player position (enabled via window.__ALLY_DEBUG_MARK= true)
  try {
    if (typeof window !== 'undefined' && window.__ALLY_DEBUG_MARK && window.ctx && window.worldToScreen) {
      const s = window.worldToScreen(focusX, focusY);
      window.ctx.save();
      window.ctx.fillStyle = 'rgba(255,255,0,0.6)';
      window.ctx.beginPath();
      window.ctx.arc(s.x, s.y, 6, 0, Math.PI*2);
      window.ctx.fill();
      window.ctx.restore();
      // If player anchor globals exist, draw a secondary ring to confirm anchor vs fallback
      try {
        if (Number.isFinite(window.__PLAYER_ANCHOR_X) && Number.isFinite(window.__PLAYER_ANCHOR_Y)) {
          const a = window.worldToScreen(window.__PLAYER_ANCHOR_X, window.__PLAYER_ANCHOR_Y);
          window.ctx.save();
          window.ctx.strokeStyle = 'rgba(0,200,255,0.75)';
          window.ctx.lineWidth = 2;
          window.ctx.beginPath();
          window.ctx.arc(a.x, a.y, 9, 0, Math.PI*2);
          window.ctx.stroke();
          window.ctx.restore();
        }
      } catch(_) { }
    }
  } catch(_) { }
}

// Helper function for pet tank behavior (orbit and shoot)
function updatePetBehavior(ally, focusX, focusY, dt, now) {
  // Pets used to be rigidly anchored to the player (follow exactly).
  // Change: delegate movement to the mini-behavior so pets orbit/move like other allies
  // while keeping pet-specific defaults (tighter follow distance / unique angle).
  try {
    // Ensure sensible follow params for pets (tighter orbit)
    if (!Number.isFinite(ally.followDistance) || ally.followDistance === 0) ally.followDistance = 42 + (allies.filter(a => a.allyType === 'pet').indexOf(ally) * 10 || 0);
    if (!Number.isFinite(ally.followAngle)) ally.followAngle = ((Math.PI * 2) / 5) * (allies.filter(a => a.allyType === 'pet').indexOf(ally) || 0) + (Math.random() * 0.25);

    // Use the same movement/steering as minis so pets don't stick to the player.
    // Pass a modest playerSpeedBoost so pets can keep up when sprinting.
    updateMiniBehavior(ally, focusX, focusY, dt, now, 1.0);

    // Pet: keep more aggressive firing cadence if desired (existing shotCooldown applies)
    // Targeting/firing already handled by updateMiniBehavior via findNearestAllyTarget + tryAllyFire
  } catch (_){
    // Fallback: keep the previous safe, anchored behavior if something goes wrong
    ally.vx = 0; ally.vy = 0; ally.angle = 0;
  }
}

// Helper function for mini ally behavior (follow closely, don't shoot)
function updateMiniBehavior(ally, focusX, focusY, dt, now, playerSpeedBoost = 1.0) {
  // Simple boid-like wander around the player's focus
  try{
    // ensure velocity fields
    if (!Number.isFinite(ally.vx)) ally.vx = 0;
    if (!Number.isFinite(ally.vy)) ally.vy = 0;

    // desired orbit point: player + followAngle rotated around with followDistance
    const dist = ally.followDistance || 60;
    const baseAngle = ally.followAngle || 0;
    const orbitA = baseAngle + (now * 0.001) + (ally.treadPhase * 0.05);
    // compute focus delta using shortest wrap-aware deltas if available
    let dx = focusX - ally.x; let dy = focusY - ally.y;
    if (window.wrapDeltaX) dx = window.wrapDeltaX(focusX, ally.x);
    if (window.wrapDeltaY) dy = window.wrapDeltaY(focusY, ally.y);
    const targetX = ally.x + dx + Math.cos(orbitA) * dist;
    const targetY = ally.y + dy + Math.sin(orbitA) * dist;

    // steering towards target
  // Scale max speed by player's current speedBoost so minis can keep up while sprinting
  const baseMax = ally.spd || 220;
  // allow ally speed to scale with player speed but enforce a higher baseline
  const maxSpeed = Math.max(40, (baseMax * (isFinite(playerSpeedBoost) ? playerSpeedBoost : 1.0)) );
    const maxAccel = 400; // world px/s^2 (increase accel for snappier response)
    const desiredVX = (targetX - ally.x);
    const desiredVY = (targetY - ally.y);
    // normalize desired to maxSpeed
    const len = Math.hypot(desiredVX, desiredVY) || 1;
    const ndx = (desiredVX / len) * maxSpeed;
    const ndy = (desiredVY / len) * maxSpeed;

    // acceleration to apply
    let ax = (ndx - ally.vx);
    let ay = (ndy - ally.vy);
    const alen = Math.hypot(ax, ay) || 1;
    if (alen > maxAccel) { ax = (ax / alen) * maxAccel; ay = (ay / alen) * maxAccel; }

    // integrate
    ally.vx += ax * dt;
    ally.vy += ay * dt;

    // damping
    ally.vx *= (1 - Math.min(0.25, dt * 0.5));
    ally.vy *= (1 - Math.min(0.25, dt * 0.5));

    // apply velocity to position with wrapping
    ally.x += ally.vx * dt;
    ally.y += ally.vy * dt;
    if (window.mod && Number.isFinite(window.WORLD_W)) ally.x = window.mod(ally.x, window.WORLD_W);
    if (window.mod && Number.isFinite(window.WORLD_H)) ally.y = window.mod(ally.y, window.WORLD_H);

    // face movement direction
    if (Math.hypot(ally.vx, ally.vy) > 0.5) ally.angle = Math.atan2(ally.vy, ally.vx);

    // small random turret jitter to look lively
    ally.turretAngle = (ally.angle || 0) + (Math.sin(now/400 + (ally.treadPhase*0.2)) * 0.25);
  
  // Minis: attempt to find nearby targets and shoot once per cooldown.
  // If no valid target is found, fire a short-range projectile forward occasionally so allies actively support the player.
  try{
    const target = findNearestAllyTarget(ally);
    if (target) {
      tryAllyFire(ally, target.x, target.y, now);
    } else {
      // Fallback: small chance to fire forward at player's facing direction to provide suppressed support
      try{
        // Only fire fallback when cooldown passed
        let cd = (typeof ally.shotCooldown === 'number') ? ally.shotCooldown : 1000;
        try{
          if (typeof window !== 'undefined' && Array.isArray(window.enemyBullets)){
            const active = window.enemyBullets.length;
            if (active > 150) cd *= 2.0; else if (active > 100) cd *= 1.5; else if (active > 70) cd *= 1.2;
          }
        }catch(_){ }
         if (now >= (ally.lastShot || 0) + cd) {
          // Aim roughly in the ally's turret direction
          const ang = ally.turretAngle || ally.angle || 0;
          const baseSpd = 320;
          const bx = ally.x + Math.cos(ang) * 26;
          const by = ally.y + Math.sin(ang) * 26;
          const proj = { x: bx, y: by, dx: Math.cos(ang) * baseSpd, dy: Math.sin(ang) * baseSpd, life: 2.6, hitR: 8, _src: { id: ally && ally.id ? ally.id : null, kind: ally && (ally.kind || ally.type) ? (ally.kind || ally.type) : 'ally', label: (ally && (ally.kind || ally.type)) ? (ally.kind || ally.type) : 'ally', x: ally.x, y: ally.y } };
          try{ proj._ignorePlayer = true; proj._fromAlly = true; proj.style = 'guardian-bolt'; proj.color = '#66e0ff'; }catch(_){ }
          try{
            if (Array.isArray(window.enemyBullets)) window.enemyBullets.push(proj);
            else if (typeof window.addEnemyBullet === 'function') window.addEnemyBullet(proj);
          }catch(_){ }
          ally.lastShot = now;
        }
      }catch(_){ }
    }
  }catch(_){ }
  }catch(_){ ally.vx = 0; ally.vy = 0; ally.angle = 0; }
}

function rotateToward(current, target, maxStep){
  let diff = ((target - current + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (diff > maxStep) diff = maxStep; else if (diff < -maxStep) diff = -maxStep;
  return current + diff;
}
// (Boid steering removed)


// --- Ally firing helpers --------------------------------------------------
// Find nearest valid target among critters, enemies, foliageInstances, buildingInstances
function findNearestAllyTarget(ally, maxRange = 800) {
  try{
    if (typeof window === 'undefined') return null;
    const lists = [];
    if (Array.isArray(window.critters)) lists.push(...window.critters);
    if (Array.isArray(window.enemies)) lists.push(...window.enemies);
    if (Array.isArray(window.foliageInstances)) lists.push(...window.foliageInstances);
    if (Array.isArray(window.buildingInstances)) lists.push(...window.buildingInstances);

    let best = null; let bestDist = Infinity;
    for (const t of lists) {
      if (!t || !Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
      // skip non-destructible foliage/buildings
      if (t.destructible === false) continue;
      // compute wrap-aware deltas if helpers exist
      let dx = t.x - ally.x; let dy = t.y - ally.y;
      if (window.wrapDeltaX) dx = window.wrapDeltaX(t.x, ally.x);
      if (window.wrapDeltaY) dy = window.wrapDeltaY(t.y, ally.y);
      const d = Math.hypot(dx, dy);
      if (d < bestDist && d <= maxRange) { bestDist = d; best = { src: t, x: t.x, y: t.y, d }; }
    }
    return best;
  }catch(_){ return null; }
}

// Attempt to fire a single projectile from ally at world targetX/targetY if cooldown allows
function tryAllyFire(ally, targetX, targetY, now) {
  try{
    if (!ally || typeof now !== 'number') return;
    let cd = (typeof ally.shotCooldown === 'number') ? ally.shotCooldown : 1000;
    try{
      if (typeof window !== 'undefined' && Array.isArray(window.enemyBullets)){
        const active = window.enemyBullets.length;
        if (active > 150) cd *= 2.0; else if (active > 100) cd *= 1.5; else if (active > 70) cd *= 1.2;
      }
    }catch(_){ }
    if (now < (ally.lastShot || 0) + cd) return; // still cooling down

    if (typeof window === 'undefined') return;
    const wrapX = window.wrapDeltaX ? window.wrapDeltaX(targetX, ally.x) : (targetX - ally.x);
    const wrapY = window.wrapDeltaY ? window.wrapDeltaY(targetY, ally.y) : (targetY - ally.y);
    const ang = Math.atan2(wrapY, wrapX);

    // bullet parameters - match engine enemyBullets shape
    // Increase bullet speed to improve hit reliability and add a simple linear lead
    const baseSpd = 320;
    // Predictive lead: if target has velocity, estimate time-to-hit and lead target linearly
    let aimX = targetX, aimY = targetY;
    try{
      // if target object provided as global lists, attempt to find a matching object near target coords
      // We only have coords here, but callers often pass the target object via findNearestAllyTarget which stores src
      // Try to find a target object with similar coordinates to derive vx/vy
      if (typeof window !== 'undefined' && Array.isArray(window.critters)){
        // cheap scan across known lists for an object at the same approximate position
        const lists = [];
        if (Array.isArray(window.critters)) lists.push(...window.critters);
        if (Array.isArray(window.enemies)) lists.push(...window.enemies);
        for (const t of lists){
          if (!t) continue;
          if (!Number.isFinite(t.x) || !Number.isFinite(t.y)) continue;
          const dx0 = Math.abs((t.x||0) - (targetX||0)); const dy0 = Math.abs((t.y||0) - (targetY||0));
          if (dx0 < 8 && dy0 < 8 && Number.isFinite(t.vx) && Number.isFinite(t.vy)){
            // estimate time-to-hit using distance / projectile speed
            const relX = t.x - ally.x; const relY = t.y - ally.y;
            const dist = Math.hypot(relX, relY) || 1;
            const tth = dist / baseSpd;
            aimX = t.x + (t.vx || 0) * tth;
            aimY = t.y + (t.vy || 0) * tth;
            break;
          }
        }
      }
    }catch(_){ }

    const wrapAimX = window.wrapDeltaX ? window.wrapDeltaX(aimX, ally.x) : (aimX - ally.x);
    const wrapAimY = window.wrapDeltaY ? window.wrapDeltaY(aimY, ally.y) : (aimY - ally.y);
    const angAim = Math.atan2(wrapAimY, wrapAimX);
    const spd = baseSpd;
    const bx = ally.x + Math.cos(angAim) * 26; // small muzzle offset
    const by = ally.y + Math.sin(angAim) * 26;
  const proj = { x: bx, y: by, dx: Math.cos(angAim) * spd, dy: Math.sin(angAim) * spd, life: 2.6, hitR: 8, _src: { id: ally && ally.id ? ally.id : null, kind: ally && (ally.kind || ally.type) ? (ally.kind || ally.type) : 'ally', label: (ally && (ally.kind || ally.type)) ? (ally.kind || ally.type) : 'ally', x: ally.x, y: ally.y } };
  // mark ally-fired projectiles so they can be ignored by player-collision logic
  try{ proj._ignorePlayer = true; proj._fromAlly = true; proj.style = 'guardian-bolt'; proj.color = '#66e0ff'; }catch(_){ }

    // push into enemyBullets safely (some modules export as window.enemyBullets)
    try{
      if (Array.isArray(window.enemyBullets)) window.enemyBullets.push(proj);
      else if (typeof window.addEnemyBullet === 'function') window.addEnemyBullet(proj);
    }catch(_){ }

    // Play shoot sound effect (same as player tank)
    try{ if (typeof window.SFX !== 'undefined' && typeof window.SFX.playShoot === 'function') window.SFX.playShoot(); }catch(_){ }

    // spawn muzzle flash if available
    try{ if (typeof window.spawnMuzzleFlash === 'function') window.spawnMuzzleFlash(bx, by, ang); }catch(_){ }

    ally.lastShot = now;
  }catch(_){ }
}

export function drawAllies() {
  if (typeof window === 'undefined' || !window.ctx || !window.camera) return;
  const ctx = window.ctx;
  const camera = window.camera;

  // Use the global canonical worldToScreen when available

  for (const ally of allies) {
  // allow wrapper objects to take full control of drawing when they supply a drawOverride
  try{ if (ally && typeof ally.drawOverride === 'function'){ try{ ally.drawOverride(window.ctx, window.worldToScreen, window.camera); continue; }catch(_){ } } }catch(_){ }
  const screenPos = (typeof window !== 'undefined' && window.worldToScreen) ? window.worldToScreen(ally.x, ally.y) : { x: (ally.x - camera.x) * camera.zoom + ((typeof window !== 'undefined' && window.W) ? window.W : 0)/2, y: (ally.y - camera.y) * camera.zoom + ((typeof window !== 'undefined' && window.H) ? window.H : 0)/2 };
  const drawX = screenPos.x;
  const drawY = screenPos.y;

  // no-op debug removed; rely on global debug instrumentation if needed

    // Calculate bump offset to match player
    let bumpOffsetY = 0;
    try {
      if (window.tank && window.tank.bumpTimer > 0) {
        const tnorm = 1 - window.tank.bumpTimer / window.tank.bumpDuration;
        const ease = Math.sin(tnorm * Math.PI);
        bumpOffsetY = -window.tank.bumpMag * ease;
      }
    } catch(_) {}
    const finalDrawY = drawY + bumpOffsetY;

  try {
      // Use the same draw scale calculation as player so zoom/scroll scaling matches exactly
      let bodyScale = (typeof getCanvasDrawScale === 'function' && window.bodyCanvas) ? getCanvasDrawScale(window.bodyCanvas) : (ally.scale * camera.zoom);
      let turretScale = (typeof getCanvasDrawScale === 'function' && window.turretCanvas) ? getCanvasDrawScale(window.turretCanvas) : (ally.scale * camera.zoom);

      // Draw body using player tank graphics, then tint using the ally palette body color
      try{
        ctx.save();
        ctx.translate(drawX, finalDrawY);
        ctx.rotate(ally.angle + Math.PI/2);
        ctx.scale(bodyScale, bodyScale);
        const bw = (window.bodyCanvas ? window.bodyCanvas.width : 32);
        const bh = (window.bodyCanvas ? window.bodyCanvas.height : 32);
        ctx.translate(- bw/2, - bh/2);
        ctx.imageSmoothingEnabled = false;
        if (window.bodyCanvas) {
          try {
            const pal = ally.color || { body: '#000000', accent: '#00ff00' };
            const bodyHex = pal.body || '#000000';
            const accHex = pal.accent || '#00ff00';
            const cacheKey = pal._paletteName || `${bodyHex}:${accHex}`;
            const recol = recolorSpriteCanvas(window.bodyCanvas, bodyHex, accHex, cacheKey);
            ctx.drawImage(recol, 0, 0);
          } catch (_) {
            try { ctx.drawImage(window.bodyCanvas, 0, 0); } catch(_){ }
          }
  }
  ctx.restore();
      }catch(_){ }

      // Draw turret using same draw scale as player, then tint using the ally accent color
      try{
        ctx.save();
        ctx.translate(drawX, finalDrawY);
        ctx.rotate(ally.turretAngle + Math.PI/2);
        ctx.scale(turretScale, turretScale);
        const tw = (window.turretCanvas ? window.turretCanvas.width : 32);
        const th = (window.turretCanvas ? window.turretCanvas.height : 32);
        ctx.translate(- tw/2, - th/2);
        ctx.imageSmoothingEnabled = false;
        if (window.turretCanvas) {
          try {
            const pal = ally.color || { body: '#000000', accent: '#00ff00' };
            const bodyHex = pal.body || '#000000';
            const accHex = pal.accent || '#00ff00';
            const cacheKey = pal._paletteName || `${bodyHex}:${accHex}`;
            const recolT = recolorSpriteCanvas(window.turretCanvas, bodyHex, accHex, cacheKey + ':turret');
            ctx.drawImage(recolT, 0, 0);
          } catch (_) {
            try { ctx.drawImage(window.turretCanvas, 0, 0); } catch(_){ }
          }
  }
  ctx.restore();
      }catch(_){ }

      // Draw dust effect
      if (ally.dust > 0) {
        ctx.save();
        ctx.globalAlpha = ally.dust * 0.6;
        ctx.fillStyle = '#8B7355';
        for (let i = 0; i < 3; i++) {
          const dustX = drawX + (Math.random() - 0.5) * 20;
          const dustY = finalDrawY + (Math.random() - 0.5) * 20;
          ctx.beginPath();
          ctx.arc(dustX, dustY, 2 * camera.zoom, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }

  // legacy halo removed: color is now applied directly to body and turret images

  } catch (e) { /* Silently ignore; no fallback square rendering to avoid beige placeholder */ }
  }

  // debug overlays removed
}
