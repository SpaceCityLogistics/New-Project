// Page-level starfield background (matches astrotechsolutions.com)
(function () {
  const field = document.getElementById("starfield");
  if (!field) return;

  const starCount = 90;
  for (let i = 0; i < starCount; i++) {
    const s = document.createElement("div");
    const isGreen = Math.random() < 0.15;
    const isBig = Math.random() < 0.2;
    s.className = "star" + (isGreen ? " green" : "") + (isBig ? " big" : "");
    const size = isBig ? Math.random() * 2 + 2.8 : Math.random() * 2 + 1.4;
    s.style.width = size + "px";
    s.style.height = size + "px";
    s.style.top = Math.random() * 100 + "%";
    s.style.left = Math.random() * 100 + "%";
    s.style.setProperty("--min-o", (Math.random() * 0.2 + 0.35).toFixed(2));
    s.style.setProperty("--max-o", (Math.random() * 0.2 + 0.8).toFixed(2));
    s.style.animationDuration = Math.random() * 3 + 2 + "s";
    s.style.animationDelay = Math.random() * 4 + "s";
    field.appendChild(s);
  }

  const moon = document.createElement("div");
  moon.className = "moon";
  moon.style.width = "110px";
  moon.style.height = "110px";
  moon.style.top = "6%";
  moon.style.left = "88%";
  moon.appendChild(document.createElement("div")).className = "moon-ring";
  field.appendChild(moon);

  const smallMoon = document.createElement("div");
  smallMoon.className = "moon";
  smallMoon.style.width = "46px";
  smallMoon.style.height = "46px";
  smallMoon.style.top = "62%";
  smallMoon.style.left = "3%";
  smallMoon.appendChild(document.createElement("div")).className = "moon-ring";
  field.appendChild(smallMoon);

  const meteorCount = 6;
  for (let i = 0; i < meteorCount; i++) {
    const m = document.createElement("div");
    const variant = Math.random();
    m.className = "meteor" + (variant < 0.3 ? " big" : variant > 0.7 ? " thin" : "");
    m.style.top = Math.random() * 70 - 20 + "%";
    m.style.left = Math.random() * 90 - 20 + "%";
    m.style.animationDuration = 1.6 + Math.random() * 1.8 + "s";
    m.style.animationDelay = Math.random() * 7 + "s";
    field.appendChild(m);
  }
})();

let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    audioCtx = new AC();
  }
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}

function playShootSound() {
  const ac = ensureAudio();
  if (!ac) return;
  const t = ac.currentTime;
  const osc = ac.createOscillator();
  const gain = ac.createGain();
  osc.type = "square";
  osc.frequency.setValueAtTime(880, t);
  osc.frequency.exponentialRampToValueAtTime(180, t + 0.09);
  gain.gain.setValueAtTime(0.14, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
  osc.connect(gain);
  gain.connect(ac.destination);
  osc.start(t);
  osc.stop(t + 0.12);
}

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const W = canvas.width;
const H = canvas.height;

const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const bestEl = document.getElementById("best");
const startOverlay = document.getElementById("startOverlay");
const gameOverOverlay = document.getElementById("gameOverOverlay");
const finalScoreEl = document.getElementById("finalScore");
const startBtn = document.getElementById("startBtn");
const restartBtn = document.getElementById("restartBtn");
const fireBtn = document.getElementById("fireBtn");
const shopOverlay = document.getElementById("shopOverlay");
const shopGrid = document.getElementById("shopGrid");
const shopCoinsEl = document.getElementById("shopCoins");
const shopSkipBtn = document.getElementById("shopSkipBtn");
const victoryOverlay = document.getElementById("victoryOverlay");
const victoryScoreEl = document.getElementById("victoryScore");
const victoryRestartBtn = document.getElementById("victoryRestartBtn");
const legendCanvas = document.getElementById("legendCanvas");
const legendCtx = legendCanvas ? legendCanvas.getContext("2d") : null;

const VIRUS_W = 26;
const VIRUS_H = 26;
const GAP_X = 38;
const GAP_Y = 32;
const FORMATION_TOP = 46;
const CENTER_X = W / 2;
const PLAYER_MIN_Y = H * 0.5;
const PLAYER_MAX_Y = H - 20;

const VIRUS_COLORS = ["#ff1a4d", "#ff9100", "#f4ff1a", "#c724ff", "#00e5ff"];
const FORMATION_PATTERNS = ["grid", "vshape", "diamond", "zigzag", "arc"];
const BOSS_INTERVAL = 3;
const BOSS_FORMS = ["orb", "hex", "crystal", "twin"];
const MAX_WEAPON = 3;
const MAX_ABILITIES = 3;
const MAX_WAVE = 50;
const BONUS_DURATION = 8;

// Rarer power-ups have lower weight (drop chance) and cost more in the shop,
// so holding onto a good one in a 3-slot inventory actually matters.
const POWERUP_DEFS = {
  weapon: { rarity: "common", weight: 18, color: "#39ff6a", label: "Weapon Boost", desc: "Widen your bullet spread", shopPrice: 35 },
  shield: { rarity: "common", weight: 16, color: "#39c9ff", label: "Shield Charge", desc: "Blocks the next hit you take", shopPrice: 35 },
  rapid: { rarity: "common", weight: 16, color: "#ffd23f", label: "Rapid Fire", desc: "Faster trigger, same power", shopPrice: 30 },
  life: { rarity: "common", weight: 12, color: "#ff5566", label: "Extra Life", desc: "+1 life", shopPrice: 60 },
  magnet: { rarity: "common", weight: 14, color: "#ff9ff3", label: "Tractor Beam", desc: "Pulls in nearby pickups", shopPrice: 30 },
  overclock: { rarity: "uncommon", weight: 10, color: "#ff8c3c", label: "Overclock", desc: "Boosts your engine speed", shopPrice: 50 },
  pierce: { rarity: "uncommon", weight: 9, color: "#b967ff", label: "Piercing Rounds", desc: "Bullets punch through enemies", shopPrice: 55 },
  homing: { rarity: "rare", weight: 6, color: "#ff6b81", label: "Auto-Aim", desc: "Shots curve toward targets", shopPrice: 80 },
  drone: { rarity: "rare", weight: 5, color: "#2de8c4", label: "Wingman Drone", desc: "A drone fires alongside you", shopPrice: 85 },
  multiplier: { rarity: "legendary", weight: 3, color: "#fff2c0", label: "Premium Support", desc: "Doubles points while held", shopPrice: 130 },
};
const POWERUP_TYPES = Object.keys(POWERUP_DEFS);

function pickWeightedPowerUpType() {
  const total = POWERUP_TYPES.reduce((sum, t) => sum + POWERUP_DEFS[t].weight, 0);
  let roll = Math.random() * total;
  for (const t of POWERUP_TYPES) {
    roll -= POWERUP_DEFS[t].weight;
    if (roll <= 0) return t;
  }
  return POWERUP_TYPES[POWERUP_TYPES.length - 1];
}
const BG_TIERS = [
  { base: "#04060a", neb: "57,255,106" },
  { base: "#05040c", neb: "57,201,255" },
  { base: "#0a0410", neb: "185,103,255" },
  { base: "#100604", neb: "255,140,60" },
  { base: "#140206", neb: "255,46,99" },
];

let player, bullets, enemyBullets, viruses, powerUps, score, best, lives;
let running, wave, formationDir, formationX, frame, lastTime, animId;
let boss = null;
let waveTotalCount = 0;
let waveBanner = "";
let waveBannerTime = 0;
let moveLeft = false;
let moveRight = false;
let moveUp = false;
let moveDown = false;
let fireHeld = false;
let fireCooldown = 0;
let stars = [];
let hitFlash = 0;
let phase = "wave";
let coins = 0;
let bonusTimer = 0;
let bonusSpawnTimer = 0;
let bonusTargets = [];
let pendingBossWave = null;
let shopOptions = [];
let shopTier = 0;

function loadBest() {
  try {
    return Number(localStorage.getItem("astrotechDefenderBest")) || 0;
  } catch {
    return 0;
  }
}
function saveBest(v) {
  try {
    localStorage.setItem("astrotechDefenderBest", String(v));
  } catch {}
}

function makeStars() {
  const list = [];
  for (let i = 0; i < 60; i++) {
    list.push({
      x: Math.random() * W,
      y: Math.random() * H,
      r: Math.random() * 1.4 + 0.4,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.2,
      green: Math.random() < 0.25,
    });
  }
  return list;
}

function formationRows(waveNum) {
  return Math.min(5, 3 + Math.floor((waveNum - 1) / 2));
}

function buildFormation(waveNum) {
  const rows = formationRows(waveNum);
  const cols = 6;
  const pattern = FORMATION_PATTERNS[(waveNum - 1) % FORMATION_PATTERNS.length];
  const list = [];

  const pushEnemy = (row, x, y) => {
    const idx = row % VIRUS_COLORS.length;
    list.push({
      baseX: x,
      baseY: y,
      x,
      y,
      alive: true,
      diving: false,
      diveT: 0,
      diveStartX: 0,
      diveStartY: 0,
      diveTargetX: 0,
      color: VIRUS_COLORS[idx],
      shapeIndex: idx,
      points: (rows - row) * 10,
    });
  };

  if (pattern === "grid") {
    const left = CENTER_X - ((cols - 1) * GAP_X) / 2;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        pushEnemy(r, left + c * GAP_X, FORMATION_TOP + r * GAP_Y);
      }
    }
  } else if (pattern === "vshape") {
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const off = c - (cols - 1) / 2;
        pushEnemy(r, CENTER_X + off * GAP_X, FORMATION_TOP + r * GAP_Y + Math.abs(off) * 9);
      }
    }
  } else if (pattern === "diamond") {
    for (let r = 0; r < rows; r++) {
      const rowFromCenter = Math.abs(r - (rows - 1) / 2);
      const count = Math.max(2, cols - Math.round(rowFromCenter * 2));
      for (let c = 0; c < count; c++) {
        const off = c - (count - 1) / 2;
        pushEnemy(r, CENTER_X + off * GAP_X, FORMATION_TOP + r * GAP_Y);
      }
    }
  } else if (pattern === "zigzag") {
    const left = CENTER_X - ((cols - 1) * GAP_X) / 2;
    for (let r = 0; r < rows; r++) {
      const rowOffset = r % 2 === 0 ? 0 : GAP_X / 2;
      for (let c = 0; c < cols; c++) {
        pushEnemy(r, left + c * GAP_X + rowOffset, FORMATION_TOP + r * GAP_Y);
      }
    }
  } else if (pattern === "arc") {
    const radiusX = 110;
    const radiusY = 46;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const t = cols === 1 ? 0.5 : c / (cols - 1);
        const angle = Math.PI * (0.15 + t * 0.7);
        const x = CENTER_X - Math.cos(angle) * radiusX;
        const y = FORMATION_TOP + r * GAP_Y + Math.sin(angle) * radiusY;
        pushEnemy(r, x, y);
      }
    }
  }

  return list;
}

function makeBoss(waveNum) {
  if (waveNum === MAX_WAVE) {
    const hp = 900;
    return {
      x: CENTER_X,
      y: 70,
      w: 108,
      h: 78,
      hp,
      maxHp: hp,
      dir: 1,
      speed: 62,
      shotTimer: 1,
      form: "final",
    };
  }
  const hp = 18 + waveNum * 6;
  const bossIndex = Math.round(waveNum / BOSS_INTERVAL) - 1;
  return {
    x: CENTER_X,
    y: 70,
    w: 74,
    h: 54,
    hp,
    maxHp: hp,
    dir: 1,
    speed: 40 + waveNum * 2,
    shotTimer: 1,
    form: BOSS_FORMS[bossIndex % BOSS_FORMS.length],
  };
}

function spawnWave(waveNum) {
  if (waveNum === MAX_WAVE || waveNum % BOSS_INTERVAL === 0) {
    viruses = [];
    waveTotalCount = 0;
    boss = null;
    startBonusRound(waveNum);
    return;
  }
  boss = null;
  viruses = buildFormation(waveNum);
  waveTotalCount = viruses.length;
  formationDir = 1;
  formationX = 0;
  phase = "wave";
  waveBanner = "LEVEL " + waveNum;
  waveBannerTime = 1.8;
}

const BONUS_TARGET_SPEED = [220, 320];

function startBonusRound(waveNum) {
  phase = "bonus";
  pendingBossWave = waveNum;
  bonusTimer = BONUS_DURATION;
  bonusSpawnTimer = 0;
  bonusTargets = [];
  // Clear anything left over from the wave that just ended so nothing
  // frozen or invisible-but-solid lingers through the bonus round.
  enemyBullets = [];
  powerUps = [];
  for (let i = 0; i < 6; i++) spawnBonusTarget();
  waveBanner = "BONUS ROUND";
  waveBannerTime = 1.8;
}

function spawnBonusTarget() {
  const speed = BONUS_TARGET_SPEED[0] + Math.random() * (BONUS_TARGET_SPEED[1] - BONUS_TARGET_SPEED[0]);
  const edge = Math.floor(Math.random() * 3);
  let x, y, vx, vy;
  if (edge === 0) {
    x = -20;
    y = 20 + Math.random() * (H * 0.45);
    vx = speed;
    vy = (Math.random() - 0.5) * 90;
  } else if (edge === 1) {
    x = W + 20;
    y = 20 + Math.random() * (H * 0.45);
    vx = -speed;
    vy = (Math.random() - 0.5) * 90;
  } else {
    x = 20 + Math.random() * (W - 40);
    y = -20;
    vx = (Math.random() - 0.5) * 120;
    vy = speed * 0.8;
  }
  bonusTargets.push({ x, y, vx, vy, r: 9, alive: true, value: 5 * (1 + Math.floor(Math.random() * 3)) });
}

function shopRarityWeight(rarity, tier) {
  const base = { common: 30, uncommon: 18, rare: 8, legendary: 3 };
  const growth = { common: -1.6, uncommon: 0.6, rare: 1.6, legendary: 1.1 };
  return Math.max(1, base[rarity] + growth[rarity] * tier);
}

function buildShopOptions() {
  const tier = Math.min(shopTier, 12);
  const priceMult = 1 + Math.min(shopTier, 9) * 0.22;
  const pool = POWERUP_TYPES.map((t) => ({ type: t, ...POWERUP_DEFS[t] }));
  const picks = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const weights = pool.map((p) => shopRarityWeight(p.rarity, tier));
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      roll -= weights[idx];
      if (roll <= 0) break;
    }
    const item = pool.splice(idx, 1)[0];
    picks.push({
      type: item.type,
      label: item.label,
      desc: item.desc,
      rarity: item.rarity,
      price: Math.round(item.shopPrice * priceMult),
    });
  }
  shopTier += 1;
  return picks;
}

function endBonusRound() {
  bonusTargets = [];
  shopOptions = buildShopOptions();
  phase = "shop";
  showShopOverlay();
}

function showShopOverlay() {
  shopCoinsEl.textContent = "Coins: " + coins;
  shopGrid.innerHTML = "";
  shopOptions.forEach((opt) => {
    const card = document.createElement("button");
    card.type = "button";
    card.className = "shopCard";
    card.disabled = coins < opt.price;
    card.classList.add("rarity-" + opt.rarity);
    card.innerHTML =
      '<span class="shopCardRarity">' + opt.rarity + "</span>" +
      '<span class="shopCardLabel">' + opt.label + "</span>" +
      '<span class="shopCardDesc">' + opt.desc + "</span>" +
      '<span class="shopCardPrice">' + opt.price + " coins</span>";
    card.addEventListener("click", () => buyShopOption(opt));
    shopGrid.appendChild(card);
  });
  shopOverlay.classList.remove("hidden");
}

function buyShopOption(opt) {
  if (coins < opt.price) return;
  coins -= opt.price;
  if (opt.type === "life") {
    lives = Math.min(5, lives + 1);
    livesEl.textContent = lives;
  } else {
    player.abilities.push(opt.type);
    if (player.abilities.length > MAX_ABILITIES) player.abilities.shift();
  }
  closeShopAndStartBoss();
}

function skipShop() {
  closeShopAndStartBoss();
}

function closeShopAndStartBoss() {
  shopOverlay.classList.add("hidden");
  const waveNum = pendingBossWave;
  pendingBossWave = null;
  boss = makeBoss(waveNum);
  formationDir = 1;
  formationX = 0;
  waveBanner = waveNum === MAX_WAVE ? "FINAL BOSS" : "BOSS INCOMING";
  waveBannerTime = 1.8;
  phase = "wave";
}

function freshPlayer() {
  return {
    x: W / 2,
    y: PLAYER_MAX_Y,
    w: 28,
    h: 22,
    speed: 220,
    abilities: [],
    invuln: 0,
  };
}

function resetGame() {
  player = freshPlayer();
  bullets = [];
  enemyBullets = [];
  powerUps = [];
  bonusTargets = [];
  bonusSpawnTimer = 0;
  shopTier = 0;
  score = 0;
  coins = 0;
  lives = 3;
  wave = 1;
  phase = "wave";
  pendingBossWave = null;
  frame = 0;
  spawnWave(wave);
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  draw();
}

function endGame() {
  running = false;
  cancelAnimationFrame(animId);
  if (score > best) {
    best = score;
    saveBest(best);
    bestEl.textContent = best;
  }
  finalScoreEl.textContent = `Score: ${score} · Level ${wave}`;
  gameOverOverlay.classList.remove("hidden");
}

function winGame() {
  running = false;
  cancelAnimationFrame(animId);
  score += 5000;
  scoreEl.textContent = score;
  if (score > best) {
    best = score;
    saveBest(best);
    bestEl.textContent = best;
  }
  victoryScoreEl.textContent = `Final Score: ${score}`;
  victoryOverlay.classList.remove("hidden");
}

function startGame() {
  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
  victoryOverlay.classList.add("hidden");
  shopOverlay.classList.add("hidden");
  resetGame();
  running = true;
  lastTime = performance.now();
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

function spawnPowerUp(x, y, type) {
  const t = type || pickWeightedPowerUpType();
  powerUps.push({ x, y, vy: 70, type: t, r: 11 });
}

function getWeaponLevel(p) {
  const count = p.abilities.filter((a) => a === "weapon").length;
  return Math.min(MAX_WEAPON, 1 + count);
}

function hasAbility(p, type) {
  return p.abilities.includes(type);
}

function fire() {
  if (fireCooldown > 0) return;
  const y = player.y - player.h / 2;
  const level = getWeaponLevel(player);
  if (level === 1) {
    bullets.push({ x: player.x, y, vx: 0, vy: -440 });
  } else if (level === 2) {
    bullets.push({ x: player.x - 7, y, vx: 0, vy: -440 });
    bullets.push({ x: player.x + 7, y, vx: 0, vy: -440 });
  } else {
    bullets.push({ x: player.x, y, vx: 0, vy: -460 });
    bullets.push({ x: player.x - 8, y, vx: -70, vy: -430 });
    bullets.push({ x: player.x + 8, y, vx: 70, vy: -430 });
  }
  if (hasAbility(player, "drone")) {
    bullets.push({ x: player.x - 20, y: y + 6, vx: 0, vy: -420, drone: true });
  }
  playShootSound();
  fireCooldown = hasAbility(player, "rapid") ? 0.09 : 0.22;
}

function loop(now) {
  if (!running) return;
  const dt = Math.min((now - lastTime) / 1000, 0.05);
  lastTime = now;
  frame++;
  update(dt);
  draw();
  animId = requestAnimationFrame(loop);
}

function update(dt) {
  const speedMult = hasAbility(player, "overclock") ? 1.4 : 1;
  if (moveLeft) player.x -= player.speed * speedMult * dt;
  if (moveRight) player.x += player.speed * speedMult * dt;
  if (moveUp) player.y -= player.speed * speedMult * dt;
  if (moveDown) player.y += player.speed * speedMult * dt;
  player.x = Math.max(player.w, Math.min(W - player.w, player.x));
  player.y = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_MAX_Y, player.y));

  fireCooldown -= dt;
  if (fireHeld && phase !== "shop") fire();

  if (player.invuln > 0) player.invuln -= dt;
  if (hitFlash > 0) hitFlash -= dt;
  if (waveBannerTime > 0) waveBannerTime -= dt;

  stars.forEach((s) => {
    s.y += s.speed;
    if (s.y > H) s.y = 0;
  });

  const homing = hasAbility(player, "homing");
  bullets.forEach((b) => {
    if (homing && !b.dead) {
      let target = boss;
      if (!target) {
        let bestD = Infinity;
        viruses.forEach((a) => {
          if (!a.alive) return;
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < bestD) {
            bestD = d;
            target = a;
          }
        });
      }
      if (target) {
        const dx = target.x - b.x;
        b.vx = Math.max(-260, Math.min(260, (b.vx || 0) + Math.sign(dx) * Math.min(Math.abs(dx) * 4, 260) * dt));
      }
    }
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
  });
  bullets = bullets.filter((b) => b.y > -10 && b.x > -10 && b.x < W + 10);

  if (phase === "shop") return;

  if (phase === "bonus") {
    updateBonusRound(dt);
    return;
  }

  const diveChance = Math.min(0.0004 + wave * 0.00003, 0.0012);
  const shotChance = Math.min(0.02 + wave * 0.0015, 0.05);

  const alive = viruses.filter((a) => a.alive);
  const baseSpeed = Math.min(22 + wave * 2.2, 70);
  const speed = baseSpeed + (waveTotalCount - alive.length) * 1.5;
  formationX += formationDir * speed * dt;
  const edge = 26;
  if (formationX > edge || formationX < -edge) {
    formationDir *= -1;
    formationX = Math.max(-edge, Math.min(edge, formationX));
  }

  viruses.forEach((a) => {
    if (!a.alive) return;
    if (!a.diving) {
      a.x = a.baseX + formationX;
      a.y = a.baseY;
      if (Math.random() < diveChance) {
        a.diving = true;
        a.diveT = 0;
        a.diveStartX = a.x;
        a.diveStartY = a.y;
        a.diveTargetX = player.x;
      }
    } else {
      a.diveT += dt;
      const t = a.diveT;
      a.y = a.diveStartY + t * 140;
      a.x = a.diveStartX + Math.sin(t * 3) * 50 + (a.diveTargetX - a.diveStartX) * Math.min(t / 1.6, 1) * 0.3;
      if (a.y > H + 20) {
        a.diving = false;
        a.x = a.baseX + formationX;
        a.y = a.baseY;
      }
      if (rectHit(a.x, a.y, VIRUS_W, VIRUS_H, player.x, player.y, player.w, player.h)) {
        a.diving = false;
        a.x = a.baseX + formationX;
        a.y = a.baseY;
        hitPlayer();
      }
    }
  });

  if (Math.random() < shotChance) {
    const shooters = alive.filter((a) => !a.diving);
    if (shooters.length) {
      const s = shooters[Math.floor(Math.random() * shooters.length)];
      enemyBullets.push({ x: s.x, y: s.y + VIRUS_H / 2, vx: 0, vy: 180 });
    }
  }

  if (boss) updateBoss(dt);

  enemyBullets.forEach((b) => {
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
  });
  enemyBullets = enemyBullets.filter((b) => b.y < H + 10 && b.x > -20 && b.x < W + 20);

  const magnet = hasAbility(player, "magnet");
  powerUps.forEach((p) => {
    if (magnet) {
      const dx = player.x - p.x;
      const dy = player.y - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 140) {
        p.x += (dx / dist) * 90 * dt;
        p.y += (dy / dist) * 90 * dt;
        return;
      }
    }
    p.y += p.vy * dt;
  });
  powerUps = powerUps.filter((p) => p.y < H + 20);

  const pierce = hasAbility(player, "pierce");
  const scoreMult = hasAbility(player, "multiplier") ? 2 : 1;
  bullets.forEach((b) => {
    if (b.dead) return;
    if (boss) {
      if (rectHit(boss.x, boss.y, boss.w, boss.h, b.x, b.y, 6, 10)) {
        if (!pierce) b.dead = true;
        boss.hp -= 1;
      }
      return;
    }
    viruses.forEach((a) => {
      if (!a.alive || b.dead) return;
      if (rectHit(a.x, a.y, VIRUS_W, VIRUS_H, b.x, b.y, 4, 10)) {
        a.alive = false;
        if (!pierce) b.dead = true;
        score += a.points * scoreMult;
        scoreEl.textContent = score;
        if (Math.random() < 0.05) spawnPowerUp(a.x, a.y);
      }
    });
  });
  bullets = bullets.filter((b) => !b.dead);

  if (boss && boss.hp <= 0) {
    if (boss.form === "final") {
      winGame();
    } else {
      score += (500 + wave * 50) * scoreMult;
      scoreEl.textContent = score;
      enemyBullets = [];
      wave += 1;
      spawnWave(wave);
      spawnPowerUp(W / 2, -20);
    }
  }

  enemyBullets.forEach((b) => {
    if (b.dead) return;
    if (rectHit(player.x, player.y, player.w, player.h, b.x, b.y, 4, 10)) {
      b.dead = true;
      hitPlayer();
    }
  });
  enemyBullets = enemyBullets.filter((b) => !b.dead);

  powerUps.forEach((p) => {
    if (p.dead) return;
    if (rectHit(player.x, player.y, player.w, player.h, p.x, p.y, p.r * 2, p.r * 2)) {
      p.dead = true;
      applyPowerUp(p.type);
    }
  });
  powerUps = powerUps.filter((p) => !p.dead);

  if (!boss && viruses.length > 0 && viruses.every((a) => !a.alive)) {
    wave += 1;
    spawnWave(wave);
    spawnPowerUp(W / 2, -20);
  }
}

function updateBonusRound(dt) {
  bonusTimer -= dt;

  bonusSpawnTimer -= dt;
  if (bonusSpawnTimer <= 0 && bonusTimer > 0.6) {
    bonusSpawnTimer = 0.22 + Math.random() * 0.2;
    spawnBonusTarget();
  }

  const magnet = hasAbility(player, "magnet");
  bonusTargets.forEach((t) => {
    if (!t.alive) return;
    if (magnet) {
      const dx = player.x - t.x;
      const dy = player.y - t.y;
      const dist = Math.hypot(dx, dy) || 1;
      if (dist < 100) {
        t.vx += (dx / dist) * 260 * dt;
        t.vy += (dy / dist) * 260 * dt;
      }
    }
    t.x += t.vx * dt;
    t.y += t.vy * dt;
  });
  bonusTargets = bonusTargets.filter((t) => t.alive && t.x > -40 && t.x < W + 40 && t.y > -40 && t.y < H + 40);

  const scoreMult = hasAbility(player, "multiplier") ? 2 : 1;
  bullets.forEach((b) => {
    if (b.dead) return;
    bonusTargets.forEach((t) => {
      if (!t.alive || b.dead) return;
      if (rectHit(t.x, t.y, t.r * 2, t.r * 2, b.x, b.y, 4, 10)) {
        t.alive = false;
        b.dead = true;
        coins += t.value;
        score += t.value * scoreMult;
        scoreEl.textContent = score;
      }
    });
  });
  bullets = bullets.filter((b) => !b.dead);

  if (bonusTimer <= 0) {
    endBonusRound();
  }
}

function updateBoss(dt) {
  const margin = boss.w / 2 + 10;
  boss.x += boss.dir * boss.speed * dt;
  if (boss.x > W - margin || boss.x < margin) {
    boss.dir *= -1;
    boss.x = Math.max(margin, Math.min(W - margin, boss.x));
  }

  boss.shotTimer -= dt;
  if (boss.shotTimer <= 0) {
    if (boss.form === "final") {
      boss.shotTimer = 0.55;
      for (let i = -2; i <= 2; i++) {
        enemyBullets.push({ x: boss.x + i * 14, y: boss.y + boss.h / 2, vx: i * 55, vy: 190, boss: true });
      }
    } else {
      boss.shotTimer = Math.max(0.5, 1.4 - wave * 0.04);
      for (let i = -1; i <= 1; i++) {
        enemyBullets.push({ x: boss.x + i * 16, y: boss.y + boss.h / 2, vx: i * 40, vy: 170, boss: true });
      }
    }
  }

  if (rectHit(boss.x, boss.y, boss.w, boss.h, player.x, player.y, player.w, player.h)) {
    hitPlayer();
  }
}

function applyPowerUp(type) {
  if (type === "life") {
    lives = Math.min(5, lives + 1);
    livesEl.textContent = lives;
    return;
  }
  player.abilities.push(type);
  if (player.abilities.length > MAX_ABILITIES) {
    player.abilities.shift();
  }
}

function hitPlayer() {
  if (player.invuln > 0) return;
  const shieldIdx = player.abilities.indexOf("shield");
  if (shieldIdx !== -1) {
    player.abilities.splice(shieldIdx, 1);
    hitFlash = 0.3;
    player.invuln = 0.6;
    return;
  }
  lives -= 1;
  livesEl.textContent = lives;
  hitFlash = 0.3;
  player.invuln = 1.2;
  if (player.abilities.length) {
    const idx = Math.floor(Math.random() * player.abilities.length);
    player.abilities.splice(idx, 1);
  }
  if (lives <= 0) endGame();
}

function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

function drawBackground() {
  const tier = BG_TIERS[Math.min(BG_TIERS.length - 1, Math.floor((wave - 1) / 10))];
  ctx.fillStyle = tier.base;
  ctx.fillRect(0, 0, W, H);

  const neb1 = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, 220);
  neb1.addColorStop(0, `rgba(${tier.neb},0.12)`);
  neb1.addColorStop(1, "transparent");
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, W, H);

  const neb2 = ctx.createRadialGradient(W * 0.85, H * 0.6, 0, W * 0.85, H * 0.6, 260);
  neb2.addColorStop(0, `rgba(${tier.neb},0.09)`);
  neb2.addColorStop(1, "transparent");
  ctx.fillStyle = neb2;
  ctx.fillRect(0, 0, W, H);

  stars.forEach((s) => {
    const tw = 0.5 + 0.5 * Math.sin(frame * 0.05 * s.speed + s.phase);
    ctx.globalAlpha = 0.3 + tw * 0.6;
    ctx.fillStyle = s.green ? "#39ff6a" : "#d7f0dd";
    ctx.beginPath();
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  if (wave >= MAX_WAVE) {
    ctx.fillStyle = `rgba(255,20,20,${0.05 + Math.sin(frame * 0.05) * 0.02})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function drawVirusInvader(scale = 1) {
  // Space Invaders-style crab silhouette: wide flat body, legs kicked out
  // at the corners, glowing antenna tips.
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(-9, -4);
  ctx.lineTo(-9, 2);
  ctx.lineTo(-13, 2);
  ctx.lineTo(-13, 6);
  ctx.lineTo(-7, 6);
  ctx.lineTo(-7, 3);
  ctx.lineTo(7, 3);
  ctx.lineTo(7, 6);
  ctx.lineTo(13, 6);
  ctx.lineTo(13, 2);
  ctx.lineTo(9, 2);
  ctx.lineTo(9, -4);
  ctx.lineTo(4, -9);
  ctx.lineTo(-4, -9);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();

  const pulse = 1.6 + Math.sin(frame * 0.12) * 0.6;
  ctx.beginPath();
  ctx.arc(-4, -9, pulse, 0, Math.PI * 2);
  ctx.arc(4, -9, pulse, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawVirusWasp(scale = 1) {
  // Galaga-style wasp: diamond thorax with swept, flapping wings.
  ctx.save();
  ctx.scale(scale, scale);
  const flap = Math.sin(frame * 0.2) * 2;
  ctx.beginPath();
  ctx.moveTo(0, -9);
  ctx.lineTo(4, -2);
  ctx.lineTo(3, 8);
  ctx.lineTo(-3, 8);
  ctx.lineTo(-4, -2);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(-4, -1);
  ctx.lineTo(-13, -5 - flap);
  ctx.lineTo(-10, 2);
  ctx.lineTo(-3, 3);
  ctx.closePath();
  ctx.moveTo(4, -1);
  ctx.lineTo(13, -5 - flap);
  ctx.lineTo(10, 2);
  ctx.lineTo(3, 3);
  ctx.closePath();
  ctx.fill();

  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(-2, -9);
  ctx.lineTo(-3, -13);
  ctx.moveTo(2, -9);
  ctx.lineTo(3, -13);
  ctx.stroke();
  ctx.restore();
}

function drawVirusSquid(scale = 1) {
  // Classic Space Invaders squid: domed head, three trailing tentacles.
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.arc(0, -2, 8.5, Math.PI, 0, false);
  ctx.lineTo(8.5, 3);
  ctx.lineTo(-8.5, 3);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.lineWidth = 2.6;
  ctx.lineCap = "round";
  const sway = Math.sin(frame * 0.1) * 1.5;
  ctx.beginPath();
  ctx.moveTo(-6, 3);
  ctx.lineTo(-6 + sway, 9);
  ctx.moveTo(0, 3);
  ctx.lineTo(0 - sway, 11);
  ctx.moveTo(6, 3);
  ctx.lineTo(6 + sway, 9);
  ctx.stroke();
  ctx.restore();
}

function drawVirusArachnid(scale = 1) {
  // Gem-bodied crawler: faceted core with four jointed spider legs.
  ctx.save();
  ctx.scale(scale, scale);
  const twitch = Math.sin(frame * 0.18) * 1.2;
  ctx.beginPath();
  ctx.moveTo(0, -7);
  ctx.lineTo(5, 0);
  ctx.lineTo(0, 7);
  ctx.lineTo(-5, 0);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-4, -3);
  ctx.lineTo(-10, -6 + twitch);
  ctx.lineTo(-13, -3);
  ctx.moveTo(-4, 3);
  ctx.lineTo(-10, 6 - twitch);
  ctx.lineTo(-13, 3);
  ctx.moveTo(4, -3);
  ctx.lineTo(10, -6 - twitch);
  ctx.lineTo(13, -3);
  ctx.moveTo(4, 3);
  ctx.lineTo(10, 6 + twitch);
  ctx.lineTo(13, 3);
  ctx.stroke();
  ctx.restore();
}

function drawVirusBeetle(scale = 1) {
  // Circuit-shelled beetle: oval shell etched with glowing trace lines.
  ctx.save();
  ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.ellipse(0, 0, 9, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();

  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(0, -6);
  ctx.lineTo(0, 6);
  ctx.moveTo(-5, -3);
  ctx.lineTo(5, -3);
  ctx.moveTo(-5, 3);
  ctx.lineTo(5, 3);
  ctx.stroke();

  const twitch = Math.sin(frame * 0.22) * 1;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-8, -4);
  ctx.lineTo(-13, -6 + twitch);
  ctx.moveTo(-9, 0);
  ctx.lineTo(-14, 0);
  ctx.moveTo(-8, 4);
  ctx.lineTo(-13, 6 - twitch);
  ctx.moveTo(8, -4);
  ctx.lineTo(13, -6 - twitch);
  ctx.moveTo(9, 0);
  ctx.lineTo(14, 0);
  ctx.moveTo(8, 4);
  ctx.lineTo(13, 6 + twitch);
  ctx.stroke();

  ctx.lineWidth = 1.3;
  ctx.beginPath();
  ctx.moveTo(-2, -7);
  ctx.lineTo(-3, -11);
  ctx.moveTo(2, -7);
  ctx.lineTo(3, -11);
  ctx.stroke();
  ctx.restore();
}

function drawVirus(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.shadowColor = a.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = a.color;
  ctx.strokeStyle = a.color;

  const shape = a.shapeIndex % 5;
  if (shape === 0) drawVirusInvader();
  else if (shape === 1) drawVirusWasp();
  else if (shape === 2) drawVirusSquid();
  else if (shape === 3) drawVirusArachnid();
  else drawVirusBeetle();

  ctx.restore();
}

function drawBonusTargets() {
  bonusTargets.forEach((t) => {
    if (!t.alive) return;
    ctx.save();
    ctx.translate(t.x, t.y);
    ctx.shadowColor = "#ffe066";
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#ffe066";
    ctx.beginPath();
    ctx.arc(0, 0, t.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = "#3a2f06";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, t.r - 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  });
}

function drawBossOrb(b) {
  // Mothership Crab: an oversized Space Invaders crab hull with a command
  // dome and pulsing running lights along the hull.
  const color = "#ff2e63";
  const scale = (b.w - 16) / 26;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#3a0a1a";
  ctx.strokeStyle = color;
  drawVirusInvader(scale);

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(0, -scale * 11, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a0a1a";
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = color;
  const t = frame * 0.05;
  for (let i = 0; i < 5; i++) {
    const a = i / 4;
    const glow = 0.35 + 0.65 * Math.max(0, Math.sin(t + a * Math.PI * 2));
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.arc(-scale * 10 + a * scale * 20, scale * 5.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawBossHex(b) {
  // Galaga Flagship: a scaled-up wasp with glowing capture-claw wingtips.
  const color = "#b967ff";
  const scale = (b.w - 20) / 26;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#1a0a2e";
  ctx.strokeStyle = color;
  drawVirusWasp(scale);

  ctx.shadowBlur = 0;
  const flap = Math.sin(frame * 0.2) * 2 * scale;
  ctx.fillStyle = "#e8c3ff";
  ctx.beginPath();
  ctx.arc(-13 * scale, -5 * scale - flap, 3, 0, Math.PI * 2);
  ctx.arc(13 * scale, -5 * scale - flap, 3, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(0, 0, 6, 0, Math.PI * 2);
  ctx.fill();
}

function drawBossCrystal(b) {
  // UFO Saucer: classic flying-saucer silhouette with a dome, blinking
  // underlights, and a soft tractor-beam glow.
  const color = "#39c9ff";
  const w = b.w / 2 - 6;
  const h = b.h / 2 - 6;
  ctx.shadowColor = color;
  ctx.shadowBlur = 20;
  ctx.fillStyle = "#0a1f2e";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;

  ctx.beginPath();
  ctx.ellipse(0, h * 0.15, w, h * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, -h * 0.15, w * 0.45, Math.PI, 0, false);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  const t = frame * 0.06;
  ctx.fillStyle = "#c8f0ff";
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const glow = 0.35 + 0.65 * Math.max(0, Math.sin(t + a * 3));
    ctx.globalAlpha = glow;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * w * 0.75, h * 0.4 + Math.sin(a) * h * 0.2, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const beamPulse = 0.15 + Math.sin(frame * 0.1) * 0.08;
  const beam = ctx.createLinearGradient(0, h * 0.6, 0, h * 1.6);
  beam.addColorStop(0, `rgba(57,201,255,${beamPulse + 0.15})`);
  beam.addColorStop(1, "rgba(57,201,255,0)");
  ctx.fillStyle = beam;
  ctx.beginPath();
  ctx.moveTo(-w * 0.3, h * 0.6);
  ctx.lineTo(w * 0.3, h * 0.6);
  ctx.lineTo(w * 0.7, h * 1.6);
  ctx.lineTo(-w * 0.7, h * 1.6);
  ctx.closePath();
  ctx.fill();
}

function drawBossTwin(b) {
  // Twin Squid Carrier: two Space Invaders squids fused by a pulsing
  // energy bridge.
  const color = "#ffb347";
  const scale = 1.9;
  [-1, 1].forEach((side) => {
    ctx.save();
    ctx.translate(side * (b.w / 4), 0);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#3a250a";
    ctx.strokeStyle = color;
    drawVirusSquid(scale);
    ctx.restore();
  });

  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(-b.w / 4 + scale * 9, -scale * 2);
  ctx.lineTo(b.w / 4 - scale * 9, -scale * 2);
  ctx.stroke();

  const span = b.w / 2 - scale * 18;
  const t = ((frame * 3) % (span * 2)) - span;
  ctx.fillStyle = "#ffe4b8";
  ctx.beginPath();
  ctx.arc(t, -scale * 2, 2.2, 0, Math.PI * 2);
  ctx.fill();
}

function drawBossFinal(b) {
  // Hive Overlord: the spiky command ring from before, now with a small
  // twitching arachnid-gem queen core instead of a flat pulse dot.
  const color = "#ff2e63";
  const r = b.w / 2 - 10;

  ctx.shadowColor = color;
  ctx.shadowBlur = 26;
  ctx.fillStyle = "#1a0206";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3.5;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const spikes = 20;
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2 + frame * 0.02;
    const r1 = r;
    const r2 = r + 9;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();
  }

  ctx.save();
  ctx.rotate(-frame * 0.015);
  ctx.strokeStyle = "#ffe066";
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2;
    const px = Math.cos(ang) * (r * 0.55);
    const py = Math.sin(ang) * (r * 0.55);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.stroke();
  ctx.restore();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#fff2c0";
  ctx.strokeStyle = "#7a0018";
  drawVirusArachnid(1.15);
}

function drawBoss(b) {
  ctx.save();
  ctx.translate(b.x, b.y);
  const pulse = 1 + Math.sin(frame * 0.1) * 0.04;
  ctx.scale(pulse, pulse);

  if (b.form === "hex") drawBossHex(b);
  else if (b.form === "crystal") drawBossCrystal(b);
  else if (b.form === "twin") drawBossTwin(b);
  else if (b.form === "final") drawBossFinal(b);
  else drawBossOrb(b);

  ctx.restore();

  const barW = b.form === "final" ? 170 : 110;
  const pct = Math.max(0, b.hp / b.maxHp);
  ctx.save();
  ctx.translate(W / 2 - barW / 2, 24);
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillRect(0, 0, barW, 6);
  ctx.fillStyle = "#ff2e63";
  ctx.fillRect(0, 0, barW * pct, 6);
  ctx.strokeStyle = "#ff2e63";
  ctx.lineWidth = 1;
  ctx.strokeRect(0, 0, barW, 6);
  ctx.restore();
}

function drawPlayer() {
  const flicker = player.invuln > 0 && Math.floor(frame / 4) % 2 === 0;
  if (flicker) return;

  ctx.save();
  ctx.translate(player.x, player.y);

  const w = player.w;
  const h = player.h;
  ctx.translate(0, Math.sin(frame * 0.08) * 1.2); // gentle hover bob

  if (hasAbility(player, "shield")) {
    ctx.beginPath();
    ctx.arc(0, 0, w / 2 + 12, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(57,201,255,0.8)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#39c9ff";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  if (hasAbility(player, "multiplier")) {
    const haloPulse = 1 + Math.sin(frame * 0.15) * 0.15;
    ctx.save();
    ctx.translate(0, -h / 2 - 10);
    ctx.scale(haloPulse, haloPulse);
    ctx.strokeStyle = "#fff2c0";
    ctx.lineWidth = 1.6;
    ctx.shadowColor = "#fff2c0";
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.ellipse(0, 0, 7, 2.2, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  if (hasAbility(player, "homing")) {
    ctx.save();
    ctx.translate(0, -h / 2 - 6);
    ctx.rotate(frame * 0.06);
    ctx.strokeStyle = "#ff6b81";
    ctx.lineWidth = 1.4;
    ctx.shadowColor = "#ff6b81";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(-3.5, 0);
    ctx.lineTo(3.5, 0);
    ctx.moveTo(0, -3.5);
    ctx.lineTo(0, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 1.3, 0, Math.PI * 2);
    ctx.fillStyle = "#ff6b81";
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  if (hasAbility(player, "overclock")) {
    const flare = 8 + Math.sin(frame * 0.5) * 3;
    ctx.beginPath();
    ctx.moveTo(-6, h / 2 - 2);
    ctx.lineTo(0, h / 2 + flare);
    ctx.lineTo(6, h / 2 - 2);
    ctx.closePath();
    ctx.fillStyle = "#ff8c3c";
    ctx.globalAlpha = 0.7;
    ctx.shadowColor = "#ff8c3c";
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  if (hasAbility(player, "rapid")) {
    ctx.strokeStyle = "#ffd23f";
    ctx.lineWidth = 1.4;
    ctx.shadowColor = "#ffd23f";
    ctx.shadowBlur = 6;
    [0, 10].forEach((offset) => {
      const t = (frame * 4 + offset) % 20;
      const ringR = 2 + t * 0.5;
      ctx.globalAlpha = Math.max(0, 1 - t / 20);
      ctx.beginPath();
      ctx.ellipse(0, h / 2 + 2, ringR, ringR * 0.4, 0, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
    ctx.shadowBlur = 0;
  }

  // soft underlight glow
  ctx.beginPath();
  ctx.ellipse(0, h / 2 - 1, 6, 2, 0, 0, Math.PI * 2);
  ctx.fillStyle = "#7dffa3";
  ctx.globalAlpha = 0.55;
  ctx.fill();
  ctx.globalAlpha = 1;

  // saucer hull
  ctx.shadowColor = "#39ff6a";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#0c1712";
  ctx.strokeStyle = "#39ff6a";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 2, w / 2 + 3, h / 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.beginPath();
  ctx.ellipse(0, 4.5, w / 2 - 1, h / 5, 0, 0, Math.PI);
  ctx.strokeStyle = "rgba(57,255,106,0.5)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // dome cockpit
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#a8ffb8";
  ctx.strokeStyle = "#39ff6a";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -1, 6.5, Math.PI, 0, false);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // beacon light
  ctx.shadowBlur = 0;
  ctx.fillStyle = Math.sin(frame * 0.25) > 0 ? "#ffe066" : "#5a5218";
  ctx.beginPath();
  ctx.arc(0, -7.5, 1.5, 0, Math.PI * 2);
  ctx.fill();

  // pulsing rim lights
  const pipCount = 6;
  for (let i = 0; i < pipCount; i++) {
    const a = (i / pipCount) * Math.PI * 2 + frame * 0.03;
    const px = Math.cos(a) * (w / 2 + 1);
    const py = 2 + Math.sin(a) * (h / 3.2);
    ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(frame * 0.15 + i));
    ctx.fillStyle = "#39ff6a";
    ctx.beginPath();
    ctx.arc(px, py, 1.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  if (hasAbility(player, "weapon")) {
    ctx.fillStyle = "#a8ffb8";
    ctx.strokeStyle = "#a8ffb8";
    ctx.shadowColor = "#39ff6a";
    ctx.shadowBlur = 8;
    ctx.lineWidth = 1.6;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.ellipse(side * (w / 2 + 3), 4, 2.6, 1.8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(side * (w / 2 + 3), 0.5);
      ctx.lineTo(side * (w / 2 + 3), -5);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  if (hasAbility(player, "magnet")) {
    ctx.strokeStyle = "#ff9ff3";
    ctx.lineWidth = 1.3;
    ctx.shadowColor = "#ff9ff3";
    ctx.shadowBlur = 6;
    const coilR = 3 + Math.sin(frame * 0.2) * 1;
    [-1, 1].forEach((side) => {
      ctx.beginPath();
      ctx.arc(side * (w / 2 + 5), 2, coilR, 0, Math.PI * 2);
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }

  if (hasAbility(player, "pierce")) {
    ctx.fillStyle = "#c724ff";
    ctx.shadowColor = "#c724ff";
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.moveTo(0, -h / 2 - 8);
    ctx.lineTo(-2, -h / 2 - 1);
    ctx.lineTo(2, -h / 2 - 1);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  if (hasAbility(player, "drone")) {
    ctx.save();
    ctx.translate(-20, 5);
    ctx.shadowColor = "#2de8c4";
    ctx.shadowBlur = 8;
    ctx.fillStyle = "#0c1712";
    ctx.strokeStyle = "#2de8c4";
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(-5, -3);
    ctx.lineTo(5, 3);
    ctx.moveTo(5, -3);
    ctx.lineTo(-5, 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(-5, -3, 1.8, 0, Math.PI * 2);
    ctx.arc(5, -3, 1.8, 0, Math.PI * 2);
    ctx.arc(-5, 3, 1.8, 0, Math.PI * 2);
    ctx.arc(5, 3, 1.8, 0, Math.PI * 2);
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.arc(0, 0, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function drawPowerUpGlyph(c, type) {
  const color = POWERUP_DEFS[type].color;
  c.fillStyle = color;
  c.strokeStyle = color;
  c.lineWidth = 1.6;
  if (type === "weapon") {
    // Phone Repair icon: wrench
    c.beginPath();
    c.arc(-3, -3, 2.1, 0, Math.PI * 2);
    c.arc(3, 3, 2.1, 0, Math.PI * 2);
    c.fill();
    c.lineWidth = 2.2;
    c.beginPath();
    c.moveTo(-2, -2);
    c.lineTo(2, 2);
    c.stroke();
  } else if (type === "shield") {
    // Security icon: shield outline
    c.beginPath();
    c.moveTo(0, -6);
    c.lineTo(5, -3.5);
    c.lineTo(5, 1.5);
    c.quadraticCurveTo(5, 6, 0, 7.5);
    c.quadraticCurveTo(-5, 6, -5, 1.5);
    c.lineTo(-5, -3.5);
    c.closePath();
    c.fill();
  } else if (type === "rapid") {
    // Data Transfer icon: up/down arrows
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-3, 2);
    c.lineTo(-3, -5);
    c.moveTo(-5.5, -2);
    c.lineTo(-3, -5);
    c.lineTo(-0.5, -2);
    c.stroke();
    c.beginPath();
    c.moveTo(3, -2);
    c.lineTo(3, 5);
    c.moveTo(0.5, 2);
    c.lineTo(3, 5);
    c.lineTo(5.5, 2);
    c.stroke();
  } else if (type === "life") {
    // Tech Support icon: gear
    c.beginPath();
    c.arc(0, 0, 3, 0, Math.PI * 2);
    c.fill();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      c.save();
      c.rotate(ang);
      c.translate(0, -5.5);
      c.fillRect(-1, -1.4, 2, 2.8);
      c.restore();
    }
  } else if (type === "magnet") {
    // Tractor Beam icon: horseshoe magnet
    c.lineWidth = 2.2;
    c.beginPath();
    c.arc(0, -1, 4.5, 0, Math.PI, false);
    c.stroke();
    c.beginPath();
    c.moveTo(-4.5, -1);
    c.lineTo(-4.5, -6);
    c.moveTo(4.5, -1);
    c.lineTo(4.5, -6);
    c.stroke();
  } else if (type === "overclock") {
    // Overclock icon: lightning bolt
    c.beginPath();
    c.moveTo(1, -7);
    c.lineTo(-4, 1);
    c.lineTo(0, 1);
    c.lineTo(-1, 7);
    c.lineTo(5, -1);
    c.lineTo(1, -1);
    c.closePath();
    c.fill();
  } else if (type === "pierce") {
    // Piercing Rounds icon: arrow through a ring
    c.lineWidth = 1.8;
    c.beginPath();
    c.arc(0, 0, 4, 0, Math.PI * 2);
    c.stroke();
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(-7, 0);
    c.lineTo(7, 0);
    c.moveTo(4, -2.5);
    c.lineTo(7, 0);
    c.lineTo(4, 2.5);
    c.stroke();
  } else if (type === "homing") {
    // Auto-Aim icon: crosshair reticle
    c.lineWidth = 1.6;
    c.beginPath();
    c.arc(0, 0, 5, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 1.6, 0, Math.PI * 2);
    c.fill();
    c.beginPath();
    c.moveTo(0, -7);
    c.lineTo(0, -5);
    c.moveTo(0, 5);
    c.lineTo(0, 7);
    c.moveTo(-7, 0);
    c.lineTo(-5, 0);
    c.moveTo(7, 0);
    c.lineTo(5, 0);
    c.stroke();
  } else if (type === "drone") {
    // Wingman Drone icon: quadcopter
    c.lineWidth = 1.6;
    c.beginPath();
    c.moveTo(-6, -3);
    c.lineTo(6, 3);
    c.moveTo(6, -3);
    c.lineTo(-6, 3);
    c.stroke();
    c.beginPath();
    c.arc(-6, -3, 2, 0, Math.PI * 2);
    c.arc(6, -3, 2, 0, Math.PI * 2);
    c.arc(-6, 3, 2, 0, Math.PI * 2);
    c.arc(6, 3, 2, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(0, 0, 2.2, 0, Math.PI * 2);
    c.fill();
  } else if (type === "multiplier") {
    // Premium Support icon: star badge
    c.beginPath();
    for (let i = 0; i < 5; i++) {
      const outerAng = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const innerAng = outerAng + Math.PI / 5;
      const ox = Math.cos(outerAng) * 6;
      const oy = Math.sin(outerAng) * 6;
      const ix = Math.cos(innerAng) * 2.6;
      const iy = Math.sin(innerAng) * 2.6;
      if (i === 0) c.moveTo(ox, oy);
      else c.lineTo(ox, oy);
      c.lineTo(ix, iy);
    }
    c.closePath();
    c.fill();
  }
}

const LEGEND_SHORT_LABEL = {
  weapon: "Weapon",
  shield: "Shield",
  rapid: "Rapid",
  life: "Life",
  magnet: "Magnet",
  overclock: "Overclock",
  pierce: "Pierce",
  homing: "Auto-Aim",
  drone: "Drone",
  multiplier: "Premium",
};

function drawLegend() {
  if (!legendCtx) return;
  const cols = 5;
  const cellW = legendCanvas.width / cols;
  const cellH = legendCanvas.height / 2;
  legendCtx.clearRect(0, 0, legendCanvas.width, legendCanvas.height);
  POWERUP_TYPES.forEach((type, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cx = col * cellW + cellW / 2;
    const cy = row * cellH + cellH / 2 - 6;
    const color = POWERUP_DEFS[type].color;

    legendCtx.save();
    legendCtx.translate(cx, cy);
    legendCtx.shadowColor = color;
    legendCtx.shadowBlur = 6;
    legendCtx.fillStyle = "#0c1712";
    legendCtx.strokeStyle = color;
    legendCtx.lineWidth = 1.6;
    legendCtx.beginPath();
    legendCtx.arc(0, 0, 10, 0, Math.PI * 2);
    legendCtx.fill();
    legendCtx.stroke();
    legendCtx.shadowBlur = 0;
    drawPowerUpGlyph(legendCtx, type);
    legendCtx.restore();

    legendCtx.fillStyle = "#9fb3a6";
    legendCtx.font = "7.5px 'Inter', sans-serif";
    legendCtx.textAlign = "center";
    legendCtx.fillText(LEGEND_SHORT_LABEL[type], cx, cy + 20);
  });
}

function drawPowerUp(p) {
  const def = POWERUP_DEFS[p.type];
  const color = def.color;
  ctx.save();
  ctx.translate(p.x, p.y);

  if (def.rarity === "rare" || def.rarity === "legendary") {
    const pulse = p.r + 3 + Math.sin(frame * 0.15) * 2;
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  ctx.shadowColor = color;
  ctx.shadowBlur = def.rarity === "legendary" ? 16 : 10;
  ctx.fillStyle = "#0c1712";
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  drawPowerUpGlyph(ctx, p.type);
  ctx.restore();
}

function drawWaveBanner() {
  if (waveBannerTime <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, waveBannerTime);
  ctx.font = "16px 'Baloo 2', sans-serif";
  ctx.textAlign = "center";
  const isBoss = waveBanner.includes("BOSS");
  ctx.fillStyle = isBoss ? "#ff2e63" : waveBanner === "BONUS ROUND" ? "#ffe066" : "#39ff6a";
  ctx.shadowColor = ctx.fillStyle;
  ctx.shadowBlur = 12;
  ctx.fillText(waveBanner, W / 2, H / 2 - 70);
  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.font = "10px 'Baloo 2', sans-serif";
  ctx.fillStyle = "#7dffa3";
  ctx.textAlign = "left";
  ctx.fillText("LV " + wave, 8, 22);

  for (let i = 0; i < MAX_ABILITIES; i++) {
    const type = player.abilities[i];
    ctx.beginPath();
    ctx.arc(14 + i * 16, 36, 6, 0, Math.PI * 2);
    if (type) {
      ctx.fillStyle = POWERUP_DEFS[type].color;
      ctx.fill();
    } else {
      ctx.strokeStyle = "rgba(125,255,163,0.35)";
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }
  }

  if (coins > 0 || phase !== "wave") {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffe066";
    ctx.fillText("◆ " + coins, W - 8, 22);
  }

  if (phase === "bonus") {
    ctx.textAlign = "right";
    ctx.fillStyle = "#ffe066";
    ctx.fillText(Math.ceil(bonusTimer) + "s", W - 8, 36);
  }

  ctx.restore();
}

function draw() {
  drawBackground();

  if (phase === "bonus") {
    drawBonusTargets();
  } else if (boss) {
    drawBoss(boss);
  } else {
    viruses.forEach((a) => a.alive && drawVirus(a));
  }

  ctx.fillStyle = "#7dffa3";
  ctx.shadowColor = "#39ff6a";
  ctx.shadowBlur = 6;
  bullets.forEach((b) => {
    ctx.beginPath();
    ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.shadowBlur = 0;

  if (phase !== "bonus" && phase !== "shop") {
    enemyBullets.forEach((b) => {
      ctx.beginPath();
      if (b.boss) {
        ctx.fillStyle = "#ffb347";
        ctx.arc(b.x, b.y, 5, 0, Math.PI * 2);
      } else {
        ctx.fillStyle = "#ff5566";
        ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2);
      }
      ctx.fill();
    });
  }

  drawWaveBanner();

  if (phase !== "bonus" && phase !== "shop") {
    powerUps.forEach(drawPowerUp);
  }

  drawPlayer();
  drawHud();

  if (hitFlash > 0) {
    ctx.fillStyle = `rgba(255,85,102,${hitFlash * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}

document.querySelectorAll(".dbtn.left, .dbtn.right, .dbtn.up, .dbtn.down").forEach((btn) => {
  const dir = btn.dataset.dir;
  const setState = (v) => {
    if (dir === "left") moveLeft = v;
    if (dir === "right") moveRight = v;
    if (dir === "up") moveUp = v;
    if (dir === "down") moveDown = v;
  };
  btn.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    setState(true);
  });
  ["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
    btn.addEventListener(ev, () => setState(false))
  );
});

fireBtn.addEventListener("pointerdown", (e) => {
  e.preventDefault();
  fireHeld = true;
  if (running) fire();
});
["pointerup", "pointerleave", "pointercancel"].forEach((ev) =>
  fireBtn.addEventListener(ev, () => (fireHeld = false))
);

window.addEventListener("keydown", (e) => {
  if (e.key === "ArrowLeft") moveLeft = true;
  if (e.key === "ArrowRight") moveRight = true;
  if (e.key === "ArrowUp") moveUp = true;
  if (e.key === "ArrowDown") moveDown = true;
  if (e.key === " " || e.key === "s" || e.key === "S") {
    fireHeld = true;
    if (running) fire();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") moveLeft = false;
  if (e.key === "ArrowRight") moveRight = false;
  if (e.key === "ArrowUp") moveUp = false;
  if (e.key === "ArrowDown") moveDown = false;
  if (e.key === " " || e.key === "s" || e.key === "S") fireHeld = false;
});

let dragging = false;
function dragPlayerTo(clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = W / rect.width;
  const scaleY = H / rect.height;
  player.x = Math.max(player.w, Math.min(W - player.w, (clientX - rect.left) * scaleX));
  player.y = Math.max(PLAYER_MIN_Y, Math.min(PLAYER_MAX_Y, (clientY - rect.top) * scaleY));
}
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  dragPlayerTo(e.clientX, e.clientY);
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging || !running) return;
  dragPlayerTo(e.clientX, e.clientY);
});
window.addEventListener("pointerup", () => (dragging = false));
canvas.addEventListener("click", () => running && fire());

startBtn.addEventListener("click", startGame);
restartBtn.addEventListener("click", startGame);
victoryRestartBtn.addEventListener("click", startGame);
shopSkipBtn.addEventListener("click", skipShop);

best = loadBest();
bestEl.textContent = best;
stars = makeStars();
player = freshPlayer();
bullets = [];
enemyBullets = [];
powerUps = [];
bonusTargets = [];
score = 0;
coins = 0;
lives = 3;
wave = 1;
phase = "wave";
boss = null;
viruses = buildFormation(wave);
waveTotalCount = viruses.length;
draw();
drawLegend();
