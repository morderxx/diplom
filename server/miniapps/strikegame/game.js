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
const ORANGE = "#FFA500";

// Game state
let gameState = "menu"; // menu, playing, pause, game_over, level_complete, wave_break
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
let wave = 1;
let score = 0;
let resources = 100;
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
let bases = [];
let enemyQueue = [];
let waveEnemiesCount = 0;
let waveEnemiesKilled = 0;
let waveBreakTimer = 180;
let upgrades = {
    baseHealth: 1,
    baseShield: 0,
    baseTurret: 0,
    playerDamage: 1,
    playerFireRate: 1,
    playerShield: 0
};
let upgradeCosts = {
    baseHealth: 50,
    baseShield: 75,
    baseTurret: 100,
    playerDamage: 60,
    playerFireRate: 70,
    playerShield: 80
};

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
    
    // Create bases
    createBases();
    
    // Event listeners
    window.addEventListener("keydown", e => keys[e.key] = true);
    window.addEventListener("keyup", e => keys[e.key] = false);
    
    // Start game loop
    requestAnimationFrame(gameLoop);
}

// Create defensive bases
function createBases() {
    bases = [];
    const baseWidth = 100;
    const baseSpacing = (WIDTH - baseWidth * 3) / 4;
    
    for (let i = 0; i < 3; i++) {
        bases.push(new Base(
            baseSpacing * (i + 1) + baseWidth * i,
            HEIGHT - 80,
            baseWidth,
            40
        ));
    }
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
    else if (gameState === "wave_break") {
        // Upgrade selection
        if (keys["1"]) {
            buyUpgrade("baseHealth");
            keys["1"] = false;
        }
        if (keys["2"]) {
            buyUpgrade("baseShield");
            keys["2"] = false;
        }
        if (keys["3"]) {
            buyUpgrade("baseTurret");
            keys["3"] = false;
        }
        if (keys["4"]) {
            buyUpgrade("playerDamage");
            keys["4"] = false;
        }
        if (keys["5"]) {
            buyUpgrade("playerFireRate");
            keys["5"] = false;
        }
        if (keys["6"]) {
            buyUpgrade("playerShield");
            keys["6"] = false;
        }
        if (keys["Enter"]) {
            startNextWave();
            keys["Enter"] = false;
        }
    }
}

// Buy upgrade
function buyUpgrade(type) {
    if (resources >= upgradeCosts[type]) {
        resources -= upgradeCosts[type];
        upgrades[type]++;
        upgradeCosts[type] = Math.floor(upgradeCosts[type] * 1.5);
        
        // Apply upgrade immediately
        if (type === "baseHealth") {
            bases.forEach(base => {
                base.maxHealth = 100 + 50 * upgrades.baseHealth;
                base.health = base.maxHealth;
            });
        }
        else if (type === "baseShield") {
            bases.forEach(base => {
                base.maxShield = 50 * upgrades.baseShield;
                base.shield = base.maxShield;
            });
        }
        else if (type === "playerDamage") {
            player.damageMultiplier = 1 + 0.2 * upgrades.playerDamage;
        }
        else if (type === "playerFireRate") {
            player.fireRateMultiplier = 1 + 0.15 * upgrades.playerFireRate;
        }
        else if (type === "playerShield") {
            player.maxShield = 50 * upgrades.playerShield;
            player.shield = player.maxShield;
        }
    }
}

// Start next wave
function startNextWave() {
    wave++;
    waveEnemiesKilled = 0;
    gameState = "playing";
    generateWave();
}

// Generate enemy wave
function generateWave() {
    enemyQueue = [];
    waveEnemiesCount = 10 + wave * 3;
    
    // Create wave composition
    for (let i = 0; i < waveEnemiesCount; i++) {
        // Higher waves have more powerful enemies
        let type;
        const r = Math.random();
        
        if (wave < 3) {
            type = 0; // Basic enemies only
        } 
        else if (wave < 6) {
            if (r < 0.7) type = 0;
            else type = 1; // Add fast enemies
        }
        else if (wave < 9) {
            if (r < 0.5) type = 0;
            else if (r < 0.8) type = 1;
            else type = 2; // Add tanks
        }
        else {
            if (r < 0.4) type = 0;
            else if (r < 0.7) type = 1;
            else if (r < 0.9) type = 2;
            else type = 3; // Add bombers
        }
        
        enemyQueue.push({
            type: type,
            delay: i * (60 - Math.min(50, wave * 2)) // More enemies over time
        });
    }
    
    // Chance for boss every 5 waves
    if (wave % 5 === 0) {
        enemyQueue.push({
            type: 4, // Boss
            delay: enemyQueue[enemyQueue.length - 1].delay + 120
        });
        waveEnemiesCount++;
    }
    
    enemySpawnTimer = 0;
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
    
    // Update bases
    bases.forEach(base => base.update());
    
    // Spawn enemies from queue
    if (enemyQueue.length > 0) {
        enemySpawnTimer += deltaTime;
        const nextEnemy = enemyQueue[0];
        
        if (enemySpawnTimer >= nextEnemy.delay) {
            spawnEnemy(nextEnemy.type);
            enemyQueue.shift();
            enemySpawnTimer = 0;
        }
    }
    // Wave complete
    else if (enemies.length === 0 && !bossActive) {
        if (waveEnemiesKilled >= waveEnemiesCount) {
            gameState = "wave_break";
            resources += 50 + wave * 20;
            waveBreakTimer = 180;
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
    bases = bases.filter(base => base.health > 0);
    
    // Check if all bases destroyed
    if (bases.length === 0) {
        gameState = "game_over";
    }
    
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
        // Draw bases
        bases.forEach(base => base.draw());
        
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
    else if (gameState === "wave_break") {
        drawWaveBreakScreen();
    }
    
    ctx.restore();
}

// Draw HUD
function drawHUD() {
    // Score
    drawText(`Score: ${player.score}`, 20, 20, "white", "medium");
    
    // Resources
    drawText(`Resources: ${resources}`, 20, 60, YELLOW, "medium");
    
    // Level
    const levelText = `Level: ${level}`;
    drawText(levelText, WIDTH - ctx.measureText(levelText).width - 20, 20, "white", "medium");
    
    // Wave
    const waveText = `Wave: ${wave}`;
    drawText(waveText, WIDTH - ctx.measureText(waveText).width - 20, 60, "white", "medium");
    
    // Enemies remaining
    const enemiesText = `Enemies: ${waveEnemiesCount - waveEnemiesKilled}`;
    drawText(enemiesText, WIDTH - ctx.measureText(enemiesText).width - 20, 100, "white", "medium");
    
    // Boss indicator
    if (bossActive) {
        drawText("BOSS BATTLE!", WIDTH/2 - ctx.measureText("BOSS BATTLE!").width/2, 50, RED, "large");
    }
}

// Draw wave break screen
function drawWaveBreakScreen() {
    // Semi-transparent overlay
    ctx.fillStyle = "rgba(0, 0, 40, 0.9)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Title
    drawText(`WAVE ${wave} COMPLETE!`, WIDTH/2, 100, GREEN, "title", true);
    
    // Resources earned
    drawText(`+${50 + wave * 20} Resources`, WIDTH/2, 170, YELLOW, "large", true);
    
    // Total resources
    drawText(`Total Resources: ${resources}`, WIDTH/2, 220, YELLOW, "medium", true);
    
    // Upgrade menu
    drawText("UPGRADES:", WIDTH/2, 280, CYAN, "large", true);
    
    // Base upgrades
    drawText("1. Base Health", 200, 330, WHITE, "medium");
    drawText(`(${upgrades.baseHealth}) - ${upgradeCosts.baseHealth}`, 700, 330, YELLOW, "medium");
    
    drawText("2. Base Shield", 200, 380, WHITE, "medium");
    drawText(`(${upgrades.baseShield}) - ${upgradeCosts.baseShield}`, 700, 380, YELLOW, "medium");
    
    drawText("3. Base Turret", 200, 430, WHITE, "medium");
    drawText(`(${upgrades.baseTurret}) - ${upgradeCosts.baseTurret}`, 700, 430, YELLOW, "medium");
    
    // Player upgrades
    drawText("4. Damage Boost", 200, 480, WHITE, "medium");
    drawText(`(${upgrades.playerDamage}) - ${upgradeCosts.playerDamage}`, 700, 480, YELLOW, "medium");
    
    drawText("5. Fire Rate", 200, 530, WHITE, "medium");
    drawText(`(${upgrades.playerFireRate}) - ${upgradeCosts.playerFireRate}`, 700, 530, YELLOW, "medium");
    
    drawText("6. Player Shield", 200, 580, WHITE, "medium");
    drawText(`(${upgrades.playerShield}) - ${upgradeCosts.playerShield}`, 700, 580, YELLOW, "medium");
    
    // Continue prompt
    drawText("Press ENTER to continue to next wave", WIDTH/2, HEIGHT - 50, GREEN, "medium", true);
}

// Draw menu screen
function drawMenu() {
    // Title
    drawText("GALACTIC DEFENDER", WIDTH/2, 150, CYAN, "title", true);
    
    // Subtitle
    drawText("Protect the bases from alien invasion!", WIDTH/2, 230, YELLOW, "medium", true);
    
    // Start prompt
    drawText("Press ENTER to Start", WIDTH/2, 350, GREEN, "large", true);
    
    // Controls
    drawText("Controls:", WIDTH/2, 450, WHITE, "medium", true);
    drawText("Arrow Keys - Move", WIDTH/2, 500, WHITE, "small", true);
    drawText("Space - Shoot", WIDTH/2, 530, WHITE, "small", true);
    drawText("ESC - Pause", WIDTH/2, 560, WHITE, "small", true);
    
    // New features
    drawText("New Features:", WIDTH/2, 620, ORANGE, "medium", true);
    drawText("Defend bases • Upgrade systems • Wave combat", WIDTH/2, 660, ORANGE, "small", true);
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
    
    // Wave reached
    drawText(`Wave Reached: ${wave}`, WIDTH/2, 350, YELLOW, "large", true);
    
    // Restart prompt
    drawText("Press ENTER to Restart", WIDTH/2, 450, GREEN, "medium", true);
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
function spawnEnemy(type) {
    const x = Math.random() * (WIDTH - 100) + 50;
    enemies.push(new Enemy(x, -50, type, level));
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

// Spawn resource
function spawnResource(x, y) {
    powerups.push(new PowerUp(x, y, 4)); // Type 4 is resource
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
                if (enemy.hit(bullet.damage * player.damageMultiplier)) {
                    explosions.push(new Explosion(enemy.x, enemy.y, enemy.size, enemy.color));
                    score += enemy.scoreValue;
                    player.score += enemy.scoreValue;
                    waveEnemiesKilled++;
                    
                    // Chance to spawn resource
                    if (Math.random() < 0.3) {
                        spawnResource(enemy.x, enemy.y);
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
                const result = boss.hit(bullet.damage * player.damageMultiplier);
                if (result) {
                    explosions.push(new Explosion(boss.x, boss.y, boss.size * 2, boss.color));
                    score += boss.scoreValue;
                    player.score += boss.scoreValue;
                    waveEnemiesKilled++;
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
    
    // Enemy bullets with bases
    bullets.forEach(bullet => {
        if (bullet.vy <= 0) return; // Only enemy bullets move downward
        
        for (let i = 0; i < bases.length; i++) {
            const base = bases[i];
            if (bullet.x > base.x && bullet.x < base.x + base.width &&
                bullet.y > base.y && bullet.y < base.y + base.height) {
                
                base.takeDamage(bullet.damage);
                bullet.active = false;
                explosions.push(new Explosion(bullet.x, bullet.y, 15, RED));
                screenShake(5, 10);
                break;
            }
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
            waveEnemiesKilled++;
            
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
    
    // Enemies with bases
    enemies.forEach(enemy => {
        for (let i = 0; i < bases.length; i++) {
            const base = bases[i];
            if (enemy.x > base.x && enemy.x < base.x + base.width &&
                enemy.y + enemy.size > base.y && enemy.y - enemy.size < base.y + base.height) {
                
                explosions.push(new Explosion(enemy.x, enemy.y, enemy.size, enemy.color));
                enemy.active = false;
                waveEnemiesKilled++;
                base.takeDamage(enemy.damage);
                screenShake(10, 15);
                break;
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
                case 4: // Resource
                    resources += 10 + wave;
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
    wave = 1;
    score = 0;
    resources = 100;
    enemySpawnTimer = 0;
    boss = null;
    bossActive = false;
    bossDefeated = false;
    levelTransitionTimer = 0;
    shakeTimer = 0;
    shakeIntensity = 0;
    cameraOffset = [0, 0];
    waveEnemiesCount = 0;
    waveEnemiesKilled = 0;
    
    // Reset upgrades
    upgrades = {
        baseHealth: 1,
        baseShield: 0,
        baseTurret: 0,
        playerDamage: 1,
        playerFireRate: 1,
        playerShield: 0
    };
    
    upgradeCosts = {
        baseHealth: 50,
        baseShield: 75,
        baseTurret: 100,
        playerDamage: 60,
        playerFireRate: 70,
        playerShield: 80
    };
    
    createBases();
    generateWave();
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

// Base class
class Base {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.maxHealth = 100 + 50 * upgrades.baseHealth;
        this.health = this.maxHealth;
        this.maxShield = 50 * upgrades.baseShield;
        this.shield = this.maxShield;
        this.turretLevel = upgrades.baseTurret;
        this.shootCooldown = 0;
        this.color = "#32C896";
    }
    
    takeDamage(amount) {
        if (this.shield > 0) {
            this.shield -= amount;
            if (this.shield < 0) {
                this.health += this.shield; // Negative shield becomes damage
                this.shield = 0;
            }
        } else {
            this.health -= amount;
        }
        
        // Visual feedback
        for (let i = 0; i < 10; i++) {
            particles.push(new Particle(
                this.x + Math.random() * this.width,
                this.y + Math.random() * this.height,
                RED,
                Math.random() * 3 + 2
            ));
        }
    }
    
    update() {
        // Auto turret
        if (this.turretLevel > 0) {
            this.shootCooldown -= deltaTime;
            
            // Find nearest enemy
            let nearestEnemy = null;
            let minDist = Infinity;
            
            for (const enemy of enemies) {
                const dx = enemy.x - (this.x + this.width/2);
                const dy = enemy.y - (this.y + this.height/2);
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < 300 && dist < minDist) {
                    minDist = dist;
                    nearestEnemy = enemy;
                }
            }
            
            // Shoot at enemy
            if (nearestEnemy && this.shootCooldown <= 0) {
                const baseCenterX = this.x + this.width/2;
                const baseCenterY = this.y + this.height/2;
                
                const angle = Math.atan2(
                    nearestEnemy.y - baseCenterY,
                    nearestEnemy.x - baseCenterX
                );
                
                const speed = 7;
                bullets.push(new Bullet(
                    baseCenterX,
                    baseCenterY,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    GREEN,
                    5 * this.turretLevel
                ));
                
                this.shootCooldown = 30 - this.turretLevel * 5;
            }
        }
    }
    
    draw() {
        // Draw base
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Draw details
        ctx.fillStyle = "#1E7A5E";
        ctx.fillRect(this.x + 10, this.y + 5, this.width - 20, 10);
        ctx.fillRect(this.x + 15, this.y + 20, this.width - 30, 10);
        
        // Draw turret
        if (this.turretLevel > 0) {
            const turretSize = 5 + this.turretLevel * 2;
            ctx.fillStyle = "#6464FF";
            ctx.fillRect(
                this.x + this.width/2 - turretSize/2,
                this.y - turretSize,
                turretSize,
                turretSize
            );
        }
        
        // Draw shield
        if (this.shield > 0) {
            const shieldAlpha = Math.min(150, 150 * (this.shield / this.maxShield));
            ctx.beginPath();
            ctx.rect(
                this.x - 5, 
                this.y - 5, 
                this.width + 10, 
                this.height + 10
            );
            ctx.strokeStyle = `rgba(100, 200, 255, ${shieldAlpha/255})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Draw health bar
        ctx.fillStyle = "#323232";
        ctx.fillRect(this.x, this.y - 15, this.width, 5);
        const healthWidth = this.width * (this.health / this.maxHealth);
        ctx.fillStyle = this.health > this.maxHealth * 0.3 ? GREEN : RED;
        ctx.fillRect(this.x, this.y - 15, healthWidth, 5);
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
        this.damageMultiplier = 1;
        this.fireRateMultiplier = 1;
        this.shield = 0;
        this.maxShield = 50 * upgrades.playerShield;
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
                bullets.push(new Bullet(this.x, this.y - 30, 0, -10, BLUE, 10 * this.damageMultiplier));
            }
            // Level 2 weapon
            else if (this.weaponLevel === 2) {
                bullets.push(new Bullet(this.x - 15, this.y - 20, 0, -10, BLUE, 10 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 15, this.y - 20, 0, -10, BLUE, 10 * this.damageMultiplier));
            }
            // Level 3+ weapon
            else {
                bullets.push(new Bullet(this.x - 20, this.y - 20, -1, -9, CYAN, 12 * this.damageMultiplier));
                bullets.push(new Bullet(this.x, this.y - 30, 0, -10, BLUE, 15 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 20, this.y - 20, 1, -9, CYAN, 12 * this.damageMultiplier));
            }
            
            this.shootCooldown = (10 - Math.min(3, this.weaponLevel)) / this.fireRateMultiplier;
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
        
        // Draw damage multiplier
        if (this.damageMultiplier > 1) {
            ctx.fillStyle = RED;
            ctx.beginPath();
            ctx.arc(this.x + 25, this.y - 15, 8, 0, Math.PI * 2);
            ctx.fill();
            drawText("DMG", this.x + 25, this.y - 12, WHITE, "small", true);
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
        this.targetBase = null;
        this.attackCooldown = 0;
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
            this.damage = 10;
            this.behavior = "basic";
        } else if (this.type === 1) { // Fast enemy
            this.health = 30 + this.level * 6;
            this.maxHealth = this.health;
            this.speed = Math.random() * 1.5 + 1.5 + this.level * 0.15;
            this.scoreValue = 15;
            this.shootChance = 0.02;
            this.color = "#FF64C8";
            this.size = 15;
            this.damage = 15;
            this.behavior = "evasive";
            this.evasiveTimer = 0;
        } else if (this.type === 2) { // Tank enemy
            this.health = 150 + this.level * 20;
            this.maxHealth = this.health;
            this.speed = Math.random() * 0.3 + 0.3 + this.level * 0.03;
            this.scoreValue = 30;
            this.shootChance = 0.01;
            this.color = "#FF9632";
            this.size = 40;
            this.damage = 25;
            this.behavior = "tank";
        } else if (this.type === 3) { // Bomber enemy
            this.health = 40 + this.level * 8;
            this.maxHealth = this.health;
            this.speed = Math.random() * 0.8 + 0.8 + this.level * 0.08;
            this.scoreValue = 25;
            this.shootChance = 0.03;
            this.color = "#C864FF";
            this.size = 25;
            this.damage = 20;
            this.behavior = "bomber";
            this.bombTimer = 0;
        } else { // Boss
            this.health = 500 + this.level * 200;
            this.maxHealth = this.health;
            this.speed = 0.5;
            this.scoreValue = 500 + this.level * 100;
            this.shootChance = 0.05;
            this.color = "#C83296";
            this.size = 80;
            this.damage = 40;
            this.behavior = "boss";
        }
    }
    
    update() {
        // Find target base
        if (!this.targetBase || this.targetBase.health <= 0) {
            this.findTargetBase();
        }
        
        // Move toward target base
        if (this.targetBase) {
            const targetX = this.targetBase.x + this.targetBase.width / 2;
            const targetY = this.targetBase.y + this.targetBase.height / 2;
            
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 10) {
                const speed = this.speed * deltaTime;
                this.x += (dx / distance) * speed;
                this.y += (dy / distance) * speed;
            }
        } else {
            // Move downward if no bases
            this.y += this.speed * deltaTime;
        }
        
        // Special behaviors
        if (this.behavior === "evasive") {
            this.evasiveTimer += deltaTime;
            // Zigzag movement
            this.x += Math.sin(this.evasiveTimer * 0.1) * 1.5;
        } else if (this.behavior === "bomber") {
            this.bombTimer += deltaTime;
            if (this.bombTimer > 120) {
                this.dropBomb();
                this.bombTimer = 0;
            }
        }
        
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
    
    findTargetBase() {
        let minDist = Infinity;
        let closestBase = null;
        
        for (const base of bases) {
            if (base.health > 0) {
                const dx = base.x + base.width/2 - this.x;
                const dy = base.y + base.height/2 - this.y;
                const dist = Math.sqrt(dx*dx + dy*dy);
                
                if (dist < minDist) {
                    minDist = dist;
                    closestBase = base;
                }
            }
        }
        
        this.targetBase = closestBase;
    }
    
    dropBomb() {
        bullets.push(new Bullet(this.x, this.y + this.size, 0, 4, PURPLE, 15));
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
        // Draw enemy based on type
        if (this.type === 0) { // Small
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        else if (this.type === 1) { // Fast
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x - this.size, this.y + this.size);
            ctx.lineTo(this.x + this.size, this.y + this.size);
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        else if (this.type === 2) { // Tank
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size, this.y - this.size/2, this.size*2, this.size);
            ctx.fillStyle = "#646464";
            ctx.fillRect(this.x - this.size/2, this.y - this.size, this.size, this.size/2);
        }
        else if (this.type === 3) { // Bomber
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.size, this.size/1.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            
            // Wings
            ctx.fillStyle = "#9632C8";
            ctx.fillRect(this.x - this.size*1.5, this.y - 5, this.size, 10);
            ctx.fillRect(this.x + this.size*0.5, this.y - 5, this.size, 10);
        }
        else { // Boss
            // Boss drawing handled in Boss class
        }
        
        // Draw health bar for non-boss enemies
        if (this.type !== 4) {
            ctx.fillStyle = "#323232";
            ctx.fillRect(this.x - this.size, this.y - this.size - 10, this.size * 2, 5);
            const healthWidth = this.size * 2 * (this.health / this.maxHealth);
            ctx.fillStyle = this.health > this.maxHealth * 0.3 ? GREEN : RED;
            ctx.fillRect(this.x - this.size, this.y - this.size - 10, healthWidth, 5);
        }
        
        // Draw particles
        this.particles.forEach(particle => particle.draw());
    }
}

// Boss class
class Boss extends Enemy {
    constructor(level) {
        super(WIDTH / 2, -100, 4, level);
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
        this.colors = [GREEN, YELLOW, CYAN, PURPLE, YELLOW];
        this.shapes = ["circle", "square", "triangle", "diamond", "star"];
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
        const shape = this.shapes[this.type];
        
        // Draw rotating powerup
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        
        if (shape === "circle") {
            ctx.beginPath();
            ctx.arc(0, 0, this.size, 0, Math.PI * 2);
            ctx.fillStyle = color;
            ctx.fill();
        }
        else if (shape === "square") {
            ctx.fillStyle = color;
            ctx.fillRect(-this.size, -this.size, this.size*2, this.size*2);
        }
        else if (shape === "triangle") {
            ctx.beginPath();
            ctx.moveTo(0, -this.size);
            ctx.lineTo(-this.size, this.size);
            ctx.lineTo(this.size, this.size);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
        else if (shape === "diamond") {
            ctx.beginPath();
            ctx.moveTo(0, -this.size);
            ctx.lineTo(-this.size, 0);
            ctx.lineTo(0, this.size);
            ctx.lineTo(this.size, 0);
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
        else if (shape === "star") {
            ctx.beginPath();
            for (let i = 0; i < 5; i++) {
                const angle = i * Math.PI * 0.4;
                const radius = i % 2 === 0 ? this.size : this.size * 0.5;
                ctx.lineTo(
                    Math.cos(angle) * radius,
                    Math.sin(angle) * radius
                );
            }
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
        
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
