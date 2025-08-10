// boat-manager.js - Boat purchasing and upgrade system
import { CONFIG } from './config.js';

export class BoatManager {
  constructor(authManager, inventoryManager) {
    this.auth = authManager;
    this.inventory = inventoryManager;
    this.currentBoat = null;
    this.availableBoats = new Map();
    this.initializeBoatTypes();
  }

  initializeBoatTypes() {
    // Define all boat types with their stats and costs
    const boatTypes = [
      {
        id: 'sloop',
        name: 'Pirate Sloop',
        description: 'A nimble single-masted vessel perfect for beginners',
        baseStats: {
          hull: 100,
          maxHull: 100,
          crew: 5,
          maxCrew: 8,
          speed: 1.0,
          cannonDamage: 10,
          cargoCapacity: 50
        },
        cost: 0, // Starting boat
        requirements: {},
        icon: '⛵',
        color: '#8B4513',
        size: { width: 8, height: 4 }
      },
      {
        id: 'brigantine',
        name: 'War Brigantine',
        description: 'A two-masted warship with enhanced firepower and crew capacity',
        baseStats: {
          hull: 150,
          maxHull: 150,
          crew: 8,
          maxCrew: 12,
          speed: 0.9,
          cannonDamage: 15,
          cargoCapacity: 75
        },
        cost: 500,
        requirements: {
          'Gold Coins': 500,
          'Wooden Planks': 25,
          'Cannon Balls': 50
        },
        icon: '🚢',
        color: '#654321',
        size: { width: 10, height: 5 }
      },
      {
        id: 'frigate',
        name: 'Royal Frigate',
        description: 'A heavily armed three-masted ship built for naval supremacy',
        baseStats: {
          hull: 200,
          maxHull: 200,
          crew: 12,
          maxCrew: 18,
          speed: 0.8,
          cannonDamage: 25,
          cargoCapacity: 100
        },
        cost: 1200,
        requirements: {
          'Gold Coins': 1200,
          'Wooden Planks': 50,
          'Cannon Balls': 100,
          'Rope': 30,
          'Spices': 10
        },
        icon: '🛳️',
        color: '#2F4F4F',
        size: { width: 12, height: 6 }
      },
      {
        id: 'galleon',
        name: 'Spanish Galleon',
        description: 'A massive treasure ship with enormous cargo capacity',
        baseStats: {
          hull: 250,
          maxHull: 250,
          crew: 15,
          maxCrew: 25,
          speed: 0.7,
          cannonDamage: 20,
          cargoCapacity: 200
        },
        cost: 2000,
        requirements: {
          'Gold Coins': 2000,
          'Wooden Planks': 75,
          'Silk': 20,
          'Pearls': 15,
          'Lucky Charm': 2
        },
        icon: '🏴‍☠️',
        color: '#8B0000',
        size: { width: 14, height: 8 }
      },
      {
        id: 'dreadnought',
        name: 'Kraken Dreadnought',
        description: 'A legendary warship forged from kraken bones and sea magic',
        baseStats: {
          hull: 350,
          maxHull: 350,
          crew: 20,
          maxCrew: 35,
          speed: 0.9,
          cannonDamage: 40,
          cargoCapacity: 150
        },
        cost: 5000,
        requirements: {
          'Gold Coins': 5000,
          'Pearls': 50,
          'Lucky Charm': 5,
          'Treasure Maps': 10,
          'Spices': 25
        },
        icon: '🐙',
        color: '#4B0082',
        size: { width: 16, height: 10 }
      }
    ];

    // Store boat types
    for (const boat of boatTypes) {
      this.availableBoats.set(boat.id, boat);
    }

    // Set default boat
    this.currentBoat = this.availableBoats.get('sloop');
  }

  async loadPlayerBoat() {
    try {
      const { data, error } = await this.auth.getSupabase()
        .from('player_boats')
        .select('*')
        .eq('user_id', this.auth.user.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data) {
        // Load saved boat
        const boatType = this.availableBoats.get(data.boat_type);
        if (boatType) {
          this.currentBoat = {
            ...boatType,
            currentStats: data.current_stats || boatType.baseStats,
            upgrades: data.upgrades || {},
            purchaseDate: data.created_at
          };
        }
      } else {
        // Create default boat record
        await this.savePlayerBoat();
      }

      return this.currentBoat;
    } catch (error) {
      console.error('Failed to load player boat:', error);
      // Fallback to default boat
      this.currentBoat = this.availableBoats.get('sloop');
      return this.currentBoat;
    }
  }

  async savePlayerBoat() {
    try {
      const boatData = {
        user_id: this.auth.user.id,
        boat_type: this.currentBoat.id,
        current_stats: this.currentBoat.currentStats || this.currentBoat.baseStats,
        upgrades: this.currentBoat.upgrades || {},
        updated_at: new Date().toISOString()
      };

      const { error } = await this.auth.getSupabase()
        .from('player_boats')
        .upsert(boatData, { onConflict: 'user_id' });

      if (error) throw error;

    } catch (error) {
      console.error('Failed to save player boat:', error);
    }
  }

  canPurchaseBoat(boatId) {
    const boat = this.availableBoats.get(boatId);
    if (!boat) return { canPurchase: false, reason: 'Boat not found' };

    // Check if already owned
    if (this.currentBoat.id === boatId) {
      return { canPurchase: false, reason: 'Already owned' };
    }

    // Check requirements
    for (const [item, required] of Object.entries(boat.requirements)) {
      const available = this.inventory.getItemQuantity(item);
      if (available < required) {
        return { 
          canPurchase: false, 
          reason: `Need ${required - available} more ${item}` 
        };
      }
    }

    return { canPurchase: true };
  }

  async purchaseBoat(boatId) {
    const purchaseCheck = this.canPurchaseBoat(boatId);
    if (!purchaseCheck.canPurchase) {
      throw new Error(purchaseCheck.reason);
    }

    const boat = this.availableBoats.get(boatId);
    
    // Deduct requirements from inventory
    for (const [item, required] of Object.entries(boat.requirements)) {
      this.inventory.removeItem(item, required);
    }

    // Set new boat
    this.currentBoat = {
      ...boat,
      currentStats: { ...boat.baseStats },
      upgrades: {},
      purchaseDate: new Date().toISOString()
    };

    // Save to database
    await this.savePlayerBoat();
    await this.inventory.saveInventoryToDatabase();

    return this.currentBoat;
  }

  getBoatUpgrades() {
    return {
      'hull_upgrade': {
        name: 'Hull Reinforcement',
        description: 'Increases maximum hull by 25',
        cost: { 'Gold Coins': 200, 'Wooden Planks': 15 },
        effect: { maxHull: 25 },
        maxLevel: 5
      },
      'crew_upgrade': {
        name: 'Crew Quarters',
        description: 'Increases maximum crew by 3',
        cost: { 'Gold Coins': 150, 'Rum Bottles': 5 },
        effect: { maxCrew: 3 },
        maxLevel: 4
      },
      'speed_upgrade': {
        name: 'Enhanced Sails',
        description: 'Increases ship speed by 10%',
        cost: { 'Gold Coins': 300, 'Silk': 8 },
        effect: { speed: 0.1 },
        maxLevel: 3
      },
      'cannon_upgrade': {
        name: 'Cannon Enhancement',
        description: 'Increases cannon damage by 5',
        cost: { 'Gold Coins': 250, 'Cannon Balls': 25 },
        effect: { cannonDamage: 5 },
        maxLevel: 6
      },
      'cargo_upgrade': {
        name: 'Cargo Expansion',
        description: 'Increases cargo capacity by 25',
        cost: { 'Gold Coins': 180, 'Rope': 10 },
        effect: { cargoCapacity: 25 },
        maxLevel: 4
      }
    };
  }

  canUpgradeBoat(upgradeId) {
    const upgrades = this.getBoatUpgrades();
    const upgrade = upgrades[upgradeId];
    if (!upgrade) return { canUpgrade: false, reason: 'Upgrade not found' };

    const currentLevel = this.currentBoat.upgrades[upgradeId] || 0;
    if (currentLevel >= upgrade.maxLevel) {
      return { canUpgrade: false, reason: 'Maximum level reached' };
    }

    // Check cost requirements
    const costMultiplier = currentLevel + 1;
    for (const [item, baseCost] of Object.entries(upgrade.cost)) {
      const required = Math.floor(baseCost * costMultiplier);
      const available = this.inventory.getItemQuantity(item);
      if (available < required) {
        return { 
          canUpgrade: false, 
          reason: `Need ${required - available} more ${item}` 
        };
      }
    }

    return { canUpgrade: true, cost: upgrade.cost, costMultiplier };
  }

  async upgradeBoat(upgradeId) {
    const upgradeCheck = this.canUpgradeBoat(upgradeId);
    if (!upgradeCheck.canUpgrade) {
      throw new Error(upgradeCheck.reason);
    }

    const upgrades = this.getBoatUpgrades();
    const upgrade = upgrades[upgradeId];
    const currentLevel = this.currentBoat.upgrades[upgradeId] || 0;
    const newLevel = currentLevel + 1;
    const costMultiplier = upgradeCheck.costMultiplier;

    // Deduct costs
    for (const [item, baseCost] of Object.entries(upgrade.cost)) {
      const required = Math.floor(baseCost * costMultiplier);
      this.inventory.removeItem(item, required);
    }

    // Apply upgrade
    this.currentBoat.upgrades[upgradeId] = newLevel;
    
    // Update current stats
    for (const [stat, bonus] of Object.entries(upgrade.effect)) {
      this.currentBoat.currentStats[stat] = 
        (this.currentBoat.currentStats[stat] || this.currentBoat.baseStats[stat]) + bonus;
    }

    // Save to database
    await this.savePlayerBoat();
    await this.inventory.saveInventoryToDatabase();

    return { upgrade: upgrade.name, level: newLevel };
  }

  getCurrentBoat() {
    return this.currentBoat;
  }

  getAvailableBoats() {
    return Array.from(this.availableBoats.values());
  }

  getBoatStats() {
    if (!this.currentBoat) return null;

    return {
      name: this.currentBoat.name,
      type: this.currentBoat.id,
      icon: this.currentBoat.icon,
      stats: this.currentBoat.currentStats || this.currentBoat.baseStats,
      baseStats: this.currentBoat.baseStats,
      upgrades: this.currentBoat.upgrades || {},
      size: this.currentBoat.size,
      color: this.currentBoat.color
    };
  }

  showBoatShop() {
    const boats = this.getAvailableBoats();
    let shopHTML = `
      <div style="color:#FFD700; font-size:1.5em; text-align:center; margin-bottom:20px;">
        🏪 Boat Shop 🏪
      </div>
      <div style="max-height:400px; overflow-y:auto;">
    `;

    for (const boat of boats) {
      const purchaseCheck = this.canPurchaseBoat(boat.id);
      const isOwned = this.currentBoat.id === boat.id;
      
      shopHTML += `
        <div style="border:2px solid ${isOwned ? '#00FF00' : '#FFD700'}; border-radius:8px; padding:12px; margin-bottom:10px; background:${isOwned ? '#003300' : '#1a1a1a'};">
          <div style="font-size:1.2em; color:#FFD700; margin-bottom:5px;">
            ${boat.icon} ${boat.name} ${isOwned ? '(OWNED)' : ''}
          </div>
          <div style="color:#CCCCCC; font-size:0.9em; margin-bottom:8px;">
            ${boat.description}
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <div style="color:#FFD700;">
              Hull: ${boat.baseStats.hull} | Crew: ${boat.baseStats.maxCrew} | Speed: ${boat.baseStats.speed}x
            </div>
          </div>
          <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
            <div style="color:#FFD700;">
              Damage: ${boat.baseStats.cannonDamage} | Cargo: ${boat.baseStats.cargoCapacity}
            </div>
          </div>
      `;

      if (!isOwned) {
        shopHTML += `<div style="color:#CCCCCC; font-size:0.9em; margin-bottom:8px;">Requirements:</div>`;
        for (const [item, amount] of Object.entries(boat.requirements)) {
          const available = this.inventory.getItemQuantity(item);
          const hasEnough = available >= amount;
          shopHTML += `
            <div style="color:${hasEnough ? '#00FF00' : '#FF0000'}; font-size:0.8em;">
              ${item}: ${available}/${amount}
            </div>
          `;
        }

        if (purchaseCheck.canPurchase) {
          shopHTML += `
            <button onclick="window.game.boatManager.purchaseBoat('${boat.id}').then(() => { 
              window.game.ui.showInventoryNotification('${boat.name} purchased!', 'success'); 
              document.getElementById('inventoryModal').remove(); 
              window.game.showBoatShop(); 
            }).catch(e => alert(e.message))" 
            style="background:#00AA00; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-top:8px;">
              Purchase ${boat.name}
            </button>
          `;
        } else {
          shopHTML += `
            <div style="color:#FF0000; font-size:0.9em; margin-top:8px;">
              ${purchaseCheck.reason}
            </div>
          `;
        }
      }

      shopHTML += `</div>`;
    }

    shopHTML += `</div>`;
    return shopHTML;
  }

  showBoatUpgrades() {
    const upgrades = this.getBoatUpgrades();
    let upgradeHTML = `
      <div style="color:#FFD700; font-size:1.5em; text-align:center; margin-bottom:20px;">
        ⚒️ Boat Upgrades - ${this.currentBoat.icon} ${this.currentBoat.name} ⚒️
      </div>
      <div style="max-height:400px; overflow-y:auto;">
    `;

    for (const [upgradeId, upgrade] of Object.entries(upgrades)) {
      const currentLevel = this.currentBoat.upgrades[upgradeId] || 0;
      const upgradeCheck = this.canUpgradeBoat(upgradeId);
      
      upgradeHTML += `
        <div style="border:2px solid #FFD700; border-radius:8px; padding:12px; margin-bottom:10px; background:#1a1a1a;">
          <div style="font-size:1.1em; color:#FFD700; margin-bottom:5px;">
            ${upgrade.name} (Level ${currentLevel}/${upgrade.maxLevel})
          </div>
          <div style="color:#CCCCCC; font-size:0.9em; margin-bottom:8px;">
            ${upgrade.description}
          </div>
      `;

      if (currentLevel < upgrade.maxLevel) {
        const costMultiplier = currentLevel + 1;
        upgradeHTML += `<div style="color:#CCCCCC; font-size:0.9em; margin-bottom:8px;">Cost for Level ${currentLevel + 1}:</div>`;
        
        for (const [item, baseCost] of Object.entries(upgrade.cost)) {
          const required = Math.floor(baseCost * costMultiplier);
          const available = this.inventory.getItemQuantity(item);
          const hasEnough = available >= required;
          upgradeHTML += `
            <div style="color:${hasEnough ? '#00FF00' : '#FF0000'}; font-size:0.8em;">
              ${item}: ${available}/${required}
            </div>
          `;
        }

        if (upgradeCheck.canUpgrade) {
          upgradeHTML += `
            <button onclick="window.game.boatManager.upgradeBoat('${upgradeId}').then(result => { 
              window.game.ui.showInventoryNotification(result.upgrade + ' upgraded to level ' + result.level + '!', 'success'); 
              document.getElementById('inventoryModal').remove(); 
              window.game.showBoatUpgrades(); 
            }).catch(e => alert(e.message))" 
            style="background:#0066CC; color:#fff; border:none; padding:6px 12px; border-radius:4px; cursor:pointer; margin-top:8px;">
              Upgrade to Level ${currentLevel + 1}
            </button>
          `;
        } else {
          upgradeHTML += `
            <div style="color:#FF0000; font-size:0.9em; margin-top:8px;">
              ${upgradeCheck.reason}
            </div>
          `;
        }
      } else {
        upgradeHTML += `
          <div style="color:#00FF00; font-size:0.9em; margin-top:8px;">
            Maximum level reached!
          </div>
        `;
      }

      upgradeHTML += `</div>`;
    }

    upgradeHTML += `</div>`;
    return upgradeHTML;
  }
}
