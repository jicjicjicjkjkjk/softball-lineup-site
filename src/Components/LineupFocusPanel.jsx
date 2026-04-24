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
    activePlayerIds,
    togglePreviewAvailable,
    pk,
    blankLineup,
    optimizerPreviewByGame,
    lineupsByGame,
    LineupGrid,
    fitByPlayer,
    focusStatuses = [],
    addPreviewInning,
    removePreviewInning,
    updatePreviewCell,
    updatePreviewBatting,
    togglePreviewCellLock,
    togglePreviewRowLock,
    togglePreviewInningLock,
    visibleIds = [],
    gameTypeOptions = [],
    seasonOptions = [],
  } = props

  if (!optimizerFocusGame) return null

  const lineup =
    optimizerPreviewByGame?.[pk(optimizerFocusGame.id)] ||
    lineupsByGame?.[pk(optimizerFocusGame.id)] ||
    blankLineup(
      activePlayers.map((p) => p.id),
      Number(optimizerFocusGame.innings || 6),
      activePlayerIds ? activePlayerIds() : []
    )

  return (
    <>
      <div className="card">
        <h3 style={{ marginTop: 0 }}>
          Selected Game: {formatDateShort(optimizerFocusGame.date) || 'No Date'} vs{' '}
          {optimizerFocusGame.opponent || 'Opponent'}
          {optimizerFocusGame.game_type ? ` • ${optimizerFocusGame.game_type}` : ''}
          {optimizerFocusGame.season ? ` • ${optimizerFocusGame.season}` : ''}
        </h3>

        <LineupAvailability
          activePlayers={activePlayers}
          lineup={lineup}
          optimizerFocusLocked={optimizerFocusLocked}
          togglePreviewAvailable={togglePreviewAvailable}
          optimizerFocusGame={optimizerFocusGame}
          pk={pk}
        />

        <div style={{ marginTop: 16 }}>
          <LineupImportPanel
            optimizerFocusGame={optimizerFocusGame}
            optimizerFocusLocked={optimizerFocusLocked}
            optimizerImportSourceGameId={optimizerImportSourceGameId}
            setOptimizerImportSourceGameId={setOptimizerImportSourceGameId}
            optimizerImportableGames={optimizerImportableGames}
            importLineupToPreview={importLineupToPreview}
            pk={pk}
            gameTypeOptions={gameTypeOptions}
            seasonOptions={seasonOptions}
          />
        </div>
      </div>

      {optimizerFocusLineup && (
        <div className="card" style={{ paddingTop: 12, paddingBottom: 12 }}>
          <h3 style={{ marginTop: 0, marginBottom: 10, fontSize: 18 }}>Checks</h3>

          <div className="stack" style={{ gap: 8 }}>
            {focusStatuses.map((status) => (
              <div
                key={status.inning}
                className="summary-box"
                style={{ fontSize: 13, padding: '8px 10px' }}
              >
                <strong>Inning {status.inning}:</strong>{' '}
                {status.duplicate?.length
                  ? `Duplicate ${status.duplicate.join(', ')}. `
                  : ''}
                {status.missing?.length ? `Missing ${status.missing.join(', ')}. ` : ''}
                {status.badFits?.length
                  ? `Disallowed ${status.badFits.join('; ')}. `
                  : ''}
                {!status.duplicate?.length &&
                !status.missing?.length &&
                !status.badFits?.length
                  ? 'Looks good.'
                  : ''}
              </div>
            ))}
          </div>
        </div>
      )}

      {optimizerFocusLineup && (
        <div className="card">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Grid</h3>

            <div className="button-row">
              <button
                onClick={runOptimizeCurrent}
                disabled={!optimizerFocusGame || optimizerFocusLocked}
              >
                Optimize Current
              </button>

              <button
                onClick={runOptimizeAll}
                disabled={!optimizerBatchGames?.length}
              >
                Optimize All in Plan
              </button>

              <button
                onClick={() => addPreviewInning(optimizerFocusGame.id)}
                disabled={optimizerFocusLocked}
              >
                Add Inning
              </button>

              <button
                onClick={() =>
                  toggleLineupLocked(optimizerFocusGame.id, !optimizerFocusLocked)
                }
              >
                {optimizerFocusLocked ? 'Unlock Lineup' : 'Lock Lineup'}
              </button>

              <button
                onClick={() => clearPreviewLineup(optimizerFocusGame.id)}
                disabled={optimizerFocusLocked}
              >
                Clear Lineup
              </button>
            </div>
          </div>

          <div className="table-scroll">
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
              onInningLockToggle={(inning) =>
                togglePreviewInningLock(optimizerFocusGame.id, inning)
              }
              onRemoveInning={(inning) =>
                removePreviewInning(optimizerFocusGame.id, inning)
              }
              onBattingLockToggle={(playerId) =>
                togglePreviewBattingLock(optimizerFocusGame.id, playerId)
              }
              onAllBattingLockToggle={() =>
                togglePreviewAllBattingLock(optimizerFocusGame.id)
              }
            />
          </div>
        </div>
      )}
    </>
  )
}
