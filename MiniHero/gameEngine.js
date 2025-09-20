// Camera System for following player
class Camera {
    constructor() {
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.smoothing = 0.1;
        this.shake = { x: 0, y: 0, intensity: 0, duration: 0 };
        this.zoom = 1.0;
        this.targetZoom = 1.0;
        this.minZoom = 0.3;
        this.maxZoom = 3.0;
        this.zoomSmoothing = 0.15;
    }

    followTarget(targetX, targetY) {
        this.targetX = targetX - (window.innerWidth / 2) / this.zoom;
        this.targetY = targetY - (window.innerHeight / 2) / this.zoom;
        
        // Smooth camera movement
        this.x += (this.targetX - this.x) * this.smoothing;
        this.y += (this.targetY - this.y) * this.smoothing;
        
        // Smooth zoom
        this.zoom += (this.targetZoom - this.zoom) * this.zoomSmoothing;
    }

    addShake(intensity, duration) {
        this.shake.intensity = intensity;
        this.shake.duration = duration;
    }

    updateShake(deltaTime) {
        if (this.shake.duration > 0) {
            this.shake.duration -= deltaTime;
            this.shake.x = (Math.random() - 0.5) * this.shake.intensity;
            this.shake.y = (Math.random() - 0.5) * this.shake.intensity;
        } else {
            this.shake.x = 0;
            this.shake.y = 0;
        }
    }

    apply(ctx) {
        ctx.translate(-this.x + this.shake.x, -this.y + this.shake.y);
    }

    worldToScreen(worldX, worldY) {
        return {
            x: worldX - this.x,
            y: worldY - this.y
        };
    }

    screenToWorld(screenX, screenY) {
        return {
            x: screenX + this.x,
            y: screenY + this.y
        };
    }
}

// Overengineered Game Engine for Grinder RPG
export class GameEngine {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.entities = new Map();
        this.systems = [];
        this.eventBus = new EventBus();
        this.deltaTime = 0;
        this.lastTime = 0;
        this.isRunning = false;
        this.canvas = null;
        this.ctx = null;
        this.particleSystem = new ParticleSystem();
        this.soundSystem = new SoundSystem();
        this.uiSystem = new UISystem();
        this.camera = new Camera();
        this.player = null;

        this.initializeCanvas();
        this.setupSystems();
    }

    initializeCanvas() {
        if (!this.container) {
            console.error('❌ Game container not found');
            return;
        }

        this.canvas = document.createElement('canvas');
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.canvas.style.position = 'absolute';
        this.canvas.style.top = '0';
        this.canvas.style.left = '0';
        this.canvas.style.zIndex = '1';
        this.ctx = this.canvas.getContext('2d');
        if (!this.ctx) {
            console.error('❌ Failed to get canvas context');
            return;
        }
        this.ctx.imageSmoothingEnabled = false; // Pixel perfect
        this.container.appendChild(this.canvas);
    }

    setupSystems() {
        this.systems.push(new MovementSystem(this));
        this.systems.push(new CombatSystem(this));
        this.systems.push(new AISystem(this));
        this.systems.push(new AnimationSystem(this));
        this.systems.push(new CollisionSystem(this));
    }

    addEntity(entity) {
        this.entities.set(entity.id, entity);
        this.eventBus.emit('entityAdded', entity);
    }

    removeEntity(entityId) {
        const entity = this.entities.get(entityId);
        if (entity) {
            this.entities.delete(entityId);
            this.eventBus.emit('entityRemoved', entity);
        }
    }

    getEntitiesByComponent(componentName) {
        return Array.from(this.entities.values()).filter(entity =>
            entity.hasComponent(componentName)
        );
    }

    renderGroundTexture() {
        const tileSize = 64;
        const cameraX = this.camera.x;
        const cameraY = this.camera.y;
        
        // Calculate visible tile range
        const startX = Math.floor(cameraX / tileSize) - 1;
        const startY = Math.floor(cameraY / tileSize) - 1;
        const endX = startX + Math.ceil(this.canvas.width / tileSize) + 2;
        const endY = startY + Math.ceil(this.canvas.height / tileSize) + 2;
        
        // Render ground tiles
        for (let x = startX; x < endX; x++) {
            for (let y = startY; y < endY; y++) {
                const tileX = x * tileSize;
                const tileY = y * tileSize;
                
                // Create a simple grass-like pattern
                this.renderGroundTile(tileX, tileY, tileSize, x, y);
            }
        }
    }

    renderGroundTile(x, y, size, gridX, gridY) {
        // Base grass color
        this.ctx.fillStyle = '#2d5016';
        this.ctx.fillRect(x, y, size, size);
        
        // Add some variation based on grid position
        const variation = (gridX + gridY) % 4;
        
        // Darker grass patches
        this.ctx.fillStyle = '#1a3009';
        for (let i = 0; i < 8; i++) {
            const patchX = x + (i * 13 + variation * 7) % size;
            const patchY = y + (i * 17 + variation * 11) % size;
            const patchSize = 4 + (i + variation) % 3;
            this.ctx.fillRect(patchX, patchY, patchSize, patchSize);
        }
        
        // Lighter grass highlights
        this.ctx.fillStyle = '#3d6b1f';
        for (let i = 0; i < 6; i++) {
            const highlightX = x + (i * 19 + variation * 5) % size;
            const highlightY = y + (i * 23 + variation * 13) % size;
            const highlightSize = 2 + (i + variation) % 2;
            this.ctx.fillRect(highlightX, highlightY, highlightSize, highlightSize);
        }
        
        // Subtle grid lines for reference
        this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.1)';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, size, size);
    }

    start() {
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }

    stop() {
        this.isRunning = false;
    }

    gameLoop() {
        if (!this.isRunning) return;

        try {
            const currentTime = performance.now();
            this.deltaTime = (currentTime - this.lastTime) / 1000;
            this.lastTime = currentTime;

            // Update all systems
            this.systems.forEach(system => system.update(this.deltaTime));
            
            // Update particles
            this.particleSystem.update(this.deltaTime);
            
            // Update camera shake
            this.camera.updateShake(this.deltaTime);

            // Clear and render
            if (this.ctx) {
                this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
                this.render();
            }

            requestAnimationFrame(() => this.gameLoop());
        } catch (error) {
            console.error('❌ Error in game loop:', error);
            // Continue the loop
            requestAnimationFrame(() => this.gameLoop());
        }
    }    render() {
        // Update camera to follow player
        if (this.player) {
            const playerTransform = this.player.getComponent('Transform');
            if (playerTransform) {
                this.camera.followTarget(playerTransform.x, playerTransform.y);
            }
        }

        // Apply camera transform
        if (this.ctx) {
            this.ctx.save();
            this.camera.apply(this.ctx);

            // Render ground texture first
            this.renderGroundTexture();

            // Render entities with camera offset
            const renderableEntities = this.getEntitiesByComponent('Renderable');
            renderableEntities
                .sort((a, b) => a.getComponent('Renderable').zIndex - b.getComponent('Renderable').zIndex)
                .forEach(entity => {
                    const renderable = entity.getComponent('Renderable');
                    const transform = entity.getComponent('Transform');
                    if (renderable && transform) {
                        renderable.render(this.ctx, transform, this.camera);
                    }
                });

            // Render particles with camera
            this.particleSystem.render(this.ctx, this.camera);

            // Render world UI elements (health bars) with camera transform
            this.uiSystem.renderWorldUI(this.ctx);

            this.ctx.restore();

            // Render screen UI (panels, buttons) without camera transform
            this.uiSystem.renderScreenUI(this.ctx);
        }
    }
}

// Event Bus for decoupled communication
class EventBus {
    constructor() {
        this.listeners = new Map();
    }

    on(event, callback) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event).push(callback);
    }

    emit(event, data) {
        if (this.listeners.has(event)) {
            this.listeners.get(event).forEach(callback => callback(data));
        }
    }

    off(event, callback) {
        if (this.listeners.has(event)) {
            const callbacks = this.listeners.get(event);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
}

// Entity Component System
export class Entity {
    constructor(id = null) {
        this.id = id || Math.random().toString(36).substr(2, 9);
        this.components = new Map();
    }

    addComponent(component) {
        this.components.set(component.constructor.name, component);
        component.entity = this;
        return this;
    }

    getComponent(componentName) {
        return this.components.get(componentName);
    }

    hasComponent(componentName) {
        return this.components.has(componentName);
    }

    removeComponent(componentName) {
        this.components.delete(componentName);
        return this;
    }
}

// Base Component class
export class Component {
    constructor() {
        this.entity = null;
    }
}

// Transform Component
export class Transform extends Component {
    constructor(x = 0, y = 0, rotation = 0, scale = 1) {
        super();
        this.x = x;
        this.y = y;
        this.rotation = rotation;
        this.scale = scale;
        this.prevX = x;
        this.prevY = y;
        this.trail = []; // For movement trail effect
    }

    setPosition(x, y) {
        this.prevX = this.x;
        this.prevY = this.y;
        
        // Add to trail for visual feedback
        this.trail.push({ x: this.x, y: this.y, time: performance.now() });
        
        // Keep trail short
        if (this.trail.length > 5) {
            this.trail.shift();
        }
        
        this.x = x;
        this.y = y;
    }

    getDistance(other) {
        const dx = this.x - other.x;
        const dy = this.y - other.y;
        return Math.sqrt(dx * dx + dy * dy);
    }

    hasMovedRecently() {
        return Math.abs(this.x - this.prevX) > 1 || Math.abs(this.y - this.prevY) > 1;
    }
}

// Health Component
export class Health extends Component {
    constructor(maxHealth = 100) {
        super();
        this.maxHealth = maxHealth;
        this.currentHealth = maxHealth;
        this.isDead = false;
    }

    takeDamage(amount) {
        this.currentHealth = Math.max(0, this.currentHealth - amount);
        if (this.currentHealth === 0) {
            this.isDead = true;
        }
        return this.currentHealth;
    }

    heal(amount) {
        this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
    }

    getHealthPercentage() {
        return this.currentHealth / this.maxHealth;
    }
}

// Combat Component
export class Combat extends Component {
    constructor(damage = 10, attackRange = 50, attackCooldown = 1.0) {
        super();
        this.damage = damage;
        this.attackRange = attackRange;
        this.attackCooldown = attackCooldown;
        this.lastAttackTime = 0;
        this.isAttacking = false;
        this.target = null;
        this.attackAnimationDuration = 0.6; // Duration of attack animation in seconds
        this.damageDelay = 0.3; // When during animation to apply damage
        this.pendingDamageTargets = []; // Targets to damage after animation delay
    }

    canAttack(currentTime) {
        return !this.isAttacking && (currentTime - this.lastAttackTime >= this.attackCooldown);
    }

    startAttack(currentTime, target) {
        this.lastAttackTime = currentTime;
        this.isAttacking = true;
        this.target = target;

        // Schedule damage application after animation delay
        this.pendingDamageTargets.push({
            target: target,
            damageTime: currentTime + this.damageDelay
        });

        // End attack after full animation duration
        setTimeout(() => {
            this.isAttacking = false;
            this.target = null;
        }, this.attackAnimationDuration * 1000);
    }

    processPendingDamage(currentTime) {
        this.pendingDamageTargets = this.pendingDamageTargets.filter(pendingDamage => {
            if (currentTime >= pendingDamage.damageTime) {
                // Apply damage now
                return false; // Remove from pending list
            }
            return true; // Keep in pending list
        });
    }
}

// Movement Component
export class Movement extends Component {
    constructor(speed = 100) {
        super();
        this.speed = speed;
        this.targetX = null;
        this.targetY = null;
        this.isMoving = false;
        this.velocity = { x: 0, y: 0 };
    }

    setTarget(x, y) {
        this.targetX = x;
        this.targetY = y;
        this.isMoving = true;
    }

    stop() {
        this.targetX = null;
        this.targetY = null;
        this.isMoving = false;
        this.velocity.x = 0;
        this.velocity.y = 0;
    }
}

// AI Component
export class AI extends Component {
    constructor(type = 'aggressive', detectionRange = 150) {
        super();
        this.type = type;
        this.detectionRange = detectionRange;
        this.state = 'idle';
        this.target = null;
        this.lastStateChange = 0;
        this.patrolPoints = [];
        this.currentPatrolIndex = 0;
    }

    setState(newState) {
        this.state = newState;
        this.lastStateChange = performance.now();
    }
}

// Renderable Component for pixel art
export class Renderable extends Component {
    constructor(entityType, width = 16, height = 16, scale = 2, zIndex = 0) {
        super();
        this.entityType = entityType;
        this.currentState = 'idle';
        this.width = width;
        this.height = height;
        this.scale = scale;
        this.zIndex = zIndex;
        this.flipX = false;
        this.facingLeft = false;
        this.animationFrame = 0;
        this.animationSpeed = 0.3;
        this.lastAnimationTime = 0;
        this.pixelData = null;
        this.updatePixelData();
    }

    updatePixelData() {
        // This will be set by the animation system
        const { getPixelArtFrame } = this.getPixelArtModule();
        if (getPixelArtFrame) {
            this.pixelData = getPixelArtFrame(this.entityType, this.currentState, this.animationFrame);
        }
    }

    getPixelArtModule() {
        // Access the imported module - this is a bit hacky but works for our setup
        return window.pixelArtModule || {};
    }

    setState(newState) {
        if (this.currentState !== newState) {
            this.currentState = newState;
            this.animationFrame = 0;
            this.lastAnimationTime = 0; // Reset animation timer
            this.updatePixelData();
        }
    }

    forceSetState(newState) {
        // Force state change even if it's the same state (useful for restarting animations)
        console.log(`Force setting state to: ${newState} for entity: ${this.entityType}`);
        this.currentState = newState;
        this.animationFrame = 0;
        this.lastAnimationTime = 0;
        this.updatePixelData();
    }

    render(ctx, transform, camera = null) {
        // Render movement trail for visual feedback
        this.renderMovementTrail(ctx, transform);
        
        // Render shadow
        this.renderShadow(ctx, transform);
        
        // Render character
        ctx.save();
        ctx.translate(transform.x, transform.y);
        if (this.flipX) {
            ctx.scale(-1, 1);
        }
        ctx.scale(transform.scale, transform.scale);

        this.renderPixelArt(ctx);
        ctx.restore();
    }

    renderMovementTrail(ctx, transform) {
        if (!transform.trail || transform.trail.length < 2) return;
        
        const currentTime = performance.now();
        ctx.save();
        
        transform.trail.forEach((point, index) => {
            const age = currentTime - point.time;
            if (age > 500) return; // Trail fades after 500ms
            
            const alpha = Math.max(0, 1 - age / 500) * 0.3;
            const size = (index / transform.trail.length) * 3;
            
            ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
            ctx.beginPath();
            ctx.arc(point.x, point.y, size, 0, Math.PI * 2);
            ctx.fill();
        });
        
        ctx.restore();
    }

    renderShadow(ctx, transform) {
        // Simple oval shadow under character
        ctx.save();
        ctx.translate(transform.x, transform.y + (this.height * this.scale * 0.4));
        ctx.scale(this.scale, this.scale * 0.3);
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
        ctx.beginPath();
        ctx.ellipse(0, 0, this.width * 0.6, this.height * 0.3, 0, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }

    renderPixelArt(ctx) {
        const pixelSize = this.scale;
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                const pixelIndex = y * this.width + x;
                const color = this.pixelData[pixelIndex];
                if (color && color !== 'transparent') {
                    ctx.fillStyle = this.getColor(color);
                    ctx.fillRect(
                        x * pixelSize - (this.width * pixelSize) / 2,
                        y * pixelSize - (this.height * pixelSize) / 2,
                        pixelSize,
                        pixelSize
                    );
                }
            }
        }
    }

    getColor(colorName) {
        const colors = {
            'white': '#ffffff',
            'gray': '#888888',
            'black': '#000000',
            'red': '#ff0000',
            'blue': '#0000ff',
            'brown': '#8b4513',
            'skin': '#f1c27d',
            'darkgray': '#444444',
            'yellow': '#ffff00',
            'green': '#00ff00',
            'darkbrown': '#654321',
            'orange': '#ffa500',
            'darkblue': '#000080',
            'lightgray': '#cccccc'
        };
        return colors[colorName] || '#ffffff';
    }
}

// Collision Component
export class Collider extends Component {
    constructor(radius = 16) {
        super();
        this.radius = radius;
        this.isTrigger = false;
    }

    intersects(other, thisTransform, otherTransform) {
        const distance = thisTransform.getDistance(otherTransform);
        return distance < (this.radius + other.radius);
    }
}

// NPC Component
export class NPC extends Component {
    constructor(name, type = 'merchant', dialogue = []) {
        super();
        this.name = name;
        this.type = type;
        this.dialogue = dialogue;
        this.isInteracting = false;
        this.interactionRange = 60;
    }
}

// Shop Component
export class Shop extends Component {
    constructor(items = []) {
        super();
        this.items = items;
        this.isOpen = false;
    }

    addItem(item) {
        this.items.push(item);
    }
}

// Inventory Component
export class Inventory extends Component {
    constructor(maxSlots = 20) {
        super();
        this.items = [];
        this.maxSlots = maxSlots;
        this.gold = 25; // Start with less gold so players need to earn it
    }

    addItem(item) {
        if (this.items.length < this.maxSlots) {
            this.items.push(item);
            return true;
        }
        return false;
    }

    removeItem(itemId) {
        const index = this.items.findIndex(item => item.id === itemId);
        if (index > -1) {
            return this.items.splice(index, 1)[0];
        }
        return null;
    }

    hasGold(amount) {
        return this.gold >= amount;
    }

    spendGold(amount) {
        if (this.hasGold(amount)) {
            this.gold -= amount;
            return true;
        }
        return false;
    }
}

// Mana Component
export class Mana extends Component {
    constructor(maxMana = 50) {
        super();
        this.maxMana = maxMana;
        this.currentMana = maxMana;
    }

    useMana(amount) {
        if (this.currentMana >= amount) {
            this.currentMana -= amount;
            return true;
        }
        return false;
    }

    restoreMana(amount) {
        this.currentMana = Math.min(this.maxMana, this.currentMana + amount);
    }

    getManaPercentage() {
        return this.currentMana / this.maxMana;
    }
}

// Systems
class MovementSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(deltaTime) {
        const movingEntities = this.engine.getEntitiesByComponent('Movement');

        movingEntities.forEach(entity => {
            const movement = entity.getComponent('Movement');
            const transform = entity.getComponent('Transform');

            if (!movement.isMoving || !transform) return;

            const dx = movement.targetX - transform.x;
            const dy = movement.targetY - transform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 5) {
                movement.stop();
                return;
            }

            const dirX = dx / distance;
            const dirY = dy / distance;

            movement.velocity.x = dirX * movement.speed;
            movement.velocity.y = dirY * movement.speed;

            transform.setPosition(
                transform.x + movement.velocity.x * deltaTime,
                transform.y + movement.velocity.y * deltaTime
            );

            // Don't flip sprites - keep character facing the same direction
            const renderable = entity.getComponent('Renderable');
            if (renderable) {
                renderable.flipX = false; // Never flip to avoid axe issues
                renderable.facingLeft = false; // Always face right
            }
        });
    }
}

class CombatSystem {
    constructor(engine) {
        this.engine = engine;
        this.engine.eventBus.on('entityDeath', (entity) => this.handleEntityDeath(entity));
    }

    update(deltaTime) {
        const combatEntities = this.engine.getEntitiesByComponent('Combat');
        const currentTime = performance.now() / 1000;

        combatEntities.forEach(attacker => {
            const combat = attacker.getComponent('Combat');
            const attackerTransform = attacker.getComponent('Transform');
            const attackerHealth = attacker.getComponent('Health');

            if (!attackerTransform || !attackerHealth || attackerHealth.isDead) return;

            // Find targets in range
            if (!combat.target || combat.target.getComponent('Health').isDead) {
                combat.target = this.findNearestTarget(attacker);
            }

            if (combat.target && combat.canAttack(currentTime)) {
                const targetTransform = combat.target.getComponent('Transform');
                const distance = attackerTransform.getDistance(targetTransform);

                if (distance <= combat.attackRange) {
                    this.performAttack(attacker, combat.target, currentTime);
                }
            }
        });
    }

    findNearestTarget(attacker) {
        const attackerTransform = attacker.getComponent('Transform');
        const attackerAI = attacker.getComponent('AI');
        const isPlayer = !attackerAI; // Player doesn't have AI component

        let targets = this.engine.getEntitiesByComponent('Health').filter(entity => {
            const entityAI = entity.getComponent('AI');
            const entityHealth = entity.getComponent('Health');
            const entityNPC = entity.getComponent('NPC');
            const attackerAIComponent = attacker.getComponent('AI');

            // Exclude NPCs from combat targeting
            if (entityNPC) return false;

            // Skip dead entities
            if (entityHealth.isDead) return false;

            // Don't target self
            if (entity === attacker) return false;

            // Pet AI logic
            if (attackerAIComponent && attackerAIComponent.type === 'pet') {
                // Pets target enemies (entities with AI that are not pets)
                return entityAI && entityAI.type !== 'pet';
            }

            // Regular logic: Players target enemies, enemies target players
            return (isPlayer ? entityAI : !entityAI);
        });

        let nearestTarget = null;
        let nearestDistance = Infinity;

        targets.forEach(target => {
            const targetTransform = target.getComponent('Transform');
            const distance = attackerTransform.getDistance(targetTransform);

            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestTarget = target;
            }
        });

        return nearestTarget;
    }

    performAttack(attacker, target, currentTime) {
        const combat = attacker.getComponent('Combat');

        // Start attack animation and schedule damage
        combat.startAttack(currentTime, target);

        // Trigger attack animation immediately
        const attackerRenderable = attacker.getComponent('Renderable');
        if (attackerRenderable) {
            this.triggerAttackAnimation(attacker);
        }

        // Schedule damage application after animation delay
        setTimeout(() => {
            this.applyDamage(attacker, target);
        }, combat.damageDelay * 1000);
    }

    applyDamage(attacker, target) {
        const combat = attacker.getComponent('Combat');
        const targetHealth = target.getComponent('Health');
        const targetTransform = target.getComponent('Transform');
        const attackerTransform = attacker.getComponent('Transform');

        // Check if target is still valid
        if (!targetHealth || targetHealth.isDead) return;

        // Deal damage
        targetHealth.takeDamage(combat.damage);

        // Heavy hit effects
        this.createHeavyHitEffect(attacker, target);

        // Create enhanced damage particles
        this.engine.particleSystem.createDamageParticles(
            targetTransform.x,
            targetTransform.y,
            combat.damage
        );

        // Create blood particles
        this.engine.particleSystem.createBloodParticles(
            targetTransform.x,
            targetTransform.y
        );

        // Camera shake for heavy hits
        this.engine.camera.addShake(8, 0.3);

        // Knockback effect
        this.applyKnockback(target, attackerTransform, targetTransform);

        // Play attack sound
        this.engine.soundSystem.playSound('attack');

        // Check for death
        if (targetHealth.isDead) {
            this.engine.eventBus.emit('entityDeath', target);
        }
    }

    createHeavyHitEffect(attacker, target) {
        const targetRenderable = target.getComponent('Renderable');
        const targetTransform = target.getComponent('Transform');
        
        if (targetRenderable) {
            // Store original data
            const originalData = [...targetRenderable.pixelData];
            
            // Flash white for heavy hit
            targetRenderable.pixelData = targetRenderable.pixelData.map(pixel => 
                pixel && pixel !== 'transparent' && pixel !== '' ? 'white' : pixel
            );
            
            // Create hit freeze effect
            setTimeout(() => {
                // Flash red
                targetRenderable.pixelData = targetRenderable.pixelData.map(pixel => 
                    pixel && pixel !== 'transparent' && pixel !== '' ? 'red' : pixel
                );
                
                setTimeout(() => {
                    targetRenderable.pixelData = originalData;
                }, 100);
            }, 50);

            // Create impact particles
            this.engine.particleSystem.createImpactParticles(
                targetTransform.x, targetTransform.y
            );
        }
    }

    applyKnockback(target, attackerTransform, targetTransform) {
        const movement = target.getComponent('Movement');
        if (movement) {
            // Calculate knockback direction
            const dx = targetTransform.x - attackerTransform.x;
            const dy = targetTransform.y - attackerTransform.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const knockbackForce = 30;
                const dirX = dx / distance;
                const dirY = dy / distance;
                
                // Apply knockback
                const knockbackX = targetTransform.x + dirX * knockbackForce;
                const knockbackY = targetTransform.y + dirY * knockbackForce;
                
                movement.setTarget(knockbackX, knockbackY);
                
                // Stop knockback after short duration
                setTimeout(() => {
                    movement.stop();
                }, 200);
            }
        }
    }

    triggerAttackAnimation(entity) {
        // Set the entity to attacking state
        const renderable = entity.getComponent('Renderable');
        const combat = entity.getComponent('Combat');

        if (renderable && combat) {
            renderable.setState('attacking');

            // Return to idle after attack animation completes
            setTimeout(() => {
                if (renderable.currentState === 'attacking') {
                    renderable.setState('idle');
                }
            }, combat.attackAnimationDuration * 1000);
        }
    }

    handleEntityDeath(entity) {
        const transform = entity.getComponent('Transform');

        // Create death particles
        this.engine.particleSystem.createDeathParticles(transform.x, transform.y);

        // Play death sound
        this.engine.soundSystem.playSound('death');

        // Remove non-player entities after a short delay. Keep the player entity
        // in the engine so higher-level game logic can handle respawn without
        // the engine deleting the object and losing persistent state (like EXP).
        const ai = entity.getComponent && entity.getComponent('AI');
        if (ai) {
            // Enemy or pet - remove as normal
            setTimeout(() => {
                this.engine.removeEntity(entity.id);
            }, 500);
        } else {
            // Player entity: do not remove here. Let game logic perform respawn
            // and clear the Health.isDead flag when appropriate.
        }
    }
}

class AISystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(deltaTime) {
        const aiEntities = this.engine.getEntitiesByComponent('AI');

        aiEntities.forEach(entity => {
            const ai = entity.getComponent('AI');
            const transform = entity.getComponent('Transform');
            const movement = entity.getComponent('Movement');
            const health = entity.getComponent('Health');

            if (!transform || !movement || health.isDead) return;

            // Handle pet AI differently
            if (ai.type === 'pet') {
                this.handlePetAI(entity, ai, transform, movement);
            } else {
                // Regular enemy AI
                switch (ai.state) {
                    case 'idle':
                        this.handleIdleState(entity, ai, transform, movement);
                        break;
                    case 'patrol':
                        this.handlePatrolState(entity, ai, transform, movement);
                        break;
                    case 'chase':
                        this.handleChaseState(entity, ai, transform, movement);
                        break;
                    case 'attack':
                        this.handleAttackState(entity, ai, transform, movement);
                        break;
                }
            }
        });
    }

    handleIdleState(entity, ai, transform, movement) {
        // Look for player
        const player = this.findPlayer();
        if (player) {
            const playerTransform = player.getComponent('Transform');
            const distance = transform.getDistance(playerTransform);

            if (distance <= ai.detectionRange) {
                ai.target = player;
                ai.setState('chase');
                return;
            }
        }

        // Random chance to start patrolling
        if (Math.random() < 0.01) {
            this.generatePatrolPoints(ai, transform);
            ai.setState('patrol');
        }
    }

    handlePatrolState(entity, ai, transform, movement) {
        // Check for player
        const player = this.findPlayer();
        if (player) {
            const playerTransform = player.getComponent('Transform');
            const distance = transform.getDistance(playerTransform);

            if (distance <= ai.detectionRange) {
                ai.target = player;
                ai.setState('chase');
                return;
            }
        }

        // Continue patrol
        if (!movement.isMoving && ai.patrolPoints.length > 0) {
            const targetPoint = ai.patrolPoints[ai.currentPatrolIndex];
            movement.setTarget(targetPoint.x, targetPoint.y);
            ai.currentPatrolIndex = (ai.currentPatrolIndex + 1) % ai.patrolPoints.length;
        }

        // Random chance to go idle
        if (Math.random() < 0.005) {
            movement.stop();
            ai.setState('idle');
        }
    }

    handleChaseState(entity, ai, transform, movement) {
        if (!ai.target || ai.target.getComponent('Health').isDead) {
            ai.target = null;
            ai.setState('idle');
            return;
        }

        const targetTransform = ai.target.getComponent('Transform');
        const distance = transform.getDistance(targetTransform);

        // If too far, lose target
        if (distance > ai.detectionRange * 1.5) {
            ai.target = null;
            ai.setState('idle');
            return;
        }

        // If close enough to attack
        const combat = entity.getComponent('Combat');
        if (combat && distance <= combat.attackRange) {
            movement.stop();
            ai.setState('attack');
            return;
        }

        // Move towards target
        movement.setTarget(targetTransform.x, targetTransform.y);
    }

    handleAttackState(entity, ai, transform, movement) {
        if (!ai.target || ai.target.getComponent('Health').isDead) {
            ai.target = null;
            ai.setState('idle');
            return;
        }

        const targetTransform = ai.target.getComponent('Transform');
        const distance = transform.getDistance(targetTransform);
        const combat = entity.getComponent('Combat');

        // If target moved away, chase again
        if (distance > combat.attackRange * 1.2) {
            ai.setState('chase');
            return;
        }

        // Stay in attack range but don't move
        movement.stop();
    }

    findPlayer() {
        // Player is the entity without AI component
        return this.engine.getEntitiesByComponent('Health').find(entity =>
            !entity.hasComponent('AI')
        );
    }

    generatePatrolPoints(ai, transform) {
        ai.patrolPoints = [];
        const numPoints = 3 + Math.floor(Math.random() * 3);

        for (let i = 0; i < numPoints; i++) {
            const angle = (Math.PI * 2 * i) / numPoints;
            const radius = 50 + Math.random() * 100;
            ai.patrolPoints.push({
                x: transform.x + Math.cos(angle) * radius,
                y: transform.y + Math.sin(angle) * radius
            });
        }
        ai.currentPatrolIndex = 0;
    }

    handlePetAI(entity, ai, transform, movement) {
        const player = this.findPlayer();
        if (!player) return;

        const playerTransform = player.getComponent('Transform');
        const distanceToPlayer = transform.getDistance(playerTransform);

        // Find nearest enemy to attack
        const nearestEnemy = this.findNearestEnemyForPet(entity);
        
        if (nearestEnemy) {
            const enemyTransform = nearestEnemy.getComponent('Transform');
            const distanceToEnemy = transform.getDistance(enemyTransform);
            
            // If enemy is close, attack it
            const combat = entity.getComponent('Combat');
            if (combat && distanceToEnemy <= combat.attackRange) {
                movement.stop();
                ai.setState('attack');
                return;
            }
            
            // If enemy is within detection range, chase it
            if (distanceToEnemy <= ai.detectionRange) {
                movement.setTarget(enemyTransform.x, enemyTransform.y);
                ai.setState('chase');
                return;
            }
        }

        // If too far from player, follow player
        if (distanceToPlayer > 80) {
            const followX = playerTransform.x + (Math.random() - 0.5) * 40;
            const followY = playerTransform.y + (Math.random() - 0.5) * 40;
            movement.setTarget(followX, followY);
            ai.setState('chase');
        } else if (distanceToPlayer < 30) {
            // Too close to player, move away slightly
            const awayX = transform.x + (transform.x - playerTransform.x) * 0.1;
            const awayY = transform.y + (transform.y - playerTransform.y) * 0.1;
            movement.setTarget(awayX, awayY);
        } else {
            // Stay near player
            movement.stop();
            ai.setState('idle');
        }
    }

    findNearestEnemyForPet(pet) {
        const petTransform = pet.getComponent('Transform');
        let nearestEnemy = null;
        let nearestDistance = Infinity;

        // Find enemies (entities with AI that are not pets)
        const enemies = this.engine.getEntitiesByComponent('AI').filter(entity => {
            const ai = entity.getComponent('AI');
            const health = entity.getComponent('Health');
            return ai.type !== 'pet' && !health.isDead;
        });

        enemies.forEach(enemy => {
            const enemyTransform = enemy.getComponent('Transform');
            const distance = petTransform.getDistance(enemyTransform);
            
            if (distance < nearestDistance) {
                nearestDistance = distance;
                nearestEnemy = enemy;
            }
        });

        return nearestEnemy;
    }
}

class AnimationSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(deltaTime) {
        const animatedEntities = this.engine.getEntitiesByComponent('Renderable');

        animatedEntities.forEach(entity => {
            const renderable = entity.getComponent('Renderable');
            const movement = entity.getComponent('Movement');
            const combat = entity.getComponent('Combat');
            const health = entity.getComponent('Health');
            const ai = entity.getComponent('AI');

            // Determine current state - but don't override attack animation
            let newState = renderable.currentState;

            if (health && health.isDead) {
                newState = 'dead';
            } else if (combat && combat.isAttacking) {
                // Combat system is controlling attack state
                newState = 'attacking';
            } else if (renderable.currentState === 'attacking') {
                // Don't override manually set attack states - let them finish naturally
                // The attack animation will be reset to idle by the combat system
                newState = 'attacking';
            } else {
                // Normal state logic for non-attacking entities
                if (movement && movement.isMoving) {
                    newState = 'walking';
                } else if (ai && ai.state === 'chase') {
                    newState = 'walking';
                } else {
                    newState = 'idle';
                }
            }

            // Update state if changed
            renderable.setState(newState);

            // Update animation frame with different speeds for different states
            renderable.lastAnimationTime += deltaTime;

            // Use faster animation for attacks
            const animSpeed = renderable.currentState === 'attacking' ? 0.15 : renderable.animationSpeed;

            if (renderable.lastAnimationTime >= animSpeed) {
                const { ANIMATION_FRAMES } = renderable.getPixelArtModule();
                if (ANIMATION_FRAMES && ANIMATION_FRAMES[renderable.entityType] &&
                    ANIMATION_FRAMES[renderable.entityType][renderable.currentState]) {
                    const maxFrames = ANIMATION_FRAMES[renderable.entityType][renderable.currentState].length;

                    // For attack animations, don't loop - play once
                    if (renderable.currentState === 'attacking') {
                        if (renderable.animationFrame < maxFrames - 1) {
                            renderable.animationFrame++;
                            console.log(`Attack animation frame: ${renderable.animationFrame}/${maxFrames} for ${renderable.entityType}`);
                            renderable.updatePixelData();
                        }
                    } else {
                        // Normal looping animation
                        renderable.animationFrame = (renderable.animationFrame + 1) % maxFrames;
                        renderable.updatePixelData();
                    }
                }
                renderable.lastAnimationTime = 0;
            }
        });
    }
}

class CollisionSystem {
    constructor(engine) {
        this.engine = engine;
    }

    update(deltaTime) {
        const collidableEntities = this.engine.getEntitiesByComponent('Collider');

        for (let i = 0; i < collidableEntities.length; i++) {
            for (let j = i + 1; j < collidableEntities.length; j++) {
                const entityA = collidableEntities[i];
                const entityB = collidableEntities[j];

                const colliderA = entityA.getComponent('Collider');
                const colliderB = entityB.getComponent('Collider');
                const transformA = entityA.getComponent('Transform');
                const transformB = entityB.getComponent('Transform');

                if (colliderA.intersects(colliderB, transformA, transformB)) {
                    this.engine.eventBus.emit('collision', { entityA, entityB });
                }
            }
        }
    }
}

// Particle System
class ParticleSystem {
    constructor() {
        this.particles = [];
    }

    update(deltaTime) {
        this.particles = this.particles.filter(particle => {
            particle.life -= deltaTime;
            particle.x += particle.vx * deltaTime;
            particle.y += particle.vy * deltaTime;
            particle.vy += particle.gravity * deltaTime;
            particle.alpha = particle.life / particle.maxLife;
            return particle.life > 0;
        });
    }

    render(ctx, camera = null) {
        this.particles.forEach(particle => {
            ctx.save();
            ctx.globalAlpha = particle.alpha;
            ctx.fillStyle = particle.color;
            ctx.fillRect(particle.x - particle.size / 2, particle.y - particle.size / 2,
                particle.size, particle.size);
            ctx.restore();
        });
    }

    createDamageParticles(x, y, damage) {
        for (let i = 0; i < 5; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 100,
                vy: -50 - Math.random() * 50,
                gravity: 200,
                size: 2 + Math.random() * 2,
                color: '#ffff00',
                life: 1,
                maxLife: 1,
                alpha: 1
            });
        }
    }

    createBloodParticles(x, y) {
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 150,
                vy: -30 - Math.random() * 70,
                gravity: 300,
                size: 1 + Math.random() * 2,
                color: '#ff0000',
                life: 0.8,
                maxLife: 0.8,
                alpha: 1
            });
        }
    }

    createDeathParticles(x, y) {
        for (let i = 0; i < 15; i++) {
            this.particles.push({
                x: x,
                y: y,
                vx: (Math.random() - 0.5) * 200,
                vy: -100 - Math.random() * 100,
                gravity: 150,
                size: 2 + Math.random() * 3,
                color: Math.random() > 0.5 ? '#888888' : '#444444',
                life: 1.5,
                maxLife: 1.5,
                alpha: 1
            });
        }
    }

    createImpactParticles(x, y) {
        // White impact flash particles
        for (let i = 0; i < 12; i++) {
            const angle = (Math.PI * 2 * i) / 12;
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * (80 + Math.random() * 40),
                vy: Math.sin(angle) * (80 + Math.random() * 40),
                gravity: 0,
                size: 3 + Math.random() * 2,
                color: '#ffffff',
                life: 0.3,
                maxLife: 0.3,
                alpha: 1
            });
        }
        
        // Orange spark particles
        for (let i = 0; i < 8; i++) {
            this.particles.push({
                x: x + (Math.random() - 0.5) * 10,
                y: y + (Math.random() - 0.5) * 10,
                vx: (Math.random() - 0.5) * 120,
                vy: -20 - Math.random() * 60,
                gravity: 100,
                size: 1 + Math.random() * 2,
                color: '#ffa500',
                life: 0.6,
                maxLife: 0.6,
                alpha: 1
            });
        }
    }
}

// Sound System (placeholder - would need actual audio files)
class SoundSystem {
    constructor() {
        this.sounds = new Map();
        this.volume = 0.5;
    }

    playSound(soundName) {
        // Placeholder for sound effects
        console.log(`Playing sound: ${soundName}`);
    }
}

// UI System
class UISystem {
    constructor() {
        this.worldElements = []; // Elements that move with camera (health bars)
        this.screenElements = []; // Elements that stay on screen (panels)
    }

    renderWorldUI(ctx) {
        // Render elements that should move with the world (health bars)
        this.worldElements.forEach(element => element.render(ctx));
    }

    renderScreenUI(ctx) {
        // Render elements that stay on screen (UI panels)
        this.screenElements.forEach(element => element.render(ctx));
    }

    // Legacy method for compatibility
    render(ctx) {
        this.renderWorldUI(ctx);
        this.renderScreenUI(ctx);
    }

    addElement(element) {
        // Health bars go to world elements, everything else to screen
        if (element.constructor.name === 'HealthBar') {
            this.worldElements.push(element);
        } else {
            this.screenElements.push(element);
        }
    }

    removeElement(element) {
        let index = this.worldElements.indexOf(element);
        if (index > -1) {
            this.worldElements.splice(index, 1);
            return;
        }
        
        index = this.screenElements.indexOf(element);
        if (index > -1) {
            this.screenElements.splice(index, 1);
        }
    }
}

// Health Bar UI Element
export class HealthBar {
    constructor(entity, offsetX = 0, offsetY = -30) {
        this.entity = entity;
        this.offsetX = offsetX;
        this.offsetY = offsetY;
        this.width = 32;
        this.height = 4;
    }

    render(ctx) {
        const health = this.entity.getComponent('Health');
        const transform = this.entity.getComponent('Transform');
        const renderable = this.entity.getComponent('Renderable');

        if (!health || !transform || health.isDead) return;

        // Calculate position based on entity size and scale
        const entityScale = renderable ? renderable.scale : 1;
        const entityHeight = renderable ? renderable.height * entityScale : 32;
        
        const x = Math.floor(transform.x + this.offsetX - this.width / 2);
        const y = Math.floor(transform.y + this.offsetY - entityHeight / 2);
        const healthPercent = health.getHealthPercentage();

        // Background
        ctx.fillStyle = '#333333';
        ctx.fillRect(x, y, this.width, this.height);

        // Health bar
        ctx.fillStyle = healthPercent > 0.5 ? '#00ff00' :
            healthPercent > 0.25 ? '#ffff00' : '#ff0000';
        ctx.fillRect(x, y, this.width * healthPercent, this.height);

        // Border
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, this.width, this.height);
    }
}