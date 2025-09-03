# Enhanced Grinder RPG - MMO Edition

A real-time multiplayer RPG grinder game built with JavaScript and Supabase.

## Features

### Core Gameplay
- Click-to-move and click-to-attack mechanics
- Multiple enemy types with different AI behaviors
- Level progression system with experience points
- Health, mana, and combat systems
- Inventory management with potions and items
- Pet summoning system
- Merchant NPC with shop functionality

### MMO Features
- Real-time multiplayer with other players
- Global chat system
- Player position synchronization
- Online player count display
- Persistent player data across sessions

### Visual Effects
- Pixel art graphics with animations
- Particle effects for combat and spells
- Screen shake and visual feedback
- Floating damage numbers
- Dynamic camera system with smooth following

## Setup Instructions

### 1. Database Setup
1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `database-setup.sql`
4. Run the SQL commands to create the necessary tables

### 2. Configuration
The game is already configured with the provided Supabase credentials:
- URL: `https://omcwjmvdjswkfjkahchm.supabase.co`
- Anon Key: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`

### 3. Running the Game
1. Serve the files using a local web server (required for ES6 modules)
2. Open `grinder-minimal.html` in your browser
3. The game will automatically connect to the MMO server

## How to Play

### Basic Controls
- **Click** to move your character
- **Click on enemies** to attack them
- **Click on NPCs** to interact with them
- **Use items** by clicking on them in the item bar
- **Use abilities** by clicking on them in the ability bar

### Chat System
- Type messages in the chat input at the bottom left
- Press Enter or click Send to send messages
- All online players will see your messages in real-time

### Combat System
- Characters automatically attack nearby enemies
- Different enemy types have varying stats and behaviors
- Gain experience and gold from defeating enemies
- Level up to increase your stats

### Shop System
- Talk to the merchant NPC to access the shop
- Buy health potions, mana potions, and pet scrolls
- Use gold earned from combat to purchase items

## File Structure

- `grinder-minimal.html` - Main HTML file
- `gameLogic.js` - Core game logic and coordination
- `gameEngine.js` - Entity-Component-System game engine
- `uiManager.js` - UI creation and management
- `effectsManager.js` - Visual effects and animations
- `mmoManager.js` - Multiplayer functionality
- `pixelArtData.js` - Sprite data and animations
- `pixelArtModule.js` - Pixel art rendering system
- `gameStyles.css` - All game styling
- `database-setup.sql` - Database schema setup

## Technical Details

### Architecture
- Entity-Component-System (ECS) architecture
- Modular design with separate managers for different systems
- Real-time synchronization using Supabase real-time subscriptions
- Pixel-perfect rendering with custom pixel art system

### Performance
- Optimized update loops for different systems
- Efficient particle system with object pooling
- Camera culling for off-screen entities
- Minimal DOM manipulation for better performance

## Multiplayer Features

### Real-time Synchronization
- Player positions updated every 2 seconds
- Instant chat message delivery
- Automatic cleanup of offline players
- Persistent player data storage

### Player Interaction
- See other players moving around the world
- Player name tags above characters
- Global chat for communication
- Online player count display

## Future Enhancements

Potential features that could be added:
- Player vs Player combat
- Guild/party systems
- World bosses and events
- Trading between players
- More complex crafting systems
- Different character classes
- Larger world with multiple zones

## Troubleshooting

### Connection Issues
- Ensure you have an internet connection
- Check that the Supabase project is active
- Verify the database tables are created correctly

### Performance Issues
- Close other browser tabs to free up memory
- Ensure you're using a modern browser with ES6 support
- Check browser console for any JavaScript errors

## Credits

Built with:
- Vanilla JavaScript (ES6 modules)
- Supabase for real-time database
- HTML5 Canvas for rendering
- Custom pixel art and animations