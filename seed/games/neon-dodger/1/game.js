/* Neon Dodger — hand-authored CP1 seed game.
 * Dodge falling neon blocks; survive for score. Speaks the Yahaha postMessage protocol v1.
 * No external network (CSP connect-src 'none'); all rendering on a single canvas. */
(function () {
  "use strict";

  var SRC = "yahaha-game";
  var V = 1;
  function send(type, payload) {
    try {
      parent.postMessage({ source: SRC, v: V, type: type, payload: payload }, "*");
    } catch (e) {
      /* ignore */
    }
  }
  // Surface any uncaught error to the host as GAME_ERROR (→ failed card, never a blank frame).
  window.addEventListener("error", function (ev) {
    send("GAME_ERROR", { message: String((ev && ev.message) || "runtime error") });
  });

  var canvas = document.getElementById("c");
  var ctx = canvas.getContext("2d");
  var W = 0,
    H = 0,
    dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth;
    H = window.innerHeight;
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener("resize", resize);
  resize();

  var player, blocks, score, spawnTimer, speed, running, over, scoreClock, lastSentScore;
  var keys = { left: false, right: false };
  var pointerX = null;

  function reset() {
    player = { x: W / 2, y: 0, w: 26, h: 26, vx: 0 };
    blocks = [];
    score = 0;
    lastSentScore = -1;
    spawnTimer = 0;
    speed = 1;
    scoreClock = 0;
    running = true;
    over = false;
    pushScore(true);
    // Announce ready/resumed → host clears any ended/failed overlay and shows `loaded`.
    // Covers both first boot AND local restart (space/click) so host + game never desync.
    send("GAME_LOADED");
  }

  function pushScore(force) {
    if (force || score !== lastSentScore) {
      lastSentScore = score;
      send("GAME_SCORE", { score: score });
    }
  }

  // ---- input ----
  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = true;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = true;
    else if ((e.key === " " || e.key === "Enter") && over) reset();
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || e.key === " ") e.preventDefault();
  });
  window.addEventListener("keyup", function (e) {
    if (e.key === "ArrowLeft" || e.key === "a" || e.key === "A") keys.left = false;
    else if (e.key === "ArrowRight" || e.key === "d" || e.key === "D") keys.right = false;
  });
  window.addEventListener("pointerdown", function (e) {
    if (over) {
      reset();
      return;
    }
    pointerX = e.clientX;
  });
  window.addEventListener("pointermove", function (e) {
    if (e.buttons) pointerX = e.clientX;
  });
  window.addEventListener("pointerup", function () {
    pointerX = null;
  });

  // ---- host → game ----
  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.source !== "yahaha-host" || d.v !== 1) return;
    if (d.type === "HOST_RESTART") reset();
  });

  // ---- simulation ----
  function update(dt) {
    if (!running) return;
    speed += dt * 0.05;

    var ACC = 1100,
      MAXV = 460;
    if (keys.left) player.vx -= ACC * dt;
    if (keys.right) player.vx += ACC * dt;
    if (pointerX != null) player.vx += Math.sign(pointerX - player.x) * ACC * dt;
    player.vx *= 0.86;
    if (player.vx > MAXV) player.vx = MAXV;
    if (player.vx < -MAXV) player.vx = -MAXV;
    player.x += player.vx * dt;
    player.y = H - 64;
    if (player.x < player.w / 2) {
      player.x = player.w / 2;
      player.vx = 0;
    }
    if (player.x > W - player.w / 2) {
      player.x = W - player.w / 2;
      player.vx = 0;
    }

    spawnTimer += dt;
    var interval = Math.max(0.26, 0.82 - speed * 0.05);
    if (spawnTimer >= interval) {
      spawnTimer = 0;
      var bw = 24 + Math.random() * 48;
      blocks.push({
        x: Math.random() * (W - bw),
        y: -40,
        w: bw,
        h: 16 + Math.random() * 14,
        vy: 150 + speed * 46 + Math.random() * 70,
        hue: Math.random() < 0.5 ? "#FF3BA7" : "#27E0FF",
      });
    }

    var px = player.x - player.w / 2,
      py = player.y - player.h / 2;
    for (var i = blocks.length - 1; i >= 0; i--) {
      var b = blocks[i];
      b.y += b.vy * dt;
      if (b.y > H + 40) {
        blocks.splice(i, 1);
        score += 10;
        continue;
      }
      if (px < b.x + b.w && px + player.w > b.x && py < b.y + b.h && py + player.h > b.y) {
        gameOver();
        return;
      }
    }

    scoreClock += dt;
    if (scoreClock >= 0.5) {
      scoreClock -= 0.5;
      score += 1;
    }
    pushScore(false);
  }

  function gameOver() {
    running = false;
    over = true;
    pushScore(true);
    send("GAME_ENDED", { score: score });
  }

  // ---- render ----
  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function draw() {
    ctx.fillStyle = "#0c0a14";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(124,92,255,0.08)";
    ctx.lineWidth = 1;
    for (var gx = 0; gx < W; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, H);
      ctx.stroke();
    }

    for (var i = 0; i < blocks.length; i++) {
      var b = blocks[i];
      ctx.save();
      ctx.shadowColor = b.hue;
      ctx.shadowBlur = 14;
      ctx.fillStyle = b.hue;
      roundRect(b.x, b.y, b.w, b.h, 5);
      ctx.fill();
      ctx.restore();
    }

    ctx.save();
    ctx.shadowColor = "#c03bff";
    ctx.shadowBlur = 18;
    var g = ctx.createLinearGradient(
      player.x - 13,
      player.y - 13,
      player.x + 13,
      player.y + 13,
    );
    g.addColorStop(0, "#FF3BA7");
    g.addColorStop(1, "#C03BFF");
    ctx.fillStyle = g;
    roundRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h, 6);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#f4f1fa";
    ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("SCORE " + score, 14, 28);

    if (over) {
      ctx.fillStyle = "rgba(12,10,20,0.72)";
      ctx.fillRect(0, 0, W, H);
      ctx.textAlign = "center";
      ctx.fillStyle = "#f4f1fa";
      ctx.font = "800 30px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("GAME OVER", W / 2, H / 2 - 8);
      ctx.fillStyle = "#9d95b0";
      ctx.font = "500 14px ui-sans-serif, system-ui, sans-serif";
      ctx.fillText("空格 / 点击 重新开始", W / 2, H / 2 + 22);
      ctx.textAlign = "start";
    }
  }

  var lastT = 0;
  function loop(t) {
    if (!lastT) lastT = t;
    var dt = (t - lastT) / 1000;
    lastT = t;
    if (dt > 0.05) dt = 0.05;
    update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  // ---- boot ---- (reset() already emits GAME_LOADED)
  reset();
  requestAnimationFrame(loop);
})();
