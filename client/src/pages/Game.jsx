import { useState } from 'react';
import { useI18n } from '../i18n/I18nContext.jsx';

const AVATAR_COLORS = ['#7c3aed', '#a855f7', '#6d28d9', '#9333ea', '#c026d3'];

function ImpostorList({ impostors }) {
  return (
    <div className="gr-names">
      {impostors.map((imp) => (
        <div key={imp.name} className="gr-name-chip">
          <span className="gr-spy">🕵️</span>
          {imp.name}
        </div>
      ))}
    </div>
  );
}

function RoundEnded({ roundEnded, isHost, onRestart }) {
  const { t } = useI18n();
  const r = t.roundEnded;
  const impostorLabel = roundEnded.impostors.length > 1 ? r.impostorsWere : r.impostorWas;

  return (
    <div className="game">
      <div className="card round-ended-banner">
        <div className="gameover-icon">🎭</div>
        <div className="round-ended-title">{r.title}</div>
        <p className="gameover-subtitle">{r.subtitle}</p>
      </div>
      <div className="card gameover-reveal">
        <div className="gr-label">{r.wordWas}</div>
        <div className="gr-word">{roundEnded.word}</div>
      </div>
      <div className="card gameover-impostors">
        <div className="gr-label">{impostorLabel}</div>
        <ImpostorList impostors={roundEnded.impostors} />
      </div>
      {isHost ? (
        <button className="btn btn-primary btn-full" onClick={onRestart}>{r.startNew}</button>
      ) : (
        <div className="waiting-card">
          <div className="waiting-dot" /><div className="waiting-dot" /><div className="waiting-dot" />
          <p>{r.waitingNew}</p>
        </div>
      )}
    </div>
  );
}

function GameOver({ gameOver, isHost, onRestart }) {
  const { t } = useI18n();
  const g = t.gameOver;
  const r = t.roundEnded;
  const impostorLabel = gameOver.impostors.length > 1 ? r.impostorsWere : r.impostorWas;

  const isAgentsWin = gameOver.winner === 'innocents';
  const icon  = isAgentsWin ? '🔍' : '🕵️';
  const title = isAgentsWin ? g.agentsTitle : g.impostorsTitle;
  const subtitle = isAgentsWin
    ? g.agentsSubtitle
    : gameOver.endReason === 'impostors-majority'
      ? g.impostorsMajority
      : g.impostorsSubtitle;

  return (
    <div className="game">
      <div className={`gameover-banner card ${isAgentsWin ? 'innocent-card' : 'impostor-card'}`}>
        <div className="gameover-icon">{icon}</div>
        <div className={`gameover-title ${isAgentsWin ? 'gameover-title-agents' : ''}`}>{title}</div>
        <p className="gameover-subtitle">{subtitle}</p>
      </div>
      <div className="card gameover-reveal">
        <div className="gr-label">{r.wordWas}</div>
        <div className="gr-word">{gameOver.word}</div>
      </div>
      <div className="card gameover-impostors">
        <div className="gr-label">{impostorLabel}</div>
        <ImpostorList impostors={gameOver.impostors} />
      </div>
      {isHost && (
        <button className="btn btn-primary btn-full" onClick={onRestart}>{g.startNew}</button>
      )}
    </div>
  );
}

export default function Game({
  gameData, gameOver, roundEnded, guessWrong,
  voteData, myVote, myName, elimNotice,
  isHost, onRestart, onEndRound, onGuess, onVote,
}) {
  const { t } = useI18n();
  const g = t.game;

  const [revealed, setRevealed] = useState(false);
  const [guess, setGuess]       = useState('');

  const { role, word, hint, players, firstPlayer, teammates } = gameData;
  const isImpostor = role === 'impostor';

  const { votes = {}, eliminated = [], threshold = 2 } = voteData;
  const isMeEliminated = eliminated.includes(myName);
  const canVote = !isImpostor && !isMeEliminated;

  if (roundEnded) return <RoundEnded roundEnded={roundEnded} isHost={isHost} onRestart={onRestart} />;
  if (gameOver)   return <GameOver   gameOver={gameOver}     isHost={isHost} onRestart={onRestart} />;

  const handleGuess = (e) => {
    e.preventDefault();
    if (!guess.trim()) return;
    onGuess(guess.trim());
    setGuess('');
  };

  return (
    <div className="game">
      {elimNotice && (
        <div className={`elim-notice ${elimNotice.wasImpostor ? 'elim-impostor' : 'elim-innocent'}`}>
          <span className="elim-icon">{elimNotice.wasImpostor ? '🕵️' : '😇'}</span>
          <div className="elim-body">
            <span className="elim-name">{elimNotice.playerName}</span>
            {' '}<span className="elim-action">{g.wasVotedOut}</span>
            <span className="elim-role">
              {' — '}{elimNotice.wasImpostor ? g.wasImpostor : g.wasInnocent}
            </span>
          </div>
        </div>
      )}

      {!revealed ? (
        <div className="card reveal-gate">
          <div className="reveal-icon">👁️</div>
          <h2>{g.roleReady}</h2>
          <p className="reveal-hint">{g.noPeek}</p>
          <button className="btn btn-primary" onClick={() => setRevealed(true)}>
            {g.revealBtn}
          </button>
        </div>
      ) : (
        <>
          <div className="first-speaker-banner">
            <span className="first-speaker-dot" />
            <span><strong>{firstPlayer}</strong> {g.speaksFirst}</span>
          </div>

          <div className={`role-card ${isImpostor ? 'impostor-card' : 'innocent-card'}`}>
            <div className="role-header">
              <span className="role-icon">{isImpostor ? '🕵️' : '🔍'}</span>
              <div className="role-name">{isImpostor ? g.impostorName : g.agentName}</div>
              <div className="role-desc">{isImpostor ? g.impostorDesc : g.agentDesc}</div>
            </div>
            <div className="role-body">
              <div className="info-label">{isImpostor ? g.hintLabel : g.wordLabel}</div>
              <div className="info-value">{isImpostor ? hint : word}</div>
              {isImpostor && <p className="impostor-tip">{g.impostorTip}</p>}
              {teammates !== null && (
                <div className="teammates-section">
                  <div className="info-label">
                    {teammates.length === 0 ? g.soloImpostor : g.yourTeam}
                  </div>
                  {teammates.length === 0 ? (
                    <p className="solo-note">{g.soloNote}</p>
                  ) : (
                    <div className="teammates-list">
                      {teammates.map((name) => (
                        <div key={name} className="teammate-chip">🕵️ {name}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {isImpostor && (
            <div className="card guess-card">
              <div className="guess-label">{g.guessLabel}</div>
              <form className="guess-form" onSubmit={handleGuess}>
                <input
                  className={`form-input guess-input ${guessWrong ? 'input-shake' : ''}`}
                  type="text"
                  placeholder={g.guessPlaceholder}
                  value={guess}
                  onChange={(e) => setGuess(e.target.value)}
                  maxLength={40}
                />
                <button className="btn btn-primary guess-btn" type="submit" disabled={!guess.trim()}>
                  {g.guessBtn}
                </button>
              </form>
              {guessWrong && <p className="guess-error">{g.guessWrong}</p>}
            </div>
          )}

          <div className="card vote-card">
            <div className="vote-header">
              <span className="vote-section-title">{g.voteTitle}</span>
              {canVote && <span className="vote-hint-text">{g.voteHint}</span>}
            </div>
            <div className="vote-list">
              {players.map((p, i) => {
                const isOut       = eliminated.includes(p.name);
                const voteCount   = votes[p.name] || 0;
                const iVotedHere  = myVote === p.name;
                const isMe        = p.name === myName;
                const clickable   = canVote && !isOut && !isMe;

                return (
                  <div
                    key={p.id}
                    className={[
                      'vote-player',
                      isOut        && 'vote-player-out',
                      iVotedHere && !isOut && 'vote-player-voted',
                      clickable    && 'vote-player-clickable',
                    ].filter(Boolean).join(' ')}
                    onClick={() => clickable && onVote(p.id, p.name)}
                  >
                    <div
                      className="vote-avatar"
                      style={{ background: isOut ? '#2a2748' : AVATAR_COLORS[i % AVATAR_COLORS.length] }}
                    >
                      {p.name[0].toUpperCase()}
                    </div>
                    <span className="vote-name">
                      {p.name}{p.isHost ? ' 👑' : ''}
                    </span>
                    {p.name === firstPlayer && !isOut && (
                      <span className="vote-first-dot">▶</span>
                    )}
                    {isMe && <span className="vote-you-tag">{g.youLabel}</span>}
                    <div className="vote-right">
                      {voteCount > 0 && !isOut && (
                        <span className="vote-count">{voteCount}</span>
                      )}
                      {iVotedHere && !isOut && (
                        <span className="vote-mine">{g.yourVote}</span>
                      )}
                      {isOut && (
                        <span className="vote-out-label">{g.outLabel}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            {canVote && (
              <div className="vote-footer">
                <span className="vote-threshold-text">
                  {g.votesNeeded.replace('{n}', threshold)}
                </span>
              </div>
            )}
          </div>

          {isHost && (
            <button className="btn btn-ghost btn-full" onClick={onEndRound}>
              {g.newRound}
            </button>
          )}
        </>
      )}
    </div>
  );
}
