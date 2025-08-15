export function initVibe(container){
  // create a full-size canvas
  const canvas = document.createElement('canvas');
  canvas.className = 'vibe-canvas';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize(){
    canvas.width = container.clientWidth;
    canvas.height = container.clientHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  let mouse = {x: canvas.width/2, y: canvas.height/2};
  window.addEventListener('pointermove', (e)=>{
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  });

  // simple particles that follow the pointer for a "vibe" effect
  const particles = [];
  for(let i=0;i<28;i++) particles.push({x:Math.random()*canvas.width,y:Math.random()*canvas.height, vx:0, vy:0, r: 6+Math.random()*18});

  function step(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // subtle background gradient
    const g = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
    g.addColorStop(0,'rgba(6,10,20,0.6)');
    g.addColorStop(1,'rgba(16,22,40,0.6)');
    ctx.fillStyle = g;
    ctx.fillRect(0,0,canvas.width,canvas.height);

    for(const p of particles){
      const dx = mouse.x - p.x, dy = mouse.y - p.y;
      p.vx += dx * 0.0015;
      p.vy += dy * 0.0015;
      p.vx *= 0.95; p.vy *= 0.95;
      p.x += p.vx; p.y += p.vy;

      const dist = Math.hypot(dx,dy);
      const alpha = Math.max(0.08, 1 - dist / 600);

      // glow
      ctx.beginPath();
      const rg = ctx.createRadialGradient(p.x,p.y,p.r*0.1,p.x,p.y,p.r*4);
      rg.addColorStop(0, `rgba(160,200,255,${alpha})`);
      rg.addColorStop(1, `rgba(80,100,150,0)`);
      ctx.fillStyle = rg;
      ctx.arc(p.x,p.y,p.r*4,0,Math.PI*2);
      ctx.fill();

      // core circle
      ctx.beginPath();
      ctx.fillStyle = `rgba(200,230,255,${0.6*alpha})`;
      ctx.arc(p.x,p.y,p.r*0.5,0,Math.PI*2);
      ctx.fill();
    }

    requestAnimationFrame(step);
  }
  step();
}
