// Enhanced Grinder RPG - Main Game Logic Module
// This module contains the core game logic, separated from UI for maintainability
// Future bots: This is the main game controller - handles player actions, combat, NPCs, etc.

import { 
    GameEngine, 
    Entity, 
    Transform, 
    Health, 
    Combat, 
    Movement, 
    AI, 
    Renderable, 
    Collider,
    HealthBar,
    NPC,
    Shop,
    Inventory,
    Mana
} from './gameEngine.js';
import { PIXEL_ART_DATA, getPixelArtFrame, ANIMATION_FRAMES } from './pixelArtData.js';
import { UIManager } from './uiManager.js';
import { EffectsManager } from './effectsManager.js';
import { MMOManager } from './mmoManager.js';

// Make pixel art module available globally for the game engine
window.pixelArtModule = { PIXEL_ART_DATA, getPixelArtFrame, ANIMATION_FRAMES };

export class EnhancedGrinderRPG {
    constructor() {
        console.log('🎮 Initializing Enhanced Grinder RPG...');
        
        // Initialize core systems
    this.engine = new GameEngine('game-container');
    this.uiManager = new UIManager(this);
    this.effectsManager = new EffectsManager(this);
        
        // Initialize game state
        this.player = null;
        this.enemies = [];
        this.npcs = [];
        this.waveNumber = 1;
        this.enemiesKilled = 0;
        this.playerLevel = 1;
        this.playerExp = 0;
        this.playerExpToNext = 100;
        this.currentNPC = null;
        this.playerPet = null;
        this.petTimer = null;
        
        // Store interval IDs for cleanup
        this.gameIntervals = [];
        
        this.init();
        console.log('🚀 Enhanced Grinder RPG initialized successfully!');
    }

    init() {
        try {
            this.setupEventListeners();
            this.createPlayer();
            this.createMerchantNPC();
            this.populateWorld();
            this.engine.start();
            
    // Instantiate MMO manager after player exists to avoid race conditions / duplicate entities
    this.mmoManager = new MMOManager(this);
    window.mmoManager = this.mmoManager;

    // Start optimized game loops
    this.startGameLoops();

    // Add cleanup on unload
    window.addEventListener('beforeunload', () => this.cleanup());

    console.log('🚀 Enhanced Grinder RPG initialized successfully!');
        } catch (error) {
            console.error('❌ Error initializing game:', error);
            this.logMessage('Failed to initialize game - check console for details', 'damage');
        }
    }

    startGameLoops() {
        // UI updates (60fps for smooth bars)
        this.gameIntervals.push(setInterval(() => this.uiManager.updateUI(), 16));
        
        // Minimap updates (2fps for performance)
        this.gameIntervals.push(setInterval(() => this.uiManager.updateMinimap(), 500));
        
        // Cleanup dead entities and respawn if needed
        this.gameIntervals.push(setInterval(() => this.maintainWorld(), 5000));
    }

    cleanup() {
        // Clear all game intervals
        this.gameIntervals.forEach(interval => clearInterval(interval));
        this.gameIntervals = [];
        
        // Clear pet timer
        if (this.petTimer) {
            clearTimeout(this.petTimer);
            this.petTimer = null;
        }
        
        // Disconnect from MMO server
        if (this.mmoManager) {
            this.mmoManager.disconnect();
        }
    }

    cleanupDeadEntities() {
        this.enemies = this.enemies.filter(enemy => 
            !enemy.getComponent('Health').isDead
        );
    }

    setupEventListeners() {
        // Click to move/attack/interact
        this.engine.canvas.addEventListener('click', (e) => {
            try {
                const rect = this.engine.canvas.getBoundingClientRect();
                const screenX = e.clientX - rect.left;
                const screenY = e.clientY - rect.top;
                
                // Convert screen coordinates to world coordinates
                const worldPos = this.engine.camera.screenToWorld(screenX, screenY);
                
                // Check for NPC interaction first
                const clickedNPC = this.findNPCAtPosition(worldPos.x, worldPos.y);
                if (clickedNPC) {
                    this.interactWithNPC(clickedNPC);
                    return;
                }
                
                // Check if clicking on enemy
                const clickedEnemy = this.findEnemyAtPosition(worldPos.x, worldPos.y);
                if (clickedEnemy) {
                    this.attackEnemy(clickedEnemy);
                } else {
                    this.movePlayer(worldPos.x, worldPos.y);
                }
            } catch (error) {
                console.error('❌ Error handling click event:', error);
            }
        });

        // Entity death handler
        this.engine.eventBus.on('entityDeath', (entity) => {
            try {
                const ai = entity.getComponent('AI');
                if (ai) {
                    if (ai.type === 'pet') {
                        this.handlePetDeath(entity);
                    } else {
                        this.handleEnemyDeath(entity);
                    }
                } else {
                    this.handlePlayerDeath();
                }
            } catch (error) {
                console.error('❌ Error handling entity death:', error);
            }
        });

        // UI event listeners are now set up automatically in UIManager
    }

    createPlayer() {
        // Create player entity using persisted MMO id if available to avoid duplicate entities on reload
        let playerId = 'player';
        try {
            // Prefer per-tab session id so duplicate tabs are unique players
            const sessionId = sessionStorage.getItem('MiniHero.sessionPlayerId');
            if (sessionId) playerId = sessionId;
            else {
                const storedId = localStorage.getItem('MiniHero.accountId');
                if (storedId) playerId = storedId;
            }
        } catch (e) { /* ignore */ }

        this.player = new Entity(playerId);
        
        this.player
            .addComponent(new Transform(window.innerWidth / 2, window.innerHeight / 2))
            .addComponent(new Health(100))
            .addComponent(new Mana(50))
            .addComponent(new Combat(25, 60, 0.8))
            .addComponent(new Movement(120))
            .addComponent(new Renderable('human', 16, 16, 3, 10))
            .addComponent(new Collider(24))
            .addComponent(new Inventory(20));

        this.engine.addEntity(this.player);
        this.engine.player = this.player; // Set player reference for camera
        
        // Add player health bar
        const healthBar = new HealthBar(this.player, 0, -40);
        this.engine.uiSystem.addElement(healthBar);
    }

    createMerchantNPC() {
        const merchant = new Entity('merchant');
        
        // Position merchant near spawn
        const merchantX = window.innerWidth / 2 + 200;
        const merchantY = window.innerHeight / 2 - 100;
        
        merchant
            .addComponent(new Transform(merchantX, merchantY))
            // NPCs don't need Health or Combat components - they're non-combatants
            .addComponent(new Renderable('mage', 16, 16, 3, 8))
            .addComponent(new NPC('Wise Merchant', 'merchant', [
                'Welcome, brave adventurer!',
                'I have potions that will aid you in battle.',
                'Gold for goods, that\'s how trade works!'
            ]))
            .addComponent(new Shop([
                { id: 'health-potion', name: 'Health Potion', price: 15, effect: 'heal', value: 50 },
                { id: 'mana-potion', name: 'Mana Potion', price: 25, effect: 'mana', value: 30 },
                { id: 'pet-scroll', name: 'Pet Summon Scroll', price: 75, effect: 'summon', value: 45 }
            ]));

        this.engine.addEntity(merchant);
        this.npcs.push(merchant);
        
        this.logMessage('A wise merchant has appeared nearby!', 'spawn');
    }

    createEnemy(x, y, type = null) {
        // Prevent creating too many enemies for performance
        if (this.enemies.length >= 100) {
            console.warn('Too many enemies, skipping creation');
            return null;
        }
        // Define enemy types using ALL available sprites from pixelArtData.js
        const enemyTypes = {
            // Wolf family - natural predators
            'wolfPup': { 
                health: 25, damage: 8, speed: 90, range: 40, cooldown: 1.0, 
                scale: 2.0, name: 'Wolf Pup', sprite: 'wolfPup' 
            },
            'wolf': { 
                health: 45, damage: 15, speed: 65, range: 45, cooldown: 1.2, 
                scale: 2.5, name: 'Gray Wolf', sprite: 'wolf' 
            },
            'direwolf': { 
                health: 80, damage: 25, speed: 55, range: 50, cooldown: 1.5, 
                scale: 3.2, name: 'Dire Wolf', sprite: 'wolf' 
            },
            
            // Corrupted humanoids - former adventurers turned evil
            'bandit': { 
                health: 40, damage: 18, speed: 60, range: 50, cooldown: 1.3, 
                scale: 2.3, name: 'Bandit Warrior', sprite: 'human' 
            },
            'darkMage': { 
                health: 35, damage: 22, speed: 45, range: 70, cooldown: 2.0, 
                scale: 2.4, name: 'Dark Mage', sprite: 'mage' 
            },
            'rogueArcher': { 
                health: 30, damage: 16, speed: 75, range: 80, cooldown: 1.1, 
                scale: 2.2, name: 'Rogue Archer', sprite: 'archer' 
            },
            'fallenKnight': { 
                health: 70, damage: 24, speed: 40, range: 45, cooldown: 2.2, 
                scale: 2.8, name: 'Fallen Knight', sprite: 'knight' 
            },
            
            // Elite variants - stronger versions
            'veteranBandit': { 
                health: 60, damage: 26, speed: 65, range: 55, cooldown: 1.4, 
                scale: 2.6, name: 'Veteran Bandit', sprite: 'human' 
            },
            'archMage': { 
                health: 50, damage: 32, speed: 50, range: 85, cooldown: 2.5, 
                scale: 2.7, name: 'Arch Mage', sprite: 'mage' 
            },
            'masterArcher': { 
                health: 45, damage: 28, speed: 80, range: 95, cooldown: 1.3, 
                scale: 2.5, name: 'Master Archer', sprite: 'archer' 
            },
            'deathKnight': { 
                health: 100, damage: 35, speed: 45, range: 50, cooldown: 2.8, 
                scale: 3.1, name: 'Death Knight', sprite: 'knight' 
            }
        };
        
        // Random enemy type if not specified, with weighted probabilities
        if (!type) {
            const types = Object.keys(enemyTypes);
            // Weights: common enemies have higher chance, elites are rarer
            const weights = [
                25, 20, 8,    // Wolf family
                18, 15, 12, 10,  // Basic corrupted humanoids
                5, 3, 2, 1    // Elite variants (rare)
            ];
            
            let random = Math.random() * weights.reduce((a, b) => a + b, 0);
            let selectedIndex = 0;
            
            for (let i = 0; i < weights.length; i++) {
                random -= weights[i];
                if (random <= 0) {
                    selectedIndex = i;
                    break;
                }
            }
            type = types[selectedIndex];
            console.log(`Random enemy selection: ${type} (index ${selectedIndex})`);
        }
        
        const stats = enemyTypes[type];
        if (!stats) {
            console.error(`Enemy type '${type}' not found!`);
            return null;
        }
        
        console.log(`Creating enemy: ${stats.name} (${type}) with sprite: ${stats.sprite}`);
        
        const enemy = new Entity();
        
        enemy
            .addComponent(new Transform(x, y))
            .addComponent(new Health(stats.health))
            .addComponent(new Combat(stats.damage, stats.range, stats.cooldown))
            .addComponent(new Movement(stats.speed))
            .addComponent(new AI('aggressive', 120))
            .addComponent(new Renderable(stats.sprite, 16, 16, stats.scale, 5))
            .addComponent(new Collider(20));

        this.engine.addEntity(enemy);
        this.enemies.push(enemy);
        
        // Add enemy health bar
        const healthBar = new HealthBar(enemy, 0, -35);
        this.engine.uiSystem.addElement(healthBar);
        
        this.logMessage(`${stats.name} spawned!`, 'spawn');
        
        return enemy;
    }

    maintainWorld() {
        // Clean up dead enemies
        this.cleanupDeadEntities();
        
        // Optionally respawn enemies in areas far from player (to maintain world population)
        const currentEnemies = this.enemies.filter(e => !e.getComponent('Health').isDead).length;
        const minEnemies = 20; // Minimum enemies in the world
        
        if (currentEnemies < minEnemies) {
            const playerTransform = this.player.getComponent('Transform');
            const respawnDistance = 800; // Respawn far from player
            
            // Respawn a few enemies far from player
            for (let i = 0; i < 3; i++) {
                const angle = Math.random() * Math.PI * 2;
                const distance = respawnDistance + Math.random() * 400;
                
                const x = playerTransform.x + Math.cos(angle) * distance;
                const y = playerTransform.y + Math.sin(angle) * distance;
                
                // Random enemy type
                this.createEnemy(x, y);
            }
        }
    }

    findEnemyAtPosition(x, y) {
        return this.enemies.find(enemy => {
            if (enemy.getComponent('Health').isDead) return false;
            
            const transform = enemy.getComponent('Transform');
            const renderable = enemy.getComponent('Renderable');
            
            const size = renderable.width * renderable.scale;
            const distance = Math.sqrt(
                Math.pow(x - transform.x, 2) + Math.pow(y - transform.y, 2)
            );
            
            return distance < size;
        });
    }

    findNPCAtPosition(x, y) {
        return this.npcs.find(npc => {
            const transform = npc.getComponent('Transform');
            const npcComponent = npc.getComponent('NPC');
            
            const distance = Math.sqrt(
                Math.pow(x - transform.x, 2) + Math.pow(y - transform.y, 2)
            );
            
            return distance < npcComponent.interactionRange;
        });
    }

    interactWithNPC(npc) {
        this.currentNPC = npc;
        this.uiManager.showNPCInteraction(npc);
        
        const npcComponent = npc.getComponent('NPC');
        this.logMessage(`Talking to ${npcComponent.name}`, 'shop');
    }

    movePlayer(x, y) {
        const movement = this.player.getComponent('Movement');
        movement.setTarget(x, y);
    }

    attackEnemy(enemy) {
        try {
            if (!enemy || !this.player) {
                console.warn('Invalid enemy or player for attack');
                return;
            }

            const playerTransform = this.player.getComponent('Transform');
            const enemyTransform = enemy.getComponent('Transform');
            const playerCombat = this.player.getComponent('Combat');
            
            // Safety checks
            if (!playerTransform || !enemyTransform || !playerCombat) {
                console.warn('Missing components for attack');
                return;
            }
            
            const distance = playerTransform.getDistance(enemyTransform);
            const currentTime = performance.now() / 1000;
            
            if (distance <= playerCombat.attackRange && playerCombat.canAttack(currentTime)) {
                this.logMessage(`Hero begins attack!`, 'damage');
                
                playerCombat.startAttack(currentTime, enemy);
                
                const playerRenderable = this.player.getComponent('Renderable');
                if (playerRenderable) {
                    playerRenderable.forceSetState('attacking');
                    
                    setTimeout(() => {
                        if (playerRenderable && playerRenderable.currentState === 'attacking') {
                            playerRenderable.setState('idle');
                        }
                    }, playerCombat.attackAnimationDuration * 1000);
                }
                
                setTimeout(() => {
                    const enemyHealth = enemy.getComponent('Health');
                    if (enemyHealth && !enemyHealth.isDead) {
                        const damage = playerCombat.damage;
                        enemyHealth.takeDamage(damage);
                        this.logMessage(`Hero deals ${damage} damage!`, 'damage');
                        
                        // Heavy hit effects - all managed by effectsManager
                        this.effectsManager.createHeavyHitEffect(enemyTransform.x, enemyTransform.y, damage);
                        this.effectsManager.createHitParticles(enemyTransform.x, enemyTransform.y, damage);
                        this.effectsManager.flashEntity(enemy);
                        
                        if (enemyHealth.isDead) {
                            this.handleEnemyDeath(enemy);
                        }
                    }
                }, playerCombat.damageDelay * 1000);
                
            } else if (distance > playerCombat.attackRange) {
                this.movePlayer(enemyTransform.x, enemyTransform.y);
                playerCombat.target = enemy;
            } else if (!playerCombat.canAttack(currentTime)) {
                this.logMessage(`Hero is still recovering from last attack!`, 'damage');
            }
        } catch (error) {
            console.error('❌ Error in attackEnemy:', error);
        }
    }

    handleEnemyDeath(enemy) {
        this.enemiesKilled++;
        const expGain = 25;
        this.playerExp += expGain;
        
        // Gold reward with visual drop
        const inventory = this.player.getComponent('Inventory');
        const goldGain = 8 + Math.floor(Math.random() * 12); // Increased gold drops
        inventory.gold += goldGain;
        
        // Create visual gold drop effect
        this.createGoldDrop(enemy.getComponent('Transform').x, enemy.getComponent('Transform').y, goldGain);
        
        this.logMessage(`Enemy defeated! +${expGain} EXP, +${goldGain} Gold`, 'death');
        
        // Death effects
        this.effectsManager.createDeathEffect(enemy);
        
        if (this.playerExp >= this.playerExpToNext) {
            this.levelUp();
        }
        
        const index = this.enemies.indexOf(enemy);
        if (index > -1) {
            this.enemies.splice(index, 1);
        }
    }

    handlePetDeath(pet) {
        this.logMessage('Your companion has fallen in battle!', 'death');
        
        // Clear the pet reference and timer
        if (this.playerPet === pet) {
            this.playerPet = null;
        }
        
        if (this.petTimer) {
            clearTimeout(this.petTimer);
            this.petTimer = null;
        }
        
        // Death effects
        this.effectsManager.createDeathEffect(pet);
    }

    handlePlayerDeath() {
        this.logMessage('Hero has fallen! Respawning at safe area...', 'death');
        
        // Respawn player near merchant (safe area)
        const playerTransform = this.player.getComponent('Transform');
        const health = this.player.getComponent('Health');
        const mana = this.player.getComponent('Mana');
        
        // Move player to safe area near merchant
        playerTransform.x = window.innerWidth / 2 + 150;
        playerTransform.y = window.innerHeight / 2 - 80;
        
        // Restore health and mana
    health.currentHealth = health.maxHealth;
    // Mark player as alive again so engine systems stop treating them as dead
    health.isDead = false;
        mana.currentMana = mana.maxMana;
        
        // Add respawn effects
        this.effectsManager.createExplosion(playerTransform.x, playerTransform.y, 'large');
        this.effectsManager.createLevelUpEffect(this.player);
        
        // Small penalty: lose some gold
        const inventory = this.player.getComponent('Inventory');
        const goldLoss = Math.floor(inventory.gold * 0.1); // Lose 10% of gold
        inventory.gold = Math.max(0, inventory.gold - goldLoss);
        
        if (goldLoss > 0) {
            this.logMessage(`Lost ${goldLoss} gold in the respawn process.`, 'damage');
        }
        
        this.logMessage('Hero has been revived! Fight on!', 'spawn');
    }

    levelUp() {
        this.playerLevel++;
        this.playerExp -= this.playerExpToNext;
        this.playerExpToNext = Math.floor(this.playerExpToNext * 1.5);
        
        const health = this.player.getComponent('Health');
        const combat = this.player.getComponent('Combat');
        const mana = this.player.getComponent('Mana');
        
        health.maxHealth += 20;
        health.currentHealth = health.maxHealth;
        combat.damage += 5;
        mana.maxMana += 10;
        mana.currentMana = mana.maxMana;
        
        this.logMessage(`LEVEL UP! Now level ${this.playerLevel}!`, 'spawn');
        this.effectsManager.createLevelUpEffect(this.player);
    }



    populateWorld() {
        this.logMessage('Welcome to Enhanced Grinder RPG!', 'spawn');
        this.logMessage('Click to move, click enemies to attack, click NPCs to interact!', 'spawn');
        this.logMessage('Explore the world - enemy groups are scattered across the land!', 'spawn');
        
        // Define world size (much larger than screen)
        const worldWidth = 3000;
        const worldHeight = 2000;
        const playerX = window.innerWidth / 2;
        const playerY = window.innerHeight / 2;
        const merchantX = playerX + 200;
        const merchantY = playerY - 100;
        
        // Create enemy groups scattered across the world
        const numGroups = 15; // Number of enemy groups
        
        for (let group = 0; group < numGroups; group++) {
            // Find a location for this group, avoiding safe areas
            let groupX, groupY, attempts = 0;
            do {
                groupX = Math.random() * worldWidth - worldWidth/2 + playerX;
                groupY = Math.random() * worldHeight - worldHeight/2 + playerY;
                attempts++;
            } while (attempts < 20 && (
                Math.sqrt(Math.pow(groupX - playerX, 2) + Math.pow(groupY - playerY, 2)) < 300 || // Away from player
                Math.sqrt(Math.pow(groupX - merchantX, 2) + Math.pow(groupY - merchantY, 2)) < 250 // Away from merchant
            ));
            
            // Create a group of 2-4 enemies
            const groupSize = 2 + Math.floor(Math.random() * 3);
            const groupType = this.getGroupType(group);
            
            for (let i = 0; i < groupSize; i++) {
                // Spread enemies within the group
                const offsetX = (Math.random() - 0.5) * 150;
                const offsetY = (Math.random() - 0.5) * 150;
                
                const enemyX = groupX + offsetX;
                const enemyY = groupY + offsetY;
                
                const enemyType = this.getEnemyFromGroup(groupType);
                console.log(`Creating group ${group} enemy ${i}: ${enemyType} at (${enemyX}, ${enemyY})`);
                this.createEnemy(enemyX, enemyY, enemyType);
            }
        }
    }
    
    getGroupType(groupIndex) {
        // Define different group types with thematic enemies
        const groupTypes = [
            'wolfPack',      // Wolves and wolf pups
            'bandits',       // Human bandits and veterans
            'darkCoven',     // Dark mages and fallen knights
            'rogues',        // Archers and rogues
            'mixed'          // Mixed group
        ];
        return groupTypes[groupIndex % groupTypes.length];
    }
    
    getEnemyFromGroup(groupType) {
        const groupCompositions = {
            wolfPack: ['wolf', 'wolfPup', 'direwolf'],
            bandits: ['bandit', 'veteranBandit'],
            darkCoven: ['darkMage', 'fallenKnight', 'archMage'],
            rogues: ['rogueArcher', 'masterArcher'],
            mixed: ['wolf', 'bandit', 'darkMage', 'rogueArcher', 'fallenKnight']
        };
        
        const enemies = groupCompositions[groupType] || groupCompositions.mixed;
        return enemies[Math.floor(Math.random() * enemies.length)];
    }

    // Removed flashEntity - now handled by effectsManager

    createGoldDrop(x, y, amount) {
        // Create floating gold text
        this.effectsManager.showFloatingGold(x, y, amount);
        
        // Create golden particles
        for (let i = 0; i < 6; i++) {
            this.engine.particleSystem.particles.push({
                x: x + (Math.random() - 0.5) * 20,
                y: y + (Math.random() - 0.5) * 20,
                vx: (Math.random() - 0.5) * 80,
                vy: -40 - Math.random() * 40,
                gravity: 100,
                size: 2 + Math.random() * 2,
                color: '#ffd700',
                life: 1.5,
                maxLife: 1.5,
                alpha: 1
            });
        }
    }

    summonPet() {
        // Remove existing pet if any
        if (this.playerPet && !this.playerPet.getComponent('Health').isDead) {
            this.engine.removeEntity(this.playerPet.id);
        }

        // Clear existing timer
        if (this.petTimer) {
            clearTimeout(this.petTimer);
        }

        // Create pet near player
        const playerTransform = this.player.getComponent('Transform');
        const petX = playerTransform.x + 50 + Math.random() * 40 - 20;
        const petY = playerTransform.y + 50 + Math.random() * 40 - 20;

        this.playerPet = new Entity('pet');
        
        this.playerPet
            .addComponent(new Transform(petX, petY))
            .addComponent(new Health(60))
            .addComponent(new Combat(20, 50, 1.0))
            .addComponent(new Movement(100))
            .addComponent(new AI('pet', 200)) // Special pet AI type
            .addComponent(new Renderable('knight', 16, 16, 2, 6)) // Smaller knight as pet
            .addComponent(new Collider(18));

        this.engine.addEntity(this.playerPet);
        
        // Add pet health bar
        const healthBar = new HealthBar(this.playerPet, 0, -30);
        this.engine.uiSystem.addElement(healthBar);

        // Pet disappears after 45 seconds
        this.petTimer = setTimeout(() => {
            if (this.playerPet && !this.playerPet.getComponent('Health').isDead) {
                this.logMessage('Your companion returns to the spirit realm.', 'spawn');
                this.effectsManager.createExplosion(
                    this.playerPet.getComponent('Transform').x,
                    this.playerPet.getComponent('Transform').y,
                    'large'
                );
                this.engine.removeEntity(this.playerPet.id);
                this.playerPet = null;
            }
        }, 45000); // 45 seconds

        this.logMessage('A loyal knight companion appears!', 'spawn');
    }

    logMessage(message, type = 'normal') {
        this.uiManager.logMessage(message, type);
    }
}