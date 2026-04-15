import LineupGrid from "../Components/LineupGrid";
import TrackingTable from "../Components/TrackingTable";
import { GAME_TYPES, blankLineup, inningStatus } from '../lib/lineupUtils'

export default function OptimizerPage(props) {
  const {
    games,
    players,
    activePlayers,
    fitByPlayer,
    lineupsByGame,
    optimizerExistingGameId,
    setOptimizerExistingGameId,
    optimizerFocusGameId,
    setOptimizerFocusGameId,
    optimizerBatchGames,
    optimizerPreviewByGame,
    optimizerFocusGame,
    optimizerFocusLineup,
    optimizerNewDate,
    setOptimizerNewDate,
    optimizerNewOpponent,
    setOptimizerNewOpponent,
    optimizerNewType,
    setOptimizerNewType,
    ytdBeforeTotals,
    currentBatchTotals,
    ytdAfterTotals,
    ytdBeforeLockedGames,
    onAddExistingGame,
    onAddGame,
    onRemoveBatchGame,
    onBuildBatch,
    onSavePreview,
    onTogglePreviewAvailable,
    onCellChange,
    onBattingChange,
    onCellLockToggle,
    onRowLockToggle,
  } = props

function handleOptimize() {
  if (!optimizerFocusGameId) {
    alert("Select a focus game first")
    return
  }

  // 🔥 Force rebuild
  onBuildBatch()

  // 🔥 Force re-focus (THIS IS WHAT YOU WERE MISSING)
  setTimeout(() => {
    setOptimizerFocusGameId(String(optimizerFocusGameId))
  }, 50)
}
  
  const focusStatuses = optimizerFocusLineup
    ? Array.from({ length: optimizerFocusLineup.innings }, (_, i) => i + 1).map((inning) => ({
        inning,
        ...inningStatus(optimizerFocusLineup, inning, players, fitByPlayer),
      }))
    : []

  function rowsFromTotals(totals) {
    return players.map((player) => totals[String(player.id)] || {
      playerId: String(player.id),
      name: player.name,
      jersey_number: player.jersey_number || '',
      games: 0,
      P: 0, C: 0, '1B': 0, '2B': 0, '3B': 0, SS: 0, LF: 0, CF: 0, RF: 0,
      IF: 0, OF: 0, Out: 0, Injury: 0, fieldTotal: 0, expectedOuts: 0, actualOuts: 0, delta: 0,
    })
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Optimizer</h2>

        <div className="grid four-col">
          <div>
            <label>Existing Game</label>
            <select value={optimizerExistingGameId} onChange={(e) => setOptimizerExistingGameId(e.target.value)}>
              <option value="">Select game</option>
              {games.map((game) => (
                <option key={game.id} value={String(game.id)}>
                  {(game.date || 'No Date')} vs {(game.opponent || 'Opponent')}
                </option>
              ))}
            </select>
          </div>

          <div className="align-end">
            <button onClick={onAddExistingGame}>Add Existing to Batch</button>
          </div>

          <div>
            <label>Create Date</label>
            <input type="date" value={optimizerNewDate} onChange={(e) => setOptimizerNewDate(e.target.value)} />
          </div>

          <div>
            <label>Create Opponent</label>
            <input value={optimizerNewOpponent} onChange={(e) => setOptimizerNewOpponent(e.target.value)} />
          </div>
        </div>

        <div className="grid four-col" style={{ marginTop: 12 }}>
  <div>
    <label>Create Type</label>
    <select value={optimizerNewType} onChange={(e) => setOptimizerNewType(e.target.value)}>
      {GAME_TYPES.map((type) => (
        <option key={type}>{type}</option>
      ))}
    </select>
  </div>

  <div className="align-end">
    <button onClick={onAddGame}>Create New + Add to Batch</button>
  </div>

  <div className="align-end">
    <button onClick={handleOptimize}>
  ⚡ Optimize
</button>  </div>

  <div className="align-end">
    <button
      onClick={() => {
        if (!optimizerFocusGameId) {
          alert("Select a game first")
          return
        }
        onBuildBatch()
      }}
    >
      ⚡ Optimize Focus Game
    </button>
  </div>
</div>
        <div>
            <label>Create Type</label>
            <select value={optimizerNewType} onChange={(e) => setOptimizerNewType(e.target.value)}>
              {GAME_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="align-end">
            <button onClick={onAddGame}>Create New + Add to Batch</button>
          </div>
          <div className="align-end">
            <button onClick={onBuildBatch}>Build / Rebuild Batch</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Current Batch</h3>
        <table>
          <thead>
            <tr>
              <th>Focus</th>
              <th>Date</th>
              <th>Opponent</th>
              <th>Type</th>
              <th>Innings</th>
              <th>Save</th>
              <th>Remove</th>
            </tr>
          </thead>
          <tbody>
            {optimizerBatchGames.map((game) => (
              <tr key={game.id}>
                <td>
                  <button onClick={() => setOptimizerFocusGameId(String(game.id))}>
                    {String(optimizerFocusGameId) === String(game.id) ? 'Viewing' : 'Focus'}
                  </button>
                </td>
                <td>{game.date || 'No Date'}</td>
                <td>{game.opponent || 'Opponent'}</td>
                <td>{game.game_type || 'Friendly'}</td>
                <td>{game.innings}</td>
                <td>
                  <button onClick={() => onSavePreview(game.id)}>Save</button>
                </td>
                <td>
                  <button onClick={() => onRemoveBatchGame(game.id)}>Remove</button>
                </td>
              </tr>
            ))}
            {!optimizerBatchGames.length && (
              <tr>
                <td colSpan="7">No games in batch.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {optimizerFocusGame && (
        <>
          <div className="card">
            <h3>
              Focus Game: {optimizerFocusGame.date || 'No Date'} vs {optimizerFocusGame.opponent || 'Opponent'}
            </h3>

            <h4>Game Availability</h4>
            <div className="checkbox-grid">
              {activePlayers.map((player) => {
                const lineup =
                  optimizerPreviewByGame[String(optimizerFocusGame.id)] ||
                  lineupsByGame[String(optimizerFocusGame.id)] ||
                  blankLineup(players.map((p) => p.id), Number(optimizerFocusGame.innings || 6), activePlayers.map((p) => p.id))

                return (
                  <label key={player.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={(lineup.availablePlayerIds || []).includes(String(player.id))}
                      onChange={() => onTogglePreviewAvailable(optimizerFocusGame.id, player.id)}
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
                      {status.duplicate.length ? `Duplicate ${status.duplicate.join(', ')}. ` : ''}
                      {status.missing.length ? `Missing ${status.missing.join(', ')}. ` : ''}
                      {status.badFits.length ? `Disallowed ${status.badFits.join('; ')}. ` : ''}
                      {!status.duplicate.length && !status.missing.length && !status.badFits.length
                        ? 'Looks good.'
                        : ''}
                    </div>
                  ))}
                </div>
              </div>

              <div className="card" style={{ overflowX: 'auto' }}>
                <LineupGrid
                  players={players}
                  lineup={optimizerFocusLineup}
                  fitByPlayer={fitByPlayer}
                  showLocks={true}
                  lockedLineup={false}
                  hideUnavailable={true}
                  onCellChange={(playerId, inning, value) => onCellChange(optimizerFocusGame.id, playerId, inning, value)}
                  onBattingChange={(playerId, value) => onBattingChange(optimizerFocusGame.id, playerId, value)}
                  onCellLockToggle={(playerId, inning) => onCellLockToggle(optimizerFocusGame.id, playerId, inning)}
                  onRowLockToggle={(playerId) => onRowLockToggle(optimizerFocusGame.id, playerId)}
                />
              </div>
            </>
          )}

          <div className="card">
            <p style={{ margin: 0 }}>
              <strong>YTD Before Universe:</strong> Locked games only ({ytdBeforeLockedGames.length} games)
            </p>
          </div>

          <TrackingTable title="YTD Before" rows={rowsFromTotals(ytdBeforeTotals)} />
          <TrackingTable title="Current Batch" rows={rowsFromTotals(currentBatchTotals)} />
          <TrackingTable title="YTD After" rows={rowsFromTotals(ytdAfterTotals)} />
        </>
      )}
    </div>
  )
}
