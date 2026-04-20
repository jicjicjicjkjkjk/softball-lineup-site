import { pk } from '../lib/lineupUtils'

function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function sortRows(rows, sort) {
  if (!sort?.key) return rows
  const dir = sort.direction === 'desc' ? -1 : 1

  return [...rows].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    const an = Number(av)
    const bn = Number(bv)
    const aNum = !Number.isNaN(an) && String(av ?? '').trim() !== ''
    const bNum = !Number.isNaN(bn) && String(bv ?? '').trim() !== ''

    if (aNum && bNum) return (an - bn) * dir
    return String(av ?? '').localeCompare(String(bv ?? '')) * dir
  })
}

function getLastRunningValue(row) {
  const values = row?.running || []
  for (let i = values.length - 1; i >= 0; i -= 1) {
    const v = values[i]
    if (v !== 'x' && v !== '' && v !== null && v !== undefined) {
      return v
    }
  }
  return 0
}

export default function TrackingTable({
  title,
  totals,
  sitOutRows = [],
  players,
  sortConfig,
  setSortConfig,
  universeLabel,
  center = true,
}) {

  const rows = sortRows(
    (players || []).map((player) => {
      const id = pk(player.id)
      return {
  playerId: id,
  name: player.name,
  games: totals?.[id]?.games || 0,
  fieldTotal: totals?.[id]?.fieldTotal || 0,
  Out: totals?.[id]?.Out || 0,
  sitOutRunningTotal: sitOutMap[id] ?? 0,
  P: totals?.[id]?.P || 0,
  C: totals?.[id]?.C || 0,
  '1B': totals?.[id]?.['1B'] || 0,
  '2B': totals?.[id]?.['2B'] || 0,
  '3B': totals?.[id]?.['3B'] || 0,
  SS: totals?.[id]?.SS || 0,
  LF: totals?.[id]?.LF || 0,
  CF: totals?.[id]?.CF || 0,
  RF: totals?.[id]?.RF || 0,
  IF: totals?.[id]?.IF || 0,
  OF: totals?.[id]?.OF || 0,
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
