  // Константы
        const SCREEN_WIDTH = 1000;
        const SCREEN_HEIGHT = 600;
        const GROUND_HEIGHT = 50;
        const GRAVITY = 0.25;
        const JUMP_FORCE = -10; // СТРОКА ОТВЕЧАЮЩАЯ ЗА ВЫСОТУ ПРЫЖКА
        const BASE_GAME_SPEED = 1.5;
        const FPS = 120;
        const DISTANCE_FOR_SPEED_INCREASE = 100;
        const MIN_DISTANCE_BETWEEN_OBSTACLES = 400;

        // Цвета
        const WHITE = '#FFFFFF';
        const BLACK = '#000000';
        const PURPLE = '#9c27b0';
        const MOON_GRAY = '#b0b0b0';
        const DRAGON_GREEN = '#4caf50';
        const TORCH_YELLOW = '#ff9800';

        // Получаем canvas и контекст
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');

        // Класс Динозаврик (инопланетянин)
        class Dinosaur {
            constructor() {
                this.width = 50;
                this.height = 70;
                this.x = 80;
                this.y = SCREEN_HEIGHT - GROUND_HEIGHT - this.height;
                this.vel_y = 0;
                this.jumping = false;
                this.ducking = false;
                this.animation_count = 0;
                this.color = PURPLE; // Фиолетовый цвет
                this.eye_color = '#00ff00'; // Зеленые глаза
                this.eye_radius = 5;
                this.eye_pos = {x: this.x + 35, y: this.y + 20};
                this.score = 0;
                this.jump_buffer = 0;
                this.jump_progress = 0;
            }

            jump() {
                if (!this.jumping) {
                    this.vel_y = JUMP_FORCE;
                    this.jumping = true;
                    this.jump_progress = 0;
                } else {
                    this.jump_buffer = 5;
                }
            }

            duck() {
                if (!this.jumping) {
                    this.ducking = true;
                    this.height = 40;
                    this.y = SCREEN_HEIGHT - GROUND_HEIGHT - this.height;
                }
            }

            stand() {
                this.ducking = false;
                this.height = 70;
                this.y = SCREEN_HEIGHT - GROUND_HEIGHT - this.height;
            }

            update() {
                if (this.jumping && this.jump_progress < 10) {
                    this.vel_y += JUMP_FORCE * 0.05;
                    this.jump_progress++;
                }
                
                this.vel_y += GRAVITY;
                this.y += this.vel_y;

                if (this.y >= SCREEN_HEIGHT - GROUND_HEIGHT - this.height) {
                    this.y = SCREEN_HEIGHT - GROUND_HEIGHT - this.height;
                    this.jumping = false;
                    this.vel_y = 0;

                    if (this.jump_buffer > 0) {
                        this.vel_y = JUMP_FORCE;
                        this.jumping = true;
                        this.jump_progress = 0;
                        this.jump_buffer = 0;
                    }
                }

                if (this.jump_buffer > 0) {
                    this.jump_buffer -= 1;
                }

                this.eye_pos = {x: this.x + 35, y: this.y + 20};
                this.animation_count = (this.animation_count + 1) % 20;
            }

            draw() {
                // Тело инопланетянина
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.roundRect(this.x, this.y, this.width, this.height, 8);
                ctx.fill();

                // Ноги
                const leg_height = 15;
                const leg_width = 10;
                const leg_offset = this.animation_count < 10 ? 5 : -5;

                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.roundRect(this.x + 10, this.y + this.height, leg_width, leg_height + leg_offset, 3);
                ctx.fill();

                ctx.beginPath();
                ctx.roundRect(this.x + 30, this.y + this.height, leg_width, leg_height - leg_offset, 3);
                ctx.fill();

                // Глаз
                ctx.fillStyle = WHITE;
                ctx.beginPath();
                ctx.arc(this.eye_pos.x, this.eye_pos.y, this.eye_radius + 2, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = this.eye_color;
                ctx.beginPath();
                ctx.arc(this.eye_pos.x, this.eye_pos.y, this.eye_radius, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = BLACK;
                ctx.beginPath();
                ctx.arc(this.eye_pos.x, this.eye_pos.y, this.eye_radius - 2, 0, Math.PI * 2);
                ctx.fill();

                // Антенна
                ctx.strokeStyle = '#e91e63';
                ctx.lineWidth = 3;
                ctx.beginPath();
                ctx.moveTo(this.x + 35, this.y - 5);
                ctx.lineTo(this.x + 35, this.y - 20);
                ctx.stroke();

                ctx.fillStyle = '#ffeb3b';
                ctx.beginPath();
                ctx.arc(this.x + 35, this.y - 20, 5, 0, Math.PI * 2);
                ctx.fill();
            }

            get_rect() {
                return {
                    x: this.x + 5,
                    y: this.y,
                    width: this.width - 10,
                    height: this.height
                };
            }
        }

        // Класс Факел (вместо кактуса)
        class Torch {
            constructor(x) {
                this.width = 25;
                this.height = 70;
                this.x = x;
                this.y = SCREEN_HEIGHT - GROUND_HEIGHT - this.height;
                this.color = '#795548';
                this.passed = false;
                this.flame_height = 30;
                this.flame_variation = 0;
            }

            update(speed) {
                this.x -= speed;
                this.flame_variation = (this.flame_variation + 0.1) % (Math.PI * 2);
            }

            draw() {
                // Деревянная ручка
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.roundRect(this.x + 8, this.y + 20, 9, this.height - 20, 3);
                ctx.fill();

                // Огонь
                const flameHeight = this.flame_height + Math.sin(this.flame_variation) * 5;
                const gradient = ctx.createRadialGradient(
                    this.x + 12.5, this.y, 5,
                    this.x + 12.5, this.y, flameHeight
                );
                gradient.addColorStop(0, '#ffeb3b');
                gradient.addColorStop(0.5, '#ff9800');
                gradient.addColorStop(1, '#f44336');
                
                ctx.fillStyle = gradient;
                ctx.beginPath();
                ctx.moveTo(this.x, this.y + 20);
                ctx.bezierCurveTo(
                    this.x - 15, this.y - flameHeight/2,
                    this.x + 30, this.y - flameHeight/2,
                    this.x + 25, this.y + 20
                );
                ctx.closePath();
                ctx.fill();

                // Искры
                ctx.fillStyle = '#ffeb3b';
                for (let i = 0; i < 5; i++) {
                    const sparkX = this.x + 5 + Math.random() * 15;
                    const sparkY = this.y - 10 - Math.random() * 20;
                    ctx.beginPath();
                    ctx.arc(sparkX, sparkY, 1 + Math.random() * 2, 0, Math.PI * 2);
                    ctx.fill();
                }
            }

            get_rect() {
                return {
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height
                };
            }
        }

        // Класс Дракон (вместо птички)
        class Dragon {
            constructor(x) {
                this.width = 60;
                this.height = 40;
                this.x = x;
                this.y = SCREEN_HEIGHT - GROUND_HEIGHT - Math.floor(Math.random() * 111) - this.height;
                this.color = DRAGON_GREEN;
                this.passed = false;
                this.wing_up = true;
                this.animation_count = 0;
            }

            update(speed) {
                this.x -= speed;
                this.animation_count++;
                if (this.animation_count >= 10) {
                    this.animation_count = 0;
                    this.wing_up = !this.wing_up;
                }
            }

            draw() {
                // Тело дракона
                ctx.fillStyle = this.color;
                ctx.beginPath();
                ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/2, 0, 0, Math.PI * 2);
                ctx.fill();

                // Крылья
                ctx.fillStyle = '#2e7d32';
                ctx.beginPath();
                const wing_y_offset = this.wing_up ? -15 : 5;
                ctx.moveTo(this.x + 15, this.y + this.height / 2);
                ctx.bezierCurveTo(
                    this.x + 30, this.y + this.height / 2 + wing_y_offset,
                    this.x + 50, this.y + this.height / 2 + wing_y_offset,
                    this.x + 40, this.y + this.height / 2
                );
                ctx.fill();

                // Глаза
                ctx.fillStyle = '#ff1744';
                ctx.beginPath();
                ctx.arc(this.x + 45, this.y + 15, 5, 0, Math.PI * 2);
                ctx.fill();

                // Рога
                ctx.fillStyle = '#ff9800';
                ctx.beginPath();
                ctx.moveTo(this.x + 30, this.y + 5);
                ctx.lineTo(this.x + 25, this.y - 10);
                ctx.lineTo(this.x + 30, this.y);
                ctx.closePath();
                ctx.fill();

                ctx.beginPath();
                ctx.moveTo(this.x + 40, this.y + 5);
                ctx.lineTo(this.x + 45, this.y - 10);
                ctx.lineTo(this.x + 40, this.y);
                ctx.closePath();
                ctx.fill();

                // Огонь из пасти
                const flameGradient = ctx.createLinearGradient(this.x, this.y, this.x + 30, this.y);
                flameGradient.addColorStop(0, '#ff5722');
                flameGradient.addColorStop(1, '#ffeb3b');
                
                ctx.fillStyle = flameGradient;
                ctx.beginPath();
                ctx.moveTo(this.x + 10, this.y + 25);
                ctx.lineTo(this.x - 20, this.y + 15);
                ctx.lineTo(this.x - 20, this.y + 35);
                ctx.lineTo(this.x + 10, this.y + 30);
                ctx.closePath();
                ctx.fill();
            }

            get_rect() {
                return {
                    x: this.x,
                    y: this.y,
                    width: this.width,
                    height: this.height
                };
            }
        }

        // Класс Звезда
        class Star {
            constructor() {
                this.x = Math.random() * SCREEN_WIDTH;
                this.y = Math.random() * (SCREEN_HEIGHT - GROUND_HEIGHT);
                this.size = Math.random() * 2 + 1;
                this.brightness = Math.random() * 0.8 + 0.2;
                this.twinkleSpeed = Math.random() * 0.05;
                this.twinklePhase = Math.random() * Math.PI * 2;
            }
            
            update() {
                this.twinklePhase += this.twinkleSpeed;
                this.currentBrightness = this.brightness * (0.7 + 0.3 * Math.sin(this.twinklePhase));
            }
            
            draw() {
                ctx.fillStyle = `rgba(255, 255, 255, ${this.currentBrightness})`;
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Класс Кратер (для лунной поверхности)
        class Crater {
            constructor(x, size) {
                this.x = x;
                this.y = SCREEN_HEIGHT - GROUND_HEIGHT + 10;
                this.size = size;
            }
            
            draw() {
                ctx.fillStyle = '#8d8d8d';
                ctx.beginPath();
                ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.fillStyle = '#a0a0a0';
                ctx.beginPath();
                ctx.arc(this.x - this.size/3, this.y - this.size/4, this.size/2, 0, Math.PI * 2);
                ctx.fill();
            }
        }

        // Класс Игра
        class Game {
            constructor() {
                this.dino = new Dinosaur();
                this.obstacles = [];
                this.stars = [];
                this.craters = [];
                this.game_speed = BASE_GAME_SPEED;
                this.score = 0;
                this.high_score = 0;
                this.game_over = false;
                this.spawn_timer = 0;
                this.ground_offset = 0;
                this.bg_offset = 0;
                this.distance = 0;
                this.last_speed_increase = 0;
                this.last_obstacle_x = SCREEN_WIDTH;

                // Создаем звезды
                for (let i = 0; i < 200; i++) {
                    this.stars.push(new Star());
                }
                
                // Создаем кратеры
                for (let i = 0; i < 20; i++) {
                    this.craters.push(new Crater(
                        Math.random() * SCREEN_WIDTH,
                        Math.random() * 10 + 5
                    ));
                }

                // Обработчики событий
                document.addEventListener('keydown', (e) => this.handleKeyDown(e));
                document.addEventListener('keyup', (e) => this.handleKeyUp(e));
            }

            handleKeyDown(e) {
                if (e.code === 'Space' || e.key === 'ArrowUp') {
                    if (this.game_over) {
                        this.reset();
                    } else {
                        this.dino.jump();
                    }
                } else if (e.key === 'ArrowDown') {
                    this.dino.duck();
                }
            }

            handleKeyUp(e) {
                if (e.key === 'ArrowDown') {
                    this.dino.stand();
                }
            }

            update() {
                if (!this.game_over) {
                    this.distance += this.game_speed / FPS * 0.25;
                    
                    if (this.distance - this.last_speed_increase >= DISTANCE_FOR_SPEED_INCREASE) {
                        this.game_speed += 0.1;
                        this.last_speed_increase = this.distance;
                    }

                    this.dino.update();

                    // Обновляем препятствия
                    for (let i = this.obstacles.length - 1; i >= 0; i--) {
                        const obstacle = this.obstacles[i];
                        obstacle.update(this.game_speed);

                        // Проверка коллизий
                        const dinoRect = this.dino.get_rect();
                        const obsRect = obstacle.get_rect();

                        if (this.rectCollision(dinoRect, obsRect)) {
                            this.game_over = true;
                            if (this.score > this.high_score) {
                                this.high_score = this.score;
                            }
                        }

                        if (obstacle.x < -obstacle.width) {
                            this.obstacles.splice(i, 1);
                        } else if (!obstacle.passed && obstacle.x < this.dino.x) {
                            obstacle.passed = true;
                            this.score++;
                        }
                    }

                    // Обновляем звезды
                    this.stars.forEach(star => star.update());

                    // Создание препятствий
                    this.spawn_timer++;
                    
                    if (this.spawn_timer >= Math.floor(Math.random() * 71) + 150) {
                        const canSpawn = this.obstacles.length === 0 || 
                                        (SCREEN_WIDTH - this.last_obstacle_x) >= MIN_DISTANCE_BETWEEN_OBSTACLES;
                        
                        if (canSpawn) {
                            if (Math.random() < 0.15) {
                                const dragon = new Dragon(SCREEN_WIDTH);
                                this.obstacles.push(dragon);
                                this.last_obstacle_x = dragon.x;
                            } else {
                                const torch = new Torch(SCREEN_WIDTH);
                                this.obstacles.push(torch);
                                this.last_obstacle_x = torch.x;
                            }
                            this.spawn_timer = 0;
                        }
                    }

                    // Обновление земли и фона
                    this.ground_offset = (this.ground_offset - this.game_speed) % 20;
                }
            }

            draw() {
                // Очистка экрана
                ctx.clearRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

                // Черный фон
                ctx.fillStyle = '#0a0e2a';
                ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

                // Звезды
                this.stars.forEach(star => star.draw());

                // Луна
                ctx.fillStyle = '#e0e0e0';
                ctx.beginPath();
                ctx.arc(700, 80, 40, 0, Math.PI * 2);
                ctx.fill();
                
                // Кратеры на луне
                ctx.fillStyle = '#b0b0b0';
                ctx.beginPath();
                ctx.arc(680, 70, 8, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(720, 90, 5, 0, Math.PI * 2);
                ctx.fill();
                
                ctx.beginPath();
                ctx.arc(690, 100, 6, 0, Math.PI * 2);
                ctx.fill();

                // Лунная поверхность (земля)
                ctx.fillStyle = MOON_GRAY;
                ctx.fillRect(0, SCREEN_HEIGHT - GROUND_HEIGHT, SCREEN_WIDTH, GROUND_HEIGHT);

                // Кратеры на поверхности
                this.craters.forEach(crater => crater.draw());

                // Текстура поверхности
                ctx.strokeStyle = '#8d8d8d';
                ctx.lineWidth = 2;
                for (let i = 0; i <= SCREEN_WIDTH / 20; i++) {
                    ctx.beginPath();
                    ctx.moveTo(i * 20 + this.ground_offset, SCREEN_HEIGHT - GROUND_HEIGHT);
                    ctx.lineTo(i * 20 + this.ground_offset, SCREEN_HEIGHT);
                    ctx.stroke();
                }

                // Препятствия
                this.obstacles.forEach(obs => obs.draw());

                // Динозаврик (инопланетянин)
                this.dino.draw();

                // Панель информации
                ctx.fillStyle = 'rgba(50,50,50,0.6)';
                this.roundRect(ctx, SCREEN_WIDTH - 170, 10, 160, 110, 10);
                ctx.fill();

                ctx.strokeStyle = '#9c27b0';
                ctx.lineWidth = 2;
                this.roundRect(ctx, SCREEN_WIDTH - 170, 10, 160, 110, 10);
                ctx.stroke();

                // Текст
                ctx.font = '20px Arial';
                ctx.fillStyle = '#e91e63';
                ctx.fillText(`Очки: ${this.score}`, SCREEN_WIDTH - 160, 40);

                ctx.fillText(`${Math.floor(this.distance)} м`, SCREEN_WIDTH - 160, 80);

                ctx.font = '16px Arial';
                ctx.fillStyle = WHITE;
                ctx.fillText(`Скорость: ${this.game_speed.toFixed(1)}`, SCREEN_WIDTH - 160, 110);

                // Инструкции в начале
                if (this.score === 0 && !this.game_over) {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    this.roundRect(ctx, SCREEN_WIDTH/2 - 200, 80, 400, 80, 10);
                    ctx.fill();

                    ctx.strokeStyle = '#e91e63';
                    ctx.lineWidth = 2;
                    this.roundRect(ctx, SCREEN_WIDTH/2 - 200, 80, 400, 80, 10);
                    ctx.stroke();

                    ctx.font = '16px Arial';
                    ctx.fillStyle = WHITE;
                    ctx.textAlign = 'center';
                    ctx.fillText('ПРОБЕЛ - прыжок', SCREEN_WIDTH/2, 110);
                    ctx.fillText('СТРЕЛКА ВНИЗ - пригнуться', SCREEN_WIDTH/2, 140);
                    ctx.textAlign = 'left';
                }

                // Конец игры
                if (this.game_over) {
                    ctx.fillStyle = 'rgba(0,0,0,0.6)';
                    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT);

                    ctx.fillStyle = 'rgba(40,20,50,0.86)';
                    this.roundRect(ctx, SCREEN_WIDTH/2 - 200, 100, 400, 200, 20);
                    ctx.fill();

                    ctx.strokeStyle = '#9c27b0';
                    ctx.lineWidth = 3;
                    this.roundRect(ctx, SCREEN_WIDTH/2 - 200, 100, 400, 200, 20);
                    ctx.stroke();

                    ctx.font = '30px Arial';
                    ctx.fillStyle = '#e91e63';
                    ctx.textAlign = 'center';
                    ctx.fillText('ИГРА ОКОНЧЕНА', SCREEN_WIDTH/2, 150);

                    ctx.font = '20px Arial';
                    ctx.fillStyle = WHITE;
                    ctx.fillText('ПРОБЕЛ - Новая игра', SCREEN_WIDTH/2, 200);
                    ctx.fillText(`Очки: ${this.score}`, SCREEN_WIDTH/2, 250);
                    ctx.textAlign = 'left';
                }
            }

            rectCollision(rect1, rect2) {
                return rect1.x < rect2.x + rect2.width &&
                       rect1.x + rect1.width > rect2.x &&
                       rect1.y < rect2.y + rect2.height &&
                       rect1.y + rect1.height > rect2.y;
            }

            reset() {
                this.dino = new Dinosaur();
                this.obstacles = [];
                this.game_speed = BASE_GAME_SPEED;
                this.score = 0;
                this.game_over = false;
                this.spawn_timer = 0;
                this.ground_offset = 0;
                this.bg_offset = 0;
                this.distance = 0;
                this.last_speed_increase = 0;
                this.last_obstacle_x = SCREEN_WIDTH;
            }

            roundRect(ctx, x, y, width, height, radius) {
                if (width < 2 * radius) radius = width / 2;
                if (height < 2 * radius) radius = height / 2;
                ctx.beginPath();
                ctx.moveTo(x + radius, y);
                ctx.arcTo(x + width, y, x + width, y + height, radius);
                ctx.arcTo(x + width, y + height, x, y + height, radius);
                ctx.arcTo(x, y + height, x, y, radius);
                ctx.arcTo(x, y, x + width, y, radius);
                ctx.closePath();
            }
        }

        // Добавляем поддержку roundRect для CanvasRenderingContext2D
        CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
            if (width < 2 * radius) radius = width / 2;
            if (height < 2 * radius) radius = height / 2;
            this.beginPath();
            this.moveTo(x + radius, y);
            this.arcTo(x + width, y, x + width, y + height, radius);
            this.arcTo(x + width, y + height, x, y + height, radius);
            this.arcTo(x, y + height, x, y, radius);
            this.arcTo(x, y, x + width, y, radius);
            this.closePath();
            return this;
        };

        // Запуск игры
        const game = new Game();

        function gameLoop() {
            game.update();
            game.draw();
            requestAnimationFrame(gameLoop);
        }

        gameLoop();
