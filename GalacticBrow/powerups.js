// powerups.js
// Powerup system for GalacticBrow

export const powerups = [];

// Types of powerups
export const POWERUP_TYPES = [
  // 5 tiers for each powerup type
  ...[1,2,3,4,5].map(i => ({
    type: 'double_laser' + (i > 1 ? '_' + i : ''),
    color: ['aqua','#00e6e6','#00bfff','#0099ff','#0055ff'][i-1],
    description: `Double Lasers Tier ${i}`
  })),
  ...[1,2,3,4,5].map(i => ({
    type: 'spread_shot' + (i > 1 ? '_' + i : ''),
    color: ['orange','#ffb347','#ff9900','#ff6600','#ff3300'][i-1],
    description: `Spread Shot Tier ${i}`
  })),
  ...[1,2,3,4,5].map(i => ({
    type: 'piercing' + (i > 1 ? '_' + i : ''),
    color: ['lime','#66ff66','#00ff99','#00ffcc','#00ffff'][i-1],
    description: `Piercing Tier ${i}`
  })),
  ...[1,2,3,4,5].map(i => ({
    type: 'rapid_fire' + (i > 1 ? '_' + i : ''),
    color: ['magenta','#ff66cc','#ff33cc','#ff00cc','#cc00ff'][i-1],
    description: `Rapid Fire Tier ${i}`
  })),
  ...[1,2,3,4,5].map(i => ({
    type: 'giant_laser' + (i > 1 ? '_' + i : ''),
    color: ['yellow','#fff700','#fff200','#ffe600','#fff'][i-1],
    description: `Giant Laser Tier ${i}`
  })),
];

// Spawn a powerup at (x, y) with random type
export function spawnPowerup(x, y) {
  const typeObj = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
  powerups.push({
    x,
    y,
    type: typeObj.type,
    color: typeObj.color,
    vy: 3 + Math.random() * 2,
    width: 28,
    height: 28,
    active: true
  });
}

// Update powerup positions
export function updatePowerups(canvas) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    p.y += p.vy;
    if (p.y > canvas.height + 30) {
      powerups.splice(i, 1);
    }
  }
}

// Draw powerups
export function drawPowerups(ctx) {
  powerups.forEach(p => {
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.shadowBlur = 16;
    ctx.shadowColor = p.color;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x + p.width/2, p.y + p.height/2, p.width/2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = '#222';
    ctx.textAlign = 'center';
    ctx.fillText(p.type[0].toUpperCase(), p.x + p.width/2, p.y + p.height/2 + 6);
    ctx.restore();
  });
}

// Check if player collects a powerup
export function checkPowerupCollection(shipX, shipY, shipWidth, shipHeight, onCollect) {
  for (let i = powerups.length - 1; i >= 0; i--) {
    const p = powerups[i];
    if (
      p.x < shipX + shipWidth &&
      p.x + p.width > shipX &&
      p.y < shipY + shipHeight &&
      p.y + p.height > shipY
    ) {
      if (onCollect) onCollect(p.type);
      powerups.splice(i, 1);
    }
  }
}
