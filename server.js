const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = 5500;
const rooms = {};

app.use(express.static('public'));

io.on('connection', (socket) => {
  console.log('Novo jogador conectado:', socket.id);

  socket.on('joinRoom', (roomCode) => {
    if (!rooms[roomCode]) {
      rooms[roomCode] = { players: [], ships: {} };
    }
    if (rooms[roomCode].players.length < 2) {
      rooms[roomCode].players.push(socket.id);
      socket.join(roomCode);
      io.to(roomCode).emit('playerJoined', rooms[roomCode].players);
      if (rooms[roomCode].players.length === 2) {
        io.to(roomCode).emit('startGame', 'Posicione seus navios!');
      }
    } else {
      socket.emit('roomFull', 'A sala está cheia.');
    }
  });

  socket.on('shipsPlaced', ({ roomCode, ships }) => {
    if (rooms[roomCode]) {
      rooms[roomCode].ships[socket.id] = ships;
      if (
        rooms[roomCode].players.length === 2 &&
        Object.keys(rooms[roomCode].ships).length === 2
      ) {
        // Sorteia quem começa
        rooms[roomCode].turn = Math.floor(Math.random() * 2);
        io.to(roomCode).emit('bothShipsPlaced', {
          msg: 'Ambos jogadores posicionaram seus navios!',
          firstTurn: rooms[roomCode].players[rooms[roomCode].turn]
        });
      }
    }
  });

  socket.on('attack', ({ roomCode, index }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const attackerIdx = room.players.indexOf(socket.id);
    if (attackerIdx !== room.turn) return;

    const defenderIdx = 1 - attackerIdx;
    const defenderId = room.players[defenderIdx];
    const defenderShips = room.ships[defenderId];

    let hit = false;
    let sunk = false;
    let shipType = null;
    for (const ship of defenderShips) {
      if (ship.positions.includes(index)) {
        hit = true;
        shipType = ship.type;
        ship.positions = ship.positions.filter(pos => pos !== index);
        if (ship.positions.length === 0) sunk = true;
        break;
      }
    }

    const allSunk = defenderShips.every(ship => ship.positions.length === 0);

    if (!hit && !allSunk) {
      room.turn = defenderIdx;
    }

    io.to(socket.id).emit('attackResult', { index, hit, sunk, shipType, yourTurn: hit && !allSunk, victory: allSunk });
    io.to(defenderId).emit('attacked', { index, hit, sunk, shipType, yourTurn: !hit && !allSunk, defeat: allSunk });

    if (allSunk) {
      delete rooms[roomCode];
    }
  });

  socket.on('disconnect', () => {
    for (const roomCode in rooms) {
      const room = rooms[roomCode];
      if (!room.players) continue;
      room.players = room.players.filter((id) => id !== socket.id);
      if (room.ships) delete room.ships[socket.id];
      if (room.players.length === 0) delete rooms[roomCode];
    }
  });
});

server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT}`);
});