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
  const playerNameInput = document.getElementById("player-name-input");
  const btnSaveName = document.getElementById("btn-save-name");
  const homeLeaderboardStatus = document.getElementById(
    "home-leaderboard-status",
  );
  const gameoverLeaderboardStatus = document.getElementById(
    "gameover-leaderboard-status",
  );
  const homeLeaderboardList = document.getElementById("home-leaderboard-list");
  const gameoverLeaderboardList = document.getElementById(
    "gameover-leaderboard-list",
  );

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
    playerDuckWidth: 46, // Width when ducking (same as standing)
    playerDuckHeight: 24, // Height when ducking (~43% of standing)
    playerColor: "#006a4e", // Bangladesh green

    // Chased character — runs ahead (the person to catch)
    chaserX: Math.floor(W * 0.55), // Closer to player
    chaserWidth: 43,
    chaserHeight: 53,
    chaserColor: "#f42a41", // Bangladesh red

    // Jump physics (snappy arc, responsive feel)
    jumpForce: -7.0, // Strong initial burst for satisfying jump
    gravity: 0.3, // Firm downward pull — no floatiness
    maxFallSpeed: 8, // Fast descent for responsive landing
    jumpHoldFrames: 8, // Short hold window for skill expression
    jumpHoldBoost: -0.16, // Responsive hold extension

    // Scrolling & difficulty — engaging pace
    baseSpeed: 2.0, // Brisk starting speed
    maxSpeed: 5.5, // High-skill ceiling

    // Obstacles — tight but fair spacing
    minObstacleGap: 150, // Minimum distance between consecutive obstacles
    maxObstacleGap: 270, // Maximum gap (shrinks with difficulty)

    // Scoring
    scoreRate: 0.055, // Score added per frame (multiplied by speed)

    // Parallax background layers
    bgCloudCount: 8, // Number of background clouds
    bgBuildingCount: 8, // Number of Dhaka building silhouettes
    bgPalmCount: 5, // Palm trees in mid-ground
  };

  const MOBILE_GROUND_DROP_FRACTION = 0.05;
  const CINEMATIC_FRAME_RATIO = 932 / 430;
  const NON_MOBILE_CHARACTER_SCALE_BOOST = 1.12;
  const MOBILE_OBSTACLE_SCALE_BOOST = 1.0;
  // Flying obstacles tuned to be clearly readable and threatening.
  const FLYING_OBSTACLE_SIZE_MULTIPLIER = 1.92;
  const DUCKED_FLYING_OBSTACLE_SIZE_MULTIPLIER = 1.0;
  const DUCKED_PLAYER_SIZE_MULTIPLIER = 1.0;
  const DUCK_SQUASH_SCALE = 0.9;
  const FLYING_SPEED_MIN = 0.86;
  const FLYING_SPEED_MAX = 1.2;
  const FLYING_LANE_COUNT = 5;
  const OBSTACLE_DENSITY_MULTIPLIER = 1.3;
  const MAX_OBSTACLE_FAMILY_STREAK = 3;
  // Difficulty milestone cadence — smoother ramp with smaller, more frequent steps.
  const DIFFICULTY_PHASE_SCORE_STEP = 40;
  const DENSITY_PRESSURE_PER_PHASE = 0.075;
  const MAX_DENSITY_PRESSURE_PHASES = 9;
  const SPEED_STEP_PER_PHASE = 0.20;
  const SPEED_CATCHUP_RATE = 0.003;
  const TARGET_FPS = 60;
  const FIXED_FRAME_MS = 1000 / TARGET_FPS;
  const MAX_DT_MULTIPLIER = 2.2;

  // ===== POLISH SYSTEM CONSTANTS =====
  // Jump buffering — forgiving input timing
  const COYOTE_TIME_FRAMES = 5;
  const JUMP_BUFFER_FRAMES = 6;
  // Grace period — no obstacles at game start
  const GRACE_PERIOD_FRAMES = 90;
  // Minimum safety gap between different obstacle families
  const MIN_FAMILY_SWITCH_GAP = 1.35;
  // Squash/stretch on landing
  const SQUASH_FRAMES = 6;
  const SQUASH_SCALE_X = 1.2;
  const SQUASH_SCALE_Y = 0.8;
  // Near-miss detection threshold (px from hitbox edge)
  const NEAR_MISS_THRESHOLD = 10;
  const NEAR_MISS_DISPLAY_FRAMES = 40;
  // Death animation frames before showing game over UI
  const DEATH_ANIM_FRAMES = 36;
  // Powerup system
  const POWERUP_TYPES = [
    { type: 'chai_shield', label: 'চায়ের ঢাল', color: '#f0c040', icon: '☕', duration: 180, minScore: 30, chance: 0.08, cooldown: 400 },
    { type: 'score_multi', label: 'ডাবল পয়েন্ট', color: '#ffd700', icon: '⭐', duration: 300, minScore: 60, chance: 0.06, cooldown: 500 },
    { type: 'slow_motion', label: 'ধীরে চল', color: '#66d9ef', icon: '⏳', duration: 240, minScore: 100, chance: 0.05, cooldown: 600 },
  ];
  const POWERUP_SIZE = 18;
  const POWERUP_MIN_GAP = 400;
  const POWERUP_BOB_SPEED = 0.06;
  const POWERUP_BOB_AMP = 3;
  // Milestone celebrations
  const MILESTONE_SCORES = [50, 100, 200, 300, 500, 750, 1000];
  const MILESTONE_LABELS = ['৫০ 🔥', '১০০ 💪', '২০০ 🚀', '৩০০ ⚡', '৫০০ 🌟', '৭৫০ 🏆', '১০০০ 👑'];

  // Leaderboard backend for GitHub Pages deployments.
  // Configure these values to enable cross-user global leaderboard.
  const runtimeLeaderboardConfig =
    (typeof window !== "undefined" && window.DHAKA_DASH_LEADERBOARD) || {};
  const LEADERBOARD_CONFIG = {
    supabaseUrl: String(runtimeLeaderboardConfig.supabaseUrl || "").trim(),
    supabaseAnonKey: String(
      runtimeLeaderboardConfig.supabaseAnonKey || "",
    ).trim(),
    table: String(runtimeLeaderboardConfig.table || "dhaka_dash_scores").trim(),
    limit: Math.max(1, Number(runtimeLeaderboardConfig.limit) || 10),
  };

  const MOBILE_DUCK_HOLD_FRAMES = 24;

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

    // Character framing — prominent player for clear gameplay.
    CONFIG.playerX = clamp(Math.round(W * 0.105), 36, 170);
    CONFIG.playerHeight = clamp(
      Math.round(H * 0.155 * characterScale),
      50,
      120,
    );
    CONFIG.playerWidth = clamp(
      Math.round(CONFIG.playerHeight * (46 / 56)),
      36,
      100,
    );
    // Keep ducking readable (not overly squashed) while still providing a lower profile.
    CONFIG.playerDuckHeight = clamp(
      Math.round(CONFIG.playerHeight * 0.8),
      30,
      92,
    );
    CONFIG.playerDuckWidth = clamp(
      Math.round(CONFIG.playerWidth * 1.08),
      36,
      108,
    );

    CONFIG.chaserHeight = clamp(Math.round(H * 0.14 * characterScale), 44, 108);
    CONFIG.chaserWidth = clamp(
      Math.round(CONFIG.chaserHeight * (43 / 53)),
      34,
      88,
    );
    CONFIG.chaserX = clamp(
      Math.round(W * 0.56),
      CONFIG.playerX + CONFIG.playerWidth + Math.round(W * 0.18),
      W - Math.round(W * 0.14),
    );

    CONFIG.minObstacleGap = clamp(Math.round(W * 0.16), 100, 280);
    CONFIG.maxObstacleGap = clamp(Math.round(W * 0.27), 170, 400);
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
    if (!player.isDucking) {
      player.width = CONFIG.playerWidth;
      player.height = CONFIG.playerHeight;
    } else {
      player.width = Math.max(
        18,
        Math.round(CONFIG.playerDuckWidth * DUCK_SQUASH_SCALE),
      );
      player.height = Math.max(
        18,
        Math.round(CONFIG.playerDuckHeight * DUCK_SQUASH_SCALE),
      );
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
  let gameState = "home"; // 'home' | 'playing' | 'gameover' | 'paused'
  let score = 0;
  let highScore = loadHighScore();
  let playerName = loadPlayerName();
  let leaderboardRows = [];
  let speed = CONFIG.baseSpeed;
  let animFrame = null;
  let frameCount = 0;
  let lastTimestamp = 0;
  let difficultyPhase = 0;
  let densityPressurePhases = 0;
  let speedPressurePhases = 0;
  let targetSpeed = CONFIG.baseSpeed;
  let gracePeriodTimer = 0;
  // Pause
  let paused = false;
  // Tutorial
  let hasSeenTutorial = false;
  try { hasSeenTutorial = localStorage.getItem('dhakaDashTutorialSeen') === '1'; } catch {}
  let tutorialTimer = 0;
  let tutorialActive = false;
  // Near-miss
  let nearMissTimer = 0;
  let nearMissX = 0;
  let nearMissY = 0;
  let nearMissCount = 0;
  // Squash/stretch
  let squashTimer = 0;
  // Death animation
  let deathAnimTimer = 0;
  let deathTumbleAngle = 0;
  let deathVY = 0;
  let isDeathAnimating = false;
  // New high score tracking
  let newHighScoreReached = false;
  let newHighScoreBannerTimer = 0;
  // Milestone celebration text
  let milestoneText = '';
  let milestoneTextTimer = 0;
  let lastMilestoneIndex = -1;
  // Active powerup
  let activePowerup = null;
  let activePowerupTimer = 0;
  let powerupItems = [];
  let lastPowerupSpawnX = -POWERUP_MIN_GAP;

  function leaderboardEnabled() {
    return Boolean(
      LEADERBOARD_CONFIG.supabaseUrl && LEADERBOARD_CONFIG.supabaseAnonKey,
    );
  }

  // ===== INPUT STATE =====
  const keys = {};
  let queuedMobileJumps = 0;
  let mobileDuckTimerFrames = 0;
  let touchStartX = 0;
  let touchStartY = 0;
  let touchStartTime = 0;
  let touchGestureConsumed = false;
  let orientationBlocked = false;
  let lastFlyingRequirement = "jump";
  let lastFlyingLaneIndex = -1;
  let lastObstacleFamily = null;
  let obstacleFamilyRunLength = 0;
  let obstacleFamilyRunTarget = 1;

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

  // ===== GAME FEEL — particles, screen shake, milestones =====
  let cameraShakeTimer = 0;
  let cameraShakeIntensity = 0;
  let milestoneFlashTimer = 0;
  let wasJumping = false;
  const dustParticles = [];
  const MAX_DUST = 30;
  const speedLines = [];
  const MAX_SPEED_LINES = 12;

  function spawnDust(px, py, count, burstMode) {
    for (let i = 0; i < count; i++) {
      if (dustParticles.length >= MAX_DUST) dustParticles.shift();
      dustParticles.push({
        x: px + (Math.random() - 0.5) * 8,
        y: py - Math.random() * 3,
        vx: burstMode
          ? -(Math.random() * 1.5 + 0.5)
          : -(Math.random() * 0.8 + 0.2),
        vy: burstMode ? -(Math.random() * 2 + 0.5) : -(Math.random() * 0.6),
        life: burstMode ? 18 + Math.random() * 12 : 10 + Math.random() * 8,
        maxLife: 0,
        size: burstMode ? 1.2 + Math.random() * 1.5 : 0.8 + Math.random() * 1,
      });
      dustParticles[dustParticles.length - 1].maxLife =
        dustParticles[dustParticles.length - 1].life;
    }
  }

  function updateParticles(stepMul) {
    for (let i = dustParticles.length - 1; i >= 0; i--) {
      const p = dustParticles[i];
      p.x += p.vx * stepMul;
      p.y += p.vy * stepMul;
      p.vy += 0.04 * stepMul;
      p.life -= stepMul;
      if (p.life <= 0) dustParticles.splice(i, 1);
    }
    // Speed lines at high speeds
    if (speed > CONFIG.baseSpeed * 1.6) {
      if (Math.random() < 0.3 && speedLines.length < MAX_SPEED_LINES) {
        speedLines.push({
          x: W + Math.random() * 20,
          y: Math.random() * CONFIG.groundY * 0.8 + CONFIG.groundY * 0.1,
          len: 15 + Math.random() * 25,
          life: 8 + Math.random() * 6,
        });
      }
    }
    for (let i = speedLines.length - 1; i >= 0; i--) {
      const sl = speedLines[i];
      sl.x -= speed * 1.8 * stepMul;
      sl.life -= stepMul;
      if (sl.life <= 0 || sl.x + sl.len < 0) speedLines.splice(i, 1);
    }
  }

  function drawParticles() {
    // Dust
    for (const p of dustParticles) {
      const alpha = clamp(p.life / p.maxLife, 0, 0.6);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#b8a080";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Speed lines
    if (speedLines.length > 0) {
      ctx.strokeStyle = "rgba(255, 255, 255, 0.15)";
      ctx.lineWidth = 1;
      for (const sl of speedLines) {
        const alpha = clamp(sl.life / 14, 0, 0.2);
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.moveTo(sl.x, sl.y);
        ctx.lineTo(sl.x + sl.len, sl.y);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
  }

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

  const duckImg = new Image();
  duckImg.src = "duck.png";
  let duckSpriteReady = false;
  duckImg.onload = () => {
    duckSpriteReady = true;
  };

  const bgImage = new Image();
  bgImage.src = "bg.png";
  let bgImageReady = false;
  bgImage.onload = () => {
    bgImageReady = true;
  };
  let bgScrollX = 0;

  // ===== AUDIO ASSETS =====
  const homeMusic = new Audio("home.mp3");
  homeMusic.loop = true;
  homeMusic.preload = "auto";
  homeMusic.volume = 0.5;

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
    if (audioUnlocked) {
      // If autoplay was blocked on initial load, a later gesture should retry.
      if (gameState === "home" && homeMusic.paused) {
        startHomeMusic();
      }
      return;
    }

    audioUnlocked = true;

    // Prioritize the currently relevant track while inside the first user gesture.
    if (gameState === "home") {
      startHomeMusic();
    }

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

  function startHomeMusic() {
    stopAudio(gameplayMusic);
    stopAudio(outroMusic);
    stopAudio(homeMusic);
    safePlay(homeMusic);
  }

  function startGameplayMusic() {
    stopAudio(homeMusic);
    stopAudio(outroMusic);
    stopAudio(gameplayMusic);
    safePlay(gameplayMusic);
  }

  function startOutroMusic() {
    stopAudio(homeMusic);
    stopAudio(gameplayMusic);
    stopAudio(outroMusic);
    safePlay(outroMusic);
  }

  function stopAllMusic() {
    stopAudio(homeMusic);
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
  const flyObstacleImg1 = new Image();
  flyObstacleImg1.src = "fly_obstacle.png";
  const flyObstacleImg2 = new Image();
  flyObstacleImg2.src = "fly_obstacle2.png";
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
  flyObstacleImg1.onload = () => {
    obstacleSpriteCount++;
  };
  flyObstacleImg2.onload = () => {
    obstacleSpriteCount++;
  };

  const obstacleTypeToSprite = {
    obstacle1: obstacleImg1,
    obstacle2: obstacleImg2,
    obstacle3: obstacleImg3,
    flyObstacle1: flyObstacleImg1,
    flyObstacle2: flyObstacleImg2,
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

  function loadPlayerName() {
    try {
      const raw = localStorage.getItem("dhakaDashPlayerName") || "Player";
      return sanitizePlayerName(raw);
    } catch {
      return "Player";
    }
  }

  function sanitizePlayerName(value) {
    const trimmed = String(value || "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 18);
    return trimmed || "Player";
  }

  function savePlayerName(name) {
    playerName = sanitizePlayerName(name);
    try {
      localStorage.setItem("dhakaDashPlayerName", playerName);
    } catch {
      // Ignore storage failures.
    }
    if (playerNameInput) {
      playerNameInput.value = playerName;
    }
  }

  function setLeaderboardStatus(message, isError = false) {
    const text = message || "";
    if (homeLeaderboardStatus) {
      homeLeaderboardStatus.textContent = text;
      homeLeaderboardStatus.style.color = isError ? "#f7a7a7" : "#8fbc8f";
    }
    if (gameoverLeaderboardStatus) {
      gameoverLeaderboardStatus.textContent = text;
      gameoverLeaderboardStatus.style.color = isError ? "#f7a7a7" : "#8fbc8f";
    }
  }

  function loadLocalLeaderboard() {
    try {
      const raw = localStorage.getItem("dhakaDashLocalLeaderboard");
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .map((row) => ({
          name: sanitizePlayerName(row.name),
          score: Math.max(0, Number(row.score) || 0),
          created_at: row.created_at || new Date().toISOString(),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, LEADERBOARD_CONFIG.limit);
    } catch {
      return [];
    }
  }

  function saveLocalLeaderboard(rows) {
    try {
      localStorage.setItem("dhakaDashLocalLeaderboard", JSON.stringify(rows));
    } catch {
      // Ignore storage failures.
    }
  }

  function renderLeaderboardList(el) {
    if (!el) return;
    el.innerHTML = "";
    if (!leaderboardRows.length) {
      const li = document.createElement("li");
      li.textContent = "No scores yet";
      el.appendChild(li);
      return;
    }
    leaderboardRows.forEach((row, idx) => {
      const li = document.createElement("li");
      li.textContent = `${idx + 1}. ${row.name} - ${row.score}`;
      el.appendChild(li);
    });
  }

  function renderLeaderboard() {
    renderLeaderboardList(homeLeaderboardList);
    renderLeaderboardList(gameoverLeaderboardList);
  }

  async function fetchLeaderboard() {
    if (!leaderboardEnabled()) {
      leaderboardRows = loadLocalLeaderboard();
      setLeaderboardStatus("Local leaderboard mode active.");
      renderLeaderboard();
      return;
    }

    try {
      setLeaderboardStatus("Loading leaderboard...");
      const endpoint = `${LEADERBOARD_CONFIG.supabaseUrl}/rest/v1/${LEADERBOARD_CONFIG.table}?select=name,score,created_at&order=score.desc,created_at.asc&limit=${LEADERBOARD_CONFIG.limit}`;
      const res = await fetch(endpoint, {
        method: "GET",
        headers: {
          apikey: LEADERBOARD_CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${LEADERBOARD_CONFIG.supabaseAnonKey}`,
        },
      });
      if (!res.ok) {
        throw new Error(`Leaderboard request failed (${res.status})`);
      }
      const rows = await res.json();
      leaderboardRows = Array.isArray(rows)
        ? rows.map((row) => ({
            name: sanitizePlayerName(row.name),
            score: Math.max(0, Number(row.score) || 0),
            created_at: row.created_at || "",
          }))
        : [];
      renderLeaderboard();
      setLeaderboardStatus("Global leaderboard online.");
    } catch (err) {
      leaderboardRows = loadLocalLeaderboard();
      renderLeaderboard();
      setLeaderboardStatus(
        "Global leaderboard unavailable. Showing local scores.",
        true,
      );
      console.error(err);
    }
  }

  async function submitScoreToLeaderboard(finalScore) {
    if (finalScore <= 0) return;

    if (!leaderboardEnabled()) {
      const localRows = loadLocalLeaderboard();
      localRows.push({
        name: playerName,
        score: finalScore,
        created_at: new Date().toISOString(),
      });
      const sorted = localRows
        .sort((a, b) => b.score - a.score)
        .slice(0, LEADERBOARD_CONFIG.limit);
      saveLocalLeaderboard(sorted);
      leaderboardRows = sorted;
      renderLeaderboard();
      return;
    }

    try {
      const endpoint = `${LEADERBOARD_CONFIG.supabaseUrl}/rest/v1/${LEADERBOARD_CONFIG.table}`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: LEADERBOARD_CONFIG.supabaseAnonKey,
          Authorization: `Bearer ${LEADERBOARD_CONFIG.supabaseAnonKey}`,
          Prefer: "return=minimal",
        },
        body: JSON.stringify([
          {
            name: playerName,
            score: finalScore,
          },
        ]),
      });
      if (!res.ok) {
        throw new Error(`Leaderboard submit failed (${res.status})`);
      }
      await fetchLeaderboard();
    } catch (err) {
      setLeaderboardStatus("Score submit failed. Try again later.", true);
      console.error(err);
    }
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
  // Unified obstacle height multipliers (were previously duplicated for mobile/desktop)
  const OBSTACLE_HEIGHT_MULTIPLIER = {
    obstacle1: [1.12, 1.48],
    obstacle2: [0.94, 1.21],
    obstacle3: [0.94, 1.21],
    flyObstacle1: [0.72, 1.02],
    flyObstacle2: [0.72, 1.02],
  };
  const OBSTACLE_MAX_WIDTH_RATIO = 0.2;
  // Unified width ratios (were previously duplicated for mobile/desktop)
  const OBSTACLE_MAX_WIDTH_RATIO_BY_TYPE = {
    obstacle1: 0.2,
    obstacle2: 0.26,
    obstacle3: 0.2,
    flyObstacle1: 0.18,
    flyObstacle2: 0.18,
  };
  const FLYING_LANE_PROFILE_BY_TYPE = {
    // High flight: player must duck to avoid.
    flyObstacle1: {
      minClearanceHeightMul: 0.85,
      maxClearanceHeightMul: 1.2,
      extraDuckPadding: 14,
    },
    // Low flight: player must jump over.
    flyObstacle2: {
      minClearanceHeightMul: 0.18,
      maxClearanceHeightMul: 0.46,
      extraDuckPadding: -2,
    },
  };

  function getFlyingLaneTopBounds(obstacleHeight) {
    const topMin = Math.round(H * 0.08);
    const topMax = Math.max(topMin, CONFIG.groundY - obstacleHeight - 10);
    return { topMin, topMax };
  }

  function getFlyingLaneTop(laneIndex, obstacleHeight) {
    const { topMin, topMax } = getFlyingLaneTopBounds(obstacleHeight);
    if (FLYING_LANE_COUNT <= 1 || topMax <= topMin) return topMin;

    const laneStep = (topMax - topMin) / (FLYING_LANE_COUNT - 1);
    const laneCenterTop = topMin + laneStep * laneIndex;
    const jitter = (Math.random() - 0.5) * laneStep * 0.28;
    return clamp(Math.round(laneCenterTop + jitter), topMin, topMax);
  }

  function pickFlyingLaneIndex(requiredMove) {
    // Lane groups keep both move types readable while still using all 5 lanes.
    const preferredLanes =
      requiredMove === "duck" ? [0, 1, 2, 3] : [1, 2, 3, 4];
    const fallbackLane = Math.floor(Math.random() * FLYING_LANE_COUNT);
    const candidates = preferredLanes.filter(
      (lane) => lane !== lastFlyingLaneIndex,
    );
    if (!candidates.length) return fallbackLane;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  function chooseFlyingRequirement() {
    // Bias toward alternating required move so players repeatedly switch jump/duck.
    const alternate = Math.random() < 0.72;
    if (alternate) {
      return lastFlyingRequirement === "duck" ? "jump" : "duck";
    }
    return Math.random() < 0.5 ? "duck" : "jump";
  }

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
    {
      type: "flyObstacle1",
      color: "#89b6ff",
      minW: 40,
      maxW: 56,
      minH: 20,
      maxH: 32,
      airborne: true,
    },
    {
      type: "flyObstacle2",
      color: "#acd7ff",
      minW: 44,
      maxW: 60,
      minH: 22,
      maxH: 34,
      airborne: true,
    },
  ];

  const AIRBORNE_OBSTACLE_TYPES = OBSTACLE_TYPES.filter((def) => def.airborne);
  const GROUNDED_OBSTACLE_TYPES = OBSTACLE_TYPES.filter((def) => !def.airborne);

  function randomObstacleFamilyRunTarget() {
    const roll = Math.random();
    if (roll < 0.56) return 1;
    if (roll < 0.9) return 2;
    return 3;
  }

  function pickNextObstacleDefinition() {
    let family;
    if (!lastObstacleFamily) {
      family = Math.random() < 0.45 ? "air" : "ground";
      obstacleFamilyRunTarget = randomObstacleFamilyRunTarget();
    } else {
      const oppositeFamily = lastObstacleFamily === "air" ? "ground" : "air";
      const hardCapReached =
        obstacleFamilyRunLength >= MAX_OBSTACLE_FAMILY_STREAK;
      if (hardCapReached) {
        family = oppositeFamily;
      } else {
        const runTargetReached =
          obstacleFamilyRunLength >= obstacleFamilyRunTarget;
        const switchChance = runTargetReached ? 0.82 : 0.24;
        family =
          Math.random() < switchChance ? oppositeFamily : lastObstacleFamily;
      }
    }

    if (family !== lastObstacleFamily) {
      lastObstacleFamily = family;
      obstacleFamilyRunLength = 0;
      obstacleFamilyRunTarget = randomObstacleFamilyRunTarget();
    }

    obstacleFamilyRunLength += 1;

    const sourcePool =
      family === "air" ? AIRBORNE_OBSTACLE_TYPES : GROUNDED_OBSTACLE_TYPES;
    return sourcePool[Math.floor(Math.random() * sourcePool.length)];
  }

  function spawnObstacle() {
    const def = pickNextObstacleDefinition();
    let w = Math.random() * (def.maxW - def.minW) + def.minW;
    let h = Math.random() * (def.maxH - def.minH) + def.minH;

    // Use native sprite dimensions scaled to ~1/4 of gameplay window without distortion.
    const sprite = obstacleTypeToSprite[def.type];
    const isMobile = isMobileDevice();
    const heightMultipliers = OBSTACLE_HEIGHT_MULTIPLIER;
    const widthRatioByType = OBSTACLE_MAX_WIDTH_RATIO_BY_TYPE;

    const [hMinMul, hMaxMul] = heightMultipliers[def.type] || [0.9, 1.2];
    const randomHeightMul = hMinMul + Math.random() * (hMaxMul - hMinMul);
    const obstacleScaleBoost = isMobile ? MOBILE_OBSTACLE_SCALE_BOOST : 1;
    const duckedAirborneScaleBoost =
      def.airborne && player.isDucking
        ? DUCKED_FLYING_OBSTACLE_SIZE_MULTIPLIER
        : 1;
    const typeScaleBoost = def.airborne
      ? FLYING_OBSTACLE_SIZE_MULTIPLIER * duckedAirborneScaleBoost
      : 1;
    const maxObstacleHeightRatio = def.airborne ? 0.38 : 0.29;
    const targetObstacleHeight = clamp(
      player.height * randomHeightMul * obstacleScaleBoost * typeScaleBoost,
      H * 0.06,
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
    obstacle.width = w;
    obstacle.height = h;
    obstacle.type = def.type;
    obstacle.color = def.color;
    obstacle.airborne = Boolean(def.airborne);
    obstacle.requiredMove = null;
    obstacle.speedMul = 1;
    obstacle.baseY = 0;
    obstacle.bobAmplitude = 0;
    obstacle.bobFrequency = 0;
    obstacle.bobPhase = 0;

    if (obstacle.airborne) {
      const requiredMove = chooseFlyingRequirement();
      lastFlyingRequirement = requiredMove;
      obstacle.requiredMove = requiredMove;
      const laneIndex = pickFlyingLaneIndex(requiredMove);
      lastFlyingLaneIndex = laneIndex;
      obstacle.laneIndex = laneIndex;

      // Force clear movement asks: one lane asks for duck, the other for jump.
      const profile =
        requiredMove === "duck"
          ? FLYING_LANE_PROFILE_BY_TYPE.flyObstacle1
          : FLYING_LANE_PROFILE_BY_TYPE.flyObstacle2;
      const minGroundClearance = Math.max(
        12,
        CONFIG.playerDuckHeight + profile.extraDuckPadding,
        Math.round(player.height * profile.minClearanceHeightMul),
      );
      const maxGroundClearance = Math.max(
        minGroundClearance + 12,
        Math.round(player.height * profile.maxClearanceHeightMul),
      );
      const groundClearance =
        minGroundClearance +
        Math.random() * (maxGroundClearance - minGroundClearance);

      const { topMin, topMax } = getFlyingLaneTopBounds(h);
      const profileTop = clamp(
        CONFIG.groundY - h - groundClearance,
        topMin,
        topMax,
      );
      const laneTop = getFlyingLaneTop(laneIndex, h);
      // Blend lane position with profile constraints so each spawn is varied but fair.
      const blendedTop = clamp(
        Math.round(laneTop * 0.72 + profileTop * 0.28),
        topMin,
        topMax,
      );

      obstacle.y = blendedTop;
      obstacle.baseY = blendedTop;
      obstacle.speedMul =
        FLYING_SPEED_MIN +
        Math.random() * (FLYING_SPEED_MAX - FLYING_SPEED_MIN);
      obstacle.bobAmplitude =
        requiredMove === "duck"
          ? 1.5 + Math.random() * 3.2
          : 0.8 + Math.random() * 2.6;
      obstacle.bobFrequency = 0.014 + Math.random() * 0.02;
      obstacle.bobPhase = Math.random() * Math.PI * 2;
    } else {
      obstacle.y = CONFIG.groundY - h;
      obstacle.baseY = obstacle.y;
    }

    obstacles.push(obstacle);

    // Density (A-phase) is the primary difficulty ramp; speed (B-phase) is secondary.
    const densityScale = Math.max(
      0.5,
      1 - densityPressurePhases * DENSITY_PRESSURE_PER_PHASE,
    );
    const densityGapScale = 1 / OBSTACLE_DENSITY_MULTIPLIER;
    const effectiveMinGap =
      CONFIG.minObstacleGap * densityScale * densityGapScale;
    const effectiveMaxGap = Math.max(
      effectiveMinGap + 22,
      CONFIG.maxObstacleGap * densityScale * densityGapScale,
    );
    const gapRange = effectiveMaxGap - effectiveMinGap;
    const difficultyFactor = Math.min(
      (speed - CONFIG.baseSpeed) / (CONFIG.maxSpeed - CONFIG.baseSpeed),
      1,
    );
    const gap = effectiveMaxGap - gapRange * difficultyFactor * 0.65;

    const prevObstacle =
      obstacles.length > 1 ? obstacles[obstacles.length - 2] : null;
    const backToBackAirborne = Boolean(
      obstacle.airborne && prevObstacle && prevObstacle.airborne,
    );
    const airbornePairExtraGap = backToBackAirborne
      ? clamp(Math.round(effectiveMinGap * 0.18), 14, 36)
      : 0;

    nextObstacleX +=
      gap + Math.random() * (22 * densityGapScale) + airbornePairExtraGap;
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

  function getPlayerHitbox() {
    // Keep ducking visually big but collision-fair by trimming the upper/body silhouette.
    const isDucking = player.isDucking;
    const insetX = player.width * (isDucking ? 0.2 : 0.12);
    const insetTop = player.height * (isDucking ? 0.28 : 0.08);
    const insetBottom = player.height * (isDucking ? 0.08 : 0.06);

    return {
      x: player.x + insetX,
      y: player.y + insetTop,
      width: Math.max(8, player.width - insetX * 2),
      height: Math.max(8, player.height - insetTop - insetBottom),
    };
  }

  // ============================================================
  //  INPUT HANDLING
  // ============================================================
  document.addEventListener("keydown", (e) => {
    keys[e.code] = true;
    if (
      ["Space", "ArrowUp", "ArrowDown", "ShiftLeft", "ShiftRight"].includes(
        e.code,
      )
    ) {
      e.preventDefault();
    }
    // Pause toggle
    if ((e.code === 'Escape' || e.code === 'KeyP') && (gameState === 'playing' || gameState === 'paused')) {
      e.preventDefault();
      if (gameState === 'playing') pauseGame();
      else resumeGame();
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
  // Swipe up => jump, second swipe up => double jump, swipe down => duck.
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
        mobileDuckTimerFrames = MOBILE_DUCK_HOLD_FRAMES;
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
        mobileDuckTimerFrames = MOBILE_DUCK_HOLD_FRAMES;
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
  if (btnSaveName) {
    btnSaveName.addEventListener("click", () => {
      savePlayerName(playerNameInput?.value || "Player");
      setLeaderboardStatus(`Name saved: ${playerName}`);
    });
  }
  if (playerNameInput) {
    playerNameInput.value = playerName;
    playerNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        savePlayerName(playerNameInput.value);
        setLeaderboardStatus(`Name saved: ${playerName}`);
      }
    });
  }

  document.addEventListener("pointerdown", unlockAudio, { passive: true });
  document.addEventListener("keydown", unlockAudio, { passive: true });

  // ===== PAUSE SYSTEM =====
  function pauseGame() {
    if (gameState !== 'playing') return;
    gameState = 'paused';
    paused = true;
    cancelAnimationFrame(animFrame);
    const pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) pauseScreen.classList.remove('hidden');
  }

  function resumeGame() {
    if (gameState !== 'paused') return;
    gameState = 'playing';
    paused = false;
    lastTimestamp = 0; // Prevent deltaTime spike
    const pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) pauseScreen.classList.add('hidden');
    animFrame = requestAnimationFrame(gameLoop);
  }

  const btnPause = document.getElementById('btn-pause');
  if (btnPause) {
    btnPause.addEventListener('click', () => {
      if (gameState === 'playing') pauseGame();
    });
  }
  const btnResume = document.getElementById('btn-resume');
  if (btnResume) {
    btnResume.addEventListener('click', () => {
      resumeGame();
    });
  }
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
    startHomeMusic();
    updateHighScoreDisplays();
    showScreen(homeScreen);
  }

  function advanceDifficultyFromScore(currentScore) {
    const desiredPhase = Math.floor(currentScore / DIFFICULTY_PHASE_SCORE_STEP);
    while (difficultyPhase < desiredPhase) {
      difficultyPhase += 1;
      // Alternate phases: A=density first, B=speed next, then repeat.
      if (difficultyPhase % 2 === 1) {
        densityPressurePhases = Math.min(
          MAX_DENSITY_PRESSURE_PHASES,
          densityPressurePhases + 1,
        );
      } else {
        speedPressurePhases += 1;
      }
      milestoneFlashTimer = 20;
    }

    targetSpeed = Math.min(
      CONFIG.maxSpeed,
      CONFIG.baseSpeed + speedPressurePhases * SPEED_STEP_PER_PHASE,
    );
  }

  // ============================================================
  //  GAME START / RESET
  // ============================================================
  function startGame() {
    unlockAudio();
    score = 0;
    speed = CONFIG.baseSpeed;
    targetSpeed = CONFIG.baseSpeed;
    frameCount = 0;
    lastTimestamp = 0;
    difficultyPhase = 0;
    densityPressurePhases = 0;
    speedPressurePhases = 0;
    obstacles = [];
    nextObstacleX = W + 150;
    gracePeriodTimer = GRACE_PERIOD_FRAMES;

    // Reset game feel
    cameraShakeTimer = 0;
    cameraShakeIntensity = 0;
    milestoneFlashTimer = 0;
    wasJumping = false;
    dustParticles.length = 0;
    speedLines.length = 0;
    squashTimer = 0;
    nearMissTimer = 0;
    nearMissCount = 0;
    newHighScoreReached = false;
    newHighScoreBannerTimer = 0;
    milestoneText = '';
    milestoneTextTimer = 0;
    lastMilestoneIndex = -1;
    isDeathAnimating = false;
    deathAnimTimer = 0;

    // Reset powerups
    activePowerup = null;
    activePowerupTimer = 0;
    powerupItems = [];
    lastPowerupSpawnX = -POWERUP_MIN_GAP;

    // Reset player
    player.y = CONFIG.groundY - CONFIG.playerHeight;
    player.width = CONFIG.playerWidth;
    player.height = CONFIG.playerHeight;
    player.vy = 0;
    player.isJumping = false;
    player.jumpCount = 0;
    player.jumpHoldFrames = 0;
    player.jumpKeyWasDown = false;
    player.isDucking = false;
    player.legFrame = 0;
    player.coyoteTimer = 0;
    player.jumpBufferTimer = 0;
    queuedMobileJumps = 0;
    mobileDuckTimerFrames = 0;
    lastFlyingRequirement = "jump";
    lastFlyingLaneIndex = -1;
    lastObstacleFamily = null;
    obstacleFamilyRunLength = 0;
    obstacleFamilyRunTarget = 1;

    // Reset chaser
    chaser.bobOffset = 0;
    chaser.legFrame = 0;

    // Background
    generateBackground();
    groundOffset = 0;
    bgScrollX = 0;

    // Tutorial for first-time players
    if (!hasSeenTutorial) {
      tutorialActive = true;
      tutorialTimer = 180; // 3 seconds at 60fps
      try { localStorage.setItem('dhakaDashTutorialSeen', '1'); } catch {}
      hasSeenTutorial = true;
    } else {
      tutorialActive = false;
      tutorialTimer = 0;
    }

    // UI
    gameState = "playing";
    paused = false;
    startGameplayMusic();
    showScreen(null);
    hud.classList.remove("hidden");
    const pauseScreen = document.getElementById('pause-screen');
    if (pauseScreen) pauseScreen.classList.add('hidden');
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

    // Screen shake + death animation
    cameraShakeTimer = 12;
    cameraShakeIntensity = 4;
    isDeathAnimating = true;
    deathAnimTimer = DEATH_ANIM_FRAMES;
    deathTumbleAngle = 0;
    deathVY = CONFIG.jumpForce * 0.5;

    const showGameOverUI = () => {
      isDeathAnimating = false;
      startOutroMusic();
      const finalScore = Math.floor(score);
      if (finalScore > highScore) {
        saveHighScore(finalScore);
      }
      finalScoreEl.textContent = finalScore;
      // Show near-miss count in game over
      const nearMissEl = document.getElementById('gameover-nearmiss');
      if (nearMissEl) nearMissEl.textContent = nearMissCount;
      updateHighScoreDisplays();
      showScreen(gameoverScreen);
      submitScoreToLeaderboard(finalScore);
    };

    // Death tumble animation loop
    const deathLoop = () => {
      if (deathAnimTimer > 0) {
        deathAnimTimer--;
        cameraShakeTimer = Math.max(0, cameraShakeTimer - 1);
        deathTumbleAngle += 0.15;
        deathVY += CONFIG.gravity * 0.8;
        player.y += deathVY;
        if (player.y > CONFIG.groundY + 20) {
          player.y = CONFIG.groundY + 20;
        }
        draw();
        requestAnimationFrame(deathLoop);
      } else {
        cameraShakeTimer = 0;
        isDeathAnimating = false;
        draw();
        showGameOverUI();
      }
    };
    requestAnimationFrame(deathLoop);
  }

  // ============================================================
  //  UPDATE LOGIC (per frame)
  // ============================================================
  function update(stepMul) {
    frameCount += stepMul;

    // --- Tutorial timer ---
    if (tutorialActive) {
      tutorialTimer = Math.max(0, tutorialTimer - stepMul);
      if (tutorialTimer <= 0) tutorialActive = false;
      // Any input dismisses tutorial early
      const anyInput = !!(keys["Space"] || keys["ArrowUp"] || keys["ArrowDown"] || keys["ShiftLeft"] || keys["ShiftRight"] || queuedMobileJumps > 0 || mobileDuckTimerFrames > 0);
      if (anyInput) { tutorialActive = false; tutorialTimer = 0; }
    }

    // --- Grace period (no obstacles at game start) ---
    if (gracePeriodTimer > 0) {
      gracePeriodTimer = Math.max(0, gracePeriodTimer - stepMul);
    }

    // --- Camera shake decay ---
    if (cameraShakeTimer > 0)
      cameraShakeTimer = Math.max(0, cameraShakeTimer - stepMul);

    // --- Squash timer decay ---
    if (squashTimer > 0)
      squashTimer = Math.max(0, squashTimer - stepMul);

    // --- Active powerup timer ---
    const effectiveSpeedMul = (activePowerup === 'slow_motion' && activePowerupTimer > 0) ? 0.6 : 1.0;
    if (activePowerupTimer > 0) {
      activePowerupTimer = Math.max(0, activePowerupTimer - stepMul);
      if (activePowerupTimer <= 0) {
        activePowerup = null;
      }
    }

    // --- Score & alternating difficulty phases ---
    const scoreMultiplier = (activePowerup === 'score_multi' && activePowerupTimer > 0) ? 2.0 : 1.0;
    score += CONFIG.scoreRate * speed * stepMul * scoreMultiplier;
    const currentScore = Math.floor(score);
    hudScore.textContent = currentScore;

    // --- New high score detection ---
    if (!newHighScoreReached && currentScore > highScore && highScore > 0) {
      newHighScoreReached = true;
      newHighScoreBannerTimer = 90; // 1.5 seconds
    }
    if (newHighScoreBannerTimer > 0) {
      newHighScoreBannerTimer = Math.max(0, newHighScoreBannerTimer - stepMul);
    }

    // --- Milestone celebration ---
    for (let mi = 0; mi < MILESTONE_SCORES.length; mi++) {
      if (currentScore >= MILESTONE_SCORES[mi] && mi > lastMilestoneIndex) {
        lastMilestoneIndex = mi;
        milestoneText = MILESTONE_LABELS[mi] || '';
        milestoneTextTimer = 60; // 1 second
      }
    }
    if (milestoneTextTimer > 0) {
      milestoneTextTimer = Math.max(0, milestoneTextTimer - stepMul);
    }

    advanceDifficultyFromScore(currentScore);
    speed += (targetSpeed - speed) * SPEED_CATCHUP_RATE * stepMul;
    speed = clamp(speed, CONFIG.baseSpeed, CONFIG.maxSpeed);

    if (milestoneFlashTimer > 0)
      milestoneFlashTimer = Math.max(0, milestoneFlashTimer - stepMul);

    // --- Near-miss decay ---
    if (nearMissTimer > 0) {
      nearMissTimer = Math.max(0, nearMissTimer - stepMul);
    }

    // --- Player jump with coyote time + jump buffering ---
    const jumpKeyDown = !!(keys["Space"] || keys["ArrowUp"]);
    const keyboardJumpPressed = jumpKeyDown && !player.jumpKeyWasDown;
    const mobileJumpPressed = queuedMobileJumps > 0;

    // Coyote time: allow jumping briefly after leaving ground
    if (!player.isJumping) {
      player.coyoteTimer = COYOTE_TIME_FRAMES;
    } else {
      player.coyoteTimer = Math.max(0, (player.coyoteTimer || 0) - stepMul);
    }

    // Jump buffer: remember jump input for a few frames
    if (keyboardJumpPressed || mobileJumpPressed) {
      player.jumpBufferTimer = JUMP_BUFFER_FRAMES;
    } else {
      player.jumpBufferTimer = Math.max(0, (player.jumpBufferTimer || 0) - stepMul);
    }

    // Execute jump: with coyote time (first jump) or normal double jump
    const canFirstJump = player.jumpCount === 0 && (player.coyoteTimer > 0 || !player.isJumping);
    const canDoubleJump = player.jumpCount === 1 && player.isJumping;
    const wantsJump = player.jumpBufferTimer > 0 || keyboardJumpPressed || mobileJumpPressed;

    if (wantsJump && (canFirstJump || canDoubleJump)) {
      player.vy = CONFIG.jumpForce;
      player.isJumping = true;
      player.jumpCount++;
      player.jumpHoldFrames = CONFIG.jumpHoldFrames;
      player.coyoteTimer = 0;
      player.jumpBufferTimer = 0;
      playJumpSfx();

      if (mobileJumpPressed && queuedMobileJumps > 0) queuedMobileJumps--;
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
    mobileDuckTimerFrames = Math.max(0, mobileDuckTimerFrames - stepMul);

    const wantsDuck =
      keys["ArrowDown"] ||
      keys["ShiftLeft"] ||
      keys["ShiftRight"] ||
      mobileDuckTimerFrames > 0;
    if (wantsDuck && !player.isJumping) {
      if (!player.isDucking) {
        player.isDucking = true;
        player.width = Math.max(
          18,
          Math.round(CONFIG.playerDuckWidth * DUCK_SQUASH_SCALE),
        );
        player.height = Math.max(
          18,
          Math.round(CONFIG.playerDuckHeight * DUCK_SQUASH_SCALE),
        );
        player.y = CONFIG.groundY - player.height;
      }
    } else if (player.isDucking) {
      player.isDucking = false;
      player.width = CONFIG.playerWidth;
      player.height = CONFIG.playerHeight;
      player.y = CONFIG.groundY - CONFIG.playerHeight;
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
        // Landing squash + dust burst
        squashTimer = SQUASH_FRAMES;
        spawnDust(player.x + player.width / 2, CONFIG.groundY, 6, true);
      }
    }

    // Running dust when on ground
    if (!player.isJumping && !player.isDucking && Math.random() < 0.25) {
      spawnDust(player.x, CONFIG.groundY, 1, false);
    }

    // Track jump state for effects
    wasJumping = player.isJumping;

    // --- Leg animation ---
    player.legFrame += 0.19 * stepMul;
    chaser.legFrame += 0.19 * stepMul;

    // --- Chaser bob ---
    chaser.bobOffset = Math.sin(frameCount * 0.06) * 1;

    // --- Effective speed (slow motion powerup) ---
    const worldSpeed = speed * effectiveSpeedMul;

    // --- Move obstacles ---
    for (let i = obstacles.length - 1; i >= 0; i--) {
      const obstacle = obstacles[i];
      obstacle.x -= worldSpeed * (obstacle.speedMul || 1) * stepMul;

      if (obstacle.airborne) {
        const bobY =
          obstacle.baseY +
          Math.sin(frameCount * obstacle.bobFrequency + obstacle.bobPhase) *
            obstacle.bobAmplitude;
        obstacle.y = clamp(
          bobY,
          Math.round(H * 0.06),
          CONFIG.groundY - obstacle.height - 10,
        );
      }

      if (obstacle.x + obstacle.width < -80) {
        recycleObstacleAt(i);
      }
    }

    // --- Move powerup items ---
    for (let i = powerupItems.length - 1; i >= 0; i--) {
      const pu = powerupItems[i];
      pu.x -= worldSpeed * stepMul;
      pu.bobPhase += POWERUP_BOB_SPEED * stepMul;
      pu.drawY = pu.baseY + Math.sin(pu.bobPhase) * POWERUP_BOB_AMP;

      // Collect powerup
      const puHitbox = { x: pu.x, y: pu.drawY, width: POWERUP_SIZE, height: POWERUP_SIZE };
      const pBox = getPlayerHitbox();
      if (rectsOverlap(pBox, puHitbox)) {
        activePowerup = pu.type;
        const puDef = POWERUP_TYPES.find(d => d.type === pu.type);
        activePowerupTimer = puDef ? puDef.duration : 180;
        powerupItems.splice(i, 1);
        // Visual feedback: brief flash
        milestoneFlashTimer = 10;
        continue;
      }

      if (pu.x + POWERUP_SIZE < -20) {
        powerupItems.splice(i, 1);
      }
    }

    // --- Spawn new obstacles (respects grace period) ---
    if (gracePeriodTimer <= 0) {
      if (
        obstacles.length === 0 ||
        nextObstacleX - (W - (obstacles[obstacles.length - 1]?.x || 0)) < W * 2
      ) {
        if (nextObstacleX < W + worldSpeed * 120) {
          spawnObstacle();
        }
      }
      let rightmostX = 0;
      for (const obstacle of obstacles) {
        const obstacleRight = obstacle.x + obstacle.width;
        if (obstacleRight > rightmostX) rightmostX = obstacleRight;
      }
      const spawnLookahead = W + Math.round(W * 0.78);
      while (rightmostX < spawnLookahead) {
        nextObstacleX = Math.max(
          nextObstacleX,
          rightmostX + CONFIG.minObstacleGap * (1 / OBSTACLE_DENSITY_MULTIPLIER),
        );
        spawnObstacle();
        rightmostX = 0;
        for (const o of obstacles) {
          const obstacleRight = o.x + o.width;
          if (obstacleRight > rightmostX) rightmostX = obstacleRight;
        }
      }

      // --- Spawn powerups ---
      if (powerupItems.length === 0 && !activePowerup && currentScore > 0) {
        const rightEdge = rightmostX || nextObstacleX;
        if (rightEdge - lastPowerupSpawnX > POWERUP_MIN_GAP) {
          for (const puDef of POWERUP_TYPES) {
            if (currentScore >= puDef.minScore && Math.random() < puDef.chance * 0.3) {
              const puX = rightEdge + CONFIG.minObstacleGap * 0.5 + Math.random() * 60;
              const puY = CONFIG.groundY - POWERUP_SIZE - 10 - Math.random() * 30;
              powerupItems.push({
                type: puDef.type,
                x: puX,
                baseY: puY,
                drawY: puY,
                bobPhase: Math.random() * Math.PI * 2,
              });
              lastPowerupSpawnX = puX;
              break; // Only spawn one at a time
            }
          }
        }
      }
    }

    // --- Collision detection ---
    const playerBox = getPlayerHitbox();
    for (const obs of obstacles) {
      const duckCounterAirborne =
        obs.airborne && obs.requiredMove === "duck" && player.isDucking;
      const insetX = Math.max(
        3,
        obs.width * (obs.airborne ? (duckCounterAirborne ? 0.24 : 0.2) : 0.15),
      );
      const insetY = Math.max(
        2,
        obs.height * (obs.airborne ? (duckCounterAirborne ? 0.2 : 0.16) : 0.1),
      );
      const obstacleHitbox = {
        x: obs.x + insetX,
        y: obs.y + insetY,
        width: Math.max(2, obs.width - insetX * 2),
        height: Math.max(2, obs.height - insetY * 2),
      };

      if (rectsOverlap(playerBox, obstacleHitbox)) {
        // Chai Shield: absorb one hit
        if (activePowerup === 'chai_shield' && activePowerupTimer > 0) {
          activePowerup = null;
          activePowerupTimer = 0;
          // Remove the obstacle that was hit
          const obsIdx = obstacles.indexOf(obs);
          if (obsIdx >= 0) recycleObstacleAt(obsIdx);
          cameraShakeTimer = 4;
          cameraShakeIntensity = 2;
          break; // Skip further collision checks this frame
        }
        triggerGameOver();
        return;
      }

      // --- Near-miss detection ---
      if (obs.x + obs.width < player.x + player.width && obs.x + obs.width > player.x - 5) {
        // Obstacle just passed the player
        const expandedHitbox = {
          x: obstacleHitbox.x - NEAR_MISS_THRESHOLD,
          y: obstacleHitbox.y - NEAR_MISS_THRESHOLD,
          width: obstacleHitbox.width + NEAR_MISS_THRESHOLD * 2,
          height: obstacleHitbox.height + NEAR_MISS_THRESHOLD * 2,
        };
        if (rectsOverlap(playerBox, expandedHitbox) && !obs._nearMissCounted) {
          obs._nearMissCounted = true;
          nearMissTimer = NEAR_MISS_DISPLAY_FRAMES;
          nearMissX = player.x + player.width;
          nearMissY = player.y - 8;
          nearMissCount++;
        }
      }
    }

    // --- Background scroll ---
    groundOffset = (groundOffset + worldSpeed * stepMul) % 30;
    bgScrollX += worldSpeed * 0.35 * stepMul;

    for (const c of clouds) {
      c.x -= worldSpeed * c.speed * stepMul;
      if (c.x + c.width < -20) c.x = W + 20 + Math.random() * 100;
    }

    for (const b of buildings) {
      b.x -= worldSpeed * b.speed * stepMul;
      if (b.x + b.width < -30) b.x = W + Math.random() * 80;
    }

    for (const p of palms) {
      p.x -= worldSpeed * p.speed * stepMul;
      if (p.x < -30) p.x = W + Math.random() * 60;
    }

    // --- Update particles ---
    updateParticles(stepMul);
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
        player.isDucking && duckSpriteReady
          ? duckImg
          : player.isJumping && jumpSpriteReady
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
        (player.isJumping && jumpSpriteReady) ||
        (player.isDucking && duckSpriteReady)
      ) {
        const activeSprite = player.isDucking ? duckImg : jumpImg;
        const activeAspect =
          activeSprite.naturalWidth / activeSprite.naturalHeight;
        dh = baseDh;
        dw = dh * activeAspect;
        const centerX = (px + pw / 2) * PIXEL_SCALE;
        dx = centerX - dw / 2;
        // Keep feet alignment by matching the bottom edge of the base sprite box.
        dy = baseDy + baseDh - dh;
      }

      // Landing squash/stretch transform
      if (squashTimer > 0 && !player.isJumping && !player.isDucking) {
        const t = squashTimer / SQUASH_FRAMES;
        const sx = 1 + (SQUASH_SCALE_X - 1) * t;
        const sy = 1 + (SQUASH_SCALE_Y - 1) * t;
        const centerX = dx + dw / 2;
        const bottomY = dy + dh;
        displayCtx.save();
        displayCtx.translate(centerX, bottomY);
        displayCtx.scale(sx, sy);
        displayCtx.translate(-centerX, -bottomY);
      }

      // Death tumble rotation
      if (isDeathAnimating) {
        const centerX = dx + dw / 2;
        const centerY = dy + dh / 2;
        displayCtx.save();
        displayCtx.translate(centerX, centerY);
        displayCtx.rotate(deathTumbleAngle);
        displayCtx.translate(-centerX, -centerY);
      }

      // Chai Shield glow
      if (activePowerup === 'chai_shield' && activePowerupTimer > 0) {
        displayCtx.shadowColor = '#f0c040';
        displayCtx.shadowBlur = 12 + Math.sin(frameCount * 0.15) * 4;
      }

      displayCtx.drawImage(frame, dx, dy, dw, dh);

      // Reset effects
      displayCtx.shadowColor = 'transparent';
      displayCtx.shadowBlur = 0;

      if (isDeathAnimating) displayCtx.restore();
      if (squashTimer > 0 && !player.isJumping && !player.isDucking) displayCtx.restore();
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
    if (obstacleSpriteCount >= 5 && sprite && sprite.complete) {
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
  function draw() {
    ctx.clearRect(0, 0, W, H);
    displayCtx.clearRect(0, 0, displayW, displayH);

    // Apply camera shake offset
    const shakeX =
      cameraShakeTimer > 0
        ? (Math.random() - 0.5) * cameraShakeIntensity * 2
        : 0;
    const shakeY =
      cameraShakeTimer > 0
        ? (Math.random() - 0.5) * cameraShakeIntensity * 2
        : 0;
    if (shakeX || shakeY) {
      displayCtx.save();
      displayCtx.translate(shakeX * PIXEL_SCALE, shakeY * PIXEL_SCALE);
      ctx.save();
      ctx.translate(shakeX, shakeY);
    }

    // Draw background at full resolution on display canvas (sharp)
    drawBackground();

    // Draw ground on offscreen canvas (only if no bg image)
    drawGround();

    // Draw particles on offscreen canvas (behind characters)
    drawParticles();

    // Draw fallback characters on offscreen canvas (only if sprites not loaded)
    if (chaseSpritesReady < 2) drawChaser();
    if (chaserSpritesReady < 2) drawPlayer();

    // Blit low-res offscreen canvas to display canvas (pixelated upscale)
    displayCtx.drawImage(offCanvas, 0, 0, displayW, displayH);

    // Draw obstacles on full-res display canvas (after blit for sharp rendering)
    for (const obs of obstacles) {
      drawObstacle(obs);
    }

    // Draw powerup items on display canvas
    for (const pu of powerupItems) {
      const puDef = POWERUP_TYPES.find(d => d.type === pu.type);
      if (!puDef) continue;
      const S = PIXEL_SCALE;
      const px = pu.x * S;
      const py = pu.drawY * S;
      const ps = POWERUP_SIZE * S;

      // Glow
      displayCtx.shadowColor = puDef.color;
      displayCtx.shadowBlur = 8 + Math.sin(frameCount * 0.1) * 4;

      // Circle background
      displayCtx.fillStyle = puDef.color;
      displayCtx.globalAlpha = 0.85;
      displayCtx.beginPath();
      displayCtx.arc(px + ps / 2, py + ps / 2, ps / 2, 0, Math.PI * 2);
      displayCtx.fill();
      displayCtx.globalAlpha = 1;

      // Icon text
      displayCtx.shadowBlur = 0;
      displayCtx.shadowColor = 'transparent';
      displayCtx.font = `${Math.round(ps * 0.6)}px sans-serif`;
      displayCtx.textAlign = 'center';
      displayCtx.textBaseline = 'middle';
      displayCtx.fillStyle = '#fff';
      displayCtx.fillText(puDef.icon, px + ps / 2, py + ps / 2 + 1);
    }
    displayCtx.shadowBlur = 0;
    displayCtx.shadowColor = 'transparent';

    // Draw character sprites at full resolution AFTER blit (crisp, no pixelation)
    if (chaseSpritesReady >= 2) drawChaser();
    if (chaserSpritesReady >= 2) drawPlayer();

    // --- Ducking indicator ---
    if (player.isDucking && gameState === 'playing') {
      displayCtx.fillStyle = 'rgba(0, 106, 78, 0.04)';
      displayCtx.fillRect(0, 0, displayW, displayH);
    }

    // --- Active powerup HUD indicator ---
    if (activePowerup && activePowerupTimer > 0) {
      const puDef = POWERUP_TYPES.find(d => d.type === activePowerup);
      if (puDef) {
        const hx = 10 * PIXEL_SCALE;
        const hy = 10 * PIXEL_SCALE;
        const barW = 60 * PIXEL_SCALE;
        const barH = 6 * PIXEL_SCALE;
        const pct = activePowerupTimer / puDef.duration;

        // Background bar
        displayCtx.fillStyle = 'rgba(0,0,0,0.4)';
        displayCtx.fillRect(hx, hy, barW, barH);
        // Fill bar
        displayCtx.fillStyle = puDef.color;
        displayCtx.fillRect(hx, hy, barW * pct, barH);
        // Border
        displayCtx.strokeStyle = 'rgba(255,255,255,0.5)';
        displayCtx.lineWidth = 1;
        displayCtx.strokeRect(hx, hy, barW, barH);
        // Icon + label
        displayCtx.font = `bold ${11 * PIXEL_SCALE}px sans-serif`;
        displayCtx.fillStyle = puDef.color;
        displayCtx.textAlign = 'left';
        displayCtx.textBaseline = 'top';
        displayCtx.fillText(`${puDef.icon} ${puDef.label}`, hx, hy + barH + 2);
      }
    }

    // --- Score multiplier indicator ---
    if (activePowerup === 'score_multi' && activePowerupTimer > 0) {
      const pulse = 1 + Math.sin(frameCount * 0.2) * 0.15;
      displayCtx.font = `bold ${Math.round(14 * PIXEL_SCALE * pulse)}px sans-serif`;
      displayCtx.fillStyle = '#ffd700';
      displayCtx.textAlign = 'right';
      displayCtx.textBaseline = 'top';
      displayCtx.fillText('×2', displayW - 10 * PIXEL_SCALE, 28 * PIXEL_SCALE);
    }

    // --- Slow motion vignette ---
    if (activePowerup === 'slow_motion' && activePowerupTimer > 0) {
      const vigAlpha = 0.08 + Math.sin(frameCount * 0.08) * 0.03;
      const vig = displayCtx.createRadialGradient(
        displayW / 2, displayH / 2, displayW * 0.3,
        displayW / 2, displayH / 2, displayW * 0.7
      );
      vig.addColorStop(0, 'rgba(102, 217, 239, 0)');
      vig.addColorStop(1, `rgba(102, 217, 239, ${vigAlpha})`);
      displayCtx.fillStyle = vig;
      displayCtx.fillRect(0, 0, displayW, displayH);
    }

    // --- Near-miss text ---
    if (nearMissTimer > 0) {
      const nmAlpha = clamp(nearMissTimer / NEAR_MISS_DISPLAY_FRAMES, 0, 1);
      const nmY = nearMissY * PIXEL_SCALE - (NEAR_MISS_DISPLAY_FRAMES - nearMissTimer) * 0.5;
      displayCtx.font = `bold ${10 * PIXEL_SCALE}px sans-serif`;
      displayCtx.fillStyle = `rgba(240, 192, 64, ${nmAlpha})`;
      displayCtx.textAlign = 'left';
      displayCtx.textBaseline = 'bottom';
      displayCtx.fillText('কাছে! 😮', nearMissX * PIXEL_SCALE + 4, nmY);
    }

    // --- Milestone celebration text ---
    if (milestoneTextTimer > 0 && milestoneText) {
      const mtAlpha = clamp(milestoneTextTimer / 30, 0, 1);
      const mtScale = 1 + (1 - milestoneTextTimer / 60) * 0.3;
      displayCtx.font = `bold ${Math.round(18 * PIXEL_SCALE * mtScale)}px sans-serif`;
      displayCtx.fillStyle = `rgba(240, 192, 64, ${mtAlpha})`;
      displayCtx.textAlign = 'center';
      displayCtx.textBaseline = 'middle';
      displayCtx.fillText(milestoneText, displayW / 2, displayH * 0.3);
    }

    // --- New high score banner ---
    if (newHighScoreBannerTimer > 0) {
      const hsAlpha = clamp(newHighScoreBannerTimer / 40, 0, 1);
      const pulse = 1 + Math.sin(frameCount * 0.2) * 0.08;
      displayCtx.font = `bold ${Math.round(14 * PIXEL_SCALE * pulse)}px sans-serif`;
      displayCtx.fillStyle = `rgba(240, 192, 64, ${hsAlpha})`;
      displayCtx.textAlign = 'center';
      displayCtx.textBaseline = 'middle';
      displayCtx.fillText('🏆 নতুন রেকর্ড!', displayW / 2, displayH * 0.2);
    }

    // --- Tutorial overlay ---
    if (tutorialActive && tutorialTimer > 0) {
      const tAlpha = clamp(tutorialTimer / 60, 0, 0.7);
      displayCtx.fillStyle = `rgba(0, 0, 0, ${tAlpha * 0.5})`;
      displayCtx.fillRect(0, 0, displayW, displayH);
      displayCtx.font = `bold ${16 * PIXEL_SCALE}px sans-serif`;
      displayCtx.fillStyle = `rgba(255, 255, 255, ${tAlpha})`;
      displayCtx.textAlign = 'center';
      displayCtx.textBaseline = 'middle';
      displayCtx.fillText('⬆️ লাফ দিন  |  ⬇️ নিচু হন', displayW / 2, displayH / 2);
      displayCtx.font = `${10 * PIXEL_SCALE}px sans-serif`;
      displayCtx.fillStyle = `rgba(200, 200, 200, ${tAlpha * 0.8})`;
      displayCtx.fillText('যেকোনো বোতাম চাপুন', displayW / 2, displayH / 2 + 24 * PIXEL_SCALE);
    }

    // Milestone flash overlay
    if (milestoneFlashTimer > 0) {
      const flashAlpha = clamp(milestoneFlashTimer / 20, 0, 0.12);
      displayCtx.fillStyle = `rgba(240, 192, 64, ${flashAlpha})`;
      displayCtx.fillRect(0, 0, displayW, displayH);
    }

    // Death red flash
    if (cameraShakeTimer > 0) {
      const hitAlpha = clamp(cameraShakeTimer / 12, 0, 0.18);
      displayCtx.fillStyle = `rgba(244, 42, 65, ${hitAlpha})`;
      displayCtx.fillRect(0, 0, displayW, displayH);
    }

    if (shakeX || shakeY) {
      ctx.restore();
      displayCtx.restore();
    }
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
  fetchLeaderboard();
  startHomeMusic();

  // Draw a static preview scene on the home screen canvas
  generateBackground();
  draw();
})();
