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
  function printPositioningPriority() {
    const priorityRows = activePriorityRows
      .map((row) => {
        const cells = PRIORITY_POSITIONS.map(
          (position) => `<td>${row[position] || ''}</td>`
        ).join('')

        return `
          <tr>
            <td class="name">${row.name}</td>
            <td>${row.jersey_number || ''}</td>
            ${cells}
            <td>${row.subtotal || ''}</td>
          </tr>
        `
      })
      .join('')

    const priorityFooterCells = PRIORITY_POSITIONS.map(
      (position) => `<th>${priorityFooter[position] || ''}</th>`
    ).join('')

    const allowedPositionRows = allowedRows
      .map((row) => {
        const cells = ALLOWED_POSITIONS.map((position) => {
          const tier = fitByPlayer[row.playerId]?.[position] || 'secondary'

          const lockedPrimary =
            Number(priorityByPlayer[row.playerId]?.[position]?.priority_pct || 0) > 0 ||
            (['LF', 'RF'].includes(position) &&
              Number(priorityByPlayer[row.playerId]?.OF?.priority_pct || 0) > 0)

          const effectiveTier = lockedPrimary ? 'primary' : tier

          const label =
            effectiveTier === 'primary'
              ? 'Primary'
              : effectiveTier === 'secondary'
              ? 'Non-Primary'
              : 'No'

          const className =
            effectiveTier === 'primary'
              ? 'primary'
              : effectiveTier === 'secondary'
              ? 'secondary'
              : 'no'

          return `<td class="${className}">${label}</td>`
        }).join('')

        return `
          <tr>
            <td class="name">${row.name}</td>
            <td>${row.jersey_number || ''}</td>
            ${cells}
          </tr>
        `
      })
      .join('')

    const html = `
      <html>
        <head>
          <title>Positioning Priority</title>
          <style>
            @page { size: letter landscape; margin: 0.3in; }

            body {
              font-family: Arial, sans-serif;
              color: #1f2f46;
            }

            h1 {
              font-size: 20px;
              margin: 0 0 6px;
            }

            h2 {
              font-size: 15px;
              margin: 14px 0 6px;
            }

            .note {
              font-size: 11px;
              margin-bottom: 10px;
              color: #475569;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
              margin-bottom: 12px;
            }

            th,
            td {
              border: 1px solid #111;
              padding: 4px 5px;
              text-align: center;
              vertical-align: middle;
              font-size: 10px;
            }

            th {
              background: #e6f4f4;
              font-weight: 800;
            }

            .name {
              text-align: left;
              width: 115px;
            }

            .primary {
              background: #dcfce7;
              font-weight: 700;
            }

            .secondary {
              background: #fef3c7;
            }

            .no {
              background: #fee2e2;
              font-weight: 700;
            }

            .legend {
              display: flex;
              gap: 12px;
              font-size: 10px;
              margin-bottom: 8px;
            }

            .legend span {
              display: inline-block;
              padding: 3px 8px;
              border: 1px solid #111;
            }
                        .page-break {
              page-break-before: always;
              break-before: page;
            }
          </style>
        </head>

        <body>
          <h1>Positioning Priority</h1>
          <div class="note">
            Priority percentages are target shares of each player’s field innings.
          </div>

          <h2>Priority Targets</h2>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>#</th>
                ${PRIORITY_POSITIONS.map((position) => `<th>${position}</th>`).join('')}
                <th>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              ${priorityRows}
            </tbody>
            <tfoot>
              <tr>
                <th colspan="2">Subtotal</th>
                ${priorityFooterCells}
                <th>${priorityFooter.subtotal || ''}</th>
              </tr>
            </tfoot>
          </table>

                <div class="page-break"></div>

          <h2>Allowed Positions</h2>
          <div class="legend">
            <span class="primary">Primary</span>
            <span class="secondary">Non-Primary</span>
            <span class="no">No</span>
          </div>

          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>#</th>
                ${ALLOWED_POSITIONS.map((position) => `<th>${position}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${allowedPositionRows}
            </tbody>
          </table>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="table-scroll">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <div>
              <h2 style={{ marginBottom: 4 }}>Positioning Priority</h2>
              <p className="small-note" style={{ marginBottom: 0 }}>
                These percentages are used as a target share of that player’s field innings.
              </p>
            </div>

            <button type="button" onClick={printPositioningPriority}>
              Print Positioning Priority
            </button>
          </div>

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
