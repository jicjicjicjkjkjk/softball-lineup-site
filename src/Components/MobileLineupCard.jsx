import { formatDateShort } from '../lib/appHelpers'

function pkLocal(id) {
  return String(id)
}

function fullName(player) {
  return [player?.name, player?.last_name].filter(Boolean).join(' ').trim()
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export default function MobileLineupCard({
  title = 'Lineup Card',
  game,
  lineup,
  players = [],
  pk = pkLocal,
  onClose,
}) {
  if (!game || !lineup) return null

  const availableIds = new Set((lineup.availablePlayerIds || []).map(pk))
  const innings = Number(lineup.innings || 0)

  const playersInLineup = [...players]
    .filter((player) => availableIds.has(pk(player.id)))
    .sort((a, b) => {
      const aOrder = Number(lineup?.battingOrder?.[pk(a.id)] || 999)
      const bOrder = Number(lineup?.battingOrder?.[pk(b.id)] || 999)
      return aOrder - bOrder
    })

  function printLineupCard() {
    const inningHeaders = Array.from({ length: innings })
      .map((_, index) => `<th>Inn ${index + 1}</th>`)
      .join('')

    const rows = playersInLineup
      .map((player) => {
        const id = pk(player.id)

        const inningCells = Array.from({ length: innings })
          .map((_, index) => {
            const inning = index + 1
            const value = lineup.cells?.[id]?.[inning] || ''
            return `<td class="${value === 'Out' ? 'out' : ''}">${escapeHtml(
              value === 'Out' ? 'OUT' : value || '-'
            )}</td>`
          })
          .join('')

        return `
          <tr>
            <td>${escapeHtml(lineup.battingOrder?.[id] || '')}</td>
            <td>${escapeHtml(player.jersey_number || '')}</td>
            <td class="player">${escapeHtml(fullName(player))}</td>
            ${inningCells}
          </tr>
        `
      })
      .join('')

    const html = `
      <html>
        <head>
          <title>${escapeHtml(title)}</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              padding: 18px;
              color: #111827;
            }

            h1 {
              margin: 0 0 4px;
              font-size: 22px;
            }

            .subtitle {
              margin-bottom: 14px;
              font-size: 13px;
              color: #4b5563;
            }

            table {
              width: 100%;
              border-collapse: collapse;
              table-layout: fixed;
            }

            th, td {
              border: 1px solid #cbd5e1;
              padding: 6px;
              font-size: 12px;
              text-align: center;
            }

            th {
              background: #e8f3f3;
              font-weight: 700;
            }

            .player {
              text-align: left;
              font-weight: 700;
              width: 160px;
            }

            .out {
              font-weight: 700;
              background: #eef2f7;
            }

            @page {
              size: landscape;
              margin: 0.35in;
            }
          </style>
        </head>

        <body>
          <h1>${escapeHtml(title)}</h1>
          <div class="subtitle">
            ${escapeHtml(formatDateShort(game.date) || 'No Date')} vs ${escapeHtml(
              game.opponent || 'Opponent'
            )}
          </div>

          <table>
            <thead>
              <tr>
                <th>Bat</th>
                <th>#</th>
                <th>Player</th>
                ${inningHeaders}
              </tr>
            </thead>
            <tbody>
              ${rows}
            </tbody>
          </table>

          <script>
            window.onload = function () {
              window.focus()
              window.print()
            }
          </script>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    if (!printWindow) {
      alert('Please allow pop-ups so the lineup card can print.')
      return
    }

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="mobile-lineup-card-overlay">
      <div className="mobile-lineup-card">
        <div className="mobile-lineup-card-header">
          <div>
            <h2>{title}</h2>
            <div className="small-note">
              {formatDateShort(game.date) || 'No Date'} vs {game.opponent || 'Opponent'}
            </div>
          </div>

          <div className="mobile-lineup-card-actions">
            <button type="button" onClick={printLineupCard}>
              Print
            </button>

            <button type="button" onClick={onClose}>
              Close
            </button>
          </div>
        </div>

        <div className="mobile-lineup-card-scroll">
          <table className="mobile-lineup-card-table">
            <thead>
              <tr>
                <th>Bat</th>
                <th>#</th>
                <th>Player</th>

                {Array.from({ length: innings }).map((_, index) => (
                  <th key={index}>Inn {index + 1}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {playersInLineup.map((player) => {
                const id = pk(player.id)

                return (
                  <tr key={id}>
                    <td>{lineup.battingOrder?.[id] || ''}</td>
                    <td>{player.jersey_number || ''}</td>
                    <td className="mobile-lineup-player">{fullName(player)}</td>

                    {Array.from({ length: innings }).map((_, index) => {
                      const inning = index + 1
                      const value = lineup.cells?.[id]?.[inning] || ''

                      return (
                        <td key={inning} className={value === 'Out' ? 'mobile-lineup-out' : ''}>
                          {value === 'Out' ? 'OUT' : value || '-'}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
