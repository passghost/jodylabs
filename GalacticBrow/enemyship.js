// Check collisions between player lasers and enemies
export function checkPlayerLaserHitsEnemies(lasers, enemies, shipWidth) {
    // Returns array of destroyed enemy positions
    let destroyed = [];
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
                    destroyed.push({ x: enemy.x + enemy.width/2, y: enemy.y + enemy.height/2 });
                    enemies.splice(enemyIndex, 1);
                    lasers.splice(laserIndex, 1);
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
        enemyLasers[i].y += laserSpeed;
        if (enemyLasers[i].y > canvas.height) {
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

export const enemies = [];

// Spawn a new wave of enemies
export function spawnEnemies(canvas, enemyShipImages) {
    enemies.length = 0;
    for (let i = 0; i < 5; i++) {
        const baseX = Math.random() * (canvas.width - 100) + 50;
        const baseY = Math.random() * (canvas.height / 2 - 100) + 50;
        const imgIndex = Math.floor(Math.random() * enemyShipImages.length);
        // Assign a type: small, medium, large
        const types = [
            { type: 'small', width: 32, height: 32, speed: 3.5, health: 4, amplitudeX: 90, amplitudeY: 50 },
            { type: 'medium', width: 50, height: 50, speed: 2.2, health: 10, amplitudeX: 70, amplitudeY: 40 },
            { type: 'large', width: 80, height: 80, speed: 1.2, health: 20, amplitudeX: 50, amplitudeY: 30 }
        ];
        // Randomly pick a type for each enemy
        const enemyType = types[Math.floor(Math.random() * types.length)];
        enemies.push({
            x: baseX,
            y: baseY,
            baseX: baseX,
            baseY: baseY,
            width: enemyType.width,
            height: enemyType.height,
            angle: Math.random() * Math.PI * 2,
            health: enemyType.health,
            imgIndex: imgIndex,
            amplitudeX: enemyType.amplitudeX + Math.random() * 20, // add some variety
            amplitudeY: enemyType.amplitudeY + Math.random() * 10,
            freqX: 0.008 + Math.random() * 0.012,
            freqY: 0.01 + Math.random() * 0.015,
            speed: enemyType.speed + Math.random() * 1.2,
            t: Math.random() * 1000,
            type: enemyType.type
        });
    }
    console.log('Enemies spawned:', enemies);
}

// Update enemy positions
export function updateEnemies(canvas) {
    enemies.forEach(enemy => {
        enemy.t += enemy.speed;
        // Different movement for each type
        if (enemy.type === 'small') {
            // Fast zigzag
            enemy.x = enemy.baseX + Math.sin(enemy.t * enemy.freqX * 1.5) * enemy.amplitudeX * 1.2;
            enemy.y = enemy.baseY + Math.cos(enemy.t * enemy.freqY * 1.2) * enemy.amplitudeY * 1.1 + Math.sin(enemy.t * 0.01) * 8;
        } else if (enemy.type === 'large') {
            // Slow, heavy, more vertical drift
            enemy.x = enemy.baseX + Math.sin(enemy.t * enemy.freqX * 0.7) * enemy.amplitudeX * 0.7;
            enemy.y = enemy.baseY + Math.cos(enemy.t * enemy.freqY * 0.7) * enemy.amplitudeY * 1.5 + Math.sin(enemy.t * 0.003) * 20;
        } else {
            // Medium: balanced
            enemy.x = enemy.baseX + Math.sin(enemy.t * enemy.freqX) * enemy.amplitudeX;
            enemy.y = enemy.baseY + Math.cos(enemy.t * enemy.freqY) * enemy.amplitudeY + Math.sin(enemy.t * 0.005) * 10;
        }
        enemy.baseY += 0.05 * enemy.speed;
        if (enemy.x < -enemy.width) enemy.x = canvas.width + enemy.width;
        if (enemy.x > canvas.width + enemy.width) enemy.x = -enemy.width;
        if (enemy.y > canvas.height) enemy.baseY = 0;
    });
}

// Draw all enemies
export function drawEnemies(ctx, enemyShipImages) {
    enemies.forEach(enemy => {
        const img = enemyShipImages[enemy.imgIndex];
        ctx.save();
        ctx.translate(enemy.x + enemy.width / 2, enemy.y + enemy.height / 2);
        ctx.rotate(Math.PI);
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
    if (enemyFireCounter <= 0) {
        enemies.forEach(enemy => {
            enemyLasers.push({ x: enemy.x + enemy.width / 2, y: enemy.y + enemy.height });
        });
        enemyFireCounter = enemyFireRate;
    }
    if (enemyFireCounter > 0) {
        enemyFireCounter--;
    }
    return enemyFireCounter;
}
