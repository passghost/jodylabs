// Lightweight dialogue module for simple modal/choice dialogs
// API:
//  initDialogue(opts) - optional container/hud refs
//  showDialog({ title, text, choices }) -> Promise resolving to choice index or null if closed
//  say(text, ms) -> non-blocking toast-like dialog
//  closeDialog() - forcibly close

let _container = null;
let _backdrop = null;
let _dialog = null;
let _queue = [];
let _active = false;
let _typing = null; // current typing controller
let _dialogKeyHandler = null;

function _clearTyping(){
  try{ if (_typing && _typing.finish) _typing.finish(); }catch(_){ }
  _typing = null;
}

// typeText: animate text into element; returns a Promise and sets _typing controller
function typeText(el, text, msPerChar = 24){
  return new Promise((resolve)=>{
    try{
      if (!_typing) _typing = {};
      // clear any previous timer
      try{ if (_typing.timeout) clearTimeout(_typing.timeout); }catch(_){ }
      el.textContent = '';
      el.style.whiteSpace = 'pre-wrap';
      let i = 0;
      function finish(){
        try{ if (_typing && _typing.timeout) clearTimeout(_typing.timeout); }catch(_){}
        el.textContent = text;
        _typing = null;
        resolve();
      }
      _typing.finish = finish;
      function step(){
        if (i >= text.length){ finish(); return; }
        el.textContent += text.charAt(i++);
        _typing.timeout = setTimeout(step, msPerChar);
      }
      // small initial delay for effect
      _typing.timeout = setTimeout(step, msPerChar);
    }catch(e){ try{ el.textContent = text; }catch(_){ } _typing = null; resolve(); }
  });
}

// Utility: pick a random tile from a grid image (cols x rows) and return a dataURL
function pickRandomTileDataURL(src, cols = 3, rows = 3){
  return new Promise((resolve, reject)=>{
    try{
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = ()=>{
        try{ console.debug && console.debug('pickRandomTileDataURL: loaded', src, img.naturalWidth, img.naturalHeight); }catch(_){ }
        try{
          const tileW = Math.floor(img.naturalWidth / cols) || img.width;
          const tileH = Math.floor(img.naturalHeight / rows) || img.height;
          try{ console.debug && console.debug('pickRandomTileDataURL: tileW,tileH,cols,rows', tileW, tileH, cols, rows); }catch(_){ }
          const col = Math.floor(Math.random() * cols);
          const row = Math.floor(Math.random() * rows);
          try{ console.debug && console.debug('pickRandomTileDataURL: chosen col,row', col, row); }catch(_){ }
          const sx = col * tileW;
          const sy = row * tileH;
          const c = document.createElement('canvas');
          c.width = tileW; c.height = tileH;
          const cx = c.getContext('2d');
          cx.drawImage(img, sx, sy, tileW, tileH, 0, 0, tileW, tileH);
          try{ const data = c.toDataURL(); resolve(data); }catch(err){ resolve(src); }
        }catch(err){ resolve(src); }
      };
      img.onerror = ()=>{ resolve(src); };
      img.src = src;
      // If already cached and complete
      if (img.complete && img.naturalWidth){ img.onload(); }
    }catch(e){ resolve(src); }
  });
}

export function initDialogue(opts = {}){
  if (typeof document === 'undefined') return;
  if (_container) return;
  // If body isn't ready yet (scripts executed in head), defer initialization until DOM is ready
  if (!document.body){
    try{
      if (document.readyState === 'loading'){
        document.addEventListener('DOMContentLoaded', ()=> initDialogue(opts), { once: true });
        return;
      }
    }catch(_){ }
    // fallback short timeout
    setTimeout(()=> initDialogue(opts), 50);
    return;
  }

  _backdrop = document.createElement('div');
  _backdrop.id = 'tn-dialogue-backdrop';
  _backdrop.className = 'tn-dialogue-backdrop';

  _dialog = document.createElement('div');
  _dialog.id = 'tn-dialogue';
  _dialog.className = 'tn-dialogue';
  // enforce transparent background so the checkered backdrop is visible
  try{ _dialog.style.background = 'transparent'; _dialog.style.transformOrigin = 'center center'; }catch(_){ }

  _container = document.createElement('div');
  _container.id = 'tn-dialogue-container';
  _container.className = 'tn-dialogue-container';

  _backdrop.appendChild(_dialog);
  _container.appendChild(_backdrop);
  document.body.appendChild(_container);

  _container.addEventListener('click', (e)=>{
    if (e.target === _container) {
      // click outside: close current dialog
      closeDialog();
    }
  });
}

function _renderDialog(spec){
  _dialog.innerHTML = '';
  const title = document.createElement('div'); title.style.fontWeight='700'; title.style.marginBottom='8px'; title.innerText = spec.title || '';
  const body = document.createElement('div'); body.className = 'tn-dialogue-body'; body.style.marginBottom='12px'; body.innerText = '';
  const actions = document.createElement('div'); actions.style.display='flex'; actions.style.justifyContent='flex-end'; actions.style.gap='8px';

  if (Array.isArray(spec.choices) && spec.choices.length){
    spec.choices.forEach((c, idx)=>{
      const b = document.createElement('button'); b.innerText = c.label || String(c) || ('Choice ' + (idx+1));
      b.style.cursor='pointer'; b.addEventListener('click', ()=>{
        // if typing, finish it first; otherwise resolve choice
        if (_typing && _typing.finish){ _typing.finish(); return; }
        _resolveActive(idx);
      });
      actions.appendChild(b);
    });
  } else {
    const ok = document.createElement('button'); ok.innerText = spec.okLabel || 'OK'; ok.style.cursor='pointer'; ok.addEventListener('click', ()=>{ if (_typing && _typing.finish){ _typing.finish(); return; } _resolveActive(null); }); actions.appendChild(ok);
  }

  _dialog.appendChild(title); _dialog.appendChild(body); _dialog.appendChild(actions);
}

function _resolveActive(result){
  if (!_active) return;
  const cur = _active;
  _active = false;
  // clear any scaling applied when dialog shown
  try{ if (_dialog) _dialog.style.transform = ''; }catch(_){ }
  try{ if (_backdrop && _backdrop.style) _backdrop.style.removeProperty('--tn-dialog-scale'); }catch(_){ }
  _container.style.display = 'none';
  try{ cur.resolve(result); }catch(_){ }
  // process next in queue
  if (_queue.length) {
    const next = _queue.shift();
    setTimeout(()=> showDialog(next.spec).then(next.resolve).catch(next.reject), 60);
  }
}

export function showDialog(spec = {}){
  return new Promise((resolve, reject)=>{
    if (!_container) try{ initDialogue(); }catch(_){ }
    if (_active){
      // queue it
      _queue.push({ spec, resolve, reject });
      return;
    }
    _active = { resolve, reject };
    try{
      _renderDialog(spec);
      // make the opening dialog visually larger by scaling contents
    try{ _dialog.style.transformOrigin = 'center center'; _dialog.style.transform = 'scale(2)'; if (_backdrop && _backdrop.style) _backdrop.style.setProperty('--tn-dialog-scale', '2'); }catch(_){ }
  _container.style.display = 'flex';
      // ensure pointer events
      _backdrop.style.pointerEvents = 'auto';
      // compute dialog size so backdrop can match it
      try{
        // allow layout to settle
        const rect = _dialog.getBoundingClientRect ? _dialog.getBoundingClientRect() : null;
        if (rect && _backdrop && _backdrop.style){
          _backdrop.style.setProperty('--tn-desired-w', Math.round(rect.width) + 'px');
          _backdrop.style.setProperty('--tn-desired-h', Math.round(rect.height) + 'px');
          _backdrop.style.setProperty('--tn-desired-br', Math.round(parseFloat(window.getComputedStyle(_dialog).borderRadius || 12)) + 'px');
        }
      }catch(_){ }
      // start typing body text if present
      try{
        const bodyEl = _dialog.querySelector('.tn-dialogue-body');
        const text = spec.text || '';
        if (bodyEl && text) typeText(bodyEl, text, spec.typeSpeed || 24);
      }catch(_){ }
    }catch(err){ _resolveActive(null); reject(err); }
  });
}

export function say(text, ms = 2200){
  // non-blocking temporary message in corner
  if (typeof document === 'undefined') return;
  const el = document.createElement('div');
  el.className = 'tn-dialogue-toast';
  el.style = 'position:fixed;right:12px;bottom:12px;background:#0f1113;color:#e6e6e6;padding:8px 10px;border-radius:6px;border:1px solid #111;z-index:10002;font-family:monospace;';
  el.innerText = text || '';
  document.body.appendChild(el);
  setTimeout(()=>{ try{ el.style.transition='opacity 300ms'; el.style.opacity='0'; setTimeout(()=> el.remove(),320); }catch(_){ try{ el.remove(); }catch(__){} } }, ms);
}

export function closeDialog(){
  try{ _resolveActive(null); }catch(_){ }
}

// Play a scripted conversation made of lines: { speaker, text, img, side }
// If no script provided, a default pre-game script is used (assumes images at './gir1.png' and './cub.webp').
export function playConversation(script = null, opts = {}){
  return new Promise(async (resolve, reject)=>{
  try{ console.debug && console.debug('Dialogue.playConversation called', { hasContainer: !!_container, scriptLength: Array.isArray(script) ? script.length : null }); }catch(_){ }
    if (typeof document === 'undefined') return resolve(false);
    if (!_container) try{ initDialogue(); }catch(_){ }
    // If initDialogue deferred (body not ready), wait briefly for the container to be created
    async function waitForContainer(timeout = 1000){
      const start = Date.now();
      if (_container) return true;
      try{ console.debug && console.debug('Dialogue.playConversation: waiting for container...'); }catch(_){ }
      while(!(_container) && (Date.now() - start) < timeout){
        await new Promise(r=>setTimeout(r, 30));
      }
      try{ console.debug && console.debug('Dialogue.playConversation: waitForContainer result', !!_container); }catch(_){ }
      return !!_container;
    }
    // await container ready
    try{ await waitForContainer(1200); }catch(_){ }

    // default script stored here so most content lives in this module
  // Allow explicit image overrides via opts.images (e.g. { gir: 'gir1.png', cub: 'cub.webp' })
  // Otherwise prefer images from Adimages (or opts.basePath if provided)
  const adGir = (opts.images && opts.images.gir) ? (opts.images.gir) : (opts.basePath ? (opts.basePath + 'Jodyplaysfirstbetter22.png') : './Adimages/Jodyplaysfirstbetter22.png');
  const adCub = (opts.images && opts.images.cub) ? (opts.images.cub) : (opts.basePath ? (opts.basePath + 'assets_task_01k2rrn7tmezns0yn5xznzm2h4_1755325365_img_0.webp') : './Adimages/assets_task_01k2rrn7tmezns0yn5xznzm2h4_1755325365_img_0.webp');
  try{ console.debug && console.debug('Dialogue.playConversation: chosen images', { gir: adGir, cub: adCub }); }catch(_){ }
    const defaultScript = [
      // Wave 1
      { speaker: 'Rupert', text: "I’ve got reports of a hostile that just hit the island. Send a few troops to investigate, Kris.", img: adCub, side: 'right' },
      { speaker: 'Kris', text: "What? Sorry, sir! I—was distracted, sir!", img: adGir, side: 'left' },
      { speaker: 'Rupert', text: "Is that a candy bar?", img: adCub, side: 'right' },
      { speaker: 'Kris', text: "No, sir—tactical chocolate. You never know when you need a boost, sir.", img: adGir, side: 'left' },
      { speaker: 'Rupert', text: "Get your men out there, commander. RIGHT NOW!", img: adCub, side: 'right' }
    ];

    const lines = Array.isArray(script) && script.length ? script : defaultScript;

    // Build conversation UI inside _dialog
    _dialog.innerHTML = '';
    _container.style.display = 'flex';
    _backdrop.style.pointerEvents = 'auto';
  // scale the conversation dialog to be twice as big
  try{ _dialog.style.transformOrigin = 'center center'; _dialog.style.transform = 'scale(2)'; }catch(_){ }
    // register active resolver so closeDialog/_resolveActive can finish this conversation
    _active = {
      resolve: (val) => { finish(val !== null && val !== false); },
      reject: () => { finish(false); }
    };

      // prevent SPACE from scrolling while a dialogue is active
      try{
        _dialogKeyHandler = function(e){
          if (e.code === 'Space' || e.key === ' ' || e.keyCode === 32){
            e.preventDefault && e.preventDefault();
            return false;
          }
        };
        window.addEventListener('keydown', _dialogKeyHandler, { passive: false });
      }catch(_){ }

  const convoWrap = document.createElement('div');
    convoWrap.style = 'display:flex;flex-direction:column;gap:12px;min-width:420px;max-width:820px;pointer-events:auto;';

    const stage = document.createElement('div');
    stage.style = 'display:flex;gap:12px;align-items:flex-end;min-height:120px;';

  // constrain avatar columns so the central bubble has a stable width to wrap text vertically
  const leftBox = document.createElement('div'); leftBox.style = 'flex:0 0 auto;width:96px;display:flex;align-items:flex-end;justify-content:flex-start;padding-right:8px;';
  const rightBox = document.createElement('div'); rightBox.style = 'flex:0 0 auto;width:96px;display:flex;align-items:flex-end;justify-content:flex-end;padding-left:8px;';

  const bubble = document.createElement('div');
  // Make the bubble expand vertically (downward) as text types instead of widening.
  // Use a bounded width so text wraps and the box grows downwards.
  bubble.style = 'background:linear-gradient(180deg,#111,#1a1a1a);padding:12px;border-radius:10px;border:1px solid #000;color:#e6e6e6;font-family:monospace;min-height:72px;display:flex;flex-direction:column;align-items:flex-start;word-break:break-word;white-space:normal;flex:0 0 auto;width: min(36vw, 420px);max-width:820px;';

    stage.appendChild(leftBox); stage.appendChild(bubble); stage.appendChild(rightBox);

    const controls = document.createElement('div'); controls.style = 'display:flex;justify-content:flex-end;gap:8px;';
    const nextBtn = document.createElement('button'); nextBtn.innerText = opts.nextLabel || 'Next'; nextBtn.style.cursor='pointer';
    const skipBtn = document.createElement('button'); skipBtn.innerText = opts.skipLabel || 'Skip'; skipBtn.style.cursor='pointer';
    controls.appendChild(skipBtn); controls.appendChild(nextBtn);

    convoWrap.appendChild(stage); convoWrap.appendChild(controls);
    _dialog.appendChild(convoWrap);

    // Helper: sync backdrop patterned panel to the current (scaled) dialog size
    function syncBackdropSize(){
      try{
        if (!_dialog || !_backdrop || !_backdrop.style) return;
        const rect = _dialog.getBoundingClientRect ? _dialog.getBoundingClientRect() : null;
        if (!rect) return;
        const br = parseFloat(window.getComputedStyle(_dialog).borderRadius || 12) || 12;
        _backdrop.style.setProperty('--tn-desired-w', Math.round(rect.width) + 'px');
        _backdrop.style.setProperty('--tn-desired-h', Math.round(rect.height) + 'px');
        _backdrop.style.setProperty('--tn-desired-br', Math.round(br) + 'px');
      }catch(_){ }
    }
    // Schedule multiple syncs to follow typewriter growth
    function scheduleSync(){
      try{
        syncBackdropSize();
        setTimeout(syncBackdropSize, 50);
        setTimeout(syncBackdropSize, 150);
        setTimeout(syncBackdropSize, 350);
      }catch(_){ }
    }

    let idx = 0;

    function renderLine(i){
      const line = lines[i];
      // clear avatar boxes and bubble
      leftBox.innerHTML = ''; rightBox.innerHTML = '';
      bubble.innerHTML = '';

      const avatarSize = 88;
      const placeAvatar = (imgSrc)=>{
        if (!imgSrc) return;
        const imgEl = document.createElement('img'); imgEl.src = imgSrc; imgEl.style = `width:${avatarSize}px;height:${avatarSize}px;object-fit:cover;border-radius:8px;border:2px solid #000;`;
        const holder = document.createElement('div'); holder.appendChild(imgEl);
        if ((line.side || 'left') === 'left') leftBox.appendChild(holder); else rightBox.appendChild(holder);
      };

      if (line && line.img){
        // If an image looks like a grid sprite sheet, pick a random tile (default 3x3)
        pickRandomTileDataURL(line.img, opts.gridCols || 3, opts.gridRows || 3).then(dataUrl=>{
          placeAvatar(dataUrl);
        }).catch(_=>{ placeAvatar(line.img); });
      }

    const speaker = document.createElement('div'); speaker.style = 'font-weight:700;margin-bottom:6px;'; speaker.innerText = line && line.speaker ? line.speaker : '';
    const text = document.createElement('div'); text.className = 'tn-conversation-text'; text.innerText = '';
  const content = document.createElement('div'); content.appendChild(speaker); content.appendChild(text);
    bubble.appendChild(content);
    // start typewriter effect for this line
    try{ _clearTyping(); if (line && line.text) typeText(text, line.text, opts.typeSpeed || 24).then(()=>{ scheduleSync(); }); }catch(_){ try{ text.innerText = line && line.text ? line.text : ''; }catch(__){} }

      // focus next button
      try{ nextBtn.focus(); }catch(_){ }
      scheduleSync();
    }

    // Live-resize observer while conversation is active
    let _resizeObs = null;
    try{
      if (typeof ResizeObserver !== 'undefined'){
        _resizeObs = new ResizeObserver(()=>{ syncBackdropSize(); });
        _resizeObs.observe(_dialog);
      }
    }catch(_){ }

    function finish(concluded = true){
      try{ _active = false; _container.style.display = 'none'; }catch(_){ }
    try{ resolve(concluded); }catch(_){ }
    // remove key handler
    try{ if (_dialogKeyHandler && window && window.removeEventListener) window.removeEventListener('keydown', _dialogKeyHandler); _dialogKeyHandler = null; }catch(_){ }
    // clear any explicit backdrop sizing to avoid stale values
    try{ if (_backdrop && _backdrop.style){ _backdrop.style.removeProperty('--tn-desired-w'); _backdrop.style.removeProperty('--tn-desired-h'); _backdrop.style.removeProperty('--tn-desired-br'); } }catch(_){ }
      // disconnect resize observer
      try{ if (_resizeObs && _resizeObs.disconnect) _resizeObs.disconnect(); }catch(_){ }
    }

    nextBtn.addEventListener('click', ()=>{
  // if typing, finish it first
  if (_typing && _typing.finish){ _typing.finish(); return; }
  idx += 1;
  if (idx >= lines.length) return finish(true);
  renderLine(idx);
    });
  // Skip should behave like completing the conversation and start the game
  skipBtn.addEventListener('click', ()=>{ finish(true); });

  // initial render
  try{ console.debug && console.debug('Dialogue.playConversation: rendering initial line'); }catch(_){ }
  renderLine(0);
  scheduleSync();
  });
}

// expose to window for quick usage (include playConversation)
try{ if (typeof window !== 'undefined') window.Dialogue = { showDialog, say, closeDialog, initDialogue, playConversation }; }catch(_){ }
