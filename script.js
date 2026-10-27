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
  const soundToggleButton = document.getElementById("sound-toggle");
  const stormButton = document.getElementById("storm-button");
  const dashButton = document.getElementById("dash-button");
  const dashIndicator = document.getElementById("dash-indicator");
  const dashIndicatorValue = document.getElementById("dash-indicator-value");

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
  const DASH_COOLDOWN_MS = 5000;
  const DASH_DURATION_MS = 180;
  const DASH_DISTANCE = 205;
  const STORM_DURATION_MS = 10000;
  const WORLD_STARTED_AT = performance.now();
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
    nextLightningAt: WORLD_STARTED_AT + 12000,
    lastDirection: 1,
    dashStartedAt: 0,
    dashUntil: 0,
    dashReadyAt: 0,
    dashStartX: 0,
    dashTargetX: 0,
    stormActive: false,
    stormUsed: false,
    stormUntil: 0,
    nextStormLightningAt: 0,
    loopId: 0
  };

  const audioEngine = (() => {
    const AudioContextType = window.AudioContext || window.webkitAudioContext;
    let context = null;
    let masterGain = null;
    let musicGain = null;
    let effectsGain = null;
    let scheduler = 0;
    let nextStepTime = 0;
    let step = 0;
    let enabled = true;
    const tempo = 94;
    const stepLength = 60 / tempo / 4;
    const chords = [
      [220.00, 261.63, 329.63, 392.00],
      [174.61, 220.00, 261.63, 329.63],
      [130.81, 164.81, 196.00, 246.94],
      [196.00, 246.94, 293.66, 349.23]
    ];
    const bassNotes = [110.00, 87.31, 65.41, 98.00];

    function ensureContext() {
      if (!AudioContextType) return false;
      if (!context) {
        context = new AudioContextType();
        masterGain = context.createGain();
        musicGain = context.createGain();
        effectsGain = context.createGain();
        masterGain.gain.value = 0.78;
        musicGain.gain.value = 0.26;
        effectsGain.gain.value = 0.8;
        musicGain.connect(masterGain);
        effectsGain.connect(masterGain);
        masterGain.connect(context.destination);
      }
      if (context.state === "suspended") context.resume().catch(() => {});
      return true;
    }

    function tone(destination, frequency, time, duration, type, volume, endFrequency) {
      const oscillator = context.createOscillator();
      const envelope = context.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, time);
      if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(endFrequency, time + duration);
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), time + 0.018);
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      oscillator.connect(envelope);
      envelope.connect(destination);
      oscillator.start(time);
      oscillator.stop(time + duration + 0.03);
    }

    function noise(destination, time, duration, filterType, cutoff, volume) {
      const length = Math.max(1, Math.floor(context.sampleRate * duration));
      const buffer = context.createBuffer(1, length, context.sampleRate);
      const samples = buffer.getChannelData(0);
      for (let i = 0; i < length; i += 1) samples[i] = Math.random() * 2 - 1;
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      const envelope = context.createGain();
      source.buffer = buffer;
      filter.type = filterType;
      filter.frequency.value = cutoff;
      envelope.gain.setValueAtTime(0.0001, time);
      envelope.gain.exponentialRampToValueAtTime(Math.max(volume, 0.0002), time + Math.min(0.035, duration / 4));
      envelope.gain.exponentialRampToValueAtTime(0.0001, time + duration);
      source.connect(filter);
      filter.connect(envelope);
      envelope.connect(destination);
      source.start(time);
      source.stop(time + duration + 0.03);
    }

    function scheduleMusicStep(index, time) {
      const beat = index % 16;
      const bar = Math.floor(index / 16) % chords.length;
      if (beat === 0 || beat === 4 || beat === 8 || beat === 12) {
        tone(musicGain, 92, time, 0.20, "sine", 0.075, 43);
      }
      if (beat === 2 || beat === 6 || beat === 10 || beat === 14) {
        noise(musicGain, time, 0.045, "highpass", 6500, 0.018);
      }
      if (beat === 0 || beat === 8) {
        tone(musicGain, bassNotes[bar], time, 0.34, "triangle", 0.045, bassNotes[bar] * 0.985);
      }
      if (beat === 4 || beat === 12) {
        chords[bar].forEach((note, noteIndex) => {
          tone(musicGain, note, time, 0.48, "triangle", noteIndex === 0 ? 0.018 : 0.012);
        });
      }
      if (beat === 15 && bar % 2 === 1) {
        tone(musicGain, chords[bar][2] * 2, time, 0.16, "sine", 0.009);
      }
    }

    function start() {
      if (!enabled || !ensureContext()) return;
      if (context.state === "suspended") context.resume().catch(() => {});
      musicGain.gain.setTargetAtTime(1, context.currentTime, 0.12);
      if (scheduler) return;
      step = 0;
      nextStepTime = context.currentTime + 0.06;
      scheduler = window.setInterval(() => {
        if (!context || !enabled) return;
        while (nextStepTime < context.currentTime + 0.12) {
          scheduleMusicStep(step, nextStepTime);
          nextStepTime += stepLength;
          step = (step + 1) % 64;
        }
      }, 25);
    }

    function setEnabled(value) {
      enabled = value;
      if (!enabled) {
        if (scheduler) window.clearInterval(scheduler);
        scheduler = 0;
        if (context) musicGain.gain.setTargetAtTime(0, context.currentTime, 0.08);
        return;
      }
      start();
    }

    function playWaterCatch() {
      if (!enabled || !ensureContext()) return;
      const time = context.currentTime;
      tone(effectsGain, 740, time, 0.16, "sine", 0.13, 515);
      tone(effectsGain, 990, time + 0.045, 0.12, "sine", 0.07, 710);
      noise(effectsGain, time, 0.09, "lowpass", 1100, 0.035);
    }

    function playLightning() {
      if (!enabled || !ensureContext()) return;
      const time = context.currentTime;
      noise(effectsGain, time, 1.8, "lowpass", 190, 0.38);
      noise(effectsGain, time, 0.16, "highpass", 1800, 0.11);
      tone(effectsGain, 62, time + 0.08, 1.25, "sine", 0.11, 38);
    }

    return {
      get enabled() { return enabled; },
      start,
      setEnabled,
      playWaterCatch,
      playLightning
    };
  })();

  function updateSoundButton() {
    soundToggleButton.textContent = audioEngine.enabled ? "Sound: On" : "Sound: Off";
    soundToggleButton.setAttribute("aria-pressed", String(audioEngine.enabled));
  }

  function triggerLightning() {
    field.classList.add("lightning-active");
    audioEngine.playLightning();
    window.setTimeout(() => field.classList.remove("lightning-active"), 180);
    if (Math.random() < 0.42) {
      window.setTimeout(() => {
        field.classList.add("lightning-active");
        window.setTimeout(() => field.classList.remove("lightning-active"), 120);
      }, 260);
    }
  }

  function updateAbilityUI(now) {
    const remaining = Math.max(0, game.dashReadyAt - now);
    const progress = Math.max(0, Math.min(1, 1 - remaining / DASH_COOLDOWN_MS));
    dashIndicator.style.setProperty("--dash-progress", (progress * 100) + "%");
    dashButton.disabled = !game.running || remaining > 0;
    if (remaining > 0) {
      const seconds = Math.ceil(remaining / 1000);
      dashButton.textContent = "Dash (" + seconds + "s)";
      dashIndicatorValue.textContent = String(seconds);
      dashIndicator.setAttribute("aria-label", "Dash recharging, " + seconds + " seconds remaining");
    } else {
      dashButton.textContent = "Dash (Space)";
      dashIndicatorValue.textContent = "";
      dashIndicator.setAttribute("aria-label", "Dash ready");
    }

    stormButton.disabled = !game.running || game.stormUsed;
    if (game.stormActive) {
      const seconds = Math.max(1, Math.ceil((game.stormUntil - now) / 1000));
      stormButton.textContent = "Storm (" + seconds + "s)";
      stormButton.disabled = true;
    } else if (game.stormUsed) {
      stormButton.textContent = "Storm used";
    } else {
      stormButton.textContent = "Thunderstorm";
    }
  }

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
    game.stormActive = false;
    game.stormUsed = false;
    game.stormUntil = 0;
    game.dashUntil = 0;
    game.dashReadyAt = 0;
    field.classList.remove("storm-active");
    bucket.classList.remove("dashing");
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
    stormButton.disabled = true;
    dashButton.disabled = true;
    updateAbilityUI(performance.now());
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
    game.stormActive = false;
    game.stormUsed = false;
    game.stormUntil = 0;
    game.nextStormLightningAt = 0;
    game.dashStartedAt = 0;
    game.dashUntil = 0;
    game.dashReadyAt = 0;
    game.lastDirection = 1;
    field.classList.remove("storm-active");
    bucket.classList.remove("dashing");
    audioEngine.start();
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
    statusLabel.textContent = "Catch regular drops. Avoid polluted drops.";
    updateAbilityUI(performance.now());
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
    game.stormActive = false;
    game.stormUntil = 0;
    field.classList.remove("storm-active");
    bucket.classList.remove("dashing");
    game.dashUntil = 0;
    stormButton.disabled = true;
    dashButton.disabled = true;
    updateAbilityUI(performance.now());
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
    const isPolluted = !game.stormActive && Math.random() < POLLUTED_DROP_CHANCE;
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
    const phase = ((now - WORLD_STARTED_AT) % DAY_NIGHT_CYCLE_MS) / DAY_NIGHT_CYCLE_MS;
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
      triggerLightning();
      game.nextLightningAt = now + 10000 + Math.random() * 16000;
    }
  }

  function animateEnvironment(now) {
    updateDayNight(now);
    if (game.stormActive && now >= game.nextStormLightningAt) {
      lightningBolt.style.setProperty("--bolt-left", (20 + Math.random() * 60) + "%");
      triggerLightning();
      game.nextStormLightningAt = now + 1200 + Math.random() * 2200;
    }
    requestAnimationFrame(animateEnvironment);
  }

  function activateDash() {
    if (!game.running) return;
    const now = performance.now();
    if (now < game.dashReadyAt) return;

    let direction = game.leftHeld === game.rightHeld
      ? game.lastDirection
      : (game.rightHeld ? 1 : -1);
    const min = BUCKET_WIDTH / 2;
    const max = Math.max(min, field.clientWidth - BUCKET_WIDTH / 2);
    let target = Math.max(min, Math.min(max, game.bucketX + direction * DASH_DISTANCE));
    if (target === game.bucketX) {
      direction *= -1;
      target = Math.max(min, Math.min(max, game.bucketX + direction * DASH_DISTANCE));
    }

    game.lastDirection = direction;
    game.dashStartedAt = now;
    game.dashUntil = now + DASH_DURATION_MS;
    game.dashReadyAt = now + DASH_COOLDOWN_MS;
    game.dashStartX = game.bucketX;
    game.dashTargetX = target;
    bucket.classList.add("dashing");
    statusLabel.textContent = "Dash!";
    updateAbilityUI(now);
  }

  function activateStorm() {
    if (!game.running || game.stormUsed) return;
    const now = performance.now();
    game.stormUsed = true;
    game.stormActive = true;
    game.stormUntil = now + STORM_DURATION_MS;
    game.nextStormLightningAt = now + 900;
    field.classList.add("storm-active");
    for (let i = game.drops.length - 1; i >= 0; i -= 1) {
      if (game.drops[i].isPolluted) removeDrop(i);
    }
    triggerLightning();
    statusLabel.textContent = "Thunderstorm! Safe for 10 seconds. Polluted drops are paused.";
    updateAbilityUI(now);
  }

  function endStorm(now) {
    if (!game.stormActive) return;
    game.stormActive = false;
    game.stormUntil = 0;
    field.classList.remove("storm-active");
    if (game.running) statusLabel.textContent = "Storm ended. Watch for polluted drops again.";
    updateAbilityUI(now);
  }

  function frame(now, loopId) {
    if (!game.running || loopId !== game.loopId) return;
    const size = fieldSize();
    const delta = Math.min((now - game.lastFrame) / 1000, 0.04);
    game.lastFrame = now;

    if (game.dashUntil > 0 && now < game.dashUntil) {
      const progress = Math.min(1, (now - game.dashStartedAt) / DASH_DURATION_MS);
      game.bucketX = game.dashStartX + (game.dashTargetX - game.dashStartX) * progress;
    } else {
      if (game.dashUntil > 0) {
        game.bucketX = game.dashTargetX;
        game.dashUntil = 0;
        bucket.classList.remove("dashing");
      }
      let direction = 0;
      if (game.leftHeld) direction -= 1;
      if (game.rightHeld) direction += 1;
      game.bucketX += direction * BUCKET_SPEED * delta;
    }
    placeBucket();
    if (game.stormActive && now >= game.stormUntil) endStorm(now);
    updateAbilityUI(now);

    const seconds = Math.floor((now - game.startedAt) / 1000);
    if (seconds !== game.elapsedSeconds) {
      game.elapsedSeconds = seconds;
      timerLabel.textContent = formatTime(seconds);
    }
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
        if (!drop.isPolluted && !game.stormActive) {
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
      game.lastDirection = direction;
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
    if (event.code === "Space") {
      event.preventDefault();
      if (!event.repeat) activateDash();
      return;
    }
    if (key === "arrowleft" || key === "a") {
      event.preventDefault();
      game.leftHeld = true;
      game.lastDirection = -1;
    } else if (key === "arrowright" || key === "d") {
      event.preventDefault();
      game.rightHeld = true;
      game.lastDirection = 1;
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
  soundToggleButton.addEventListener("click", () => {
    audioEngine.setEnabled(!audioEngine.enabled);
    updateSoundButton();
  });
  stormButton.addEventListener("click", activateStorm);
  dashButton.addEventListener("click", activateDash);
  hold(leftButton, -1);
  hold(rightButton, 1);

  bestLabel.textContent = String(game.best);
  placeBucket();
  stormButton.disabled = true;
  dashButton.disabled = true;
  updateSoundButton();
  updateAbilityUI(performance.now());
  requestAnimationFrame(animateEnvironment);
})();