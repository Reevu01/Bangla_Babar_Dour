// ============================================================
//  DHAKA DASH — Bangladesh-themed Endless Runner
//  Race through the streets of Dhaka, dodging rickshaws, CNGs,
//  tea stalls, potholes, cows, and construction barriers.
//  Built with vanilla Canvas API — no dependencies.
// ============================================================

(function () {
  "use strict";

  // ===== CANVAS & CONTEXT =====
  // Pixel-art scaling: render at half resolution, then upscale
  const PIXEL_SCALE = 2;
  const canvas = document.getElementById("gameCanvas");

  // Size the canvas to fill the window
  function resizeCanvas() {
    const wrapper = document.getElementById("game-wrapper");
    canvas.width = wrapper.clientWidth;
    canvas.height = wrapper.clientHeight;
  }
  resizeCanvas();
  let displayW = canvas.width;
  let displayH = canvas.height;
  let W = Math.floor(displayW / PIXEL_SCALE);
  let H = Math.floor(displayH / PIXEL_SCALE);

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Offscreen low-res canvas for the pixelated look
  const offCanvas = document.createElement("canvas");
  offCanvas.width = W;
  offCanvas.height = H;
  const ctx = offCanvas.getContext("2d");

  // Display canvas context (scales up the low-res render)
  let displayCtx = canvas.getContext("2d");
  displayCtx.imageSmoothingEnabled = false;

  // ===== DOM REFERENCES =====
  const homeScreen = document.getElementById("home-screen");
  const gameoverScreen = document.getElementById("gameover-screen");
  const orientationOverlay = document.getElementById("orientation-overlay");
  const hud = document.getElementById("hud");
  const hudScore = document.getElementById("hud-score");
  const hudHighscore = document.getElementById("hud-highscore");
  const homeHighscore = document.getElementById("home-highscore");
  const finalScoreEl = document.getElementById("final-score");
  const goHighscoreEl = document.getElementById("gameover-highscore");

  // ===== GAME CONFIGURATION =====
  // Adjust these values to customize gameplay feel
  const CONFIG = {
    // Ground (positioned relative to canvas height)
    groundY: H - 40, // Y position of the ground line
    groundHeight: 40, // Height of the ground area

    // Player — rickshaw runner character
    playerX: 60, // Fixed X position of the player
    playerWidth: 46, // Tuned for balanced on-screen proportion
    playerHeight: 56, // Tuned for balanced on-screen proportion
    playerDuckHeight: 34, // Height when ducking
    playerColor: "#006a4e", // Bangladesh green

    // Chased character — runs ahead (the person to catch)
    chaserX: Math.floor(W * 0.55), // Closer to player
    chaserWidth: 43,
    chaserHeight: 53,
    chaserColor: "#f42a41", // Bangladesh red

    // Jump physics (short arc, long airtime)
    jumpForce: -5.5, // Initial upward velocity on jump (lower = shorter peak)
    gravity: 0.18, // Downward acceleration per frame (low = floaty)
    maxFallSpeed: 5, // Terminal velocity
    jumpHoldFrames: 10, // Max frames to extend upward force while jump key is held
    jumpHoldBoost: -0.12, // Extra upward acceleration while holding jump

    // Scrolling & difficulty — SLOWER PACED (halved for pixel scale)
    baseSpeed: 1.3, // Starting scroll speed (pixels/frame)
    maxSpeed: 3.5, // Maximum scroll speed
    speedIncrement: 0.00015, // Speed increase per frame (very gradual)

    // Obstacles — generous spacing (scaled responsively)
    minObstacleGap: 175, // Minimum distance between consecutive obstacles
    maxObstacleGap: 300, // Maximum gap (shrinks with difficulty)

    // Scoring
    scoreRate: 0.03, // Score added per frame (multiplied by speed)

    // Parallax background layers
    bgCloudCount: 8, // Number of background clouds
    bgBuildingCount: 8, // Number of Dhaka building silhouettes
    bgPalmCount: 5, // Palm trees in mid-ground
  };

  const MOBILE_GROUND_DROP_FRACTION = 0.05;
  const CINEMATIC_FRAME_RATIO = 932 / 430;
  const NON_MOBILE_CHARACTER_SCALE_BOOST = 1.08;
  const MOBILE_OBSTACLE_SCALE_BOOST = 1.08;
  const TARGET_FPS = 60;
  const FIXED_FRAME_MS = 1000 / TARGET_FPS;
  const MAX_DT_MULTIPLIER = 2.2;

  function isMobileDevice() {
    return window.matchMedia("(pointer: coarse)").matches;
  }

  function applyGroundYForDevice() {
    const baseGroundY = H - CONFIG.groundHeight;
    const mobileDrop = isMobileDevice()
      ? Math.round(H * MOBILE_GROUND_DROP_FRACTION)
      : 0;
    // Keep a small visible ground strip inside the viewport.
    CONFIG.groundY = Math.min(baseGroundY + mobileDrop, H - 6);
  }

  function syncWorldScale() {
    const isMobile = isMobileDevice();
    const characterScale = isMobile ? 1 : NON_MOBILE_CHARACTER_SCALE_BOOST;

    // If framing ever diverges from target ratio, keep sizing anchored to width first.
    const frameCompensation = clamp(W / H / CINEMATIC_FRAME_RATIO, 0.92, 1.08);

    CONFIG.groundHeight = clamp(
      Math.round(H * 0.16 * frameCompensation),
      34,
      72,
    );
    applyGroundYForDevice();

    // Character framing follows normalized composition from issue2.png.
    CONFIG.playerX = clamp(Math.round(W * 0.105), 36, 170);
    CONFIG.playerHeight = clamp(
      Math.round(H * 0.118 * characterScale),
      50,
      104,
    );
    CONFIG.playerWidth = clamp(
      Math.round(CONFIG.playerHeight * (46 / 56)),
      36,
      84,
    );
    CONFIG.playerDuckHeight = clamp(
      Math.round(CONFIG.playerHeight * 0.62),
      26,
      48,
    );

    CONFIG.chaserHeight = clamp(Math.round(H * 0.106 * characterScale), 44, 93);
    CONFIG.chaserWidth = clamp(
      Math.round(CONFIG.chaserHeight * (43 / 53)),
      34,
      76,
    );
    CONFIG.chaserX = clamp(
      Math.round(W * 0.56),
      CONFIG.playerX + CONFIG.playerWidth + Math.round(W * 0.18),
      W - Math.round(W * 0.14),
    );

    CONFIG.minObstacleGap = clamp(Math.round(W * 0.19), 120, 300);
    CONFIG.maxObstacleGap = clamp(Math.round(W * 0.32), 200, 430);
  }

  function handleViewportChange() {
    resizeCanvas();
    displayW = canvas.width;
    displayH = canvas.height;
    W = Math.floor(displayW / PIXEL_SCALE);
    H = Math.floor(displayH / PIXEL_SCALE);
    offCanvas.width = W;
    offCanvas.height = H;

    syncWorldScale();

    player.x = CONFIG.playerX;
    player.width = CONFIG.playerWidth;
    if (!player.isDucking) {
      player.height = CONFIG.playerHeight;
    } else {
      player.height = CONFIG.playerDuckHeight;
    }
    player.y = CONFIG.groundY - player.height;

    chaser.width = CONFIG.chaserWidth;
    chaser.height = CONFIG.chaserHeight;
    chaser.x = CONFIG.chaserX;
    chaser.y = CONFIG.groundY - chaser.height;

    displayCtx = canvas.getContext("2d");
    displayCtx.imageSmoothingEnabled = false;
    generateBackground();

    if (gameState !== "playing") draw();
  }

  window.addEventListener("resize", handleViewportChange);

  // Apply responsive baseline before entities are initialized.
  syncWorldScale();

  // ===== GAME STATE =====
  let gameState = "home"; // 'home' | 'playing' | 'gameover'
  let score = 0;
  let highScore = loadHighScore();
  let speed = CONFIG.baseSpeed;
  let animFrame = null;
  let frameCount = 0;
  let lastTimestamp = 0;

  // ===== INPUT STATE =====
  const keys = {};
  let queuedMobileJumps = 0;
  let queuedMobileDucks = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchGestureConsumed = false;
  let orientationBlocked = false;

  // ===== PLAYER OBJECT =====
  // To add a sprite: set player.sprite = new Image(); player.sprite.src = '...'
  const player = {
    x: CONFIG.playerX,
    y: CONFIG.groundY - CONFIG.playerHeight,
    width: CONFIG.playerWidth,
    height: CONFIG.playerHeight,
    vy: 0,
    isJumping: false,
    jumpCount: 0,
    jumpHoldFrames: 0,
    jumpKeyWasDown: false,
    isDucking: false,
    sprite: null,
    legFrame: 0,
  };

  // ===== CHASED CHARACTER =====
  const chaser = {
    x: CONFIG.chaserX,
    y: CONFIG.groundY - CONFIG.chaserHeight,
    width: CONFIG.chaserWidth,
    height: CONFIG.chaserHeight,
    bobOffset: 0,
    sprite: null,
    legFrame: 0,
  };

  // ===== OBSTACLES =====
  let obstacles = [];
  let obstaclePool = [];
  let nextObstacleX = W + 100;

  // ===== BACKGROUND LAYERS =====
  let clouds = [];
  let buildings = [];
  let palms = [];
  let groundOffset = 0;

  // ===== SPRITE / IMAGE ASSETS =====
  // Player (being chased) — two running frames
  const chase1 = new Image();
  chase1.src = "chase1.png";
  const chase2 = new Image();
  chase2.src = "chase2.png";
  let chaseSpritesReady = 0;
  chase1.onload = () => {
    chaseSpritesReady++;
  };
  chase2.onload = () => {
    chaseSpritesReady++;
  };

  // Chaser — two running frames
  const chaserImg1 = new Image();
  chaserImg1.src = "chaser1.png";
  const chaserImg2 = new Image();
  chaserImg2.src = "chaser2.png";
  let chaserSpritesReady = 0;
  chaserImg1.onload = () => {
    chaserSpritesReady++;
  };
  chaserImg2.onload = () => {
    chaserSpritesReady++;
  };

  // Player jump sprite (used while airborne)
  const jumpImg = new Image();
  jumpImg.src = "jump.png";
  let jumpSpriteReady = false;
  jumpImg.onload = () => {
    jumpSpriteReady = true;
  };

  const bgImage = new Image();
  bgImage.src = "bg.png";
  let bgImageReady = false;
  bgImage.onload = () => {
    bgImageReady = true;
  };
  let bgScrollX = 0;

  // ===== AUDIO ASSETS =====
  const gameplayMusic = new Audio("gameplay.mp3");
  gameplayMusic.loop = true;
  gameplayMusic.preload = "auto";
  gameplayMusic.volume = 0.5;

  const outroMusic = new Audio("outro.mp3");
  outroMusic.loop = true;
  outroMusic.preload = "auto";
  outroMusic.volume = 0.5;

  const jumpSfx = new Audio("jump.mp3");
  jumpSfx.preload = "auto";
  jumpSfx.volume = 0.65;

  const obstacleHitSfx = new Audio("obstacle_hit.mp3");
  obstacleHitSfx.preload = "auto";
  obstacleHitSfx.volume = 0.8;

  let audioUnlocked = false;
  let jumpSfxIndex = 0;
  let obstacleSfxIndex = 0;
  const jumpSfxPool = Array.from({ length: 4 }, () => {
    const a = new Audio("jump.mp3");
    a.preload = "auto";
    a.volume = jumpSfx.volume;
    return a;
  });
  const obstacleSfxPool = Array.from({ length: 2 }, () => {
    const a = new Audio("obstacle_hit.mp3");
    a.preload = "auto";
    a.volume = obstacleHitSfx.volume;
    return a;
  });

  function safePlay(audio) {
    const p = audio.play();
    if (p && typeof p.catch === "function") {
      p.catch(() => {});
    }
  }

  function primeAudioElement(audio) {
    const previousMuted = audio.muted;
    audio.muted = true;
    const p = audio.play();
    if (p && typeof p.then === "function") {
      p.then(() => {
        audio.pause();
        audio.currentTime = 0;
        audio.muted = previousMuted;
      }).catch(() => {
        audio.muted = previousMuted;
      });
      return;
    }
    audio.pause();
    audio.currentTime = 0;
    audio.muted = previousMuted;
  }

  function unlockAudio() {
    if (audioUnlocked) return;
    audioUnlocked = true;
    const allAudio = [
      gameplayMusic,
      outroMusic,
      jumpSfx,
      obstacleHitSfx,
      ...jumpSfxPool,
      ...obstacleSfxPool,
    ];
    for (const audio of allAudio) {
      primeAudioElement(audio);
    }
  }

  function stopAudio(audio) {
    audio.pause();
    audio.currentTime = 0;
  }

  function startGameplayMusic() {
    stopAudio(outroMusic);
    stopAudio(gameplayMusic);
    safePlay(gameplayMusic);
  }

  function startOutroMusic() {
    stopAudio(gameplayMusic);
    stopAudio(outroMusic);
    safePlay(outroMusic);
  }

  function stopAllMusic() {
    stopAudio(gameplayMusic);
    stopAudio(outroMusic);
  }

  function playJumpSfx() {
    const snd = jumpSfxPool[jumpSfxIndex % jumpSfxPool.length];
    jumpSfxIndex += 1;
    snd.currentTime = 0;
    safePlay(snd);
  }

  function playObstacleHitSfx() {
    const snd = obstacleSfxPool[obstacleSfxIndex % obstacleSfxPool.length];
    obstacleSfxIndex += 1;
    snd.currentTime = 0;
    safePlay(snd);
  }

  // Obstacle sprites — 3 images mapped to 6 obstacle types
  const obstacleImg1 = new Image();
  obstacleImg1.src = "obstacle1.png";
  const obstacleImg2 = new Image();
  obstacleImg2.src = "obstacle2.png";
  const obstacleImg3 = new Image();
  obstacleImg3.src = "obstacle3.png";
  let obstacleSpriteCount = 0;
  obstacleImg1.onload = () => {
    obstacleSpriteCount++;
  };
  obstacleImg2.onload = () => {
    obstacleSpriteCount++;
  };
  obstacleImg3.onload = () => {
    obstacleSpriteCount++;
  };

  const obstacleTypeToSprite = {
    obstacle1: obstacleImg1,
    obstacle2: obstacleImg2,
    obstacle3: obstacleImg3,
  };

  // ============================================================
  //  HIGH SCORE — localStorage
  // ============================================================
  function loadHighScore() {
    try {
      return parseInt(localStorage.getItem("dhakaDashHighScore"), 10) || 0;
    } catch {
      return 0;
    }
  }

  function saveHighScore(val) {
    highScore = val;
    try {
      localStorage.setItem("dhakaDashHighScore", String(val));
    } catch {
      /* storage unavailable */
    }
  }

  function updateHighScoreDisplays() {
    homeHighscore.textContent = highScore;
    hudHighscore.textContent = highScore;
    goHighscoreEl.textContent = highScore;
  }

  // ============================================================
  //  BACKGROUND GENERATION — Dhaka cityscape
  // ============================================================
  function generateBackground() {
    // Clouds (halved sizes for pixel scale)
    clouds = [];
    for (let i = 0; i < CONFIG.bgCloudCount; i++) {
      clouds.push({
        x: Math.random() * W,
        y: 10 + Math.random() * 40,
        width: 25 + Math.random() * 35,
        height: 9 + Math.random() * 7,
        speed: 0.1 + Math.random() * 0.15,
        opacity: 0.3 + Math.random() * 0.3,
      });
    }

    // Buildings (Dhaka skyline with mosque domes & apartment blocks)
    buildings = [];
    for (let i = 0; i < CONFIG.bgBuildingCount; i++) {
      const btype = Math.random();
      buildings.push({
        x: (W / CONFIG.bgBuildingCount) * i + Math.random() * 30,
        width: 20 + Math.random() * 30,
        height: 25 + Math.random() * 50,
        speed: 0.15 + Math.random() * 0.15,
        hasDome: btype < 0.3,
        hasMinar: btype < 0.15,
        windows: Math.floor(Math.random() * 4) + 1,
      });
    }

    // Palm trees (mid-ground)
    palms = [];
    for (let i = 0; i < CONFIG.bgPalmCount; i++) {
      palms.push({
        x: Math.random() * W,
        height: 30 + Math.random() * 20,
        speed: 0.25 + Math.random() * 0.15,
        lean: (Math.random() - 0.5) * 0.3,
      });
    }
  }

  // ============================================================
  //  OBSTACLE GENERATION — Bangladesh street obstacles
  // ============================================================
  const OBSTACLE_HEIGHT_MULTIPLIER_MOBILE = {
    obstacle1: [1.5, 1.72],
    obstacle2: [1.05, 1.28],
    obstacle3: [1.62, 1.9],
  };
  const OBSTACLE_HEIGHT_MULTIPLIER_DESKTOP = {
    obstacle1: [1.18, 1.4],
    obstacle2: [1.0, 1.22],
    obstacle3: [1.28, 1.56],
  };
  const OBSTACLE_MAX_WIDTH_RATIO = 0.2;
  const OBSTACLE_MAX_WIDTH_RATIO_BY_TYPE_MOBILE = {
    obstacle1: 0.22,
    obstacle2: 0.3,
    obstacle3: 0.22,
  };
  const OBSTACLE_MAX_WIDTH_RATIO_BY_TYPE_DESKTOP = {
    obstacle1: 0.19,
    obstacle2: 0.28,
    obstacle3: 0.19,
  };
  const OBSTACLE_TYPES = [
    {
      type: "obstacle1",
      color: "#2ecc40",
      minW: 50,
      maxW: 60,
      minH: 38,
      maxH: 48,
    },
    {
      type: "obstacle2",
      color: "#333",
      minW: 49,
      maxW: 65,
      minH: 18,
      maxH: 25,
    },
    {
      type: "obstacle3",
      color: "#8B4513",
      minW: 57,
      maxW: 70,
      minH: 47,
      maxH: 57,
    },
  ];

  function spawnObstacle() {
    const def =
      OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
    let w = Math.random() * (def.maxW - def.minW) + def.minW;
    let h = Math.random() * (def.maxH - def.minH) + def.minH;

    // Use native sprite dimensions scaled to ~1/4 of gameplay window without distortion.
    const sprite = obstacleTypeToSprite[def.type];
    const isMobile = isMobileDevice();
    const heightMultipliers = isMobile
      ? OBSTACLE_HEIGHT_MULTIPLIER_MOBILE
      : OBSTACLE_HEIGHT_MULTIPLIER_DESKTOP;
    const widthRatioByType = isMobile
      ? OBSTACLE_MAX_WIDTH_RATIO_BY_TYPE_MOBILE
      : OBSTACLE_MAX_WIDTH_RATIO_BY_TYPE_DESKTOP;

    const [hMinMul, hMaxMul] = heightMultipliers[def.type] || [0.9, 1.2];
    const randomHeightMul = hMinMul + Math.random() * (hMaxMul - hMinMul);
    const obstacleScaleBoost = isMobile ? MOBILE_OBSTACLE_SCALE_BOOST : 1;
    const maxObstacleHeightRatio = isMobile ? 0.27 : 0.25;
    const targetObstacleHeight = clamp(
      player.height * randomHeightMul * obstacleScaleBoost,
      H * 0.09,
      H * maxObstacleHeightRatio,
    );

    if (sprite && sprite.naturalWidth > 0 && sprite.naturalHeight > 0) {
      const spriteAspect = sprite.naturalWidth / sprite.naturalHeight;
      h = targetObstacleHeight;
      w = h * spriteAspect;

      const maxDrawW =
        W * (widthRatioByType[def.type] || OBSTACLE_MAX_WIDTH_RATIO);
      if (w > maxDrawW) {
        const downScale = maxDrawW / w;
        w *= downScale;
        h *= downScale;
      }
    } else {
      h = targetObstacleHeight;
      w = clamp(h * (def.minW / def.minH) || w, def.minW, def.maxW);
    }

    // Reuse obstacle objects to reduce per-frame allocation churn on mobile browsers.
    const obstacle = obstaclePool.pop() || {};
    obstacle.x = nextObstacleX;
    obstacle.y = CONFIG.groundY - h;
    obstacle.width = w;
    obstacle.height = h;
    obstacle.type = def.type;
    obstacle.color = def.color;
    obstacles.push(obstacle);

    // Calculate gap until next obstacle — decreases as speed increases
    const gapRange = CONFIG.maxObstacleGap - CONFIG.minObstacleGap;
    const difficultyFactor = Math.min(
      (speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed),
      1,
    );
    const gap = CONFIG.maxObstacleGap - gapRange * difficultyFactor * 0.5;
    nextObstacleX += gap + Math.random() * 60;
  }

  function recycleObstacleAt(index) {
    const removed = obstacles.splice(index, 1);
    const obstacle = removed[0];
    if (!obstacle) return;
    // Keep the pool bounded so memory usage cannot grow unbounded.
    if (obstaclePool.length < 32) {
      obstaclePool.push(obstacle);
    }
  }

  // ============================================================
  //  COLLISION DETECTION (AABB)
  // ============================================================
  function rectsOverlap(a, b) {
    const shrink = 3;
    return (
      a.x + shrink < b.x + b.width - shrink &&
      a.x + a.width - shrink > b.x + shrink &&
      a.y + shrink < b.y + b.height &&
      a.y + a.height > b.y + shrink
    );
  }

  // ============================================================
  //  INPUT HANDLING
  // ============================================================
  document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (["Space", "ArrowUp", "ArrowDown"].includes(e.code)) {
      e.preventDefault();
    }
  });

  document.addEventListener("keyup", (e) => {
    keys[e.code] = false;
  });

  // Universal jump input: left-click / pen tap while playing.
  canvas.addEventListener(
    "pointerdown",
    (e) => {
      unlockAudio();
      if (gameState !== "playing" || orientationBlocked) return;
      if (e.pointerType === "touch") return; // touch gestures are handled by touch listeners below
      if (e.pointerType === "mouse" && e.button !== 0) return;
      queuedMobileJumps += 1;
    },
    { passive: true },
  );

  // Touch controls for mobile:
  // Swipe up => jump, quick second swipe up => double jump.
  canvas.addEventListener(
    "touchstart",
    (e) => {
      unlockAudio();
      if (!e.changedTouches || e.changedTouches.length === 0) return;
      const t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
      touchStartTime = performance.now();
      touchGestureConsumed = false;
    },
    { passive: true },
  );

  canvas.addEventListener(
    "touchmove",
    (e) => {
      if (
        !e.changedTouches ||
        e.changedTouches.length === 0 ||
        touchGestureConsumed
      )
        return;
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const minSwipeDistance = 20;
      const mostlyVertical = Math.abs(dy) > Math.abs(dx) * 1.1;

      if (!mostlyVertical) return;

      if (dy < -minSwipeDistance) {
        queuedMobileJumps += 1;
        touchGestureConsumed = true;
        return;
      }

      if (dy > minSwipeDistance) {
        queuedMobileDucks += 1;
        touchGestureConsumed = true;
      }
    },
    { passive: true },
  );

  canvas.addEventListener(
    "touchend",
    (e) => {
      e.preventDefault();
      if (!e.changedTouches || e.changedTouches.length === 0) return;

      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const minSwipeDistance = 20;
      const mostlyVertical = Math.abs(dy) > Math.abs(dx) * 1.1;
      const isSwipeUp = dy < -minSwipeDistance;
      const isSwipeDown = dy > minSwipeDistance;
      const touchDuration = performance.now() - touchStartTime;
      const isTap =
        !touchGestureConsumed &&
        Math.abs(dx) < 14 &&
        Math.abs(dy) < 14 &&
        touchDuration < 260;

      if (isTap) {
        queuedMobileJumps += 1;
        return;
      }

      if (!mostlyVertical) return;

      if (isSwipeUp && !touchGestureConsumed) {
        queuedMobileJumps += 1;
        return;
      }

      if (isSwipeDown && !touchGestureConsumed) {
        queuedMobileDucks += 1;
      }
    },
    { passive: false },
  );

  function isPhonePortrait() {
    return (
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(orientation: portrait)").matches
    );
  }

  function updateOrientationRequirement() {
    orientationBlocked = isPhonePortrait();
    orientationOverlay.classList.toggle("hidden", !orientationBlocked);
    applyGroundYForDevice();
    player.y = CONFIG.groundY - player.height;
    chaser.y = CONFIG.groundY - chaser.height;
  }

  window.addEventListener("orientationchange", updateOrientationRequirement);
  updateOrientationRequirement();

  // ===== BUTTON EVENTS =====
  document.getElementById("btn-start").addEventListener("click", () => {
    unlockAudio();
    startGame();
  });
  document.getElementById("btn-restart").addEventListener("click", () => {
    unlockAudio();
    startGame();
  });
  document.getElementById("btn-home").addEventListener("click", goHome);

  document.addEventListener("pointerdown", unlockAudio, { passive: true });
  document.addEventListener("keydown", unlockAudio, { passive: true });

  // ============================================================
  //  SCREEN TRANSITIONS
  // ============================================================
  function showScreen(screen) {
    homeScreen.classList.add("hidden");
    gameoverScreen.classList.add("hidden");
    hud.classList.add("hidden");
    screen?.classList.remove("hidden");
  }

  function goHome() {
    gameState = "home";
    cancelAnimationFrame(animFrame);
    stopAllMusic();
    updateHighScoreDisplays();
    showScreen(homeScreen);
  }

  // ============================================================
  //  GAME START / RESET
  // ============================================================
  function startGame() {
    unlockAudio();
    score = 0;
    speed = CONFIG.baseSpeed;
    frameCount = 0;
    lastTimestamp = 0;
    obstacles = [];
    nextObstacleX = W + 150;

    // Reset player
    player.y = CONFIG.groundY - CONFIG.playerHeight;
    player.height = CONFIG.playerHeight;
    player.vy = 0;
    player.isJumping = false;
    player.jumpCount = 0;
    player.jumpHoldFrames = 0;
    player.jumpKeyWasDown = false;
    player.isDucking = false;
    player.legFrame = 0;
    queuedMobileJumps = 0;
    queuedMobileDucks = 0;

    // Reset chaser
    chaser.bobOffset = 0;
    chaser.legFrame = 0;

    // Background
    generateBackground();
    groundOffset = 0;
    bgScrollX = 0;

    // UI
    gameState = "playing";
    startGameplayMusic();
    showScreen(null);
    hud.classList.remove("hidden");
    updateHighScoreDisplays();

    cancelAnimationFrame(animFrame);
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ============================================================
  //  GAME OVER
  // ============================================================
  function triggerGameOver() {
    gameState = "gameover";
    cancelAnimationFrame(animFrame);
    playObstacleHitSfx();
    startOutroMusic();

    const finalScore = Math.floor(score);
    if (finalScore > highScore) {
      saveHighScore(finalScore);
    }

    finalScoreEl.textContent = finalScore;
    updateHighScoreDisplays();
    showScreen(gameoverScreen);
  }

  // ============================================================
  //  UPDATE LOGIC (per frame)
  // ============================================================
  function update(stepMul) {
    frameCount += stepMul;

    // --- Increase speed over time (very gradual) ---
    if (speed < CONFIG.maxSpeed) {
      speed += CONFIG.speedIncrement * stepMul;
    }

    // --- Score ---
    score += CONFIG.scoreRate * speed * stepMul;
    hudScore.textContent = Math.floor(score);

    // --- Player jump (keyboard + mobile swipe) ---
    const jumpKeyDown = !!(keys["Space"] || keys["ArrowUp"]);
    const keyboardJumpPressed = jumpKeyDown && !player.jumpKeyWasDown;
    const mobileJumpPressed = queuedMobileJumps > 0;

    if ((keyboardJumpPressed || mobileJumpPressed) && player.jumpCount < 2) {
      player.vy = CONFIG.jumpForce;
      player.isJumping = true;
      player.jumpCount++;
      player.jumpHoldFrames = CONFIG.jumpHoldFrames;
      playJumpSfx();

      if (mobileJumpPressed) queuedMobileJumps--;
    }

    if (
      player.isJumping &&
      jumpKeyDown &&
      player.vy < 0 &&
      player.jumpHoldFrames > 0
    ) {
      player.vy += CONFIG.jumpHoldBoost * stepMul;
      player.jumpHoldFrames -= stepMul;
    }

    player.jumpKeyWasDown = jumpKeyDown;

    // --- Player duck ---
    const wantsDuck = keys["ArrowDown"] || queuedMobileDucks > 0;
    if (wantsDuck && !player.isJumping) {
      if (!player.isDucking) {
        player.isDucking = true;
        player.height = CONFIG.playerDuckHeight;
        player.y = CONFIG.groundY - CONFIG.playerDuckHeight;
      }
    } else if (player.isDucking) {
      player.isDucking = false;
      player.height = CONFIG.playerHeight;
      player.y = CONFIG.groundY - CONFIG.playerHeight;
    }

    if (queuedMobileDucks > 0) {
      queuedMobileDucks = 0;
    }

    // --- Apply gravity ---
    if (player.isJumping) {
      player.vy += CONFIG.gravity * stepMul;
      if (player.vy > CONFIG.maxFallSpeed) player.vy = CONFIG.maxFallSpeed;
      player.y += player.vy * stepMul;

      const landY = CONFIG.groundY - player.height;
      if (player.y >= landY) {
        player.y = landY;
        player.vy = 0;
        player.isJumping = false;
        player.jumpCount = 0;
        player.jumpHoldFrames = 0;
      }
    }

    // --- Leg animation ---
    player.legFrame += speed * 0.04 * stepMul;
    chaser.legFrame += speed * 0.04 * stepMul;

    // --- Chaser bob ---
    chaser.bobOffset = Math.sin(frameCount * 0.06) * 1;

    // --- Move obstacles ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
      obstacles[i].x -= speed * stepMul;
      if (obstacles[i].x + obstacles[i].width < -80) {
        recycleObstacleAt(i);
      }
    }

    // --- Spawn new obstacles ---
    if (
      obstacles.length === 0 ||
      nextObstacleX - (W - (obstacles[obstacles.length - 1]?.x || 0)) < W * 2
    ) {
      if (nextObstacleX < W + speed * 80) {
        spawnObstacle();
      }
    }
    let rightmostX = 0;
    for (const obstacle of obstacles) {
      const obstacleRight = obstacle.x + obstacle.width;
      if (obstacleRight > rightmostX) rightmostX = obstacleRight;
    }
    if (rightmostX < W + 100) {
      nextObstacleX = Math.max(
        nextObstacleX,
        rightmostX + CONFIG.minObstacleGap,
      );
      spawnObstacle();
    }

    // --- Collision detection ---
    const playerBox = {
      x: player.x,
      y: player.y,
      width: player.width,
      height: player.height,
    };
    for (const obs of obstacles) {
      // Slightly smaller obstacle hitbox for fairer collisions near sprite edges.
      const insetX = Math.max(2, obs.width * 0.12);
      const insetY = Math.max(1.5, obs.height * 0.08);
      const obstacleHitbox = {
        x: obs.x + insetX,
        y: obs.y + insetY,
        width: Math.max(2, obs.width - insetX * 2),
        height: Math.max(2, obs.height - insetY * 2),
      };

      if (rectsOverlap(playerBox, obstacleHitbox)) {
        triggerGameOver();
        return;
      }
    }

    // --- Background scroll ---
    groundOffset = (groundOffset + speed * stepMul) % 30;
    bgScrollX += speed * 0.35 * stepMul; // parallax: bg scrolls slower than ground

    for (const c of clouds) {
      c.x -= speed * c.speed * stepMul;
      if (c.x + c.width < -20) c.x = W + 20 + Math.random() * 100;
    }

    for (const b of buildings) {
      b.x -= speed * b.speed * stepMul;
      if (b.x + b.width < -30) b.x = W + Math.random() * 80;
    }

    for (const p of palms) {
      p.x -= speed * p.speed * stepMul;
      if (p.x < -30) p.x = W + Math.random() * 60;
    }
  }

  // ============================================================
  //  DRAWING — Bangladesh themed
  // ============================================================

  // --- Background — scrolling image or fallback ---
  function drawBackground() {
    if (bgImageReady) {
      // Draw background at FULL resolution on display canvas for sharpness
      const imgAspect = bgImage.width / bgImage.height;
      const drawH = displayH;
      const drawW = drawH * imgAspect;

      // Scroll the background (bgScrollX is in internal coords, scale up).
      // Use mirrored alternating tiles so each seam joins matching edge pixels.
      const scrollPx = (bgScrollX * PIXEL_SCALE) % drawW;
      const baseTile = Math.floor((bgScrollX * PIXEL_SCALE) / drawW);
      const tileCount = Math.ceil(displayW / drawW) + 3;

      for (let i = -1; i < tileCount; i++) {
        const worldTileIndex = baseTile + i;
        const bx = i * drawW - scrollPx;
        const mirrored = Math.abs(worldTileIndex) % 2 === 1;

        if (mirrored) {
          displayCtx.save();
          displayCtx.translate(bx + drawW, 0);
          displayCtx.scale(-1, 1);
          displayCtx.drawImage(bgImage, 0, 0, drawW, drawH);
          displayCtx.restore();
        } else {
          displayCtx.drawImage(bgImage, bx, 0, drawW, drawH);
        }
      }
    } else {
      // Fallback: solid sky gradient
      const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.groundY);
      grad.addColorStop(0, "#4a90c2");
      grad.addColorStop(0.5, "#87CEEB");
      grad.addColorStop(0.85, "#f5d6a8");
      grad.addColorStop(1, "#e8c090");
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, W, CONFIG.groundY);
    }
  }

  // --- Ground — Dhaka street road ---
  function drawGround() {
    // Skip if background image handles the ground
    if (bgImageReady) return;

    // Dirt/asphalt road
    ctx.fillStyle = "#4a4a4a";
    ctx.fillRect(0, CONFIG.groundY, W, CONFIG.groundHeight);

    // Sidewalk edge
    ctx.fillStyle = "#888";
    ctx.fillRect(0, CONFIG.groundY, W, 2);

    // Road center dashes (yellow like Bangladeshi roads)
    ctx.strokeStyle = "#daa520";
    ctx.lineWidth = 1;
    ctx.setLineDash([10, 7]);
    ctx.lineDashOffset = -groundOffset * 1.5;
    ctx.beginPath();
    ctx.moveTo(0, CONFIG.groundY + 17);
    ctx.lineTo(W, CONFIG.groundY + 17);
    ctx.stroke();
    ctx.setLineDash([]);

    // Road texture — small cracks/marks for realism
    ctx.strokeStyle = "rgba(80, 80, 80, 0.4)";
    ctx.lineWidth = 1;
    for (let x = -groundOffset; x < W; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, CONFIG.groundY + 6);
      ctx.lineTo(x + 4, CONFIG.groundY + 7);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x + 15, CONFIG.groundY + 27);
      ctx.lineTo(x + 18, CONFIG.groundY + 29);
      ctx.stroke();
    }

    // Drain/gutter line at bottom
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, CONFIG.groundY + CONFIG.groundHeight - 1);
    ctx.lineTo(W, CONFIG.groundY + CONFIG.groundHeight - 1);
    ctx.stroke();
  }

  // --- Player character — Bangladeshi runner with lungi and topi ---
  function drawPlayer() {
    const px = player.x;
    const py = player.y;
    const pw = player.width;
    const ph = player.height;

    if (chaserSpritesReady >= 2) {
      // Player is the chaser — use chaser sprite frames
      const frame =
        player.isJumping && jumpSpriteReady
          ? jumpImg
          : Math.floor(player.legFrame) % 2 === 0
            ? chaserImg1
            : chaserImg2;
      // Draw close to hitbox size to keep responsive proportions across viewports.
      const baseDx = px * PIXEL_SCALE;
      const baseDy = py * PIXEL_SCALE;
      const baseDw = pw * PIXEL_SCALE;
      const baseDh = ph * PIXEL_SCALE;

      let dx = baseDx;
      let dy = baseDy;
      let dw = baseDw;
      let dh = baseDh;

      // Keep jump sprite's original proportions so it doesn't look squashed.
      if (
        player.isJumping &&
        jumpSpriteReady &&
        jumpImg.naturalWidth &&
        jumpImg.naturalHeight
      ) {
        const jumpAspect = jumpImg.naturalWidth / jumpImg.naturalHeight;
        dh = baseDh;
        dw = dh * jumpAspect;
        const centerX = (px + pw / 2) * PIXEL_SCALE;
        dx = centerX - dw / 2;
        // Keep feet alignment by matching the bottom edge of the base sprite box.
        dy = baseDy + baseDh - dh;
      }

      displayCtx.drawImage(frame, dx, dy, dw, dh);
      return;
    }

    const legCycle = Math.sin(player.legFrame) * 0.4;

    if (player.isDucking) {
      // Ducking — crouched body
      ctx.fillStyle = "#d4a574"; // skin
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + 3, 5, 0, Math.PI * 2);
      ctx.fill();

      // Topi (prayer cap)
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + 1, 5, 2.5, 0, Math.PI, 0);
      ctx.fill();

      // Body in lungi
      ctx.fillStyle = CONFIG.playerColor;
      ctx.fillRect(px + 1, py + 6, pw - 2, ph - 7);

      // Eye
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px + pw / 2 + 2, py + 2.5, 1.2, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(px + pw / 2 + 2.5, py + 2.5, 0.6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // --- Full standing character ---

      // Head (skin tone)
      ctx.fillStyle = "#d4a574";
      ctx.beginPath();
      ctx.arc(px + pw / 2, py + 6, 5.5, 0, Math.PI * 2);
      ctx.fill();

      // Topi (white prayer cap)
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + 3.5, 5.5, 3, 0, Math.PI, 0);
      ctx.fill();
      ctx.strokeStyle = "#ddd";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.ellipse(px + pw / 2, py + 3.5, 5.5, 3, 0, Math.PI, 0);
      ctx.stroke();

      // Eyes
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(px + pw / 2 + 2, py + 5.5, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2c1810";
      ctx.beginPath();
      ctx.arc(px + pw / 2 + 2.5, py + 5.5, 0.75, 0, Math.PI * 2);
      ctx.fill();

      // Mustache
      ctx.strokeStyle = "#3a2a1a";
      ctx.lineWidth = 0.75;
      ctx.beginPath();
      ctx.moveTo(px + pw / 2 - 1, py + 8.5);
      ctx.quadraticCurveTo(px + pw / 2, py + 7.5, px + pw / 2 + 2.5, py + 8);
      ctx.stroke();

      // Shirt (panjabi — green)
      ctx.fillStyle = CONFIG.playerColor;
      const shirtTop = py + 11;
      const shirtH = 7;
      roundRect(ctx, px + 3, shirtTop, pw - 6, shirtH, 1.5);
      ctx.fill();

      // Shirt collar detail
      ctx.strokeStyle = "#004d38";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      ctx.moveTo(px + pw / 2 - 2, shirtTop);
      ctx.lineTo(px + pw / 2, shirtTop + 2.5);
      ctx.lineTo(px + pw / 2 + 2, shirtTop);
      ctx.stroke();

      // Lungi (traditional wrap — checkered pattern)
      const lungiTop = shirtTop + shirtH;
      const lungiH = ph - (lungiTop - py) - 5;
      ctx.fillStyle = "#c62828"; // red lungi base
      ctx.fillRect(px + 2.5, lungiTop, pw - 5, lungiH);

      // Lungi check pattern
      ctx.strokeStyle = "rgba(255,255,255,0.3)";
      ctx.lineWidth = 0.4;
      for (let ly = lungiTop; ly < lungiTop + lungiH; ly += 2.5) {
        ctx.beginPath();
        ctx.moveTo(px + 2.5, ly);
        ctx.lineTo(px + pw - 2.5, ly);
        ctx.stroke();
      }
      for (let lx = px + 2.5; lx < px + pw - 2.5; lx += 2.5) {
        ctx.beginPath();
        ctx.moveTo(lx, lungiTop);
        ctx.lineTo(lx, lungiTop + lungiH);
        ctx.stroke();
      }

      // Legs (animated, skin colored below lungi)
      ctx.strokeStyle = "#d4a574";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";

      ctx.beginPath();
      ctx.moveTo(px + pw / 2 - 2.5, py + ph - 5);
      ctx.lineTo(px + pw / 2 - 2.5 + legCycle * 5, py + ph);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px + pw / 2 + 2.5, py + ph - 5);
      ctx.lineTo(px + pw / 2 + 2.5 - legCycle * 5, py + ph);
      ctx.stroke();

      // Sandals (chappal)
      ctx.fillStyle = "#654321";
      ctx.fillRect(px + pw / 2 - 4 + legCycle * 5, py + ph - 1, 3.5, 1.5);
      ctx.fillRect(px + pw / 2 + 1 - legCycle * 5, py + ph - 1, 3.5, 1.5);

      // Arms (animated)
      ctx.strokeStyle = "#d4a574";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(px + pw - 3, py + 13);
      ctx.lineTo(px + pw + 2 - legCycle * 4, py + 17.5);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(px + 3, py + 13);
      ctx.lineTo(px - 2 + legCycle * 4, py + 17.5);
      ctx.stroke();
    }

    // Jump dust
    if (player.isJumping && player.vy < 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = "#aaa";
      for (let i = 0; i < 3; i++) {
        const dx = Math.random() * 10 - 5;
        const dy = Math.random() * 4;
        ctx.beginPath();
        ctx.arc(
          px + pw / 2 + dx,
          CONFIG.groundY - dy,
          Math.random() * 1.5 + 0.5,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    }
  }

  // --- Chased character — person on bicycle ---
  function drawChaser() {
    const cx = chaser.x;
    const cy = chaser.y + chaser.bobOffset;
    const cw = chaser.width;
    const ch = chaser.height;

    if (chaseSpritesReady >= 2) {
      // Chaser object is the one being chased — use chase sprite frames
      const frame = Math.floor(chaser.legFrame) % 2 === 0 ? chase1 : chase2;
      // Draw close to hitbox size for consistent visual scaling.
      const dx = cx * PIXEL_SCALE;
      const dy = cy * PIXEL_SCALE;
      const dw = cw * PIXEL_SCALE;
      const dh = ch * PIXEL_SCALE;
      displayCtx.drawImage(frame, dx, dy, dw, dh);
      return;
    }

    const legCycle = Math.sin(chaser.legFrame) * 0.4;

    // Bicycle wheels
    ctx.strokeStyle = "#555";
    ctx.lineWidth = 1;
    // Rear wheel
    ctx.beginPath();
    ctx.arc(cx + 3, cy + ch - 3, 4, 0, Math.PI * 2);
    ctx.stroke();
    // Front wheel
    ctx.beginPath();
    ctx.arc(cx + cw - 2, cy + ch - 3, 4, 0, Math.PI * 2);
    ctx.stroke();

    // Spokes (animated)
    ctx.lineWidth = 0.5;
    const spokeAngle = frameCount * 0.15;
    for (let w = 0; w < 2; w++) {
      const wx = w === 0 ? cx + 3 : cx + cw - 2;
      const wy = cy + ch - 3;
      for (let s = 0; s < 4; s++) {
        const a = spokeAngle + (s * Math.PI) / 2;
        ctx.beginPath();
        ctx.moveTo(wx, wy);
        ctx.lineTo(wx + Math.cos(a) * 3.5, wy + Math.sin(a) * 3.5);
        ctx.stroke();
      }
    }

    // Bicycle frame
    ctx.strokeStyle = CONFIG.chaserColor;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(cx + 3, cy + ch - 3);
    ctx.lineTo(cx + cw / 2, cy + ch - 11);
    ctx.lineTo(cx + cw - 2, cy + ch - 3);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + cw / 2, cy + ch - 11);
    ctx.lineTo(cx + cw / 2 - 2, cy + ch - 3);
    ctx.stroke();
    // Handlebar
    ctx.beginPath();
    ctx.moveTo(cx + cw / 2, cy + ch - 11);
    ctx.lineTo(cx + cw - 1, cy + ch - 13);
    ctx.stroke();

    // Rider body
    ctx.fillStyle = "#d4a574"; // skin
    ctx.beginPath();
    ctx.arc(cx + cw / 2 + 1, cy + 5, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Rider topi
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.ellipse(cx + cw / 2 + 1, cy + 3, 4.5, 2.5, 0, Math.PI, 0);
    ctx.fill();

    // Rider eye
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(cx + cw / 2 + 3, cy + 4.5, 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx + cw / 2 + 3.5, cy + 4.5, 0.6, 0, Math.PI * 2);
    ctx.fill();

    // Rider shirt
    ctx.fillStyle = "#1565C0";
    roundRect(ctx, cx + cw / 2 - 3, cy + 9, 8, 6, 1);
    ctx.fill();

    // Rider legs (pedaling)
    ctx.strokeStyle = "#d4a574";
    ctx.lineWidth = 1.5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(cx + cw / 2 - 1, cy + 15);
    ctx.lineTo(cx + cw / 2 - 2.5 + legCycle * 4, cy + ch - 4);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + cw / 2 + 2, cy + 15);
    ctx.lineTo(cx + cw / 2 + 3.5 - legCycle * 4, cy + ch - 4);
    ctx.stroke();

    // Orna / scarf streaming behind (Bangladesh flag colors)
    ctx.strokeStyle = "#f42a41";
    ctx.lineWidth = 1.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    ctx.moveTo(cx + cw / 2 - 2, cy + 7);
    const scarfWave = Math.sin(frameCount * 0.12) * 4;
    const scarfWave2 = Math.sin(frameCount * 0.12 + 1) * 3;
    ctx.quadraticCurveTo(
      cx - 5,
      cy + 5 + scarfWave,
      cx - 11,
      cy + 8 + scarfWave2,
    );
    ctx.stroke();
  }

  // --- Obstacles — detailed Bangladesh street obstacles ---
  // Drawn on full-resolution display canvas for sharp quality
  function drawObstacle(obs) {
    const S = PIXEL_SCALE;
    const dc = displayCtx;

    // Use sprite if available — draw exactly with obstacle box set from native sprite size
    const sprite = obstacleTypeToSprite[obs.type];
    if (obstacleSpriteCount >= 3 && sprite && sprite.complete) {
      const drawX = obs.x * S;
      const drawY = obs.y * S;
      const drawW = obs.width * S;
      const drawH = obs.height * S;
      dc.imageSmoothingEnabled = true;
      dc.drawImage(sprite, drawX, drawY, drawW, drawH);
      dc.imageSmoothingEnabled = false;
      return;
    }

    // Fallback: simple colored rectangle with outline
    const x = obs.x * S;
    const y = obs.y * S;
    const w = obs.width * S;
    const h = obs.height * S;
    dc.fillStyle = obs.color || "#888";
    dc.fillRect(x, y, w, h);
    dc.strokeStyle = "#1a1a1a";
    dc.lineWidth = 2;
    dc.strokeRect(x, y, w, h);
  }

  // --- Main draw function ---
  // Renders to offscreen low-res canvas, then blits up to display for pixel look
  function draw() {
    ctx.clearRect(0, 0, W, H);
    displayCtx.clearRect(0, 0, displayW, displayH);

    // Draw background at full resolution on display canvas (sharp)
    drawBackground();

    // Draw ground on offscreen canvas (only if no bg image)
    drawGround();

    // Draw fallback characters on offscreen canvas (only if sprites not loaded)
    if (chaseSpritesReady < 2) drawChaser();
    if (chaserSpritesReady < 2) drawPlayer();

    // Blit low-res offscreen canvas to display canvas (pixelated upscale)
    displayCtx.drawImage(offCanvas, 0, 0, displayW, displayH);

    // Draw obstacles on full-res display canvas (after blit for sharp rendering)
    for (const obs of obstacles) {
      drawObstacle(obs);
    }

    // Draw character sprites at full resolution AFTER blit (crisp, no pixelation)
    if (chaseSpritesReady >= 2) drawChaser();
    if (chaserSpritesReady >= 2) drawPlayer();
  }

  // ============================================================
  //  GAME LOOP
  // ============================================================
  function gameLoop(timestamp) {
    if (gameState !== "playing") return;

    // Pause gameplay while phone is in portrait; require landscape to play.
    if (orientationBlocked) {
      animFrame = requestAnimationFrame(gameLoop);
      return;
    }

    if (!lastTimestamp) lastTimestamp = timestamp;
    const deltaMs = timestamp - lastTimestamp;
    lastTimestamp = timestamp;
    const stepMul = clamp(deltaMs / FIXED_FRAME_MS, 0.5, MAX_DT_MULTIPLIER);

    update(stepMul);
    if (gameState !== "playing") return;

    draw();
    animFrame = requestAnimationFrame(gameLoop);
  }

  // ============================================================
  //  UTILITY: Rounded rectangle path
  // ============================================================
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // ============================================================
  //  INITIAL SETUP
  // ============================================================
  handleViewportChange();
  updateHighScoreDisplays();

  // Draw a static preview scene on the home screen canvas
  generateBackground();
  draw();
})();
