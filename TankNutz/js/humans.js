// humans module - contains human character tile makers (including fatsammich)
export const JUNGLE_KINDS = ['commando','scout','heavy','medic','villager1','villager2','guide','radioop','fatsammich','squidrobot','kraken','pinkdot'];

export const idleMakers = {}; export const runMakers = {};

// makeFatsammichIdle: creates a tile painter function (t, lookA) that renders the fatsammich sprite
export function makeFatsammichIdle(g, ASSETS){
  return (t, lookA)=>{
    const W = g.canvas.width || 48;
    const H = g.canvas.height || 48;
    g.clearRect(0,0,W,H); // respect host canvas size (CHAR_TILE_PX in game.js)
    // If exact asset available, draw it (host passes ASSETS object)
    if (ASSETS && ASSETS.fatsammich){
      const img = ASSETS.fatsammich;
      // Support multi-frame horizontal spritesheets where each frame is square (height x height)
      const frameSize = img.height || 48;
      const frameCount = Math.max(1, Math.floor(img.width / frameSize));
      const phase = (t || performance.now());
      // match original HTML: ~120ms per frame for a chew cycle
      const frameMs = 120;
      const frameIdx = Math.floor(phase / frameMs) % frameCount;
      const srcX = frameIdx * frameSize;
      const srcW = frameSize, srcH = frameSize;
      const scale = Math.floor((W * 0.88) / srcW) || 1;
      const dw = srcW * scale, dh = srcH * scale;
      const dx = Math.round((W - dw)/2);
      const dy = Math.round((H - dh)/2 + Math.round((W/48) * 4));
      const bob = Math.round(Math.sin(phase * 0.004) * 2 * (W/48));
      g.imageSmoothingEnabled = false;
      try{
        g.drawImage(img, srcX, 0, srcW, srcH, dx, dy + bob, dw, dh);
      }catch(e){
        // fallback to drawing whole image if sub-rect draw fails
        try{ g.drawImage(img, 0,0, img.width, img.height, dx, dy + bob, dw * frameCount, dh); }catch(_){ }
      }
      // mouth open/close overlay and subtle arm highlight on top of the baked frames
      try{
        const mouthOpen = (Math.floor(phase / 180) % 2) === 0;
        const mouthW = Math.max(2, Math.round(dw * 0.18));
        const mouthH = mouthOpen ? Math.max(1, Math.round(dh * 0.08)) : 1;
        const mx = Math.round(dx + dw * 0.58);
        const my = Math.round(dy + dh * 0.46 + bob);
        g.fillStyle = mouthOpen ? '#4a120f' : '#2a0f0d';
        g.fillRect(mx, my, mouthW, mouthH);
        const armShift = Math.round(Math.sin(phase * 0.006) * (dw * 0.03));
        g.fillStyle = 'rgba(255,240,220,0.06)';
        g.fillRect(Math.round(dx + dw*0.2 + armShift), Math.round(dy + dh*0.5 + bob), Math.max(1, Math.round(dw*0.18)), Math.max(1, Math.round(dh*0.12)));
      }catch(e){}
      return;
    }
    // fallback baked 48x48 pixel sprite (reproduce original single-frame pose)
    if (!makeFatsammichIdle._cachedFrames){
      // Build a small set of baked frames (walk cycle) instead of one static sprite.
      // Also remove the brown/crust contrast by making CR the same as BR so the border is not visible.
      makeFatsammichIdle._cachedFrames = [];
      const P = { OUT:'#0b0b10', SK1:'#f1c27d', SK2:'#e0a072', SH1:'#3b82f6', SH2:'#1f5fd1', RL:'#dbeafe', PN1:'#374151', PN2:'#1f2937', SHOE:'#222327', HAIR:'#2e2a2a', BR:'#e5c07b', CR:'#e5c07b', LET:'#2fa866', MEAT:'#b34d4d', MOU:'#161317' };
      function buildFrame(frameIndex=0){
        const spr = document.createElement('canvas'); spr.width = 48; spr.height = 48; const s = spr.getContext('2d'); s.imageSmoothingEnabled = false;
        function pxLocal(x,y,w=1,h=1,col){ s.fillStyle=col; s.fillRect(x|0,y|0,w|0,h|0); }
        function blockLocal(x,y,w,h,fill,outline=P.OUT){ pxLocal(x+1, y+1, w-2, h-2, fill); /* intentionally skip outline to avoid border */ }
        // transparent background
        s.clearRect(0,0,48,48);
        // animation params (match fatsammich.html)
        const chew = frameIndex % 6;
        const bobY = (chew===1||chew===2)? -1 : (chew===4? 1 : 0);
        const mouthOpen = (chew===1 || chew===4) ? 2 : (chew===2 ? 3 : 1);
        const armIn = (chew===1||chew===2) ? 2 : (chew===3?1:0);
        const handLift = (chew===1||chew===2) ? -1 : 0;
        // body / pants
        blockLocal(14,34 + bobY,20,10, P.PN1); pxLocal(14,39 + bobY,20,1, P.PN2); pxLocal(23,34 + bobY,2,10, P.PN2);
        // shoes (static)
        blockLocal(12,42,10,4, P.SHOE); blockLocal(26,42,10,4, P.SHOE);
        // jacket / torso
        blockLocal(8,18 + bobY,32,18, P.SH1); blockLocal(6,22 + bobY,4,12, P.SH1); blockLocal(38,22 + bobY,4,12, P.SH1); blockLocal(10,14 + bobY,28,8, P.SH1);
        pxLocal(34,15 + bobY,3,15, P.SH2); pxLocal(35,26 + bobY,3,8, P.SH2); pxLocal(9,16 + bobY,1,18, P.RL);
        // head
        blockLocal(17,6 + bobY,14,8, P.HAIR); blockLocal(18,8 + bobY,12,9, P.SK1); pxLocal(27,10 + bobY,2,4, P.SK2); pxLocal(24,11 + bobY,1,1, P.OUT); blockLocal(22,14 + bobY,6,mouthOpen, P.MOU);
        blockLocal(21,16 + bobY,8,3, P.SK2);
        // arms (armShift influences highlight)
        blockLocal(9,18 + bobY,6,5, P.SK1); blockLocal(8,22 + bobY,7,5, P.SK1); pxLocal(8,22 + bobY,2,1, P.SK2);
        blockLocal(33,18 + bobY,6,5, P.SK1); blockLocal(34,22 + handLift,6,4, P.SK1); blockLocal(31,23 + handLift,5,4, P.SK1);
        blockLocal(29 + armIn,22 + handLift,4,4, P.SK1);
        // sandwich (bread, crust/border set equal to remove brown outline), meat, lettuce
        blockLocal(28 + armIn,19 + bobY + handLift,8,4, P.BR); pxLocal(29 + armIn,20 + bobY + handLift,6,1, P.MEAT); pxLocal(29 + armIn,21 + bobY + handLift,6,1, P.LET);
        // small highlights/shadows
        pxLocal(20,16 + bobY,8,1, P.SH2); pxLocal(19,17 + bobY,10,1, P.SH2); pxLocal(12,24 + bobY,8,1, '#a9c8ff'); pxLocal(28,24 + bobY,6,1, '#a0c1ff');
        // subtle arm highlight
        const armShift = Math.round(Math.sin(frameIndex * 0.6) * 2);
        pxLocal(Math.round(8 + armShift), Math.round(22 + bobY), Math.max(1, Math.round(12 - Math.abs(armShift))), 1, 'rgba(255,240,220,0.06)');
        return spr;
      }
      // create 6 frames to match the original HTML chew cycle
      for (let fi=0; fi<6; fi++) makeFatsammichIdle._cachedFrames.push(buildFrame(fi));
    }
  const bakedFrames = makeFatsammichIdle._cachedFrames;
  if (bakedFrames && bakedFrames.length){
    const phase = (t || performance.now());
    const frameIdx = Math.floor( (phase / 150) ) % bakedFrames.length; // ~150ms per frame
    const baked = bakedFrames[Math.max(0, frameIdx)];
    if (baked){
      const srcW = baked.width, srcH = baked.height; const scaleOut = Math.floor((W * 0.88) / srcW); const dw = srcW * scaleOut, dh = srcH * scaleOut; const dx = Math.round((W - dw)/2); const dy = Math.round((H - dh)/2 + Math.round((W/48) * 4)); g.imageSmoothingEnabled = false; const bob = Math.round(Math.sin(phase * 0.004) * 2 * (W/48)); g.drawImage(baked, 0,0, srcW, srcH, dx, dy + bob, dw, dh);
      try{
        const mouthOpen = (Math.floor(phase / 180) % 2) === 0;
        const mouthW = Math.max(2, Math.round(dw * 0.18));
        const mouthH = mouthOpen ? Math.max(1, Math.round(dh * 0.08)) : 1;
        const mx = Math.round(dx + dw * 0.58);
        const my = Math.round(dy + dh * 0.46 + bob);
        g.fillStyle = mouthOpen ? '#4a120f' : '#2a0f0d';
        g.fillRect(mx, my, mouthW, mouthH);
        // soft arm highlight (keeps subtle motion)
        const armShift = Math.round(Math.sin(phase * 0.006) * (dw * 0.03));
        g.fillStyle = 'rgba(255,240,220,0.06)';
        g.fillRect(Math.round(dx + dw*0.2 + armShift), Math.round(dy + dh*0.5 + bob), Math.max(1, Math.round(dw*0.18)), Math.max(1, Math.round(dh*0.12)));
      }catch(e){}
    }
  }
  };
}
export function makeFatsammichRun(g, ASSETS){
  // Return a run-maker that selects frames from the baked frames at a faster rate
  const idlePainter = makeFatsammichIdle(g, ASSETS);
  return (t, lookA) => {
    // if frames exist, we accelerate the perceived phase by offsetting time when calling idle
    const phase = (t || performance.now());
    // multiply phase so frames cycle ~3x faster than idle
    const runPhase = phase * 1.8;
    try{ idlePainter(runPhase, lookA); }catch(e){ idlePainter(t, lookA); }
  };
}

// register in makers map so host can consume them (game.js will import these maps)
idleMakers.fatsammich = makeFatsammichIdle;
runMakers.fatsammich = makeFatsammichRun;

// simple placeholder "pink dot" maker: pulsing/popping pink circle used as a temporary enemy tile
export function makePinkDotIdle(g, ASSETS){
  return (t, lookA) => {
    const W = g.canvas.width || 48;
    const H = g.canvas.height || 48;
    g.clearRect(0,0,W,H);
    // If the kitten tile painter is available, delegate to it to render the sprite
    try{
      if (typeof globalThis !== 'undefined' && typeof globalThis.drawKittenTile === 'function'){
        // drawKittenTile expects a 2D context and optional time
        try{ globalThis.drawKittenTile(g, t || performance.now()); return; }catch(_){ /* fallback to pink dot */ }
      }
    }catch(_){ }
    const phase = (t || performance.now());
    // subtle up/down bob and pulse
    const bob = Math.sin(phase * 0.005) * (W * 0.04);
    const pulse = 1 + Math.sin(phase * 0.01) * 0.08;
    const cx = W/2;
    const cy = H/2 + bob;
    const baseR = Math.max(4, Math.min(W,H) * 0.18);
    const r = baseR * pulse;
    // outer glow
    try{
      g.save();
      g.shadowBlur = 12; g.shadowColor = 'rgba(255,90,180,0.6)';
      g.fillStyle = '#ff66cc';
      g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.fill();
      g.restore();
    }catch(e){
      g.fillStyle = '#ff66cc'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI*2); g.fill();
    }
    // inner darker core
    g.fillStyle = '#ff2fa0'; g.beginPath(); g.arc(cx, cy, Math.max(1, r*0.45), 0, Math.PI*2); g.fill();
  };
}
export function makePinkDotRun(g, ASSETS){
  const idle = makePinkDotIdle(g, ASSETS);
  return (t, lookA) => {
    const phase = (t || performance.now()) * 1.8; // speed up animation for running
    try{ idle(phase, lookA); }catch(e){ idle(t, lookA); }
  };
}

// register pinkdot makers so game.js can spawn this kind and it will behave like other jungle NPCs
idleMakers.pinkdot = makePinkDotIdle;
runMakers.pinkdot = makePinkDotRun;

export function initHumansAssets(ASSETS){
  // placeholder: some makers may use ASSETS at runtime; keep for symmetry
  // currently makeFatsammichIdle reads ASSETS.fatsammich when invoked
  return ASSETS;
}
