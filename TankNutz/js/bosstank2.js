// Boss Tank Variant 2 — visual/animation adapted from tankboss2.html
// Provides spawnBossTank2(x,y,opts,enemies) and attachBossIfNeeded2(ent)

const INTERNAL_SIZE = 128;
const BOSS_SCALE = 0.5;

// Palette (trimmed from tankboss2.html)
const PAL = {
  outline:'#070c12', hull0:'#161c23', hull1:'#202833', hull2:'#2a3442', hull3:'#374354', hull4:'#46576d',
  steel0:'#3f454f', steel1:'#59626d', steel2:'#768190', steel3:'#a4adb8', rim:'#9fb9d8',
  glowA:'#9fe3ff', glowB:'#78d8ff', glowG:'#7bf4b3', hazard:'#f0c04a', hazardD:'#7a4e19', redA:'#cb4a4a'
};
const HULL_RAMP = [PAL.hull0,PAL.hull1,PAL.hull2,PAL.hull3,PAL.hull4];
const STEEL_RAMP = [PAL.steel0,PAL.steel1,PAL.steel2,PAL.steel3];

// Precompute polar tables
const _R = new Float32Array(INTERNAL_SIZE * INTERNAL_SIZE);
const _A = new Float32Array(INTERNAL_SIZE * INTERNAL_SIZE);
const CX = INTERNAL_SIZE/2; const CY = INTERNAL_SIZE/2;
for (let y=0;y<INTERNAL_SIZE;y++){
  for (let x=0;x<INTERNAL_SIZE;x++){
    const dx = x - CX + 0.5; const dy = y - CY + 0.5; const i = y*INTERNAL_SIZE + x;
    _R[i] = Math.hypot(dx,dy); _A[i] = Math.atan2(dy,dx);
  }
}

const R_OUT=52, R_SHELL2=49, R_HULLI=46, R_PLATE=42, R_RIBO=39, R_RIBI=37, R_HAZ_O=36, R_HAZ_I=30, R_TUR=20, R_COLLO=18, R_COLLI=16, R_CORE=8;

function clamp(v,a,b){ return v<a?a:v>b?b:v; }
function mixHex(c1,c2,t){ const n1=parseInt(c1.slice(1),16), n2=parseInt(c2.slice(1),16); const r1=n1>>16&255,g1=n1>>8&255,b1=n1&255; const r2=n2>>16&255,g2=n2>>8&255,b2=n2&255; const r=(r1+(r2-r1)*t)|0,g=(g1+(g2-g1)*t)|0,b=(b1+(b2-b1)*t)|0; return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1); }
function smoothStep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function near(r,target,tol=0.6){ return Math.abs(r-target)<=tol; }
function pick(arr,i){ i|=0; if (i<0) i=0; if (i>=arr.length) i=arr.length-1; return arr[i]; }
function d2(x,y){ return ((x ^ y) & 1); }
function noise01(x,y){ const n = ((x*73856093) ^ (y*19349663)) >>> 0; return (n & 1023) / 1023; }

function renderBossBody2(g, tms){
  const t = (tms||performance.now())*0.001;
  // Tone-down animation speeds
  const rimAngle = t * 0.45; const rimCos = Math.cos(rimAngle), rimSin = Math.sin(rimAngle);
  const hazardShift = t * 1.2; const breath = 0.5 + 0.5 * Math.sin(t * 1.3);
  const W = INTERNAL_SIZE, H = INTERNAL_SIZE;
  g.clearRect(0,0,W,H);
  function p(x,y,col){ if (x<0||y<0||x>=W||y>=H) return; g.fillStyle = col; g.fillRect(x,y,1,1); }
  for (let y=0;y<H;y++){
    for (let x=0;x<W;x++){
      const i=y*W+x; const r=_R[i]; if (r>R_OUT+0.5) continue; const a=_A[i]; let col=null;
      if (near(r, R_OUT, 0.7)){
        col = PAL.outline;
      } else if (r > R_SHELL2){
        const nx=(x-CX+0.5)/(r||1), ny=(y-CY+0.5)/(r||1); const ndl = Math.max(0, nx*rimCos + ny*rimSin);
        const tHull = smoothStep(R_OUT, R_SHELL2, r);
        let base = pick(HULL_RAMP, Math.floor(tHull*(HULL_RAMP.length-1)));
        base = mixHex(base, PAL.rim, ndl*0.55);
        if (d2(x,y) && noise01(x,y) < 0.08) base = mixHex(base, PAL.steel1, 0.15);
        col = base;
      } else if (r > R_HULLI){
        const nx=(x-CX+0.5)/(r||1), ny=(y-CY+0.5)/(r||1); const ndl = Math.max(0, nx*rimCos + ny*rimSin);
        const tBand = smoothStep(R_SHELL2, R_HULLI, r);
        let base = pick(HULL_RAMP, Math.floor(tBand*(HULL_RAMP.length-1)));
        base = mixHex(base, PAL.rim, ndl*0.35);
        const segs = 20; const segPos = ((((a + Math.PI)/(2*Math.PI)) * segs) % 1);
        const nearEdge = segPos < 0.08 || segPos > 0.92;
        if (nearEdge && d2(x,y)) base = mixHex(base, PAL.hull1, 0.5);
        col = base;
      } else if (r > R_PLATE){
        const nx=(x-CX+0.5)/(r||1), ny=(y-CY+0.5)/(r||1); const ndl = Math.max(0, nx*rimCos + ny*rimSin);
        let base = PAL.hull3;
        const plates = 12; const pos = ((((a + Math.PI)/(2*Math.PI))*plates) % 1);
        const seam = pos < 0.06 || pos > 0.94;
        if (seam){ const beadSide = (pos < 0.06) ? -1 : 1; const bx = Math.round(x + (-ny)*beadSide*1); const by = Math.round(y + ( nx)*beadSide*1); p(bx,by, mixHex(PAL.steel3, PAL.glowA, 0.2)); base = PAL.hull1; }
        base = mixHex(base, PAL.rim, ndl*0.25);
        if (noise01(x,y) < 0.03) base = mixHex(base, PAL.steel0, 0.25);
        col = base;
      } else if (r > R_RIBO){
        col = PAL.steel1;
      } else if (r > R_RIBI){
        let c = PAL.steel0; if (Math.floor(r)%2===0 && d2(x,y)) c = mixHex(c, PAL.steel2, 0.15); col = c;
      } else if (r > R_HAZ_O){
        const tS = smoothStep(R_RIBI, R_HAZ_O, r); let c = pick(STEEL_RAMP, Math.floor(tS*(STEEL_RAMP.length-1)));
        if (d2(x,y) && (noise01(x,y) < 0.05)) c = mixHex(c, PAL.steel0, 0.2); col = c;
      } else if (r > R_HAZ_I){
        const ang01 = (a + Math.PI)/(2*Math.PI); const stripe = (Math.floor(((ang01 + hazardShift*0.05)*32) + Math.floor(r*0.35)) & 1);
        let hz = stripe ? PAL.hazard : PAL.hazardD; if (d2(x,y) && noise01(x,y) < 0.06) hz = mixHex(hz, PAL.steel2, 0.25); col = hz;
      } else if (r > R_TUR){
        const tIn = smoothStep(R_HAZ_I, R_TUR, r); let c = pick(STEEL_RAMP, Math.floor(tIn*(STEEL_RAMP.length-1)));
        if (Math.floor(r)%3===0 && d2(x,y)) c = mixHex(c, PAL.steel0, 0.25); col = c;
      } else if (r > R_COLLO){
        let tC = smoothStep(R_TUR, R_COLLO, r); let c = pick(STEEL_RAMP, Math.floor(tC*(STEEL_RAMP.length-1)));
        const ig = clamp((R_COLLO - r)/(R_COLLO - R_COLLI + 1e-5), 0, 1); c = mixHex(c, PAL.glowG, ig*0.12); col = c;
      } else {
        const gmix = clamp((R_COLLI - r)/(R_COLLI - R_CORE + 1e-5), 0, 1); const pulse = 0.4 + 0.6 * breath; const coreMix = clamp(gmix * 0.85 * pulse, 0, 1);
        const glass = mixHex(PAL.glowB, PAL.glowG, 0.4); let c = mixHex(PAL.hull2, mixHex(glass, PAL.glowA, 0.5), coreMix);
        if (near(r, R_CORE, 0.7)) c = PAL.outline;
        const nx=(x-CX+0.5)/(r||1), ny=(y-CY+0.5)/(r||1); const spark = clamp(nx*rimCos + ny*rimSin, 0, 1);
        if (spark > 0.9 && r < R_CORE - 1) c = mixHex(c, PAL.glowA, (spark-0.9)*5);
        col = c;
      }
      if (col) p(x,y,col);
    }
  }
  function drawRingOutline(radius, color, tol){ for (let y=0;y<H;y++){ for (let x=0;x<W;x++){ if (near(_R[y*W+x], radius, tol)) p(x,y,color); } } }
  function drawArmorRibs(N, rInner, rOuter, halfWidth, fill, edge){ for (let k=0;k<N;k++){ const a = (k/N) * Math.PI*2; const ca=Math.cos(a), sa=Math.sin(a); for (let r=rInner;r<=rOuter;r+=0.5){ const x0=Math.round(CX + ca*r); const y0=Math.round(CY + sa*r); for (let w=-halfWidth; w<=halfWidth; w++){ const x=Math.round(x0 + (-sa)*w); const y=Math.round(y0 + ( ca)*w); p(x,y,fill); if (Math.abs(w)===halfWidth) p(x,y,edge); } } } }
  function placeBoltOnRadius(a, r, size){ const x=Math.round(CX + Math.cos(a)*r); const y=Math.round(CY + Math.sin(a)*r); drawBolt(x,y,size); }
  const boltGlints = false; // reduce sparkle work
  function drawStud(x,y,size){ for (let ix=-size; ix<=size; ix++){ for (let iy=-size; iy<=size; iy++){ p(x+ix, y+iy, PAL.steel2); } } for (let ix=-size; ix<=size; ix++){ p(x+ix, y-size, PAL.outline); p(x+ix, y+size, PAL.outline); } for (let iy=-size; iy<=size; iy++){ p(x-size, y+iy, PAL.outline); p(x+size, y+iy, PAL.outline); } if (boltGlints) p(x-1, y-1, PAL.steel3); }
  function drawBolt(x,y,size){ p(x,y,PAL.steel2); p(x-1,y,PAL.steel1); p(x+1,y,PAL.steel1); p(x,y-1,PAL.steel1); p(x,y+1,PAL.steel1); if (size>=2){ p(x-1,y-1,PAL.steel1); p(x+1,y-1,PAL.steel1); p(x-1,y+1,PAL.steel1); p(x+1,y+1,PAL.steel1); } p(x-2,y,PAL.outline); p(x+2,y,PAL.outline); p(x,y-2,PAL.outline); p(x,y+2,PAL.outline); if (size>=2){ p(x-2,y-1,PAL.outline); p(x-2,y+1,PAL.outline); p(x+2,y-1,PAL.outline); p(x+2,y+1,PAL.outline); p(x-1,y-2,PAL.outline); p(x+1,y-2,PAL.outline); p(x-1,y+2,PAL.outline); p(x+1,y+2,PAL.outline); } if (boltGlints){ const phase = (Math.sin(t*2.2 + (x*0.3 + y*0.5)) * 0.5 + 0.5); if (phase > 0.8) p(x-1, y-1, PAL.steel3); } p(x+1,y+1,PAL.hull1); }
  function drawBoltRing(r, N, size, jitter, square){ for (let k=0;k<N;k++){ const a=(k/N)*Math.PI*2; const j = jitter ? (((k&1)?-jitter:jitter)) : 0; const rr = r+j; const x=Math.round(CX + Math.cos(a)*rr); const y=Math.round(CY + Math.sin(a)*rr); if (square) drawStud(x,y,size); else drawBolt(x,y,size); } }
  function drawBoltClustersOnSeams(seams,r1,r2,size){ for (let s=0; s<seams; s++){ const a=(s/seams)*Math.PI*2; for (let rr=r1; rr<=r2; rr+=3.5){ const x=Math.round(CX + Math.cos(a)*rr); const y=Math.round(CY + Math.sin(a)*rr); drawBolt(x,y,size); const tx=Math.round(x + -Math.sin(a)); const ty=Math.round(y +  Math.cos(a)); drawBolt(tx,ty,size); } } }
  function drawSegmentCaps(N, rIn, rOut, thickness){ for (let k=0;k<N;k++){ const baseA=(k/N)*Math.PI*2; const span = Math.PI*2 / N * 0.7; for (let a=baseA - span/2; a<=baseA + span/2; a+=1/180){ const ca=Math.cos(a), sa=Math.sin(a); for (let r=rIn; r<=rOut; r+=0.5){ const x=Math.round(CX + ca*r); const y=Math.round(CY + sa*r); const tR = smoothStep(rIn, rOut, r); let c = mixHex(PAL.hull4, PAL.steel2, tR*0.35); if (d2(x,y) && noise01(x,y) < 0.05) c = mixHex(c, PAL.steel0, 0.2); p(x,y,c); } } const edgeA = baseA; const ca=Math.cos(edgeA), sa=Math.sin(edgeA); for (let r=rIn; r<=rOut; r+=0.5){ const x=Math.round(CX + ca*r); const y=Math.round(CY + sa*r); p(x,y,PAL.outline); } const end1A = baseA - span/2, end2A = baseA + span/2; placeBoltOnRadius(end1A, rOut-1, 2); placeBoltOnRadius(end2A, rOut-1, 2); } }
  function drawWarningLEDs(radius, n, colOn, edge){ const ts = (tms||performance.now())*0.001; for (let k=0;k<n;k++){ const a=(k/n)*Math.PI*2; const pulse = 0.5 + 0.5 * Math.sin(ts * 2 + k * 0.6); const on = pulse > 0.7; const x=Math.round(CX + Math.cos(a)*radius); const y=Math.round(CY + Math.sin(a)*radius); p(x,y, on ? colOn : PAL.hull2); if (on){ const gx=Math.round(CX + Math.cos(a)*(radius-1)); const gy=Math.round(CY + Math.sin(a)*(radius-1)); p(gx,gy,PAL.glowA); } p(x,y,edge); } }

  drawRingOutline(R_OUT,   PAL.outline, 0.7);
  drawRingOutline(R_SHELL2,PAL.outline, 0.55);
  drawRingOutline(R_HULLI, PAL.outline, 0.55);
  drawRingOutline(R_PLATE, PAL.outline, 0.55);
  drawRingOutline(R_RIBO,  PAL.outline, 0.45);
  drawRingOutline(R_RIBI,  PAL.outline, 0.45);
  drawRingOutline(R_HAZ_O, PAL.outline, 0.45);
  drawRingOutline(R_HAZ_I, PAL.outline, 0.45);
  drawRingOutline(R_TUR,   PAL.outline, 0.50);
  drawRingOutline(R_COLLO, PAL.outline, 0.45);
  drawRingOutline(R_COLLI, PAL.outline, 0.45);
  drawRingOutline(R_CORE,  PAL.outline, 0.60);

  drawArmorRibs(14, R_RIBI-1, R_OUT-1, 2, PAL.hull1, PAL.outline);
  drawSegmentCaps(10, R_SHELL2+0.5, R_OUT-0.5, 4);
  drawBoltRing(R_SHELL2-1.5, 36, 2, 0.0, false);
  drawBoltRing(R_PLATE+1.5,  48, 2, 0.04, false);
  drawBoltRing(R_HAZ_O-0.5,  32, 1, 0.02, true);
  drawBoltRing(R_TUR-2.0,    18, 2, 0.0, false);
  drawBoltRing(R_COLLO-0.5,  24, 1, 0.0, false);
  drawBoltClustersOnSeams(12, R_PLATE+0.5, R_RIBO-0.5, 1);
  drawWarningLEDs(R_HAZ_I + 2, 10, PAL.redA, PAL.outline);
}

function renderBossTurret2(g, angleRad){
  const W=INTERNAL_SIZE, H=INTERNAL_SIZE; g.clearRect(0,0,W,H);
  function p(x,y,col){ if (x<0||y<0||x>=W||y>=H) return; g.fillStyle = col; g.fillRect(x,y,1,1); }
  const length = 30; const width = 3; const dx=Math.cos(angleRad), dy=Math.sin(angleRad); const start = R_COLLO + 1;
  for (let s=start; s<=length; s+=0.2){ const px=Math.round(CX + dx*s); const py=Math.round(CY + dy*s); const nx=-dy, ny=dx; for (let w=-Math.floor(width/2); w<=Math.floor(width/2); w++){ const bx=Math.round(px + nx*w); const by=Math.round(py + ny*w); p(bx,by,PAL.steel3); if (w===-Math.floor(width/2) || w===Math.floor(width/2)) p(bx,by,PAL.outline); } }
  const tipx = Math.round(CX + dx*length); const tipy = Math.round(CY + dy*length); p(tipx, tipy, '#000000'); p(Math.round(tipx + dx*1), Math.round(tipy + dy*1), PAL.steel3);
  for (let r=0; r<=2; r+=0.5){ const rr = R_COLLO - r; for (let a=0; a<Math.PI*2; a+=1/180){ const x=Math.round(CX + Math.cos(a)*rr); const y=Math.round(CY + Math.sin(a)*rr); p(x,y,PAL.outline); } }
  p(CX, CY, PAL.steel2);
}

function ensureBossCanvases2(ent){ if (!ent._boss) ent._boss = {}; const store = ent._boss; if (!store.bodyC){ const c=document.createElement('canvas'); c.width=INTERNAL_SIZE; c.height=INTERNAL_SIZE; store.bodyC=c; renderBossBody2(c.getContext('2d')); store._lastBodyRenderAt = 0; } if (!store.turC){ const c=document.createElement('canvas'); c.width=INTERNAL_SIZE; c.height=INTERNAL_SIZE; store.turC=c; } }

function drawBoss2(ent, ctx, worldToScreen, camera){ if (!ent || !ctx) return; ensureBossCanvases2(ent); const bodyC = ent._boss.bodyC; const turC = ent._boss.turC; const scale = (camera && camera.zoom || 1) * BOSS_SCALE; let sx=ent.x, sy=ent.y; try{ if (typeof worldToScreen === 'function'){ const s = worldToScreen(ent.x, ent.y); sx=s.x; sy=s.y; } else if (worldToScreen && typeof worldToScreen.x === 'function'){ sx = worldToScreen.x(ent.x); sy = worldToScreen.y(ent.y); } }catch(_){ }
  try{
    const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    const last = ent._boss._lastBodyRenderAt || 0;
    if ((now - last) >= 140){ renderBossBody2(bodyC.getContext('2d'), now); ent._boss._lastBodyRenderAt = now; }
  }catch(_){ }
  try{ ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(sx,sy); ctx.rotate(ent.angle || 0); ctx.scale(scale,scale); ctx.drawImage(bodyC,-bodyC.width/2,-bodyC.height/2); ctx.restore(); }catch(_){ }
  try{ renderBossTurret2(turC.getContext('2d'), ent.turretAngle || 0); }catch(_){ }
  try{ ctx.save(); ctx.imageSmoothingEnabled = false; ctx.translate(sx,sy); ctx.scale(scale,scale); ctx.drawImage(turC,-turC.width/2,-turC.height/2); ctx.restore(); }catch(_){ }
  // health bar
  try{ const hp = ent.hp, maxHp = ent.maxHp || 15; if (hp>0 && maxHp>0){ const pct = Math.max(0, Math.min(1, hp / maxHp)); const barW = 70 * (camera && camera.zoom || 1); const barH = 6 * (camera && camera.zoom || 1); const bx = sx - barW/2; const by = sy - (bodyC.height*scale/2) - 14 * (camera && camera.zoom || 1); ctx.save(); ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fillRect(bx-2, by-2, barW+4, barH+4); ctx.fillStyle='#3b4758'; ctx.fillRect(bx, by, barW, barH); let r,g; if (pct>0.5){ const t=(pct-0.5)/0.5; r = Math.floor(255*(1-t)*0.2); g = 200; } else { const t=pct/0.5; r = Math.floor(255*(1-t)); g = Math.floor(200*t); } ctx.fillStyle = 'rgb('+r+','+g+',40)'; ctx.fillRect(bx, by, barW*pct, barH); ctx.strokeStyle='#ffffff'; ctx.lineWidth=1; ctx.strokeRect(bx-0.5, by-0.5, barW+1, barH+1); ctx.restore(); } }catch(_){ }
}

function attachBossIfNeeded2(ent){ if (!ent || ent.kind !== 'bosstank2') return false; if (!ent._boss) ent._boss={}; if (!ent.draw){ ent.draw = function(ctx, worldToScreen, camera){ drawBoss2(ent, ctx, worldToScreen, camera); }; }
  if (!ent.__boss_wrapped){ ent.__boss_wrapped = true; const origDraw = ent.draw; ent._lastFrameTime = performance.now(); ent.draw = function(ctx, worldToScreen, camera){ const now = performance.now(); const dt = now - (ent._lastFrameTime||now); ent._lastFrameTime = now; updateBoss2(ent, dt); return origDraw(ctx, worldToScreen, camera); }; }
  return true; }

function bossFire2(ent){ try{ if (!Array.isArray(window.enemyBullets)) return; const a = ent.turretAngle || 0; const muzzle = 30; for (let i=-2;i<=2;i++){ const ang = a + i*0.07; window.enemyBullets.push({ x: ent.x + Math.cos(a)*muzzle, y: ent.y + Math.sin(a)*muzzle, dx: Math.cos(ang)*260, dy: Math.sin(ang)*260, life: 4.2, hitR: 10, _src:{ kind: ent.kind } }); } }catch(_){ } }

function spawnBoss2Gibs(ent, count, color){ try{ if (!ent) return; const c = count||18; for (let i=0;i<c;i++){ const ang = Math.random()*Math.PI*2; const spd = 40 + Math.random()*160; const vx = Math.cos(ang)*spd; const vy = Math.sin(ang)*spd; try{ callSpawnGibs(ent.x + Math.cos(ang)*8, ent.y + Math.sin(ang)*8, color || '#ff8b6b', 6 + Math.floor(Math.random()*8), 'bosstank2-gib'); }catch(_){ } // fallback: also push small debris as enemyBullets for visual
      try{ if (Array.isArray(window.enemyBullets)) window.enemyBullets.push({ x: ent.x, y: ent.y, dx: vx, dy: vy, life: 1.2, hitR: 2, _src:{ kind: 'bosstank2-gib' } }); }catch(_){ }
    }
  }catch(_){ }
}

// debug helpers
function _dbg(msg, obj){ try{ if (typeof console !== 'undefined') console.log('[bosstank2]', msg, obj||''); }catch(_){ } }

function updateBoss2(ent, dtMs){
  if (!ent) return;
  const now = performance.now();

  // If in phase-break window, keep turret aiming but otherwise idle
  if (ent._phaseBreakUntil && now < ent._phaseBreakUntil){
    try{
      const player = (typeof window !== 'undefined') ? window.tank : null;
      if (player){ ent.turretAngle = Math.atan2(player.y - ent.y, player.x - ent.x); }
    }catch(_){ }
    return;
  }

  // Movement: slower approach with early slowdown and strong braking
  try{
    const player = (typeof window !== 'undefined') ? window.tank : null;
    if (player){
      const dx = (typeof window !== 'undefined' && typeof window.wrapDeltaX === 'function') ? window.wrapDeltaX(player.x, ent.x) : (player.x - ent.x);
      const dy = (typeof window !== 'undefined' && typeof window.wrapDeltaY === 'function') ? window.wrapDeltaY(player.y, ent.y) : (player.y - ent.y);
      const dist = Math.hypot(dx,dy);
  // Retuned: still slows early, but chases more decisively
  const stopD = 160;               // comfortable stop distance
  const nearD = 180;               // begin slowdown
  const farD  = 480;               // full speed beyond this
  const brakeZone = stopD + 70;    // soft braking range
      let t;
      if (dist <= nearD) t = 0; else if (dist >= farD) t = 1; else t = (dist - nearD) / (farD - nearD);
      const ease = t*t*(3-2*t);
  const minMul = 0.4; const maxMul = 2.8;
      let targetSpd = ent.baseSpd * (minMul + (maxMul - minMul) * ease);
      // Comfort radius + brake zone: if very close, stop; else clamp speed by remaining gap
      if (dist <= stopD) targetSpd = 0; else if (dist <= brakeZone){
        const gap = Math.max(0, dist - stopD);
        const softMax = gap * 1.3; // limit speed by distance to avoid overshoot
        targetSpd = Math.min(targetSpd, softMax);
      }
  const kAccel = 0.15, kBrake = 0.35; const k = (targetSpd < ent.spd) ? kBrake : kAccel;
      ent.spd = ent.spd + (targetSpd - ent.spd) * k;
      if (dist > 4) ent.angle = Math.atan2(dy, dx);
    }
  }catch(_){ }

  // Aim toward player every 80ms
  if (now - ent.lastAimUpdate > 80){
    try{
      const player = (typeof window !== 'undefined') ? window.tank : null;
      if (player){
        const dx = (typeof window !== 'undefined' && typeof window.wrapDeltaX === 'function') ? window.wrapDeltaX(player.x, ent.x) : (player.x - ent.x);
        const dy = (typeof window !== 'undefined' && typeof window.wrapDeltaY === 'function') ? window.wrapDeltaY(player.y, ent.y) : (player.y - ent.y);
        ent.turretAngle = Math.atan2(dy, dx);
      }
    }catch(_){ }
    ent.lastAimUpdate = now;
  }

  // Firing (identical cadence to bosstank, uses bossFire2)
  ent._fireAccum += dtMs;
  if (ent._fireAccum >= ent.fireInterval){ ent._fireAccum = 0; try{ bossFire2(ent); }catch(_){ } }

  // Movement integration with overshoot clamp near stop distance
  try{
    const ax = Math.cos(ent.angle || 0); const ay = Math.sin(ent.angle || 0);
    let step = ent.spd * (dtMs/1000);
    try{
      const player = (typeof window !== 'undefined') ? window.tank : null;
      if (player){
        const dx = (typeof window !== 'undefined' && typeof window.wrapDeltaX === 'function') ? window.wrapDeltaX(player.x, ent.x) : (player.x - ent.x);
        const dy = (typeof window !== 'undefined' && typeof window.wrapDeltaY === 'function') ? window.wrapDeltaY(player.y, ent.y) : (player.y - ent.y);
        const dist = Math.hypot(dx,dy);
        const stopD = 160;
        const gap = Math.max(0, dist - stopD);
        step = Math.min(step, gap);
      }
    }catch(_){ }
    ent.x += ax * step; ent.y += ay * step;
  }catch(_){ }

  // Contact damage: mirror bosstank's overlap logic (1 heart per second)
  try{
    const player = (typeof window !== 'undefined') ? window.tank : null;
    if (player && !player.dead){
      const dx = (typeof window !== 'undefined' && typeof window.wrapDeltaX === 'function') ? window.wrapDeltaX(player.x, ent.x) : (player.x - ent.x);
      const dy = (typeof window !== 'undefined' && typeof window.wrapDeltaY === 'function') ? window.wrapDeltaY(player.y, ent.y) : (player.y - ent.y);
      const dist = Math.hypot(dx,dy);
      const pr = (player.r || 20); const br = ent.r || 30;
      if (dist < pr + br){
        if (!ent._lastContactHit || (now - ent._lastContactHit) > 1000){
          ent._lastContactHit = now;
          try{ if (typeof window !== 'undefined' && typeof window.health === 'number'){ window.health = Math.max(0, window.health - 1); if (typeof window.setHealth === 'function') try{ window.setHealth(window.health); }catch(_){ } if (typeof window.updateHud === 'function') try{ window.updateHud(); }catch(_){ } if (window.health <= 0 && typeof window.explodeTank === 'function') try{ window.explodeTank(window.updateHud, document.getElementById('center'), window.score||0); }catch(_){ } } }catch(_){ }
        }
      }
    }
  }catch(_){ }

  // Phase transition: keep the two-phase HP behavior but do NOT change movement/firing behavior
  try{
    if ((typeof ent.hp === 'number') && ent.hp <= 25 && ent._phase === 1){
      ent._phase = 2;
      ent._phaseTriggered = true;
      ent._phaseBreakUntil = now + 600; // short pause before phase 2 resumes
      try{ spawnBoss2Gibs(ent, 20); }catch(_){ }
      ent._fireAccum = 0;
    }
  }catch(_){ }
}

export function spawnBossTank2(x,y, opts={}, enemies){ const ent = { x,y, spd: ((opts.spd || 40) * 3) + Math.random()*12, baseSpd: ((opts.spd || 40) * 3), r: 30, type: 'boss', kind: 'bosstank2', maxHp: 50, hp:50, angle:0, turretAngle:0, lastAttack:0, attackCD:900 + Math.random()*350, dashUntil:0, moving:false, boss:true, _fireAccum:0, fireInterval:1400, lastAimUpdate:0, _phase:1, _phaseTriggered:false }; attachBossIfNeeded2(ent); if (Array.isArray(enemies)) enemies.push(ent); try{ if (typeof globalThis !== 'undefined'){ globalThis.spawnBossTank2 = spawnBossTank2; } }catch(_){ } return ent; }

// expose globally
try{ if (typeof globalThis !== 'undefined'){ globalThis.spawnBossTank2 = spawnBossTank2; } }catch(_){ }
try{ if (typeof globalThis !== 'undefined'){ globalThis.spawnBoss2Gibs = spawnBoss2Gibs; } }catch(_){ }

export default { spawnBossTank2, attachBossIfNeeded2, spawnBoss2Gibs };
