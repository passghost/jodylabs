// world.js - World generation and management
import { CONFIG } from './config.js';

export class WorldManager {
  constructor(supabase = null) {
    this.islands = [];
    this.waterObjects = [];
    this.supabase = supabase;
    this.tradingStocks = new Map(); // Map of island_id -> stocks
  }

  async loadIslands() {
    if (!this.supabase) {
      console.warn('No Supabase client provided, falling back to local generation');
      this.generateLocalIslands();
      return;
    }

    try {
      const { data: islands, error } = await this.supabase
        .from('islands')
        .select('*')
        .order('id');

      if (error) {
        console.error('Error loading islands:', error);
        this.generateLocalIslands();
        return;
      }

      this.islands = islands.map(island => ({
        id: island.id,
        cx: island.cx,
        cy: island.cy,
        rx: island.rx,
        ry: island.ry,
        portX: island.port_x,
        portY: island.port_y,
        portName: island.port_name,
        portType: island.port_type
      }));

      console.log(`Loaded ${this.islands.length} islands from database`);
      
      // Load trading stocks for all islands
      await this.loadTradingStocks();
      
    } catch (error) {
      console.error('Failed to load islands:', error);
      this.generateLocalIslands();
    }
  }

  async loadTradingStocks() {
    if (!this.supabase) return;

    try {
      const { data: stocks, error } = await this.supabase
        .from('trading_stocks')
        .select('*');

      if (error) {
        console.error('Error loading trading stocks:', error);
        return;
      }

      // Group stocks by island_id
      this.tradingStocks.clear();
      stocks.forEach(stock => {
        if (!this.tradingStocks.has(stock.island_id)) {
          this.tradingStocks.set(stock.island_id, []);
        }
        this.tradingStocks.get(stock.island_id).push({
          itemName: stock.item_name,
          stockQuantity: stock.stock_quantity,
          buyPrice: stock.buy_price,
          sellPrice: stock.sell_price,
          lastRestock: stock.last_restock
        });
      });

      console.log(`Loaded trading stocks for ${this.tradingStocks.size} islands`);
      
    } catch (error) {
      console.error('Failed to load trading stocks:', error);
    }
  }

  generateLocalIslands() {
    // Fallback local generation (same as before but with port names)
    this.islands = [];
    const portNames = [
      'Port Royal', 'Tortuga Harbor', 'Nassau Trading Post', 'Blackwater Bay',
      'Skull Island Port', 'Golden Cove', 'Windward Station', 'Crimson Harbor'
    ];
    
    const numIslands = Math.floor(Math.random() * (CONFIG.ISLANDS.MAX_COUNT - CONFIG.ISLANDS.MIN_COUNT + 1)) + CONFIG.ISLANDS.MIN_COUNT;
    
    for (let i = 0; i < numIslands; i++) {
      const cx = Math.floor(Math.random() * (CONFIG.OCEAN_WIDTH - 100) + 50);
      const cy = Math.floor(Math.random() * (CONFIG.OCEAN_HEIGHT - 100) + 50);
      const rx = Math.floor(Math.random() * CONFIG.ISLANDS.MAX_RADIUS) + CONFIG.ISLANDS.MIN_RADIUS;
      const ry = Math.floor(Math.random() * CONFIG.ISLANDS.MAX_RADIUS) + CONFIG.ISLANDS.MIN_RADIUS;
      
      // Port is always on the edge of the island
      const angle = Math.random() * 2 * Math.PI;
      const portX = Math.round(cx + Math.cos(angle) * rx);
      const portY = Math.round(cy + Math.sin(angle) * ry);
      
      this.islands.push({ 
        id: i + 1,
        cx, cy, rx, ry, 
        portX, portY,
        portName: portNames[i % portNames.length],
        portType: 'trading'
      });
    }
  }

  // Legacy method for compatibility
  generateIslands() {
    return this.loadIslands();
  }

  // Ensure loadIslands method exists (debugging)
  async loadIslandsDebug() {
    console.log('loadIslandsDebug called');
    return this.loadIslands();
  }

  isIsland(x, y) {
    for (const isl of this.islands) {
      const dx = (x - isl.cx) / isl.rx;
      const dy = (y - isl.cy) / isl.ry;
      if (dx * dx + dy * dy <= 1) return true;
    }
    return false;
  }

  isPort(x, y) {
    for (const isl of this.islands) {
      if (x === isl.portX && y === isl.portY) return true;
    }
    return false;
  }

  getPortAt(x, y) {
    for (const isl of this.islands) {
      if (x === isl.portX && y === isl.portY) return isl;
    }
    return null;
  }

  isNearPort(x, y, distance = 30) {
    for (const isl of this.islands) {
      const dx = x - isl.portX;
      const dy = y - isl.portY;
      if (Math.sqrt(dx * dx + dy * dy) <= distance) {
        return isl;
      }
    }
    return null;
  }

  getTradingStocks(islandId) {
    return this.tradingStocks.get(islandId) || [];
  }

  async updateTradingStock(islandId, itemName, newQuantity) {
    if (!this.supabase) return false;

    try {
      const { error } = await this.supabase
        .from('trading_stocks')
        .update({ 
          stock_quantity: newQuantity,
          updated_at: new Date().toISOString()
        })
        .eq('island_id', islandId)
        .eq('item_name', itemName);

      if (error) {
        console.error('Error updating trading stock:', error);
        return false;
      }

      // Update local cache
      const stocks = this.tradingStocks.get(islandId);
      if (stocks) {
        const stock = stocks.find(s => s.itemName === itemName);
        if (stock) {
          stock.stockQuantity = newQuantity;
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to update trading stock:', error);
      return false;
    }
  }

  getIslands() {
    return this.islands;
  }

  isValidPosition(x, y) {
    // Check a 5x3 area around the ship position to account for ship size
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkX = x + dx;
        const checkY = y + dy;
        if (this.isIsland(checkX, checkY) || this.isPort(checkX, checkY)) {
          return false;
        }
      }
    }
    return true;
  }

  addWaterObject(x, y, type, data = {}) {
    this.waterObjects.push({
      x, y, type, data,
      id: Date.now() + Math.random(),
      created: Date.now()
    });
  }

  removeWaterObject(id) {
    this.waterObjects = this.waterObjects.filter(obj => obj.id !== id);
  }

  getWaterObjectAt(x, y) {
    return this.waterObjects.find(obj => obj.x === x && obj.y === y);
  }

  getWaterObjects() {
    return this.waterObjects;
  }

  cleanupOldObjects() {
    const now = Date.now();
    const maxAge = 300000; // 5 minutes
    this.waterObjects = this.waterObjects.filter(obj => 
      now - obj.created < maxAge || obj.data.permanent
    );
  }
}