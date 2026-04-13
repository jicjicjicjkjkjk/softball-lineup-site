import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const TEAM_ID = "f76ea5a1-7c44-4789-bfbd-9771edd54f10"

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
      const selected = pool.find((p) => rankedNames.includes(p.name)) || pool[0]

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

function recalculateSitCounts(assignments) {
  const sitCounts = {}

  assignments.forEach((inning) => {
    ;(inning.sit || []).forEach((name) => {
      sitCounts[name] = (sitCounts[name] || 0) + 1
    })
  })

  return sitCounts
}

function mapDbGame(row) {
  return {
    id: row.id,
    date: row.game_date || '',
    opponent: row.opponent || '',
    innings: row.innings || 6,
    status: row.status || 'Planned',
    notes: row.notes || '',
    lineup: null,
  }
}

export default function App() {
  const [page, setPage] = useState('optimizer')
  const [selectedGameId, setSelectedGameId] = useState(null)
  const [games, setGames] = useState([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [gamesError, setGamesError] = useState('')

  const [innings, setInnings] = useState(6)
  const [selectedPlayers, setSelectedPlayers] = useState(players.map((p) => p.name))
  const [pitcher, setPitcher] = useState('Emily')
  const [catcher, setCatcher] = useState('Lucie')
  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [newGameInnings, setNewGameInnings] = useState(6)

  const availablePlayers = players.filter((p) => selectedPlayers.includes(p.name))

  const optimized = useMemo(() => {
    return buildSimpleLineup(availablePlayers, innings, pitcher, catcher)
  }, [availablePlayers, innings, pitcher, catcher])

  const sitRequired = requiredSitOuts(availablePlayers.length, innings)

  useEffect(() => {
    loadGames()
  }, [])

  async function loadGames() {
    setGamesLoading(true)
    setGamesError('')

    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('team_id', TEAM_ID)
      .order('game_date', { ascending: true, nullsFirst: false })

    if (error) {
      setGamesError(error.message)
      setGamesLoading(false)
      return
    }

    setGames((data || []).map(mapDbGame))
    setGamesLoading(false)
  }

  function togglePlayer(name) {
    setSelectedPlayers((current) =>
      current.includes(name)
        ? current.filter((p) => p !== name)
        : [...current, name]
    )
  }

  async function addGame() {
    setGamesError('')

    const payload = {
      team_id: TEAM_ID,
      game_date: newGameDate || null,
      opponent: newGameOpponent || null,
      innings: Number(newGameInnings),
      status: 'Planned',
    }

    const { data, error } = await supabase
      .from('games')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setGamesError(error.message)
      return
    }

    setGames((current) => [...current, mapDbGame(data)])
    setNewGameDate('')
    setNewGameOpponent('')
    setNewGameInnings(6)
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((game) =>
        game.id === gameId
          ? {
              ...game,
              [field]: value,
            }
          : game
      )
    )

    const updates = {}

    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'innings') updates.innings = Number(value)
    if (field === 'status') updates.status = value

    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId)

    if (error) {
      setGamesError(error.message)
    }
  }

  function saveToGame(gameId) {
    setGames((current) =>
      current.map((game) =>
        game.id === gameId
          ? {
              ...game,
              innings,
              lineup: {
                innings,
                pitcher,
                catcher,
                availablePlayers: availablePlayers.map((p) => p.name),
                assignments: optimized.assignments,
                sitCounts: optimized.sitCounts,
              },
            }
          : game
      )
    )

    setSelectedGameId(gameId)
    setPage('game-detail')
  }

  function clearLineup(gameId) {
    setGames((current) =>
      current.map((game) =>
        game.id === gameId
          ? {
              ...game,
              lineup: null,
            }
          : game
      )
    )
  }

  async function cancelGame(gameId) {
    setGames((current) =>
      current.map((game) =>
        game.id === gameId
          ? {
              ...game,
              status: 'Cancelled',
              lineup: null,
            }
          : game
      )
    )

    const { error } = await supabase
      .from('games')
      .update({ status: 'Cancelled' })
      .eq('id', gameId)

    if (error) {
      setGamesError(error.message)
    }
  }

  async function reopenGame(gameId) {
    setGames((current) =>
      current.map((game) =>
        game.id === gameId
          ? {
              ...game,
              status: 'Planned',
            }
          : game
      )
    )

    const { error } = await supabase
      .from('games')
      .update({ status: 'Planned' })
      .eq('id', gameId)

    if (error) {
      setGamesError(error.message)
    }
  }

  function openGame(gameId) {
    setSelectedGameId(gameId)
    setPage('game-detail')
  }

  function updateGameAssignment(gameId, inningNumber, position, newPlayer) {
    setGames((current) =>
      current.map((game) => {
        if (game.id !== gameId || !game.lineup) return game

        const newAssignments = game.lineup.assignments.map((row) => {
          if (row.inning !== inningNumber) return row

          return {
            ...row,
            positions: {
              ...row.positions,
              [position]: newPlayer,
            },
          }
        })

        return {
          ...game,
          lineup: {
            ...game.lineup,
            assignments: newAssignments,
          },
        }
      })
    )
  }

  function recalculateGameSitOuts(gameId) {
    setGames((current) =>
      current.map((game) => {
        if (game.id !== gameId || !game.lineup) return game

        return {
          ...game,
          lineup: {
            ...game.lineup,
            sitCounts: recalculateSitCounts(game.lineup.assignments),
          },
        }
      })
    )
  }

  const selectedGame = games.find((g) => g.id === selectedGameId) || null

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
    const seasonRows = players.map((player) => {
      let sitOuts = 0

      games.forEach((game) => {
        if (game.status === 'Cancelled') return
        if (!game.lineup) return
        sitOuts += game.lineup.sitCounts?.[player.name] || 0
      })

      return {
        name: player.name,
        sitOuts,
        battingOrderAvg: '-',
        positionsPlayed: '-',
      }
    })

    return (
      <div className="card">
        <h2>Tracking</h2>
        <p>This page rolls up saved games and local lineups.</p>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Total Sit Outs</th>
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

  function renderGamesPage() {
    return (
      <div className="stack">
        <div className="card">
          <div className="row-between">
            <h2>Games</h2>
            <button onClick={loadGames}>Reload from Database</button>
          </div>

          {gamesError && <p className="error-text">Error: {gamesError}</p>}
          {gamesLoading && <p>Loading games...</p>}

          <div className="grid four-col">
            <div>
              <label>Date</label>
              <input
                type="date"
                value={newGameDate}
                onChange={(e) => setNewGameDate(e.target.value)}
              />
            </div>

            <div>
              <label>Opponent</label>
              <input
                type="text"
                value={newGameOpponent}
                onChange={(e) => setNewGameOpponent(e.target.value)}
                placeholder="Opponent name"
              />
            </div>

            <div>
              <label>Innings</label>
              <select
                value={newGameInnings}
                onChange={(e) => setNewGameInnings(Number(e.target.value))}
              >
                <option value={6}>6</option>
                <option value={7}>7</option>
              </select>
            </div>

            <div className="align-end">
              <button onClick={addGame}>Add Game</button>
            </div>
          </div>
        </div>

        <div className="card">
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Opponent</th>
                <th>Innings</th>
                <th>Status</th>
                <th>Lineup</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td>
                    <input
                      type="date"
                      value={game.date}
                      onChange={(e) => updateGameField(game.id, 'date', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={game.opponent}
                      onChange={(e) => updateGameField(game.id, 'opponent', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={game.innings}
                      onChange={(e) => updateGameField(game.id, 'innings', Number(e.target.value))}
                    >
                      <option value={6}>6</option>
                      <option value={7}>7</option>
                    </select>
                  </td>
                  <td>{game.status}</td>
                  <td>{game.lineup ? 'Local Only' : 'Empty'}</td>
                  <td>
                    <div className="button-row">
                      <button onClick={() => openGame(game.id)}>Go to Game</button>
                      <button onClick={() => clearLineup(game.id)}>Clear Lineup</button>
                      {game.status === 'Cancelled' ? (
                        <button onClick={() => reopenGame(game.id)}>Reopen</button>
                      ) : (
                        <button onClick={() => cancelGame(game.id)}>Cancel Game</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!games.length && !gamesLoading && (
                <tr>
                  <td colSpan="6">No games found for this team yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderGameDetailPage() {
    if (!selectedGame) {
      return (
        <div className="card">
          <h2>Game Detail</h2>
          <p>Select a game from the Games page.</p>
        </div>
      )
    }

    if (!selectedGame.lineup) {
      return (
        <div className="stack">
          <div className="card">
            <div className="row-between">
              <div>
                <h2>
                  {selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
                </h2>
                <p>
                  Status: <strong>{selectedGame.status}</strong> | Innings:{' '}
                  <strong>{selectedGame.innings}</strong>
                </p>
              </div>
              <button className="no-print" onClick={() => setPage('games')}>
                Back to Games
              </button>
            </div>
            <p>No lineup saved yet. Use the Optimizer and save into this game.</p>
          </div>
        </div>
      )
    }

    const game = selectedGame

    return (
      <div className="stack">
        <div className="card no-print">
          <div className="row-between">
            <div>
              <h2>
                {game.date || 'No Date'} vs {game.opponent || 'Opponent'}
              </h2>
              <p>
                Status: <strong>{game.status}</strong> | Innings: <strong>{game.innings}</strong>
              </p>
              <p>
                Pitcher: <strong>{game.lineup.pitcher}</strong> | Catcher:{' '}
                <strong>{game.lineup.catcher}</strong> | Players Available:{' '}
                <strong>{game.lineup.availablePlayers.length}</strong>
              </p>
            </div>

            <div className="button-row">
              <button onClick={() => setPage('games')}>Back to Games</button>
              <button onClick={() => recalculateGameSitOuts(game.id)}>Recalculate Sit-Outs</button>
              <button onClick={() => window.print()}>Print Lineup</button>
            </div>
          </div>
        </div>

        <div className="card print-card">
          <h2>
            Thunder Lineup - {game.date || 'No Date'} vs {game.opponent || 'Opponent'}
          </h2>

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
              {game.lineup.assignments.map((inningRow) => (
                <tr key={inningRow.inning}>
                  <td>{inningRow.inning}</td>
                  {positions.map((pos) => (
                    <td key={pos}>
                      <select
                        value={inningRow.positions[pos] || ''}
                        onChange={(e) =>
                          updateGameAssignment(game.id, inningRow.inning, pos, e.target.value)
                        }
                      >
                        <option value="">--</option>
                        {players.map((p) => (
                          <option key={p.name} value={p.name}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                    </td>
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
              {players.map((player) => (
                <tr key={player.name}>
                  <td>{player.name}</td>
                  <td>{game.lineup.sitCounts?.[player.name] || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderOptimizerPage() {
    return (
      <div className="stack">
        <div className="card">
          <h2>Optimizer</h2>

          <div className="grid four-col">
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

            <div>
              <label>Save Into Game</label>
              <select
                value={selectedGameId || ''}
                onChange={(e) => setSelectedGameId(e.target.value)}
              >
                <option value="">Select game</option>
                {games
                  .filter((game) => game.status !== 'Cancelled')
                  .map((game) => (
                    <option key={game.id} value={game.id}>
                      {game.date || 'No Date'} vs {game.opponent || 'Opponent'}
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
            Players available: <strong>{availablePlayers.length}</strong> | Required sit-out innings:{' '}
            <strong>{sitRequired}</strong>
          </p>

          <div className="button-row">
            <button
              onClick={() => {
                if (selectedGameId) saveToGame(selectedGameId)
              }}
            >
              Save to Selected Game
            </button>
            <button onClick={() => setPage('games')}>Go to Games Page</button>
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
          {renderNavButton('games', 'Games')}
          {renderNavButton('optimizer', 'Optimizer')}
          {renderNavButton('game-detail', 'Game Detail')}
          {renderNavButton('tracking', 'Tracking')}
        </div>
      </aside>

      <main className="main-content">
        {page === 'players' && renderPlayersPage()}
        {page === 'attendance' && renderAttendancePage()}
        {page === 'depth' && renderDepthChartPage()}
        {page === 'games' && renderGamesPage()}
        {page === 'optimizer' && renderOptimizerPage()}
        {page === 'game-detail' && renderGameDetailPage()}
        {page === 'tracking' && renderTrackingPage()}
      </main>
    </div>
  )
}