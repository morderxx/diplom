class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 3;
        this.speedX = Math.random() * 10 - 5;
        this.speedY = Math.random() * 10 - 5;
        this.life = Math.random() * 20 + 30;
        this.glowSize = Math.random() * 10 + 5;
        this.glowIntensity = Math.random() * 0.5 + 0.5;
        this.alpha = 255;
    }

    update() {
        this.x += this.speedX;
        this.y += this.speedY;
        this.life--;
        this.size = Math.max(0, this.size - 0.1);
        this.glowSize = Math.max(0, this.glowSize - 0.2);
        this.alpha = 255 * (this.life / 50);
        return this.life > 0;
    }

    draw(ctx) {
        // Рисуем свечение
        ctx.globalAlpha = this.glowIntensity * (this.life / 50);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.glowSize, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${0.4 * (this.life / 50)})`;
        ctx.fill();
        
        // Рисуем саму частицу
        ctx.globalAlpha = this.alpha / 255;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        ctx.fill();
        
        ctx.globalAlpha = 1;
    }
}

class Tile {
    static COLORS = [
        [255, 90, 90],    // Ярко-красный
        [90, 255, 120],   // Ярко-зеленый
        [100, 180, 255],  // Ярко-синий
        [255, 240, 90],   // Ярко-желтый
        [240, 100, 240],  // Ярко-пурпурный
        [90, 240, 240],   // Ярко-голубой
    ];
    
    static SHAPES = ["circle", "diamond", "hexagon", "star", "square", "triangle"];

    constructor(row, col, tileType) {
        this.row = row;
        this.col = col;
        this.type = tileType;
        this.color = Tile.COLORS[tileType];
        this.glowColor = [
            Math.min(255, this.color[0] + 70),
            Math.min(255, this.color[1] + 70),
            Math.min(255, this.color[2] + 70)
        ];
        this.shape = Tile.SHAPES[tileType];
        this.selected = false;
        this.highlighted = false;
        this.x = 0;
        this.y = 0;
        this.targetX = 0;
        this.targetY = 0;
        this.animating = false;
        this.dragging = false;
        this.dragOffsetX = 0;
        this.dragOffsetY = 0;
        this.scale = 1.0;
        this.pulseDirection = 1;
        this.rotation = 0;
        this.glowRadius = 0;
        this.glowIntensity = 0;
    }

    draw(ctx, tileSize, offsetX, offsetY) {
        // Расчет позиции
        this.targetX = offsetX + this.col * tileSize;
        this.targetY = offsetY + this.row * tileSize;
        
        // Анимация перемещения
        if (this.animating && !this.dragging) {
            const speed = 0.2;
            const dx = this.targetX - this.x;
            const dy = this.targetY - this.y;
            
            if (Math.abs(dx) < 1 && Math.abs(dy) < 1) {
                this.x = this.targetX;
                this.y = this.targetY;
                this.animating = false;
            } else {
                this.x += dx * speed;
                this.y += dy * speed;
            }
        } else if (!this.dragging) {
            this.x = this.targetX;
            this.y = this.targetY;
        }
        
        // Пульсация для выделенных плиток
        if (this.highlighted) {
            this.scale += 0.03 * this.pulseDirection;
            if (this.scale > 1.15) {
                this.scale = 1.15;
                this.pulseDirection = -1;
            } else if (this.scale < 0.95) {
                this.scale = 0.95;
                this.pulseDirection = 1;
            }
        }
        
        // Анимация свечения при совпадении
        if (this.selected) {
            this.glowRadius += 2;
            this.glowIntensity = Math.max(0, 1.0 - this.glowRadius / 50);
            
            if (this.glowRadius > 50) {
                this.glowRadius = 0;
                this.glowIntensity = 1.0;
            }
        }
        
        // Позиция с учетом перетаскивания
        const drawX = this.dragging ? this.x + this.dragOffsetX : this.x;
        const drawY = this.dragging ? this.y + this.dragOffsetY : this.y;
        
        // Размер с учетом пульсации
        const size = tileSize * this.scale - 10;
        const halfSize = size / 2;
        const centerX = drawX + tileSize / 2;
        const centerY = drawY + tileSize / 2;
        
        // Рисуем свечение
        if (this.glowIntensity > 0) {
            ctx.globalAlpha = 0.8 * this.glowIntensity;
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.glowRadius, 0, Math.PI * 2);
            ctx.fillStyle = `rgb(${this.glowColor[0]}, ${this.glowColor[1]}, ${this.glowColor[2]})`;
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Рисуем тень
        ctx.globalAlpha = 0.7;
        ctx.beginPath();
        ctx.arc(centerX + 5, centerY + 5, halfSize + 2, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(20, 20, 20)";
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Поворот для анимации
        if (this.dragging) {
            this.rotation = (this.rotation + 5) % 360;
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(this.rotation * Math.PI / 180);
        }
        
        // Рисуем разные формы
        switch (this.shape) {
            case "circle":
                ctx.beginPath();
                ctx.arc(this.dragging ? 0 : centerX, this.dragging ? 0 : centerY, halfSize, 0, Math.PI * 2);
                ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
                ctx.fill();
                
                ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case "diamond":
                this.drawDiamond(ctx, centerX, centerY, halfSize);
                break;
                
            case "hexagon":
                this.drawHexagon(ctx, centerX, centerY, halfSize);
                break;
                
            case "star":
                this.drawStar(ctx, centerX, centerY, halfSize);
                break;
                
            case "square":
                ctx.beginPath();
                const squareSize = halfSize * 1.4;
                ctx.rect(
                    (this.dragging ? -squareSize : centerX - squareSize),
                    (this.dragging ? -squareSize : centerY - squareSize),
                    squareSize * 2,
                    squareSize * 2
                );
                ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
                ctx.fill();
                
                ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
                ctx.lineWidth = 3;
                ctx.stroke();
                break;
                
            case "triangle":
                this.drawTriangle(ctx, centerX, centerY, halfSize);
                break;
        }
        
        if (this.dragging) {
            ctx.restore();
        }
        
        // Выделение если выбрана
        if (this.selected) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, halfSize + 8, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        
        // Эффект подсветки
        if (this.highlighted) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, halfSize + 12, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 4;
            ctx.stroke();
        }
    }
    
    drawDiamond(ctx, cx, cy, size) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy);
        ctx.lineTo(cx, cy + size);
        ctx.lineTo(cx - size, cy);
        ctx.closePath();
        
        ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        ctx.fill();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    drawHexagon(ctx, cx, cy, size) {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = Math.PI/3 * i;
            const x = cx + size * Math.cos(angle);
            const y = cy + size * Math.sin(angle);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        
        ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        ctx.fill();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    drawStar(ctx, cx, cy, size) {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = Math.PI/5 * 4 * i - Math.PI/2;
            // Внешняя точка
            ctx.lineTo(
                cx + size * Math.cos(angle),
                cy + size * Math.sin(angle)
            );
            // Внутренняя точка
            ctx.lineTo(
                cx + size/2 * Math.cos(angle + Math.PI/5),
                cy + size/2 * Math.sin(angle + Math.PI/5)
            );
        }
        ctx.closePath();
        
        ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        ctx.fill();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
    }
    
    drawTriangle(ctx, cx, cy, size) {
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx + size, cy + size);
        ctx.lineTo(cx - size, cy + size);
        ctx.closePath();
        
        ctx.fillStyle = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        ctx.fill();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
    }
}

class Button {
    constructor(x, y, width, height, text, color = [100, 100, 200], hoverColor = [150, 150, 255], textColor = [255, 255, 255]) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.text = text;
        this.color = color;
        this.hoverColor = hoverColor;
        this.textColor = textColor;
        this.currentColor = color;
        this.hovered = false;
        this.shadowOffset = 5;
        this.glowIntensity = 0;
    }

    draw(ctx) {
        // Эффект наведения
        if (this.hovered) {
            this.glowIntensity = Math.min(1.0, this.glowIntensity + 0.1);
        } else {
            this.glowIntensity = Math.max(0.0, this.glowIntensity - 0.05);
        }
        
        // Тень кнопки
        ctx.globalAlpha = 0.6;
        ctx.fillStyle = "rgba(30, 30, 60)";
        ctx.beginPath();
        ctx.roundRect(
            this.x + this.shadowOffset,
            this.y + this.shadowOffset,
            this.width,
            this.height,
            15
        );
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Свечение при наведении
        if (this.glowIntensity > 0) {
            ctx.globalAlpha = 0.4 * this.glowIntensity;
            ctx.fillStyle = `rgb(${this.hoverColor[0]}, ${this.hoverColor[1]}, ${this.hoverColor[2]})`;
            ctx.beginPath();
            ctx.roundRect(
                this.x - 15,
                this.y - 15,
                this.width + 30,
                this.height + 30,
                15
            );
            ctx.fill();
            ctx.globalAlpha = 1;
        }
        
        // Градиент для кнопки
        const gradient = ctx.createLinearGradient(0, this.y, 0, this.y + this.height);
        const baseColor = this.hovered ? this.hoverColor : this.color;
        gradient.addColorStop(0, `rgba(${baseColor[0]}, ${baseColor[1]}, ${baseColor[2]}, 1)`);
        gradient.addColorStop(1, `rgba(${baseColor[0] * 0.6}, ${baseColor[1] * 0.6}, ${baseColor[2] * 0.6}, 1)`);
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 15);
        ctx.fill();
        
        // Рамка кнопки
        ctx.strokeStyle = "rgba(200, 200, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(this.x, this.y, this.width, this.height, 15);
        ctx.stroke();
        
        // Рисуем текст
        ctx.font = "42px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        
        // Тень текста
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillText(this.text, this.x + this.width/2 + 2, this.y + this.height/2 + 2);
        
        // Основной текст
        ctx.fillStyle = `rgb(${this.textColor[0]}, ${this.textColor[1]}, ${this.textColor[2]})`;
        ctx.fillText(this.text, this.x + this.width/2, this.y + this.height/2);
    }
    
    checkHover(x, y) {
        this.hovered = (
            x > this.x && 
            x < this.x + this.width && 
            y > this.y && 
            y < this.y + this.height
        );
        this.currentColor = this.hovered ? this.hoverColor : this.color;
        return this.hovered;
    }
    
    isClicked(x, y) {
        return this.hovered;
    }
}

class Match3Game {
    LEVELS = [
        {score: 500, boardSize: 6},
        {score: 1000, boardSize: 6},
        {score: 2000, boardSize: 7},
        {score: 3500, boardSize: 7},
        {score: 5000, boardSize: 8},
        {score: 7000, boardSize: 8},
        {score: 10000, boardSize: 8},
        {score: 14000, boardSize: 9},
        {score: 18000, boardSize: 9},
        {score: 25000, boardSize: 9},
    ];
    
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.resizeCanvas();
        this.tileSize = 55;
        this.boardSize = 6;
        this.offsetX = (this.width - this.boardSize * this.tileSize) / 2;
        this.offsetY = 150;
        
        this.board = [];
        this.selectedTile = null;
        this.draggingTile = null;
        this.dragStartCol = 0;
        this.dragStartRow = 0;
        this.score = 0;
        this.levelScore = 0;
        this.currentLevel = 0;
        this.combo = 0;
        this.comboTimer = 0;
        this.particles = [];
        this.explosions = [];
        this.gameState = "menu"; // menu, playing, level_complete, game_over
        
        // Кнопки меню
        this.menuButtons = [
            new Button(this.width/2 - 150, this.height/2 - 60, 300, 80, "НАЧАТЬ ИГРУ", 
                      [60, 140, 200], [100, 180, 255]),
            new Button(this.width/2 - 150, this.height/2 + 60, 300, 80, "ВЫХОД", 
                      [200, 80, 100], [255, 120, 120])
        ];
        
        // Кнопки завершения уровня
        this.levelCompleteButtons = [
            new Button(this.width/2 - 150, this.height/2, 300, 80, "СЛЕДУЮЩИЙ УРОВЕНЬ", 
                      [60, 180, 100], [100, 220, 150]),
            new Button(this.width/2 - 150, this.height/2 + 100, 300, 80, "В МЕНЮ", 
                      [180, 100, 200], [220, 140, 255])
        ];
        
        // Фоновые звезды
        this.stars = [];
        for (let i = 0; i < 100; i++) {
            this.stars.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                size: Math.random() * 2 + 0.5,
                brightness: Math.random() * 0.4 + 0.1,
                speed: Math.random() * 0.5 + 0.1,
                phase: Math.random() * Math.PI * 2
            });
        }
        
        // Инициализация игрового поля
        this.initializeBoard();
        
        // Обработчики событий
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('mouseout', this.handleMouseUp.bind(this));
        window.addEventListener('resize', this.resizeCanvas.bind(this));
    }
    
    resizeCanvas() {
        this.width = this.canvas.width = this.canvas.parentElement.clientWidth;
        this.height = this.canvas.height = this.canvas.parentElement.clientHeight;
        
        if (this.boardSize) {
            this.offsetX = (this.width - this.boardSize * this.tileSize) / 2;
        }
    }
    
    initializeBoard() {
        this.boardSize = this.LEVELS[this.currentLevel].boardSize;
        this.tileSize = Math.min(55, Math.floor(Math.min(this.width, this.height) * 0.9 / this.boardSize));
        this.offsetX = (this.width - this.boardSize * this.tileSize) / 2;
        
        // Создаем пустое поле
        this.board = Array(this.boardSize).fill().map(() => Array(this.boardSize).fill(null));
        
        // Заполняем поле плитками
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                this.createNewTile(row, col);
            }
        }
        
        // Убедимся, что на поле нет начальных совпадений
        while (this.findMatches()) {
            this.removeMatches();
            this.fillEmptySpaces();
        }
        
        // Проверяем, есть ли возможные ходы
        if (!this.hasPossibleMoves()) {
            this.initializeBoard();
        }
    }
    
    createNewTile(row, col) {
        // Выбираем тип плитки
        const tileType = Math.floor(Math.random() * Tile.COLORS.length);
        this.board[row][col] = new Tile(row, col, tileType);
        this.board[row][col].animating = true;
        this.board[row][col].y = -this.tileSize;
    }
    
    draw() {
        const ctx = this.ctx;
        
        // Очистка холста
        ctx.fillStyle = '#05000f';
        ctx.fillRect(0, 0, this.width, this.height);
        
        // Рисуем звезды
        const time = Date.now() * 0.001;
        for (const star of this.stars) {
            const twinkle = 0.7 + 0.3 * Math.sin(time * 0.5 + star.phase);
            const brightness = Math.floor(255 * star.brightness * twinkle);
            ctx.fillStyle = `rgb(${brightness}, ${brightness}, ${brightness})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Отрисовка взрывов
        for (const explosion of this.explosions) {
            const [x, y, radius, color] = explosion;
            for (let i = 0; i < 3; i++) {
                const r = radius + i * 5;
                const alpha = Math.max(0, 200 - i * 50) / 255;
                ctx.globalAlpha = alpha;
                ctx.fillStyle = `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
                ctx.beginPath();
                ctx.arc(x, y, r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
        
        // Отрисовка плиток
        if (this.gameState === "playing") {
            for (let row = 0; row < this.boardSize; row++) {
                for (let col = 0; col < this.boardSize; col++) {
                    if (this.board[row][col]) {
                        this.board[row][col].draw(ctx, this.tileSize, this.offsetX, this.offsetY);
                    }
                }
            }
        }
        
        // Отрисовка частиц
        for (const particle of this.particles) {
            particle.draw(ctx);
        }
        
        // Верхняя панель
        ctx.fillStyle = 'rgba(30, 25, 50, 0.85)';
        ctx.fillRect(0, 0, this.width, 140);
        
        ctx.strokeStyle = 'rgba(80, 70, 120, 0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, 140);
        ctx.lineTo(this.width, 140);
        ctx.stroke();
        
        // Заголовок
        ctx.font = 'bold 60px Arial';
        ctx.fillStyle = '#dcb4ff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('ТРИ В РЯД', this.width / 2, 20);
        
        // Отображение состояния игры
        if (this.gameState === "menu") {
            // Заголовок меню
            ctx.font = 'bold 60px Arial';
            ctx.fillStyle = '#dcb4ff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText('Главное меню', this.width / 2, 250);
            
            // Кнопки меню
            for (const button of this.menuButtons) {
                button.draw(ctx);
            }
        } else if (this.gameState === "playing") {
            // Игровая информация
            ctx.font = '36px Arial';
            ctx.textAlign = 'left';
            ctx.fillStyle = '#ffffc8';
            ctx.fillText(`ОЧКИ: ${this.score}`, 50, 80);
            
            ctx.textAlign = 'right';
            ctx.fillStyle = '#ffc864';
            ctx.fillText(`Уровень: ${this.currentLevel + 1}/10`, this.width - 50, 80);
            
            // Прогресс уровня
            const targetScore = this.LEVELS[this.currentLevel].score;
            const progress = Math.min(1.0, this.levelScore / targetScore);
            
            ctx.fillStyle = 'rgba(60, 60, 90)';
            ctx.beginPath();
            ctx.roundRect(50, 110, 200, 20, 10);
            ctx.fill();
            
            ctx.fillStyle = 'rgba(100, 200, 100)';
            ctx.beginPath();
            ctx.roundRect(50, 110, 200 * progress, 20, 10);
            ctx.fill();
            
            ctx.strokeStyle = 'rgba(80, 70, 120)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(50, 110, 200, 20, 10);
            ctx.stroke();
            
            // Отображение цели
            ctx.textAlign = 'left';
            ctx.fillStyle = '#c8c8ff';
            ctx.fillText(`Цель: ${this.levelScore}/${targetScore}`, 260, 110);
            
            // Отрисовка комбо
            if (this.combo > 1) {
                const comboAlpha = Math.min(255, this.comboTimer * 4) / 255;
                ctx.globalAlpha = comboAlpha;
                ctx.font = 'bold 72px Arial';
                ctx.fillStyle = '#ffdc64';
                ctx.textAlign = 'center';
                ctx.fillText(`x${this.combo} КОМБО!`, this.width / 2, 500);
                ctx.globalAlpha = 1;
            }
            
            // Отрисовка сетки
            ctx.strokeStyle = 'rgba(100, 100, 150, 0.6)';
            ctx.lineWidth = 2;
            
            // Вертикальные линии
            for (let i = 0; i <= this.boardSize; i++) {
                const x = this.offsetX + i * this.tileSize;
                ctx.beginPath();
                ctx.moveTo(x, this.offsetY);
                ctx.lineTo(x, this.offsetY + this.boardSize * this.tileSize);
                ctx.stroke();
            }
            
            // Горизонтальные линии
            for (let i = 0; i <= this.boardSize; i++) {
                const y = this.offsetY + i * this.tileSize;
                ctx.beginPath();
                ctx.moveTo(this.offsetX, y);
                ctx.lineTo(this.offsetX + this.boardSize * this.tileSize, y);
                ctx.stroke();
            }
        } else if (this.gameState === "level_complete") {
            // Сообщение о завершении уровня
            ctx.font = 'bold 60px Arial';
            ctx.fillStyle = '#dcb4ff';
            ctx.textAlign = 'center';
            ctx.fillText(`Уровень ${this.currentLevel + 1} пройден!`, this.width / 2, 250);
            
            ctx.font = '36px Arial';
            ctx.fillStyle = '#ffffc8';
            ctx.fillText(`Набрано очков: ${this.levelScore}`, this.width / 2, 320);
            
            // Кнопки
            for (const button of this.levelCompleteButtons) {
                button.draw(ctx);
            }
        } else if (this.gameState === "game_over") {
            // Сообщение о завершении игры
            ctx.font = 'bold 60px Arial';
            ctx.fillStyle = '#dcb4ff';
            ctx.textAlign = 'center';
            ctx.fillText('ИГРА ПРОЙДЕНА!', this.width / 2, 250);
            
            ctx.font = '36px Arial';
            ctx.fillStyle = '#ffffc8';
            ctx.fillText(`Общий счет: ${this.score}`, this.width / 2, 320);
            
            // Кнопка возврата в меню
            const menuButton = new Button(
                this.width/2 - 150, 
                this.height/2 + 100, 
                300, 80, 
                "В МЕНЮ", 
                [180, 100, 200], 
                [220, 140, 255]
            );
            menuButton.draw(ctx);
            this.levelCompleteButtons = [menuButton];
        }
    }
    
    handleMouseDown(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        if (this.gameState === "menu") {
            for (const button of this.menuButtons) {
                if (button.checkHover(x, y)) {
                    if (button.text === "НАЧАТЬ ИГРУ") {
                        this.startNewGame();
                    } else if (button.text === "ВЫХОД") {
                        // Закрытие игры (в контексте iframe)
                        window.parent.postMessage('closeGame', '*');
                    }
                }
            }
        
        } else if (this.gameState === "playing") {
            // Проверка попадания в игровое поле
            if (x >= this.offsetX && x <= this.offsetX + this.boardSize * this.tileSize &&
                y >= this.offsetY && y <= this.offsetY + this.boardSize * this.tileSize) {
                
                // Определение выбранной ячейки
                const col = Math.floor((x - this.offsetX) / this.tileSize);
                const row = Math.floor((y - this.offsetY) / this.tileSize);
                
                if (row >= 0 && row < this.boardSize && col >= 0 && col < this.boardSize && this.board[row][col]) {
                    this.draggingTile = this.board[row][col];
                    this.dragStartCol = col;
                    this.dragStartRow = row;
                    
                    // Начало перетаскивания
                    this.draggingTile.dragging = true;
                    this.draggingTile.dragOffsetX = (x - this.offsetX) % this.tileSize - this.tileSize / 2;
                    this.draggingTile.dragOffsetY = (y - this.offsetY) % this.tileSize - this.tileSize / 2;
                    this.draggingTile.scale = 1.1;
                }
            }
        } else if (this.gameState === "level_complete" || this.gameState === "game_over") {
            for (const button of this.levelCompleteButtons) {
                if (button.checkHover(x, y)) {
                    if (button.text === "СЛЕДУЮЩИЙ УРОВЕНЬ") {
                        this.nextLevel();
                    } else if (button.text === "В МЕНЮ") {
                        this.gameState = "menu";
                    }
                }
            }
        }
    }
    
    handleMouseMove(event) {
        const rect = this.canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        // Обновление состояния кнопок
        if (this.gameState === "menu") {
            for (const button of this.menuButtons) {
                button.checkHover(x, y);
            }
        } else if (this.gameState === "level_complete" || this.gameState === "game_over") {
            for (const button of this.levelCompleteButtons) {
                button.checkHover(x, y);
            }
        }
        
        // Обработка перетаскивания плитки
        if (this.draggingTile) {
            const tile = this.draggingTile;
            
            // Рассчитываем смещение мыши
            const dragX = x - this.offsetX - tile.col * this.tileSize;
            const dragY = y - this.offsetY - tile.row * this.tileSize;
            
            // Определяем направление перетаскивания
            if (Math.abs(dragX) > Math.abs(dragY) && Math.abs(dragX) > this.tileSize / 4) {
                // Горизонтальное перетаскивание
                tile.dragOffsetX = dragX - this.tileSize / 2;
                tile.dragOffsetY = 0;
                
                // Подсвечиваем соседнюю плитку
                const direction = dragX > 0 ? 1 : -1;
                const targetCol = tile.col + direction;
                
                if (targetCol >= 0 && targetCol < this.boardSize) {
                    const neighbor = this.board[tile.row][targetCol];
                    if (neighbor) {
                        neighbor.highlighted = true;
                        this.resetHighlights(neighbor);
                    }
                }
            } else if (Math.abs(dragY) > Math.abs(dragX) && Math.abs(dragY) > this.tileSize / 4) {
                // Вертикальное перетаскивание
                tile.dragOffsetX = 0;
                tile.dragOffsetY = dragY - this.tileSize / 2;
                
                // Подсвечиваем соседнюю плитку
                const direction = dragY > 0 ? 1 : -1;
                const targetRow = tile.row + direction;
                
                if (targetRow >= 0 && targetRow < this.boardSize) {
                    const neighbor = this.board[targetRow][tile.col];
                    if (neighbor) {
                        neighbor.highlighted = true;
                        this.resetHighlights(neighbor);
                    }
                }
            } else {
                // Перетаскивание без четкого направления
                this.resetHighlights();
            }
        }
    }
    
    handleMouseUp(event) {
        if (this.draggingTile) {
            const rect = this.canvas.getBoundingClientRect();
            const x = event.clientX - rect.left;
            const y = event.clientY - rect.top;
            
            const tile = this.draggingTile;
            tile.dragging = false;
            tile.scale = 1.0;
            
            // Определяем направление перетаскивания
            const dragX = x - this.offsetX - tile.col * this.tileSize;
            const dragY = y - this.offsetY - tile.row * this.tileSize;
            
            let newCol = tile.col;
            let newRow = tile.row;
            
            if (Math.abs(dragX) > Math.abs(dragY) && Math.abs(dragX) > this.tileSize / 4) {
                newCol = tile.col + (dragX > 0 ? 1 : -1);
            } else if (Math.abs(dragY) > this.tileSize / 4) {
                newRow = tile.row + (dragY > 0 ? 1 : -1);
            }
            
            // Проверка на выход за границы
            if (newRow < 0 || newRow >= this.boardSize || newCol < 0 || newCol >= this.boardSize) {
                // Возвращаем плитку на место
                tile.animating = true;
                this.resetHighlights();
                this.draggingTile = null;
                this.combo = 1;
                return;
            }
            
            // Меняем плитки местами
            const neighbor = this.board[newRow][newCol];
            if (neighbor) {
                // Обмен позициями
                this.board[tile.row][tile.col] = neighbor;
                this.board[newRow][newCol] = tile;
                
                // Обновление координат
                tile.row = newRow;
                tile.col = newCol;
                neighbor.row = this.dragStartRow;
                neighbor.col = this.dragStartCol;
                
                // Анимация перемещения
                tile.animating = true;
                neighbor.animating = true;
                
                // Проверка совпадений после обмена
                setTimeout(() => {
                    if (!this.findMatches()) {
                        // Если совпадений нет, возвращаем плитки обратно
                        this.board[tile.row][tile.col] = tile;
                        this.board[neighbor.row][neighbor.col] = neighbor;
                        
                        const tempRow = tile.row;
                        const tempCol = tile.col;
                        tile.row = neighbor.row;
                        tile.col = neighbor.col;
                        neighbor.row = tempRow;
                        neighbor.col = tempCol;
                        
                        tile.animating = true;
                        neighbor.animating = true;
                    }
                }, 300);
            }
            
            this.resetHighlights();
            this.draggingTile = null;
            this.combo = 1;
        }
    }
    
    resetHighlights(exceptTile = null) {
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col] && this.board[row][col] !== exceptTile) {
                    this.board[row][col].highlighted = false;
                }
            }
        }
    }
    
    startNewGame() {
        this.score = 0;
        this.levelScore = 0;
        this.currentLevel = 0;
        this.initializeBoard();
        this.gameState = "playing";
    }
    
    nextLevel() {
        this.currentLevel++;
        this.levelScore = 0;
        
        if (this.currentLevel < this.LEVELS.length) {
            this.initializeBoard();
            this.gameState = "playing";
        } else {
            this.gameState = "game_over";
        }
    }
    
    findMatches() {
        let hasMatches = false;
        
        // Сбросим все выделения
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col]) {
                    this.board[row][col].selected = false;
                }
            }
        }
        
        // Проверка по горизонтали
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize - 2; col++) {
                if (this.board[row][col] && this.board[row][col+1] && this.board[row][col+2]) {
                    if (this.board[row][col].type === this.board[row][col+1].type && 
                        this.board[row][col].type === this.board[row][col+2].type) {
                        
                        for (let i = 0; i < 3; i++) {
                            this.board[row][col+i].selected = true;
                        }
                        hasMatches = true;
                    }
                }
            }
        }
        
        // Проверка по вертикали
        for (let row = 0; row < this.boardSize - 2; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col] && this.board[row+1][col] && this.board[row+2][col]) {
                    if (this.board[row][col].type === this.board[row+1][col].type && 
                        this.board[row][col].type === this.board[row+2][col].type) {
                        
                        for (let i = 0; i < 3; i++) {
                            this.board[row+i][col].selected = true;
                        }
                        hasMatches = true;
                    }
                }
            }
        }
        
        return hasMatches;
    }
    
    hasPossibleMoves() {
        // Проверка возможных ходов
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                // Проверка горизонтальных свапов
                if (col < this.boardSize - 1) {
                    // Меняем местами
                    const temp = this.board[row][col];
                    this.board[row][col] = this.board[row][col+1];
                    this.board[row][col+1] = temp;
                    
                    // Проверяем есть ли совпадения
                    const hasMatch = this.findMatches();
                    
                    // Возвращаем на место
                    this.board[row][col+1] = this.board[row][col];
                    this.board[row][col] = temp;
                    
                    if (hasMatch) return true;
                }
                
                // Проверка вертикальных свапов
                if (row < this.boardSize - 1) {
                    // Меняем местами
                    const temp = this.board[row][col];
                    this.board[row][col] = this.board[row+1][col];
                    this.board[row+1][col] = temp;
                    
                    // Проверяем есть ли совпадения
                    const hasMatch = this.findMatches();
                    
                    // Возвращаем на место
                    this.board[row+1][col] = this.board[row][col];
                    this.board[row][col] = temp;
                    
                    if (hasMatch) return true;
                }
            }
        }
        return false;
    }
    
    createParticles(x, y, color, count = 50) {
        for (let i = 0; i < count; i++) {
            this.particles.push(new Particle(x, y, color));
        }
    }
    
    addExplosion(x, y, color) {
        this.explosions.push([x, y, 10, color]);
    }
    
    removeMatches() {
        this.combo++;
        this.comboTimer = 90;
        
        for (let row = 0; row < this.boardSize; row++) {
            for (let col = 0; col < this.boardSize; col++) {
                if (this.board[row][col] && this.board[row][col].selected) {
                    const tile = this.board[row][col];
                    
                    // Создаем эффекты
                    const centerX = this.offsetX + col * this.tileSize + this.tileSize / 2;
                    const centerY = this.offsetY + row * this.tileSize + this.tileSize / 2;
                    this.createParticles(centerX, centerY, tile.color, 50);
                    this.addExplosion(centerX, centerY, tile.color);
                    
                    // Удаляем плитку
                    this.board[row][col] = null;
                    
                    // Добавляем очки
                    const points = 10 * this.combo;
                    this.score += points;
                    this.levelScore += points;
                }
            }
        }
    }
    
    updateEffects() {
        // Обновляем частицы
        this.particles = this.particles.filter(p => p.update());
        
        // Обновляем взрывы
        for (let i = this.explosions.length - 1; i >= 0; i--) {
            this.explosions[i][2] += 2;
            if (this.explosions[i][2] > 50) {
                this.explosions.splice(i, 1);
            }
        }
        
        // Обновляем таймер комбо
        if (this.comboTimer > 0) {
            this.comboTimer--;
            if (this.comboTimer === 0) {
                this.combo = 0;
            }
        }
        
        // Анимируем звезды
        for (const star of this.stars) {
            star.x = (star.x + star.speed) % this.width;
            star.y = (star.y + star.speed * 0.5) % this.height;
        }
    }
    
    fillEmptySpaces() {
        for (let col = 0; col < this.boardSize; col++) {
            const emptyRows = [];
            
            for (let row = this.boardSize - 1; row >= 0; row--) {
                if (!this.board[row][col]) {
                    emptyRows.push(row);
                } else if (emptyRows.length > 0) {
                    const newRow = emptyRows.shift();
                    this.board[newRow][col] = this.board[row][col];
                    this.board[newRow][col].row = newRow;
                    this.board[newRow][col].animating = true;
                    this.board[row][col] = null;
                    emptyRows.push(row);
                }
            }
            
            // Создаем новые плитки
            for (const row of emptyRows) {
                this.createNewTile(row, col);
            }
        }
    }
    
    update() {
        this.updateEffects();
        
        if (this.gameState === "playing") {
            // Проверка совпадений
            if (this.findMatches()) {
                this.removeMatches();
                this.fillEmptySpaces();
                
                // Проверяем завершение уровня
                if (this.levelScore >= this.LEVELS[this.currentLevel].score) {
                    this.gameState = "level_complete";
                }
            }
        }
        
        this.draw();
        requestAnimationFrame(this.update.bind(this));
    }
    
    start() {
        this.update();
    }
}

// Инициализация игры после загрузки страницы
window.addEventListener('load', () => {
    const canvas = document.getElementById('gameCanvas');
    const game = new Match3Game(canvas);
    game.start();
    
    // Добавляем поддержку скругленных прямоугольников
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
});
