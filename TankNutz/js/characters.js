// characters module - contains character tile makers (idle + running)
export const CHAR_TILE_PX = 72;
export function charTileCanvas(){ const c = document.createElement('canvas'); c.width = CHAR_TILE_PX; c.height = CHAR_TILE_PX; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; return { c, g }; }

// module-scoped ASSETS reference (set by initCharactersAssets)
let ASSETS = {};
export function initCharactersAssets(a){ ASSETS = a || {}; return ASSETS; }

// local palette and helpers for character painters
function junglePaletteLocal(){ const rint=(a,b)=>a+Math.floor(Math.random()*(b-a+1)); function clamp(v,a,b){return Math.max(a,Math.min(b,v));} const g = 110 + rint(-10,25); const s = 45 + rint(-10,10); const l = 24 + rint(-6,8); return { leaf:`hsl(${g} ${s+8}% ${l}%)`, leafDark:`hsl(${g} ${s}% ${clamp(l-8,6,60)}%)`, cloth1:`hsl(${(g+40)%360} 60% 42%)`, cloth2:`hsl(${(g+180)%360} 55% 52%)`, skinLt:'#f2c6a5', skinMd:'#c78e64', skinDk:'#8a5b39', hair:'#2b221a', bandana:'#d33', metal:'#9ea4aa', shadow:'rgba(0,0,0,.28)', grid:'#000', dust:'rgba(200,200,200,.12)' } }
export let CHAR_PAL = junglePaletteLocal();

// small pixel helpers used by character makers
export function pxC(g,x,y,w=1,h=1,color='#fff'){ g.fillStyle = color; g.fillRect(x|0,y|0,w|0,h|0); }
export function ellipseShadowC(g, cx, cy, rx, ry, col){ g.save(); g.translate(cx, cy); g.scale(rx, ry); g.beginPath(); g.arc(0,0,1,0,Math.PI*2); g.fillStyle = col; g.fill(); g.restore(); }

// body part helpers
export function drawBootsC(g, x, y){ pxC(g,x-2,y,5,2,'#1a1a1a'); }
export function drawLegsC(g, x, y, tone){ pxC(g,x-1,y-6,2,6,tone); pxC(g,x+2,y-6,2,6,tone); }
export function drawPantsC(g, x, y){ pxC(g,x-3,y-7,8,3,CHAR_PAL.cloth1); }
export function drawTorsoC(g, x, y, color){ pxC(g,x-4,y-14,9,7,color); }
export function drawHeadC(g, x, y, skin){ pxC(g,x-3,y-21,7,7,skin); }
export function drawHairC(g, x, y){ pxC(g,x-3,y-21,7,2,CHAR_PAL.hair); }
export function drawBandanaC(g, x, y){ pxC(g,x-3,y-22,7,2,CHAR_PAL.bandana); }
export function drawVestC(g, x, y){ pxC(g,x-4,y-14,9,7, CHAR_PAL.cloth2); pxC(g,x-1,y-14,3,7, CHAR_PAL.cloth1); }
export function drawSatchelC(g, x, y){ pxC(g,x+4,y-13,3,5, '#4a3b28'); }
export function drawShoulderStrapC(g, x, y){ for(let i=0;i<7;i++) pxC(g,x-5+i,y-14+i,1,1,'#4a3b28'); }

export function drawRifleC(g, cx, cy, ang){ const len = 18; const vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++){ const x = cx + vx*i, y = cy + vy*i; pxC(g,x,y,1,1, i<3 ? '#3b2a1a' : (i>len-3?CHAR_PAL.metal:'#221a14')); } }
export function drawPistolC(g, cx, cy, ang){ const len=8, vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++){ const x=cx+vx*i, y=cy+vy*i; pxC(g,x,y,1,1, i>len-2?CHAR_PAL.metal:'#222'); } }
export function drawArmsAimingC(g, x, y, ang, skin){ const ax = x+1, ay = y-11; const len = 6, vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++) pxC(g, ax+vx*i, ay+vy*i, 1,1, skin); for(let i=0;i<len-1;i++) pxC(g, ax-1+vx*i*0.9, ay+1+vy*i*0.9, 1,1, skin); }

// running helpers
export function drawLegsRunC(g, x, y, tone, phase){ const liftL = Math.sin(phase)*1.5; const liftR = Math.sin(phase+Math.PI)*1.5; const foreL = Math.cos(phase)*1.2; const foreR = Math.cos(phase+Math.PI)*1.2; pxC(g, x-1+foreL, y-6-liftL, 2, 6, tone); pxC(g, x+2+foreR, y-6-liftR, 2, 6, tone); drawBootsC(g, x+foreL*0.7, y-0.5-liftL*0.4); drawBootsC(g, x+foreR*0.7+2, y-0.5-liftR*0.4); }
export function drawTorsoRunC(g, x, y, color, bob){ pxC(g,x-4,y-14-bob,9,7,color); }
export function drawHeadRunC(g, x, y, skin, bob){ pxC(g,x-3,y-21-bob,7,7,skin); }
export function drawHairRunC(g,x,y,bob){ pxC(g,x-3,y-21-bob,7,2,CHAR_PAL.hair); }
export function drawArmsRunAimC(g, x, y, ang, skin, swing){ const ax = x+1, ay = y-11 - Math.abs(swing)*0.8; const len = 6, vx=Math.cos(ang), vy=Math.sin(ang); for(let i=0;i<len;i++) pxC(g, ax+vx*i, ay+vy*i, 1,1, skin); for(let i=0;i<len-1;i++) pxC(g, ax-1+vx*i*0.9 - swing*0.6, ay+1+vy*i*0.9, 1,1, skin); }
export function drawDustC(g, x, y, phase){ const n = 3; const p = (Math.sin(phase)+1)/2; for(let i=0;i<n;i++){ const a = i*2*Math.PI/n + phase*0.5; const r = 2 + p*3; pxC(g, x + Math.cos(a)*r, y + 1 + Math.sin(a)*r*0.3, 1,1, CHAR_PAL.dust); } }

// Idle makers
export function makeCommandoIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78-1, 12, 3, CHAR_PAL.shadow); const breathe = Math.sin(t*0.004)*1.2; const cx = CHAR_TILE_PX/2, baseY = CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, CHAR_PAL.cloth1); drawVestC(g,cx,baseY); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); drawHairC(g,cx,baseY); drawBandanaC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+breathe,lookA, CHAR_PAL.skinDk); drawRifleC(g,cx+2,baseY-11+breathe,lookA); }; }
export function makeScoutIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const sway = Math.sin(t*0.005)*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, CHAR_PAL.cloth2); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); drawHairC(g,cx,baseY); drawShoulderStrapC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinMd); drawPistolC(g,cx+2,baseY-11+sway,lookA); }; }
export function makeHeavyIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.8, 13, 3.4, CHAR_PAL.shadow); const wob = Math.sin(t*0.003)*0.8; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.8; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); pxC(g,cx-4,baseY-7,10,4,'#3a3a3a'); drawTorsoC(g,cx,baseY, '#2d3b33'); drawSatchelC(g,cx,baseY); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); drawHairC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+wob,lookA, CHAR_PAL.skinDk); drawRifleC(g,cx+1,baseY-11+wob,lookA); }; }
export function makeMedicIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const b = Math.sin(t*0.004)*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinLt); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#3f5148'); pxC(g,cx-1,baseY-12,3,3,'#d33'); drawHeadC(g,cx,baseY, CHAR_PAL.skinLt); drawHairC(g,cx,baseY); drawArmsAimingC(g,cx,baseY+b,lookA, CHAR_PAL.skinLt); drawPistolC(g,cx+2,baseY-11+b,lookA); }; }
export function makeVillager1Idle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 10.5, 3, CHAR_PAL.shadow); const sway = Math.sin(t*0.004)*0.9; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); pxC(g,cx-3,baseY-7,8,3,'#6b5b3a'); drawTorsoC(g,cx,baseY, '#5b7d64'); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); pxC(g,cx-4,baseY-22,9,2,'#caa84a'); pxC(g,cx-5,baseY-21,11,1,'#caa84a'); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinMd); }; }
export function makeVillager2Idle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 10.5, 3, CHAR_PAL.shadow); const sway = Math.cos(t*0.0035)*0.8; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinLt); pxC(g,cx-3,baseY-7,8,3,'#335c4a'); drawTorsoC(g,cx,baseY, '#496b55'); drawHeadC(g,cx,baseY, CHAR_PAL.skinLt); for(let i=0;i<7;i++) pxC(g,cx-5+i,baseY-14+i,1,1,'#2a2a2a'); pxC(g,cx+4,baseY-10,3,4,'#2a2a2a'); drawArmsAimingC(g,cx,baseY+sway,lookA, CHAR_PAL.skinLt); }; }
export function makeGuideIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const b = Math.sin(t*0.0045)*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinDk); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#355546'); drawHeadC(g,cx,baseY, CHAR_PAL.skinDk); pxC(g,cx+4,baseY-10,4,1,CHAR_PAL.metal); pxC(g,cx+7,baseY-11,1,3,'#3b2a1a'); drawArmsAimingC(g,cx,baseY+b,lookA, CHAR_PAL.skinDk); }; }
export function makeRadioOpIdle(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); ellipseShadowC(g, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78, 11, 3, CHAR_PAL.shadow); const wob = Math.sin(t*0.0038)*0.9; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; drawBootsC(g,cx,baseY); drawLegsC(g,cx,baseY, CHAR_PAL.skinMd); drawPantsC(g,cx,baseY); drawTorsoC(g,cx,baseY, '#3b4e44'); drawHeadC(g,cx,baseY, CHAR_PAL.skinMd); drawHairC(g,cx,baseY); pxC(g,cx-7,baseY-13,4,6,'#2a2f34'); for(let i=0;i<7;i++) pxC(g,cx-8,baseY-14-i,1,1,'#aab'); drawArmsAimingC(g,cx,baseY+wob,lookA, CHAR_PAL.skinMd); drawPistolC(g,cx+2,baseY-11+wob,lookA); }; }

// Running makers
export function makeCommandoRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph = t*0.01*5.5; const bob = Math.abs(Math.sin(ph))*1.5; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY-1,12,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, CHAR_PAL.cloth1, bob); drawVestC(g,cx,baseY, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); drawHairRunC(g,cx,baseY, bob); drawBandanaC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); drawRifleC(g,cx+2,baseY-11+bob,lookA); }; }
export function makeScoutRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*6.0, bob=Math.abs(Math.sin(ph))*1.2; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+1); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, CHAR_PAL.cloth2, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); drawHairRunC(g,cx,baseY, bob); drawShoulderStrapC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }
export function makeHeavyRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.0, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.8; ellipseShadowC(g,cx,baseY,13,3.4,CHAR_PAL.shadow); drawDustC(g,cx-7,baseY+1,ph+0.5); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); pxC(g,cx-4,baseY-7,10,4,'#3a3a3a'); drawTorsoRunC(g,cx,baseY, '#2d3b33', bob); drawSatchelC(g,cx,baseY, bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); drawHairRunC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); drawRifleC(g,cx+1,baseY-11+bob,lookA); }; }
export function makeMedicRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.6, bob=Math.abs(Math.sin(ph))*1.2; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-5,baseY+1,ph+2.1); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinLt, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#3f5148', bob); pxC(g,cx-1,baseY-12-bob,3,3,'#d33'); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinLt, bob); drawHairRunC(g,cx,baseY, bob); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinLt, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }
export function makeVillager1Run(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.2, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,10.5,3,CHAR_PAL.shadow); drawDustC(g,cx-5,baseY+1,ph+0.7); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); pxC(g,cx-3,baseY-7,8,3,'#6b5b3a'); drawTorsoRunC(g,cx,baseY, '#5b7d64', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); pxC(g,cx-4,baseY-22-bob,9,2,'#caa84a'); pxC(g,cx-5,baseY-21-bob,11,1,'#caa84a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); }; }
export function makeVillager2Run(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.0, bob=Math.abs(Math.sin(ph))*1.0; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,10.5,3,CHAR_PAL.shadow); drawDustC(g,cx-4,baseY+1,ph+1.4); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinLt, ph); pxC(g,cx-3,baseY-7,8,3,'#335c4a'); drawTorsoRunC(g,cx,baseY, '#496b55', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinLt, bob); for(let i=0;i<7;i++) pxC(g,cx-5+i,baseY-14-bob+i,1,1,'#2a2a2a'); pxC(g,cx+4,baseY-10-bob,3,4,'#2a2a2a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinLt, Math.sin(ph)); }; }
export function makeGuideRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.4, bob=Math.abs(Math.sin(ph))*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+2.8); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinDk, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#355546', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinDk, bob); pxC(g,cx+4,baseY-10-bob,4,1,CHAR_PAL.metal); pxC(g,cx+7,baseY-11-bob,1,3,'#3b2a1a'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinDk, Math.sin(ph)); }; }
export function makeRadioOpRun(g){ return (t, lookA)=>{ g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const ph=t*0.01*5.3, bob=Math.abs(Math.sin(ph))*1.1; const cx=CHAR_TILE_PX/2, baseY=CHAR_TILE_PX*0.78; ellipseShadowC(g,cx,baseY,11,3,CHAR_PAL.shadow); drawDustC(g,cx-6,baseY+1,ph+3.5); drawLegsRunC(g,cx,baseY, CHAR_PAL.skinMd, ph); drawPantsC(g,cx,baseY); drawTorsoRunC(g,cx,baseY, '#3b4e44', bob); drawHeadRunC(g,cx,baseY, CHAR_PAL.skinMd, bob); drawHairRunC(g,cx,baseY, bob); pxC(g,cx-7,baseY-13-bob,4,6,'#2a2f34'); for(let i=0;i<7;i++) pxC(g,cx-8,baseY-14-bob-i,1,1,'#aab'); drawArmsRunAimC(g,cx,baseY+bob,lookA, CHAR_PAL.skinMd, Math.sin(ph)); drawPistolC(g,cx+2,baseY-11+bob,lookA); }; }

// Squidrobot, Kraken and Osprey makers (kept here as they are larger/unique)
export function makeSquidRobotIdle(g){
  const W = 64, H = 64, CX = 32, CY = 32, FRAMES = 12;
  const bodyFrames = [];
  const bodyBob = [];
  function makeLayer(){ const c = document.createElement('canvas'); c.width = CHAR_TILE_PX; c.height = CHAR_TILE_PX; return c; }
  function px(ctx,x,y,col,t=1){ ctx.fillStyle=col; ctx.fillRect(Math.round(x),Math.round(y),t,t); }
  function line(ctx,x0,y0,x1,y1,col,t=1){ x0=Math.round(x0); y0=Math.round(y0); x1=Math.round(x1); y1=Math.round(y1); const dx=Math.abs(x1-x0), sx=x0<x1?1:-1; const dy=-Math.abs(y1-y0), sy=y0<y1?1:-1; let err=dx+dy; while(true){ px(ctx,x0,y0,col,t); if(x0===x1 && y0===y1) break; const e2=2*err; if(e2>=dy){ err+=dy; x0+=sx; } if(e2<=dx){ err+=dx; y0+=sy; } } }
  function circleFill(ctx,cx,cy,r,col){ for(let y=-r;y<=r;y++){ const w = Math.floor(Math.sqrt(r*r - y*y)); ctx.fillRect(Math.round(cx-w), Math.round(cy+y), 2*w+1, 1); } }
  function rimLightArc(ctx,cx,cy,r,col){ ctx.fillStyle=col; for(let a=-0.2;a<=0.9;a+=0.05){ const x=Math.round(cx+Math.cos(a)*r); const y=Math.round(cy+Math.sin(a)*r); ctx.fillRect(x,y,1,1); if (Math.random()<0.3) ctx.fillRect(x,y-1,1,1); } }
  function leg(ctx,cx,cy,baseAngle,phase,colors){ const L1=7,L2=6; const swing=Math.sin(phase)*2.0; const lift=Math.cos(phase*0.5)*1.0; const bodyR=12; const bx=cx+Math.cos(baseAngle)*(bodyR-1); const by=cy+Math.sin(baseAngle)*(bodyR-1); const kx=bx+Math.cos(baseAngle)*(L1+swing*0.4); const ky=by+Math.sin(baseAngle)*(L1+swing*0.4)-lift; const fx=kx+Math.cos(baseAngle)*(L2+swing); const fy=ky+Math.sin(baseAngle)*(L2+swing)+lift*0.25; line(ctx,bx,by,kx,ky,colors.dark,2); line(ctx,kx,ky,fx,fy,colors.light,1); px(ctx,fx,fy,colors.light,2); }
  function shadow(ctx){ ctx.save(); ctx.fillStyle = CHAR_PAL.shadow; const rx=16, ry=6, cy = CHAR_TILE_PX*0.78 + 10; for (let y=-ry;y<=ry;y++){ const w = Math.floor(Math.sqrt(1 - (y*y)/(ry*ry)) * rx); ctx.fillRect(CHAR_TILE_PX/2 - w, cy + y, 2*w+1, 1); } ctx.restore(); }
  for (let fi=0; fi<FRAMES; fi++){
    const c = makeLayer(); const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; const t = fi / FRAMES; const bob = Math.round(Math.sin(t * Math.PI*2) * 1);
    shadow(ctx);
    const legColors = { dark: '#1e2430', light: '#5e7389' };
    for (let i=0;i<8;i++){ const a=(i/8)*Math.PI*2; const phase=(t*Math.PI*2) + (i%2?Math.PI:0); leg(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, a, phase, legColors); }
    circleFill(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, 12, '#11141a');
    circleFill(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, 11, '#1e2430');
    circleFill(ctx, CHAR_TILE_PX/2, CHAR_TILE_PX*0.78 + bob, 9, '#2b3445');
    rimLightArc(ctx, CHAR_TILE_PX/2-2, CHAR_TILE_PX*0.78-2 + bob, 10, '#5e7389');
    bodyFrames.push(c); bodyBob.push(bob);
  }
  function drawTurretTo(ctx, angle, bob){ const cx = CHAR_TILE_PX/2, cy = CHAR_TILE_PX*0.78 - 1 + bob; function pxLocal(x,y,col,t=1){ ctx.fillStyle=col; ctx.fillRect(x|0,y|0,t,t); } function lineLocal(x0,y0,x1,y1,col,t=1){ x0|=0; y0|=0; x1|=0; y1|=0; let dx=Math.abs(x1-x0), sx = x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy = y0<y1?1:-1; let err = dx+dy; while(true){ pxLocal(x0,y0,col,t); if (x0===x1 && y0===y1) break; const e2 = 2*err; if (e2>=dy){ err += dy; x0 += sx; } if (e2<=dx){ err += dx; y0 += sy; } } }
    function circleFillLocal(cx,cy,r,col){ for(let y=-r;y<=r;y++){ const span = Math.floor(Math.sqrt(r*r - y*y)); ctx.fillRect(cx-span, cy+y, 2*span+1, 1); } }
    circleFillLocal(ctx, cx, cy, 6, '#1e2430'); circleFillLocal(ctx, cx, cy, 5, '#2b3445'); pxLocal(cx-1, cy-3, '#5e7389', 2);
    for (let k=0;k<6;k++){ const aa = angle + (k/6)*Math.PI*2; const bx = Math.round(cx + Math.cos(aa)*4); const by = Math.round(cy + Math.sin(aa)*4); pxLocal(bx,by,'#8fb4cf',1); }
    const dxv=Math.cos(angle), dyv=Math.sin(angle); for (let s=2;s<=14;s++){ const x = Math.round(cx + dxv*s); const y = Math.round(cy + dyv*s); pxLocal(x,y,'#5e7389',2); }
  }
  return (t, lookA) => {
    if (ASSETS.kraken){ const img = ASSETS.kraken; const srcW = img.width, srcH = img.height; const scale = Math.floor((CHAR_TILE_PX * 0.92) / Math.max(1, srcW)); const dw = srcW * scale, dh = srcH * scale; const dx = Math.round((CHAR_TILE_PX - dw)/2); const dy = Math.round((CHAR_TILE_PX - dh)/2 + 2); g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); g.imageSmoothingEnabled = false; g.drawImage(img, 0,0, srcW, srcH, dx, dy, dw, dh); return; }
    const idx = Math.floor((t/100) % bodyFrames.length); const b = bodyFrames[idx]; const bob = bodyBob[idx]||0; g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); g.drawImage(b,0,0); drawTurretTo(g, lookA, bob);
  };
}
export function makeSquidRobotRun(g){ return makeSquidRobotIdle(g); }

// Kraken maker
export function makeKrakenIdle(g){ const FRAMES = 6; const frames = []; const bobs = []; function px(ctx,x,y,col){ ctx.fillStyle = col; ctx.fillRect(x|0,y|0,1,1); } function disc(ctx,cx,cy,r,col){ for(let yy=-r; yy<=r; yy++){ const span = Math.floor(Math.sqrt(r*r - yy*yy)); for(let xx=-span; xx<=span; xx++) px(ctx, cx+xx, cy+yy, col); } }
  for (let fi=0; fi<FRAMES; fi++){ const c = document.createElement('canvas'); c.width = CHAR_TILE_PX; c.height = CHAR_TILE_PX; const ctx = c.getContext('2d'); ctx.imageSmoothingEnabled = false; const s = CHAR_TILE_PX/64; ctx.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); const cx = Math.round(CHAR_TILE_PX/2), cy = Math.round(CHAR_TILE_PX/2); disc(ctx, cx, cy, Math.round(14*s), '#2f4f4f'); disc(ctx, cx + Math.round(1*s), cy + Math.round(2*s), Math.round(13*s), '#4f6a6d'); disc(ctx, cx, cy, Math.round(11*s), '#0a2a2f'); disc(ctx, cx - Math.round(1*s), cy - Math.round(2*s), Math.round(9*s), '#4f6a6d'); disc(ctx, cx - Math.round(2*s), cy - Math.round(3*s), Math.round(7*s), '#b0c7c9'); for (let y=-14; y<=14; y++){ const span = Math.floor(Math.sqrt(14*14 - y*y)); for (let x=-span; x<=span; x++){ const rr = x*x + y*y; if (rr <= 14*14 && rr >= (14*14 - 18) && (x + y) < -4){ px(ctx, cx + x, cy + y, '#8fe3f7'); } } } disc(ctx, cx, cy, Math.round(6*s), '#0b0d0e'); disc(ctx, cx, cy, Math.round(4*s), '#0a2a2f'); for (let a=0;a<6;a++) px(ctx, cx-2 + a%3, cy-3 + (a/3|0), '#b0c7c9'); frames.push(c); bobs.push(0); }
  return (t, lookA) => { if (ASSETS.kraken){ const img = ASSETS.kraken; const srcW = img.width, srcH = img.height; const scale = Math.floor((CHAR_TILE_PX * 0.92) / Math.max(1, srcW)); const dw = srcW * scale, dh = srcH * scale; const dx = Math.round((CHAR_TILE_PX - dw)/2); const dy = Math.round((CHAR_TILE_PX - dh)/2 + 2); g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); g.imageSmoothingEnabled = false; g.drawImage(img, 0,0, srcW, srcH, dx, dy, dw, dh); return; } const idx = Math.floor((t/120) % frames.length); const frame = frames[idx]; g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX); g.drawImage(frame, 0,0); };
}
export function makeKrakenRun(g){ return makeKrakenIdle(g); }

// Osprey maker: adapted pixel-perfect from Osprey.html, draws into CHAR_TILE_PX
export function makeOspreyIdle(g){
  // Render the original 64x64 Osprey art pixel-for-pixel into the CHAR_TILE_PX tile.
  return (t, lookA) => {
    g.clearRect(0,0,CHAR_TILE_PX,CHAR_TILE_PX);
    // If external osprey asset is present, draw it centered and scaled
    if (ASSETS.osprey){
      const img = ASSETS.osprey;
      const srcW = img.width, srcH = img.height;
      const scale = Math.floor((CHAR_TILE_PX * 0.92) / srcW);
      const dw = srcW * scale, dh = srcH * scale;
      const dx = Math.round((CHAR_TILE_PX - dw)/2);
      const dy = Math.round((CHAR_TILE_PX - dh)/2);
      g.imageSmoothingEnabled = false;
      g.drawImage(img, 0,0, srcW, srcH, dx, dy, dw, dh);
      return;
    }
    // fallback: bake 12 rotor frames (64x64) and play them based on time; keep bob applied at draw-time
    if (!makeOspreyIdle._cachedFrames){
      const frames = [];
      const COL = { outline: '#1b1e27', steelMid: '#596273', steelLight: '#8f98ab', rim: '#c9d1e4', rotorDark: '#2b303b', rotorBlur: 'rgba(154,163,180,0.35)', glass: '#3a74a6', warn: '#d26b1e' };
      for (let step=0; step<12; step++){
        const spr = document.createElement('canvas'); spr.width = 64; spr.height = 64; const s = spr.getContext('2d'); s.imageSmoothingEnabled = false;
        function pxLocal(x,y,col){ s.fillStyle = col; s.fillRect(x|0,y|0,1,1); }
        function rectLocal(x,y,w,h,col){ s.fillStyle = col; s.fillRect(x|0,y|0,w|0,h|0); }
        function discLocal(cx,cy,r,col){ for (let yy=-r; yy<=r; yy++){ for (let xx=-r; xx<=r; xx++){ if (xx*xx + yy*yy <= r*r) pxLocal(cx+xx, cy+yy, col); } } }
        function lineLocal(x0,y0,x1,y1,col){ x0|=0; y0|=0; x1|=0; y1|=0; let dx=Math.abs(x1-x0), sx = x0<x1?1:-1; let dy=-Math.abs(y1-y0), sy = y0<y1?1:-1; let err = dx+dy; while(true){ pxLocal(x0,y0,col); if (x0===x1 && y0===y1) break; const e2 = 2*err; if (e2>=dy){ err += dy; x0 += sx; } if (e2<=dx){ err += dx; y0 += sy; } } }
        const cx = 32, cy = 32; const bob = 0; const wingY = cy - 2 + bob;
        for (let i=0;i<5;i++){ const alpha = 0.06 - i*0.01; if (alpha <= 0) break; const w = 36 - i*6, h = 8 - i*1; rectLocal(cx - (w>>1), cy + 12 + bob - (h>>1) + i, w, h, `rgba(0,0,0,${alpha})`); }
        rectLocal(cx - 22, wingY, 44, 4, COL.steelMid);
        rectLocal(cx - 22, wingY, 44, 1, COL.rim);
        rectLocal(cx - 4, cy - 12 + bob, 8, 24, COL.steelMid);
        rectLocal(cx - 3, cy - 16 + bob, 6, 4, COL.steelLight);
        rectLocal(cx - 2, cy - 15 + bob, 4, 2, COL.glass);
        rectLocal(cx - 3, cy + 13 + bob, 6, 6, COL.steelMid);
        rectLocal(cx - 14, cy + 15 + bob, 28, 2, COL.steelMid);
        rectLocal(cx - 4, cy - 12 + bob, 8, 1, COL.rim);
        rectLocal(cx - 22, wingY - 1, 44, 1, COL.outline);
        rectLocal(cx - 22, wingY + 4, 44, 1, COL.outline);
        rectLocal(cx - 5, cy - 13 + bob, 1, 24, COL.outline);
        rectLocal(cx + 4, cy - 13 + bob, 1, 24, COL.outline);
        const nxL = cx - 22, nxR = cx + 22; const ny = wingY + 2 + bob;
        rectLocal(nxL - 4, ny - 4, 8, 8, COL.steelMid);
        rectLocal(nxR - 4, ny - 4, 8, 8, COL.steelMid);
        rectLocal(nxL - 4, ny - 4, 8, 1, COL.rim);
        rectLocal(nxR - 4, ny - 4, 8, 1, COL.rim);
        rectLocal(nxL - 4, ny + 4, 3, 1, COL.warn);
        rectLocal(nxR + 1, ny + 4, 3, 1, COL.warn);
        rectLocal(nxL - 5, ny - 5, 10, 1, COL.outline);
        rectLocal(nxL - 5, ny + 4, 10, 1, COL.outline);
        rectLocal(nxR - 5, ny - 5, 10, 1, COL.outline);
        rectLocal(nxR - 5, ny + 4, 10, 1, COL.outline);
        discLocal(nxL, ny, 1, COL.warn);
        discLocal(nxR, ny, 1, COL.warn);
        // rotors for this step
        const ang = (step % 12) * (Math.PI * 2 / 12);
        (function drawRotorAt(cxR, cyR, angR, r){
          for (let i=0;i<3;i++){
            const a = angR + i * (Math.PI*2/3);
            const ex = Math.round(cxR + Math.cos(a) * r);
            const ey = Math.round(cyR + Math.sin(a) * r);
            lineLocal(cxR, cyR, ex, ey, COL.rotorDark);
            const ox = Math.round(-Math.sin(a)), oy = Math.round(Math.cos(a));
            lineLocal(cxR + ox, cyR + oy, ex + ox, ey + oy, COL.rotorDark);
            lineLocal(cxR - ox, cyR - oy, ex - ox, ey - oy, COL.rotorBlur);
          }
          discLocal(cxR, cyR, 2, COL.rotorBlur);
        })(nxL, ny, ang, 10);
        (function drawRotorAt(cxR, cyR, angR, r){
          for (let i=0;i<3;i++){
            const a = angR + i * (Math.PI*2/3);
            const ex = Math.round(cxR + Math.cos(a) * r);
            const ey = Math.round(cyR + Math.sin(a) * r);
            lineLocal(cxR, cyR, ex, ey, COL.rotorDark);
            const ox = Math.round(-Math.sin(a)), oy = Math.round(Math.cos(a));
            lineLocal(cxR + ox, cyR + oy, ex + ox, ey + oy, COL.rotorDark);
            lineLocal(cxR - ox, cyR - oy, ex - ox, ey - oy, COL.rotorBlur);
          }
          discLocal(cxR, cyR, 2, COL.rotorBlur);
        })(nxR, ny, ang, 10);
        frames.push(spr);
      }
      makeOspreyIdle._cachedFrames = frames;
    }
    const frames = makeOspreyIdle._cachedFrames;
    if (frames && frames.length){
      const steps = frames.length;
      const idx = Math.floor((t/60)) % steps;
      const frame = frames[idx];
      const bob = Math.round(Math.sin(t/1200) * 1.5);
      const srcW = frame.width, srcH = frame.height;
      const scaleOut = Math.floor((CHAR_TILE_PX * 0.92) / srcW);
      const dw = srcW * scaleOut, dh = srcH * scaleOut;
      const dx = Math.round((CHAR_TILE_PX - dw)/2);
      // apply bob in destination space (scale proportionally)
      const dy = Math.round((CHAR_TILE_PX - dh)/2 + (bob * (dh / srcH)));
      g.imageSmoothingEnabled = false;
      g.drawImage(frame, 0,0, srcW, srcH, dx, dy, dw, dh);
    }
  };
}
export function makeOspreyRun(g){ return makeOspreyIdle(g); }

// register maps
export const idleMakers = { commando: makeCommandoIdle, scout: makeScoutIdle, heavy: makeHeavyIdle, medic: makeMedicIdle, villager1: makeVillager1Idle, villager2: makeVillager2Idle, guide: makeGuideIdle, radioop: makeRadioOpIdle, squidrobot: makeSquidRobotIdle, kraken: makeKrakenIdle, osprey: makeOspreyIdle };
export const runMakers = { commando: makeCommandoRun, scout: makeScoutRun, heavy: makeHeavyRun, medic: makeMedicRun, villager1: makeVillager1Run, villager2: makeVillager2Run, guide: makeGuideRun, radioop: makeRadioOpRun, squidrobot: makeSquidRobotRun, kraken: makeKrakenRun, osprey: makeOspreyRun };
