// config.js - Game configuration and constants
export const CONFIG = {
  SUPABASE_URL: 'https://omcwjmvdjswkfjkahchm.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE',
  
  OCEAN_WIDTH: 3840,
  OCEAN_HEIGHT: 2160,
  PIXEL_SIZE: 1,
  MOVE_INTERVAL: 5000, // 5 seconds (legacy - now used for interaction checks)
  
  PLAYER_POLLING_INTERVAL: 2000,
  INTERACTION_INTERVAL: 15000, // Pirate interactions every 15 seconds of sailing time
  
  REALTIME_MOVEMENT: {
    SPEED: 0.5, // pixels per frame at 60fps
    ROTATION_SPEED: 0.05, // radians per frame
    DB_UPDATE_INTERVAL: 1000, // Update database every 1 second
    INTERACTION_CHECK_INTERVAL: 500 // Check for interactions every 0.5 seconds
  },
  
  ZOOM: {
    MIN: 1,
    MAX: 32,
    DEFAULT: 16
  },
  
  ISLANDS: {
    MIN_COUNT: 6,
    MAX_COUNT: 10,
    MIN_RADIUS: 20,
    MAX_RADIUS: 40
  },
  
  RED_SEA: {
    START_X: 2880, // Red sea starts at 75% of ocean width
    DANGER_MULTIPLIER: 2.5, // 2.5x more dangerous
    LOOT_MULTIPLIER: 3.0, // 3x better loot
    COLOR: '#330000', // Dark red tint
    AI_SHIP_MULTIPLIER: 3 // 3x more AI ships
  },
  
  AI_SHIPS: {
    BLUE_SEA_COUNT: 8, // Base number of AI ships in blue area
    RED_SEA_COUNT: 24, // Additional AI ships in red sea
    SPAWN_INTERVAL: 30000, // Spawn new AI ship every 30 seconds
    MAX_TOTAL: 32 // Maximum total AI ships
  }
};