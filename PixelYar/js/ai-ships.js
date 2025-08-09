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
    // Create AI ships for blue sea
    for (let i = 0; i < CONFIG.AI_SHIPS.BLUE_SEA_COUNT; i++) {
      const ship = this.createAIShip('blue');
      this.aiShips.push(ship);
    }

    // Create AI ships for red sea
    for (let i = 0; i < CONFIG.AI_SHIPS.RED_SEA_COUNT; i++) {
      const ship = this.createAIShip('red');
      this.aiShips.push(ship);
    }

    // Start spawning new ships periodically
    this.startShipSpawning();
  }

  createAIShip(seaType = 'blue') {
    // Find a valid spawn position based on sea type
    let x, y;
    let attempts = 0;
    
    do {
      if (seaType === 'red') {
        // Spawn in red sea area (right 25% of ocean)
        x = CONFIG.RED_SEA.START_X + Math.floor(Math.random() * (CONFIG.OCEAN_WIDTH - CONFIG.RED_SEA.START_X));
        y = Math.floor(Math.random() * CONFIG.OCEAN_HEIGHT);
      } else {
        // Spawn in blue sea area (left 75% of ocean)
        x = Math.floor(Math.random() * CONFIG.RED_SEA.START_X);
        y = Math.floor(Math.random() * CONFIG.OCEAN_HEIGHT);
      }
      attempts++;
    } while (!this.worldManager.isValidPosition(x, y) && attempts < 100);

    // If we couldn't find a valid position, place at a default location
    if (attempts >= 100) {
      x = seaType === 'red' ? CONFIG.RED_SEA.START_X + 100 : CONFIG.OCEAN_WIDTH / 4;
      y = Math.floor(CONFIG.OCEAN_HEIGHT / 2);
    }

    // Red sea ships are more dangerous
    const isRedSea = seaType === 'red';
    const dangerMultiplier = isRedSea ? CONFIG.RED_SEA.DANGER_MULTIPLIER : 1;

    return {
      id: `ai_ship_${this.shipIdCounter++}`,
      x: x,
      y: y,
      hull: Math.floor((80 + Math.random() * 40) * dangerMultiplier), // Stronger in red sea
      crew: Math.floor((8 + Math.random() * 8) * dangerMultiplier), // More crew in red sea
      booty: Math.floor(Math.random() * 20 * (isRedSea ? CONFIG.RED_SEA.LOOT_MULTIPLIER : 1)), // Better loot in red sea
      color: isRedSea ? '#660000' : '#000000', // Dark red for red sea ships, black for blue sea
      email: `AI_${isRedSea ? 'RedSea' : 'BlueSea'}_Pirate_${this.shipIdCounter - 1}@blackflag.sea`,
      seaType: seaType,
      isAI: true,
      dangerLevel: isRedSea ? 'high' : 'normal',
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

  // Start periodic ship spawning
  startShipSpawning() {
    setInterval(() => {
      this.spawnNewShip();
    }, CONFIG.AI_SHIPS.SPAWN_INTERVAL);
  }

  // Spawn a new AI ship if under the limit
  spawnNewShip() {
    if (this.aiShips.length >= CONFIG.AI_SHIPS.MAX_TOTAL) {
      return; // At maximum capacity
    }

    // Randomly choose sea type based on current distribution
    const redSeaShips = this.aiShips.filter(ship => ship.seaType === 'red').length;
    const blueSeaShips = this.aiShips.filter(ship => ship.seaType === 'blue').length;
    
    let seaType = 'blue';
    if (redSeaShips < CONFIG.AI_SHIPS.RED_SEA_COUNT && Math.random() < 0.6) {
      seaType = 'red';
    }

    const newShip = this.createAIShip(seaType);
    this.aiShips.push(newShip);
    
    console.log(`Spawned new ${seaType} sea AI ship. Total: ${this.aiShips.length}`);
  }

  // Enhanced fleet maintenance with sea type balancing
  maintainAIFleet() {
    // Remove ships with 0 hull
    this.aiShips = this.aiShips.filter(ship => ship.hull > 0);

    // Maintain minimum fleet sizes for each sea
    const redSeaShips = this.aiShips.filter(ship => ship.seaType === 'red').length;
    const blueSeaShips = this.aiShips.filter(ship => ship.seaType === 'blue').length;

    // Spawn blue sea ships if needed
    while (blueSeaShips < Math.floor(CONFIG.AI_SHIPS.BLUE_SEA_COUNT / 2)) {
      const newShip = this.createAIShip('blue');
      this.aiShips.push(newShip);
    }

    // Spawn red sea ships if needed
    while (redSeaShips < Math.floor(CONFIG.AI_SHIPS.RED_SEA_COUNT / 2)) {
      const newShip = this.createAIShip('red');
      this.aiShips.push(newShip);
    }
  }

  // Get ships in a specific area (for red sea encounters)
  getShipsInArea(x, y, radius) {
    return this.aiShips.filter(ship => {
      const distance = this.getDistance(ship, { x, y });
      return distance <= radius;
    });
  }

  // Check if position is in red sea
  isInRedSea(x, y) {
    return x >= CONFIG.RED_SEA.START_X;
  }

  // Get danger level for a position
  getDangerLevel(x, y) {
    return this.isInRedSea(x, y) ? 'high' : 'normal';
  }
}