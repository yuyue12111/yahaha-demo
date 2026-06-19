/* Star Catcher — hand-authored CP2 seed game.
 * Move the catcher to catch falling stars; miss 3 and it's over. Speaks Yahaha postMessage v1.
 * No external network (CSP connect-src 'none'); single canvas. */
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

  var catcher, stars, score, lives, spawnTimer, speed, running, over, lastSentScore;
  var keys = { left: false, right: false };
  var pointerX = null;

  function reset() {
    catcher = { x: W / 2, y: 0, w: 84, h: 14, vx: 0 };
    stars = [];
    score = 0;
    lives = 3;
    lastSentScore = -1;
    spawnTimer = 0;
    speed = 1;
    running = true;
    over = false;
    pushScore(true);
    // Announce ready/resumed → host clears any overlay (boot + restart both go through here).
    send("GAME_LOADED");
  }

  function pushScore(force) {
    if (force || score !== lastSentScore) {
      lastSentScore = score;
      send("GAME_SCORE", { score: score });
    }
  }

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

  window.addEventListener("message", function (e) {
    var d = e.data;
    if (!d || d.source !== "yahaha-host" || d.v !== 1) return;
    if (d.type === "HOST_RESTART") reset();
  });

  function update(dt) {
    if (!running) return;
    speed += dt * 0.04;

    var ACC = 1300,
      MAXV = 560;
    if (keys.left) catcher.vx -= ACC * dt;
    if (keys.right) catcher.vx += ACC * dt;
    if (pointerX != null) catcher.vx += Math.sign(pointerX - catcher.x) * ACC * dt;
    catcher.vx *= 0.86;
    if (catcher.vx > MAXV) catcher.vx = MAXV;
    if (catcher.vx < -MAXV) catcher.vx = -MAXV;
    catcher.x += catcher.vx * dt;
    catcher.y = H - 54;
    if (catcher.x < catcher.w / 2) {
      catcher.x = catcher.w / 2;
      catcher.vx = 0;
    }
    if (catcher.x > W - catcher.w / 2) {
      catcher.x = W - catcher.w / 2;
      catcher.vx = 0;
    }

    spawnTimer += dt;
    var interval = Math.max(0.45, 1.1 - speed * 0.06);
    if (spawnTimer >= interval) {
      spawnTimer = 0;
      stars.push({
        x: 18 + Math.random() * (W - 36),
        y: -20,
        r: 11 + Math.random() * 5,
        vy: 130 + speed * 40 + Math.random() * 50,
        spin: Math.random() * Math.PI,
      });
    }

    var cx = catcher.x - catcher.w / 2,
      cy = catcher.y - catcher.h / 2;
    for (var i = stars.length - 1; i >= 0; i--) {
      var s = stars[i];
      s.y += s.vy * dt;
      s.spin += dt * 3;
      // caught?
      if (s.y + s.r >= cy && s.y - s.r <= cy + catcher.h && s.x >= cx - 6 && s.x <= cx + catcher.w + 6) {
        stars.splice(i, 1);
        score += 5;
        continue;
      }
      // missed (fell past bottom)
      if (s.y - s.r > H) {
        stars.splice(i, 1);
        lives -= 1;
        if (lives <= 0) {
          gameOver();
          return;
        }
      }
    }
    pushScore(false);
  }

  function gameOver() {
    running = false;
    over = true;
    pushScore(true);
    send("GAME_ENDED", { score: score });
  }

  function drawStar(x, y, r, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot);
    ctx.beginPath();
    for (var k = 0; k < 5; k++) {
      var a = (k * 2 * Math.PI) / 5 - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      var a2 = a + Math.PI / 5;
      ctx.lineTo(Math.cos(a2) * r * 0.45, Math.sin(a2) * r * 0.45);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function draw() {
    ctx.fillStyle = "#0c0a14";
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = "rgba(124,92,255,0.08)";
    ctx.lineWidth = 1;
    for (var gy = 0; gy < H; gy += 40) {
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(W, gy);
      ctx.stroke();
    }

    for (var i = 0; i < stars.length; i++) {
      var s = stars[i];
      ctx.save();
      ctx.shadowColor = "#27e0ff";
      ctx.shadowBlur = 14;
      ctx.fillStyle = "#27e0ff";
      drawStar(s.x, s.y, s.r, s.spin);
      ctx.restore();
    }

    // catcher (magenta→purple bar)
    ctx.save();
    ctx.shadowColor = "#c03bff";
    ctx.shadowBlur = 16;
    var g = ctx.createLinearGradient(catcher.x - 42, 0, catcher.x + 42, 0);
    g.addColorStop(0, "#FF3BA7");
    g.addColorStop(1, "#C03BFF");
    ctx.fillStyle = g;
    var bx = catcher.x - catcher.w / 2,
      by = catcher.y - catcher.h / 2;
    ctx.beginPath();
    var rr = 7;
    ctx.moveTo(bx + rr, by);
    ctx.arcTo(bx + catcher.w, by, bx + catcher.w, by + catcher.h, rr);
    ctx.arcTo(bx + catcher.w, by + catcher.h, bx, by + catcher.h, rr);
    ctx.arcTo(bx, by + catcher.h, bx, by, rr);
    ctx.arcTo(bx, by, bx + catcher.w, by, rr);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#f4f1fa";
    ctx.font = "700 16px ui-sans-serif, system-ui, sans-serif";
    ctx.fillText("SCORE " + score, 14, 28);
    ctx.textAlign = "right";
    ctx.fillText("♥ " + lives, W - 14, 28);
    ctx.textAlign = "start";

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
