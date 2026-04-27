export function printGameDetail({
  selectedGame,
  selectedLineup,
  activePlayers,
  formatDateShort,
  pk,
}) {
  const TEAM_NAME = 'Arlington Heights Thunder 12U Teal'
  const LOGO_URL = '/thunder-logo.png'

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

  const fullName = (player) =>
    `${player.name || ''} ${player.last_name || ''}`.trim()

  const inningHeaders = Array.from({ length: innings })
    .map((_, i) => `<th>${i + 1}</th>`)
    .join('')

  const gridRows = printPlayers
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
          <td class="name">${htmlEscape(player.name || '')}</td>
          <td>${htmlEscape(player.jersey_number || '')}</td>
          ${cells}
        </tr>
      `
    })
    .join('')

  const lineupCardRows = printPlayers
    .map((player) => {
      const id = pk(player.id)
      const firstInningPosition = selectedLineup?.cells?.[id]?.[1]
      const position = firstInningPosition === 'Out' ? '' : firstInningPosition || ''

      return `
        <tr>
          <td>${htmlEscape(selectedLineup?.battingOrder?.[id] || '')}</td>
          <td>${htmlEscape(player.jersey_number || '')}</td>
          <td class="lineup-name">${htmlEscape(fullName(player))}</td>
          <td>${htmlEscape(position)}</td>
          <td></td>
        </tr>
      `
    })
    .join('')

  const html = `
    <html>
      <head>
        <title>Thunder Game Packet</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.35in;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2f46;
            margin: 0;
          }

          .page {
            page-break-after: always;
          }

          .page:last-child {
            page-break-after: auto;
          }

          .brand-header {
            display: grid;
            grid-template-columns: 72px 1fr;
            gap: 12px;
            align-items: center;
            margin-bottom: 10px;
            border-bottom: 4px solid #3c817d;
            padding-bottom: 8px;
          }

          .logo {
            width: 64px;
            height: 64px;
            object-fit: contain;
          }

          .team-title {
            font-size: 20px;
            font-weight: 900;
            margin: 0;
            line-height: 1.05;
          }

          .game-title {
            font-size: 15px;
            font-weight: 800;
            margin-top: 4px;
            line-height: 1.15;
          }

          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 18px;
            margin: 10px 0 12px;
            font-size: 12px;
            font-weight: 700;
          }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th,
          td {
            border: 1.5px solid #111;
            padding: 5px;
            text-align: center;
            font-size: 11px;
            line-height: 1.1;
          }

          th {
            background: #dff0ef;
            font-weight: 900;
          }

          .grid-table th:nth-child(1),
          .grid-table td:nth-child(1) {
            width: 34px;
          }

          .grid-table th:nth-child(2),
          .grid-table td:nth-child(2) {
            width: 110px;
          }

          .grid-table th:nth-child(3),
          .grid-table td:nth-child(3) {
            width: 34px;
          }

          .name,
          .lineup-name {
            text-align: left;
            font-weight: 700;
          }

          .lineup-card th {
            background: #163847;
            color: white;
          }

          .lineup-card th:nth-child(1),
          .lineup-card td:nth-child(1) {
            width: 42px;
          }

          .lineup-card th:nth-child(2),
          .lineup-card td:nth-child(2) {
            width: 46px;
          }

          .lineup-card th:nth-child(4),
          .lineup-card td:nth-child(4) {
            width: 80px;
          }

          .lineup-card th:nth-child(5),
          .lineup-card td:nth-child(5) {
            width: 110px;
          }

          .lineup-card td {
            height: 28px;
            font-size: 12px;
          }

          .card-title {
            font-size: 18px;
            font-weight: 900;
            margin: 0 0 8px;
          }

          .small-note {
            font-size: 10px;
            margin-top: 10px;
            color: #5f6f84;
          }

          .signature-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 80px;
            margin-top: 34px;
          }

          .signature-line {
            border-top: 2px solid #111;
            text-align: center;
            padding-top: 5px;
            font-size: 11px;
            font-weight: 700;
          }
        </style>
      </head>

      <body>
        <section class="page">
          <div class="brand-header">
            <img class="logo" src="${LOGO_URL}" onerror="this.style.display='none'" />
            <div>
              <div class="team-title">${htmlEscape(TEAM_NAME)}</div>
              <div class="game-title">
                ${htmlEscape(formatDateShort(selectedGame?.date) || 'No Date')}
                vs ${htmlEscape(selectedGame?.opponent || 'Opponent')}
              </div>
            </div>
          </div>

          <table class="grid-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>Player</th>
                <th>#</th>
                ${inningHeaders}
              </tr>
            </thead>
            <tbody>${gridRows}</tbody>
          </table>
        </section>

        <section class="page">
          <div class="brand-header">
            <img class="logo" src="${LOGO_URL}" onerror="this.style.display='none'" />
            <div>
              <div class="team-title">Official Lineup Card</div>
              <div class="game-title">${htmlEscape(TEAM_NAME)}</div>
            </div>
          </div>

          <div class="meta-grid">
            <div>Team: ${htmlEscape(TEAM_NAME)}</div>
            <div>Date: ${htmlEscape(formatDateShort(selectedGame?.date) || '')}</div>
            <div>Opponent: ${htmlEscape(selectedGame?.opponent || '')}</div>
            <div>Game Time: __________________</div>
            <div>Manager/Coach: __________________</div>
            <div>Field: __________________</div>
          </div>

          <table class="lineup-card">
            <thead>
              <tr>
                <th>Bat</th>
                <th>#</th>
                <th>Player Name</th>
                <th>Pos</th>
                <th>Sub/Re-Entry</th>
              </tr>
            </thead>
            <tbody>${lineupCardRows}</tbody>
          </table>

          <div class="signature-row">
            <div class="signature-line">Manager / Coach Signature</div>
            <div class="signature-line">Plate Umpire</div>
          </div>

          <div class="small-note">
            Lineup card prepared for tournament/game exchange. Confirm any event-specific USSSA lineup-card requirements with the tournament director.
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
