// Main application controller

class App {
    constructor() {
        this.game = new Game(); // Initialize game here
        this.currentDeck = null;
        this.deckCards = [];
        this.currentCardPreview = null;
        
        // UI Elements
        this.elements = {
            // Lobby screen
            playerNameInput: document.getElementById('player-name'),
            createRoomBtn: document.getElementById('create-room-btn'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            joinRoomForm: document.getElementById('join-room-form'),
            roomCodeInput: document.getElementById('room-code'),
            joinBtn: document.getElementById('join-btn'),
            roomInfo: document.getElementById('room-info'),
            currentRoomCode: document.getElementById('current-room-code'),
            connectionStatus: document.getElementById('connection-status'),
            
            // Card creator screen
            cardPreview: document.getElementById('card-preview'),
            cardFront: document.getElementById('card-front'),
            cardBack: document.getElementById('card-back'),
            previewImage: document.getElementById('preview-image'),
            imageUpload: document.getElementById('image-upload'),
            uploadBtn: document.getElementById('upload-btn'),
            flipCardBtn: document.getElementById('flip-card-btn'),
            addToDeckBtn: document.getElementById('add-to-deck-btn'),
            deckGrid: document.getElementById('deck-grid'),
            deckCount: document.getElementById('deck-count'),
            clearDeckBtn: document.getElementById('clear-deck-btn'),
            startGameBtn: document.getElementById('start-game-btn'),
            
            // Game screen
            leaveGameBtn: document.getElementById('leave-game-btn'),
            playerDeck: document.getElementById('player-deck'),
            playerHand: document.getElementById('player-hand'),
            opponentDeck: document.getElementById('opponent-deck'),
            opponentHand: document.getElementById('opponent-hand'),
            playArea: document.getElementById('play-area'),
            contextMenu: document.getElementById('context-menu')
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedDeck();
        this.showLobbyScreen();
        
        // Set up game callbacks
        this.setupGameCallbacks();
    }

    setupEventListeners() {
        // Lobby screen events
        this.elements.createRoomBtn?.addEventListener('click', () => this.createRoom());
        this.elements.joinRoomBtn?.addEventListener('click', () => this.showJoinRoomForm());
        this.elements.joinBtn?.addEventListener('click', () => this.joinRoom());
        
        // Enter key handling for inputs
        this.elements.playerNameInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.elements.createRoomBtn?.click();
            }
        });
        
        this.elements.roomCodeInput?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.elements.joinBtn?.click();
            }
        });
        
        // Card creator screen events
        this.elements.uploadBtn?.addEventListener('click', () => this.elements.imageUpload?.click());
        this.elements.imageUpload?.addEventListener('change', (e) => this.handleImageUpload(e));
        this.elements.flipCardBtn?.addEventListener('click', () => this.flipCardPreview());
        this.elements.addToDeckBtn?.addEventListener('click', () => this.addCardToDeck());
        this.elements.clearDeckBtn?.addEventListener('click', () => this.clearDeck());
        this.elements.startGameBtn?.addEventListener('click', () => this.startGame());
        
        // Game screen events
        this.elements.leaveGameBtn?.addEventListener('click', () => this.leaveGame());
        
        // Debug buttons
        document.getElementById('show-stats-btn')?.addEventListener('click', () => this.showConnectionStats());
        document.getElementById('clear-debug-btn')?.addEventListener('click', () => this.clearDebugInfo());
        
        // Global events
        document.addEventListener('click', (e) => this.handleGlobalClick(e));
        window.addEventListener('beforeunload', () => this.cleanup());
        
        // Drag and drop for card creator
        this.setupDragAndDrop();
    }

    setupGameCallbacks() {
        if (!this.game) return;
        
        // Set up networking callbacks through game
        this.game.networking.onConnectionStateChange = (state) => {
            this.handleConnectionStateChange(state);
            this.updateDebugInfo(`Connection state: ${state}`);
        };
        
        this.game.networking.onOpponentJoined = (opponentName) => {
            Utils.showNotification(`${opponentName} joined the room!`, 'success');
            this.updateDebugInfo(`Opponent ${opponentName} joined`);
            this.showDeckBuilderScreen();
        };
        
        this.game.networking.onOpponentLeft = (opponentName) => {
            Utils.showNotification(`${opponentName} left the room`, 'warning');
            this.updateDebugInfo(`Opponent ${opponentName} left`);
            this.showLobbyScreen();
        };
        
        // Set up message handler for ready system and game coordination
        this.game.networking.onMessageReceived = (message) => {
            this.handleNetworkMessage(message);
        };
        
        // Add debugging for signals
        const originalHandleSignal = this.game.networking.handleSignal.bind(this.game.networking);
        this.game.networking.handleSignal = async (signal) => {
            this.updateDebugInfo(`Received: ${signal.type} from ${signal.sender}`);
            return await originalHandleSignal(signal);
        };
        
        const originalSendSignal = this.game.networking.sendSignal.bind(this.game.networking);
        this.game.networking.sendSignal = (signal) => {
            this.updateDebugInfo(`Sending: ${signal.type}`);
            return originalSendSignal(signal);
        };
    }

    updateDebugInfo(message) {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            const timestamp = new Date().toLocaleTimeString();
            debugInfo.innerHTML += `<div>[${timestamp}] ${message}</div>`;
            // Keep only last 8 messages
            const messages = debugInfo.querySelectorAll('div');
            if (messages.length > 8) {
                messages[0].remove();
            }
            // Auto scroll to bottom
            debugInfo.scrollTop = debugInfo.scrollHeight;
        }
        // Also log to console
        console.log(`[DEBUG] ${message}`);
    }

    setupDragAndDrop() {
        const uploadArea = this.elements.cardFront;
        if (!uploadArea) return;
        
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });
        
        uploadArea.addEventListener('dragleave', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
        });
        
        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.processImageFile(files[0]);
            }
        });
    }

    // Screen management
    showLobbyScreen() {
        this.setActiveScreen('lobby-screen');
        this.hideJoinRoomForm();
        this.hideRoomInfo();
        
        // Reset lobby state
        if (this.elements.playerNameInput) {
            this.elements.playerNameInput.value = '';
        }
        if (this.elements.roomCodeInput) {
            this.elements.roomCodeInput.value = '';
        }
    }

    showDeckBuilderScreen() {
        this.setActiveScreen('card-creator-screen');
        this.updateDeckDisplay();
    }

    showGameScreen() {
        this.setActiveScreen('game-screen');
        this.game?.changeGameState('playing');
    }

    setActiveScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));
        
        const activeScreen = document.getElementById(screenId);
        if (activeScreen) {
            activeScreen.classList.add('active');
        }
    }

    // Lobby functionality
    async createRoom() {
        const playerName = this.elements.playerNameInput?.value.trim();
        
        if (!playerName) {
            Utils.showNotification('Please enter your name', 'warning');
            return;
        }
        
        if (playerName.length > 20) {
            Utils.showNotification('Name must be 20 characters or less', 'warning');
            return;
        }
        
        try {
            // Recreate networking/game with simplified networking
            this.game.networking.disconnect();
            this.game.networking = new Networking();
            this.setupGameCallbacks();
            console.log('Creating room for player:', playerName);
            this.updateDebugInfo(`Creating room for ${playerName}...`);
            const roomCode = await this.game.networking.createRoom(playerName);
            this.showRoomInfo(roomCode);
            this.updateDebugInfo(`Room ${roomCode} created, waiting for opponent`);
            Utils.showNotification(`Room created: ${roomCode}`, 'success');
            
            // Copy room code to clipboard
            Utils.copyToClipboard(roomCode);
            
        } catch (error) {
            console.error('Create room error:', error);
            this.updateDebugInfo(`Error creating room: ${error.message}`);
            Utils.showNotification(`Failed to create room: ${error.message}`, 'error');
        }
    }

    showJoinRoomForm() {
        this.elements.joinRoomForm?.classList.remove('hidden');
        this.elements.roomCodeInput?.focus();
    }

    hideJoinRoomForm() {
        this.elements.joinRoomForm?.classList.add('hidden');
    }

    async joinRoom() {
        const playerName = this.elements.playerNameInput?.value.trim();
        const roomCode = this.elements.roomCodeInput?.value.trim().toUpperCase();
        
        if (!playerName) {
            Utils.showNotification('Please enter your name', 'warning');
            return;
        }
        
        if (!roomCode || roomCode.length !== 6) {
            Utils.showNotification('Please enter a valid 6-character room code', 'warning');
            return;
        }
        
        try {
            // Recreate networking/game with simplified networking
            this.game.networking.disconnect();
            this.game.networking = new Networking();
            this.setupGameCallbacks();
            console.log('Joining room:', roomCode, 'as player:', playerName);
            this.updateDebugInfo(`Joining room ${roomCode} as ${playerName}...`);
            await this.game.networking.joinRoom(roomCode, playerName);
            this.showRoomInfo(roomCode);
            this.updateDebugInfo(`Joined room ${roomCode}, connecting to host...`);
            Utils.showNotification(`Joining room: ${roomCode}`, 'info');
            
        } catch (error) {
            console.error('Join room error:', error);
            this.updateDebugInfo(`Error joining room: ${error.message}`);
            Utils.showNotification(`Failed to join room: ${error.message}`, 'error');
        }
    }

    showRoomInfo(roomCode) {
        this.elements.roomInfo?.classList.remove('hidden');
        if (this.elements.currentRoomCode) {
            this.elements.currentRoomCode.textContent = roomCode;
        }
        
        // Hide lobby form
        this.elements.createRoomBtn?.parentElement?.classList.add('hidden');
    }

    hideRoomInfo() {
        this.elements.roomInfo?.classList.add('hidden');
        this.elements.createRoomBtn?.parentElement?.classList.remove('hidden');
    }

    handleConnectionStateChange(state) {
        if (this.elements.connectionStatus) {
            this.elements.connectionStatus.textContent = this.getConnectionStatusText(state);
        }
        
        // Also update room code display in game screen
        const roomCodeDisplay = document.getElementById('room-code-display');
        if (roomCodeDisplay && this.game.networking.getRoomCode()) {
            roomCodeDisplay.textContent = `Room: ${this.game.networking.getRoomCode()}`;
        }
        
        switch (state) {
            case 'connected':
                Utils.showNotification('Connected to opponent!', 'success');
                // Move to deck builder when connected and initialize ready system
                setTimeout(() => {
                    this.showDeckBuilderScreen();
                    // Initialize ready system after showing deck builder
                    setTimeout(() => {
                        this.initializeReadySystem();
                    }, 500);
                }, 1000);
                break;
            case 'error':
            case 'disconnected':
                if (this.game.networking.getRoomCode()) {
                    Utils.showNotification('Connection lost', 'warning');
                } else {
                    this.showLobbyScreen();
                }
                break;
        }
    }

    getConnectionStatusText(state) {
        switch (state) {
            case 'connecting':
                return 'Connecting to opponent...';
            case 'connected':
                return 'Connected! Starting game...';
            case 'disconnected':
                return 'Disconnected';
            case 'error':
                return 'Connection failed';
            default:
                return 'Unknown status';
        }
    }

    // Debug methods
    async showConnectionStats() {
        if (this.game && this.game.networking) {
            this.game.networking.logConnectionState();
            const stats = await this.game.networking.getConnectionStats();
            if (stats) {
                this.updateDebugInfo('=== Connection Statistics ===');
                this.updateDebugInfo(`Connection: ${stats.connectionState}`);
                this.updateDebugInfo(`ICE Connection: ${stats.iceConnectionState}`);
                this.updateDebugInfo(`ICE Gathering: ${stats.iceGatheringState}`);
                this.updateDebugInfo(`Signaling: ${stats.signalingState}`);
                
                if (stats.dataChannel) {
                    this.updateDebugInfo(`Data Channel: ${stats.dataChannel.readyState}`);
                    this.updateDebugInfo(`Buffered: ${stats.dataChannel.bufferedAmount} bytes`);
                }
                
                this.updateDebugInfo(`Local ICE Candidates: ${stats.candidates.local.length}`);
                this.updateDebugInfo(`Remote ICE Candidates: ${stats.candidates.remote.length}`);
                this.updateDebugInfo('===============================');
            } else {
                this.updateDebugInfo('Failed to get connection statistics');
            }
        } else {
            this.updateDebugInfo('No active networking connection');
        }
    }
    
    clearDebugInfo() {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.innerHTML = '';
        }
    }

    // Card creator functionality
    async handleImageUpload(event) {
        const file = event.target.files[0];
        if (file) {
            await this.processImageFile(file);
        }
    }

    async processImageFile(file) {
        try {
            // Validate file
            Utils.validateImageFile(file);
            
            // Resize and compress image
            const resizedBlob = await Utils.resizeImage(file);
            const imageData = await Utils.blobToBase64(resizedBlob);
            
            // Update preview
            this.currentCardPreview = imageData;
            this.updateCardPreview();
            
            Utils.showNotification('Image uploaded successfully!', 'success', 2000);
            
        } catch (error) {
            Utils.showNotification(error.message, 'error');
        }
    }

    updateCardPreview() {
        const previewImage = this.elements.previewImage;
        const uploadPlaceholder = this.elements.cardFront?.querySelector('.upload-placeholder');
        
        if (this.currentCardPreview && previewImage) {
            previewImage.src = this.currentCardPreview;
            previewImage.style.display = 'block';
            if (uploadPlaceholder) {
                uploadPlaceholder.style.display = 'none';
            }
        } else if (previewImage) {
            previewImage.style.display = 'none';
            if (uploadPlaceholder) {
                uploadPlaceholder.style.display = 'flex';
            }
        }
    }

    flipCardPreview() {
        this.elements.cardPreview?.classList.toggle('flipped');
    }

    addCardToDeck() {
        if (!this.currentCardPreview) {
            Utils.showNotification('Please upload an image first', 'warning');
            return;
        }
        
        const cardId = Utils.generateId();
        const cardName = `Card ${this.deckCards.length + 1}`;
        
        const card = new Card(cardId, this.currentCardPreview, cardName);
        this.deckCards.push(card);
        
        this.updateDeckDisplay();
        this.saveDeck();
        
        // Clear current preview
        this.currentCardPreview = null;
        this.elements.imageUpload.value = '';
        this.updateCardPreview();
        
        Utils.showNotification('Card added to deck!', 'success', 2000);
    }

    updateDeckDisplay() {
        if (!this.elements.deckGrid || !this.elements.deckCount) return;
        
        // Update count
        this.elements.deckCount.textContent = this.deckCards.length.toString();
        
        // Clear grid
        this.elements.deckGrid.innerHTML = '';
        
        // Add cards to grid
        this.deckCards.forEach((card, index) => {
            const cardElement = this.createDeckCardElement(card, index);
            this.elements.deckGrid.appendChild(cardElement);
        });
        
        // Update start game button
        if (this.elements.startGameBtn) {
            this.elements.startGameBtn.disabled = this.deckCards.length < 5; // Reduced for testing
            if (this.deckCards.length < 5) {
                this.elements.startGameBtn.title = `Need at least 5 cards (currently ${this.deckCards.length})`;
            } else {
                this.elements.startGameBtn.title = '';
            }
        }
    }

    createDeckCardElement(card, index) {
        const cardElement = document.createElement('div');
        cardElement.className = 'deck-card';
        cardElement.dataset.cardIndex = index.toString();
        
        if (card.imageData) {
            const img = document.createElement('img');
            img.src = card.imageData;
            img.alt = card.name;
            cardElement.appendChild(img);
        }
        
        // Add remove button
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-btn';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = (e) => {
            e.stopPropagation();
            this.removeCardFromDeck(index);
        };
        cardElement.appendChild(removeBtn);
        
        // Add click handler for preview
        cardElement.onclick = () => {
            this.previewDeckCard(card);
        };
        
        return cardElement;
    }

    removeCardFromDeck(index) {
        if (index >= 0 && index < this.deckCards.length) {
            const removedCard = this.deckCards.splice(index, 1)[0];
            removedCard.destroy();
            this.updateDeckDisplay();
            this.saveDeck();
            
            Utils.showNotification('Card removed from deck', 'info', 2000);
        }
    }

    previewDeckCard(card) {
        // Show large preview of deck card
        if (this.game && this.game.playerDeck) {
            this.game.playerDeck.showCardPreview(card);
        }
    }

    clearDeck() {
        if (this.deckCards.length === 0) {
            Utils.showNotification('Deck is already empty', 'info');
            return;
        }
        
        if (confirm(`Are you sure you want to clear all ${this.deckCards.length} cards from your deck?`)) {
            this.deckCards.forEach(card => card.destroy());
            this.deckCards = [];
            this.updateDeckDisplay();
            this.saveDeck();
            
            Utils.showNotification('Deck cleared', 'success', 2000);
        }
    }

    startGame() {
        // This method is now replaced by the ready system
        // It will only be called in special cases or for backwards compatibility
        this.actuallyStartGame();
    }

    // Initialize the game board UI and controls
    initializeGameBoard() {
        // Update player name display
        const playerNameDisplay = document.getElementById('player-name-display');
        if (playerNameDisplay) {
            playerNameDisplay.textContent = this.game.networking.playerName;
        }
        
        // Update opponent name display
        const opponentNameDisplay = document.getElementById('opponent-name-display');
        if (opponentNameDisplay) {
            opponentNameDisplay.textContent = this.game.networking.opponentName || 'Opponent';
        }
        
        // Initialize ready system
        this.initializeReadySystem();
        
        // Update deck counts
        this.updateDeckCounts();
        this.updateHandCounts();
        
        // Setup game board interactions
        this.setupGameBoardInteractions();
    }

    // Initialize ready system for both players
    initializeReadySystem() {
        // Add ready status to the deck builder screen
        this.addReadySystemToUI();
        
        // Initialize ready states
        this.playerReady = false;
        this.opponentReady = false;
        
        // Update UI
        this.updateReadyUI();
    }

    // Add ready system UI elements
    addReadySystemToUI() {
        const deckActions = document.querySelector('.deck-actions');
        if (!deckActions) return;
        
        // Remove existing ready system if present
        const existingReadySystem = document.getElementById('ready-system');
        if (existingReadySystem) {
            existingReadySystem.remove();
        }
        
        // Create ready system container
        const readySystem = document.createElement('div');
        readySystem.id = 'ready-system';
        readySystem.className = 'ready-system';
        readySystem.innerHTML = `
            <div class="ready-status">
                <h3>Player Status</h3>
                <div class="player-ready-status">
                    <div class="ready-indicator">
                        <span id="player-ready-name">${this.game.networking.playerName}</span>
                        <span id="player-ready-status" class="status-not-ready">Not Ready</span>
                    </div>
                    <div class="ready-indicator">
                        <span id="opponent-ready-name">${this.game.networking.opponentName || 'Opponent'}</span>
                        <span id="opponent-ready-status" class="status-not-ready">Not Ready</span>
                    </div>
                </div>
                <div class="ready-actions">
                    <button id="toggle-ready-btn" class="btn secondary">Ready Up</button>
                    <button id="start-game-host-btn" class="btn primary" disabled>Start Game (Host Only)</button>
                </div>
            </div>
        `;
        
        // Insert before existing start game button
        const startGameBtn = this.elements.startGameBtn;
        if (startGameBtn) {
            startGameBtn.style.display = 'none'; // Hide old start button
        }
        
        deckActions.appendChild(readySystem);
        
        // Add event listeners
        document.getElementById('toggle-ready-btn').addEventListener('click', () => this.toggleReady());
        document.getElementById('start-game-host-btn').addEventListener('click', () => this.hostStartGame());
    }

    // Toggle player ready status
    toggleReady() {
        if (this.deckCards.length < 5) {
            Utils.showNotification('You need at least 5 cards to be ready', 'warning');
            return;
        }
        
        this.playerReady = !this.playerReady;
        
        // Send ready status to opponent
        this.game.networking.sendMessage({
            type: 'player-ready',
            playerName: this.game.networking.playerName,
            isReady: this.playerReady
        });
        
        this.updateReadyUI();
        
        Utils.showNotification(
            this.playerReady ? 'You are ready!' : 'You are no longer ready',
            this.playerReady ? 'success' : 'info'
        );
    }

    // Host starts the game when both players are ready
    hostStartGame() {
        if (!this.game.networking.isHost) {
            Utils.showNotification('Only the host can start the game', 'warning');
            return;
        }
        
        if (!this.playerReady || !this.opponentReady) {
            Utils.showNotification('Both players must be ready to start', 'warning');
            return;
        }
        
        // Send game start signal to opponent
        this.game.networking.sendMessage({
            type: 'game-starting',
            playerName: this.game.networking.playerName
        });
        
        // Start the game locally
        this.actuallyStartGame();
    }

    // Actually start the game (called by both host and guest)
    actuallyStartGame() {
        // Create deck from cards
        const deckId = Utils.generateId();
        const deck = new Deck(deckId, 'Player Deck', [...this.deckCards]);
        
        // Set player deck in game and initialize game state
        this.game.setPlayerDeck(deck);
        this.game.initializeGameBoard();
        
        // Show game screen
        this.showGameScreen();
        
        // Initialize game board UI
        this.initializeActualGameBoard();
        
        Utils.showNotification('Game started!', 'success');
    }

    // Initialize actual game board (separate from ready system)
    initializeActualGameBoard() {
        // Update player name display
        const playerNameDisplay = document.getElementById('player-name-display');
        if (playerNameDisplay) {
            playerNameDisplay.textContent = this.game.networking.playerName;
        }
        
        // Update opponent name display
        const opponentNameDisplay = document.getElementById('opponent-name-display');
        if (opponentNameDisplay) {
            opponentNameDisplay.textContent = this.game.networking.opponentName || 'Opponent';
        }
        
        // Initialize game zones
        this.initializeGameZones();
        
        // Update deck counts
        this.updateDeckCounts();
        this.updateHandCounts();
        
        // Setup enhanced game board interactions
        this.setupEnhancedGameBoardInteractions();
        
        // Initialize side panel
        this.initializeSidePanel();
        
        // Start game rendering loop
        this.game.startGameLoop();
    }

    // Initialize all game zones and their data structures
    initializeGameZones() {
        // Player zones
        this.game.playerGraveyard = [];
        this.game.playerExile = [];
        this.game.playerSideboard = [];
        this.game.playerCommandZone = [];
        
        // Opponent zones
        this.game.opponentGraveyard = [];
        this.game.opponentExile = [];
        this.game.opponentSideboard = [];
        this.game.opponentCommandZone = [];
        
        // Shared zones
        this.game.battlefield = {
            creatures: [],
            artifacts: [],
            enchantments: [],
            other: []
        };
        this.game.stack = [];
        this.game.sharedLibrary = [];
        this.game.revealedCards = [];
        
        // Update all zone displays
        this.updateAllZoneDisplays();
    }

    // Setup enhanced interactions for all game areas
    setupEnhancedGameBoardInteractions() {
        // Hand areas
        this.setupZoneInteractions('player-hand', 'hand');
        this.setupZoneInteractions('opponent-hand', 'opponent-hand');
        
        // Deck areas
        this.setupPileInteractions('player-deck', 'player-deck');
        this.setupPileInteractions('opponent-deck', 'opponent-deck');
        this.setupPileInteractions('player-graveyard', 'player-graveyard');
        this.setupPileInteractions('opponent-graveyard', 'opponent-graveyard');
        this.setupPileInteractions('player-exile', 'player-exile');
        this.setupPileInteractions('opponent-exile', 'opponent-exile');
        
        // Battlefield zones
        this.setupZoneInteractions('creature-zone', 'battlefield-creatures');
        this.setupZoneInteractions('artifact-zone', 'battlefield-artifacts');
        this.setupZoneInteractions('enchantment-zone', 'battlefield-enchantments');
        this.setupZoneInteractions('battlefield', 'battlefield-general');
        
        // Shared zones
        this.setupZoneInteractions('shared-library', 'shared-library');
        this.setupZoneInteractions('stack-zone', 'stack');
        
        // Side panel zones
        this.setupZoneInteractions('player-sideboard', 'sideboard');
        this.setupZoneInteractions('revealed-cards', 'revealed');
        this.setupZoneInteractions('command-zone', 'command');
        
        // Global interactions
        this.setupGlobalInteractions();
    }

    // Setup interactions for a specific zone
    setupZoneInteractions(elementId, zoneType) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        // Drag and drop
        element.addEventListener('dragover', (e) => this.handleDragOver(e, zoneType));
        element.addEventListener('drop', (e) => this.handleDrop(e, zoneType));
        element.addEventListener('dragenter', (e) => this.handleDragEnter(e, zoneType));
        element.addEventListener('dragleave', (e) => this.handleDragLeave(e, zoneType));
        
        // Click interactions
        element.addEventListener('click', (e) => this.handleZoneClick(e, zoneType));
        element.addEventListener('contextmenu', (e) => this.handleZoneRightClick(e, zoneType));
        
        // Double-click for quick actions
        element.addEventListener('dblclick', (e) => this.handleZoneDoubleClick(e, zoneType));
    }

    // Setup pile-specific interactions (decks, graveyards, etc.)
    setupPileInteractions(elementId, pileType) {
        const element = document.getElementById(elementId);
        if (!element) return;
        
        element.addEventListener('click', (e) => this.handlePileClick(e, pileType));
        element.addEventListener('contextmenu', (e) => this.handlePileRightClick(e, pileType));
        element.addEventListener('dragover', (e) => this.handleDragOver(e, pileType));
        element.addEventListener('drop', (e) => this.handleDrop(e, pileType));
    }

    // Setup global game interactions
    setupGlobalInteractions() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleGameKeyboard(e));
        
        // Window focus events for multi-tab coordination
        window.addEventListener('focus', () => this.handleWindowFocus());
        window.addEventListener('blur', () => this.handleWindowBlur());
        
        // Prevent context menu on game board
        const gameBoard = document.getElementById('game-board');
        if (gameBoard) {
            gameBoard.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                return false;
            });
        }
    }

    // Enhanced drag and drop handlers
    handleDragOver(event, zoneType) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
        
        // Add visual feedback
        const target = event.currentTarget;
        if (!target.classList.contains('drop-zone-active')) {
            target.classList.add('drop-zone-active');
        }
    }

    handleDragEnter(event, zoneType) {
        event.preventDefault();
        event.currentTarget.classList.add('drop-zone-active');
    }

    handleDragLeave(event, zoneType) {
        // Only remove if actually leaving the element
        const rect = event.currentTarget.getBoundingClientRect();
        const x = event.clientX;
        const y = event.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            event.currentTarget.classList.remove('drop-zone-active');
        }
    }

    handleDrop(event, zoneType) {
        event.preventDefault();
        event.currentTarget.classList.remove('drop-zone-active');
        
        const cardId = event.dataTransfer.getData('text/plain');
        const sourceZone = event.dataTransfer.getData('application/source-zone');
        
        if (cardId) {
            this.moveCardToZone(cardId, sourceZone, zoneType, event);
        }
    }

    // Enhanced zone click handlers
    handleZoneClick(event, zoneType) {
        // Handle clicking on cards within zones
        const cardElement = event.target.closest('.hand-card, .battlefield-card, .table-card');
        if (cardElement) {
            const cardId = cardElement.dataset.cardId;
            this.selectCard(cardId, zoneType);
        }
    }

    handleZoneRightClick(event, zoneType) {
        event.preventDefault();
        
        const cardElement = event.target.closest('.hand-card, .battlefield-card, .table-card');
        if (cardElement) {
            const cardId = cardElement.dataset.cardId;
            this.showCardContextMenu(event, cardId, zoneType);
        } else {
            this.showZoneContextMenu(event, zoneType);
        }
    }

    handleZoneDoubleClick(event, zoneType) {
        const cardElement = event.target.closest('.hand-card, .battlefield-card, .table-card');
        if (cardElement) {
            const cardId = cardElement.dataset.cardId;
            this.handleCardDoubleClick(cardId, zoneType);
        }
    }

    // Pile interaction handlers
    handlePileClick(event, pileType) {
        switch (pileType) {
            case 'player-deck':
                this.drawCard();
                break;
            case 'player-graveyard':
                this.viewGraveyard('player');
                break;
            case 'opponent-graveyard':
                this.viewGraveyard('opponent');
                break;
            case 'player-exile':
                this.viewExile('player');
                break;
            case 'opponent-exile':
                this.viewExile('opponent');
                break;
        }
    }

    handlePileRightClick(event, pileType) {
        event.preventDefault();
        
        const menuOptions = this.getPileContextMenuOptions(pileType);
        this.showContextMenu(event, menuOptions);
    }

    // Enhanced card reveal/hide functionality
    revealCard(cardId, zoneType) {
        const card = this.findCard(cardId);
        if (!card) return;
        
        card.revealed = true;
        card.faceDown = false;
        
        // Update display
        const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElement) {
            cardElement.classList.remove('face-down');
            cardElement.classList.add('revealed');
        }
        
        // Network sync
        this.game.networking.sendMessage({
            type: 'card-revealed',
            cardId: cardId,
            zone: zoneType,
            playerName: this.game.networking.playerName
        });
        
        Utils.showNotification(`${card.name || 'Card'} revealed`, 'info', 1500);
    }

    hideCard(cardId, zoneType) {
        const card = this.findCard(cardId);
        if (!card) return;
        
        card.revealed = false;
        card.faceDown = true;
        
        // Update display
        const cardElement = document.querySelector(`[data-card-id="${cardId}"]`);
        if (cardElement) {
            cardElement.classList.add('face-down');
            cardElement.classList.remove('revealed');
        }
        
        // Network sync
        this.game.networking.sendMessage({
            type: 'card-hidden',
            cardId: cardId,
            zone: zoneType,
            playerName: this.game.networking.playerName
        });
    }

    // Pile viewing functionality
    viewGraveyard(player = 'player') {
        const graveyard = player === 'player' ? this.game.playerGraveyard : this.game.opponentGraveyard;
        this.showPileViewer(graveyard, `${player === 'player' ? 'Your' : 'Opponent\'s'} Graveyard`);
    }

    viewExile(player = 'player') {
        const exile = player === 'player' ? this.game.playerExile : this.game.opponentExile;
        this.showPileViewer(exile, `${player === 'player' ? 'Your' : 'Opponent\'s'} Exile`);
    }

    showPileViewer(pile, title) {
        // Create pile viewer modal
        const modal = document.createElement('div');
        modal.className = 'pile-viewer-modal';
        modal.innerHTML = `
            <div class="pile-viewer-content">
                <div class="pile-viewer-header">
                    <h3>${title}</h3>
                    <button class="close-pile-viewer">×</button>
                </div>
                <div class="pile-viewer-body">
                    ${pile.length === 0 ? '<p>This pile is empty.</p>' : ''}
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const body = modal.querySelector('.pile-viewer-body');
        pile.forEach((card, index) => {
            const cardElement = this.createCardElement(card, 'pile-viewer');
            cardElement.addEventListener('click', () => {
                this.selectCardInPileViewer(card, index, pile);
            });
            body.appendChild(cardElement);
        });
        
        // Add event listeners
        modal.querySelector('.close-pile-viewer').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                document.body.removeChild(modal);
            }
        });
    }

    selectCardInPileViewer(card, index, pile) {
        // Show card options when selected in pile viewer
        const options = [
            { label: 'To Hand', action: () => this.moveCardFromPileToHand(card, pile) },
            { label: 'To Battlefield', action: () => this.moveCardFromPileToBattlefield(card, pile) },
            { label: 'To Top of Deck', action: () => this.moveCardFromPileToTopOfDeck(card, pile) }
        ];
        
        // Create context menu at card position
        const cardElement = document.querySelector(`[data-card-id="${card.id}"]`);
        if (cardElement) {
            const rect = cardElement.getBoundingClientRect();
            const fakeEvent = {
                pageX: rect.left + rect.width / 2,
                pageY: rect.top + rect.height / 2
            };
            this.showContextMenu(fakeEvent, options);
        }
    }

    moveCardFromPileToHand(card, pile) {
        const index = pile.indexOf(card);
        if (index !== -1) {
            pile.splice(index, 1);
            this.game.playerHand.push(card);
            this.updateAllZoneDisplays();
            
            // Network sync
            this.game.networking.sendMessage({
                type: 'card-moved-to-hand',
                cardId: card.id,
                playerName: this.game.networking.playerName
            });
        }
    }

    moveCardFromPileToBattlefield(card, pile) {
        const index = pile.indexOf(card);
        if (index !== -1) {
            pile.splice(index, 1);
            this.handleBattlefieldPlacement(card, 'battlefield-general', null);
            this.updateAllZoneDisplays();
            
            // Network sync
            this.game.networking.sendMessage({
                type: 'card-moved-to-battlefield',
                cardId: card.id,
                playerName: this.game.networking.playerName
            });
        }
    }

    moveCardFromPileToTopOfDeck(card, pile) {
        const index = pile.indexOf(card);
        if (index !== -1 && this.game.playerDeck) {
            pile.splice(index, 1);
            this.game.playerDeck.cards.push(card);
            this.updateAllZoneDisplays();
            
            // Network sync
            this.game.networking.sendMessage({
                type: 'card-moved-to-deck',
                cardId: card.id,
                playerName: this.game.networking.playerName
            });
        }
    }

    // Stack management
    resolveTopOfStack() {
        if (this.game.stack && this.game.stack.length > 0) {
            const card = this.game.stack.pop();
            this.game.playerGraveyard.push(card);
            this.updateAllZoneDisplays();
            
            Utils.showNotification(`${card.name || 'Card'} resolved`, 'info', 1500);
            
            // Network sync
            this.game.networking.sendMessage({
                type: 'stack-resolved',
                cardId: card.id,
                playerName: this.game.networking.playerName
            });
        }
    }

    clearZone(zoneType) {
        const zone = this.getZoneArray(zoneType);
        if (zone && confirm(`Clear all cards from ${this.getZoneDisplayName(zoneType)}?`)) {
            // Move cards to graveyard
            while (zone.length > 0) {
                const card = zone.pop();
                this.game.playerGraveyard.push(card);
            }
            
            this.updateAllZoneDisplays();
            
            // Network sync
            this.game.networking.sendMessage({
                type: 'zone-cleared',
                zoneType: zoneType,
                playerName: this.game.networking.playerName
            });
        }
    }

    // Look at top card of deck
    lookAtTopCard() {
        if (this.game.playerDeck && this.game.playerDeck.cards.length > 0) {
            const topCard = this.game.playerDeck.cards[this.game.playerDeck.cards.length - 1];
            this.showCardPreview(topCard, true); // Private preview
            
            Utils.showNotification('Looking at top card of library', 'info', 1000);
        }
    }

    showCardPreview(card, isPrivate = false) {
        // Create or update card preview modal
        let preview = document.getElementById('card-preview-modal');
        if (!preview) {
            preview = document.createElement('div');
            preview.id = 'card-preview-modal';
            preview.className = 'card-preview-modal';
            document.body.appendChild(preview);
        }
        
        preview.innerHTML = `
            <div class="card-preview-content">
                <div class="card-preview-header">
                    <h3>${card.name || 'Card Preview'}</h3>
                    <button class="close-preview">×</button>
                </div>
                <div class="card-preview-image">
                    <img src="${card.imageUrl || ''}" alt="${card.name || 'Card'}" />
                </div>
                ${isPrivate ? '<div class="private-indicator">Private View</div>' : ''}
            </div>
        `;
        
        preview.style.display = 'block';
        
        // Add event listeners
        preview.querySelector('.close-preview').addEventListener('click', () => {
            preview.style.display = 'none';
        });
        
        preview.addEventListener('click', (e) => {
            if (e.target === preview) {
                preview.style.display = 'none';
            }
        });
    }

    // Helper methods
    getZoneArray(zoneType) {
        switch (zoneType) {
            case 'hand': return this.game.playerHand;
            case 'player-graveyard': return this.game.playerGraveyard;
            case 'player-exile': return this.game.playerExile;
            case 'battlefield-creatures': return this.game.battlefield.creatures;
            case 'battlefield-artifacts': return this.game.battlefield.artifacts;
            case 'battlefield-enchantments': return this.game.battlefield.enchantments;
            case 'battlefield-general': return this.game.battlefield.other;
            case 'stack': return this.game.stack;
            case 'shared-library': return this.game.sharedLibrary;
            case 'revealed': return this.game.revealedCards;
            case 'sideboard': return this.game.playerSideboard;
            case 'command': return this.game.playerCommandZone;
            default: return null;
        }
    }

    getZoneArrays(zoneType) {
        // Return multiple zones for searching
        return [this.getZoneArray(zoneType)].filter(Boolean);
    }

    getZoneDisplayName(zoneType) {
        const names = {
            'hand': 'Hand',
            'player-graveyard': 'Graveyard',
            'player-exile': 'Exile',
            'battlefield-creatures': 'Battlefield',
            'battlefield-artifacts': 'Battlefield',
            'battlefield-enchantments': 'Battlefield',
            'battlefield-general': 'Battlefield',
            'stack': 'Stack',
            'shared-library': 'Shared Library'
        };
        return names[zoneType] || zoneType;
    }

    clearSelection() {
        document.querySelectorAll('.card-selected').forEach(el => {
            el.classList.remove('card-selected');
        });
        this.selectedCard = null;
        this.selectedCards = [];
    }

    untapAllCards() {
        // Untap all cards in battlefield
        const zones = [
            this.game.battlefield.creatures,
            this.game.battlefield.artifacts,
            this.game.battlefield.enchantments,
            this.game.battlefield.other
        ];
        
        zones.forEach(zone => {
            zone.forEach(card => {
                card.tapped = false;
            });
        });
        
        this.updateAllZoneDisplays();
        
        // Network sync
        this.game.networking.sendMessage({
            type: 'untap-all',
            playerName: this.game.networking.playerName
        });
    }

    millCard() {
        if (this.game.playerDeck && this.game.playerDeck.cards.length > 0) {
            const card = this.game.playerDeck.drawCard();
            if (card) {
                this.game.playerGraveyard.push(card);
                this.updateAllZoneDisplays();
                
                Utils.showNotification(`Milled ${card.name}`, 'info', 1500);
            }
        }
    }

    // Update all zone displays
    updateAllZoneDisplays() {
        this.updateHandDisplay();
        this.updateBattlefieldDisplay();
        this.updateGraveyardDisplays();
        this.updateExileDisplays();
        this.updateStackDisplay();
        this.updateSideboardDisplay();
        this.updateRevealedCardsDisplay();
        this.updateCommandZoneDisplay();
        this.updateDeckCounts();
        this.updateHandCounts();
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});

// Handle page visibility changes
document.addEventListener('visibilitychange', () => {
    if (document.hidden && window.app) {
        window.app.saveDeck();
    }
});
