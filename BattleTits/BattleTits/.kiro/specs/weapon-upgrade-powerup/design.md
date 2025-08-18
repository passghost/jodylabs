# Design Document

## Overview

The Weapon Upgrade Station is a special powerup that requires players to stand within its activation radius for 2 seconds to receive a permanent weapon damage upgrade. The feature introduces strategic positioning gameplay where players must weigh the risk of staying stationary against the reward of permanent weapon improvement.

## Architecture

### Core Components

1. **WeaponUpgradeStation Class**: Manages individual upgrade station instances
2. **ActivationTracker**: Handles player proximity detection and timer management
3. **ProgressRenderer**: Renders the visual feedback circle animation
4. **WeaponUpgradeManager**: Manages permanent weapon upgrades and persistence

### Integration Points

- **Powerup System**: Extends existing powerup spawning and rendering
- **Player Movement**: Integrates with player position tracking
- **Weapon System**: Modifies weapon damage calculations
- **UI System**: Displays upgrade notifications and progress

## Components and Interfaces

### WeaponUpgradeStation Interface

```javascript
class WeaponUpgradeStation {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.type = 'weaponUpgrade';
    this.activationRadius = 40;
    this.activationTime = 2000; // 2 seconds
    this.active = true;
    this.playersInRange = new Set();
    this.activationProgress = new Map(); // player -> progress
  }
  
  checkPlayerProximity(playerX, playerY, playerId);
  updateActivation(deltaTime);
  render(container);
  isComplete();
}
```

### ActivationTracker Interface

```javascript
class ActivationTracker {
  constructor(station) {
    this.station = station;
    this.playerTimers = new Map();
  }
  
  updatePlayerProgress(playerId, inRange, deltaTime);
  getProgress(playerId);
  resetProgress(playerId);
  isActivationComplete(playerId);
}
```

### ProgressRenderer Interface

```javascript
class ProgressRenderer {
  static renderProgressCircle(container, x, y, progress, size);
  static renderUpgradeStation(container, station);
  static createUpgradeEffect(x, y);
}
```

## Data Models

### Weapon Upgrade Station Data

```javascript
const weaponUpgradeStation = {
  x: number,              // X position
  y: number,              // Y position
  type: 'weaponUpgrade',  // Powerup type identifier
  activationRadius: 40,   // Activation distance in pixels
  activationTime: 2000,   // Time required in milliseconds
  active: boolean,        // Whether station is still available
  playersInRange: Set,    // Set of player IDs in range
  activationProgress: Map // Player ID -> progress (0-1)
};
```

### Player Weapon Upgrade State

```javascript
const playerUpgradeState = {
  playerId: number,           // 1 or 2
  permanentDamageBonus: number, // Cumulative damage bonus
  upgradeCount: number,       // Number of upgrades received
  lastUpgradeTime: number     // Timestamp of last upgrade
};
```

## Error Handling

### Proximity Detection Errors
- **Invalid Player Position**: Default to no proximity if position is undefined
- **Multiple Players**: Handle simultaneous activation by multiple players
- **Timer Desync**: Reset timers if inconsistent state detected

### Rendering Errors
- **Missing Container**: Skip rendering if container element not found
- **Animation Glitches**: Fallback to static progress indicator
- **Performance Issues**: Limit animation frame rate if needed

### Upgrade Application Errors
- **Invalid Weapon State**: Apply upgrade to default weapon if current weapon invalid
- **Overflow Protection**: Cap maximum upgrade bonus to prevent game breaking
- **Persistence Failures**: Continue with session-only upgrades if persistence fails

## Testing Strategy

### Unit Tests
- **Proximity Detection**: Test distance calculations and boundary conditions
- **Timer Management**: Verify activation timer accuracy and reset behavior
- **Progress Calculation**: Test progress percentage calculations
- **Upgrade Application**: Verify damage bonus calculations

### Integration Tests
- **Powerup Spawning**: Test integration with existing powerup system
- **Player Movement**: Test with actual player movement and collision
- **Weapon System**: Test permanent upgrade persistence through weapon changes
- **Multi-player**: Test simultaneous activation by both players

### Visual Tests
- **Progress Animation**: Verify smooth circle fill animation
- **Station Rendering**: Test visual distinctiveness from other powerups
- **Effect Rendering**: Test upgrade completion effects
- **UI Integration**: Test notification display

### Performance Tests
- **Animation Performance**: Test smooth 60fps animation during activation
- **Memory Usage**: Test for memory leaks with repeated activations
- **Collision Detection**: Test performance with multiple stations active

## Implementation Notes

### Visual Design
- **Station Appearance**: Large circular base with gear/upgrade symbol
- **Progress Circle**: Outer ring that fills clockwise with bright color
- **Activation Effect**: Particle burst and screen flash on completion
- **Color Scheme**: Gold/orange theme to indicate permanent upgrade

### Game Balance
- **Spawn Rate**: 5-8% chance to spawn instead of regular powerup
- **Damage Bonus**: +15 permanent damage per upgrade
- **Maximum Upgrades**: Cap at 5 upgrades per player per game
- **Cooldown**: 30-second minimum between upgrade station spawns

### Technical Considerations
- **Frame Rate**: Use requestAnimationFrame for smooth progress animation
- **State Management**: Store upgrade state in global player objects
- **Collision Optimization**: Use simple distance calculation for proximity
- **Visual Layering**: Render progress circle above other game elements