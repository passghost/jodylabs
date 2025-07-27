// ...existing code...
// effects.js - Core mosaic tile effects
let ctx, canvas, tiles;

export function setupEffects(deps) {
    ctx = deps.ctx;
    canvas = deps.canvas;
    tiles = deps.tiles;
}

export function applyAnimatedArtEffect(effectName) {
    if (effectName === "shimmer") shimmer();
    else if (effectName === "drop") drop();
    else if (effectName === "spin") spin();
    else if (effectName === "fade") fade();
    else if (effectName === "wobble") wobble();
    else if (effectName === "wave") wave();
    else if (effectName === "pulse") pulse();
    else if (effectName === "twist") twist();
    else if (effectName === "scatter") scatter();
    else if (effectName === "flip") flip();
    else if (effectName === "bounce") bounce();
    else if (effectName === "flash") flash();
    else if (effectName === "checker") checker();
    else if (effectName === "zoom") zoom();
    else if (effectName === "slide") slide();
    else if (effectName === "swirl") swirl();
    else if (effectName === "grow") grow();
    else if (effectName === "shrink") shrink();
    else if (effectName === "diamond") diamond();
}

// 1. Tile Flash (tiles flash white then fade back)
function flash() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.abs(Math.sin(progress * 3 + tile.row + tile.col));
            ctx.save();
            ctx.globalAlpha = 0.5 + 0.5 * t;
            ctx.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx.globalAlpha = t;
            ctx.fillStyle = "#fff";
            ctx.fillRect(tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx.restore();
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 2. Tile Checker (checkerboard pattern fade)
function checker() {
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

// 3. Tile Zoom (tiles zoom in from center)
function zoom() {
    let progress = 0;
    let cx = canvas.width/2, cy = canvas.height/2;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dx = tile.baseX + tile.cellW/2 - cx;
            let dy = tile.baseY + tile.cellH/2 - cy;
            let t = Math.min(progress, 1);
            let scale = 0.2 + 0.8 * t;
            let x = cx + dx * scale - tile.cellW * scale/2;
            let y = cy + dy * scale - tile.cellH * scale/2;
            ctx.drawImage(tile.img, x, y, tile.cellW * scale, tile.cellH * scale);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 4. Tile Slide (tiles slide in from left)
function slide() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.min(progress, 1);
            let x = tile.baseX - (1-t)*canvas.width;
            ctx.drawImage(tile.img, x, tile.baseY, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 5. Tile Swirl (tiles rotate in place)
function swirl() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.min(progress, 1);
            let angle = t * 2 * Math.PI + (tile.row + tile.col) * 0.1;
            ctx.save();
            ctx.translate(tile.baseX + tile.cellW/2, tile.baseY + tile.cellH/2);
            ctx.rotate(angle);
            ctx.drawImage(tile.img, -tile.cellW/2, -tile.cellH/2, tile.cellW, tile.cellH);
            ctx.restore();
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 6. Tile Grow (tiles grow from small to full size)
function grow() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.min(progress, 1);
            let scale = 0.2 + 0.8 * t;
            let x = tile.baseX + tile.cellW/2 - tile.cellW*scale/2;
            let y = tile.baseY + tile.cellH/2 - tile.cellH*scale/2;
            ctx.drawImage(tile.img, x, y, tile.cellW*scale, tile.cellH*scale);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 7. Tile Shrink (tiles shrink to center)
function shrink() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = 1 - Math.min(progress, 1);
            let scale = 0.2 + 0.8 * t;
            let x = tile.baseX + tile.cellW/2 - tile.cellW*scale/2;
            let y = tile.baseY + tile.cellH/2 - tile.cellH*scale/2;
            ctx.drawImage(tile.img, x, y, tile.cellW*scale, tile.cellH*scale);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 8. Tile Diamond (tiles move in diamond pattern)
function diamond() {
    let progress = 0;
    let cx = canvas.width/2, cy = canvas.height/2;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.min(progress, 1);
            let dx = tile.baseX + tile.cellW/2 - cx;
            let dy = tile.baseY + tile.cellH/2 - cy;
            let offset = Math.abs(Math.sin((tile.row + tile.col + progress) * 0.5)) * 40 * (1-t);
            let x = tile.baseX + (dx > 0 ? offset : -offset);
            let y = tile.baseY + (dy > 0 ? offset : -offset);
            ctx.drawImage(tile.img, x, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}