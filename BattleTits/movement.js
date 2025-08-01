import { pixelCommando, pixelCommandoRed } from './pixel-commando.js';
import {
  createWeaponBloodEffect,
  createBloodPool,
  createDeathBloodEffect,
  createBloodSplatter,
  createBloodEffect,
  createBloodFountain,
  renderBloodEffects,
  renderBloodPools,
  updateBloodEffects,
  updateBloodPools
} from './bloodEffects.js';
import { spawnPowerup, powerupTypes, renderPowerupGraphic } from './powerups.js';
import { createBoss, updateBoss, renderBoss, checkBossCollision, bossTypes } from './bosses.js';
import { createEnemy, updateEnemy, renderEnemy } from './enemies.js';
import { triggerChaosEvent, showChaosMessage, getRandomMessage, spawnShadowCreature, spawnQuantumParticle } from './chaos.js';
import { submitHighScore, isHighScore, showNameInput } from './highscores.js';

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

// Player 1 state
let posX = 100, posY = 200;
let lastDirection = 'd';
let animFrame = 0;
let isMoving = false;
let playerHealth = 100;
const maxPlayerHealth = 100;
let playerShield = 0;

// Player 1 weapon state
let ammo = 30;
const maxAmmo = 30;
let reloading = false;
const reloadTime = 2000;
let lastShot = 0;
let fireRate = 150;
let weaponType = 'normal';

// Player 2 state
let player2Active = false;
let pos2X = 150, pos2Y = 250;
let lastDirection2 = 'd';
let animFrame2 = 0;
let isMoving2 = false;
let player2Health = 100;
let player2Shield = 0;

// Player 2 weapon state
let ammo2 = 30;
let reloading2 = false;
let lastShot2 = 0;
let fireRate2 = 150;
let weaponType2 = 'normal';

// Projectile state
let projectiles = [];
let enemyProjectiles = [];

// Effects state
let bloodEffects = [];
let bloodPools = [];
let explosions = [];
let muzzleFlashes = [];

// Enemy state
let enemies = [];
let currentBoss = null;
let bossProjectiles = [];

// Powerup state
let powerups = [];
let activePowerups = [];

// Toggle Player 2
function togglePlayer2() {
  player2Active = !player2Active;
  console.log(`Player 2 ${player2Active ? 'joined' : 'left'} the game!`);
  showChaosMessage(player2Active ? '🎮 PLAYER 2 JOINED! 🎮' : '👋 PLAYER 2 LEFT! 👋');
  updateUI();
}

// Check if both players are dead
function bothPlayersDead() {
  if (!player2Active) {
    // Only Player 1 is active, so check only Player 1
    return playerHealth <= 0;
  } else {
    // Both players are active, so both must be dead
    return playerHealth <= 0 && player2Health <= 0;
  }
}

// Handle player death with proper two-player logic
function handlePlayerDeath(playerNum) {
  if (playerNum === 1) {
    if (!player2Active || player2Health <= 0) {
      // Either no Player 2 or Player 2 is also dead
      gameOver();
    } else {
      // Player 2 is still alive
      showChaosMessage('💀 PLAYER 1 DOWN! CONTINUE FIGHTING! 💀');
    }
  } else if (playerNum === 2) {
    if (playerHealth <= 0) {
      // Player 1 is also dead
      gameOver();
    } else {
      // Player 1 is still alive
      showChaosMessage('💀 PLAYER 2 DOWN! CONTINUE FIGHTING! 💀');
      player2Active = false; // Remove Player 2 from the game
    }
  }
  updateUI();
}

// Game initialization
function initGame() {
  gameState = 'playing';
  score = 0;
  level = 1;
  enemiesKilled = 0;
  levelComplete = false;

  // Player 1 reset
  posX = 100;
  posY = 200;
  playerHealth = maxPlayerHealth;
  playerShield = 0;
  ammo = maxAmmo;
  reloading = false;
  weaponType = 'normal';
  fireRate = 150;

  // Player 2 reset - deactivate on game restart
  player2Active = false;
  pos2X = 150;
  pos2Y = 250;
  player2Health = maxPlayerHealth;
  player2Shield = 0;
  ammo2 = maxAmmo;
  reloading2 = false;
  weaponType2 = 'normal';
  fireRate2 = 150;

  enemies = [];
  projectiles = [];
  enemyProjectiles = [];
  bossProjectiles = [];
  powerups = [];
  activePowerups = [];
  bloodEffects = [];
  bloodPools = [];
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
  // Health bar - show both players
  if (healthBar) {
    if (player2Active) {
      const healthPercent1 = (playerHealth / maxPlayerHealth) * 100;
      const healthPercent2 = (player2Health / maxPlayerHealth) * 100;
      healthBar.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%;">
          <div style="background: linear-gradient(90deg, #ff0000 ${healthPercent1}%, #330000 ${healthPercent1}%); 
                      width: 100%; height: 50%; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
            P1: ${playerHealth}/${maxPlayerHealth}
          </div>
          <div style="background: linear-gradient(90deg, #0080ff ${healthPercent2}%, #003366 ${healthPercent2}%); 
                      width: 100%; height: 50%; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
            P2: ${player2Health}/${maxPlayerHealth}
          </div>
        </div>
      `;
    } else {
      const healthPercent = (playerHealth / maxPlayerHealth) * 100;
      healthBar.innerHTML = `
        <div style="background: linear-gradient(90deg, #ff0000 ${healthPercent}%, #330000 ${healthPercent}%); 
                    width: 100%; height: 100%; border-radius: 2px; display: flex; align-items: center; justify-content: center;">
          ◤ VITALS: ${playerHealth}/${maxPlayerHealth} ◥
        </div>
      `;
    }
  }

  // Ammo bar - show both players
  if (ammoBar) {
    if (player2Active) {
      const ammoPercent1 = (ammo / maxAmmo) * 100;
      const ammoPercent2 = (ammo2 / maxAmmo) * 100;
      ammoBar.innerHTML = `
        <div style="display: flex; flex-direction: column; width: 100%; height: 100%;">
          <div style="background: linear-gradient(90deg, #ffaa00 ${ammoPercent1}%, #333300 ${ammoPercent1}%); 
                      width: 100%; height: 50%; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
            ${reloading ? 'P1: RELOAD' : `P1: ${ammo}/${maxAmmo}`}
          </div>
          <div style="background: linear-gradient(90deg, #00aaff ${ammoPercent2}%, #003333 ${ammoPercent2}%); 
                      width: 100%; height: 50%; border-radius: 2px; display: flex; align-items: center; justify-content: center; font-size: 10px;">
            ${reloading2 ? 'P2: RELOAD' : `P2: ${ammo2}/${maxAmmo}`}
          </div>
        </div>
      `;
    } else {
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

    // Add progress indicator for longer levels
    if (enemiesPerLevel > 30) {
      const waves = Math.ceil(enemiesKilled / 15);
      const totalWaves = Math.ceil(enemiesPerLevel / 15);
      textContent = `◤ SECTOR ${level} - WAVE ${waves}/${totalWaves} - HOSTILES: ${remaining} ◥`;
    }

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

  // Calculate enemies per level based on difficulty - balanced progression
  enemiesPerLevel = Math.min(15 + (level * 8), 80); // More reasonable scaling

  console.log(`Level ${level} requires ${enemiesPerLevel} enemies to be killed`);

  // Level 10 is boss level
  if (level === 10) {
    showChaosMessage("💀 FINAL BOSS INCOMING! PREPARE FOR DOOM! 💀");
    enemiesPerLevel = 1; // Boss counts as 1 "enemy" for completion
    spawnFinalBoss();
    updateUI();
    return;
  }

  // Balanced enemy spawning with reasonable pacing
  const baseSpawnInterval = 1200; // More reasonable base spawn timing
  const enemySpawnInterval = Math.max(400, baseSpawnInterval - (level * 80)); // Gentler scaling
  let enemiesSpawned = 0;

  const spawnTimer = setInterval(() => {
    if (gameState !== 'playing' || levelComplete) {
      clearInterval(spawnTimer);
      return;
    }

    // Balanced enemy spawning with manageable wave patterns
    let spawnCount = 1;

    // Create spawn waves every 15 enemies for dramatic effect
    const wavePosition = enemiesSpawned % 15;
    if (wavePosition === 0 && enemiesSpawned > 0) {
      // Smaller wave at start of each 15-enemy cycle
      spawnCount = Math.min(3, 1 + Math.floor(level / 3));
      showChaosMessage(`🌊 ENEMY WAVE INCOMING! 🌊`);
    } else {
      // More conservative regular spawning
      if (level > 3 && Math.random() < 0.25) spawnCount = 2;
      if (level > 6 && Math.random() < 0.15) spawnCount = 3;
      if (level > 8 && Math.random() < 0.1) spawnCount = 4;
    }

    for (let i = 0; i < spawnCount && enemiesSpawned < enemiesPerLevel; i++) {
      spawnEnemy();
      enemiesSpawned++;
    }

    console.log(`Spawned enemies - Total: ${enemiesSpawned}/${enemiesPerLevel}`);

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

  // Add spawn direction indicator
  showSpawnWarning(enemy.x, enemy.y);

  console.log(`Spawned ${enemy.type} (${enemy.sprite}) from ${getSpawnDirection(enemy.x, enemy.y)} - Health: ${enemy.health}, Special: ${enemy.special || 'none'}`);

  enemies.push(enemy);
}

function getSpawnDirection(x, y) {
  if (x < 0) return 'LEFT';
  if (x > 800) return 'RIGHT';
  if (y < 0) return 'TOP';
  if (y > 500) return 'BOTTOM';
  return 'CENTER';
}

function showSpawnWarning(x, y) {
  const warning = document.createElement('div');
  warning.style.position = 'absolute';
  warning.style.fontSize = '12px';
  warning.style.color = '#ff4444';
  warning.style.fontWeight = 'bold';
  warning.style.textShadow = '1px 1px 2px #000';
  warning.style.zIndex = '9999';
  warning.style.animation = 'pulse 0.5s infinite';
  warning.textContent = '⚠️';

  // Position warning at screen edge based on spawn direction
  if (x < 0) { // Left spawn
    warning.style.left = '5px';
    warning.style.top = Math.max(10, Math.min(480, y)) + 'px';
  } else if (x > 800) { // Right spawn
    warning.style.left = '780px';
    warning.style.top = Math.max(10, Math.min(480, y)) + 'px';
  } else if (y < 0) { // Top spawn
    warning.style.left = Math.max(10, Math.min(780, x)) + 'px';
    warning.style.top = '5px';
  } else if (y > 500) { // Bottom spawn
    warning.style.left = Math.max(10, Math.min(780, x)) + 'px';
    warning.style.top = '480px';
  }

  document.getElementById('game-area').appendChild(warning);

  // Remove warning after 2 seconds
  setTimeout(() => {
    if (warning.parentNode) {
      warning.parentNode.removeChild(warning);
    }
  }, 2000);
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

// Render Player 2 with blue theme
function renderPlayer2(x, y, frame = 0, bob = 0) {
  const sprite = isMoving2 ? getAnimatedCommando(frame) : pixelCommando;

  // CHAOS EFFECTS affect Player 2 too!
  let renderScale = 1;
  let renderRotation = 0;

  if (window.chaosTinyMode) renderScale = 0.5;
  if (window.chaosDiscoMode) renderRotation = Math.sin(Date.now() * 0.01 + 1) * 15; // Slightly offset
  if (window.chaosBouncyCastle) bob += Math.sin(Date.now() * 0.005 + 1) * 10;

  // Player 2 shield effect (blue)
  if (player2Shield > 0) {
    const shield = document.createElement('div');
    shield.style.position = 'absolute';
    shield.style.left = (x - 5) + 'px';
    shield.style.top = (y - 5 + bob) + 'px';
    shield.style.width = (pixelCommando[0].length * pixelSize + 10) + 'px';
    shield.style.height = (pixelCommando.length * pixelSize + 10) + 'px';
    shield.style.border = '2px solid #0080ff';
    shield.style.borderRadius = '50%';
    shield.style.boxShadow = '0 0 10px #0080ff';
    shield.style.opacity = '0.6';
    shield.style.transform = `scale(${renderScale}) rotate(${renderRotation}deg)`;
    container.appendChild(shield);
  }

  // Player 2 indicator (blue glow)
  const indicator = document.createElement('div');
  indicator.style.position = 'absolute';
  indicator.style.left = (x - 3) + 'px';
  indicator.style.top = (y - 8) + 'px';
  indicator.style.width = '6px';
  indicator.style.height = '6px';
  indicator.style.background = '#0080ff';
  indicator.style.borderRadius = '50%';
  indicator.style.boxShadow = '0 0 8px #0080ff';
  indicator.style.opacity = '0.8';
  container.appendChild(indicator);

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

        // Player 2 gets blue-tinted colors
        if (!window.chaosDiscoMode && !window.chaosNeonRave) {
          if (color === 'shirt' || color === 'shirt2') {
            pixel.style.background = '#0080ff'; // Blue shirt
          } else if (color === 'pants') {
            pixel.style.background = '#004080'; // Dark blue pants
          }
        }

        // CHAOS: Same effects as Player 1 but slightly offset
        if (window.chaosDiscoMode) {
          const rainbowColors = ['#ff0000', '#ff8000', '#ffff00', '#00ff00', '#0080ff', '#8000ff'];
          pixel.style.background = rainbowColors[Math.floor(Date.now() * 0.01 + row + col + 1) % rainbowColors.length];
          pixel.style.boxShadow = `0 0 5px ${pixel.style.background}`;
        } else if (window.chaosNeonRave) {
          const neonColors = ['#ff00ff', '#00ffff', '#ffff00', '#ff0080'];
          pixel.style.background = neonColors[Math.floor(Date.now() * 0.02 + row * col + 1) % neonColors.length];
          pixel.style.boxShadow = `0 0 8px ${pixel.style.background}`;
        } else if (window.chaosSlippery) {
          // Banana theme affects Player 2 too!
          const bananaColors = ['#ffff00', '#ffaa00', '#ff8800'];
          if (color === 'shirt' || color === 'shirt2') {
            pixel.style.background = bananaColors[Math.floor(Date.now() * 0.005 + 1) % bananaColors.length];
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

    // Enhanced special effects for different weapon types
    if (p.nuclear) {
      bullet.style.borderRadius = '0';
      bullet.style.boxShadow = `0 0 15px ${p.color}, 0 0 30px ${p.color}, 0 0 45px #ffff00`;
      bullet.style.animation = 'pulse 0.2s infinite';
      bullet.style.border = '2px solid #ffff00';
    } else if (p.antimatter) {
      bullet.style.borderRadius = '50%';
      bullet.style.boxShadow = `0 0 20px #ffffff, 0 0 40px #ffffff, 0 0 60px #8800ff`;
      bullet.style.border = '2px solid #ffffff';
      bullet.style.animation = 'pulse 0.15s infinite';
    } else if (p.quantum) {
      bullet.style.borderRadius = '30%';
      bullet.style.boxShadow = `0 0 10px ${p.color}, 0 0 20px ${p.color}`;
      bullet.style.transform = `rotate(${Date.now() * 0.01}rad)`;
      bullet.style.opacity = '0.8';
    } else if (p.laser) {
      bullet.style.borderRadius = '10%';
      bullet.style.boxShadow = `0 0 12px ${p.color}, 0 0 24px ${p.color}`;
      bullet.style.border = '1px solid #ffffff';
    } else if (p.railgun) {
      bullet.style.borderRadius = '5%';
      bullet.style.boxShadow = `0 0 8px ${p.color}, 0 0 16px ${p.color}`;
      bullet.style.border = '1px solid #00ff80';
      bullet.style.opacity = '0.9';
    } else if (p.plasma) {
      bullet.style.borderRadius = '20%';
      bullet.style.boxShadow = `0 0 12px ${p.color}, 0 0 24px ${p.color}`;
      bullet.style.border = '2px solid #4000aa';
    } else if (p.explosive) {
      bullet.style.borderRadius = '0';
      bullet.style.boxShadow = `0 0 8px ${p.color}`;
      bullet.style.border = '2px solid #aa0000';
    } else if (p.fire) {
      bullet.style.borderRadius = '60%';
      bullet.style.boxShadow = `0 0 15px ${p.color}, 0 0 30px #ff4400`;
      bullet.style.border = 'none';
      bullet.style.opacity = '0.8';
    } else if (p.freeze) {
      bullet.style.borderRadius = '40%';
      bullet.style.boxShadow = `0 0 10px ${p.color}, 0 0 20px #00aaff`;
      bullet.style.border = '2px solid #ffffff';
    } else if (p.lightning) {
      bullet.style.borderRadius = '20%';
      bullet.style.boxShadow = `0 0 15px ${p.color}, 0 0 30px #ffff00`;
      bullet.style.border = '1px solid #ffff88';
      bullet.style.animation = 'pulse 0.1s infinite';
    } else if (p.acid) {
      bullet.style.borderRadius = '70%';
      bullet.style.boxShadow = `0 0 8px ${p.color}, 0 0 16px #44ff00`;
      bullet.style.border = '2px solid #66ff00';
    } else if (p.homing) {
      bullet.style.borderRadius = '20% 80% 20% 80%';
      bullet.style.boxShadow = `0 0 10px ${p.color}`;
      bullet.style.border = '2px solid #aa00aa';
      bullet.style.transform = `rotate(${Math.atan2(p.dy, p.dx) * 180 / Math.PI}deg)`;
    } else if (p.shotgun) {
      bullet.style.borderRadius = '80%';
      bullet.style.boxShadow = `0 0 6px ${p.color}`;
      bullet.style.border = '1px solid #cc4400';
    } else if (p.sniper) {
      bullet.style.borderRadius = '10%';
      bullet.style.boxShadow = `0 0 6px ${p.color}, 0 0 12px #00ff00`;
      bullet.style.border = '1px solid #00aa00';
    } else if (p.bouncer) {
      bullet.style.borderRadius = '50%';
      bullet.style.boxShadow = `0 0 8px ${p.color}`;
      bullet.style.border = '2px solid #ff6600';
      bullet.style.animation = 'pulse 0.3s infinite';
    } else {
      bullet.style.borderRadius = '50%';
      bullet.style.boxShadow = `0 0 4px ${p.color}`;
    }

    // Add trail effects for certain weapons
    if (p.trail || p.railgun || p.sniper) {
      const trail = document.createElement('div');
      trail.style.position = 'absolute';
      trail.style.width = (p.size * 0.3) + 'px';
      trail.style.height = (p.size * 0.3) + 'px';
      trail.style.left = (p.x - p.dx * 10) + 'px';
      trail.style.top = (p.y - p.dy * 10) + 'px';
      trail.style.background = p.color;
      trail.style.borderRadius = '50%';
      trail.style.opacity = '0.5';
      trail.style.boxShadow = `0 0 6px ${p.color}`;
      projectileLayer.appendChild(trail);
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
    expElem.style.left = (explosion.x - explosion.size / 2) + 'px';
    expElem.style.top = (explosion.y - explosion.size / 2) + 'px';
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

  // Notify nearby enemies about the explosion for fear reactions
  notifyEnemiesOfExplosion(x, y, size);
}

function notifyEnemiesOfExplosion(x, y, size) {
  const fearRadius = size * 2;

  for (const enemy of enemies) {
    if (!enemy.active) continue;

    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < fearRadius) {
      // Increase fear based on proximity and personality
      let fearIncrease = Math.max(0, 40 - distance * 0.3);

      // Personality modifiers
      if (enemy.personality === 'coward') fearIncrease *= 1.5;
      else if (enemy.personality === 'berserker') fearIncrease *= 0.3;
      else if (enemy.personality === 'aggressive') fearIncrease *= 0.5;

      // Courage reduces fear
      fearIncrease = Math.max(0, fearIncrease - enemy.courage * 0.3);

      enemy.fearLevel = Math.min(enemy.maxFear, enemy.fearLevel + fearIncrease);
      enemy.lastSawExplosion = Date.now();

      // Some enemies might panic or flee immediately
      if (enemy.fearLevel > enemy.courage * 1.2) {
        if (enemy.personality === 'coward' || Math.random() < 0.3) {
          enemy.behaviorState = 'fleeing';
          enemy.targetX = enemy.x - (x - enemy.x);
          enemy.targetY = enemy.y - (y - enemy.y);
          enemy.behaviorTimer = 0;
        }
      }
    }
  }
}

function notifyEnemiesOfDeath(x, y, deadEnemy) {
  const witnessRadius = 100;

  for (const enemy of enemies) {
    if (!enemy.active || enemy === deadEnemy) continue;

    const dx = enemy.x - x;
    const dy = enemy.y - y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < witnessRadius) {
      let fearIncrease = Math.max(0, 25 - distance * 0.2);

      // Same group members are more affected
      if (enemy.groupId === deadEnemy.groupId) {
        fearIncrease *= 1.5;
      }

      // Personality modifiers
      if (enemy.personality === 'coward') fearIncrease *= 2;
      else if (enemy.personality === 'berserker') fearIncrease *= 0.2;

      enemy.fearLevel = Math.min(enemy.maxFear, enemy.fearLevel + fearIncrease);
      enemy.lastSawDeath = Date.now();

      // Chance to flee or investigate
      if (enemy.fearLevel > enemy.courage) {
        if (enemy.personality === 'coward') {
          enemy.behaviorState = 'fleeing';
          enemy.targetX = enemy.x - (x - enemy.x);
          enemy.targetY = enemy.y - (y - enemy.y);
        }
      } else if (enemy.personality === 'curious') {
        enemy.behaviorState = 'investigating';
        enemy.targetX = x;
        enemy.targetY = y;
      }

      enemy.behaviorTimer = 0;
    }
  }
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

  // Enhanced weapon system with more variety and sharpened mechanics
  switch (weaponType) {
    case 'spread':
      // Triple shot with tighter spread and higher damage
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(dy, dx) + i * 0.25;
        projectiles.push({
          x: bulletX,
          y: bulletY,
          dx: Math.cos(angle) * 1.2,
          dy: Math.sin(angle) * 1.2,
          size: projectileSize * 0.9,
          color: '#4caf50',
          damage: 30,
          pierce: false
        });
      }
      break;

    case 'rapid':
      // Fast, smaller bullets with slight inaccuracy
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 1.5 + (Math.random() - 0.5) * 0.2,
        dy: dy * 1.5 + (Math.random() - 0.5) * 0.2,
        size: projectileSize * 0.7,
        color: '#ff9800',
        damage: 20
      });
      break;

    case 'explosive':
      // Slower but devastating explosive rounds
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 0.8,
        dy: dy * 0.8,
        size: projectileSize * 1.5,
        color: '#e91e63',
        explosive: true,
        damage: 45,
        explosionRange: 60
      });
      break;

    case 'laser':
      // Instant hit laser with perfect accuracy
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 3,
        dy: dy * 3,
        size: projectileSize * 0.4,
        color: '#ff0080',
        pierce: true,
        damage: 50,
        laser: true,
        trail: true
      });
      break;

    case 'plasma':
      // Dual plasma bolts with area damage
      for (let i = 0; i < 2; i++) {
        projectiles.push({
          x: bulletX + (i === 0 ? -5 : 5),
          y: bulletY,
          dx: dx + (Math.random() - 0.5) * 0.3,
          dy: dy + (Math.random() - 0.5) * 0.3,
          size: projectileSize * 1.3,
          color: '#8000ff',
          explosive: true,
          damage: 40,
          plasma: true,
          explosionRange: 40
        });
      }
      break;

    case 'railgun':
      // Ultra-high velocity piercing shot
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 4,
        dy: dy * 4,
        size: projectileSize * 0.3,
        color: '#00ff80',
        pierce: true,
        damage: 75,
        railgun: true,
        trail: true,
        pierceCount: 5
      });
      break;

    case 'nuclear':
      // Massive explosion with radiation damage
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 0.7,
        dy: dy * 0.7,
        size: projectileSize * 2.2,
        color: '#ffff00',
        explosive: true,
        nuclear: true,
        damage: 100,
        explosionRange: 100,
        radiation: true
      });
      break;

    case 'quantum':
      // Quantum burst with teleporting projectiles
      for (let i = 0; i < 8; i++) {
        const angle = (i / 8) * Math.PI * 2;
        projectiles.push({
          x: bulletX,
          y: bulletY,
          dx: Math.cos(angle) * 1.8,
          dy: Math.sin(angle) * 1.8,
          size: projectileSize * 0.8,
          color: '#ff8000',
          quantum: true,
          damage: 35,
          teleport: Math.random() < 0.3
        });
      }
      break;

    case 'antimatter':
      // Reality-warping antimatter shot
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 1.2,
        dy: dy * 1.2,
        size: projectileSize * 2,
        color: '#ffffff',
        antimatter: true,
        pierce: true,
        explosive: true,
        damage: 120,
        explosionRange: 80,
        voidDamage: true
      });
      break;

    // NEW WEAPONS
    case 'shotgun':
      // Wide spread of pellets
      for (let i = 0; i < 7; i++) {
        const angle = Math.atan2(dy, dx) + (i - 3) * 0.15;
        const velocity = 1.0 + Math.random() * 0.5;
        projectiles.push({
          x: bulletX,
          y: bulletY,
          dx: Math.cos(angle) * velocity,
          dy: Math.sin(angle) * velocity,
          size: projectileSize * 0.6,
          color: '#ff6600',
          damage: 18,
          shotgun: true
        });
      }
      break;

    case 'flamethrower':
      // Continuous flame stream
      for (let i = 0; i < 5; i++) {
        const angle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 0.4;
        projectiles.push({
          x: bulletX + (Math.random() - 0.5) * 15,
          y: bulletY + (Math.random() - 0.5) * 15,
          dx: Math.cos(angle) * (0.8 + Math.random() * 0.4),
          dy: Math.sin(angle) * (0.8 + Math.random() * 0.4),
          size: projectileSize * (1 + Math.random() * 0.5),
          color: ['#ff4400', '#ff6600', '#ff8800', '#ffaa00'][Math.floor(Math.random() * 4)],
          damage: 15,
          fire: true,
          life: 30 + Math.random() * 20
        });
      }
      break;

    case 'freeze':
      // Ice projectiles that slow enemies
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx,
        dy: dy,
        size: projectileSize * 1.1,
        color: '#00ccff',
        damage: 25,
        freeze: true,
        slowEffect: 0.5,
        slowDuration: 120
      });
      break;

    case 'lightning':
      // Chain lightning that jumps between enemies
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 2.5,
        dy: dy * 2.5,
        size: projectileSize * 0.5,
        color: '#ffff88',
        damage: 40,
        lightning: true,
        chainCount: 3,
        chainRange: 80
      });
      break;

    case 'acid':
      // Acid that creates damaging pools
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 0.9,
        dy: dy * 0.9,
        size: projectileSize * 1.2,
        color: '#88ff00',
        damage: 30,
        acid: true,
        poolDamage: 5,
        poolDuration: 300
      });
      break;

    case 'homing':
      // Smart missiles that track enemies
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx,
        dy: dy,
        size: projectileSize * 1.1,
        color: '#ff00ff',
        damage: 35,
        homing: true,
        homingStrength: 0.1,
        explosive: true,
        explosionRange: 45
      });
      break;

    case 'minigun':
      // Rapid fire with spin-up mechanic
      const spinUp = Math.min(1, (Date.now() - (window.minigunStartTime || Date.now())) / 2000);
      const bullets = Math.floor(1 + spinUp * 3);
      for (let i = 0; i < bullets; i++) {
        projectiles.push({
          x: bulletX + (Math.random() - 0.5) * 10,
          y: bulletY + (Math.random() - 0.5) * 10,
          dx: dx + (Math.random() - 0.5) * 0.4,
          dy: dy + (Math.random() - 0.5) * 0.4,
          size: projectileSize * 0.6,
          color: '#ffaa00',
          damage: 15
        });
      }
      break;

    case 'sniper':
      // High damage, perfect accuracy, slow fire rate
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 3.5,
        dy: dy * 3.5,
        size: projectileSize * 0.4,
        color: '#00ff00',
        damage: 90,
        pierce: true,
        pierceCount: 3,
        sniper: true,
        trail: true
      });
      break;

    case 'bouncer':
      // Projectiles that bounce off walls
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 1.2,
        dy: dy * 1.2,
        size: projectileSize,
        color: '#ff8800',
        damage: 28,
        bounces: 3,
        bouncer: true
      });
      break;

    default:
      // Enhanced default weapon
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 1.1,
        dy: dy * 1.1,
        size: projectileSize,
        color: '#ffff00',
        damage: 25
      });
  }

  if (ammo === 0) reload();
  updateUI();
}

// Player 2 shooting function
function shoot2() {
  if (gameState !== 'playing' || !player2Active || reloading2 || ammo2 <= 0) return;

  const now = Date.now();
  if (now - lastShot2 < fireRate2) return;

  ammo2--;
  lastShot2 = now;

  // Determine direction for Player 2
  let dx = 0, dy = 0;
  if (lastDirection2 === 'w') dy = -1;
  if (lastDirection2 === 's') dy = 1;
  if (lastDirection2 === 'a') dx = -1;
  if (lastDirection2 === 'd') dx = 1;

  // Handle diagonal movement for Player 2
  if (moveDirs2.has('ArrowUp') && moveDirs2.has('ArrowLeft')) { dx = -0.7; dy = -0.7; }
  else if (moveDirs2.has('ArrowUp') && moveDirs2.has('ArrowRight')) { dx = 0.7; dy = -0.7; }
  else if (moveDirs2.has('ArrowDown') && moveDirs2.has('ArrowLeft')) { dx = -0.7; dy = 0.7; }
  else if (moveDirs2.has('ArrowDown') && moveDirs2.has('ArrowRight')) { dx = 0.7; dy = 0.7; }

  const bulletX = pos2X + pixelCommando[0].length * pixelSize / 2;
  const bulletY = pos2Y + 5 * pixelSize;

  // Create muzzle flash
  createMuzzleFlash(bulletX + dx * 15, bulletY + dy * 15);

  // Player 2 uses same weapon system as Player 1
  switch (weaponType2) {
    case 'spread':
      for (let i = -1; i <= 1; i++) {
        const angle = Math.atan2(dy, dx) + i * 0.25;
        projectiles.push({
          x: bulletX,
          y: bulletY,
          dx: Math.cos(angle) * 1.2,
          dy: Math.sin(angle) * 1.2,
          size: projectileSize * 0.9,
          color: '#4caf50',
          damage: 30,
          pierce: false,
          player: 2
        });
      }
      break;

    case 'rapid':
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 1.5 + (Math.random() - 0.5) * 0.2,
        dy: dy * 1.5 + (Math.random() - 0.5) * 0.2,
        size: projectileSize * 0.7,
        color: '#ff9800',
        damage: 20,
        player: 2
      });
      break;

    default:
      // Enhanced default weapon for Player 2 (blue bullets)
      projectiles.push({
        x: bulletX,
        y: bulletY,
        dx: dx * 1.1,
        dy: dy * 1.1,
        size: projectileSize,
        color: '#00aaff', // Blue bullets for Player 2
        damage: 25,
        player: 2
      });
  }

  if (ammo2 === 0) reload2();
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

function reload2() {
  if (reloading2) return;
  reloading2 = true;
  updateUI();

  setTimeout(() => {
    ammo2 = maxAmmo;
    reloading2 = false;
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

        // NEW WEAPON EFFECTS
        if (projectile.freeze) {
          // Freeze effect slows enemy
          enemy.frozen = true;
          enemy.freezeTime = projectile.slowDuration || 120;
          enemy.slowFactor = projectile.slowEffect || 0.5;
          createExplosion(projectile.x, projectile.y, 25); // Ice explosion
        }

        if (projectile.lightning) {
          // Chain lightning jumps to nearby enemies
          const chainCount = projectile.chainCount || 3;
          const chainRange = projectile.chainRange || 80;
          let currentTarget = enemy;

          for (let i = 0; i < chainCount; i++) {
            let nearestEnemy = null;
            let nearestDistance = Infinity;

            for (const chainEnemy of enemies) {
              if (chainEnemy === currentTarget || !chainEnemy.active) continue;
              const chainDx = chainEnemy.x - currentTarget.x;
              const chainDy = chainEnemy.y - currentTarget.y;
              const chainDist = Math.sqrt(chainDx * chainDx + chainDy * chainDy);

              if (chainDist < chainRange && chainDist < nearestDistance) {
                nearestDistance = chainDist;
                nearestEnemy = chainEnemy;
              }
            }

            if (nearestEnemy) {
              nearestEnemy.health -= damage * 0.7; // Reduced chain damage
              nearestEnemy.hitFlash = 8;
              createMuzzleFlash(nearestEnemy.x + 10, nearestEnemy.y + 10);
              currentTarget = nearestEnemy;
            } else {
              break;
            }
          }
        }

        if (projectile.acid) {
          // Create acid pool that damages over time
          const acidPool = {
            x: projectile.x,
            y: projectile.y,
            size: 30,
            damage: projectile.poolDamage || 5,
            life: projectile.poolDuration || 300,
            color: '#88ff00',
            type: 'acid'
          };
          // Add to a special acid pools array (we'll need to create this)
          if (!window.acidPools) window.acidPools = [];
          window.acidPools.push(acidPool);
        }

        if (projectile.fire) {
          // Fire damage over time
          enemy.burning = true;
          enemy.burnTime = 60;
          enemy.burnDamage = 2;
        }

        // Handle piercing projectiles
        if (projectile.pierce && projectile.pierceCount) {
          projectile.pierceCount--;
          if (projectile.pierceCount <= 0) {
            projectile.hit = true;
          }
        }

        if (enemy.health <= 0) {
          enemy.active = false;
          enemiesKilled++;
          const points = enemy.points || 100;
          score += points;

          // Notify other enemies of this death
          notifyEnemiesOfDeath(enemy.x + 10, enemy.y + 10, enemy);

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

          // INCREASED powerup drop chance for much harder levels
          const dropChance = 0.18 + (level * 0.03); // Significantly increased!
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
        currentBoss.x + currentBoss.size.width / 2,
        currentBoss.y + currentBoss.size.height / 2,
        weaponType,
        currentBoss
      );
      bloodEffects.push(bossHitBlood);

      // Create blood pool for heavy boss damage
      if (weaponType === 'explosive' || weaponType === 'plasma') {
        const bossHitPool = createBloodPool(
          currentBoss.x + currentBoss.size.width / 2,
          currentBoss.y + currentBoss.size.height / 2,
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
        currentBoss.x + currentBoss.size.width / 2,
        currentBoss.y + currentBoss.size.height / 2,
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

      createExplosion(currentBoss.x + currentBoss.size.width / 2, currentBoss.y + currentBoss.size.height / 2, 120);

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
        handlePlayerDeath(1);
      }
      break;
    }
  }

  // Enemy projectiles vs Player 2
  if (player2Active) {
    for (const projectile of enemyProjectiles) {
      if (projectile.hit) continue;

      const dx2 = projectile.x - (pos2X + 10);
      const dy2 = projectile.y - (pos2Y + 10);
      const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (distance2 < 10) {
        projectile.hit = true;

        if (player2Shield > 0) {
          player2Shield -= projectile.damage;
          if (player2Shield < 0) {
            player2Health += player2Shield; // Overflow damage
            player2Shield = 0;
            updateUI();
          }
        } else {
          player2Health -= projectile.damage;
          // Create blood effect when Player 2 takes damage
          const player2BloodEffect = createBloodEffect(pos2X + 10, pos2Y + 10, null, 0.8);
          bloodEffects.push(player2BloodEffect);
          updateUI();
        }

        if (player2Health <= 0) {
          handlePlayerDeath(2);
        }
        break;
      }
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
        handlePlayerDeath(1);
      }
      break;
    }
  }

  // Boss projectiles vs Player 2
  if (player2Active) {
    for (const projectile of bossProjectiles) {
      if (projectile.hit) continue;

      const dx2 = projectile.x - (pos2X + 10);
      const dy2 = projectile.y - (pos2Y + 10);
      const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (distance2 < 12) {
        projectile.hit = true;

        if (projectile.explosive) {
          createExplosion(projectile.x, projectile.y, 30);
        }

        if (player2Shield > 0) {
          player2Shield -= projectile.damage;
          if (player2Shield < 0) {
            player2Health += player2Shield;
            player2Shield = 0;
            updateUI();
          }
        } else {
          player2Health -= projectile.damage;
          // Create blood effect when Player 2 takes damage from boss
          const player2BloodEffect = createBloodEffect(pos2X + 10, pos2Y + 10, null, 1.0);
          bloodEffects.push(player2BloodEffect);
          updateUI();
        }

        if (player2Health <= 0) {
          handlePlayerDeath(2);
        }
        break;
      }
    }
  }

  // Powerup collection - Player 1
  for (const powerup of powerups) {
    if (!powerup.active) continue;

    const dx = posX + 10 - powerup.x;
    const dy = posY + 10 - powerup.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < 20) {
      powerup.active = false;
      collectPowerup(powerup, 1);
    }
  }

  // Powerup collection - Player 2
  if (player2Active) {
    for (const powerup of powerups) {
      if (!powerup.active) continue;

      const dx2 = pos2X + 10 - powerup.x;
      const dy2 = pos2Y + 10 - powerup.y;
      const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (distance2 < 20) {
        powerup.active = false;
        collectPowerup(powerup, 2);
      }
    }
  }
}

function collectPowerup(powerup, playerNum = 1) {
  const typeObj = powerupTypes.find(t => t.type === powerup.type);
  if (!typeObj) return;

  // Helper function to add powerup to active list
  function addActivePowerup(typeObj) {
    activePowerups.push({
      ...typeObj,
      endTime: Date.now() + typeObj.duration
    });
  }

  switch (powerup.type) {
    case 'health':
      if (playerNum === 1) {
        playerHealth = Math.min(maxPlayerHealth, playerHealth + 40);
        showChaosMessage('💊 PLAYER 1 HEALTH RESTORED! 💊');
      } else if (playerNum === 2 && player2Active) {
        player2Health = Math.min(maxPlayerHealth, player2Health + 40);
        showChaosMessage('💊 PLAYER 2 HEALTH RESTORED! 💊');
      }
      break;

    case 'ammo':
      if (playerNum === 1) {
        ammo = maxAmmo;
        reloading = false;
        showChaosMessage('🔫 PLAYER 1 AMMO REFILLED! 🔫');
      } else if (playerNum === 2 && player2Active) {
        ammo2 = maxAmmo;
        reloading2 = false;
        showChaosMessage('🔫 PLAYER 2 AMMO REFILLED! 🔫');
      }
      break;

    case 'shield':
      if (playerNum === 1) {
        playerShield = 100;
        showChaosMessage('🛡️ PLAYER 1 SHIELD ACTIVATED! 🛡️');
      } else if (playerNum === 2 && player2Active) {
        player2Shield = 100;
        showChaosMessage('🛡️ PLAYER 2 SHIELD ACTIVATED! 🛡️');
      }
      addActivePowerup(typeObj);
      break;

    // Weapon powerups affect both players
    case 'rapid':
      if (playerNum === 1) {
        weaponType = 'rapid';
        fireRate = 80;
      } else if (playerNum === 2 && player2Active) {
        weaponType2 = 'rapid';
        fireRate2 = 80;
      }
      addActivePowerup(typeObj);
      showChaosMessage(`🔥 PLAYER ${playerNum} RAPID FIRE! 🔥`);
      break;

    case 'spread':
      if (playerNum === 1) {
        weaponType = 'spread';
      } else if (playerNum === 2 && player2Active) {
        weaponType2 = 'spread';
      }
      addActivePowerup(typeObj);
      showChaosMessage(`💥 PLAYER ${playerNum} SPREAD SHOT! 💥`);
      break;

    case 'explosive':
      weaponType = 'explosive';
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'laser':
      if (playerNum === 1) {
        weaponType = 'laser';
        fireRate = 100;
      } else if (playerNum === 2 && player2Active) {
        weaponType2 = 'laser';
        fireRate2 = 100;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`⚡ PLAYER ${playerNum} LASER BEAM! ⚡`);
      break;

    case 'plasma':
      if (playerNum === 1) {
        weaponType = 'plasma';
        fireRate = 200;
      } else if (playerNum === 2 && player2Active) {
        weaponType2 = 'plasma';
        fireRate2 = 200;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`🔮 PLAYER ${playerNum} PLASMA CANNON! 🔮`);
      break;

    case 'railgun':
      if (playerNum === 1) {
        weaponType = 'railgun';
        fireRate = 300;
      } else if (playerNum === 2 && player2Active) {
        weaponType2 = 'railgun';
        fireRate2 = 300;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`🎯 PLAYER ${playerNum} RAILGUN! 🎯`);
      break;

    case 'nuclear':
      if (playerNum === 1) {
        weaponType = 'nuclear';
        fireRate = 500;
      } else if (playerNum === 2 && player2Active) {
        weaponType2 = 'nuclear';
        fireRate2 = 500;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`☢️ PLAYER ${playerNum} NUCLEAR ROUNDS! ☢️`);
      break;

    case 'quantum':
      if (playerNum === 1) {
        weaponType = 'quantum';
        fireRate = 400;
      } else if (playerNum === 2 && player2Active) {
        weaponType2 = 'quantum';
        fireRate2 = 400;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`⚛️ PLAYER ${playerNum} QUANTUM BURST! ⚛️`);
      break;

    case 'antimatter':
      weaponType = 'antimatter';
      fireRate = 600;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    // NEW WEAPONS
    case 'shotgun':
      weaponType = 'shotgun';
      fireRate = 400;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'flamethrower':
      weaponType = 'flamethrower';
      fireRate = 50;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'freeze':
      weaponType = 'freeze';
      fireRate = 200;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'lightning':
      weaponType = 'lightning';
      fireRate = 250;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'acid':
      weaponType = 'acid';
      fireRate = 180;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'homing':
      weaponType = 'homing';
      fireRate = 300;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'minigun':
      weaponType = 'minigun';
      fireRate = 60;
      window.minigunStartTime = Date.now();
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'sniper':
      weaponType = 'sniper';
      fireRate = 800;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    case 'bouncer':
      weaponType = 'bouncer';
      fireRate = 220;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      break;

    // NEW POWERUP EFFECTS FOR HARDER LEVELS
    case 'megahealth':
      if (playerNum === 1) {
        playerHealth = maxPlayerHealth; // Full heal
        showChaosMessage('💖 PLAYER 1 FULLY HEALED! 💖');
      } else if (playerNum === 2 && player2Active) {
        player2Health = maxPlayerHealth; // Full heal
        showChaosMessage('💖 PLAYER 2 FULLY HEALED! 💖');
      }
      break;

    case 'doubleammo':
      if (playerNum === 1) {
        ammo = maxAmmo * 2; // Double ammo capacity temporarily
        window.player1DoubleAmmo = true;
      } else if (playerNum === 2 && player2Active) {
        ammo2 = maxAmmo * 2;
        window.player2DoubleAmmo = true;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`🔫 PLAYER ${playerNum} DOUBLE AMMO! 🔫`);
      break;

    case 'rapidreload':
      if (playerNum === 1) {
        window.player1RapidReload = true;
      } else if (playerNum === 2 && player2Active) {
        window.player2RapidReload = true;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`⚡ PLAYER ${playerNum} INSTANT RELOAD! ⚡`);
      break;

    case 'multishield':
      if (playerNum === 1) {
        playerShield = 200; // Double shield strength
      } else if (playerNum === 2 && player2Active) {
        player2Shield = 200;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`🛡️ PLAYER ${playerNum} MEGA SHIELD! 🛡️`);
      break;

    case 'berserker':
      if (playerNum === 1) {
        window.player1Berserker = true;
        fireRate *= 0.5; // Double fire rate
      } else if (playerNum === 2 && player2Active) {
        window.player2Berserker = true;
        fireRate2 *= 0.5;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`💀 PLAYER ${playerNum} BERSERKER MODE! 💀`);
      break;

    case 'timeslow':
      window.chaosTimeSlow = true;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`⏰ TIME DILATION ACTIVATED! ⏰`);
      break;

    case 'ghostmode':
      if (playerNum === 1) {
        window.player1Ghost = true;
      } else if (playerNum === 2 && player2Active) {
        window.player2Ghost = true;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`👻 PLAYER ${playerNum} GHOST MODE! 👻`);
      break;

    case 'magnetism':
      window.chaosMagnetism = true;
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`🧲 MAGNETIC ATTRACTION! 🧲`);
      break;

    case 'multishot':
      if (playerNum === 1) {
        window.player1MultiShot = true;
      } else if (playerNum === 2 && player2Active) {
        window.player2MultiShot = true;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`※ PLAYER ${playerNum} MULTI-SHOT! ※`);
      break;

    case 'regeneration':
      if (playerNum === 1) {
        window.player1Regen = true;
      } else if (playerNum === 2 && player2Active) {
        window.player2Regen = true;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`♻ PLAYER ${playerNum} REGENERATION! ♻`);
      break;

    case 'invincible':
      if (playerNum === 1) {
        window.player1Invincible = true;
      } else if (playerNum === 2 && player2Active) {
        window.player2Invincible = true;
      }
      activePowerups.push({
        ...typeObj,
        endTime: Date.now() + typeObj.duration
      });
      showChaosMessage(`⭐ PLAYER ${playerNum} INVINCIBLE! ⭐`);
      break;

    case 'airstrike':
      // Immediate effect - damage all enemies on screen
      for (const enemy of enemies) {
        if (enemy.active) {
          enemy.health -= 50;
          enemy.hitFlash = 15;
          createExplosion(enemy.x + 10, enemy.y + 10, 40);
        }
      }
      showChaosMessage(`💥 ORBITAL STRIKE DEPLOYED! 💥`);
      break;

    case 'chaos':
      // CHAOS POWERUP! Random effect!
      const chaosEffects = ['health', 'ammo', 'shield', 'rapid', 'spread', 'explosive', 'megahealth', 'berserker'];
      const randomEffect = chaosEffects[Math.floor(Math.random() * chaosEffects.length)];
      showChaosMessage(`🎲 CHAOS POWERUP! ${randomEffect.toUpperCase()}! 🎲`);
      collectPowerup({ type: randomEffect }, playerNum);
      break;
  }

  updateUI();
}

function updatePowerups() {
  const now = Date.now();
  activePowerups = activePowerups.filter(powerup => {
    if (now > powerup.endTime) {
      // Reset weapon type when powerup expires for both players
      if (['rapid', 'spread', 'explosive', 'laser', 'plasma', 'railgun', 'nuclear', 'quantum', 'antimatter',
        'shotgun', 'flamethrower', 'freeze', 'lightning', 'acid', 'homing', 'minigun', 'sniper', 'bouncer'].includes(powerup.type)) {
        // Reset Player 1
        weaponType = 'normal';
        fireRate = 150;
        // Reset Player 2
        if (player2Active) {
          weaponType2 = 'normal';
          fireRate2 = 150;
        }
        if (powerup.type === 'minigun') {
          delete window.minigunStartTime;
        }
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

  // Check if this is a high score
  if (isHighScore(score)) {
    showNameInput(score, level, () => {
      document.getElementById('game-over').style.display = 'block';
    });
  } else {
    document.getElementById('game-over').style.display = 'block';
  }
}

function victory() {
  gameState = 'victory';
  document.getElementById('victory-score').textContent = score.toLocaleString();

  // Check if this is a high score
  if (isHighScore(score)) {
    showNameInput(score, level, () => {
      document.getElementById('victory').style.display = 'block';
    });
  } else {
    document.getElementById('victory').style.display = 'block';
  }
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
window.restartGame = function () {
  initGame();
};

// Update functions
function updateEnemies() {
  for (const enemy of enemies) {
    if (!enemy.active) continue;

    // Handle status effects
    if (enemy.frozen && enemy.freezeTime > 0) {
      enemy.freezeTime--;
      if (enemy.freezeTime <= 0) {
        enemy.frozen = false;
        enemy.slowFactor = 1.0;
      }
    }

    if (enemy.burning && enemy.burnTime > 0) {
      enemy.burnTime--;
      if (enemy.burnTime % 20 === 0) { // Damage every 20 frames
        enemy.health -= enemy.burnDamage || 2;
        // Create small fire effect
        const fireEffect = createBloodEffect(enemy.x + 10, enemy.y + 10, null, 0.3);
        fireEffect.drops.forEach(drop => {
          drop.color = '#ff4400';
          drop.size *= 0.5;
        });
        bloodEffects.push(fireEffect);
      }
      if (enemy.burnTime <= 0) {
        enemy.burning = false;
      }
    }

    // Update enemy and get projectile if it shoots
    const projectile = updateEnemy(enemy, posX, posY, enemies, explosions);
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

      // Notify other enemies of this death
      notifyEnemiesOfDeath(enemy.x + 10, enemy.y + 10, enemy);

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
        handlePlayerDeath(1);
      }
    }

    // Check Player 2 contact damage
    if (player2Active) {
      const dx2 = pos2X - enemy.x;
      const dy2 = pos2Y - enemy.y;
      const distance2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);

      if (distance2 < 15) {
        enemy.active = false;
        enemiesKilled++; // Count contact kills for Player 2 too!

        // Notify other enemies of this death
        notifyEnemiesOfDeath(enemy.x + 10, enemy.y + 10, enemy);

        // Create death blood effect for Player 2 contact kill
        const contactDeathBlood2 = createDeathBloodEffect(enemy.x + 10, enemy.y + 10, enemy);
        bloodEffects.push(contactDeathBlood2);

        // Create blood pool
        const contactBloodPool2 = createBloodPool(enemy.x + 10, enemy.y + 10, enemy, 1.2);
        bloodPools.push(contactBloodPool2);

        if (player2Shield > 0) {
          player2Shield -= 20;
          if (player2Shield < 0) {
            player2Health += player2Shield;
            player2Shield = 0;
            updateUI();
          }
        } else {
          player2Health -= 20;
          // Create blood effect when Player 2 takes contact damage
          const player2BloodEffect = createBloodEffect(pos2X + 10, pos2Y + 10, null, 0.6);
          bloodEffects.push(player2BloodEffect);
          updateUI();
        }

        if (player2Health <= 0) {
          handlePlayerDeath(2);
        }
      }
    }
  }

  // Remove inactive enemies - but keep count accurate
  enemies = enemies.filter(enemy => enemy.active);
}

function updateProjectiles() {
  // Update player projectiles with enhanced mechanics
  for (const projectile of projectiles) {
    if (projectile.hit && !projectile.pierce) continue;

    // Handle special weapon mechanics
    if (projectile.homing && !projectile.hit) {
      // Find nearest enemy for homing
      let nearestEnemy = null;
      let nearestDistance = Infinity;

      for (const enemy of enemies) {
        if (!enemy.active) continue;
        const dx = enemy.x - projectile.x;
        const dy = enemy.y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < nearestDistance && distance < 150) {
          nearestDistance = distance;
          nearestEnemy = enemy;
        }
      }

      if (nearestEnemy) {
        const dx = nearestEnemy.x - projectile.x;
        const dy = nearestEnemy.y - projectile.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance > 0) {
          const homingStrength = projectile.homingStrength || 0.1;
          projectile.dx += (dx / distance) * homingStrength;
          projectile.dy += (dy / distance) * homingStrength;

          // Limit speed
          const speed = Math.sqrt(projectile.dx * projectile.dx + projectile.dy * projectile.dy);
          const maxSpeed = 3;
          if (speed > maxSpeed) {
            projectile.dx = (projectile.dx / speed) * maxSpeed;
            projectile.dy = (projectile.dy / speed) * maxSpeed;
          }
        }
      }
    }

    // Handle bouncing projectiles
    if (projectile.bouncer && projectile.bounces > 0) {
      const nextX = projectile.x + projectileSpeed * projectile.dx;
      const nextY = projectile.y + projectileSpeed * projectile.dy;

      // Check wall bounces
      if (nextX <= 0 || nextX >= gameWidth) {
        projectile.dx = -projectile.dx;
        projectile.bounces--;
        createMuzzleFlash(projectile.x, projectile.y);
      }
      if (nextY <= 0 || nextY >= gameHeight) {
        projectile.dy = -projectile.dy;
        projectile.bounces--;
        createMuzzleFlash(projectile.x, projectile.y);
      }
    }

    // Handle quantum teleportation
    if (projectile.quantum && projectile.teleport && Math.random() < 0.02) {
      projectile.x = Math.random() * gameWidth;
      projectile.y = Math.random() * gameHeight;
      createMuzzleFlash(projectile.x, projectile.y);
    }

    // Handle fire projectile decay
    if (projectile.fire) {
      projectile.life = (projectile.life || 50) - 1;
      if (projectile.life <= 0) {
        projectile.hit = true;
      }
      // Fire spreads and slows down
      projectile.dx *= 0.98;
      projectile.dy *= 0.98;
    }

    // Update position
    const speed = projectile.laser || projectile.railgun ? projectileSpeed * 2 : projectileSpeed;
    projectile.x += speed * projectile.dx;
    projectile.y += speed * projectile.dy;
  }

  // Update enemy projectiles
  for (const projectile of enemyProjectiles) {
    if (projectile.hit) continue;

    projectile.x += projectile.dx;
    projectile.y += projectile.dy;
  }

  // Update boss projectiles with enhanced homing
  for (const projectile of bossProjectiles) {
    if (projectile.hit) continue;

    // Enhanced homing projectiles
    if (projectile.homing) {
      const dx = posX - projectile.x;
      const dy = posY - projectile.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        const homingStrength = 0.15;
        projectile.dx += (dx / distance) * homingStrength;
        projectile.dy += (dy / distance) * homingStrength;

        // Limit speed
        const speed = Math.sqrt(projectile.dx * projectile.dx + projectile.dy * projectile.dy);
        if (speed > 5) {
          projectile.dx = (projectile.dx / speed) * 5;
          projectile.dy = (projectile.dy / speed) * 5;
        }
      }
    }

    projectile.x += projectile.dx;
    projectile.y += projectile.dy;
  }

  // Enhanced projectile filtering with special cases
  projectiles = projectiles.filter(p => {
    // Keep piercing projectiles even if hit
    if (p.hit && p.pierce && p.pierceCount > 0) return true;

    // Remove hit non-piercing projectiles
    if (p.hit && !p.pierce) return false;

    // Remove fire projectiles that have expired
    if (p.fire && p.life <= 0) return false;

    // Remove bouncing projectiles that have no bounces left and are off-screen
    if (p.bouncer && p.bounces <= 0 && (p.x < -20 || p.x > gameWidth + 20 || p.y < -20 || p.y > gameHeight + 20)) {
      return false;
    }

    // Keep projectiles on screen or with special properties
    return p.x >= -50 && p.x < gameWidth + 50 && p.y >= -50 && p.y < gameHeight + 50;
  });

  enemyProjectiles = enemyProjectiles.filter(p =>
    !p.hit && p.x >= -20 && p.x < gameWidth + 20 && p.y >= -20 && p.y < gameHeight + 20
  );

  bossProjectiles = bossProjectiles.filter(p =>
    !p.hit && p.x >= -20 && p.x < gameWidth + 20 && p.y >= -20 && p.y < gameHeight + 20
  );
}

function updateEffects() {
  // Update blood effects using proper blood system
  bloodEffects = updateBloodEffects(bloodEffects);
  bloodPools = updateBloodPools(bloodPools);

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

    // CHAOS: Enhanced slippery floors with momentum
    if (window.chaosSlippery) {
      const multiplier = window.chaosSlipperyMultiplier || 1;
      moveX += (Math.random() - 0.5) * 6 * multiplier;
      moveY += (Math.random() - 0.5) * 6 * multiplier;

      // Add momentum effect
      if (!window.slipperyMomentum) window.slipperyMomentum = { x: 0, y: 0 };
      window.slipperyMomentum.x += (Math.random() - 0.5) * 2;
      window.slipperyMomentum.y += (Math.random() - 0.5) * 2;

      // Apply momentum with decay
      moveX += window.slipperyMomentum.x;
      moveY += window.slipperyMomentum.y;
      window.slipperyMomentum.x *= 0.95;
      window.slipperyMomentum.y *= 0.95;
    } else if (window.slipperyMomentum) {
      // Clear momentum when not slippery
      window.slipperyMomentum = { x: 0, y: 0 };
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

  // Handle Player 2 movement
  if (player2Active && moveDirs2.size > 0) {
    animFrame2 = (animFrame2 + 1) % 2;
    let speed2 = pixelSize * 3;

    // CHAOS EFFECTS affect Player 2 too!
    if (window.chaosSpeedDemon) speed2 *= 3;
    if (window.chaosTinyMode) speed2 *= 0.5;
    if (window.chaosSlippery) speed2 *= 1.8;

    let moveX2 = 0, moveY2 = 0;
    if (moveDirs2.has('ArrowUp')) moveY2 -= speed2;
    if (moveDirs2.has('ArrowDown')) moveY2 += speed2;
    if (moveDirs2.has('ArrowLeft')) moveX2 -= speed2;
    if (moveDirs2.has('ArrowRight')) moveX2 += speed2;

    // CHAOS: Gravity flip affects Player 2!
    if (window.chaosGravityFlip) {
      moveY2 = -moveY2;
    }

    // CHAOS: Slippery floors affect Player 2!
    if (window.chaosSlippery) {
      const multiplier = window.chaosSlipperyMultiplier || 1;
      moveX2 += (Math.random() - 0.5) * 6 * multiplier;
      moveY2 += (Math.random() - 0.5) * 6 * multiplier;

      // Player 2 gets their own momentum
      if (!window.slipperyMomentum2) window.slipperyMomentum2 = { x: 0, y: 0 };
      window.slipperyMomentum2.x += (Math.random() - 0.5) * 2;
      window.slipperyMomentum2.y += (Math.random() - 0.5) * 2;

      moveX2 += window.slipperyMomentum2.x;
      moveY2 += window.slipperyMomentum2.y;
      window.slipperyMomentum2.x *= 0.95;
      window.slipperyMomentum2.y *= 0.95;
    } else if (window.slipperyMomentum2) {
      window.slipperyMomentum2 = { x: 0, y: 0 };
    }

    pos2X += moveX2;
    pos2Y += moveY2;

    // Clamp Player 2 to game area
    const maxX2 = gameWidth - pixelCommando[0].length * pixelSize;
    const maxY2 = gameHeight - pixelCommando.length * pixelSize;
    pos2X = Math.max(0, Math.min(pos2X, maxX2));
    pos2Y = Math.max(0, Math.min(pos2Y, maxY2));
    isMoving2 = true;
  } else {
    isMoving2 = false;
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

  // Render Player 2 if active
  if (player2Active) {
    renderPlayer2(pos2X, pos2Y, animFrame2, isMoving2 ? (animFrame2 === 0 ? 0 : 2) : 0);
  }

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
let moveDirs2 = new Set();

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

// Player 2 movement functions
function startMove2(dir) {
  // CHAOS: Reverse controls affect Player 2 too!
  if (window.chaosReversed) {
    const reverseMap = { 'ArrowUp': 'ArrowDown', 'ArrowDown': 'ArrowUp', 'ArrowLeft': 'ArrowRight', 'ArrowRight': 'ArrowLeft' };
    dir = reverseMap[dir] || dir;
  }

  moveDirs2.add(dir);
  // Convert arrow keys to direction letters for consistency
  const dirMap = { 'ArrowUp': 'w', 'ArrowDown': 's', 'ArrowLeft': 'a', 'ArrowRight': 'd' };
  lastDirection2 = dirMap[dir] || lastDirection2;
}

function stopMove2(dir) {
  moveDirs2.delete(dir);
}

// Event listeners
document.addEventListener('keydown', (e) => {
  if (gameState === 'gameOver' || gameState === 'victory') return;

  switch (e.key.toLowerCase()) {
    // Player 1 controls
    case 'w':
    case 'a':
    case 's':
    case 'd':
      startMove(e.key.toLowerCase());
      break;

    case ' ':
      e.preventDefault();
      shoot();
      break;
    case 'escape':
      togglePause();
      break;

    // Player 2 controls
    case 'arrowup':
    case 'arrowdown':
    case 'arrowleft':
    case 'arrowright':
      if (player2Active) {
        startMove2(e.key);
      }
      break;
    case 'numpad0':
    case 'insert': // Alternative for Num 0
      if (player2Active) {
        e.preventDefault();
        shoot2();
      }
      break;


    // Toggle Player 2
    case 'p':
      togglePlayer2();
      break;
  }
});

document.addEventListener('keyup', (e) => {
  // Player 1 movement
  if (['w', 'a', 's', 'd'].includes(e.key.toLowerCase())) {
    stopMove(e.key.toLowerCase());
  }

  // Player 2 movement
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
    if (player2Active) {
      stopMove2(e.key);
    }
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
