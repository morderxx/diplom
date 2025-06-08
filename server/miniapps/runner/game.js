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
    
    // Размеры canvas
    const CANVAS_WIDTH = canvas.width = 800;
    const CANVAS_HEIGHT = canvas.height = 400;
    
    // Игровые переменные
    let gameSpeed = 5;
    let gameFrame = 0;
    let score = 0;
    let highScore = localStorage.getItem('dinoHighScore') || 0;
    let gameRunning = false;
    let obstacles = [];
    
    // Игровые объекты
    const player = {
        x: 50,
        y: CANVAS_HEIGHT - 100,
        width: 50,
        height: 70,
        gravity: 0.6,
        velocity: 0,
        jumpForce: 15,
        jumping: false,
        ducking: false,
        normalHeight: 70,
        duckHeight: 40,
        
        draw() {
            ctx.fillStyle = '#4CAF50';
            
            // Рисуем динозавра в зависимости от состояния
            if (this.ducking) {
                // Тело при приседании
                ctx.fillRect(this.x, this.y + this.normalHeight - this.duckHeight, this.width, this.duckHeight);
                // Голова
                ctx.beginPath();
                ctx.arc(this.x + 35, this.y + this.normalHeight - this.duckHeight - 15, 20, 0, Math.PI * 2);
                ctx.fill();
                // Глаз
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 40, this.y + this.normalHeight - this.duckHeight - 20, 5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                // Тело
                ctx.fillRect(this.x, this.y, this.width, this.height);
                // Шея и голова
                ctx.beginPath();
                ctx.arc(this.x + 35, this.y - 15, 20, 0, Math.PI * 2);
                ctx.fill();
                // Глаз
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 40, this.y - 20, 5, 0, Math.PI * 2);
                ctx.fill();
                // Ноги
                ctx.fillStyle = '#388E3C';
                ctx.fillRect(this.x + 10, this.y + this.height, 10, 20);
                ctx.fillRect(this.x + 30, this.y + this.height, 10, 20);
            }
        },
        
        update() {
            // Применяем гравитацию
            this.velocity += this.gravity;
            this.y += this.velocity;
            
            // Проверка земли
            if (this.y >= CANVAS_HEIGHT - this.height) {
                this.y = CANVAS_HEIGHT - this.height;
                this.velocity = 0;
                this.jumping = false;
            }
            
            // Обновление высоты при приседании
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
    
    // Класс для фона (земля)
    class Background {
        constructor() {
            this.x = 0;
            this.width = CANVAS_WIDTH;
            this.height = 30;
            this.y = CANVAS_HEIGHT - this.height;
        }
        
        draw() {
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Текстура земли
            ctx.fillStyle = '#A0522D';
            for (let i = 0; i < this.width; i += 20) {
                ctx.fillRect(i, this.y, 10, 5);
            }
        }
        
        update() {
            // Движение земли для создания эффекта бега
            this.x = gameFrame * gameSpeed % 20;
        }
    }
    
    // Класс для облаков
    class Cloud {
        constructor() {
            this.width = 70 + Math.random() * 50;
            this.height = 30 + Math.random() * 20;
            this.x = CANVAS_WIDTH + Math.random() * 100;
            this.y = 50 + Math.random() * 100;
            this.speed = 0.5 + Math.random() * 0.5;
        }
        
        draw() {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width/4, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/3, this.y - this.height/3, this.width/5, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/2, this.y, this.width/4, 0, Math.PI * 2);
            ctx.fill();
        }
        
        update() {
            this.x -= this.speed;
        }
    }
    
    // Класс для препятствий
    class Obstacle {
        constructor() {
            this.width = 30;
            this.x = CANVAS_WIDTH;
            this.type = Math.random() > 0.5 ? 'cactus' : 'bird';
            
            if (this.type === 'cactus') {
                this.height = 50 + Math.random() * 30;
                this.y = CANVAS_HEIGHT - this.height - 30;
            } else {
                this.height = 30;
                this.y = CANVAS_HEIGHT - 150 - Math.random() * 100;
            }
        }
        
        draw() {
            if (this.type === 'cactus') {
                // Рисуем кактус
                ctx.fillStyle = '#2E8B57';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                
                // Колючки
                ctx.fillStyle = '#3CB371';
                for (let i = 0; i < this.height; i += 10) {
                    ctx.beginPath();
                    ctx.moveTo(this.x, this.y + i);
                    ctx.lineTo(this.x - 10, this.y + i + 5);
                    ctx.lineTo(this.x, this.y + i + 10);
                    ctx.fill();
                    
                    ctx.beginPath();
                    ctx.moveTo(this.x + this.width, this.y + i);
                    ctx.lineTo(this.x + this.width + 10, this.y + i + 5);
                    ctx.lineTo(this.x + this.width, this.y + i + 10);
                    ctx.fill();
                }
            } else {
                // Рисуем птицу (птеродактиль)
                ctx.fillStyle = '#9370DB';
                // Тело
                ctx.beginPath();
                ctx.ellipse(this.x + 15, this.y + 15, 15, 10, 0, 0, Math.PI * 2);
                ctx.fill();
                
                // Крылья
                ctx.beginPath();
                const wingY = Math.sin(gameFrame * 0.2) * 5 + this.y;
                ctx.moveTo(this.x, this.y + 15);
                ctx.quadraticCurveTo(this.x - 10, wingY, this.x, this.y + 15);
                ctx.fill();
                
                // Голова
                ctx.beginPath();
                ctx.arc(this.x + 25, this.y + 10, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Глаз
                ctx.fillStyle = 'white';
                ctx.beginPath();
                ctx.arc(this.x + 27, this.y + 8, 3, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 27, this.y + 8, 1.5, 0, Math.PI * 2);
                ctx.fill();
                
                // Клюв
                ctx.fillStyle = '#FF8C00';
                ctx.beginPath();
                ctx.moveTo(this.x + 30, this.y + 10);
                ctx.lineTo(this.x + 40, this.y + 10);
                ctx.lineTo(this.x + 30, this.y + 15);
                ctx.fill();
            }
        }
        
        update() {
            this.x -= gameSpeed;
        }
    }
    
    // Создаем фон
    const background = new Background();
    const clouds = [];
    
    // Функция для генерации облаков
    function generateClouds() {
        if (gameFrame % 200 === 0) {
            clouds.push(new Cloud());
        }
    }
    
    // Функция для генерации препятствий
    function generateObstacles() {
        if (gameFrame % 100 === 0) {
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
        
        // Увеличиваем скорость игры каждые 500 очков
        gameSpeed = 5 + Math.floor(score / 500);
    }
    
    // Функция сброса игры
    function resetGame() {
        gameFrame = 0;
        score = 0;
        gameSpeed = 5;
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
        gradient.addColorStop(1, '#E0F7FA');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
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
        
        // Обновляем и рисуем фон
        background.update();
        background.draw();
        
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