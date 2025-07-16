console.log("chat-bubbles.js loaded");
// Chat bubble functionality
function drawChatBubble(player) {
    const chatMessage = chatMessages.get(player.id);
    if (!chatMessage) return;

    // Remove old messages (after 5 seconds)
    if (Date.now() - chatMessage.timestamp > 5000) {
        chatMessages.delete(player.id);
        return;
    }

    const bubbleX = player.x + PLAYER_SIZE / 2;
    const bubbleY = player.y - 40;
    const text = chatMessage.text;

    // Measure text
    ctx.font = '12px Arial';
    const textWidth = ctx.measureText(text).width;
    const bubbleWidth = Math.min(textWidth + 16, 200);
    const bubbleHeight = 24;

    // Draw bubble background
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;

    // Bubble rectangle
    ctx.beginPath();
    ctx.roundRect(bubbleX - bubbleWidth / 2, bubbleY - bubbleHeight, bubbleWidth, bubbleHeight, 8);
    ctx.fill();
    ctx.stroke();

    // Bubble tail
    ctx.beginPath();
    ctx.moveTo(bubbleX - 5, bubbleY);
    ctx.lineTo(bubbleX, bubbleY + 8);
    ctx.lineTo(bubbleX + 5, bubbleY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Draw text
    ctx.fillStyle = '#333';
    ctx.textAlign = 'center';
    ctx.fillText(text, bubbleX, bubbleY - 8);
}

// Add roundRect polyfill for older browsers
if (!CanvasRenderingContext2D.prototype.roundRect) {
    CanvasRenderingContext2D.prototype.roundRect = function (x, y, width, height, radius) {
        this.beginPath();
        this.moveTo(x + radius, y);
        this.lineTo(x + width - radius, y);
        this.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.lineTo(x + width, y + height - radius);
        this.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.lineTo(x + radius, y + height);
        this.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.lineTo(x, y + radius);
        this.quadraticCurveTo(x, y, x + radius, y);
        this.closePath();
    };
}