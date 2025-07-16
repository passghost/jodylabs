console.log("game.js loaded");
// GreeterTest Multiplayer Game
// Version: 1.3.1 (2025-07-16)
//
// Supabase configuration
const SUPABASE_URL = 'https://omcwjmvdjswkfjkahchm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Game variables
let canvas, ctx;
let currentPlayer = null;
let players = new Map();
let keys = {};
let lastUpdate = 0;
let playerImages = {};
// Store an array of chat messages per player
let chatMessages = new Map();
let stickers = new Map();
let stickerImages = new Map(); // Cache for loaded sticker images
let stickerMode = false;

// Game constants
const PLAYER_SIZE = 32;
const MOVE_SPEED = 1.2; // Slower movement for smoother transitions
const UPDATE_INTERVAL = 30; // Slightly less frequent updates
const INTERPOLATION_SPEED = 0.13; // Much slower interpolation for smooth glide
const MIN_MOVE_DISTANCE = 1; // Send updates for even the smallest movement

// Initialize game
async function joinWorld() {
    console.log("joinWorld() called");
    const nameInput = document.getElementById('playerName');
    const playerName = nameInput.value.trim();

    if (!playerName) {
        alert('Please enter your name!');
        return;
    }


    // Hide login screen and show game
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('gameContainer').style.display = 'flex';
    document.getElementById('playerNameDisplay').textContent = playerName;

    // Show version number on both login and game screens
    const version = 'v1.4.0 (2025-07-16)';
    // Login screen
    const loginVersionSpan = document.getElementById('loginVersion');
    if (loginVersionSpan) {
        loginVersionSpan.textContent = version;
        loginVersionSpan.style.display = 'inline';
    }
    // In-game UI (if you have a version span there)
    const gameVersionSpan = document.getElementById('gameVersion');
    if (gameVersionSpan) {
        gameVersionSpan.textContent = version;
        gameVersionSpan.style.display = 'inline';
    }

    // Initialize canvas and game
    canvas = document.getElementById('gameCanvas');
    ctx = canvas.getContext('2d');

    // Load player images
    await loadPlayerImages();

    // Create current player
    currentPlayer = {
        id: generatePlayerId(),
        name: playerName,
        x: Math.random() * (canvas.width - PLAYER_SIZE),
        y: Math.random() * (canvas.height - PLAYER_SIZE),
        isWalking: false,
        lastMoved: Date.now(),
        lastSentX: 0,
        lastSentY: 0
    };
    // Add current player to players map so it is recognized
    players.set(currentPlayer.id, currentPlayer);

    // Setup event listeners
    setupEventListeners();

    // Initialize Supabase connection
    await initializeSupabase();

    // Start game loop
    gameLoop();

    // Start 5s sticker refresh ticker (ensure only one interval is set)
    if (!window._stickerRefreshInterval) {
        window._stickerRefreshInterval = setInterval(() => {
            fetchAllStickers();
        }, 5000);
    }
}

async function loadPlayerImages() {
    return new Promise((resolve) => {
        let loadedCount = 0;
        const totalImages = 2;

        playerImages.standing = new Image();
        playerImages.walking = new Image();

        const onImageLoad = () => {
            loadedCount++;
            if (loadedCount === totalImages) {
                resolve();
            }
        };

        playerImages.standing.onload = onImageLoad;
        playerImages.walking.onload = onImageLoad;

        playerImages.standing.src = 'Zarrow.png';
        playerImages.walking.src = 'Zarrowalk.png';
    });
}

function generatePlayerId() {
    return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
}

function setupEventListeners() {
    // Keyboard controls
    document.addEventListener('keydown', (e) => {
        const key = e.key.toLowerCase();
        // Only prevent default for game keys, allow F12 and other browser shortcuts
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            keys[key] = true;
            e.preventDefault();
        }
    });

    document.addEventListener('keyup', (e) => {
        const key = e.key.toLowerCase();
        if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(key)) {
            keys[key] = false;
            e.preventDefault();
        }
    });

    // Mouse click to move or place sticker
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        if (stickerMode) {
            placeStickerAt(clickX, clickY);
            stickerMode = false;
            canvas.style.cursor = 'crosshair';
        } else {
            const targetX = clickX - PLAYER_SIZE / 2;
            const targetY = clickY - PLAYER_SIZE / 2;

            currentPlayer.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, targetX));
            currentPlayer.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, targetY));
            currentPlayer.isWalking = true;
            currentPlayer.lastMoved = Date.now();
        }
    });

    // Enter key for chat
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const chatInput = document.getElementById('chatInput');
            if (document.activeElement === chatInput) {
                sendChatMessage();
                e.preventDefault();
            }
        }
    });
}

async function initializeSupabase() {
    try {
        // Test database connection first
        const { data, error } = await supabase.from('players').select('count').limit(1);

        if (error) {
            console.warn('Database not configured yet. Running in offline mode.');
            console.log('To enable multiplayer, set up the database with the instructions in the console.');
            console.log(`
DATABASE SETUP INSTRUCTIONS:
1. Go to your Supabase project: https://omcwjmvdjswkfjkahchm.supabase.co
2. Go to SQL Editor and run this query:

-- Players table
CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  is_walking BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Chat messages table
CREATE TABLE chat_messages (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL,
  player_name TEXT NOT NULL,
  message TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Stickers table
CREATE TABLE stickers (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  placed_by TEXT NOT NULL,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE stickers ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read and write
CREATE POLICY "Allow anonymous access" ON players
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access" ON chat_messages
FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow anonymous access" ON stickers
FOR ALL USING (true) WITH CHECK (true);

3. Refresh the page and multiplayer will work!
            `);
            return;
        }

        // Add current player to database
        await updatePlayerPosition();

        // Subscribe to player updates with unique channel name
        const channelName = 'game_' + Math.random().toString(36).substr(2, 9);
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'players' },
                handlePlayerUpdate
            )
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'chat_messages' },
                handleChatUpdate
            )
            .on('postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'stickers' },
                handleStickerUpdate
            )
            .subscribe((status) => {
                console.log('Subscription status:', status);
                if (status === 'SUBSCRIBED') {
                    console.log('Real-time subscription active!');
                }
            });

        // Better cleanup on page unload/close
        window.addEventListener('beforeunload', removePlayer);
        window.addEventListener('unload', removePlayer);
        window.addEventListener('pagehide', removePlayer);

        // Also cleanup when tab becomes hidden (mobile/background)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                removePlayer();
            }
        });

        // Fetch existing players, chat messages, and stickers

        await fetchAllPlayers();
        await fetchRecentChatMessages();
        await fetchAllStickers(); // Only once on initial load

        // Add fallback polling in case real-time doesn't work (players and chat only)
        setInterval(async () => {
            await fetchAllPlayers();
            await fetchRecentChatMessages();
        }, 2000);

        console.log('Multiplayer mode enabled!');

        // Periodically update last_seen even if not moving (keep alive)
        setInterval(() => {
            updatePlayerPosition(true); // Force update to keep alive
        }, 20000); // Every 20 seconds

    } catch (error) {
        console.error('Supabase initialization error:', error);
    }
}

async function createPlayersTable() {
    // This will be handled by Supabase migrations or manual setup
    // For now, we'll assume the table exists or will be created
}

async function updatePlayerPosition(force = false) {
    if (!currentPlayer) return;

    // Only send update if player has moved significantly, unless forced
    const dx = currentPlayer.x - currentPlayer.lastSentX;
    const dy = currentPlayer.y - currentPlayer.lastSentY;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);

    // Send update if moved enough distance OR if walking state changed OR forced
    const walkingStateChanged = currentPlayer.lastSentWalking !== currentPlayer.isWalking;

    if (!force && distanceMoved < MIN_MOVE_DISTANCE && !walkingStateChanged) {
        return; // Skip update if not moved enough and not forced
    }

    try {
        const { error } = await supabase
            .from('players')
            .upsert({
                id: currentPlayer.id,
                name: currentPlayer.name,
                x: Math.round(currentPlayer.x),
                y: Math.round(currentPlayer.y),
                is_walking: currentPlayer.isWalking,
                last_seen: new Date().toISOString()
            });

        if (error) {
            console.error('Error updating player position:', error);
        } else {
            // Update last sent position
            currentPlayer.lastSentX = currentPlayer.x;
            currentPlayer.lastSentY = currentPlayer.y;
            currentPlayer.lastSentWalking = currentPlayer.isWalking;
        }
    } catch (error) {
        console.error('Database error:', error);
    }
}

async function fetchAllPlayers() {
    try {
        const { data, error } = await supabase
            .from('players')
            .select('*')
            .gte('last_seen', new Date(Date.now() - 30000).toISOString()); // Last 30 seconds

        if (error) {
            console.error('Error fetching players:', error);
            return;
        }

        // Debug: Log raw data from Supabase
        console.log('[fetchAllPlayers] Supabase returned:', data);

        // Only update other players, not current player
        const newPlayers = new Map();
        data.forEach(player => {
            if (currentPlayer && player.id === currentPlayer.id) {
                // Always keep currentPlayer reference in players map
                // Ensure playerImages is always attached for rendering
                currentPlayer.playerImages = playerImages;
                newPlayers.set(player.id, currentPlayer);
            } else {
                const existingPlayer = players.get(player.id);
                newPlayers.set(player.id, {
                    id: player.id,
                    name: player.name,
                    // Target position from server
                    targetX: player.x,
                    targetY: player.y,
                    // Current display position (for smooth interpolation)
                    x: existingPlayer ? existingPlayer.x : player.x,
                    y: existingPlayer ? existingPlayer.y : player.y,
                    isWalking: typeof player.is_walking === 'boolean' ? player.is_walking : false,
                    lastMoved: new Date(player.last_seen).getTime(),
                    playerImages: playerImages // Always attach images
                });
            }
        });
        // Always ensure currentPlayer is in the map and has playerImages
        if (currentPlayer && !newPlayers.has(currentPlayer.id)) {
            currentPlayer.playerImages = playerImages;
            newPlayers.set(currentPlayer.id, currentPlayer);
        }
        players = newPlayers;
        updatePlayerCount();
        // Debug: Log all player IDs after fetching
        console.log('[fetchAllPlayers] players in map:', Array.from(players.keys()));
    } catch (error) {
        console.error('Error fetching players:', error);
    }
}

function handlePlayerUpdate(payload) {
    console.log('Player update:', payload.eventType, payload);

    // Handle DELETE events (player left)
    if (payload.eventType === 'DELETE') {
        const playerId = payload.old?.id;
        // Never delete currentPlayer from the map
        if (playerId && players.has(playerId) && (!currentPlayer || playerId !== currentPlayer.id)) {
            players.delete(playerId);
            updatePlayerCount();
            console.log('Player left:', playerId);
        }
        return;
    }

    // Handle INSERT/UPDATE events
    const player = payload.new;
    if (!player) return;

    // Never update currentPlayer from remote
    if (currentPlayer && player.id === currentPlayer.id) return;

    // Remove old players (inactive for more than 30 seconds)
    const thirtySecondsAgo = Date.now() - 30000;
    if (new Date(player.last_seen).getTime() < thirtySecondsAgo) {
        if (!currentPlayer || player.id !== currentPlayer.id) {
            players.delete(player.id);
            updatePlayerCount();
        }
        return;
    }

    const existingPlayer = players.get(player.id);
    players.set(player.id, {
        id: player.id,
        name: player.name,
        // Target position from server
        targetX: player.x,
        targetY: player.y,
        // Current display position (for smooth interpolation)
        x: existingPlayer ? existingPlayer.x : player.x,
        y: existingPlayer ? existingPlayer.y : player.y,
        isWalking: typeof player.is_walking === 'boolean' ? player.is_walking : false,
        lastMoved: new Date(player.last_seen).getTime(),
        playerImages: playerImages // Always attach images
    });

    updatePlayerCount();
}

async function removePlayer() {
    if (!currentPlayer) return;

    try {
        await supabase
            .from('players')
            .delete()
            .eq('id', currentPlayer.id);
    } catch (error) {
        console.error('Error removing player:', error);
    }
}

function handleChatUpdate(payload) {
    const chatData = payload.new;
    if (!chatData) return;
    // Store an array of messages per player
    if (!chatMessages.has(chatData.player_id)) {
        chatMessages.set(chatData.player_id, []);
    }
    // Use Date.now() for timestamp on remote clients to ensure 5s bubble display
    const isLocal = currentPlayer && chatData.player_id === currentPlayer.id;
    chatMessages.get(chatData.player_id).push({
        text: chatData.message,
        timestamp: isLocal ? new Date(chatData.timestamp).getTime() : Date.now(),
        playerId: chatData.player_id,
        playerName: chatData.player_name
    });
    // Keep only the last 5 messages per player (optional, for memory)
    if (chatMessages.get(chatData.player_id).length > 5) {
        chatMessages.get(chatData.player_id).shift();
    }
}

function handleStickerUpdate(payload) {
    // Real-time sticker event received
    const stickerData = payload.new;
    console.log('[DEBUG] handleStickerUpdate called:', payload);
    if (!stickerData) {
        console.warn('[DEBUG] handleStickerUpdate: No stickerData in payload:', payload);
        return;
    }
    // Always force a full refresh of stickers on any real-time event
    fetchAllStickers();
}

async function fetchRecentChatMessages() {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .gte('timestamp', new Date(Date.now() - 30000).toISOString()) // Last 30 seconds
            .order('timestamp', { ascending: true })
            .limit(100);

        if (error) {
            console.error('Error fetching chat messages:', error);
            return;
        }

        // Clear all chat messages
        chatMessages.clear();
        // Add ALL recent chat messages, grouped by player
        data.forEach(chat => {
            if (!chatMessages.has(chat.player_id)) {
                chatMessages.set(chat.player_id, []);
            }
            chatMessages.get(chat.player_id).push({
                text: chat.message,
                timestamp: new Date(chat.timestamp).getTime(),
                playerId: chat.player_id,
                playerName: chat.player_name
            });
            // Keep only the last 5 messages per player
            if (chatMessages.get(chat.player_id).length > 5) {
                chatMessages.get(chat.player_id).shift();
            }
            console.log(`Loaded chat message: ${chat.player_name}: ${chat.message}`);
        });
    } catch (error) {
        console.error('Error fetching chat messages:', error);
    }
}

async function fetchAllStickers() {
    try {
        const { data, error } = await supabase
            .from('stickers')
            .select('*')
            .gte('timestamp', new Date(Date.now() - 3600000).toISOString()) // Last hour
            .order('timestamp', { ascending: true });

        if (error) {
            console.error('Error fetching stickers:', error);
            return;
        }

        console.log('[DEBUG] fetchAllStickers: fetched', data.length, 'stickers:', data);

        // Clear stickers map, but do NOT clear stickerImages cache globally (only clear for stickers that are gone)
        const oldStickerIds = new Set(stickers.keys());
        stickers.clear();

        // Track which stickers are present after refresh
        const newStickerIds = new Set();

        // Add or update all stickers in the scene, and always reload the image if URL changed
        data.forEach(stickerData => {
            const sticker = {
                id: stickerData.id,
                url: stickerData.url,
                x: stickerData.x,
                y: stickerData.y,
                timestamp: new Date(stickerData.timestamp).getTime(),
                placedBy: stickerData.placed_by
            };
            stickers.set(sticker.id, sticker);
            newStickerIds.add(sticker.id);
            // If image is missing or URL changed, reload
            const img = stickerImages.get(sticker.id);
            if (!img || (img.src && img.src !== sticker.url)) {
                loadStickerImage(sticker);
            }
        });

        // Remove images for stickers that no longer exist
        oldStickerIds.forEach(id => {
            if (!newStickerIds.has(id)) {
                stickerImages.delete(id);
            }
        });
    } catch (error) {
        console.error('Error fetching stickers:', error);
    }
}

function updatePlayerCount() {
    // Only count unique players in the map (currentPlayer is always included)
    const count = players.size;
    document.getElementById('playerCount').textContent = count;
}

function handleInput() {
    if (!currentPlayer) return;

    let moved = false;
    const oldX = currentPlayer.x;
    const oldY = currentPlayer.y;

    // WASD and Arrow key controls
    if (keys['w'] || keys['arrowup']) {
        currentPlayer.y -= MOVE_SPEED;
        moved = true;
    }
    if (keys['s'] || keys['arrowdown']) {
        currentPlayer.y += MOVE_SPEED;
        moved = true;
    }
    if (keys['a'] || keys['arrowleft']) {
        currentPlayer.x -= MOVE_SPEED;
        moved = true;
    }
    if (keys['d'] || keys['arrowright']) {
        currentPlayer.x += MOVE_SPEED;
        moved = true;
    }

    // Clamp player position to canvas bounds
    currentPlayer.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, currentPlayer.x));
    currentPlayer.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, currentPlayer.y));

    if (moved) {
        currentPlayer.isWalking = true;
        currentPlayer.lastMoved = Date.now();
    } else {
        // Stop walking animation after a short delay
        if (Date.now() - currentPlayer.lastMoved > 200) {
            currentPlayer.isWalking = false;
        }
    }
}

// This is a placeholder function that will be overridden by the complete render function below
// Keeping this to avoid errors if it's referenced elsewhere
function renderPlaceholder() {
    console.log("Using placeholder render function - this should not happen");
}

function render() {
    // Black background
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Red grid pattern
    ctx.strokeStyle = 'rgba(255, 0, 0, 0.18)';
    ctx.lineWidth = 1;
    for (let x = 0; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw stickers first (behind players)
    drawStickers();

    // Draw other players first
    players.forEach(player => {
        drawPlayer(player);
    });

    // Draw current player
    if (currentPlayer) {
        drawPlayer(currentPlayer, true);
    }
    
    // Draw all chat bubbles on top of players
    // This ensures chat bubbles are always visible and not covered by other players
    players.forEach(player => {
        drawChatBubble(player);
    });
    
    // Draw current player's chat bubble
    if (currentPlayer) {
        drawChatBubble(currentPlayer);
    }
    
    // ...debug log removed for clarity...
}

function drawPlayer(player, isCurrentPlayer = false) {
    // Use player.playerImages if available, otherwise fall back to global playerImages
    const images = player.playerImages || playerImages;
    // Ensure isWalking is always a boolean
    const isWalking = typeof player.isWalking === 'boolean' ? player.isWalking : false;
    // Always use standing image if not walking
    const image = isWalking ? images.walking : images.standing;

    // ...debug log removed for clarity...

    // Fallback: If image is not loaded, don't draw to avoid errors
    if (!image || !image.complete || image.naturalWidth === 0) return;

    // Draw player sprite
    ctx.drawImage(image, player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);

    // Stylized player name
    ctx.fillStyle = isCurrentPlayer ? '#ff2222' : '#ff4444';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#000';
    ctx.shadowBlur = 4;
    ctx.fillText(player.name, player.x + PLAYER_SIZE / 2, player.y - 5);
    ctx.shadowBlur = 0;

    // Draw selection indicator for current player
    if (isCurrentPlayer) {
        ctx.strokeStyle = '#ff2222';
        ctx.lineWidth = 2.5;
        ctx.shadowColor = '#ff2222';
        ctx.shadowBlur = 8;
        ctx.strokeRect(player.x - 2, player.y - 2, PLAYER_SIZE + 4, PLAYER_SIZE + 4);
        ctx.shadowBlur = 0;
    }
}

function updatePlayerInterpolation() {
    // Smoothly move other players toward their target positions
    players.forEach(player => {
        // Never interpolate the current player (local control only)
        if (currentPlayer && player.id === currentPlayer.id) return;
        // Always ensure playerImages is set
        if (!player.playerImages) player.playerImages = playerImages;
        // Do not forcibly set isWalking; preserve server state
        if (player.targetX !== undefined && player.targetY !== undefined) {
            // Calculate distance to target
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If close enough, snap to target
            if (distance < 2) {
                player.x = player.targetX;
                player.y = player.targetY;
                // Only set isWalking to false if it was moving
                if (player.isWalking) player.isWalking = false;
            } else {
                // Smooth interpolation toward target
                player.x += dx * INTERPOLATION_SPEED;
                player.y += dy * INTERPOLATION_SPEED;
                player.isWalking = true;
            }
        }
    });
}

function gameLoop() {
    const now = Date.now();

    handleInput();
    updatePlayerInterpolation(); // Smooth movement for other players
    render();

    // Update player position in database periodically (less frequent)
    if (now - lastUpdate > UPDATE_INTERVAL) {
        updatePlayerPosition();
        lastUpdate = now;
    }

    requestAnimationFrame(gameLoop);
}

// Chat and Sticker Functions
async function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();

    if (!message || !currentPlayer) return;

    const chatData = {
        text: message,
        timestamp: Date.now(),
        playerId: currentPlayer.id,
        playerName: currentPlayer.name
    };

    // Add chat message locally (as array)
    if (!chatMessages.has(currentPlayer.id)) {
        chatMessages.set(currentPlayer.id, []);
    }
    chatMessages.get(currentPlayer.id).push(chatData);
    if (chatMessages.get(currentPlayer.id).length > 5) {
        chatMessages.get(currentPlayer.id).shift();
    }
    // Debug: Log chat bubble placement
    console.log('[DEBUG] Chat bubble placed:', {
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
        message: message,
        timestamp: chatData.timestamp
    });

    // Send to database for syncing
    await sendChatToDatabase(chatData);

    // Clear input
    chatInput.value = '';
    chatInput.blur();
}

async function sendChatToDatabase(chatData) {
    try {
        const { error } = await supabase
            .from('chat_messages')
            .insert({
                player_id: chatData.playerId,
                player_name: chatData.playerName,
                message: chatData.text,
                timestamp: new Date(chatData.timestamp).toISOString()
            });

        if (error) {
            console.error('Error sending chat message:', error);
        }
    } catch (error) {
        console.error('Database error sending chat:', error);
    }
}

async function sendStickerToDatabase(stickerData) {
    try {
        const { error } = await supabase
            .from('stickers')
            .insert({
                id: stickerData.id,
                url: stickerData.url,
                x: Math.round(stickerData.x),
                y: Math.round(stickerData.y),
                placed_by: stickerData.placedBy,
                timestamp: new Date(stickerData.timestamp).toISOString()
            });

        if (error) {
            console.error('Error sending sticker:', error);
        } else {
            console.log('[DEBUG] Sticker insert to DB complete:', stickerData);
            // Always fetch all stickers after a successful insert to guarantee sync
            fetchAllStickers();
        }
    } catch (error) {
        console.error('Database error sending sticker:', error);
    }
}

function enableStickerMode() {
    const stickerInput = document.getElementById('stickerInput');
    const imageUrl = stickerInput.value.trim();

    if (!imageUrl) {
        alert('Please enter an image URL first!');
        return;
    }

    // Validate URL (basic check)
    if (!imageUrl.match(/\.(jpeg|jpg|gif|png|webp)$/i) && !imageUrl.startsWith('http')) {
        alert('Please enter a valid image URL (jpg, png, gif, webp)');
        return;
    }

    // Place sticker at current player's location instead of click location
    if (currentPlayer) {
        placeStickerAtPlayer(imageUrl);
    } else {
        alert('Player not found!');
    }
}

async function placeStickerAtPlayer(imageUrl) {
    if (!currentPlayer) return;

    const x = Math.round(currentPlayer.x + PLAYER_SIZE / 2 - 25);
    const y = Math.round(currentPlayer.y + PLAYER_SIZE / 2 - 25);

    // Always create a new sticker, even if it's a duplicate
    try {
        const stickerId = 'sticker_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const stickerData = {
            id: stickerId,
            url: imageUrl,
            x: x,
            y: y,
            timestamp: Date.now(),
            placedBy: currentPlayer.name
        };
        // Send sticker to database for syncing
        await sendStickerToDatabase(stickerData);

        // Optimistically add sticker locally for instant feedback
        stickers.set(stickerId, stickerData);
        loadStickerImage(stickerData);

        // Debug: Log sticker placement (request)
        console.log('[DEBUG] Sticker placed (request):', {
            playerName: currentPlayer.name,
            stickerId,
            imageUrl,
            x: stickerData.x,
            y: stickerData.y,
            timestamp: stickerData.timestamp
        });

        // Clear input
        const stickerInput = document.getElementById('stickerInput');
        stickerInput.value = '';
    } catch (err) {
        console.error('Error in placeStickerAtPlayer:', err);
    }
}

async function placeStickerAt(x, y) {
    const stickerInput = document.getElementById('stickerInput');
    const imageUrl = stickerInput.value.trim();

    if (!imageUrl) return;

    const rx = Math.round(x - 25);
    const ry = Math.round(y - 25);

    // Always create a new sticker, even if it's a duplicate
    try {
        const stickerId = 'sticker_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
        const stickerData = {
            id: stickerId,
            url: imageUrl,
            x: rx,
            y: ry,
            timestamp: Date.now(),
            placedBy: currentPlayer ? currentPlayer.name : 'Anonymous'
        };
        // Send sticker to database for syncing
        await sendStickerToDatabase(stickerData);

        // Optimistically add sticker locally for instant feedback
        stickers.set(stickerId, stickerData);
        loadStickerImage(stickerData);

        // Debug: Log sticker placement (request)
        console.log('[DEBUG] Sticker placed (request):', {
            playerName: currentPlayer ? currentPlayer.name : 'Anonymous',
            stickerId,
            imageUrl,
            x: stickerData.x,
            y: stickerData.y,
            timestamp: stickerData.timestamp
        });

        // Clear input
        stickerInput.value = '';
    } catch (err) {
        console.error('Error in placeStickerAt:', err);
    }
}

// Update render function to include chat bubbles and stickers
function drawStickers() {
    stickers.forEach(sticker => {
        // Only load image if not already cached
        if (!stickerImages.has(sticker.id)) {
            loadStickerImage(sticker);
            return;
        }
        const img = stickerImages.get(sticker.id);
        if (img.complete && img.naturalWidth > 0) {
            ctx.drawImage(img, sticker.x, sticker.y, 50, 50);
        }
    });
}

function loadStickerImage(sticker) {
    // Helper to check if an image is a real loaded image (not a placeholder)
    function isRealImage(img, url) {
        return img && img.complete && img.naturalWidth > 0 && img.src === url;
    }

    // Only set placeholder if there is no real image loaded for this URL
    const existingImg = stickerImages.get(sticker.id);
    if (!isRealImage(existingImg, sticker.url)) {
        createStickerPlaceholder(sticker);
    }

    // Retry logic for loading the real image
    let attempts = 0;
    const maxAttempts = 3;
    const retryDelay = 1000; // ms

    function tryLoadImage() {
        const img = new Image();
        img.onload = () => {
            // Only replace if this is the correct URL (avoid race conditions)
            if (img.src === sticker.url) {
                stickerImages.set(sticker.id, img);
                console.log(`Sticker image loaded: ${sticker.id} (${sticker.url})`);
            }
        };
        img.onerror = () => {
            attempts++;
            if (attempts < maxAttempts) {
                console.warn(`Retrying sticker image load (${attempts}) for: ${sticker.url}`);
                setTimeout(tryLoadImage, retryDelay);
            } else {
                console.warn(`Failed to load sticker image after ${maxAttempts} attempts: ${sticker.url} - Using placeholder`);
            }
        };
        console.log(`Attempting to load sticker image: ${sticker.id} (${sticker.url}), attempt ${attempts + 1}`);
        img.src = sticker.url;
    }

    tryLoadImage();
}

function createStickerPlaceholder(sticker) {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 50;
    fallbackCanvas.height = 50;
    const fallbackCtx = fallbackCanvas.getContext('2d');

    // Red/black placeholder with sticker info
    fallbackCtx.fillStyle = '#1a0000';
    fallbackCtx.fillRect(0, 0, 50, 50);
    fallbackCtx.strokeStyle = '#ff2222';
    fallbackCtx.lineWidth = 2;
    fallbackCtx.strokeRect(2, 2, 46, 46);
    fallbackCtx.fillStyle = '#ff2222';
    fallbackCtx.font = 'bold 10px Arial';
    fallbackCtx.textAlign = 'center';
    fallbackCtx.fillText('STICKER', 25, 20);
    fallbackCtx.fillStyle = '#fff';
    fallbackCtx.font = '9px Arial';
    fallbackCtx.fillText(`by ${sticker.placedBy}`, 25, 35);

    // Convert canvas to image
    const fallbackImg = new Image();
    fallbackImg.onload = () => {
        stickerImages.set(sticker.id, fallbackImg);
    };
    fallbackImg.src = fallbackCanvas.toDataURL();
}

// Helper function for string hashing
function hashString(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return hash;
}

// drawChatBubble function updated to use latest message from chatMessages array
function drawChatBubble(player) {
    if (!player || !chatMessages.has(player.id)) return;
    const messages = chatMessages.get(player.id);
    if (!messages || messages.length === 0) return;
    const latestMessage = messages[messages.length - 1];
    if (!latestMessage || !latestMessage.text) return;

    // Only show chat bubble for 5 seconds after message
    const now = Date.now();
    if (now - latestMessage.timestamp > 5000) return;

    // Draw bubble above player
    const bubbleWidth = Math.max(60, ctx.measureText(latestMessage.text).width + 20);
    const bubbleHeight = 28;
    const x = player.x + PLAYER_SIZE / 2 - bubbleWidth / 2;
    const y = player.y - bubbleHeight - 18;

    // Bubble background
    ctx.save();
    ctx.globalAlpha = 0.92;
    ctx.fillStyle = '#111';
    ctx.strokeStyle = '#ff2222';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(x, y, bubbleWidth, bubbleHeight, 10);
    ctx.fill();
    ctx.stroke();
    ctx.globalAlpha = 1;

    // Text
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(latestMessage.text, player.x + PLAYER_SIZE / 2, y + 18);
    ctx.restore();
}

// Cleanup inactive players periodically
setInterval(() => {
    const thirtySecondsAgo = Date.now() - 30000;
    players.forEach((player, id) => {
        // Never delete the current player from the map
        if (currentPlayer && id === currentPlayer.id) return;
        // Only remove if lastMoved is truly old (from last_seen in DB)
        if (typeof player.lastMoved === 'number' && player.lastMoved < thirtySecondsAgo) {
            console.log(`Cleanup: Removing player ${player.name} (${id}) lastMoved=${player.lastMoved} (${new Date(player.lastMoved).toISOString()})`);
            players.delete(id);
        }
    });
    updatePlayerCount();
    // ...debug log removed for clarity...
});

// Ticker: Refresh all stickers every 5 seconds
setInterval(() => {
    fetchAllStickers();
}, 5000);