// Journal module: manages the on-screen journal UI and kill tallies
export const killCounts = {};
let hudRef = null;
let MAX_HEALTH_REF = null;
let healthRef = 0;
const JOURNAL_KEY = 'tn_journal_v1';
const SET1_PROGRESS_KEY = 'tn_set1_progress_v1';
// Set1 should require 100 combined collect pickups by default
const SET1_TARGET = 100;
// Combos: 3 sets of 3 kinds; default target per kind = 100
let combos = [];
let COMBOS_TARGET = 100;
const COMBO_SETS = 3;
const COMBO_SET_SIZE = 3;
// persistent claimed upgrades set (store by id string = kinds.join('|'))
let claimedUpgrades = new Set();
const CLAIM_KEY = 'tn_unlocked_upgrades';

// Translation helper: route visible text through available translation hooks
function tr(text){
  try{
    if (!text && text !== 0) return text;
    if (typeof window !== 'undefined'){
      if (typeof window.translateSwap === 'function') return window.translateSwap(text);
      if (typeof window.t === 'function') return window.t(text);
      if (typeof window.translate === 'function') return window.translate(text);
      if (typeof window._t === 'function') return window._t(text);
      if (typeof window.T === 'function') return window.T(text);
      if (window.TRANSLATIONS && typeof window.TRANSLATIONS === 'object' && window.TRANSLATIONS[text]) return window.TRANSLATIONS[text];
    }
  }catch(_){ }
  return text;
}

function loadClaimedUpgrades(){
  try{ const raw = localStorage.getItem(CLAIM_KEY); if (!raw) return; const arr = JSON.parse(raw); if (Array.isArray(arr)) arr.forEach(x=>claimedUpgrades.add(x)); }catch(_){ }
}

function saveJournalState(){
  try{
    const payload = { killCounts: {}, combos: combos || [] };
    for (const k of Object.keys(killCounts)){
      const info = killCounts[k];
      payload.killCounts[k] = { count: info.count || 0, imgSrc: info.imgSrc || null };
    }
    localStorage.setItem(JOURNAL_KEY, JSON.stringify(payload));
    // keep SET1 combined progress in sync with combos[0] if present
    try{
      if (combos && combos[0] && combos[0].kinds && combos[0].kinds.length){
        const aKind = combos[0].kinds[0];
        const val = combos[0].progress && typeof combos[0].progress[aKind] === 'number' ? combos[0].progress[aKind] : 0;
        try{ localStorage.setItem(SET1_PROGRESS_KEY, String(Math.max(0, parseInt(val,10) || 0))); }catch(_){ }
      }
    }catch(_){ }
  }catch(_){ }
}

function loadJournalState(){
  try{
    const raw = localStorage.getItem(JOURNAL_KEY); if (!raw) return;
    const obj = JSON.parse(raw);
    if (obj && obj.killCounts){
      for (const k of Object.keys(obj.killCounts)){
        const v = obj.killCounts[k]; if (!killCounts[k]) killCounts[k] = { count: 0, imgSrc: null };
        killCounts[k].count = (v && typeof v.count === 'number') ? v.count : (killCounts[k].count || 0);
        killCounts[k].imgSrc = (v && v.imgSrc) ? v.imgSrc : killCounts[k].imgSrc || null;
      }
    }
    // restore combos if present (optional)
    try{ if (obj && obj.combos && Array.isArray(obj.combos) && (!combos || !combos.length)) combos = obj.combos; }catch(_){ }
  }catch(_){ }
}
function saveClaimedUpgrades(){
  try{ localStorage.setItem(CLAIM_KEY, JSON.stringify(Array.from(claimedUpgrades))); }catch(_){ }
}

export function initJournal(options = {}){
  hudRef = options.hud || null;
  if (typeof options.maxHealth === 'number') MAX_HEALTH_REF = options.maxHealth;
  if (typeof options.health === 'number') healthRef = options.health;
  // load persisted journal state before rendering
  try{ loadClaimedUpgrades(); loadJournalState(); }catch(_){ }
  ensureJournal(); updateJournal();
  try{ renderCombos(); }catch(_){ }
  // If player already claimed upgrades for Set 1 in a previous session, notify game to sync HUD
  try{
    // build the id for set 1 if combos were initialized
    if (combos && combos[0] && Array.isArray(combos[0].kinds)){
      const id0 = combos[0].kinds.join('|');
      if (claimedUpgrades.has(id0)){
        try{ setTimeout(()=>{ try{ window.dispatchEvent(new CustomEvent('upgradeClaimed', { detail: { setIndex: 0, combo: combos[0], id: id0 } })); }catch(_){ } }, 0); }catch(_){ }
      }
    }
  }catch(_){ }
}

function ensureJournal(){
  if (document.getElementById('journal')) return;
  // inject lightweight tank-themed styles for the journal to avoid layout overlap
  if (!document.getElementById('journal-tank-styles')){
    const s = document.createElement('style'); s.id = 'journal-tank-styles'; s.innerHTML = `
      #journal{ position:fixed; right:12px; top:12px; width:260px; max-height:60vh; background:linear-gradient(180deg,#151719,#0f1113); color:#e6e6e6; border:2px solid #0b0b0b; border-radius:8px; padding:8px; z-index:9998; font-family:monospace; box-shadow:0 6px 18px rgba(0,0,0,0.6); }
  #journalLeft{ width:120px; float:left; margin-right:8px; }
  .combo-title{ font-weight:800; font-size:12px; margin-bottom:6px; color:#d7d7d7; }
  .combo-box{ background:linear-gradient(180deg,#111,#0b0b0b); border:1px solid #222; padding:6px; border-radius:6px; margin-bottom:6px; }
  .combo-hdr{ font-size:11px; font-weight:700; color:#cfcfcf; margin-bottom:4px; }
  .combo-line{ display:flex; align-items:center; gap:8px; }
  .combo-icons{ display:flex; gap:6px; align-items:center; }
  .combo-icon{ width:32px; height:32px; border:1px solid #222; background:#0b0b0b; border-radius:4px; display:flex; align-items:center; justify-content:center; overflow:hidden; }
  .combo-icon img{ width:100%; height:100%; object-fit:contain; display:block; }
  .combo-count{ position:relative; font-size:11px; color:#9fd08f; font-weight:700; text-align:center; margin-top:2px; }
  .combo-equals{ font-weight:900; color:#d7d7d7; font-size:14px; }
  .combo-upgrade{ width:40px; height:40px; border-radius:6px; border:1px dashed #444; display:flex; align-items:center; justify-content:center; color:#cfcfcf; background:linear-gradient(180deg,rgba(255,255,255,0.02),transparent); font-size:11px; }
  .combo-unlocked{ border:1px solid #7af07a; background:linear-gradient(180deg,#1b3f1b,#072007); color:#cfffe0; }
      #journal.closed{ height:36px; overflow:hidden; }
      .journal-toggle{ position:fixed; right:12px; top:12px; background:linear-gradient(180deg,#111,#0b0b0b); color:#e6e6e6; padding:6px 8px; border-radius:6px; cursor:pointer; z-index:9999; border:1px solid #222; }
      .journal-health{ display:flex; gap:6px; align-items:center; margin-bottom:6px; }
      .journal-hearts .heart.full{ color:#ff6b6b; }
      .journal-hearts .heart.empty{ color:#3a3a3a; }
      .journal-score{ font-weight:700; margin-bottom:4px; }
      .journal-hull{ font-size:12px; color:#cfcfcf; }
    `; document.head.appendChild(s); }
  const t = document.createElement('div'); t.id = 'journalToggle'; t.className = 'journal-toggle'; t.innerText = tr('Journal');
  const j = document.createElement('div'); j.id = 'journal'; j.className = 'journal open';
  const resetBtn = document.createElement('button'); resetBtn.id = 'journalReset'; resetBtn.innerText = tr('Reset Journal'); resetBtn.style.marginLeft = '8px'; resetBtn.style.padding = '6px'; resetBtn.style.fontSize = '12px'; resetBtn.style.cursor = 'pointer';
  const jl = document.createElement('div'); jl.id = 'journalLeft'; jl.className = 'journal-left';
  const jh = document.createElement('div'); jh.id = 'journalHealth'; jh.className = 'journal-health';
  const je = document.createElement('div'); je.id = 'journalEntries'; je.className = 'journal-entries grid'; je.setAttribute('role','list');
  // left column for combos
  jl.appendChild(document.createElement('div'));
  j.appendChild(jl);
  j.appendChild(jh); j.appendChild(je);
  document.body.appendChild(t); document.body.appendChild(j);
  // ensure initial state label is consistent (open by default so combos are visible)
  t.innerText = tr('Journal');
  t.addEventListener('click', ()=>{
    const isOpen = j.classList.toggle('open');
    if (isOpen){ j.classList.remove('closed'); t.innerText = tr('Journal'); }
    else { j.classList.add('closed'); t.innerText = tr('Journal off'); }
  });
  // If HUD is tank-themed, position journal below it to avoid overlap
  try{
    const topOffset = (hudRef && hudRef.classList && hudRef.classList.contains('tn-hud')) ? '94px' : '12px';
    t.style.top = topOffset; t.style.right = '12px'; t.style.position = 'fixed';
    j.style.top = topOffset; j.style.right = '12px'; j.style.position = 'fixed';
  }catch(_){ }
  // attach reset handler
  try{
    resetBtn.addEventListener('click', ()=>{
      try{ if (confirm && !confirm(tr('Reset Journal and claimed upgrades? This cannot be undone.'))) return; }catch(_){ }
      // clear storage (include Set1 combined progress so slot 1 truly resets)
      try{ localStorage.removeItem(JOURNAL_KEY); }catch(_){ }
      try{ localStorage.removeItem(CLAIM_KEY); }catch(_){ }
      try{ localStorage.removeItem(SET1_PROGRESS_KEY); }catch(_){ }
      // clear in-memory
      for (const k of Object.keys(killCounts)){ delete killCounts[k]; }
      claimedUpgrades = new Set();
      // reinitialize combos so the UI shows default sets immediately (avoids empty combos until reload)
      try{ initCombos(COMBOS_TARGET); }catch(_){ try{ initCombos(); }catch(_){ combos = []; } }
      try{ renderCombos(); }catch(_){ }
      try{ updateJournal(); }catch(_){ }
      // persist cleared claimed upgrades / journal state
      try{ saveClaimedUpgrades(); }catch(_){ }
      try{ saveJournalState(); }catch(_){ }
    });
  // notify game that journal was reset so it can lock vehicles / update HUD immediately
  try{ if (typeof window !== 'undefined'){ try{ window.dispatchEvent(new CustomEvent('journalReset', {})); }catch(_){ } } }catch(_){ }
  }catch(_){ }
  // add reset button next to toggle for convenience
  t.appendChild(resetBtn);
}

// --- Combo system ---
function pickRandomKinds(){
  // pick from existing recorded kinds if available, otherwise fallback to generic keys found on window
  const known = Object.keys(killCounts);
  const pool = known.length ? known.slice() : (window && window.JUNGLE_KINDS ? window.JUNGLE_KINDS.slice() : []);
  // if nothing available, create placeholders
  if (!pool || !pool.length){ pool.push('goblin','critter-0','billboard'); }
  // shuffle
  for (let i=pool.length-1;i>0;i--){ const r = Math.floor(Math.random()*(i+1)); const tmp = pool[i]; pool[i]=pool[r]; pool[r]=tmp; }
  const sets = [];
  let idx = 0;
  for (let s=0;s<COMBO_SETS;s++){
    const set = [];
    for (let k=0;k<COMBO_SET_SIZE;k++){
      set.push(pool[idx % pool.length] + (idx>=pool.length?'-'+Math.floor(idx/pool.length):'')); idx++;
    }
    sets.push(set);
  }
  return sets;
}

export function initCombos(targetPerKind = 100){
  COMBOS_TARGET = targetPerKind || COMBOS_TARGET;
  const sets = pickRandomKinds();
  // Ensure Set 1 contains the three heart kinds we want to display and track
  try{
    // For clarity next to health, use three unique collect items from Collects.html
    // picks: Saw Halo, Plasma Peanut, Boomer Crescent -> keys below
    const kSet = ['collect-saw','collect-peanut','collect-crescent'];
  // Force the first combo set to be exactly these three keys (trim/pad as needed)
  if (!sets[0]) sets[0] = [];
  // create a new array preserving order
  const newFirst = [];
  for (const k of kSet){ newFirst.push(k); }
  sets[0] = newFirst.slice(0, COMBO_SET_SIZE);
  }catch(_){ }
  combos = sets.map(s => ({ kinds: s.slice(), progress: s.reduce((acc,k)=>{ acc[k]=0; return acc; }, {}), target: COMBOS_TARGET, done: false }));
  // Mirror Set 1's kinds into Set 2 and Set 3, but give them higher per-kind targets
  try{
    // ensure rewards still set
    if (combos[1]) combos[1].reward = 'murkia';
    if (combos[2]) combos[2].reward = 'dozer';
    // If Set 1 exists, copy its kinds into sets 2 and 3 so they drop the same items
    if (combos[0] && Array.isArray(combos[0].kinds)){
      const k0 = combos[0].kinds.slice();
      if (combos[1]){
        combos[1].kinds = k0.slice();
        // set target to 200 for set 2 and initialize progress per-kind
        combos[1].target = 200;
        combos[1].progress = {};
        combos[1].kinds.forEach(k => { combos[1].progress[k] = 0; });
      }
      if (combos[2]){
        combos[2].kinds = k0.slice();
        // set target to 300 for set 3 and initialize progress per-kind
        combos[2].target = 300;
        combos[2].progress = {};
        combos[2].kinds.forEach(k => { combos[2].progress[k] = 0; });
      }
    }
  }catch(_){ }
  // Special-case: Set 1 should require SET1_TARGET combined pickups (rolling count across its kinds)
  try{
    if (combos && combos[0]){
      combos[0].target = SET1_TARGET;
      // load persisted combined progress
      let saved = 0;
      try{ const raw = localStorage.getItem(SET1_PROGRESS_KEY); if (raw) saved = Math.max(0, parseInt(raw,10) || 0); }catch(_){ saved = 0; }
      // set the same combined progress value for each kind so UI shows 0/10 for each
      try{ combos[0].kinds.forEach(k => { combos[0].progress[k] = saved; }); if (saved >= combos[0].target) combos[0].done = true; }catch(_){ }
    }
  }catch(_){ }
  renderCombos();
  // If Set 1 was claimed in a previous session, notify game (deferred so listeners register)
  try{
    if (combos && combos[0] && Array.isArray(combos[0].kinds)){
      const id0 = combos[0].kinds.join('|');
      try{ setTimeout(()=>{ if (claimedUpgrades.has(id0)){ try{ window.dispatchEvent(new CustomEvent('upgradeClaimed', { detail: { setIndex: 0, combo: combos[0], id: id0 } })); }catch(_){ } } }, 0); }catch(_){ }
    }
  }catch(_){ }
}

let __journal_combo_raf = null;
let __journal_combo_canvases = [];
function renderCombos(){
  try{
    // cleanup any prior RAF and canvases
    try{ if (__journal_combo_raf) { cancelAnimationFrame(__journal_combo_raf); __journal_combo_raf = null; } }catch(_){ }
    __journal_combo_canvases = [];
    const jl = document.getElementById('journalLeft'); if (!jl) return;
    jl.innerHTML = '';
  loadClaimedUpgrades();
  const title = document.createElement('div'); title.className = 'combo-title'; title.innerText = tr('COMBOS'); jl.appendChild(title);
    combos.forEach((c,ci)=>{
      const box = document.createElement('div'); box.className = 'combo-box';
  const hdr = document.createElement('div'); hdr.className = 'combo-hdr';
  try{ hdr.innerText = `${tr('Set')} ${ci+1}`; if (c.done) hdr.innerText += ` (${tr('UNLOCKED')})`; }catch(_){ hdr.innerText = `Set ${ci+1}`; if (c.done) hdr.innerText += ' (UNLOCKED)'; }
  box.appendChild(hdr);
      const line = document.createElement('div'); line.className = 'combo-line';
      const icons = document.createElement('div'); icons.className = 'combo-icons';
      // three icons for the kinds
      c.kinds.forEach(k=>{
        const wrap = document.createElement('div'); wrap.className = 'combo-icon';
        const info = killCounts[k] || {};
        // If this is a collect powerup (collect-*) always create a small canvas to animate the collect art
        // (we render a fallback if the draw helper isn't available yet)
        if (k && k.startsWith && k.startsWith('collect-')){
          const cv = document.createElement('canvas'); cv.width = 32; cv.height = 32; cv.style.width='32px'; cv.style.height='32px'; wrap.appendChild(cv);
          __journal_combo_canvases.push({ key: k, canvas: cv, kind: k });
          // draw immediately so the icon is visible even before the RAF animation runs
          try{
            const tmp = document.createElement('canvas'); tmp.width = 48; tmp.height = 48; const tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = false;
            if (window && typeof window.drawCollectLowResIntoPowerup === 'function'){
              window.drawCollectLowResIntoPowerup(tctx, 24, 24, performance.now(), k);
            } else {
              tctx.fillStyle = '#8adf76'; tctx.fillRect(4,4,16,16);
              tctx.fillStyle = '#ffffff'; tctx.font = '10px sans-serif'; tctx.textAlign = 'center'; tctx.fillText((k||'').replace(/^collect-/, '').charAt(0).toUpperCase(), 12, 14);
            }
            const ctx = cv.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,cv.width, cv.height);
            ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, cv.width, cv.height);
          }catch(_){ }
        } else if (info.imgSrc){ const im = document.createElement('img'); im.src = info.imgSrc; im.alt = k; wrap.appendChild(im); }
        else { const ph = document.createElement('div'); ph.style.width='100%'; ph.style.height='100%'; ph.style.background='#222'; wrap.appendChild(ph); }
        // small count under icon (visually arranged by stacking)
  const cnt = document.createElement('div'); cnt.className = 'combo-count';
  const cur = (typeof c.progress[k] === 'number') ? c.progress[k] : (c.progress[k] ? c.progress[k] : 0);
  cnt.innerText = `${cur}/${c.target}`;
        const colWrap = document.createElement('div'); colWrap.style.display='flex'; colWrap.style.flexDirection='column'; colWrap.style.alignItems='center'; colWrap.appendChild(wrap); colWrap.appendChild(cnt);
        icons.appendChild(colWrap);
      });
      line.appendChild(icons);
      const eq = document.createElement('div'); eq.className = 'combo-equals'; eq.innerText = '='; line.appendChild(eq);
      const up = document.createElement('div'); up.className = 'combo-upgrade';
      const id = c.kinds.join('|');
  const already = claimedUpgrades.has(id);
  up.innerText = c.done ? (already ? tr('CLAIMED') : tr('CLAIM')) : tr('???');
      if (c.done) up.classList.add('combo-unlocked');
      // If this is Set 1, show a tiny animated reward preview (Ford Fiesta) when available
      try{
        if (ci === 0 || ci === 1 || ci === 2){
          // determine CSS size for the preview to match the upgrade slot
          const cssW = 40; const cssH = 40;
          const preview = document.createElement('canvas');
          // make the element visually fit the slot
          preview.style.width = cssW + 'px'; preview.style.height = cssH + 'px'; preview.style.display = 'block'; preview.style.marginBottom = '6px';
          // set internal bitmap size for crisp rendering on HiDPI screens
          const DPR = (typeof window !== 'undefined' && window.devicePixelRatio) ? Math.max(1, window.devicePixelRatio) : 1;
          preview.width = Math.max(1, Math.round(cssW * DPR)); preview.height = Math.max(1, Math.round(cssH * DPR));
          // insert preview before the up element so it's visible
          up.style.display = 'flex'; up.style.flexDirection = 'column'; up.style.alignItems = 'center'; up.style.justifyContent = 'center';
          up.insertBefore(preview, up.firstChild);
          // animate using global helper if present; helpers draw at logical CSS size, so we scale the ctx by DPR
          if (ci === 0 && window && typeof window.drawFordFiestaInto === 'function'){
            (function tick(){ try{ const ctx = preview.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,preview.width, preview.height); try{ window.drawFordFiestaInto(ctx, cssW, cssH, performance.now()); }catch(_){ } }catch(_){ } requestAnimationFrame(tick); })();
          }
          if (ci === 1 && window && typeof window.drawMurkiaInto === 'function'){
            (function tick2(){ try{ const ctx = preview.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.setTransform(DPR,0,0,DPR,0,0); ctx.clearRect(0,0,preview.width, preview.height); try{ window.drawMurkiaInto(ctx, cssW, cssH, performance.now()); }catch(_){ } }catch(_){ } requestAnimationFrame(tick2); })();
          }
          if (ci === 2 && window && typeof window.drawDozerInto === 'function'){
            (function tick3(){
              try{
                // draw Dozer into a temporary larger canvas then scale down into the preview
                const tmpCss = 64; // authoritative draw size for Dozer art
                const tmp = document.createElement('canvas'); tmp.width = Math.max(1, Math.round(tmpCss * DPR)); tmp.height = Math.max(1, Math.round(tmpCss * DPR));
                const tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = false; tctx.setTransform(DPR,0,0,DPR,0,0);
                try{ window.drawDozerInto(tctx, tmpCss, tmpCss, performance.now()); }catch(_){ }
                const ctx = preview.getContext('2d'); ctx.imageSmoothingEnabled = false;
                // reset transform on preview ctx then draw scaled image covering the preview area
                ctx.setTransform(1,0,0,1,0,0); ctx.clearRect(0,0,preview.width, preview.height);
                try{ ctx.drawImage(tmp, 0,0, tmp.width, tmp.height, 0,0, preview.width, preview.height); }catch(_){ }
              }catch(_){ }
              requestAnimationFrame(tick3);
            })();
          }
        }
      }catch(_){ }
      if (c.done && !already){ up.style.cursor = 'pointer'; up.title = tr('Click to claim upgrade'); up.addEventListener('click', ()=>{
        // mark claimed, persist, and dispatch event so game can apply unlock
        claimedUpgrades.add(id); saveClaimedUpgrades(); up.innerText = tr('CLAIMED'); up.style.cursor = 'default';
        try{ window.dispatchEvent(new CustomEvent('upgradeClaimed', { detail: { setIndex: ci, combo: c, id } })); }catch(_){ }
      }); }
      line.appendChild(up);
      box.appendChild(line);
      jl.appendChild(box);
    });

    // animate any collect canvases
    function comboTick(ts){
      try{
        __journal_combo_canvases.forEach(entry => {
          try{
            const ctx = entry.canvas.getContext('2d'); ctx.imageSmoothingEnabled = false; ctx.clearRect(0,0,entry.canvas.width, entry.canvas.height);
            // map 32x32 canvas to 48x48 drawing by using an offscreen temp canvas
            const tmp = document.createElement('canvas'); tmp.width = 48; tmp.height = 48; const tctx = tmp.getContext('2d'); tctx.imageSmoothingEnabled = false;
            try{
              if (window && typeof window.drawCollectLowResIntoPowerup === 'function'){
                window.drawCollectLowResIntoPowerup(tctx, 24, 24, ts, entry.key);
              } else {
                // fallback: draw a simple distinctive placeholder for collect items
                tctx.fillStyle = '#8adf76'; tctx.fillRect(4,4,16,16);
                tctx.fillStyle = '#ffffff'; tctx.font = '10px sans-serif'; tctx.textAlign = 'center'; tctx.fillText((entry.key||'').replace(/^collect-/, '').charAt(0).toUpperCase(), 12, 14);
              }
            }catch(_){
              try{ tctx.fillStyle = '#8adf76'; tctx.fillRect(4,4,16,16); }catch(_){ }
            }
            // scale down into entry.canvas
            ctx.drawImage(tmp, 0, 0, tmp.width, tmp.height, 0, 0, entry.canvas.width, entry.canvas.height);
          }catch(_){ }
        });
      }catch(_){ }
      __journal_combo_raf = requestAnimationFrame(comboTick);
    }
    if (__journal_combo_canvases.length) __journal_combo_raf = requestAnimationFrame(comboTick);

  }catch(_){ }
}

function updateComboProgress(kind){
  // Only count journal/collect powerups (keys like 'collect-saw').
  // This prevents enemy kills and other non-collect events from advancing combos.
  if (!kind || typeof kind !== 'string' || !kind.startsWith('collect-')) return;
  if (!combos || !combos.length) return;
  let anyChange = false; let unlockedSet = -1;
  combos.forEach((c,ci)=>{
    if (c.done) return;
    if (c.kinds.indexOf(kind) >= 0){
      // Special-case: for Set 1 we use a combined rolling count across its kinds
      if (ci === 0){
        try{
          // increment saved combined progress
          let cur = 0; try{ cur = Math.max(0, parseInt(localStorage.getItem(SET1_PROGRESS_KEY),10) || 0); }catch(_){ cur = 0; }
          cur = cur + 1;
          try{ localStorage.setItem(SET1_PROGRESS_KEY, String(cur)); }catch(_){ }
          // reflect the same combined count in each kind's progress so UI shows the rolling count
          c.kinds.forEach(k => { c.progress[k] = cur; });
          anyChange = true;
          // if reached target, mark done
          if (cur >= c.target){ c.done = true; unlockedSet = ci; }
        }catch(_){ }
      } else {
        c.progress[kind] = (c.progress[kind] || 0) + 1; anyChange = true;
        // check done normally
        const all = c.kinds.every(k => (c.progress[k] || 0) >= c.target);
        if (all){ c.done = true; unlockedSet = ci; }
      }
    }
  });
  if (anyChange) renderCombos();
  if (unlockedSet >= 0){
    // dispatch a CustomEvent so game.js can listen and unlock the next tank
    try{ window.dispatchEvent(new CustomEvent('comboUnlocked', { detail: { setIndex: unlockedSet, combo: combos[unlockedSet] } })); }catch(_){ }
  }
}

export function updateJournal(){
  ensureJournal();
  const j = document.getElementById('journal'); const jh = document.getElementById('journalHealth'); const je = document.getElementById('journalEntries');
  // Replace hull/hearts display with weapon status: level, upgrades accumulated, and cooldown time
  try{
    const scoreHTML = `<div class="journal-score">${hudRef ? hudRef.innerText.split(' ')[0] : ''}</div>`;
    // Defaults
    let level = 1, label = 'Normal', upgrades = 0, cooldown = '--';
    // Parse HUD powerup label like "Double x60s" if present to extract label and remaining seconds
    try{
      if (hudRef && typeof hudRef.querySelector === 'function'){
        const pu = hudRef.querySelector('.powerup');
        if (pu && pu.innerText && pu.innerText.trim()){
          const txt = pu.innerText.trim();
          // expected forms: "Double x60s", "Triple x45s", "Quad x30s"
          const m = txt.match(/^(\w+)\s*x(\d+)s$/i);
          if (m){ label = m[1]; cooldown = m[2] + 's'; const map = { double:2, triple:3, quad:4 }; level = map[label.toLowerCase()] || 1; upgrades = Math.max(0, level - 1); }
        }
      }
    }catch(_){ }
    // render weapon block (no hull display per user request)
    jh.innerHTML = scoreHTML + `<div style="margin-top:6px; font-size:12px; color:#cfcfcf;">Weapon: <strong style=\"color:#9fd08f;\">${label}</strong> (level ${level})</div>`
      + `<div style="font-size:12px; color:#cfcfcf;">Upgrades accumulated: <strong style=\"color:#9fd08f;\">${upgrades}</strong></div>`
      + `<div style="font-size:12px; color:#cfcfcf;">Cooldown: <strong style=\"color:#9fd08f;\">${cooldown}</strong></div>`;
  }catch(_){ jh.innerHTML = ''; }
  // render tally entries: grid of icons with counts
  // Always include the combo collect kinds (Set 1) so players see what to pick up even at 0
  const kindsSet = new Set(Object.keys(killCounts));
  try{ if (combos && combos[0] && Array.isArray(combos[0].kinds)) combos[0].kinds.forEach(k => kindsSet.add(k)); }catch(_){ }
  const kinds = Array.from(kindsSet).sort((a,b)=>{
    const ac = (killCounts[a] && typeof killCounts[a].count === 'number') ? killCounts[a].count : 0;
    const bc = (killCounts[b] && typeof killCounts[b].count === 'number') ? killCounts[b].count : 0;
    return bc - ac;
  });
  je.innerHTML = '';
  for (const k of kinds){ const info = killCounts[k] || { count: 0, imgSrc: null }; const el = document.createElement('div'); el.className = 'journal-entry';
    if (info.imgSrc){ const im = document.createElement('img'); im.src = info.imgSrc; im.className = 'journal-entry-icon'; el.appendChild(im); }
    else if (k && k.startsWith && k.startsWith('collect-')){
      // draw a small collect canvas for collect-* kinds so players see the icon even at 0
      const c = document.createElement('canvas'); c.width = 32; c.height = 32; c.className = 'journal-entry-icon'; try{
        const cc = c.getContext('2d'); cc.imageSmoothingEnabled = false;
        if (window && typeof window.drawCollectLowResIntoPowerup === 'function'){
          window.drawCollectLowResIntoPowerup(cc, 16, 16, performance.now(), k);
        } else {
          cc.fillStyle = '#8adf76'; cc.fillRect(4,4,24,24);
          cc.fillStyle = '#fff'; cc.font = '10px sans-serif'; cc.textAlign='center'; cc.fillText(k.replace(/^collect-/, '').charAt(0).toUpperCase(), 16, 20);
        }
      }catch(_){ const box = document.createElement('div'); box.className = 'journal-entry-box'; el.appendChild(box); }
      el.appendChild(c);
    } else { const box = document.createElement('div'); box.className = 'journal-entry-box'; el.appendChild(box); }
    const span = document.createElement('div'); span.className = 'journal-entry-count'; span.innerText = `${info.count || 0}`; el.appendChild(span);
    const label = document.createElement('div'); label.className = 'journal-entry-label'; label.innerText = k; el.appendChild(label);
    je.appendChild(el);
  }
}

export function recordKill(kind, e){
  try{
    // Normalize kinds: if critters were passed with per-instance kinds (critter-<uid>),
    // prefer a species-level key using the sprite index so kills stack like enemies.
    let k = kind || '<unknown>';
    try{
      if (k && k.startsWith && k.startsWith('critter-') && e && typeof e.spriteIdx === 'number'){
        k = 'critter-' + e.spriteIdx; // species-level key
      }
    }catch(_){ }
    if (!killCounts[k]) killCounts[k] = { count: 0, imgSrc: null };
    killCounts[k].count += 1;
    try{
      // preferred: per-instance tile (e.g., critter.tileC or enemy.tileC)
      if (e && e.tileC && typeof e.tileC.toDataURL === 'function') killCounts[k].imgSrc = e.tileC.toDataURL();
      // fallback: shared critter sprite canvas by spriteIdx
      else if (e && typeof e.spriteIdx === 'number' && window.critterSprites && window.critterSprites[e.spriteIdx] && typeof window.critterSprites[e.spriteIdx].toDataURL === 'function') killCounts[k].imgSrc = window.critterSprites[e.spriteIdx].toDataURL();
      else {
        // try to find a representative entity with same kind in global enemies array
        try{
          if (window && window.enemies && window.enemies.length){
            const match = window.enemies.find(x => x && (x.kind === k || x.kind === (kind || k)));
            if (match && match.tileC && typeof match.tileC.toDataURL === 'function') killCounts[k].imgSrc = match.tileC.toDataURL();
          }
        }catch(_){ }
      }
      // final fallback: build a small placeholder canvas so the Journal shows a non-gray icon
      if (!killCounts[k].imgSrc){
        // Try a sensible artistic fallback: parrot sprite (index 2) if available
        try{
          if (window && window.critterSprites && window.critterSprites[2] && typeof window.critterSprites[2].toDataURL === 'function'){
            killCounts[k].imgSrc = window.critterSprites[2].toDataURL();
          }
        }catch(_){ }
        if (!killCounts[k].imgSrc){
          const pc = document.createElement('canvas'); pc.width = 48; pc.height = 48; const pctx = pc.getContext('2d');
          pctx.fillStyle = '#444'; pctx.fillRect(0,0,48,48);
          pctx.fillStyle = '#999'; pctx.font = '10px sans-serif'; pctx.textAlign = 'center'; pctx.fillText(k.replace(/^(.{1,8}).*$/,'$1'), 24, 26);
          killCounts[k].imgSrc = pc.toDataURL();
        }
      }
    }catch(_){ }
  }catch(_){ }
  try{ updateJournal(); }catch(_){ }
  try{ updateComboProgress(kind); }catch(_){ }
  try{ saveJournalState(); }catch(_){ }
}

export function setHealth(n){ healthRef = n; updateJournal(); }

export function setHudRef(h){ hudRef = h; }
