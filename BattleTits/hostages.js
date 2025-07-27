// hostages.js
// Hostage rescue system with safe zones and escort mechanics

// Hostage sprite variations
export const pixelHostageCivilian = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","shirt2","shirt","shirt","shirt","shirt","shirt","shirt2","empty","empty"],
  ["skin","shirt","shirt","shirt","shirt","shirt","shirt","shirt","empty","empty"],
  ["empty","shirt","shirt","shirt","shirt","shirt","shirt","shirt","empty","empty"],
  ["empty","pants","pants","empty","pants","pants","empty","pants","pants","empty"],
  ["empty","pants","pants","empty","pants","pants","empty","pants","pants","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

export const pixelHostageScientist = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","shirt2","shirt","shirt","shirt","shirt","shirt","shirt2","empty","empty"],
  ["skin","shirt","shirt","shirt","shirt","shirt","shirt","shirt","empty","empty"],
  ["empty","shirt","shirt","shirt","shirt","shirt","shirt","shirt","empty","empty"],
  ["empty","pants","pants","empty","pants","pants","empty","pants","pants","empty"],
  ["empty","pants","pants","empty","pants","pants","empty","pants","pants","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

export const hostageTypes = [
  {
    name: 'Civilian',
    sprite: 'civilian',
    points: 500,
    speed: 0.8,
    panicLevel: 0.3,
    colors: { shirt: '#4a90e2', pants: '#2c3e50' },
    rarity: 0.6
  },
  {
    name: 'Scientist',
    sprite: 'scientist', 
    points: 800,
    speed: 0.6,
    panicLevel: 0.5,
    colors: { shirt: '#ffffff', pants: '#34495e' },
    rarity: 0.25
  },
  {
    name: 'VIP Official',
    sprite: 'vip',
    points: 1200,
    speed: 0.5,
    panicLevel: 0.7,
    colors: { shirt: '#8e44ad', pants: '#2c3e50' },
    rarity: 0.1
  },
  {
    name: 'Child',
    sprite: 'child',
    points: 1000,
    speed: 1.2,
    panicLevel: 0.8,
    colors: { shirt: '#e74c3c', pants: '#3498db' },
    rarity: 0.05
  }
];

export function createHostage(x, y) {
  // Weighted random selection
  const rand = Math.random();
  let cumulative = 0;
  let selectedType = hostageTypes[0];
  
  for (const type of hostageTypes) {
    cumulative += type.rarity;
    if (rand <= cumulative) {
      selectedType = type;
      break;
    }
  }
  
  return {
    x: x || Math.random() * 600 + 100,
    y: y || Math.random() * 300 + 100,
    type: selectedType.name,
    sprite: selectedType.sprite,
    points: selectedType.points,
    speed: selectedType.speed,
    panicLevel: selectedType.panicLevel,
    colors: selectedType.colors,
    
    // State
    active: true,
    rescued: false,
    following: false,
    health: 100,
    maxHealth: 100,
    panicTimer: 0,
    lastPanic: 0,
    frame: 0,
    hitFlash: 0,
    
    // AI state
    targetX: x || Math.random() * 600 + 100,
    targetY: y || Math.random() * 300 + 100,
    lastTargetChange: 0,
    fearRadius: 80,
    followDistance: 30
  };
}

export function updateHostage(hostage, playerX, playerY, enemies) {
  if (!hostage.active || hostage.rescued) return;
  
  hostage.frame = (hostage.frame + 1) % 2;
  if (hostage.hitFlash > 0) hostage.hitFlash--;
  
  const dx = playerX - hostage.x;
  const dy = playerY - hostage.y;
  const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
  
  // Check if player is close enough to start following
  if (!hostage.following && distanceToPlayer < 40) {
    hostage.following = true;
    hostage.panicTimer = 0;
  }
  
  // Hostage behavior
  if (hostage.following) {
    // Follow player but maintain distance
    if (distanceToPlayer > hostage.followDistance) {
      const followSpeed = hostage.speed * (1 + hostage.panicLevel);
      hostage.x += (dx / distanceToPlayer) * followSpeed;
      hostage.y += (dy / distanceToPlayer) * followSpeed;
    }
    
    // Panic near enemies
    let nearestEnemyDistance = Infinity;
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      const edx = enemy.x - hostage.x;
      const edy = enemy.y - hostage.y;
      const enemyDistance = Math.sqrt(edx * edx + edy * edy);
      nearestEnemyDistance = Math.min(nearestEnemyDistance, enemyDistance);
      
      if (enemyDistance < hostage.fearRadius) {
        hostage.panicTimer = Math.min(hostage.panicTimer + 1, 100);
        // Run away from enemy
        const fleeSpeed = hostage.speed * 2;
        hostage.x -= (edx / enemyDistance) * fleeSpeed;
        hostage.y -= (edy / enemyDistance) * fleeSpeed;
      }
    }
    
    if (nearestEnemyDistance > hostage.fearRadius) {
      hostage.panicTimer = Math.max(hostage.panicTimer - 1, 0);
    }
    
  } else {
    // Wander around randomly when not following
    const now = Date.now();
    if (now - hostage.lastTargetChange > 3000 || 
        Math.abs(hostage.x - hostage.targetX) < 10 && Math.abs(hostage.y - hostage.targetY) < 10) {
      hostage.targetX = Math.random() * 600 + 100;
      hostage.targetY = Math.random() * 300 + 100;
      hostage.lastTargetChange = now;
    }
    
    const tdx = hostage.targetX - hostage.x;
    const tdy = hostage.targetY - hostage.y;
    const targetDistance = Math.sqrt(tdx * tdx + tdy * tdy);
    
    if (targetDistance > 5) {
      hostage.x += (tdx / targetDistance) * hostage.speed * 0.5;
      hostage.y += (tdy / targetDistance) * hostage.speed * 0.5;
    }
  }
  
  // Keep hostage in bounds
  hostage.x = Math.max(20, Math.min(hostage.x, 780));
  hostage.y = Math.max(20, Math.min(hostage.y, 480));
}

export function getHostageSprite(hostage) {
  const frame = hostage.frame;
  let baseSprite;
  
  switch (hostage.sprite) {
    case 'scientist':
      baseSprite = pixelHostageScientist;
      break;
    case 'vip':
    case 'child':
    case 'civilian':
    default:
      baseSprite = pixelHostageCivilian;
  }
  
  // Animate legs for walking
  const sprite = JSON.parse(JSON.stringify(baseSprite));
  if (hostage.following && frame % 2 === 1) {
    sprite[8][2] = 'boots'; sprite[8][8] = 'empty';
    sprite[9][2] = 'empty'; sprite[9][8] = 'boots';
  } else {
    sprite[8][2] = 'empty'; sprite[8][8] = 'boots';
    sprite[9][2] = 'boots'; sprite[9][8] = 'empty';
  }
  
  return sprite;
}

export function renderHostage(container, hostage) {
  if (!hostage.active || hostage.rescued) return;
  
  const sprite = getHostageSprite(hostage);
  const flashColor = hostage.hitFlash > 0 ? '#fff' : null;
  
  // Panic indicator
  if (hostage.panicTimer > 20) {
    const panicIndicator = document.createElement('div');
    panicIndicator.style.position = 'absolute';
    panicIndicator.style.left = (hostage.x + 5) + 'px';
    panicIndicator.style.top = (hostage.y - 15) + 'px';
    panicIndicator.style.fontSize = '12px';
    panicIndicator.style.color = '#ff0000';
    panicIndicator.textContent = '!';
    panicIndicator.style.animation = 'bounce 0.5s infinite';
    container.appendChild(panicIndicator);
  }
  
  // Following indicator
  if (hostage.following) {
    const followIndicator = document.createElement('div');
    followIndicator.style.position = 'absolute';
    followIndicator.style.left = (hostage.x - 2) + 'px';
    followIndicator.style.top = (hostage.y - 8) + 'px';
    followIndicator.style.width = '24px';
    followIndicator.style.height = '4px';
    followIndicator.style.background = '#00ff00';
    followIndicator.style.border = '1px solid #008800';
    followIndicator.style.borderRadius = '2px';
    container.appendChild(followIndicator);
  }
  
  // Health bar if injured
  if (hostage.health < hostage.maxHealth) {
    const healthBarBg = document.createElement('div');
    healthBarBg.style.position = 'absolute';
    healthBarBg.style.left = (hostage.x - 2) + 'px';
    healthBarBg.style.top = (hostage.y - 12) + 'px';
    healthBarBg.style.width = '24px';
    healthBarBg.style.height = '3px';
    healthBarBg.style.background = '#333';
    healthBarBg.style.border = '1px solid #666';
    container.appendChild(healthBarBg);
    
    const healthBarFill = document.createElement('div');
    healthBarFill.style.position = 'absolute';
    healthBarFill.style.left = (hostage.x - 1) + 'px';
    healthBarFill.style.top = (hostage.y - 11) + 'px';
    healthBarFill.style.width = (22 * (hostage.health / hostage.maxHealth)) + 'px';
    healthBarFill.style.height = '1px';
    healthBarFill.style.background = '#ff4444';
    container.appendChild(healthBarFill);
  }
  
  // Render sprite with custom colors
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const color = sprite[row][col];
      if (color !== 'empty') {
        const pixel = document.createElement('div');
        pixel.className = 'pixel ' + color;
        pixel.style.left = (hostage.x + col * 2) + 'px';
        pixel.style.top = (hostage.y + row * 2) + 'px';
        pixel.style.width = '2px';
        pixel.style.height = '2px';
        
        // Apply custom colors
        if (color === 'shirt' && hostage.colors.shirt) {
          pixel.style.background = hostage.colors.shirt;
        } else if (color === 'pants' && hostage.colors.pants) {
          pixel.style.background = hostage.colors.pants;
        }
        
        if (flashColor) pixel.style.background = flashColor;
        
        container.appendChild(pixel);
      }
    }
  }
}

// Safe zone management
export function createSafeZone(x, y, width = 60, height = 60) {
  return {
    x: x,
    y: y,
    width: width,
    height: height,
    active: true,
    rescueCount: 0
  };
}

export function renderSafeZone(container, safeZone) {
  if (!safeZone.active) return;
  
  // Safe zone background
  const zone = document.createElement('div');
  zone.style.position = 'absolute';
  zone.style.left = safeZone.x + 'px';
  zone.style.top = safeZone.y + 'px';
  zone.style.width = safeZone.width + 'px';
  zone.style.height = safeZone.height + 'px';
  zone.style.background = 'rgba(0, 255, 0, 0.2)';
  zone.style.border = '2px dashed #00ff00';
  zone.style.borderRadius = '8px';
  zone.style.boxShadow = '0 0 10px rgba(0, 255, 0, 0.3)';
  container.appendChild(zone);
  
  // Safe zone label
  const label = document.createElement('div');
  label.style.position = 'absolute';
  label.style.left = (safeZone.x + 5) + 'px';
  label.style.top = (safeZone.y + 5) + 'px';
  label.style.color = '#00ff00';
  label.style.fontSize = '10px';
  label.style.fontWeight = 'bold';
  label.style.textShadow = '1px 1px 2px #000';
  label.textContent = 'SAFE ZONE';
  container.appendChild(label);
  
  // Rescue counter
  if (safeZone.rescueCount > 0) {
    const counter = document.createElement('div');
    counter.style.position = 'absolute';
    counter.style.left = (safeZone.x + 5) + 'px';
    counter.style.top = (safeZone.y + safeZone.height - 15) + 'px';
    counter.style.color = '#00ff00';
    counter.style.fontSize = '8px';
    counter.style.fontWeight = 'bold';
    counter.style.textShadow = '1px 1px 2px #000';
    counter.textContent = `Rescued: ${safeZone.rescueCount}`;
    container.appendChild(counter);
  }
}

export function checkHostageInSafeZone(hostage, safeZone) {
  if (!hostage.following || hostage.rescued || !safeZone.active) return false;
  
  return hostage.x >= safeZone.x && 
         hostage.x <= safeZone.x + safeZone.width &&
         hostage.y >= safeZone.y && 
         hostage.y <= safeZone.y + safeZone.height;
}

export function rescueHostage(hostage, safeZone) {
  hostage.rescued = true;
  hostage.active = false;
  safeZone.rescueCount++;
  
  // Create rescue effect
  return {
    type: 'rescue',
    x: hostage.x,
    y: hostage.y,
    points: hostage.points,
    message: `${hostage.type} RESCUED! +${hostage.points}`
  };
}