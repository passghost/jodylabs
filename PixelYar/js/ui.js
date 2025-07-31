// ui.js - UI management and particle effects
export class UIManager {
  constructor() {
    this.loginBox = document.getElementById('login');
    this.hud = document.getElementById('hud');
    this.particlesRunning = false;
  }

  showLogin() {
    this.loginBox.style.display = 'block';
    this.hud.style.display = 'none';
    this.setupLoginParticles();
  }

  hideLogin() {
    this.loginBox.style.display = 'none';
    this.hud.style.display = 'block';
    document.body.style.background = 'none';
    this.particlesRunning = false;
  }

  showMovePopup() {
    // No longer showing popup - just update timer to indicate ready state
  }

  hideMovePopup() {
    // No longer hiding popup - functionality moved to timer
  }

  updateLoginStatus(message) {
    const statusDiv = document.getElementById('loginStatus');
    if (statusDiv) {
      statusDiv.innerText = message;
    }
  }

  updatePlayerStats(player, zoom) {
    const statsDiv = document.getElementById('playerStats');
    if (statsDiv && player) {
      statsDiv.innerText = `Hull: ${player.hull}\nCrew: ${player.crew}\nPos: (${Math.round(player.x)},${Math.round(player.y)})\nZoom: ${zoom}x`;
    }
  }

  updateInventory(inventory) {
    const inventoryDiv = document.getElementById('inventoryItems');
    if (!inventoryDiv || !inventory) return;

    const items = inventory.getAllItems();
    
    if (items.length === 0) {
      inventoryDiv.innerHTML = '<div style="color:#888; font-style:italic;">Empty hold</div>';
      return;
    }

    // Show top 6 items, with total value
    const displayItems = items.slice(0, 6);
    const totalValue = inventory.getTotalValue();
    
    let html = displayItems.map(item => {
      const quantityText = item.quantity > 1 ? ` x${item.quantity}` : '';
      const clickable = ['Rum Bottles', 'Medicine', 'Wooden Planks', 'Gunpowder', 'Lucky Charm', 'Treasure Maps'].includes(item.name);
      const style = clickable ? 'cursor:pointer; padding:2px; border-radius:3px;' : '';
      const hoverStyle = clickable ? 'onmouseover="this.style.backgroundColor=\'#444\'" onmouseout="this.style.backgroundColor=\'transparent\'"' : '';
      const onclick = clickable ? `onclick="window.game.useInventoryItem('${item.name}')"` : '';
      
      return `<div style="margin-bottom:2px; ${style}" ${hoverStyle} ${onclick} title="${item.description}">${item.icon} ${item.name}${quantityText}</div>`;
    }).join('');

    if (items.length > 6) {
      html += `<div style="color:#888; font-style:italic; margin-top:4px; cursor:pointer;" onclick="window.game.showFullInventory()" title="Click to view full inventory">...and ${items.length - 6} more</div>`;
    }

    html += `<div style="color:#FFD700; font-weight:bold; margin-top:6px; border-top:1px solid #8B5C2A; padding-top:4px;">💰 Total Value: ${totalValue}</div>`;
    html += `<div style="color:#888; font-size:10px; margin-top:4px;">Click items to use • I for full inventory</div>`;
    
    // Add quick action buttons for common items
    const quickActions = [];
    if (inventory.hasItem('Medicine')) {
      quickActions.push(`<button onclick="window.game.useInventoryItem('Medicine')" style="background:#4a7c59; color:white; border:none; padding:2px 6px; border-radius:3px; font-size:10px; cursor:pointer; margin:2px;">💊 Heal</button>`);
    }
    if (inventory.hasItem('Rum Bottles')) {
      quickActions.push(`<button onclick="window.game.useInventoryItem('Rum Bottles')" style="background:#8B4513; color:white; border:none; padding:2px 6px; border-radius:3px; font-size:10px; cursor:pointer; margin:2px;">🍺 Boost</button>`);
    }
    if (inventory.hasItem('Wooden Planks')) {
      quickActions.push(`<button onclick="window.game.useInventoryItem('Wooden Planks')" style="background:#8B4513; color:white; border:none; padding:2px 6px; border-radius:3px; font-size:10px; cursor:pointer; margin:2px;">🪵 Repair</button>`);
    }
    
    if (quickActions.length > 0) {
      html += `<div style="margin-top:6px; padding-top:4px; border-top:1px solid #8B5C2A;">${quickActions.join('')}</div>`;
    }

    inventoryDiv.innerHTML = html;
  }

  showFullInventory(inventory) {
    // Create a modal overlay for full inventory view
    const modal = document.createElement('div');
    modal.id = 'inventoryModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #2a1810;
      border: 3px solid #8B5C2A;
      border-radius: 10px;
      padding: 20px;
      max-width: 80%;
      max-height: 80%;
      overflow-y: auto;
      color: white;
      font-family: 'Courier New', monospace;
    `;

    const itemsByCategory = inventory.getItemsByCategory();
    const recipes = inventory.getAvailableRecipes();

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #FFD700;">⚓ Ship's Inventory</h2>
        <button onclick="document.getElementById('inventoryModal').remove()" style="background: #8B5C2A; color: white; border: none; padding: 5px 10px; border-radius: 5px; cursor: pointer;">✕ Close</button>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h3 style="color: #FFD700; margin-bottom: 10px;">📦 Items by Category</h3>
    `;

    for (const [category, items] of Object.entries(itemsByCategory)) {
      if (items.length > 0) {
        html += `
          <div style="margin-bottom: 15px;">
            <h4 style="color: #DDD; margin: 5px 0; font-size: 14px;">${category}</h4>
        `;
        
        items.forEach(item => {
          const quantityText = item.quantity > 1 ? ` x${item.quantity}` : '';
          const clickable = ['Rum Bottles', 'Medicine', 'Wooden Planks', 'Gunpowder', 'Lucky Charm', 'Treasure Maps'].includes(item.name);
          const style = clickable ? 'cursor:pointer; padding:4px; border-radius:3px; background: #333;' : 'padding:4px;';
          const onclick = clickable ? `onclick="window.game.useInventoryItem('${item.name}'); document.getElementById('inventoryModal').remove();"` : '';
          
          html += `
            <div style="margin: 3px 0; ${style}" ${onclick} title="${item.description}">
              ${item.icon} ${item.name}${quantityText}
              ${clickable ? ' <span style="color:#888; font-size:10px;">(click to use)</span>' : ''}
            </div>
          `;
        });
        
        html += `</div>`;
      }
    }

    html += `
        </div>
        <div>
          <h3 style="color: #FFD700; margin-bottom: 10px;">🔨 Crafting Recipes</h3>
    `;

    if (recipes.length === 0) {
      html += `<div style="color: #888; font-style: italic;">No recipes available</div>`;
    } else {
      recipes.forEach(recipe => {
        const canCraft = recipe.canCraft;
        const buttonStyle = canCraft ? 
          'background: #4a7c59; color: white; cursor: pointer;' : 
          'background: #666; color: #999; cursor: not-allowed;';
        
        html += `
          <div style="margin-bottom: 15px; padding: 10px; background: #333; border-radius: 5px;">
            <div style="font-weight: bold; margin-bottom: 5px;">${recipe.name}</div>
            <div style="font-size: 12px; color: #ccc; margin-bottom: 8px;">${recipe.description}</div>
            <div style="font-size: 11px; margin-bottom: 8px;">
              <strong>Ingredients:</strong><br>
              ${Object.entries(recipe.ingredients).map(([item, qty]) => 
                `${inventory.getItemQuantity(item)}/${qty} ${item}`
              ).join('<br>')}
            </div>
            <div style="font-size: 11px; margin-bottom: 8px;">
              <strong>Result:</strong> ${recipe.result.quantity} ${recipe.result.item}
            </div>
            <button 
              onclick="${canCraft ? `window.game.craftItem('${recipe.name}'); document.getElementById('inventoryModal').remove();` : ''}"
              style="padding: 5px 10px; border: none; border-radius: 3px; font-size: 11px; ${buttonStyle}"
              ${!canCraft ? 'disabled' : ''}
            >
              ${canCraft ? '🔨 Craft' : '❌ Missing Items'}
            </button>
          </div>
        `;
      });
    }

    html += `
        </div>
      </div>
      
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #8B5C2A; text-align: center;">
        <div style="color: #FFD700; font-weight: bold; font-size: 16px;">💰 Total Inventory Value: ${inventory.getTotalValue()}</div>
        <div style="color: #888; font-size: 12px; margin-top: 5px;">Press 'I' key to toggle this inventory view</div>
      </div>
    `;

    content.innerHTML = html;
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Close on escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  updateMoveTimer(countdown, isRepairing = false, isRealtime = false) {
    const timerDiv = document.getElementById('moveTimer');
    if (!timerDiv) return;

    if (isRealtime) {
      timerDiv.innerHTML = `
        <div style="font-size:15px; margin-bottom:2px; color:#00FF00;">⚡ Real-time Sailing!</div>
        <div style="font-size:11px; color:#aaa; margin-top:8px;">Hold WASD to sail, R to repair, I for inventory</div>
        <div style="font-size:10px; color:#888; margin-top:4px;">Mouse wheel to zoom</div>
      `;
      timerDiv.style.textAlign = 'right';
      return;
    }

    if (countdown > 0) {
      const actionText = isRepairing ? 'Repairing' : 'Next move';
      const actionColor = isRepairing ? '#00AA00' : '#FFD700';
      timerDiv.innerHTML = `
        <div style="font-size:15px; margin-bottom:2px; color:${actionColor};">⏳ ${actionText} in: <b>${countdown}</b> seconds</div>
        <div style="font-size:11px; color:#aaa; margin-top:8px;">${isRepairing ? '🔧 Ship repairs in progress...' : 'WASD to move, R to repair'}</div>
      `;
      timerDiv.style.textAlign = 'right';
    } else {
      timerDiv.innerHTML = `
        <div style="font-size:13px; color:#FFD700; font-weight:bold; margin-bottom:2px;">YARRR! Move now!</div>
        <div style="font-size:10px; color:#bbb; margin-top:8px;">WASD to move, R to repair</div>
      `;
      timerDiv.style.textAlign = 'right';
    }
  }

  updateInteractionLog(history) {
    const logDiv = document.getElementById('interactionLog');
    if (logDiv) {
      logDiv.innerHTML = history.map(e => `<div>🦜 ${e}</div>`).join('');
    }
  }

  addToInteractionHistory(message) {
    // This method will be called by interaction managers
    // We need to access the game's interaction history
    if (window.game && window.game.addToInteractionHistory) {
      window.game.addToInteractionHistory(message);
    }
  }

  showInventoryNotification(message, type = 'info') {
    // Create a floating notification for inventory changes
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 100px;
      right: 20px;
      background: ${type === 'success' ? '#4a7c59' : type === 'error' ? '#8B0000' : '#2a1810'};
      color: white;
      padding: 12px 16px;
      border-radius: 8px;
      border: 2px solid ${type === 'success' ? '#5a9c69' : type === 'error' ? '#FF4444' : '#8B5C2A'};
      font-family: 'Courier New', monospace;
      font-size: 14px;
      z-index: 2000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.5);
      transform: translateX(100%);
      transition: transform 0.3s ease-in-out;
      max-width: 300px;
    `;
    
    notification.innerHTML = message;
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => {
      notification.style.transform = 'translateX(0)';
    }, 10);
    
    // Animate out and remove
    setTimeout(() => {
      notification.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.parentNode.removeChild(notification);
        }
      }, 300);
    }, 3000);
  }

  showTradingPortButton(port) {
    let button = document.getElementById('tradingPortButton');
    
    if (!button) {
      button = document.createElement('button');
      button.id = 'tradingPortButton';
      button.style.cssText = `
        position: fixed;
        bottom: 100px;
        right: 20px;
        background: #4a7c59;
        color: white;
        border: 2px solid #5a9c69;
        border-radius: 8px;
        padding: 12px 20px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        z-index: 1500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        font-family: 'Courier New', monospace;
        transition: all 0.3s ease;
      `;
      
      button.onmouseover = () => {
        button.style.background = '#5a9c69';
        button.style.transform = 'scale(1.05)';
      };
      
      button.onmouseout = () => {
        button.style.background = '#4a7c59';
        button.style.transform = 'scale(1)';
      };
      
      document.body.appendChild(button);
    }
    
    button.innerHTML = `🏪 Trade at ${port.portName}`;
    button.onclick = () => window.game.openTradingMenu(port);
    button.style.display = 'block';
  }

  hideTradingPortButton() {
    const button = document.getElementById('tradingPortButton');
    if (button) {
      button.style.display = 'none';
    }
  }

  showTradingMenu(port, stocks, playerInventory) {
    // Create trading modal
    const modal = document.createElement('div');
    modal.id = 'tradingModal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 2000;
    `;

    const content = document.createElement('div');
    content.style.cssText = `
      background: #2a1810;
      border: 3px solid #4a7c59;
      border-radius: 12px;
      padding: 24px;
      max-width: 90%;
      max-height: 90%;
      overflow-y: auto;
      color: white;
      font-family: 'Courier New', monospace;
      min-width: 600px;
    `;

    const playerGold = playerInventory.getItemQuantity('Gold Coins');

    let html = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
        <h2 style="margin: 0; color: #4a7c59;">🏪 ${port.portName}</h2>
        <button onclick="document.getElementById('tradingModal').remove()" style="background: #8B5C2A; color: white; border: none; padding: 8px 12px; border-radius: 5px; cursor: pointer;">✕ Close</button>
      </div>
      
      <div style="margin-bottom: 20px; padding: 12px; background: #1e3f66cc; border-radius: 8px;">
        <div style="color: #FFD700; font-weight: bold; margin-bottom: 8px;">💰 Your Gold: ${playerGold}</div>
        <div style="color: #ccc; font-size: 12px;">Buy items from the port or sell your goods for gold</div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <div>
          <h3 style="color: #4a7c59; margin-bottom: 15px;">🛒 Buy from Port</h3>
          <div style="max-height: 400px; overflow-y: auto;">
    `;

    stocks.forEach(stock => {
      if (stock.stockQuantity > 0) {
        const canAfford = playerGold >= stock.buyPrice;
        const buttonStyle = canAfford ? 
          'background: #4a7c59; color: white; cursor: pointer;' : 
          'background: #666; color: #999; cursor: not-allowed;';
        
        html += `
          <div style="margin-bottom: 12px; padding: 12px; background: #333; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: bold;">${stock.itemName}</div>
                <div style="font-size: 12px; color: #ccc;">Stock: ${stock.stockQuantity} | Price: ${stock.buyPrice} gold</div>
              </div>
              <button 
                onclick="${canAfford ? `window.game.buyItem('${stock.itemName}', ${stock.buyPrice}, ${port.id})` : ''}"
                style="padding: 6px 12px; border: none; border-radius: 4px; font-size: 12px; ${buttonStyle}"
                ${!canAfford ? 'disabled' : ''}
              >
                ${canAfford ? '💰 Buy' : '❌ Too Expensive'}
              </button>
            </div>
          </div>
        `;
      }
    });

    html += `
          </div>
        </div>
        <div>
          <h3 style="color: #4a7c59; margin-bottom: 15px;">💰 Sell to Port</h3>
          <div style="max-height: 400px; overflow-y: auto;">
    `;

    // Show player's sellable items
    const playerItems = playerInventory.getAllItems();
    const sellableItems = playerItems.filter(item => item.name !== 'Gold Coins');
    
    if (sellableItems.length === 0) {
      html += `<div style="color: #888; font-style: italic; padding: 20px; text-align: center;">No items to sell</div>`;
    } else {
      sellableItems.forEach(item => {
        const stock = stocks.find(s => s.itemName === item.name);
        const sellPrice = stock ? stock.sellPrice : Math.floor(Math.random() * 3) + 1;
        
        html += `
          <div style="margin-bottom: 12px; padding: 12px; background: #333; border-radius: 6px;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <div>
                <div style="font-weight: bold;">${item.name}</div>
                <div style="font-size: 12px; color: #ccc;">You have: ${item.quantity} | Sell for: ${sellPrice} gold each</div>
              </div>
              <button 
                onclick="window.game.sellItem('${item.name}', ${sellPrice}, ${port.id})"
                style="padding: 6px 12px; border: none; border-radius: 4px; font-size: 12px; background: #8B5C2A; color: white; cursor: pointer;"
              >
                💰 Sell
              </button>
            </div>
          </div>
        `;
      });
    }

    html += `
          </div>
        </div>
      </div>
      
      <div style="margin-top: 20px; padding-top: 15px; border-top: 1px solid #4a7c59; text-align: center; color: #ccc; font-size: 12px;">
        Prices fluctuate based on supply and demand. Check back later for different deals!
      </div>
    `;

    content.innerHTML = html;
    modal.appendChild(content);
    document.body.appendChild(modal);

    // Close on escape key
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        modal.remove();
        document.removeEventListener('keydown', handleEscape);
      }
    };
    document.addEventListener('keydown', handleEscape);
  }

  setupLoginParticles() {
    const bgCanvas = document.getElementById('bgParticles');
    if (!this.loginBox || !bgCanvas) return;

    const resizeBg = () => {
      bgCanvas.width = this.loginBox.clientWidth;
      bgCanvas.height = this.loginBox.clientHeight;
    };
    
    resizeBg();
    window.addEventListener('resize', resizeBg);

    // Generate particles
    const particles = [];
    const colors = ['#ff2222', '#fff', '#900', '#ffbbbb'];
    for (let i = 0; i < 24; i++) {
      particles.push({
        x: Math.random() * bgCanvas.width,
        y: Math.random() * bgCanvas.height,
        r: Math.random() * 2.5 + 1.5,
        dx: (Math.random() - 0.5) * 0.3,
        dy: (Math.random() - 0.5) * 0.3,
        color: colors[Math.floor(Math.random() * colors.length)]
      });
    }

    const ctx = bgCanvas.getContext('2d');
    this.particlesRunning = true;

    const animateParticles = () => {
      if (!this.particlesRunning || this.loginBox.style.display === 'none') {
        ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
        return;
      }

      ctx.clearRect(0, 0, bgCanvas.width, bgCanvas.height);
      for (const p of particles) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, 2 * Math.PI);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = 0.7;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.shadowBlur = 0;

        p.x += p.dx;
        p.y += p.dy;

        if (p.x < -10) p.x = bgCanvas.width + 10;
        if (p.x > bgCanvas.width + 10) p.x = -10;
        if (p.y < -10) p.y = bgCanvas.height + 10;
        if (p.y > bgCanvas.height + 10) p.y = -10;
      }
      requestAnimationFrame(animateParticles);
    };

    animateParticles();
  }
}