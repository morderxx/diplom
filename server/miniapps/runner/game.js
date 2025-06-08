document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const playBtn = document.getElementById('play-game');
    const gameModal = document.getElementById('game-modal');
    const closeBtn = document.querySelector('.close-game');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score-display');
    const gameOverScreen = document.getElementById('game-over');
    const finalScore = document.getElementById('final-score');
    const highScoreDisplay = document.getElementById('high-score');
    const restartBtn = document.getElementById('restart-btn');
    
    // Размеры canvas (увеличенные для большего обзора)
    const CANVAS_WIDTH = canvas.width = 1200;
    const CANVAS_HEIGHT = canvas.height = 500;
    
    // Игровые переменные (замедленные)
    let gameSpeed = 4;
    let gameFrame = 0;
    let score = 0;
    let highScore = localStorage.getItem('dinoHighScore') || 0;
    let gameRunning = false;
    let obstacles = [];
    
    // Игрок
    const player = {
        x: 100, // Сдвигаем игрока правее для лучшего обзора
        y: CANVAS_HEIGHT - 150,
        width: 60,
        height: 90,
        gravity: 0.5,
        velocity: 0,
        jumpForce: 14,
        jumping: false,
        ducking: false,
        normalHeight: 90,
        duckHeight: 50,
        
        draw() {
            ctx.fillStyle = '#4CAF50';
            
            if (this.ducking) {
                ctx.fillRect(this.x, this.y + this.normalHeight - this.duckHeight, this.width, this.duckHeight);
                ctx.beginPath();
                ctx.arc(this.x + 45, this.y + this.normalHeight - this.duckHeight - 20, 25, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 50, this.y + this.normalHeight - this.duckHeight - 25, 6, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(this.x, this.y, this.width, this.height);
                ctx.beginPath();
                ctx.arc(this.x + 45, this.y - 20, 25, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 50, this.y - 25, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#388E3C';
                ctx.fillRect(this.x + 15, this.y + this.height, 12, 25);
                ctx.fillRect(this.x + 40, this.y + this.height, 12, 25);
            }
        },
        
        update() {
            this.velocity += this.gravity;
            this.y += this.velocity;
            
            if (this.y >= CANVAS_HEIGHT - this.height) {
                this.y = CANVAS_HEIGHT - this.height;
                this.velocity = 0;
                this.jumping = false;
            }
            
            if (this.ducking && !this.jumping) {
                this.height = this.duckHeight;
            } else {
                this.height = this.normalHeight;
            }
        },
        
        jump() {
            if (!this.jumping && !this.ducking) {
                this.velocity = -this.jumpForce;
                this.jumping = true;
            }
        },
        
        duck() {
            if (!this.jumping) {
                this.ducking = true;
            }
        },
        
        stand() {
            this.ducking = false;
        }
    };
    
    // Класс для фоновых гор (параллакс)
    class Mountain {
        constructor(y, height, color, speed) {
            this.y = y;
            this.height = height;
            this.color = color;
            this.speed = speed;
            this.x = 0;
        }
        
        draw() {
            ctx.fillStyle = this.color;
            
            // Рисуем горы как серию треугольников
            for (let i = -1; i < CANVAS_WIDTH / 200 + 1; i++) {
                const startX = i * 200 + (gameFrame * this.speed) % 200;
                ctx.beginPath();
                ctx.moveTo(startX, this.y + this.height);
                ctx.lineTo(startX + 100, this.y);
                ctx.lineTo(startX + 200, this.y + this.height);
                ctx.fill();
            }
        }
    }
    
    // Класс для земли
    class Ground {
        constructor() {
            this.x = 0;
            this.width = CANVAS_WIDTH;
            this.height = 40;
            this.y = CANVAS_HEIGHT - this.height;
        }
        
        draw() {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Текстура земли
            ctx.fillStyle = '#A0522D';
            for (let i = 0; i < this.width; i += 30) {
                ctx.fillRect(i, this.y, 15, 6);
            }
        }
        
        update() {
            this.x = gameFrame * gameSpeed % 30;
        }
    }
    
    // Класс для облаков
    class Cloud {
        constructor() {
            this.width = 80 + Math.random() * 60;
            this.height = 35 + Math.random() * 25;
            this.x = CANVAS_WIDTH + Math.random() * 300;
            this.y = 50 + Math.random() * 150;
            this.speed = 0.3 + Math.random() * 0.4;
        }
        
        draw() {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width/4, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/3, this.y - this.height/3, this.width/5, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/2, this.y, this.width/4, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/1.8, this.y + this.height/4, this.width/5, 0, Math.PI * 2);
            ctx.fill();
        }
        
        update() {
            this.x -= this.speed;
        }
    }
    
    // Класс для препятствий
    class Obstacle {
        constructor() {
            this.width = 35;
            this.x = CANVAS_WIDTH;
            this.type = Math.random() > 0.5 ? 'cactus' : 'bird';
            
            if (this.type === 'cactus') {
                this.height = 60 + Math.random() * 40;
                this.y = CANVAS_HEIGHT - this.height - 40;
            } else {
                this.height = 35;
                this.y = CANVAS_HEIGHT - 180 - Math.random() * 150;
            }
        }
        
        draw() {
            if (this.type === 'cactus') {
                ctx.fillStyle = '#2E8B57';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                
                ctx.fillStyle = '#3CB371';
                for (let i = 0; i < this.height; i += 15) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y + i);
                    ctx.lineTo(this.x - 12, this.y + i + 6);
                    ctx.lineTo(this.x, this.y + i + 12);
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.moveTo(this.x + this.width, this.y + i);
                    ctx.lineTo(this.x + this.width + 12, this.y + i + 6);
                    ctx.lineTo(this.x + this.width, this.y + i + 12);
                    ctx.fill();
                }
            } else {
                ctx.fillStyle = '#9370DB';
                ctx.beginPath();
                ctx.ellipse(this.x + 18, this.y + 18, 18, 12, 0, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                const wingY = Math.sin(gameFrame * 0.12) * 6 + this.y;
                ctx.moveTo(this.x, this.y + 18);
                ctx.quadraticCurveTo(this.x - 15, wingY, this.x, this.y + 18);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(this.x + 30, this.y + 12, 10, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(this.x + 33, this.y + 10, 4, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 33, this.y + 10, 2, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#FF8C00';
                ctx.beginPath();
                ctx.moveTo(this.x + 35, this.y + 12);
                ctx.lineTo(this.x + 50, this.y + 12);
                ctx.lineTo(this.x + 35, this.y + 18);
                ctx.fill();
            }
        }
        
        update() {
            this.x -= gameSpeed;
        }
    }
    
    // Создаем слои фона (параллакс)
    const mountains = [
        new Mountain(300, 100, 'rgba(80, 40, 20, 0.5)', 0.1), // Дальние горы
        new Mountain(350, 150, 'rgba(100, 50, 30, 0.7)', 0.3), // Средние горы
    ];
    
    const ground = new Ground();
    const clouds = [];
    
    // Функция для генерации облаков
    function generateClouds() {
        if (gameFrame % 300 === 0) {
            clouds.push(new Cloud());
        }
    }
    
    // Функция для генерации препятствий
    function generateObstacles() {
        if (gameFrame % 150 === 0) {
            obstacles.push(new Obstacle());
        }
    }
    
    // Функция проверки коллизий
    function checkCollision() {
        for (let obstacle of obstacles) {
            const playerRect = {
                x: player.x,
                y: player.y,
                width: player.width,
                height: player.height
            };
            
            const obstacleRect = {
                x: obstacle.x,
                y: obstacle.y,
                width: obstacle.width,
                height: obstacle.height
            };
            
            if (
                playerRect.x < obstacleRect.x + obstacleRect.width &&
                playerRect.x + playerRect.width > obstacleRect.x &&
                playerRect.y < obstacleRect.y + obstacleRect.height &&
                playerRect.y + playerRect.height > obstacleRect.y
            ) {
                return true;
            }
        }
        return false;
    }
    
    // Функция обновления счета
    function updateScore() {
        score = Math.floor(gameFrame / 5);
        scoreDisplay.textContent = `Счет: ${score}`;
        
        // Плавное увеличение скорости
        gameSpeed = 4 + Math.floor(score / 700);
        if (gameSpeed > 10) gameSpeed = 10;
    }
    
    // Функция сброса игры
    function resetGame() {
        gameFrame = 0;
        score = 0;
        gameSpeed = 4;
        obstacles = [];
        clouds.length = 0;
        player.y = CANVAS_HEIGHT - player.normalHeight;
        player.velocity = 0;
        player.jumping = false;
        player.ducking = false;
        player.height = player.normalHeight;
        gameRunning = true;
        gameOverScreen.classList.add('hidden');
    }
    
    // Основной игровой цикл
    function animate() {
        if (!gameRunning) return;
        
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Рисуем небо
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(0.7, '#E0F7FA');
        gradient.addColorStop(1, '#87CEEB');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Рисуем горы (параллакс)
        mountains.forEach(mountain => mountain.draw());
        
        // Обновляем и рисуем облака
        generateClouds();
        for (let i = clouds.length - 1; i >= 0; i--) {
            clouds[i].update();
            clouds[i].draw();
            
            // Удаляем облака за пределами экрана
            if (clouds[i].x < -clouds[i].width) {
                clouds.splice(i, 1);
            }
        }
        
        // Обновляем и рисуем землю
        ground.update();
        ground.draw();
        
        // Генерируем препятствия
        generateObstacles();
        
        // Обновляем и рисуем препятствия
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update();
            obstacles[i].draw();
            
            // Удаляем препятствия за пределами экрана
            if (obstacles[i].x < -obstacles[i].width) {
                obstacles.splice(i, 1);
            }
        }
        
        // Обновляем и рисуем игрока
        player.update();
        player.draw();
        
        // Обновляем счет
        updateScore();
        
        // Проверяем коллизии
        if (checkCollision()) {
            gameRunning = false;
            
            // Обновляем рекорд
            if (score > highScore) {
                highScore = score;
                localStorage.setItem('dinoHighScore', highScore);
            }
            
            // Показываем экран окончания игры
            finalScore.textContent = score;
            highScoreDisplay.textContent = highScore;
            gameOverScreen.classList.remove('hidden');
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
    
    // Управление игрой
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Space' || e.key === 'ArrowUp') {
            player.jump();
        }
        
        if (e.key === 'ArrowDown') {
            player.duck();
        }
    });
    
    document.addEventListener('keyup', (e) => {
        if (e.key === 'ArrowDown') {
            player.stand();
        }
    });
    
    // Для мобильных устройств
    canvas.addEventListener('touchstart', () => {
        player.jump();
    });
    
    // Инициализация рекорда
    highScoreDisplay.textContent = highScore;
});
