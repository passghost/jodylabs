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
import { MonsterManager } from './monsters.js';
import { PhenomenaManager } from './phenomena.js';

export class Game {
  constructor() {
    console.log('Creating Game instance...');
    this.auth = new AuthManager();
    console.log('AuthManager created');
    this.ui = new UIManager();
    console.log('UIManager created');
    this.world = new WorldManager(null); // Will set supabase later
    console.log('WorldManager created');
    const canvas = document.getElementById('oceanCanvas');
    if (!canvas) {
      throw new Error('Canvas element not found! Make sure oceanCanvas exists in HTML.');
    }
    this.renderer = new Renderer(canvas);
    console.log('Renderer created');
    this.randomInteractions = null; // Will be initialized after world manager
    this.player = new PlayerManager(this.auth.getSupabase());
    console.log('PlayerManager created');
    this.interactions = null; // Will be initialized after login
    this.aiShips = null; // Will be initialized after world manager
    this.inventory = new InventoryManager();
    console.log('InventoryManager created');
    this.pixelManager = null; // Will be initialized after login
    this.monsters = null; // Will be initialized after world manager
    this.phenomena = null; // Will be initialized after world manager

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
    
    // Cannon system
    this.cannonBalls = [];
    this.mouseX = 0;
    this.mouseY = 0;
    this.cannonAngle = 0;
    this.targetCannonAngle = 0;
    this.lastCannonFire = 0;
    
    // Sailing interaction timing
    this.sailingStartTime = null;
    this.lastInteractionTime = 0;

    this.setupEventListeners();
    console.log('Event listeners set up, Game constructor complete');
  }

  setupEventListeners() {
    // Login form handlers (override any existing functions)
    window.login = () => {
      console.log('Login function called');
      this.handleLogin();
    };
    window.register = () => {
      console.log('Register function called');
      this.handleRegister();
    };
    window.logout = () => {
      console.log('Logout function called');
      this.logout();
    };



    // Mouse wheel zoom
    this.renderer.canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      if (e.deltaY < 0) {
        this.renderer.zoomIn();
      } else {
        this.renderer.zoomOut();
      }
    });

    // Canvas click for pixel placement and cannon firing
    this.renderer.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
    this.renderer.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    
    // Also track mouse movement on the entire window to ensure cannon always follows cursor
    window.addEventListener('mousemove', (e) => this.handleGlobalMouseMove(e));
    
    // Change cursor style when over canvas
    this.renderer.canvas.addEventListener('mouseenter', () => {
      this.renderer.canvas.style.cursor = 'crosshair';
    });
    
    this.renderer.canvas.addEventListener('mouseleave', () => {
      this.renderer.canvas.style.cursor = 'default';
    });

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
      console.log('Starting game for user:', user.email);
      
      // Initialize game components
      console.log('Initializing player...');
      await this.player.initPlayer(user);
      this.currentPlayer = this.player.getCurrentPlayer();
      console.log('Player initialized:', this.currentPlayer);

      // Load player inventory
      console.log('Loading inventory...');
      if (this.currentPlayer.items) {
        this.inventory.loadInventoryData(this.currentPlayer.items);
      } else {
        // Give new players starting items
        this.inventory.addItem('Gold Coins', 10);
        this.inventory.addItem('Rum Bottles', 3);
        this.inventory.addItem('Cannon Balls', 20);
        this.inventory.addItem('Red Pixel Pack', 2);
        this.inventory.addItem('Blue Pixel Pack', 2);
      }
      console.log('Inventory loaded');

      // Pass Supabase client to world manager and load islands
      console.log('Setting up world manager...');
      this.world.supabase = this.auth.getSupabase();

      // Add missing methods directly to the world instance
      this.setupWorldManagerMethods();

      // Try to load islands
      console.log('Loading islands...');
      try {
        await this.world.loadIslands();
        console.log('Islands loaded from database');
      } catch (error) {
        console.error('Error loading islands:', error);
        console.log('Falling back to local island generation');
        this.world.generateLocalIslands();
      }

      // Initialize random interactions with world manager
      console.log('Initializing random interactions...');
      this.randomInteractions = new RandomInteractionManager(this.world);

      // Initialize AI ships
      console.log('Initializing AI ships...');
      this.aiShips = new AIShipManager(this.world, this.randomInteractions);

      // Initialize monsters
      console.log('Initializing monsters...');
      this.monsters = new MonsterManager(this.world);

      // Initialize phenomena
      console.log('Initializing phenomena...');
      this.phenomena = new PhenomenaManager(this.world);

      // Initialize player interaction system
      console.log('Initializing player interactions...');
      this.interactions = new InteractionManager(
        this.auth.getSupabase(),
        this.player,
        this.ui
      );

      // Initialize pixel manager
      console.log('Initializing pixel manager...');
      this.pixelManager = new PixelManager(this.auth.getSupabase());
      
      // Ensure all pixels are loaded for this player
      console.log('Loading placed pixels...');
      try {
        await this.pixelManager.loadPlacedPixels();
        console.log('Pixels loaded successfully');
      } catch (error) {
        console.error('Error loading pixels:', error);
        console.log('Continuing without pixels...');
      }

      // Set initial zoom and center on player
      console.log('Setting up renderer...');
      try {
        this.renderer.setZoom(CONFIG.ZOOM.DEFAULT);
        this.renderer.centerOnPlayer(this.currentPlayer);
        console.log('Renderer setup complete');
      } catch (rendererError) {
        console.error('Error setting up renderer:', rendererError);
        throw new Error('Renderer initialization failed: ' + rendererError.message);
      }

      // Reset keys and movement state before starting
      this.resetKeys();

      // Start real-time game loop
      this.isGameRunning = true;
      
      // Reset sailing interaction timers
      this.sailingStartTime = null;
      this.lastInteractionTime = Date.now();
      
      console.log('Starting real-time game loop...');
      try {
        this.startRealtimeGameLoop();
        console.log('Game loop started successfully');
      } catch (gameLoopError) {
        console.error('Error starting game loop:', gameLoopError);
        throw new Error('Game loop failed to start: ' + gameLoopError.message);
      }

      // Start polling for other players
      setInterval(() => this.updateMultiplayer(), CONFIG.PLAYER_POLLING_INTERVAL);

      // Auto-save player data every 30 seconds and track play time
      this.sessionStartTime = Date.now();
      this.autoSaveInterval = setInterval(() => {
        this.updatePlayTime();
        this.savePlayerData();
        this.player.saveStatsToLocal(); // Also save stats to localStorage
      }, 30000);

      // Make interaction managers globally available for HTML onclick handlers
      window.game = {
        interactions: this.interactions,
        combat: null,
        trade: null,
        chat: null,
        aiShips: this.aiShips,
        monsters: this.monsters,
        phenomena: this.phenomena,
        player: this.player,
        currentPlayer: this.currentPlayer,
        inventory: this.inventory,
        ui: this.ui,
        cannonBalls: this.cannonBalls,
        CONFIG: CONFIG, // Make CONFIG globally available
        addToInteractionHistory: (message) => this.addToInteractionHistory(message),
        useInventoryItem: (itemName) => this.useInventoryItem(itemName),
        showFullInventory: () => this.showFullInventory(),
        craftItem: (recipeName) => this.craftItem(recipeName),
        // Enhanced stats methods
        showAchievements: () => this.ui.showAchievements(this.player),
        showDetailedStats: () => this.ui.showDetailedStats(this.player),
        showPlayerProfile: () => this.ui.showPlayerProfile(this.player, this.inventory),
        // Debug and verification methods
        checkKeys: () => console.log('Keys:', this.keys, 'Velocity:', this.velocity),
        resetKeys: () => this.resetKeys(),
        verifyStatsConnection: () => this.player.verifyStatsConnection(),
        getPlayerDataSummary: () => this.player.getPlayerDataSummary(),
        // Trading methods
        openTradingMenu: (port) => this.openTradingMenu(port),
        buyItem: (itemName, price, portId) => this.buyItem(itemName, price, portId),
        sellItem: (itemName, price, portId) => this.sellItem(itemName, price, portId)
      };

      // Update UI to show real-time controls
      console.log('Updating UI for real-time mode...');
      try {
        this.ui.updateMoveTimer(0, false, true); // true for real-time mode
        console.log('UI updated successfully');
      } catch (uiError) {
        console.error('Error updating UI:', uiError);
        // Continue anyway - don't let UI errors stop the game
      }

      console.log('Game started successfully!');

    } catch (error) {
      console.error('Failed to start game:', error);
      console.error('Error stack:', error.stack);
      this.ui.updateLoginStatus('Failed to start game: ' + error.message);
      
      // Show the login screen again if game fails to start
      this.ui.showLogin();
    }
  }

  startRealtimeGameLoop() {
    const gameLoop = () => {
      if (!this.isGameRunning) return;

      this.updatePlayerMovement();
      this.updatePlayerRotation();
      this.updateCannonRotation();
      this.updateCannonBalls();
      this.updateMonsters();
      this.updatePhenomena();
      this.checkInteractions();
      this.updateDatabase();
      this.updateDisplay();

      requestAnimationFrame(gameLoop);
    };

    requestAnimationFrame(gameLoop);
  }

  updatePlayerMovement() {
    if (this.isInteractionBlocked || !this.currentPlayer) return;

    // Check if player is trapped in a vortex
    const isTrapped = this.phenomena && this.phenomena.isShipTrapped(this.currentPlayer.id);
    
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

    // Reduce movement speed if trapped in vortex
    const speedMultiplier = isTrapped ? 0.2 : 1.0;
    
    // Apply movement speed
    this.velocity.x = moveX * CONFIG.REALTIME_MOVEMENT.SPEED * speedMultiplier;
    this.velocity.y = moveY * CONFIG.REALTIME_MOVEMENT.SPEED * speedMultiplier;

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
        
        // Check for red sea entry/exit
        this.checkRedSeaTransition(oldX, newX);
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

  updateCannonRotation() {
    // Smooth cannon rotation towards target (faster than ship rotation)
    let cannonRotDiff = this.targetCannonAngle - this.cannonAngle;

    // Handle rotation wrapping
    if (cannonRotDiff > Math.PI) cannonRotDiff -= 2 * Math.PI;
    if (cannonRotDiff < -Math.PI) cannonRotDiff += 2 * Math.PI;

    // Apply cannon rotation speed (much faster for cursor following)
    const cannonRotationSpeed = 0.25; // Increased from 0.15 for better cursor tracking
    if (Math.abs(cannonRotDiff) > 0.005) { // Reduced threshold for smoother tracking
      this.cannonAngle += cannonRotDiff * cannonRotationSpeed;
    } else {
      // Snap to target when very close to prevent jitter
      this.cannonAngle = this.targetCannonAngle;
    }
  }

  checkInteractions() {
    const now = Date.now();
    if (now - this.lastInteractionCheck < CONFIG.REALTIME_MOVEMENT.INTERACTION_CHECK_INTERVAL) return;

    this.lastInteractionCheck = now;

    // Only check for interactions if player is actively moving
    const isMoving = this.keys.w || this.keys.s || this.keys.a || this.keys.d;

    if (isMoving) {
      // Initialize sailing timer if not set
      if (!this.sailingStartTime) {
        this.sailingStartTime = now;
        this.lastInteractionTime = now;
        this.addToInteractionHistory('⛵ You begin sailing... pirate encounters happen every 15 seconds!');
      }
      
      // Trigger interaction every 15 seconds of sailing time
      if (now - this.lastInteractionTime >= CONFIG.INTERACTION_INTERVAL && !this.isInteractionBlocked) {
        console.log('Triggering pirate interaction after 15 seconds of sailing...');
        this.addToInteractionHistory('🏴‍☠️ After 15 seconds of sailing, you encounter something...');
        this.processRandomInteraction();
        this.lastInteractionTime = now;
      }
    } else {
      // Reset sailing timer when not moving
      this.sailingStartTime = null;
    }
  }

  getSailingTimeUntilNextInteraction() {
    const now = Date.now();
    const isMoving = this.keys.w || this.keys.s || this.keys.a || this.keys.d;
    
    if (!isMoving || !this.sailingStartTime) {
      return null; // Not sailing, no timer to show
    }
    
    const timeSinceLastInteraction = now - this.lastInteractionTime;
    const timeUntilNext = CONFIG.INTERACTION_INTERVAL - timeSinceLastInteraction;
    
    return Math.max(0, timeUntilNext);
  }

  checkRedSeaTransition(oldX, newX) {
    const wasInRedSea = oldX >= CONFIG.RED_SEA.START_X;
    const isInRedSea = newX >= CONFIG.RED_SEA.START_X;
    
    if (!wasInRedSea && isInRedSea) {
      // Entering red sea
      this.addToInteractionHistory('🌊 ⚠️ ENTERING THE RED SEA! ⚠️');
      this.addToInteractionHistory('🏴‍☠️ Danger increased, but better loot awaits...');
      this.ui.showInventoryNotification('⚠️ ENTERED RED SEA - Higher Risk, Better Rewards!', 'error');
    } else if (wasInRedSea && !isInRedSea) {
      // Leaving red sea
      this.addToInteractionHistory('🌊 Returning to safer blue waters...');
      this.ui.showInventoryNotification('✅ Back in Blue Sea - Safer Waters', 'success');
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

    // Only do expensive operations occasionally
    const now = Date.now();
    if (!this.lastExpensiveUpdate) this.lastExpensiveUpdate = 0;
    
    // Clean up old water objects only every 5 seconds
    if (now - this.lastExpensiveUpdate > 5000) {
      this.world.cleanupOldObjects();
      this.lastExpensiveUpdate = now;
    }

    // Update AI ships
    if (this.aiShips) {
      this.aiShips.updateAIShipsRealtime();
    }

    // Get AI ships and combine with player ships
    const allPlayers = this.player.getAllPlayers();
    const aiShips = this.aiShips ? this.aiShips.getAIShips() : [];
    const allShips = [...allPlayers, ...aiShips];

    // Get placed pixels for rendering (cache this)
    if (!this.cachedPixels || now - this.lastPixelUpdate > 1000) {
      this.cachedPixels = this.pixelManager ? this.pixelManager.getAllPixels() : [];
      this.lastPixelUpdate = now;
    }

    // Core rendering (this needs to happen every frame)
    this.renderer.drawOcean(this.world.getIslands(), this.world.getWaterObjects(), this.cachedPixels);
    
    // Combine player and AI cannon balls
    const allCannonBalls = [...this.cannonBalls];
    if (this.aiShips) {
      allCannonBalls.push(...this.aiShips.getAllAICannonBalls());
    }
    
    // Get monsters and phenomena for rendering
    const monsters = this.monsters ? this.monsters.getMonsters() : [];
    const phenomena = this.phenomena ? this.phenomena.getPhenomena() : [];
    
    this.renderer.drawPlayers(allShips, this.currentPlayer, this.playerRotation, this.cannonAngle, allCannonBalls, monsters, phenomena, this.mouseX, this.mouseY);
    this.renderer.centerOnPlayer(this.currentPlayer);
    
    // Update UI less frequently (every 100ms)
    if (!this.lastUIUpdate) this.lastUIUpdate = 0;
    if (now - this.lastUIUpdate > 100) {
      this.ui.updatePlayerStats(this.currentPlayer, this.renderer.getZoom(), this.player);
      
      // Update UI with pixel mode status and sailing timer
      const pixelMode = this.pixelManager ? this.pixelManager.getCurrentPixelColor() : null;
      const sailingTimer = this.getSailingTimeUntilNextInteraction();
      this.ui.updateMoveTimer(0, false, true, pixelMode, sailingTimer);
      
      // Check for nearby trading ports
      this.checkNearbyTradingPorts();
      
      this.lastUIUpdate = now;
    }
    
    // Always update inventory when it changes (but not every frame)
    if (this.inventoryNeedsUpdate) {
      this.ui.updateInventory(this.inventory);
      this.inventoryNeedsUpdate = false;
    }
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
    if (key === ' ') {
      e.preventDefault();
      this.fireCannon();
    }
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

      // Check if in red sea for enhanced danger
      const isInRedSea = this.currentPlayer.x >= CONFIG.RED_SEA.START_X;
      const dangerMultiplier = isInRedSea ? CONFIG.RED_SEA.DANGER_MULTIPLIER : 1;

      // Apply the interaction effect
      const result = this.pendingInteraction.action(this.currentPlayer);

      // Apply red sea danger multiplier to damage
      if (isInRedSea && this.currentPlayer.hull < originalHull) {
        const damage = originalHull - this.currentPlayer.hull;
        const enhancedDamage = Math.floor(damage * dangerMultiplier);
        this.currentPlayer.hull = Math.max(0, originalHull - enhancedDamage);
        
        if (enhancedDamage > damage) {
          this.addToInteractionHistory(`🌊 The red sea's curse amplifies the damage! (+${enhancedDamage - damage} extra damage)`);
        }
      }

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
            this.player.updateStat('treasuresFound', 1);
            this.player.addXP(50, 'Treasure found!');
          } else {
            this.player.addXP(15, 'Item found!');
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

      // Mark inventory for update
      this.inventoryNeedsUpdate = true;

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
      // Stop the game loop and auto-save
      this.isGameRunning = false;
      if (this.autoSaveInterval) {
        clearInterval(this.autoSaveInterval);
        this.autoSaveInterval = null;
      }

      // Update final position and inventory to database
      if (this.currentPlayer) {
        await this.player.updatePlayerPosition(
          Math.round(this.currentPlayer.x),
          Math.round(this.currentPlayer.y)
        );

        // Clean up player subscriptions
        this.player.cleanup();

        // Update local player object and save inventory and final stats
        this.currentPlayer.items = this.inventory.getInventoryData();
        
        await this.player.updatePlayerStats({
          items: this.currentPlayer.items,
          booty: this.currentPlayer.booty,
          hull: this.currentPlayer.hull,
          crew: this.currentPlayer.crew
        });

        // Save extended stats to localStorage
        this.player.saveStatsToLocal();
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

  // Canvas click handler for pixel placement and cannon firing
  handleCanvasClick(e) {
    if (this.pixelManager && this.pixelManager.isPixelModeActive()) {
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
    } else {
      // Fire cannon
      this.fireCannon();
    }
  }

  handleMouseMove(e) {
    if (!this.currentPlayer) return;
    
    const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
    this.mouseX = worldPos.x;
    this.mouseY = worldPos.y;
    
    // Calculate target cannon angle
    const dx = this.mouseX - this.currentPlayer.x;
    const dy = this.mouseY - this.currentPlayer.y;
    this.targetCannonAngle = Math.atan2(dy, dx);
  }

  handleGlobalMouseMove(e) {
    if (!this.currentPlayer || !this.isGameRunning) return;
    
    // Check if mouse is over the canvas
    const canvasRect = this.renderer.canvas.getBoundingClientRect();
    const isOverCanvas = e.clientX >= canvasRect.left && 
                        e.clientX <= canvasRect.right && 
                        e.clientY >= canvasRect.top && 
                        e.clientY <= canvasRect.bottom;
    
    if (isOverCanvas) {
      // Use the canvas-specific handler for accurate world coordinates
      this.handleMouseMove(e);
    } else {
      // When mouse is outside canvas, point cannon toward the edge of the screen
      const worldPos = this.renderer.screenToWorld(e.clientX, e.clientY);
      this.mouseX = worldPos.x;
      this.mouseY = worldPos.y;
      
      // Calculate target cannon angle
      const dx = this.mouseX - this.currentPlayer.x;
      const dy = this.mouseY - this.currentPlayer.y;
      this.targetCannonAngle = Math.atan2(dy, dx);
    }
  }

  fireCannon() {
    if (!this.currentPlayer || !this.inventory.hasItem('Cannon Balls')) return;
    
    const now = Date.now();
    if (now - this.lastCannonFire < 500) return; // 0.5 second cooldown
    
    this.lastCannonFire = now;
    
    // Remove cannon ball from inventory
    this.inventory.removeItem('Cannon Balls', 1);
    this.inventoryNeedsUpdate = true;
    
    // Create cannon ball using current cannon angle (smoothed)
    const cannonBall = {
      id: Date.now() + Math.random(),
      x: this.currentPlayer.x,
      y: this.currentPlayer.y,
      vx: Math.cos(this.cannonAngle) * 3,
      vy: Math.sin(this.cannonAngle) * 3,
      life: 100, // Travel distance
      fromPlayer: true
    };
    
    this.cannonBalls.push(cannonBall);
    this.addToInteractionHistory('💥 Cannon fired!');
  }

  updateCannonBalls() {
    for (let i = this.cannonBalls.length - 1; i >= 0; i--) {
      const ball = this.cannonBalls[i];
      
      // Update position
      ball.x += ball.vx;
      ball.y += ball.vy;
      ball.life--;
      
      // Check bounds
      if (ball.x < 0 || ball.x >= CONFIG.OCEAN_WIDTH || 
          ball.y < 0 || ball.y >= CONFIG.OCEAN_HEIGHT || 
          ball.life <= 0) {
        this.cannonBalls.splice(i, 1);
        continue;
      }
      
      // Check collision with islands
      if (this.world.isIsland(ball.x, ball.y)) {
        this.cannonBalls.splice(i, 1);
        continue;
      }
      
      // Check collision with other ships (if from player)
      if (ball.fromPlayer) {
        const allShips = [...this.player.getAllPlayers(), ...(this.aiShips ? this.aiShips.getAIShips() : [])];
        for (const ship of allShips) {
          if (ship.id === this.currentPlayer.id) continue;
          
          const distance = Math.sqrt((ball.x - ship.x) ** 2 + (ball.y - ship.y) ** 2);
          if (distance < 5) {
            // Hit!
            this.cannonBalls.splice(i, 1);
            this.handleCannonHit(ship, ball);
            break;
          }
        }
        
        // Check collision with monsters
        if (this.monsters) {
          const hitMonster = this.monsters.getMonsterAt(ball.x, ball.y, 3);
          if (hitMonster) {
            this.cannonBalls.splice(i, 1);
            const damage = 25 + Math.floor(Math.random() * 15); // 25-40 damage to monsters
            this.monsters.damageMonster(hitMonster.id, damage);
            break;
          }
        }
        
        // Check collision with phenomena (some can be disrupted)
        if (this.phenomena) {
          const hitPhenomenon = this.phenomena.getPhenomenonAt(ball.x, ball.y, 5);
          if (hitPhenomenon) {
            this.cannonBalls.splice(i, 1);
            this.handlePhenomenonHit(hitPhenomenon);
            break;
          }
        }
      }
    }
  }

  updateMonsters() {
    if (this.monsters) {
      this.monsters.updateMonstersRealtime();
    }
  }

  updatePhenomena() {
    if (this.phenomena) {
      this.phenomena.updatePhenomenaRealtime();
    }
  }

  handlePhenomenonHit(phenomenon) {
    switch (phenomenon.type) {
      case 'vortex':
        // Cannon balls can disrupt vortexes
        phenomenon.duration = Math.max(0, phenomenon.duration - 5000);
        phenomenon.trappedShips.clear();
        this.addToInteractionHistory('💥 Cannon fire disrupts the vortex!');
        break;
      case 'storm':
        // Cannon balls can disperse storms slightly
        phenomenon.duration = Math.max(0, phenomenon.duration - 3000);
        this.addToInteractionHistory('💥 Cannon fire weakens the storm!');
        break;
      case 'siren':
        // Cannon balls scare away sirens
        phenomenon.duration = Math.max(0, phenomenon.duration - 8000);
        this.addToInteractionHistory('💥 Cannon fire scares away the siren!');
        break;
      case 'ufo':
        // UFOs are immune but may retaliate
        if (Math.random() < 0.3) {
          this.currentPlayer.hull = Math.max(0, this.currentPlayer.hull - 10);
          this.addToInteractionHistory('🛸 UFO retaliates with energy beam! -10 hull!');
        } else {
          this.addToInteractionHistory('💥 Cannon ball passes through the UFO!');
        }
        break;
      default:
        // Other phenomena are unaffected
        this.addToInteractionHistory(`💥 Cannon ball passes through the ${phenomenon.type}!`);
        break;
    }
  }

  async handleCannonHit(targetShip, cannonBall) {
    const damage = 15 + Math.floor(Math.random() * 10); // 15-25 damage
    
    if (targetShip.isAI) {
      // Update AI ship
      const oldHull = targetShip.hull;
      targetShip.hull = Math.max(0, targetShip.hull - damage);
      this.addToInteractionHistory(`💥 Direct hit on enemy ship! -${damage} hull damage!`);
      
      if (targetShip.hull <= 0) {
        this.addToInteractionHistory(`🏴‍☠️ Enemy ship has been sunk!`);
        this.player.addXP(100, 'Enemy ship sunk!');
        this.player.updateStat('combatWins', 1);
        
        // Award loot
        const loot = Math.floor(Math.random() * 20) + 10;
        this.inventory.addItem('Gold Coins', loot);
        this.ui.showInventoryNotification(`💰 Looted ${loot} gold coins!`, 'success');
      }
    } else {
      // Real player hit - update their hull in database and log combat
      try {
        const oldHull = targetShip.hull;
        const newHull = Math.max(0, targetShip.hull - damage);
        const currentPlayerHull = this.currentPlayer.hull;
        
        // Log combat event first
        const { error: logError } = await this.auth.getSupabase()
          .rpc('log_combat_event', {
            attacker_uuid: this.currentPlayer.id,
            defender_uuid: targetShip.id,
            damage: damage,
            attacker_hull_before: currentPlayerHull,
            attacker_hull_after: currentPlayerHull,
            defender_hull_before: oldHull,
            defender_hull_after: newHull,
            winner_uuid: newHull <= 0 ? this.currentPlayer.id : null,
            combat_type_param: 'cannon',
            location_x_param: Math.round(targetShip.x),
            location_y_param: Math.round(targetShip.y)
          });

        if (logError) {
          console.warn('Failed to log combat event:', logError);
        }
        
        // Update target player's hull in database
        const { error } = await this.auth.getSupabase()
          .from('pirates')
          .update({ hull: newHull })
          .eq('id', targetShip.id);

        if (!error) {
          // Update local data
          targetShip.hull = newHull;
          this.addToInteractionHistory(`💥 Direct hit on ${targetShip.email.split('@')[0]}! -${damage} hull damage!`);
          
          // Award XP and stats for successful hit
          this.player.addXP(25, 'Player ship hit!');
          
          if (newHull <= 0) {
            this.addToInteractionHistory(`🏴‍☠️ ${targetShip.email.split('@')[0]} has been sunk!`);
            this.player.addXP(150, 'Player ship sunk!');
            this.player.updateStat('combatWins', 1);
            
            // Award loot for sinking player
            const loot = Math.floor(Math.random() * 30) + 20;
            this.inventory.addItem('Gold Coins', loot);
            this.ui.showInventoryNotification(`💰 Looted ${loot} gold from ${targetShip.email.split('@')[0]}!`, 'success');
            
            // Respawn the defeated player at a safe location
            await this.respawnPlayer(targetShip);
          }
        } else {
          console.error('Failed to update target player hull:', error);
          this.addToInteractionHistory(`💥 Hit ${targetShip.email.split('@')[0]} but failed to sync damage!`);
        }
      } catch (error) {
        console.error('Error in player combat:', error);
        this.addToInteractionHistory(`💥 Hit ${targetShip.email.split('@')[0]} but connection failed!`);
      }
    }
  }

  async respawnPlayer(defeatedPlayer) {
    // Respawn defeated player at a random safe location with restored hull
    const safeX = Math.floor(Math.random() * (CONFIG.RED_SEA.START_X - 200)) + 100;
    const safeY = Math.floor(Math.random() * (CONFIG.OCEAN_HEIGHT - 200)) + 100;
    
    try {
      const { error } = await this.auth.getSupabase()
        .from('pirates')
        .update({ 
          hull: 50, // Respawn with half hull
          x: safeX,
          y: safeY
        })
        .eq('id', defeatedPlayer.id);

      if (!error) {
        // Update local data if this is visible
        defeatedPlayer.hull = 50;
        defeatedPlayer.x = safeX;
        defeatedPlayer.y = safeY;
        
        this.addToInteractionHistory(`⚓ ${defeatedPlayer.email.split('@')[0]} respawned at safe harbor!`);
      }
    } catch (error) {
      console.error('Failed to respawn player:', error);
    }
  }

  async placePixel(x, y) {
    if (!this.pixelManager || !this.currentPlayer) return;

    const result = await this.pixelManager.placePixel(x, y, this.currentPlayer.id);
    
    if (result.success) {
      this.addToInteractionHistory(result.message);
      this.ui.showInventoryNotification(result.message, 'success');
      
      // Track pixel placement and award XP
      this.player.updateStat('pixelsPlaced', 1);
      this.player.addXP(10, 'Pixel placed!');
      
      // Invalidate pixel cache to show new pixel immediately
      this.cachedPixels = null;
      this.lastPixelUpdate = 0;
      
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

      // Mark inventory for update
      this.inventoryNeedsUpdate = true;

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
      this.player.updateStat('itemsCrafted', 1);
      this.player.addXP(25, 'Item crafted!');

      // Mark inventory for update
      this.inventoryNeedsUpdate = true;

      // Save changes to database
      this.savePlayerData();
    } else {
      this.addToInteractionHistory(`❌ ${result.message}`);
      this.ui.showInventoryNotification(result.message, 'error');
    }
  }

  updatePlayTime() {
    if (!this.sessionStartTime || !this.player) return;
    
    const sessionTime = Math.floor((Date.now() - this.sessionStartTime) / 1000);
    this.player.updateStat('playTime', sessionTime);
    this.sessionStartTime = Date.now(); // Reset for next interval
  }

  async savePlayerData() {
    if (!this.currentPlayer) return;

    try {
      // Update play time before saving
      this.updatePlayTime();
      
      // Update local player object to keep it in sync
      this.currentPlayer.items = this.inventory.getInventoryData();
      
      const success = await this.player.updatePlayerStats({
        hull: this.currentPlayer.hull,
        crew: this.currentPlayer.crew,
        booty: this.currentPlayer.booty,
        items: this.currentPlayer.items
      });

      if (!success) {
        console.warn('Database save failed, but game continues with local data');
      }
    } catch (error) {
      console.error('Failed to save player data:', error);
      // Game continues - data is still preserved locally
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
    
    // Check if player is in red sea for enhanced danger/rewards
    const isInRedSea = this.currentPlayer.x >= CONFIG.RED_SEA.START_X;
    const dangerMultiplier = isInRedSea ? CONFIG.RED_SEA.DANGER_MULTIPLIER : 1;
    const lootMultiplier = isInRedSea ? CONFIG.RED_SEA.LOOT_MULTIPLIER : 1;
    
    const interaction = this.randomInteractions.getRandomInteraction();
    console.log('Got interaction:', interaction.text, isInRedSea ? '(RED SEA)' : '(BLUE SEA)');

    // Enhanced inventory rewards based on sea type
    let inventoryRewards;
    if (isInRedSea) {
      // Red sea has better rewards but more dangerous
      inventoryRewards = [
        { chance: 0.25, items: [{ name: 'Gold Coins', quantity: [5, 15] }] },
        { chance: 0.20, items: [{ name: 'Pearls', quantity: [2, 6] }] },
        { chance: 0.15, items: [{ name: 'Treasure Maps', quantity: [1, 3] }] },
        { chance: 0.12, items: [{ name: 'Lucky Charm', quantity: 1 }] },
        { chance: 0.10, items: [{ name: 'Rum Bottles', quantity: [2, 4] }] },
        { chance: 0.08, items: [{ name: 'Medicine', quantity: [2, 5] }] },
        { chance: 0.06, items: [
          { name: 'Red Pixel Pack', quantity: [3, 8] },
          { name: 'Blue Pixel Pack', quantity: [3, 8] },
          { name: 'Green Pixel Pack', quantity: [3, 8] },
          { name: 'Yellow Pixel Pack', quantity: [3, 8] },
          { name: 'Purple Pixel Pack', quantity: [3, 8] }
        ]}
      ];
    } else {
      // Blue sea has normal rewards
      inventoryRewards = [
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
    }

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

      // Track trading stats
      this.player.updateStat('tradesCompleted', 1);
      this.player.addXP(20, 'Item purchased!');

      // Mark inventory for update
      this.inventoryNeedsUpdate = true;
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

      // Track trading stats
      this.player.updateStat('tradesCompleted', 1);
      this.player.addXP(15, 'Item sold!');

      // Mark inventory for update
      this.inventoryNeedsUpdate = true;
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
    console.log('DOM loaded, initializing Pirate Pixel Yar game...');
    window.game = new Game();
    console.log('Game initialized successfully, login functions should be available');
    console.log('window.login exists:', typeof window.login);
    
    // Clear loading message
    const loginStatus = document.getElementById('loginStatus');
    if (loginStatus) {
      loginStatus.textContent = '';
    }
  } catch (error) {
    console.error('Failed to initialize game:', error);
    // Show error to user
    const loginStatus = document.getElementById('loginStatus');
    if (loginStatus) {
      loginStatus.textContent = 'Game failed to initialize. Please refresh the page.';
      loginStatus.style.color = '#ff0000';
    }
  }
});

// Ensure login functions are available immediately (fallback)
if (typeof window !== 'undefined') {
  console.log('Setting up global login functions...');
  
  window.login = function() {
    console.log('Login function called');
    console.log('window.game exists:', !!window.game);
    console.log('window.game type:', typeof window.game);
    
    if (window.game && typeof window.game.handleLogin === 'function') {
      console.log('Calling game.handleLogin()');
      window.game.handleLogin();
    } else {
      console.error('Game not ready. Game exists:', !!window.game);
      if (window.game) {
        console.log('Game methods:', Object.getOwnPropertyNames(window.game));
      }
      
      const loginStatus = document.getElementById('loginStatus');
      if (loginStatus) {
        loginStatus.textContent = 'Game is still loading, please wait...';
        loginStatus.style.color = '#ff6666';
      }
      
      // Try again after a delay
      setTimeout(() => {
        if (window.game && typeof window.game.handleLogin === 'function') {
          console.log('Retrying login after delay');
          window.game.handleLogin();
        } else {
          console.error('Game still not ready after delay');
          if (loginStatus) {
            loginStatus.textContent = 'Game failed to load. Please refresh the page.';
            loginStatus.style.color = '#ff0000';
          }
        }
      }, 2000);
    }
  };

  window.register = () => {
    console.log('Register called, game exists:', !!window.game);
    if (window.game && typeof window.game.handleRegister === 'function') {
      window.game.handleRegister();
    } else {
      console.error('Game not initialized yet or handleRegister not available');
      const loginStatus = document.getElementById('loginStatus');
      if (loginStatus) {
        loginStatus.textContent = 'Game is still loading, please wait...';
        loginStatus.style.color = '#ff6666';
      }
      // Try again in a moment
      setTimeout(() => {
        if (window.game && typeof window.game.handleRegister === 'function') {
          window.game.handleRegister();
        }
      }, 1000);
    }
  };

  window.logout = () => {
    console.log('Logout called, game exists:', !!window.game);
    if (window.game && typeof window.game.logout === 'function') {
      window.game.logout();
    } else {
      console.error('Game not initialized yet or logout not available');
    }
  };
}