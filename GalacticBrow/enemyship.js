// Check collisions between player lasers and enemies
import { getWeaponDamage } from './enemy_balance.js';
// laser objects must have .weaponType and .tier (add in firing code if not present)
export function checkPlayerLaserHitsEnemies(lasers, enemies, shipWidth, level = 1) {
    // Returns array of destroyed enemy positions for powerup drops
    const destroyed = [];
    for (let laserIndex = lasers.length - 1; laserIndex >= 0; laserIndex--) {
        let hit = false;
        const laser = lasers[laserIndex];
        // Left and right barrels
        const laserRects = [
            { x: laser.x + 10, y: laser.y, w: 2, h: 14 },
            { x: laser.x + shipWidth - 12, y: laser.y, w: 2, h: 14 }
        ];
        for (let enemyIndex = enemies.length - 1; enemyIndex >= 0; enemyIndex--) {
            const enemy = enemies[enemyIndex];
            for (const rect of laserRects) {
                if (
                    rect.x < enemy.x + enemy.width &&
                    rect.x + rect.w > enemy.x &&
                    rect.y < enemy.y + enemy.height &&
                    rect.y + rect.h > enemy.y
                ) {
                    // Determine weapon type and tier
                    const weaponType = laser.weaponType || 'normal';
                    const tier = laser.tier || 1;
                    const dmg = getWeaponDamage(weaponType, tier, enemy.type, level);
                    enemy.health -= dmg;
                    lasers.splice(laserIndex, 1);
                    if (enemy.health <= 0) {
                        destroyed.push({ x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height / 2 });
                        enemies.splice(enemyIndex, 1);
                    }
                    hit = true;
                    break;
                }
            }
            if (hit) break;
        }
        if (hit) continue;
    }
    return destroyed;
}
// Update enemy lasers
export function updateEnemyLasers(enemyLasers, canvas, laserSpeed) {
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        enemyLasers[i].y -= laserSpeed;
        if (enemyLasers[i].y + 14 < 0) { // laser is off the top
            enemyLasers.splice(i, 1);
        }
    }
}

// Draw enemy lasers
export function drawEnemyLasers(ctx, enemyLasers) {
    ctx.save();
    ctx.shadowBlur = 16;
    ctx.shadowColor = '#ff2a2a';
    ctx.fillStyle = '#ff2a2a';
    enemyLasers.forEach(laser => {
        ctx.fillRect(laser.x, laser.y, 2, 14);
    });
    ctx.shadowBlur = 0;
    ctx.restore();
}

// Check collisions between enemy lasers and player
export function checkEnemyLaserHitsPlayer(enemyLasers, shipX, shipY, shipWidth, shipHeight, playerHealth) {
    for (let laserIndex = enemyLasers.length - 1; laserIndex >= 0; laserIndex--) {
        const laser = enemyLasers[laserIndex];
        const rect = { x: laser.x, y: laser.y, w: 2, h: 14 };
        if (
            rect.x < shipX + shipWidth &&
            rect.x + rect.w > shipX &&
            rect.y < shipY + shipHeight &&
            rect.y + rect.h > shipY
        ) {
            playerHealth -= 2;
            enemyLasers.splice(laserIndex, 1);
        }
    }
    return playerHealth;
}
// enemyship.js
// Handles enemy ship logic for GalacticBrow

// Boid/formation variables (will be randomized per wave)
export let BOID_ALIGNMENT = 0.2;
export let BOID_COHESION = 0.7;
export let BOID_SEPARATION = 0.15;
export let BOID_RANDOMNESS = 0.25;
export let BOID_MAX_SPEED = 10;
export let BOID_MAX_FORCE = 0.5;

// Call this before each wave to randomize boid variables
export function randomizeBoidVars() {
    BOID_ALIGNMENT = 0.1 + Math.random() * 0.4; // 0.1 - 0.5
    BOID_COHESION = 0.4 + Math.random() * 1.0;  // 0.4 - 1.4
    BOID_SEPARATION = 0.05 + Math.random() * 0.3; // 0.05 - 0.35
    BOID_RANDOMNESS = 0.1 + Math.random() * 0.5; // 0.1 - 0.6
    BOID_MAX_SPEED = 6 + Math.random() * 8; // 6 - 14
    BOID_MAX_FORCE = 0.2 + Math.random() * 0.7; // 0.2 - 0.9
    console.log('Boid vars:', {BOID_ALIGNMENT, BOID_COHESION, BOID_SEPARATION, BOID_RANDOMNESS, BOID_MAX_SPEED, BOID_MAX_FORCE});
}

export const enemies = [];

// Spawn a new wave of enemies
import { getEnemyHp } from './enemy_balance.js';
export function spawnEnemies(canvas, enemyShipImages, level = 1) {
    enemies.length = 0;
    for (let i = 0; i < 5; i++) {
        const baseX = Math.random() * (canvas.width - 100) + 50;
        // Spawn in lower half of the screen
        const baseY = Math.random() * (canvas.height / 2 - 100) + canvas.height / 2 + 50;
        const imgIndex = Math.floor(Math.random() * enemyShipImages.length);
        // Assign a type: small, medium, large
        const types = [
            { type: 'small', width: 32, height: 32, speed: 3.5, amplitudeX: 90, amplitudeY: 50 },
            { type: 'medium', width: 50, height: 50, speed: 2.2, amplitudeX: 70, amplitudeY: 40 },
            { type: 'large', width: 80, height: 80, speed: 1.2, amplitudeX: 50, amplitudeY: 30 }
        ];
        // Randomly pick a type for each enemy
        const enemyType = types[Math.floor(Math.random() * types.length)];
        // The first enemy is the leader: slower, more stable
        let speed = enemyType.speed + Math.random() * 1.2;
        let amplitudeX = enemyType.amplitudeX + Math.random() * 20;
        let amplitudeY = enemyType.amplitudeY + Math.random() * 10;
        let freqX = 0.008 + Math.random() * 0.012;
        let freqY = 0.01 + Math.random() * 0.015;
        if (i === 0) {
            speed *= 0.55; // leader is slower
            amplitudeX *= 0.7;
            amplitudeY *= 0.7;
            freqX *= 0.7;
            freqY *= 0.7;
        } else {
            speed *= 1.5 + Math.random(); // followers are much faster
            amplitudeX *= 1.2 + Math.random() * 0.5;
            amplitudeY *= 1.2 + Math.random() * 0.5;
            freqX *= 1.2 + Math.random() * 0.5;
            freqY *= 1.2 + Math.random() * 0.5;
        }
        const maxHealth = getEnemyHp(enemyType.type, level);
        // Assign a unique horizontal offset for aggressive mode
        const aggroOffset = (i - 2) * 60 + (Math.random() - 0.5) * 30;
        enemies.push({
            x: baseX,
            y: baseY,
            baseX: baseX,
            baseY: baseY,
            width: enemyType.width,
            height: enemyType.height,
            angle: Math.random() * Math.PI * 2,
            health: maxHealth,
            maxHealth: maxHealth,
            imgIndex: imgIndex,
            amplitudeX: amplitudeX,
            amplitudeY: amplitudeY,
            freqX: freqX,
            freqY: freqY,
            speed: speed,
            t: Math.random() * 1000,
            type: enemyType.type
        });
    }
    console.log('Enemies spawned:', enemies);
}

// Update enemy positions
export function updateEnemies(canvas) {
    // Aggression/boid switching state
    if (!window._enemyAggroState) {
        window._enemyAggroState = { mode: 'boid', timer: 0 };
    }
    const aggroState = window._enemyAggroState;
    aggroState.timer--;
    if (aggroState.timer <= 0) {
        // Switch mode every 2-4 seconds
        aggroState.mode = (aggroState.mode === 'boid') ? 'aggressive' : 'boid';
        aggroState.timer = 120 + Math.floor(Math.random() * 120);
        // When switching, store last boid/aggressive positions for smooth transition
        // Get player X (try to read from window if available)
        // Get player left edge and width
        let playerX = canvas.width / 2;
        if (window.shipX !== undefined) playerX = window.shipX;
        let playerWidth = 60;
        if (window.shipWidth !== undefined) playerWidth = window.shipWidth;
        // Calculate player center X
        const playerCenterX = playerX + playerWidth / 2;
        // In aggressive mode, assign each enemy a random horizontal offset as their target
        enemies.forEach((enemy) => {
            if (!enemy._transition) enemy._transition = {};
            enemy._transition.fromX = enemy.x;
            enemy._transition.fromY = enemy.y;
            enemy._transition.fromBaseY = enemy.baseY;
            enemy._transition.progress = 0;
            if (aggroState.mode === 'aggressive') {
                // Pick a random X within the canvas (minus enemy width)
                enemy.aggroTargetX = Math.random() * (canvas.width - enemy.width);
            }
        });
    }

    // Get player X (try to read from window if available)
    let playerX = canvas.width / 2;
    if (window.shipX !== undefined) playerX = window.shipX;
    let playerWidth = 60;
    if (window.shipWidth !== undefined) playerWidth = window.shipWidth;
    const playerCenterX = playerX + playerWidth / 2;

    enemies.forEach((enemy, idx) => {
        enemy.t += enemy.speed;
        // Smooth transition progress (0 to 1 over 20 frames)
        if (!enemy._transition) enemy._transition = { progress: 1 };
        if (enemy._transition.progress < 1) {
            enemy._transition.progress += 0.05 + Math.random() * 0.03;
            if (enemy._transition.progress > 1) enemy._transition.progress = 1;
        }

        // Add more randomness to movement
        const randX = (Math.random() - 0.5) * 2.5;
        const randY = (Math.random() - 0.5) * 1.5;

        if (aggroState.mode === 'aggressive') {
            // Aggressive: each enemy targets a random horizontal position
            if (enemy.aggroTargetX === undefined) {
                enemy.aggroTargetX = Math.random() * (canvas.width - enemy.width);
            }
            const targetX = enemy.aggroTargetX + randX * 2;
            const dx = targetX - enemy.x;
            // Interpolate X for smooth transition, but slower horizontally
            let newX = enemy.x + Math.sign(dx) * Math.min(Math.abs(dx), 1.1 + Math.random() * 0.7); // Slower horizontal
            if (enemy._transition.progress < 1 && enemy._transition.fromX !== undefined) {
                newX = enemy._transition.fromX + (targetX - enemy._transition.fromX) * enemy._transition.progress;
            }
            enemy.x = newX;

            // --- Aggro vertical: get behind the player ---
            let playerY = canvas.height / 2;
            let playerHeight = 60;
            if (window.shipY !== undefined) playerY = window.shipY;
            if (window.shipHeight !== undefined) playerHeight = window.shipHeight;
            // Target a position well behind the player (e.g., 40-120px below)
            let minY = playerY + playerHeight + 40;
            let maxY = Math.min(canvas.height - enemy.height * 1.5, playerY + playerHeight + 120);
            if (!enemy.agroTargetY || Math.abs(enemy.baseY - enemy.agroTargetY) < 8) {
                enemy.agroTargetY = minY + Math.random() * (maxY - minY);
            }
            let targetY = enemy.agroTargetY;
            // Smoothly move toward target
            enemy.baseY += (targetY - enemy.baseY) * 0.08;
            enemy.y = enemy.baseY;
        } else {
            // Boid/formation (original movement)
            let boidX, boidY;
            if (enemy.type === 'small') {
                boidX = enemy.baseX + Math.sin(enemy.t * enemy.freqX * 1.5) * enemy.amplitudeX * 1.2 + randX;
                boidY = enemy.baseY + Math.cos(enemy.t * enemy.freqY * 1.2) * enemy.amplitudeY * 1.1 + Math.sin(enemy.t * 0.01) * 8 + randY;
            } else if (enemy.type === 'large') {
                boidX = enemy.baseX + Math.sin(enemy.t * enemy.freqX * 0.7) * enemy.amplitudeX * 0.7 + randX;
                boidY = enemy.baseY + Math.cos(enemy.t * enemy.freqY * 0.7) * enemy.amplitudeY * 1.5 + Math.sin(enemy.t * 0.003) * 20 + randY;
            } else {
                boidX = enemy.baseX + Math.sin(enemy.t * enemy.freqX) * enemy.amplitudeX + randX;
                boidY = enemy.baseY + Math.cos(enemy.t * enemy.freqY) * enemy.amplitudeY + Math.sin(enemy.t * 0.005) * 10 + randY;
            }
            // Interpolate for smooth transition
            if (enemy._transition.progress < 1 && enemy._transition.fromX !== undefined && enemy._transition.fromY !== undefined) {
                enemy.x = enemy._transition.fromX + (boidX - enemy._transition.fromX) * enemy._transition.progress;
                enemy.y = enemy._transition.fromY + (boidY - enemy._transition.fromY) * enemy._transition.progress;
            } else {
                enemy.x = boidX;
                enemy.y = boidY;
            }
            enemy.baseY += 0.05 * enemy.speed;
        }
        // Wrap enemies smoothly instead of bouncing
        if (enemy.x < -enemy.width) enemy.x = canvas.width + enemy.width;
        if (enemy.x > canvas.width + enemy.width) enemy.x = -enemy.width;
        if (enemy.y > canvas.height) enemy.baseY = 0;
        if (enemy.y < -enemy.height) enemy.baseY = canvas.height;
    });
}

// Draw all enemies
export function drawEnemies(ctx, enemyShipImages) {
    enemies.forEach(enemy => {
        const img = enemyShipImages[enemy.imgIndex];
        ctx.save();
        ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        ctx.shadowBlur = 24;
        ctx.shadowColor = 'magenta';
        ctx.globalAlpha = 0.92;
        if (img.loaded) {
            ctx.drawImage(img, -enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
        } else {
            ctx.fillStyle = 'red';
            ctx.fillRect(-enemy.width / 2, -enemy.height / 2, enemy.width, enemy.height);
        }
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;
        ctx.restore();

        // Draw health bar above enemy
        const barWidth = enemy.width;
        const barHeight = 6;
        const healthRatio = Math.max(0, Math.min(1, (enemy.health || 1) / (enemy.maxHealth || enemy.health || 1)));
        const barX = enemy.x;
        const barY = enemy.y - 10;
        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = '#222';
        ctx.fillRect(barX, barY, barWidth, barHeight);
        ctx.fillStyle = healthRatio > 0.5 ? '#0f0' : healthRatio > 0.2 ? '#ff0' : '#f00';
        ctx.fillRect(barX, barY, barWidth * healthRatio, barHeight);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
        ctx.globalAlpha = 1;
        ctx.restore();
    });
}

// Fire enemy lasers
export function fireEnemyLasers(enemyLasers, enemyFireCounter, enemyFireRate) {
    // If in aggressive mode, fire much faster
    let fireRate = enemyFireRate;
    if (window._enemyAggroState && window._enemyAggroState.mode === 'aggressive') {
        fireRate = Math.max(3, Math.floor(enemyFireRate / 4)); // 4x faster, minimum 3 frames
    }
    if (enemyFireCounter <= 0) {
        enemies.forEach(enemy => {
            // Spawn laser at the top of the enemy sprite
            enemyLasers.push({ x: enemy.x + enemy.width / 2, y: enemy.y });
        });
        enemyFireCounter = fireRate;
    }
    if (enemyFireCounter > 0) {
        enemyFireCounter--;
    }
    return enemyFireCounter;
}

// Star hue for background
if (window.starHue === undefined) window.starHue = 60; // default hue

// Call this when the level progresses
export function setStarHueForLevel(level) {
    // Change hue each level, e.g., cycle through 0-360
    window.starHue = (window.starHue + 60 + Math.floor(Math.random() * 120)) % 360;
}

// Example usage in your star drawing code:
// ctx.fillStyle = `hsl(${window.starHue}, 100%, 80%)`;
// ctx.fillRect(star.x, star.y, star.size, star.size);
