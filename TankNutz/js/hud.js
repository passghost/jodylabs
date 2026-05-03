// HUD module: styles, layout rendering, and modals. Designed to be bound to game state via bindHud.
import * as SFX from '../Sounds/sounds.js';
import { updateJournal } from './journal.js';
import { tank, bodyCanvas, turretCanvas, SPR_W, SPR_H, SPRITE_SCALE } from './tank.js';
import {
  drawFordFiestaInto,
  drawBlackstarBodyInto, drawBlackstarTurretInto,
  drawMurkiaInto,
  drawDozerInto,
  drawBondtankInto,
  drawGermanBodyInto, drawGermanTurretInto,
  drawMexicoBodyInto, drawMexicoTurretInto,
  drawChinaBodyInto, drawChinaTurretInto,
  drawMcdsBodyInto, drawMcdsTurretInto,
  drawWaffleBodyInto, drawWaffleTurretInto,
  drawFacebookBodyInto, drawFacebookTurretInto,
} from './vehicles/vehicleSprites.js';
import { waveInProgress, currentWave, MAX_WAVES } from './critters.js';

let _getState = () => ({
  paused: false,
  shieldActive: false,
  shieldUntil: 0,
  shieldCooldownUntil: 0,
  envPowerupStage: 1,
  envPowerupCooldown: 0,
  MAX_HEALTH: 5,
  health: 3,
  score: 0,
  VEHICLE_SLOTS: [],
  VEHICLE_UNLOCKED: [],
  selectedVehicle: 'tank',
  selectedVehicleVariant: 'default',
});
let _actions = {
  togglePause: () => {},
  selectVehicleSlot: (_idx) => {},
  restart: () => {},
};

export function bindHud({ getState, actions }){
  if (typeof getState === 'function') _getState = getState;
  if (actions) _actions = { ..._actions, ...actions };
}

// Install lightweight metal HUD styles once
export function installHudStyles(){
  const hud = document.getElementById('hud');
  if (document.getElementById('tanknutz-hud-styles')) return;
  const css = `
  /* Desert/Military Camouflage Background */
  body, html {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    background: linear-gradient(45deg, #3a2f23 25%, transparent 25%),
                linear-gradient(-45deg, #3a2f23 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #3a2f23 75%),
                linear-gradient(-45deg, transparent 75%, #3a2f23 75%);
    background-size: 20px 20px;
    background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
    background-color: #2a2118;
  }

  /* Additional camouflage overlay for depth */
  body::before {
    content: '';
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background:
      radial-gradient(circle at 20% 80%, rgba(58, 47, 35, 0.3) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(42, 33, 24, 0.4) 0%, transparent 50%),
      radial-gradient(circle at 40% 40%, rgba(67, 54, 42, 0.2) 0%, transparent 50%);
    background-size: 300px 300px, 400px 400px, 200px 200px;
    background-position: 0% 0%, 50% 50%, 100% 100%;
    pointer-events: none;
    z-index: -1;
  }

  /* Desert / military HUD: compact, sand + brown tones, organized left-top */
  .tn-hud{ position:fixed; left:12px; top:12px; min-height:64px; display:flex; align-items:flex-start; gap:12px; pointer-events:none; z-index:9999; font-family: 'Segoe UI', Roboto, Arial, sans-serif; }

  /* Main HUD panel (left-most): player health + armor */
  .tn-panel{ background:linear-gradient(180deg,#5a4638,#392a21); border:2px solid #2a2119; padding:8px 12px; display:flex; align-items:center; gap:8px; box-shadow:0 6px 16px rgba(0,0,0,0.6); border-radius:6px; pointer-events:auto; color:#e6d9c2; }
  /* Left pane should stack its contained panels vertically; right pane stays horizontal */
  .tn-left{ min-width:160px; display:flex; flex-direction:column; align-items:flex-start; gap:6px; padding:8px; }
  .tn-left .tn-bolts{ margin-bottom:4px; align-self:flex-start; }
  .tn-left .tn-status-item{ width:100%; margin:2px 0; display:block; }
  .tn-left .tn-panel{ width:100%; box-sizing:border-box; margin:2px 0; display:block; }
  .tn-right{ min-width:160px; display:flex; align-items:center; gap:10px; }

  /* Center area used for powerups / shot indicators */
  .tn-center{ display:flex; align-items:center; gap:10px; min-width:180px; }

  /* Title / unit badge bottom-right */
  .tn-title{ position:fixed; right:12px; bottom:12px; background:linear-gradient(180deg,#3b2f2a,#241913); padding:10px 14px; border-radius:6px; border:2px solid #20140f; z-index:9999; display:flex; flex-direction:column; align-items:flex-end; box-shadow:0 8px 22px rgba(0,0,0,0.6); pointer-events:none; color:#e3d4bf; }
  .tn-logo{ font-family: monospace; font-weight:900; color:#e3d4bf; letter-spacing:2px; font-size:16px; text-shadow:0 1px 0 #1a120f; }
  .tn-score{ background:#d6b37e; color:#2b1f12; padding:6px 10px; border-radius:4px; font-weight:900; box-shadow:inset 0 -2px 0 rgba(0,0,0,0.18); margin-top:6px; }

  /* Small brigade icon */
  .tn-bolts{ width:12px; height:12px; background:radial-gradient(circle at 30% 30%, #e9d9c6, #b89b78); border-radius:50%; box-shadow:inset 0 -1px 0 rgba(0,0,0,0.25); margin-right:6px; margin-bottom:4px; }

  /* Firing/shot indicators styled like ammo pips */
  .tn-shoot-dots{ display:flex; gap:6px; }
  .tn-dot{ width:12px; height:12px; border-radius:3px; background:#4a3b33; border:1px solid #2a2119; box-shadow:inset 0 -2px 0 rgba(0,0,0,0.3); }
  .tn-dot.active{ background:linear-gradient(180deg,#ffd98a,#ffb84a); box-shadow:0 0 8px rgba(255,160,60,0.35); }

  /* Powerup panel with olive/drab tint */
  .tn-powerup{ background:linear-gradient(180deg,#3f4b2a,#2b351d); color:#e6e6d7; padding:6px 8px; border-radius:4px; font-weight:700; border:1px solid rgba(0,0,0,0.35); }

  /* Health hearts replaced with plate-style indicators */
  .tn-health{ display:flex; gap:8px; align-items:center; }
  .tn-heart{ width:18px; height:14px; background:linear-gradient(180deg,#b44a3a,#7b2a20); clip-path:polygon(50% 0, 61% 12%, 75% 12%, 88% 25%, 88% 40%, 75% 58%, 50% 78%, 25% 58%, 12% 40%, 12% 25%, 25% 12%, 39% 12%); box-shadow:0 1px 0 rgba(0,0,0,0.35); }

  /* Controls area (buttons) */
  .tn-controls{ display:flex; gap:8px; margin-left:6px; }
  .tn-btn{ background:#3b2f28; color:#efe6d6; border:1px solid #241913; padding:6px 8px; border-radius:4px; cursor:pointer; font-weight:800; font-size:12px; box-shadow:0 2px 6px rgba(0,0,0,0.4); }
  .tn-btn.toggled{ background:#2b4a2a; color:#eaffea; border-color:#18260f; }
  .tn-btn.key-toggle{ background:#46382f; }

  /* Controls panel under HUD (left) kept compact and military-looking */
  .tn-controls-panel{ position:fixed; left:12px; top:86px; display:flex; flex-direction:column; gap:8px; z-index:10000; pointer-events:auto; }
  .tn-big-btn{ padding:10px 14px; font-weight:900; border-radius:6px; background:#46382f; color:#efe6d6; border:2px solid #2a2119; cursor:pointer; font-size:14px; min-width:120px; text-align:left; box-shadow:0 6px 18px rgba(0,0,0,0.45); }
  .tn-controls-hint{ font-size:12px; color:#e0d7c4; background:rgba(18,14,10,0.6); padding:6px 8px; border-radius:6px; border:1px solid rgba(0,0,0,0.08); }

  /* Vehicle menu toned down to match desert camo; preserve layout but recolor */
  .tn-vehicle-menu{ position:fixed; right:20px; display:grid; grid-template-columns: repeat(3, 64px); grid-auto-rows: 84px; gap:8px; justify-content:center; align-items:start; z-index:9998; pointer-events:auto; padding:8px; box-sizing:border-box; background:linear-gradient(180deg,#33281f,#201612); border:2px solid #1d140f; border-radius:8px; box-shadow:0 6px 18px rgba(0,0,0,0.6); max-height:60vh; overflow:hidden; transition: transform 0.3s ease; }
  .tn-vehicle-menu.closed{ transform: translateX(120%); }
  .tn-vehicle-toggle{ position:fixed; right:20px; background:linear-gradient(180deg,#2b1f18,#1a120c); color:#e6d9c2; padding:6px 8px; border-radius:6px; cursor:pointer; z-index:9999; border:1px solid #241913; font-family:monospace; font-size:12px; transition: transform 0.3s ease; }
  .vehicle-slot{ width:64px; height:84px; background:linear-gradient(180deg,#3b2f28,#261d16); border:2px solid #1e140f; border-radius:8px; display:flex; flex-direction:column; align-items:center; justify-content:center; color:#d7cdbf; font-weight:800; cursor:pointer; box-shadow:0 6px 18px rgba(0,0,0,0.45); padding:6px; box-sizing:border-box; }
  .vehicle-slot canvas{ width:100%; height:auto; image-rendering: pixelated; display:block; border-radius:4px; }
  .vehicle-slot.locked{ background:linear-gradient(180deg,#2a221b,#1b1510); color:rgba(255,255,255,0.28); cursor:default; }
  .vehicle-slot.selected{ outline:3px solid rgba(214,179,126,0.14); box-shadow:0 8px 26px rgba(214,179,126,0.06), inset 0 -2px 0 rgba(0,0,0,0.25); }
  .vehicle-slot .slot-label{ font-size:12px; color:#d7cdbf; }

  .tn-controls-hint .tn-ctrl-line{ margin:2px 0; }

  /* controls modal kept readable with warm desaturated background */
  .tn-controls-modal{ position:fixed; left:0; top:0; width:100%; height:100%; display:flex; align-items:center; justify-content:center; z-index:20001; }
  .tn-controls-backdrop{ position:absolute; left:0; top:0; width:100%; height:100%; background:rgba(0,0,0,0.6); }
  .tn-controls-inner{ position:relative; z-index:20002; width:min(720px, 92%); max-height:86%; overflow:auto; background:linear-gradient(180deg,#3c342f,#221915); padding:18px; border-radius:8px; border:2px solid #1d140f; box-shadow:0 12px 40px rgba(0,0,0,0.6); color:#efe6d0; }
  .tn-controls-title{ font-size:20px; font-weight:900; margin-bottom:8px; }
  .tn-control-row{ display:flex; gap:12px; align-items:center; padding:10px 6px; border-bottom:1px solid rgba(255,255,255,0.02); }
  .tn-control-icon{ width:56px; height:56px; display:flex; align-items:center; justify-content:center; background:rgba(255,255,255,0.02); border-radius:8px; }
  .tn-control-label{ font-size:14px; color:#efe6d0; }
  .tn-controls-close{ margin-top:12px; padding:10px 14px; font-weight:800; border-radius:6px; cursor:pointer; background:#46382f; color:#efe6d6; border:2px solid #2a2119; }
  .tn-big-btn.toggled{ background:#2b4a2a; color:#eaffea; }
  /* Phase and cooldown elements in controls panel */
  .tn-phase-div, .tn-cooldown-div{ margin-top:8px; }
  .tn-phase{ display:flex; flex-direction:column; align-items:flex-start; }
  .tn-cooldown-placeholder{ background:linear-gradient(180deg,#3f342b,#2b2118); color:#e6d9c2; border-radius:6px; border:1px solid #241913; }
  /* Status panel placed below vehicle menu for cooldowns and stage info */
  .tn-status-panel{ position:fixed; right:20px; top:220px; z-index:9997; display:flex; flex-direction:column; gap:6px; pointer-events:none; }
  .tn-status{ background:linear-gradient(180deg,#3f342b,#2b2118); color:#e6d9c2; padding:8px 10px; border-radius:6px; border:1px solid #241913; box-shadow:0 6px 12px rgba(0,0,0,0.4); pointer-events:auto; min-width:160px; }
  /* Ensure HUD never overflows viewport and stays visible on small screens */
  .tn-hud{ max-width: calc(100vw - 24px); box-sizing: border-box; overflow-x: auto; -webkit-overflow-scrolling: touch; }
  .tn-panel, .tn-title, .tn-vehicle-menu, .tn-controls-panel{ box-sizing:border-box; }

  /* Respect safe-area insets on mobile (iOS notch etc) */
  .tn-hud{ left: calc(12px + env(safe-area-inset-left, 0px)); top: calc(12px + env(safe-area-inset-top, 0px)); }
  .tn-title{ right: calc(12px + env(safe-area-inset-right, 0px)); bottom: calc(12px + env(safe-area-inset-bottom, 0px)); }

  /* Media queries: collapse/relocate large right-side vehicle menu on narrow viewports */
  @media (max-width: 900px){
    .tn-vehicle-menu{ position:fixed; right:8px; left:8px; bottom:86px; top:auto; display:flex; flex-wrap:wrap; gap:6px; justify-content:center; max-height:30vh; overflow:auto; padding:6px; }
    .vehicle-slot{ width:64px; flex:0 0 64px; }
    .tn-vehicle-toggle{ right:8px; }
    .tn-title{ right:8px; bottom:8px; }
  }

  /* Extra small screens: compact HUD, slightly reduced spacing */
  @media (max-width: 520px){
    .tn-hud{ left:8px; top:8px; gap:8px; }
    .tn-panel{ padding:8px; gap:8px; }
    .tn-center{ min-width:unset; }
    .tn-controls-panel{ left:8px; top:72px; }
    .tn-big-btn{ min-width:100px; font-size:13px; }
  }

  `;
  const s = document.createElement('style'); s.id = 'tanknutz-hud-styles'; s.innerHTML = css; document.head.appendChild(s);
  if (hud) hud.classList.add('tn-hud');
}

// Ensure HUD-related floating elements remain within the visible browser viewport.
let __hud_viewguard_installed = false;
export function ensureHudInView(){
  try{
    const padding = 8;
    const winW = (window.innerWidth || document.documentElement.clientWidth);
    const winH = (window.innerHeight || document.documentElement.clientHeight);

    const els = [document.getElementById('tn-vehicle-menu'), document.getElementById('tn-vehicle-toggle'), document.getElementById('tn-hud'), document.getElementById('tn-controls-panel'), document.querySelector('.tn-title'), document.getElementById('journal'), document.getElementById('journalToggle')];
    els.forEach(el => {
      if (!el) return;
      try{
        const rect = el.getBoundingClientRect();
        let top = rect.top;
        if (rect.top + rect.height > winH - padding) top = Math.max(padding, winH - rect.height - padding);
        if (rect.top < padding) top = padding;
        el.style.top = Math.round(top) + 'px';

        const computed = window.getComputedStyle(el);
        if (rect.right > winW - padding){ el.style.right = padding + 'px'; el.style.left = 'auto'; }
        if (rect.left < padding){ el.style.left = padding + 'px'; el.style.right = 'auto'; }

        const newRect = el.getBoundingClientRect();
        if (newRect.width > winW - padding*2){ el.style.maxWidth = (winW - padding*2) + 'px'; }
      }catch(_){ }
    });
  }catch(_){ }
}

// stylized HUD: hearts for health and pill-shaped score badge
export function updateHud(){
  try{ installHudStyles(); }catch(err){ try{ console.warn('installHudStyles failed', err); }catch(_){ } }
  const hud = document.getElementById('hud');

  const { paused, shieldActive, shieldUntil, shieldCooldownUntil, envPowerupStage, envPowerupCooldown, MAX_HEALTH, health, score, VEHICLE_SLOTS, VEHICLE_UNLOCKED, selectedVehicle, selectedVehicleVariant } = _getState();

  const current = Math.max(1, Math.min(4, (tank.shotCount || 1)));
  let dots = '';
  for (let i=1;i<=4;i++){ dots += `<div class="tn-dot${i<=current? ' active':''}"></div>`; }
  const phaseLabel = (current === 1) ? t('single') : (current === 2 ? t('double') : (current === 3 ? t('triple') : t('quad')));

  const waveInfo = waveInProgress ? `Wave ${currentWave}/${MAX_WAVES}` : `Wave ${currentWave} Complete`;
  const scoreHTML = `<div class="tn-panel tn-center"><div class="tn-logo">${t('tank_nutz')}</div></div>`;

  let pu = '';
  const nowt = performance.now();
  if (tank.shotCount && tank.powerupUntil && nowt < tank.powerupUntil){
    const sec = Math.ceil((tank.powerupUntil - nowt)/1000);
    let label = 'Double';
    if (tank.shotCount === 3) label = 'Triple';
    else if (tank.shotCount === 4) label = 'Quad';
    else if (tank.shotCount === 5) label = 'Pet';
    pu = `<div class="tn-panel tn-powerup">${label} (${sec}s)</div>`;
  }

  let shieldInfo = '';
  if (shieldActive && nowt < shieldUntil){
    const sec = Math.ceil((shieldUntil - nowt)/1000);
    shieldInfo = `<div class="tn-panel tn-shield">Shield (${sec}s)</div>`;
  } else if (nowt < shieldCooldownUntil){
    const sec = Math.ceil((shieldCooldownUntil - nowt)/1000);
    shieldInfo = `<div class="tn-panel tn-shield-cooldown">Shield CD (${sec}s)</div>`;
  }

  let envCooldownInfo = '';
  if (nowt < envPowerupCooldown){
    const sec = Math.ceil((envPowerupCooldown - nowt)/1000);
    const stageColor = envPowerupStage === 1 ? '#ffd700' : envPowerupStage === 2 ? '#c0c0c0' : '#cd7f32';
    envCooldownInfo = `<div class="tn-panel tn-env-cooldown" style="background:linear-gradient(180deg,${stageColor},${stageColor}aa);color:#000;border:1px solid ${stageColor}88">Stage ${envPowerupStage} (${sec}s)</div>`;
  }

  let hearts = '';
  const h = Math.max(0, Math.min(typeof MAX_HEALTH === 'number' ? MAX_HEALTH : 5, health || 0));
  for (let i=0;i<(typeof MAX_HEALTH === 'number' ? MAX_HEALTH : 5); i++){ hearts += `<div class="tn-heart" style="opacity:${i < h ? 1 : 0.25}"></div>`; }

  let leftContent = `<div class="tn-bolts" title="bolted"></div>`;
  if (pu) leftContent += `<div class="tn-status-item">${pu}</div>`;
  if (shieldInfo) leftContent += `<div class="tn-status-item">${shieldInfo}</div>`;
  if (envCooldownInfo) leftContent += `<div class="tn-status-item">${envCooldownInfo}</div>`;
  const leftHTML = leftContent;

  const rightHTML = `<div class="tn-panel tn-right"><div class="tn-health" style="margin-left:8px">${hearts}</div></div>`;

  try{
    if (hud){
      hud.innerHTML = '';
      const left = document.createElement('div'); left.className = 'tn-panel tn-left'; left.innerHTML = leftHTML; hud.appendChild(left);
      const right = document.createElement('div'); right.className = 'tn-right'; right.innerHTML = rightHTML; hud.appendChild(right);
    }
    // Vehicle menu
    if (typeof window !== 'undefined' && window.__debugVehicleSlots) try{ console.log('DEBUG: updateHud vehicle slots before rebuild', VEHICLE_SLOTS, VEHICLE_UNLOCKED); }catch(_){ }
    let vmenu = document.getElementById('tn-vehicle-menu');
    let vtoggle = document.getElementById('tn-vehicle-toggle');
    if (!vmenu){ vmenu = document.createElement('div'); vmenu.id = 'tn-vehicle-menu'; vmenu.className = 'tn-vehicle-menu closed'; document.body.appendChild(vmenu); }
    if (!vtoggle){
      vtoggle = document.createElement('div');
      vtoggle.id = 'tn-vehicle-toggle';
      vtoggle.className = 'tn-vehicle-toggle';
      vtoggle.innerText = 'Tanks off';
      vtoggle.addEventListener('click', ()=>{
        const journal = document.getElementById('journal');
        const isClosed = vmenu.classList.contains('closed');
        if (isClosed){
          vmenu.classList.remove('closed'); vmenu.classList.add('open'); vtoggle.innerText = 'Tanks'; vtoggle.classList.remove('closed');
          if (journal && !journal.classList.contains('closed')){
            journal.classList.add('closed'); journal.classList.remove('open');
            const jtoggle = document.getElementById('journalToggle');
            if (jtoggle) jtoggle.innerText = 'Journal off';
            if (jtoggle) jtoggle.classList.add('closed');
          }
        } else {
          vmenu.classList.add('closed'); vmenu.classList.remove('open'); vtoggle.innerText = 'Tanks off'; vtoggle.classList.add('closed');
        }
      });
      document.body.appendChild(vtoggle);
    }
    try{
      const journalTop = (hud && hud.classList && hud.classList.contains('tn-hud')) ? '94px' : '12px';
      const tankTop = `calc(${journalTop} + 48px)`;
      vtoggle.style.top = tankTop; vtoggle.style.right = '20px'; vmenu.style.top = tankTop; vmenu.style.right = '20px';
    }catch(_){ }

    vmenu.innerHTML = '';
    // Title removed in original after creation; keep slots only
    for (let i=0;i<VEHICLE_SLOTS.length;i++){
      if (typeof window !== 'undefined' && window.__debugVehicleSlots) try{ console.log('DEBUG: building slot', i, VEHICLE_SLOTS[i], VEHICLE_UNLOCKED[i]); }catch(_){ }
      const slot = document.createElement('div');
      const sel = (
        (VEHICLE_SLOTS[i] === 'tank' && selectedVehicle === 'tank' && selectedVehicleVariant === 'default') ||
        (VEHICLE_SLOTS[i] === 'fordfiesta' && selectedVehicleVariant === 'fordfiesta') ||
        (VEHICLE_SLOTS[i] === 'murkia' && selectedVehicleVariant === 'murkia') ||
        (VEHICLE_SLOTS[i] === 'dozer' && selectedVehicleVariant === 'dozer') ||
        (VEHICLE_SLOTS[i] === 'bondtank' && selectedVehicleVariant === 'bondtank') ||
        (VEHICLE_SLOTS[i] === 'empty6' && selectedVehicleVariant === 'german') ||
        (VEHICLE_SLOTS[i] === 'empty7' && selectedVehicleVariant === 'mexico') ||
        (VEHICLE_SLOTS[i] === 'empty8' && selectedVehicleVariant === 'china') ||
        (VEHICLE_SLOTS[i] === 'empty9' && selectedVehicleVariant === 'mcds') ||
        (VEHICLE_SLOTS[i] === 'french' && selectedVehicleVariant === 'french') ||
        (VEHICLE_SLOTS[i] === 'facebook' && selectedVehicleVariant === 'facebook') ||
        (VEHICLE_SLOTS[i] === 'waffle' && selectedVehicleVariant === 'waffle') ||
        (VEHICLE_SLOTS[i] === 'blackstar' && selectedVehicleVariant === 'blackstar') ||
        (VEHICLE_SLOTS[i] === 'heli' && selectedVehicle === 'heli')
      );
      slot.className = 'vehicle-slot' + (VEHICLE_UNLOCKED[i] ? '' : ' locked') + (sel ? ' selected' : '');
      slot.dataset.idx = i;
      slot.addEventListener('pointerdown', (ev)=>{ try{ const idx = Number(slot.dataset.idx); if (VEHICLE_UNLOCKED[idx]) _actions.selectVehicleSlot(idx); ev.stopPropagation(); }catch(_){ } });

      // Add progressive saw-cost badge for tanks (skip heli)
      try{
        const isTankLike = (VEHICLE_SLOTS[i] !== 'heli');
        if (isTankLike){
          const cost = (i + 1) * 100; // progressively more expensive down the list (100s)
          const costWrap = document.createElement('div');
          costWrap.className = 'slot-cost';
          costWrap.style.display = 'flex'; costWrap.style.alignItems = 'center'; costWrap.style.gap = '6px'; costWrap.style.justifyContent = 'center'; costWrap.style.marginTop = '6px';
          // small saw/disk icon canvas
          try{
            const iconSz = 20;
            const ic = document.createElement('canvas'); ic.width = iconSz; ic.height = iconSz; ic.style.width = iconSz + 'px'; ic.style.height = iconSz + 'px';
            const ictx = ic.getContext('2d'); try{ ictx.imageSmoothingEnabled = false; }catch(_){ }
            try{ if (typeof window !== 'undefined' && typeof window.drawCollectLowResIntoPowerup === 'function') window.drawCollectLowResIntoPowerup(ictx, iconSz/2, iconSz/2, performance.now(), 'collect-saw'); else { ictx.fillStyle='#ccc'; ictx.fillRect(0,0,iconSz,iconSz); } }catch(_){ try{ ictx.fillStyle='#ccc'; ictx.fillRect(0,0,iconSz,iconSz); }catch(_){ } }
            costWrap.appendChild(ic);
          }catch(_){ }
          const txt = document.createElement('div'); txt.style.fontSize = '12px'; txt.style.color = '#ffd36b'; txt.style.fontWeight = '700'; txt.innerText = cost.toLocaleString();
          costWrap.appendChild(txt);
          // append now so it appears below the slot label or artwork
          slot.appendChild(costWrap);
        }
      }catch(_){ }

      try{ ensureHudInView(); if (!__hud_viewguard_installed){ window.addEventListener('resize', ensureHudInView); __hud_viewguard_installed = true; } }catch(_){ }

      if (VEHICLE_UNLOCKED[i]){
        if (VEHICLE_SLOTS[i] === 'tank'){
          try{
            if (typeof bodyCanvas !== 'undefined' && bodyCanvas){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Default';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ } g.clearRect(0,0,cw,ch);
              const bw = bodyCanvas.width || SPR_W * SPRITE_SCALE; const bh = bodyCanvas.height || SPR_H * SPRITE_SCALE;
              const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1);
              const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2);
              try{ g.drawImage(bodyCanvas, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              try{ if (typeof turretCanvas !== 'undefined' && turretCanvas){ const tw = turretCanvas.width, th = turretCanvas.height; g.drawImage(turretCanvas, 0,0,tw,th, dx,dy, Math.round(tw*scale), Math.round(th*scale)); } }catch(_){ }
            } else {
              slot.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:18px">TANK</div><div class="slot-label" style="font-size:11px">Default</div></div>';
              vmenu.appendChild(slot);
            }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">TANK</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'heli'){
          slot.innerHTML = '<div style="display:flex;flex-direction:column;align-items:center;gap:4px"><div style="font-size:18px">HELI</div><div class="slot-label" style="font-size:11px">Unlocked</div></div>';
          vmenu.appendChild(slot);
        }
        else if (VEHICLE_SLOTS[i] === 'fordfiesta'){
          try{
            if (typeof drawFordFiestaInto === 'function'){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Fiesta';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
              try{ drawFordFiestaInto(g, cw, ch, performance.now()); }catch(_){ }
            } else { slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'empty6'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'German';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__german_body){ const bw = window.__german_body.width, bh = window.__german_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__german_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawGermanBodyInto === 'function'){
                try{ drawGermanBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'empty7'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Mexico';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__mexico_body){ const bw = window.__mexico_body.width, bh = window.__mexico_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__mexico_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawMexicoBodyInto === 'function'){
                try{ drawMexicoBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'empty8'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'China';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__china_body){ const bw = window.__china_body.width, bh = window.__china_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__china_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawChinaBodyInto === 'function'){
                try{ drawChinaBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'empty9'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = "McD's";
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__mcds_body){ const bw = window.__mcds_body.width, bh = window.__mcds_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__mcds_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawMcdsBodyInto === 'function'){
                try{ drawMcdsBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'murkia'){
          try{
            if (typeof drawMurkiaInto === 'function'){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Murkia';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
              try{ drawMurkiaInto(g, cw, ch, performance.now()); }catch(_){ }
            } else { slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'dozer'){
          try{
            if (typeof drawDozerInto === 'function'){
              const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
              const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Dozer';
              slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
              const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
              c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
              try{ drawDozerInto(g, cw, ch, performance.now()); }catch(_){ }
            } else { slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'bondtank'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Bond';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && !window.__bondtank_body && typeof drawBondtankInto === 'function'){
                const off = document.createElement('canvas'); off.width = 64; off.height = 64; const og = off.getContext('2d'); try{ og.imageSmoothingEnabled = false; }catch(_){ }
                try{ drawBondtankInto(og, 64, 64, performance.now()); }catch(_){ }
                window.__bondtank_body = off;
                const off2 = document.createElement('canvas'); off2.width = 64; off2.height = 64; const og2 = off2.getContext('2d'); try{ og2.imageSmoothingEnabled = false; }catch(_){ }
                og2.clearRect(0,0,64,64); window.__bondtank_turret = off2;
              }
            }catch(_){ }
            if (typeof window !== 'undefined' && window.__bondtank_body){
              try{
                const bw = window.__bondtank_body.width || SPR_W * SPRITE_SCALE; const bh = window.__bondtank_body.height || SPR_H * SPRITE_SCALE;
                const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1);
                const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2);
                try{ g.drawImage(window.__bondtank_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
                try{ if (typeof window.__bondtank_turret !== 'undefined' && window.__bondtank_turret){ const tw = window.__bondtank_turret.width, th = window.__bondtank_turret.height; g.drawImage(window.__bondtank_turret, 0,0,tw,th, dx,dy, Math.round(tw*scale), Math.round(th*scale)); } }catch(_){ }
              }catch(_){ }
            } else {
              try{ if (typeof drawBondtankInto === 'function') drawBondtankInto(g, cw, ch, performance.now()); }catch(_){ }
            }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'facebook'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Facebook';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__facebook_body){ const bw = window.__facebook_body.width, bh = window.__facebook_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__facebook_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawFacebookBodyInto === 'function'){
                try{ drawFacebookBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'waffle'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Waffle';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__waffle_body){ const bw = window.__waffle_body.width, bh = window.__waffle_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__waffle_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawWaffleBodyInto === 'function'){
                try{ drawWaffleBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] === 'blackstar'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Blackstar';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{ if (typeof drawBlackstarBodyInto === 'function') drawBlackstarBodyInto(g, cw, ch, performance.now()); }catch(_){ }
            try{ if (typeof drawBlackstarTurretInto === 'function') drawBlackstarTurretInto(g, cw, ch, performance.now()); }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
        else if (VEHICLE_SLOTS[i] && VEHICLE_SLOTS[i].startsWith && VEHICLE_SLOTS[i].startsWith('empty')){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px';
            const idx = i + 1; label.textContent = 'Empty ' + idx;
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              g.fillStyle = '#1f1f1f'; g.fillRect(0,0,cw,ch);
              g.fillStyle = '#2f2f2f'; g.fillRect(6,6, Math.max(8,cw-12), Math.max(8,ch-12));
              g.fillStyle = '#cfcfcf'; g.font = Math.max(10, Math.floor(ch/5)) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
              g.fillText('Empty', cw/2, ch/2);
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:18px">?</div>'; vmenu.appendChild(slot); }
        }
      } else {
        if (VEHICLE_SLOTS[i] === 'bondtank'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'Bond (locked)';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            if (typeof window !== 'undefined' && window.__bondtank_body){
              try{
                const bw = window.__bondtank_body.width || SPR_W * SPRITE_SCALE; const bh = window.__bondtank_body.height || SPR_H * SPRITE_SCALE;
                const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1);
                const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2);
                try{ g.drawImage(window.__bondtank_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              }catch(_){ }
            } else if (typeof drawBondtankInto === 'function'){
              try{ drawBondtankInto(g, cw, ch, performance.now()); }catch(_){ }
            } else {
              slot.innerHTML = '<div style="font-size:22px">?</div>';
              vmenu.appendChild(slot);
            }
          }catch(_){ slot.innerHTML = '<div style="font-size:22px">?</div>'; vmenu.appendChild(slot); }
        } else if (VEHICLE_SLOTS[i] === 'empty6'){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px'; label.textContent = 'German (locked)';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              if (typeof window !== 'undefined' && window.__german_body){ const bw = window.__german_body.width, bh = window.__german_body.height; const scale = Math.min((cw-8)/bw, (ch-6)/bh, 1); const dx = Math.round((cw - bw*scale)/2); const dy = Math.round((ch - bh*scale)/2); try{ g.drawImage(window.__german_body, 0,0,bw,bh, dx,dy, Math.round(bw*scale), Math.round(bh*scale)); }catch(_){ }
              } else if (typeof drawGermanBodyInto === 'function'){
                try{ drawGermanBodyInto(g, cw, ch, performance.now()); }catch(_){ }
              }
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:22px">?</div>'; vmenu.appendChild(slot); }
        } else if (VEHICLE_SLOTS[i] && VEHICLE_SLOTS[i].startsWith && VEHICLE_SLOTS[i].startsWith('empty')){
          try{
            const c = document.createElement('canvas'); c.style.display = 'block'; c.style.width = '100%';
            const label = document.createElement('div'); label.className = 'slot-label'; label.style.fontSize = '11px'; label.style.marginTop = '6px';
            const idx = i + 1; label.textContent = 'Empty ' + idx + ' (locked)';
            slot.appendChild(c); slot.appendChild(label); vmenu.appendChild(slot);
            const cw = Math.max(32, Math.floor(slot.clientWidth)); const ch = Math.max(24, Math.floor(slot.clientHeight - label.offsetHeight - 6));
            c.width = cw; c.height = ch; const g = c.getContext('2d'); try{ g.imageSmoothingEnabled = false; }catch(_){ }
            try{
              g.fillStyle = '#111'; g.fillRect(0,0,cw,ch);
              g.fillStyle = '#262626'; g.fillRect(6,6, Math.max(8,cw-12), Math.max(8,ch-12));
              g.fillStyle = '#999'; g.font = Math.max(10, Math.floor(ch/6)) + 'px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
              g.fillText('Locked', cw/2, ch/2);
            }catch(_){ }
          }catch(_){ slot.innerHTML = '<div style="font-size:22px">?</div>'; vmenu.appendChild(slot); }
        } else {
          slot.innerHTML = '<div style="font-size:22px">?</div>';
          vmenu.appendChild(slot);
        }
      }
    }
  }catch(_){ }

  // Controls panel
  try{
    let ctrl = document.getElementById('tn-controls-panel');
    if (!ctrl){ ctrl = document.createElement('div'); ctrl.id = 'tn-controls-panel'; ctrl.className = 'tn-controls-panel'; try{ ctrl.style.zIndex = '30002'; ctrl.style.pointerEvents = 'auto'; }catch(_){ } document.body.appendChild(ctrl); }
    ctrl.innerHTML = `
      <button id="tn-pause-btn" class="tn-big-btn">${_getState().paused ? t('resume') : t('pause')}</button>
      <button id="tn-sound-btn" class="tn-big-btn">${t('sound')}</button>
      <button id="tn-open-controls" class="tn-big-btn">${t('controls')}</button>
      <button id="tn-lang-btn" class="tn-big-btn">Lang</button>
    `;
    let phaseDiv = document.getElementById('tn-phase-div'); if (!phaseDiv){ phaseDiv = document.createElement('div'); phaseDiv.id = 'tn-phase-div'; phaseDiv.className = 'tn-phase-div'; ctrl.appendChild(phaseDiv); }
    let cooldownDiv = document.getElementById('tn-cooldown-div'); if (!cooldownDiv){ cooldownDiv = document.createElement('div'); cooldownDiv.id = 'tn-cooldown-div'; cooldownDiv.className = 'tn-cooldown-div'; ctrl.appendChild(cooldownDiv); }
    let powerupDiv = document.getElementById('tn-powerup-div'); if (!powerupDiv){ powerupDiv = document.createElement('div'); powerupDiv.id = 'tn-powerup-div'; powerupDiv.className = 'tn-powerup-div'; ctrl.appendChild(powerupDiv); }
    let waveDiv = document.getElementById('tn-wave-div'); if (!waveDiv){ waveDiv = document.createElement('div'); waveDiv.id = 'tn-wave-div'; waveDiv.className = 'tn-wave-div'; ctrl.appendChild(waveDiv); }
    let scoreDiv = document.getElementById('tn-score-div'); if (!scoreDiv){ scoreDiv = document.createElement('div'); scoreDiv.id = 'tn-score-div'; scoreDiv.className = 'tn-score-div'; ctrl.appendChild(scoreDiv); }

    try{
      if (!ctrl._hasDelegate) {
        ctrl.addEventListener('click', (ev)=>{
          try{
            const t1 = ev.target;
            if (t1 && (t1.id === 'tn-lang-btn' || (t1.closest && t1.closest && t1.closest('#tn-lang-btn')))){
              try{ if (typeof window.openLangMenu === 'function') { window.openLangMenu(); return; } }catch(_){ }
              try{ if (typeof openLangMenu === 'function') openLangMenu(); }catch(_){ }
            }
          }catch(_){ }
        });
        ctrl._hasDelegate = true;
      }
    }catch(_){ }

    const pauseBtn = document.getElementById('tn-pause-btn');
    const soundBtn = document.getElementById('tn-sound-btn');
    const langBtn = document.getElementById('tn-lang-btn');
    try {
      if (langBtn) {
        langBtn.addEventListener('pointerdown', (ev) => {
          try { setTimeout(()=>{ try{ langBtn.click(); }catch(_){ } }, 0); } catch (_) { }
        });
      }
    } catch (_) { }

    // Ensure language helpers exist fallback
    try{
      if (typeof window.openLangMenu !== 'function'){
        window.closeLangMenu = function(){ try{ const m = document.getElementById('tn-lang-menu'); if (m) m.remove(); }catch(_){ } };
        window.openLangMenu = function(){ try{
          if (typeof window.setLang === 'function' && typeof window.getLang === 'function'){
            const langs = (window.__i18n && window.__i18n.languages) ? window.__i18n.languages : ['en'];
            const langNames = { en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch', zh: '中文' };
            try{
              window.closeLangMenu();
              const menu = document.createElement('div'); menu.id = 'tn-lang-menu'; menu.style.position = 'absolute';
              menu.style.background = 'linear-gradient(180deg,#111,#000)'; menu.style.border = '1px solid #222'; menu.style.borderRadius = '6px'; menu.style.padding = '6px'; menu.style.zIndex = 30000; menu.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)'; menu.style.color = '#fff'; menu.style.minWidth = '140px';
              langs.forEach(code=>{ const it = document.createElement('div'); it.style.padding = '8px 10px'; it.style.cursor = 'pointer'; it.style.borderRadius = '4px'; it.style.fontWeight = '700'; it.textContent = (langNames[code] || code) + ' (' + code.toUpperCase() + ')'; it.onclick = ()=>{ try{ if (window.setLang) window.setLang(code); }catch(_){ } try{ menu.remove(); }catch(_){} }; menu.appendChild(it); });
              document.body.appendChild(menu);
              try{
                const btn = document.getElementById('tn-lang-btn'); const rect = btn && btn.getBoundingClientRect();
                if (rect){ menu.style.left = (rect.right + 6 + (window.scrollX||0)) + 'px'; menu.style.top = (rect.top + (window.scrollY||0)) + 'px'; menu.style.right = 'auto'; }
                else { menu.style.right = '12px'; menu.style.top = '120px'; }
                const mrect = menu.getBoundingClientRect();
                if (rect && mrect.right > window.innerWidth){ const newLeft = rect.left - mrect.width - 6 + (window.scrollX||0); menu.style.left = newLeft + 'px'; menu.style.right = 'auto'; }
              }catch(_){ }
              setTimeout(()=>{ const onDoc = (ev)=>{ if (!menu.contains(ev.target)) { try{ menu.remove(); }catch(_){ } document.removeEventListener('pointerdown', onDoc); } }; document.addEventListener('pointerdown', onDoc); }, 10);
            }catch(_){ }
          } else {
            try{ window.closeLangMenu(); const menu = document.createElement('div'); menu.id = 'tn-lang-menu'; menu.style.position = 'absolute'; menu.style.background = 'linear-gradient(180deg,#111,#000)'; menu.style.border = '1px solid #222'; menu.style.borderRadius = '6px'; menu.style.padding = '8px'; menu.style.zIndex = 30000; menu.style.color = '#fff'; menu.style.minWidth = '160px'; const it = document.createElement('div'); it.style.padding='6px 8px'; it.style.color='#ccc'; it.textContent = 'No language packs available'; menu.appendChild(it); document.body.appendChild(menu);
              try{ const btn = document.getElementById('tn-lang-btn'); const rect = btn && btn.getBoundingClientRect(); if (rect){ menu.style.left = (rect.right + 6 + (window.scrollX||0)) + 'px'; menu.style.top = (rect.top + (window.scrollY||0)) + 'px'; menu.style.right = 'auto'; } else { menu.style.right = '12px'; menu.style.top = '120px'; } const mrect = menu.getBoundingClientRect(); if (rect && mrect.right > window.innerWidth){ const newLeft = rect.left - mrect.width - 6 + (window.scrollX||0); menu.style.left = newLeft + 'px'; menu.style.right = 'auto'; } }catch(_){ }
              setTimeout(()=>{ const onDoc = (ev)=>{ if (!menu.contains(ev.target)) { try{ menu.remove(); }catch(_){ } document.removeEventListener('pointerdown', onDoc); } }; document.addEventListener('pointerdown', onDoc); }, 10);
            }catch(_){ }
          }
        }catch(_){ } };
      }
    }catch(_){ }

    if (pauseBtn){ pauseBtn.onclick = ()=>{ try{ _actions.togglePause && _actions.togglePause(); }catch(_){ } pauseBtn.textContent = _getState().paused ? t('resume') : t('pause'); pauseBtn.classList.toggle('toggled', _getState().paused); updateHud(); }; pauseBtn.classList.toggle('toggled', _getState().paused); }
    try{
      let enabled = true;
      try{ const s = (localStorage && localStorage.getItem && localStorage.getItem('tn_sound_enabled')); if (s !== null) enabled = (s === '1' || s === 'true'); else if (SFX && typeof SFX.isEnabled === 'function') enabled = SFX.isEnabled(); }catch(_){ }
      if (soundBtn){ soundBtn.textContent = enabled ? t('sound_on') : t('sound_off'); soundBtn.classList.toggle('toggled', enabled); soundBtn.onclick = ()=>{ enabled = !enabled; try{ if (SFX && typeof SFX.setEnabled === 'function') SFX.setEnabled(enabled); }catch(_){ } try{ localStorage && localStorage.setItem && localStorage.setItem('tn_sound_enabled', enabled ? '1' : '0'); }catch(_){ } soundBtn.textContent = enabled ? t('sound_on') : t('sound_off'); soundBtn.classList.toggle('toggled', enabled); }; }
    }catch(_){ }
    try{ const openBtn = document.getElementById('tn-open-controls'); if (openBtn){ openBtn.onclick = ()=>{ try{ showControlsModal(); }catch(_){ } }; } }catch(_){ }
  }catch(_){ }

  // Localized refresh wiring
  try{
    function refreshLocalizedText(){ try{ updateHud(); try{ const lb = document.getElementById('tn-lang-btn'); if (lb) lb.textContent = (window.getLang() || 'en').toUpperCase(); }catch(_){ } try{ const titleEl = document.getElementById('tn-title'); if (titleEl) titleEl.innerHTML = `<div class="tn-logo">${t('tank_nutz')}</div>`; }catch(_){ } try{ if (typeof updateJournal === 'function') updateJournal(); }catch(_){ } try{ const go = document.getElementById('tn-gameover-inner'); if (go){ try{ const title = go.querySelector('div'); if (title) title.innerHTML = t('you_died'); }catch(_){ } } }catch(_){ } }catch(_){ } }
    if (typeof window !== 'undefined' && typeof window.addEventListener === 'function'){ window.addEventListener('tn-lang-changed', ()=>{ try{ refreshLocalizedText(); }catch(_){ } }); }
  }catch(_){ }

  // Title
  try{
    let titleEl = document.getElementById('tn-title');
    if (!titleEl){ titleEl = document.createElement('div'); titleEl.id = 'tn-title'; titleEl.className = 'tn-title'; document.body.appendChild(titleEl); }
    titleEl.innerHTML = `<div class="tn-logo">${t('tank_nutz')}</div>`;
  }catch(_){ try{ if (hud) hud.innerHTML = scoreHTML; }catch(__){} }

  try{ updateJournal(); }catch(_){ }

  // Update auxiliary panels
  try{
    const phaseDiv = document.getElementById('tn-phase-div'); if (phaseDiv) phaseDiv.innerHTML = `<div class="tn-panel tn-phase" style="margin-top:4px"><div class="tn-shoot-dots">${dots}</div><div style="font-size:12px;color:#ccc;margin-top:4px">${phaseLabel}</div></div>`;
    const cooldownDiv = document.getElementById('tn-cooldown-div'); if (cooldownDiv){ const pieces = []; if (shieldInfo) pieces.push(shieldInfo); if (envCooldownInfo) pieces.push(envCooldownInfo); cooldownDiv.innerHTML = pieces.length ? pieces.join('') : `<div class="tn-panel tn-cooldown-placeholder" style="margin-top:4px;padding:6px 10px;font-size:12px;color:#d7cdbf">Cooldowns: None</div>`; }
    const powerupDiv = document.getElementById('tn-powerup-div'); if (powerupDiv) powerupDiv.innerHTML = pu || '';
    const waveDiv = document.getElementById('tn-wave-div'); if (waveDiv) waveDiv.innerHTML = `<div class="tn-panel" style="margin-top:4px;font-size:12px;color:#ffd700">${waveInfo}</div>`;
    const scoreDiv = document.getElementById('tn-score-div'); if (scoreDiv) scoreDiv.innerHTML = `<div class="tn-panel" style="margin-top:4px"><div class="tn-score">${t('score')}: ${score}</div></div>`;
  }catch(_){ }
}

// Game over modal helpers
export function showGameOverModal(sc){
  try{
    let m = document.getElementById('tn-gameover-modal');
    if (!m){
      m = document.createElement('div'); m.id = 'tn-gameover-modal';
      m.style.position = 'fixed'; m.style.left = '0'; m.style.top = '0'; m.style.width = '100%'; m.style.height = '100%'; m.style.display = 'flex'; m.style.alignItems = 'center'; m.style.justifyContent = 'center'; m.style.zIndex = 20000; m.style.pointerEvents = 'auto';
      const inner = document.createElement('div'); inner.id = 'tn-gameover-inner'; inner.style.background = 'linear-gradient(180deg,#221,#000)'; inner.style.padding = '20px 28px'; inner.style.border = '3px solid #111'; inner.style.borderRadius = '8px'; inner.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6)'; inner.style.color = '#fff'; inner.style.textAlign = 'center';
      inner.innerHTML = `<div style="font-size:28px;font-weight:900;margin-bottom:6px">${t('you_died')}</div><div style="margin-bottom:12px">${t('score')}: <span id="tn-gameover-score">${sc}</span></div>`;
      const btn = document.createElement('button'); btn.textContent = t('restart'); btn.style.padding = '10px 14px'; btn.style.fontWeight = '800'; btn.style.borderRadius = '6px'; btn.style.cursor = 'pointer'; btn.onclick = ()=>{ try{ hideGameOverModal(); _actions.restart && _actions.restart(); }catch(_){ } };
      inner.appendChild(btn);
      m.appendChild(inner);
      document.body.appendChild(m);
    } else {
      const scoreEl = document.getElementById('tn-gameover-score'); if (scoreEl) scoreEl.textContent = ''+sc; m.style.display = 'flex';
    }
  }catch(_){ }
}
export function hideGameOverModal(){ try{ const m = document.getElementById('tn-gameover-modal'); if (m) m.style.display = 'none'; }catch(_){ } }

// Controls modal
export function showControlsModal(){
  try{
    let m = document.getElementById('tn-controls-modal');
    if (!m){
      m = document.createElement('div'); m.id = 'tn-controls-modal'; m.className = 'tn-controls-modal';
      const backdrop = document.createElement('div'); backdrop.className = 'tn-controls-backdrop'; backdrop.onclick = hideControlsModal;
      const inner = document.createElement('div'); inner.className = 'tn-controls-inner';
      inner.innerHTML = `<div class="tn-controls-title">${t('controls_title')}</div>`;
      function row(iconSvg, title, desc){ const r = document.createElement('div'); r.className='tn-control-row'; const ic = document.createElement('div'); ic.className='tn-control-icon'; ic.innerHTML = iconSvg; const lab = document.createElement('div'); lab.innerHTML = `<div class="tn-control-label" style="font-weight:800">${title}</div><div style="font-size:12px;color:#bbb">${desc}</div>`; r.appendChild(ic); r.appendChild(lab); return r; }
      const mouseSvg = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#dfe" stroke-width="1.6"><rect x="5" y="3" width="14" height="18" rx="7"/><path d="M12 3v8"/></svg>`;
      const keyboardSvg = `<svg viewBox="0 0 96 64" width="56" height="36" fill="none" stroke="#dfe" stroke-width="2"><rect x="2" y="8" width="92" height="48" rx="6" fill="#0b0c0d" stroke="#2b2b2b"/><g fill="#dfe" font-size="10" font-family="monospace" text-anchor="middle"><rect x="44" y="10" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="48" y="15">W</text><rect x="36" y="22" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="40" y="27">A</text><rect x="44" y="22" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="48" y="27">S</text><rect x="52" y="22" width="8" height="8" rx="1" fill="#2b2b2b"/><text x="56" y="27">D</text></g></svg>`;
      const gamepadSvg = `<svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="#dfe" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="3"/><path d="M8 10v4M6 12h4"/></svg>`;

      inner.appendChild(row(mouseSvg, t('left_click'), t('fire_weapon')));
      inner.appendChild(row(mouseSvg, t('mouse_aim'), t('mouse_aim_desc')));
      inner.appendChild(row(keyboardSvg, 'W / A / S / D', t('move_desc')));
      inner.appendChild(row(gamepadSvg, t('right_click_hold'), t('pause_vertical_scrolling')));
      inner.appendChild(row(gamepadSvg, t('shift_hold'), t('accel_desc')));

      const closeBtn = document.createElement('button'); closeBtn.className = 'tn-controls-close'; closeBtn.textContent = t('close'); closeBtn.onclick = hideControlsModal; inner.appendChild(closeBtn);
      m.appendChild(backdrop); m.appendChild(inner); document.body.appendChild(m);
    } else { m.style.display = 'flex'; }
  }catch(_){ }
}
export function hideControlsModal(){ try{ const m = document.getElementById('tn-controls-modal'); if (m) m.style.display = 'none'; }catch(_){ } }
