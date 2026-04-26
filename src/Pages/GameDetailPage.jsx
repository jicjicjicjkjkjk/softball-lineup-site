// FILE: src/Pages/GameDetailPage.jsx

import { useEffect, useState } from 'react'
import { formatDateShort } from '../lib/appHelpers'

function renderOptionLabel(option) {
  if (!option) return ''
  if (typeof option === 'string') return option
  return option.label || option.value || ''
}

function renderOptionValue(option) {
  if (!option) return ''
  if (typeof option === 'string') return option
  return option.value || option.label || ''
}

function compareGamesDescLocal(a, b, pk) {
  const aDate = a?.date || ''
  const bDate = b?.date || ''
  if (aDate !== bDate) return bDate.localeCompare(aDate)

  const aOrder = Number(a?.game_order ?? 0)
  const bOrder = Number(b?.game_order ?? 0)
  if (aOrder !== bOrder) return bOrder - aOrder

  return String(pk(b?.id)).localeCompare(String(pk(a?.id)))
}

function getPrintRows(players, lineup, pk) {
  if (!lineup) return []

  const availableIds = new Set((lineup?.availablePlayerIds || []).map(pk))

  return [...(players || [])]
    .filter((player) => availableIds.has(pk(player.id)))
    .sort((a, b) => {
      const aOrder = Number(lineup?.battingOrder?.[pk(a.id)] || 999)
      const bOrder = Number(lineup?.battingOrder?.[pk(b.id)] || 999)
      return aOrder - bOrder
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
  toggleLineupLocked,
  clearSavedLineup,
  addSavedInning,
  removeSavedInning,
  gameDetailImportSourceGameId,
  setGameDetailImportSourceGameId,
  gameDetailImportableGames = [],
  importLineupToSaved,
  toggleSavedAvailable,
  fitByPlayer,
  LineupGrid,
  updateSavedCell,
  updateSavedBatting,
  toggleSavedCellLock,
  toggleSavedRowLock,
  toggleSavedInningLock,
  toggleSavedBattingLock,
  toggleSavedAllBattingLock,
  updateGameField,
  seasonOptions = [],
  gameTypeOptions = [],
  pk,
}) {
  const [printMode, setPrintMode] = useState(null)

useEffect(() => {
  const handler = () => setPrintMode(null)
  window.addEventListener('afterprint', handler)
  return () => window.removeEventListener('afterprint', handler)
}, [])
  
  function handlePrint() {
    setPrintMode('gameDetail')
    setTimeout(() => window.print(), 100)
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

  const orderedGamesDesc = [...(games || [])].sort((a, b) =>
    compareGamesDescLocal(a, b, pk)
  )

  return (
    <div className="stack">
      <div className={`card no-print ${printMode ? 'hide-on-print' : ''}`}>
        <div className="row-between wrap-row">
          <div>
            <h2>Game Detail</h2>
            <div className="small-note">
              {formatDateShort(selectedGame.date)} vs {selectedGame.opponent}
            </div>
          </div>

          <button onClick={() => setPage('games')}>Back</button>
        </div>

        <div className="grid two-col">
          <div>
            <label>Select Game</label>
            <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
              {orderedGamesDesc.map((game) => (
                <option key={game.id} value={String(game.id)}>
                  {formatDateShort(game.date)} vs {game.opponent}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Status</label>
            <input value={selectedLocked ? 'Locked' : 'Unlocked'} readOnly />
          </div>

          <div>
            <label>Date</label>
            <input
              type="date"
              value={selectedGame.date || ''}
              onChange={(e) => updateGameField(selectedGame.id, 'date', e.target.value)}
            />
          </div>

          <div>
            <label>Opponent</label>
            <input
              value={selectedGame.opponent || ''}
              onChange={(e) => updateGameField(selectedGame.id, 'opponent', e.target.value)}
            />
          </div>
        </div>

        <h3>Game Availability</h3>

        <div className="checkbox-grid">
          {activePlayers.map((player) => {
            const isChecked = (selectedLineup?.availablePlayerIds || []).includes(pk(player.id))

            return (
              <label key={player.id}>
                <input
                  type="checkbox"
                  checked={isChecked}
                  onChange={() => {
                    const confirmMsg = isChecked
                      ? `Remove ${player.name}?`
                      : `Add ${player.name}?`

                    if (window.confirm(confirmMsg)) {
                      toggleSavedAvailable(selectedGame.id, player.id)
                    }
                  }}
                />
                {player.name}
              </label>
            )
          })}
        </div>

        {!!selectedLineup && (
          <>
            <div className="row-between">
              <h3>Grid</h3>

              <div className="button-row">
                <button onClick={handlePrint}>Print</button>

                <button onClick={() => addSavedInning(selectedGame.id)}>
                  Add Inning
                </button>

                <button
                  onClick={() =>
                    toggleLineupLocked(selectedGame.id, !selectedLocked)
                  }
                >
                  {selectedLocked ? 'Unlock' : 'Lock'}
                </button>

                <button
                  onClick={() => {
                    if (window.confirm('Clear lineup?')) {
                      clearSavedLineup(selectedGame.id)
                    }
                  }}
                >
                  Clear
                </button>
              </div>
            </div>

            <div className="table-scroll no-print" style={{ marginTop: 12 }}>  
            <LineupGrid
              players={activePlayers}
              lineup={selectedLineup}
              fitMap={fitByPlayer}
              showLocks
              lockedLineup={selectedLocked}
              visiblePlayerIds={visibleIds}
              onRemoveInning={(inning) =>
                removeSavedInning(selectedGame.id, inning)
              }
              onCellChange={(p, i, v) =>
                updateSavedCell(selectedGame.id, p, i, v)
              }
              onBattingChange={(p, v) =>
                updateSavedBatting(selectedGame.id, p, v)
              }
              onCellLockToggle={(p, i) =>
                toggleSavedCellLock(selectedGame.id, p, i)
              }
              onRowLockToggle={(p) =>
                toggleSavedRowLock(selectedGame.id, p)
              }
              onInningLockToggle={(i) =>
                toggleSavedInningLock(selectedGame.id, i)
              }
              onBattingLockToggle={(p) =>
                toggleSavedBattingLock(selectedGame.id, p)
              }
                            onAllBattingLockToggle={() =>
                toggleSavedAllBattingLock(selectedGame.id)
              }
            />
</div>
          </>
        )}
      </div>

      {/* PRINT */}
      {!!selectedLineup && printMode && (
        <div className="card print-only">
          <div className="print-title">
            {formatDateShort(selectedGame.date)} vs {selectedGame.opponent}
          </div>

          <table className="lineup-print-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>Player</th>
                <th>#</th>
                {Array.from({ length: selectedLineup.innings || 0 }).map((_, i) => (
                  <th key={i}>{i + 1}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {printPlayers.map((player) => {
                const id = pk(player.id)

                return (
                  <tr key={id}>
                    <td>{selectedLineup.battingOrder?.[id]}</td>
                    <td>{player.name}</td>
                    <td>{player.jersey_number}</td>

                    {Array.from({ length: selectedLineup.innings || 0 }).map((_, i) => {
                      const inning = i + 1
                      return <td key={inning}>{selectedLineup.cells?.[id]?.[inning]}</td>
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
