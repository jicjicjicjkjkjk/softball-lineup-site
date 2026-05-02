import { useState } from 'react'
import { formatDateShort } from '../lib/appHelpers'
import LineupImportPanel from './LineupImportPanel'
import LineupAvailability from './LineupAvailability'
import MobileLineupCard from './MobileLineupCard'

export default function LineupFocusPanel(props) {
  const [showMobileLineupCard, setShowMobileLineupCard] = useState(false)

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
    togglePreviewBattingLock,
    togglePreviewAllBattingLock,
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
    optimizerMode = 'standard',
    setOptimizerMode,
    optimizerProfiles = [],
    selectedOptimizerProfile = null,
    optimizerModeDescription = '',
    currentBatchTotals = {},
    optimizerPlanSitOutTargets = {},
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

  const badCheckCount = focusStatuses.filter(
    (status) =>
      status.duplicate?.length ||
      status.missing?.length ||
      status.badFits?.length
  ).length

  return (
    <>
      <div className="lineup-focus-header card">
        <div>
          <h3 style={{ margin: 0 }}>
            {formatDateShort(optimizerFocusGame.date) || 'No Date'} vs{' '}
            {optimizerFocusGame.opponent || 'Opponent'}
          </h3>

          <div className="small-note">
            {optimizerFocusGame.game_type ? `${optimizerFocusGame.game_type} • ` : ''}
            {optimizerFocusGame.season || ''}
            {optimizerFocusLocked ? ' • Locked' : ' • Editable'}
          </div>
        </div>

        <div className="lineup-focus-status-pill">
          {badCheckCount ? `${badCheckCount} issue${badCheckCount === 1 ? '' : 's'}` : 'Looks good'}
        </div>
      </div>

      <div className="lineup-focus-two-col">
        <div className="card">
          <LineupAvailability
            activePlayers={activePlayers}
            lineup={lineup}
            optimizerFocusLocked={optimizerFocusLocked}
            togglePreviewAvailable={togglePreviewAvailable}
            optimizerFocusGame={optimizerFocusGame}
            pk={pk}
          />
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Optimizer Mode</h3>

          <div className="optimizer-mode-row">
            <div>
              <label>Mode for Next Optimize Run</label>
              <select
                value={optimizerMode}
                onChange={(e) => {
                  if (typeof setOptimizerMode === 'function') {
                    setOptimizerMode(e.target.value)
                  }
                }}
              >
                {optimizerProfiles.length ? (
                  optimizerProfiles.map((profile) => (
                    <option key={profile.id} value={profile.profile_key}>
                      {profile.profile_name}
                    </option>
                  ))
                ) : (
                  <>
                    <option value="standard">Balanced Competitive &amp; Development</option>
                    <option value="friendly">Friendly - Development Focused</option>
                    <option value="tournament">Tournament - Competitive</option>
                  </>
                )}
              </select>
            </div>

            <div className="small-note optimizer-mode-note">
              <strong>{selectedOptimizerProfile?.profile_name || 'Selected Strategy'}:</strong>{' '}
              {optimizerModeDescription || 'No description has been added yet.'}
            </div>
          </div>

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
        <div className="card checks-card">
          <div className="row-between wrap-row">
            <h3 style={{ margin: 0 }}>Checks</h3>
            <div className="small-note">
              {badCheckCount ? 'Review the innings below.' : 'All innings look good.'}
            </div>
          </div>

          <div className="checks-grid">
            {focusStatuses.map((status) => {
              const hasIssue =
                status.duplicate?.length ||
                status.missing?.length ||
                status.badFits?.length

              return (
                <div
                  key={status.inning}
                  className={`summary-box check-pill ${hasIssue ? 'check-issue' : 'check-good'}`}
                >
                  <strong>Inn {status.inning}:</strong>{' '}
                  {status.duplicate?.length ? `Duplicate ${status.duplicate.join(', ')}. ` : ''}
                  {status.missing?.length ? `Missing ${status.missing.join(', ')}. ` : ''}
                  {status.badFits?.length ? `Disallowed ${status.badFits.join('; ')}. ` : ''}
                  {!hasIssue ? 'Good' : ''}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {optimizerFocusLineup && (
        <div className="card">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Grid</h3>

            <div className="button-row lineup-grid-actions">
              <button type="button" onClick={() => setShowMobileLineupCard(true)}>
                Lineup Card
              </button>

              <button onClick={runOptimizeCurrent} disabled={optimizerFocusLocked}>
                Optimize Current
              </button>

              <button onClick={runOptimizeAll} disabled={!optimizerBatchGames?.length}>
                Optimize All
              </button>

              <button
                onClick={() => addPreviewInning(optimizerFocusGame.id)}
                disabled={optimizerFocusLocked}
              >
                Add Inning
              </button>

              <button
                onClick={() => toggleLineupLocked(optimizerFocusGame.id, !optimizerFocusLocked)}
              >
                {optimizerFocusLocked ? 'Unlock' : 'Lock'}
              </button>

              <button
                onClick={() => clearPreviewLineup(optimizerFocusGame.id)}
                disabled={optimizerFocusLocked}
              >
                Clear
              </button>
            </div>
          </div>

          <div className="table-scroll">
            <LineupGrid
              players={activePlayers}
              lineup={optimizerFocusLineup}
              fitMap={fitByPlayer}
              optimizerProfileRules={optimizerProfileRules}
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
                togglePreviewBattingLock?.(optimizerFocusGame.id, playerId)
              }
              onAllBattingLockToggle={() =>
                togglePreviewAllBattingLock?.(optimizerFocusGame.id)
              }
              currentBatchTotals={currentBatchTotals}
              optimizerPlanSitOutTargets={optimizerPlanSitOutTargets}
            />
          </div>
        </div>
      )}

      {showMobileLineupCard && (
        <MobileLineupCard
          title="Current Plan Lineup Card"
          game={optimizerFocusGame}
          lineup={optimizerFocusLineup}
          players={activePlayers}
          pk={pk}
          onClose={() => setShowMobileLineupCard(false)}
        />
      )}
    </>
  )
}
