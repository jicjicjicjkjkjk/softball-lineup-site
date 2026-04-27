export function printCoachSummary({
  orderedPlanGames,
  optimizerPreviewByGame,
  lineupsByGame,
  activePlayers,
  currentPlanTotalsWithRunning,
  currentBatchTotals,
  trackingPriorityRows,
  fitByPlayer,
  gameTypeOptions,
  seasonOptions,
  formatDateShort,
  getOptionLabel,
  pk,
}) {
  const n = (value) => Math.round(Number(value || 0))

  const htmlEscape = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const lineupPages = orderedPlanGames
    .map((game) => {
      const lineup = optimizerPreviewByGame[pk(game.id)] || lineupsByGame[pk(game.id)]
      if (!lineup || !lineup.innings) return ''

      const playersInGame = activePlayers.filter((player) =>
        (lineup.availablePlayerIds || []).map(pk).includes(pk(player.id))
      )

      const sortedPlayers = [...playersInGame].sort((a, b) => {
        const aOrder = Number(lineup.battingOrder?.[pk(a.id)] ?? 999)
        const bOrder = Number(lineup.battingOrder?.[pk(b.id)] ?? 999)
        return aOrder - bOrder
      })

      const inningHeaders = Array.from({ length: Number(lineup.innings || 0) })
        .map((_, i) => `<th>${i + 1}</th>`)
        .join('')

      const playerRows = sortedPlayers
        .map((player) => {
          const id = pk(player.id)

          const cells = Array.from({ length: Number(lineup.innings || 0) })
            .map((_, i) => {
              const value = lineup.cells?.[id]?.[i + 1]

              let fitClass = ''
              if (value && value !== 'Out') {
                const fit =
                  fitByPlayer?.[id]?.[value] ||
                  (['LF', 'CF', 'RF'].includes(value) ? fitByPlayer?.[id]?.OF : '') ||
                  ''

                if (fit === 'primary' || fit === 'A') fitClass = 'primary'
                else if (fit === 'secondary' || fit === 'B' || fit === 'C') fitClass = 'secondary'
                else fitClass = 'not-allowed'
              }

              return `<td class="${fitClass}">${value === 'Out' ? 'OUT' : htmlEscape(value || '-')}</td>`
            })
            .join('')

          return `
            <tr>
              <td>${htmlEscape(lineup.battingOrder?.[id] || '')}</td>
              <td class="name">${htmlEscape(player.name)}</td>
              <td>${htmlEscape(player.jersey_number || '')}</td>
              ${cells}
            </tr>
          `
        })
        .join('')

      return `
        <section class="print-page">
          <h1>${htmlEscape(formatDateShort(game.date) || 'No Date')} vs ${htmlEscape(game.opponent || 'Opponent')}</h1>
          <div class="subtitle">
            ${htmlEscape(getOptionLabel(gameTypeOptions, game.game_type) || '')}
            ${htmlEscape(getOptionLabel(seasonOptions, game.season) || '')}
          </div>
          <table>
            <thead>
              <tr>
                <th>Bat</th>
                <th>Player</th>
                <th>#</th>
                ${inningHeaders}
              </tr>
            </thead>
            <tbody>${playerRows}</tbody>
          </table>
        </section>
      `
    })
    .join('')

  const currentPlanRows = activePlayers
    .map((player) => {
      const id = pk(player.id)
      const totals = currentPlanTotalsWithRunning?.[id] || {}

      return `
        <tr>
          <td class="name">${htmlEscape(player.name)}</td>
          <td>${n(totals.games)}</td>
          <td>${n(totals.fieldTotal)}</td>
          <td>${n(totals.Out)}</td>
          <td>${n(totals.P)}</td>
          <td>${n(totals.C)}</td>
          <td>${n(totals['1B'])}</td>
          <td>${n(totals['2B'])}</td>
          <td>${n(totals['3B'])}</td>
          <td>${n(totals.SS)}</td>
          <td>${n(totals.LF)}</td>
          <td>${n(totals.CF)}</td>
          <td>${n(totals.RF)}</td>
          <td>${n(totals.IF)}</td>
          <td>${n(totals.OF)}</td>
          <td>${Number(totals.sitOutRunningTotal || 0).toFixed(2)}</td>
        </tr>
      `
    })
    .join('')

  const pct = (numerator, denominator) => {
    const num = Number(numerator || 0)
    const den = Number(denominator || 0)
    if (!num || !den) return ''
    return Number(((num / den) * 100).toFixed(1))
  }

  const priorityTargetByPlayer = Object.fromEntries(
    (trackingPriorityRows || []).map((row) => [pk(row.playerId), row])
  )

  const priorityPositions = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']

  const priorityPlayerRowsHtml = activePlayers
    .map((player) => {
      const id = pk(player.id)
      const totals = currentBatchTotals?.[id] || {}
      const target = priorityTargetByPlayer[id] || {}
      const fieldTotal = Number(totals.fieldTotal || 0)

      return `
        <tr>
          <td class="name">${htmlEscape(player.name)}</td>
          <td>${n(fieldTotal)}</td>
          ${priorityPositions
            .map((pos) => {
              const targetKey = `targ${pos}`
              const totalValue = totals[pos] || 0
              return `<td>${htmlEscape(target[targetKey] || '')}</td><td>${pct(totalValue, fieldTotal)}</td>`
            })
            .join('')}
        </tr>
      `
    })
    .join('')

  const html = `
    <html>
      <head>
        <title>Coach Lineup Packet</title>
        <style>
          @page { size: letter portrait; margin: 0.35in; }
          body { font-family: Arial, sans-serif; color: #1f2f46; }
          .print-page { page-break-after: always; }
          h1 { font-size: 18px; margin: 0 0 4px; }
          .subtitle { font-size: 12px; margin-bottom: 10px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #111; padding: 5px; text-align: center; font-size: 11px; }
          th { background: #e6f4f4; font-weight: 800; }
          td.primary { background: #dcfce7; }
          td.secondary { background: #fef9c3; }
          td.not-allowed { background: #fee2e2; }
          .name { text-align: left; width: 110px; }
          .plan-page, .priority-page { page-break-before: always; }
          .plan-table th, .plan-table td { font-size: 9.5px; padding: 4px 3px; }
          .priority-print-table th, .priority-print-table td { font-size: 8.5px; padding: 3px 2px; }
        </style>
      </head>
      <body>
        ${lineupPages}

        <section class="plan-page">
          <h1>Current Plan</h1>
          <table class="plan-table">
            <thead>
              <tr>
                <th>Player</th><th>Games</th><th>Fld</th><th>Out</th>
                <th>P</th><th>C</th><th>1B</th><th>2B</th><th>3B</th><th>SS</th>
                <th>LF</th><th>CF</th><th>RF</th><th>IF</th><th>OF</th><th>Sit Run</th>
              </tr>
            </thead>
            <tbody>${currentPlanRows}</tbody>
          </table>
        </section>

        <section class="priority-page">
          <h1>Current Plan — Priority Tracking</h1>
          <table class="priority-print-table">
            <thead>
              <tr>
                <th>Player</th><th>Fld</th>
                ${priorityPositions.map((pos) => `<th>${pos} TGT</th><th>${pos} ACT</th>`).join('')}
              </tr>
            </thead>
            <tbody>${priorityPlayerRowsHtml}</tbody>
          </table>
        </section>
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
