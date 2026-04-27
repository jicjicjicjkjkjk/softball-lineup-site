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

  // -----------------------
  // PAGE 1 (GRID)
  // -----------------------
  const inningHeaders = Array.from({ length: innings })
    .map((_, i) => `<th>${i + 1}</th>`)
    .join('')

  const playerRows = printPlayers
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

  // -----------------------
  // PAGE 2 (LINEUP CARD)
  // -----------------------
  const lineupCardRows = printPlayers
    .map((player, idx) => {
      const id = pk(player.id)
      const fullName = `${player.name || ''} ${player.last_name || ''}`.trim()

      return `
        <tr>
          <td>${idx + 1}</td>
          <td>${htmlEscape(player.jersey_number || '')}</td>
          <td>${htmlEscape(fullName)}</td>
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
          @page { size: letter portrait; margin: 0.4in; }

          body { font-family: Arial, sans-serif; color: #1f2f46; }

          h1 { font-size: 18px; margin: 0 0 8px; }
          h2 { font-size: 16px; margin: 0 0 8px; }

          .page { page-break-after: always; }

          table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }

          th, td {
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
            width: 120px;
          }

          /* LINEUP CARD */
          .lineup-card {
            margin-top: 10px;
          }

          .lineup-card th {
            background: #000;
            color: white;
          }

          .header-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 8px;
            font-size: 12px;
          }

          .signature {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
            font-size: 12px;
          }

          .sig-line {
            border-top: 1px solid #000;
            width: 200px;
            text-align: center;
            padding-top: 4px;
          }
        </style>
      </head>

      <body>

        <!-- PAGE 1 -->
        <div class="page">
          <h1>${htmlEscape(formatDateShort(selectedGame?.date) || 'No Date')} vs ${htmlEscape(
    selectedGame?.opponent || 'Opponent'
  )}</h1>

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
        </div>

        <!-- PAGE 2 -->
        <div class="page">
          <h2>Official Lineup Card</h2>

          <div class="header-row">
            <div><strong>Team:</strong> Thunder</div>
            <div><strong>Date:</strong> ${htmlEscape(
              formatDateShort(selectedGame?.date) || ''
            )}</div>
          </div>

          <div class="header-row">
            <div><strong>Opponent:</strong> ${htmlEscape(selectedGame?.opponent || '')}</div>
            <div><strong>Game Time:</strong> __________</div>
          </div>

          <table class="lineup-card">
            <thead>
              <tr>
                <th>Bat</th>
                <th>#</th>
                <th>Name (First + Last)</th>
                <th>Position</th>
              </tr>
            </thead>
            <tbody>
              ${lineupCardRows}
            </tbody>
          </table>

          <div class="signature">
            <div class="sig-line">Coach Signature</div>
            <div class="sig-line">Umpire</div>
          </div>
        </div>

      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  printWindow.document.write(html)
  printWindow.document.close()
  printWindow.focus()
  printWindow.print()
}
