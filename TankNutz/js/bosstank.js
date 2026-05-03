// Boss Tank module (circular armored boss) derived from tankboss1.html
// Provides spawnBossTank(x,y,opts,enemies) and attachBossIfNeeded(ent)
// Lightweight adaptation: converts per-pixel radial shader into two layered canvases:
//  - body (static frame with slow rim rotation baked every few seconds)
//  - turret (barrel rotation updated each frame via ent.turretAngle)
// For performance we approximate original animation (rim light + hazard ring scroll)
// with time-based angle inputs each draw rather than regenerating full 128x128 field

/* eslint-disable no-console */

/* Usage Notes (bosstank)
	 Independent Boss Entity (no shared logic with kittytank):
		- Fixed hit system: maxHp=15, hp decrements by 1 ONLY from direct player bullet hits (collisions, hazards, ally fire do not reduce boss hp).
	 - Health bar: draws above boss; color shifts green -> yellow -> red as hp lowers.
	 Spawn: spawnBossTank(x,y,{ spd? }, enemiesArray)  (opts.hp ignored intentionally to keep 15-hit design consistent)
	 Movement: ent.baseSpd = triple of provided spd (default 40). ent.spd scales with distance:
		 * <=120px: ~0.6x base (close orbit/pressure)
		 * 120-400px: eased interpolation
		 * >=400px: 3.0x base (rapid chase)
	 Angle: ent.angle steers body toward player continuously; turretAngle refreshed every 80ms toward player.
	 Firing: Salvo every ent.fireInterval (default 1400ms), 5-shot fan spread.
	 Contact Damage: Overlap drains 1 player heart per 1000ms (ent._lastContactHit cooldown).
	 Run-over Immunity: Collision with player tank bumps player; boss not killed or scored.
	 Tuning Fields: ent.fireInterval, ent.baseSpd, distance bands (near=120/far=400), speed multipliers (minMul/maxMul inside updateBoss).
*/

const BOSS_SCALE = 0.5; // scale 128px internal art down to 64 for parity with others
const INTERNAL_SIZE = 128; // logical grid
const BODY_RAD = 50; // match original outer radius

// Precompute radius + angle tables once
const _R = new Float32Array(INTERNAL_SIZE * INTERNAL_SIZE);
const _A = new Float32Array(INTERNAL_SIZE * INTERNAL_SIZE);
const CX = INTERNAL_SIZE/2; const CY = INTERNAL_SIZE/2;
for (let y=0;y<INTERNAL_SIZE;y++){
	for (let x=0;x<INTERNAL_SIZE;x++){
		const dx = x - CX + 0.5;
		const dy = y - CY + 0.5;
		const i = y*INTERNAL_SIZE + x;
		_R[i] = Math.hypot(dx,dy);
		_A[i] = Math.atan2(dy,dx);
	}
}

// Palette subset (lifted from tankboss1.html)
const PAL = {
	outline:'#091018', hull0:'#1a222b', hull1:'#242c38', hull2:'#2e3947', hull3:'#3b4758', hull4:'#4b5a6f',
	steel0:'#424a56', steel1:'#5c6772', steel2:'#7a8693', steel3:'#a1adba', rim:'#9fb9d8',
	glowA:'#9fe3ff', glowB:'#78d8ff', glowG:'#7bf4b3', hazard:'#f0c04a', hazardD:'#7a4e19', redA:'#cb4a4a'
};
const HULL_RAMP = [PAL.hull0,PAL.hull1,PAL.hull2,PAL.hull3,PAL.hull4];
const STEEL_RAMP = [PAL.steel0,PAL.steel1,PAL.steel2,PAL.steel3];

// Radii (subset)
const R_OUT=50,R_HULLI=46,R_PLATE=42,R_HAZ_O=36,R_HAZ_I=30,R_TUR=20,R_COLLO=18,R_COLLI=16,R_CORE=8;

function clamp(v,lo,hi){ return v<lo?lo:v>hi?hi:v; }
function mixHex(c1,c2,t){ const n1=parseInt(c1.slice(1),16), n2=parseInt(c2.slice(1),16); const r1=n1>>16&255,g1=n1>>8&255,b1=n1&255; const r2=n2>>16&255,g2=n2>>8&255,b2=n2&255; const r=(r1+(r2-r1)*t)|0,g=(g1+(g2-g1)*t)|0,b=(b1+(b2-b1)*t)|0; return '#'+((1<<24)|(r<<16)|(g<<8)|b).toString(16).slice(1); }
function smoothStep(a,b,x){ const t=clamp((x-a)/(b-a),0,1); return t*t*(3-2*t); }
function near(r,target,tol){ return Math.abs(r-target)<=tol; }

// Body renderer (dynamic each frame). Transparent background.
function renderBossBody(g, t){
	const W=INTERNAL_SIZE, H=INTERNAL_SIZE; const ts=(t||performance.now())*0.001; const rimAngle = ts*0.4; const rimCos=Math.cos(rimAngle), rimSin=Math.sin(rimAngle); const hazardShift = ts*1.2;
	g.clearRect(0,0,W,H); // transparent
	for (let y=0;y<H;y++){
		for (let x=0;x<W;x++){
			const i=y*W+x; const r=_R[i]; if (r>R_OUT+0.5) continue; const a=_A[i]; let col=null;
			if (near(r,R_OUT,0.65)) col=PAL.outline; else if (r>R_HULLI){ const tH=smoothStep(R_OUT,R_HULLI,r); const idx=Math.floor(tH*(HULL_RAMP.length-1)); let base=HULL_RAMP[idx]; const rimTint=clamp(((x-CX+0.5)/ (r||1))*rimCos + ((y-CY+0.5)/(r||1))*rimSin,0,1)*0.55; col=mixHex(base,PAL.rim,rimTint); }
			else if (r>R_PLATE){ const tH=smoothStep(R_HULLI,R_PLATE,r); let base=HULL_RAMP[Math.floor(tH*(HULL_RAMP.length-1))]; col=base; }
			else if (r>R_HAZ_O){ const tS=smoothStep(R_PLATE,R_HAZ_O,r); let base=STEEL_RAMP[Math.floor(tS*(STEEL_RAMP.length-1))]; col=base; }
			else if (r>R_HAZ_I){ const ang01=(a+Math.PI)/(2*Math.PI); const stripe = Math.floor(((ang01 + hazardShift*0.05)*32)+Math.floor(r*0.35)) & 1; let hz=stripe?PAL.hazard:PAL.hazardD; col=hz; }
			else if (r>R_TUR){ const tIn=smoothStep(R_HAZ_I,R_TUR,r); col=STEEL_RAMP[Math.floor(tIn*(STEEL_RAMP.length-1))]; }
			else if (r>R_COLLO){ let tC=smoothStep(R_TUR,R_COLLO,r); let c=STEEL_RAMP[Math.floor(tC*(STEEL_RAMP.length-1))]; const ig=clamp((R_COLLO-r)/(R_COLLO-R_COLLI+1e-4),0,1); c=mixHex(c,PAL.glowG,ig*0.1); col=c; }
			else { const gmix=clamp((R_COLLI-r)/(R_COLLI-R_CORE+1e-4),0,1); const glass=mixHex(PAL.glowB,PAL.glowG,0.4); const glass2=mixHex(glass,PAL.glowA,0.5); let c=mixHex(PAL.hull2,glass2,gmix*0.8); if (near(r,R_CORE,0.7)) c=PAL.outline; col=c; }
			if (col){ g.fillStyle=col; g.fillRect(x,y,1,1); }
		}
	}
	// simple ring outlines
	g.fillStyle=PAL.outline;
	for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const r=_R[y*W+x]; if (near(r,R_PLATE,0.55)||near(r,R_HAZ_O,0.45)||near(r,R_HAZ_I,0.45)||near(r,R_TUR,0.5)||near(r,R_COLLO,0.45)||near(r,R_COLLI,0.45)||near(r,R_CORE,0.6)) g.fillRect(x,y,1,1); }
}

// Turret renderer: separate canvas; barrel rotated per ent.turretAngle
function renderBossTurret(g, angleRad){
	const W=INTERNAL_SIZE, H=INTERNAL_SIZE; g.clearRect(0,0,W,H);
	// reuse some body region (turret base): draw circle R_TUR and barrel line
	g.fillStyle=PAL.steel2; g.beginPath(); g.arc(CX,CY,R_TUR,0,Math.PI*2); g.fill();
	g.strokeStyle=PAL.outline; g.lineWidth=2; g.beginPath(); g.arc(CX,CY,R_TUR,0,Math.PI*2); g.stroke();
	// barrel
	const len=28; const bw=6; const dx=Math.cos(angleRad), dy=Math.sin(angleRad);
	g.strokeStyle=PAL.steel3; g.lineWidth=bw; g.lineCap='round'; g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX+dx*len, CY+dy*len); g.stroke();
	g.strokeStyle=PAL.outline; g.lineWidth=2; g.beginPath(); g.moveTo(CX, CY); g.lineTo(CX+dx*len, CY+dy*len); g.stroke();
	// muzzle tip highlight
	g.fillStyle=PAL.steel3; g.beginPath(); g.arc(CX+dx*len, CY+dy*len, 3,0,Math.PI*2); g.fill();
}

function ensureBossCanvases(ent){
	if (!ent._boss) ent._boss = {};
	const store = ent._boss;
	if (!store.bodyC){ const c=document.createElement('canvas'); c.width=INTERNAL_SIZE; c.height=INTERNAL_SIZE; store.bodyC=c; renderBossBody(c.getContext('2d')); }
	if (!store.turC){ const c=document.createElement('canvas'); c.width=INTERNAL_SIZE; c.height=INTERNAL_SIZE; store.turC=c; }
}

// Extra details reused from original spec
function drawRingOutlineTo(g, radius, tol){
	const W=INTERNAL_SIZE,H=INTERNAL_SIZE; g.fillStyle=PAL.outline; for (let y=0;y<H;y++) for (let x=0;x<W;x++){ const r=_R[y*W+x]; if (near(r,radius,tol)) g.fillRect(x,y,1,1); }
}
function drawRivetsTo(g, radius, n){
	for (let k=0;k<n;k++){ const a=(k/n)*Math.PI*2; const x=Math.round(CX+Math.cos(a)*radius); const y=Math.round(CY+Math.sin(a)*radius); g.fillStyle=PAL.steel2; g.fillRect(x,y,1,1); }
}
function drawLEDsTo(g, radius, n, t){
	for (let k=0;k<n;k++){ const a=(k/n)*Math.PI*2; const pulse=0.5+0.5*Math.sin(t*0.003*3 + k*0.6); const on=pulse>0.6; const x=Math.round(CX+Math.cos(a)*radius); const y=Math.round(CY+Math.sin(a)*radius); g.fillStyle=on?PAL.redA:PAL.hull2; g.fillRect(x,y,1,1); if (on){ const gx=Math.round(CX+Math.cos(a)*(radius-1)); const gy=Math.round(CY+Math.sin(a)*(radius-1)); g.fillStyle=PAL.glowA; g.fillRect(gx,gy,1,1); } }
}

function drawBoss(ent, ctx, worldToScreen, camera){
	if (!ent || !ctx) return;
	ensureBossCanvases(ent);
	const bodyC = ent._boss.bodyC; const turC = ent._boss.turC;
	const scale = (camera && camera.zoom || 1) * BOSS_SCALE;
	// Lazy-load Kris/dialogue portrait (single random tile from 3x3 grid) once per boss entity
	try{
		if (!ent._boss.krisTile){
			let src;
			try{
				if (typeof window !== 'undefined'){
					const cand = [];
					if (Array.isArray(window.dialoguePortraits)) cand.push(...window.dialoguePortraits);
					if (Array.isArray(window.DIALOG_PORTRAITS)) cand.push(...window.DIALOG_PORTRAITS);
					const uniq = [...new Set(cand.filter(c=>/\.(png|webp)(\?|$)/i.test(c)))];
					if (uniq.length) src = uniq[(Math.random()*uniq.length)|0];
				}
			}catch(_){ }
			if (!src) src = 'js/gir1.png';
			const base = new Image();
			base.crossOrigin = 'anonymous';
			base.onload = function(){
				try{
					const cols=3, rows=3;
					const tileW = Math.floor(base.naturalWidth/cols) || base.width;
					const tileH = Math.floor(base.naturalHeight/rows) || base.height;
					const col = (Math.random()*cols)|0; const row=(Math.random()*rows)|0;
					const sx = col*tileW, sy=row*tileH;
					const c = document.createElement('canvas'); c.width=tileW; c.height=tileH;
					c.getContext('2d').drawImage(base, sx, sy, tileW, tileH, 0,0,tileW,tileH);
					ent._boss.krisTile = c;
				}catch(_){ ent._boss.krisTile = base; }
			};
			base.onerror = function(){ ent._boss.krisTile = base; };
			base.src = src;
			ent._boss.krisBase = base;
		}
	}catch(_){ }
	// Support worldToScreen(x,y) function OR object with .x/.y funcs
	let sx, sy;
	try{
		if (typeof worldToScreen === 'function'){ const s = worldToScreen(ent.x, ent.y); sx = s.x; sy = s.y; }
		else if (worldToScreen && typeof worldToScreen.x === 'function'){ sx = worldToScreen.x(ent.x); sy = worldToScreen.y(ent.y); }
		else { sx = ent.x; sy = ent.y; }
	}catch(_){ sx = ent.x; sy = ent.y; }
	// dynamic body animation each frame for rim + hazard
		try{ renderBossBody(bodyC.getContext('2d')); }catch(_){ }
	try{ if (typeof drawShadow === 'function') drawShadow(sx, sy, bodyC.width*scale, camera && camera.zoom ? camera.zoom : 1); }catch(_){ }
	try{ ctx.save(); ctx.translate(sx,sy); ctx.scale(scale,scale); ctx.drawImage(bodyC,-bodyC.width/2,-bodyC.height/2); ctx.restore(); }catch(_){ }
	try{ renderBossTurret(turC.getContext('2d'), ent.turretAngle || 0); }catch(_){ }
	try{ ctx.save(); ctx.translate(sx,sy); ctx.scale(scale,scale); ctx.drawImage(turC,-turC.width/2,-turC.height/2); ctx.restore(); }catch(_){ }
	// Health bar (15-hit system) rendered above boss + Kris avatar above bar
	try{
		const hp = ent.hp, maxHp = ent.maxHp || 15;
		if (hp > 0 && maxHp > 0){
			const pct = Math.max(0, Math.min(1, hp / maxHp));
			const barW = 70 * (camera && camera.zoom || 1);
			const barH = 6 * (camera && camera.zoom || 1);
			const bx = sx - barW/2;
			const by = sy - (bodyC.height*scale/2) - 14 * (camera && camera.zoom || 1);
			ctx.save();
			ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(bx-2, by-2, barW+4, barH+4);
			ctx.fillStyle = '#3b4758'; ctx.fillRect(bx, by, barW, barH);
			// Gradient damage color shift (green -> yellow -> red)
			let r, g; if (pct > 0.5){ const t=(pct-0.5)/0.5; r = Math.floor(255*(1-t)*0.2); g = 200; } else { const t=pct/0.5; r = Math.floor(255*(1-t)); g = Math.floor(200*t); }
			const col = 'rgb('+r+','+g+',40)';
			ctx.fillStyle = col; ctx.fillRect(bx, by, barW*pct, barH);
			ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(bx-0.5, by-0.5, barW+1, barH+1);
			ctx.restore();
			// Kris (or dialogue) avatar to the left of health bar
			try{
				const tile = ent._boss && ent._boss.krisTile;
				const base = ent._boss && ent._boss.krisBase;
				const ready = tile || (base && base.complete && base.naturalWidth>0 ? base : null);
				if (ready){
					const img = tile || base;
					const zoom = (camera && camera.zoom) || 1;
					const size = 26 * zoom;
					const pad = 6 * zoom;
					const ay = by + (barH/2) - size/2; // vertical center align with bar
					const ax = bx - size - pad; // left of bar
					// backdrop circle
					ctx.save();
					ctx.beginPath(); ctx.arc(ax + size/2, ay + size/2, size/2 + 3*zoom, 0, Math.PI*2); ctx.fillStyle='rgba(0,0,0,0.55)'; ctx.fill();
					ctx.beginPath(); ctx.arc(ax + size/2, ay + size/2, size/2, 0, Math.PI*2); ctx.clip();
					ctx.drawImage(img, ax, ay, size, size);
					ctx.restore();
					ctx.save(); ctx.beginPath(); ctx.arc(ax + size/2, ay + size/2, size/2 + 1*zoom, 0, Math.PI*2); ctx.strokeStyle='white'; ctx.lineWidth=1.2*zoom; ctx.stroke(); ctx.restore();
				}
			}catch(_){ }
		}
	}catch(_){ }
}

export function attachBossIfNeeded(ent){
	if (!ent || ent.kind !== 'bosstank') return false;
	ensureBossCanvases(ent);
	// install base draw hook if missing
	if (!ent.draw){
		ent.draw = function(ctx, worldToScreen, camera){ drawBoss(ent, ctx, worldToScreen, camera); };
	}
	// wrap once to inject per-frame update (aim + shooting)
	if (!ent.__boss_wrapped){
		ent.__boss_wrapped = true;
		const origDraw = ent.draw;
		ent._lastFrameTime = performance.now();
		ent.draw = function(ctx, worldToScreen, camera){
			const now = performance.now(); const dt = now - (ent._lastFrameTime||now); ent._lastFrameTime = now; updateBoss(ent, dt); return origDraw(ctx, worldToScreen, camera);
		};
	}
	return true;
}

export function spawnBossTank(x,y, opts={}, enemies){
	const ent = {
		x,y,
		// Triple previous forward speed baseline
		spd: ((opts.spd || 40) * 3) + Math.random()*12,
		baseSpd: ((opts.spd || 40) * 3),
		r: 30, // bigger collision radius
		type: 'boss',
		kind: 'bosstank',
		maxHp: 15,
		hp: 15, // fixed hit count; ignore external opts.hp to avoid ambiguity
		angle: 0, turretAngle: 0,
		lastAttack: 0,
		attackCD: 900 + Math.random()*350, // slower big shots
		dashUntil: 0,
		moving: false,
		boss: true,
		_fireAccum: 0,
		fireInterval: 1400, // ms between salvos
		lastAimUpdate: 0
	};
	attachBossIfNeeded(ent);
	if (Array.isArray(enemies)) enemies.push(ent);
	return ent;
}

// Expose globally for quick console spawning
try{ if (typeof globalThis !== 'undefined'){ globalThis.spawnBossTank = spawnBossTank; } }catch(_){ }

// Auto-upgrade any placeholder bosstank entities spawned before this module loaded
function upgradeExistingBossPlaceholders(){
	try{
		const list = (typeof window !== 'undefined' && window.enemies) ? window.enemies : (globalThis.enemies || []);
		if (!Array.isArray(list)) return;
		for (const e of list){
			if (!e || e.kind !== 'bosstank') continue;
			if (e._boss) continue; // already upgraded
			// Heuristic: placeholder had small r/hp; upgrade stats
			if (e.r < 25) e.r = 30;
			if (e.hp < 100) e.hp = 120;
			e.type = 'boss';
			attachBossIfNeeded(e);
		}
	}catch(_){ }
}
try{ if (typeof window !== 'undefined'){ setTimeout(upgradeExistingBossPlaceholders, 50); setTimeout(upgradeExistingBossPlaceholders, 500); } }catch(_){ }

export default { spawnBossTank, attachBossIfNeeded };

// Per-frame update hook (optional external call) - if game loop does not call, we patch enemy.draw to embed logic.
function updateBoss(ent, dtMs){
	if (!ent) return;
	const now = performance.now();
	// Dynamic pursuit speed: accelerate when far, slow when close
	try{
		const player = (typeof window !== 'undefined') ? window.tank : null;
		if (player){
			const dx = (typeof window !== 'undefined' && typeof window.wrapDeltaX === 'function') ? window.wrapDeltaX(player.x, ent.x) : (player.x - ent.x);
			const dy = (typeof window !== 'undefined' && typeof window.wrapDeltaY === 'function') ? window.wrapDeltaY(player.y, ent.y) : (player.y - ent.y);
			const dist = Math.hypot(dx,dy);
			// Define bands: within 120px = slow (0.6x base), 120-400 interpolate, beyond 400 = fast (3x current baseSpd)
			const nearD = 120; const farD = 400;
			let t;
			if (dist <= nearD) t = 0; else if (dist >= farD) t = 1; else t = (dist - nearD) / (farD - nearD);
			// Ease curve for smoother acceleration
			const ease = t*t*(3-2*t);
			const minMul = 0.6; const maxMul = 3.0; // requested triple speed when far
			const targetSpd = ent.baseSpd * (minMul + (maxMul - minMul) * ease);
			// Smoothly approach target speed to avoid jitter
			ent.spd = ent.spd + (targetSpd - ent.spd) * 0.12;
			// Update angle toward player for homing movement (does not affect turret which updates separately)
			if (dist > 4){ ent.angle = Math.atan2(dy, dx); }
		}
	}catch(_){ }
	// Aim toward player every 80ms to reduce trig overhead
	if (now - ent.lastAimUpdate > 80){
		try{
			const player = (typeof window !== 'undefined') ? window.tank : null;
			if (player){
				const dx = (typeof window !== 'undefined' && typeof window.wrapDeltaX === 'function') ? window.wrapDeltaX(player.x, ent.x) : (player.x - ent.x);
				const dy = (typeof window !== 'undefined' && typeof window.wrapDeltaY === 'function') ? window.wrapDeltaY(player.y, ent.y) : (player.y - ent.y);
				ent.turretAngle = Math.atan2(dy, dx);
			}
		}catch(_){ }
		ent.lastAimUpdate = now;
	}
	ent._fireAccum += dtMs;
	if (ent._fireAccum >= ent.fireInterval){
		ent._fireAccum = 0;
		try{ bossFire(ent); }catch(_){ }
	}
	// Contact damage: remove 1 heart on overlap, 1s cooldown
	try{
		const player = (typeof window !== 'undefined') ? window.tank : null;
		if (player && !player.dead){
			const dx = (typeof window !== 'undefined' && typeof window.wrapDeltaX === 'function') ? window.wrapDeltaX(player.x, ent.x) : (player.x - ent.x);
			const dy = (typeof window !== 'undefined' && typeof window.wrapDeltaY === 'function') ? window.wrapDeltaY(player.y, ent.y) : (player.y - ent.y);
			const dist = Math.hypot(dx,dy);
			const pr = (player.r || 20); const br = ent.r || 30;
			if (dist < pr + br){
				if (!ent._lastContactHit || (now - ent._lastContactHit) > 1000){
					ent._lastContactHit = now;
					try{ if (typeof setHealth === 'function'){ /* prefer direct setter if exposed */ } }catch(_){ }
					// Fallback: mutate global health var if accessible
					try{
						if (typeof window !== 'undefined' && typeof window.health === 'number'){
							window.health = Math.max(0, window.health - 1);
							if (typeof window.setHealth === 'function') try{ window.setHealth(window.health); }catch(_){ }
							if (typeof window.updateHud === 'function') try{ window.updateHud(); }catch(_){ }
							if (window.health <= 0 && typeof window.explodeTank === 'function') try{ window.explodeTank(window.updateHud, document.getElementById('center'), window.score||0); }catch(_){ }
						}
					}catch(_){ }
				}
			}
		}
	}catch(_){ }
}

function bossFire(ent){
	const player = (typeof window !== 'undefined') ? window.tank : null;
	let a = ent.turretAngle || 0;
	if (player){ a = Math.atan2(player.y - ent.y, player.x - ent.x); }
	const speed = 260; const muzzle = 34; const bx = ent.x + Math.cos(a)*muzzle; const by = ent.y + Math.sin(a)*muzzle;
	// radial mini-fan (5 shots) for threat
	for (let i=-2;i<=2;i++){
		const off = i * 0.08; const ang = a + off; const dx = Math.cos(ang)*speed; const dy = Math.sin(ang)*speed;
		const b = { x: bx, y: by, dx, dy, life: 4.5, hitR: 10, _src: { kind:'bosstank', label:'bosstank', x: ent.x, y: ent.y } };
		try{
			if (typeof enemyBullets !== 'undefined' && Array.isArray(enemyBullets)) enemyBullets.push(b);
			else if (typeof window !== 'undefined'){ window.enemyBullets = window.enemyBullets || []; window.enemyBullets.push(b); }
		}catch(_){ }
	}
	try{ if (typeof spawnMuzzleFlash === 'function') spawnMuzzleFlash(bx, by, a); }catch(_){ }
}


