// Простая змейка на canvas
const canvas = document.getElementById('game');
const ctx    = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
let dir = { x:1, y:0 }, nextDir = dir;
let snake = [{ x:10, y:10 }];
let food  = {};
let score = 0;
const grid = 20, tickRate = 100;

function placeFood() {
  food = {
    x: Math.floor(Math.random() * (canvas.width/grid)),
    y: Math.floor(Math.random() * (canvas.height/grid))
  };
}

function draw() {
  ctx.fillStyle = '#111';
  ctx.fillRect(0,0,canvas.width,canvas.height);
  // еда
  ctx.fillStyle = 'red';
  ctx.fillRect(food.x*grid, food.y*grid, grid, grid);
  // змейка
  ctx.fillStyle = 'lime';
  snake.forEach(p=> ctx.fillRect(p.x*grid,p.y*grid,grid-1,grid-1));
}

function update() {
  dir = nextDir;
  const head = { x: snake[0].x+dir.x, y: snake[0].y+dir.y };
  // границы
  if (head.x<0||head.x>=canvas.width/grid||head.y<0||head.y>=canvas.height/grid
      || snake.some(s=>s.x===head.x&&s.y===head.y)) {
    gameOver(); return;
  }
  snake.unshift(head);
  if (head.x===food.x && head.y===food.y) {
    score++;
    scoreEl.textContent = 'Счёт: '+score;
    placeFood();
  } else {
    snake.pop();
  }
  draw();
}

let timer;
function gameLoop() {
  clearInterval(timer);
  timer = setInterval(update, tickRate);
}
function gameOver() {
  clearInterval(timer);
  alert('Игра окончена! Ваш счёт: '+score);
}

document.addEventListener('keydown', e=>{
  const map = {ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
  if (map[e.key]) {
    const [x,y] = map[e.key];
    // запрет на развернуться на 180°
    if (x!==-dir.x && y!==-dir.y) nextDir = {x,y};
  }
});

document.getElementById('restart').onclick = ()=>{
  snake=[{x:10,y:10}]; dir={x:1,y:0}; nextDir=dir; score=0; scoreEl.textContent='Счёт: 0';
  placeFood(); draw(); gameLoop();
};

document.getElementById('share').onclick = async () => {
  // шлём результат на сервер
  try {
    const res = await fetch('/api/games/snake/score', {
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ score })
    });
    if (res.ok) alert('Результат отправлен!');
    else alert('Ошибка отправки');
  } catch (err) {
    console.error(err);
    alert('Сетевая ошибка');
  }
};

// инициализация
placeFood(); draw(); gameLoop();
