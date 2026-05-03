# Boss Tank Creation & Migration Guide

This guide documents the standardized process for adding new boss-style tanks that use the 15-hit health system, dynamic pursuit speed, independent procedural or migrated pixel art, and isolated damage rules.

---
## 1. Core Principles
- **Fixed Hit System**: Every boss uses `maxHp = 15`, decremented only by direct player bullets (one per hit). No other damage source (collisions, hazards, ally fire, environmental effects) reduces boss HP.
- **Run-over Immunity**: Player tank collisions never destroy a boss. Instead, the player is bumped away.
- **Independent Module**: Each boss lives in its own file (e.g. `js/bosstank_<variant>.js`) and must not depend on `kittytank.js` logic or state.
- **Dynamic Speed Scaling**: Boss movement speed scales with distance to the player: slow when close, fast when far (up to a configurable max multiplier).
- **Procedural + Migrated Art**: Use a combination of dynamic canvas rendering and/or migrated static pixel art from an HTML art prototype file.
- **Explicit Bullet Handling**: Boss damage handling must be *explicitly* branched in `game.js` bullet loops so generic enemy logic never triggers.

---
## 2. File Layout & Naming
Place new boss module in `js/`:
```
js/
  bosstank.js                # Existing base boss (reference)
  bosstank_<name>.js         # New boss variant
```
Optionally provide an art prototype file under project root or `/assets/` for reference:
```
bosstank_<name>_art.html
```

---
## 3. Minimal Module Skeleton
```javascript
// js/bosstank_flame.js
const INTERNAL_SIZE = 128; // logical art grid
const SCALE = 0.5;         // shrink to world size

export function spawnBossFlame(x, y, opts = {}, enemies){
  const ent = {
    x, y,
    kind: 'bosstank-flame',
    type: 'boss',
    r: 30,
    maxHp: 15,
    hp: 15,
    baseSpd: ((opts.spd || 40) * 3),
    spd: ((opts.spd || 40) * 3),
    angle: 0, turretAngle: 0,
    fireInterval: 1400,
    _fireAccum: 0
  };
  attachBossFlame(ent);
  if (Array.isArray(enemies)) enemies.push(ent);
  return ent;
}

function attachBossFlame(ent){
  if (ent.__flame_wrapped) return;
  ent.__flame_wrapped = true;
  ent.draw = function(ctx, worldToScreen, camera){
    updateBossFlame(ent, performance.now());
    drawBossFlame(ent, ctx, worldToScreen, camera);
  };
}

function updateBossFlame(ent, now){ /* speed scaling + firing logic here */ }
function drawBossFlame(ent, ctx, worldToScreen, camera){ /* render body + turret + health bar */ }
```

---
## 4. Distance-Based Speed Formula
Standard pattern (adjust as needed):
```
near = 120px  -> ~0.6x baseSpd
far  = 400px  -> 3.0x baseSpd
spd = lerp(0.6, 3.0, smoothStep((dist-near)/(far-near))) * baseSpd
```
Use easing: `t*t*(3-2*t)` for smooth acceleration.

---
## 5. Turret & Firing Pattern
Recommended fields:
- `turretAngle`: updated every 60–100ms toward player.
- `fireInterval`: ms between salvos.
- `_fireAccum`: accumulator; when `>= fireInterval` emit pattern.
- Each projectile pushes an object into `enemyBullets` with `_src.kind = ent.kind` for attribution.

Example salvo (fan):
```javascript
function flameFire(ent){
  const a = ent.turretAngle || 0;
  const muzzle = 34;
  for (let i=-2;i<=2;i++){
    const ang = a + i * 0.07;
    enemyBullets.push({ x: ent.x + Math.cos(a)*muzzle, y: ent.y + Math.sin(a)*muzzle, dx: Math.cos(ang)*260, dy: Math.sin(ang)*260, life: 4.2, hitR: 10, _src: { kind: ent.kind } });
  }
}
```

---
## 6. Health Bar Standard
- Width: ~70 world pixels scaled by camera zoom.
- Background: translucent dark rect.
- Base fill: neutral steel tone.
- Foreground: gradient Green (#4caf50) → Yellow (#eed657) → Red (#e53935) based on `hp/maxHp`.
- Outline: 1px white stroke.
Place bar above sprite (`sy - bodyHeight*scale/2 - margin`).

---
## 7. Integrating a New Boss Into `game.js`
1. Import spawn:
```javascript
import { spawnBossFlame } from './bosstank_flame.js';
```
2. Add a key / trigger (e.g. `'N'` key) to call `spawnBossFlame(tank.x + offX, tank.y + offY, {}, enemies);`
3. Ensure bullet collision loops contain explicit branch:
```javascript
if (e.kind === 'bosstank-flame'){
  e.hp -= 1; if (e.hp <= 0){ /* death sequence + score */ }
  continue; // skip generic paths
}
```
4. Never allow generic `e.hp = (e.hp||1)-1` logic to run for boss kinds.

Wave Gating (Example): To gate a wave on boss death (like Wave 5), add in `startNewWave()` a spawn hook when `currentWave === <wave>` and in `checkWaveProgress()` short‑circuit generic completion logic until `bossAlive === false`.

---
## 8. Preventing Accidental HP Mutation
Audit patterns to guard against unintended modifications:
| Pattern | Action |
| ------- | ------ |
| `e.hp = (e.hp||1) - 1` | Wrap with `if (e.kind !== 'bosstank-<variant>')` |
| `if (e.hp <= 0)` generic removal | Ensure branch skipped for boss |
| Collision removal on run-over | Early-continue if boss |

Create a helper if many bosses share logic:
```javascript
function isBoss(e){ return e && typeof e.kind === 'string' && e.kind.startsWith('bosstank'); }
```
Then branch on `if (isBoss(e))` in bullet loops.

---
## 9. Migrating Pixel Art From HTML Prototype
1. Open prototype file (e.g. `tankboss1.html`).
2. Identify rendering algorithm or pixel data (loops, color palette, radius tables).
3. Extract constants (palette, radii, geometry) into arrays in the module.
4. Convert any animation (e.g. rotating rim, pulsing lights) into time-based calculations inside `draw` or a regenerated offscreen canvas.
5. Replace any `document.write` or DOM-dependent code with pure canvas drawing calls on an offscreen canvas (`document.createElement('canvas')`).
6. Keep heavy per-pixel loops either:
   - Cached once then tinted/rotated; or
   - Recomputed selectively (e.g. body every frame only if lightweight, turret per frame, expensive layers every N ms).

---
## 10. Procedural Rendering Tips
- Precompute polar tables (`_R`, `_A`) for radial shading.
- Use small helper functions: `clamp`, `mixHex`, `smoothStep`.
- Segment radii into bands: outer hull, plating, hazard ring, core.
- Add subtle animated offsets (`time * speed`) for scanning or rotation effects.

---
## 11. Death Sequence Standard
On final hit:
```javascript
recordDeath(ent.kind, ent);
try{ recordKill(ent.kind, ent); }catch(_){ }
callSpawnGibs(ent.x, ent.y, '#ff3030', 24, ent.kind + '-destroy');
score += 5; updateHud();
```
Optional: trigger screen shake, spawn powerup, phase transition to second form.

---
## 12. Optional Phase Extensions
Add just-in-time behavior shifts:
| Threshold | Change |
| --------- | ------ |
| hp <= 10  | Increase fire rate (e.g. fireInterval * 0.85) |
| hp <= 7   | Add extra side projectiles |
| hp <= 4   | Increase speed max multiplier (e.g. 3.5x) |
| hp == 1   | Flash body / warning sound |

Implement by checking `if (ent.hp !== ent._lastHp)` then applying transitions.

---
## 13. Testing Checklist
- Spawn with dev key; verify hp reads 15 and decrements exactly once per player bullet.
- Confirm collisions, ally bullets, hazards DO NOT reduce hp.
- Ensure run-over bump occurs and boss remains.
- Verify turret tracks and salvo cadence correct.
- Measure performance (no per-frame GC spikes from allocations inside loops).

---
## 14. Common Pitfalls
| Issue | Cause | Fix |
| ----- | ----- | --- |
| Boss dies early | Generic hp decrement path not bypassed | Add explicit boss branch & `continue` |
| No health bar | Forgot to render after turret | Add bar draw after body/turret rendering |
| Choppy movement | Speed snap instead of smoothing | Lerp spd toward target (factor ~0.1–0.15) |
| High CPU | Recomputing full per-pixel body too often | Cache static layers; animate with transforms |

---
## 15. Template Snippet: Bullet Handling Integration
```javascript
if (e.kind && e.kind.startsWith('bosstank')){
  e.hp -= 1;
  if (e.hp <= 0){
    recordDeath(e.kind, e);
    try{ recordKill(e.kind, e); }catch(_){ }
    enemies.splice(ei,1);
    callSpawnGibs(e.x, e.y, '#ff3030', 24, e.kind + '-destroy');
    score += 5; updateHud();
  }
  continue;
}
```

---
## 16. Maintaining Consistency
When adding a new boss variant:
1. Copy skeleton from Section 3.
2. Implement procedural/migrated art.
3. Add dynamic speed scaling.
4. Add turret + fire pattern.
5. Integrate bullet handling branch.
6. Add health bar.
7. Test damage isolation.
8. Commit with message: `feat(boss): add <name> boss (15-hit system)`.

---
## 17. Future Enhancements (Optional Shared Utility)
Create `js/boss_common.js` to house:
- `isBoss(e)` helper
- Standard speed scaling function
- Health bar renderer
- Fire fan utility
- Polar table generator

This prevents duplication across multiple boss modules.

---
**Last Updated**: <auto-update date manually when modified>

Happy boss forging!
