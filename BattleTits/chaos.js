// chaos.js - TOTAL MAYHEM SYSTEM!
export const chaosEvents = [
  {
    name: 'BANANA RAIN',
    message: '🍌 BANANA RAIN! SLIPPERY FLOORS! 🍌',
    effect: () => {
      // Make player slide around AND change board to yellow!
      window.chaosSlippery = true;
      document.getElementById('game-area').style.background = 'linear-gradient(45deg, #ffff00, #ffaa00)';
      // Spawn falling bananas!
      for (let i = 0; i < 20; i++) {
        setTimeout(() => spawnFallingBanana(), i * 200);
      }
      setTimeout(() => { 
        window.chaosSlippery = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
      }, 8000);
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
      // Change board to farm theme!
      document.getElementById('game-area').style.background = 'linear-gradient(180deg, #87CEEB 0%, #90EE90 50%, #8B4513 100%)';
      // Spawn ACTUAL CHICKEN ARMY!
      for (let i = 0; i < 15; i++) {
        setTimeout(() => spawnChickenRaider(), i * 300);
      }
      setTimeout(() => { 
        window.chaosGiantChicken = false;
        document.getElementById('game-area').style.background = 'linear-gradient(180deg, #2a4a2a 0%, #1a3a1a 50%, #0a2a0a 100%)';
      }, 12000);
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
  if (Math.random() < 0.35) { // 35% chance per level for more variety
    const event = chaosEvents[Math.floor(Math.random() * chaosEvents.length)];
    showChaosMessage(event.message);
    event.effect();
  }
}

export function showChaosMessage(message) {
  const chaosDiv = document.createElement('div');
  chaosDiv.style.position = 'fixed';
  chaosDiv.style.top = '50%';
  chaosDiv.style.left = '50%';
  chaosDiv.style.transform = 'translate(-50%, -50%)';
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
  chaosDiv.textContent = message;
  
  document.body.appendChild(chaosDiv);
  
  // REDUCED SCREEN SHAKE - only for major events!
  if (Math.random() < 0.3) { // Only 30% chance for screenshake
    document.body.style.animation = 'ui-chaos 0.1s infinite';
  }
  
  setTimeout(() => {
    document.body.removeChild(chaosDiv);
    document.body.style.animation = '';
  }, 3000);
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
  chicken.style.fontSize = '35px';
  chicken.style.zIndex = '9999';
  chicken.textContent = '🐔';
  chicken.style.animation = 'chicken-march 8s linear';
  document.getElementById('game-area').appendChild(chicken);
  
  // Make chickens move left across screen
  const moveInterval = setInterval(() => {
    const currentLeft = parseInt(chicken.style.left);
    chicken.style.left = (currentLeft - 2) + 'px';
    
    if (currentLeft < -50) {
      clearInterval(moveInterval);
      if (chicken.parentNode) chicken.parentNode.removeChild(chicken);
    }
  }, 50);
  
  setTimeout(() => {
    clearInterval(moveInterval);
    if (chicken.parentNode) chicken.parentNode.removeChild(chicken);
  }, 8000);
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
`;
document.head.appendChild(chaosStyle);