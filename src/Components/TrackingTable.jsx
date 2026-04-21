import { pk } from '../lib/lineupUtils'
import { nextSort, sortRows } from '../lib/appHelpers'

export default function TrackingTable({
  title,
  totals,
  players,
  sortConfig,
  setSortConfig,
  universeLabel,
  sitOutRows = [],
  center = true,
}) {
  const runningTotalsByPlayer = Object.fromEntries(
    (sitOutRows || []).map((row) => {
      const runningValues = (row.running || []).filter(
        (v) => v !== 'x' && v !== '' && v !== null && v !== undefined
      )

      const latestRunningTotal = runningValues.length
        ? runningValues[runningValues.length - 1]
        : 0

      return [row.playerId, latestRunningTotal]
    })
  )

  const rows = sortRows(
    (players || []).map((player) => {
      const id = pk(player.id)
      const t = totals?.[id] || {}

      return {
        playerId: id,
        name: player.name,
        games: t.games || 0,
        fieldTotal: t.fieldTotal || 0,
        Out: t.Out || 0,
        sitOutRunningTotal: runningTotalsByPlayer[id] || 0,
        P: t.P || 0,
        C: t.C || 0,
        '1B': t['1B'] || 0,
        '2B': t['2B'] || 0,
        '3B': t['3B'] || 0,
        SS: t.SS || 0,
        LF: t.LF || 0,
        CF: t.CF || 0,
        RF: t.RF || 0,
        IF: t.IF || 0,
        OF: t.OF || 0,
      }
    }),
    sortConfig
  )

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      {universeLabel ? (
        <>
          <div className="summary-box" style={{ marginBottom: 16 }}>
            <strong>{title} Universe:</strong> {universeLabel}
          </div>
          <h3>{title}</h3>
        </>
      ) : (
        <h3>{title}</h3>
      )}

      <table className={center ? 'table-center' : ''}>
        <thead>
          <tr>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'name'))}>Player</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'games'))}>Games</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'fieldTotal'))}>Fld</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'Out'))}>Out</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'P'))}>P</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'C'))}>C</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, '1B'))}>1B</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, '2B'))}>2B</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, '3B'))}>3B</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'SS'))}>SS</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'LF'))}>LF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'CF'))}>CF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'RF'))}>RF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'IF'))}>IF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'OF'))}>OF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'sitOutRunningTotal'))}>
              Sit Out Running Total
            </th>
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.playerId}`}>
              <td>{row.name}</td>
              <td>{row.games}</td>
              <td>{row.fieldTotal}</td>
              <td>{row.Out}</td>
              <td>{row.P}</td>
              <td>{row.C}</td>
              <td>{row['1B']}</td>
              <td>{row['2B']}</td>
              <td>{row['3B']}</td>
              <td>{row.SS}</td>
              <td>{row.LF}</td>
              <td>{row.CF}</td>
              <td>{row.RF}</td>
              <td>{row.IF}</td>
              <td>{row.OF}</td>
              <td>{row.sitOutRunningTotal}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
