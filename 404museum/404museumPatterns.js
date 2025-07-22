// 404museumPatterns.js
// Minimal generative art pattern for 404Museum demo

export function showGenerativeArt(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let t = 0;
    let animationId;

    function draw() {
        ctx.clearRect(0, 0, w, h);
        // Background gradient (drawn once, not every frame)
        ctx.globalAlpha = 1;
        ctx.fillStyle = ctx.createLinearGradient(0, 0, w, h);
        ctx.fillStyle.addColorStop?.(0, '#4ecdc4');
        ctx.fillStyle.addColorStop?.(1, '#ff6b6b');
        ctx.fillRect(0, 0, w, h);

        // Generative sine waves (reduced to 3, no shadowBlur)
        for (let i = 0; i < 3; i++) {
            ctx.beginPath();
            for (let x = 0; x <= w; x += 3) {
                const y = h/2 + Math.sin((x/40) + t + i) * (30 + i*8) + Math.cos((x/30) - t/2 + i) * (12 + i*4);
                if (x === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.strokeStyle = `rgba(255,255,255,${0.18 + i*0.18})`;
            ctx.lineWidth = 1.5 + i;
            ctx.shadowBlur = 0;
            ctx.stroke();
        }
        t += 0.03;
        animationId = requestAnimationFrame(draw);
    }

    // Cancel any previous animation
    if (canvas._genArtAnim) cancelAnimationFrame(canvas._genArtAnim);
    canvas._genArtAnim = animationId;
    draw();
}

// Pattern 2: Particle System
export function showParticleArt(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let t = 0;
    let animationId;
    const particles = Array.from({length: 40}, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 1.2,
        vy: (Math.random() - 0.5) * 1.2,
        r: 2 + Math.random() * 2
    }));
    function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        // Draw all particles in one path for better batching
        ctx.save();
        ctx.shadowBlur = 0;
        for (let p of particles) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(78,205,196,0.7)`;
            ctx.fill();
            p.x += p.vx;
            p.y += p.vy;
            if (p.x < 0 || p.x > w) p.vx *= -1;
            if (p.y < 0 || p.y > h) p.vy *= -1;
        }
        ctx.restore();
        // Draw lines between close particles (limit to 30 lines for perf)
        let lines = 0;
        for (let i = 0; i < particles.length; i++) {
            for (let j = i + 1; j < particles.length; j++) {
                if (lines > 30) break;
                const a = particles[i], b = particles[j];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                if (dist < 60) {
                    ctx.beginPath();
                    ctx.moveTo(a.x, a.y);
                    ctx.lineTo(b.x, b.y);
                    ctx.strokeStyle = `rgba(255,255,255,${1 - dist/60})`;
                    ctx.lineWidth = 1;
                    ctx.stroke();
                    lines++;
                }
            }
        }
        t += 0.012;
        animationId = requestAnimationFrame(draw);
    }
    if (canvas._genArtAnim) cancelAnimationFrame(canvas._genArtAnim);
    canvas._genArtAnim = animationId;
    draw();
}

// Pattern 3: Fractal Tree
export function showFractalTree(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let t = 0;
    let animationId;
    function drawTree(x, y, angle, depth) {
        if (depth === 0) return;
        const len = 54 * Math.pow(0.7, 6 - depth) + Math.sin(t + depth) * 5;
        const x2 = x + Math.cos(angle) * len;
        const y2 = y + Math.sin(angle) * len;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `hsl(${120 + depth*30}, 80%, 60%)`;
        ctx.lineWidth = depth - 0.5;
        ctx.stroke();
        drawTree(x2, y2, angle - 0.38 + Math.sin(t)/10, depth - 1);
        drawTree(x2, y2, angle + 0.38 - Math.cos(t)/10, depth - 1);
    }
    function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.save();
        ctx.translate(w/2, h-20);
        drawTree(0, 0, -Math.PI/2, 5);
        ctx.restore();
        t += 0.025;
        animationId = requestAnimationFrame(draw);
    }
    if (canvas._genArtAnim) cancelAnimationFrame(canvas._genArtAnim);
    canvas._genArtAnim = animationId;
    draw();
}

// Pattern 4: Neon Grid
export function showNeonGrid(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let t = 0;
    let animationId;
    function draw() {
        ctx.clearRect(0, 0, w, h);
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, w, h);
        const gridSize = 48;
        ctx.save();
        ctx.shadowBlur = 0;
        for (let x = 0; x < w; x += gridSize) {
            for (let y = 0; y < h; y += gridSize) {
                ctx.save();
                ctx.translate(x + gridSize/2, y + gridSize/2);
                ctx.rotate(Math.sin(t + x/100 + y/100) * 0.4);
                ctx.strokeStyle = `hsl(${(t*60 + x + y)%360}, 100%, 60%)`;
                ctx.lineWidth = 1.5;
                ctx.strokeRect(-gridSize/2, -gridSize/2, gridSize, gridSize);
                ctx.restore();
            }
        }
        ctx.restore();
        t += 0.025;
        animationId = requestAnimationFrame(draw);
    }
    if (canvas._genArtAnim) cancelAnimationFrame(canvas._genArtAnim);
    canvas._genArtAnim = animationId;
    draw();
}

// Pattern 5: Plasma Field
export function showPlasmaField(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let t = 0;
    let animationId;
    function draw() {
        ctx.clearRect(0, 0, w, h);
        // Increase step for fewer rects
        for (let y = 0; y < h; y += 8) {
            for (let x = 0; x < w; x += 8) {
                const v = Math.sin(x/30 + t) + Math.cos(y/20 - t) + Math.sin((x+y)/40 + t/2);
                const c = Math.floor(128 + 127 * Math.sin(v));
                ctx.fillStyle = `rgb(${c},${255-c},${200})`;
                ctx.fillRect(x, y, 8, 8);
            }
        }
        t += 0.055;
        animationId = requestAnimationFrame(draw);
    }
    if (canvas._genArtAnim) cancelAnimationFrame(canvas._genArtAnim);
    canvas._genArtAnim = animationId;
    draw();
}


// Pattern 6: Orbitals Art (Animated orbiting circles)
export function showOrbitalsArt(canvas) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    let t = 0;
    let animationId;
    const centerX = w / 2;
    const centerY = h / 2;
    const orbs = 8;
    const radii = [60, 90, 130, 170];
    function draw() {
        ctx.clearRect(0, 0, w, h);
        // Background
        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, w, h);
        // Draw orbits
        for (let r = 0; r < radii.length; r++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radii[r], 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(78,205,196,0.12)`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
        // Draw orbiting circles
        for (let i = 0; i < orbs; i++) {
            for (let r = 0; r < radii.length; r++) {
                const angle = t * (0.7 + r*0.13) + (i * (Math.PI * 2 / orbs)) + r;
                const x = centerX + Math.cos(angle) * radii[r];
                const y = centerY + Math.sin(angle) * radii[r];
                ctx.beginPath();
                ctx.arc(x, y, 10 - r*1.5, 0, Math.PI * 2);
                ctx.fillStyle = `hsl(${(t*60 + i*40 + r*60)%360}, 100%, 60%)`;
                ctx.globalAlpha = 0.7 - r*0.12;
                ctx.fill();
            }
        }
        ctx.globalAlpha = 1;
        t += 0.018;
        animationId = requestAnimationFrame(draw);
    }
    if (canvas._genArtAnim) cancelAnimationFrame(canvas._genArtAnim);
    canvas._genArtAnim = animationId;
    draw();
}

// Optional fallback label for missing patterns
export function fallbackLabel(canvas, label) {
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#222';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = 'bold 32px Orbitron, monospace';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label || 'Art Pattern', canvas.width/2, canvas.height/2);
}
