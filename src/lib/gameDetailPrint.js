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

      const firstPosition =
  Array.from({ length: Number(selectedLineup?.innings || 0) })
    .map((_, i) => selectedLineup?.cells?.[id]?.[i + 1])
    .find((value) => value && value !== 'Out') || ''

return `
  <tr>
    <td>${htmlEscape(selectedLineup?.battingOrder?.[id] || '')}</td>
    <td>${htmlEscape(player.jersey_number || '')}</td>
    <td class="lineup-name">${htmlEscape(fullName(player))}</td>
    <td>${htmlEscape(firstPosition)}</td>
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
            margin: 0.35in;
          }

          html, body {
            margin: 0;
            padding: 0;
          }

          body {
            font-family: Arial, Helvetica, sans-serif;
            color: #1f2f46;
          }

          .print-page {
            page-break-after: always;
          }

          .print-page:last-child {
            page-break-after: auto;
          }

          /* HEADER */
          .brand-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }

          .logo-img {
            width: 60px;
            height: 60px;
            object-fit: contain;
          }

          .brand-title {
            font-size: 18px;
            font-weight: 900;
            line-height: 1.1;
          }

          .brand-subtitle {
            font-size: 11px;
            font-weight: 700;
            color: #3c817d;
          }

          h1 {
            font-size: 16px;
            margin: 0 0 10px;
          }

          /* TABLE */
          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
            border: 1px solid #111;
            padding: 4px;
            text-align: center;
            font-size: 10.5px;
          }

          th {
            background: #e6f4f4;
            font-weight: 800;
          }

          .name {
            text-align: left;
          }

          /* LINEUP CARD */
          .lineup-card-title {
            font-size: 20px;
            font-weight: 900;
            margin-bottom: 8px;
          }

          .lineup-meta {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px 20px;
            margin-bottom: 10px;
            font-size: 12px;
          }

          .lineup-card-table th {
            background: #111;
            color: #fff;
            font-size: 11px;
          }

          .lineup-card-table td {
            font-size: 11px;
            padding: 5px;
          }

          .first {
            text-align: left;
            width: 130px;
          }

          .last {
            text-align: left;
            width: 140px;
          }

          /* SIGNATURE */
          .signature-row {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 80px;
            margin-top: 28px;
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
        <!-- PAGE 1 -->
        <section class="print-page">
          <div class="brand-header">
            <img src="/thunder-logo.png" class="logo-img" />
            <div>
              <div class="brand-title">Thunder Game Lineup</div>
              <div class="brand-subtitle">Arlington Heights Thunder 12U Teal</div>
            </div>
          </div>

          <h1>${htmlEscape(gameDate)} vs ${htmlEscape(opponent)}</h1>

          <table>
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

        <!-- PAGE 2 -->
        <section class="print-page">
          <div class="brand-header">
            <img src="/thunder-logo.png" class="logo-img" />
            <div>
              <div class="lineup-card-title">Official Lineup Card</div>
              <div class="brand-subtitle">Arlington Heights Thunder 12U Teal</div>
            </div>
          </div>

          <div class="lineup-meta">
            <div><strong>Team:</strong> Thunder</div>
            <div><strong>Date:</strong> ${htmlEscape(gameDate)}</div>
            <div><strong>Opponent:</strong> ${htmlEscape(opponent)}</div>
            <div><strong>Time:</strong> ${htmlEscape(gameTime || '__________')}</div>
          </div>

          <table class="lineup-card-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>#</th>
                <th>First Name</th>
                <th>Last Name</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>${lineupCardRows}</tbody>
          </table>

          <div class="signature-row">
            <div class="signature-line">Coach</div>
            <div class="signature-line">Umpire</div>
          </div>
        </section>
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')

if (!printWindow) {
  alert('Pop-up blocked. Please allow pop-ups for this site, then try Print again.')
  return
}

printWindow.document.open()
printWindow.document.write(html)
printWindow.document.close()

printWindow.onload = () => {
  printWindow.focus()
  printWindow.print()
}

setTimeout(() => {
  printWindow.focus()
  printWindow.print()
}, 500)}
