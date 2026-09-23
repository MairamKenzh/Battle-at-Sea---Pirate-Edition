/* ==========================================================================
   BATTLE AT SEA — Pirate Edition — script.js
   All game logic, sound, music and effects live here.
   ========================================================================== */

// ================= GAME STATE =================
const BOARD_SIZE = 10;
const FLEET = [
  { name: "Carrier",    size: 5 },
  { name: "Battleship", size: 4 },
  { name: "Cruiser",    size: 3 },
  { name: "Submarine",  size: 3 },
  { name: "Destroyer",  size: 2 }
];

let state = {
  playerGrid: [],
  enemyGrid: [],
  playerShips: [],
  enemyShips: [],
  playerTurn: true,
  gameOver: false,
  enemyMovesTried: new Set(),
  soundOn: true,
  musicOn: true,
  playerHitCount: 0,
  enemyHitCount: 0
};

const playerBoardEl = document.getElementById("player-board");
const enemyBoardEl = document.getElementById("enemy-board");
const playerFrameEl = document.getElementById("player-frame");
const enemyFrameEl = document.getElementById("enemy-frame");
const turnStatusEl = document.getElementById("turn-status");
const playerHitsEl = document.getElementById("player-hits");
const enemyHitsEl = document.getElementById("enemy-hits");
const yourFleetListEl = document.getElementById("your-fleet-list");
const enemyFleetListEl = document.getElementById("enemy-fleet-list");
const newGameBtn = document.getElementById("new-game-btn");
const soundToggleBtn = document.getElementById("sound-toggle-btn");
const musicToggleBtn = document.getElementById("music-toggle-btn");
const homeBtn = document.getElementById("home-btn");
const helpBtn = document.getElementById("help-btn");
const instructionsOverlay = document.getElementById("instructions-overlay");
const instructionsCloseBtn = document.getElementById("instructions-close-btn");
const modalOverlay = document.getElementById("modal-overlay");
const modalTitle = document.getElementById("modal-title");
const modalMessage = document.getElementById("modal-message");
const modalIcon = document.getElementById("modal-icon");
const modalBtn = document.getElementById("modal-btn");
const fxLayer = document.getElementById("fx-layer");

// ================= BOARD CREATION =================
function createEmptyGrid() {
  const grid = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    const row = [];
    for (let c = 0; c < BOARD_SIZE; c++) row.push({ ship: null, hit: false, miss: false });
    grid.push(row);
  }
  return grid;
}

function renderBoard(containerEl, grid, isEnemy) {
  containerEl.innerHTML = "";
  containerEl.classList.toggle("enemy-board", isEnemy);

  const corner = document.createElement("div");
  containerEl.appendChild(corner);

  const colLetters = "ABCDEFGHIJ";
  for (let c = 0; c < BOARD_SIZE; c++) {
    const label = document.createElement("div");
    label.className = "coord-label";
    label.textContent = colLetters[c];
    containerEl.appendChild(label);
  }

  for (let r = 0; r < BOARD_SIZE; r++) {
    const rowLabel = document.createElement("div");
    rowLabel.className = "coord-label";
    rowLabel.textContent = (r + 1).toString();
    containerEl.appendChild(rowLabel);

    for (let c = 0; c < BOARD_SIZE; c++) {
      const cellData = grid[r][c];
      const cellEl = document.createElement("div");
      cellEl.className = "cell";
      cellEl.dataset.row = r;
      cellEl.dataset.col = c;
      cellEl.setAttribute("role", "gridcell");
      cellEl.setAttribute("tabindex", isEnemy ? "0" : "-1");
      cellEl.setAttribute("aria-label", `${colLetters[c]}${r + 1}`);

      if (!isEnemy) {
        cellEl.classList.add("player-cell");
        if (cellData.ship) cellEl.classList.add("ship");
      }
      if (cellData.hit) cellEl.classList.add("hit");
      if (cellData.miss) cellEl.classList.add("miss");
      if (cellData.hit && cellData.ship && cellData.ship.sunk) cellEl.classList.add("sunk");

      if (isEnemy) {
        cellEl.addEventListener("click", () => handlePlayerAttack(r, c));
        cellEl.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handlePlayerAttack(r, c); }
        });
      }
      containerEl.appendChild(cellEl);
    }
  }
}

// ================= SHIP PLACEMENT =================
function canPlaceShip(grid, row, col, size, horizontal) {
  for (let i = 0; i < size; i++) {
    const r = horizontal ? row : row + i;
    const c = horizontal ? col + i : col;
    if (r < 0 || r >= BOARD_SIZE || c < 0 || c >= BOARD_SIZE) return false;
    if (grid[r][c].ship) return false;
  }
  return true;
}

function placeShip(grid, shipsArray, name, size) {
  let placed = false, attempts = 0;
  while (!placed && attempts < 500) {
    attempts++;
    const horizontal = Math.random() < 0.5;
    const row = Math.floor(Math.random() * BOARD_SIZE);
    const col = Math.floor(Math.random() * BOARD_SIZE);
    if (canPlaceShip(grid, row, col, size, horizontal)) {
      const shipObj = { name, size, cells: [], hits: 0, sunk: false };
      for (let i = 0; i < size; i++) {
        const r = horizontal ? row : row + i;
        const c = horizontal ? col + i : col;
        grid[r][c].ship = shipObj;
        shipObj.cells.push({ r, c });
      }
      shipsArray.push(shipObj);
      placed = true;
    }
  }
}

function placeFleet(grid, shipsArray) {
  FLEET.forEach(s => placeShip(grid, shipsArray, s.name, s.size));
}


function handlePlayerAttack(r, c) {
  if (state.gameOver || !state.playerTurn) return;
  const cell = state.enemyGrid[r][c];
  if (cell.hit || cell.miss) return;

  state.playerTurn = false;
  const cellEl = enemyBoardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);

  if (cell.ship) {
    cell.hit = true;
    cell.ship.hits++;
    state.playerHitCount++;
    updateScore();
    cellEl.classList.add("hit");
    playSound("hit");
    spawnExplosion(cellEl);
    shakeBoard(enemyFrameEl);

    if (cell.ship.hits >= cell.ship.size) {
      cell.ship.sunk = true;
      markShipSunk(state.enemyGrid, cell.ship, enemyBoardEl);
      playSound("sunk");
      showSunkBanner(false);
      updateFleetLists();
    }

    if (checkVictory(state.enemyShips)) { endGame(true); return; }
    state.playerTurn = true;
    setStatus("Direct hit! Fire again, Captain.");
  } else {
    cell.miss = true;
    cellEl.classList.add("miss");
    playSound("miss");
    setStatus("Splash! The enemy takes aim...");
    window.setTimeout(computerTurn, 900);
  }
}


function computerTurn() {
  if (state.gameOver) return;

  let r, c, key;
  do {
    r = Math.floor(Math.random() * BOARD_SIZE);
    c = Math.floor(Math.random() * BOARD_SIZE);
    key = `${r},${c}`;
  } while (state.enemyMovesTried.has(key));
  state.enemyMovesTried.add(key);

  const cell = state.playerGrid[r][c];
  const cellEl = playerBoardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);

  if (cell.ship) {
    cell.hit = true;
    cell.ship.hits++;
    state.enemyHitCount++;
    updateScore();
    cellEl.classList.add("hit");
    playSound("hit");
    spawnExplosion(cellEl);
    shakeBoard(playerFrameEl);

    if (cell.ship.hits >= cell.ship.size) {
      cell.ship.sunk = true;
      markShipSunk(state.playerGrid, cell.ship, playerBoardEl);
      playSound("sunk");
      showSunkBanner(true);
      updateFleetLists();
    }

    if (checkVictory(state.playerShips)) { endGame(false); return; }
    setStatus("The enemy strikes again...");
    window.setTimeout(computerTurn, 900);
  } else {
    cell.miss = true;
    cellEl.classList.add("miss");
    playSound("miss");
    state.playerTurn = true;
    setStatus("Your turn");
  }
}

// ================= HIT / MISS helpers =================
function markShipSunk(grid, ship, boardEl) {
  ship.cells.forEach(({ r, c }) => {
    const cellEl = boardEl.querySelector(`.cell[data-row="${r}"][data-col="${c}"]`);
    if (cellEl) cellEl.classList.add("sunk");
  });
}

function checkVictory(shipsArray) { return shipsArray.every(s => s.sunk); }

function shakeBoard(frameEl) {
  frameEl.classList.remove("shake");
  void frameEl.offsetWidth; // restart animation
  frameEl.classList.add("shake");
}

// ================= EXPLOSION ANIMATION =================
function spawnExplosion(cellEl) {
  const explosion = document.createElement("div");
  explosion.className = "explosion";

  const shockwave = document.createElement("div");
  shockwave.className = "shockwave";
  explosion.appendChild(shockwave);

  const smoke = document.createElement("div");
  smoke.className = "smoke";
  explosion.appendChild(smoke);

  const sparkCount = 9;
  for (let i = 0; i < sparkCount; i++) {
    const spark = document.createElement("div");
    spark.className = "spark";
    const angle = (Math.PI * 2 * i) / sparkCount + Math.random() * 0.4;
    const distance = 18 + Math.random() * 12;
    spark.style.setProperty("--dx", `${Math.cos(angle) * distance}px`);
    spark.style.setProperty("--dy", `${Math.sin(angle) * distance}px`);
    explosion.appendChild(spark);
  }

  cellEl.appendChild(explosion);
  window.setTimeout(() => explosion.remove(), 1200);
}

function showSunkBanner(isPlayerFleet) {
  const banner = document.createElement("div");
  banner.className = "sunk-banner";
  banner.textContent = isPlayerFleet ? "☠ YOUR SHIP HAS SUNK!" : "☠ ENEMY SHIP SUNK!";
  document.body.appendChild(banner);
  window.setTimeout(() => banner.remove(), 1700);
}

// ================= WIN / LOSE VISUAL EFFECTS =================
function spawnCoinRain() {
  for (let i = 0; i < 40; i++) {
    window.setTimeout(() => {
      const coin = document.createElement("div");
      coin.className = "coin";
      coin.style.left = `${Math.random() * 100}vw`;
      coin.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      fxLayer.appendChild(coin);
      window.setTimeout(() => coin.remove(), 3200);
    }, i * 60);
  }
}

function spawnStormRain() {
  for (let i = 0; i < 60; i++) {
    window.setTimeout(() => {
      const drop = document.createElement("div");
      drop.className = "rain-drop";
      drop.style.left = `${Math.random() * 100}vw`;
      drop.style.animationDuration = `${0.5 + Math.random() * 0.4}s`;
      fxLayer.appendChild(drop);
      window.setTimeout(() => drop.remove(), 1200);
    }, i * 40);
  }
}

// ================= SOUND EFFECTS (Web Audio API) =================
let audioCtx = null;
function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}

function playSound(type) {
  if (!state.soundOn) return;
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume();
  const now = ctx.currentTime;

  if (type === "hit") {
    // cannon boom: low thump + short crack
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "square";
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(45, now + 0.3);
    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.35);

    const crack = ctx.createOscillator();
    const crackGain = ctx.createGain();
    crack.type = "sawtooth";
    crack.frequency.setValueAtTime(900, now);
    crack.frequency.exponentialRampToValueAtTime(200, now + 0.08);
    crackGain.gain.setValueAtTime(0.1, now);
    crackGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    crack.connect(crackGain).connect(ctx.destination);
    crack.start(now); crack.stop(now + 0.1);
  } else if (type === "miss") {
    const bufferSize = ctx.sampleRate * 0.3;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.12, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    noise.connect(filter).connect(gain).connect(ctx.destination);
    noise.start(now);
  } else if (type === "sunk") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(100, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.6);
    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.7);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.7);
  } else if (type === "win") {
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      const start = now + i * 0.13;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.22, start + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.32);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.34);
    });
  } else if (type === "lose") {
    const notes = [392, 330, 277, 220];
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.value = freq;
      const start = now + i * 0.28;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.18, start + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.45);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start); osc.stop(start + 0.47);
    });
  } else if (type === "click") {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 700;
    gain.gain.setValueAtTime(0.08, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now); osc.stop(now + 0.08);
  }
}

// ================= BACKGROUND MUSIC (procedural ambient loop) =================
let musicNodes = null;
let musicTimer = null;

function startMusic() {
  if (musicNodes) return;
  const ctx = getAudioCtx();
  if (ctx.state === "suspended") ctx.resume();

  const masterGain = ctx.createGain();
  masterGain.gain.value = 0.06;
  masterGain.connect(ctx.destination);

  // low ocean drone with slow tremolo
  const drone = ctx.createOscillator();
  drone.type = "sine";
  drone.frequency.value = 82;
  const droneGain = ctx.createGain();
  droneGain.gain.value = 0.5;
  const lfo = ctx.createOscillator();
  lfo.type = "sine";
  lfo.frequency.value = 0.12;
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.25;
  lfo.connect(lfoGain).connect(droneGain.gain);
  drone.connect(droneGain).connect(masterGain);
  lfo.start(); drone.start();

  musicNodes = { masterGain, drone, lfo };

  // periodic distant bell for pirate atmosphere
  function playBell() {
    if (!musicNodes) return;
    const t = ctx.currentTime;
    const bell = ctx.createOscillator();
    const bellGain = ctx.createGain();
    bell.type = "triangle";
    bell.frequency.value = 440;
    bellGain.gain.setValueAtTime(0.0001, t);
    bellGain.gain.linearRampToValueAtTime(0.12, t + 0.05);
    bellGain.gain.exponentialRampToValueAtTime(0.0001, t + 2.2);
    bell.connect(bellGain).connect(masterGain);
    bell.start(t); bell.stop(t + 2.3);
    musicTimer = window.setTimeout(playBell, 4500 + Math.random() * 3000);
  }
  musicTimer = window.setTimeout(playBell, 2000);
}

function stopMusic() {
  if (musicTimer) { clearTimeout(musicTimer); musicTimer = null; }
  if (musicNodes) {
    try { musicNodes.drone.stop(); musicNodes.lfo.stop(); } catch (e) {}
    musicNodes = null;
  }
}

// ================= GAME OVER =================
function endGame(playerWon) {
  state.gameOver = true;
  state.playerTurn = false;
  fxLayer.innerHTML = "";
  if (playerWon) {
    playSound("win");
    modalIcon.textContent = "🏆";
    modalTitle.textContent = "VICTORY!";
    modalMessage.textContent = "The enemy fleet rests at the bottom of the sea. The waters are yours, Captain!";
    modalBtn.textContent = "SAIL AGAIN";
    setStatus("Victory!");
    modalOverlay.classList.remove("storm");
    spawnCoinRain();
  } else {
    playSound("lose");
    modalIcon.textContent = "☠";
    modalTitle.textContent = "DEFEAT";
    modalMessage.textContent = "Your fleet has gone under. The Kraken claims these waters tonight.";
    modalBtn.textContent = "TRY AGAIN";
    setStatus("Defeat.");
    spawnStormRain();
  }
  window.setTimeout(() => {
    modalOverlay.classList.add("show");
    if (!playerWon) modalOverlay.classList.add("storm");
  }, 400);
}

// ================= UI UPDATES =================
function setStatus(text) { turnStatusEl.textContent = text; }

function updateScore() {
  playerHitsEl.textContent = state.playerHitCount;
  enemyHitsEl.textContent = state.enemyHitCount;
}

function buildFleetList(listEl, ships) {
  listEl.innerHTML = "";
  ships.forEach(ship => {
    const li = document.createElement("li");
    if (ship.sunk) li.classList.add("sunk");
    const check = document.createElement("span");
    check.className = "check";
    check.textContent = ship.sunk ? "✗" : "⚓";
    li.appendChild(check);
    const label = document.createElement("span");
    label.textContent = `${ship.name} (${ship.size})`;
    li.appendChild(label);
    listEl.appendChild(li);
  });
}

function updateFleetLists() {
  buildFleetList(yourFleetListEl, state.playerShips);
  buildFleetList(enemyFleetListEl, state.enemyShips);
}

// ================= RESTART =================
function startNewGame() {
  state.playerGrid = createEmptyGrid();
  state.enemyGrid = createEmptyGrid();
  state.playerShips = [];
  state.enemyShips = [];
  state.playerTurn = true;
  state.gameOver = false;
  state.enemyMovesTried = new Set();
  state.playerHitCount = 0;
  state.enemyHitCount = 0;

  placeFleet(state.playerGrid, state.playerShips);
  placeFleet(state.enemyGrid, state.enemyShips);

  renderBoard(playerBoardEl, state.playerGrid, false);
  renderBoard(enemyBoardEl, state.enemyGrid, true);

  updateScore();
  updateFleetLists();
  setStatus("Your turn");

  fxLayer.innerHTML = "";
  modalOverlay.classList.remove("show", "storm");
}

// ================= EVENT LISTENERS =================
newGameBtn.addEventListener("click", () => { playSound("click"); startNewGame(); });
modalBtn.addEventListener("click", () => { playSound("click"); startNewGame(); });

homeBtn.addEventListener("click", () => { playSound("click"); startNewGame(); });

helpBtn.addEventListener("click", () => { playSound("click"); instructionsOverlay.classList.add("show"); });
instructionsCloseBtn.addEventListener("click", () => { playSound("click"); instructionsOverlay.classList.remove("show"); });
instructionsOverlay.addEventListener("click", (e) => {
  if (e.target === instructionsOverlay) instructionsOverlay.classList.remove("show");
});

soundToggleBtn.addEventListener("click", () => {
  state.soundOn = !state.soundOn;
  soundToggleBtn.textContent = state.soundOn ? "🔊 SFX ON" : "🔇 SFX OFF";
  soundToggleBtn.setAttribute("aria-pressed", state.soundOn ? "true" : "false");
  if (state.soundOn) playSound("click");
});

musicToggleBtn.addEventListener("click", () => {
  state.musicOn = !state.musicOn;
  musicToggleBtn.textContent = state.musicOn ? "🎵 MUSIC ON" : "🎵 MUSIC OFF";
  musicToggleBtn.setAttribute("aria-pressed", state.musicOn ? "true" : "false");
  if (state.musicOn) startMusic(); else stopMusic();
});

// unlock audio + start music on first user interaction (browser autoplay policy)
document.body.addEventListener("click", function unlockAudio() {
  getAudioCtx();
  if (state.musicOn) startMusic();
  document.body.removeEventListener("click", unlockAudio);
}, { once: true });

// show instructions automatically on first visit
window.setTimeout(() => instructionsOverlay.classList.add("show"), 500);

// ================= INIT =================
startNewGame();
