// FILE: src/Pages/GameDetailPage.jsx

import { formatDateShort } from '../lib/appHelpers'
import { printGameDetail } from '../lib/gameDetailPrint'

function compareGamesDescLocal(a, b, pk) {
  const aDate = a?.date || ''
  const bDate = b?.date || ''
  if (aDate !== bDate) return bDate.localeCompare(aDate)

  const aOrder = Number(a?.game_order ?? 0)
  const bOrder = Number(b?.game_order ?? 0)
  if (aOrder !== bOrder) return bOrder - aOrder

  return String(pk(b?.id)).localeCompare(String(pk(a?.id)))
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
    function handlePrint() {
    if (!selectedGame || !selectedLineup) {
      alert('No lineup is available to print yet.')
      return
    }

    printGameDetail({
      selectedGame,
      selectedLineup,
      activePlayers,
      formatDateShort,
      pk,
    })
  }

  async function handleToggleLock() {
    if (!selectedGame) return
    await toggleLineupLocked(selectedGame.id, !selectedLocked)
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

  const visibleIds = selectedLineup?.availablePlayerIds || activePlayerIds?.() || []

  const orderedGamesDesc = [...(games || [])].sort((a, b) =>
    compareGamesDescLocal(a, b, pk)
  )

  return (
    <div className="stack">
      <div className="card no-print">
        <div className="row-between wrap-row">
          <div>
            <h2>Game Detail</h2>
            <div className="small-note">
              {formatDateShort(selectedGame.date)} vs {selectedGame.opponent}
            </div>
          </div>

          <button onClick={() => setPage('games')}>Back</button>
        </div>

        <div className="game-detail-fields">
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

        <div className="game-detail-availability">
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

              <div className="game-detail-actions">
                <button type="button" onClick={handlePrint}>Print</button>

                <button onClick={() => addSavedInning(selectedGame.id)}>
                  Add Inning
                </button>

                <button
  type="button"
  onClick={() => handleToggleLock()}
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
    </div>
  )
}
