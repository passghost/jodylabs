// Input and camera helper module
import * as utils from './utils.mjs';

export const mouse = { x: 0, y: 0 };
export const keys = new Set();

// sensible defaults (can be overridden via init)
export let W = 3200, H = 2400;
export let WORLD_W = 4000, WORLD_H = 3000;
export const MIN_ZOOM = 0.5, MAX_ZOOM = 5.0;

export const camera = { x: WORLD_W/2, y: WORLD_H/2, zoom: MAX_ZOOM };

let _canvas = null;

export function screenToWorld(mx, my){
  const wx = (mx - W/2)/camera.zoom + camera.x;
  let wy = (my - H/2)/camera.zoom + camera.y;
  wy = utils && utils.mod ? utils.mod(wy, WORLD_H) : ((wy % WORLD_H) + WORLD_H) % WORLD_H;
  return { x: wx, y: wy };
}

export function worldToScreen(wx, wy){
  const x = (wx - camera.x) * camera.zoom + W/2;
  let dy = wy - camera.y;
  if (dy > WORLD_H/2) dy -= WORLD_H;
  if (dy < -WORLD_H/2) dy += WORLD_H;
  const y = dy * camera.zoom + H/2;
  return { x, y };
}

export function initInput({ canvas, width, height, worldW = 4000, worldH = 3000 } = {}){
  if (!canvas) throw new Error('initInput requires a canvas element');
  _canvas = canvas;
  W = width || canvas.width; H = height || canvas.height;
  WORLD_W = worldW; WORLD_H = worldH;
  camera.x = Math.max(W/(2*camera.zoom), Math.min(WORLD_W - W/(2*camera.zoom), camera.x));
  camera.y = Math.max(H/(2*camera.zoom), Math.min(WORLD_H - H/(2*camera.zoom), camera.y));

  // mouse
  const rect = () => _canvas.getBoundingClientRect();
  _canvas.addEventListener('mousemove', (e) => {
    const r = rect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
  });

  // wheel zoom (preserve world point under cursor)
  _canvas.addEventListener('wheel', (ev) => {
    ev.preventDefault();
    const dir = (ev.deltaY>0) ? -1 : 1; const factor = dir>0 ? 1.12 : (1/1.12);
    const oldZoom = camera.zoom; const mx = mouse.x, my = mouse.y;
    const before = screenToWorld(mx, my);
    camera.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, camera.zoom * factor));
    camera.x = before.x - (mx - W/2)/camera.zoom;
    camera.y = before.y - (my - H/2)/camera.zoom;
    camera.x = Math.max(W/(2*camera.zoom), Math.min(WORLD_W - W/(2*camera.zoom), camera.x));
    camera.y = Math.max(H/(2*camera.zoom), Math.min(WORLD_H - H/(2*camera.zoom), camera.y));
  }, { passive: false });

  // pointerdown -> dispatch custom event so other modules can respond
  _canvas.addEventListener('pointerdown', (e) => {
    const r = rect();
    mouse.x = (e.clientX - r.left) * (canvas.width / r.width);
    mouse.y = (e.clientY - r.top) * (canvas.height / r.height);
    // include buttons mask so listeners can detect simultaneous buttons
    const detail = { button: e.button, buttons: e.buttons, mouse: { x: mouse.x, y: mouse.y } };
    window.dispatchEvent(new CustomEvent('game-pointerdown', { detail }));
  });

  // keyboard
  window.addEventListener('keydown', (e) => { keys.add(e.key.toLowerCase()); if (e.key === ' ') e.preventDefault(); });
  window.addEventListener('keyup', (e) => { keys.delete(e.key.toLowerCase()); });

  // focus canvas for key events
  canvas.tabIndex = canvas.tabIndex || 0;
  canvas.focus();
}
