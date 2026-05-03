// nuke.js — rare ring trigger + nuclear screen wipe
// Exported API:
// - initNuke(opts)
// - updateNuke(dt, now, ctx)
// - drawNuke(ctx, worldToScreen, camera)
// The ring appears rarely at a random world position. If the player stays within
// the ring for 2000ms continuously, it triggers the nuke animation and wipes all
// enemies and projectiles visible in the viewport at that moment.

const STATE = {
  ring: null,     // { x,y,r,thick,spawnAt,active, dwellMs, lastInside }
  nextAt: 0,      // next eligible spawn time
  anim: null      // { t:0..1, frame:0..N-1, done:boolean }
};

const MIN_SPAWN_GAP_MS = 90_000;     // very rare (~90s min)
const SPAWN_PROB_PER_SEC = 0.03;     // low probability per second when eligible
const DWELL_REQUIRED_MS = 2000;      // stand in ring 2s to trigger
const RING_RADIUS = 60;              // world units (smaller)
const RING_THICK = 6;

// Build nukeskull frames procedurally (port of nukeskull.html)
const NUKE = { W:64, H:64, FRAMES:15, FRAME_MS:120, canvases: null };

function _hexToRGBA(hex){
  const n = hex.replace('#','');
  const bigint = parseInt(n,16);
  const r = (n.length===3) ? ((bigint>>8)&0xF)*17 : (bigint>>16)&255;
  const g = (n.length===3) ? ((bigint>>4)&0xF)*17 : (bigint>>8)&255;
  const b = (n.length===3) ? ((bigint>>0)&0xF)*17 : (bigint>>0)&255;
  return [r,g,b,255];
}

function _prepNukeFrames(){
  if (NUKE.canvases) return NUKE.canvases;
  const PAL_HEX = ["#0d0f14","#1f232b","#3a3f4b","#7a3e00","#d16d00","#ffb800","#fff4a3","#8a7760"]; const PAL = PAL_HEX.map(_hexToRGBA);
  const W=NUKE.W,H=NUKE.H,FR=NUKE.FRAMES;
  function pset(img,x,y,ci){ if(x<0||y<0||x>=W||y>=H) return; const i=(y*W+x)*4; const c=PAL[ci]; img.data[i]=c[0]; img.data[i+1]=c[1]; img.data[i+2]=c[2]; img.data[i+3]=c[3]; }
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)); const lerp=(a,b,t)=>a+(b-a)*t; const easeOut=(t)=>1-Math.pow(1-t,2); const easeInOut=(t)=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;
  const inEllipse=(x,y,cx,cy,rx,ry)=>{ const dx=(x-cx)/rx,dy=(y-cy)/ry; return dx*dx+dy*dy<=1; };
  const inRing=(x,y,cx,cy,r,th)=>{ const dx=x-cx,dy=y-cy; const d=Math.sqrt(dx*dx+dy*dy); return d>=r-th && d<=r+th; };
  const hmask=(x,y,k=0)=> ((x*37 + y*101 + k*13) % 7) === 0;
  const canvases=[];
  for (let f=0; f<FR; f++){
    const off = document.createElement('canvas'); off.width=W; off.height=H; const ctx = off.getContext('2d',{alpha:true}); ctx.imageSmoothingEnabled=false; const im = ctx.createImageData(W,H);
    const t=f/(FR-1);
    // Transparent background: do not paint base or floor rows.
    const rise = easeInOut(Math.min(1, t/0.55));
    const spread = easeOut(Math.max(0, (t-0.25)/0.75));
    const thicken = easeOut(Math.max(0,(t-0.35)/0.65));
    const capCY = Math.round(48 - 18*rise);
    const capRX = 6 + Math.round(18*spread);
    const capRY = 4 + Math.round(9*spread);
    const stemTopY = Math.min(56, capCY + Math.max(0, Math.round(2 - 4*spread)));
    const stemBotY = 58;
    const stemTopW = 3 + Math.round(2*spread);
    const stemBotW = stemTopW + Math.round(4*thicken);
    for(let y=stemTopY; y<=stemBotY; y++){
      const k=(y-stemTopY)/Math.max(1,(stemBotY-stemTopY)); const halfW=Math.round(lerp(stemTopW,stemBotW,k));
      for(let x=32-halfW; x<=32+halfW; x++){ const edge=(x===32-halfW||x===32+halfW); pset(im,x,y, edge?3:4); }
    }
    for(let y=0;y<H;y++){
      for(let x=0;x<W;x++){
        const dx=(x-32)/capRX, dy=(y-capCY)/capRY; const d=Math.sqrt(dx*dx+dy*dy);
        if(!inEllipse(x,y,32,capCY,capRX,capRY)) continue;
        const rimZone=(d>0.85 && y<=capCY); const hotCore=(d<0.45);
        let base=4; if(rimZone) base=6; else if(hotCore) base=(d<0.28)?6:5;
        const u=dx,v=dy; if(v>-0.05 && v<0.45 && Math.abs(u)>0.55 && Math.abs(u)<0.9) base=3; // cheek
        const eyeY=-0.05, ex=0.20+0.02*spread, ey=0.18+0.03*spread;
        const inLeft = (((u+0.36)/ex)**2 + ((v-eyeY)/ey)**2) < 1.0;
        const inRight= (((u-0.36)/ex)**2 + ((v-eyeY)/ey)**2) < 1.0;
        const nose = (v>0 && v<0.45) && (Math.abs(u) < (0.10 + 0.15*v));
        let tooth=false, toothBright=false;
        if(v>0.33 && v<0.95){ const jawW=0.80-0.30*(v-0.33); if(Math.abs(u)<jawW){ const col=Math.floor(((u + jawW)/(2*jawW))*8); tooth=true; toothBright=(col%2)===0; } }
        let ci=base; if(inLeft||inRight) ci=3; else if(nose) ci=3; else if(tooth) ci=toothBright?6:3;
        if(v>0.20 && v<0.95 && hmask(x,y,f)){ if(ci===4) ci=7; else if(ci===5) ci=4; }
        pset(im,x,y,ci);
      }
    }
    const neckY = clamp(capCY + Math.round(capRY*0.95), 0, H-1);
    for(let x=32-capRX; x<=32+capRX; x++) if(x>=0 && x<W) pset(im,x,neckY,5);
  // Small glints near the base of the skull
  const rx=Math.round(10+10*spread), ry=3; for(let y=56; y<60; y++) for(let x=32-rx;x<=32+rx;x++){ if(inEllipse(x,y,32,58,rx,ry) && hmask(x,y,f+3)) pset(im,x,y,7); }
    const g=ctx; g.clearRect(0,0,W,H); g.putImageData(im,0,0);
    canvases.push(off);
  }
  NUKE.canvases = canvases; return canvases;
}

// Debug: enable fast spawning via URL param/hash or global flag
const DEBUG_FAST = (typeof window !== 'undefined') && (
  /[?&]nukeTest=1(?:&|$)/i.test(window.location.search) ||
  /nuketest/i.test(window.location.hash) ||
  (window.NUKE_DEBUG_FAST === true)
);
const FAST_MIN_SPAWN_GAP_MS = 3000;
const FAST_SPAWN_PROB_PER_SEC = 3.0; // ~5% chance per frame at 60fps when eligible
function getMinSpawnGap(){ return DEBUG_FAST ? FAST_MIN_SPAWN_GAP_MS : MIN_SPAWN_GAP_MS; }
function getSpawnProbPerSec(){ return DEBUG_FAST ? FAST_SPAWN_PROB_PER_SEC : SPAWN_PROB_PER_SEC; }

export function initNuke(){
  STATE.ring = null;
  STATE.nextAt = performance.now() + (DEBUG_FAST ? 500 : (60_000 + Math.random()*60_000));
  STATE.anim = null;
}

function _maybeSpawnRing(now, WORLD_W, WORLD_H){
  if (STATE.ring || now < STATE.nextAt) return;
  // roll once per second equivalent; dt caller passes us dt, but we keep it simple
  // spawn with a small per-frame probability (assuming ~60fps)
  const perFrame = getSpawnProbPerSec() / 60;
  if (Math.random() >= perFrame) return; // approximate chance per frame
  const x = Math.random() * WORLD_W;
  const y = Math.random() * WORLD_H;
  STATE.ring = { x, y, r:RING_RADIUS, thick:RING_THICK, spawnAt: now, active:true, dwellMs:0 };
}

function _playerInsideRing(tank){
  if (!STATE.ring || !tank) return false;
  const dx = tank.x - STATE.ring.x; const dy = tank.y - STATE.ring.y; const d = Math.hypot(dx,dy);
  // Anywhere inside the ring
  return d <= STATE.ring.r;
}

export function updateNuke(dt, now, ctx){
  const { WORLD_W, WORLD_H, tank, camera, getViewportWorldRect, wipeVisible } = ctx;
  if (!STATE.anim){ _maybeSpawnRing(now, WORLD_W, WORLD_H); }
  if (STATE.anim){
    const total = NUKE.FRAMES * NUKE.FRAME_MS; // ms
    // dt is in seconds; convert to ms for normalized progress
    STATE.anim.t = Math.min(1, (STATE.anim.t || 0) + (dt * 1000) / total);
    // when animation starts, perform the wipe once (based on visible rect at trigger)
    if (!STATE.anim._didWipe){ try{ wipeVisible(); }catch(_){ } STATE.anim._didWipe = true; }
    if (STATE.anim.t >= 1) { STATE.anim.done = true; STATE.anim = null; }
    return;
  }
  if (STATE.ring && STATE.ring.active){
    // dt is seconds; accumulate dwell time in ms with robust inside check
    const inside = _playerInsideRing(tank);
    if (inside) {
      STATE.ring.dwellMs += dt * 1000;
      STATE.ring.lastInside = now;
    } else {
      STATE.ring.dwellMs = 0;
    }
    if (STATE.ring.dwellMs >= DWELL_REQUIRED_MS){
      // trigger nuke
      _prepNukeFrames();
      STATE.anim = { t:0, frame:0, done:false, x: STATE.ring.x, y: STATE.ring.y };
      STATE.ring.active = false; STATE.ring = null; STATE.nextAt = now + getMinSpawnGap();
    }
  }
}

export function drawNuke(ctx, worldToScreen, camera){
  // draw ring (world space)
  if (STATE.ring && STATE.ring.active){
    const { x,y,r,thick,dwellMs } = STATE.ring;
    const s = worldToScreen(x,y); const scale = camera.zoom;
    ctx.save();
    ctx.translate(s.x,s.y);
    ctx.scale(scale, scale);
  ctx.lineWidth = 2;
  ctx.strokeStyle = '#000000';
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,r-thick,0,Math.PI*2); ctx.stroke();
  ctx.beginPath(); ctx.arc(0,0,r+thick,0,Math.PI*2); ctx.stroke();
    // Draw a simple countdown when inside the ring
    const remain = Math.max(0, Math.ceil((DWELL_REQUIRED_MS - (dwellMs||0)) / 100) / 10); // 0.1s precision
    if (dwellMs > 0 && remain > 0){
      ctx.fillStyle = 'rgba(255,230,120,0.95)';
      ctx.strokeStyle = 'rgba(20,10,0,0.9)';
      ctx.lineWidth = 1;
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = remain.toFixed(1);
      ctx.strokeText(label, 0, -r - 14);
      ctx.fillText(label, 0, -r - 14);
    }
    ctx.restore();
  }
  // draw nuke animation overlay centered on screen (screen space, not world)
  if (STATE.anim){ const frames = _prepNukeFrames(); const idx = Math.min(frames.length-1, Math.floor(STATE.anim.t * frames.length)); const img = frames[idx]; const W=img.width,H=img.height; const viewW = Math.min(512, Math.max(256, Math.round(256*camera.zoom))); const viewH = viewW; const x = (ctx.canvas.width - viewW)/2; const y = (ctx.canvas.height - viewH)/2; ctx.save(); ctx.imageSmoothingEnabled=false; ctx.globalCompositeOperation = 'source-over'; ctx.drawImage(img, 0,0,W,H, x,y, viewW, viewH); ctx.restore(); }
}

// Helper to compute viewport rect in world coords (accounting for wrap on Y)
export function getViewportWorldRect(camera, W, H, WORLD_H){
  const halfW = W/(2*camera.zoom); const halfH = H/(2*camera.zoom);
  const left = camera.x - halfW; const right = camera.x + halfW; const top = camera.y - halfH; const bottom = camera.y + halfH;
  return { left, right, top, bottom };
}

// Debug-only: force spawn a ring at given world coords
export function debugSpawnRing(x, y, opts={}){
  const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  const r = (opts && opts.r) || RING_RADIUS;
  const thick = (opts && opts.thick) || RING_THICK;
  // If animation is currently playing, ignore; otherwise place/replace ring
  if (STATE.anim) return false;
  STATE.ring = { x, y, r, thick, spawnAt: now, active: true, dwellMs: 0 };
  STATE.nextAt = now; // allow immediate respawn after this if removed
  return true;
}

try{ if (typeof window !== 'undefined'){ window.nukeDebugSpawn = (x,y,opts)=>debugSpawnRing(x,y,opts); } }catch(_){ }
