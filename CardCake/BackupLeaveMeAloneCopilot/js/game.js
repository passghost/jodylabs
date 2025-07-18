// Main game logic and state management

class Game {
    constructor() {
        this.gameState = 'lobby'; // lobby, deck-building, playing, paused, ended
        this.currentPlayer = null;
        this.opponent = null;
        
        // Game components
        this.networking = new Networking();
        this.playerDeck = null;
        this.opponentDeck = null;
        this.playerHand = [];
        this.opponentHand = [];
        this.playArea = [];
        
        // Canvas and rendering
        this.canvas = null;
        this.ctx = null;
        this.animationId = null;
        
        // Input handling
        this.mouse = { x: 0, y: 0, down: false };
        this.selectedCard = null;
        this.draggedCard = null;
        
        // Game settings
        this.settings = {
            maxHandSize: 10,
            initialHandSize: 7,
            maxDeckSize: 100,
            minDeckSize: 20
        };
        
        // Initialize
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupNetworking();
        this.loadSettings();
        
        // Initialize canvas when game screen is active
        this.canvas = document.getElementById('game-canvas');
        if (this.canvas) {
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
        }
    }

    setupEventListeners() {
        // Window resize
        window.addEventListener('resize', () => {
            this.resizeCanvas();
        });

        // Mouse events for canvas
        if (this.canvas) {
            this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
            this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
            this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
            this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        }

        // Keyboard events
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    setupNetworking() {
        this.networking.onConnectionStateChange = (state) => {
            this.handleConnectionStateChange(state);
        };

        this.networking.onMessageReceived = (message) => {
            this.handleNetworkMessage(message);
        };

        this.networking.onOpponentJoined = (opponentName) => {
            this.handleOpponentJoined(opponentName);
        };

        this.networking.onOpponentLeft = (opponentName) => {
            this.handleOpponentLeft(opponentName);
        };
    }

    // Game state management
    changeGameState(newState) {
        const oldState = this.gameState;
        this.gameState = newState;
        
        console.log(`Game state changed: ${oldState} -> ${newState}`);
        
        switch (newState) {
            case 'lobby':
                this.showLobbyScreen();
                break;
            case 'deck-building':
                this.showDeckBuilderScreen();
                break;
            case 'playing':
                this.showGameScreen();
                this.startGame();
                break;
            case 'paused':
                this.pauseGame();
                break;
            case 'ended':
                this.endGame();
                break;
        }
    }

    showLobbyScreen() {
        this.setActiveScreen('lobby-screen');
        this.stopGameLoop();
    }

    showDeckBuilderScreen() {
        this.setActiveScreen('card-creator-screen');
        this.stopGameLoop();
    }

    showGameScreen() {
        this.setActiveScreen('game-screen');
        this.resizeCanvas();
        this.startGameLoop();
    }

    setActiveScreen(screenId) {
        const screens = document.querySelectorAll('.screen');
        screens.forEach(screen => screen.classList.remove('active'));
        
        const activeScreen = document.getElementById(screenId);
        if (activeScreen) {
            activeScreen.classList.add('active');
        }
    }

    // Game loop
    startGameLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        const gameLoop = (timestamp) => {
            this.update(timestamp);
            this.render(timestamp);
            this.animationId = requestAnimationFrame(gameLoop);
        };
        
        this.animationId = requestAnimationFrame(gameLoop);
    }

    stopGameLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    update(timestamp) {
        // Update game logic
        this.updateCards(timestamp);
        this.updateAnimations(timestamp);
        this.updateInput();
    }

    render(timestamp) {
        if (!this.ctx) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game elements
        this.drawBackground();
        this.drawPlayArea();
        this.drawCards();
        this.drawUI();
    }

    // Canvas and rendering
    resizeCanvas() {
        if (!this.canvas) return;
        
        const rect = this.canvas.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
    }

    drawBackground() {
        if (!this.ctx) return;
        
        // Draw wood grain background
        const gradient = this.ctx.createLinearGradient(0, 0, this.canvas.width, this.canvas.height);
        gradient.addColorStop(0, '#0f4c3a');
        gradient.addColorStop(0.5, '#1a5f4a');
        gradient.addColorStop(1, '#0f4c3a');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Add subtle pattern
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
        for (let x = 0; x < this.canvas.width; x += 50) {
            for (let y = 0; y < this.canvas.height; y += 50) {
                if ((x + y) % 100 === 0) {
                    this.ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }

    drawPlayArea() {
        if (!this.ctx) return;
        
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const width = Math.min(600, this.canvas.width - 100);
        const height = Math.min(400, this.canvas.height - 200);
        
        // Draw play area border
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([10, 5]);
        this.ctx.strokeRect(centerX - width/2, centerY - height/2, width, height);
        this.ctx.setLineDash([]);
    }

    drawCards() {
        // Cards are drawn via DOM elements, not canvas
        // This method can be used for card-specific canvas effects
    }

    drawUI() {
        if (!this.ctx) return;
        
        // Draw connection status
        this.ctx.fillStyle = this.networking.isConnected ? '#4CAF50' : '#f44336';
        this.ctx.fillRect(10, 10, 20, 20);
        
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '14px Arial';
        this.ctx.fillText(
            this.networking.isConnected ? 'Connected' : 'Disconnected',
            40, 25
        );
    }

    // Input handling
    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        this.mouse.down = true;
        
        // Check for card selection
        this.checkCardSelection();
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = e.clientX - rect.left;
        this.mouse.y = e.clientY - rect.top;
        
        // Handle card dragging
        if (this.draggedCard && this.mouse.down) {
            this.updateCardDrag();
        }
    }

    handleMouseUp(e) {
        this.mouse.down = false;
        
        // Handle card drop
        if (this.draggedCard) {
            this.handleCardDrop();
        }
    }

    handleRightClick(e) {
        e.preventDefault();
        // Handle right-click context menu
    }

    handleKeyDown(e) {
        switch (e.key) {
            case 'Escape':
                this.deselectCard();
                break;
            case ' ':
                e.preventDefault();
                if (this.selectedCard) {
                    this.selectedCard.flip();
                }
                break;
            case 'Delete':
                if (this.selectedCard) {
                    this.removeCard(this.selectedCard);
                }
                break;
        }
    }

    handleKeyUp(e) {
        // Handle key up events
    }

    // Card management
    checkCardSelection() {
        // This is handled by DOM elements
    }

    updateCardDrag() {
        if (this.draggedCard) {
            this.draggedCard.setPosition(this.mouse.x - 40, this.mouse.y - 56);
        }
    }

    handleCardDrop() {
        if (this.draggedCard) {
            // Check drop zones
            const playArea = document.getElementById('play-area');
            const playAreaRect = playArea.getBoundingClientRect();
            
            if (Utils.pointInRect(
                this.mouse.x + this.canvas.getBoundingClientRect().left,
                this.mouse.y + this.canvas.getBoundingClientRect().top,
                playAreaRect.left, playAreaRect.top,
                playAreaRect.width, playAreaRect.height
            )) {
                this.playCard(this.draggedCard);
            }
            
            this.draggedCard = null;
        }
    }

    playCard(card) {
        // Move card to play area
        const playArea = document.getElementById('play-area');
        if (playArea && card.element) {
            playArea.appendChild(card.element);
            
            // Remove from hand
            const handIndex = this.playerHand.indexOf(card);
            if (handIndex !== -1) {
                this.playerHand.splice(handIndex, 1);
            }
            
            // Add to play area
            this.playArea.push(card);
            
            // Notify opponent
            this.networking.sendMessage({
                type: 'card_played',
                cardId: card.id,
                cardData: card.serialize()
            });
            
            // Update UI
            this.updateHandCount();
        }
    }

    returnCardToDeck(card) {
        if (this.playerDeck) {
            this.playerDeck.addCard(card);
            
            // Remove from current location
            const handIndex = this.playerHand.indexOf(card);
            const playIndex = this.playArea.indexOf(card);
            
            if (handIndex !== -1) {
                this.playerHand.splice(handIndex, 1);
            }
            if (playIndex !== -1) {
                this.playArea.splice(playIndex, 1);
            }
            
            // Remove element
            if (card.element && card.element.parentNode) {
                card.element.parentNode.removeChild(card.element);
            }
            
            this.updateHandCount();
        }
    }

    removeCard(card) {
        // Remove card from game
        const handIndex = this.playerHand.indexOf(card);
        const playIndex = this.playArea.indexOf(card);
        
        if (handIndex !== -1) {
            this.playerHand.splice(handIndex, 1);
        }
        if (playIndex !== -1) {
            this.playArea.splice(playIndex, 1);
        }
        
        card.destroy();
        this.updateHandCount();
    }

    deselectCard() {
        if (this.selectedCard) {
            this.selectedCard.isSelected = false;
            this.selectedCard = null;
        }
    }

    // Game flow
    startGame() {
        if (!this.playerDeck || this.playerDeck.isEmpty()) {
            Utils.showNotification('No deck available!', 'error');
            return;
        }
        
        // Draw initial hand
        this.drawInitialHand();
        
        // Update UI
        this.updateGameUI();
        
        // Notify opponent
        this.networking.sendMessage({
            type: 'game_started',
            playerName: this.networking.getPlayerName()
        });
        
        Utils.showNotification('Game started! Draw cards from your deck.', 'success');
    }

    drawInitialHand() {
        if (!this.playerDeck) return;
        
        const handSize = Math.min(this.settings.initialHandSize, this.playerDeck.getCardCount());
        
        for (let i = 0; i < handSize; i++) {
            const card = this.playerDeck.drawCard();
            if (card) {
                this.playerHand.push(card);
            }
        }
        
        this.updateHandCount();
    }

    pauseGame() {
        this.stopGameLoop();
        Utils.showNotification('Game paused', 'info');
    }

    endGame() {
        this.stopGameLoop();
        this.changeGameState('lobby');
        Utils.showNotification('Game ended', 'info');
    }

    // Network message handling
    handleConnectionStateChange(state) {
        const statusElement = document.getElementById('connection-status');
        if (statusElement) {
            statusElement.textContent = this.getConnectionStatusText(state);
        }
        
        switch (state) {
            case 'connected':
                Utils.showNotification('Connected to opponent!', 'success');
                if (this.gameState === 'lobby') {
                    this.changeGameState('deck-building');
                }
                break;
            case 'disconnected':
                Utils.showNotification('Disconnected from opponent', 'warning');
                break;
            case 'error':
                Utils.showNotification('Connection error', 'error');
                break;
        }
    }

    handleNetworkMessage(message) {
        switch (message.type) {
            case 'card_played':
                this.handleOpponentCardPlayed(message);
                break;
            case 'card_drawn':
                this.handleOpponentCardDrawn(message);
                break;
            case 'card_flipped':
                this.handleOpponentCardFlipped(message);
                break;
            case 'game_started':
                this.handleOpponentGameStarted(message);
                break;
            case 'deck_action':
                this.handleOpponentDeckAction(message);
                break;
        }
    }

    handleOpponentJoined(opponentName) {
        this.opponent = opponentName;
        const opponentNameElement = document.getElementById('opponent-name-display');
        if (opponentNameElement) {
            opponentNameElement.textContent = opponentName;
        }
        
        Utils.showNotification(`${opponentName} joined the game!`, 'success');
    }

    handleOpponentLeft(opponentName) {
        this.opponent = null;
        const opponentNameElement = document.getElementById('opponent-name-display');
        if (opponentNameElement) {
            opponentNameElement.textContent = 'Opponent';
        }
        
        Utils.showNotification(`${opponentName} left the game`, 'warning');
        
        // Return to lobby
        this.changeGameState('lobby');
    }

    // Opponent actions
    handleOpponentCardPlayed(message) {
        Utils.showNotification(`${message.sender} played a card`, 'info', 2000);
        this.updateOpponentHandCount(-1);
    }

    handleOpponentCardDrawn(message) {
        Utils.showNotification(`${message.sender} drew a card`, 'info', 2000);
        this.updateOpponentHandCount(1);
    }

    handleOpponentCardFlipped(message) {
        Utils.showNotification(`${message.sender} flipped a card`, 'info', 2000);
    }

    handleOpponentGameStarted(message) {
        Utils.showNotification(`${message.sender} started the game!`, 'info');
        if (this.gameState !== 'playing') {
            this.changeGameState('playing');
        }
    }

    handleOpponentDeckAction(message) {
        switch (message.action) {
            case 'deck_shuffled':
                Utils.showNotification(`${message.sender} shuffled their deck`, 'info', 2000);
                break;
            case 'card_drawn':
                this.updateOpponentHandCount(1);
                break;
        }
        
        this.updateOpponentDeckCount(message.cardCount);
    }

    // UI updates
    updateGameUI() {
        this.updateHandCount();
        this.updateDeckCount();
        this.updatePlayerName();
    }

    updateHandCount() {
        const handCountElement = document.getElementById('player-hand-count');
        if (handCountElement) {
            handCountElement.textContent = `Hand: ${this.playerHand.length}`;
        }
    }

    updateDeckCount() {
        const deckCountElement = document.getElementById('player-deck-count');
        if (deckCountElement && this.playerDeck) {
            deckCountElement.textContent = this.playerDeck.getCardCount().toString();
        }
    }

    updatePlayerName() {
        const playerNameElement = document.getElementById('player-name-display');
        if (playerNameElement) {
            playerNameElement.textContent = this.networking.getPlayerName();
        }
    }

    updateOpponentHandCount(change) {
        // Update opponent hand count display
        const opponentHandElement = document.getElementById('opponent-hand-count');
        if (opponentHandElement) {
            const currentText = opponentHandElement.textContent;
            const currentCount = parseInt(currentText.replace('Hand: ', '')) || 0;
            const newCount = Math.max(0, currentCount + change);
            opponentHandElement.textContent = `Hand: ${newCount}`;
        }
    }

    updateOpponentDeckCount(count) {
        const opponentDeckElement = document.getElementById('opponent-deck-count');
        if (opponentDeckElement) {
            opponentDeckElement.textContent = count.toString();
        }
    }

    // Utility methods
    getConnectionStatusText(state) {
        switch (state) {
            case 'connecting':
                return 'Connecting...';
            case 'connected':
                return 'Connected';
            case 'disconnected':
                return 'Disconnected';
            case 'error':
                return 'Connection Error';
            default:
                return 'Unknown';
        }
    }

    // Card updates
    updateCards(timestamp) {
        // Update card animations and positions
        [...this.playerHand, ...this.playArea].forEach(card => {
            if (card.animationState !== 'idle') {
                // Update card animations
                card.animationProgress += 0.016; // Assume 60 FPS
                if (card.animationProgress >= 1) {
                    card.animationState = 'idle';
                    card.animationProgress = 0;
                }
            }
        });
    }

    updateAnimations(timestamp) {
        // Update global animations
    }

    updateInput() {
        // Update input state
    }

    // Settings
    loadSettings() {
        const savedSettings = Utils.loadFromStorage('game_settings');
        if (savedSettings) {
            this.settings = { ...this.settings, ...savedSettings };
        }
    }

    saveSettings() {
        Utils.saveToStorage('game_settings', this.settings);
    }

    // Public methods for external access
    setPlayerDeck(deck) {
        this.playerDeck = deck;
        this.updateDeckCount();
    }

    getPlayerDeck() {
        return this.playerDeck;
    }

    getNetworking() {
        return this.networking;
    }

    getCurrentGameState() {
        return this.gameState;
    }

    // Cleanup
    destroy() {
        this.stopGameLoop();
        this.networking.disconnect();
        
        if (this.playerDeck) {
            this.playerDeck.destroy();
        }
        
        this.playerHand.forEach(card => card.destroy());
        this.playArea.forEach(card => card.destroy());
        
        this.playerHand = [];
        this.playArea = [];
    }
}

// Export for use in other modules
window.Game = Game;
