// Enhanced Grinder RPG - Effects Manager Module
// This module handles all visual effects, particles, screen effects, and animations
// Future bots: This creates heavy hit effects, floating damage, screen shake, etc.

export class EffectsManager {
    constructor(game) {
        this.game = game;
        // Screen flash will be available after UI is created
        this.screenFlashElement = null;
        console.log('✅ EffectsManager initialized successfully');
    }

    getScreenFlash() {
        if (!this.screenFlashElement) {
            this.screenFlashElement = document.getElementById('screen-flash');
        }
        return this.screenFlashElement;
    }

    createHeavyHitEffect(x, y, damage) {
        // Screen shake intensity based on damage
        const shakeIntensity = Math.min(12, 6 + damage / 10);
        this.game.engine.camera.addShake(shakeIntensity, 0.3);
        
        // Screen flash
        this.screenFlash();
        
        // Floating damage number
        this.showFloatingDamage(x, y, damage);
        
        // Hit freeze effect (brief pause)
        this.hitFreeze(150);
    }

    createHitParticles(x, y, damage) {
        // Create all hit-related particles
        this.game.engine.particleSystem.createDamageParticles(x, y, damage);
        this.game.engine.particleSystem.createBloodParticles(x, y);
        this.game.engine.particleSystem.createImpactParticles(x, y);
    }

    flashEntity(entity, color = '#ffffff') {
        const renderable = entity.getComponent('Renderable');
        if (!renderable) return;
        
        const originalData = [...renderable.pixelData];
        
        // Flash to white first
        renderable.pixelData = renderable.pixelData.map(pixel => 
            pixel && pixel !== 'transparent' && pixel !== '' ? 'white' : pixel
        );
        
        // Then flash to damage color
        setTimeout(() => {
            renderable.pixelData = renderable.pixelData.map(pixel => 
                pixel && pixel !== 'transparent' && pixel !== '' ? 'red' : pixel
            );
            
            // Return to original
            setTimeout(() => {
                renderable.pixelData = originalData;
            }, 100);
        }, 50);
    }

    screenFlash() {
        const flashElement = this.getScreenFlash();
        if (!flashElement) return;
        
        flashElement.style.display = 'block';
        flashElement.style.opacity = '0.6';
        
        setTimeout(() => {
            flashElement.style.opacity = '0';
            setTimeout(() => {
                flashElement.style.display = 'none';
            }, 100);
        }, 50);
    }

    showFloatingDamage(x, y, damage) {
        const screenPos = this.game.engine.camera.worldToScreen(x, y);
        const damageElement = document.createElement('div');
        damageElement.className = 'floating-damage';
        damageElement.textContent = `-${damage}`;
        damageElement.style.left = screenPos.x + 'px';
        damageElement.style.top = screenPos.y + 'px';
        damageElement.style.fontSize = Math.min(20, 12 + damage / 5) + 'px';
        damageElement.style.fontWeight = 'bold';
        damageElement.style.textShadow = '2px 2px 4px rgba(0,0,0,0.8)';
        
        // Critical hit effects for high damage
        if (damage > 30) {
            damageElement.style.color = '#ff0000';
            damageElement.style.fontSize = '24px';
            damageElement.textContent = `CRIT! -${damage}`;
            damageElement.style.animation = 'criticalHit 1.2s ease-out forwards';
        }
        
        document.body.appendChild(damageElement);
        
        setTimeout(() => {
            if (document.body && document.body.contains(damageElement)) {
                document.body.removeChild(damageElement);
            }
        }, 1200);
    }

    showFloatingGold(x, y, amount) {
        const screenPos = this.game.engine.camera.worldToScreen(x, y);
        const goldElement = document.createElement('div');
        goldElement.className = 'floating-gold';
        goldElement.textContent = `+${amount}g`;
        goldElement.style.left = screenPos.x + 'px';
        goldElement.style.top = screenPos.y + 'px';
        goldElement.style.fontSize = '12px';
        goldElement.style.fontWeight = 'bold';
        goldElement.style.color = '#ffd700';
        goldElement.style.textShadow = '1px 1px 2px rgba(0,0,0,0.8)';
        goldElement.style.position = 'absolute';
        goldElement.style.pointerEvents = 'none';
        goldElement.style.zIndex = '250';
        goldElement.style.animation = 'floatUpGold 1.5s ease-out forwards';
        
        document.body.appendChild(goldElement);
        
        setTimeout(() => {
            if (document.body && document.body.contains(goldElement)) {
                document.body.removeChild(goldElement);
            }
        }, 1500);
    }

    hitFreeze(duration) {
        // Brief pause effect for impact
        const originalTimeScale = 1;
        // Note: This would need to be implemented in the game engine
        // For now, we'll just add a visual effect
        
        document.body.style.filter = 'contrast(1.5) brightness(1.2)';
        setTimeout(() => {
            document.body.style.filter = 'none';
        }, duration);
    }

    createExplosion(x, y, size = 'normal') {
        // Create explosion particles
        const particleCount = size === 'large' ? 20 : 12;
        const colors = ['#ff4444', '#ff8844', '#ffff44', '#ffffff'];
        
        for (let i = 0; i < particleCount; i++) {
            const angle = (Math.PI * 2 * i) / particleCount;
            const velocity = size === 'large' ? 150 : 100;
            
            this.game.engine.particleSystem.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * (velocity + Math.random() * 50),
                vy: Math.sin(angle) * (velocity + Math.random() * 50),
                gravity: 0,
                size: size === 'large' ? 4 + Math.random() * 3 : 2 + Math.random() * 2,
                color: colors[Math.floor(Math.random() * colors.length)],
                life: 0.8,
                maxLife: 0.8,
                alpha: 1
            });
        }
    }

    createLevelUpEffect(entity) {
        const transform = entity.getComponent('Transform');
        
        // Golden particles rising up
        for (let i = 0; i < 15; i++) {
            this.game.engine.particleSystem.particles.push({
                x: transform.x + (Math.random() - 0.5) * 40,
                y: transform.y + (Math.random() - 0.5) * 40,
                vx: (Math.random() - 0.5) * 30,
                vy: -80 - Math.random() * 40,
                gravity: -50, // Negative gravity for floating up
                size: 3 + Math.random() * 2,
                color: '#ffff00',
                life: 2,
                maxLife: 2,
                alpha: 1
            });
        }
        
        // Screen flash with golden color
        const flashElement = this.getScreenFlash();
        if (flashElement) {
            flashElement.style.background = 'rgba(255, 255, 0, 0.3)';
            this.screenFlash();
            
            // Reset flash color
            setTimeout(() => {
                flashElement.style.background = 'rgba(255, 255, 255, 0.8)';
            }, 200);
        }
    }

    createDeathEffect(entity) {
        const transform = entity.getComponent('Transform');
        
        // Create death explosion
        this.createExplosion(transform.x, transform.y, 'large');
        
        // Screen shake
        this.game.engine.camera.addShake(5, 0.5);
    }

    createHealEffect(entity) {
        const transform = entity.getComponent('Transform');
        
        // Green healing particles
        for (let i = 0; i < 8; i++) {
            this.game.engine.particleSystem.particles.push({
                x: transform.x + (Math.random() - 0.5) * 30,
                y: transform.y + (Math.random() - 0.5) * 30,
                vx: (Math.random() - 0.5) * 20,
                vy: -30 - Math.random() * 20,
                gravity: -20,
                size: 2 + Math.random(),
                color: '#00ff00',
                life: 1.5,
                maxLife: 1.5,
                alpha: 1
            });
        }
    }

    createManaEffect(entity) {
        const transform = entity.getComponent('Transform');
        
        // Blue mana particles
        for (let i = 0; i < 6; i++) {
            this.game.engine.particleSystem.particles.push({
                x: transform.x + (Math.random() - 0.5) * 25,
                y: transform.y + (Math.random() - 0.5) * 25,
                vx: (Math.random() - 0.5) * 15,
                vy: -25 - Math.random() * 15,
                gravity: -15,
                size: 2 + Math.random(),
                color: '#4444ff',
                life: 1.2,
                maxLife: 1.2,
                alpha: 1
            });
        }
    }
}