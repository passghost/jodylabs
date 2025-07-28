// bosses.js
// Boss enemy system with multiple boss types

export const bossTypes = [
  {
    name: 'Heavy Tank',
    health: 200,
    speed: 0.8,
    size: { width: 40, height: 30 },
    color: '#666',
    attackPattern: 'straight',
    attackRate: 800,
    damage: 20,
    points: 500,
    sprite: 'tank'
  },
  {
    name: 'War Machine',
    health: 350,
    speed: 1.2,
    size: { width: 50, height: 35 },
    color: '#444',
    attackPattern: 'spread',
    attackRate: 600,
    damage: 15,
    points: 800,
    sprite: 'machine'
  },
  {
    name: 'Mega Destroyer',
    health: 500,
    speed: 0.6,
    size: { width: 60, height: 40 },
    color: '#222',
    attackPattern: 'explosive',
    attackRate: 1000,
    damage: 30,
    points: 1200,
    sprite: 'destroyer'
  },
  {
    name: 'Titan Fortress',
    health: 800,
    speed: 0.4,
    size: { width: 80, height: 60 },
    color: '#111',
    attackPattern: 'barrage',
    attackRate: 500,
    damage: 25,
    points: 2000,
    sprite: 'fortress'
  },
  {
    name: 'Death Walker',
    health: 600,
    speed: 1.0,
    size: { width: 70, height: 50 },
    color: '#330033',
    attackPattern: 'homing',
    attackRate: 1200,
    damage: 35,
    points: 1800,
    sprite: 'walker'
  },
  {
    name: 'Apocalypse Engine',
    health: 1200,
    speed: 0.3,
    size: { width: 100, height: 80 },
    color: '#660000',
    attackPattern: 'chaos',
    attackRate: 400,
    damage: 40,
    points: 3000,
    sprite: 'apocalypse'
  },
  {
    name: 'OMEGA DESTROYER',
    health: 2000,
    speed: 0.5,
    size: { width: 120, height: 100 },
    color: '#000000',
    attackPattern: 'omega',
    attackRate: 300,
    damage: 50,
    points: 10000,
    sprite: 'omega'
  }
];

export function createBoss(type, wave) {
  const bossType = bossTypes[type % bossTypes.length];
  return {
    ...bossType,
    x: 850, // Start off-screen right
    y: Math.random() * 300 + 100,
    maxHealth: bossType.health + (wave * 50), // Scale with wave
    health: bossType.health + (wave * 50),
    lastAttack: 0,
    phase: 'entering',
    targetY: Math.random() * 300 + 100,
    active: true,
    hitFlash: 0,
    attackCooldown: 0
  };
}

export function updateBoss(boss, playerX, playerY, projectiles) {
  if (!boss.active) return;
  
  // Hit flash effect
  if (boss.hitFlash > 0) boss.hitFlash--;
  
  // Movement phases
  switch (boss.phase) {
    case 'entering':
      boss.x -= boss.speed * 2;
      if (boss.x <= 650) {
        boss.phase = 'combat';
        boss.targetY = Math.random() * 300 + 100;
      }
      break;
      
    case 'combat':
      // Vertical movement toward target
      const dy = boss.targetY - boss.y;
      if (Math.abs(dy) > 5) {
        boss.y += Math.sign(dy) * boss.speed;
      } else {
        // Pick new target occasionally
        if (Math.random() < 0.01) {
          boss.targetY = Math.random() * 300 + 100;
        }
      }
      
      // Horizontal oscillation
      boss.x += Math.sin(Date.now() * 0.002) * 0.5;
      boss.x = Math.max(600, Math.min(750, boss.x));
      break;
  }
  
  // Attack logic
  if (boss.attackCooldown > 0) {
    boss.attackCooldown--;
  }
  
  const now = Date.now();
  if (now - boss.lastAttack > boss.attackRate && boss.attackCooldown <= 0) {
    boss.lastAttack = now;
    return createBossAttack(boss, playerX, playerY);
  }
  
  return null;
}

function createBossAttack(boss, playerX, playerY) {
  const attacks = [];
  const centerX = boss.x - 20;
  const centerY = boss.y + boss.size.height / 2;
  
  switch (boss.attackPattern) {
    case 'straight':
      attacks.push({
        x: centerX,
        y: centerY,
        dx: -3,
        dy: 0,
        size: 8,
        color: '#ff4444',
        damage: boss.damage
      });
      break;
      
    case 'spread':
      for (let i = -1; i <= 1; i++) {
        attacks.push({
          x: centerX,
          y: centerY,
          dx: -2.5,
          dy: i * 1.5,
          size: 6,
          color: '#ff8844',
          damage: boss.damage * 0.8
        });
      }
      break;
      
    case 'explosive':
      // Aim at player
      const dx = playerX - centerX;
      const dy = playerY - centerY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      attacks.push({
        x: centerX,
        y: centerY,
        dx: (dx / dist) * -2,
        dy: (dy / dist) * -2,
        size: 12,
        color: '#ff0044',
        damage: boss.damage,
        explosive: true
      });
      break;
      
    case 'barrage':
      // Multiple rapid-fire projectiles
      for (let i = 0; i < 5; i++) {
        attacks.push({
          x: centerX + (Math.random() - 0.5) * 40,
          y: centerY + (Math.random() - 0.5) * 20,
          dx: -3 - Math.random(),
          dy: (Math.random() - 0.5) * 2,
          size: 6,
          color: '#ff6600',
          damage: boss.damage * 0.6
        });
      }
      break;
      
    case 'homing':
      // Homing missiles that track player
      const dx2 = playerX - centerX;
      const dy2 = playerY - centerY;
      const dist2 = Math.sqrt(dx2*dx2 + dy2*dy2);
      attacks.push({
        x: centerX,
        y: centerY,
        dx: (dx2 / dist2) * -1.5,
        dy: (dy2 / dist2) * -1.5,
        size: 10,
        color: '#ff00ff',
        damage: boss.damage,
        homing: true,
        targetX: playerX,
        targetY: playerY
      });
      break;
      
    case 'chaos':
      // Random pattern of different projectile types
      const patterns = ['straight', 'explosive', 'spread'];
      const randomPattern = patterns[Math.floor(Math.random() * patterns.length)];
      
      if (randomPattern === 'straight') {
        for (let i = 0; i < 3; i++) {
          attacks.push({
            x: centerX,
            y: centerY + (i - 1) * 15,
            dx: -4,
            dy: 0,
            size: 8,
            color: '#ff0000',
            damage: boss.damage * 0.8
          });
        }
      } else if (randomPattern === 'explosive') {
        const dx3 = playerX - centerX;
        const dy3 = playerY - centerY;
        const dist3 = Math.sqrt(dx3*dx3 + dy3*dy3);
        attacks.push({
          x: centerX,
          y: centerY,
          dx: (dx3 / dist3) * -2.5,
          dy: (dy3 / dist3) * -2.5,
          size: 14,
          color: '#ff4400',
          damage: boss.damage,
          explosive: true
        });
      } else {
        for (let i = -2; i <= 2; i++) {
          attacks.push({
            x: centerX,
            y: centerY,
            dx: -3,
            dy: i * 1.2,
            size: 7,
            color: '#ff8800',
            damage: boss.damage * 0.7
          });
        }
      }
      break;
      
    case 'omega':
      // Ultimate attack pattern - combines all previous patterns
      const omegaPatterns = ['straight', 'spread', 'explosive', 'barrage'];
      const selectedPattern = omegaPatterns[Math.floor(Math.random() * omegaPatterns.length)];
      
      switch (selectedPattern) {
        case 'straight':
          for (let i = 0; i < 5; i++) {
            attacks.push({
              x: centerX,
              y: centerY + (i - 2) * 10,
              dx: -4,
              dy: 0,
              size: 10,
              color: '#000000',
              damage: boss.damage
            });
          }
          break;
          
        case 'spread':
          for (let i = -2; i <= 2; i++) {
            attacks.push({
              x: centerX,
              y: centerY,
              dx: -3,
              dy: i * 1.8,
              size: 8,
              color: '#ff0000',
              damage: boss.damage * 0.8
            });
          }
          break;
          
        case 'explosive':
          const dx4 = playerX - centerX;
          const dy4 = playerY - centerY;
          const dist4 = Math.sqrt(dx4*dx4 + dy4*dy4);
          for (let i = 0; i < 3; i++) {
            attacks.push({
              x: centerX + (Math.random() - 0.5) * 20,
              y: centerY + (Math.random() - 0.5) * 20,
              dx: (dx4 / dist4) * -2.5,
              dy: (dy4 / dist4) * -2.5,
              size: 14,
              color: '#ff4400',
              damage: boss.damage,
              explosive: true
            });
          }
          break;
          
        case 'barrage':
          for (let i = 0; i < 8; i++) {
            attacks.push({
              x: centerX + (Math.random() - 0.5) * 60,
              y: centerY + (Math.random() - 0.5) * 40,
              dx: -3 - Math.random() * 2,
              dy: (Math.random() - 0.5) * 3,
              size: 7,
              color: '#8800ff',
              damage: boss.damage * 0.7
            });
          }
          break;
      }
      break;
  }
  
  return attacks;
}

export function renderBoss(container, boss) {
  if (!boss.active) return;
  
  // Flash effect when hit
  const flashColor = boss.hitFlash > 0 ? '#fff' : boss.color;
  
  switch (boss.sprite) {
    case 'tank':
      renderTankBoss(container, boss, flashColor);
      break;
    case 'machine':
      renderMachineBoss(container, boss, flashColor);
      break;
    case 'destroyer':
      renderDestroyerBoss(container, boss, flashColor);
      break;
    case 'fortress':
      renderFortressBoss(container, boss, flashColor);
      break;
    case 'walker':
      renderWalkerBoss(container, boss, flashColor);
      break;
    case 'apocalypse':
      renderApocalypseBoss(container, boss, flashColor);
      break;
    case 'omega':
      renderOmegaBoss(container, boss, flashColor);
      break;
  }
}

function renderTankBoss(container, boss, color) {
  // Main body
  const body = document.createElement('div');
  body.style.position = 'absolute';
  body.style.left = boss.x + 'px';
  body.style.top = boss.y + 'px';
  body.style.width = boss.size.width + 'px';
  body.style.height = boss.size.height + 'px';
  body.style.background = `linear-gradient(45deg, ${color}, ${color}88)`;
  body.style.border = '2px solid #333';
  body.style.borderRadius = '4px';
  container.appendChild(body);
  
  // Turret
  const turret = document.createElement('div');
  turret.style.position = 'absolute';
  turret.style.left = (boss.x + 10) + 'px';
  turret.style.top = (boss.y + 5) + 'px';
  turret.style.width = '20px';
  turret.style.height = '20px';
  turret.style.background = color;
  turret.style.border = '1px solid #333';
  turret.style.borderRadius = '50%';
  container.appendChild(turret);
  
  // Barrel
  const barrel = document.createElement('div');
  barrel.style.position = 'absolute';
  barrel.style.left = (boss.x - 15) + 'px';
  barrel.style.top = (boss.y + 12) + 'px';
  barrel.style.width = '20px';
  barrel.style.height = '6px';
  barrel.style.background = '#333';
  barrel.style.border = '1px solid #111';
  container.appendChild(barrel);
}

function renderMachineBoss(container, boss, color) {
  // Main chassis
  const chassis = document.createElement('div');
  chassis.style.position = 'absolute';
  chassis.style.left = boss.x + 'px';
  chassis.style.top = boss.y + 'px';
  chassis.style.width = boss.size.width + 'px';
  chassis.style.height = boss.size.height + 'px';
  chassis.style.background = `linear-gradient(90deg, ${color}, #333, ${color})`;
  chassis.style.border = '2px solid #111';
  chassis.style.borderRadius = '8px';
  container.appendChild(chassis);
  
  // Multiple weapon ports
  for (let i = 0; i < 3; i++) {
    const port = document.createElement('div');
    port.style.position = 'absolute';
    port.style.left = (boss.x - 8) + 'px';
    port.style.top = (boss.y + 8 + i * 8) + 'px';
    port.style.width = '12px';
    port.style.height = '4px';
    port.style.background = '#111';
    port.style.border = '1px solid #333';
    container.appendChild(port);
  }
  
  // Glowing eyes
  const eye1 = document.createElement('div');
  eye1.style.position = 'absolute';
  eye1.style.left = (boss.x + 35) + 'px';
  eye1.style.top = (boss.y + 10) + 'px';
  eye1.style.width = '6px';
  eye1.style.height = '6px';
  eye1.style.background = '#ff0000';
  eye1.style.borderRadius = '50%';
  eye1.style.boxShadow = '0 0 8px #ff0000';
  container.appendChild(eye1);
  
  const eye2 = document.createElement('div');
  eye2.style.position = 'absolute';
  eye2.style.left = (boss.x + 35) + 'px';
  eye2.style.top = (boss.y + 20) + 'px';
  eye2.style.width = '6px';
  eye2.style.height = '6px';
  eye2.style.background = '#ff0000';
  eye2.style.borderRadius = '50%';
  eye2.style.boxShadow = '0 0 8px #ff0000';
  container.appendChild(eye2);
}

function renderDestroyerBoss(container, boss, color) {
  // Massive main body
  const body = document.createElement('div');
  body.style.position = 'absolute';
  body.style.left = boss.x + 'px';
  body.style.top = boss.y + 'px';
  body.style.width = boss.size.width + 'px';
  body.style.height = boss.size.height + 'px';
  body.style.background = `radial-gradient(circle, ${color}, #111)`;
  body.style.border = '3px solid #333';
  body.style.borderRadius = '12px';
  container.appendChild(body);
  
  // Armor plating
  for (let i = 0; i < 4; i++) {
    const plate = document.createElement('div');
    plate.style.position = 'absolute';
    plate.style.left = (boss.x + 5 + i * 12) + 'px';
    plate.style.top = (boss.y + 5) + 'px';
    plate.style.width = '8px';
    plate.style.height = '30px';
    plate.style.background = '#555';
    plate.style.border = '1px solid #333';
    plate.style.borderRadius = '2px';
    container.appendChild(plate);
  }
  
  // Main cannon
  const cannon = document.createElement('div');
  cannon.style.position = 'absolute';
  cannon.style.left = (boss.x - 25) + 'px';
  cannon.style.top = (boss.y + 15) + 'px';
  cannon.style.width = '30px';
  cannon.style.height = '10px';
  cannon.style.background = '#111';
  cannon.style.border = '2px solid #333';
  cannon.style.borderRadius = '5px';
  container.appendChild(cannon);
  
  // Menacing red glow
  const glow = document.createElement('div');
  glow.style.position = 'absolute';
  glow.style.left = (boss.x + 45) + 'px';
  glow.style.top = (boss.y + 15) + 'px';
  glow.style.width = '10px';
  glow.style.height = '10px';
  glow.style.background = '#ff0000';
  glow.style.borderRadius = '50%';
  glow.style.boxShadow = '0 0 20px #ff0000';
  glow.style.opacity = '0.8';
  container.appendChild(glow);
}

function renderFortressBoss(container, boss, color) {
  // Massive fortress structure
  const body = document.createElement('div');
  body.style.position = 'absolute';
  body.style.left = boss.x + 'px';
  body.style.top = boss.y + 'px';
  body.style.width = boss.size.width + 'px';
  body.style.height = boss.size.height + 'px';
  body.style.background = `linear-gradient(45deg, ${color}, #333, ${color})`;
  body.style.border = '4px solid #222';
  body.style.borderRadius = '8px';
  container.appendChild(body);
  
  // Multiple turrets
  for (let i = 0; i < 4; i++) {
    const turret = document.createElement('div');
    turret.style.position = 'absolute';
    turret.style.left = (boss.x + 10 + i * 15) + 'px';
    turret.style.top = (boss.y - 5) + 'px';
    turret.style.width = '12px';
    turret.style.height = '12px';
    turret.style.background = '#333';
    turret.style.border = '2px solid #111';
    turret.style.borderRadius = '50%';
    container.appendChild(turret);
    
    // Turret barrels
    const barrel = document.createElement('div');
    barrel.style.position = 'absolute';
    barrel.style.left = (boss.x + 5 + i * 15) + 'px';
    barrel.style.top = (boss.y + 4) + 'px';
    barrel.style.width = '8px';
    barrel.style.height = '4px';
    barrel.style.background = '#111';
    barrel.style.border = '1px solid #000';
    container.appendChild(barrel);
  }
  
  // Fortress walls
  for (let i = 0; i < 6; i++) {
    const wall = document.createElement('div');
    wall.style.position = 'absolute';
    wall.style.left = (boss.x + 5 + i * 12) + 'px';
    wall.style.top = (boss.y + 15) + 'px';
    wall.style.width = '8px';
    wall.style.height = '40px';
    wall.style.background = '#444';
    wall.style.border = '1px solid #222';
    container.appendChild(wall);
  }
}

function renderWalkerBoss(container, boss, color) {
  // Main walker body
  const body = document.createElement('div');
  body.style.position = 'absolute';
  body.style.left = boss.x + 'px';
  body.style.top = boss.y + 'px';
  body.style.width = boss.size.width + 'px';
  body.style.height = boss.size.height + 'px';
  body.style.background = `radial-gradient(ellipse, ${color}, #111)`;
  body.style.border = '3px solid #222';
  body.style.borderRadius = '15px';
  container.appendChild(body);
  
  // Walker legs (animated)
  const legOffset = Math.sin(Date.now() * 0.01) * 3;
  for (let i = 0; i < 4; i++) {
    const leg = document.createElement('div');
    leg.style.position = 'absolute';
    leg.style.left = (boss.x + 10 + i * 15) + 'px';
    leg.style.top = (boss.y + boss.size.height + legOffset * (i % 2 === 0 ? 1 : -1)) + 'px';
    leg.style.width = '6px';
    leg.style.height = '15px';
    leg.style.background = '#333';
    leg.style.border = '1px solid #111';
    leg.style.borderRadius = '3px';
    container.appendChild(leg);
  }
  
  // Head with glowing eyes
  const head = document.createElement('div');
  head.style.position = 'absolute';
  head.style.left = (boss.x + boss.size.width - 20) + 'px';
  head.style.top = (boss.y + 10) + 'px';
  head.style.width = '25px';
  head.style.height = '20px';
  head.style.background = color;
  head.style.border = '2px solid #111';
  head.style.borderRadius = '8px';
  container.appendChild(head);
  
  // Glowing purple eyes
  for (let i = 0; i < 2; i++) {
    const eye = document.createElement('div');
    eye.style.position = 'absolute';
    eye.style.left = (boss.x + boss.size.width - 15 + i * 8) + 'px';
    eye.style.top = (boss.y + 15) + 'px';
    eye.style.width = '4px';
    eye.style.height = '4px';
    eye.style.background = '#ff00ff';
    eye.style.borderRadius = '50%';
    eye.style.boxShadow = '0 0 8px #ff00ff';
    container.appendChild(eye);
  }
  
  // Weapon pods
  for (let i = 0; i < 2; i++) {
    const pod = document.createElement('div');
    pod.style.position = 'absolute';
    pod.style.left = (boss.x - 10) + 'px';
    pod.style.top = (boss.y + 15 + i * 20) + 'px';
    pod.style.width = '15px';
    pod.style.height = '8px';
    pod.style.background = '#222';
    pod.style.border = '1px solid #111';
    pod.style.borderRadius = '4px';
    container.appendChild(pod);
  }
}

function renderApocalypseBoss(container, boss, color) {
  // Massive apocalypse engine
  const body = document.createElement('div');
  body.style.position = 'absolute';
  body.style.left = boss.x + 'px';
  body.style.top = boss.y + 'px';
  body.style.width = boss.size.width + 'px';
  body.style.height = boss.size.height + 'px';
  body.style.background = `conic-gradient(${color}, #000, ${color}, #000)`;
  body.style.border = '5px solid #000';
  body.style.borderRadius = '20px';
  body.style.boxShadow = `0 0 20px ${color}`;
  container.appendChild(body);
  
  // Multiple weapon systems
  for (let i = 0; i < 8; i++) {
    const weapon = document.createElement('div');
    weapon.style.position = 'absolute';
    weapon.style.left = (boss.x + 10 + (i % 4) * 20) + 'px';
    weapon.style.top = (boss.y + 10 + Math.floor(i / 4) * 30) + 'px';
    weapon.style.width = '12px';
    weapon.style.height = '12px';
    weapon.style.background = '#000';
    weapon.style.border = '2px solid #333';
    weapon.style.borderRadius = '50%';
    container.appendChild(weapon);
    
    // Weapon barrels
    const barrel = document.createElement('div');
    barrel.style.position = 'absolute';
    barrel.style.left = (boss.x + 2 + (i % 4) * 20) + 'px';
    barrel.style.top = (boss.y + 14 + Math.floor(i / 4) * 30) + 'px';
    barrel.style.width = '15px';
    barrel.style.height = '4px';
    barrel.style.background = '#111';
    barrel.style.border = '1px solid #000';
    container.appendChild(barrel);
  }
  
  // Central core with pulsing glow
  const core = document.createElement('div');
  core.style.position = 'absolute';
  core.style.left = (boss.x + boss.size.width/2 - 15) + 'px';
  core.style.top = (boss.y + boss.size.height/2 - 15) + 'px';
  core.style.width = '30px';
  core.style.height = '30px';
  core.style.background = '#ff0000';
  core.style.borderRadius = '50%';
  core.style.border = '3px solid #000';
  const pulseIntensity = Math.sin(Date.now() * 0.01) * 0.5 + 0.5;
  core.style.boxShadow = `0 0 ${20 + pulseIntensity * 20}px #ff0000`;
  container.appendChild(core);
  
  // Armor plating
  for (let i = 0; i < 12; i++) {
    const plate = document.createElement('div');
    const angle = (i / 12) * Math.PI * 2;
    const radius = 35;
    plate.style.position = 'absolute';
    plate.style.left = (boss.x + boss.size.width/2 + Math.cos(angle) * radius - 4) + 'px';
    plate.style.top = (boss.y + boss.size.height/2 + Math.sin(angle) * radius - 4) + 'px';
    plate.style.width = '8px';
    plate.style.height = '8px';
    plate.style.background = '#333';
    plate.style.border = '1px solid #111';
    plate.style.borderRadius = '2px';
    container.appendChild(plate);
  }
}

function renderOmegaBoss(container, boss, color) {
  // Massive OMEGA DESTROYER - ultimate final boss
  const body = document.createElement('div');
  body.style.position = 'absolute';
  body.style.left = boss.x + 'px';
  body.style.top = boss.y + 'px';
  body.style.width = boss.size.width + 'px';
  body.style.height = boss.size.height + 'px';
  body.style.background = `radial-gradient(circle, ${color}, #330000, #000000)`;
  body.style.border = '6px solid #ff0000';
  body.style.borderRadius = '25px';
  body.style.boxShadow = `0 0 30px #ff0000, inset 0 0 20px #660000`;
  container.appendChild(body);
  
  // Multiple weapon arrays
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const weapon = document.createElement('div');
      weapon.style.position = 'absolute';
      weapon.style.left = (boss.x + 15 + col * 25) + 'px';
      weapon.style.top = (boss.y + 15 + row * 25) + 'px';
      weapon.style.width = '15px';
      weapon.style.height = '15px';
      weapon.style.background = '#000';
      weapon.style.border = '3px solid #ff0000';
      weapon.style.borderRadius = '50%';
      container.appendChild(weapon);
      
      // Weapon barrels with glow
      const barrel = document.createElement('div');
      barrel.style.position = 'absolute';
      barrel.style.left = (boss.x + 5 + col * 25) + 'px';
      barrel.style.top = (boss.y + 18 + row * 25) + 'px';
      barrel.style.width = '20px';
      barrel.style.height = '6px';
      barrel.style.background = '#ff0000';
      barrel.style.border = '2px solid #000';
      barrel.style.boxShadow = '0 0 8px #ff0000';
      container.appendChild(barrel);
    }
  }
  
  // Central command core with intense pulsing
  const core = document.createElement('div');
  core.style.position = 'absolute';
  core.style.left = (boss.x + boss.size.width/2 - 20) + 'px';
  core.style.top = (boss.y + boss.size.height/2 - 20) + 'px';
  core.style.width = '40px';
  core.style.height = '40px';
  core.style.background = '#ffffff';
  core.style.borderRadius = '50%';
  core.style.border = '4px solid #000';
  const pulseIntensity = Math.sin(Date.now() * 0.02) * 0.8 + 0.2;
  core.style.boxShadow = `0 0 ${30 + pulseIntensity * 40}px #ffffff, 0 0 ${60 + pulseIntensity * 80}px #ff0000`;
  container.appendChild(core);
  
  // Rotating shield generators
  for (let i = 0; i < 6; i++) {
    const shield = document.createElement('div');
    const angle = (i / 6) * Math.PI * 2 + (Date.now() * 0.005);
    const radius = 50;
    shield.style.position = 'absolute';
    shield.style.left = (boss.x + boss.size.width/2 + Math.cos(angle) * radius - 6) + 'px';
    shield.style.top = (boss.y + boss.size.height/2 + Math.sin(angle) * radius - 6) + 'px';
    shield.style.width = '12px';
    shield.style.height = '12px';
    shield.style.background = '#00ffff';
    shield.style.border = '2px solid #000';
    shield.style.borderRadius = '50%';
    shield.style.boxShadow = '0 0 12px #00ffff';
    container.appendChild(shield);
  }
  
  // Menacing spikes
  for (let i = 0; i < 8; i++) {
    const spike = document.createElement('div');
    const angle = (i / 8) * Math.PI * 2;
    const radius = 55;
    spike.style.position = 'absolute';
    spike.style.left = (boss.x + boss.size.width/2 + Math.cos(angle) * radius - 3) + 'px';
    spike.style.top = (boss.y + boss.size.height/2 + Math.sin(angle) * radius - 8) + 'px';
    spike.style.width = '6px';
    spike.style.height = '16px';
    spike.style.background = '#666';
    spike.style.border = '1px solid #000';
    spike.style.borderRadius = '3px 3px 0 0';
    spike.style.transform = `rotate(${angle}rad)`;
    container.appendChild(spike);
  }
}

export function checkBossCollision(boss, projectiles) {
  if (!boss.active) return false;
  
  let hit = false;
  for (const projectile of projectiles) {
    if (projectile.hit) continue;
    
    const dx = projectile.x - (boss.x + boss.size.width / 2);
    const dy = projectile.y - (boss.y + boss.size.height / 2);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < boss.size.width / 2 + 10) {
      projectile.hit = true;
      boss.health -= 25;
      boss.hitFlash = 10;
      boss.attackCooldown = 30; // Brief stun
      hit = true;
      
      if (boss.health <= 0) {
        boss.active = false;
        return 'destroyed';
      }
    }
  }
  
  return hit ? 'hit' : false;
}