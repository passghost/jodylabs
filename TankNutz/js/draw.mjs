// Drawing helpers extracted for modularization
export function drawImageCentered(ctx, spriteCanvas, x, y, angleRad=0, scale=1){ const w = spriteCanvas.width, h = spriteCanvas.height; ctx.save(); ctx.translate(x,y); ctx.rotate(angleRad); ctx.scale(scale,scale); ctx.translate(-w/2, -h/2); ctx.drawImage(spriteCanvas,0,0); ctx.restore(); }
export function drawImageCenteredFlipped(ctx, spriteCanvas, x, y, flipH=false, scale=1){ const w = spriteCanvas.width, h = spriteCanvas.height; ctx.save(); ctx.translate(x,y); if (flipH) ctx.scale(-1,1); ctx.scale(scale,scale); ctx.translate(-w/2, -h/2); ctx.drawImage(spriteCanvas,0,0); ctx.restore(); }
export function drawShadow(ctx, x, y, spriteW = 16, spriteScale = 2){
	const baseR = (spriteW * spriteScale * 0.45) || 8;
	const CLAMP_MAX = 56;
	const r = Math.max(6, Math.min(baseR, CLAMP_MAX));
	const sx = 1.2, sy = 0.5;
	ctx.save(); ctx.translate(x, y + Math.max(4, Math.round(r*0.12))); ctx.scale(sx, sy); ctx.beginPath(); ctx.arc(0,0, r, 0, Math.PI*2); ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fill(); ctx.restore();
}
