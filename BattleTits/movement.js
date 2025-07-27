import { pixelCommando, pixelCommandoRed } from './pixel-commando.js';
import {
  createWeaponBloodEffect,
  createBloodPool,
  createDeathBloodEffect,
  createBloodSplatter,
  createBloodEffect,
  createBloodFountain,
  renderBloodEffects,
  renderBloodPools
} from './bloodEffects.js';
import { spawnPowerup, powerupTypes, renderPowerupGraphic } from './powerups.js';
import { createBoss, updateBoss, renderBoss, checkBossCollision, bossTypes } from './bosses.js';
import { createEnemy, updateEnemy, renderEnemy } from './enemies.js';
import { triggerChaosEvent, showChaosMessage, getRandomMessage, spawnShadowCreature, spawnQuantumParticle } from './chaos.js';

// Game state management
let gameState = 'playing'; // 'playing', 'paused', 'gameOver', 'victory'
let score = 0;
let level = 1;
let enemiesKilled = 0;
let enemiesPerLevel = 15;
let levelComplete = false;

// DOM elements
const container = document.getElementById('game-area');
const projectileLayer = document.getElementById('projectile-layer');
const effectsLayer = document.getElementById('effects-layer');
const healthBar = document.getElementById('health-bar');
const ammoBar = document.getElementById('ammo-bar');
const scoreBar = document.getElementById('score-bar');
const levelBar = document.getElementById('level-bar');
const powerupList = document.getElementById('powerup-list');
const bossHealthBar = document.getElementById('boss-health');
const bossHealthFill = document.getElementById('boss-health-fill');

// Game constants
const pixelSize = 2;
const projectileSize = 6;
const projectileSpeed = 8;
const gameWidth = 800;
const gameHeight = 500;

// Player state
let posX = 100, posY = 200;
let lastDirection = 'd';
let animFrame = 0;
let isMoving = false;
let playerHealth = 100;
const maxPlayerHealth = 100;
let playerShield = 0;

// Weapon state
let ammo = 30;
const maxAmmo = 30;
let reloading = false;
const reloadTime = 2000;
let lastShot = 0;
let fireRate = 150;
let weaponType = 'normal';

// Projectile state
let projectiles = [];
let enemyProjectiles = [];

// Effects state
let bloodEffects = [];
let explosions = [];
let muzzleFlashes = [];

// Enemy state
let enemies = [];
let currentBoss = null;
let bossProjectiles = [];

// Powerup state
let powerups = [];
let activePowerups = [];

// Game initialization
function initGame() {
  gameState = 'playing';
  score = 0;
  level = 1;
  enemiesKilled = 0;
  levelComplete = false;
  posX = 100;
  posY = 200;
  playerHealth = maxPlayerHealth;
  playerShield = 0;
  ammo = maxAmmo;
  reloading = false;
  weaponType = 'normal';
  fireRate = 150;
  
  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  bossProjectiles = [];
  powerups = [];
  activePowerups = [];
  bloodEffects = [];
  explosions = [];
  muzzleFlashes = [];
  currentBoss = null;
  
  document.getElementById('game-over').style.display = 'none';
  document.getElementById('victory').style.display = 'none';
  document.getElementById('pause-screen').style.display = 'none';
  
  updateUI();
  startLevel();
}

function updateUI() {
  // Health bar
  if (healthBar) {
    const healthPercent = (playerHealth / maxPlayerHealth) * 100;
    healthBar.innerHTML = `
      <div style="background: linear-gradient(90deg, #ff0000 ${healthPercent}%, #330000 ${healthPercent}%); 
                  width: 100%; height: 100%; border-radius: 2px; display: flex; align-items: center; justify-content: center;">
        ◤ VITALS: ${playerHealth}/${maxPlayerHealth} ◥
      </div>
    `;
  }
  
  // Ammo bar
  if (ammoBar) {
    if (reloading) {
      ammoBar.innerHTML = '<div style="color: #ff8800; animation: pulse-red 0.5s infinite;">◤ RELOADING... ◥</div>';
    } else {
      const ammoPercent = (ammo / maxAmmo) * 100;
      ammoBar.innerHTML = `
        <div style="background: linear-gradient(90deg, #ffaa00 ${ammoPercent}%, #333300 ${ammoPercent}%); 
                    width: 100%; height: 100%; border-radius: 2px; display: flex; align-items: center; justify-content: center;">
          ◤ ROUNDS: ${ammo}/${maxAmmo} ◥
        </div>
      `;
    }
  }
  
  // Score and level
  if (scoreBar) {
    scoreBar.innerHTML = `◤ MISSION SCORE: ${score.toLocaleString()} ◥`;
  }
  
  if (levelBar) {
    const remaining = Math.max(0, enemiesPerLevel - enemiesKilled);
    const progressPercent = Math.min(100, (enemiesKilled / enemiesPerLevel) * 100);
    
    let barStyle = `background: linear-gradient(90deg, #00ff00 ${progressPercent}%, #333 ${progressPercent}%);`;
    let textContent = `◤ SECTOR ${level} - HOSTILES: ${remaining} (${enemiesKilled}/${enemiesPerLevel}) ◥`;
    
    // Special display for boss level
    if (level === 10) {
      if (currentBoss && currentBoss.active) {
        textContent = `◤ FINAL BOSS - ${currentBoss.name.toUpperCase()} ◥`;
        barStyle = `background: linear-gradient(90deg, #ff0000 50%, #660000 50%); animation: pulse-red 1s infinite;`;
      } else {
        textContent = `◤ FINAL BOSS DEFEATED! ◥`;
        barStyle = `background: linear-gradient(90deg, #00ff00 100%, #00ff00 100%);`;
      }
    }
    
    // CHAOS UI EFFECTS!
    else if (window.chaosDiscoMode) {
      barStyle = `background: linear-gradient(90deg, #ff00ff ${progressPercent}%, #00ffff ${progressPercent}%); animation: rainbow 0.5s infinite;`;
      textContent = `🕺 SECTOR ${level} - DANCE HOSTILES: ${remaining} 🕺`;
    } else if (window.chaosGiantChicken) {
      barStyle = `background: linear-gradient(90deg, #ffaa00 ${progressPercent}%, #8B4513 ${progressPercent}%);`;
      textContent = `🐔 SECTOR ${level} - POULTRY THREAT: ${remaining} 🐔`;
    } else if (window.chaosSlippery) {
      barStyle = `background: linear-gradient(90deg, #ffff00 ${progressPercent}%, #ffaa00 ${progressPercent}%); animation: wiggle 0.3s infinite;`;
      textContent = `🍌 SECTOR ${level} - SLIPPERY HOSTILES: ${remaining} 🍌`;
    }
    
    levelBar.innerHTML = `
      <div style="${barStyle} width: 100%; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: center;">
        ${textContent}
      </div>
    `;
  }
  
  // Boss health
  if (currentBoss && currentBoss.active) {
    bossHealthBar.style.display = 'block';
    const healthPercent = (currentBoss.health / currentBoss.maxHealth) * 100;
    bossHealthFill.style.width = healthPercent + '%';
    document.getElementById('boss-health-text').textContent = `${currentBoss.name.toUpperCase()} - ${currentBoss.health}/${currentBoss.maxHealth}`;
  } else {
    bossHealthBar.style.display = 'none';
  }
  
  // Active powerups
  if (powerupList) {
    let content = '<b>◤ ACTIVE EQUIPMENT ◥</b><br>';
    if (activePowerups.length === 0) {
      content += '<span style="color:#666; font-style: italic;">NO EQUIPMENT ACTIVE</span>';
    } else {
      activePowerups.forEach(p => {
        const remaining = Math.ceil((p.endTime - Date.now()) / 1000);
        content += `<div style="color:${p.color}; margin: 3px 0; text-shadow: 0 0 5px ${p.color};">▶ ${p.effect} [${remaining}s]</div>`;
      });
    }
    powerupList.innerHTML = content;
  }
}

// Level management
function startLevel() {
  enemiesKilled = 0;
  levelComplete = false;
  
  // Clear any remaining enemies from previous level
  enemies = [];
  enemyProjectiles = [];
  
  console.log(`Starting level ${level}`);
  
  // CHAOS EVENT! Random mayhem at start of each level!
  console.log('Triggering chaos event...');
  triggerChaosEvent();
  
  // Calculate enemies per level based on difficulty
  enemiesPerLevel = Math.min(10 + (level * 3), 50);
  
  console.log(`Level ${level} requires ${enemiesPerLevel} enemies to be killed`);
  
  // Level 10 is boss level
  if (level === 10) {
    showChaosMessage("💀 FINAL BOSS INCOMING! PREPARE FOR DOOM! 💀");
    enemiesPerLevel = 1; // Boss counts as 1 "enemy" for completion
    spawnFinalBoss();
    updateUI();
    return;
  }
  
  // Spawn regular enemies with increasing difficulty
  const baseSpawnInterval = 1500;
  const enemySpawnInterval = Math.max(400, baseSpawnInterval - (level * 100));
  let enemiesSpawned = 0;
  
  const spawnTimer = setInterval(() => {
    if (gameState !== 'playing' || levelComplete) {
      clearInterval(spawnTimer);
      return;
    }
    
    spawnEnemy();
    enemiesSpawned++;
    console.log(`Spawned enemy ${enemiesSpawned}/${enemiesPerLevel}`);
    
    if (enemiesSpawned >= enemiesPerLevel) {
      clearInterval(spawnTimer);
      console.log(`Finished spawning all ${enemiesPerLevel} enemies for level ${level}`);
    }
  }, enemySpawnInterval);
  
  updateUI();
}

function completeLevel() {
  if (levelComplete) return; // Prevent double completion
  
  levelComplete = true;
  console.log(`Level ${level} completed! Enemies killed: ${enemiesKilled}/${enemiesPerLevel}`);
  
  // Level completion bonuses
  score += level * 500;
  playerHealth = Math.min(maxPlayerHealth, playerHealth + 20);
  
  // Spawn bonus powerup
  powerups.push(spawnPowerup(level));
  
  // Show completion message
  showChaosMessage(`◤ SECTOR ${level} CLEARED! ◥`);
  
  // Check for game completion
  if (level >= 10) {
    setTimeout(() => {
      victory();
    }, 1000);
    return;
  }
  
  // Advance to next level after delay
  setTimeout(() => {
    if (gameState === 'playing') {
      level++;
      console.log(`Advancing to level ${level}`);
      startLevel();
    }
  }, 3000); // Longer delay to see completion message
  
  updateUI();
}

function spawnEnemy() {
  const enemy = createEnemy(level);
  
  // Apply level-based difficulty scaling
  const difficulty = 1 + (level - 1) * 0.3; // More aggressive scaling
  enemy.health = Math.floor(enemy.health * difficulty);
  enemy.maxHealth = enemy.health;
  enemy.speed *= (1 + (level - 1) * 0.15);
  enemy.damage = Math.floor(enemy.damage * difficulty);
  enemy.points = Math.floor(enemy.points * (1 + (level - 1) * 0.3));
  
  console.log(`Spawned ${enemy.type} (${enemy.sprite}) - Health: ${enemy.health}, Special: ${enemy.special || 'none'}`);
  
  enemies.push(enemy);
}

function spawnFinalBoss() {
  // Level 10 final boss - OMEGA DESTROYER
  currentBoss = createBoss(6, level); // Boss type 6 is the Omega Destroyer
  updateUI();
}

// Rendering functions
function getAnimatedCommando(frame) {
  const sprite = JSON.parse(JSON.stringify(pixelCommando));
  if (frame % 2 === 1) {
    sprite[8][2] = 'boots'; sprite[8][8] = 'empty';
    sprite[9][2] = 'empty'; sprite[9][8] = 'boots';
  } else {
    sprite[8][2] = 'empty'; sprite[8][8] = 'boots';
    sprite[9][2] = 'boots'; sprite[9][8] = 'empty';
  }
  return sprite;
}

function renderCommando(x, y, frame = 0, bob = 0) {
  const sprite = isMoving ? getAnimatedCommando(frame) : pixelCommando;
  
  // CHAOS EFFECTS!
  let renderScale = 1;
  let renderRotation = 0;
  
  if (window.chaosTinyMode) renderScale = 0.5;
  if (window.chaosDiscoMode) renderRotation = Math.sin(Date.now() * 0.01) * 15;
  if (window.chaosBouncyCastle) bob += Math.sin(Date.now() * 0.005) * 10;
  
  // Shield effect
  if (playerShield > 0) {
    const shield = document.createElement('div');
    shield.style.position = 'absolute';
    shield.style.left = (x - 5) + 'px';
    shield.style.top = (y - 5 + bob) + 'px';
    shield.style.width = (pixelCommando[0].length * pixelSize + 10) + 'px';
    shield.style.height = (pixelCommando.length * pixelSize + 10) + 'px';
    shield.style.border = '2px solid #00bcd4';
    shield.style.borderRadius = '50%';
    shield.style.boxShadow = '0 0 10px #00bcd4';
    shield.style.opacity = '0.6';
    shield.style.transform = `scale(${renderScale}) rotate(${renderRotation}deg)`;
    container.appendChild(shield);
  }
  
  for (let row = 0; row < sprite.length; row++) {
    for (let col = 0; col < sprite[row].length; col++) {
      const color = sprite[row][col];
      if (color !== 'empty') {
        const pixel = document.createElement('div');
        pixel.className = 'pixel ' + color;
        pixel.style.left = (x + col * pixelSize * renderScale) + 'px';
        pixel.style.top = (y + row * pixelSize * renderScale + bob) + 'px';
        pixel.style.width = (2 * renderScale) + 'px';
        pixel.style.height = (2 * renderScale) + 'px';
        pixel.style.transform = `rotate(${renderRotation}deg)`;
        
        // CHAOS: Multiple color effects!
        if (window.chaosDiscoMode) {
          const rainbowColors = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0080ff', '#8000ff'];
          pixel.style.background = rainbowColors[Math.floor(Date.now() * 0.01 + row + col) % rainbowColors.length];
          pixel.style.boxShadow = `0 0 5px ${pixel.style.background}`;
        } else if (window.chaosNeonRave) {
          const neonColors = ['#ff00ff', '#00ffff', '#ffff00', '#ff0080'];
          pixel.style.background = neonColors[Math.floor(Date.now() * 0.02 + row * col) % neonColors.length];
          pixel.style.boxShadow = `0 0 8px ${pixel.style.background}`;
        } else if (window.chaosSlippery) {
          // Banana theme colors!
          const bananaColors = ['#ffff00', '#ffaa00', '#ff8800'];
          if (color === 'shirt' || color === 'shirt2') {
            pixel.style.background = bananaColors[Math.floor(Date.now() * 0.005) % bananaColors.length];
          }
        }
        
        container.appendChild(pixel);
      }
    }
  }
}

function getAnimatedEnemyRed(frame) {
  const sprite = JSON.parse(JSON.stringify(pixelCommandoRed));
  if (frame % 2 === 1) {
    sprite[8][2] = 'boots'; sprite[8][8] = 'empty';
    sprite[9][2] = 'empty'; sprite[9][8] = 'boots';
  } else {
    sprite[8][2] = 'empty'; sprite[8][8] = 'boots';
    sprite[9][2] = 'boots'; sprite[9][8] = 'empty';
  }
  return sprite;
}

// Enemy rendering is now handled by enemies.js

function renderProjectiles() {
  if (!projectileLayer) return;
  projectileLayer.innerHTML = '';
  
  // Player projectiles
  for (const p of projectiles) {
    if (p.hit && !p.pierce) continue;
    
    const bullet = document.createElement('div');
    bullet.style.position = 'absolute';
    bullet.style.width = (p.size || projectileSize) + 'px';
    bullet.style.height = (p.size || projectileSize) + 'px';
    bullet.style.left = p.x + 'px';
    bullet.style.top = p.y + 'px';
    
    // CHAOS: Rainbow bullets!
    if (window.chaosRainbowBullets) {
      const rainbowColors = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0080ff', '#8000ff', '#ff00ff'];
      bullet.style.background = rainbowColors[Math.floor(Date.now() * 0.02 + p.x * 0.1) % rainbowColors.length];
    } else {
      bullet.style.background = p.color || '#ffff00';
    }
    bullet.style.border = '1px solid #000';
    
    // Special effects for different weapon types
    if (p.nuclear) {
      bullet.style.borderRadius = '0';
      bullet.style.boxShadow = `0 0 15px ${p.color}, 0 0 30px ${p.color}`;
      bullet.style.animation = 'pulse 0.2s infinite';
    } else if (p.antimatter) {
      bullet.style.borderRadius = '50%';
      bullet.style.boxShadow = `0 0 20px #ffffff, 0 0 40px #ffffff`;
      bullet.style.border = '2px solid #000';
    } else if (p.quantum) {
      bullet.style.borderRadius = '30%';
      bullet.style.boxShadow = `0 0 10px ${p.color}`;
      bullet.style.transform = `rotate(${Date.now() * 0.01}rad)`;
    } else if (p.laser || p.railgun) {
      bullet.style.borderRadius = '20%';
      bullet.style.boxShadow = `0 0 8px ${p.color}`;
    } else if (p.explosive || p.plasma) {
      bullet.style.borderRadius = '0';
      bullet.style.boxShadow = `0 0 8px ${p.color}`;
    } else {
      bullet.style.borderRadius = '50%';
      bullet.style.boxShadow = `0 0 4px ${p.color}`;
    }
    
    projectileLayer.appendChild(bullet);
  }
  
  // Enemy projectiles
  for (const p of enemyProjectiles) {
    const bullet = document.createElement('div');
    bullet.style.position = 'absolute';
    bullet.style.width = '4px';
    bullet.style.height = '4px';
    bullet.style.left = p.x + 'px';
    bullet.style.top = p.y + 'px';
    bullet.style.background = p.color || '#ff4444';
    bullet.style.border = '1px solid #aa0000';
    bullet.style.borderRadius = '50%';
    bullet.style.boxShadow = `0 0 4px ${p.color || '#ff4444'}`;
    projectileLayer.appendChild(bullet);
  }
  
  // Boss projectiles
  for (const p of bossProjectiles) {
    const bullet = document.createElement('div');
    bullet.style.position = 'absolute';
    bullet.style.width = p.size + 'px';
    bullet.style.height = p.size + 'px';
    bullet.style.left = p.x + 'px';
    bullet.style.top = p.y + 'px';
    bullet.style.background = p.color;
    bullet.style.border = '2px solid #000';
    bullet.style.borderRadius = p.explosive || p.homing ? '0' : '50%';
    bullet.style.boxShadow = `0 0 ${p.size}px ${p.color}`;
    
    // Special effects for homing missiles
    if (p.homing) {
      bullet.style.transform = `rotate(${Math.atan2(p.dy, p.dx) * 180 / Math.PI}deg)`;
      bullet.style.borderRadius = '20% 80% 20% 80%';
    }
    
    projectileLayer.appendChild(bullet);
  }
}

function renderEffects() {
  if (!effectsLayer) return;
  effectsLayer.innerHTML = '';
  
  // Render blood pools first (behind other effects)
  renderBloodPools(effectsLayer, bloodPools);
  
  // Render enhanced blood effects
  renderBloodEffects(effectsLayer, bloodEffects);
  
  // Explosions
  for (const explosion of explosions) {
    const expElem = document.createElement('div');
    expElem.style.position = 'absolute';
    expElem.style.left = (explosion.x - explosion.size/2) + 'px';
    expElem.style.top = (explosion.y - explosion.size/2) + 'px';
    expElem.style.width = explosion.size + 'px';
    expElem.style.height = explosion.size + 'px';
    expElem.style.background = `radial-gradient(circle, #ffaa00, #ff4400, transparent)`;
    expElem.style.borderRadius = '50%';
    expElem.style.opacity = explosion.opacity;
    expElem.style.boxShadow = `0 0 ${explosion.size}px #ff8800`;
    effectsLayer.appendChild(expElem);
  }
  
  // Muzzle flashes
  for (const flash of muzzleFlashes) {
    const flashElem = document.createElement('div');
    flashElem.style.position = 'absolute';
    flashElem.style.left = flash.x + 'px';
    flashElem.style.top = flash.y + 'px';
    flashElem.style.width = '12px';
    flashElem.style.height = '6px';
    flashElem.style.background = '#ffff88';
    flashElem.style.borderRadius = '50%';
    flashElem.style.opacity = flash.opacity;
    flashElem.style.boxShadow = '0 0 8px #ffff00';
    effectsLayer.appendChild(flashElem);
  }
}

// Effect creation functions
// ...existing code...

function createExplosion(x, y, size = 30) {
  explosions.push({
    x: x,
    y: y,
    size: size,
    opacity: 1,
    life: 20,
    maxSize: size
  });
}

function createMuzzleFlash(x, y) {
  muzzleFlashes.push({
    x: x,
    y: y,
    opacity: 1,
    life: 5
  });
}

// Combat functions
function shoot() {
  if (gameState !== 'playing' || reloading || ammo <= 0) return;
  
  const now = Date.now();
  if (now - lastShot < fireRate) return;
  
  ammo--;
  lastShot = now;
  
  // Determine direction
  let dx = 0, dy = 0;
  if (lastDirection === 'w') dy = -1;
  if (lastDirection === 's') dy = 1;
  if (lastDirection === 'a') dx = -1;
  if (lastDirection === 'd') dx = 1;
  
  // Handle diagonal movement
  if (moveDirs.has('w') && moveDirs.has('a')) { dx = -0.7; dy = -0.7; }
  else if (moveDirs.has('w') && moveDirs.has('d')) { dx = 0.7; dy = -0.7; }
  else if (moveDirs.has('s') && moveDirs.has('a')) { dx = -0.7; dy = 0.7; }
  else if (moveDirs.has('s') && moveDirs.has('d')) { dx = 0.7; dy = 0.7; }
  
  const bulletX = posX + pixelCommando[0].length * pixelSize / 2;
  const bulletY = posY + 5 * pixelSize;
  
  // Create muzzle flash
  createMuzzleFlash(bulletX + dx * 15, bulletY + dy * 15);
  
  // Different weapon types
  switch (weaponType) {
    case 'spread':
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(dy, dx) + i * 0.3;
        projectiles.push({
          x: bulletX,
          y: bulletY,
          dx: Math.cos(angle),
          dy: Math.sin(angle),
          size: projectileSize,
          color: '#4caf50'
        });
      }
      break;
      
    case 'rapid':
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx,
        dy: dy,
        size: projectileSize * 0.8,
        color: '#ff9800'
      });
      break;
      
    case 'explosive':
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx,
        dy: dy,
        size: projectileSize * 1.5,
        color: '#e91e63',
        explosive: true
      });
      break;
      
    case 'laser':
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 2,
        dy: dy * 2,
        size: projectileSize * 0.5,
        color: '#ff0080',
        pierce: true,
        damage: 40
      });
      break;
      
    case 'plasma':
      for (let i = 0; i < 2; i++) {
        projectiles.push({
          x: bulletX + (Math.random() - 0.5) * 10,
          y: bulletY + (Math.random() - 0.5) * 10,
          dx: dx + (Math.random() - 0.5) * 0.5,
          dy: dy + (Math.random() - 0.5) * 0.5,
          size: projectileSize * 1.2,
          color: '#8000ff',
          explosive: true,
          damage: 35
        });
      }
      break;
      
    case 'railgun':
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 3,
        dy: dy * 3,
        size: projectileSize * 0.3,
        color: '#00ff80',
        pierce: true,
        damage: 60,
        trail: true
      });
      break;
      
    case 'nuclear':
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx,
        dy: dy,
        size: projectileSize * 2,
        color: '#ffff00',
        explosive: true,
        nuclear: true,
        damage: 80
      });
      break;
      
    case 'quantum':
      // Quantum burst - multiple projectiles in all directions
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        projectiles.push({
          x: bulletX,
          y: bulletY,
          dx: Math.cos(angle) * 1.5,
          dy: Math.sin(angle) * 1.5,
          size: projectileSize,
          color: '#ff8000',
          quantum: true,
          damage: 30
        });
      }
      break;
      
    case 'antimatter':
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 1.5,
        dy: dy * 1.5,
        size: projectileSize * 1.8,
        color: '#ffffff',
        antimatter: true,
        pierce: true,
        explosive: true,
        damage: 100
      });
      break;
      
    default:
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx,
        dy: dy,
        size: projectileSize,
        color: '#ffff00'
      });
  }
  
  if (ammo === 0) reload();
  updateUI();
}

function reload() {
  if (reloading) return;
  reloading = true;
  updateUI();
  
  setTimeout(() => {
    ammo = maxAmmo;
    reloading = false;
    updateUI();
  }, reloadTime);
}

// Collision detection
function checkCollisions() {
  // Player projectiles vs enemies
  for (const projectile of projectiles) {
    if (projectile.hit) continue;
    
    for (const enemy of enemies) {
      if (!enemy.active) continue;
      
      const dx = projectile.x - (enemy.x + 10);
      const dy = projectile.y - (enemy.y + 10);
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < 12) {
        if (!projectile.pierce) projectile.hit = true;
        
        const damage = projectile.damage || 25;
        enemy.health -= damage;
        enemy.hitFlash = 8;
        
        // Create blood effect based on weapon type and enemy
        const bloodEffect = createWeaponBloodEffect(enemy.x + 10, enemy.y + 10, weaponType, enemy);
        bloodEffects.push(bloodEffect);
        
        // Create blood pool for heavy damage
        if (damage >= 50 || weaponType === 'explosive') {
          const bloodPool = createBloodPool(enemy.x + 10, enemy.y + 10, enemy, damage / 50);
          bloodPools.push(bloodPool);
        }
        
        // Handle special weapon effects
        if (projectile.explosive || projectile.nuclear) {
          const explosionSize = projectile.nuclear ? 80 : 40;
          const explosionDamage = projectile.nuclear ? 40 : 15;
          const explosionRange = projectile.nuclear ? 80 : 50;
          
          createExplosion(projectile.x, projectile.y, explosionSize);
          
          // Damage nearby enemies
          for (const nearbyEnemy of enemies) {
            if (nearbyEnemy === enemy || !nearbyEnemy.active) continue;
            const expDx = nearbyEnemy.x - projectile.x;
            const expDy = nearbyEnemy.y - projectile.y;
            const expDist = Math.sqrt(expDx * expDx + expDy * expDy);
            if (expDist < explosionRange) {
              nearbyEnemy.health -= explosionDamage;
              nearbyEnemy.hitFlash = 8;
              // Create explosive blood splatter
              const direction = {
                x: nearbyEnemy.x - projectile.x,
                y: nearbyEnemy.y - projectile.y
              };
              const magnitude = Math.sqrt(direction.x * direction.x + direction.y * direction.y);
              if (magnitude > 0) {
                direction.x /= magnitude;
                direction.y /= magnitude;
              }
              
              const bloodSplatter = createBloodSplatter(nearbyEnemy.x + 10, nearbyEnemy.y + 10, direction, nearbyEnemy);
              bloodEffects.push(bloodSplatter);
              
              // Create blood pool for explosion damage
              const bloodPool = createBloodPool(nearbyEnemy.x + 10, nearbyEnemy.y + 10, nearbyEnemy, 1.2);
              bloodPools.push(bloodPool);
            }
          }
        }
        
        if (projectile.antimatter) {
          // Antimatter creates multiple explosions
          for (let i = 0; i < 3; i++) {
            setTimeout(() => {
              createExplosion(
                projectile.x + (Math.random() - 0.5) * 40,
                projectile.y + (Math.random() - 0.5) * 40,
                60
              );
            }, i * 100);
          }
        }
        
        if (enemy.health <= 0) {
          enemy.active = false;
          enemiesKilled++;
          const points = enemy.points || 100;
          score += points;
          
          // Create death blood effect
          const deathBloodEffect = createDeathBloodEffect(enemy.x + 10, enemy.y + 10, enemy);
          bloodEffects.push(deathBloodEffect);
          
          // Create large blood pool for death
          const deathBloodPool = createBloodPool(enemy.x + 10, enemy.y + 10, enemy, 1.5);
          bloodPools.push(deathBloodPool);
          
          // CHAOS: Random funny messages when enemies die! (reduced frequency)
          if (Math.random() < 0.15) {
            showChaosMessage(getRandomMessage());
          }
          
          // Higher level = better powerup drop chance
          const dropChance = 0.08 + (level * 0.02);
          if (Math.random() < dropChance) {
            powerups.push(spawnPowerup(level));
          }
          
          // CHAOS: Random chance to spawn GIANT CHICKEN!
          if (window.chaosGiantChicken && Math.random() < 0.1) {
            spawnGiantChicken();
          }
        }
        break;
      }
    }
  }
  
  // Boss collision
  if (currentBoss && currentBoss.active) {
    const bossResult = checkBossCollision(currentBoss, projectiles);
    
    // Add blood effects when boss gets hit
    if (bossResult === 'hit') {
      const bossHitBlood = createWeaponBloodEffect(
        currentBoss.x + currentBoss.size.width/2, 
        currentBoss.y + currentBoss.size.height/2, 
        weaponType, 
        currentBoss
      );
      bloodEffects.push(bossHitBlood);
      
      // Create blood pool for heavy boss damage
      if (weaponType === 'explosive' || weaponType === 'plasma') {
        const bossHitPool = createBloodPool(
          currentBoss.x + currentBoss.size.width/2, 
          currentBoss.y + currentBoss.size.height/2, 
          currentBoss, 
          1.3
        );
        bloodPools.push(bossHitPool);
      }
    }
    if (bossResult === 'destroyed') {
      const points = currentBoss.points;
      score += points;
      
      // Create massive blood fountain for boss death
      const bossBloodFountain = createBloodFountain(
        currentBoss.x + currentBoss.size.width/2, 
        currentBoss.y + currentBoss.size.height/2, 
        currentBoss
      );
      bloodEffects.push(bossBloodFountain);
      
      // Create multiple large blood pools
      for (let i = 0; i < 5; i++) {
        const poolX = currentBoss.x + Math.random() * currentBoss.size.width;
        const poolY = currentBoss.y + Math.random() * currentBoss.size.height;
        const bossBloodPool = createBloodPool(poolX, poolY, currentBoss, 2.0 + Math.random());
        bloodPools.push(bossBloodPool);
      }
      
      createExplosion(currentBoss.x + currentBoss.size.width/2, currentBoss.y + currentBoss.size.height/2, 120);
      
      // Drop guaranteed high-level powerups
      powerups.push(spawnPowerup(level));
      powerups.push(spawnPowerup(level));
      powerups.push(spawnPowerup(level)); // Triple drop for final boss
      
      currentBoss = null;
      
      // For level 10, count boss as the required enemy kill
      if (level === 10) {
        enemiesKilled = 1; // Boss counts as 1 enemy for level completion
      }
      
      // Complete the level (this will trigger victory for level 10)
      completeLevel();
    }
  }
  
  // Enemy projectiles vs player
  for (const projectile of enemyProjectiles) {
    const dx = projectile.x - (posX + 10);
    const dy = projectile.y - (posY + 10);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 10) {
      projectile.hit = true;
      
      if (playerShield > 0) {
        playerShield -= projectile.damage;
        if (playerShield < 0) {
          playerHealth += playerShield; // Overflow damage
          playerShield = 0;
          updateUI();
        }
      } else {
        playerHealth -= projectile.damage;
        // Create blood effect when player takes damage
        const playerBloodEffect = createBloodEffect(posX + 10, posY + 10, null, 0.8);
        bloodEffects.push(playerBloodEffect);
        updateUI();
      }
      
      if (playerHealth <= 0) {
        gameOver();
        updateUI();
      }
      break;
    }
  }
  
  // Boss projectiles vs player
  for (const projectile of bossProjectiles) {
    const dx = projectile.x - (posX + 10);
    const dy = projectile.y - (posY + 10);
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 12) {
      projectile.hit = true;
      
      if (projectile.explosive) {
        createExplosion(projectile.x, projectile.y, 30);
      }
      
      if (playerShield > 0) {
        playerShield -= projectile.damage;
        if (playerShield < 0) {
          playerHealth += playerShield;
          playerShield = 0;
          updateUI();
        }
      } else {
        playerHealth -= projectile.damage;
        // Create blood effect when player takes damage from boss
        const playerBloodEffect = createBloodEffect(posX + 10, posY + 10, null, 1.0);
        bloodEffects.push(playerBloodEffect);
        updateUI();
      }
      
      if (playerHealth <= 0) {
        gameOver();
        updateUI();
      }
      break;
    }
  }
  
  // Powerup collection
  for (const powerup of powerups) {
    if (!powerup.active) continue;
    
    const dx = posX + 10 - powerup.x;
    const dy = posY + 10 - powerup.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 20) {
      powerup.active = false;
      collectPowerup(powerup);
    }
  }
}

function collectPowerup(powerup) {
  const typeObj = powerupTypes.find(t => t.type === powerup.type);
  if (!typeObj) return;
  
  switch (powerup.type) {
    case 'health':
      playerHealth = Math.min(maxPlayerHealth, playerHealth + 40);
      break;
      
    case 'ammo':
      ammo = maxAmmo;
      reloading = false;
      break;
      
    case 'shield':
      playerShield = 100;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'rapid':
      weaponType = 'rapid';
      fireRate = 80;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'spread':
      weaponType = 'spread';
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'explosive':
      weaponType = 'explosive';
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'laser':
      weaponType = 'laser';
      fireRate = 100;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'plasma':
      weaponType = 'plasma';
      fireRate = 200;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'railgun':
      weaponType = 'railgun';
      fireRate = 300;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'nuclear':
      weaponType = 'nuclear';
      fireRate = 500;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'quantum':
      weaponType = 'quantum';
      fireRate = 400;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'antimatter':
      weaponType = 'antimatter';
      fireRate = 600;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;
      
    case 'chaos':
      // CHAOS POWERUP! Random effect!
      const chaosEffects = ['health', 'ammo', 'shield', 'rapid', 'spread', 'explosive'];
      const randomEffect = chaosEffects[Math.floor(Math.random() * chaosEffects.length)];
      showChaosMessage(`🎲 CHAOS POWERUP! ${randomEffect.toUpperCase()}! 🎲`);
      collectPowerup({type: randomEffect});
      break;
  }
  
  updateUI();
}

function updatePowerups() {
  const now = Date.now();
  activePowerups = activePowerups.filter(powerup => {
    if (now > powerup.endTime) {
      // Reset weapon type when powerup expires
      if (['rapid', 'spread', 'explosive', 'laser', 'plasma', 'railgun', 'nuclear', 'quantum', 'antimatter'].includes(powerup.type)) {
        weaponType = 'normal';
        fireRate = 150;
      }
      return false;
    }
    return true;
  });
}



function gameOver() {
  gameState = 'gameOver';
  document.getElementById('final-score').textContent = score.toLocaleString();
  document.getElementById('final-level').textContent = level;
  document.getElementById('game-over').style.display = 'block';
}

function victory() {
  gameState = 'victory';
  document.getElementById('victory-score').textContent = score.toLocaleString();
  document.getElementById('victory').style.display = 'block';
}

function togglePause() {
  if (gameState === 'playing') {
    gameState = 'paused';
    document.getElementById('pause-screen').style.display = 'block';
  } else if (gameState === 'paused') {
    gameState = 'playing';
    document.getElementById('pause-screen').style.display = 'none';
  }
}

// Make restart function global
window.restartGame = function() {
  initGame();
};

// Update functions
function updateEnemies() {
  for (const enemy of enemies) {
    if (!enemy.active) continue;
    
    // Update enemy and get projectile if it shoots
    const projectile = updateEnemy(enemy, posX, posY);
    if (projectile) {
      enemyProjectiles.push(projectile);
    }
    
    // Check for contact damage
    const dx = posX - enemy.x;
    const dy = posY - enemy.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance < 15) {
      enemy.active = false;
      enemiesKilled++; // IMPORTANT: Count contact kills too!
      
      // Create death blood effect for contact kill
      const contactDeathBlood = createDeathBloodEffect(enemy.x + 10, enemy.y + 10, enemy);
      bloodEffects.push(contactDeathBlood);
      
      // Create blood pool
      const contactBloodPool = createBloodPool(enemy.x + 10, enemy.y + 10, enemy, 1.2);
      bloodPools.push(contactBloodPool);
      
      if (playerShield > 0) {
        playerShield -= 20;
        if (playerShield < 0) {
          playerHealth += playerShield;
          playerShield = 0;
          updateUI();
        }
      } else {
        playerHealth -= 20;
        // Create blood effect when player takes contact damage
        const playerBloodEffect = createBloodEffect(posX + 10, posY + 10, null, 0.6);
        bloodEffects.push(playerBloodEffect);
        updateUI();
      }
      
      if (playerHealth <= 0) {
        gameOver();
        updateUI();
      }
    }
  }
  
  // Remove inactive enemies - but keep count accurate
  enemies = enemies.filter(enemy => enemy.active);
}

function updateProjectiles() {
  // Update player projectiles
  for (const projectile of projectiles) {
    if (projectile.hit) continue;
    
    projectile.x += projectileSpeed * projectile.dx;
    projectile.y += projectileSpeed * projectile.dy;
  }
  
  // Update enemy projectiles
  for (const projectile of enemyProjectiles) {
    if (projectile.hit) continue;
    
    projectile.x += projectile.dx;
    projectile.y += projectile.dy;
  }
  
  // Update boss projectiles
  for (const projectile of bossProjectiles) {
    if (projectile.hit) continue;
    
    // Homing projectiles adjust direction toward player
    if (projectile.homing) {
      const dx = posX - projectile.x;
      const dy = posY - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 0) {
        const homingStrength = 0.1;
        projectile.dx += (dx / distance) * homingStrength;
        projectile.dy += (dy / distance) * homingStrength;
        
        // Limit speed
        const speed = Math.sqrt(projectile.dx * projectile.dx + projectile.dy * projectile.dy);
        if (speed > 4) {
          projectile.dx = (projectile.dx / speed) * 4;
          projectile.dy = (projectile.dy / speed) * 4;
        }
      }
    }
    
    projectile.x += projectile.dx;
    projectile.y += projectile.dy;
  }
  
  // Remove off-screen projectiles
  projectiles = projectiles.filter(p => 
    !p.hit && p.x >= -20 && p.x < gameWidth + 20 && p.y >= -20 && p.y < gameHeight + 20
  );
  
  enemyProjectiles = enemyProjectiles.filter(p => 
    !p.hit && p.x >= -20 && p.x < gameWidth + 20 && p.y >= -20 && p.y < gameHeight + 20
  );
  
  bossProjectiles = bossProjectiles.filter(p => 
    !p.hit && p.x >= -20 && p.x < gameWidth + 20 && p.y >= -20 && p.y < gameHeight + 20
  );
}

function updateEffects() {
  // Update blood effects
  for (const blood of bloodEffects) {
    blood.life--;
    blood.opacity = blood.life / 60;
    
    for (const drop of blood.drops) {
      drop.x += drop.vx;
      drop.y += drop.vy;
      drop.vy += 0.2; // Gravity
      drop.vx *= 0.98; // Air resistance
    }
  }
  bloodEffects = bloodEffects.filter(blood => blood.life > 0);
  
  // Update explosions
  for (const explosion of explosions) {
    explosion.life--;
    explosion.opacity = explosion.life / 20;
    explosion.size = explosion.maxSize * (1 - explosion.life / 20);
  }
  explosions = explosions.filter(explosion => explosion.life > 0);
  
  // Update muzzle flashes
  for (const flash of muzzleFlashes) {
    flash.life--;
    flash.opacity = flash.life / 5;
  }
  muzzleFlashes = muzzleFlashes.filter(flash => flash.life > 0);
}

// Main game loop
function gameLoop() {
  if (gameState !== 'playing') return;
  
  // Handle movement
  if (moveDirs.size > 0) {
    animFrame = (animFrame + 1) % 2;
    let speed = pixelSize * 3;
    
    // CHAOS EFFECTS!
    if (window.chaosSpeedDemon) speed *= 3;
    if (window.chaosTinyMode) speed *= 0.5;
    if (window.chaosSlippery) speed *= 1.8; // Slippery = faster but harder to control
    
    let moveX = 0, moveY = 0;
    if (moveDirs.has('w')) moveY -= speed;
    if (moveDirs.has('s')) moveY += speed;
    if (moveDirs.has('a')) moveX -= speed;
    if (moveDirs.has('d')) moveX += speed;
    
    // CHAOS: Gravity flip!
    if (window.chaosGravityFlip) {
      moveY = -moveY;
    }
    
    // CHAOS: Slippery floors add random drift
    if (window.chaosSlippery) {
      moveX += (Math.random() - 0.5) * 4;
      moveY += (Math.random() - 0.5) * 4;
    }
    
    posX += moveX;
    posY += moveY;
    
    // Clamp to game area
    const maxX = gameWidth - pixelCommando[0].length * pixelSize;
    const maxY = gameHeight - pixelCommando.length * pixelSize;
    posX = Math.max(0, Math.min(posX, maxX));
    posY = Math.max(0, Math.min(posY, maxY));
    isMoving = true;
  } else {
    isMoving = false;
  }
  
  // Update game objects
  updateEnemies();
  updateProjectiles();
  updateEffects();
  updatePowerups();
  
  // Update boss
  if (currentBoss && currentBoss.active) {
    const bossAttacks = updateBoss(currentBoss, posX, posY, projectiles);
    if (bossAttacks) {
      bossProjectiles.push(...bossAttacks);
    }
  }
  
  // Check collisions
  checkCollisions();
  
  // Check level completion - more robust checking
  if (!levelComplete) {
    // For regular levels (1-9): check if all enemies are killed
    if (level < 10 && enemiesKilled >= enemiesPerLevel) {
      console.log(`Level ${level} complete! Killed ${enemiesKilled}/${enemiesPerLevel} enemies`);
      completeLevel();
    }
    // For boss level (10): check if boss is defeated
    else if (level === 10 && (!currentBoss || !currentBoss.active)) {
      console.log(`Boss level complete!`);
      completeLevel();
    }
  }
  
  // Render everything
  container.innerHTML = '';
  
  // CHAOS: Add random background elements!
  if (window.chaosGiantChicken && Math.random() < 0.1) {
    const randomChicken = document.createElement('div');
    randomChicken.style.position = 'absolute';
    randomChicken.style.left = (Math.random() * 700) + 'px';
    randomChicken.style.top = (Math.random() * 400) + 'px';
    randomChicken.style.fontSize = '20px';
    randomChicken.style.opacity = '0.3';
    randomChicken.textContent = '🐔';
    randomChicken.style.animation = 'wiggle 1s infinite';
    container.appendChild(randomChicken);
  }
  
  if (window.chaosSlippery && Math.random() < 0.05) {
    const banana = document.createElement('div');
    banana.style.position = 'absolute';
    banana.style.left = (Math.random() * 700) + 'px';
    banana.style.top = (Math.random() * 400) + 'px';
    banana.style.fontSize = '15px';
    banana.style.opacity = '0.4';
    banana.textContent = '🍌';
    banana.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(banana);
  }
  
  renderCommando(posX, posY, animFrame, isMoving ? (animFrame === 0 ? 0 : 2) : 0);
  
  for (const enemy of enemies) {
    if (enemy.active) {
      renderEnemy(container, enemy);
    }
  }
  
  if (currentBoss && currentBoss.active) {
    renderBoss(container, currentBoss);
  }
  
  for (const powerup of powerups) {
    if (powerup.active) {
      renderPowerupGraphic(container, powerup);
    }
  }
  
  renderProjectiles();
  renderEffects();
  updateUI();
}

// Start game loop
setInterval(gameLoop, 1000 / 60); // 60 FPS
// Input handling
let moveDirs = new Set();

function startMove(dir) {
  // CHAOS: Reverse controls!
  if (window.chaosReversed) {
    const reverseMap = { 'w': 's', 's': 'w', 'a': 'd', 'd': 'a' };
    dir = reverseMap[dir] || dir;
  }
  
  moveDirs.add(dir);
  lastDirection = dir;
}

function stopMove(dir) {
  moveDirs.delete(dir);
}

// Event listeners
document.addEventListener('keydown', (e) => {
  if (gameState === 'gameOver' || gameState === 'victory') return;
  
  switch (e.key.toLowerCase()) {
    case 'w':
    case 'a':
    case 's':
    case 'd':
      startMove(e.key.toLowerCase());
      break;
    case 'r':
      reload();
      break;
    case ' ':
      e.preventDefault();
      shoot();
      break;
    case 'escape':
      togglePause();
      break;
  }
});

document.addEventListener('keyup', (e) => {
  if (['w','a','s','d'].includes(e.key.toLowerCase())) {
    stopMove(e.key.toLowerCase());
  }
});

// Mouse shooting
let mouseDown = false;
let lastMouseShot = 0;

container.addEventListener('mousedown', (e) => {
  e.preventDefault();
  mouseDown = true;
  shoot();
});

document.addEventListener('mouseup', () => {
  mouseDown = false;
});

// Continuous mouse shooting
setInterval(() => {
  if (mouseDown && gameState === 'playing') {
    const now = Date.now();
    if (now - lastMouseShot > fireRate) {
      shoot();
      lastMouseShot = now;
    }
  }
}, 16);

// Powerup spawning - more frequent at higher levels
setInterval(() => {
  if (gameState === 'playing') {
    const spawnChance = 0.2 + (level * 0.05);
    if (Math.random() < spawnChance) {
      powerups.push(spawnPowerup(level));
    }
  }
}, 4000);

// CHAOS: Giant Chicken spawning!
function spawnGiantChicken() {
  const chicken = document.createElement('div');
  chicken.style.position = 'absolute';
  chicken.style.left = (Math.random() * 600) + 'px';
  chicken.style.top = (Math.random() * 400) + 'px';
  chicken.style.fontSize = '60px';
  chicken.style.zIndex = '9999';
  chicken.textContent = '🐔';
  chicken.style.animation = 'wiggle 0.5s infinite';
  container.appendChild(chicken);
  
  setTimeout(() => {
    if (container.contains(chicken)) {
      container.removeChild(chicken);
    }
  }, 3000);
}

// CHAOS: Random powerup spawning with more variety!
setInterval(() => {
  if (gameState === 'playing' && Math.random() < 0.12) {
    // 70% chance for chaos powerup, 30% chance for random regular powerup
    const powerupType = Math.random() < 0.7 ? 'chaos' : powerupTypes[Math.floor(Math.random() * powerupTypes.length)].type;
    
    const chaosPowerup = {
      x: Math.random() * 720 + 40,
      y: Math.random() * 420 + 40,
      type: powerupType,
      active: true,
      pulsePhase: 0,
      spawnTime: Date.now()
    };
    powerups.push(chaosPowerup);
  }
}, 2500);

// Initialize game
console.log('Starting game initialization...');
console.log('Container element:', document.getElementById('game-area'));
console.log('Projectile layer:', document.getElementById('projectile-layer'));
console.log('Effects layer:', document.getElementById('effects-layer'));
initGame();
console.log('Game initialized!');
