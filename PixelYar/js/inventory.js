// inventory.js - Player inventory management system
export class InventoryManager {
  constructor() {
    this.items = new Map(); // Map of item name to quantity
    this.itemDefinitions = new Map(); // Map of item name to item data
    
    this.initializeItemDefinitions();
  }

  initializeItemDefinitions() {
    // Define all possible inventory items
    const items = [
      // Currency & Valuables
      { name: 'Gold Coins', icon: '🪙', description: 'Shiny pirate currency', stackable: true, maxStack: 999, category: 'Currency' },
      { name: 'Pearls', icon: '🦪', description: 'Precious ocean gems', stackable: true, maxStack: 50, category: 'Valuables' },
      { name: 'Emeralds', icon: '💎', description: 'Rare green gemstones', stackable: true, maxStack: 20, category: 'Valuables' },
      { name: 'Rubies', icon: '♦️', description: 'Blood-red precious stones', stackable: true, maxStack: 15, category: 'Valuables' },
      { name: 'Ancient Coins', icon: '🏺', description: 'Currency from lost civilizations', stackable: true, maxStack: 30, category: 'Valuables' },
      
      // Trade Goods
      { name: 'Spices', icon: '🌶️', description: 'Valuable trade goods from exotic lands', stackable: true, maxStack: 40, category: 'Trade Goods' },
      { name: 'Silk', icon: '🧵', description: 'Luxury fabric from distant shores', stackable: true, maxStack: 30, category: 'Trade Goods' },
      { name: 'Coffee Beans', icon: '☕', description: 'Aromatic beans from tropical islands', stackable: true, maxStack: 35, category: 'Trade Goods' },
      { name: 'Tobacco Leaves', icon: '🍃', description: 'Premium smoking leaves', stackable: true, maxStack: 25, category: 'Trade Goods' },
      { name: 'Ivory', icon: '🦷', description: 'Rare ivory from distant lands', stackable: true, maxStack: 10, category: 'Trade Goods' },
      { name: 'Exotic Furs', icon: '🦫', description: 'Luxurious pelts from northern seas', stackable: true, maxStack: 15, category: 'Trade Goods' },
      
      // Consumables & Supplies
      { name: 'Rum Bottles', icon: '🍺', description: 'Boosts crew morale and courage', stackable: true, maxStack: 60, category: 'Consumables' },
      { name: 'Medicine', icon: '💊', description: 'Heals wounds and cures ailments', stackable: true, maxStack: 25, category: 'Consumables' },
      { name: 'Hardtack', icon: '🍞', description: 'Long-lasting ship biscuits', stackable: true, maxStack: 50, category: 'Consumables' },
      { name: 'Fresh Water', icon: '💧', description: 'Essential for long voyages', stackable: true, maxStack: 40, category: 'Consumables' },
      { name: 'Salted Meat', icon: '🥩', description: 'Preserved protein for the crew', stackable: true, maxStack: 30, category: 'Consumables' },
      
      // Combat & Weapons
      { name: 'Cannon Balls', icon: '⚫', description: 'Essential ammunition for naval combat', stackable: true, maxStack: 150, category: 'Combat' },
      { name: 'Gunpowder', icon: '💥', description: 'Explosive black powder', stackable: true, maxStack: 30, category: 'Combat' },
      { name: 'Grapeshot', icon: '🔘', description: 'Anti-personnel cannon ammunition', stackable: true, maxStack: 50, category: 'Combat' },
      { name: 'Chain Shot', icon: '⛓️', description: 'Specialized ammo for destroying sails', stackable: true, maxStack: 40, category: 'Combat' },
      { name: 'Muskets', icon: '🔫', description: 'Firearms for boarding actions', stackable: true, maxStack: 10, category: 'Combat' },
      { name: 'Cutlasses', icon: '⚔️', description: 'Sharp curved swords for close combat', stackable: true, maxStack: 15, category: 'Combat' },
      
      // Ship Materials
      { name: 'Wooden Planks', icon: '🪵', description: 'Oak planks for hull repairs', stackable: true, maxStack: 80, category: 'Materials' },
      { name: 'Rope', icon: '🪢', description: 'Hemp rope for rigging and repairs', stackable: true, maxStack: 50, category: 'Materials' },
      { name: 'Canvas', icon: '⛵', description: 'Sailcloth for repairing sails', stackable: true, maxStack: 20, category: 'Materials' },
      { name: 'Iron Nails', icon: '🔩', description: 'Essential fasteners for ship repairs', stackable: true, maxStack: 100, category: 'Materials' },
      { name: 'Tar', icon: '🛢️', description: 'Waterproofing compound for hulls', stackable: true, maxStack: 15, category: 'Materials' },
      { name: 'Copper Sheets', icon: '🟫', description: 'Metal plating for hull protection', stackable: true, maxStack: 25, category: 'Materials' },
      
      // Navigation & Tools
      { name: 'Compass', icon: '🧭', description: 'Magnetic navigation instrument', stackable: false, maxStack: 1, category: 'Navigation' },
      { name: 'Spyglass', icon: '🔭', description: 'Extends vision across the seas', stackable: false, maxStack: 1, category: 'Navigation' },
      { name: 'Sextant', icon: '📐', description: 'Celestial navigation tool', stackable: false, maxStack: 1, category: 'Navigation' },
      { name: 'Treasure Maps', icon: '🗺️', description: 'Charts leading to buried treasure', stackable: true, maxStack: 15, category: 'Navigation' },
      { name: 'Sea Charts', icon: '🗞️', description: 'Detailed maps of shipping routes', stackable: true, maxStack: 10, category: 'Navigation' },
      { name: 'Astrolabe', icon: '⭐', description: 'Ancient navigation instrument', stackable: false, maxStack: 1, category: 'Navigation' },
      
      // Magical & Special Items
      { name: 'Lucky Charm', icon: '🍀', description: 'Mystical protection against harm', stackable: false, maxStack: 1, category: 'Magical' },
      { name: 'Cursed Medallion', icon: '🏅', description: 'Brings misfortune to enemies', stackable: false, maxStack: 1, category: 'Magical' },
      { name: 'Mermaid Scale', icon: '🐠', description: 'Grants favor with sea creatures', stackable: true, maxStack: 5, category: 'Magical' },
      { name: 'Kraken Ink', icon: '🖤', description: 'Mysterious black substance', stackable: true, maxStack: 8, category: 'Magical' },
      { name: 'Phoenix Feather', icon: '🪶', description: 'Legendary item of rebirth', stackable: false, maxStack: 1, category: 'Magical' },
      
      // Crew & Companions
      { name: 'Parrot', icon: '🦜', description: 'Colorful talking companion', stackable: false, maxStack: 1, category: 'Companions' },
      { name: 'Ship Cat', icon: '🐱', description: 'Keeps the ship free of rats', stackable: false, maxStack: 1, category: 'Companions' },
      { name: 'Monkey', icon: '🐒', description: 'Agile helper for rigging work', stackable: false, maxStack: 1, category: 'Companions' },
      
      // Ship Equipment
      { name: 'Ship Bell', icon: '🔔', description: 'Bronze bell for ship communications', stackable: false, maxStack: 1, category: 'Equipment' },
      { name: 'Anchor', icon: '⚓', description: 'Heavy iron anchor', stackable: false, maxStack: 1, category: 'Equipment' },
      { name: 'Fishing Net', icon: '🕸️', description: 'Large net for catching fish', stackable: false, maxStack: 1, category: 'Equipment' },
      { name: 'Lantern', icon: '🏮', description: 'Oil lamp for night navigation', stackable: true, maxStack: 5, category: 'Equipment' },
      { name: 'Barrel', icon: '🛢️', description: 'Storage container for supplies', stackable: true, maxStack: 10, category: 'Equipment' },
      { name: 'Hammock', icon: '🛏️', description: 'Sleeping quarters for crew', stackable: true, maxStack: 20, category: 'Equipment' },
      
      // Pixel Packs
      { name: 'Red Pixel Pack', icon: '🔴', description: 'Crimson paint for marking territory', stackable: true, maxStack: 50, category: 'Art Supplies' },
      { name: 'Blue Pixel Pack', icon: '🔵', description: 'Ocean blue paint for sea charts', stackable: true, maxStack: 50, category: 'Art Supplies' },
      { name: 'Green Pixel Pack', icon: '🟢', description: 'Forest green paint for islands', stackable: true, maxStack: 50, category: 'Art Supplies' },
      { name: 'Yellow Pixel Pack', icon: '🟡', description: 'Golden paint for treasure marks', stackable: true, maxStack: 50, category: 'Art Supplies' },
      { name: 'Purple Pixel Pack', icon: '🟣', description: 'Royal purple paint for prestige', stackable: true, maxStack: 50, category: 'Art Supplies' },
      { name: 'Black Pixel Pack', icon: '⚫', description: 'Midnight black paint for warnings', stackable: true, maxStack: 50, category: 'Art Supplies' },
      { name: 'White Pixel Pack', icon: '⚪', description: 'Pure white paint for peace flags', stackable: true, maxStack: 50, category: 'Art Supplies' },
      
      // Rare & Legendary Items
      { name: 'Golden Skull', icon: '💀', description: 'Legendary pirate artifact', stackable: false, maxStack: 1, category: 'Legendary' },
      { name: 'Davy Jones Locker Key', icon: '🗝️', description: 'Opens the deepest treasures', stackable: false, maxStack: 1, category: 'Legendary' },
      { name: 'Blackbeard\'s Rum', icon: '🍾', description: 'The finest rum ever distilled', stackable: false, maxStack: 1, category: 'Legendary' },
      { name: 'Siren\'s Song', icon: '🎵', description: 'Enchanted music box', stackable: false, maxStack: 1, category: 'Legendary' },
      { name: 'Neptune\'s Trident', icon: '🔱', description: 'Weapon of the sea god', stackable: false, maxStack: 1, category: 'Legendary' }
    ];

    items.forEach(item => {
      this.itemDefinitions.set(item.name, item);
    });
  }

  addItem(itemName, quantity = 1) {
    const itemDef = this.itemDefinitions.get(itemName);
    if (!itemDef) {
      console.warn(`Unknown item: ${itemName}`);
      return false;
    }

    const currentQuantity = this.items.get(itemName) || 0;
    const newQuantity = Math.min(currentQuantity + quantity, itemDef.maxStack);
    
    if (newQuantity > currentQuantity) {
      this.items.set(itemName, newQuantity);
      return true;
    }
    
    return false; // Couldn't add (inventory full)
  }

  removeItem(itemName, quantity = 1) {
    const currentQuantity = this.items.get(itemName) || 0;
    if (currentQuantity >= quantity) {
      const newQuantity = currentQuantity - quantity;
      if (newQuantity === 0) {
        this.items.delete(itemName);
      } else {
        this.items.set(itemName, newQuantity);
      }
      return true;
    }
    return false;
  }

  hasItem(itemName, quantity = 1) {
    const currentQuantity = this.items.get(itemName) || 0;
    return currentQuantity >= quantity;
  }

  getItemQuantity(itemName) {
    return this.items.get(itemName) || 0;
  }

  getAllItems() {
    const result = [];
    for (const [itemName, quantity] of this.items.entries()) {
      const itemDef = this.itemDefinitions.get(itemName);
      result.push({
        name: itemName,
        quantity: quantity,
        icon: itemDef?.icon || '📦',
        description: itemDef?.description || 'Unknown item'
      });
    }
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }

  getTotalValue() {
    // Calculate total inventory value (Gold Coins = base value)
    let totalValue = this.getItemQuantity('Gold Coins');
    
    // Add value from other valuable items
    const valuableItems = {
      'Pearls': 5,
      'Spices': 3,
      'Silk': 4,
      'Treasure Maps': 10,
      'Rum Bottles': 2
    };

    for (const [itemName, valuePerItem] of Object.entries(valuableItems)) {
      totalValue += this.getItemQuantity(itemName) * valuePerItem;
    }

    return totalValue;
  }

  getInventoryData() {
    // Convert inventory to plain object for database storage
    const inventoryData = {};
    for (const [itemName, quantity] of this.items.entries()) {
      inventoryData[itemName] = quantity;
    }
    return inventoryData;
  }

  loadInventoryData(inventoryData) {
    // Load inventory from database data
    this.items.clear();
    if (inventoryData && typeof inventoryData === 'object') {
      for (const [itemName, quantity] of Object.entries(inventoryData)) {
        if (typeof quantity === 'number' && quantity > 0) {
          this.items.set(itemName, quantity);
        }
      }
    }
  }

  getRandomItem() {
    // Get a random item for interactions
    const itemNames = Array.from(this.itemDefinitions.keys());
    return itemNames[Math.floor(Math.random() * itemNames.length)];
  }

  getRandomValuableItem() {
    // Get a random valuable item
    const valuableItems = ['Gold Coins', 'Pearls', 'Spices', 'Silk', 'Treasure Maps', 'Rum Bottles'];
    return valuableItems[Math.floor(Math.random() * valuableItems.length)];
  }

  // Item usage system
  useItem(itemName, player) {
    if (!this.hasItem(itemName)) {
      return { success: false, message: `You don't have any ${itemName}` };
    }

    const itemDef = this.itemDefinitions.get(itemName);
    if (!itemDef) {
      return { success: false, message: `Unknown item: ${itemName}` };
    }

    // Define item effects
    const itemEffects = {
      'Rum Bottles': () => {
        player.crew = Math.min(player.crew + 2, 20); // Max crew of 20
        return { success: true, message: '🍺 Crew morale boosted! +2 crew members join your cause!' };
      },
      'Medicine': () => {
        const healAmount = Math.min(15, 100 - player.hull);
        player.hull += healAmount;
        return { success: true, message: `💊 Medicine heals your ship! +${healAmount} hull restored!` };
      },
      'Wooden Planks': () => {
        const repairAmount = Math.min(10, 100 - player.hull);
        player.hull += repairAmount;
        return { success: true, message: `🪵 Emergency repairs completed! +${repairAmount} hull restored!` };
      },
      'Gunpowder': () => {
        // Gunpowder can be dangerous to use directly
        if (Math.random() < 0.3) {
          player.hull = Math.max(0, player.hull - 5);
          return { success: true, message: '💥 Gunpowder explodes in your face! -5 hull damage!' };
        } else {
          return { success: true, message: '💥 You carefully store the gunpowder for later use.' };
        }
      },
      'Lucky Charm': () => {
        // Lucky charm provides temporary protection
        player.luckyCharmActive = true;
        player.luckyCharmUses = 3;
        return { success: true, message: '🍀 Lucky charm activated! Next 3 hull damages will be reduced!' };
      },
      'Treasure Maps': () => {
        // Treasure maps create treasure locations with large yields
        this.removeItem('Treasure Maps', 1);
        
        // Create a treasure location on the map
        if (window.game && window.game.world) {
          const treasureLocation = this.createTreasureLocation();
          window.game.world.addWaterObject(treasureLocation.x, treasureLocation.y, 'treasure_location', {
            treasureValue: treasureLocation.value,
            treasureItems: treasureLocation.items,
            fromTreasureMap: true
          });
          
          return { 
            success: true, 
            message: `🗺️ Treasure map reveals a location at (${treasureLocation.x}, ${treasureLocation.y})! Large treasure cache awaits!`,
            treasureLocation: treasureLocation
          };
        } else {
          // Fallback if world manager not available
          const treasureItems = ['Gold Coins', 'Pearls', 'Spices', 'Silk'];
          const foundItem = treasureItems[Math.floor(Math.random() * treasureItems.length)];
          const amount = Math.floor(Math.random() * 15) + 10; // 10-24 items (much larger yield)
          this.addItem(foundItem, amount);
          return { success: true, message: `🗺️ Following the map, you discover ${amount} ${foundItem}!` };
        }
      },
      'Red Pixel Pack': () => {
        return { success: true, message: '🔴 Red pixel pack activated! Click on the map to place red pixels!', activatePixelMode: 'red' };
      },
      'Blue Pixel Pack': () => {
        return { success: true, message: '🔵 Blue pixel pack activated! Click on the map to place blue pixels!', activatePixelMode: 'blue' };
      },
      'Green Pixel Pack': () => {
        return { success: true, message: '🟢 Green pixel pack activated! Click on the map to place green pixels!', activatePixelMode: 'green' };
      },
      'Yellow Pixel Pack': () => {
        return { success: true, message: '🟡 Yellow pixel pack activated! Click on the map to place yellow pixels!', activatePixelMode: 'yellow' };
      },
      'Purple Pixel Pack': () => {
        return { success: true, message: '🟣 Purple pixel pack activated! Click on the map to place purple pixels!', activatePixelMode: 'purple' };
      }
    };

    const effect = itemEffects[itemName];
    if (effect) {
      const result = effect();
      if (result.success) {
        // Only consume the item if the effect was successful
        this.removeItem(itemName, 1);
      }
      return result;
    }

    return { success: false, message: `${itemName} cannot be used directly.` };
  }

  // Crafting system
  canCraft(recipe) {
    for (const [itemName, quantity] of Object.entries(recipe.ingredients)) {
      if (!this.hasItem(itemName, quantity)) {
        return false;
      }
    }
    return true;
  }

  craftItem(recipeName) {
    const recipes = {
      'Repair Kit': {
        ingredients: { 'Wooden Planks': 3, 'Rope': 2 },
        result: { item: 'Medicine', quantity: 2 },
        description: 'Combine planks and rope to create medical supplies'
      },
      'Explosive Cannon Ball': {
        ingredients: { 'Cannon Balls': 5, 'Gunpowder': 2 },
        result: { item: 'Gold Coins', quantity: 15 },
        description: 'Craft special ammunition (sells for high price)'
      },
      'Navigation Kit': {
        ingredients: { 'Compass': 1, 'Spyglass': 1, 'Treasure Maps': 1 },
        result: { item: 'Gold Coins', quantity: 25 },
        description: 'Combine navigation tools for a premium price'
      },
      'Luxury Bundle': {
        ingredients: { 'Silk': 3, 'Spices': 3, 'Pearls': 2 },
        result: { item: 'Gold Coins', quantity: 40 },
        description: 'Bundle luxury goods for maximum profit'
      }
    };

    const recipe = recipes[recipeName];
    if (!recipe) {
      return { success: false, message: `Unknown recipe: ${recipeName}` };
    }

    if (!this.canCraft(recipe)) {
      const missing = [];
      for (const [itemName, needed] of Object.entries(recipe.ingredients)) {
        const have = this.getItemQuantity(itemName);
        if (have < needed) {
          missing.push(`${itemName} (need ${needed}, have ${have})`);
        }
      }
      return { success: false, message: `Missing ingredients: ${missing.join(', ')}` };
    }

    // Remove ingredients
    for (const [itemName, quantity] of Object.entries(recipe.ingredients)) {
      this.removeItem(itemName, quantity);
    }

    // Add result
    this.addItem(recipe.result.item, recipe.result.quantity);

    return { 
      success: true, 
      message: `🔨 Crafted ${recipeName}! Received ${recipe.result.quantity} ${recipe.result.item}!` 
    };
  }

  getAvailableRecipes() {
    const recipes = {
      'Repair Kit': {
        ingredients: { 'Wooden Planks': 3, 'Rope': 2 },
        result: { item: 'Medicine', quantity: 2 },
        description: 'Combine planks and rope to create medical supplies'
      },
      'Explosive Cannon Ball': {
        ingredients: { 'Cannon Balls': 5, 'Gunpowder': 2 },
        result: { item: 'Gold Coins', quantity: 15 },
        description: 'Craft special ammunition (sells for high price)'
      },
      'Navigation Kit': {
        ingredients: { 'Compass': 1, 'Spyglass': 1, 'Treasure Maps': 1 },
        result: { item: 'Gold Coins', quantity: 25 },
        description: 'Combine navigation tools for a premium price'
      },
      'Luxury Bundle': {
        ingredients: { 'Silk': 3, 'Spices': 3, 'Pearls': 2 },
        result: { item: 'Gold Coins', quantity: 40 },
        description: 'Bundle luxury goods for maximum profit'
      }
    };

    return Object.entries(recipes).map(([name, recipe]) => ({
      name,
      ...recipe,
      canCraft: this.canCraft(recipe)
    }));
  }

  // Enhanced item management
  getItemsByCategory() {
    const result = {};
    
    // Group items by their defined categories
    for (const [itemName, quantity] of this.items.entries()) {
      if (quantity > 0) {
        const itemDef = this.itemDefinitions.get(itemName);
        if (itemDef) {
          const category = itemDef.category || 'Miscellaneous';
          
          if (!result[category]) {
            result[category] = [];
          }
          
          result[category].push({
            name: itemName,
            quantity,
            icon: itemDef.icon || '📦',
            description: itemDef.description || 'Unknown item'
          });
        }
      }
    }

    // Sort categories by importance
    const categoryOrder = [
      'Currency', 'Valuables', 'Trade Goods', 'Combat', 'Materials', 
      'Consumables', 'Navigation', 'Equipment', 'Companions', 'Magical', 
      'Art Supplies', 'Legendary', 'Miscellaneous'
    ];

    const sortedResult = {};
    for (const category of categoryOrder) {
      if (result[category]) {
        sortedResult[category] = result[category];
      }
    }

    return sortedResult;
  }

  // Get detailed item information
  getItemDetails(itemName) {
    const itemDef = this.itemDefinitions.get(itemName);
    const quantity = this.getItemQuantity(itemName);
    
    if (!itemDef) return null;

    return {
      name: itemName,
      quantity,
      icon: itemDef.icon,
      description: itemDef.description,
      stackable: itemDef.stackable,
      maxStack: itemDef.maxStack,
      canUse: ['Rum Bottles', 'Medicine', 'Wooden Planks', 'Gunpowder', 'Lucky Charm', 'Treasure Maps', 'Red Pixel Pack', 'Blue Pixel Pack', 'Green Pixel Pack', 'Yellow Pixel Pack', 'Purple Pixel Pack'].includes(itemName)
    };
  }

  // Create a treasure location from a treasure map
  createTreasureLocation() {
    // Find a valid location for treasure
    let x, y;
    let attempts = 0;
    
    do {
      x = Math.floor(Math.random() * (window.game?.world?.CONFIG?.OCEAN_WIDTH || 3840));
      y = Math.floor(Math.random() * (window.game?.world?.CONFIG?.OCEAN_HEIGHT || 2160));
      attempts++;
    } while (attempts < 100 && window.game?.world && !window.game.world.isValidPosition(x, y));

    // If we couldn't find a valid position, use a default safe location
    if (attempts >= 100) {
      x = Math.floor((window.game?.world?.CONFIG?.OCEAN_WIDTH || 3840) / 2);
      y = Math.floor((window.game?.world?.CONFIG?.OCEAN_HEIGHT || 2160) / 2);
    }

    // Generate treasure contents - much more valuable than regular interactions
    const treasureTypes = [
      { items: [{ name: 'Gold Coins', quantity: [25, 50] }], weight: 30 },
      { items: [{ name: 'Pearls', quantity: [8, 15] }], weight: 25 },
      { items: [{ name: 'Gold Coins', quantity: [15, 25] }, { name: 'Pearls', quantity: [3, 8] }], weight: 20 },
      { items: [{ name: 'Spices', quantity: [10, 20] }, { name: 'Silk', quantity: [5, 12] }], weight: 15 },
      { items: [{ name: 'Lucky Charm', quantity: 2 }, { name: 'Gold Coins', quantity: [20, 35] }], weight: 10 }
    ];

    // Select treasure type based on weight
    const totalWeight = treasureTypes.reduce((sum, type) => sum + type.weight, 0);
    let random = Math.random() * totalWeight;
    let selectedTreasure = treasureTypes[0];

    for (const treasureType of treasureTypes) {
      random -= treasureType.weight;
      if (random <= 0) {
        selectedTreasure = treasureType;
        break;
      }
    }

    // Generate actual quantities
    const items = selectedTreasure.items.map(item => ({
      name: item.name,
      quantity: Array.isArray(item.quantity) 
        ? Math.floor(Math.random() * (item.quantity[1] - item.quantity[0] + 1)) + item.quantity[0]
        : item.quantity
    }));

    return {
      x: x,
      y: y,
      items: items,
      value: items.reduce((total, item) => total + (this.getItemValue(item.name) * item.quantity), 0)
    };
  }
}