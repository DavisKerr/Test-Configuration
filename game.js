/**
 * Cyber Snake - HTML5 Canvas Snake Game
 */

class SoundEffects {
  constructor() {
    this.ctx = null;
    this.enabled = true;
  }

  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  playTone(freq, type, duration, startGain = 0.3, endGain = 0.01) {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

      gain.gain.setValueAtTime(startGain, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(endGain, this.ctx.currentTime + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch (e) {
      console.warn("Audio error", e);
    }
  }

  playEat() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.1);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.1);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.1);
    } catch (e) {}
  }

  playBonus() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const freqs = [400, 600, 800, 1200];
      freqs.forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.05);
        gain.gain.setValueAtTime(0.2, now + idx * 0.05);
        gain.gain.exponentialRampToValueAtTime(0.01, now + idx * 0.05 + 0.08);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(now + idx * 0.05);
        osc.stop(now + idx * 0.05 + 0.08);
      });
    } catch (e) {}
  }

  playGameOver() {
    if (!this.enabled) return;
    try {
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(300, now);
      osc.frequency.linearRampToValueAtTime(80, now + 0.5);

      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.01, now + 0.5);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + 0.5);
    } catch (e) {}
  }

  playTurn() {
    this.playTone(180, 'sine', 0.03, 0.05, 0.001);
  }
}

class SnakeGame {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx = this.canvas.getContext('2d');

    this.gridSize = 20; // 20x20 grid
    this.tileSize = this.canvas.width / this.gridSize; // 24px

    // DOM Elements
    this.scoreEl = document.getElementById('score');
    this.highScoreEl = document.getElementById('high-score');
    this.multiplierEl = document.getElementById('multiplier');
    this.startModal = document.getElementById('startModal');
    this.pauseModal = document.getElementById('pauseModal');
    this.gameOverModal = document.getElementById('gameOverModal');
    this.finalScoreEl = document.getElementById('finalScore');
    this.finalHighScoreEl = document.getElementById('finalHighScore');
    this.newHighScoreNotice = document.getElementById('newHighScoreNotice');
    this.bonusBarContainer = document.getElementById('bonusBarContainer');
    this.bonusProgress = document.getElementById('bonusProgress');
    this.difficultySelect = document.getElementById('difficultySelect');
    this.wallModeSelect = document.getElementById('wallModeSelect');
    this.obstacleSelect = document.getElementById('obstacleSelect');
    this.soundToggleBtn = document.getElementById('soundToggle');

    this.sound = new SoundEffects();

    // Game State
    this.score = 0;
    this.highScore = parseInt(localStorage.getItem('cybersnake_highscore')) || 0;
    this.speed = 120; // ms per tick
    this.gameState = 'START'; // 'START', 'PLAYING', 'PAUSED', 'GAMEOVER'
    this.wallMode = 'solid'; // 'solid' or 'wrap'
    this.obstacleMode = 'none'; // 'none', 'few', 'many'
    this.obstacles = [];
    this.difficulty = 'medium';

    this.snake = [];
    this.direction = { x: 1, y: 0 };
    this.nextDirections = [];

    this.food = null;
    this.bonusFood = null;
    this.bonusTimer = 0;
    this.bonusMaxDuration = 5000; // 5 seconds
    this.bonusStartTime = 0;
    this.foodEatenCount = 0;

    this.particles = [];
    this.lastRenderTime = 0;
    this.moveAccumulator = 0;

    this.initHUD();
    this.bindEvents();
    this.resetGame();

    // Start animation loop
    requestAnimationFrame((time) => this.gameLoop(time));
  }

  initHUD() {
    this.highScoreEl.textContent = this.padScore(this.highScore);
    this.scoreEl.textContent = this.padScore(0);
    this.multiplierEl.textContent = '1.0x';
  }

  padScore(num) {
    return num.toString().padStart(4, '0');
  }

  resetGame() {
    const startX = Math.floor(this.gridSize / 4);
    const startY = Math.floor(this.gridSize / 2);
    this.snake = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY }
    ];
    this.direction = { x: 1, y: 0 };
    this.nextDirections = [];
    this.score = 0;
    this.foodEatenCount = 0;
    this.bonusFood = null;
    this.particles = [];
    this.scoreEl.textContent = this.padScore(0);

    this.generateObstacles();
    this.spawnFood();
  }

  generateObstacles() {
    this.obstacles = [];
    let count = 0;
    if (this.obstacleMode === 'few') count = 6;
    if (this.obstacleMode === 'many') count = 15;

    if (count === 0) return;

    const startX = Math.floor(this.gridSize / 4);
    const startY = Math.floor(this.gridSize / 2);

    let attempts = 0;
    while (this.obstacles.length < count && attempts < 1000) {
      attempts++;
      const x = Math.floor(Math.random() * this.gridSize);
      const y = Math.floor(Math.random() * this.gridSize);

      // Keep starting area clear (snake body and 5 units ahead/surrounding)
      if (x >= startX - 3 && x <= startX + 5 && y >= startY - 2 && y <= startY + 2) {
        continue;
      }

      // Avoid duplicate obstacles
      if (this.obstacles.some(obs => obs.x === x && obs.y === y)) {
        continue;
      }

      this.obstacles.push({ x, y });
    }
  }

  setDifficulty(diff) {
    this.difficulty = diff;
    switch (diff) {
      case 'easy':
        this.speed = 150;
        break;
      case 'medium':
        this.speed = 110;
        break;
      case 'hard':
        this.speed = 80;
        break;
      case 'insane':
        this.speed = 50;
        break;
    }
  }

  spawnFood() {
    let valid = false;
    let newX, newY;
    while (!valid) {
      newX = Math.floor(Math.random() * this.gridSize);
      newY = Math.floor(Math.random() * this.gridSize);
      valid = !this.snake.some(segment => segment.x === newX && segment.y === newY) &&
              !this.obstacles.some(obs => obs.x === newX && obs.y === newY);
      if (this.bonusFood && this.bonusFood.x === newX && this.bonusFood.y === newY) {
        valid = false;
      }
    }
    this.food = { x: newX, y: newY, pulse: 0 };
  }

  spawnBonusFood() {
    let valid = false;
    let newX, newY;
    while (!valid) {
      newX = Math.floor(Math.random() * this.gridSize);
      newY = Math.floor(Math.random() * this.gridSize);
      valid = !this.snake.some(segment => segment.x === newX && segment.y === newY) &&
              !this.obstacles.some(obs => obs.x === newX && obs.y === newY) &&
              !(this.food.x === newX && this.food.y === newY);
    }
    this.bonusFood = { x: newX, y: newY };
    this.bonusStartTime = performance.now();
    this.bonusBarContainer.classList.remove('hidden');
  }

  createParticles(x, y, color, count = 12) {
    const px = (x + 0.5) * this.tileSize;
    const py = (y + 0.5) * this.tileSize;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = Math.random() * 4 + 1;
      this.particles.push({
        x: px,
        y: py,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color: color,
        life: 1.0,
        decay: Math.random() * 0.04 + 0.02,
        size: Math.random() * 4 + 2
      });
    }
  }

  updateParticles() {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.life -= p.decay;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
      }
    }
  }

  drawParticles() {
    this.particles.forEach(p => {
      this.ctx.save();
      this.ctx.globalAlpha = p.life;
      this.ctx.fillStyle = p.color;
      this.ctx.shadowColor = p.color;
      this.ctx.shadowBlur = 8;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    });
  }

  bindEvents() {
    // Keyboard Controls
    window.addEventListener('keydown', (e) => {
      this.handleKeyDown(e);
    });

    // Touch Swipe Controls
    let touchStartX = 0;
    let touchStartY = 0;
    this.canvas.addEventListener('touchstart', (e) => {
      touchStartX = e.changedTouches[0].screenX;
      touchStartY = e.changedTouches[0].screenY;
    }, { passive: true });

    this.canvas.addEventListener('touchend', (e) => {
      const diffX = e.changedTouches[0].screenX - touchStartX;
      const diffY = e.changedTouches[0].screenY - touchStartY;
      if (Math.abs(diffX) > Math.abs(diffY)) {
        if (Math.abs(diffX) > 20) {
          this.setDirection(diffX > 0 ? { x: 1, y: 0 } : { x: -1, y: 0 });
        }
      } else {
        if (Math.abs(diffY) > 20) {
          this.setDirection(diffY > 0 ? { x: 0, y: 1 } : { x: 0, y: -1 });
        }
      }
    }, { passive: true });

    // D-Pad Touch Buttons
    document.getElementById('btnUp').addEventListener('click', () => this.setDirection({ x: 0, y: -1 }));
    document.getElementById('btnDown').addEventListener('click', () => this.setDirection({ x: 0, y: 1 }));
    document.getElementById('btnLeft').addEventListener('click', () => this.setDirection({ x: -1, y: 0 }));
    document.getElementById('btnRight').addEventListener('click', () => this.setDirection({ x: 1, y: 0 }));

    // Buttons & Settings UI
    document.getElementById('startBtn').addEventListener('click', () => this.startGame());
    document.getElementById('resumeBtn').addEventListener('click', () => this.togglePause());
    document.getElementById('restartBtnPause').addEventListener('click', () => {
      this.pauseModal.classList.add('hidden');
      this.startGame();
    });
    document.getElementById('restartBtn').addEventListener('click', () => {
      this.gameOverModal.classList.add('hidden');
      this.startGame();
    });

    this.soundToggleBtn.addEventListener('click', () => {
      this.sound.enabled = !this.sound.enabled;
      this.soundToggleBtn.textContent = this.sound.enabled ? 'ON' : 'OFF';
      this.soundToggleBtn.classList.toggle('active', this.sound.enabled);
    });
  }

  handleKeyDown(e) {
    if (this.gameState === 'START' || this.gameState === 'GAMEOVER') {
      if (e.code === 'Enter' || e.code === 'Space') {
        if (this.gameState === 'START') this.startGame();
        else {
          this.gameOverModal.classList.add('hidden');
          this.startGame();
        }
      }
      return;
    }

    if (e.code === 'KeyP' || e.code === 'Space' || e.code === 'Escape') {
      this.togglePause();
      return;
    }

    if (e.code === 'KeyM') {
      this.sound.enabled = !this.sound.enabled;
      this.soundToggleBtn.textContent = this.sound.enabled ? 'ON' : 'OFF';
      this.soundToggleBtn.classList.toggle('active', this.sound.enabled);
      return;
    }

    if (this.gameState !== 'PLAYING') return;

    let dir = null;
    switch (e.code) {
      case 'ArrowUp':
      case 'KeyW':
        dir = { x: 0, y: -1 };
        break;
      case 'ArrowDown':
      case 'KeyS':
        dir = { x: 0, y: 1 };
        break;
      case 'ArrowLeft':
      case 'KeyA':
        dir = { x: -1, y: 0 };
        break;
      case 'ArrowRight':
      case 'KeyD':
        dir = { x: 1, y: 0 };
        break;
    }

    if (dir) {
      this.setDirection(dir);
    }
  }

  setDirection(dir) {
    if (this.gameState !== 'PLAYING') return;
    const lastDir = this.nextDirections.length > 0
      ? this.nextDirections[this.nextDirections.length - 1]
      : this.direction;

    // Prevent 180-degree immediate reversal
    if (lastDir.x + dir.x === 0 && lastDir.y + dir.y === 0) return;

    // Limit queued inputs to 2 to keep controls responsive
    if (this.nextDirections.length < 2) {
      this.nextDirections.push(dir);
      this.sound.playTurn();
    }
  }

  startGame() {
    this.sound.init();
    this.setDifficulty(this.difficultySelect.value);
    this.wallMode = this.wallModeSelect.value;
    this.obstacleMode = this.obstacleSelect ? this.obstacleSelect.value : 'none';

    let multStr = '1.0x';
    if (this.difficulty === 'medium') multStr = '1.5x';
    if (this.difficulty === 'hard') multStr = '2.0x';
    if (this.difficulty === 'insane') multStr = '3.0x';
    this.multiplierEl.textContent = multStr;

    this.startModal.classList.add('hidden');
    this.pauseModal.classList.add('hidden');
    this.gameOverModal.classList.add('hidden');
    this.bonusBarContainer.classList.add('hidden');

    this.resetGame();
    this.gameState = 'PLAYING';
  }

  togglePause() {
    if (this.gameState === 'PLAYING') {
      this.gameState = 'PAUSED';
      this.pauseModal.classList.remove('hidden');
    } else if (this.gameState === 'PAUSED') {
      this.gameState = 'PLAYING';
      this.pauseModal.classList.add('hidden');
      if (this.bonusFood) {
        // Adjust start time for pause duration offset
        this.bonusStartTime = performance.now() - (this.bonusMaxDuration - this.bonusTimer);
      }
    }
  }

  update(now) {
    if (this.gameState !== 'PLAYING') return;

    // Process queued movement direction
    if (this.nextDirections.length > 0) {
      this.direction = this.nextDirections.shift();
    }

    const head = {
      x: this.snake[0].x + this.direction.x,
      y: this.snake[0].y + this.direction.y
    };

    // Wall Collision / Wrap-around
    if (this.wallMode === 'wrap') {
      if (head.x < 0) head.x = this.gridSize - 1;
      if (head.x >= this.gridSize) head.x = 0;
      if (head.y < 0) head.y = this.gridSize - 1;
      if (head.y >= this.gridSize) head.y = 0;
    } else {
      if (head.x < 0 || head.x >= this.gridSize || head.y < 0 || head.y >= this.gridSize) {
        this.gameOver();
        return;
      }
    }

    // Self Collision
    if (this.snake.some(segment => segment.x === head.x && segment.y === head.y)) {
      this.gameOver();
      return;
    }

    // Obstacle Collision
    if (this.obstacles.some(obs => obs.x === head.x && obs.y === head.y)) {
      this.gameOver();
      return;
    }

    // Move Snake
    this.snake.unshift(head);

    // Check Food Collision
    let ate = false;

    if (head.x === this.food.x && head.y === this.food.y) {
      ate = true;
      let points = 10;
      if (this.difficulty === 'medium') points = 15;
      if (this.difficulty === 'hard') points = 20;
      if (this.difficulty === 'insane') points = 30;

      this.score += points;
      this.foodEatenCount++;
      this.sound.playEat();
      this.createParticles(this.food.x, this.food.y, '#39ff14', 15);
      this.spawnFood();

      // Trigger bonus food every 5 foods
      if (this.foodEatenCount % 5 === 0 && !this.bonusFood) {
        this.spawnBonusFood();
      }
    }

    // Check Bonus Food Collision
    if (this.bonusFood && head.x === this.bonusFood.x && head.y === this.bonusFood.y) {
      ate = true;
      const bonusPoints = 50 * (this.difficulty === 'insane' ? 3 : this.difficulty === 'hard' ? 2 : 1);
      this.score += bonusPoints;
      this.sound.playBonus();
      this.createParticles(this.bonusFood.x, this.bonusFood.y, '#ffe600', 25);
      this.bonusFood = null;
      this.bonusBarContainer.classList.add('hidden');
    }

    if (!ate) {
      this.snake.pop(); // Remove tail
    }

    // Update Scores
    this.scoreEl.textContent = this.padScore(this.score);
    if (this.score > this.highScore) {
      this.highScore = this.score;
      this.highScoreEl.textContent = this.padScore(this.highScore);
      localStorage.setItem('cybersnake_highscore', this.highScore);
    }

    // Update Bonus Food Timer
    if (this.bonusFood) {
      const elapsed = now - this.bonusStartTime;
      this.bonusTimer = this.bonusMaxDuration - elapsed;
      if (this.bonusTimer <= 0) {
        this.bonusFood = null;
        this.bonusBarContainer.classList.add('hidden');
      } else {
        const pct = Math.max(0, (this.bonusTimer / this.bonusMaxDuration) * 100);
        this.bonusProgress.style.width = `${pct}%`;
      }
    }
  }

  gameOver() {
    this.gameState = 'GAMEOVER';
    this.sound.playGameOver();

    // Create explosion effect around head
    if (this.snake.length > 0) {
      this.createParticles(this.snake[0].x, this.snake[0].y, '#ff2a6d', 30);
    }

    this.finalScoreEl.textContent = this.score;
    this.finalHighScoreEl.textContent = this.highScore;

    if (this.score > 0 && this.score >= this.highScore) {
      this.newHighScoreNotice.classList.remove('hidden');
    } else {
      this.newHighScoreNotice.classList.add('hidden');
    }

    setTimeout(() => {
      this.gameOverModal.classList.remove('hidden');
    }, 400);
  }

  gameLoop(time) {
    if (!this.lastRenderTime) this.lastRenderTime = time;
    const deltaTime = time - this.lastRenderTime;
    this.lastRenderTime = time;

    if (this.gameState === 'PLAYING') {
      this.moveAccumulator += deltaTime;
      if (this.moveAccumulator >= this.speed) {
        this.update(time);
        this.moveAccumulator = 0;
      }
    }

    this.updateParticles();
    this.draw();

    requestAnimationFrame((t) => this.gameLoop(t));
  }

  draw() {
    // Clear Background
    this.ctx.fillStyle = '#050608';
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw Grid Lines
    this.ctx.strokeStyle = 'rgba(102, 252, 241, 0.04)';
    this.ctx.lineWidth = 1;
    for (let x = 0; x <= this.canvas.width; x += this.tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.canvas.height);
      this.ctx.stroke();
    }
    for (let y = 0; y <= this.canvas.height; y += this.tileSize) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.canvas.width, y);
      this.ctx.stroke();
    }

    // Draw Obstacles (Walls taking up 1 grid space)
    this.obstacles.forEach(obs => {
      const x = obs.x * this.tileSize;
      const y = obs.y * this.tileSize;

      this.ctx.save();
      // Outer neon red glow and border
      this.ctx.fillStyle = '#ff2a6d';
      this.ctx.shadowColor = '#ff2a6d';
      this.ctx.shadowBlur = 10;
      this.roundRect(this.ctx, x + 1, y + 1, this.tileSize - 2, this.tileSize - 2, 4);
      this.ctx.fill();

      // Inner fill
      this.ctx.fillStyle = '#1f2833';
      this.ctx.shadowBlur = 0;
      this.roundRect(this.ctx, x + 3, y + 3, this.tileSize - 6, this.tileSize - 6, 2);
      this.ctx.fill();

      // Center accent cross/x line
      this.ctx.strokeStyle = '#ff2a6d';
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.moveTo(x + 6, y + 6);
      this.ctx.lineTo(x + this.tileSize - 6, y + this.tileSize - 6);
      this.ctx.moveTo(x + this.tileSize - 6, y + 6);
      this.ctx.lineTo(x + 6, y + this.tileSize - 6);
      this.ctx.stroke();

      this.ctx.restore();
    });

    // Draw Regular Food (Glowing Neon Circle with Pulsing Effect)
    if (this.food) {
      const fx = (this.food.x + 0.5) * this.tileSize;
      const fy = (this.food.y + 0.5) * this.tileSize;
      const pulseSize = (this.tileSize / 2 - 3) + Math.sin(performance.now() / 150) * 1.5;

      this.ctx.save();
      this.ctx.shadowColor = '#39ff14';
      this.ctx.shadowBlur = 12;
      this.ctx.fillStyle = '#39ff14';
      this.ctx.beginPath();
      this.ctx.arc(fx, fy, Math.max(2, pulseSize), 0, Math.PI * 2);
      this.ctx.fill();

      // Inner Core
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(fx, fy, Math.max(1, pulseSize / 2), 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Bonus Food (Glowing Yellow Star/Diamond)
    if (this.bonusFood) {
      const bx = (this.bonusFood.x + 0.5) * this.tileSize;
      const by = (this.bonusFood.y + 0.5) * this.tileSize;
      const bSize = this.tileSize / 2 - 1;

      this.ctx.save();
      this.ctx.shadowColor = '#ffe600';
      this.ctx.shadowBlur = 15;
      this.ctx.fillStyle = '#ffe600';

      this.ctx.beginPath();
      this.ctx.moveTo(bx, by - bSize);
      this.ctx.lineTo(bx + bSize, by);
      this.ctx.lineTo(bx, by + bSize);
      this.ctx.lineTo(bx - bSize, by);
      this.ctx.closePath();
      this.ctx.fill();

      // Inner core glow
      this.ctx.fillStyle = '#ffffff';
      this.ctx.beginPath();
      this.ctx.arc(bx, by, 3, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.restore();
    }

    // Draw Snake
    this.snake.forEach((segment, index) => {
      const x = segment.x * this.tileSize;
      const y = segment.y * this.tileSize;
      const radius = 6;

      this.ctx.save();
      if (index === 0) {
        // Snake Head
        this.ctx.fillStyle = '#66fcf1';
        this.ctx.shadowColor = '#66fcf1';
        this.ctx.shadowBlur = 12;

        this.roundRect(this.ctx, x + 1, y + 1, this.tileSize - 2, this.tileSize - 2, radius);
        this.ctx.fill();

        // Draw Head Eyes
        this.ctx.fillStyle = '#0b0c10';
        let eye1X = x + 5, eye1Y = y + 5;
        let eye2X = x + 5, eye2Y = y + 5;

        if (this.direction.x === 1) { // Right
          eye1X = x + 14; eye1Y = y + 5;
          eye2X = x + 14; eye2Y = y + 13;
        } else if (this.direction.x === -1) { // Left
          eye1X = x + 4; eye1Y = y + 5;
          eye2X = x + 4; eye2Y = y + 13;
        } else if (this.direction.y === -1) { // Up
          eye1X = x + 5; eye1Y = y + 4;
          eye2X = x + 13; eye2Y = y + 4;
        } else if (this.direction.y === 1) { // Down
          eye1X = x + 5; eye1Y = y + 14;
          eye2X = x + 13; eye2Y = y + 14;
        }

        this.ctx.beginPath();
        this.ctx.arc(eye1X, eye1Y, 2.5, 0, Math.PI * 2);
        this.ctx.arc(eye2X, eye2Y, 2.5, 0, Math.PI * 2);
        this.ctx.fill();

      } else {
        // Snake Body Gradient / Glow
        const fadeRatio = 1 - (index / (this.snake.length + 5));
        this.ctx.fillStyle = `rgba(69, 162, 158, ${Math.max(0.4, fadeRatio)})`;
        this.ctx.shadowColor = '#45a29e';
        this.ctx.shadowBlur = 5;

        this.roundRect(this.ctx, x + 2, y + 2, this.tileSize - 4, this.tileSize - 4, 4);
        this.ctx.fill();
      }
      this.ctx.restore();
    });

    // Draw Particles
    this.drawParticles();
  }

  roundRect(ctx, x, y, width, height, radius) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  }
}

// Initialize Game when DOM is loaded
window.addEventListener('DOMContentLoaded', () => {
  window.game = new SnakeGame();
});
