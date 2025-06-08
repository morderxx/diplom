document.addEventListener('DOMContentLoaded', () => {
    // Элементы DOM
    const playBtn = document.getElementById('play-game');
    const gameModal = document.getElementById('game-modal');
    const closeBtn = document.querySelector('.close-game');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const scoreDisplay = document.getElementById('score-display');
    const speedDisplay = document.getElementById('speed-display');
    const gameOverScreen = document.getElementById('game-over');
    const finalScore = document.getElementById('final-score');
    const highScoreDisplay = document.getElementById('high-score');
    const restartBtn = document.getElementById('restart-btn');
    
    // Размеры canvas (очень широкий)
    const CANVAS_WIDTH = canvas.width = 1400;
    const CANVAS_HEIGHT = canvas.height = 500;
    
    // Игровые переменные
    let gameSpeed = 1; // Очень медленно в начале
    let gameFrame = 0;
    let score = 0;
    let highScore = localStorage.getItem('dinoHighScore') || 0;
    let gameRunning = false;
    let obstacles = [];
    let clouds = [];
    let mountains = [];
    
    // Анимационные состояния динозавра
    let dinoLegState = 0;
    let dinoLegTimer = 0;
    
    // Игрок
    const player = {
        x: 150, // Сдвигаем игрока правее для лучшего обзора
        y: CANVAS_HEIGHT - 180,
        width: 70,
        height: 100,
        gravity: 0.45,
        velocity: 0,
        jumpForce: 16,
        jumping: false,
        ducking: false,
        normalHeight: 100,
        duckHeight: 60,
        
        draw() {
            // Тело
            ctx.fillStyle = '#4CAF50';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            
            if (this.ducking) {
                // Тело при приседании
                ctx.fillRect(this.x, this.y + this.normalHeight - this.duckHeight, this.width, this.duckHeight);
                
                // Голова
                ctx.beginPath();
                ctx.arc(this.x + 50, this.y + this.normalHeight - this.duckHeight - 25, 30, 0, Math.PI * 2);
                ctx.fill();
                
                // Глаз
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 60, this.y + this.normalHeight - this.duckHeight - 30, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Улыбка
                ctx.strokeStyle = 'black';
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
                ctx.fillStyle = 'black';
                ctx.beginPath();
                ctx.arc(this.x + 60, this.y - 30, 8, 0, Math.PI * 2);
                ctx.fill();
                
                // Улыбка
                ctx.strokeStyle = 'black';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(this.x + 60, this.y - 25, 20, 0.2, Math.PI * 0.8);
                ctx.stroke();
                
                // Ноги (анимированные)
                ctx.fillStyle = '#3a8e4c';
                const legOffset = dinoLegState === 0 ? 0 : 10;
                
                // Передняя нога
                ctx.fillRect(this.x + 20, this.y + this.height, 15, 30);
                // Задняя нога
                ctx.fillRect(this.x + 45 + legOffset, this.y + this.height, 15, 30);
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
                if (dinoLegTimer > 10 - Math.min(8, gameSpeed)) {
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
        },
        
        jump() {
            if (!this.jumping && !this.ducking) {
                this.velocity = -this.jumpForce;
                this.jumping = true;
                dinoLegState = 0;
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
    
    // Класс для гор (параллакс)
    class Mountain {
        constructor(height, y, color, speed) {
            this.height = height;
            this.y = y;
            this.color = color;
            this.speed = speed;
        }
        
        draw() {
            ctx.fillStyle = this.color;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            
            // Рисуем несколько горных пиков
            const peakCount = 8;
            const peakWidth = CANVAS_WIDTH / peakCount;
            
            for (let i = -1; i < peakCount + 1; i++) {
                const peakX = i * peakWidth + (gameFrame * this.speed) % peakWidth;
                ctx.beginPath();
                ctx.moveTo(peakX, this.y + this.height);
                ctx.lineTo(peakX + peakWidth/2, this.y);
                ctx.lineTo(peakX + peakWidth, this.y + this.height);
                ctx.fill();
            }
            
            ctx.shadowBlur = 0;
        }
    }
    
    // Класс для земли
    class Ground {
        constructor() {
            this.x = 0;
            this.width = CANVAS_WIDTH;
            this.height = 50;
            this.y = CANVAS_HEIGHT - this.height;
        }
        
        draw() {
            // Трава
            ctx.fillStyle = '#2E8B57';
            ctx.fillRect(this.x, this.y, this.width, 10);
            
            // Земля
            ctx.fillStyle = '#8B4513';
            ctx.fillRect(this.x, this.y + 10, this.width, this.height - 10);
            
            // Детали травы
            ctx.fillStyle = '#3CB371';
            for (let i = 0; i < this.width; i += 30) {
                ctx.beginPath();
                ctx.moveTo(i, this.y);
                ctx.lineTo(i + 10, this.y - 8);
                ctx.lineTo(i + 20, this.y);
                ctx.fill();
            }
            
            // Текстура земли
            ctx.fillStyle = '#A0522D';
            for (let i = 0; i < this.width; i += 40) {
                ctx.fillRect(i, this.y + 15, 25, 5);
            }
        }
        
        update() {
            this.x = gameFrame * gameSpeed % 40;
        }
    }
    
    // Класс для облаков
    class Cloud {
        constructor() {
            this.width = 120 + Math.random() * 80;
            this.height = 40 + Math.random() * 30;
            this.x = CANVAS_WIDTH + Math.random() * 500;
            this.y = 50 + Math.random() * 150;
            this.speed = 0.2 + Math.random() * 0.3;
            this.opacity = 0.8 + Math.random() * 0.2;
        }
        
        draw() {
            ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity})`;
            ctx.shadowColor = 'rgba(0, 0, 0, 0.1)';
            ctx.shadowBlur = 15;
            ctx.shadowOffsetX = 5;
            ctx.shadowOffsetY = 5;
            
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.width/4, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/3, this.y - this.height/3, this.width/5, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/2, this.y, this.width/4, 0, Math.PI * 2);
            ctx.arc(this.x + this.width/1.8, this.y + this.height/4, this.width/6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }
        
        update() {
            this.x -= this.speed;
        }
    }
    
    // Класс для кактусов
    class Cactus {
        constructor() {
            this.width = 40;
            this.height = 80 + Math.random() * 60;
            this.x = CANVAS_WIDTH;
            this.y = CANVAS_HEIGHT - this.height - 50;
            this.type = Math.floor(Math.random() * 3); // 3 разных типа кактусов
        }
        
        draw() {
            ctx.fillStyle = '#2E8B57';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            
            // Основной стебель
            ctx.fillRect(this.x, this.y, this.width, this.height);
            
            // Детали в зависимости от типа
            if (this.type === 0) {
                // Один большой отросток вправо
                ctx.fillRect(this.x + this.width - 10, this.y + 20, 30, 15);
            } else if (this.type === 1) {
                // Два маленьких отростка
                ctx.fillRect(this.x - 15, this.y + 40, 15, 10);
                ctx.fillRect(this.x + this.width, this.y + 60, 15, 10);
            } else {
                // Три отростка в разные стороны
                ctx.fillRect(this.x - 10, this.y + 30, 10, 12);
                ctx.fillRect(this.x + this.width, this.y + 50, 15, 10);
                ctx.fillRect(this.x + this.width - 5, this.y + 20, 10, 15);
            }
            
            // Колючки
            ctx.fillStyle = '#3CB371';
            for (let i = 0; i < this.height; i += 20) {
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + i);
                ctx.lineTo(this.x - 12, this.y + i + 5);
                ctx.lineTo(this.x, this.y + i + 10);
                ctx.fill();
                
                ctx.beginPath();
                ctx.moveTo(this.x + this.width, this.y + i);
                ctx.lineTo(this.x + this.width + 12, this.y + i + 5);
                ctx.lineTo(this.x + this.width, this.y + i + 10);
                ctx.fill();
            }
            
            ctx.shadowBlur = 0;
        }
        
        update() {
            this.x -= gameSpeed;
        }
    }
    
    // Класс для птиц (птеродактилей)
    class Bird {
        constructor() {
            this.width = 60;
            this.height = 40;
            this.x = CANVAS_WIDTH;
            this.y = CANVAS_HEIGHT - 250 - Math.random() * 150;
            this.wingState = 0;
            this.wingTimer = 0;
        }
        
        draw() {
            // Тело
            ctx.fillStyle = '#9370DB';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            ctx.shadowBlur = 5;
            ctx.shadowOffsetX = 3;
            ctx.shadowOffsetY = 3;
            
            ctx.beginPath();
            ctx.ellipse(this.x + 25, this.y + 20, 25, 15, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Крылья
            const wingYOffset = this.wingState === 0 ? 0 : 15;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + 20);
            ctx.quadraticCurveTo(
                this.x - 30, 
                this.y + 20 - wingYOffset, 
                this.x, 
                this.y + 20
            );
            ctx.fill();
            
            // Голова
            ctx.beginPath();
            ctx.arc(this.x + 40, this.y + 15, 15, 0, Math.PI * 2);
            ctx.fill();
            
            // Глаз
            ctx.fillStyle = 'white';
            ctx.beginPath();
            ctx.arc(this.x + 45, this.y + 12, 6, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = 'black';
            ctx.beginPath();
            ctx.arc(this.x + 45, this.y + 12, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Клюв
            ctx.fillStyle = '#FF8C00';
            ctx.beginPath();
            ctx.moveTo(this.x + 50, this.y + 15);
            ctx.lineTo(this.x + 70, this.y + 15);
            ctx.lineTo(this.x + 50, this.y + 22);
            ctx.fill();
            
            ctx.shadowBlur = 0;
        }
        
        update() {
            this.x -= gameSpeed;
            
            // Анимация крыльев
            this.wingTimer++;
            if (this.wingTimer > 7) {
                this.wingTimer = 0;
                this.wingState = this.wingState === 0 ? 1 : 0;
            }
        }
    }
    
    // Инициализация фона
    function initEnvironment() {
        // Горы (3 слоя с параллаксом)
        mountains = [
            new Mountain(120, 300, 'rgba(70, 40, 30, 0.6)', 0.1),
            new Mountain(150, 350, 'rgba(90, 50, 40, 0.7)', 0.3),
            new Mountain(180, 380, 'rgba(110, 60, 50, 0.8)', 0.5)
        ];
        
        // Земля
        ground = new Ground();
        
        // Начальные облака
        for (let i = 0; i < 8; i++) {
            clouds.push(new Cloud());
            clouds[i].x = Math.random() * CANVAS_WIDTH * 1.5;
        }
    }
    
    // Генерация препятствий
    function generateObstacles() {
        if (gameFrame % Math.floor(200 / gameSpeed) === 0) {
            if (Math.random() > 0.4) {
                obstacles.push(new Cactus());
            } else {
                obstacles.push(new Bird());
            }
        }
    }
    
    // Проверка коллизий
    function checkCollision() {
        for (let obstacle of obstacles) {
            const playerRect = {
                x: player.x + 10,
                y: player.y + 5,
                width: player.width - 20,
                height: player.height - 10
            };
            
            let obstacleRect;
            
            if (obstacle instanceof Cactus) {
                obstacleRect = {
                    x: obstacle.x + 5,
                    y: obstacle.y + 5,
                    width: obstacle.width - 10,
                    height: obstacle.height - 10
                };
            } else {
                obstacleRect = {
                    x: obstacle.x + 10,
                    y: obstacle.y + 5,
                    width: obstacle.width - 20,
                    height: obstacle.height - 10
                };
            }
            
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
    
    // Обновление счета
    function updateScore() {
        score = Math.floor(gameFrame / 5);
        scoreDisplay.textContent = `Счет: ${score}`;
        
        // Очень плавное увеличение скорости
        gameSpeed = 1 + score / 1000;
        if (gameSpeed > 8) gameSpeed = 8;
        
        // Отображение скорости
        speedDisplay.textContent = `Скорость: ${gameSpeed.toFixed(1)}x`;
    }
    
    // Сброс игры
    function resetGame() {
        gameFrame = 0;
        score = 0;
        gameSpeed = 1;
        obstacles = [];
        clouds = [];
        player.y = CANVAS_HEIGHT - player.normalHeight;
        player.velocity = 0;
        player.jumping = false;
        player.ducking = false;
        player.height = player.normalHeight;
        gameRunning = true;
        gameOverScreen.classList.add('hidden');
        
        initEnvironment();
    }
    
    // Игровой цикл
    function animate() {
        if (!gameRunning) return;
        
        ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Небо
        const gradient = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        gradient.addColorStop(0, '#64b3f4');
        gradient.addColorStop(0.5, '#c2e9fb');
        gradient.addColorStop(1, '#64b3f4');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        // Солнце
        ctx.fillStyle = '#FFDB58';
        ctx.beginPath();
        ctx.arc(CANVAS_WIDTH - 100, 80, 50, 0, Math.PI * 2);
        ctx.fill();
        
        // Рисуем горы
        mountains.forEach(mountain => mountain.draw());
        
        // Обновляем и рисуем облака
        for (let i = clouds.length - 1; i >= 0; i--) {
            clouds[i].update();
            clouds[i].draw();
            
            // Удаляем облака за пределами экрана и добавляем новые
            if (clouds[i].x < -clouds[i].width * 2) {
                clouds.splice(i, 1);
                clouds.push(new Cloud());
                clouds[clouds.length - 1].x = CANVAS_WIDTH + 200;
            }
        }
        
        // Рисуем землю
        ground.update();
        ground.draw();
        
        // Генерируем препятствия
        generateObstacles();
        
        // Обновляем и рисуем препятствия
        for (let i = obstacles.length - 1; i >= 0; i--) {
            obstacles[i].update();
            obstacles[i].draw();
            
            // Удаляем препятствия за пределами экрана
            if (obstacles[i].x < -obstacles[i].width * 2) {
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
    
    // Управление
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
    
    // Мобильное управление
    canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        if (e.touches[0].clientY < window.innerHeight / 2) {
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
