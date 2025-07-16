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

// Game constants
const PLAYER_SIZE = 32;
const MOVE_SPEED = 3;
const UPDATE_INTERVAL = 150; // ms - more frequent updates for smoother sync
const INTERPOLATION_SPEED = 0.2; // Slightly faster interpolation
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

    // Mouse click to move
    canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        const targetX = e.clientX - rect.left - PLAYER_SIZE / 2;
        const targetY = e.clientY - rect.top - PLAYER_SIZE / 2;

        currentPlayer.x = Math.max(0, Math.min(canvas.width - PLAYER_SIZE, targetX));
        currentPlayer.y = Math.max(0, Math.min(canvas.height - PLAYER_SIZE, targetY));
        currentPlayer.isWalking = true;
        currentPlayer.lastMoved = Date.now();
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

CREATE TABLE players (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  x INTEGER NOT NULL,
  y INTEGER NOT NULL,
  is_walking BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- Allow anonymous users to read and write
CREATE POLICY "Allow anonymous access" ON players
FOR ALL USING (true) WITH CHECK (true);

3. Refresh the page and multiplayer will work!
            `);
            return;
        }

        // Add current player to database
        await updatePlayerPosition();

        // Subscribe to player updates with unique channel name
        const channelName = 'players_' + Math.random().toString(36).substr(2, 9);
        const channel = supabase
            .channel(channelName)
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'players' },
                handlePlayerUpdate
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

        // Fetch existing players
        await fetchAllPlayers();

        // Add fallback polling in case real-time doesn't work
        setInterval(async () => {
            await fetchAllPlayers();
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

        players.clear();
        data.forEach(player => {
            if (player.id !== currentPlayer.id) {
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
            }
        });

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
    if (!player || player.id === currentPlayer?.id) return;

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

function updatePlayerCount() {
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

    // Draw other players
    players.forEach(player => {
        drawPlayer(player);
    });

    // Draw current player
    if (currentPlayer) {
        drawPlayer(currentPlayer, true);
    }
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
        if (player.targetX !== undefined && player.targetY !== undefined) {
            // Calculate distance to target
            const dx = player.targetX - player.x;
            const dy = player.targetY - player.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // If close enough, snap to target
            if (distance < 1) {
                player.x = player.targetX;
                player.y = player.targetY;
            } else {
                // Smooth interpolation toward target
                player.x += dx * INTERPOLATION_SPEED;
                player.y += dy * INTERPOLATION_SPEED;

                // Set walking animation based on movement
                player.isWalking = distance > 2;
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

// Cleanup inactive players periodically
setInterval(() => {
    const thirtySecondsAgo = Date.now() - 30000;
    players.forEach((player, id) => {
        if (player.lastMoved < thirtySecondsAgo) {
            players.delete(id);
        }
    });
    updatePlayerCount();
}, 5000);