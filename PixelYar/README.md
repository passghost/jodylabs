# Pirate Pixel Yar - Modular Structure

A pirate-themed multiplayer pixel game built with vanilla JavaScript and Supabase.

## Project Structure

```
├── index.html              # Main HTML file (minimal, clean)
├── main.js                 # Legacy compatibility layer
├── js/                     # Modular JavaScript files
│   ├── config.js           # Game configuration and constants
│   ├── auth.js             # Authentication management
│   ├── ui.js               # UI management and particle effects
│   ├── world.js            # World generation and island management
│   ├── renderer.js         # Canvas rendering and visual effects
│   ├── interactions.js     # Random game interactions and events
│   ├── player.js           # Player management and database operations
│   ├── interaction-manager.js # Player-to-player interaction coordinator
│   ├── combat-manager.js   # Turn-based naval combat system
│   ├── trade-manager.js    # Advanced trading system
│   ├── chat-manager.js     # Real-time ship-to-ship communication
│   ├── ai-ships.js         # AI enemy ships with autonomous behavior
│   └── game.js             # Main game controller and initialization
└── supabase_*.sql          # Database schema files
```

## Module Overview

### `config.js`
- Centralized configuration for all game constants
- Supabase credentials
- Game dimensions, timing, and limits
- Easy to modify game parameters

### `auth.js`
- Handles user authentication with Supabase
- Login, registration, and logout functionality
- Provides Supabase client access to other modules

### `ui.js`
- Manages all UI elements and interactions
- Login screen particle effects
- HUD updates and move timer
- Interaction log management

### `world.js`
- Procedural island generation
- Collision detection for islands and ports
- Water object management system
- Dynamic object spawning and cleanup
- World validation for player movement

### `renderer.js`
- Canvas drawing operations
- Ocean, island, player, and water object rendering
- 16 unique water object visual styles
- Zoom and camera controls
- Advanced visual effects and styling

### `interactions.js`
- Random event system with 90+ unique pirate-themed interactions
- Water object integration - interactions spawn visual objects in the ocean
- 16 different water object types with unique visual representations
- Modular interaction management with world integration

### `player.js`
- Player state management
- Database synchronization
- Movement validation
- Multiplayer data handling

### `game.js`
- Main game controller
- Coordinates all modules
- Game loop and event handling
- Entry point for the application

## Key Features

- **Modular Architecture**: Clean separation of concerns
- **ES6 Modules**: Modern JavaScript module system
- **Minimal HTML**: All logic moved to focused modules
- **Easy Extension**: Add new features without touching core files
- **Maintainable**: Each module has a single responsibility
- **Real-time Movement**: Smooth sailing with WASD keys, no turn-based waiting
- **Ship Rotation**: Boats rotate smoothly in the direction they're sailing
- **Mouse Wheel Zoom**: Intuitive zooming with scroll wheel
- **Interaction Prompts**: Players are blocked only when interactions occur
- **Pictorial Ships**: Detailed pirate ship graphics with rotation
- **AI Enemy Ships**: Autonomous black ships that sail around and interact
- **Smart Database Updates**: Position synced only when needed (login/logout/interactions)

## Getting Started

1. Set up your Supabase project with the provided SQL files
2. Update credentials in `js/config.js`
3. Open `index.html` in a modern browser
4. The game loads automatically using ES6 modules

## Adding New Features

- **New interactions**: Add to `js/interactions.js`
- **UI changes**: Modify `js/ui.js`
- **Game mechanics**: Extend `js/game.js`
- **Visual effects**: Update `js/renderer.js`
- **Configuration**: Adjust `js/config.js`

The modular structure makes it easy to add features without affecting other parts of the game.
## Pl
ayer Interaction System

### `interaction-manager.js`
- Detects nearby players within 3-pixel range
- Coordinates Combat, Trade, and Chat requests
- Real-time interaction request handling
- Manages interaction approval/decline flow

### `combat-manager.js`
- Turn-based naval combat system
- 6 different combat actions (Cannon Blast, Chain Shot, Grape Shot, Ramming Speed, Defensive Maneuver, Repair Hull)
- Real-time combat state synchronization
- Victory/defeat consequences affecting player stats
- Visual combat interface with health bars and action log

### `trade-manager.js`
- Advanced trading system for ship-to-ship commerce
- Trade multiple resource types: Gold, Crew, Hull Repairs, Items
- Mutual approval system - both players must agree
- Real-time trade offer updates
- Automatic stat updates upon trade completion
- Support for 8 different tradeable item types

### `chat-manager.js`
- Real-time ship-to-ship communication
- Typing indicators and message timestamps
- Message history persistence
- Notification sounds for new messages
- Pirate-themed quick message templates
- Auto-scroll and read receipt system

## Interaction Features

- **Proximity Detection**: Players must be within 3 pixels to interact
- **Request System**: All interactions require mutual consent
- **Real-time Updates**: All interactions use Supabase real-time subscriptions
- **Visual Feedback**: Dedicated UI interfaces for each interaction type
- **Stat Integration**: Combat and trade results affect player statistics
- **Session Management**: Proper cleanup and state management for all interactions

## Database Schema

The interaction system uses 4 additional Supabase tables:
- `player_interactions` - Manages interaction requests and responses
- `combat_sessions` - Stores turn-based combat state
- `trade_sessions` - Handles trade negotiations and approvals  
- `chat_sessions` - Persists chat messages and session data
## Wa
ter Objects System

The game now features a dynamic water objects system that adds visual narrative elements to interactions:

### Water Object Types
- **Wreckage** 🚢 - Sunken ship remains, brown wooden debris
- **Treasure Chest** 💰 - Golden chests containing riches
- **Floating Barrel** 🛢️ - Rum barrels and supplies
- **Message Bottle** 💌 - Green bottles with treasure maps
- **Ghost Ship** 👻 - Translucent phantom vessels
- **Whirlpool** 🌀 - Dangerous spinning water vortexes
- **Sea Mine** 💣 - Spiked naval mines from old wars
- **Floating Corpse** ⚰️ - Deceased sailors with hidden treasures
- **Merchant Cargo** 📦 - Spilled trade goods and supplies
- **Cursed Idol** 🗿 - Purple mystical artifacts
- **Siren Rock** 🧜‍♀️ - Pink rocks where sirens sing
- **Kraken Tentacle** 🐙 - Massive sea monster appendages
- **Volcanic Rock** 🌋 - Red-hot molten stone
- **Ice Floe** 🧊 - Floating chunks of ice
- **Pirate Flag** 🏴‍☠️ - Territorial markers and omens

### Object Features
- **Visual Integration**: Each object has unique colors, shapes, and effects
- **Narrative Context**: Objects appear based on interaction storylines
- **Automatic Cleanup**: Objects disappear after 5 minutes to prevent clutter
- **Collision Avoidance**: Objects won't spawn on islands or existing objects
- **Proximity Spawning**: Objects appear within 5 pixels of the triggering event

### Enhanced Interactions
- **90+ Total Interactions**: Original 40 plus 50 new water object interactions
- **Visual Storytelling**: Many interactions now leave lasting visual evidence
- **Environmental Immersion**: The ocean becomes a living, story-rich environment
- **Dynamic World**: Each playthrough creates a unique seascape of adventure remnants
## S
hip Repair System

### Repair Mechanics
- **Activation**: Press 'R' key when it's your turn to move
- **Hull Restoration**: Repairs 15-25 hull points per use
- **Extended Cooldown**: Repair actions take twice as long as normal moves (10 seconds vs 5 seconds)
- **Repair Cooldown**: Cannot repair again for 3 moves after using repair
- **Smart Validation**: Cannot repair if hull is already at 100%

### Visual Feedback
- **Timer Display**: Shows "Repairing" status during repair cooldown
- **Progress Indication**: Green text and repair icon during repair process
- **Move Prompt**: Updated to show repair option (R key)
- **History Log**: Repair results logged in interaction history

## Pictorial Ship System

### Ship Design Features
- **Detailed Hull**: Elliptical ship body with realistic proportions
- **Wooden Deck**: Lighter brown deck overlay for depth
- **Mast & Rigging**: Vertical mast with sail attachment points
- **Dynamic Sails**: Golden sails for current player, cream for others
- **Sail Details**: Rope lines and rigging for authenticity
- **Ship Bow**: Pointed front section for directional clarity
- **Ship Stern**: Detailed rear section
- **Pirate Flags**: Skull & crossbones for current player, red flags for others
- **Wake Effects**: Water splash behind ships for movement indication
- **Golden Outline**: Current player ship highlighted with gold border

### Technical Implementation
- **Size Consideration**: Ships are ~5x3 pixels, collision detection updated accordingly
- **Color Manipulation**: Dynamic color lightening/darkening for ship details
- **Layered Rendering**: Multiple draw calls create detailed ship appearance
- **Proximity Adjustment**: Interaction range increased to 8 pixels for ship size
- **Visual Hierarchy**: Current player ship stands out with glow and special colors

### Ship Components
1. **Hull** - Main ship body in player color
2. **Deck** - Lighter overlay showing ship's deck
3. **Mast** - Dark brown vertical mast
4. **Sail** - Large triangular sail with rope details
5. **Bow** - Pointed front section
6. **Stern** - Rear section with different shading
7. **Flag** - Pirate flag on mast (unique for current player)
8. **Wake** - Water effects showing movement## A
I Enemy Ship System

### AI Ship Features
- **Autonomous Movement**: AI ships move every 3 seconds independently
- **Fleet Management**: 3-5 AI ships spawn automatically and maintain fleet size
- **Behavioral AI**: Ships exhibit different behaviors based on their condition
- **Visual Distinction**: Black hulls, dark red sails, and red skull flags
- **Combat Ready**: AI ships can be attacked by players
- **Self-Repair**: AI ships repair themselves when hull is low

### AI Behaviors
1. **Wandering** - Random movement with directional persistence
2. **Hunting** - Seeks out nearby targets when aggressive
3. **Fleeing** - Avoids threats when hull is damaged
4. **Repairing** - Stops to repair when hull drops below 30%

### AI Ship Stats
- **Hull**: 80-120 points (randomized on spawn)
- **Crew**: 8-16 members (randomized on spawn)
- **Booty**: 0-20 gold (randomized on spawn)
- **Aggression**: 0.2-1.0 level affects hunting behavior
- **Repair Cooldown**: 2-move cooldown between repairs

### AI Interactions
- **Random Events**: AI ships trigger interactions at 15% rate (vs 20% for players)
- **Water Objects**: AI repairs spawn floating barrels as visual indicators
- **Combat Participation**: AI ships can engage in combat with players
- **Fleet Maintenance**: Destroyed AI ships are automatically replaced

### Visual Design
- **Black Hulls**: Distinctive enemy appearance
- **Dark Red Sails**: Menacing sail color vs cream/gold for players
- **Red Skull Flags**: Black flags with red skulls and crossbones
- **Enemy Indicators**: Red borders and skull icons in nearby ships UI
- **Combat-Only**: AI ships show "Combat Only" instead of trade/chat options

The AI ships create a living, dangerous ocean environment where players must navigate not just natural hazards but also hostile enemy vessels that patrol the seas with their own agendas and behaviors.## Rea
l-time Movement System

### Movement Mechanics
- **Continuous Movement**: Hold WASD keys for smooth sailing
- **Slow Speed**: Ships move at 0.5 pixels per frame (30 pixels/second at 60fps)
- **Smooth Rotation**: Ships rotate gradually toward movement direction
- **Collision Detection**: Real-time boundary and island collision checking
- **Diagonal Movement**: Normalized diagonal movement for consistent speed

### Database Optimization
- **Smart Sync**: Position updated to database only every 1 second during movement
- **Critical Updates**: Immediate sync on login, logout, and player interactions
- **Reduced Load**: Eliminates constant database writes from turn-based system
- **Real-time Display**: Local position updates at 60fps for smooth visuals

### Interaction System
- **Event-Driven**: Interactions checked every 0.5 seconds during movement
- **Blocking Prompts**: Movement stops when interaction occurs
- **Modal Interface**: Clear interaction prompts with "Continue Sailing" button
- **Reduced Frequency**: 2% chance per check (vs 20% per turn) for balanced gameplay

### Controls
- **WASD Movement**: Hold keys for continuous movement in any direction
- **R Key Repair**: Instant hull repair (no movement interruption)
- **Mouse Wheel Zoom**: Smooth zooming in/out with scroll wheel
- **Interaction Dismissal**: Click "Continue Sailing" to resume after events

### Visual Enhancements
- **Ship Rotation**: Current player's ship rotates to face movement direction
- **Smooth Animation**: 60fps rendering for fluid movement
- **Real-time HUD**: Live position and stats updates
- **Movement Feedback**: Visual rotation and wake effects show ship direction

### Technical Implementation
- **RequestAnimationFrame**: Smooth 60fps game loop
- **Velocity System**: Separate X/Y velocity components for realistic movement
- **Rotation Interpolation**: Smooth rotation transitions with wrapping
- **State Management**: Clean separation of movement, rotation, and interaction states

The real-time system transforms the game from turn-based sailing into a smooth, immersive pirate adventure where players have full control over their ship's movement and only pause for meaningful interactions and encounters.
## Enhanced
 Inventory System

The game now features a comprehensive inventory management system:

### Inventory Features
- **20+ Item Types**: From Gold Coins to Lucky Charms, each with unique properties
- **Item Categories**: Currency, Consumables, Materials, Valuables, Tools, and Special items
- **Stack Management**: Items have individual stack limits and properties
- **Item Usage**: Click items in inventory or use quick action buttons to consume them
- **Crafting System**: Combine items to create valuable goods or useful tools

### Item Usage
- **Medicine** (💊): Heals 15 hull points
- **Rum Bottles** (🍺): Boosts crew morale, adds 2 crew members
- **Wooden Planks** (🪵): Emergency repairs, restores 10 hull points
- **Lucky Charm** (🍀): Provides 3 uses of damage reduction
- **Treasure Maps** (🗺️): Reveals random valuable items
- **Gunpowder** (💥): Dangerous to use directly, 30% chance of explosion

### Crafting Recipes
- **Repair Kit**: 3 Wooden Planks + 2 Rope → 2 Medicine
- **Explosive Cannon Ball**: 5 Cannon Balls + 2 Gunpowder → 15 Gold Coins
- **Navigation Kit**: 1 Compass + 1 Spyglass + 1 Treasure Map → 25 Gold Coins
- **Luxury Bundle**: 3 Silk + 3 Spices + 2 Pearls → 40 Gold Coins

### Controls
- **I Key**: Open full inventory view with crafting interface
- **Click Items**: Use consumable items directly from inventory display
- **Quick Actions**: Use dedicated buttons for common items (Heal, Boost, Repair)

### Inventory Integration
- **Random Rewards**: Interactions now have chances to reward inventory items
- **Value Calculation**: Total inventory value displayed and tracked
- **Database Persistence**: All inventory data is saved and restored between sessions
- **Visual Notifications**: Floating notifications show inventory changes and item usage results

The inventory system adds strategic depth to the game, allowing players to collect, manage, and use items to enhance their pirate adventures!
##
 Trading Port System

The game now features a comprehensive trading system with synchronized islands and ports:

### Island Features
- **Synchronized Islands**: All players see the same islands in the same locations
- **Named Trading Ports**: Each island has a unique trading port with a distinctive name
- **Visual Enhancement**: Ports show buildings, docks, flags, and names when zoomed in
- **Proximity Detection**: Trading button appears when you're within 50 pixels of a port

### Trading System
- **Dynamic Stocks**: Each port has randomized inventory that changes over time
- **Buy & Sell**: Purchase items from ports or sell your goods for gold
- **Real-time Updates**: Stock levels update immediately across all players
- **Price Variation**: Different ports offer different prices for the same items

### Available Trading Ports
- **Port Royal** - The main trading hub
- **Tortuga Harbor** - Pirate haven with unique goods
- **Nassau Trading Post** - Commercial center
- **Blackwater Bay** - Dark waters, good deals
- **Skull Island Port** - Mysterious island trading
- **Golden Cove** - Premium goods available
- **Windward Station** - Strategic trading location
- **Crimson Harbor** - Red-sailed merchants

### Trading Items
- **Rum Bottles** - Crew morale boosters
- **Cannon Balls** - Essential for combat
- **Wooden Planks** - Ship repair materials
- **Rope** - Rigging supplies
- **Medicine** - Healing supplies
- **Spices** - Valuable trade goods
- **Silk** - Luxury items
- **Pearls** - Precious gems

### How to Trade
1. **Sail near a port** (within 50 pixels)
2. **Click the trading button** that appears
3. **Buy items** with your gold coins
4. **Sell items** from your inventory
5. **Prices fluctuate** based on supply and demand

### Database Integration
- **Persistent Islands**: Islands are stored in the database and shared across all players
- **Stock Management**: Trading stocks are tracked in real-time
- **Automatic Restocking**: Ports periodically restock with random quantities and prices

The trading system adds economic gameplay depth, encouraging exploration and strategic resource management!

## Pixel Pack System

### Pixel Placement Features
- **5 Colored Pixel Packs**: Red, Blue, Green, Yellow, and Purple pixel packs available
- **Map Decoration**: Place colored pixels anywhere on the ocean that are visible to all players
- **Permanent Placement**: Placed pixels remain on the map forever, creating a collaborative canvas
- **One Pixel Per Location**: Only one pixel can exist at each coordinate
- **Island Protection**: Cannot place pixels on islands, only in open water
- **Littered Ocean**: Over time, the ocean becomes filled with player-placed pixels showing their creativity

### How to Use Pixel Packs
1. **Acquire Pixel Packs**: Buy from trading ports or find them through random interactions
2. **Activate Pack**: Click on a pixel pack in your inventory or use the 'I' key to open full inventory
3. **Place Pixel**: Click anywhere on the ocean to place your colored pixel
4. **Cancel Mode**: Press ESC to cancel pixel placement mode

### Pixel Pack Availability
- **Trading Ports**: All ports sell pixel packs for 8-12 gold each
- **Random Interactions**: 4% chance to find 1-3 pixel packs during sailing encounters
- **Starting Items**: New players receive 2 Red and 2 Blue pixel packs

### Visual Features
- **Glowing Effect**: Placed pixels have a subtle glow effect for visibility
- **White Border**: Each pixel has a white border to stand out against the ocean
- **Real-time Updates**: Pixels appear immediately for all players via real-time synchronization
- **Pixel Mode Indicator**: UI shows active pixel placement mode with color coding
- **Persistent Canvas**: All pixels from all players are loaded when joining the game

The pixel pack system allows players to leave their permanent mark on the world, creating a collaborative canvas where pirates can express creativity, mark territories, and illustrate what they want to see in the water. Over time, the ocean becomes a living artwork filled with player contributions!