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
  updateGameField,
  seasonOptions = [],
  gameTypeOptions = [],
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

  const orderedGamesDesc = [...(games || [])].sort((a, b) =>
    compareGamesDescLocal(a, b, pk)
  )

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
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="grid two-col">
          <div>
            <label>Select Game</label>
            <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
              {orderedGamesDesc.map((game) => (
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

          <div>
            <label>Game Type</label>
            <select
              value={selectedGame.game_type || ''}
              onChange={(e) => updateGameField(selectedGame.id, 'game_type', e.target.value)}
            >
              <option value="">Select type</option>
              {gameTypeOptions.map((option) => (
                <option key={renderOptionValue(option)} value={renderOptionValue(option)}>
                  {renderOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Season</label>
            <select
              value={selectedGame.season || ''}
              onChange={(e) => updateGameField(selectedGame.id, 'season', e.target.value)}
            >
              <option value="">Select season</option>
              {seasonOptions.map((option) => (
                <option key={renderOptionValue(option)} value={renderOptionValue(option)}>
                  {renderOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ height: 20 }} />

        <div className="card" style={{ padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Import Lineup</h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto',
              gap: 12,
              alignItems: 'end',
            }}
          >
            <div>
              <label>Source Game</label>
              <select
                value={gameDetailImportSourceGameId}
                onChange={(e) => setGameDetailImportSourceGameId(e.target.value)}
                disabled={selectedLocked}
              >
                <option value="">Select game to import</option>
                {gameDetailImportableGames.map((game) => (
                  <option key={game.id} value={pk(game.id)}>
                    {(formatDateShort(game.date) || 'No Date')} vs {game.opponent || 'Opponent'}
                    {game.game_type ? ` • ${game.game_type}` : ''}
                    {game.season ? ` • ${game.season}` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <button
                onClick={() =>
                  importLineupToSaved(selectedGame.id, gameDetailImportSourceGameId)
                }
                disabled={!gameDetailImportSourceGameId || selectedLocked}
              >
                Import Lineup
              </button>
            </div>
          </div>
        </div>

        <div style={{ height: 20 }} />

        <h3>Game Availability</h3>
        <div className="checkbox-grid">
          {activePlayers.map((player) => (
            <label key={player.id} className="checkbox-item">
              <input
                type="checkbox"
                checked={(selectedLineup?.availablePlayerIds || []).includes(pk(player.id))}
                onChange={() => toggleSavedAvailable(selectedGame.id, player.id)}
                disabled={selectedLocked}
              />
              {player.name}
            </label>
          ))}
        </div>

        <div style={{ height: 16 }} />

        <div className="button-row">
          <button onClick={() => toggleLineupLocked(selectedGame.id, !selectedLocked)}>
            {selectedLocked ? 'Unlock Lineup' : 'Lock Lineup'}
          </button>
          <button onClick={() => clearSavedLineup(selectedGame.id)} disabled={selectedLocked}>
            Clear Lineup
          </button>
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
              </div>
            </div>

            <div className="table-scroll no-print" style={{ marginTop: 12 }}>
              <LineupGrid
                players={activePlayers}
                lineup={selectedLineup}
                fitMap={fitByPlayer}
                onRemoveInning={(inning) => removeSavedInning(selectedGame.id, inning)}
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
                const playerId = pk(player.id)

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
