// MMO Manager - Handles all multiplayer functionality using Supabase
// This module manages player synchronization, chat, and real-time interactions

import { createClient } from 'https://cdn.skypack.dev/@supabase/supabase-js@2';
// Import core entity/component classes so we can create other-player entities
import { Entity, Transform, Health, Renderable } from './gameEngine.js';

export class MMOManager {
    constructor(game) {
        this.game = game;
        this.supabase = null;
        this.playerId = null;
        this.playerName = null;
        this.otherPlayers = new Map();
    // Track last seen timestamps for other players (ms since epoch)
    this.otherPlayersLastSeen = new Map();
        this.chatMessages = [];
        this.lastUpdate = 0;
        this.updateInterval = null;
        this.isConnected = false;
        this.lastPositions = new Map(); // For lazy overlay updates
        this.playerInterpolations = new Map(); // For smooth movement interpolation
        
        this.init();
    }

    async init() {
        try {
            console.log('🌐 Initializing MMO Manager...');
            
            // Initialize Supabase client
            this.supabase = createClient(
                'https://omcwjmvdjswkfjkahchm.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE'
            );

            console.log('✅ Supabase client created');

            // Two-level IDs: persistent accountId (localStorage) and per-tab session id (sessionStorage)
            try {
                // persistent account id/name
                let accountId = localStorage.getItem('MiniHero.accountId');
                let accountName = localStorage.getItem('MiniHero.accountName');
                if (!accountId) accountId = this.generatePlayerId();
                if (!accountName) accountName = this.generatePlayerName();

                // per-tab session id (unique per tab/window)
                let sessionId = sessionStorage.getItem('MiniHero.sessionPlayerId');
                if (!sessionId) {
                    // make session id derived from account id so it's traceable
                    sessionId = accountId + '::' + Math.random().toString(36).substr(2,8);
                    sessionStorage.setItem('MiniHero.sessionPlayerId', sessionId);
                }

                // Detect duplicated tabs: when a tab is duplicated sessionStorage may be cloned.
                // Keep a registry of active session IDs in localStorage and if the sessionId is
                // already present (another tab already registered it), generate a fresh one.
                try {
                    const activeKey = 'MiniHero.activeSessionIds';
                    const activeJson = localStorage.getItem(activeKey);
                    let active = activeJson ? JSON.parse(activeJson) : [];
                    if (active.includes(sessionId)) {
                        // session id is already used by another tab (likely duplicate); create new
                        sessionId = accountId + '::' + Math.random().toString(36).substr(2,8);
                        sessionStorage.setItem('MiniHero.sessionPlayerId', sessionId);
                    }
                    // register this session for other tabs
                    active = active.filter(id => !!id);
                    if (!active.includes(sessionId)) active.push(sessionId);
                    localStorage.setItem(activeKey, JSON.stringify(active));

                    // Ensure we remove our session id on unload
                    window.addEventListener('beforeunload', () => {
                        try {
                            const j = localStorage.getItem(activeKey);
                            const arr = j ? JSON.parse(j) : [];
                            const idx = arr.indexOf(sessionId);
                            if (idx !== -1) {
                                arr.splice(idx, 1);
                                localStorage.setItem(activeKey, JSON.stringify(arr));
                            }
                        } catch (e) { /* ignore */ }
                    });
                } catch (e) {
                    // ignore localStorage errors
                }

                this.accountId = accountId;
                this.playerName = accountName;
                this.playerId = sessionId; // used for DB and entity id
            } catch (e) {
                // storage not available - fall back to generated values
                this.playerId = this.generatePlayerId();
                this.playerName = this.generatePlayerName();
            }

            console.log(`👤 Player: ${this.playerName} (${this.playerId})`);

            // Test database connection
            const { data, error } = await this.supabase.from('players').select('count').limit(1);
            if (error) {
                console.error('❌ Database connection test failed:', error);
                throw error;
            }
            console.log('✅ Database connection successful');

            // Setup database tables if needed
            await this.setupDatabase();

            // Start player session
            await this.startPlayerSession();

            // Load existing players first
            await this.loadExistingPlayers();

            // Clean up any overlays that might exist for our player
            this.cleanupOwnPlayerOverlays();

            // Setup polling for player positions instead of real-time subscriptions
            this.setupPlayerPolling();

            // Start update loop
            this.startUpdateLoop();

            this.isConnected = true;
            this.game.logMessage(`Connected to MMO server as ${this.playerName}!`, 'spawn');
            console.log('🎉 MMO Manager fully initialized');

        } catch (error) {
            console.error('❌ MMO initialization failed:', error);
            this.isConnected = false;
            this.game.logMessage('Failed to connect to MMO server - playing offline', 'damage');
        }
    }

    generatePlayerId() {
        return 'player_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
    }

    generatePlayerName() {
        const adjectives = ['Brave', 'Swift', 'Mighty', 'Noble', 'Fierce', 'Bold', 'Wise', 'Strong'];
        const nouns = ['Warrior', 'Knight', 'Hunter', 'Mage', 'Ranger', 'Paladin', 'Rogue', 'Hero'];
        
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const num = Math.floor(Math.random() * 999) + 1;
        
        return `${adj}${noun}${num}`;
    }

    async setupDatabase() {
        // Note: In a real implementation, these tables would be created via Supabase dashboard
        // This is just for reference of the expected schema
        
        /*
        Expected tables:
        
        players:
        - id (text, primary key)
        - name (text)
        - x (real)
        - y (real)
        - health (integer)
        - max_health (integer)
        - level (integer)
        - kills (integer)
        - last_seen (timestamp)
        - is_online (boolean)
        
        chat_messages:
        - id (uuid, primary key)
        - player_id (text)
        - player_name (text)
        - message (text)
        - created_at (timestamp)
        
        world_events:
        - id (uuid, primary key)
        - event_type (text)
        - data (jsonb)
        - created_at (timestamp)
        */
    }

    async startPlayerSession() {
        if (!this.supabase) {
            console.log('❌ No Supabase client available');
            return;
        }

        try {
            const playerTransform = this.game.player.getComponent('Transform');
            const playerHealth = this.game.player.getComponent('Health');

            console.log(`🚀 Starting player session: ${this.playerName} (${this.playerId})`);
            console.log(`📍 Initial position: (${playerTransform.x.toFixed(1)}, ${playerTransform.y.toFixed(1)})`);

            // Update player's entity ID to match MMO player ID
            const oldEntityId = this.game.player.id;
            if (oldEntityId !== this.playerId) {
                // Update the entity object's id
                this.game.player.id = this.playerId;

                // Re-key the engine.entities map so we don't leave behind the old key
                try {
                    if (this.game.engine && this.game.engine.entities) {
                        // Only replace the map entry if the old key points to our player object
                        const existing = this.game.engine.entities.get(oldEntityId);
                        if (existing === this.game.player) {
                            this.game.engine.entities.delete(oldEntityId);
                            this.game.engine.entities.set(this.playerId, this.game.player);
                            console.log(`� Re-keyed engine.entities: '${oldEntityId}' -> '${this.playerId}'`);
                        } else {
                            // If the map doesn't point to our player, ensure our player is registered at new id
                            this.game.engine.entities.set(this.playerId, this.game.player);
                            console.log(`🔁 Registered player entity at '${this.playerId}'`);
                        }
                    }
                } catch (e) {
                    console.warn('⚠️ Could not re-key engine.entities:', e);
                }

                // Remove any duplicate entities that might exist now that ids are aligned
                if (typeof this.cleanupDuplicateEntities === 'function') {
                    this.cleanupDuplicateEntities();
                }
            }

            // Insert or update player in database
            const { data, error } = await this.supabase
                .from('players')
                .upsert({
                    id: this.playerId,
                    name: this.playerName,
                    x: playerTransform.x,
                    y: playerTransform.y,
                    health: playerHealth.currentHealth,
                    max_health: playerHealth.maxHealth,
                    level: this.game.playerLevel,
                    kills: this.game.enemiesKilled,
                    last_seen: new Date().toISOString(),
                    is_online: true
                })
                .select();

            if (error) {
                console.error('❌ Error starting player session:', error);
            } else {
                console.log('✅ Player session started successfully:', data);
                
                // Persist account id/name (long-lived) and ensure session id is stored per-tab
                try {
                    localStorage.setItem('MiniHero.accountId', this.accountId || this.playerId);
                    localStorage.setItem('MiniHero.accountName', this.playerName);
                    sessionStorage.setItem('MiniHero.sessionPlayerId', this.playerId);
                } catch (e) { /* ignore */ }

                // Immediately update position to ensure it's synced
                this.updatePlayerPosition();

                // Best-effort: mark offline on unload
                window.addEventListener('beforeunload', async () => {
                    try {
                        await this.supabase.from('players').update({ is_online: false }).eq('id', this.playerId);
                    } catch (e) { /* ignore */ }
                });

                // Safety: ensure we don't have an otherPlayers entry for ourselves
                try {
                    if (this.otherPlayers && this.otherPlayers.has(this.playerId)) {
                        console.log('🧹 Removing any otherPlayers entry for our own player');
                        // Remove overlays/name tags
                        this.removeOtherPlayer(this.playerId);
                        this.otherPlayers.delete(this.playerId);
                    }
                } catch (e) {
                    console.warn('⚠️ Error cleaning up self entry in otherPlayers:', e);
                }
            }
        } catch (error) {
            console.error('❌ Error in startPlayerSession:', error);
        }
    }

    async loadExistingPlayers() {
        if (!this.supabase) return;

        try {
            console.log('👥 Loading existing online players...');

            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('is_online', true)
                .neq('id', this.playerId); // Don't load ourselves

            if (error) {
                console.error('❌ Error loading existing players:', error);
                return;
            }

            console.log(`📊 Found ${data.length} existing online players:`, data);

            // Clean up any existing overlays or name tags for our player
            this.cleanupOwnPlayerOverlays();

            // Create entities for existing players
            for (const playerData of data) {
                // Double-check we're not loading our own player
                if (playerData.id !== this.playerId) {
                    await this.updateOtherPlayerSmooth(playerData);
                }
            }

        } catch (error) {
            console.error('❌ Error in loadExistingPlayers:', error);
        }
    }

    setupPlayerPolling() {
        if (!this.supabase) {
            console.log('❌ No Supabase client for polling');
            return;
        }

        console.log('⏰ Setting up player position polling...');

        // Poll player positions every 5 seconds
        this.pollingInterval = setInterval(async () => {
            try {
                await this.pollPlayerPositions();
            } catch (error) {
                console.error('❌ Error in player position polling:', error);
            }
        }, 5000);

        // Initial poll
        this.pollPlayerPositions();

        console.log('✅ Player position polling setup complete');
    }

    async pollPlayerPositions() {
        if (!this.supabase || !this.playerId) return;

        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('is_online', true)
                .neq('id', this.playerId);

            if (error) {
                console.error('❌ Error polling player positions:', error);
                return;
            }

            console.log(`📊 Polled ${data.length} online players`);

            // Update last seen timestamps
            const currentTime = Date.now();
            data.forEach(player => {
                this.otherPlayersLastSeen.set(player.id, currentTime);
            });

            // Handle players who are no longer online
            const polledIds = new Set(data.map(p => p.id));
            for (const [playerId] of this.otherPlayers) {
                if (!polledIds.has(playerId)) {
                    console.log(`� Player ${playerId} went offline`);
                    this.removeOtherPlayer(playerId);
                }
            }

            // Update or create players with smooth interpolation
            for (const playerData of data) {
                await this.updateOtherPlayerSmooth(playerData);
            }

        } catch (error) {
            console.error('❌ Error in pollPlayerPositions:', error);
        }
    }

    async handlePlayerUpdate(payload) {
        const { eventType, new: newRecord, old: oldRecord } = payload;

        console.log(`🔄 Player update event: ${eventType}`, { newRecord, oldRecord });
        console.log(`🆔 Our player ID: ${this.playerId}`);
        console.log(`🆔 Update player ID: ${newRecord?.id || oldRecord?.id}`);

        // Double-check we have our player ID set
        if (!this.playerId) {
            console.log('⚠️ Our player ID not set yet, ignoring update');
            return;
        }

        if (eventType === 'INSERT' || eventType === 'UPDATE') {
            // Ignore events that belong to this session
            if (newRecord && newRecord.id === this.playerId) {
                console.log('🔄 Ignoring update for our own session ID');
                return;
            }

            // If record references persistent accountId fields (optional), ignore if matches our account
            if (newRecord && this.accountId && (newRecord.account_id === this.accountId || newRecord.accountId === this.accountId)) {
                console.log('🔄 Ignoring update for our own account id');
                return;
            }

            if (newRecord && newRecord.id !== this.playerId) {
                console.log(`👤 Real-time update for other player: ${newRecord.name} moving to (${newRecord.x}, ${newRecord.y})`);
                // Update last-seen timestamp
                this.otherPlayersLastSeen.set(newRecord.id, Date.now());
                this.updateOtherPlayerSmooth(newRecord);
            } else if (newRecord && newRecord.id === this.playerId) {
                console.log('🔄 Received update for our own player, ignoring');
            } else {
                console.log('⚠️ Received update with no new record or matching our ID');
            }
        } else if (eventType === 'DELETE') {
            if (oldRecord && oldRecord.id !== this.playerId) {
                console.log(`👋 Removing player: ${oldRecord.name} (${oldRecord.id})`);
                this.removeOtherPlayer(oldRecord.id);
            } else if (oldRecord && oldRecord.id === this.playerId) {
                console.log('🔄 Received delete for our own player, ignoring');
            }
        }
    }

    updateOtherPlayer(playerData) {
        // Double-check we're not creating our own player
        if (playerData.id === this.playerId) {
            console.log('⚠️ Attempted to update our own player, skipping');
            return;
        }

        if (!playerData.is_online) {
            this.removeOtherPlayer(playerData.id);
            return;
        }

        console.log(`🔄 Updating other player: ${playerData.name} at (${playerData.x}, ${playerData.y})`);

        const alreadyTracked = this.otherPlayers.has(playerData.id);
        // Update last seen timestamp
        this.otherPlayersLastSeen.set(playerData.id, Date.now());

        // If we already have an entity for this player, update its components
        if (alreadyTracked) {
            const tracked = this.otherPlayers.get(playerData.id);

            // If tracked is an Entity, update its Transform/Health
            if (tracked && typeof tracked.getComponent === 'function') {
                const transform = tracked.getComponent('Transform');
                const health = tracked.getComponent('Health');

                if (transform) {
                    console.log(`📍 Updating position for ${playerData.name} to (${playerData.x}, ${playerData.y})`);
                    transform.setPosition(playerData.x, playerData.y);
                }
                if (health) {
                    health.currentHealth = playerData.health ?? health.currentHealth;
                    health.maxHealth = playerData.max_health ?? health.maxHealth;
                }

                // Update overlay position
                this.updatePlayerOverlayById(playerData.id);
                return;
            }
        }

        // Create a lightweight Entity representation for other players so they exist in the engine
        try {
            console.log(`🆕 Creating new entity for other player: ${playerData.name}`);
            const entity = new Entity(playerData.id);
            entity
                .addComponent(new Transform(playerData.x, playerData.y))
                .addComponent(new Health(playerData.health ?? 100))
                .addComponent(new Renderable('human', 16, 16, 2, 10));

            this.game.engine.addEntity(entity);
            this.otherPlayers.set(playerData.id, entity);

            // Create a floating name tag linked to this entity
            this.createPlayerNameTag(entity, playerData.name);

            // Create/update overlay
            this.updatePlayerOverlayById(playerData.id);

            if (!alreadyTracked) {
                this.game.logMessage(`${playerData.name} joined the world!`, 'spawn');
            }
        } catch (err) {
            // Fallback: store plain data if creating an entity fails for any reason
            console.error('Error creating other player entity, falling back to raw data:', err);
            this.otherPlayers.set(playerData.id, {
                id: playerData.id,
                name: playerData.name,
                x: playerData.x,
                y: playerData.y,
                health: playerData.health,
                max_health: playerData.max_health
            });
            this.updatePlayerOverlay(playerData);
        }
    }

    async updateOtherPlayerSmooth(playerData) {
        // Double-check we're not creating our own player
        if (playerData.id === this.playerId) {
            console.log('⚠️ Attempted to update our own player, skipping');
            return;
        }

        if (!playerData.is_online) {
            this.removeOtherPlayer(playerData.id);
            return;
        }

        const alreadyTracked = this.otherPlayers.has(playerData.id);
        const targetX = playerData.x;
        const targetY = playerData.y;

        if (alreadyTracked) {
            const tracked = this.otherPlayers.get(playerData.id);

            // If tracked is an Entity, start interpolation to new position
            if (tracked && typeof tracked.getComponent === 'function') {
                const transform = tracked.getComponent('Transform');
                const health = tracked.getComponent('Health');

                if (transform) {
                    const currentX = transform.x;
                    const currentY = transform.y;
                    const distance = Math.sqrt((targetX - currentX) ** 2 + (targetY - currentY) ** 2);

                    // If the player has moved significantly, start interpolation
                    if (distance > 5) { // Only interpolate if moved more than 5 pixels
                        console.log(`🚶 Starting interpolation for ${playerData.name}: (${currentX.toFixed(1)}, ${currentY.toFixed(1)}) -> (${targetX}, ${targetY})`);

                        // Start smooth interpolation
                        this.startPlayerInterpolation(playerData.id, transform, currentX, currentY, targetX, targetY);
                    }

                    // Update health immediately
                    if (health) {
                        health.currentHealth = playerData.health ?? health.currentHealth;
                        health.maxHealth = playerData.max_health ?? health.maxHealth;
                    }
                }

                return;
            }
        }

        // Create a new player entity at the target position (no interpolation for new players)
        try {
            console.log(`🆕 Creating new entity for other player: ${playerData.name} at (${targetX}, ${targetY})`);
            const entity = new Entity(playerData.id);
            entity
                .addComponent(new Transform(targetX, targetY))
                .addComponent(new Health(playerData.health ?? 100))
                .addComponent(new Renderable('human', 16, 16, 2, 10));

            this.game.engine.addEntity(entity);
            this.otherPlayers.set(playerData.id, entity);

            // Create a floating name tag linked to this entity
            this.createPlayerNameTag(entity, playerData.name);

            // Create/update overlay
            this.updatePlayerOverlayById(playerData.id);

            if (!alreadyTracked) {
                this.game.logMessage(`${playerData.name} joined the world!`, 'spawn');
            }
        } catch (err) {
            // Fallback: store plain data if creating an entity fails for any reason
            console.error('Error creating other player entity, falling back to raw data:', err);
            this.otherPlayers.set(playerData.id, {
                id: playerData.id,
                name: playerData.name,
                x: targetX,
                y: targetY,
                health: playerData.health,
                max_health: playerData.max_health
            });
            this.updatePlayerOverlay(playerData);
        }
    }

    startPlayerInterpolation(playerId, transform, startX, startY, targetX, targetY) {
        // Calculate distance and duration (faster movement for longer distances)
        const distance = Math.sqrt((targetX - startX) ** 2 + (targetY - startY) ** 2);
        const baseSpeed = 80; // pixels per second
        const duration = Math.max(1, distance / baseSpeed); // At least 1 second

        console.log(`⏱️ Interpolation duration: ${duration.toFixed(1)}s for distance: ${distance.toFixed(1)}px`);

        // Cancel any existing interpolation for this player
        if (this.playerInterpolations.has(playerId)) {
            clearInterval(this.playerInterpolations.get(playerId));
        }

        const startTime = performance.now();
        const entity = this.otherPlayers.get(playerId);

        // Start walking animation
        if (entity && entity.getComponent) {
            const renderable = entity.getComponent('Renderable');
            if (renderable) {
                renderable.forceSetState('walking');
            }
        }

        const interpolationId = setInterval(() => {
            const elapsed = (performance.now() - startTime) / 1000;
            const progress = Math.min(elapsed / duration, 1);

            // Smooth easing function (ease-out)
            const easedProgress = 1 - Math.pow(1 - progress, 3);

            const currentX = startX + (targetX - startX) * easedProgress;
            const currentY = startY + (targetY - startY) * easedProgress;

            // Update position
            transform.setPosition(currentX, currentY);

            // Update overlay position
            this.updatePlayerOverlayById(playerId);

            // Check if interpolation is complete
            if (progress >= 1) {
                console.log(`✅ Interpolation complete for ${playerId}`);
                clearInterval(interpolationId);
                this.playerInterpolations.delete(playerId);

                // Stop walking animation
                if (entity && entity.getComponent) {
                    const renderable = entity.getComponent('Renderable');
                    if (renderable) {
                        renderable.setState('idle');
                    }
                }
            }
        }, 16); // ~60fps updates

        this.playerInterpolations.set(playerId, interpolationId);
    }

    updatePlayerOverlay(playerData) {
        // Backwards-compatible overlay updater: accepts either an entity or raw data
        const id = playerData.id || (playerData.entity && playerData.entity.id);
        if (!id) return;

        // Safety check: don't create overlay for our own player
        if (id === this.playerId) {
            console.log('⚠️ Attempted to create overlay for our own player, skipping');
            return;
        }

        let overlay = document.getElementById(`player-overlay-${id}`);

        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = `player-overlay-${id}`;
            overlay.className = 'other-player-overlay';
            overlay.innerHTML = `
                <div class="other-player-sprite">🧙</div>
                <div class="other-player-name">${playerData.name || ''}</div>
            `;
            overlay.style.cssText = `
                position: absolute;
                z-index: 150;
                pointer-events: none;
                text-align: center;
                font-size: 12px;
                color: #00ffff;
                font-weight: bold;
                text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
            `;
            document.body.appendChild(overlay);
        }

        // Determine world position
        let worldX = 0, worldY = 0;
        if (playerData && typeof playerData.getComponent === 'function') {
            const transform = playerData.getComponent('Transform');
            if (transform) {
                worldX = transform.x;
                worldY = transform.y;
            }
        } else if (playerData && typeof playerData.x !== 'undefined') {
            worldX = playerData.x;
            worldY = playerData.y;
        } else {
            // try to read tracked entity by id
            const tracked = this.otherPlayers.get(id);
            if (tracked && typeof tracked.getComponent === 'function') {
                const t = tracked.getComponent('Transform');
                if (t) { worldX = t.x; worldY = t.y; }
            }
        }

        const screenPos = this.game.engine.camera.worldToScreen(worldX, worldY);
        overlay.style.left = (screenPos.x - 15) + 'px';
        overlay.style.top = (screenPos.y - 30) + 'px';
    }

    // Helper to update overlay when we only have id
    updatePlayerOverlayById(playerId) {
        // Safety check: don't update overlay for our own player
        if (playerId === this.playerId) {
            return;
        }

        const tracked = this.otherPlayers.get(playerId);
        if (!tracked) return;
        this.updatePlayerOverlay(tracked);
    }

    removeOtherPlayerOverlay(playerId) {
        console.log(`🗑️ Removing other player overlay: ${playerId}`);
        
        const overlay = document.getElementById(`player-overlay-${playerId}`);
        if (overlay) {
            document.body.removeChild(overlay);
        }
        
        // Also remove name tag if it exists
        const nameTag = document.querySelector(`[data-player-id="${playerId}"]`);
        if (nameTag) {
            document.body.removeChild(nameTag);
            console.log(`🏷️ Removed name tag for ${playerId}`);
        }
        
        // If we stored an Entity, remove it from the engine too
        const tracked = this.otherPlayers.get(playerId);
        if (tracked && typeof tracked.getComponent === 'function') {
            try { this.game.engine.removeEntity(playerId); } catch (e) { /* ignore */ }
        }

        this.otherPlayers.delete(playerId);
    }

    cleanupOwnPlayerOverlays() {
        console.log('🧹 Cleaning up any overlays for our own player...');

        // Remove any overlay that might exist for our player ID
        const ownOverlay = document.getElementById(`player-overlay-${this.playerId}`);
        if (ownOverlay) {
            console.log('🗑️ Removing overlay for our own player');
            document.body.removeChild(ownOverlay);
        }

        // Remove any name tag that might exist for our player
        const ownNameTags = document.querySelectorAll(`[data-player-id="${this.playerId}"]`);
        ownNameTags.forEach(tag => {
            console.log('🏷️ Removing name tag for our own player');
            document.body.removeChild(tag);
        });

        // Also remove any overlay with our player name
        const nameOverlays = document.querySelectorAll('.other-player-overlay');
        nameOverlays.forEach(overlay => {
            const nameElement = overlay.querySelector('.other-player-name');
            if (nameElement && nameElement.textContent.includes(this.playerName)) {
                console.log('🗑️ Removing overlay with our player name');
                document.body.removeChild(overlay);
            }
        });
    }



    createPlayerNameTag(player, name) {
        // Safety check: don't create name tag for our own player
        if (player.id === this.playerId) {
            console.log('⚠️ Attempted to create name tag for our own player, skipping');
            return;
        }

        // Create floating name tag above player
        const nameTag = document.createElement('div');
        nameTag.className = 'player-nametag';
        nameTag.dataset.playerId = player.id; // Add player ID for easier cleanup
        nameTag.textContent = `👤 ${name}`;
        nameTag.style.position = 'absolute';
        nameTag.style.color = '#00ffff'; // Cyan color to distinguish from NPCs
        nameTag.style.fontSize = '14px';
        nameTag.style.fontWeight = 'bold';
        nameTag.style.textShadow = '2px 2px 4px rgba(0,0,0,0.9)';
        nameTag.style.pointerEvents = 'none';
        nameTag.style.zIndex = '200';
        nameTag.style.textAlign = 'center';
        nameTag.style.minWidth = '80px';
        nameTag.style.background = 'rgba(0, 0, 0, 0.7)';
        nameTag.style.padding = '2px 6px';
        nameTag.style.borderRadius = '4px';
        nameTag.style.border = '1px solid #00ffff';
        
        document.body.appendChild(nameTag);
        
        console.log(`🏷️ Created name tag for ${name}`);

        // Update name tag position in render loop
        const updateNameTag = () => {
            if (!document.body.contains(nameTag)) return;
            
            const transform = player.getComponent('Transform');
            if (transform) {
                const screenPos = this.game.engine.camera.worldToScreen(transform.x, transform.y - 50);
                nameTag.style.left = (screenPos.x - 40) + 'px';
                nameTag.style.top = screenPos.y + 'px';
            }
            
            requestAnimationFrame(updateNameTag);
        };
        
        updateNameTag();
    }

    removeOtherPlayer(playerId) {
        console.log(`🗑️ Removing other player: ${playerId}`);
        const otherPlayer = this.otherPlayers.get(playerId);
        if (otherPlayer) {
            this.game.engine.removeEntity(playerId);
            this.otherPlayers.delete(playerId);
            
            // Remove name tag
            const nameTag = document.querySelector(`[data-player-id="${playerId}"]`);
            if (nameTag) {
                document.body.removeChild(nameTag);
                console.log(`🏷️ Removed name tag for ${playerId}`);
            }
            
            // Clean up lazy update tracking
            this.lastPositions.delete(playerId);
            
            // Clean up any ongoing interpolation
            if (this.playerInterpolations.has(playerId)) {
                clearInterval(this.playerInterpolations.get(playerId));
                this.playerInterpolations.delete(playerId);
                console.log(`🛑 Stopped interpolation for ${playerId}`);
            }
            
            this.game.logMessage(`Player left the world`, 'damage');
        }
    }

    startUpdateLoop() {
        console.log('⏰ Starting update loops...');
        
        // Update player position every 1 second (more frequent)
        this.updateInterval = setInterval(() => {
            try {
                this.updatePlayerPosition();
            } catch (error) {
                console.error('❌ Error in position update loop:', error);
            }
        }, 1000);

        // Also update position when player moves (real-time)
        this.setupMovementTracking();

        // Update other player overlays every frame
        this.startOverlayUpdateLoop();

        // Cleanup offline players every 30 seconds
        setInterval(() => {
            try {
                console.log('🧹 Cleanup timer triggered');
                this.cleanupOfflinePlayers();
            } catch (error) {
                console.error('❌ Error in cleanup loop:', error);
            }
        }, 30000);

        console.log('✅ Update loops started');
    }

    startOverlayUpdateLoop() {
        // Lazy update variables
        let frameCount = 0;
        const updateInterval = 1; // Update every frame for testing
        const positionThreshold = 0; // Update on any movement

        const updateOverlays = () => {
            try {
                frameCount++;
                let needsUpdate = false;

                // Debug: Log if we have players
                if (this.otherPlayers.size > 0 && frameCount % 60 === 0) {
                    console.log(`🔄 Overlay update - ${this.otherPlayers.size} players`);
                }

                // Check if any player positions have changed significantly
                this.otherPlayers.forEach((playerData, playerId) => {
                    if (playerId === this.playerId) return;

                    let currentX = 0, currentY = 0;

                    // Get current position
                    if (playerData && typeof playerData.getComponent === 'function') {
                        const transform = playerData.getComponent('Transform');
                        if (transform) {
                            currentX = transform.x;
                            currentY = transform.y;
                        }
                    } else if (playerData && typeof playerData.x !== 'undefined') {
                        currentX = playerData.x;
                        currentY = playerData.y;
                    }

                    // Get last position
                    const lastPos = this.lastPositions.get(playerId);
                    if (!lastPos) {
                        // First time seeing this player
                        this.lastPositions.set(playerId, { x: currentX, y: currentY });
                        needsUpdate = true;
                    } else {
                        // Check if position changed significantly
                        const dx = Math.abs(currentX - lastPos.x);
                        const dy = Math.abs(currentY - lastPos.y);
                        if (dx > positionThreshold || dy > positionThreshold) {
                            lastPos.x = currentX;
                            lastPos.y = currentY;
                            needsUpdate = true;
                        }
                    }
                });

                // Only update overlays if it's time or positions changed
                if (frameCount >= updateInterval || needsUpdate) {
                    this.otherPlayers.forEach((playerData, playerId) => {
                        if (playerId === this.playerId) return;

                        const overlay = document.getElementById(`player-overlay-${playerId}`);
                        if (overlay) {
                            const lastPos = this.lastPositions.get(playerId);
                            if (lastPos) {
                                const screenPos = this.game.engine.camera.worldToScreen(lastPos.x, lastPos.y);
                                overlay.style.left = (screenPos.x - 15) + 'px';
                                overlay.style.top = (screenPos.y - 30) + 'px';
                            }
                        }
                    });

                    frameCount = 0; // Reset frame counter
                }

                if (this.isConnected) {
                    requestAnimationFrame(updateOverlays);
                }
            } catch (error) {
                console.error('❌ Error in overlay update loop:', error);
                if (this.isConnected) {
                    requestAnimationFrame(updateOverlays);
                }
            }
        };

        updateOverlays();
    }

    setupMovementTracking() {
        // Track when our player moves and update immediately
        let lastX = 0, lastY = 0;
        let lastUpdateTime = 0;
        
        const checkMovement = () => {
            if (!this.game.player || !this.isConnected) return;
            
            const transform = this.game.player.getComponent('Transform');
            if (!transform) return;
            
            const currentX = Math.round(transform.x);
            const currentY = Math.round(transform.y);
            const currentTime = Date.now();
            
            // If player moved significantly or enough time has passed, update position
            const movedEnough = Math.abs(currentX - lastX) > 5 || Math.abs(currentY - lastY) > 5;
            const timeEnough = currentTime - lastUpdateTime > 2000; // Update at least every 2 seconds
            
            if (movedEnough || timeEnough) {
                console.log(`🏃 Player moved from (${lastX}, ${lastY}) to (${currentX}, ${currentY})`);
                this.updatePlayerPosition();
                lastX = currentX;
                lastY = currentY;
                lastUpdateTime = currentTime;
            }
            
            requestAnimationFrame(checkMovement);
        };
        
        checkMovement();
    }

    async updatePlayerPosition() {
        if (!this.supabase || !this.isConnected) {
            console.log('❌ Cannot update position - not connected to Supabase');
            return;
        }

        try {
            const playerTransform = this.game.player.getComponent('Transform');
            const playerHealth = this.game.player.getComponent('Health');

            if (!playerTransform || !playerHealth) {
                console.log('❌ Missing player components for position update');
                return;
            }

            const currentX = Math.round(playerTransform.x);
            const currentY = Math.round(playerTransform.y);

            console.log(`🔄 Updating player position: (${currentX}, ${currentY}) for ${this.playerName} (${this.playerId})`);

            const { data, error } = await this.supabase
                .from('players')
                .update({
                    x: currentX,
                    y: currentY,
                    health: playerHealth.currentHealth,
                    max_health: playerHealth.maxHealth,
                    level: this.game.playerLevel,
                    kills: this.game.enemiesKilled,
                    last_seen: new Date().toISOString()
                })
                .eq('id', this.playerId)
                .select();

            if (error) {
                console.error('❌ Error updating player position:', error);
            } else {
                console.log('✅ Player position updated successfully:', data);
            }
        } catch (error) {
            console.error('❌ Error in updatePlayerPosition:', error);
        }
    }

    async cleanupOfflinePlayers() {
        if (!this.supabase) return;

        try {
            // Mark players as offline if they haven't been seen in 60 seconds
            const now = Date.now();
            const inactivityThreshold = 60 * 1000; // 60s

            // Build a list of players that are stale locally
            const staleIds = [];
            this.otherPlayersLastSeen.forEach((lastSeen, playerId) => {
                if (now - lastSeen > inactivityThreshold) {
                    staleIds.push(playerId);
                }
            });

            if (staleIds.length === 0) return;

            console.log(`🧹 Marking ${staleIds.length} players offline due to inactivity`, staleIds);

            // Mark them offline in the database
            const { error: dbError } = await this.supabase
                .from('players')
                .update({ is_online: false })
                .in('id', staleIds);

            if (dbError) {
                console.error('Error marking offline players in DB:', dbError);
            }

            // Remove them locally
            staleIds.forEach(id => this.removeOtherPlayer(id));
        } catch (error) {
            console.error('Error in cleanupOfflinePlayers:', error);
        }
    }

    async sendChatMessage(message) {
        if (!this.supabase || !message || typeof message !== 'string') return;

        const trimmedMessage = message.trim();
        if (trimmedMessage.length === 0 || trimmedMessage.length > 200) {
            console.warn('Invalid chat message length');
            return;
        }

        try {
            const { error } = await this.supabase
                .from('chat_messages')
                .insert({
                    player_id: this.playerId,
                    player_name: this.playerName,
                    message: trimmedMessage
                });

            if (error) {
                console.error('Error sending chat message:', error);
                this.game.logMessage('Failed to send chat message', 'damage');
            }
        } catch (error) {
            console.error('Error in sendChatMessage:', error);
        }
    }

    handleChatMessage(payload) {
        const messageData = payload.new;
        if (messageData && messageData.player_id !== this.playerId) {
            this.game.logMessage(`[${messageData.player_name}]: ${messageData.message}`, 'chat');
        }
    }

    async loadRecentChatMessages() {
        if (!this.supabase) return;

        try {
            const { data, error } = await this.supabase
                .from('chat_messages')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error loading chat messages:', error);
                return;
            }

            // Display recent messages in reverse order (oldest first)
            data.reverse().forEach(msg => {
                if (msg.player_id !== this.playerId) {
                    this.game.logMessage(`[${msg.player_name}]: ${msg.message}`, 'chat');
                }
            });
        } catch (error) {
            console.error('Error in loadRecentChatMessages:', error);
        }
    }

    async disconnect() {
        if (!this.supabase) return;

        try {
            // Mark player as offline
            await this.supabase
                .from('players')
                .update({ is_online: false })
                .eq('id', this.playerId);

            // Clear update interval
            if (this.updateInterval) {
                clearInterval(this.updateInterval);
            }

            // Clear polling interval
            if (this.pollingInterval) {
                clearInterval(this.pollingInterval);
            }

            // Remove all other players
            this.otherPlayers.forEach((player, playerId) => {
                this.removeOtherPlayer(playerId);
            });

            this.isConnected = false;
            console.log('✅ Disconnected from MMO server');
        } catch (error) {
            console.error('Error disconnecting:', error);
        }
    }

    getOnlinePlayerCount() {
        return this.otherPlayers.size + 1; // +1 for current player
    }

    getPlayerName() {
        return this.playerName;
    }

    // Debug function to test database operations
    async testDatabaseOperations() {
        if (!this.supabase) {
            console.log('❌ No Supabase client available for testing');
            return;
        }

        console.log('🧪 Testing database operations...');

        try {
            // Test read
            const { data: readData, error: readError } = await this.supabase
                .from('players')
                .select('*')
                .limit(5);

            if (readError) {
                console.error('❌ Read test failed:', readError);
            } else {
                console.log('✅ Read test successful:', readData);
            }

            // Test write
            const testPlayer = {
                id: 'test_' + Date.now(),
                name: 'TestPlayer',
                x: 100,
                y: 100,
                health: 100,
                max_health: 100,
                level: 1,
                kills: 0,
                is_online: true
            };

            const { data: writeData, error: writeError } = await this.supabase
                .from('players')
                .insert(testPlayer)
                .select();

            if (writeError) {
                console.error('❌ Write test failed:', writeError);
            } else {
                console.log('✅ Write test successful:', writeData);
                
                // Clean up test data
                await this.supabase
                    .from('players')
                    .delete()
                    .eq('id', testPlayer.id);
                console.log('🧹 Test data cleaned up');
            }

        } catch (error) {
            console.error('❌ Database test error:', error);
        }
    }

    // Debug function to check current players in database
    async checkPlayersInDatabase() {
        if (!this.supabase) {
            console.log('❌ No Supabase client available');
            return;
        }

        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .order('last_seen', { ascending: false });

            if (error) {
                console.error('❌ Error checking players:', error);
            } else {
                console.log('📊 Current players in database:', data);
                console.log(`👥 Total players: ${data.length}`);
                console.log(`🟢 Online players: ${data.filter(p => p.is_online).length}`);
                console.log(`🔴 Offline players: ${data.filter(p => !p.is_online).length}`);
                
                // Show other players (not us)
                const otherPlayers = data.filter(p => p.id !== this.playerId);
                console.log('👥 Other players:', otherPlayers);
            }
        } catch (error) {
            console.error('❌ Error in checkPlayersInDatabase:', error);
        }
    }

    // Debug function to create a test other player
    async createTestPlayer() {
        const playerTransform = this.game.player.getComponent('Transform');
        const testPlayerData = {
            id: 'test_player_' + Date.now(),
            name: 'TestPlayer',
            x: playerTransform.x + 100,
            y: playerTransform.y + 50,
            health: 100,
            max_health: 100,
            level: 1,
            kills: 0,
            is_online: true
        };

        console.log('🧪 Creating test player:', testPlayerData);
        await this.updateOtherPlayerSmooth(testPlayerData);
    }

    // Debug function to clean up any duplicate entities
    cleanupDuplicateEntities() {
        console.log('🧹 Cleaning up potential duplicate entities...');
        
        // Remove any entity that has our player ID but isn't our actual player
        const allEntities = Array.from(this.game.engine.entities.values());
        const duplicates = allEntities.filter(entity => 
            entity.id === this.playerId && entity !== this.game.player
        );
        
        console.log(`Found ${duplicates.length} duplicate entities`);
        
        duplicates.forEach(duplicate => {
            console.log(`🗑️ Removing duplicate entity: ${duplicate.id}`);
            this.game.engine.removeEntity(duplicate.id);
            this.lastPositions.delete(duplicate.id); // Clean up lazy update tracking
        });
        
        // Also clean up any name tags that might be for our own player
        const nameTags = document.querySelectorAll(`[data-player-id="${this.playerId}"]`);
        nameTags.forEach(tag => {
            console.log('🏷️ Removing duplicate name tag');
            document.body.removeChild(tag);
        });
    }

    // Debug function to simulate another player moving
    simulatePlayerMovement() {
        const otherPlayerIds = Array.from(this.otherPlayers.keys());
        if (otherPlayerIds.length === 0) {
            console.log('❌ No other players to simulate movement for');
            return;
        }

        const playerId = otherPlayerIds[0];
        const otherPlayer = this.otherPlayers.get(playerId);
        const transform = otherPlayer.getComponent('Transform');
        
        // Move the player to a random nearby position
        const newX = transform.x + (Math.random() - 0.5) * 200;
        const newY = transform.y + (Math.random() - 0.5) * 200;
        
        console.log(`🎭 Simulating movement for ${playerId} to (${newX}, ${newY})`);
        
        // Simulate receiving an update
        this.updateOtherPlayerSmooth({
            id: playerId,
            name: 'SimulatedPlayer',
            x: newX,
            y: newY,
            health: 100,
            max_health: 100,
            level: 1,
            kills: 0,
            is_online: true
        });
    }

    // Debug function to test all other players movement
    testAllPlayersMovement() {
        console.log(`🎭 Testing movement for all ${this.otherPlayers.size} other players`);
        
        this.otherPlayers.forEach((player, playerId) => {
            const transform = player.getComponent('Transform');
            if (transform) {
                const newX = transform.x + (Math.random() - 0.5) * 100;
                const newY = transform.y + (Math.random() - 0.5) * 100;
                
                console.log(`🎭 Moving ${playerId} to (${newX}, ${newY})`);
                transform.setPosition(newX, newY);
            }
        });
    }

    // Debug function to check what's happening with real-time updates
    async forceCheckDatabase() {
        if (!this.supabase) return;
        
        console.log('🔍 Force checking database for changes...');
        
        try {
            const { data, error } = await this.supabase
                .from('players')
                .select('*')
                .eq('is_online', true)
                .neq('id', this.playerId);

            if (error) {
                console.error('❌ Error checking database:', error);
                return;
            }

            console.log('📊 Current other players in database:', data);
            
            // Update all other players with fresh data
            for (const playerData of data) {
                console.log(`🔄 Force updating ${playerData.name} at (${playerData.x}, ${playerData.y})`);
                await this.updateOtherPlayerSmooth(playerData);
            }
            
        } catch (error) {
            console.error('❌ Error in forceCheckDatabase:', error);
        }
    }

    // Comprehensive debug function
    debugEntities() {
        console.log('🔍 === ENTITY DEBUG REPORT ===');
        
        // Check our player
        console.log('👤 Our Player:');
        console.log('  ID:', this.playerId);
        console.log('  Name:', this.playerName);
        if (this.game.player) {
            const transform = this.game.player.getComponent('Transform');
            console.log('  Position:', transform ? `(${transform.x.toFixed(1)}, ${transform.y.toFixed(1)})` : 'No transform');
            console.log('  Entity ID:', this.game.player.id);
        }
        
        // Check other players
        console.log('\n👥 Other Players:');
        console.log('  Tracked count:', this.otherPlayers.size);
        this.otherPlayers.forEach((player, id) => {
            console.log(`  Player ${id}:`);
            const transform = player.getComponent('Transform');
            const renderable = player.getComponent('Renderable');
            console.log('    Position:', transform ? `(${transform.x.toFixed(1)}, ${transform.y.toFixed(1)})` : 'No transform');
            console.log('    Renderable:', renderable ? `${renderable.entityType} (z:${renderable.zIndex})` : 'No renderable');
            console.log('    In engine:', this.game.engine.entities.has(id));
        });
        
        // Check all entities in engine
        console.log('\n🎮 All Engine Entities:');
        this.game.engine.entities.forEach((entity, id) => {
            const transform = entity.getComponent('Transform');
            const renderable = entity.getComponent('Renderable');
            const ai = entity.getComponent('AI');
            const npc = entity.getComponent('NPC');
            
            let type = 'Unknown';
            if (id === this.playerId) type = 'Our Player';
            else if (this.otherPlayers.has(id)) type = 'Other Player';
            else if (npc) type = 'NPC';
            else if (ai) type = 'Enemy';
            
            console.log(`  ${id} (${type}):`);
            console.log('    Position:', transform ? `(${transform.x.toFixed(1)}, ${transform.y.toFixed(1)})` : 'No transform');
            console.log('    Sprite:', renderable ? renderable.entityType : 'No sprite');
        });
        
        // Check name tags
        console.log('\n🏷️ Name Tags:');
        const nameTags = document.querySelectorAll('.player-nametag');
        console.log('  Count:', nameTags.length);
        nameTags.forEach((tag, index) => {
            console.log(`  Tag ${index}: "${tag.textContent}" at (${tag.style.left}, ${tag.style.top})`);
        });
    }

    // Simple test - create a basic entity like an enemy to see if it renders
    createTestEntity() {
        console.log('🧪 Creating test entity...');
        
        // Use the game's createEnemy method to create a test entity
        const playerTransform = this.game.player.getComponent('Transform');
        const testEnemy = this.game.createEnemy(
            playerTransform.x + 100, 
            playerTransform.y + 100, 
            'bandit'
        );
        
        console.log('✅ Test entity created:', testEnemy.id);
        return testEnemy;
    }

    // Remove all other player entities and recreate them
    resetOtherPlayers() {
        console.log('🔄 Resetting all other players...');
        
        // Remove all existing other players
        this.otherPlayers.forEach((player, id) => {
            this.game.engine.removeEntity(id);
        });
        this.otherPlayers.clear();
        this.lastPositions.clear(); // Clear lazy update tracking
        
        // Remove all name tags
        const nameTags = document.querySelectorAll('.player-nametag');
        nameTags.forEach(tag => document.body.removeChild(tag));
        
        // Reload from database
        this.loadExistingPlayers();
    }

    // Complete cleanup - remove all other player overlays
    completeCleanup() {
        console.log('🧹 Complete cleanup of other player overlays...');
        
        // Remove all other player overlays
        this.otherPlayers.forEach((playerData, playerId) => {
            this.removeOtherPlayerOverlay(playerId);
        });
        
        this.otherPlayers.clear();
        this.lastPositions.clear(); // Clear lazy update tracking
        
        // Clear all ongoing interpolations
        this.playerInterpolations.forEach((intervalId, playerId) => {
            clearInterval(intervalId);
        });
        this.playerInterpolations.clear();
        
        console.log('✅ Complete cleanup finished');
    }

    // Test if real-time database sync is working
    async testRealTimeSync() {
        if (!this.supabase) {
            console.log('❌ No Supabase client');
            return;
        }

        console.log('🧪 Testing real-time database sync...');
        
        // 1. Update our position in database
        const transform = this.game.player.getComponent('Transform');
        const testX = transform.x + Math.random() * 100;
        const testY = transform.y + Math.random() * 100;
        
        console.log(`📤 Sending position update: (${testX}, ${testY})`);
        
        const { error } = await this.supabase
            .from('players')
            .update({ x: testX, y: testY })
            .eq('id', this.playerId);
            
        if (error) {
            console.error('❌ Failed to update position:', error);
        } else {
            console.log('✅ Position updated in database');
        }
        
        // 2. Check if we can read it back
        setTimeout(async () => {
            const { data, error: readError } = await this.supabase
                .from('players')
                .select('x, y')
                .eq('id', this.playerId)
                .single();
                
            if (readError) {
                console.error('❌ Failed to read position:', readError);
            } else {
                console.log(`📥 Read back position: (${data.x}, ${data.y})`);
                console.log(`✅ Database sync ${data.x === testX && data.y === testY ? 'WORKING' : 'NOT WORKING'}`);
            }
        }, 1000);
    }

    // Force update a fake player position to test real-time sync
    async testFakePlayerUpdate() {
        if (!this.supabase) return;

        console.log('🧪 Testing fake player update...');
        
        // Create a fake player update in the database
        const fakePlayerId = 'test_player_' + Date.now();
        const playerTransform = this.game.player.getComponent('Transform');
        
        const { error } = await this.supabase
            .from('players')
            .insert({
                id: fakePlayerId,
                name: 'TestPlayer',
                x: playerTransform.x + 200,
                y: playerTransform.y + 100,
                health: 100,
                max_health: 100,
                level: 1,
                kills: 0,
                is_online: true
            });

        if (error) {
            console.error('❌ Failed to create fake player:', error);
        } else {
            console.log('✅ Fake player created - should trigger real-time update');
            
            // Clean up after 5 seconds
            setTimeout(async () => {
                await this.supabase.from('players').delete().eq('id', fakePlayerId);
                console.log('🧹 Fake player cleaned up');
            }, 5000);
        }
    }

    // Simple test to move other players manually
    testMoveOtherPlayers() {
        console.log(`🎭 Testing movement for ${this.otherPlayers.size} other players`);
        
        this.otherPlayers.forEach((player, playerId) => {
            const transform = player.getComponent('Transform');
            if (transform) {
                const newX = transform.x + (Math.random() - 0.5) * 200;
                const newY = transform.y + (Math.random() - 0.5) * 200;
                
                console.log(`🎭 Moving ${playerId} to (${newX.toFixed(1)}, ${newY.toFixed(1)})`);
                transform.setPosition(newX, newY);
            }
        });
    }

    // Get current player name
    getPlayerName() {
        return this.playerName || 'Unknown';
    }

    // Set custom player name
    setPlayerName(newName) {
        if (!newName || newName.trim().length < 2 || newName.trim().length > 20) {
            console.error('❌ Invalid name length');
            return false;
        }

        const trimmedName = newName.trim();
        this.playerName = trimmedName;

        // Save to localStorage
        try {
            localStorage.setItem('MiniHero.accountName', trimmedName);
            console.log(`✅ Player name changed to: ${trimmedName}`);
        } catch (error) {
            console.error('❌ Failed to save name to localStorage:', error);
        }

        // Update the database if connected
        if (this.supabase && this.playerId) {
            this.supabase
                .from('players')
                .update({ name: trimmedName })
                .eq('id', this.playerId)
                .then(({ error }) => {
                    if (error) {
                        console.error('❌ Failed to update name in database:', error);
                    } else {
                        console.log('✅ Name updated in database');
                    }
                });
        }

        return true;
    }
}