// Placeholder helicopter enemy module
// Exports spawnHelicopter(x,y,opts,enemies)
import * as SFX from '../Sounds/sounds.js';

export function spawnHelicopter(x, y, opts = {}, enemies = (typeof window !== 'undefined' && window.enemies) ? window.enemies : []){
    // Create a shared offscreen sprite canvas that renders the Blackhawk 6-frame animation
    // Cache on the function so multiple helicopters reuse the same sprite frames
    if (!spawnHelicopter._sprC){
        const W = 128, H = 128;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { alpha: true });
        g.imageSmoothingEnabled = false;

        // Palette (copied from blackhawk.html)
        const PALETTE = {
          bg:    "#0c0f13",
          out:   "#0a0b0d",
          outHi: "#151a1f",
          jet0:  "#0f1216",
          jet1:  "#151a1c",
          jet2:  "#1b232b",
          jet3:  "#2b3744",
          rim:   "#6cb3ff",
          warn:  "#ffd166",
          glass: "#7aa3c8"
        };

        function px(x,y,col){ if (x<0||y<0||x>=W||y>=H) return; g.fillStyle = col; g.fillRect(x|0,y|0,1,1); }
        function ditherRect(x,y,w,h,cA,cB,bias=0){ for (let j=0;j<h;j++){ for (let i=0;i<w;i++){ const mask = ((i+j+bias)&1)===0; px(x+i,y+j, mask?cA:cB); } } }
        function fillEllipse(cx,cy,rx,ry,col){ for (let y=-ry;y<=ry;y++){ const nx = Math.floor(rx*Math.sqrt(Math.max(0,1-(y*y)/(ry*ry)))); for (let x=-nx;x<=nx;x++){ px(cx+x, cy+y, col); } } }
        function strokeEllipse(cx,cy,rx,ry,col){ for (let y=-ry;y<=ry;y++){ const nx = Math.floor(rx*Math.sqrt(Math.max(0,1-(y*y)/(ry*ry)))); px(cx-nx, cy+y, col); px(cx+nx, cy+y, col); } for (let x=-rx;x<=rx;x++){ const ny = Math.floor(ry*Math.sqrt(Math.max(0,1-(x*x)/(rx*rx)))); px(cx+x, cy-ny, col); px(cx+x, cy+ny, col); } }
        function line(x0,y0,x1,y1,col){ x0|=0;y0|=0;x1|=0;y1|=0; let dx=Math.abs(x1-x0), sx = x0<x1?1:-1; let dy = -Math.abs(y1-y0), sy = y0<y1?1:-1; let err = dx+dy; while(true){ px(x0,y0,col); if (x0===x1 && y0===y1) break; const e2 = 2*err; if (e2 >= dy){ err += dy; x0 += sx; } if (e2 <= dx){ err += dx; y0 += sy; } } }
        function fillPoly(points,col){ let minY=Infinity,maxY=-Infinity; for (const p of points){ if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; } minY = Math.floor(minY); maxY = Math.ceil(maxY); for (let y=minY;y<=maxY;y++){ let xs=[]; for (let i=0;i<points.length;i++){ const a=points[i], b=points[(i+1)%points.length]; if ((a.y<=y && b.y>y) || (b.y<=y && a.y>y)){ const t = (y - a.y)/(b.y - a.y); xs.push(a.x + t*(b.x - a.x)); } } xs.sort((m,n)=>m-n); for (let i=0;i<xs.length;i+=2){ const x0=Math.floor(xs[i]), x1=Math.ceil(xs[i+1]); for (let x=x0;x<=x1;x++) px(x,y,col); } } }

        const CENTER = { x: W>>1, y: H>>1 };

        // Drawing functions (adapted from blackhawk.html). We'll pre-render the six frames vertically
  const FRAME_COUNT = 6; const FRAME_MS = 40; const bobSeq = [0,1,2,1,0,-1];
        const frames = [];
        let rotorAngle = 0, tailAngle = 0;

        function drawFrameTo(ctxg, frameIdx){
          const t = frameIdx; const bob = bobSeq[t];
          // clear to transparent (no black background)
          ctxg.clearRect(0,0,W,H);

          // Tail
          (function drawTail(){ const cx = CENTER.x, cy = CENTER.y + bob; const y = cy; const boom = [ {x:cx,y:y+2}, {x:cx,y:y-2}, {x:cx-48,y:y-1}, {x:cx-48,y:y+1} ]; fillPoly(boom, PALETTE.jet2); line(cx,y+2,cx-48,y+1,PALETTE.outHi); line(cx,y-2,cx-48,y-1,PALETTE.outHi); const fin = [{x:cx-36,y:y-6},{x:cx-28,y:y-2},{x:cx-36,y:y-2}]; fillPoly(fin, PALETTE.jet3); for (let i=0;i<fin.length;i++){ const a=fin[i], b=fin[(i+1)%fin.length]; line(a.x,a.y,b.x,b.y,PALETTE.outHi);} for (const s of [-1,1]){ const stab=[{x:cx-26,y:y+s*2},{x:cx-34,y:y+s*6},{x:cx-40,y:y+s*6},{x:cx-32,y:y+s*2}]; fillPoly(stab,PALETTE.jet2); for (let i=0;i<stab.length;i++){ const a=stab[i], b=stab[(i+1)%stab.length]; line(a.x,a.y,b.x,b.y,PALETTE.outHi);} } } )();

          // Fuselage
          (function drawFuselage(){ const cx=CENTER.x, cy=CENTER.y + bob; const rx=22, ry=30; fillEllipse(cx,cy,rx,ry,PALETTE.jet2); ditherRect(cx-rx, cy-ry, rx*2, Math.floor(ry*0.6), PALETTE.jet1, PALETTE.jet2, 1); fillEllipse(cx, cy-ry+10, 8,6, PALETTE.jet1); strokeEllipse(cx,cy,rx,ry,PALETTE.outHi); strokeEllipse(cx,cy,rx+1,ry+1,PALETTE.out); fillEllipse(cx,cy-6,12,8,PALETTE.glass); ditherRect(cx-12, cy-14, 24,4, PALETTE.glass, PALETTE.jet3, 0); strokeEllipse(cx,cy-6,12,8,PALETTE.outHi); for (let y=-ry+4;y<=ry-6;y+=2) px(cx+Math.floor(rx*0.9), cy+y, PALETTE.rim); for (const s of [-1,1]){ fillEllipse(cx + s*16, cy-2, 7,5, PALETTE.jet3); strokeEllipse(cx + s*16, cy-2, 7,5, PALETTE.outHi); ditherRect(cx + s*10, cy-6, 6,3, PALETTE.jet1, PALETTE.jet2, s===-1?0:1); } const skidY = cy + ry - 6; for (const s of [-1,1]){ line(cx + s*8, cy + 8, cx + s*16, skidY-2, PALETTE.outHi); line(cx + s*16 - 8, skidY, cx + s*16 + 8, skidY, PALETTE.out); line(cx + s*16 - 8, skidY-1, cx + s*16 + 8, skidY-1, PALETTE.jet3); } })();

          // Stub wings
          (function drawStubWings(){ const cx=CENTER.x, cy=CENTER.y + bob; const wingY = cy + 2; for (const s of [-1,1]){ const wing=[{x:cx+s*8,y:wingY-4},{x:cx+s*26,y:wingY-2},{x:cx+s*26,y:wingY+2},{x:cx+s*8,y:wingY+4}]; fillPoly(wing,PALETTE.jet2); for (let i=0;i<wing.length;i++){ const a=wing[i], b=wing[(i+1)%wing.length]; line(a.x,a.y,b.x,b.y,PALETTE.outHi);} ditherRect(Math.min(cx+s*8, cx+s*26), wingY+3, Math.abs(18), 3, PALETTE.jet1, PALETTE.jet2,0); const podX = cx + s*28, podY = wingY; fillEllipse(podX,podY,6,4,PALETTE.jet3); strokeEllipse(podX,podY,6,4,PALETTE.outHi); ditherRect(podX - (s>0?0:3), podY - 1, 3, 2, PALETTE.warn, PALETTE.jet3, 1); } })();

          // Main rotor - draw simplified blades (use frame index to imply rotation blur)
          (function drawMainRotor(){ const cx=CENTER.x, cy=CENTER.y + bob; const hubR=3; fillEllipse(cx,cy,hubR,hubR,PALETTE.jet3); strokeEllipse(cx,cy,hubR,hubR,PALETTE.outHi); const bladeLen=46, bladeHalf=3; const bladeCols=[PALETTE.jet3, PALETTE.jet2, PALETTE.jet1]; const baseAngle = (frameIdx * (Math.PI/3)); for (let layer=0; layer<bladeCols.length; layer++){ const a = baseAngle - layer*0.10; for (let i=0;i<4;i++){ const dir = a + i*(Math.PI/2); const dx=Math.cos(dir), dy=Math.sin(dir); const pxv=-dy, pyv=dx; const tipX = cx + dx*bladeLen; const tipY = cy + dy*bladeLen; const rootX = cx + dx*(hubR+1); const rootY = cy + dy*(hubR+1); const poly=[{x:rootX+pxv*bladeHalf,y:rootY+pyv*bladeHalf},{x:tipX+pxv*1,y:tipY+pyv*1},{x:tipX-pxv*1,y:tipY-pyv*1},{x:rootX-pxv*bladeHalf,y:rootY-pyv*bladeHalf}]; fillPoly(poly, bladeCols[layer]); line(tipX+pxv*1, tipY+pyv*1, tipX-pxv*1, tipY-pyv*1, PALETTE.rim); } } })();

          // Tail rotor
          (function drawTailRotor(){ const hubX = CENTER.x - 48, hubY = CENTER.y + bob; fillEllipse(hubX, hubY, 2,2, PALETTE.jet3); strokeEllipse(hubX, hubY, 2,2, PALETTE.outHi); const len = 10; const baseAngle = (frameIdx * (Math.PI/3)); for (let i=0;i<4;i++){ const a = baseAngle + i*(Math.PI/2); const x2 = hubX + Math.cos(a)*len; const y2 = hubY + Math.sin(a)*len; line(hubX,hubY,x2,y2,PALETTE.jet3); } strokeEllipse(hubX, hubY, len, len, PALETTE.rim); })();

          // Nose turret
          (function drawNose(){ const cx=CENTER.x, cy=CENTER.y + bob; const y = cy + 16; fillEllipse(cx, y, 5,3, PALETTE.jet1); strokeEllipse(cx,y,5,3,PALETTE.outHi); line(cx-2,y+4,cx-2,y+8,PALETTE.out); line(cx+2,y+4,cx+2,y+8,PALETTE.out); })();

          // Decals
          (function drawDecals(){ const cx=CENTER.x, cy=CENTER.y + bob; for (let i=0;i<4;i++){ px(cx+28, cy -3 + i, (i%2===0)?PALETTE.warn:PALETTE.jet3); } for (let i=0;i<4;i++){ px(cx-28, cy -3 + i, (i%2===0)?PALETTE.warn:PALETTE.jet3); } })();
        }

        // Pre-render all frames into an array of canvases
        for (let f=0; f<FRAME_COUNT; f++){
          const fc = document.createElement('canvas'); fc.width = W; fc.height = H; const fg = fc.getContext('2d', { alpha: true }); fg.imageSmoothingEnabled = false;
          drawFrameTo(g, f);
          // copy from master canvas to frame canvas (preserve alpha)
          fg.clearRect(0,0,W,H);
          fg.drawImage(c,0,0);
          frames.push(fc);
        }

        spawnHelicopter._sprC = { frames, FRAME_COUNT, FRAME_MS, W, H };
    }

    const SPR = spawnHelicopter._sprC;

    const ent = {
        x: x || 0,
        y: y || 0,
        dx: 0,
        dy: 0,
    // engine expects some movement fields; provide safe defaults
    spd: 0,
    angle: Math.PI * -0.5, // point upward (negative Y)
    vx: 0,
    vy: 0,
        type: 'enemy',
        kind: 'helicopter',
        hp: opts.hp || 3,
        hitR: opts.hitR || 18,
        label: 'helicopter',
        _spawnTime: (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(),
    // northward speed in pixels per second (negative y moves north)
    spdY: (opts.spdY != null) ? opts.spdY : -40,
    // sound management
    _soundStarted: false,
    _lastVolume: 0,
    update(dt){
      // dt provided by main loop is in seconds (not ms)
      this._t = (this._t || 0) + ((dt != null) ? dt : 0.016);
      // bob in-place
      this.y += Math.sin(this._t * (1/6.5625)) * 0.3; // 0.016 * 420 ≈ 6.72 adjust to seconds
      this.x += Math.cos(this._t * (1/87.5)) * 0.1;   // 0.016 * 1400 ≈ 22.4 adjust to seconds
      // constant northward motion (pixels per second)
      const seconds = (dt != null) ? dt : 0.016;
      this.y += this.spdY * seconds;
      // Timed flyby auto-expire (opening sweep) regardless of wrap position
      try{
        if (this._flybyExpireAt && (performance.now ? performance.now() : Date.now()) > this._flybyExpireAt){
          if (typeof window !== 'undefined' && Array.isArray(window.enemies)){
            const idx = window.enemies.indexOf(this); if (idx >= 0) window.enemies.splice(idx,1);
          }
          return;
        }
      }catch(_){ }
      // ephemeral effect: auto-remove when fully above current camera view
      try{
        if (this.ephemeral && typeof window !== 'undefined' && Array.isArray(window.enemies)){
          // Access camera & world constants if available
          const cam = (window.__game_modules && window.__game_modules.input && window.__game_modules.input.camera) || (window.camera) || null;
          const WORLD_H = (typeof window.WORLD_H === 'number') ? window.WORLD_H : 3000;
          const H = (typeof window.H === 'number') ? window.H : 2400;
          const zoom = cam && cam.zoom ? cam.zoom : 1;
          if (cam){
            // Compute top visible world Y (approx) = camera.y - (H/2)/zoom
            const topVis = cam.y - (H/2)/zoom;
            // Normalize difference considering wrap (treat world vertically looping)
            let dy = this.y - topVis;
            if (dy > WORLD_H/2) dy -= WORLD_H; else if (dy < -WORLD_H/2) dy += WORLD_H;
            // If helicopter is above top by a margin (scaled by its sprite height ~64 * 0.5) remove it
            if (dy < -40){
              const idx = window.enemies.indexOf(this);
              if (idx >= 0) window.enemies.splice(idx,1);
              return; // removed
            }
          } else {
            // Fallback: legacy absolute Y threshold
            if (this.y < -120){ const idx = window.enemies.indexOf(this); if (idx >= 0) window.enemies.splice(idx,1); }
          }
        }
      }catch(_){ }

      // Helicopter sound management
      try{
        // Start sound if not already started
        if (!this._soundStarted){
          SFX.playHelicopter(0.3);
          this._soundStarted = true;
        }

        // Calculate distance from player for volume attenuation
        const player = (typeof window !== 'undefined' && window.tank) ? window.tank : null;
        if (player && player.x !== undefined && player.y !== undefined){
          const dx = this.x - player.x;
          const dy = this.y - player.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          // Volume falls off with distance: max volume at 200px, silent at 1000px+
          const maxDist = 1000;
          const minDist = 200;
          let volume = 0.5; // base volume (increased from 0.3)

          if (distance > minDist){
            if (distance >= maxDist){
              volume = 0;
            } else {
              // Linear falloff from minDist to maxDist
              volume = 0.5 * (1 - (distance - minDist) / (maxDist - minDist));
            }
          }

          // Only update if volume changed significantly to avoid excessive calls
          if (Math.abs(volume - this._lastVolume) > 0.01){
            SFX.setHelicopterVolume(Math.max(0, volume));
            this._lastVolume = volume;
          }
        }
      }catch(e){ console.warn('Helicopter sound update failed', e); }
    },
        draw(ctx, worldToScreen, camera){
            try{
                const now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
                const elapsed = now - (this._spawnTime || now);
                const fi = Math.floor(elapsed / SPR.FRAME_MS) % SPR.FRAME_COUNT;
                const img = SPR.frames[fi];
                const s = (camera && camera.zoom) || 1;
                const ws = worldToScreen(this.x, this.y);
                const sx = Math.round(ws.x), sy = Math.round(ws.y);
                const drawW = Math.round(SPR.W * 0.5 * s); // scale to match other entities
                const drawH = Math.round(SPR.H * 0.5 * s);
                ctx.save();
                // rotate -90 degrees (clockwise negative) around center
                ctx.translate(sx, sy);
                ctx.rotate(-Math.PI/2);
                // after rotation, draw with width/height swapped
                ctx.drawImage(img, -drawH/2, -drawW/2, drawH, drawW);
                ctx.restore();
            }catch(_){ }
        }
    };
    try{ enemies.push(ent); }catch(_){ }
    try{ if (typeof globalThis !== 'undefined') globalThis.spawnHelicopter = spawnHelicopter; }catch(_){ }
    return ent;
}

export default { spawnHelicopter };
