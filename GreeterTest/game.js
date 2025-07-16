// GreeterTest Multiplayer Game
// Version: 1.2.1 (2025-07-16)
//
// Supabase configuration
const SUPABASE_URL = 'https://omcwjmvdjswkfjkahchm.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

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
const UPDATE_INTERVAL = 150; // ms - more frequent updates for smoother sync
const INTERPOLATION_SPEED = 0.35; // Faster interpolation for smoother sync
const MIN_MOVE_DISTANCE = 5; // Only send updates if moved this much

// Initialize game
async function joinWorld() {
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
// Show version number on login screen (run on page load, not after login)
window.addEventListener('DOMContentLoaded', () => {
    const versionSpan = document.getElementById('loginVersion');
    if (versionSpan) {
        versionSpan.textContent = 'v1.2.1 (2025-07-16)';
    }
});

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
        await fetchAllStickers();

        // Add fallback polling in case real-time doesn't work
        setInterval(async () => {
            await fetchAllPlayers();
            await fetchRecentChatMessages(); // Poll for chat messages too
        }, 2000); // Poll every 2 seconds as backup

        console.log('Multiplayer mode enabled!');

    } catch (error) {
        console.error('Supabase initialization error:', error);
    }
}

async function createPlayersTable() {
    // This will be handled by Supabase migrations or manual setup
    // For now, we'll assume the table exists or will be created
}

async function updatePlayerPosition() {
    if (!currentPlayer) return;

    // Only send update if player has moved significantly
    const dx = currentPlayer.x - currentPlayer.lastSentX;
    const dy = currentPlayer.y - currentPlayer.lastSentY;
    const distanceMoved = Math.sqrt(dx * dx + dy * dy);

    // Send update if moved enough distance OR if walking state changed
    const walkingStateChanged = currentPlayer.lastSentWalking !== currentPlayer.isWalking;

    if (distanceMoved < MIN_MOVE_DISTANCE && !walkingStateChanged) {
        return; // Skip update if not moved enough
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

        // Only update other players, not current player
        const newPlayers = new Map();
        data.forEach(player => {
            if (!currentPlayer || player.id !== currentPlayer.id) {
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
                    isWalking: player.is_walking,
                    lastMoved: new Date(player.last_seen).getTime()
                });
            }
        });
        players = newPlayers;
        updatePlayerCount();
    } catch (error) {
        console.error('Error fetching players:', error);
    }
}

function handlePlayerUpdate(payload) {
    console.log('Player update:', payload.eventType, payload);

    // Handle DELETE events (player left)
    if (payload.eventType === 'DELETE') {
        const playerId = payload.old?.id;
        if (playerId && players.has(playerId)) {
            players.delete(playerId);
            updatePlayerCount();
            console.log('Player left:', playerId);
        }
        return;
    }

    // Handle INSERT/UPDATE events
    const player = payload.new;
    if (!player || (currentPlayer && player.id === currentPlayer.id)) return;

    // Remove old players (inactive for more than 30 seconds)
    const thirtySecondsAgo = Date.now() - 30000;
    if (new Date(player.last_seen).getTime() < thirtySecondsAgo) {
        players.delete(player.id);
        updatePlayerCount();
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
        isWalking: player.is_walking,
        lastMoved: new Date(player.last_seen).getTime()
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
    console.log('Chat update received:', payload);

    const chatData = payload.new;
    if (!chatData) {
        console.warn('Chat update missing data');
        return;
    }
    
    // IMPORTANT: Always process all chat messages, even from current player
    // This ensures all clients see all messages consistently
    
    console.log(`Adding chat message for player ${chatData.player_name} (${chatData.player_id}): ${chatData.message}`);
    
    // Add chat message for the player
    chatMessages.set(chatData.player_id, {
        text: chatData.message,
        timestamp: new Date(chatData.timestamp).getTime(),
        playerId: chatData.player_id,
        playerName: chatData.player_name
    });
    
    // Debug current chat messages
    console.log('Current chat messages:', Array.from(chatMessages.entries()));
}

function handleStickerUpdate(payload) {
    console.log('Sticker update:', payload);

    const stickerData = payload.new;
    if (!stickerData) return;

    // Add sticker to the scene
    stickers.set(stickerData.id, {
        id: stickerData.id,
        url: stickerData.url,
        x: stickerData.x,
        y: stickerData.y,
        timestamp: new Date(stickerData.timestamp).getTime(),
        placedBy: stickerData.placed_by
    });
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

        // Add all stickers to the scene
        data.forEach(sticker => {
            stickers.set(sticker.id, {
                id: sticker.id,
                url: sticker.url,
                x: sticker.x,
                y: sticker.y,
                timestamp: new Date(sticker.timestamp).getTime(),
                placedBy: sticker.placed_by
            });
        });
    } catch (error) {
        console.error('Error fetching stickers:', error);
    }
}

function updatePlayerCount() {
    // Only count players that are visible (other players + self)
    const count = players.size + (currentPlayer ? 1 : 0);
    document.getElementById('playerCount').textContent = count;
}

function handleInput() {
    if (!currentPlayer) return;

    let moved = false;
    const oldX = currentPlayer.x;
    const oldY = currentPlayer.y;

    // WASD and Arrow key controls
    if (keys['w'] || keys['arrowup']) {
        currentPlayer.y = Math.max(0, currentPlayer.y - MOVE_SPEED);
        moved = true;
    }
    if (keys['s'] || keys['arrowdown']) {
        currentPlayer.y = Math.min(canvas.height - PLAYER_SIZE, currentPlayer.y + MOVE_SPEED);
        moved = true;
    }
    if (keys['a'] || keys['arrowleft']) {
        currentPlayer.x = Math.max(0, currentPlayer.x - MOVE_SPEED);
        moved = true;
    }
    if (keys['d'] || keys['arrowright']) {
        currentPlayer.x = Math.min(canvas.width - PLAYER_SIZE, currentPlayer.x + MOVE_SPEED);
        moved = true;
    }

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
    const image = player.isWalking ? playerImages.walking : playerImages.standing;

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
        if (player.targetX !== undefined && player.targetY !== undefined) {
            // Calculate distance to target
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If close enough, snap to target
            if (distance < 2) {
                player.x = player.targetX;
                player.y = player.targetY;
            } else {
                // Smooth interpolation toward target
                player.x += dx * INTERPOLATION_SPEED;
                player.y += dy * INTERPOLATION_SPEED;
            }
            // Set walking animation based on movement
            player.isWalking = distance > 2;
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
    console.log(`Chat message added locally for ${currentPlayer.name}: ${message}`);

    // Send to database for syncing
    await sendChatToDatabase(chatData);

    // Clear input
    chatInput.value = '';
    chatInput.blur();

    console.log(`${currentPlayer.name}: ${message}`);
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
                x: stickerData.x,
                y: stickerData.y,
                placed_by: stickerData.placedBy,
                timestamp: new Date(stickerData.timestamp).toISOString()
            });

        if (error) {
            console.error('Error sending sticker:', error);
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

    // Create image object to test if URL works
    const img = new Image();

    img.onload = () => {
        const stickerData = {
            id: stickerId,
            url: imageUrl,
            x: currentPlayer.x + PLAYER_SIZE / 2 - 25, // Center at player position
            y: currentPlayer.y + PLAYER_SIZE / 2 - 25,
            timestamp: Date.now(),
            placedBy: currentPlayer.name
        };

        stickers.set(stickerId, stickerData);

        // Send sticker to database for syncing
        sendStickerToDatabase(stickerData);

        console.log(`Sticker placed by ${currentPlayer.name} at player location`);
    };

    img.onerror = () => {
        alert('Failed to load image. Please check the URL and try again.');
    };

    img.src = imageUrl;

    // Clear input
    const stickerInput = document.getElementById('stickerInput');
    stickerInput.value = '';
}

function placeStickerAt(x, y) {
    const stickerInput = document.getElementById('stickerInput');
    const imageUrl = stickerInput.value.trim();

    if (!imageUrl) return;

    const stickerId = 'sticker_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    // Create image object to test if URL works
    const img = new Image();

    img.onload = () => {
        const stickerData = {
            id: stickerId,
            url: imageUrl,
            x: x - 25, // Center the 50px sticker
            y: y - 25,
            timestamp: Date.now(),
            placedBy: currentPlayer ? currentPlayer.name : 'Anonymous'
        };

        stickers.set(stickerId, stickerData);

        // Send sticker to database for syncing
        sendStickerToDatabase(stickerData);

        console.log(`Sticker placed by ${currentPlayer?.name || 'Anonymous'} at (${x}, ${y})`);
    };

    img.onerror = () => {
        alert('Failed to load image. Please check the URL and try again.');
    };

    img.src = imageUrl;

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
    
    // Debug: Show active chat messages count
    if (chatMessages.size > 0) {
        console.log(`Active chat messages: ${chatMessages.size}`);
    }
}

function drawStickers() {
    stickers.forEach(sticker => {
        // Check if image is already cached
        if (stickerImages.has(sticker.id)) {
            const img = stickerImages.get(sticker.id);
            if (img.complete && img.naturalWidth > 0) {
                ctx.drawImage(img, sticker.x, sticker.y, 50, 50);
            }
        } else {
            // Load and cache the image
            loadStickerImage(sticker);
        }
    });
}

function loadStickerImage(sticker) {
    // Create placeholder immediately to avoid CORS issues
    createStickerPlaceholder(sticker);

    // Try to load the actual image without crossOrigin
    const img = new Image();

    img.onload = () => {
        // Only replace placeholder if image loads successfully
        stickerImages.set(sticker.id, img);
        console.log(`Sticker image loaded: ${sticker.id}`);
    };

    img.onerror = () => {
        console.warn(`Failed to load sticker image: ${sticker.url} - Using placeholder`);
        // Placeholder is already created, so do nothing
    };

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
        if (player.lastMoved < thirtySecondsAgo) {
            players.delete(id);
        }
    });
    updatePlayerCount();
});