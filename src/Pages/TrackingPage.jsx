import { useMemo, useState } from 'react'
import { GAME_TYPES, computeTotals } from '../lib/lineupUtils'
import TrackingTable from "../Components/TrackingTable";

export default function TrackingPage({
  games,
  players,
  lineupsByGame,
  lineupLockedByGame,
  priorityByPlayer,
}) {
  const [throughDate, setThroughDate] = useState('')
  const [gameType, setGameType] = useState('All')
  const [statusMode, setStatusMode] = useState('Locked')

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const locked = lineupLockedByGame[String(game.id)] === true
      const saved = Boolean(lineupsByGame[String(game.id)])

      if (statusMode === 'Locked' && !locked) return false
      if (statusMode === 'Saved Only' && (locked || !saved)) return false
      if (statusMode === 'Saved + Locked' && !saved) return false

      if (throughDate && game.date && game.date > throughDate) return false
      if (gameType !== 'All' && (game.game_type || 'Friendly') !== gameType) return false

      return Boolean(lineupsByGame[String(game.id)])
    })
  }, [games, lineupsByGame, lineupLockedByGame, throughDate, gameType, statusMode])

  const totals = useMemo(() => {
    return computeTotals(
      filteredGames.map((g) => lineupsByGame[String(g.id)]),
      players
    )
  }, [filteredGames, lineupsByGame, players])

  const rows = useMemo(() => {
    return players.map((player) => {
      const t = totals[String(player.id)] || {}
      const priority = priorityByPlayer[String(player.id)] || {}
      const fieldTotal = Math.max(t.fieldTotal || 0, 1)

      return {
        playerId: String(player.id),
        name: player.name,
        games: t.games || 0,
        fieldTotal: t.fieldTotal || 0,
        Out: t.Out || 0,
        expectedOuts: t.expectedOuts || 0,
        actualOuts: t.actualOuts || 0,
        delta: t.delta || 0,
        P: t.P || 0,
        C: t.C || 0,
        '1B': t['1B'] || 0,
        '2B': t['2B'] || 0,
        '3B': t['3B'] || 0,
        SS: t.SS || 0,
        LF: t.LF || 0,
        CF: t.CF || 0,
        RF: t.RF || 0,
        IF: t.IF || 0,
        OF: t.OF || 0,
        targP: priority.P?.priority_pct || '',
        targC: priority.C?.priority_pct || '',
        targ1B: priority['1B']?.priority_pct || '',
        targ2B: priority['2B']?.priority_pct || '',
        targ3B: priority['3B']?.priority_pct || '',
        targSS: priority.SS?.priority_pct || '',
        targOF: priority.OF?.priority_pct || '',
        actP: Number((((t.P || 0) / fieldTotal) * 100).toFixed(1)),
        actC: Number((((t.C || 0) / fieldTotal) * 100).toFixed(1)),
        act1B: Number((((t['1B'] || 0) / fieldTotal) * 100).toFixed(1)),
        act2B: Number((((t['2B'] || 0) / fieldTotal) * 100).toFixed(1)),
        act3B: Number((((t['3B'] || 0) / fieldTotal) * 100).toFixed(1)),
        actSS: Number((((t.SS || 0) / fieldTotal) * 100).toFixed(1)),
        actOF: Number((((t.OF || 0) / fieldTotal) * 100).toFixed(1)),
      }
    })
  }, [players, totals, priorityByPlayer])

  return (
    <div className="stack">
      <div className="card">
        <h2>Tracking</h2>

        <div className="grid four-col">
          <div>
            <label>Through Date</label>
            <input type="date" value={throughDate} onChange={(e) => setThroughDate(e.target.value)} />
          </div>

          <div>
            <label>Game Type</label>
            <select value={gameType} onChange={(e) => setGameType(e.target.value)}>
              <option value="All">All</option>
              {GAME_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Status Filter</label>
            <select value={statusMode} onChange={(e) => setStatusMode(e.target.value)}>
              <option>Locked</option>
              <option>Saved Only</option>
              <option>Saved + Locked</option>
            </select>
          </div>

          <div>
            <label>Games in Universe</label>
            <div className="summary-box">{filteredGames.length}</div>
          </div>
        </div>
      </div>

      <TrackingTable title="Tracking Totals" rows={rows} />

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Tracking vs Positioning Priority</h3>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Games</th>
              <th>Fld</th>
              <th>P Tgt</th>
              <th>P Act%</th>
              <th>C Tgt</th>
              <th>C Act%</th>
              <th>1B Tgt</th>
              <th>1B Act%</th>
              <th>2B Tgt</th>
              <th>2B Act%</th>
              <th>3B Tgt</th>
              <th>3B Act%</th>
              <th>SS Tgt</th>
              <th>SS Act%</th>
              <th>OF Tgt</th>
              <th>OF Act%</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.playerId}>
                <td>{row.name}</td>
                <td>{row.games}</td>
                <td>{row.fieldTotal}</td>
                <td>{row.targP}</td>
                <td>{row.actP}</td>
                <td>{row.targC}</td>
                <td>{row.actC}</td>
                <td>{row.targ1B}</td>
                <td>{row.act1B}</td>
                <td>{row.targ2B}</td>
                <td>{row.act2B}</td>
                <td>{row.targ3B}</td>
                <td>{row.act3B}</td>
                <td>{row.targSS}</td>
                <td>{row.actSS}</td>
                <td>{row.targOF}</td>
                <td>{row.actOF}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
