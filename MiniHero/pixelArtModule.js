export function createPixelArt(containerId) {
    try {
    const container = document.getElementById(containerId);
    if (!container) {
        console.error(`Container with id "${containerId}" not found.`);
        return;
    }

    // Add styles dynamically (if not already present)
    if (!document.getElementById('pixel-art-style')) {
        const style = document.createElement('style');
        style.id = 'pixel-art-style';
        style.textContent = `
            body {
                display: flex;
                justify-content: center;
                align-items: center;
                height: 100vh;
                margin: 0;
                background-color: #333;
            }
            .pixel-art {
                display: grid;
                grid-template-columns: repeat(16, 20px);
                grid-template-rows: repeat(16, 20px);
                animation: axe-slam 1s infinite;
                position: relative;
                /* border: 1px solid lime; */
            }
            .pixel {
                width: 20px;
                height: 20px;
                background-color: transparent;
            }
            .white { background-color: #ffffff; }
            .gray { background-color: #888888; }
            .black { background-color: #000000; }
            .red { background-color: #ff0000; }
            .blue { background-color: #0000ff; }
            .brown { background-color: #8b4513; }
            .skin { background-color: #f1c27d; }
            @keyframes axe-slam {
                0% { transform: rotate(0deg) translateY(0); }
                50% { transform: rotate(45deg) translateY(-10px); }
                100% { transform: rotate(0deg) translateY(0); }
            }
            .axe-art {
                position: absolute;
                top: 15%;
                left: 53%;
                transform: translate(-50%, -50%) scale(0.8);
                display: grid;
                grid-template-columns: repeat(16, 20px);
                grid-template-rows: repeat(16, 20px);
                animation: axe-slam 1s infinite;
                pointer-events: none;
                /* border: 1px solid yellow; */
            }
            .container {
                position: relative;
            }
        `;
        document.head.appendChild(style);
    }

    // Create container div
    const mainContainer = document.createElement('div');
    mainContainer.className = 'container';

    // Create pixel-art div
    const pixelArt = document.createElement('div');
    pixelArt.className = 'pixel-art';
    pixelArt.style.width = '32px';
    pixelArt.style.height = '32px';

    // Axe-art structure (copied from HTML)
    const axeArt = document.createElement('div');
    axeArt.className = 'axe-art';
    axeArt.style.gridTemplateColumns = 'repeat(16, 2px)';
    axeArt.style.gridTemplateRows = 'repeat(16, 2px)';
    axeArt.style.left = 'calc(50% - 10px)'; // Move axe 10px to the left
    axeArt.style.top = '0%';   // Move axe to the top of the character
    axeArt.style.transform = 'translate(-50%, 0%) scale(0.7)'; // Reduce scale for tightness
    const axePixels = [
        // Row 1
        ['', '', '', '', '', 'gray', 'gray', 'gray', '', '', '', '', '', '', '', ''],
        // Row 2
        ['', '', '', '', 'gray', 'gray', 'gray', 'gray', 'gray', '', '', '', '', '', '', ''],
        // Row 3
        ['', '', '', 'gray', 'gray', 'gray', 'gray', 'gray', 'gray', 'gray', '', '', '', '', '', ''],
        // Row 4
        ['', '', 'gray', 'gray', 'gray', 'gray', 'gray', 'gray', 'gray', '', '', '', '', '', '', ''],
        // Row 5
        ['', 'gray', 'gray', 'gray', 'gray', 'gray', 'gray', 'gray', '', '', '', '', '', '', '', ''],
        // Row 6
        ['', '', '', '', '', '', 'brown', 'brown', '', '', '', '', '', '', '', ''],
        // Row 7
        ['', '', '', '', '', '', 'brown', 'brown', '', '', '', '', '', '', '', ''],
        // Row 8
        ['', '', '', '', '', '', 'brown', 'brown', '', '', '', '', '', '', '', '']
    ];
    axePixels.forEach(row => {
        row.forEach(color => {
            const div = document.createElement('div');
            div.className = 'pixel';
            div.style.width = '2px';
            div.style.height = '2px';
            if (color) div.classList.add(color);
            axeArt.appendChild(div);
        });
    });

    // Character container for scaling
    const charContainer = document.createElement('div');
    charContainer.style.width = '32px';
    charContainer.style.height = '32px';
    charContainer.style.position = 'absolute';
    charContainer.style.left = '0';
    charContainer.style.top = '0';
    charContainer.style.transform = 'scale(0.8)';
    charContainer.style.transformOrigin = 'top left';
    charContainer.style.display = 'grid';
    charContainer.style.gridTemplateColumns = 'repeat(16, 2px)';
    charContainer.style.gridTemplateRows = 'repeat(16, 2px)';

    // Character structure (copied from HTML)
    const charPixels = [
        // Row 1
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        // Row 2
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        // Row 3
        ['', '', '', '', '', '', '', 'white', 'white', 'white', '', '', '', '', '', ''],
        // Row 4
        ['', '', '', '', '', 'skin', 'skin', 'white', 'white', 'white', 'skin', 'skin', '', '', '', ''],
        // Row 5
        ['', '', '', '', 'skin', 'skin', 'skin', 'skin', 'skin', 'skin', 'skin', 'skin', '', '', '', ''],
        // Row 6
        ['', '', '', '', '', 'skin', 'skin', 'gray', 'gray', 'gray', 'skin', 'skin', '', '', '', ''],
        // Row 7
        ['', '', '', '', '', 'blue', 'blue', 'gray', 'gray', 'gray', 'blue', 'blue', '', '', '', ''],
        // Row 8
        ['', '', '', '', 'blue', 'blue', 'blue', 'gray', 'gray', 'gray', 'blue', 'blue', 'blue', '', '', ''],
        // Row 9
        ['', '', '', '', '', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', 'blue', '', '', '', ''],
        // Row 10
        ['', '', '', '', '', '', '', 'brown', 'brown', 'brown', 'brown', 'brown', '', '', '', ''],
        // Row 11
        ['', '', '', '', '', '', '', 'brown', 'brown', 'brown', 'brown', 'brown', '', '', '', ''],
        // Row 12
        ['', '', '', '', '', '', '', 'brown', 'brown', 'brown', 'brown', 'brown', '', '', '', ''],
        // Row 13
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        // Row 14
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        // Row 15
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
        // Row 16
        ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '']
    ];
    charPixels.forEach(row => {
        row.forEach(color => {
            const div = document.createElement('div');
            div.className = 'pixel';
            div.style.width = '2px';
            div.style.height = '2px';
            if (color) div.classList.add(color);
            charContainer.appendChild(div);
        });
    });
    pixelArt.appendChild(charContainer);

    // Remove any previously appended character pixels (if any)
    while (pixelArt.firstChild) {
        pixelArt.removeChild(pixelArt.firstChild);
    }
    // Add axe-art and character container
    pixelArt.appendChild(axeArt);
    pixelArt.appendChild(charContainer);

    mainContainer.appendChild(pixelArt);
    container.appendChild(mainContainer);
    } catch (error) {
        console.error('❌ Error creating pixel art:', error);
    }
}
