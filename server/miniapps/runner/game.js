document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const playBtn = document.getElementById('play-game');
    const gameModal = document.getElementById('game-modal');
    const closeBtn = document.querySelector('.close-game');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score-display');
    const speedDisplay = document.getElementById('speed-display');
    const energyDisplay = document.getElementById('energy-display');
    const gameOverScreen = document.getElementById('game-over');
    const finalScore = document.getElementById('final-score');
    const highScoreDisplay = document.getElementById('high-score');
    const restartBtn = document.getElementById('restart-btn');
    
    // Размеры canvas (очень широкий)
    const CANVAS_WIDTH = canvas.width = 1800;
    const CANVAS_HEIGHT = canvas.height = 600;
    
    // Игровые переменные
    let gameSpeed = 7; // Увеличенная начальная скорость
    let gameFrame = 0;
    let score = 0;
    let energy = 0;
    let highScore = localStorage.getItem('dinoHighScore') || 0;
    let gameRunning = false;
    let obstacles = [];
    let stars = [];
    let planets = [];
    let particles = [];
    let nebulas = [];
    
    // Анимационные состояния динозавра
    let dinoLegState = 0;
    let dinoLegTimer = 0;
    
    // Игрок
    const player = {
        x: 200,
        y: CANVAS_HEIGHT - 170,
        width: 70,
        height: 100,
        gravity: 0.6,
        velocity: 0,
        jumpForce: 16,
        jumping: false,
        ducking: false,
        normalHeight: 100,
        duckHeight: 60,
        boostActive: false,
        boostTime: 0,
        
        draw() {
            // Эффект свечения
            ctx.shadowColor = '#ff6600';
            ctx.shadowBlur = 20;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;
            
            // Тело
            ctx.fillStyle = '#ff6600';
            
            if (this.ducking) {
                // Тело при приседании
                ctx.fillRect(this.x, this.y + this.normalHeight - this.duckHeight, this.width, this.duckHeight);
                
                // Голова
                ctx.beginPath();
                ctx.arc(this.x + 50, this.y + this.normalHeight - this.duckHeight - 25, 30, 0, Math.PI * 2);
                ctx.fill();
                
                // Глаз
                ctx.fillStyle = '#330000';
                ctx.beginPath();
                ctx.arc(this.x + 60, this.y + this.normalHeight - this.duckHeight - 30, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Улыбка
                ctx.strokeStyle = '#330000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x + 60, this.y + this.normalHeight - this.duckHeight - 25, 15, 0.2, Math.PI * 0.8);
                ctx.stroke();
            } else {
                // Тело
                ctx.fillRect(this.x, this.y, this.width, this.height);
                
                // Шея и голова
                ctx.beginPath();
                ctx.arc(this.x + 50, this.y - 25, 30, 0, Math.PI * 2);
                ctx.fill();
                
                // Глаз
                ctx.fillStyle = '#330000';
                ctx.beginPath();
                ctx.arc(this.x + 60, this.y - 30, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Улыбка
                ctx.strokeStyle = '#330000';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x + 60, this.y - 25, 20, 0.2, Math.PI * 0.8);
                ctx.stroke();
                
                // Ноги (анимированные)
                ctx.fillStyle = '#cc3300';
                const legOffset = dinoLegState === 0 ? 0 : 12;
                
                // Передняя нога
                ctx.fillRect(this.x + 20, this.y + this.height, 18, 30);
                // Задняя нога
                ctx.fillRect(this.x + 45 + legOffset, this.y + this.height, 18, 30);
            }
            
            // Эффект ускорения
            if (this.boostActive) {
                ctx.fillStyle = '#ffff00';
                ctx.globalAlpha = 0.6;
                ctx.beginPath();
                ctx.arc(this.x - 25, this.y + this.height/2, 35, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1.0;
                
                // Частицы ускорения
                if (gameFrame % 3 === 0) {
                    createParticles(this.x - 30, this.y + this.height/2, 3, '#ffff00');
                }
            }
            
            ctx.shadowBlur = 0;
        },
        
        update() {
            // Гравитация
            this.velocity += this.gravity;
            this.y += this.velocity;
            
            // Земля
            if (this.y >= CANVAS_HEIGHT - this.height) {
                this.y = CANVAS_HEIGHT - this.height;
                this.velocity = 0;
                this.jumping = false;
                
                // Анимация ног при беге
                dinoLegTimer++;
                if (dinoLegTimer > 6 - Math.min(5, gameSpeed/3)) {
                    dinoLegTimer = 0;
                    dinoLegState = dinoLegState === 0 ? 1 : 0;
                }
            }
            
            // Обновление высоты при приседании
            if (this.ducking && !this.jumping) {
                this.height = this.duckHeight;
            } else {
                this.height = this.normalHeight;
            }
            
            // Управление ускорением
            if (this.boostActive) {
                this.boostTime--;
                if (this.boostTime <= 0) {
                    this.boostActive = false;
                }
            }
        },
        
        jump() {
            if (!this.jumping && !this.ducking) {
                this.velocity = -this.jumpForce;
                this.jumping = true;
                dinoLegState = 0;
                
                // Эффект прыжка
                createParticles(this.x + this.width/2, this.y + this.height, 12, '#ff6600');
            }
        },
        
        duck() {
            if (!this.jumping) {
                this.ducking = true;
            }
        },
        
        stand() {
            this.ducking = false;
        },
        
        boost() {
            if (energy >= 10) {
                this.boostActive = true;
                this.boostTime = 150; // 2.5 секунды при 60fps
                energy -= 10;
                createParticles(this.x + this.width/2, this.y + this.height/2, 20, '#ffff00');
            }
        }
    };
    
    // Класс для планет (параллакс)
    class Planet {
        constructor(size, x, y, color, speed) {
            this.size = size;
            this.x = x;
            this.y = y;
            this.color = color;
            this.speed = speed;
        }
        
        draw() {
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 40;
            
            // Градиент для планет
            const gradient = ctx.createRadialGradient(
                this.x - this.size/3, this.y - this.size/3, 1,
                this.x, this.y, this.size
            );
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(1, this.color);
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            
            // Детали планет
            if (this.color === '#ff9966') {
                ctx.fillStyle = '#cc6600';
                ctx.beginPath();
                ctx.arc(this.x - this.size/3, this.y - this.size/3, this.size/4, 0, Math.PI * 2);
                ctx.fill();
            } else if (this.color === '#66ccff') {
                ctx.strokeStyle = '#3399ff';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size * 0.8, 0, Math.PI * 2);
                ctx.stroke();
            }
        }
        
        update() {
            this.x -= this.speed * (player.boostActive ? 1.5 : 1);
            if (this.x < -this.size * 2) {
                this.x = CANVAS_WIDTH + this.size * 2;
                this.y = 50 + Math.random() * 200;
            }
        }
    }
    
    // Класс для туманностей
    class Nebula {
        constructor() {
            this.x = Math.random() * CANVAS_WIDTH * 2;
            this.y = Math.random() * CANVAS_HEIGHT * 0.7;
            this.width = 300 + Math.random() * 500;
            this.height = 200 + Math.random() * 300;
            this.speed = (Math.random() * 0.3 + 0.1) * (player.boostActive ? 1.5 : 1);
            this.color = `hsla(${Math.random() * 360}, 70%, 60%, ${Math.random() * 0.1 + 0.05})`;
        }
        
        draw() {
            ctx.globalAlpha = 0.4;
            ctx.fillStyle = this.color;
            ctx.beginPath();
            ctx.ellipse(this.x, this.y, this.width, this.height, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
        }
        
        update() {
            this.x -= this.speed;
            if (this.x < -this.width * 2) {
                this.x = CANVAS_WIDTH + this.width * 2;
                this.y = Math.random() * CANVAS_HEIGHT * 0.7;
            }
        }
    }
    
    // Класс для звезд
    class Star {
        constructor() {
            this.x = Math.random() * CANVAS_WIDTH;
            this.y = Math.random() * CANVAS_HEIGHT * 0.8;
            this.size = Math.random() * 3 + 1;
            this.speed = Math.random() * 0.5 + 0.1;
            this.brightness = Math.random() * 0.5 + 0.5;
            this.color = `hsl(${Math.random() * 60 + 180}, 100%, 80%)`;
        }
        
        draw() {
            ctx.fillStyle = this.color;
            ctx.globalAlpha = this.brightness;
            ctx.shadowColor = 'white';
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.globalAlpha = 1.0;
        }
        
        update() {
            this.x -= this.speed * (player.boostActive ? 1.5 : 1);
            if (this.x < -10) {
                this.x = CANVAS_WIDTH + 10;
                this.y = Math.random() * CANVAS_HEIGHT * 0.8;
            }
            
            // Мерцание звезд
            if (Math.random() < 0.02) {
                this.brightness = Math.random() * 0.5 + 0.5;
            }
        }
    }
    
    // Класс для звездной энергии
    class EnergyStar {
        constructor() {
            this.width = 28;
            this.height = 28;
            this.x = CANVAS_WIDTH + Math.random() * 300; // Уменьшенное расстояние
            this.y = CANVAS_HEIGHT - 280 - Math.random() * 280;
            this.speed = gameSpeed * 0.9;
            this.rotation = 0;
            this.glow = 0;
            this.glowDirection = 1;
            this.colors = ['#66ffff', '#ff66ff', '#66ff66'];
            this.colorIndex = Math.floor(Math.random() * this.colors.length);
        }
        
        draw() {
            ctx.save();
            ctx.translate(this.x + this.width/2, this.y + this.height/2);
            ctx.rotate(this.rotation);
            
            // Эффект свечения
            ctx.shadowColor = this.colors[this.colorIndex];
            ctx.shadowBlur = 15 + this.glow;
            
            // Звезда
            ctx.fillStyle = this.colors[this.colorIndex];
            ctx.beginPath();
            
            for (let i = 0; i < 5; i++) {
                const angle = (i * 2 * Math.PI / 5) - Math.PI/2;
                const innerAngle = angle + Math.PI/5;
                
                // Внешняя точка
                const x1 = Math.cos(angle) * this.width/2;
                const y1 = Math.sin(angle) * this.height/2;
                
                // Внутренняя точка
                const x2 = Math.cos(innerAngle) * this.width/4;
                const y2 = Math.sin(innerAngle) * this.height/4;
                
                if (i === 0) ctx.moveTo(x1, y1);
                else ctx.lineTo(x1, y1);
                
                ctx.lineTo(x2, y2);
            }
            
            ctx.closePath();
            ctx.fill();
            
            // Внутреннее свечение
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, 0, this.width/6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.restore();
            ctx.shadowBlur = 0;
        }
        
        update() {
            this.x -= this.speed * (player.boostActive ? 1.5 : 1);
            this.rotation += 0.05;
            
            // Пульсация свечения
            this.glow += this.glowDirection * 0.2;
            if (this.glow > 6 || this.glow < 0) {
                this.glowDirection *= -1;
            }
        }
    }
    
    // Класс для астероидов
    class Asteroid {
        constructor() {
            this.size = 50 + Math.random() * 70; // Уменьшенный размер
            this.x = CANVAS_WIDTH;
            this.y = CANVAS_HEIGHT - this.size - 50;
            this.speed = gameSpeed * 0.95;
            this.rotation = 0;
            this.rotationSpeed = (Math.random() - 0.5) * 0.05;
            this.points = [];
            
            // Создаем случайную форму астероида
            const pointCount = 8 + Math.floor(Math.random() * 6);
            for (let i = 0; i < pointCount; i++) {
                const angle = (i * 2 * Math.PI) / pointCount;
                const distance = this.size/2 * (0.7 + Math.random() * 0.3);
                this.points.push({
                    x: Math.cos(angle) * distance,
                    y: Math.sin(angle) * distance
                });
            }
        }
        
        draw() {
            ctx.save();
            ctx.translate(this.x + this.size/2, this.y + this.size/2);
            ctx.rotate(this.rotation);
            
            // Градиент для астероидов
            const gradient = ctx.createRadialGradient(
                0, 0, 1,
                0, 0, this.size/2
            );
            gradient.addColorStop(0, '#cccccc');
            gradient.addColorStop(1, '#666666');
            
            ctx.fillStyle = gradient;
            ctx.shadowColor = '#aaaaaa';
            ctx.shadowBlur = 15;
            ctx.beginPath();
            
            this.points.forEach((point, index) => {
                if (index === 0) ctx.moveTo(point.x, point.y);
                else ctx.lineTo(point.x, point.y);
            });
            
            ctx.closePath();
            ctx.fill();
            
            // Детали поверхности
            ctx.fillStyle = '#444444';
            for (let i = 0; i < 6; i++) {
                const idx = Math.floor(Math.random() * this.points.length);
                const point = this.points[idx];
                ctx.beginPath();
                ctx.arc(point.x * 0.7, point.y * 0.7, this.size/15, 0, Math.PI * 2);
                ctx.fill();
            }
            
            ctx.restore();
            ctx.shadowBlur = 0;
        }
        
        update() {
            this.x -= this.speed * (player.boostActive ? 1.5 : 1);
            this.rotation += this.rotationSpeed;
        }
    }
    
    // Класс для частиц
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.size = Math.random() * 8 + 2;
            this.speedX = Math.random() * 6 - 3;
            this.speedY = Math.random() * 6 - 3;
            this.color = color;
            this.life = 30;
        }
        
        draw() {
            ctx.globalAlpha = this.life / 30;
            ctx.fillStyle = this.color;
            ctx.shadowColor = this.color;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.globalAlpha = 1.0;
            ctx.shadowBlur = 0;
        }
        
        update() {
            this.x += this.speedX;
            this.y += this.speedY;
            this.life--;
        }
    }
    
    // Создание частиц
    function createParticles(x, y, count, color) {
        for (let i = 0; i < count; i++) {
            particles.push(new Particle(x, y, color));
        }
    }
    
    // Инициализация фона
    function initEnvironment() {
        // Планеты (4 слоя с параллаксом)
        planets = [
            new Planet(40, CANVAS_WIDTH + 100, 100, '#ff9966', 0.4),
            new Planet(60, CANVAS_WIDTH + 400, 250, '#66ccff', 0.6),
            new Planet(90, CANVAS_WIDTH + 700, 150, '#9966ff', 0.8),
            new Planet(30, CANVAS_WIDTH + 900, 300, '#ff66cc', 1.0)
        ];
        
        // Туманности
        for (let i = 0; i < 5; i++) {
            nebulas.push(new Nebula());
        }
        
        // Звезды на фоне
        for (let i = 0; i < 300; i++) {
            stars.push(new Star());
        }
    }
    
    // Генерация препятствий и энергии
    function generateObjects() {
        // Уменьшенное расстояние между объектами
        if (gameFrame % Math.floor(80 / (gameSpeed/3)) === 0) {
            if (Math.random() > 0.4) {
                obstacles.push(new Asteroid());
            } else {
                obstacles.push(new EnergyStar());
            }
        }
    }
    
    // Проверка коллизий
    function checkCollisions() {
        const playerRect = {
            x: player.x + 12,
            y: player.y + 8,
            width: player.width - 24,
            height: player.height - 16
        };
        
        for (let i = obstacles.length - 1; i >= 0; i--) {
            const obstacle = obstacles[i];
            let obstacleRect;
            
            if (obstacle instanceof Asteroid) {
                obstacleRect = {
                    x: obstacle.x + 8,
                    y: obstacle.y + 8,
                    width: obstacle.size - 16,
                    height: obstacle.size - 16
                };
                
                // Проверка столкновения с астероидом
                if (
                    playerRect.x < obstacleRect.x + obstacleRect.width &&
                    playerRect.x + playerRect.width > obstacleRect.x &&
                    playerRect.y < obstacleRect.y + obstacleRect.height &&
                    playerRect.y + playerRect.height > obstacleRect.y
                ) {
                    return true;
                }
            } else if (obstacle instanceof EnergyStar) {
                obstacleRect = {
                    x: obstacle.x + 4,
                    y: obstacle.y + 4,
                    width: obstacle.width - 8,
                    height: obstacle.height - 8
                };
                
                // Сбор энергии
                if (
                    playerRect.x < obstacleRect.x + obstacleRect.width &&
                    playerRect.x + playerRect.width > obstacleRect.x &&
                    playerRect.y < obstacleRect.y + obstacleRect.height &&
                    playerRect.y + playerRect.height > obstacleRect.y
                ) {
                    energy += 5;
                    if (energy > 100) energy = 100;
                    obstacles.splice(i, 1);
                    createParticles(obstacle.x + obstacle.width/2, obstacle.y + obstacle.height/2, 15, '#66ffff');
                }
            }
        }
        return false;
    }
    
    // Обновление счета
    function updateScore() {
        score = Math.floor(gameFrame / 2); // Счет растет быстрее
        scoreDisplay.textContent = `Счет: ${score}`;
        
        // Плавное увеличение скорости
        gameSpeed = 7 + score / 400; // Начальная скорость выше
        if (gameSpeed > 20) gameSpeed = 20;
        
        // Отображение скорости и энергии
        speedDisplay.textContent = `Скорость: ${gameSpeed.toFixed(1)}x`;
        energyDisplay.textContent = `Энергия: ${energy}`;
    }
    
    // Сброс игры
    function resetGame() {
        gameFrame = 0;
        score = 0;
        energy = 0;
        gameSpeed = 7;
        obstacles = [];
        particles = [];
        player.y = CANVAS_HEIGHT - player.normalHeight;
        player.velocity = 0;
        player.jumping = false;
        player.ducking = false;
        player.height = player.normalHeight;
        player.boostActive = false;
        gameRunning = true;
        gameOverScreen.classList.add('hidden');
        
        initEnvironment();
    }
    
    // Игровой цикл
    function animate() {
        if (!gameRunning) return;
        
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Космический фон
        ctx.fillStyle = '#000033';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Туманности
        nebulas.forEach(nebula => {
            nebula.update();
            nebula.draw();
        });
        
        // Обновляем и рисуем звезды
        stars.forEach(star => {
            star.update();
            star.draw();
        });
        
        // Обновляем и рисуем планеты
        planets.forEach(planet => {
            planet.update();
            planet.draw();
        });
        
        // Генерируем объекты
        generateObjects();
        
        // Обновляем и рисуем препятствия и энергию
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].speed = gameSpeed * (obstacles[i] instanceof EnergyStar ? 0.9 : 0.95);
            obstacles[i].update();
            obstacles[i].draw();
            
            // Удаляем объекты за пределами экрана
            if (obstacles[i].x < -obstacles[i].width * 2 || 
                (obstacles[i] instanceof Asteroid && obstacles[i].x < -obstacles[i].size * 2)) {
                obstacles.splice(i, 1);
            }
        }
        
        // Обновляем и рисуем частицы
        for (let i = particles.length - 1; i >= 0; i--) {
            particles[i].update();
            particles[i].draw();
            
            if (particles[i].life <= 0) {
                particles.splice(i, 1);
            }
        }
        
        // Обновляем и рисуем игрока
        player.update();
        player.draw();
        
        // Обновляем счет
        updateScore();
        
        // Проверяем коллизии
        if (checkCollisions()) {
            gameRunning = false;
            
            // Эффект взрыва
            createParticles(player.x + player.width/2, player.y + player.height/2, 80, '#ff6600');
            
            // Обновляем рекорд
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('dinoHighScore', highScore);
            }
            
            // Показываем экран окончания игры
            finalScore.textContent = score;
            highScoreDisplay.textContent = highScore;
            setTimeout(() => {
                gameOverScreen.classList.remove('hidden');
            }, 800);
        }
        
        gameFrame++;
        requestAnimationFrame(animate);
    }
    
    // Обработчики событий
    playBtn.addEventListener('click', () => {
        gameModal.style.display = 'flex';
        resetGame();
        animate();
    });
    
    closeBtn.addEventListener('click', () => {
        gameModal.style.display = 'none';
        gameRunning = false;
    });
    
    restartBtn.addEventListener('click', () => {
        resetGame();
        animate();
    });
    
    // Управление
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === 'ArrowUp') {
            player.jump();
        }
        
        if (e.key === 'ArrowDown') {
            player.duck();
        }
        
        if (e.key === 'ArrowRight') {
            player.boost();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowDown') {
            player.stand();
        }
    });
    
    // Мобильное управление
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches[0].clientX < window.innerWidth / 2) {
            player.jump();
        } else {
            player.duck();
        }
    });
    
    canvas.addEventListener('touchend', () => {
        player.stand();
    });
    
    // Инициализация рекорда
    highScoreDisplay.textContent = highScore;
    initEnvironment();
});
