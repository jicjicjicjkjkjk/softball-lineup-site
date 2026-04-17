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
  function handlePrint() {
    window.print()
  }

  function buildRowSummary(playerId) {
    let IF = 0
    let OF = 0
    let P = 0
    let C = 0
    let X = 0

    const innings = Number(selectedLineup?.innings || 0)

    for (let inning = 1; inning <= innings; inning += 1) {
      const value = selectedLineup?.cells?.[String(playerId)]?.[inning] || ''
      if (['1B', '2B', '3B', 'SS'].includes(value)) IF += 1
      if (['LF', 'CF', 'RF'].includes(value)) OF += 1
      if (value === 'P') P += 1
      if (value === 'C') C += 1
      if (value === 'Out') X += 1
    }

    return { IF, OF, P, C, X }
  }

  if (!selectedGame) {
    return (
      <div className="stack">
        <div className="card">
          <h2>Game Detail</h2>
          <p>No game selected.</p>
          <button onClick={() => setPage('games')}>Back to Games</button>
        </div>
      </div>
    )
  }

  const visibleIds = selectedLineup?.availablePlayerIds || activePlayerIds()

  return (
    <div className="stack">
      <div className="card no-print">
        <div className="row-between wrap-row">
          <div>
            <h2 style={{ marginBottom: 8 }}>Game Detail</h2>
            <div className="small-note">
              {formatDateShort(selectedGame.date) || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
            </div>
          </div>

          <div className="button-row">
            <button onClick={() => setPage('games')}>Back to Games</button>
            <button onClick={handlePrint}>Print</button>
            <button onClick={() => saveSavedLineup(selectedGame.id)}>
              {selectedLineup ? 'Save Changes' : 'Save Lineup'}
            </button>
            <button onClick={() => toggleLineupLocked(selectedGame.id, !selectedLocked)}>
              {selectedLocked ? 'Unlock Lineup' : 'Lock Lineup'}
            </button>
            <button onClick={() => clearSavedLineup(selectedGame.id)} disabled={selectedLocked}>
              Clear Lineup
            </button>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="grid two-col">
          <div>
            <label>Select Game</label>
            <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
              {games.map((game) => (
                <option key={game.id} value={String(game.id)}>
                  {(formatDateShort(game.date) || 'No Date')} vs {game.opponent || 'Opponent'}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Status</label>
            <input value={selectedLocked ? 'Locked' : 'Unlocked'} readOnly />
          </div>
        </div>

        <div style={{ height: 20 }} />

        <h3>Game Availability</h3>
        <div className="checkbox-grid">
          {activePlayers.map((player) => (
            <label key={player.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={(selectedLineup?.availablePlayerIds || []).includes(String(player.id))}
                onChange={() => toggleSavedAvailable(selectedGame.id, player.id)}
                disabled={selectedLocked}
              />
              {player.name}
            </label>
          ))}
        </div>

        {!!selectedLineup && (
          <>
            <div style={{ height: 20 }} />

            <div className="row-between wrap-row inning-toolbar">
              <h3 style={{ margin: 0 }}>Grid</h3>
              <div className="button-row">
                <button onClick={() => addSavedInning(selectedGame.id)} disabled={selectedLocked}>
                  Add Inning
                </button>
                {Array.from({ length: Number(selectedLineup.innings || 0) }, (_, i) => i + 1).map(
                  (inning) => (
                    <button
                      key={inning}
                      onClick={() => removeSavedInning(selectedGame.id, inning)}
                      disabled={selectedLocked}
                    >
                      Remove {inning}
                    </button>
                  )
                )}
              </div>
            </div>

            <div className="table-scroll no-print" style={{ marginTop: 12 }}>
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
              />
            </div>
          </>
        )}
      </div>

      {!!selectedLineup && (
        <div className="card print-only">
          <div className="print-title">
            {formatDateShort(selectedGame.date) || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
          </div>

          <table className="print-table-compact lineup-print-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Batting Order</th>
                {Array.from({ length: Number(selectedLineup.innings || 0) }, (_, i) => (
                  <th key={i + 1}>{i + 1}</th>
                ))}
                <th>IF</th>
                <th>OF</th>
                <th>P</th>
                <th>C</th>
                <th>X</th>
              </tr>
            </thead>
            <tbody>
              {activePlayers
                .filter((player) => (selectedLineup.availablePlayerIds || []).includes(String(player.id)))
                .map((player) => {
                  const playerId = String(player.id)
                  const summary = buildRowSummary(playerId)

                  return (
                    <tr key={playerId}>
                      <td>{player.jersey_number || ''}</td>
                      <td>{player.name}</td>
                      <td>{selectedLineup?.battingOrder?.[playerId] || ''}</td>

                      {Array.from({ length: Number(selectedLineup.innings || 0) }, (_, i) => {
                        const inning = i + 1
                        const value = selectedLineup?.cells?.[playerId]?.[inning] || ''
                        return <td key={inning}>{value}</td>
                      })}

                      <td>{summary.IF}</td>
                      <td>{summary.OF}</td>
                      <td>{summary.P}</td>
                      <td>{summary.C}</td>
                      <td>{summary.X}</td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
