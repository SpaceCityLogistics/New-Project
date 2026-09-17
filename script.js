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
const AXO_W = 28;
const AXO_H = 22;
const AXO_GAP_X = 38;
const AXO_GAP_Y = 34;
const FORMATION_TOP = 40;
const FORMATION_LEFT = (W - (COLS - 1) * AXO_GAP_X) / 2;

let player, bullets, enemyBullets, axolotls, score, best, lives, running;
let formationDir, formationX, frame, lastTime, animId;
let moveLeft = false;
let moveRight = false;
let fireHeld = false;
let fireCooldown = 0;

function loadBest() {
  try {
    return Number(localStorage.getItem("axoAssaultBest")) || 0;
  } catch {
    return 0;
  }
}
function saveBest(v) {
  try {
    localStorage.setItem("axoAssaultBest", String(v));
  } catch {}
}

function makeAxolotls() {
  const list = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      list.push({
        row: r,
        col: c,
        baseX: FORMATION_LEFT + c * AXO_GAP_X,
        baseY: FORMATION_TOP + r * AXO_GAP_Y,
        x: FORMATION_LEFT + c * AXO_GAP_X,
        y: FORMATION_TOP + r * AXO_GAP_Y,
        alive: true,
        diving: false,
        diveT: 0,
        diveStartX: 0,
        diveStartY: 0,
        diveTargetX: 0,
        hue: 320 + r * 6,
      });
    }
  }
  return list;
}

function resetGame() {
  player = { x: W / 2, y: H - 34, w: 26, h: 18, speed: 220 };
  bullets = [];
  enemyBullets = [];
  axolotls = makeAxolotls();
  score = 0;
  lives = 3;
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

function fire() {
  if (fireCooldown > 0) return;
  bullets.push({ x: player.x, y: player.y - player.h / 2, vy: -420 });
  fireCooldown = 0.22;
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
  // player movement
  if (moveLeft) player.x -= player.speed * dt;
  if (moveRight) player.x += player.speed * dt;
  player.x = Math.max(player.w, Math.min(W - player.w, player.x));

  fireCooldown -= dt;
  if (fireHeld) fire();

  // formation side-to-side sway
  const alive = axolotls.filter((a) => a.alive);
  const speed = 22 + (ROWS * COLS - alive.length) * 1.6;
  formationX += formationDir * speed * dt;
  const edge = 26;
  if (formationX > edge || formationX < -edge) {
    formationDir *= -1;
    formationX = Math.max(-edge, Math.min(edge, formationX));
  }

  axolotls.forEach((a) => {
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
      if (rectHit(a.x, a.y, AXO_W, AXO_H, player.x, player.y, player.w, player.h)) {
        a.diving = false;
        a.x = a.baseX + formationX;
        a.y = a.baseY;
        hitPlayer();
      }
    }
  });

  // enemy shooting
  if (Math.random() < 0.02) {
    const shooters = alive.filter((a) => !a.diving);
    if (shooters.length) {
      const s = shooters[Math.floor(Math.random() * shooters.length)];
      enemyBullets.push({ x: s.x, y: s.y + AXO_H / 2, vy: 180 });
    }
  }

  // bullets
  bullets.forEach((b) => (b.y += b.vy * dt));
  bullets = bullets.filter((b) => b.y > -10);

  enemyBullets.forEach((b) => (b.y += b.vy * dt));
  enemyBullets = enemyBullets.filter((b) => b.y < H + 10);

  // bullet vs axolotl
  bullets.forEach((b) => {
    axolotls.forEach((a) => {
      if (!a.alive || b.dead) return;
      if (rectHit(a.x, a.y, AXO_W, AXO_H, b.x, b.y, 4, 10)) {
        a.alive = false;
        b.dead = true;
        score += 10;
        scoreEl.textContent = score;
      }
    });
  });
  bullets = bullets.filter((b) => !b.dead);

  // enemy bullet vs player
  enemyBullets.forEach((b) => {
    if (b.dead) return;
    if (rectHit(player.x, player.y, player.w, player.h, b.x, b.y, 4, 10)) {
      b.dead = true;
      hitPlayer();
    }
  });
  enemyBullets = enemyBullets.filter((b) => !b.dead);

  if (axolotls.every((a) => !a.alive)) {
    axolotls = makeAxolotls();
  }
}

function hitPlayer() {
  lives -= 1;
  livesEl.textContent = lives;
  if (lives <= 0) endGame();
}

function rectHit(ax, ay, aw, ah, bx, by, bw, bh) {
  return (
    Math.abs(ax - bx) < (aw + bw) / 2 && Math.abs(ay - by) < (ah + bh) / 2
  );
}

function drawAxolotl(a) {
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.fillStyle = `hsl(${a.hue}, 85%, 72%)`;
  ctx.beginPath();
  ctx.ellipse(0, 0, AXO_W / 2, AXO_H / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  // gills
  ctx.fillStyle = `hsl(${a.hue}, 90%, 60%)`;
  [-1, 1].forEach((side) => {
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.ellipse(side * (AXO_W / 2 - 2), i * 6, 3, 5, side * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
  });
  // eyes
  ctx.fillStyle = "#1a0a12";
  ctx.beginPath();
  ctx.arc(-5, -3, 2, 0, Math.PI * 2);
  ctx.arc(5, -3, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);
  ctx.fillStyle = "#22d3ee";
  ctx.beginPath();
  ctx.moveTo(0, -player.h / 2);
  ctx.lineTo(player.w / 2, player.h / 2);
  ctx.lineTo(-player.w / 2, player.h / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#4ade80";
  ctx.fillRect(-3, -2, 6, 6);
  ctx.restore();
}

function draw() {
  ctx.clearRect(0, 0, W, H);

  axolotls.forEach((a) => a.alive && drawAxolotl(a));

  ctx.fillStyle = "#4ade80";
  bullets.forEach((b) => ctx.fillRect(b.x - 2, b.y - 5, 4, 10));

  ctx.fillStyle = "#f87171";
  enemyBullets.forEach((b) => ctx.fillRect(b.x - 2, b.y - 5, 4, 10));

  drawPlayer();
}

// controls: buttons
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

// keyboard
const keyState = {};
window.addEventListener("keydown", (e) => {
  keyState[e.key] = true;
  if (e.key === "ArrowLeft") moveLeft = true;
  if (e.key === "ArrowRight") moveRight = true;
  if (e.key === " ") {
    fireHeld = true;
    if (running) fire();
  }
});
window.addEventListener("keyup", (e) => {
  keyState[e.key] = false;
  if (e.key === "ArrowLeft") moveLeft = false;
  if (e.key === "ArrowRight") moveRight = false;
  if (e.key === " ") fireHeld = false;
});

// drag on canvas to move, tap to fire
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
player = { x: W / 2, y: H - 34, w: 26, h: 18, speed: 220 };
bullets = [];
enemyBullets = [];
axolotls = makeAxolotls();
score = 0;
lives = 3;
draw();
