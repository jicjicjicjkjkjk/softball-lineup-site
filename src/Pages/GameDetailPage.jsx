import { formatDateShort } from '../lib/appHelpers'

function getPrintRows(players, lineup, pk) {
  const availableIds = new Set((lineup?.availablePlayerIds || []).map(pk))

  
  return [...(players || [])]
    .filter((player) => availableIds.has(pk(player.id)))
    .sort((a, b) => {
      const aOrderRaw = lineup?.battingOrder?.[pk(a.id)]
      const bOrderRaw = lineup?.battingOrder?.[pk(b.id)]

      const aOrder =
        aOrderRaw === '' || aOrderRaw === null || aOrderRaw === undefined
          ? null
          : Number(aOrderRaw)

      const bOrder =
        bOrderRaw === '' || bOrderRaw === null || bOrderRaw === undefined
          ? null
          : Number(bOrderRaw)

      const aHasOrder = aOrder !== null && !Number.isNaN(aOrder) && aOrder > 0
      const bHasOrder = bOrder !== null && !Number.isNaN(bOrder) && bOrder > 0

      if (aHasOrder && bHasOrder && aOrder !== bOrder) {
        return aOrder - bOrder
      }

      if (aHasOrder && !bHasOrder) return -1
      if (!aHasOrder && bHasOrder) return 1

      return String(a.name || '').localeCompare(String(b.name || ''))
    })
}

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
  toggleSavedCellLock,
  toggleSavedRowLock,
  toggleSavedInningLock,
  pk,
}) {
  
  function handlePrint() {
    window.print()
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

  const printPlayers = getPrintRows(activePlayers, selectedLineup, pk)
  
  return (
    <div className="stack">
      <div className="card no-print">
        <div className="row-between wrap-row">
          <div>
            <h2 style={{ marginBottom: 8 }}>Game Detail</h2>
            <div className="small-note">
              {formatDateShort(selectedGame.date) || 'No Date'} vs{' '}
              {selectedGame.opponent || 'Opponent'}
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
  showLocks={true}
  lockedLineup={selectedLocked}
  visiblePlayerIds={visibleIds}
  onCellChange={(playerId, inning, value) =>
    updateSavedCell(selectedGame.id, playerId, inning, value)
  }
  onBattingChange={(playerId, value) =>
    updateSavedBatting(selectedGame.id, playerId, value)
  }
  onCellLockToggle={(playerId, inning) =>
    toggleSavedCellLock(selectedGame.id, playerId, inning)
  }
  onRowLockToggle={(playerId) =>
    toggleSavedRowLock(selectedGame.id, playerId)
  }
  onInningLockToggle={(inning) =>
    toggleSavedInningLock(selectedGame.id, inning)
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
  <th>Batting Order</th>
  <th>Player</th>
  <th>#</th>
  {Array.from({ length: Number(selectedLineup.innings || 0) }, (_, i) => (
    <th key={i + 1}>{i + 1}</th>
  ))}
</tr>
            </thead>
            <tbody>
              {printPlayers.map((player) => {
                const playerId = String(player.id)

                return (
                  <tr key={playerId}>
  <td>{selectedLineup?.battingOrder?.[playerId] || ''}</td>
  <td>{player.name}</td>
  <td>{player.jersey_number || ''}</td>

                    {Array.from({ length: Number(selectedLineup.innings || 0) }, (_, i) => {
                      const inning = i + 1
                      const value = selectedLineup?.cells?.[playerId]?.[inning] || ''
                      return <td key={inning}>{value}</td>
                    })}
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
