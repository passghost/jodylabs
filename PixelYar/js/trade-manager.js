// trade-manager.js - Advanced trading system with port and ship-to-ship trading
import { CONFIG } from './config.js';

export class TradeManager {
  constructor(supabase, playerManager, uiManager) {
    this.supabase = supabase;
    this.playerManager = playerManager;
    this.uiManager = uiManager;
    this.tradeSession = null;
    this.isInitiator = false;
    this.tradeableItems = [
      { name: 'Gold Coins', type: 'booty', icon: '🪙', description: 'Pure pirate currency' },
      { name: 'Crew Members', type: 'crew', icon: '👥', description: 'Experienced sailors' },
      { name: 'Hull Repairs', type: 'hull', icon: '🔧', description: 'Ship maintenance materials' },
      { name: 'Rum Barrels', type: 'item', icon: '🍺', description: 'Boosts crew morale' },
      { name: 'Cannon Balls', type: 'item', icon: '⚫', description: 'Essential for combat' },
      { name: 'Treasure Maps', type: 'item', icon: '🗺️', description: 'Lead to hidden riches' },
      { name: 'Spices', type: 'item', icon: '🌶️', description: 'Valuable trade goods' },
      { name: 'Silk', type: 'item', icon: '🧵', description: 'Luxury fabric from distant lands' }
    ];
  }

  async startTrade(interaction) {
    try {
      const currentPlayer = this.playerManager.getCurrentPlayer();
      this.isInitiator = interaction.initiator_id === currentPlayer.id;
      
      // Create trade session
      const { data: session, error } = await this.supabase
        .from('trade_sessions')
        .insert([{
          player1_id: interaction.initiator_id,
          player2_id: interaction.target_id,
          player1_offer: {},
          player2_offer: {},
          player1_approved: false,
          player2_approved: false,
          status: 'negotiating'
        }])
        .select()
        .single();

      if (error) throw error;

      this.tradeSession = session;

      // Set up realtime subscription for trade updates
      this.setupTradeSubscription();
      
      // Show trade interface
      this.showTradeInterface();
      
      this.uiManager.addToInteractionHistory('💰 Trade negotiations begun!');

    } catch (error) {
      console.error('Failed to start trade:', error);
      this.uiManager.addToInteractionHistory('Failed to start trade session');
    }
  }

  setupTradeSubscription() {
    this.tradeChannel = this.supabase
      .channel(`trade_${this.tradeSession.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'trade_sessions', filter: `id=eq.${this.tradeSession.id}` },
        (payload) => this.handleTradeUpdate(payload.new)
      )
      .subscribe();
  }

  showTradeInterface() {
    const tradeInterface = document.getElementById('tradeInterface');
    tradeInterface.style.display = 'block';
    
    this.updateTradeDisplay();
    this.updateTradeControls();
  }

  updateTradeDisplay() {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.tradeSession.player1_id === currentPlayer.id;
    
    const myOffer = isPlayer1 ? this.tradeSession.player1_offer : this.tradeSession.player2_offer;
    const theirOffer = isPlayer1 ? this.tradeSession.player2_offer : this.tradeSession.player1_offer;
    const myApproved = isPlayer1 ? this.tradeSession.player1_approved : this.tradeSession.player2_approved;
    const theirApproved = isPlayer1 ? this.tradeSession.player2_approved : this.tradeSession.player1_approved;

    // Update status
    const statusDiv = document.getElementById('tradeStatus');
    let statusText = 'Negotiating...';
    let statusColor = '#FFD700';
    
    if (myApproved && theirApproved) {
      statusText = 'Trade Approved - Executing...';
      statusColor = '#00AA00';
    } else if (myApproved) {
      statusText = 'Waiting for their approval...';
      statusColor = '#FFA500';
    } else if (theirApproved) {
      statusText = 'They approved - your turn!';
      statusColor = '#FFA500';
    }
    
    statusDiv.innerHTML = `<div style="color:${statusColor};">${statusText}</div>`;

    // Update player offer display
    this.updateOfferDisplay('playerTradeOffer', myOffer, true);
    this.updateOfferDisplay('enemyTradeOffer', theirOffer, false);
  }

  updateOfferDisplay(elementId, offer, isMyOffer) {
    const offerDiv = document.getElementById(elementId);
    
    if (!offer || Object.keys(offer).length === 0) {
      offerDiv.innerHTML = '<div style="color:#888; font-style:italic;">No items offered</div>';
      return;
    }

    const offerHtml = Object.entries(offer).map(([key, value]) => {
      const item = this.tradeableItems.find(item => 
        (item.type === key) || (item.type === 'item' && key === item.name.toLowerCase().replace(/\s+/g, '_'))
      );
      
      const icon = item ? item.icon : '📦';
      const name = item ? item.name : key;
      
      return `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; padding:4px; background:#2d1a06; border-radius:4px;">
          <span>${icon} ${name}</span>
          <span style="color:#FFD700; font-weight:bold;">${value}</span>
          ${isMyOffer ? `<button onclick="window.game.trade.removeFromOffer('${key}')" style="background:#FF4444; color:#fff; border:none; border-radius:2px; padding:2px 6px; font-size:0.8em; cursor:pointer;">×</button>` : ''}
        </div>
      `;
    }).join('');

    offerDiv.innerHTML = offerHtml;
  }

  updateTradeControls() {
    const controlsDiv = document.getElementById('tradeControls');
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.tradeSession.player1_id === currentPlayer.id;
    const myApproved = isPlayer1 ? this.tradeSession.player1_approved : this.tradeSession.player2_approved;

    if (myApproved) {
      controlsDiv.innerHTML = `
        <div style="text-align:center; color:#00AA00; margin-bottom:15px;">
          ✅ You have approved this trade
        </div>
        <div style="text-align:center;">
          <button onclick="window.game.trade.revokeApproval()" 
                  style="background:#FF4444; color:#fff; border:none; border-radius:6px; padding:8px 16px; cursor:pointer;">
            Revoke Approval
          </button>
        </div>
      `;
      return;
    }

    const playerStats = this.playerManager.getPlayerStats();
    
    const itemsHtml = this.tradeableItems.map(item => {
      let maxAmount = 0;
      let currentAmount = 0;
      
      switch (item.type) {
        case 'booty':
          maxAmount = playerStats.booty;
          break;
        case 'crew':
          maxAmount = playerStats.crew;
          break;
        case 'hull':
          maxAmount = Math.floor(playerStats.hull / 10); // Can trade hull repair kits
          break;
        case 'item':
          maxAmount = 5; // Assume max 5 of any item
          break;
      }

      if (maxAmount === 0) return '';

      const itemKey = item.type === 'item' ? item.name.toLowerCase().replace(/\s+/g, '_') : item.type;

      return `
        <div style="display:flex; align-items:center; margin-bottom:8px; padding:8px; background:#1e3f66cc; border-radius:4px;">
          <div style="flex:1;">
            <div style="color:#FFD700; font-weight:bold;">${item.icon} ${item.name}</div>
            <div style="color:#AAA; font-size:0.8em;">${item.description}</div>
            <div style="color:#888; font-size:0.8em;">Available: ${maxAmount}</div>
          </div>
          <div style="display:flex; align-items:center; gap:8px;">
            <input type="number" id="trade_${itemKey}" min="0" max="${maxAmount}" value="0" 
                   style="width:60px; padding:4px; border:1px solid #8B5C2A; border-radius:4px; background:#222; color:#fff;">
            <button onclick="window.game.trade.addToOffer('${itemKey}', '${item.type}')" 
                    style="background:#00AA00; color:#fff; border:none; border-radius:4px; padding:4px 8px; cursor:pointer;">
              Add
            </button>
          </div>
        </div>
      `;
    }).filter(html => html !== '').join('');

    controlsDiv.innerHTML = `
      <div style="color:#FFD700; font-weight:bold; margin-bottom:10px;">Add items to your offer:</div>
      <div style="max-height:200px; overflow-y:auto; margin-bottom:15px;">
        ${itemsHtml}
      </div>
      <div style="text-align:center;">
        <button onclick="window.game.trade.approveTrade()" 
                style="background:#00AA00; color:#fff; border:none; border-radius:6px; padding:10px 20px; cursor:pointer; font-size:1em;">
          Approve Trade
        </button>
      </div>
    `;
  }

  async addToOffer(itemKey, itemType) {
    const input = document.getElementById(`trade_${itemKey}`);
    const amount = parseInt(input.value);
    
    if (amount <= 0) return;

    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.tradeSession.player1_id === currentPlayer.id;
    
    // Validate the player has enough of the item
    const playerStats = this.playerManager.getPlayerStats();
    let available = 0;
    
    switch (itemType) {
      case 'booty':
        available = playerStats.booty;
        break;
      case 'crew':
        available = playerStats.crew;
        break;
      case 'hull':
        available = Math.floor(playerStats.hull / 10);
        break;
      case 'item':
        available = 5; // Assume player has items
        break;
    }

    if (amount > available) {
      this.uiManager.addToInteractionHistory(`Not enough ${itemKey} available!`);
      return;
    }

    try {
      const currentOffer = isPlayer1 ? this.tradeSession.player1_offer : this.tradeSession.player2_offer;
      const updatedOffer = { ...currentOffer, [itemKey]: amount };
      
      const updateData = isPlayer1 
        ? { player1_offer: updatedOffer, player1_approved: false }
        : { player2_offer: updatedOffer, player2_approved: false };

      const { error } = await this.supabase
        .from('trade_sessions')
        .update(updateData)
        .eq('id', this.tradeSession.id);

      if (error) throw error;

      input.value = '0';

    } catch (error) {
      console.error('Failed to add item to offer:', error);
      this.uiManager.addToInteractionHistory('Failed to add item to offer');
    }
  }

  async removeFromOffer(itemKey) {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.tradeSession.player1_id === currentPlayer.id;
    
    try {
      const currentOffer = isPlayer1 ? this.tradeSession.player1_offer : this.tradeSession.player2_offer;
      const updatedOffer = { ...currentOffer };
      delete updatedOffer[itemKey];
      
      const updateData = isPlayer1 
        ? { player1_offer: updatedOffer, player1_approved: false }
        : { player2_offer: updatedOffer, player2_approved: false };

      const { error } = await this.supabase
        .from('trade_sessions')
        .update(updateData)
        .eq('id', this.tradeSession.id);

      if (error) throw error;

    } catch (error) {
      console.error('Failed to remove item from offer:', error);
      this.uiManager.addToInteractionHistory('Failed to remove item from offer');
    }
  }

  async approveTrade() {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.tradeSession.player1_id === currentPlayer.id;
    
    try {
      const updateData = isPlayer1 
        ? { player1_approved: true }
        : { player2_approved: true };

      const { error } = await this.supabase
        .from('trade_sessions')
        .update(updateData)
        .eq('id', this.tradeSession.id);

      if (error) throw error;

      this.uiManager.addToInteractionHistory('Trade approved - waiting for other player');

    } catch (error) {
      console.error('Failed to approve trade:', error);
      this.uiManager.addToInteractionHistory('Failed to approve trade');
    }
  }

  async revokeApproval() {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.tradeSession.player1_id === currentPlayer.id;
    
    try {
      const updateData = isPlayer1 
        ? { player1_approved: false }
        : { player2_approved: false };

      const { error } = await this.supabase
        .from('trade_sessions')
        .update(updateData)
        .eq('id', this.tradeSession.id);

      if (error) throw error;

    } catch (error) {
      console.error('Failed to revoke approval:', error);
      this.uiManager.addToInteractionHistory('Failed to revoke approval');
    }
  }

  handleTradeUpdate(updatedSession) {
    this.tradeSession = updatedSession;
    this.updateTradeDisplay();
    this.updateTradeControls();

    // Check if both players approved
    if (updatedSession.player1_approved && updatedSession.player2_approved) {
      this.executeTrade();
    }
  }

  async executeTrade() {
    try {
      const currentPlayer = this.playerManager.getCurrentPlayer();
      const isPlayer1 = this.tradeSession.player1_id === currentPlayer.id;
      
      const myOffer = isPlayer1 ? this.tradeSession.player1_offer : this.tradeSession.player2_offer;
      const theirOffer = isPlayer1 ? this.tradeSession.player2_offer : this.tradeSession.player1_offer;

      // Calculate stat changes
      const statChanges = { ...currentPlayer };
      
      // Remove what I'm giving
      Object.entries(myOffer).forEach(([key, amount]) => {
        switch (key) {
          case 'booty':
            statChanges.booty -= amount;
            break;
          case 'crew':
            statChanges.crew -= amount;
            break;
          case 'hull':
            statChanges.hull -= amount * 10; // Hull repair kits
            break;
        }
      });

      // Add what I'm receiving
      Object.entries(theirOffer).forEach(([key, amount]) => {
        switch (key) {
          case 'booty':
            statChanges.booty += amount;
            break;
          case 'crew':
            statChanges.crew += amount;
            break;
          case 'hull':
            statChanges.hull += amount * 10; // Hull repair kits
            break;
        }
      });

      // Ensure stats don't go below 0 or above limits
      statChanges.booty = Math.max(0, statChanges.booty);
      statChanges.crew = Math.max(0, statChanges.crew);
      statChanges.hull = Math.max(0, Math.min(100, statChanges.hull));

      // Update player stats
      await this.playerManager.updatePlayerStats(statChanges);

      // Mark trade as completed
      await this.supabase
        .from('trade_sessions')
        .update({ status: 'completed' })
        .eq('id', this.tradeSession.id);

      this.uiManager.addToInteractionHistory('🤝 Trade completed successfully!');
      
      setTimeout(() => {
        this.closeTrade();
      }, 2000);

    } catch (error) {
      console.error('Failed to execute trade:', error);
      this.uiManager.addToInteractionHistory('Trade execution failed!');
    }
  }

  closeTrade() {
    if (this.tradeChannel) {
      this.tradeChannel.unsubscribe();
    }
    document.getElementById('tradeInterface').style.display = 'none';
  }
}

// Global functions for HTML onclick
window.closeTrade = function() {
  if (window.game && window.game.trade) {
    window.game.trade.closeTrade();
  }
};