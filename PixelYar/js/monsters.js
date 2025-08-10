// monsters.js - Sea monsters that roam the red sea areas
import { CONFIG } from './config.js';

export class MonsterManager {
  constructor(worldManager) {
    this.worldManager = worldManager;
    this.monsters = [];
    this.monsterIdCounter = 1;
    this.lastMonsterUpdate = 0;
    this.monsterUpdateInterval = 150; // Update monsters every 150ms
    this.lastMonsterSpawn = 0;
    this.monsterSpawnInterval = 10000; // Spawn new monster every 10 seconds

    this.initializeMonsters();
  }

  initializeMonsters() {
    // Create initial monsters in red sea
    const initialMonsterCount = 8;
    for (let i = 0; i < initialMonsterCount; i++) {
      const monster = this.createMonster();
      this.monsters.push(monster);
    }

    console.log(`Initialized ${this.monsters.length} sea monsters in the red sea`);
  }

  createMonster() {
    // Spawn only in red sea area
    let x, y;
    let attempts = 0;
    
    do {
      x = CONFIG.RED_SEA.START_X + Math.floor(Math.random() * (CONFIG.OCEAN_WIDTH - CONFIG.RED_SEA.START_X));
      y = Math.floor(Math.random() * CONFIG.OCEAN_HEIGHT);
      attempts++;
    } while (!this.worldManager.isValidPosition(x, y) && attempts < 100);

    // If we couldn't find a valid position, place at a default red sea location
    if (attempts >= 100) {
      x = CONFIG.RED_SEA.START_X + 200;
      y = Math.floor(CONFIG.OCEAN_HEIGHT / 2);
    }

    const monsterTypes = ['shark', 'kraken', 'giant_squid', 'poseidon'];
    const type = monsterTypes[Math.floor(Math.random() * monsterTypes.length)];

    return {
      id: `monster_${this.monsterIdCounter++}`,
      type: type,
      x: x,
      y: y,
      health: this.getMonsterHealth(type),
      maxHealth: this.getMonsterHealth(type),
      damage: this.getMonsterDamage(type),
      speed: this.getMonsterSpeed(type),
      size: this.getMonsterSize(type),
      moveDirection: { dx: 0, dy: 0 },
      lastMove: Date.now(),
      lastBehaviorUpdate: Date.now(),
      behaviorState: 'roaming', // roaming, hunting, attacking, fleeing
      target: null,
      aggressionRange: this.getMonsterAggressionRange(type),
      lastAttack: 0,
      attackCooldown: this.getMonsterAttackCooldown(type),
      isLegendary: type === 'poseidon' || (Math.random() < 0.1), // 10% chance for legendary variants
      spawnTime: Date.now()
    };
  }

  getMonsterHealth(type) {
    const baseHealth = {
      shark: 80,
      kraken: 200,
      giant_squid: 150,
      poseidon: 500
    };
    return baseHealth[type] || 100;
  }

  getMonsterDamage(type) {
    const baseDamage = {
      shark: 25,
      kraken: 40,
      giant_squid: 35,
      poseidon: 60
    };
    return baseDamage[type] || 30;
  }

  getMonsterSpeed(type) {
    const baseSpeed = {
      shark: 0.8,
      kraken: 0.3,
      giant_squid: 0.5,
      poseidon: 0.4
    };
    return baseSpeed[type] || 0.5;
  }

  getMonsterSize(type) {
    const baseSize = {
      shark: 8,
      kraken: 20,
      giant_squid: 15,
      poseidon: 25
    };
    return baseSize[type] || 10;
  }

  getMonsterAggressionRange(type) {
    const baseRange = {
      shark: 30,
      kraken: 50,
      giant_squid: 40,
      poseidon: 60
    };
    return baseRange[type] || 35;
  }

  getMonsterAttackCooldown(type) {
    const baseCooldown = {
      shark: 2000,
      kraken: 4000,
      giant_squid: 3000,
      poseidon: 5000
    };
    return baseCooldown[type] || 3000;
  }

  updateMonstersRealtime() {
    const now = Date.now();
    if (now - this.lastMonsterUpdate < this.monsterUpdateInterval) return;

    this.lastMonsterUpdate = now;

    // Update each monster
    for (const monster of this.monsters) {
      this.updateMonsterRealtime(monster);
    }

    // Spawn new monsters periodically
    if (now - this.lastMonsterSpawn > this.monsterSpawnInterval) {
      this.spawnNewMonster();
      this.lastMonsterSpawn = now;
    }

    // Remove dead monsters
    this.monsters = this.monsters.filter(monster => monster.health > 0);
  }

  updateMonsterRealtime(monster) {
    const now = Date.now();

    // Update behavior less frequently (every 2 seconds)
    if (now - monster.lastBehaviorUpdate > 2000) {
      this.updateMonsterBehavior(monster);
      monster.lastBehaviorUpdate = now;
    }

    // Move monster based on current behavior
    this.moveMonsterRealtime(monster);
  }

  updateMonsterBehavior(monster) {
    // Find potential targets (player and AI ships in red sea)
    const targets = this.findNearbyTargets(monster);
    
    if (targets.length > 0) {
      // Find closest target
      let closestTarget = null;
      let closestDistance = Infinity;
      
      for (const target of targets) {
        const distance = this.getDistance(monster, target);
        if (distance < closestDistance) {
          closestTarget = target;
          closestDistance = distance;
        }
      }
      
      if (closestDistance <= monster.aggressionRange) {
        monster.behaviorState = 'hunting';
        monster.target = closestTarget;
      } else {
        monster.behaviorState = 'roaming';
        monster.target = null;
      }
    } else {
      monster.behaviorState = 'roaming';
      monster.target = null;
    }

    // Set movement direction based on behavior
    switch (monster.behaviorState) {
      case 'roaming':
        this.setRoamingDirection(monster);
        break;
      case 'hunting':
        this.setHuntingDirection(monster);
        break;
    }
  }

  findNearbyTargets(monster) {
    const targets = [];
    
    // Add player if in red sea
    if (window.game && window.game.currentPlayer) {
      const player = window.game.currentPlayer;
      if (player.x >= CONFIG.RED_SEA.START_X) {
        targets.push(player);
      }
    }
    
    // Add AI ships in red sea
    if (window.game && window.game.aiShips) {
      const aiShips = window.game.aiShips.getAIShips();
      for (const ship of aiShips) {
        if (ship.x >= CONFIG.RED_SEA.START_X) {
          targets.push(ship);
        }
      }
    }
    
    return targets;
  }

  setRoamingDirection(monster) {
    // Random movement with some persistence, but stay in red sea
    if (Math.random() < 0.3 || (monster.moveDirection.dx === 0 && monster.moveDirection.dy === 0)) {
      const directions = [
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -0.7, dy: -0.7 }, { dx: 0.7, dy: -0.7 }, { dx: -0.7, dy: 0.7 }, { dx: 0.7, dy: 0.7 }
      ];
      monster.moveDirection = directions[Math.floor(Math.random() * directions.length)];
    }
  }

  setHuntingDirection(monster) {
    if (!monster.target) {
      this.setRoamingDirection(monster);
      return;
    }

    // Move toward target
    const dx = monster.target.x - monster.x;
    const dy = monster.target.y - monster.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance > 0) {
      monster.moveDirection = { dx: dx / distance, dy: dy / distance };
      
      // Attack if close enough
      if (distance <= monster.size && Date.now() - monster.lastAttack > monster.attackCooldown) {
        this.monsterAttack(monster, monster.target);
      }
    }
  }

  moveMonsterRealtime(monster) {
    // Apply movement based on direction and speed
    const newX = monster.x + monster.moveDirection.dx * monster.speed;
    const newY = monster.y + monster.moveDirection.dy * monster.speed;

    // Keep monsters in red sea area
    const minX = CONFIG.RED_SEA.START_X + monster.size;
    const maxX = CONFIG.OCEAN_WIDTH - monster.size;
    const minY = monster.size;
    const maxY = CONFIG.OCEAN_HEIGHT - monster.size;

    // Check bounds and collisions
    if (this.isValidMonsterPosition(newX, newY, monster) && 
        newX >= minX && newX <= maxX && newY >= minY && newY <= maxY) {
      monster.x = newX;
      monster.y = newY;
    } else {
      // Change direction when hitting obstacles or boundaries
      this.setRoamingDirection(monster);
    }
  }

  isValidMonsterPosition(x, y, monster) {
    // Check world collisions (monsters can overlap islands slightly)
    return this.worldManager.isValidPosition(Math.round(x), Math.round(y));
  }

  monsterAttack(monster, target) {
    monster.lastAttack = Date.now();
    
    const damage = monster.damage + Math.floor(Math.random() * 10) - 5; // ±5 damage variation
    
    if (window.game) {
      if (target.id === window.game.currentPlayer.id) {
        // Attack player
        target.hull = Math.max(0, target.hull - damage);
        window.game.addToInteractionHistory(`🦈 ${this.getMonsterName(monster)} attacks you for ${damage} damage!`);
        
        if (target.hull <= 0) {
          window.game.addToInteractionHistory(`💀 You have been devoured by ${this.getMonsterName(monster)}!`);
          window.game.player.updateStat('combatLosses', 1);
        }
      } else if (target.isAI) {
        // Attack AI ship
        target.hull = Math.max(0, target.hull - damage);
        // Monster attacks AI ship silently
      }
    }
  }

  getMonsterName(monster) {
    const names = {
      shark: monster.isLegendary ? 'Legendary Great White' : 'Shark',
      kraken: monster.isLegendary ? 'Ancient Kraken' : 'Kraken',
      giant_squid: monster.isLegendary ? 'Colossal Squid' : 'Giant Squid',
      poseidon: 'Poseidon, God of the Seas'
    };
    return names[monster.type] || 'Sea Monster';
  }

  spawnNewMonster() {
    if (this.monsters.length >= 12) return; // Maximum 12 monsters
    
    const newMonster = this.createMonster();
    this.monsters.push(newMonster);
    
    if (window.game) {
      window.game.addToInteractionHistory(`🌊 ${this.getMonsterName(newMonster)} emerges from the depths!`);
    }
  }

  getDistance(entity1, entity2) {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getMonsters() {
    return this.monsters;
  }

  // Handle monster taking damage from cannon balls
  damageMonster(monsterId, damage) {
    const monster = this.monsters.find(m => m.id === monsterId);
    if (!monster) return false;

    monster.health = Math.max(0, monster.health - damage);
    
    if (window.game) {
      window.game.addToInteractionHistory(`💥 ${this.getMonsterName(monster)} takes ${damage} damage!`);
      
      if (monster.health <= 0) {
        window.game.addToInteractionHistory(`🏆 ${this.getMonsterName(monster)} has been slain!`);
        
        // Award XP and loot based on monster type
        const xpReward = {
          shark: 150,
          kraken: 400,
          giant_squid: 300,
          poseidon: 1000
        };
        
        const lootReward = {
          shark: 25,
          kraken: 75,
          giant_squid: 50,
          poseidon: 200
        };
        
        window.game.player.addXP(xpReward[monster.type] || 100, `Slayed ${this.getMonsterName(monster)}!`);
        
        const loot = lootReward[monster.type] || 30;
        window.game.inventory.addItem('Gold Coins', loot);
        window.game.ui.showInventoryNotification(`💰 Looted ${loot} gold from ${this.getMonsterName(monster)}!`, 'success');
        
        // Legendary monsters drop special items
        if (monster.isLegendary || monster.type === 'poseidon') {
          window.game.inventory.addItem('Pearls', 5);
          window.game.inventory.addItem('Lucky Charm', 1);
          window.game.ui.showInventoryNotification(`✨ Found legendary treasure!`, 'success');
        }
      }
    }
    
    return monster.health <= 0;
  }

  // Get monster at position for collision detection
  getMonsterAt(x, y, radius = 5) {
    for (const monster of this.monsters) {
      const distance = this.getDistance(monster, { x, y });
      if (distance <= radius + monster.size / 2) {
        return monster;
      }
    }
    return null;
  }
}