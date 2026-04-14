import LineupGrid from '../Components/Lineupgrid'

export default function GameDetailPage({
  games,
  selectedGame,
  selectedLineup,
  selectedLocked,
  players,
  fitByPlayer,
  onSelectGame,
  onAddInning,
  onRemoveInning,
  onSaveLineup,
  onToggleLocked,
  onClearLineup,
  onCellChange,
  onBattingChange,
  onToggleAvailability,
}) {
  if (!selectedGame) {
    return (
      <div className="card">
        <h2>Game Detail</h2>
        <p>Select a game from Games.</p>
      </div>
    )
  }

  if (!selectedLineup) {
    return (
      <div className="card">
        <div className="row-between">
          <div>
            <h2>{selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}</h2>
            <p>No lineup saved yet.</p>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Open Another Game</label>
          <select value={String(selectedGame.id)} onChange={(e) => onSelectGame(e.target.value)}>
            {games.map((game) => (
              <option key={game.id} value={String(game.id)}>
                {(game.date || 'No Date')} vs {(game.opponent || 'Opponent')}
              </option>
            ))}
          </select>
        </div>
      </div>
    )
  }

  const availableSet = new Set((selectedLineup.availablePlayerIds || []).map(String))

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <div>
            <h2>{selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}</h2>
            <p>Status: <strong>{selectedLocked ? 'Locked' : 'Saved'}</strong></p>
          </div>

          <div className="button-row">
            <button onClick={() => onAddInning(selectedGame.id)} disabled={selectedLocked}>
              Add Inning
            </button>
            <button onClick={() => onSaveLineup(selectedGame.id)} disabled={selectedLocked}>
              Save Changes
            </button>
            <button onClick={() => onToggleLocked(selectedGame.id, !selectedLocked)}>
              {selectedLocked ? 'Unlock Lineup' : 'Lock Lineup'}
            </button>
            <button onClick={() => onClearLineup(selectedGame.id)} disabled={selectedLocked}>
              Clear Lineup
            </button>
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <label>Open Another Game</label>
          <select value={String(selectedGame.id)} onChange={(e) => onSelectGame(e.target.value)}>
            {games.map((game) => (
              <option key={game.id} value={String(game.id)}>
                {(game.date || 'No Date')} vs {(game.opponent || 'Opponent')}
              </option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 16 }}>
          <h4>Game Availability</h4>
          <div className="checkbox-grid">
            {players
              .filter((p) => p.active !== false)
              .map((player) => (
                <label key={player.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={availableSet.has(String(player.id))}
                    onChange={() => onToggleAvailability(selectedGame.id, player.id)}
                    disabled={selectedLocked}
                  />
                  {player.name}
                </label>
              ))}
          </div>
        </div>

        <div className="button-row" style={{ marginTop: 12 }}>
          <span style={{ fontWeight: 600, alignSelf: 'center' }}>Remove Inning</span>
          {Array.from({ length: selectedLineup.innings }, (_, i) => i + 1).map((inning) => (
            <button
              key={inning}
              onClick={() => onRemoveInning(selectedGame.id, inning)}
              disabled={selectedLocked}
            >
              {inning}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <LineupGrid
          players={players}
          lineup={selectedLineup}
          fitByPlayer={fitByPlayer}
          showLocks={false}
          lockedLineup={selectedLocked}
          hideUnavailable={true}
          onCellChange={(playerId, inning, value) => onCellChange(selectedGame.id, playerId, inning, value)}
          onBattingChange={(playerId, value) => onBattingChange(selectedGame.id, playerId, value)}
          onCellLockToggle={() => {}}
          onRowLockToggle={() => {}}
        />
      </div>
    </div>
  )
}
