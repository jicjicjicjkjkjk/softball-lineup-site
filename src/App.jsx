import { useMemo, useState } from 'react'

const players = [
  { id: 1, name: 'Alanna' },
  { id: 2, name: 'Maggie' },
  { id: 3, name: 'Brooke' },
  { id: 4, name: 'Emily' },
  { id: 5, name: 'Josie' },
  { id: 6, name: 'Lucie' },
  { id: 7, name: 'Delaney' },
  { id: 8, name: 'Bella' },
  { id: 9, name: 'Bridget' },
  { id: 10, name: 'Elena' },
  { id: 11, name: 'Lily' },
  { id: 12, name: 'Molly' },
]

const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

const initialDepth = {
  P: ['Emily', 'Josie', 'Molly'],
  C: ['Lucie', 'Bella', 'Molly'],
  '1B': ['Brooke', 'Maggie', 'Lily'],
  '2B': ['Alanna', 'Bridget', 'Delaney'],
  '3B': ['Elena', 'Maggie', 'Brooke'],
  SS: ['Elena', 'Alanna', 'Bridget'],
  LF: ['Lily', 'Bella', 'Brooke'],
  CF: ['Delaney', 'Josie', 'Emily'],
  RF: ['Molly', 'Lucie', 'Bella'],
}

const attendanceSeed = [
  { date: '2026-04-15', season: 'In Season', type: 'Game', title: 'Game vs Wildcats' },
  { date: '2026-04-17', season: 'In Season', type: 'Team Practice', title: 'Team Practice' },
  { date: '2026-04-20', season: 'Optional', type: 'Stoppers Indoor', title: 'Indoor Work' },
]

function buildSimpleLineup(availablePlayers, innings, pitcher, catcher) {
  const active = availablePlayers.slice()
  const assignments = []
  const sitCounts = Object.fromEntries(active.map((p) => [p.name, 0]))

  for (let inning = 1; inning <= innings; inning += 1) {
    let pool = [...active]

    const inningAssignments = {
      inning,
      positions: {},
      sit: [],
    }

    if (pitcher) {
      inningAssignments.positions.P = pitcher
      pool = pool.filter((p) => p.name !== pitcher)
    }

    if (catcher) {
      inningAssignments.positions.C = catcher
      pool = pool.filter((p) => p.name !== catcher)
    }

    const remainingPositions = positions.filter((pos) => {
      if (pos === 'P' && pitcher) return false
      if (pos === 'C' && catcher) return false
      return true
    })

    for (const pos of remainingPositions) {
      const rankedNames = initialDepth[pos] || []
      const selected =
        pool.find((p) => rankedNames.includes(p.name)) || pool[0]

      if (selected) {
        inningAssignments.positions[pos] = selected.name
        pool = pool.filter((p) => p.name !== selected.name)
      }
    }

    inningAssignments.sit = pool.map((p) => p.name)
    inningAssignments.sit.forEach((name) => {
      sitCounts[name] = (sitCounts[name] || 0) + 1
    })

    assignments.push(inningAssignments)
  }

  return { assignments, sitCounts }
}

function requiredSitOuts(playerCount, innings) {
  return Math.max(0, playerCount - 9) * innings
}

export default function App() {
  const [page, setPage] = useState('optimizer')
  const [innings, setInnings] = useState(6)
  const [selectedPlayers, setSelectedPlayers] = useState(players.map((p) => p.name))
  const [pitcher, setPitcher] = useState('Emily')
  const [catcher, setCatcher] = useState('Lucie')
  const [savedGames, setSavedGames] = useState({
    1: null,
    2: null,
    3: null,
    4: null,
  })

  const availablePlayers = players.filter((p) => selectedPlayers.includes(p.name))

  const optimized = useMemo(() => {
    return buildSimpleLineup(availablePlayers, innings, pitcher, catcher)
  }, [availablePlayers, innings, pitcher, catcher])

  const sitRequired = requiredSitOuts(availablePlayers.length, innings)

  function togglePlayer(name) {
    setSelectedPlayers((current) =>
      current.includes(name)
        ? current.filter((p) => p !== name)
        : [...current, name]
    )
  }

  function saveToGame(gameNumber) {
    setSavedGames((current) => ({
      ...current,
      [gameNumber]: {
        innings,
        pitcher,
        catcher,
        availablePlayers: availablePlayers.map((p) => p.name),
        assignments: optimized.assignments,
        sitCounts: optimized.sitCounts,
      },
    }))
    setPage(`game${gameNumber}`)
  }

  function renderNavButton(key, label) {
    return (
      <button
        className={page === key ? 'nav-button active' : 'nav-button'}
        onClick={() => setPage(key)}
      >
        {label}
      </button>
    )
  }

  function renderGamePage(gameNumber) {
    const game = savedGames[gameNumber]

    if (!game) {
      return (
        <div className="card">
          <h2>Game {gameNumber}</h2>
          <p>No lineup saved yet. Go to Optimizer and save one here.</p>
        </div>
      )
    }

    return (
      <div className="stack">
        <div className="card no-print">
          <div className="row-between">
            <h2>Game {gameNumber}</h2>
            <button onClick={() => window.print()}>Print Lineup</button>
          </div>
          <p>
            Pitcher: <strong>{game.pitcher}</strong> | Catcher: <strong>{game.catcher}</strong> | Players Available: <strong>{game.availablePlayers.length}</strong>
          </p>
        </div>

        <div className="card print-card">
          <h2>Thunder Lineup - Game {gameNumber}</h2>
          <table>
            <thead>
              <tr>
                <th>Inning</th>
                {positions.map((pos) => (
                  <th key={pos}>{pos}</th>
                ))}
                <th>Sit</th>
              </tr>
            </thead>
            <tbody>
              {game.assignments.map((inningRow) => (
                <tr key={inningRow.inning}>
                  <td>{inningRow.inning}</td>
                  {positions.map((pos) => (
                    <td key={pos}>{inningRow.positions[pos] || ''}</td>
                  ))}
                  <td>{inningRow.sit.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <h3>Sit-Out Summary</h3>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Sit Outs</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(game.sitCounts).map(([name, count]) => (
                <tr key={name}>
                  <td>{name}</td>
                  <td>{count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderPlayersPage() {
    return (
      <div className="card">
        <h2>Players</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>Active</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderAttendancePage() {
    return (
      <div className="card">
        <h2>Attendance</h2>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Season</th>
              <th>Type</th>
              <th>Title</th>
            </tr>
          </thead>
          <tbody>
            {attendanceSeed.map((event) => (
              <tr key={`${event.date}-${event.title}`}>
                <td>{event.date}</td>
                <td>{event.season}</td>
                <td>{event.type}</td>
                <td>{event.title}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderDepthChartPage() {
    return (
      <div className="grid two-col">
        <div className="card">
          <h2>Depth Chart by Position</h2>
          <table>
            <thead>
              <tr>
                <th>Position</th>
                <th>Stack</th>
              </tr>
            </thead>
            <tbody>
              {positions.map((pos) => (
                <tr key={pos}>
                  <td>{pos}</td>
                  <td>{(initialDepth[pos] || []).join(' → ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2>Depth Chart by Player</h2>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>Approx Roles</th>
              </tr>
            </thead>
            <tbody>
              {players.map((player) => {
                const roles = positions.filter((pos) => (initialDepth[pos] || []).includes(player.name))
                return (
                  <tr key={player.name}>
                    <td>{player.name}</td>
                    <td>{roles.join(', ')}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderTrackingPage() {
    const seasonRows = players.map((player) => ({
      name: player.name,
      sitOuts: optimized.sitCounts[player.name] || 0,
      battingOrderAvg: '-',
      positionsPlayed: '-',
    }))

    return (
      <div className="card">
        <h2>Tracking</h2>
        <p>
          Required sit-out innings for current setup: <strong>{sitRequired}</strong>
        </p>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Sit Outs</th>
              <th>Batting Order</th>
              <th>Positions Played</th>
            </tr>
          </thead>
          <tbody>
            {seasonRows.map((row) => (
              <tr key={row.name}>
                <td>{row.name}</td>
                <td>{row.sitOuts}</td>
                <td>{row.battingOrderAvg}</td>
                <td>{row.positionsPlayed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  }

  function renderOptimizerPage() {
    return (
      <div className="stack">
        <div className="card">
          <h2>Optimizer</h2>
          <div className="grid three-col">
            <div>
              <label>Innings</label>
              <select value={innings} onChange={(e) => setInnings(Number(e.target.value))}>
                <option value={6}>6</option>
                <option value={7}>7</option>
              </select>
            </div>

            <div>
              <label>Pitcher</label>
              <select value={pitcher} onChange={(e) => setPitcher(e.target.value)}>
                {players.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Catcher</label>
              <select value={catcher} onChange={(e) => setCatcher(e.target.value)}>
                {players.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <h3>Available Players</h3>
          <div className="checkbox-grid">
            {players.map((player) => (
              <label key={player.name} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={selectedPlayers.includes(player.name)}
                  onChange={() => togglePlayer(player.name)}
                />
                {player.name}
              </label>
            ))}
          </div>

          <p>
            Players available: <strong>{availablePlayers.length}</strong> | Required sit-out innings: <strong>{sitRequired}</strong>
          </p>

          <div className="button-row">
            <button onClick={() => saveToGame(1)}>Save to Game 1</button>
            <button onClick={() => saveToGame(2)}>Save to Game 2</button>
            <button onClick={() => saveToGame(3)}>Save to Game 3</button>
            <button onClick={() => saveToGame(4)}>Save to Game 4</button>
          </div>
        </div>

        <div className="card">
          <h2>Optimized Preview</h2>
          <table>
            <thead>
              <tr>
                <th>Inning</th>
                {positions.map((pos) => (
                  <th key={pos}>{pos}</th>
                ))}
                <th>Sit</th>
              </tr>
            </thead>
            <tbody>
              {optimized.assignments.map((inningRow) => (
                <tr key={inningRow.inning}>
                  <td>{inningRow.inning}</td>
                  {positions.map((pos) => (
                    <td key={pos}>{inningRow.positions[pos] || ''}</td>
                  ))}
                  <td>{inningRow.sit.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <h1>Thunder Lineup Tool</h1>
        <div className="nav-stack">
          {renderNavButton('players', 'Players')}
          {renderNavButton('attendance', 'Attendance')}
          {renderNavButton('depth', 'Depth Chart')}
          {renderNavButton('optimizer', 'Optimizer')}
          {renderNavButton('game1', 'Game 1')}
          {renderNavButton('game2', 'Game 2')}
          {renderNavButton('game3', 'Game 3')}
          {renderNavButton('game4', 'Game 4')}
          {renderNavButton('tracking', 'Tracking')}
        </div>
      </aside>

      <main className="main-content">
        {page === 'players' && renderPlayersPage()}
        {page === 'attendance' && renderAttendancePage()}
        {page === 'depth' && renderDepthChartPage()}
        {page === 'optimizer' && renderOptimizerPage()}
        {page === 'game1' && renderGamePage(1)}
        {page === 'game2' && renderGamePage(2)}
        {page === 'game3' && renderGamePage(3)}
        {page === 'game4' && renderGamePage(4)}
        {page === 'tracking' && renderTrackingPage()}
      </main>
    </div>
  )
}