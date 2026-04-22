import { formatDateShort } from '../lib/appHelpers'
import LineupImportPanel from './LineupImportPanel'
import LineupAvailability from './LineupAvailability'

export default function LineupFocusPanel(props) {
  const {
    optimizerFocusGame,
    optimizerFocusLineup,
    optimizerFocusLocked,
    optimizerImportSourceGameId,
    setOptimizerImportSourceGameId,
    optimizerImportableGames,
    importLineupToPreview,
    toggleLineupLocked,
    runOptimizeCurrent,
    runOptimizeAll,
    clearPreviewLineup,
    optimizerBatchGames,
    activePlayers,
    togglePreviewAvailable,
    pk,
    blankLineup,
    optimizerPreviewByGame,
    lineupsByGame,
  } = props

  if (!optimizerFocusGame) return null

  const lineup =
    optimizerPreviewByGame[pk(optimizerFocusGame.id)] ||
    lineupsByGame[pk(optimizerFocusGame.id)] ||
    blankLineup(
      activePlayers.map((p) => p.id),
      Number(optimizerFocusGame.innings || 6),
      []
    )

  return (
    <div className="card">
      <h3>
        {formatDateShort(optimizerFocusGame.date)} vs {optimizerFocusGame.opponent}
      </h3>

      <div className="button-row">
        <button onClick={runOptimizeCurrent}>Optimize</button>
        <button onClick={runOptimizeAll}>Optimize All</button>

        <button
          onClick={() =>
            toggleLineupLocked(optimizerFocusGame.id, !optimizerFocusLocked)
          }
        >
          {optimizerFocusLocked ? 'Unlock' : 'Lock'}
        </button>

        <button onClick={() => clearPreviewLineup(optimizerFocusGame.id)}>
          Clear
        </button>
      </div>

      <LineupAvailability
        activePlayers={activePlayers}
        lineup={lineup}
        optimizerFocusLocked={optimizerFocusLocked}
        togglePreviewAvailable={togglePreviewAvailable}
        optimizerFocusGame={optimizerFocusGame}
        pk={pk}
      />

      <LineupImportPanel
        {...props}
      />
    </div>
  )
}
