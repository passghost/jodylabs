// highscore.js - Handles high score storage and retrieval via Supabase

// Supabase config (replace with your own project details)
const SUPABASE_URL = 'https://omcwjmvdjswkfjkahchm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE';

// Avoid redeclaring the global `supabase` variable provided by the CDN.
// Use a local `supabaseClient` wrapper instead.
const supabaseClient = (function(){
    try{
        if (window.supabase && typeof window.supabase.createClient === 'function') {
            return window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
                auth: { persistSession: false, autoRefreshToken: false }
            });
        }
    }catch(e){ /* fall through */ }
    // If the global is not present, try to access createClient directly (rare)
    if (typeof createClient === 'function') {
        return createClient(SUPABASE_URL, SUPABASE_KEY, {
            auth: { persistSession: false, autoRefreshToken: false }
        });
    }
    console.warn('Supabase client not available on window; highscores will fail until script is loaded');
    return null;
})();

// Save high score for a user
async function saveHighScore(username, score) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from('highscores')
        .upsert([{ username, score }], { onConflict: ['username'] });
    if (error) {
        console.error('Error saving high score:', error);
    }
    return data;
}

// Get top N high scores
async function getHighScores(limit = 10) {
    if (!supabaseClient) return null;
    const { data, error } = await supabaseClient
        .from('highscores')
        .select('*')
        .order('score', { ascending: false })
        .limit(limit);
    if (error) {
        console.error('Error fetching high scores:', error);
    }
    return data;
}

// Utility: Attach to window for global access
window.saveHighScore = saveHighScore;
window.getHighScores = getHighScores;
