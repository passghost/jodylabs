// main.js
// --- Supabase Setup ---
// TODO: Replace with your actual Supabase project URL and anon key
const SUPABASE_URL = 'https://omcwjmvdjswkfjkahchm.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9tY3dqbXZkanN3a2Zqa2FoY2htIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE0NDU1MDcsImV4cCI6MjA2NzAyMTUwN30.v-zypq4wN5EW0z8dxbUHWeNzDhuTylyL4chpBfTISxE';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// --- Game State ---
const OCEAN_WIDTH = 3840;
const OCEAN_HEIGHT = 2160;
const PIXEL_SIZE = 1;
const MOVE_INTERVAL = 5000; // 5 seconds
let zoom = 1;
let player = null;
let panX = 0;
let panY = 0;
let allPlayers = [];
let moveTimeout = null;
let moveIntervalId = null;
let moveCountdown = 0;
let interactionHistory = [];
let extraMovePending = false;
// --- Islands/Ports ---
const ISLANDS = [];
function generateIslands() {
  // Place 6-10 islands, each a brown blob (ellipse) with a green port pixel
  const numIslands = Math.floor(Math.random() * 5) + 6;
  for (let i = 0; i < numIslands; i++) {
    const cx = Math.floor(Math.random() * (OCEAN_WIDTH - 100) + 50);
    const cy = Math.floor(Math.random() * (OCEAN_HEIGHT - 100) + 50);
    const rx = Math.floor(Math.random() * 20) + 20;
    const ry = Math.floor(Math.random() * 20) + 20;
    // Port is always on the edge of the island
    const angle = Math.random() * 2 * Math.PI;
    const portX = Math.round(cx + Math.cos(angle) * rx);
    const portY = Math.round(cy + Math.sin(angle) * ry);
    ISLANDS.push({ cx, cy, rx, ry, portX, portY });
  }
}

function isIsland(x, y) {
  // Returns true if (x,y) is inside any island blob
  for (const isl of ISLANDS) {
    const dx = (x - isl.cx) / isl.rx;
    const dy = (y - isl.cy) / isl.ry;
    if (dx * dx + dy * dy <= 1) return true;
  }
  return false;
}
function isPort(x, y) {
  for (const isl of ISLANDS) {
    if (x === isl.portX && y === isl.portY) return true;
  }
  return false;
}

const canvas = document.getElementById('oceanCanvas');
const ctx = canvas.getContext('2d');

// --- Login ---
async function login() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  let { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) {
    document.getElementById('loginStatus').innerText = error.message;
    return;
  }
  if (data && data.user) {
    document.getElementById('login').style.display = 'none';
    document.getElementById('hud').style.display = 'block';
    // Remove any background set by login
    document.body.style.background = 'none';
    await initPlayer(data.user);
    startGameLoop();
  }
}

async function register() {
  const email = document.getElementById('email').value;
  const password = document.getElementById('password').value;
  let { data, error } = await sb.auth.signUp({ email, password });
  if (error) {
    document.getElementById('loginStatus').innerText = error.message;
    return;
  }
  if (data && data.user) {
    document.getElementById('loginStatus').innerText = 'Registration successful! Please check your email (if confirmation is enabled) or log in.';
  } else {
    document.getElementById('loginStatus').innerText = 'Registration request sent. Please check your email.';
  }
}

// --- Player State ---
async function initPlayer(user) {
  // Fetch or create player row in DB
  let { data, error } = await sb.from('pirates').select('*').eq('id', user.id).single();
  if (!data) {
    // Place randomly
    const x = Math.floor(Math.random() * OCEAN_WIDTH);
    const y = Math.floor(Math.random() * OCEAN_HEIGHT);
    const newPlayer = {
      id: user.id,
      email: user.email,
      x, y,
      hull: 100,
      crew: 10,
      items: [],
      booty: 0,
      color: '#8B5C2A', // brown
    };
    await sb.from('pirates').insert([newPlayer]);
    player = newPlayer;
  } else {
    player = data;
  }
}

// --- Game Loop ---
function startGameLoop() {
  if (ISLANDS.length === 0) generateIslands();
  fetchPlayers();
  drawOcean();
  drawPlayers();
  updateHUD();
  setupInput();
  // Auto-zoom in on login
  zoom = 16;
  setZoom();
  startMoveCountdown();
  setInterval(fetchPlayers, 2000); // Poll for other players
}

function startMoveCountdown() {
  moveCountdown = MOVE_INTERVAL / 1000;
  updateMoveTimer();
  canMove = false;
  if (moveIntervalId) clearInterval(moveIntervalId);
  moveIntervalId = setInterval(() => {
    moveCountdown--;
    updateMoveTimer();
    if (moveCountdown <= 0) {
      clearInterval(moveIntervalId);
      canMove = true;
    }
  }, 1000);
}

function updateMoveTimer() {
  const timerDiv = document.getElementById('moveTimer');
  if (moveCountdown > 0) {
    timerDiv.innerHTML = `⏳ Next move in: <b>${moveCountdown}</b> seconds`;
  } else {
    timerDiv.innerHTML = `<span style="color:#FFD700; font-weight:bold;">YARRR! Move now!</span>`;
  }
}

function drawOcean() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // Solid vivid blue base
  ctx.fillStyle = '#2196F3'; // vivid blue
  ctx.fillRect(0, 0, OCEAN_WIDTH, OCEAN_HEIGHT);
  // Water texture overlay (static noise pattern, more visible)
  for (let i = 0; i < 24000; i++) {
    const alpha = Math.random() * 0.25 + 0.12;
    const blue = 180 + Math.floor(Math.random() * 70);
    const green = 140 + Math.floor(Math.random() * 80);
    ctx.fillStyle = `rgba(30,${green},${blue},${alpha})`;
    ctx.fillRect(Math.random() * OCEAN_WIDTH, Math.random() * OCEAN_HEIGHT, 2, 2);
  }
  // Draw islands
  for (const isl of ISLANDS) {
    ctx.save();
    ctx.beginPath();
    ctx.ellipse(isl.cx, isl.cy, isl.rx, isl.ry, 0, 0, 2 * Math.PI);
    ctx.fillStyle = '#8B5C2A';
    ctx.shadowColor = '#442200';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();
    // Draw port
    ctx.save();
    ctx.fillStyle = '#00FF00';
    ctx.shadowColor = '#00FF00';
    ctx.shadowBlur = 6;
    ctx.fillRect(isl.portX, isl.portY, 2, 2);
    ctx.restore();
  }
  // Subtle wave lines
  for (let y = 0; y < OCEAN_HEIGHT; y += 32) {
    ctx.strokeStyle = 'rgba(80,160,220,0.07)';
    ctx.beginPath();
    for (let x = 0; x < OCEAN_WIDTH; x += 32) {
      const wave = Math.sin((x + y) * 0.01) * 4;
      ctx.lineTo(x, y + wave);
    }
    ctx.stroke();
  }
}

function drawPlayers() {
  // Draw all other pirates first (no glow)
  allPlayers.forEach(p => {
    if (p.id !== player.id) {
      ctx.fillStyle = p.color || '#8B5C2A';
      ctx.fillRect(p.x, p.y, PIXEL_SIZE, PIXEL_SIZE);
    }
  });

  // Draw the player's own pixel with glow
  ctx.save();
  ctx.shadowColor = '#FFD700';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#8B5C2A'; // brown
  ctx.fillRect(player.x, player.y, PIXEL_SIZE, PIXEL_SIZE);
  ctx.restore();

  // Optional: Draw a gold outline for extra clarity
  ctx.save();
  ctx.strokeStyle = '#FFD700';
  ctx.lineWidth = 2;
  ctx.strokeRect(player.x - 1, player.y - 1, PIXEL_SIZE + 2, PIXEL_SIZE + 2);
  ctx.restore();
}

function updateHUD() {
  if (!player) return;
  const statsDiv = document.getElementById('playerStats');
  if (statsDiv) {
    statsDiv.innerText = `Hull: ${player.hull}\nCrew: ${player.crew}\nBooty: ${player.booty}\nPos: (${player.x},${player.y})\nZoom: ${zoom}x`;
  }
}

function updateInteractionLog(msg) {
  interactionHistory.unshift(msg);
  if (interactionHistory.length > 8) interactionHistory.length = 8;
  const logDiv = document.getElementById('interactionLog');
  if (logDiv) {
    logDiv.innerHTML = interactionHistory.map(e => `<div>🦜 ${e}</div>`).join('');
  }
}

// --- Input ---
let canMove = true;
function setupInput() {
  window.onkeydown = async (e) => {
    if (!canMove) return;
    let dx = 0, dy = 0;
    if (e.key === 'w') dy = -1;
    if (e.key === 's') dy = 1;
    if (e.key === 'a') dx = -1;
    if (e.key === 'd') dx = 1;
    if (dx !== 0 || dy !== 0) {
      canMove = false;
      await movePlayer(dx, dy);
      if (extraMovePending) {
        extraMovePending = false;
        updateInteractionLog('Ye get an extra move!');
        canMove = true;
      } else {
        setTimeout(() => startMoveCountdown(), 100);
      }
    }
  };
}

async function movePlayer(dx, dy) {
  const newX = Math.max(0, Math.min(OCEAN_WIDTH - 1, player.x + dx));
  const newY = Math.max(0, Math.min(OCEAN_HEIGHT - 1, player.y + dy));
  if (isIsland(newX, newY) || isPort(newX, newY)) {
    updateInteractionLog('Ye cannot sail onto land or port!');
    drawOcean();
    drawPlayers();
    setZoom();
    return;
  }
  player.x = newX;
  player.y = newY;
  await sb.from('pirates').update({ x: player.x, y: player.y }).eq('id', player.id);
  drawOcean();
  drawPlayers();
  setZoom();
  // 1/5 chance of interaction
  if (Math.random() < 0.2) {
    handleInteraction();
  } else {
    updateInteractionLog('The sea is calm this turn.');
  }
}

function handleInteraction() {
  const interactions = [
    { text: 'Rough waves! Hull takes 5 damage!', action: () => { player.hull = Math.max(0, player.hull - 5); updateHUD(); } },
    { text: 'It’s a clear day to sail! Take one more move, matey!', action: () => { extraMovePending = true; updateHUD(); } },
    { text: 'Dolphins bring ye booty! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A storm sweeps a crew member overboard! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'Ye find a floating barrel of rum! Crew morale rises. +2 crew!', action: () => { player.crew += 2; updateHUD(); } },
    { text: 'A sneaky kraken nicks yer hull! -10 hull!', action: () => { player.hull = Math.max(0, player.hull - 10); updateHUD(); } },
    { text: 'A rival pirate fires a warning shot! -3 hull!', action: () => { player.hull = Math.max(0, player.hull - 3); updateHUD(); } },
    { text: 'Ye discover a chest of gold! +5 booty!', action: () => { player.booty += 5; updateHUD(); } },
    { text: 'A mutiny brews! Lose 2 crew!', action: () => { player.crew = Math.max(0, player.crew - 2); updateHUD(); } },
    { text: 'A friendly merchant gifts ye supplies. +3 hull!', action: () => { player.hull += 3; updateHUD(); } },
    { text: 'A ghost ship haunts yer path! Lose 1 booty in fright!', action: () => { player.booty = Math.max(0, player.booty - 1); updateHUD(); } },
    { text: 'Ye rescue a stranded sailor. +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A cannon misfires! -2 hull!', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'Ye find a map to hidden treasure! +3 booty!', action: () => { player.booty += 3; updateHUD(); } },
    { text: 'A sea monster attacks! -4 hull, -1 crew!', action: () => { player.hull = Math.max(0, player.hull - 4); player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A parrot squawks a warning—ye dodge danger! Nothing happens.', action: () => { updateHUD(); } },
    { text: 'Ye trade with islanders. +2 booty, -1 crew (sent ashore)!', action: () => { player.booty += 2; player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A sudden squall! -1 hull, -1 booty washed away!', action: () => { player.hull = Math.max(0, player.hull - 1); player.booty = Math.max(0, player.booty - 1); updateHUD(); } },
    { text: 'Ye find a lucky charm! Next hull loss is halved.', action: () => { player.items = player.items || []; player.items.push('Lucky Charm'); updateHUD(); } },
    { text: 'A pirate legend inspires yer crew! +3 crew!', action: () => { player.crew += 3; updateHUD(); } },
    { text: 'A cannonball strikes! -7 hull!', action: () => { player.hull = Math.max(0, player.hull - 7); updateHUD(); } },
    { text: 'Ye win a dice game with smugglers! +2 booty!', action: () => { player.booty += 2; updateHUD(); } },
    { text: 'A stowaway is found! +1 crew, -1 booty (he steals a coin)!', action: () => { player.crew += 1; player.booty = Math.max(0, player.booty - 1); updateHUD(); } },
    { text: 'A mysterious fog—ye lose yer bearings. No effect.', action: () => { updateHUD(); } },
    { text: 'A sea witch curses yer hull! -6 hull!', action: () => { player.hull = Math.max(0, player.hull - 6); updateHUD(); } },
    { text: 'Ye find a bottle o’ rum! +1 crew (cheers!)', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A rival steals yer map! -2 booty!', action: () => { player.booty = Math.max(0, player.booty - 2); updateHUD(); } },
    { text: 'A pod of whales guides ye to safety. +2 hull!', action: () => { player.hull += 2; updateHUD(); } },
    { text: 'A cannonball narrowly misses! No effect.', action: () => { updateHUD(); } },
    { text: 'Ye barter with a hermit. +1 booty, -1 crew.', action: () => { player.booty += 1; player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A lucky wind fills yer sails! Take another move!', action: () => { extraMovePending = true; updateHUD(); } },
    { text: 'A shark bites yer hull! -8 hull!', action: () => { player.hull = Math.max(0, player.hull - 8); updateHUD(); } },
    { text: 'Ye find a golden doubloon! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A crew member falls ill. -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A friendly gull drops a coin on deck! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A cannon explodes! -3 hull, -1 crew!', action: () => { player.hull = Math.max(0, player.hull - 3); player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'Ye find a secret stash! +4 booty!', action: () => { player.booty += 4; updateHUD(); } },
    { text: 'A rival pirate challenges ye—lose 2 crew!', action: () => { player.crew = Math.max(0, player.crew - 2); updateHUD(); } },
    { text: 'A sudden calm—nothing happens.', action: () => { updateHUD(); } },
    { text: 'A mermaid blesses yer voyage! +2 hull!', action: () => { player.hull += 2; updateHUD(); } },
    { text: 'Ye find a rusty cutlass. (No effect, but it looks cool!)', action: () => { player.items = player.items || []; player.items.push('Rusty Cutlass'); updateHUD(); } },
    { text: 'A cannonball hits yer booty stash! -3 booty!', action: () => { player.booty = Math.max(0, player.booty - 3); updateHUD(); } },
    { text: 'A sea shanty lifts spirits! +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A pirate ghost steals yer gold! -2 booty!', action: () => { player.booty = Math.max(0, player.booty - 2); updateHUD(); } },
    { text: 'Ye find a message in a bottle! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A cannonball grazes the hull! -1 hull!', action: () => { player.hull = Math.max(0, player.hull - 1); updateHUD(); } },
    { text: 'A friendly trader gives ye a gift! +2 booty!', action: () => { player.booty += 2; updateHUD(); } },
    { text: 'A wild storm! -5 hull, -2 crew!', action: () => { player.hull = Math.max(0, player.hull - 5); player.crew = Math.max(0, player.crew - 2); updateHUD(); } },
    { text: 'Ye find a lucky coin! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A rival pirate sabotages yer ship! -4 hull!', action: () => { player.hull = Math.max(0, player.hull - 4); updateHUD(); } },
    { text: 'A friendly dolphin leads ye to treasure! +2 booty!', action: () => { player.booty += 2; updateHUD(); } },
    { text: 'A crew member finds a gold tooth! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A cannonball hits the mast! -2 hull!', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'Ye find a bottle of grog! +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A rival pirate steals yer rum! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A sea turtle brings ye luck! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A cannonball splinters the deck! -3 hull!', action: () => { player.hull = Math.max(0, player.hull - 3); updateHUD(); } },
    { text: 'Ye find a pearl! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A crew member deserts! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A friendly parrot brings ye a coin! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A cannonball hits the galley! -2 hull!', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'Ye find a treasure map! +2 booty!', action: () => { player.booty += 2; updateHUD(); } },
    { text: 'A rival pirate challenges ye to a duel! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A sea serpent slithers by—no effect, but it’s scary!', action: () => { updateHUD(); } },
    // --- 20 more interactions ---
    { text: 'Ye spot a distant volcano erupting! -2 hull from falling ash.', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'A merchant convoy shares supplies. +2 hull, +1 crew!', action: () => { player.hull += 2; player.crew += 1; updateHUD(); } },
    { text: 'A pirate bard joins yer crew! +1 crew, +1 booty (tips)!', action: () => { player.crew += 1; player.booty += 1; updateHUD(); } },
    { text: 'A cursed idol saps yer strength! -3 hull, -1 crew!', action: () => { player.hull = Math.max(0, player.hull - 3); player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A pod of dolphins guides ye to a hidden cove. +2 booty!', action: () => { player.booty += 2; updateHUD(); } },
    { text: 'A rival pirate throws rotten fruit! -1 crew (disgusted)!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'Ye find a message in a bottle—directions to treasure! +3 booty!', action: () => { player.booty += 3; updateHUD(); } },
    { text: 'A sudden hailstorm! -2 hull!', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'A friendly fisherman shares his catch. +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A sea witch offers a blessing. +2 hull, but -1 booty (payment)!', action: () => { player.hull += 2; player.booty = Math.max(0, player.booty - 1); updateHUD(); } },
    { text: 'A mysterious fog confuses yer crew. -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'Ye find a crate of fireworks! +2 booty, but -1 hull (accident)!', action: () => { player.booty += 2; player.hull = Math.max(0, player.hull - 1); updateHUD(); } },
    { text: 'A rival pirate challenges ye to a race! +1 booty if hull > 50.', action: () => { if (player.hull > 50) player.booty += 1; updateHUD(); } },
    { text: 'A pod of orcas blocks yer path. Lose a turn (no effect).', action: () => { updateHUD(); } },
    { text: 'A stowaway is discovered! -1 crew, +1 booty (he pays passage)!', action: () => { player.crew = Math.max(0, player.crew - 1); player.booty += 1; updateHUD(); } },
    { text: 'A friendly parrot teaches yer crew a new shanty! +2 crew!', action: () => { player.crew += 2; updateHUD(); } },
    { text: 'A rival pirate sabotages yer rudder! -2 hull!', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'Ye find a sunken ship! +4 booty!', action: () => { player.booty += 4; updateHUD(); } },
    { text: 'A sea monster demands tribute! -2 booty!', action: () => { player.booty = Math.max(0, player.booty - 2); updateHUD(); } },
    { text: 'A friendly trader offers a deal. +1 hull, +1 booty!', action: () => { player.hull += 1; player.booty += 1; updateHUD(); } },
    { text: 'A sudden squall tosses yer ship! -1 hull, -1 crew!', action: () => { player.hull = Math.max(0, player.hull - 1); player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'Ye find a rare spice! +2 booty!', action: () => { player.booty += 2; updateHUD(); } },
    { text: 'A rival pirate steals yer anchor! -1 hull!', action: () => { player.hull = Math.max(0, player.hull - 1); updateHUD(); } },
    { text: 'A pod of seals entertains yer crew! +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A sea witch curses yer booty! -3 booty!', action: () => { player.booty = Math.max(0, player.booty - 3); updateHUD(); } },
    { text: 'A friendly merchant gives ye a map! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A rival pirate throws a party! +1 crew, -1 booty!', action: () => { player.crew += 1; player.booty = Math.max(0, player.booty - 1); updateHUD(); } },
    { text: 'A pod of narwhals brings luck! +1 hull!', action: () => { player.hull += 1; updateHUD(); } },
    { text: 'A sudden calm—no effect.', action: () => { updateHUD(); } },
    { text: 'Ye find a bottle of fine wine! +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A rival pirate challenges ye to arm wrestling! +1 crew if crew > 5.', action: () => { if (player.crew > 5) player.crew += 1; updateHUD(); } },
    { text: 'A pod of jellyfish stings yer crew! -2 crew!', action: () => { player.crew = Math.max(0, player.crew - 2); updateHUD(); } },
    { text: 'A friendly whale splashes yer ship! -1 hull, +1 booty!', action: () => { player.hull = Math.max(0, player.hull - 1); player.booty += 1; updateHUD(); } },
    { text: 'A rival pirate steals yer spyglass! -1 booty!', action: () => { player.booty = Math.max(0, player.booty - 1); updateHUD(); } },
    { text: 'A pod of dolphins races alongside! +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A sea witch offers a riddle. No effect.', action: () => { updateHUD(); } },
    { text: 'Ye find a golden anchor! +2 booty!', action: () => { player.booty += 2; updateHUD(); } },
    { text: 'A rival pirate throws a stink bomb! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A pod of seals steals yer fish! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A friendly trader gives ye a compass! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A sudden storm! -2 hull!', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'Ye find a rare pearl! +3 booty!', action: () => { player.booty += 3; updateHUD(); } },
    { text: 'A rival pirate challenges ye to a duel! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A pod of dolphins brings a gift! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A sea witch blesses yer voyage! +2 hull!', action: () => { player.hull += 2; updateHUD(); } },
    { text: 'A rival pirate throws a net! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A pod of whales blocks yer path. Lose a turn (no effect).', action: () => { updateHUD(); } },
    { text: 'Ye find a bottle of rum! +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A rival pirate steals yer map! -1 booty!', action: () => { player.booty = Math.max(0, player.booty - 1); updateHUD(); } },
    { text: 'A pod of dolphins brings luck! +1 hull!', action: () => { player.hull += 1; updateHUD(); } },
    { text: 'A sudden calm—no effect.', action: () => { updateHUD(); } },
    { text: 'Ye find a bottle of grog! +1 crew!', action: () => { player.crew += 1; updateHUD(); } },
    { text: 'A rival pirate throws a stink bomb! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A pod of seals steals yer fish! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A friendly trader gives ye a compass! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A sudden storm! -2 hull!', action: () => { player.hull = Math.max(0, player.hull - 2); updateHUD(); } },
    { text: 'Ye find a rare pearl! +3 booty!', action: () => { player.booty += 3; updateHUD(); } },
    { text: 'A rival pirate challenges ye to a duel! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
    { text: 'A pod of dolphins brings a gift! +1 booty!', action: () => { player.booty += 1; updateHUD(); } },
    { text: 'A sea witch blesses yer voyage! +2 hull!', action: () => { player.hull += 2; updateHUD(); } },
    { text: 'A rival pirate throws a net! -1 crew!', action: () => { player.crew = Math.max(0, player.crew - 1); updateHUD(); } },
  ];
  const idx = Math.floor(Math.random() * interactions.length);
  const chosen = interactions[idx];
  chosen.action();
  updateInteractionLog(chosen.text);
}

// --- Multiplayer ---
async function fetchPlayers() {
  let { data, error } = await sb.from('pirates').select('*');
  if (data) {
    allPlayers = data;
    drawOcean();
    drawPlayers();
    setZoom();
  }
}

// --- Zoom ---
function zoomIn() {
  zoom = Math.min(zoom * 2, 32);
  setZoom();
}
function zoomOut() {
  zoom = Math.max(zoom / 2, 1);
  setZoom();
}
function setZoom() {
  canvas.style.width = (OCEAN_WIDTH * zoom) + 'px';
  canvas.style.height = (OCEAN_HEIGHT * zoom) + 'px';
  centerOnPlayer();
  updateHUD();
}

function centerOnPlayer() {
  if (!player) return;
  // Center the canvas on the player's pixel
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;
  const px = player.x * zoom;
  const py = player.y * zoom;
  panX = viewW / 2 - px - zoom / 2;
  panY = viewH / 2 - py - zoom / 2;
  canvas.style.transform = `translate(${panX}px, ${panY}px) scale(1)`;
}

// --- On Load ---
window.onload = () => {
  // Only set zoom if player is initialized
  if (player) setZoom();
};
