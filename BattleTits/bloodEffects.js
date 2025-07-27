// bloodEffects.js
// Enhanced blood effects system with varied colors and types

export const bloodTypes = {
  human: {
    colors: ['#cc0000', '#aa0000', '#880000', '#bb1111'],
    viscosity: 1.0,
    fadeRate: 0.02,
    splatterSize: 1.0
  },
  alien: {
    colors: ['#00cc00', '#00aa00', '#008800', '#11bb11'],
    viscosity: 0.8,
    fadeRate: 0.015,
    splatterSize: 1.2
  },
  robot: {
    colors: ['#0088cc', '#0066aa', '#004488', '#1199bb'],
    viscosity: 0.6,
    fadeRate: 0.025,
    splatterSize: 0.8
  },
  toxic: {
    colors: ['#cccc00', '#aaaa00', '#888800', '#bbbb11'],
    viscosity: 1.2,
    fadeRate: 0.01,
    splatterSize: 1.3
  },
  phantom: {
    colors: ['#cc00cc', '#aa00aa', '#880088', '#bb11bb'],
    viscosity: 0.5,
    fadeRate: 0.03,
    splatterSize: 0.9
  },
  cyber: {
    colors: ['#00cccc', '#00aaaa', '#008888', '#11bbbb'],
    viscosity: 0.7,
    fadeRate: 0.02,
    splatterSize: 1.1
  }
};

export function getBloodTypeForEnemy(enemy) {
  if (!enemy) return bloodTypes.human;
  
  switch (enemy.sprite) {
    case 'mutant':
      return bloodTypes.alien;
    case 'cyber':
      return bloodTypes.cyber;
    case 'phantom':
      return bloodTypes.phantom;
    case 'ghost':
      return bloodTypes.phantom;
    case 'heavy':
    case 'berserker':
      return bloodTypes.robot;
    default:
      return bloodTypes.human;
  }
}

export function createBloodEffect(x, y, enemy = null, intensity = 1.0) {
  const bloodType = getBloodTypeForEnemy(enemy);
  const drops = [];
  const dropCount = Math.floor(6 + Math.random() * 8) * intensity;
  
  for (let i = 0; i < dropCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = (Math.random() * 6 + 2) * bloodType.viscosity;
    const size = (2 + Math.random() * 4) * bloodType.splatterSize;
    
    drops.push({
      x: x + (Math.random() - 0.5) * 20,
      y: y + (Math.random() - 0.5) * 20,
      size: size,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color: bloodType.colors[Math.floor(Math.random() * bloodType.colors.length)],
      gravity: 0.2 / bloodType.viscosity,
      friction: 0.98 + (bloodType.viscosity * 0.01),
      life: 60 + Math.random() * 40,
      maxLife: 60 + Math.random() * 40
    });
  }
  
  return {
    drops: drops,
    opacity: 1,
    life: 80,
    fadeRate: bloodType.fadeRate,
    type: bloodType
  };
}

export function createBloodSplatter(x, y, direction, enemy = null) {
  const bloodType = getBloodTypeForEnemy(enemy);
  const drops = [];
  const dropCount = Math.floor(10 + Math.random() * 15);
  
  // Create directional splatter
  const baseAngle = Math.atan2(direction.y, direction.x);
  const spread = Math.PI / 3; // 60 degree spread
  
  for (let i = 0; i < dropCount; i++) {
    const angle = baseAngle + (Math.random() - 0.5) * spread;
    const velocity = (Math.random() * 8 + 3) * bloodType.viscosity;
    const size = (1 + Math.random() * 6) * bloodType.splatterSize;
    
    drops.push({
      x: x,
      y: y,
      size: size,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color: bloodType.colors[Math.floor(Math.random() * bloodType.colors.length)],
      gravity: 0.15 / bloodType.viscosity,
      friction: 0.97 + (bloodType.viscosity * 0.02),
      life: 80 + Math.random() * 60,
      maxLife: 80 + Math.random() * 60,
      trail: Math.random() < 0.3 // Some drops leave trails
    });
  }
  
  return {
    drops: drops,
    opacity: 1,
    life: 100,
    fadeRate: bloodType.fadeRate,
    type: bloodType
  };
}

export function createBloodPool(x, y, enemy = null, size = 1.0) {
  const bloodType = getBloodTypeForEnemy(enemy);
  
  return {
    x: x,
    y: y,
    size: size * bloodType.splatterSize,
    maxSize: (15 + Math.random() * 10) * size * bloodType.splatterSize,
    color: bloodType.colors[0], // Use darkest color for pools
    opacity: 0.8,
    growth: 0.5,
    life: 200,
    fadeRate: bloodType.fadeRate * 0.5, // Pools last longer
    type: bloodType
  };
}

export function updateBloodEffects(bloodEffects) {
  for (const blood of bloodEffects) {
    blood.life--;
    blood.opacity = Math.max(0, blood.life / 80);
    
    for (const drop of blood.drops) {
      // Store previous position for trails
      drop.prevX = drop.x;
      drop.prevY = drop.y;
      
      // Physics
      drop.x += drop.vx;
      drop.y += drop.vy;
      drop.vy += drop.gravity; // Gravity
      drop.vx *= drop.friction; // Air resistance
      drop.vy *= drop.friction;
      
      // Fade over time
      drop.life--;
      
      // Bounce off ground with splatter effect
      if (drop.y > 480 && drop.vy > 0) {
        drop.vy *= -0.3;
        drop.vx *= 0.8;
        
        // Create mini splatter on ground impact
        if (Math.abs(drop.vy) > 1) {
          drop.size *= 1.2; // Spread on impact
        }
      }
      
      // Bounce off walls
      if ((drop.x < 0 || drop.x > 800) && Math.abs(drop.vx) > 0.1) {
        drop.vx *= -0.5;
      }
      
      // Clamp to screen bounds
      drop.x = Math.max(0, Math.min(800, drop.x));
      drop.y = Math.max(0, Math.min(500, drop.y));
    }
    
    // Remove dead drops
    blood.drops = blood.drops.filter(drop => drop.life > 0);
  }
  
  // Remove empty blood effects
  return bloodEffects.filter(blood => blood.life > 0 && blood.drops.length > 0);
}

export function updateBloodPools(bloodPools) {
  for (const pool of bloodPools) {
    pool.life--;
    
    // Grow initially
    if (pool.size < pool.maxSize) {
      pool.size += pool.growth;
      pool.growth *= 0.95; // Slow down growth
    }
    
    // Fade out
    pool.opacity = Math.max(0, (pool.life / 200) * 0.8);
  }
  
  return bloodPools.filter(pool => pool.life > 0 && pool.opacity > 0.01);
}

export function renderBloodEffects(container, bloodEffects) {
  for (const blood of bloodEffects) {
    for (const drop of blood.drops) {
      const dropElem = document.createElement('div');
      dropElem.style.position = 'absolute';
      dropElem.style.left = drop.x + 'px';
      dropElem.style.top = drop.y + 'px';
      dropElem.style.width = drop.size + 'px';
      dropElem.style.height = drop.size + 'px';
      dropElem.style.background = drop.color;
      dropElem.style.borderRadius = '50%';
      dropElem.style.opacity = Math.min(blood.opacity, drop.life / drop.maxLife);
      dropElem.style.pointerEvents = 'none';
      
      // Add glow effect for special blood types
      if (blood.type !== bloodTypes.human) {
        dropElem.style.boxShadow = `0 0 3px ${drop.color}`;
      }
      
      // Enhanced trail effect for some drops
      if (drop.trail && Math.abs(drop.vx) + Math.abs(drop.vy) > 2) {
        const trailLength = Math.min(8, Math.abs(drop.vx) + Math.abs(drop.vy));
        dropElem.style.boxShadow += `, -${drop.vx * 0.5}px -${drop.vy * 0.5}px ${trailLength}px ${drop.color}44`;
        dropElem.style.boxShadow += `, -${drop.vx}px -${drop.vy}px 2px ${drop.color}66`;
      }
      
      container.appendChild(dropElem);
    }
  }
}

export function renderBloodPools(container, bloodPools) {
  for (const pool of bloodPools) {
    const poolElem = document.createElement('div');
    poolElem.style.position = 'absolute';
    poolElem.style.left = (pool.x - pool.size/2) + 'px';
    poolElem.style.top = (pool.y - pool.size/2) + 'px';
    poolElem.style.width = pool.size + 'px';
    poolElem.style.height = pool.size + 'px';
    poolElem.style.background = `radial-gradient(circle, ${pool.color}, ${pool.color}88, transparent)`;
    poolElem.style.borderRadius = '50%';
    poolElem.style.opacity = pool.opacity;
    poolElem.style.pointerEvents = 'none';
    poolElem.style.zIndex = '1';
    
    // Special effects for non-human blood
    if (pool.type !== bloodTypes.human) {
      poolElem.style.boxShadow = `0 0 ${pool.size/2}px ${pool.color}44`;
    }
    
    container.appendChild(poolElem);
  }
}

// Utility function to create blood based on weapon type
export function createWeaponBloodEffect(x, y, weaponType, enemy = null) {
  switch (weaponType) {
    case 'explosive':
    case 'nuclear':
      return createBloodSplatter(x, y, {x: Math.random()-0.5, y: Math.random()-0.5}, enemy);
    case 'laser':
    case 'railgun':
      return createBloodEffect(x, y, enemy, 0.5); // Less blood for energy weapons
    case 'plasma':
      return createBloodEffect(x, y, enemy, 1.5); // More intense
    default:
      return createBloodEffect(x, y, enemy, 1.0);
  }
}

// Create death blood effect - more intense than regular hit
export function createDeathBloodEffect(x, y, enemy = null) {
  const bloodType = getBloodTypeForEnemy(enemy);
  const drops = [];
  const dropCount = Math.floor(15 + Math.random() * 20); // More drops for death
  
  for (let i = 0; i < dropCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = (Math.random() * 10 + 4) * bloodType.viscosity; // Higher velocity
    const size = (3 + Math.random() * 6) * bloodType.splatterSize; // Larger drops
    
    drops.push({
      x: x + (Math.random() - 0.5) * 30,
      y: y + (Math.random() - 0.5) * 30,
      size: size,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity,
      color: bloodType.colors[Math.floor(Math.random() * bloodType.colors.length)],
      gravity: 0.25 / bloodType.viscosity,
      friction: 0.96 + (bloodType.viscosity * 0.02),
      life: 100 + Math.random() * 60, // Longer lasting
      maxLife: 100 + Math.random() * 60,
      trail: Math.random() < 0.6 // More trails for death effects
    });
  }
  
  return {
    drops: drops,
    opacity: 1,
    life: 120, // Longer effect duration
    fadeRate: bloodType.fadeRate * 0.8, // Slower fade
    type: bloodType
  };
}

// Create blood fountain effect for boss deaths
export function createBloodFountain(x, y, enemy = null) {
  const bloodType = getBloodTypeForEnemy(enemy);
  const drops = [];
  const dropCount = Math.floor(30 + Math.random() * 40); // Massive amount of drops
  
  for (let i = 0; i < dropCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const velocity = (Math.random() * 15 + 8) * bloodType.viscosity; // Very high velocity
    const size = (4 + Math.random() * 8) * bloodType.splatterSize; // Large drops
    
    drops.push({
      x: x + (Math.random() - 0.5) * 40,
      y: y + (Math.random() - 0.5) * 40,
      size: size,
      vx: Math.cos(angle) * velocity,
      vy: Math.sin(angle) * velocity - Math.random() * 5, // Upward bias
      color: bloodType.colors[Math.floor(Math.random() * bloodType.colors.length)],
      gravity: 0.3 / bloodType.viscosity,
      friction: 0.95 + (bloodType.viscosity * 0.02),
      life: 150 + Math.random() * 80, // Very long lasting
      maxLife: 150 + Math.random() * 80,
      trail: Math.random() < 0.8 // Most drops have trails
    });
  }
  
  return {
    drops: drops,
    opacity: 1,
    life: 180, // Very long effect duration
    fadeRate: bloodType.fadeRate * 0.6, // Very slow fade
    type: bloodType
  };
}