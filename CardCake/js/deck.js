// Deck class for managing collections of cards

class Deck {
    constructor(id, name = 'Untitled Deck', cards = []) {
        this.id = id;
        this.name = name;
        this.cards = [...cards]; // Array of Card objects
        this.originalOrder = [...cards]; // Keep track of original order
        this.isShuffled = false;
        
        // Visual properties
        this.position = { x: 0, y: 0 };
        this.element = null;
        
        // Game state
        this.isPlayerDeck = true; // vs opponent deck
        this.maxCards = 100; // Reasonable limit
        
        this.createElement();
    }

    createElement() {
        const deckElement = document.createElement('div');
        deckElement.className = 'deck-pile';
        deckElement.id = `deck-${this.id}`;
        
        // Create deck count display
        const countElement = document.createElement('div');
        countElement.className = 'deck-count';
        countElement.textContent = this.cards.length.toString();
        deckElement.appendChild(countElement);
        
        // Add stacking effect
        this.updateStackingEffect(deckElement);
        
        // Add event listeners
        this.addEventListeners(deckElement);
        
        this.element = deckElement;
        return deckElement;
    }

    updateStackingEffect(element) {
        // Remove existing stacking elements
        const existingStacks = element.querySelectorAll('.deck-stack');
        existingStacks.forEach(stack => stack.remove());
        
        // Add stacking effect based on card count
        const stackCount = Math.min(3, Math.floor(this.cards.length / 10));
        for (let i = 0; i < stackCount; i++) {
            const stackElement = document.createElement('div');
            stackElement.className = 'deck-stack';
            stackElement.style.cssText = `
                position: absolute;
                width: 100%;
                height: 100%;
                background: inherit;
                border-radius: inherit;
                border: inherit;
                top: ${-2 * (i + 1)}px;
                left: ${-2 * (i + 1)}px;
                z-index: ${-i - 1};
            `;
            element.appendChild(stackElement);
        }
    }

    addEventListeners(element) {
        // Right-click context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        });

        // Left-click to draw card
        element.addEventListener('click', (e) => {
            if (e.button === 0) { // Left click
                this.drawCard();
            }
        });

        // Hover effects
        element.addEventListener('mouseenter', () => {
            element.style.transform = 'scale(1.05)';
        });

        element.addEventListener('mouseleave', () => {
            element.style.transform = 'scale(1)';
        });

        // Drag and drop for entire deck (optional feature)
        element.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', `deck-${this.id}`);
        });
    }

    showContextMenu(x, y) {
        const contextMenu = document.getElementById('context-menu');
        if (!contextMenu) return;

        // Clear existing items
        contextMenu.innerHTML = '';

        // Add deck-specific context items
        const actions = [
            { action: 'draw', text: 'Draw Card', enabled: this.cards.length > 0 },
            { action: 'shuffle', text: 'Shuffle Deck', enabled: this.cards.length > 1 },
            { action: 'peek', text: 'Peek at Top Card', enabled: this.cards.length > 0 },
            { action: 'reset', text: 'Reset Deck Order', enabled: this.isShuffled }
        ];

        actions.forEach(actionData => {
            const item = document.createElement('div');
            item.className = `context-item ${actionData.enabled ? '' : 'disabled'}`;
            item.textContent = actionData.text;
            item.dataset.action = actionData.action;
            
            if (actionData.enabled) {
                item.onclick = () => {
                    this.handleContextAction(actionData.action);
                    contextMenu.classList.add('hidden');
                };
            }
            
            contextMenu.appendChild(item);
        });

        // Position and show menu
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.classList.remove('hidden');

        // Hide menu when clicking elsewhere
        const hideMenu = (e) => {
            if (!contextMenu.contains(e.target)) {
                contextMenu.classList.add('hidden');
                document.removeEventListener('click', hideMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', hideMenu);
        }, 100);
    }

    handleContextAction(action) {
        switch (action) {
            case 'draw':
                this.drawCard();
                break;
            case 'shuffle':
                this.shuffle();
                break;
            case 'peek':
                this.peekTopCard();
                break;
            case 'reset':
                this.resetOrder();
                break;
        }
    }

    addCard(card) {
        if (this.cards.length >= this.maxCards) {
            Utils.showNotification(`Deck is full (${this.maxCards} cards maximum)`, 'warning');
            return false;
        }

        this.cards.push(card);
        this.originalOrder.push(card);
        this.updateDisplay();
        
        // Notify game of deck change
        this.notifyDeckChange('card_added', { cardId: card.id });
        
        return true;
    }

    removeCard(cardId) {
        const index = this.cards.findIndex(card => card.id === cardId);
        if (index !== -1) {
            const removedCard = this.cards.splice(index, 1)[0];
            
            // Also remove from original order
            const originalIndex = this.originalOrder.findIndex(card => card.id === cardId);
            if (originalIndex !== -1) {
                this.originalOrder.splice(originalIndex, 1);
            }
            
            this.updateDisplay();
            this.notifyDeckChange('card_removed', { cardId: cardId });
            
            return removedCard;
        }
        return null;
    }

    drawCard() {
        if (this.cards.length === 0) {
            Utils.showNotification('Deck is empty!', 'warning');
            return null;
        }

        const drawnCard = this.cards.pop(); // Draw from top
        this.updateDisplay();
        
        // Add card to player's hand
        this.addCardToHand(drawnCard);
        
        // Notify game and opponent
        this.notifyDeckChange('card_drawn', { cardId: drawnCard.id });
        
        Utils.showNotification(`Drew: ${drawnCard.name}`, 'info', 2000);
        return drawnCard;
    }

    drawMultipleCards(count) {
        const drawnCards = [];
        for (let i = 0; i < count && this.cards.length > 0; i++) {
            const card = this.drawCard();
            if (card) {
                drawnCards.push(card);
            }
        }
        return drawnCards;
    }

    addCardToHand(card) {
        const playerHand = document.getElementById('player-hand');
        if (!playerHand) return;

        // Position card in hand
        const handCards = playerHand.querySelectorAll('.game-card');
        const handPosition = handCards.length * 90; // Spread cards out
        
        card.setPosition(handPosition, 0);
        card.setZIndex(handCards.length);
        
        // Add to hand with animation
        playerHand.appendChild(card.element);
        
        // Animate card draw
        const deckRect = this.element.getBoundingClientRect();
        const handRect = playerHand.getBoundingClientRect();
        
        card.animateDrawFromDeck(
            handRect.left + handPosition,
            handRect.top
        );
    }

    peekTopCard() {
        if (this.cards.length === 0) {
            Utils.showNotification('Deck is empty!', 'warning');
            return null;
        }

        const topCard = this.cards[this.cards.length - 1];
        
        // Create preview modal
        this.showCardPreview(topCard);
        
        return topCard;
    }

    showCardPreview(card) {
        // Create modal overlay
        const overlay = document.createElement('div');
        overlay.className = 'card-preview-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
            cursor: pointer;
        `;

        // Create large card preview
        const previewCard = document.createElement('div');
        previewCard.style.cssText = `
            width: 300px;
            height: 420px;
            background: ${card.isFlipped ? 'linear-gradient(45deg, #8B4513, #A0522D)' : '#fff'};
            border: 4px solid #333;
            border-radius: 20px;
            overflow: hidden;
            position: relative;
        `;

        if (card.imageData && !card.isFlipped) {
            const img = document.createElement('img');
            img.src = card.imageData;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
            `;
            previewCard.appendChild(img);
        } else if (card.isFlipped) {
            const pattern = document.createElement('div');
            pattern.style.cssText = `
                width: 100%;
                height: 100%;
                background: 
                    radial-gradient(circle at 25% 25%, #D2691E 4px, transparent 4px),
                    radial-gradient(circle at 75% 75%, #D2691E 4px, transparent 4px);
                background-size: 40px 40px;
            `;
            previewCard.appendChild(pattern);
        }

        // Add card name
        const nameLabel = document.createElement('div');
        nameLabel.textContent = card.name;
        nameLabel.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 10px;
            right: 10px;
            background: rgba(0, 0, 0, 0.8);
            color: white;
            padding: 10px;
            border-radius: 5px;
            text-align: center;
            font-weight: bold;
        `;
        previewCard.appendChild(nameLabel);

        overlay.appendChild(previewCard);
        document.body.appendChild(overlay);

        // Close on click
        overlay.addEventListener('click', () => {
            document.body.removeChild(overlay);
        });

        // Close on escape
        const escapeHandler = (e) => {
            if (e.key === 'Escape') {
                document.body.removeChild(overlay);
                document.removeEventListener('keydown', escapeHandler);
            }
        };
        document.addEventListener('keydown', escapeHandler);
    }

    shuffle() {
        if (this.cards.length <= 1) {
            Utils.showNotification('Need at least 2 cards to shuffle', 'warning');
            return;
        }

        this.cards = Utils.shuffleArray(this.cards);
        this.isShuffled = true;
        this.updateDisplay();
        
        // Visual shuffle animation
        this.animateShuffle();
        
        this.notifyDeckChange('deck_shuffled');
        Utils.showNotification('Deck shuffled!', 'success', 2000);
    }

    animateShuffle() {
        if (!this.element) return;
        
        // Add shuffle animation
        this.element.style.animation = 'shuffle 0.5s ease-in-out';
        
        // Define shuffle keyframes if not already defined
        if (!document.querySelector('#shuffle-animation')) {
            const style = document.createElement('style');
            style.id = 'shuffle-animation';
            style.textContent = `
                @keyframes shuffle {
                    0%, 100% { transform: scale(1) rotate(0deg); }
                    25% { transform: scale(1.1) rotate(-5deg); }
                    50% { transform: scale(1.1) rotate(5deg); }
                    75% { transform: scale(1.1) rotate(-5deg); }
                }
            `;
            document.head.appendChild(style);
        }
        
        setTimeout(() => {
            this.element.style.animation = '';
        }, 500);
    }

    resetOrder() {
        this.cards = [...this.originalOrder];
        this.isShuffled = false;
        this.updateDisplay();
        
        this.notifyDeckChange('deck_reset');
        Utils.showNotification('Deck order reset!', 'info', 2000);
    }

    updateDisplay() {
        if (!this.element) return;

        const countElement = this.element.querySelector('.deck-count');
        if (countElement) {
            countElement.textContent = this.cards.length.toString();
        }

        // Update stacking effect
        this.updateStackingEffect(this.element);
        
        // Update opacity based on card count
        this.element.style.opacity = this.cards.length > 0 ? '1' : '0.5';
        
        // Update game UI
        this.updateGameUI();
    }

    updateGameUI() {
        const deckCountElement = document.getElementById('player-deck-count');
        if (deckCountElement) {
            deckCountElement.textContent = this.cards.length.toString();
        }
    }

    notifyDeckChange(action, data = {}) {
        if (window.Game && window.Game.networking) {
            window.Game.networking.sendMessage({
                type: 'deck_action',
                action: action,
                deckId: this.id,
                cardCount: this.cards.length,
                ...data
            });
        }
    }

    // Import/Export functionality
    exportDeck() {
        return {
            id: this.id,
            name: this.name,
            cards: this.cards.map(card => card.serialize()),
            isShuffled: this.isShuffled
        };
    }

    static importDeck(deckData) {
        const cards = deckData.cards.map(cardData => Card.deserialize(cardData));
        const deck = new Deck(deckData.id, deckData.name, cards);
        deck.isShuffled = deckData.isShuffled;
        return deck;
    }

    // Save/Load from localStorage
    save() {
        const deckData = this.exportDeck();
        Utils.saveToStorage(`deck_${this.id}`, deckData);
    }

    static load(deckId) {
        const deckData = Utils.loadFromStorage(`deck_${deckId}`);
        if (deckData) {
            return Deck.importDeck(deckData);
        }
        return null;
    }

    // Utility methods
    isEmpty() {
        return this.cards.length === 0;
    }

    isFull() {
        return this.cards.length >= this.maxCards;
    }

    getTopCard() {
        return this.cards.length > 0 ? this.cards[this.cards.length - 1] : null;
    }

    getBottomCard() {
        return this.cards.length > 0 ? this.cards[0] : null;
    }

    hasCard(cardId) {
        return this.cards.some(card => card.id === cardId);
    }

    getCardCount() {
        return this.cards.length;
    }

    // Clean up
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
        this.cards = [];
        this.originalOrder = [];
    }
}

// Export for use in other modules
window.Deck = Deck;
