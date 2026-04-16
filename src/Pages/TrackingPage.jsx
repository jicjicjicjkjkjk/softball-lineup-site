import { formatDateShort } from '../lib/appHelpers'

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
  VerticalHeader,
  trackingPlayerId,
  setTrackingPlayerId,
  selectedPlayerPositions,
  trackingPriorityRows,
  pk,
}) {
  return (
    <div className="stack">
      <div className="card">
        <div className="table-scroll">
          <h3>Batting Order Tracking</h3>
          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="player-col">Player</th>
                <th>Avg</th>
                {gamesWithLineups.map((g, idx) => (
                  <VerticalHeader
                    key={g.id}
                    top={String(idx + 1)}
                    bottom={`${g.opponent || ''} ${formatDateShort(g.date)}`}
                    minWidth={60}
                    height={230}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {battingRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="player-col">{row.name}</td>
                  <td>{row.avg}</td>
                  {row.perGame.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <h3>Sitting Out Summary</h3>
          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Metric</th>
                {gamesWithLineups.map((g, idx) => (
                  <VerticalHeader
                    key={g.id}
                    top={String(idx + 1)}
                    bottom={formatDateShort(g.date)}
                    minWidth={34}
                    height={145}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Total Players</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId}>{g.totalPlayers}</td>
                ))}
              </tr>
              <tr>
                <td>Innings</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId}>{g.innings}</td>
                ))}
              </tr>
              <tr>
                <td># Sit Outs</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId}>{g.sitOuts}</td>
                ))}
              </tr>
              <tr>
                <td>Injury</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId}>{g.injury}</td>
                ))}
              </tr>
              <tr>
                <td>Average Out</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId}>{g.avgSit}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <h3>Sit Outs by Player</h3>
          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="player-col">Player</th>
                {gamesWithLineups.map((g, idx) => (
                  <VerticalHeader
                    key={g.id}
                    top={String(idx + 1)}
                    bottom={formatDateShort(g.date)}
                    minWidth={34}
                    height={145}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sitByPlayer.map((row) => (
                <tr key={row.playerId}>
                  <td className="player-col">{row.name}</td>
                  {row.perGame.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ height: 16 }} />

          <h3 style={{ marginTop: 0 }}>Sit Out Running Total (vs Expected)</h3>
          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="player-col">Player</th>
                {gamesWithLineups.map((g, idx) => (
                  <VerticalHeader
                    key={g.id}
                    top={String(idx + 1)}
                    bottom={formatDateShort(g.date)}
                    minWidth={34}
                    height={145}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sitByPlayer.map((row) => (
                <tr key={`${row.playerId}-running`}>
                  <td className="player-col">{row.name}</td>
                  {row.running.map((v, i) => (
                    <td key={i}>{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Positioning by Player Per Game</h3>
            <div style={{ minWidth: 260 }}>
              <select value={trackingPlayerId} onChange={(e) => setTrackingPlayerId(e.target.value)}>
                <option value="">Select Player</option>
                {activePlayers.map((p) => (
                  <option key={p.id} value={pk(p.id)}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {trackingPlayerId ? (
            <table className="table-center" style={{ tableLayout: 'fixed' }}>
              <thead>
                <tr>
                  <th>Game #</th>
                  <th>Opponent</th>
                  <th>Date</th>
                  <th>Act</th>
                  <th>P</th>
                  <th>C</th>
                  <th>1B</th>
                  <th>2B</th>
                  <th>3B</th>
                  <th>SS</th>
                  <th>LF</th>
                  <th>CF</th>
                  <th>RF</th>
                  <th>Out</th>
                  <th>IN</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlayerPositions.map((row, idx) => (
                  <tr key={row.gameId}>
                    <td>{idx + 1}</td>
                    <td>{row.opponent}</td>
                    <td>{formatDateShort(row.date)}</td>
                    <td>{row.active}</td>
                    <td>{row.P || ''}</td>
                    <td>{row.C || ''}</td>
                    <td>{row['1B'] || ''}</td>
                    <td>{row['2B'] || ''}</td>
                    <td>{row['3B'] || ''}</td>
                    <td>{row.SS || ''}</td>
                    <td>{row.LF || ''}</td>
                    <td>{row.CF || ''}</td>
                    <td>{row.RF || ''}</td>
                    <td>{row.Out || ''}</td>
                    <td>Yes</td>
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

      <div className="card">
        <div className="table-scroll">
          <h3>Tracking vs Positioning Priority</h3>
          <table className="table-center grouped-table">
            <thead>
              <tr>
                <th rowSpan="2">Player</th>
                <th rowSpan="2">Fld</th>
                <th colSpan="2" className="group-col">P</th>
                <th colSpan="2" className="group-col">C</th>
                <th colSpan="2" className="group-col">1B</th>
                <th colSpan="2" className="group-col">2B</th>
                <th colSpan="2" className="group-col">3B</th>
                <th colSpan="2" className="group-col">SS</th>
                <th colSpan="2" className="group-col">OF</th>
              </tr>
              <tr>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
              </tr>
            </thead>
            <tbody>
              {trackingPriorityRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="player-col">{row.name}</td>
                  <td>{row.fieldTotal}</td>
                  <td>{row.targP}</td><td className="group-col">{row.actP}</td>
                  <td>{row.targC}</td><td className="group-col">{row.actC}</td>
                  <td>{row.targ1B}</td><td className="group-col">{row.act1B}</td>
                  <td>{row.targ2B}</td><td className="group-col">{row.act2B}</td>
                  <td>{row.targ3B}</td><td className="group-col">{row.act3B}</td>
                  <td>{row.targSS}</td><td className="group-col">{row.actSS}</td>
                  <td>{row.targOF}</td><td className="group-col">{row.actOF}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
