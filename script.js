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

  const BUCKET_WIDTH = 78;
  const BUCKET_HEIGHT = 55;
  const BUCKET_SPEED = 360;
  const DROP_WIDTH = 22;
  const DROP_HEIGHT = 28;
  const DROP_INTERVAL = 920;
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
    elapsedSeconds: 0
  };

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
    game.score = 0;
    game.elapsedSeconds = 0;
    game.running = true;
    game.startedAt = performance.now();
    game.lastFrame = game.startedAt;
    game.lastSpawn = game.startedAt;
    game.bucketX = field.clientWidth / 2;
    scoreLabel.textContent = "0";
    timerLabel.textContent = "0:00";
    bestLabel.textContent = String(game.best);
    startOverlay.classList.add("is-hidden");
    gameOverOverlay.classList.add("is-hidden");
    statusLabel.textContent = "Catch the falling drops!";
    placeBucket();
    requestAnimationFrame(frame);
  }

  function finishGame() {
    if (!game.running) return;
    game.running = false;
    game.leftHeld = false;
    game.rightHeld = false;
    finalScoreLabel.textContent = String(game.score);
    finalTimeLabel.textContent = formatTime(game.elapsedSeconds);
    gameOverOverlay.classList.remove("is-hidden");
    statusLabel.textContent = "Round over. You caught " + game.score + (game.score === 1 ? " drop." : " drops.");
    playAgainButton.focus();
  }

  function spawnDrop(now) {
    const size = fieldSize();
    const element = document.createElement("div");
    element.className = "drop";
    element.setAttribute("aria-hidden", "true");
    const x = 16 + Math.random() * Math.max(1, size.width - DROP_WIDTH - 32);
    const speed = 180 + Math.random() * 65;
    const drop = { x: x, y: -DROP_HEIGHT, speed: speed, element: element };
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

  function frame(now) {
    if (!game.running) return;
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

    if (now - game.lastSpawn >= DROP_INTERVAL) spawnDrop(now);

    const bucketY = size.height - 21 - 31 - BUCKET_HEIGHT;
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
        game.score += 1;
        updateScore();
        statusLabel.textContent = "Nice catch! " + game.score + (game.score === 1 ? " drop caught." : " drops caught.");
        continue;
      }

      if (drop.y + DROP_HEIGHT >= groundY) {
        finishGame();
        return;
      }
    }

    requestAnimationFrame(frame);
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