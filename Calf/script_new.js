class Tamagotchi {
    constructor() {
        this.stats = {
            health: 100,
            hunger: 100,
            happiness: 100,
            discipline: 50,
            temperature: 50,
            energy: 100
        };
        this.age = 0;
        this.weight = 5;
        this.mood = 'happy';
        this.isAlive = true;
        this.lastUpdate = Date.now();
        this.position = { x: 50, y: 50 };
        this.isMoving = false;
        this.targetPosition = null;
        this.cleanliness = 100;
        this.poopCount = 0;
        this.lastPoop = Date.now();
        this.direction = 1;
        this.lastRandomMove = Date.now();
        this.lastInteraction = Date.now();
        this.lastEmotionChange = Date.now();
        this.activeAnimation = null;
        this.currentSkin = 'default';
        this.evolutionStage = 'baby';
        this.hasLights = true;
        this.maxAge = 30;
        this.misbehavior = 0;
        this.isSleeping = false;
        
        // Menu navigation state
        this.menu = {
            isOpen: true,
            currentIndex: 0,
            items: [
                { id: 'feed-menu-btn', action: 'feed', icon: '🍎', label: 'Feed' },
                { id: 'play-menu-btn', action: 'play', icon: '🎮', label: 'Play' },
                { id: 'clean-menu-btn', action: 'clean', icon: '🧽', label: 'Clean' },
                { id: 'medicine-menu-btn', action: 'medicine', icon: '💊', label: 'Medicine' },
                { id: 'discipline-menu-btn', action: 'discipline', icon: '📚', label: 'Discipline' },
                { id: 'light-menu-btn', action: 'light', icon: '💡', label: 'Light' },
                { id: 'status-menu-btn', action: 'status', icon: '📊', label: 'Status' },
                { id: 'game-menu-btn', action: 'game', icon: '🎯', label: 'Mini-Game' },
                { id: 'skin-menu-btn', action: 'skin', icon: '🎨', label: 'Color' }
            ]
        };
        
        // Initialize DOM elements
        this.elements = {
            petSprite: document.getElementById('pet-sprite'),
            healthBar: document.getElementById('health-bar'),
            hungerBar: document.getElementById('hunger-bar'),
            happinessBar: document.getElementById('happiness-bar'),
            tempBar: document.getElementById('temp-bar'),
            moodIndicator: document.getElementById('mood-indicator'),
            ageDisplay: document.getElementById('age'),
            weightDisplay: document.getElementById('weight'),
            evolutionLevel: document.getElementById('evolution-level'),
            disciplineLevel: document.getElementById('discipline-level'),
            energyLevel: document.getElementById('energy-level'),
            maxAge: document.getElementById('max-age'),
            gameOver: document.getElementById('game-over'),
            feedBtn: document.getElementById('feed-btn'),
            playBtn: document.getElementById('play-btn'),
            cleanBtn: document.getElementById('clean-btn'),
            menuScreen: document.getElementById('menu-screen'),
            menuSelector: document.getElementById('menu-selector'),
            statusScreen: document.getElementById('status-screen'),
            miniGame: document.getElementById('mini-game'),
            gameGrid: document.getElementById('game-grid'),
            closeGame: document.getElementById('close-game'),
            restartBtn: document.getElementById('restart-btn'),
            foodItem: document.getElementById('food-item'),
            toyItem: document.getElementById('toy-item'),
            poopItem: document.getElementById('poop-item'),
            sleepBubble: document.getElementById('sleep-bubble'),
            petArea: document.querySelector('.pet-area'),
            screen: document.querySelector('.screen')
        };
        
        this.moodSymbols = {
            happy: '😊',
            sad: '😢',
            angry: '😠',
            sick: '🤒',
            sleeping: '💤',
            dead: '💀',
            dirty: '🤢'
        };
        
        this.init();
    }
    
    init() {
        // Set up button event listeners - repurpose existing buttons
        this.elements.feedBtn.addEventListener('click', () => this.handleUpButton());
        this.elements.playBtn.addEventListener('click', () => this.handleSelectButton());
        this.elements.cleanBtn.addEventListener('click', () => this.handleDownButton());
        this.elements.restartBtn.addEventListener('click', () => this.restart());
        this.elements.closeGame.addEventListener('click', () => this.closeMiniGame());
        
        // Show menu initially
        this.openMenuScreen();
        
        // Start the game loop
        this.gameLoop();
        this.ageTimer();
        this.movementLoop();
        this.updateDisplay();
        this.initMenuStates();
    }
    
    handleUpButton() {
        this.playSound('ui');
        if (this.menu.isOpen) {
            this.menu.currentIndex = (this.menu.currentIndex - 1 + this.menu.items.length) % this.menu.items.length;
            this.updateMenuSelection();
        }
    }
    
    handleDownButton() {
        this.playSound('ui');
        if (this.menu.isOpen) {
            this.menu.currentIndex = (this.menu.currentIndex + 1) % this.menu.items.length;
            this.updateMenuSelection();
        }
    }
    
    handleSelectButton() {
        this.playSound('ui');
        if (!this.menu.isOpen) {
            this.openMenuScreen();
            return;
        }
        
        const selectedItem = this.menu.items[this.menu.currentIndex];
        
        switch (selectedItem.action) {
            case 'feed':
                this.closeMenuScreen();
                this.feed();
                break;
            case 'play':
                this.closeMenuScreen();
                this.play();
                break;
            case 'clean':
                this.closeMenuScreen();
                this.clean();
                break;
            case 'medicine':
                this.closeMenuScreen();
                this.giveMedicine();
                break;
            case 'discipline':
                this.closeMenuScreen();
                this.discipline();
                break;
            case 'light':
                this.closeMenuScreen();
                this.toggleLights();
                break;
            case 'status':
                this.closeMenuScreen();
                this.toggleStatusScreen();
                break;
            case 'game':
                this.closeMenuScreen();
                this.startMiniGame();
                break;
            case 'skin':
                this.closeMenuScreen();
                this.toggleSkin();
                break;
        }
    }
    
    updateMenuSelection() {
        // Remove selection from all menu items
        this.menu.items.forEach((item) => {
            const element = document.getElementById(item.id);
            if (element) {
                element.classList.remove('selected');
            }
        });
        
        // Add selection to the current item
        const currentItem = this.menu.items[this.menu.currentIndex];
        const currentElement = document.getElementById(currentItem.id);
        
        if (currentElement) {
            currentElement.classList.add('selected');
            
            // Simple positioning based on index
            const row = Math.floor(this.menu.currentIndex / 2);
            const selectorTop = 35 + (row * 32);
            
            if (this.elements.menuSelector) {
                this.elements.menuSelector.style.top = selectorTop + 'px';
            }
        }
    }
    
    openMenuScreen() {
        if (this.elements.menuScreen) {
            this.elements.menuScreen.style.display = 'flex';
            this.menu.isOpen = true;
            this.updateMenuSelection();
        }
    }
    
    closeMenuScreen() {
        if (this.elements.menuScreen) {
            this.elements.menuScreen.style.display = 'none';
            this.menu.isOpen = false;
        }
    }
    
    initMenuStates() {
        // Set up initial menu selector position
        if (this.elements.menuSelector) {
            this.elements.menuSelector.style.left = '-15px';
        }
        
        // Add back button to status screen
        if (!document.getElementById('close-status-btn') && this.elements.statusScreen) {
            const closeStatusBtn = document.createElement('button');
            closeStatusBtn.id = 'close-status-btn';
            closeStatusBtn.className = 'close-button';
            closeStatusBtn.textContent = 'Back to Menu';
            closeStatusBtn.addEventListener('click', () => {
                this.elements.statusScreen.style.display = 'none';
                this.openMenuScreen();
            });
            this.elements.statusScreen.appendChild(closeStatusBtn);
        }
    }
    
    // Action methods
    feed() {
        if (!this.isAlive) return;
        
        this.showFood();
        this.lastInteraction = Date.now();
        
        this.moveToTarget(this.elements.foodItem, () => {
            this.showAction('eating');
            this.createEatingEffect();
            
            setTimeout(() => {
                this.stats.hunger = Math.min(100, this.stats.hunger + 25);
                this.stats.health = Math.min(100, this.stats.health + 5);
                this.weight = Math.min(15, this.weight + 0.5);
                this.hideFood();
                this.reactToInteraction('feed');
                this.updateDisplay();
                this.showCustomMessage("+25 Food!", "#00ff00");
                setTimeout(() => this.openMenuScreen(), 2000);
            }, 500);
        });
    }
    
    play() {
        if (!this.isAlive) return;
        
        this.showToy();
        this.lastInteraction = Date.now();
        
        this.elements.petSprite.classList.add('excited');
        this.showCustomMessage("Ball! Ball!", "#FFA500");
        
        setTimeout(() => {
            this.elements.petSprite.classList.remove('excited');
            
            this.moveToTarget(this.elements.toyItem, () => {
                this.showAction('playing');
                this.createPlayEffect();
                this.showCustomMessage("Got it!", "#00FF00");
                
                setTimeout(() => {
                    this.stats.happiness = Math.min(100, this.stats.happiness + 30);
                    this.stats.health = Math.min(100, this.stats.health + 10);
                    this.stats.hunger = Math.max(0, this.stats.hunger - 5);
                    
                    this.hideToy();
                    this.reactToInteraction('play');
                    this.updateDisplay();
                    this.showCustomMessage("+30 Happy!", "#ffff00");
                    
                    if (Math.random() > 0.5) {
                        setTimeout(() => {
                            this.elements.petSprite.style.animation = 'bounce 0.8s';
                            setTimeout(() => this.resetAnimation(), 800);
                        }, 500);
                    }
                    setTimeout(() => this.openMenuScreen(), 2000);
                }, 1000);
            });
        }, 500);
    }
    
    clean() {
        if (!this.isAlive) return;
        
        this.lastInteraction = Date.now();
        
        if (this.poopCount > 0) {
            this.elements.poopItem.style.display = 'none';
            this.poopCount = 0;
            this.cleanliness = 100;
            this.stats.health = Math.min(100, this.stats.health + 15);
            this.stats.happiness = Math.min(100, this.stats.happiness + 10);
            
            this.showAction('relieved');
            this.createCleanEffect();
            this.showCustomMessage("+30 Clean!", "#00ff00");
            
            setTimeout(() => {
                this.reactToInteraction('clean');
                this.updateDisplay();
                setTimeout(() => this.openMenuScreen(), 1500);
            }, 800);
        } else {
            this.showCustomMessage("Already clean!", "#87CEEB");
            setTimeout(() => this.openMenuScreen(), 1000);
        }
    }
    
    giveMedicine() {
        if (!this.isAlive) return;
        
        this.stats.health = Math.min(100, this.stats.health + 30);
        this.stats.temperature = 50; // Normalize temperature
        this.showCustomMessage("Medicine +30 Health!", "#ff69b4");
        this.showAction('relieved');
        this.updateDisplay();
        setTimeout(() => this.openMenuScreen(), 1500);
    }
    
    discipline() {
        if (!this.isAlive) return;
        
        this.stats.discipline = Math.min(100, this.stats.discipline + 20);
        this.misbehavior = Math.max(0, this.misbehavior - 30);
        this.showCustomMessage("Discipline +20", "#ffa500");
        this.showAction('blink');
        this.updateDisplay();
        setTimeout(() => this.openMenuScreen(), 1500);
    }
    
    toggleLights() {
        this.hasLights = !this.hasLights;
        
        if (this.hasLights) {
            this.elements.screen.classList.remove('night-mode');
            const lightBtn = document.getElementById('light-menu-btn');
            if (lightBtn) {
                const icon = lightBtn.querySelector('.menu-icon');
                if (icon) icon.textContent = '💡';
            }
            this.showCustomMessage("Lights ON! 💡", "#FFFF00");
        } else {
            this.elements.screen.classList.add('night-mode');
            const lightBtn = document.getElementById('light-menu-btn');
            if (lightBtn) {
                const icon = lightBtn.querySelector('.menu-icon');
                if (icon) icon.textContent = '🌙';
            }
            this.showCustomMessage("Lights OFF! 🌙", "#87CEEB");
        }
        
        setTimeout(() => this.openMenuScreen(), 1500);
    }
    
    toggleStatusScreen() {
        this.elements.menuScreen.style.display = 'none';
        this.elements.miniGame.style.display = 'none';
        this.menu.isOpen = false;
        
        if (this.elements.statusScreen.style.display === 'none' || !this.elements.statusScreen.style.display) {
            this.elements.statusScreen.style.display = 'flex';
            
            // Update status screen details
            if (this.elements.evolutionLevel) this.elements.evolutionLevel.textContent = this.evolutionStage;
            if (this.elements.disciplineLevel) this.elements.disciplineLevel.textContent = this.stats.discipline;
            if (this.elements.energyLevel) this.elements.energyLevel.textContent = this.stats.energy;
            if (this.elements.maxAge) this.elements.maxAge.textContent = this.maxAge;
            
            this.showCustomMessage("Status Updated! 📊", "#00FFFF");
        }
    }
    
    startMiniGame() {
        this.elements.menuScreen.style.display = 'none';
        this.elements.statusScreen.style.display = 'none';
        this.menu.isOpen = false;
        
        this.elements.miniGame.style.display = 'block';
        
        // Setup memory game
        const emojis = ['🍎', '🍕', '🍦', '🍩', '🥕', '🌮', '🍇', '🍓'];
        let gameEmojis = [...emojis.slice(0, 4), ...emojis.slice(0, 4)];
        gameEmojis.sort(() => Math.random() - 0.5);
        
        this.elements.gameGrid.innerHTML = '';
        
        gameEmojis.forEach(emoji => {
            const card = document.createElement('div');
            card.className = 'memory-card';
            card.dataset.value = emoji;
            card.textContent = '?';
            card.addEventListener('click', () => this.flipCard(card));
            this.elements.gameGrid.appendChild(card);
        });
        
        this.gameState = {
            flippedCards: [],
            matchedPairs: 0,
            totalPairs: 4,
            canFlip: true
        };
    }
    
    closeMiniGame() {
        this.elements.miniGame.style.display = 'none';
        this.openMenuScreen();
    }
    
    flipCard(card) {
        if (!this.gameState.canFlip || card.classList.contains('flipped')) return;
        
        card.classList.add('flipped');
        card.textContent = card.dataset.value;
        this.gameState.flippedCards.push(card);
        
        if (this.gameState.flippedCards.length === 2) {
            this.gameState.canFlip = false;
            
            const [card1, card2] = this.gameState.flippedCards;
            
            if (card1.dataset.value === card2.dataset.value) {
                this.gameState.matchedPairs++;
                this.gameState.flippedCards = [];
                this.gameState.canFlip = true;
                
                if (this.gameState.matchedPairs === this.gameState.totalPairs) {
                    this.stats.happiness = Math.min(100, this.stats.happiness + 20);
                    this.updateDisplay();
                    setTimeout(() => this.closeMiniGame(), 1000);
                }
            } else {
                setTimeout(() => {
                    card1.classList.remove('flipped');
                    card2.classList.remove('flipped');
                    card1.textContent = '?';
                    card2.textContent = '?';
                    this.gameState.flippedCards = [];
                    this.gameState.canFlip = true;
                }, 1000);
            }
        }
    }
    
    toggleSkin() {
        const skins = ['tamagotchi.png', 'tamagotchi_red.png', 'tamagotchi_blue.png', 'tamagotchi_pink.png', 'tamagotchi_purple.png'];
        const currentIndex = skins.indexOf(this.currentSkin);
        const nextIndex = (currentIndex + 1) % skins.length;
        this.currentSkin = skins[nextIndex];
        
        const shell = document.querySelector('.tamagotchi-shell');
        if (shell) {
            shell.style.backgroundImage = `url('${this.currentSkin}')`;
        }
        
        this.showCustomMessage("Color Changed! 🎨", "#ff69b4");
        setTimeout(() => this.openMenuScreen(), 1500);
    }
    
    // Utility methods
    showFood() {
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        this.elements.foodItem.style.left = x + '%';
        this.elements.foodItem.style.top = y + '%';
        this.elements.foodItem.style.display = 'block';
    }
    
    hideFood() {
        this.elements.foodItem.style.display = 'none';
    }
    
    showToy() {
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        this.elements.toyItem.style.left = x + '%';
        this.elements.toyItem.style.top = y + '%';
        this.elements.toyItem.style.display = 'block';
        this.elements.toyItem.classList.add('toy-bounce');
    }
    
    hideToy() {
        this.elements.toyItem.style.display = 'none';
        this.elements.toyItem.classList.remove('toy-bounce');
    }
    
    showPoop() {
        const x = Math.random() * 80 + 10;
        const y = Math.random() * 80 + 10;
        this.elements.poopItem.style.left = x + '%';
        this.elements.poopItem.style.top = y + '%';
        this.elements.poopItem.style.display = 'block';
        this.poopCount++;
    }
    
    showCustomMessage(text, color) {
        const message = document.createElement('div');
        message.textContent = text;
        message.style.position = 'absolute';
        message.style.color = color;
        message.style.fontSize = '8px';
        message.style.fontWeight = 'bold';
        message.style.left = '50%';
        message.style.top = '20px';
        message.style.transform = 'translateX(-50%)';
        message.style.animation = 'float-up 1s ease-out forwards';
        message.style.pointerEvents = 'none';
        message.style.zIndex = '20';
        
        this.elements.petArea.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 1000);
    }
    
    playSound(type) {
        // Simple sound implementation
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            
            oscillator.type = 'sine';
            gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
            
            switch (type) {
                case 'ui':
                    oscillator.frequency.setValueAtTime(660, audioCtx.currentTime);
                    break;
                default:
                    oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
            }
            
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.start();
            oscillator.stop(audioCtx.currentTime + 0.1);
            
            setTimeout(() => audioCtx.close(), 200);
        } catch (e) {
            // Silent fail for audio
        }
    }
    
    showAction(action) {
        this.elements.petSprite.className = `pet-sprite ${action}`;
        setTimeout(() => this.resetAnimation(), 1000);
    }
    
    resetAnimation() {
        this.elements.petSprite.className = 'pet-sprite';
        this.elements.petSprite.style.animation = '';
    }
    
    createEatingEffect() {
        // Simple visual effect
        this.elements.petSprite.style.filter = 'brightness(1.2)';
        setTimeout(() => {
            this.elements.petSprite.style.filter = '';
        }, 500);
    }
    
    createPlayEffect() {
        // Simple visual effect
        this.elements.petSprite.style.transform = 'scale(1.1)';
        setTimeout(() => {
            this.elements.petSprite.style.transform = '';
        }, 500);
    }
    
    createCleanEffect() {
        // Simple visual effect
        this.elements.petSprite.style.filter = 'brightness(1.3)';
        setTimeout(() => {
            this.elements.petSprite.style.filter = '';
        }, 500);
    }
    
    moveToTarget(target, callback) {
        this.isMoving = true;
        this.elements.petSprite.classList.add('walking');
        
        setTimeout(() => {
            this.isMoving = false;
            this.elements.petSprite.classList.remove('walking');
            this.resetAnimation();
            if (callback) callback();
        }, 500);
    }
    
    reactToInteraction(type) {
        switch (type) {
            case 'feed':
                this.mood = 'happy';
                this.elements.moodIndicator.textContent = this.moodSymbols.happy;
                break;
            case 'play':
                this.mood = 'happy';
                this.elements.moodIndicator.textContent = this.moodSymbols.happy;
                break;
            case 'clean':
                this.mood = 'happy';
                this.elements.moodIndicator.textContent = this.moodSymbols.happy;
                break;
        }
    }
    
    updateDisplay() {
        // Update stat bars
        this.elements.healthBar.style.width = `${this.stats.health}%`;
        this.elements.hungerBar.style.width = `${this.stats.hunger}%`;
        this.elements.happinessBar.style.width = `${this.stats.happiness}%`;
        if (this.elements.tempBar) this.elements.tempBar.style.width = `${this.stats.temperature}%`;
        
        // Update displays
        this.elements.ageDisplay.textContent = this.age;
        if (this.elements.weightDisplay) this.elements.weightDisplay.textContent = this.weight;
        
        // Update mood
        this.elements.moodIndicator.textContent = this.moodSymbols[this.mood];
        
        // Update stat bar colors based on levels
        this.updateStatColors();
    }
    
    updateStatColors() {
        const bars = [
            { element: this.elements.healthBar, value: this.stats.health },
            { element: this.elements.hungerBar, value: this.stats.hunger },
            { element: this.elements.happinessBar, value: this.stats.happiness }
        ];
        
        bars.forEach(bar => {
            bar.element.classList.remove('low', 'critical');
            if (bar.value < 30) {
                bar.element.classList.add('critical');
            } else if (bar.value < 50) {
                bar.element.classList.add('low');
            }
        });
    }
    
    gameLoop() {
        setInterval(() => {
            if (!this.isAlive) return;
            
            const now = Date.now();
            
            // Decrease stats over time
            if (now - this.lastUpdate > 30000) { // Every 30 seconds
                this.stats.hunger = Math.max(0, this.stats.hunger - 2);
                this.stats.happiness = Math.max(0, this.stats.happiness - 1);
                this.stats.energy = Math.max(0, this.stats.energy - 1);
                
                // Random poop generation
                if (Math.random() > 0.8 && this.poopCount === 0) {
                    this.showPoop();
                }
                
                this.updateMood();
                this.updateDisplay();
                this.lastUpdate = now;
            }
            
            // Check if pet dies
            if (this.stats.health <= 0) {
                this.die();
            }
        }, 1000);
    }
    
    ageTimer() {
        setInterval(() => {
            if (!this.isAlive) return;
            this.age++;
            this.updateDisplay();
        }, 60000); // Age every minute for testing
    }
    
    movementLoop() {
        setInterval(() => {
            if (!this.isAlive || this.isMoving || this.isSleeping) return;
            
            if (Math.random() > 0.7) {
                this.randomMovement();
            }
        }, 3000);
    }
    
    randomMovement() {
        const currentX = parseFloat(this.elements.petSprite.style.left) || 50;
        const currentY = parseFloat(this.elements.petSprite.style.top) || 50;
        
        const newX = Math.max(10, Math.min(90, currentX + (Math.random() - 0.5) * 20));
        const newY = Math.max(10, Math.min(90, currentY + (Math.random() - 0.5) * 20));
        
        this.elements.petSprite.style.left = newX + '%';
        this.elements.petSprite.style.top = newY + '%';
        
        this.showAction('walking');
    }
    
    updateMood() {
        if (this.stats.health < 30 || this.stats.hunger < 30) {
            this.mood = 'sick';
        } else if (this.stats.happiness < 30) {
            this.mood = 'sad';
        } else if (this.poopCount > 0) {
            this.mood = 'dirty';
        } else {
            this.mood = 'happy';
        }
        
        this.elements.moodIndicator.textContent = this.moodSymbols[this.mood];
    }
    
    die() {
        this.isAlive = false;
        this.mood = 'dead';
        this.elements.petSprite.classList.add('dead');
        this.elements.moodIndicator.textContent = this.moodSymbols.dead;
        this.elements.gameOver.style.display = 'block';
        this.elements.menuScreen.style.display = 'none';
        this.menu.isOpen = false;
    }
    
    restart() {
        this.isAlive = true;
        this.age = 0;
        this.weight = 5;
        this.stats = { health: 100, hunger: 100, happiness: 100, discipline: 50, temperature: 50, energy: 100 };
        this.mood = 'happy';
        this.poopCount = 0;
        this.cleanliness = 100;
        this.elements.petSprite.classList.remove('dead');
        this.elements.gameOver.style.display = 'none';
        this.elements.poopItem.style.display = 'none';
        this.updateDisplay();
        this.openMenuScreen();
    }
}

// Initialize the game
const tamagotchi = new Tamagotchi();
