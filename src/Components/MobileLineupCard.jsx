import { formatDateShort } from '../lib/appHelpers'

function pkLocal(id) {
  return String(id)
}

function fullName(player) {
  return [player?.name, player?.last_name].filter(Boolean).join(' ').trim()
}

function playerSummary(lineup, playerId, innings) {
  const summary = { IF: 0, OF: 0, P: 0, C: 0, Out: 0 }

  for (let inning = 1; inning <= innings; inning += 1) {
    const value = lineup?.cells?.[playerId]?.[inning] || ''

    if (['1B', '2B', '3B', 'SS'].includes(value)) summary.IF += 1
    if (['LF', 'CF', 'RF'].includes(value)) summary.OF += 1
    if (value === 'P') summary.P += 1
    if (value === 'C') summary.C += 1
    if (value === 'Out') summary.Out += 1
  }

  return summary
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
            <button type="button" onClick={() => window.print()}>
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

                <th>IF</th>
                <th>OF</th>
                <th>P</th>
                <th>C</th>
                <th>Out</th>
              </tr>
            </thead>

            <tbody>
              {playersInLineup.map((player) => {
                const id = pk(player.id)
                const summary = playerSummary(lineup, id, innings)

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

                    <td>{summary.IF}</td>
                    <td>{summary.OF}</td>
                    <td>{summary.P}</td>
                    <td>{summary.C}</td>
                    <td>{summary.Out}</td>
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
