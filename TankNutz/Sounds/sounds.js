// Lightweight SFX module using Web Audio API
// Exports: init, playShoot, startShift, stopShift, playGib, playHelicopter, setHelicopterVolume, stopHelicopter, playBgm, stopBgm, setBgmVolume, setBgmAllowed, isBgmAllowed, getCurrentTrackInfo
let ctx = null;
// Track active HTMLAudio elements so we can stop them on demand
const _activeHtmlAudio = new Set();
let _shiftNode = null;
let _shiftGain = null;
// SFX master gain (attenuate all non-BGM sounds)
let _sfxGain = null;
// current gear for shift pitch (1..5)
let _currentShiftGear = 1;
// RPM mapping for logical 5-gear diesel behavior
const IDLE_RPM = 900;
const GEAR_BASE_RPM = [0, 900, 1400, 2000, 2600, 3200]; // index 1..5
let _shiftBaseFreq = 120; // base oscillator frequency when using oscillator fallback
// Master SFX volume (relative to music). Lowered to make all SFX much quieter by default.
const DEFAULT_SFX_VOLUME = 0.18;
// whether SFX are enabled; toggled by game UI
let _enabled = true;
function ensureCtx(){ if (!ctx){ ctx = new (window.AudioContext || window.webkitAudioContext)(); } return ctx; }
export function init(){ try{ ensureCtx(); }catch(e){ console.warn('SFX init failed', e); } }

function resumeIfNeeded(){ if (!ctx) ensureCtx(); if (ctx && ctx.state === 'suspended' && typeof ctx.resume === 'function') { try{ ctx.resume(); }catch(_){ } } }

function ensureSfxGain(){ try{ if (!_sfxGain){ const ac = ensureCtx(); _sfxGain = ac.createGain(); _sfxGain.gain.value = DEFAULT_SFX_VOLUME; _sfxGain.connect(ac.destination); } return _sfxGain; }catch(_){ return null; } }

// Cached rendered buffers for shoot and shift to avoid re-synthesis every time
// cache multiple rendered shoot buffers so repeated player fire sounds vary
let _cachedShootBuffers = [];
const SHOOT_VARIANT_COUNT = 4;
// Pitch offset per variant step (Hz). Increased to make audible pitch differences larger.
const SHOOT_PITCH_STEP = 30;
let _cachedShiftBuffer = null;
// cached gear-climb buffer for rise-through-gears effect
// cached gear-climb buffers for 5 gears (index 1..5)
const _cachedGearClimbBuffer = [null, null, null, null, null, null];

// Render a short shot SFX using an OfflineAudioContext and return an AudioBuffer
async function _renderShootBuffer(opts = {}){ try{
  const sr = 48000; const dur = 0.9; const len = Math.ceil(sr * dur);
  const offline = new OfflineAudioContext({ numberOfChannels: 2, length: len, sampleRate: sr });
  const now = 0;

  // Determine pitch bias from opts.seedIndex so different variants have distinct pitch
  // seedIndex expected in range 0..(SHOOT_VARIANT_COUNT-1)
  let pitchBias = 0;
  if (typeof opts.seedIndex === 'number' && typeof SHOOT_VARIANT_COUNT === 'number'){
    // spread biases across a range of Hz around the base using SHOOT_PITCH_STEP
    const mid = (SHOOT_VARIANT_COUNT - 1) / 2;
    pitchBias = (opts.seedIndex - mid) * SHOOT_PITCH_STEP;
  } else if (typeof opts.pitchBias === 'number'){
    pitchBias = opts.pitchBias;
  }

  // mix bus
  const mix = offline.createGain(); mix.gain.value = 1.0; mix.connect(offline.destination);

  // sub thump (reduced)
  const sub = offline.createOscillator(); sub.type = 'sine';
  const subFreqStart = 160 + Math.random()*40 + pitchBias; const subFreqEnd = 40 + Math.random()*10 + pitchBias*0.25;
  sub.frequency.setValueAtTime(subFreqStart, now);
  sub.frequency.exponentialRampToValueAtTime(Math.max(10, subFreqEnd), now + 0.22);
  const subG = offline.createGain(); subG.gain.value = 0.28; sub.connect(subG).connect(mix);

  // body saw
  const body = offline.createOscillator(); body.type = 'sawtooth'; body.frequency.value = Math.max(60, subFreqEnd * 2);
  const bodyG = offline.createGain(); bodyG.gain.value = 0.22; body.connect(bodyG).connect(mix);

  // transient noise
  const tlen = 0.12; const tbuf = offline.createBuffer(1, Math.floor(offline.sampleRate * tlen), offline.sampleRate);
  const td = tbuf.getChannelData(0); for (let i=0;i<td.length;i++) td[i] = (Math.random()*2-1) * Math.pow(1 - i/td.length, 1.5);
  const tsrc = offline.createBufferSource(); tsrc.buffer = tbuf; tsrc.loop = false;
  const tHP = offline.createBiquadFilter(); tHP.type = 'highpass'; tHP.frequency.value = 700;
  const tG = offline.createGain(); tG.gain.value = 0.22; tsrc.connect(tHP).connect(tG).connect(mix);

  // short noise body
  const nlen = 0.6; const nbuf = offline.createBuffer(1, Math.floor(offline.sampleRate * nlen), offline.sampleRate);
  const nd = nbuf.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = (Math.random()*2-1) * (1 - i/nd.length);
  const nsrc = offline.createBufferSource(); nsrc.buffer = nbuf; nsrc.loop = false;
  const nLP = offline.createBiquadFilter(); nLP.type = 'lowpass'; nLP.frequency.value = 6000; nsrc.connect(nLP).connect(mix);

  // mild waveshaper for grit
  const sh = offline.createWaveShaper(); const curve = new Float32Array(2048); for (let i=0;i<2048;i++){ const x = i*2/2047 -1; curve[i] = Math.tanh(x*6); } sh.curve = curve; sh.oversample = '2x';
  const clipG = offline.createGain(); clipG.gain.value = 0.25; mix.disconnect(); mix.connect(sh); sh.connect(clipG); clipG.connect(offline.destination);

  // envelopes
  subG.gain.setValueAtTime(0.0001, now); subG.gain.exponentialRampToValueAtTime(1.0, now + 0.006); subG.gain.exponentialRampToValueAtTime(0.0001, now + 0.9);
  bodyG.gain.setValueAtTime(0.0001, now); bodyG.gain.exponentialRampToValueAtTime(0.9, now + 0.006); bodyG.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);
  tG.gain.setValueAtTime(0.0001, now); tG.gain.exponentialRampToValueAtTime(1.4, now + 0.003); tG.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
  nLP.gain && nLP.gain.setValueAtTime && nLP.gain.setValueAtTime(1, now);

  // start nodes
  try{ sub.start(now); body.start(now); tsrc.start(now); nsrc.start(now); }catch(_){ }

  const rendered = await offline.startRendering();
  try{ sub.stop(); body.stop(); }catch(_){ }
  return rendered;
}catch(e){ console.warn('_renderShootBuffer failed', e); return null; } }

// Render a loopable shift/hum buffer (longer, low-frequency engine hum)
async function _renderShiftBuffer(){
  try{
    // Make a loopable 1s buffer synchronized to a simple LFO chug (2Hz) so it loops seamlessly
    const sr = 48000; const dur = 1.0; const len = Math.ceil(sr * dur);
    const offline = new OfflineAudioContext({ numberOfChannels: 2, length: len, sampleRate: sr });
    const now = 0;

    // master chain
    const master = offline.createGain(); master.gain.value = 1.0; master.connect(offline.destination);

    // Sub-bass body: a low sine with slight detune via very slow LFO to avoid static tone
    const sub = offline.createOscillator(); sub.type = 'sine'; sub.frequency.value = 38; // base
    const subDetuneLfo = offline.createOscillator(); subDetuneLfo.type = 'sine'; subDetuneLfo.frequency.value = 0.25; // very slow wobble
    const subDetuneGain = offline.createGain(); subDetuneGain.gain.value = 6; // cents-ish effect via detune
    subDetuneLfo.connect(subDetuneGain).connect(sub.detune);

    // Mid body: two detuned low saws for diesel rasp and body
    const main = offline.createOscillator(); main.type = 'sawtooth'; main.frequency.value = 110;
    const main2 = offline.createOscillator(); main2.type = 'sawtooth'; main2.frequency.value = 110 * 1.008; // tiny detune

    const bodyGain = offline.createGain(); bodyGain.gain.value = 0.6;
    sub.connect(bodyGain); main.connect(bodyGain); main2.connect(bodyGain);

    // Bandpass noise for rasp (engine 'diesel' rasp) - create a noise buffer and filter it
    const nbuf = offline.createBuffer(1, Math.floor(offline.sampleRate * dur), offline.sampleRate);
    const nd = nbuf.getChannelData(0); for (let i = 0; i < nd.length; i++) nd[i] = (Math.random() * 2 - 1) * 0.8;
    const nsrc = offline.createBufferSource(); nsrc.buffer = nbuf; nsrc.loop = false;
    const rasp = offline.createBiquadFilter(); rasp.type = 'bandpass'; rasp.frequency.value = 450; rasp.Q.value = 0.9;

    // LFO for chug rhythm: 2Hz ensures integer cycles in 1s buffer (2 cycles) so looping is seamless
    const chugLfo = offline.createOscillator(); chugLfo.type = 'sine'; chugLfo.frequency.value = 2.0;

    // Modulate rasp amplitude with chug LFO to get rhythmic diesel chug
    const raspGain = offline.createGain(); raspGain.gain.value = 0.0001;
    nsrc.connect(rasp).connect(raspGain).connect(master);

    // Also route body to a waveshaper and lowpass to tame highs
    const shaper = offline.createWaveShaper(); const curve = new Float32Array(4096); for (let i = 0; i < 4096; i++){ const x = i*2/4095 - 1; curve[i] = Math.tanh(x * 4); } shaper.curve = curve; shaper.oversample = '2x';
    const lowpass = offline.createBiquadFilter(); lowpass.type = 'lowpass'; lowpass.frequency.value = 4200;
    bodyGain.connect(shaper).connect(lowpass).connect(master);

    // Mix a small amount of rasp into master via chug-controlled gain
    // chug outputs -1..1; convert to 0..1 envelope: gain = (chug*0.5 + 0.5) * depth
    const dc = offline.createConstantSource(); dc.offset.value = 0.5; dc.start(now);
    const chugScaler = offline.createGain(); chugScaler.gain.value = 0.5; chugLfo.connect(chugScaler);
    const chugSum = offline.createGain(); // sum node
    chugScaler.connect(chugSum); dc.connect(chugSum);
    const chugDepth = offline.createGain(); chugDepth.gain.value = 0.9; chugSum.connect(chugDepth);
    chugDepth.connect(raspGain.gain);

    // Mild compression to glue the sound
    const compressor = offline.createDynamicsCompressor(); compressor.threshold.value = -24; compressor.ratio.value = 3; compressor.attack.value = 0.01; compressor.release.value = 0.2;
    master.disconnect(); master.connect(compressor); compressor.connect(offline.destination);

    // Start nodes
    try{ sub.start(now); subDetuneLfo.start(now); main.start(now); main2.start(now); nsrc.start(now); chugLfo.start(now); }catch(_){ }

    // Envelope for body: gentle fade-in to avoid click at loop boundary
    bodyGain.gain.setValueAtTime(0.0001, now); bodyGain.gain.linearRampToValueAtTime(0.6, now + 0.12);

    // Render
    const rendered = await offline.startRendering();

    try{ sub.stop(); subDetuneLfo.stop(); main.stop(); main2.stop(); chugLfo.stop(); nsrc.stop(); dc.stop && dc.stop(); }catch(_){ }
    return rendered;
  }catch(e){ console.warn('_renderShiftBuffer failed', e); return null; }
}

// Render a short gear-climb SFX: rising pitch + mechanical clicks/ratchet
async function _renderGearClimbBuffer(gear = 1){
  try{
    gear = Math.max(1, Math.min(5, Math.floor(Number(gear) || 1)));
    const sr = 48000; const dur = 0.9; const len = Math.ceil(sr * dur);
    const offline = new OfflineAudioContext({ numberOfChannels: 2, length: len, sampleRate: sr });
    const now = 0;

  const mix = offline.createGain(); mix.gain.value = 0.22; // much quieter overall
  mix.connect(offline.destination);

  // strong sub-bass to make the climb much bassier
  const sub = offline.createOscillator(); sub.type = 'sine';
  const subG = offline.createGain(); subG.gain.value = 0.9; // prominent sub but overall mix is quieter
  sub.frequency.setValueAtTime(40 + (gear-1)*6, now);
  sub.connect(subG).connect(mix);

    // Map gear to frequency range and click density
    const startFreq = 60 + (gear - 1) * 18; // gear 1..5 -> 60..132
    const endFreq = 220 + (gear - 1) * 90;  // gear 1..5 -> 220..580
    const clickCount = 4 + gear * 2;        // gear 1..5 -> 6..14

  // rising body (saw) to represent accelerating engine; attenuated so sub dominates
  const body = offline.createOscillator(); body.type = 'sawtooth'; body.frequency.setValueAtTime(startFreq * 0.7, now);
  body.frequency.exponentialRampToValueAtTime(endFreq * 0.7, now + dur * 0.9);
  const bodyG = offline.createGain(); bodyG.gain.value = 0.06; body.connect(bodyG).connect(mix);

    // periodic ratchet clicks: short high-pass filtered noise bursts at accelerating rate
    for (let i = 0; i < clickCount; i++){
      const t = now + (i / Math.max(1, clickCount - 1)) * dur * 0.9; // space clicks across duration
      const clen = 0.03 + Math.random() * 0.03; // slight variation
      const cb = offline.createBuffer(1, Math.floor(offline.sampleRate * clen), offline.sampleRate);
      const cd = cb.getChannelData(0); for (let j = 0; j < cd.length; j++) cd[j] = (Math.random()*2 - 1) * Math.pow(1 - j/cd.length, 3);
      const cs = offline.createBufferSource(); cs.buffer = cb; cs.loop = false;
  const hp = offline.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1200 + gear * 150;
  const cg = offline.createGain(); cg.gain.value = 0.04 * (1 - i / Math.max(1, clickCount)); // very quiet clicks
      cs.connect(hp).connect(cg).connect(mix);
      try{ cs.start(t); cs.stop(t + clen); }catch(_){ }
    }

    // gentle waveshaper for mechanical grit
  const sh = offline.createWaveShaper(); const c = new Float32Array(2048); for (let i = 0; i < 2048; i++){ const x = i*2/2047 - 1; c[i] = Math.tanh(x * (2 + gear*0.6)); } sh.curve = c; sh.oversample = '2x';
  const mid = offline.createGain(); mid.gain.value = 0.8;
  // apply stronger lowpass to remove highs and emphasize bass
  const finalLP = offline.createBiquadFilter(); finalLP.type = 'lowpass'; finalLP.frequency.value = 1000; finalLP.Q.value = 0.85;
  mix.disconnect(); mix.connect(sh); sh.connect(mid); mid.connect(finalLP); finalLP.connect(offline.destination);

  // start the sub oscillator too
  try{ sub.start(now); }catch(_){ }

  try{ body.start(now); }catch(_){ }
  const rendered = await offline.startRendering();
  try{ body.stop(); }catch(_){ }
  try{ sub.stop(); }catch(_){ }
    return rendered;
  }catch(e){ console.warn('_renderGearClimbBuffer failed', e); return null; }
}

export function playGearClimb(gear = 1){ try{ resumeIfNeeded(); const ac = ctx; if (!_enabled) return; 
  try{
    gear = Math.max(1, Math.min(5, Math.floor(Number(gear) || 1)));
    if (_cachedGearClimbBuffer[gear]){
      try{ const src = ac.createBufferSource(); src.buffer = _cachedGearClimbBuffer[gear]; src.connect(ensureSfxGain() || ac.destination); src.start(); return; }catch(_){ /* continue to re-render */ }
    }

    (async ()=>{
      try{
        const buf = await _renderGearClimbBuffer(gear);
        _cachedGearClimbBuffer[gear] = buf;
        const s = ac.createBufferSource(); s.buffer = buf; s.connect(ensureSfxGain() || ac.destination); s.start();
      }catch(e){ console.warn('playGearClimb render failed', e); }
    })();
  }catch(e){ console.warn('playGearClimb failed', e); } }catch(e){ console.warn('playGearClimb outer failed', e); } }

// Array of shoot sound variations
const SHOOT_SOUND_VARIATIONS = [
  'Sounds/shootz1.wav',
  'Sounds/shootz2.wav',
  'Sounds/shootz3.wav'
];

export function playShoot(){ try{ resumeIfNeeded();
  if (!_enabled) return;

  // Randomly select one of the three shoot sound variations
  const randomIndex = Math.floor(Math.random() * SHOOT_SOUND_VARIATIONS.length);
  const soundPath = SHOOT_SOUND_VARIATIONS[randomIndex];

  try{
    const audio = new Audio(soundPath);
    audio.crossOrigin = 'anonymous';
    audio.volume = DEFAULT_SFX_VOLUME;
    try{ _activeHtmlAudio.add(audio); audio.addEventListener('ended', ()=>{ try{ _activeHtmlAudio.delete(audio); }catch(_){ } }); audio.addEventListener('error', ()=>{ try{ _activeHtmlAudio.delete(audio); }catch(_){ } }); }catch(_){ }

    // Attempt to play the sound
    const p = audio.play();
    if (p && typeof p.then === 'function') {
      p.catch((e) => {
        console.warn('playShoot autoplay blocked:', e);
      });
    }
  }catch(e){
    console.warn('playShoot failed to create audio element:', e);
  }
}catch(e){ console.warn('playShoot final catch', e); } }

export function startShift(){
  try{
    resumeIfNeeded();
    if (_shiftNode) return; // already running
    const ac = ctx || ensureCtx();
    if (!ac) return;
    if (!_enabled) return;

    // Prefer cached buffer for better quality/stability
    try{
      if (_cachedShiftBuffer){
        const src = ac.createBufferSource(); src.buffer = _cachedShiftBuffer; src.loop = true;
        try{ src.playbackRate.value = (GEAR_BASE_RPM[_currentShiftGear] || IDLE_RPM) / IDLE_RPM; }catch(_){ }
        const g = ac.createGain(); g.gain.value = 0.0001;
        src.connect(g).connect(ensureSfxGain() || ac.destination);
        try{ src.start(); }catch(_){ try{ src.start(0); }catch(__){} }
        _shiftNode = { type: 'buf', src, gain: g };
        _shiftGain = null;
        const now = (ac.currentTime || 0);
        try{ g.gain.exponentialRampToValueAtTime(0.6, now + 0.22); }catch(_){ g.gain.setValueAtTime(0.6, now); }
        return;
      }
    }catch(e){ console.warn('startShift fast buffer path failed', e); }

    // Try to render shift buffer asynchronously and start it when ready. If rendering fails, fall back to oscillator.
    (async ()=>{
      try{
        const buf = await _renderShiftBuffer();
        if (buf){
          _cachedShiftBuffer = buf;
          const src = ac.createBufferSource(); src.buffer = buf; src.loop = true;
          try{ src.playbackRate.value = (GEAR_BASE_RPM[_currentShiftGear] || IDLE_RPM) / IDLE_RPM; }catch(_){ }
          const g = ac.createGain(); g.gain.value = 0.0001;
          src.connect(g).connect(ensureSfxGain() || ac.destination);
          try{ src.start(); }catch(_){ try{ src.start(0); }catch(__){} }
          _shiftNode = { type: 'buf', src, gain: g };
          _shiftGain = null;
          const now = (ac.currentTime || 0);
          try{ g.gain.exponentialRampToValueAtTime(0.6, now + 0.22); }catch(_){ g.gain.setValueAtTime(0.6, now); }
          return;
        }
      }catch(e){ console.warn('startShift render failed', e); }

      // Oscillator fallback (sane, fully-connected)
      try{
        if (!ac || !_enabled) return;
        const osc = ac.createOscillator(); const g = ac.createGain();
        osc.type = 'sawtooth';
        try{ osc.frequency.value = _shiftBaseFreq * ((GEAR_BASE_RPM[_currentShiftGear] || IDLE_RPM) / IDLE_RPM); }catch(_){ osc.frequency.value = _shiftBaseFreq; }
        g.gain.value = 0.0001;
        osc.connect(g).connect(ensureSfxGain() || ac.destination);
        const now = (ac.currentTime || 0);
        try{ osc.start(now); }catch(_){ try{ osc.start(); }catch(__){} }
        try{ g.gain.exponentialRampToValueAtTime(0.6, now + 0.22); }catch(_){ g.gain.setValueAtTime(0.6, now); }
        _shiftNode = { type: 'osc', osc, gain: g };
        _shiftGain = g;
      }catch(e){ console.warn('startShift oscillator fallback failed', e); }
    })();
  }catch(e){ console.warn('startShift failed', e); }
}

export function stopShift(){
  try{
    if (!_shiftNode) return;
    const ac = ctx || ensureCtx();
    const now = (ac && ac.currentTime) || 0;

    // Try to fade any explicit master gain used by oscillator fallback
    try{
      if (_shiftGain && _shiftGain.gain){
        _shiftGain.gain.cancelScheduledValues && _shiftGain.gain.cancelScheduledValues(now);
        _shiftGain.gain.setValueAtTime(_shiftGain.gain.value || 0.001, now);
        try{ _shiftGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12); }catch(_){ _shiftGain.gain.linearRampToValueAtTime(0.0001, now + 0.12); }
      }
    }catch(_){ }

    try{
      if (typeof _shiftNode === 'object'){
        if (_shiftNode.type === 'buf'){
          const g = _shiftNode.gain;
          try{
            if (g && g.gain){ g.gain.cancelScheduledValues && g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value || 0.001, now); try{ g.gain.exponentialRampToValueAtTime(0.0001, now + 0.16); }catch(_){ g.gain.linearRampToValueAtTime(0.0001, now + 0.16); } }
          }catch(_){ }
          setTimeout(()=>{
            try{
              if (_shiftNode && _shiftNode.src){ try{ _shiftNode.src.stop && _shiftNode.src.stop(); }catch(_){ } _shiftNode.src.disconnect && _shiftNode.src.disconnect(); }
              if (_shiftNode && _shiftNode.gain) _shiftNode.gain.disconnect && _shiftNode.gain.disconnect();
            }catch(_){ }
            _shiftNode = null; _shiftGain = null;
          }, 260);
        }else if (_shiftNode.type === 'osc'){
          try{
            const g = _shiftNode.gain;
            if (g && g.gain){ g.gain.cancelScheduledValues && g.gain.cancelScheduledValues(now); g.gain.setValueAtTime(g.gain.value || 0.001, now); try{ g.gain.exponentialRampToValueAtTime(0.0001, now + 0.12); }catch(_){ g.gain.linearRampToValueAtTime(0.0001, now + 0.12); } }
          }catch(_){ }
          try{ if (_shiftNode.osc) { try{ _shiftNode.osc.stop && _shiftNode.osc.stop(); }catch(_){ } _shiftNode.osc.disconnect && _shiftNode.osc.disconnect(); } }catch(_){ }
          try{ if (_shiftNode.gain) _shiftNode.gain.disconnect && _shiftNode.gain.disconnect(); }catch(_){ }
          _shiftNode = null; _shiftGain = null;
        }else{
          // unknown shape: attempt safe cleanup
          try{ if (_shiftNode.src) { try{ _shiftNode.src.stop && _shiftNode.src.stop(); }catch(_){ } _shiftNode.src.disconnect && _shiftNode.src.disconnect(); } }catch(_){ }
          try{ if (_shiftNode.gain) _shiftNode.gain.disconnect && _shiftNode.gain.disconnect(); }catch(_){ }
          try{ if (_shiftNode.osc) { try{ _shiftNode.osc.stop && _shiftNode.osc.stop(); }catch(_){ } _shiftNode.osc.disconnect && _shiftNode.osc.disconnect(); } }catch(_){ }
          _shiftNode = null; _shiftGain = null;
        }
      }
    }catch(_){ }
  }catch(e){ console.warn('stopShift failed', e); }
}

// Update the current gear used to pitch the running shift hum (1..5).
export function setShiftGear(gear){
  try{
    const g = Math.max(1, Math.min(5, Math.floor(Number(gear) || 1)));
    _currentShiftGear = g;
    try{
      if (_shiftNode){
        const ac = ctx || ensureCtx(); const now = (ac && ac.currentTime) || 0;
        const targetRate = (GEAR_BASE_RPM[g] || IDLE_RPM) / IDLE_RPM;
        if (typeof _shiftNode === 'object' && _shiftNode.src){
          try{
            const pr = _shiftNode.src.playbackRate;
            pr.cancelScheduledValues && pr.cancelScheduledValues(now);
            let cur = (pr && pr.value) || 1;
            if (!(cur > 0)) cur = 0.0001;
            pr.setValueAtTime(cur, now);
            try{ pr.exponentialRampToValueAtTime(Math.max(0.0001, targetRate), now + 0.12); }
            catch(_){ pr.linearRampToValueAtTime(targetRate, now + 0.12); }
            try{
              const fo = _shiftNode.filter && _shiftNode.filter.frequency;
              if (fo){ fo.cancelScheduledValues && fo.cancelScheduledValues(now); const curF = fo.value || 1000; const targetF = 1200 + g * 800; fo.setValueAtTime(curF, now); fo.exponentialRampToValueAtTime(Math.max(200, targetF), now + 0.12); }
            }catch(_){ }
          }catch(_){ }
        }else if (_shiftNode && _shiftNode.type === 'osc' && _shiftNode.osc && _shiftNode.osc.frequency){
          try{
            const freqTarget = _shiftBaseFreq * targetRate;
            const f = _shiftNode.osc.frequency;
            f.cancelScheduledValues && f.cancelScheduledValues(now);
            let curF = f.value || _shiftBaseFreq;
            if (!(curF > 0)) curF = 10;
            f.setValueAtTime(curF, now);
            try{ f.exponentialRampToValueAtTime(Math.max(1, freqTarget), now + 0.12); }
            catch(_){ f.linearRampToValueAtTime(freqTarget, now + 0.12); }
          }catch(_){ }
        }
      }
    }catch(_){ }
  }catch(e){ console.warn('setShiftGear failed', e); }
}

export function playGib(){ try{ resumeIfNeeded(); const ac = ctx; const noiseLen = 0.25; const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * noiseLen), ac.sampleRate); const d = buf.getChannelData(0); for (let i=0;i<d.length;i++) d[i] = (Math.random()*2-1) * (1 - i/d.length);
  if (!_enabled) return;
  const src = ac.createBufferSource(); src.buffer = buf; const bp = ac.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200 + Math.random()*1200; bp.Q.value = 0.8 + Math.random()*1.2;
  const g = ac.createGain(); g.gain.value = 0.0001; src.connect(bp).connect(g).connect(ensureSfxGain() || ac.destination);
  const now = ac.currentTime; g.gain.setValueAtTime(0.0001, now); g.gain.exponentialRampToValueAtTime(0.8, now + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);
  src.start(now); src.stop(now + 0.22);
 }catch(e){ console.warn('playGib failed', e); } }

export function playCannonBlast(options = {}){
  try{
    resumeIfNeeded(); const ac = ctx; const now = (ac && ac.currentTime) || 0;
    if (!_enabled) return;

    // Allow selecting a variant; if none provided pick one randomly among choices
    const variants = ['default','v1','v2','v3'];
    const variant = options.variant && variants.includes(options.variant) ? options.variant : variants[Math.floor(Math.random()*variants.length)];

    // larger master chain for explosion
    const master = ac.createGain(); master.gain.value = 0.00001; master.connect(ensureSfxGain() || ac.destination);
    // mixing bus -> shaper -> delay -> master
    const mix = ac.createGain(); mix.gain.value = 1.0;

    // base params
    let subF = options.subFreq || (40 + Math.random()*36);
    let subGain = 0.0045;
    let bodyGainVal = 0.0038;
    let transientLen = 0.06;
    let transientGain = 0.008;
    let delayTime = 0.08 + Math.random()*0.06;
    let fbGain = 0.28 + Math.random()*0.12;
  let masterPeak = 1.6;
  let masterTail = 2.2; // default tail to preserve original timing

    // variant tuning
    if (variant === 'v1') { // deeper, heavier
      subF = options.subFreq || (34 + Math.random()*24);
      subGain *= 1.35; bodyGainVal *= 1.15; transientGain *= 1.1; delayTime += 0.02; fbGain += 0.04; masterPeak = 1.8;
      masterTail = 2.6;
    } else if (variant === 'v2') { // bright/punchy
      subF = options.subFreq || (46 + Math.random()*20);
      subGain *= 1.0; bodyGainVal *= 1.45; transientGain *= 1.5; transientLen = 0.08; delayTime -= 0.02; fbGain -= 0.02; masterPeak = 1.5;
      masterTail = 2.0;
    } else if (variant === 'v3') { // long rumble tail
      subF = options.subFreq || (38 + Math.random()*20);
      subGain *= 1.2; bodyGainVal *= 1.0; transientGain *= 0.9; delayTime += 0.04; fbGain += 0.06; masterPeak = 1.4;
      masterTail = 3.2;
    }

    // Sub thump
    const sub = ac.createOscillator(); sub.type = 'sine'; sub.frequency.setValueAtTime(subF, now);
    sub.frequency.exponentialRampToValueAtTime(Math.max(12, subF * 0.18), now + 0.32);
    const subG = ac.createGain(); subG.gain.value = subGain; sub.connect(subG); subG.connect(mix);

    // Body (detuned saws)
    const body = ac.createOscillator(); body.type = 'sawtooth'; body.frequency.value = Math.max(60, subF * 1.6);
    const body2 = ac.createOscillator(); body2.type = 'sawtooth'; body2.frequency.value = body.frequency.value * (1 + (Math.random()*0.05 - 0.025));
    const bodyG = ac.createGain(); bodyG.gain.value = bodyGainVal; body.connect(bodyG); body2.connect(bodyG); bodyG.connect(mix);

    // Transient slap
    const tLen = transientLen; const tBuf = ac.createBuffer(1, Math.floor(ac.sampleRate * tLen), ac.sampleRate); const td = tBuf.getChannelData(0); for (let i=0;i<td.length;i++){ td[i] = (Math.random()*2-1) * Math.pow(1 - i/td.length, 2); }
    const transient = ac.createBufferSource(); transient.buffer = tBuf; transient.loop = false;
    const tHP = ac.createBiquadFilter(); tHP.type = 'highpass'; tHP.frequency.value = 800; const tG = ac.createGain(); tG.gain.value = transientGain; transient.connect(tHP).connect(tG).connect(mix);

    // Sustained noise blast for body
    const nlen = 0.9; const nb = ac.createBuffer(1, Math.floor(ac.sampleRate * nlen), ac.sampleRate); const nd = nb.getChannelData(0); for (let i=0;i<nd.length;i++) nd[i] = (Math.random()*2-1) * (1 - i/nd.length);
    const noise = ac.createBufferSource(); noise.buffer = nb; noise.loop = false;
    const nf = ac.createBiquadFilter(); nf.type = 'highpass'; nf.frequency.value = 180; const nl = ac.createBiquadFilter(); nl.type = 'lowpass'; nl.frequency.value = 4500; const ng = ac.createGain(); ng.gain.value = 0.0036; noise.connect(nf).connect(nl).connect(ng).connect(mix);

    // Heavy waveshaper
    const sh = ac.createWaveShaper(); function mk(a){ const n=8192; const c=new Float32Array(n); for(let i=0;i<n;i++){ const x = i*2/n - 1; c[i] = Math.tanh(x * (a||12)); } return c; }
    sh.curve = mk(12); sh.oversample = '4x';

    // Short feedback delay for tail
    const delay = ac.createDelay(0.5); delay.delayTime.value = delayTime;
    const fb = ac.createGain(); fb.gain.value = fbGain; delay.connect(fb); fb.connect(delay);

    // routing
    mix.connect(sh); sh.connect(delay); delay.connect(master);
    const directLow = ac.createBiquadFilter(); directLow.type = 'lowpass'; directLow.frequency.value = 900; mix.connect(directLow).connect(master);

    // Master envelope
    master.gain.setValueAtTime(0.00001, now);
    master.gain.exponentialRampToValueAtTime(masterPeak, now + 0.006);
    master.gain.exponentialRampToValueAtTime(0.45, now + 0.14);
  master.gain.exponentialRampToValueAtTime(0.00001, now + masterTail);

    // Noise envelope
    ng.gain.setValueAtTime(0.00001, now); ng.gain.exponentialRampToValueAtTime(1.8, now + 0.008); ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    // start
    try{ sub.start(now); body.start(now); body2.start(now); transient.start(now); noise.start(now); }catch(_){ }

    // cleanup
    const stopT = now + 2.6;
    setTimeout(()=>{
      try{ sub.stop && sub.stop(); body.stop && body.stop(); body2.stop && body2.stop(); transient.stop && transient.stop(); noise.stop && noise.stop(); }
      catch(_){ }
      setTimeout(()=>{
        try{ sub.disconnect(); body.disconnect(); body2.disconnect(); transient.disconnect(); noise.disconnect(); mix.disconnect(); sh.disconnect(); delay.disconnect(); fb.disconnect(); directLow.disconnect(); master.disconnect(); }
        catch(_){ }
      }, 800);
    }, Math.max(250, (stopT-now)*1000));
  }catch(e){ console.warn('playCannonBlast failed', e); }
}

// Background music handling (uses an HTMLAudioElement routed into the AudioContext so we can
// control volume and resume context when needed). Uses rotating playlist of background music tracks.
let _jungleEl = null;
let _jungleSource = null;
let _jungleGain = null;
let _jungleFadeInterval = null;
// Control whether background music is allowed to autoplay/play.
let _bgmAllowed = true;

// Control whether background music is allowed to start. Exported so UI or game logic can enable it on gesture.
export function setBgmAllowed(v){ try{ _bgmAllowed = !!v; if (!_bgmAllowed){ try{ stopJungleEchoes(); }catch(_){ } } }catch(e){ console.warn('setBgmAllowed failed', e); } }
export function isBgmAllowed(){ return !!_bgmAllowed; }

// Background music playlist
const BGM_PLAYLIST = [
  'Sounds/Jungle Echoes.mp3',
  'Sounds/Jungle Groove.mp3',
  'Sounds/Nostalgic Echoes.mp3',
  'Sounds/jank.wav'
];
let _currentTrackIndex = 0;

// Main background music function - cycles through playlist
export function playBgm(path = null, loop = false, volume = 0.3){
  console.log('playBgm called with path:', path, 'enabled:', _enabled, 'bgmAllowed:', _bgmAllowed);
  try{
    // If a specific path is provided, use it; otherwise cycle through playlist
    // Ensure jank.wav is always the first track when starting playback without a specified path
    let audioPath;
    if (path) {
      audioPath = path;
    } else {
      // If no audio is currently playing, start from the first track (Jungle Echoes)
      if (!_jungleEl) {
        _currentTrackIndex = 0;
      }
      // clamp current index
      _currentTrackIndex = Math.max(0, Math.min(_currentTrackIndex, BGM_PLAYLIST.length - 1));
      audioPath = BGM_PLAYLIST[_currentTrackIndex];
      console.log('Playing from playlist:', audioPath, '(track', _currentTrackIndex + 1, 'of', BGM_PLAYLIST.length + ')');
    }

    // Ensure audio context is initialized
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      console.log('Audio context created, state:', ctx.state);
    }

    // Resume if suspended
    if (ctx.state === 'suspended') {
      console.log('Resuming suspended audio context');
      ctx.resume().then(() => {
        console.log('Audio context resumed, state:', ctx.state);
      }).catch(err => {
        console.warn('Failed to resume audio context:', err);
      });
    }

    // Respect the global allow flag
    if (!_enabled || !_bgmAllowed) {
      console.log('BGM blocked: enabled =', _enabled, 'bgmAllowed =', _bgmAllowed);
      return;
    }

    console.log('Creating audio element for:', audioPath);
  _jungleEl = new Audio(audioPath);
    _jungleEl.loop = loop;
    _jungleEl.volume = 0; // Start at 0 for fade in
    _jungleEl.crossOrigin = 'anonymous';
  try{ _activeHtmlAudio.add(_jungleEl); _jungleEl.addEventListener('ended', ()=>{ try{ _activeHtmlAudio.delete(_jungleEl); }catch(_){ } }); _jungleEl.addEventListener('error', ()=>{ try{ _activeHtmlAudio.delete(_jungleEl); }catch(_){ } }); }catch(_){ }

    // Set up track cycling for playlist mode
    if (!path) {
      _jungleEl.addEventListener('ended', () => {
        console.log('Track ended, moving to next track in playlist');
        _currentTrackIndex = (_currentTrackIndex + 1) % BGM_PLAYLIST.length;
        // Auto-play next track after a short pause
        setTimeout(() => {
          if (_enabled && _bgmAllowed) {
            playBgm(null, false, volume);
          }
        }, 2000); // 2 second pause between tracks
      });
    }

    // Simple approach - just try to play
    console.log('Attempting to play audio');
    const playPromise = _jungleEl.play();

    if (playPromise !== undefined) {
      playPromise.then(() => {
        console.log('Audio started playing successfully');
        // Fade in after successful play
        fadeInJungleEchoes(volume);
      }).catch(error => {
        console.warn('Audio play failed:', error);
        // Try again after a short delay
        setTimeout(() => {
          console.log('Retrying audio play');
          _jungleEl.play().then(() => {
            console.log('Audio started on retry');
            fadeInJungleEchoes(volume);
          }).catch(err => {
            console.warn('Audio retry failed:', err);
          });
        }, 1000);
      });
    } else {
      console.log('Audio play returned undefined (older browser)');
      fadeInJungleEchoes(volume);
    }

  }catch(e){
    console.warn('playBgm failed:', e);
  }
}

export function stopBgm(){ try{
  // Reset playlist to beginning so next play starts with jank.wav
  _currentTrackIndex = 0;

  if (_jungleEl){
    // Remove event listeners to prevent auto-play of next track
    _jungleEl.removeEventListener('ended', null);
    try{ _jungleEl.pause(); _jungleEl.currentTime = 0; }catch(_){ }
    try{ if (_jungleSource) _jungleSource.disconnect(); if (_jungleGain) _jungleGain.disconnect(); }catch(_){ }
    try{ _activeHtmlAudio.delete(_jungleEl); }catch(_){ }
    _jungleEl = null; _jungleSource = null; _jungleGain = null; }
  }catch(e){ console.warn('stopBgm failed', e); } }

// Get current playlist information
export function getCurrentTrackInfo() {
  return {
    currentTrack: _currentTrackIndex + 1,
    totalTracks: BGM_PLAYLIST.length,
    currentFile: BGM_PLAYLIST[_currentTrackIndex],
    isPlaying: _jungleEl && !_jungleEl.paused
  };
}

export function setBgmVolume(v){ try{ if (!ctx) ensureCtx(); if (_jungleGain && typeof v === 'number'){ _jungleGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime); }else if (_jungleEl){ _jungleEl.volume = Math.max(0, Math.min(1, v)); } }catch(e){ console.warn('setBgmVolume failed', e); } }

// Simple fade in function for background music tracks
function fadeInJungleEchoes(targetVolume = 0.3, duration = 3000) {
  if (!_jungleEl) return;
  
  console.log('Starting fade in to volume:', targetVolume);
  const startVolume = _jungleEl.volume;
  const volumeDiff = targetVolume - startVolume;
  const steps = 30;
  const stepDuration = duration / steps;
  let step = 0;
  
  const fadeInterval = setInterval(() => {
    step++;
    const progress = step / steps;
    const currentVolume = startVolume + (volumeDiff * progress);
    
    if (_jungleEl) {
      _jungleEl.volume = Math.max(0, Math.min(1, currentVolume));
    }
    
    if (step >= steps) {
      clearInterval(fadeInterval);
      console.log('Fade in completed, final volume:', _jungleEl.volume);
    }
  }, stepDuration);
}

// Enable or disable all SFX/BGM. When disabling we stop ongoing audio (bgm/shift).
export function setEnabled(v){ try{ _enabled = !!v; if (!_enabled){ try{ stopShift(); }catch(_){ } try{ stopBgm(); }catch(_){ } try{ stopHelicopter(); }catch(_){ } try{ stopJungleEchoes(); }catch(_){ } } }catch(e){ console.warn('setEnabled failed', e); } }
export function isEnabled(){ return !!_enabled; }

// Helicopter sound management
let _heliEl = null;
let _heliSource = null;
let _heliGain = null;

export function playHelicopter(volume = 0.5){ try{ resumeIfNeeded(); if (!ctx) ensureCtx(); const ac = ctx; // create or reuse audio element
  if (!_enabled) return;
    if (!_heliEl){ // new element
      try{ stopHelicopter(); }catch(_){ }
  _heliEl = new Audio('Sounds/helicopter.wav');
      _heliEl.loop = true;
      _heliEl.crossOrigin = 'anonymous';
  try{ _activeHtmlAudio.add(_heliEl); _heliEl.addEventListener('ended', ()=>{ try{ _activeHtmlAudio.delete(_heliEl); }catch(_){ } }); _heliEl.addEventListener('error', ()=>{ try{ _activeHtmlAudio.delete(_heliEl); }catch(_){ } }); }catch(_){ }
      try{
        _heliSource = ac.createMediaElementSource(_heliEl);
        _heliGain = ac.createGain(); _heliGain.gain.value = Math.max(0, Math.min(1, volume));
        _heliSource.connect(_heliGain).connect(ac.destination);
      }catch(e){
        // Some browsers may not allow MediaElementSource before a gesture; fallback to plain element playback
        console.warn('heli media element routing failed, falling back to direct Audio element', e);
        try{ _heliEl.volume = Math.max(0, Math.min(1, volume)); }catch(_){ }
      }
    }else{
      // reuse
      _heliEl.loop = true;
      if (_heliGain) {
        _heliGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ac.currentTime);
      } else if (_heliEl){
        try{ _heliEl.volume = Math.max(0, Math.min(1, volume)); }catch(_){ }
      }
    }
    // attempt to play; this may require a user gesture in many browsers
    const p = _heliEl.play(); if (p && typeof p.then === 'function') p.catch(()=>{/* autoplay blocked; wait for user gesture */});
  }catch(e){ console.warn('playHelicopter failed', e); } }

export function setHelicopterVolume(v){ try{ if (!ctx) ensureCtx(); if (_heliGain && typeof v === 'number'){ _heliGain.gain.setValueAtTime(Math.max(0, Math.min(1, v)), ctx.currentTime); }else if (_heliEl){ _heliEl.volume = Math.max(0, Math.min(1, v)); } }catch(e){ console.warn('setHelicopterVolume failed', e); } }

export function stopHelicopter(){ try{ if (_heliEl){ try{ _heliEl.pause(); _heliEl.currentTime = 0; }catch(_){ } try{ if (_heliSource) _heliSource.disconnect(); if (_heliGain) _heliGain.disconnect(); }catch(_){ } _heliEl = null; _heliSource = null; _heliGain = null; } }catch(e){ console.warn('stopHelicopter failed', e); } }

export function stopJungleEchoes(){
  try{
    if (_jungleEl){
      _jungleEl.pause();
      _jungleEl.currentTime = 0;
      _jungleEl.volume = 0;
      console.log('Background music stopped');
      try{ _activeHtmlAudio.delete(_jungleEl); }catch(_){ }
    }
  }catch(e){
    console.warn('stopJungleEchoes failed', e);
  }
}

// Stop all ongoing audio, including tracked HTMLAudio elements and loops
export function stopAll(){
  try{ stopShift(); }catch(_){ }
  try{ stopHelicopter(); }catch(_){ }
  try{ stopBgm(); }catch(_){ }
  try{ stopJungleEchoes(); }catch(_){ }
  try{
    _activeHtmlAudio.forEach(el=>{ try{ el.pause(); el.currentTime = 0; }catch(_){ } });
    _activeHtmlAudio.clear();
  }catch(_){ }
}







