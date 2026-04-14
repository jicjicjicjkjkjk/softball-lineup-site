import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const TEAM_ID = 'f76ea5a1-7c44-4789-bfbd-9771edd54f10'
const LOCAL_KEY = 'thunder-lineup-local-v3'

const rosterPlayers = [
  'Alanna',
  'Maggie',
  'Brooke',
  'Emily',
  'Josie',
  'Lucie',
  'Delaney',
  'Bella',
  'Bridget',
  'Elena',
  'Lily',
  'Molly',
  'Sub 1',
  'Sub 2',
  'Sub 3',
]

const players = rosterPlayers.map((name, index) => ({ id: index + 1, name }))

const fieldPositions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
const lockablePositions = [...fieldPositions, 'Out']
const trackedPositions = [...fieldPositions, 'Out']

const initialDepth = {
  P: ['Emily', 'Josie', 'Molly', 'Sub 1', 'Sub 2', 'Sub 3'],
  C: ['Lucie', 'Bella', 'Molly', 'Sub 1', 'Sub 2', 'Sub 3'],
  '1B': ['Brooke', 'Maggie', 'Lily', 'Sub 1', 'Sub 2', 'Sub 3'],
  '2B': ['Alanna', 'Bridget', 'Delaney', 'Sub 1', 'Sub 2', 'Sub 3'],
  '3B': ['Elena', 'Maggie', 'Brooke', 'Sub 1', 'Sub 2', 'Sub 3'],
  SS: ['Elena', 'Alanna', 'Bridget', 'Sub 1', 'Sub 2', 'Sub 3'],
  LF: ['Lily', 'Bella', 'Brooke', 'Sub 1', 'Sub 2', 'Sub 3'],
  CF: ['Delaney', 'Josie', 'Emily', 'Sub 1', 'Sub 2', 'Sub 3'],
  RF: ['Molly', 'Lucie', 'Bella', 'Sub 1', 'Sub 2', 'Sub 3'],
}

const attendanceSeed = [
  { date: '2026-04-15', season: 'In Season', type: 'Game', title: 'Game vs Wildcats' },
  { date: '2026-04-17', season: 'In Season', type: 'Team Practice', title: 'Team Practice' },
  { date: '2026-04-20', season: 'Optional', type: 'Stoppers Indoor', title: 'Indoor Work' },
]

function emptyTotals() {
  const totals = {}
  rosterPlayers.forEach((name) => {
    totals[name] = {
      totalField: 0,
      Out: 0,
      sitOuts: 0,
      totalTracked: 0,
    }
    trackedPositions.forEach((pos) => {
      totals[name][pos] = 0
    })
  })
  return totals
}

function cloneTotals(source) {
  return JSON.parse(JSON.stringify(source))
}

function addLineupToTotals(totals, lineup) {
  if (!lineup?.assignments) return totals

  lineup.assignments.forEach((inning) => {
    Object.entries(inning.positions || {}).forEach(([positionKey, playerName]) => {
      if (!playerName || !totals[playerName]) return

      if (positionKey.startsWith('Out')) {
        totals[playerName].Out += 1
        totals[playerName].sitOuts += 1
        totals[playerName].totalTracked += 1
      } else if (trackedPositions.includes(positionKey)) {
        totals[playerName][positionKey] += 1
        totals[playerName].totalField += 1
        totals[playerName].totalTracked += 1
      }
    })
  })

  return totals
}

function sumLineups(lineups) {
  const totals = emptyTotals()
  lineups.forEach((lineup) => addLineupToTotals(totals, lineup))
  return totals
}

function addTotals(a, b) {
  const merged = emptyTotals()
  rosterPlayers.forEach((name) => {
    trackedPositions.forEach((pos) => {
      merged[name][pos] = (a[name]?.[pos] || 0) + (b[name]?.[pos] || 0)
    })
    merged[name].Out = (a[name]?.Out || 0) + (b[name]?.Out || 0)
    merged[name].sitOuts = (a[name]?.sitOuts || 0) + (b[name]?.sitOuts || 0)
    merged[name].totalField = (a[name]?.totalField || 0) + (b[name]?.totalField || 0)
    merged[name].totalTracked = (a[name]?.totalTracked || 0) + (b[name]?.totalTracked || 0)
  })
  return merged
}

function requiredSitOuts(playerCount, innings) {
  return Math.max(0, playerCount - 9) * innings
}

function safeSupabaseReady() {
  return Boolean(supabase)
}

function mapDbGame(row) {
  return {
    id: row.id,
    date: row.game_date || '',
    opponent: row.opponent || '',
    status: row.status || 'Planned',
    notes: row.notes || '',
  }
}

function readLocalState() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) {
      return {
        lineupsByGame: {},
        optimizerSettingsByGame: {},
        locks: [],
        targetPercentages: {},
      }
    }
    return {
      lineupsByGame: {},
      optimizerSettingsByGame: {},
      locks: [],
      targetPercentages: {},
      ...JSON.parse(raw),
    }
  } catch {
    return {
      lineupsByGame: {},
      optimizerSettingsByGame: {},
      locks: [],
      targetPercentages: {},
    }
  }
}

function buildInningLockIndex(locksForGame) {
  const index = {}
  locksForGame.forEach((lock) => {
    for (let inning = lock.startInning; inning <= lock.endInning; inning += 1) {
      const key = `${inning}-${lock.position}`
      index[key] = lock.player
    }
  })
  return index
}

function positionRank(name, pos) {
  const list = initialDepth[pos] || []
  const idx = list.indexOf(name)
  return idx === -1 ? 999 : idx
}

function optimizeGame({ innings, availableNames, locksForGame, baseTotals }) {
  const runningTotals = cloneTotals(baseTotals)
  const lockIndex = buildInningLockIndex(locksForGame)
  const assignments = []

  for (let inning = 1; inning <= innings; inning += 1) {
    const positions = {}
    const used = new Set()

    const lockedOutPlayers = []

    fieldPositions.forEach((pos) => {
      const lockedPlayer = lockIndex[`${inning}-${pos}`]
      if (lockedPlayer && availableNames.includes(lockedPlayer)) {
        positions[pos] = lockedPlayer
        used.add(lockedPlayer)
      }
    })

    const genericOutPlayer = lockIndex[`${inning}-Out`]
    if (genericOutPlayer && availableNames.includes(genericOutPlayer)) {
      lockedOutPlayers.push(genericOutPlayer)
      used.add(genericOutPlayer)
    }

    fieldPositions.forEach((pos) => {
      if (positions[pos]) return

      const candidates = availableNames
        .filter((name) => !used.has(name))
        .sort((a, b) => {
          const rankDiff = positionRank(a, pos) - positionRank(b, pos)
          if (rankDiff !== 0) return rankDiff

          const posCountDiff = (runningTotals[a]?.[pos] || 0) - (runningTotals[b]?.[pos] || 0)
          if (posCountDiff !== 0) return posCountDiff

          return (runningTotals[a]?.totalField || 0) - (runningTotals[b]?.totalField || 0)
        })

      const selected = candidates[0]
      if (selected) {
        positions[pos] = selected
        used.add(selected)
      }
    })

    const remaining = availableNames.filter((name) => !used.has(name))

    const sortedOutPlayers = [
      ...lockedOutPlayers.filter((name, index, arr) => arr.indexOf(name) === index),
      ...remaining.sort((a, b) => {
        const outDiff = (runningTotals[a]?.Out || 0) - (runningTotals[b]?.Out || 0)
        if (outDiff !== 0) return outDiff

        return (runningTotals[b]?.totalField || 0) - (runningTotals[a]?.totalField || 0)
      }),
    ]

    sortedOutPlayers.forEach((playerName, index) => {
      positions[`Out${index + 1}`] = playerName
    })

    const row = { inning, positions }
    assignments.push(row)
    addLineupToTotals(runningTotals, { assignments: [row] })
  }

  return {
    innings,
    assignments,
  }
}

export default function App() {
  const [page, setPage] = useState('games')
  const [selectedGameId, setSelectedGameId] = useState(null)

  const [games, setGames] = useState([])
  const [gamesLoading, setGamesLoading] = useState(true)
  const [gamesError, setGamesError] = useState('')

  const [lineupsByGame, setLineupsByGame] = useState({})
  const [optimizerSettingsByGame, setOptimizerSettingsByGame] = useState({})
  const [locks, setLocks] = useState([])
  const [targetPercentages, setTargetPercentages] = useState({})

  const [selectedGameIds, setSelectedGameIds] = useState([])
  const [selectedPlayers, setSelectedPlayers] = useState(rosterPlayers)

  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')

  const [optimizerNewGameDate, setOptimizerNewGameDate] = useState('')
  const [optimizerNewGameOpponent, setOptimizerNewGameOpponent] = useState('')

  const [newLockGameId, setNewLockGameId] = useState('')
  const [newLockPlayer, setNewLockPlayer] = useState(rosterPlayers[0])
  const [newLockPosition, setNewLockPosition] = useState('P')
  const [newLockStartInning, setNewLockStartInning] = useState(1)
  const [newLockEndInning, setNewLockEndInning] = useState(1)

  const [removeInningChoice, setRemoveInningChoice] = useState(7)

  useEffect(() => {
    loadGames()
    const local = readLocalState()
    setLineupsByGame(local.lineupsByGame || {})
    setOptimizerSettingsByGame(local.optimizerSettingsByGame || {})
    setLocks(local.locks || [])
    setTargetPercentages(local.targetPercentages || {})
  }, [])

  useEffect(() => {
    localStorage.setItem(
      LOCAL_KEY,
      JSON.stringify({
        lineupsByGame,
        optimizerSettingsByGame,
        locks,
        targetPercentages,
      })
    )
  }, [lineupsByGame, optimizerSettingsByGame, locks, targetPercentages])

  const mergedGames = useMemo(() => {
    return games.map((game) => ({
      ...game,
      lineup: lineupsByGame[String(game.id)] || null,
      plannedInnings: optimizerSettingsByGame[String(game.id)]?.innings || 6,
    }))
  }, [games, lineupsByGame, optimizerSettingsByGame])

  const selectedGame = mergedGames.find((g) => String(g.id) === String(selectedGameId)) || null
  const selectedGames = mergedGames.filter((g) => selectedGameIds.includes(String(g.id)))
  const availableNames = selectedPlayers

  useEffect(() => {
    if (!selectedGameIds.length && mergedGames.length) {
      setSelectedGameIds([String(mergedGames[0].id)])
      setNewLockGameId(String(mergedGames[0].id))
    }
  }, [mergedGames, selectedGameIds.length])

  const ytdBeforeTotals = useMemo(() => {
    const otherLineups = mergedGames
      .filter((game) => !selectedGameIds.includes(String(game.id)))
      .filter((game) => game.status !== 'Cancelled')
      .map((game) => game.lineup)
      .filter(Boolean)

    return sumLineups(otherLineups)
  }, [mergedGames, selectedGameIds])

  const optimizedPlans = useMemo(() => {
    let runningTotals = cloneTotals(ytdBeforeTotals)
    const results = []

    const orderedSelectedGames = [...selectedGames].sort((a, b) => {
      const aKey = `${a.date || ''}-${a.id}`
      const bKey = `${b.date || ''}-${b.id}`
      return aKey.localeCompare(bKey)
    })

    orderedSelectedGames.forEach((game) => {
      const innings = Number(optimizerSettingsByGame[String(game.id)]?.innings || 6)
      const locksForGame = locks.filter((lock) => String(lock.gameId) === String(game.id))

      const lineup = optimizeGame({
        innings,
        availableNames,
        locksForGame,
        baseTotals: runningTotals,
      })

      addLineupToTotals(runningTotals, lineup)
      results.push({
        gameId: String(game.id),
        lineup,
      })
    })

    return results
  }, [selectedGames, optimizerSettingsByGame, locks, availableNames, ytdBeforeTotals])

  const currentPlanTotals = useMemo(() => {
    return sumLineups(optimizedPlans.map((x) => x.lineup))
  }, [optimizedPlans])

  const ytdAfterTotals = useMemo(() => {
    return addTotals(ytdBeforeTotals, currentPlanTotals)
  }, [ytdBeforeTotals, currentPlanTotals])

  async function loadGames() {
    setGamesLoading(true)
    setGamesError('')

    if (!safeSupabaseReady()) {
      setGamesError('Supabase is not connected.')
      setGamesLoading(false)
      return
    }

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

  async function createGame({ date, opponent }) {
    setGamesError('')

    if (!safeSupabaseReady()) {
      setGamesError('Supabase is not connected.')
      return null
    }

    const payload = {
      team_id: TEAM_ID,
      game_date: date || null,
      opponent: opponent || null,
      status: 'Planned',
    }

    const { data, error } = await supabase
      .from('games')
      .insert(payload)
      .select()
      .single()

    if (error) {
      setGamesError(error.message)
      return null
    }

    const mapped = mapDbGame(data)
    setGames((current) => [...current, mapped])
    setOptimizerSettingsByGame((current) => ({
      ...current,
      [String(mapped.id)]: { innings: 6 },
    }))
    return mapped
  }

  async function addGameFromGamesTab() {
    const game = await createGame({
      date: newGameDate,
      opponent: newGameOpponent,
    })

    if (game) {
      setNewGameDate('')
      setNewGameOpponent('')
    }
  }

  async function addGameFromOptimizer() {
    const game = await createGame({
      date: optimizerNewGameDate,
      opponent: optimizerNewGameOpponent,
    })

    if (game) {
      setOptimizerNewGameDate('')
      setOptimizerNewGameOpponent('')
      setSelectedGameIds((current) => [...new Set([...current, String(game.id)])])
      setNewLockGameId(String(game.id))
    }
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((game) =>
        String(game.id) === String(gameId) ? { ...game, [field]: value } : game
      )
    )

    if (!safeSupabaseReady()) {
      setGamesError('Supabase is not connected.')
      return
    }

    const updates = {}
    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'status') updates.status = value

    const { error } = await supabase
      .from('games')
      .update(updates)
      .eq('id', gameId)

    if (error) {
      setGamesError(error.message)
    }
  }

  function updateOptimizerInnings(gameId, innings) {
    setOptimizerSettingsByGame((current) => ({
      ...current,
      [String(gameId)]: { ...(current[String(gameId)] || {}), innings: Number(innings) },
    }))
  }

  function toggleSelectedGame(gameId) {
    const gameKey = String(gameId)
    setSelectedGameIds((current) =>
      current.includes(gameKey)
        ? current.filter((id) => id !== gameKey)
        : [...current, gameKey]
    )
  }

  function togglePlayer(name) {
    setSelectedPlayers((current) =>
      current.includes(name)
        ? current.filter((p) => p !== name)
        : [...current, name]
    )
  }

  function saveOptimizedLineupsToGames() {
    setLineupsByGame((current) => {
      const next = { ...current }
      optimizedPlans.forEach((plan) => {
        next[String(plan.gameId)] = plan.lineup
      })
      return next
    })
  }

  function clearLineup(gameId) {
    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
  }

  async function cancelGame(gameId) {
    setGames((current) =>
      current.map((game) =>
        String(game.id) === String(gameId)
          ? { ...game, status: 'Cancelled' }
          : game
      )
    )

    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })

    if (!safeSupabaseReady()) {
      setGamesError('Supabase is not connected.')
      return
    }

    const { error } = await supabase
      .from('games')
      .update({ status: 'Cancelled' })
      .eq('id', gameId)

    if (error) setGamesError(error.message)
  }

  async function reopenGame(gameId) {
    setGames((current) =>
      current.map((game) =>
        String(game.id) === String(gameId)
          ? { ...game, status: 'Planned' }
          : game
      )
    )

    if (!safeSupabaseReady()) {
      setGamesError('Supabase is not connected.')
      return
    }

    const { error } = await supabase
      .from('games')
      .update({ status: 'Planned' })
      .eq('id', gameId)

    if (error) setGamesError(error.message)
  }

  function openGame(gameId) {
    setSelectedGameId(String(gameId))
    setPage('game-detail')
  }

  function addLock() {
    if (!newLockGameId) return

    const nextLock = {
      id: Date.now().toString(),
      gameId: String(newLockGameId),
      player: newLockPlayer,
      position: newLockPosition,
      startInning: Number(newLockStartInning),
      endInning: Number(newLockEndInning),
    }

    setLocks((current) => [...current, nextLock])
  }

  function removeLock(lockId) {
    setLocks((current) => current.filter((lock) => lock.id !== lockId))
  }

  function updateGameAssignment(gameId, inningNumber, positionKey, newPlayer) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing) return current

      const nextAssignments = existing.assignments.map((inning) => {
        if (inning.inning !== inningNumber) return inning
        return {
          ...inning,
          positions: {
            ...inning.positions,
            [positionKey]: newPlayer,
          },
        }
      })

      return {
        ...current,
        [String(gameId)]: {
          ...existing,
          assignments: nextAssignments,
        },
      }
    })
  }

  function removeLastInning(gameId) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing || existing.assignments.length <= 1) return current

      const nextAssignments = existing.assignments.slice(0, -1)
      return {
        ...current,
        [String(gameId)]: {
          ...existing,
          innings: nextAssignments.length,
          assignments: nextAssignments,
        },
      }
    })
  }

  function removeSpecificInning(gameId, inningNumber) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing || existing.assignments.length <= 1) return current

      const nextAssignments = existing.assignments
        .filter((inning) => inning.inning !== Number(inningNumber))
        .map((inning, index) => ({
          ...inning,
          inning: index + 1,
        }))

      return {
        ...current,
        [String(gameId)]: {
          ...existing,
          innings: nextAssignments.length,
          assignments: nextAssignments,
        },
      }
    })
  }

  function maxOutCount(lineup) {
    if (!lineup?.assignments?.length) return 0
    return Math.max(
      ...lineup.assignments.map(
        (inning) => Object.keys(inning.positions || {}).filter((key) => key.startsWith('Out')).length
      ),
      0
    )
  }

  function targetValue(playerName, position) {
    return targetPercentages?.[playerName]?.[position] ?? ''
  }

  function updateTarget(playerName, position, value) {
    setTargetPercentages((current) => ({
      ...current,
      [playerName]: {
        ...(current[playerName] || {}),
        [position]: value,
      },
    }))
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

  function renderPlayersPage() {
    return (
      <div className="card">
        <h2>Players</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Type</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name}>
                <td>{player.name}</td>
                <td>{player.name.startsWith('Sub') ? 'Sub' : 'Rostered'}</td>
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

  function renderTargetsPage() {
    return (
      <div className="stack">
        <div className="card">
          <h2>Position Targets (%)</h2>
          <p>Use this instead of a traditional depth chart. Enter rough target percentages by player and position.</p>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                {trackedPositions.map((pos) => (
                  <th key={pos}>{pos}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {players.map((player) => (
                <tr key={player.name}>
                  <td>{player.name}</td>
                  {trackedPositions.map((pos) => (
                    <td key={pos}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={targetValue(player.name, pos)}
                        onChange={(e) => updateTarget(player.name, pos, e.target.value)}
                        placeholder="%"
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderTrackingPage() {
    const ytdTotals = sumLineups(
      mergedGames
        .filter((game) => game.status !== 'Cancelled')
        .map((game) => game.lineup)
        .filter(Boolean)
    )

    return (
      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Tracking</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
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
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name}>
                <td>{player.name}</td>
                <td>{ytdTotals[player.name]?.totalField || 0}</td>
                <td>{ytdTotals[player.name]?.Out || 0}</td>
                {fieldPositions.map((pos) => (
                  <td key={pos}>{ytdTotals[player.name]?.[pos] || 0}</td>
                ))}
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

          {gamesError && <p style={{ color: '#b91c1c' }}>Error: {gamesError}</p>}
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
              <label>Status</label>
              <div className="summary-box">Planned</div>
            </div>

            <div className="align-end">
              <button onClick={addGameFromGamesTab}>Add Game</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Use</th>
                <th>Date</th>
                <th>Opponent</th>
                <th>Opt Inng</th>
                <th>Status</th>
                <th>Lineup</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {mergedGames.map((game) => (
                <tr key={game.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selectedGameIds.includes(String(game.id))}
                      onChange={() => toggleSelectedGame(game.id)}
                    />
                  </td>
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
                      value={game.plannedInnings}
                      onChange={(e) => updateOptimizerInnings(game.id, Number(e.target.value))}
                    >
                      {[4, 5, 6, 7].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td>{game.status}</td>
                  <td>{game.lineup ? 'Saved' : 'Empty'}</td>
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
              {!mergedGames.length && !gamesLoading && (
                <tr>
                  <td colSpan="7">No games found for this team yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderSummaryTable(title, totals) {
    return (
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>{title}</h3>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>Fld</th>
              <th>Out</th>
              <th>P</th>
              <th>C</th>
              <th>SS</th>
              <th>CF</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.name}>
                <td>{player.name}</td>
                <td>{totals[player.name]?.totalField || 0}</td>
                <td>{totals[player.name]?.Out || 0}</td>
                <td>{totals[player.name]?.P || 0}</td>
                <td>{totals[player.name]?.C || 0}</td>
                <td>{totals[player.name]?.SS || 0}</td>
                <td>{totals[player.name]?.CF || 0}</td>
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

          <div className="grid four-col">
            <div>
              <label>New Game Date</label>
              <input
                type="date"
                value={optimizerNewGameDate}
                onChange={(e) => setOptimizerNewGameDate(e.target.value)}
              />
            </div>
            <div>
              <label>New Game Opponent</label>
              <input
                type="text"
                value={optimizerNewGameOpponent}
                onChange={(e) => setOptimizerNewGameOpponent(e.target.value)}
                placeholder="Opponent name"
              />
            </div>
            <div>
              <label>Add Game Here</label>
              <div className="summary-box">Create directly from optimizer</div>
            </div>
            <div className="align-end">
              <button onClick={addGameFromOptimizer}>Add Game</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Games to Optimize</h3>
          <div className="checkbox-grid">
            {mergedGames
              .filter((game) => game.status !== 'Cancelled')
              .map((game) => (
                <label key={game.id} className="checkbox-item">
                  <input
                    type="checkbox"
                    checked={selectedGameIds.includes(String(game.id))}
                    onChange={() => toggleSelectedGame(game.id)}
                  />
                  {game.date || 'No Date'} vs {game.opponent || 'Opponent'} ({game.plannedInnings} inn)
                </label>
              ))}
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
            Selected games: <strong>{selectedGames.length}</strong> | Available players:{' '}
            <strong>{availableNames.length}</strong> | Required sit-out innings:{' '}
            <strong>
              {selectedGames.reduce(
                (sum, game) => sum + requiredSitOuts(availableNames.length, game.plannedInnings),
                0
              )}
            </strong>
          </p>
        </div>

        <div className="card">
          <h3>Locks</h3>
          <div className="grid four-col">
            <div>
              <label>Game</label>
              <select value={newLockGameId} onChange={(e) => setNewLockGameId(e.target.value)}>
                <option value="">Select game</option>
                {mergedGames
                  .filter((game) => game.status !== 'Cancelled')
                  .map((game) => (
                    <option key={game.id} value={String(game.id)}>
                      {game.date || 'No Date'} vs {game.opponent || 'Opponent'}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label>Player</label>
              <select value={newLockPlayer} onChange={(e) => setNewLockPlayer(e.target.value)}>
                {rosterPlayers.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Position</label>
              <select value={newLockPosition} onChange={(e) => setNewLockPosition(e.target.value)}>
                {lockablePositions.map((pos) => (
                  <option key={pos} value={pos}>
                    {pos}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label>Start / End</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                <select value={newLockStartInning} onChange={(e) => setNewLockStartInning(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
                <select value={newLockEndInning} onChange={(e) => setNewLockEndInning(Number(e.target.value))}>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <button onClick={addLock}>Add Lock</button>
            <button onClick={saveOptimizedLineupsToGames}>Save / Overwrite Selected Lineups</button>
          </div>

          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <table>
              <thead>
                <tr>
                  <th>Game</th>
                  <th>Player</th>
                  <th>Position</th>
                  <th>Innings</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {locks.map((lock) => {
                  const game = mergedGames.find((g) => String(g.id) === String(lock.gameId))
                  return (
                    <tr key={lock.id}>
                      <td>{game ? `${game.date || 'No Date'} vs ${game.opponent || 'Opponent'}` : lock.gameId}</td>
                      <td>{lock.player}</td>
                      <td>{lock.position}</td>
                      <td>
                        {lock.startInning}-{lock.endInning}
                      </td>
                      <td>
                        <button onClick={() => removeLock(lock.id)}>Remove</button>
                      </td>
                    </tr>
                  )
                })}
                {!locks.length && (
                  <tr>
                    <td colSpan="5">No locks added yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {renderSummaryTable('YTD Before', ytdBeforeTotals)}
        {renderSummaryTable(`Current Plan (${selectedGames.length} game${selectedGames.length === 1 ? '' : 's'})`, currentPlanTotals)}
        {renderSummaryTable('YTD After', ytdAfterTotals)}
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
        <div className="card">
          <div className="row-between">
            <div>
              <h2>
                {selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
              </h2>
              <p>Status: <strong>{selectedGame.status}</strong></p>
            </div>
            <button className="no-print" onClick={() => setPage('games')}>
              Back to Games
            </button>
          </div>
          <p>No lineup saved yet. Use the Optimizer and save into this game.</p>
        </div>
      )
    }

    const outCount = maxOutCount(selectedGame.lineup)
    const outColumns = Array.from({ length: outCount }, (_, i) => `Out${i + 1}`)

    return (
      <div className="stack">
        <div className="card no-print">
          <div className="row-between">
            <div>
              <h2>
                {selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
              </h2>
              <p>
                Status: <strong>{selectedGame.status}</strong> | Innings:{' '}
                <strong>{selectedGame.lineup.assignments.length}</strong>
              </p>
            </div>

            <div className="button-row">
              <button onClick={() => setPage('games')}>Back to Games</button>
              <button onClick={() => removeLastInning(selectedGame.id)}>Remove Last Inning</button>
              <button onClick={() => window.print()}>Print Lineup</button>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <select
              value={removeInningChoice}
              onChange={(e) => setRemoveInningChoice(Number(e.target.value))}
              style={{ maxWidth: 140 }}
            >
              {selectedGame.lineup.assignments.map((inning) => (
                <option key={inning.inning} value={inning.inning}>
                  Inning {inning.inning}
                </option>
              ))}
            </select>
            <button onClick={() => removeSpecificInning(selectedGame.id, removeInningChoice)}>
              Remove Selected Inning
            </button>
          </div>
        </div>

        <div className="card print-card" style={{ overflowX: 'auto' }}>
          <h2>
            Thunder Lineup - {selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
          </h2>

          <table>
            <thead>
              <tr>
                <th>Inning</th>
                {fieldPositions.map((pos) => (
                  <th key={pos}>{pos}</th>
                ))}
                {outColumns.map((pos) => (
                  <th key={pos}>{pos}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {selectedGame.lineup.assignments.map((inningRow) => (
                <tr key={inningRow.inning}>
                  <td>{inningRow.inning}</td>

                  {fieldPositions.map((pos) => (
                    <td key={pos}>
                      <select
                        value={inningRow.positions[pos] || ''}
                        onChange={(e) =>
                          updateGameAssignment(selectedGame.id, inningRow.inning, pos, e.target.value)
                        }
                      >
                        <option value="">--</option>
                        {rosterPlayers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}

                  {outColumns.map((outKey) => (
                    <td key={outKey}>
                      <select
                        value={inningRow.positions[outKey] || ''}
                        onChange={(e) =>
                          updateGameAssignment(selectedGame.id, inningRow.inning, outKey, e.target.value)
                        }
                      >
                        <option value="">--</option>
                        {rosterPlayers.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                  ))}
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
          {renderNavButton('targets', 'Targets')}
          {renderNavButton('games', 'Games')}
          {renderNavButton('optimizer', 'Optimizer')}
          {renderNavButton('game-detail', 'Game Detail')}
          {renderNavButton('tracking', 'Tracking')}
        </div>
      </aside>

      <main className="main-content">
        {page === 'players' && renderPlayersPage()}
        {page === 'attendance' && renderAttendancePage()}
        {page === 'targets' && renderTargetsPage()}
        {page === 'games' && renderGamesPage()}
        {page === 'optimizer' && renderOptimizerPage()}
        {page === 'game-detail' && renderGameDetailPage()}
        {page === 'tracking' && renderTrackingPage()}
      </main>
    </div>
  )
}
