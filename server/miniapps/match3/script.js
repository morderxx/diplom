// Конфигурация уровней
const levels = [
    { id: 1, targetScore: 1000, moves: 20, colors: 4, size: 6 },
    { id: 2, targetScore: 2000, moves: 20, colors: 5, size: 7 },
    { id: 3, targetScore: 3000, moves: 25, colors: 5, size: 8 },
    { id: 4, targetScore: 5000, moves: 25, colors: 6, size: 8 },
    { id: 5, targetScore: 8000, moves: 30, colors: 6, size: 8 }
];

// Состояние игры
const gameState = {
    currentLevel: 0,
    score: 0,
    movesLeft: 0,
    targetScore: 0,
    board: [],
    selectedGem: null,
    isSwapping: false,
    isProcessing: false,
    completedLevels: JSON.parse(localStorage.getItem('completedLevels')) || []
};

// DOM элементы
const elements = {
    board: document.getElementById('board'),
    level: document.getElementById('level'),
    score: document.getElementById('score'),
    moves: document.getElementById('moves'),
    target: document.getElementById('target'),
    menuScreen: document.getElementById('menu-screen'),
    winScreen: document.getElementById('win-screen'),
    loseScreen: document.getElementById('lose-screen'),
    winScore: document.getElementById('win-score'),
    loseScore: document.getElementById('lose-score'),
    levelsContainer: document.getElementById('levels-container'),
    nextLevelBtn: document.getElementById('next-level-btn'),
    menuBtn: document.getElementById('menu-btn'),
    menuBtn2: document.getElementById('menu-btn2'),
    retryBtn: document.getElementById('retry-btn')
};

// Цвета драгоценных камней
const gemColors = ['red', 'blue', 'green', 'yellow', 'purple', 'orange'];

// Инициализация игры
function initGame() {
    renderLevelMenu();
    showMenu();
    
    // Добавляем инструкцию
    const tutorial = document.createElement('div');
    tutorial.className = 'tutorial';
    tutorial.innerHTML = `
        <div class="tutorial-title">Как играть:</div>
        <ul class="tutorial-list">
            <li>Кликайте на камни, чтобы выбрать их</li>
            <li>Меняйте местами соседние камни</li>
            <li>Собирайте 3+ одинаковых камня в ряд</li>
            <li>Чем больше камней в ряду - тем больше очков!</li>
            <li>Управляйте ходами, чтобы достичь цели</li>
        </ul>
    `;
    elements.menuScreen.appendChild(tutorial);
}

// Показать меню
function showMenu() {
    hideAllScreens();
    elements.menuScreen.classList.remove('hidden');
}

// Показать экран победы
function showWinScreen() {
    hideAllScreens();
    elements.winScore.textContent = gameState.score;
    elements.winScreen.classList.remove('hidden');
}

// Показать экран проигрыша
function showLoseScreen() {
    hideAllScreens();
    elements.loseScore.textContent = gameState.score;
    elements.loseScreen.classList.remove('hidden');
}

// Скрыть все экраны
function hideAllScreens() {
    elements.menuScreen.classList.add('hidden');
    elements.winScreen.classList.add('hidden');
    elements.loseScreen.classList.add('hidden');
}

// Отрисовка меню выбора уровня
function renderLevelMenu() {
    elements.levelsContainer.innerHTML = '';
    levels.forEach(level => {
        const isCompleted = gameState.completedLevels.includes(level.id);
        const btn = document.createElement('button');
        btn.className = `level-btn ${isCompleted ? 'completed' : ''}`;
        btn.textContent = `Уровень ${level.id}${isCompleted ? ' ✓' : ''}`;
        btn.onclick = () => startLevel(level.id - 1);
        elements.levelsContainer.appendChild(btn);
    });
}

// Начать уровень
function startLevel(levelIndex) {
    gameState.currentLevel = levelIndex;
    const level = levels[levelIndex];
    
    gameState.score = 0;
    gameState.movesLeft = level.moves;
    gameState.targetScore = level.targetScore;
    
    // Обновление UI
    elements.level.textContent = levelIndex + 1;
    elements.score.textContent = gameState.score;
    elements.moves.textContent = gameState.movesLeft;
    elements.target.textContent = level.targetScore;
    
    // Создание игрового поля
    createBoard(level.size, level.colors);
    
    // Скрыть меню
    hideAllScreens();
}

// Создание игрового поля без начальных совпадений
function createBoard(size, colors) {
    elements.board.innerHTML = '';
    elements.board.style.gridTemplateColumns = `repeat(${size}, 1fr)`;
    
    gameState.board = [];
    
    // Создаем временную доску
    let boardCreated = false;
    while (!boardCreated) {
        // Очищаем доску перед новой попыткой
        elements.board.innerHTML = '';
        gameState.board = [];
        
        for (let row = 0; row < size; row++) {
            gameState.board[row] = [];
            for (let col = 0; col < size; col++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                cell.dataset.row = row;
                cell.dataset.col = col;
                
                // Создание случайного камня
                const gem = createRandomGem(colors);
                cell.appendChild(gem);
                
                elements.board.appendChild(cell);
                gameState.board[row][col] = {
                    element: gem,
                    color: gem.dataset.color,
                    row,
                    col
                };
            }
        }
        
        // Проверяем на начальные совпадения
        const initialMatches = findMatches();
        if (initialMatches.length === 0) {
            boardCreated = true;
            
            // Добавляем обработчики событий только после создания доски
            for (let row = 0; row < size; row++) {
                for (let col = 0; col < size; col++) {
                    const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                    cell.addEventListener('click', () => handleCellClick(row, col));
                }
            }
        }
    }
}

// Создание случайного камня
function createRandomGem(colors) {
    const gem = document.createElement('div');
    const colorIndex = Math.floor(Math.random() * colors);
    const color = gemColors[colorIndex];
    
    gem.className = `gem ${color}`;
    gem.dataset.color = color;
    
    return gem;
}

// Обработка клика по ячейке
function handleCellClick(row, col) {
    if (gameState.isProcessing || gameState.isSwapping) return;
    
    const clickedGem = gameState.board[row][col];
    
    // Если камень не выбран - выбираем его
    if (!gameState.selectedGem) {
        gameState.selectedGem = clickedGem;
        clickedGem.element.classList.add('selected');
        return;
    }
    
    // Если клик на тот же камень - снимаем выделение
    if (gameState.selectedGem.row === row && gameState.selectedGem.col === col) {
        gameState.selectedGem.element.classList.remove('selected');
        gameState.selectedGem = null;
        return;
    }
    
    // Проверка соседства
    const isAdjacent = 
        (Math.abs(gameState.selectedGem.row - row) === 1 && gameState.selectedGem.col === col) ||
        (Math.abs(gameState.selectedGem.col - col) === 1 && gameState.selectedGem.row === row);
    
    if (isAdjacent) {
        // Меняем камни местами
        swapGems(gameState.selectedGem, clickedGem);
    } else {
        // Выбираем другой камень
        gameState.selectedGem.element.classList.remove('selected');
        gameState.selectedGem = clickedGem;
        clickedGem.element.classList.add('selected');
    }
}

// Обмен камней местами
function swapGems(gem1, gem2) {
    gameState.isSwapping = true;
    gameState.selectedGem.element.classList.remove('selected');
    gameState.selectedGem = null;
    
    // Сохраняем оригинальные позиции
    const originalGem1 = { ...gem1 };
    const originalGem2 = { ...gem2 };
    
    // Меняем данные в массиве
    gameState.board[gem1.row][gem1.col] = gem2;
    gameState.board[gem2.row][gem2.col] = gem1;
    
    // Обновляем координаты камней
    const tempRow = gem1.row;
    const tempCol = gem1.col;
    gem1.row = gem2.row;
    gem1.col = gem2.col;
    gem2.row = tempRow;
    gem2.col = tempCol;
    
    // Обновляем DOM
    const cell1 = document.querySelector(`.cell[data-row="${gem1.row}"][data-col="${gem1.col}"]`);
    const cell2 = document.querySelector(`.cell[data-row="${gem2.row}"][data-col="${gem2.col}"]`);
    
    cell1.innerHTML = '';
    cell2.innerHTML = '';
    
    cell1.appendChild(gem1.element);
    cell2.appendChild(gem2.element);
    
    // Анимация обмена
    gem1.element.style.transition = 'transform 0.3s ease';
    gem2.element.style.transition = 'transform 0.3s ease';
    
    gem1.element.style.transform = 'scale(1.1)';
    gem2.element.style.transform = 'scale(1.1)';
    
    setTimeout(() => {
        gem1.element.style.transform = '';
        gem2.element.style.transform = '';
        
        // Проверяем совпадения после обмена
        setTimeout(() => {
            const matches = findMatches();
            
            if (matches.length > 0) {
                // Уменьшаем количество ходов
                gameState.movesLeft--;
                elements.moves.textContent = gameState.movesLeft;
                
                processMatches(matches);
            } else {
                // Если совпадений нет - возвращаем камни
                revertSwap(originalGem1, originalGem2);
            }
            
            gameState.isSwapping = false;
        }, 300);
    }, 300);
}

// Отмена обмена
function revertSwap(originalGem1, originalGem2) {
    const gem1 = gameState.board[originalGem1.row][originalGem1.col];
    const gem2 = gameState.board[originalGem2.row][originalGem2.col];
    
    // Меняем данные в массиве обратно
    gameState.board[originalGem1.row][originalGem1.col] = gem1;
    gameState.board[originalGem2.row][originalGem2.col] = gem2;
    
    // Восстанавливаем оригинальные координаты
    gem1.row = originalGem1.row;
    gem1.col = originalGem1.col;
    gem2.row = originalGem2.row;
    gem2.col = originalGem2.col;
    
    // Обновляем DOM
    const cell1 = document.querySelector(`.cell[data-row="${gem1.row}"][data-col="${gem1.col}"]`);
    const cell2 = document.querySelector(`.cell[data-row="${gem2.row}"][data-col="${gem2.col}"]`);
    
    cell1.innerHTML = '';
    cell2.innerHTML = '';
    
    cell1.appendChild(gem1.element);
    cell2.appendChild(gem2.element);
    
    // Анимация возврата
    gem1.element.style.transition = 'transform 0.3s ease';
    gem2.element.style.transition = 'transform 0.3s ease';
    
    gem1.element.style.transform = 'scale(1.1)';
    gem2.element.style.transform = 'scale(1.1)';
    
    setTimeout(() => {
        gem1.element.style.transform = '';
        gem2.element.style.transform = '';
    }, 300);
}

// Поиск совпадений
function findMatches() {
    const matches = [];
    const size = gameState.board.length;
    
    // Проверяем по горизонтали
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size - 2; col++) {
            const gem1 = gameState.board[row][col];
            const gem2 = gameState.board[row][col + 1];
            const gem3 = gameState.board[row][col + 2];
            
            if (gem1 && gem2 && gem3 && 
                gem1.color === gem2.color && gem2.color === gem3.color) {
                const match = [gem1, gem2, gem3];
                
                // Проверяем, есть ли продолжение
                for (let i = col + 3; i < size; i++) {
                    const nextGem = gameState.board[row][i];
                    if (nextGem && nextGem.color === gem1.color) {
                        match.push(nextGem);
                    } else {
                        break;
                    }
                }
                
                // Проверяем, что матч еще не добавлен
                if (!matches.some(m => m.includes(gem1))) {
                    matches.push(match);
                }
            }
        }
    }
    
    // Проверяем по вертикали
    for (let col = 0; col < size; col++) {
        for (let row = 0; row < size - 2; row++) {
            const gem1 = gameState.board[row][col];
            const gem2 = gameState.board[row + 1][col];
            const gem3 = gameState.board[row + 2][col];
            
            if (gem1 && gem2 && gem3 && 
                gem1.color === gem2.color && gem2.color === gem3.color) {
                const match = [gem1, gem2, gem3];
                
                // Проверяем, есть ли продолжение
                for (let i = row + 3; i < size; i++) {
                    const nextGem = gameState.board[i][col];
                    if (nextGem && nextGem.color === gem1.color) {
                        match.push(nextGem);
                    } else {
                        break;
                    }
                }
                
                // Проверяем, что матч еще не добавлен
                if (!matches.some(m => m.includes(gem1))) {
                    matches.push(match);
                }
            }
        }
    }
    
    return matches;
}

// Обработка совпадений
function processMatches(matches) {
    if (matches.length === 0) {
        gameState.isProcessing = false;
        checkGameStatus();
        return;
    }
    
    gameState.isProcessing = true;
    
    // Собираем все уникальные камни в совпадениях
    const gemsToRemove = [];
    matches.forEach(match => {
        match.forEach(gem => {
            if (!gemsToRemove.includes(gem)) {
                gemsToRemove.push(gem);
            }
        });
    });
    
    // Удаляем камни с анимацией
    gemsToRemove.forEach(gem => {
        gem.element.classList.add('matched');
    });
    
    // Обновляем счет
    const points = gemsToRemove.length * 100;
    gameState.score += points;
    elements.score.textContent = gameState.score;
    
    // Задержка перед удалением камней и заполнением поля
    setTimeout(() => {
        // Удаляем камни
        gemsToRemove.forEach(gem => {
            const cell = document.querySelector(`.cell[data-row="${gem.row}"][data-col="${gem.col}"]`);
            cell.innerHTML = '';
            gameState.board[gem.row][gem.col] = null;
        });
        
        // Сдвигаем камни вниз
        shiftGemsDown();
        
        // Заполняем пустые ячейки
        setTimeout(() => {
            fillEmptyCells();
            
            // Проверяем новые совпадения
            setTimeout(() => {
                const newMatches = findMatches();
                
                if (newMatches.length > 0) {
                    processMatches(newMatches);
                } else {
                    gameState.isProcessing = false;
                    checkGameStatus();
                }
            }, 300);
        }, 300);
    }, 500);
}

// Сдвиг камней вниз
function shiftGemsDown() {
    const size = gameState.board.length;
    
    for (let col = 0; col < size; col++) {
        for (let row = size - 1; row >= 0; row--) {
            // Если ячейка пустая
            if (!gameState.board[row][col]) {
                // Ищем ближайший камень сверху
                for (let r = row - 1; r >= 0; r--) {
                    if (gameState.board[r][col]) {
                        const gem = gameState.board[r][col];
                        
                        // Перемещаем камень вниз
                        gameState.board[row][col] = gem;
                        gameState.board[r][col] = null;
                        
                        // Обновляем координаты камня
                        gem.row = row;
                        gem.col = col;
                        
                        // Обновляем DOM
                        const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                        cell.innerHTML = '';
                        cell.appendChild(gem.element);
                        
                        break;
                    }
                }
            }
        }
    }
}

// Заполнение пустых ячеек
function fillEmptyCells() {
    const size = gameState.board.length;
    const colors = levels[gameState.currentLevel].colors;
    
    for (let row = 0; row < size; row++) {
        for (let col = 0; col < size; col++) {
            if (!gameState.board[row][col]) {
                // Создаем новый камень
                const gem = createRandomGem(colors);
                gem.classList.add('new');
                
                const cell = document.querySelector(`.cell[data-row="${row}"][data-col="${col}"]`);
                cell.appendChild(gem);
                
                gameState.board[row][col] = {
                    element: gem,
                    color: gem.dataset.color,
                    row,
                    col
                };
                
                // Убираем класс анимации после завершения
                setTimeout(() => {
                    gem.classList.remove('new');
                }, 500);
            }
        }
    }
}

// Проверка статуса игры
function checkGameStatus() {
    if (gameState.score >= gameState.targetScore) {
        // Уровень пройден
        if (!gameState.completedLevels.includes(gameState.currentLevel + 1)) {
            gameState.completedLevels.push(gameState.currentLevel + 1);
            localStorage.setItem('completedLevels', JSON.stringify(gameState.completedLevels));
        }
        setTimeout(showWinScreen, 500);
    } else if (gameState.movesLeft <= 0) {
        // Ходы закончились
        setTimeout(showLoseScreen, 500);
    }
}

// Обработчики кнопок
elements.nextLevelBtn.addEventListener('click', () => {
    const nextLevel = gameState.currentLevel + 1;
    if (nextLevel < levels.length) {
        startLevel(nextLevel);
    } else {
        showMenu();
    }
});

elements.menuBtn.addEventListener('click', showMenu);
elements.menuBtn2.addEventListener('click', showMenu);
elements.retryBtn.addEventListener('click', () => startLevel(gameState.currentLevel));

// Запуск игры
initGame();
