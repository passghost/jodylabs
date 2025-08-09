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
        items: [],
        booty: 0,
        color: '#8B5C2A',
        // Enhanced stats
        level: 1,
        xp: 0,
        total_score: 0,
        games_played: 0,
        achievements: [],
        combat_wins: 0,
        combat_losses: 0,
        treasures_found: 0,
        distance_traveled: 0,
        pixels_placed: 0,
        items_crafted: 0,
        trades_completed: 0,
        play_time: 0,
        last_login: new Date().toISOString(),
        login_streak: 1,
        created_at: new Date().toISOString()
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
      await this.updateLoginStreak();
    }

    return this.currentPlayer;
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

    // Update local player object
    Object.assign(this.currentPlayer, stats);

    const { error } = await this.supabase
      .from('pirates')
      .update(stats)
      .eq('id', this.currentPlayer.id);

    if (error) {
      throw new Error(`Failed to update stats: ${error.message}`);
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
    
    this.playerStats = {
      level: this.currentPlayer.level || 1,
      xp: this.currentPlayer.xp || 0,
      totalScore: this.currentPlayer.total_score || 0,
      gamesPlayed: this.currentPlayer.games_played || 0,
      achievements: this.currentPlayer.achievements || [],
      combatWins: this.currentPlayer.combat_wins || 0,
      combatLosses: this.currentPlayer.combat_losses || 0,
      treasuresFound: this.currentPlayer.treasures_found || 0,
      distanceTraveled: this.currentPlayer.distance_traveled || 0,
      pixelsPlaced: this.currentPlayer.pixels_placed || 0,
      itemsCrafted: this.currentPlayer.items_crafted || 0,
      tradesCompleted: this.currentPlayer.trades_completed || 0,
      playTime: this.currentPlayer.play_time || 0,
      lastLogin: this.currentPlayer.last_login,
      loginStreak: this.currentPlayer.login_streak || 1
    };
  }

  async updateLoginStreak() {
    if (!this.currentPlayer) return;

    const now = new Date();
    const lastLogin = this.currentPlayer.last_login ? new Date(this.currentPlayer.last_login) : null;
    
    let newStreak = this.currentPlayer.login_streak || 1;
    
    if (lastLogin) {
      const daysDiff = Math.floor((now - lastLogin) / (1000 * 60 * 60 * 24));
      
      if (daysDiff === 1) {
        // Consecutive day login
        newStreak++;
        await this.addXP(50, 'Daily login bonus!');
      } else if (daysDiff > 1) {
        // Streak broken
        newStreak = 1;
      }
      // Same day login doesn't change streak
    }

    await this.updatePlayerStats({
      last_login: now.toISOString(),
      login_streak: newStreak
    });

    this.playerStats.loginStreak = newStreak;
    this.playerStats.lastLogin = now.toISOString();
  }

  async addXP(amount, reason = '') {
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
      await this.handleLevelUp(levelDiff);
    }

    await this.updatePlayerStats({
      xp: this.playerStats.xp,
      level: this.playerStats.level
    });

    return {
      xpGained: amount,
      newLevel: this.playerStats.level,
      leveledUp: this.playerStats.level > oldLevel,
      reason
    };
  }

  async handleLevelUp(levels) {
    // Award level up bonuses
    const bonusGold = levels * 100;
    const bonusHull = levels * 10;
    
    this.currentPlayer.booty = (this.currentPlayer.booty || 0) + bonusGold;
    this.currentPlayer.hull = Math.min(100, this.currentPlayer.hull + bonusHull);
    
    await this.updatePlayerStats({
      booty: this.currentPlayer.booty,
      hull: this.currentPlayer.hull
    });

    // Check for level-based achievements
    await this.checkAchievements();
  }

  async updateStat(statName, value, operation = 'add') {
    if (!this.currentPlayer) return;

    const dbField = this.getDbFieldName(statName);
    let newValue;

    if (operation === 'add') {
      newValue = (this.playerStats[statName] || 0) + value;
    } else if (operation === 'set') {
      newValue = value;
    } else {
      return;
    }

    this.playerStats[statName] = newValue;

    const updateData = {};
    updateData[dbField] = newValue;
    
    await this.updatePlayerStats(updateData);
    
    // Check for achievements after stat updates
    await this.checkAchievements();
  }

  getDbFieldName(statName) {
    const fieldMap = {
      totalScore: 'total_score',
      gamesPlayed: 'games_played',
      combatWins: 'combat_wins',
      combatLosses: 'combat_losses',
      treasuresFound: 'treasures_found',
      distanceTraveled: 'distance_traveled',
      pixelsPlaced: 'pixels_placed',
      itemsCrafted: 'items_crafted',
      tradesCompleted: 'trades_completed',
      playTime: 'play_time',
      loginStreak: 'login_streak'
    };
    
    return fieldMap[statName] || statName;
  }

  async checkAchievements() {
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
      await this.updatePlayerStats({
        achievements: this.playerStats.achievements
      });

      // Award XP for achievements
      for (const achievement of newAchievements) {
        await this.addXP(200, `Achievement unlocked: ${achievement.name}`);
      }
    }

    return newAchievements;
  }

  getPlayerStats() {
    if (!this.currentPlayer) return null;
    
    return {
      // Basic stats
      hull: this.currentPlayer.hull,
      crew: this.currentPlayer.crew,
      booty: this.currentPlayer.booty,
      x: this.currentPlayer.x,
      y: this.currentPlayer.y,
      items: this.currentPlayer.items || [],
      
      // Enhanced stats
      level: this.playerStats.level,
      xp: this.playerStats.xp,
      totalScore: this.playerStats.totalScore,
      gamesPlayed: this.playerStats.gamesPlayed,
      achievements: this.playerStats.achievements,
      combatWins: this.playerStats.combatWins,
      combatLosses: this.playerStats.combatLosses,
      treasuresFound: this.playerStats.treasuresFound,
      distanceTraveled: this.playerStats.distanceTraveled,
      pixelsPlaced: this.playerStats.pixelsPlaced,
      itemsCrafted: this.playerStats.itemsCrafted,
      tradesCompleted: this.playerStats.tradesCompleted,
      playTime: this.playerStats.playTime,
      loginStreak: this.playerStats.loginStreak
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
}