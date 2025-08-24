// Foliage module extracted from game.js
// Exports: initFoliage(worldW, worldH), updateFoliage(now, windA, windMag), drawFoliage(ctx, worldToScreen, camera)
let WORLD_W = 0, WORLD_H = 0;
let grassCanvas = null, gctx = null;
let foliageReady = false;
const TILE_PX = 96; const F_SCALE = 1.0;
function makeTileCanvas() { const c = document.createElement('canvas'); c.width = TILE_PX; c.height = TILE_PX; const tctx = c.getContext('2d'); tctx.imageSmoothingEnabled = false; return { c, tctx }; }
function pxF(g,x,y,w=1,h=1,color='#fff'){ g.fillStyle = color; g.fillRect(x|0,y|0,w|0,h|0); }
function randInt(a,b){ return (a + Math.floor(Math.random()*(b-a+1))); }
function randJunglePalette() { const h = 110 + randInt(-10, 18); const s = 50 + randInt(-8, 18); const l = 18 + randInt(-4, 8); return { leafDark:  `hsl(${h} ${s+6}% ${Math.max(l-8,6)}%)`, leaf: `hsl(${h} ${s+10}% ${l}%)`, leafLight: `hsl(${h} ${s+18}% ${Math.min(l+12,72)}%)`, stem: `hsl(${h-30} ${Math.max(s-6,12)}% ${Math.max(l-12,5)}%)`, bloom:`hsl(${(h+260)%360} 64% 62%)`, fruit:`hsl(${(h+90)%360} 72% 52%)` }; }
let FOLIAGE_PAL = randJunglePalette();
function drawLeafF(g, cx, cy, len, width, angle, colMid, colEdge){ const steps = Math.max(6, Math.floor(len/3)); for (let i=0;i<=steps;i++){ const t=i/steps; const w=width*(1-Math.pow(t,1.5)); const dx=Math.cos(angle)*len*t; const dy=Math.sin(angle)*len*t; const x=cx+dx, y=cy+dy; pxF(g, x-w, y, w, 1, colEdge); pxF(g, x, y, 1, 1, colMid); pxF(g, x+1, y, w, 1, colEdge); } }
function drawStemF(g,x1,y1,x2,y2,col){ g.fillStyle = col; const steps = Math.hypot(x2-x1,y2-y1)|0; for (let i=0;i<=steps;i++){ const t=i/steps; const x=Math.round(x1+(x2-x1)*t); const y=Math.round(y1+(y2-y1)*t); g.fillRect(x,y,1,1); } }
function makePalmFronds(tile){ const g = tile.tctx; const cx=TILE_PX/2, cy=TILE_PX*0.58; const blades=7; return (time, windA, windMag)=>{ g.clearRect(0,0,TILE_PX,TILE_PX); drawStemF(g,cx,cy,cx,cy-18,FOLIAGE_PAL.stem); for (let i=0;i<blades;i++){ const a = -Math.PI/2 + (i-(blades-1)/2)*(Math.PI/10); const sway = Math.sin(time*0.004 + i*0.7) * 0.25 + Math.cos(windA - a)*0.2*windMag; const ang = a + sway; drawLeafF(g, cx, cy-18, 28, 4, ang, FOLIAGE_PAL.leaf, FOLIAGE_PAL.leafLight); } }; }
function makeBush(tile){ const g=tile.tctx; const cx=TILE_PX/2, cy=TILE_PX*0.72; return (time, windA, windMag)=>{ g.clearRect(0,0,TILE_PX,TILE_PX); for (let r=0;r<5;r++){ const rad=10+r*3; for (let i=0;i<20;i++){ const a=(i/20)*Math.PI*2; const sway=Math.cos(time*0.002 + i*0.3)*0.2 + Math.cos(windA-a)*0.2*windMag; const x=cx+Math.cos(a+sway)*rad; const y=cy+Math.sin(a+sway)*rad*0.7; pxF(g, x, y, 2, 2, r<2?FOLIAGE_PAL.leaf:FOLIAGE_PAL.leafLight); } } }; }
function makeMonstera(tile){ const g=tile.tctx; const cx=TILE_PX*0.5, cy=TILE_PX*0.68; return (time, windA, windMag)=>{ g.clearRect(0,0,TILE_PX,TILE_PX); for (let i=0;i<4;i++){ const a=-Math.PI/2 + (i-1.5)*0.5; const cut = 3 + i; const bend = Math.sin(time*0.002+i)*0.2 + Math.cos(windA-a)*0.2*windMag; const steps=24, len=28, width=6, ang=a+bend; for (let s=0;s<=steps;s++){ const t=s/steps; const dx=Math.cos(ang)*len*t, dy=Math.sin(ang)*len*t; const w=width*(1 - Math.pow(t,1.4)); for (let k=-w;k<=w;k++){ if (Math.abs(k)<1 && t>0.3 && (s%cut===0)) continue; pxF(g, cx+dx+k, cy+dy, 1,1, k===0?FOLIAGE_PAL.leaf:FOLIAGE_PAL.leafLight); } } drawStemF(g, cx, cy, cx+Math.cos(a)*14, cy+Math.sin(a)*14, FOLIAGE_PAL.stem); } }; }
function makeVines(tile){ const g=tile.tctx; const anchors=[20,40,60,78]; return (time, windA, windMag)=>{ g.clearRect(0,0,TILE_PX,TILE_PX); anchors.forEach((ax,i)=>{ let x=ax, y=8; const length=70; for (let k=0;k<length;k++){ const sway = Math.sin((k*0.15)+time*0.004 + i)*1.1 + Math.cos(windA)*1.5*windMag; x = ax + sway*(k/length); y = 8 + k*0.9; pxF(g, x, y, 1,1, FOLIAGE_PAL.stem); if (k%8===0){ drawLeafF(g, x, y, 8, 1, Math.PI, FOLIAGE_PAL.leaf, FOLIAGE_PAL.leafLight); drawLeafF(g, x, y, 8, 1, 0, FOLIAGE_PAL.leaf, FOLIAGE_PAL.leafLight); } } }); }; }
function makeRoseGardenTile(tile){ const g = tile.tctx; return (time, windA, windMag) => { g.clearRect(0,0,TILE_PX,TILE_PX); const cx = TILE_PX/2, cy = TILE_PX*0.52; for (let r=0;r<6;r++){ const rad = 8 + r*3; for (let a=0;a<360;a+=24){ const ax = Math.round(cx + Math.cos(a*Math.PI/180)*(rad + ((a%2)?1:0))); const ay = Math.round(cy + Math.sin(a*Math.PI/180)*(rad*0.7)); g.fillStyle = (r<2? '#0C3B26' : (r<4? '#1E6A3E' : '#4FBF68')); g.fillRect(ax, ay, 2, 2); } } const roses = [[-4,-2],[2,-1],[1,3],[-2,2]]; for (let i=0;i<roses.length;i++){ const rx = cx + roses[i][0]; const ry = cy + roses[i][1]; g.fillStyle = '#6A0D1B'; g.fillRect(rx,ry,2,2); g.fillStyle = '#B0172F'; g.fillRect(rx-1,ry,1,1); g.fillRect(rx+2,ry,1,1); g.fillStyle = '#FF5177'; g.fillRect(rx,ry-1,1,1); } }; }

// ---------- Jungle tree tiles (ported from jungletrees.html) ----------
// We'll render 64x64 pixel-perfect frames into an offscreen canvas and blit
// them centered into the TILE_PX canvas so pixels remain exact.
const TREE_FRAMES = 6, TREE_FRAME_MS = 120;
const TREE_SEEDS = [0xA11CE, 0xBEE5, 0xC0FFEE, 0xD15EA5];

function makeJungleTree(tile, variantName, seed){
  const o = document.createElement('canvas'); o.width = 64; o.height = 64; const oc = o.getContext('2d'); oc.imageSmoothingEnabled = false;
  // local palette copied from jungletrees.html
  const PAL = {
    leafDark:  "#1c3f26",
    leafMid:   "#2e6a3a",
    leafLite:  "#53a34f",
    rimLeaf:   "#8adf76",
    barkDark:  "#3b2518",
    barkMid:   "#643f28",
    barkLite:  "#9b6a44",
    rimBark:   "#d29a6a",
    ground:    "#1a2a1d"
  };

  function px(ctx,x,y,color){ if(x<0||x>=64||y<0||y>=64) return; ctx.fillStyle=color; ctx.fillRect(x, y, 1, 1); }
  function ringShadow(ctx, cx, cy, rx, ry, color){ for(let a=0;a<360;a+=2){ const rad = a*Math.PI/180, x = Math.round(cx + Math.cos(rad)*rx), y = Math.round(cy + Math.sin(rad)*ry); px(ctx,x,y,color); } }

  function drawTrunk(ctx, baseX, baseY, h, w, sway, hasButtress=false, vines=0){
    const topY = baseY - h;
    for(let y=0;y<=h;y++){
      const yy = baseY - y;
      const taper = Math.max(1, Math.round(w - y*(w-2)/h));
      const x0 = baseX - Math.floor(taper/2) + Math.round(sway * (1 - y/h));
      for(let x=0;x<taper;x++){
        const atRightEdge = x === taper-1;
        const atLeftEdge  = x === 0;
        let c = PAL.barkMid;
        if(atLeftEdge) c = PAL.barkDark;
        if(atRightEdge) c = PAL.barkLite;
        if(atRightEdge && (y%2===0)) c = PAL.rimBark;
        px(ctx, x0 + x, yy, c);
      }
      if(y%7===3){ px(ctx, baseX, yy, PAL.barkDark); }
    }
    if(hasButtress){ for(let i=-1;i<=1;i+=2){ let bx = baseX + i * Math.ceil(w/2); for(let k=0;k<4;k++){ px(ctx, bx + i*Math.floor(k/2), baseY - k, PAL.barkLite); px(ctx, bx + i*Math.floor(k/2), baseY - k + 1, PAL.barkMid); } } }
    for(let v=0; v<vines; v++){ const vx = baseX + (v%2===0 ? -1:1) * Math.floor(w/2); for(let yy=topY; yy<=baseY-2; yy++){ if(yy % 2 === (v%2)) px(ctx, vx, yy, PAL.leafMid); if(yy % 5 === 0) { px(ctx, vx + (v%2?1:-1), yy, PAL.leafLite); } } }
    for(let gx=-4; gx<=4; gx++){ if(Math.abs(gx)%2===0) px(ctx, baseX+gx, baseY+1, PAL.ground); if(Math.abs(gx)%3===0) px(ctx, baseX+gx, baseY, PAL.leafDark); }
  }

  function drawCanopy(ctx, cx, cy, rngf, swayPhase, variant){
    const clusters = [];
    if(variant === "broad"){
      clusters.push({rx:10,ry:6, dy:0,  dx:0});
      clusters.push({rx:9, ry:5, dy:-5, dx:-3});
      clusters.push({rx:8, ry:5, dy:-4, dx:4});
    } else if(variant === "palms"){
      clusters.push({rx:9, ry:3, dy:0, dx:0});
      clusters.push({rx:10,ry:3, dy:-2,dx:-2});
      clusters.push({rx:10,ry:3, dy:-2,dx:2});
    } else if(variant === "banyan"){
      clusters.push({rx:8, ry:6, dy:-1, dx:0});
      clusters.push({rx:7, ry:5, dy:-6, dx:-3});
      clusters.push({rx:7, ry:5, dy:-6, dx:3});
    } else { // stout
      clusters.push({rx:9, ry:7, dy:0, dx:0});
      clusters.push({rx:7, ry:5, dy:-5, dx:-4});
      clusters.push({rx:7, ry:5, dy:-5, dx:4});
    }
    const sway = Math.round(Math.sin(swayPhase)*1);
    const liteBias = Math.cos(swayPhase)*0.5 + 0.5;
    clusters.forEach(cl=>{ ringShadow(ctx, cx + cl.dx + sway, cy + cl.dy, cl.rx, cl.ry, PAL.leafDark); });
    clusters.forEach(cl=>{
      for(let y=-cl.ry; y<=cl.ry; y++){
        for(let x=-cl.rx; x<=cl.rx; x++){
          if((x*x)/(cl.rx*cl.rx) + (y*y)/(cl.ry*cl.ry) <= 1){
            const wx = x + 0.8, wy = y - 0.6;
            const shade = (wx*0.6 - wy*0.9) / (Math.max(cl.rx,cl.ry));
            let c = PAL.leafMid;
            if(shade > 0.25) c = PAL.leafLite;
            if(shade > 0.55 + liteBias*0.15) c = PAL.rimLeaf;
            if(shade < -0.2) c = PAL.leafDark;
            px(ctx, cx + cl.dx + sway + x, cy + cl.dy + y, c);
          }
        }
      }
    });
    if(variant === "palms"){
      for(let i=0;i<6;i++){
        const ang = (-40 + i*16) * Math.PI/180;
        const len = 12 + (i%2)*3;
        const wob = Math.sin(swayPhase + i*0.7)*1;
        for(let t=0;t<len;t++){
          const xx = Math.round(cx + Math.cos(ang)*(t+wob));
          const yy = Math.round(cy + Math.sin(ang)*(t*0.7));
          px(ctx, xx, yy, (t>len*0.7)? PAL.rimLeaf : PAL.leafLite);
        }
      }
    }
  }

  function drawTree(ctx, seed, tNorm, variant){
    const R = (function(s){ let ss = s>>>0; return function(){ ss = (ss * 1664525 + 1013904223) >>> 0; return ss / 4294967296; }; })(seed);
    ctx.clearRect(0,0,64,64);
    const baseY = 58 + Math.floor(R()*2);
    const baseX = 32 + Math.round((R()-0.5)*4);
    const swayPhase = tNorm * Math.PI*2 + (R()*Math.PI*2);
    let trunkH, trunkW, buttress=false, vines=0, canopyVar="broad";
    switch(variant){
      case "A": trunkH= Math.floor(32+R()*10); trunkW= Math.floor(4+R()*2); canopyVar="broad"; break;
      case "B": trunkH= Math.floor(28+R()*8);  trunkW= Math.floor(3+R()*2); canopyVar="palms";  break;
      case "C": trunkH= Math.floor(34+R()*8);  trunkW= Math.floor(4+R()*2); canopyVar="banyan"; vines=2; break;
      case "D": trunkH= Math.floor(30+R()*6);  trunkW= Math.floor(6+R()*2); canopyVar="stout";  buttress=true; break;
    }
    const sway = Math.sin(swayPhase)*1.5;
    drawTrunk(ctx, baseX, baseY, trunkH, trunkW, sway, buttress, vines);
    const topY = baseY - trunkH; const canopyCX = baseX + Math.round(sway*0.6); const canopyCY = topY - 2;
    drawCanopy(ctx, canopyCX, canopyCY, R, swayPhase, canopyVar);
    // optional guides not needed in foliage tiles
  }

  // Return update function expected by foliage system
  return (time, windA, windMag) => {
    // Calculate frame index same as jungletrees: 6 frames at 120ms
    const frameIndex = Math.floor((time % (TREE_FRAMES * TREE_FRAME_MS)) / TREE_FRAME_MS) % TREE_FRAMES;
    const tNorm = frameIndex / TREE_FRAMES;
    drawTree(oc, seed, tNorm, variantName);
    // blit centered into tile canvas (no scaling — preserve pixels)
    const dx = Math.floor((TILE_PX - 64)/2), dy = Math.floor((TILE_PX - 64)/2);
    tile.tctx.clearRect(0,0,TILE_PX,TILE_PX);
    tile.tctx.drawImage(o, dx, dy);
  };
}

function makeJungleA(tile){ return makeJungleTree(tile, 'A', TREE_SEEDS[0]); }
function makeJungleB(tile){ return makeJungleTree(tile, 'B', TREE_SEEDS[1]); }
function makeJungleC(tile){ return makeJungleTree(tile, 'C', TREE_SEEDS[2]); }
function makeJungleD(tile){ return makeJungleTree(tile, 'D', TREE_SEEDS[3]); }

const foliageMakers = [ makePalmFronds, makeBush, makeMonstera, makeVines, makeBush, makePalmFronds, makeMonstera, makeVines, makeBush, makePalmFronds, makeMonstera, makeVines, makeRoseGardenTile,
  // add the 4 jungle tree variants (pixel-for-pixel, animated)
  makeJungleA, makeJungleB, makeJungleC, makeJungleD
];
export const foliageTiles = [];
export let foliageInstances = [];
const FOLIAGE_COUNT = 340;
function buildFoliageTiles(){ foliageTiles.length = 0; for (let i=0;i<foliageMakers.length;i++){ const t = makeTileCanvas(); t.update = foliageMakers[i](t, i); foliageTiles.push(t); } }
function scatterFoliage(worldW, worldH){
  foliageInstances = [];
  const treeCount = 4; // last N tiles are jungle trees (we appended them)
  for (let i=0;i<FOLIAGE_COUNT;i++){
    const idx = Math.floor(Math.random()*foliageTiles.length);
    // default small scale
    let scale = 0.5 + Math.random()*0.6;
    // if this index is one of the tree tiles, bias much larger
    const treeStart = Math.max(0, foliageTiles.length - treeCount);
  const isTree = idx >= treeStart;
  if (isTree){ scale = 1.6 + Math.random()*0.8; }
  // assign hit points: trees now take 5 projectile hits, small plants take 1
  const hp = isTree ? 5 : 1;
  // mark foliage as destructible so they can gib when hit/run-over
  foliageInstances.push({ x: Math.random()*worldW, y: Math.random()*worldH, idx, scale, rot: (Math.random()-0.5)*0.6, isTree, destructible: true, hp });
  }
}

function buildGrass(){ if (!gctx) return; gctx.clearRect(0,0, WORLD_W, WORLD_H); const grd = gctx.createLinearGradient(0,0,0, WORLD_H); grd.addColorStop(0,'#05220b'); grd.addColorStop(1,'#08170a'); gctx.fillStyle = grd; gctx.fillRect(0,0, WORLD_W, WORLD_H); const blades = Math.floor((WORLD_W*WORLD_H)/2200); for (let i=0;i<blades;i++){ const x = Math.random()*WORLD_W, y = Math.random()*WORLD_H; const h = 6 + Math.random()*18; const lean = (Math.random()-0.5)*0.8; const col = `hsl(${105 + Math.random()*50} ${50 + Math.random()*25}% ${18 + Math.random()*18}%)`; gctx.fillStyle = col; for (let s=0;s<h;s++){ const bx = Math.round(x + lean*s); const by = Math.round(y - s); gctx.fillRect(bx, by, (Math.random()<0.08?2:1), 1); } if (Math.random() < 0.02){ const tsize = 2 + Math.floor(Math.random()*3); gctx.fillStyle = `hsl(${100 + Math.random()*40} ${40 + Math.random()*30}% ${12 + Math.random()*10}%)`; gctx.fillRect(Math.round(x)-tsize, Math.round(y)-tsize, tsize*2, tsize); } } }

export function initFoliage(worldW, worldH){ try{ if (typeof console !== 'undefined') console.log('initFoliage called', worldW, worldH); }catch(_){ }
  WORLD_W = worldW; WORLD_H = worldH; grassCanvas = document.createElement('canvas'); grassCanvas.width = WORLD_W; grassCanvas.height = WORLD_H; gctx = grassCanvas.getContext('2d'); buildGrass(); buildFoliageTiles(); scatterFoliage(WORLD_W, WORLD_H); foliageReady = true; }


// debugging probes
try{ if (typeof console !== 'undefined') console.log('foliage module loaded'); }catch(_){ }

export function updateFoliage(now, windA, windMag){ // update animated tile frames
  for (const t of foliageTiles) t.update(now, windA, windMag);
}

export function drawFoliage(ctx, worldToScreen, camera){ // draw grass backdrop
  try{ if (typeof console !== 'undefined') console.log('drawFoliage called, grassCanvasReady=', !!grassCanvas, 'foliageReady=', foliageReady); }catch(_){ }
  if (!foliageReady) return;
  let srcW = Math.max(1, Math.round(ctx.canvas.width / camera.zoom)); let srcH = Math.max(1, Math.round(ctx.canvas.height / camera.zoom)); if (srcW > WORLD_W) srcW = WORLD_W; if (srcH > WORLD_H) srcH = WORLD_H; let srcX = Math.round(camera.x - srcW/2); let srcY = Math.round(camera.y - srcH/2); srcX = Math.max(0, Math.min(srcX, Math.max(0, WORLD_W - srcW)));
  if (srcY >= 0 && srcY + srcH <= WORLD_H){ ctx.drawImage(grassCanvas, srcX, srcY, srcW, srcH, 0, 0, ctx.canvas.width, ctx.canvas.height); } else { const topSrcY = ((srcY % WORLD_H) + WORLD_H) % WORLD_H; const topH = Math.max(0, WORLD_H - topSrcY); const topDrawH = Math.round(topH * camera.zoom); if (topH > 0) ctx.drawImage(grassCanvas, srcX, topSrcY, srcW, topH, 0, 0, ctx.canvas.width, topDrawH); const remH = srcH - topH; const remDrawY = topDrawH; if (remH > 0) ctx.drawImage(grassCanvas, srcX, 0, srcW, remH, 0, remDrawY, ctx.canvas.width, Math.round(remH * camera.zoom)); }

  // draw scattered foliage instances
  for (const f of foliageInstances){ const ss = worldToScreen(f.x, f.y); const sx = ss.x, sy = ss.y; const visiblePad = TILE_PX * Math.max(1, f.scale * F_SCALE) * camera.zoom; if (sx < -visiblePad || sx > ctx.canvas.width+visiblePad || sy < -visiblePad || sy > ctx.canvas.height+visiblePad) continue; const tile = foliageTiles[f.idx]; ctx.save(); ctx.translate(sx, sy); ctx.rotate(f.rot); ctx.scale(f.scale * F_SCALE * camera.zoom, f.scale * F_SCALE * camera.zoom); ctx.translate(-TILE_PX/2, -TILE_PX/2); ctx.drawImage(tile.c, 0, 0); ctx.restore(); }
}
