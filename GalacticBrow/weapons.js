// weapons.js
// Unified weapon firing logic for GalacticBrow
// This function fires all active weapon effects (giant, spread, double, piercing, etc.) simultaneously, stacking all collected tiers.

export function fireAllWeapons({ shipX, shipY, shipWidth, powerupState, lasers, laserSpeed }) {
    // Helper: get highest active tier for a powerup family
    function getHighestTier(family) {
        for (let i = 5; i >= 1; i--) {
            if (powerupState[family + (i > 1 ? '_' + i : '')]) return i;
        }
        return 0;
    }

    // 1. Giant Laser (fire only highest active tier)
    const giantTier = getHighestTier('giant_laser');
    const piercingTier = getHighestTier('piercing');
    if (giantTier > 0) {
        const giantColors = ['yellow', '#fff700', '#fff200', '#ffe600', '#fff'];
        const giantWidths = [16, 28, 40, 60, 90];
        const giantHeights = [80, 120, 180, 260, 400];
        lasers.push({
            x: shipX,
            y: shipY,
            giant: true,
            piercing: piercingTier > 0,
            color: giantColors[giantTier-1],
            width: giantWidths[giantTier-1],
            height: giantHeights[giantTier-1],
            glow: 16 + giantTier*16
        });
    }

    // 2. Spread Shot (fire only highest active tier)
    const spreadTier = getHighestTier('spread_shot');
    const doubleTier = getHighestTier('double_laser');
    if (spreadTier > 0) {
        const spreadCounts = [5, 7, 9, 11, 13];
        const spreadAngles = [0.3, 0.5, 0.7, 0.9, 1.2];
        const spreadColors = ['orange', '#ffb347', '#ff9900', '#ff6600', '#ff3300'];
        const count = spreadCounts[spreadTier-1];
        const maxAngle = spreadAngles[spreadTier-1];
        const color = spreadColors[spreadTier-1];
        const centerX = shipX + shipWidth / 2;
        for (let i = 0; i < count; i++) {
            const angle = -maxAngle/2 + (maxAngle/(count-1))*i;
            if (doubleTier > 0) {
                const offsets = [-18*doubleTier, 18*doubleTier];
                offsets.forEach(offset => {
                    lasers.push({
                        x: centerX + offset,
                        y: shipY,
                        dx: Math.sin(angle) * (7+spreadTier*2),
                        dy: -laserSpeed * Math.cos(angle) * (1+spreadTier*0.2),
                        spread: true,
                        color,
                        width: 4+spreadTier*2,
                        height: 18+spreadTier*6,
                        glow: 8+spreadTier*6,
                        piercing: piercingTier > 0
                    });
                });
            } else {
                lasers.push({
                    x: centerX,
                    y: shipY,
                    dx: Math.sin(angle) * (7+spreadTier*2),
                    dy: -laserSpeed * Math.cos(angle) * (1+spreadTier*0.2),
                    spread: true,
                    color,
                    width: 4+spreadTier*2,
                    height: 18+spreadTier*6,
                    glow: 8+spreadTier*6,
                    piercing: piercingTier > 0
                });
            }
        }
    }

    // 3. Double Laser (fire only highest active tier if not already handled by spread)
    if (doubleTier > 0 && spreadTier === 0) {
        const doubleColors = ['aqua', '#00e6e6', '#00bfff', '#0099ff', '#0055ff'];
        const offsets = [-18*doubleTier, 0, shipWidth-12, shipWidth-12+18*doubleTier];
        const color = doubleColors[doubleTier-1];
        offsets.forEach(offset => {
            lasers.push({
                x: shipX,
                y: shipY,
                offset,
                color,
                width: 2+doubleTier*2,
                height: 14+doubleTier*4,
                glow: 8+doubleTier*4,
                piercing: piercingTier > 0
            });
        });
    }

    // 4. Normal/Piercing Laser (if no spread/double/giant fired)
    if (giantTier === 0 && spreadTier === 0 && doubleTier === 0) {
        const piercingColors = ['lime', '#66ff66', '#00ff99', '#00ffcc', '#00ffff'];
        if (piercingTier > 0) {
            lasers.push({
                x: shipX, y: shipY,
                color: piercingColors[piercingTier-1],
                width: 4+2*piercingTier,
                height: 18+4*piercingTier,
                glow: 12+6*piercingTier,
                piercing: true
            });
        } else {
            lasers.push({ x: shipX, y: shipY, color: 'aqua', width: 2, height: 14, glow: 8, piercing: false });
        }
    }
}
