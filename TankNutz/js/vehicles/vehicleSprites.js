// Vehicle sprite & preview helpers extracted from game.js
// This module centralizes all draw*Into() functions for various tank/vehicle variants
// and the vehicle preview RAF management. Only rendering-related code should live here.

// Internal state for vehicle preview canvases (HUD / Journal previews)
const __vehicle_preview_canvases = [];
let __vehicle_preview_raf = null;

function __vehicle_preview_tick(ts){
  try{
    __vehicle_preview_canvases.forEach(entry=>{
      try{
        const c = entry.canvas; if (!c) return; const g = c.getContext('2d');
        if (entry.type === 'fordfiesta') drawFordFiestaInto(g, c.width, c.height, ts);
      }catch(_){ }
    });
  }catch(_){ }
  __vehicle_preview_raf = requestAnimationFrame(__vehicle_preview_tick);
}

function ensureVehiclePreviewRaf(){ if (!__vehicle_preview_raf) __vehicle_preview_raf = requestAnimationFrame(__vehicle_preview_tick); }

// NOTE: We intentionally do NOT export gameplay helpers (e.g., handleFoliageHit) from this module.
// Those live in game.js or dedicated gameplay modules to avoid circular dependencies.

// Draw Ford Fiesta tank into a provided 2D context sized targetW x targetH using base 48px art
function drawFordFiestaInto(ctx, targetW, targetH, ts){
  try{
    const BASE = 48; const FRAMES = 6; const FRAME_MS = 120;
    // draw into offscreen base canvas then scale
    const tmp = document.createElement('canvas'); tmp.width = BASE; tmp.height = BASE; const g = tmp.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0,0,BASE,BASE);
    // colors (hardcode to match fordfiestatank.html vars)
    const COL = { tread:'#23272b', lug:'#3a3f2b', paint:'#c7493a', paintD:'#922f29', steel:'#9aa8b2', glass:'#7ec8c8', accent:'#f2d14a' };
    function rect(x,y,w,h,fill){ g.fillStyle = fill; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }
    function px(x,y,fill){ rect(x,y,1,1,fill); }
    function drawTrack(x,y,w,h,offset){ rect(x,y,w,h,COL.tread); rect(x+1,y+1,w-2,h-2,COL.tread); const step=3; for(let i=0;i<h-2;i+=step){ const yy=y+1+((i+offset)%(h-2)); rect(x+1,yy,w-2,1,COL.lug); if(w>=5){ px(x+1,yy,COL.lug); px(x+w-2,yy,COL.lug); } } px(x+(w-1),y+1,COL.accent); for(let i=y+2;i<y+h-1;i+=6) px(x+(w-1),i,COL.accent); }
    function drawHull(frame){ const bobArr=[0,1,1,0,-1,-1]; const swayArr=[0,0,1,0,0,-1]; const bob=bobArr[frame%FRAMES]; const sway=swayArr[frame%FRAMES]; g.save(); g.translate(0,bob);
      drawTrack(6+sway,6,6,36,frame); drawTrack(BASE-12-6+sway,6,6,36,(frame*2)%36);
      rect(12+sway,32,24,8,COL.paintD);
      rect(12+sway,10,24,24,COL.paint); rect(14+sway,8,20,2,COL.paint); rect(16+sway,7,16,1,COL.paint); rect(14+sway,34,20,2,COL.paintD);
      rect(12+sway,22,24,2,COL.paintD);
      rect(18+sway,11,12,7,COL.glass); const hlx = 18+sway + (frame%3); px(hlx,11,'#ffffff'); px(hlx+1,12,'#ffffff');
      rect(10+sway,14,2,16,COL.steel); rect(BASE-12-(2-sway),14,2,16,COL.steel);
      g.fillStyle = COL.steel; g.beginPath(); g.rect(22+sway,21,4,6); g.fill(); rect(21+sway,22,1,4,COL.steel); rect(26+sway-1,22,1,4,COL.steel);
      const recoilArr=[0,0,1,1,0,0]; const recoil=recoilArr[frame%FRAMES]; rect(24+sway-recoil,17,2,5,COL.steel); px(24+sway-recoil,17,'#ffffff'); px(16+sway,9,COL.accent); px(31+sway,9,COL.accent); px(13+sway,10,COL.accent); for(let i=11;i<16;i++) px(12+sway,i,COL.accent);
      g.restore(); }
    const frame = Math.floor((ts || performance.now()) / FRAME_MS) % FRAMES; drawHull(frame);
    // blit scaled into target context
    ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(tmp, 0,0,BASE,BASE, 0,0,targetW,targetH);
  }catch(_){ }
}

// (Removed duplicate preview tick + ensure function; consolidated above.)
try{ if (typeof window !== 'undefined') window.drawFordFiestaInto = drawFordFiestaInto; }catch(_){ }

// Draw Blackstar preview into a canvas context (scaled to targetW/targetH)
function drawBlackstarInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, FRAMES = 6, FRAME_MS = 120;
    const now = ts || performance.now(); const frame = Math.floor(now / FRAME_MS) % FRAMES;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const C = { clear:'rgba(0,0,0,0)', hull:'#0b0b0f', hull2:'#15151a', rim:'#2f3242', mid:'#232531', steel:'#9ea2a9', red:'#d4002a', redHi:'#ff4554', flash:'#ffc744', tread:'#0a0b10', tread2:'#000000' };
    o.fillStyle = C.clear; o.fillRect(0,0,S,S);
    // faint BG pattern to match demo
    for(let y=0;y<S;y+=8) for(let x=0;x<S;x+=8) { o.fillStyle = (((x+y)>>3)&1) ? '#1a1b24' : '#131421'; o.fillRect(x,y,8,8); }
    const anchor = { x:32, y:32 };

    // small helpers (pixel draw)
    const px = (x,y,w=1,h=1,col)=>{ o.fillStyle = col; o.fillRect(x|0,y|0,w|0,h|0); };
    const rect = (x,y,w,h,col)=> px(x,y,w,h,col);
    const rectOutline = (x,y,w,h,col)=>{ px(x,y,w,1,col); px(x,y+h-1,w,1,col); px(x,y,1,h,col); px(x+w-1,y,1,h,col); };
    const disc = (cx,cy,r,col)=>{ for(let yy=-r; yy<=r; yy++){ const s=Math.floor(Math.sqrt(r*r - yy*yy)); o.fillStyle=col; o.fillRect(cx-s, cy+yy, 2*s+1, 1); } };
    const line = (x0,y0,x1,y1,col)=>{
      x0|=0;y0|=0;x1|=0;y1|=0;
      let dx=Math.abs(x1-x0), sx=x0<x1?1:-1;
      let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
      let err=dx+dy;
      for(;;){ px(x0,y0,1,1,col); if(x0===x1 && y0===y1) break; const e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } }
    };
    const thickLine = (x0,y0,x1,y1,col,th=2)=>{ for(let i=-Math.floor(th/2); i<Math.ceil(th/2); i++){ for(let j=-Math.floor(th/2); j<Math.ceil(th/2); j++){ line(x0+i,y0+j,x1+i,y1+j,col); } } };

    // Tracks
    const trackW=8, trackH=44, trackY=10, lX=6, rX=S-6-trackW;
    rect(lX,trackY,trackW,trackH,C.tread); rect(rX,trackY,trackW,trackH,C.tread);
    for(let y=trackY; y<trackY+trackH; y+=4){ const phase = ((y>>2)+frame)%2; const col = phase? C.tread2 : C.mid; rect(lX+1,y,trackW-2,1,col); rect(rX+1,y,trackW-2,1,col); }

    // Hull
    const hullX=14, hullY=14, hullW=36, hullH=36;
    rect(hullX,hullY,hullW,hullH,C.hull);
    px(hullX, hullY, 2,2, C.mid);
    px(hullX+hullW-2, hullY, 2,2, C.mid);
    px(hullX, hullY+hullH-2, 2,2, C.mid);
    px(hullX+hullW-2, hullY+hullH-2, 2,2, C.mid);
    rect(hullX+3, hullY+3, hullW-6, 1, C.rim);
    rect(hullX+3, hullY+4, hullW-6, 1, C.hull2);
    rect(hullX+4, hullY+8,      hullW-8, 2, C.red);
    rect(hullX+4, hullY+hullH-10, hullW-8, 2, C.red);
    rect(hullX+6, hullY+8,      hullW-12, 1, C.redHi);

    // Turret
    const tx = anchor.x, ty = anchor.y;
    const rotStep = frame % FRAMES;
    const rot = rotStep * (Math.PI*2/FRAMES);
    const recoil = (rotStep===0)? 1 : 0;

    // Turret base and cap
    disc(tx, ty, 10, C.hull2);
    rectOutline(tx-11, ty-11, 22, 22, C.mid);
    disc(tx, ty - recoil, 7, C.mid);
    disc(tx, ty - recoil, 6, C.hull2);
    rect(tx-6, ty-1-recoil, 12, 2, C.red);
    rect(tx-5, ty-1-recoil, 10, 1, C.redHi);

    // Neck + hub
    thickLine(tx, ty-2-recoil, tx, ty-10-recoil, C.hull2, 3);
    disc(tx, ty-12-recoil, 3, C.mid);

    // Rotating barrels (longer than previous tiny variant)
    const baseR=6, tipR=14;
    for(let i=0;i<6;i++){
      const a = rot + i*(Math.PI*2/6);
      const sx = Math.round(tx + Math.cos(a)*baseR);
      const sy = Math.round(ty - recoil + Math.sin(a)*baseR);
      const ex = Math.round(tx + Math.cos(a)*tipR);
      const ey = Math.round(ty - recoil + Math.sin(a)*tipR);
      thickLine(sx, sy, ex, ey, C.steel, 2);
      disc(ex, ey, 1, C.steel);
    }

    // Muzzle flash every 6th frame on the front (up) barrel
    if(rotStep===0){
      const a0 = -Math.PI/2;
      const ex = Math.round(tx + Math.cos(a0)*tipR);
      const ey = Math.round(ty - recoil + Math.sin(a0)*tipR);
      disc(ex, ey, 2, C.flash);
      line(ex-3, ey, ex+3, ey, C.flash);
      line(ex, ey-3, ex, ey+3, C.flash);
    }

    // Rim lights
    rect(hullX+hullW-2, hullY+2, 1, hullH-4, C.rim);
    rect(hullX+2, hullY+2, hullW-4, 1, C.rim);

    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBlackstarInto = drawBlackstarInto; }catch(_){ }

// Draw Blackstar body only (tracks and hull, no background)
function drawBlackstarBodyInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, FRAMES = 6, FRAME_MS = 120;
    const now = ts || performance.now(); const frame = Math.floor(now / FRAME_MS) % FRAMES;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const C = { clear:'rgba(0,0,0,0)', hull:'#0b0b0f', hull2:'#15151a', rim:'#2f3242', mid:'#232531', steel:'#9ea2a9', red:'#d4002a', redHi:'#ff4554', flash:'#ffc744', tread:'#0a0b10', tread2:'#000000' };
    o.fillStyle = C.clear; o.fillRect(0,0,S,S);
    // No background pattern

    const anchor = { x:32, y:32 };

    // small helpers (pixel draw)
    const px = (x,y,w=1,h=1,col)=>{ o.fillStyle = col; o.fillRect(x|0,y|0,w|0,h|0); };
    const rect = (x,y,w,h,col)=> px(x,y,w,h,col);
    const rectOutline = (x,y,w,h,col)=>{ px(x,y,w,1,col); px(x,y+h-1,w,1,col); px(x,y,1,h,col); px(x+w-1,y,1,h,col); };
    const disc = (cx,cy,r,col)=>{ for(let yy=-r; yy<=r; yy++){ const s=Math.floor(Math.sqrt(r*r - yy*yy)); o.fillStyle=col; o.fillRect(cx-s, cy+yy, 2*s+1, 1); } };
    const line = (x0,y0,x1,y1,col)=>{
      x0|=0;y0|=0;x1|=0;y1|=0;
      let dx=Math.abs(x1-x0), sx=x0<x1?1:-1;
      let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
      let err=dx+dy;
      for(;;){ px(x0,y0,1,1,col); if(x0===x1 && y0===y1) break; const e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } }
    };
    const thickLine = (x0,y0,x1,y1,col,th=2)=>{ for(let i=-Math.floor(th/2); i<Math.ceil(th/2); i++){ for(let j=-Math.floor(th/2); j<Math.ceil(th/2); j++){ line(x0+i,y0+j,x1+i,y1+j,col); } } };

    // Tracks
    const trackW=8, trackH=44, trackY=10, lX=6, rX=S-6-trackW;
    rect(lX,trackY,trackW,trackH,C.tread); rect(rX,trackY,trackW,trackH,C.tread);
    for(let y=trackY; y<trackY+trackH; y+=4){ const phase = ((y>>2)+frame)%2; const col = phase? C.tread2 : C.mid; rect(lX+1,y,trackW-2,1,col); rect(rX+1,y,trackW-2,1,col); }

    // Hull
    const hullX=14, hullY=14, hullW=36, hullH=36;
    rect(hullX,hullY,hullW,hullH,C.hull);
    px(hullX, hullY, 2,2, C.mid);
    px(hullX+hullW-2, hullY, 2,2, C.mid);
    px(hullX, hullY+hullH-2, 2,2, C.mid);
    px(hullX+hullW-2, hullY+hullH-2, 2,2, C.mid);
    rect(hullX+3, hullY+3, hullW-6, 1, C.rim);
    rect(hullX+3, hullY+4, hullW-6, 1, C.hull2);
    rect(hullX+4, hullY+8,      hullW-8, 2, C.red);
    rect(hullX+4, hullY+hullH-10, hullW-8, 2, C.red);
    rect(hullX+6, hullY+8,      hullW-12, 1, C.redHi);

    // Rim lights
    rect(hullX+hullW-2, hullY+2, 1, hullH-4, C.rim);
    rect(hullX+2, hullY+2, hullW-4, 1, C.rim);

    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBlackstarBodyInto = drawBlackstarBodyInto; }catch(_){ }

// Draw Blackstar turret only (grey star and barrel, pointing up)
function drawBlackstarTurretInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, FRAMES = 6, FRAME_MS = 120;
    const now = ts || performance.now(); const frame = Math.floor(now / FRAME_MS) % FRAMES;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const C = { clear:'rgba(0,0,0,0)', hull:'#0b0b0f', hull2:'#15151a', rim:'#2f3242', mid:'#232531', steel:'#9ea2a9', red:'#d4002a', redHi:'#ff4554', flash:'#ffc744', tread:'#0a0b10', tread2:'#000000' };
    o.fillStyle = C.clear; o.fillRect(0,0,S,S);
    const anchor = { x:32, y:32 };

    // small helpers (pixel draw)
    const px = (x,y,w=1,h=1,col)=>{ o.fillStyle = col; o.fillRect(x|0,y|0,w|0,h|0); };
    const rect = (x,y,w,h,col)=> px(x,y,w,h,col);
    const rectOutline = (x,y,w,h,col)=>{ px(x,y,w,1,col); px(x,y+h-1,w,1,col); px(x,y,1,h,col); px(x+w-1,y,1,h,col); };
    const disc = (cx,cy,r,col)=>{ for(let yy=-r; yy<=r; yy++){ const s=Math.floor(Math.sqrt(r*r - yy*yy)); o.fillStyle=col; o.fillRect(cx-s, cy+yy, 2*s+1, 1); } };
    const line = (x0,y0,x1,y1,col)=>{
      x0|=0;y0|=0;x1|=0;y1|=0;
      let dx=Math.abs(x1-x0), sx=x0<x1?1:-1;
      let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1;
      let err=dx+dy;
      for(;;){ px(x0,y0,1,1,col); if(x0===x1 && y0===y1) break; const e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } }
    };
    const thickLine = (x0,y0,x1,y1,col,th=2)=>{ for(let i=-Math.floor(th/2); i<Math.ceil(th/2); i++){ for(let j=-Math.floor(th/2); j<Math.ceil(th/2); j++){ line(x0+i,y0+j,x1+i,y1+j,col); } } };

    const tx = anchor.x, ty = anchor.y;
    const rot = 0; // static, pointing up
    const recoil = 0; // no recoil for turret

    // Turret base and cap
    disc(tx, ty, 10, C.hull2);
    rectOutline(tx-11, ty-11, 22, 22, C.mid);
    disc(tx, ty - recoil, 7, C.mid);
    disc(tx, ty - recoil, 6, C.hull2);
    rect(tx-6, ty-1-recoil, 12, 2, C.red);
    rect(tx-5, ty-1-recoil, 10, 1, C.redHi);

    // Neck + hub
    thickLine(tx, ty-2-recoil, tx, ty-10-recoil, C.hull2, 3);
    disc(tx, ty-12-recoil, 3, C.mid);

    // Barrels (pointing up)
    const baseR=6, tipR=14;
    for(let i=0;i<6;i++){
      const a = rot + i*(Math.PI*2/6);
      const sx = Math.round(tx + Math.cos(a)*baseR);
      const sy = Math.round(ty - recoil + Math.sin(a)*baseR);
      const ex = Math.round(tx + Math.cos(a)*tipR);
      const ey = Math.round(ty - recoil + Math.sin(a)*tipR);
      thickLine(sx, sy, ex, ey, C.steel, 2);
      disc(ex, ey, 1, C.steel);
    }

    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBlackstarTurretInto = drawBlackstarTurretInto; }catch(_){ }

// Draw Murkia (AMERICA) tank preview into a canvas context (64x64 source, scaled to targetW/targetH)
function drawMurkiaInto(ctx, targetW, targetH, ts){
  try{
    const S = 64, SCALE = 4, FRAMES = 24, FRAME_MS = 60;
    const off = document.createElement('canvas'); off.width = S; off.height = S; const o = off.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    const palette = {
      outline:'#08101a', black:'#0a0f17', steelDD:'#222a39', steelD:'#2a3344', steelM:'#44506a', steelL:'#6e7c99', steelXL:'#8a98b5', steelSpec:'#b6c1d9', rubber:'#202633', rubberHi:'#323b4f', shadow:'#0a0e16', blue:'#173a9b', red:'#d21f2b', white:'#ffffff', gold:'#f7cc3a', treadHi:'#9fb0cc', green:'#7ee787'
    };
    // helpers (pixel-level) - draw into offscreen 'o' at 64x64 coords
    function px(x,y,c){ if(x<0||y<0||x>=S||y>=S) return; o.fillStyle = c; o.fillRect(x, y, 1, 1); }
    function fillRect(x,y,w,h,c){ o.fillStyle = c; o.fillRect(x, y, w, h); }
    function outlineRect(x,y,w,h,c){ for(let i=x;i<x+w;i++){ px(i,y,c); px(i,y+h-1,c);} for(let j=y;j<y+h;j++){ px(x,j,c); px(x+w-1,j,c);} }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ for(let xx=-r; xx<=r; xx++){ if(xx*xx+yy*yy<=r*r) px(cx+xx, cy+yy, c); } } }
    function circle(cx,cy,r,c){ for(let t=0;t<360;t+=6){ const a=t*Math.PI/180; px(Math.round(cx+Math.cos(a)*r), Math.round(cy+Math.sin(a)*r), c); } }
    function lineThin(x0,y0,x1,y1,c){ let dx=Math.abs(x1-x0), sx=x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy,e2; for(;;){ px(x0,y0,c); if(x0===x1&&y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    function lineThick(x0,y0,x1,y1,c,outline){ let dx=Math.abs(x1-x0),sx=x0<x1?1:-1; let dy=-Math.abs(y1-y0),sy=y0<y1?1:-1; let err=dx+dy,e2; for(;;){ px(x0,y0,c); if(dx>Math.abs(dy)) px(x0,y0+sy,c); else px(x0+sx,y0,c); if(outline){ px(x0-1,y0,outline); px(x0+1,y0,outline); px(x0,y0-1,outline); px(x0,y0+1,outline); } if(x0===x1&&y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    function rot(dx,dy,a){ const ca=Math.cos(a),sa=Math.sin(a); return {x:Math.round(dx*ca-dy*sa), y:Math.round(dx*sa+dy*ca)}; }

    // clear
    o.fillStyle = '#0c1220'; o.fillRect(0,0,S,S);
    const CENTER = {x:32,y:32};
    const frame = Math.floor((ts || performance.now()) / FRAME_MS) % FRAMES;
    const bounce = (frame%6===0 || frame%6===3)? 0 : (frame%6<3 ? 1 : -1);

    // draw tracks
    function drawTrackAssembly(side, phase, bounceY){
      const x0 = (side<0)? 8 : 48; const w=8, h=32, y0=16 + bounceY;
      fillRect(x0, y0, w, h, palette.rubber);
      outlineRect(x0, y0, w, h, palette.outline);
      for(let yy=0; yy<h; yy++){
        const gy = y0 + yy;
        const link = ((yy + phase) % 6) === 0;
        if(link){ px(x0+2, gy, palette.rubberHi); px(x0+3, gy, palette.rubberHi); px(x0+w-3, gy, palette.rubberHi); px(x0+w-4, gy, palette.rubberHi); }
      }
      // wheels
      const wheelY = 40 + bounceY; const wheelXs = (side<0)? [11,13,15,17,19] : [49,51,53,55,57];
      wheelXs.forEach(cx=>{ fillCircle(cx, wheelY, 3, palette.steelD); px(cx, wheelY, palette.steelSpec); });
      const retY = 20 + bounceY; const retXs = (side<0)? [12,18] : [50,56]; retXs.forEach(cx=>{ fillCircle(cx, retY, 2, palette.steelD); px(cx, retY, palette.steelSpec); });
      // skirts
      const skirtY = y0 - 2, skirtH = 4; fillRect(x0-1, skirtY, w+2, skirtH, palette.steelM); outlineRect(x0-1, skirtY, w+2, skirtH, palette.outline);
      for(let i=0;i<4;i++){ px(x0+i*2, skirtY+skirtH-1, palette.steelXL); }
      px(x0, skirtY+1, palette.blue); px(x0+w-1, skirtY+1, palette.blue);
    }
    drawTrackAssembly(-1, frame%6, bounce); drawTrackAssembly(+1, frame%6, bounce);

    // hull
    fillRect(16,18,32,28,palette.steelM); fillRect(18,20,28,24,palette.steelL);
    for(let i=0;i<12;i++){ px(20+i,18, palette.steelD); }
    for(let i=0;i<12;i++){ px(32+i,45, palette.steelD); }
    // turret ring
    const ringR=9; for(let t=0;t<16;t++){ const a=t*(Math.PI*2/16); const x=Math.round(CENTER.x+Math.cos(a)*ringR); const y=Math.round(CENTER.y+Math.sin(a)*ringR); px(x,y,palette.steelD); }
    // intakes
    for(let i=0;i<3;i++){ fillRect(20, 40+i*2, 8, 1, palette.steelDD); px(20,40+i*2, palette.outline); px(27,40+i*2, palette.outline); }
    for(let i=0;i<3;i++){ for(let j=0;j<5;j++){ px(36+j*2, 40+i*2, palette.steelDD); } }
    fillRect(16,30,4,8,palette.steelM); outlineRect(16,30,4,8,palette.outline); px(18,34,palette.steelXL);
    fillRect(44,30,4,8,palette.steelM); outlineRect(44,30,4,8,palette.outline); px(46,34,palette.steelXL);
    px(16,20,palette.steelDD); px(17,20,palette.steelDD); px(47,20,palette.steelDD); px(46,20,palette.steelDD);
    // flag band
    const bandY0=21, bandH=10, bandX0=19, bandW=26; const canton={x:bandX0,y:bandY0,w:12,h:bandH}; fillRect(canton.x,canton.y,canton.w,canton.h,palette.blue);
    const twinkle = frame % 6; const stars=[{x:canton.x+3,y:canton.y+3},{x:canton.x+7,y:canton.y+3},{x:canton.x+5,y:canton.y+6},{x:canton.x+9,y:canton.y+6},{x:canton.x+3,y:canton.y+8},{x:canton.x+7,y:canton.y+8}];
    stars.forEach((s,i)=>{ const col=(i===twinkle)?palette.white:palette.gold; px(s.x,s.y,col); px(s.x-1,s.y,col); px(s.x+1,s.y,col); px(s.x,s.y-1,col); px(s.x,s.y+1,col); });
    for(let y=0;y<bandH;y++){ fillRect(bandX0+canton.w, bandY0+y, bandW-canton.w, 1, (y%2===0)?palette.red:palette.white); }
    outlineRect(bandX0,bandY0,bandW,bandH,palette.outline);
    for(let i=0;i<5;i++){ px(24+i*4, 32, palette.steelDD); }
    outlineRect(16,18,32,28,palette.outline);

    // turret
    const cx=CENTER.x, cy=CENTER.y; fillCircle(cx,cy,7,palette.steelM); fillCircle(cx,cy,6,palette.steelL); circle(cx,cy,7,palette.outline);
    // crest
    px(cx,cy,palette.gold); px(cx-1,cy,palette.gold); px(cx+1,cy,palette.gold); px(cx-2,cy+1,palette.gold); px(cx+2,cy+1,palette.gold); px(cx,cy-1,palette.gold);
    const angle=(frame/FRAMES)*Math.PI*2; const dirx=Math.sin(angle), diry=-Math.cos(angle); const perpX=diry, perpY=-dirx;
    // barrel
    const bLen=20, bx0=cx, by0=cy-1, bx1=Math.round(cx+dirx*bLen), by1=Math.round(cy+diry*bLen);
    lineThick(bx0,by0,bx1,by1,palette.steelM,palette.outline); px(bx1,by1,palette.black);
    px(Math.round(bx1+perpX),Math.round(by1+perpY),palette.black); px(Math.round(bx1-perpX),Math.round(by1-perpY),palette.black);
    // coax
    const mgOff=1; const mgx0=Math.round(bx0+perpX*mgOff), mgy0=Math.round(by0+perpY*mgOff); const mgx1=Math.round(cx+dirx*14+perpX*mgOff), mgy1=Math.round(cy+diry*14+perpY*mgOff);
    lineThin(mgx0,mgy0,mgx1,mgy1,palette.steelM); px(mgx1,mgy1,palette.black);
    // cupola
    const cupOff=rot(3,0,angle); const cupX=cx+cupOff.x, cupY=cy+cupOff.y; fillCircle(cupX,cupY,3,palette.steelL); circle(cupX,cupY,3,palette.outline);
    const hx0=Math.round(cupX-perpX*2), hy0=Math.round(cupY-perpY*2); const hx1=Math.round(cupX+perpX*2), hy1=Math.round(cupY+perpY*2); lineThin(hx0,hy0,hx1,hy1,palette.outline);
    const p1={x:Math.round(cupX+dirx*2),y:Math.round(cupY+diry*2)}; const p2={x:Math.round(cupX+dirx*1 - perpX*1),y:Math.round(cupY+diry*1 - perpY*1)}; px(p1.x,p1.y,palette.white); px(p2.x,p2.y,palette.white);
    // antenna + flag
    const antBase=rot(3,-1,angle); const ax0=cx+antBase.x, ay0=cy+antBase.y; const ax1=Math.round(ax0 - dirx*6 + perpX*1), ay1=Math.round(ay0 - diry*6 + perpY*1);
    lineThin(ax0,ay0,ax1,ay1,palette.steelXL); const flip=(frame%2===0)?1:-1, fx=Math.round(ax1+perpX*flip), fy=Math.round(ay1+perpY*flip); px(ax1,ay1,palette.blue); px(fx,fy,palette.white); px(fx+Math.round(perpX||0), fy+Math.round(perpY||0), palette.red);

    // rim light overlay and hitbox omitted here (preview only)

    // blit scaled into target context
    try{ ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(off, 0,0,S,S, 0,0,targetW,targetH); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawMurkiaInto = drawMurkiaInto; }catch(_){ }

// Split Murkia draw helpers so we can produce separate full-res body and turret canvases
function drawMurkiaBodyInto(ctx, targetW, targetH, ts){
  try{
    const S = 64; const palette = { outline:'#08101a', steelD:'#2a3344', steelM:'#44506a', steelL:'#6e7c99', steelXL:'#8a98b5', steelSpec:'#b6c1d9', rubber:'#202633', rubberHi:'#323b4f', blue:'#173a9b', red:'#d21f2b', white:'#ffffff', gold:'#f7cc3a', treadHi:'#9fb0cc' };
    const o = ctx; // caller provides a 64x64 ctx
    // ensure transparent background
    o.clearRect(0,0,S,S);
    const now = (typeof ts === 'number') ? ts : performance.now(); const frame = Math.floor(now / 80);
    function px(x,y,c){ if(x<0||y<0||x>=S||y>=S) return; o.fillStyle=c; o.fillRect(x,y,1,1); }
    function fillRect(x,y,w,h,c){ o.fillStyle=c; o.fillRect(x,y,w,h); }
    function outlineRect(x,y,w,h,c){ for(let i=x;i<x+w;i++){ px(i,y,c); px(i,y+h-1,c);} for(let j=y;j<y+h;j++){ px(x,j,c); px(x+w-1,j,c);} }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ for(let xx=-r; xx<=r; xx++){ if(xx*xx+yy*yy<=r*r) px(cx+xx, cy+yy, c); } } }
    const CENTER = {x:32,y:32};
    const bounce = (frame%6===0 || frame%6===3)? 0 : (frame%6<3 ? 1 : -1);
    // draw tracks, hull, flag band, panel details and rim
    function drawTrackAssembly(side, phase, bounceY){
      const x0 = (side<0)? 8 : 48; const w=8, h=32, y0=16 + bounceY;
      // track base (transparent around)
      fillRect(x0, y0, w, h, palette.rubber);
      outlineRect(x0, y0, w, h, palette.outline);
      // moving track links: slide along y using phase
      for(let yy=0; yy<h; yy++){ const gy = y0 + yy; const link = ((yy + phase) % 6) === 0; if(link){ px(x0+2, gy, palette.rubberHi); px(x0+3, gy, palette.rubberHi); px(x0+w-3, gy, palette.rubberHi); px(x0+w-4, gy, palette.rubberHi); } }
      // road wheels with animated spoke highlight
      const wheelY = 40 + bounceY; const wheelXs = (side<0)? [11,13,15,17,19] : [49,51,53,55,57];
      wheelXs.forEach((cx, idx)=>{
        fillCircle(cx, wheelY, 3, palette.steelD);
        px(cx, wheelY, palette.steelSpec);
        // rotating spoke: offset pixel moves with frame
        const ang = (now/120) + idx*0.6;
        const sx = Math.round(cx + Math.cos(ang)*2);
        const sy = Math.round(wheelY + Math.sin(ang)*2);
        px(sx, sy, palette.steelSpec);
      });
      const retY = 20 + bounceY; const retXs = (side<0)? [12,18] : [50,56]; retXs.forEach(cx=>{ fillCircle(cx, retY, 2, palette.steelD); px(cx, retY, palette.steelSpec); });
      const skirtY = y0 - 2, skirtH = 4; fillRect(x0-1, skirtY, w+2, skirtH, palette.steelM); outlineRect(x0-1, skirtY, w+2, skirtH, palette.outline); for(let i=0;i<4;i++){ px(x0+i*2, skirtY+skirtH-1, palette.steelXL); } px(x0, skirtY+1, palette.blue); px(x0+w-1, skirtY+1, palette.blue);
    }
    // phase derived from frame to create smooth movement
    drawTrackAssembly(-1, frame%6, bounce); drawTrackAssembly(+1, frame%6, bounce);
    // hull
    fillRect(16,18,32,28,palette.steelM); fillRect(18,20,28,24,palette.steelL);
    for(let i=0;i<12;i++){ px(20+i,18, palette.steelD); }
    for(let i=0;i<12;i++){ px(32+i,45, palette.steelD); }
    const ringR=9; for(let t=0;t<16;t++){ const a=t*(Math.PI*2/16); const x=Math.round(CENTER.x+Math.cos(a)*ringR); const y=Math.round(CENTER.y+Math.sin(a)*ringR); px(x,y,palette.steelD); }
    for(let i=0;i<3;i++){ fillRect(20, 40+i*2, 8, 1, palette.steelD); px(20,40+i*2, palette.outline); px(27,40+i*2, palette.outline); }
    for(let i=0;i<3;i++){ for(let j=0;j<5;j++){ px(36+j*2, 40+i*2, palette.steelD); } }
    fillRect(16,30,4,8,palette.steelM); outlineRect(16,30,4,8,palette.outline); px(18,34,palette.steelXL); fillRect(44,30,4,8,palette.steelM); outlineRect(44,30,4,8,palette.outline); px(46,34,palette.steelXL);
    px(16,20,palette.steelD); px(17,20,palette.steelD); px(47,20,palette.steelD); px(46,20,palette.steelD);
    const bandY0=21, bandH=10, bandX0=19, bandW=26; const canton={x:bandX0,y:bandY0,w:12,h:bandH}; fillRect(canton.x,canton.y,canton.w,canton.h,palette.blue);
    const twinkle = frame % 6; const stars=[{x:canton.x+3,y:canton.y+3},{x:canton.x+7,y:canton.y+3},{x:canton.x+5,y:canton.y+6},{x:canton.x+9,y:canton.y+6},{x:canton.x+3,y:canton.y+8},{x:canton.x+7,y:canton.y+8}]; stars.forEach((s,i)=>{ const col=(i===twinkle)?palette.white:palette.gold; px(s.x,s.y,col); px(s.x-1,s.y,col); px(s.x+1,s.y,col); px(s.x,s.y-1,col); px(s.x,s.y+1,col); });
    for(let y=0;y<bandH;y++){ fillRect(bandX0+canton.w, bandY0+y, bandW-canton.w, 1, (y%2===0)?palette.red:palette.white); }
    outlineRect(bandX0,bandY0,bandW,bandH,palette.outline);
    for(let i=0;i<5;i++){ px(24+i*4, 32, palette.steelD); }
    outlineRect(16,18,32,28,palette.outline);
  }catch(_){ }
}

function drawMurkiaTurretInto(ctx, targetW, targetH, ts){
  try{
    const S = 64; const o = ctx; const palette = { outline:'#08101a', steelM:'#44506a', steelL:'#6e7c99', steelSpec:'#b6c1d9', steel:'#9fb0c2', black:'#0a0f17', blue:'#173a9b', red:'#d21f2b', white:'#ffffff', gold:'#f7cc3a' };
    function px(x,y,c){ if(x<0||y<0||x>=S||y>=S) return; o.fillStyle=c; o.fillRect(x,y,1,1); }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ for(let xx=-r; xx<=r; xx++){ if(xx*xx+yy*yy<=r*r) px(cx+xx, cy+yy, c); } } }
    function lineThin(x0,y0,x1,y1,c){ let dx=Math.abs(x1-x0), sx=x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy,e2; for(;;){ px(x0,y0,c); if(x0===x1&&y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    const now = ts || performance.now(); const frame = Math.floor(now / 60) % 24; const cx=32, cy=32; fillCircle(cx,cy,7,palette.steelM); fillCircle(cx,cy,6,palette.steelL); for(let t=0;t<360;t+=20){ px(Math.round(cx+Math.cos(t*Math.PI/180)*7), Math.round(cy+Math.sin(t*Math.PI/180)*7), palette.outline); }
    // crest
    px(cx,cy,palette.gold); px(cx-1,cy,palette.gold); px(cx+1,cy,palette.gold); px(cx-2,cy+1,palette.gold); px(cx+2,cy+1,palette.gold); px(cx,cy-1,palette.gold);
  // Draw turret graphics in a neutral orientation (barrel pointing to the right).
  // External code rotates the turret canvas by the entity's turretAngle when drawing,
  // so remove any internal animation here to ensure the turret visually points at the cursor.
  const dirx = 1, diry = 0; const perpX = 0, perpY = -1;
    // barrel
    const bLen=20, bx0=cx, by0=cy-1, bx1=Math.round(cx+dirx*bLen), by1=Math.round(cy+diry*bLen);
    // thick line (simple)
    lineThin(bx0,by0,bx1,by1,palette.steelM); px(bx1,by1,palette.black); px(Math.round(bx1+perpX),Math.round(by1+perpY),palette.black); px(Math.round(bx1-perpX),Math.round(by1-perpY),palette.black);
    // coax
    const mgOff=1; const mgx0=Math.round(bx0+perpX*mgOff), mgy0=Math.round(by0+perpY*mgOff); const mgx1=Math.round(cx+dirx*14+perpX*mgOff), mgy1=Math.round(cy+diry*14+perpY*mgOff); lineThin(mgx0,mgy0,mgx1,mgy1,palette.steelM); px(mgx1,mgy1,palette.black);
    // cupola + hatch
    const cupOffX = Math.round(3*Math.cos(angle) - 0*Math.sin(angle)), cupOffY = Math.round(3*Math.sin(angle) + 0*Math.cos(angle)); const cupX=cx+cupOffX, cupY=cy+cupOffY; fillCircle(cupX,cupY,3,palette.steelL); for(let t=0;t<360;t+=20) px(Math.round(cupX+Math.cos(t*Math.PI/180)*3), Math.round(cupY+Math.sin(t*Math.PI/180)*3), palette.outline);
    // hatch lines
    const hx0=Math.round(cupX-perpX*2), hy0=Math.round(cupY-perpY*2); const hx1=Math.round(cupX+perpX*2), hy1=Math.round(cupY+perpY*2); lineThin(hx0,hy0,hx1,hy1,palette.outline);
    const p1x=Math.round(cupX+dirx*2), p1y=Math.round(cupY+diry*2); px(p1x,p1y,palette.white);
    // antenna + flag
    const antBaseX = Math.round(3*Math.cos(angle) - (-1)*Math.sin(angle)), antBaseY = Math.round(3*Math.sin(angle) + (-1)*Math.cos(angle)); const ax0=cx+antBaseX, ay0=cy+antBaseY; const ax1=Math.round(ax0 - dirx*6 + perpX*1), ay1=Math.round(ay0 - diry*6 + perpY*1); lineThin(ax0,ay0,ax1,ay1,palette.steelXL || '#8a98b5'); const flip=(frame%2===0)?1:-1, fx=Math.round(ax1+perpX*flip), fy=Math.round(ay1+perpY*flip); px(ax1,ay1,palette.blue); px(fx,fy,palette.white); px(fx+Math.round(perpX||0), fy+Math.round(perpY||0), palette.red);
  }catch(_){ }
}

// Draw Dozer (64x64) - ported from dozer.html
function drawDozerInto(ctx, targetW, targetH, ts){
  try{
    const S = 64; const o = ctx; const now = ts || performance.now();
    o.clearRect(0,0,S,S);
    function px(x,y,w=1,h=1,c){ o.fillStyle=c; o.fillRect(x,y,w,h); }
    function fillCircle(cx,cy,r,c){ for(let yy=-r; yy<=r; yy++){ const span = Math.floor(Math.sqrt(r*r - yy*yy)); o.fillStyle=c; o.fillRect(cx-span, cy+yy, span*2+1, 1);} }
    const P = { steelD:'#2a2d32', steelM:'#3c4148', steelL:'#6f7886', tread:'#17191c', blade:'#c6a43a', bladeL:'#edd67a', hazD:'#7a6321', glass:'#9fe3ff', warn:'#ff3b30', shadow:'rgba(0,0,0,0.28)', smokeA:'rgba(160,160,160,0.35)', smokeB:'rgba(110,110,110,0.3)' };
    // draw soft shadow
    for(let i=0;i<7;i++){ const y=48+i; const w=36 - i*3; px(32-Math.floor(w/2), y, w, 1, P.shadow); }
    // tracks
    const yTop = 14, h=36, w=10, leftX=6, rightX=S-6-w;
    px(leftX, yTop, w, h, P.tread); px(rightX,yTop,w,h,P.tread);
    px(leftX+2,yTop+2,w-4,h-4,P.steelD); px(rightX+2,yTop+2,w-4,h-4,P.steelD);
    const shift = Math.floor((now/120)%6);
    for(let y=yTop+2+shift; y<yTop+h-2; y+=6){ px(leftX+1,y,2,2,P.steelL); px(leftX+7,y,2,2,P.steelL); px(rightX+1,y,2,2,P.steelL); px(rightX+7,y,2,2,P.steelL); }
    for(let i=0;i<5;i++){ const wy = yTop + 4 + i*6; fillCircle(leftX+5,wy,1,P.steelM); fillCircle(rightX+5,wy,1,P.steelM); }
    // hull
    const hx=18, hy=18, hw=28, hh=30;
    px(hx,hy,hw,hh,P.steelM); px(hx,hy,hw,2,P.steelL); px(hx,hy+hh-2,hw,2,P.steelD);
    // cabin/glass
    px(hx+8,hy+2,12,6,P.steelD); for(let i=0;i<12;i++){ /* rim */ } px(hx+10,hy+4,8,1,P.glass);
    // beacon
    const blink = ((now/120)|0)%14 < 6; px(hx+hw-4, hy+1, 2,2, blink?P.warn:P.steelL);
    // blade
    const bx=10, by=8, bw=44, bh=6; px(bx,by,bw,bh,P.blade); px(bx,by+bh-1,4,1,P.hazD); px(bx+bw-4,by+bh-1,4,1,P.hazD); px(bx+1,by+1,bw-2,1,P.bladeL);
    for(let x=0;x<bw;x++){ const col = ((x + Math.floor((now/120)/2)) % 6) < 3 ? P.blade : P.hazD; px(bx+x, by+2, 1,2, col); }
    // exhaust puff
    const cycle = Math.floor((now/120)%24); const puffY = 50 + Math.floor(cycle/4);
    if(puffY < 64){ const off = (cycle%8)-4; fillCircle(32+off, puffY, 2, P.smokeA); fillCircle(30+off, puffY+2, 1, P.smokeB); }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawDozerInto = drawDozerInto; }catch(_){ }

// Draw Bond-style tank into a canvas by rendering the original 128×128 art and scaling
function drawBondtankInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const G = 128;
    // create logical 128x128 buffer
    const tmp = document.createElement('canvas'); tmp.width = G; tmp.height = G; const octx = tmp.getContext('2d');
    // helpers (port from Bondtank.html)
    function px(x,y,col){ x|=0; y|=0; if(x<0||y<0||x>=G||y>=G) return; octx.fillStyle=col; octx.fillRect(x,y,1,1); }
    function line(x0,y0,x1,y1,col){ x0|=0;y0|=0;x1|=0;y1|=0; let dx=Math.abs(x1-x0), sx = x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy = y0<y1?1:-1; let err = dx+dy, e2; for(;;){ px(x0,y0,col); if(x0===x1 && y0===y1) break; e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
    function rect(x,y,w,h,col){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) px(x+i,y+j,col); }
    function circle(xc,yc,r,col,fill=true){ let x=-r,y=0,err=2-2*r; r=1-err; while(x<0){ if(fill){ for(let i=xc+x;i<=xc-x;i++){ px(i,yc+y,col); px(i,yc-y,col); } } else { px(xc-x,yc+y,col); px(xc-y,yc-x,col); px(xc+y,yc-x,col); px(xc+x,yc-y,col); px(xc+x,yc+y,col); px(xc+y,yc+x,col); px(xc-y,yc+x,col); px(xc-x,yc-y,col); } r=err; if(r<=y){ y++; err+=y*2+1; } if(r>x || err>y){ x++; err+=x*2+1; } } }
    function rot(ax,ay, ang, cx,cy){ const s=Math.sin(ang), c=Math.cos(ang); ax-=cx; ay-=cy; return [ax*c-ay*s+cx, ax*s+ay*c+cy]; }
    function ditherStripe(x,y,ratio){ return ((x^y)&1) ? ratio>0.5 : ratio<=0.5; }

    const P = {
      black:'#0a0a0c', iron:'#1b1c22', steel:'#2b2e36', steel2:'#3a3e49', track:'#15161b', track2:'#262933',
      red_dark:'#3e0005', red:'#6f000a', red_mid:'#990e16', red_bright:'#c91521', red_glint:'#ff2a3a',
      belt:'#1a1a1f', belt2:'#101014', chain:'#c0c6cf', chain_sh:'#8a8f98', rivet:'#d8dee7', highlight:'#fafbfd', soot:'#3b3b44', smoke1:'#676b74', smoke2:'#8b8f99', smoke3:'#b7bcc6', amber:'#f4b45a', glow:'#ffd38a'
    };

    // clear
    octx.clearRect(0,0,G,G);

    // Implement main parts from Bondtank.html
    // drawTracks
    (function drawTracks(t){ const treadOffset = Math.floor((t/2) % 6); rect(10,24,12,80,P.track);  rect(11,25,10,78,P.track2); rect(106,24,12,80,P.track); rect(107,25,10,78,P.track2); for(let k=0;k<15;k++){ const y = 26 + ((k*6 + treadOffset) % 78); line(12,y,20,y+2,P.soot); line(12,y+2,20,y,P.soot); line(108,y,116,y+2,P.soot); line(108,y+2,116,y,P.soot); } for(let i=0;i<5;i++){ const wy=36+i*16; circle(16,wy,4,P.steel,false); circle(112,wy,4,P.steel,false); } })(now);

    // drawHull
    (function drawHull(t){ for(let y=28;y<100;y++){ for(let x=24;x<104;x++){ const col = (y<40?P.red_dark : (y<70?P.red : P.red_mid)); px(x,y,col); } } // rim lines
      for(let i=0;i<80;i++){ px(24+i,28,P.red_dark); px(24+i,99,P.red); }
      for(let j=0;j<72;j++){ px(24,28+j,P.red_dark); px(103,28+j,P.red); }
      for(let y=40;y<88;y+=2){ px(64,y,P.red_bright); if((y&3)===0) px(63,y,P.red_glint); }
      // shaded top
      for(let yy=28; yy<28+10; yy++){ for(let xx=28; xx<28+72; xx++){ /* subtle shading already filled */ } }
    })(now);

    // drawBelts, chains, spikes, turret, top chains, exhaust, lights, handcuffs
    (function drawBelts(t){ const belts = [ {x0:28,y0:42,x1:100,y1:62,w:2},{x0:100,y0:46,x1:28,y1:82,w:2},{x0:32,y0:60,x1:96,y1:92,w:3},{x0:96,y0:38,x1:32,y1:74,w:3} ]; belts.forEach(b=>{ const steps = Math.max(Math.abs(b.x1-b.x0), Math.abs(b.y1-b.y0)); for(let i=0;i<=steps;i++){ const x = Math.round(b.x0 + (b.x1-b.x0)*i/steps); const y = Math.round(b.y0 + (b.y1-b.y0)*i/steps); for(let w=-b.w; w<=b.w; w++){ px(x, y+w, P.belt2); if((i+w)&1) px(x, y+w, P.belt); } } for(let i=12;i<steps;i+=24){ const x = Math.round(b.x0 + (b.x1-b.x0)*i/steps); const y = Math.round(b.y0 + (b.y1-b.y0)*i/steps); rect(x-2,y-1,5,3,P.steel); px(x-2,y-1,P.highlight); px(x+3,y-2,P.chain); px(x+4,y-3,P.chain_sh); } }); })(now);

    (function drawChainsWrapped(t){ const sway = Math.sin(t/28)*2; const loops = [ {x0:30,y0:34,x1:98,y1:34}, {x0:30,y0:96,x1:98,y1:96}, {x0:26,y0:36,x1:26,y1:94}, {x0:102,y0:36,x1:102,y1:94} ]; loops.forEach((L,idx)=>{ const steps = Math.max(Math.abs(L.x1-L.x0), Math.abs(L.y1-L.y0)); for(let i=0;i<=steps;i+=3){ let x = Math.round(L.x0 + (L.x1-L.x0)*i/steps); let y = Math.round(L.y0 + (L.y1-L.y0)*i/steps); if(L.y0===L.y1) y += Math.round(Math.sin((i/steps)*Math.PI)*2 + sway*(idx&1?1:-1)); px(x,y,P.chain); px(x-1,y,P.chain_sh); px(x+1,y,P.chain_sh); if(((i+idx*7+now)|0)%19===0) px(x,y-1,P.highlight); if((i/3|0)%2===0){ px(x,y+1,P.chain_sh); px(x,y+2,P.chain); px(x,y+3,P.chain_sh); } } }); })(now);

    (function drawHullFrontSpikes(){ for(let x=32; x<=96; x+=6){ px(x,27,P.chain_sh); px(x,26,P.chain); px(x,25,P.chain_sh); } })();

    (function drawTurret(t){
      // draw turret dome and rivets only; barrel is rendered separately by the dynamic turret renderer
      circle(64,56,18,P.steel,false);
      const ang = (t/60) % (Math.PI*2);
      for(let yy=-12; yy<=12; yy++){
        for(let xx=-18; xx<=18; xx++){
          if((xx*xx)/360 + (yy*yy)/144 <= 1){
            const [rx,ry] = rot(64+xx,56+yy,ang,64,56);
            const xi = rx|0, yi = ry|0;
            const shade = yy<-6 ? P.red_bright : yy<0 ? P.red : yy<6 ? P.red_mid : P.red_dark;
            px(xi,yi,shade);
          }
        }
      }
      for(let i=0;i<12;i++){
        const a = i/12*Math.PI*2 + ang*0.5;
        const [x,y] = rot(64+Math.cos(a)*18,56+Math.sin(a)*18,0,0,0);
        px(x|0,y|0,P.rivet);
      }
      // intentionally omit barrel drawing here — barrel pixels will come from the rotating turret renderer
    })(now);

    (function drawTopChains(t){ const ang = (t/32); const R = 26; const N = 24; for(let i=0;i<N;i++){ const a = ang + i*(Math.PI*2/N); const x = 64 + Math.cos(a)*R; const y = 56 + Math.sin(a)*R; px(x|0,y|0,P.chain); px((x+1)|0,y|0,P.chain_sh); if((i+now)%3===0) px((x-1)|0,(y-1)|0,P.highlight); const sx = 64 + Math.cos(a)*(R+3); const sy = 56 + Math.sin(a)*(R+3); px(sx|0,sy|0,P.chain_sh); const sx2 = 64 + Math.cos(a)*(R+4); const sy2 = 56 + Math.sin(a)*(R+4); px(sx2|0,sy2|0,P.chain); const sx3 = 64 + Math.cos(a)*(R+5); const sy3 = 56 + Math.sin(a)*(R+5); px(sx3|0,sy3|0,P.chain_sh); } })(now);

    (function drawExhaust(t){ rect(56,96,16,4,P.steel2); for(let i=0;i<8;i++) px(58+i,97,P.black); const seeds = [0,12,24]; seeds.forEach((s,idx)=>{ const life = ((t+s)%120); const y = 96 - Math.floor(life/3); const x = 64 + Math.round(Math.sin((life/10)+(idx*1.7))*4); if(y>20){ px(x,y,P.smoke1); px(x+1,y,P.smoke2); px(x,y-1,P.smoke3); } }); })(now);

    (function drawLights(t){ const on = ((t/6)|0)%2===0; const c = on ? P.glow : P.amber; rect(42,26,4,2,c); rect(84,26,4,2,c); if(((t/8)|0)%6===0){ px(66,30,P.highlight); } })(now);

    (function drawHandcuffs(t){ const anchor = { x:64, y:22 }; const sway = Math.sin(t/26)*0.28; const drop = 6 + Math.abs(Math.sin(t/40))*2; const offset = 14; const baseL = [anchor.x - offset, anchor.y + drop]; const baseR = [anchor.x + offset, anchor.y + drop]; const [cxL, cyL] = rot(baseL[0], baseL[1], sway, anchor.x, anchor.y); const [cxR, cyR] = rot(baseR[0], baseR[1], sway, anchor.x, anchor.y); const steps = 10; for(let i=0;i<=steps;i++){ const x = cxL + (cxR-cxL)*(i/steps); const y = cyL + (cyR-cyL)*(i/steps) + Math.sin(i/2 + t/10)*0.5; px(x|0,y|0,P.chain); if(i%2===0) px((x-1)|0,(y+1)|0,P.chain_sh); } function ring(cx,cy,R,out,inn){ circle(cx|0,cy|0,R,out,true); circle(cx|0,cy|0,R-2,inn,true); circle(cx|0,cy|0,R-4,out,false); } ring(cxL, cyL, 9, P.steel, P.iron); rect((cxL-2)|0,(cyL-10)|0,4,3,P.steel2); rect((cxL-3)|0,(cyL+6)|0,6,3,P.steel2); px((cxL)|0,(cyL+5)|0,P.highlight); ring(cxR, cyR, 9, P.steel, P.iron); rect((cxR-2)|0,(cyR-10)|0,4,3,P.steel2); rect((cxR-3)|0,(cyR+6)|0,6,3,P.steel2); px((cxR)|0,(cyR+5)|0,P.highlight); const midLx = (cxL+anchor.x)/2, midLy = (cyL+anchor.y)/2 + 2; const midRx = (cxR+anchor.x)/2, midRy = (cyR+anchor.y)/2 + 2; line(cxL|0,cyL|0, midLx|0, midLy|0, P.chain); line(cxR|0,cyR|0, midRx|0, midRy|0, P.chain); px(anchor.x, anchor.y, P.chain); })(now);

    // final: draw tmp into target ctx with imageSmoothing disabled so pixels copy exactly
    try{ if (typeof ctx !== 'undefined' && ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); ctx.drawImage(tmp, 0,0,G,G, 0,0,targetW,targetH); }
    }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBondtankInto = drawBondtankInto; }catch(_){ }

// Draw only the Bond turret artwork (centered, pointing up) into a target canvas/context
function drawBondTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const G = 128; // draw at high detail then scale by target dims
    const tmp = document.createElement('canvas'); tmp.width = G; tmp.height = G; const octx = tmp.getContext('2d');
    try{ octx.imageSmoothingEnabled = false; }catch(_){ }
    // helpers
    function px(x,y,col){ x|=0; y|=0; if(x<0||y<0||x>=G||y>=G) return; octx.fillStyle=col; octx.fillRect(x,y,1,1); }
    function rect(x,y,w,h,col){ for(let j=0;j<h;j++) for(let i=0;i<w;i++) px(x+i,y+j,col); }
    function circle(cx,cy,r,col){ for(let yy=-r; yy<=r; yy++) for(let xx=-r; xx<=r; xx++) if(xx*xx+yy*yy <= r*r) px(cx+xx, cy+yy, col); }
    function rotPt(x,y,ang,cx,cy){ const s=Math.sin(ang), c=Math.cos(ang); const dx=x-cx, dy=y-cy; return [Math.round(dx*c - dy*s + cx), Math.round(dx*s + dy*c + cy)]; }

    const P = { steel:'#2b2e36', steel2:'#3a3e49', rivet:'#d8dee7', red:'#6f000a', red_bright:'#c91521', chain:'#c0c6cf', soot:'#3b3b44' };

    octx.clearRect(0,0,G,G);
    // turret base center
    const cx = 64, cy = 56;
    // turret circle
    for(let yy=-18; yy<=18; yy++) for(let xx=-18; xx<=18; xx++){ if((xx*xx)/360 + (yy*yy)/144 <= 1){ const shade = yy<-6 ? P.red_bright : yy<0 ? P.red : yy<6 ? P.red : P.red; px(cx+xx, cy+yy, shade); } }
    // rivets
    for(let i=0;i<12;i++){ const a = i/12*Math.PI*2; const rx = Math.round(cx + Math.cos(a)*18); const ry = Math.round(cy + Math.sin(a)*18); px(rx,ry,P.rivet); }
    // barrel recoil animation
    const ang = (now/60) % (Math.PI*2);
    const recoil = Math.max(0, Math.sin(now/18)*2.0);
    const barrelLen = 44 - recoil; const barrelW = 3;
    const bx = cx, by = cy - 10;
    for(let L=0; L<barrelLen; L++){
      const tx = bx; const ty = by - L;
      for(let w=-barrelW; w<=barrelW; w++) px(tx+w, ty, (w===0||w===-1)?P.red_bright:P.steel2);
    }
    // barrel muzzle
    circle(bx, by - barrelLen, 3, P.soot);

    // top small chains / decorations
    for(let i=0;i<8;i++){ const a = i/8*Math.PI*2 + now*0.002; const x = Math.round(cx + Math.cos(a)*26); const y = Math.round(cy + Math.sin(a)*26); px(x,y,P.chain); }

    // draw tmp into target ctx scaled to targetW/targetH with imageSmoothing disabled
    try{ ctx.save(); try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.drawImage(tmp, 0,0,G,G, 0,0,targetW,targetH); ctx.restore(); }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawBondTurretInto = drawBondTurretInto; }catch(_){ }

// Draw German tank body into a target canvas/context (pixel-accurate from German.html)
function drawGermanBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // native art in German.html is 384x384 with center offset; recreate and scale down
    const N = 384;
  const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
  // clear temporary canvas to avoid any leftover pixels from previous draws
  try{ o.clearRect(0,0,N,N); }catch(_){ }
    const OFFSET = 32;
    // palette (verbatim from German.html)
    const P = { deB:'#000000', deR:'#DD0000', deG:'#FFCE00', hull:'#6E7B86', hullL:'#8C99A3', hullD:'#3F4750', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', outline:'#000000', shadow:'#00000055' };
    // helpers adapted from German.html
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect((x|0)+OFFSET,(y|0)+OFFSET,w|0,h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };

    function rr(x,y,w,h,r,fill){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); o.restore(); }
    function ro(x,y,w,h,r,stroke){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); o.restore(); }
    function clipRR(x,y,w,h,r){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.clip(); }
    function ellipseShadow(cx,cy,rx,ry){ o.save(); o.translate(OFFSET,OFFSET); o.fillStyle=P.shadow; o.beginPath(); o.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); o.fill(); o.restore(); }

    // Fine seam helpers
    const seamH=(x,y,w)=>R(x,y,w,1,P.hullD);
    const seamV=(x,y,h)=>R(x,y,1,h,P.hullD);

  // leave background transparent for drivable (divable) tank so body can be composited over world

    // running gear (treads)
    function tread(x,y,w,h,t){
      rr(x,y,w,h,8,P.trackD);
      R(x+1,y+1,w-2,1,P.trackL);
      R(x+1,y+h-2,w-2,1,P.trackL);
      for(let i=0;i<6;i++){ R(x+3, y+8+i*((h-16)/5), w-6, 1, P.gun); }
      const step=6, off=Math.floor(t/7)%step;
      for(let i=0;i<h/step;i++){ const yy = y + ((i*step + off) % h); R(x+3, yy, w-6, 2, P.trackL); }
      rr(x+2,y+2,w-4,6,3,P.trackL);
      rr(x+2,y+h-8,w-4,6,3,P.trackL);
      ro(x,y,w,h,8,P.outline);
    }

    // national cross helper
    function balkenCross(cx,cy){ R(cx-3,cy-1,6,2,"#fff"); R(cx-1,cy-3,2,6,"#fff"); R(cx-2,cy-1,4,2,P.deB); R(cx-1,cy-2,2,4,P.deB); }

    // hull draw (verbatim structure)
    function hull(){
      // hull shell
      rr(70,136,180,92,24,P.hullL); ro(70,136,180,92,24,P.outline);
  // tricolor wrap for hull area using clipRR (which saves) and a single restore
  clipRR(70,136,180,92,24);
      R(70,136,180,30,P.deB);
      R(70,166,180,30,P.deR);
      R(70,196,180,32,P.deG);
  o.restore();
      R(72,140,176,2,P.hull);

      balkenCross(86,180); balkenCross(226,180);
      // upper deck: paint tricolor across the deck area so the whole visible body reads as German-themed
      function paintTricolor(x,y,w,h){
        clipRR(x,y,w,h,12);
        const h1 = Math.floor(h/3);
        R(x, y, w, h1, P.deB);
        R(x, y + h1, w, h1, P.deR);
        R(x, y + 2*h1, w, h - 2*h1, P.deG);
        o.restore();
      }
      rr(94,160,132,46,12,P.hull); ro(94,160,132,46,12,P.outline);
      paintTricolor(94,160,132,46);
      seamH(96,172,128); seamH(96,184,128); seamV(120,162,40); seamV(204,162,40);
      for(let i=0;i<7;i++){ R(100+i*18,171,1,1,P.steel); R(100+i*18,183,1,1,P.steel); }
      for(let i=0;i<14;i++){ R(100+i*9,198,6,2,P.gun); }
      rr(90,210,16,12,3,P.hullD); ro(90,210,16,12,3,P.outline); R(92,214,12,2,P.gun);
      rr(218,210,16,12,3,P.hullD); ro(218,210,16,12,3,P.outline); R(220,214,12,2,P.gun);
      rr(66,150,10,70,8,P.hullD); ro(66,150,10,70,8,P.outline);
      rr(244,150,10,70,8,P.hullD); ro(244,150,10,70,8,P.outline);
    }

    // turret draw invoked for preview composition
    function turret(t){
      // shift turret slightly left to better center top elements over hull
      const cx=156, cy=164; o.save(); o.translate(OFFSET+cx,OFFSET+cy); const a=Math.sin(t/120)*0.46; o.rotate(a);
      function TRR(x,y,w,h,r,fill){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); }
      function TRO(x,y,w,h,r,stroke){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); }

      TRR(-44,-34,88,68,20,P.hull); TRO(-44,-34,88,68,20,P.outline);
      o.save(); o.beginPath(); o.moveTo(-40+16,-30); o.arcTo(40,-30,40,30,16); o.arcTo(40,30,-40,30,16); o.arcTo(-40,30,-40,-30,16); o.arcTo(-40,-30,40,-30,16); o.closePath(); o.clip();
      o.fillStyle=P.deB; o.fillRect(-40,-30,80,18);
      o.fillStyle=P.deR; o.fillRect(-40,-12,80,18);
      o.fillStyle=P.deG; o.fillRect(-40,  6,80,18);
      o.restore();

  TRR(14,-10,18,18,8,P.hullL); TRO(14,-10,18,18,8,P.outline);
  // nudge steel cupola panels left for better centering
  R(24,-6,3,2,P.steel); R(24,-1,3,2,P.steel); R(11,-12,3,2,P.steel);

      TRR(-12,-12,24,24,6,P.hullD); TRO(-12,-12,24,24,6,P.outline); R(-4,-2,8,1,P.gun);

      balkenCross(-18,0);

      const sway=Math.sin(t/90)*3; o.fillStyle=P.gun; o.fillRect(-26,-42,2,12); for(let i=0;i<14;i++) o.fillRect(-25+Math.sin((i/14)*Math.PI)*(1+sway/6),-42-i,1,1,P.steel);

  // nudge main armor/steel panels left slightly
  o.fillStyle=P.steel; o.fillRect(12,-6,92,6); o.fillStyle=P.gun; o.fillRect(12,-6,92,2);
  o.fillStyle=P.steel; o.fillRect(12, 6,92,6); o.fillStyle=P.gun; o.fillRect(12,10,92,2);
  o.fillStyle=P.gun;   o.fillRect(104,-6,6,6); o.fillRect(104,6,6,6);
  R(105,-5,1,1,"#888"); R(107,-4,1,1,"#888"); R(109,-5,1,1,"#888");
  R(105, 7,1,1,"#888"); R(107, 8,1,1,"#888"); R(109, 7,1,1,"#888");
      TRR(8,-8,6,16,3,P.hullD); TRO(8,-8,6,16,3,P.outline);

      o.restore();
    }

  // compose frame: treads and hull only (turret rendered separately)
  tread(56,132,36,112, now);
  tread(228,132,36,112, now);
  hull();

    // scale tmp into target ctx while preserving aspect ratio (centered)
    try{
      if (ctx && ctx.drawImage){
        try{ ctx.imageSmoothingEnabled = false; }catch(_){ }
        ctx.clearRect(0,0,targetW,targetH);
        const scale = Math.min(targetW / N, targetH / N);
        const dw = Math.round(N * scale);
        const dh = Math.round(N * scale);
        const dx = Math.floor((targetW - dw) / 2);
        const dy = Math.floor((targetH - dh) / 2);
        ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh);
      }
    }catch(_){ }
  }catch(_){ }
}

// Draw German turret only (for rotating turret canvas)
function drawGermanTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
  const N = 384; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
  // clear temporary turret canvas before drawing
  try{ o.clearRect(0,0,N,N); }catch(_){ }
    const OFFSET = 32;
    const P = { deB:'#000000', deR:'#DD0000', deG:'#FFCE00', hull:'#6E7B86', hullL:'#8C99A3', hullD:'#3F4750', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', outline:'#000000', shadow:'#00000055' };
  function TRR(x,y,w,h,r,fill){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); o.restore(); }
  function TRO(x,y,w,h,r,stroke){ o.save(); o.translate(OFFSET,OFFSET); o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); o.restore(); }
  // small pixel helper used by turret (mirrors drawGermanBodyInto's R)
  const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect((x|0)+OFFSET,(y|0)+OFFSET,w|0,h|0); };
  function balkenCross(cx,cy){ R(cx-3,cy-1,6,2,"#fff"); R(cx-1,cy-3,2,6,"#fff"); R(cx-2,cy-1,4,2,P.deB); R(cx-1,cy-2,2,4,P.deB); }
    // turret draw (verbatim from German.html turret block)
  const cx = 160, cy = 160; o.save(); o.translate(OFFSET+cx,OFFSET+cy);
    function TRR_local(x,y,w,h,r,fill){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.fillStyle=fill; o.fill(); }
    function TRO_local(x,y,w,h,r,stroke){ o.beginPath(); o.moveTo(x+r,y); o.arcTo(x+w,y,x+w,y+h,r); o.arcTo(x+w,y+h,x,y+h,r); o.arcTo(x,y+h,x,y,r); o.arcTo(x,y,x+w,y,r); o.closePath(); o.strokeStyle=stroke; o.lineWidth=1; o.stroke(); }
    TRR_local(-44,-34,88,68,20,P.hull); TRO_local(-44,-34,88,68,20,P.outline);
    o.save(); o.beginPath(); o.moveTo(-40+16,-30); o.arcTo(40,-30,40,30,16); o.arcTo(40,30,-40,30,16); o.arcTo(-40,30,-40,-30,16); o.arcTo(-40,-30,40,-30,16); o.closePath(); o.clip();
    o.fillStyle=P.deB; o.fillRect(-40,-30,80,18);
    o.fillStyle=P.deR; o.fillRect(-40,-12,80,18);
    o.fillStyle=P.deG; o.fillRect(-40,6,80,18);
    o.restore();

    // Cupola ring with periscopes (exact coordinates from German.html)
    TRR_local(14,-10,18,18,8,P.hullL); TRO_local(14,-10,18,18,8,P.outline);
    R(28,-6,3,2,P.steel); R(28,-1,3,2,P.steel); R(15,-12,3,2,P.steel);

    // Vision slit on mantlet
    TRR_local(-12,-12,24,24,6,P.hullD); TRO_local(-12,-12,24,24,6,P.outline); R(-4,-2,8,1,P.gun);

    // Marking
    balkenCross(-18,0);

    // Antenna (static, no sway)
    o.fillStyle=P.gun; o.fillRect(-26,-42,2,12); for(let i=0;i<14;i++) o.fillRect(-25+Math.sin((i/14)*Math.PI)*(1),-42-i,1,1,P.steel);

    // Twin barrels with perforated muzzle brakes
    o.fillStyle=P.steel; o.fillRect(16,-6,92,6); o.fillStyle=P.gun; o.fillRect(16,-6,92,2);
    o.fillStyle=P.steel; o.fillRect(16,6,92,6); o.fillStyle=P.gun; o.fillRect(16,10,92,2);
    o.fillStyle=P.gun; o.fillRect(108,-6,6,6); o.fillRect(108,6,6,6);
    R(109,-5,1,1,"#888"); R(111,-4,1,1,"#888"); R(113,-5,1,1,"#888");
    R(109,7,1,1,"#888"); R(111,8,1,1,"#888"); R(113,7,1,1,"#888");

    // Barrel brace
    TRR_local(8,-8,6,16,3,P.hullD); TRO_local(8,-8,6,16,3,P.outline);
    o.restore();
    try{
      if (ctx && ctx.drawImage){
        try{ ctx.imageSmoothingEnabled = false; }catch(_){ }
        ctx.clearRect(0,0,targetW,targetH);
        const scale = Math.min(targetW / N, targetH / N);
        const dw = Math.round(N * scale);
        const dh = Math.round(N * scale);
        const dx = Math.floor((targetW - dw) / 2);
        const dy = Math.floor((targetH - dh) / 2);
        ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh);
      }
    }catch(_){ }
  }catch(_){ }
}

// Draw Mexican tank body into a target canvas/context (pixel-accurate from Mexico.html)
function drawMexicoBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // native art in Mexico.html is 320x320
    const N = 320;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Palette and helpers (ported from Mexico.html)
    const P = { mxG:'#006847', mxW:'#FFFFFF', mxR:'#CE1126', hullD:'#074D36', hullL:'#1E7F5C', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', gold:'#C8A200', brown:'#7B4B2A', bean:'#9C5B3A', bean2:'#8B4B33', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function rivet(x,y){ R(x,y,2,2,P.steel); }
    function bolt(x,y){ R(x,y,1,1,P.gunD); }
    function ellipseShadow(cx,cy,rx,ry){ o.save(); o.fillStyle=P.shadow; o.beginPath(); o.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); o.fill(); o.restore(); }
    function beanPixel(x,y){ R(x, y, 1, 1, Math.random() < 0.5 ? P.bean : P.bean2); if(Math.random()<0.6) R(x+1, y, 1, 1, P.bean2); if(Math.random()<0.4) R(x, y+1, 1, 1, P.bean); }
    function beanSack(x,y,w=14,h=10,seed=0){ R(x, y, w, h, P.brown); R(x + (w>>1) - 1, y-2, 2, 2, P.gun); R(x, y, w, 1, P.hullL); O(x, y, w, h, P.outline); for(let i=0;i<4;i++){ beanPixel(x + 2 + ((i*3 + seed)% (w-3)), y + 2 + (i%2)); } }
    function beanCrate(x,y,w=22,h=12,open=true,seed=0){ R(x, y, w, h, "#6b4a2f"); O(x, y, w, h, P.outline); for(let i=0;i<Math.floor(w/5);i++){ R(x + i*5, y, 1, h, "#5c3f29"); } R(x-2, y-2, w+4, 2, P.steel); R(x-2, y+h, w+4, 2, P.steel); if(open){ for(let i=0;i<30;i++){ const bx = x + 2 + ((i*3 + seed)% (w-4)); const by = y + 2 + (i% (h-4)); beanPixel(bx, by); } R(x, y-1, w, 1, "#7a5a3a"); } }

    function tread(x,y,w,h,t){ R(x,y,w,h,P.trackD); for(let i=0;i<5;i++){ R(x+2, y+6+i*((h-12)/4), w-4, 2, P.trackL); } const step = 6, off = Math.floor(t/7)%step; for(let i=0;i<h/step;i++){ const yy = y + ((i*step + off) % h); R(x+3, yy, w-6, 2, P.trackL); } O(x,y,w,h,P.outline); }

    function hull(){ R(76,140,168,80,P.hullL); R(78,142,164,76,P.hullL); R(68,146,8,72,P.hullD); R(244,146,8,72,P.hullD); R(88,120,144,20,P.hullL); R(90,120,140,6,P.mxG); O(88,120,144,20,P.outline); R(90,220,140,12,P.hullD); O(90,220,140,12,P.outline); for(let i=0;i<9;i++){ for(let j=0;j<2;j++){ const tx = 94 + i*15, ty = 126 + j*9; R(tx,ty,11,7,P.hullL); O(tx,ty,11,7,P.outline); bolt(tx+5,ty+3); } } R(92,156,136,48,P.hullL); R(94,158,132,44,P.hullL); O(92,156,136,48,P.outline); R(108,164,24,14,P.hullD); O(108,164,24,14,P.outline); rivet(114,168); rivet(122,168); R(188,164,24,14,P.hullD); O(188,164,24,14,P.outline); rivet(194,168); rivet(202,168); for(let i=0;i<10;i++){ R(112+i*10,196,6,2,P.gun); } for(let i=0;i<14;i++){ rivet(70,148+i*5); rivet(250,148+i*5); } O(76,140,168,80,P.outline); }

    function mexicanEmblemTiny(cx,cy){ R(cx-2, cy-1, 4, 3, P.gold); R(cx-4, cy+2, 8, 1, P.bean); R(cx-3, cy+1, 6, 1, P.brown); }

    function turret(t){ const cx=160, cy=164; o.save(); o.translate(cx,cy); const a = Math.sin(t/120)*0.46; o.rotate(a); R(-40,-30,80,60,P.hullL); R(-38,-28,76,56,P.hullL); O(-40,-30,80,60,P.outline); R(-46,-14,6,28,P.hullD); R(40,-14,6,28,P.hullD); O(-46,-14,6,28,P.outline); O(40,-14,6,28,P.outline); R(-10,-12,20,24,P.hullD); O(-10,-12,20,24,P.outline); R(-38,-28,24,56,P.mxG); R(-14,-28,24,56,P.mxW); R(10,-28,24,56,P.mxR); mexicanEmblemTiny(-2,-4); R(-22,-8,12,12,P.hullD); O(-22,-8,12,12,P.outline); rivet(-18,-4); rivet(-12,-4); const sway = Math.sin(t/90)*3; R(-26,-30,2, -12, P.gun); for(let i=0;i<14;i++){ R(-25 + Math.sin((i/14)*Math.PI)*(1+sway/6), -42 - i, 1, 1, P.steel); } R(16,-6,90,6,P.steel);  R(16,-6,90,2,P.gun); R(106,-6,2,6,P.gun); R(16, 6,90,6,P.steel);  R(16,10,90,2,P.gun); R(106,6,2,6,P.gun); R(8,-8,6,16,P.hullD); O(8,-8,6,16,P.outline); for(let i=0;i<6;i++){ bolt(-36+i*12,-28); bolt(-36+i*12,28); } o.restore(); }

    function beanRack(side="left", jiggle=0, tier=0){ const baseY = 146 - tier*18; const height = 64; const xBar = (side==="left") ? 66 : 246; R(xBar, baseY, 2, height, P.gun); R(xBar + ((side==="left")?6:-6), baseY, 2, height, P.gun); R(xBar-1, baseY, 10, 2, P.gun); R(xBar-1, baseY+height-2, 10, 2, P.gun); const xSack = (side==="left") ? xBar-12 : xBar- (14-2); for(let i=0;i<5;i++){ const yS = baseY + 4 + i* ((height-10)/5) + (i%2 ? jiggle : -jiggle); beanSack(xSack, yS, 14, 10, i + (tier*7)); } }

    function deckBeans(t){ R(92,156,136,2,P.steel); R(92,202,136,2,P.steel); const j = Math.round(Math.sin(t/150)); beanSack(96,160 + j, 14, 10, 1); beanSack(112,160 - j, 14, 10, 2); beanSack(202,160 - j, 14, 10, 3); beanSack(218,160 + j, 14, 10, 4); beanCrate(110,206,22,12,true, 11); beanCrate(188,206,22,12,true, 17); for(let i=0;i<10;i++){ beanPixel(110 + 2 + (i%20), 219 + (i%2)); beanPixel(188 + 2 + ((i+5)%20), 219 + (i%2)); } }

  // keep background transparent (no solid fill) so tank body composes over world
  function drawBG(){ ellipseShadow(160,210,105,26); }

  // don't draw turret into the body canvas; turret is rendered from the separate turret canvas
  function frame(t){ drawBG(); tread(56,132,36,112,t); tread(228,132,36,112,t); hull(); const jiggle = Math.round(Math.sin(t/140)); beanRack("left",  jiggle, 0); beanRack("left", -jiggle, 1); beanRack("right", -jiggle, 0); beanRack("right",  jiggle, 1); deckBeans(t); }

    // compose once into tmp
    try{ frame(now); }catch(_){ }

    // scale tmp into target ctx
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw Mexican turret only (for rotating turret canvas)
function drawMexicoTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 320; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Reuse helpers/palette from body draw
    const P = { mxG:'#006847', mxW:'#FFFFFF', mxR:'#CE1126', hullD:'#074D36', hullL:'#1E7F5C', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#474747', gold:'#C8A200', brown:'#7B4B2A', bean:'#9C5B3A', bean2:'#8B4B33', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function mexicanEmblemTiny(cx,cy){ R(cx-2, cy-1, 4, 3, P.gold); R(cx-4, cy+2, 8, 1, P.bean); R(cx-3, cy+1, 6, 1, P.brown); }
  // turret (same pivot as in Mexico.html)
  const cx=160, cy=160; o.save(); o.translate(cx,cy);
    // turret body
    R(-40,-30,80,60,P.hullL); R(-38,-28,76,56,P.hullL); O(-40,-30,80,60,P.outline);
    R(-38,-28,24,56,P.mxG); R(-14,-28,24,56,P.mxW); R(10,-28,24,56,P.mxR);
    mexicanEmblemTiny(-2,-4);
    // cupola and periscopes
    R(-22,-8,12,12,P.hullD); O(-22,-8,12,12,P.outline);
    // antenna (static, no sway)
    R(-26,-30,2, -12, P.gun); for(let i=0;i<14;i++){ R(-25 + Math.sin((i/14)*Math.PI)*(1), -42 - i, 1, 1, P.steel); }
    // heavy twin barrels
    R(16,-6,90,6,P.steel);  R(16,-6,90,2,P.gun); R(106,-6,2,6,P.gun);
    R(16, 6,90,6,P.steel);  R(16,10,90,2,P.gun); R(106,6,2,6,P.gun);
    o.restore();

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw China tank body (256x256 native) into target canvas
function drawChinaBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 256;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { red:'#C8102E', redD:'#660000', redL:'#FF3333', gold:'#FFD700', goldL:'#FFF59D', gun:'#212121', steel:'#B0BEC5', trackD:'#111111', trackL:'#444444', shadow:'#00000066', outline:'#000' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const rectO = (x,y,w,h,c)=>{ px(x,y,w,1,c); px(x,y+h-1,w,1,c); px(x,y,1,h,c); px(x+w-1,y,1,h,c); };
    const rivet = (x,y)=>{ px(x,y,2,2,P.steel); };
    function star(x,y,size,col){ o.fillStyle=col; for(let i=-size;i<=size;i++){ for(let j=-size;j<=size;j++){ if(Math.abs(i)+Math.abs(j)<=size) o.fillRect(x+i,y+j,1,1); } } }
    function tread(x,y,w,h,t){ px(x,y,w,h,P.trackD); let step=6,off=Math.floor(t/8)%step; for(let i=0;i<h/step;i++){ px(x+3,y+((i*step+off)%h),w-6,2,P.trackL); } rectO(x,y,w,h,P.outline); }
    function hull(){ px(64,96,128,64,P.red); px(66,98,124,60,P.redL); px(60,100,4,56,P.redD); px(192,100,4,56,P.redD); px(72,84,112,12,P.red); px(74,84,108,4,P.redL); px(72,160,112,8,P.redD); for(let i=0;i<10;i++){ rivet(64+i*12,96); } for(let i=0;i<10;i++){ rivet(64+i*12,160); } rectO(64,96,128,64,P.outline); rectO(72,84,112,12,P.outline); rectO(72,160,112,8,P.outline); }
    function turretBody(t){ const cx=128,cy=128; o.save(); o.translate(cx,cy); let a=Math.sin(t/100)*0.55; o.rotate(a); px(-28,-24,56,48,P.red); px(-26,-22,52,44,P.redL); px(-32,-12,4,24,P.redD); px(28,-12,4,24,P.redD); px(-6,-12,12,24,P.redD); rivet(-20,-20); rivet(20,-20); rivet(-20,20); rivet(20,20); rectO(-28,-24,56,48,P.outline); px(16,-6,60,6,P.steel);px(16,-6,60,2,P.gun); px(16,6,60,6,P.steel);px(16,10,60,2,P.gun); px(76,-6,2,6,P.gun);px(76,6,2,6,P.gun); star(-12,-12,3,P.gold); px(8,-20,3,3,P.gold); px(16,-12,3,3,P.gold); px(16,-4,3,3,P.gold); px(12,4,3,3,P.gold); o.restore(); }
    function shadow(){ o.fillStyle=P.shadow; o.beginPath(); o.ellipse(128,176,80,20,0,0,Math.PI*2); o.fill(); }

    // keep background transparent and render hull/treads; turret drawn only in turret canvas
    shadow();
    tread(48,88,28,96, now);
    tread(180,88,28,96, now);
    hull();

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw China turret only (for rotating turret canvas)
function drawChinaTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 256; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { red:'#C8102E', redD:'#660000', redL:'#FF3333', gold:'#FFD700', goldL:'#FFF59D', gun:'#212121', steel:'#B0BEC5', trackD:'#111111', trackL:'#444444', shadow:'#00000066', outline:'#000' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const rectO = (x,y,w,h,c)=>{ px(x,y,w,1,c); px(x,y+h-1,w,1,c); px(x,y,1,h,c); px(x+w-1,y,1,h,c); };
    const rivet = (x,y)=>{ px(x,y,2,2,P.steel); };
    const star = (x,y,size,col)=>{ o.fillStyle=col; for(let i=-size;i<=size;i++){ for(let j=-size;j<=size;j++){ if(Math.abs(i)+Math.abs(j)<=size) o.fillRect(x+i,y+j,1,1); } } };
    const cx=128,cy=128; o.save(); o.translate(cx,cy);
    px(-28,-24,56,48,P.red); px(-26,-22,52,44,P.redL); px(-32,-12,4,24,P.redD); px(28,-12,4,24,P.redD); px(-6,-12,12,24,P.redD); rivet(-20,-20); rivet(20,-20); rivet(-20,20); rivet(20,20); rectO(-28,-24,56,48,P.outline); px(16,-6,60,6,P.steel);px(16,-6,60,2,P.gun); px(16,6,60,6,P.steel);px(16,10,60,2,P.gun); px(76,-6,2,6,P.gun);px(76,6,2,6,P.gun); star(-12,-12,3,P.gold); px(8,-20,3,3,P.gold); px(16,-12,3,3,P.gold); px(16,-4,3,3,P.gold); px(12,4,3,3,P.gold);
    o.restore();

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// McD's tank (64x64 native) body + turret
function drawMcdsBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 64; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { bg:'#22252a', trackDark:'#2b2b2b', trackLite:'#777777', hullRed:'#c1121f', hullDeep:'#7a0e14', archGold:'#ffd100', roof:'#6b3e2e', roofLite:'#8a543c', window:'#7cc7ff', shadow:'#141414', white:'#ffffff', black:'#000000', green:'#2f6c3f', bun:'#d8a55a', bunDark:'#b27e39', lettuce:'#4aa54a', cheese:'#f9d65a', patty:'#5a2f1d', tomato:'#c44a3a' };
    const rect = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const px = (x,y,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,1,1); };
  // keep background transparent for McD's body
  function drawGround(){ /* intentionally empty to preserve transparency */ }
    function tread(x,y,offset){ rect(x,y,8,48,P.trackDark); rect(x,y,1,48,P.trackLite); rect(x+7,y,1,48,P.shadow); for(let i=y+(offset%4); i<y+48; i+=4){ rect(x+1,i,6,2,P.black); rect(x+1,i+1,6,1,P.trackLite); } }
    function drawHull(){ rect(13,44,38,8,P.hullDeep); rect(13,12,38,40,P.hullRed); rect(14,16,36,2,P.archGold); rect(14,20,36,1,P.archGold); const wx=[18,26,34,42]; wx.forEach(x=>{ rect(x,23,4,4,P.window); px(x,23,P.white); }); wx.forEach(x=>{ rect(x,29,4,4,P.window); px(x+1,29,P.white); }); rect(30,36,6,8,P.black); rect(31,37,4,6,P.window); px(34,39,P.white); [16,22,40,46].forEach(x=>{ rect(x,43,3,2,P.green); px(x+1,42,P.green); }); facadeM(30,33); }
    function facadeM(fx,fy){ rect(fx-7,fy-8,3,9,P.archGold); rect(fx+5,fy-8,3,9,P.archGold); rect(fx-2,fy-5,2,2,P.archGold); rect(fx,fy-3,2,2,P.archGold); rect(fx+2,fy-5,2,2,P.archGold); rect(fx-7,fy-8,15,1,P.archGold); rect(fx-4,fy-6,2,1,P.hullDeep); rect(fx+2,fy-6,2,1,P.hullDeep); }
    function drawRoof(){ rect(18,10,28,6,P.roof); rect(18,10,28,1,P.roofLite); rect(21,11,2,2,P.shadow); rect(41,11,2,2,P.shadow); }
    function turret(angleRad){ o.save(); o.translate(32,32); o.rotate(angleRad); rect(-8,5,16,2,P.bunDark); rect(-8,3,16,2,P.patty); rect(-9,1,18,2,P.cheese); rect(-8,-1,16,2,P.lettuce); rect(-8,-3,16,2,P.tomato); rect(-8,-7,16,4,P.bun); if (Math.floor(now/120) % 2 === 0){ px(-5,-7,P.white); px(0,-7,P.white); px(5,-7,P.white); } // turret M
      // M
      rect(-5,-7,2,6,P.archGold); rect(3,-7,2,6,P.archGold); rect(-2,-5,2,2,P.archGold); rect(0,-4,2,2,P.archGold); rect(2,-5,2,2,P.archGold); rect(-5,-8,10,1,P.archGold); rect(-3,-6,1,1,P.hullDeep); rect(2,-6,1,1,P.hullDeep);
      rect(8,-1,12,2,P.archGold); px(19,-1,P.white); if (Math.floor(now/120) % 3 === 0) px(20,-1,'#ff4d4d'); o.restore(); }

  // compose (no background fill here; turret is rendered from turret canvas)
  // scale the McD body art down so the body is 75% of the native 64px canvas
  try{ o.save(); o.translate(32,32); o.scale(0.75,0.75); o.translate(-32,-32);
    tread(6,8, Math.floor(now/120)); tread(64-14,8, Math.floor(now/120)); drawHull(); drawRoof();
  }catch(_){ }
  try{ o.restore(); }catch(_){ }
  const angle = ((Math.floor(now/120) % 6) * (Math.PI*2/6));

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

function drawMcdsTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now(); const N = 64; const tmp = document.createElement('canvas'); tmp.width=N; tmp.height=N; const o=tmp.getContext('2d'); try{o.imageSmoothingEnabled=false;}catch(_){ }
    try{o.clearRect(0,0,N,N);}catch(_){ }
    const P = { bun:'#d8a55a', bunDark:'#b27e39', patty:'#5a2f1d', cheese:'#f9d65a', lettuce:'#4aa54a', tomato:'#c44a3a', archGold:'#ffd100', white:'#ffffff' };
    const rect=(x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const px=(x,y,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,1,1); };
  const angle = -Math.PI/2; // -90-degree rotation to flip backwards turret
  o.save(); o.translate(32,32); // pivot
  o.rotate(angle); // use base animation angle (remove extra 180deg rotation)
  o.scale(0.75, 0.75); // reduce turret size by 25%
    rect(-8,5,16,2,P.bunDark); rect(-8,3,16,2,P.patty); rect(-9,1,18,2,P.cheese); rect(-8,-1,16,2,P.lettuce); rect(-8,-3,16,2,P.tomato); rect(-8,-7,16,4,P.bun); rect(-5,-7,2,6,P.archGold); rect(3,-7,2,6,P.archGold); rect(-2,-5,2,2,P.archGold); rect(0,-4,2,2,P.archGold); rect(2,-5,2,2,P.archGold); rect(-5,-8,10,1,P.archGold); rect(-3,-6,1,1,P.patty); rect(2,-6,1,1,P.patty); rect(8,-1,12,2,P.archGold); px(19,-1,P.white); px(20,-1,P.white); o.restore();
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// (Removed stray gameplay helpers that belonged in game.js)

// Draw French tank body into a target canvas/context (pixel-accurate from French.html)
function drawFrenchBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // native art in French.html is 320x320
    const N = 320;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Palette and helpers (ported from French.html)
    const P = { frB:'#0055A4', frW:'#FFFFFF', frR:'#EF4135', hullB:'#0A3F7A', hullBL:'#1E6BC1', hullBD:'#062846', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#464646', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function rivet(x,y){ R(x,y,2,2,P.steel); }
    function bolt(x,y){ R(x,y,1,1,P.gunD); }
    function ellipseShadow(cx,cy,rx,ry){ o.save(); o.fillStyle=P.shadow; o.beginPath(); o.ellipse(cx,cy,rx,ry,0,0,Math.PI*2); o.fill(); o.restore(); }

    // Treads
    function tread(x,y,w,h,t){
      R(x,y,w,h,P.trackD);
      for (let i=0;i<5;i++){ R(x+2, y+6+i*((h-12)/4), w-4, 2, P.trackL); }
      const step = 6, off = Math.floor(t/7)%step;
      for (let i=0;i<h/step;i++){ const yy = y + ((i*step + off) % h); R(x+3, yy, w-6, 2, P.trackL); }
      O(x,y,w,h,P.outline);
    }

    // Hull
    function hull(){
      R(76,140,168,80,P.hullB);
      R(78,142,164,76,P.hullBL);
      R(68,146,8,72,P.hullBD);
      R(244,146,8,72,P.hullBD);
      R(88,120,144,20,P.hullB);
      R(90,120,140,6,P.hullBL);
      O(88,120,144,20,P.outline);
      R(90,220,140,12,P.hullBD);
      O(90,220,140,12,P.outline);
      for (let i=0;i<9;i++){
        for (let j=0;j<2;j++){
          const tx = 94 + i*15, ty = 126 + j*9;
          R(tx,ty,11,7,P.hullB);
          O(tx,ty,11,7,P.outline);
          bolt(tx+5,ty+3);
        }
      }
      R(92,156,136,48,P.hullB);
      R(94,158,132,44,P.hullBL);
      O(92,156,136,48,P.outline);
      R(108,164,24,14,P.hullBD); O(108,164,24,14,P.outline); rivet(114,168); rivet(122,168);
      R(188,164,24,14,P.hullBD); O(188,164,24,14,P.outline); rivet(194,168); rivet(202,168);
      for (let i=0;i<10;i++){ R(112+i*10,196,6,2,P.gun); }
      for (let i=0;i<14;i++){ rivet(70,148+i*5); rivet(250,148+i*5); }
      O(76,140,168,80,P.outline);
    }

    // Shadow
    ellipseShadow(160,210,105,26);

    // Render treads and hull
    tread(56,132,36,112,now);
    tread(228,132,36,112,now);
    hull();

    // draw into target
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw French turret only (for rotating turret canvas)
function drawFrenchTurretInto(ctx, targetW, targetH, ts, angle){
  try{
    const now = ts || performance.now();
    const N = 320; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { frB:'#0055A4', frW:'#FFFFFF', frR:'#EF4135', hullB:'#0A3F7A', hullBL:'#1E6BC1', hullBD:'#062846', steel:'#B0BEC5', gun:'#232323', gunD:'#101010', trackD:'#111111', trackL:'#464646', outline:'#000000', shadow:'#00000055' };
    const R = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0, y|0, w|0, h|0); };
    const O = (x,y,w,h,c)=>{ R(x,y,w,1,c); R(x,y+h-1,w,1,c); R(x,y,1,h,c); R(x+w-1,y,1,h,c); };
    function rivet(x,y){ R(x,y,2,2,P.steel); }
    function frenchRoundel(cx,cy){ R(cx-6,cy-6,12,12,P.frB); R(cx-4,cy-4,8,8,P.frW); R(cx-2,cy-2,4,4,P.frR); }

    const cx=160, cy=164; o.save(); o.translate(cx,cy);
    // Draw turret pointing to the right (forward direction) by default
    // The game engine will rotate this canvas to point toward the cursor
    const defaultAngle = angle !== undefined ? angle : Math.PI/2; // 90 degrees (right) by default
    o.rotate(defaultAngle);

    R(-40,-30,80,60,P.hullB);
    R(-38,-28,76,56,P.hullBL);
    O(-40,-30,80,60,P.outline);
    R(-46,-14,6,28,P.hullBD);
    R(40,-14,6,28,P.hullBD);
    O(-46,-14,6,28,P.outline);
    O(40,-14,6,28,P.outline);
    R(-10,-12,20,24,P.hullBD);
    O(-10,-12,20,24,P.outline);
    R(-38,-28,24,56,P.frB);
    R(-14,-28,24,56,P.frW);
    R(10,-28,24,56,P.frR);
    R(-36,-28,72,2,P.hullBL);
    frenchRoundel(18,-10);
    R(-22,-8,12,12,P.hullBD); O(-22,-8,12,12,P.outline); rivet(-18,-4); rivet(-12,-4);
    // Fixed gun position pointing forward (right)
    R(30,-2,2, 4, P.gun); // Main gun barrel pointing right
    for(let i=0;i<16;i++){ R(32 + i, -1, 1, 1, P.steel); } // Long barrel extension
    // Side guns
    R(16,-6,60,6,P.steel); R(16,-6,60,2,P.gun); // Top side gun
    R(76,-6,2,6,P.gun);
    R(16, 6,60,6,P.steel); R(16,10,60,2,P.gun); // Bottom side gun
    R(76,6,2,6,P.gun);
    R(8,-8,6,16,P.hullBD); O(8,-8,6,16,P.outline);
    for(let i=0;i<6;i++){ R(-36+i*12,-28,1,1,P.gunD); R(-36+i*12,28,1,1,P.gunD); }
    o.restore();

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawFrenchBodyInto = drawFrenchBodyInto; }catch(_){ }
try{ if (typeof window !== 'undefined') window.drawFrenchTurretInto = drawFrenchTurretInto; }catch(_){ }

// Draw Waffle tank body into a target canvas/context (pixel-accurate from Waffel.html)
function drawWaffleBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // Original 64x64 resolution
    const N = 64;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }

    // Color palette from Waffel.html
    const COL = {
      waffleL: '#F4CC7A', waffle: '#E3AF52', waffleD: '#C88D35', waffleX: '#9F6B23',
      waffleEdgeD: '#7F531B', syrup: '#7B3A14', syrupD: '#5E2B0F', syrupL: '#9C4B1B',
      syrupHL: '#C76934', butter: '#FFF2AC', butterD: '#E5D07C', steelL: '#9AA0A8',
      steel: '#6F7781', steelD: '#3D4249', tread: '#1B1C1F', treadL: '#2A2C31',
      treadHL: '#3A3D45', shadow: 'rgba(0,0,0,0.25)', rim: 'rgba(255,255,255,0.06)',
      bolt: '#A18F64'
    };

    // Helper functions
    const px = (x, y, c) => { o.fillStyle = c; o.fillRect(x|0, y|0, 1, 1); };
    const rect = (x, y, w, h, c) => { o.fillStyle = c; o.fillRect(x|0, y|0, w|0, h|0); };
    const hline = (x, y, w, c) => { rect(x, y, w, 1, c); };
    const vline = (x, y, h, c) => { rect(x, y, 1, h, c); };
    const fillCircle = (cx, cy, r, c) => {
      o.fillStyle = c; o.beginPath(); o.arc(cx+0.5, cy+0.5, r, 0, Math.PI*2); o.closePath(); o.fill();
    };
    function roundRect(x, y, w, h, r, c) {
      o.fillStyle = c; o.beginPath();
      o.moveTo(x+r, y); o.lineTo(x+w-r, y); o.lineTo(x+w, y+r); o.lineTo(x+w, y+h-r);
      o.lineTo(x+w-r, y+h); o.lineTo(x+r, y+h); o.lineTo(x, y+h-r); o.lineTo(x, y+r);
      o.closePath(); o.fill();
    }

    // Tank geometry - scaled down to 75% size
    const scale = 0.75;
    const cx = 32, cy = 32;
    const hull = { x: cx - 15*scale, y: cy - 15*scale, w: 30*scale, h: 30*scale, r: 4.5*scale };
    const treadL = { x: cx - 20*scale, y: cy - 14*scale, w: 6*scale, h: 33*scale };
    const treadR = { x: cx + 14*scale, y: cy - 14*scale, w: 6*scale, h: 33*scale };

    // Draw treads
    roundRect(treadL.x, treadL.y, treadL.w, treadL.h, 3, COL.tread);
    rect(treadL.x+1, treadL.y+1, treadL.w-2, treadL.h-2, COL.treadL);
    roundRect(treadR.x, treadR.y, treadR.w, treadR.h, 3, COL.tread);
    rect(treadR.x+1, treadR.y+1, treadR.w-2, treadR.h-2, COL.treadL);

    // Lug pattern on treads
    const step = 4.5 * scale;
    for (let y=treadL.y+1.5*scale; y<treadL.y+treadL.h-1.5*scale; y+=step) {
      rect(treadL.x+1.5*scale, y, 3*scale, 1.5*scale, COL.treadHL);
    }
    for (let y=treadR.y+1.5*scale; y<treadR.y+treadR.h-1.5*scale; y+=step) {
      rect(treadR.x+1.5*scale, y, 3*scale, 1.5*scale, COL.treadHL);
    }

    // Tiny steel rollers
    for (let y=treadL.y+4.5*scale; y<treadL.y+treadL.h-4.5*scale; y+=7.5*scale) {
      fillCircle(treadL.x+3*scale, y, 0.9*scale, COL.steel);
      fillCircle(treadR.x+3*scale, y, 0.9*scale, COL.steel);
    }

    // Draw hull (waffle body)
    roundRect(hull.x, hull.y, hull.w, hull.h, hull.r, COL.waffle);

    // Edge shading
    rect(hull.x, hull.y+hull.h-4, hull.w, 4, COL.waffleD);
    rect(hull.x+hull.w-4, hull.y, 4, hull.h, COL.waffleD);
    rect(hull.x+hull.w-1, hull.y+2, 1, hull.h-4, COL.waffleEdgeD);
    rect(hull.x+2, hull.y+hull.h-1, hull.w-4, 1, COL.waffleEdgeD);

    // Top-left rim light
    rect(hull.x, hull.y, hull.w-6, 1, COL.waffleL);
    rect(hull.x, hull.y+1, 1, hull.h-6, COL.waffleL);

    // Waffle grid pattern
    const gridStep = 4.5 * scale; // Scaled grid spacing
    const gx0 = hull.x + 2.25*scale, gx1 = hull.x + hull.w - 2.25*scale;
    const gy0 = hull.y + 2.25*scale, gy1 = hull.y + hull.h - 2.25*scale;
    for (let x = gx0; x <= gx1; x += gridStep) vline(x, gy0, gy1-gy0, COL.waffleX);
    for (let y = gy0; y <= gy1; y += gridStep) hline(gx0, y, gx1-gx0, COL.waffleX);

    // Intersection nubs
    for (let x = gx0; x <= gx1; x += gridStep) {
      for (let y = gy0; y <= gy1; y += gridStep) {
        px(x, y, COL.waffleD);
      }
    }

    // Hull bolts
    const bolts = [
      [hull.x + 4.5*scale, hull.y + 4.5*scale], 
      [hull.x + hull.w - 5.25*scale, hull.y + 4.5*scale],
      [hull.x + 4.5*scale, hull.y + hull.h - 5.25*scale], 
      [hull.x + hull.w - 5.25*scale, hull.y + hull.h - 5.25*scale]
    ];
    bolts.forEach(([x,y]) => { fillCircle(x, y, 0.75*scale, COL.bolt); });

    // Inner vignette for depth
    o.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(hull.x + 1.5*scale, hull.y + 1.5*scale, hull.w - 3*scale, hull.h - 3*scale, hull.r - 1.5*scale, o.fillStyle);

    // Syrup blob - scaled
    o.fillStyle = COL.syrup;
    o.beginPath();
    o.moveTo(cx - 4.5*scale, cy - 7.5*scale); 
    o.lineTo(cx + 5.25*scale, cy - 6.75*scale); 
    o.lineTo(cx + 8.25*scale, cy - 3*scale);
    o.lineTo(cx + 6*scale, cy + 3*scale); 
    o.lineTo(cx + 1.5*scale, cy + 6*scale); 
    o.lineTo(cx - 6*scale, cy + 4.5*scale);
    o.lineTo(cx - 8.25*scale, cy - 0.75*scale); 
    o.lineTo(cx - 6*scale, cy - 5.25*scale); 
    o.closePath();
    o.fill();

    // Syrup shading & highlight
    roundRect(cx - 3.75*scale, cy - 3*scale, 9*scale, 4.5*scale, 1.5*scale, COL.syrupD);
    roundRect(cx - 1.5*scale, cy - 5.25*scale, 4.5*scale, 2.25*scale, 0.75*scale, COL.syrupHL);

    // Butter pat
    o.save();
    o.translate(cx + 3.75*scale, cy - 1.5*scale);
    o.rotate(-0.15);
    rect(-2.25*scale, -2.25*scale, 5.25*scale, 5.25*scale, COL.butter);
    rect(-2.25*scale, 0.75*scale, 5.25*scale, 2.25*scale, COL.butterD);
    o.restore();

    // Rim light
    o.fillStyle = COL.rim;
    roundRect(hull.x - 1.5*scale, hull.y - 1.5*scale, hull.w - 4.5*scale, 1.5*scale, 1.5*scale, o.fillStyle);
    roundRect(hull.x - 1.5*scale, hull.y - 1.5*scale, 1.5*scale, hull.h - 4.5*scale, 1.5*scale, o.fillStyle);

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}

// Draw Waffle tank turret into a target canvas/context (pixel-accurate from Waffel.html)
function drawWaffleTurretInto(ctx, targetW, targetH, ts, angle){
  try{
    const now = ts || performance.now();
    // Original 64x64 resolution
    const N = 64;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }

    // Color palette from Waffel.html
    const COL = {
      waffleL: '#F4CC7A', waffle: '#E3AF52', waffleD: '#C88D35', waffleX: '#9F6B23',
      waffleEdgeD: '#7F531B', syrup: '#7B3A14', syrupD: '#5E2B0F', syrupL: '#9C4B1B',
      syrupHL: '#C76934', butter: '#FFF2AC', butterD: '#E5D07C', steelL: '#9AA0A8',
      steel: '#6F7781', steelD: '#3D4249', tread: '#1B1C1F', treadL: '#2A2C31',
      treadHL: '#3A3D45', shadow: 'rgba(0,0,0,0.25)', rim: 'rgba(255,255,255,0.06)',
      bolt: '#A18F64'
    };

    // Helper functions
    const rect = (x, y, w, h, c) => { o.fillStyle = c; o.fillRect(x|0, y|0, w|0, h|0); };
    const fillCircle = (cx, cy, r, c) => {
      o.fillStyle = c; o.beginPath(); o.arc(cx+0.5, cy+0.5, r, 0, Math.PI*2); o.closePath(); o.fill();
    };

    // Tank geometry - scaled down to 75% size
    const scale = 0.75;
    const cx = 32, cy = 32;

    // Save/rotate around center
    o.save();
    o.translate(cx, cy);
    const defaultAngle = angle !== undefined ? angle : 0;
    o.rotate(defaultAngle);
    o.translate(-cx, -cy);

    // Turret ring (steel)
    fillCircle(cx, cy, 6*scale, COL.steelD);
    fillCircle(cx, cy, 5.25*scale, COL.steel);

    // Rotate pitcher-style turret around center
    o.save();
    o.translate(cx, cy);
    o.rotate(0); // No additional rotation for static turret
    o.translate(-cx, -cy);

    // Base dome
    fillCircle(cx, cy, 4.5*scale, COL.steelL);

    // Spout/barrel (wide → narrow)
    o.fillStyle = COL.steel;
    o.beginPath();
    o.moveTo(cx + 1.5*scale, cy - 1.5*scale); 
    o.lineTo(cx + 8.25*scale, cy - 1.25*scale); 
    o.lineTo(cx + 10.5*scale, cy + 0*scale);
    o.lineTo(cx + 8.25*scale, cy + 1.25*scale); 
    o.lineTo(cx + 1.5*scale, cy + 1.5*scale); 
    o.closePath();
    o.fill();

    // Spout lip highlight
    rect(cx + 8.25*scale, cy - 1.25*scale, 1.5*scale, 0.75*scale, '#B8C0CA');

    // Top hatch highlight & rim
    rect(cx - 2.25*scale, cy - 3*scale, 4.5*scale, 0.75*scale, 'rgba(255,255,255,0.2)');
    rect(cx - 3*scale, cy + 2.25*scale, 6*scale, 0.75*scale, 'rgba(0,0,0,0.2)');

    o.restore();
    o.restore();

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N); const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawWaffleBodyInto = drawWaffleBodyInto; }catch(_){ }
try{ if (typeof window !== 'undefined') window.drawWaffleTurretInto = drawWaffleTurretInto; }catch(_){ }

// Draw Facebook tank body into a target canvas/context (pixel-accurate from facebook.html)
function drawFacebookBodyInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    // Keep original 64x64 resolution but scale down for smaller appearance
    const N = 64;
    const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    // Palette and helpers (ported from facebook.html)
    const P = { blue:'#1877F2', blueDark:'#0E5AAB', blueLite:'#7FB3FF', steelDark:'#2C3E50', steelMid:'#3C556B', steelLite:'#8EA1B2', night:'#12233A', white:'#FFFFFF' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const lineH = (x,y,w,c)=>px(x,y,w,1,c);
    const lineV = (x,y,h,c)=>px(x,y,1,h,c);

    function chunkyRect(x,y,w,h,fill,edge){
      px(x,y+1,1,h-2,edge);
      px(x+w-1,y+1,1,h-2,edge);
      px(x+1,y,w-2,1,edge);
      px(x+1,y+h-1,w-2,1,edge);
      px(x,y,2,1,edge); px(x,y,1,2,edge);
      px(x+w-2,y,2,1,edge); px(x+w-1,y,1,2,edge);
      px(x,y+h-1,1,2,edge); px(x,y+h-2,2,1,edge);
      px(x+w-2,y+h-1,2,1,edge); px(x+w-1,y+h-2,1,2,edge);
      px(x+1,y+1,w-2,h-2,fill);
    }

    const CX = 32, CY = 32;
    const bodyW = 36, bodyH = 24;
    const bodyX = CX - (bodyW>>1), bodyY = CY - (bodyH>>1);
    const treadW = 6;
    const treadTop = bodyY - 4;
    const treadBot = bodyY + bodyH + 4;
    // Move treads closer to the body (reduced gap from 8 to 4 pixels)
    const leftTreadX = bodyX - (treadW + 1);
    const rightTreadX = bodyX + bodyW + 1;

    function drawTracks(offset){
      chunkyRect(leftTreadX, treadTop, treadW, (treadBot - treadTop), P.steelMid, P.steelDark);
      chunkyRect(rightTreadX, treadTop, treadW, (treadBot - treadTop), P.steelMid, P.steelDark);

      // Create rolling animation by using time-based offset
      const treadHeight = treadBot - treadTop;
      const patternHeight = 8; // Match the offset range for smoother animation

      for (let y = treadTop + 2; y < treadBot - 2; y++){
        // Calculate rolling position based on time and vertical position
        const rollingPhase = ((y - treadTop + offset) % patternHeight) / patternHeight;
        const col = (rollingPhase < 0.5) ? P.steelDark : P.steelLite;
        lineH(leftTreadX+1, y, treadW-2, col);
        lineH(rightTreadX+1, y, treadW-2, col);
      }

      // Animate studs with rolling motion
      const numStuds = 5;
      const studSpacing = (treadBot - treadTop - 8) / (numStuds - 1);
      for (let i = 0; i < numStuds; i++) {
        const baseY = treadTop + 4 + (i * studSpacing);
        // Add rolling offset to stud position with consistent timing
        const rollingY = baseY + Math.sin((now * 0.008) + (i * 0.8)) * 1.5;
        if (rollingY >= treadTop + 2 && rollingY <= treadBot - 4) {
          px(leftTreadX + 2, Math.round(rollingY), 2, 2, P.steelDark);
          px(leftTreadX + 2, Math.round(rollingY), 1, 1, P.steelLite);
          px(rightTreadX + 2, Math.round(rollingY), 2, 2, P.steelDark);
          px(rightTreadX + 2, Math.round(rollingY), 1, 1, P.steelLite);
        }
      }
    }

    function drawBody(){
      chunkyRect(bodyX, bodyY+1, bodyW, bodyH, P.night, P.night);
      chunkyRect(bodyX, bodyY, bodyW, bodyH, P.blue, P.steelDark);
      px(bodyX+1, bodyY+1, 3, bodyH-2, P.blueDark);
      px(bodyX+1, bodyY+bodyH-4, bodyW-2, 3, P.blueDark);
      px(bodyX+2, bodyY+1, bodyW-4, 1, P.blueLite);
      px(bodyX+bodyW-3, bodyY+2, 1, bodyH-4, P.blueLite);
      for (let i = 0; i < 6; i++) {
        lineH(bodyX+5, bodyY+4 + i*3, bodyW-10, P.steelMid);
      }
      px(bodyX+3, bodyY+3, 1,1, P.steelLite);
      px(bodyX+bodyW-4, bodyY+3, 1,1, P.steelLite);
      px(bodyX+3, bodyY+bodyH-4, 1,1, P.steelLite);
      px(bodyX+bodyW-4, bodyY+bodyH-4, 1,1, P.steelLite);
    }

    // Removed blue background - now transparent
    // px(0, 0, 64, 64, '#0b1522');

    // Render tracks and body with enhanced rolling animation
    const treadOffset = Math.floor(now * 0.008) % 8; // Faster, smoother rolling
    drawTracks(treadOffset);
    drawBody();

    // draw into target with scaling to make it appear smaller
    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N) * 0.5; const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawFacebookBodyInto = drawFacebookBodyInto; }catch(_){ }

// Draw Facebook turret only (for rotating turret canvas)
function drawFacebookTurretInto(ctx, targetW, targetH, ts){
  try{
    const now = ts || performance.now();
    const N = 64; const tmp = document.createElement('canvas'); tmp.width = N; tmp.height = N; const o = tmp.getContext('2d'); try{ o.imageSmoothingEnabled = false; }catch(_){ }
    try{ o.clearRect(0,0,N,N); }catch(_){ }
    const P = { blue:'#1877F2', blueDark:'#0E5AAB', blueLite:'#7FB3FF', steelDark:'#2C3E50', steelMid:'#3C556B', steelLite:'#8EA1B2', night:'#12233A', white:'#FFFFFF' };
    const px = (x,y,w,h,c)=>{ o.fillStyle=c; o.fillRect(x|0,y|0,w|0,h|0); };
    const lineH = (x,y,w,c)=>px(x,y,w,1,c);
    const lineV = (x,y,h,c)=>px(x,y,1,h,c);

    function chunkyRect(x,y,w,h,fill,edge){
      px(x,y+1,1,h-2,edge);
      px(x+w-1,y+1,1,h-2,edge);
      px(x+1,y,w-2,1,edge);
      px(x+1,y+h-1,w-2,1,edge);
      px(x,y,2,1,edge); px(x,y,1,2,edge);
      px(x+w-2,y,2,1,edge); px(x+w-1,y,1,2,edge);
      px(x,y+h-1,1,2,edge); px(x,y+h-2,2,1,edge);
      px(x+w-2,y+h-1,2,1,edge); px(x+w-1,y+h-2,1,2,edge);
      px(x+1,y+1,w-2,h-2,fill);
    }

    function glyphF(gx,gy,color){
      lineH(gx+1, gy+0, 4, color);
      lineV(gx+2, gy+0, 7, color);
      lineH(gx+2, gy+3, 2, color);
    }

    const CX = 32, CY = 32;
    const barrelLen = 14;
    const barrelW = 3;

    function drawTurret(statusBlink){
      const tW = 18, tH = 14;
      const tx = CX - (tW>>1), ty = CY - (tH>>1);
      chunkyRect(tx, ty, tW, tH, P.blue, P.steelDark);
      px(tx+1, ty+1, 3, tH-2, P.blueDark);
      px(tx+2, ty+1, tW-4, 1, P.blueLite);
      const bx = CX - ((barrelW)>>1);
      const by = ty - 1;
      px(bx, by - barrelLen + 2, barrelW, barrelLen, P.steelDark);
      px(bx, by - barrelLen, barrelW, 2, P.steelLite);
      px(tx + tW - 4, ty + 3, 2, 2, P.steelLite);
      glyphF(CX - 3, CY - 3, P.white);
      const ledCol = statusBlink ? P.white : P.blueLite;
      px(tx + 2, ty + 2, 1, 1, ledCol);
    }

    // Render turret
    const statusBlink = (Math.floor(now/120) % 2) === 0;
    drawTurret(statusBlink);

    try{ if (ctx && ctx.drawImage){ try{ ctx.imageSmoothingEnabled = false; }catch(_){ } ctx.clearRect(0,0,targetW,targetH); const scale = Math.min(targetW / N, targetH / N) * 0.5; const dw = Math.round(N * scale); const dh = Math.round(N * scale); const dx = Math.floor((targetW - dw) / 2); const dy = Math.floor((targetH - dh) / 2); ctx.drawImage(tmp, 0,0,N,N, dx,dy,dw,dh); } }catch(_){ }
  }catch(_){ }
}
try{ if (typeof window !== 'undefined') window.drawFacebookTurretInto = drawFacebookTurretInto; }catch(_){ }

// Consolidated explicit exports (after real function definitions)
export {
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
};