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
// gameold.js commonly uses +PI/2 when turning atan2(vy,vx) into a draw rotation.
// Keep raw physics angles (used for bullets) and apply this offset only for drawing.
const HULL_ANGLE_OFFSET = Math.PI/2; // add 90deg to align art with movement
const FIRE_ANGLE_CORRECTION = 0; // bullets use raw angles, no correction
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

function anchorsFor(t){
  // anchors relative to a hull center. Use wider anchor spread so chain sits outside the hull rims
  // and the chain visually extends further between the two hulls.
  // t may be either a full entity (with .x/.y) or a subpart with same fields.
  try{
    return [
      { x: t.x - 18, y: t.y - 8 },
      { x: t.x + 0,  y: t.y - 8 },
      { x: t.x + 18, y: t.y - 8 }
    ];
  }catch(_){ return [{x: (t.x||0)-12, y: (t.y||0)-6}, {x: (t.x||0), y: (t.y||0)-6}, {x: (t.x||0)+12, y: (t.y||0)-6}]; }
}

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
    if (!ent) return false;
    // Prefer canonical helper (centralized in tank.js) when available
    try{ if (typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRendererCanonical === 'function'){
      const ok = globalThis.attachKittenRendererCanonical(ent);
      if (ok) return true;
    } }catch(_){ }

    const size = 64;
    const bodyC = document.createElement('canvas'); bodyC.width = size; bodyC.height = size; const bg = bodyC.getContext('2d'); if(bg) try{ bg.imageSmoothingEnabled = false; }catch(_){ }
    const turC = document.createElement('canvas'); turC.width = size; turC.height = size; const tg = turC.getContext('2d'); if(tg) try{ tg.imageSmoothingEnabled = false; }catch(_){ }
    // try advanced draw functions, otherwise draw a minimal placeholder so turret exists
    try{ if (typeof drawKittenBody === 'function') drawKittenBody(bg, performance.now()); else { bg.fillStyle = '#2e5a36'; bg.fillRect(0,0,size,size); } }catch(_){ try{ bg.fillStyle='#2e5a36'; bg.fillRect(0,0,size,size); }catch(__){} }
    try{ if (typeof drawKittenTurret === 'function') drawKittenTurret(tg, performance.now()); else { tg.clearRect(0,0,size,size); tg.fillStyle='#5a6a80'; tg.fillRect(0,0,16,16); } }catch(_){ try{ tg.fillStyle='#5a6a80'; tg.fillRect(0,0,16,16); }catch(__){} }

    // full tile for journal/icon if missing
    try{
      if (!ent.tileC){ const full = document.createElement('canvas'); full.width=size; full.height=size; const fg = full.getContext('2d'); if(fg) try{ fg.imageSmoothingEnabled=false; }catch(_){ } try{ if (typeof drawKittenBody === 'function') drawKittenBody(fg); else fg.drawImage(bodyC,0,0); if (typeof drawKittenTurret === 'function') drawKittenTurret(fg); else fg.drawImage(turC,0,0); ent.tileC = full; ent.tileG = fg; }catch(_){ }
      }
    }catch(_){ }

    // If an existing non-empty tile exists, preserve it
    try{
      let shouldAssignTile = false;
      if (!ent.tileC) shouldAssignTile = true;
      else {
        try{ const d = ent.tileG.getImageData(0,0,ent.tileC.width, ent.tileC.height).data; let any=false; for (let k=3;k<d.length;k+=4){ if (d[k] !== 0){ any = true; break; } } if (!any) shouldAssignTile = true; }catch(_){ shouldAssignTile = true; }
      }
      if (shouldAssignTile){
        // Compose a full preview tile that includes both body and turret so
        // the journal/icon and any consumers see the complete kitty illustration
        try{
          const full = document.createElement('canvas'); full.width = size; full.height = size;
          const fg = full.getContext('2d'); if (fg) try{ fg.imageSmoothingEnabled = false; }catch(_){ }
          try{ fg.clearRect(0,0,size,size); fg.drawImage(bodyC,0,0); fg.drawImage(turC,0,0); }catch(_){ }
          ent.tileC = full; ent.tileG = fg;
          try{ if (typeof window !== 'undefined' && window.__KITTY_DEBUG){ console.debug('[kitty-instr] attachKittenRenderer: assigned ent.tileC', full && full.width, full && full.height, ent && (ent.kind||ent.type)); } }catch(_){ }
        }catch(_){
          // fallback to body canvas if composition fails for some environment
          try{ 
            // fallback: compose body+turret into a full preview tile
            try{
              const full = document.createElement('canvas'); full.width = size; full.height = size; const fg = full.getContext('2d'); if (fg) try{ fg.imageSmoothingEnabled = false; }catch(_){ }
              try{ fg.clearRect(0,0,size,size); fg.drawImage(bodyC,0,0); fg.drawImage(turC,0,0); ent.tileC = full; ent.tileG = fg; }
              catch(_){ ent.tileC = bodyC; ent.tileG = bg; }
            }catch(_){ try{ ent.tileC = bodyC; ent.tileG = bg; }catch(__){} }
          }catch(__){}
        }
      }
    }catch(_){ try{ 
        const full = document.createElement('canvas'); full.width = size; full.height = size; const fg = full.getContext('2d'); if (fg) try{ fg.imageSmoothingEnabled = false; }catch(__){}
        try{ fg.clearRect(0,0,size,size); fg.drawImage(bodyC,0,0); fg.drawImage(turC,0,0); ent.tileC = full; ent.tileG = fg; }catch(__){ try{ ent.tileC = bodyC; ent.tileG = bg; }catch(__2){} }
      }catch(__2){ try{ ent.tileC = bodyC; ent.tileG = bg; }catch(__3){} } }

    // ensure turret canvas has visible pixels; if empty, draw the turret into it
    try{
      if (tg){ const id = tg.getImageData(0,0,turC.width,turC.height).data; let any=false; for (let i=3;i<id.length;i+=4){ if (id[i] !== 0){ any = true; break; } } if (!any){ try{ if (typeof drawKittenTurret === 'function') drawKittenTurret(tg); else tg.fillStyle='#5a6a80'; }catch(_){ } }
    } }catch(_){ }

  try{ if (typeof window !== 'undefined' && window.__KITTY_DEBUG){ try{ console.debug('[kitty-instr] attachKittenRenderer: finalizing kitten internals for', ent && (ent.kind||ent.type), 'pos', (ent && ('x' in ent)?ent.x:'?'), (ent && ('y' in ent)?ent.y:'?')); }catch(_){ } } }catch(_){ }
  ent._kitten = ent._kitten || {}; ent._kitten.bodyC = ent._kitten.bodyC || bodyC; ent._kitten.turC = ent._kitten.turC || turC;
  try{ if (typeof window !== 'undefined') window.__lastKitten = ent; }catch(_){ }
    // Optional deep watcher: when enabled this will log any later assignment to
    // ent.tileC, ent.tileG, ent.draw, or ent._kitten (and its bodyC/turC). Enable
    // by setting window.__KITTY_DEBUG_WATCH = true in the console before a cold load.
    try{
      if (typeof window !== 'undefined' && window.__KITTY_DEBUG_WATCH && !ent.__kitty_watch_installed){
    ent.__kitty_watch_installed = true;
        const installPropWatch = (obj, prop)=>{
          try{
            let val = obj[prop];
            Object.defineProperty(obj, prop, {
              configurable: true,
              enumerable: true,
              get(){ return val; },
              set(v){
                  try{ const st = (new Error()).stack; try{ const info = `kind=${(ent && (ent.kind||ent.type))||'unknown'} prop=${prop} old=${String(val)} new=${String(v)}`; console.debug(`[kitty-watch] property set ${info}\nstack:\n${st.split('\n').slice(0,6).join('\n')}`); }catch(_){ console.debug('[kitty-watch] property set', prop); } }catch(_){ }
                  val = v;
                }
            });
          }catch(_){ }
        };
        try{ installPropWatch(ent, 'tileC'); installPropWatch(ent, 'tileG'); installPropWatch(ent, 'draw'); installPropWatch(ent, '_kitten'); }catch(_){ }
        try{ if (ent._kitten){ installPropWatch(ent._kitten, 'bodyC'); installPropWatch(ent._kitten, 'turC'); } }catch(_){ }
        // Also attempt to watch future _kitten.bodyC/turC assignments by wrapping setter on _kitten itself
        try{
          if (!ent.__kitty_watch_inner_installed){
            ent.__kitty_watch_inner_installed = true;
            const origDefine = Object.defineProperty;
            // when _kitten is assigned later, re-install inner watches
            const recheck = ()=>{ try{ if (ent._kitten){ try{ installPropWatch(ent._kitten, 'bodyC'); installPropWatch(ent._kitten, 'turC'); }catch(_){ } } }catch(_){ } };
            // schedule a couple checks in case assignment happens shortly after
            setTimeout(recheck, 8); setTimeout(recheck, 120);
          }
        }catch(_){ }
      }
    }catch(_){ }

    // Additional strong-watch helper: when enabled, always install watchers for this entity
    // regardless of the __KITTY_DEBUG_WATCH flag. This is intended as a temporary debugging
    // aid: set window.__KITTY_DEBUG_FORCE_WATCH = true in the page before load (or via
    // evaluateOnNewDocument) to enable. The watchers will auto-expire after a short interval.
    try{
      // DEBUG CHANGE: install the strong force-watch unconditionally for a short
      // debug run so headless smoke tests reliably capture any later overwrites.
      // Revert this change after capturing traces.
      if (typeof window !== 'undefined' && !ent.__kitty_force_watch_installed){
        ent.__kitty_force_watch_installed = true;
        const installPropWatchForce = (obj, prop)=>{
          try{
            let val = obj[prop];
            Object.defineProperty(obj, prop, {
              configurable: true,
              enumerable: true,
              get(){ return val; },
              set(v){
                    try{ const st = (new Error()).stack; try{ const info = `kind=${(ent && (ent.kind||ent.type))||'unknown'} prop=${prop} old=${String(val)} new=${String(v)}`; console.warn(`[kitty-watch-force] property set ${info}\nstack:\n${st.split('\n').slice(0,8).join('\n')}`); }catch(_){ console.warn('[kitty-watch-force] property set', prop); } }catch(_){ }
                    val = v;
                  }
            });
          }catch(_){ }
        };
        try{ installPropWatchForce(ent, 'tileC'); installPropWatchForce(ent, 'tileG'); installPropWatchForce(ent, 'draw'); installPropWatchForce(ent, '_kitten'); }catch(_){ }
        try{ if (ent._kitten){ installPropWatchForce(ent._kitten, 'bodyC'); installPropWatchForce(ent._kitten, 'turC'); } }catch(_){ }
        // attempt to re-install inner watches shortly after in case _kitten is assigned later
        setTimeout(()=>{ try{ if (ent._kitten){ installPropWatchForce(ent._kitten, 'bodyC'); installPropWatchForce(ent._kitten, 'turC'); } }catch(_){ } }, 16);
        // auto-uninstall after 8 seconds to limit runtime impact
        setTimeout(()=>{
          try{
            // Best-effort: revert watchers by copying current values back as plain props
            try{ if (ent && ent.tileC) { const v = ent.tileC; delete ent.tileC; ent.tileC = v; } }catch(_){ }
            try{ if (ent && ent.tileG) { const v = ent.tileG; delete ent.tileG; ent.tileG = v; } }catch(_){ }
            try{ if (ent && ent.draw) { const v = ent.draw; delete ent.draw; ent.draw = v; } }catch(_){ }
            try{ if (ent && ent._kitten && ent._kitten.bodyC) { const v = ent._kitten.bodyC; delete ent._kitten.bodyC; ent._kitten.bodyC = v; } }catch(_){ }
            try{ if (ent && ent._kitten && ent._kitten.turC) { const v = ent._kitten.turC; delete ent._kitten.turC; ent._kitten.turC = v; } }catch(_){ }
          }catch(_){ }
        }, 8000);
      }
    }catch(_){ }
  try{ if (typeof window !== 'undefined' && window.__KITTY_DEBUG){ try{ const b = (ent._kitten && ent._kitten.bodyC) ? ent._kitten.bodyC.width : null; const t = (ent._kitten && ent._kitten.turC) ? ent._kitten.turC.width : null; const tile = (ent.tileC) ? ent.tileC.width : null; console.debug('[kitty-instr] attachKittenRenderer: finished', { bodyC: b, turC: t, tileC: tile, kind: ent && ent.kind }); }catch(_){ } } }catch(_){ }

  // Temporary global array-insert hook: when force-watch is enabled we also
  // patch Array.prototype.push/unshift to catch late spawns and attach
  // instrumentation immediately. This is only active when
  // __KITTY_DEBUG_FORCE_WATCH is true and will auto-uninstall shortly.
  try{
    if (typeof window !== 'undefined' && window.__KITTY_DEBUG_FORCE_WATCH && !globalThis.__kitty_array_patch_installed){
      globalThis.__kitty_array_patch_installed = true;
      try{
        const origPush = Array.prototype.push;
        const origUnshift = Array.prototype.unshift;
        const hijack = function(orig, args){
          try{
            for (const it of args){
              try{ if (it && it.kind && typeof it.kind === 'string' && it.kind.includes('kitty')){
                try{ attachKittenRenderer(it); }catch(_){ }
              } }catch(_){ }
            }
          }catch(_){ }
          return orig.apply(this, args);
        };
        Array.prototype.push = function(...items){ return hijack(origPush, items); };
        Array.prototype.unshift = function(...items){ return hijack(origUnshift, items); };
        // auto-restore after short interval to limit side-effects
        setTimeout(()=>{
          try{ Array.prototype.push = origPush; Array.prototype.unshift = origUnshift; }catch(_){ }
        }, 8000);
      }catch(_){ }
    }
  }catch(_){ }

  // Diagnostic: when force-watch is enabled, schedule a few quick checks to detect
  // if another module later removes or replaces the canvases we just attached.
  try{
    if (typeof window !== 'undefined' && window.__KITTY_DEBUG_FORCE_WATCH){
      try{
        const savedTile = ent.tileC; const savedKit = ent._kitten && ent._kitten.bodyC;
        const check = (label)=>{
          try{
            const stillTile = !!ent.tileC; const sameTile = ent.tileC === savedTile;
            const stillKit = !!(ent._kitten && ent._kitten.bodyC); const sameKit = (ent._kitten && ent._kitten.bodyC) === savedKit;
            if (!stillTile || !sameTile || !stillKit || !sameKit){
              try{ console.warn('[kitty-detect] tile or kitten replaced', { kind: ent && ent.kind, label, stillTile, sameTile, stillKit, sameKit }); console.trace(); }catch(_){ }
            }
          }catch(_){ }
        };
        setTimeout(()=>check('t+50'), 50); setTimeout(()=>check('t+200'), 200); setTimeout(()=>check('t+500'), 500); setTimeout(()=>check('t+1000'), 1000);
      }catch(_){ }
    }
  }catch(_){ }

    // attach or replace draw only if missing or obviously small placeholder
    try{
      const existingDraw = ent.draw;
      let replace = false;
      // Force-replace draws for legacy kitten-family kinds so we don't leave the
  // legacy placeholder fallback removed. For other entities preserve existing draw.
      try{
  if (ent && ent.kind && (ent.kind === 'kittytank' || (typeof ent.kind === 'string' && ent.kind.includes('kitty')))){
          replace = true;
        } else {
          if (typeof existingDraw !== 'function') replace = true;
          else { try{ const s = existingDraw.toString(); if (s.length < 120 || existingDraw.__is_kitty_fallback) replace = true; }catch(_){ replace = true; } }
        }
      }catch(_){ replace = true; }
      if (replace){
        ent.draw = function(ctx, worldToScreen, camera){
          const HUMAN_SCALE = 0.82;
          let drew = false;
          try{
            // self-heal: if kitten canvases were stripped, reattach
            if (!ent._kitten || !ent._kitten.bodyC || !ent._kitten.turC){
              try{ if (typeof attachKittyIfNeeded === 'function') attachKittyIfNeeded(ent); else if (typeof attachKittenRenderer === 'function') attachKittenRenderer(ent); }catch(_){ }
            }
            const ws = worldToScreen(ent.x, ent.y); const sx = ws.x, sy = ws.y;
            const z = (camera && camera.zoom) ? camera.zoom : 1;
            // (Lightweight) animate body & turret pixel canvases only when frame advances.
            try{
              const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
              const frame = Math.floor(now / 120); // matches 120ms FRAME_MS in drawKitten* helpers
              if (ent._kitten && !ent._kitten._animInit){ ent._kitten._lastFrame = frame - 1; ent._kitten._animInit = true; }
              if (ent._kitten && ent._kitten._lastFrame !== frame){
                // redraw body/turret for new frame (fallbacks already inside helpers)
                try{ if (ent._kitten.bodyC && typeof drawKittenBody === 'function') drawKittenBody(ent._kitten.bodyC.getContext('2d'), now); }catch(_){ }
                try{ if (ent._kitten.turC && typeof drawKittenTurret === 'function') drawKittenTurret(ent._kitten.turC.getContext('2d'), now); }catch(_){ }
                ent._kitten._lastFrame = frame;
                try{ if (typeof window !== 'undefined'){ window.__KITTY_ANIM_DEBUG = (window.__KITTY_ANIM_DEBUG||0)+1; if (window.__KITTY_ANIM_DEBUG < 12) console.debug('[kitty-anim] frame', frame); } }catch(_){ }
              }
            }catch(_){ }
            // derive hull/body angle from velocity so body faces travel; fallback to existing angle
            try{ const s2 = (ent.vx||0)*(ent.vx||0)+(ent.vy||0)*(ent.vy||0); if (s2 > 0.0004){ ent._kitten._bodyAngle = Math.atan2(ent.vy, ent.vx); } }catch(_){ }
            try{ if (ent._kitten && ent._kitten.bodyC){ drawShadow(sx, sy, ent._kitten.bodyC.width, z * HUMAN_SCALE); } }catch(_){ }
            try{ if (ent._kitten && ent._kitten.bodyC){ ctx.save(); ctx.translate(sx, sy); ctx.rotate(ent._kitten._bodyAngle || 0); ctx.scale(z * HUMAN_SCALE, z * HUMAN_SCALE); ctx.translate(-ent._kitten.bodyC.width/2, -ent._kitten.bodyC.height/2); ctx.drawImage(ent._kitten.bodyC,0,0); ctx.restore(); drew = true; } }catch(_){ }
            try{ if (ent._kitten && ent._kitten.turC){ ctx.save(); ctx.translate(sx, sy); ctx.rotate((ent.turretAngle || 0) + Math.PI/2); ctx.scale(z * HUMAN_SCALE, z * HUMAN_SCALE); ctx.translate(-ent._kitten.turC.width/2, -ent._kitten.turC.height/2); ctx.drawImage(ent._kitten.turC,0,0); ctx.restore(); drew = true; } }catch(_){ }
          }catch(_){ /* fall through to placeholder */ }
          // Guaranteed visible placeholder if nothing else drew
          if (!drew){
            try{
              const ws = worldToScreen(ent.x, ent.y); const sx = ws.x, sy = ws.y;
              const z = (camera && camera.zoom) ? camera.zoom : 1;
              drawShadow(sx, sy, 48, z * HUMAN_SCALE);
              ctx.save(); ctx.fillStyle = '#6bd1ff'; ctx.beginPath(); ctx.arc(sx, sy, Math.max(8, 10 * z * HUMAN_SCALE), 0, Math.PI*2); ctx.fill(); ctx.restore();
            }catch(_){ }
          }
        };
        try{ ent.draw.__is_kitty_fallback = false; ent.draw.__is_kitty_canonical = true; }catch(_){ }
      }
    }catch(_){ }

    return true;
  }catch(_){ return false; }
}

try{ if (typeof globalThis !== 'undefined') globalThis.attachKittenRenderer = attachKittenRenderer; }catch(_){ }

// Debug helper: force-install watchers on all current enemies (best-effort). This
// is intended to be called from the console or by automated tests after setting
// window.__KITTY_DEBUG_FORCE_WATCH = true to guarantee per-entity traces.
try{
  if (typeof globalThis !== 'undefined' && !globalThis.__forceInstallKittyWatches){
    globalThis.__forceInstallKittyWatches = function(){
      try{
        const seen = new Set();
        const containers = [];
        try{ if (typeof window !== 'undefined' && window.enemies) containers.push({ name: 'window.enemies', list: window.enemies }); }catch(_){ }
        try{ if (typeof window !== 'undefined' && window.critters) containers.push({ name: 'window.critters', list: window.critters }); }catch(_){ }
        try{ if (typeof window !== 'undefined' && window.animals) containers.push({ name: 'window.animals', list: window.animals }); }catch(_){ }
        try{ if (typeof globalThis !== 'undefined' && globalThis.enemies && !containers.find(c=>c.list===globalThis.enemies)) containers.push({ name: 'global.enemies', list: globalThis.enemies }); }catch(_){ }
        let n = 0;
        for (const c of containers){
          const list = c.list;
          if (!list) continue;
          // If real array
          if (Array.isArray(list)){
            for (let i=0;i<list.length;i++){
              try{ const e = list[i]; if (!e || seen.has(e)) continue; seen.add(e); if (typeof attachKittenRenderer === 'function'){ try{ attachKittenRenderer(e); n++; }catch(_){ } } }catch(_){ }
            }
            continue;
          }
          // If array-like or Proxy, try indexed access up to a cap
          try{
            const L = (typeof list.length === 'number') ? Math.min(300, list.length) : 60;
            for (let i=0;i<L;i++){
              try{ const e = list[i]; if (!e || seen.has(e)) continue; seen.add(e); if (typeof attachKittenRenderer === 'function'){ try{ attachKittenRenderer(e); n++; }catch(_){ } } }catch(_){ }
            }
          }catch(_){ }
        }
        return n;
      }catch(_){ return 0; }
    };
  }
}catch(_){ }

// Temporary deep-interceptor: aggressively replace/define accessors on existing
// entities and install Object.prototype fallbacks so any assignment to
// `tileC`, `tileG`, `_kitten`, or `draw` will emit a console.warn + console.trace.
// This is intended for short-lived debug runs only and will auto-uninstall.
try{
  if (typeof window !== 'undefined' && window.__KITTY_DEBUG_FORCE_WATCH && !globalThis.__kitty_deep_watch_installed){
    globalThis.__kitty_deep_watch_installed = true;
    try{
      const props = ['tileC','tileG','_kitten','draw'];
      const instrumentEntity = (ent)=>{
        if (!ent || typeof ent !== 'object' || ent.__kitty_deep_installed) return;
        ent.__kitty_deep_installed = true;
        try{
          props.forEach(prop=>{
            try{
              if (!Object.prototype.hasOwnProperty.call(ent, prop)){
                let _v = ent[prop];
                Object.defineProperty(ent, prop, {
                  configurable: true,
                  enumerable: true,
                  get(){ return _v; },
                  set(v){ try{ const st = (new Error()).stack; try{ const info = `kind=${(ent && (ent.kind||ent.type))||'unknown'} prop=${prop} old=${String(_v)} new=${String(v)}`; console.warn(`[kitty-deep-watch] assignment to ${prop} ${info}\nstack:\n${st.split('\n').slice(0,8).join('\n')}`); }catch(_e){ console.warn('[kitty-deep-watch] assignment to', prop); } }catch(_e){} _v = v; }
                });
              } else {
                // If own property exists, replace it with an accessor capturing current value
                try{ const cur = ent[prop]; let _v = cur; Object.defineProperty(ent, prop, { configurable: true, enumerable: true, get(){ return _v; }, set(v){ try{ const st = (new Error()).stack; try{ const info = `kind=${(ent && (ent.kind||ent.type))||'unknown'} prop=${prop} old=${String(_v)} new=${String(v)}`; console.warn(`[kitty-deep-watch] overwrite own prop ${prop} ${info}\nstack:\n${st.split('\n').slice(0,8).join('\n')}`); }catch(_e){ console.warn('[kitty-deep-watch] overwrite own prop', prop); } }catch(_e){} _v = v; } }); }catch(_){ }
              }
            }catch(_){ }
          });
          // If _kitten exists now, instrument inner bodyC/turC
          try {
            if (ent._kitten && typeof ent._kitten === 'object'){
              ['bodyC','turC'].forEach(p=>{
                try {
                    if (!Object.prototype.hasOwnProperty.call(ent._kitten, p)){
                    let _v = ent._kitten[p];
                    Object.defineProperty(ent._kitten, p, {
                      configurable:true,
                      enumerable:true,
                      get(){ return _v; },
                      set(v){ try{ const st = (new Error()).stack; try{ const info = `kind=${(ent && (ent.kind||ent.type))||'unknown'} prop=_kitten.${p} old=${String(_v)} new=${String(v)}`; console.warn(`[kitty-deep-watch] _kitten.${p} assignment ${info}\nstack:\n${st.split('\n').slice(0,8).join('\n')}`); }catch(_e){ console.warn('[kitty-deep-watch] _kitten.'+p+' assignment'); } }catch(_e){} _v = v; }
                    });
                  } else {
                      try {
                      const cur = ent._kitten[p]; let _v = cur;
                      Object.defineProperty(ent._kitten, p, {
                        configurable:true,
                        enumerable:true,
                        get(){ return _v; },
                        set(v){ try{ const st = (new Error()).stack; try{ const info = `kind=${(ent && (ent.kind||ent.type))||'unknown'} prop=_kitten.${p} old=${String(_v)} new=${String(v)}`; console.warn(`[kitty-deep-watch] _kitten.${p} overwrite ${info}\nstack:\n${st.split('\n').slice(0,8).join('\n')}`); }catch(_e){ console.warn('[kitty-deep-watch] _kitten.'+p+' overwrite'); } }catch(_e){} _v = v; }
                      });
                    }catch(_){ }
                  }
                }catch(_){ }
              });
            }
          }catch(_){ }
        }catch(_){ }
      };
      // instrument current containers
      try{
        const containers = [window.enemies, window.critters, window.animals];
        containers.forEach(list=>{
          try{
            if (Array.isArray(list)){
              for (const e of list){
                try{ if (e) instrumentEntity(e); }catch(_){ }
              }
            }
          }catch(_){ }
        });
      }catch(_){ }

      // Install prototype fallback so new objects without own prop assignment route here
      const origProtoDefs = {};
      ['tileC','tileG','_kitten','draw'].forEach(p=>{
        try{
          if (!Object.prototype.hasOwnProperty.call(Object.prototype, '__kitty_proto_'+p)){
            const key = '__kitty_proto_'+p;
            origProtoDefs[p] = Object.getOwnPropertyDescriptor(Object.prototype, p) || null;
            Object.defineProperty(Object.prototype, p, {
              configurable: true,
              enumerable: false,
              get(){ return undefined; },
              set(v){ try{ const st = (new Error()).stack; try{ const info = `prop=${p} new=${String(v)}`; console.warn(`[kitty-proto-watch] prototype setter for ${p} ${info}\nstack:\n${st.split('\n').slice(0,8).join('\n')}`); }catch(_){ console.warn('[kitty-proto-watch] prototype setter for', p); } }catch(_){ } Object.defineProperty(this, p, { writable:true, configurable:true, enumerable:true, value: v }); }
            });
          }
        }catch(_){ }
      });

      // Auto-uninstall after 15s: restore prototype descriptors and convert accessors back to values
      setTimeout(()=>{
        try{
          const propsUninstall = ['tileC','tileG','_kitten','draw'];
          // Restore prototype descriptors
          for (const p of propsUninstall){
            try{
              const orig = origProtoDefs[p];
              if (orig){
                try{ Object.defineProperty(Object.prototype, p, orig); }catch(_){ try{ delete Object.prototype[p]; }catch(__){} }
              } else {
                try{ delete Object.prototype[p]; }catch(_){ }
              }
            }catch(_){ }
          }

          // Convert instrumented entity props back to plain values for stability
          try{
            const containers = [window.enemies, window.critters, window.animals];
            for (const list of containers){
              try{
                if (!Array.isArray(list)) continue;
                for (const e of list){
                  try{
                    if (!e || !e.__kitty_deep_installed) continue;
                    for (const prop of propsUninstall){
                      try{
                        const v = e[prop];
                        try{ delete e[prop]; }catch(_){ }
                        try{ e[prop] = v; }catch(_){ }
                      }catch(_){ }
                    }
                    // inner _kitten properties
                    try{
                      if (e._kitten && typeof e._kitten === 'object'){
                        for (const pp of ['bodyC','turC']){
                          try{
                            const vv = e._kitten[pp];
                            try{ delete e._kitten[pp]; }catch(_){ }
                            try{ e._kitten[pp] = vv; }catch(_){ }
                          }catch(_){ }
                        }
                      }
                    }catch(_){ }
                  }catch(_){ }
                }
              }catch(_){ }
            }
          }catch(_){ }
        }catch(_){ }
      }, 15000);
    }catch(_){ }
  }
}catch(_){ }

// ---------------------------------------------------------------------------
// Kitty compatibility helpers (canonicalized here). These mirror helpers that
// used to live in a separate `kittytank.js` module so we can remove that file.
// ---------------------------------------------------------------------------
function normalizeKittyKind(ent){ try{ if (ent && ent.kind === 'kitten') ent.kind = 'kittytank'; }catch(_){ } return ent; }

export function attachKittyIfNeeded(ent){
  if (!ent) return false;
  normalizeKittyKind(ent);
  try{
    if (ent.kind !== 'kittytank') return false;
    if (ent._kitten && ent._kitten._canonical && ent.draw && !ent.draw.__is_kitty_fallback) return true;
    const canon = (typeof globalThis !== 'undefined') ? globalThis.attachKittenRendererCanonical : null;
    if (typeof canon === 'function'){
      try{ if (canon(ent)) return true; }catch(_){ }
    }
    if (typeof attachKittenRenderer === 'function'){
      try{ attachKittenRenderer(ent); return true; }catch(_){ }
    }
    return true;
  }catch(err){ try{ console.warn('attachKittyIfNeeded failed', err); }catch(_){ } return false; }
}

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
  try{ attachKittyIfNeeded(ent); }catch(_){ }
  try{
    if (ent._kitten && ent._kitten.bodyC && ent._kitten.turC){
      try{ if (typeof drawKittenBody === 'function') drawKittenBody(ent._kitten.bodyC.getContext('2d')); }catch(_){ }
      try{ if (typeof drawKittenTurret === 'function') drawKittenTurret(ent._kitten.turC.getContext('2d')); }catch(_){ }
    }
  }catch(_){ }
  if (Array.isArray(enemies)) enemies.push(ent);
  return ent;
}

// Expose compatibility helpers (non-breaking)
try{ if (typeof globalThis !== 'undefined'){ if (!globalThis.normalizeKittyKind) globalThis.normalizeKittyKind = normalizeKittyKind; if (!globalThis.attachKittyIfNeeded) globalThis.attachKittyIfNeeded = attachKittyIfNeeded; if (!globalThis.spawnKittyTank) globalThis.spawnKittyTank = spawnKittyTank; } }catch(_){ }

// Coordinate mutation watcher: attach to any entity to diagnose unexpected clustering at (0,0) or null/NaN propagation.
// Non-destructive: stores original values in hidden slots and defines getters/setters that log only on suspicious changes.
try{
  if (typeof globalThis !== 'undefined' && typeof globalThis.attachCoordWatch !== 'function'){
    globalThis.attachCoordWatch = function(ent, label){
      if (!ent || typeof ent !== 'object') return;
      // Avoid double-wrapping
      if (ent.__coord_watch_applied) return; ent.__coord_watch_applied = true;
      const BAD_RADIUS = 140; // Region near top-left considered suspicious
      const isBad = (vx,vy)=> (Number.isFinite(vx) && Number.isFinite(vy) && vx < BAD_RADIUS && vy < BAD_RADIUS);
      const raw = { x: ent.x, y: ent.y };
      // Try to read world size if exposed globally (non-fatal if absent)
      const WORLD_W = (typeof globalThis !== 'undefined' && typeof globalThis.WORLD_W === 'number') ? globalThis.WORLD_W : null;
      const WORLD_H = (typeof globalThis !== 'undefined' && typeof globalThis.WORLD_H === 'number') ? globalThis.WORLD_H : null;
      let clusterLogged = false; // ensure entered-bad-cluster only fires once per entity
      let largeJumpLoggedCount = 0;
      const MAX_REPEAT_CLUSTER = 1; // single log for cluster entry
      const MAX_LARGE_JUMP_LOGS = 8; // cap noisy large jump logs per entity
      function log(event, nx, ny, extra){
        try{
          const msg = `[coord-watch] ${label||ent.kind||'entity'} ${event} -> (${nx},${ny}) from (${raw.x},${raw.y})`;
          const stack = (new Error('stack')).stack;
          console.warn(msg, extra||'', stack);
        }catch(_){ }
      }
      function define(prop){
        let val = ent[prop];
        Object.defineProperty(ent, prop, {
          configurable: true,
            enumerable: true,
            get(){ return val; },
            set(v){
              const old = val; val = v;
              if (v == null || !Number.isFinite(v)){
                log(prop+':non-finite', v, (prop==='x'?ent.y:ent.x));
                return;
              }
              // Detect potential world wrap: large jump roughly equal to most of world size
              const delta = (old == null) ? 0 : Math.abs(old - v);
              const worldSpanX = (WORLD_W) ? WORLD_W : null;
              const worldSpanY = (WORLD_H) ? WORLD_H : null;
              // Compute deltas for both axes so we can detect wrap that may affect the other coord
              const curX = (prop === 'x') ? v : (typeof ent.x === 'number' ? ent.x : null);
              const curY = (prop === 'y') ? v : (typeof ent.y === 'number' ? ent.y : null);
              const oldX = (prop === 'x') ? old : (typeof raw.x === 'number' ? raw.x : null);
              const oldY = (prop === 'y') ? old : (typeof raw.y === 'number' ? raw.y : null);
              const deltaX = (oldX == null || curX == null) ? 0 : Math.abs(oldX - curX);
              const deltaY = (oldY == null || curY == null) ? 0 : Math.abs(oldY - curY);
              const isWrapX = worldSpanX ? (deltaX > worldSpanX * 0.45) : (deltaX > 1800);
              const isWrapY = worldSpanY ? (deltaY > worldSpanY * 0.45) : (deltaY > 1800);
              const isWrap = isWrapX || isWrapY || (delta > 1800);
              // Cluster entry: only once; suppress if caused by an immediate wrap from far right/bottom to near origin
              if (!clusterLogged && isBad(curX, curY) && !isBad(raw.x, raw.y)){
                if (!isWrap){
                  log(prop+':entered-bad-cluster', curX, curY);
                }
                clusterLogged = true; // mark regardless to avoid future spam
                return;
              }
              // Large jump logging (ignore wrap-induced jumps after first) and cap count
              if (old !== v && delta > 2000){
                if (!isWrap && largeJumpLoggedCount < MAX_LARGE_JUMP_LOGS){
                  log(prop+':large-jump', ent.x, ent.y, { old, new:v, delta });
                  largeJumpLoggedCount++;
                }
                return;
              }
            }
        });
      }
      try{ define('x'); define('y'); }catch(_){ }
      // Immediate check if already bad
      try{ if (isBad(ent.x, ent.y)) log('initial-bad', ent.x, ent.y); }catch(_){ }
    };
  }
}catch(_){ }

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
    // default minimal _src when caller omitted it so we can trace origin
    try{
      if (b && !b._src){
        b._src = { id: null, kind: 'chained-heavy', label: 'chained-heavy', x: b.x, y: b.y };
      }
    }catch(_){ }
    // ensure any provided source metadata contains a human-friendly label
    try{
      if (b && b._src){
        const s = b._src;
        if (!s.label){
          const k = (s.kind || (s._alt && s._alt.kindOrig) || '').toString();
          if (k.indexOf('kitty') !== -1) s.label = 'kittytank';
          else if (k.indexOf('chained') !== -1 || k.indexOf('chain') !== -1) s.label = 'chained-heavy';
          else if (k.indexOf('kraken') !== -1) s.label = 'kraken';
          else if (k.indexOf('squid') !== -1) s.label = 'squidrobot';
          else if (k.length) s.label = k;
          else s.label = 'enemy';
        }
      }
    }catch(_){ }
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
  // Minimal non-destructive factory: return an entity compatible with the game's expectations.
  // Ensure we don't default to 0,0 when callers omit x/y; use a safe fallback near the player
  // or a reasonable map center so entities don't bunch in the top-left.
  let safeX = null, safeY = null;
  try{
    if (typeof x === 'number' && Number.isFinite(x)) safeX = x;
    else if (typeof x === 'string' && x !== '' && !Number.isNaN(Number(x))) safeX = Number(x);
    if (typeof y === 'number' && Number.isFinite(y)) safeY = y;
    else if (typeof y === 'string' && y !== '' && !Number.isNaN(Number(y))) safeY = Number(y);
    // fallback to player position when available
  let playerX = (typeof window !== 'undefined' && window.tank && typeof window.tank.x === 'number') ? window.tank.x : null;
  let playerY = (typeof window !== 'undefined' && window.tank && typeof window.tank.y === 'number') ? window.tank.y : null;
  // If the player's tank is still at the module-initialized origin (0,0), treat as unavailable
  try{ if (playerX === 0 && playerY === 0) { playerX = null; playerY = null; } }catch(_){ }
    if (safeX == null){ if (playerX != null) safeX = playerX + (Math.random()*160 - 80); else safeX = 2000 + (Math.random()*400 - 200); }
    if (safeY == null){ if (playerY != null) safeY = playerY + (Math.random()*160 - 80); else safeY = 1500 + (Math.random()*300 - 150); }
  }catch(_){ safeX = 2000; safeY = 1500; }
  // Clamp to reasonable world bounds to avoid top-left bunching (use global WORLD_* if available)
  try{
    const minPad = 48;
    const w = (typeof globalThis !== 'undefined' && typeof globalThis.WORLD_W === 'number') ? globalThis.WORLD_W : 2000;
    const h = (typeof globalThis !== 'undefined' && typeof globalThis.WORLD_H === 'number') ? globalThis.WORLD_H : 1500;
    const oldX = safeX, oldY = safeY;
    safeX = Math.max(minPad, Math.min(w - minPad, safeX));
    safeY = Math.max(minPad, Math.min(h - minPad, safeY));
    if ((oldX !== safeX || oldY !== safeY) && typeof console !== 'undefined'){
      try{ console.debug && console.debug('spawnChainedTank: clamped spawn coords', { requestedX: oldX, requestedY: oldY, clampedX: safeX, clampedY: safeY }); }catch(_){ }
    }
  }catch(_){ }

  const ent = {
    kind: opts.kind || 'heavy', // Use 'heavy' as base kind instead of 'kittytank'
    x: safeX,
    y: safeY,
    vx: (typeof opts.vx === 'number') ? opts.vx : Number(opts.vx) || 0,
    vy: (typeof opts.vy === 'number') ? opts.vy : Number(opts.vy) || 0,
    angle: 0,
    turretAngle: 0,
  // Provide safe defaults expected by the main game loop to avoid NaN
  // when the engine's jungle behavior queries/moves enemies.
  spd: (typeof opts.spd === 'number') ? opts.spd : 0,
  lastAttack: 0,
  attackCD: 1e9,
  // Default to 6 HP so the chained-heavy behaves like other multi-hit enemies
  hp: (typeof opts.hp === 'number') ? opts.hp : Number(opts.hp) || 6,
  // Expose collision radius and type so the central engine will apply HP-based damage
  r: (typeof opts.r === 'number') ? opts.r : Number(opts.r) || 24,
  type: opts.type || 'jungle',
    _alt: { kindOrig: 'chained-heavy' }, // Set up the _alt property as expected by game logic
    // reserve storage for two linked sub-tanks so other modules (game.js) can inspect a/b
    // will be populated/kept in sync by update()
    _alt: Object.assign({}, { kindOrig: 'chained-heavy' }),
    update(dt){
      // Per-frame update called from game loop: dt is seconds.
      // We'll compute desired velocity toward the provided target or player,
      // smooth the velocity, integrate position, update subparts, aim turrets,
      // and spawn bullets from each hull muzzle on cooldown.
      // Defensive: ensure dt is a small positive number
      if (!dt || !Number.isFinite(dt) || dt <= 0) dt = 0.016;
      // initialize subpart containers if missing
      try{
        if (!this._alt.a) this._alt.a = { x: this.x - 18, y: this.y, vx: this.vx, vy: this.vy, hullAngle: this.angle||0, trot: 0, trotPhase: 0, turretAngle: 0, _lastShot: 0 };
        if (!this._alt.b) this._alt.b = { x: this.x + 18, y: this.y, vx: this.vx, vy: this.vy, hullAngle: this.angle||0, trot: 0, trotPhase: 0, turretAngle: 0, _lastShot: 0 };
      }catch(_){ this._alt.a = { x: this.x - 18, y: this.y, vx: this.vx, vy: this.vy, hullAngle: this.angle||0, trot: 0, trotPhase: 0, turretAngle:0, _lastShot:0 }; this._alt.b = { x: this.x + 18, y: this.y, vx: this.vx, vy: this.vy, hullAngle: this.angle||0, trot: 0, trotPhase: 0, turretAngle:0, _lastShot:0 }; }

      // Determine target: the engine often passes {x,y} as third arg; fall back to global player
      let target = null;
      try{ if (arguments.length >= 3 && arguments[2] && typeof arguments[2].x === 'number') target = arguments[2]; }
      catch(_){ }
      try{ if (!target && typeof window !== 'undefined' && window.__PLAYER_ANCHOR_X != null){ target = { x: window.__PLAYER_ANCHOR_X, y: window.__PLAYER_ANCHOR_Y }; } }catch(_){ }
      try{ if (!target && typeof window !== 'undefined' && window.tank) target = { x: window.tank.x, y: window.tank.y }; }catch(_){ }

  const OFF = (typeof opts.padding === 'number') ? opts.padding : 28; // horizontal offset between the two hull centers (wider to extend chain)
      this._alt.padding = OFF;

      // Desired velocity: always prefer chasing the player when available.
      // Fall back to any provided target argument; idle wander is removed so the
      // chained tank will consistently pursue the player's tank.
  let desiredVx = 0, desiredVy = 0; let hullRot = this.angle || 0; let desiredHeading = null;
      // Helper to compute wrap-aware deltas
      const computeDeltas = (srcX, srcY, dstX, dstY)=>{
        let dx = srcX - dstX, dy = srcY - dstY;
        try{ if (typeof wrapDeltaX === 'function') dx = wrapDeltaX(srcX, dstX); }catch(_){ }
        try{ if (typeof wrapDeltaY === 'function') dy = wrapDeltaY(srcY, dstY); }catch(_){
          try{ if (typeof WORLD_H === 'number'){ if (dy > WORLD_H/2) dy -= WORLD_H; if (dy < -WORLD_H/2) dy += WORLD_H; } }catch(__){ }
        }
        return { dx, dy };
      };

      // Prefer explicit target arg, but always override with the real player if present.
      let chaseTarget = null;
      try{ if (target && typeof target.x === 'number') chaseTarget = target; }catch(_){ }
      try{ if (typeof window !== 'undefined' && window.tank && Number.isFinite(window.tank.x) && Number.isFinite(window.tank.y)) chaseTarget = window.tank; }catch(_){ }

      if (chaseTarget){
        const { dx, dy } = computeDeltas(chaseTarget.x, chaseTarget.y, this.x, this.y);
  const dist = Math.hypot(dx, dy) || 1;
        const maxSpeed = (typeof opts.maxSpeed === 'number') ? opts.maxSpeed : 120; // allow faster chase by default
        const MIN_SPEED = (typeof opts.minSpeed === 'number') ? opts.minSpeed : 36;
        // Speed ramps with distance but enforces a minimum so the hulls visibly translate
        const desiredSpeed = Math.max(MIN_SPEED, Math.min(maxSpeed, dist * 0.9));
  desiredVx = (dx / dist) * desiredSpeed;
  desiredVy = (dy / dist) * desiredSpeed;
  desiredHeading = Math.atan2(desiredVy, desiredVx);
  hullRot = desiredHeading;
      } else {
        // If no meaningful target is available, keep current heading (no idle wandering)
        desiredVx = this.vx || 0; desiredVy = this.vy || 0;
        hullRot = Math.atan2(this.vy || 0, this.vx || 0) || 0;
      }

      // Smooth velocity toward desired (per-second smoothing weight)
      const SMOOTH = 0.18;
      this.vx = (1-SMOOTH)*this.vx + SMOOTH*desiredVx;
      this.vy = (1-SMOOTH)*this.vy + SMOOTH*desiredVy;

      // Align velocity direction to the desired heading so the hull actually
      // moves in the direction it is steering toward. Preserve speed after
      // smoothing but rotate the vector to point along desiredVx/desiredVy.
      try{
        if (typeof desiredVx === 'number' && typeof desiredVy === 'number'){
          const speedAfter = Math.hypot(this.vx || 0, this.vy || 0);
          const dh = (typeof desiredHeading === 'number') ? desiredHeading : Math.atan2(desiredVy, desiredVx);
          if (speedAfter > 1e-6){
            this.vx = Math.cos(dh) * speedAfter;
            this.vy = Math.sin(dh) * speedAfter;
          } else {
            // give a tiny nudge in the desired direction to start moving
            const TINY = 0.5;
            this.vx = Math.cos(dh) * TINY;
            this.vy = Math.sin(dh) * TINY;
          }
        }
      }catch(_){ }

      // recompute hull rotation from current velocity (match gameold behavior)
      try{
        const speedNow = Math.hypot(this.vx || 0, this.vy || 0);
        if (speedNow > 0.0004){ hullRot = Math.atan2(this.vy, this.vx); }
        else { hullRot = (typeof this.angle === 'number') ? this.angle : hullRot; }
      }catch(_){ /* ignore */ }

      // Ensure the tank moves forward: enforce a minimum forward speed so the
      // chained hulls visibly translate across the world instead of idling.
      try{
        const MIN_FORWARD_SPEED = (typeof opts.minSpeed === 'number') ? opts.minSpeed : 36; // units/sec
        const curSp = Math.hypot(this.vx || 0, this.vy || 0);
        if (!Number.isFinite(curSp) || curSp < MIN_FORWARD_SPEED){
          // prefer desiredHeading when available so forward enforcement matches chase
          const dh = (typeof desiredHeading === 'number') ? desiredHeading : hullRot;
          this.vx = Math.cos(dh) * MIN_FORWARD_SPEED;
          this.vy = Math.sin(dh) * MIN_FORWARD_SPEED;
        }
      }catch(_){ }

      // integrate position
      // keep previous good coords so we can recover per-axis if NaN appears
      const _prevX = (typeof this._lastGoodX === 'number') ? this._lastGoodX : this.x;
      const _prevY = (typeof this._lastGoodY === 'number') ? this._lastGoodY : this.y;
      // record pre-integration velocities for diagnostics
      const _preVx = this.vx; const _preVy = this.vy;
      // Throttled debug: show move intent once per entity a few times so
      // we can observe whether velocities are non-zero and why motion may be blocked.
      try{
        this._alt = this._alt || {};
        this._alt._moveDebugCount = this._alt._moveDebugCount || 0;
        if (this._alt._moveDebugCount < 6){
          try{ console.debug('[alternativetanks][move-debug]', { x: this.x, y: this.y, vx: this.vx, vy: this.vy, desiredVx: desiredVx, desiredVy: desiredVy, desiredHeading: desiredHeading, speed: Math.hypot(this.vx||0, this.vy||0), dt }); }catch(_){ }
          this._alt._moveDebugCount++;
        }
      }catch(_){ }
      // Compute proposed new coordinates without touching the entity's properties
      const _newX = this.x + (this.vx || 0) * dt;
      const _newY = this.y + (this.vy || 0) * dt;
      // Defensive: validate before assignment so attachCoordWatch setters never
      // observe a NaN value (which previously produced noisy logs and occasional
      // downstream failures). If invalid, restore from last-good or spawnSafe.
      try{
        if (!Number.isFinite(_newX) || !Number.isFinite(_newY)){
          const s = this._spawnSafe || { x: 2000, y: 1500 };
          this._alt = this._alt || {};
          this._alt._nanDebugCount = this._alt._nanDebugCount || 0;
          if (this._alt._nanDebugCount < 4){
            const dbg = {
              dt: dt,
              target: (target && typeof target.x === 'number') ? { x: target.x, y: target.y } : null,
              desiredVx: (typeof desiredVx !== 'undefined') ? desiredVx : null,
              desiredVy: (typeof desiredVy !== 'undefined') ? desiredVy : null,
              preSmoothVx: _preVx, preSmoothVy: _preVy,
              postSmoothVx: this.vx, postSmoothVy: this.vy,
              prevGoodX: _prevX, prevGoodY: _prevY,
              spawnSafe: s
            };
            try{ console.warn('[alternativetanks] NaN prevented in integration - diagnostic', dbg); }catch(_){ }
          }
          this._alt._nanDebugCount++;

          // Recover per-axis using last-good values or spawn-safe defaults
          const safeX = Number.isFinite(_prevX) ? _prevX : (Number.isFinite(s.x) ? s.x : 2000);
          const safeY = Number.isFinite(_prevY) ? _prevY : (Number.isFinite(s.y) ? s.y : 1500);
          // Assign only finite fallbacks so attachCoordWatch doesn't log NaN
          this.x = safeX; this.y = safeY;
          if (!Number.isFinite(this.vx)) this.vx = 0; if (!Number.isFinite(this.vy)) this.vy = 0;
          try{ this._alt._nanLogged = (this._alt._nanLogged || 0) + 1; }catch(_){ }
        } else {
          // All-good: commit both axes in a single assignment event
          this.x = _newX; this.y = _newY;
          // remember last-good coords for future recovery
          this._lastGoodX = this.x; this._lastGoodY = this.y;
        }
      }catch(_){
        // Fallback: if anything inside validation fails, restore to spawn safe
        try{ const s = this._spawnSafe || { x: 2000, y: 1500 }; this.x = s.x; this.y = s.y; this.vx = 0; this.vy = 0; }catch(__){}
      }
      // small damping to avoid drifting to non-finite tiny values
      if (Math.abs(this.vx) < 1e-6) this.vx = 0;
      if (Math.abs(this.vy) < 1e-6) this.vy = 0;

      // update subpart positions relative to main entity
      this._alt.a.x = this.x - OFF; this._alt.a.y = this.y; this._alt.a.vx = this.vx; this._alt.a.vy = this.vy; this._alt.a.hullAngle = hullRot;
      this._alt.b.x = this.x + OFF; this._alt.b.y = this.y; this._alt.b.vx = this.vx; this._alt.b.vy = this.vy; this._alt.b.hullAngle = hullRot;

      // per-subpart turret rotation: assign directly (no smoothing) to match canonical atan2 usage
      const globalTurret = (typeof this.turretAngle === 'number') ? this.turretAngle : hullRot;
      try{
        if (target && typeof target.x === 'number'){
          // compute wrap-aware aiming deltas per-subpart so turret angles match world wrapping
          let dax = target.x - this._alt.a.x, day = target.y - this._alt.a.y;
          let dbx = target.x - this._alt.b.x, dby = target.y - this._alt.b.y;
          try{ if (typeof wrapDeltaX === 'function'){ dax = wrapDeltaX(target.x, this._alt.a.x); dbx = wrapDeltaX(target.x, this._alt.b.x); } }catch(_){ }
          try{ if (typeof wrapDeltaY === 'function'){ day = wrapDeltaY(target.y, this._alt.a.y); dby = wrapDeltaY(target.y, this._alt.b.y); } }catch(_){ }
          const ta = Math.atan2(day, dax);
          const tb = Math.atan2(dby, dbx);
          this._alt.a.turretAngle = ta;
          this._alt.b.turretAngle = tb;
          this.turretAngle = (ta + tb) * 0.5;
        } else {
          this._alt.a.turretAngle = globalTurret; this._alt.b.turretAngle = globalTurret; this.turretAngle = globalTurret;
        }
      }catch(_){ this._alt.a.turretAngle = globalTurret; this._alt.b.turretAngle = globalTurret; this.turretAngle = globalTurret; }

      // animate trot/tread phase
      const speedFactor = Math.hypot(this.vx || 0, this.vy || 0);
      const trotInc = (0.9 + Math.min(6, speedFactor*0.02)) * dt;
      this._alt.a.trot = (this._alt.a.trot || 0) + trotInc;
      this._alt.b.trot = (this._alt.b.trot || 0) + trotInc;
      this._alt.a.trotPhase = (this._alt.a.trotPhase || 0) + trotInc * 4;
      this._alt.b.trotPhase = (this._alt.b.trotPhase || 0) + trotInc * 4;

      // Periodic shooting: each hull fires from its muzzle with independent cooldowns
      try{
        const nowMs = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
        const baseCd = 900; // base cooldown ms
        const variance = 700;
        const shootSpeed = 320;
        const hitR = 8;
        const muzzleOff = 14; // px in front of hull center
        // helper to spawn one hull shot
            const spawnHullShot = (sub)=>{
          try{
            const ang = sub.turretAngle || globalTurret || 0;
            const bx = sub.x + Math.cos(ang) * muzzleOff;
            const by = sub.y + Math.sin(ang) * muzzleOff;
            const dx = Math.cos(ang) * shootSpeed;
            const dy = Math.sin(ang) * shootSpeed;
            // follow engine convention: enemyBullets entries use dx/dy and life
              try{
                const bullet = { x: bx, y: by, dx, dy, life: 3.0, hitR, _src: { id: (this && this.id) ? this.id : null, kind: (this && (this.kind || (this._alt && this._alt.kindOrig))) ? (this.kind || (this._alt && this._alt.kindOrig)) : 'chained-heavy', label: 'chained-heavy', hull: (sub === this._alt.a ? 'a' : 'b'), x: sub.x, y: sub.y } };
                // If this chained tank instance was created as a mini-ally, mark bullets so they don't harm player
                try{ if (this && this._isMiniAlly){ bullet._ignorePlayer = true; bullet._fromAlly = true; } }catch(_){ }
                pushEnemyBullet(bullet);
              }catch(_){ }
            // muzzle flash for visual parity
            try{ if (typeof spawnMuzzleFlash === 'function') spawnMuzzleFlash(bx, by, ang); }catch(_){ try{ if (typeof window !== 'undefined' && window.spawnMuzzleFlash) window.spawnMuzzleFlash(bx, by, ang); }catch(__){} }
          }catch(_){ }
        };

        // a
        try{
          this._alt.a._lastShot = this._alt.a._lastShot || 0;
          const cdA = baseCd + Math.floor(Math.random()*variance);
          if (nowMs - this._alt.a._lastShot > cdA){ this._alt.a._lastShot = nowMs; spawnHullShot(this._alt.a); }
        }catch(_){ }
        // b
        try{
          this._alt.b._lastShot = this._alt.b._lastShot || 0;
          const cdB = baseCd + Math.floor(Math.random()*variance);
          if (nowMs - this._alt.b._lastShot > cdB){ this._alt.b._lastShot = nowMs; spawnHullShot(this._alt.b); }
        }catch(_){ }
      }catch(_){ }
    },
    draw: function(ctx, worldToScreen, camera){
      // Draw two linked tanks (a & b) and a visible chain between anchors
      try {
        const z = (camera && camera.zoom) ? camera.zoom : 1;
        const pal = DEFAULT_PALETTE || { OUT:'#0b0f12', HDK:'#23402a', HMID:'#2e5a36', HLI:'#3f7a4a', RIM:'#b4e39d', MDK:'#2e2e33', MMID:'#4b4f57', MLI:'#9aa2ad', RUB:'#1b1f24', TRD:'#767d86', SHD:'rgba(0,0,0,.25)', D1:'#9aa2ad22', D2:'#cfd3da22' };

        // ensure subparts exist
        if (!this._alt) this._alt = { kindOrig: 'chained-heavy' };
        if (!this._alt.a || !this._alt.b){
          // fallback single-body draw if subparts missing
          const ws = worldToScreen(this.x, this.y); const sx = ws.x, sy = ws.y;
          ctx.save(); ctx.translate(sx, sy); ctx.scale(z, z);
          drawTank(ctx, 0, 0, Math.floor(performance.now() / 100) % 10, ((this.angle||0) + HULL_ANGLE_OFFSET), ((this.turretAngle||0) + HULL_ANGLE_OFFSET), 0, pal, 1);
          ctx.restore();
          return;
        }

        const a = this._alt.a; const b = this._alt.b;
        const wsA = worldToScreen(a.x, a.y); const wsB = worldToScreen(b.x, b.y);

        // draw connecting chain between corresponding anchors
        try{
          const anchorsA = anchorsFor(a); const anchorsB = anchorsFor(b);
          ctx.save(); ctx.lineWidth = Math.max(1, Math.round(1.5 * z)); ctx.strokeStyle = '#c0c6cf'; ctx.fillStyle = '#c0c6cf';
          for (let i=0;i<Math.min(anchorsA.length, anchorsB.length); i++){
            const pa = worldToScreen(anchorsA[i].x, anchorsA[i].y); const pb = worldToScreen(anchorsB[i].x, anchorsB[i].y);
            const dist = Math.hypot(pb.x-pa.x, pb.y-pa.y);
            const steps = Math.max(2, Math.floor(dist/6)); // place chain links about 6px apart on screen
            // add slight sinusoidal offset so chain looks organic
            for (let s=0;s<=steps;s++){
              const t = s/steps;
              // draw two parallel strands (double-wrap) with a small perpendicular offset and phase shift
              for (let strand=0; strand<2; strand++){
                const fxBase = pa.x + (pb.x - pa.x) * t;
                const fyBase = pa.y + (pb.y - pa.y) * t;
                // perpendicular vector from A->B (screen space)
                let perpX = -(pb.y - pa.y);
                let perpY = (pb.x - pa.x);
                let plen = Math.hypot(perpX, perpY) || 1;
                perpX /= plen; perpY /= plen;
                const strandOffset = (strand === 0) ? -1.8 : 1.8; // px offset for strands (screen-space)
                const phase = t * Math.PI * 2 + (i * 0.7) + (strand === 0 ? 0 : Math.PI * 0.9);
                const wiggle = Math.sin(phase) * Math.min(2, z * 1.5);
                const fx = fxBase + perpX * strandOffset * Math.max(1, z) + wiggle;
                const fy = fyBase + perpY * strandOffset * Math.max(1, z) + wiggle;
                // draw small chain links as 2x2 pixels (use px helper if available)
                try{ px(ctx, Math.round(fx)-1, Math.round(fy)-1, 2, 2, '#bfc6cf'); }catch(_){ try{ ctx.fillRect(Math.round(fx)-1, Math.round(fy)-1, 2, 2); }catch(__){} }
              }
            }
          }
          ctx.restore();
        }catch(_){ }

        // draw both tank bodies
        try{
          ctx.save(); ctx.translate(wsA.x, wsA.y); ctx.scale(z, z);
          drawTank(ctx, 0, 0, Math.floor(performance.now() / 100) % 10, ((a.hullAngle||0) + HULL_ANGLE_OFFSET), (((this.turretAngle||a.hullAngle||0) + HULL_ANGLE_OFFSET)), 0, pal, 1);
          ctx.restore();
        }catch(_){ }
        try{
          ctx.save(); ctx.translate(wsB.x, wsB.y); ctx.scale(z, z);
          drawTank(ctx, 0, 0, Math.floor(performance.now() / 100) % 10, ((b.hullAngle||0) + HULL_ANGLE_OFFSET), (((this.turretAngle||b.hullAngle||0) + HULL_ANGLE_OFFSET)), 0, pal, 1);
          ctx.restore();
        }catch(_){ }
      } catch (e) {
        // Fallback: draw a simple rectangle if drawTank fails
        try {
          const ws = worldToScreen(this.x, this.y);
          ctx.fillStyle = '#666666';
          ctx.fillRect(ws.x - 20, ws.y - 15, 40, 30);
          ctx.fillStyle = '#444444';
          ctx.fillRect(ws.x - 15, ws.y - 10, 30, 20);
        } catch (fallbackError) {
          // Ultimate fallback: do nothing
        }
      }
    }
  };
  // attach a lightweight spawn stack for diagnostics (helps trace where entities come from)
  try{ ent.__spawn_stack = (new Error('spawned')).stack; }catch(_){ }
  // remember initial safe spawn coords so we can recover if an update produces NaN
  try{ ent._spawnSafe = { x: safeX, y: safeY }; }catch(_){ ent._spawnSafe = { x: 2000, y: 1500 }; }
  // Chain tank uses its own draw function, no need for kitten renderer
  // try{ if (typeof attachKittenRenderer === 'function') attachKittenRenderer(ent); }catch(_){ }
  // simple shoot helper for compatibility with existing code
  ent.shoot = function(speed, angle){ try{ const dx = Math.cos(angle) * speed; const dy = Math.sin(angle) * speed; pushEnemyBullet({ x: this.x, y: this.y, dx, dy, life: 3.0, hitR: 8 }); try{ if (typeof window !== 'undefined' && window.spawnMuzzleFlash) window.spawnMuzzleFlash(this.x + Math.cos(angle)*14, this.y + Math.sin(angle)*14, angle); }catch(_){ } }catch(_){ } };
  // Attach coordinate watcher for diagnostics
  try{ if (typeof attachCoordWatch === 'function') attachCoordWatch(ent, ent.kind || 'heavy'); }catch(_){ }
  return ent;
}

// default export for compatibility
export default { spawnChainedTank };

// On module load try to retrofit any already-spawned entities so late-loading this
// module doesn't leave kitty/kraken/squid visuals mangled. We prefer the canonical
// renderer exported from `tank.js` when available, but fall back to local helpers.
(async function _retrofitExistingEnemies(){
  try{
    // Try to import the canonical renderer from tank.js (may already be global)
    try{
      const mod = await import('./tank.js');
      if (mod && typeof mod.attachKittenRendererCanonical === 'function'){
        try{ globalThis.attachKittenRendererCanonical = mod.attachKittenRendererCanonical; }catch(_){ }
      }
      // Also prefer draw helpers if provided
      if (mod && typeof mod.drawKittenBody === 'function') try{ globalThis.drawKittenBody = mod.drawKittenBody; }catch(_){ }
      if (mod && typeof mod.drawKittenTurret === 'function') try{ globalThis.drawKittenTurret = mod.drawKittenTurret; }catch(_){ }
    }catch(_){ /* ignore dynamic import failures */ }

    const attachPreferred = (typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRendererCanonical === 'function') ? globalThis.attachKittenRendererCanonical : attachKittenRenderer;

    // If the runtime already has enemies, attempt to attach nicer renderers to them.
    let retrofitted = 0;
    if (typeof window !== 'undefined' && Array.isArray(window.enemies)){
      for (const ent of window.enemies){
        try{
          if (!ent || !ent.kind) continue;
          // Kitty-family: ensure _kitten body/turret canvases exist and attach renderer if missing
          if (ent.kind === 'kittytank' || (typeof ent.kind === 'string' && ent.kind.includes('kitty'))){
            if (!ent._kitten || !ent._kitten.bodyC || !ent._kitten.turC){
              try{ attachPreferred(ent); retrofitted++; }catch(_){ try{ attachKittenRenderer(ent); retrofitted++; }catch(__){} }
            }
          }
          // Kraken / squid: attempt to ensure a preview tile exists so visuals aren't blank
          else if (ent.kind === 'kraken' || ent.kind === 'squidrobot'){
            if (!ent.tileC){
              try{
                // if host exposes a helper, prefer it
                if (typeof globalThis.attachKrakenRenderer === 'function'){
                  try{ globalThis.attachKrakenRenderer(ent); retrofitted++; continue; }catch(_){ }
                }
                // best-effort: if a draw helper exists, compose a tile
                if (typeof globalThis.drawKrakenTile === 'function'){
                  const c = document.createElement('canvas'); c.width = 64; c.height = 64; const g = c.getContext('2d'); if (g) try{ g.imageSmoothingEnabled = false; }catch(_){ }
                  try{ globalThis.drawKrakenTile(g); ent.tileC = c; ent.tileG = g; retrofitted++; }catch(_){ }
                }
              }catch(_){ }
            }
          }
        }catch(_){ }
      }
    }
    try{ if (retrofitted > 0 && typeof console !== 'undefined' && console.debug) console.debug('[alternativetanks] retrofitted existing enemies', retrofitted); }catch(_){ }
  }catch(_){ }
})();

// Immediate retrofit via Proxy: wrap `window.enemies` so any future pushes/unshifts/splices
// that add new enemies will get the kitten renderer attached synchronously.
(function _wrapEnemiesWithProxy(){
  try{
    if (typeof window === 'undefined') return;
    if (window.__alt_enemies_proxy_installed) return; // idempotent
    const makeProxy = (arr)=>{
      if (!Array.isArray(arr)) return arr;
      // attach existing items first
  try{ for (const e of arr){ if (e && e.kind && (e.kind === 'kittytank' || (typeof e.kind === 'string' && e.kind.includes('kitty')))){ try{ const preferred = (typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRendererCanonical === 'function') ? globalThis.attachKittenRendererCanonical : attachKittenRenderer; if (preferred) preferred(e); else attachKittenRenderer(e); }catch(_){ } } } }catch(_){ }
      const maybeAttach = (it)=>{
        try{
          if (!it || !it.kind) return;
          // (legacy placeholder removed)
          if (it._kitten && it._kitten.bodyC && it._kitten.turC) return;
          if (it.kind === 'kittytank' || (typeof it.kind === 'string' && it.kind.includes('kitty'))){
            try{ const preferred = (typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRendererCanonical === 'function') ? globalThis.attachKittenRendererCanonical : attachKittenRenderer; if (preferred) { preferred(it); return; } attachKittenRenderer(it); }catch(_){ }
          }
        }catch(_){ }
      };
      const handler = {
        get(target, prop){
          if (prop === 'push') return function(...items){ try{ items.forEach(it=>{ try{ if (it && (it._isMiniAlly || it._allySpawn)) { try{ console.debug && console.debug('[alternativetanks] enemies.push detected mini-ally or ally-spawned entity', { kind: it.kind, x: it.x, y: it.y, _isMiniAlly: it._isMiniAlly, _allySpawn: it._allySpawn, __spawn_stack: it.__spawn_stack }); }catch(_){} } }catch(_){} try{ maybeAttach(it); }catch(_){ } }); }catch(_){ } return Array.prototype.push.apply(target, items); };
          if (prop === 'unshift') return function(...items){ try{ items.forEach(maybeAttach); }catch(_){ } return Array.prototype.unshift.apply(target, items); };
          if (prop === 'splice') return function(start, deleteCount, ...items){ try{ if (items && items.length) items.forEach(maybeAttach); }catch(_){ } return Array.prototype.splice.apply(target, [start, deleteCount, ...items]); };
          const val = Reflect.get(target, prop);
          return (typeof val === 'function') ? val.bind(target) : val;
        },
        set(target, prop, value){
          try{
            // detect numeric index writes like enemies[3] = obj and attempt to
            // attach the kitten renderer immediately so we can log a stack trace
            // showing who performed the overwrite.
            const isIndex = (typeof prop === 'string' && String(Number(prop)) === prop && Number.isInteger(Number(prop)) && Number(prop) >= 0);
            if (isIndex){
              try{ maybeAttach(value); }catch(_){ }
              try{ if (typeof console !== 'undefined' && console.warn){ const st = (new Error()).stack; console.warn('[alternativetanks][proxy] enemies[index] assignment', { idx: prop, kind: value && value.kind, stack: st }); } }catch(_){ }
            }
          }catch(_){ }
          return Reflect.set(target, prop, value);
        }
      };
      return new Proxy(arr, handler);
    };

    const installIfPresent = ()=>{
      try{
        if (Array.isArray(window.enemies) && !window.__alt_enemies_proxy_installed){
          const p = makeProxy(window.enemies);
          try{ Object.defineProperty(window, 'enemies', { value: p, writable: true, configurable: true, enumerable: true }); }catch(_){ window.enemies = p; }
          window.__alt_enemies_proxy_installed = true;
        }
      }catch(_){ }
    };

    // Install now if already present
    installIfPresent();
    // And re-attempt in case game sets `window.enemies` later
    const id = setInterval(()=>{ try{ if (!window.__alt_enemies_proxy_installed) installIfPresent(); else clearInterval(id); }catch(_){ clearInterval(id); } }, 250);
  }catch(_){ }
})();

// Periodic watcher: some enemies spawn after this module loads (race conditions).
// Ensure late-spawned kitty enemies receive the kitten renderer within a short window.
(function _periodicKittenRetrofit(){
  try{
    const intervalMs = 1500;
    const attachFn = function(ent){
      try{
        const preferred = (typeof globalThis !== 'undefined' && typeof globalThis.attachKittenRendererCanonical === 'function') ? globalThis.attachKittenRendererCanonical : attachKittenRenderer;
        if (preferred) { try{ preferred(ent); return; }catch(_){ } }
        try{ attachKittenRenderer(ent); }catch(_){ }
      }catch(_){ }
    };
    setInterval(()=>{
      try{
        const list = (typeof window !== 'undefined' && Array.isArray(window.enemies)) ? window.enemies : (Array.isArray(globalThis.enemies) ? globalThis.enemies : null);
        if (!list) return;
        for (const ent of list){
          try{
            if (!ent || !ent.kind) continue;
            if (ent.kind === 'kittytank' || (typeof ent.kind === 'string' && ent.kind.includes('kitty'))){
              if (!ent._kitten || !ent._kitten.bodyC || !ent._kitten.turC){ attachFn(ent); }
            }
          }catch(_){ }
        }
      }catch(_){ }
    }, intervalMs);
  }catch(_){ }
})();


