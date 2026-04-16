import { formatDateShort } from '../lib/appHelpers'

console.log('TRACKING PAGE NEW VERSION')

function shortenOpponent(name = '') {
  const cleaned = String(name || '')
    .replace(/\b(8u|9u|10u|11u|12u|13u|14u|15u|16u|18u)\b/gi, '')
    .replace(/\b(gold|silver|black|teal|blue|red|white)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 6)
  return `${words[0].slice(0, 3)} ${words[1].slice(0, 3)}`
}

function RotatedGameHeader({ game }) {
  const shortName = shortenOpponent(game?.opponent || '')
  const shortDate = formatDateShort(game?.date || '')

  return (
    <th
      className="tracking-vertical"
      style={{
        width: 42,
        minWidth: 42,
        maxWidth: 42,
        height: 170,
        minHeight: 170,
        maxHeight: 170,
        padding: 0,
        verticalAlign: 'bottom',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '100%',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: 10,
            transform: 'translateX(-50%) rotate(-90deg)',
            transformOrigin: 'center',
            whiteSpace: 'nowrap',
            lineHeight: 1.15,
            fontSize: 12,
            fontWeight: 700,
            textAlign: 'left',
          }}
        >
          <div>{shortName}</div>
          <div>{shortDate}</div>
        </div>
      </div>
    </th>
  )
}

const centerCell = { textAlign: 'center', verticalAlign: 'middle' }
const centerHeader = { textAlign: 'center', verticalAlign: 'middle' }

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
        <h3>Batting Order Tracking</h3>
        <div className="tracking-scroll">
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-player" style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                  Player
                </th>
                <th className="sticky-col-2 col-avg" style={centerHeader}>
                  Avg
                </th>
                {gamesWithLineups.map((g) => (
                  <RotatedGameHeader key={g.id} game={g} />
                ))}
              </tr>
            </thead>
            <tbody>
              {battingRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player" style={{ textAlign: 'left' }}>
                    {row.name}
                  </td>
                  <td className="sticky-col-2 col-avg" style={centerCell}>
                    {row.avg}
                  </td>
                  {row.perGame.map((v, i) => (
                    <td key={i} className="col-small" style={centerCell}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <h3>Sitting Out Summary</h3>
        <div className="tracking-scroll">
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-metric" style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                  Metric
                </th>
                {gamesWithLineups.map((g) => (
                  <RotatedGameHeader key={g.id} game={g} />
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky-col-1 col-metric" style={{ textAlign: 'left' }}>Total Players</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>{g.totalPlayers}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={{ textAlign: 'left' }}>Innings</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>{g.innings}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={{ textAlign: 'left' }}># Sit Outs</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>{g.sitOuts}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={{ textAlign: 'left' }}>Injury</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>{g.injury}</td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={{ textAlign: 'left' }}>Average Out</td>
                {sitSummary.map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>{g.avgSit}</td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <h3>Sit Outs by Player</h3>
        <div className="tracking-scroll">
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-player" style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                  Player
                </th>
                {gamesWithLineups.map((g) => (
                  <RotatedGameHeader key={g.id} game={g} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sitByPlayer.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player" style={{ textAlign: 'left' }}>
                    {row.name}
                  </td>
                  {row.perGame.map((v, i) => (
                    <td key={i} className="col-small" style={centerCell}>
                      {v}
                    </td>
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
                <th className="sticky-col-1 col-player" style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                  Player
                </th>
                {gamesWithLineups.map((g) => (
                  <RotatedGameHeader key={g.id} game={g} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sitByPlayer.map((row) => (
                <tr key={`${row.playerId}-running`}>
                  <td className="sticky-col-1 col-player" style={{ textAlign: 'left' }}>
                    {row.name}
                  </td>
                  {row.running.map((v, i) => (
                    <td key={i} className="col-small" style={centerCell}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <div className="positioning-controls">
          <h3 style={{ margin: 0 }}>Positioning by Player Per Game</h3>
          <div className="positioning-player-select">
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

        <div className="tracking-scroll">
          {trackingPlayerId ? (
            <table className="tracking-table positioning-table">
              <thead>
                <tr>
                  <th className="sticky-col-1 col-game" style={centerHeader}>Game #</th>
                  <th className="sticky-col-2 col-opponent" style={{ textAlign: 'left', verticalAlign: 'middle' }}>Opponent</th>
                  <th className="sticky-col-3 col-date" style={centerHeader}>Date</th>
                  <th className="col-act" style={centerHeader}>Act</th>
                  <th className="col-small" style={centerHeader}>P</th>
                  <th className="col-small" style={centerHeader}>C</th>
                  <th className="col-small" style={centerHeader}>1B</th>
                  <th className="col-small" style={centerHeader}>2B</th>
                  <th className="col-small" style={centerHeader}>3B</th>
                  <th className="col-small" style={centerHeader}>SS</th>
                  <th className="col-small" style={centerHeader}>LF</th>
                  <th className="col-small" style={centerHeader}>CF</th>
                  <th className="col-small" style={centerHeader}>RF</th>
                  <th className="col-small" style={centerHeader}>Out</th>
                  <th className="col-small" style={centerHeader}>Injury</th>
                </tr>
              </thead>
              <tbody>
                {selectedPlayerPositions.map((row, idx) => (
                  <tr key={row.gameId}>
                    <td className="sticky-col-1 col-game" style={centerCell}>{idx + 1}</td>
                    <td className="sticky-col-2 col-opponent" style={{ textAlign: 'left' }}>{row.opponent}</td>
                    <td className="sticky-col-3 col-date" style={centerCell}>{formatDateShort(row.date)}</td>
                    <td className="col-act" style={centerCell}>{row.active}</td>
                    <td className="col-small" style={centerCell}>{row.P || ''}</td>
                    <td className="col-small" style={centerCell}>{row.C || ''}</td>
                    <td className="col-small" style={centerCell}>{row['1B'] || ''}</td>
                    <td className="col-small" style={centerCell}>{row['2B'] || ''}</td>
                    <td className="col-small" style={centerCell}>{row['3B'] || ''}</td>
                    <td className="col-small" style={centerCell}>{row.SS || ''}</td>
                    <td className="col-small" style={centerCell}>{row.LF || ''}</td>
                    <td className="col-small" style={centerCell}>{row.CF || ''}</td>
                    <td className="col-small" style={centerCell}>{row.RF || ''}</td>
                    <td className="col-small" style={centerCell}>{row.Out || ''}</td>
                    <td className="col-small" style={centerCell}>{row.Injury || ''}</td>
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
        <h3>Tracking vs Positioning Priority</h3>
        <div className="tracking-scroll">
          <table className="tracking-table">
            <thead>
              <tr>
                <th rowSpan="2" className="sticky-col-1 col-player" style={{ textAlign: 'left', verticalAlign: 'middle' }}>
                  Player
                </th>
                <th rowSpan="2" className="sticky-col-2 col-small" style={centerHeader}>
                  Fld
                </th>
                <th colSpan="2" style={centerHeader}>P</th>
                <th colSpan="2" style={centerHeader}>C</th>
                <th colSpan="2" style={centerHeader}>1B</th>
                <th colSpan="2" style={centerHeader}>2B</th>
                <th colSpan="2" style={centerHeader}>3B</th>
                <th colSpan="2" style={centerHeader}>SS</th>
                <th colSpan="2" style={centerHeader}>OF</th>
              </tr>
              <tr>
                <th className="col-small" style={centerHeader}>TGT</th>
                <th className="col-small" style={centerHeader}>ACT</th>
                <th className="col-small" style={centerHeader}>TGT</th>
                <th className="col-small" style={centerHeader}>ACT</th>
                <th className="col-small" style={centerHeader}>TGT</th>
                <th className="col-small" style={centerHeader}>ACT</th>
                <th className="col-small" style={centerHeader}>TGT</th>
                <th className="col-small" style={centerHeader}>ACT</th>
                <th className="col-small" style={centerHeader}>TGT</th>
                <th className="col-small" style={centerHeader}>ACT</th>
                <th className="col-small" style={centerHeader}>TGT</th>
                <th className="col-small" style={centerHeader}>ACT</th>
                <th className="col-small" style={centerHeader}>TGT</th>
                <th className="col-small" style={centerHeader}>ACT</th>
              </tr>
            </thead>
            <tbody>
              {trackingPriorityRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player" style={{ textAlign: 'left' }}>{row.name}</td>
                  <td className="sticky-col-2 col-small" style={centerCell}>{row.fieldTotal}</td>
                  <td className="col-small" style={centerCell}>{row.targP}</td>
                  <td className="col-small" style={centerCell}>{row.actP}</td>
                  <td className="col-small" style={centerCell}>{row.targC}</td>
                  <td className="col-small" style={centerCell}>{row.actC}</td>
                  <td className="col-small" style={centerCell}>{row.targ1B}</td>
                  <td className="col-small" style={centerCell}>{row.act1B}</td>
                  <td className="col-small" style={centerCell}>{row.targ2B}</td>
                  <td className="col-small" style={centerCell}>{row.act2B}</td>
                  <td className="col-small" style={centerCell}>{row.targ3B}</td>
                  <td className="col-small" style={centerCell}>{row.act3B}</td>
                  <td className="col-small" style={centerCell}>{row.targSS}</td>
                  <td className="col-small" style={centerCell}>{row.actSS}</td>
                  <td className="col-small" style={centerCell}>{row.targOF}</td>
                  <td className="col-small" style={centerCell}>{row.actOF}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
