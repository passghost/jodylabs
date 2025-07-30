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
      // Bigger enemies have wider spreads
      const spreadMultiplier = enemy.type === 'small' ? 0.8 : enemy.type === 'medium' ? 1.2 : 1.8;
      const shotCount = enemy.type === 'small' ? 3 : enemy.type === 'medium' ? 4 : 5;
      
      for (let i = 0; i < shotCount; i++) {
        const angle = ((i / (shotCount - 1)) - 0.5) * 0.6 * spreadMultiplier;
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
      }
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
      // Larger enemies have wider arcs and more shots
      const arcMultiplier = enemy.type === 'small' ? 0.8 : enemy.type === 'medium' ? 1.2 : 1.6;
      const shotCount = enemy.type === 'small' ? 3 : enemy.type === 'medium' ? 5 : 7;
      
      for (let i = 0; i < shotCount; i++) {
        const angle = ((i / (shotCount - 1)) - 0.5) * 0.8 * arcMultiplier;
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
    fire: (enemy, projectiles, playerX, playerY) => {
      // Slow, big bomb that tracks player
      const dx = playerX - (enemy.x + enemy.width / 2);
      const dy = playerY - enemy.y;
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 8,
        y: enemy.y,
        dx: 3 * dx / mag,
        dy: 3 * dy / mag,
        width: 16,
        height: 16,
        color: 'yellow',
        damage: 18,
        type: 'bomb',
        homing: true,
        target: { x: playerX, y: playerY },
        sourceEnemy: enemy,
        chafeConfused: false,
        confusionTimer: 0,
        splash: 1 // splash damage radius
      });
    }
  },
  {
    name: 'zigzag',
    color: 'magenta',
    speed: 7,
    damage: 6,
    fire: (enemy, projectiles, playerX, playerY) => {
      // Zigzagging laser that loosely tracks player
      const dx = playerX - (enemy.x + enemy.width / 2);
      const dy = playerY - enemy.y;
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 2,
        y: enemy.y,
        dx: 4 * dx / mag + (Math.random() < 0.5 ? -3 : 3),
        dy: 4 * dy / mag,
        width: 4,
        height: 16,
        color: 'magenta',
        damage: 6,
        zigzag: true,
        homing: true,
        type: 'zigzag',
        target: { x: playerX, y: playerY },
        sourceEnemy: enemy,
        chafeConfused: false,
        confusionTimer: 0
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
        target: { x: playerX, y: playerY },
        sourceEnemy: enemy, // Reference to the enemy that fired it
        chafeConfused: false,
        confusionTimer: 0
      });
    }
  },
  {
    name: 'seeker_drone',
    color: 'cyan',
    speed: 4,
    damage: 12,
    fire: (enemy, projectiles, playerX, playerY) => {
      // Slower but more persistent tracking
      const dx = playerX - (enemy.x + enemy.width / 2);
      const dy = playerY - enemy.y;
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 6,
        y: enemy.y,
        dx: 4 * dx / mag,
        dy: 4 * dy / mag,
        width: 12,
        height: 12,
        color: 'cyan',
        damage: 12,
        homing: true,
        type: 'seeker_drone',
        target: { x: playerX, y: playerY },
        sourceEnemy: enemy,
        chafeConfused: false,
        confusionTimer: 0,
        fuel: 600 // Longer tracking time
      });
    }
  },
  {
    name: 'plasma_tracker',
    color: 'purple',
    speed: 6,
    damage: 10,
    fire: (enemy, projectiles, playerX, playerY) => {
      // Purple plasma that tracks player aggressively
      const dx = playerX - (enemy.x + enemy.width / 2);
      const dy = playerY - enemy.y;
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 4,
        y: enemy.y,
        dx: 6 * dx / mag,
        dy: 6 * dy / mag,
        width: 8,
        height: 8,
        color: 'purple',
        damage: 10,
        homing: true,
        type: 'plasma_tracker',
        target: { x: playerX, y: playerY },
        sourceEnemy: enemy,
        chafeConfused: false,
        confusionTimer: 0,
        fuel: 480 // 8 seconds of tracking
      });
    }
  },
  {
    name: 'rapid_burst',
    color: '#ff6600',
    speed: 9,
    damage: 4,
    fire: (enemy, projectiles) => {
      // Larger enemies fire more rapid shots with wider spread
      const burstCount = enemy.type === 'small' ? 3 : enemy.type === 'medium' ? 5 : 8;
      const spreadAmount = enemy.type === 'small' ? 1 : enemy.type === 'medium' ? 2 : 3;
      
      for (let i = 0; i < burstCount; i++) {
        setTimeout(() => {
          projectiles.push({
            x: enemy.x + enemy.width / 2 - 1,
            y: enemy.y,
            dx: (Math.random() - 0.5) * spreadAmount, // Bigger spread for larger enemies
            dy: -9,
            width: 2,
            height: 12,
            color: '#ff6600',
            damage: 4,
            type: 'rapid_burst'
          });
        }, i * 40); // Slightly faster for larger enemies
      }
    }
  },
  {
    name: 'wave_beam',
    color: '#ff00ff',
    speed: 6,
    damage: 8,
    fire: (enemy, projectiles) => {
      // Sine wave pattern laser
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 2,
        y: enemy.y,
        dx: 0,
        dy: -6,
        width: 4,
        height: 16,
        color: '#ff00ff',
        damage: 8,
        type: 'wave_beam',
        waveAmplitude: 30,
        waveFreq: 0.1,
        waveOffset: Math.random() * Math.PI * 2
      });
    }
  },
  {
    name: 'spiral_shot',
    color: '#00ff88',
    speed: 7,
    damage: 6,
    fire: (enemy, projectiles) => {
      // Larger enemies create more complex spiral patterns
      const shotCount = enemy.type === 'small' ? 2 : enemy.type === 'medium' ? 3 : 4;
      const spiralIntensity = enemy.type === 'small' ? 1 : enemy.type === 'medium' ? 1.5 : 2;
      
      for (let i = 0; i < shotCount; i++) {
        const angle = (i / shotCount) * Math.PI * 2;
        projectiles.push({
          x: enemy.x + enemy.width / 2 - 2,
          y: enemy.y,
          dx: Math.sin(angle) * 3 * spiralIntensity,
          dy: -7 + Math.cos(angle) * 2 * spiralIntensity,
          width: 3,
          height: 14,
          color: '#00ff88',
          damage: 6,
          type: 'spiral_shot',
          spiralSpeed: 0.15 * spiralIntensity,
          spiralRadius: 2 * spiralIntensity
        });
      }
    }
  },
  {
    name: 'prediction_laser',
    color: '#ffff00',
    speed: 12,
    damage: 10,
    fire: (enemy, projectiles, playerX, playerY) => {
      // Predicts player movement and fires ahead
      const playerVX = window.shipVX || 0;
      const playerVY = window.shipVY || 0;
      
      // Predict where player will be
      const predictionTime = 30; // frames ahead
      const predictedX = playerX + playerVX * predictionTime;
      const predictedY = playerY + playerVY * predictionTime;
      
      const dx = predictedX - (enemy.x + enemy.width / 2);
      const dy = predictedY - enemy.y;
      const mag = Math.sqrt(dx*dx + dy*dy) || 1;
      
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 2,
        y: enemy.y,
        dx: 12 * dx / mag,
        dy: 12 * dy / mag,
        width: 3,
        height: 20,
        color: '#ffff00',
        damage: 10,
        type: 'prediction_laser'
      });
    }
  },
  {
    name: 'cluster_bomb',
    color: '#ff4444',
    speed: 5,
    damage: 6,
    fire: (enemy, projectiles) => {
      // Main projectile that splits into smaller ones
      projectiles.push({
        x: enemy.x + enemy.width / 2 - 6,
        y: enemy.y,
        dx: 0,
        dy: -5,
        width: 12,
        height: 12,
        color: '#ff4444',
        damage: 6,
        type: 'cluster_bomb',
        splitTimer: 60, // Split after 1 second
        hasSplit: false
      });
    }
  }
];

// Boss-specific weapon patterns - absolute bullet hell
export const bossPatternsLevel1 = [
  {
    name: 'boss_spiral_barrage',
    fire: (boss, projectiles, playerX, playerY) => {
      // Massive spiral of projectiles
      for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 + Date.now() * 0.01;
        projectiles.push({
          x: boss.x + boss.width / 2,
          y: boss.y + boss.height / 2,
          dx: Math.cos(angle) * 6,
          dy: Math.sin(angle) * 6,
          width: 6,
          height: 6,
          color: '#ff0066',
          damage: 8,
          type: 'boss_spiral'
        });
      }
    }
  },
  {
    name: 'boss_wave_assault',
    fire: (boss, projectiles, playerX, playerY) => {
      // Wave of projectiles across screen
      for (let i = 0; i < 8; i++) {
        const spreadX = (i - 3.5) * 60;
        projectiles.push({
          x: boss.x + boss.width / 2 + spreadX,
          y: boss.y + boss.height,
          dx: spreadX * 0.05,
          dy: 8,
          width: 8,
          height: 16,
          color: '#ff4400',
          damage: 10,
          type: 'boss_wave'
        });
      }
    }
  }
];

export const bossPatternsLevel2 = [
  {
    name: 'boss_cross_pattern',
    fire: (boss, projectiles, playerX, playerY) => {
      // Cross pattern with rotating arms
      const rotation = Date.now() * 0.005;
      for (let arm = 0; arm < 4; arm++) {
        const baseAngle = (arm * Math.PI / 2) + rotation;
        for (let i = 0; i < 5; i++) {
          const angle = baseAngle + (i - 2) * 0.3;
          projectiles.push({
            x: boss.x + boss.width / 2,
            y: boss.y + boss.height / 2,
            dx: Math.cos(angle) * 7,
            dy: Math.sin(angle) * 7,
            width: 5,
            height: 5,
            color: '#ff00ff',
            damage: 9,
            type: 'boss_cross'
          });
        }
      }
    }
  }
];

export const bossPatternsLevel3 = [
  {
    name: 'boss_chaos_storm',
    fire: (boss, projectiles, playerX, playerY) => {
      // Absolute chaos - random projectiles everywhere
      for (let i = 0; i < 20; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 4 + Math.random() * 6;
        projectiles.push({
          x: boss.x + boss.width / 2 + (Math.random() - 0.5) * boss.width,
          y: boss.y + boss.height / 2 + (Math.random() - 0.5) * boss.height,
          dx: Math.cos(angle) * speed,
          dy: Math.sin(angle) * speed,
          width: 4 + Math.random() * 4,
          height: 4 + Math.random() * 4,
          color: ['#ff0000', '#ff4400', '#ff00ff', '#ffff00'][Math.floor(Math.random() * 4)],
          damage: 12,
          type: 'boss_chaos'
        });
      }
    }
  }
];

// Helper to pick a random weapon type
export function getRandomEnemyWeapon() {
  return enemyWeaponTypes[Math.floor(Math.random() * enemyWeaponTypes.length)];
}

// Get boss weapon pattern based on level
export function getBossWeaponPattern(level) {
  if (level <= 5) return bossPatternsLevel1[Math.floor(Math.random() * bossPatternsLevel1.length)];
  if (level <= 10) return bossPatternsLevel2[Math.floor(Math.random() * bossPatternsLevel2.length)];
  return bossPatternsLevel3[Math.floor(Math.random() * bossPatternsLevel3.length)];
}
