// gibs module: small particle fragments used by many systems
export const gibs = [];

export function spawnGibs(x, y, color = '#fff', count = 8, triggerShake){
  for (let i = 0; i < count; i++){
    const ang = Math.random() * Math.PI * 2;
    const sp = 80 + Math.random() * 260;
    const vx = Math.cos(ang) * sp;
    const vy = Math.sin(ang) * sp;
    const px = x + (Math.random() - 0.5) * 6;
    const py = y + (Math.random() - 0.5) * 6;
    const useRed = Math.random() < 0.25;
    const col = useRed ? '#ff3b30' : color;
    gibs.push({ x: px, y: py, vx, vy, life: 0.5 + Math.random() * 0.9, size: 1 + Math.random() * 2, color: col });
  }
  if (typeof triggerShake === 'function') triggerShake(12, 0.18);
}

export function updateGibs(dt){
  for (let i = gibs.length - 1; i >= 0; i--){
    const p = gibs[i];
    // fragment with drawn image
    if (p.src){
      p.vy += (p.gravity || 0) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.rot = (p.rot || 0) + (p.vr || 0) * dt;
      p.life -= dt; if (p.life <= 0) gibs.splice(i,1);
      continue;
    }
    // simple colored particle
    p.x += (p.vx || 0) * dt; p.y += (p.vy || 0) * dt;
    // light air drag
    p.vx *= (1 - 1.8 * dt);
    p.vy *= (1 - 1.8 * dt);
    p.life -= dt; if (p.life <= 0) gibs.splice(i,1);
  }
}

export function drawGibs(ctx, worldToScreen, camera){
  for (const p of gibs){
    const ss = worldToScreen(p.x, p.y);
    const sx = ss.x, sy = ss.y;
    if (p.src){
      // draw image fragment: account for rotation and scale (assume 1x pixel scale)
      ctx.save(); ctx.translate(sx, sy); ctx.rotate(p.rot || 0);
      const scale = (camera && camera.zoom) ? camera.zoom * (p.scale || 1) : (p.scale || 1);
      ctx.scale(scale, scale);
      ctx.drawImage(p.src, p.sx, p.sy, p.sw, p.sh, Math.round(-p.sw/2), Math.round(-p.sh/2), p.sw, p.sh);
      ctx.restore();
      continue;
    }
    ctx.fillStyle = p.color || '#fff';
    const size = Math.max(1, Math.round((p.size || 1) * (camera && camera.zoom ? camera.zoom : 1)));
    ctx.fillRect(Math.round(sx), Math.round(sy), size, size);
  }
}
