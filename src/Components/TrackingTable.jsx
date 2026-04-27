// FILE: src/Components/TrackingTable.jsx

import { pk } from '../lib/lineupUtils'
import { nextSort, sortRows } from '../lib/appHelpers'

function safeNumber(val) {
  const n = Number(val)
  return Number.isNaN(n) ? 0 : n
}

function displayNumber(val) {
  return Math.round(safeNumber(val))
}

function displayRunningTotal(val) {
  const n = safeNumber(val)
  return Number.isInteger(n) ? n : Number(n.toFixed(2))
}

function getFitColor(fit) {
  const normalized = String(fit || '').toLowerCase().trim()

  if (normalized === 'primary' || normalized === 'a') return '#dcfce7'

  if (
    normalized === 'secondary' ||
    normalized === 'non-primary' ||
    normalized === 'nonprimary' ||
    normalized === 'b' ||
    normalized === 'c'
  ) {
    return '#fef9c3'
  }

  if (
    normalized === 'no' ||
    normalized === 'not_allowed' ||
    normalized === 'not-allowed' ||
    normalized === 'not allowed' ||
    normalized === 'd' ||
    normalized === 'e'
  ) {
    return '#fee2e2'
  }

    return '#fee2e2'
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
  editableSitOutTargets = false,
  hideSitOutRunningTotal = false,
  fitByPlayer = {},
  enableFitColors = false,
  planSitOutSummary = null,
  runningTotalLabel = 'Sit Out Running Total',
}) {
  const sitOutRunningByPlayer = Object.fromEntries(
    (sitOutRows || []).map((row) => {
      const runningValues = (row.running || []).filter(
        (v) => v !== 'x' && v !== '' && v !== null && v !== undefined
      )

      const lastRunningValue = runningValues.length ? runningValues[runningValues.length - 1] : 0
      return [pk(row.playerId), safeNumber(lastRunningValue)]
    })
  )

  const rows = sortRows(
    (players || []).map((player) => {
      const id = pk(player.id)
      const t = totals?.[id] || {}

      const targetOuts = sitOutTargets?.[id]

      const gap =
        targetOuts === '' || targetOuts == null
          ? ''
          : safeNumber(targetOuts) - safeNumber(t.Out)

      return {
        playerId: id,
        name: player.name,
        games: safeNumber(t.games),
        fieldTotal: safeNumber(t.fieldTotal),
        Out: safeNumber(t.Out),
        targetOuts: targetOuts ?? '',
        gap,
        sitOutRunningTotal:
  sitOutRunningByPlayer[id] !== undefined
    ? safeNumber(sitOutRunningByPlayer[id])
    : safeNumber(t.sitOutRunningTotal),
        P: safeNumber(t.P),
        C: safeNumber(t.C),
        '1B': safeNumber(t['1B']),
        '2B': safeNumber(t['2B']),
        '3B': safeNumber(t['3B']),
        SS: safeNumber(t.SS),
        LF: safeNumber(t.LF),
        CF: safeNumber(t.CF),
        RF: safeNumber(t.RF),
        IF: safeNumber(t.IF),
        OF: safeNumber(t.OF),
      }
    }),
    sortConfig
  )

  function posCell(row, position) {
    const value = displayNumber(row[position])
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
                {runningTotalLabel}
              </th>
            )}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.playerId}`}>
              <td>{row.name}</td>
              <td>{displayNumber(row.games)}</td>
              <td>{displayNumber(row.fieldTotal)}</td>
              <td>{displayNumber(row.Out)}</td>

              {showSitOutTargets && (
                <>
                  <td>
                    {editableSitOutTargets ? (
                      <input
                        type="number"
                        min="0"
                        value={row.targetOuts}
                        onChange={(e) =>
                          setSitOutTargets?.((prev) => ({
                            ...prev,
                            [row.playerId]:
                              e.target.value === '' ? '' : Number(e.target.value),
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

              <td>{displayNumber(row.IF)}</td>
              <td>{displayNumber(row.OF)}</td>

              {!hideSitOutRunningTotal && (
  <td>{displayRunningTotal(row.sitOutRunningTotal)}</td>
)}
            </tr>
          ))}
        </tbody>
      </table>

      {planSitOutSummary && (
        <div className="summary-box" style={{ marginTop: 16 }}>
          <strong>Total Sit-Outs Needed:</strong> {displayNumber(planSitOutSummary.totalNeeded)}
          <br />
          <strong>Total Assigned:</strong> {displayNumber(planSitOutSummary.totalAssigned)}
          <br />
          <strong>Remaining:</strong>{' '}
          {displayNumber(
            safeNumber(planSitOutSummary.totalNeeded) -
              safeNumber(planSitOutSummary.totalAssigned)
          )}
        </div>
      )}
    </div>
  )
}
