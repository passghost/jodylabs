class Calfagotchi {
    constructor() {
        this.stats = {
            health: 100,
            hunger: 100,
            happiness: 100,
            temperature: 70,
            discipline: 0,
            energy: 100
        };
        this.age = 0;
        this.weight = 5;
        this.mood = 'happy';
        this.isAlive = true;
        this.lastUpdate = Date.now();
        this.position = { x: 50, y: 50 }; // Percentage position
        this.isMoving = false;
        this.targetPosition = null;
        this.cleanliness = 100;
        this.poopCount = 0;
        this.lastPoop = Date.now();
        this.direction = 1; // 1 for right, -1 for left
        this.lastRandomMove = Date.now();
        this.lastInteraction = Date.now();
        this.lastEmotionChange = Date.now();
        this.activeAnimation = null;
        this.currentSkin = 'default'; // Track the current skin
        this.idleVariations = ['idle', 'blink', 'yawn', 'stretch']; // Different idle animations
        this.lastIdleChange = Date.now();
        this.emotionalState = 'neutral'; // Track emotional expressions
        this.sleepStartTime = null; // Track when sleep started
        this.sleepDuration = 0; // How long to sleep for
        this.isSleeping = false; // Flag to track sleep state
        this.lightsOn = true;
        this.evolutionLevel = 'Baby';
        this.maxAge = 30;
        
        // Menu system
        this.menuOpen = false;
        this.currentMenuIndex = 0;
        this.menuItems = ['feed', 'play', 'clean', 'medicine', 'discipline', 'light', 'status', 'game', 'screen-color', 'skin', 'god', 'jodylabs', 'support'];
        this.currentScreen = 'main'; // 'main', 'menu', 'status', 'game'
        
        // Initialize DOM elements
        this.elements = {
            petSprite: document.getElementById('pet-sprite'),
            healthBar: document.getElementById('health-bar'),
            hungerBar: document.getElementById('hunger-bar'),
            happinessBar: document.getElementById('happiness-bar'),
            tempBar: document.getElementById('temp-bar'),
            peePuddle: document.getElementById('pee-puddle'),
            moodIndicator: document.getElementById('mood-indicator'),
            ageDisplay: document.getElementById('age'),
            weightDisplay: document.getElementById('weight'),
            gameOver: document.getElementById('game-over'),
            feedBtn: document.getElementById('feed-btn'),
            playBtn: document.getElementById('play-btn'),
            cleanBtn: document.getElementById('clean-btn'),
            restartBtn: document.getElementById('restart-btn'),
            foodItem: document.getElementById('food-item'),
            toyItem: document.getElementById('toy-item'),
            poopItem: document.getElementById('poop-item'),
            sleepBubble: document.getElementById('sleep-bubble'),
            petArea: document.querySelector('.pet-area'),
            menuScreen: document.getElementById('menu-screen'),
            statusScreen: document.getElementById('status-screen'),
            miniGame: document.getElementById('mini-game'),
            menuSelector: document.getElementById('menu-selector'),
            evolutionLevel: document.getElementById('evolution-level'),
            disciplineLevel: document.getElementById('discipline-level'),
            energyLevel: document.getElementById('energy-level'),
            maxAgeDisplay: document.getElementById('max-age')
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
        
        // Movement patterns for different moods
        this.movementPatterns = {
            happy: {
                speed: 2000, // Milliseconds between potential moves
                chance: 0.6, // 60% chance to move when checked
                animation: 'walking',
                duration: [300, 800] // Random duration range
            },
            sad: {
                speed: 4000,
                chance: 0.3,
                animation: 'walking',
                duration: [500, 1000]
            },
            angry: {
                speed: 1000,
                chance: 0.8,
                animation: 'walking',
                duration: [200, 500]
            },
            sick: {
                speed: 6000,
                chance: 0.2,
                animation: 'walking',
                duration: [800, 1200]
            },
            sleeping: {
                speed: 15000,
                chance: 0.01,  // Rarely moves while sleeping
                animation: 'walking',
                duration: [2000, 3000]  // Slower, gentle movements
            },
            dirty: {
                speed: 3000,
                chance: 0.4,
                animation: 'walking',
                duration: [400, 900]
            }
        };
        
        this.init();
    }
    
    init() {
        // Set up button event listeners for menu navigation
        this.setupEventHandlers();
        
        // Start the game loop
        this.gameLoop();
        this.ageTimer();
        this.movementLoop();
        this.updateDisplay();
        this.updateMenuSelector();
    }
    
    setupEventHandlers() {
        // UP button (feed-btn)
        this.elements.feedBtn.addEventListener('click', () => {
            if (this.currentScreen === 'main') {
                this.openMenu();
            } else if (this.currentScreen === 'menu') {
                this.navigateMenu('up');
            } else if (this.currentScreen === 'status' || this.currentScreen === 'game') {
                this.closeCurrentScreen();
            }
        });
        
        // SELECT button (play-btn)
        this.elements.playBtn.addEventListener('click', () => {
            if (this.currentScreen === 'main') {
                this.openMenu();
            } else if (this.currentScreen === 'menu') {
                this.selectMenuItem();
            } else if (this.currentScreen === 'status' || this.currentScreen === 'game') {
                this.closeCurrentScreen();
            }
        });
        
        // DOWN button (clean-btn)
        this.elements.cleanBtn.addEventListener('click', () => {
            if (this.currentScreen === 'main') {
                this.openMenu();
            } else if (this.currentScreen === 'menu') {
                this.navigateMenu('down');
            } else if (this.currentScreen === 'status' || this.currentScreen === 'game') {
                this.closeCurrentScreen();
            }
        });
        
        // Restart button
        this.elements.restartBtn.addEventListener('click', () => {
            this.restart();
        });
    }
    
    openMenu() {
        this.currentScreen = 'menu';
        this.elements.menuScreen.style.display = 'block';
        this.updateMenuSelector();
    }
    
    closeCurrentScreen() {
        this.currentScreen = 'main';
        this.elements.menuScreen.style.display = 'none';
        this.elements.statusScreen.style.display = 'none';
        this.elements.miniGame.style.display = 'none';
    }
    
    navigateMenu(direction) {
        if (direction === 'up') {
            this.currentMenuIndex = (this.currentMenuIndex - 1 + this.menuItems.length) % this.menuItems.length;
        } else if (direction === 'down') {
            this.currentMenuIndex = (this.currentMenuIndex + 1) % this.menuItems.length;
        }
        this.updateMenuSelector();
    }
    
    updateMenuSelector() {
        const menuButtons = document.querySelectorAll('.menu-item');
        const menuContainer = document.querySelector('.menu-buttons');
        
        // Update selected state for all buttons
        menuButtons.forEach((button, index) => {
            button.classList.toggle('selected', index === this.currentMenuIndex);
        });
        
        // Auto-scroll to keep the selected item in view
        if (menuButtons[this.currentMenuIndex]) {
            const selectedButton = menuButtons[this.currentMenuIndex];
            const containerHeight = menuContainer.offsetHeight;
            const buttonTop = selectedButton.offsetTop;
            const buttonHeight = selectedButton.offsetHeight;
            
            // Calculate scroll position to center the selected button
            const targetScrollTop = buttonTop - (containerHeight / 2) + (buttonHeight / 2);
            
            // Apply smooth scrolling
            menuContainer.scrollTo({
                top: Math.max(0, targetScrollTop),
                behavior: 'smooth'
            });
        }
    }
    
    selectMenuItem() {
        const selectedAction = this.menuItems[this.currentMenuIndex];
        
        switch (selectedAction) {
            case 'feed':
                this.closeCurrentScreen();
                this.feed();
                break;
            case 'play':
                this.closeCurrentScreen();
                this.play();
                break;
            case 'clean':
                this.closeCurrentScreen();
                this.clean();
                break;
            case 'medicine':
                this.closeCurrentScreen();
                this.giveMedicine();
                break;
            case 'discipline':
                this.closeCurrentScreen();
                this.discipline();
                break;
            case 'light':
                this.closeCurrentScreen();
                this.toggleLight();
                break;
            case 'status':
                this.showStatus();
                break;
            case 'game':
                this.showMiniGame();
                break;
            case 'screen-color':
                this.closeCurrentScreen();
                this.cycleScreenColor();
                break;
            case 'skin':
                this.closeCurrentScreen();
                this.cycleSkin();
                break;
            case 'god':
                this.closeCurrentScreen();
                this.godPower();
                break;
            case 'jodylabs':
                window.location.href = '/index.html';
                break;
            case 'support':
                window.open('https://www.paypal.com/donate/?business=TE5MW5QV6RRCS&no_recurring=1&item_name=Donations+encouraged%2C+but+of+course+not+expected.+Thanks+for+visiting!&currency_code=USD', '_blank');
                break;
        }
    }
    
    feed() {
        if (!this.isAlive) return;
        
        // Wake up if sleeping
        if (this.isSleeping) {
            this.wakeUp();
            return;
        }
        
        // Show food item
        this.showFood();
        this.lastInteraction = Date.now();
        
        // Pet moves to food
        this.moveToTarget(this.elements.foodItem, () => {
            // Show eating animation
            this.showAction('eating');
            
            // Create eating effect
            this.createEatingEffect();
            
            // Update stats with visual feedback
            setTimeout(() => {
                this.stats.hunger = Math.min(100, this.stats.hunger + 25);
                this.stats.health = Math.min(100, this.stats.health + 5);
                this.hideFood();
                this.reactToInteraction('feed');
                this.updateDisplay();
                
                // Show stat increase visual effect
                this.showStatChangeEffect('hunger', 25);
                this.showStatChangeEffect('health', 5);
            }, 500);
        });
    }
    
    play() {
        if (!this.isAlive) return;
        
        // Wake up if sleeping
        if (this.isSleeping) {
            this.wakeUp();
            return;
        }
        
        // Show toy item
        this.showToy();
        this.lastInteraction = Date.now();
        
        // Pet moves to toy
        this.moveToTarget(this.elements.toyItem, () => {
            // Show playing animation
            this.showAction('playing');
            
            // Create play effect
            this.createPlayEffect();
            
            setTimeout(() => {
                this.stats.happiness = Math.min(100, this.stats.happiness + 30);
                this.stats.health = Math.min(100, this.stats.health + 10);
                this.stats.hunger = Math.max(0, this.stats.hunger - 5);
                
                // Display the happy action after playing
                this.hideToy();
                this.reactToInteraction('play');
                this.updateDisplay();
                
                // Show stat change visual effects
                this.showStatChangeEffect('happiness', 30);
                this.showStatChangeEffect('health', 10);
                this.showStatChangeEffect('hunger', -5);
                
                // Occasional bounce after playing
                if (Math.random() > 0.5) {
                    setTimeout(() => {
                        this.elements.petSprite.style.animation = 'bounce 0.8s';
                        setTimeout(() => {
                            this.resetAnimation();
                        }, 800);
                    }, 500);
                }
            }, 1000);
        });
    }
    
    clean() {
        if (!this.isAlive) return;
        
        // Wake up if sleeping
        if (this.isSleeping) {
            this.wakeUp();
            return;
        }
        
        this.lastInteraction = Date.now();
        
        // Create cleaning visual effect
        this.createCleaningEffect();
        
        // Check if there's poop to clean
        if (this.poopCount > 0) {
            // Animate the poop disappearing
            const poopItem = this.elements.poopItem;
            poopItem.style.animation = 'none';
            void poopItem.offsetWidth; // Force reflow
            poopItem.style.animation = 'poop-appear 0.5s reverse forwards';
            
            setTimeout(() => {
                this.poopCount--;
                this.cleanliness = Math.min(100, this.cleanliness + 30);
                this.hidePoop();
                
                // Show cleanliness improvement
                this.showCustomMessage("+30 Clean!", "#00ff00");
            }, 500);
        }
        
        setTimeout(() => {
            this.stats.health = Math.min(100, this.stats.health + 20);
            this.stats.happiness = Math.min(100, this.stats.happiness + 10);
            
            this.reactToInteraction('clean');
            this.updateDisplay();
            
            // Show stat change visual effects
            this.showStatChangeEffect('health', 20);
            this.showStatChangeEffect('happiness', 10);
        }, 800);
    }
    
    showFood() {
        // Position food randomly as percentage
        const x = Math.random() * 80 + 10; // 10% to 90% of width
        const y = Math.random() * 80 + 10; // 10% to 90% of height
        
        this.elements.foodItem.style.left = x + '%';
        this.elements.foodItem.style.top = y + '%';
        this.elements.foodItem.style.display = 'block';
    }
    
    hideFood() {
        this.elements.foodItem.style.display = 'none';
    }
    
    showToy() {
        // Position toy randomly as percentage
        const x = Math.random() * 80 + 10; // 10% to 90% of width
        const y = Math.random() * 80 + 10; // 10% to 90% of height
        
        this.elements.toyItem.style.left = x + '%';
        this.elements.toyItem.style.top = y + '%';
        this.elements.toyItem.style.display = 'block';
    }
    
    hideToy() {
        this.elements.toyItem.style.display = 'none';
    }
    
    showPoop() {
        // Position poop randomly as percentage
        const x = Math.random() * 80 + 10; // 10% to 90% of width
        const y = Math.random() * 80 + 10; // 10% to 90% of height
        
        this.elements.poopItem.style.left = x + '%';
        this.elements.poopItem.style.top = y + '%';
        this.elements.poopItem.style.display = 'block';
        this.elements.poopItem.style.animation = 'none';
        void this.elements.poopItem.offsetWidth; // Force reflow
        this.elements.poopItem.style.animation = 'poop-appear 0.5s forwards';
    }
    
    hidePoop() {
        this.elements.poopItem.style.display = 'none';
    }
    
    showPeePuddle() {
        // Position pee puddle randomly as percentage
        const x = Math.random() * 80 + 10; // 10% to 90% of width
        const y = Math.random() * 80 + 10; // 10% to 90% of height
        
        this.elements.peePuddle.style.left = x + '%';
        this.elements.peePuddle.style.top = y + '%';
        this.elements.peePuddle.style.display = 'block';
        this.elements.peePuddle.style.animation = 'none';
        void this.elements.peePuddle.offsetWidth; // Force reflow
        this.elements.peePuddle.style.animation = 'poop-appear 0.5s forwards';
    }
    
    hidePeePuddle() {
        this.elements.peePuddle.style.display = 'none';
    }
    
    defecate() {
        if (!this.isAlive || this.poopCount >= 3 || this.isSleeping) return;
        
        this.poopCount++;
        this.cleanliness = Math.max(0, this.cleanliness - 25);
        this.lastPoop = Date.now();
        this.showPoop();
        
        // Pet becomes sad when pooping
        this.showAction('sad');
        setTimeout(() => {
            this.updateDisplay();
        }, 1000);
    }
    
    moveToTarget(targetElement, callback) {
        if (this.isMoving) return;
        
        this.isMoving = true;
        this.elements.petSprite.classList.add('walking');
        
        const petArea = this.elements.petArea;
        const targetRect = targetElement.getBoundingClientRect();
        const areaRect = petArea.getBoundingClientRect();
        
        // Calculate target position as percentage of pet area
        let targetX = ((targetRect.left - areaRect.left + targetRect.width / 2) / areaRect.width) * 100;
        let targetY = ((targetRect.top - areaRect.top + targetRect.height / 2) / areaRect.height) * 100;
        
        // Apply bounds (keep within 10% to 90% of the area)
        targetX = Math.min(90, Math.max(10, targetX));
        targetY = Math.min(90, Math.max(10, targetY));
        
        // Set direction based on movement
        const currentX = parseFloat(this.elements.petSprite.style.left) || 50;
        if (targetX > currentX) {
            // Moving right
            this.direction = 1;
            this.elements.petSprite.style.transform = 'translate(-50%, -50%) scaleX(1)';
        } else {
            // Moving left
            this.direction = -1;
            this.elements.petSprite.style.transform = 'translate(-50%, -50%) scaleX(-1)';
        }
        
        // Move pet to target with improved animation
        this.elements.petSprite.style.left = targetX + '%';
        this.elements.petSprite.style.top = targetY + '%';
        
        // Movement sound based on mood
        if (this.mood === 'happy') {
            soundManager.playTone(660, 0.1, 0.05);
        } else if (this.mood === 'sad') {
            soundManager.playTone(440, 0.1, 0.05);
        }
        
        // Random chance to stop midway and then continue (more lifelike)
        if (Math.random() > 0.7) {
            setTimeout(() => {
                this.elements.petSprite.style.transition = 'none';
                setTimeout(() => {
                    this.elements.petSprite.style.transition = 'left 0.5s ease, top 0.5s ease';
                    setTimeout(() => {
                        if (callback) callback();
                        this.isMoving = false;
                        this.elements.petSprite.classList.remove('walking');
                        this.resetAnimation();
                    }, 500);
                }, 200);
            }, 250);
        } else {
            // Normal completion
            setTimeout(() => {
                this.isMoving = false;
                this.elements.petSprite.classList.remove('walking');
                this.resetAnimation();
                if (callback) callback();
            }, 500);
        }
    }
    
    randomMovement() {
        if (this.isMoving || !this.isAlive || this.isSleeping) return;
        
        const now = Date.now();
        const moodPattern = this.movementPatterns[this.mood];
        
        // Check if enough time has passed since last move based on mood
        if (now - this.lastRandomMove < moodPattern.speed) return;
        
        // Random chance to move based on mood
        if (Math.random() > moodPattern.chance) return;
        
        // Current position as percentage
        const currentX = parseFloat(this.elements.petSprite.style.left) || 50;
        const currentY = parseFloat(this.elements.petSprite.style.top) || 50;
        
        // Generate new position with more natural movement patterns based on mood
        let newX, newY;
        
        if (this.mood === 'angry') {
            // More erratic movements for angry
            newX = currentX + (Math.random() * 30 - 15);
            newY = currentY + (Math.random() * 30 - 15);
        } else if (this.mood === 'sad') {
            // Smaller movements for sad
            newX = currentX + (Math.random() * 15 - 7.5);
            newY = currentY + (Math.random() * 10 - 5);
        } else if (this.mood === 'happy') {
            // Wider movements for happy
            newX = Math.random() * 80 + 10;
            newY = Math.random() * 80 + 10;
        } else {
            // Default movement
            newX = currentX + (Math.random() * 20 - 10);
            newY = currentY + (Math.random() * 20 - 10);
        }
        
        // Apply bounds (keep within 10% to 90% of the area)
        newX = Math.min(90, Math.max(10, newX));
        newY = Math.min(90, Math.max(10, newY));
        
        // Set direction based on movement
        if (newX > currentX) {
            this.direction = 1;
            this.elements.petSprite.style.transform = 'translate(-50%, -50%) scaleX(1)';
        } else {
            this.direction = -1;
            this.elements.petSprite.style.transform = 'translate(-50%, -50%) scaleX(-1)';
        }
        
        this.isMoving = true;
        this.elements.petSprite.classList.add(moodPattern.animation);
        this.lastRandomMove = now;
        
        // Set the new position
        this.elements.petSprite.style.left = newX + '%';
        this.elements.petSprite.style.top = newY + '%';
        
        // Random duration within the range for this mood
        const duration = Math.random() * (moodPattern.duration[1] - moodPattern.duration[0]) + moodPattern.duration[0];
        
        setTimeout(() => {
            this.isMoving = false;
            this.elements.petSprite.classList.remove(moodPattern.animation);
            this.resetAnimation();
            
            // Chance for additional action after movement
            if (Math.random() > 0.8) {
                this.doRandomAction();
            }
        }, duration);
    }
    
    showAction(emotion) {
        if (this.isSleeping) return; // No actions while sleeping
        
        this.elements.petSprite.className = `pet-sprite ${emotion}`;
        setTimeout(() => {
            // Return to sleeping animation if still sleeping
            if (this.isSleeping) {
                this.elements.petSprite.className = 'pet-sprite sleeping';
            } else {
                this.elements.petSprite.className = 'pet-sprite';
            }
        }, 1000);
    }
    
    // Dynamic idle animations
    changeIdleAnimation() {
        if (!this.isAlive || this.isMoving || this.isSleeping) return;
        
        const now = Date.now();
        if (now - this.lastIdleChange < 3000) return; // Change every 3 seconds
        
        const variations = this.idleVariations;
        const currentAnimation = variations[Math.floor(Math.random() * variations.length)];
        
        this.elements.petSprite.style.animation = `${currentAnimation} 2s infinite ease-in-out`;
        this.lastIdleChange = now;
        
        // Occasionally show emotion during idle
        if (Math.random() > 0.7) {
            setTimeout(() => {
                this.showRandomEmotion();
            }, 1000);
        }
    }
    
    showRandomEmotion() {
        if (!this.isAlive || this.isMoving) return;
        
        const emotions = ['happy', 'blink', 'yawn'];
        if (this.stats.happiness < 50) emotions.push('sad');
        if (this.stats.hunger < 30) emotions.push('hungry');
        if (this.cleanliness < 50) emotions.push('dirty');
        
        const emotion = emotions[Math.floor(Math.random() * emotions.length)];
        this.showAction(emotion);
    }
    
    // Make pet react to interactions with more personality
    reactToInteraction(type) {
        // No reactions while sleeping
        if (this.isSleeping) return;
        
        const reactions = {
            'feed': ['happy', 'excited', 'bounce'],
            'play': ['happy', 'excited', 'bounce', 'spin'],
            'clean': ['happy', 'relieved']
        };
        
        if (reactions[type]) {
            const reaction = reactions[type][Math.floor(Math.random() * reactions[type].length)];
            setTimeout(() => {
                this.showAction(reaction);
            }, 200);
        }
    }
    
    // Make the pet express its current emotional state
    expressCurrentMood() {
        if (!this.isAlive || this.isMoving || this.isSleeping) return;
        
        const now = Date.now();
        if (now - this.lastEmotionChange < 5000) return; // Don't overwhelm with emotions
        
        this.lastEmotionChange = now;
        
        // Express emotions based on current stats and conditions
        if (this.stats.hunger < 20) {
            this.showAction('hungry');
            this.showCustomMessage("I'm hungry!", "#ffaa00");
        } else if (this.cleanliness < 30) {
            this.showAction('dirty');
            this.showCustomMessage("I need cleaning!", "#8B4513");
        } else if (this.stats.happiness > 80 && this.stats.health > 80) {
            this.showAction('excited');
            this.showCustomMessage("I'm so happy!", "#ffff00");
        } else if (this.stats.happiness < 30) {
            this.showAction('sad');
        } else if (this.stats.health < 30) {
            this.showAction('sick');
        } else if (Math.random() > 0.7) {
            // Random happy expressions when content
            const expressions = ['blink', 'yawn', 'stretch'];
            const expression = expressions[Math.floor(Math.random() * expressions.length)];
            this.showAction(expression);
        }
    }
    
    updateMood() {
        const avg = (this.stats.health + this.stats.hunger + this.stats.happiness) / 3;
        const now = Date.now();
        
        if (!this.isAlive) {
            this.mood = 'dead';
            this.isSleeping = false;
        } else if (this.isSleeping) {
            // Pet continues sleeping until interaction
            this.mood = 'sleeping';
            return;
        }
        
        if (this.cleanliness < 30 || this.poopCount > 1) {
            this.mood = 'dirty';
        } else if (avg >= 80) {
            this.mood = 'happy';
        } else if (avg >= 60) {
            this.mood = 'sad';
        } else if (avg >= 30) {
            this.mood = 'angry';
        } else {
            this.mood = 'sick';
        }
        
        // Random sleeping when stats are decent and clean (longer duration)
        if (!this.isSleeping && Math.random() < 0.02 && this.isAlive && avg > 50 && this.cleanliness > 60) {                
            this.isSleeping = true;
            this.sleepStartTime = now;
            // No auto wakeup - will only wake on user interaction
            this.mood = 'sleeping';
            this.showCustomMessage("Getting sleepy... 💤", "#87CEEB");
            
            // Show sleep animation and bubble
            this.elements.petSprite.className = 'pet-sprite sleeping';
            this.elements.sleepBubble.style.display = 'block';
        }
    }
    
    updateDisplay() {
        // Update stat bars
        this.elements.healthBar.style.width = `${this.stats.health}%`;
        this.elements.hungerBar.style.width = `${this.stats.hunger}%`;
        this.elements.happinessBar.style.width = `${this.stats.happiness}%`;
        
        // Update temperature bar if it exists
        if (this.elements.tempBar) {
            this.elements.tempBar.style.width = `${this.stats.temperature}%`;
            this.updateStatBarColor(this.elements.tempBar, this.stats.temperature);
        }
        
        // Update stat bar colors based on levels
        this.updateStatBarColor(this.elements.healthBar, this.stats.health);
        this.updateStatBarColor(this.elements.hungerBar, this.stats.hunger);
        this.updateStatBarColor(this.elements.happinessBar, this.stats.happiness);
        
        // Update mood
        this.updateMood();
        this.elements.moodIndicator.textContent = this.moodSymbols[this.mood];
        
        // Update age and weight
        if (this.elements.ageDisplay) this.elements.ageDisplay.textContent = this.age;
        if (this.elements.weightDisplay) this.elements.weightDisplay.textContent = this.weight;
        
        // Check if pet is dead
        if (this.stats.health <= 0 || this.stats.hunger <= 0) {
            this.die();
        }
    }
    
    updateStatBarColor(element, value) {
        element.classList.remove('low', 'critical');
        if (value <= 20) {
            element.classList.add('critical');
        } else if (value <= 40) {
            element.classList.add('low');
        }
    }
    
    die() {
        this.isAlive = false;
        this.mood = 'dead';
        this.elements.petSprite.classList.add('dead');
        this.elements.moodIndicator.textContent = this.moodSymbols.dead;
        this.elements.gameOver.style.display = 'block';
        
        // Stop all timers
        clearInterval(this.gameLoopInterval);
        clearInterval(this.ageInterval);
        clearInterval(this.movementInterval);
    }
    
    gameLoop() {
        this.gameLoopInterval = setInterval(() => {
            if (!this.isAlive) return;
            
            const now = Date.now();
            const deltaTime = now - this.lastUpdate;
            this.lastUpdate = now;
            
            // Decrease stats over time (every 5 seconds in real time)
            const decayRate = deltaTime / 5000;
            
            this.stats.hunger = Math.max(0, this.stats.hunger - (decayRate * 3));
            this.stats.happiness = Math.max(0, this.stats.happiness - (decayRate * 2));
            
            // Health decreases faster when hunger, happiness, or cleanliness is low
            let healthDecay = decayRate * 1;
            if (this.stats.hunger < 30) healthDecay *= 2;
            if (this.stats.happiness < 30) healthDecay *= 1.5;
            if (this.cleanliness < 30) healthDecay *= 1.5;
            
            this.stats.health = Math.max(0, this.stats.health - healthDecay);
            
            // Random pooping - more likely after eating, but not while sleeping
            if (!this.isSleeping) {
                const timeSinceLastPoop = now - this.lastPoop;
                if (timeSinceLastPoop > 15000 && Math.random() < 0.1) { // 10% chance every second after 15 seconds
                    this.defecate();
                }
            }
            
            // Random pee chance (less frequent than poop)
            if (Math.random() < 0.001 && !this.elements.peePuddle.style.display) {
                this.makePee();
            }
            
            // Random emotional expressions based on stats (every 10 seconds chance)
            if (Math.random() < 0.1) {
                this.expressCurrentMood();
            }
            
            this.updateDisplay();
        }, 1000);
    }
    
    ageTimer() {
        this.ageInterval = setInterval(() => {
            if (!this.isAlive) return;
            this.age++;
            this.updateDisplay();
        }, 20000); // Age increases every 20 seconds
    }
    
    movementLoop() {
        this.movementInterval = setInterval(() => {
            if (Math.random() < 0.3) { // 30% chance to move randomly
                this.randomMovement();
            }
            // Change idle animations
            this.changeIdleAnimation();
        }, 3000); // Check for movement every 3 seconds
    }
    
    restart() {
        // Reset all stats
        this.stats = {
            health: 100,
            hunger: 100,
            happiness: 100
        };
        this.age = 0;
        this.mood = 'happy';
        this.isAlive = true;
        this.lastUpdate = Date.now();
        this.position = { x: 50, y: 50 };
        this.isMoving = false;
        this.cleanliness = 100;
        this.poopCount = 0;
        this.lastPoop = Date.now();
        this.isSleeping = false;
        this.sleepStartTime = null;
        this.sleepDuration = 0;
        
        // Reset display
        this.elements.petSprite.className = 'pet-sprite';
        this.elements.petSprite.style.left = '50%';
        this.elements.petSprite.style.top = '50%';
        this.elements.gameOver.style.display = 'none';
        this.hideFood();
        this.hideToy();
        this.hidePoop();
        this.hidePeePuddle();
        this.elements.sleepBubble.style.display = 'none';
        
        // Restart timers
        this.gameLoop();
        this.ageTimer();
        this.movementLoop();
        this.updateDisplay();
    }
    
    resetAnimation() {
        this.elements.petSprite.style.animation = 'idle 2s infinite ease-in-out';
    }
    
    toggleSkin() {
        // Cycle through default, red, purple, pink, yellow, blue, and ShitCream skins
        const calfagotchiShell = document.querySelector('.calfagotchi-shell');
        const skinButton = document.getElementById('skin-toggle').querySelector('.button-label');
        
        if (this.currentSkin === 'default') {
            calfagotchiShell.style.backgroundImage = "url('tamagotchi_red.png')";
            this.currentSkin = 'red';
            skinButton.textContent = 'Purple Color';
        } else if (this.currentSkin === 'red') {
            calfagotchiShell.style.backgroundImage = "url('tamagotchi_purple.png')";
            this.currentSkin = 'purple';
            skinButton.textContent = 'Pink Color';
        } else if (this.currentSkin === 'purple') {
            calfagotchiShell.style.backgroundImage = "url('tamagotchi_pink.png')";
            this.currentSkin = 'pink';
            skinButton.textContent = 'Yellow Color';
        } else if (this.currentSkin === 'pink') {
            calfagotchiShell.style.backgroundImage = "url('tamagotchi_yellr.png')";
            this.currentSkin = 'yellow';
            skinButton.textContent = 'Blue Color';
        } else if (this.currentSkin === 'yellow') {
            calfagotchiShell.style.backgroundImage = "url('tamagotchi_blue.png')";
            this.currentSkin = 'blue';
            skinButton.textContent = 'ShitCream Color';
        } else if (this.currentSkin === 'blue') {
            calfagotchiShell.style.backgroundImage = "url('tamagotchi_ShitCream.png')";
            this.currentSkin = 'shitCream';
            skinButton.textContent = 'Default Color';
        } else {
            calfagotchiShell.style.backgroundImage = "url('tamagotchi.png')";
            this.currentSkin = 'default';
            skinButton.textContent = 'Red Color';
        }
        
        // Add a little animation effect without affecting layout
        calfagotchiShell.style.transition = 'filter 0.3s ease, transform 0.1s ease';
        calfagotchiShell.style.filter = 'brightness(1.1)';
        calfagotchiShell.style.transform = 'scale(1.02)';
        setTimeout(() => {
            calfagotchiShell.style.filter = '';
            calfagotchiShell.style.transform = '';
        }, 200);
    }
    
    createEatingEffect() {
        // Create sparkle effect around pet
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.className = 'sparkle';
                sparkle.style.left = (Math.random() * 30 + 35) + '%';
                sparkle.style.top = (Math.random() * 30 + 35) + '%';
                sparkle.style.setProperty('--x', (Math.random() * 20 - 10) + 'px');
                sparkle.style.setProperty('--y', (Math.random() * 20 - 10) + 'px');
                sparkle.style.animation = 'sparkle-animation 0.8s ease-out forwards';
                
                this.elements.petArea.appendChild(sparkle);
                
                setTimeout(() => {
                    sparkle.remove();
                }, 800);
            }, i * 100);
        }
    }
    
    createPlayEffect() {
        // Create bouncing effect
        for (let i = 0; i < 8; i++) {
            setTimeout(() => {
                const ripple = document.createElement('div');
                ripple.className = 'ripple';
                ripple.style.left = (Math.random() * 60 + 20) + '%';
                ripple.style.top = (Math.random() * 60 + 20) + '%';
                ripple.style.width = '10px';
                ripple.style.height = '10px';
                ripple.style.animation = 'ripple-animation 0.6s ease-out forwards';
                
                this.elements.petArea.appendChild(ripple);
                
                setTimeout(() => {
                    ripple.remove();
                }, 600);
            }, i * 50);
        }
    }
    
    createCleaningEffect() {
        // Create cleaning sparkles
        for (let i = 0; i < 10; i++) {
            setTimeout(() => {
                const sparkle = document.createElement('div');
                sparkle.className = 'sparkle';
                sparkle.style.left = (Math.random() * 80 + 10) + '%';
                sparkle.style.top = (Math.random() * 80 + 10) + '%';
                sparkle.style.setProperty('--x', (Math.random() * 40 - 20) + 'px');
                sparkle.style.setProperty('--y', (Math.random() * 40 - 20) + 'px');
                sparkle.style.animation = 'sparkle-animation 1s ease-out forwards';
                
                this.elements.petArea.appendChild(sparkle);
                
                setTimeout(() => {
                    sparkle.remove();
                }, 1000);
            }, i * 100);
        }
    }
    
    showStatChangeEffect(stat, change) {
        const message = document.createElement('div');
        message.textContent = `${change > 0 ? '+' : ''}${change}`;
        message.style.position = 'absolute';
        message.style.color = change > 0 ? '#00ff00' : '#ff0000';
        message.style.fontSize = '8px';
        message.style.fontWeight = 'bold';
        message.style.left = '50%';
        message.style.top = '10px';
        message.style.transform = 'translateX(-50%)';
        message.style.animation = 'float-up 1s ease-out forwards';
        message.style.pointerEvents = 'none';
        message.style.zIndex = '20';
        
        this.elements.petArea.appendChild(message);
        
        setTimeout(() => {
            message.remove();
        }, 1000);
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
    
    doRandomAction() {
        if (this.isSleeping) return; // No random actions while sleeping
        
        const actions = ['happy', 'sad', 'bounce'];
        const randomAction = actions[Math.floor(Math.random() * actions.length)];
        this.showAction(randomAction);
    }
    
    wakeUp() {
        // Pet wakes up happy and refreshed
        this.isSleeping = false;
        this.sleepStartTime = null;
        this.sleepDuration = 0;
        
        // Pet wakes up happy and refreshed
        this.stats.happiness = Math.min(100, this.stats.happiness + 15);
        this.stats.health = Math.min(100, this.stats.health + 10);
        this.showCustomMessage("😊 *yawn*", "#87CEEB");
        
        // Hide sleep bubble and reset animation
        this.elements.sleepBubble.style.display = 'none';
        this.elements.petSprite.className = 'pet-sprite';
        this.resetAnimation();
        
        // Update mood now that the pet is awake
        this.updateDisplay();
    }
    
    giveMedicine() {
        if (!this.isAlive) return;
        
        this.lastInteraction = Date.now();
        this.stats.health = Math.min(100, this.stats.health + 40);
        this.stats.happiness = Math.max(0, this.stats.happiness - 10);
        
        this.showAction('medicine');
        this.reactToInteraction('medicine');
        this.updateDisplay();
        this.showStatChangeEffect('health', 40);
        this.showStatChangeEffect('happiness', -10);
        this.showCustomMessage("Medicine given!", "#00ff00");
    }
    
    discipline() {
        if (!this.isAlive) return;
        
        this.lastInteraction = Date.now();
        this.stats.discipline = Math.min(100, this.stats.discipline + 20);
        this.stats.happiness = Math.max(0, this.stats.happiness - 15);
        
        this.showAction('discipline');
        this.reactToInteraction('discipline');
        this.updateDisplay();
        this.showStatChangeEffect('discipline', 20);
        this.showStatChangeEffect('happiness', -15);
        this.showCustomMessage("Discipline +20!", "#ffaa00");
    }
    
    toggleLight() {
        this.lightsOn = !this.lightsOn;
        const screen = document.querySelector('.screen');
        screen.classList.toggle('lights-off', !this.lightsOn);
        
        if (!this.lightsOn) {
            this.goToSleep();
            this.showCustomMessage("Lights off - Sleep time!", "#0066ff");
        } else {
            this.wakeUp();
            this.showCustomMessage("Lights on - Wake up!", "#ffff00");
        }
    }
    
    showStatus() {
        this.currentScreen = 'status';
        this.elements.statusScreen.style.display = 'block';
        this.updateStatusDisplay();
    }
    
    updateStatusDisplay() {
        if (this.elements.evolutionLevel) this.elements.evolutionLevel.textContent = this.evolutionLevel;
        if (this.elements.disciplineLevel) this.elements.disciplineLevel.textContent = this.stats.discipline;
        if (this.elements.energyLevel) this.elements.energyLevel.textContent = this.stats.energy;
        if (this.elements.maxAgeDisplay) this.elements.maxAgeDisplay.textContent = this.maxAge;
    }
    
    showMiniGame() {
        this.currentScreen = 'game';
        this.elements.miniGame.style.display = 'block';
        this.initMemoryGame();
    }
    
    initMemoryGame() {
        const gameGrid = document.getElementById('game-grid');
        if (!gameGrid) return;
        
        gameGrid.innerHTML = '';
        gameGrid.style.display = 'grid';
        gameGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        gameGrid.style.gap = '10px';
        
        // Simple memory game with 4 buttons
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
        for (let i = 0; i < 4; i++) {
            const button = document.createElement('button');
            button.className = 'game-button-mini';
            button.textContent = i + 1;
            button.style.backgroundColor = colors[i];
            button.style.color = 'white';
            button.style.border = 'none';
            button.style.padding = '20px';
            button.style.borderRadius = '5px';
            button.style.cursor = 'pointer';
            button.addEventListener('click', () => this.playMemoryGame(i));
            gameGrid.appendChild(button);
        }
    }
    
    playMemoryGame(buttonIndex) {
        // Simple implementation - just give happiness for playing
        this.stats.happiness = Math.min(100, this.stats.happiness + 15);
        this.stats.energy = Math.max(0, this.stats.energy - 10);
        this.updateDisplay();
        this.showStatChangeEffect('happiness', 15);
        this.showStatChangeEffect('energy', -10);
        this.showCustomMessage("Fun game! +15 Happy!", "#ff00ff");
    }
    
    cycleScreenColor() {
        const screenColors = [
            { name: 'Default', color: 'rgba(183, 228, 199, 0.6)', shadow: '0 0 15px rgba(0, 255, 0, 0.2)' },
            { name: 'Green', color: 'rgba(153, 255, 153, 0.6)', shadow: '0 0 15px rgba(0, 255, 0, 0.3)' },
            { name: 'Blue', color: 'rgba(153, 204, 255, 0.6)', shadow: '0 0 15px rgba(0, 0, 255, 0.3)' },
            { name: 'Pink', color: 'rgba(255, 204, 255, 0.6)', shadow: '0 0 15px rgba(255, 0, 255, 0.3)' },
            { name: 'Yellow', color: 'rgba(255, 255, 170, 0.6)', shadow: '0 0 15px rgba(255, 255, 0, 0.3)' },
            { name: 'Orange', color: 'rgba(255, 221, 170, 0.6)', shadow: '0 0 15px rgba(255, 165, 0, 0.3)' },
            { name: 'Purple', color: 'rgba(221, 170, 255, 0.6)', shadow: '0 0 15px rgba(128, 0, 255, 0.3)' },
            { name: 'Aqua', color: 'rgba(153, 255, 255, 0.6)', shadow: '0 0 15px rgba(0, 255, 255, 0.3)' },
            { name: 'Coral', color: 'rgba(255, 153, 153, 0.6)', shadow: '0 0 15px rgba(255, 80, 80, 0.3)' },
            { name: 'Mint', color: 'rgba(170, 255, 200, 0.6)', shadow: '0 0 15px rgba(80, 255, 170, 0.3)' },
            { name: 'Lavender', color: 'rgba(200, 180, 255, 0.6)', shadow: '0 0 15px rgba(180, 150, 255, 0.3)' }
        ];
        
        // Get current screen element
        const screen = document.querySelector('.screen');
        
        // Get current color index or default to -1 for initial state
        const currentColorIndex = screen.dataset.colorIndex ? parseInt(screen.dataset.colorIndex) : -1;
        const nextIndex = (currentColorIndex + 1) % screenColors.length;
        
        // Save the index for future reference
        screen.dataset.colorIndex = nextIndex;
        
        // Apply new screen color
        const newColor = screenColors[nextIndex];
        screen.style.backgroundColor = newColor.color;
        screen.style.boxShadow = newColor.shadow;
        
        // Apply transition for smooth color change
        screen.style.transition = 'background-color 0.5s ease, box-shadow 0.5s ease';
        
        this.showCustomMessage(`Screen: ${newColor.name}`, newColor.color);
    }
    
    cycleSkin() {
        const cases = [
            { name: 'Red', color: 'tamagotchi.png', mainColor: '#ff6b6b' },
            { name: 'Blue', color: 'tamagotchi_blue.png', mainColor: '#5fa8d3' },
            { name: 'Pink', color: 'tamagotchi_pink.png', mainColor: '#ff86b3' },
            { name: 'Purple', color: 'tamagotchi_purple.png', mainColor: '#ad7bee' },
            { name: 'Yellow', color: 'tamagotchi_yellr.png', mainColor: '#ffda77' },
            { name: 'ShitCream', color: 'tamagotchi_ShitCream.png', mainColor: '#d4b483' }
        ];
        
        // Get the Calfagotchi shell element
        const shell = document.querySelector('.calfagotchi-shell');
        
        // Get current case index or default to 0 to ensure it always works the first time
        const currentIndex = shell.dataset.caseIndex !== undefined ? parseInt(shell.dataset.caseIndex) : 0;
        const nextIndex = (currentIndex + 1) % cases.length;
        
        // Save the index for future reference
        shell.dataset.caseIndex = nextIndex;
        
        // Update case appearance
        const newCase = cases[nextIndex];
        shell.style.backgroundImage = `url('${newCase.color}')`;
        
        // Change buttons color and add glow effect
        const buttons = document.querySelectorAll('.game-button');
        buttons.forEach(button => {
            button.style.backgroundColor = newCase.mainColor + 'aa'; // Add alpha for transparency
            button.style.borderColor = newCase.mainColor;
            button.style.boxShadow = `0 0 10px ${newCase.mainColor}`;
        });

        // Apply color to menu items
        const menuItems = document.querySelectorAll('.menu-item');
        menuItems.forEach(item => {
            item.style.borderColor = newCase.mainColor;
            item.style.backgroundColor = newCase.mainColor + '22'; // Very light tint
            item.addEventListener('mouseover', () => {
                item.style.backgroundColor = newCase.mainColor + '44';
            });
            item.addEventListener('mouseout', () => {
                item.style.backgroundColor = newCase.mainColor + '22';
            });
        });

        // Update menu selector color
        const menuSelector = document.getElementById('menu-selector');
        if (menuSelector) {
            menuSelector.style.color = newCase.mainColor;
        }
        
        this.showCustomMessage(`Case: ${newCase.name}`, newCase.mainColor);
    }
    
    godPower() {
        if (!this.isAlive) return;
        
        // Make everything blue and create lightning effect
        const screen = document.querySelector('.screen');
        const petArea = this.elements.petArea;
        
        // Blue glow effect
        screen.style.background = 'linear-gradient(45deg, #0066ff, #00aaff)';
        screen.style.boxShadow = '0 0 30px #0066ff, inset 0 0 30px rgba(0, 102, 255, 0.3)';
        
        // Lightning effect
        this.createLightningEffect();
        
        // God power boosts all stats
        this.stats.health = 100;
        this.stats.hunger = 100;
        this.stats.happiness = 100;
        this.stats.energy = 100;
        this.stats.temperature = 70;
        this.stats.discipline = Math.min(100, this.stats.discipline + 50);
        
        // Show dramatic effect message
        this.showCustomMessage("⚡ GOD POWER ACTIVATED! ⚡", "#ffff00");
        
        // Reset visual effects after 2 seconds
        setTimeout(() => {
            screen.style.background = '';
            screen.style.boxShadow = '';
        }, 2000);
        
        this.updateDisplay();
        this.showStatChangeEffect('health', 'MAX');
        this.showStatChangeEffect('happiness', 'MAX');
        this.showStatChangeEffect('energy', 'MAX');
    }
    
    createLightningEffect() {
        const petArea = this.elements.petArea;
        
        // Create multiple lightning bolts
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                const lightning = document.createElement('div');
                lightning.style.position = 'absolute';
                lightning.style.width = '2px';
                lightning.style.height = '100px';
                lightning.style.background = 'linear-gradient(to bottom, #ffffff, #00aaff, #0066ff)';
                lightning.style.left = Math.random() * 80 + 10 + '%';
                lightning.style.top = '0';
                lightning.style.boxShadow = '0 0 10px #00aaff';
                lightning.style.animation = 'lightning 0.3s ease-out';
                lightning.style.zIndex = '50';
                lightning.style.pointerEvents = 'none';
                
                petArea.appendChild(lightning);
                
                // Remove after animation
                setTimeout(() => {
                    lightning.remove();
                }, 300);
            }, i * 100);
        }
    }
    
    update() {
        // Decrease stats over time (every 5 seconds in real time)
        const decayRate = 1 / 5000;
        
        this.stats.hunger = Math.max(0, this.stats.hunger - decayRate * 3);
        this.stats.happiness = Math.max(0, this.stats.happiness - decayRate * 2);
        
        // Health decreases faster when hunger, happiness, or cleanliness is low
        let healthDecay = decayRate;
        if (this.stats.hunger < 30) healthDecay *= 2;
        if (this.stats.happiness < 30) healthDecay *= 1.5;
        if (this.cleanliness < 30) healthDecay *= 1.5;
        
        this.stats.health = Math.max(0, this.stats.health - healthDecay);
        
        // Random pooping - more likely after eating, but not while sleeping
        if (!this.isSleeping) {
            const timeSinceLastPoop = Date.now() - this.lastPoop;
            if (timeSinceLastPoop > 15000 && Math.random() < 0.1) { // 10% chance every second after 15 seconds
                this.defecate();
                
                // Equal chance to pee when pooping
                if (Math.random() < 0.5 && !this.elements.peePuddle.style.display === 'block') {
                    this.makePee();
                }
            }
            
            // Additional chance for independent pee
            if (timeSinceLastPoop > 10000 && Math.random() < 0.1 && this.elements.peePuddle.style.display !== 'block') {
                this.makePee();
            }
        }
        
        // Random emotional expressions based on stats (every 10 seconds chance)
        if (Math.random() < 0.1) {
            this.expressCurrentMood();
        }
        
        this.updateDisplay();
    }

    makePee() {
        if (!this.isAlive || this.isSleeping) return;

        const peePuddle = this.elements.peePuddle;
        
        // Position pee puddle randomly as percentage
        const x = Math.max(10, Math.min(80, this.position.x + (Math.random() * 20 - 10)));
        const y = Math.max(40, Math.min(80, 70 + (Math.random() * 20 - 10)));
        
        peePuddle.style.display = 'block';
        peePuddle.style.left = `${x}%`;
        peePuddle.style.top = `${y}%`;
        peePuddle.style.animation = 'none';
        void peePuddle.offsetWidth; // Force reflow
        peePuddle.style.animation = 'pee-appear 0.5s forwards';
        
        this.cleanliness = Math.max(0, this.cleanliness - 20);
        
        // Pet becomes relieved when peeing
        this.showAction('happy');
        setTimeout(() => {
            this.updateDisplay();
        }, 1000);
    }

    clean() {
        if (!this.isAlive) return;

        // Wake up if sleeping
        if (this.isSleeping) {
            this.wakeUp();
            return;
        }

        const poopItem = this.elements.poopItem;
        const peePuddle = this.elements.peePuddle;
        let wasCleaningNeeded = false;

        // Clean poop if present
        if (poopItem.style.display === 'block') {
            poopItem.style.animation = 'poop-appear 0.5s reverse forwards';
            setTimeout(() => {
                poopItem.style.display = 'none';
            }, 500);
            this.poopCount = 0;
            wasCleaningNeeded = true;
        }

        // Clean pee if present
        if (peePuddle.style.display === 'block') {
            peePuddle.style.animation = 'pee-appear 0.5s reverse forwards';
            setTimeout(() => {
                peePuddle.style.display = 'none';
            }, 500);
            wasCleaningNeeded = true;
        }

        if (wasCleaningNeeded) {
            this.cleanliness = 100;
            this.updateStats();
            this.showCustomMessage('All clean! 🧹');
            
            // Pet becomes happy when cleaned
            this.showAction('happy');
        }
    }
}

// Initialize the game when the page loads
window.addEventListener('DOMContentLoaded', () => {
    window.calfagotchi = new Calfagotchi();
});

// Simple sound effects using Web Audio API
class SoundManager {
    constructor() {
        this.audioContext = null;
        this.initAudio();
    }
    
    initAudio() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.log('Web Audio API not supported');
        }
    }
    
    playTone(frequency, duration, volume = 0.1) {
        if (!this.audioContext) return;
        
        const oscillator = this.audioContext.createOscillator();
        const gainNode = this.audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(this.audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'square';
        
        gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext.currentTime + duration);
        
        oscillator.start(this.audioContext.currentTime);
        oscillator.stop(this.audioContext.currentTime + duration);
    }
    
    playFeedSound() {
        this.playTone(440, 0.2);
    }
    
    playPlaySound() {
        this.playTone(660, 0.1);
        setTimeout(() => this.playTone(880, 0.1), 50);
    }
    
    playCleanSound() {
        this.playTone(330, 0.3);
    }
}

// Initialize sound manager
const soundManager = new SoundManager();

// Add sound effects to buttons
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('feed-btn').addEventListener('click', () => {
        soundManager.playFeedSound();
    });
    
    document.getElementById('play-btn').addEventListener('click', () => {
        soundManager.playPlaySound();
    });
    
    document.getElementById('clean-btn').addEventListener('click', () => {
        soundManager.playCleanSound();
    });
});
