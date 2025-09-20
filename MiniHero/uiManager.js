// Enhanced Grinder RPG - UI Manager Module
// This module handles all UI interactions, updates, and display logic
// Future bots: This creates and manages ALL UI elements dynamically - no hardcoded HTML!

export class UIManager {
    constructor(game) {
        this.game = game;
        this.elements = {};
        this.isInitialized = false;

        try {
            this.createUIStructure();
            this.setupUIElements();
            this.isInitialized = true;
            console.log('✅ UIManager initialized successfully');
        } catch (error) {
            console.error('❌ UIManager initialization failed:', error);
        }
    }

    createUIStructure() {
        const container = document.getElementById('game-container');

        // Create UI overlay
        const uiOverlay = document.createElement('div');
        uiOverlay.id = 'ui-overlay';
        container.appendChild(uiOverlay);

        // Create all UI panels dynamically
        this.createPlayerStatsPanel(uiOverlay);
        this.createAbilityBar(uiOverlay);
        this.createItemBar(uiOverlay);
        this.createShopPanel(uiOverlay);
        this.createNPCInteraction(uiOverlay);
        this.createMinimap(uiOverlay);
        this.createCombatLog(uiOverlay);
        this.createChatPanel(uiOverlay);
        this.createMMOStatus(uiOverlay);
        this.createScreenFlash(uiOverlay);
    }

    createPlayerStatsPanel(parent) {
        const panel = document.createElement('div');
        panel.id = 'player-stats';
        panel.className = 'ui-panel';
        panel.innerHTML = `
            <h3>🛡️ Hero Status</h3>
            <div>Health: <span id="health-text">100/100</span></div>
            <div class="stat-bar"><div id="health-bar" class="stat-fill health-fill" style="width: 100%"></div></div>
            <div>Mana: <span id="mana-text">50/50</span></div>
            <div class="stat-bar"><div id="mana-bar" class="stat-fill mana-fill" style="width: 100%"></div></div>
            <div>Level: <span id="level-text">1</span> | EXP: <span id="exp-text">0/100</span></div>
            <div class="stat-bar"><div id="exp-bar" class="stat-fill exp-fill" style="width: 0%"></div></div>
            <div>💰 Gold: <span id="gold-text">25</span></div>
            <div>⚔️ Damage: <span id="damage-text">25</span></div>
            <div>💀 Kills: <span id="kills-text">0</span></div>
        `;
        parent.appendChild(panel);
    }

    createAbilityBar(parent) {
        const abilityBar = document.createElement('div');
        abilityBar.id = 'ability-bar';

        const abilities = [
            { id: 'attack', icon: '⚔️' },
            { id: 'heal', icon: '❤️' },
            { id: 'mana', icon: '💙' },
            { id: 'special', icon: '⚡' }
        ];

        abilities.forEach(ability => {
            const slot = document.createElement('div');
            slot.className = 'ability-slot';
            slot.dataset.ability = ability.id;
            slot.innerHTML = `
                <div class="ability-icon">${ability.icon}</div>
                <div class="ability-cooldown" style="display: none;">0.0</div>
            `;
            abilityBar.appendChild(slot);
        });

        parent.appendChild(abilityBar);
    }

    createItemBar(parent) {
        const itemBar = document.createElement('div');
        itemBar.id = 'item-bar';

        const initialItems = [
            { id: 'health-potion', icon: '🧪', count: 2 },
            { id: 'mana-potion', icon: '💙', count: 1 },
            { id: 'pet-scroll', icon: '📜', count: 0 },
            { id: 'empty', icon: '', count: 0 },
            { id: 'empty', icon: '', count: 0 }
        ];

        initialItems.forEach(item => {
            const slot = document.createElement('div');
            slot.className = 'item-slot';
            slot.dataset.item = item.id;

            if (item.id !== 'empty') {
                slot.innerHTML = `
                    <span>${item.icon}</span>
                    <div class="item-count">${item.count}</div>
                `;
            }

            itemBar.appendChild(slot);
        });

        parent.appendChild(itemBar);
    }

    createShopPanel(parent) {
        const shopPanel = document.createElement('div');
        shopPanel.id = 'shop-panel';
        shopPanel.className = 'ui-panel';
        shopPanel.style.display = 'none';

        shopPanel.innerHTML = `
            <div class="shop-close">✕</div>
            <div class="shop-header">🏪 Merchant Shop</div>
            <div class="shop-content">
                <div class="shop-item" data-item="health-potion" data-price="15">
                    <span>🧪 Health Potion</span>
                    <span>15 Gold</span>
                </div>
                <div class="shop-item" data-item="mana-potion" data-price="25">
                    <span>💙 Mana Potion</span>
                    <span>25 Gold</span>
                </div>
                <div class="shop-item" data-item="pet-scroll" data-price="75">
                    <span>📜 Pet Summon Scroll</span>
                    <span>75 Gold</span>
                </div>
            </div>
        `;

        parent.appendChild(shopPanel);
    }

    createNPCInteraction(parent) {
        const npcInteraction = document.createElement('div');
        npcInteraction.id = 'npc-interaction';
        npcInteraction.style.display = 'none';

        npcInteraction.innerHTML = `
            <div class="interaction-text" id="npc-dialogue">
                Welcome, traveler! I have potions that might interest you.
            </div>
            <div class="interaction-buttons">
                <div class="interaction-button" id="shop-button">🏪 Browse Shop</div>
                <div class="interaction-button" id="talk-button">💬 Chat</div>
                <div class="interaction-button" id="leave-button">👋 Leave</div>
            </div>
        `;

        parent.appendChild(npcInteraction);
    }

    createMinimap(parent) {
        const minimap = document.createElement('div');
        minimap.id = 'minimap';
        minimap.className = 'ui-panel';

        const canvas = document.createElement('canvas');
        canvas.id = 'minimap-canvas';
        canvas.width = 146;
        canvas.height = 146;

        minimap.appendChild(canvas);
        parent.appendChild(minimap);
    }

    createCombatLog(parent) {
        const combatLog = document.createElement('div');
        combatLog.id = 'combat-log';
        combatLog.className = 'ui-panel';

        combatLog.innerHTML = `
            <h4>⚔️ Game Log</h4>
            <div id="log-content"></div>
        `;

        parent.appendChild(combatLog);
    }

    createChatPanel(parent) {
        const chatPanel = document.createElement('div');
        chatPanel.id = 'chat-panel';
        chatPanel.className = 'ui-panel';

        chatPanel.innerHTML = `
            <h4>💬 Global Chat</h4>
            <div id="chat-messages"></div>
            <div class="chat-input-container">
                <input type="text" id="chat-input" placeholder="Type message..." maxlength="200">
                <button id="chat-send">Send</button>
            </div>
        `;

        parent.appendChild(chatPanel);
    }

    createMMOStatus(parent) {
        const mmoStatus = document.createElement('div');
        mmoStatus.id = 'mmo-status';
        mmoStatus.className = 'ui-panel';

        mmoStatus.innerHTML = `
            <h4>🌐 MMO Status</h4>
            <div class="player-name-section">
                <label for="player-name-input">Player Name:</label>
                <div class="name-input-container">
                    <input type="text" id="player-name-input" placeholder="Enter your name..." maxlength="20">
                    <button id="set-name-button">Set Name</button>
                </div>
            </div>
            <div>Current: <span id="player-name">Connecting...</span></div>
            <div>Online: <span id="online-count">0</span> players</div>
            <div>Server: <span id="server-status">Connecting...</span></div>
        `;

        parent.appendChild(mmoStatus);
    }

    createScreenFlash(parent) {
        const screenFlash = document.createElement('div');
        screenFlash.id = 'screen-flash';
        parent.appendChild(screenFlash);
    }

    setupUIElements() {
        // Cache UI elements for performance after they're created
        this.elements = {
            healthText: document.getElementById('health-text'),
            healthBar: document.getElementById('health-bar'),
            manaText: document.getElementById('mana-text'),
            manaBar: document.getElementById('mana-bar'),
            levelText: document.getElementById('level-text'),
            expText: document.getElementById('exp-text'),
            expBar: document.getElementById('exp-bar'),
            goldText: document.getElementById('gold-text'),
            damageText: document.getElementById('damage-text'),
            killsText: document.getElementById('kills-text'),
            logContent: document.getElementById('log-content'),
            npcInteraction: document.getElementById('npc-interaction'),
            npcDialogue: document.getElementById('npc-dialogue'),
            shopPanel: document.getElementById('shop-panel'),
            minimapCanvas: document.getElementById('minimap-canvas'),
            screenFlash: document.getElementById('screen-flash'),
            chatMessages: document.getElementById('chat-messages'),
            chatInput: document.getElementById('chat-input'),
            chatSend: document.getElementById('chat-send'),
            playerName: document.getElementById('player-name'),
            onlineCount: document.getElementById('online-count'),
            serverStatus: document.getElementById('server-status'),
            playerNameInput: document.getElementById('player-name-input'),
            setNameButton: document.getElementById('set-name-button')
        };

        // Set up event listeners after elements are created
        this.setupEventListeners();
    }

    setupEventListeners() {
        console.log('Setting up UI event listeners...');

        // Shop event listeners
        const shopButton = document.getElementById('shop-button');
        if (shopButton) {
            shopButton.addEventListener('click', () => {
                console.log('Shop button clicked!');
                this.openShop();
            });
        } else {
            console.error('Shop button not found!');
        }

        const talkButton = document.getElementById('talk-button');
        if (talkButton) {
            talkButton.addEventListener('click', () => {
                console.log('Talk button clicked!');
                if (this.game.currentNPC) {
                    const npcComponent = this.game.currentNPC.getComponent('NPC');
                    if (npcComponent) {
                        const randomDialogue = npcComponent.dialogue[Math.floor(Math.random() * npcComponent.dialogue.length)];
                        this.elements.npcDialogue.textContent = randomDialogue;
                        this.game.logMessage(`${npcComponent.name}: "${randomDialogue}"`, 'shop');
                    }
                }
            });
        }

        const leaveButton = document.getElementById('leave-button');
        if (leaveButton) {
            leaveButton.addEventListener('click', () => {
                console.log('Leave button clicked!');
                this.closeNPCInteraction();
            });
        }

        const shopClose = document.querySelector('.shop-close');
        if (shopClose) {
            shopClose.addEventListener('click', () => {
                console.log('Shop close clicked!');
                this.closeShop();
            });
        } else {
            console.error('Shop close button not found!');
        }

        // Shop item purchases
        const shopContent = document.querySelector('.shop-content');
        if (shopContent) {
            shopContent.addEventListener('click', (e) => {
                try {
                    console.log('Shop content clicked!', e.target);
                    const shopItem = e.target.closest('.shop-item');
                    if (shopItem) {
                        console.log('Shop item clicked:', shopItem.dataset.item, shopItem.dataset.price);
                        this.purchaseItem(shopItem.dataset.item, parseInt(shopItem.dataset.price));
                    } else {
                        console.log('No shop item found');
                    }
                } catch (error) {
                    console.error('❌ Error in shop click handler:', error);
                }
            });
        } else {
            console.error('Shop content not found!');
        }

        // Item usage
        const itemBar = document.getElementById('item-bar');
        if (itemBar) {
            itemBar.addEventListener('click', (e) => {
                try {
                    const slot = e.target.closest('.item-slot');
                    if (slot && slot.dataset.item !== 'empty') {
                        console.log('Item used:', slot.dataset.item);
                        this.useItem(slot.dataset.item);
                    }
                } catch (error) {
                    console.error('❌ Error in item click handler:', error);
                }
            });
        }

        // Ability bar usage
        const abilityBar = document.getElementById('ability-bar');
        if (abilityBar) {
            abilityBar.addEventListener('click', (e) => {
                try {
                    const slot = e.target.closest('.ability-slot');
                    if (slot) {
                        console.log('Ability used:', slot.dataset.ability);
                        this.useAbility(slot.dataset.ability);
                    }
                } catch (error) {
                    console.error('❌ Error in ability click handler:', error);
                }
            });
        }

        // Chat functionality
        if (this.elements.chatSend) {
            this.elements.chatSend.addEventListener('click', () => {
                try {
                    this.sendChatMessage();
                } catch (error) {
                    console.error('❌ Error in chat send handler:', error);
                }
            });
        }

        if (this.elements.chatInput) {
            this.elements.chatInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.sendChatMessage();
                }
            });
        }

        // Player name change functionality
        if (this.elements.setNameButton) {
            this.elements.setNameButton.addEventListener('click', () => {
                try {
                    this.changePlayerName();
                } catch (error) {
                    console.error('❌ Error in name change handler:', error);
                }
            });
        }

        if (this.elements.playerNameInput) {
            this.elements.playerNameInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    this.changePlayerName();
                }
            });
        }

        console.log('UI event listeners setup complete!');
    }

    showNPCInteraction(npc) {
        const npcComponent = npc.getComponent('NPC');
        this.elements.npcDialogue.textContent =
            npcComponent.dialogue[Math.floor(Math.random() * npcComponent.dialogue.length)];
        this.elements.npcInteraction.style.display = 'block';
    }

    closeNPCInteraction() {
        this.elements.npcInteraction.style.display = 'none';
        this.game.currentNPC = null;
    }

    openShop() {
        if (this.game.currentNPC && this.game.currentNPC.hasComponent('Shop')) {
            this.elements.shopPanel.style.display = 'flex';
            this.elements.npcInteraction.style.display = 'none';
            this.game.logMessage('Browsing merchant\'s wares...', 'shop');
        } else {
            this.game.logMessage('This NPC has no shop!', 'damage');
        }
    }

    closeShop() {
        this.elements.shopPanel.style.display = 'none';
        if (this.game.currentNPC) {
            this.elements.npcInteraction.style.display = 'block';
        }
    }

    purchaseItem(itemType, price) {
        const inventory = this.game.player.getComponent('Inventory');

        if (inventory.hasGold(price)) {
            if (inventory.spendGold(price)) {
                this.addItemToInventory(itemType);
                this.game.logMessage(`Purchased ${itemType} for ${price} gold!`, 'shop');
            } else {
                this.game.logMessage(`Transaction failed! Please try again.`, 'shop');
            }
        } else {
            this.game.logMessage(`Not enough gold! Need ${price} gold.`, 'shop');
        }
    }

    addItemToInventory(itemType) {
        // Find the item slot and increase count
        const slot = document.querySelector(`[data-item="${itemType}"]`);
        if (slot) {
            const countElement = slot.querySelector('.item-count');
            if (countElement) {
                let count = parseInt(countElement.textContent) + 1;
                countElement.textContent = count;
                countElement.style.display = 'block';
            }
        } else {
            // Find empty slot
            const emptySlot = document.querySelector('[data-item="empty"]');
            if (emptySlot) {
                emptySlot.dataset.item = itemType;
                emptySlot.innerHTML = this.getItemIcon(itemType) + '<div class="item-count">1</div>';
            }
        }
    }

    getItemIcon(itemType) {
        const icons = {
            'health-potion': '🧪',
            'mana-potion': '💙',
            'pet-scroll': '📜'
        };
        return `<span>${icons[itemType] || '❓'}</span>`;
    }

    updateItemCount(itemType, change) {
        const slot = document.querySelector(`[data-item="${itemType}"]`);
        if (slot) {
            const countElement = slot.querySelector('.item-count');
            if (countElement) {
                let count = parseInt(countElement.textContent) + change;
                count = Math.max(0, count);

                if (count > 0) {
                    countElement.textContent = count;
                    countElement.style.display = 'block';
                } else {
                    // Remove item from slot
                    slot.dataset.item = 'empty';
                    slot.innerHTML = '';
                }
            }
        }
    }

    useItem(itemType) {
        const inventory = this.game.player.getComponent('Inventory');
        const health = this.game.player.getComponent('Health');
        const mana = this.game.player.getComponent('Mana');

        switch (itemType) {
            case 'health-potion':
                if (health.currentHealth < health.maxHealth) {
                    health.heal(50);
                    this.game.logMessage('Used Health Potion! +50 HP', 'spawn');
                    this.updateItemCount('health-potion', -1);
                }
                break;
            case 'mana-potion':
                if (mana.currentMana < mana.maxMana) {
                    mana.restoreMana(30);
                    this.game.logMessage('Used Mana Potion! +30 MP', 'spawn');
                    this.updateItemCount('mana-potion', -1);
                }
                break;
            case 'pet-scroll':
                // Check if player already has a pet
                const petHealth = this.game.playerPet ? this.game.playerPet.getComponent('Health') : null;
                if (!this.game.playerPet || (petHealth && petHealth.isDead)) {
                    this.game.summonPet();
                    this.game.logMessage('Summoned a loyal companion!', 'spawn');
                    this.updateItemCount('pet-scroll', -1);
                } else {
                    this.game.logMessage('You already have a companion!', 'damage');
                }
                break;
        }
    }

    useAbility(abilityType) {
        const health = this.game.player.getComponent('Health');
        const mana = this.game.player.getComponent('Mana');
        const combat = this.game.player.getComponent('Combat');

        switch (abilityType) {
            case 'attack':
                this.game.logMessage('Select a target to attack!', 'damage');
                break;
            case 'heal':
                if (mana.useMana(10) && health.currentHealth < health.maxHealth) {
                    health.heal(25);
                    this.game.logMessage('Used Healing Spell! +25 HP', 'spawn');
                    this.game.effectsManager.createHealEffect(this.game.player);
                    this.startAbilityCooldown('heal', 5.0);
                } else {
                    this.game.logMessage('Not enough mana or already at full health!', 'damage');
                }
                break;
            case 'mana':
                if (mana.currentMana < mana.maxMana) {
                    mana.restoreMana(20);
                    this.game.logMessage('Used Mana Regeneration! +20 MP', 'spawn');
                    this.game.effectsManager.createManaEffect(this.game.player);
                    this.startAbilityCooldown('mana', 3.0);
                } else {
                    this.game.logMessage('Already at full mana!', 'damage');
                }
                break;
            case 'special':
                if (mana.useMana(25)) {
                    const originalDamage = combat.damage;
                    combat.damage += 15;
                    this.game.logMessage('BERSERKER RAGE! +15 damage for 10 seconds!', 'spawn');
                    this.game.effectsManager.createExplosion(
                        this.game.player.getComponent('Transform').x,
                        this.game.player.getComponent('Transform').y,
                        'large'
                    );
                    this.startAbilityCooldown('special', 10.0);

                    setTimeout(() => {
                        combat.damage = originalDamage;
                        this.game.logMessage('Berserker rage ended.', 'damage');
                    }, 10000);
                } else {
                    this.game.logMessage('Not enough mana for special ability!', 'damage');
                }
                break;
        }
    }

    startAbilityCooldown(abilityType, duration) {
        const slot = document.querySelector(`[data-ability="${abilityType}"]`);
        if (slot) {
            const cooldownElement = slot.querySelector('.ability-cooldown');
            let timeLeft = duration;

            cooldownElement.style.display = 'flex';
            slot.style.pointerEvents = 'none';
            slot.style.opacity = '0.5';

            const interval = setInterval(() => {
                timeLeft -= 0.1;
                cooldownElement.textContent = timeLeft.toFixed(1);

                if (timeLeft <= 0) {
                    clearInterval(interval);
                    cooldownElement.style.display = 'none';
                    slot.style.pointerEvents = 'auto';
                    slot.style.opacity = '1';
                }
            }, 100);
        }
    }

    updateUI() {
        if (!this.isInitialized || !this.game.player) return;

        try {
            const health = this.game.player.getComponent('Health');
            const mana = this.game.player.getComponent('Mana');
            const combat = this.game.player.getComponent('Combat');
            const inventory = this.game.player.getComponent('Inventory');

            // Safety checks for components
            if (!health || !mana || !combat || !inventory) {
                console.warn('Missing player components during UI update');
                return;
            }

            // Update health
            if (this.elements.healthText && this.elements.healthBar) {
                this.elements.healthText.textContent = `${health.currentHealth}/${health.maxHealth}`;
                this.elements.healthBar.style.width = `${health.getHealthPercentage() * 100}%`;
            }

            // Update mana
            if (this.elements.manaText && this.elements.manaBar) {
                this.elements.manaText.textContent = `${mana.currentMana}/${mana.maxMana}`;
                this.elements.manaBar.style.width = `${mana.getManaPercentage() * 100}%`;
            }

            // Update level and experience
            if (this.elements.levelText && this.elements.expText && this.elements.expBar) {
                this.elements.levelText.textContent = this.game.playerLevel;
                this.elements.expText.textContent = `${this.game.playerExp}/${this.game.playerExpToNext}`;
                this.elements.expBar.style.width = `${(this.game.playerExp / this.game.playerExpToNext) * 100}%`;
            }

            // Update other stats
            if (this.elements.goldText) this.elements.goldText.textContent = inventory.gold;
            if (this.elements.damageText) this.elements.damageText.textContent = combat.damage;
            if (this.elements.killsText) this.elements.killsText.textContent = this.game.enemiesKilled;

            // Update MMO status
            this.updateMMOStatus();

        } catch (error) {
            console.error('UI update error:', error);
        }
    }

    updateMinimap() {
        if (!this.game.player) return;

        const canvas = this.elements.minimapCanvas;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const playerTransform = this.game.player.getComponent('Transform');

        if (!playerTransform) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw player
        ctx.fillStyle = '#00ff00';
        ctx.fillRect(canvas.width / 2 - 2, canvas.height / 2 - 2, 4, 4);

        // Draw enemies
        ctx.fillStyle = '#ff0000';
        this.game.enemies.forEach(enemy => {
            const health = enemy.getComponent('Health');
            const enemyTransform = enemy.getComponent('Transform');

            if (health && enemyTransform && !health.isDead) {
                const relX = (enemyTransform.x - playerTransform.x) * 0.3 + canvas.width / 2;
                const relY = (enemyTransform.y - playerTransform.y) * 0.3 + canvas.height / 2;

                if (relX >= 0 && relX < canvas.width && relY >= 0 && relY < canvas.height) {
                    ctx.fillRect(relX - 1, relY - 1, 2, 2);
                }
            }
        });

        // Draw NPCs
        ctx.fillStyle = '#0000ff';
        this.game.npcs.forEach(npc => {
            const npcTransform = npc.getComponent('Transform');

            if (npcTransform) {
                const relX = (npcTransform.x - playerTransform.x) * 0.3 + canvas.width / 2;
                const relY = (npcTransform.y - playerTransform.y) * 0.3 + canvas.height / 2;

                if (relX >= 0 && relX < canvas.width && relY >= 0 && relY < canvas.height) {
                    ctx.fillRect(relX - 1, relY - 1, 2, 2);
                }
            }
        });
    }

    logMessage(message, type = 'normal') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = `${new Date().toLocaleTimeString()}: ${message}`;

        // Add to game log
        this.elements.logContent.appendChild(entry);
        this.elements.logContent.scrollTop = this.elements.logContent.scrollHeight;

        while (this.elements.logContent.children.length > 50) {
            this.elements.logContent.removeChild(this.elements.logContent.firstChild);
        }

        // If it's a chat message, also add to chat panel
        if (type === 'chat' && this.elements.chatMessages) {
            const chatEntry = document.createElement('div');
            chatEntry.className = 'chat-message';
            chatEntry.textContent = message;
            
            this.elements.chatMessages.appendChild(chatEntry);
            this.elements.chatMessages.scrollTop = this.elements.chatMessages.scrollHeight;

            while (this.elements.chatMessages.children.length > 100) {
                this.elements.chatMessages.removeChild(this.elements.chatMessages.firstChild);
            }
        }
    }

    sendChatMessage() {
        if (!this.elements.chatInput || !this.game.mmoManager) return;

        const message = this.elements.chatInput.value.trim();
        if (message) {
            this.game.mmoManager.sendChatMessage(message);
            this.elements.chatInput.value = '';
            
            // Show own message immediately
            this.logMessage(`[${this.game.mmoManager.getPlayerName()}]: ${message}`, 'chat');
        }
    }

    updateMMOStatus() {
        if (!this.game.mmoManager) return;

        if (this.elements.playerName) {
            this.elements.playerName.textContent = this.game.mmoManager.getPlayerName();
        }

        if (this.elements.onlineCount) {
            this.elements.onlineCount.textContent = this.game.mmoManager.getOnlinePlayerCount();
        }

        if (this.elements.serverStatus) {
            this.elements.serverStatus.textContent = this.game.mmoManager.isConnected ? 'Connected' : 'Offline';
            this.elements.serverStatus.style.color = this.game.mmoManager.isConnected ? '#00ff00' : '#ff0000';
        }

        // Initialize name input with current name
        if (this.elements.playerNameInput && !this.elements.playerNameInput.value) {
            this.elements.playerNameInput.value = this.game.mmoManager.getPlayerName();
        }
    }

    changePlayerName() {
        if (!this.elements.playerNameInput || !this.game.mmoManager) return;

        const newName = this.elements.playerNameInput.value.trim();
        if (newName && newName.length >= 2 && newName.length <= 20) {
            // Validate name (no special characters that could cause issues)
            const validNameRegex = /^[a-zA-Z0-9\s\-_]+$/;
            if (!validNameRegex.test(newName)) {
                this.logMessage('Name can only contain letters, numbers, spaces, hyphens, and underscores.', 'damage');
                return;
            }

            // Change the name
            if (this.game.mmoManager.setPlayerName(newName)) {
                this.elements.playerNameInput.value = '';
                this.logMessage(`Player name changed to: ${newName}`, 'spawn');
                
                // Update the display
                this.updateMMOStatus();
            }
        } else {
            this.logMessage('Name must be 2-20 characters long.', 'damage');
        }
    }
}