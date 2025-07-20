// Joust Clone - Basic Game Loop and Structure
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game constants
const GRAVITY = 0.4;
const FLAP_STRENGTH = -8;
const PLAYER_SPEED = 7;
const ENEMY_SPEED = 4;
const PLATFORM_HEIGHT = 20;
const PLATFORM_COLOR = '#2a0a0a';
const PLAYER_COLOR = '#ff2222';
const ENEMY_COLOR = '#ff2222';
const PLATFORM_GRADIENT_START = '#440000';
const PLATFORM_GRADIENT_END = '#1a0000';
const PLATFORM_SHADOW = 'rgba(255,0,0,0.18)';

// Sparkle animation state
let sparkleFrame = 0;

// Running animation state
let runFrame = 0;

// Platforms
let platforms = [];
function randomizePlatforms() {
    platforms = [];
    // Always add main floor
    platforms.push({ x: 60, y: 540, w: 680, h: PLATFORM_HEIGHT });
    // Add 6-9 random platforms
    let platCount = 6 + Math.floor(Math.random() * 4);
    for (let i = 0; i < platCount; i++) {
        let w = 60 + Math.random() * 140;
        let x = 20 + Math.random() * (800 - w - 40);
        let y = 120 + Math.random() * 400;
        platforms.push({ x, y, w, h: PLATFORM_HEIGHT });
    }
    // Optionally add a top ledge
    if (Math.random() < 0.7) {
        platforms.push({ x: 320, y: 100, w: 60, h: PLATFORM_HEIGHT });
    }
}
randomizePlatforms();

// Player
const player = {
    x: 400,
    y: 100,
    w: 40,
    h: 40,
    vx: 0,
    vy: 0,
    onGround: false,
    score: 0,
    flapCooldown: 0,
    flapAnim: 0,
    jumps: 4,
    maxJumps: 4,
    facingRight: true,
    lives: 2
};

// Enemy
// (removed old single enemy, now using enemies array)
// Enemies
let level = 1;
let ENEMY_COUNT = 3;
let enemies = [];
function createEnemy() {
    return {
        x: Math.random() * (canvas.width - 40),
        y: 100,
        w: 40,
        h: 40,
        vx: 0,
        vy: 0,
        onGround: false,
        jumps: 4,
        maxJumps: 4,
        flapCooldown: 0,
        flapAnim: 0,
        facingRight: true,
        aiTimer: 0,
        targetX: Math.random() * 800
    };
}
function spawnEnemies() {
    enemies = [];
    for (let i = 0; i < ENEMY_COUNT; i++) {
        enemies.push(createEnemy());
    }
}
spawnEnemies();

// Input
const keys = {};
document.addEventListener('keydown', e => keys[e.code] = true);
document.addEventListener('keyup', e => keys[e.code] = false);

function rectsCollide(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updatePlayer() {
    // Horizontal movement with longer momentum
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.vx -= 0.09;
        player.facingRight = false;
    } else if (keys['ArrowRight'] || keys['KeyD']) {
        player.vx += 0.09;
        player.facingRight = true;
    } else {
        // Slower friction for longer momentum
        player.vx *= 0.97;
        if (Math.abs(player.vx) < 0.05) player.vx = 0;
    }
    // Clamp max speed
    if (player.vx > PLAYER_SPEED) player.vx = PLAYER_SPEED;
    if (player.vx < -PLAYER_SPEED) player.vx = -PLAYER_SPEED;

    // Flap mechanism: up to 3 jumps before landing
    if (player.flapCooldown > 0) player.flapCooldown--;
    if ((keys['Space'] || keys['ArrowUp'] || keys['KeyW'])) {
        if (player.flapCooldown === 0 && player.jumps > 0) {
            player.vy = FLAP_STRENGTH;
            player.flapCooldown = 10; // limit flaps per second
            player.flapAnim = 6; // frames of wing animation
            player.jumps--;
        }
    }

    // Apply gravity (stronger if not flapping)
    player.vy += GRAVITY * (player.flapAnim > 0 ? 0.7 : 1.2);
    player.x += player.vx;
    player.y += player.vy;

    // Platform collision
    player.onGround = false;
    for (const plat of platforms) {
        if (rectsCollide(player, plat) && player.vy >= 0 && player.y + player.h - player.vy <= plat.y) {
            player.y = plat.y - player.h;
            player.vy = 0;
            player.onGround = true;
            player.jumps = player.maxJumps;
        }
    }

    // Wrap around horizontally
    if (player.x + player.w < 0) player.x = canvas.width;
    if (player.x > canvas.width) player.x = -player.w;

    // Keep in vertical bounds
    if (player.y + player.h > canvas.height) {
        player.y = canvas.height - player.h;
        player.vy = 0;
        player.onGround = true;
        player.jumps = player.maxJumps;
    }

    // Animate wing flap
    if (player.flapAnim > 0) player.flapAnim--;
}


// Black particle trail state for enemies
let enemyParticles = [];
function updateEnemy(enemy) {
    // AI: running starts and gradual direction changes
    if (enemy.aiTimer <= 0) {
        // Occasionally retarget toward player, otherwise random
        if (Math.random() < 0.5) {
            enemy.targetX = player.x + (Math.random() - 0.5) * 120; // near player
        } else {
            enemy.targetX = Math.random() * (canvas.width - enemy.w);
        }
        enemy.aiTimer = 60 + Math.random() * 90; // 1-2.5 seconds
    } else {
        enemy.aiTimer--;
    }

    // Move toward targetX, but not too sharply
    if (enemy.targetX < enemy.x - 5) {
        enemy.vx -= 0.09;
        enemy.facingRight = false;
    } else if (enemy.targetX > enemy.x + 5) {
        enemy.vx += 0.09;
        enemy.facingRight = true;
    } else {
        enemy.vx *= 0.97;
        if (Math.abs(enemy.vx) < 0.05) enemy.vx = 0;
    }
    // Clamp max speed
    if (enemy.vx > ENEMY_SPEED) enemy.vx = ENEMY_SPEED;
    if (enemy.vx < -ENEMY_SPEED) enemy.vx = -ENEMY_SPEED;

    // Triple jump/flap logic: up to 3 jumps before landing
    if (enemy.flapCooldown > 0) enemy.flapCooldown--;
    // Flap if below player or randomly
    if ((enemy.flapCooldown === 0 && enemy.jumps > 0) && (enemy.y < player.y - 10 || Math.random() < 0.02)) {
        enemy.vy = FLAP_STRENGTH;
        enemy.flapCooldown = 10;
        enemy.flapAnim = 6;
        enemy.jumps--;
    }

    // Apply gravity (stronger if not flapping)
    enemy.vy += GRAVITY * (enemy.flapAnim > 0 ? 0.7 : 1.2);
    enemy.x += enemy.vx;
    enemy.y += enemy.vy;

    // Platform collision
    enemy.onGround = false;
    for (const plat of platforms) {
        if (rectsCollide(enemy, plat) && enemy.vy >= 0 && enemy.y + enemy.h - enemy.vy <= plat.y) {
            enemy.y = plat.y - enemy.h;
            enemy.vy = 0;
            enemy.onGround = true;
            enemy.jumps = enemy.maxJumps;
        }
    }

    // Wrap around horizontally
    if (enemy.x + enemy.w < 0) enemy.x = canvas.width;
    if (enemy.x > canvas.width) enemy.x = -enemy.w;

    // Keep in vertical bounds
    if (enemy.y + enemy.h > canvas.height) {
        enemy.y = canvas.height - enemy.h;
        enemy.vy = 0;
        enemy.onGround = true;
        enemy.jumps = enemy.maxJumps;
    }

    // Animate wing flap
    if (enemy.flapAnim > 0) enemy.flapAnim--;
    // Emit black glowing particles as the enemy moves (reduced rate)
    if ((Math.abs(enemy.vx) > 0.2 || Math.abs(enemy.vy) > 0.2) && Math.random() < 0.25) {
        enemyParticles.push({
            x: enemy.x + enemy.w/2 + (Math.random()-0.5)*8,
            y: enemy.y + enemy.h/2 + (Math.random()-0.5)*8,
            r: 6 + Math.random()*4,
            alpha: 0.5 + Math.random()*0.2,
            life: 0
        });
    }
}

// Impact effect state
let impacts = [];
function checkPlayerEnemyCollision() {
    const JOUST_BUFFER = 8; // pixels, for forgiving ties
    for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (rectsCollide(player, enemy)) {
            // Use the top of the hitbox (lance tip) for joust logic
            const playerTip = player.y;
            const enemyTip = enemy.y;
            let impactX = (player.x + player.w/2 + enemy.x + enemy.w/2) / 2;
            let impactY = (player.y + player.h/2 + enemy.y + enemy.h/2) / 2;
            impacts.push({x: impactX, y: impactY, frame: 0});
            if (Math.abs(playerTip - enemyTip) < JOUST_BUFFER) {
                // Tie: both bounce
                player.vy = FLAP_STRENGTH / 2;
                enemy.vy = FLAP_STRENGTH / 2;
            } else if (playerTip < enemyTip) {
                // Player is above enemy: player wins
                player.score++;
                enemies.splice(i, 1);
                player.vy = FLAP_STRENGTH;
            } else {
                // Enemy is above player: player loses
                player.lives--;
                if (player.lives < 0) {
                    // Game over: reset everything
                    player.lives = 2;
                    player.score = 0;
                    level = 1;
                    ENEMY_COUNT = 3;
                    randomizePlatforms();
                    spawnEnemies();
                } else {
                    // Restart current level
                    player.score = 0;
                    randomizePlatforms();
                    spawnEnemies();
                }
                resetPlayer();
                enemy.vy = FLAP_STRENGTH;
            }
        }
    }
}

function resetPlayer() {
    player.x = 400;
    player.y = 100;
    player.vx = 0;
    player.vy = 0;
}

function resetEnemy() {
    // No longer needed: enemies respawn individually
}

function drawOstrichRider(x, y, w, h, color, flapAnim = 0, facingRight = true) {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    ctx.rotate(facingRight ? 0.18 : -0.18);
    ctx.scale(facingRight ? w/40 : -w/40, h/40);
    // Faint glowing white halo
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 32;
    ctx.globalAlpha = 0.22;
    ctx.beginPath();
    ctx.arc(0, 8, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Body: white/gray gradient
    let ostrichGrad = ctx.createLinearGradient(-12, 8, 12, 24);
    ostrichGrad.addColorStop(0, '#fff');
    ostrichGrad.addColorStop(0.3, '#e0e0e0');
    ostrichGrad.addColorStop(0.7, '#bbb');
    ostrichGrad.addColorStop(1, '#888');
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 18;
    ctx.fillStyle = ostrichGrad;
    ctx.beginPath();
    ctx.ellipse(0, 8, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    // Rim light
    ctx.save();
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.8;
    ctx.beginPath();
    ctx.ellipse(0, 8, 12, 8, 0, -0.7, 0.7);
    ctx.stroke();
    ctx.restore();
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
    // Tail
    ctx.save();
    ctx.rotate(-Math.PI/6);
    ctx.globalAlpha = 0.8;
    let tailGrad = ctx.createLinearGradient(-20, 14, -8, 14);
    tailGrad.addColorStop(0, '#fff');
    tailGrad.addColorStop(1, '#e0e0e0');
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.ellipse(-14, 14, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Neck
    let neckGrad = ctx.createLinearGradient(0, 8, 0, -8);
    neckGrad.addColorStop(0, '#fff');
    neckGrad.addColorStop(1, '#e0e0e0');
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = neckGrad;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Head
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 14;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Eye glint
    ctx.beginPath();
    ctx.arc(1.5, -13.5, 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#e0e0e0';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    // Beak
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(6, -14);
    ctx.lineTo(0, -10);
    ctx.closePath();
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = '#e0e0e0';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
    // Legs
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.5;
    let legSwing = 0;
    if (x === player.x && y === player.y) {
        legSwing = Math.abs(player.vx) > 0.2 ? Math.sin(runFrame * 0.25 * Math.abs(player.vx)) * 5 : 0;
    } else {
        let found = false;
        for (const enemy of enemies) {
            if (Math.abs(enemy.x - x) < 1 && Math.abs(enemy.y - y) < 1) {
                legSwing = Math.abs(enemy.vx) > 0.2 ? Math.sin(runFrame * 0.25 * Math.abs(enemy.vx)) * 5 : 0;
                found = true;
                break;
            }
        }
        if (!found) legSwing = 0;
    }
    ctx.beginPath();
    ctx.moveTo(-6, 16);
    ctx.lineTo(-6 + legSwing, 24);
    ctx.moveTo(6, 16);
    ctx.lineTo(6 - legSwing, 24);
    ctx.stroke();
    // Wings
    ctx.save();
    let mainWingAngle = (flapAnim > 0 ? -Math.PI/2.2 : -Math.PI/8) + Math.sin((flapAnim > 0 ? flapAnim : runFrame * 0.18)) * 0.18;
    ctx.strokeStyle = ctx.createLinearGradient(0, 8, 18 * Math.cos(mainWingAngle), 8 + 18 * Math.sin(mainWingAngle));
    ctx.strokeStyle.addColorStop(0, '#fff');
    ctx.strokeStyle.addColorStop(1, '#e0e0e0');
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(18 * Math.cos(mainWingAngle), 8 + 18 * Math.sin(mainWingAngle));
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.stroke();
    ctx.shadowBlur = 0;
    // Tiny secondary wing
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    let tinyWingAngle = mainWingAngle - 0.7;
    ctx.moveTo(0, 8);
    ctx.lineTo(10 * Math.cos(tinyWingAngle), 8 + 10 * Math.sin(tinyWingAngle));
    ctx.stroke();
    // Feather tips
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        let angle = mainWingAngle + (i - 1) * 0.18;
        ctx.beginPath();
        ctx.moveTo(10 * Math.cos(angle), 8 + 10 * Math.sin(angle));
        ctx.lineTo(18 * Math.cos(angle), 8 + 18 * Math.sin(angle));
        ctx.stroke();
        // Sparkle at feather tip
        ctx.save();
        ctx.globalAlpha = 0.7 + 0.3 * Math.sin(sparkleFrame * 0.3 + i);
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(18 * Math.cos(angle), 8 + 18 * Math.sin(angle), 1.2 + Math.sin(sparkleFrame * 0.2 + i), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
    // Jousting stick
    ctx.save();
    if (!facingRight) {
        ctx.scale(-1, 1);
        ctx.rotate(0.18);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-2, 8);
        ctx.lineTo(-38, 8);
        ctx.stroke();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-2, 7);
        ctx.lineTo(-38, 7);
        ctx.stroke();
        ctx.save();
        ctx.translate(-38, 8);
        ctx.rotate(Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -3);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#e0e0e0';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    } else {
        ctx.rotate(-0.18);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(2, 8);
        ctx.lineTo(38, 8);
        ctx.stroke();
        ctx.strokeStyle = '#e0e0e0';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(2, 7);
        ctx.lineTo(38, 7);
        ctx.stroke();
        ctx.save();
        ctx.translate(38, 8);
        ctx.rotate(0);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -3);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#e0e0e0';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
    // Rider
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -12, 5, Math.PI, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#e0e0e0';
    ctx.stroke();
    // Face
    ctx.beginPath();
    ctx.arc(0, -10, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.ellipse(0, -5, 3, 1.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#e0e0e0';
    ctx.stroke();
    ctx.restore();
    ctx.restore();
}

function drawBuzzardRider(x, y, w, h, color, flapAnim = 0, facingRight = true) {
    ctx.save();
    ctx.translate(x + w/2, y + h/2);
    ctx.rotate(facingRight ? 0.18 : -0.18);
    ctx.scale(facingRight ? w/40 : -w/40, h/40);
    let buzzGrad = ctx.createLinearGradient(-12, 8, 12, 24);
    buzzGrad.addColorStop(0, '#ff2222');
    buzzGrad.addColorStop(0.3, '#440000');
    buzzGrad.addColorStop(0.7, '#000');
    buzzGrad.addColorStop(1, '#220000');
    ctx.save();
    ctx.shadowColor = '#ff2222';
    ctx.shadowBlur = 10;
    ctx.fillStyle = buzzGrad;
    ctx.beginPath();
    ctx.ellipse(0, 8, 12, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 2.2;
    ctx.strokeStyle = '#fff';
    ctx.stroke();
    ctx.restore();
    // Tail
    ctx.save();
    ctx.rotate(-Math.PI/6);
    ctx.globalAlpha = 0.8;
    let tailGrad = ctx.createLinearGradient(-20, 14, -8, 14);
    tailGrad.addColorStop(0, '#ff2222');
    tailGrad.addColorStop(1, '#fff');
    ctx.fillStyle = tailGrad;
    ctx.beginPath();
    ctx.ellipse(-14, 14, 6, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
    // Neck
    let neckGrad = ctx.createLinearGradient(0, 8, 0, -8);
    neckGrad.addColorStop(0, '#fff');
    neckGrad.addColorStop(1, '#ff2222');
    ctx.save();
    ctx.shadowColor = '#ff2222';
    ctx.shadowBlur = 6;
    ctx.strokeStyle = neckGrad;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(0, -8);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
    // Head
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, -12, 4, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.shadowColor = '#ff2222';
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
    // Beak
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(6, -14);
    ctx.lineTo(0, -10);
    ctx.closePath();
    ctx.fillStyle = '#ff2222';
    ctx.globalAlpha = 0.9;
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 1;
    ctx.restore();
    // Legs
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 2.5;
    let legSwing = 0;
    let found = false;
    for (const enemy of enemies) {
        if (Math.abs(enemy.x - x) < 1 && Math.abs(enemy.y - y) < 1) {
            legSwing = Math.abs(enemy.vx) > 0.2 ? Math.sin(runFrame * 0.25 * Math.abs(enemy.vx)) * 5 : 0;
            found = true;
            break;
        }
    }
    if (!found) legSwing = 0;
    ctx.beginPath();
    ctx.moveTo(-6, 16);
    ctx.lineTo(-6 + legSwing, 24);
    ctx.moveTo(6, 16);
    ctx.lineTo(6 - legSwing, 24);
    ctx.stroke();
    // Wings
    ctx.save();
    let mainWingAngle = (flapAnim > 0 ? -Math.PI/2.2 : -Math.PI/8) + Math.sin((flapAnim > 0 ? flapAnim : runFrame * 0.18)) * 0.18;
    ctx.strokeStyle = ctx.createLinearGradient(0, 8, 18 * Math.cos(mainWingAngle), 8 + 18 * Math.sin(mainWingAngle));
    ctx.strokeStyle.addColorStop(0, '#fff');
    ctx.strokeStyle.addColorStop(1, '#ff2222');
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 8);
    ctx.lineTo(18 * Math.cos(mainWingAngle), 8 + 18 * Math.sin(mainWingAngle));
    ctx.stroke();
    // Tiny secondary wing
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    let tinyWingAngle = mainWingAngle - 0.7;
    ctx.moveTo(0, 8);
    ctx.lineTo(10 * Math.cos(tinyWingAngle), 8 + 10 * Math.sin(tinyWingAngle));
    ctx.stroke();
    // Feather tips
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i++) {
        let angle = mainWingAngle + (i - 1) * 0.18;
        ctx.beginPath();
        ctx.moveTo(10 * Math.cos(angle), 8 + 10 * Math.sin(angle));
        ctx.lineTo(18 * Math.cos(angle), 8 + 18 * Math.sin(angle));
        ctx.stroke();
    }
    ctx.restore();
    // Jousting stick
    ctx.save();
    if (!facingRight) {
        ctx.scale(-1, 1);
        ctx.rotate(0.18);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(-2, 8);
        ctx.lineTo(-38, 8);
        ctx.stroke();
        ctx.strokeStyle = '#ff2222';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(-2, 7);
        ctx.lineTo(-38, 7);
        ctx.stroke();
        ctx.save();
        ctx.translate(-38, 8);
        ctx.rotate(Math.PI);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -3);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fillStyle = '#ff2222';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    } else {
        ctx.rotate(-0.18);
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 3.2;
        ctx.beginPath();
        ctx.moveTo(2, 8);
        ctx.lineTo(38, 8);
        ctx.stroke();
        ctx.strokeStyle = '#ff2222';
        ctx.lineWidth = 1.1;
        ctx.beginPath();
        ctx.moveTo(2, 7);
        ctx.lineTo(38, 7);
        ctx.stroke();
        ctx.save();
        ctx.translate(38, 8);
        ctx.rotate(0);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(8, -3);
        ctx.lineTo(2, 3);
        ctx.closePath();
        ctx.fillStyle = '#ff2222';
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.restore();
    }
    ctx.restore();
    // Rider
    ctx.save();
    ctx.shadowColor = '#fff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(0, -12, 5, Math.PI, 2 * Math.PI);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = '#e0e0e0';
    ctx.stroke();
    // Face
    ctx.beginPath();
    ctx.arc(0, -10, 3, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    // Body
    ctx.beginPath();
    ctx.ellipse(0, -5, 3, 1.7, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.globalAlpha = 0.8;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = '#e0e0e0';
    ctx.stroke();
    ctx.restore();
    ctx.restore();
}

function draw() {
    // Animated background gradient (black/red)
    let bgGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
    bgGrad.addColorStop(0, '#000');
    bgGrad.addColorStop(0.2, '#220000');
    bgGrad.addColorStop(0.5, '#440000');
    bgGrad.addColorStop(0.8, '#220000');
    bgGrad.addColorStop(1, '#000');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Animated red/white stars
    for (let i = 0; i < 40; i++) {
        let sx = (Math.sin(i * 13.1 + sparkleFrame * 0.01 + i) * 0.5 + 0.5) * canvas.width;
        let sy = (Math.cos(i * 7.7 + sparkleFrame * 0.013 - i) * 0.5 + 0.5) * canvas.height * 0.7;
        let starAlpha = 0.5 + 0.5 * Math.sin(sparkleFrame * 0.08 + i * 2);
        ctx.save();
        ctx.globalAlpha = 0.18 * starAlpha;
        ctx.fillStyle = i % 2 === 0 ? '#fff' : '#ff2222';
        ctx.beginPath();
        ctx.arc(sx, sy, 1.2 + Math.sin(sparkleFrame * 0.2 + i), 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    // Draw platforms (black/red)
    for (const plat of platforms) {
        ctx.save();
        ctx.shadowColor = PLATFORM_SHADOW;
        ctx.shadowBlur = 18;
        let grad = ctx.createLinearGradient(plat.x, plat.y, plat.x, plat.y + plat.h);
        grad.addColorStop(0, '#ff2222');
        grad.addColorStop(0.2, PLATFORM_GRADIENT_START);
        grad.addColorStop(0.8, PLATFORM_GRADIENT_END);
        grad.addColorStop(1, '#000');
        ctx.fillStyle = grad;
        ctx.fillRect(plat.x, plat.y, plat.w, plat.h);
        // Top highlight
        ctx.globalAlpha = 0.22;
        ctx.fillStyle = '#fff';
        ctx.fillRect(plat.x, plat.y, plat.w, 5);
        // Bottom shadow
        ctx.globalAlpha = 0.13;
        ctx.fillStyle = '#000';
        ctx.fillRect(plat.x, plat.y + plat.h - 4, plat.w, 4);
        ctx.globalAlpha = 1;
        ctx.restore();
    }

    // Sparkles on platforms (white/red)
    sparkleFrame++;
    runFrame++;
    for (const plat of platforms) {
        for (let i = 0; i < Math.floor(plat.w / 60); i++) {
            let sx = plat.x + 20 + i * 60 + ((sparkleFrame * (i+1)) % 40);
            let sy = plat.y + 6 + Math.sin((sparkleFrame + i*13) * 0.1) * 2;
            ctx.save();
            ctx.globalAlpha = 0.5 + 0.5 * Math.sin((sparkleFrame + i*7) * 0.2);
            ctx.fillStyle = i % 2 === 0 ? '#fff' : '#ff2222';
            ctx.beginPath();
            ctx.arc(sx, sy, 2 + Math.sin((sparkleFrame + i*5) * 0.2), 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    // Draw player (ostrich rider)
    ctx.save();
    ctx.shadowColor = '#ff2222';
    ctx.shadowBlur = 32;
    drawOstrichRider(player.x, player.y, player.w, player.h, PLAYER_COLOR, player.flapAnim, player.facingRight);
    // Player sparkle
    ctx.globalAlpha = 0.7 + 0.3 * Math.sin(sparkleFrame * 0.2);
    ctx.beginPath();
    ctx.arc(player.x + player.w/2, player.y + player.h/2 - 18, 7 + 2 * Math.sin(sparkleFrame * 0.2), 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();

    // Draw all enemies (buzzard riders)
    for (const enemy of enemies) {
        ctx.save();
        ctx.shadowColor = '#ff2222';
        ctx.shadowBlur = 32;
        drawBuzzardRider(enemy.x, enemy.y, enemy.w, enemy.h, ENEMY_COLOR, enemy.flapAnim, enemy.facingRight);
        // Enemy sparkle
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin((sparkleFrame + enemy.x) * 0.18);
        ctx.beginPath();
        ctx.arc(enemy.x + enemy.w/2, enemy.y + enemy.h/2 - 18, 6 + 2 * Math.sin((sparkleFrame + enemy.x) * 0.18), 0, Math.PI * 2);
        ctx.fillStyle = '#fff';
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.restore();
    }
    // Draw black glowing particles trailing from enemies
    for (let i = enemyParticles.length - 1; i >= 0; i--) {
        let p = enemyParticles[i];
        ctx.save();
        ctx.globalAlpha = p.alpha * (1 - p.life / 32);
        ctx.shadowColor = '#000';
        ctx.shadowBlur = 16;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - p.life / 32), 0, Math.PI * 2);
        ctx.fillStyle = '#000';
        ctx.fill();
        ctx.restore();
        p.life++;
        if (p.life > 32) enemyParticles.splice(i, 1);
    }

    // Draw impact effects
    for (let i = impacts.length - 1; i >= 0; i--) {
        let imp = impacts[i];
        let t = imp.frame / 16;
        ctx.save();
        ctx.globalAlpha = 1 - t;
        for (let j = 0; j < 8; j++) {
            let angle = (Math.PI * 2 / 8) * j + t * Math.PI * 2 * 0.2;
            let r = 12 + t * 24;
            ctx.beginPath();
            ctx.arc(imp.x + Math.cos(angle) * r, imp.y + Math.sin(angle) * r, 3 + 2 * (1 - t), 0, Math.PI * 2);
            ctx.fillStyle = j % 2 === 0 ? '#fff' : '#ff2222';
            ctx.shadowColor = '#ff2222';
            ctx.shadowBlur = 8;
            ctx.fill();
        }
        ctx.restore();
        imp.frame++;
        if (imp.frame > 16) impacts.splice(i, 1);
    }

    // Update score, level, and lives in DOM UI (outside canvas)
    const scoreUi = document.getElementById('score-ui');
    if (scoreUi) {
        scoreUi.textContent = 'LEVEL: ' + (typeof level !== 'undefined' ? level : 1) + '   SCORE: ' + player.score + '   LIVES: ' + player.lives;
    }
}

function gameLoop() {
    updatePlayer();
    for (const enemy of enemies) {
        updateEnemy(enemy);
    }
    checkPlayerEnemyCollision();
    // Level up if all enemies are cleared
    if (typeof level !== 'undefined' && enemies.length === 0) {
        level++;
        ENEMY_COUNT = 3 + Math.floor(level / 2);
        randomizePlatforms();
        if (typeof spawnEnemies === 'function') {
            spawnEnemies();
        }
        resetPlayer();
    }
    draw();
    requestAnimationFrame(gameLoop);
}

resetPlayer();
gameLoop();
