// chaos.js - TOTAL MAYHEM SYSTEM!
export const chaosEvents = [
  {
    name: 'BANANA RAIN',
    message: '🍌 BANANA RAIN! SLIPPERY FLOORS! 🍌',
    effect: () => {
      // Make player slide around AND change board to yellow!
      window.chaosSlippery = true;
      document.getElementById('game-area').style.background = 'linear-gradient(45deg, #ffff00, #ffaa00)';
      document.getElementById('game-area').style.animation = 'wiggle 0.5s infinite';
      
      // Continuous banana rain!
      const bananaInterval = setInterval(() => {
        if (window.chaosSlippery) {
          for (let i = 0; i < 3; i++) {
            setTimeout(() => spawnFallingBanana(), i * 100);
          }
        }
      }, 800);
      
      // Make movement more chaotic
      window.chaosSlipperyMultiplier = 2.5;
      
      setTimeout(() => { 
        window.chaosSlippery = false;
        window.chaosSlipperyMultiplier = 1;
        clearInterval(bananaInterval);
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.animation = '';
      }, 15000); // Longer duration!
    },
    rarity: 0.15
  },
  {
    name: 'DISCO MODE',
    message: '🕺 DISCO FEVER! DANCE BATTLE! 🕺',
    effect: () => {
      document.body.style.animation = 'rainbow 0.5s infinite';
      document.getElementById('game-area').style.animation = 'rainbow 0.3s infinite';
      window.chaosDiscoMode = true;
      // Spawn disco balls!
      for (let i = 0; i < 5; i++) {
        spawnDiscoBall();
      }
      setTimeout(() => { 
        document.body.style.animation = '';
        document.getElementById('game-area').style.animation = '';
        window.chaosDiscoMode = false;
      }, 10000);
    },
    rarity: 0.1
  },
  {
    name: 'GIANT CHICKEN',
    message: '🐔 GIANT CHICKEN INVASION! BAWK BAWK! 🐔',
    effect: () => {
      window.chaosGiantChicken = true;
      // Change board to farm theme with animated sky!
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #87CEEB 0%, #90EE90 50%, #8B4513 100%)';
      document.getElementById('game-area').style.backgroundSize = '200% 200%';
      document.getElementById('game-area').style.animation = 'gradient-shift 3s ease infinite';
      
      // Continuous chicken waves!
      const chickenWaves = setInterval(() => {
        if (window.chaosGiantChicken) {
          // Spawn chicken formations
          for (let i = 0; i < 8; i++) {
            setTimeout(() => spawnChickenRaider(), i * 150);
          }
          // Add some flying chickens too!
          for (let i = 0; i < 3; i++) {
            setTimeout(() => spawnFlyingChicken(), i * 400);
          }
        }
      }, 2000);
      
      // Make enemies chicken-themed
      window.chaosChickenTransform = true;
      
      // Add chicken sound effects (visual)
      const bawkInterval = setInterval(() => {
        if (window.chaosGiantChicken && Math.random() < 0.3) {
          showChickenBawk();
        }
      }, 1500);
      
      setTimeout(() => { 
        window.chaosGiantChicken = false;
        window.chaosChickenTransform = false;
        clearInterval(chickenWaves);
        clearInterval(bawkInterval);
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.animation = '';
      }, 20000); // Much longer chicken invasion!
    },
    rarity: 0.08
  },
  {
    name: 'REVERSE CONTROLS',
    message: '🔄 CONTROLS REVERSED! CONFUSION! 🔄',
    effect: () => {
      window.chaosReversed = true;
      // Flip the entire game area upside down!
      document.getElementById('game-area').style.transform = 'rotate(180deg)';
      document.getElementById('game-area').style.filter = 'hue-rotate(180deg)';
      setTimeout(() => { 
        window.chaosReversed = false;
        document.getElementById('game-area').style.transform = '';
        document.getElementById('game-area').style.filter = '';
      }, 6000);
    },
    rarity: 0.12
  },
  {
    name: 'TINY MODE',
    message: '🔬 EVERYONE IS TINY! MICROSCOPIC MAYHEM! 🔬',
    effect: () => {
      window.chaosTinyMode = true;
      setTimeout(() => { window.chaosTinyMode = false; }, 8000);
    },
    rarity: 0.1
  },
  {
    name: 'GRAVITY FLIP',
    message: '🌍 GRAVITY FLIPPED! UP IS DOWN! 🌍',
    effect: () => {
      window.chaosGravityFlip = true;
      setTimeout(() => { window.chaosGravityFlip = false; }, 7000);
    },
    rarity: 0.09
  },
  {
    name: 'RAINBOW BULLETS',
    message: '🌈 RAINBOW BULLET PARTY! FABULOUS! 🌈',
    effect: () => {
      window.chaosRainbowBullets = true;
      setTimeout(() => { window.chaosRainbowBullets = false; }, 15000);
    },
    rarity: 0.13
  },
  {
    name: 'SPEED DEMON',
    message: '⚡ EVERYONE IS SUPER FAST! ZOOM ZOOM! ⚡',
    effect: () => {
      window.chaosSpeedDemon = true;
      setTimeout(() => { window.chaosSpeedDemon = false; }, 5000);
    },
    rarity: 0.11
  },
  {
    name: 'INVISIBLE ENEMIES',
    message: '👻 ENEMIES ARE INVISIBLE! SPOOKY! 👻',
    effect: () => {
      window.chaosInvisibleEnemies = true;
      setTimeout(() => { window.chaosInvisibleEnemies = false; }, 6000);
    },
    rarity: 0.07
  },
  {
    name: 'BOUNCY CASTLE',
    message: '🏰 BOUNCY CASTLE MODE! BOING BOING! 🏰',
    effect: () => {
      window.chaosBouncyCastle = true;
      // Make the entire game area bouncy!
      document.getElementById('game-area').style.animation = 'bounce 0.5s infinite';
      document.getElementById('game-area').style.background = 'linear-gradient(45deg, #ff69b4, #ffc0cb, #ff1493)';
      setTimeout(() => { 
        window.chaosBouncyCastle = false;
        document.getElementById('game-area').style.animation = '';
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
      }, 10000);
    },
    rarity: 0.08
  },
  {
    name: 'NEON RAVE',
    message: '🌈 NEON RAVE MODE! PARTY TIME! 🌈',
    effect: () => {
      window.chaosNeonRave = true;
      document.getElementById('game-area').style.background = 'linear-gradient(45deg, #ff00ff, #00ffff, #ffff00, #ff00ff)';
      document.getElementById('game-area').style.backgroundSize = '400% 400%';
      document.getElementById('game-area').style.animation = 'gradient-shift 2s ease infinite';
      // Change UI colors too!
      document.querySelectorAll('#game-ui > div > div').forEach(el => {
        el.style.background = 'linear-gradient(45deg, #ff00ff, #00ffff)';
        el.style.animation = 'rainbow 1s infinite';
      });
      setTimeout(() => { 
        window.chaosNeonRave = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.animation = '';
        document.querySelectorAll('#game-ui > div > div').forEach(el => {
          el.style.background = '';
          el.style.animation = '';
        });
      }, 12000);
    },
    rarity: 0.06
  },
  {
    name: 'MATRIX MODE',
    message: '💊 ENTERING THE MATRIX! DIGITAL RAIN! 💊',
    effect: () => {
      window.chaosMatrixMode = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #000000 0%, #001100 50%, #000000 100%)';
      document.getElementById('game-area').style.color = '#00ff00';
      // Spawn digital rain
      for (let i = 0; i < 30; i++) {
        setTimeout(() => spawnMatrixRain(), i * 100);
      }
      setTimeout(() => { 
        window.chaosMatrixMode = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
      }, 10000);
    },
    rarity: 0.05
  },
  {
    name: 'ZOMBIE MODE',
    message: '🧟 ZOMBIE APOCALYPSE! BRAAAAAINS! 🧟',
    effect: () => {
      window.chaosZombieMode = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a1a1a 0%, #1a0a0a 50%, #0a0000 100%)';
      document.getElementById('game-area').style.filter = 'sepia(0.8) hue-rotate(90deg)';
      setTimeout(() => { 
        window.chaosZombieMode = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 8000);
    },
    rarity: 0.07
  },
  {
    name: 'SPACE MODE',
    message: '🚀 SPACE BATTLE! TO INFINITY! 🚀',
    effect: () => {
      window.chaosSpaceMode = true;
      document.getElementById('game-area').style.background = 'radial-gradient(circle, #000033 0%, #000000 100%)';
      // Spawn stars
      for (let i = 0; i < 50; i++) {
        spawnStar();
      }
      setTimeout(() => { 
        window.chaosSpaceMode = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
      }, 12000);
    },
    rarity: 0.04
  },
  {
    name: 'UNDERWATER',
    message: '🌊 UNDERWATER COMBAT! GLUB GLUB! 🌊',
    effect: () => {
      window.chaosUnderwaterMode = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #001133 0%, #002244 50%, #001122 100%)';
      document.getElementById('game-area').style.filter = 'blur(1px)';
      // Spawn bubbles
      for (let i = 0; i < 20; i++) {
        setTimeout(() => spawnBubble(), i * 200);
      }
      setTimeout(() => { 
        window.chaosUnderwaterMode = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 9000);
    },
    rarity: 0.06
  },
  {
    name: 'RETRO ARCADE',
    message: '🕹️ RETRO ARCADE MODE! PIXEL POWER! 🕹️',
    effect: () => {
      window.chaosRetroMode = true;
      document.getElementById('game-area').style.background = 'linear-gradient(45deg, #ff00ff 0%, #00ffff 25%, #ffff00 50%, #ff00ff 75%, #00ffff 100%)';
      document.getElementById('game-area').style.filter = 'contrast(1.5) saturate(2)';
      document.getElementById('game-area').style.imageRendering = 'pixelated';
      setTimeout(() => { 
        window.chaosRetroMode = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 8000);
    },
    rarity: 0.05
  },
  {
    name: 'EARTHQUAKE',
    message: '🌍 EARTHQUAKE! EVERYTHING SHAKES! 🌍',
    effect: () => {
      window.chaosEarthquake = true;
      document.getElementById('game-area').style.animation = 'ui-chaos 0.2s infinite';
      // Always screenshake for earthquake!
      document.body.style.animation = 'ui-chaos 0.15s infinite';
      setTimeout(() => { 
        window.chaosEarthquake = false;
        document.getElementById('game-area').style.animation = '';
        document.body.style.animation = '';
      }, 5000);
    },
    rarity: 0.08
  },
  {
    name: 'CANDY LAND',
    message: '🍭 CANDY LAND! SWEET VICTORY! 🍭',
    effect: () => {
      window.chaosCandyLand = true;
      document.getElementById('game-area').style.background = 'linear-gradient(45deg, #ffb3d9 0%, #ffccff 25%, #ffffcc 50%, #ccffcc 75%, #ccccff 100%)';
      // Spawn candy
      for (let i = 0; i < 15; i++) {
        setTimeout(() => spawnCandy(), i * 300);
      }
      setTimeout(() => { 
        window.chaosCandyLand = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
      }, 10000);
    },
    rarity: 0.06
  },
  {
    name: 'MIRROR WORLD',
    message: '🪞 MIRROR WORLD! EVERYTHING FLIPPED! 🪞',
    effect: () => {
      window.chaosMirrorWorld = true;
      document.getElementById('game-area').style.transform = 'scaleX(-1)';
      document.getElementById('game-area').style.filter = 'invert(0.2)';
      setTimeout(() => { 
        window.chaosMirrorWorld = false;
        document.getElementById('game-area').style.transform = '';
        document.getElementById('game-area').style.filter = '';
      }, 7000);
    },
    rarity: 0.07
  },
  {
    name: 'QUANTUM FLUX',
    message: '⚛️ QUANTUM REALITY SHIFT! DIMENSIONS COLLIDING! ⚛️',
    effect: () => {
      window.chaosQuantumFlux = true;
      document.getElementById('game-area').style.filter = 'hue-rotate(0deg)';
      document.getElementById('game-area').style.animation = 'quantum-shift 0.5s infinite';
      setTimeout(() => { 
        window.chaosQuantumFlux = false;
        document.getElementById('game-area').style.filter = '';
        document.getElementById('game-area').style.animation = '';
      }, 8000);
    },
    rarity: 0.03
  },
  {
    name: 'TIME DILATION',
    message: '⏰ TIME ANOMALY DETECTED! TEMPORAL DISTORTION! ⏰',
    effect: () => {
      window.chaosTimeDilation = true;
      document.getElementById('game-area').style.animation = 'time-warp 1s infinite';
      setTimeout(() => { 
        window.chaosTimeDilation = false;
        document.getElementById('game-area').style.animation = '';
      }, 6000);
    },
    rarity: 0.04
  },
  {
    name: 'SHADOW REALM',
    message: '👤 SHADOW DIMENSION BREACH! DARKNESS RISES! 👤',
    effect: () => {
      window.chaosShadowRealm = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #000000 0%, #1a0a1a 50%, #000000 100%)';
      document.getElementById('game-area').style.filter = 'contrast(2) brightness(0.3)';
      for (let i = 0; i < 10; i++) {
        setTimeout(() => spawnShadowCreature(), i * 400);
      }
      setTimeout(() => { 
        window.chaosShadowRealm = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 12000);
    },
    rarity: 0.02
  },
  {
    name: 'REALITY BREACH',
    message: '🌀 REALITY FABRIC TORN! MULTIVERSE COLLISION! 🌀',
    effect: () => {
      window.chaosRealityBreach = true;
      document.getElementById('game-area').style.background = 'conic-gradient(#ff0000, #00ff00, #0000ff, #ffff00, #ff00ff, #00ffff, #ff0000)';
      document.getElementById('game-area').style.backgroundSize = '200% 200%';
      document.getElementById('game-area').style.animation = 'reality-tear 2s infinite';
      setTimeout(() => { 
        window.chaosRealityBreach = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.animation = '';
      }, 10000);
    },
    rarity: 0.015
  },
  {
    name: 'PIZZA PARTY',
    message: '🍕 PIZZA PARTY MODE! CHEESY CHAOS! 🍕',
    effect: () => {
      window.chaosPizzaParty = true;
      document.getElementById('game-area').style.background = 'linear-gradient(45deg, #ff6b35 0%, #f7931e 25%, #ffd700 50%, #ff6b35 75%, #f7931e 100%)';
      
      // Rain pizzas from the sky!
      const pizzaInterval = setInterval(() => {
        if (window.chaosPizzaParty) {
          for (let i = 0; i < 4; i++) {
            setTimeout(() => spawnFallingPizza(), i * 200);
          }
        }
      }, 1000);
      
      // Make everything pizza-themed
      window.chaosPizzaTheme = true;
      
      setTimeout(() => { 
        window.chaosPizzaParty = false;
        window.chaosPizzaTheme = false;
        clearInterval(pizzaInterval);
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
      }, 18000);
    },
    rarity: 0.09
  },
  {
    name: 'ROBOT UPRISING',
    message: '🤖 ROBOT UPRISING! BEEP BOOP CHAOS! 🤖',
    effect: () => {
      window.chaosRobotUprising = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2c3e50 0%, #34495e 50%, #2c3e50 100%)';
      document.getElementById('game-area').style.filter = 'contrast(1.2) brightness(0.9)';
      
      // Spawn robot effects
      const robotInterval = setInterval(() => {
        if (window.chaosRobotUprising) {
          spawnRobotGlitch();
          if (Math.random() < 0.3) spawnBinaryRain();
        }
      }, 800);
      
      // Make enemies more robotic
      window.chaosRobotTransform = true;
      
      setTimeout(() => { 
        window.chaosRobotUprising = false;
        window.chaosRobotTransform = false;
        clearInterval(robotInterval);
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 16000);
    },
    rarity: 0.07
  },
  {
    name: 'MEDIEVAL MADNESS',
    message: '⚔️ MEDIEVAL TIMES! KNIGHTS AND DRAGONS! ⚔️',
    effect: () => {
      window.chaosMedievalMode = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #8B4513 0%, #A0522D 25%, #228B22 50%, #8B4513 100%)';
      document.getElementById('game-area').style.filter = 'sepia(0.3)';
      
      // Spawn medieval effects
      const medievalInterval = setInterval(() => {
        if (window.chaosMedievalMode) {
          if (Math.random() < 0.4) spawnCastle();
          if (Math.random() < 0.6) spawnDragon();
        }
      }, 2000);
      
      // Transform weapons to medieval
      window.chaosMedievalWeapons = true;
      
      setTimeout(() => { 
        window.chaosMedievalMode = false;
        window.chaosMedievalWeapons = false;
        clearInterval(medievalInterval);
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 14000);
    },
    rarity: 0.06
  },
  {
    name: 'JUNGLE FEVER',
    message: '🌴 JUNGLE EXPEDITION! WILD ADVENTURE! 🌴',
    effect: () => {
      window.chaosJungleMode = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #228B22 0%, #32CD32 25%, #006400 50%, #228B22 100%)';
      document.getElementById('game-area').style.filter = 'saturate(1.5) brightness(1.1)';
      
      // Spawn jungle creatures
      const jungleInterval = setInterval(() => {
        if (window.chaosJungleMode) {
          if (Math.random() < 0.5) spawnJungleAnimal();
          if (Math.random() < 0.3) spawnVines();
        }
      }, 1200);
      
      // Add jungle sounds (visual)
      window.chaosJungleSounds = true;
      
      setTimeout(() => { 
        window.chaosJungleMode = false;
        window.chaosJungleSounds = false;
        clearInterval(jungleInterval);
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 17000);
    },
    rarity: 0.08
  },
  {
    name: 'WINTER WONDERLAND',
    message: '❄️ WINTER WONDERLAND! FROZEN BATTLEFIELD! ❄️',
    effect: () => {
      window.chaosWinterMode = true;
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #E6E6FA 0%, #F0F8FF 25%, #FFFFFF 50%, #E6E6FA 100%)';
      document.getElementById('game-area').style.filter = 'brightness(1.2) contrast(0.9)';
      
      // Continuous snowfall
      const snowInterval = setInterval(() => {
        if (window.chaosWinterMode) {
          for (let i = 0; i < 6; i++) {
            setTimeout(() => spawnSnowflake(), i * 100);
          }
        }
      }, 600);
      
      // Freeze effects
      window.chaosIceEffects = true;
      
      setTimeout(() => { 
        window.chaosWinterMode = false;
        window.chaosIceEffects = false;
        clearInterval(snowInterval);
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
        document.getElementById('game-area').style.filter = '';
      }, 19000);
    },
    rarity: 0.07
  }
];

export const randomMessages = [
  "HOLY MOLY!",
  "WHAT THE HECK?!",
  "BANANA SPLIT!",
  "CHEESE AND CRACKERS!",
  "JUMPING JELLYBEANS!",
  "GREAT GOOGLY MOOGLY!",
  "SWEET POTATO PIE!",
  "RUBBER DUCKY MADNESS!",
  "PICKLE JUICE PARTY!",
  "MARSHMALLOW MAYHEM!",
  "TACO TUESDAY!",
  "PIZZA POWER!",
  "DONUT DESTRUCTION!",
  "WAFFLE WARFARE!",
  "SPAGHETTI CHAOS!",
  "BURRITO BLAST!",
  "COOKIE CARNAGE!",
  "PANCAKE PANDEMONIUM!",
  "SANDWICH SURPRISE!",
  "PRETZEL PARTY!",
  "MUFFIN MADNESS!",
  "BAGEL BONANZA!",
  "CEREAL KILLER!",
  "SOUP-ER HERO!",
  "NACHO AVERAGE FIGHT!",
  "LETTUCE TURNIP THE BEET!",
  "OLIVE YOU TOO!",
  "ORANGE YOU GLAD?!",
  "BERRY NICE SHOT!",
  "GRAPE EXPECTATIONS!",
  "APPLE-SOLUTELY CRAZY!",
  "BANANAS FOR BATTLE!",
  "PEACHY KEEN COMBAT!",
  "CHERRY ON TOP!",
  "MELON MADNESS!"
];

export function triggerChaosEvent() {
  if (Math.random() < 0.55) { // 55% chance per level for MORE CHAOS!
    const event = chaosEvents[Math.floor(Math.random() * chaosEvents.length)];
    showChaosMessage(event.message);
    event.effect();
  }
}

// Track active chaos messages for stacking
let activeMessages = [];

export function showChaosMessage(message) {
  const chaosDiv = document.createElement('div');
  chaosDiv.className = 'chaos-message';
  chaosDiv.style.position = 'fixed';
  chaosDiv.style.left = '50%';
  chaosDiv.style.transform = 'translateX(-50%)';
  chaosDiv.style.fontSize = '36px';
  chaosDiv.style.fontWeight = 'bold';
  chaosDiv.style.color = '#ff0000';
  chaosDiv.style.textShadow = '3px 3px 6px #000, 0 0 20px #ff0000';
  chaosDiv.style.zIndex = '99999';
  chaosDiv.style.animation = 'bounce 0.3s infinite, character-rainbow 2s infinite';
  chaosDiv.style.background = 'rgba(0,0,0,0.8)';
  chaosDiv.style.padding = '20px';
  chaosDiv.style.borderRadius = '15px';
  chaosDiv.style.border = '3px solid #ff0000';
  chaosDiv.style.whiteSpace = 'nowrap';
  chaosDiv.textContent = message;
  
  // Calculate position based on existing messages - display in UI area
  const messageHeight = 80; // Approximate height including padding
  const startY = 120; // Start below the title (around 120px from top)
  const offsetY = activeMessages.length * messageHeight;
  
  chaosDiv.style.top = `${startY + offsetY}px`;
  
  // Add to active messages list
  activeMessages.push(chaosDiv);
  
  document.body.appendChild(chaosDiv);
  
  // Screen shake removed - only earthquake should shake
  
  setTimeout(() => {
    if (document.body.contains(chaosDiv)) {
      document.body.removeChild(chaosDiv);
    }
    // Remove from active messages list
    activeMessages = activeMessages.filter(msg => msg !== chaosDiv);
    // Reposition remaining messages
    repositionMessages();
    document.body.style.animation = '';
  }, 3000);
}

function repositionMessages() {
  const messageHeight = 80;
  const startY = 120; // Below title, in UI area
  
  activeMessages.forEach((msg, index) => {
    const offsetY = index * messageHeight;
    msg.style.top = `${startY + offsetY}px`;
  });
}

export function getRandomMessage() {
  return randomMessages[Math.floor(Math.random() * randomMessages.length)];
}

// CHAOS SPAWNING FUNCTIONS!
export function spawnFallingBanana() {
  const banana = document.createElement('div');
  banana.style.position = 'absolute';
  banana.style.left = (Math.random() * 800) + 'px';
  banana.style.top = '-50px';
  banana.style.fontSize = '30px';
  banana.style.zIndex = '9999';
  banana.textContent = '🍌';
  banana.style.animation = 'fall 3s linear';
  document.getElementById('game-area').appendChild(banana);
  
  setTimeout(() => {
    if (banana.parentNode) banana.parentNode.removeChild(banana);
  }, 3000);
}

export function spawnDiscoBall() {
  const disco = document.createElement('div');
  disco.style.position = 'absolute';
  disco.style.left = (Math.random() * 700) + 'px';
  disco.style.top = (Math.random() * 400) + 'px';
  disco.style.fontSize = '40px';
  disco.style.zIndex = '9999';
  disco.textContent = '🪩';
  disco.style.animation = 'spin 2s linear infinite';
  document.getElementById('game-area').appendChild(disco);
  
  setTimeout(() => {
    if (disco.parentNode) disco.parentNode.removeChild(disco);
  }, 10000);
}

export function spawnChickenRaider() {
  const chicken = document.createElement('div');
  chicken.style.position = 'absolute';
  chicken.style.left = (800 + Math.random() * 100) + 'px'; // Start from right
  chicken.style.top = (Math.random() * 400) + 'px';
  chicken.style.fontSize = (25 + Math.random() * 20) + 'px'; // Varied sizes!
  chicken.style.zIndex = '9999';
  chicken.textContent = '🐔';
  chicken.style.animation = 'chicken-march 8s linear';
  chicken.style.filter = `hue-rotate(${Math.random() * 60}deg)`; // Color variety
  document.getElementById('game-area').appendChild(chicken);
  
  // Make chickens move left across screen with varied speeds
  const speed = 1 + Math.random() * 3;
  const moveInterval = setInterval(() => {
    const currentLeft = parseInt(chicken.style.left);
    chicken.style.left = (currentLeft - speed) + 'px';
    
    // Random direction changes
    if (Math.random() < 0.05) {
      const currentTop = parseInt(chicken.style.top);
      chicken.style.top = Math.max(0, Math.min(450, currentTop + (Math.random() - 0.5) * 40)) + 'px';
    }
    
    if (currentLeft < -50) {
      clearInterval(moveInterval);
      if (chicken.parentNode) chicken.parentNode.removeChild(chicken);
    }
  }, 50);
  
  setTimeout(() => {
    clearInterval(moveInterval);
    if (chicken.parentNode) chicken.parentNode.removeChild(chicken);
  }, 12000);
}

export function spawnFlyingChicken() {
  const chicken = document.createElement('div');
  chicken.style.position = 'absolute';
  chicken.style.left = (Math.random() * 800) + 'px';
  chicken.style.top = '-50px';
  chicken.style.fontSize = '30px';
  chicken.style.zIndex = '9999';
  chicken.textContent = '🐓'; // Rooster for flying
  chicken.style.animation = 'chicken-fly 6s linear';
  chicken.style.transform = 'rotate(-15deg)';
  document.getElementById('game-area').appendChild(chicken);
  
  setTimeout(() => {
    if (chicken.parentNode) chicken.parentNode.removeChild(chicken);
  }, 6000);
}

export function showChickenBawk() {
  const bawk = document.createElement('div');
  bawk.style.position = 'absolute';
  bawk.style.left = (Math.random() * 600 + 100) + 'px';
  bawk.style.top = (Math.random() * 300 + 100) + 'px';
  bawk.style.fontSize = '20px';
  bawk.style.fontWeight = 'bold';
  bawk.style.color = '#ff6600';
  bawk.style.textShadow = '2px 2px 4px #000';
  bawk.style.zIndex = '9999';
  bawk.style.animation = 'bounce 0.5s infinite';
  bawk.textContent = 'BAWK!';
  document.getElementById('game-area').appendChild(bawk);
  
  setTimeout(() => {
    if (bawk.parentNode) bawk.parentNode.removeChild(bawk);
  }, 2000);
}

export function spawnMatrixRain() {
  const rain = document.createElement('div');
  rain.style.position = 'absolute';
  rain.style.left = (Math.random() * 800) + 'px';
  rain.style.top = '-20px';
  rain.style.color = '#00ff00';
  rain.style.fontSize = '12px';
  rain.style.fontFamily = 'monospace';
  rain.style.zIndex = '9999';
  rain.textContent = String.fromCharCode(0x30A0 + Math.random() * 96);
  rain.style.animation = 'fall 4s linear';
  document.getElementById('game-area').appendChild(rain);
  
  setTimeout(() => {
    if (rain.parentNode) rain.parentNode.removeChild(rain);
  }, 4000);
}

export function spawnStar() {
  const star = document.createElement('div');
  star.style.position = 'absolute';
  star.style.left = (Math.random() * 800) + 'px';
  star.style.top = (Math.random() * 500) + 'px';
  star.style.color = '#ffffff';
  star.style.fontSize = (Math.random() * 10 + 5) + 'px';
  star.style.zIndex = '9999';
  star.textContent = '✦';
  star.style.animation = 'twinkle 2s infinite';
  document.getElementById('game-area').appendChild(star);
  
  setTimeout(() => {
    if (star.parentNode) star.parentNode.removeChild(star);
  }, 12000);
}

export function spawnBubble() {
  const bubble = document.createElement('div');
  bubble.style.position = 'absolute';
  bubble.style.left = (Math.random() * 800) + 'px';
  bubble.style.top = '520px';
  bubble.style.fontSize = (Math.random() * 15 + 10) + 'px';
  bubble.style.zIndex = '9999';
  bubble.textContent = '○';
  bubble.style.color = '#87CEEB';
  bubble.style.animation = 'bubble-rise 6s linear';
  document.getElementById('game-area').appendChild(bubble);
  
  setTimeout(() => {
    if (bubble.parentNode) bubble.parentNode.removeChild(bubble);
  }, 6000);
}

export function spawnCandy() {
  const candies = ['🍭', '🍬', '🧁', '🍰', '🎂', '🍪'];
  const candy = document.createElement('div');
  candy.style.position = 'absolute';
  candy.style.left = (Math.random() * 700) + 'px';
  candy.style.top = (Math.random() * 400) + 'px';
  candy.style.fontSize = '25px';
  candy.style.zIndex = '9999';
  candy.textContent = candies[Math.floor(Math.random() * candies.length)];
  candy.style.animation = 'bounce 1s infinite';
  document.getElementById('game-area').appendChild(candy);
  
  setTimeout(() => {
    if (candy.parentNode) candy.parentNode.removeChild(candy);
  }, 10000);
}

export function spawnShadowCreature() {
  const shadow = document.createElement('div');
  shadow.style.position = 'absolute';
  shadow.style.left = (Math.random() * 800) + 'px';
  shadow.style.top = (Math.random() * 500) + 'px';
  shadow.style.fontSize = '30px';
  shadow.style.zIndex = '9999';
  shadow.textContent = '👤';
  shadow.style.color = '#000000';
  shadow.style.opacity = '0.7';
  shadow.style.animation = 'shadow-drift 8s linear';
  document.getElementById('game-area').appendChild(shadow);
  
  setTimeout(() => {
    if (shadow.parentNode) shadow.parentNode.removeChild(shadow);
  }, 8000);
}

export function spawnQuantumParticle() {
  const particle = document.createElement('div');
  particle.style.position = 'absolute';
  particle.style.left = (Math.random() * 800) + 'px';
  particle.style.top = (Math.random() * 500) + 'px';
  particle.style.width = '4px';
  particle.style.height = '4px';
  particle.style.background = '#ffffff';
  particle.style.borderRadius = '50%';
  particle.style.zIndex = '9999';
  particle.style.boxShadow = '0 0 10px #ffffff';
  particle.style.animation = 'quantum-dance 3s infinite';
  document.getElementById('game-area').appendChild(particle);
  
  setTimeout(() => {
    if (particle.parentNode) particle.parentNode.removeChild(particle);
  }, 3000);
}

export function spawnFallingPizza() {
  const pizzas = ['🍕', '🍕', '🍕', '🧀', '🍅'];
  const pizza = document.createElement('div');
  pizza.style.position = 'absolute';
  pizza.style.left = (Math.random() * 800) + 'px';
  pizza.style.top = '-50px';
  pizza.style.fontSize = (20 + Math.random() * 15) + 'px';
  pizza.style.zIndex = '9999';
  pizza.textContent = pizzas[Math.floor(Math.random() * pizzas.length)];
  pizza.style.animation = 'fall 4s linear';
  pizza.style.transform = `rotate(${Math.random() * 360}deg)`;
  document.getElementById('game-area').appendChild(pizza);
  
  setTimeout(() => {
    if (pizza.parentNode) pizza.parentNode.removeChild(pizza);
  }, 4000);
}

export function spawnRobotGlitch() {
  const robot = document.createElement('div');
  robot.style.position = 'absolute';
  robot.style.left = (Math.random() * 700) + 'px';
  robot.style.top = (Math.random() * 400) + 'px';
  robot.style.fontSize = '25px';
  robot.style.zIndex = '9999';
  robot.textContent = '🤖';
  robot.style.animation = 'digital-glitch 2s infinite';
  robot.style.filter = 'brightness(1.5) contrast(2)';
  document.getElementById('game-area').appendChild(robot);
  
  setTimeout(() => {
    if (robot.parentNode) robot.parentNode.removeChild(robot);
  }, 3000);
}

export function spawnBinaryRain() {
  const binary = document.createElement('div');
  binary.style.position = 'absolute';
  binary.style.left = (Math.random() * 800) + 'px';
  binary.style.top = '-20px';
  binary.style.color = '#00ff00';
  binary.style.fontSize = '14px';
  binary.style.fontFamily = 'monospace';
  binary.style.zIndex = '9999';
  binary.textContent = Math.random() < 0.5 ? '0' : '1';
  binary.style.animation = 'fall 3s linear';
  document.getElementById('game-area').appendChild(binary);
  
  setTimeout(() => {
    if (binary.parentNode) binary.parentNode.removeChild(binary);
  }, 3000);
}

export function spawnCastle() {
  const castle = document.createElement('div');
  castle.style.position = 'absolute';
  castle.style.left = (Math.random() * 600) + 'px';
  castle.style.top = (Math.random() * 300 + 100) + 'px';
  castle.style.fontSize = '40px';
  castle.style.zIndex = '9999';
  castle.textContent = '🏰';
  castle.style.animation = 'bounce 2s infinite';
  document.getElementById('game-area').appendChild(castle);
  
  setTimeout(() => {
    if (castle.parentNode) castle.parentNode.removeChild(castle);
  }, 8000);
}

export function spawnDragon() {
  const dragon = document.createElement('div');
  dragon.style.position = 'absolute';
  dragon.style.left = '-50px';
  dragon.style.top = (Math.random() * 200 + 50) + 'px';
  dragon.style.fontSize = '35px';
  dragon.style.zIndex = '9999';
  dragon.textContent = '🐉';
  dragon.style.animation = 'dragon-fly 6s linear';
  document.getElementById('game-area').appendChild(dragon);
  
  const moveInterval = setInterval(() => {
    const currentLeft = parseInt(dragon.style.left);
    dragon.style.left = (currentLeft + 3) + 'px';
    
    if (currentLeft > 850) {
      clearInterval(moveInterval);
      if (dragon.parentNode) dragon.parentNode.removeChild(dragon);
    }
  }, 50);
  
  setTimeout(() => {
    clearInterval(moveInterval);
    if (dragon.parentNode) dragon.parentNode.removeChild(dragon);
  }, 6000);
}

export function spawnJungleAnimal() {
  const animals = ['🐒', '🦍', '🐅', '🦜', '🐍', '🦎'];
  const animal = document.createElement('div');
  animal.style.position = 'absolute';
  animal.style.left = (Math.random() * 700) + 'px';
  animal.style.top = (Math.random() * 400) + 'px';
  animal.style.fontSize = '30px';
  animal.style.zIndex = '9999';
  animal.textContent = animals[Math.floor(Math.random() * animals.length)];
  animal.style.animation = 'jungle-hop 3s infinite';
  document.getElementById('game-area').appendChild(animal);
  
  setTimeout(() => {
    if (animal.parentNode) animal.parentNode.removeChild(animal);
  }, 6000);
}

export function spawnVines() {
  const vine = document.createElement('div');
  vine.style.position = 'absolute';
  vine.style.left = (Math.random() * 800) + 'px';
  vine.style.top = '-20px';
  vine.style.fontSize = '20px';
  vine.style.zIndex = '9999';
  vine.textContent = '🌿';
  vine.style.animation = 'vine-grow 4s linear';
  document.getElementById('game-area').appendChild(vine);
  
  setTimeout(() => {
    if (vine.parentNode) vine.parentNode.removeChild(vine);
  }, 4000);
}

export function spawnSnowflake() {
  const snowflake = document.createElement('div');
  snowflake.style.position = 'absolute';
  snowflake.style.left = (Math.random() * 800) + 'px';
  snowflake.style.top = '-20px';
  snowflake.style.fontSize = (10 + Math.random() * 15) + 'px';
  snowflake.style.zIndex = '9999';
  snowflake.textContent = '❄️';
  snowflake.style.animation = 'snowfall 5s linear';
  snowflake.style.opacity = '0.8';
  document.getElementById('game-area').appendChild(snowflake);
  
  setTimeout(() => {
    if (snowflake.parentNode) snowflake.removeChild(snowflake);
  }, 5000);
}

// Add chaos CSS animations
const chaosStyle = document.createElement('style');
chaosStyle.textContent = `
  @keyframes rainbow {
    0% { background: #ff0000; }
    16% { background: #ff8000; }
    33% { background: #ffff00; }
    50% { background: #00ff00; }
    66% { background: #0080ff; }
    83% { background: #8000ff; }
    100% { background: #ff0000; }
  }
  
  @keyframes bounce {
    0%, 100% { transform: translate(-50%, -50%) scale(1); }
    50% { transform: translate(-50%, -50%) scale(1.2); }
  }
  
  @keyframes wiggle {
    0% { transform: rotate(0deg); }
    25% { transform: rotate(5deg); }
    75% { transform: rotate(-5deg); }
    100% { transform: rotate(0deg); }
  }
  
  @keyframes fall {
    0% { transform: translateY(-50px) rotate(0deg); }
    100% { transform: translateY(550px) rotate(360deg); }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg) scale(1); }
    50% { transform: rotate(180deg) scale(1.2); }
    100% { transform: rotate(360deg) scale(1); }
  }
  
  @keyframes chicken-march {
    0%, 100% { transform: translateY(0px); }
    25% { transform: translateY(-10px); }
    75% { transform: translateY(5px); }
  }
  
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  
  @keyframes character-rainbow {
    0% { filter: hue-rotate(0deg); }
    100% { filter: hue-rotate(360deg); }
  }
  
  @keyframes ui-chaos {
    0% { transform: scale(1) rotate(0deg); }
    25% { transform: scale(1.1) rotate(2deg); }
    75% { transform: scale(0.9) rotate(-2deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  
  @keyframes twinkle {
    0%, 100% { opacity: 0.3; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.2); }
  }
  
  @keyframes bubble-rise {
    0% { transform: translateY(0px) scale(1); opacity: 0.8; }
    100% { transform: translateY(-550px) scale(0.5); opacity: 0; }
  }
  
  @keyframes matrix-fall {
    0% { transform: translateY(-50px); opacity: 1; }
    100% { transform: translateY(550px); opacity: 0; }
  }
  
  @keyframes quantum-shift {
    0% { filter: hue-rotate(0deg) saturate(1); }
    25% { filter: hue-rotate(90deg) saturate(2); }
    50% { filter: hue-rotate(180deg) saturate(0.5); }
    75% { filter: hue-rotate(270deg) saturate(1.5); }
    100% { filter: hue-rotate(360deg) saturate(1); }
  }
  
  @keyframes time-warp {
    0%, 100% { transform: scale(1) skew(0deg); }
    25% { transform: scale(1.05) skew(2deg); }
    50% { transform: scale(0.95) skew(-2deg); }
    75% { transform: scale(1.02) skew(1deg); }
  }
  
  @keyframes shadow-drift {
    0% { transform: translateX(0) translateY(0) scale(1); opacity: 0.7; }
    50% { transform: translateX(-100px) translateY(-50px) scale(1.2); opacity: 0.3; }
    100% { transform: translateX(-200px) translateY(-100px) scale(0.8); opacity: 0; }
  }
  
  @keyframes reality-tear {
    0% { background-position: 0% 0%; transform: rotate(0deg); }
    25% { background-position: 100% 0%; transform: rotate(1deg); }
    50% { background-position: 100% 100%; transform: rotate(0deg); }
    75% { background-position: 0% 100%; transform: rotate(-1deg); }
    100% { background-position: 0% 0%; transform: rotate(0deg); }
  }
  
  @keyframes quantum-dance {
    0%, 100% { transform: translate(0, 0) scale(1); }
    25% { transform: translate(20px, -20px) scale(1.5); }
    50% { transform: translate(-20px, 20px) scale(0.5); }
    75% { transform: translate(20px, 20px) scale(1.2); }
  }
  
  @keyframes digital-glitch {
    0%, 100% { transform: translate(0); }
    10% { transform: translate(-2px, 2px); }
    20% { transform: translate(-2px, -2px); }
    30% { transform: translate(2px, 2px); }
    40% { transform: translate(2px, -2px); }
    50% { transform: translate(-2px, 2px); }
    60% { transform: translate(-2px, -2px); }
    70% { transform: translate(2px, 2px); }
    80% { transform: translate(-2px, -2px); }
    90% { transform: translate(2px, 2px); }
  }
  
  @keyframes chicken-fly {
    0% { transform: translateY(-50px) rotate(-15deg); }
    50% { transform: translateY(200px) rotate(-10deg); }
    100% { transform: translateY(550px) rotate(-20deg); }
  }
  
  @keyframes dragon-fly {
    0% { transform: translateX(0) translateY(0) scale(1); }
    25% { transform: translateX(200px) translateY(-20px) scale(1.1); }
    50% { transform: translateX(400px) translateY(20px) scale(1); }
    75% { transform: translateX(600px) translateY(-10px) scale(1.1); }
    100% { transform: translateX(850px) translateY(0) scale(1); }
  }
  
  @keyframes jungle-hop {
    0%, 100% { transform: translateY(0) scale(1); }
    25% { transform: translateY(-15px) scale(1.1); }
    50% { transform: translateY(-5px) scale(0.9); }
    75% { transform: translateY(-20px) scale(1.2); }
  }
  
  @keyframes vine-grow {
    0% { transform: translateY(-20px) scaleY(0.1); }
    50% { transform: translateY(200px) scaleY(1); }
    100% { transform: translateY(520px) scaleY(1.2); }
  }
  
  @keyframes snowfall {
    0% { transform: translateY(-20px) rotate(0deg); opacity: 0.8; }
    50% { transform: translateY(250px) rotate(180deg); opacity: 1; }
    100% { transform: translateY(520px) rotate(360deg); opacity: 0.3; }
  }
  
  @keyframes pizza-spin {
    0% { transform: rotate(0deg) scale(1); }
    50% { transform: rotate(180deg) scale(1.2); }
    100% { transform: rotate(360deg) scale(1); }
  }
  
  @keyframes robot-march {
    0%, 100% { transform: translateX(0) rotate(0deg); }
    25% { transform: translateX(5px) rotate(2deg); }
    75% { transform: translateX(-5px) rotate(-2deg); }
  }
  
  @keyframes medieval-wave {
    0%, 100% { transform: scale(1) rotate(0deg); }
    50% { transform: scale(1.1) rotate(5deg); }
  }
  
  @keyframes ice-sparkle {
    0%, 100% { opacity: 0.6; transform: scale(1); }
    50% { opacity: 1; transform: scale(1.3); }
  }
`;
document.head.appendChild(chaosStyle);