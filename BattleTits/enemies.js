// enemies.js
// Enhanced enemy system with multiple enemy types and variations

// Enemy sprite variations
export const pixelCommandoBlue = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","blueshirt2","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt2","empty","empty"],
  ["skin","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","rifle","rifle-barrel"],
  ["empty","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","empty","empty"],
  ["empty","bluepants","bluepants","empty","bluepants","bluepants","empty","bluepants","bluepants","empty"],
  ["empty","bluepants","bluepants","empty","bluepants","bluepants","empty","bluepants","bluepants","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

export const pixelCommandoGreen = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","greenshirt2","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt2","empty","empty"],
  ["skin","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","rifle","rifle-barrel"],
  ["empty","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","empty","empty"],
  ["empty","greenpants","greenpants","empty","greenpants","greenpants","empty","greenpants","greenpants","empty"],
  ["empty","greenpants","greenpants","empty","greenpants","greenpants","empty","greenpants","greenpants","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

export const pixelCommandoYellow = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","yellowshirt2","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt2","empty","empty"],
  ["skin","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","rifle","rifle-barrel"],
  ["empty","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","empty","empty"],
  ["empty","yellowpants","yellowpants","empty","yellowpants","yellowpants","empty","yellowpants","yellowpants","empty"],
  ["empty","yellowpants","yellowpants","empty","yellowpants","yellowpants","empty","yellowpants","yellowpants","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

// Heavy enemy variant (larger, more armored)
export const pixelHeavyEnemy = [
  ["empty","armor","armor","armor","armor","armor","armor","armor","armor","empty"],
  ["armor","armor","armor","helmet","helmet","helmet","helmet","armor","armor","armor"],
  ["armor","armor","empty","skin","skin","skin","skin","empty","armor","armor"],
  ["armor","redshirt2","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt2","armor","empty"],
  ["skin","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle","rifle-barrel"],
  ["armor","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","armor","empty"],
  ["armor","redpants","redpants","empty","redpants","redpants","empty","redpants","redpants","armor"],
  ["armor","redpants","redpants","empty","redpants","redpants","empty","redpants","redpants","armor"],
  ["empty","armor","boots","empty","empty","empty","empty","empty","boots","armor"],
  ["empty","armor","boots","empty","empty","empty","empty","empty","boots","armor"]
];

// Sniper enemy variant (longer rifle)
export const pixelSniperEnemy = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","redshirt2","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt2","empty","empty"],
  ["skin","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle","rifle-barrel"],
  ["empty","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle","rifle-barrel"],
  ["empty","redpants","redpants","empty","redpants","redpants","empty","redpants","redpants","empty"],
  ["empty","redpants","redpants","empty","redpants","redpants","empty","redpants","redpants","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

// Phantom Assassin (dark, mysterious)
export const pixelPhantomEnemy = [
  ["empty","empty","empty","armor","armor","armor","armor","empty","empty","empty"],
  ["empty","empty","armor","armor","armor","armor","armor","armor","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","armor","armor","armor","armor","armor","armor","armor","empty","empty"],
  ["skin","armor","armor","armor","armor","armor","armor","armor","rifle","rifle-barrel"],
  ["empty","armor","armor","armor","armor","armor","armor","armor","empty","empty"],
  ["empty","armor","armor","empty","armor","armor","empty","armor","armor","empty"],
  ["empty","armor","armor","empty","armor","armor","empty","armor","armor","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

// Berserker (bulky, aggressive)
export const pixelBerserkerEnemy = [
  ["armor","armor","armor","helmet","helmet","helmet","helmet","armor","armor","armor"],
  ["armor","armor","helmet","helmet","helmet","helmet","helmet","helmet","armor","armor"],
  ["armor","armor","armor","skin","skin","skin","skin","armor","armor","armor"],
  ["armor","redshirt2","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt2","armor","empty"],
  ["skin","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle","rifle-barrel"],
  ["armor","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","armor","empty"],
  ["armor","redpants","redpants","armor","redpants","redpants","armor","redpants","redpants","armor"],
  ["armor","redpants","redpants","armor","redpants","redpants","armor","redpants","redpants","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"]
];

// Cyber Ninja (sleek, tech-enhanced)
export const pixelCyberEnemy = [
  ["empty","empty","empty","armor","armor","armor","armor","empty","empty","empty"],
  ["empty","empty","armor","armor","armor","armor","armor","armor","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","blueshirt2","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt2","empty","empty"],
  ["skin","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","rifle","rifle-barrel"],
  ["empty","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","blueshirt","empty","empty"],
  ["empty","bluepants","bluepants","empty","bluepants","bluepants","empty","bluepants","bluepants","empty"],
  ["empty","bluepants","bluepants","empty","bluepants","bluepants","empty","bluepants","bluepants","empty"],
  ["empty","empty","armor","empty","empty","empty","empty","empty","armor","empty"],
  ["empty","empty","armor","empty","empty","empty","empty","empty","armor","empty"]
];

// Mutant Brute (grotesque, oversized)
export const pixelMutantEnemy = [
  ["armor","armor","armor","armor","armor","armor","armor","armor","armor","armor"],
  ["armor","armor","armor","helmet","helmet","helmet","helmet","armor","armor","armor"],
  ["armor","armor","armor","skin","skin","skin","skin","armor","armor","armor"],
  ["armor","greenshirt2","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt2","armor","armor"],
  ["skin","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","rifle","rifle-barrel"],
  ["armor","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","greenshirt","armor","armor"],
  ["armor","greenpants","greenpants","armor","greenpants","greenpants","armor","greenpants","greenpants","armor"],
  ["armor","greenpants","greenpants","armor","greenpants","greenpants","armor","greenpants","greenpants","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"]
];

// Ghost Operative (translucent, ethereal)
export const pixelGhostEnemy = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","shirt2","shirt","shirt","shirt","shirt","shirt","shirt2","empty","empty"],
  ["skin","shirt","shirt","shirt","shirt","shirt","shirt","shirt","rifle","rifle-barrel"],
  ["empty","shirt","shirt","shirt","shirt","shirt","shirt","shirt","empty","empty"],
  ["empty","pants","pants","empty","pants","pants","empty","pants","pants","empty"],
  ["empty","pants","pants","empty","pants","pants","empty","pants","pants","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

// Enemy type definitions
export const enemyTypes = [
  {
    name: 'Basic Infantry',
    sprite: 'red',
    health: 50,
    speed: 1.5,
    damage: 10,
    attackRange: 120,
    attackRate: 1800,
    points: 100,
    rarity: 0.4,
    projectileColor: '#ff4444',
    projectileSpeed: 3
  },
  {
    name: 'Fast Scout',
    sprite: 'blue',
    health: 30,
    speed: 2.5,
    damage: 8,
    attackRange: 100,
    attackRate: 1200,
    points: 120,
    rarity: 0.25,
    projectileColor: '#4444ff',
    projectileSpeed: 4
  },
  {
    name: 'Elite Soldier',
    sprite: 'green',
    health: 70,
    speed: 1.8,
    damage: 15,
    attackRange: 140,
    attackRate: 1500,
    points: 150,
    rarity: 0.2,
    projectileColor: '#44ff44',
    projectileSpeed: 3.5
  },
  {
    name: 'Heavy Trooper',
    sprite: 'heavy',
    health: 120,
    speed: 1.0,
    damage: 20,
    attackRange: 100,
    attackRate: 2000,
    points: 200,
    rarity: 0.1,
    projectileColor: '#ff8844',
    projectileSpeed: 2.5
  },
  {
    name: 'Sniper',
    sprite: 'sniper',
    health: 40,
    speed: 0.8,
    damage: 25,
    attackRange: 200,
    attackRate: 3000,
    points: 180,
    rarity: 0.05,
    projectileColor: '#ffff44',
    projectileSpeed: 6
  },
  {
    name: 'Phantom Assassin',
    sprite: 'phantom',
    health: 60,
    speed: 2.2,
    damage: 30,
    attackRange: 80,
    attackRate: 1800,
    points: 250,
    rarity: 0.12,
    projectileColor: '#8000ff',
    projectileSpeed: 5,
    special: 'teleport'
  },
  {
    name: 'Berserker',
    sprite: 'berserker',
    health: 150,
    speed: 1.8,
    damage: 35,
    attackRange: 60,
    attackRate: 800,
    points: 300,
    rarity: 0.08,
    projectileColor: '#ff0080',
    projectileSpeed: 4,
    special: 'rage'
  },
  {
    name: 'Cyber Ninja',
    sprite: 'cyber',
    health: 80,
    speed: 2.5,
    damage: 20,
    attackRange: 120,
    attackRate: 1200,
    points: 220,
    rarity: 0.15,
    projectileColor: '#00ffff',
    projectileSpeed: 7,
    special: 'dash'
  },
  {
    name: 'Mutant Brute',
    sprite: 'mutant',
    health: 200,
    speed: 0.6,
    damage: 40,
    attackRange: 100,
    attackRate: 2500,
    points: 400,
    rarity: 0.06,
    projectileColor: '#80ff00',
    projectileSpeed: 3,
    special: 'toxic'
  },
  {
    name: 'Ghost Operative',
    sprite: 'ghost',
    health: 50,
    speed: 1.5,
    damage: 22,
    attackRange: 150,
    attackRate: 2000,
    points: 280,
    rarity: 0.10,
    projectileColor: '#ffffff',
    projectileSpeed: 4,
    special: 'phase'
  }
];

export function createEnemy(wave) {
  // Weighted random selection based on rarity and wave
  const availableTypes = enemyTypes.filter(type => {
    // Some enemies only appear in later waves (but allow most from start)
    if (type.name === 'Heavy Trooper' && wave < 2) return false;
    if (type.name === 'Sniper' && wave < 3) return false;
    if (type.name === 'Mutant Brute' && wave < 4) return false;
    return true;
  });
  
  const rand = Math.random();
  let cumulative = 0;
  let selectedType = availableTypes[0];
  
  for (const type of availableTypes) {
    cumulative += type.rarity;
    if (rand <= cumulative) {
      selectedType = type;
      break;
    }
  }
  
  return {
    x: -30,
    y: Math.random() * 420 + 40,
    type: selectedType.name,
    sprite: selectedType.sprite,
    health: selectedType.health + Math.floor(wave * 5),
    maxHealth: selectedType.health + Math.floor(wave * 5),
    speed: selectedType.speed + (wave * 0.05),
    damage: selectedType.damage + Math.floor(wave * 2),
    attackRange: selectedType.attackRange,
    attackRate: Math.max(800, selectedType.attackRate - (wave * 50)),
    points: selectedType.points,
    projectileColor: selectedType.projectileColor,
    projectileSpeed: selectedType.projectileSpeed,
    frame: 0,
    active: true,
    lastAttack: 0,
    hitFlash: 0
  };
}

export function getEnemySprite(enemy) {
  const frame = enemy.frame;
  let baseSprite;
  
  switch (enemy.sprite) {
    case 'blue':
      baseSprite = pixelCommandoBlue;
      break;
    case 'green':
      baseSprite = pixelCommandoGreen;
      break;
    case 'yellow':
      baseSprite = pixelCommandoYellow;
      break;
    case 'heavy':
      baseSprite = pixelHeavyEnemy;
      break;
    case 'sniper':
      baseSprite = pixelSniperEnemy;
      break;
    case 'phantom':
      baseSprite = pixelPhantomEnemy;
      break;
    case 'berserker':
      baseSprite = pixelBerserkerEnemy;
      break;
    case 'cyber':
      baseSprite = pixelCyberEnemy;
      break;
    case 'mutant':
      baseSprite = pixelMutantEnemy;
      break;
    case 'ghost':
      baseSprite = pixelGhostEnemy;
      break;
    default:
      baseSprite = [
        ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
        ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
        ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
        ["empty","redshirt2","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt2","empty","empty"],
        ["skin","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle","rifle-barrel"],
        ["empty","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","empty","empty"],
        ["empty","redpants","redpants","empty","redpants","redpants","empty","redpants","redpants","empty"],
        ["empty","redpants","redpants","empty","redpants","redpants","empty","redpants","redpants","empty"],
        ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
        ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
      ];
  }
  
  // Animate legs for walking
  const sprite = JSON.parse(JSON.stringify(baseSprite));
  if (frame % 2 === 1) {
    sprite[8][2] = 'boots'; sprite[8][8] = 'empty';
    sprite[9][2] = 'empty'; sprite[9][8] = 'boots';
  } else {
    sprite[8][2] = 'empty'; sprite[8][8] = 'boots';
    sprite[9][2] = 'boots'; sprite[9][8] = 'empty';
  }
  
  return sprite;
}

function handleSpecialBehavior(enemy, playerX, playerY) {
  if (!enemy.special) return;
  
  const now = Date.now();
  
  switch (enemy.special) {
    case 'teleport':
      // Phantom can teleport randomly
      if (!enemy.lastTeleport) enemy.lastTeleport = 0;
      if (now - enemy.lastTeleport > 4000 && Math.random() < 0.1) {
        enemy.x = Math.random() * 700 + 50;
        enemy.y = Math.random() * 400 + 50;
        enemy.lastTeleport = now;
        enemy.hitFlash = 15; // Visual effect
      }
      break;
      
    case 'phase':
      // Ghost can phase through boundaries
      if (Math.random() < 0.02) {
        enemy.phasing = true;
        setTimeout(() => { enemy.phasing = false; }, 1000);
      }
      break;
      
    case 'toxic':
      // Mutant leaves toxic trail
      if (!enemy.lastToxic) enemy.lastToxic = 0;
      if (now - enemy.lastToxic > 500) {
        enemy.lastToxic = now;
        // Could spawn toxic puddles here
      }
      break;
      
    case 'rage':
      // Berserker gets more aggressive when damaged
      if (enemy.health < enemy.maxHealth * 0.3) {
        enemy.attackRate = Math.max(400, enemy.attackRate * 0.7);
      }
      break;
  }
}

export function updateEnemy(enemy, playerX, playerY) {
  if (!enemy.active) return null;
  
  enemy.frame = (enemy.frame + 1) % 2;
  if (enemy.hitFlash > 0) enemy.hitFlash--;
  
  // Special behaviors based on enemy type
  handleSpecialBehavior(enemy, playerX, playerY);
  
  // Move toward player (modified by special behaviors)
  const dx = playerX - enemy.x;
  const dy = playerY - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  if (distance > 1) {
    let moveSpeed = enemy.speed;
    
    // Special movement modifications
    if (enemy.special === 'rage' && enemy.health < enemy.maxHealth * 0.5) {
      moveSpeed *= 1.8; // Berserker rage when low health
    }
    if (enemy.special === 'dash' && Math.random() < 0.05) {
      moveSpeed *= 3; // Cyber ninja dash
    }
    
    enemy.x += moveSpeed * (dx / distance);
    enemy.y += moveSpeed * (dy / distance);
  }
  
  // Enemy shooting
  const now = Date.now();
  if (distance < enemy.attackRange && now - enemy.lastAttack > enemy.attackRate) {
    enemy.lastAttack = now;
    
    // Aim at player with some inaccuracy for non-snipers
    let bulletDx = dx / distance;
    let bulletDy = dy / distance;
    
    if (enemy.sprite !== 'sniper') {
      // Add some inaccuracy
      const inaccuracy = 0.2;
      bulletDx += (Math.random() - 0.5) * inaccuracy;
      bulletDy += (Math.random() - 0.5) * inaccuracy;
      
      // Normalize
      const newDist = Math.sqrt(bulletDx * bulletDx + bulletDy * bulletDy);
      bulletDx /= newDist;
      bulletDy /= newDist;
    }
    
    return {
      x: enemy.x + 10,
      y: enemy.y + 10,
      dx: bulletDx * enemy.projectileSpeed,
      dy: bulletDy * enemy.projectileSpeed,
      damage: enemy.damage,
      color: enemy.projectileColor,
      hit: false
    };
  }
  
  return null;
}

export function renderEnemy(container, enemy) {
  const sprite = getEnemySprite(enemy);
  const flashColor = enemy.hitFlash > 0 ? '#fff' : null;
  
  // CHAOS: Invisible enemies!
  if (window.chaosInvisibleEnemies && Math.random() > 0.3) return;
  
  // Health bar above enemy
  if (enemy.health < enemy.maxHealth) {
    const healthBarBg = document.createElement('div');
    healthBarBg.style.position = 'absolute';
    healthBarBg.style.left = (enemy.x - 2) + 'px';
    healthBarBg.style.top = (enemy.y - 8) + 'px';
    healthBarBg.style.width = '24px';
    healthBarBg.style.height = '4px';
    healthBarBg.style.background = '#333';
    healthBarBg.style.border = '1px solid #666';
    container.appendChild(healthBarBg);
    
    const healthBarFill = document.createElement('div');
    healthBarFill.style.position = 'absolute';
    healthBarFill.style.left = (enemy.x - 1) + 'px';
    healthBarFill.style.top = (enemy.y - 7) + 'px';
    healthBarFill.style.width = (22 * (enemy.health / enemy.maxHealth)) + 'px';
    healthBarFill.style.height = '2px';
    healthBarFill.style.background = enemy.health > enemy.maxHealth * 0.5 ? '#4caf50' : '#ff4444';
    container.appendChild(healthBarFill);
  }
  
  // Enemy type indicator
  const indicator = document.createElement('div');
  indicator.style.position = 'absolute';
  indicator.style.left = (enemy.x + 18) + 'px';
  indicator.style.top = (enemy.y - 6) + 'px';
  indicator.style.width = '6px';
  indicator.style.height = '6px';
  indicator.style.background = enemy.projectileColor;
  indicator.style.borderRadius = '50%';
  indicator.style.border = '1px solid #000';
  indicator.style.boxShadow = `0 0 4px ${enemy.projectileColor}`;
  container.appendChild(indicator);
  
  // Render sprite
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const color = sprite[row][col];
      if (color !== 'empty') {
        const pixel = document.createElement('div');
        pixel.className = 'pixel ' + color;
        pixel.style.left = (enemy.x + col * 2) + 'px';
        pixel.style.top = (enemy.y + row * 2) + 'px';
        
        // CHAOS ENEMY COLOR EFFECTS!
        if (flashColor) {
          pixel.style.background = flashColor;
        } else if (window.chaosDiscoMode) {
          const discoColors = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0080ff', '#8000ff'];
          pixel.style.background = discoColors[Math.floor(Date.now() * 0.01 + enemy.x * 0.01) % discoColors.length];
          pixel.style.boxShadow = `0 0 3px ${pixel.style.background}`;
        } else if (window.chaosNeonRave) {
          const neonColors = ['#ff00ff', '#00ffff', '#ffff00'];
          pixel.style.background = neonColors[Math.floor(Date.now() * 0.02 + row + col) % neonColors.length];
          pixel.style.boxShadow = `0 0 5px ${pixel.style.background}`;
        } else if (window.chaosGiantChicken) {
          // Make enemies look chicken-themed!
          if (color.includes('shirt')) {
            pixel.style.background = '#ffaa00'; // Chicken yellow
          } else if (color.includes('pants')) {
            pixel.style.background = '#ff6600'; // Chicken orange
          }
        }
        
        // CHAOS: Tiny mode affects enemies too!
        if (window.chaosTinyMode) {
          pixel.style.width = '1px';
          pixel.style.height = '1px';
        }
        
        // MYSTERIOUS CHAOS EFFECTS!
        if (window.chaosQuantumFlux && Math.random() < 0.3) {
          pixel.style.opacity = Math.random();
          pixel.style.transform = `translate(${(Math.random()-0.5)*4}px, ${(Math.random()-0.5)*4}px)`;
        }
        
        if (window.chaosShadowRealm) {
          pixel.style.filter = 'brightness(0.2) contrast(3)';
          pixel.style.boxShadow = '0 0 5px #000000';
        }
        
        if (window.chaosRealityBreach) {
          const glitchColors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
          if (Math.random() < 0.4) {
            pixel.style.background = glitchColors[Math.floor(Math.random() * glitchColors.length)];
            pixel.style.transform = `scale(${0.5 + Math.random()})`;
          }
        }
        
        if (window.chaosTimeDilation && Math.random() < 0.2) {
          pixel.style.animation = 'time-warp 2s infinite';
        }
        
        // Special enemy effects
        if (enemy.special === 'phantom' && Math.random() < 0.1) {
          pixel.style.opacity = '0.3';
          pixel.style.filter = 'blur(1px)';
        }
        
        if (enemy.special === 'ghost') {
          pixel.style.opacity = '0.6';
          pixel.style.filter = 'brightness(1.2)';
        }
        
        if (enemy.special === 'toxic') {
          pixel.style.boxShadow = '0 0 3px #80ff00';
          if (Math.random() < 0.1) {
            pixel.style.background = '#80ff00';
          }
        }
        
        container.appendChild(pixel);
      }
    }
  }
}