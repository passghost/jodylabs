// interaction-manager.js - Core interaction system coordinator
import { CONFIG } from './config.js';

export class InteractionManager {
  constructor(supabase, playerManager, uiManager) {
    this.supabase = supabase;
    this.playerManager = playerManager;
    this.uiManager = uiManager;
    this.nearbyPlayers = [];
    this.activeInteractions = new Map();
    this.interactionRange = 8; // pixels (increased for ship size)
    
    this.setupRealtimeSubscriptions();
    this.startNearbyPlayerDetection();
  }

  setupRealtimeSubscriptions() {
    // Subscribe to interaction requests
    this.supabase
      .channel('player_interactions')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'player_interactions' },
        (payload) => this.handleInteractionUpdate(payload)
      )
      .subscribe();
  }

  startNearbyPlayerDetection() {
    setInterval(() => {
      this.detectNearbyPlayers();
    }, 1000);
  }

  detectNearbyPlayers() {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    if (!currentPlayer) return;

    const allPlayers = this.playerManager.getAllPlayers();
    
    // Get AI ships from the global game instance
    const aiShips = window.game && window.game.aiShips ? window.game.aiShips.getAIShips() : [];
    
    // Combine real players and AI ships
    const allEntities = [...allPlayers, ...aiShips];
    
    const nearby = allEntities.filter(p => {
      if (p.id === currentPlayer.id) return false;
      
      const distance = Math.sqrt(
        Math.pow(p.x - currentPlayer.x, 2) + 
        Math.pow(p.y - currentPlayer.y, 2)
      );
      
      return distance <= this.interactionRange;
    });

    this.nearbyPlayers = nearby;
    this.updateNearbyPlayersUI();
  }

  updateNearbyPlayersUI() {
    const nearbyDiv = document.getElementById('nearbyPlayers');
    if (!nearbyDiv) return;

    if (this.nearbyPlayers.length === 0) {
      nearbyDiv.innerHTML = '<div style="color:#888; font-size:0.9em;">No ships nearby</div>';
      return;
    }

    const playersHtml = this.nearbyPlayers.map(player => {
      const isAI = player.isAI || false;
      const shipIcon = isAI ? '🏴‍☠️' : '⛵';
      const shipName = isAI ? `${player.email.split('@')[0]} (AI)` : player.email.split('@')[0];
      const shipColor = isAI ? '#FF4444' : '#FFD700';
      
      return `
        <div style="margin-bottom:8px; padding:6px; background:#2d1a06; border-radius:4px; border:1px solid ${isAI ? '#FF4444' : '#8B5C2A'};">
          <div style="color:${shipColor}; font-weight:bold; margin-bottom:4px;">
            ${shipIcon} ${shipName}
          </div>
          <div style="display:flex; gap:4px;">
            <button onclick="window.game.interactions.initiateInteraction('${player.id}', 'combat')" 
                    style="background:#FF4444; color:#fff; border:none; border-radius:3px; padding:3px 6px; font-size:0.8em; cursor:pointer;">
              ⚔️ Attack
            </button>
            ${!isAI ? `
              <button onclick="window.game.interactions.initiateInteraction('${player.id}', 'trade')" 
                      style="background:#00AA00; color:#fff; border:none; border-radius:3px; padding:3px 6px; font-size:0.8em; cursor:pointer;">
                💰 Trade
              </button>
              <button onclick="window.game.interactions.initiateInteraction('${player.id}', 'chat')" 
                      style="background:#4444FF; color:#fff; border:none; border-radius:3px; padding:3px 6px; font-size:0.8em; cursor:pointer;">
                💬 Chat
              </button>
            ` : '<span style="color:#888; font-size:0.8em;">AI Ship - Combat Only</span>'}
          </div>
        </div>
      `;
    }).join('');

    nearbyDiv.innerHTML = `
      <div style="color:#FFD700; font-weight:bold; margin-bottom:8px;">
        🏴‍☠️ Nearby Ships (${this.nearbyPlayers.length})
      </div>
      ${playersHtml}
    `;
  }

  async initiateInteraction(targetPlayerId, interactionType) {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    if (!currentPlayer) return;

    // Check if target is still nearby
    const targetPlayer = this.nearbyPlayers.find(p => p.id === targetPlayerId);
    if (!targetPlayer) {
      this.uiManager.addToInteractionHistory('Target ship has sailed away!');
      return;
    }

    try {
      const { data, error } = await this.supabase
        .from('player_interactions')
        .insert([{
          initiator_id: currentPlayer.id,
          target_id: targetPlayerId,
          interaction_type: interactionType,
          status: 'pending',
          data: {
            initiator_name: currentPlayer.email.split('@')[0],
            target_name: targetPlayer.email.split('@')[0],
            timestamp: new Date().toISOString()
          }
        }])
        .select()
        .single();

      if (error) throw error;

      this.uiManager.addToInteractionHistory(
        `Sent ${interactionType} request to ${targetPlayer.email.split('@')[0]}`
      );

      // Store the interaction locally
      this.activeInteractions.set(data.id, data);

    } catch (error) {
      console.error('Failed to initiate interaction:', error);
      this.uiManager.addToInteractionHistory('Failed to send interaction request');
    }
  }

  async handleInteractionUpdate(payload) {
    const interaction = payload.new;
    const currentPlayer = this.playerManager.getCurrentPlayer();
    
    if (!currentPlayer) return;

    // Handle incoming interaction requests
    if (interaction.target_id === currentPlayer.id && interaction.status === 'pending') {
      this.showInteractionRequest(interaction);
    }

    // Handle interaction responses
    if (interaction.initiator_id === currentPlayer.id && interaction.status === 'active') {
      this.startInteractionSession(interaction);
    }

    // Handle interaction completions/cancellations
    if ((interaction.initiator_id === currentPlayer.id || interaction.target_id === currentPlayer.id) 
        && ['completed', 'cancelled'].includes(interaction.status)) {
      this.endInteractionSession(interaction);
    }
  }

  showInteractionRequest(interaction) {
    const modal = document.getElementById('interactionModal');
    const content = document.getElementById('modalContent');
    
    const typeEmoji = {
      combat: '⚔️',
      trade: '💰',
      chat: '💬'
    };

    const typeColor = {
      combat: '#FF4444',
      trade: '#00AA00',
      chat: '#4444FF'
    };

    content.innerHTML = `
      <div style="text-align:center; color:${typeColor[interaction.interaction_type]}; font-size:1.5em; margin-bottom:20px;">
        ${typeEmoji[interaction.interaction_type]} ${interaction.interaction_type.toUpperCase()} REQUEST
      </div>
      <div style="color:#FFD700; text-align:center; margin-bottom:20px; font-size:1.1em;">
        Captain ${interaction.data.initiator_name} wants to ${interaction.interaction_type} with you!
      </div>
      <div style="text-align:center;">
        <button onclick="window.game.interactions.respondToInteraction('${interaction.id}', true)" 
                style="background:#00AA00; color:#fff; border:none; border-radius:6px; padding:10px 20px; margin-right:10px; cursor:pointer; font-size:1em;">
          Accept
        </button>
        <button onclick="window.game.interactions.respondToInteraction('${interaction.id}', false)" 
                style="background:#FF4444; color:#fff; border:none; border-radius:6px; padding:10px 20px; cursor:pointer; font-size:1em;">
          Decline
        </button>
      </div>
    `;

    modal.style.display = 'block';
  }

  async respondToInteraction(interactionId, accept) {
    const modal = document.getElementById('interactionModal');
    modal.style.display = 'none';

    try {
      const status = accept ? 'active' : 'cancelled';
      const { error } = await this.supabase
        .from('player_interactions')
        .update({ status })
        .eq('id', interactionId);

      if (error) throw error;

      if (accept) {
        // The interaction will be started via the realtime subscription
        this.uiManager.addToInteractionHistory(`Accepted interaction request`);
      } else {
        this.uiManager.addToInteractionHistory(`Declined interaction request`);
      }

    } catch (error) {
      console.error('Failed to respond to interaction:', error);
      this.uiManager.addToInteractionHistory('Failed to respond to request');
    }
  }

  async startInteractionSession(interaction) {
    // Import and start the appropriate interaction module
    switch (interaction.interaction_type) {
      case 'combat':
        const { CombatManager } = await import('./combat-manager.js');
        const combat = new CombatManager(this.supabase, this.playerManager, this.uiManager);
        window.game.combat = combat;
        await combat.startCombat(interaction);
        break;
        
      case 'trade':
        const { TradeManager } = await import('./trade-manager.js');
        const trade = new TradeManager(this.supabase, this.playerManager, this.uiManager);
        window.game.trade = trade;
        await trade.startTrade(interaction);
        break;
        
      case 'chat':
        const { ChatManager } = await import('./chat-manager.js');
        const chat = new ChatManager(this.supabase, this.playerManager, this.uiManager);
        window.game.chat = chat;
        await chat.startChat(interaction);
        break;
    }
  }

  endInteractionSession(interaction) {
    // Clean up any active sessions
    this.activeInteractions.delete(interaction.id);
    
    // Hide any open interfaces
    document.getElementById('combatInterface').style.display = 'none';
    document.getElementById('tradeInterface').style.display = 'none';
    document.getElementById('chatInterface').style.display = 'none';
    
    this.uiManager.addToInteractionHistory(`${interaction.interaction_type} session ended`);
  }

  getNearbyPlayers() {
    return this.nearbyPlayers;
  }

  getActiveInteractions() {
    return this.activeInteractions;
  }
}