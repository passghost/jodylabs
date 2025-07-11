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
                // Move to deck builder when connected
                setTimeout(() => {
                    this.showDeckBuilderScreen();
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
            this.elements.startGameBtn.disabled = this.deckCards.length < 20;
            if (this.deckCards.length < 20) {
                this.elements.startGameBtn.title = `Need at least 20 cards (currently ${this.deckCards.length})`;
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
        if (this.deckCards.length < 20) {
            Utils.showNotification('You need at least 20 cards to start the game', 'warning');
            return;
        }
        
        if (!this.game.networking.isConnectedToOpponent()) {
            Utils.showNotification('No opponent connected', 'warning');
            return;
        }
        
        // Create deck from cards
        const deckId = Utils.generateId();
        const deck = new Deck(deckId, 'Player Deck', [...this.deckCards]);
        
        // Set player deck in game
        this.game.setPlayerDeck(deck);
        
        // Show game screen
        this.showGameScreen();
        
        Utils.showNotification('Game starting!', 'success');
    }

    // Game functionality
    leaveGame() {
        if (confirm('Are you sure you want to leave the game?')) {
            this.game.networking.disconnect();
            this.showLobbyScreen();
        }
    }

    // Deck persistence
    saveDeck() {
        const deckData = {
            cards: this.deckCards.map(card => card.serialize()),
            timestamp: Date.now()
        };
        Utils.saveToStorage('saved_deck', deckData);
    }

    loadSavedDeck() {
        const deckData = Utils.loadFromStorage('saved_deck');
        if (deckData && deckData.cards) {
            this.deckCards = deckData.cards.map(cardData => Card.deserialize(cardData));
            this.updateDeckDisplay();
        }
    }

    // Global event handlers
    handleGlobalClick(event) {
        // Hide context menu when clicking outside
        if (!event.target.closest('#context-menu')) {
            this.elements.contextMenu?.classList.add('hidden');
        }
        
        // Hide join room form when clicking outside
        if (!event.target.closest('#join-room-form') && 
            !event.target.closest('#join-room-btn')) {
            this.hideJoinRoomForm();
        }
    }

    // Cleanup
    cleanup() {
        this.saveDeck();
        this.game?.destroy();
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
