import { formatDateShort } from '../lib/appHelpers'

export default function LineupSetterPage({
  optimizerFocusLineup,
  optimizerFocusGame,
  optimizerExistingGameId,
  setOptimizerExistingGameId,
  games,
  addExistingGameToBatch,
  optimizerFocusLocked,
  toggleLineupLocked,
  optimizerNewDate,
  setOptimizerNewDate,
  optimizerNewOpponent,
  setOptimizerNewOpponent,
  optimizerNewType,
  setOptimizerNewType,
  GAME_TYPES,
  addGameFromOptimizer,
  runOptimizeCurrent,
  optimizerFocusGameId,
  runOptimizeAll,
  optimizerBatchGames,
  optimizerPreviewByGame,
  lineupsByGame,
  activePlayers,
  activePlayerIds,
  requiredOutsForGame,
  setOptimizerFocusGameId,
  savePreview,
  removeBatchGame,
  addPreviewInning,
  removePreviewInning,
  togglePreviewAvailable,
  LineupGrid,
  fitByPlayer,
  updatePreviewCell,
  updatePreviewBatting,
  togglePreviewCellLock,
  togglePreviewRowLock,
  lockedLineupsOnly,
  ytdBeforeTotals,
  currentBatchTotals,
  ytdAfterTotals,
  trackingSort,
  setTrackingSort,
  TrackingTable,
  blankLineup,
  pk,
  inningStatus,
}) {
  const focusStatuses = optimizerFocusLineup
    ? Array.from({ length: optimizerFocusLineup.innings }, (_, i) => i + 1).map((inning) => ({
        inning,
        ...inningStatus(optimizerFocusLineup, inning, activePlayers, fitByPlayer),
      }))
    : []

  const visibleIds = optimizerFocusLineup?.availablePlayerIds || []

  return (
    <div className="stack">
      <div className="card">
        <h2>Lineup Setter</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 24,
            alignItems: 'start',
          }}
        >
          <div>
            <h3 style={{ marginTop: 0 }}>Add Existing Game to Plan</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
              <div>
                <label>Existing Game</label>
                <select
                  value={optimizerExistingGameId}
                  onChange={(e) => setOptimizerExistingGameId(e.target.value)}
                >
                  <option value="">Select game</option>
                  {games.map((game) => (
                    <option key={game.id} value={pk(game.id)}>
                      {(formatDateShort(game.date) || 'No Date')} vs{' '}
                      {game.opponent || 'Opponent'}
                    </option>
                  ))}
                </select>
              </div>
              <div className="align-end">
                <button onClick={addExistingGameToBatch}>Add Existing Game</button>
              </div>
            </div>
          </div>

          <div>
  <h3 style={{ marginTop: 0 }}>Create New Game and Add to Plan</h3>

  <div className="lineup-setter-new-game">
    <div className="lineup-setter-new-game-fields">
      <div>
        <label>Game Date</label>
        <input
          type="date"
          value={optimizerNewDate}
          onChange={(e) => setOptimizerNewDate(e.target.value)}
        />
      </div>

      <div>
        <label>Opponent</label>
        <input
          value={optimizerNewOpponent}
          onChange={(e) => setOptimizerNewOpponent(e.target.value)}
        />
      </div>

      <div>
        <label>Game Type</label>
        <select
          value={optimizerNewType}
          onChange={(e) => setOptimizerNewType(e.target.value)}
        >
          {GAME_TYPES.map((type) => (
            <option key={type}>{type}</option>
          ))}
        </select>
      </div>
    </div>

    <div className="lineup-setter-new-game-action">
      <button onClick={addGameFromOptimizer}>Add New Game</button>
    </div>
  </div>
</div>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Games in Current Plan</h3>
            <div className="actions-inline">
              <button onClick={runOptimizeCurrent} disabled={!optimizerFocusGameId || optimizerFocusLocked}>
                Optimize Game Viewing
              </button>
              <button onClick={runOptimizeAll} disabled={!optimizerBatchGames.length}>
                Optimize All Games in Plan
              </button>
            </div>
          </div>

          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Focus</th>
                <th>Date</th>
                <th>Order</th>
                <th>Opponent</th>
                <th>Type</th>
                <th>Innings</th>
                <th>Req. Outs</th>
                <th>Save</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {optimizerBatchGames.map((game) => {
                const lineup =
                  optimizerPreviewByGame[pk(game.id)] ||
                  lineupsByGame[pk(game.id)] ||
                  blankLineup(
                    activePlayers.map((p) => p.id),
                    Number(game.innings || 6),
                    activePlayerIds()
                  )

                const effectiveInnings = Number(lineup?.innings || game.innings || 6)
                const effectiveRequiredOuts = requiredOutsForGame(
                  (lineup.availablePlayerIds || []).length,
                  effectiveInnings
                )

                return (
                  <tr key={game.id}>
                    <td>
                      <button onClick={() => setOptimizerFocusGameId(pk(game.id))}>
                        {pk(optimizerFocusGameId) === pk(game.id) ? 'Viewing' : 'Open'}
                      </button>
                    </td>
                    <td>{formatDateShort(game.date)}</td>
                    <td>{game.game_order ?? ''}</td>
                    <td>{game.opponent || 'Opponent'}</td>
                    <td>{game.game_type || GAME_TYPES[0]}</td>
                    <td>{effectiveInnings}</td>
                    <td>{effectiveRequiredOuts}</td>
                    <td>
                      <button onClick={() => savePreview(game.id)}>Save</button>
                    </td>
                    <td>
                      <button onClick={() => removeBatchGame(game.id)}>Remove</button>
                    </td>
                  </tr>
                )
              })}

              {!optimizerBatchGames.length && (
                <tr>
                  <td colSpan="9">No games in current plan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {optimizerFocusGame && (
        <>
          <div className="card">
            <div className="row-between wrap-row">
              <h3 style={{ margin: 0 }}>
                Selected Game: {formatDateShort(optimizerFocusGame.date) || 'No Date'} vs{' '}
                {optimizerFocusGame.opponent || 'Opponent'}
              </h3>

              {optimizerFocusLineup && (
  <div className="actions-inline">
    <button onClick={() => toggleLineupLocked(optimizerFocusGame.id, !optimizerFocusLocked)}>
      {optimizerFocusLocked ? 'Unlock Lineup' : 'Lock Lineup'}
    </button>

    <button
      onClick={() => addPreviewInning(optimizerFocusGame.id)}
      disabled={optimizerFocusLocked}
    >
      Add Inning
    </button>
                  {Array.from(
                    { length: Number(optimizerFocusLineup.innings || 0) },
                    (_, i) => i + 1
                  ).map((inning) => (
                    <button
                      key={inning}
                      onClick={() => removePreviewInning(optimizerFocusGame.id, inning)}
                    >
                      Remove {inning}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <h4>Game Availability</h4>
            <div className="checkbox-grid">
              {activePlayers.map((player) => {
                const lineup =
                  optimizerPreviewByGame[pk(optimizerFocusGame.id)] ||
                  lineupsByGame[pk(optimizerFocusGame.id)] ||
                  blankLineup(
                    activePlayers.map((p) => p.id),
                    Number(optimizerFocusGame.innings || 6),
                    activePlayerIds()
                  )

                return (
                  <label key={player.id} className="checkbox-item">
                    <input
  type="checkbox"
  checked={(lineup.availablePlayerIds || []).includes(pk(player.id))}
  disabled={optimizerFocusLocked}
  onChange={() => togglePreviewAvailable(optimizerFocusGame.id, player.id)}
/>
                    {player.name}
                  </label>
                )
              })}
            </div>
          </div>

          {optimizerFocusLineup && (
            <>
              <div className="card">
                <h3>Checks</h3>
                <div className="stack">
                  {focusStatuses.map((status) => (
                    <div key={status.inning} className="summary-box">
                      <strong>Inning {status.inning}:</strong>{' '}
                      {status.duplicate.length
                        ? `Duplicate ${status.duplicate.join(', ')}. `
                        : ''}
                      {status.missing.length ? `Missing ${status.missing.join(', ')}. ` : ''}
                      {status.badFits.length
                        ? `Disallowed ${status.badFits.join('; ')}. `
                        : ''}
                      {!status.duplicate.length &&
                      !status.missing.length &&
                      !status.badFits.length
                        ? 'Looks good.'
                        : ''}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card">
                <div className="table-scroll">
                  <h3>Grid</h3>
                  <LineupGrid
                    players={activePlayers}
                    lineup={optimizerFocusLineup}
                    fitMap={fitByPlayer}
                    showLocks={true}
                    lockedLineup={optimizerFocusLocked}
                    visiblePlayerIds={visibleIds}
                    onCellChange={(playerId, inning, value) =>
                      updatePreviewCell(optimizerFocusGame.id, playerId, inning, value)
                    }
                    onBattingChange={(playerId, value) =>
                      updatePreviewBatting(optimizerFocusGame.id, playerId, value)
                    }
                    onCellLockToggle={(playerId, inning) =>
                      togglePreviewCellLock(optimizerFocusGame.id, playerId, inning)
                    }
                    onRowLockToggle={(playerId) =>
                      togglePreviewRowLock(optimizerFocusGame.id, playerId)
                    }
                  />
                </div>
              </div>
            </>
          )}

          <TrackingTable
            title="Locked Games Before Current Plan"
            universeLabel={`${lockedLineupsOnly.length} locked games`}
            totals={ytdBeforeTotals}
            players={activePlayers}
            sortConfig={trackingSort}
            setSortConfig={setTrackingSort}
          />

          <TrackingTable
            title="Current Plan"
            totals={currentBatchTotals}
            players={activePlayers}
            sortConfig={trackingSort}
            setSortConfig={setTrackingSort}
          />

          <TrackingTable
            title="Locked + Current Plan"
            totals={ytdAfterTotals}
            players={activePlayers}
            sortConfig={trackingSort}
            setSortConfig={setTrackingSort}
          />
        </>
      )}
    </div>
  )
}
