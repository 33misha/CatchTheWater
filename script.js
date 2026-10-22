(() => {
  "use strict";

  const field = document.getElementById("game-field");
  const bucket = document.getElementById("bucket");
  const scoreLabel = document.getElementById("score");
  const timerLabel = document.getElementById("timer");
  const bestLabel = document.getElementById("best-score");
  const statusLabel = document.getElementById("game-status");
  const startOverlay = document.getElementById("start-overlay");
  const gameOverOverlay = document.getElementById("game-over-overlay");
  const finalScoreLabel = document.getElementById("final-score");
  const finalTimeLabel = document.getElementById("final-time");
  const playButton = document.getElementById("play-button");
  const playAgainButton = document.getElementById("play-again-button");
  const resetButton = document.getElementById("reset-button");
  const leftButton = document.getElementById("left-button");
  const rightButton = document.getElementById("right-button");
  const lightningBolt = document.getElementById("lightning-bolt");

  const BUCKET_WIDTH = 78;
  const BUCKET_HEIGHT = 55;
  const BUCKET_SPEED = 360;
  const DROP_WIDTH = 22;
  const DROP_HEIGHT = 28;
  const DROP_INTERVAL = 2000;
  const DROP_SPEED = 300;
  const POLLUTED_DROP_CHANCE = 1 / 8;
  const REACTION_BUFFER = 0.25;
  const DAY_NIGHT_CYCLE_MS = 120000;
  const BEST_KEY = "catchTheWaterBestScore";

  const game = {
    running: false,
    score: 0,
    best: readBestScore(),
    bucketX: 0,
    drops: [],
    leftHeld: false,
    rightHeld: false,
    lastFrame: 0,
    lastSpawn: 0,
    startedAt: 0,
    elapsedSeconds: 0,
    bestAtStart: 0,
    nextLightningAt: 0,
    loopId: 0
  };

  document.querySelectorAll(".water-icon").forEach((icon) => {
    icon.textContent = "";
  });

  function readBestScore() {
    try {
      return Number(window.localStorage.getItem(BEST_KEY)) || 0;
    } catch (error) {
      return 0;
    }
  }

  function saveBestScore() {
    try {
      window.localStorage.setItem(BEST_KEY, String(game.best));
    } catch (error) {
      // The game still works if browser storage is unavailable.
    }
  }

  function formatTime(totalSeconds) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function fieldSize() {
    return {
      width: field.clientWidth,
      height: field.clientHeight
    };
  }

  function placeBucket() {
    const size = fieldSize();
    const min = BUCKET_WIDTH / 2;
    const max = Math.max(min, size.width - BUCKET_WIDTH / 2);
    game.bucketX = Math.max(min, Math.min(max, game.bucketX));
    bucket.style.left = game.bucketX + "px";
  }

  function clearDrops() {
    game.drops.forEach((drop) => drop.element.remove());
    game.drops = [];
  }

  function clearConfetti() {
    field.querySelectorAll(".confetti").forEach((piece) => piece.remove());
  }

  function updateScore() {
    scoreLabel.textContent = String(game.score);
    if (game.score > game.best) {
      game.best = game.score;
      bestLabel.textContent = String(game.best);
      saveBestScore();
    }
  }

  function resetToStart() {
    game.running = false;
    game.loopId += 1;
    clearConfetti();
    field.classList.remove("lightning-active");
    game.leftHeld = false;
    game.rightHeld = false;
    clearDrops();
    game.score = 0;
    game.elapsedSeconds = 0;
    scoreLabel.textContent = "0";
    timerLabel.textContent = "0:00";
    startOverlay.classList.remove("is-hidden");
    gameOverOverlay.classList.add("is-hidden");
    statusLabel.textContent = "Press Play to start.";
    placeBucket();
  }

  function startGame() {
    clearDrops();
    clearConfetti();
    game.score = 0;
    game.elapsedSeconds = 0;
    game.bestAtStart = game.best;
    game.running = true;
    game.startedAt = performance.now();
    game.nextLightningAt = game.startedAt + 12000;
    field.classList.remove("lightning-active");
    game.lastFrame = game.startedAt;
    game.lastSpawn = game.startedAt;
    game.bucketX = field.clientWidth / 2;
    game.loopId += 1;
    const loopId = game.loopId;
    scoreLabel.textContent = "0";
    timerLabel.textContent = "0:00";
    bestLabel.textContent = String(game.best);
    startOverlay.classList.add("is-hidden");
    gameOverOverlay.classList.add("is-hidden");
    statusLabel.textContent = "Catch the falling drops!";
    placeBucket();
    requestAnimationFrame((now) => frame(now, loopId));
  }

  function celebrateBestScore() {
    const colors = ["#FFC907", "#2E9DF7", "#8BD1CB", "#FF902A"];
    for (let i = 0; i < 32; i += 1) {
      const piece = document.createElement("span");
      piece.className = "confetti";
      piece.setAttribute("aria-hidden", "true");
      piece.style.left = (3 + Math.random() * 94) + "%";
      piece.style.setProperty("--confetti-color", colors[i % colors.length]);
      piece.style.setProperty("--confetti-delay", Math.floor(Math.random() * 260) + "ms");
      piece.style.setProperty("--confetti-rotation", Math.floor(Math.random() * 540 - 270) + "deg");
      field.appendChild(piece);
      window.setTimeout(() => piece.remove(), 2300);
    }
  }

  function finishGame() {
    if (!game.running) return;
    game.running = false;
    game.loopId += 1;
    field.classList.remove("lightning-active");
    game.leftHeld = false;
    game.rightHeld = false;
    finalScoreLabel.textContent = String(game.score);
    finalTimeLabel.textContent = formatTime(game.elapsedSeconds);
    gameOverOverlay.classList.remove("is-hidden");
    if (game.best > game.bestAtStart) {
      document.getElementById("game-over-title").textContent = "New personal best!";
      statusLabel.textContent = "New personal best: " + game.best + (game.best === 1 ? " point!" : " points!");
      celebrateBestScore();
    } else {
      document.getElementById("game-over-title").textContent = "Nice try!";
      statusLabel.textContent = "Round over. Final score: " + game.score + (game.score === 1 ? " point." : " points.");
    }
    playAgainButton.focus();
  }

  function spawnDrop(now) {
    const size = fieldSize();
    const speed = DROP_SPEED;
    const bucketY = size.height - 21 - BUCKET_HEIGHT;
    const timeToCatch = Math.max(0, bucketY / speed - REACTION_BUFFER);
    const maxTravelDistance = BUCKET_SPEED * timeToCatch;
    const horizontalCatchOverlap = (BUCKET_WIDTH + DROP_WIDTH) / 2 - 5;
    const minSpawnX = 16;
    const maxSpawnX = Math.max(minSpawnX, size.width - DROP_WIDTH - 16);
    // Reach = movement speed × usable fall time, plus the bucket/drop overlap.
    const reachableMinX = game.bucketX - maxTravelDistance - horizontalCatchOverlap - DROP_WIDTH / 2;
    const reachableMaxX = game.bucketX + maxTravelDistance + horizontalCatchOverlap - DROP_WIDTH / 2;
    const left = Math.max(minSpawnX, reachableMinX);
    const right = Math.max(left, Math.min(maxSpawnX, reachableMaxX));
    const x = left + Math.random() * (right - left);
    const isPolluted = Math.random() < POLLUTED_DROP_CHANCE;
    const element = document.createElement("div");
    element.className = isPolluted ? "drop polluted-drop" : "drop";
    element.setAttribute("aria-hidden", "true");
    const drop = { x: x, y: -DROP_HEIGHT, speed: speed, isPolluted: isPolluted, element: element };
    element.style.left = x + "px";
    element.style.top = drop.y + "px";
    field.appendChild(element);
    game.drops.push(drop);
    game.lastSpawn = now;
  }

  function removeDrop(index) {
    game.drops[index].element.remove();
    game.drops.splice(index, 1);
  }

  const SKY_STOPS = [
    { at: 0, top: [142, 213, 255], bottom: [46, 157, 247] },
    { at: 0.30, top: [94, 186, 238], bottom: [35, 144, 221] },
    { at: 0.50, top: [244, 172, 131], bottom: [211, 106, 93] },
    { at: 0.68, top: [43, 60, 96], bottom: [13, 26, 49] },
    { at: 0.88, top: [20, 28, 51], bottom: [8, 15, 30] },
    { at: 1, top: [142, 213, 255], bottom: [46, 157, 247] }
  ];

  function toRgb(color) {
    return "rgb(" + color.map((channel) => Math.round(channel)).join(", ") + ")";
  }

  function mixColor(a, b, amount) {
    return a.map((value, index) => value + (b[index] - value) * amount);
  }

  function updateDayNight(now) {
    const phase = ((now - game.startedAt) % DAY_NIGHT_CYCLE_MS) / DAY_NIGHT_CYCLE_MS;
    let left = SKY_STOPS[0];
    let right = SKY_STOPS[SKY_STOPS.length - 1];
    for (let i = 0; i < SKY_STOPS.length - 1; i += 1) {
      if (phase >= SKY_STOPS[i].at && phase <= SKY_STOPS[i + 1].at) {
        left = SKY_STOPS[i];
        right = SKY_STOPS[i + 1];
        break;
      }
    }
    const amount = (phase - left.at) / (right.at - left.at || 1);
    field.style.setProperty("--sky-top", toRgb(mixColor(left.top, right.top, amount)));
    field.style.setProperty("--sky-bottom", toRgb(mixColor(left.bottom, right.bottom, amount)));

    let nightness = 0;
    if (phase > 0.5 && phase < 0.72) {
      const t = (phase - 0.5) / 0.22;
      nightness = t * t * (3 - 2 * t);
    } else if (phase >= 0.72 && phase <= 0.88) {
      nightness = 1;
    } else if (phase > 0.88) {
      const t = (phase - 0.88) / 0.12;
      const smooth = t * t * (3 - 2 * t);
      nightness = 1 - smooth;
    }
    field.style.setProperty("--sun-opacity", String(1 - nightness));
    field.style.setProperty("--moon-opacity", String(nightness));
    field.style.setProperty("--stars-opacity", String(nightness));

    if (nightness > 0.82 && now >= game.nextLightningAt) {
      lightningBolt.style.setProperty("--bolt-left", (28 + Math.random() * 44) + "%");
      field.classList.add("lightning-active");
      window.setTimeout(() => {
        if (game.running) field.classList.remove("lightning-active");
      }, 170);
      if (Math.random() < 0.45) {
        window.setTimeout(() => {
          if (!game.running) return;
          field.classList.add("lightning-active");
          window.setTimeout(() => {
            if (game.running) field.classList.remove("lightning-active");
          }, 110);
        }, 240);
      }
      game.nextLightningAt = now + 8000 + Math.random() * 12000;
    }
  }

  function frame(now, loopId) {
    if (!game.running || loopId !== game.loopId) return;
    const size = fieldSize();
    const delta = Math.min((now - game.lastFrame) / 1000, 0.04);
    game.lastFrame = now;

    let direction = 0;
    if (game.leftHeld) direction -= 1;
    if (game.rightHeld) direction += 1;
    game.bucketX += direction * BUCKET_SPEED * delta;
    placeBucket();

    const seconds = Math.floor((now - game.startedAt) / 1000);
    if (seconds !== game.elapsedSeconds) {
      game.elapsedSeconds = seconds;
      timerLabel.textContent = formatTime(seconds);
    }
    updateDayNight(now);

    if (now - game.lastSpawn >= DROP_INTERVAL) spawnDrop(now);

    const bucketY = size.height - 21 - BUCKET_HEIGHT;
    const groundY = size.height - 21;

    for (let i = game.drops.length - 1; i >= 0; i -= 1) {
      const drop = game.drops[i];
      drop.y += drop.speed * delta;
      drop.element.style.top = drop.y + "px";

      const dropCenter = drop.x + DROP_WIDTH / 2;
      const caughtHorizontally = Math.abs(dropCenter - game.bucketX) <= (BUCKET_WIDTH + DROP_WIDTH) / 2 - 5;
      const reachedBucket = drop.y + DROP_HEIGHT >= bucketY && drop.y < bucketY + BUCKET_HEIGHT;

      if (caughtHorizontally && reachedBucket) {
        removeDrop(i);
        if (drop.isPolluted) {
          game.score = Math.max(0, game.score - 1);
          updateScore();
          statusLabel.textContent = "Polluted drop! -1 point. Score: " + game.score + ".";
        } else {
          game.score += 1;
          updateScore();
          statusLabel.textContent = "Water drop +1. Score: " + game.score + ".";
        }
        continue;
      }

      if (drop.y + DROP_HEIGHT >= groundY) {
        removeDrop(i);
        if (!drop.isPolluted) {
          finishGame();
          return;
        }
      }
    }

    requestAnimationFrame((nextTime) => frame(nextTime, loopId));
  }

  function hold(button, direction) {
    const start = (event) => {
      event.preventDefault();
      if (!game.running) return;
      if (direction < 0) game.leftHeld = true;
      if (direction > 0) game.rightHeld = true;
      if (button.setPointerCapture && event.pointerId !== undefined) {
        button.setPointerCapture(event.pointerId);
      }
    };
    const stop = () => {
      if (direction < 0) game.leftHeld = false;
      if (direction > 0) game.rightHeld = false;
    };

    button.addEventListener("pointerdown", start);
    button.addEventListener("pointerup", stop);
    button.addEventListener("pointercancel", stop);
    button.addEventListener("lostpointercapture", stop);
    window.addEventListener("pointerup", stop);
  }

  document.addEventListener("keydown", (event) => {
    if (!game.running) return;
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      game.leftHeld = true;
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      game.rightHeld = true;
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = event.key.toLowerCase();
    if (key === "arrowleft" || key === "a") game.leftHeld = false;
    if (key === "arrowright" || key === "d") game.rightHeld = false;
  });

  window.addEventListener("blur", () => {
    game.leftHeld = false;
    game.rightHeld = false;
  });

  window.addEventListener("resize", placeBucket);
  playButton.addEventListener("click", startGame);
  playAgainButton.addEventListener("click", startGame);
  resetButton.addEventListener("click", resetToStart);
  hold(leftButton, -1);
  hold(rightButton, 1);

  bestLabel.textContent = String(game.best);
  placeBucket();
})();