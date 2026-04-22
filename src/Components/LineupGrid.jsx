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
}) {
  const visibleSet = new Set((visiblePlayerIds || []).map(pk))
  const innings = Number(lineup?.innings || 0)

  const sortedRows = [...(players || [])]
    .filter((p) => visibleSet.has(pk(p.id)))
    .sort((a, b) => {
      const aOrder = Number(lineup?.battingOrder?.[pk(a.id)] || 999)
      const bOrder = Number(lineup?.battingOrder?.[pk(b.id)] || 999)
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })

  return (
    <table className="lineup-print-table">
      <thead>
        <tr>
          <th>#</th>
          <th className="player-col">Player</th>
          <th>Batting</th>
          {showLocks && <th>Lock</th>}

          {Array.from({ length: innings }, (_, i) => i + 1).map((inning) => {
            const status = inningStatus(lineup, inning, players, fitMap)

            const inningLocked =
              sortedRows.length &&
              sortedRows.every((p) => {
                const id = pk(p.id)
                return lineup?.lockedCells?.[id]?.[inning]
              })

            return (
              <th key={inning}>
                <div className="inning-header">

                  {/* REMOVE */}
                  <button
                    className="inning-remove"
                    onClick={() => {
                      if (lockedLineup) return
                      if (!window.confirm(`Remove inning ${inning}?`)) return
                      onRemoveInning?.(inning)
                    }}
                    disabled={lockedLineup}
                  >
                    ✕
                  </button>

                  {/* DIAMOND */}
                  <MiniDiamond
                    status={status}
                    inning={inning}
                    lineup={lineup}
                    players={players}
                  />

                  {/* LOCK */}
                  {showLocks && (
                    <input
                      type="checkbox"
                      className="inning-lock"
                      checked={inningLocked}
                      disabled={lockedLineup}
                      onChange={() => onInningLockToggle?.(inning)}
                    />
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
          const rowLocked = lineup?.lockedRows?.[id]

          return (
            <tr key={id} className={rowLocked ? 'row-locked' : ''}>
              <td>{player.jersey_number || ''}</td>
              <td>{player.name}</td>

              <td>
                <input
                  type="number"
                  value={lineup?.battingOrder?.[id] || ''}
                  disabled={lockedLineup || rowLocked}
                  onChange={(e) => onBattingChange(id, e.target.value)}
                />
              </td>

              {showLocks && (
                <td>
                  <input
                    type="checkbox"
                    checked={rowLocked}
                    disabled={lockedLineup}
                    onChange={() => onRowLockToggle(id)}
                  />
                </td>
              )}

              {Array.from({ length: innings }, (_, i) => i + 1).map((inning) => {
                const value = lineup?.cells?.[id]?.[inning] || ''
                const cellLocked = lineup?.lockedCells?.[id]?.[inning]

                let bg = 'white'

                if (FIELD_POSITIONS.includes(value)) {
                  const status = inningStatus(lineup, inning, players, fitMap)

                  if (status.duplicate.includes(value)) {
                    bg = '#fee2e2'
                  } else {
                    const tier = fitTier(fitMap, id, value)
                    bg =
                      tier === 'primary'
                        ? '#d1fae5'
                        : tier === 'secondary'
                        ? '#fef9c3'
                        : '#fee2e2'
                  }
                }

                return (
                  <td key={inning}>
                    <select
                      value={value}
                      disabled={lockedLineup || rowLocked}
                      onChange={(e) =>
                        onCellChange(id, inning, e.target.value)
                      }
                      style={{ background: bg }}
                    >
                      {GRID_OPTIONS.map((opt) => (
                        <option key={opt || 'blank'} value={opt}>
                          {opt || '--'}
                        </option>
                      ))}
                    </select>

                    {showLocks && (
                      <input
                        type="checkbox"
                        checked={cellLocked}
                        disabled={lockedLineup || rowLocked}
                        onChange={() => onCellLockToggle(id, inning)}
                      />
                    )}
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
