// game.js - Main game controller
import { CONFIG } from './config.js';
import { AuthManager } from './auth.js';
import { UIManager } from './ui.js';
import { WorldManager } from './world.js';
import { Renderer } from './renderer.js';
import { InteractionManager as RandomInteractionManager } from './interactions.js';
import { PlayerManager } from './player.js';
import { InteractionManager } from './interaction-manager.js';
import { AIShipManager } from './ai-ships.js';
import { InventoryManager } from './inventory.js';
import { PixelManager } from './pixel-manager.js';

export class Game {
  constructor() {
    console.log('Creating Game instance...');
    this.auth = new AuthManager();
    console.log('AuthManager created');
    this.ui = new UIManager();
    console.log('UIManager created');
    this.world = new WorldManager(null); // Will set supabase later
    console.log('WorldManager created');
    this.renderer = new Renderer(document.getElementById('oceanCanvas'));
    console.log('Renderer created');
    this.randomInteractions = null; // Will be initialized after world manager
    this.player = new PlayerManager(this.auth.getSupabase());
    console.log('PlayerManager created');
    this.interactions = null; // Will be initialized after login
    this.aiShips = null; // Will be initialized after world manager
    this.inventory = new InventoryManager();
    console.log('InventoryManager created');
    this.pixelManager = null; // Will be initialized after login

    // Real-time movement state
    this.isGameRunning = false;
    this.interactionHistory = [];
    this.currentPlayer = null;
    this.playerRotation = 0; // Current rotation in radians
    this.targetRotation = 0; // Target rotation for smooth turning
    this.velocity = { x: 0, y: 0 };
    this.keys = { w: false, a: false, s: false, d: false };
    this.lastDbUpdate = 0;
    this.lastInteractionCheck = 0;
    this.isInteractionBlocked = false;
    this.pendingInteraction = null;

    this.setupEventListeners();
    console.log('Event listeners set up, Game constructor complete');
  }

  setupEventListeners() {
    // Login form handlers
    window.login = () => this.handleLogin();
    window.register = () => this.handleRegister();
    window.logout = () => this.logout();



    // Mouse wheel zoom
    this.renderer.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.renderer.zoomIn();
      } else {
        this.renderer.zoomOut();
      }
    });

    // Canvas click for pixel placement
    this.renderer.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    // Real-time keyboard input
    window.addEventListener('keydown', (e) => this.handleKeyDown(e));
    window.addEventListener('keyup', (e) => this.handleKeyUp(e));

    // Reset keys when window loses focus (prevents stuck keys)
    window.addEventListener('blur', () => this.resetKeys());
    window.addEventListener('focus', () => this.resetKeys());

    // Interaction prompt handler
    window.dismissInteraction = () => this.dismissInteraction();
  }

  async handleLogin() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      const user = await this.auth.login(email, password);
      this.ui.hideLogin();
      await this.startGame(user);
    } catch (error) {
      this.ui.updateLoginStatus(error.message);
    }
  }

  async handleRegister() {
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    try {
      await this.auth.register(email, password);
      this.ui.updateLoginStatus('Registration successful! Please check your email (if confirmation is enabled) or log in.');
    } catch (error) {
      this.ui.updateLoginStatus(error.message);
    }
  }

  async startGame(user) {
    try {
      // Initialize game components
      await this.player.initPlayer(user);
      this.currentPlayer = this.player.getCurrentPlayer();

      // Load player inventory
      if (this.currentPlayer.inventory) {
        this.inventory.loadInventoryData(this.currentPlayer.inventory);
      } else {
        // Give new players starting items
        this.inventory.addItem('Gold Coins', 10);
        this.inventory.addItem('Rum Bottles', 3);
        this.inventory.addItem('Cannon Balls', 20);
        this.inventory.addItem('Red Pixel Pack', 2);
        this.inventory.addItem('Blue Pixel Pack', 2);
      }

      // Pass Supabase client to world manager and load islands
      // Set up world manager with supabase client and ensure all methods exist
      this.world.supabase = this.auth.getSupabase();

      // Add missing methods directly to the world instance
      this.setupWorldManagerMethods();

      // Try to load islands
      try {
        await this.world.loadIslands();
      } catch (error) {
        console.error('Error loading islands:', error);
        this.world.generateLocalIslands();
      }

      // Initialize random interactions with world manager
      this.randomInteractions = new RandomInteractionManager(this.world);

      // Initialize AI ships
      this.aiShips = new AIShipManager(this.world, this.randomInteractions);

      // Initialize player interaction system
      this.interactions = new InteractionManager(
        this.auth.getSupabase(),
        this.player,
        this.ui
      );

      // Initialize pixel manager
      this.pixelManager = new PixelManager(this.auth.getSupabase());
      
      // Ensure all pixels are loaded for this player
      await this.pixelManager.loadPlacedPixels();

      // Set initial zoom and center on player
      this.renderer.setZoom(CONFIG.ZOOM.DEFAULT);
      this.renderer.centerOnPlayer(this.currentPlayer);

      // Reset keys and movement state before starting
      this.resetKeys();

      // Start real-time game loop
      this.isGameRunning = true;
      this.startRealtimeGameLoop();

      // Start polling for other players
      setInterval(() => this.updateMultiplayer(), CONFIG.PLAYER_POLLING_INTERVAL);

      // Make interaction managers globally available for HTML onclick handlers
      window.game = {
        interactions: this.interactions,
        combat: null,
        trade: null,
        chat: null,
        aiShips: this.aiShips,
        player: this.player,
        addToInteractionHistory: (message) => this.addToInteractionHistory(message),
        useInventoryItem: (itemName) => this.useInventoryItem(itemName),
        showFullInventory: () => this.showFullInventory(),
        craftItem: (recipeName) => this.craftItem(recipeName),
        // Enhanced stats methods
        showAchievements: () => this.ui.showAchievements(this.player),
        showDetailedStats: () => this.ui.showDetailedStats(this.player),
        // Debug methods
        checkKeys: () => console.log('Keys:', this.keys, 'Velocity:', this.velocity),
        resetKeys: () => this.resetKeys(),
        // Trading methods
        openTradingMenu: (port) => this.openTradingMenu(port),
        buyItem: (itemName, price, portId) => this.buyItem(itemName, price, portId),
        sellItem: (itemName, price, portId) => this.sellItem(itemName, price, portId)
      };

      // Update UI to show real-time controls
      this.ui.updateMoveTimer(0, false, true); // true for real-time mode

    } catch (error) {
      console.error('Failed to start game:', error);
      this.ui.updateLoginStatus('Failed to start game: ' + error.message);
    }
  }

  startRealtimeGameLoop() {
    const gameLoop = () => {
      if (!this.isGameRunning) return;

      this.updatePlayerMovement();
      this.updatePlayerRotation();
      this.checkInteractions();
      this.updateDatabase();
      this.updateDisplay();

      requestAnimationFrame(gameLoop);
    };

    requestAnimationFrame(gameLoop);
  }

  updatePlayerMovement() {
    if (this.isInteractionBlocked || !this.currentPlayer) return;

    // Calculate movement based on keys pressed
    let moveX = 0, moveY = 0;

    if (this.keys.w) moveY = -1;
    if (this.keys.s) moveY = 1;
    if (this.keys.a) moveX = -1;
    if (this.keys.d) moveX = 1;

    // Normalize diagonal movement
    if (moveX !== 0 && moveY !== 0) {
      moveX *= 0.707; // 1/sqrt(2)
      moveY *= 0.707;
    }

    // Apply movement speed
    this.velocity.x = moveX * CONFIG.REALTIME_MOVEMENT.SPEED;
    this.velocity.y = moveY * CONFIG.REALTIME_MOVEMENT.SPEED;

    // Calculate target rotation based on movement
    if (moveX !== 0 || moveY !== 0) {
      this.targetRotation = Math.atan2(moveY, moveX);
    }

    // Store old position for distance calculation
    const oldX = this.currentPlayer.x;
    const oldY = this.currentPlayer.y;

    // Apply velocity to position
    const newX = this.currentPlayer.x + this.velocity.x;
    const newY = this.currentPlayer.y + this.velocity.y;

    // Check bounds and collisions
    if (this.isValidPosition(newX, newY)) {
      this.currentPlayer.x = newX;
      this.currentPlayer.y = newY;

      // Track distance traveled for stats
      if (moveX !== 0 || moveY !== 0) {
        const distance = Math.sqrt((newX - oldX) ** 2 + (newY - oldY) ** 2);
        this.player.updateStat('distanceTraveled', distance);
      }
    }
  }

  updatePlayerRotation() {
    // Smooth rotation towards target
    let rotDiff = this.targetRotation - this.playerRotation;

    // Handle rotation wrapping
    if (rotDiff > Math.PI) rotDiff -= 2 * Math.PI;
    if (rotDiff < -Math.PI) rotDiff += 2 * Math.PI;

    // Apply rotation speed
    if (Math.abs(rotDiff) > 0.01) {
      this.playerRotation += rotDiff * CONFIG.REALTIME_MOVEMENT.ROTATION_SPEED;
    }
  }

  checkInteractions() {
    const now = Date.now();
    if (now - this.lastInteractionCheck < CONFIG.REALTIME_MOVEMENT.INTERACTION_CHECK_INTERVAL) return;

    this.lastInteractionCheck = now;

    // Only check for interactions if player is actively moving
    const isMoving = this.keys.w || this.keys.s || this.keys.a || this.keys.d;

    if (isMoving && Math.random() < CONFIG.INTERACTION_CHANCE && !this.isInteractionBlocked) {
      console.log('Triggering random interaction...');
      this.processRandomInteraction();
    }
  }

  updateDatabase() {
    const now = Date.now();
    if (now - this.lastDbUpdate < CONFIG.REALTIME_MOVEMENT.DB_UPDATE_INTERVAL) return;

    this.lastDbUpdate = now;

    // Update position in database
    this.player.updatePlayerPosition(
      Math.round(this.currentPlayer.x),
      Math.round(this.currentPlayer.y)
    ).catch(error => {
      console.error('Failed to update position:', error);
    });
  }

  updateDisplay() {
    if (!this.currentPlayer) return;

    // Clean up old water objects periodically
    this.world.cleanupOldObjects();

    // Pixels are now permanent - no cleanup needed

    // Update AI ships
    if (this.aiShips) {
      this.aiShips.updateAIShipsRealtime();
    }

    // Get AI ships and combine with player ships
    const allPlayers = this.player.getAllPlayers();
    const aiShips = this.aiShips ? this.aiShips.getAIShips() : [];
    const allShips = [...allPlayers, ...aiShips];

    // Get placed pixels for rendering
    const placedPixels = this.pixelManager ? this.pixelManager.getAllPixels() : [];

    this.renderer.drawOcean(this.world.getIslands(), this.world.getWaterObjects(), placedPixels);
    this.renderer.drawPlayers(allShips, this.currentPlayer, this.playerRotation);
    this.renderer.centerOnPlayer(this.currentPlayer);
    this.ui.updatePlayerStats(this.currentPlayer, this.renderer.getZoom(), this.player);
    this.ui.updateInventory(this.inventory);
    
    // Update UI with pixel mode status
    const pixelMode = this.pixelManager ? this.pixelManager.getCurrentPixelColor() : null;
    this.ui.updateMoveTimer(0, false, true, pixelMode);

    // Check for nearby trading ports
    this.checkNearbyTradingPorts();
  }

  async updateMultiplayer() {
    await this.player.fetchAllPlayers();
  }

  isValidPosition(x, y) {
    // Check bounds
    if (x < 5 || x >= CONFIG.OCEAN_WIDTH - 5 || y < 5 || y >= CONFIG.OCEAN_HEIGHT - 5) {
      return false;
    }

    // Check world collisions
    return this.world.isValidPosition(Math.round(x), Math.round(y));
  }

  handleKeyDown(e) {
    if (this.isInteractionBlocked) return;

    const key = e.key.toLowerCase();
    if (key === 'w') this.keys.w = true;
    if (key === 'a') this.keys.a = true;
    if (key === 's') this.keys.s = true;
    if (key === 'd') this.keys.d = true;
    if (key === 'r') this.repairShip();
    if (key === 'i') this.showFullInventory();
    if (key === 'escape' && this.pixelManager && this.pixelManager.isPixelModeActive()) {
      this.pixelManager.deactivatePixelMode();
      this.addToInteractionHistory('Pixel placement mode cancelled.');
    }
  }

  handleKeyUp(e) {
    const key = e.key.toLowerCase();
    if (key === 'w') this.keys.w = false;
    if (key === 'a') this.keys.a = false;
    if (key === 's') this.keys.s = false;
    if (key === 'd') this.keys.d = false;
  }

  // Add method to reset all keys (useful for debugging)
  resetKeys() {
    this.keys = { w: false, a: false, s: false, d: false };
    this.velocity = { x: 0, y: 0 };
  }

  setupWorldManagerMethods() {
    // Ensure tradingStocks Map exists
    if (!this.world.tradingStocks) {
      this.world.tradingStocks = new Map();
    }

    // Add loadIslands method
    this.world.loadIslands = async () => {
      if (!this.world.supabase) {
        console.warn('No Supabase client provided, falling back to local generation');
        this.world.generateLocalIslands();
        return;
      }

      try {
        const { data: islands, error } = await this.world.supabase
          .from('islands')
          .select('*')
          .order('id');

        if (error) {
          console.error('Error loading islands:', error);
          this.world.generateLocalIslands();
          return;
        }

        this.world.islands = islands.map(island => ({
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

        console.log(`Loaded ${this.world.islands.length} islands from database`);

        // Load trading stocks for all islands
        await this.world.loadTradingStocks();

      } catch (error) {
        console.error('Failed to load islands:', error);
        this.world.generateLocalIslands();
      }
    };

    // Add loadTradingStocks method
    this.world.loadTradingStocks = async () => {
      if (!this.world.supabase) return;

      try {
        const { data: stocks, error } = await this.world.supabase
          .from('trading_stocks')
          .select('*');

        if (error) {
          console.error('Error loading trading stocks:', error);
          return;
        }

        // Group stocks by island_id
        this.world.tradingStocks.clear();
        stocks.forEach(stock => {
          if (!this.world.tradingStocks.has(stock.island_id)) {
            this.world.tradingStocks.set(stock.island_id, []);
          }
          this.world.tradingStocks.get(stock.island_id).push({
            itemName: stock.item_name,
            stockQuantity: stock.stock_quantity,
            buyPrice: stock.buy_price,
            sellPrice: stock.sell_price,
            lastRestock: stock.last_restock
          });
        });

        console.log(`Loaded trading stocks for ${this.world.tradingStocks.size} islands`);

      } catch (error) {
        console.error('Failed to load trading stocks:', error);
      }
    };

    // Add generateLocalIslands method
    this.world.generateLocalIslands = () => {
      this.world.islands = [];
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

        this.world.islands.push({
          id: i + 1,
          cx, cy, rx, ry,
          portX, portY,
          portName: portNames[i % portNames.length],
          portType: 'trading'
        });
      }

      console.log(`Generated ${this.world.islands.length} local islands`);
    };

    // Add isNearPort method
    this.world.isNearPort = (x, y, distance = 30) => {
      for (const isl of this.world.islands) {
        if (!isl.portX || !isl.portY) continue;
        const dx = x - isl.portX;
        const dy = y - isl.portY;
        if (Math.sqrt(dx * dx + dy * dy) <= distance) {
          return isl;
        }
      }
      return null;
    };

    // Add getTradingStocks method
    this.world.getTradingStocks = (islandId) => {
      return this.world.tradingStocks?.get(islandId) || [];
    };

    // Add updateTradingStock method
    this.world.updateTradingStock = async (islandId, itemName, newQuantity) => {
      if (!this.world.supabase) return false;

      try {
        const { error } = await this.world.supabase
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
        if (this.world.tradingStocks) {
          const stocks = this.world.tradingStocks.get(islandId);
          if (stocks) {
            const stock = stocks.find(s => s.itemName === itemName);
            if (stock) {
              stock.stockQuantity = newQuantity;
            }
          }
        }

        return true;
      } catch (error) {
        console.error('Failed to update trading stock:', error);
        return false;
      }
    };
  }

  checkNearbyTradingPorts() {
    if (!this.currentPlayer || !this.world) return;

    const nearbyPort = this.world.isNearPort(this.currentPlayer.x, this.currentPlayer.y, 50);

    if (nearbyPort) {
      this.ui.showTradingPortButton(nearbyPort);
    } else {
      this.ui.hideTradingPortButton();
    }
  }

  async repairShip() {
    if (!this.currentPlayer || this.isInteractionBlocked) return;

    // Check if player needs repairs
    if (this.currentPlayer.hull >= 100) {
      this.addToInteractionHistory('Yer ship is already in perfect condition!');
      return;
    }

    try {
      // Repair 15-25 hull points
      const repairAmount = Math.floor(Math.random() * 11) + 15;
      const newHull = Math.min(100, this.currentPlayer.hull + repairAmount);

      await this.player.updatePlayerStats({ hull: newHull });
      this.currentPlayer.hull = newHull;

      this.addToInteractionHistory(`🔧 Repairs complete! Restored ${repairAmount} hull points!`);

    } catch (error) {
      console.error('Repair failed:', error);
      this.addToInteractionHistory('Repair failed: ' + error.message);
    }
  }

  showInteractionPrompt(interaction) {
    console.log('showInteractionPrompt called with:', interaction.text);
    this.isInteractionBlocked = true;
    this.pendingInteraction = interaction;

    // Show interaction modal
    const modal = document.getElementById('interactionModal');
    const content = document.getElementById('modalContent');

    console.log('Modal elements:', { modal: !!modal, content: !!content });

    content.innerHTML = `
      <div style="text-align:center; color:#FFD700; font-size:1.5em; margin-bottom:20px;">
        🦜 Pirate Encounter! 🦜
      </div>
      <div style="color:#FFD700; text-align:center; margin-bottom:20px; font-size:1.1em; line-height:1.4;">
        ${interaction.text}
      </div>
      <div style="text-align:center;">
        <button onclick="window.dismissInteraction()" 
                style="background:#FFD700; color:#2d1a06; border:none; border-radius:6px; padding:12px 24px; cursor:pointer; font-size:1.1em; font-weight:bold;">
          Continue Sailing
        </button>
      </div>
    `;

    modal.style.display = 'block';

    // Add to history
    this.addToInteractionHistory(interaction.text);
  }

  async dismissInteraction() {
    this.isInteractionBlocked = false;

    // Hide modal
    const modal = document.getElementById('interactionModal');
    modal.style.display = 'none';

    if (this.pendingInteraction) {
      // Store original hull for lucky charm protection
      const originalHull = this.currentPlayer.hull;

      // Apply the interaction effect
      const result = this.pendingInteraction.action(this.currentPlayer);

      // Check for lucky charm protection
      if (this.currentPlayer.luckyCharmActive && this.currentPlayer.hull < originalHull) {
        const damage = originalHull - this.currentPlayer.hull;
        const reducedDamage = Math.ceil(damage / 2);
        this.currentPlayer.hull = originalHull - reducedDamage;

        this.currentPlayer.luckyCharmUses--;
        if (this.currentPlayer.luckyCharmUses <= 0) {
          this.currentPlayer.luckyCharmActive = false;
          this.addToInteractionHistory('🍀 Lucky charm protection expired!');
        } else {
          this.addToInteractionHistory(`🍀 Lucky charm reduced damage by ${damage - reducedDamage}! (${this.currentPlayer.luckyCharmUses} uses left)`);
        }
      }

      // Handle inventory reward if present
      if (this.pendingInteraction.inventoryReward) {
        const reward = this.pendingInteraction.inventoryReward;
        if (this.inventory.addItem(reward.item, reward.quantity)) {
          const message = `🎁 Bonus: Found ${reward.quantity} ${reward.item}!`;
          this.addToInteractionHistory(message);
          this.ui.showInventoryNotification(message, 'success');
          
          // Track treasure finding and award XP
          if (reward.item.includes('Treasure') || reward.item.includes('Gold') || reward.item.includes('Pearls')) {
            await this.player.updateStat('treasuresFound', 1);
            await this.player.addXP(50, 'Treasure found!');
          } else {
            await this.player.addXP(15, 'Item found!');
          }
        }
      }

      // Add the main interaction message
      this.addToInteractionHistory(this.pendingInteraction.text);

      // Spawn water object if specified
      if (this.pendingInteraction.waterObject) {
        this.world.addWaterObject(
          this.currentPlayer.x + (Math.random() - 0.5) * 60,
          this.currentPlayer.y + (Math.random() - 0.5) * 60,
          this.pendingInteraction.waterObject
        );
      }

      // Handle extra move if applicable
      if (result && result.extraMove) {
        this.addToInteractionHistory('Ye get an extra move! The winds favor ye!');
      }

      // Update UI
      this.ui.updatePlayerStats(this.currentPlayer, this.renderer.getZoom());
      this.ui.updateInventory(this.inventory);

      // Save to database
      await this.savePlayerData();
    }

    this.pendingInteraction = null;
  }

  addToInteractionHistory(message) {
    this.interactionHistory.unshift(message);
    if (this.interactionHistory.length > 8) {
      this.interactionHistory.length = 8;
    }
    this.ui.updateInteractionLog(this.interactionHistory);
  }

  async logout() {
    try {
      // Stop the game loop
      this.isGameRunning = false;

      // Update final position and inventory to database
      if (this.currentPlayer) {
        await this.player.updatePlayerPosition(
          Math.round(this.currentPlayer.x),
          Math.round(this.currentPlayer.y)
        );

        // Save inventory
        await this.player.updatePlayerStats({
          inventory: this.inventory.getInventoryData()
        });
      }

      // Logout from auth
      await this.auth.logout();

      // Clean up pixel manager
      if (this.pixelManager) {
        this.pixelManager.destroy();
        this.pixelManager = null;
      }

      // Reset game state
      this.currentPlayer = null;
      this.isInteractionBlocked = false;
      this.keys = { w: false, a: false, s: false, d: false };

      // Show login screen
      this.ui.showLogin();

    } catch (error) {
      console.error('Logout failed:', error);
    }
  }

  // Canvas click handler for pixel placement
  handleCanvasClick(e) {
    if (!this.pixelManager || !this.pixelManager.isPixelModeActive()) return;

    const worldCoords = this.renderer.screenToWorld(e.clientX, e.clientY);
    
    // Check if click is within game bounds
    if (worldCoords.x < 0 || worldCoords.x >= CONFIG.OCEAN_WIDTH || 
        worldCoords.y < 0 || worldCoords.y >= CONFIG.OCEAN_HEIGHT) {
      return;
    }

    // Check if click is on an island (don't allow pixel placement on islands)
    if (!this.world.isValidPosition(Math.round(worldCoords.x), Math.round(worldCoords.y))) {
      this.addToInteractionHistory('❌ Cannot place pixels on islands!');
      this.ui.showInventoryNotification('Cannot place pixels on islands!', 'error');
      return;
    }

    this.placePixel(worldCoords.x, worldCoords.y);
  }

  async placePixel(x, y) {
    if (!this.pixelManager || !this.currentPlayer) return;

    const result = await this.pixelManager.placePixel(x, y, this.currentPlayer.id);
    
    if (result.success) {
      this.addToInteractionHistory(result.message);
      this.ui.showInventoryNotification(result.message, 'success');
      
      // Track pixel placement and award XP
      await this.player.updateStat('pixelsPlaced', 1);
      await this.player.addXP(10, 'Pixel placed!');
      
      // Deactivate pixel mode after successful placement
      this.pixelManager.deactivatePixelMode();
      this.addToInteractionHistory('Pixel mode deactivated. Use another pixel pack to continue placing pixels.');
    } else {
      this.addToInteractionHistory(`❌ ${result.message}`);
      this.ui.showInventoryNotification(result.message, 'error');
    }
  }

  // Inventory management methods
  useInventoryItem(itemName) {
    if (!this.currentPlayer || !this.inventory) return;

    const result = this.inventory.useItem(itemName, this.currentPlayer);

    if (result.success) {
      this.addToInteractionHistory(result.message);
      this.ui.showInventoryNotification(result.message, 'success');

      // Handle pixel pack activation
      if (result.activatePixelMode && this.pixelManager) {
        this.pixelManager.activatePixelMode(result.activatePixelMode);
        this.addToInteractionHistory('Click on the map to place your pixel!');
      }

      // Update UI to reflect changes
      this.ui.updateInventory(this.inventory);
      this.ui.updatePlayerStats(this.currentPlayer, this.renderer.getZoom());

      // Save changes to database
      this.savePlayerData();
    } else {
      this.addToInteractionHistory(`❌ ${result.message}`);
      this.ui.showInventoryNotification(result.message, 'error');
    }
  }

  showFullInventory() {
    if (!this.inventory) return;
    this.ui.showFullInventory(this.inventory);
  }

  async craftItem(recipeName) {
    if (!this.inventory) return;

    const result = this.inventory.craftItem(recipeName);

    if (result.success) {
      this.addToInteractionHistory(result.message);
      this.ui.showInventoryNotification(result.message, 'success');

      // Track crafting and award XP
      await this.player.updateStat('itemsCrafted', 1);
      await this.player.addXP(25, 'Item crafted!');

      // Update UI to reflect changes
      this.ui.updateInventory(this.inventory);

      // Save changes to database
      this.savePlayerData();
    } else {
      this.addToInteractionHistory(`❌ ${result.message}`);
      this.ui.showInventoryNotification(result.message, 'error');
    }
  }

  async savePlayerData() {
    if (!this.currentPlayer) return;

    try {
      await this.player.updatePlayerStats({
        hull: this.currentPlayer.hull,
        crew: this.currentPlayer.crew,
        inventory: this.inventory.getInventoryData()
      });
    } catch (error) {
      console.error('Failed to save player data:', error);
    }
  }

  // Enhanced interaction system with inventory rewards
  async processRandomInteraction() {
    if (!this.randomInteractions || !this.currentPlayer) {
      console.log('processRandomInteraction early return:', {
        randomInteractions: !!this.randomInteractions,
        currentPlayer: !!this.currentPlayer
      });
      return;
    }

    console.log('Processing random interaction...');
    const interaction = this.randomInteractions.getRandomInteraction();
    console.log('Got interaction:', interaction.text);

    // Add inventory rewards to the interaction
    const inventoryRewards = [
      { chance: 0.15, items: [{ name: 'Gold Coins', quantity: [1, 5] }] },
      { chance: 0.10, items: [{ name: 'Rum Bottles', quantity: [1, 2] }] },
      { chance: 0.08, items: [{ name: 'Wooden Planks', quantity: [1, 3] }] },
      { chance: 0.05, items: [{ name: 'Pearls', quantity: [1, 2] }] },
      { chance: 0.03, items: [{ name: 'Treasure Maps', quantity: 1 }] },
      { chance: 0.02, items: [{ name: 'Lucky Charm', quantity: 1 }] },
      { chance: 0.04, items: [
        { name: 'Red Pixel Pack', quantity: [1, 3] },
        { name: 'Blue Pixel Pack', quantity: [1, 3] },
        { name: 'Green Pixel Pack', quantity: [1, 3] },
        { name: 'Yellow Pixel Pack', quantity: [1, 3] },
        { name: 'Purple Pixel Pack', quantity: [1, 3] }
      ]}
    ];

    // Check for inventory rewards and add to interaction
    for (const reward of inventoryRewards) {
      if (Math.random() < reward.chance) {
        const item = reward.items[Math.floor(Math.random() * reward.items.length)];
        const quantity = Array.isArray(item.quantity) ?
          Math.floor(Math.random() * (item.quantity[1] - item.quantity[0] + 1)) + item.quantity[0] :
          item.quantity;

        interaction.inventoryReward = { item: item.name, quantity };
        break; // Only one reward per interaction
      }
    }

    // Show the interaction prompt instead of applying immediately
    console.log('Showing interaction prompt for:', interaction.text);
    this.showInteractionPrompt(interaction);
  }

  // Trading system methods
  openTradingMenu(port) {
    if (!port || !this.world || !this.inventory) return;

    const stocks = this.world.getTradingStocks(port.id);
    this.ui.showTradingMenu(port, stocks, this.inventory);
  }

  async buyItem(itemName, price, portId) {
    if (!this.inventory || !this.world) return;

    const playerGold = this.inventory.getItemQuantity('Gold Coins');

    if (playerGold < price) {
      this.ui.showInventoryNotification(`❌ Not enough gold! Need ${price}, have ${playerGold}`, 'error');
      return;
    }

    // Check if port has the item in stock
    const stocks = this.world.getTradingStocks(portId);
    const stock = stocks.find(s => s.itemName === itemName);

    if (!stock || stock.stockQuantity <= 0) {
      this.ui.showInventoryNotification(`❌ ${itemName} is out of stock!`, 'error');
      return;
    }

    // Perform the transaction
    if (this.inventory.removeItem('Gold Coins', price) && this.inventory.addItem(itemName, 1)) {
      // Update port stock
      await this.world.updateTradingStock(portId, itemName, stock.stockQuantity - 1);

      this.ui.showInventoryNotification(`✅ Bought ${itemName} for ${price} gold!`, 'success');
      this.addToInteractionHistory(`🛒 Purchased ${itemName} for ${price} gold`);

      // Update UI
      this.ui.updateInventory(this.inventory);
      await this.savePlayerData();

      // Close and reopen trading menu to refresh
      document.getElementById('tradingModal').remove();
      setTimeout(() => {
        const port = this.world.islands.find(i => i.id === portId);
        if (port) this.openTradingMenu(port);
      }, 100);
    } else {
      this.ui.showInventoryNotification(`❌ Transaction failed - inventory full?`, 'error');
    }
  }

  async sellItem(itemName, price, portId) {
    if (!this.inventory || !this.world) return;

    if (!this.inventory.hasItem(itemName, 1)) {
      this.ui.showInventoryNotification(`❌ You don't have any ${itemName} to sell!`, 'error');
      return;
    }

    // Perform the transaction
    if (this.inventory.removeItem(itemName, 1)) {
      this.inventory.addItem('Gold Coins', price);

      // Update port stock (increase their stock when we sell to them)
      const stocks = this.world.getTradingStocks(portId);
      const stock = stocks.find(s => s.itemName === itemName);
      if (stock) {
        await this.world.updateTradingStock(portId, itemName, stock.stockQuantity + 1);
      }

      this.ui.showInventoryNotification(`✅ Sold ${itemName} for ${price} gold!`, 'success');
      this.addToInteractionHistory(`💰 Sold ${itemName} for ${price} gold`);

      // Update UI
      this.ui.updateInventory(this.inventory);
      await this.savePlayerData();

      // Close and reopen trading menu to refresh
      document.getElementById('tradingModal').remove();
      setTimeout(() => {
        const port = this.world.islands.find(i => i.id === portId);
        if (port) this.openTradingMenu(port);
      }, 100);
    } else {
      this.ui.showInventoryNotification(`❌ Failed to sell ${itemName}`, 'error');
    }
  }


}

// Initialize game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  try {
    console.log('Initializing Pirate Pixel Yar game...');
    window.game = new Game();
    console.log('Game initialized successfully');
  } catch (error) {
    console.error('Failed to initialize game:', error);
  }
});