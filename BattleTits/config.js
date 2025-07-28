// config.js
// Game configuration - edit these values as needed

export const CONFIG = {
  // Supabase configuration
  SUPABASE_URL: 'https://omcwjmvdjswkfjkahchm.supabase.co',
  SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE',
  
  // High score settings
  MAX_HIGH_SCORES: 6,
  MAX_NAME_LENGTH: 20,
  AUTO_REFRESH_INTERVAL: 30000, // 30 seconds
  
  // Game settings
  ENABLE_HIGH_SCORES: true,
  ENABLE_SUPABASE: true, // Set to false to use only localStorage
};