import { pk, fitTier } from '../lib/lineupUtils'
import { nextSort, sortRows } from '../lib/appHelpers'

const POSITION_COLUMNS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'IF', 'OF']

function fitColor(fitMap, playerId, position) {
  if (position === 'IF' || position === 'OF') return {}

  const tier = fitTier(fitMap, playerId, position)

  if (tier === 'primary' || tier === 'A') {
    return { background: '#dcfce7' }
  }

  if (tier === 'secondary' || tier === 'B' || tier === 'C' || tier === 'D') {
    return { background: '#fef9c3' }
  }

  if (tier === 'no' || tier === 'E') {
    return { background: '#fee2e2' }
  }

  return {}
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
  showSitOutTargets = false,
  hideSitOutRunningTotal = false,
  fitByPlayer = {},
  editableSitOutTargets = false,
  setSitOutTargets = null,
  planSitOutSummary = null,
  runningTotalLabel = 'Sit Out Running Total',
}) {
  const sitOutRunningByPlayer = Object.fromEntries(
    (sitOutRows || []).map((row) => {
      const runningValues = (row.running || []).filter(
        (v) => v !== 'x' && v !== '' && v !== null && v !== undefined
      )

      const lastRunningValue = runningValues.length
        ? runningValues[runningValues.length - 1]
        : 0

      return [pk(row.playerId), lastRunningValue]
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
          : Number(targetOuts) - Number(t.Out || 0)

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

  function updateTarget(playerId, value) {
    if (!setSitOutTargets) return

    setSitOutTargets((prev) => ({
      ...prev,
      [playerId]: value === '' ? '' : Number(value),
    }))
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

            {POSITION_COLUMNS.map((pos) => (
              <th key={pos} onClick={() => setSortConfig(nextSort(sortConfig, pos))}>
                {pos}
              </th>
            ))}

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
              <td>{row.games}</td>
              <td>{row.fieldTotal}</td>
              <td>{row.Out}</td>

              {showSitOutTargets && (
                <>
                  <td>
                    {editableSitOutTargets ? (
                      <input
                        type="number"
                        min="0"
                        value={row.targetOuts}
                        onChange={(e) => updateTarget(row.playerId, e.target.value)}
                        style={{ width: 60, textAlign: 'center' }}
                      />
                    ) : (
                      row.targetOuts
                    )}
                  </td>
                  <td>{row.gap}</td>
                </>
              )}

              {POSITION_COLUMNS.map((pos) => (
                <td
                  key={`${row.playerId}-${pos}`}
                  style={row[pos] ? fitColor(fitByPlayer, row.playerId, pos) : {}}
                >
                  {row[pos]}
                </td>
              ))}

              {!hideSitOutRunningTotal && <td>{row.sitOutRunningTotal}</td>}
            </tr>
          ))}
        </tbody>
      </table>

      {planSitOutSummary && (
        <div className="summary-box" style={{ marginTop: 16 }}>
          <strong>Total Sit-Outs Needed:</strong> {planSitOutSummary.totalNeeded}
          <br />
          <strong>Total Assigned:</strong> {planSitOutSummary.totalAssigned}
          <br />
          <strong>Remaining:</strong>{' '}
          {planSitOutSummary.totalNeeded - planSitOutSummary.totalAssigned}
        </div>
      )}
    </div>
  )
}
