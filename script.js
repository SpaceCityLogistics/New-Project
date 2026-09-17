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

const VIRUS_W = 26;
const VIRUS_H = 26;
const GAP_X = 38;
const GAP_Y = 32;
const FORMATION_TOP = 46;
const CENTER_X = W / 2;

const VIRUS_COLORS = ["#ff5566", "#ffb347", "#ffe066", "#b967ff", "#39c9ff"];
const FORMATION_PATTERNS = ["grid", "vshape", "diamond", "zigzag", "arc"];
const BOSS_INTERVAL = 3;
const BOSS_FORMS = ["orb", "hex", "crystal", "twin"];
const MAX_WEAPON = 3;
const MAX_ABILITIES = 3;
const MAX_WAVE = 50;
const BONUS_DURATION = 8;
const POWERUP_TYPES = ["weapon", "shield", "rapid", "life"];
const SHOP_POOL = [
  { type: "weapon", label: "Weapon Boost", desc: "Add a weapon power-up", price: 40 },
  { type: "shield", label: "Shield Charge", desc: "Add a one-hit shield", price: 30 },
  { type: "rapid", label: "Rapid Fire", desc: "Add a rapid-fire power-up", price: 25 },
  { type: "life", label: "Extra Life", desc: "+1 life", price: 60 },
];
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
let fireHeld = false;
let fireCooldown = 0;
let stars = [];
let hitFlash = 0;
let phase = "wave";
let coins = 0;
let bonusTimer = 0;
let bonusTargets = [];
let pendingBossWave = null;
let shopOptions = [];

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

function startBonusRound(waveNum) {
  phase = "bonus";
  pendingBossWave = waveNum;
  bonusTimer = BONUS_DURATION;
  bonusTargets = makeBonusTargets();
  waveBanner = "BONUS ROUND";
  waveBannerTime = 1.8;
}

function makeBonusTargets() {
  const list = [];
  const count = 10;
  for (let i = 0; i < count; i++) {
    list.push({
      x: 30 + Math.random() * (W - 60),
      y: 26 + Math.random() * 70,
      vx: (Math.random() < 0.5 ? -1 : 1) * (30 + Math.random() * 40),
      vy: (Math.random() < 0.5 ? -1 : 1) * (14 + Math.random() * 18),
      r: 9,
      alive: true,
      value: 5 * (1 + Math.floor(Math.random() * 3)),
    });
  }
  return list;
}

function buildShopOptions() {
  const pool = [...SHOP_POOL];
  const picks = [];
  for (let i = 0; i < 3 && pool.length; i++) {
    const idx = Math.floor(Math.random() * pool.length);
    picks.push(pool.splice(idx, 1)[0]);
  }
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
    card.innerHTML =
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
    y: H - 36,
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
  finalScoreEl.textContent = `Score: ${score}`;
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
  const t = type || POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
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
  if (moveLeft) player.x -= player.speed * dt;
  if (moveRight) player.x += player.speed * dt;
  player.x = Math.max(player.w, Math.min(W - player.w, player.x));

  fireCooldown -= dt;
  if (fireHeld && phase !== "shop") fire();

  if (player.invuln > 0) player.invuln -= dt;
  if (hitFlash > 0) hitFlash -= dt;
  if (waveBannerTime > 0) waveBannerTime -= dt;

  stars.forEach((s) => {
    s.y += s.speed;
    if (s.y > H) s.y = 0;
  });

  bullets.forEach((b) => {
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

  powerUps.forEach((p) => (p.y += p.vy * dt));
  powerUps = powerUps.filter((p) => p.y < H + 20);

  bullets.forEach((b) => {
    if (b.dead) return;
    if (boss) {
      if (rectHit(boss.x, boss.y, boss.w, boss.h, b.x, b.y, 6, 10)) {
        b.dead = true;
        boss.hp -= 1;
      }
      return;
    }
    viruses.forEach((a) => {
      if (!a.alive || b.dead) return;
      if (rectHit(a.x, a.y, VIRUS_W, VIRUS_H, b.x, b.y, 4, 10)) {
        a.alive = false;
        b.dead = true;
        score += a.points;
        scoreEl.textContent = score;
      }
    });
  });
  bullets = bullets.filter((b) => !b.dead);

  if (boss && boss.hp <= 0) {
    if (boss.form === "final") {
      winGame();
    } else {
      score += 500 + wave * 50;
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
  bonusTargets.forEach((t) => {
    if (!t.alive) return;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    if (t.x < 24 || t.x > W - 24) t.vx *= -1;
    if (t.y < 24 || t.y > 110) t.vy *= -1;
  });

  bullets.forEach((b) => {
    if (b.dead) return;
    bonusTargets.forEach((t) => {
      if (!t.alive || b.dead) return;
      if (rectHit(t.x, t.y, t.r * 2, t.r * 2, b.x, b.y, 4, 10)) {
        t.alive = false;
        b.dead = true;
        coins += t.value;
        score += t.value;
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

function drawVirusSpiky() {
  const r = VIRUS_W / 2 - 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2 + frame * 0.02;
    const r1 = r;
    const r2 = r + 6;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * (r1 + 3), Math.sin(ang) * (r1 + 3), 2.4, 0, Math.PI * 2);
    ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fill();
  }
}

function drawVirusHex() {
  const r = VIRUS_W / 2;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + frame * 0.015;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + frame * 0.015;
    const px = Math.cos(ang) * (r + 4);
    const py = Math.sin(ang) * (r + 4);
    ctx.beginPath();
    ctx.arc(px, py, 2, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVirusBlob() {
  const r = VIRUS_W / 2 - 2;
  ctx.beginPath();
  const points = 10;
  for (let i = 0; i <= points; i++) {
    const ang = (i / points) * Math.PI * 2;
    const wobble = Math.sin(ang * 3 + frame * 0.06) * 3;
    const px = Math.cos(ang) * (r + wobble);
    const py = Math.sin(ang) * (r + wobble);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

function drawVirusCrystal() {
  const r = VIRUS_W / 2 + 1;
  ctx.save();
  ctx.rotate(Math.PI / 4 + frame * 0.01);
  ctx.beginPath();
  ctx.moveTo(0, -r);
  ctx.lineTo(r * 0.7, -r * 0.3);
  ctx.lineTo(r * 0.5, r * 0.8);
  ctx.lineTo(-r * 0.5, r * 0.8);
  ctx.lineTo(-r * 0.7, -r * 0.3);
  ctx.closePath();
  ctx.fill();
  ctx.lineWidth = 1.6;
  ctx.stroke();
  ctx.restore();
}

function drawVirusRing() {
  const r = VIRUS_W / 2;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.arc(0, 0, r - 6, 0, Math.PI * 2, true);
  ctx.fill("evenodd");
  ctx.lineWidth = 1.6;
  ctx.stroke();
  const pips = 6;
  for (let i = 0; i < pips; i++) {
    const ang = (i / pips) * Math.PI * 2 + frame * 0.02;
    const px = Math.cos(ang) * (r - 3);
    const py = Math.sin(ang) * (r - 3);
    ctx.beginPath();
    ctx.arc(px, py, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawVirus(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.shadowColor = a.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = a.color;
  ctx.strokeStyle = a.color;

  const shape = a.shapeIndex % 5;
  if (shape === 0) drawVirusSpiky();
  else if (shape === 1) drawVirusHex();
  else if (shape === 2) drawVirusBlob();
  else if (shape === 3) drawVirusCrystal();
  else drawVirusRing();

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
  ctx.shadowColor = "#ff2e63";
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#3a0a1a";
  ctx.strokeStyle = "#ff2e63";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, b.w / 2 - 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  const spikes = 14;
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2 + frame * 0.015;
    const r1 = b.w / 2 - 8;
    const r2 = b.w / 2 + 6;
    ctx.beginPath();
    ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
    ctx.lineWidth = 3;
    ctx.strokeStyle = "#ff2e63";
    ctx.stroke();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#ffe066";
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#3a0a1a";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.stroke();
}

function drawBossHex(b) {
  const color = "#b967ff";
  const r = b.w / 2 - 4;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#1a0a2e";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + frame * 0.008;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  for (let i = 0; i < 6; i++) {
    const ang = (i / 6) * Math.PI * 2 + frame * 0.008;
    const px = Math.cos(ang) * r;
    const py = Math.sin(ang) * r;
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, Math.PI * 2);
  ctx.fillStyle = "#e8c3ff";
  ctx.fill();
}

function drawBossCrystal(b) {
  const color = "#39c9ff";
  const h = b.h / 2 + 6;
  const w = b.w / 2 - 10;
  ctx.shadowColor = color;
  ctx.shadowBlur = 18;
  ctx.fillStyle = "#0a1f2e";
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(w, -h * 0.15);
  ctx.lineTo(w * 0.5, h);
  ctx.lineTo(-w * 0.5, h);
  ctx.lineTo(-w, -h * 0.15);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  ctx.strokeStyle = "rgba(57,201,255,0.6)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(0, -h);
  ctx.lineTo(0, h);
  ctx.moveTo(w, -h * 0.15);
  ctx.lineTo(-w * 0.5, h);
  ctx.moveTo(-w, -h * 0.15);
  ctx.lineTo(w * 0.5, h);
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#c8f0ff";
  ctx.beginPath();
  ctx.arc(0, -h * 0.35, 5, 0, Math.PI * 2);
  ctx.fill();
}

function drawBossTwin(b) {
  const color = "#ffb347";
  const r = b.w / 3 - 4;
  [-1, 1].forEach((side) => {
    const cx = side * (b.w / 4);
    ctx.shadowColor = color;
    ctx.shadowBlur = 16;
    ctx.fillStyle = "#3a250a";
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, 0, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const spikes = 8;
    for (let i = 0; i < spikes; i++) {
      const ang = (i / spikes) * Math.PI * 2 + frame * 0.02 * side;
      const r1 = r;
      const r2 = r + 5;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(ang) * r1, Math.sin(ang) * r1);
      ctx.lineTo(cx + Math.cos(ang) * r2, Math.sin(ang) * r2);
      ctx.lineWidth = 2;
      ctx.strokeStyle = color;
      ctx.stroke();
    }
  });
  ctx.shadowBlur = 0;
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-b.w / 4 + r, 0);
  ctx.lineTo(b.w / 4 - r, 0);
  ctx.stroke();
}

function drawBossFinal(b) {
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
  const pulse = 7 + Math.sin(frame * 0.2) * 2;
  ctx.fillStyle = "#fff2c0";
  ctx.beginPath();
  ctx.arc(0, 0, pulse, 0, Math.PI * 2);
  ctx.fill();
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

  if (hasAbility(player, "shield")) {
    ctx.beginPath();
    ctx.arc(0, 0, player.w / 2 + 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(57,201,255,0.8)";
    ctx.lineWidth = 2;
    ctx.shadowColor = "#39c9ff";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // thruster flame
  const flameLen = 6 + Math.sin(frame * 0.6) * 3;
  ctx.beginPath();
  ctx.moveTo(-5, player.h / 2 - 2);
  ctx.lineTo(0, player.h / 2 + flameLen);
  ctx.lineTo(5, player.h / 2 - 2);
  ctx.fillStyle = "#7dffa3";
  ctx.globalAlpha = 0.85;
  ctx.fill();
  ctx.globalAlpha = 1;

  // hull
  ctx.shadowColor = "#39ff6a";
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#0c1712";
  ctx.strokeStyle = "#39ff6a";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -player.h / 2);
  ctx.lineTo(player.w / 2, player.h / 2 - 2);
  ctx.lineTo(player.w / 4, player.h / 2);
  ctx.lineTo(-player.w / 4, player.h / 2);
  ctx.lineTo(-player.w / 2, player.h / 2 - 2);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // cockpit
  ctx.shadowBlur = 6;
  ctx.fillStyle = "#a8ffb8";
  ctx.beginPath();
  ctx.ellipse(0, -1, 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();

  // wing tips
  ctx.shadowBlur = 0;
  ctx.fillStyle = "#39ff6a";
  ctx.beginPath();
  ctx.arc(-player.w / 2, player.h / 2 - 2, 2, 0, Math.PI * 2);
  ctx.arc(player.w / 2, player.h / 2 - 2, 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.restore();
}

function drawPowerUp(p) {
  const icons = { weapon: "#39ff6a", shield: "#39c9ff", rapid: "#ffd23f", life: "#ff5566" };
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.shadowColor = icons[p.type];
  ctx.shadowBlur = 10;
  ctx.fillStyle = "#0c1712";
  ctx.strokeStyle = icons[p.type];
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, p.r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  ctx.shadowBlur = 0;
  ctx.fillStyle = icons[p.type];
  ctx.strokeStyle = icons[p.type];
  ctx.lineWidth = 1.6;
  if (p.type === "weapon") {
    // Phone Repair icon: wrench
    ctx.beginPath();
    ctx.arc(-3, -3, 2.1, 0, Math.PI * 2);
    ctx.arc(3, 3, 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(2, 2);
    ctx.stroke();
  } else if (p.type === "shield") {
    // Security icon: shield outline
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, -3.5);
    ctx.lineTo(5, 1.5);
    ctx.quadraticCurveTo(5, 6, 0, 7.5);
    ctx.quadraticCurveTo(-5, 6, -5, 1.5);
    ctx.lineTo(-5, -3.5);
    ctx.closePath();
    ctx.fill();
  } else if (p.type === "rapid") {
    // Data Transfer icon: up/down arrows
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-3, 2);
    ctx.lineTo(-3, -5);
    ctx.moveTo(-5.5, -2);
    ctx.lineTo(-3, -5);
    ctx.lineTo(-0.5, -2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(3, -2);
    ctx.lineTo(3, 5);
    ctx.moveTo(0.5, 2);
    ctx.lineTo(3, 5);
    ctx.lineTo(5.5, 2);
    ctx.stroke();
  } else if (p.type === "life") {
    // Tech Support icon: gear
    ctx.beginPath();
    ctx.arc(0, 0, 3, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 6; i++) {
      const ang = (i / 6) * Math.PI * 2;
      ctx.save();
      ctx.rotate(ang);
      ctx.translate(0, -5.5);
      ctx.fillRect(-1, -1.4, 2, 2.8);
      ctx.restore();
    }
  }
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

  const abilityColors = { weapon: "#39ff6a", shield: "#39c9ff", rapid: "#ffd23f" };
  for (let i = 0; i < MAX_ABILITIES; i++) {
    const type = player.abilities[i];
    ctx.beginPath();
    ctx.arc(14 + i * 16, 36, 6, 0, Math.PI * 2);
    if (type) {
      ctx.fillStyle = abilityColors[type] || "#7dffa3";
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

  drawWaveBanner();

  powerUps.forEach(drawPowerUp);

  drawPlayer();
  drawHud();

  if (hitFlash > 0) {
    ctx.fillStyle = `rgba(255,85,102,${hitFlash * 0.6})`;
    ctx.fillRect(0, 0, W, H);
  }
}

document.querySelectorAll(".dbtn.left, .dbtn.right").forEach((btn) => {
  const dir = btn.dataset.dir;
  const setState = (v) => {
    if (dir === "left") moveLeft = v;
    if (dir === "right") moveRight = v;
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
  if (e.key === " " || e.key === "s" || e.key === "S") {
    fireHeld = true;
    if (running) fire();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") moveLeft = false;
  if (e.key === "ArrowRight") moveRight = false;
  if (e.key === " " || e.key === "s" || e.key === "S") fireHeld = false;
});

let dragging = false;
canvas.addEventListener("pointerdown", (e) => {
  dragging = true;
  const rect = canvas.getBoundingClientRect();
  const scale = W / rect.width;
  player.x = (e.clientX - rect.left) * scale;
});
canvas.addEventListener("pointermove", (e) => {
  if (!dragging || !running) return;
  const rect = canvas.getBoundingClientRect();
  const scale = W / rect.width;
  player.x = (e.clientX - rect.left) * scale;
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
