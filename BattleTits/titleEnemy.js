// titleEnemy.js
// Little enemy that walks around the title

// Mini enemy sprite (simplified version) - made slightly bigger
const miniEnemySprite = [
  ["empty","empty","helmet","helmet","helmet","empty","empty"],
  ["empty","helmet","helmet","helmet","helmet","helmet","empty"],
  ["empty","empty","skin","skin","skin","empty","empty"],
  ["redshirt","redshirt","redshirt","redshirt","redshirt","redshirt","rifle"],
  ["empty","redshirt","redshirt","redshirt","redshirt","redshirt","empty"],
  ["empty","redpants","redpants","empty","redpants","redpants","empty"],
  ["empty","boots","empty","empty","empty","boots","empty"]
];

class TitleEnemy {
  constructor() {
    this.x = 0;
    this.y = 0;
    this.angle = 0;
    this.radius = 80; // Much closer to title
    this.speed = 0.005; // Even slower rotation
    this.frame = 0;
    this.animSpeed = 0.1;
    this.bobOffset = Math.random() * Math.PI * 2; // Random bob phase
    this.element = document.getElementById('title-enemy');
    this.titleElement = document.getElementById('game-title');
    this.emoteElement = null;
    this.emoteTimer = 0;
    this.emoteInterval = 300; // Show emote every 5 seconds
    this.currentEmote = '';
    this.isStaring = false;
    this.stareTimer = 0;
    this.stareInterval = 200; // Stare every ~3 seconds
    
    if (!this.element || !this.titleElement) return;
    
    this.init();
    this.animate();
  }
  
  init() {
    // Create the mini enemy pixels
    this.renderEnemy();
    // Create emote element
    this.createEmoteElement();
  }
  
  createEmoteElement() {
    this.emoteElement = document.createElement('div');
    this.emoteElement.style.cssText = `
      position: absolute;
      font-size: 16px;
      z-index: 12;
      pointer-events: none;
      text-shadow: 0 0 4px rgba(255,255,255,0.8);
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    document.body.appendChild(this.emoteElement);
  }
  
  showEmote(emote) {
    if (!this.emoteElement) return;
    
    this.currentEmote = emote;
    this.emoteElement.textContent = emote;
    this.emoteElement.style.opacity = '1';
    
    // Hide emote after 2 seconds
    setTimeout(() => {
      if (this.emoteElement) {
        this.emoteElement.style.opacity = '0';
      }
    }, 2000);
  }
  
  getRandomEmote() {
    const emotes = [
      '🤔', // thinking
      '💭', // thought bubble
      '❓', // question
      '😮', // surprised
      '👀', // eyes
      '🎯', // target (battle related)
      '💡', // idea
      '😄', // happy
      '🤨', // suspicious
      '😲', // shocked
      '💥', // explosion (battle related)
      '⚔️', // swords (battle related)
      '🔥', // fire
      '😎', // cool
      '🤯'  // mind blown
    ];
    return emotes[Math.floor(Math.random() * emotes.length)];
  }
  
  renderEnemy() {
    if (!this.element) return;
    
    this.element.innerHTML = '';
    
    // Animate walking by alternating frame
    const currentFrame = Math.floor(this.frame) % 2;
    let sprite = JSON.parse(JSON.stringify(miniEnemySprite));
    
    // Simple walking animation - move boots
    if (currentFrame === 1) {
      sprite[6][1] = 'empty';
      sprite[6][5] = 'boots';
    } else {
      sprite[6][1] = 'boots';
      sprite[6][5] = 'empty';
    }
    
    // Render the sprite
    for (let row = 0; row < sprite.length; row++) {
      for (let col = 0; col < sprite[row].length; col++) {
        const color = sprite[row][col];
        if (color !== 'empty') {
          const pixel = document.createElement('div');
          pixel.className = 'title-pixel';
          pixel.style.left = (col * 3) + 'px'; // Bigger pixels
          pixel.style.top = (row * 3) + 'px';
          
          // Set pixel colors
          switch (color) {
            case 'helmet': pixel.style.background = '#444444'; break;
            case 'skin': pixel.style.background = '#ffdbac'; break;
            case 'redshirt': pixel.style.background = '#cc0000'; break;
            case 'redpants': pixel.style.background = '#880000'; break;
            case 'boots': pixel.style.background = '#222222'; break;
            case 'rifle': pixel.style.background = '#666666'; break;
            default: pixel.style.background = '#ffffff';
          }
          
          pixel.style.boxShadow = `0 0 2px ${pixel.style.background}`;
          this.element.appendChild(pixel);
        }
      }
    }
  }
  
  update() {
    if (!this.element || !this.titleElement) return;
    
    // Update timers
    this.emoteTimer++;
    this.stareTimer++;
    
    // Check if should start staring
    if (!this.isStaring && this.stareTimer > this.stareInterval) {
      this.isStaring = true;
      this.stareTimer = 0;
      this.showEmote(this.getRandomEmote());
    }
    
    // Check if should stop staring and resume walking
    if (this.isStaring && this.stareTimer > 120) { // Stare for 2 seconds
      this.isStaring = false;
      this.stareTimer = 0;
    }
    
    // Update animation frame (slower when staring)
    this.frame += this.isStaring ? this.animSpeed * 0.2 : this.animSpeed;
    
    // Update position
    if (!this.isStaring) {
      this.angle += this.speed;
    }
    
    // Calculate position relative to title center (using screen coordinates)
    const titleRect = this.titleElement.getBoundingClientRect();
    const titleCenterX = titleRect.left + titleRect.width / 2;
    const titleCenterY = titleRect.top + titleRect.height / 2;
    
    // Calculate circular path with slight bobbing, staying close to title
    const bobAmount = Math.sin(this.angle * 3 + this.bobOffset) * 3;
    this.x = titleCenterX + Math.cos(this.angle) * this.radius - 10; // Offset for enemy size
    this.y = titleCenterY + Math.sin(this.angle) * (this.radius * 0.4) + bobAmount - 10;
    
    // Update element position
    this.element.style.left = this.x + 'px';
    this.element.style.top = this.y + 'px';
    
    // Face the direction of movement (or face title when staring)
    if (this.isStaring) {
      // Face towards the title center
      const faceTitle = this.x < titleCenterX;
      this.element.style.transform = faceTitle ? 'scaleX(1)' : 'scaleX(-1)';
    } else {
      const facingLeft = Math.cos(this.angle) < 0;
      this.element.style.transform = facingLeft ? 'scaleX(-1)' : 'scaleX(1)';
    }
    
    // Update emote position
    if (this.emoteElement && this.currentEmote) {
      this.emoteElement.style.left = (this.x + 10) + 'px';
      this.emoteElement.style.top = (this.y - 25) + 'px';
    }
    
    // Re-render if animation frame changed
    if (Math.floor(this.frame) !== Math.floor(this.frame - this.animSpeed)) {
      this.renderEnemy();
    }
  }
  
  animate() {
    this.update();
    requestAnimationFrame(() => this.animate());
  }
}

// Initialize the title enemy when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  // Small delay to ensure title is rendered
  setTimeout(() => {
    new TitleEnemy();
  }, 500);
});