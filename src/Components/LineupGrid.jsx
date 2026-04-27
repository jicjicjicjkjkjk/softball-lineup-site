import {
  FIELD_POSITIONS,
  GRID_OPTIONS,
  pk,
  rowSummary,
  fitTier,
  inningStatus,
} from '../lib/lineupUtils'
import MiniDiamond from './MiniDiamond'

export default function LineupGrid({
  players,
  lineup,
  fitMap,
  showLocks,
  lockedLineup,
  visiblePlayerIds,
  onRemoveInning,
  onCellChange,
  onBattingChange,
  onCellLockToggle,
  onRowLockToggle,
  onInningLockToggle,
  onBattingLockToggle,
  onAllBattingLockToggle,
}) {
  const visibleSet = new Set((visiblePlayerIds || []).map(pk))
  const innings = Number(lineup?.innings || 0)

  const sortedRows = [...(players || [])]
    .filter((player) => visibleSet.has(pk(player.id)))
    .sort((a, b) => {
      const aOrderRaw = lineup?.battingOrder?.[pk(a.id)]
      const bOrderRaw = lineup?.battingOrder?.[pk(b.id)]
      const aOrder = aOrderRaw === '' || aOrderRaw == null ? 999 : Number(aOrderRaw)
      const bOrder = bOrderRaw === '' || bOrderRaw == null ? 999 : Number(bOrderRaw)
      if (aOrder !== bOrder) return aOrder - bOrder
      return String(a.name || '').localeCompare(String(b.name || ''))
    })

  const battingIds = sortedRows.map((player) => pk(player.id))
  const allBattingLocked =
    battingIds.length > 0 &&
    battingIds.every((id) => lineup?.lockedBattingOrder?.[id] === true)

  function getCellBackground(id, value, inning) {
    if (!value) return 'white'
    if (!FIELD_POSITIONS.includes(value)) return '#eef6ff'

    const status = inningStatus(lineup, inning, players, fitMap)
    if (status.duplicate.includes(value)) return '#fee2e2'

    const tier = fitTier(fitMap, id, value)
    if (tier === 'primary' || tier === 'A') return '#d1fae5'
    if (tier === 'secondary' || tier === 'B' || tier === 'C') return '#fef9c3'
    return '#fee2e2'
  }

  function renderPositionControl(id, inning, rowLocked = false) {
    const value = lineup?.cells?.[id]?.[inning] || ''
    const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
    const inningLocked = lineup?.lockedInnings?.[inning] === true
    const effectiveLocked = lockedLineup || rowLocked || inningLocked || cellLocked

    return (
      <div className="position-cell">
        <select
          value={value}
          disabled={effectiveLocked}
          onChange={(e) => onCellChange?.(id, inning, e.target.value)}
          style={{ background: getCellBackground(id, value, inning) }}
          className="position-select"
        >
          {GRID_OPTIONS.map((option) => (
            <option key={option || 'blank'} value={option}>
              {option || '--'}
            </option>
          ))}
        </select>

        {showLocks && (
          <label className="checkbox-item grid-lock-label">
            <input
              type="checkbox"
              checked={cellLocked}
              disabled={lockedLineup || rowLocked}
              onChange={() => onCellLockToggle?.(id, inning)}
            />
            Lock
          </label>
        )}
      </div>
    )
  }

  return (
    <>
      <div className="mobile-lineup-grid">
        <div className="mobile-lineup-header">
          <strong>Mobile Grid</strong>

          {showLocks && (
            <label className="checkbox-item grid-lock-label">
              <input
                type="checkbox"
                checked={allBattingLocked}
                disabled={lockedLineup}
                onChange={() => onAllBattingLockToggle?.()}
              />
              All Bat
            </label>
          )}
        </div>

        {sortedRows.map((player) => {
          const id = pk(player.id)
          const summary = rowSummary(lineup, id)
          const rowLocked = lineup?.lockedRows?.[id] === true
          const battingLocked = lineup?.lockedBattingOrder?.[id] === true

          return (
            <div key={id} className={`mobile-player-card ${rowLocked ? 'row-locked' : ''}`}>
              <div className="mobile-player-top">
                <div>
                  <div className="mobile-player-name">
                    #{player.jersey_number || ''} {player.name}
                  </div>
                  <div className="mobile-player-summary">
                    IF {summary.IF} · OF {summary.OF} · P {summary.P} · C {summary.C} · X {summary.X}
                  </div>
                </div>

                {showLocks && (
                  <label className="checkbox-item grid-lock-label">
                    <input
                      type="checkbox"
                      checked={rowLocked}
                      disabled={lockedLineup}
                      onChange={() => onRowLockToggle?.(id)}
                    />
                    All
                  </label>
                )}
              </div>

              <div className="mobile-batting-row">
                <label>Bat</label>
                <input
                  type="number"
                  value={lineup?.battingOrder?.[id] || ''}
                  disabled={lockedLineup || battingLocked}
                  onChange={(e) => onBattingChange?.(id, e.target.value)}
                  className="batting-order-input"
                />

                {showLocks && (
                  <button
                    type="button"
                    disabled={lockedLineup}
                    onClick={() => onBattingLockToggle?.(id)}
                    className="batting-lock-button"
                  >
                    {battingLocked ? '🔒 Bat' : '🔓 Bat'}
                  </button>
                )}
              </div>

              <div className="mobile-innings-row">
                {Array.from({ length: innings }, (_, i) => i + 1).map((inning) => (
                  <div key={inning} className="mobile-inning-cell">
                    <div className="mobile-inning-label">Inn {inning}</div>
                    {renderPositionControl(id, inning, rowLocked)}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      <table className="lineup-print-table desktop-lineup-grid">
        {/* keep your existing table exactly as before */}
      </table>
    </>
  )
}
