// powerups.js
// Powerup system for GalacticBrow

export const powerups = [];

// Types of powerups
export const POWERUP_TYPES = [
  {
    type: 'double_laser',
    color: 'aqua',
    description: 'Double Lasers: Fire two extra lasers per shot.'
  },
  {
    type: 'spread_shot',
    color: 'orange',
    description: 'Spread Shot: Fire in a wide arc.'
  },
  {
    type: 'piercing',
    color: 'lime',
    description: 'Piercing: Lasers go through enemies.'
  },
  {
    type: 'rapid_fire',
    color: 'magenta',
    description: 'Rapid Fire: Much faster fire rate.'
  },
  {
    type: 'giant_laser',
    color: 'yellow',
    description: 'Giant Laser: Fires a huge, powerful laser.'
  }
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
