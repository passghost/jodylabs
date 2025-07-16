console.log("game.js loaded");
// GreeterTest Multiplayer Game
// Version: 1.2.6 (2025-07-16)
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
let chatMessages = new Map();
let stickers = new Map();
let stickerImages = new Map(); // Cache for loaded sticker images
let stickerMode = false;

// Game constants
const PLAYER_SIZE = 32;
const MOVE_SPEED = 3;
const UPDATE_INTERVAL = 50; // ms - even more frequent updates for smoother sync
const INTERPOLATION_SPEED = 0.35; // Faster interpolation for smoother sync
const MIN_MOVE_DISTANCE = 5; // Only send updates if moved this much

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
    const version = 'v1.2.6 (2025-07-16)';
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
    // Only debug if this is a chat bubble placement event
    const chatData = payload.new;
    if (!chatData) return;
    // Add chat message for the player
    chatMessages.set(chatData.player_id, {
        text: chatData.message,
        timestamp: new Date(chatData.timestamp).getTime(),
        playerId: chatData.player_id,
        playerName: chatData.player_name
    });
}

function handleStickerUpdate(payload) {
    // Real-time sticker event received
    const stickerData = payload.new;
    if (!stickerData) return;
    // Always force a full refresh of stickers on any real-time event
    fetchAllStickers();
}

async function fetchRecentChatMessages() {
    try {
        const { data, error } = await supabase
            .from('chat_messages')
            .select('*')
            .gte('timestamp', new Date(Date.now() - 30000).toISOString()) // Last 30 seconds
            .order('timestamp', { ascending: false })
            .limit(20);

        if (error) {
            console.error('Error fetching chat messages:', error);
            return;
        }

        // Add ALL recent chat messages, including current player's
        data.forEach(chat => {
            chatMessages.set(chat.player_id, {
                text: chat.message,
                timestamp: new Date(chat.timestamp).getTime(),
                playerId: chat.player_id,
                playerName: chat.player_name
            });
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

        // Add or update all stickers in the scene, and always reload the image
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
            // Always reload the image for this sticker (fixes placeholder issue)
            loadStickerImage(sticker);
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

    // Draw player name
    ctx.fillStyle = isCurrentPlayer ? '#f1c40f' : '#ffffff';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(player.name, player.x + PLAYER_SIZE / 2, player.y - 5);

    // Draw selection indicator for current player
    if (isCurrentPlayer) {
        ctx.strokeStyle = '#f1c40f';
        ctx.lineWidth = 2;
        ctx.strokeRect(player.x - 2, player.y - 2, PLAYER_SIZE + 4, PLAYER_SIZE + 4);
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

    // Add chat message locally
    chatMessages.set(currentPlayer.id, chatData);
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

function placeStickerAtPlayer(imageUrl) {
    if (!currentPlayer) return;

    const stickerId = 'sticker_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const stickerData = {
        id: stickerId,
        url: imageUrl,
        x: currentPlayer.x + PLAYER_SIZE / 2 - 25, // Center at player position
        y: currentPlayer.y + PLAYER_SIZE / 2 - 25,
        timestamp: Date.now(),
        placedBy: currentPlayer.name
    };

    // Optimistically add sticker locally for instant feedback
    if (!stickers.has(stickerId)) {
        stickers.set(stickerId, stickerData);
        loadStickerImage(stickerData);
    }

    // Debug: Log sticker placement (request)
    console.log('[DEBUG] Sticker placed (request):', {
        playerName: currentPlayer.name,
        stickerId,
        imageUrl,
        x: stickerData.x,
        y: stickerData.y,
        timestamp: stickerData.timestamp
    });

    // Send sticker to database for syncing
    sendStickerToDatabase(stickerData);

    // Clear input
    const stickerInput = document.getElementById('stickerInput');
    stickerInput.value = '';
}

function placeStickerAt(x, y) {
    const stickerInput = document.getElementById('stickerInput');
    const imageUrl = stickerInput.value.trim();

    if (!imageUrl) return;

    const stickerId = 'sticker_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);
    const stickerData = {
        id: stickerId,
        url: imageUrl,
        x: x - 25, // Center the 50px sticker
        y: y - 25,
        timestamp: Date.now(),
        placedBy: currentPlayer ? currentPlayer.name : 'Anonymous'
    };

    // Optimistically add sticker locally for instant feedback
    if (!stickers.has(stickerId)) {
        stickers.set(stickerId, stickerData);
        loadStickerImage(stickerData);
    }

    // Debug: Log sticker placement (request)
    console.log('[DEBUG] Sticker placed (request):', {
        playerName: currentPlayer ? currentPlayer.name : 'Anonymous',
        stickerId,
        imageUrl,
        x: stickerData.x,
        y: stickerData.y,
        timestamp: stickerData.timestamp
    });

    // Send sticker to database for syncing
    sendStickerToDatabase(stickerData);

    // Clear input
    stickerInput.value = '';
}

// Update render function to include chat bubbles and stickers
function render() {
    // Clear canvas
    ctx.fillStyle = '#27ae60';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid pattern
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
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
    // Always create a new Image and try to load the real image, replacing any placeholder
    // Remove any existing image (placeholder or otherwise) so the new one can be set
    stickerImages.delete(sticker.id);

    // Create placeholder immediately to avoid CORS issues (will be replaced if real image loads)
    createStickerPlaceholder(sticker);

    // Try to load the actual image without crossOrigin
    const img = new Image();

    img.onload = () => {
        // Always replace with the real image if it loads successfully
        stickerImages.set(sticker.id, img);
        console.log(`Sticker image loaded: ${sticker.id} (${sticker.url})`);
    };

    img.onerror = () => {
        console.warn(`Failed to load sticker image: ${sticker.url} - Using placeholder`);
        // Placeholder is already created, so do nothing
    };

    // Debug: Log when attempting to load sticker image
    console.log(`Attempting to load sticker image: ${sticker.id} (${sticker.url})`);
    // Don't set crossOrigin to avoid CORS errors
    img.src = sticker.url;
}

function createStickerPlaceholder(sticker) {
    const fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.width = 50;
    fallbackCanvas.height = 50;
    const fallbackCtx = fallbackCanvas.getContext('2d');

    // Draw a colorful placeholder with sticker info
    const colors = ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3'];
    const colorIndex = Math.abs(hashString(sticker.id)) % colors.length;
    const color = colors[colorIndex];

    fallbackCtx.fillStyle = color;
    fallbackCtx.fillRect(0, 0, 50, 50);
    fallbackCtx.fillStyle = '#ffffff';
    fallbackCtx.font = '10px Arial';
    fallbackCtx.textAlign = 'center';
    fallbackCtx.fillText('STICKER', 25, 20);
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

// drawChatBubble function is now in chat-bubbles.js

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