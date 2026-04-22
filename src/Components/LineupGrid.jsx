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
      return String(a.name || '').localeCompare(String(b.name || ''))
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
              sortedRows.length > 0 &&
              sortedRows.every((p) => {
                const id = pk(p.id)
                return lineup?.lockedCells?.[id]?.[inning] === true
              })

            return (
              <th key={inning}>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                  
                  {/* ✅ REMOVE INNING (ONLY ONE PLACE) */}
                  {onRemoveInning ? (
                    <button
                      onClick={() => {
                        if (lockedLineup) return
                        if (!window.confirm(`Remove inning ${inning}?`)) return
                        onRemoveInning(inning)
                      }}
                      disabled={lockedLineup}
                      style={{
                        background: '#fbe4e4',
                        border: '1px solid #e5b4b4',
                        borderRadius: 6,
                        width: 24,
                        height: 22,
                        fontWeight: 700,
                        cursor: lockedLineup ? 'not-allowed' : 'pointer',
                      }}
                    >
                      ✕
                    </button>
                  ) : (
                    <div style={{ height: 22 }} />
                  )}

                  {/* DIAMOND */}
                  <MiniDiamond
                    status={status}
                    inning={inning}
                    lineup={lineup}
                    players={players}
                  />

                  {/* ✅ INNING LOCK */}
                  {showLocks && (
                    <input
                      type="checkbox"
                      checked={inningLocked}
                      disabled={lockedLineup}
                      onChange={() => onInningLockToggle?.(inning)}
                    />
                  )}

                  <div style={{ fontSize: 12, fontWeight: 600 }}>{inning}</div>
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

          return (
            <tr
              key={id}
              style={{
                opacity: rowLocked ? 0.6 : 1,
                background: rowLocked ? '#f8fafc' : 'white',
              }}
            >
              <td>{player.jersey_number || ''}</td>
              <td>{player.name}</td>

              {/* BATTING */}
              <td>
                <input
                  type="number"
                  value={lineup?.battingOrder?.[id] || ''}
                  disabled={lockedLineup}
                  onChange={(e) => onBattingChange(id, e.target.value)}
                  style={{ width: 50, textAlign: 'center' }}
                />
              </td>

              {/* ROW LOCK */}
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

              {/* CELLS */}
              {Array.from({ length: innings }, (_, i) => i + 1).map((inning) => {
                const value = lineup?.cells?.[id]?.[inning] || ''
                const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
                const effectiveLocked = lockedLineup || rowLocked || cellLocked

                let bg = value ? '#eef6ff' : 'white'

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
                      disabled={effectiveLocked}
                      onChange={(e) =>
                        onCellChange(id, inning, e.target.value)
                      }
                      style={{
                        background: bg,
                        height: 28,
                        fontSize: 12,
                      }}
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
