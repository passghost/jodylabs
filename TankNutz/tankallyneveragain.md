# Tank Ally — Never Again

A short record of what went wrong and how it was fixed so future migrations don't reintroduce the issue.

## Symptom
- Ally sprite was visually offset (anchored to left/top) even though ally world coordinates matched the player.
- The bug only appeared during camera scroll/zoom.

## Root cause
- Multiple, inconsistent world→screen implementations and ad-hoc scale/transform math existed across the codebase:
  - `game.js` had a `worldToScreen_local` fallback and an alternate `window.__game_modules.input.worldToScreen` when an input module was present.
  - `tankAlly.js` at one point used a local `worldToScreen_consistent` during migration *and* had ad-hoc debug/force code that could compute screen coordinates differently from the player draw.
  - There was duplicated anchoring logic for allies (two places assigning `ally.x/ally.y` and angles) which made behavior brittle and harder to reason about.

When camera zoom/scroll changed, these differing implementations produced different screen coordinates for identical world coords — the visible offset.

## Fix applied (high level)
1. Introduced a single canonical transform and published it globally:
   - `window.__CANONICAL_WORLD_TO_SCREEN` in `js/game.js` (wrap-aware, same logic as local fallback).
   - Forced global helpers to use it: `window.worldToScreen = window.__CANONICAL_WORLD_TO_SCREEN` and a matching `window.screenToWorld`.
2. Simplified `js/tankAlly.js`:
   - Removed duplicate anchor block (only one place now assigns `ally.x/ally.y` and angles).
   - Removed local `worldToScreen_consistent` and temporary "force" fallback and visual debug overlays.
   - Made `drawAllies()` rely on `window.worldToScreen(...)` and `getCanvasDrawScale(...)` (same scaling as player draw).
   - Kept a small visible X-offset (+10 world px) so ally doesn't perfectly overlap the player by default.
3. Removed transient debugging artifacts and left a short set of recommended runtime debug flags (can be removed after confirmation).

## Files edited
- `js/game.js`
  - Added `window.__CANONICAL_WORLD_TO_SCREEN` and set `window.worldToScreen` / `window.screenToWorld` to it.
  - Left a single debug write `window.__LAST_PLAYER_SCREEN` (optional — safe to remove).

- `js/tankAlly.js`
  - Removed duplicated anchoring logic and local world→screen helper.
  - Ensured `drawAllies()` uses `window.worldToScreen(...)` and `getCanvasDrawScale(...)`.
  - Removed debug overlay code and forced-screen test code.

(Other tooling files that referenced allies were left alone.)

## How to test (quick)
1. Start the game and open the browser console.
2. (Optional) Enable debug overlay while testing briefly:
   - `window.__ALLY_DEBUG_LOG = true`
3. Confirm the ally now follows the player exactly when you move and when you zoom/scroll the camera.
4. If everything looks good, disable debug:
   - `window.__ALLY_DEBUG_LOG = false`

If you see a mismatch after this change:
- Paste a screenshot and the console logs showing the player's screen coordinates and the ally's screen coordinates (the code was instrumented during debugging; if you still have logs, include them).

## Follow-ups / cleanup (recommended)
- Remove the temporary debug write `window.__LAST_PLAYER_SCREEN` from `js/game.js` if you don't need it.
- Consider exporting the canonical transform as part of a stable public API (the input module can call into it) instead of overwriting globals. This will make future module swaps less error-prone.
- Add a short test (smoke test) that spawns an ally at the player's position, zooms and pans the camera, and verifies the ally's screen position equals the player's (simple DOM test harness or headless browser harness).

## Why this prevents regressions
- A single source-of-truth for world→screen ensures identical camera math is used everywhere.
- Removing duplicate anchoring eliminates race conditions and double-wrapping where different code paths applied different wrapping/scales.
- Using the same draw-scaling helper (`getCanvasDrawScale`) keeps sprite scaling consistent between player and ally.

---
If you want I can remove the last few debug leftovers now and add a minimal smoke test harness under `tools/` that programmatically verifies alignment.
