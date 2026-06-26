import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n } from '../i18n/I18nContext.jsx';

const AVATAR_COLORS = ['#7c3aed', '#a855f7', '#6d28d9', '#9333ea', '#c026d3'];

function PlayerItem({ player, index }) {
  const { t } = useI18n();
  return (
    <div className="player-item">
      <div
        className="player-avatar"
        style={{ background: AVATAR_COLORS[index % AVATAR_COLORS.length] }}
      >
        {player.name[0].toUpperCase()}
      </div>
      <span className="player-name">{player.name}</span>
      {player.isHost && <span className="host-badge">HOST</span>}
    </div>
  );
}

export default function Lobby({ roomId, isHost, players, onStartGame }) {
  const { t } = useI18n();
  const l = t.lobby;

  const [impostorCount, setImpostorCount] = useState(1);
  const [randomCount,   setRandomCount]   = useState(false);
  const [showImpostors, setShowImpostors] = useState(false);
  const [wordLang,      setWordLang]      = useState('en');

  const maxImpostors = Math.max(1, players.length - 1);
  const canStart     = players.length >= 2;
  const joinUrl      = `${window.location.origin}?room=${roomId}`;

  const copyCode = () => navigator.clipboard.writeText(roomId).catch(() => {});

  return (
    <div className="lobby">
      <div className="card lobby-room-card" onClick={copyCode} title="Tap to copy">
        <div className="room-code-label">{l.roomCodeLabel}</div>
        <div className="room-code">{roomId}</div>
        <div className="copy-hint">{l.tapToCopy}</div>
      </div>

      {isHost && (
        <div className="card qr-card">
          <p className="qr-label">{l.scanToJoin}</p>
          <div className="qr-wrapper">
            <QRCodeSVG value={joinUrl} size={180} bgColor="#ffffff" fgColor="#09090f" level="M" />
          </div>
          <p className="qr-sublabel">{joinUrl}</p>
        </div>
      )}

      <div className="card players-card">
        <div className="players-title">{l.playersTitle} — {players.length}</div>
        <div className="players-list">
          {players.map((player, i) => (
            <PlayerItem key={player.id} player={player} index={i} />
          ))}
          {players.length === 0 && <div className="no-players">{l.noPlayers}</div>}
        </div>
      </div>

      {isHost ? (
        <div className="card config-card">
          <div className="config-title">{l.settingsTitle}</div>
          <div className="impostor-selector">
            <span className="impostor-label">
              {l.impostorsLabel}
              {randomCount && impostorCount > 1 && (
                <span className="random-range"> (1 – {impostorCount})</span>
              )}
            </span>
            <div className="impostor-controls">
              <button
                className="count-btn"
                onClick={() => setImpostorCount((n) => Math.max(1, n - 1))}
                disabled={impostorCount <= 1}
              >−</button>
              <span className="count-value">{impostorCount}</span>
              <button
                className="count-btn"
                onClick={() => setImpostorCount((n) => Math.min(maxImpostors, n + 1))}
                disabled={impostorCount >= maxImpostors}
              >+</button>
            </div>
          </div>

          <div className="word-lang-row">
            <span className="word-lang-label">{l.wordLangLabel}</span>
            <div className="word-lang-btns">
              {[
                { code: 'en', flag: '🇬🇧' },
                { code: 'es', flag: '🇪🇸' },
                { code: 'it', flag: '🇮🇹' },
              ].map(({ code, flag }) => (
                <button
                  key={code}
                  className={`lang-btn ${wordLang === code ? 'lang-active' : ''}`}
                  onClick={() => setWordLang(code)}
                >
                  {flag}
                </button>
              ))}
            </div>
          </div>

          <div className="config-checkboxes">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={randomCount}
                onChange={(e) => setRandomCount(e.target.checked)}
              />
              <div className="checkbox-text">
                <span className="checkbox-name">{l.randomCountName}</span>
                <span className="checkbox-desc">{l.randomCountDesc}</span>
              </div>
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={showImpostors}
                onChange={(e) => setShowImpostors(e.target.checked)}
              />
              <div className="checkbox-text">
                <span className="checkbox-name">{l.showImpostorsName}</span>
                <span className="checkbox-desc">{l.showImpostorsDesc}</span>
              </div>
            </label>
          </div>

          <button
            className="btn btn-primary"
            onClick={() => onStartGame(impostorCount, { randomCount, showImpostors, wordLang })}
            disabled={!canStart}
          >
            {canStart ? l.startBtn : l.waitingPlayers}
          </button>
        </div>
      ) : (
        <div className="waiting-card">
          <div className="waiting-dot" />
          <div className="waiting-dot" />
          <div className="waiting-dot" />
          <p>{l.waitingHost}</p>
        </div>
      )}
    </div>
  );
}
