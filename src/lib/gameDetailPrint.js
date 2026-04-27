export function printGameDetail({
  selectedGame,
  selectedLineup,
  activePlayers,
  formatDateShort,
  pk,
}) {
  const htmlEscape = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const availableIds = new Set((selectedLineup?.availablePlayerIds || []).map(pk))

  const printPlayers = [...(activePlayers || [])]
    .filter((player) => availableIds.has(pk(player.id)))
    .sort((a, b) => {
      const aOrder = Number(selectedLineup?.battingOrder?.[pk(a.id)] || 999)
      const bOrder = Number(selectedLineup?.battingOrder?.[pk(b.id)] || 999)
      return aOrder - bOrder
    })

  const inningHeaders = Array.from({ length: Number(selectedLineup?.innings || 0) })
    .map((_, i) => `<th>${i + 1}</th>`)
    .join('')

  const playerRows = printPlayers
    .map((player) => {
      const id = pk(player.id)

      const cells = Array.from({ length: Number(selectedLineup?.innings || 0) })
        .map((_, i) => {
          const inning = i + 1
          const value = selectedLineup?.cells?.[id]?.[inning]
          return `<td>${htmlEscape(value === 'Out' ? 'OUT' : value || '-')}</td>`
        })
        .join('')

      return `
        <tr>
          <td>${htmlEscape(selectedLineup?.battingOrder?.[id] || '')}</td>
          <td class="name">${htmlEscape(player.name)}</td>
          <td>${htmlEscape(player.jersey_number || '')}</td>
          ${cells}
        </tr>
      `
    })
    .join('')

  const html = `
    <html>
      <head>
        <title>Game Lineup</title>
        <style>
          @page { size: letter portrait; margin: 0.35in; }
          body { font-family: Arial, sans-serif; color: #1f2f46; }
          h1 { font-size: 18px; margin: 0 0 10px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td {
            border: 1px solid #111;
            padding: 5px;
            text-align: center;
            font-size: 11px;
          }
          th { background: #e6f4f4; font-weight: 800; }
          .name { text-align: left; width: 110px; }
          th:nth-child(1), td:nth-child(1) { width: 34px; }
          th:nth-child(2), td:nth-child(2) { width: 110px; }
          th:nth-child(3), td:nth-child(3) { width: 34px; }
        </style>
      </head>
      <body>
        <h1>${htmlEscape(formatDateShort(selectedGame?.date) || 'No Date')} vs ${htmlEscape(selectedGame?.opponent || 'Opponent')}</h1>
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
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
