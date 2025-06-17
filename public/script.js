document.getElementById('show-rules').addEventListener('click', () => {
  document.getElementById('rules-modal').classList.remove('hidden');
});
document.getElementById('close-rules').addEventListener('click', () => {
  document.getElementById('rules-modal').classList.add('hidden');
});

const socket = io();

document.getElementById('start-game').addEventListener('click', () => {
  const roomCode = document.getElementById('room-code').value.trim();
  if (roomCode === '') {
    alert('Por favor, insira o código da sala para iniciar o jogo.');
    return;
  }
  socket.emit('joinRoom', roomCode);
});

socket.on('playerJoined', (players) => {
  if (players.length === 1) {
    alert('Aguardando outro jogador entrar...');
  } else if (players.length === 2) {
    alert('Os dois jogadores estão na sala!');
  }
});

socket.on('startGame', (message) => {
  alert(message);
  document.querySelector('.menu-container').style.display = 'none';
  document.getElementById('setup-panel').style.display = 'flex';
  highlightCurrentShip();
});

socket.on('roomFull', (message) => {
  alert(message);
});

const board = document.getElementById('player-board');
const boardSize = 6;
const shipsToPlace = [
  { type: 'submarino', size: 1, count: 3 },
  { type: 'torpedeiro', size: 2, count: 2 },
  { type: 'porta-aviao', size: 3, count: 1 }
];
let currentShipIndex = 0;
let currentShipPlaced = 0;
let orientation = 'horizontal'; 

const placedShips = [];

board.innerHTML = '';
for (let i = 0; i < 36; i++) {
  const cell = document.createElement('div');
  cell.className = 'cell';
  cell.dataset.index = i;
  cell.addEventListener('click', handleCellClick);
  board.appendChild(cell);
}

document.addEventListener('keydown', (e) => {
  if (e.key.toLowerCase() === 'o') {
    orientation = orientation === 'horizontal' ? 'vertical' : 'horizontal';
    alert('Orientação: ' + orientation);
  }
});

function handleCellClick(e) {
  if (currentShipIndex >= shipsToPlace.length) return;

  const idx = parseInt(e.target.dataset.index);
  const ship = shipsToPlace[currentShipIndex];

  const positions = [];
  for (let i = 0; i < ship.size; i++) {
    let pos;
    if (orientation === 'horizontal') {
      pos = idx + i;
      if (Math.floor(idx / boardSize) !== Math.floor((idx + i) / boardSize)) return;
    } else {
      pos = idx + i * boardSize;
      if (pos >= boardSize * boardSize) return;
    }
    positions.push(pos);
  }

  for (const p of positions) {
    if (placedShips.some(s => s.positions.includes(p))) return;
  }

  for (const p of positions) {
    board.children[p].classList.add('selected');
    board.children[p].classList.add('ship-' + ship.type);
  }

  placedShips.push({ type: ship.type, positions });
  currentShipPlaced++;
  highlightCurrentShip();
  if (currentShipPlaced >= ship.count) {
    currentShipIndex++;
    currentShipPlaced = 0;
    highlightCurrentShip();
  }

  if (currentShipIndex >= shipsToPlace.length) {
    alert('Todos os navios posicionados! Clique em "Confirmar Posições" para continuar.');
  }
}

function highlightCurrentShip() {
  document.querySelectorAll('.ship').forEach(el => el.classList.remove('ship-active'));
  const ship = shipsToPlace[currentShipIndex];
  if (!ship) return;
  const el = document.querySelector(`.ship[data-type="${ship.type}"]`);
  if (el) el.classList.add('ship-active');
}

document.getElementById('confirm-ships').addEventListener('click', () => {
  if (placedShips.length < 6) {
    alert('Posicione todos os navios antes de confirmar!');
    return;
  }
  const roomCode = document.getElementById('room-code').value.trim();
  socket.emit('shipsPlaced', { roomCode, ships: placedShips });
  alert('Navios confirmados! Aguardando o outro jogador...');
});

function generateBoard(boardId, ships, showShips) {
  const board = document.getElementById(boardId);
  board.innerHTML = '';
  for (let i = 0; i < 36; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;

    if (showShips && ships.some(s => s.positions.includes(i))) {
      cell.classList.add('selected');
    }
    board.appendChild(cell);
  }
}

let isMyTurn = false;
let myId = null;

socket.on('bothShipsPlaced', (data) => {
  document.getElementById('setup-panel').style.display = 'none';
  document.getElementById('game-panel').style.display = 'block';

  myId = socket.id;
  isMyTurn = (myId === data.firstTurn);
  document.getElementById('turn-player').textContent = isMyTurn ? 'Você' : 'Oponente';

  generateBoard('my-board', placedShips, true);
  generateBoard('opponent-board', [], false);
  enableAttack();
});

function enableAttack() {
  const opponentBoard = document.getElementById('opponent-board');
  Array.from(opponentBoard.children).forEach(cell => {
    cell.onclick = () => {
      if (!isMyTurn) {
        alert('Aguarde sua vez!');
        return;
      }
      if (cell.classList.contains('hit') || cell.classList.contains('miss')) return;
      const index = parseInt(cell.dataset.index);
      const roomCode = document.getElementById('room-code').value.trim();
      socket.emit('attack', { roomCode, index });
    };
  });
}

socket.on('attackResult', ({ index, hit, sunk, shipType, yourTurn, victory }) => {
  const opponentBoard = document.getElementById('opponent-board');
  const cell = opponentBoard.children[index];
  cell.classList.add(hit ? 'hit' : 'miss');
  if (hit) cell.textContent = '💥';
  isMyTurn = yourTurn;
  document.getElementById('turn-player').textContent = isMyTurn ? 'Você' : 'Oponente';
  if (victory) {
    alert('Você venceu!');
    location.reload(); 
  } else if (hit) {
    alert(sunk ? `Você afundou um ${shipType}! Jogue novamente.` : 'Acertou! Jogue novamente.');
  } else {
    alert('Errou!');
  }
});

socket.on('attacked', ({ index, hit, sunk, shipType, yourTurn, defeat }) => {
  const myBoard = document.getElementById('my-board');
  const cell = myBoard.children[index];
  cell.classList.add(hit ? 'hit' : 'miss');
  if (hit) cell.textContent = '💥';
  isMyTurn = yourTurn;
  document.getElementById('turn-player').textContent = isMyTurn ? 'Você' : 'Oponente';
  if (defeat) {
    alert('Você perdeu!');
    location.reload(); 
  } else if (hit) {
    alert(sunk ? `Seu ${shipType} foi afundado!` : 'Seu navio foi atingido!');
  } else {
    alert('O oponente errou!');
  }
});