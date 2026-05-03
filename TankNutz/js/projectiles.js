// projectiles.js — centralized projectile collections and helpers
// Use module-scoped singletons so all importers share the same arrays.

// Enemy projectiles (fired by jungle/alt tanks/robots). Shape: { x,y,dx,dy,life,hitR?,spd?,_src?, _ignorePlayer?, _fromAlly? }
export const enemyBullets = [];

// Player projectiles (tank/heli). Shape: { x,y,dx,dy,life,color?,glow? }
export const bullets = [];

// Kittytank-specific projectiles (kept separate for animation/logic isolation). Shape: { x,y,dx,dy,spd?,a?,life,hitR?,anim? }
export const kittyBullets = [];

// Optional: expose to global for late-bound modules or dev console tools
try{
	if (typeof window !== 'undefined'){
		// Only set if not already the same reference to avoid breaking listeners
		if (!window.enemyBullets || window.enemyBullets !== enemyBullets) window.enemyBullets = enemyBullets;
		if (!window.bullets || window.bullets !== bullets) window.bullets = bullets;
		if (!window.kittyBullets || window.kittyBullets !== kittyBullets) window.kittyBullets = kittyBullets;
	}
}catch(_){ }

// Visuals related to projectiles
// Muzzle flashes (short-lived world-space effects when firing)
export const muzzleFlashes = []; // {x,y,angle,life}
export function spawnMuzzleFlash(x, y, angle){
	muzzleFlashes.push({ x, y, angle, life: 0.12 + Math.random()*0.06 });
}

// Ejected shell casings from player tank shots
export const casings = []; // {x,y,vx,vy,life,spin,t0}

// Expose visuals on window for existing callers
try{
	if (typeof window !== 'undefined'){
		if (!window.spawnMuzzleFlash) window.spawnMuzzleFlash = spawnMuzzleFlash;
	}
}catch(_){ }

// --- Update helpers (logic centralized here to reduce duplication) ---
// Advance casing physics and cull expired/out-of-bounds
export function updateCasings(dt, WORLD_W, WORLD_H){
	for (let ci = casings.length - 1; ci >= 0; ci--){
		const c = casings[ci];
		// simple ballistic physics
		c.vy += 380 * dt; // gravity
		c.vx *= 0.995;    // air drag
		c.x += c.vx * dt;
		c.y += c.vy * dt;
		c.life -= dt;
		if (c.life <= 0 || c.x < -200 || c.x > WORLD_W + 200 || c.y > WORLD_H + 400){ casings.splice(ci,1); }
	}
}

// Reduce muzzle flash lifetimes and cull
export function updateMuzzleFlashes(dt){
	for (let i = muzzleFlashes.length - 1; i >= 0; i--){
		const m = muzzleFlashes[i];
		m.life -= dt;
		if (m.life <= 0) muzzleFlashes.splice(i,1);
	}
}

// Enforce vertical wrapping for projectiles in an endless world
// Pass a mod function to avoid importing utils here (keeps module decoupled)
export function wrapProjectilesVertically(WORLD_H, modFn){
	try{ for (const b of bullets){ b.y = modFn(b.y, WORLD_H); } }catch(_){ }
	try{ for (const eb of enemyBullets){ eb.y = modFn(eb.y, WORLD_H); } }catch(_){ }
}

