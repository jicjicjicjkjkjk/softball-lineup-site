import { formatDateShort } from '../lib/appHelpers'

function n(value) {
  return Math.round(Number(value || 0))
}

export default function PrintCoachSheet({
  show,
  games = [],
  optimizerPreviewByGame = {},
  lineupsByGame = {},
  activePlayers = [],
  currentBatchTotals = {},
  gameTypeOptions = [],
  seasonOptions = [],
  getOptionLabel,
  pk,
}) {
  return (
    <div className={`print-only coach-summary-print ${show ? 'show-print' : ''}`}>
      {games.map((game) => {
        const lineup =
          optimizerPreviewByGame[pk(game.id)] ||
          lineupsByGame[pk(game.id)]

        if (!lineup || !lineup.innings) return null

        const availableIds = new Set((lineup.availablePlayerIds || []).map(pk))

        const playersInGame = activePlayers
          .filter((player) => availableIds.has(pk(player.id)))
          .sort((a, b) => {
            const aOrder = Number(lineup.battingOrder?.[pk(a.id)] || 999)
            const bOrder = Number(lineup.battingOrder?.[pk(b.id)] || 999)
            return aOrder - bOrder
          })

        return (
          <div key={game.id} className="print-game">
            <div className="print-title">
              <span>{formatDateShort(game.date) || 'No Date'}</span>
              <span>vs {game.opponent || 'Opponent'}</span>
              {game.game_type ? <span>{getOptionLabel(gameTypeOptions, game.game_type)}</span> : null}
              {game.season ? <span>{getOptionLabel(seasonOptions, game.season)}</span> : null}
            </div>

            <table className="coach-lineup-table">
              <thead>
                <tr>
                  <th>Bat</th>
                  <th>#</th>
                  <th>Player</th>
                  {Array.from({ length: Number(lineup.innings || 0) }).map((_, i) => (
                    <th key={i}>Inn {i + 1}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {playersInGame.map((player) => {
                  const id = pk(player.id)

                  return (
                    <tr key={id}>
                      <td>{lineup.battingOrder?.[id] || ''}</td>
                      <td>{player.jersey_number || ''}</td>
                      <td>{player.name}</td>

                      {Array.from({ length: Number(lineup.innings || 0) }).map((_, i) => {
                        const inning = i + 1
                        const value = lineup.cells?.[id]?.[inning]

                        return (
                          <td key={inning}>
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
        )
      })}

      <div className="coach-plan-page">
        <div className="coach-plan-title">Current Plan Summary</div>

        <table className="coach-plan-table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Games</th>
              <th>Fld</th>
              <th>Out</th>
              <th>P</th>
              <th>C</th>
              <th>1B</th>
              <th>2B</th>
              <th>3B</th>
              <th>SS</th>
              <th>LF</th>
              <th>CF</th>
              <th>RF</th>
              <th>IF</th>
              <th>OF</th>
            </tr>
          </thead>

          <tbody>
            {activePlayers.map((player) => {
              const id = pk(player.id)
              const totals = currentBatchTotals?.[id] || {}

              return (
                <tr key={id}>
                  <td>{player.name}</td>
                  <td>{n(totals.games)}</td>
                  <td>{n(totals.fieldTotal)}</td>
                  <td>{n(totals.Out)}</td>
                  <td>{n(totals.P)}</td>
                  <td>{n(totals.C)}</td>
                  <td>{n(totals['1B'])}</td>
                  <td>{n(totals['2B'])}</td>
                  <td>{n(totals['3B'])}</td>
                  <td>{n(totals.SS)}</td>
                  <td>{n(totals.LF)}</td>
                  <td>{n(totals.CF)}</td>
                  <td>{n(totals.RF)}</td>
                  <td>{n(totals.IF)}</td>
                  <td>{n(totals.OF)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
