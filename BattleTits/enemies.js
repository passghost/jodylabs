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

// NEW ENEMY SPRITES

// Assault Trooper (orange/black tactical gear)
export const pixelAssaultEnemy = [
  ["empty","empty","empty","helmet","helmet","helmet","helmet","empty","empty","empty"],
  ["empty","empty","helmet","helmet","helmet","helmet","helmet","helmet","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","redshirt2","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt2","empty","empty"],
  ["skin","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle","rifle-barrel"],
  ["empty","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle","rifle-barrel"],
  ["empty","armor","armor","empty","armor","armor","empty","armor","armor","empty"],
  ["empty","armor","armor","empty","armor","armor","empty","armor","armor","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"],
  ["empty","empty","boots","empty","empty","empty","empty","empty","boots","empty"]
];

// Stealth Operative (dark gray/black)
export const pixelStealthEnemy = [
  ["empty","empty","empty","armor","armor","armor","armor","empty","empty","empty"],
  ["empty","empty","armor","armor","armor","armor","armor","armor","empty","empty"],
  ["empty","empty","empty","skin","skin","skin","skin","empty","empty","empty"],
  ["empty","armor","armor","armor","armor","armor","armor","armor","empty","empty"],
  ["skin","armor","armor","armor","armor","armor","armor","armor","rifle","rifle-barrel"],
  ["empty","armor","armor","armor","armor","armor","armor","armor","empty","empty"],
  ["empty","armor","armor","empty","armor","armor","empty","armor","armor","empty"],
  ["empty","armor","armor","empty","armor","armor","empty","armor","armor","empty"],
  ["empty","empty","armor","empty","empty","empty","empty","empty","armor","empty"],
  ["empty","empty","armor","empty","empty","empty","empty","empty","armor","empty"]
];

// Demolition Expert (bulky with explosives)
export const pixelDemolitionEnemy = [
  ["armor","armor","armor","helmet","helmet","helmet","helmet","armor","armor","armor"],
  ["armor","armor","helmet","helmet","helmet","helmet","helmet","helmet","armor","armor"],
  ["armor","armor","armor","skin","skin","skin","skin","armor","armor","armor"],
  ["armor","yellowshirt2","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt2","armor","empty"],
  ["skin","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","rifle","rifle-barrel"],
  ["armor","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","armor","empty"],
  ["armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor"],
  ["armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"]
];

// Medic Support (white/green medical colors)
export const pixelMedicEnemy = [
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

// Elite Commander (gold/yellow with extra armor)
export const pixelCommanderEnemy = [
  ["armor","armor","armor","helmet","helmet","helmet","helmet","armor","armor","armor"],
  ["armor","armor","helmet","helmet","helmet","helmet","helmet","helmet","armor","armor"],
  ["armor","armor","armor","skin","skin","skin","skin","armor","armor","armor"],
  ["armor","yellowshirt2","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt2","armor","empty"],
  ["skin","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","rifle","rifle-barrel"],
  ["armor","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","yellowshirt","rifle","rifle-barrel"],
  ["armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor"],
  ["armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor","yellowpants","yellowpants","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"],
  ["armor","armor","boots","armor","armor","armor","armor","armor","boots","armor"]
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
    rarity: 0.13, // Normalized
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
    rarity: 0.09, // Normalized
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
    rarity: 0.08, // Normalized
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
    rarity: 0.05, // Normalized
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
    rarity: 0.03, // Normalized
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
    rarity: 0.06, // Normalized
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
    rarity: 0.04, // Normalized
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
    rarity: 0.08, // Normalized
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
    rarity: 0.03, // Normalized
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
    rarity: 0.05, // Normalized
    projectileColor: '#ffffff',
    projectileSpeed: 4,
    special: 'phase'
  },
  
  // NEW ENEMY VARIATIONS - INCREASED SPAWN RATES
  {
    name: 'Assault Trooper',
    sprite: 'assault',
    health: 90,
    speed: 2.0,
    damage: 18,
    attackRange: 110,
    attackRate: 1000,
    points: 160,
    rarity: 0.09, // Normalized
    projectileColor: '#ff6600',
    projectileSpeed: 5,
    special: 'burst'
  },
  {
    name: 'Stealth Operative',
    sprite: 'stealth',
    health: 45,
    speed: 2.8,
    damage: 28,
    attackRange: 90,
    attackRate: 2200,
    points: 200,
    rarity: 0.08, // Normalized
    projectileColor: '#666666',
    projectileSpeed: 6,
    special: 'cloak'
  },
  {
    name: 'Demolition Expert',
    sprite: 'demolition',
    health: 110,
    speed: 1.2,
    damage: 45,
    attackRange: 130,
    attackRate: 3500,
    points: 350,
    rarity: 0.06, // Normalized
    projectileColor: '#ff4400',
    projectileSpeed: 2.5,
    special: 'explosive'
  },
  {
    name: 'Medic Support',
    sprite: 'medic',
    health: 70,
    speed: 1.6,
    damage: 12,
    attackRange: 160,
    attackRate: 2800,
    points: 180,
    rarity: 0.08, // Normalized
    projectileColor: '#00ff88',
    projectileSpeed: 3.5,
    special: 'heal'
  },
  {
    name: 'Elite Commander',
    sprite: 'commander',
    health: 180,
    speed: 1.4,
    damage: 32,
    attackRange: 180,
    attackRate: 1600,
    points: 450,
    rarity: 0.05, // Normalized
    projectileColor: '#ffaa00',
    projectileSpeed: 4.5,
    special: 'command'
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
  
  // Enhanced personality assignment based on enemy type
  let personality;
  const personalityWeights = {
    'aggressive': 0.25,
    'coward': 0.15,
    'curious': 0.15,
    'patrol': 0.20,
    'berserker': 0.10,
    'tactical': 0.15
  };
  
  // Certain enemy types have preferred personalities
  if (selectedType.name === 'Berserker' || selectedType.name === 'Assault Trooper') {
    personality = Math.random() < 0.7 ? 'berserker' : 'aggressive';
  } else if (selectedType.name === 'Stealth Operative' || selectedType.name === 'Ghost Operative') {
    personality = Math.random() < 0.6 ? 'tactical' : 'curious';
  } else if (selectedType.name === 'Elite Commander') {
    personality = Math.random() < 0.8 ? 'tactical' : 'aggressive';
  } else if (selectedType.name === 'Medic Support') {
    personality = Math.random() < 0.5 ? 'patrol' : 'coward';
  } else {
    // Weighted random selection for other types
    const rand = Math.random();
    let cumulative = 0;
    for (const [pers, weight] of Object.entries(personalityWeights)) {
      cumulative += weight;
      if (rand <= cumulative) {
        personality = pers;
        break;
      }
    }
  }
  
  // RANDOM SPAWN DIRECTIONS - enemies can come from any side!
  const spawnSide = Math.floor(Math.random() * 4); // 0=left, 1=right, 2=top, 3=bottom
  let spawnX, spawnY;
  
  switch (spawnSide) {
    case 0: // Left side
      spawnX = -30;
      spawnY = Math.random() * 420 + 40;
      break;
    case 1: // Right side
      spawnX = 830;
      spawnY = Math.random() * 420 + 40;
      break;
    case 2: // Top side
      spawnX = Math.random() * 760 + 20;
      spawnY = -30;
      break;
    case 3: // Bottom side
      spawnX = Math.random() * 760 + 20;
      spawnY = 530;
      break;
  }
  
  return {
    x: spawnX,
    y: spawnY,
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
    hitFlash: 0,
    
    // Enhanced AI properties
    personality: personality,
    fearLevel: 0,
    maxFear: 100,
    courage: Math.random() * 50 + 25, // 25-75 courage
    alertness: Math.random() * 100,
    lastSawExplosion: 0,
    lastSawDeath: 0,
    behaviorState: 'normal', // normal, fleeing, investigating, patrolling, panicking
    behaviorTimer: 0,
    targetX: 0,
    targetY: 0,
    idleTimer: 0,
    animationOffset: Math.random() * 100, // For varied animations
    
    // Enhanced movement properties
    bouncePhase: Math.random() * Math.PI * 2, // For bouncy movement
    bounceIntensity: 0.5 + Math.random() * 1.5, // How bouncy they are
    walkCycle: 0,
    personalityIntensity: 0.5 + Math.random() * 0.5, // How strongly personality affects behavior
    
    // Patrol behavior
    patrolPoints: [],
    currentPatrolIndex: 0,
    
    // Group behavior
    groupId: Math.floor(Math.random() * 5), // For squad-based AI
    lastGroupCheck: 0,
    
    // Personality-specific properties
    personalityTimer: 0,
    lastPersonalityAction: 0,
    screenTime: 0, // Track how long enemy has been on screen
    personalityActive: false // Personality traits activate after delay
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
    case 'assault':
      baseSprite = pixelAssaultEnemy;
      break;
    case 'stealth':
      baseSprite = pixelStealthEnemy;
      break;
    case 'demolition':
      baseSprite = pixelDemolitionEnemy;
      break;
    case 'medic':
      baseSprite = pixelMedicEnemy;
      break;
    case 'commander':
      baseSprite = pixelCommanderEnemy;
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
      
    // NEW ENEMY SPECIAL ABILITIES
    case 'burst':
      // Assault Trooper fires in bursts
      if (!enemy.burstCount) enemy.burstCount = 0;
      if (!enemy.lastBurst) enemy.lastBurst = 0;
      if (now - enemy.lastBurst > 3000 && Math.random() < 0.15) {
        enemy.burstMode = true;
        enemy.burstCount = 3;
        enemy.lastBurst = now;
        enemy.attackRate = Math.max(200, enemy.attackRate * 0.3); // Faster during burst
      }
      break;
      
    case 'cloak':
      // Stealth Operative can become invisible
      if (!enemy.lastCloak) enemy.lastCloak = 0;
      if (now - enemy.lastCloak > 8000 && Math.random() < 0.08) {
        enemy.cloaked = true;
        enemy.lastCloak = now;
        setTimeout(() => { enemy.cloaked = false; }, 3000);
      }
      break;
      
    case 'explosive':
      // Demolition Expert has explosive projectiles
      enemy.explosiveShots = true;
      break;
      
    case 'heal':
      // Medic can heal nearby allies
      if (!enemy.lastHeal) enemy.lastHeal = 0;
      if (now - enemy.lastHeal > 5000 && Math.random() < 0.1) {
        // Find nearby wounded allies
        for (const ally of allEnemies) {
          if (ally === enemy || !ally.active) continue;
          const dx = ally.x - enemy.x;
          const dy = ally.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 80 && ally.health < ally.maxHealth * 0.8) {
            ally.health = Math.min(ally.maxHealth, ally.health + 20);
            ally.hitFlash = 8; // Green healing flash
            enemy.lastHeal = now;
            break;
          }
        }
      }
      break;
      
    case 'command':
      // Elite Commander boosts nearby allies
      if (!enemy.lastCommand) enemy.lastCommand = 0;
      if (now - enemy.lastCommand > 4000) {
        for (const ally of allEnemies) {
          if (ally === enemy || !ally.active) continue;
          const dx = ally.x - enemy.x;
          const dy = ally.y - enemy.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          if (distance < 100) {
            // Boost ally stats temporarily
            ally.commandBoost = true;
            ally.speed *= 1.2;
            ally.attackRate *= 0.8; // Faster attacks
            setTimeout(() => {
              if (ally.commandBoost) {
                ally.speed /= 1.2;
                ally.attackRate /= 0.8;
                ally.commandBoost = false;
              }
            }, 3000);
          }
        }
        enemy.lastCommand = now;
      }
      break;
  }
}

// Enhanced AI system with fear, varied behaviors, and reactions
export function updateEnemy(enemy, playerX, playerY, allEnemies = [], explosions = []) {
  if (!enemy.active) return null;
  
  enemy.frame = (enemy.frame + 1) % 2;
  if (enemy.hitFlash > 0) enemy.hitFlash--;
  enemy.idleTimer++;
  enemy.behaviorTimer++;
  enemy.screenTime++; // Track screen time
  
  // Activate personality traits after enemy has been on screen for 3 seconds (180 frames at 60fps)
  if (!enemy.personalityActive && enemy.screenTime > 180) {
    enemy.personalityActive = true;
  }
  
  const now = Date.now();
  
  // Check for nearby explosions and deaths to trigger fear
  checkForFearTriggers(enemy, allEnemies, explosions, now);
  
  // Update fear level (decays over time)
  if (enemy.fearLevel > 0) {
    enemy.fearLevel = Math.max(0, enemy.fearLevel - 0.5);
  }
  
  // Determine behavior based on personality, fear, and health
  updateBehaviorState(enemy, playerX, playerY, now);
  
  // Special behaviors based on enemy type
  handleSpecialBehavior(enemy, playerX, playerY);
  
  // Execute current behavior
  const movement = executeBehavior(enemy, playerX, playerY, allEnemies, now);
  
  // Apply movement
  if (movement.dx !== 0 || movement.dy !== 0) {
    enemy.x += movement.dx;
    enemy.y += movement.dy;
    
    // Keep enemies on screen
    enemy.x = Math.max(-20, Math.min(820, enemy.x));
    enemy.y = Math.max(10, Math.min(490, enemy.y));
  }
  
  // Enemy shooting (modified by behavior state)
  const dx = playerX - enemy.x;
  const dy = playerY - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  // Don't shoot if fleeing or panicking
  if (enemy.behaviorState === 'fleeing' || enemy.behaviorState === 'panicking') {
    return null;
  }
  
  // Reduced accuracy when afraid
  const fearAccuracyPenalty = enemy.fearLevel / 100;
  
  if (distance < enemy.attackRange && now - enemy.lastAttack > enemy.attackRate) {
    // Some personalities are less aggressive (only after screen time delay)
    if (enemy.personalityActive) {
      if (enemy.personality === 'coward' && Math.random() < 0.3) return null;
      if (enemy.personality === 'curious' && Math.random() < 0.2) return null;
    }
    
    enemy.lastAttack = now;
    
    // Aim at player with inaccuracy modified by fear and personality
    let bulletDx = dx / distance;
    let bulletDy = dy / distance;
    
    let baseInaccuracy = enemy.sprite === 'sniper' ? 0.05 : 0.2;
    baseInaccuracy += fearAccuracyPenalty * 0.5; // Fear makes them less accurate
    
    // Apply personality accuracy modifiers only after screen time delay
    if (enemy.personalityActive) {
      if (enemy.personality === 'berserker') baseInaccuracy *= 0.7; // More accurate when aggressive
      if (enemy.personality === 'coward') baseInaccuracy *= 1.5; // Less accurate when scared
    }
    
    bulletDx += (Math.random() - 0.5) * baseInaccuracy;
    bulletDy += (Math.random() - 0.5) * baseInaccuracy;
    
    // Normalize
    const newDist = Math.sqrt(bulletDx * bulletDx + bulletDy * bulletDy);
    bulletDx /= newDist;
    bulletDy /= newDist;
    
    // Create base projectile
    const projectile = {
      x: enemy.x + 10,
      y: enemy.y + 10,
      dx: bulletDx * enemy.projectileSpeed,
      dy: bulletDy * enemy.projectileSpeed,
      damage: enemy.damage,
      color: enemy.projectileColor,
      hit: false
    };
    
    // Add special projectile properties
    if (enemy.special === 'explosive' || enemy.explosiveShots) {
      projectile.explosive = true;
      projectile.damage *= 1.5;
    }
    
    if (enemy.special === 'burst' && enemy.burstMode) {
      enemy.burstCount--;
      if (enemy.burstCount <= 0) {
        enemy.burstMode = false;
        enemy.attackRate = Math.max(800, enemy.attackRate / 0.3); // Reset attack rate
      }
    }
    
    return projectile;
  }
  
  return null;
}

function checkForFearTriggers(enemy, allEnemies, explosions, now) {
  // Check for nearby explosions
  for (const explosion of explosions) {
    const dx = explosion.x - enemy.x;
    const dy = explosion.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 100 && now - enemy.lastSawExplosion > 1000) {
      enemy.lastSawExplosion = now;
      const fearIncrease = Math.max(0, 30 - enemy.courage);
      enemy.fearLevel = Math.min(enemy.maxFear, enemy.fearLevel + fearIncrease);
    }
  }
  
  // Check for nearby dead enemies
  for (const otherEnemy of allEnemies) {
    if (otherEnemy === enemy || otherEnemy.active) continue;
    
    const dx = otherEnemy.x - enemy.x;
    const dy = otherEnemy.y - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 80 && now - enemy.lastSawDeath > 2000) {
      enemy.lastSawDeath = now;
      const fearIncrease = Math.max(0, 20 - enemy.courage);
      enemy.fearLevel = Math.min(enemy.maxFear, enemy.fearLevel + fearIncrease);
    }
  }
  
  // Low health increases fear
  if (enemy.health < enemy.maxHealth * 0.3) {
    enemy.fearLevel = Math.min(enemy.maxFear, enemy.fearLevel + 0.2);
  }
}

function updateBehaviorState(enemy, playerX, playerY, now) {
  const dx = playerX - enemy.x;
  const dy = playerY - enemy.y;
  const distanceToPlayer = Math.sqrt(dx * dx + dy * dy);
  
  // High fear triggers fleeing
  if (enemy.fearLevel > enemy.courage && enemy.behaviorState !== 'fleeing') {
    enemy.behaviorState = 'fleeing';
    enemy.behaviorTimer = 0;
    // Set flee target away from player
    enemy.targetX = enemy.x - dx * 2;
    enemy.targetY = enemy.y - dy * 2;
    return;
  }
  
  // ENHANCED personality-based behavior changes - only after screen time delay
  if (!enemy.personalityActive) return; // Don't apply personality traits until enemy has been on screen
  
  const personalityChance = enemy.personalityIntensity * 0.3; // Higher base chance
  
  switch (enemy.personality) {
    case 'coward':
      // Cowards flee more often and from greater distances
      if (distanceToPlayer < 100 && Math.random() < personalityChance) {
        enemy.behaviorState = 'fleeing';
        enemy.targetX = enemy.x - dx * 1.5;
        enemy.targetY = enemy.y - dy * 1.5;
        enemy.speed *= 1.3; // Faster when fleeing
      }
      // Cowards also flee when they see other enemies die
      if (now - enemy.lastSawDeath < 2000 && Math.random() < 0.4) {
        enemy.behaviorState = 'panicking';
        enemy.behaviorTimer = 0;
      }
      break;
      
    case 'curious':
      // Curious enemies investigate more frequently
      if (enemy.behaviorTimer > 150 && Math.random() < personalityChance * 1.5) {
        enemy.behaviorState = 'investigating';
        enemy.targetX = Math.random() * 800;
        enemy.targetY = Math.random() * 500;
        enemy.behaviorTimer = 0;
      }
      // Sometimes they stop to "look around"
      if (Math.random() < 0.02) {
        enemy.behaviorState = 'investigating';
        enemy.targetX = enemy.x + (Math.random() - 0.5) * 100;
        enemy.targetY = enemy.y + (Math.random() - 0.5) * 100;
      }
      break;
      
    case 'patrol':
      // Patrol enemies stick to their routes more consistently
      if (enemy.behaviorState === 'normal' && enemy.behaviorTimer > 100) {
        enemy.behaviorState = 'patrolling';
        if (enemy.patrolPoints.length === 0) {
          // Create more patrol points for better coverage
          for (let i = 0; i < 4; i++) {
            enemy.patrolPoints.push({
              x: Math.random() * 700 + 50,
              y: Math.random() * 400 + 50
            });
          }
        }
        enemy.behaviorTimer = 0;
      }
      break;
      
    case 'berserker':
      // Berserkers become aggressive more easily
      if (enemy.health < enemy.maxHealth * 0.7) {
        enemy.behaviorState = 'berserker';
        enemy.speed *= 1.4; // Even faster
        enemy.attackRate *= 0.7; // Attack faster
      }
      // Berserkers charge at low health
      if (enemy.health < enemy.maxHealth * 0.3 && distanceToPlayer < 150) {
        enemy.behaviorState = 'berserker';
        enemy.targetX = playerX;
        enemy.targetY = playerY;
      }
      break;
      
    case 'aggressive':
      // Aggressive enemies charge more often
      if (distanceToPlayer < 120 && Math.random() < personalityChance * 2) {
        enemy.behaviorState = 'berserker';
        enemy.speed *= 1.2;
        enemy.behaviorTimer = 0;
      }
      break;
      
    case 'tactical':
      // Tactical enemies use cover and positioning
      if (Math.random() < personalityChance && distanceToPlayer > 80) {
        enemy.behaviorState = 'investigating';
        // Move to flanking position
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * Math.PI;
        enemy.targetX = playerX + Math.cos(angle) * 100;
        enemy.targetY = playerY + Math.sin(angle) * 100;
        enemy.behaviorTimer = 0;
      }
      break;
  }
  
  // Return to normal behavior after some time
  if (enemy.behaviorTimer > 600 && enemy.behaviorState !== 'normal') {
    if (enemy.fearLevel < enemy.courage * 0.5) {
      enemy.behaviorState = 'normal';
      enemy.behaviorTimer = 0;
    }
  }
}

function executeBehavior(enemy, playerX, playerY, allEnemies, now) {
  const dx = playerX - enemy.x;
  const dy = playerY - enemy.y;
  const distance = Math.sqrt(dx * dx + dy * dy);
  
  let moveX = 0, moveY = 0;
  let moveSpeed = enemy.speed;
  
  // Apply status effect modifiers
  if (enemy.frozen) {
    moveSpeed *= enemy.slowFactor || 0.5;
  }
  
  switch (enemy.behaviorState) {
    case 'normal':
      // Standard behavior - move toward player
      if (distance > 1) {
        moveX = moveSpeed * (dx / distance);
        moveY = moveSpeed * (dy / distance);
      }
      break;
      
    case 'fleeing':
      // Run away from player or danger
      const fleeX = enemy.targetX - enemy.x;
      const fleeY = enemy.targetY - enemy.y;
      const fleeDist = Math.sqrt(fleeX * fleeX + fleeY * fleeY);
      
      if (fleeDist > 5) {
        moveSpeed *= 1.5; // Flee faster
        moveX = moveSpeed * (fleeX / fleeDist);
        moveY = moveSpeed * (fleeY / fleeDist);
      }
      break;
      
    case 'investigating':
      // Move to investigate something interesting
      const invX = enemy.targetX - enemy.x;
      const invY = enemy.targetY - enemy.y;
      const invDist = Math.sqrt(invX * invX + invY * invY);
      
      if (invDist > 10) {
        moveSpeed *= 0.7; // Move cautiously
        moveX = moveSpeed * (invX / invDist);
        moveY = moveSpeed * (invY / invDist);
      } else {
        // Reached investigation point, look around
        if (Math.random() < 0.1) {
          enemy.behaviorState = 'normal';
        }
      }
      break;
      
    case 'patrolling':
      // Follow patrol route
      if (enemy.patrolPoints.length > 0) {
        const currentPoint = enemy.patrolPoints[enemy.currentPatrolIndex];
        const patX = currentPoint.x - enemy.x;
        const patY = currentPoint.y - enemy.y;
        const patDist = Math.sqrt(patX * patX + patY * patY);
        
        if (patDist > 15) {
          moveSpeed *= 0.8; // Patrol at moderate speed
          moveX = moveSpeed * (patX / patDist);
          moveY = moveSpeed * (patY / patDist);
        } else {
          // Reached patrol point, move to next
          enemy.currentPatrolIndex = (enemy.currentPatrolIndex + 1) % enemy.patrolPoints.length;
        }
        
        // If player gets too close, abandon patrol
        if (distance < 100) {
          enemy.behaviorState = 'normal';
        }
      }
      break;
      
    case 'panicking':
      // Random erratic movement
      moveSpeed *= 0.5;
      moveX = moveSpeed * (Math.random() - 0.5) * 4;
      moveY = moveSpeed * (Math.random() - 0.5) * 4;
      break;
      
    case 'berserker':
      // Aggressive charge toward player
      if (distance > 1) {
        moveSpeed *= 1.8;
        moveX = moveSpeed * (dx / distance);
        moveY = moveSpeed * (dy / distance);
      }
      break;
  }
  
  // ENHANCED BOUNCY MOVEMENT - like the player!
  enemy.walkCycle += 0.2;
  enemy.bouncePhase += 0.15;
  
  // Add personality-based movement variations - only after screen time delay
  let personalityMovement = { x: 0, y: 0 };
  
  if (enemy.personalityActive) {
    switch (enemy.personality) {
    case 'coward':
      // Cowards move erratically when scared
      if (enemy.fearLevel > 30) {
        personalityMovement.x += (Math.random() - 0.5) * 3;
        personalityMovement.y += (Math.random() - 0.5) * 3;
      }
      break;
      
    case 'curious':
      // Curious enemies pause occasionally to "look around"
      if (Math.sin(enemy.walkCycle) > 0.8 && Math.random() < 0.1) {
        moveSpeed *= 0.3; // Slow down to investigate
      }
      break;
      
    case 'berserker':
      // Berserkers have more aggressive movement
      if (enemy.behaviorState === 'berserker') {
        personalityMovement.x += Math.sin(enemy.walkCycle * 2) * 2;
        personalityMovement.y += Math.cos(enemy.walkCycle * 2) * 1;
      }
      break;
      
    case 'patrol':
      // Patrol enemies have steady, rhythmic movement
      personalityMovement.x += Math.sin(enemy.walkCycle * 0.5) * 0.5;
      break;
      
    case 'tactical':
      // Tactical enemies move more deliberately
      if (Math.random() < 0.05) {
        moveSpeed *= 0.5; // Occasional careful movement
      }
      break;
    }
  }
  
  // Add bouncy idle movement for variety
  if (enemy.idleTimer % 60 === 0 && Math.random() < 0.15) {
    personalityMovement.x += (Math.random() - 0.5) * 3;
    personalityMovement.y += (Math.random() - 0.5) * 3;
  }
  
  // Apply personality movement
  moveX += personalityMovement.x;
  moveY += personalityMovement.y;
  
  return { dx: moveX, dy: moveY };
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
  
  // Enemy type and behavior indicator
  const indicator = document.createElement('div');
  indicator.style.position = 'absolute';
  indicator.style.left = (enemy.x + 18) + 'px';
  indicator.style.top = (enemy.y - 6) + 'px';
  indicator.style.width = '6px';
  indicator.style.height = '6px';
  
  // Color based on behavior state
  let indicatorColor = enemy.projectileColor;
  if (enemy.behaviorState === 'fleeing') indicatorColor = '#ffff00'; // Yellow for fleeing
  else if (enemy.behaviorState === 'panicking') indicatorColor = '#ff8800'; // Orange for panic
  else if (enemy.behaviorState === 'investigating') indicatorColor = '#00ffff'; // Cyan for curious
  else if (enemy.behaviorState === 'patrolling') indicatorColor = '#8800ff'; // Purple for patrol
  else if (enemy.behaviorState === 'berserker') indicatorColor = '#ff0000'; // Red for berserker
  
  indicator.style.background = indicatorColor;
  indicator.style.borderRadius = '50%';
  indicator.style.border = '1px solid #000';
  indicator.style.boxShadow = `0 0 4px ${indicatorColor}`;
  
  // Add fear indicator
  if (enemy.fearLevel > 30) {
    indicator.style.animation = 'pulse 0.5s infinite';
  }
  
  container.appendChild(indicator);
  
  // Show personality icon MORE FREQUENTLY for better visibility
  if (Math.random() < 0.25) { // Increased from 0.1 to 0.25
    const personalityIcon = document.createElement('div');
    personalityIcon.style.position = 'absolute';
    personalityIcon.style.left = (enemy.x - 8) + 'px';
    personalityIcon.style.top = (enemy.y - 8) + 'px';
    personalityIcon.style.fontSize = '10px'; // Slightly larger
    personalityIcon.style.color = '#ffffff';
    personalityIcon.style.textShadow = '1px 1px 2px #000000';
    personalityIcon.style.pointerEvents = 'none';
    
    // Add bouncy animation to personality icons
    personalityIcon.style.animation = 'bounce 1s infinite';
    
    switch (enemy.personality) {
      case 'coward': personalityIcon.textContent = '😨'; break;
      case 'curious': personalityIcon.textContent = '🤔'; break;
      case 'patrol': personalityIcon.textContent = '👮'; break;
      case 'berserker': personalityIcon.textContent = '😡'; break;
      case 'tactical': personalityIcon.textContent = '🎯'; break;
      case 'aggressive': personalityIcon.textContent = '💀'; break;
    }
    
    container.appendChild(personalityIcon);
  }
  
  // Render sprite
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const color = sprite[row][col];
      if (color !== 'empty') {
        const pixel = document.createElement('div');
        pixel.className = 'pixel ' + color;
        // BOUNCY MOVEMENT - like the player!
        const bounceOffset = Math.sin(enemy.bouncePhase + enemy.animationOffset) * enemy.bounceIntensity;
        const walkBob = Math.sin(enemy.walkCycle) * 0.5;
        
        // Personality-based movement variations
        let personalityBounce = 0;
        switch (enemy.personality) {
          case 'coward':
            personalityBounce = enemy.fearLevel > 30 ? Math.sin(enemy.bouncePhase * 2) * 1.5 : 0;
            break;
          case 'berserker':
            personalityBounce = enemy.behaviorState === 'berserker' ? Math.sin(enemy.bouncePhase * 3) * 2 : 0;
            break;
          case 'curious':
            personalityBounce = Math.sin(enemy.bouncePhase * 0.7) * 0.8;
            break;
          case 'patrol':
            personalityBounce = Math.sin(enemy.bouncePhase * 0.5) * 0.3;
            break;
        }
        
        pixel.style.left = (enemy.x + col * 2) + 'px';
        pixel.style.top = (enemy.y + row * 2 + bounceOffset + walkBob + personalityBounce) + 'px';
        
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
        } else if (window.chaosGiantChicken || window.chaosChickenTransform) {
          // Make enemies look chicken-themed!
          if (color.includes('shirt')) {
            pixel.style.background = '#ffaa00'; // Chicken yellow
          } else if (color.includes('pants')) {
            pixel.style.background = '#ff6600'; // Chicken orange
          }
          // Add chicken feather effect
          if (Math.random() < 0.1) {
            pixel.style.boxShadow = '0 0 3px #ffaa00';
          }
        } else if (window.chaosPizzaTheme) {
          // Pizza-themed enemies!
          if (color.includes('shirt')) {
            pixel.style.background = '#ff6b35'; // Pizza red
          } else if (color.includes('pants')) {
            pixel.style.background = '#ffd700'; // Cheese yellow
          }
        } else if (window.chaosRobotTransform) {
          // Robotic enemies!
          if (color.includes('skin')) {
            pixel.style.background = '#c0c0c0'; // Metal skin
          } else if (color.includes('shirt')) {
            pixel.style.background = '#808080'; // Metal body
          }
          pixel.style.filter = 'brightness(1.2) contrast(1.5)';
        } else if (window.chaosMedievalWeapons) {
          // Medieval themed enemies!
          if (color.includes('rifle')) {
            pixel.style.background = '#8B4513'; // Wooden weapons
          } else if (color.includes('helmet')) {
            pixel.style.background = '#C0C0C0'; // Metal helmets
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
        
        // NEW ENEMY SPECIAL EFFECTS
        if (enemy.special === 'cloak' && enemy.cloaked) {
          pixel.style.opacity = '0.2';
          pixel.style.filter = 'blur(2px)';
        }
        
        if (enemy.special === 'burst' && enemy.burstMode) {
          pixel.style.boxShadow = '0 0 5px #ff6600';
          if (Math.random() < 0.3) {
            pixel.style.filter = 'brightness(1.5)';
          }
        }
        
        if (enemy.special === 'explosive') {
          pixel.style.boxShadow = '0 0 4px #ff4400';
          if (Math.random() < 0.15) {
            pixel.style.background = '#ff4400';
          }
        }
        
        if (enemy.special === 'heal') {
          pixel.style.boxShadow = '0 0 3px #00ff88';
          if (Math.random() < 0.1) {
            pixel.style.filter = 'brightness(1.3) hue-rotate(120deg)';
          }
        }
        
        if (enemy.special === 'command') {
          pixel.style.boxShadow = '0 0 6px #ffaa00';
          if (Math.random() < 0.2) {
            pixel.style.filter = 'brightness(1.4)';
          }
        }
        
        container.appendChild(pixel);
      }
    }
  }
}