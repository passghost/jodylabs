# TankNutz - JavaScript Tank Game

## Overview

TankNutz is a fast-paced, top-down tank shooter game built with JavaScript and HTML5 Canvas. Players control various tank variants in a scrolling world filled with enemies, destructible environments, and power-ups. The game features modular architecture, dynamic AI systems, and extensive visual effects.

## 🎮 Game Features

### Core Gameplay
- **Multiple Tank Variants**: Choose from different tank types including the Ford Fiesta variant with enhanced speed boosts
- **Dynamic Combat**: Real-time shooting with bullet physics and collision detection
- **Enemy AI**: Intelligent enemy tanks with targeting and movement systems
- **Destructible Environment**: Buildings, foliage, and billboards that can be destroyed
- **Power-up System**: Collect various power-ups for enhanced abilities

### Advanced Systems
- **Mini Tank Allies**: 6th level powerup spawns AI-controlled mini tanks that match your selected variant
- **Building Destruction**: Drive into houses/huts to destroy them with realistic fragment physics
- **Visual Effects**: Screen shake, muzzle flashes, particle effects, and tank bump animations
- **Sound Integration**: Dynamic sound effects that respond to game events
- **Modular Architecture**: Clean separation of game systems for maintainability

## 🛠️ Technical Architecture

### Core Technologies
- **JavaScript ES6+**: Modern JavaScript with classes, modules, and async/await
- **HTML5 Canvas**: 2D rendering with hardware acceleration
- **Modular Design**: Separate files for different game systems

### Key Files
```
js/
├── game.js          # Main game logic and loop
├── served_game.js   # Production bundle
├── tank.js          # Tank physics and rendering
├── alternativetanks.js # Tank variant system
├── foliage.js       # Destructible plants and trees
├── billboard.js     # Interactive billboards
├── draw.mjs         # Rendering utilities
├── input.mjs        # Input handling
├── utils.mjs        # Helper functions
└── modules/         # Additional game modules
```

### Game Systems
- **Physics Engine**: Custom collision detection and movement
- **AI System**: Enemy targeting and ally behavior
- **Particle System**: Gibs, explosions, and effects
- **Audio System**: Dynamic sound playback
- **Save/Load System**: Game state persistence

## 🚀 Recent Developments

### ✅ Completed Features

#### Mini Tank Ally System (Latest)
- **6th Level Powerup**: Collect mini powerup orbs (15% drop chance)
- **AI Behavior**: Autonomous mini tanks with targeting and shooting
- **Visual Integration**: Mini tanks match player's selected variant
- **Smart AI**: Targets nearest enemies, maintains formation
- **Performance Optimized**: Maximum 3 allies, efficient collision detection

#### Building Destruction
- **Tank Collision**: Drive into buildings to destroy them
- **HP System**: Buildings take damage and break apart realistically
- **Fragment Physics**: Realistic debris with gravity and rotation
- **Respawn System**: Buildings regenerate after 5 seconds

### 🔧 Development Tools
```
tools/
├── capture_kitten_screenshot.js    # Screenshot automation
├── inspect_kitten.js              # Debug utilities
├── smoke_test_*.js                # Automated testing
└── render_*.js                    # Content generation
```

## 🎯 Game Mechanics

### Controls
- **WASD**: Tank movement
- **Mouse**: Turret aiming and shooting
- **Space**: Fire bullets
- **Shift**: Speed boost (enhanced for Ford Fiesta)

### Power-ups
1. **Health**: Restore tank health
2. **Speed**: Temporary speed increase
3. **Shield**: Damage protection
4. **Multi-shot**: Fire multiple bullets
5. **Mini Tanks**: Spawn AI allies (NEW)

### Enemy Types
- **Basic Tanks**: Standard enemy units
- **Fast Tanks**: High-speed aggressive units
- **Heavy Tanks**: Slow but heavily armored
- **Special Variants**: Unique enemy types

## 📊 Project Status

### Current State
- ✅ **Core Gameplay**: Fully functional tank combat
- ✅ **Mini Tank System**: Complete with AI and visual effects
- ✅ **Building Destruction**: Tank collision implemented
- ✅ **Modular Architecture**: Clean code organization
- ✅ **Visual Effects**: Comprehensive particle and animation systems

### Known Issues
- Performance optimization opportunities
- Additional enemy variety needed
- Mobile responsiveness improvements

### Future Plans
- [ ] Additional power-up types
- [ ] New enemy variants
- [ ] Multiplayer support
- [ ] Level progression system
- [ ] Achievement system

## 🏃‍♂️ Running the Game

### Development Mode
1. Open `pixel_tank_game.html` in a modern web browser
2. The game loads automatically with all modules

### Production Mode
1. Use `served_game.js` for optimized performance
2. All features work identically to development version

### Requirements
- Modern web browser with Canvas support
- JavaScript enabled
- Recommended: Chrome/Firefox for best performance

## 🤝 Contributing

### Development Setup
1. Clone the repository
2. Open in VS Code with JavaScript support
3. Use the provided testing tools in `/tools/`
4. Make changes to `game.js` and sync to `served_game.js`

### Code Style
- Use ES6+ features where possible
- Maintain modular architecture
- Include error handling and fallbacks
- Document complex algorithms

## 📈 Performance Notes

### Optimizations
- **Object Pooling**: Efficient bullet and enemy management
- **Frustum Culling**: Only render visible objects
- **Delta Time**: Frame-rate independent movement
- **Modular Loading**: On-demand asset loading

### System Requirements
- **Minimum**: 2GB RAM, modern browser
- **Recommended**: 4GB RAM, dedicated graphics
- **Optimal**: 8GB+ RAM for complex scenes

## 🎨 Art and Assets

### Visual Style
- Pixel art aesthetic with smooth animations
- Dynamic lighting and particle effects
- Consistent art direction across all assets

### Asset Sources
- Custom pixel art for tanks and environments
- Procedurally generated effects
- Integrated sound effects system

---

**Last Updated**: August 29, 2025
**Version**: 2.1.0
**Status**: Active Development

*TankNutz is an ongoing project focused on creating an engaging tank shooter experience with modern web technologies.*
