export default function PositioningPriorityPage({
  activePriorityRows,
  prioritySort,
  setPrioritySort,
  nextSort,
  PRIORITY_POSITIONS,
  updatePriorityLocal,
  persistPriority,
  priorityFooter,
  allowedRows,
  allowedSort,
  setAllowedSort,
  ALLOWED_POSITIONS,
  fitByPlayer,
  priorityByPlayer,
  updateFitLocal,
  persistFitTier,
}) {
  return (
    <div className="stack">
      <div className="card">
        <div className="table-scroll">
          <h2>Positioning Priority</h2>
          <p className="small-note" style={{ marginBottom: 12 }}>
            These percentages are used as a target share of that player’s field innings.
          </p>

          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'name'))}>Player</th>
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'jersey_number'))}>#</th>
                {PRIORITY_POSITIONS.map((position) => (
                  <th key={position} onClick={() => setPrioritySort(nextSort(prioritySort, position))}>
                    {position}
                  </th>
                ))}
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'subtotal'))}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {activePriorityRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="player-col">{row.name}</td>
                  <td>{row.jersey_number}</td>
                  {PRIORITY_POSITIONS.map((position) => (
                    <td key={position}>
                      <input
                        className="input-center"
                        type="number"
                        min="0"
                        max="100"
                        value={row[position]}
                        onChange={(e) => updatePriorityLocal(row.playerId, position, e.target.value)}
                        onBlur={(e) => persistPriority(row.playerId, position, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>{row.subtotal}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="2">Subtotal</th>
                {PRIORITY_POSITIONS.map((position) => (
                  <th key={position}>{priorityFooter[position]}</th>
                ))}
                <th>{priorityFooter.subtotal}</th>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <h3>Allowed Positions</h3>
          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th onClick={() => setAllowedSort(nextSort(allowedSort, 'name'))}>Player</th>
                <th onClick={() => setAllowedSort(nextSort(allowedSort, 'jersey_number'))}>#</th>
                {ALLOWED_POSITIONS.map((position) => (
                  <th key={position} onClick={() => setAllowedSort(nextSort(allowedSort, position))}>
                    {position}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allowedRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="player-col">{row.name}</td>
                  <td>{row.jersey_number}</td>
                  {ALLOWED_POSITIONS.map((position) => {
                    const tier = fitByPlayer[row.playerId]?.[position] || 'secondary'
                    const lockedPrimary =
                      Number(priorityByPlayer[row.playerId]?.[position]?.priority_pct || 0) > 0 ||
                      (['LF', 'RF'].includes(position) &&
                        Number(priorityByPlayer[row.playerId]?.OF?.priority_pct || 0) > 0)

                    const background =
                      tier === 'primary'
                        ? '#dcfce7'
                        : tier === 'secondary'
                        ? '#fef3c7'
                        : '#fee2e2'

                    return (
                      <td key={position}>
                        <select
                          value={lockedPrimary ? 'primary' : tier}
                          style={{ background }}
                          disabled={lockedPrimary}
                          onChange={(e) => {
                            updateFitLocal(row.playerId, position, e.target.value)
                            persistFitTier(row.playerId, position, e.target.value)
                          }}
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Non-Primary</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
