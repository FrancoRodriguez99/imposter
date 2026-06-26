import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

export default function Home({ onCreateRoom, onJoinRoom, initialRoomCode }) {
  const { t } = useI18n();
  const h = t.home;

  const [mode, setMode]         = useState(initialRoomCode ? 'join' : null);
  const [name, setName]         = useState('');
  const [roomCode, setRoomCode] = useState(initialRoomCode);

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreateRoom(name.trim());
  };

  const handleJoin = (e) => {
    e.preventDefault();
    if (!roomCode.trim() || !name.trim()) return;
    onJoinRoom(roomCode.trim(), name.trim());
  };

  return (
    <div className="home">
      <div className="home-header">
        <h1 className="home-title">IMPOSTOR</h1>
        <p className="home-subtitle">{h.subtitle}</p>
      </div>

      {!mode && (
        <div className="mode-buttons">
          <button className="btn btn-primary btn-lg" onClick={() => setMode('host')}>
            {h.hostBtn}
          </button>
          <button className="btn btn-outline btn-lg" onClick={() => setMode('join')}>
            {h.joinBtn}
          </button>
        </div>
      )}

      {mode === 'host' && (
        <div className="card">
          <h2 className="card-title">{h.createTitle}</h2>
          <form className="form" onSubmit={handleCreate}>
            <div className="form-group">
              <label className="form-label">{h.nameLabel}</label>
              <input
                className="form-input"
                type="text"
                placeholder={h.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus
              />
            </div>
            <button className="btn btn-primary" type="submit" disabled={!name.trim()}>
              {h.createBtn}
            </button>
            <button className="btn btn-ghost" type="button" onClick={() => setMode(null)}>
              {h.backBtn}
            </button>
          </form>
        </div>
      )}

      {mode === 'join' && (
        <div className="card">
          <h2 className="card-title">{h.joinTitle}</h2>
          <form className="form" onSubmit={handleJoin}>
            <div className="form-group">
              <label className="form-label">{h.codeLabel}</label>
              <input
                className="form-input code-input"
                type="text"
                placeholder="XXXXXX"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                maxLength={6}
                autoFocus={!initialRoomCode}
              />
            </div>
            <div className="form-group">
              <label className="form-label">{h.nameLabel}</label>
              <input
                className="form-input"
                type="text"
                placeholder={h.namePlaceholder}
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={20}
                autoFocus={!!initialRoomCode}
              />
            </div>
            <button
              className="btn btn-primary"
              type="submit"
              disabled={!roomCode.trim() || !name.trim()}
            >
              {h.joinSubmitBtn}
            </button>
            {!initialRoomCode && (
              <button className="btn btn-ghost" type="button" onClick={() => setMode(null)}>
                {h.backBtn}
              </button>
            )}
          </form>
        </div>
      )}
    </div>
  );
}
