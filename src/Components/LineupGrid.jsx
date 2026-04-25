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
            const status = inningStatus(lineup, inning, players, fitMap)
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

                  <MiniDiamond
                    status={status}
                    inning={inning}
                    lineup={lineup}
                    players={players}
                  />

                  {showLocks && (
                    <label className="inning-lock-wrap">
                      <input
                        type="checkbox"
                        className="inning-lock"
                        checked={inningLocked}
                        disabled={lockedLineup}
                        onChange={() => onInningLockToggle?.(inning)}
                      />
                      <span>Inning</span>
                    </label>
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
                    <button
                      type="button"
                      disabled={lockedLineup}
                      onClick={() => onBattingLockToggle?.(id)}
                      className="batting-lock-button"
                      title="Lock batting order spot"
                    >
                      {battingLocked ? '🔒 Bat' : '🔓 Bat'}
                    </button>
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
                  const status = inningStatus(lineup, inning, players, fitMap)

                  if (status.duplicate.includes(value)) {
                    background = '#fee2e2'
                  } else {
                    const tier = fitTier(fitMap, id, value)
                    background =
                      tier === 'primary' || tier === 'A'
                        ? '#d1fae5'
                        : tier === 'secondary' || tier === 'B' || tier === 'C'
                        ? '#fef9c3'
                        : '#fee2e2'
                  }
                }

                return (
                  <td key={inning}>
                    <div className="position-cell">
                      <select
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
                  </td>
                )
              })}

              <td>{summary.IF}</td>
              <td>{summary.OF}</td>
              <td>{summary.P}</td>
              <td>{summary.C}</td>
              <td>{summary.X}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
