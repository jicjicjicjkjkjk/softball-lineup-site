import MiniDiamond from "./MiniDiamond";
import { GRID_OPTIONS, rowSummary, fitTier } from '../lib/lineupUtils'

export default function LineupGrid({
  players,
  lineup,
  fitByPlayer,
  showLocks,
  lockedLineup,
  hideUnavailable,
  onCellChange,
  onBattingChange,
  onCellLockToggle,
  onRowLockToggle,
}) {
  const availableSet = new Set((lineup.availablePlayerIds || []).map(String))

  const visiblePlayers = players.filter((player) => {
    if (!hideUnavailable) return true
    return availableSet.has(String(player.id))
  })

  const sortedRows = [...visiblePlayers].sort((a, b) => {
    const aOrder = Number(lineup.battingOrder[String(a.id)] || 999)
    const bOrder = Number(lineup.battingOrder[String(b.id)] || 999)
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  })

  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>BO</th>
          {showLocks && <th>Lock</th>}
          {Array.from({ length: lineup.innings }, (_, i) => i + 1).map((inning) => (
            <th key={inning}>
              <MiniDiamond lineup={lineup} inning={inning} />
              <div style={{ textAlign: 'center', marginTop: 4 }}>{inning}</div>
            </th>
          ))}
          <th>IF</th>
          <th>OF</th>
          <th>P</th>
          <th>C</th>
          <th>X</th>
        </tr>
      </thead>

      <tbody>
        {sortedRows.map((player) => {
          const pid = String(player.id)
          const summary = rowSummary(lineup, pid)
          const rowLocked = lineup.lockedRows?.[pid] || false

          return (
            <tr key={pid}>
              <td>{player.jersey_number || ''}</td>
              <td>{player.name}</td>

              <td>
                <input
                  type="number"
                  value={lineup.battingOrder[pid] || ''}
                  disabled={lockedLineup}
                  onChange={(e) => onBattingChange(pid, e.target.value)}
                  style={{ width: 56 }}
                />
              </td>

              {showLocks && (
                <td>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center', margin: 0, fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={rowLocked}
                      onChange={() => onRowLockToggle(pid)}
                      disabled={lockedLineup}
                      style={{ width: 'auto' }}
                    />
                    All
                  </label>
                </td>
              )}

              {Array.from({ length: lineup.innings }, (_, i) => i + 1).map((inning) => {
                const value = lineup.cells?.[pid]?.[inning] || ''
                const cellLocked = lineup.lockedCells?.[pid]?.[inning] || false
                const effectiveLocked = lockedLineup || rowLocked || cellLocked

                let background = value ? '#eef6ff' : 'white'

                if (['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF'].includes(value)) {
                  const tier = fitTier(fitByPlayer, pid, value)
                  background =
                    tier === 'primary'
                      ? '#dcfce7'
                      : tier === 'secondary'
                      ? '#fef3c7'
                      : '#fee2e2'
                }

                return (
                  <td key={inning}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <select
                        value={value}
                        disabled={effectiveLocked}
                        onChange={(e) => onCellChange(pid, inning, e.target.value)}
                        style={{ background }}
                      >
                        {GRID_OPTIONS.map((option) => (
                          <option key={option || 'blank'} value={option}>
                            {option || '--'}
                          </option>
                        ))}
                      </select>

                      {showLocks && (
                        <label style={{ display: 'flex', gap: 4, alignItems: 'center', margin: 0, fontWeight: 400 }}>
                          <input
                            type="checkbox"
                            checked={cellLocked}
                            disabled={lockedLineup || rowLocked}
                            onChange={() => onCellLockToggle(pid, inning)}
                            style={{ width: 'auto' }}
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
