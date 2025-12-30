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
// --- Provide a Supabase-backed implementation with a localStorage fallback ---
const LS_KEY = 'jousti_highscores_v1';

async function supabaseGetHighScores(limit = 10) {
    if (!supabaseClient) throw new Error('No supabase client');
    const { data, error } = await supabaseClient
        .from('highscores')
        .select('*')
        .order('score', { ascending: false })
        .limit(limit);
    if (error) throw error;
    return data;
}

async function supabaseSaveHighScore(username, score) {
    if (!supabaseClient) throw new Error('No supabase client');
    const { data, error } = await supabaseClient
        .from('highscores')
        .upsert([{ username, score }], { onConflict: ['username'] });
    if (error) throw error;
    return data;
}

async function supabaseDeleteHighScore(username, score) {
    if (!supabaseClient) throw new Error('No supabase client');
    const { data, error } = await supabaseClient
        .from('highscores')
        .delete()
        .match({ username: username, score: score });
    if (error) throw error;
    return data;
}

function lsGetHighScores(limit = 10) {
    try {
        const raw = localStorage.getItem(LS_KEY);
        if (!raw) return [];
        const arr = JSON.parse(raw);
        if (!Array.isArray(arr)) return [];
        return arr.sort((a, b) => b.score - a.score).slice(0, limit);
    } catch (e) {
        console.error('Failed to read local highscores:', e);
        return [];
    }
}

function lsSaveHighScore(username, score) {
    try {
        const arr = lsGetHighScores(1000);
        // Upsert logic: keep highest score per username
        const idx = arr.findIndex(s => s.username === username);
        if (idx >= 0) {
            if (score > arr[idx].score) arr[idx].score = score;
        } else {
            arr.push({ username, score });
        }
        arr.sort((a, b) => b.score - a.score);
        localStorage.setItem(LS_KEY, JSON.stringify(arr));
        return arr.slice(0, 10);
    } catch (e) {
        console.error('Failed to save local highscore:', e);
        return [];
    }
}

function lsDeleteHighScore(username, score) {
    try {
        let arr = lsGetHighScores(1000);
        arr = arr.filter(s => !(s.username === username && s.score === score));
        localStorage.setItem(LS_KEY, JSON.stringify(arr));
        return arr.slice(0, 10);
    } catch (e) {
        console.error('Failed to delete local highscore:', e);
        return [];
    }
}

// Public API: try Supabase first, fall back to localStorage when unavailable
async function saveHighScore(username, score) {
    try {
        return await supabaseSaveHighScore(username, score);
    } catch (e) {
        console.warn('Supabase save failed, using localStorage fallback:', e.message || e);
        return lsSaveHighScore(username, score);
    }
}

async function getHighScores(limit = 10) {
    try {
        const res = await supabaseGetHighScores(limit);
        return Array.isArray(res) ? res : [];
    } catch (e) {
        console.warn('Supabase fetch failed, falling back to localStorage:', e.message || e);
        return lsGetHighScores(limit);
    }
}

async function deleteHighScore(username, score) {
    try {
        return await supabaseDeleteHighScore(username, score);
    } catch (e) {
        console.warn('Supabase delete failed, falling back to localStorage:', e.message || e);
        return lsDeleteHighScore(username, score);
    }
}

// Utility: Attach to window for global access
window.saveHighScore = saveHighScore;
window.getHighScores = getHighScores;
