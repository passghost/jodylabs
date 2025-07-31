// combat-manager.js - Turn-based naval combat system
import { CONFIG } from './config.js';

export class CombatManager {
  constructor(supabase, playerManager, uiManager) {
    this.supabase = supabase;
    this.playerManager = playerManager;
    this.uiManager = uiManager;
    this.combatSession = null;
    this.isPlayerTurn = false;
    this.combatActions = [
      { name: 'Cannon Blast', damage: [15, 25], accuracy: 0.7, description: 'Fire your main cannons' },
      { name: 'Chain Shot', damage: [8, 15], accuracy: 0.8, description: 'Target their rigging to slow them down' },
      { name: 'Grape Shot', damage: [20, 30], accuracy: 0.5, description: 'Devastating but inaccurate crew attack' },
      { name: 'Ramming Speed', damage: [25, 35], accuracy: 0.4, description: 'Risk everything for massive damage' },
      { name: 'Defensive Maneuver', damage: [0, 0], accuracy: 1.0, description: 'Reduce incoming damage by 50%' },
      { name: 'Repair Hull', damage: [0, 0], accuracy: 1.0, description: 'Restore 10-20 hull points' }
    ];
  }

  async startCombat(interaction) {
    try {
      const currentPlayer = this.playerManager.getCurrentPlayer();
      const isInitiator = interaction.initiator_id === currentPlayer.id;

      // Create combat session
      const { data: session, error } = await this.supabase
        .from('combat_sessions')
        .insert([{
          player1_id: interaction.initiator_id,
          player2_id: interaction.target_id,
          current_turn: interaction.initiator_id, // Initiator goes first
          player1_hp: 100,
          player2_hp: 100,
          combat_log: [],
          status: 'active'
        }])
        .select()
        .single();

      if (error) throw error;

      this.combatSession = session;
      this.isPlayerTurn = isInitiator;

      // Set up realtime subscription for combat updates
      this.setupCombatSubscription();

      // Show combat interface
      this.showCombatInterface();

      this.addCombatLog(`⚔️ Combat begins! ${isInitiator ? 'You' : 'Enemy'} goes first!`);

    } catch (error) {
      console.error('Failed to start combat:', error);
      this.uiManager.addToInteractionHistory('Failed to start combat session');
    }
  }

  setupCombatSubscription() {
    this.combatChannel = this.supabase
      .channel(`combat_${this.combatSession.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'combat_sessions', filter: `id=eq.${this.combatSession.id}` },
        (payload) => this.handleCombatUpdate(payload.new)
      )
      .subscribe();
  }

  showCombatInterface() {
    const combatInterface = document.getElementById('combatInterface');
    combatInterface.style.display = 'block';

    this.updateCombatDisplay();
    this.updateCombatActions();
  }

  updateCombatDisplay() {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.combatSession.player1_id === currentPlayer.id;

    const playerHp = isPlayer1 ? this.combatSession.player1_hp : this.combatSession.player2_hp;
    const enemyHp = isPlayer1 ? this.combatSession.player2_hp : this.combatSession.player1_hp;

    // Update status
    const statusDiv = document.getElementById('combatStatus');
    const turnText = this.isPlayerTurn ? 'Your Turn' : 'Enemy Turn';
    const turnColor = this.isPlayerTurn ? '#00AA00' : '#FF4444';
    statusDiv.innerHTML = `<div style="color:${turnColor}; font-weight:bold;">${turnText}</div>`;

    // Update player stats
    const playerStatsDiv = document.getElementById('playerCombatStats');
    playerStatsDiv.innerHTML = `
      <div style="margin-bottom:5px;">Hull: ${playerHp}/100</div>
      <div style="width:100%; background:#333; border-radius:4px; overflow:hidden;">
        <div style="width:${playerHp}%; background:#00AA00; height:20px; transition:width 0.3s;"></div>
      </div>
    `;

    // Update enemy stats
    const enemyStatsDiv = document.getElementById('enemyCombatStats');
    enemyStatsDiv.innerHTML = `
      <div style="margin-bottom:5px;">Hull: ${enemyHp}/100</div>
      <div style="width:100%; background:#333; border-radius:4px; overflow:hidden;">
        <div style="width:${enemyHp}%; background:#FF4444; height:20px; transition:width 0.3s;"></div>
      </div>
    `;

    // Update combat log
    const logDiv = document.getElementById('combatLog');
    const logs = this.combatSession.combat_log || [];
    logDiv.innerHTML = logs.map(log => `<div style="margin-bottom:5px;">${log}</div>`).join('');
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  updateCombatActions() {
    const actionsDiv = document.getElementById('combatActions');

    if (!this.isPlayerTurn) {
      actionsDiv.innerHTML = '<div style="color:#888;">Waiting for enemy action...</div>';
      return;
    }

    const actionsHtml = this.combatActions.map((action, index) => `
      <button onclick="window.game.combat.performAction(${index})" 
              style="background:#8B5C2A; color:#FFD700; border:2px solid #FFD700; border-radius:6px; padding:8px 12px; margin:4px; cursor:pointer; font-size:0.9em;">
        <div style="font-weight:bold;">${action.name}</div>
        <div style="font-size:0.8em; opacity:0.8;">${action.description}</div>
      </button>
    `).join('');

    actionsDiv.innerHTML = `
      <div style="color:#FFD700; margin-bottom:10px;">Choose your action:</div>
      <div style="display:flex; flex-wrap:wrap; justify-content:center;">
        ${actionsHtml}
      </div>
    `;
  }

  async performAction(actionIndex) {
    if (!this.isPlayerTurn) return;

    const action = this.combatActions[actionIndex];
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isPlayer1 = this.combatSession.player1_id === currentPlayer.id;

    try {
      // Calculate action result
      const result = this.calculateActionResult(action);

      // Update combat session
      const updatedLog = [...(this.combatSession.combat_log || []), result.logMessage];
      let updatedSession = {
        ...this.combatSession,
        combat_log: updatedLog,
        current_turn: isPlayer1 ? this.combatSession.player2_id : this.combatSession.player1_id,
        turn_number: this.combatSession.turn_number + 1
      };

      // Apply damage/effects
      if (result.damage > 0) {
        if (isPlayer1) {
          updatedSession.player2_hp = Math.max(0, this.combatSession.player2_hp - result.damage);
        } else {
          updatedSession.player1_hp = Math.max(0, this.combatSession.player1_hp - result.damage);
        }
      }

      // Apply healing
      if (result.healing > 0) {
        if (isPlayer1) {
          updatedSession.player1_hp = Math.min(100, this.combatSession.player1_hp + result.healing);
        } else {
          updatedSession.player2_hp = Math.min(100, this.combatSession.player2_hp + result.healing);
        }
      }

      // Check for victory
      if (updatedSession.player1_hp <= 0) {
        updatedSession.status = 'completed';
        updatedSession.winner_id = this.combatSession.player2_id;
        updatedLog.push('🏆 Player 2 wins the battle!');
      } else if (updatedSession.player2_hp <= 0) {
        updatedSession.status = 'completed';
        updatedSession.winner_id = this.combatSession.player1_id;
        updatedLog.push('🏆 Player 1 wins the battle!');
      }

      updatedSession.combat_log = updatedLog;

      // Update database
      const { error } = await this.supabase
        .from('combat_sessions')
        .update(updatedSession)
        .eq('id', this.combatSession.id);

      if (error) throw error;

      // Update local state
      this.combatSession = updatedSession;
      this.isPlayerTurn = false;

    } catch (error) {
      console.error('Failed to perform combat action:', error);
      this.addCombatLog('❌ Action failed - try again');
    }
  }

  calculateActionResult(action) {
    const hit = Math.random() < action.accuracy;

    if (!hit && action.damage[0] > 0) {
      return {
        damage: 0,
        healing: 0,
        logMessage: `💨 ${action.name} missed!`
      };
    }

    if (action.name === 'Repair Hull') {
      const healing = Math.floor(Math.random() * 11) + 10; // 10-20
      return {
        damage: 0,
        healing: healing,
        logMessage: `🔧 Repaired hull for ${healing} points!`
      };
    }

    if (action.name === 'Defensive Maneuver') {
      return {
        damage: 0,
        healing: 0,
        logMessage: `🛡️ Defensive maneuver - next damage reduced by 50%!`
      };
    }

    const damage = Math.floor(Math.random() * (action.damage[1] - action.damage[0] + 1)) + action.damage[0];
    return {
      damage: damage,
      healing: 0,
      logMessage: `💥 ${action.name} hits for ${damage} damage!`
    };
  }

  handleCombatUpdate(updatedSession) {
    this.combatSession = updatedSession;
    const currentPlayer = this.playerManager.getCurrentPlayer();
    this.isPlayerTurn = updatedSession.current_turn === currentPlayer.id;

    this.updateCombatDisplay();
    this.updateCombatActions();

    // Check if combat is over
    if (updatedSession.status === 'completed') {
      this.endCombat();
    }
  }

  addCombatLog(message) {
    const logDiv = document.getElementById('combatLog');
    const newLog = document.createElement('div');
    newLog.style.marginBottom = '5px';
    newLog.textContent = message;
    logDiv.appendChild(newLog);
    logDiv.scrollTop = logDiv.scrollHeight;
  }

  async endCombat() {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const isWinner = this.combatSession.winner_id === currentPlayer.id;

    // Apply combat results to player stats
    if (isWinner) {
      // Winner gets booty and minor hull damage
      await this.playerManager.updatePlayerStats({
        booty: currentPlayer.booty + 10,
        hull: Math.max(0, currentPlayer.hull - 5)
      });
      this.uiManager.addToInteractionHistory('🏆 Victory! Gained 10 booty, lost 5 hull');
    } else {
      // Loser loses more hull and some booty
      await this.playerManager.updatePlayerStats({
        booty: Math.max(0, currentPlayer.booty - 5),
        hull: Math.max(0, currentPlayer.hull - 15)
      });
      this.uiManager.addToInteractionHistory('💀 Defeat! Lost 5 booty, lost 15 hull');
    }

    // Clean up
    if (this.combatChannel) {
      this.combatChannel.unsubscribe();
    }

    setTimeout(() => {
      document.getElementById('combatInterface').style.display = 'none';
    }, 3000);
  }

  closeCombat() {
    if (this.combatChannel) {
      this.combatChannel.unsubscribe();
    }
    document.getElementById('combatInterface').style.display = 'none';
  }
}

// Global function for HTML onclick
window.closeCombat = function () {
  if (window.game && window.game.combat) {
    window.game.combat.closeCombat();
  }
};