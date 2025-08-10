// renderer.js - Canvas rendering and visual effects
import { CONFIG } from './config.js';
import { MonsterRenderer } from './monster-renderer.js';
import { PhenomenaRenderer } from './phenomena-renderer.js';

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.zoom = CONFIG.ZOOM.DEFAULT;
    this.panX = 0;
    this.panY = 0;
    this.monsterRenderer = new MonsterRenderer(this.ctx);
    this.phenomenaRenderer = new PhenomenaRenderer(this.ctx);
  }

  drawOcean(islands, waterObjects = [], placedPixels = []) {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    // Blue sea base
    this.ctx.fillStyle = '#2196F3';
    this.ctx.fillRect(0, 0, CONFIG.OCEAN_WIDTH, CONFIG.OCEAN_HEIGHT);
    
    // Red sea area (dangerous zone)
    this.ctx.fillStyle = '#8B0000'; // Dark red base
    this.ctx.fillRect(CONFIG.RED_SEA.START_X, 0, CONFIG.OCEAN_WIDTH - CONFIG.RED_SEA.START_X, CONFIG.OCEAN_HEIGHT);
    
    // Red sea gradient border
    const gradient = this.ctx.createLinearGradient(CONFIG.RED_SEA.START_X - 50, 0, CONFIG.RED_SEA.START_X + 50, 0);
    gradient.addColorStop(0, 'rgba(33, 150, 243, 1)'); // Blue
    gradient.addColorStop(0.5, 'rgba(139, 0, 0, 0.8)'); // Red transition
    gradient.addColorStop(1, 'rgba(139, 0, 0, 1)'); // Full red
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(CONFIG.RED_SEA.START_X - 50, 0, 100, CONFIG.OCEAN_HEIGHT);
    
    // Blue sea water texture
    for (let i = 0; i < 18000; i++) {
      const x = Math.random() * CONFIG.RED_SEA.START_X;
      const y = Math.random() * CONFIG.OCEAN_HEIGHT;
      const alpha = Math.random() * 0.25 + 0.12;
      const blue = 180 + Math.floor(Math.random() * 70);
      const green = 140 + Math.floor(Math.random() * 80);
      this.ctx.fillStyle = `rgba(30,${green},${blue},${alpha})`;
      this.ctx.fillRect(x, y, 2, 2);
    }
    
    // Red sea water texture (more ominous)
    for (let i = 0; i < 12000; i++) {
      const x = CONFIG.RED_SEA.START_X + Math.random() * (CONFIG.OCEAN_WIDTH - CONFIG.RED_SEA.START_X);
      const y = Math.random() * CONFIG.OCEAN_HEIGHT;
      const alpha = Math.random() * 0.3 + 0.15;
      const red = 100 + Math.floor(Math.random() * 50);
      const green = Math.floor(Math.random() * 30);
      this.ctx.fillStyle = `rgba(${red},${green},0,${alpha})`;
      this.ctx.fillRect(x, y, 2, 2);
    }
    
    // Draw islands
    for (const isl of islands) {
      this.ctx.save();
      this.ctx.beginPath();
      this.ctx.ellipse(isl.cx, isl.cy, isl.rx, isl.ry, 0, 0, 2 * Math.PI);
      this.ctx.fillStyle = '#8B5C2A';
      this.ctx.shadowColor = '#442200';
      this.ctx.shadowBlur = 8;
      this.ctx.fill();
      this.ctx.restore();
      
      // Draw port (enhanced)
      this.ctx.save();
      
      // Port building
      this.ctx.fillStyle = '#8B4513';
      this.ctx.fillRect(isl.portX - 3, isl.portY - 3, 6, 6);
      
      // Port dock
      this.ctx.fillStyle = '#654321';
      this.ctx.fillRect(isl.portX - 5, isl.portY + 3, 10, 2);
      
      // Port flag
      this.ctx.fillStyle = '#4a7c59';
      this.ctx.fillRect(isl.portX - 1, isl.portY - 8, 2, 5);
      this.ctx.fillStyle = '#5a9c69';
      this.ctx.fillRect(isl.portX + 1, isl.portY - 7, 4, 3);
      
      // Port name (only show if zoomed in enough)
      if (this.zoom >= 8 && isl.portName) {
        this.ctx.fillStyle = '#FFFFFF';
        this.ctx.font = `${Math.max(8, this.zoom / 2)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.shadowColor = '#000000';
        this.ctx.shadowBlur = 2;
        this.ctx.fillText(isl.portName, isl.portX, isl.portY - 12);
        this.ctx.shadowBlur = 0;
      }
      
      this.ctx.restore();
    }
    
    // Subtle wave lines
    for (let y = 0; y < CONFIG.OCEAN_HEIGHT; y += 32) {
      this.ctx.strokeStyle = 'rgba(80,160,220,0.07)';
      this.ctx.beginPath();
      for (let x = 0; x < CONFIG.OCEAN_WIDTH; x += 32) {
        const wave = Math.sin((x + y) * 0.01) * 4;
        this.ctx.lineTo(x, y + wave);
      }
      this.ctx.stroke();
    }

    // Draw red sea boundary markers
    this.drawRedSeaBoundary();
    
    // Draw water objects
    this.drawWaterObjects(waterObjects);
    
    // Draw placed pixels
    this.drawPlacedPixels(placedPixels);
  }

  drawPlayers(allPlayers, currentPlayer, playerRotation = 0, cannonAngle = 0, cannonBalls = [], monsters = [], phenomena = [], mouseX = 0, mouseY = 0) {
    // Draw phenomena first (background effects)
    this.phenomenaRenderer.drawPhenomena(phenomena);
    
    // Draw monsters (behind ships)
    this.monsterRenderer.drawMonsters(monsters);
    
    // Draw all other pirates first (no glow)
    allPlayers.forEach(p => {
      if (p.id !== currentPlayer.id) {
        const isAI = p.isAI || false;
        this.drawPirateShip(p.x, p.y, p.color || '#8B5C2A', false, isAI, 0);
        
        // Draw AI ship cannon if they're firing
        if (isAI && p.cannonAngle !== undefined) {
          this.drawCannon(p.x, p.y, p.cannonAngle, false);
        }
      }
    });

    // Draw the player's own ship with glow and rotation
    this.drawPirateShip(currentPlayer.x, currentPlayer.y, '#8B5C2A', true, false, playerRotation);
    
    // Draw player's cannon circle and cannon
    this.drawCannon(currentPlayer.x, currentPlayer.y, cannonAngle, true);
    
    // Draw crosshair at mouse position (if within reasonable range)
    const distance = Math.sqrt((mouseX - currentPlayer.x) ** 2 + (mouseY - currentPlayer.y) ** 2);
    if (distance < 100 && mouseX > 0 && mouseY > 0) { // Only show if mouse is tracked and nearby
      this.drawCrosshair(mouseX, mouseY);
    }
    
    // Draw all cannon balls
    this.drawCannonBalls(cannonBalls);
  }

  drawPirateShip(x, y, color, isCurrentPlayer = false, isAI = false, rotation = 0) {
    this.ctx.save();
    
    // Get boat properties for current player
    let boatSize = { width: 8, height: 4 };
    let boatColor = color;
    
    if (isCurrentPlayer && window.game && window.game.boatManager) {
      const boatStats = window.game.boatManager.getBoatStats();
      if (boatStats) {
        boatSize = boatStats.size;
        boatColor = boatStats.color;
      }
    }
    
    // Apply rotation for current player
    if (isCurrentPlayer && rotation !== 0) {
      this.ctx.translate(x, y);
      this.ctx.rotate(rotation);
      this.ctx.translate(-x, -y);
    }
    
    if (isCurrentPlayer) {
      // Add glow effect for current player
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 8;
    }

    // Ship hull (main body) - scaled by boat size
    const hullWidth = boatSize.width / 2;
    const hullHeight = boatSize.height / 2;
    
    this.ctx.fillStyle = boatColor;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y, hullWidth, hullHeight, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    // Ship deck (lighter color) - scaled
    const deckWidth = hullWidth * 0.75;
    const deckHeight = hullHeight * 0.6;
    this.ctx.beginPath();
    this.ctx.ellipse(x, y - 0.5, deckWidth, deckHeight, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    // Mast - scaled by boat size
    const mastHeight = boatSize.height * 2;
    this.ctx.fillStyle = '#654321';
    this.ctx.fillRect(x - 0.5, y - mastHeight, 1, mastHeight + 2);

    // Main sail - scaled
    let sailColor = '#F5F5DC'; // Default cream
    if (isCurrentPlayer) sailColor = '#FFD700'; // Gold for player
    if (isAI) sailColor = '#8B0000'; // Dark red for AI ships
    
    const sailWidth = hullWidth;
    const sailHeight = mastHeight * 0.6;
    
    this.ctx.fillStyle = sailColor;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 0.5, y - sailHeight);
    this.ctx.lineTo(x + sailWidth, y - sailHeight + 1);
    this.ctx.lineTo(x + sailWidth, y - 1);
    this.ctx.lineTo(x + 0.5, y - 2);
    this.ctx.closePath();
    this.ctx.fill();

    // Sail details (rope lines)
    this.ctx.strokeStyle = '#8B4513';
    this.ctx.lineWidth = 0.3;
    this.ctx.beginPath();
    this.ctx.moveTo(x + 0.5, y - 4);
    this.ctx.lineTo(x + 3.5, y - 3.2);
    this.ctx.moveTo(x + 0.5, y - 3);
    this.ctx.lineTo(x + 3.5, y - 2.2);
    this.ctx.stroke();

    // Bow (front of ship)
    this.ctx.fillStyle = this.darkenColor(color, 0.2);
    this.ctx.beginPath();
    this.ctx.moveTo(x - 4, y);
    this.ctx.lineTo(x - 2, y - 1);
    this.ctx.lineTo(x - 2, y + 1);
    this.ctx.closePath();
    this.ctx.fill();

    // Stern (back of ship)
    this.ctx.fillStyle = this.darkenColor(color, 0.1);
    this.ctx.beginPath();
    this.ctx.moveTo(x + 4, y);
    this.ctx.lineTo(x + 2, y - 1.5);
    this.ctx.lineTo(x + 2, y + 1.5);
    this.ctx.closePath();
    this.ctx.fill();

    // Pirate flag on mast
    if (isCurrentPlayer) {
      // Player's skull and crossbones flag
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(x - 0.5, y - 6, 2, 1.5);
      this.ctx.fillStyle = '#FFFFFF';
      this.ctx.beginPath();
      this.ctx.arc(x + 0.2, y - 5.5, 0.3, 0, 2 * Math.PI);
      this.ctx.fill();
      this.ctx.fillRect(x - 0.2, y - 5, 0.8, 0.2);
      this.ctx.fillRect(x + 0.2, y - 5.2, 0.2, 0.6);
    } else if (isAI) {
      // AI enemy flag (black with red skull)
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(x - 0.5, y - 6, 2, 1.5);
      this.ctx.fillStyle = '#FF0000';
      this.ctx.beginPath();
      this.ctx.arc(x + 0.2, y - 5.5, 0.3, 0, 2 * Math.PI);
      this.ctx.fill();
      // Red X instead of crossbones
      this.ctx.strokeStyle = '#FF0000';
      this.ctx.lineWidth = 0.2;
      this.ctx.beginPath();
      this.ctx.moveTo(x - 0.1, y - 5.1);
      this.ctx.lineTo(x + 0.5, y - 4.9);
      this.ctx.moveTo(x + 0.5, y - 5.1);
      this.ctx.lineTo(x - 0.1, y - 4.9);
      this.ctx.stroke();
    } else {
      // Regular player flag
      this.ctx.fillStyle = '#8B0000';
      this.ctx.fillRect(x - 0.5, y - 6, 1.5, 1);
    }

    // Wake/water splash behind ship
    this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
    this.ctx.beginPath();
    this.ctx.ellipse(x + 3, y, 1.5, 0.8, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    this.ctx.beginPath();
    this.ctx.ellipse(x + 4, y, 1, 0.5, 0, 0, 2 * Math.PI);
    this.ctx.fill();

    this.ctx.restore();

    // Add golden outline for current player
    if (isCurrentPlayer) {
      this.ctx.save();
      this.ctx.strokeStyle = '#FFD700';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.ellipse(x, y, 5, 3, 0, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.restore();
    }
  }

  // Helper functions for color manipulation
  lightenColor(color, factor) {
    // Convert hex to RGB, lighten, and convert back
    const hex = color.replace('#', '');
    const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + Math.floor(255 * factor));
    const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + Math.floor(255 * factor));
    const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + Math.floor(255 * factor));
    return `rgb(${r},${g},${b})`;
  }

  darkenColor(color, factor) {
    // Convert hex to RGB, darken, and convert back
    const hex = color.replace('#', '');
    const r = Math.max(0, parseInt(hex.substr(0, 2), 16) - Math.floor(255 * factor));
    const g = Math.max(0, parseInt(hex.substr(2, 2), 16) - Math.floor(255 * factor));
    const b = Math.max(0, parseInt(hex.substr(4, 2), 16) - Math.floor(255 * factor));
    return `rgb(${r},${g},${b})`;
  }

  setZoom(newZoom) {
    this.zoom = Math.max(CONFIG.ZOOM.MIN, Math.min(CONFIG.ZOOM.MAX, newZoom));
    this.canvas.style.width = (CONFIG.OCEAN_WIDTH * this.zoom) + 'px';
    this.canvas.style.height = (CONFIG.OCEAN_HEIGHT * this.zoom) + 'px';
  }

  centerOnPlayer(player) {
    if (!player) return;
    
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const px = player.x * this.zoom;
    const py = player.y * this.zoom;
    
    this.panX = viewW / 2 - px - this.zoom / 2;
    this.panY = viewH / 2 - py - this.zoom / 2;
    
    this.canvas.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(1)`;
  }

  zoomIn() {
    this.setZoom(this.zoom * 2);
    return this.zoom;
  }

  zoomOut() {
    this.setZoom(this.zoom / 2);
    return this.zoom;
  }

  getZoom() {
    return this.zoom;
  }

  drawWaterObjects(waterObjects) {
    for (const obj of waterObjects) {
      this.ctx.save();
      
      switch (obj.type) {
        case 'wreckage':
          this.ctx.fillStyle = '#8B4513';
          this.ctx.shadowColor = '#654321';
          this.ctx.shadowBlur = 4;
          this.ctx.fillRect(obj.x - 1, obj.y - 1, 3, 3);
          break;
          
        case 'treasure_chest':
          this.ctx.fillStyle = '#FFD700';
          this.ctx.shadowColor = '#FFA500';
          this.ctx.shadowBlur = 6;
          this.ctx.fillRect(obj.x, obj.y, 2, 2);
          break;
          
        case 'floating_barrel':
          this.ctx.fillStyle = '#8B4513';
          this.ctx.shadowColor = '#654321';
          this.ctx.shadowBlur = 3;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, 1.5, 0, 2 * Math.PI);
          this.ctx.fill();
          break;
          
        case 'message_bottle':
          this.ctx.fillStyle = '#228B22';
          this.ctx.shadowColor = '#006400';
          this.ctx.shadowBlur = 3;
          this.ctx.fillRect(obj.x, obj.y, 1, 2);
          break;
          
        case 'ghost_ship':
          this.ctx.fillStyle = 'rgba(255,255,255,0.3)';
          this.ctx.shadowColor = '#FFFFFF';
          this.ctx.shadowBlur = 8;
          this.ctx.fillRect(obj.x - 2, obj.y - 2, 5, 5);
          break;
          
        case 'whirlpool':
          this.ctx.strokeStyle = '#4169E1';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          for (let i = 0; i < 3; i++) {
            const radius = 2 + i;
            this.ctx.arc(obj.x, obj.y, radius, 0, 2 * Math.PI);
          }
          this.ctx.stroke();
          break;
          
        case 'sea_mine':
          this.ctx.fillStyle = '#2F4F4F';
          this.ctx.shadowColor = '#000000';
          this.ctx.shadowBlur = 4;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, 2, 0, 2 * Math.PI);
          this.ctx.fill();
          // Add spikes
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            const x1 = obj.x + Math.cos(angle) * 2;
            const y1 = obj.y + Math.sin(angle) * 2;
            const x2 = obj.x + Math.cos(angle) * 3;
            const y2 = obj.y + Math.sin(angle) * 3;
            this.ctx.beginPath();
            this.ctx.moveTo(x1, y1);
            this.ctx.lineTo(x2, y2);
            this.ctx.stroke();
          }
          break;
          
        case 'floating_corpse':
          this.ctx.fillStyle = '#8B7D6B';
          this.ctx.shadowColor = '#696969';
          this.ctx.shadowBlur = 3;
          this.ctx.fillRect(obj.x, obj.y, 2, 1);
          break;
          
        case 'merchant_cargo':
          this.ctx.fillStyle = '#CD853F';
          this.ctx.shadowColor = '#A0522D';
          this.ctx.shadowBlur = 4;
          this.ctx.fillRect(obj.x - 1, obj.y - 1, 3, 2);
          break;
          
        case 'cursed_idol':
          this.ctx.fillStyle = '#9400D3';
          this.ctx.shadowColor = '#8A2BE2';
          this.ctx.shadowBlur = 6;
          this.ctx.fillRect(obj.x, obj.y, 2, 2);
          break;
          
        case 'siren_rock':
          this.ctx.fillStyle = '#FF69B4';
          this.ctx.shadowColor = '#FF1493';
          this.ctx.shadowBlur = 5;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, 2.5, 0, 2 * Math.PI);
          this.ctx.fill();
          break;
          
        case 'kraken_tentacle':
          this.ctx.fillStyle = '#2F4F4F';
          this.ctx.shadowColor = '#000000';
          this.ctx.shadowBlur = 6;
          this.ctx.beginPath();
          this.ctx.ellipse(obj.x, obj.y, 4, 1, Math.random() * Math.PI, 0, 2 * Math.PI);
          this.ctx.fill();
          break;
          
        case 'volcanic_rock':
          this.ctx.fillStyle = '#B22222';
          this.ctx.shadowColor = '#8B0000';
          this.ctx.shadowBlur = 4;
          this.ctx.fillRect(obj.x, obj.y, 2, 2);
          break;
          
        case 'ice_floe':
          this.ctx.fillStyle = '#F0F8FF';
          this.ctx.shadowColor = '#E0E6FF';
          this.ctx.shadowBlur = 3;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, 3, 0, 2 * Math.PI);
          this.ctx.fill();
          break;
          
        case 'pirate_flag':
          this.ctx.fillStyle = '#000000';
          this.ctx.fillRect(obj.x, obj.y - 2, 1, 4);
          this.ctx.fillStyle = '#FF0000';
          this.ctx.fillRect(obj.x + 1, obj.y - 1, 2, 2);
          break;

        // NEW SPECIAL EVENT WATER OBJECTS
        case 'treasure_location':
          // Large glowing treasure cache
          this.ctx.fillStyle = obj.data.collected ? '#8B7D6B' : '#FFD700';
          this.ctx.shadowColor = obj.data.collected ? '#696969' : '#FFA500';
          this.ctx.shadowBlur = obj.data.collected ? 2 : 12;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, obj.data.collected ? 2 : 4, 0, 2 * Math.PI);
          this.ctx.fill();
          if (!obj.data.collected) {
            // Add sparkle effect
            for (let i = 0; i < 6; i++) {
              const angle = (i * Math.PI) / 3;
              const sparkleX = obj.x + Math.cos(angle) * 6;
              const sparkleY = obj.y + Math.sin(angle) * 6;
              this.ctx.fillStyle = '#FFFF00';
              this.ctx.fillRect(sparkleX, sparkleY, 1, 1);
            }
          }
          break;

        case 'butt_shark':
          this.ctx.fillStyle = '#4169E1';
          this.ctx.shadowColor = '#0000FF';
          this.ctx.shadowBlur = 8;
          this.ctx.beginPath();
          this.ctx.ellipse(obj.x, obj.y, 6, 3, 0, 0, 2 * Math.PI);
          this.ctx.fill();
          // Add fin
          this.ctx.fillStyle = '#1E90FF';
          this.ctx.beginPath();
          this.ctx.moveTo(obj.x - 3, obj.y - 2);
          this.ctx.lineTo(obj.x - 6, obj.y - 4);
          this.ctx.lineTo(obj.x - 3, obj.y);
          this.ctx.fill();
          break;

        case 'meteor_crash':
          this.ctx.fillStyle = '#FF4500';
          this.ctx.shadowColor = '#FFD700';
          this.ctx.shadowBlur = 10;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, 5, 0, 2 * Math.PI);
          this.ctx.fill();
          // Add crater effect
          this.ctx.strokeStyle = '#8B4513';
          this.ctx.lineWidth = 2;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, 8, 0, 2 * Math.PI);
          this.ctx.stroke();
          break;

        case 'ancient_kraken':
          this.ctx.fillStyle = '#2F4F4F';
          this.ctx.shadowColor = '#000080';
          this.ctx.shadowBlur = 12;
          this.ctx.beginPath();
          this.ctx.arc(obj.x, obj.y, 8, 0, 2 * Math.PI);
          this.ctx.fill();
          // Add tentacles
          for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            this.ctx.beginPath();
            this.ctx.ellipse(
              obj.x + Math.cos(angle) * 6, 
              obj.y + Math.sin(angle) * 6, 
              3, 1, angle, 0, 2 * Math.PI
            );
            this.ctx.fill();
          }
          break;

        case 'ghost_fleet':
          this.ctx.fillStyle = 'rgba(255,255,255,0.4)';
          this.ctx.shadowColor = '#FFFFFF';
          this.ctx.shadowBlur = 15;
          // Draw multiple ghost ships
          for (let i = 0; i < 3; i++) {
            const offsetX = (i - 1) * 4;
            const offsetY = Math.sin(i) * 2;
            this.ctx.fillRect(obj.x + offsetX - 2, obj.y + offsetY - 2, 4, 4);
          }
          break;

        case 'mysterious_island':
          this.ctx.fillStyle = '#8B5C2A';
          this.ctx.shadowColor = '#654321';
          this.ctx.shadowBlur = 8;
          this.ctx.beginPath();
          this.ctx.ellipse(obj.x, obj.y, 10, 6, 0, 0, 2 * Math.PI);
          this.ctx.fill();
          // Add mysterious glow
          this.ctx.fillStyle = 'rgba(138, 43, 226, 0.3)';
          this.ctx.beginPath();
          this.ctx.ellipse(obj.x, obj.y, 12, 8, 0, 0, 2 * Math.PI);
          this.ctx.fill();
          break;
          
        default:
          // Generic water object
          this.ctx.fillStyle = '#4682B4';
          this.ctx.fillRect(obj.x, obj.y, 1, 1);
      }
      
      this.ctx.restore();
    }
  }

  drawPlacedPixels(placedPixels) {
    if (!placedPixels || placedPixels.length === 0) return;

    this.ctx.save();
    
    // Define pixel colors
    const pixelColors = {
      'red': '#FF0000',
      'blue': '#0000FF', 
      'green': '#00FF00',
      'yellow': '#FFFF00',
      'purple': '#800080'
    };

    // Draw each placed pixel
    for (const pixel of placedPixels) {
      const color = pixelColors[pixel.color] || '#FFFFFF';
      
      // Add a subtle glow effect to make pixels more visible
      this.ctx.shadowColor = color;
      this.ctx.shadowBlur = 2;
      this.ctx.fillStyle = color;
      
      // Draw the pixel as a small square
      this.ctx.fillRect(pixel.x - 0.5, pixel.y - 0.5, 1, 1);
      
      // Add a white border for better visibility
      this.ctx.shadowBlur = 0;
      this.ctx.strokeStyle = '#FFFFFF';
      this.ctx.lineWidth = 0.2;
      this.ctx.strokeRect(pixel.x - 0.5, pixel.y - 0.5, 1, 1);
    }
    
    this.ctx.restore();
  }

  // Helper method to convert screen coordinates to world coordinates
  screenToWorld(screenX, screenY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = screenX - rect.left;
    const canvasY = screenY - rect.top;
    
    // Account for zoom and pan - the canvas is scaled via CSS transform
    const worldX = (canvasX - this.panX) / this.zoom;
    const worldY = (canvasY - this.panY) / this.zoom;
    
    return { x: Math.max(0, Math.min(CONFIG.OCEAN_WIDTH, worldX)), y: Math.max(0, Math.min(CONFIG.OCEAN_HEIGHT, worldY)) };
  }

  drawRedSeaBoundary() {
    this.ctx.save();
    
    // Draw warning buoys along the boundary
    const buoySpacing = 100;
    for (let y = 0; y < CONFIG.OCEAN_HEIGHT; y += buoySpacing) {
      // Warning buoy
      this.ctx.fillStyle = '#FF4444';
      this.ctx.beginPath();
      this.ctx.arc(CONFIG.RED_SEA.START_X - 10, y, 3, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Buoy light (blinking effect based on time)
      if (Math.floor(Date.now() / 500) % 2 === 0) {
        this.ctx.fillStyle = '#FFFF00';
        this.ctx.beginPath();
        this.ctx.arc(CONFIG.RED_SEA.START_X - 10, y, 1, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
    
    // Draw danger zone text
    this.ctx.fillStyle = '#FF0000';
    this.ctx.font = 'bold 16px Arial';
    this.ctx.textAlign = 'center';
    this.ctx.strokeStyle = '#000000';
    this.ctx.lineWidth = 2;
    
    const warningY = CONFIG.OCEAN_HEIGHT / 2;
    this.ctx.strokeText('⚠️ DANGER ZONE ⚠️', CONFIG.RED_SEA.START_X + 200, warningY - 20);
    this.ctx.fillText('⚠️ DANGER ZONE ⚠️', CONFIG.RED_SEA.START_X + 200, warningY - 20);
    
    this.ctx.font = '12px Arial';
    this.ctx.strokeText('Higher Risk • Better Rewards', CONFIG.RED_SEA.START_X + 200, warningY + 5);
    this.ctx.fillText('Higher Risk • Better Rewards', CONFIG.RED_SEA.START_X + 200, warningY + 5);
    
    this.ctx.restore();
  }

  drawCannon(shipX, shipY, cannonAngle, isPlayer = false) {
    this.ctx.save();
    
    if (isPlayer) {
      // Draw cannon range circle for player (smaller and more subtle)
      this.ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)';
      this.ctx.lineWidth = 0.5;
      this.ctx.setLineDash([3, 3]);
      this.ctx.beginPath();
      this.ctx.arc(shipX, shipY, 12, 0, 2 * Math.PI);
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }
    
    // Draw smaller cannon barrel
    const cannonLength = 5; // Reduced from 8 to 5
    const cannonX = shipX + Math.cos(cannonAngle) * cannonLength;
    const cannonY = shipY + Math.sin(cannonAngle) * cannonLength;
    
    // Cannon base (small circle at ship center)
    this.ctx.fillStyle = '#444444';
    this.ctx.beginPath();
    this.ctx.arc(shipX, shipY, 1.5, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Cannon barrel (thinner)
    this.ctx.strokeStyle = '#333333';
    this.ctx.lineWidth = 1.5; // Reduced from 2 to 1.5
    this.ctx.beginPath();
    this.ctx.moveTo(shipX, shipY);
    this.ctx.lineTo(cannonX, cannonY);
    this.ctx.stroke();
    
    // Draw smaller cannon tip
    this.ctx.fillStyle = '#222222';
    this.ctx.beginPath();
    this.ctx.arc(cannonX, cannonY, 0.8, 0, 2 * Math.PI); // Reduced from 1 to 0.8
    this.ctx.fill();
    
    this.ctx.restore();
  }

  drawCannonBalls(cannonBalls) {
    if (cannonBalls.length > 0) {
      console.log('Drawing', cannonBalls.length, 'cannon balls');
    }
    
    this.ctx.save();
    
    for (const ball of cannonBalls) {
      console.log('Drawing cannon ball at:', ball.x, ball.y, 'velocity:', ball.vx, ball.vy);
      
      // Draw cannon ball
      this.ctx.fillStyle = '#222222';
      this.ctx.beginPath();
      this.ctx.arc(ball.x, ball.y, 1.5, 0, 2 * Math.PI);
      this.ctx.fill();
      
      // Draw trail effect
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(ball.x - ball.vx * 2, ball.y - ball.vy * 2);
      this.ctx.lineTo(ball.x, ball.y);
      this.ctx.stroke();
    }
    
    this.ctx.restore();
  }

  drawCrosshair(x, y) {
    this.ctx.save();
    
    // Draw subtle crosshair at mouse position
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.6)';
    this.ctx.lineWidth = 1;
    this.ctx.setLineDash([2, 2]);
    
    // Horizontal line
    this.ctx.beginPath();
    this.ctx.moveTo(x - 6, y);
    this.ctx.lineTo(x + 6, y);
    this.ctx.stroke();
    
    // Vertical line
    this.ctx.beginPath();
    this.ctx.moveTo(x, y - 6);
    this.ctx.lineTo(x, y + 6);
    this.ctx.stroke();
    
    // Center dot
    this.ctx.setLineDash([]);
    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 1, 0, 2 * Math.PI);
    this.ctx.fill();
    
    this.ctx.restore();
  }
}