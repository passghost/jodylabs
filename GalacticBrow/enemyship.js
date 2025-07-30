// Check collisions between player lasers and enemies
import { getWeaponDamage } from './enemy_balance.js';
// laser objects must have .weaponType and .tier (add in firing code if not present)
export function checkPlayerLaserHitsEnemies(lasers, enemies, shipWidth, level = 1) {
    // Returns array of destroyed enemy data for powerup drops and scoring
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
                    
                    // Don't remove piercing lasers
                    if (!laser.piercing) {
                        lasers.splice(laserIndex, 1);
                    }
                    
                    if (enemy.health <= 0) {
                        destroyed.push({ 
                            x: enemy.x + enemy.width / 2, 
                            y: enemy.y + enemy.height / 2,
                            type: enemy.type
                        });
                        enemies.splice(enemyIndex, 1);
                    }
                    hit = true;
                    break;
                }
            }
            if (hit && !laser.piercing) break;
        }
        if (hit && !laser.piercing) continue;
    }
    return destroyed;
}
// Update enemy lasers with enhanced behavior
export function updateEnemyLasers(enemyLasers, canvasSize, laserSpeed) {
    for (let i = enemyLasers.length - 1; i >= 0; i--) {
        const laser = enemyLasers[i];
        
        // Handle different laser types - ALL tracking projectiles affected by chaff
        if (laser.homing || laser.type === 'homing_missile' || laser.type === 'seeker_drone') {
            // Initialize tracking properties if not set
            if (laser.launchTime === undefined) {
                laser.launchTime = Date.now();
                laser.chafeConfused = false;
                laser.confusionTimer = 0;
                laser.canHitEnemies = false;
            }
            
            // Check if 5 seconds have passed since launch
            const timeSinceLaunch = Date.now() - laser.launchTime;
            if (timeSinceLaunch > 5000) {
                laser.canHitEnemies = true;
            }
            
            // Check for chafe interference
            let chafeInterference = false;
            if (window.chafeParticles && window.chafeParticles.length > 0) {
                // Check if any chafe particles are nearby
                for (const particle of window.chafeParticles) {
                    const chafeDist = Math.sqrt((particle.x - laser.x) ** 2 + (particle.y - laser.y) ** 2);
                    if (chafeDist < 80) { // Chafe interference range
                        chafeInterference = true;
                        laser.chafeConfused = true;
                        laser.confusionTimer = 120; // 2 seconds of confusion
                        break;
                    }
                }
            }
            
            // Handle confusion timer
            if (laser.confusionTimer > 0) {
                laser.confusionTimer--;
                if (laser.confusionTimer <= 0) {
                    laser.chafeConfused = false;
                }
            }
            
            let targetX, targetY;
            
            if (laser.chafeConfused) {
                // When confused by chafe, target random chafe particles or drift
                if (window.chafeParticles && window.chafeParticles.length > 0) {
                    const randomChafe = window.chafeParticles[Math.floor(Math.random() * window.chafeParticles.length)];
                    targetX = randomChafe.x;
                    targetY = randomChafe.y;
                } else {
                    // No chafe left, drift randomly
                    targetX = laser.x + (Math.random() - 0.5) * 100;
                    targetY = laser.y + (Math.random() - 0.5) * 100;
                }
            } else {
                // Normal tracking - update target to current player position
                if (window.shipX !== undefined && window.shipY !== undefined) {
                    targetX = window.shipX + (window.shipWidth || 60) / 2;
                    targetY = window.shipY + (window.shipHeight || 60) / 2;
                } else if (laser.target) {
                    targetX = laser.target.x;
                    targetY = laser.target.y;
                } else {
                    // Initialize target if not set
                    targetX = window.shipX + (window.shipWidth || 60) / 2;
                    targetY = window.shipY + (window.shipHeight || 60) / 2;
                    laser.target = { x: targetX, y: targetY };
                }
            }
            
            // Homing behavior
            const dx = targetX - laser.x;
            const dy = targetY - laser.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const homingStrength = laser.type === 'seeker_drone' ? 0.4 : 0.3;
                laser.dx += (dx / dist) * homingStrength;
                laser.dy += (dy / dist) * homingStrength;
                
                // Limit speed
                const maxSpeed = laser.type === 'seeker_drone' ? 6 : 8;
                const speed = Math.sqrt(laser.dx * laser.dx + laser.dy * laser.dy);
                if (speed > maxSpeed) {
                    laser.dx = (laser.dx / speed) * maxSpeed;
                    laser.dy = (laser.dy / speed) * maxSpeed;
                }
            }
            
            // Check collision with source enemy (dragged back) - only if close and not confused
            if (laser.sourceEnemy && !laser.chafeConfused) {
                const enemy = laser.sourceEnemy;
                const enemyDist = Math.sqrt((enemy.x + enemy.width/2 - laser.x) ** 2 + (enemy.y + enemy.height/2 - laser.y) ** 2);
                if (enemyDist < 40) { // Close to source enemy
                    // Missile gets "dragged back" - home in on the enemy instead
                    const enemyCenterX = enemy.x + enemy.width / 2;
                    const enemyCenterY = enemy.y + enemy.height / 2;
                    const edx = enemyCenterX - laser.x;
                    const edy = enemyCenterY - laser.y;
                    const eDist = Math.sqrt(edx * edx + edy * edy);
                    if (eDist > 0) {
                        laser.dx += (edx / eDist) * 0.6; // Strong pull back to enemy
                        laser.dy += (edy / eDist) * 0.6;
                    }
                }
            }
            
            // Reduce fuel for seeker drones and plasma trackers
            if (laser.type === 'seeker_drone') {
                laser.fuel = (laser.fuel || 600) - 1;
                if (laser.fuel <= 0) {
                    // Out of fuel, remove missile
                    enemyLasers.splice(i, 1);
                    continue;
                }
            } else if (laser.type === 'plasma_tracker') {
                laser.fuel = (laser.fuel || 480) - 1;
                if (laser.fuel <= 0) {
                    // Out of fuel, remove plasma
                    enemyLasers.splice(i, 1);
                    continue;
                }
            }
        } else if (laser.type === 'zigzag') {
            // Initialize tracking properties if not set
            if (laser.launchTime === undefined) {
                laser.launchTime = Date.now();
                laser.chafeConfused = false;
                laser.confusionTimer = 0;
                laser.canHitEnemies = false;
            }
            
            // Check if 5 seconds have passed since launch
            const timeSinceLaunch = Date.now() - laser.launchTime;
            if (timeSinceLaunch > 5000) {
                laser.canHitEnemies = true;
            }
            
            // Check for chafe interference
            if (window.chafeParticles && window.chafeParticles.length > 0) {
                for (const particle of window.chafeParticles) {
                    const chafeDist = Math.sqrt((particle.x - laser.x) ** 2 + (particle.y - laser.y) ** 2);
                    if (chafeDist < 80) {
                        laser.chafeConfused = true;
                        laser.confusionTimer = 120;
                        break;
                    }
                }
            }
            
            // Handle confusion timer
            if (laser.confusionTimer > 0) {
                laser.confusionTimer--;
                if (laser.confusionTimer <= 0) {
                    laser.chafeConfused = false;
                }
            }
            
            // Zigzag pattern with tracking
            if (laser.chafeConfused) {
                // Confused zigzag - more erratic
                laser.dx += (Math.random() - 0.5) * 2.0;
                laser.dy += (Math.random() - 0.5) * 1.0;
            } else {
                // Normal zigzag with slight tracking
                laser.dx += (Math.random() - 0.5) * 0.8;
                if (laser.target && window.shipX !== undefined) {
                    const dx = window.shipX + (window.shipWidth || 60) / 2 - laser.x;
                    laser.dx += (dx > 0 ? 0.1 : -0.1); // Slight pull toward player
                }
            }
            laser.dx = Math.max(-6, Math.min(6, laser.dx)); // Limit zigzag
        } else if (laser.type === 'wave_beam') {
            // Wave beam - sine wave movement
            if (!laser.waveTime) laser.waveTime = 0;
            laser.waveTime += laser.waveFreq || 0.1;
            laser.dx = Math.sin(laser.waveTime + (laser.waveOffset || 0)) * (laser.waveAmplitude || 30) * 0.1;
        } else if (laser.type === 'spiral_shot') {
            // Spiral movement
            if (!laser.spiralTime) laser.spiralTime = 0;
            laser.spiralTime += laser.spiralSpeed || 0.15;
            laser.dx += Math.cos(laser.spiralTime) * (laser.spiralRadius || 2);
            laser.dy += Math.sin(laser.spiralTime) * (laser.spiralRadius || 1);
        } else if (laser.type === 'cluster_bomb') {
            // Cluster bomb - splits after timer
            if (!laser.hasSplit && laser.splitTimer > 0) {
                laser.splitTimer--;
                if (laser.splitTimer <= 0) {
                    laser.hasSplit = true;
                    // Create 6 smaller projectiles
                    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 3) {
                        enemyLasers.push({
                            x: laser.x,
                            y: laser.y,
                            dx: Math.cos(angle) * 4,
                            dy: Math.sin(angle) * 4 - 3,
                            width: 4,
                            height: 8,
                            color: '#ff6666',
                            damage: 3,
                            type: 'cluster_fragment'
                        });
                    }
                    // Remove original cluster bomb
                    enemyLasers.splice(i, 1);
                    continue;
                }
            }
        }
        
        // Update position
        laser.x += laser.dx || 0;
        laser.y += laser.dy || -laserSpeed;
        
        // Check collision with enemies (for tracking missiles after 5 seconds)
        if ((laser.homing || laser.type === 'homing_missile' || laser.type === 'seeker_drone') && laser.canHitEnemies) {
            for (let j = enemies.length - 1; j >= 0; j--) {
                const enemy = enemies[j];
                if (laser.x < enemy.x + enemy.width &&
                    laser.x + (laser.width || 10) > enemy.x &&
                    laser.y < enemy.y + enemy.height &&
                    laser.y + (laser.height || 10) > enemy.y) {
                    
                    // Missile hit an enemy - damage it
                    enemy.health -= laser.damage || 10;
                    
                    // Remove the missile
                    enemyLasers.splice(i, 1);
                    
                    // Remove enemy if health depleted
                    if (enemy.health <= 0) {
                        enemies.splice(j, 1);
                        // Could spawn powerup here if desired
                    }
                    break;
                }
            }
        }
        
        // Remove if off screen
        if (laser.y + (laser.height || 14) < 0 || 
            laser.y > canvasSize.height + 50 ||
            laser.x + (laser.width || 4) < 0 || 
            laser.x > canvasSize.width + 50) {
            enemyLasers.splice(i, 1);
        }
    }
}

// Draw enemy lasers with type-specific visuals
export function drawEnemyLasers(ctx, enemyLasers) {
    ctx.save();
    enemyLasers.forEach(laser => {
        ctx.shadowBlur = 12;
        ctx.shadowColor = laser.color || '#ff2a2a';
        ctx.fillStyle = laser.color || '#ff2a2a';
        
        if (laser.type === 'bomb') {
            // Draw bomb as circle
            ctx.beginPath();
            ctx.arc(laser.x + laser.width/2, laser.y + laser.height/2, laser.width/2, 0, Math.PI * 2);
            ctx.fill();
        } else if (laser.type === 'homing_missile') {
            // Draw missile with trail
            if (laser.chafeConfused) {
                // Confused missile - flickering red/yellow
                ctx.fillStyle = Math.random() > 0.5 ? '#ff4444' : '#ffff44';
                ctx.shadowColor = ctx.fillStyle;
            }
            ctx.fillRect(laser.x, laser.y, laser.width || 4, laser.height || 14);
            // Add trail effect
            ctx.globalAlpha = 0.5;
            ctx.fillRect(laser.x + 1, laser.y + (laser.height || 14), (laser.width || 4) - 2, 8);
            ctx.globalAlpha = 1;
        } else if (laser.type === 'seeker_drone') {
            // Draw seeker drone as diamond shape
            if (laser.chafeConfused) {
                ctx.fillStyle = Math.random() > 0.5 ? '#44ffff' : '#ffff44';
                ctx.shadowColor = ctx.fillStyle;
            }
            const centerX = laser.x + (laser.width || 12) / 2;
            const centerY = laser.y + (laser.height || 12) / 2;
            const size = (laser.width || 12) / 2;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - size);
            ctx.lineTo(centerX + size, centerY);
            ctx.lineTo(centerX, centerY + size);
            ctx.lineTo(centerX - size, centerY);
            ctx.closePath();
            ctx.fill();
            
            // Fuel indicator
            if (laser.fuel) {
                const fuelRatio = laser.fuel / 600;
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = fuelRatio > 0.5 ? '#00ff00' : fuelRatio > 0.2 ? '#ffff00' : '#ff0000';
                ctx.fillRect(laser.x - 2, laser.y - 4, (laser.width || 12) * fuelRatio, 2);
                ctx.globalAlpha = 1;
            }
        } else if (laser.type === 'plasma_tracker') {
            // Draw plasma tracker as pulsing circle
            if (laser.chafeConfused) {
                ctx.fillStyle = Math.random() > 0.5 ? '#ff44ff' : '#ffff44';
                ctx.shadowColor = ctx.fillStyle;
            }
            const centerX = laser.x + (laser.width || 8) / 2;
            const centerY = laser.y + (laser.height || 8) / 2;
            const radius = (laser.width || 8) / 2;
            const pulse = Math.sin(Date.now() * 0.01) * 0.3 + 1;
            
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Fuel indicator
            if (laser.fuel) {
                const fuelRatio = laser.fuel / 480;
                ctx.globalAlpha = 0.7;
                ctx.fillStyle = fuelRatio > 0.5 ? '#ff00ff' : fuelRatio > 0.2 ? '#ffff00' : '#ff0000';
                ctx.fillRect(laser.x - 2, laser.y - 4, (laser.width || 8) * fuelRatio, 2);
                ctx.globalAlpha = 1;
            }
        } else if (laser.type === 'bomb') {
            // Draw bomb as circle with chaff confusion
            if (laser.chafeConfused) {
                ctx.fillStyle = Math.random() > 0.5 ? '#ffff44' : '#ff8844';
                ctx.shadowColor = ctx.fillStyle;
            }
            ctx.beginPath();
            ctx.arc(laser.x + laser.width/2, laser.y + laser.height/2, laser.width/2, 0, Math.PI * 2);
            ctx.fill();
        } else if (laser.type === 'zigzag') {
            // Draw zigzag with chaff confusion
            if (laser.chafeConfused) {
                ctx.fillStyle = Math.random() > 0.5 ? '#ff44ff' : '#ffff44';
                ctx.shadowColor = ctx.fillStyle;
            }
            ctx.fillRect(laser.x, laser.y, laser.width || 4, laser.height || 16);
        } else if (laser.type === 'wave_beam') {
            // Draw wave beam with oscillating glow
            const glowIntensity = Math.sin(Date.now() * 0.02) * 0.3 + 0.7;
            ctx.shadowBlur = 8 * glowIntensity;
            ctx.fillRect(laser.x, laser.y, laser.width || 4, laser.height || 16);
        } else if (laser.type === 'spiral_shot') {
            // Draw spiral shot with rotating effect
            const centerX = laser.x + (laser.width || 3) / 2;
            const centerY = laser.y + (laser.height || 14) / 2;
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate((laser.spiralTime || 0) * 2);
            ctx.fillRect(-(laser.width || 3) / 2, -(laser.height || 14) / 2, laser.width || 3, laser.height || 14);
            ctx.restore();
        } else if (laser.type === 'prediction_laser') {
            // Draw prediction laser with warning effect
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffff00';
            ctx.fillRect(laser.x, laser.y, laser.width || 3, laser.height || 20);
        } else if (laser.type === 'cluster_bomb') {
            // Draw cluster bomb as pulsing square
            const pulse = Math.sin(Date.now() * 0.03) * 0.2 + 1;
            const size = (laser.width || 12) * pulse;
            ctx.fillRect(laser.x + (laser.width - size) / 2, laser.y + (laser.height - size) / 2, size, size);
        } else if (laser.type === 'cluster_fragment') {
            // Draw cluster fragments as small diamonds
            const centerX = laser.x + (laser.width || 4) / 2;
            const centerY = laser.y + (laser.height || 8) / 2;
            const size = (laser.width || 4) / 2;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - size);
            ctx.lineTo(centerX + size, centerY);
            ctx.lineTo(centerX, centerY + size);
            ctx.lineTo(centerX - size, centerY);
            ctx.closePath();
            ctx.fill();
        } else if (laser.type === 'rapid_burst') {
            // Draw rapid burst with trailing effect
            ctx.shadowBlur = 6;
            ctx.fillRect(laser.x, laser.y, laser.width || 2, laser.height || 12);
        } else {
            // Standard laser - show confusion if it's a tracking type
            if (laser.homing && laser.chafeConfused) {
                ctx.fillStyle = Math.random() > 0.5 ? '#ff4444' : '#ffff44';
                ctx.shadowColor = ctx.fillStyle;
            }
            ctx.fillRect(laser.x, laser.y, laser.width || 4, laser.height || 14);
        }
    });
    ctx.shadowBlur = 0;
    ctx.restore();
}

// Check collisions between enemy lasers and player
export function checkEnemyLaserHitsPlayer(enemyLasers, shipX, shipY, shipWidth, shipHeight, playerHealth) {
    for (let laserIndex = enemyLasers.length - 1; laserIndex >= 0; laserIndex--) {
        const laser = enemyLasers[laserIndex];
        const rect = { 
            x: laser.x, 
            y: laser.y, 
            w: laser.width || 4, 
            h: laser.height || 14 
        };
        
        if (
            rect.x < shipX + shipWidth &&
            rect.x + rect.w > shipX &&
            rect.y < shipY + shipHeight &&
            rect.y + rect.h > shipY
        ) {
            // Different damage based on laser type
            let damage = laser.damage || 5;
            if (laser.type === 'bomb') damage = 15;
            else if (laser.type === 'homing_missile') damage = 12;
            else if (laser.type === 'piercing_beam') damage = 8;
            
            playerHealth -= damage;
            
            // Don't remove piercing lasers
            if (!laser.piercing) {
                enemyLasers.splice(laserIndex, 1);
            }
        }
    }
    return playerHealth;
}
// enemyship.js
// Handles enemy ship logic for GalacticBrow

// Enemy AI uses strategic positioning instead of boids
// Enemies try to get behind the player for optimal shooting positions

export const enemies = [];

// Spawn a new wave of enemies
import { getEnemyHp } from './enemy_balance.js';
export function spawnEnemies(canvasSize, enemyShipImages, level = 1, count = 5) {
    enemies.length = 0;
    for (let i = 0; i < count; i++) {
        const imgIndex = Math.floor(Math.random() * enemyShipImages.length);
        
        // Assign a type: small, medium, large with level-based distribution
        const types = [
            { type: 'small', width: 45, height: 45 },
            { type: 'medium', width: 60, height: 60 },
            { type: 'large', width: 75, height: 75 }
        ];
        
        // Higher levels spawn more difficult enemies
        let typeIndex;
        const rand = Math.random();
        if (level <= 2) {
            typeIndex = rand < 0.7 ? 0 : (rand < 0.9 ? 1 : 2); // Mostly small
        } else if (level <= 5) {
            typeIndex = rand < 0.5 ? 0 : (rand < 0.8 ? 1 : 2); // Balanced
        } else {
            typeIndex = rand < 0.3 ? 0 : (rand < 0.6 ? 1 : 2); // Mostly medium/large
        }
        
        const enemyType = types[typeIndex];
        const maxHealth = getEnemyHp(enemyType.type, level);
        
        // Spawn from top or bottom of screen
        let spawnX, spawnY, initialVX, initialVY, entryType;
        
        if (Math.random() < 0.5) {
            // Spawn from bottom (speeding up to meet player)
            spawnX = Math.random() * (canvasSize.width - 100) + 50;
            spawnY = canvasSize.height + 50;
            initialVX = (Math.random() - 0.5) * 2; // Small horizontal drift
            initialVY = -3 - Math.random() * 2; // Moving up toward player
            entryType = 'bottom';
        } else {
            // Spawn from top (slowing down to meet player)
            spawnX = Math.random() * (canvasSize.width - 100) + 50;
            spawnY = -50;
            initialVX = (Math.random() - 0.5) * 2; // Small horizontal drift
            initialVY = 2 + Math.random() * 2; // Moving down toward player
            entryType = 'top';
        }
        
        enemies.push({
            x: spawnX,
            y: spawnY,
            width: enemyType.width,
            height: enemyType.height,
            health: maxHealth,
            maxHealth: maxHealth,
            imgIndex: imgIndex,
            type: enemyType.type,
            vx: initialVX,
            vy: initialVY,
            entryType: entryType,
            hasEnteredScreen: false
        });
    }
    console.log('Enemies spawned:', enemies);
}

// Spawn a boss enemy - absolute bullet hell nightmare
export function spawnBossEnemy(canvasSize, enemyShipImages, level = 1) {
    enemies.length = 0;
    
    const bossX = canvasSize.width / 2 - 125;
    const bossY = -200;
    const imgIndex = Math.floor(Math.random() * enemyShipImages.length);
    const maxHealth = getEnemyHp('large', level) * (20 + level * 5); // Much higher HP for boss fights
    
    enemies.push({
        x: bossX,
        y: bossY,
        baseX: bossX,
        baseY: bossY,
        width: 250, // Bigger boss
        height: 250,
        angle: 0,
        health: maxHealth,
        maxHealth: maxHealth,
        imgIndex: imgIndex,
        type: 'boss',
        isBoss: true,
        
        // Movement properties
        vx: 0,
        vy: 0,
        maxSpeed: 6 + level, // Gets faster each level
        acceleration: 0.3,
        friction: 0.94,
        
        // Firing properties
        fireRate: Math.max(3, 12 - level), // Gets much faster each level
        lastFired: 0,
        
        // Boss phases and patterns
        currentPhase: 'entry',
        phaseTimer: 0,
        patternTimer: 0,
        burstCounter: 0,
        
        // Movement patterns
        movementPattern: 'aggressive_circle',
        movementTimer: 0,
        
        // Level scaling
        level: level,
        weaponIntensity: 1 + level * 0.5
    });
    
    console.log(`Boss spawned at level ${level} with ${maxHealth} health`);
}

// Update enemy positions with dynamic movement
export function updateEnemies(canvasSize) {
    // Get player position for AI targeting
    let playerX = canvasSize.width / 2;
    let playerY = canvasSize.height / 2;
    let playerWidth = 60;
    let playerHeight = 60;
    
    if (window.shipX !== undefined) playerX = window.shipX;
    if (window.shipY !== undefined) playerY = window.shipY;
    if (window.shipWidth !== undefined) playerWidth = window.shipWidth;
    if (window.shipHeight !== undefined) playerHeight = window.shipHeight;
    
    const playerCenterX = playerX + playerWidth / 2;
    const playerCenterY = playerY + playerHeight / 2;

    enemies.forEach((enemy, idx) => {
        // Handle boss movement separately
        if (enemy.isBoss) {
            updateBossMovement(enemy, canvasSize, playerCenterX, playerCenterY);
            return;
        }
        
        // Initialize enemy physics properties - larger enemies are faster and more skilled
        if (!enemy.maxSpeed) {
            // Reverse speed logic: large enemies are ace pilots, small are rookies
            enemy.maxSpeed = enemy.type === 'small' ? 3 : enemy.type === 'medium' ? 5 : 8;
            enemy.acceleration = enemy.type === 'small' ? 0.15 : enemy.type === 'medium' ? 0.25 : 0.4;
            enemy.friction = enemy.type === 'small' ? 0.92 : enemy.type === 'medium' ? 0.94 : 0.96; // Better control for larger ships
            enemy.behaviorTimer = Math.random() * 180; // Random behavior change timer
            enemy.currentBehavior = 'entering';
            
            // Larger enemies change tactics more frequently (more skilled)
            enemy.behaviorChangeRate = enemy.type === 'small' ? 240 : enemy.type === 'medium' ? 180 : 120;
        }
        
        // Check if enemy has entered the screen
        if (!enemy.hasEnteredScreen) {
            if (enemy.entryType === 'bottom' && enemy.y < canvasSize.height - 100) {
                enemy.hasEnteredScreen = true;
                enemy.currentBehavior = 'positioning';
            } else if (enemy.entryType === 'top' && enemy.y > 100) {
                enemy.hasEnteredScreen = true;
                enemy.currentBehavior = 'positioning';
            }
        }
        
        // Update behavior timer - larger enemies adapt faster
        enemy.behaviorTimer--;
        if (enemy.behaviorTimer <= 0) {
            enemy.behaviorTimer = enemy.behaviorChangeRate + Math.random() * 60;
            if (enemy.hasEnteredScreen) {
                const behaviors = ['circling', 'stalking', 'flanking'];
                enemy.currentBehavior = behaviors[Math.floor(Math.random() * behaviors.length)];
            }
        }
        
        // Apply behavior-based movement
        let targetX = enemy.x;
        let targetY = enemy.y;
        
        switch (enemy.currentBehavior) {
            case 'entering':
                // Continue initial movement until on screen
                break;
                
            case 'positioning':
                // Move to a good position relative to player
                const angle = (idx / enemies.length) * Math.PI * 2;
                const radius = 150 + enemy.type === 'large' ? 50 : 0;
                targetX = playerCenterX + Math.cos(angle) * radius;
                targetY = playerCenterY + Math.sin(angle) * radius * 0.6; // Elliptical
                break;
                
            case 'circling':
                // Larger enemies circle more aggressively and closer
                const skillMultiplier = enemy.type === 'small' ? 0.6 : enemy.type === 'medium' ? 1.0 : 1.6;
                const circleAngle = Date.now() * 0.001 * skillMultiplier + idx;
                const circleRadius = enemy.type === 'small' ? 180 : enemy.type === 'medium' ? 140 : 100; // Closer for larger
                targetX = playerCenterX + Math.cos(circleAngle) * circleRadius;
                targetY = playerCenterY + Math.sin(circleAngle) * circleRadius * 0.7;
                break;
                
            case 'stalking':
                // Larger enemies stalk more aggressively and closer
                const stalkDistance = enemy.type === 'small' ? 120 : enemy.type === 'medium' ? 90 : 60;
                const stalkRandomness = enemy.type === 'small' ? 80 : enemy.type === 'medium' ? 60 : 40;
                targetX = playerCenterX + (Math.random() - 0.5) * stalkRandomness;
                targetY = playerCenterY + stalkDistance + Math.random() * 30;
                break;
                
            case 'flanking':
                // Larger enemies flank more aggressively
                const side = idx % 2 === 0 ? -1 : 1;
                const flankDistance = enemy.type === 'small' ? 120 : enemy.type === 'medium' ? 100 : 80;
                const flankRandomness = enemy.type === 'small' ? 60 : enemy.type === 'medium' ? 40 : 20;
                targetX = playerCenterX + side * (flankDistance + Math.random() * flankRandomness);
                targetY = playerCenterY + (Math.random() - 0.5) * flankRandomness;
                break;
        }
        
        // Keep targets within screen bounds
        targetX = Math.max(50, Math.min(canvasSize.width - 50, targetX));
        targetY = Math.max(50, Math.min(canvasSize.height - 50, targetY));
        
        // Calculate steering force
        const dx = targetX - enemy.x;
        const dy = targetY - enemy.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 20) {
            const steerX = (dx / distance) * enemy.acceleration;
            const steerY = (dy / distance) * enemy.acceleration;
            
            enemy.vx += steerX;
            enemy.vy += steerY;
        }
        
        // Add skill-based randomness to movement - larger enemies are more erratic and unpredictable
        const skillRandomness = enemy.type === 'small' ? 0.05 : enemy.type === 'medium' ? 0.15 : 0.25;
        enemy.vx += (Math.random() - 0.5) * skillRandomness;
        enemy.vy += (Math.random() - 0.5) * skillRandomness;
        
        // Avoid other enemies
        enemies.forEach((other, otherIdx) => {
            if (otherIdx !== idx && !other.isBoss) {
                const otherDx = other.x - enemy.x;
                const otherDy = other.y - enemy.y;
                const otherDistance = Math.sqrt(otherDx * otherDx + otherDy * otherDy);
                
                if (otherDistance < 60 && otherDistance > 0) {
                    enemy.vx -= (otherDx / otherDistance) * 0.2;
                    enemy.vy -= (otherDy / otherDistance) * 0.2;
                }
            }
        });
        
        // Limit velocity
        const currentSpeed = Math.sqrt(enemy.vx * enemy.vx + enemy.vy * enemy.vy);
        if (currentSpeed > enemy.maxSpeed) {
            enemy.vx = (enemy.vx / currentSpeed) * enemy.maxSpeed;
            enemy.vy = (enemy.vy / currentSpeed) * enemy.maxSpeed;
        }
        
        // Apply friction
        enemy.vx *= enemy.friction;
        enemy.vy *= enemy.friction;
        
        // Update position
        enemy.x += enemy.vx;
        enemy.y += enemy.vy;
        
        // Wrap around screen edges
        if (enemy.x < -enemy.width) enemy.x = canvasSize.width;
        if (enemy.x > canvasSize.width) enemy.x = -enemy.width;
        if (enemy.y < -enemy.height) enemy.y = canvasSize.height;
        if (enemy.y > canvasSize.height) enemy.y = -enemy.height;
    });
}

// Boss movement logic - aggressive bullet hell nightmare
function updateBossMovement(boss, canvasSize, playerX, playerY) {
    // Initialize boss physics if needed
    if (!boss.movementTimer) {
        boss.movementTimer = 0;
        boss.phaseTimer = 0;
        boss.patternTimer = 0;
    }
    
    boss.movementTimer++;
    boss.phaseTimer++;
    
    // Change movement pattern every 3-5 seconds
    if (boss.movementTimer > 180 + Math.random() * 120) {
        boss.movementTimer = 0;
        const patterns = ['aggressive_circle', 'dive_attack', 'strafe_run', 'teleport_dash', 'player_chase'];
        boss.movementPattern = patterns[Math.floor(Math.random() * patterns.length)];
    }
    
    let targetX = boss.x;
    let targetY = boss.y;
    
    switch (boss.movementPattern) {
        case 'aggressive_circle':
            // Fast aggressive circling around player
            const circleSpeed = 0.05 + boss.level * 0.01;
            const circleRadius = 150 - boss.level * 10; // Gets closer each level
            const angle = boss.movementTimer * circleSpeed;
            targetX = playerX + Math.cos(angle) * circleRadius;
            targetY = playerY + Math.sin(angle) * circleRadius * 0.6;
            break;
            
        case 'dive_attack':
            // Aggressive dive toward player
            targetX = playerX + (Math.random() - 0.5) * 100;
            targetY = playerY - 80;
            break;
            
        case 'strafe_run':
            // High-speed strafing runs
            const strafeSpeed = boss.movementTimer * 0.1;
            targetX = canvasSize.width * 0.2 + Math.sin(strafeSpeed) * canvasSize.width * 0.6;
            targetY = canvasSize.height * 0.2 + Math.cos(strafeSpeed * 0.7) * 100;
            break;
            
        case 'teleport_dash':
            // Rapid position changes
            if (boss.movementTimer % 60 === 0) {
                targetX = Math.random() * (canvasSize.width - boss.width);
                targetY = Math.random() * (canvasSize.height * 0.4);
            }
            break;
            
        case 'player_chase':
            // Direct aggressive pursuit
            targetX = playerX;
            targetY = playerY - 120;
            break;
    }
    
    // Keep boss on screen
    targetX = Math.max(50, Math.min(canvasSize.width - boss.width - 50, targetX));
    targetY = Math.max(20, Math.min(canvasSize.height * 0.5, targetY));
    
    // Apply movement with boss physics
    const dx = targetX - boss.x;
    const dy = targetY - boss.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 20) {
        const steerX = (dx / distance) * boss.acceleration;
        const steerY = (dy / distance) * boss.acceleration;
        
        boss.vx += steerX;
        boss.vy += steerY;
    }
    
    // Add erratic movement for unpredictability
    boss.vx += (Math.random() - 0.5) * 0.5;
    boss.vy += (Math.random() - 0.5) * 0.3;
    
    // Limit velocity
    const currentSpeed = Math.sqrt(boss.vx * boss.vx + boss.vy * boss.vy);
    if (currentSpeed > boss.maxSpeed) {
        boss.vx = (boss.vx / currentSpeed) * boss.maxSpeed;
        boss.vy = (boss.vy / currentSpeed) * boss.maxSpeed;
    }
    
    // Apply friction and update position
    boss.vx *= boss.friction;
    boss.vy *= boss.friction;
    boss.x += boss.vx;
    boss.y += boss.vy;
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

// Enemy firing is now handled in the main game loop with individual weapon types

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
