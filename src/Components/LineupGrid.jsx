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
  onCellChange,
  onBattingChange,
  onCellLockToggle,
  onRowLockToggle,
  onInningLockToggle,
}) {
  const visibleSet = new Set((visiblePlayerIds || []).map(pk))

  const sortedRows = [...(players || [])]
    .filter((player) => visibleSet.has(pk(player.id)))
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
          <th>Batting Order</th>
          {showLocks && <th>Lock</th>}

          {Array.from({ length: Number(lineup?.innings || 0) }, (_, i) => i + 1).map((inning) => {
            const status = inningStatus(lineup, inning, players, fitMap)

            const inningLocked =
              sortedRows.length > 0 &&
              sortedRows.every((player) => {
                const id = pk(player.id)
                return lineup?.lockedCells?.[id]?.[inning] === true
              })

            return (
              <th key={inning}>
                <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
                  <MiniDiamond status={status} inning={inning} lineup={lineup} players={players} />

                  {showLocks && (
                    <label className="checkbox-item" style={{ margin: 0, fontSize: 12 }}>
                      <input
                        type="checkbox"
                        checked={inningLocked}
                        disabled={lockedLineup}
                        onChange={() => onInningLockToggle?.(inning)}
                      />
                      Inning
                    </label>
                  )}

                  <div style={{ marginTop: 2 }}>{inning}</div>
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
            <tr key={id}>
              <td>{player.jersey_number || ''}</td>
              <td>{player.name}</td>

              <td>
                <input
                  type="number"
                  value={lineup?.battingOrder?.[id] || ''}
                  disabled={lockedLineup}
                  onChange={(e) => onBattingChange(id, e.target.value)}
                  style={{ width: 72, textAlign: 'center' }}
                />
              </td>

              {showLocks && (
                <td>
                  <label className="checkbox-item" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={rowLocked}
                      disabled={lockedLineup}
                      onChange={() => onRowLockToggle(id)}
                    />
                    All
                  </label>
                </td>
              )}

              {Array.from({ length: Number(lineup?.innings || 0) }, (_, i) => i + 1).map((inning) => {
                const value = lineup?.cells?.[id]?.[inning] || ''
                const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
                const effectiveLocked = lockedLineup || rowLocked || cellLocked

                let background = value ? '#eef6ff' : 'white'

                if (FIELD_POSITIONS.includes(value)) {
                  const status = inningStatus(lineup, inning, players, fitMap)
                  if (status.duplicate.includes(value)) {
                    background = '#fee2e2'
                  } else {
                    const tier = fitTier(fitMap, id, value)
                    background =
                      tier === 'primary'
                        ? '#dcfce7'
                        : tier === 'secondary'
                        ? '#fef3c7'
                        : '#fee2e2'
                  }
                }

                return (
                  <td key={inning}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <select
                        value={value}
                        disabled={effectiveLocked}
                        onChange={(e) => onCellChange(id, inning, e.target.value)}
                        style={{ background }}
                      >
                        {GRID_OPTIONS.map((option) => (
                          <option key={option || 'blank'} value={option}>
                            {option || '--'}
                          </option>
                        ))}
                      </select>

                      {showLocks && (
                        <label className="checkbox-item" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={cellLocked}
                            disabled={lockedLineup || rowLocked}
                            onChange={() => onCellLockToggle(id, inning)}
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
