// effects2.js - Second set of creative mosaic tile effects
let ctx, canvas, tiles;

export function setupEffects2(deps) {
    ctx = deps.ctx;
    canvas = deps.canvas;
    tiles = deps.tiles;
}

export function applyAnimatedArtEffect2(effectName) {
    if (effectName === "rainbow2") rainbow2();
    else if (effectName === "jitter2") jitter2();
    else if (effectName === "shrinkgrow2") shrinkgrow2();
    else if (effectName === "trail2") trail2();
    else if (effectName === "popcorn2") popcorn2();
    else if (effectName === "swirl2") swirl2();
    else if (effectName === "fade2") fade2();
    else if (effectName === "zoom2") zoom2();
    else if (effectName === "checker2") checker2();
    else if (effectName === "orbit2") orbit2();
    else if (effectName === "ripple2") ripple2();
}

// 1. Rainbow Tint
function rainbow2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let hue = (progress * 60 + tile.row * 10 + tile.col * 10) % 360;
            ctx.save();
            ctx.filter = `hue-rotate(${hue}deg)`;
            ctx.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx.restore();
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 2. Pixel Jitter
function jitter2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dx = Math.sin(progress * 10 + tile.row * 2) * 4;
            let dy = Math.cos(progress * 10 + tile.col * 2) * 4;
            // Start jitter from the top-left pixel of each tile
            ctx.drawImage(tile.img, Math.floor(tile.baseX + dx), Math.floor(tile.baseY + dy), Math.floor(tile.cellW), Math.floor(tile.cellH));
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 3. Shrink/Grow
function shrinkgrow2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = 0.5 + 0.5 * Math.sin(progress * 2 + tile.row + tile.col);
            let x = tile.baseX + tile.cellW/2 - tile.cellW*t/2;
            let y = tile.baseY + tile.cellH/2 - tile.cellH*t/2;
            ctx.drawImage(tile.img, x, y, tile.cellW*t, tile.cellH*t);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 4. Tile Fade Trail
function trail2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.max(0, Math.sin(progress * 2 + tile.row * 0.2 + tile.col * 0.2));
            ctx.globalAlpha = t;
            ctx.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx.globalAlpha = 1;
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 5. Tile Popcorn
function popcorn2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.abs(Math.sin(progress * 6 + tile.row + tile.col));
            let y = tile.baseY - t * 20;
            ctx.drawImage(tile.img, tile.baseX, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 6. Swirl 2
function swirl2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let angle = Math.sin(progress + tile.row * 0.2 + tile.col * 0.2) * Math.PI;
            ctx.save();
            ctx.translate(tile.baseX + tile.cellW/2, tile.baseY + tile.cellH/2);
            ctx.rotate(angle);
            ctx.drawImage(tile.img, -tile.cellW/2, -tile.cellH/2, tile.cellW, tile.cellH);
            ctx.restore();
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 7. Fade In/Out
function fade2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = 0.5 + 0.5 * Math.sin(progress * 2 + tile.row + tile.col);
            ctx.globalAlpha = t;
            ctx.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx.globalAlpha = 1;
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 8. Zoom Pop
function zoom2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = 0.5 + 0.5 * Math.sin(progress * 2 + tile.row + tile.col);
            let x = tile.baseX + tile.cellW/2 - tile.cellW*t/2;
            let y = tile.baseY + tile.cellH/2 - tile.cellH*t/2;
            ctx.drawImage(tile.img, x, y, tile.cellW*t, tile.cellH*t);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 9. Checkerboard Flash
function checker2() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let isEven = (tile.row + tile.col) % 2 === 0;
            let t = isEven ? Math.min(progress, 1) : Math.max(1 - progress, 0);
            ctx.globalAlpha = t;
            ctx.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
        });
        ctx.globalAlpha = 1;
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 10. Orbit
function orbit2() {
    let progress = 0;
    let cx = canvas.width/2, cy = canvas.height/2;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let angle = progress * 2 + (tile.row + tile.col) * 0.2;
            let radius = 20 + (tile.row + tile.col) * 2;
            let x = tile.baseX + Math.cos(angle) * radius;
            let y = tile.baseY + Math.sin(angle) * radius;
            ctx.drawImage(tile.img, x, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 11. Ripple
function ripple2() {
    let progress = 0;
    let cx = canvas.width/2, cy = canvas.height/2;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dx = tile.baseX + tile.cellW/2 - cx;
            let dy = tile.baseY + tile.cellH/2 - cy;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let t = Math.sin(progress * 2 - dist * 0.03);
            let y = tile.baseY + t * 12;
            ctx.drawImage(tile.img, tile.baseX, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}
