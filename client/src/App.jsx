import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useI18n } from './i18n/I18nContext.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';

function getServerUrl() {
  return window.location.origin;
}

const SESSION_KEY = 'imposter-session';

function loadSession() {
  try {
    const s = localStorage.getItem(SESSION_KEY);
    return s ? JSON.parse(s) : null;
  } catch { return null; }
}
function saveSession(roomId, name) {
  try { localStorage.setItem(SESSION_KEY, JSON.stringify({ roomId, name })); } catch {}
}
function clearSession() {
  try { localStorage.removeItem(SESSION_KEY); } catch {}
}

const LANGS = [
  { code: 'en', flag: '🇬🇧' },
  { code: 'es', flag: '🇪🇸' },
  { code: 'it', flag: '🇮🇹' },
];

function LangSwitcher() {
  const { lang, setLanguage } = useI18n();
  return (
    <div className="lang-switcher">
      {LANGS.map(({ code, flag }) => (
        <button
          key={code}
          className={`lang-btn ${lang === code ? 'lang-active' : ''}`}
          onClick={() => setLanguage(code)}
          title={code.toUpperCase()}
        >
          {flag}
        </button>
      ))}
    </div>
  );
}

const hasSavedSession = !!loadSession();

export default function App() {
  const [page, setPage]             = useState(hasSavedSession ? 'reconnecting' : 'home');
  const [roomId, setRoomId]         = useState('');
  const [isHost, setIsHost]         = useState(false);
  const [players, setPlayers]       = useState([]);
  const [gameData, setGameData]     = useState(null);
  const [gameOver, setGameOver]     = useState(null);
  const [roundEnded, setRoundEnded] = useState(null);
  const [guessWrong, setGuessWrong] = useState(false);
  const [error, setError]           = useState('');
  const [playerName, setPlayerName] = useState('');
  const [voteData, setVoteData]     = useState({ votes: {}, eliminated: [], threshold: 2 });
  const [myVote, setMyVote]         = useState(null);
  const [elimNotice, setElimNotice] = useState(null);

  const socketRef      = useRef(null);
  const elimTimerRef   = useRef(null);
  const savedSessionRef = useRef(loadSession()); // consumed once on first connect
  const roomIdRef      = useRef('');
  const playerNameRef  = useRef('');

  useEffect(() => { roomIdRef.current    = roomId;     }, [roomId]);
  useEffect(() => { playerNameRef.current = playerName; }, [playerName]);

  const initialRoomCode = new URLSearchParams(window.location.search).get('room') || '';

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(''), 3500);
  }, []);

  useEffect(() => {
    const socket = io(getServerUrl());
    socketRef.current = socket;

    // ── Reconnection: fires on initial connect AND every re-connect ──
    socket.on('connect', () => {
      // On first connect: use saved localStorage session (page-reload scenario)
      const saved = savedSessionRef.current;
      if (saved) {
        savedSessionRef.current = null; // consume once
        socket.emit('rejoin-room', { roomId: saved.roomId, name: saved.name });
        return;
      }
      // On mid-session reconnect: use current room state (socket drop scenario)
      if (roomIdRef.current && playerNameRef.current) {
        socket.emit('rejoin-room', { roomId: roomIdRef.current, name: playerNameRef.current });
      }
    });

    socket.on('rejoin-success', ({ roomId, state, isHost, players: pl, gameData: gd, voteData: vd }) => {
      setRoomId(roomId);
      setIsHost(isHost);
      setPlayers(pl || []);

      if (state === 'playing' && gd) {
        const name = gd.myName || '';
        setPlayerName(name);
        setGameData(prev => {
          // If already in-game with same role, don't reset (avoids re-showing reveal gate)
          if (prev?.role === gd.role) return { ...gd, players: gd.players };
          return gd;
        });
        setVoteData(vd || { votes: {}, eliminated: [], threshold: 2 });
        setMyVote(null);
        setElimNotice(null);
        setPage('game');
        saveSession(roomId, name);
      } else {
        setPage('lobby');
      }
    });

    socket.on('rejoin-failed', () => {
      clearSession();
      setPage('home');
    });

    // ── Normal room events ────────────────────────────────────
    socket.on('room-created', ({ roomId }) => {
      setRoomId(roomId);
      setIsHost(true);
      setPage('lobby');
      saveSession(roomId, playerNameRef.current);
    });

    socket.on('room-joined', ({ roomId }) => {
      setRoomId(roomId);
      setIsHost(false);
      setPage('lobby');
      saveSession(roomId, playerNameRef.current);
    });

    socket.on('room-update', ({ players }) => setPlayers(players));

    socket.on('game-started', (data) => {
      const name = data.myName || playerNameRef.current;
      setPlayerName(name);
      setVoteData({ votes: {}, eliminated: [], threshold: 2 });
      setMyVote(null);
      setElimNotice(null);
      setGameData(data);
      setPage('game');
      saveSession(roomIdRef.current, name);
    });

    socket.on('vote-update', (data) => setVoteData(data));

    socket.on('player-eliminated', ({ playerName: pn, wasImpostor, eliminatedNames }) => {
      setVoteData(prev => ({ ...prev, eliminated: eliminatedNames, votes: {} }));
      setMyVote(null);
      if (elimTimerRef.current) clearTimeout(elimTimerRef.current);
      setElimNotice({ playerName: pn, wasImpostor });
      elimTimerRef.current = setTimeout(() => setElimNotice(null), 3500);
    });

    socket.on('round-ended', (data) => setRoundEnded(data));
    socket.on('game-over',   (data) => setGameOver(data));

    socket.on('guess-wrong', () => {
      setGuessWrong(true);
      setTimeout(() => setGuessWrong(false), 2000);
    });

    socket.on('game-restarted', () => {
      setGameData(null);
      setGameOver(null);
      setRoundEnded(null);
      setVoteData({ votes: {}, eliminated: [], threshold: 2 });
      setMyVote(null);
      setElimNotice(null);
      setPage('lobby');
    });

    socket.on('error-msg', ({ message }) => showError(message));

    return () => {
      socket.disconnect();
      if (elimTimerRef.current) clearTimeout(elimTimerRef.current);
    };
  }, [showError]);

  const createRoom = (name) => {
    setPlayerName(name);
    playerNameRef.current = name;
    socketRef.current?.emit('create-room', { name });
  };
  const joinRoom = (code, name) => {
    setPlayerName(name);
    playerNameRef.current = name;
    socketRef.current?.emit('join-room', { roomId: code.toUpperCase(), name });
  };
  const startGame   = (count, opts = {}) => socketRef.current?.emit('start-game',   { roomId, impostorCount: count, ...opts });
  const restartGame = ()                  => socketRef.current?.emit('restart-game', { roomId });
  const endRound    = ()                  => socketRef.current?.emit('end-round',    { roomId });
  const guessWord   = (guess)             => socketRef.current?.emit('guess-word',   { roomId, guess });

  const castVote = (targetId, targetName) => {
    const newVote = myVote === targetName ? null : targetName;
    setMyVote(newVote);
    socketRef.current?.emit('cast-vote', { roomId, targetId });
  };

  const leaveRoom = () => {
    socketRef.current?.emit('leave-room', { roomId });
    clearSession();
    setRoomId('');
    setIsHost(false);
    setPlayers([]);
    setGameData(null);
    setGameOver(null);
    setRoundEnded(null);
    setVoteData({ votes: {}, eliminated: [], threshold: 2 });
    setMyVote(null);
    setElimNotice(null);
    setPlayerName('');
    setPage('home');
  };

  return (
    <div className="app">
      <div className="bg-orb bg-orb-1" />
      <div className="bg-orb bg-orb-2" />

      {error && (
        <div className="error-toast">
          <span className="error-icon">!</span>
          {error}
        </div>
      )}

      <div className="page-content">
        <LangSwitcher />

        {page === 'reconnecting' && (
          <div className="reconnecting-screen">
            <div className="waiting-card">
              <div className="waiting-dot" />
              <div className="waiting-dot" />
              <div className="waiting-dot" />
              <p>Reconnecting…</p>
            </div>
          </div>
        )}

        {page === 'home' && (
          <Home onCreateRoom={createRoom} onJoinRoom={joinRoom} initialRoomCode={initialRoomCode} />
        )}
        {page === 'lobby' && (
          <Lobby roomId={roomId} isHost={isHost} players={players} onStartGame={startGame} onLeave={leaveRoom} />
        )}
        {page === 'game' && (
          <Game
            gameData={gameData}
            gameOver={gameOver}
            roundEnded={roundEnded}
            guessWrong={guessWrong}
            voteData={voteData}
            myVote={myVote}
            myName={playerName}
            elimNotice={elimNotice}
            isHost={isHost}
            onRestart={restartGame}
            onEndRound={endRound}
            onGuess={guessWord}
            onVote={castVote}
            onLeave={leaveRoom}
          />
        )}
      </div>
    </div>
  );
}
