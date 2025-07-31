// ai-ships.js - AI enemy ships that sail around autonomously
import { CONFIG } from './config.js';

export class AIShipManager {
  constructor(worldManager, randomInteractions) {
    this.worldManager = worldManager;
    this.randomInteractions = randomInteractions;
    this.aiShips = [];
    this.shipIdCounter = 1;
    this.lastAIUpdate = 0;
    this.aiUpdateInterval = 100; // Update AI ships every 100ms for smooth movement

    this.initializeAIShips();
  }

  initializeAIShips() {
    // Create 3-5 AI enemy ships
    const numShips = Math.floor(Math.random() * 3) + 3;

    for (let i = 0; i < numShips; i++) {
      const ship = this.createAIShip();
      this.aiShips.push(ship);
    }
  }

  createAIShip() {
    // Find a valid spawn position
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

    return {
      id: `ai_ship_${this.shipIdCounter++}`,
      x: x,
      y: y,
      hull: 80 + Math.floor(Math.random() * 40), // 80-120 hull
      crew: 8 + Math.floor(Math.random() * 8), // 8-16 crew
      booty: Math.floor(Math.random() * 20), // 0-20 booty
      color: '#000000', // Black ships for enemies
      email: `AI_Pirate_${this.shipIdCounter - 1}@blackflag.sea`,
      isAI: true,
      lastMove: Date.now(),
      lastBehaviorUpdate: Date.now(),
      moveDirection: { dx: 0, dy: 0 },
      behaviorState: 'wandering', // wandering, hunting, fleeing, repairing
      target: null,
      repairCooldown: 0,
      aggressionLevel: Math.random() * 0.8 + 0.2 // 0.2 to 1.0
    };
  }

  updateAIShipsRealtime() {
    const now = Date.now();
    if (now - this.lastAIUpdate < this.aiUpdateInterval) return;

    this.lastAIUpdate = now;

    for (const ship of this.aiShips) {
      this.updateAIShipRealtime(ship);
    }
  }

  updateAIShipRealtime(ship) {
    const now = Date.now();

    // Update behavior less frequently (every 3 seconds)
    if (now - ship.lastBehaviorUpdate > 3000) {
      this.updateAIBehavior(ship);
      ship.lastBehaviorUpdate = now;
    }

    // Move ship based on current behavior
    this.moveAIShipRealtime(ship);
  }

  updateAIBehavior(ship) {
    // Decrease repair cooldown
    if (ship.repairCooldown > 0) {
      ship.repairCooldown--;
    }

    // Determine behavior based on hull condition
    if (ship.hull < 30 && ship.repairCooldown === 0) {
      ship.behaviorState = 'repairing';
    } else if (ship.hull < 50) {
      ship.behaviorState = 'fleeing';
    } else if (Math.random() < ship.aggressionLevel * 0.3) {
      ship.behaviorState = 'hunting';
    } else {
      ship.behaviorState = 'wandering';
    }

    // Set movement direction based on behavior
    switch (ship.behaviorState) {
      case 'repairing':
        ship.moveDirection = { dx: 0, dy: 0 };
        this.repairAIShip(ship);
        break;
      case 'wandering':
        this.setWanderDirection(ship);
        break;
      case 'hunting':
        this.setHuntDirection(ship);
        break;
      case 'fleeing':
        this.setFleeDirection(ship);
        break;
    }
  }

  moveAIShipRealtime(ship) {
    if (ship.behaviorState === 'repairing') return;

    // Apply movement based on direction
    const speed = 0.3; // Slightly slower than player
    const newX = ship.x + ship.moveDirection.dx * speed;
    const newY = ship.y + ship.moveDirection.dy * speed;

    // Check bounds and collisions
    if (this.isValidAIPosition(newX, newY)) {
      ship.x = newX;
      ship.y = newY;
    } else {
      // Change direction when hitting obstacles
      this.setRandomDirection(ship);
    }
  }

  isValidAIPosition(x, y) {
    // Check bounds
    if (x < 5 || x >= CONFIG.OCEAN_WIDTH - 5 || y < 5 || y >= CONFIG.OCEAN_HEIGHT - 5) {
      return false;
    }

    // Check world collisions
    return this.worldManager.isValidPosition(Math.round(x), Math.round(y));
  }

  setRandomDirection(ship) {
    const directions = [
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }, { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -0.7, dy: -0.7 }, { dx: 0.7, dy: -0.7 }, { dx: -0.7, dy: 0.7 }, { dx: 0.7, dy: 0.7 }
    ];
    ship.moveDirection = directions[Math.floor(Math.random() * directions.length)];
  }

  repairAIShip(ship) {
    // AI ship repairs (no movement)
    const repairAmount = Math.floor(Math.random() * 15) + 10;
    ship.hull = Math.min(100, ship.hull + repairAmount);
    ship.repairCooldown = 2; // 2 move cooldown

    // Add water object to show repair activity
    this.worldManager.addWaterObject(
      ship.x + Math.floor(Math.random() * 3) - 1,
      ship.y + Math.floor(Math.random() * 3) - 1,
      'floating_barrel',
      { fromAI: true, temporary: true }
    );
  }

  setWanderDirection(ship) {
    // Random movement with some persistence
    if (Math.random() < 0.3 || (ship.moveDirection.dx === 0 && ship.moveDirection.dy === 0)) {
      this.setRandomDirection(ship);
    }
  }

  setHuntDirection(ship) {
    // Find nearest target (could be player or other AI ship)
    const allTargets = [...this.aiShips.filter(s => s.id !== ship.id)];

    if (allTargets.length === 0) {
      this.setWanderDirection(ship);
      return;
    }

    const target = this.findNearestTarget(ship, allTargets);
    if (target && this.getDistance(ship, target) < 50) {
      // Move toward target
      const dx = target.x - ship.x;
      const dy = target.y - ship.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance > 0) {
        ship.moveDirection = { dx: dx / distance, dy: dy / distance };
      }
    } else {
      this.setWanderDirection(ship);
    }
  }

  setFleeDirection(ship) {
    // Move away from threats (simplified - just move randomly)
    this.setRandomDirection(ship);
  }



  findNearestTarget(ship, targets) {
    let nearest = null;
    let minDistance = Infinity;

    for (const target of targets) {
      const distance = this.getDistance(ship, target);
      if (distance < minDistance) {
        minDistance = distance;
        nearest = target;
      }
    }

    return nearest;
  }

  getDistance(ship1, ship2) {
    const dx = ship1.x - ship2.x;
    const dy = ship1.y - ship2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  getAIShips() {
    return this.aiShips;
  }

  // Remove destroyed AI ships and spawn new ones
  maintainAIFleet() {
    // Remove ships with 0 hull
    this.aiShips = this.aiShips.filter(ship => ship.hull > 0);

    // Spawn new ships if fleet is too small
    const minFleetSize = 3;
    while (this.aiShips.length < minFleetSize) {
      const newShip = this.createAIShip();
      this.aiShips.push(newShip);
    }
  }

  // Get AI ship by ID (for interactions)
  getAIShipById(id) {
    return this.aiShips.find(ship => ship.id === id);
  }

  // Update AI ship stats (for combat/trade results)
  updateAIShip(shipId, updates) {
    const ship = this.getAIShipById(shipId);
    if (ship) {
      Object.assign(ship, updates);

      // Maintain fleet if ship was destroyed
      if (ship.hull <= 0) {
        setTimeout(() => this.maintainAIFleet(), 1000);
      }
    }
  }
}