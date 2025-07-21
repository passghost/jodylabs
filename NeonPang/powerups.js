// NeonPang Powerups Module
// Add new powerup types and logic here

// Example: Powerup registry and spawn logic
const NeonPangPowerups = (() => {
    const types = {};

    function registerType(name, effect, color = '#ff0000') {
        types[name] = { effect, color };
    }

    function getRandomType() {
        const keys = Object.keys(types);
        return keys[Math.floor(Math.random() * keys.length)];
    }

    function applyPowerup(name, gameState) {
        if (types[name]) {
            types[name].effect(gameState);
        }
    }

    return {
        registerType,
        getRandomType,
        applyPowerup,
        types
    };
})();



// --- Floating Powerups Registration ---
// Each effect receives a 'game' object (should be provided by main game logic)
const floatingPowerupTypes = [
    {
        name: 'speed',
        color: '#00ff00',
        effect: (game) => {
            game.balls.forEach(ball => {
                ball.dx *= 1.5;
                ball.dy *= 1.5;
            });
        }
    },
    {
        name: 'slow',
        color: '#00bfff',
        effect: (game) => {
            game.balls.forEach(ball => {
                ball.dx *= 0.6;
                ball.dy *= 0.6;
            });
        }
    },
    {
        name: 'bigPaddle',
        color: '#ffff00',
        effect: (game) => {
            game.playerPaddle.height *= 1.5;
            setTimeout(() => { game.playerPaddle.height /= 1.5; }, 10000);
        }
    },
    {
        name: 'smallPaddle',
        color: '#ff8800',
        effect: (game) => {
            game.playerPaddle.height *= 0.6;
            setTimeout(() => { game.playerPaddle.height /= 0.6; }, 10000);
        }
    },
    {
        name: 'multiBall',
        color: '#ff00ff',
        effect: (game) => {
            if (game.balls.length < 5) {
                // Only split the first ball into two
                const ball = game.balls[0];
                if (ball) {
                    const newBall = {
                        ...ball,
                        dx: -ball.dx,
                        dy: -ball.dy,
                        particles: []
                    };
                    game.balls.push(newBall);
                }
            }
        }
    },
    {
        name: 'invert',
        color: '#00ffff',
        effect: (game) => {
            if (!game.inverted) {
                game.inverted = true;
                game.invertTimeout = setTimeout(() => { game.inverted = false; }, 8000);
            }
        }
    },
    {
        name: 'shrinkBall',
        color: '#ffffff',
        effect: (game) => {
            game.balls.forEach(ball => {
                ball.size = Math.max(8, ball.size * 0.6);
            });
        }
    }
];

// Register all floating powerups in the registry for compatibility
floatingPowerupTypes.forEach(p => {
    NeonPangPowerups.registerType(p.name, p.effect, p.color);
});

// Utility to spawn a random floating powerup
function spawnRandomFloatingPowerup(canvasWidth, canvasHeight) {
    const type = floatingPowerupTypes[Math.floor(Math.random() * floatingPowerupTypes.length)];
    return {
        name: type.name,
        color: type.color,
        x: Math.random() * (canvasWidth - 30) + 15,
        y: Math.random() * (canvasHeight - 30) + 15,
        radius: 15,
        dx: (Math.random() - 0.5) * 4,
        dy: (Math.random() - 0.5) * 4
    };
}

// Export for main game
if (typeof window !== 'undefined') {
    window.NeonPangPowerups = NeonPangPowerups;
    window.NeonPangFloatingPowerups = floatingPowerupTypes;
    window.spawnRandomFloatingPowerup = spawnRandomFloatingPowerup;
}
