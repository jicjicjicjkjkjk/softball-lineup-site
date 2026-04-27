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

  const fullName = (player) =>
    [player.name, player.last_name].filter(Boolean).join(' ').trim()

  const gameDate = formatDateShort(selectedGame?.date) || 'No Date'
  const opponent = selectedGame?.opponent || 'Opponent'
  const gameTime = selectedGame?.game_time || selectedGame?.time || ''

  const inningHeaders = Array.from({ length: Number(selectedLineup?.innings || 0) })
    .map((_, i) => `<th>${i + 1}</th>`)
    .join('')

  const positionRows = printPlayers
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

      return `
        <tr>
          <td>${htmlEscape(selectedLineup?.battingOrder?.[id] || '')}</td>
          <td>${htmlEscape(player.jersey_number || '')}</td>
          <td class="lineup-name">${htmlEscape(fullName(player))}</td>
          <td></td>
        </tr>
      `
    })
    .join('')

  const html = `
    <html>
      <head>
        <title>Game Lineup</title>
        <style>
          @page {
            size: letter portrait;
            margin: 0.3in;
          }

          html,
          body {
            margin: 0;
            padding: 0;
            background: #ffffff;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2f46;
          }

          .print-page {
            break-after: page;
            page-break-after: always;
          }

          .print-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }

          .brand-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 14px;
            margin-bottom: 10px;
          }

          .brand-left {
            display: flex;
            align-items: center;
            gap: 12px;
          }

          .logo-mark {
            width: 52px;
            height: 52px;
            border-radius: 50%;
            background: #111827;
            color: #38bdf8;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 28px;
            font-weight: 900;
            border: 4px solid #3c817d;
          }

          .brand-title {
            font-size: 20px;
            font-weight: 900;
            margin: 0;
            line-height: 1.1;
          }

          .brand-subtitle {
            font-size: 12px;
            font-weight: 700;
            color: #3c817d;
            margin-top: 2px;
          }

          h1 {
            font-size: 18px;
            margin: 0 0 10px;
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
            line-height: 1.15;
          }

          th {
            background: #e6f4f4;
            font-weight: 800;
          }

          .position-table th:nth-child(1),
          .position-table td:nth-child(1) {
            width: 34px;
          }

          .position-table th:nth-child(2),
          .position-table td:nth-child(2) {
            width: 110px;
          }

          .position-table th:nth-child(3),
          .position-table td:nth-child(3) {
            width: 34px;
          }

          .name {
            text-align: left;
          }

          .lineup-card-title {
            font-size: 22px;
            font-weight: 900;
            margin: 0 0 10px;
          }

          .lineup-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 8px 28px;
            margin-bottom: 12px;
            font-size: 13px;
          }

          .lineup-meta div {
            white-space: nowrap;
          }

          .lineup-card-table th {
            background: #111;
            color: #fff;
            font-size: 12px;
          }

          .lineup-card-table td {
            font-size: 12px;
            padding: 6px 5px;
          }

          .lineup-card-table th:nth-child(1),
          .lineup-card-table td:nth-child(1) {
            width: 52px;
          }

          .lineup-card-table th:nth-child(2),
          .lineup-card-table td:nth-child(2) {
            width: 60px;
          }

          .lineup-name {
            text-align: left;
            width: 260px;
          }

          .signature-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 90px;
            margin-top: 34px;
            font-size: 12px;
            text-align: center;
          }

          .signature-line {
            border-top: 2px solid #111;
            padding-top: 6px;
          }
        </style>
      </head>

      <body>
        <section class="print-page">
          <div class="brand-header">
            <div class="brand-left">
              <div class="logo-mark">T</div>
              <div>
                <div class="brand-title">Thunder Game Lineup</div>
                <div class="brand-subtitle">Arlington Heights Thunder 12U Teal</div>
              </div>
            </div>
          </div>

          <h1>${htmlEscape(gameDate)} vs ${htmlEscape(opponent)}</h1>

          <table class="position-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>Player</th>
                <th>#</th>
                ${inningHeaders}
              </tr>
            </thead>
            <tbody>${positionRows}</tbody>
          </table>
        </section>

        <section class="print-page">
          <div class="brand-header">
            <div class="brand-left">
              <div class="logo-mark">T</div>
              <div>
                <div class="lineup-card-title">Official Lineup Card</div>
                <div class="brand-subtitle">Arlington Heights Thunder 12U Teal</div>
              </div>
            </div>
          </div>

          <div class="lineup-meta">
            <div><strong>Team:</strong> Thunder</div>
            <div><strong>Date:</strong> ${htmlEscape(gameDate)}</div>
            <div><strong>Opponent:</strong> ${htmlEscape(opponent)}</div>
            <div><strong>Game Time:</strong> ${htmlEscape(gameTime || '__________')}</div>
          </div>

          <table class="lineup-card-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>#</th>
                <th>Name (First + Last)</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>${lineupCardRows}</tbody>
          </table>

          <div class="signature-row">
            <div class="signature-line">Coach Signature</div>
            <div class="signature-line">Umpire</div>
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
