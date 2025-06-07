// Конфигурация уровней
const levels = [
    { targetScore: 500, moves: 30, colors: 4 },
    { targetScore: 1000, moves: 25, colors: 5 },
    { targetScore: 2000, moves: 20, colors: 5 },
    { targetScore: 3000, moves: 18, colors: 6 },
    { targetScore: 5000, moves: 15, colors: 6 }
];

// Элементы DOM
const gameContainer = document.getElementById('game-container');
const scenes = {
    mainMenu: document.getElementById('main-menu'),
    levelSelect: document.getElementById('level-select'),
    gameScene: document.getElementById('game-scene'),
    winScene: document.getElementById('win-scene'),
    loseScene: document.getElementById('lose-scene'),
    aboutScene: document.getElementById('about-scene')
};

// Переменные игры
let currentLevel = 0;
let score = 0;
let movesLeft = 0;
let selectedTile = null;
let board = [];
let isSwapping = false;
let isProcessingMatches = false;
let unlockedLevels = 0; // Открытые уровни

// Инициализация игры
function init() {
    // Загрузка открытых уровней
    const savedLevels = localStorage.getItem('unlockedLevels');
    if (savedLevels !== null) {
        unlockedLevels = parseInt(savedLevels);
    }

    // Назначение обработчиков событий
    document.getElementById('play-btn').addEventListener('click', () => {
        showScene('levelSelect');
    });
    
    document.getElementById('levels-btn').addEventListener('click', () => {
        updateLevelSelect();
        showScene('levelSelect');
    });
    
    document.getElementById('about-btn').addEventListener('click', () => {
        showScene('aboutScene');
    });
    
    document.getElementById('back-to-menu').addEventListener('click', () => {
        showScene('mainMenu');
    });
    
    document.getElementById('about-back-btn').addEventListener('click', () => {
        showScene('mainMenu');
    });
    
    document.getElementById('menu-btn').addEventListener('click', () => {
        showScene('mainMenu');
    });
    
    document.getElementById('win-menu-btn').addEventListener('click', () => {
        showScene('mainMenu');
    });
    
    document.getElementById('lose-menu-btn').addEventListener('click', () => {
        showScene('mainMenu');
    });
    
    document.getElementById('next-level-btn').addEventListener('click', () => {
        if (currentLevel < levels.length - 1) {
            currentLevel++;
            startLevel(currentLevel);
        } else {
            showScene('mainMenu');
        }
    });
    
    document.getElementById('retry-btn').addEventListener('click', () => {
        startLevel(currentLevel);
    });
    
    // Обработчики выбора уровня
    updateLevelSelect();
}

// Обновление экрана выбора уровня
function updateLevelSelect() {
    const levelCards = document.querySelectorAll('.level-card');
    levelCards.forEach(card => {
        const level = parseInt(card.dataset.level) - 1;
        if (level <= unlockedLevels) {
            card.classList.remove('locked');
            card.onclick = () => startLevel(level);
        } else {
            card.classList.add('locked');
            card.onclick = null;
        }
    });
}

// Показать сцену
function showScene(sceneName) {
    // Скрыть все сцены
    Object.values(scenes).forEach(scene => {
        scene.classList.remove('active');
    });
    
    // Показать выбранную сцену
    scenes[sceneName].classList.add('active');
}

// Начать уровень
function startLevel(level) {
    currentLevel = level;
    score = 0;
    movesLeft = levels[level].moves;
    
    // Обновление информации об уровне
    document.getElementById('score').textContent = score;
    document.getElementById('target').textContent = levels[level].targetScore;
    document.getElementById('moves').textContent = movesLeft;
    document.getElementById('level').textContent = level + 1;
    
    // Создание игрового поля
    createBoard();
    
    // Показать игровую сцену
    showScene('gameScene');
}

// Создание игрового поля без начальных совпадений
function createBoard() {
    const gameBoard = document.getElementById('game-board');
    gameBoard.innerHTML = '';
    board = [];
    
    const size = 8; // 8x8 сетка
    const colors = levels[currentLevel].colors;
    
    // Создание плиток без совпадений
    for (let row = 0; row < size; row++) {
        board[row] = [];
        for (let col = 0; col < size; col++) {
            const tile = document.createElement('div');
            tile.className = 'tile';
            tile.dataset.row = row;
            tile.dataset.col = col;
            
            // Добавление фигуры
            const shape = document.createElement('div');
            shape.className = 'shape';
            
            // Выбор цвета с проверкой на совпадения
            let colorIndex;
            let attempts = 0;
            do {
                colorIndex = Math.floor(Math.random() * colors);
                attempts++;
                
                // Проверка горизонтальных совпадений
                if (col >= 2 && 
                    board[row][col-1].color === colorIndex && 
                    board[row][col-2].color === colorIndex) {
                    continue;
                }
                
                // Проверка вертикальных совпадений
                if (row >= 2 && 
                    board[row-1][col].color === colorIndex && 
                    board[row-2][col].color === colorIndex) {
                    continue;
                }
                
                break;
                
            } while (attempts < 100); // Защита от бесконечного цикла
            
            shape.style.backgroundColor = getShapeColor(colorIndex);
            tile.appendChild(shape);
            gameBoard.appendChild(tile);
            
            board[row][col] = {
                element: tile,
                color: colorIndex,
                shape: shape
            };
            
            // Обработчик клика
            tile.addEventListener('click', () => handleTileClick(row, col));
        }
    }
}

// Обработка клика по плитке
function handleTileClick(row, col) {
    if (isSwapping || isProcessingMatches) return;
    
    const tile = board[row][col];
    
    // Если плитка уже выбрана
    if (selectedTile === tile) {
        tile.element.classList.remove('selected');
        selectedTile = null;
        return;
    }
    
    // Если это первая выбранная плитка
    if (!selectedTile) {
        tile.element.classList.add('selected');
        selectedTile = tile;
        return;
    }
    
    // Проверка, соседние ли плитки
    const selectedRow = parseInt(selectedTile.element.dataset.row);
    const selectedCol = parseInt(selectedTile.element.dataset.col);
    
    if (
        (Math.abs(selectedRow - row) === 1 && selectedCol === col) ||
        (Math.abs(selectedCol - col) === 1 && selectedRow === row)
    ) {
        // Поменять плитки местами
        swapTiles(selectedRow, selectedCol, row, col);
    } else {
        // Снять выделение с предыдущей плитки
        selectedTile.element.classList.remove('selected');
        // Выбрать новую плитку
        tile.element.classList.add('selected');
        selectedTile = tile;
    }
}

// Поменять плитки местами
function swapTiles(row1, col1, row2, col2) {
    isSwapping = true;
    
    const tile1 = board[row1][col1];
    const tile2 = board[row2][col2];
    
    // Визуальная анимация обмена
    tile1.element.style.transition = 'transform 0.3s ease';
    tile2.element.style.transition = 'transform 0.3s ease';
    
    tile1.element.style.transform = `translate(${(col2 - col1) * 100}%, ${(row2 - row1) * 100}%)`;
    tile2.element.style.transform = `translate(${(col1 - col2) * 100}%, ${(row1 - row2) * 100}%)`;
    
    // Обновить состояние плиток в массиве
    setTimeout(() => {
        // Сбросить трансформации
        tile1.element.style.transform = '';
        tile2.element.style.transform = '';
        
        // Обновить данные в массиве
        board[row1][col1] = tile2;
        board[row2][col2] = tile1;
        
        // Обновить атрибуты данных
        tile1.element.dataset.row = row2;
        tile1.element.dataset.col = col2;
        tile2.element.dataset.row = row1;
        tile2.element.dataset.col = col1;
        
        // Снять выделение
        tile1.element.classList.remove('selected');
        tile2.element.classList.remove('selected');
        selectedTile = null;
        
        // Проверить совпадения после обмена
        setTimeout(() => {
            processMatches();
            isSwapping = false;
        }, 300);
    }, 300);
}

// Обработка совпадений
function processMatches() {
    isProcessingMatches = true;
    const matches = findMatches();
    
    if (matches.length > 0) {
        // Удалить совпадающие плитки
        removeMatches(matches);
        
        // Обновить счет
        updateScore(matches);
        
        // Переместить плитки вниз
        setTimeout(() => {
            dropTiles();
            
            // Заполнить пустые места новыми фигурами сверху
            setTimeout(() => {
                fillEmptySpaces();
                
                // Проверить новые совпадения
                setTimeout(() => {
                    processMatches();
                }, 500);
            }, 500);
        }, 500);
    } else {
        // Если совпадений нет, использовать ход
        movesLeft--;
        document.getElementById('moves').textContent = movesLeft;
        
        // Проверить условия завершения уровня
        checkLevelCompletion();
        isProcessingMatches = false;
    }
}

// Найти совпадения
function findMatches() {
    const matches = [];
    const size = 8;
    
    // Проверка горизонтальных совпадений
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size - 2; col++) {
            const color = board[row][col].color;
            if (color !== null &&
                color === board[row][col + 1].color &&
                color === board[row][col + 2].color) {
                
                let matchLength = 3;
                while (col + matchLength < size && board[row][col + matchLength].color === color) {
                    matchLength++;
                }
                
                for (let i = 0; i < matchLength; i++) {
                    if (!matches.includes(board[row][col + i])) {
                        matches.push(board[row][col + i]);
                    }
                }
            }
        }
    }
    
    // Проверка вертикальных совпадений
    for (let col = 0; col < size; col++) {
        for (let row = 0; row < size - 2; row++) {
            const color = board[row][col].color;
            if (color !== null &&
                color === board[row + 1][col].color &&
                color === board[row + 2][col].color) {
                
                let matchLength = 3;
                while (row + matchLength < size && board[row + matchLength][col].color === color) {
                    matchLength++;
                }
                
                for (let i = 0; i < matchLength; i++) {
                    if (!matches.includes(board[row + i][col])) {
                        matches.push(board[row + i][col]);
                    }
                }
            }
        }
    }
    
    return matches;
}

// Удалить совпадающие плитки
function removeMatches(matches) {
    matches.forEach(tile => {
        tile.element.classList.add('matched');
        tile.color = null;
        
        // Удалить фигуру после анимации
        setTimeout(() => {
            tile.shape.style.visibility = 'hidden';
        }, 300);
    });
}

// Обновить счет
function updateScore(matches) {
    const points = matches.length * 10;
    score += points;
    document.getElementById('score').textContent = score;
}

// Переместить плитки вниз
function dropTiles() {
    const size = 8;
    
    for (let col = 0; col < size; col++) {
        let emptySpaces = 0;
        
        // Снизу вверх
        for (let row = size - 1; row >= 0; row--) {
            const tile = board[row][col];
            
            if (tile.color === null) {
                emptySpaces++;
            } else if (emptySpaces > 0) {
                // Переместить плитку вниз
                const newRow = row + emptySpaces;
                board[newRow][col] = tile;
                board[row][col] = { color: null, element: tile.element, shape: tile.shape };
                
                // Обновить атрибуты данных
                tile.element.dataset.row = newRow;
                tile.element.dataset.col = col;
                
                // Анимация перемещения
                tile.element.style.transition = 'transform 0.5s ease';
                tile.element.style.transform = `translateY(${emptySpaces * 100}%)`;
                
                setTimeout(() => {
                    tile.element.style.transform = '';
                }, 500);
            }
        }
    }
}

// Заполнить пустые места с анимацией падения сверху
function fillEmptySpaces() {
    const size = 8;
    const colors = levels[currentLevel].colors;
    
    for (let col = 0; col < size; col++) {
        for (let row = 0; row < size; row++) {
            if (board[row][col].color === null) {
                const tile = board[row][col];
                const colorIndex = Math.floor(Math.random() * colors);
                
                // Создать новую фигуру
                const shape = document.createElement('div');
                shape.className = 'shape';
                shape.style.backgroundColor = getShapeColor(colorIndex);
                shape.style.transform = 'translateY(-1000%)'; // Начальная позиция сверху
                
                // Удалить старую фигуру, если есть
                if (tile.shape) {
                    tile.shape.remove();
                }
                
                tile.element.appendChild(shape);
                
                // Обновить данные плитки
                tile.color = colorIndex;
                tile.shape = shape;
                
                // Анимация падения
                setTimeout(() => {
                    shape.style.transition = 'transform 0.8s ease';
                    shape.style.transform = 'translateY(0)';
                }, 100);
            }
        }
    }
}

// Проверить завершение уровня
function checkLevelCompletion() {
    if (movesLeft <= 0) {
        if (score >= levels[currentLevel].targetScore) {
            // Победа - открываем следующий уровень
            if (currentLevel >= unlockedLevels) {
                unlockedLevels = currentLevel + 1;
                localStorage.setItem('unlockedLevels', unlockedLevels);
            }
            
            document.getElementById('win-level').textContent = currentLevel + 1;
            document.getElementById('win-score').textContent = score;
            showScene('winScene');
        } else {
            // Поражение
            document.getElementById('lose-level').textContent = currentLevel + 1;
            document.getElementById('lose-score').textContent = score;
            showScene('loseScene');
        }
    }
}

// Получить цвет фигуры
function getShapeColor(index) {
    const colors = [
        '#FF6B6B', // Красный
        '#4ECDC4', // Бирюзовый
        '#FFD166', // Желтый
        '#06D6A0', // Зеленый
        '#118AB2', // Синий
        '#073B4C', // Темно-синий
        '#EF476F', // Розовый
        '#FF9E6D'  // Оранжевый
    ];
    return colors[index % colors.length];
}

// Запуск игры при загрузке страницы
document.addEventListener('DOMContentLoaded', init);
