// critters.js - manages critters and animals as hittable enemies
export const CRITTER_SPR_SCALE = 3; // how many canvas pixels per SVG pixel
export const CRITTER_DRAW_BASE = 0.7; // was 0.9
export const ANIMAL_DRAW_BASE = 0.6;  // reduced so animals render smaller (was 1.35)

export let critters = []; // sprite-based wandering critters (decorative)
export let animals = []; // additional small animals distributed like critters
let __nextCritterId = 1; // unique id per critter instance for individual journal entries

// Critter sprites (from 8_pixel_jungle_critters.html)
function makeSpriteCanvas(specs, scale=3){
  const c = document.createElement('canvas');
  c.width = 8*scale; c.height = 8*scale;
  const g = c.getContext('2d');
  // ensure a predictable composite mode so fills always write opaque pixels
  g.globalCompositeOperation = 'source-over';
  g.imageSmoothingEnabled = false;
  for (const r of specs){ g.fillStyle = r.fill; g.fillRect(r.x*scale, r.y*scale, r.w*scale, r.h*scale); }
  // defensive check: if the sprite canvas is completely transparent (some envs
  // can produce empty canvases), stamp a tiny visible probe pixel so the sprite
  // remains visible and easier to diagnose. This is non-destructive for normal
  // sprites because we only write a single 1x1 pixel when the canvas is empty.
  try{
    const data = g.getImageData(0,0,c.width,c.height).data;
    let hasOpaque = false;
    for (let i = 3; i < data.length; i += 4){ if (data[i] !== 0){ hasOpaque = true; break; } }
  if (!hasOpaque){ console.warn('makeSpriteCanvas: produced empty sprite (no probe stamped)'); }
  }catch(e){ /* reading imageData may throw in some contexts; ignore */ }
  return c;
}

const critterSpecs = [];
// Frog
critterSpecs.push([
  {x:1,y:2,w:6,h:4,fill:'#3bb273'}, {x:0,y:4,w:2,h:2,fill:'#2a8956'}, {x:6,y:4,w:2,h:2,fill:'#2a8956'}, {x:2,y:1,w:1,h:1,fill:'#ffffff'}, {x:5,y:1,w:1,h:1,fill:'#ffffff'}, {x:3,y:4,w:2,h:2,fill:'#84cc16'}, {x:2,y:6,w:4,h:1,fill:'#0b442b'}
]);
// Snake
critterSpecs.push([
  {x:1,y:3,w:5,h:1,fill:'#43b581'}, {x:1,y:2,w:1,h:2,fill:'#2e9d6d'}, {x:5,y:4,w:1,h:2,fill:'#2e9d6d'}, {x:2,y:5,w:4,h:1,fill:'#43b581'}, {x:6,y:4,w:1,h:1,fill:'#43b581'}, {x:7,y:4,w:1,h:1,fill:'#ff3b30'}
]);
// Parrot
critterSpecs.push([
  {x:2,y:2,w:3,h:3,fill:'#ef4444'}, {x:4,y:1,w:2,h:2,fill:'#ef4444'}, {x:2,y:3,w:2,h:1,fill:'#3b82f6'}, {x:1,y:4,w:1,h:2,fill:'#16a34a'}, {x:6,y:2,w:1,h:1,fill:'#f59e0b'}
]);
// Monkey
critterSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#8b5e3c'}, {x:3,y:1,w:2,h:2,fill:'#8b5e3c'}, {x:3,y:2,w:2,h:1,fill:'#d7b899'}
]);
// Jaguar
critterSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#f59e0b'}, {x:5,y:2,w:2,h:2,fill:'#f59e0b'}, {x:3,y:3,w:1,h:1,fill:'#222'}
]);
// Chameleon
critterSpecs.push([
  {x:1,y:3,w:5,h:2,fill:'#84cc16'}, {x:6,y:3,w:1,h:2,fill:'#84cc16'}, {x:2,y:2,w:3,h:1,fill:'#65a30d'}
]);
// Toucan
critterSpecs.push([
  {x:2,y:3,w:3,h:3,fill:'#0b0b0b'}, {x:4,y:2,w:2,h:2,fill:'#0b0b0b'}, {x:6,y:2,w:2,h:1,fill:'#facc15'}, {x:6,y:3,w:2,h:1,fill:'#fb923c'}
]);
// Beetle
critterSpecs.push([
  {x:3,y:2,w:2,h:4,fill:'#3b82f6'}, {x:2,y:3,w:1,h:3,fill:'#2563eb'}, {x:5,y:3,w:1,h:3,fill:'#2563eb'}
]);

export const critterSprites = critterSpecs.map(s=>makeSpriteCanvas(s, CRITTER_SPR_SCALE));

// Larger animal sprites (from 8_pixel_jungle_critters(2).html)
const largeAnimalSpecs = [];
largeAnimalSpecs.push([
  {x:1,y:2,w:6,h:4,fill:'#3bb273'}, {x:0,y:4,w:2,h:2,fill:'#2a8956'}, {x:6,y:4,w:2,h:2,fill:'#2a8956'}, {x:2,y:1,w:1,h:1,fill:'#ffffff'}, {x:5,y:1,w:1,h:1,fill:'#ffffff'}, {x:3,y:4,w:2,h:2,fill:'#84cc16'}, {x:2,y:6,w:4,h:1,fill:'#0b442b'}
]);
largeAnimalSpecs.push([
  {x:1,y:3,w:5,h:1,fill:'#43b581'}, {x:1,y:2,w:1,h:2,fill:'#2e9d6d'}, {x:5,y:4,w:1,h:2,fill:'#2e9d6d'}, {x:2,y:5,w:4,h:1,fill:'#43b581'}, {x:6,y:4,w:1,h:1,fill:'#43b581'}, {x:7,y:4,w:1,h:1,fill:'#ff3b30'}
]);
largeAnimalSpecs.push([
  {x:2,y:2,w:3,h:3,fill:'#ef4444'}, {x:4,y:1,w:2,h:2,fill:'#ef4444'}, {x:2,y:3,w:2,h:1,fill:'#3b82f6'}, {x:1,y:4,w:1,h:2,fill:'#16a34a'}, {x:6,y:2,w:1,h:1,fill:'#f59e0b'}
]);
largeAnimalSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#8b5e3c'}, {x:3,y:1,w:2,h:2,fill:'#8b5e3c'}, {x:3,y:2,w:2,h:1,fill:'#d7b899'}
]);
largeAnimalSpecs.push([
  {x:2,y:3,w:4,h:3,fill:'#f59e0b'}, {x:5,y:2,w:2,h:2,fill:'#f59e0b'}, {x:3,y:3,w:1,h:1,fill:'#222'}
]);
largeAnimalSpecs.push([
  {x:1,y:3,w:5,h:2,fill:'#84cc16'}, {x:6,y:3,w:1,h:2,fill:'#84cc16'}, {x:2,y:2,w:3,h:1,fill:'#65a30d'}
]);
largeAnimalSpecs.push([
  {x:2,y:3,w:3,h:3,fill:'#0b0b0b'}, {x:4,y:2,w:2,h:2,fill:'#0b0b0b'}, {x:6,y:2,w:2,h:1,fill:'#facc15'}, {x:6,y:3,w:2,h:1,fill:'#fb923c'}
]);
largeAnimalSpecs.push([
  {x:3,y:2,w:2,h:4,fill:'#3b82f6'}, {x:2,y:3,w:1,h:3,fill:'#2563eb'}, {x:5,y:3,w:1,h:3,fill:'#2563eb'}
]);

const largeAnimalSprites = largeAnimalSpecs.map(s => makeSpriteCanvas(s, 4));

export function initCritters(enemiesArray) {
  // Store reference to enemies array so we can add critters/animals to it
  critters = [];
  animals = [];
  __nextCritterId = 1;
}

export function spawnCritters(enemiesArray) {
  const CRITTER_COUNT = 84; // more critters for jungle life

  // Ensure critter sprite canvases are valid before spawning critters. Rebuild any invalid ones.
  for (let i = 0; i < critterSprites.length; i++){
    const s = critterSprites[i];
    if (!s || !s.width || !s.height){
      try{ critterSprites[i] = makeSpriteCanvas(critterSpecs[i], CRITTER_SPR_SCALE); }catch(e){ console.warn('spawnCritters: failed to rebuild sprite', i, e); }
    }
  }

  critters.length = 0;
  for (let i=0;i<CRITTER_COUNT;i++){
    const ang = Math.random()*Math.PI*2;
    const sidx = Math.floor(Math.random()*critterSprites.length);
    // create a per-instance tile canvas so the journal can display a unique image per critter
    let tileC = null;
    try{
      const spr = critterSprites[sidx];
      if (spr && spr.width && spr.height){
        tileC = document.createElement('canvas');
        tileC.width = spr.width; tileC.height = spr.height;
        const tctx = tileC.getContext('2d');
        tctx.drawImage(spr, 0, 0);
      }
    }catch(_){ tileC = null; }
    const uid = __nextCritterId++;
    const critter = {
      x: Math.random()*4000, // WORLD_W
      y: Math.random()*3000, // WORLD_H
      speed: 2 + Math.random()*4, // Much slower: 2-6 units/second instead of 8-30
      angle: ang,
      targetAngle: ang,
      changeAt: performance.now() + 800 + Math.random()*2200, // Change direction less frequently
      spriteIdx: sidx,
      kind: 'critter-' + uid,
      tileC: tileC,
      phase: Math.random()*Math.PI*2,
      bobAmp: 0.5 + Math.random()*1.5, // Smaller bobbing amplitude
      alive: true,
      type: 'critter', // Make critters hittable
      hp: 1, // Low hp for critters
      r: 8, // Radius for collision
      harmless: false,
      hopOffset: 0, // For hopping animation
      lastHop: performance.now(),
      hopFrequency: 200 + Math.random()*300 // Hop every 200-500ms
    };
    critters.push(critter);
    enemiesArray.push(critter); // Add to enemies array so they can be hit
  }
}

export function spawnAnimals(enemiesArray) {
  const ANIMAL_COUNT = 84; // same distribution/count as critters

  animals.length = 0;
  for (let i=0;i<ANIMAL_COUNT;i++){
    const ang = Math.random()*Math.PI*2;
    let sidx = Math.floor(Math.random()*critterSprites.length);
    if (sidx < 0 || sidx >= critterSprites.length) sidx = 0;
    // ensure sprite canvas is valid
    if (!critterSprites[sidx] || !critterSprites[sidx].width || !critterSprites[sidx].height){ try{ critterSprites[sidx] = makeSpriteCanvas(critterSpecs[sidx], CRITTER_SPR_SCALE); }catch(_){ sidx = 0; } }
    // create per-instance tile canvas for journal/icon if needed
    let tileC = null;
    try{
      const spr = critterSprites[sidx];
      if (spr && spr.width && spr.height){ tileC = document.createElement('canvas'); tileC.width = spr.width; tileC.height = spr.height; const tctx = tileC.getContext('2d'); tctx.drawImage(spr,0,0); }
    }catch(_){ tileC = null; }

    // Prefer larger animal sprite when available
    const largeTile = largeAnimalSprites[sidx] || tileC;

    const animal = {
      x: Math.random()*4000, // WORLD_W
      y: Math.random()*3000, // WORLD_H
      speed: 1.5 + Math.random()*3, // Much slower: 1.5-4.5 units/second instead of 6-24
      angle: ang,
      targetAngle: ang,
      changeAt: performance.now() + 1000 + Math.random()*2800, // Change direction less frequently
      spriteIdx: sidx,
      kind: 'animal-' + sidx,
      tileC: largeTile,
      phase: Math.random()*Math.PI*2,
      bobAmp: 0.4 + Math.random()*1.2, // Smaller bobbing amplitude
      alive: true,
      type: 'animal', // Make animals hittable
      hp: 2, // Medium hp for animals
      r: 10, // Radius for collision
      harmless: false,
      hopOffset: 0, // For hopping animation
      lastHop: performance.now(),
      hopFrequency: 300 + Math.random()*400 // Hop every 300-700ms
    };
    animals.push(animal);
    enemiesArray.push(animal); // Add to enemies array so they can be hit
  }
}

export function updateCritters(now) {
  for (let i = critters.length - 1; i >= 0; i--) {
    const c = critters[i];
    if (!c.alive) {
      critters.splice(i, 1);
      continue;
    }
    
    // Update hopping animation
    c.phase += 0.016 * 8; // Faster phase for more lively animation
    c.hopOffset = Math.sin(c.phase) * c.bobAmp * 2; // Vertical hopping motion
    
    // Check if it's time to hop/move
    if (now > c.lastHop + c.hopFrequency) {
      c.lastHop = now;
      
      // Occasionally change direction when hopping
      if (Math.random() < 0.3) { // 30% chance to change direction
        c.targetAngle = Math.random() * Math.PI * 2;
      }
      
      // Move a small distance when hopping
      const hopDistance = 8 + Math.random() * 12; // Hop 8-20 units
      c.x += Math.cos(c.angle) * hopDistance;
      c.y += Math.sin(c.angle) * hopDistance;
      
      // Update hop frequency for next hop (adds variety)
      c.hopFrequency = 200 + Math.random() * 300;
    }
    
    // Smooth turn toward targetAngle (very gradual)
    const da = (c.targetAngle - c.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    c.angle += da * 0.02; // Much slower turning
    
    // Wrap around world
    if (c.x < 0) c.x += 4000; // WORLD_W
    if (c.x > 4000) c.x -= 4000;
    if (c.y < 0) c.y += 3000; // WORLD_H
    if (c.y > 3000) c.y -= 3000;
  }
}

export function updateAnimals(now) {
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    if (!a.alive) {
      animals.splice(i, 1);
      continue;
    }
    
    // Update hopping animation
    a.phase += 0.016 * 6; // Slightly slower phase than critters
    a.hopOffset = Math.sin(a.phase) * a.bobAmp * 1.5; // Vertical hopping motion
    
    // Check if it's time to hop/move
    if (now > a.lastHop + a.hopFrequency) {
      a.lastHop = now;
      
      // Occasionally change direction when hopping
      if (Math.random() < 0.25) { // 25% chance to change direction
        a.targetAngle = Math.random() * Math.PI * 2;
      }
      
      // Move a small distance when hopping
      const hopDistance = 6 + Math.random() * 10; // Hop 6-16 units
      a.x += Math.cos(a.angle) * hopDistance;
      a.y += Math.sin(a.angle) * hopDistance;
      
      // Update hop frequency for next hop (adds variety)
      a.hopFrequency = 300 + Math.random() * 400;
    }
    
    // Smooth turn toward targetAngle (very gradual)
    const da = (a.targetAngle - a.angle + Math.PI * 3) % (Math.PI * 2) - Math.PI;
    a.angle += da * 0.015; // Even slower turning than critters
    
    // Wrap around world
    if (a.x < 0) a.x += 4000;
    if (a.x > 4000) a.x -= 4000;
    if (a.y < 0) a.y += 3000;
    if (a.y > 3000) a.y -= 3000;
  }
}

export function drawCritters(ctx, camera, now) {
  for (const c of critters) {
    if (!c.alive) continue;
    const dx = c.x - camera.x;
    const dy = wrapDeltaY(c.y, camera.y);
    const dist = Math.hypot(dx, dy);
    if (dist > 800) continue; // Only draw nearby critters

    const sx = camera.x + dx * camera.zoom;
    const sy = camera.y + dy * camera.zoom;
    const spr = critterSprites[c.spriteIdx];
    if (!spr) continue;

    const flip = Math.cos(c.angle) < 0;
    const bob = Math.sin(now * 0.003 + c.phase) * c.bobAmp;
    const drawScale = camera.zoom * CRITTER_DRAW_BASE;

    ctx.save();
    ctx.translate(sx, sy + bob);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(spr, -spr.width/2 * drawScale, -spr.height/2 * drawScale, spr.width * drawScale, spr.height * drawScale);
    ctx.restore();
  }
}

export function drawAnimals(ctx, camera, now) {
  for (const a of animals) {
    if (!a.alive) continue;
    const dx = a.x - camera.x;
    const dy = wrapDeltaY(a.y, camera.y);
    const dist = Math.hypot(dx, dy);
    if (dist > 800) continue; // Only draw nearby animals

    const sx = camera.x + dx * camera.zoom;
    const sy = camera.y + dy * camera.zoom;
    const spr = a.tileC || critterSprites[a.spriteIdx];
    if (!spr) continue;

    const flip = Math.cos(a.angle) < 0;
    const bob = Math.sin(now * 0.003 + a.phase) * a.bobAmp;
    const drawScale = camera.zoom * ANIMAL_DRAW_BASE;

    ctx.save();
    ctx.translate(sx, sy + bob);
    if (flip) ctx.scale(-1, 1);
    ctx.drawImage(spr, -spr.width/2 * drawScale, -spr.height/2 * drawScale, spr.width * drawScale, spr.height * drawScale);
    ctx.restore();
  }
}
