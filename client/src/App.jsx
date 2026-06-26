import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useI18n } from './i18n/I18nContext.jsx';
import Home from './pages/Home.jsx';
import Lobby from './pages/Lobby.jsx';
import Game from './pages/Game.jsx';

function getServerUrl() {
  const { protocol, hostname } = window.location;
  return `${protocol}//${hostname}:3001`;
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

export default function App() {
  const [page, setPage]           = useState('home');
  const [roomId, setRoomId]       = useState('');
  const [isHost, setIsHost]       = useState(false);
  const [players, setPlayers]     = useState([]);
  const [gameData, setGameData]   = useState(null);
  const [gameOver, setGameOver]   = useState(null);
  const [roundEnded, setRoundEnded] = useState(null);
  const [guessWrong, setGuessWrong] = useState(false);
  const [error, setError]         = useState('');
  const socketRef = useRef(null);

  const initialRoomCode = new URLSearchParams(window.location.search).get('room') || '';

  const showError = useCallback((message) => {
    setError(message);
    setTimeout(() => setError(''), 3500);
  }, []);

  useEffect(() => {
    const socket = io(getServerUrl());
    socketRef.current = socket;

    socket.on('room-created', ({ roomId }) => { setRoomId(roomId); setIsHost(true);  setPage('lobby'); });
    socket.on('room-joined',  ({ roomId }) => { setRoomId(roomId); setIsHost(false); setPage('lobby'); });
    socket.on('room-update',  ({ players }) => setPlayers(players));

    socket.on('game-started', (data) => { setGameData(data); setPage('game'); });

    socket.on('round-ended', (data)  => setRoundEnded(data));
    socket.on('game-over',   (data)  => setGameOver(data));

    socket.on('guess-wrong', () => {
      setGuessWrong(true);
      setTimeout(() => setGuessWrong(false), 2000);
    });

    socket.on('game-restarted', () => {
      setGameData(null);
      setGameOver(null);
      setRoundEnded(null);
      setPage('lobby');
    });

    socket.on('error-msg', ({ message }) => showError(message));

    return () => socket.disconnect();
  }, [showError]);

  const createRoom  = (name)              => socketRef.current?.emit('create-room',  { name });
  const joinRoom    = (code, name)        => socketRef.current?.emit('join-room',    { roomId: code.toUpperCase(), name });
  const startGame   = (count, opts = {}) => socketRef.current?.emit('start-game',   { roomId, impostorCount: count, ...opts });
  const restartGame = ()                  => socketRef.current?.emit('restart-game', { roomId });
  const endRound    = ()                  => socketRef.current?.emit('end-round',    { roomId });
  const guessWord   = (guess)             => socketRef.current?.emit('guess-word',   { roomId, guess });

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

        {page === 'home' && (
          <Home onCreateRoom={createRoom} onJoinRoom={joinRoom} initialRoomCode={initialRoomCode} />
        )}
        {page === 'lobby' && (
          <Lobby roomId={roomId} isHost={isHost} players={players} onStartGame={startGame} />
        )}
        {page === 'game' && (
          <Game
            gameData={gameData}
            gameOver={gameOver}
            roundEnded={roundEnded}
            guessWrong={guessWrong}
            isHost={isHost}
            onRestart={restartGame}
            onEndRound={endRound}
            onGuess={guessWord}
          />
        )}
      </div>
    </div>
  );
}
