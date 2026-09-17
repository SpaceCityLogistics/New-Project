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

const ROWS = 4;
const COLS = 6;
const VIRUS_W = 26;
const VIRUS_H = 26;
const GAP_X = 40;
const GAP_Y = 34;
const FORMATION_TOP = 46;
const FORMATION_LEFT = (W - (COLS - 1) * GAP_X) / 2;

const VIRUS_COLORS = ["#ff5566", "#ffb347", "#b967ff", "#39c9ff"];
const MAX_WEAPON = 3;
const SHIELD_DURATION = 8;
const RAPID_DURATION = 8;
const POWERUP_TYPES = ["weapon", "shield", "rapid", "life"];

let player, bullets, enemyBullets, viruses, powerUps, score, best, lives;
let running, wave, formationDir, formationX, frame, lastTime, animId;
let moveLeft = false;
let moveRight = false;
let fireHeld = false;
let fireCooldown = 0;
let stars = [];
let hitFlash = 0;

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

function makeViruses() {
  const list = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      list.push({
        row: r,
        col: c,
        baseX: FORMATION_LEFT + c * GAP_X,
        baseY: FORMATION_TOP + r * GAP_Y,
        x: FORMATION_LEFT + c * GAP_X,
        y: FORMATION_TOP + r * GAP_Y,
        alive: true,
        diving: false,
        diveT: 0,
        diveStartX: 0,
        diveStartY: 0,
        diveTargetX: 0,
        color: VIRUS_COLORS[r % VIRUS_COLORS.length],
        points: (ROWS - r) * 10,
      });
    }
  }
  return list;
}

function freshPlayer() {
  return {
    x: W / 2,
    y: H - 36,
    w: 28,
    h: 22,
    speed: 220,
    weaponLevel: 1,
    shieldTime: 0,
    rapidTime: 0,
    invuln: 0,
  };
}

function resetGame() {
  player = freshPlayer();
  bullets = [];
  enemyBullets = [];
  powerUps = [];
  viruses = makeViruses();
  score = 0;
  lives = 3;
  wave = 1;
  formationDir = 1;
  formationX = 0;
  frame = 0;
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

function startGame() {
  startOverlay.classList.add("hidden");
  gameOverOverlay.classList.add("hidden");
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

function fire() {
  if (fireCooldown > 0) return;
  const y = player.y - player.h / 2;
  if (player.weaponLevel === 1) {
    bullets.push({ x: player.x, y, vx: 0, vy: -440 });
  } else if (player.weaponLevel === 2) {
    bullets.push({ x: player.x - 7, y, vx: 0, vy: -440 });
    bullets.push({ x: player.x + 7, y, vx: 0, vy: -440 });
  } else {
    bullets.push({ x: player.x, y, vx: 0, vy: -460 });
    bullets.push({ x: player.x - 8, y, vx: -70, vy: -430 });
    bullets.push({ x: player.x + 8, y, vx: 70, vy: -430 });
  }
  fireCooldown = player.rapidTime > 0 ? 0.09 : 0.22;
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
  if (fireHeld) fire();

  if (player.shieldTime > 0) player.shieldTime -= dt;
  if (player.rapidTime > 0) player.rapidTime -= dt;
  if (player.invuln > 0) player.invuln -= dt;
  if (hitFlash > 0) hitFlash -= dt;

  stars.forEach((s) => {
    s.y += s.speed;
    if (s.y > H) s.y = 0;
  });

  const alive = viruses.filter((a) => a.alive);
  const speed = 22 + (ROWS * COLS - alive.length) * 1.6;
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
      if (Math.random() < 0.0004) {
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

  if (Math.random() < 0.02) {
    const shooters = alive.filter((a) => !a.diving);
    if (shooters.length) {
      const s = shooters[Math.floor(Math.random() * shooters.length)];
      enemyBullets.push({ x: s.x, y: s.y + VIRUS_H / 2, vy: 180 });
    }
  }

  bullets.forEach((b) => {
    b.x += (b.vx || 0) * dt;
    b.y += b.vy * dt;
  });
  bullets = bullets.filter((b) => b.y > -10 && b.x > -10 && b.x < W + 10);

  enemyBullets.forEach((b) => (b.y += b.vy * dt));
  enemyBullets = enemyBullets.filter((b) => b.y < H + 10);

  powerUps.forEach((p) => (p.y += p.vy * dt));
  powerUps = powerUps.filter((p) => p.y < H + 20);

  bullets.forEach((b) => {
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

  if (viruses.every((a) => !a.alive)) {
    wave += 1;
    viruses = makeViruses();
    spawnPowerUp(W / 2, -20);
  }
}

function applyPowerUp(type) {
  if (type === "weapon") {
    player.weaponLevel = Math.min(MAX_WEAPON, player.weaponLevel + 1);
  } else if (type === "shield") {
    player.shieldTime = SHIELD_DURATION;
  } else if (type === "rapid") {
    player.rapidTime = RAPID_DURATION;
  } else if (type === "life") {
    lives = Math.min(5, lives + 1);
    livesEl.textContent = lives;
  }
}

function hitPlayer() {
  if (player.shieldTime > 0 || player.invuln > 0) return;
  lives -= 1;
  livesEl.textContent = lives;
  hitFlash = 0.3;
  player.invuln = 1.2;
  player.weaponLevel = 1;
  player.rapidTime = 0;
  if (lives <= 0) endGame();
}

function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2;
}

function drawBackground() {
  ctx.fillStyle = "#04060a";
  ctx.fillRect(0, 0, W, H);

  const neb1 = ctx.createRadialGradient(W * 0.2, H * 0.1, 0, W * 0.2, H * 0.1, 220);
  neb1.addColorStop(0, "rgba(57,255,106,0.10)");
  neb1.addColorStop(1, "transparent");
  ctx.fillStyle = neb1;
  ctx.fillRect(0, 0, W, H);

  const neb2 = ctx.createRadialGradient(W * 0.85, H * 0.6, 0, W * 0.85, H * 0.6, 260);
  neb2.addColorStop(0, "rgba(57,255,106,0.08)");
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
}

function drawVirus(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.shadowColor = a.color;
  ctx.shadowBlur = 8;
  ctx.fillStyle = a.color;
  ctx.beginPath();
  ctx.arc(0, 0, VIRUS_W / 2 - 3, 0, Math.PI * 2);
  ctx.fill();

  const spikes = 8;
  for (let i = 0; i < spikes; i++) {
    const ang = (i / spikes) * Math.PI * 2 + frame * 0.02;
    const r1 = VIRUS_W / 2 - 3;
    const r2 = VIRUS_W / 2 + 3;
    ctx.beginPath();
    ctx.arc(Math.cos(ang) * (r1 + 3), Math.sin(ang) * (r1 + 3), 2.4, 0, Math.PI * 2);
    ctx.moveTo(Math.cos(ang) * r1, Math.sin(ang) * r1);
    ctx.lineTo(Math.cos(ang) * r2, Math.sin(ang) * r2);
    ctx.lineWidth = 2;
    ctx.strokeStyle = a.color;
    ctx.stroke();
    ctx.fill();
  }

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#04060a";
  ctx.beginPath();
  ctx.arc(-4, -1, 2.2, 0, Math.PI * 2);
  ctx.arc(4, -1, 2.2, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(0, 4, 2, Math.PI * 0.1, Math.PI * 0.9);
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const flicker = player.invuln > 0 && Math.floor(frame / 4) % 2 === 0;
  if (flicker) return;

  ctx.save();
  ctx.translate(player.x, player.y);

  if (player.shieldTime > 0) {
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
  ctx.lineWidth = 2;
  if (p.type === "weapon") {
    ctx.beginPath();
    ctx.moveTo(0, -5);
    ctx.lineTo(5, 3);
    ctx.lineTo(-5, 3);
    ctx.closePath();
    ctx.fill();
  } else if (p.type === "shield") {
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.stroke();
  } else if (p.type === "rapid") {
    ctx.beginPath();
    ctx.moveTo(-2, -6);
    ctx.lineTo(3, -1);
    ctx.lineTo(0, -1);
    ctx.lineTo(2, 6);
    ctx.lineTo(-3, 0);
    ctx.lineTo(0, 0);
    ctx.closePath();
    ctx.fill();
  } else if (p.type === "life") {
    ctx.beginPath();
    ctx.moveTo(0, 5);
    ctx.bezierCurveTo(-7, -2, -3, -7, 0, -3);
    ctx.bezierCurveTo(3, -7, 7, -2, 0, 5);
    ctx.fill();
  }
  ctx.restore();
}

function drawHud() {
  ctx.save();
  ctx.font = "10px 'Baloo 2', sans-serif";
  ctx.fillStyle = "#7dffa3";
  for (let i = 0; i < MAX_WEAPON; i++) {
    ctx.globalAlpha = i < player.weaponLevel ? 1 : 0.25;
    ctx.fillRect(8 + i * 10, 8, 6, 6);
  }
  ctx.globalAlpha = 1;

  let iconX = W - 16;
  if (player.shieldTime > 0) {
    ctx.fillStyle = "#39c9ff";
    ctx.beginPath();
    ctx.arc(iconX, 12, 5, 0, Math.PI * 2);
    ctx.fill();
    iconX -= 16;
  }
  if (player.rapidTime > 0) {
    ctx.fillStyle = "#ffd23f";
    ctx.beginPath();
    ctx.arc(iconX, 12, 5, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function draw() {
  drawBackground();

  viruses.forEach((a) => a.alive && drawVirus(a));

  ctx.fillStyle = "#7dffa3";
  ctx.shadowColor = "#39ff6a";
  ctx.shadowBlur = 6;
  bullets.forEach((b) => ctx.fillRect(b.x - 2, b.y - 5, 4, 10));
  ctx.shadowBlur = 0;

  ctx.fillStyle = "#ff5566";
  enemyBullets.forEach((b) => ctx.fillRect(b.x - 2, b.y - 5, 4, 10));

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
  if (e.key === " ") {
    fireHeld = true;
    if (running) fire();
  }
});
window.addEventListener("keyup", (e) => {
  if (e.key === "ArrowLeft") moveLeft = false;
  if (e.key === "ArrowRight") moveRight = false;
  if (e.key === " ") fireHeld = false;
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

best = loadBest();
bestEl.textContent = best;
stars = makeStars();
player = freshPlayer();
bullets = [];
enemyBullets = [];
powerUps = [];
viruses = makeViruses();
score = 0;
lives = 3;
draw();
