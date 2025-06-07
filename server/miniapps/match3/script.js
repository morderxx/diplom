const TILE_SIZE = 65;
const COLORS = [
    [255, 90, 90],    // Ярко-красный
    [90, 255, 120],   // Ярко-зеленый
    [100, 180, 255],  // Ярко-синий
    [255, 240, 90],   // Ярко-желтый
    [240, 100, 240],  // Ярко-пурпурный
    [90, 240, 240]    // Ярко-голубой
];
const SHAPES = ["circle", "diamond", "hexagon", "star", "square", "triangle"];
const LEVELS = [
    {score: 500, boardSize: 8},
    {score: 1000, boardSize: 8},
    {score: 2000, boardSize: 8},
    {score: 3500, boardSize: 9},
    {score: 5000, boardSize: 9},
    {score: 7000, boardSize: 9},
    {score: 10000, boardSize: 10},
    {score: 14000, boardSize: 10},
    {score: 18000, boardSize: 10},
    {score: 25000, boardSize: 10},
];

let canvas, ctx;
let boardSize = 8;
let board = [];
let selectedTile = null;
let draggingTile = null;
let dragStartCol = 0;
let dragStartRow = 0;
let score = 0;
let levelScore = 0;
let currentLevel = 0;
let particles = [];
let combo = 0;
let comboTimer = 0;
let explosions = [];
let stars = [];
let gameState = "menu";
let menuButtons = [];
let levelCompleteButtons = [];
let offsetX, offsetY;
let tileSize = TILE_SIZE;
let animations = [];

// Добавим константы для адаптации
const BASE_WIDTH = 800;
const BASE_HEIGHT = 900;

class Particle {
    constructor(x, y, color) {
        this.x = x;
        this.y = y;
        this.color = color;
        this.size = Math.random() * 5 + 3;
        this.speedX = Math.random() * 10 - 5;
        this.speedY = Math.random() * 10 - 5;
        this.life = Math.random() * 30 + 30;
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
        this.alpha = Math.floor(255 * (this.life / 50));
        return this.life > 0;
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.glowSize, 0, Math.PI * 2);
        const glowColor = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${0.4 * this.glowIntensity * (this.life / 50)})`;
        ctx.fillStyle = glowColor;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        const particleColor = `rgba(${this.color[0]}, ${this.color[1]}, ${this.color[2]}, ${this.alpha/255})`;
        ctx.fillStyle = particleColor;
        ctx.fill();
    }
}

class Tile {
    constructor(row, col, type) {
        this.row = row;
        this.col = col;
        this.type = type;
        this.color = COLORS[type];
        this.glowColor = [
            Math.min(255, this.color[0] + 70),
            Math.min(255, this.color[1] + 70),
            Math.min(255, this.color[2] + 70)
        ];
        this.shape = SHAPES[type];
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

    draw() {
        this.targetX = offsetX + this.col * tileSize;
        this.targetY = offsetY + this.row * tileSize;
        
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
        
        if (this.selected) {
            this.glowRadius += 2;
            this.glowIntensity = Math.max(0, 1.0 - this.glowRadius / 50);
            
            if (this.glowRadius > 50) {
                this.glowRadius = 0;
                this.glowIntensity = 1.0;
            }
        }
        
        const drawX = this.dragging ? this.x + this.dragOffsetX : this.x;
        const drawY = this.dragging ? this.y + this.dragOffsetY : this.y;
        
        const size = Math.floor(tileSize * this.scale) - 10;
        const halfSize = size / 2;
        const centerX = drawX + tileSize / 2;
        const centerY = drawY + tileSize / 2;
        
        if (this.glowIntensity > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.glowRadius, 0, Math.PI * 2);
            const glowColor = `rgba(${this.glowColor[0]}, ${this.glowColor[1]}, ${this.glowColor[2]}, ${0.8 * this.glowIntensity})`;
            ctx.fillStyle = glowColor;
            ctx.fill();
        }
        
        ctx.fillStyle = "rgba(20, 20, 20, 0.7)";
        ctx.beginPath();
        ctx.arc(centerX + 5, centerY + 5, halfSize, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.save();
        ctx.translate(centerX, centerY);
        if (this.dragging) {
            this.rotation = (this.rotation + 1) % 360;
            ctx.rotate(this.rotation * Math.PI / 180);
        }
        
        ctx.beginPath();
        switch(this.shape) {
            case "circle":
                ctx.arc(0, 0, halfSize, 0, Math.PI * 2);
                break;
            case "diamond":
                ctx.moveTo(0, -halfSize);
                ctx.lineTo(halfSize, 0);
                ctx.lineTo(0, halfSize);
                ctx.lineTo(-halfSize, 0);
                break;
            case "hexagon":
                for (let i = 0; i < 6; i++) {
                    const angle = Math.PI / 3 * i;
                    ctx.lineTo(
                        halfSize * Math.cos(angle),
                        halfSize * Math.sin(angle)
                    );
                }
                break;
            case "star":
                for (let i = 0; i < 5; i++) {
                    const angle = Math.PI / 5 * 4 * i - Math.PI / 2;
                    ctx.lineTo(
                        halfSize * Math.cos(angle),
                        halfSize * Math.sin(angle)
                    );
                    ctx.lineTo(
                        halfSize * 0.5 * Math.cos(angle + Math.PI / 5),
                        halfSize * 0.5 * Math.sin(angle + Math.PI / 5)
                    );
                }
                break;
            case "square":
                ctx.rect(-halfSize, -halfSize, size, size);
                break;
            case "triangle":
                ctx.moveTo(0, -halfSize);
                ctx.lineTo(halfSize, halfSize);
                ctx.lineTo(-halfSize, halfSize);
                break;
        }
        ctx.closePath();
        
        const fillColor = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        ctx.fillStyle = fillColor;
        ctx.fill();
        
        ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
        
        if (this.selected) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, halfSize + 8, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        
        if (this.highlighted) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, halfSize + 12, 0, Math.PI * 2);
            ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
            ctx.lineWidth = 4;
            ctx.stroke();
        }
    }
}

class Button {
    constructor(x, y, width, height, text, color = [100, 100, 200], hoverColor = [150, 150, 255], textColor = [255, 255, 255]) {
        this.rect = {x, y, width, height};
        this.text = text;
        this.color = color;
        this.hoverColor = hoverColor;
        this.textColor = textColor;
        this.currentColor = color;
        this.font = "bold 42px Arial";
        this.hovered = false;
        this.shadowOffset = 5;
        this.glowIntensity = 0;
    }

    draw() {
        if (this.hovered) {
            this.glowIntensity = Math.min(1.0, this.glowIntensity + 0.1);
        } else {
            this.glowIntensity = Math.max(0.0, this.glowIntensity - 0.05);
        }
        
        // Тень кнопки
        ctx.fillStyle = "rgba(30, 30, 60, 0.6)";
        ctx.beginPath();
        ctx.roundRect(
            this.rect.x + this.shadowOffset,
            this.rect.y + this.shadowOffset,
            this.rect.width,
            this.rect.height,
            15
        );
        ctx.fill();
        
        // Градиент кнопки
        const gradient = ctx.createLinearGradient(
            this.rect.x, this.rect.y,
            this.rect.x, this.rect.y + this.rect.height
        );
        
        if (this.hovered) {
            gradient.addColorStop(0, `rgb(${this.hoverColor[0]}, ${this.hoverColor[1]}, ${this.hoverColor[2]})`);
            gradient.addColorStop(1, `rgb(
                ${Math.floor(this.hoverColor[0] * 0.7)}, 
                ${Math.floor(this.hoverColor[1] * 0.7)}, 
                ${Math.floor(this.hoverColor[2] * 0.7)}
            )`);
        } else {
            gradient.addColorStop(0, `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`);
            gradient.addColorStop(1, `rgb(
                ${Math.floor(this.color[0] * 0.7)}, 
                ${Math.floor(this.color[1] * 0.7)}, 
                ${Math.floor(this.color[2] * 0.7)}
            )`);
        }
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height, 15);
        ctx.fill();
        
        // Свечение при наведении
        if (this.glowIntensity > 0) {
            ctx.fillStyle = `rgba(${this.hoverColor[0]}, ${this.hoverColor[1]}, ${this.hoverColor[2]}, ${0.4 * this.glowIntensity})`;
            ctx.beginPath();
            ctx.roundRect(
                this.rect.x - 15,
                this.rect.y - 15,
                this.rect.width + 30,
                this.rect.height + 30,
                15
            );
            ctx.fill();
        }
        
        // Рамка кнопки
        ctx.strokeStyle = "rgba(200, 200, 255, 0.6)";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.roundRect(this.rect.x, this.rect.y, this.rect.width, this.rect.height, 15);
        ctx.stroke();
        
        // Текст с тенью
        ctx.font = this.font;
        ctx.fillStyle = `rgba(0, 0, 0, 0.6)`;
        ctx.fillText(this.text, this.rect.x + this.rect.width/2 + 2, this.rect.y + this.rect.height/2 + 2);
        
        ctx.fillStyle = `rgb(${this.textColor[0]}, ${this.textColor[1]}, ${this.textColor[2]})`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(this.text, this.rect.x + this.rect.width/2, this.rect.y + this.rect.height/2);
    }

    checkHover(x, y) {
        this.hovered = (
            x >= this.rect.x && x <= this.rect.x + this.rect.width &&
            y >= this.rect.y && y <= this.rect.y + this.rect.height
        );
        this.currentColor = this.hovered ? this.hoverColor : this.color;
        return this.hovered;
    }

    isClicked(x, y) {
        return this.hovered;
    }
}

function init() {
    canvas = document.getElementById("gameCanvas");
    ctx = canvas.getContext("2d");
    
    // Инициализация размера
    resizeCanvas();
    
    // Инициализация звездного фона
    for (let i = 0; i < 100; i++) {
        stars.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            size: Math.random() * 2 + 0.5,
            brightness: Math.random() * 0.5 + 0.3,
            speed: Math.random() * 0.1 + 0.05,
            phase: Math.random() * Math.PI * 2
        });
    }
    
    // Инициализация кнопок
    createButtons();
    
    // Инициализация игрового поля
    initializeBoard();
    
    // Обработчики событий
    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    window.addEventListener("resize", resizeCanvas);
    
    requestAnimationFrame(gameLoop);
}

function resizeCanvas() {
    const container = document.getElementById("game-container");
    const containerWidth = container.clientWidth;
    const containerHeight = container.clientHeight;
    
    // Соотношение сторон оригинальной игры
    const targetRatio = BASE_WIDTH / BASE_HEIGHT;
    
    // Вычисляем размеры для canvas
    let canvasWidth, canvasHeight;
    
    if (containerWidth / containerHeight > targetRatio) {
        canvasHeight = containerHeight;
        canvasWidth = containerHeight * targetRatio;
    } else {
        canvasWidth = containerWidth;
        canvasHeight = containerWidth / targetRatio;
    }
    
    // Устанавливаем размеры
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    canvas.style.width = canvasWidth + "px";
    canvas.style.height = canvasHeight + "px";
    
    // Пересчитываем размер плитки
    tileSize = (canvasWidth * TILE_SIZE) / BASE_WIDTH;
    
    // Пересоздаем кнопки при изменении размера
    createButtons();
    
    // Обновляем позиции плиток
    if (board.length > 0) {
        offsetX = (canvas.width - boardSize * tileSize) / 2;
        offsetY = 150 * (canvas.height / BASE_HEIGHT);
        
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col]) {
                    board[row][col].x = offsetX + col * tileSize;
                    board[row][col].y = offsetY + row * tileSize;
                    board[row][col].targetX = board[row][col].x;
                    board[row][col].targetY = board[row][col].y;
                    board[row][col].animating = false;
                }
            }
        }
    }
}

function createButtons() {
    menuButtons = [
        new Button(canvas.width/2 - 150, canvas.height/2 - 60, 300, 80, "НАЧАТЬ ИГРУ", 
                  [60, 140, 200], [100, 180, 255]),
        new Button(canvas.width/2 - 150, canvas.height/2 + 60, 300, 80, "ВЫХОД", 
                  [200, 80, 100], [255, 120, 120])
    ];
    
    levelCompleteButtons = [
        new Button(canvas.width/2 - 150, canvas.height/2, 300, 80, "СЛЕДУЮЩИЙ УРОВЕНЬ", 
                  [60, 180, 100], [100, 220, 150]),
        new Button(canvas.width/2 - 150, canvas.height/2 + 100, 300, 80, "В МЕНЮ", 
                  [180, 100, 200], [220, 140, 255])
    ];
}

function initializeBoard() {
    boardSize = LEVELS[currentLevel].boardSize;
    offsetX = (canvas.width - boardSize * tileSize) / 2;
    offsetY = 150 * (canvas.height / BASE_HEIGHT);
    
    // Создаем пустое поле
    board = Array.from({length: boardSize}, () => Array(boardSize).fill(null));
    
    // Заполняем поле плитками
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            createNewTile(row, col);
        }
    }
    
    // Убедимся, что на поле нет начальных совпадений
    while (findMatches()) {
        removeMatches();
        fillEmptySpaces();
    }
    
    // Проверяем, есть ли возможные ходы
    if (!hasPossibleMoves()) {
        initializeBoard();
    }
}

function createNewTile(row, col) {
    const possibleTypes = [...Array(COLORS.length).keys()];
    
    // Проверка соседей слева
    if (col >= 2 && board[row][col-1] && board[row][col-2]) {
        if (board[row][col-1].type === board[row][col-2].type) {
            const index = possibleTypes.indexOf(board[row][col-1].type);
            if (index !== -1) possibleTypes.splice(index, 1);
        }
    }
    
    // Проверка соседей сверху
    if (row >= 2 && board[row-1][col] && board[row-2][col]) {
        if (board[row-1][col].type === board[row-2][col].type) {
            const index = possibleTypes.indexOf(board[row-1][col].type);
            if (index !== -1) possibleTypes.splice(index, 1);
        }
    }
    
    const tileType = possibleTypes[Math.floor(Math.random() * possibleTypes.length)];
    board[row][col] = new Tile(row, col, tileType);
    board[row][col].animating = true;
    board[row][col].y = -tileSize;
}

function gameLoop() {
    draw();
    update();
    requestAnimationFrame(gameLoop);
}

function draw() {
    // Рисуем фон космоса
    ctx.fillStyle = "#05000f";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Рисуем звезды
    stars.forEach(star => {
        const twinkle = 0.7 + 0.3 * Math.sin(Date.now() * 0.001 + star.phase);
        const value = Math.floor(255 * star.brightness * twinkle);
        ctx.fillStyle = `rgb(${value}, ${value}, ${value})`;
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fill();
    });
    
    // Отрисовка взрывов
    explosions.forEach(explosion => {
        const [x, y, radius, color] = explosion;
        for (let i = 0; i < 3; i++) {
            const r = radius + i * 5;
            const alpha = Math.max(0, 200 - i * 50);
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${color[0]}, ${color[1]}, ${color[2]}, ${alpha/255})`;
            ctx.fill();
        }
    });
    
    // Отрисовка плиток (только в игровом состоянии)
    if (gameState === "playing") {
        for (let row = 0; row < boardSize; row++) {
            for (let col = 0; col < boardSize; col++) {
                if (board[row][col]) {
                    board[row][col].draw();
                }
            }
        }
    }
    
    // Отрисовка частиц
    particles.forEach(particle => particle.draw());
    
    // Отрисовка UI
    ctx.fillStyle = "rgba(30, 25, 50, 0.85)";
    ctx.fillRect(0, 0, canvas.width, 140 * (canvas.height / BASE_HEIGHT));
    ctx.strokeStyle = "rgba(80, 70, 120, 1)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, 140 * (canvas.height / BASE_HEIGHT));
    ctx.lineTo(canvas.width, 140 * (canvas.height / BASE_HEIGHT));
    ctx.stroke();
    
    ctx.font = "bold " + Math.round(60 * (canvas.height / BASE_HEIGHT)) + "px Arial";
    ctx.fillStyle = "#d4b4ff";
    ctx.textAlign = "center";
    ctx.fillText("ТРИ В РЯД", canvas.width/2, 70 * (canvas.height / BASE_HEIGHT));
    
    // Отображаем состояние игры
    if (gameState === "menu") {
        ctx.font = "bold " + Math.round(60 * (canvas.height / BASE_HEIGHT)) + "px Arial";
        ctx.fillStyle = "#d4b4ff";
        ctx.textAlign = "center";
        ctx.fillText("Главное меню", canvas.width/2, 300 * (canvas.height / BASE_HEIGHT));
        
        // Кнопки меню
        menuButtons.forEach(button => button.draw());
    } else if (gameState === "playing") {
        // Игровая информация
        ctx.font = Math.round(36 * (canvas.height / BASE_HEIGHT)) + "px Arial";
        ctx.fillStyle = "#ffffc8";
        ctx.textAlign = "left";
        ctx.fillText(`ОЧКИ: ${score}`, 50 * (canvas.width / BASE_WIDTH), 80 * (canvas.height / BASE_HEIGHT));
        
        ctx.fillStyle = "#ffc864";
        ctx.textAlign = "right";
        ctx.fillText(`Уровень: ${currentLevel + 1}/10`, canvas.width - 50 * (canvas.width / BASE_WIDTH), 80 * (canvas.height / BASE_HEIGHT));
        
        // Прогресс уровня
        const targetScore = LEVELS[currentLevel].score;
        const progress = Math.min(1.0, levelScore / targetScore);
        
        ctx.fillStyle = "rgba(60, 60, 90, 1)";
        ctx.beginPath();
        const progressHeight = 20 * (canvas.height / BASE_HEIGHT);
        ctx.roundRect(50 * (canvas.width / BASE_WIDTH), 110 * (canvas.height / BASE_HEIGHT), 200 * (canvas.width / BASE_WIDTH), progressHeight, 10);
        ctx.fill();
        
        ctx.fillStyle = "rgba(100, 200, 100, 1)";
        ctx.beginPath();
        ctx.roundRect(50 * (canvas.width / BASE_WIDTH), 110 * (canvas.height / BASE_HEIGHT), 200 * (canvas.width / BASE_WIDTH) * progress, progressHeight, 10);
        ctx.fill();
        
        ctx.strokeStyle = "rgba(80, 70, 120, 1)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(50 * (canvas.width / BASE_WIDTH), 110 * (canvas.height / BASE_HEIGHT), 200 * (canvas.width / BASE_WIDTH), progressHeight, 10);
        ctx.stroke();
        
        // Отображение цели
        ctx.fillStyle = "#c8c8ff";
        ctx.textAlign = "left";
        ctx.fillText(`Цель: ${levelScore}/${targetScore}`, 260 * (canvas.width / BASE_WIDTH), 120 * (canvas.height / BASE_HEIGHT));
        
        // Отрисовка комбо
        if (combo > 1) {
            const comboAlpha = Math.min(255, comboTimer * 4);
            ctx.font = "bold " + Math.round(72 * (canvas.height / BASE_HEIGHT)) + "px Arial";
            ctx.fillStyle = `rgba(255, 220, 100, ${comboAlpha/255})`;
            ctx.textAlign = "center";
            ctx.fillText(`x${combo} КОМБО!`, canvas.width/2, 550 * (canvas.height / BASE_HEIGHT));
        }
        
        // Отрисовка сетки
        ctx.strokeStyle = "rgba(100, 100, 150, 0.6)";
        ctx.lineWidth = 2;
        for (let i = 0; i <= boardSize; i++) {
            // Вертикальные линии
            ctx.beginPath();
            ctx.moveTo(offsetX + i * tileSize, offsetY);
            ctx.lineTo(offsetX + i * tileSize, offsetY + boardSize * tileSize);
            ctx.stroke();
            
            // Горизонтальные линии
            ctx.beginPath();
            ctx.moveTo(offsetX, offsetY + i * tileSize);
            ctx.lineTo(offsetX + boardSize * tileSize, offsetY + i * tileSize);
            ctx.stroke();
        }
    } else if (gameState === "level_complete") {
        ctx.font = "bold " + Math.round(60 * (canvas.height / BASE_HEIGHT)) + "px Arial";
        ctx.fillStyle = "#d4b4ff";
        ctx.textAlign = "center";
        ctx.fillText(`Уровень ${currentLevel + 1} пройден!`, canvas.width/2, 300 * (canvas.height / BASE_HEIGHT));
        
        ctx.font = Math.round(36 * (canvas.height / BASE_HEIGHT)) + "px Arial";
        ctx.fillStyle = "#ffffc8";
        ctx.fillText(`Набрано очков: ${levelScore}`, canvas.width/2, 370 * (canvas.height / BASE_HEIGHT));
        
        // Кнопки
        levelCompleteButtons.forEach(button => button.draw());
    } else if (gameState === "game_over") {
        ctx.font = "bold " + Math.round(60 * (canvas.height / BASE_HEIGHT)) + "px Arial";
        ctx.fillStyle = "#d4b4ff";
        ctx.textAlign = "center";
        ctx.fillText("ИГРА ПРОЙДЕНА!", canvas.width/2, 300 * (canvas.height / BASE_HEIGHT));
        
        ctx.font = Math.round(36 * (canvas.height / BASE_HEIGHT)) + "px Arial";
        ctx.fillStyle = "#ffffc8";
        ctx.fillText(`Общий счет: ${score}`, canvas.width/2, 370 * (canvas.height / BASE_HEIGHT));
        
        // Кнопка возврата в меню
        const menuButton = new Button(
            canvas.width/2 - 150, 
            canvas.height/2 + 100, 
            300, 80, 
            "В МЕНЮ", 
            [180, 100, 200], 
            [220, 140, 255]
        );
        menuButton.draw();
        levelCompleteButtons = [menuButton];
    }
}

function update() {
    // Обновляем звезды
    stars.forEach(star => {
        star.y += star.speed;
        if (star.y > canvas.height) {
            star.y = 0;
            star.x = Math.random() * canvas.width;
        }
    });
    
    // Обновляем взрывы
    for (let i = explosions.length - 1; i >= 0; i--) {
        explosions[i][2] += 2;
        if (explosions[i][2] > 50) {
            explosions.splice(i, 1);
        }
    }
    
    // Обновляем частицы
    for (let i = particles.length - 1; i >= 0; i--) {
        if (!particles[i].update()) {
            particles.splice(i, 1);
        }
    }
    
    // Обновляем таймер комбо
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) {
            combo = 0;
        }
    }
    
    // Обновляем только в игровом состоянии
    if (gameState === "playing") {
        // Проверка совпадений
        if (findMatches()) {
            setTimeout(() => {
                removeMatches();
                fillEmptySpaces();
                
                // Проверяем, достигли ли цели уровня
                if (levelScore >= LEVELS[currentLevel].score) {
                    gameState = "level_complete";
                } else if (!hasPossibleMoves()) {
                    // Если нет возможных ходов, перестраиваем поле
                    initializeBoard();
                }
            }, 300);
        }
    }
}

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (gameState === "menu") {
        menuButtons.forEach(button => {
            button.checkHover(x, y);
            if (button.isClicked(x, y)) {
                if (button.text === "НАЧАТЬ ИГРУ") {
                    startNewGame();
                } else if (button.text === "ВЫХОД") {
                    window.parent.postMessage({type: "closeGame"}, "*");
                }
            }
        });
    } else if (gameState === "playing") {
        handleClick(x, y);
    } else if (gameState === "level_complete" || gameState === "game_over") {
        levelCompleteButtons.forEach(button => {
            button.checkHover(x, y);
            if (button.isClicked(x, y)) {
                if (button.text === "СЛЕДУЮЩИЙ УРОВЕНЬ") {
                    nextLevel();
                } else if (button.text === "В МЕНЮ") {
                    gameState = "menu";
                }
            }
        });
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    
    if (gameState === "menu") {
        menuButtons.forEach(button => button.checkHover(x, y));
    } else if (gameState === "playing") {
        if (draggingTile) {
            handleDrag(x, y);
        }
    } else if (gameState === "level_complete" || gameState === "game_over") {
        levelCompleteButtons.forEach(button => button.checkHover(x, y));
    }
}

function handleMouseUp(e) {
    if (gameState === "playing" && draggingTile) {
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;
        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;
        handleDrop(x, y);
    }
}

function startNewGame() {
    score = 0;
    levelScore = 0;
    currentLevel = 0;
    initializeBoard();
    gameState = "playing";
}

function nextLevel() {
    currentLevel++;
    levelScore = 0;
    
    if (currentLevel < LEVELS.length) {
        initializeBoard();
        gameState = "playing";
    } else {
        gameState = "game_over";
    }
}

function handleClick(x, y) {
    // Проверка попадания в игровое поле
    if (
        x >= offsetX && x <= offsetX + boardSize * tileSize &&
        y >= offsetY && y <= offsetY + boardSize * tileSize
    ) {
        // Определение выбранной ячейки
        const col = Math.floor((x - offsetX) / tileSize);
        const row = Math.floor((y - offsetY) / tileSize);
        
        if (row >= 0 && row < boardSize && col >= 0 && col < boardSize && board[row][col]) {
            draggingTile = board[row][col];
            dragStartCol = col;
            dragStartRow = row;
            
            // Рассчитываем смещение внутри плитки
            const tile = draggingTile;
            tile.dragging = true;
            tile.dragOffsetX = (x - offsetX) - col * tileSize - tileSize/2;
            tile.dragOffsetY = (y - offsetY) - row * tileSize - tileSize/2;
            
            // Анимация
            tile.scale = 1.1;
        }
    }
}

function handleDrag(x, y) {
    if (!draggingTile) return;
    
    const tile = draggingTile;
    
    // Обновляем позицию плитки для перетаскивания
    tile.x = offsetX + tile.col * tileSize;
    tile.y = offsetY + tile.row * tileSize;
    
    // Рассчитываем смещение мыши
    const dragX = x - offsetX - tile.col * tileSize;
    const dragY = y - offsetY - tile.row * tileSize;
    
    // Определяем направление перетаскивания
    if (Math.abs(dragX) > Math.abs(dragY) && Math.abs(dragX) > tileSize/4) {
        // Горизонтальное перетаскивание
        tile.dragOffsetX = dragX - tileSize/2;
        tile.dragOffsetY = 0;
        
        // Подсвечиваем соседнюю плитку
        const direction = dragX > 0 ? 1 : -1;
        const targetCol = tile.col + direction;
        
        if (targetCol >= 0 && targetCol < boardSize) {
            const neighbor = board[tile.row][targetCol];
            if (neighbor) {
                neighbor.highlighted = true;
                resetHighlights(neighbor);
            }
        }
    } else if (Math.abs(dragY) > Math.abs(dragX) && Math.abs(dragY) > tileSize/4) {
        // Вертикальное перетаскивание
        tile.dragOffsetX = 0;
        tile.dragOffsetY = dragY - tileSize/2;
        
        // Подсвечиваем соседнюю плитку
        const direction = dragY > 0 ? 1 : -1;
        const targetRow = tile.row + direction;
        
        if (targetRow >= 0 && targetRow < boardSize) {
            const neighbor = board[targetRow][tile.col];
            if (neighbor) {
                neighbor.highlighted = true;
                resetHighlights(neighbor);
            }
        }
    } else {
        // Перетаскивание без четкого направления - сбросить подсветку
        resetHighlights();
    }
}

function resetHighlights(exceptTile = null) {
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col] && board[row][col] !== exceptTile) {
                board[row][col].highlighted = false;
            }
        }
    }
}

function handleDrop(x, y) {
    if (!draggingTile) return;
    
    const tile = draggingTile;
    tile.dragging = false;
    tile.scale = 1.0;
    resetHighlights();
    
    const dragX = x - offsetX - tile.col * tileSize;
    const dragY = y - offsetY - tile.row * tileSize;
    
    let validMove = false;
    
    // Определяем направление перетаскивания
    if (Math.abs(dragX) > Math.abs(dragY) && Math.abs(dragX) > tileSize/4) {
        const direction = dragX > 0 ? 1 : -1;
        const targetCol = tile.col + direction;
        
        if (targetCol >= 0 && targetCol < boardSize) {
            if (isValidMove(tile.row, tile.col, tile.row, targetCol)) {
                swapTiles(tile.row, tile.col, tile.row, targetCol);
                validMove = true;
            }
        }
    } else if (Math.abs(dragY) > Math.abs(dragX) && Math.abs(dragY) > tileSize/4) {
        const direction = dragY > 0 ? 1 : -1;
        const targetRow = tile.row + direction;
        
        if (targetRow >= 0 && targetRow < boardSize) {
            if (isValidMove(tile.row, tile.col, targetRow, tile.col)) {
                swapTiles(tile.row, tile.col, targetRow, tile.col);
                validMove = true;
            }
        }
    }
    
    // Если ход был валидный, сбрасываем комбо
    if (validMove) {
        combo = 1;
    }
    
    draggingTile = null;
}

function isValidMove(row1, col1, row2, col2) {
    // Сохраняем исходное состояние
    const originalBoard = board.map(row => [...row]);
    
    // Пробуем сделать ход
    [board[row1][col1], board[row2][col2]] = [board[row2][col2], board[row1][col1]];
    
    // Обновляем координаты плиток
    if (board[row1][col1]) {
        board[row1][col1].row = row1;
        board[row1][col1].col = col1;
        board[row1][col1].animating = true;
    }
    if (board[row2][col2]) {
        board[row2][col2].row = row2;
        board[row2][col2].col = col2;
        board[row2][col2].animating = true;
    }
    
    // Проверяем, есть ли совпадения
    const hasMatches = findMatches();
    
    // Восстанавливаем исходное состояние
    board = originalBoard;
    
    return hasMatches;
}

function swapTiles(row1, col1, row2, col2) {
    // Обмен плитками местами
    [board[row1][col1], board[row2][col2]] = [board[row2][col2], board[row1][col1]];
    
    // Обновляем координаты плиток
    if (board[row1][col1]) {
        board[row1][col1].row = row1;
        board[row1][col1].col = col1;
        board[row1][col1].animating = true;
    }
    if (board[row2][col2]) {
        board[row2][col2].row = row2;
        board[row2][col2].col = col2;
        board[row2][col2].animating = true;
    }
}

function findMatches() {
    let hasMatches = false;
    
    // Сбросим все выделения
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col]) {
                board[row][col].selected = false;
            }
        }
    }
    
    // Проверка по горизонтали
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize - 2; col++) {
            if (
                board[row][col] &&
                board[row][col+1] &&
                board[row][col+2] &&
                board[row][col].type === board[row][col+1].type &&
                board[row][col].type === board[row][col+2].type
            ) {
                for (let i = 0; i < 3; i++) {
                    if (board[row][col+i]) {
                        board[row][col+i].selected = true;
                    }
                }
                hasMatches = true;
            }
        }
    }
    
    // Проверка по вертикали
    for (let row = 0; row < boardSize - 2; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (
                board[row][col] &&
                board[row+1][col] &&
                board[row+2][col] &&
                board[row][col].type === board[row+1][col].type &&
                board[row][col].type === board[row+2][col].type
            ) {
                for (let i = 0; i < 3; i++) {
                    if (board[row+i][col]) {
                        board[row+i][col].selected = true;
                    }
                }
                hasMatches = true;
            }
        }
    }
    
    return hasMatches;
}

function hasPossibleMoves() {
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            // Проверка горизонтального обмена
            if (col < boardSize - 1) {
                if (isValidMove(row, col, row, col+1)) {
                    return true;
                }
            }
            
            // Проверка вертикального обмена
            if (row < boardSize - 1) {
                if (isValidMove(row, col, row+1, col)) {
                    return true;
                }
            }
        }
    }
    
    return false;
}

function createParticles(x, y, color, count = 50) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color));
    }
}

function addExplosion(x, y, color) {
    explosions.push([x, y, 10, color]);
}

function removeMatches() {
    // Увеличиваем комбо
    combo++;
    comboTimer = 90;
    
    // Создаем эффекты взрыва
    for (let row = 0; row < boardSize; row++) {
        for (let col = 0; col < boardSize; col++) {
            if (board[row][col] && board[row][col].selected) {
                const tile = board[row][col];
                
                // Создаем частицы
                const centerX = offsetX + col * tileSize + tileSize / 2;
                const centerY = offsetY + row * tileSize + tileSize / 2;
                createParticles(centerX, centerY, tile.color, 50);
                addExplosion(centerX, centerY, tile.color);
                
                // Удаляем плитку
                board[row][col] = null;
                // Добавляем очки
                const points = 10 * combo;
                score += points;
                levelScore += points;
            }
        }
    }
}

function fillEmptySpaces() {
    // Перемещение плиток вниз
    for (let col = 0; col < boardSize; col++) {
        const emptyRows = [];
        
        for (let row = boardSize - 1; row >= 0; row--) {
            if (board[row][col] === null) {
                emptyRows.push(row);
            } else if (emptyRows.length > 0) {
                // Перемещаем плитку в самую нижнюю пустую позицию
                const newRow = emptyRows.shift();
                board[newRow][col] = board[row][col];
                board[newRow][col].row = newRow;
                board[newRow][col].animating = true;
                board[row][col] = null;
                emptyRows.push(row);
            }
        }
        
        // Создаем новые плитки наверху
        for (const row of emptyRows) {
            createNewTile(row, col);
        }
    }
}

// Запуск игры
window.addEventListener("load", init);
