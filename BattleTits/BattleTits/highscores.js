// highscores.js
// High score system with Supabase integration

import { CONFIG } from './config.js';

let supabase = null;

// Initialize Supabase client
function initSupabase() {
  if (!CONFIG.ENABLE_SUPABASE) {
    console.log('Supabase disabled in config');
    return;
  }

  if (typeof window.supabase !== 'undefined' && CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    supabase = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    console.log('Supabase initialized');
  } else {
    console.warn('Supabase client not loaded or not configured');
  }
}

// High score data
let highScores = [];
let playerName = '';

// Create high score board UI
export function createHighScoreBoard() {
  const rightUI = document.getElementById('right-ui');
  if (!rightUI) return;

  // Clear existing powerup list and replace with high score board
  rightUI.innerHTML = `
    <div id="highscore-board" style="
      min-height: 200px;
      font-family: 'Orbitron', 'Courier New', monospace;
      font-size: 10px;
      font-weight: 600;
      text-align: left;
      border-radius: 4px;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(20, 20, 20, 0.9)),
                  repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255, 255, 0, 0.1) 5px, rgba(255, 255, 0, 0.1) 10px);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5),
                  inset 0 -2px 4px rgba(255, 255, 255, 0.1),
                  0 0 15px rgba(255, 255, 0, 0.3);
      color: #ffff00;
      padding: 10px;
      border: 1px solid #ffff00;
      text-shadow: 0 0 8px #ffff00;
      letter-spacing: 1px;
    ">
      <div style="text-align: center; margin-bottom: 10px; font-weight: 900; color: #ffffff;">
        ◤ HIGH SCORES ◥
      </div>
      <div id="highscore-list">
        <div style="color: #666; font-style: italic; text-align: center;">
          LOADING SCORES...
        </div>
      </div>
    </div>
    <div id="powerup-list" style="
      min-height: 100px;
      font-family: 'Orbitron', 'Courier New', monospace;
      font-size: 10px;
      font-weight: 600;
      text-align: left;
      border-radius: 4px;
      background: linear-gradient(135deg, rgba(0, 0, 0, 0.9), rgba(20, 20, 20, 0.9)),
                  repeating-linear-gradient(45deg, transparent, transparent 5px, rgba(255, 255, 0, 0.1) 5px, rgba(255, 255, 0, 0.1) 10px);
      box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.5),
                  inset 0 -2px 4px rgba(255, 255, 255, 0.1),
                  0 0 15px rgba(255, 255, 0, 0.3);
      color: #ffff00;
      padding: 10px;
      border: 1px solid #ffff00;
      text-shadow: 0 0 8px #ffff00;
      letter-spacing: 1px;
      margin-top: 10px;
    ">
      <div style="text-align: center; font-weight: 900; color: #ffffff;">
        ◤ ACTIVE EQUIPMENT ◥
      </div>
    </div>
  `;

  // Load high scores and perform cleanup
  loadHighScores();
  
  // Perform one-time cleanup of excess entries
  setTimeout(performInitialCleanup, 1000);
}

// One-time cleanup of existing excess scores
async function performInitialCleanup() {
  if (!supabase) return;

  try {
    console.log('Performing initial cleanup of excess high scores...');
    await cleanupExcessScores();
  } catch (err) {
    console.error('Failed to perform initial cleanup:', err);
  }
}

// Load high scores from Supabase
async function loadHighScores() {
  try {
    if (!supabase) {
      // Fallback to localStorage if Supabase not available
      const stored = localStorage.getItem('battleTitsHighScores');
      highScores = stored ? JSON.parse(stored) : [];
      renderHighScores();
      return;
    }

    const { data, error } = await supabase
      .from('battle_tits_scores')
      .select('*')
      .order('score', { ascending: false })
      .limit(CONFIG.MAX_HIGH_SCORES);

    if (error) {
      console.error('Error loading high scores:', error);
      // Fallback to localStorage
      const stored = localStorage.getItem('battleTitsHighScores');
      highScores = stored ? JSON.parse(stored) : [];
    } else {
      highScores = data || [];
    }

    renderHighScores();
  } catch (err) {
    console.error('Failed to load high scores:', err);
    // Fallback to localStorage
    const stored = localStorage.getItem('battleTitsHighScores');
    highScores = stored ? JSON.parse(stored) : [];
    renderHighScores();
  }
}

// Render high scores in the UI
function renderHighScores() {
  const listElement = document.getElementById('highscore-list');
  if (!listElement) return;

  if (highScores.length === 0) {
    listElement.innerHTML = `
      <div style="color: #666; font-style: italic; text-align: center;">
        NO SCORES YET<br>BE THE FIRST!
      </div>
    `;
    return;
  }

  let content = '';
  highScores.slice(0, CONFIG.MAX_HIGH_SCORES).forEach((score, index) => {
    const rank = index + 1;
    const rankColor = rank === 1 ? '#ffff00' : rank === 2 ? '#cccccc' : rank === 3 ? '#ff8800' : '#ffffff';
    const date = new Date(score.created_at || score.date).toLocaleDateString();

    content += `
      <div style="margin: 3px 0; display: flex; justify-content: space-between; color: ${rankColor};">
        <span>${rank}. ${score.player_name || score.name || 'ANONYMOUS'}</span>
        <span>${(score.score || 0).toLocaleString()}</span>
      </div>
      <div style="font-size: 8px; color: #888; margin-bottom: 5px;">
        LVL ${score.level || 1} • ${date}
      </div>
    `;
  });

  listElement.innerHTML = content;
}

// Submit high score
export async function submitHighScore(score, level, playerName = '') {
  try {
    const scoreData = {
      player_name: playerName || 'ANONYMOUS',
      score: score,
      level: level,
      created_at: new Date().toISOString()
    };

    if (supabase) {
      // Submit to Supabase
      const { data, error } = await supabase
        .from('battle_tits_scores')
        .insert([scoreData]);

      if (error) {
        console.error('Error submitting score:', error);
        // Fallback to localStorage
        saveToLocalStorage(scoreData);
      } else {
        console.log('Score submitted successfully');
        // Clean up excess entries after successful insert
        await cleanupExcessScores();
      }
    } else {
      // Fallback to localStorage
      saveToLocalStorage(scoreData);
    }

    // Reload high scores
    await loadHighScores();

    return true;
  } catch (err) {
    console.error('Failed to submit high score:', err);
    // Fallback to localStorage
    saveToLocalStorage({
      player_name: playerName || 'ANONYMOUS',
      score: score,
      level: level,
      date: new Date().toISOString()
    });
    return false;
  }
}

// Clean up excess scores from Supabase
async function cleanupExcessScores() {
  if (!supabase) return;

  try {
    // Get all scores ordered by score descending
    const { data: allScores, error: fetchError } = await supabase
      .from('battle_tits_scores')
      .select('id, score')
      .order('score', { ascending: false });

    if (fetchError) {
      console.error('Error fetching scores for cleanup:', fetchError);
      return;
    }

    // If we have more than MAX_HIGH_SCORES, delete the excess
    if (allScores && allScores.length > CONFIG.MAX_HIGH_SCORES) {
      const excessScores = allScores.slice(CONFIG.MAX_HIGH_SCORES);
      const idsToDelete = excessScores.map(score => score.id);

      const { error: deleteError } = await supabase
        .from('battle_tits_scores')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('Error deleting excess scores:', deleteError);
      } else {
        console.log(`Cleaned up ${idsToDelete.length} excess high score entries`);
      }
    }
  } catch (err) {
    console.error('Failed to cleanup excess scores:', err);
  }
}

// Save to localStorage as fallback
function saveToLocalStorage(scoreData) {
  try {
    const stored = localStorage.getItem('battleTitsHighScores');
    let scores = stored ? JSON.parse(stored) : [];

    scores.push(scoreData);
    scores.sort((a, b) => (b.score || 0) - (a.score || 0));
    scores = scores.slice(0, CONFIG.MAX_HIGH_SCORES); // Keep only top entries

    localStorage.setItem('battleTitsHighScores', JSON.stringify(scores));
    highScores = scores;
    renderHighScores();
  } catch (err) {
    console.error('Failed to save to localStorage:', err);
  }
}

// Check if score qualifies for high score board
export function isHighScore(score) {
  if (highScores.length < CONFIG.MAX_HIGH_SCORES) return true;
  return score > (highScores[highScores.length - 1]?.score || 0);
}

// Show name input dialog for high score
export function showNameInput(score, level, callback) {
  const dialog = document.createElement('div');
  dialog.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, rgba(0, 50, 0, 0.95), rgba(0, 100, 0, 0.95));
    color: #00ff00;
    padding: 30px;
    border-radius: 12px;
    text-align: center;
    z-index: 20000;
    border: 3px solid #00ff00;
    box-shadow: 0 0 30px rgba(0, 255, 0, 0.5);
    font-family: 'Orbitron', monospace;
    font-weight: 700;
  `;

  dialog.innerHTML = `
    <h2 style="margin-bottom: 20px; text-shadow: 0 0 20px #00ff00;">
      🏆 NEW HIGH SCORE! 🏆
    </h2>
    <p style="margin-bottom: 20px;">
      Score: ${score.toLocaleString()}<br>
      Level: ${level}
    </p>
    <input type="text" id="player-name-input" placeholder="Enter your name" maxlength="${CONFIG.MAX_NAME_LENGTH}" style="
      background: rgba(0, 0, 0, 0.8);
      color: #00ff00;
      border: 2px solid #00ff00;
      padding: 10px;
      border-radius: 6px;
      font-family: 'Orbitron', monospace;
      font-size: 14px;
      text-align: center;
      margin-bottom: 20px;
      width: 200px;
    ">
    <br>
    <button id="submit-score-btn" style="
      background: linear-gradient(135deg, #002a00, #004a00);
      color: #00ff00;
      border: 2px solid #00ff00;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'Orbitron', monospace;
      font-size: 12px;
      font-weight: 700;
      margin: 5px;
    ">SUBMIT</button>
    <button id="skip-score-btn" style="
      background: linear-gradient(135deg, #2a0000, #4a0000);
      color: #ff0000;
      border: 2px solid #ff0000;
      padding: 10px 20px;
      border-radius: 6px;
      cursor: pointer;
      font-family: 'Orbitron', monospace;
      font-size: 12px;
      font-weight: 700;
      margin: 5px;
    ">SKIP</button>
  `;

  document.body.appendChild(dialog);

  const nameInput = document.getElementById('player-name-input');
  const submitBtn = document.getElementById('submit-score-btn');
  const skipBtn = document.getElementById('skip-score-btn');

  nameInput.focus();

  const submit = async () => {
    const name = nameInput.value.trim() || 'ANONYMOUS';
    document.body.removeChild(dialog);
    await submitHighScore(score, level, name);
    if (callback) callback();
  };

  const skip = () => {
    document.body.removeChild(dialog);
    if (callback) callback();
  };

  submitBtn.addEventListener('click', submit);
  skipBtn.addEventListener('click', skip);
  nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') submit();
    if (e.key === 'Escape') skip();
  });
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Load Supabase if available
  if (typeof window.supabase !== 'undefined') {
    initSupabase();
  }

  // Create high score board
  setTimeout(createHighScoreBoard, 100);
});

// Auto-refresh high scores
if (CONFIG.AUTO_REFRESH_INTERVAL > 0) {
  setInterval(loadHighScores, CONFIG.AUTO_REFRESH_INTERVAL);
}