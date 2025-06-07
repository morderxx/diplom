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

// Состояние игры
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
let resources = 200; // Увеличено стартовое количество ресурсов
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
    playerShield: 0,
    playerSpeed: 0
};
let upgradeCosts = {
    baseHealth: 50,
    baseShield: 75,
    baseTurret: 100,
    playerDamage: 60,
    playerFireRate: 70,
    playerShield: 80,
    playerSpeed: 50
};

// Шрифты
const fonts = {
    title: { size: 64, weight: "bold" },
    large: { size: 42, weight: "bold" },
    medium: { size: 32, weight: "normal" },
    small: { size: 24, weight: "normal" },
    smaller: { size: 20, weight: "normal" } // Добавлен меньший размер шрифта
};

// Инициализация игры
function init() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    
    // Создание звезд
    for (let i = 0; i < 200; i++) {
        stars.push(new Star());
    }
    
    // Инициализация игрока
    player = new Player();
    
    // Создание баз
    createBases();
    
    // Обработчики событий
    window.addEventListener("keydown", e => keys[e.key] = true);
    window.addEventListener("keyup", e => keys[e.key] = false);
    
    // Запуск игрового цикла
    requestAnimationFrame(gameLoop);
}

// Создание оборонительных баз
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

// Игровой цикл
function gameLoop(timestamp) {
    // Расчет времени между кадрами
    deltaTime = (timestamp - lastTime) / 16.666;
    lastTime = timestamp;
    
    // Обработка ввода
    handleInput();
    
    // Обновление состояния игры
    update();
    
    // Отрисовка игры
    render();
    
    requestAnimationFrame(gameLoop);
}

// Обработка пользовательского ввода
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
        
        // Движение игрока
        let dx = (keys["ArrowRight"] ? 1 : 0) - (keys["ArrowLeft"] ? 1 : 0);
        let dy = (keys["ArrowDown"] ? 1 : 0) - (keys["ArrowUp"] ? 1 : 0);
        player.move(dx, dy);
        
        // Стрельба
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
        // Выбор улучшений
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
        if (keys["7"]) {
            buyUpgrade("playerSpeed");
            keys["7"] = false;
        }
        if (keys["Enter"]) {
            startNextWave();
            keys["Enter"] = false;
        }
    }
    else if (gameState === "level_transition") {
        if (keys["Enter"]) {
            startNextLevel();
            keys["Enter"] = false;
        }
    }
}

// Покупка улучшения
function buyUpgrade(type) {
    if (resources >= upgradeCosts[type]) {
        resources -= upgradeCosts[type];
        upgrades[type]++;
        upgradeCosts[type] = Math.floor(upgradeCosts[type] * 1.5);
        
        // Применение улучшения
        if (type === "baseHealth") {
            bases.forEach(base => {
                base.maxHealth = 150 + 100 * upgrades.baseHealth; // Усиленное улучшение
                base.health = base.maxHealth;
            });
        }
        else if (type === "baseShield") {
            bases.forEach(base => {
                base.maxShield = 75 * upgrades.baseShield; // Усиленное улучшение
                base.shield = base.maxShield;
            });
        }
        else if (type === "playerDamage") {
            player.damageMultiplier = 1 + 0.4 * upgrades.playerDamage; // Усиленное улучшение
        }
        else if (type === "playerFireRate") {
            player.fireRateMultiplier = 1 + 0.25 * upgrades.playerFireRate; // Усиленное улучшение
        }
        else if (type === "playerShield") {
            player.maxShield = 60 * upgrades.playerShield; // Усиленное улучшение
            player.shield = player.maxShield;
        }
        else if (type === "playerSpeed") {
            player.speed = 5 + 1 * upgrades.playerSpeed;
        }
    }
}

// Начать следующую волну
function startNextWave() {
    wave++;
    waveEnemiesKilled = 0;
    gameState = "playing";
    generateWave();
}

// Начать следующий уровень
function startNextLevel() {
    level++;
    wave = 1;
    waveEnemiesKilled = 0;
    gameState = "playing";
    generateWave();
    
    // Восстановление здоровья баз
    bases.forEach(base => {
        base.health = base.maxHealth;
        base.shield = base.maxShield;
    });
    
    // Восстановление здоровья игрока
    player.health = player.maxHealth;
    player.shield = player.maxShield;
}

// Генерация волны врагов
function generateWave() {
    enemyQueue = [];
    // Количество врагов зависит от уровня и волны
    waveEnemiesCount = 8 + wave * 3 + level * 2; 
    
    // Состав волны
    for (let i = 0; i < waveEnemiesCount; i++) {
        // На высоких волнах и уровнях более сильные враги
        let type;
        const r = Math.random();
        const waveLevelFactor = Math.min(10, wave + level);
        
        if (waveLevelFactor < 3) {
            if (r < 0.9) type = 0; // Обычные
            else type = 1; // Быстрые
        } 
        else if (waveLevelFactor < 6) {
            if (r < 0.6) type = 0;
            else if (r < 0.9) type = 1;
            else type = 2; // Танки
        }
        else if (waveLevelFactor < 9) {
            if (r < 0.4) type = 0;
            else if (r < 0.7) type = 1;
            else if (r < 0.9) type = 2;
            else type = 3; // Бомбардировщики
        }
        else {
            if (r < 0.3) type = 0;
            else if (r < 0.5) type = 1;
            else if (r < 0.7) type = 2;
            else if (r < 0.9) type = 3;
            else type = 5; // Снайперы (новый тип)
        }
        
        // Ускоренный спавн врагов
        enemyQueue.push({
            type: type,
            delay: i * (15 - Math.min(10, wave)) // Значительно ускорено появление
        });
    }
    
    // Босс каждые 3 волны
    if (wave % 3 === 0) {
        enemyQueue.push({
            type: 4, // Босс
            delay: enemyQueue[enemyQueue.length - 1].delay + 100
        });
        waveEnemiesCount++;
    }
    
    enemySpawnTimer = 0;
}

// Обновление состояния игры
function update() {
    // Обновление эффекта тряски камеры
    updateCamera();
    
    // Обновление звезд
    stars.forEach(star => star.update());
    
    if (gameState !== "playing") return;
    
    // Обновление игрока
    player.update();
    
    // Обновление баз
    bases.forEach(base => base.update());
    
    // Спавн врагов из очереди
    if (enemyQueue.length > 0) {
        enemySpawnTimer += deltaTime;
        const nextEnemy = enemyQueue[0];
        
        if (enemySpawnTimer >= nextEnemy.delay) {
            spawnEnemy(nextEnemy.type);
            enemyQueue.shift();
            enemySpawnTimer = 0;
        }
    }
    // Волна завершена
    else if (enemies.length === 0 && !bossActive) {
        if (waveEnemiesKilled >= waveEnemiesCount) {
            // Если это была 3-я волна - переход на новый уровень
            if (wave % 3 === 0) {
                gameState = "level_transition";
                resources += 150 + level * 50;
            } else {
                gameState = "wave_break";
                resources += 80 + wave * 30 + level * 20; // Больше ресурсов за волну
                waveBreakTimer = 180;
            }
        }
    }
    
    // Обновление врагов
    enemies.forEach(enemy => enemy.update());
    
    // Обновление босса
    if (bossActive) {
        boss.update();
    }
    
    // Обновление пуль
    bullets.forEach(bullet => bullet.update());
    
    // Обновление улучшений
    powerups.forEach(powerup => powerup.update());
    
    // Обновление взрывов
    explosions.forEach(explosion => explosion.update());
    
    // Обновление частиц
    particles.forEach(particle => particle.update());
    
    // Очистка массивов
    bullets = bullets.filter(bullet => bullet.active);
    enemies = enemies.filter(enemy => enemy.active);
    powerups = powerups.filter(powerup => powerup.active);
    explosions = explosions.filter(explosion => explosion.active);
    particles = particles.filter(particle => particle.active);
    bases = bases.filter(base => base.health > 0);
    
    // Проверка уничтожения всех баз
    if (bases.length === 0) {
        gameState = "game_over";
    }
    
    // Проверка столкновений
    checkCollisions();
    
    // Переход на следующий уровень после босса
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

// Отрисовка игры
function render() {
    // Очистка холста
    ctx.fillStyle = DARK_BLUE;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Применение смещения камеры
    ctx.save();
    ctx.translate(cameraOffset[0], cameraOffset[1]);
    
    // Отрисовка звезд
    stars.forEach(star => star.draw());
    
    if (gameState === "playing") {
        // Отрисовка баз
        bases.forEach(base => base.draw());
        
        // Отрисовка врагов
        enemies.forEach(enemy => enemy.draw());
        
        // Отрисовка босса
        if (bossActive) {
            boss.draw();
        }
        
        // Отрисовка пуль
        bullets.forEach(bullet => bullet.draw());
        
        // Отрисовка улучшений
        powerups.forEach(powerup => powerup.draw());
        
        // Отрисовка взрывов
        explosions.forEach(explosion => explosion.draw());
        
        // Отрисовка частиц
        particles.forEach(particle => particle.draw());
        
        // Отрисовка игрока
        player.draw();
        
        // Отрисовка интерфейса
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
    else if (gameState === "wave_break") {
        drawWaveBreakScreen();
    }
    else if (gameState === "level_transition") {
        drawLevelTransition();
    }
    
    ctx.restore();
}

// Отрисовка интерфейса
function drawHUD() {
    // Счет
    drawText(`Счет: ${player.score}`, 20, 40, "white", "smaller");
    
    // Ресурсы
    drawText(`Ресурсы: ${resources}`, 20, 70, YELLOW, "smaller");
    
    // Уровень
    const levelText = `Уровень: ${level}`;
    const levelTextWidth = ctx.measureText(levelText).width;
    drawText(levelText, WIDTH - levelTextWidth - 20, 40, "white", "smaller");
    
    // Волна
    const waveText = `Волна: ${wave}/3`;
    const waveTextWidth = ctx.measureText(waveText).width;
    drawText(waveText, WIDTH - waveTextWidth - 20, 70, "white", "smaller");
    
    // Оставшиеся враги
    const enemiesText = `Врагов: ${waveEnemiesCount - waveEnemiesKilled}`;
    const enemiesTextWidth = ctx.measureText(enemiesText).width;
    drawText(enemiesText, WIDTH - enemiesTextWidth - 20, 100, "white", "smaller");
    
    // Индикатор босса
    if (bossActive) {
        drawText("БОСС БИТВА!", WIDTH/2 - ctx.measureText("БОСС БИТВА!").width/2, 60, RED, "medium");
    }
}

// Отрисовка экрана перерыва
function drawWaveBreakScreen() {
    // Полупрозрачный фон
    ctx.fillStyle = "rgba(0, 0, 40, 0.9)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Заголовок
    drawText(`ВОЛНА ${wave} ЗАВЕРШЕНА!`, WIDTH/2, 100, GREEN, "title", true);
    
    // Заработанные ресурсы
    drawText(`+${80 + wave * 30 + level * 20} Ресурсов`, WIDTH/2, 170, YELLOW, "large", true);
    
    // Всего ресурсов
    drawText(`Всего ресурсов: ${resources}`, WIDTH/2, 220, YELLOW, "medium", true);
    
    // Меню улучшений
    drawText("УЛУЧШЕНИЯ:", WIDTH/2, 280, CYAN, "large", true);
    
    // Улучшения баз
    drawText("1. Здоровье баз", 200, 330, WHITE, "medium");
    drawText(`(${upgrades.baseHealth}) - ${upgradeCosts.baseHealth}`, 700, 330, YELLOW, "medium");
    
    drawText("2. Щиты баз", 200, 380, WHITE, "medium");
    drawText(`(${upgrades.baseShield}) - ${upgradeCosts.baseShield}`, 700, 380, YELLOW, "medium");
    
    drawText("3. Турели баз", 200, 430, WHITE, "medium");
    drawText(`(${upgrades.baseTurret}) - ${upgradeCosts.baseTurret}`, 700, 430, YELLOW, "medium");
    
    // Улучшения игрока
    drawText("4. Урон игрока", 200, 480, WHITE, "medium");
    drawText(`(${upgrades.playerDamage}) - ${upgradeCosts.playerDamage}`, 700, 480, YELLOW, "medium");
    
    drawText("5. Скорость стрельбы", 200, 530, WHITE, "medium");
    drawText(`(${upgrades.playerFireRate}) - ${upgradeCosts.playerFireRate}`, 700, 530, YELLOW, "medium");
    
    drawText("6. Щиты игрока", 200, 580, WHITE, "medium");
    drawText(`(${upgrades.playerShield}) - ${upgradeCosts.playerShield}`, 700, 580, YELLOW, "medium");
    
    drawText("7. Скорость игрока", 200, 630, WHITE, "medium");
    drawText(`(${upgrades.playerSpeed}) - ${upgradeCosts.playerSpeed}`, 700, 630, YELLOW, "medium");
    
    // Подсказка продолжения
    drawText("Нажмите ENTER для перехода к следующей волне", WIDTH/2, HEIGHT - 50, GREEN, "medium", true);
}

// Отрисовка перехода уровня
function drawLevelTransition() {
    // Полупрозрачный фон
    ctx.fillStyle = "rgba(0, 0, 40, 0.9)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Заголовок
    drawText(`УРОВЕНЬ ${level} ЗАВЕРШЕН!`, WIDTH/2, 150, GREEN, "title", true);
    
    // Заработанные ресурсы
    drawText(`+${150 + level * 50} Ресурсов`, WIDTH/2, 220, YELLOW, "large", true);
    
    // Всего ресурсов
    drawText(`Всего ресурсов: ${resources}`, WIDTH/2, 280, YELLOW, "medium", true);
    
    // Статистика уровня
    drawText(`Уничтожено врагов: ${waveEnemiesCount}`, WIDTH/2, 340, WHITE, "medium", true);
    drawText(`Сохранено баз: ${bases.length}/3`, WIDTH/2, 390, WHITE, "medium", true);
    
    // Новые враги на следующем уровне
    drawText("На следующем уровне:", WIDTH/2, 460, CYAN, "large", true);
    
    if (level === 1) {
        drawText("- Появятся быстрые истребители", WIDTH/2, 510, ORANGE, "medium", true);
    } else if (level === 2) {
        drawText("- Появятся тяжелые танки", WIDTH/2, 510, ORANGE, "medium", true);
    } else if (level === 3) {
        drawText("- Появятся бомбардировщики", WIDTH/2, 510, ORANGE, "medium", true);
    } else if (level === 4) {
        drawText("- Появятся снайперы", WIDTH/2, 510, ORANGE, "medium", true);
    } else {
        drawText("- Враги станут сильнее и быстрее", WIDTH/2, 510, ORANGE, "medium", true);
    }
    
    // Подсказка продолжения
    drawText("Нажмите ENTER для перехода на уровень " + (level + 1), WIDTH/2, HEIGHT - 50, GREEN, "medium", true);
}

// Отрисовка меню
function drawMenu() {
    // Заголовок
    drawText("ГАЛАКТИЧЕСКИЙ ЗАЩИТНИК", WIDTH/2, 150, CYAN, "title", true);
    
    // Подзаголовок
    drawText("Защитите базы от инопланетного вторжения!", WIDTH/2, 230, YELLOW, "medium", true);
    
    // Подсказка начала
    drawText("Нажмите ENTER чтобы начать", WIDTH/2, 350, GREEN, "large", true);
    
    // Управление
    drawText("Управление:", WIDTH/2, 450, WHITE, "medium", true);
    drawText("Стрелки - Движение", WIDTH/2, 500, WHITE, "small", true);
    drawText("Пробел - Стрельба", WIDTH/2, 530, WHITE, "small", true);
    drawText("ESC - Пауза", WIDTH/2, 560, WHITE, "small", true);
}

// Отрисовка экрана паузы
function drawPauseScreen() {
    // Полупрозрачный фон
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Текст паузы
    drawText("ПАУЗА", WIDTH/2, 200, YELLOW, "large", true);
    
    // Инструкции
    drawText("Нажмите ESC для продолжения", WIDTH/2, 300, GREEN, "medium", true);
    drawText("Нажмите M для выхода в меню", WIDTH/2, 350, BLUE, "medium", true);
}

// Отрисовка экрана проигрыша
function drawGameOverScreen() {
    // Полупрозрачный фон
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    
    // Текст проигрыша
    drawText("ИГРА ОКОНЧЕНА", WIDTH/2, 200, RED, "title", true);
    
    // Счет
    drawText(`Финальный счет: ${player.score}`, WIDTH/2, 300, WHITE, "large", true);
    
    // Достигнутая волна
    drawText(`Достигнутый уровень: ${level}`, WIDTH/2, 350, YELLOW, "large", true);
    
    // Подсказка рестарта
    drawText("Нажмите ENTER для перезапуска", WIDTH/2, 450, GREEN, "medium", true);
}

// Вспомогательная функция отрисовки текста
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

// Обновление эффекта тряски камеры
function updateCamera() {
    if (shakeTimer > 0) {
        cameraOffset[0] = Math.random() * shakeIntensity * 2 - shakeIntensity;
        cameraOffset[1] = Math.random() * shakeIntensity * 2 - shakeIntensity;
        shakeTimer -= deltaTime;
    } else {
        cameraOffset = [0, 0];
    }
}

// Спавн врага
function spawnEnemy(type) {
    const x = Math.random() * (WIDTH - 100) + 50;
    enemies.push(new Enemy(x, -50, type, level, wave)); // Добавлен параметр wave
}

// Спавн босса
function spawnBoss() {
    boss = new Boss(level);
    bossActive = true;
    bossDefeated = false;
}

// Спавн улучшения
function spawnPowerup(x, y) {
    const powerType = Math.floor(Math.random() * 5);
    powerups.push(new PowerUp(x, y, powerType));
}

// Спавн ресурса
function spawnResource(x, y) {
    powerups.push(new PowerUp(x, y, 5)); // Тип 5 - ресурс
}

// Эффект тряски экрана
function screenShake(intensity, duration) {
    shakeTimer = duration;
    shakeIntensity = intensity;
}

// Проверка столкновений
function checkCollisions() {
    // Пули игрока с врагами
    bullets.forEach(bullet => {
        if (bullet.vy >= 0) return; // Только пули игрока летят вверх
        
        // Проверка столкновения с врагами
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
                    
                    // Шанс выпадения ресурса
                    if (Math.random() < 0.3) {
                        spawnResource(enemy.x, enemy.y);
                    }
                    
                    enemy.active = false;
                }
                bullet.active = false;
                break;
            }
        }
        
        // Проверка столкновения с боссом
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
    
    // Вражеские пули с игроком
    bullets.forEach(bullet => {
        if (bullet.vy <= 0) return; // Только вражеские пули летят вниз
        
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
    
    // Вражеские пули с базами
    bullets.forEach(bullet => {
        if (bullet.vy <= 0) return; // Только вражеские пули летят вниз
        
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
    
    // Враги с игроком
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
    
    // Враги с базами
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
    
    // Улучшения с игроком
    powerups.forEach(powerup => {
        const dx = powerup.x - player.x;
        const dy = powerup.y - player.y;
        const distance = Math.sqrt(dx*dx + dy*dy);
        
        if (distance < 25 + powerup.size) {
            switch(powerup.type) {
                case 0: // Здоровье
                    player.health = Math.min(player.maxHealth, player.health + 30);
                    break;
                case 1: // Оружие
                    player.weaponLevel = Math.min(5, player.weaponLevel + 1);
                    break;
                case 2: // Щит
                    player.shield = player.maxShield;
                    break;
                case 3: // Жизнь
                    player.lives++;
                    break;
                case 4: // Неуязвимость (новое)
                    player.invincible = 180;
                    break;
                case 5: // Ресурс
                    resources += 15 + wave + level * 5;
                    break;
            }
            
            powerup.active = false;
            explosions.push(new Explosion(powerup.x, powerup.y, 20, YELLOW));
        }
    });
}

// Сброс игры
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
    resources = 200; // Увеличено стартовое количество
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
    
    // Сброс улучшений
    upgrades = {
        baseHealth: 1,
        baseShield: 0,
        baseTurret: 0,
        playerDamage: 1,
        playerFireRate: 1,
        playerShield: 0,
        playerSpeed: 0
    };
    
    upgradeCosts = {
        baseHealth: 50,
        baseShield: 75,
        baseTurret: 100,
        playerDamage: 60,
        playerFireRate: 70,
        playerShield: 80,
        playerSpeed: 50
    };
    
    createBases();
    generateWave();
}

// Класс частиц
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

// Класс звезд
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

// Класс базы
class Base {
    constructor(x, y, width, height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.maxHealth = 150 + 100 * upgrades.baseHealth; // Усиленное здоровье
        this.health = this.maxHealth;
        this.maxShield = 75 * upgrades.baseShield; // Усиленные щиты
        this.shield = this.maxShield;
        this.turretLevel = upgrades.baseTurret;
        this.shootCooldown = 0;
        this.color = "#32C896";
    }
    
    takeDamage(amount) {
        if (this.shield > 0) {
            this.shield -= amount;
            if (this.shield < 0) {
                this.health += this.shield; // Отрицательный щит превращается в урон
                this.shield = 0;
            }
        } else {
            this.health -= amount;
        }
        
        // Визуальный эффект
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
        // Автоматическая турель (ИСПРАВЛЕНО)
        if (this.turretLevel > 0) {
            this.shootCooldown -= deltaTime;
            
            // Поиск ближайшего врага
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
            
            // Стрельба по врагу
            if (nearestEnemy && this.shootCooldown <= 0) {
                const baseCenterX = this.x + this.width/2;
                const baseCenterY = this.y + this.height/2;
                
                const angle = Math.atan2(
                    nearestEnemy.y - baseCenterY,
                    nearestEnemy.x - baseCenterX
                );
                
                const speed = 10; // Увеличена скорость пули
                bullets.push(new Bullet(
                    baseCenterX,
                    baseCenterY,
                    Math.cos(angle) * speed,
                    Math.sin(angle) * speed,
                    YELLOW, // Изменен цвет на желтый для лучшей видимости
                    7 * this.turretLevel // Усиленный урон
                ));
                
                this.shootCooldown = 30 - this.turretLevel * 5;
            }
        }
    }
    
    draw() {
        // Отрисовка базы
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);
        
        // Детали
        ctx.fillStyle = "#1E7A5E";
        ctx.fillRect(this.x + 10, this.y + 5, this.width - 20, 10);
        ctx.fillRect(this.x + 15, this.y + 20, this.width - 30, 10);
        
        // Отрисовка турели
        if (this.turretLevel > 0) {
            const turretSize = 6 + this.turretLevel * 2;
            ctx.fillStyle = "#6464FF";
            ctx.fillRect(
                this.x + this.width/2 - turretSize/2,
                this.y - turretSize,
                turretSize,
                turretSize
            );
        }
        
        // Отрисовка щита
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
        
        // Отрисовка шкалы здоровья
        ctx.fillStyle = "#323232";
        ctx.fillRect(this.x, this.y - 15, this.width, 5);
        const healthWidth = this.width * (this.health / this.maxHealth);
        ctx.fillStyle = this.health > this.maxHealth * 0.3 ? GREEN : RED;
        ctx.fillRect(this.x, this.y - 15, healthWidth, 5);
    }
}

// Класс игрока
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
        this.damageMultiplier = 1 + 0.4 * upgrades.playerDamage; // Усиленный урон
        this.fireRateMultiplier = 1 + 0.25 * upgrades.playerFireRate; // Усиленная скорострельность
        this.shield = 0;
        this.maxShield = 60 * upgrades.playerShield; // Усиленные щиты
        this.score = 0;
        this.lives = 3;
        this.invincible = 0;
        this.shootCooldown = 0;
        this.engineParticles = [];
    }
    
    move(dx, dy) {
        this.x = Math.max(this.width / 2, Math.min(WIDTH - this.width / 2, this.x + dx * this.speed * deltaTime));
        this.y = Math.max(this.height / 2, Math.min(HEIGHT - this.height / 2, this.y + dy * this.speed * deltaTime));
        
        // Добавление частиц двигателя
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
        
        // Обновление частиц двигателя
        this.engineParticles.forEach(particle => particle.update());
        this.engineParticles = this.engineParticles.filter(p => p.active);
    }
    
    shoot() {
        if (this.shootCooldown <= 0) {
            // Оружие 1 уровня - одиночный лазер
            if (this.weaponLevel === 1) {
                bullets.push(new Bullet(this.x, this.y - 30, 0, -10, BLUE, 10 * this.damageMultiplier));
            }
            // Оружие 2 уровня - двойной лазер
            else if (this.weaponLevel === 2) {
                bullets.push(new Bullet(this.x - 15, this.y - 20, 0, -10, BLUE, 10 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 15, this.y - 20, 0, -10, BLUE, 10 * this.damageMultiplier));
            }
            // Оружие 3 уровня - тройной лазер
            else if (this.weaponLevel === 3) {
                bullets.push(new Bullet(this.x - 20, this.y - 20, -1, -9, CYAN, 12 * this.damageMultiplier));
                bullets.push(new Bullet(this.x, this.y - 30, 0, -10, BLUE, 15 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 20, this.y - 20, 1, -9, CYAN, 12 * this.damageMultiplier));
            }
            // Оружие 4 уровня - пятерной лазер
            else if (this.weaponLevel === 4) {
                bullets.push(new Bullet(this.x - 25, this.y - 15, -2, -8, CYAN, 12 * this.damageMultiplier));
                bullets.push(new Bullet(this.x - 10, this.y - 25, -1, -9, BLUE, 14 * this.damageMultiplier));
                bullets.push(new Bullet(this.x, this.y - 30, 0, -10, BLUE, 16 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 10, this.y - 25, 1, -9, BLUE, 14 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 25, this.y - 15, 2, -8, CYAN, 12 * this.damageMultiplier));
            }
            // Оружие 5 уровня - семилучевой лазер
            else if (this.weaponLevel === 5) {
                bullets.push(new Bullet(this.x - 30, this.y - 10, -3, -7, PURPLE, 15 * this.damageMultiplier));
                bullets.push(new Bullet(this.x - 15, this.y - 20, -1.5, -8.5, CYAN, 14 * this.damageMultiplier));
                bullets.push(new Bullet(this.x, this.y - 25, 0, -9, BLUE, 16 * this.damageMultiplier));
                bullets.push(new Bullet(this.x, this.y - 35, 0, -10, BLUE, 16 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 15, this.y - 20, 1.5, -8.5, CYAN, 14 * this.damageMultiplier));
                bullets.push(new Bullet(this.x + 30, this.y - 10, 3, -7, PURPLE, 15 * this.damageMultiplier));
            }
            
            this.shootCooldown = (10 - Math.min(3, this.weaponLevel)) / this.fireRateMultiplier;
        }
    }
    
    draw() {
        // Отрисовка щита
        if (this.shield > 0) {
            const shieldAlpha = Math.min(150, 150 * (this.shield / this.maxShield));
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width / 2 + 5, 0, Math.PI * 2);
            ctx.strokeStyle = `rgba(100, 200, 255, ${shieldAlpha/255})`;
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        
        // Точки корабля
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
        
        // Цвет корабля (мигает при неуязвимости)
        let shipColor = BLUE;
        if (this.invincible > 0 && Math.floor(this.invincible / 4) % 2 === 0) {
            shipColor = PURPLE;
        }
        
        // Отрисовка корабля
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
        
        // Отрисовка частиц двигателя
        this.engineParticles.forEach(particle => particle.draw());
        
        // Отрисовка шкалы здоровья
        ctx.fillStyle = "#323246";
        ctx.fillRect(this.x - 30, this.y + 35, 60, 5);
        const healthWidth = 60 * (this.health / this.maxHealth);
        ctx.fillStyle = GREEN;
        ctx.fillRect(this.x - 30, this.y + 35, healthWidth, 5);
        
        // Отрисовка индикаторов оружия
        for (let i = 0; i < this.weaponLevel; i++) {
            ctx.fillStyle = YELLOW;
            ctx.fillRect(this.x - 28 + i * 15, this.y + 45, 10, 3);
        }
    }
}

// Класс пули
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

// Класс врага
class Enemy {
    constructor(x, y, type, level, wave) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.level = level;
        this.wave = wave; // Добавлено поле волны
        this.setupEnemy();
        this.shootCooldown = 0;
        this.particles = [];
        this.active = true;
        this.targetBase = null;
        this.attackCooldown = 0;
    }
    
    setupEnemy() {
        // Базовые характеристики с учетом уровня и волны
        const healthMultiplier = 1 + (this.level * 0.2) + (this.wave * 0.1);
        
        if (this.type === 0) { // Маленький враг
            this.health = Math.floor((20 + this.level * 5) * healthMultiplier);
            this.maxHealth = this.health;
            this.speed = Math.random() * 1 + 1 + this.level * 0.1;
            this.scoreValue = 10;
            this.shootChance = 0.01;
            this.color = RED;
            this.size = 20;
            this.damage = 10;
            this.behavior = "basic";
        } else if (this.type === 1) { // Быстрый враг
            this.health = Math.floor((30 + this.level * 6) * healthMultiplier);
            this.maxHealth = this.health;
            this.speed = Math.random() * 1.5 + 1.5 + this.level * 0.15;
            this.scoreValue = 15;
            this.shootChance = 0.02;
            this.color = "#FF64C8";
            this.size = 15;
            this.damage = 15;
            this.behavior = "evasive";
            this.evasiveTimer = 0;
        } else if (this.type === 2) { // Танк
            this.health = Math.floor((150 + this.level * 20) * healthMultiplier);
            this.maxHealth = this.health;
            this.speed = Math.random() * 0.3 + 0.3 + this.level * 0.03;
            this.scoreValue = 30;
            this.shootChance = 0.01;
            this.color = "#FF9632";
            this.size = 40;
            this.damage = 25;
            this.behavior = "tank";
        } else if (this.type === 3) { // Бомбардировщик
            this.health = Math.floor((40 + this.level * 8) * healthMultiplier);
            this.maxHealth = this.health;
            this.speed = Math.random() * 0.8 + 0.8 + this.level * 0.08;
            this.scoreValue = 25;
            this.shootChance = 0.03;
            this.color = "#C864FF";
            this.size = 25;
            this.damage = 20;
            this.behavior = "bomber";
            this.bombTimer = 0;
        } else if (this.type === 5) { // Снайпер (новый тип)
            this.health = Math.floor((50 + this.level * 10) * healthMultiplier);
            this.maxHealth = this.health;
            this.speed = Math.random() * 0.7 + 0.7;
            this.scoreValue = 40;
            this.shootChance = 0.01;
            this.color = "#3296FF";
            this.size = 22;
            this.damage = 30;
            this.behavior = "sniper";
            this.sniperTimer = 0;
        } else { // Босс
            this.health = Math.floor((500 + this.level * 200) * healthMultiplier);
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
        // Поиск цели (базы)
        if (!this.targetBase || this.targetBase.health <= 0) {
            this.findTargetBase();
        }
        
        // Движение к цели
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
            // Движение вниз если нет баз
            this.y += this.speed * deltaTime;
        }
        
        // Особые поведения
        if (this.behavior === "evasive") {
            this.evasiveTimer += deltaTime;
            // Зигзагообразное движение
            this.x += Math.sin(this.evasiveTimer * 0.1) * 1.5;
        } else if (this.behavior === "bomber") {
            this.bombTimer += deltaTime;
            if (this.bombTimer > 120) {
                this.dropBomb();
                this.bombTimer = 0;
            }
        } else if (this.behavior === "sniper") {
            this.sniperTimer += deltaTime;
            if (this.sniperTimer > 180) {
                this.sniperShot();
                this.sniperTimer = 0;
            }
        }
        
        if (this.shootCooldown > 0) {
            this.shootCooldown -= deltaTime;
        }
        
        // Обновление частиц
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
    
    sniperShot() {
        // Мощный выстрел в базу
        if (this.targetBase) {
            const targetX = this.targetBase.x + this.targetBase.width / 2;
            const targetY = this.targetBase.y + this.targetBase.height / 2;
            
            const dx = targetX - this.x;
            const dy = targetY - this.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance > 0) {
                const speed = 8;
                bullets.push(new Bullet(
                    this.x, this.y + this.size,
                    (dx / distance) * speed,
                    (dy / distance) * speed,
                    BLUE,
                    25 // Большой урон
                ));
            }
        }
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
        
        // Создание частиц при попадании
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
        // Отрисовка врага по типу
        if (this.type === 0) { // Маленький
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        else if (this.type === 1) { // Быстрый
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x - this.size, this.y + this.size);
            ctx.lineTo(this.x + this.size, this.y + this.size);
            ctx.closePath();
            ctx.fillStyle = this.color;
            ctx.fill();
        }
        else if (this.type === 2) { // Танк
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x - this.size, this.y - this.size/2, this.size*2, this.size);
            ctx.fillStyle = "#646464";
            ctx.fillRect(this.x - this.size/2, this.y - this.size, this.size, this.size/2);
        }
        else if (this.type === 3) { // Бомбардировщик
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.size, this.size/1.5, 0, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            
            // Крылья
            ctx.fillStyle = "#9632C8";
            ctx.fillRect(this.x - this.size*1.5, this.y - 5, this.size, 10);
            ctx.fillRect(this.x + this.size*0.5, this.y - 5, this.size, 10);
        }
        else if (this.type === 5) { // Снайпер (новый)
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = this.color;
            ctx.fill();
            
            // Прицел
            ctx.strokeStyle = WHITE;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(this.x - this.size, this.y);
            ctx.lineTo(this.x + this.size, this.y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(this.x, this.y - this.size);
            ctx.lineTo(this.x, this.y + this.size);
            ctx.stroke();
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size/2, 0, Math.PI * 2);
            ctx.stroke();
        }
        else { // Босс
            // Отрисовка босса в классе Boss
        }
        
        // Отрисовка шкалы здоровья для не-боссов
        if (this.type !== 4) {
            ctx.fillStyle = "#323232";
            ctx.fillRect(this.x - this.size, this.y - this.size - 10, this.size * 2, 5);
            const healthWidth = this.size * 2 * (this.health / this.maxHealth);
            ctx.fillStyle = this.health > this.maxHealth * 0.3 ? GREEN : RED;
            ctx.fillRect(this.x - this.size, this.y - this.size - 10, healthWidth, 5);
        }
        
        // Отрисовка частиц
        this.particles.forEach(particle => particle.draw());
    }
}

// Класс босса
class Boss extends Enemy {
    constructor(level) {
        super(WIDTH / 2, -100, 4, level);
        this.phase = 1;
        this.attackTimer = 0;
        this.attackPattern = 0;
        this.attackCooldown = 0;
        this.specialAttackTimer = 0;
        this.pulse = 0;
        // Усиливаем босса в зависимости от уровня
        this.maxHealth = 500 + level * 300;
        this.health = this.maxHealth;
        this.damage = 40 + level * 5;
    }
    
    update() {
        if (this.y < 150) {
            this.y += this.speed * deltaTime;
        } else {
            this.attackTimer += deltaTime;
            this.pulse += 0.1 * deltaTime;
            
            // Смена паттерна атаки
            if (this.attackTimer > 180) {
                this.attackTimer = 0;
                this.attackPattern = Math.floor(Math.random() * 4); // Добавлен новый паттерн
                this.attackCooldown = 30;
            }
            
            if (this.attackCooldown > 0) {
                this.attackCooldown -= deltaTime;
            }
            
            // Специальная атака
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
            if (this.attackPattern === 0) { // Веер
                for (let angle = -60; angle <= 60; angle += 15) {
                    const rad = angle * Math.PI / 180;
                    bullets.push(new Bullet(
                        this.x, this.y + 30,
                        Math.sin(rad) * 3, Math.cos(rad) * 3,
                        PURPLE, 10
                    ));
                }
            } else if (this.attackPattern === 1) { // Спираль
                const angle = this.attackTimer * 10;
                const rad = angle * Math.PI / 180;
                bullets.push(new Bullet(
                    this.x, this.y + 30,
                    Math.sin(rad) * 4, Math.cos(rad) * 4,
                    RED, 8
                ));
            } else if (this.attackPattern === 2) { // Направленная
                bullets.push(new Bullet(this.x - 40, this.y + 30, -1, 4, BLUE, 12));
                bullets.push(new Bullet(this.x + 40, this.y + 30, 1, 4, BLUE, 12));
                bullets.push(new Bullet(this.x, this.y + 30, 0, 4, BLUE, 15));
            } else if (this.attackPattern === 3) { // Круговой обстрел (новый)
                for (let angle = 0; angle < 360; angle += 30) {
                    const rad = angle * Math.PI / 180;
                    bullets.push(new Bullet(
                        this.x, this.y + 30,
                        Math.sin(rad) * 3, Math.cos(rad) * 3,
                        GREEN, 7
                    ));
                }
            }
            
            this.attackCooldown = 20;
            screenShake(3, 5);
            return true;
        }
        return false;
    }
    
    specialAttack() {
        for (let i = 0; i < 12; i++) { // Больше пуль
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
        
        // Создание частиц при попадании
        for (let i = 0; i < 10; i++) {
            this.particles.push(new Particle(
                this.x + Math.random() * this.size - this.size/2,
                this.y + Math.random() * this.size - this.size/2,
                this.color,
                Math.random() * 3 + 3,
                [Math.random() * 4 - 2, Math.random() * 4 - 2]
            ));
        }
        
        // Смена фазы при 50% здоровья
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
        // Пульсация
        const pulseSize = this.size + Math.sin(this.pulse) * 5;
        
        // Отрисовка босса
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseSize, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.beginPath();
        ctx.arc(this.x, this.y, pulseSize - 10, 0, Math.PI * 2);
        ctx.fillStyle = "#FFC8C8";
        ctx.fill();
        
        // Глаза
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
        
        // Рот
        ctx.beginPath();
        ctx.arc(this.x, this.y + 25, 15, 0, Math.PI);
        ctx.strokeStyle = "#640000";
        ctx.lineWidth = 5;
        ctx.stroke();
        
        // Отрисовка шкалы здоровья
        ctx.fillStyle = "#323232";
        ctx.fillRect(this.x - this.size, this.y - this.size - 20, this.size * 2, 10);
        const healthWidth = this.size * 2 * (this.health / this.maxHealth);
        ctx.fillStyle = GREEN;
        ctx.fillRect(this.x - this.size, this.y - this.size - 20, healthWidth, 10);
        
        // Отрисовка частиц
        this.particles.forEach(particle => particle.draw());
    }
}

// Класс улучшения
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.speed = 2;
        this.size = 20;
        this.rotation = 0;
        this.active = true;
        this.colors = [GREEN, YELLOW, CYAN, PURPLE, "#FFA500", YELLOW]; // Добавлен новый цвет
        this.shapes = ["circle", "square", "triangle", "diamond", "star", "hexagon"]; // Добавлена новая форма
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
        
        // Отрисовка вращающегося улучшения
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
        else if (shape === "hexagon") { // Новая форма
            ctx.beginPath();
            for (let i = 0; i < 6; i++) {
                const angle = i * Math.PI / 3;
                ctx.lineTo(
                    Math.cos(angle) * this.size,
                    Math.sin(angle) * this.size
                );
            }
            ctx.closePath();
            ctx.fillStyle = color;
            ctx.fill();
        }
        
        ctx.strokeStyle = WHITE;
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Центр
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 3, 0, Math.PI * 2);
        ctx.fillStyle = "#C8C8FF";
        ctx.fill();
        
        ctx.restore();
    }
}

// Класс взрыва
class Explosion {
    constructor(x, y, size, color) {
        this.x = x;
        this.y = y;
        this.size = size;
        this.color = color;
        this.particles = [];
        this.life = 60;
        this.active = true;
        
        // Создание частиц взрыва
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

// Запуск игры
window.onload = init;
