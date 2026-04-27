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

  const innings = Number(selectedLineup?.innings || 0)

  const inningHeaders = Array.from({ length: innings })
    .map((_, i) => `<th>${i + 1}</th>`)
    .join('')

  const coachRows = printPlayers
    .map((player) => {
      const id = pk(player.id)

      const cells = Array.from({ length: innings })
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

  const opponentCardRows = printPlayers
    .map((player) => {
      const id = pk(player.id)
      const firstInningPosition = selectedLineup?.cells?.[id]?.[1] || ''
      const displayPosition = firstInningPosition === 'Out' ? 'Sub' : firstInningPosition || ''

      return `
        <tr>
          <td>${htmlEscape(selectedLineup?.battingOrder?.[id] || '')}</td>
          <td>${htmlEscape(player.jersey_number || '')}</td>
          <td class="name">${htmlEscape(player.name)}</td>
          <td>${htmlEscape(displayPosition)}</td>
          <td></td>
        </tr>
      `
    })
    .join('')

  const title = `${formatDateShort(selectedGame?.date) || 'No Date'} vs ${
    selectedGame?.opponent || 'Opponent'
  }`

  const html = `
    <html>
      <head>
        <title>Game Lineup</title>
        <style>
          @page { size: letter portrait; margin: 0.35in; }

          body {
            font-family: Arial, sans-serif;
            color: #1f2f46;
          }

          .page {
            page-break-after: always;
          }

          .page:last-child {
            page-break-after: auto;
          }

          .header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            margin-bottom: 10px;
          }

          .team-block {
            display: flex;
            align-items: center;
            gap: 10px;
          }

          .logo {
            width: 52px;
            height: 52px;
            object-fit: contain;
          }

          h1 {
            font-size: 18px;
            margin: 0 0 3px;
          }

          .subtitle {
            font-size: 12px;
            font-weight: 700;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            gap: 6px;
            margin: 10px 0;
          }

          .meta-box {
            border: 1px solid #111;
            padding: 5px;
            min-height: 30px;
            font-size: 11px;
          }

          .meta-label {
            font-weight: 800;
            display: block;
            margin-bottom: 2px;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            border: 1px solid #111;
            padding: 5px;
            text-align: center;
            font-size: 11px;
          }

          th {
            background: #e6f4f4;
            font-weight: 800;
          }

          .name {
            text-align: left;
            width: 140px;
          }

          .coach-table th:nth-child(1),
          .coach-table td:nth-child(1) {
            width: 34px;
          }

          .coach-table th:nth-child(2),
          .coach-table td:nth-child(2) {
            width: 120px;
          }

          .coach-table th:nth-child(3),
          .coach-table td:nth-child(3) {
            width: 34px;
          }

          .card-table th:nth-child(1),
          .card-table td:nth-child(1) {
            width: 44px;
          }

          .card-table th:nth-child(2),
          .card-table td:nth-child(2) {
            width: 44px;
          }

          .card-table th:nth-child(4),
          .card-table td:nth-child(4) {
            width: 70px;
          }

          .card-table th:nth-child(5),
          .card-table td:nth-child(5) {
            width: 140px;
          }

          .notes {
            margin-top: 10px;
            font-size: 10px;
            color: #334155;
          }
        </style>
      </head>

      <body>
        <section class="page">
          <div class="header">
            <div class="team-block">
              <img class="logo" src="/thunder-logo.png" />
              <div>
                <h1>${htmlEscape(title)}</h1>
                <div class="subtitle">Coach Defensive Lineup</div>
              </div>
            </div>
          </div>

          <table class="coach-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>Player</th>
                <th>#</th>
                ${inningHeaders}
              </tr>
            </thead>
            <tbody>${coachRows}</tbody>
          </table>
        </section>

        <section class="page">
          <div class="header">
            <div class="team-block">
              <img class="logo" src="/thunder-logo.png" />
              <div>
                <h1>Arlington Heights Thunder 12U Teal</h1>
                <div class="subtitle">Official Lineup Card</div>
              </div>
            </div>
          </div>

          <div class="meta-grid">
            <div class="meta-box">
              <span class="meta-label">Date</span>
              ${htmlEscape(formatDateShort(selectedGame?.date) || '')}
            </div>
            <div class="meta-box">
              <span class="meta-label">Opponent</span>
              ${htmlEscape(selectedGame?.opponent || '')}
            </div>
            <div class="meta-box">
              <span class="meta-label">Game Time</span>
            </div>
            <div class="meta-box">
              <span class="meta-label">Field</span>
            </div>
          </div>

          <table class="card-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>#</th>
                <th>Player</th>
                <th>Pos</th>
                <th>Sub/Re-entry/Notes</th>
              </tr>
            </thead>
            <tbody>${opponentCardRows}</tbody>
          </table>

          <div class="notes">
            Coach signature: ___________________________
            &nbsp;&nbsp;&nbsp;
            Plate umpire: ___________________________
          </div>
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
