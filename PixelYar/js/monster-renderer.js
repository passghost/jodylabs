// monster-renderer.js - Pixel art rendering for sea monsters
export class MonsterRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  drawMonsters(monsters) {
    for (const monster of monsters) {
      this.drawMonster(monster);
    }
  }

  drawMonster(monster) {
    this.ctx.save();
    
    // Add glow effect for legendary monsters
    if (monster.isLegendary || monster.type === 'poseidon') {
      this.ctx.shadowColor = '#FFD700';
      this.ctx.shadowBlur = 8;
    }

    switch (monster.type) {
      case 'shark':
        this.drawShark(monster);
        break;
      case 'kraken':
        this.drawKraken(monster);
        break;
      case 'giant_squid':
        this.drawGiantSquid(monster);
        break;
      case 'poseidon':
        this.drawPoseidon(monster);
        break;
    }

    // Draw health bar for damaged monsters
    if (monster.health < monster.maxHealth) {
      this.drawHealthBar(monster);
    }

    this.ctx.restore();
  }

  drawShark(monster) {
    const x = monster.x;
    const y = monster.y;
    const size = monster.isLegendary ? 10 : 8;
    
    // Shark body (dark gray)
    this.ctx.fillStyle = monster.isLegendary ? '#2F2F2F' : '#4A4A4A';
    this.ctx.fillRect(x - size/2, y - 2, size, 4);
    
    // Shark head (pointed)
    this.ctx.fillStyle = monster.isLegendary ? '#1F1F1F' : '#3A3A3A';
    this.ctx.fillRect(x - size/2 - 2, y - 1, 2, 2);
    
    // Dorsal fin
    this.ctx.fillStyle = monster.isLegendary ? '#2F2F2F' : '#4A4A4A';
    this.ctx.fillRect(x - 1, y - 4, 2, 2);
    
    // Tail fin
    this.ctx.fillRect(x + size/2, y - 3, 3, 6);
    
    // Eyes (red for legendary)
    this.ctx.fillStyle = monster.isLegendary ? '#FF0000' : '#FFFFFF';
    this.ctx.fillRect(x - size/2 + 1, y - 1, 1, 1);
    
    // Teeth
    this.ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 3; i++) {
      this.ctx.fillRect(x - size/2 - 1, y + i - 1, 1, 1);
    }
  }

  drawKraken(monster) {
    const x = monster.x;
    const y = monster.y;
    const size = monster.isLegendary ? 25 : 20;
    
    // Kraken body (dark purple/black)
    this.ctx.fillStyle = monster.isLegendary ? '#2D1B69' : '#4A0E4E';
    this.ctx.beginPath();
    this.ctx.arc(x, y, size/2, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Tentacles (8 tentacles)
    this.ctx.fillStyle = monster.isLegendary ? '#3D2B79' : '#5A1E5E';
    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI * 2) / 8 + Date.now() * 0.001; // Animated tentacles
      const tentacleLength = size/2 + 8;
      const tentacleX = x + Math.cos(angle) * tentacleLength;
      const tentacleY = y + Math.sin(angle) * tentacleLength;
      
      // Draw tentacle segments
      for (let j = 0; j < 4; j++) {
        const segmentX = x + Math.cos(angle) * (size/2 + j * 2);
        const segmentY = y + Math.sin(angle) * (size/2 + j * 2);
        this.ctx.fillRect(segmentX - 1, segmentY - 1, 2, 2);
      }
      
      // Tentacle sucker
      this.ctx.fillStyle = monster.isLegendary ? '#FF6B6B' : '#8B4B8B';
      this.ctx.fillRect(tentacleX - 1, tentacleY - 1, 2, 2);
      this.ctx.fillStyle = monster.isLegendary ? '#3D2B79' : '#5A1E5E';
    }
    
    // Eyes (glowing for legendary)
    this.ctx.fillStyle = monster.isLegendary ? '#FFD700' : '#FF4444';
    this.ctx.fillRect(x - 3, y - 2, 2, 2);
    this.ctx.fillRect(x + 1, y - 2, 2, 2);
    
    // Beak
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(x - 1, y + 1, 2, 2);
  }

  drawGiantSquid(monster) {
    const x = monster.x;
    const y = monster.y;
    const size = monster.isLegendary ? 18 : 15;
    
    // Squid body (reddish-brown)
    this.ctx.fillStyle = monster.isLegendary ? '#8B0000' : '#A0522D';
    this.ctx.fillRect(x - size/2, y - 3, size, 6);
    
    // Squid head (elongated)
    this.ctx.fillStyle = monster.isLegendary ? '#660000' : '#8B4513';
    this.ctx.fillRect(x - size/2 - 3, y - 2, 3, 4);
    
    // Tentacles (10 tentacles for squid)
    this.ctx.fillStyle = monster.isLegendary ? '#8B0000' : '#A0522D';
    for (let i = 0; i < 10; i++) {
      const angle = (i * Math.PI * 2) / 10 + Date.now() * 0.0008;
      const tentacleLength = size/2 + 6;
      
      // Draw wavy tentacles
      for (let j = 0; j < 5; j++) {
        const wave = Math.sin(Date.now() * 0.003 + j * 0.5) * 2;
        const segmentX = x + Math.cos(angle) * (size/2 + j * 1.5) + wave;
        const segmentY = y + Math.sin(angle) * (size/2 + j * 1.5);
        this.ctx.fillRect(segmentX - 1, segmentY - 1, 2, 2);
      }
    }
    
    // Eyes (large squid eyes)
    this.ctx.fillStyle = monster.isLegendary ? '#FFD700' : '#FFFFFF';
    this.ctx.fillRect(x - 4, y - 1, 3, 3);
    this.ctx.fillRect(x + 1, y - 1, 3, 3);
    
    // Pupils
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(x - 3, y, 1, 1);
    this.ctx.fillRect(x + 2, y, 1, 1);
    
    // Fins
    this.ctx.fillStyle = monster.isLegendary ? '#660000' : '#8B4513';
    this.ctx.fillRect(x - size/2, y - 5, size, 2);
    this.ctx.fillRect(x - size/2, y + 3, size, 2);
  }

  drawPoseidon(monster) {
    const x = monster.x;
    const y = monster.y;
    const size = 25;
    
    // Poseidon's divine aura (animated)
    const auraRadius = size/2 + Math.sin(Date.now() * 0.005) * 3;
    this.ctx.strokeStyle = 'rgba(0, 191, 255, 0.5)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, auraRadius, 0, 2 * Math.PI);
    this.ctx.stroke();
    
    // Poseidon's body (godly blue-green)
    this.ctx.fillStyle = '#00CED1';
    this.ctx.fillRect(x - size/2, y - 4, size, 8);
    
    // Poseidon's head/crown
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(x - 6, y - 8, 12, 4);
    
    // Crown spikes
    for (let i = 0; i < 5; i++) {
      this.ctx.fillRect(x - 5 + i * 2, y - 10, 1, 2);
    }
    
    // Poseidon's beard (flowing)
    this.ctx.fillStyle = '#E6E6FA';
    for (let i = 0; i < 3; i++) {
      const wave = Math.sin(Date.now() * 0.004 + i) * 2;
      this.ctx.fillRect(x - 4 + i * 2 + wave, y + 4, 2, 6);
    }
    
    // Trident (his weapon)
    this.ctx.fillStyle = '#FFD700';
    this.ctx.fillRect(x - 1, y - 15, 2, 10);
    
    // Trident prongs
    this.ctx.fillRect(x - 4, y - 15, 2, 3);
    this.ctx.fillRect(x - 1, y - 17, 2, 5);
    this.ctx.fillRect(x + 2, y - 15, 2, 3);
    
    // Eyes (divine glow)
    this.ctx.fillStyle = '#00FFFF';
    this.ctx.fillRect(x - 3, y - 6, 2, 2);
    this.ctx.fillRect(x + 1, y - 6, 2, 2);
    
    // Divine energy waves
    for (let i = 0; i < 3; i++) {
      const waveRadius = size/2 + i * 8 + Math.sin(Date.now() * 0.003 + i) * 2;
      this.ctx.strokeStyle = `rgba(0, 255, 255, ${0.3 - i * 0.1})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, waveRadius, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
    
    // Water spouts around Poseidon
    for (let i = 0; i < 6; i++) {
      const angle = (i * Math.PI * 2) / 6 + Date.now() * 0.002;
      const spoutX = x + Math.cos(angle) * (size/2 + 10);
      const spoutY = y + Math.sin(angle) * (size/2 + 10);
      
      this.ctx.fillStyle = 'rgba(0, 191, 255, 0.7)';
      for (let j = 0; j < 4; j++) {
        this.ctx.fillRect(spoutX, spoutY - j * 2, 1, 2);
      }
    }
  }

  drawHealthBar(monster) {
    const x = monster.x;
    const y = monster.y - monster.size/2 - 8;
    const width = monster.size;
    const height = 3;
    
    // Background
    this.ctx.fillStyle = '#333333';
    this.ctx.fillRect(x - width/2, y, width, height);
    
    // Health bar
    const healthPercent = monster.health / monster.maxHealth;
    const healthColor = healthPercent > 0.6 ? '#00FF00' : healthPercent > 0.3 ? '#FFFF00' : '#FF0000';
    
    this.ctx.fillStyle = healthColor;
    this.ctx.fillRect(x - width/2, y, width * healthPercent, height);
    
    // Border
    this.ctx.strokeStyle = '#FFFFFF';
    this.ctx.lineWidth = 1;
    this.ctx.strokeRect(x - width/2, y, width, height);
  }
}