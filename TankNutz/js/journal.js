// Journal module: manages the on-screen journal UI and kill tallies
export const killCounts = {};
let hudRef = null;
let MAX_HEALTH_REF = null;
let healthRef = 0;
const JOURNAL_KEY = 'tn_journal_v1';

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
  }catch(_){ }
}

export function initJournal(options = {}){
  hudRef = options.hud || null;
  if (typeof options.maxHealth === 'number') MAX_HEALTH_REF = options.maxHealth;
  if (typeof options.health === 'number') healthRef = options.health;
  // load persisted journal state before rendering
  try{ loadJournalState(); }catch(_){ }
  ensureJournal(); updateJournal();
}

function ensureJournal(){
  if (document.getElementById('journal')) return;
  // inject lightweight tank-themed styles for the journal to avoid layout overlap
  if (!document.getElementById('journal-tank-styles')){
    const s = document.createElement('style'); s.id = 'journal-tank-styles'; s.innerHTML = `
      #journal{ position:fixed; right:20px; max-width:280px; width:auto; min-width:200px; max-height:60vh; background:linear-gradient(180deg,#151719,#0f1113); color:#e6e6e6; border:2px solid #0b0b0b; border-radius:8px; padding:8px; z-index:9998; font-family:monospace; box-shadow:0 6px 18px rgba(0,0,0,0.6); display:flex; flex-direction:column; gap:8px; transition: transform 0.3s ease; }
      #journal.closed{ transform: translateX(120%); }
      .journal-toggle{ position:fixed; right:20px; background:linear-gradient(180deg,#111,#0b0b0b); color:#e6e6e6; padding:6px 8px; border-radius:6px; cursor:pointer; z-index:9999; border:1px solid #222; font-family:monospace; font-size:12px; transition: transform 0.3s ease; }
      .journal-toggle.closed{ /* No transform - keep button visible */ }
      .journal-health{ display:flex; gap:6px; align-items:center; margin-bottom:6px; }
      .journal-hearts .heart.full{ color:#ff6b6b; }
      .journal-hearts .heart.empty{ color:#3a3a3a; }
      .journal-score{ font-weight:700; margin-bottom:4px; }
      .journal-hull{ font-size:12px; color:#cfcfcf; }
      .journal-entries{ display:grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap:4px; }
    `; document.head.appendChild(s); }
  const t = document.createElement('div'); t.id = 'journalToggle'; t.className = 'journal-toggle'; t.innerText = tr('Journal off');
  const j = document.createElement('div'); j.id = 'journal'; j.className = 'journal closed';
  const resetBtn = document.createElement('button'); resetBtn.id = 'journalReset'; resetBtn.innerText = tr('Reset Journal'); resetBtn.style.marginLeft = '8px'; resetBtn.style.padding = '6px'; resetBtn.style.fontSize = '12px'; resetBtn.style.cursor = 'pointer';
  const jh = document.createElement('div'); jh.id = 'journalHealth'; jh.className = 'journal-health';
  const je = document.createElement('div'); je.id = 'journalEntries'; je.className = 'journal-entries grid'; je.setAttribute('role','list');
  j.appendChild(jh); j.appendChild(je);
  document.body.appendChild(t); document.body.appendChild(j);
  // ensure initial state label is consistent (closed by default)
  t.innerText = tr('Journal off');
  t.addEventListener('click', ()=>{
    const isClosed = j.classList.contains('closed');
    if (isClosed){ 
      j.classList.remove('closed'); 
      j.classList.add('open');
      t.innerText = tr('Journal');
      t.classList.remove('closed');
      // Close vehicle menu if it's open
      const vmenu = document.getElementById('tn-vehicle-menu');
      const vtoggle = document.getElementById('tn-vehicle-toggle');
      if (vmenu && !vmenu.classList.contains('closed')) {
        vmenu.classList.add('closed');
        vmenu.classList.remove('open');
        if (vtoggle) vtoggle.innerText = 'Tanks off';
        if (vtoggle) vtoggle.classList.add('closed');
      }
    }
    else { 
      j.classList.add('closed'); 
      j.classList.remove('open');
      t.innerText = tr('Journal off'); 
      t.classList.add('closed');
    }
  });
  // If HUD is tank-themed, position journal below it to avoid overlap
  try{
    const topOffset = (hudRef && hudRef.classList && hudRef.classList.contains('tn-hud')) ? '94px' : '12px';
    t.style.top = topOffset; t.style.right = '20px'; t.style.position = 'fixed';
    j.style.top = topOffset; j.style.right = '20px'; j.style.position = 'fixed';
  }catch(_){ }
  // attach reset handler
  try{
    resetBtn.addEventListener('click', ()=>{
      try{ if (confirm && !confirm(tr('Reset Journal? This cannot be undone.'))) return; }catch(_){ }
      // clear storage
      try{ localStorage.removeItem(JOURNAL_KEY); }catch(_){ }
      // clear in-memory
      for (const k of Object.keys(killCounts)){ delete killCounts[k]; }
      try{ updateJournal(); }catch(_){ }
      // persist cleared journal state
      try{ saveJournalState(); }catch(_){ }
    });
  // notify game that journal was reset
  try{ if (typeof window !== 'undefined'){ try{ window.dispatchEvent(new CustomEvent('journalReset', {})); }catch(_){ } } }catch(_){ }
  }catch(_){ }
  // add reset button next to toggle for convenience
  t.appendChild(resetBtn);
}

// --- Journal system ---
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
  const kindsSet = new Set(Object.keys(killCounts));
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
  try{ saveJournalState(); }catch(_){ }
}

export function setHealth(n){ healthRef = n; updateJournal(); }

export function setHudRef(h){ hudRef = h; }
