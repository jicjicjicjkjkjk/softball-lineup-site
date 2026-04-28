import { formatDateShort } from '../lib/appHelpers'

function pkLocal(id) {
  return String(id)
}

function fullName(player) {
  return [player?.name, player?.last_name].filter(Boolean).join(' ').trim()
}

export default function MobileLineupCard({
  title = 'Mobile Lineup Card',
  game,
  lineup,
  players = [],
  pk = pkLocal,
  onClose,
}) {
  if (!game || !lineup) return null

  const availableIds = new Set((lineup.availablePlayerIds || []).map(pk))

  const playersInLineup = [...players]
    .filter((player) => availableIds.has(pk(player.id)))
    .sort((a, b) => {
      const aOrder = Number(lineup?.battingOrder?.[pk(a.id)] || 999)
      const bOrder = Number(lineup?.battingOrder?.[pk(b.id)] || 999)
      return aOrder - bOrder
    })

  const innings = Number(lineup.innings || 0)

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

          <button type="button" onClick={onClose}>
            Close
          </button>
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
