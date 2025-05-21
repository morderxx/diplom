// tictactoe.js

document.addEventListener('DOMContentLoaded', () => {
  // Основные UI-элементы
  const openGameBtn    = document.getElementById('open-game-btn');
  const closeGameBtn   = document.getElementById('close-game-btn');
  const modeOnlineBtn  = document.getElementById('mode-online');
  const modeBotBtn     = document.getElementById('mode-bot');
  const resetGameBtn   = document.getElementById('reset-game-btn');
  const gameModal      = document.getElementById('game-modal');
  const onlineSelectEl = document.getElementById('online-select');
  const onlineGameEl   = document.getElementById('online-game');
  const gameBoardEl    = document.getElementById('game-board');
  const gameStatusEl   = document.getElementById('game-status');
  const onlineUsersList= document.getElementById('online-users-list');

  let gameMode, board, myMark, turn;

  // Общая инициализация доски
  function initBoard() {
    board = Array(9).fill(null);
    gameBoardEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'game-cell';
      cell.dataset.i = i;
      cell.onclick = onCellClick;
      gameBoardEl.appendChild(cell);
    }
  }

  function onCellClick(e) {
    const i = +e.target.dataset.i;
    if (board[i] || checkWin(board) || turn !== myMark) return;
    makeMove(i, myMark);
    if (gameMode === 'bot') {
      if (!checkWin(board) && board.includes(null)) setTimeout(botMove, 300);
    } else {
      // здесь оставляем ваш старый код отправки по socket, но он не даст ошибку
      const chatGlobals = window._chatGlobals;
      if (chatGlobals && chatGlobals.socket && chatGlobals.currentRoom) {
        chatGlobals.socket.send(JSON.stringify({
          type: 'tictactoe-move',
          roomId: chatGlobals.currentRoom,
          from: chatGlobals.userNickname,
          index: i
        }));
      }
    }
  }

  function makeMove(i, mark) {
    board[i] = mark;
    const cell = gameBoardEl.querySelector(`.game-cell[data-i="${i}"]`);
    cell.textContent = mark;
    if (checkWin(board)) {
      gameStatusEl.textContent = `Выиграли ${mark}!`;
    } else if (!board.includes(null)) {
      gameStatusEl.textContent = 'Ничья.';
    } else {
      turn = mark === 'X' ? 'O' : 'X';
      gameStatusEl.textContent = `Ходит ${turn}.`;
    }
  }

  function botMove() {
    const free = board.map((v,i) => v===null?i:null).filter(v=>v!==null);
    const choice = free[Math.floor(Math.random()*free.length)];
    makeMove(choice, turn);
  }

  function checkWin(b) {
    return [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]]
      .some(([a,b2,c]) => b[a] && b[a]===b[b2] && b[a]===b[c]);
  }

  // Переключение в бот-режим
  modeBotBtn.onclick = () => {
    gameMode = 'bot';
    myMark   = 'X';
    turn     = 'X';
    gameStatusEl.textContent = 'Против бота. Вы X. Ваш ход.';
    initBoard();
    openModal();
  };

  // Переключение в онлайн-режим
  modeOnlineBtn.onclick = () => {
    const chatGlobals = window._chatGlobals;
    if (!chatGlobals || !chatGlobals.socket || !chatGlobals.currentRoom) {
      return alert('Онлайн-режим доступен только внутри чата.');
    }
    // Здесь ваш прежний код online: show users, invite, setup game и т.д.
    // ...
  };

  // Кнопка «Новая игра»
  resetGameBtn.onclick = () => {
    if (gameMode === 'bot') {
      myMark = 'X';
      turn   = 'X';
      gameStatusEl.textContent = 'Против бота. Вы X. Ваш ход.';
      initBoard();
    } else {
      // ваш прежний reset для онлайн
      initBoard();
    }
  };

  // Управление модалкой
  openGameBtn.onclick = openModal;
  closeGameBtn.onclick = closeModal;
  function openModal() {
    gameModal.classList.remove('hidden');
    onlineSelectEl.classList.toggle('active', gameMode === 'online');
    onlineGameEl.classList.toggle('active', gameMode !== 'online');
  }
  function closeModal() {
    gameModal.classList.add('hidden');
  }

  // Блокировка кнопки «Онлайн» до появления socket
  setTimeout(() => {
    if (!(window._chatGlobals && window._chatGlobals.socket && window._chatGlobals.currentRoom)) {
      modeOnlineBtn.disabled = true;
    }
  }, 500);

  // Инициализация пустой доски (на случай, если пользователь сразу нажал «Новая игра»)
  initBoard();
});
