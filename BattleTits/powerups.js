// powerups.js
// Enhanced powerup system with graphics and effects
export const powerupTypes = [
  // Basic powerups (available from level 1)
  { 
    type: 'health', 
    color: '#ff4444', 
    effect: 'Health Pack',
    symbol: '+',
    duration: 0,
    rarity: 0.3,
    minLevel: 1
  },
  { 
    type: 'ammo', 
    color: '#ffaa00', 
    effect: 'Ammo Refill',
    symbol: '■',
    duration: 0,
    rarity: 0.25,
    minLevel: 1
  },
  { 
    type: 'rapid', 
    color: '#ff9800', 
    effect: 'Rapid Fire',
    symbol: '≡',
    duration: 8000,
    rarity: 0.15,
    minLevel: 1
  },
  { 
    type: 'spread', 
    color: '#4caf50', 
    effect: 'Spread Shot',
    symbol: '※',
    duration: 10000,
    rarity: 0.1,
    minLevel: 2
  },
  { 
    type: 'pierce', 
    color: '#2196f3', 
    effect: 'Piercing Bullets',
    symbol: '→',
    duration: 12000,
    rarity: 0.08,
    minLevel: 3
  },
  { 
    type: 'explosive', 
    color: '#e91e63', 
    effect: 'Explosive Rounds',
    symbol: '※',
    duration: 8000,
    rarity: 0.07,
    minLevel: 3
  },
  { 
    type: 'shield', 
    color: '#00bcd4', 
    effect: 'Energy Shield',
    symbol: '◊',
    duration: 15000,
    rarity: 0.05,
    minLevel: 4
  },
  
  // Advanced powerups (higher levels)
  { 
    type: 'laser', 
    color: '#ff0080', 
    effect: 'Laser Beam',
    symbol: '━',
    duration: 12000,
    rarity: 0.06,
    minLevel: 5
  },
  { 
    type: 'plasma', 
    color: '#8000ff', 
    effect: 'Plasma Cannon',
    symbol: '◈',
    duration: 10000,
    rarity: 0.05,
    minLevel: 6
  },
  { 
    type: 'railgun', 
    color: '#00ff80', 
    effect: 'Railgun',
    symbol: '▬',
    duration: 15000,
    rarity: 0.04,
    minLevel: 7
  },
  { 
    type: 'nuclear', 
    color: '#ffff00', 
    effect: 'Nuclear Rounds',
    symbol: '☢',
    duration: 8000,
    rarity: 0.03,
    minLevel: 8
  },
  { 
    type: 'quantum', 
    color: '#ff8000', 
    effect: 'Quantum Burst',
    symbol: '⚛',
    duration: 6000,
    rarity: 0.02,
    minLevel: 9
  },
  { 
    type: 'antimatter', 
    color: '#ffffff', 
    effect: 'Antimatter Beam',
    symbol: '◉',
    duration: 10000,
    rarity: 0.01,
    minLevel: 10
  },
  
  // NEW WEAPONS
  { 
    type: 'shotgun', 
    color: '#ff6600', 
    effect: 'Combat Shotgun',
    symbol: '▣',
    duration: 12000,
    rarity: 0.12,
    minLevel: 2
  },
  { 
    type: 'flamethrower', 
    color: '#ff4400', 
    effect: 'Flamethrower',
    symbol: '🔥',
    duration: 8000,
    rarity: 0.08,
    minLevel: 3
  },
  { 
    type: 'freeze', 
    color: '#00ccff', 
    effect: 'Freeze Ray',
    symbol: '❄',
    duration: 10000,
    rarity: 0.07,
    minLevel: 4
  },
  { 
    type: 'lightning', 
    color: '#ffff88', 
    effect: 'Chain Lightning',
    symbol: '⚡',
    duration: 9000,
    rarity: 0.06,
    minLevel: 5
  },
  { 
    type: 'acid', 
    color: '#88ff00', 
    effect: 'Acid Launcher',
    symbol: '☣',
    duration: 11000,
    rarity: 0.05,
    minLevel: 6
  },
  { 
    type: 'homing', 
    color: '#ff00ff', 
    effect: 'Smart Missiles',
    symbol: '🎯',
    duration: 13000,
    rarity: 0.04,
    minLevel: 7
  },
  { 
    type: 'minigun', 
    color: '#ffaa00', 
    effect: 'Minigun',
    symbol: '⚈',
    duration: 10000,
    rarity: 0.06,
    minLevel: 5
  },
  { 
    type: 'sniper', 
    color: '#00ff00', 
    effect: 'Sniper Rifle',
    symbol: '◎',
    duration: 15000,
    rarity: 0.03,
    minLevel: 8
  },
  { 
    type: 'bouncer', 
    color: '#ff8800', 
    effect: 'Bouncing Balls',
    symbol: '◐',
    duration: 12000,
    rarity: 0.05,
    minLevel: 6
  },
  
  // NEW POWERUP VARIATIONS FOR HARDER LEVELS
  { 
    type: 'megahealth', 
    color: '#ff0066', 
    effect: 'Mega Health Pack',
    symbol: '♥',
    duration: 0,
    rarity: 0.15,
    minLevel: 3
  },
  { 
    type: 'doubleammo', 
    color: '#ffcc00', 
    effect: 'Double Ammo Capacity',
    symbol: '▣',
    duration: 30000,
    rarity: 0.12,
    minLevel: 2
  },
  { 
    type: 'rapidreload', 
    color: '#00ff66', 
    effect: 'Instant Reload',
    symbol: '⚡',
    duration: 20000,
    rarity: 0.14,
    minLevel: 2
  },
  { 
    type: 'multishield', 
    color: '#66ccff', 
    effect: 'Multi-Layer Shield',
    symbol: '⬢',
    duration: 25000,
    rarity: 0.08,
    minLevel: 4
  },
  { 
    type: 'berserker', 
    color: '#ff3300', 
    effect: 'Berserker Mode',
    symbol: '💀',
    duration: 15000,
    rarity: 0.09,
    minLevel: 5
  },
  { 
    type: 'timeslow', 
    color: '#9966ff', 
    effect: 'Time Dilation',
    symbol: '⏰',
    duration: 12000,
    rarity: 0.06,
    minLevel: 6
  },
  { 
    type: 'ghostmode', 
    color: '#cccccc', 
    effect: 'Ghost Mode',
    symbol: '👻',
    duration: 10000,
    rarity: 0.05,
    minLevel: 7
  },
  { 
    type: 'magnetism', 
    color: '#ff6699', 
    effect: 'Magnetic Attraction',
    symbol: '🧲',
    duration: 20000,
    rarity: 0.10,
    minLevel: 3
  },
  { 
    type: 'multishot', 
    color: '#ffaa66', 
    effect: 'Multi-Shot Burst',
    symbol: '※',
    duration: 18000,
    rarity: 0.11,
    minLevel: 4
  },
  { 
    type: 'regeneration', 
    color: '#66ff99', 
    effect: 'Health Regeneration',
    symbol: '♻',
    duration: 25000,
    rarity: 0.07,
    minLevel: 5
  },
  { 
    type: 'invincible', 
    color: '#ffff66', 
    effect: 'Temporary Invincibility',
    symbol: '⭐',
    duration: 8000,
    rarity: 0.03,
    minLevel: 8
  },
  { 
    type: 'airstrike', 
    color: '#ff9933', 
    effect: 'Orbital Strike',
    symbol: '💥',
    duration: 0,
    rarity: 0.04,
    minLevel: 6
  },
  
  // CHAOS POWERUP!
  { 
    type: 'chaos', 
    color: '#ff00ff', 
    effect: 'CHAOS EFFECT',
    symbol: '🎲',
    duration: 0,
    rarity: 0.25, // Increased from 0.2
    minLevel: 1
  }
];

export function spawnPowerup(playerLevel = 1) {
  // Filter powerups available at current level
  const availablePowerups = powerupTypes.filter(type => type.minLevel <= playerLevel);
  
  // Increase rarity of advanced powerups based on level
  const adjustedPowerups = availablePowerups.map(type => ({
    ...type,
    adjustedRarity: type.rarity * (1 + (playerLevel - type.minLevel) * 0.1)
  }));
  
  // Weighted random selection
  const totalRarity = adjustedPowerups.reduce((sum, type) => sum + type.adjustedRarity, 0);
  const rand = Math.random() * totalRarity;
  let cumulative = 0;
  let selectedType = adjustedPowerups[0];
  
  for (const type of adjustedPowerups) {
    cumulative += type.adjustedRarity;
    if (rand <= cumulative) {
      selectedType = type;
      break;
    }
  }
  
  return {
    x: Math.floor(Math.random() * 720) + 40,
    y: Math.floor(Math.random() * 420) + 40,
    type: selectedType.type,
    active: true,
    pulsePhase: 0,
    spawnTime: Date.now()
  };
}

export function renderPowerupGraphic(container, powerup) {
  const typeObj = powerupTypes.find(t => t.type === powerup.type);
  if (!typeObj) return;
  
  // Pulsing effect
  powerup.pulsePhase += 0.2;
  const pulse = Math.sin(powerup.pulsePhase) * 0.3 + 1;
  let size = 20 * pulse;
  
  // CHAOS: Tiny mode affects powerups too!
  if (window.chaosTinyMode) size *= 0.5;
  
  // Main powerup circle
  const elem = document.createElement('div');
  elem.style.position = 'absolute';
  elem.style.left = (powerup.x - size/2) + 'px';
  elem.style.top = (powerup.y - size/2) + 'px';
  elem.style.width = size + 'px';
  elem.style.height = size + 'px';
  // CHAOS: Special effects for chaos powerup!
  if (powerup.type === 'chaos') {
    const rainbowColors = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0080ff', '#8000ff'];
    const currentColor = rainbowColors[Math.floor(Date.now() * 0.01) % rainbowColors.length];
    elem.style.background = `radial-gradient(circle, ${currentColor}, ${currentColor}88, #ffffff)`;
    elem.style.animation = 'wiggle 0.2s infinite, spin 1s infinite';
    elem.style.boxShadow = `0 0 20px ${currentColor}, 0 0 40px ${currentColor}`;
  } else {
    elem.style.background = `radial-gradient(circle, ${typeObj.color}, ${typeObj.color}88)`;
    
    // CHAOS: Other powerups get effects too during chaos events!
    if (window.chaosDiscoMode) {
      elem.style.animation = 'bounce 0.5s infinite, character-rainbow 1s infinite';
      elem.style.boxShadow = `0 0 15px ${typeObj.color}`;
    } else if (window.chaosNeonRave) {
      elem.style.boxShadow = `0 0 25px ${typeObj.color}, 0 0 50px #ffffff`;
      elem.style.animation = 'spin 2s infinite';
    }
  }
  
  elem.style.borderRadius = '50%';
  elem.style.border = '2px solid #fff';
  elem.style.boxShadow = `0 0 ${size/2}px ${typeObj.color}66`;
  elem.style.zIndex = '100';
  
  // Symbol overlay
  const symbol = document.createElement('div');
  symbol.style.position = 'absolute';
  symbol.style.left = '50%';
  symbol.style.top = '50%';
  symbol.style.transform = 'translate(-50%, -50%)';
  symbol.style.color = '#fff';
  symbol.style.fontSize = (size * 0.6) + 'px';
  symbol.style.fontWeight = 'bold';
  symbol.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
  symbol.textContent = typeObj.symbol;
  elem.appendChild(symbol);
  
  // Rotating outer ring for rare powerups
  if (typeObj.rarity < 0.1) {
    const ring = document.createElement('div');
    ring.style.position = 'absolute';
    ring.style.left = '-4px';
    ring.style.top = '-4px';
    ring.style.width = (size + 8) + 'px';
    ring.style.height = (size + 8) + 'px';
    ring.style.border = '2px solid ' + typeObj.color;
    ring.style.borderRadius = '50%';
    ring.style.borderTopColor = 'transparent';
    ring.style.animation = 'spin 2s linear infinite';
    elem.appendChild(ring);
  }
  
  container.appendChild(elem);
}

// Add CSS animation for rotating rings
if (!document.querySelector('#powerup-animations')) {
  const style = document.createElement('style');
  style.id = 'powerup-animations';
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
}
