// Modular Whiteboard Widget
(function(){
    // Create sidebar container
    const sidebar = document.createElement('div');
    sidebar.id = 'whiteboard-sidebar';
    sidebar.innerHTML = `
        <h2 style="font-size:13px;margin:4px 0 2px 0;padding:0;line-height:1.1;font-weight:normal;">Whiteboard</h2>
        <div id="whiteboard-instructions" style="font-size:10px;color:#fff;margin-bottom:4px;text-align:center;opacity:0.5;line-height:1.2;">Embed this widget by adding <code>&lt;script src='whiteboard-widget.js'&gt;&lt;/script&gt;</code> to your site. Minimal controls: draw, color, stickers, snapshot.</div>
        <canvas id="whiteboard-canvas" width="320" height="1200" style="margin-bottom:6px;"></canvas>
        <div id="whiteboard-controls">
            <input type="color" id="whiteboard-color" value="#222" title="Choose color" style="width:24px;height:24px;vertical-align:middle;">
            <button id="whiteboard-clear" style="padding:2px 7px;font-size:10px;">Clear</button>
            <button id="whiteboard-submit" style="padding:2px 7px;font-size:10px;">Save</button>
            <input type="file" id="whiteboard-sticker-upload" accept="image/*" style="display:none">
            <button id="whiteboard-add-sticker" style="padding:2px 7px;font-size:10px;">Sticker</button>
        </div>
        <div id="whiteboard-latest" style="font-size:10px;">
            <h4 style="font-size:11px;margin:6px 0 2px 0;">Snapshot</h4>
            <img id="whiteboard-latest-img" src="" alt="No snapshot yet" style="max-width:80px;max-height:50px;" />
            <div id="whiteboard-sticker-preview" style="margin-top:3px;"></div>
        </div>
        <small style="font-size:9px;opacity:0.4;">Board resets weekly.</small>
    `;
    document.body.appendChild(sidebar);

    // Add styles
    const style = document.createElement('style');
    style.innerHTML = `
        #whiteboard-sidebar {
            position: fixed;
            top: 0;
            right: 0;
            width: 350px;
            height: 100vh;
            background: #1a1a1a;
            box-shadow: -2px 0 8px rgba(255,0,0,0.2);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 20px 10px;
            z-index: 9999;
            border-left: 4px solid #c00;
        }
        #whiteboard-canvas {
            border: 2px solid #c00;
            background: #222;
            cursor: crosshair;
            width: 320px;
            height: calc(100vh - 180px);
            display: block;
            box-shadow: 0 0 12px #c00;
        }
        #whiteboard-controls {
            margin-top: 10px;
            display: flex;
            gap: 10px;
        }
        #whiteboard-controls button {
            background: #c00;
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            font-weight: bold;
            box-shadow: 0 2px 6px #0006;
            cursor: pointer;
            transition: background 0.2s;
        }
        #whiteboard-controls button:hover {
            background: #900;
        }
        #whiteboard-controls input[type="color"] {
            border: 2px solid #c00;
            background: #222;
        }
        #whiteboard-latest-img {
            margin-top: 20px;
            max-width: 320px;
            border: 2px solid #c00;
            background: #222;
            box-shadow: 0 0 8px #c00;
        }
        #whiteboard-sticker-preview img {
            border: 2px solid #c00;
            background: #222;
            box-shadow: 0 0 6px #c00;
        }
        #whiteboard-sidebar h2, #whiteboard-sidebar h4, #whiteboard-sidebar small {
            color: #c00;
            text-shadow: 0 1px 2px #000;
            font-weight: normal;
            margin: 0;
            padding: 0;
        }
    `;
    document.head.appendChild(style);

    // Whiteboard logic
    const canvas = document.getElementById('whiteboard-canvas');
    const ctx = canvas.getContext('2d');
    let drawing = false;
    let lastX, lastY;
    let currentColor = document.getElementById('whiteboard-color').value;
    let isStickerMode = false;
    let stickerImg = null;
    let stickers = [];
    let draggingSticker = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;

    document.getElementById('whiteboard-color').addEventListener('input', function(e) {
        currentColor = e.target.value;
    });

    function getRelativeCoords(e) {
        const rect = canvas.getBoundingClientRect();
        let x, y;
        if (e.touches && e.touches.length) {
            x = e.touches[0].clientX - rect.left;
            y = e.touches[0].clientY - rect.top;
        } else {
            x = e.clientX - rect.left;
            y = e.clientY - rect.top;
        }
        x *= canvas.width / rect.width;
        y *= canvas.height / rect.height;
        return { x, y };
    }

    function startDraw(e) {
        if (isStickerMode) return;
        drawing = true;
        const coords = getRelativeCoords(e);
        [lastX, lastY] = [coords.x, coords.y];
    }
    function draw(e) {
        if (!drawing || isStickerMode) return;
        const coords = getRelativeCoords(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        [lastX, lastY] = [coords.x, coords.y];
    }
    function endDraw() {
        drawing = false;
    }
    canvas.addEventListener('mousedown', startDraw);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseup', endDraw);
    canvas.addEventListener('mouseleave', endDraw);

    // Touch support
    canvas.addEventListener('touchstart', function(e) {
        if (isStickerMode) return;
        e.preventDefault();
        const coords = getRelativeCoords(e);
        lastX = coords.x;
        lastY = coords.y;
        drawing = true;
    });
    canvas.addEventListener('touchmove', function(e) {
        if (isStickerMode) return;
        e.preventDefault();
        if (!drawing) return;
        const coords = getRelativeCoords(e);
        ctx.beginPath();
        ctx.moveTo(lastX, lastY);
        ctx.lineTo(coords.x, coords.y);
        ctx.strokeStyle = currentColor;
        ctx.lineWidth = 2;
        ctx.stroke();
        lastX = coords.x;
        lastY = coords.y;
    });
    canvas.addEventListener('touchend', function(e) {
        drawing = false;
    });

    // Sticker upload logic
    document.getElementById('whiteboard-add-sticker').onclick = () => {
        document.getElementById('whiteboard-sticker-upload').click();
    };
    document.getElementById('whiteboard-sticker-upload').onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = function(ev) {
            stickerImg = new Image();
            stickerImg.src = ev.target.result;
            stickerImg.onload = function() {
                document.getElementById('whiteboard-sticker-preview').innerHTML = '';
                let thumb = document.createElement('img');
                thumb.src = stickerImg.src;
                thumb.style.width = '32px';
                thumb.style.height = '32px';
                document.getElementById('whiteboard-sticker-preview').appendChild(thumb);
                isStickerMode = true;
                canvas.style.cursor = 'pointer';
            };
        };
        reader.readAsDataURL(file);
    };
    canvas.addEventListener('click', function(e) {
        if (isStickerMode && stickerImg) {
            const coords = getRelativeCoords(e);
            stickers.push({
                src: stickerImg.src,
                x: coords.x - 16,
                y: coords.y - 16,
                w: 32,
                h: 32
            });
            isStickerMode = false;
            stickerImg = null;
            document.getElementById('whiteboard-sticker-preview').innerHTML = '';
            canvas.style.cursor = 'crosshair';
            redraw();
            saveBoard();
        }
    });
    canvas.addEventListener('mousedown', function(e) {
        if (isStickerMode) return;
        const coords = getRelativeCoords(e);
        const x = coords.x;
        const y = coords.y;
        for (let i = stickers.length - 1; i >= 0; i--) {
            const s = stickers[i];
            if (x >= s.x && x <= s.x + s.w && y >= s.y && y <= s.y + s.h) {
                draggingSticker = s;
                dragOffsetX = x - s.x;
                dragOffsetY = y - s.y;
                stickers.splice(i, 1);
                stickers.push(draggingSticker);
                break;
            }
        }
    });
    canvas.addEventListener('mousemove', function(e) {
        if (draggingSticker) {
            const coords = getRelativeCoords(e);
            const x = coords.x;
            const y = coords.y;
            draggingSticker.x = x - dragOffsetX;
            draggingSticker.y = y - dragOffsetY;
            redraw();
        }
    });
    canvas.addEventListener('mouseup', function(e) {
        if (draggingSticker) {
            draggingSticker = null;
            saveBoard();
        }
    });

    document.getElementById('whiteboard-clear').onclick = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        saveBoard();
    };

    function getWeekNumber(d) {
        d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
        var dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
        var weekNum = Math.ceil((((d - yearStart) / 86400000) + 1)/7);
        return weekNum;
    }
    function saveBoard() {
        localStorage.setItem('whiteboard', canvas.toDataURL());
        localStorage.setItem('whiteboard_week', getWeekNumber(new Date()));
    }
    function loadBoard() {
        const week = localStorage.getItem('whiteboard_week');
        const currentWeek = getWeekNumber(new Date());
        stickers = [];
        if (week != currentWeek) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            localStorage.removeItem('whiteboard');
            localStorage.setItem('whiteboard_week', currentWeek);
        } else {
            const data = localStorage.getItem('whiteboard');
            if (data) {
                let img = new Image();
                img.onload = () => {
                    ctx.clearRect(0, 0, canvas.width, canvas.height);
                    ctx.drawImage(img, 0, 0);
                };
                img.src = data;
            }
        }
    }
    loadBoard();

    canvas.addEventListener('mouseup', saveBoard);
    canvas.addEventListener('touchend', saveBoard);

    document.getElementById('whiteboard-submit').onclick = async () => {
        const dataUrl = canvas.toDataURL('image/png');
        const submitBtn = document.getElementById('whiteboard-submit');
        submitBtn.disabled = true;
        submitBtn.innerText = 'Uploading...';
        try {
            const res = await fetch('https://api.imgdrop.io/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json',
                },
                body: JSON.stringify({ image: dataUrl })
            });
            const json = await res.json();
            if (json.success && json.url) {
                document.getElementById('whiteboard-latest-img').src = json.url;
                localStorage.setItem('latest_snapshot', json.url);
            } else {
                alert('Upload failed: ' + (json.error || 'Unknown error'));
            }
        } catch (e) {
            alert('Error uploading: ' + e.message);
        }
        submitBtn.disabled = false;
        submitBtn.innerText = 'Save';
    };
    const latest = localStorage.getItem('latest_snapshot');
    if (latest) document.getElementById('whiteboard-latest-img').src = latest;
    function redraw() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (const s of stickers) {
            let sticker = new Image();
            sticker.src = s.src;
            ctx.drawImage(sticker, s.x, s.y, s.w, s.h);
        }
    }
})();
