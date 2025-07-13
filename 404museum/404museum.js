/**
 * 404Museum - Transform Error Pages into Interactive Art Galleries
 * Version: 1.0.0
 * Author: JodyLabs
 * License: MIT
 * 
 * A lightweight JavaScript library that automatically detects 404 error pages
 * and replaces them with beautiful generative art displays.
 */

(function() {
    'use strict';
    
    // Default configuration
    const defaultConfig = {
        theme: 'dark',
        artTypes: ['generative', 'fractals', 'particles', 'abstract'],
        showBranding: true,
        customMessage: 'Page not found, but look at this beautiful art instead!',
        colors: {
            primary: '#4ecdc4',
            secondary: '#ff6b6b',
            background: '#0a0a0a',
            text: '#ffffff'
        },
        apiEndpoint: null,
        autoDetect: true,
        showNavigation: true,
        artDuration: 30000, // Switch art every 30 seconds
        particleCount: 100,
        animationSpeed: 1
    };
    
    // Merge user config with default config
    const config = Object.assign({}, defaultConfig, window.Museum404Config || {});
    
    // Museum404 Main Class
    class Museum404 {
        constructor() {
            this.isActive = false;
            this.currentArtType = null;
            this.animationId = null;
            this.artSwitchInterval = null;
            this.canvas = null;
            this.ctx = null;
            this.particles = [];
            
            this.init();
        }
        
        /**
         * Initialize the 404Museum
         */
        init() {
            // Check if we should auto-detect 404 pages
            if (config.autoDetect && this.is404Page()) {
                this.activate();
            }
            
            // Add global methods
            window.Museum404 = {
                activate: () => this.activate(),
                deactivate: () => this.deactivate(),
                switchArt: (type) => this.switchArt(type),
                isActive: () => this.isActive
            };
        }
        
        /**
         * Detect if current page is a 404 error page
         */
        is404Page() {
            // Check various indicators of 404 pages
            const indicators = [
                document.title.toLowerCase().includes('404'),
                document.title.toLowerCase().includes('not found'),
                document.title.toLowerCase().includes('page not found'),
                document.body.innerText.toLowerCase().includes('404'),
                document.body.innerText.toLowerCase().includes('page not found'),
                window.location.pathname.includes('404')
            ];
            
            return indicators.some(indicator => indicator);
        }
        
        /**
         * Activate the art gallery
         */
        activate() {
            if (this.isActive) return;
            
            this.isActive = true;
            this.logVisit();
            this.createArtGallery();
            this.startArtRotation();
        }
        
        /**
         * Deactivate the art gallery
         */
        deactivate() {
            if (!this.isActive) return;
            
            this.isActive = false;
            this.stopAnimations();
            this.removeArtGallery();
        }
        
        /**
         * Create the art gallery interface
         */
        createArtGallery() {
            // Store original page content
            this.originalBody = document.body.innerHTML;
            
            // Create gallery container
            const galleryHTML = `
                <div id="museum404-gallery" style="
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100vw;
                    height: 100vh;
                    background: ${config.colors.background};
                    color: ${config.colors.text};
                    z-index: 999999;
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    overflow: hidden;
                ">
                    <div id="museum404-header" style="
                        position: absolute;
                        top: 20px;
                        left: 50%;
                        transform: translateX(-50%);
                        text-align: center;
                        z-index: 1000000;
                    ">
                        <h1 style="
                            margin: 0 0 10px;
                            font-size: 2.5rem;
                            font-weight: 900;
                            background: linear-gradient(45deg, ${config.colors.primary}, ${config.colors.secondary});
                            -webkit-background-clip: text;
                            -webkit-text-fill-color: transparent;
                            background-clip: text;
                        ">404MUSEUM</h1>
                        <p style="
                            margin: 0;
                            font-size: 1rem;
                            opacity: 0.8;
                        ">${config.customMessage}</p>
                    </div>
                    
                    ${config.showNavigation ? this.createNavigationHTML() : ''}
                    
                    <canvas id="museum404-canvas" style="
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 100%;
                        height: 100%;
                        z-index: 999999;
                    "></canvas>
                    
                    ${config.showBranding ? this.createBrandingHTML() : ''}
                    
                    <div id="museum404-exit" style="
                        position: absolute;
                        top: 20px;
                        right: 20px;
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        padding: 10px 15px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 0.9rem;
                        backdrop-filter: blur(10px);
                        transition: all 0.3s ease;
                        z-index: 1000000;
                    " onclick="window.Museum404.deactivate()">
                        ✖ Exit Gallery
                    </div>
                </div>
            `;
            
            document.body.innerHTML = galleryHTML;
            
            // Setup canvas
            this.canvas = document.getElementById('museum404-canvas');
            this.ctx = this.canvas.getContext('2d');
            this.resizeCanvas();
            
            // Add resize listener
            window.addEventListener('resize', () => this.resizeCanvas());
            
            // Start with random art type
            this.switchArt(this.getRandomArtType());
        }
        
        /**
         * Create navigation HTML
         */
        createNavigationHTML() {
            return `
                <div id="museum404-nav" style="
                    position: absolute;
                    bottom: 30px;
                    left: 50%;
                    transform: translateX(-50%);
                    display: flex;
                    gap: 15px;
                    z-index: 1000000;
                ">
                    <button onclick="window.Museum404.switchArt('generative')" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        backdrop-filter: blur(10px);
                        transition: all 0.3s ease;
                    ">Waves</button>
                    <button onclick="window.Museum404.switchArt('particles')" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        backdrop-filter: blur(10px);
                        transition: all 0.3s ease;
                    ">Particles</button>
                    <button onclick="window.Museum404.switchArt('fractals')" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        backdrop-filter: blur(10px);
                        transition: all 0.3s ease;
                    ">Fractals</button>
                    <button onclick="window.Museum404.switchArt('abstract')" style="
                        background: rgba(255, 255, 255, 0.1);
                        border: 1px solid rgba(255, 255, 255, 0.2);
                        color: white;
                        padding: 8px 15px;
                        border-radius: 20px;
                        cursor: pointer;
                        font-size: 0.8rem;
                        backdrop-filter: blur(10px);
                        transition: all 0.3s ease;
                    ">Abstract</button>
                </div>
            `;
        }
        
        /**
         * Create branding HTML
         */
        createBrandingHTML() {
            return `
                <div style="
                    position: absolute;
                    bottom: 20px;
                    right: 20px;
                    font-size: 0.7rem;
                    opacity: 0.6;
                    z-index: 1000000;
                ">
                    Powered by <a href="https://jodylabs.surge.sh/404museum/" target="_blank" style="color: ${config.colors.primary}; text-decoration: none;">404Museum</a>
                </div>
            `;
        }
        
        /**
         * Remove the art gallery
         */
        removeArtGallery() {
            if (this.originalBody) {
                document.body.innerHTML = this.originalBody;
            }
        }
        
        /**
         * Resize canvas to window size
         */
        resizeCanvas() {
            if (!this.canvas) return;
            
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        }
        
        /**
         * Get random art type
         */
        getRandomArtType() {
            return config.artTypes[Math.floor(Math.random() * config.artTypes.length)];
        }
        
        /**
         * Switch art type
         */
        switchArt(type) {
            if (!config.artTypes.includes(type)) {
                type = this.getRandomArtType();
            }

            this.currentArtType = type;
            this.stopAnimations();

            switch (type) {
                case 'generative':
                    this.startGenerativeArt();
                    break;
                case 'particles':
                    this.startParticleSystem();
                    break;
                case 'fractals':
                    this.startFractalArt();
                    break;
                case 'abstract':
                    this.startAbstractArt();
                    break;
                case 'geometricMandala':
                    this.startGeometricMandala();
                    break;
                case 'waveInterference':
                    this.startWaveInterference();
                    break;
                case 'neonGrid':
                    this.startNeonGrid();
                    break;
                case 'plasmaField':
                    this.startPlasmaField();
                    break;
                case 'spiralGalaxy':
                    this.startSpiralGalaxy();
                    break;
                case 'matrixGlitch':
                    this.startMatrixGlitch();
                    break;
                case 'cyberpunkCity':
                    this.startCyberpunkCity();
                    break;
                case 'digitalRain':
                    this.startDigitalRain();
                    break;
                case 'holographicMesh':
                    this.startHolographicMesh();
                    break;
                case 'quantumField':
                    this.startQuantumField();
                    break;
                case 'voronoiShatter':
                    this.startVoronoiShatter();
                    break;
                default:
                    this.startGenerativeArt();
            }
        }
        // Add new art pattern methods below
        startGeometricMandala() {
            // Placeholder: You can copy the full implementation from your demo HTML
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startWaveInterference() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startNeonGrid() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startPlasmaField() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startSpiralGalaxy() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startMatrixGlitch() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startCyberpunkCity() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startDigitalRain() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startHolographicMesh() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startQuantumField() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        startVoronoiShatter() {
            this.animationId = requestAnimationFrame(() => this.startGenerativeArt());
        }
        
        /**
         * Start art rotation
         */
        startArtRotation() {
            if (config.artDuration > 0) {
                this.artSwitchInterval = setInterval(() => {
                    this.switchArt(this.getRandomArtType());
                }, config.artDuration);
            }
        }
        
        /**
         * Stop all animations
         */
        stopAnimations() {
            if (this.animationId) {
                cancelAnimationFrame(this.animationId);
                this.animationId = null;
            }
            
            if (this.artSwitchInterval) {
                clearInterval(this.artSwitchInterval);
                this.artSwitchInterval = null;
            }
        }
        
        /**
         * Generative wave art
         */
        startGenerativeArt() {
            const animate = () => {
                if (!this.isActive || this.currentArtType !== 'generative') return;
                
                this.ctx.fillStyle = 'rgba(10, 10, 26, 0.05)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                const time = Date.now() * 0.001 * config.animationSpeed;
                
                for (let i = 0; i < 8; i++) {
                    this.ctx.beginPath();
                    this.ctx.strokeStyle = `hsl(${(time * 30 + i * 45) % 360}, 70%, 60%)`;
                    this.ctx.lineWidth = 2;
                    
                    for (let x = 0; x < this.canvas.width; x += 5) {
                        const y = this.canvas.height / 2 + 
                               Math.sin(x * 0.005 + time + i * 0.5) * 80 * 
                               Math.sin(time * 0.3 + i * 0.2);
                        
                        if (x === 0) {
                            this.ctx.moveTo(x, y);
                        } else {
                            this.ctx.lineTo(x, y);
                        }
                    }
                    this.ctx.stroke();
                }
                
                this.animationId = requestAnimationFrame(animate);
            };
            animate();
        }
        
        /**
         * Particle system art
         */
        startParticleSystem() {
            // Initialize particles
            this.particles = [];
            for (let i = 0; i < config.particleCount; i++) {
                this.particles.push({
                    x: Math.random() * this.canvas.width,
                    y: Math.random() * this.canvas.height,
                    vx: (Math.random() - 0.5) * 2 * config.animationSpeed,
                    vy: (Math.random() - 0.5) * 2 * config.animationSpeed,
                    size: Math.random() * 3 + 1,
                    hue: Math.random() * 360,
                    opacity: Math.random() * 0.5 + 0.5
                });
            }
            
            const animate = () => {
                if (!this.isActive || this.currentArtType !== 'particles') return;
                
                this.ctx.fillStyle = 'rgba(10, 10, 26, 0.05)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                this.particles.forEach(particle => {
                    // Update position
                    particle.x += particle.vx;
                    particle.y += particle.vy;
                    
                    // Bounce off edges
                    if (particle.x < 0 || particle.x > this.canvas.width) particle.vx *= -1;
                    if (particle.y < 0 || particle.y > this.canvas.height) particle.vy *= -1;
                    
                    // Draw particle
                    this.ctx.beginPath();
                    this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsla(${particle.hue}, 70%, 60%, ${particle.opacity})`;
                    this.ctx.fill();
                    
                    // Update color
                    particle.hue += 0.5;
                });
                
                this.animationId = requestAnimationFrame(animate);
            };
            animate();
        }
        
        /**
         * Fractal tree art
         */
        startFractalArt() {
            const drawBranch = (x, y, size, depth, angle) => {
                if (depth === 0 || size < 1) return;
                
                const endX = x + Math.cos(angle) * size;
                const endY = y + Math.sin(angle) * size;
                
                this.ctx.beginPath();
                this.ctx.moveTo(x, y);
                this.ctx.lineTo(endX, endY);
                this.ctx.strokeStyle = `hsl(${depth * 30 + Date.now() * 0.01}, 70%, 60%)`;
                this.ctx.lineWidth = depth * 0.5;
                this.ctx.stroke();
                
                drawBranch(endX, endY, size * 0.75, depth - 1, angle - 0.6);
                drawBranch(endX, endY, size * 0.75, depth - 1, angle + 0.6);
            };
            
            const animate = () => {
                if (!this.isActive || this.currentArtType !== 'fractals') return;
                
                this.ctx.fillStyle = 'rgba(10, 10, 26, 0.02)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                const time = Date.now() * 0.001 * config.animationSpeed;
                drawBranch(
                    this.canvas.width / 2, 
                    this.canvas.height - 50, 
                    80, 
                    10, 
                    -Math.PI / 2 + Math.sin(time) * 0.3
                );
                
                this.animationId = requestAnimationFrame(animate);
            };
            animate();
        }
        
        /**
         * Abstract geometric art
         */
        startAbstractArt() {
            const animate = () => {
                if (!this.isActive || this.currentArtType !== 'abstract') return;
                
                this.ctx.fillStyle = 'rgba(10, 10, 26, 0.05)';
                this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                
                const time = Date.now() * 0.002 * config.animationSpeed;
                
                for (let i = 0; i < 30; i++) {
                    const x = this.canvas.width / 2 + Math.cos(time + i * 0.3) * (50 + i * 8);
                    const y = this.canvas.height / 2 + Math.sin(time + i * 0.2) * (40 + i * 6);
                    const size = 10 + Math.sin(time * 3 + i) * 8;
                    
                    this.ctx.beginPath();
                    this.ctx.arc(x, y, size, 0, Math.PI * 2);
                    this.ctx.fillStyle = `hsl(${(time * 50 + i * 12) % 360}, 80%, 60%)`;
                    this.ctx.fill();
                }
                
                this.animationId = requestAnimationFrame(animate);
            };
            animate();
        }
        
        /**
         * Log visit to analytics endpoint
         */
        logVisit() {
            if (!config.apiEndpoint) return;
            
            const data = {
                timestamp: new Date().toISOString(),
                url: window.location.href,
                referrer: document.referrer || 'direct',
                userAgent: navigator.userAgent,
                viewport: {
                    width: window.innerWidth,
                    height: window.innerHeight
                }
            };
            
            // Send to analytics endpoint
            fetch(config.apiEndpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data)
            }).catch(error => {
                console.warn('404Museum: Analytics logging failed', error);
            });
        }
    }
    
    // Initialize Museum404 when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => new Museum404());
    } else {
        new Museum404();
    }
    
})();
