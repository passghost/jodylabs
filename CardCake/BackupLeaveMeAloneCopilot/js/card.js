// Card class for managing individual cards

class Card {
    constructor(id, imageData = null, name = 'Untitled Card') {
        this.id = id;
        this.imageData = imageData; // Base64 encoded image data
        this.name = name;
        this.isFlipped = false;
        this.position = { x: 0, y: 0 };
        this.rotation = 0;
        this.scale = 1;
        this.zIndex = 0;
        
        // Visual properties
        this.width = 80;
        this.height = 112;
        this.borderRadius = 8;
        
        // Game state
        this.isSelected = false;
        this.isDragging = false;
        this.isHovered = false;
        
        // Animation state
        this.animationState = 'idle'; // idle, drawing, flipping, moving
        this.animationProgress = 0;
        
        // Create DOM element
        this.element = this.createElement();
    }

    createElement() {
        const cardElement = document.createElement('div');
        cardElement.className = 'game-card';
        cardElement.id = `card-${this.id}`;
        cardElement.style.cssText = `
            width: ${this.width}px;
            height: ${this.height}px;
            position: absolute;
            border-radius: ${this.borderRadius}px;
            border: 2px solid #333;
            cursor: grab;
            transition: transform 0.2s, z-index 0.2s;
            user-select: none;
            background: ${this.isFlipped ? 'linear-gradient(45deg, #8B4513, #A0522D)' : '#fff'};
        `;

        // Add image if available
        if (this.imageData && !this.isFlipped) {
            const img = document.createElement('img');
            img.src = this.imageData;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: ${this.borderRadius - 2}px;
                pointer-events: none;
            `;
            cardElement.appendChild(img);
        } else if (this.isFlipped) {
            // Add card back pattern
            const pattern = document.createElement('div');
            pattern.className = 'card-back-pattern';
            pattern.style.cssText = `
                width: 100%;
                height: 100%;
                background: 
                    radial-gradient(circle at 25% 25%, #D2691E 2px, transparent 2px),
                    radial-gradient(circle at 75% 75%, #D2691E 2px, transparent 2px);
                background-size: 20px 20px;
                border-radius: ${this.borderRadius - 2}px;
            `;
            cardElement.appendChild(pattern);
        }

        // Add event listeners
        this.addEventListeners(cardElement);
        
        return cardElement;
    }

    addEventListeners(element) {
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let cardStart = { x: 0, y: 0 };

        // Mouse events
        element.addEventListener('mousedown', (e) => {
            if (e.button === 0) { // Left click
                isDragging = true;
                this.isDragging = true;
                dragStart.x = e.clientX;
                dragStart.y = e.clientY;
                cardStart.x = this.position.x;
                cardStart.y = this.position.y;
                
                element.style.cursor = 'grabbing';
                element.style.zIndex = '1000';
                element.classList.add('dragging');
                
                e.preventDefault();
            }
        });

        element.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - dragStart.x;
                const deltaY = e.clientY - dragStart.y;
                
                this.setPosition(
                    cardStart.x + deltaX,
                    cardStart.y + deltaY
                );
            }
        });

        element.addEventListener('mouseup', (e) => {
            if (isDragging) {
                isDragging = false;
                this.isDragging = false;
                element.style.cursor = 'grab';
                element.classList.remove('dragging');
                
                // Check if dropped in a valid area
                this.handleDrop(e);
            }
        });

        // Context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        });

        // Hover effects
        element.addEventListener('mouseenter', () => {
            this.isHovered = true;
            if (!this.isDragging) {
                element.style.transform = 'scale(1.1)';
                element.style.zIndex = '100';
            }
        });

        element.addEventListener('mouseleave', () => {
            this.isHovered = false;
            if (!this.isDragging) {
                element.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`;
                element.style.zIndex = this.zIndex.toString();
            }
        });

        // Double click to flip
        element.addEventListener('dblclick', () => {
            this.flip();
        });

        // Global mouse events for dragging
        document.addEventListener('mousemove', (e) => {
            if (isDragging) {
                const deltaX = e.clientX - dragStart.x;
                const deltaY = e.clientY - dragStart.y;
                
                this.setPosition(
                    cardStart.x + deltaX,
                    cardStart.y + deltaY
                );
            }
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                this.isDragging = false;
                element.style.cursor = 'grab';
                element.classList.remove('dragging');
            }
        });
    }

    setPosition(x, y) {
        this.position.x = x;
        this.position.y = y;
        this.updateElementPosition();
    }

    updateElementPosition() {
        if (this.element) {
            this.element.style.left = `${this.position.x}px`;
            this.element.style.top = `${this.position.y}px`;
            this.element.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg)`;
            this.element.style.zIndex = this.zIndex.toString();
        }
    }

    setRotation(degrees) {
        this.rotation = degrees;
        this.updateElementPosition();
    }

    setScale(scale) {
        this.scale = scale;
        this.updateElementPosition();
    }

    setZIndex(zIndex) {
        this.zIndex = zIndex;
        this.updateElementPosition();
    }

    flip(animate = true) {
        if (animate) {
            this.animateFlip();
        } else {
            this.isFlipped = !this.isFlipped;
            this.updateVisual();
        }
        
        // Notify game of flip
        if (window.Game && window.Game.networking) {
            window.Game.networking.sendMessage({
                type: 'card_flipped',
                cardId: this.id,
                isFlipped: this.isFlipped
            });
        }
    }

    animateFlip() {
        this.animationState = 'flipping';
        const element = this.element;
        
        element.style.transition = 'transform 0.3s ease-in-out';
        element.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg) rotateY(90deg)`;
        
        setTimeout(() => {
            this.isFlipped = !this.isFlipped;
            this.updateVisual();
            element.style.transform = `scale(${this.scale}) rotate(${this.rotation}deg) rotateY(0deg)`;
            
            setTimeout(() => {
                element.style.transition = 'transform 0.2s, z-index 0.2s';
                this.animationState = 'idle';
            }, 300);
        }, 150);
    }

    updateVisual() {
        if (!this.element) return;

        // Clear existing content
        this.element.innerHTML = '';
        
        // Update background
        this.element.style.background = this.isFlipped ? 
            'linear-gradient(45deg, #8B4513, #A0522D)' : '#fff';

        if (this.imageData && !this.isFlipped) {
            // Show front image
            const img = document.createElement('img');
            img.src = this.imageData;
            img.style.cssText = `
                width: 100%;
                height: 100%;
                object-fit: cover;
                border-radius: ${this.borderRadius - 2}px;
                pointer-events: none;
            `;
            this.element.appendChild(img);
        } else if (this.isFlipped) {
            // Show card back pattern
            const pattern = document.createElement('div');
            pattern.className = 'card-back-pattern';
            pattern.style.cssText = `
                width: 100%;
                height: 100%;
                background: 
                    radial-gradient(circle at 25% 25%, #D2691E 2px, transparent 2px),
                    radial-gradient(circle at 75% 75%, #D2691E 2px, transparent 2px);
                background-size: 20px 20px;
                border-radius: ${this.borderRadius - 2}px;
            `;
            this.element.appendChild(pattern);
        }
    }

    showContextMenu(x, y) {
        const contextMenu = document.getElementById('context-menu');
        if (!contextMenu) return;

        // Position menu
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
        contextMenu.classList.remove('hidden');

        // Add click handlers
        const items = contextMenu.querySelectorAll('.context-item');
        items.forEach(item => {
            item.onclick = (e) => {
                const action = item.dataset.action;
                this.handleContextAction(action);
                contextMenu.classList.add('hidden');
            };
        });

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
            case 'flip':
                this.flip();
                break;
            case 'return':
                if (window.Game) {
                    window.Game.returnCardToDeck(this);
                }
                break;
            default:
                console.log(`Context action: ${action} for card ${this.id}`);
        }
    }

    handleDrop(event) {
        const playArea = document.getElementById('play-area');
        const playerHand = document.getElementById('player-hand');
        
        if (!playArea || !playerHand) return;

        const playAreaRect = playArea.getBoundingClientRect();
        const handRect = playerHand.getBoundingClientRect();
        
        const x = event.clientX;
        const y = event.clientY;

        if (Utils.pointInRect(x, y, playAreaRect.left, playAreaRect.top, playAreaRect.width, playAreaRect.height)) {
            // Dropped in play area
            this.moveToPlayArea();
        } else if (Utils.pointInRect(x, y, handRect.left, handRect.top, handRect.width, handRect.height)) {
            // Dropped in hand
            this.moveToHand();
        }
    }

    moveToPlayArea() {
        const playArea = document.getElementById('play-area');
        if (!playArea) return;

        playArea.appendChild(this.element);
        
        // Notify game
        if (window.Game && window.Game.networking) {
            window.Game.networking.sendMessage({
                type: 'card_played',
                cardId: this.id,
                position: this.position
            });
        }
    }

    moveToHand() {
        const playerHand = document.getElementById('player-hand');
        if (!playerHand) return;

        playerHand.appendChild(this.element);
        
        // Reset position for hand layout
        this.setPosition(0, 0);
        this.setRotation(0);
        this.setScale(1);
    }

    animateDrawFromDeck(targetX, targetY) {
        this.animationState = 'drawing';
        
        // Start from deck position
        const deckPile = document.getElementById('player-deck');
        if (deckPile) {
            const deckRect = deckPile.getBoundingClientRect();
            this.setPosition(deckRect.left, deckRect.top);
        }

        // Add draw animation class
        this.element.classList.add('card-draw-animation');
        
        // Animate to target position
        Utils.animate(
            this.position.x, targetX, 500,
            (x) => this.setPosition(x, this.position.y)
        );
        
        Utils.animate(
            this.position.y, targetY, 500,
            (y) => this.setPosition(this.position.x, y),
            () => {
                this.element.classList.remove('card-draw-animation');
                this.animationState = 'idle';
            }
        );
    }

    // Serialize card data for network transmission
    serialize() {
        return {
            id: this.id,
            imageData: this.imageData,
            name: this.name,
            isFlipped: this.isFlipped,
            position: this.position,
            rotation: this.rotation,
            scale: this.scale,
            zIndex: this.zIndex
        };
    }

    // Create card from serialized data
    static deserialize(data) {
        const card = new Card(data.id, data.imageData, data.name);
        card.isFlipped = data.isFlipped;
        card.position = data.position;
        card.rotation = data.rotation;
        card.scale = data.scale;
        card.zIndex = data.zIndex;
        card.updateElementPosition();
        card.updateVisual();
        return card;
    }

    // Clean up
    destroy() {
        if (this.element && this.element.parentNode) {
            this.element.parentNode.removeChild(this.element);
        }
        this.element = null;
    }
}

// Export for use in other modules
window.Card = Card;
