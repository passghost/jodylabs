// enemyweapons.js
// New enemy weapon types for GalacticBrow

// Each weapon type has: name, fire function, color, speed, damage, and pattern
export const enemyWeaponTypes = [
  {
    name: 'basic_laser',
    color: 'red',
    speed: 8,
    damage: 8,
    fire: (enemy, projectiles) => {
      // Shoots a single straight laser
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 2,
        y: enemy.y,
        dx: 0,
        dy: -8,
        width: 4,
        height: 18,
        color: 'red',
        damage: 8,
        type: 'basic_laser'
      });
    }
  },
  {
    name: 'spread_shot',
    color: 'orange',
    speed: 7,
    damage: 5,
    fire: (enemy, projectiles) => {
      // Shoots 3 lasers in a spread
      [-0.25, 0, 0.25].forEach(angle => {
        projectiles.push({
          x: enemy.x + enemy.width / 2 - 2,
          y: enemy.y,
          dx: 7 * Math.sin(angle),
          dy: -7 * Math.cos(angle),
          width: 4,
          height: 16,
          color: 'orange',
          damage: 5,
          type: 'spread_shot'
        });
      });
    }
  },
  {
    name: 'piercing_beam',
    color: 'lime',
    speed: 10,
    damage: 12,
    fire: (enemy, projectiles) => {
      // Fast, thin, piercing shot
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 1,
        y: enemy.y,
        dx: 0,
        dy: -10,
        width: 2,
        height: 28,
        color: 'lime',
        damage: 12,
        piercing: true,
        type: 'piercing_beam'
      });
    }
  },
  {
    name: 'arc_blast',
    color: 'cyan',
    speed: 6,
    damage: 7,
    fire: (enemy, projectiles) => {
      // Shoots 5 lasers in an arc
      for (let i = -2; i <= 2; i++) {
        const angle = i * 0.18;
        projectiles.push({
          x: enemy.x + enemy.width / 2 - 2,
          y: enemy.y,
          dx: 6 * Math.sin(angle),
          dy: -6 * Math.cos(angle),
          width: 3,
          height: 14,
          color: 'cyan',
          damage: 7,
          type: 'arc_blast'
        });
      }
    }
  },
  {
    name: 'bomb',
    color: 'yellow',
    speed: 4,
    damage: 18,
    fire: (enemy, projectiles) => {
      // Slow, big bomb
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 8,
        y: enemy.y,
        dx: 0,
        dy: -4,
        width: 16,
        height: 16,
        color: 'yellow',
        damage: 18,
        type: 'bomb',
        splash: 1 // splash damage radius
      });
    }
  },
  {
    name: 'zigzag',
    color: 'magenta',
    speed: 7,
    damage: 6,
    fire: (enemy, projectiles) => {
      // Zigzagging laser
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 2,
        y: enemy.y,
        dx: Math.random() < 0.5 ? -3 : 3,
        dy: -7,
        width: 4,
        height: 16,
        color: 'magenta',
        damage: 6,
        zigzag: true,
        type: 'zigzag'
      });
    }
  },
  {
    name: 'homing_missile',
    color: 'white',
    speed: 5,
    damage: 15,
    fire: (enemy, projectiles, playerX, playerY) => {
      // Missile that homes in on the player
      const dx = playerX - (enemy.x + enemy.width / 2);
      const dy = playerY - enemy.y;
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 5,
        y: enemy.y,
        dx: 5 * dx / mag,
        dy: 5 * dy / mag,
        width: 10,
        height: 10,
        color: 'white',
        damage: 15,
        homing: true,
        type: 'homing_missile',
        target: { x: playerX, y: playerY }
      });
    }
  }
];

// Helper to pick a random weapon type
export function getRandomEnemyWeapon() {
  return enemyWeaponTypes[Math.floor(Math.random() * enemyWeaponTypes.length)];
}
