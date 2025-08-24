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
