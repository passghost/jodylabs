// alternativetanks.js
// Port of two_chained_heavy_tanks drawing & simple physics wrapped as an enemy factory.
// Export: spawnChainedTank(x,y,opts) -> enemy object suitable for game.js

// Pixel helpers copied from the source demo (minimal subset)
function px(ctx,x,y,w=1,h=1,c){ ctx.fillStyle=c; ctx.fillRect(x,y,w,h); }
function rectOutline(ctx,x,y,w,h,c){ px(ctx,x,y,w,1,c); px(ctx,x,y+h-1,w,1,c); px(ctx,x,y,1,h,c); px(ctx,x+w-1,y,1,h,c); }
function circ(ctx,xc,yc,r,c){ for(let y=-r;y<=r;y++){ const s=Math.floor(Math.sqrt(r*r-y*y)); ctx.fillStyle=c; ctx.fillRect(xc-s,yc+y,2*s+1,1); } }
function ring(ctx,xc,yc,ri,ro,c){ for(let r=ri;r<=ro;r++) circ(ctx,xc,yc,r,c); }

// We'll keep drawing on the main game canvas context passed-in; coordinates are world-space.
let TANK_BODY_SCALE = 1.0; // visual scale for tank bodies (reduced)
// tweak this if the sprite's forward axis doesn't match math atan2 direction
const HULL_ANGLE_OFFSET = -Math.PI/2; // rotate hull drawing by -90deg to align front with travel
// Rotate fired bullets by 90 degrees clockwise (two notches of 45°) to match desired aim
const FIRE_ANGLE_CORRECTION = -Math.PI / 2;
function drawTank(ctx,x,y,treadPhase,hullRot,turretRot,dust, palette, scale=1){
  // draw relative to center so we can scale uniformly using canvas transforms
  const {OUT,HDK,HMID,HLI,RIM,MDK,MMID,MLI,RUB,TRD,SHD,D1,D2} = palette;
  ctx.save();
  ctx.translate(Math.round(x), Math.round(y));
  if (hullRot) ctx.rotate(hullRot);
  if (scale !== 1) ctx.scale(scale, scale);
  // helper draws in local coords (no further rounding to let canvas scale handle pixels)
  const lpx = (lx,ly,w=1,h=1,col)=>{ ctx.fillStyle = col; ctx.fillRect(lx,ly,w,h); };
  const lRect = (lx,ly,w,h,col)=>{ lpx(lx,ly,w,1,col); lpx(lx,ly+h-1,w,1,col); lpx(lx,ly,1,h,col); lpx(lx+w-1,ly,1,h,col); };
  const lCirc = (xc,yc,r,col)=>{ for(let yy=-r;yy<=r;yy++){ const s = Math.floor(Math.sqrt(r*r - yy*yy)); ctx.fillStyle = col; ctx.fillRect(xc-s, yc+yy, 2*s+1, 1); } };
  // body (offsets are relative to center)
  lpx(-16,14,32,3,SHD); lpx(-14,13,28,1,SHD); lpx(-12,12,24,1,SHD);
  lpx(-22,-18,6,36,RUB); lpx(16,-18,6,36,RUB);
  for(let yy=-18; yy<18; yy++) if(((yy + treadPhase + 24) % 3) === 0){ lpx(-22, yy, 6, 1, TRD); lpx(16, yy, 6, 1, TRD); }
  lRect(-22,-18,6,36,OUT); lRect(16,-18,6,36,OUT);
  lpx(-17,-15,34,30,HDK); lpx(-15,-13,30,26,HMID); lpx(-13,-11,26,22,HLI);
  lpx(-13,-11,26,1,RIM); lpx(-13,-11,1,22,RIM); lRect(-17,-15,34,30,OUT);
  for (let i=0;i<6;i++){ lpx(-10 + i*3,8,2,1,MMID); lpx(-10 + i*3,9,2,1,MDK); }
  lpx(-10,-8,20,1,RIM); lpx(-16,4,32,3,HMID); lRect(-16,4,32,3,OUT);
  for (const vx of [-4,0,4]){ lpx(vx,-9,2,1,MDK); lpx(vx,-10,2,1,MLI); } lRect(-18,-18,36,36,OUT);
  // turret and hull circle
  lCirc(0,-1,10,HMID); lCirc(0,-1,9,HLI);
  // rim and outline rings (draw approximate as thin rings)
  lpx(-2,-3,1,1,RIM); lpx(-2,-1,1,1,OUT);
  // turret: rotate relative to hull so turretRot is world-space
  ctx.save(); ctx.rotate((turretRot || 0) - (hullRot || 0));
    lpx(-7,-4,5,5,HMID); lRect(-7,-4,5,5,OUT); lpx(2,-4,5,5,HMID); lRect(2,-4,5,5,OUT);
    lpx(-6,-7,12,3,HDK); lRect(-6,-7,12,3,OUT); lCirc(-3,-3,2,HMID); lpx(-3,-3,1,1,HLI);
    const Lb = 16; lpx(-5,-7-Lb,2,Lb,MMID); lpx(-5,-7-Lb,1,Lb,MLI); lRect(-5,-7-Lb,2,Lb,OUT);
    lpx(3,-7-Lb,2,Lb,MMID); lpx(3,-7-Lb,1,Lb,MLI); lRect(3,-7-Lb,2,Lb,OUT);
    lpx(-5,-7-Lb,2,1,MDK); lpx(3,-7-Lb,2,1,MDK);
  ctx.restore();
  if (dust>0.2){ const n=Math.min(12,2+Math.floor(dust*10)); for(let i=0;i<n;i++){ const rx=(Math.random()*12-6)|0; lpx(-18+rx, 42, 3, 1, D1); lpx(12+rx, 42, 3, 1, D2); } }
  ctx.restore();
}

function drawChain(ctx,ax,ay,bx,by,tension,palette, scale=1){ const {MMID,MDK,MLI} = palette; const dx = bx - ax, dy = by - ay, dist = Math.hypot(dx,dy); const step = Math.max(1, Math.round(4 * scale)); const count = Math.max(1, Math.floor(dist/step));
  for (let i=1;i<count;i++){ const t = i/count; const x = Math.round(ax + dx * t), y = Math.round(ay + dy * t); const w = (i%2?1:2), h = (i%2?2:1); const wS = Math.max(1, Math.round(w * scale)), hS = Math.max(1, Math.round(h * scale)); const shade = tension > 0.6 ? MDK : MMID; ctx.fillStyle = shade; ctx.fillRect(x - Math.floor(wS/2), y - Math.floor(hS/2), wS, hS); if (i%3 === 0){ ctx.fillStyle = MLI; ctx.fillRect(x, y, Math.max(1, Math.round(1*scale)), Math.max(1, Math.round(1*scale))); } }
  // end caps
  const capSize = Math.max(1, Math.round(1 * scale)); ctx.fillStyle = MLI; ctx.fillRect(Math.round(ax)-capSize, Math.round(ay)-capSize, capSize*2, capSize*2); ctx.fillRect(Math.round(bx)-capSize, Math.round(by)-capSize, capSize*2, capSize*2);
}

function anchorsFor(t){ return [{x:t.x-10,y:t.y-4},{x:t.x+0,y:t.y-4},{x:t.x+10,y:t.y-4}]; }

// Draw the evil kitten tank sprite into a provided 2D context.
// g: 2D context (size can be 48x48 or 64x64); t: optional time in ms to animate frames
export function drawKittenTile(g, t){
  try{
    const W = g.canvas.width || 48; const H = g.canvas.height || 48;
    const FRAME_MS = 120;
    const now = (typeof t === 'number') ? t : performance.now();
    const frame = Math.floor(now / FRAME_MS) & 0xff;
    // palette (approx from evil_kitten_tank_robot)
    const C = { t:'#1d222c', h:'#2c3544', d:'#232a36', k:'#3b485a', K:'#5a6a80', b:'#9ecaff', r:'#e63946', y:'#ffd166', o:'#f7b267', s:'#141820', w:'#f2f6f8', p:'#ff9acb' };
    // scale factor from 64 reference
    const s = Math.max(1, Math.min(4, W / 64));
    const px = (x,y,col,w=1,h=1)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(w*s), Math.round(h*s)); };
    const rect = (x,y,wid,hei,col)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(wid*s), Math.round(hei*s)); };
    const circleFill = (cx,cy,r,col)=>{ const r2 = r*r; for(let yy=(cy-r)|0; yy<=(cy+r)|0; yy++){ for(let xx=(cx-r)|0; xx<=(cx+r)|0; xx++){ const dx=xx-cx, dy=yy-cy; if(dx*dx+dy*dy<=r2) px(xx,yy,col); } } };
    const triFill = (x1,y1,x2,y2,x3,y3,col)=>{ g.fillStyle = col; g.beginPath(); g.moveTo(Math.round(x1*s)+0.5, Math.round(y1*s)+0.5); g.lineTo(Math.round(x2*s)+0.5, Math.round(y2*s)+0.5); g.lineTo(Math.round(x3*s)+0.5, Math.round(y3*s)+0.5); g.closePath(); g.fill(); };

    g.clearRect(0,0,W,H);
    // determine simple animation params
    const bob = ((frame % 8) < 4) ? 0 : 1;
    // draw treads
    rect(6,16,8,32,C.t); // left
    rect(50,16,8,32,C.t); // right
    // nubs
    const offset = frame % 4;
    for(let y=16;y<48;y++){
      if(((y+offset) % 4) === 0){ px(7,y,C.h); px(9,y,C.h); px(11,y,C.h); px(51,y,C.h); px(53,y,C.h); px(55,y,C.h); }
    }
    // hull
    rect(14,18,36,28,C.k);
    rect(14,18,36,2,C.K);
    rect(14,44,36,2,C.d);
    triFill(18,18,32,14,46,18,C.k);
    rect(18,36,28,6,C.d);
    for(let x=20;x<46;x+=3) px(x,38,C.K);
    circleFill(32,30,8,C.k); circleFill(32,30,7,C.d);
    for(let a=0;a<360;a+=30){ const rad=a*Math.PI/180; const x=32+Math.cos(rad)*6, y=30+Math.sin(rad)*6; px(Math.round(x), Math.round(y), C.K); }
    // turret head (cat)
    circleFill(32,28+bob,8,C.K); circleFill(32,28+bob,7,C.k);
    // ears
    triFill(25,21+bob,29,18+bob,30,24+bob,C.k); triFill(26,21+bob,29,19+bob,29,23+bob,C.p);
    triFill(34,18+bob,39,21+bob,34,24+bob,C.k); triFill(35,19+bob,38,21+bob,35,23+bob,C.p);
    // eyes
    rect(27,27+bob,4,3,C.w); rect(33,27+bob,4,3,C.w);
    rect(28,28+bob,2,2,C.r); rect(34,28+bob,2,2,C.r);
    px(29,28+bob,C.s); px(35,28+bob,C.s);
    px(28,27+bob,C.w); px(34,27+bob,C.w);
    // nose/mouth/blush
    px(32,30+bob,C.p); px(31,31+bob,C.d); px(33,31+bob,C.d); px(32,32+bob,C.d);
    px(26,31+bob,C.p); px(27,32+bob,C.p); px(37,31+bob,C.p); px(36,32+bob,C.p);
    // whiskers
    px(24,30+bob,C.w); px(25,30+bob,C.w); px(24,32+bob,C.w);
    px(40,30+bob,C.w); px(39,30+bob,C.w); px(40,32+bob,C.w);
    // gun barrel
    const firing = ((frame % 24) < 2);
    const gunY = 15 + bob + (firing?1:0);
    rect(31, gunY, 2, 8, C.K);
    rect(31, gunY, 2, 2, C.b);
    // bow
    px(30,23+bob,C.p); px(33,23+bob,C.p); px(29,24+bob,C.p); px(34,24+bob,C.p); px(31,24+bob,C.p);
    // tail flick
    const flick = (frame%8<4)?-1:1;
    px(32-1,36+bob,C.k); px(32-2,36+bob+flick,C.K); px(29,36+bob+flick*2,C.p); px(28,36+bob+flick*2,C.p); px(29,36+bob+flick*2-1,C.p);
    // rim/details
    for(let x=18;x<46;x+=2) px(x,18,C.b);
    for(let y=20;y<44;y+=3) px(48,y,C.b);
    [[18,22],[46,22],[18,42],[46,42]].forEach(([x,y])=>{ px(x,y,C.d); px(x+1,y,C.K); });
    return true;
  }catch(_){ return false; }
}

// expose helper for other modules that may want to render this tank into a canvas
try{ if (typeof globalThis !== 'undefined') globalThis.drawKittenTile = drawKittenTile; }catch(_){ }

// Draw only the body (treads + hull + rim) into a context
export function drawKittenBody(g, t){
  try{
    const W = g.canvas.width || 48; const H = g.canvas.height || 48; const now = (typeof t === 'number') ? t : performance.now(); const frame = Math.floor(now / 120) & 0xff;
    const C = { t:'#1d222c', h:'#2c3544', d:'#232a36', k:'#3b485a', K:'#5a6a80', b:'#9ecaff', s:'#141820' };
    const s = Math.max(1, Math.min(4, W / 64));
    const px = (x,y,col,w=1,h=1)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(w*s), Math.round(h*s)); };
    const rect = (x,y,wid,hei,col)=>{ g.fillStyle = col; g.fillRect(Math.round(x*s), Math.round(y*s), Math.round(wid*s), Math.round(hei*s)); };
    const circleFill = (cx,cy,r,col)=>{ const r2=r*r; for(let yy=(cy-r)|0; yy<=(cy+r)|0; yy++){ for(let xx=(cx-r)|0; xx<=(cx+r)|0; xx++){ const dx=xx-cx, dy=yy-cy; if(dx*dx+dy*dy<=r2) px(xx,yy,col); } } };
    const triFill = (x1,y1,x2,y2,x3,y3,col)=>{ g.fillStyle = col; g.beginPath(); g.moveTo(Math.round(x1*s)+0.5, Math.round(y1*s)+0.5); g.lineTo(Math.round(x2*s)+0.5, Math.round(y2*s)+0.5); g.lineTo(Math.round(x3*s)+0.5, Math.round(y3*s)+0.5); g.closePath(); g.fill(); };
    g.clearRect(0,0,W,H);
    // treads
    rect(6,16,8,32,C.t); rect(50,16,8,32,C.t);
    const offset = frame % 4;
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

// Draw only the turret (head, ears, eyes, gun, tail) into a context
export function drawKittenTurret(g, t){
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

// Attach a composite renderer to an enemy entity so it faces movement and aims turret toward e.turretAngle
export function attachKittenRenderer(ent){
  try{
    const size = 64; const bodyC = document.createElement('canvas'); bodyC.width = size; bodyC.height = size; const bg = bodyC.getContext('2d'); bg.imageSmoothingEnabled = false; drawKittenBody(bg);
    const turC = document.createElement('canvas'); turC.width = size; turC.height = size; const tg = turC.getContext('2d'); tg.imageSmoothingEnabled = false; drawKittenTurret(tg);
  // full tile for journal/icon
  try{ if (!ent.tileC){ const full = document.createElement('canvas'); full.width=size; full.height=size; const fg = full.getContext('2d'); fg.imageSmoothingEnabled = false; drawKittenBody(fg); drawKittenTurret(fg); ent.tileC = full; ent.tileG = fg; } }catch(_){ }
    const HUMAN_SCALE = 0.82;
    ent._kitten = { bodyC, turC };
  try{ if (typeof window !== 'undefined') window.__lastKitten = ent; }catch(_){ }
    ent.draw = function(ctx, worldToScreen, camera){
      const ws = worldToScreen(ent.x, ent.y); const sx = ws.x, sy = ws.y;
  // compute body angle with smoothing: prefer internal hull angles, then velocity, then ent.angle;
  // if still missing, face the player as a sensible fallback so the kitty doesn't remain visually frozen
      let bodyAngle = 0;
      try{
        // compute a monotonic, clamped dt early so we can infer a local velocity fallback
        const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const last = ent._kitten._lastDrawTime || now;
        const dtSec = Math.max(0, Math.min(0.1, (now - last) / 1000));
        ent._kitten._lastDrawTime = now;
        // local velocity fallback (track previous draw position on the renderer) so we don't strictly
        // rely on engine-provided ent.vx/ent.vy which may be undefined briefly after spawn
        ent._kitten._prevX = (typeof ent._kitten._prevX === 'number') ? ent._kitten._prevX : ent.x;
        ent._kitten._prevY = (typeof ent._kitten._prevY === 'number') ? ent._kitten._prevY : ent.y;
        const localVx = (ent.x - ent._kitten._prevX) / Math.max(dtSec, 1e-6);
        const localVy = (ent.y - ent._kitten._prevY) / Math.max(dtSec, 1e-6);
        ent._kitten._prevX = ent.x; ent._kitten._prevY = ent.y;

        // smoothing state stored on ent._kitten
        // Use the exact hull rotation logic used in spawnChainedTank: compute desired from
        // entity velocity (wrap not required at entity-level), then smooth toward it. This
        // ensures the kitten rotates the same way as a chained hull.
        let desired = null;
        const aHull = ent._alt && ent._alt.a && typeof ent._alt.a.hullAngle === 'number' ? ent._alt.a.hullAngle : null;
        const bHull = ent._alt && ent._alt.b && typeof ent._alt.b.hullAngle === 'number' ? ent._alt.b.hullAngle : null;
        // prefer internal hull angles if present
        if (aHull !== null && bHull !== null){ desired = (aHull + bHull) / 2; }
        else if (aHull !== null) { desired = aHull; }
        else if (bHull !== null) { desired = bHull; }
        else {
          // derive velocity to use: prefer engine ent.vx/vy otherwise use local fallback
          const vx = (typeof ent.vx === 'number' && typeof ent.vy === 'number') ? ent.vx : localVx;
          const vy = (typeof ent.vx === 'number' && typeof ent.vy === 'number') ? ent.vy : localVy;
          const vel = Math.hypot(vx || 0, vy || 0);
          // match chained hull threshold
          if (vel > 0.02){
            // same transform as chained hulls: atan2 + PI + HULL_ANGLE_OFFSET
            desired = Math.atan2(vy, vx) + Math.PI + HULL_ANGLE_OFFSET;
          } else if (typeof ent.angle === 'number') {
            desired = ent.angle;
          } else if (typeof window !== 'undefined' && window.tank){
            // final fallback: face the player/tank
            const tx = (window.selectedVehicle === 'heli' && window.heli) ? window.heli.x : window.tank.x;
            const ty = (window.selectedVehicle === 'heli' && window.heli) ? window.heli.y : window.tank.y;
            let dy = ty - ent.y;
            if (dy > (window.WORLD_H||3000)/2) dy -= (window.WORLD_H||3000);
            if (dy < -(window.WORLD_H||3000)/2) dy += (window.WORLD_H||3000);
            desired = Math.atan2(dy, tx - ent.x);
          }
        }
  ent._kitten._bodyAngle = (typeof ent._kitten._bodyAngle === 'number') ? ent._kitten._bodyAngle : (desired || 0);
        // If entity is moving, snap the body to the direction of travel so rotation is obvious
        // Use engine-provided vx/vy when available, otherwise use localVx/localVy computed above
          const useVx = (typeof ent.vx === 'number' && typeof ent.vy === 'number') ? ent.vx : localVx;
          const useVy = (typeof ent.vx === 'number' && typeof ent.vy === 'number') ? ent.vy : localVy;
          const moveSpeed = Math.hypot(useVx || 0, useVy || 0);
        // minimum velocity (px/sec) required to snap orientation to travel direction.
        // Bump this up to ignore tiny numerical noise when entity is very far from the player.
        const SNAP_SPEED = 0.5;
        if (moveSpeed > SNAP_SPEED && (typeof useVx === 'number' || typeof useVy === 'number')){
          // immediate snap for clarity; match chained hull math: atan2(vy,vx) + PI + HULL_ANGLE_OFFSET
          ent._kitten._bodyAngle = Math.atan2(useVy, useVx) + Math.PI + HULL_ANGLE_OFFSET;
        } else {
          // near-stationary: keep smoothing toward desired if available
          if (typeof desired === 'number'){
            const angDiff = (a,b)=>{ let d = a - b; while(d > Math.PI) d -= 2*Math.PI; while(d < -Math.PI) d += 2*Math.PI; return d; };
            const turnSpeed = 8; // rad/sec responsiveness
            const maxStep = Math.min(1, turnSpeed * dtSec);
            const delta = angDiff(desired, ent._kitten._bodyAngle || 0);
            ent._kitten._bodyAngle = (ent._kitten._bodyAngle || 0) + delta * maxStep;
          }
        }
  bodyAngle = ent._kitten._bodyAngle || 0;
      }catch(_){ }
      // turret angle: pick desired then smooth (so turrets rotate even when small changes)
      let turretAngle = 0;
      try{
        let desiredT = (typeof ent.turretAngle === 'number') ? ent.turretAngle : null;
        if (desiredT === null){
          const aT = ent._alt && ent._alt.a && typeof ent._alt.a.trot === 'number' ? ent._alt.a.trot : null;
          const bT = ent._alt && ent._alt.b && typeof ent._alt.b.trot === 'number' ? ent._alt.b.trot : null;
          if (aT !== null && bT !== null){ desiredT = (aT + bT) / 2; }
          else if (aT !== null) { desiredT = aT; }
          else if (bT !== null) { desiredT = bT; }
          else if (typeof window !== 'undefined' && window.tank){ const tx = (window.selectedVehicle === 'heli' && window.heli) ? window.heli.x : window.tank.x; const ty = (window.selectedVehicle === 'heli' && window.heli) ? window.heli.y : window.tank.y; let dy = ty - ent.y; if (dy > (window.WORLD_H||3000)/2) dy -= (window.WORLD_H||3000); if (dy < -(window.WORLD_H||3000)/2) dy += (window.WORLD_H||3000); desiredT = Math.atan2(dy, tx - ent.x); }
        }
        // smoothing state for turret - reuse dtSec computed above so smoothing actually moves
        ent._kitten._turretAngle = (typeof ent._kitten._turretAngle === 'number') ? ent._kitten._turretAngle : (typeof desiredT === 'number' ? desiredT : (ent._kitten._bodyAngle || 0));
        if (typeof desiredT === 'number'){
          const angDiff2 = (a,b)=>{ let d = a - b; while(d > Math.PI) d -= 2*Math.PI; while(d < -Math.PI) d += 2*Math.PI; return d; };
          const turnSpeedT = 12; // turret can be snappier
          const maxStep2 = Math.min(1, turnSpeedT * dtSec);
          const deltaT = angDiff2(desiredT, ent._kitten._turretAngle || 0);
          ent._kitten._turretAngle = (ent._kitten._turretAngle || 0) + deltaT * maxStep2;
        }
        turretAngle = ent._kitten._turretAngle || 0;
      }catch(_){ }
      // draw shadow
      try{ const zscale = camera.zoom * HUMAN_SCALE; drawShadow(sx, sy, ent._kitten.bodyC.width, zscale); }catch(_){ drawShadow(sx,sy); }
  // draw body rotated
      try{
  ctx.save(); ctx.translate(sx, sy); ctx.rotate(bodyAngle); const z = camera.zoom * HUMAN_SCALE; ctx.scale(z,z); ctx.translate(-ent._kitten.bodyC.width/2, -ent._kitten.bodyC.height/2); ctx.drawImage(ent._kitten.bodyC, 0,0); ctx.restore();
      }catch(_){ }
      // draw turret rotated over body
      try{
        ctx.save(); ctx.translate(sx, sy); ctx.rotate(turretAngle + Math.PI/2); const z2 = camera.zoom * HUMAN_SCALE; ctx.scale(z2,z2); ctx.translate(-ent._kitten.turC.width/2, -ent._kitten.turC.height/2); ctx.drawImage(ent._kitten.turC, 0,0); ctx.restore();
      }catch(_){ }
      // optional debug overlay: draw velocity heading and applied body angle lines
      try{
        if (typeof window !== 'undefined' && window.__DEBUG_KITTEN_OVERLAY){
          const lineLen = 24 * camera.zoom * HUMAN_SCALE;
          // velocity heading (green)
          const useVx = (typeof ent.vx === 'number' && typeof ent.vy === 'number') ? ent.vx : ((typeof ent._kitten._prevX === 'number') ? ent.x - ent._kitten._prevX : 0);
          const useVy = (typeof ent.vx === 'number' && typeof ent.vy === 'number') ? ent.vy : ((typeof ent._kitten._prevY === 'number') ? ent.y - ent._kitten._prevY : 0);
          const vel = Math.hypot(useVx||0, useVy||0);
          if (vel > 0.001){ const vAng = Math.atan2(useVy, useVx); ctx.save(); ctx.translate(sx, sy); ctx.rotate(vAng + Math.PI + HULL_ANGLE_OFFSET); ctx.strokeStyle = 'rgba(0,255,0,0.9)'; ctx.lineWidth = Math.max(1, 2 * camera.zoom); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(lineLen,0); ctx.stroke(); ctx.restore(); }
          // applied body angle (red)
          const bAng = ent._kitten._bodyAngle || 0; ctx.save(); ctx.translate(sx, sy); ctx.rotate(bAng); ctx.strokeStyle = 'rgba(255,0,0,0.9)'; ctx.lineWidth = Math.max(1, 2 * camera.zoom); ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(lineLen,0); ctx.stroke(); ctx.restore();
        }
      }catch(_){ }
      // one-time debug snapshot to help diagnose runtime fields (non-spammy)
      try{
        if (typeof window !== 'undefined' && !window.__kittenDrawLogged){
          window.__kittenDrawLogged = window.__kittenDrawLogged || 0;
          // log only the first few draws to avoid console spam
          if (window.__kittenDrawLogged < 6){
            window.__kittenDrawLogged++;
            try{ console.log && console.log('attachKittenRenderer draw', { id: ent.kind || '(no-kind)', bodyAngleApplied: bodyAngle, turretAngleApplied: turretAngle, ent_vx: ent.vx, ent_vy: ent.vy, ent_angle: ent.angle, has_alt: !!ent._alt, altA_hull: ent._alt && ent._alt.a && ent._alt.a.hullAngle, altB_hull: ent._alt && ent._alt.b && ent._alt.b.hullAngle, altA_trot: ent._alt && ent._alt.a && ent._alt.a.trot, altB_trot: ent._alt && ent._alt.b && ent._alt.b.trot }); }catch(_){ }
          }
        }
      }catch(_){ }
    };
    return true;
  }catch(_){ return false; }
}

try{ if (typeof globalThis !== 'undefined') globalThis.attachKittenRenderer = attachKittenRenderer; }catch(_){ }

// simple palette mapping to match the demo (hardcoded colors)
const DEFAULT_PALETTE = {
  OUT:'#0b0f12', HDK:'#23402a', HMID:'#2e5a36', HLI:'#3f7a4a', RIM:'#b4e39d', MDK:'#2e2e33', MMID:'#4b4f57', MLI:'#9aa2ad', RUB:'#1b1f24', TRD:'#767d86', SHD:'rgba(0,0,0,.25)', D1:'#9aa2ad22', D2:'#cfd3da22'
};
// debug toggle: set false by default; runtime toggle available with G key
const ALT_DEBUG = false;
let ALT_DEBUG_MODE = ALT_DEBUG;
addEventListener('keydown', e => { try{ if (e.key && e.key.toLowerCase() === 'g'){ ALT_DEBUG_MODE = !ALT_DEBUG_MODE; console.log('alternativetanks: ALT_DEBUG_MODE=', ALT_DEBUG_MODE); } }catch(_){} });
// runtime body scale adjustment: + or = to increase, - to decrease
addEventListener('keydown', e => { try{ if(!e.key) return; if (e.key === '+' || e.key === '='){ TANK_BODY_SCALE = Math.min(2.0, Math.round((TANK_BODY_SCALE + 0.05)*100)/100); console.log('TANK_BODY_SCALE ->', TANK_BODY_SCALE); } else if (e.key === '-'){ TANK_BODY_SCALE = Math.max(0.5, Math.round((TANK_BODY_SCALE - 0.05)*100)/100); console.log('TANK_BODY_SCALE ->', TANK_BODY_SCALE); } }catch(_){} });

// safe bullet push helper: ensures bullets are injected even if `enemyBullets` isn't module-global
function pushEnemyBullet(b){
  try{
    if (typeof enemyBullets !== 'undefined' && Array.isArray(enemyBullets)){
      enemyBullets.push(b); return;
    }
  }catch(_){ }
  try{
    if (typeof window !== 'undefined'){
      window.enemyBullets = window.enemyBullets || [];
      window.enemyBullets.push(b); return;
    }
  }catch(_){ }
  try{ globalThis.enemyBullets = globalThis.enemyBullets || []; globalThis.enemyBullets.push(b); }catch(_){ }
}

// Factory: create an enemy object that game.js can update/draw. We'll store internal state in e._alt
export function spawnChainedTank(x,y,opts={}){
  const p = Object.assign({}, DEFAULT_PALETTE, opts.palette || {});
  // start hulls a bit closer so chain doesn't stretch too far
  const a = { x:x, y:y, vx:0, vy:0, tread:0, trot:0, hullAngle:0 };
  const b = { x:x+58, y:y, vx:0, vy:0, tread:0, trot:Math.PI/10, hullAngle:0 };
  const tail = { segs:10, len:6, nodes:[] };
  for(let i=0;i<tail.segs;i++) tail.nodes.push({ x:a.x, y:a.y+10+i*tail.len, vx:0, vy:0 });
  const now = performance.now()*0.001;
  // default spd matched to other jungle enemies (squidrobot ~18) so movement is natural
  // present as a 'heavy' kind so the engine's jungle AI uses the heavy detection/shoot ranges
  // Provide the same jungle enemy contract fields used by game.js so the
  // global enemy shooting logic will treat this entity like other 'heavy'
  // enemies (attackCD in ms, lastAttack timestamp in ms).
  // shorten attackCD so this enemy fires more often than the original demo
  const ent = { x: (a.x + b.x)/2, y: (a.y + b.y)/2, spd: 18, type: 'jungle', kind: 'heavy', hp: 5, r: 50, harmless: false, lastAttack: 0, attackCD: 700 + Math.random()*300, _alt: { a, b, tail, p, last: now, baseX: a.x, baseBX: b.x, kindOrig: 'chained-heavy', _lastEngineShot: 0 } };
  // create a per-instance tile canvas so the Journal can display an icon for this chained tank
  try{
    const tileW = 64, tileH = 48; const tileC = document.createElement('canvas'); tileC.width = tileW; tileC.height = tileH; const tg = tileC.getContext('2d'); tg.imageSmoothingEnabled = false;
    // draw background
    tg.clearRect(0,0,tileW,tileH);
    // center positions for hulls within tile
    const cx = tileW/2, cy = tileH/2;
    // draw a simplified chain and two small hulls using existing drawChain/drawTank helpers scaled down
    try{
      const scale = Math.max(0.6, Math.min(1, TANK_BODY_SCALE * 0.6));
      // local draw functions expect world coords; we translate/scale to center the mini-tank
      tg.save(); tg.translate(cx, cy); tg.scale(scale, scale);
      // draw chain between two hull centers offset horizontally
      drawChain(tg, -18, 0, 18, 0, 0.5, p, 1);
      // draw left and right hulls (no turret rotation)
      drawTank(tg, -18, 0, 0, 0, 0, 0.0, p, 1);
      drawTank(tg, 18, 0, 0, 0, 0, 0.0, p, 1);
      tg.restore();
    }catch(_){ }
    ent.tileC = tileC;
  }catch(_){ }
  // firing state: per-hull cooldowns and burst tracking
  // Disable the module-local burst shooter (it attempted to manage its own
  // cooldowns). We rely on the centralized game.js shooting logic instead
  // to avoid duplicate bullets. Use a very large cd so the internal code
  // won't start bursts.
  ent._alt.a._shoot = { cd: 1e9, burstRemain: 0, nextShotAt: 0, pending: [] };
  ent._alt.b._shoot = { cd: 1e9, burstRemain: 0, nextShotAt: 0, pending: [] };
  // Replace update/draw with full demo-aligned simulation & render so visuals match exactly
  ent.update = function(dt, nowGlobal, target){
  const dtSec = dt;
  // keep a record of previous entity position so we can compute ent.vx/ent.vy
  try{ ent._alt._prevEntX = (typeof ent._alt._prevEntX === 'number') ? ent._alt._prevEntX : ent.x; ent._alt._prevEntY = (typeof ent._alt._prevEntY === 'number') ? ent._alt._prevEntY : ent.y; }catch(_){ ent._alt = ent._alt || {}; ent._alt._prevEntX = ent.x; ent._alt._prevEntY = ent.y; }
  // game.loop passes `now` as ms; convert to seconds for internal timing
  const tNow = (typeof nowGlobal === 'number') ? (nowGlobal * 0.001) : (performance.now() * 0.001);
      // sync hulls to entity center movement so hulls follow the game-engine moved entity
      try{
        const lastCX = ent._alt.lastCX || ent.x; const lastCY = ent._alt.lastCY || ent.y;
        const dxC = ent.x - lastCX, dyC = ent.y - lastCY;
        if (dxC !== 0 || dyC !== 0){
          // avoid applying huge position deltas (which can fling hulls offscreen)
          const MAX_INSTANT = 64; // pixels
          const invDt = dtSec > 0 ? (1/dtSec) : 0;
          if (Math.abs(dxC) > MAX_INSTANT || Math.abs(dyC) > MAX_INSTANT){
            // smooth large jumps instead of immediate teleport
            const SM = 0.08; // fraction to apply this frame
            const applyDx = dxC * SM; const applyDy = dyC * SM;
            ent._alt.a.x += applyDx; ent._alt.a.y += applyDy; ent._alt.b.x += applyDx; ent._alt.b.y += applyDy;
            ent._alt.a.vx = applyDx * invDt; ent._alt.a.vy = applyDy * invDt; ent._alt.b.vx = applyDx * invDt; ent._alt.b.vy = applyDy * invDt;
          } else {
            ent._alt.a.x += dxC; ent._alt.a.y += dyC; ent._alt.b.x += dxC; ent._alt.b.y += dyC;
            ent._alt.a.vx = dxC * invDt; ent._alt.a.vy = dyC * invDt; ent._alt.b.vx = dxC * invDt; ent._alt.b.vy = dyC * invDt;
          }
        }
        ent._alt.lastCX = ent.x; ent._alt.lastCY = ent.y;
      }catch(_){ }
      // demo parameters
  const AMP = 14, WZ = 2*Math.PI*0.35;
  // Use ent.spd as the authoritative speed cap so tuning the entity affects motion
  // Use moderate spring constants so hulls follow anchors responsively without exploding
  const X_K = 8, Y_K = 8, DAMP = 0.9, SPEED_CAP = (ent.spd || 18);
  const REST = [62,64,66], CHAIN_CORR = 0.45, CHAIN_IMP = 0.2;
      const COLLIDE_MIN = 40, eRest = 0.35, muT = 0.30;
      // lanes/bases: smoothly move ent.x/ent.y toward the target (if provided) and use ent.* as center
      const halfSep = 29;
      if (target && typeof target.x === 'number' && typeof target.y === 'number'){
        // Move ent center like other enemies: advance toward target by ent.spd * dt
        const angToTarget = Math.atan2(target.y - ent.y, target.x - ent.x);
        const sp = (typeof ent.spd === 'number') ? ent.spd : 0;
        ent.x += Math.cos(angToTarget) * sp * dtSec;
        ent.y += Math.sin(angToTarget) * sp * dtSec;
      }
      // compute ent.vx/ent.vy from entity position delta so renderers can orient correctly
      try{
        const prevX = ent._alt._prevEntX || ent.x;
        const prevY = ent._alt._prevEntY || ent.y;
        ent.vx = (ent.x - prevX) / (dtSec || 1);
        ent.vy = (ent.y - prevY) / (dtSec || 1);
        ent._alt._prevEntX = ent.x; ent._alt._prevEntY = ent.y;
      }catch(_){ }
      const lane0Y = ent.y + AMP * Math.sin(WZ * tNow);
      const lane1Y = ent.y + AMP * Math.sin(WZ * tNow + 1.2);
      const bases = [ent.x - halfSep, ent.x + halfSep]; const lanes = [lane0Y, lane1Y];
      const tanks = [ent._alt.a, ent._alt.b];
      for (let i=0;i<2;i++){
        const t = tanks[i];
        t.vx += (bases[i] - t.x) * (X_K * dtSec);
        t.vy += (lanes[i] - t.y) * (Y_K * dtSec);
        t.vx *= DAMP; t.vy *= DAMP;
        const sp = Math.hypot(t.vx, t.vy);
        if (sp > SPEED_CAP){ const s = SPEED_CAP / sp; t.vx *= s; t.vy *= s; }
  t.x += t.vx * dtSec; t.y += t.vy * dtSec;
  // keep turret rotation visually consistent; tread advances with hull speed
  t.trot += Math.PI/70;
  // if a target exists, aim turret from this hull toward the player (use hull position for accuracy)
    if (target && typeof target.x === 'number' && typeof target.y === 'number'){
    // account for vertical world wrapping so turret aims along shortest path
    const WORLD_H = (typeof window !== 'undefined' && window.WORLD_H) ? window.WORLD_H : (3000);
    let dy = target.y - t.y; if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H;
  // apply a 45 degree offset so the turret sprite aligns with the math angle
  // (increase offset by one more notch: use +PI/2 total)
  t.trot = Math.atan2(dy, target.x - t.x) + (Math.PI / 2);
  }
  // advance tread based on travel speed so treads animate only when moving
  const spdNow = Math.hypot(t.vx, t.vy);
  t.tread = (t.tread + (spdNow * 0.12 * dtSec)) % 6;
      // compute hull facing angle from velocity when moving; smooth rotation to avoid jitter
          const vel = Math.hypot(t.vx, t.vy);
          // ignore tiny velocities which tend to fluctuate due to numerical noise
          // (especially when the player/camera is far away). Require a modest
          // minimum speed before recomputing hull facing from velocity.
          if (vel > 0.5){
            const desired = Math.atan2(t.vy, t.vx) + Math.PI + HULL_ANGLE_OFFSET;
            // shortest angular difference (desired - current) in [-PI, PI]
            const angDiff = (a,b)=>{ let d = a - b; while(d > Math.PI) d -= 2*Math.PI; while(d < -Math.PI) d += 2*Math.PI; return d; };
            const turnSpeed = 8; // responsiveness (rad/sec)
            const maxStep = Math.min(1, turnSpeed * dtSec);
            const delta = angDiff(desired, t.hullAngle || 0);
            t.hullAngle = (t.hullAngle || 0) + delta * maxStep;
          }
      }
      // update loose tail nodes so they follow hull A -> B smoothly
      try{
        const nodes = tail.nodes;
        const segLen = tail.len || 6;
        if (nodes && nodes.length){
          // anchor first node directly toward a point below hull A using a positional lerp
          const aPosX = ent._alt.a.x;
          const aPosY = ent._alt.a.y + 10;
          const n0 = nodes[0];
          // stronger positional lerp to avoid falling behind when hulls move
          const lerpFactor = Math.min(1, 8 * dtSec); // responsive but frame-rate independent
          n0.x += (aPosX - n0.x) * lerpFactor;
          n0.y += (aPosY - n0.y) * lerpFactor;
          // several relaxation passes to maintain segment spacing and tighten the chain
          const passes = 3;
          for (let pI = 0; pI < passes; pI++){
            for (let ti = 1; ti < nodes.length; ti++){
              const prev = nodes[ti-1]; const cur = nodes[ti];
              let dx = cur.x - prev.x, dy = cur.y - prev.y; let d = Math.hypot(dx, dy) || 0.0001;
              const desired = segLen;
              const diff = d - desired;
              // compute correction and apply half to each node for stability
              const corr = (diff / d) * 0.5;
              cur.x -= dx * corr; cur.y -= dy * corr;
              prev.x += dx * corr; prev.y += dy * corr;
            }
          }
          // slight damping to reduce jitter
          for (let ti = 0; ti < nodes.length; ti++){ const n = nodes[ti]; n.vx = (n.vx || 0) * 0.96; n.vy = (n.vy || 0) * 0.96; }
        }
      }catch(_){ }
      // hull collision
      let dx = ent._alt.b.x - ent._alt.a.x, dy = ent._alt.b.y - ent._alt.a.y; let dist = Math.hypot(dx,dy)||0.0001;
      if (dist < COLLIDE_MIN){ const nx = dx/dist, ny = dy/dist; const pen = (COLLIDE_MIN - dist)/2; ent._alt.a.x -= nx*pen; ent._alt.a.y -= ny*pen; ent._alt.b.x += nx*pen; ent._alt.b.y += ny*pen; const rvx = ent._alt.b.vx - ent._alt.a.vx, rvy = ent._alt.b.vy - ent._alt.a.vy; const vrel = rvx*nx + rvy*ny; if (vrel<0){ const j = -(1+eRest)*vrel/2; ent._alt.a.vx -= nx*j; ent._alt.a.vy -= ny*j; ent._alt.b.vx += nx*j; ent._alt.b.vy += ny*j; const tx = -ny, ty = nx, vt = rvx*tx + rvy*ty, f = vt * muT / 2; ent._alt.a.vx += tx*f; ent._alt.a.vy += ty*f; ent._alt.b.vx -= tx*f; ent._alt.b.vy -= ty*f; } }

      // chains: enforce pairwise constraints between corresponding anchors
      const aA = anchorsFor(ent._alt.a), bA = anchorsFor(ent._alt.b);
      try{
        for (let i=0;i<3;i++){
          const ax = aA[i].x, ay = aA[i].y, bx = bA[i].x, by = bA[i].y; const L = REST[i] || REST[0];
          let dx = bx - ax, dy = by - ay; let dist = Math.hypot(dx,dy) || 0.0001;
          const ex = dist - L; if (ex <= 0) continue; // slack -> no pull
          const nx = dx / dist, ny = dy / dist; const corr = ex * CHAIN_CORR;
          // pull hulls toward the rest length
          ent._alt.a.x += nx * corr; ent._alt.a.y += ny * corr; ent._alt.b.x -= nx * corr; ent._alt.b.y -= ny * corr;
          // apply impulse to reduce relative separation along chain direction
          const rvx = ent._alt.b.vx - ent._alt.a.vx, rvy = ent._alt.b.vy - ent._alt.a.vy;
          const sep = rvx * nx + rvy * ny; if (sep > 0){ const imp = sep * CHAIN_IMP; ent._alt.a.vx += nx * imp; ent._alt.a.vy += ny * imp; ent._alt.b.vx -= nx * imp; ent._alt.b.vy -= ny * imp; }
        }
      }catch(_){ }
      // firing: simple double-shot bursts per hull
      try{
        for (let hi=0; hi<2; hi++){
          const hull = tanks[hi]; const s = hull._shoot;
          // timers are in seconds relative to tNow
          if (!s) continue;
          // decrease cooldowns
          if (s.cd > 0) s.cd -= dtSec;
          // if currently in a burst, check nextShotAt
          if (s.burstRemain > 0){
            if (tNow >= s.nextShotAt){ // schedule a pending shot for draw-resolution using turret/world angle
                const shootA = hull.trot || 0;
                s.pending.push({ at: tNow, angle: shootA });
                s.burstRemain--; s.nextShotAt = tNow + 0.14; // small inter-shot gap
            }
          } else {
            // not in burst: if cooldown elapsed and we have a target, start a new 4-shot burst
            if (s.cd <= 0 && target){
              s.burstRemain = 4; s.nextShotAt = tNow; s.cd = 2.0 + Math.random()*0.8;
              // expose lastAttack in ms so engine-level logic that checks e.lastAttack works
              try{ ent.lastAttack = (typeof nowGlobal === 'number') ? nowGlobal : (performance.now()); }catch(_){ }
            }
          }
        }
      }catch(_){ /* harmless: game globals may not exist in some contexts */ }

      // expose a representative turret angle on the entity so engine code and debug tooling
      // can read turret orientation (use average of the two hull turrets)
      try{ ent.turretAngle = (ent._alt.a.trot + ent._alt.b.trot) / 2; }catch(_){ }

      // Detect when the engine-level shooting logic has just triggered a shot
      // (game.js sets `ent.lastAttack` when it spawns bullets). When that
      // happens, spawn additional bullets and muzzle flashes from the two
      // hull barrel positions so the chained tank shoots from its barrels
      // and looks more lively. This avoids changing engine.js.
      try{
        const engineShot = ent.lastAttack || 0;
        const seen = ent._alt._lastEngineShot || 0;
        if (engineShot && engineShot !== seen){
          ent._alt._lastEngineShot = engineShot;
          const hulls = [ent._alt.a, ent._alt.b];
          // The engine-level shooting logic already spawns a central bullet when
          // `ent.lastAttack` is set. Schedule 3 additional muzzles that fire
          // from actual turret barrel positions (left/right barrels on each
          // hull) so the chained tank produces a clear 4-shot sequence
          // (1 engine bullet + 3 scheduled muzzles). Use a slightly tighter
          // inter-shot gap and a tiny jitter so the spread feels organic.
          const totalMuzzles = 4; // spawn four muzzles from hull barrels
          const sweepGap = 0.08; // seconds between sequential muzzles (tighter)
          const Lb = 16; // turret barrel local length (matches drawTank)
          ent._alt._globalPending = ent._alt._globalPending || [];
          // barrel local offsets (relative to turret center ~ (0,-1))
          const barrelLocal = [ { x: -5, y: -7 - Lb }, { x: 3, y: -7 - Lb } ];
          // Distribute 4 muzzles across both hulls' barrels: A-left, A-right, B-left, B-right
          for (let i=0;i<totalMuzzles;i++){
            const hullIndex = Math.floor(i / 2); // 0,0,1,1
            const barrelIndex = i % 2; // 0,1,0,1
            const hull = hulls[hullIndex];
            const shootA = hull.trot || 0; // use each hull's turret angle
            const bl = barrelLocal[barrelIndex];
            // turret center in local coords is approximately (0,-1)
            const lx = 0 + bl.x;
            const ly = -1 + bl.y;
            // rotate local barrel point into world-space using hull turret angle
            const rx = Math.cos(shootA) * lx - Math.sin(shootA) * ly;
            const ry = Math.sin(shootA) * lx + Math.cos(shootA) * ly;
            const bx = hull.x + rx;
            const by = hull.y + ry;
            // tiny jitter to timing so the sequence isn't perfectly mechanical
            const at = tNow + (i * sweepGap) + (Math.random() * 0.02 - 0.01);
            ent._alt._globalPending.push({ at: at, angle: shootA, bx: bx, by: by });
            if (ALT_DEBUG || ALT_DEBUG_MODE){ try{ console.log('chainedTank: schedule global muzzle', { i, at, bx, by, hullIndex, barrelIndex }); }catch(_){ } }
          }
        }
      }catch(_){ }
  };

  ent.draw = function(ctx, worldToScreen, camera){
      const a = ent._alt.a, b = ent._alt.b, tail = ent._alt.tail, p = ent._alt.p;
      // anchors in screen space
      const an = anchorsFor(a).map(pt => worldToScreen(pt.x, pt.y));
      const bn = anchorsFor(b).map(pt => worldToScreen(pt.x, pt.y));
      // debug anchors
      try{ if (ALT_DEBUG || ALT_DEBUG_MODE){ if (typeof console !== 'undefined' && console.log) console.log('alt.draw coords', { a:{x:a.x,y:a.y}, b:{x:b.x,y:b.y}, sa: an[1], sb: bn[1], zoom: camera.zoom }); ctx.save(); ctx.fillStyle='magenta'; ctx.fillRect(Math.round(an[1].x)-3,Math.round(an[1].y)-3,6,6); ctx.fillStyle='cyan'; ctx.fillRect(Math.round(bn[1].x)-3,Math.round(bn[1].y)-3,6,6); ctx.restore(); } }catch(_){ }
  // draw chains (screen-space) - respect camera zoom so chains scale when zoom changes
  for (let i=0;i<3;i++) drawChain(ctx, an[i].x, an[i].y, bn[i].x, bn[i].y, 0.5, p, camera.zoom || 1);
      // draw loose tail
  for (let i=0;i<tail.nodes.length-1;i++){ const n = worldToScreen(tail.nodes[i].x, tail.nodes[i].y); const m = worldToScreen(tail.nodes[i+1].x, tail.nodes[i+1].y); drawChain(ctx, n.x, n.y, m.x, m.y, 0.4, p, camera.zoom || 1); }
      // draw tanks at screen positions (pixel-accurate)
      const sa = worldToScreen(a.x, a.y); const sb = worldToScreen(b.x, b.y);
      if (!isFinite(sa.x) || !isFinite(sa.y) || !isFinite(sb.x) || !isFinite(sb.y)) return;
      // debug: draw palette swatches and log missing values
      if (ALT_DEBUG || ALT_DEBUG_MODE){
        try{
          const keys = ['OUT','HDK','HMID','HLI','RIM','MDK','MMID','MLI','RUB','TRD','SHD','D1','D2'];
          let sx = 8, sy = 8;
          for (const k of keys){ const v = p[k]; if (!v) console.log('missing palette key',k,v); px(ctx,sx,sy,8,8,v||'#ff00ff'); sx += 10; if (sx>200){ sx = 8; sy += 12 } }
        }catch(_){ }
      }
  // draw tanks scaled by both the visual tank body scale and the camera zoom
  const visualScale = TANK_BODY_SCALE * (camera && camera.zoom ? camera.zoom : 1);
  drawTank(ctx, sa.x, sa.y, a.tread, a.hullAngle, a.trot, 0.2, p, visualScale);
  drawTank(ctx, sb.x, sb.y, b.tread, b.hullAngle, b.trot, 0.2, p, visualScale);
      // resolve any pending scheduled shots now that drawing/positioning is settled
      try{
        const hulls = [a,b];
        const nowSec = (performance && performance.now) ? (performance.now() * 0.001) : (Date.now() * 0.001);
        // First, resolve any global pending muzzles scheduled across the
        // chained tank span (these were scheduled when engine-level shot fired).
        try{
          const gp = ent._alt._globalPending || [];
          const remainingG = [];
          for (const g of gp){
            if (g.at && g.at > nowSec){ remainingG.push(g); continue; }
            const spdB = 420; const angleF = (g.angle || 0) + FIRE_ANGLE_CORRECTION; const dx = Math.cos(angleF) * spdB, dy = Math.sin(angleF) * spdB;
            pushEnemyBullet({ x: g.bx, y: g.by, dx, dy, life: 3.0, hitR: 8 });
            if (typeof spawnMuzzleFlash === 'function') spawnMuzzleFlash(g.bx, g.by, angleF);
            if (ALT_DEBUG || ALT_DEBUG_MODE) try{ console.log('chainedTank: fired global muzzle', { bx: g.bx, by: g.by, at: g.at }); }catch(_){ }
          }
          ent._alt._globalPending = remainingG;
        }catch(_){ }
        for (let hi=0; hi<2; hi++){
          const hull = hulls[hi]; const s = ent._alt[hi===0 ? 'a' : 'b']._shoot;
          if (!s || !s.pending || s.pending.length === 0) continue;
          // process pending shots whose scheduled time has arrived; re-queue future shots
          const remaining = [];
            while(s.pending.length){
              const shot = s.pending.shift();
              if (shot.at && shot.at > nowSec){ remaining.push(shot); continue; }
              const shootA = shot.angle || hull.trot || 0;
              // Instead of a single center-origin shot, spawn bullets from both
              // turret barrels (left + right) so each hull produces two muzzles.
              const spdB = 420;
              // Barrel geometry taken from drawTank(): turret center ~ (0,-1),
              // left barrel at (-5, -7-Lb), right at (3, -7-Lb).
              const Lb = 16; // matches drawTank's Lb
              const turretCenter = { x: 0, y: -1 };
              const barrelsLocal = [ { x: -5, y: -7 - Lb }, { x: 3, y: -7 - Lb } ];
              for (const bl of barrelsLocal){
                // rotate local barrel point by turret/world angle and translate to hull world position
                const lx = turretCenter.x + bl.x;
                const ly = turretCenter.y + bl.y;
                const rx = Math.cos(shootA) * lx - Math.sin(shootA) * ly;
                const ry = Math.sin(shootA) * lx + Math.cos(shootA) * ly;
                const bx = hull.x + rx;
                const by = hull.y + ry;
                const angleF = shootA + FIRE_ANGLE_CORRECTION;
                const dx = Math.cos(angleF) * spdB, dy = Math.sin(angleF) * spdB;
                pushEnemyBullet({ x: bx, y: by, dx, dy, life: 3.0, hitR: 8 });
                if (typeof spawnMuzzleFlash === 'function') spawnMuzzleFlash(bx, by, angleF);
                try{ if (typeof globalThis !== 'undefined' && globalThis.SFX && typeof globalThis.SFX.playCannonBlast === 'function') globalThis.SFX.playCannonBlast(); }catch(_){ }
                if (ALT_DEBUG || ALT_DEBUG_MODE){ try{ console.log('chainedTank: fired pending', { hull: hi, bx, by, at: shot.at }); }catch(_){ } }
              }
            }
          if (remaining.length) s.pending = remaining.concat(s.pending); else s.pending = [];
        }
      }catch(_){ }
      // debug: sample screen pixel at hull center to see what color actually rendered
      if (ALT_DEBUG || ALT_DEBUG_MODE){ try{ const sx = Math.round(sa.x), sy = Math.round(sa.y); const img = ctx.getImageData(sx, sy, 1, 1).data; console.log('sampleA', sx, sy, img[0],img[1],img[2],img[3]); const sx2 = Math.round(sb.x), sy2 = Math.round(sb.y); const img2 = ctx.getImageData(sx2, sy2, 1, 1).data; console.log('sampleB', sx2, sy2, img2[0],img2[1],img2[2],img2[3]); }catch(_){ console.log('sampling failed',_)} }
    };
  return ent;
}

export default { spawnChainedTank };
