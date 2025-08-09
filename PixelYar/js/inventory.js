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
      { name: 'Gold Coins', icon: '🪙', description: 'Shiny pirate currency', stackable: true, maxStack: 999 },
      { name: 'Rum Bottles', icon: '🍺', description: 'Boosts crew morale', stackable: true, maxStack: 50 },
      { name: 'Cannon Balls', icon: '⚫', description: 'Essential for naval combat', stackable: true, maxStack: 100 },
      { name: 'Treasure Maps', icon: '🗺️', description: 'Lead to hidden riches', stackable: true, maxStack: 10 },
      { name: 'Spices', icon: '🌶️', description: 'Valuable trade goods', stackable: true, maxStack: 25 },
      { name: 'Silk', icon: '🧵', description: 'Luxury fabric from distant lands', stackable: true, maxStack: 20 },
      { name: 'Pearls', icon: '🦪', description: 'Precious ocean gems', stackable: true, maxStack: 30 },
      { name: 'Compass', icon: '🧭', description: 'Never lose your way', stackable: false, maxStack: 1 },
      { name: 'Lucky Charm', icon: '🍀', description: 'Reduces hull damage', stackable: false, maxStack: 1 },
      { name: 'Rusty Cutlass', icon: '⚔️', description: 'An old but trusty blade', stackable: false, maxStack: 1 },
      { name: 'Spyglass', icon: '🔭', description: 'See distant ships clearly', stackable: false, maxStack: 1 },
      { name: 'Parrot', icon: '🦜', description: 'A loyal feathered companion', stackable: false, maxStack: 1 },
      { name: 'Ship Bell', icon: '🔔', description: 'Brings good luck to your vessel', stackable: false, maxStack: 1 },
      { name: 'Anchor', icon: '⚓', description: 'A sturdy ship anchor', stackable: false, maxStack: 1 },
      { name: 'Fishing Net', icon: '🕸️', description: 'Catch fish and salvage', stackable: false, maxStack: 1 },
      { name: 'Lantern', icon: '🏮', description: 'Lights the way in dark waters', stackable: false, maxStack: 1 },
      { name: 'Wooden Planks', icon: '🪵', description: 'For ship repairs', stackable: true, maxStack: 50 },
      { name: 'Rope', icon: '🪢', description: 'Essential for rigging', stackable: true, maxStack: 25 },
      { name: 'Gunpowder', icon: '💥', description: 'Explosive material', stackable: true, maxStack: 20 },
      { name: 'Medicine', icon: '💊', description: 'Heals crew ailments', stackable: true, maxStack: 15 },
      { name: 'Red Pixel Pack', icon: '🔴', description: 'Place red pixels on the map', stackable: true, maxStack: 50 },
      { name: 'Blue Pixel Pack', icon: '🔵', description: 'Place blue pixels on the map', stackable: true, maxStack: 50 },
      { name: 'Green Pixel Pack', icon: '🟢', description: 'Place green pixels on the map', stackable: true, maxStack: 50 },
      { name: 'Yellow Pixel Pack', icon: '🟡', description: 'Place yellow pixels on the map', stackable: true, maxStack: 50 },
      { name: 'Purple Pixel Pack', icon: '🟣', description: 'Place purple pixels on the map', stackable: true, maxStack: 50 }
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
        // Treasure maps give random valuable items
        const treasureItems = ['Gold Coins', 'Pearls', 'Spices', 'Silk'];
        const foundItem = treasureItems[Math.floor(Math.random() * treasureItems.length)];
        const amount = Math.floor(Math.random() * 5) + 3;
        this.addItem(foundItem, amount);
        return { success: true, message: `🗺️ Following the map, you discover ${amount} ${foundItem}!` };
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
    const categories = {
      'Currency': ['Gold Coins'],
      'Consumables': ['Rum Bottles', 'Medicine', 'Gunpowder'],
      'Materials': ['Wooden Planks', 'Rope', 'Cannon Balls'],
      'Valuables': ['Pearls', 'Spices', 'Silk', 'Treasure Maps'],
      'Tools': ['Compass', 'Spyglass', 'Rusty Cutlass', 'Fishing Net', 'Lantern'],
      'Special': ['Lucky Charm', 'Parrot', 'Ship Bell', 'Anchor'],
      'Pixel Packs': ['Red Pixel Pack', 'Blue Pixel Pack', 'Green Pixel Pack', 'Yellow Pixel Pack', 'Purple Pixel Pack']
    };

    const result = {};
    for (const [category, itemNames] of Object.entries(categories)) {
      result[category] = [];
      for (const itemName of itemNames) {
        const quantity = this.getItemQuantity(itemName);
        if (quantity > 0) {
          const itemDef = this.itemDefinitions.get(itemName);
          result[category].push({
            name: itemName,
            quantity,
            icon: itemDef?.icon || '📦',
            description: itemDef?.description || 'Unknown item'
          });
        }
      }
    }

    return result;
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
}