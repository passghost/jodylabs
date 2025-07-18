// Simplified App - Core Functionality Only

class SimpleApp {
    constructor() {
        this.game = new Game();
        this.deckCards = [];
        this.currentCardPreview = null;
        
        // Game state - Card game zones
        this.playerHand = [];
        this.playerLibrary = []; // Main deck
        this.playerGraveyard = []; // Discard pile
        this.opponentHand = [];
        this.opponentLibrary = [];
        this.opponentGraveyard = [];
        this.battlefield = []; // Active play area
        
        // Card states
        this.cardStates = new Map(); // Track tapped/untapped, flipped states
        
        // Game stats
        this.playerLife = 20;
        this.opponentLife = 20;
        this.playerCounters = { poison: 0, energy: 0, experience: 0 };
        this.opponentCounters = { poison: 0, energy: 0, experience: 0 };
        
        // Profile pictures and hand tracking
        this.playerPfp = null;
        this.opponentPfp = null;
        this.opponentHandCount = 0;
        
        // UI Elements
        this.elements = {
            // Lobby
            playerNameInput: document.getElementById('player-name'),
            pfpUpload: document.getElementById('pfp-upload'),
            pfpPreview: document.getElementById('pfp-preview'),
            createRoomBtn: document.getElementById('create-room-btn'),
            joinRoomBtn: document.getElementById('join-room-btn'),
            joinRoomForm: document.getElementById('join-room-form'),
            roomCodeInput: document.getElementById('room-code'),
            joinBtn: document.getElementById('join-btn'),
            roomInfo: document.getElementById('room-info'),
            currentRoomCode: document.getElementById('current-room-code'),
            connectionStatus: document.getElementById('connection-status'),
            
            // Card creator
            imageUpload: document.getElementById('image-upload'),
            uploadBtn: document.getElementById('upload-btn'),
            previewImage: document.getElementById('preview-image'),
            addToDeckBtn: document.getElementById('add-to-deck-btn'),
            deckGrid: document.getElementById('deck-grid'),
            deckCount: document.getElementById('deck-count'),
            clearDeckBtn: document.getElementById('clear-deck-btn'),
            saveDeckBtn: document.getElementById('save-deck-btn'),
            loadDeckBtn: document.getElementById('load-deck-btn'),
            startGameBtn: document.getElementById('start-game-btn'),
            
            // Game zones
            playerHand: document.getElementById('player-hand'),
            playerDeck: document.getElementById('player-deck'),
            playerGraveyard: document.getElementById('player-graveyard'),
            opponentHand: document.getElementById('opponent-hand'),
            opponentDeck: document.getElementById('opponent-deck'),
            opponentGraveyard: document.getElementById('opponent-graveyard'),
            battlefield: document.getElementById('battlefield'),
            contextMenu: document.getElementById('context-menu'),
            leaveGameBtn: document.getElementById('leave-game-btn'),
            
            // Life and counters
            playerLife: document.getElementById('player-life'),
            opponentLife: document.getElementById('opponent-life'),
            playerLifeMinus: document.getElementById('player-life-minus'),
            playerLifePlus: document.getElementById('player-life-plus'),
            draw1Btn: document.getElementById('draw-1-btn'),
            draw7Btn: document.getElementById('draw-7-btn'),
            playerAvatar: document.getElementById('player-avatar'),
            opponentAvatar: document.getElementById('opponent-avatar'),
            playerNameDisplay: document.getElementById('player-name-display'),
            opponentNameDisplay: document.getElementById('opponent-name-display')
        };
        
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadSavedDeck();
        this.showLobbyScreen();
        this.setupGameCallbacks();
        this.loadSavedPfp();
    }

    setupEventListeners() {
        // Lobby events
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
        
        // Card creator events
        this.elements.uploadBtn?.addEventListener('click', () => this.elements.imageUpload?.click());
        this.elements.imageUpload?.addEventListener('change', (e) => this.handleImageUpload(e));
        this.elements.addToDeckBtn?.addEventListener('click', () => this.addCardToDeck());
        this.elements.clearDeckBtn?.addEventListener('click', () => this.clearDeck());
        this.elements.saveDeckBtn?.addEventListener('click', () => this.saveDeckAs());
        this.elements.loadDeckBtn?.addEventListener('click', () => this.loadDeckFrom());
        this.elements.startGameBtn?.addEventListener('click', () => this.startGame());
        
        // Profile picture upload
        this.elements.pfpUpload?.addEventListener('change', (e) => this.handlePfpUpload(e));
        
        // Game events
        this.elements.leaveGameBtn?.addEventListener('click', () => this.leaveGame());
        this.elements.draw1Btn?.addEventListener('click', () => this.drawCard(1));
        this.elements.draw7Btn?.addEventListener('click', () => this.drawCard(7));
        this.elements.playerLifeMinus?.addEventListener('click', () => this.adjustLife(-1));
        this.elements.playerLifePlus?.addEventListener('click', () => this.adjustLife(1));
        
        // Debug buttons
        document.getElementById('show-stats-btn')?.addEventListener('click', () => this.showConnectionStats());
        document.getElementById('clear-debug-btn')?.addEventListener('click', () => this.clearDebugInfo());
        
        // Global events
        document.addEventListener('click', (e) => this.hideContextMenu());
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
        
        // Setup drag and drop for all zones
        this.setupDragAndDrop();
    }

    setupDragAndDrop() {
        const zones = [
            'player-hand', 'player-deck', 'player-graveyard',
            'opponent-hand', 'opponent-deck', 'opponent-graveyard',
            'battlefield'
        ];
        
        zones.forEach(zoneId => {
            const zone = document.getElementById(zoneId);
            if (zone) {
                zone.addEventListener('dragover', (e) => this.handleDragOver(e));
                zone.addEventListener('drop', (e) => this.handleDrop(e, zoneId));
                zone.addEventListener('dragenter', (e) => this.handleDragEnter(e));
                zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
                zone.addEventListener('click', (e) => this.handleZoneClick(e, zoneId));
                zone.addEventListener('contextmenu', (e) => this.handleZoneRightClick(e, zoneId));
            }
        });
    }

    // Lobby functionality
    async createRoom() {
        const playerName = this.elements.playerNameInput?.value.trim();
        if (playerName) {
            console.log('Creating room with player name:', playerName);
            try {
                const roomCode = await this.game.networking.createRoom(playerName);
                console.log('Room created successfully:', roomCode);
                this.showRoomInfo();
            } catch (error) {
                console.error('Failed to create room:', error);
                alert('Failed to create room: ' + error.message);
            }
        } else {
            alert('Please enter your name first!');
        }
    }

    showJoinRoomForm() {
        this.elements.joinRoomForm?.classList.remove('hidden');
    }

    async joinRoom() {
        const playerName = this.elements.playerNameInput?.value.trim();
        const roomCode = this.elements.roomCodeInput?.value.trim();
        if (playerName && roomCode) {
            console.log('Joining room:', roomCode, 'with player name:', playerName);
            try {
                await this.game.networking.joinRoom(roomCode, playerName);
                console.log('Joined room successfully');
                this.showRoomInfo();
            } catch (error) {
                console.error('Failed to join room:', error);
                alert('Failed to join room: ' + error.message);
            }
        } else {
            alert('Please enter both your name and room code!');
        }
    }

    showRoomInfo() {
        this.elements.roomInfo?.classList.remove('hidden');
        if (this.elements.currentRoomCode) {
            this.elements.currentRoomCode.textContent = this.game.networking.roomCode || 'Unknown';
        }
    }

    showLobbyScreen() {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.getElementById('lobby-screen')?.classList.add('active');
    }

    showCardCreatorScreen() {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.getElementById('card-creator-screen')?.classList.add('active');
    }

    showGameScreen() {
        document.querySelectorAll('.screen').forEach(screen => screen.classList.remove('active'));
        document.getElementById('game-screen')?.classList.add('active');
        this.initializeGame();
        this.updateGameHeader();
    }

    // Card creation functionality
    handleImageUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                if (this.elements.previewImage) {
                    this.elements.previewImage.src = e.target.result;
                    this.elements.previewImage.style.display = 'block';
                    this.currentCardPreview = e.target.result;
                }
            };
            reader.readAsDataURL(file);
        }
    }

    addCardToDeck() {
        if (this.currentCardPreview) {
            const card = {
                id: Date.now() + Math.random(),
                imageUrl: this.currentCardPreview,
                name: `Card ${this.deckCards.length + 1}`
            };
            
            this.deckCards.push(card);
            this.updateDeckDisplay();
            this.saveDeck();
        }
    }

    updateDeckDisplay() {
        if (this.elements.deckGrid) {
            this.elements.deckGrid.innerHTML = '';
            this.deckCards.forEach(card => {
                const cardElement = this.createDeckCardElement(card);
                this.elements.deckGrid.appendChild(cardElement);
            });
        }
        
        if (this.elements.deckCount) {
            this.elements.deckCount.textContent = this.deckCards.length;
        }
    }

    createDeckCardElement(card) {
        const cardElement = document.createElement('div');
        cardElement.className = 'deck-card';
        cardElement.innerHTML = `<img src="${card.imageUrl}" alt="${card.name}">`;
        cardElement.addEventListener('click', () => this.removeDeckCard(card.id));
        return cardElement;
    }

    removeDeckCard(cardId) {
        this.deckCards = this.deckCards.filter(card => card.id !== cardId);
        this.updateDeckDisplay();
        this.saveDeck();
    }

    clearDeck() {
        if (confirm('Clear all cards from deck?')) {
            this.deckCards = [];
            this.updateDeckDisplay();
            this.saveDeck();
        }
    }

    startGame() {
        if (this.deckCards.length > 0) {
            this.initializeGame();
            this.showGameScreen();
        } else {
            alert('Please add some cards to your deck first!');
        }
    }

    // Game functionality
    initializeGame() {
        // Initialize all zones
        this.playerHand = [];
        this.playerLibrary = [];
        this.playerGraveyard = [];
        this.battlefield = [];
        this.cardStates = new Map();
        
        // Reset life and counters
        this.playerLife = 20;
        this.playerCounters = { poison: 0, energy: 0, experience: 0 };
        
        // Create deck from card templates (exact copies, no multiplies)
        this.deckCards.forEach(templateCard => {
            this.playerLibrary.push({
                ...templateCard,
                id: `${templateCard.id}_game_copy`,
                owner: this.game.networking.playerName
            });
        });
        
        // Shuffle deck
        this.shufflePlayerDeck();
        
        // Don't draw starting hand automatically - let players choose when to draw
        console.log(`Game initialized: Deck has ${this.playerLibrary.length} cards`);
        console.log('Click "Draw 7" to draw your opening hand, or "Draw 1" to draw individual cards');
        
        this.updateAllDisplays();
        this.updateLifeDisplay();
        this.updateCounterDisplay();
    }

    shufflePlayerDeck() {
        this.shuffleArray(this.playerLibrary);
        this.game.networking.sendMessage({
            type: 'deck-shuffled',
            playerName: this.game.networking.playerName
        });
    }

    drawCard(count = 1) {
        for (let i = 0; i < count; i++) {
            if (this.playerLibrary.length > 0) {
                const card = this.playerLibrary.pop(); // Draw from top of deck
                this.playerHand.push(card);
                console.log(`Drew card: ${card.name}, Deck: ${this.playerLibrary.length}, Hand: ${this.playerHand.length}`);
            } else {
                console.log('Cannot draw - deck is empty!');
                break;
            }
        }
        
        this.updateAllDisplays();
        
        // Network sync
        this.game.networking.sendMessage({
            type: 'draw-card',
            count: count,
            playerName: this.game.networking.playerName
        });
    }

    shuffleArray(deck) {
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }

    // Card creation and interaction
    createCardElement(card, zoneType) {
        const cardElement = document.createElement('div');
        cardElement.className = 'card';
        cardElement.setAttribute('data-card-id', card.id);
        cardElement.setAttribute('draggable', 'true');
        
        // Determine if this card should show its back
        const shouldShowBack = this.shouldShowCardBack(card, zoneType);
        
        if (shouldShowBack) {
            // Show card back using owner's profile picture
            const backImage = this.getCardBackImage(card.owner);
            if (backImage) {
                cardElement.style.backgroundImage = `url(${backImage})`;
                cardElement.style.backgroundSize = 'cover';
                cardElement.style.backgroundPosition = 'center';
                cardElement.classList.add('card-back');
            } else {
                // Default card back pattern
                cardElement.classList.add('card-back', 'default-back');
            }
        } else {
            // Show card front
            const img = document.createElement('img');
            img.src = card.imageUrl;
            img.alt = card.name;
            img.className = 'card-image';
            cardElement.appendChild(img);
        }
        
        // Add event listeners (skip drag handlers for table cards - they're handled in updateTableDisplay)
        if (zoneType !== 'sandbox-table') {
            cardElement.addEventListener('dragstart', (e) => this.handleCardDragStart(e, card, zoneType));
            cardElement.addEventListener('dragend', (e) => this.handleCardDragEnd(e));
        }
        
        cardElement.addEventListener('click', (e) => {
            e.stopPropagation();
            this.selectCard(cardElement);
        });
        cardElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showCardContextMenu(e, card, zoneType);
        });
        
        return cardElement;
    }

    shouldShowCardBack(card, zoneType) {
        // Show card backs for:
        // 1. All deck cards (both player and opponent - decks should always be face down)
        // 2. Opponent's hand cards
        // 3. Any cards that are face-down (flipped)
        
        if (zoneType === 'opponent-hand' || zoneType === 'opponent-deck' || zoneType === 'player-deck') {
            return true;
        }
        
        // Check if card is flipped to show back
        const cardState = this.cardStates.get(card.id);
        if (cardState && cardState.flipped) {
            return true;
        }
        
        return false;
    }

    getCardBackImage(owner) {
        if (owner === this.game.networking.playerName) {
            return this.playerPfp;
        } else {
            return this.opponentPfp;
        }
    }

    // Drag and drop handlers
    handleCardDragStart(event, card, sourceZone) {
        event.dataTransfer.setData('text/plain', card.id);
        event.dataTransfer.setData('application/source-zone', sourceZone);
        event.target.classList.add('dragging');
    }

    handleCardDragEnd(event) {
        event.target.classList.remove('dragging');
    }

    handleDragOver(event) {
        event.preventDefault();
        event.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(event) {
        event.preventDefault();
        event.currentTarget.classList.add('drop-zone-active');
    }

    handleDragLeave(event) {
        event.currentTarget.classList.remove('drop-zone-active');
    }

    handleDrop(event, targetZone) {
        event.preventDefault();
        event.currentTarget.classList.remove('drop-zone-active');
        
        const cardId = event.dataTransfer.getData('text/plain');
        const sourceZone = event.dataTransfer.getData('application/source-zone');
        const isReposition = event.dataTransfer.getData('application/reposition') === 'true';
        
        if (cardId) {
            // Prevent manipulation of opponent's private zones (hand and deck)
            if (this.isOpponentPrivateZone(targetZone)) {
                console.warn('Cannot move cards to opponent\'s private zones');
                return;
            }
            
            // Only allow moving from your own private zones
            if (this.isOpponentPrivateZone(sourceZone)) {
                console.warn('Cannot move cards from opponent\'s private zones');
                return;
            }
            
            if (isReposition && sourceZone === 'battlefield' && targetZone === 'battlefield') {
                // Handle repositioning within the battlefield
                this.handleBattlefieldCardReposition(cardId, event);
            } else if (sourceZone !== targetZone) {
                // Handle normal card movement between zones
                this.moveCard(cardId, sourceZone, targetZone, event);
            }
        }
    }

    isOpponentPrivateZone(zone) {
        return zone === 'opponent-hand' || zone === 'opponent-deck';
    }

    moveCard(cardId, sourceZone, targetZone, event) {
        try {
            const card = this.findAndRemoveCard(cardId, sourceZone);
            if (card) {
                this.addCardToZone(card, targetZone, event);
                this.updateAllDisplays();
                
                // Enhanced network sync with full card data
                const syncMessage = {
                    type: 'move-card',
                    cardId: cardId,
                    from: sourceZone,
                    to: targetZone,
                    playerName: this.game.networking.playerName,
                    cardData: {
                        id: card.id,
                        imageUrl: card.imageUrl,
                        name: card.name
                    }
                };
                
                // Add position data for battlefield drops
                if (targetZone === 'battlefield' && event) {
                    const rect = event.currentTarget.getBoundingClientRect();
                    const dropX = Math.max(0, Math.min(event.clientX - rect.left, rect.width - 80));
                    const dropY = Math.max(0, Math.min(event.clientY - rect.top, rect.height - 120));
                    syncMessage.position = { x: dropX, y: dropY };
                    if (card.stackedOn) {
                        syncMessage.stackedOn = card.stackedOn;
                    }
                    console.log(`Dropping card at battlefield position: (${dropX}, ${dropY})`);
                }
                
                this.game.networking.sendMessage(syncMessage);
                console.log('Sent network message:', syncMessage);
            } else {
                console.warn(`Card ${cardId} not found in zone ${sourceZone}`);
            }
        } catch (error) {
            console.error('Error moving card:', error);
        }
    }

    findAndRemoveCard(cardId, zoneType) {
        const zone = this.getZoneArray(zoneType);
        if (zone) {
            const index = zone.findIndex(card => card.id == cardId);
            if (index !== -1) {
                return zone.splice(index, 1)[0];
            }
        }
        return null;
    }

    addCardToZone(card, zoneType, event) {
        const zone = this.getZoneArray(zoneType);
        if (zone) {
            if (zoneType === 'battlefield' && event) {
                // Get drop coordinates relative to the battlefield
                const rect = event.currentTarget.getBoundingClientRect();
                const dropX = Math.max(10, Math.min(event.clientX - rect.left - 40, rect.width - 90)); // Center the card on cursor
                const dropY = Math.max(40, Math.min(event.clientY - rect.top - 60, rect.height - 130)); // Account for label and center
                
                // Check for stacking - only if dropped very close to another card
                const stackThreshold = 25; // Reduced threshold for more precise stacking
                
                let stackedOn = null;
                for (let existingCard of this.battlefield) {
                    if (existingCard.position) {
                        // Check distance from center to center of cards
                        const cardCenterX = existingCard.position.x + 40; // Half card width
                        const cardCenterY = existingCard.position.y + 60; // Half card height
                        const dropCenterX = dropX + 40;
                        const dropCenterY = dropY + 60;
                        
                        const distance = Math.sqrt(
                            Math.pow(dropCenterX - cardCenterX, 2) + 
                            Math.pow(dropCenterY - cardCenterY, 2)
                        );
                        
                        if (distance < stackThreshold) {
                            stackedOn = existingCard;
                            break;
                        }
                    }
                }
                
                if (stackedOn) {
                    // Stack on existing card with minimal offset
                    card.position = { 
                        x: stackedOn.position.x + 3, 
                        y: stackedOn.position.y + 3 
                    };
                    card.stackedOn = stackedOn.id;
                    console.log(`Stacking card on ${stackedOn.name || stackedOn.id}`);
                } else {
                    // Place freely at drop position
                    card.position = { x: dropX, y: dropY };
                    card.stackedOn = null; // Clear any previous stacking
                    console.log(`Placing card at (${dropX}, ${dropY})`);
                }
                
                // Mark card owner (preserve original owner if it exists)
                if (!card.owner) {
                    card.owner = this.game.networking.playerName;
                }
                
                // Initialize card state if not already set
                if (!this.cardStates.has(card.id)) {
                    this.cardStates.set(card.id, { tapped: false, flipped: false });
                }
            }
            zone.push(card);
        }
    }

    getZoneArray(zoneType) {
        switch (zoneType) {
            case 'player-hand': return this.playerHand;
            case 'player-deck': return this.playerLibrary;
            case 'player-graveyard': return this.playerGraveyard;
            case 'opponent-hand': return this.opponentHand;
            case 'opponent-deck': return this.opponentLibrary;
            case 'opponent-graveyard': return this.opponentGraveyard;
            case 'battlefield': return this.battlefield;
            default: return null;
        }
    }

    // Display updates
    updateAllDisplays() {
        this.updateZoneDisplay('player-hand', this.playerHand);
        this.updateZoneDisplay('opponent-hand', this.opponentHand);
        this.updatePileDisplay('player-deck', this.playerLibrary);
        this.updatePileDisplay('player-graveyard', this.playerGraveyard);
        this.updatePileDisplay('opponent-deck', this.opponentLibrary);
        this.updatePileDisplay('opponent-graveyard', this.opponentGraveyard);
        this.updateBattlefieldDisplay();
    }

    updateZoneDisplay(zoneId, cards) {
        const element = document.getElementById(zoneId);
        if (element) {
            element.innerHTML = '';
            
            // Add area label back
            const label = document.createElement('div');
            label.className = 'area-label';
            if (zoneId === 'player-hand') {
                label.textContent = 'Your Hand (Hidden from Opponent)';
                element.appendChild(label);
            } else if (zoneId === 'opponent-hand') {
                label.textContent = `Opponent Hand`;
                element.appendChild(label);
                // Add hand count for opponent
                const handCount = document.createElement('div');
                handCount.className = 'hand-count';
                handCount.textContent = `Cards: ${cards.length}`;
                element.appendChild(handCount);
            } else {
                label.textContent = zoneId.includes('player') ? 'Your Hand' : 'Opponent Hand';
                element.appendChild(label);
            }
            
            // For opponent hand, create placeholder card backs
            if (zoneId === 'opponent-hand') {
                cards.forEach((card, index) => {
                    // Create a placeholder card back
                    const cardBack = {
                        id: `opponent_hand_${index}`,
                        owner: this.game.networking.opponentName,
                        imageUrl: null // Will be handled by shouldShowCardBack
                    };
                    const cardElement = this.createCardElement(cardBack, zoneId);
                    element.appendChild(cardElement);
                });
            } else {
                // Normal card display for player hand and other zones
                cards.forEach(card => {
                    const cardElement = this.createCardElement(card, zoneId);
                    element.appendChild(cardElement);
                });
            }
        }
    }

    updatePileDisplay(pileId, cards) {
        const element = document.getElementById(pileId);
        const countElement = document.getElementById(pileId + '-count');
        
        if (countElement) {
            countElement.textContent = cards.length;
        }
        
        if (element) {
            element.innerHTML = '';
            
            if (cards.length > 0) {
                // For deck piles, always show card back (face down)
                if (pileId.includes('deck')) {
                    const cardBack = document.createElement('div');
                    cardBack.className = 'card card-back';
                    
                    // Use owner's profile picture for card back
                    const owner = pileId.includes('player') ? this.game.networking.playerName : this.game.networking.opponentName;
                    const backImage = this.getCardBackImage(owner);
                    
                    if (backImage) {
                        cardBack.style.backgroundImage = `url(${backImage})`;
                        cardBack.style.backgroundSize = 'cover';
                        cardBack.style.backgroundPosition = 'center';
                    } else {
                        cardBack.classList.add('default-back');
                    }
                    
                    element.appendChild(cardBack);
                } else {
                    // For graveyard, show top card face up
                    const topCard = cards[cards.length - 1];
                    const cardElement = this.createCardElement(topCard, pileId);
                    element.appendChild(cardElement);
                }
            }
            
            // Add labels back
            const label = document.createElement('div');
            label.className = 'pile-label';
            label.textContent = pileId.includes('deck') ? 
                (pileId.includes('player') ? 'Your Deck' : 'Opponent Deck') :
                (pileId.includes('player') ? 'Your Discard' : 'Opponent Discard');
            element.appendChild(label);
            
            // Add pile count
            const count = document.createElement('div');
            count.className = 'pile-count';
            count.textContent = cards.length;
            element.appendChild(count);
        }
    }

    updateTableDisplay() {
        const element = this.elements.sandboxTable;
        if (element) {
            // Clear existing cards (but keep label)
            const existingCards = element.querySelectorAll('.table-card');
            existingCards.forEach(card => card.remove());
            
            this.tableCards.forEach((card, index) => {
                const cardElement = this.createCardElement(card, 'sandbox-table');
                cardElement.classList.add('table-card');
                
                // Add owner indicator
                if (card.owner && card.owner !== this.game.networking.playerName) {
                    cardElement.classList.add('opponent-card');
                    cardElement.title = `${card.owner}'s card`;
                } else if (card.owner === this.game.networking.playerName) {
                    cardElement.classList.add('own-card');
                    cardElement.title = 'Your card - Double-click to bring to front';
                    
                    // Add double-click handler for own cards
                    cardElement.addEventListener('dblclick', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        this.handleTableCardDoubleClick(card);
                    });
                    
                    // Enable repositioning within table using drag and drop
                    cardElement.addEventListener('dragstart', (e) => {
                        e.dataTransfer.setData('text/plain', card.id);
                        e.dataTransfer.setData('application/source-zone', 'sandbox-table');
                        e.dataTransfer.setData('application/reposition', 'true');
                        cardElement.classList.add('dragging');
                    });
                    
                    cardElement.addEventListener('dragend', (e) => {
                        cardElement.classList.remove('dragging');
                    });
                }
                
                if (card.position) {
                    cardElement.style.left = card.position.x + 'px';
                    cardElement.style.top = card.position.y + 'px';
                }
                
                // Add stacking visual effect
                if (card.stackedOn) {
                    cardElement.classList.add('stacked');
                    cardElement.style.zIndex = index + 100; // Higher z-index for stacked cards
                } else {
                    cardElement.style.zIndex = index + 10;
                }
                
                element.appendChild(cardElement);
            });
        }
    }

    updateBattlefieldDisplay() {
        const element = this.elements.battlefield;
        if (element) {
            // Clear existing cards (but keep label)
            const existingCards = element.querySelectorAll('.battlefield-card');
            existingCards.forEach(card => card.remove());
            
            this.battlefield.forEach((card, index) => {
                const cardElement = this.createCardElement(card, 'battlefield');
                cardElement.classList.add('battlefield-card');
                
                // Add owner indicator but allow manipulation by any player
                if (card.owner && card.owner !== this.game.networking.playerName) {
                    cardElement.classList.add('opponent-card');
                    cardElement.title = `${card.owner}'s card - Right-click for options`;
                } else if (card.owner === this.game.networking.playerName) {
                    cardElement.classList.add('own-card');
                    cardElement.title = 'Your card - Right-click for options';
                }
                
                // Allow all players to interact with battlefield cards
                cardElement.addEventListener('dblclick', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    this.tapUntapCard(card);
                });
                
                // Enable repositioning for all cards
                cardElement.addEventListener('dragstart', (e) => {
                    e.dataTransfer.setData('text/plain', card.id);
                    e.dataTransfer.setData('application/source-zone', 'battlefield');
                    e.dataTransfer.setData('application/reposition', 'true');
                    cardElement.classList.add('dragging');
                });
                
                cardElement.addEventListener('dragend', (e) => {
                    cardElement.classList.remove('dragging');
                });
                
                // Position card
                if (card.position) {
                    cardElement.style.position = 'absolute';
                    cardElement.style.left = card.position.x + 'px';
                    cardElement.style.top = card.position.y + 'px';
                } else {
                    // Auto-arrange cards in a grid if no position is set
                    const cardsPerRow = 8;
                    const cardWidth = 70;
                    const cardHeight = 100;
                    const margin = 10;
                    
                    const row = Math.floor(index / cardsPerRow);
                    const col = index % cardsPerRow;
                    
                    card.position = {
                        x: col * (cardWidth + margin) + margin,
                        y: row * (cardHeight + margin) + margin + 30 // Account for label
                    };
                    
                    cardElement.style.position = 'absolute';
                    cardElement.style.left = card.position.x + 'px';
                    cardElement.style.top = card.position.y + 'px';
                }
                
                // Apply card states
                const cardState = this.cardStates.get(card.id);
                if (cardState) {
                    if (cardState.tapped) {
                        cardElement.classList.add('tapped');
                    }
                    if (cardState.flipped) {
                        cardElement.classList.add('flipped');
                    }
                }
                
                // Set z-index for layering
                cardElement.style.zIndex = index + 10;
                
                element.appendChild(cardElement);
            });
        }
    }

    // Zone interactions
    handleZoneClick(event, zoneType) {
        if (zoneType === 'player-deck') {
            this.drawCard();
        }
    }

    handleZoneRightClick(event, zoneType) {
        event.preventDefault();
        this.showZoneContextMenu(event, zoneType);
    }

    // Context menu
    showCardContextMenu(event, card, zoneType) {
        const options = [];
        
        if (zoneType === 'battlefield') {
            // Battlefield cards can be manipulated by any player
            options.push({ label: 'Tap/Untap', action: () => this.tapUntapCard(card) });
            options.push({ label: 'Flip Card', action: () => this.flipCard(card) });
            options.push({ separator: true });
            options.push({ label: 'To Hand', action: () => this.moveCard(card.id, zoneType, 'player-hand') });
            options.push({ label: 'To Discard', action: () => this.moveCard(card.id, zoneType, 'player-graveyard') });
            options.push({ label: 'To Deck (Bottom)', action: () => this.moveCard(card.id, zoneType, 'player-deck') });
        } else if (zoneType === 'player-hand' || zoneType === 'player-graveyard') {
            // Only owner can move cards from their private zones
            options.push({ label: 'To Play Area', action: () => this.moveCard(card.id, zoneType, 'battlefield') });
            options.push({ label: 'To Discard', action: () => this.moveCard(card.id, zoneType, 'player-graveyard') });
            options.push({ label: 'To Deck (Bottom)', action: () => this.moveCard(card.id, zoneType, 'player-deck') });
        } else {
            // Default options for other zones
            options.push({ label: 'To Hand', action: () => this.moveCard(card.id, zoneType, 'player-hand') });
            options.push({ label: 'To Play Area', action: () => this.moveCard(card.id, zoneType, 'battlefield') });
            options.push({ label: 'To Discard', action: () => this.moveCard(card.id, zoneType, 'player-graveyard') });
            options.push({ label: 'To Deck (Bottom)', action: () => this.moveCard(card.id, zoneType, 'player-deck') });
        }
        
        this.showContextMenu(event, options);
    }

    showZoneContextMenu(event, zoneType) {
        const options = [];
        
        if (zoneType.includes('deck')) {
            options.push({ label: 'Draw Card', action: () => this.drawCard() });
            options.push({ label: 'Shuffle', action: () => this.shuffleArray(this.getZoneArray(zoneType)) });
        }
        
        if (options.length > 0) {
            this.showContextMenu(event, options);
        }
    }

    showContextMenu(event, options) {
        const menu = this.elements.contextMenu;
        if (menu) {
            menu.innerHTML = '';
            
            options.forEach(option => {
                if (option.separator) {
                    const separator = document.createElement('div');
                    separator.className = 'context-separator';
                    menu.appendChild(separator);
                } else {
                    const item = document.createElement('div');
                    item.className = 'context-item';
                    item.textContent = option.label;
                    item.addEventListener('click', () => {
                        option.action();
                        this.hideContextMenu();
                    });
                    menu.appendChild(item);
                }
            });
            
            menu.style.left = event.pageX + 'px';
            menu.style.top = event.pageY + 'px';
            menu.classList.remove('hidden');
        }
    }

    hideContextMenu() {
        this.elements.contextMenu?.classList.add('hidden');
    }

    selectCard(cardElement) {
        document.querySelectorAll('.card.selected').forEach(el => el.classList.remove('selected'));
        cardElement.classList.add('selected');
    }

    // Save/Load functionality
    saveDeck() {
        localStorage.setItem('fiteme_deck', JSON.stringify(this.deckCards));
    }

    loadSavedDeck() {
        const saved = localStorage.getItem('fiteme_deck');
        if (saved) {
            this.deckCards = JSON.parse(saved);
            this.updateDeckDisplay();
        }
    }

    // Enhanced Save/Load functionality
    saveDeckAs() {
        const deckName = prompt('Enter deck name:', `Deck_${Date.now()}`);
        if (deckName && this.deckCards.length > 0) {
            const decks = this.getSavedDecks();
            decks[deckName] = [...this.deckCards];
            localStorage.setItem('fiteme_saved_decks', JSON.stringify(decks));
            alert(`Deck "${deckName}" saved!`);
        }
    }

    loadDeckFrom() {
        const decks = this.getSavedDecks();
        const deckNames = Object.keys(decks);
        
        if (deckNames.length === 0) {
            alert('No saved decks found!');
            return;
        }
        
        const deckList = deckNames.map((name, index) => `${index + 1}. ${name}`).join('\n');
        const selection = prompt(`Select deck to load:\n${deckList}\n\nEnter deck number:`);
        
        if (selection) {
            const deckIndex = parseInt(selection) - 1;
            if (deckIndex >= 0 && deckIndex < deckNames.length) {
                const deckName = deckNames[deckIndex];
                this.deckCards = [...decks[deckName]];
                this.updateDeckDisplay();
                this.saveDeck(); // Save as current deck
                alert(`Deck "${deckName}" loaded!`);
            }
        }
    }

    getSavedDecks() {
        const saved = localStorage.getItem('fiteme_saved_decks');
        return saved ? JSON.parse(saved) : {};
    }

    // Profile picture handling
    handlePfpUpload(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageUrl = e.target.result;
                this.playerPfp = imageUrl;
                
                // Update preview
                if (this.elements.pfpPreview) {
                    this.elements.pfpPreview.style.backgroundImage = `url(${imageUrl})`;
                }
                
                // Save to localStorage
                localStorage.setItem('playerPfp', imageUrl);
                
                // Sync profile picture with opponent
                if (this.game.networking.isConnected) {
                    this.game.networking.sendMessage({
                        type: 'profile-picture-update',
                        profilePicture: imageUrl,
                        playerName: this.game.networking.playerName
                    });
                }
                
                console.log('Profile picture uploaded and saved');
            };
            reader.readAsDataURL(file);
        }
    }

    // Load saved profile picture
    loadSavedPfp() {
        const savedPfp = localStorage.getItem('playerPfp');
        if (savedPfp && this.elements.pfpPreview) {
            this.playerPfp = savedPfp;
            this.elements.pfpPreview.style.backgroundImage = `url(${savedPfp})`;
        }
    }

    // Game callbacks
    setupGameCallbacks() {
        this.game.networking.onOpponentJoined = (opponentName) => {
            console.log('Opponent joined:', opponentName);
            this.showCardCreatorScreen();
            // Update game header if we're in game screen
            if (document.getElementById('game-screen')?.classList.contains('active')) {
                this.updateGameHeader();
            }
            // Sync profile picture and current game state when opponent joins
            setTimeout(() => {
                this.syncGameState();
                if (this.playerPfp) {
                    this.game.networking.sendMessage({
                        type: 'profile-picture-update',
                        profilePicture: this.playerPfp,
                        playerName: this.game.networking.playerName
                    });
                }
            }, 1000);
        };
        
        this.game.networking.onOpponentLeft = (opponentName) => {
            console.log('Opponent left:', opponentName);
            this.showLobbyScreen();
        };
        
        this.game.networking.onMessageReceived = (message) => {
            this.handleNetworkMessage(message);
        };
        
        this.game.networking.onConnectionStateChange = (state) => {
            if (this.elements.connectionStatus) {
                this.elements.connectionStatus.textContent = state;
            }
            
            // Request sync when connection is established
            if (state === 'connected') {
                setTimeout(() => this.requestGameStateSync(), 500);
            }
        };
    }

    handleNetworkMessage(message) {
        try {
            console.log('Received network message:', message);
            
            switch (message.type) {
                case 'move-card':
                    this.handleOpponentCardMove(message);
                    break;
                case 'draw-card':
                    this.handleOpponentDrawCard(message);
                    break;
                case 'deck-shuffled':
                    console.log(`${message.playerName} shuffled their deck`);
                    break;
                case 'card-tap-untap':
                    this.handleOpponentCardTapUntap(message);
                    break;
                case 'card-flip':
                    this.handleOpponentCardFlip(message);
                    break;
                case 'card-added-to-table':
                    this.handleOpponentCardToTable(message);
                    break;
                case 'sync-game-state':
                    this.handleGameStateSync(message);
                    break;
                case 'request-sync':
                    // Send our current state when requested
                    this.syncGameState();
                    break;
                case 'card-position-update':
                    this.handleOpponentCardPositionUpdate(message);
                    break;
                case 'card-bring-to-front':
                    this.handleOpponentCardBringToFront(message);
                    break;
                case 'life-change':
                    this.handleOpponentLifeChange(message);
                    break;
                case 'counter-change':
                    this.handleOpponentCounterChange(message);
                    break;
                case 'profile-picture-update':
                    this.handleOpponentProfilePictureUpdate(message);
                    break;
                default:
                    console.log('Unknown message type:', message.type);
            }
        } catch (error) {
            console.error('Error handling network message:', error, message);
        }
    }

    handleOpponentCardMove(message) {
        // Handle opponent moving cards between zones
        console.log('Received opponent card move:', message);
        
        if (message.from && message.to) {
            console.log(`Syncing ${message.playerName}'s card move: ${message.from} -> ${message.to}`);
            
            // Update opponent hand count when cards move to/from hand
            if (message.from === 'player-hand' && message.playerName !== this.game.networking.playerName) {
                this.opponentHandCount = Math.max(0, this.opponentHandCount - 1);
            }
            if (message.to === 'player-hand' && message.playerName !== this.game.networking.playerName) {
                this.opponentHandCount += 1;
            }
            
            // Remove card from source zone if it was on battlefield
            if (message.from === 'battlefield') {
                const beforeCount = this.battlefield.length;
                this.battlefield = this.battlefield.filter(card => 
                    !(card.id === message.cardId && card.owner === message.playerName)
                );
                console.log(`Removed card from battlefield: ${beforeCount} -> ${this.battlefield.length}`);
            }
            
            // Add card to target zone if it's the battlefield
            if (message.to === 'battlefield' && message.cardData) {
                const newCard = {
                    ...message.cardData,
                    owner: message.playerName,
                    position: message.position || { 
                        x: Math.random() * 300 + 100, 
                        y: Math.random() * 200 + 100 
                    }
                };
                
                if (message.stackedOn) {
                    newCard.stackedOn = message.stackedOn;
                }
                
                this.battlefield.push(newCard);
                console.log(`Added card to battlefield at position:`, newCard.position, `Battlefield now has ${this.battlefield.length} cards`);
            }
            
            // Update opponent hand display if needed
            if (message.from === 'player-hand' || message.to === 'player-hand') {
                this.opponentHand = [];
                for (let i = 0; i < this.opponentHandCount; i++) {
                    this.opponentHand.push({
                        id: `opponent_hand_${i}`,
                        owner: message.playerName,
                        imageUrl: null
                    });
                }
                this.updateZoneDisplay('opponent-hand', this.opponentHand);
            }
            
            this.updateAllDisplays();
            console.log(`Updated displays, total battlefield cards: ${this.battlefield.length}`);
        }
    }

    handleOpponentDrawCard(message) {
        // Update opponent hand count
        if (!this.opponentHandCount) {
            this.opponentHandCount = 0;
        }
        this.opponentHandCount += message.count || 1;
        
        // Create placeholder cards for opponent hand display
        this.opponentHand = [];
        for (let i = 0; i < this.opponentHandCount; i++) {
            this.opponentHand.push({
                id: `opponent_hand_${i}`,
                owner: message.playerName,
                imageUrl: null
            });
        }
        
        this.updateZoneDisplay('opponent-hand', this.opponentHand);
        console.log(`${message.playerName} drew ${message.count || 1} card(s), hand size: ${this.opponentHandCount}`);
    }

    handleOpponentCardToTable(message) {
        // Sync opponent's card additions to table
        if (message.cardData && message.position) {
            this.tableCards.push({
                ...message.cardData,
                owner: message.playerName,
                position: message.position
            });
            this.updateTableDisplay();
        }
    }

    handleGameStateSync(message) {
        // Sync entire game state if needed
        if (message.battlefieldCards) {
            console.log(`Syncing complete battlefield state from ${message.playerName}`);
            
            // Merge opponent's cards with our own cards
            const opponentCards = message.battlefieldCards.filter(card => card.owner === message.playerName);
            const ourCards = this.battlefield.filter(card => card.owner === this.game.networking.playerName);
            
            this.battlefield = [...ourCards, ...opponentCards];
            this.updateBattlefieldDisplay();
            
            console.log(`Battlefield now has ${this.battlefield.length} cards total`);
        }
    }

    handleCardPositionUpdate(message) {
        // Update card position on table
        const card = this.tableCards.find(c => c.id === message.cardId && c.owner === this.playerName);
        if (card && message.position) {
            card.position = message.position;
            card.stackedOn = message.stackedOn;
            this.updateTableDisplay();
        }
    }

    handleCardBringToFront(message) {
        // Bring card to front (highest z-index) on table
        const cardIndex = this.tableCards.findIndex(c => c.id === message.cardId && c.owner === this.playerName);
        if (cardIndex !== -1) {
            const [card] = this.tableCards.splice(cardIndex, 1);
            this.tableCards.push(card);
            this.updateTableDisplay();
        }
    }

    handleOpponentCardPositionUpdate(message) {
        const card = this.battlefield.find(c => 
            c.id === message.cardId && c.owner === message.playerName
        );
        if (card && message.position) {
            card.position = message.position;
            if (message.stackedOn !== undefined) {
                card.stackedOn = message.stackedOn;
            }
            this.updateBattlefieldDisplay();
            console.log(`${message.playerName} moved card to position`, message.position);
        }
    }

    handleOpponentCardBringToFront(message) {
        const cardIndex = this.battlefield.findIndex(c => 
            c.id === message.cardId && c.owner === message.playerName
        );
        if (cardIndex !== -1) {
            // Move card to end of array (front)
            const cardToMove = this.battlefield.splice(cardIndex, 1)[0];
            this.battlefield.push(cardToMove);
            this.updateBattlefieldDisplay();
            console.log(`${message.playerName} brought card to front`);
        }
    }

    handleOpponentCardTapUntap(message) {
        const card = this.battlefield.find(c => 
            c.id === message.cardId && c.owner === message.playerName
        );
        if (card) {
            let state = this.cardStates.get(card.id) || {};
            state.tapped = message.tapped;
            this.cardStates.set(card.id, state);
            
            this.updateBattlefieldDisplay();
            console.log(`${message.playerName} ${message.tapped ? 'tapped' : 'untapped'} a card`);
        }
    }

    handleOpponentCardFlip(message) {
        const card = this.battlefield.find(c => 
            c.id === message.cardId && c.owner === message.playerName
        );
        if (card) {
            let state = this.cardStates.get(card.id) || {};
            state.flipped = message.flipped;
            this.cardStates.set(card.id, state);
            
            this.updateBattlefieldDisplay();
            console.log(`${message.playerName} ${message.flipped ? 'flipped' : 'unflipped'} a card`);
        }
    }

    leaveGame() {
        this.game.networking.disconnect();
        this.showLobbyScreen();
    }

    // Debug functionality
    showConnectionStats() {
        const stats = {
            roomCode: this.game.networking.roomCode,
            playerName: this.game.networking.playerName,
            opponentName: this.game.networking.opponentName,
            isHost: this.game.networking.isHost,
            isConnected: this.game.networking.isConnected,
            connectionState: this.game.networking.connectionState
        };
        
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.innerHTML = `
                <div><strong>Room Code:</strong> ${stats.roomCode || 'None'}</div>
                <div><strong>Player Name:</strong> ${stats.playerName || 'None'}</div>
                <div><strong>Opponent Name:</strong> ${stats.opponentName || 'None'}</div>
                <div><strong>Is Host:</strong> ${stats.isHost}</div>
                <div><strong>Connected:</strong> ${stats.isConnected}</div>
                <div><strong>State:</strong> ${stats.connectionState}</div>
                <div><strong>Time:</strong> ${new Date().toLocaleTimeString()}</div>
            `;
        }
    }

    clearDebugInfo() {
        const debugInfo = document.getElementById('debug-info');
        if (debugInfo) {
            debugInfo.innerHTML = '<div>Debug info cleared...</div>';
        }
    }

    // Sync game state between players
    syncGameState() {
        if (this.game.networking.isConnected) {
            // Only send our own cards to avoid conflicts
            const ourBattlefieldCards = this.battlefield.filter(card => 
                card.owner === this.game.networking.playerName
            );
            
            this.game.networking.sendMessage({
                type: 'sync-game-state',
                playerName: this.game.networking.playerName,
                battlefieldCards: ourBattlefieldCards,
                timestamp: Date.now()
            });
            
            console.log(`Synced ${ourBattlefieldCards.length} of our cards to opponent`);
        }
    }

    requestGameStateSync() {
        if (this.game.networking.isConnected) {
            this.game.networking.sendMessage({
                type: 'request-sync',
                playerName: this.game.networking.playerName
            });
        }
    }

    // Enhanced table card interaction
    handleTableCardMove(cardId, newPosition, stackedOn = null) {
        const card = this.tableCards.find(c => c.id === cardId && c.owner === this.game.networking.playerName);
        if (card) {
            card.position = newPosition;
            card.stackedOn = stackedOn;
            
            // Sync position change with opponent
            this.game.networking.sendMessage({
                type: 'card-position-update',
                cardId: cardId,
                position: newPosition,
                stackedOn: stackedOn,
                playerName: this.game.networking.playerName
            });
            
            this.updateTableDisplay();
        }
    }

    // Add support for double-click to bring card to front
    handleTableCardDoubleClick(card) {
        if (card.owner === this.game.networking.playerName) {
            // Move card to front by updating its z-index
            const maxZ = Math.max(...this.tableCards.map((c, i) => i)) + 1;
            const cardIndex = this.tableCards.findIndex(c => c.id === card.id && c.owner === card.owner);
            if (cardIndex !== -1) {
                // Move card to end of array (front)
                const cardToMove = this.tableCards.splice(cardIndex, 1)[0];
                this.tableCards.push(cardToMove);
                this.updateTableDisplay();
                
                // Sync the reorder
                this.game.networking.sendMessage({
                    type: 'card-bring-to-front',
                    cardId: card.id,
                    playerName: this.game.networking.playerName
                });
            }
        }
    }

    // Handle repositioning cards within the battlefield
    handleBattlefieldCardReposition(cardId, event) {
        // Allow any player to reposition any card in the battlefield
        const card = this.battlefield.find(c => c.id == cardId);
        
        if (card) {
            const rect = event.currentTarget.getBoundingClientRect();
            const newX = event.clientX - rect.left - 40; // Center on cursor
            const newY = event.clientY - rect.top - 60;
            
            // Keep within bounds with better margins
            const boundedX = Math.max(10, Math.min(newX, rect.width - 90));
            const boundedY = Math.max(40, Math.min(newY, rect.height - 130)); // Account for label
            
            // Check for stacking with other cards - reduced threshold
            const stackThreshold = 25;
            let stackedOn = null;
            
            for (let existingCard of this.battlefield) {
                if (existingCard.id !== cardId && existingCard.position) {
                    // Check distance from center to center of cards
                    const cardCenterX = existingCard.position.x + 40;
                    const cardCenterY = existingCard.position.y + 60;
                    const newCenterX = boundedX + 40;
                    const newCenterY = boundedY + 60;
                    
                    const distance = Math.sqrt(
                        Math.pow(newCenterX - cardCenterX, 2) + 
                        Math.pow(newCenterY - cardCenterY, 2)
                    );
                    if (distance < stackThreshold) {
                        stackedOn = existingCard.id;
                        break;
                    }
                }
            }
            
            // Update position
            if (stackedOn) {
                const stackCard = this.battlefield.find(c => c.id === stackedOn);
                card.position = { 
                    x: stackCard.position.x + 3, 
                    y: stackCard.position.y + 3 
                };
                card.stackedOn = stackedOn;
                console.log(`Repositioned and stacked card on ${stackCard.name || stackedOn}`);
            } else {
                card.position = { x: boundedX, y: boundedY };
                card.stackedOn = null;
                console.log(`Repositioned card to (${boundedX}, ${boundedY})`);
            }
            
            this.updateBattlefieldDisplay();
            
            // Sync the position change
            this.game.networking.sendMessage({
                type: 'card-position-update',
                cardId: cardId,
                position: card.position,
                stackedOn: card.stackedOn,
                playerName: this.game.networking.playerName,
                originalOwner: card.owner
            });
            
            console.log(`${this.game.networking.playerName} repositioned ${card.owner}'s card: ${card.name}`);
        }
    }

    // Life and counter management
    adjustLife(amount) {
        this.playerLife += amount;
        this.updateLifeDisplay();
        
        // Sync with opponent
        this.game.networking.sendMessage({
            type: 'life-change',
            life: this.playerLife,
            playerName: this.game.networking.playerName
        });
        
        console.log(`Life changed to: ${this.playerLife}`);
    }

    adjustCounter(type, amount) {
        if (this.playerCounters[type] !== undefined) {
            this.playerCounters[type] = Math.max(0, this.playerCounters[type] + amount);
            this.updateCounterDisplay();
            
            // Sync with opponent
            this.game.networking.sendMessage({
                type: 'counter-change',
                counterType: type,
                value: this.playerCounters[type],
                playerName: this.game.networking.playerName
            });
            
            console.log(`${type} counter changed to: ${this.playerCounters[type]}`);
        }
    }

    updateLifeDisplay() {
        if (this.elements.playerLife) {
            this.elements.playerLife.textContent = this.playerLife;
        }
    }

    updateCounterDisplay() {
        const counterElements = {
            poison: document.getElementById('player-poison'),
            energy: document.getElementById('player-energy'),
            experience: document.getElementById('player-experience')
        };
        
        Object.keys(this.playerCounters).forEach(type => {
            if (counterElements[type]) {
                counterElements[type].textContent = this.playerCounters[type];
            }
        });
    }

    handleOpponentLifeChange(message) {
        this.opponentLife = message.life;
        if (this.elements.opponentLife) {
            this.elements.opponentLife.textContent = this.opponentLife;
        }
        console.log(`${message.playerName} life changed to: ${message.life}`);
    }

    handleOpponentCounterChange(message) {
        this.opponentCounters[message.counterType] = message.value;
        
        const counterElements = {
            poison: document.getElementById('opponent-poison'),
            energy: document.getElementById('opponent-energy'),
            experience: document.getElementById('opponent-experience')
        };
        
        if (counterElements[message.counterType]) {
            counterElements[message.counterType].textContent = message.value;
        }
        
        console.log(`${message.playerName} ${message.counterType} counter changed to: ${message.value}`);
    }

    updateGameHeader() {
        // Update player name
        if (this.elements.playerNameDisplay && this.game.networking.playerName) {
            this.elements.playerNameDisplay.textContent = this.game.networking.playerName;
        }
        
        // Update player avatar
        if (this.elements.playerAvatar && this.playerPfp) {
            this.elements.playerAvatar.style.backgroundImage = `url(${this.playerPfp})`;
            this.elements.playerAvatar.style.backgroundSize = 'cover';
            this.elements.playerAvatar.style.backgroundPosition = 'center';
        }
        
        // Update opponent name if available
        if (this.elements.opponentNameDisplay && this.game.networking.opponentName) {
            this.elements.opponentNameDisplay.textContent = this.game.networking.opponentName;
        }
        
        // Update opponent avatar if available
        if (this.elements.opponentAvatar && this.opponentPfp) {
            this.elements.opponentAvatar.style.backgroundImage = `url(${this.opponentPfp})`;
            this.elements.opponentAvatar.style.backgroundSize = 'cover';
            this.elements.opponentAvatar.style.backgroundPosition = 'center';
        }
        
        // Room code display
        const roomCodeDisplay = document.getElementById('room-code-display');
        if (roomCodeDisplay && this.game.networking.roomCode) {
            roomCodeDisplay.textContent = `Room: ${this.game.networking.roomCode}`;
        }
        
        // Sync our profile picture with opponent when game starts
        if (this.game.networking.isConnected && this.playerPfp) {
            this.game.networking.sendMessage({
                type: 'profile-picture-update',
                profilePicture: this.playerPfp,
                playerName: this.game.networking.playerName
            });
        }
    }

    handleOpponentProfilePictureUpdate(message) {
        this.opponentPfp = message.profilePicture;
        
        // Update opponent avatar in game header
        if (this.elements.opponentAvatar) {
            this.elements.opponentAvatar.style.backgroundImage = `url(${message.profilePicture})`;
            this.elements.opponentAvatar.style.backgroundSize = 'cover';
            this.elements.opponentAvatar.style.backgroundPosition = 'center';
        }
        
        // Update opponent card backs
        this.updateAllDisplays();
        
        console.log(`${message.playerName} updated their profile picture`);
    }

    tapUntapCard(card) {
        // Allow any player to tap/untap any card in the battlefield
        let state = this.cardStates.get(card.id) || { tapped: false, flipped: false };
        state.tapped = !state.tapped;
        this.cardStates.set(card.id, state);
        
        this.updateBattlefieldDisplay();
        
        // Sync with opponent
        this.game.networking.sendMessage({
            type: 'card-tap-untap',
            cardId: card.id,
            tapped: state.tapped,
            playerName: this.game.networking.playerName,
            originalOwner: card.owner
        });
        
        console.log(`${state.tapped ? 'Tapped' : 'Untapped'} card: ${card.name} (Owner: ${card.owner})`);
    }

    flipCard(card) {
        // Allow any player to flip any card in the battlefield
        let state = this.cardStates.get(card.id) || { tapped: false, flipped: false };
        state.flipped = !state.flipped;
        this.cardStates.set(card.id, state);
        
        this.updateBattlefieldDisplay();
        
        // Sync with opponent
        this.game.networking.sendMessage({
            type: 'card-flip',
            cardId: card.id,
            flipped: state.flipped,
            playerName: this.game.networking.playerName,
            originalOwner: card.owner
        });
        
        console.log(`${state.flipped ? 'Flipped' : 'Unflipped'} card: ${card.name} (Owner: ${card.owner})`);
    }

    handleKeyPress(event) {
        // T key to tap/untap selected card - Allow any player to tap any card in play area
        if (event.key.toLowerCase() === 't' && !event.ctrlKey && !event.altKey) {
            const selectedCard = document.querySelector('.card.selected');
            if (selectedCard) {
                const cardId = selectedCard.getAttribute('data-card-id');
                const card = this.battlefield.find(c => c.id === cardId);
                if (card) {
                    this.tapUntapCard(card);
                    event.preventDefault();
                }
            }
        }
        
        // F key to flip selected card - Allow any player to flip any card in play area
        if (event.key.toLowerCase() === 'f' && !event.ctrlKey && !event.altKey) {
            const selectedCard = document.querySelector('.card.selected');
            if (selectedCard) {
                const cardId = selectedCard.getAttribute('data-card-id');
                const card = this.battlefield.find(c => c.id === cardId);
                if (card) {
                    this.flipCard(card);
                    event.preventDefault();
                }
            }
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new SimpleApp();
});
