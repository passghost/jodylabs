// ...existing code...
// effects4.js - New creative mosaic tile effects
// Each effect should animate tiles in a unique, visually distinct way

let ctx, canvas, tiles;

export function setupEffects4(deps) {
    ctx = deps.ctx;
    canvas = deps.canvas;
    tiles = deps.tiles;
}

// 1. Tile Slide In (tiles slide in from random directions)
export function applyAnimatedArtEffect4(effectName) {
    if (effectName === "slidein4") tileSlideIn4();
    else if (effectName === "explode4") tileExplode4();
    else if (effectName === "swipe4") tileSwipe4();
    else if (effectName === "curtain4") tileCurtain4();
    else if (effectName === "vortex4") tileVortex4();
}

function tileSlideIn4() {
    let directions = ["left", "right", "top", "bottom"];
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dir = directions[(tile.row + tile.col) % 4];
            let t = Math.min(progress, 1);
            let x = tile.baseX, y = tile.baseY;
            if (dir === "left") x -= (1-t)*canvas.width;
            if (dir === "right") x += (1-t)*canvas.width;
            if (dir === "top") y -= (1-t)*canvas.height;
            if (dir === "bottom") y += (1-t)*canvas.height;
            ctx.drawImage(tile.img, x, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 2. Tile Explode (tiles fly outward from center)
function tileExplode4() {
    let progress = 0;
    let cx = canvas.width/2, cy = canvas.height/2;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dx = tile.baseX + tile.cellW/2 - cx;
            let dy = tile.baseY + tile.cellH/2 - cy;
            let dist = Math.sqrt(dx*dx + dy*dy);
            let t = Math.min(progress, 1);
            let x = tile.baseX + dx * t * 1.2;
            let y = tile.baseY + dy * t * 1.2;
            ctx.drawImage(tile.img, x, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}

// 3. Tile Swipe (tiles swipe in row-by-row)
function tileSwipe4() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.min(progress - tile.row*0.05, 1);
            if (t < 0) t = 0;
            let x = tile.baseX - (1-t)*canvas.width;
            ctx.drawImage(tile.img, x, tile.baseY, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 1.05 + tiles.length*0.05) requestAnimationFrame(animate);
    }
    animate();
}

// 4. Tile Curtain (tiles drop down like a curtain, column-by-column)
function tileCurtain4() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.min(progress - tile.col*0.05, 1);
            if (t < 0) t = 0;
            let y = tile.baseY - (1-t)*canvas.height;
            ctx.drawImage(tile.img, tile.baseX, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 1.05 + tiles.length*0.05) requestAnimationFrame(animate);
    }
    animate();
}

// 5. Tile Vortex (tiles spiral in from edges)
function tileVortex4() {
    let progress = 0;
    let cx = canvas.width/2, cy = canvas.height/2;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dx = tile.baseX + tile.cellW/2 - cx;
            let dy = tile.baseY + tile.cellH/2 - cy;
            let angle = Math.atan2(dy, dx);
            let radius = Math.sqrt(dx*dx + dy*dy);
            let t = Math.min(progress, 1);
            let spiralR = radius * (1-t);
            let spiralA = angle + (1-t)*4;
            let x = cx + spiralR * Math.cos(spiralA) - tile.cellW/2;
            let y = cy + spiralR * Math.sin(spiralA) - tile.cellH/2;
            ctx.drawImage(tile.img, x, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 1.05) requestAnimationFrame(animate);
    }
    animate();
}
