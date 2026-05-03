// Tank module: handles tank state, effects, and explosion logic

// --- Tank state ---
// keep initial coordinates safe at module import time; will be initialized by host
export const tank = { x: 0, y: 0, bodyAngle: -Math.PI/2, turretAngle: 0, speed: 140, rotSpeed: Math.PI, alive: true };
// bump state: used to animate a small vertical/rotation "hit" when tank runs over objects
tank.bumpTime = 0;
tank.bumpDuration = 0;
tank.bumpMag = 0;
export const SPRITE_SCALE = 2;

// module-local asset/config placeholders (configured by host via configureTankAssets)
let _SPR_W = 16, _SPR_H = 16, _bodyCanvas = null, _turretCanvas = null;

// Default sprite baking inside tank module so host (`game.js`) doesn't need to own canvases
export const SPR_W = 16, SPR_H = 16;
// internal bake canvases (used unless host overrides via configureTankAssets)
const _internalBodyCanvas = document.createElement('canvas'); _internalBodyCanvas.width = SPR_W; _internalBodyCanvas.height = SPR_H; const _bctx = _internalBodyCanvas.getContext('2d');
const _internalTurretCanvas = document.createElement('canvas'); _internalTurretCanvas.width = SPR_W; _internalTurretCanvas.height = SPR_H; const _tctx = _internalTurretCanvas.getContext('2d');
try{ _bctx.imageSmoothingEnabled = false; }catch(_){ }
try{ _tctx.imageSmoothingEnabled = false; }catch(_){ }
// import gibs module when available (kept as a dynamic import target in host)
import { gibs as moduleGibs } from './gibs.js';
// Optional kitten variant sprite helpers (loaded asynchronously without blocking module evaluation)
let _drawKittenBody = null, _drawKittenTurret = null;
(function _loadKittenAsync(){
  try{
    // minimal async loader stub — when real async helpers exist they will set these
    _drawKittenBody = null;
    _drawKittenTurret = null;
  }catch(_){ }
})();
// Provide a global drawKittenTile fallback so humans.js maker can render immediately.
try{
  if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenTile !== 'function'){
    globalThis.drawKittenTile = function(g, t){ _fallbackDrawKittenBody(g, t); };
  }
}catch(_){ }

// Canonical kitten renderer attach helper - centralizes construction of body+turret canvases
// and attaches a robust draw() to the entity. Other modules should call this instead of
// duplicating renderer logic.
try{
  if (typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRendererCanonical !== 'function'){
  globalThis.attachKittenRendererCanonical = function(ent){
      try{
    if (!ent || typeof ent !== 'object') return false;
    // If another module already attached a canonical kitten renderer, keep it.
    try{ if (ent._kitten && ent._kitten._canonical) return true; }catch(_){ }
        const size = 64;
        // create body canvas
        const bodyC = document.createElement('canvas'); bodyC.width = size; bodyC.height = size; const bg = bodyC.getContext('2d'); try{ bg.imageSmoothingEnabled = false; }catch(_){ }
        // create turret canvas
        const turC = document.createElement('canvas'); turC.width = size; turC.height = size; const tg = turC.getContext('2d'); try{ tg.imageSmoothingEnabled = false; }catch(_){ }
        // Prefer global drawing helpers if present; otherwise use local fallback
        try{
          if (typeof globalThis.drawKittenBody === 'function') globalThis.drawKittenBody(bg, performance.now()); else _fallbackDrawKittenBody(bg, performance.now());
        }catch(_){ try{ _fallbackDrawKittenBody(bg); }catch(__){} }
        try{
          if (typeof globalThis.drawKittenTurret === 'function') globalThis.drawKittenTurret(tg, performance.now()); else _fallbackDrawKittenTurret(tg, performance.now());
        }catch(_){ try{ _fallbackDrawKittenTurret(tg); }catch(__){} }

        // full combined tile for UI/preview
        try{
          const full = document.createElement('canvas'); full.width = size; full.height = size; const fg = full.getContext('2d'); try{ fg.imageSmoothingEnabled = false; }catch(_){ }
          try{ fg.clearRect(0,0,size,size); fg.drawImage(bodyC,0,0); fg.drawImage(turC,0,0); }catch(_){ }
            // Only assign tile preview if not already present to avoid overwriting other modules'
            // prerendered tiles (alternativetanks.js is preferred as the canonical source).
            try{ 
              // Define own properties directly to avoid triggering prototype setters installed by debug watchers.
              try{ if (!Object.prototype.hasOwnProperty.call(ent, 'tileC') && !ent.tileC) Object.defineProperty(ent, 'tileC', { value: full, writable: true, configurable: true, enumerable: true }); }catch(_){ try{ if (!ent.tileC) ent.tileC = full; }catch(__){} }
              try{ if (!Object.prototype.hasOwnProperty.call(ent, 'tileG') && !ent.tileG) Object.defineProperty(ent, 'tileG', { value: fg, writable: true, configurable: true, enumerable: true }); }catch(_){ try{ if (!ent.tileG) ent.tileG = fg; }catch(__){} }
            }catch(_){ }
        }catch(_){ /* ignore */ }

  // attach canonical kit data but preserve any existing canvases (non-destructive)
  try{ 
    if (!Object.prototype.hasOwnProperty.call(ent, '_kitten') || !ent._kitten){
      try{ Object.defineProperty(ent, '_kitten', { value: { bodyC: bodyC, turC: turC, _canonical: true }, writable: true, configurable: true, enumerable: true }); }
      catch(_){ ent._kitten = { bodyC, turC, _canonical: true }; }
    } else {
      try{ ent._kitten.bodyC = ent._kitten.bodyC || bodyC; ent._kitten.turC = ent._kitten.turC || turC; ent._kitten._canonical = true; }catch(_){ }
    }
  }catch(_){ try{ ent._kitten = { bodyC, turC, _canonical: true }; }catch(__){} }

        // attach draw if missing or flagged as fallback
        try{
          const existing = ent.draw;
          let shouldReplace = false;
          if (typeof existing !== 'function') shouldReplace = true;
          else {
            try{ if (existing.__is_kitty_fallback || existing.toString().length < 120) shouldReplace = true; }catch(_){ }
          }
          if (shouldReplace){
            const drawFn = function(ctx, worldToScreen, camera){
              try{
                const ws = worldToScreen(ent.x, ent.y); const sx = ws.x, sy = ws.y;
                const z = (camera && camera.zoom) ? camera.zoom : 1;
                // determine body rotation: prefer velocity vector, else ent.angle, else keep previous
                try{
                  const vx = (typeof ent.vx === 'number') ? ent.vx : 0;
                  const vy = (typeof ent.vy === 'number') ? ent.vy : 0;
                  let bodyA = ent._kitten.bodyAngle || 0;
                  if (Math.abs(vx) > 0.01 || Math.abs(vy) > 0.01){
                    // sprite faces up initially, so add +PI/2 to face movement
                    bodyA = Math.atan2(vy, vx) + Math.PI/2;
                  } else if (typeof ent.angle === 'number') {
                    bodyA = ent.angle; // assume caller already applied +PI/2 if needed
                  }
                  ent._kitten.bodyAngle = bodyA;
                }catch(_){ }
                // shadow
                try{ drawShadow(sx, sy, ent._kitten.bodyC.width, z); }catch(_){ }
                // body
                try{ ctx.save(); ctx.translate(sx, sy); ctx.rotate(ent._kitten.bodyAngle || 0); ctx.scale(z,z); ctx.translate(-ent._kitten.bodyC.width/2, -ent._kitten.bodyC.height/2); ctx.drawImage(ent._kitten.bodyC,0,0); ctx.restore(); }catch(_){ }
                // turret faces turretAngle (already world-space; add PI/2 because art points up)
                try{ ctx.save(); ctx.translate(sx, sy); ctx.rotate((ent.turretAngle || 0) + Math.PI/2); ctx.scale(z,z); ctx.translate(-ent._kitten.turC.width/2, -ent._kitten.turC.height/2); ctx.drawImage(ent._kitten.turC,0,0); ctx.restore(); }catch(_){ }
              }catch(_){ }
            };
            try{ if (!Object.prototype.hasOwnProperty.call(ent, 'draw')) Object.defineProperty(ent, 'draw', { value: drawFn, writable: true, configurable: true, enumerable: true }); else ent.draw = drawFn; }catch(_){ try{ ent.draw = drawFn; }catch(__){} }
            try{ ent.draw.__is_kitty_fallback = false; }catch(_){ }
          }
        }catch(_){ }
        return true;
      }catch(_){ return false; }
    };
  }
}catch(_){ }

    // --- Kitten projectile renderer ------------------------------------------------
  // Provide a canonical renderer for kitty projectiles so legacy code in
  // `gameold.js` can call `globalThis.drawKittenProjectile(ctx, kb, sx, sy, camera, now)`
  // without requiring `gameold.js` to be modified. (former placeholder effect removed)
    // projectile with a small directional trail and a subtle pulse.
    try{
      if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenProjectile !== 'function'){
        globalThis.drawKittenProjectile = function(ctx, kb, sx, sy, camera, now){
          try{
            const z = (camera && camera.zoom) ? camera.zoom : 1;
            const t = (typeof now === 'number') ? now : ((typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now());
            // compute angle from velocity or stored angle
            let ang = 0; try{ ang = (typeof kb.dx === 'number' && typeof kb.dy === 'number' && (Math.abs(kb.dx) > 1e-6 || Math.abs(kb.dy) > 1e-6)) ? Math.atan2(kb.dy, kb.dx) : (typeof kb.a === 'number' ? kb.a : 0); }catch(_){ ang = (typeof kb.a === 'number') ? kb.a : 0; }
            // pulse scale for a bit of animation
            const phase = ((t - (kb.t0 || 0)) / 120) || 0;
            const pulse = 1 + 0.12 * Math.sin(phase * Math.PI * 2);
            const baseR = Math.max(1, 3 * z);

            // directional tail (subtle stretched ellipse)
            try{
              ctx.save();
              ctx.translate(sx, sy);
              ctx.rotate(ang);
              const tailLen = Math.max(6, 8 * z);
              const tailW = Math.max(1, 2 * z);
              const g = ctx.createLinearGradient(-tailLen, 0, 0, 0);
              g.addColorStop(0, 'rgba(255,120,220,0.0)');
              g.addColorStop(0.6, 'rgba(255,120,220,0.22)');
              g.addColorStop(1, 'rgba(255,120,220,0.45)');
              ctx.fillStyle = g;
              ctx.beginPath();
              ctx.ellipse(-tailLen * 0.45, 0, tailLen * 0.6, tailW, 0, 0, Math.PI * 2);
              ctx.fill();
              ctx.restore();
            }catch(_){ }

            // main glowing orb
            try{
              ctx.save();
              ctx.shadowBlur = 18 * z;
              ctx.shadowColor = 'rgba(255,120,220,0.95)';
              ctx.fillStyle = '#ff8bff';
              ctx.beginPath();
              ctx.arc(sx, sy, baseR * pulse, 0, Math.PI*2);
              ctx.fill();
              ctx.restore();
            }catch(_){ }

            // bright center highlight
            try{
              ctx.save(); ctx.globalAlpha = 0.9; ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(0.5, baseR * 0.45), 0, Math.PI*2); ctx.fill(); ctx.restore();
            }catch(_){ }
          }catch(_){ }
        };
      }
    }catch(_){ }

// exported live bindings so host can draw the baked canvases
export let bodyCanvas = _internalBodyCanvas;
export let turretCanvas = _internalTurretCanvas;

// simple palette used only for sprite baking (kept local)
const COLORS = { tread: '#222', treadLight: '#3a3a3a', barrel: '#161616', bolt: '#1a1a1a', shadow: 'rgba(0,0,0,0.25)'};
function randPalette(){ const h=90+Math.floor(Math.random()*40)-20; const s=35+Math.floor(Math.random()*25); const l1=28+Math.floor(Math.random()*8); const l2=l1+10; const l3=l2+8; return { hull:`hsl(${h} ${s}% ${l2}%)`, hullLight:`hsl(${h} ${s}% ${l3}%)`, turret:`hsl(${h} ${s+10}% ${l1}%)` }; }
let _palette = randPalette();

function _drawBodyUp(){ _bctx.clearRect(0,0,SPR_W,SPR_H);
  for (let y=1;y<=14;y++){ for (let x=1;x<=3;x++) _bctx.fillStyle=COLORS.tread, _bctx.fillRect(x,y,1,1); for (let x=12;x<=14;x++) _bctx.fillStyle=COLORS.tread, _bctx.fillRect(x,y,1,1); }
  for (let y=2;y<=14;y+=2){ _bctx.fillStyle=COLORS.treadLight; _bctx.fillRect(2,y,1,1); _bctx.fillRect(13,y,1,1); }
  for (let y=3;y<=12;y++){ for (let x=4;x<=11;x++){ _bctx.fillStyle=_palette.hull; _bctx.fillRect(x,y,1,1); } }
  for (let y=3;y<=6;y++){ for (let x=4;x<=7;x++){ _bctx.fillStyle=_palette.hullLight; _bctx.fillRect(x,y,1,1); } }
  _bctx.fillStyle = COLORS.bolt; _bctx.fillRect(4,3,1,1); _bctx.fillRect(11,3,1,1); _bctx.fillRect(4,12,1,1); _bctx.fillRect(11,12,1,1);
}
function _drawTurretUp(){ _tctx.clearRect(0,0,SPR_W,SPR_H); const cx=8,cy=8,r=3; for (let y=cy-r;y<=cy+r;y++){ for (let x=cx-r;x<=cx+r;x++){ const dx=x-cx, dy=y-cy; if (dx*dx+dy*dy <= r*r){ _tctx.fillStyle=_palette.turret; _tctx.fillRect(x,y,1,1); } } } _tctx.fillStyle=_palette.hullLight; _tctx.fillRect(cx-1,cy-1,2,2); for (let y=0;y<=3;y++){ _tctx.fillStyle=COLORS.barrel; _tctx.fillRect(cx-1,y,2,1); } _tctx.fillStyle=COLORS.treadLight; _tctx.fillRect(cx-1,0,2,1); }
function _redrawSprites(){ _drawBodyUp(); _drawTurretUp(); }
_redrawSprites();

// allow host to request a sprite re-bake (used by dev key shortcuts)
export function redrawSprites(){ _redrawSprites(); }

export function initTankPosition(worldW, worldH){ tank.x = worldW/2; tank.y = worldH/2; }

export function configureTankAssets({ SPR_W = 16, SPR_H = 16, bodyCanvas: bc = null, turretCanvas: tc = null, gibs = null } = {}){
  _SPR_W = SPR_W; _SPR_H = SPR_H;
  // prefer host-provided canvases when present, otherwise use internal baked canvases
  _bodyCanvas = bc || _internalBodyCanvas;
  _turretCanvas = tc || _internalTurretCanvas;
  // update exported live bindings so importers see the effective canvases
  bodyCanvas = _bodyCanvas;
  turretCanvas = _turretCanvas;
}

// Tank dust
export const tankDust = [];
export function spawnTankDust(x, y, count = 6) {
  for (let i = 0; i < count; i++) {
    const ang = (Math.random() * 0.6 - 0.3) + Math.PI;
    const sp = 60 + Math.random() * 80;
    const vx = Math.cos(ang) * sp;
    const vy = Math.sin(ang) * sp;
    tankDust.push({ x: x + (Math.random() - 0.5) * 6, y: y + (Math.random() - 0.5) * 6, vx, vy, life: 0.35 + Math.random() * 0.25, r: 2 + Math.random() * 3, alpha: 0.9 });
  }
}
export function updateTankDust(dt) {
  for (let i = tankDust.length - 1; i >= 0; i--) {
    const p = tankDust[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.88;
    p.vy *= 0.88;
    p.life -= dt;
    p.alpha -= dt * 2.0;
    if (p.life <= 0) tankDust.splice(i, 1);
  }
}

// bump API: trigger a short bump animation (mag in world pixels, dur in seconds)
export function triggerTankBump(mag = 6, dur = 0.18){
  tank.bumpMag = mag;
  tank.bumpDuration = Math.max(0.001, dur);
  tank.bumpTime = tank.bumpDuration;
}

export function updateTankBump(dt){
  if (tank.bumpTime > 0){
    tank.bumpTime = Math.max(0, tank.bumpTime - dt);
  }
}
export function drawTankDust(ctx, worldToScreen, camera) {
  ctx.save();
  for (const p of tankDust) {
    const ss = worldToScreen(p.x, p.y);
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    ctx.fillStyle = '#d9d9d0';
    const size = Math.max(1, Math.round(p.r * camera.zoom));
    ctx.beginPath();
    ctx.ellipse(ss.x, ss.y, size, size * 0.6, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

// Tank explosion pieces
export const tankPieces = [];
export function tankLocalToWorld(lx, ly, baseAng) {
  const s = SPRITE_SCALE;
  const rx = Math.cos(baseAng) * lx * s - Math.sin(baseAng) * ly * s;
  const ry = Math.sin(baseAng) * lx * s + Math.cos(baseAng) * ly * s;
  return { x: tank.x + rx, y: tank.y + ry };
}
export function tankPieceDefs() {
  // use configured canvases supplied by configureTankAssets
  const bodyCanvas = _bodyCanvas, turretCanvas = _turretCanvas;
  return [
    { src: bodyCanvas, sx: 1, sy: 1, sw: 3, sh: 14, base: 'body' },
    { src: bodyCanvas, sx: 12, sy: 1, sw: 3, sh: 14, base: 'body' },
    { src: bodyCanvas, sx: 4, sy: 3, sw: 8, sh: 3, base: 'body' },
    { src: bodyCanvas, sx: 4, sy: 6, sw: 8, sh: 4, base: 'body' },
    { src: bodyCanvas, sx: 4, sy: 10, sw: 8, sh: 3, base: 'body' },
    { src: bodyCanvas, sx: 4, sy: 3, sw: 1, sh: 1, base: 'body' },
    { src: bodyCanvas, sx: 11, sy: 3, sw: 1, sh: 1, base: 'body' },
    { src: bodyCanvas, sx: 4, sy: 12, sw: 1, sh: 1, base: 'body' },
    { src: bodyCanvas, sx: 11, sy: 12, sw: 1, sh: 1, base: 'body' },
    { src: turretCanvas, sx: 5, sy: 5, sw: 6, sh: 6, base: 'turret' },
    { src: turretCanvas, sx: 7, sy: 0, sw: 2, sh: 4, base: 'turret', barrel: true }
  ];
}
export function spawnTankPiece(def, baseAng, impulseBias = 0) {
  const cx = def.sx + def.sw / 2, cy = def.sy + def.sh / 2;
  const lx = cx - _SPR_W / 2, ly = cy - _SPR_H / 2;
  const start = tankLocalToWorld(lx, ly, baseAng);
  const dir = Math.atan2(start.y - tank.y, start.x - tank.x);
  const speed = 80 + Math.random() * 120 + impulseBias;
  const vx = Math.cos(dir) * speed + (Math.random() - 0.5) * 60;
  const vy = Math.sin(dir) * speed + (Math.random() - 0.5) * 60;
  tankPieces.push({ src: def.src, sx: def.sx, sy: def.sy, sw: def.sw, sh: def.sh, x: start.x, y: start.y, vx, vy, rot: baseAng + (Math.random() - 0.5) * 0.5, vr: (Math.random() - 0.5) * 6, life: 1.8 + Math.random() * 1.0, gravity: 90 });
}

// Tank sparks and smoke
export const tankSparks = [];
export const tankSmoke = [];
export function addTankSpark(x, y, vx, vy) {
  tankSparks.push({ x, y, vx: vx * 1.1, vy: vy * 1.1, life: 0.12 + Math.random() * 0.13 });
}
export function addTankSmoke(x, y) {
  tankSmoke.push({ x, y, r: 3 + Math.random() * 4, a: 0.9, vr: 6 + Math.random() * 8, va: -0.6, vy: - (12 + Math.random() * 12) });
}
export function spawnTankPieceWithFX(def, baseAng, impulseBias = 0) {
  const cx = def.sx + def.sw / 2, cy = def.sy + def.sh / 2;
  const lx = cx - _SPR_W / 2, ly = cy - _SPR_H / 2;
  const start = tankLocalToWorld(lx, ly, baseAng);
  const dir = Math.atan2(start.y - tank.y, start.x - tank.x);
  const speed = 80 + Math.random() * 120 + impulseBias;
  const vx = Math.cos(dir) * speed + (Math.random() - 0.5) * 60;
  const vy = Math.sin(dir) * speed + (Math.random() - 0.5) * 60;
  tankPieces.push({ src: def.src, sx: def.sx, sy: def.sy, sw: def.sw, sh: def.sh, x: start.x, y: start.y, vx, vy, rot: baseAng + (Math.random() - 0.5) * 0.5, vr: (Math.random() - 0.5) * 6, life: 1.8 + Math.random() * 1.0, gravity: 90 });
  addTankSpark(start.x, start.y, vx, vy);
  if (Math.random() < 0.6) addTankSmoke(start.x, start.y);
}
export function spawnTiny(x, y, vx, vy) {
  // push an image-fragment gib (tank body pixel) into shared gibs array
  if (moduleGibs) moduleGibs.push({ src: _bodyCanvas, sx: 4, sy: 6, sw: 1, sh: 1, x, y, vx, vy, rot: 0, vr: 0, life: 0.4 + Math.random() * 0.5, gravity: 120, scale: SPRITE_SCALE });
  addTankSpark(x, y, vx, vy);
}
export function explodeTank(updateHud, center, score) {
  if (!tank) return;
  try{ if (typeof window !== 'undefined' && window.stopAllAudioAndShake) window.stopAllAudioAndShake(); }catch(_){ }
  tank.alive = false;
  tank.shotCount = 0;
  tank.powerupUntil = 0;
  if (typeof updateHud === 'function') updateHud();
  if (center) {
    center.style.display = 'block';
  center.innerHTML = `${(window.t ? window.t('you_died') : 'YOU DIED')}<br/>${(window.t ? window.t('score') : 'Score')}: ${score}<br/>${(window.t ? window.t('press_r_restart') : 'Press R to restart')}`;
  }
  const defs = tankPieceDefs();
  defs.forEach(d => {
    const baseAng = (d.base === 'body') ? (tank.bodyAngle + Math.PI / 2) : (tank.turretAngle + Math.PI / 2);
    const impulse = d.barrel ? 180 : 0;
    spawnTankPieceWithFX(d, baseAng, impulse);
  });
  for (let i = 0; i < 12; i++) {
    const ang = Math.random() * Math.PI * 2;
    const spd = 120 + Math.random() * 100;
    spawnTiny(tank.x, tank.y, Math.cos(ang) * spd, Math.sin(ang) * spd);
  }
}
export function updateTankPieces(dt) {
  for (let i = tankPieces.length - 1; i >= 0; i--) {
    const p = tankPieces[i];
    p.vy += p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.rot += p.vr * dt;
    p.life -= dt;
    if (p.life <= 0) tankPieces.splice(i, 1);
  }
}
export function drawTankPieces(ctx, worldToScreen, camera) {
  for (const p of tankPieces) {
    const ss = worldToScreen(p.x, p.y);
    ctx.save();
    ctx.translate(ss.x, ss.y);
    ctx.rotate(p.rot);
    const scale = SPRITE_SCALE * camera.zoom;
    ctx.scale(scale, scale);
    ctx.translate(-p.sw / 2, -p.sh / 2);
    ctx.drawImage(p.src, p.sx, p.sy, p.sw, p.sh, 0, 0, p.sw, p.sh);
    ctx.restore();
  }
}
export function updateTankSparks(dt) {
  for (let i = tankSparks.length - 1; i >= 0; i--) {
    const s = tankSparks[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.vx *= 0.96;
    s.vy *= 0.96;
    s.life -= dt;
    if (s.life <= 0) tankSparks.splice(i, 1);
  }
}
export function drawTankSparks(ctx, worldToScreen, camera) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  for (const s of tankSparks) {
    const ss = worldToScreen(s.x, s.y);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(Math.round(ss.x), Math.round(ss.y), Math.max(1, Math.round(2 * camera.zoom)), Math.max(1, Math.round(2 * camera.zoom)));
  }
  ctx.restore();
}
export function updateTankSmoke(dt) {
  for (let i = tankSmoke.length - 1; i >= 0; i--) {
    const p = tankSmoke[i];
    p.y += p.vy * dt;
    p.r += p.vr * dt;
    p.a += p.va * dt;
    if (p.a <= 0 || p.r > 28) tankSmoke.splice(i, 1);
  }
}
export function drawTankSmoke(ctx, worldToScreen, camera) {
  ctx.save();
  for (const p of tankSmoke) {
    const ss = worldToScreen(p.x, p.y);
    const grd = ctx.createRadialGradient(ss.x, ss.y, 1, ss.x, ss.y, p.r * camera.zoom);
    grd.addColorStop(0, `rgba(40,40,40,${Math.max(0, Math.min(1, p.a))})`);
    grd.addColorStop(1, `rgba(40,40,40,0)`);
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(ss.x, ss.y, p.r * camera.zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

// --- MIGRATION CHUNK 1 ------------------------------------------------------
// Movement + aim logic extracted from game.js (original code retained there but disabled)
// This function intentionally receives all external helpers/values as params so the
// tank module stays decoupled from the monolithic game.js globals while we migrate.
// It mutates the exported `tank` object (position, angles, powerup timers) and uses
// SFX state for shift boost audio just like the original inline block.
// params: {
//   dt, keys, mouseWorldX, mouseWorldY,
//   WORLD_W, WORLD_H, clamp, mod,
//   camera, SFX, _sfxState, spawnTankDust,
//   effectiveTankScale, SPR_W, bodyCanvas,
//   selectedVehicleVariant
// }
export function updateTankMovementAndAim(params = {}){
  try{
    const {
      dt = 0,
      keys = new Set(),
      mouseWorldX = tank.x,
      mouseWorldY = tank.y,
      WORLD_W = 0,
      WORLD_H = 0,
      clamp = (v,min,max)=>Math.max(min, Math.min(max,v)),
      mod = (n,m)=>((n % m) + m) % m,
      camera = { zoom:1 },
      SFX = null,
      _sfxState = { shiftActive:false },
      spawnTankDust = ()=>{},
      effectiveTankScale = ()=>SPRITE_SCALE,
      SPR_W = 16,
      bodyCanvas = null,
      selectedVehicleVariant = 'default'
    } = params;

  // rotation
  const turn = (keys.has('a') ? -1 : 0) + (keys.has('d') ? 1 : 0);
  tank.bodyAngle += turn * (tank.rotSpeed || Math.PI) * dt;

    // forward / backward
    const forward = (keys.has('w') ? 1 : 0) + (keys.has('s') ? -1 : 0);

  // Internal diagnostic: log computed movement values when keys are active (rate-limited)
  // movement diagnostics removed for quieter console in normal runs

    // shift boost (Fiesta special-case) mirrors legacy logic
    const nowShift = keys.has('shift');
    let speedBoost = nowShift ? 1.3 : 1.0;
    if (nowShift && selectedVehicleVariant === 'fordfiesta'){
      speedBoost = 2.8;
    }

    // SFX start/stop for shift hum
    try{
      if (nowShift && !_sfxState.shiftActive){ _sfxState.shiftActive = true; if (SFX && typeof SFX.startShift === 'function') SFX.startShift(); }
      else if (!nowShift && _sfxState.shiftActive){ _sfxState.shiftActive = false; if (SFX && typeof SFX.stopShift === 'function') SFX.stopShift(); }
    }catch(_){ }

    if (forward !== 0){
      // compute deltas separately so we can instrument whether they are non-zero
  const dx = Math.cos(tank.bodyAngle) * tank.speed * speedBoost * forward * dt;
  const dy = Math.sin(tank.bodyAngle) * tank.speed * speedBoost * forward * dt;
  tank.x += dx;
  tank.y += dy;
      if (speedBoost > 1.01){
        tank._dustTimer = (tank._dustTimer || 0) - dt;
        if (tank._dustTimer <= 0){
          spawnTankDust(
            tank.x - Math.cos(tank.bodyAngle)*8,
            tank.y - Math.sin(tank.bodyAngle)*8,
            6
          );
          tank._dustTimer = 0.08;
        }
      }
    }

    // clamp horizontally (uses body canvas width when available for variant scaling)
    try{
      const spriteW = (bodyCanvas && bodyCanvas.width) ? bodyCanvas.width : SPR_W;
      tank.x = clamp(tank.x, spriteW * effectiveTankScale() * 0.5, WORLD_W - spriteW * effectiveTankScale() * 0.5);
    }catch(_){
      tank.x = clamp(tank.x, SPR_W * effectiveTankScale() * 0.5, WORLD_W - SPR_W * effectiveTankScale() * 0.5);
    }

    // wrap world
    tank.x = mod(tank.x, WORLD_W);
    tank.y = mod(tank.y, WORLD_H);

    // turret aim toward mouse
    const dx = mouseWorldX - tank.x;
    let dy = mouseWorldY - tank.y;
    // vertical wrap-aware delta (assume WORLD_H ring)
    if (dy > WORLD_H/2) dy -= WORLD_H; else if (dy < -WORLD_H/2) dy += WORLD_H;
    tank.turretAngle = Math.atan2(dy, dx);
    // For certain variants (kraken, squid) we want a unified body+turret look (no independent rotation)
    try{
  if (selectedVehicleVariant === 'kraken'){
        tank.turretAngle = tank.bodyAngle; // lock turret to body to avoid split appearance
      }
    }catch(_){ }
  }catch(err){
    try{ console.warn('updateTankMovementAndAim failed', err); }catch(_){ }
  }
}

// --- MIGRATION CHUNK 2 ------------------------------------------------------
// Variant sprite builders for special tank types that were previously scattered
// (kitten prototype in alternativetanks.js, kraken / squid experimental code).
// Goal: centralize variant canvas generation inside tank module without
// removing legacy prototype code elsewhere (those remain commented in host if needed).

// Registry of lazily-built variant asset generators. Each returns an object:
// { bodyCanvas, turretCanvas, SPR_W, SPR_H }
const _variantBuilders = {
  // "kitten" builder (aliased to kittytank below)
  kitten: () => {
    // Build from procedural kitten drawing helpers if available; fallback to default sprites.
    const size = 64;
    const bodyC = document.createElement('canvas'); bodyC.width = size; bodyC.height = size; const bg = bodyC.getContext('2d'); bg.imageSmoothingEnabled = false;
    const turretC = document.createElement('canvas'); turretC.width = size; turretC.height = size; const tg = turretC.getContext('2d'); tg.imageSmoothingEnabled = false;
    try{
      if (_drawKittenBody) _drawKittenBody(bg, performance.now()); else _fallbackDrawKittenBody(bg, performance.now());
      if (_drawKittenTurret) _drawKittenTurret(tg, performance.now()); else _fallbackDrawKittenTurret(tg, performance.now());
    }catch(err){ console.warn('kitten variant build failed, using fallback', err); _fallbackDrawKittenBody(bg); _fallbackDrawKittenTurret(tg); }
    return { bodyCanvas: bodyC, turretCanvas: turretC, SPR_W: size, SPR_H: size };
  },
  kraken: () => {
    // Unified animated kraken (body + barrel + eyes + tentacles) adapted from legacy gameold.js.
    // The turret canvas is left transparent; body contains full composite so rotation is unified.
    const size = 64; const bodyC = document.createElement('canvas'); bodyC.width=size; bodyC.height=size; const g = bodyC.getContext('2d'); g.imageSmoothingEnabled=false;
    const turretC = document.createElement('canvas'); turretC.width=size; turretC.height=size; const tg = turretC.getContext('2d'); tg.imageSmoothingEnabled=false; // stays empty
    // Build procedural frames unless external ASSETS.kraken supplied (then we keep that static)
    const external = (typeof ASSETS !== 'undefined' && ASSETS && ASSETS.kraken) ? ASSETS.kraken : null;
    let frames = []; const FRAMES = 6;
    function px(ctx,x,y,col){ ctx.fillStyle = col; ctx.fillRect(x|0,y|0,1,1); }
    function disc(ctx,cx,cy,r,col){ for(let yy=-r; yy<=r; yy++){ const span=Math.floor(Math.sqrt(r*r-yy*yy)); for(let xx=-span; xx<=span; xx++) px(ctx,cx+xx,cy+yy,col); } }
    function barrel(ctx,cx,cy,angle,len,col){ for(let i=0;i<len;i++){ const x=Math.round(cx+Math.cos(angle)*(6+i)); const y=Math.round(cy+Math.sin(angle)*(6+i)); px(ctx,x,y,col); if(i<2){ px(ctx,x+1,y,col); px(ctx,x,y+1,col); } } }
    function tentacle(ctx,cx,cy,baseAngle,tPhase,bodyRadius,frame){ const segs=9; for(let s=0;s<segs;s++){ const progress=s/(segs-1); const throb=Math.sin((frame + s*0.6 + tPhase) * 0.9); const bend=0.35*throb*(0.3+0.7*progress); const a=baseAngle + bend; const dist=bodyRadius+1+s*3; const x=Math.round(cx + Math.cos(a)*dist); const y=Math.round(cy + Math.sin(a)*dist); const sizeSeg=(s<2)?3:(s<5?2:1); const col=(s<2)?'#4f6a6d':(s<5?'#2f4f4f':'#0a2a2f'); for(let dy=0;dy<sizeSeg;dy++){ for(let dx=0;dx<sizeSeg;dx++){ px(ctx,x+dx-(sizeSeg>>1),y+dy-(sizeSeg>>1),col); } } if(sizeSeg>=2 && (s%2===0)){ const hx=Math.round(x+Math.cos(a+Math.PI/2)); const hy=Math.round(y+Math.sin(a+Math.PI/2)); px(ctx,hx,hy,'#b0c7c9'); } } }
    if (!external){
      for(let fi=0; fi<FRAMES; fi++){
        const c=document.createElement('canvas'); c.width=size; c.height=size; const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; ctx.clearRect(0,0,size,size);
        const cx = size/2|0, cy = size/2|0; // center
        disc(ctx,cx,cy,14,'#2f4f4f'); disc(ctx,cx+1,cy+2,13,'#4f6a6d'); disc(ctx,cx,cy,11,'#0a2a2f'); disc(ctx,cx-1,cy-2,9,'#4f6a6d'); disc(ctx,cx-2,cy-3,7,'#b0c7c9');
        // rim light
        for(let y=-14;y<=14;y++){ const span=Math.floor(Math.sqrt(14*14 - y*y)); for(let x=-span;x<=span;x++){ const rr=x*x+y*y; if(rr<=14*14 && rr>=14*14-18 && (x+y)<-4) px(ctx,cx+x,cy+y,'#8fe3f7'); } }
        // turret dome + barrel integrated
        disc(ctx,cx,cy,6,'#0b0d0e'); disc(ctx,cx,cy,4,'#0a2a2f'); for(let a=0;a<6;a++) px(ctx,cx-2 + a%3, cy -3 + (a/3|0), '#b0c7c9');
        const angle = 0; barrel(ctx,cx,cy,angle,7,'#0b0d0e');
        // eyes pulse
        const forward=angle; const perp=forward+Math.PI/2; const eyeDist=10; const eyeSpread=3; const pulse=(fi%6)<3?'#ff1e2d':'#ff7a00';
        const ex1=Math.round(cx+Math.cos(forward)*eyeDist + Math.cos(perp)*eyeSpread);
        const ey1=Math.round(cy+Math.sin(forward)*eyeDist + Math.sin(perp)*eyeSpread);
        const ex2=Math.round(cx+Math.cos(forward)*eyeDist - Math.cos(perp)*eyeSpread);
        const ey2=Math.round(cy+Math.sin(forward)*eyeDist - Math.sin(perp)*eyeSpread);
        [[ex1,ey1],[ex2,ey2]].forEach(([x,y])=>{ px(ctx,x,y,pulse); px(ctx,x+1,y,pulse); px(ctx,x,y+1,pulse); px(ctx,x+1,y+1,pulse); px(ctx,x,y-1,'#0b0d0e'); px(ctx,x+1,y-1,'#0b0d0e'); });
        const baseR=14; for(let k=0;k<8;k++){ tentacle(ctx,cx,cy,k*(Math.PI/4), k*0.7, baseR, fi); }
        // glacis wedge
        for(let i=0;i<6;i++){ const a=angle; const r=baseR-2+i; const x=Math.round(cx+Math.cos(a)*r); const y=Math.round(cy+Math.sin(a)*r); px(ctx,x,y,'#4f6a6d'); if(i<4) px(ctx, x+Math.round(Math.cos(a+Math.PI/2)), y+Math.round(Math.sin(a+Math.PI/2)),'#4f6a6d'); }
        frames.push(c);
      }
    }
    // Animation loop writes current frame to body canvas (unless external asset)
    function renderFrame(){
      try{
        if (external){ // static external asset
          if (!bodyC._krakenExternalDrawn){
            bodyC._krakenExternalDrawn = true;
            g.clearRect(0,0,size,size);
            const scale = Math.floor((size * 0.92) / Math.max(1, external.width));
            const dw = external.width * scale, dh = external.height * scale; const dx = Math.round((size-dw)/2); const dy = Math.round((size-dh)/2 + 2);
            g.drawImage(external,0,0, external.width, external.height, dx, dy, dw, dh);
          }
        } else if (frames.length){
          const now = performance.now(); const idx = Math.floor((now/120) % frames.length);
            if (bodyC._krakenLast !== idx){
              bodyC._krakenLast = idx;
              g.clearRect(0,0,size,size); g.drawImage(frames[idx],0,0);
            }
        }
      }catch(err){ /* ignore */ }
      bodyC._krakenRAF = requestAnimationFrame(renderFrame);
    }
    try{ renderFrame(); }catch(_){ }
    return { bodyCanvas: bodyC, turretCanvas: turretC, SPR_W: size, SPR_H: size };
  },
  squid: () => {
    // Animated squidrobot (12-frame body + independent rotating turret) adapted from legacy gameold.js.
    const size = 64; const bodyC = document.createElement('canvas'); bodyC.width=size; bodyC.height=size; const g = bodyC.getContext('2d'); g.imageSmoothingEnabled=false;
    const turretC = document.createElement('canvas'); turretC.width=size; turretC.height=size; const tg = turretC.getContext('2d'); tg.imageSmoothingEnabled=false;
    const FRAMES = 12; const frames = []; const bobs = [];
    function px(ctx,x,y,col,t=1){ ctx.fillStyle=col; ctx.fillRect(x|0,y|0,t,t); }
    function line(ctx,x0,y0,x1,y1,col,t=1){ x0|=0; y0|=0; x1|=0; y1|=0; let dx=Math.abs(x1-x0), sx=x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy; while(true){ px(ctx,x0,y0,col,t); if(x0===x1 && y0===y1) break; const e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    function circleFill(ctx,cx,cy,r,col){ ctx.fillStyle=col; for(let y=-r;y<=r;y++){ const w=Math.floor(Math.sqrt(r*r - y*y)); ctx.fillRect(cx-w, cy+y, 2*w+1,1); } }
    function rimLightArc(ctx,cx,cy,r,col){ ctx.fillStyle=col; for(let a=-0.2;a<=0.9;a+=0.05){ const x=Math.round(cx+Math.cos(a)*r); const y=Math.round(cy+Math.sin(a)*r); ctx.fillRect(x,y,1,1); if (Math.random()<0.3) ctx.fillRect(x,y-1,1,1); } }
    function leg(ctx,cx,cy,baseAngle,phase){ const L1=7,L2=6; const swing=Math.sin(phase)*2.0; const lift=Math.cos(phase*0.5)*1.0; const bodyR=12; const bx=cx+Math.cos(baseAngle)*(bodyR-1); const by=cy+Math.sin(baseAngle)*(bodyR-1); const kx=bx+Math.cos(baseAngle)*(L1+swing*0.4); const ky=by+Math.sin(baseAngle)*(L1+swing*0.4)-lift; const fx=kx+Math.cos(baseAngle)*(L2+swing); const fy=ky+Math.sin(baseAngle)*(L2+swing)+lift*0.25; line(ctx,bx,by,kx,ky,'#1e2430',2); line(ctx,kx,ky,fx,fy,'#5e7389',1); px(ctx,fx,fy,'#5e7389',2); }
    function shadow(ctx){ ctx.save(); ctx.globalAlpha=0.25; ctx.fillStyle='#000'; const rx=20, ry=7, cy=size*0.78+10; for(let y=-ry;y<=ry;y++){ const w=Math.floor(Math.sqrt(1 - (y*y)/(ry*ry))*rx); ctx.fillRect(size/2 - w, cy + y, 2*w+1,1); } ctx.restore(); }
    for (let fi=0; fi<FRAMES; fi++){
      const c=document.createElement('canvas'); c.width=size; c.height=size; const ctx=c.getContext('2d'); ctx.imageSmoothingEnabled=false; const t=fi/FRAMES; const bob=Math.round(Math.sin(t*Math.PI*2)*1);
      shadow(ctx);
      for(let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; const phase=(t*Math.PI*2)+(i%2?Math.PI:0); leg(ctx,size/2,size*0.78 + bob,a,phase); }
  // legacy 3-disc body (scaled to 64 canvas)
  circleFill(ctx,size/2,size*0.78 + bob,24,'#11141a');
  circleFill(ctx,size/2,size*0.78 + bob,22,'#1e2430');
  circleFill(ctx,size/2,size*0.78 + bob,18,'#2b3445');
  rimLightArc(ctx,size/2-4,size*0.78-4 + bob,20,'#5e7389');
      frames.push(c); bobs.push(bob);
    }
    // Turret draw each frame based on desired angle; leave base turret canvas blank and rely on draw phase to rotate body? Here we render static center; rotation handled elsewhere if needed.
    function drawTurret(angle){
      tg.clearRect(0,0,size,size);
      const cx=size/2, cy=size*0.78 - 2;
  // enlarged turret (matches characters.js squidrobot turret)
  circleFill(tg,cx,cy,6,'#1e2430');
  circleFill(tg,cx,cy,5,'#2b3445');
  px(tg,cx-1,cy-3,'#5e7389',2);
  for(let k=0;k<6;k++){ const aa=angle + (k/6)*Math.PI*2; const bx=Math.round(cx+Math.cos(aa)*4); const by=Math.round(cy+Math.sin(aa)*4); px(tg,bx,by,'#8fb4cf'); }
  const dx=Math.cos(angle), dy=Math.sin(angle); for(let s=2;s<=14;s++){ const x=Math.round(cx+dx*s); const y=Math.round(cy+dy*s); px(tg,x,y,'#5e7389',2); if (s%3===0) px(tg,x,y,'#5e7389',2); }
  const sightX=Math.round(cx + Math.cos(angle)*8 - Math.sin(angle)*2); const sightY=Math.round(cy + Math.sin(angle)*8 + Math.cos(angle)*2); px(tg,sightX,sightY,'#c9d1d9');
    }
    // Simple animation loop for body frames
    function animate(){ try{ const idx=Math.floor((performance.now()/100)%frames.length); if (bodyC._last!==idx){ bodyC._last=idx; g.clearRect(0,0,size,size); g.drawImage(frames[idx],0,0); } }catch(_){ } bodyC._squidRAF=requestAnimationFrame(animate); }
    try{ animate(); }catch(_){ }
    // Initialize turret with forward angle 0
    try{ drawTurret(0); }catch(_){ }
    return { bodyCanvas: bodyC, turretCanvas: turretC, SPR_W: size, SPR_H: size };
  }
};
// Alias kittytank -> kitten so either name works throughout the codebase
try{ if (!_variantBuilders.kittytank) _variantBuilders.kittytank = _variantBuilders.kitten; }catch(_){ }

// Exported API to configure a special variant. Returns true if applied.
export function configureTankVariant(variant){
  try{
    const v = (variant||'').toLowerCase();
    if (!_variantBuilders[v]) return false;
    const built = _variantBuilders[v]();
    if (!built) return false;
    configureTankAssets({ SPR_W: built.SPR_W, SPR_H: built.SPR_H, bodyCanvas: built.bodyCanvas, turretCanvas: built.turretCanvas });
    try{ redrawSprites(); }catch(_){ }
    return true;
  }catch(err){ console.warn('configureTankVariant failed', err); return false; }
}

