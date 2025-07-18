const canvas = document.getElementById('gameCanvas');
canvas.width = 1920; // Set canvas width to 1920 for 1080p experience
canvas.height = 1080; // Set canvas height to 1080 for 1080p experience
const ctx = canvas.getContext('2d');

const skier = {
    x: canvas.width / 2 - 50,
    y: canvas.height / 2 - 50,
    width: 100,
    height: 100,
    speed: 16,
    vx: 0,
    vy: 0,
    image: null // We'll draw a simple rectangle instead
};

const snow = new Image();
snow.src = '/jodylabs/FlowerFall/grass.png'; // Use the correct path for GitHub Pages

const flowerImage = new Image();
flowerImage.src = '/jodylabs/FlowerFall/SF.png';

const flowerImage2 = new Image();
flowerImage2.src = '/jodylabs/FlowerFall/F2.png';

const heartImage = null; // We'll draw simple hearts instead

const imagesLoaded = {
    skier: true, // No longer loading external skier image
    snow: false,
    flower: false,
    flower2: false,
    heart: true // No longer loading external heart image
};

snow.onload = () => {
    imagesLoaded.snow = true;
    console.log('Snow image loaded');
    startGameIfReady();
};
snow.onerror = () => {
    console.error('Failed to load snow image.');
};

flowerImage.onload = () => {
    imagesLoaded.flower = true;
    console.log('Flower image loaded');
    startGameIfReady();
};
flowerImage.onerror = () => {
    console.error('Failed to load flower image.');
};

flowerImage2.onload = () => {
    imagesLoaded.flower2 = true;
    console.log('Second flower image loaded');
    startGameIfReady();
};
flowerImage2.onerror = () => {
    console.error('Failed to load second flower image.');
};

function startGameIfReady() {
    if (imagesLoaded.skier && imagesLoaded.snow && imagesLoaded.flower && imagesLoaded.flower2 && imagesLoaded.heart) {
        console.log('All images loaded, starting game...');
        update(); // Start the game loop once all images are loaded
    }
}

const flowers = [];
const hearts = [];
const flowerFrequency = 5; // Increased frequency for more flowers
const heartFrequency = 100; // Frequency for hearts
let frameCount = 0;
let snowY = 0;
let score = 0;

function drawSkier() {
    // Draw a simple blue rectangle for the skier
    ctx.fillStyle = '#0088ff';
    ctx.fillRect(skier.x, skier.y, skier.width, skier.height);
    
    // Add a simple face
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(skier.x + 20, skier.y + 20, 20, 20); // Left eye
    ctx.fillRect(skier.x + 60, skier.y + 20, 20, 20); // Right eye
    ctx.fillRect(skier.x + 30, skier.y + 60, 40, 10); // Mouth
}

function createFlowers() {
    const pathCenter1 = canvas.width / 4 + Math.sin(frameCount / 50) * 100;
    const pathCenter2 = (3 * canvas.width) / 4 + Math.sin(frameCount / 50 + Math.PI) * 100;
    const pathCenter3 = canvas.width / 2 + Math.sin(frameCount / 50 + Math.PI / 2) * 100;

    const pathWidth = 175; // Further increased path width
    const minDistance = 200; // Minimum distance between paths

    while (flowers.length < 200) {
        const flowerSize = Math.random() * 200 + 50; // Slightly increased maximum scale
        const x = Math.random() * canvas.width;
        const y = canvas.height + Math.random() * canvas.height; // Start flowers off-screen

        // Check if the flower is within any of the paths
        const inPath1 = x > pathCenter1 - pathWidth / 2 && x < pathCenter1 + pathWidth / 2;
        const inPath2 = x > pathCenter2 - pathWidth / 2 && x < pathCenter2 + pathWidth / 2;
        const inPath3 = x > pathCenter3 - pathWidth / 2 && x < pathCenter3 + pathWidth / 2;

        // Ensure paths don't get too close
        const distance1 = Math.abs(pathCenter1 - pathCenter2);
        const distance2 = Math.abs(pathCenter2 - pathCenter3);
        const distance3 = Math.abs(pathCenter1 - pathCenter3);

        if (!inPath1 && !inPath2 && !inPath3 && distance1 > minDistance && distance2 > minDistance && distance3 > minDistance) {
            flowers.push({ x, y, width: flowerSize, height: flowerSize });
        }
    }
}

function createHearts() {
    const pathCenter1 = canvas.width / 4 + Math.sin(frameCount / 100) * 100;
    const pathCenter2 = (3 * canvas.width) / 4 + Math.sin(frameCount / 100 + Math.PI) * 100;
    const pathCenter3 = canvas.width / 2 + Math.sin(frameCount / 100 + Math.PI / 2) * 100;

    const pathWidth = 100; // Narrower path width for less intersection

    hearts.length = 0;

    for (let i = 0; i < canvas.width; i += 120) {
        if ((i > pathCenter1 - pathWidth / 2 && i < pathCenter1 + pathWidth / 2) ||
            (i > pathCenter2 - pathWidth / 2 && i < pathCenter2 + pathWidth / 2) ||
            (i > pathCenter3 - pathWidth / 2 && i < pathCenter3 + pathWidth / 2)) {
            const size = Math.random() < 0.33 ? 20 : Math.random() < 0.5 ? 40 : 60;
            const points = size === 20 ? 10 : size === 40 ? 25 : 50;
            hearts.push({ x: i, y: canvas.height + Math.random() * canvas.height, width: size * 1.5, height: size, points: points });
        }
    }
}

function drawFlowers() {
    flowers.forEach((flower, index) => {
        const flowerImageToUse = index % 3 === 0 ? flowerImage2 : flowerImage; // Use the new flower image for 1/3 of the flowers
        ctx.drawImage(flowerImageToUse, flower.x, flower.y, flower.width, flower.height);
        flower.y -= skier.speed; // Move flowers vertically

        if (flower.y + flower.height < 0) {
            flower.y = canvas.height + Math.random() * canvas.height; // Reset flower position to off-screen
        }
    });
}

function drawHearts() {
    hearts.forEach((heart, index) => {
        // Draw a simple red heart shape
        ctx.fillStyle = '#ff0000';
        
        // Simple heart shape using circles and triangle
        const centerX = heart.x + heart.width / 2;
        const centerY = heart.y + heart.height / 2;
        const size = heart.width / 4;
        
        // Two circles for the top of the heart
        ctx.beginPath();
        ctx.arc(centerX - size/2, centerY - size/2, size/2, 0, Math.PI * 2);
        ctx.arc(centerX + size/2, centerY - size/2, size/2, 0, Math.PI * 2);
        ctx.fill();
        
        // Triangle for the bottom of the heart
        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY);
        ctx.lineTo(centerX + size, centerY);
        ctx.lineTo(centerX, centerY + size);
        ctx.closePath();
        ctx.fill();
        
        heart.y -= skier.speed;

        if (heart.y + heart.height < 0) {
            hearts.splice(index, 1);
        }
    });
}

function checkCollision() {
    const skierCollider = {
        x: skier.x + skier.width / 4,
        y: skier.y + skier.height / 4,
        width: skier.width / 4, // Halved the width
        height: skier.height / 4 // Halved the height
    };

    for (let i = 0; i < flowers.length; i++) {
        const flower = flowers[i];
        const flowerCollider = {
            x: flower.x + flower.width / 4,
            y: flower.y + flower.height / 4,
            width: flower.width / 2,
            height: flower.height / 2
        };
        if (
            skierCollider.x < flowerCollider.x + flowerCollider.width &&
            skierCollider.x + skierCollider.width > flowerCollider.x &&
            skierCollider.y < flowerCollider.y + flowerCollider.height &&
            skierCollider.y + skierCollider.height > flowerCollider.y
        ) {
            alert('Game Over! Your score: ' + score);
            document.location.reload();
        }
    }

    for (let i = 0; i < hearts.length; i++) {
        const heart = hearts[i];
        const heartCollider = {
            x: heart.x,
            y: heart.y,
            width: heart.width,
            height: heart.height
        };
        if (
            skierCollider.x < heartCollider.x + heartCollider.width &&
            skierCollider.x + skierCollider.width > heartCollider.x &&
            skierCollider.y < heartCollider.y + heartCollider.height &&
            skierCollider.y + skierCollider.height > heartCollider.y
        ) {
            score += heart.points;
            hearts.splice(i, 1);
            i--;
        }
    }
}

function clearCanvas() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function drawBackground() {
    ctx.drawImage(snow, 0, snowY, canvas.width, canvas.height);
    ctx.drawImage(snow, 0, snowY + canvas.height, canvas.width, canvas.height);
    snowY -= skier.speed;
    if (snowY <= -canvas.height) {
        snowY = 0;
    }
}

function drawScore() {
    ctx.font = '40px Arial';
    ctx.fillStyle = 'white'; // Changed score color to white
    ctx.fillText('Score: ' + score, 20, 40);

    // Add indicator text
    ctx.font = '20px Arial';
    ctx.fillText('Use arrow keys to move', 20, 80);
}


function update() {
    clearCanvas();
    drawBackground();
    drawFlowers();
    drawHearts();
    drawSkier();
    drawScore();
    checkCollision();

    // Update skier position
    skier.x += skier.vx;
    skier.y += skier.vy;

    // Keep skier within canvas bounds
    skier.x = Math.max(0, Math.min(canvas.width - skier.width, skier.x));
    skier.y = Math.max(0, Math.min(canvas.height - skier.height, skier.y));

    frameCount++;
    score = Math.floor(frameCount / 10); // Update score based on distance traveled

    if (frameCount % flowerFrequency === 0) {
        createFlowers();
    }

    if (frameCount % heartFrequency === 0) {
        createHearts();
    }

    requestAnimationFrame(update);
}

function moveSkier(event) {
    switch (event.key) {
        case 'ArrowUp':
            skier.vy = -skier.speed;
            break;
        case 'ArrowDown':
            skier.vy = skier.speed;
            break;
        case 'ArrowLeft':
            skier.vx = -skier.speed;
            break;
        case 'ArrowRight':
            skier.vx = skier.speed;
            break;
    }
}

function stopSkier(event) {
    switch (event.key) {
        case 'ArrowUp':
        case 'ArrowDown':
            skier.vy = 0;
            break;
        case 'ArrowLeft':
        case 'ArrowRight':
            skier.vx = 0;
            break;
    }
}

window.addEventListener('keydown', moveSkier);
window.addEventListener('keyup', stopSkier);
