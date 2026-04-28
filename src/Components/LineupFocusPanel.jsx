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

            <div className="small-note">
  {optimizerMode === 'standard' && (
    <>
      <strong>Balanced Competitive & Development:</strong> Mixes strong lineups with fair
      distribution of positions and sit-outs. Best overall default.
    </>
  )}

  {optimizerMode === 'tournament' && (
    <>
      <strong>Tournament - Competitive:</strong> Prioritizes strongest defensive lineup,
      keeping players in their best positions as much as possible.
    </>
  )}

  {optimizerMode === 'friendly' && (
    <>
      <strong>Friendly - Development Focused:</strong> Increases position rotation and
      gives more players opportunities at different spots while still avoiding poor fits.
    </>
  )}
</div>
          </div>
        </div>
      )}

      {optimizerFocusLineup && (
        <div className="card">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Grid</h3>

            <div className="button-row">
              <button
  type="button"
  onClick={() => setShowMobileLineupCard(true)}
  disabled={!optimizerFocusGame || !optimizerFocusLineup}
>
  Lineup Card
</button>
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
                            onBattingLockToggle={(playerId) => {
                if (typeof togglePreviewBattingLock !== 'function') return
                togglePreviewBattingLock(optimizerFocusGame.id, playerId)
              }}
              onAllBattingLockToggle={() => {
                if (typeof togglePreviewAllBattingLock !== 'function') return
                togglePreviewAllBattingLock(optimizerFocusGame.id)
              }}
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
