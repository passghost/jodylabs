// phenomena-renderer.js - Pixel art rendering for sea phenomena
export class PhenomenaRenderer {
  constructor(ctx) {
    this.ctx = ctx;
  }

  drawPhenomena(phenomena) {
    for (const phenomenon of phenomena) {
      this.drawPhenomenon(phenomenon);
    }
  }

  drawPhenomenon(phenomenon) {
    this.ctx.save();
    
    // Add glow effects for magical phenomena
    if (['portal', 'siren', 'ufo'].includes(phenomenon.type)) {
      this.ctx.shadowColor = this.getPhenomenonGlowColor(phenomenon.type);
      this.ctx.shadowBlur = 6;
    }

    switch (phenomenon.type) {
      case 'ufo':
        this.drawUFO(phenomenon);
        break;
      case 'vortex':
        this.drawVortex(phenomenon);
        break;
      case 'portal':
        this.drawPortal(phenomenon);
        break;
      case 'siren':
        this.drawSiren(phenomenon);
        break;
      case 'dolphin':
        this.drawDolphin(phenomenon);
        break;
      case 'storm':
        this.drawStorm(phenomenon);
        break;
    }

    this.ctx.restore();
  }

  getPhenomenonGlowColor(type) {
    const glowColors = {
      ufo: '#00FF00',
      portal: '#9400D3',
      siren: '#FF69B4'
    };
    return glowColors[type] || '#FFFFFF';
  }

  drawUFO(phenomenon) {
    const x = phenomenon.x;
    const y = phenomenon.y;
    const phase = phenomenon.animationPhase;
    const hover = Math.sin(phase * 2) * 3; // Hovering motion
    
    // UFO body (metallic gray)
    this.ctx.fillStyle = '#C0C0C0';
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + hover, 12, 6, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // UFO dome (transparent blue)
    this.ctx.fillStyle = 'rgba(0, 191, 255, 0.6)';
    this.ctx.beginPath();
    this.ctx.ellipse(x, y + hover - 2, 8, 4, 0, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // UFO lights (blinking)
    const lightColors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00'];
    for (let i = 0; i < 4; i++) {
      const angle = (i * Math.PI * 2) / 4 + phase;
      const lightX = x + Math.cos(angle) * 10;
      const lightY = y + hover + Math.sin(angle) * 3;
      
      if (Math.floor(phase * 2 + i) % 2 === 0) {
        this.ctx.fillStyle = lightColors[i];
        this.ctx.beginPath();
        this.ctx.arc(lightX, lightY, 1.5, 0, 2 * Math.PI);
        this.ctx.fill();
      }
    }
    
    // Tractor beam (when active)
    if (Math.sin(phase) > 0.5) {
      this.ctx.fillStyle = 'rgba(0, 255, 0, 0.3)';
      this.ctx.beginPath();
      this.ctx.moveTo(x - 8, y + hover + 6);
      this.ctx.lineTo(x + 8, y + hover + 6);
      this.ctx.lineTo(x + 15, y + hover + 25);
      this.ctx.lineTo(x - 15, y + hover + 25);
      this.ctx.closePath();
      this.ctx.fill();
      
      // Beam particles
      for (let i = 0; i < 5; i++) {
        const particleX = x + (Math.random() - 0.5) * 20;
        const particleY = y + hover + 10 + Math.random() * 15;
        this.ctx.fillStyle = 'rgba(0, 255, 0, 0.8)';
        this.ctx.fillRect(particleX, particleY, 1, 1);
      }
    }
  }

  drawVortex(phenomenon) {
    const x = phenomenon.x;
    const y = phenomenon.y;
    const phase = phenomenon.animationPhase;
    const radius = phenomenon.radius;
    
    // Vortex spiral (multiple rings)
    for (let ring = 0; ring < 5; ring++) {
      const ringRadius = (radius / 5) * (ring + 1);
      const ringPhase = phase + ring * 0.5;
      
      this.ctx.strokeStyle = `rgba(0, 100, 200, ${0.8 - ring * 0.15})`;
      this.ctx.lineWidth = 3 - ring * 0.4;
      this.ctx.beginPath();
      
      for (let angle = 0; angle < Math.PI * 2; angle += 0.2) {
        const spiralRadius = ringRadius * (1 + Math.sin(angle * 3 + ringPhase) * 0.3);
        const pointX = x + Math.cos(angle + ringPhase) * spiralRadius;
        const pointY = y + Math.sin(angle + ringPhase) * spiralRadius;
        
        if (angle === 0) {
          this.ctx.moveTo(pointX, pointY);
        } else {
          this.ctx.lineTo(pointX, pointY);
        }
      }
      this.ctx.closePath();
      this.ctx.stroke();
    }
    
    // Vortex center (dark)
    this.ctx.fillStyle = '#001122';
    this.ctx.beginPath();
    this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Swirling debris
    for (let i = 0; i < 8; i++) {
      const debrisAngle = phase * 2 + (i * Math.PI * 2) / 8;
      const debrisRadius = 8 + Math.sin(phase + i) * 5;
      const debrisX = x + Math.cos(debrisAngle) * debrisRadius;
      const debrisY = y + Math.sin(debrisAngle) * debrisRadius;
      
      this.ctx.fillStyle = '#8B4513';
      this.ctx.fillRect(debrisX - 1, debrisY - 1, 2, 2);
    }
  }

  drawPortal(phenomenon) {
    const x = phenomenon.x;
    const y = phenomenon.y;
    const phase = phenomenon.animationPhase;
    const radius = phenomenon.radius;
    
    // Portal rings (expanding and contracting)
    for (let ring = 0; ring < 4; ring++) {
      const ringRadius = (radius / 4) * (ring + 1) + Math.sin(phase + ring) * 3;
      const opacity = 0.8 - ring * 0.15;
      
      this.ctx.strokeStyle = `rgba(148, 0, 211, ${opacity})`;
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(x, y, ringRadius, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
    
    // Portal center (swirling energy)
    const centerRadius = 8 + Math.sin(phase * 2) * 2;
    this.ctx.fillStyle = 'rgba(148, 0, 211, 0.6)';
    this.ctx.beginPath();
    this.ctx.arc(x, y, centerRadius, 0, 2 * Math.PI);
    this.ctx.fill();
    
    // Energy particles
    for (let i = 0; i < 12; i++) {
      const particleAngle = phase * 3 + (i * Math.PI * 2) / 12;
      const particleRadius = 5 + Math.sin(phase * 2 + i) * 8;
      const particleX = x + Math.cos(particleAngle) * particleRadius;
      const particleY = y + Math.sin(particleAngle) * particleRadius;
      
      this.ctx.fillStyle = `rgba(255, 255, 255, ${0.8 + Math.sin(phase + i) * 0.2})`;
      this.ctx.beginPath();
      this.ctx.arc(particleX, particleY, 1, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    // Portal distortion effect
    this.ctx.strokeStyle = 'rgba(148, 0, 211, 0.3)';
    this.ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const waveRadius = radius * 0.7 + Math.sin(phase * 4 + i) * 5;
      this.ctx.beginPath();
      this.ctx.arc(x, y, waveRadius, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
  }

  drawSiren(phenomenon) {
    const x = phenomenon.x;
    const y = phenomenon.y;
    const phase = phenomenon.animationPhase;
    
    // Siren body (mermaid-like)
    this.ctx.fillStyle = '#FFB6C1';
    this.ctx.fillRect(x - 2, y - 4, 4, 6);
    
    // Siren tail (fish-like, animated)
    const tailSway = Math.sin(phase * 3) * 2;
    this.ctx.fillStyle = '#20B2AA';
    this.ctx.fillRect(x - 3 + tailSway, y + 2, 6, 4);
    this.ctx.fillRect(x - 4 + tailSway, y + 6, 8, 2);
    
    // Siren hair (flowing)
    this.ctx.fillStyle = '#FFD700';
    for (let i = 0; i < 3; i++) {
      const hairSway = Math.sin(phase * 2 + i) * 3;
      this.ctx.fillRect(x - 3 + i + hairSway, y - 6, 2, 4);
    }
    
    // Siren eyes
    this.ctx.fillStyle = '#FF69B4';
    this.ctx.fillRect(x - 1, y - 3, 1, 1);
    this.ctx.fillRect(x + 1, y - 3, 1, 1);
    
    // Song waves (visible sound)
    for (let wave = 0; wave < 4; wave++) {
      const waveRadius = 10 + wave * 8 + Math.sin(phase * 2 + wave) * 3;
      this.ctx.strokeStyle = `rgba(255, 105, 180, ${0.6 - wave * 0.15})`;
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.arc(x, y, waveRadius, 0, 2 * Math.PI);
      this.ctx.stroke();
    }
    
    // Musical notes
    for (let i = 0; i < 3; i++) {
      const noteAngle = phase + (i * Math.PI * 2) / 3;
      const noteRadius = 15 + Math.sin(phase + i) * 5;
      const noteX = x + Math.cos(noteAngle) * noteRadius;
      const noteY = y + Math.sin(noteAngle) * noteRadius;
      
      this.ctx.fillStyle = 'rgba(255, 105, 180, 0.8)';
      this.ctx.fillRect(noteX - 1, noteY - 2, 2, 3);
      this.ctx.fillRect(noteX + 1, noteY - 4, 1, 2);
    }
  }

  drawDolphin(phenomenon) {
    const x = phenomenon.x;
    const y = phenomenon.y;
    const phase = phenomenon.animationPhase;
    
    // Multiple dolphins in a pod
    const dolphins = 3;
    for (let d = 0; d < dolphins; d++) {
      const dolphinAngle = (d * Math.PI * 2) / dolphins + phase * 0.5;
      const dolphinRadius = 8 + Math.sin(phase + d) * 4;
      const dolphinX = x + Math.cos(dolphinAngle) * dolphinRadius;
      const dolphinY = y + Math.sin(dolphinAngle) * dolphinRadius;
      const jump = Math.abs(Math.sin(phase * 2 + d)) * 6;
      
      // Dolphin body
      this.ctx.fillStyle = '#4682B4';
      this.ctx.fillRect(dolphinX - 4, dolphinY - jump - 1, 8, 3);
      
      // Dolphin head (pointed)
      this.ctx.fillStyle = '#5F9EA0';
      this.ctx.fillRect(dolphinX - 6, dolphinY - jump, 2, 1);
      
      // Dolphin dorsal fin
      this.ctx.fillStyle = '#4682B4';
      this.ctx.fillRect(dolphinX - 1, dolphinY - jump - 3, 2, 2);
      
      // Dolphin tail
      this.ctx.fillRect(dolphinX + 4, dolphinY - jump - 2, 3, 4);
      
      // Dolphin eye
      this.ctx.fillStyle = '#000000';
      this.ctx.fillRect(dolphinX - 3, dolphinY - jump, 1, 1);
      
      // Water splash when jumping
      if (jump > 3) {
        for (let s = 0; s < 4; s++) {
          const splashX = dolphinX + (Math.random() - 0.5) * 6;
          const splashY = dolphinY + 2 + Math.random() * 3;
          this.ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
          this.ctx.fillRect(splashX, splashY, 1, 1);
        }
      }
    }
    
    // Friendly aura
    this.ctx.strokeStyle = 'rgba(70, 130, 180, 0.3)';
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(x, y, phenomenon.radius * 0.8, 0, 2 * Math.PI);
    this.ctx.stroke();
  }

  drawStorm(phenomenon) {
    const x = phenomenon.x;
    const y = phenomenon.y;
    const phase = phenomenon.animationPhase;
    const radius = phenomenon.radius;
    
    // Storm clouds (dark and moving)
    for (let cloud = 0; cloud < 6; cloud++) {
      const cloudAngle = (cloud * Math.PI * 2) / 6 + phase * 0.3;
      const cloudRadius = radius * 0.6 + Math.sin(phase + cloud) * 8;
      const cloudX = x + Math.cos(cloudAngle) * cloudRadius;
      const cloudY = y + Math.sin(cloudAngle) * cloudRadius;
      
      this.ctx.fillStyle = `rgba(64, 64, 64, ${0.7 + Math.sin(phase + cloud) * 0.2})`;
      this.ctx.beginPath();
      this.ctx.arc(cloudX, cloudY, 8 + Math.sin(phase * 2 + cloud) * 3, 0, 2 * Math.PI);
      this.ctx.fill();
    }
    
    // Lightning bolts (random)
    if (phenomenon.lightningTimer < 200 || Math.sin(phase * 10) > 0.9) {
      const numBolts = 2 + Math.floor(Math.random() * 3);
      for (let bolt = 0; bolt < numBolts; bolt++) {
        const boltAngle = Math.random() * Math.PI * 2;
        const boltLength = 15 + Math.random() * 20;
        
        this.ctx.strokeStyle = '#FFFF00';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        
        // Zigzag lightning
        let currentX = x;
        let currentY = y;
        const segments = 4;
        
        for (let seg = 0; seg < segments; seg++) {
          const segmentLength = boltLength / segments;
          const zigzag = (Math.random() - 0.5) * 10;
          currentX += Math.cos(boltAngle) * segmentLength + zigzag;
          currentY += Math.sin(boltAngle) * segmentLength;
          this.ctx.lineTo(currentX, currentY);
        }
        this.ctx.stroke();
      }
    }
    
    // Rain drops
    for (let drop = 0; drop < 20; drop++) {
      const dropX = x + (Math.random() - 0.5) * radius * 2;
      const dropY = y + (Math.random() - 0.5) * radius * 2;
      const dropSpeed = 2 + Math.random() * 3;
      
      this.ctx.strokeStyle = 'rgba(173, 216, 230, 0.6)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(dropX, dropY);
      this.ctx.lineTo(dropX, dropY + dropSpeed);
      this.ctx.stroke();
    }
    
    // Storm wind indicators
    for (let wind = 0; wind < 8; wind++) {
      const windAngle = (wind * Math.PI * 2) / 8 + phase;
      const windRadius = radius * 0.9;
      const windX = x + Math.cos(windAngle) * windRadius;
      const windY = y + Math.sin(windAngle) * windRadius;
      
      this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      this.ctx.lineWidth = 1;
      this.ctx.beginPath();
      this.ctx.moveTo(windX, windY);
      this.ctx.lineTo(windX + Math.cos(windAngle) * 5, windY + Math.sin(windAngle) * 5);
      this.ctx.stroke();
    }
  }
}