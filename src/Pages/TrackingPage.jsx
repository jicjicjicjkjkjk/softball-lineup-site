import {
  formatDateShort,
  abbreviateOpponentName,
} from '../lib/appHelpers'

function GameHeader({ game }) {
  return (
    <th className="tracking-vertical">
      <div className="tracking-vertical-wrap">
        <div className="tracking-vertical-text">
          {abbreviateOpponentName(game.opponent)}
          <br />
          {formatDateShort(game.date)}
        </div>
      </div>
    </th>
  )
}

export default function TrackingPage({
  trackingLockedLineups,
  trackingTotals,
  activePlayers,
  trackingSort,
  setTrackingSort,
  TrackingTable,
  battingRows,
  sitSummary,
  sitByPlayer,
  gamesWithLineups,
  trackingPlayerId,
  setTrackingPlayerId,
  selectedPlayerPositions,
  trackingPriorityRows,
  pk,
}) {
  return (
    <div className="stack">
      <div className="card tracking-card">
        <div className="tracking-scroll">
          <h3>Batting Order Tracking</h3>
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-player">Player</th>
                <th className="sticky-col-2 col-avg">Avg</th>
                {gamesWithLineups.map((game) => (
                  <GameHeader key={game.id} game={game} />
                ))}
              </tr>
            </thead>
            <tbody>
              {battingRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player">{row.name}</td>
                  <td className="sticky-col-2 col-avg">{row.avg}</td>
                  {row.perGame.map((value, i) => (
                    <td key={i} className="col-small">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <div className="tracking-scroll">
          <h3>Sitting Out Summary</h3>
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-metric">Metric</th>
                {gamesWithLineups.map((game) => (
                  <GameHeader key={game.id} game={game} />
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky-col-1 col-metric">Total Players</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small">{g.totalPlayers}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric">Innings</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small">{g.innings}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric"># Sit Outs</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small">{g.sitOuts}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric">Injury</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small">{g.injury}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric">Average Out</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small">{g.avgSit}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <div className="tracking-scroll">
          <h3>Sit Outs by Player</h3>
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-player">Player</th>
                {gamesWithLineups.map((game) => (
                  <GameHeader key={game.id} game={game} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sitByPlayer.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player">{row.name}</td>
                  {row.perGame.map((value, i) => (
                    <td key={i} className="col-small">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ height: 16 }} />

          <h3 style={{ marginTop: 0 }}>Sit Out Running Total (vs Expected)</h3>
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-player">Player</th>
                {gamesWithLineups.map((game) => (
                  <GameHeader key={game.id} game={game} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sitByPlayer.map((row) => (
                <tr key={`${row.playerId}-running`}>
                  <td className="sticky-col-1 col-player">{row.name}</td>
                  {row.running.map((value, i) => (
                    <td key={i} className="col-small">{value}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <div className="tracking-scroll">
          <div className="positioning-controls">
            <h3 style={{ margin: 0 }}>Positioning by Player Per Game</h3>
            <div className="positioning-player-select">
              <select value={trackingPlayerId} onChange={(e) => setTrackingPlayerId(e.target.value)}>
                <option value="">Select Player</option>
                {activePlayers.map((player) => (
                  <option key={player.id} value={pk(player.id)}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {trackingPlayerId ? (
            <table className="tracking-table positioning-table">
              <thead>
                <tr>
                  <th className="sticky-col-1 col-game">Game #</th>
                  <th className="sticky-col-2 col-opponent">Opponent</th>
                  <th className="sticky-col-3 col-date">Date</th>
                  <th className="col-act">Act</th>
                  <th className="col-small">P</th>
                  <th className="col-small">C</th>
                  <th className="col-small">1B</th>
                  <th className="col-small">2B</th>
                  <th className="col-small">3B</th>
                  <th className="col-small">SS</th>
                  <th className="col-small">LF</th>
                  <th className="col-small">CF</th>
                  <th className="col-small">RF</th>
                  <th className="col-small">Out</th>
                  <th className="col-small">Inj</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlayerPositions.map((row, idx) => (
                  <tr key={row.gameId}>
                    <td className="sticky-col-1 col-game">{idx + 1}</td>
                    <td className="sticky-col-2 col-opponent">{row.opponent}</td>
                    <td className="sticky-col-3 col-date">{formatDateShort(row.date)}</td>
                    <td className="col-act">{row.active}</td>
                    <td className="col-small">{row.P || ''}</td>
                    <td className="col-small">{row.C || ''}</td>
                    <td className="col-small">{row['1B'] || ''}</td>
                    <td className="col-small">{row['2B'] || ''}</td>
                    <td className="col-small">{row['3B'] || ''}</td>
                    <td className="col-small">{row.SS || ''}</td>
                    <td className="col-small">{row.LF || ''}</td>
                    <td className="col-small">{row.CF || ''}</td>
                    <td className="col-small">{row.RF || ''}</td>
                    <td className="col-small">{row.Out || ''}</td>
                    <td className="col-small">{row.Injury || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Select a player to view by-game positioning.</p>
          )}
        </div>
      </div>

      <TrackingTable
        title="Tracking Totals"
        universeLabel={`${trackingLockedLineups.length} locked games`}
        totals={trackingTotals}
        players={activePlayers}
        sortConfig={trackingSort}
        setSortConfig={setTrackingSort}
      />

      <div className="card tracking-card">
        <div className="tracking-scroll">
          <h3>Tracking vs Positioning Priority</h3>
          <table className="tracking-table">
            <thead>
              <tr>
                <th rowSpan="2" className="sticky-col-1 col-player">Player</th>
                <th rowSpan="2" className="sticky-col-2 col-small">Fld</th>
                <th colSpan="2">P</th>
                <th colSpan="2">C</th>
                <th colSpan="2">1B</th>
                <th colSpan="2">2B</th>
                <th colSpan="2">3B</th>
                <th colSpan="2">SS</th>
                <th colSpan="2">OF</th>
              </tr>
              <tr>
                <th className="col-small">TGT</th>
                <th className="col-small">ACT</th>
                <th className="col-small">TGT</th>
                <th className="col-small">ACT</th>
                <th className="col-small">TGT</th>
                <th className="col-small">ACT</th>
                <th className="col-small">TGT</th>
                <th className="col-small">ACT</th>
                <th className="col-small">TGT</th>
                <th className="col-small">ACT</th>
                <th className="col-small">TGT</th>
                <th className="col-small">ACT</th>
                <th className="col-small">TGT</th>
                <th className="col-small">ACT</th>
              </tr>
            </thead>
            <tbody>
              {trackingPriorityRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player">{row.name}</td>
                  <td className="sticky-col-2 col-small">{row.fieldTotal}</td>
                  <td className="col-small">{row.targP}</td>
                  <td className="col-small">{row.actP}</td>
                  <td className="col-small">{row.targC}</td>
                  <td className="col-small">{row.actC}</td>
                  <td className="col-small">{row.targ1B}</td>
                  <td className="col-small">{row.act1B}</td>
                  <td className="col-small">{row.targ2B}</td>
                  <td className="col-small">{row.act2B}</td>
                  <td className="col-small">{row.targ3B}</td>
                  <td className="col-small">{row.act3B}</td>
                  <td className="col-small">{row.targSS}</td>
                  <td className="col-small">{row.actSS}</td>
                  <td className="col-small">{row.targOF}</td>
                  <td className="col-small">{row.actOF}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
