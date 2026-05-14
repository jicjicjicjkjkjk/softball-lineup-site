// src/Components/LineupGrid.jsx

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
  currentBatchTotals = {},
  optimizerPlanSitOutTargets = {},
  optimizerProfileRules = {},
  onGameSitOutTargetChange,
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

      const aOrder =
        aOrderRaw === '' || aOrderRaw === null || aOrderRaw === undefined
          ? 999
          : Number(aOrderRaw)

      const bOrder =
        bOrderRaw === '' || bOrderRaw === null || bOrderRaw === undefined
          ? 999
          : Number(bOrderRaw)

      if (aOrder !== bOrder) return aOrder - bOrder
      return String(a.name || '').localeCompare(String(b.name || ''))
    })

  const battingIds = sortedRows.map((player) => pk(player.id))
  const allBattingLocked =
    battingIds.length > 0 &&
    battingIds.every((id) => lineup?.lockedBattingOrder?.[id] === true)

  return (
    <table className="lineup-print-table">
      <thead>
        <tr>
          <th>#</th>
          <th className="player-col">Player</th>

          <th>
            <div className="batting-header">
              <span>Batting</span>

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
          </th>

          {showLocks && <th>Lock</th>}

          {Array.from({ length: innings }, (_, i) => i + 1).map((inning) => {
            const status = inningStatus(lineup, inning, players, fitMap, optimizerProfileRules)
            const inningLocked = lineup?.lockedInnings?.[inning] === true

            return (
              <th key={inning}>
                <div className="inning-header">
                  {onRemoveInning ? (
                    <button
                      type="button"
                      onClick={() => onRemoveInning?.(inning)}
                      disabled={lockedLineup}
                      className="inning-remove"
                      title={`Remove inning ${inning}`}
                    >
                      ✕
                    </button>
                  ) : (
                    <div style={{ height: 20 }} />
                  )}

                {inningLocked && (
  <div className="mini-inning-lock" title={`Inning ${inning} is locked`}>
    🔒
  </div>
)}

<MiniDiamond
  status={status}
  inning={inning}
  lineup={lineup}
  players={players}
/>

{showLocks && (
  <button
    type="button"
    className={`inning-lock-button ${inningLocked ? 'is-locked' : ''}`}
    disabled={lockedLineup}
    onClick={() => onInningLockToggle?.(inning)}
    title={inningLocked ? 'Unlock inning' : 'Lock inning'}
  >
    {inningLocked ? '🔒 Locked' : '🔓 Open'}
  </button>
)}

                  <div className="inning-number">{inning}</div>
                </div>
              </th>
            )
          })}

          <th>IF</th>
          <th>OF</th>
          <th>P</th>
          <th>C</th>
          <th>X</th>
          <th style={{ width: 85, whiteSpace: 'normal', lineHeight: 1.1 }}>
          Game Target Outs
          </th>
        </tr>
      </thead>

      <tbody>
        {sortedRows.map((player) => {
          const id = pk(player.id)
          const summary = rowSummary(lineup, id)
          const rowLocked = lineup?.lockedRows?.[id] === true
          const battingLocked = lineup?.lockedBattingOrder?.[id] === true

          return (
            <tr key={id} className={rowLocked ? 'row-locked' : ''}>
              <td>{player.jersey_number || ''}</td>
                            <td className="player-col">{player.name}</td>

              <td>
                <div className="batting-cell">
                  <input
                    type="number"
                    value={lineup?.battingOrder?.[id] || ''}
                    disabled={lockedLineup || battingLocked}
                    onChange={(e) => onBattingChange?.(id, e.target.value)}
                    className="batting-order-input"
                  />

                  {showLocks && (
  <label className="checkbox-item grid-lock-label grid-cell-lock-only" title="Lock batting order spot">
    <input
      type="checkbox"
      checked={battingLocked}
      disabled={lockedLineup}
      onChange={() => onBattingLockToggle?.(id)}
    />
  </label>
)}
                </div>
              </td>

              {showLocks && (
                <td>
                  <label className="checkbox-item grid-lock-label">
                    <input
                      type="checkbox"
                      checked={rowLocked}
                      disabled={lockedLineup}
                      onChange={() => onRowLockToggle?.(id)}
                    />
                    All
                  </label>
                </td>
              )}

              {Array.from({ length: innings }, (_, i) => i + 1).map((inning) => {
                const value = lineup?.cells?.[id]?.[inning] || ''
                const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
                const inningLocked = lineup?.lockedInnings?.[inning] === true
                const effectiveLocked = lockedLineup || rowLocked || inningLocked || cellLocked

                let background = value ? '#eef6ff' : 'white'

                if (FIELD_POSITIONS.includes(value)) {
                  const status = inningStatus(lineup, inning, players, fitMap, optimizerProfileRules)

                  if (status.duplicate.includes(value)) {
                    background = '#fee2e2'
                  } else {
                                        const rawTier = fitTier(fitMap, id, value)
const tier = String(rawTier || '').trim().toLowerCase()

const normalizedTier =
  tier === 'a' || tier === 'primary'
    ? 'primary'
    : tier === 'b' ||
      tier === 'c' ||
      tier === 'nc' ||
      tier === 'secondary' ||
      tier === 'non-primary' ||
      tier === 'non primary' ||
      tier === 'non_primary' ||
      tier === 'nonprimary'
    ? 'secondary'
    : tier === 'd' || tier === 'development'
    ? 'development'
    : 'no'

background =
  normalizedTier === 'primary'
    ? '#d1fae5'
    : normalizedTier === 'secondary' || normalizedTier === 'development'
    ? '#fef9c3'
    : '#fee2e2'
                    
                  }
                }

                return (
                  <td key={inning}>
                    <div className="position-cell">
                      <select
  title={`${player.name} ${value}: ${fitTier(fitMap, id, value) || 'blank'}`}
  value={value}
                        disabled={effectiveLocked}
                        onChange={(e) => onCellChange?.(id, inning, e.target.value)}
                        style={{ background }}
                        className="position-select"
                      >
                        {GRID_OPTIONS.map((option) => (
  <option key={option || 'blank'} value={option}>
    {option || '--'}
  </option>
))}
</select>

{showLocks && (
  <label className="checkbox-item grid-lock-label grid-cell-lock-only" title="Lock this cell">
    <input
      type="checkbox"
      checked={cellLocked}
      disabled={lockedLineup || rowLocked}
      onChange={() => onCellLockToggle?.(id, inning)}
    />
  </label>
)}
                    </div>
                  </td>
                )
              })}

                            <td>{summary.IF}</td>
              <td>{summary.OF}</td>
              <td>{summary.P}</td>
              <td>{summary.C}</td>
              <td>{summary.X}</td>
              <td>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={lineup?.gameSitOutTargets?.[id] ?? ''}
                  disabled={lockedLineup}
                  onChange={(e) => onGameSitOutTargetChange?.(id, e.target.value)}
                  className="batting-order-input"
                  style={{ width: 58, textAlign: 'center' }}
                />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
