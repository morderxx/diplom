// tictactoe.js

document.addEventListener('DOMContentLoaded', () => {
  const chatGlobals = window._chatGlobals;
  if (!chatGlobals || !chatGlobals.socket) {
    console.error('Socket is not available yet.');
    return;
  }

  // Глобальные переменные через window._chatGlobals
  const socket       = chatGlobals.socket;
  const userNickname = chatGlobals.userNickname;
  let currentRoom    = chatGlobals.currentRoom;
  let currentPeer    = chatGlobals.currentPeer;
  const roomMeta     = chatGlobals.roomMeta;

  // UI элементы
  const gameModal         = document.getElementById('game-modal');
  const openGameBtn       = document.getElementById('open-game-btn');
  const closeGameBtn      = document.getElementById('close-game-btn');
  const modeOnlineBtn     = document.getElementById('mode-online');
  const modeBotBtn        = document.getElementById('mode-bot');
  const resetGameBtn      = document.getElementById('reset-game-btn');
  const gameBoardEl       = document.getElementById('game-board');
  const gameStatusEl      = document.getElementById('game-status');
  const onlineSelectEl    = document.getElementById('online-select');
  const onlineUsersList   = document.getElementById('online-users-list');
  const onlineGameSection = document.getElementById('online-game');
  const cancelOnlineBtn   = document.getElementById('cancel-online-btn');

  // Состояние игры
  let gameMode = null;
  let board = [];
  let myMark = 'X';
  let turn   = 'X';

  // Открыть/закрыть модалку
  openGameBtn.onclick  = () => gameModal.classList.remove('hidden');
  closeGameBtn.onclick = () => {
    gameModal.classList.add('hidden');
    onlineSelectEl.classList.remove('active');
    onlineGameSection.classList.remove('active');
  };

  // Кнопка "Против бота"
  modeBotBtn.onclick = () => {
    setupGameSection('bot');
    startGame('bot');
  };

  // Кнопка "Онлайн"
  modeOnlineBtn.onclick = () => {
    if (!chatGlobals.currentRoom) {
      return alert('Сначала выберите чат для игры онлайн');
    }

    onlineUsersList.innerHTML = '';
    Object.entries(roomMeta).forEach(([roomId, m]) => {
      if (!m.is_group && !m.is_channel) {
        const opp = m.members.find(n => n !== userNickname);
        const li  = document.createElement('li');
        li.textContent = opp;
        li.onclick = () => inviteToPlay(opp, roomId);
        onlineUsersList.appendChild(li);
      }
    });

    onlineSelectEl.classList.add('active');
    onlineGameSection.classList.remove('active');
  };

  // Кнопка отмены выбора соперника
  cancelOnlineBtn.onclick = () => {
    onlineSelectEl.classList.remove('active');
  };

  // Приглашение в игру
  function inviteToPlay(opponent, roomId) {
    currentPeer = opponent;
    currentRoom = roomId;
    chatGlobals.currentPeer = opponent;
    chatGlobals.currentRoom = roomId;
    socket.send(JSON.stringify({
      type:   'tictactoe-invite',
      roomId,
      from:   userNickname,
      to:     opponent
    }));
    onlineSelectEl.innerHTML = '<p>Ожидаем, пока соперник примет приглашение…</p>';
  }

  // Обработка сообщений WebSocket
  socket.addEventListener('message', ev => {
    const msg = JSON.parse(ev.data);

    if (msg.type === 'tictactoe-invite' && msg.to === userNickname) {
      if (confirm(`Пользователь ${msg.from} приглашает вас сыграть. Принять?`)) {
        socket.send(JSON.stringify({
          type:   'tictactoe-accept',
          roomId: msg.roomId,
          from:   userNickname,
          to:     msg.from
        }));
        setupOnlineGame(msg.from, msg.roomId, true);
      }
      return;
    }

    if (msg.type === 'tictactoe-accept' && msg.to === userNickname) {
      setupOnlineGame(msg.from, msg.roomId, false);
      return;
    }

    if (msg.type === 'tictactoe-move' && gameMode === 'online' && msg.from !== userNickname) {
      makeMove(msg.index, turn);
      return;
    }
  });

  // Общая инициализация секции
  function setupGameSection(mode) {
    gameModal.classList.remove('hidden');
    onlineSelectEl.classList.remove('active');
    onlineGameSection.classList.add('active');
    document.getElementById('mode-online').disabled = true;
  }

  // Запуск игры
  function startGame(mode) {
    gameMode = mode;
    resetGame();

    if (mode === 'bot') {
      myMark = 'X';
      turn = 'X';
      gameStatusEl.textContent = 'Против бота. Вы X. Ваш ход.';
    }
  }

  // Онлайн-режим
  function setupOnlineGame(opponent, roomId, youAreO) {
    setupGameSection('online');
    gameMode = 'online';
    currentPeer = opponent;
    currentRoom = roomId;
    chatGlobals.currentPeer = opponent;
    chatGlobals.currentRoom = roomId;
    myMark = youAreO ? 'O' : 'X';
    turn = 'X';
    resetGame();
    gameStatusEl.textContent = `Вы за ${myMark}. Ходит ${turn}.`;
  }

  // Сброс доски
  function resetGame() {
    board = Array(9).fill(null);
    gameBoardEl.innerHTML = '';
    for (let i = 0; i < 9; i++) {
      const cell = document.createElement('div');
      cell.className = 'game-cell';
      cell.dataset.i = i;
      cell.onclick = onCellClick;
      gameBoardEl.appendChild(cell);
    }

    if (gameMode === 'bot' && myMark !== 'X') botMove();
  }

  resetGameBtn.onclick = () => resetGame();

  // Клик по клетке
  function onCellClick(e) {
    const i = +e.target.dataset.i;
    if (board[i] || checkWin(board) || turn !== myMark) return;

    makeMove(i, myMark);
    if (gameMode === 'online') {
      socket.send(JSON.stringify({
        type:   'tictactoe-move',
        roomId: currentRoom,
        from:   userNickname,
        index:  i
      }));
    } else {
      if (!checkWin(board) && board.includes(null)) setTimeout(botMove, 300);
    }
  }

  // Выполнение хода
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

  // Ход бота
  function botMove() {
    const free = board.map((v, idx) => v === null ? idx : null).filter(v => v !== null);
    const choice = free[Math.floor(Math.random() * free.length)];
    makeMove(choice, turn);
  }

  // Проверка победы
  function checkWin(bd) {
    const lines = [
      [0,1,2],[3,4,5],[6,7,8],
      [0,3,6],[1,4,7],[2,5,8],
      [0,4,8],[2,4,6]
    ];
    return lines.some(([a,b,c]) => bd[a] && bd[a] === bd[b] && bd[a] === bd[c]);
  }
});
