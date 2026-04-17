import { formatDateShort } from '../lib/appHelpers'

export default function GameDetailPage({
  selectedGame,
  selectedLineup,
  selectedLocked,
  activePlayers,
  activePlayerIds,
  games,
  selectedGameId,
  setSelectedGameId,
  setPage,
  saveSavedLineup,
  toggleLineupLocked,
  clearSavedLineup,
  addSavedInning,
  removeSavedInning,
  toggleSavedAvailable,
  fitByPlayer,
  LineupGrid,
  updateSavedCell,
  updateSavedBatting,
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
        <div className="row-between wrap-row">
          <div>
            <h2>
              {selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
            </h2>
            <p>No lineup saved yet.</p>
          </div>
          <div className="actions-inline">
            <button onClick={() => setPage('games')}>Back to Games</button>
          </div>
        </div>
      </div>
    )
  }

  const visibleIds = selectedLineup.availablePlayerIds || activePlayerIds()

  return (
    <div className="stack">
      <div className="card no-print">
        <div className="row-between wrap-row">
          <div>
            <h2>
              {formatDateShort(selectedGame.date) || 'No Date'} vs{' '}
              {selectedGame.opponent || 'Opponent'}
            </h2>
            <p>
              Status: <strong>{selectedLocked ? 'Locked' : 'Saved'}</strong> | Type:{' '}
              <strong>{selectedGame.game_type || 'Pool Play'}</strong>
            </p>
          </div>

          <div className="actions-inline">
            <button onClick={() => setPage('games')}>Back to Games</button>

            <select
              value={selectedGameId}
              onChange={(e) => setSelectedGameId(e.target.value)}
              style={{ maxWidth: 280 }}
            >
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {(formatDateShort(game.date) || 'No Date')} vs {(game.opponent || 'Opponent')}
                </option>
              ))}
            </select>

            <button onClick={() => toggleLineupLocked(selectedGame.id, !selectedLocked)}>
              {selectedLocked ? 'Unlock Lineup' : 'Lock Lineup'}
            </button>

            <button onClick={() => clearSavedLineup(selectedGame.id)} disabled={selectedLocked}>
              Clear Lineup
            </button>

            <button onClick={() => window.print()}>Print</button>
          </div>
        </div>

        <div className="button-row" style={{ marginTop: 12 }}>
          <span style={{ fontWeight: 700, alignSelf: 'center' }}>Innings</span>

          <button onClick={() => addSavedInning(selectedGame.id)} disabled={selectedLocked}>
            Add Inning
          </button>

          {Array.from({ length: selectedLineup.innings }, (_, i) => i + 1).map((inning) => (
            <button
              key={inning}
              onClick={() => removeSavedInning(selectedGame.id, inning)}
              disabled={selectedLocked}
            >
              Remove {inning}
            </button>
          ))}
        </div>
      </div>

      <div className="card no-print">
        <h3>Game Availability</h3>
        <div className="checkbox-grid">
          {activePlayers.map((player) => (
            <label key={player.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={visibleIds.includes(player.id)}
                disabled={selectedLocked}
                onChange={() => toggleSavedAvailable(selectedGame.id, player.id)}
              />
              {player.name}
            </label>
          ))}
        </div>
      </div>

      <div className="card no-print" style={{ overflowX: 'auto' }}>
        <LineupGrid
          players={activePlayers}
          lineup={selectedLineup}
          fitMap={fitByPlayer}
          showLocks={false}
          lockedLineup={selectedLocked}
          visiblePlayerIds={visibleIds}
          onCellChange={(playerId, inning, value) =>
            updateSavedCell(selectedGame.id, playerId, inning, value)
          }
          onBattingChange={(playerId, value) =>
            updateSavedBatting(selectedGame.id, playerId, value)
          }
          onCellLockToggle={() => {}}
          onRowLockToggle={() => {}}
        />
      </div>
    </div>
  )
}
