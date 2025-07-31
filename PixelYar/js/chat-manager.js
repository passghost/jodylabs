// chat-manager.js - Real-time ship-to-ship communication system
import { CONFIG } from './config.js';

export class ChatManager {
  constructor(supabase, playerManager, uiManager) {
    this.supabase = supabase;
    this.playerManager = playerManager;
    this.uiManager = uiManager;
    this.chatSession = null;
    this.isInitiator = false;
    this.messageHistory = [];
    this.chatChannel = null;
    this.typingTimeout = null;
    this.isTyping = false;
    this.otherPlayerTyping = false;
  }

  async startChat(interaction) {
    try {
      const currentPlayer = this.playerManager.getCurrentPlayer();
      this.isInitiator = interaction.initiator_id === currentPlayer.id;
      
      // Create or find existing chat session
      let { data: existingSession } = await this.supabase
        .from('chat_sessions')
        .select('*')
        .or(`and(player1_id.eq.${interaction.initiator_id},player2_id.eq.${interaction.target_id}),and(player1_id.eq.${interaction.target_id},player2_id.eq.${interaction.initiator_id})`)
        .eq('status', 'active')
        .single();

      if (existingSession) {
        this.chatSession = existingSession;
        this.messageHistory = existingSession.messages || [];
      } else {
        // Create new chat session
        const { data: session, error } = await this.supabase
          .from('chat_sessions')
          .insert([{
            player1_id: interaction.initiator_id,
            player2_id: interaction.target_id,
            messages: [],
            status: 'active'
          }])
          .select()
          .single();

        if (error) throw error;

        this.chatSession = session;
        this.messageHistory = [];
      }

      // Set up realtime subscription for chat updates
      this.setupChatSubscription();
      
      // Show chat interface
      this.showChatInterface();
      
      this.uiManager.addToInteractionHistory('💬 Chat session started!');

    } catch (error) {
      console.error('Failed to start chat:', error);
      this.uiManager.addToInteractionHistory('Failed to start chat session');
    }
  }

  setupChatSubscription() {
    this.chatChannel = this.supabase
      .channel(`chat_${this.chatSession.id}`)
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_sessions', filter: `id=eq.${this.chatSession.id}` },
        (payload) => this.handleChatUpdate(payload.new)
      )
      .on('broadcast', 
        { event: 'typing' },
        (payload) => this.handleTypingUpdate(payload)
      )
      .subscribe();
  }

  showChatInterface() {
    const chatInterface = document.getElementById('chatInterface');
    chatInterface.style.display = 'block';
    
    // Get other player info
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const otherPlayerId = this.chatSession.player1_id === currentPlayer.id 
      ? this.chatSession.player2_id 
      : this.chatSession.player1_id;
    
    const allPlayers = this.playerManager.getAllPlayers();
    const otherPlayer = allPlayers.find(p => p.id === otherPlayerId);
    const otherPlayerName = otherPlayer ? otherPlayer.email.split('@')[0] : 'Unknown Captain';

    // Update chat header
    const chatWithDiv = document.getElementById('chatWith');
    chatWithDiv.innerHTML = `Chatting with Captain ${otherPlayerName}`;

    // Update messages
    this.updateChatMessages();

    // Set up input handlers
    this.setupChatInput();

    // Focus on input
    setTimeout(() => {
      document.getElementById('chatInput').focus();
    }, 100);
  }

  setupChatInput() {
    const chatInput = document.getElementById('chatInput');
    
    // Handle Enter key
    chatInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        this.sendMessage();
      }
    });

    // Handle typing indicators
    chatInput.addEventListener('input', () => {
      this.handleTyping();
    });

    // Handle focus events
    chatInput.addEventListener('focus', () => {
      this.markMessagesAsRead();
    });
  }

  updateChatMessages() {
    const messagesDiv = document.getElementById('chatMessages');
    const currentPlayer = this.playerManager.getCurrentPlayer();
    
    if (this.messageHistory.length === 0) {
      messagesDiv.innerHTML = `
        <div style="text-align:center; color:#888; font-style:italic; margin-top:50px;">
          🏴‍☠️ Ahoy! Start the conversation, matey!
        </div>
      `;
      return;
    }

    const messagesHtml = this.messageHistory.map(message => {
      const isMyMessage = message.sender_id === currentPlayer.id;
      const timestamp = new Date(message.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
      
      return `
        <div style="margin-bottom:12px; ${isMyMessage ? 'text-align:right;' : 'text-align:left;'}">
          <div style="display:inline-block; max-width:80%; padding:8px 12px; border-radius:12px; ${
            isMyMessage 
              ? 'background:#4444FF; color:#fff;' 
              : 'background:#2d1a06; color:#FFD700; border:1px solid #8B5C2A;'
          }">
            <div style="font-weight:bold; font-size:0.8em; margin-bottom:2px; opacity:0.8;">
              ${isMyMessage ? 'You' : message.sender_name}
            </div>
            <div style="word-wrap:break-word;">${this.escapeHtml(message.content)}</div>
            <div style="font-size:0.7em; opacity:0.6; margin-top:4px;">
              ${timestamp}
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Add typing indicator if other player is typing
    const typingIndicator = this.otherPlayerTyping ? `
      <div id="typingIndicator" style="text-align:left; margin-bottom:12px;">
        <div style="display:inline-block; padding:8px 12px; border-radius:12px; background:#2d1a06; border:1px solid #8B5C2A; color:#888; font-style:italic;">
          <span class="typing-dots">Captain is typing</span>
          <span class="dots">...</span>
        </div>
      </div>
    ` : '';

    messagesDiv.innerHTML = messagesHtml + typingIndicator;
    messagesDiv.scrollTop = messagesDiv.scrollHeight;

    // Animate typing dots
    if (this.otherPlayerTyping) {
      this.animateTypingDots();
    }
  }

  animateTypingDots() {
    const dotsElement = document.querySelector('.dots');
    if (!dotsElement) return;

    let dotCount = 0;
    const interval = setInterval(() => {
      if (!this.otherPlayerTyping) {
        clearInterval(interval);
        return;
      }
      
      dotCount = (dotCount + 1) % 4;
      dotsElement.textContent = '.'.repeat(dotCount);
    }, 500);
  }

  async sendMessage() {
    const chatInput = document.getElementById('chatInput');
    const content = chatInput.value.trim();
    
    if (!content) return;

    const currentPlayer = this.playerManager.getCurrentPlayer();
    const newMessage = {
      id: Date.now(), // Temporary ID
      sender_id: currentPlayer.id,
      sender_name: currentPlayer.email.split('@')[0],
      content: content,
      timestamp: new Date().toISOString(),
      read: false
    };

    try {
      // Add message to history
      const updatedMessages = [...this.messageHistory, newMessage];
      
      // Update database
      const { error } = await this.supabase
        .from('chat_sessions')
        .update({ 
          messages: updatedMessages,
          updated_at: new Date().toISOString()
        })
        .eq('id', this.chatSession.id);

      if (error) throw error;

      // Clear input
      chatInput.value = '';
      
      // Stop typing indicator
      this.stopTyping();

    } catch (error) {
      console.error('Failed to send message:', error);
      this.uiManager.addToInteractionHistory('Failed to send message');
    }
  }

  handleTyping() {
    if (!this.isTyping) {
      this.isTyping = true;
      this.broadcastTyping(true);
    }

    // Reset typing timeout
    clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.stopTyping();
    }, 2000);
  }

  stopTyping() {
    if (this.isTyping) {
      this.isTyping = false;
      this.broadcastTyping(false);
    }
    clearTimeout(this.typingTimeout);
  }

  broadcastTyping(isTyping) {
    if (this.chatChannel) {
      this.chatChannel.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          user_id: this.playerManager.getCurrentPlayer().id,
          is_typing: isTyping
        }
      });
    }
  }

  handleTypingUpdate(payload) {
    const currentPlayer = this.playerManager.getCurrentPlayer();
    if (payload.payload.user_id !== currentPlayer.id) {
      this.otherPlayerTyping = payload.payload.is_typing;
      this.updateChatMessages();
    }
  }

  handleChatUpdate(updatedSession) {
    this.chatSession = updatedSession;
    this.messageHistory = updatedSession.messages || [];
    this.updateChatMessages();

    // Play notification sound for new messages (if not focused)
    const chatInput = document.getElementById('chatInput');
    if (document.activeElement !== chatInput) {
      this.playNotificationSound();
    }
  }

  playNotificationSound() {
    // Create a simple beep sound using Web Audio API
    try {
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.2);
    } catch (error) {
      // Fallback: no sound if Web Audio API is not available
      console.log('Notification sound not available');
    }
  }

  markMessagesAsRead() {
    // Mark all messages as read (could be implemented for read receipts)
    const currentPlayer = this.playerManager.getCurrentPlayer();
    const updatedMessages = this.messageHistory.map(msg => ({
      ...msg,
      read: msg.sender_id === currentPlayer.id ? msg.read : true
    }));

    if (JSON.stringify(updatedMessages) !== JSON.stringify(this.messageHistory)) {
      this.supabase
        .from('chat_sessions')
        .update({ messages: updatedMessages })
        .eq('id', this.chatSession.id)
        .then(() => {
          this.messageHistory = updatedMessages;
        });
    }
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  async closeChat() {
    // Stop typing
    this.stopTyping();

    // Unsubscribe from channel
    if (this.chatChannel) {
      this.chatChannel.unsubscribe();
    }

    // Mark chat as closed (optional - could keep it active for later)
    try {
      await this.supabase
        .from('chat_sessions')
        .update({ status: 'closed' })
        .eq('id', this.chatSession.id);
    } catch (error) {
      console.error('Failed to close chat session:', error);
    }

    // Hide interface
    document.getElementById('chatInterface').style.display = 'none';
    
    this.uiManager.addToInteractionHistory('💬 Chat session ended');
  }

  // Quick message templates for pirate flavor
  sendQuickMessage(template) {
    const templates = {
      ahoy: "Ahoy there, matey! 🏴‍☠️",
      parley: "I request parley! 🤝",
      treasure: "Know ye of any treasure nearby? 💰",
      warning: "Beware, these waters be dangerous! ⚠️",
      farewell: "Fair winds and following seas! ⛵",
      challenge: "Care for a friendly duel? ⚔️",
      trade: "Interested in some trading? 🤝",
      help: "Could use some assistance, captain! 🆘"
    };

    const chatInput = document.getElementById('chatInput');
    chatInput.value = templates[template] || template;
    this.sendMessage();
  }
}

// Global functions for HTML onclick
window.closeChat = function() {
  if (window.game && window.game.chat) {
    window.game.chat.closeChat();
  }
};

window.sendChatMessage = function() {
  if (window.game && window.game.chat) {
    window.game.chat.sendMessage();
  }
};