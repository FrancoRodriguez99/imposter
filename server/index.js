import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import mongoose from 'mongoose';
import { words } from './words.js';
import Connection from './models/Connection.js';
import Game from './models/Game.js';

// ── MongoDB ────────────────────────────────────────────────
mongoose.connect('mongodb://127.0.0.1:27017/imposter')
  .then(() => console.log('[DB] Connected to MongoDB'))
  .catch(err => console.warn('[DB] MongoDB unavailable — analytics disabled:', err.message));

function db(promise) {
  promise.catch(err => console.error('[DB]', err.message));
}

// ── Device detection (no deps) ────────────────────────────
function parseDevice(ua = '') {
  const bot    = /bot|crawler|spider|scraper/i.test(ua);
  const tablet = /iPad|Tablet|PlayBook/i.test(ua) && !/Mobile/i.test(ua);
  const mobile = !tablet && /Mobile|Android|iPhone|iPod|Windows Phone/i.test(ua);

  let os = 'Unknown';
  if (/iPhone|iPad|iPod/.test(ua))    os = 'iOS';
  else if (/Android/.test(ua))        os = 'Android';
  else if (/Windows NT/.test(ua))     os = 'Windows';
  else if (/Mac OS X/.test(ua))       os = 'macOS';
  else if (/Linux/.test(ua))          os = 'Linux';

  let browser = 'Unknown';
  if (/Edg\//.test(ua))              browser = 'Edge';
  else if (/OPR\/|Opera/.test(ua))   browser = 'Opera';
  else if (/Chrome\//.test(ua))      browser = 'Chrome';
  else if (/Firefox\//.test(ua))     browser = 'Firefox';
  else if (/Safari\//.test(ua))      browser = 'Safari';

  return {
    browser,
    os,
    deviceType: bot ? 'bot' : tablet ? 'tablet' : mobile ? 'mobile' : 'desktop',
  };
}

// ── Express + Socket.io ───────────────────────────────────
const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: '*', methods: ['GET', 'POST'] },
});

const rooms = new Map();

function generateRoomId() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) id += chars[Math.floor(Math.random() * chars.length)];
  return id;
}

function sanitizePlayers(room) {
  return room.players.map(({ id, name, isHost }) => ({ id, name, isHost }));
}

// ── Socket events ──────────────────────────────────────────
io.on('connection', (socket) => {
  const h = socket.handshake;
  const ip = (h.headers['x-forwarded-for'] || h.address || '').split(',')[0].trim();
  const ua = h.headers['user-agent'] || '';
  const device = parseDevice(ua);

  socket.data.ip     = ip;
  socket.data.device = device;
  socket.data.connAt = Date.now();

  db(
    Connection.create({
      socketId: socket.id,
      ip,
      userAgent: ua,
      ...device,
      acceptLanguage: h.headers['accept-language'] || '',
    }).then(doc => { socket.data.connectionId = doc._id; })
  );

  console.log(`[+] ${socket.id} connected (${device.deviceType}, ${device.os})`);

  // ── create-room ──────────────────────────────────────────
  socket.on('create-room', ({ name }) => {
    if (!name?.trim()) return;

    let roomId;
    do { roomId = generateRoomId(); } while (rooms.has(roomId));

    const room = {
      id: roomId,
      host: socket.id,
      players: [{
        id: socket.id, name: name.trim(), isHost: true,
        ip, ...device,
      }],
      state: 'lobby',
    };

    rooms.set(roomId, room);
    socket.join(roomId);
    socket.data.roomId = roomId;

    db(Connection.updateOne(
      { socketId: socket.id },
      { $addToSet: { roomsVisited: roomId } }
    ));

    socket.emit('room-created', { roomId });
    io.to(roomId).emit('room-update', { players: sanitizePlayers(room) });
    console.log(`[${roomId}] Created by "${name}"`);
  });

  // ── join-room ────────────────────────────────────────────
  socket.on('join-room', ({ roomId, name }) => {
    if (!roomId?.trim() || !name?.trim()) return;

    const id = roomId.trim().toUpperCase();
    const room = rooms.get(id);

    if (!room) {
      socket.emit('error-msg', { message: 'Room not found. Check the code and try again.' });
      return;
    }
    if (room.state === 'playing') {
      socket.emit('error-msg', { message: 'Game already in progress.' });
      return;
    }
    if (room.players.length >= 12) {
      socket.emit('error-msg', { message: 'Room is full (max 12 players).' });
      return;
    }

    room.players.push({ id: socket.id, name: name.trim(), isHost: false, ip, ...device });
    socket.join(id);
    socket.data.roomId = id;

    db(Connection.updateOne(
      { socketId: socket.id },
      { $addToSet: { roomsVisited: id } }
    ));

    socket.emit('room-joined', { roomId: id });
    io.to(id).emit('room-update', { players: sanitizePlayers(room) });
    console.log(`[${id}] "${name}" joined (${room.players.length} players)`);
  });

  // ── start-game ───────────────────────────────────────────
  socket.on('start-game', ({ roomId, impostorCount, randomCount, showImpostors, wordLang }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    if (room.players.length < 2) {
      socket.emit('error-msg', { message: 'Need at least 2 players to start.' });
      return;
    }

    const maxCount  = Math.max(1, Math.min(Number(impostorCount), room.players.length - 1));
    const finalCount = randomCount
      ? Math.floor(Math.random() * maxCount) + 1
      : maxCount;

    const wordList        = words[wordLang] || words.en;
    const wordObj         = wordList[Math.floor(Math.random() * wordList.length)];
    const shuffled        = [...room.players].sort(() => Math.random() - 0.5);
    const impostorPlayers = shuffled.slice(0, finalCount);
    const impostorIds     = new Set(impostorPlayers.map(p => p.id));
    const firstPlayer     = room.players[Math.floor(Math.random() * room.players.length)];

    room.state       = 'playing';
    room.word        = wordObj.word;
    room.impostors   = impostorPlayers.map(p => ({ name: p.name }));
    room.firstPlayer = firstPlayer.name;
    room.startedAt   = new Date();
    room.settings    = { impostorCount: finalCount, randomCount: !!randomCount, showImpostors: !!showImpostors };
    room.votes       = {};
    room.eliminated  = new Set();

    db(
      Game.create({
        roomId,
        word: wordObj.word,
        settings: room.settings,
        firstPlayer: firstPlayer.name,
        totalPlayers: room.players.length,
        players: room.players.map(p => ({
          name: p.name, socketId: p.id, ip: p.ip,
          browser: p.browser, os: p.os, deviceType: p.deviceType,
          isHost: p.isHost,
          isImpostor: impostorIds.has(p.id),
        })),
        impostors: room.impostors,
      }).then(doc => {
        room.gameId = doc._id;
        Connection.updateMany(
          { socketId: { $in: room.players.map(p => p.id) } },
          { $inc: { gamesPlayed: 1 } }
        ).catch(() => {});
      })
    );

    room.players.forEach((player) => {
      const isImpostor = impostorIds.has(player.id);
      const teammates  = (showImpostors && isImpostor)
        ? impostorPlayers.filter(p => p.id !== player.id).map(p => p.name)
        : null;

      io.to(player.id).emit('game-started', {
        role: isImpostor ? 'impostor' : 'innocent',
        word: isImpostor ? null : wordObj.word,
        hint: isImpostor ? wordObj.hint : null,
        players: sanitizePlayers(room),
        impostorCount: finalCount,
        firstPlayer: firstPlayer.name,
        teammates,
        myName: player.name,
      });
    });

    const countLabel = randomCount ? `${finalCount} (random, max ${maxCount})` : String(finalCount);
    console.log(`[${roomId}] Game started — word: "${wordObj.word}", impostors: ${countLabel}, first: "${firstPlayer.name}"`);
  });

  // ── end-round ────────────────────────────────────────────
  socket.on('end-round', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    room.state = 'gameover';

    const endedAt        = new Date();
    const durationSeconds = room.startedAt
      ? Math.round((endedAt - room.startedAt) / 1000)
      : null;

    db(Game.findByIdAndUpdate(room.gameId, {
      endedAt, durationSeconds, winner: null, endReason: 'host-ended',
    }));

    io.to(roomId).emit('round-ended', { word: room.word, impostors: room.impostors });
    console.log(`[${roomId}] Round ended by host`);
  });

  // ── cast-vote ────────────────────────────────────────────
  socket.on('cast-vote', ({ roomId, targetId }) => {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'playing') return;

    const voter = room.players.find(p => p.id === socket.id);
    if (!voter || room.eliminated.has(socket.id)) return;
    if (room.impostors.some(imp => imp.name === voter.name)) return;

    if (room.votes[socket.id] === targetId) {
      delete room.votes[socket.id];
    } else {
      room.votes[socket.id] = targetId;
    }

    const activePlayers = room.players.filter(p => !room.eliminated.has(p.id));
    const threshold = Math.floor(activePlayers.length / 2) + 1;

    const tally = {};
    for (const [vid, tid] of Object.entries(room.votes)) {
      if (!room.eliminated.has(vid) && activePlayers.some(p => p.id === tid)) {
        const target = room.players.find(p => p.id === tid);
        if (target) tally[target.name] = (tally[target.name] || 0) + 1;
      }
    }

    const toNames = ids => [...ids].map(id => room.players.find(p => p.id === id)?.name).filter(Boolean);

    io.to(roomId).emit('vote-update', {
      votes: tally,
      eliminated: toNames(room.eliminated),
      threshold,
      totalActive: activePlayers.length,
    });

    const elimEntry = Object.entries(tally).find(([, count]) => count >= threshold);
    if (!elimEntry) return;

    const [elimName] = elimEntry;
    const elimPlayer = room.players.find(p => p.name === elimName);
    if (!elimPlayer) return;

    room.eliminated.add(elimPlayer.id);
    room.votes = {};

    const wasImpostor = room.impostors.some(imp => imp.name === elimName);
    const eliminatedNames = toNames(room.eliminated);

    io.to(roomId).emit('player-eliminated', { playerName: elimName, wasImpostor, eliminatedNames });

    const activeAfter     = room.players.filter(p => !room.eliminated.has(p.id));
    const activeImpostors = activeAfter.filter(p => room.impostors.some(imp => imp.name === p.name));
    const activeInnocents = activeAfter.filter(p => !room.impostors.some(imp => imp.name === p.name));
    const newThreshold    = Math.floor(activeAfter.length / 2) + 1;

    io.to(roomId).emit('vote-update', {
      votes: {},
      eliminated: eliminatedNames,
      threshold: newThreshold,
      totalActive: activeAfter.length,
    });

    let winner    = null;
    let endReason = null;

    if (activeImpostors.length === 0) {
      winner = 'innocents'; endReason = 'all-impostors-eliminated';
    } else if (activeImpostors.length >= activeInnocents.length) {
      winner = 'impostors'; endReason = 'impostors-majority';
    }

    if (winner) {
      room.state = 'gameover';
      const endedAt         = new Date();
      const durationSeconds = room.startedAt ? Math.round((endedAt - room.startedAt) / 1000) : null;

      db(Game.findByIdAndUpdate(room.gameId, { endedAt, durationSeconds, winner, endReason }));

      io.to(roomId).emit('game-over', { word: room.word, impostors: room.impostors, winner, endReason });
      console.log(`[${roomId}] Game over — ${winner} win (${endReason})`);
    }

    console.log(`[${roomId}] ${elimName} eliminated (wasImpostor: ${wasImpostor})`);
  });

  // ── guess-word ───────────────────────────────────────────
  socket.on('guess-word', ({ roomId, guess }) => {
    const room = rooms.get(roomId);
    if (!room || room.state !== 'playing') return;

    const correct = guess.trim().toLowerCase() === room.word.toLowerCase();
    if (correct) {
      room.state = 'gameover';

      const endedAt         = new Date();
      const durationSeconds = room.startedAt
        ? Math.round((endedAt - room.startedAt) / 1000)
        : null;

      db(Game.findByIdAndUpdate(room.gameId, {
        endedAt, durationSeconds, winner: 'impostors',
        endReason: 'impostor-guess', impostorGuess: guess.trim(),
      }));

      io.to(roomId).emit('game-over', {
        word: room.word,
        impostors: room.impostors,
        firstPlayer: room.firstPlayer,
        winner: 'impostors',
        endReason: 'impostor-guess',
      });
      console.log(`[${roomId}] Impostor guessed correctly: "${guess}"`);
    } else {
      socket.emit('guess-wrong', { guess: guess.trim() });
      console.log(`[${roomId}] Wrong guess: "${guess}"`);
    }
  });

  // ── restart-game ─────────────────────────────────────────
  socket.on('restart-game', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (!room || room.host !== socket.id) return;
    room.state = 'lobby';
    delete room.word;
    delete room.impostors;
    delete room.firstPlayer;
    delete room.gameId;
    delete room.startedAt;
    delete room.settings;
    delete room.votes;
    delete room.eliminated;
    io.to(roomId).emit('game-restarted');
    console.log(`[${roomId}] Restarted`);
  });

  // ── disconnect ───────────────────────────────────────────
  socket.on('disconnect', () => {
    const sessionSeconds = Math.round((Date.now() - socket.data.connAt) / 1000);
    db(Connection.findByIdAndUpdate(socket.data.connectionId, {
      disconnectedAt: new Date(), sessionSeconds,
    }));

    const roomId = socket.data.roomId;
    if (!roomId) return;

    const room = rooms.get(roomId);
    if (!room) return;

    room.players = room.players.filter(p => p.id !== socket.id);

    if (room.players.length === 0) {
      rooms.delete(roomId);
      console.log(`[${roomId}] Deleted (empty)`);
      return;
    }

    if (room.host === socket.id) {
      room.host = room.players[0].id;
      room.players[0].isHost = true;
      console.log(`[${roomId}] Host reassigned to "${room.players[0].name}"`);
    }

    io.to(roomId).emit('room-update', { players: sanitizePlayers(room) });
    console.log(`[${roomId}] Player left — ${room.players.length} remaining`);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Impostor server listening on :${PORT}`);
});
