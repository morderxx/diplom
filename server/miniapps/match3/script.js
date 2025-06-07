document.addEventListener('DOMContentLoaded', () => {
    // Конфигурация уровней
    const levels = [
        { cols: 6, rows: 6, moves: 15, target: 1000 },
        { cols: 7, rows: 7, moves: 20, target: 1500 },
        { cols: 8, rows: 8, moves: 25, target: 2500 },
        { cols: 8, rows: 8, moves: 20, target: 3000 },
        { cols: 9, rows: 9, moves: 25, target: 4000 }
    ];

    // Цвета для фигур
    const gemColors = [
        '#FF6B6B', '#4ECCA3', '#F8B400', 
        '#6A67CE', '#FF9F45', '#1E5128'
    ];

    // Элементы DOM
    const levelScreen = document.querySelector('.level-screen');
    const gameScreen = document.querySelector('.game-screen');
    const gameBoard = document.querySelector('.game-board');
    const currentLevelEl = document.getElementById('current-level');
    const movesLeftEl = document.getElementById('moves-left');
    const targetScoreEl = document.getElementById('target-score');
    const currentScoreEl = document.getElementById('current-score');
    const gameOverScreen = document.querySelector('.game-over');
    const resultMessage = document.getElementById('result-message');
    const restartButton = document.getElementById('restart');
    const nextLevelButton = document.getElementById('next-level');
    
    // Игровые переменные
    let currentLevel = 0;
    let movesLeft = 0;
    let targetScore = 0;
    let currentScore = 0;
    let board = [];
    let selectedTile = null;
    
    // Инициализация игры
    function initGame(level) {
        currentLevel = level;
        const config = levels[level];
        
        movesLeft = config.moves;
        targetScore = config.target;
        currentScore = 0;
        
        currentLevelEl.textContent = level + 1;
        movesLeftEl.textContent = movesLeft;
        targetScoreEl.textContent = targetScore;
        currentScoreEl.textContent = currentScore;
        
        createBoard(config.rows, config.cols);
        gameOverScreen.classList.add('hidden');
    }
    
    // Создание игрового поля
    function createBoard(rows, cols) {
        gameBoard.innerHTML = '';
        gameBoard.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        board = [];
        
        for (let r = 0; r < rows; r++) {
            board[r] = [];
            for (let c = 0; c < cols; c++) {
                const tile = document.createElement('div');
                tile.classList.add('tile');
                tile.dataset.row = r;
                tile.dataset.col = c;
                
                const gem = document.createElement('div');
                gem.classList.add('gem');
                
                const colorIndex = Math.floor(Math.random() * gemColors.length);
                gem.style.setProperty('--color', gemColors[colorIndex]);
                board[r][c] = colorIndex;
                
                tile.appendChild(gem);
                tile.addEventListener('click', () => selectTile(r, c));
                gameBoard.appendChild(tile);
            }
        }
    }
    
    // Выбор плитки
    function selectTile(row, col) {
        if (movesLeft <= 0) return;
        
        const tile = document.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
        
        if (selectedTile === null) {
            // Первый выбор
            selectedTile = { row, col };
            tile.classList.add('selected');
        } else {
            // Второй выбор
            const prevTile = document.querySelector(
                `.tile[data-row="${selectedTile.row}"][data-col="${selectedTile.col}"]`
            );
            
            prevTile.classList.remove('selected');
            
            // Проверка соседних плиток
            const isAdjacent = 
                (Math.abs(selectedTile.row - row) === 1 && selectedTile.col === col) ||
                (Math.abs(selectedTile.col - col) === 1 && selectedTile.row === row);
            
            if (isAdjacent) {
                swapTiles(selectedTile.row, selectedTile.col, row, col);
                movesLeft--;
                movesLeftEl.textContent = movesLeft;
                
                setTimeout(() => {
                    checkMatches();
                    checkGameStatus();
                }, 300);
            }
            
            selectedTile = null;
        }
    }
    
    // Обмен плиток
    function swapTiles(row1, col1, row2, col2) {
        // Обмен в матрице
        [board[row1][col1], board[row2][col2]] = [board[row2][col2], board[row1][col1]];
        
        // Обновление визуала
        updateTile(row1, col1);
        updateTile(row2, col2);
    }
    
    // Обновление плитки
    function updateTile(row, col) {
        const tile = document.querySelector(`.tile[data-row="${row}"][data-col="${col}"]`);
        const gem = tile.querySelector('.gem');
        gem.style.setProperty('--color', gemColors[board[row][col]]);
    }
    
    // Проверка совпадений
    function checkMatches() {
        let hasMatches = false;
        const rows = board.length;
        const cols = board[0].length;
        
        // Пометить совпадения для удаления
        const toRemove = Array(rows).fill().map(() => Array(cols).fill(false));
        
        // Проверка по горизонтали
        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols - 2; c++) {
                if (board[r][c] === board[r][c+1] && board[r][c] === board[r][c+2]) {
                    toRemove[r][c] = true;
                    toRemove[r][c+1] = true;
                    toRemove[r][c+2] = true;
                    hasMatches = true;
                }
            }
        }
        
        // Проверка по вертикали
        for (let c = 0; c < cols; c++) {
            for (let r = 0; r < rows - 2; r++) {
                if (board[r][c] === board[r+1][c] && board[r][c] === board[r+2][c]) {
                    toRemove[r][c] = true;
                    toRemove[r+1][c] = true;
                    toRemove[r+2][c] = true;
                    hasMatches = true;
                }
            }
        }
        
        // Удаление совпадений
        if (hasMatches) {
            let scoreIncrease = 0;
            
            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    if (toRemove[r][c]) {
                        const tile = document.querySelector(`.tile[data-row="${r}"][data-col="${c}"]`);
                        const gem = tile.querySelector('.gem');
                        
                        gem.classList.add('exploding');
                        scoreIncrease += 100;
                        
                        setTimeout(() => {
                            board[r][c] = -1;
                            gem.classList.remove('exploding');
                            updateTile(r, c);
                        }, 300);
                    }
                }
            }
            
            setTimeout(() => {
                dropGems();
                currentScore += scoreIncrease;
                currentScoreEl.textContent = currentScore;
                
                // Рекурсивная проверка после падения
                setTimeout(() => {
                    if (checkMatches()) {
                        checkGameStatus();
                    }
                }, 500);
            }, 400);
        }
        
        return hasMatches;
    }
    
    // Падение фигур
    function dropGems() {
        const cols = board[0].length;
        const rows = board.length;
        
        for (let c = 0; c < cols; c++) {
            let emptySpaces = 0;
            
            for (let r = rows - 1; r >= 0; r--) {
                if (board[r][c] === -1) {
                    emptySpaces++;
                } else if (emptySpaces > 0) {
                    board[r + emptySpaces][c] = board[r][c];
                    board[r][c] = -1;
                    updateTile(r + emptySpaces, c);
                }
            }
            
            // Заполнение сверху
            for (let r = 0; r < emptySpaces; r++) {
                const colorIndex = Math.floor(Math.random() * gemColors.length);
                board[r][c] = colorIndex;
                updateTile(r, c);
            }
        }
    }
    
    // Проверка статуса игры
    function checkGameStatus() {
        if (movesLeft <= 0) {
            setTimeout(() => {
                gameOverScreen.classList.remove('hidden');
                
                if (currentScore >= targetScore) {
                    resultMessage.textContent = `Уровень ${currentLevel + 1} пройден!`;
                    nextLevelButton.classList.remove('hidden');
                } else {
                    resultMessage.textContent = 'Попробуйте еще раз!';
                    nextLevelButton.classList.add('hidden');
                }
            }, 500);
        }
    }
    
    // Обработчики событий
    document.querySelectorAll('.levels button').forEach(button => {
        button.addEventListener('click', () => {
            const level = parseInt(button.dataset.level) - 1;
            levelScreen.classList.add('hidden');
            gameScreen.classList.remove('hidden');
            initGame(level);
        });
    });
    
    document.getElementById('back-to-menu').addEventListener('click', () => {
        gameScreen.classList.add('hidden');
        levelScreen.classList.remove('hidden');
    });
    
    restartButton.addEventListener('click', () => {
        gameOverScreen.classList.add('hidden');
        initGame(currentLevel);
    });
    
    nextLevelButton.addEventListener('click', () => {
        if (currentLevel < levels.length - 1) {
            gameOverScreen.classList.add('hidden');
            initGame(currentLevel + 1);
        } else {
            gameOverScreen.classList.add('hidden');
            gameScreen.classList.add('hidden');
            levelScreen.classList.remove('hidden');
        }
    });
});
