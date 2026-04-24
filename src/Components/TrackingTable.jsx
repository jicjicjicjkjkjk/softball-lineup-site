import { pk, PRIORITY_POSITIONS } from '../lib/lineupUtils'
import { nextSort, sortRows } from '../lib/appHelpers'

function getFitColor(fit) {
  if (fit === 'primary' || fit === 'A') return '#dcfce7'
  if (fit === 'secondary' || fit === 'B' || fit === 'C') return '#fef9c3'
  if (fit === 'no' || fit === 'E' || fit === 'D') return '#fee2e2'
  return ''
}

function positionFit(fitByPlayer, playerId, position) {
  if (!fitByPlayer) return ''

  if (position === 'LF' || position === 'RF') {
    return fitByPlayer?.[pk(playerId)]?.[position] || fitByPlayer?.[pk(playerId)]?.OF || ''
  }

  if (position === 'CF') {
    return fitByPlayer?.[pk(playerId)]?.CF || fitByPlayer?.[pk(playerId)]?.OF || ''
  }

  return fitByPlayer?.[pk(playerId)]?.[position] || ''
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
  sitOutTargets = {},
setSitOutTargets,
showSitOutTargets = false,
hideSitOutRunningTotal = false,
fitByPlayer = {},
enableFitColors = false,
}) {
  const sitOutRunningByPlayer = Object.fromEntries(
    (sitOutRows || []).map((row) => {
      const runningValues = (row.running || []).filter(
        (v) => v !== 'x' && v !== '' && v !== null && v !== undefined
      )

      const lastRunningValue = runningValues.length ? runningValues[runningValues.length - 1] : 0
      return [pk(row.playerId), lastRunningValue]
    })
  )

  const rows = sortRows(
    (players || []).map((player) => {
      const id = pk(player.id)
      const t = totals?.[id] || {}
      const targetOuts = sitOutTargets?.[id]
      const gap =
        targetOuts === '' || targetOuts == null ? '' : Number(targetOuts) - Number(t.Out || 0)

      return {
        playerId: id,
        name: player.name,
        games: t.games || 0,
        fieldTotal: t.fieldTotal || 0,
        Out: t.Out || 0,
        targetOuts: targetOuts ?? '',
        gap,
        sitOutRunningTotal: sitOutRunningByPlayer[id] || 0,
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

  function posCell(row, position) {
    const value = row[position]
    const fit = positionFit(fitByPlayer, row.playerId, position)
    const backgroundColor = enableFitColors && value ? getFitColor(fit) : ''

    return <td style={backgroundColor ? { backgroundColor } : undefined}>{value}</td>
  }

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

            {showSitOutTargets && (
              <>
                <th onClick={() => setSortConfig(nextSort(sortConfig, 'targetOuts'))}>Target</th>
                <th onClick={() => setSortConfig(nextSort(sortConfig, 'gap'))}>Gap</th>
              </>
            )}

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

            {!hideSitOutRunningTotal && (
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'sitOutRunningTotal'))}>
                Sit Out Running Total
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.playerId}`}>
              <td>{row.name}</td>
              <td>{row.games}</td>
              <td>{row.fieldTotal}</td>
              <td>{row.Out}</td>

              {showSitOutTargets && (
                <>
                  <td>
  {showSitOutTargets === 'editable' ? (
    <input
      type="number"
      min="0"
      value={row.targetOuts}
      onChange={(e) =>
        setSitOutTargets?.((prev) => ({
          ...prev,
          [row.playerId]: e.target.value === '' ? '' : Number(e.target.value),
        }))
      }
      style={{ width: 60, textAlign: 'center' }}
    />
  ) : (
    row.targetOuts
  )}
</td>
                  <td>{row.gap}</td>
                </>
              )}

              {posCell(row, 'P')}
              {posCell(row, 'C')}
              {posCell(row, '1B')}
              {posCell(row, '2B')}
              {posCell(row, '3B')}
              {posCell(row, 'SS')}
              {posCell(row, 'LF')}
              {posCell(row, 'CF')}
              {posCell(row, 'RF')}

              <td>{row.IF}</td>
              <td>{row.OF}</td>

              {!hideSitOutRunningTotal && <td>{row.sitOutRunningTotal}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
