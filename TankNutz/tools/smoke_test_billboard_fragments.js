// Smoke test for billboard fragment physics (node-friendly simulation)
// Re-implements spawn and update logic from js/billboard.js to validate behavior.

function rand() { return Math.random(); }
function seedRand(s){ let x = Math.sin(s) * 10000; return () => { x = Math.sin(x) * 10000; return x - Math.floor(x); }; }

function spawnFragments({count=16, sFactor=1, bbx=200, bby=200} = {}){
  const sCap = Math.min(sFactor,4);
  const chunks = [];
  const palette = ['#cfd6e3','#f3f7ff','#5b6673','#2f3640','#1b2026'];
  for(let i=0;i<count;i++){
    let w,h; const rsize = Math.random();
    if (rsize < 0.30){ w = Math.floor(Math.random()*2)+2; h = Math.floor(Math.random()*2)+2; }
    else if (rsize < 0.80){ w = Math.floor(Math.random()*4)+5; h = Math.floor(Math.random()*4)+5; }
    else { w = Math.floor(Math.random()*12)+10; h = Math.floor(Math.random()*12)+10; }
    const rx = (Math.random()-0.5) * (48 * sCap);
    const ry = - (12 + Math.random() * 28 * sCap);
    const x = bbx + rx; const y = bby + ry;
    const vx = (Math.random()-0.5) * (1.0 + sCap * 0.6);
    const vy = - (2 + Math.random()*4) * (0.9 + sCap * 0.2);
    const ch = { x, y, ox: x, y0:y, y_init:y, y_orig:y, yv:vy, yv0:vy, vx, vy, w, h, _seed: Math.random(), _landed:false, settled:false };
    chunks.push(ch);
  }
  return chunks;
}

function simulate(chunks, options={steps:600, dt:1/60, fragGroundY: 220, sFactor:1}){
  const dt = options.dt || 1/60;
  const GRAV = 0.55; const gStep = GRAV * (dt * 60);
  const s = options.sFactor || 1;
  const sCapLoc = Math.min(s,4);
  const results = [];

  for(let step=0; step<options.steps; step++){
    for(const ch of chunks){
      if (ch._landed){
        // horizontal slide only
        ch.vx *= Math.max(0, 1 - (0.12 + 0.02 * sCapLoc) * (dt * 60));
        ch.x += ch.vx * (dt * 60);
        if (Math.abs(ch.vx) <= 0.03){ ch.vx = 0; ch.settled = true; }
        continue;
      }
      // in-air drag
      const airDrag = 0.06 + 0.02 * sCapLoc;
      ch.vx *= Math.max(0, 1 - airDrag * (dt * 60));
      const maxVx = 1.6 + sCapLoc * 0.6;
      if (ch.vx > maxVx) ch.vx = maxVx; if (ch.vx < -maxVx) ch.vx = -maxVx;

      ch.vy += gStep;
      ch.x += ch.vx * (dt * 60);
      ch.y += ch.vy * (dt * 60);
      if (ch.y + ch.h >= options.fragGroundY){
        const localRand = Math.abs(Math.sin((ch._seed || 0.5) * 12.9898 + ch.ox * 0.017));
        const maxVertJitter = Math.min(24, Math.max(2, Math.round(ch.h * 1.2)));
        const vjit = Math.round(localRand * maxVertJitter);
        ch.y = options.fragGroundY - ch.h - vjit;
        ch.vy = 0; // stop vertical bounce
        ch.vx += (localRand - 0.5) * (0.6 + s * 0.25);
        const landMaxVx = 1.2 + s * 0.6;
        if (ch.vx > landMaxVx) ch.vx = landMaxVx;
        if (ch.vx < -landMaxVx) ch.vx = -landMaxVx;
        ch.vx *= 0.45;
        ch._landed = true;
      }
    }
  }
  return chunks;
}

function analyze(chunks){
  let unsettled = 0; let maxTravel = 0; let avgYRange = 0;
  for(const ch of chunks){
    if (!ch.settled && ch._landed && Math.abs(ch.vx) > 0.03) unsettled++;
    const travel = Math.abs(ch.x - ch.ox);
    if (travel > maxTravel) maxTravel = travel;
    avgYRange += ch.ox; // dummy reuse
  }
  return { count: chunks.length, unsettled, maxTravel };
}

// run several scenarios
function runScenario(sFactor){
  console.log('--- Scenario sFactor=', sFactor, '---');
  const chunks = spawnFragments({count: Math.max(16, Math.round(16 * Math.min(sFactor,4))), sFactor: sFactor, bbx:200, bby:200});
  const sim = simulate(chunks, {steps:600, dt:1/60, fragGroundY: 240, sFactor: sFactor});
  const res = analyze(sim);
  console.log('res:', res);
  // print sample fragments
  for(let i=0;i<Math.min(6, sim.length); i++){
    const c = sim[i];
    console.log(i, 'ox', Math.round(c.ox), 'x', Math.round(c.x), 'vx', c.vx.toFixed(2), 'landed', !!c._landed, 'settled', !!c.settled);
  }
}

runScenario(1);
runScenario(2.4);
runScenario(3.6);

console.log('Done');
