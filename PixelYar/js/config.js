// config.js - Game configuration and constants
export const CONFIG = {
  SUPABASE_URL: 'https://omcwjmvdjswkfjkahchm.supabase.co',
  SUPABASE_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE',
  
  OCEAN_WIDTH: 3840,
  OCEAN_HEIGHT: 2160,
  PIXEL_SIZE: 1,
  MOVE_INTERVAL: 5000, // 5 seconds (legacy - now used for interaction checks)
  
  PLAYER_POLLING_INTERVAL: 2000,
  INTERACTION_CHANCE: 0.003, // 0.3% chance per check (every 0.5 seconds while moving)
  
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
  }
};