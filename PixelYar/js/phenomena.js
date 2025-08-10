// phenomena.js - Chaotic random sea phenomena
import { CONFIG } from './config.js';

export class PhenomenaManager {
  constructor(worldManager) {
    this.worldManager = worldManager;
    this.phenomena = [];
    this.phenomenaIdCounter = 1;
    this.lastPhenomenaUpdate = 0;
    this.phenomenaUpdateInterval = 200; // Update every 200ms
    this.lastPhenomenaSpawn = 0;
    this.phenomenaSpawnInterval = 8000; // Spawn new phenomena every 8 seconds
    this.affectedShips = new Map(); // Track ships affected by phenomena

    this.initializePhenomena();
  }

  initializePhenomena() {
    // Create initial phenomena scattered across the ocean
    const initialCount = 6;
    for (let i = 0; i < initialCount; i++) {
      const phenomenon = this.createRandomPhenomenon();
      this.phenomena.push(phenomenon);
    }

  }

  createRandomPhenomenon() {
    // Random position anywhere in the ocean
    let x, y;
    let attempts = 0;
    
    do {
      x = Math.floor(Math.random() * CONFIG.OCEAN_WIDTH);
      y = Math.floor(Math.random() * CONFIG.OCEAN_HEIGHT);
      attempts++;
    } while (!this.worldManager.isValidPosition(x, y) && attempts < 100);

    // If we couldn't find a valid position, place at a default location
    if (attempts >= 100) {
      x = Math.floor(CONFIG.OCEAN_WIDTH / 2);
      y = Math.floor(CONFIG.OCEAN_HEIGHT / 2);
    }

    const phenomenaTypes = ['ufo', 'vortex', 'portal', 'siren', 'dolphin', 'storm'];
    const type = phenomenaTypes[Math.floor(Math.random() * phenomenaTypes.length)];

    return {
      id: `phenomenon_${this.phenomenaIdCounter++}`,
      type: type,
      x: x,
      y: y,
      radius: this.getPhenomenonRadius(type),
      intensity: Math.random() * 0.5 + 0.5, // 0.5 to 1.0
      duration: this.getPhenomenonDuration(type),
      maxDuration: this.getPhenomenonDuration(type),
      animationPhase: Math.random() * Math.PI * 2,
      moveSpeed: this.getPhenomenonMoveSpeed(type),
      moveDirection: { dx: (Math.random() - 0.5) * 2, dy: (Math.random() - 0.5) * 2 },
      lastEffect: 0,
      effectCooldown: this.getPhenomenonEffectCooldown(type),
      isActive: true,
      spawnTime: Date.now(),
      // Portal-specific properties
      linkedPortal: null,
      // Vortex-specific properties
      trappedShips: new Set(),
      // Storm-specific properties
      lightningTimer: 0
    };
  }

  getPhenomenonRadius(type) {
    const baseRadius = {
      ufo: 25,
      vortex: 30,
      portal: 20,
      siren: 35,
      dolphin: 15,
      storm: 50
    };
    return baseRadius[type] || 25;
  }

  getPhenomenonDuration(type) {
    const baseDuration = {
      ufo: 30000,      // 30 seconds
      vortex: 45000,   // 45 seconds
      portal: 60000,   // 60 seconds
      siren: 25000,    // 25 seconds
      dolphin: 20000,  // 20 seconds
      storm: 40000     // 40 seconds
    };
    return baseDuration[type] || 30000;
  }

  getPhenomenonMoveSpeed(type) {
    const baseSpeed = {
      ufo: 0.3,
      vortex: 0.1,
      portal: 0,      // Portals don't move
      siren: 0.2,
      dolphin: 0.8,
      storm: 0.15
    };
    return baseSpeed[type] || 0.2;
  }

  getPhenomenonEffectCooldown(type) {
    const baseCooldown = {
      ufo: 3000,
      vortex: 1000,
      portal: 2000,
      siren: 4000,
      dolphin: 5000,
      storm: 2500
    };
    return baseCooldown[type] || 3000;
  }

  updatePhenomenaRealtime() {
    const now = Date.now();
    if (now - this.lastPhenomenaUpdate < this.phenomenaUpdateInterval) return;

    this.lastPhenomenaUpdate = now;

    // Update each phenomenon
    for (let i = this.phenomena.length - 1; i >= 0; i--) {
      const phenomenon = this.phenomena[i];
      this.updatePhenomenonRealtime(phenomenon);
      
      // Remove expired phenomena
      if (phenomenon.duration <= 0) {
        this.removePhenomenon(phenomenon);
        this.phenomena.splice(i, 1);
      }
    }

    // Spawn new phenomena periodically
    if (now - this.lastPhenomenaSpawn > this.phenomenaSpawnInterval) {
      this.spawnNewPhenomenon();
      this.lastPhenomenaSpawn = now;
    }
  }

  updatePhenomenonRealtime(phenomenon) {
    const now = Date.now();
    
    // Update duration
    phenomenon.duration -= this.phenomenaUpdateInterval;
    
    // Update animation phase
    phenomenon.animationPhase += 0.05;
    if (phenomenon.animationPhase > Math.PI * 2) {
      phenomenon.animationPhase = 0;
    }

    // Move phenomenon if it has movement
    if (phenomenon.moveSpeed > 0) {
      this.movePhenomenon(phenomenon);
    }

    // Apply effects to nearby ships
    if (now - phenomenon.lastEffect > phenomenon.effectCooldown) {
      this.applyPhenomenonEffects(phenomenon);
      phenomenon.lastEffect = now;
    }

    // Special updates per type
    this.updateSpecialEffects(phenomenon);
  }

  movePhenomenon(phenomenon) {
    const newX = phenomenon.x + phenomenon.moveDirection.dx * phenomenon.moveSpeed;
    const newY = phenomenon.y + phenomenon.moveDirection.dy * phenomenon.moveSpeed;

    // Bounce off boundaries
    if (newX < phenomenon.radius || newX > CONFIG.OCEAN_WIDTH - phenomenon.radius) {
      phenomenon.moveDirection.dx *= -1;
    }
    if (newY < phenomenon.radius || newY > CONFIG.OCEAN_HEIGHT - phenomenon.radius) {
      phenomenon.moveDirection.dy *= -1;
    }

    // Update position
    phenomenon.x = Math.max(phenomenon.radius, Math.min(CONFIG.OCEAN_WIDTH - phenomenon.radius, newX));
    phenomenon.y = Math.max(phenomenon.radius, Math.min(CONFIG.OCEAN_HEIGHT - phenomenon.radius, newY));

    // Occasionally change direction
    if (Math.random() < 0.02) {
      phenomenon.moveDirection.dx = (Math.random() - 0.5) * 2;
      phenomenon.moveDirection.dy = (Math.random() - 0.5) * 2;
    }
  }

  applyPhenomenonEffects(phenomenon) {
    const nearbyShips = this.findNearbyShips(phenomenon);
    
    for (const ship of nearbyShips) {
      this.applyEffectToShip(phenomenon, ship);
    }
  }

  findNearbyShips(phenomenon) {
    const ships = [];
    
    // Add player if nearby
    if (window.game && window.game.currentPlayer) {
      const player = window.game.currentPlayer;
      const distance = this.getDistance(phenomenon, player);
      if (distance <= phenomenon.radius) {
        ships.push(player);
      }
    }
    
    // Add AI ships if nearby
    if (window.game && window.game.aiShips) {
      const aiShips = window.game.aiShips.getAIShips();
      for (const ship of aiShips) {
        const distance = this.getDistance(phenomenon, ship);
        if (distance <= phenomenon.radius) {
          ships.push(ship);
        }
      }
    }
    
    return ships;
  }

  applyEffectToShip(phenomenon, ship) {
    const isPlayer = ship.id === (window.game?.currentPlayer?.id);
    
    switch (phenomenon.type) {
      case 'ufo':
        this.applyUFOEffect(phenomenon, ship, isPlayer);
        break;
      case 'vortex':
        this.applyVortexEffect(phenomenon, ship, isPlayer);
        break;
      case 'portal':
        this.applyPortalEffect(phenomenon, ship, isPlayer);
        break;
      case 'siren':
        this.applySirenEffect(phenomenon, ship, isPlayer);
        break;
      case 'dolphin':
        this.applyDolphinEffect(phenomenon, ship, isPlayer);
        break;
      case 'storm':
        this.applyStormEffect(phenomenon, ship, isPlayer);
        break;
    }
  }

  applyUFOEffect(phenomenon, ship, isPlayer) {
    // UFO abducts crew or gives alien technology
    if (Math.random() < 0.3) {
      if (Math.random() < 0.6) {
        // Abduct crew
        const crewLost = Math.min(2, ship.crew);
        ship.crew = Math.max(0, ship.crew - crewLost);
        if (isPlayer && window.game) {
          // Don't add to interaction history - phenomena are silent
          window.game.ui.showInventoryNotification('👽 Alien Abduction!', 'error');
        }
      } else {
        // Give alien tech (gold)
        if (isPlayer && window.game) {
          window.game.inventory.addItem('Gold Coins', 15);
          // Don't add to interaction history - phenomena are silent
          window.game.ui.showInventoryNotification('👽 Alien Technology!', 'success');
        }
      }
    }
  }

  applyVortexEffect(phenomenon, ship, isPlayer) {
    // Vortex traps ships and damages them
    phenomenon.trappedShips.add(ship.id);
    
    // Pull ship toward center
    const dx = phenomenon.x - ship.x;
    const dy = phenomenon.y - ship.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    if (distance > 5) {
      const pullStrength = 0.3;
      ship.x += (dx / distance) * pullStrength;
      ship.y += (dy / distance) * pullStrength;
    }
    
    // Damage ship
    const damage = Math.floor(Math.random() * 8) + 2;
    ship.hull = Math.max(0, ship.hull - damage);
    
    if (isPlayer && window.game) {
      // Don't add to interaction history - phenomena are silent
      if (Math.random() < 0.1) {
        window.game.ui.showInventoryNotification('🌪️ Trapped in Vortex!', 'error');
      }
    }
  }

  applyPortalEffect(phenomenon, ship, isPlayer) {
    // Portal teleports ships to another location
    if (Math.random() < 0.2) {
      // Find or create a destination
      let destination = this.findPortalDestination(phenomenon);
      
      if (!destination) {
        // Create a new portal as destination
        destination = {
          x: Math.floor(Math.random() * CONFIG.OCEAN_WIDTH),
          y: Math.floor(Math.random() * CONFIG.OCEAN_HEIGHT)
        };
      }
      
      // Teleport ship
      ship.x = destination.x;
      ship.y = destination.y;
      
      if (isPlayer && window.game) {
        // Don't add to interaction history - phenomena are silent
        window.game.ui.showInventoryNotification('🌀 Teleported!', 'success');
      }
    }
  }

  applySirenEffect(phenomenon, ship, isPlayer) {
    // Sirens lure ships and cause confusion
    if (Math.random() < 0.4) {
      // Lure ship toward siren
      const dx = phenomenon.x - ship.x;
      const dy = phenomenon.y - ship.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance > 3) {
        const lureStrength = 0.2;
        ship.x += (dx / distance) * lureStrength;
        ship.y += (dy / distance) * lureStrength;
      }
      
      // Cause crew confusion (lose crew or hull)
      if (Math.random() < 0.3) {
        if (Math.random() < 0.5) {
          ship.crew = Math.max(0, ship.crew - 1);
          if (isPlayer && window.game) {
            // Don't add to interaction history - phenomena are silent
          }
        } else {
          ship.hull = Math.max(0, ship.hull - 5);
          if (isPlayer && window.game) {
            // Don't add to interaction history - phenomena are silent
          }
        }
      }
    }
  }

  applyDolphinEffect(phenomenon, ship, isPlayer) {
    // Dolphins help ships with repairs and guidance
    if (Math.random() < 0.5) {
      if (Math.random() < 0.7) {
        // Repair hull
        const repair = Math.floor(Math.random() * 8) + 3;
        ship.hull = Math.min(100, ship.hull + repair);
        if (isPlayer && window.game) {
          // Don't add to interaction history - phenomena are silent
          window.game.ui.showInventoryNotification('🐬 Dolphin Assistance!', 'success');
        }
      } else {
        // Add crew (dolphins guide lost sailors to you)
        ship.crew += 1;
        if (isPlayer && window.game) {
          // Don't add to interaction history - phenomena are silent
        }
      }
    }
  }

  applyStormEffect(phenomenon, ship, isPlayer) {
    // Storms damage ships but can also provide benefits
    if (Math.random() < 0.6) {
      if (Math.random() < 0.8) {
        // Lightning damage
        const damage = Math.floor(Math.random() * 12) + 5;
        ship.hull = Math.max(0, ship.hull - damage);
        if (isPlayer && window.game) {
          // Don't add to interaction history - phenomena are silent
          if (Math.random() < 0.2) {
            window.game.ui.showInventoryNotification('⚡ Lightning Strike!', 'error');
          }
        }
      } else {
        // Storm winds push ship (can be beneficial for travel)
        const pushX = (Math.random() - 0.5) * 10;
        const pushY = (Math.random() - 0.5) * 10;
        
        const newX = Math.max(0, Math.min(CONFIG.OCEAN_WIDTH, ship.x + pushX));
        const newY = Math.max(0, Math.min(CONFIG.OCEAN_HEIGHT, ship.y + pushY));
        
        if (this.worldManager.isValidPosition(newX, newY)) {
          ship.x = newX;
          ship.y = newY;
          if (isPlayer && window.game) {
            // Don't add to interaction history - phenomena are silent
          }
        }
      }
    }
  }

  updateSpecialEffects(phenomenon) {
    switch (phenomenon.type) {
      case 'storm':
        // Update lightning timer
        phenomenon.lightningTimer += this.phenomenaUpdateInterval;
        if (phenomenon.lightningTimer > 3000) {
          phenomenon.lightningTimer = 0;
        }
        break;
      case 'vortex':
        // Release trapped ships occasionally
        if (Math.random() < 0.05) {
          phenomenon.trappedShips.clear();
        }
        break;
    }
  }

  findPortalDestination(portal) {
    // Find another portal to link to
    for (const phenomenon of this.phenomena) {
      if (phenomenon.type === 'portal' && phenomenon.id !== portal.id) {
        return { x: phenomenon.x, y: phenomenon.y };
      }
    }
    return null;
  }

  spawnNewPhenomenon() {
    if (this.phenomena.length >= 10) return; // Maximum 10 phenomena
    
    const newPhenomenon = this.createRandomPhenomenon();
    this.phenomena.push(newPhenomenon);
    
    if (window.game) {
      const messages = {
        ufo: '🛸 A UFO appears in the sky!',
        vortex: '🌪️ A dangerous vortex forms in the water!',
        portal: '🌀 A mysterious portal opens!',
        siren: '🧜‍♀️ Enchanting siren song echoes across the waves!',
        dolphin: '🐬 A pod of dolphins appears!',
        storm: '⛈️ Storm clouds gather on the horizon!'
      };
      
      // Don't add to interaction history - phenomena are silent
    }
  }

  removePhenomenon(phenomenon) {
    // Clean up any effects
    if (phenomenon.type === 'vortex') {
      phenomenon.trappedShips.clear();
    }
    
    if (window.game) {
      const messages = {
        ufo: '🛸 The UFO vanishes into the sky!',
        vortex: '🌪️ The vortex dissipates!',
        portal: '🌀 The portal closes!',
        siren: '🧜‍♀️ The siren song fades away!',
        dolphin: '🐬 The dolphins swim away!',
        storm: '⛈️ The storm passes!'
      };
      
      // Don't add to interaction history - phenomena are silent
    }
  }

  getDistance(entity1, entity2) {
    const dx = entity1.x - entity2.x;
    const dy = entity1.y - entity2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getPhenomena() {
    return this.phenomena;
  }

  // Check if a ship is trapped in a vortex
  isShipTrapped(shipId) {
    for (const phenomenon of this.phenomena) {
      if (phenomenon.type === 'vortex' && phenomenon.trappedShips.has(shipId)) {
        return true;
      }
    }
    return false;
  }

  // Get phenomenon at position for collision detection
  getPhenomenonAt(x, y, radius = 5) {
    for (const phenomenon of this.phenomena) {
      const distance = this.getDistance(phenomenon, { x, y });
      if (distance <= radius + phenomenon.radius / 2) {
        return phenomenon;
      }
    }
    return null;
  }
}
