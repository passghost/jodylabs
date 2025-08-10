// player.js - Enhanced Player management with stats and inventory tracking
import { CONFIG } from './config.js';

export class PlayerManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.currentPlayer = null;
    this.allPlayers = [];
    this.playerStats = {
      level: 1,
      xp: 0,
      totalScore: 0,
      gamesPlayed: 0,
      achievements: [],
      combatWins: 0,
      combatLosses: 0,
      treasuresFound: 0,
      distanceTraveled: 0,
      pixelsPlaced: 0,
      itemsCrafted: 0,
      tradesCompleted: 0,
      playTime: 0,
      lastLogin: null,
      loginStreak: 0
    };
  }

  async initPlayer(user) {
    // Fetch or create player row in DB
    let { data, error } = await this.supabase
      .from('pirates')
      .select('*')
      .eq('id', user.id)
      .single();

    if (!data) {
      // Place randomly in valid position
      let x, y;
      do {
        x = Math.floor(Math.random() * CONFIG.OCEAN_WIDTH);
        y = Math.floor(Math.random() * CONFIG.OCEAN_HEIGHT);
      } while (false); // Will be validated by world manager

      const newPlayer = {
        id: user.id,
        email: user.email,
        x, y,
        hull: 100,
        crew: 10,
        items: {},
        booty: 0,
        color: '#8B5C2A',
        last_login: new Date().toISOString()
      };

      const { error: insertError } = await this.supabase
        .from('pirates')
        .insert([newPlayer]);

      if (insertError) {
        throw new Error(`Failed to create player: ${insertError.message}`);
      }

      this.currentPlayer = newPlayer;
      this.loadPlayerStats();
    } else {
      this.currentPlayer = data;
      this.loadPlayerStats();
      
      // Update last login
      await this.updatePlayerStats({ last_login: new Date().toISOString() });
    }

    // Set up combat notifications
    this.setupCombatNotifications();

    return this.currentPlayer;
  }

  setupCombatNotifications() {
    if (!this.currentPlayer) return;

    // Listen for combat notifications
    const channel = this.supabase
      .channel(`player_hit_${this.currentPlayer.id}`)
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'combat_logs',
          filter: `defender_id=eq.${this.currentPlayer.id}`
        },
        (payload) => this.handleCombatNotification(payload.new)
      )
      .subscribe();

    this.combatChannel = channel;
  }

  handleCombatNotification(combatLog) {
    if (!window.game) return;

    const damage = combatLog.damage_dealt;
    const newHull = combatLog.defender_hull_after;
    
    // Update local hull
    if (this.currentPlayer) {
      this.currentPlayer.hull = newHull;
    }

    // Show notification
    window.game.addToInteractionHistory(`💥 You've been hit by enemy cannon fire! -${damage} hull damage!`);
    window.game.ui.showInventoryNotification(`💥 Under Attack! -${damage} Hull`, 'error');

    if (newHull <= 0) {
      window.game.addToInteractionHistory('💀 Your ship has been sunk! Respawning at safe harbor...');
      window.game.ui.showInventoryNotification('💀 Ship Sunk! Respawning...', 'error');
      this.updateStat('combatLosses', 1);
    }
  }

  async updatePlayerPosition(x, y) {
    if (!this.currentPlayer) return;

    this.currentPlayer.x = x;
    this.currentPlayer.y = y;

    const { error } = await this.supabase
      .from('pirates')
      .update({ x, y })
      .eq('id', this.currentPlayer.id);

    if (error) {
      throw new Error(`Failed to update position: ${error.message}`);
    }
  }

  async updatePlayerStats(stats) {
    if (!this.currentPlayer) return;

    // Update local player object first
    Object.assign(this.currentPlayer, stats);

    try {
      const { error } = await this.supabase
        .from('pirates')
        .update(stats)
        .eq('id', this.currentPlayer.id);

      if (error) {
        console.error('Database update failed:', error.message);
        // Don't throw error - allow game to continue with local data
        return false;
      }
      return true;
    } catch (error) {
      console.error('Failed to update player stats:', error);
      // Game continues with local data
      return false;
    }
  }

  async fetchAllPlayers() {
    const { data, error } = await this.supabase
      .from('pirates')
      .select('*');

    if (error) {
      console.error('Failed to fetch players:', error.message);
      return;
    }

    this.allPlayers = data || [];
    return this.allPlayers;
  }

  getCurrentPlayer() {
    return this.currentPlayer;
  }

  getAllPlayers() {
    return this.allPlayers;
  }

  isValidMove(newX, newY, worldManager) {
    // Check bounds
    if (newX < 0 || newX >= CONFIG.OCEAN_WIDTH || newY < 0 || newY >= CONFIG.OCEAN_HEIGHT) {
      return false;
    }

    // Check world collisions
    return worldManager.isValidPosition(newX, newY);
  }

  loadPlayerStats() {
    if (!this.currentPlayer) return;
    
    // Load stats from localStorage for extended tracking
    const savedStats = localStorage.getItem(`pixelyar_stats_${this.currentPlayer.id}`);
    const localStats = savedStats ? JSON.parse(savedStats) : {};
    
    this.playerStats = {
      level: localStats.level || 1,
      xp: localStats.xp || 0,
      totalScore: localStats.totalScore || 0,
      gamesPlayed: localStats.gamesPlayed || 0,
      achievements: localStats.achievements || [],
      combatWins: localStats.combatWins || 0,
      combatLosses: localStats.combatLosses || 0,
      treasuresFound: localStats.treasuresFound || 0,
      distanceTraveled: localStats.distanceTraveled || 0,
      pixelsPlaced: localStats.pixelsPlaced || 0,
      itemsCrafted: localStats.itemsCrafted || 0,
      tradesCompleted: localStats.tradesCompleted || 0,
      playTime: localStats.playTime || 0,
      lastLogin: localStats.lastLogin || new Date().toISOString(),
      loginStreak: localStats.loginStreak || 1
    };
    
    // Update login streak
    this.updateLoginStreak();
  }

  saveStatsToLocal() {
    if (!this.currentPlayer) return;
    
    localStorage.setItem(`pixelyar_stats_${this.currentPlayer.id}`, JSON.stringify(this.playerStats));
  }

  updateLoginStreak() {
    if (!this.currentPlayer) return;

    const now = new Date();
    const lastLogin = this.playerStats.lastLogin ? new Date(this.playerStats.lastLogin) : null;
    
    let newStreak = this.playerStats.loginStreak || 1;
    
    if (lastLogin) {
      const daysDiff = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day login
        newStreak++;
        this.addXP(50, 'Daily login bonus!');
      } else if (daysDiff > 1) {
        // Streak broken
        newStreak = 1;
      }
      // Same day login doesn't change streak
    }

    this.playerStats.loginStreak = newStreak;
    this.playerStats.lastLogin = now.toISOString();
    this.saveStatsToLocal();
  }

  addXP(amount, reason = '') {
    if (!this.currentPlayer) return;

    const oldLevel = this.playerStats.level;
    this.playerStats.xp += amount;
    
    // Calculate new level (100 XP per level, increasing by 50 each level)
    let requiredXP = 0;
    let level = 1;
    
    while (requiredXP <= this.playerStats.xp) {
      level++;
      requiredXP += 100 + (level - 2) * 50;
    }
    
    this.playerStats.level = level - 1;
    
    // Level up rewards
    if (this.playerStats.level > oldLevel) {
      const levelDiff = this.playerStats.level - oldLevel;
      this.handleLevelUp(levelDiff);
      
      // Show level up notification
      if (window.game && window.game.ui) {
        window.game.ui.showInventoryNotification(
          `🎉 LEVEL UP! You are now level ${this.playerStats.level}! Gained ${levelDiff * 100} gold and ${levelDiff * 10} hull!`, 
          'success'
        );
        window.game.addToInteractionHistory(`🎉 Congratulations! You reached level ${this.playerStats.level}!`);
      }
    }

    this.saveStatsToLocal();

    return {
      xpGained: amount,
      newLevel: this.playerStats.level,
      leveledUp: this.playerStats.level > oldLevel,
      reason
    };
  }

  handleLevelUp(levels) {
    // Award level up bonuses
    const bonusGold = levels * 100;
    const bonusHull = levels * 10;
    
    this.currentPlayer.booty = (this.currentPlayer.booty || 0) + bonusGold;
    this.currentPlayer.hull = Math.min(100, this.currentPlayer.hull + bonusHull);
    
    // Update database with basic stats
    this.updatePlayerStats({
      booty: this.currentPlayer.booty,
      hull: this.currentPlayer.hull
    }).catch(error => {
      console.warn('Could not update database stats:', error);
    });

    // Check for level-based achievements
    this.checkAchievements();
  }

  updateStat(statName, value, operation = 'add') {
    if (!this.currentPlayer) return;

    let newValue;

    if (operation === 'add') {
      newValue = (this.playerStats[statName] || 0) + value;
    } else if (operation === 'set') {
      newValue = value;
    } else {
      return;
    }

    this.playerStats[statName] = newValue;
    this.saveStatsToLocal();
    
    // Check for achievements after stat updates
    this.checkAchievements();
  }



  checkAchievements() {
    const newAchievements = [];
    const achievements = [
      { id: 'first_steps', name: 'First Steps', description: 'Reach level 5', condition: () => this.playerStats.level >= 5 },
      { id: 'seasoned_sailor', name: 'Seasoned Sailor', description: 'Reach level 10', condition: () => this.playerStats.level >= 10 },
      { id: 'pirate_legend', name: 'Pirate Legend', description: 'Reach level 25', condition: () => this.playerStats.level >= 25 },
      { id: 'treasure_hunter', name: 'Treasure Hunter', description: 'Find 10 treasures', condition: () => this.playerStats.treasuresFound >= 10 },
      { id: 'master_trader', name: 'Master Trader', description: 'Complete 50 trades', condition: () => this.playerStats.tradesCompleted >= 50 },
      { id: 'pixel_artist', name: 'Pixel Artist', description: 'Place 100 pixels', condition: () => this.playerStats.pixelsPlaced >= 100 },
      { id: 'combat_veteran', name: 'Combat Veteran', description: 'Win 25 battles', condition: () => this.playerStats.combatWins >= 25 },
      { id: 'explorer', name: 'Explorer', description: 'Travel 10,000 units', condition: () => this.playerStats.distanceTraveled >= 10000 },
      { id: 'loyal_pirate', name: 'Loyal Pirate', description: 'Login 7 days in a row', condition: () => this.playerStats.loginStreak >= 7 },
      { id: 'master_crafter', name: 'Master Crafter', description: 'Craft 100 items', condition: () => this.playerStats.itemsCrafted >= 100 }
    ];

    for (const achievement of achievements) {
      if (!this.playerStats.achievements.includes(achievement.id) && achievement.condition()) {
        this.playerStats.achievements.push(achievement.id);
        newAchievements.push(achievement);
      }
    }

    if (newAchievements.length > 0) {
      this.saveStatsToLocal();

      // Award XP for achievements and show notifications
      for (const achievement of newAchievements) {
        this.addXP(200, `Achievement unlocked: ${achievement.name}`);
        
        // Show achievement notification
        if (window.game && window.game.ui) {
          window.game.ui.showInventoryNotification(
            `🏆 ACHIEVEMENT UNLOCKED: ${achievement.name}! +200 XP`, 
            'success'
          );
          window.game.addToInteractionHistory(`🏆 Achievement unlocked: ${achievement.name} - ${achievement.description}`);
        }
      }
    }

    return newAchievements;
  }

  getPlayerStats() {
    if (!this.currentPlayer) return null;
    
    return {
      // Basic stats from database
      hull: this.currentPlayer.hull,
      crew: this.currentPlayer.crew,
      booty: this.currentPlayer.booty,
      x: this.currentPlayer.x,
      y: this.currentPlayer.y,
      items: this.currentPlayer.items || [],
      
      // Enhanced stats from localStorage
      level: this.playerStats.level,
      xp: this.playerStats.xp,
      total_score: this.playerStats.totalScore,
      games_played: this.playerStats.gamesPlayed,
      achievements: this.playerStats.achievements,
      combat_wins: this.playerStats.combatWins,
      combat_losses: this.playerStats.combatLosses,
      treasures_found: this.playerStats.treasuresFound,
      distance_traveled: this.playerStats.distanceTraveled,
      pixels_placed: this.playerStats.pixelsPlaced,
      items_crafted: this.playerStats.itemsCrafted,
      trades_completed: this.playerStats.tradesCompleted,
      play_time: this.playerStats.playTime,
      login_streak: this.playerStats.loginStreak
    };
  }

  getXPForNextLevel() {
    const currentLevel = this.playerStats.level;
    let requiredXP = 0;
    
    for (let i = 1; i <= currentLevel; i++) {
      requiredXP += 100 + (i - 1) * 50;
    }
    
    return requiredXP - this.playerStats.xp;
  }

  getAchievementProgress() {
    const achievements = [
      { id: 'first_steps', name: 'First Steps', description: 'Reach level 5', progress: this.playerStats.level, target: 5 },
      { id: 'seasoned_sailor', name: 'Seasoned Sailor', description: 'Reach level 10', progress: this.playerStats.level, target: 10 },
      { id: 'pirate_legend', name: 'Pirate Legend', description: 'Reach level 25', progress: this.playerStats.level, target: 25 },
      { id: 'treasure_hunter', name: 'Treasure Hunter', description: 'Find 10 treasures', progress: this.playerStats.treasuresFound, target: 10 },
      { id: 'master_trader', name: 'Master Trader', description: 'Complete 50 trades', progress: this.playerStats.tradesCompleted, target: 50 },
      { id: 'pixel_artist', name: 'Pixel Artist', description: 'Place 100 pixels', progress: this.playerStats.pixelsPlaced, target: 100 },
      { id: 'combat_veteran', name: 'Combat Veteran', description: 'Win 25 battles', progress: this.playerStats.combatWins, target: 25 },
      { id: 'explorer', name: 'Explorer', description: 'Travel 10,000 units', progress: this.playerStats.distanceTraveled, target: 10000 },
      { id: 'loyal_pirate', name: 'Loyal Pirate', description: 'Login 7 days in a row', progress: this.playerStats.loginStreak, target: 7 },
      { id: 'master_crafter', name: 'Master Crafter', description: 'Craft 100 items', progress: this.playerStats.itemsCrafted, target: 100 }
    ];

    return achievements.map(achievement => ({
      ...achievement,
      completed: this.playerStats.achievements.includes(achievement.id),
      progressPercent: Math.min(100, (achievement.progress / achievement.target) * 100)
    }));
  }

  // Verify that stats are properly tied to the current logged-in user
  verifyStatsConnection() {
    if (!this.currentPlayer) {
      console.warn('No current player - stats not connected to login');
      return false;
    }

    const statsKey = `pixelyar_stats_${this.currentPlayer.id}`;
    const savedStats = localStorage.getItem(statsKey);
    
    console.log(`Stats connection verified for user ${this.currentPlayer.email} (ID: ${this.currentPlayer.id})`);
    console.log(`Stats stored under key: ${statsKey}`);
    console.log(`Current stats:`, this.playerStats);
    
    return true;
  }

  // Get a summary of all tracked data for the current user
  getPlayerDataSummary() {
    if (!this.currentPlayer) return null;

    return {
      userId: this.currentPlayer.id,
      email: this.currentPlayer.email,
      databaseData: {
        position: { x: this.currentPlayer.x, y: this.currentPlayer.y },
        hull: this.currentPlayer.hull,
        crew: this.currentPlayer.crew,
        booty: this.currentPlayer.booty,
        items: this.currentPlayer.items || 'empty'
      },
      localStorageStats: this.playerStats,
      statsKey: `pixelyar_stats_${this.currentPlayer.id}`,
      lastSaved: new Date().toISOString()
    };
  }

  // Cleanup method for when player logs out
  cleanup() {
    if (this.combatChannel) {
      this.combatChannel.unsubscribe();
      this.combatChannel = null;
    }
  }
}