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

// 1. Shimmer
function shimmer() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let alpha = 0.5 + 0.5 * Math.sin(progress * 4 + tile.row + tile.col);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx.restore();
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 2. Drop
function drop() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let t = Math.abs(Math.sin(progress * 2 + tile.row * 0.2 + tile.col * 0.2));
            let y = tile.baseY + t * 30;
            ctx.drawImage(tile.img, tile.baseX, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 3. Spin
function spin() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let angle = progress * 2 * Math.PI + (tile.row + tile.col) * 0.1;
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

// 4. Fade
function fade() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let alpha = 0.5 + 0.5 * Math.sin(progress * 2 + tile.row + tile.col);
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx.restore();
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 5. Wobble
function wobble() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dx = Math.sin(progress * 6 + tile.row) * 8;
            let dy = Math.cos(progress * 6 + tile.col) * 8;
            ctx.drawImage(tile.img, tile.baseX + dx, tile.baseY + dy, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 6. Wave
function wave() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let y = tile.baseY + Math.sin(progress * 2 + tile.col * 0.5) * 20;
            ctx.drawImage(tile.img, tile.baseX, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 7. Pulse
function pulse() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let scale = 0.8 + 0.2 * Math.sin(progress * 4 + tile.row + tile.col);
            let x = tile.baseX + tile.cellW/2 - tile.cellW*scale/2;
            let y = tile.baseY + tile.cellH/2 - tile.cellH*scale/2;
            ctx.drawImage(tile.img, x, y, tile.cellW*scale, tile.cellH*scale);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 8. Twist
function twist() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let angle = Math.sin(progress * 2 + tile.row + tile.col) * Math.PI/4;
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

// 9. Scatter
function scatter() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let dx = Math.sin(progress * 2 + tile.row) * 20;
            let dy = Math.cos(progress * 2 + tile.col) * 20;
            ctx.drawImage(tile.img, tile.baseX + dx, tile.baseY + dy, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 10. Flip
function flip() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let scaleX = Math.sin(progress * 4 + tile.row + tile.col);
            ctx.save();
            ctx.translate(tile.baseX + tile.cellW/2, tile.baseY + tile.cellH/2);
            ctx.scale(scaleX, 1);
            ctx.drawImage(tile.img, -tile.cellW/2, -tile.cellH/2, tile.cellW, tile.cellH);
            ctx.restore();
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}

// 11. Bounce
function bounce() {
    let progress = 0;
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        tiles.forEach(tile => {
            let y = tile.baseY + Math.abs(Math.sin(progress * 4 + tile.row + tile.col)) * 30;
            ctx.drawImage(tile.img, tile.baseX, y, tile.cellW, tile.cellH);
        });
        progress += 0.04;
        if (progress < 2.5) requestAnimationFrame(animate);
    }
    animate();
}
// 12. Flash
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
// 13. Checker
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
// 14. Zoom
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
// 15. Slide
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
// 16. Swirl
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
// 17. Grow
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
// 18. Shrink
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
// 19. Diamond
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