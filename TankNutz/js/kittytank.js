// Kitty Tank module: canonical implementation.
// Exposes helpers to spawn kitty tank enemies and ensure correct renderer,
// turret, and projectile visuals are attached. Legacy placeholder identifiers
// have been fully removed from active code.

// Public API (minimal):
//  - spawnKittyTank(x,y, opts?) -> entity pushed into provided enemies array
//  - attachKittyIfNeeded(ent)   -> upgrades an existing entity to full kitty visuals
//  - normalizeKittyKind(ent)    -> rewrites legacy kind strings to 'kittytank'
//  - buildKittyProjectile(b)    -> ensures projectile has kitty visual metadata

// This module deliberately depends only on global helpers that already exist
// in the runtime (drawShadow, worldToScreen, etc.) and the canonical renderer
// installed by tank.js (attachKittenRendererCanonical) or its fallback
// (attachKittyFallback/attachKittenRenderer).

/* eslint-disable no-console */

// ----------------------------------------------------------------------------
// Original Pixel Art Kitty Tank (body + turret) adapted from legacy variant
// ----------------------------------------------------------------------------

function pixelKittyBody(g, t){
  try{
    const W = g.canvas.width || 48; const H = g.canvas.height || 48; const now = (typeof t === 'number') ? t : performance.now(); const frame = Math.floor(now / 120) & 0xff;
    const C = { t:'#1d222c', h:'#2c3544', d:'#232a36', k:'#3b485a', K:'#5a6a80', b:'#9ecaff', s:'#141820' };
    const s = Math.max(1, Math.min(4, W / 64));
    const px = (x,y,col,w=1,h=1)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(w*s), Math.round(h*s)); };
    const rect = (x,y,wid,hei,col)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(wid*s), Math.round(hei*s)); };
    const circleFill = (cx,cy,r,col)=>{ const r2=r*r; for(let yy=(cy-r)|0; yy<=(cy+r)|0; yy++){ for(let xx=(cx-r)|0; xx<=(cx+r)|0; xx++){ const dx=xx-cx, dy=yy-cy; if(dx*dx+dy*dy<=r2) px(xx,yy,col); } } };
    const triFill = (x1,y1,x2,y2,x3,y3,col)=>{ g.fillStyle = col; g.beginPath(); g.moveTo(Math.round(x1*s)+0.5, Math.round(y1*s)+0.5); g.lineTo(Math.round(x2*s)+0.5, Math.round(y2*s)+0.5); g.lineTo(Math.round(x3*s)+0.5, Math.round(y3*s)+0.5); g.closePath(); g.fill(); };
    g.clearRect(0,0,W,H);
    const offset = frame % 4;
    // treads
    rect(6,16,8,32,C.t); rect(50,16,8,32,C.t);
    for(let y=16;y<48;y++) if(((y+offset)%4)===0){ px(7,y,C.h); px(9,y,C.h); px(11,y,C.h); px(51,y,C.h); px(53,y,C.h); px(55,y,C.h); }
    // hull
    rect(14,18,36,28,C.k); rect(14,18,36,2,C.K); rect(14,44,36,2,C.d); triFill(18,18,32,14,46,18,C.k); rect(18,36,28,6,C.d);
    for(let x=20;x<46;x+=3) px(x,38,C.K);
    circleFill(32,30,8,C.k); circleFill(32,30,7,C.d);
    for(let a=0;a<360;a+=30){ const rad=a*Math.PI/180; const x=32+Math.cos(rad)*6, y=30+Math.sin(rad)*6; px(Math.round(x), Math.round(y), C.K); }
    // rim/details
    for(let x=18;x<46;x+=2) px(x,18,C.b);
    for(let y=20;y<44;y+=3) px(48,y,C.b);
    [[18,22],[46,22],[18,42],[46,42]].forEach(([x,y])=>{ px(x,y,C.d); px(x+1,y,C.K); });
    return true;
  }catch(_){ return false; }
}

function pixelKittyTurret(g, t){
  try{
    const W = g.canvas.width || 48; const H = g.canvas.height || 48; const now = (typeof t === 'number') ? t : performance.now(); const frame = Math.floor(now / 120) & 0xff; const C = { r:'#e63946', p:'#ff9acb', w:'#f2f6f8', K:'#5a6a80', k:'#3b485a', d:'#232a36' };
    const s = Math.max(1, Math.min(4, W / 64));
    const px = (x,y,col,w=1,h=1)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(w*s), Math.round(h*s)); };
    const rect = (x,y,wid,hei,col)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(wid*s), Math.round(hei*s)); };
    const circleFill = (cx,cy,r,col)=>{ const r2=r*r; for(let yy=(cy-r)|0; yy<=(cy+r)|0; yy++){ for(let xx=(cx-r)|0; xx<=(cx+r)|0; xx++){ const dx=xx-cx, dy=yy-cy; if(dx*dx+dy*dy<=r2) px(xx,yy,col); } } };
    const triFill = (x1,y1,x2,y2,x3,y3,col)=>{ g.fillStyle = col; g.beginPath(); g.moveTo(Math.round(x1*s)+0.5, Math.round(y1*s)+0.5); g.lineTo(Math.round(x2*s)+0.5, Math.round(y2*s)+0.5); g.lineTo(Math.round(x3*s)+0.5, Math.round(y3*s)+0.5); g.closePath(); g.fill(); };
    g.clearRect(0,0,W,H);
    const bob = ((frame%8)<4)?0:1;
    circleFill(32,28+bob,8,C.K); circleFill(32,28+bob,7,C.k);
    triFill(25,21+bob,29,18+bob,30,24+bob,C.k); triFill(26,21+bob,29,19+bob,29,23+bob,C.p);
    triFill(34,18+bob,39,21+bob,34,24+bob,C.k); triFill(35,19+bob,38,21+bob,35,23+bob,C.p);
    rect(27,27+bob,4,3,C.w); rect(33,27+bob,4,3,C.w);
    rect(28,28+bob,2,2,C.r); rect(34,28+bob,2,2,C.r);
    px(29,28+bob,C.d); px(35,28+bob,C.d);
    px(28,27+bob,C.w); px(34,27+bob,C.w);
    px(32,30+bob,C.p); px(31,31+bob,C.d); px(33,31+bob,C.d); px(32,32+bob,C.d);
    px(26,31+bob,C.p); px(27,32+bob,C.p); px(37,31+bob,C.p); px(36,32+bob,C.p);
    px(24,30+bob,C.w); px(25,30+bob,C.w); px(24,32+bob,C.w); px(40,30+bob,C.w); px(39,30+bob,C.w); px(40,32+bob,C.w);
    const firing = ((frame % 24) < 2);
    const gunY = 15 + bob + (firing?1:0);
    rect(31, gunY, 2, 8, C.K); rect(31, gunY, 2, 2, C.w);
    px(30,23+bob,C.p); px(33,23+bob,C.p); px(29,24+bob,C.p); px(34,24+bob,C.p); px(31,24+bob,C.p);
    const flick = (frame%8<4)?-1:1; px(31,36+bob,C.k); px(30,36+bob+flick,C.K); px(29,36+bob+flick*2,C.p);
    return true;
  }catch(_){ return false; }
}

// Install / override global helpers BEFORE any canonical attachment happens.
try{
  if (typeof globalThis !== 'undefined'){
    globalThis.drawKittenBody = pixelKittyBody; // override to pixel art
    globalThis.drawKittenTurret = pixelKittyTurret;
    // Provide aliases so any previous high-fi names won't break fallback code
    globalThis.drawHighFiKittyBody = pixelKittyBody;
    globalThis.drawHighFiKittyTurret = pixelKittyTurret;
  }
}catch(_){ }

// Provide early composite drawKittenTile if none exists yet so humans.js maker never paints any legacy placeholder.
try{
  if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenTile !== 'function'){
    globalThis.drawKittenTile = function(g, t){
      if (!g) return false;
      try{
        // Draw body then turret overlay
        pixelKittyBody(g, t);
        try{
          const tmp = document.createElement('canvas'); tmp.width = g.canvas.width; tmp.height = g.canvas.height; const tg = tmp.getContext('2d');
          if (tg){ pixelKittyTurret(tg, t); g.drawImage(tmp,0,0); }
          else { pixelKittyTurret(g, t); }
        }catch(_){ drawHighFiKittyTurret(g, t); }
        return true;
      }catch(_){ return false; }
    };
  }
}catch(_){ }

function normalizeKittyKind(ent){ try{ if (ent && ent.kind === 'kitten') ent.kind = 'kittytank'; }catch(_){ } return ent; }

function attachKittyIfNeeded(ent){
  if (!ent) return false;
  normalizeKittyKind(ent);
  try{
    if (ent.kind !== 'kittytank') return false;
    // If canonical already present, nothing to do.
    if (ent._kitten && ent._kitten._canonical && ent.draw && !ent.draw.__is_kitty_fallback) return true;
    // Prefer canonical renderer from tank.js
    const canon = (typeof globalThis !== 'undefined') ? globalThis.attachKittenRendererCanonical : null;
    if (typeof canon === 'function' && canon(ent)) return true;
    // Fallback helpers from alternativetanks.js or inline fallback
    const fallback = (typeof globalThis !== 'undefined') ? (globalThis.attachKittenRenderer || globalThis.attachKittyFallback) : null;
    if (typeof fallback === 'function') { try{ fallback(ent); }catch(_){ } }
    return true;
  }catch(err){ try{ console.warn('attachKittyIfNeeded failed', err); }catch(_){ } return false; }
}

// Basic spawn factory. Mirrors jungle NPC pattern from humans/critters but
// focused only on kitty. Stats taken from legacy mapping (hp=2, spd=60).
export function spawnKittyTank(x, y, opts = {}, enemies){
  const ent = {
    x, y,
    spd: (opts.spd || 60) + (Math.random()*6),
    r: 14,
    type: 'jungle',
    kind: 'kittytank',
    hp: typeof opts.hp === 'number' ? opts.hp : 2,
    angle: 0, turretAngle: 0,
    lastAttack: 0,
    attackCD: 500 + Math.random()*200,
    dashUntil: 0,
    moving: false,
    harmless: false
  };
  try{ ent.__spawn_stack = (new Error()).stack; }catch(_){ }
  attachKittyIfNeeded(ent);
  // Ensure high-fidelity art was applied (canonical renderer might have run earlier)
  try{
    if (ent._kitten && ent._kitten.bodyC && ent._kitten.turC){
      try{ pixelKittyBody(ent._kitten.bodyC.getContext('2d')); }catch(_){ }
      try{ pixelKittyTurret(ent._kitten.turC.getContext('2d')); }catch(_){ }
    }
  }catch(_){ }
  if (Array.isArray(enemies)) enemies.push(ent);
  return ent;
}

// Projectile builder for kitty bullets (mirrors game.js kitten handling)
export function buildKittyProjectile(ent, angle, speed, hitR){
  const spd = speed || 140;
  const a = (typeof angle === 'number') ? angle : 0;
  // muzzle offset logic keeps projectile from spawning inside player
  const muzzleOffBase = 14;
  let muzzleOff = muzzleOffBase;
  try{
    const tank = (typeof window !== 'undefined') ? window.tank : null;
    if (tank){
      const dist = Math.hypot(ent.x - tank.x, ent.y - tank.y);
      const minSafe = (tank.r || 14) + (hitR || 6) + 4;
      if (dist < minSafe) muzzleOff = minSafe;
    }
  }catch(_){ }
  const bx = ent.x + Math.cos(a) * muzzleOff;
  const by = ent.y + Math.sin(a) * muzzleOff;
  const dx = Math.cos(a) * spd;
  const dy = Math.sin(a) * spd;
  const t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  return { x: bx, y: by, dx, dy, spd, a, life: 60.0, hitR: hitR || 6, anim: true, t0, kind: 'kittybullet', _src: { id: ent && ent.id ? ent.id : null, kind: ent && ent.kind ? ent.kind : 'kittytank', label: 'kittytank', x: ent.x, y: ent.y } };
}

// Bulk normalization utility – can be used at restart or late-load to purge any old identifiers.
export function normalizeAllKitty(enemies){
  if (!Array.isArray(enemies)) return 0;
  let changed = 0;
  for (const e of enemies){
    if (!e) continue;
  if (e.kind === 'kitten'){ e.kind = 'kittytank'; changed++; }
    if (e.kind === 'kittytank') attachKittyIfNeeded(e);
  }
  return changed;
}

// Auto-install a one-time late normalizer shortly after load to convert any stray legacy entities.
try{
  if (typeof window !== 'undefined' && !window.__kitty_autonormalize_installed){
    window.__kitty_autonormalize_installed = true;
    setTimeout(()=>{
      try{
        const arr = (window.enemies || []);
        const n = normalizeAllKitty(arr);
        if (n>0) console.warn('KittyTank: normalized legacy entities', { count: n });
      }catch(_){ }
    }, 800);
  }
}catch(_){ }

// Expose helpers globally (non-breaking) for older code paths.
try{
  if (typeof globalThis !== 'undefined'){
    if (!globalThis.normalizeKittyKind) globalThis.normalizeKittyKind = normalizeKittyKind;
    if (!globalThis.attachKittyIfNeeded) globalThis.attachKittyIfNeeded = attachKittyIfNeeded;
    if (!globalThis.spawnKittyTank) globalThis.spawnKittyTank = spawnKittyTank;
  }
}catch(_){ }

export { normalizeKittyKind, attachKittyIfNeeded };
