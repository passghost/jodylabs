// player.js - Player management and database operations
import { CONFIG } from './config.js';

export class PlayerManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.currentPlayer = null;
    this.allPlayers = [];
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
        color: '#8B5C2A'
      };

      const { error: insertError } = await this.supabase
        .from('pirates')
        .insert([newPlayer]);

      if (insertError) {
        throw new Error(`Failed to create player: ${insertError.message}`);
      }

      this.currentPlayer = newPlayer;
    } else {
      this.currentPlayer = data;
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

  getPlayerStats() {
    if (!this.currentPlayer) return null;
    
    return {
      hull: this.currentPlayer.hull,
      crew: this.currentPlayer.crew,
      booty: this.currentPlayer.booty,
      x: this.currentPlayer.x,
      y: this.currentPlayer.y,
      items: this.currentPlayer.items || []
    };
  }
}