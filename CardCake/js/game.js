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
            initialHandSize: 5, // Reduced for testing
            maxDeckSize: 100,
            minDeckSize: 5 // Reduced for testing
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
                this.stopGameLoop();
                break;
            case 'deck-building':
                this.showDeckBuilderScreen();
                this.stopGameLoop();
                break;
            case 'playing':
                this.initializeGameBoard();
                this.startGameLoop();
                break;
            case 'paused':
                this.pauseGame();
                break;
            case 'ended':
                this.endGame();
                break;
        }
    }

    // Initialize game board for playing
    initializeGameBoard() {
        console.log('Initializing game board...');
        
        // Ensure canvas is ready
        if (!this.canvas) {
            this.canvas = document.getElementById('game-canvas');
            if (this.canvas) {
                this.ctx = this.canvas.getContext('2d');
                this.resizeCanvas();
            }
        }
        
        // Initialize player deck if not already done
        if (this.playerDeck && this.playerDeck.cards.length > 0) {
            // Shuffle the deck
            this.playerDeck.shuffle();
            
            // Draw initial hand
            this.drawInitialHand();
        }
        
        // Set up game board areas
        this.setupGameAreas();
        
        // Start rendering
        this.isGameActive = true;
    }

    // Draw initial hand
    drawInitialHand() {
        const initialHandSize = this.settings.initialHandSize;
        
        for (let i = 0; i < initialHandSize && this.playerDeck.cards.length > 0; i++) {
            const card = this.playerDeck.drawCard();
            if (card) {
                this.playerHand.push(card);
            }
        }
        
        console.log(`Drew initial hand of ${this.playerHand.length} cards`);
    }

    // Setup game areas and positions
    setupGameAreas() {
        if (!this.canvas) return;
        
        const canvasWidth = this.canvas.width;
        const canvasHeight = this.canvas.height;
        
        // Define game areas
        this.gameAreas = {
            playerHand: {
                x: 50,
                y: canvasHeight - 150,
                width: canvasWidth - 100,
                height: 100
            },
            playerDeck: {
                x: canvasWidth - 100,
                y: canvasHeight - 250,
                width: 80,
                height: 120
            },
            playArea: {
                x: 100,
                y: 200,
                width: canvasWidth - 200,
                height: 300
            },
            opponentHand: {
                x: 50,
                y: 50,
                width: canvasWidth - 100,
                height: 100
            },
            opponentDeck: {
                x: canvasWidth - 100,
                y: 50,
                width: 80,
                height: 120
            }
        };
    }

    // Start the game rendering loop
    startGameLoop() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        
        this.gameLoop();
    }

    // Main game loop
    gameLoop() {
        if (this.isGameActive) {
            this.update();
            this.render();
            this.animationId = requestAnimationFrame(() => this.gameLoop());
        }
    }

    // Update game state
    update() {
        // Update card positions, animations, etc.
        // This can be expanded for card animations and effects
    }

    // Render the game
    render() {
        if (!this.ctx || !this.canvas) return;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw game board background
        this.drawGameBoard();
        
        // Draw game areas
        this.drawGameAreas();
        
        // Draw cards
        this.drawCards();
    }

    // Draw game board background
    drawGameBoard() {
        // Draw a nice background pattern or color
        const gradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
        gradient.addColorStop(0, '#2a4d3a');
        gradient.addColorStop(0.5, '#1e3d2a');
        gradient.addColorStop(1, '#1a2f1a');
        
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw grid pattern
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;
        
        for (let x = 0; x < this.canvas.width; x += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += 50) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    // Draw game areas
    drawGameAreas() {
        if (!this.gameAreas) return;
        
        // Draw area boundaries
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        
        Object.entries(this.gameAreas).forEach(([areaName, area]) => {
            this.ctx.strokeRect(area.x, area.y, area.width, area.height);
        });
        
        this.ctx.setLineDash([]);
        
        // Draw area labels
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        
        // Player areas
        this.ctx.fillText('Your Hand', this.gameAreas.playerHand.x + this.gameAreas.playerHand.width / 2, this.gameAreas.playerHand.y - 10);
        this.ctx.fillText('Your Deck', this.gameAreas.playerDeck.x + this.gameAreas.playerDeck.width / 2, this.gameAreas.playerDeck.y - 10);
        
        // Opponent areas
        this.ctx.fillText('Opponent Hand', this.gameAreas.opponentHand.x + this.gameAreas.opponentHand.width / 2, this.gameAreas.opponentHand.y + this.gameAreas.opponentHand.height + 20);
        this.ctx.fillText('Opponent Deck', this.gameAreas.opponentDeck.x + this.gameAreas.opponentDeck.width / 2, this.gameAreas.opponentDeck.y + this.gameAreas.opponentDeck.height + 20);
        
        // Play area
        this.ctx.fillText('Play Area', this.gameAreas.playArea.x + this.gameAreas.playArea.width / 2, this.gameAreas.playArea.y + this.gameAreas.playArea.height / 2);
    }

    // Draw cards on the canvas
    drawCards() {
        // Draw player hand cards
        this.drawHandCards(this.playerHand, this.gameAreas.playerHand, false);
        
        // Draw opponent hand cards (face down)
        this.drawHandCards(this.opponentHand, this.gameAreas.opponentHand, true);
        
        // Draw play area cards
        this.drawPlayAreaCards();
        
        // Draw deck cards
        this.drawDeckCards();
    }

    // Draw hand cards
    drawHandCards(hand, area, faceDown = false) {
        if (!hand || hand.length === 0) return;
        
        const cardWidth = 60;
        const cardHeight = 80;
        const cardSpacing = Math.min(10, (area.width - cardWidth) / Math.max(1, hand.length - 1));
        
        hand.forEach((card, index) => {
            const x = area.x + index * cardSpacing;
            const y = area.y + (area.height - cardHeight) / 2;
            
            this.drawCard(card, x, y, cardWidth, cardHeight, faceDown);
        });
    }

    // Draw play area cards
    drawPlayAreaCards() {
        if (!this.playArea || this.playArea.length === 0) return;
        
        const cardWidth = 80;
        const cardHeight = 120;
        const cardsPerRow = Math.floor(this.gameAreas.playArea.width / (cardWidth + 10));
        
        this.playArea.forEach((card, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            
            const x = this.gameAreas.playArea.x + col * (cardWidth + 10);
            const y = this.gameAreas.playArea.y + row * (cardHeight + 10);
            
            this.drawCard(card, x, y, cardWidth, cardHeight, card.isFlipped);
        });
    }

    // Draw deck cards
    drawDeckCards() {
        // Draw player deck
        if (this.playerDeck && this.playerDeck.cards.length > 0) {
            const area = this.gameAreas.playerDeck;
            this.drawDeckPile(area.x, area.y, area.width, area.height, this.playerDeck.cards.length);
        }
        
        // Draw opponent deck
        if (this.opponentDeck && this.opponentDeck.cards.length > 0) {
            const area = this.gameAreas.opponentDeck;
            this.drawDeckPile(area.x, area.y, area.width, area.height, this.opponentDeck.cards.length);
        }
    }

    // Draw a single card
    drawCard(card, x, y, width, height, faceDown = false) {
        // Draw card background
        this.ctx.fillStyle = faceDown ? '#4a4a4a' : '#ffffff';
        this.ctx.fillRect(x, y, width, height);
        
        // Draw card border
        this.ctx.strokeStyle = '#000000';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(x, y, width, height);
        
        if (!faceDown && card.imageData) {
            // Draw card image
            const img = new Image();
            img.onload = () => {
                this.ctx.drawImage(img, x + 2, y + 2, width - 4, height - 20);
            };
            img.src = card.imageData;
        }
        
        // Draw card name
        if (!faceDown) {
            this.ctx.fillStyle = '#000000';
            this.ctx.font = '10px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(card.name.substring(0, 8), x + width / 2, y + height - 5);
        }
        
        // Highlight selected card
        if (this.selectedCard && this.selectedCard.id === card.id) {
            this.ctx.strokeStyle = '#ffff00';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(x - 2, y - 2, width + 4, height + 4);
        }
    }

    // Draw deck pile
    drawDeckPile(x, y, width, height, cardCount) {
        // Draw multiple card backs to show stack
        const stackOffset = Math.min(3, cardCount);
        
        for (let i = 0; i < stackOffset; i++) {
            const offsetX = x + i;
            const offsetY = y + i;
            
            // Draw card back
            this.ctx.fillStyle = '#4a4a4a';
            this.ctx.fillRect(offsetX, offsetY, width, height);
            
            this.ctx.strokeStyle = '#000000';
            this.ctx.lineWidth = 2;
            this.ctx.strokeRect(offsetX, offsetY, width, height);
        }
        
        // Draw card count
        this.ctx.fillStyle = '#ffffff';
        this.ctx.font = '16px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(cardCount.toString(), x + width / 2, y + height / 2);
    }

    // Set player deck
    setPlayerDeck(deck) {
        this.playerDeck = deck;
        console.log('Player deck set with', deck.cards.length, 'cards');
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

    pauseGame() {
        this.isGameActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        Utils.showNotification('Game paused', 'info');
    }

    endGame() {
        this.isGameActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        // Additional cleanup
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
        console.log('Game received network message:', message.type);
        
        switch (message.type) {
            case 'card-played':
                this.handleOpponentCardPlayed(message);
                break;
            case 'card-drawn':
                this.handleOpponentCardDrawn(message);
                break;
            case 'card-flipped':
                this.handleOpponentCardFlipped(message);
                break;
            case 'deck-shuffled':
                this.handleOpponentDeckShuffled(message);
                break;
            case 'play-area-cleared':
                this.handleOpponentPlayAreaCleared(message);
                break;
            default:
                console.log('Unhandled game message type:', message.type);
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
        Utils.showNotification(`${message.playerName} played ${message.cardName}`, 'info', 2000);
        this.updateOpponentHandCount(-1);
    }

    handleOpponentCardDrawn(message) {
        Utils.showNotification(`${message.playerName} drew a card`, 'info', 1500);
        this.updateOpponentHandCount(1);
    }

    handleOpponentCardFlipped(message) {
        Utils.showNotification(`${message.playerName} flipped a card`, 'info', 1500);
        // You could add visual feedback here
    }

    handleOpponentDeckShuffled(message) {
        Utils.showNotification(`${message.playerName} shuffled their deck`, 'info', 1500);
    }

    handleOpponentPlayAreaCleared(message) {
        Utils.showNotification(`${message.playerName} cleared the play area`, 'info', 1500);
    }

    // Update opponent hand count display
    updateOpponentHandCount(change) {
        // This is a simple counter since we can't see opponent's actual cards
        if (!this.opponentHandSize) this.opponentHandSize = 0;
        this.opponentHandSize = Math.max(0, this.opponentHandSize + change);
        
        const opponentHandCount = document.getElementById('opponent-hand-count');
        if (opponentHandCount) {
            opponentHandCount.textContent = `Hand: ${this.opponentHandSize}`;
        }
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

    // Canvas and rendering setup
    resizeCanvas() {
        if (!this.canvas) return;
        
        // Set canvas size to match container
        const container = this.canvas.parentElement;
        if (container) {
            this.canvas.width = container.clientWidth;
            this.canvas.height = container.clientHeight;
        }
    }

    // Stop game loop
    stopGameLoop() {
        this.isGameActive = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // Mouse event handlers
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;
        this.mouse.down = true;
        
        // Check if clicking on a card or deck
        this.checkCardClick(this.mouse.x, this.mouse.y);
    }

    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        this.mouse.x = event.clientX - rect.left;
        this.mouse.y = event.clientY - rect.top;
        
        // Handle card dragging
        if (this.mouse.down && this.draggedCard) {
            // Update dragged card position
            this.draggedCard.x = this.mouse.x - 40; // Center on cursor
            this.draggedCard.y = this.mouse.y - 60;
        }
    }

    handleMouseUp(event) {
        this.mouse.down = false;
        
        // Handle card drop
        if (this.draggedCard) {
            this.handleCardDrop(this.mouse.x, this.mouse.y);
            this.draggedCard = null;
        }
    }

    handleRightClick(event) {
        event.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Show context menu at mouse position
        this.showCanvasContextMenu(x, y);
    }

    handleKeyDown(event) {
        switch (event.key) {
            case 'Escape':
                this.selectedCard = null;
                this.draggedCard = null;
                break;
            case 'Space':
                event.preventDefault();
                if (this.selectedCard) {
                    this.selectedCard.isFlipped = !this.selectedCard.isFlipped;
                }
                break;
        }
    }

    handleKeyUp(event) {
        // Handle key releases if needed
    }

    // Card interaction methods
    checkCardClick(x, y) {
        // Check if clicking on player deck
        if (this.gameAreas && this.gameAreas.playerDeck) {
            const area = this.gameAreas.playerDeck;
            if (x >= area.x && x <= area.x + area.width && 
                y >= area.y && y <= area.y + area.height) {
                this.drawCardFromDeck();
                return;
            }
        }
        
        // Check if clicking on cards in hand
        this.checkHandCardClick(x, y);
        
        // Check if clicking on cards in play area
        this.checkPlayAreaCardClick(x, y);
    }

    checkHandCardClick(x, y) {
        if (!this.gameAreas || !this.gameAreas.playerHand) return;
        
        const area = this.gameAreas.playerHand;
        const cardWidth = 60;
        const cardHeight = 80;
        const cardSpacing = Math.min(10, (area.width - cardWidth) / Math.max(1, this.playerHand.length - 1));
        
        this.playerHand.forEach((card, index) => {
            const cardX = area.x + index * cardSpacing;
            const cardY = area.y + (area.height - cardHeight) / 2;
            
            if (x >= cardX && x <= cardX + cardWidth && 
                y >= cardY && y <= cardY + cardHeight) {
                this.selectedCard = card;
                this.draggedCard = { ...card, x: cardX, y: cardY };
            }
        });
    }

    checkPlayAreaCardClick(x, y) {
        if (!this.gameAreas || !this.gameAreas.playArea) return;
        
        const cardWidth = 80;
        const cardHeight = 120;
        const cardsPerRow = Math.floor(this.gameAreas.playArea.width / (cardWidth + 10));
        
        this.playArea.forEach((card, index) => {
            const row = Math.floor(index / cardsPerRow);
            const col = index % cardsPerRow;
            
            const cardX = this.gameAreas.playArea.x + col * (cardWidth + 10);
            const cardY = this.gameAreas.playArea.y + row * (cardHeight + 10);
            
            if (x >= cardX && x <= cardX + cardWidth && 
                y >= cardY && y <= cardY + cardHeight) {
                this.selectedCard = card;
            }
        });
    }

    handleCardDrop(x, y) {
        if (!this.draggedCard) return;
        
        // Check if dropping in play area
        if (this.gameAreas && this.gameAreas.playArea) {
            const area = this.gameAreas.playArea;
            if (x >= area.x && x <= area.x + area.width && 
                y >= area.y && y <= area.y + area.height) {
                this.moveCardToPlayArea(this.draggedCard);
                return;
            }
        }
        
        // Check if dropping back in hand
        if (this.gameAreas && this.gameAreas.playerHand) {
            const area = this.gameAreas.playerHand;
            if (x >= area.x && x <= area.x + area.width && 
                y >= area.y && y <= area.y + area.height) {
                // Card stays in hand
                return;
            }
        }
    }

    moveCardToPlayArea(card) {
        // Find card in hand and move to play area
        const cardIndex = this.playerHand.findIndex(c => c.id === card.id);
        if (cardIndex !== -1) {
            const movedCard = this.playerHand.splice(cardIndex, 1)[0];
            this.playArea.push(movedCard);
            
            // Notify opponent
            this.networking.sendMessage({
                type: 'card-played',
                cardId: movedCard.id,
                cardName: movedCard.name,
                playerName: this.networking.playerName
            });
        }
    }

    drawCardFromDeck() {
        if (this.playerDeck && this.playerDeck.cards.length > 0) {
            const card = this.playerDeck.drawCard();
            if (card) {
                this.playerHand.push(card);
                
                // Notify opponent
                this.networking.sendMessage({
                    type: 'card-drawn',
                    playerName: this.networking.playerName
                });
            }
        }
    }

    showCanvasContextMenu(x, y) {
        // Create context menu options based on what was clicked
        const menuOptions = [
            { label: 'Draw Card', action: () => this.drawCardFromDeck() },
            { label: 'Shuffle Deck', action: () => this.shufflePlayerDeck() },
            { label: 'Clear Selection', action: () => { this.selectedCard = null; } }
        ];
        
        if (this.selectedCard) {
            menuOptions.push(
                { label: 'Flip Card', action: () => this.flipSelectedCard() },
                { label: 'Return to Deck', action: () => this.returnSelectedCardToDeck() }
            );
        }
        
        // You would implement showing the context menu at x, y coordinates
        console.log('Context menu would show at', x, y, 'with options:', menuOptions);
    }

    shufflePlayerDeck() {
        if (this.playerDeck) {
            this.playerDeck.shuffle();
            
            // Notify opponent
            this.networking.sendMessage({
                type: 'deck-shuffled',
                playerName: this.networking.playerName
            });
        }
    }

    flipSelectedCard() {
        if (this.selectedCard) {
            this.selectedCard.isFlipped = !this.selectedCard.isFlipped;
            
            // Notify opponent
            this.networking.sendMessage({
                type: 'card-flipped',
                cardId: this.selectedCard.id,
                isFlipped: this.selectedCard.isFlipped,
                playerName: this.networking.playerName
            });
        }
    }

    returnSelectedCardToDeck() {
        if (!this.selectedCard) return;
        
        // Remove from current location
        let cardIndex = this.playerHand.findIndex(c => c.id === this.selectedCard.id);
        if (cardIndex !== -1) {
            this.playerHand.splice(cardIndex, 1);
        } else {
            cardIndex = this.playArea.findIndex(c => c.id === this.selectedCard.id);
            if (cardIndex !== -1) {
                this.playArea.splice(cardIndex, 1);
            }
        }
        
        // Add to deck
        if (this.playerDeck) {
            this.playerDeck.addCard(this.selectedCard);
        }
        
        this.selectedCard = null;
    }

    // Connection state change handler
    handleConnectionStateChange(state) {
        console.log('Game: Connection state changed to', state);
        
        switch (state) {
            case 'connected':
                // Both players are connected and ready
                break;
            case 'disconnected':
                // Handle disconnection
                this.pauseGame();
                break;
        }
    }

    // Cleanup
    destroy() {
        this.stopGameLoop();
        this.networking.disconnect();
    }
}

// Export for use in other modules
window.Game = Game;
