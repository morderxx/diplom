// Game constants
const WIDTH = 1000;
const HEIGHT = 700;
const BLACK = "#000000";
const WHITE = "#FFFFFF";
const RED = "#FF3232";
const GREEN = "#32FF64";
const BLUE = "#3296FF";
const YELLOW = "#FFFF00";
const PURPLE = "#B432E6";
const CYAN = "#00FFFF";
const DARK_BLUE = "#0A0A28";

// Game state
let gameState = "menu"; // menu, playing, pause, game_over, level_complete
let canvas, ctx;
let keys = {};
let stars = [];
let player;
let enemies = [];
let bullets = [];
let powerups = [];
let explosions = [];
let particles = [];
let level = 1;
let score = 0;
let enemySpawnTimer = 0;
let boss = null;
let bossActive = false;
let bossDefeated = false;
let levelTransitionTimer = 0;
let shakeTimer = 0;
let shakeIntensity = 0;
let cameraOffset = [0, 0];
let lastTime = 0;
let deltaTime = 0;

// Fonts
const fonts = {
    title: { size: 64, weight: "bold" },
    large: { size: 42, weight: "bold" },
    medium: { size: 32, weight: "normal" },
    small: { size: 24, weight: "normal" }
};

// Initialize game
function init() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    
    // Create stars
    for (let i = 0; i < 200; i++) {
        stars.push(new Star());
    }
    
    // Initialize player
    player = new Player();
    
    // Event listeners
    window.addEventListener("keydown", e => keys[e.key] = true);
    window.addEventListener("keyup", e => keys[e.key] = false);
    
    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Game loop
function gameLoop(timestamp) {
    // Calculate delta time
    deltaTime = (timestamp - lastTime) / 16.666;
    lastTime = timestamp;
    
    // Handle input
    handleInput();
    
    // Update game state
    update();
    
    // Render game
    render();
    
    requestAnimationFrame(gameLoop);
}

// Handle user input
function handleInput() {
    if (gameState === "menu") {
        if (keys["Enter"]) {
            resetGame();
            gameState = "playing";
            keys["Enter"] = false;
        }
    }
    else if (gameState === "playing") {
        if (keys["Escape"]) {
            gameState = "pause";
            keys["Escape"] = false;
        }
        
        // Player movement
        let dx = (keys["ArrowRight"] ? 1 : 0) - (keys["ArrowLeft"] ? 1 : 0);
        let dy = (keys["ArrowDown"] ? 1 : 0) - (keys["ArrowUp"] ? 1 : 0);
        player.move(dx, dy);
        
        // Shooting
        if (keys[" "]) {
            player.shoot();
        }
    }
    else if (gameState === "pause") {
        if (keys["Escape"]) {
            gameState = "playing";
            keys["Escape"] = false;
        }
        else if (keys["m"]) {
            gameState = "menu";
            keys["m"] = false;
        }
    }
    else if (gameState === "game_over") {
        if (keys["Enter"]) {
            resetGame();
            gameState = "playing";
            keys["Enter"] = false;
        }
    }
}

// Update game state
function update() {
    // Update camera shake
    updateCamera();
    
    // Update stars
    stars.forEach(star => star.update());
    
    if (gameState !== "playing") return;
    
    // Update player
    player.update();
    
    // Spawn enemies
    enemySpawnTimer -= deltaTime;
    if (enemySpawnTimer <= 0 && !bossActive) {
        spawnEnemy();
        enemySpawnTimer = Math.max(10, 60 - level * 2);
        
        // Chance to spawn boss
        if (Math.random() < 0.005 && level > 1) {
            spawnBoss();
        }
    }
    
    // Update enemies
    enemies.forEach(enemy => enemy.update());
    
    // Update boss
    if (bossActive) {
        boss.update();
    }
    
    // Update bullets
    bullets.forEach(bullet => bullet.update());
    
    // Update powerups
    powerups.forEach(powerup => powerup.update());
    
    // Update explosions
    explosions.forEach(explosion => explosion.update());
    
    // Update particles
    particles.forEach(particle => particle.update());
    
    // Clean up arrays
    bullets = bullets.filter(bullet => bullet.active);
    enemies = enemies.filter(enemy => enemy.active);
    powerups = powerups.filter(powerup => powerup.active);
    explosions = explosions.filter(explosion => explosion.active);
    particles = particles.filter(particle => particle.active);
    
    // Check collisions
    checkCollisions();
    
    // Level transition after boss defeat
    if (bossDefeated) {
        levelTransitionTimer -= deltaTime;
        if (levelTransitionTimer <= 0) {
            level++;
            bossDefeated = false;
            player.health = player.maxHealth;
            player.shield = player.maxShield;
        }
    }
}

// Render game
function render() {
    // Clear canvas
    ctx.fillStyle = DARK_BLUE;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Apply camera shake offset
    ctx.save();
    ctx.translate(cameraOffset[0], cameraOffset[1]);
    
    // Draw stars
    stars.forEach(star => star.draw());
    
    if (gameState === "playing") {
        // Draw enemies
        enemies.forEach(enemy => enemy.draw());
        
        // Draw boss
        if (bossActive) {
            boss.draw();
        }
        
        // Draw bullets
        bullets.forEach(bullet => bullet.draw());
        
        // Draw powerups
        powerups.forEach(powerup => powerup.draw());
        
        // Draw explosions
        explosions.forEach(explosion => explosion.draw());
        
        // Draw particles
        particles.forEach(particle => particle.draw());
        
        // Draw player
        player.draw();
        
        // Draw HUD
        drawHUD();
    }
    else if (gameState === "menu") {
        drawMenu();
    }
    else if (gameState === "pause") {
        drawPauseScreen();
    }
    else if (gameState === "game_over") {
        drawGameOverScreen();
    }
    else if (bossDefeated) {
        drawLevelTransition();
    }
    
    ctx.restore();
}

// Draw HUD
function drawHUD() {
    // Score
    drawText(`Score: ${player.score}`, 20, 20, "white", "medium");
    
    // Level
    const levelText = `Level: ${level}`;
    drawText(levelText, WIDTH - ctx.measureText(levelText).width - 20, 20, "white", "medium");
    
    // Lives
    drawText(`Lives: ${player.lives}`, 20, 60, "white", "medium");
    
    // Boss indicator
    if (bossActive) {
        drawText("BOSS BATTLE!", WIDTH/2 - ctx.measureText("BOSS BATTLE!").width/2, 50, RED, "large");
    }
}

// Draw menu screen
function drawMenu() {
    // Title
    drawText("GALACTIC ANNIHILATOR", WIDTH/2, 150, CYAN, "title", true);
    
    // Subtitle
    drawText("Destroy the alien invasion!", WIDTH/2, 230, YELLOW, "medium", true);
    
    // Start prompt
    drawText("Press ENTER to Start", WIDTH/2, 350, GREEN, "large", true);
    
    // Controls
    drawText("Controls:", WIDTH/2, 450, WHITE, "medium", true);
    drawText("Arrow Keys - Move", WIDTH/2, 500, WHITE, "small", true);
    drawText("Space - Shoot", WIDTH/2, 530, WHITE, "small", true);
    drawText("ESC - Pause", WIDTH/2, 560, WHITE, "small", true);
}

// Draw pause screen
function drawPauseScreen() {
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Paused text
    drawText("PAUSED", WIDTH/2, 200, YELLOW, "large", true);
    
    // Instructions
    drawText("Press ESC to Resume", WIDTH/2, 300, GREEN, "medium", true);
    drawText("Press M for Main Menu", WIDTH/2, 350, BLUE, "medium", true);
}

// Draw game over screen
function drawGameOverScreen() {
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Game over text
    drawText("GAME OVER", WIDTH/2, 200, RED, "title", true);
    
    // Score
    drawText(`Final Score: ${player.score}`, WIDTH/2, 300, WHITE, "large", true);
    
    // Restart prompt
    drawText("Press ENTER to Restart", WIDTH/2, 400, GREEN, "medium", true);
}

// Draw level transition
function drawLevelTransition() {
    // Semi-transparent overlay
    const alpha = 0.7 * (levelTransitionTimer / 180);
    ctx.fillStyle = `rgba(0, 0, 0, ${alpha})`;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Level complete text
    drawText(`LEVEL ${level} COMPLETE!`, WIDTH/2, HEIGHT/2 - 50, GREEN, "title", true);
    
    // Next level text
    drawText(`Preparing for level ${level + 1}...`, WIDTH/2, HEIGHT/2 + 50, YELLOW, "medium", true);
}

// Draw text helper function
function drawText(text, x, y, color, fontType, center = false) {
    ctx.fillStyle = color;
    ctx.font = `${fonts[fontType].weight} ${fonts[fontType].size}px Arial`;
    
    if (center) {
        const textWidth = ctx.measureText(text).width;
        ctx.fillText(text, x - textWidth/2, y);
    } else {
        ctx.fillText(text, x, y);
    }
}

// Update camera shake
function updateCamera() {
    if (shakeTimer > 0) {
        cameraOffset[0] = Math.random() * shakeIntensity * 2 - shakeIntensity;
        cameraOffset[1] = Math.random() * shakeIntensity * 2 - shakeIntensity;
        shakeTimer -= deltaTime;
    } else {
        cameraOffset = [0, 0];
    }
}

// Spawn enemy
function spawnEnemy() {
    const enemyType = Math.floor(Math.random() * 3);
    const x = Math.random() * (WIDTH - 100) + 50;
    enemies.push(new Enemy(x, -50, enemyType, level));
}

// Spawn boss
function spawnBoss() {
    boss = new Boss(level);
    bossActive = true;
    bossDefeated = false;
}

// Spawn powerup
function spawnPowerup(x, y) {
    const powerType = Math.floor(Math.random() * 4);
    powerups.push(new PowerUp(x, y, powerType));
}

// Screen shake effect
function screenShake(intensity, duration) {
    shakeTimer = duration;
    shakeIntensity = intensity;
}

// Check collisions
function checkCollisions() {
    // Player bullets with enemies
    bullets.forEach(bullet => {
        if (bullet.vy >= 0) return; // Only player bullets move upward
        
        // Check collision with enemies
        for (let i = 0; i < enemies.length; i++) {
            const enemy = enemies[i];
            const dx = bullet.x - enemy.x;
            const dy = bullet.y - enemy.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance < enemy.size + bullet.radius) {
                if (enemy.hit(bullet.damage)) {
                    explosions.push(new Explosion(enemy.x, enemy.y, enemy.size, enemy.color));
                    score += enemy.scoreValue;
                    player.score += enemy.scoreValue;
                    
                    // Chance to spawn powerup
                    if (Math.random() < 0.2) {
                        spawnPowerup(enemy.x, enemy.y);
                    }
                    
                    enemy.active = false;
                }
                bullet.active = false;
                break;
            }
        }
        
        // Check collision with boss
        if (bossActive && bullet.vy < 0) {
            const dx = bullet.x - boss.x;
            const dy = bullet.y - boss.y;
            const distance = Math.sqrt(dx*dx + dy*dy);
            
            if (distance < boss.size + bullet.radius) {
                const result = boss.hit(bullet.damage);
                if (result) {
                    explosions.push(new Explosion(boss.x, boss.y, boss.size * 2, boss.color));
                    score += boss.scoreValue;
                    player.score += boss.scoreValue;
                    bossActive = false;
                    bossDefeated = true;
                    levelTransitionTimer = 180;
                    screenShake(20, 40);
                }
                bullet.active = false;
            }
        }
    });
    
    // Enemy bullets with player
    bullets.forEach(bullet => {
        if (bullet.vy <= 0) return; // Only enemy bullets move downward
        
        const dx = bullet.x - player.x;
        const dy = bullet.y - player.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 30 + bullet.radius && player.invincible <= 0) {
            if (player.shield > 0) {
                player.shield -= bullet.damage;
            } else {
                player.health -= bullet.damage;
                player.invincible = 60;
                screenShake(10, 15);
                
                if (player.health <= 0) {
                    player.lives--;
                    player.health = player.maxHealth;
                    player.invincible = 120;
                    
                    if (player.lives <= 0) {
                        gameState = "game_over";
                    }
                }
            }
            
            bullet.active = false;
            explosions.push(new Explosion(bullet.x, bullet.y, 10, bullet.color));
        }
    });
    
    // Enemies with player
    enemies.forEach(enemy => {
        const dx = enemy.x - player.x;
        const dy = enemy.y - player.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < enemy.size + 25 && player.invincible <= 0) {
            explosions.push(new Explosion(enemy.x, enemy.y, enemy.size, enemy.color));
            enemy.active = false;
            
            if (player.shield > 0) {
                player.shield = 0;
            } else {
                player.health -= 20;
                player.invincible = 60;
                screenShake(15, 20);
                
                if (player.health <= 0) {
                    player.lives--;
                    player.health = player.maxHealth;
                    player.invincible = 120;
                    
                    if (player.lives <= 0) {
                        gameState = "game_over";
                    }
                }
            }
        }
    });
    
    // Powerups with player
    powerups.forEach(powerup => {
        const dx = powerup.x - player.x;
        const dy = powerup.y - player.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 25 + powerup.size) {
            switch(powerup.type) {
                case 0: // Health
                    player.health = Math.min(player.maxHealth, player.health + 30);
                    break;
                case 1: // Weapon
                    player.weaponLevel = Math.min(5, player.weaponLevel + 1);
                    break;
                case 2: // Shield
                    player.shield = player.maxShield;
                    break;
                case 3: // Life
                    player.lives++;
                    break;
            }
            
            powerup.active = false;
            explosions.push(new Explosion(powerup.x, powerup.y, 20, YELLOW));
        }
    });
}

// Reset game
function resetGame() {
    player = new Player();
    enemies = [];
    bullets = [];
    powerups = [];
    explosions = [];
    particles = [];
    level = 1;
    score = 0;
    enemySpawnTimer = 0;
    boss = null;
    bossActive = false;
    bossDefeated = false;
    levelTransitionTimer = 0;
    shakeTimer = 0;
    shakeIntensity = 0;
    cameraOffset = [0, 0];
}

// Particle class
class Particle {
    constructor(x, y, color, size = 3, velocity = null, life = null) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.max(0.5, size);
        this.life = life || Math.floor(Math.random() * 30 + 20);
        this.maxLife = this.life;
        this.alpha = 255;
        
        if (velocity) {
            this.vx = velocity[0];
            this.vy = velocity[1];
        } else {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2.5 + 0.5;
            this.vx = Math.cos(angle) * speed;
            this.vy = Math.sin(angle) * speed;
        }
        
        this.active = true;
    }
    
    update() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= deltaTime;
        this.alpha = 255 * (this.life / this.maxLife);
        this.size = Math.max(0.1, this.size - 0.05 * deltaTime);
        
        if (this.life <= 0 || this.size <= 0) {
            this.active = false;
        }
        
        return this.active;
    }
    
    draw() {
        if (this.alpha <= 0 || this.size < 0.5) return;
        
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${parseInt(this.color.substring(1, 3), 16)}, ${parseInt(this.color.substring(3, 5), 16)}, ${parseInt(this.color.substring(5, 7), 16)}, ${this.alpha/255})`;
        ctx.fill();
    }
}

// Star class
class Star {
    constructor() {
        this.x = Math.random() * WIDTH;
        this.y = Math.random() * HEIGHT;
        this.size = Math.random() * 2 + 0.5;
        this.brightness = Math.random() * 0.7 + 0.3;
        this.speed = Math.random() * 0.4 + 0.1;
        this.twinkleSpeed = Math.random() * 0.04 + 0.01;
        this.twinklePhase = Math.random() * Math.PI * 2;
    }
    
    update() {
        this.y += this.speed * deltaTime;
        if (this.y > HEIGHT) {
            this.y = 0;
            this.x = Math.random() * WIDTH;
        }
        
        this.twinklePhase += this.twinkleSpeed * deltaTime;
    }
    
    draw() {
        const twinkle = 0.7 + 0.3 * Math.sin(this.twinklePhase);
        const brightness = this.brightness * twinkle;
        const value = Math.floor(255 * brightness);
        ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

// Player class
class Player {
    constructor() {
        this.width = 60;
        this.height = 40;
        this.x = WIDTH / 2;
        this.y = HEIGHT - 100;
        this.speed = 5;
        this.health = 100;
        this.maxHealth = 100;
        this.weaponLevel = 1;
        this.shield = 0;
        this.maxShield = 50;
        this.score = 0;
        this.lives = 3;
        this.invincible = 0;
        this.shootCooldown = 0;
        this.engineParticles = [];
    }
    
    move(dx, dy) {
        this.x = Math.max(this.width / 2, Math.min(WIDTH - this.width / 2, this.x + dx * this.speed * deltaTime));
        this.y = Math.max(this.height / 2, Math.min(HEIGHT - this.height / 2, this.y + dy * this.speed * deltaTime));
        
        // Add engine particles
        if ((dx !== 0 || dy !== 0) && Math.random() < 0.5) {
            const angle = Math.random() * Math.PI * 0.6 + Math.PI * 0.7;
            const speed = Math.random() * 2 + 1;
            this.engineParticles.push(new Particle(
                this.x - Math.random() * 10,
                this.y + this.height / 2,
                "#00C8FF",
                Math.random() * 2 + 2,
                [Math.sin(angle) * speed, Math.cos(angle) * speed],
                Math.random() * 10 + 10
            ));
        }
    }
    
    update() {
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }
        
        if (this.invincible > 0) {
            this.invincible -= deltaTime;
        }
        
        // Update engine particles
        this.engineParticles.forEach(particle => particle.update());
        this.engineParticles = this.engineParticles.filter(p => p.active);
    }
    
    shoot() {
        if (this.shootCooldown <= 0) {
            // Level 1 weapon
            if (this.weaponLevel === 1) {
                bullets.push(new Bullet(this.x, this.y - 30, 0, -10, BLUE, 10));
            }
            // Level 2 weapon
            else if (this.weaponLevel === 2) {
                bullets.push(new Bullet(this.x - 15, this.y - 20, 0, -10, BLUE, 10));
                bullets.push(new Bullet(this.x + 15, this.y - 20, 0, -10, BLUE, 10));
            }
            // Level 3+ weapon
            else {
                bullets.push(new Bullet(this.x - 20, this.y - 20, -1, -9, CYAN, 12));
                bullets.push(new Bullet(this.x, this.y - 30, 0, -10, BLUE, 15));
                bullets.push(new Bullet(this.x + 20, this.y - 20, 1, -9, CYAN, 12));
            }
            
            this.shootCooldown = 10 - Math.min(3, this.weaponLevel);
        }
    }
    
    draw() {
        // Draw shield
        if (this.shield > 0) {
            const shieldAlpha = Math.min(150, 150 * (this.shield / this.maxShield));
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width / 2 + 5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 200, 255, ${shieldAlpha/255})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Ship points
        const points = [
            [this.x, this.y - 20],
            [this.x - 20, this.y + 15],
            [this.x - 10, this.y + 10],
            [this.x - 25, this.y + 25],
            [this.x, this.y + 15],
            [this.x + 25, this.y + 25],
            [this.x + 10, this.y + 10],
            [this.x + 20, this.y + 15]
        ];
        
        // Ship color (flashes when invincible)
        let shipColor = BLUE;
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) {
            shipColor = PURPLE;
        }
        
        // Draw ship
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i][0], points[i][1]);
        }
        ctx.closePath();
        ctx.fillStyle = shipColor;
        ctx.fill();
        ctx.strokeStyle = CYAN;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw engine particles
        this.engineParticles.forEach(particle => particle.draw());
        
        // Draw health bar
        ctx.fillStyle = "#323246";
        ctx.fillRect(this.x - 30, this.y + 35, 60, 5);
        const healthWidth = 60 * (this.health / this.maxHealth);
        ctx.fillStyle = GREEN;
        ctx.fillRect(this.x - 30, this.y + 35, healthWidth, 5);
        
        // Draw weapon indicators
        for (let i = 0; i < this.weaponLevel; i++) {
            ctx.fillStyle = YELLOW;
            ctx.fillRect(this.x - 28 + i * 15, this.y + 45, 10, 3);
        }
    }
}

// Bullet class
class Bullet {
    constructor(x, y, vx, vy, color, damage) {
        this.x = x;
        this.y = y;
        this.vx = vx;
        this.vy = vy;
        this.color = color;
        this.damage = damage;
        this.radius = 3 + damage / 3;
        this.active = true;
    }
    
    update() {
        this.x += this.vx * deltaTime;
        this.y += this.vy * deltaTime;
        
        if (this.x < 0 || this.x > WIDTH || this.y < 0 || this.y > HEIGHT) {
            this.active = false;
        }
        
        return this.active;
    }
    
    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// Enemy class
class Enemy {
    constructor(x, y, type, level) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.level = level;
        this.setupEnemy();
        this.shootCooldown = 0;
        this.particles = [];
        this.active = true;
    }
    
    setupEnemy() {
        if (this.type === 0) { // Small enemy
            this.health = 20 + this.level * 5;
            this.maxHealth = this.health;
            this.speed = Math.random() * 1 + 1 + this.level * 0.1;
            this.scoreValue = 10;
            this.shootChance = 0.01;
            this.color = RED;
            this.size = 20;
        } else if (this.type === 1) { // Medium enemy
            this.health = 50 + this.level * 8;
            this.maxHealth = this.health;
            this.speed = Math.random() * 0.7 + 0.8 + this.level * 0.08;
            this.scoreValue = 25;
            this.shootChance = 0.02;
            this.color = PURPLE;
            this.size = 35;
        } else { // Large enemy
            this.health = 100 + this.level * 15;
            this.maxHealth = this.health;
            this.speed = Math.random() * 0.5 + 0.5 + this.level * 0.05;
            this.scoreValue = 50;
            this.shootChance = 0.03;
            this.color = "#FF9632";
            this.size = 50;
        }
    }
    
    update() {
        this.y += this.speed * deltaTime;
        
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }
        
        // Update particles
        this.particles.forEach(particle => particle.update());
        this.particles = this.particles.filter(p => p.active);
        
        if (this.y > HEIGHT + 50) {
            this.active = false;
        }
        
        return this.active;
    }
    
    shoot() {
        if (this.shootCooldown <= 0 && Math.random() < this.shootChance) {
            bullets.push(new Bullet(this.x, this.y + this.size, 0, 5, RED, 5));
            this.shootCooldown = 60;
            return true;
        }
        return false;
    }
    
    hit(damage) {
        this.health -= damage;
        
        // Create hit particles
        for (let i = 0; i < 5; i++) {
            this.particles.push(new Particle(
                this.x + Math.random() * this.size - this.size/2,
                this.y + Math.random() * this.size - this.size/2,
                this.color,
                Math.random() * 2 + 2,
                [Math.random() * 2 - 1, Math.random() * 2 - 1]
            ));
        }
        
        if (this.health <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }
    
    draw() {
        // Draw enemy
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size - 5, 0, Math.PI * 2);
        ctx.fillStyle = "#FFC8C8";
        ctx.fill();
        
        // Draw health bar
        ctx.fillStyle = "#323232";
        ctx.fillRect(this.x - this.size, this.y - this.size - 10, this.size * 2, 5);
        const healthWidth = this.size * 2 * (this.health / this.maxHealth);
        ctx.fillStyle = GREEN;
        ctx.fillRect(this.x - this.size, this.y - this.size - 10, healthWidth, 5);
        
        // Draw particles
        this.particles.forEach(particle => particle.draw());
    }
}

// Boss class
class Boss extends Enemy {
    constructor(level) {
        super(WIDTH / 2, -100, 3, level);
        this.health = 500 + level * 200;
        this.maxHealth = this.health;
        this.speed = 0.5;
        this.scoreValue = 500 + level * 100;
        this.shootChance = 0.05;
        this.color = "#C83296";
        this.size = 80;
        this.phase = 1;
        this.attackTimer = 0;
        this.attackPattern = 0;
        this.attackCooldown = 0;
        this.specialAttackTimer = 0;
        this.pulse = 0;
    }
    
    update() {
        if (this.y < 150) {
            this.y += this.speed * deltaTime;
        } else {
            this.attackTimer += deltaTime;
            this.pulse += 0.1 * deltaTime;
            
            // Change attack pattern
            if (this.attackTimer > 180) {
                this.attackTimer = 0;
                this.attackPattern = Math.floor(Math.random() * 3);
                this.attackCooldown = 30;
            }
            
            if (this.attackCooldown > 0) {
                this.attackCooldown -= deltaTime;
            }
            
            // Special attack
            this.specialAttackTimer += deltaTime;
            if (this.specialAttackTimer > 300) {
                this.specialAttackTimer = 0;
                this.specialAttack();
                screenShake(10, 15);
            }
        }
        
        return true;
    }
    
    shoot() {
        if (this.attackCooldown <= 0) {
            if (this.attackPattern === 0) { // Fan
                for (let angle = -60; angle <= 60; angle += 15) {
                    const rad = angle * Math.PI / 180;
                    bullets.push(new Bullet(
                        this.x, this.y + 30,
                        Math.sin(rad) * 3, Math.cos(rad) * 3,
                        PURPLE, 10
                    ));
                }
            } else if (this.attackPattern === 1) { // Spiral
                const angle = this.attackTimer * 10;
                const rad = angle * Math.PI / 180;
                bullets.push(new Bullet(
                    this.x, this.y + 30,
                    Math.sin(rad) * 4, Math.cos(rad) * 4,
                    RED, 8
                ));
            } else if (this.attackPattern === 2) { // Directed
                bullets.push(new Bullet(this.x - 40, this.y + 30, -1, 4, BLUE, 12));
                bullets.push(new Bullet(this.x + 40, this.y + 30, 1, 4, BLUE, 12));
                bullets.push(new Bullet(this.x, this.y + 30, 0, 4, BLUE, 15));
            }
            
            this.attackCooldown = 20;
            screenShake(3, 5);
            return true;
        }
        return false;
    }
    
    specialAttack() {
        for (let i = 0; i < 8; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 2;
            bullets.push(new Bullet(
                this.x, this.y + 30,
                Math.sin(angle) * speed, Math.cos(angle) * speed,
                YELLOW, 15
            ));
        }
    }
    
    hit(damage) {
        this.health -= damage;
        
        // Create hit particles
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(
                this.x + Math.random() * this.size - this.size/2,
                this.y + Math.random() * this.size - this.size/2,
                this.color,
                Math.random() * 3 + 3,
                [Math.random() * 4 - 2, Math.random() * 4 - 2]
            ));
        }
        
        // Phase change at 50% health
        if (this.health <= this.maxHealth * 0.5 && this.phase === 1) {
            this.phase = 2;
            this.color = "#FF3232";
            this.shootChance = 0.1;
            screenShake(15, 30);
        }
        
        if (this.health <= 0) {
            this.active = false;
            return true;
        }
        return false;
    }
    
    draw() {
        // Pulsing effect
        const pulseSize = this.size + Math.sin(this.pulse) * 5;
        
        // Draw boss
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseSize - 10, 0, Math.PI * 2);
        ctx.fillStyle = "#FFC8C8";
        ctx.fill();
        
        // Eyes
        ctx.beginPath();
        ctx.arc(this.x - 20, this.y - 10, 12, 0, Math.PI * 2);
        ctx.fillStyle = "#323296";
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + 20, this.y - 10, 12, 0, Math.PI * 2);
        ctx.fillStyle = "#323296";
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(this.x - 20, this.y - 10, 6, 0, Math.PI * 2);
        ctx.fillStyle = CYAN;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x + 20, this.y - 10, 6, 0, Math.PI * 2);
        ctx.fillStyle = CYAN;
        ctx.fill();
        
        // Mouth
        ctx.beginPath();
        ctx.arc(this.x, this.y + 25, 15, 0, Math.PI);
        ctx.strokeStyle = "#640000";
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Draw health bar
        ctx.fillStyle = "#323232";
        ctx.fillRect(this.x - this.size, this.y - this.size - 20, this.size * 2, 10);
        const healthWidth = this.size * 2 * (this.health / this.maxHealth);
        ctx.fillStyle = GREEN;
        ctx.fillRect(this.x - this.size, this.y - this.size - 20, healthWidth, 10);
        
        // Draw particles
        this.particles.forEach(particle => particle.draw());
    }
}

// PowerUp class
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.speed = 2;
        this.size = 20;
        this.rotation = 0;
        this.active = true;
        this.colors = [GREEN, YELLOW, CYAN, PURPLE];
    }
    
    update() {
        this.y += this.speed * deltaTime;
        this.rotation += 0.05 * deltaTime;
        
        if (this.y > HEIGHT + 50) {
            this.active = false;
        }
        
        return this.active;
    }
    
    draw() {
        const color = this.colors[this.type];
        
        // Draw rotating powerup
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = i * Math.PI / 3;
            const px = Math.cos(angle) * this.size;
            const py = Math.sin(angle) * this.size;
            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Draw center
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 3, 0, Math.PI * 2);
        ctx.fillStyle = "#C8C8FF";
        ctx.fill();
        
        ctx.restore();
    }
}

// Explosion class
class Explosion {
    constructor(x, y, size, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.particles = [];
        this.life = 60;
        this.active = true;
        
        // Create explosion particles
        const particleCount = Math.min(50, size * 5);
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * (size / 2) + 1;
            this.particles.push(new Particle(
                x, y, 
                color,
                Math.random() * (size / 3) + 2,
                [Math.cos(angle) * speed, Math.sin(angle) * speed],
                Math.random() * 40 + 20
            ));
        }
    }
    
    update() {
        this.life -= deltaTime;
        this.particles.forEach(particle => particle.update());
        
        if (this.life <= 0 && this.particles.length === 0) {
            this.active = false;
        }
        
        return this.active;
    }
    
    draw() {
        this.particles.forEach(particle => particle.draw());
    }
}

// Start the game
window.onload = init;