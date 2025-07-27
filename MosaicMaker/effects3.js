// MosaicMaker Effects3 Module
// Usage: Call setupEffects3({ctx, canvas, tiles, ...}) once in your main script after initialization.
// Then use applyAnimatedArtEffect3(effectName) as before.

let ctx3, canvas3, tiles3, animationFrameId3 = null;

function setupEffects3(env) {
    ctx3 = env.ctx;
    canvas3 = env.canvas;
    tiles3 = env.tiles;
}

function spiralBurstEffect3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let angle = frame * 0.09 + tile.row + tile.col;
            let radius = 24 * Math.sin(frame * 0.07 + tile.row + tile.col);
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            let ox = radius * Math.cos(angle);
            let oy = radius * Math.sin(angle);
            ctx3.save();
            ctx3.translate(cx + ox, cy + oy);
            ctx3.rotate(angle);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tilePulse3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let scale = 0.7 + 0.5 * Math.sin(frame * 0.13 + tile.row + tile.col);
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            ctx3.save();
            ctx3.translate(cx, cy);
            ctx3.scale(scale, scale);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileTwist3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let angle = 0.7 * Math.sin(frame * 0.11 + tile.row + tile.col);
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            ctx3.save();
            ctx3.translate(cx, cy);
            ctx3.rotate(angle);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileFlash3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let alpha = ((tile.row + tile.col + Math.floor(frame / 8)) % 2 === 0) ? 1 : 0.2;
            ctx3.save();
            ctx3.globalAlpha = alpha;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.globalAlpha = 1;
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileOrbit3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let radius = 14 + 10 * Math.sin(frame * 0.09 + tile.row + tile.col);
            let angle = frame * 0.07 + tile.row + tile.col;
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            let ox = radius * Math.cos(angle);
            let oy = radius * Math.sin(angle);
            ctx3.save();
            ctx3.drawImage(tile.img, cx - tile.cellW / 2 + ox, cy - tile.cellH / 2 + oy, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileRipple3() {
    let frame = 0;
    let rcx = canvas3.width / 2;
    let rcy = canvas3.height / 2;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let dx = tile.baseX + tile.cellW / 2 - rcx;
            let dy = tile.baseY + tile.cellH / 2 - rcy;
            let r = Math.sqrt(dx * dx + dy * dy);
            let offset = 22 * Math.sin(frame * 0.13 - r / 60);
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY + offset, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileBounce3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let bounce = 20 * Math.abs(Math.sin(frame * 0.12 + tile.row + tile.col));
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY + bounce, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileFlip3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let flip = Math.sin(frame * 0.13 + tile.row + tile.col) > 0 ? 1 : -1;
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            ctx3.save();
            ctx3.translate(cx, cy);
            ctx3.scale(flip, 1);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileScatter3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let ox = 10 * Math.sin(frame * 0.2 + tile.row * 2 + tile.col * 3);
            let oy = 10 * Math.cos(frame * 0.2 + tile.col * 2 + tile.row * 3);
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX + ox, tile.baseY + oy, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileGlow3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let glow = 0.5 + 0.5 * Math.sin(frame * 0.15 + tile.row + tile.col);
            ctx3.save();
            ctx3.filter = `brightness(${glow}) blur(${glow * 4}px)`;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.filter = 'none';
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileChecker3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let flash = ((tile.row + tile.col + Math.floor(frame / 6)) % 2 === 0) ? 1 : 0.2;
            ctx3.save();
            ctx3.globalAlpha = flash;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.globalAlpha = 1;
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileZoom3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let scale = 0.6 + 0.8 * Math.abs(Math.sin(frame * 0.09 + tile.row + tile.col));
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            ctx3.save();
            ctx3.translate(cx, cy);
            ctx3.scale(scale, scale);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileFade3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let alpha = 0.2 + 0.8 * Math.abs(Math.sin(frame * 0.07 + tile.row + tile.col));
            ctx3.save();
            ctx3.globalAlpha = alpha;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.globalAlpha = 1;
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileTrail3() {
    let frame = 0;
    function step() {
        ctx3.globalAlpha = 0.7;
        ctx3.fillStyle = '#000';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.globalAlpha = 1;
        tiles3.forEach(tile => {
            let alpha = 0.2 + 0.8 * Math.abs(Math.sin(frame * 0.07 + tile.row + tile.col));
            ctx3.save();
            ctx3.globalAlpha = alpha;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.globalAlpha = 1;
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileRainbow3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let hue = (frame * 5 + tile.row * 20 + tile.col * 20) % 360;
            ctx3.save();
            ctx3.filter = `hue-rotate(${hue}deg)`;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.filter = 'none';
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileJitter3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let jitterX = Math.random() * 8 - 4;
            let jitterY = Math.random() * 8 - 4;
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX + jitterX, tile.baseY + jitterY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileDiamond3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let diamond = Math.abs(Math.sin(frame * 0.12 + tile.row - tile.col));
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            ctx3.save();
            ctx3.translate(cx, cy);
            ctx3.rotate(Math.PI / 4 * diamond);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileWave3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let offset = 18 * Math.sin(frame * 0.15 + tile.row * 2 - tile.col * 2);
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY + offset, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileSpiral3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let angle = frame * 0.09 + tile.row * 2 - tile.col * 2;
            let radius = 20 * Math.sin(frame * 0.07 + tile.row - tile.col);
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            let ox = radius * Math.cos(angle);
            let oy = radius * Math.sin(angle);
            ctx3.save();
            ctx3.translate(cx + ox, cy + oy);
            ctx3.rotate(angle);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileGrid3() {
    let frame = 0;
    function step() {
        ctx3.clearRect(0, 0, canvas3.width, canvas3.height);
        tiles3.forEach(tile => {
            let gridX = tile.baseX + 10 * Math.sin(frame * 0.1 + tile.row);
            let gridY = tile.baseY + 10 * Math.cos(frame * 0.1 + tile.col);
            ctx3.save();
            ctx3.drawImage(tile.img, gridX, gridY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function tileFadeTrail3() {
    let frame = 0;
    function step() {
        ctx3.globalAlpha = 0.5;
        ctx3.fillStyle = '#222';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.globalAlpha = 1;
        tiles3.forEach(tile => {
            let alpha = 0.1 + 0.9 * Math.abs(Math.sin(frame * 0.09 + tile.row - tile.col));
            ctx3.save();
            ctx3.globalAlpha = alpha;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.globalAlpha = 1;
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function stackCascade3() {
    let frame = 0;
    function step() {
        ctx3.globalAlpha = 0.7;
        ctx3.fillStyle = '#111';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.globalAlpha = 1;
        tiles3.forEach(tile => {
            let stackY = frame * 6 - tile.col * 30;
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY + Math.max(0, stackY), tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function stackWave3() {
    let frame = 0;
    function step() {
        ctx3.globalAlpha = 0.7;
        ctx3.fillStyle = '#111';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.globalAlpha = 1;
        tiles3.forEach(tile => {
            let stackY = frame * 6 - tile.col * 30 + 30 * Math.sin(frame * 0.1 + tile.row);
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY + Math.max(0, stackY), tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function stackBounce3() {
    let frame = 0;
    function step() {
        ctx3.globalAlpha = 0.7;
        ctx3.fillStyle = '#111';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.globalAlpha = 1;
        tiles3.forEach(tile => {
            let stackY = frame * 6 - tile.col * 30;
            let bounce = 20 * Math.abs(Math.sin(frame * 0.12 + tile.row + tile.col));
            ctx3.save();
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY + Math.max(0, stackY) + bounce, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function stackSpiral3() {
    let frame = 0;
    function step() {
        ctx3.globalAlpha = 0.7;
        ctx3.fillStyle = '#111';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.globalAlpha = 1;
        tiles3.forEach(tile => {
            let stackY = frame * 6 - tile.col * 30;
            let angle = frame * 0.09 + tile.row * 2 - tile.col * 2;
            let radius = 20 * Math.sin(frame * 0.07 + tile.row - tile.col);
            let cx = tile.baseX + tile.cellW / 2;
            let cy = tile.baseY + tile.cellH / 2;
            let ox = radius * Math.cos(angle);
            let oy = radius * Math.sin(angle);
            ctx3.save();
            ctx3.translate(cx + ox, cy + oy + Math.max(0, stackY));
            ctx3.rotate(angle);
            ctx3.translate(-cx, -cy);
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY, tile.cellW, tile.cellH);
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function stackFadeTrail3() {
    let frame = 0;
    function step() {
        ctx3.globalAlpha = 0.5;
        ctx3.fillStyle = '#222';
        ctx3.fillRect(0, 0, canvas3.width, canvas3.height);
        ctx3.globalAlpha = 1;
        tiles3.forEach(tile => {
            let stackY = frame * 6 - tile.col * 30;
            let alpha = 0.1 + 0.9 * Math.abs(Math.sin(frame * 0.09 + tile.row - tile.col));
            ctx3.save();
            ctx3.globalAlpha = alpha;
            ctx3.drawImage(tile.img, tile.baseX, tile.baseY + Math.max(0, stackY), tile.cellW, tile.cellH);
            ctx3.globalAlpha = 1;
            ctx3.restore();
        });
        frame++;
        animationFrameId3 = requestAnimationFrame(step);
    }
    if (animationFrameId3) cancelAnimationFrame(animationFrameId3);
    step();
}

function applyAnimatedArtEffect3(effect) {
    if (effect === 'spiralburst3') spiralBurstEffect3();
    else if (effect === 'pulse3') tilePulse3();
    else if (effect === 'twist3') tileTwist3();
    else if (effect === 'flash3') tileFlash3();
    else if (effect === 'orbit3') tileOrbit3();
    else if (effect === 'ripple3') tileRipple3();
    else if (effect === 'bounce3') tileBounce3();
    else if (effect === 'flip3') tileFlip3();
    else if (effect === 'scatter3') tileScatter3();
    else if (effect === 'glow3') tileGlow3();
    else if (effect === 'checker3') tileChecker3();
    else if (effect === 'zoom3') tileZoom3();
    else if (effect === 'fade3') tileFade3();
    else if (effect === 'trail3') tileTrail3();
    else if (effect === 'rainbow3') tileRainbow3();
    else if (effect === 'jitter3') tileJitter3();
    else if (effect === 'diamond3') tileDiamond3();
    else if (effect === 'wave3') tileWave3();
    else if (effect === 'spiral3') tileSpiral3();
    else if (effect === 'grid3') tileGrid3();
    else if (effect === 'fadetrail3') tileFadeTrail3();
    else if (effect === 'stackcascade3') stackCascade3();
    else if (effect === 'stackwave3') stackWave3();
    else if (effect === 'stackbounce3') stackBounce3();
    else if (effect === 'stackspiral3') stackSpiral3();
    else if (effect === 'stackfadetrail3') stackFadeTrail3();
}

export { setupEffects3, applyAnimatedArtEffect3 };
