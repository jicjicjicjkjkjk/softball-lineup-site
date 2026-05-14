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
  const normalized = String(fit || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFF0D]/g, '-')
    .replace(/\s+/g, ' ')

  if (normalized === 'primary' || normalized === 'a') return '#dcfce7'

  if (
    normalized === 'secondary' ||
    normalized === 'non-primary' ||
    normalized === 'non primary' ||
    normalized === 'non_primary' ||
    normalized === 'nonprimary' ||
    normalized.includes('non') && normalized.includes('primary') ||
    normalized === 'b' ||
    normalized === 'c' ||
    normalized === 'development' ||
    normalized === 'd'
  ) {
    return '#fef9c3'
  }

  if (
    normalized === 'no' ||
    normalized === 'not_allowed' ||
    normalized === 'not-allowed' ||
    normalized === 'not allowed' ||
    normalized === 'e'
  ) {
    return '#fee2e2'
  }

  return ''
}

function positionFit(fitByPlayer, playerId, position) {
  if (!fitByPlayer) return ''

  const id = pk(playerId)

  if (['LF', 'CF', 'RF'].includes(position)) {
    return fitByPlayer?.[id]?.[position] || fitByPlayer?.[id]?.OF || ''
  }

  return fitByPlayer?.[id]?.[position] || ''
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
  extraRunningTotals = [],
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
        ...Object.fromEntries(
  (extraRunningTotals || []).map((item) => [
    item.key,
    safeNumber(item.totals?.[id]?.sitOutRunningTotal),
  ])
),
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

  function header(label, key) {
    return <th onClick={() => setSortConfig(nextSort(sortConfig, key))}>{label}</th>
  }

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
            {header('Player', 'name')}
            {header('Games', 'games')}
            {header('Fld', 'fieldTotal')}
            {header('Out', 'Out')}

            {showSitOutTargets && (
              <>
                {header('Plan Target Outs', 'targetOuts')}
                {header('Gap', 'gap')}
              </>
            )}

            {header('P', 'P')}
            {header('C', 'C')}
            {header('1B', '1B')}
            {header('2B', '2B')}
            {header('3B', '3B')}
            {header('SS', 'SS')}
            {header('LF', 'LF')}
            {header('CF', 'CF')}
            {header('RF', 'RF')}
            {header('IF', 'IF')}
            {header('OF', 'OF')}

            {!hideSitOutRunningTotal && header(runningTotalLabel, 'sitOutRunningTotal')}

            {(extraRunningTotals || []).map((item) => (
              <th key={item.key} onClick={() => setSortConfig(nextSort(sortConfig, item.key))}>
                {item.label}
              </th>
            ))}
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

              <td>{displayNumber(row.IF)}</td>
              <td>{displayNumber(row.OF)}</td>

              {!hideSitOutRunningTotal && (
                <td>{displayRunningTotal(row.sitOutRunningTotal)}</td>
              )}

              {(extraRunningTotals || []).map((item) => (
  <td key={`${row.playerId}-${item.key}`}>
    {displayRunningTotal(row[item.key])}
  </td>
))}
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
            safeNumber(planSitOutSummary.totalNeeded) - safeNumber(planSitOutSummary.totalAssigned)
          )}
        </div>
      )}
    </div>
  )
}
