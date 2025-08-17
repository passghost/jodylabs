export function initVibe(container){
  if(!container) return;
  // stop any previous vibe instance attached to this container
  try{
    if(container.__vibe && typeof container.__vibe.stop === 'function'){
      container.__vibe.stop();
    }
  }catch(e){}

  // create or reuse a full-size canvas
  let canvas = container.querySelector('canvas.vibe-canvas');
  if (!canvas) canvas = document.createElement('canvas');
  canvas.className = 'vibe-canvas';
  // keep canvas visually behind content (CSS also handles this)
  canvas.style.position = 'absolute';
  canvas.style.inset = '0';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.pointerEvents = 'none';
  container.appendChild(canvas);
  const ctx = canvas.getContext('2d');

  function resize(){
    // protect against container being removed
    try{
      canvas.width = Math.max(1, container.clientWidth);
      canvas.height = Math.max(1, container.clientHeight);
    }catch(e){}
  }
  const onResize = resize;
  window.addEventListener('resize', onResize);
  resize();

  let mouse = {x: canvas.width/2, y: canvas.height/2};
  const onPointer = (e)=>{
    const r = canvas.getBoundingClientRect();
    mouse.x = e.clientX - r.left;
    mouse.y = e.clientY - r.top;
  };
  window.addEventListener('pointermove', onPointer);

  let rafId = null;
  let running = true;
  // throttle to ~30fps to reduce CPU on slower devices
  const FPS = 30;
  const FRAME_INTERVAL = 1000 / FPS;
  let lastFrame = performance.now();

  function step(now){
    if(!running) return;
    if(!ctx) return;
    if (!now) now = performance.now();
    const dt = now - lastFrame;
    if (dt >= FRAME_INTERVAL) {
      lastFrame = now - (dt % FRAME_INTERVAL);
      ctx.clearRect(0,0,canvas.width,canvas.height);
      // subtle background gradient
      const g = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
      g.addColorStop(0,'rgba(6,10,20,0.6)');
      g.addColorStop(1,'rgba(16,22,40,0.6)');
      ctx.fillStyle = g;
      ctx.fillRect(0,0,canvas.width,canvas.height);
    }
    rafId = requestAnimationFrame(step);
  }
  rafId = requestAnimationFrame(step);

  function stop(){
    running = false;
    if(rafId) cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    window.removeEventListener('pointermove', onPointer);
    try{ canvas.remove(); }catch(e){}
    try{ delete container.__vibe; }catch(e){}
  }

  container.__vibe = { stop };
  return { stop };
}
