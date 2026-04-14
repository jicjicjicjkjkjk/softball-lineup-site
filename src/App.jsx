import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const TEAM_ID = 'f76ea5a1-7c44-4789-bfbd-9771edd54f10'

const fallbackPlayers = [
  { name: 'Alanna', jersey_number: '1', active: true },
  { name: 'Maggie', jersey_number: '2', active: true },
  { name: 'Brooke', jersey_number: '3', active: true },
  { name: 'Emily', jersey_number: '4', active: true },
  { name: 'Josie', jersey_number: '5', active: true },
  { name: 'Lucie', jersey_number: '6', active: true },
  { name: 'Delaney', jersey_number: '7', active: true },
  { name: 'Bella', jersey_number: '8', active: true },
  { name: 'Bridget', jersey_number: '9', active: true },
  { name: 'Elena', jersey_number: '10', active: true },
  { name: 'Lily', jersey_number: '11', active: true },
  { name: 'Molly', jersey_number: '12', active: true },
  { name: 'Sub 1', jersey_number: 'S1', active: true },
  { name: 'Sub 2', jersey_number: 'S2', active: true },
  { name: 'Sub 3', jersey_number: 'S3', active: true },
]

const fieldPositions = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
const positionOptions = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out', 'Injury']
const targetColumns = ['P', 'C', 'IF', 'OF', 'CF', 'Out']

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

function safeSupabaseReady() {
  return Boolean(supabase)
}

function sortRows(rows, sortConfig) {
  const { key, direction } = sortConfig
  if (!key) return rows

  const multiplier = direction === 'asc' ? 1 : -1

  return [...rows].sort((a, b) => {
    const av = a[key]
    const bv = b[key]

    const aNum = Number(av)
    const bNum = Number(bv)

    if (!Number.isNaN(aNum) && !Number.isNaN(bNum) && String(av).trim() !== '' && String(bv).trim() !== '') {
      return (aNum - bNum) * multiplier
    }

    return String(av ?? '').localeCompare(String(bv ?? '')) * multiplier
  })
}

function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function blankLineup(playerIds, innings) {
  const cells = {}
  const battingOrder = {}

  playerIds.forEach((id) => {
    const key = String(id)
    cells[key] = {}
    battingOrder[key] = ''
    for (let inning = 1; inning <= innings; inning += 1) {
      cells[key][inning] = ''
    }
  })

  return {
    innings,
    availablePlayerIds: playerIds.map(String),
    battingOrder,
    cells,
  }
}

function normalizeLineup(lineup, playerIds, innings) {
  const normalized = lineup
    ? {
        innings: lineup.innings || innings,
        availablePlayerIds: (lineup.availablePlayerIds || playerIds).map(String),
        battingOrder: { ...(lineup.battingOrder || {}) },
        cells: { ...(lineup.cells || {}) },
      }
    : blankLineup(playerIds, innings)

  playerIds.forEach((id) => {
    const key = String(id)
    if (!normalized.cells[key]) normalized.cells[key] = {}
    if (normalized.battingOrder[key] === undefined) normalized.battingOrder[key] = ''
    for (let inning = 1; inning <= normalized.innings; inning += 1) {
      if (normalized.cells[key][inning] === undefined) normalized.cells[key][inning] = ''
    }
  })

  Object.keys(normalized.cells).forEach((playerId) => {
    for (let inning = 1; inning <= normalized.innings; inning += 1) {
      if (normalized.cells[playerId][inning] === undefined) normalized.cells[playerId][inning] = ''
    }
  })

  return normalized
}

function gameRowSummary(lineup, playerId) {
  const row = {
    IF: 0,
    OF: 0,
    P: 0,
    C: 0,
    Out: 0,
    Injury: 0,
  }

  if (!lineup?.cells?.[playerId]) return row

  Object.values(lineup.cells[playerId]).forEach((value) => {
    if (['1B', '2B', '3B', 'SS'].includes(value)) row.IF += 1
    if (['LF', 'RF'].includes(value)) row.OF += 1
    if (value === 'CF') row.OF += 1
    if (value === 'P') row.P += 1
    if (value === 'C') row.C += 1
    if (value === 'Out') row.Out += 1
    if (value === 'Injury') row.Injury += 1
  })

  return row
}

function computeLineupTotals(lineups, players) {
  const totals = {}

  players.forEach((player) => {
    totals[String(player.id)] = {
      playerId: String(player.id),
      name: player.name,
      jersey_number: player.jersey_number || '',
      P: 0,
      C: 0,
      '1B': 0,
      '2B': 0,
      '3B': 0,
      SS: 0,
      LF: 0,
      CF: 0,
      RF: 0,
      IF: 0,
      OF: 0,
      Out: 0,
      Injury: 0,
      fieldTotal: 0,
      expectedOuts: 0,
      actualOuts: 0,
      delta: 0,
    }
  })

  lineups.forEach((lineup) => {
    if (!lineup) return

    const availableIds = (lineup.availablePlayerIds || []).map(String)

    for (let inning = 1; inning <= (lineup.innings || 0); inning += 1) {
      const eligibleIds = availableIds.filter((playerId) => {
        const value = lineup.cells?.[playerId]?.[inning] || ''
        return value !== 'Injury'
      })

      const requiredOuts = Math.max(0, eligibleIds.length - 9)
      const expectedShare = eligibleIds.length ? requiredOuts / eligibleIds.length : 0

      availableIds.forEach((playerId) => {
        const value = lineup.cells?.[playerId]?.[inning] || ''
        if (!totals[playerId]) return

        if (value === 'Injury') {
          totals[playerId].Injury += 1
          return
        }

        if (eligibleIds.includes(playerId)) {
          totals[playerId].expectedOuts += expectedShare
        }

        if (value === 'Out') {
          totals[playerId].Out += 1
          totals[playerId].actualOuts += 1
        }

        if (fieldPositions.includes(value)) {
          totals[playerId][value] += 1
          totals[playerId].fieldTotal += 1
        }

        if (['1B', '2B', '3B', 'SS'].includes(value)) totals[playerId].IF += 1
        if (['LF', 'RF', 'CF'].includes(value)) totals[playerId].OF += 1
      })
    }
  })

  Object.values(totals).forEach((row) => {
    row.delta = Number((row.actualOuts - row.expectedOuts).toFixed(2))
    row.expectedOuts = Number(row.expectedOuts.toFixed(2))
  })

  return totals
}

function addTotals(a, b, players) {
  const merged = {}

  players.forEach((player) => {
    const key = String(player.id)
    merged[key] = {
      playerId: key,
      name: player.name,
      jersey_number: player.jersey_number || '',
      P: (a[key]?.P || 0) + (b[key]?.P || 0),
      C: (a[key]?.C || 0) + (b[key]?.C || 0),
      '1B': (a[key]?.['1B'] || 0) + (b[key]?.['1B'] || 0),
      '2B': (a[key]?.['2B'] || 0) + (b[key]?.['2B'] || 0),
      '3B': (a[key]?.['3B'] || 0) + (b[key]?.['3B'] || 0),
      SS: (a[key]?.SS || 0) + (b[key]?.SS || 0),
      LF: (a[key]?.LF || 0) + (b[key]?.LF || 0),
      CF: (a[key]?.CF || 0) + (b[key]?.CF || 0),
      RF: (a[key]?.RF || 0) + (b[key]?.RF || 0),
      IF: (a[key]?.IF || 0) + (b[key]?.IF || 0),
      OF: (a[key]?.OF || 0) + (b[key]?.OF || 0),
      Out: (a[key]?.Out || 0) + (b[key]?.Out || 0),
      Injury: (a[key]?.Injury || 0) + (b[key]?.Injury || 0),
      fieldTotal: (a[key]?.fieldTotal || 0) + (b[key]?.fieldTotal || 0),
      expectedOuts: Number(((a[key]?.expectedOuts || 0) + (b[key]?.expectedOuts || 0)).toFixed(2)),
      actualOuts: (a[key]?.actualOuts || 0) + (b[key]?.actualOuts || 0),
      delta: Number(((a[key]?.delta || 0) + (b[key]?.delta || 0)).toFixed(2)),
    }
  })

  return merged
}

function requiredOutsForGame(playerCount, innings) {
  return Math.max(0, playerCount - 9) * innings
}

function depthRank(name, position) {
  const rank = initialDepth[position] || []
  const idx = rank.indexOf(name)
  return idx === -1 ? 999 : idx
}

function optimizeLineup({ players, availablePlayerIds, innings, locks, ytdTotals, existingLineup }) {
  const lineup = normalizeLineup(existingLineup, players.map((p) => p.id), innings)
  lineup.availablePlayerIds = availablePlayerIds.map(String)
  lineup.innings = innings

  players.forEach((player) => {
    const playerId = String(player.id)
    for (let inning = 1; inning <= innings; inning += 1) {
      lineup.cells[playerId][inning] = ''
    }
  })

  for (let inning = 1; inning <= innings; inning += 1) {
    const availablePlayers = players.filter((p) => availablePlayerIds.includes(String(p.id)))
    const used = new Set()

    const inningLocks = locks.filter(
      (lock) =>
        inning >= Number(lock.startInning) &&
        inning <= Number(lock.endInning)
    )

    inningLocks.forEach((lock) => {
      const playerId = String(lock.playerId)
      if (!availablePlayerIds.includes(playerId)) return
      if (!lineup.cells[playerId]) return

      lineup.cells[playerId][inning] = lock.position
      used.add(playerId)
    })

    fieldPositions.forEach((position) => {
      const alreadyAssigned = availablePlayers.find(
        (p) => lineup.cells[String(p.id)][inning] === position
      )
      if (alreadyAssigned) return

      const candidates = availablePlayers
        .filter((p) => !used.has(String(p.id)))
        .sort((a, b) => {
          const rankDiff = depthRank(a.name, position) - depthRank(b.name, position)
          if (rankDiff !== 0) return rankDiff

          const aTotal = ytdTotals[String(a.id)]?.[position] || 0
          const bTotal = ytdTotals[String(b.id)]?.[position] || 0
          return aTotal - bTotal
        })

      const selected = candidates[0]
      if (!selected) return

      lineup.cells[String(selected.id)][inning] = position
      used.add(String(selected.id))
    })

    availablePlayers
      .filter((p) => !used.has(String(p.id)))
      .sort((a, b) => {
        const aOut = ytdTotals[String(a.id)]?.Out || 0
        const bOut = ytdTotals[String(b.id)]?.Out || 0
        return aOut - bOut
      })
      .forEach((player) => {
        lineup.cells[String(player.id)][inning] = 'Out'
      })
  }

  return lineup
}

export default function App() {
  const [page, setPage] = useState('games')
  const [games, setGames] = useState([])
  const [players, setPlayers] = useState([])
  const [lineupsByGame, setLineupsByGame] = useState({})
  const [targetsByPlayer, setTargetsByPlayer] = useState({})
  const [gamesError, setGamesError] = useState('')
  const [loading, setLoading] = useState(true)

  const [selectedGameId, setSelectedGameId] = useState('')
  const [optimizerGameId, setOptimizerGameId] = useState('')

  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [optimizerNewDate, setOptimizerNewDate] = useState('')
  const [optimizerNewOpponent, setOptimizerNewOpponent] = useState('')

  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerNumber, setNewPlayerNumber] = useState('')
  const [newPlayerActive, setNewPlayerActive] = useState(true)

  const [optimizerAvailableIds, setOptimizerAvailableIds] = useState([])
  const [optimizerPreview, setOptimizerPreview] = useState(null)

  const [lockPlayerId, setLockPlayerId] = useState('')
  const [lockPosition, setLockPosition] = useState('P')
  const [lockStart, setLockStart] = useState(1)
  const [lockEnd, setLockEnd] = useState(1)
  const [locksByGame, setLocksByGame] = useState({})

  const [playerSort, setPlayerSort] = useState({ key: 'name', direction: 'asc' })
  const [gameSort, setGameSort] = useState({ key: 'date', direction: 'asc' })
  const [targetSort, setTargetSort] = useState({ key: 'name', direction: 'asc' })
  const [trackingSort, setTrackingSort] = useState({ key: 'name', direction: 'asc' })

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!optimizerGameId) return
    const game = games.find((g) => String(g.id) === String(optimizerGameId))
    if (!game) return

    const saved = lineupsByGame[String(game.id)]
    if (saved?.availablePlayerIds?.length) {
      setOptimizerAvailableIds(saved.availablePlayerIds.map(String))
    } else {
      setOptimizerAvailableIds(
        players.filter((p) => p.active !== false).map((p) => String(p.id))
      )
    }
  }, [optimizerGameId, games, lineupsByGame, players])

  const selectedGame = games.find((g) => String(g.id) === String(selectedGameId)) || null
  const selectedGameLineup = selectedGame ? lineupsByGame[String(selectedGame.id)] || null : null

  const ytdBeforeTotals = useMemo(() => {
    const otherLineups = Object.entries(lineupsByGame)
      .filter(([gameId]) => String(gameId) !== String(optimizerGameId))
      .map(([, lineup]) => lineup)

    return computeLineupTotals(otherLineups, players)
  }, [lineupsByGame, optimizerGameId, players])

  const currentPlanTotals = useMemo(() => {
    return computeLineupTotals(optimizerPreview ? [optimizerPreview] : [], players)
  }, [optimizerPreview, players])

  const ytdAfterTotals = useMemo(() => {
    return addTotals(ytdBeforeTotals, currentPlanTotals, players)
  }, [ytdBeforeTotals, currentPlanTotals, players])

  const sortedPlayers = useMemo(() => {
    return sortRows(
      players.map((p) => ({
        ...p,
        name: p.name,
        jersey_number: p.jersey_number || '',
        activeText: p.active === false ? 'No' : 'Yes',
      })),
      playerSort
    )
  }, [players, playerSort])

  const sortedGames = useMemo(() => {
    const rows = games.map((g) => ({
      ...g,
      date: g.date || '',
      opponent: g.opponent || '',
      innings: g.innings || 6,
      status: g.status || 'Planned',
      hasLineup: lineupsByGame[String(g.id)] ? 'Yes' : 'No',
    }))
    return sortRows(rows, gameSort)
  }, [games, lineupsByGame, gameSort])

  const targetRows = useMemo(() => {
    const rows = players.map((player) => {
      const target = targetsByPlayer[String(player.id)] || {}
      const subtotal = targetColumns.reduce((sum, key) => sum + Number(target[key] || 0), 0)
      return {
        playerId: String(player.id),
        name: player.name,
        number: player.jersey_number || '',
        P: target.P || '',
        C: target.C || '',
        IF: target.IF || '',
        OF: target.OF || '',
        CF: target.CF || '',
        Out: target.Out || '',
        subtotal,
      }
    })

    return sortRows(targetRowsPrepare(rows), targetSort)
  }, [players, targetsByPlayer, targetSort])

  const trackingRows = useMemo(() => {
    const totals = computeLineupTotals(Object.values(lineupsByGame), players)
    const rows = players.map((player) => ({
      playerId: String(player.id),
      name: player.name,
      jersey_number: player.jersey_number || '',
      fieldTotal: totals[String(player.id)]?.fieldTotal || 0,
      Out: totals[String(player.id)]?.Out || 0,
      expectedOuts: totals[String(player.id)]?.expectedOuts || 0,
      actualOuts: totals[String(player.id)]?.actualOuts || 0,
      delta: totals[String(player.id)]?.delta || 0,
      P: totals[String(player.id)]?.P || 0,
      C: totals[String(player.id)]?.C || 0,
      IF: totals[String(player.id)]?.IF || 0,
      OF: totals[String(player.id)]?.OF || 0,
      CF: totals[String(player.id)]?.CF || 0,
    }))
    return sortRows(trackingRowsPrepare(rows), trackingSort)
  }, [players, lineupsByGame, trackingSort])

  async function loadAll() {
    setLoading(true)
    setGamesError('')

    try {
      if (!safeSupabaseReady()) {
        setGamesError('Supabase is not connected.')
        setLoading(false)
        return
      }

      const { data: playerRows, error: playerError } = await supabase
        .from('players')
        .select('id, name, jersey_number, active')
        .eq('team_id', TEAM_ID)
        .order('name', { ascending: true })

      if (playerError) throw playerError

      let workingPlayers = playerRows || []

      if (!workingPlayers.length) {
        const insertPayload = fallbackPlayers.map((p) => ({
          team_id: TEAM_ID,
          name: p.name,
          jersey_number: p.jersey_number,
          active: p.active,
        }))

        const { data: inserted, error: insertError } = await supabase
          .from('players')
          .insert(insertPayload)
          .select('id, name, jersey_number, active')

        if (insertError) throw insertError
        workingPlayers = inserted || []
      }

      setPlayers(workingPlayers)

      const { data: gamesRows, error: gamesErr } = await supabase
        .from('games')
        .select('*')
        .eq('team_id', TEAM_ID)
        .order('game_date', { ascending: true, nullsFirst: false })

      if (gamesErr) throw gamesErr

      const mappedGames = (gamesRows || []).map((row) => ({
        id: row.id,
        date: row.game_date || '',
        opponent: row.opponent || '',
        innings: row.innings || 6,
        status: row.status || 'Planned',
      }))

      setGames(mappedGames)

      const gameIds = mappedGames.map((g) => g.id)

      const { data: lineupRows, error: lineupError } = await supabase
        .from('game_lineups')
        .select('id, game_id, batting_order')
        .in('game_id', gameIds.length ? gameIds : ['00000000-0000-0000-0000-000000000000'])

      if (lineupError && gameIds.length) throw lineupError

      const lineupIds = (lineupRows || []).map((row) => row.id)

      const { data: assignmentRows, error: assignError } = await supabase
        .from('lineup_assignments')
        .select('lineup_id, inning_number, position, player_id')
        .in('lineup_id', lineupIds.length ? lineupIds : ['00000000-0000-0000-0000-000000000000'])

      if (assignError && lineupIds.length) throw assignError

      const builtLineups = {}

      ;(lineupRows || []).forEach((lineupRow) => {
        const meta = lineupRow.batting_order || {}
        const innings = Number(meta.innings || 6)
        const playerIds = workingPlayers.map((p) => p.id)

        const lineup = blankLineup(playerIds, innings)

        lineup.availablePlayerIds = (meta.availablePlayerIds || playerIds).map(String)
        lineup.battingOrder = {}
        playerIds.forEach((id) => {
          lineup.battingOrder[String(id)] = meta.order?.[String(id)] ?? ''
        })

        ;(assignmentRows || [])
          .filter((row) => row.lineup_id === lineupRow.id)
          .forEach((row) => {
            const playerId = String(row.player_id)
            if (!lineup.cells[playerId]) lineup.cells[playerId] = {}
            lineup.cells[playerId][row.inning_number] = row.position
          })

        builtLineups[String(lineupRow.game_id)] = normalizeLineup(lineup, playerIds, innings)
      })

      setLineupsByGame(builtLineups)

      const { data: targetRowsDb, error: targetErr } = await supabase
        .from('player_position_ratings')
        .select('player_id, position, target_pct')

      if (targetErr) throw targetErr

      const targetMap = {}
      ;(targetRowsDb || []).forEach((row) => {
        const playerId = String(row.player_id)
        if (!targetMap[playerId]) targetMap[playerId] = {}
        targetMap[playerId][row.position] = row.target_pct ?? ''
      })

      setTargetsByPlayer(targetMap)
      setOptimizerGameId(mappedGames[0] ? String(mappedGames[0].id) : '')
      setSelectedGameId(mappedGames[0] ? String(mappedGames[0].id) : '')
      setLoading(false)
    } catch (error) {
      setGamesError(error.message || 'Failed to load data.')
      setLoading(false)
    }
  }

  async function savePlayer(player) {
    if (!safeSupabaseReady()) return

    if (player.id) {
      const { error } = await supabase
        .from('players')
        .update({
          name: player.name,
          jersey_number: player.jersey_number,
          active: player.active,
        })
        .eq('id', player.id)

      if (error) setGamesError(error.message)
      return
    }

    const { data, error } = await supabase
      .from('players')
      .insert({
        team_id: TEAM_ID,
        name: player.name,
        jersey_number: player.jersey_number,
        active: player.active,
      })
      .select('id, name, jersey_number, active')
      .single()

    if (error) {
      setGamesError(error.message)
      return
    }

    setPlayers((current) => [...current, data])
  }

  function updatePlayerField(playerId, field, value) {
    setPlayers((current) =>
      current.map((player) =>
        String(player.id) === String(playerId) ? { ...player, [field]: value } : player
      )
    )
  }

  async function addPlayer() {
    if (!newPlayerName.trim()) return

    await savePlayer({
      name: newPlayerName.trim(),
      jersey_number: newPlayerNumber.trim(),
      active: newPlayerActive,
    })

    setNewPlayerName('')
    setNewPlayerNumber('')
    setNewPlayerActive(true)
    await loadAll()
  }

  async function addGame({ date, opponent }) {
    if (!safeSupabaseReady()) return
    const { data, error } = await supabase
      .from('games')
      .insert({
        team_id: TEAM_ID,
        game_date: date || null,
        opponent: opponent || null,
        innings: 6,
        status: 'Planned',
      })
      .select()
      .single()

    if (error) {
      setGamesError(error.message)
      return
    }

    const mapped = {
      id: data.id,
      date: data.game_date || '',
      opponent: data.opponent || '',
      innings: data.innings || 6,
      status: data.status || 'Planned',
    }

    setGames((current) => [...current, mapped])
    setOptimizerGameId(String(mapped.id))
    setSelectedGameId(String(mapped.id))
  }

  async function deleteGame(gameId) {
    if (!safeSupabaseReady()) return

    const lineupIdQuery = await supabase
      .from('game_lineups')
      .select('id')
      .eq('game_id', gameId)

    if (lineupIdQuery.error) {
      setGamesError(lineupIdQuery.error.message)
      return
    }

    const lineupIds = (lineupIdQuery.data || []).map((row) => row.id)

    if (lineupIds.length) {
      const delAssign = await supabase.from('lineup_assignments').delete().in('lineup_id', lineupIds)
      if (delAssign.error) {
        setGamesError(delAssign.error.message)
        return
      }

      const delLineups = await supabase.from('game_lineups').delete().in('id', lineupIds)
      if (delLineups.error) {
        setGamesError(delLineups.error.message)
        return
      }
    }

    const { error } = await supabase.from('games').delete().eq('id', gameId)

    if (error) {
      setGamesError(error.message)
      return
    }

    setGames((current) => current.filter((game) => String(game.id) !== String(gameId)))
    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((game) =>
        String(game.id) === String(gameId) ? { ...game, [field]: value } : game
      )
    )

    if (!safeSupabaseReady()) return

    const updates = {}
    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'innings') updates.innings = Number(value)
    if (field === 'status') updates.status = value

    const { error } = await supabase.from('games').update(updates).eq('id', gameId)
    if (error) setGamesError(error.message)
  }

  function toggleAvailablePlayer(playerId) {
    const key = String(playerId)
    setOptimizerAvailableIds((current) =>
      current.includes(key) ? current.filter((id) => id !== key) : [...current, key]
    )
  }

  function buildOrRefreshPreview() {
    const game = games.find((g) => String(g.id) === String(optimizerGameId))
    if (!game) return

    const existing = lineupsByGame[String(game.id)] || null
    const locks = locksByGame[String(game.id)] || []

    const lineup = optimizeLineup({
      players,
      availablePlayerIds: optimizerAvailableIds,
      innings: Number(game.innings || 6),
      locks,
      ytdTotals: ytdBeforeTotals,
      existingLineup: existing,
    })

    setOptimizerPreview(lineup)
  }

  function addLock() {
    if (!optimizerGameId || !lockPlayerId) return

    setLocksByGame((current) => {
      const gameLocks = current[String(optimizerGameId)] || []
      return {
        ...current,
        [String(optimizerGameId)]: [
          ...gameLocks,
          {
            id: Date.now().toString(),
            playerId: String(lockPlayerId),
            position: lockPosition,
            startInning: Number(lockStart),
            endInning: Number(lockEnd),
          },
        ],
      }
    })
  }

  function removeLock(lockId) {
    setLocksByGame((current) => {
      const gameLocks = current[String(optimizerGameId)] || []
      return {
        ...current,
        [String(optimizerGameId)]: gameLocks.filter((lock) => lock.id !== lockId),
      }
    })
  }

  function updatePreviewCell(playerId, inning, value) {
    setOptimizerPreview((current) => {
      if (!current) return current
      const next = JSON.parse(JSON.stringify(current))
      next.cells[String(playerId)][inning] = value
      return next
    })
  }

  function updatePreviewBatting(playerId, value) {
    setOptimizerPreview((current) => {
      if (!current) return current
      const next = JSON.parse(JSON.stringify(current))
      next.battingOrder[String(playerId)] = value
      return next
    })
  }

  async function saveOrOverwriteLineup(gameId, lineup) {
    if (!safeSupabaseReady() || !lineup) return

    const existing = await supabase
      .from('game_lineups')
      .select('id')
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')
      .maybeSingle()

    if (existing.error) {
      setGamesError(existing.error.message)
      return
    }

    let lineupId = existing.data?.id || null

    const meta = {
      innings: lineup.innings,
      availablePlayerIds: lineup.availablePlayerIds,
      order: lineup.battingOrder,
    }

    if (lineupId) {
      const updated = await supabase
        .from('game_lineups')
        .update({ batting_order: meta })
        .eq('id', lineupId)
        .select('id')
        .single()

      if (updated.error) {
        setGamesError(updated.error.message)
        return
      }

      const deleted = await supabase
        .from('lineup_assignments')
        .delete()
        .eq('lineup_id', lineupId)

      if (deleted.error) {
        setGamesError(deleted.error.message)
        return
      }
    } else {
      const inserted = await supabase
        .from('game_lineups')
        .insert({
          game_id: gameId,
          lineup_name: 'Main',
          batting_order: meta,
        })
        .select('id')
        .single()

      if (inserted.error) {
        setGamesError(inserted.error.message)
        return
      }

      lineupId = inserted.data.id
    }

    const playerIds = Object.keys(lineup.cells || {})
    const assignmentPayload = []

    playerIds.forEach((playerId) => {
      for (let inning = 1; inning <= lineup.innings; inning += 1) {
        const value = lineup.cells[playerId]?.[inning] || ''
        if (!value) return
        assignmentPayload.push({
          lineup_id: lineupId,
          inning_number: inning,
          position: value,
          player_id: playerId,
          source: 'manual',
          is_locked: false,
        })
      }
    })

    if (assignmentPayload.length) {
      const insertedAssignments = await supabase
        .from('lineup_assignments')
        .insert(assignmentPayload)

      if (insertedAssignments.error) {
        setGamesError(insertedAssignments.error.message)
        return
      }
    }

    setLineupsByGame((current) => ({
      ...current,
      [String(gameId)]: lineup,
    }))
  }

  function updateSavedLineupCell(gameId, playerId, inning, value) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing) return current

      const next = JSON.parse(JSON.stringify(existing))
      next.cells[String(playerId)][inning] = value
      return { ...current, [String(gameId)]: next }
    })
  }

  function updateSavedBatting(gameId, playerId, value) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing) return current

      const next = JSON.parse(JSON.stringify(existing))
      next.battingOrder[String(playerId)] = value
      return { ...current, [String(gameId)]: next }
    })
  }

  function addInningToSavedLineup(gameId) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing) return current

      const next = JSON.parse(JSON.stringify(existing))
      const newInning = next.innings + 1
      next.innings = newInning

      Object.keys(next.cells).forEach((playerId) => {
        next.cells[playerId][newInning] = ''
      })

      return { ...current, [String(gameId)]: next }
    })
  }

  function removeInningFromSavedLineup(gameId, inningToRemove) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing || existing.innings <= 1) return current

      const next = JSON.parse(JSON.stringify(existing))
      Object.keys(next.cells).forEach((playerId) => {
        const rebuilt = {}
        let newIndex = 1
        for (let inning = 1; inning <= next.innings; inning += 1) {
          if (inning === inningToRemove) continue
          rebuilt[newIndex] = next.cells[playerId][inning] || ''
          newIndex += 1
        }
        next.cells[playerId] = rebuilt
      })

      next.innings = next.innings - 1
      return { ...current, [String(gameId)]: next }
    })
  }

  function clearSavedLineup(gameId) {
    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
  }

  async function saveTargets(playerId) {
    if (!safeSupabaseReady()) return

    const playerTargets = targetsByPlayer[String(playerId)] || {}
    const payload = targetColumns
      .filter((position) => String(playerTargets[position] || '').trim() !== '')
      .map((position) => ({
        player_id: playerId,
        position,
        rank_score: 3,
        target_pct: Number(playerTargets[position]),
      }))

    await supabase.from('player_position_ratings').delete().eq('player_id', playerId)

    if (payload.length) {
      const { error } = await supabase.from('player_position_ratings').insert(payload)
      if (error) setGamesError(error.message)
    }
  }

  function updateTargetField(playerId, position, value) {
    setTargetsByPlayer((current) => ({
      ...current,
      [String(playerId)]: {
        ...(current[String(playerId)] || {}),
        [position]: value,
      },
    }))
  }

  function lineupGrid(lineup, onCellChange, onBattingChange, editable = true) {
    if (!lineup) return null

    const sortedRows = [...players].sort((a, b) => {
      const aOrder = Number(lineup.battingOrder[String(a.id)] || 999)
      const bOrder = Number(lineup.battingOrder[String(b.id)] || 999)
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })

    return (
      <div style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>Player</th>
              <th>BO</th>
              {Array.from({ length: lineup.innings }, (_, i) => i + 1).map((inning) => (
                <th key={inning}>{inning}</th>
              ))}
              <th>IF</th>
              <th>OF</th>
              <th>P</th>
              <th>C</th>
              <th>X</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((player) => {
              const playerId = String(player.id)
              const summary = gameRowSummary(lineup, playerId)
              return (
                <tr key={playerId}>
                  <td>{player.jersey_number || ''}</td>
                  <td>{player.name}</td>
                  <td>
                    {editable ? (
                      <input
                        type="number"
                        value={lineup.battingOrder[playerId] || ''}
                        onChange={(e) => onBattingChange(playerId, e.target.value)}
                        style={{ width: 58 }}
                      />
                    ) : (
                      lineup.battingOrder[playerId] || ''
                    )}
                  </td>
                  {Array.from({ length: lineup.innings }, (_, i) => i + 1).map((inning) => (
                    <td key={inning}>
                      {editable ? (
                        <select
                          value={lineup.cells[playerId]?.[inning] || ''}
                          onChange={(e) => onCellChange(playerId, inning, e.target.value)}
                        >
                          {positionOptions.map((option) => (
                            <option key={option || 'blank'} value={option}>
                              {option || '--'}
                            </option>
                          ))}
                        </select>
                      ) : (
                        lineup.cells[playerId]?.[inning] || ''
                      )}
                    </td>
                  ))}
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
    )
  }

  function renderPlayersPage() {
    return (
      <div className="stack">
        <div className="card">
          <h2>Players</h2>
          <div className="grid four-col">
            <div>
              <label>Name</label>
              <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} />
            </div>
            <div>
              <label>Number</label>
              <input value={newPlayerNumber} onChange={(e) => setNewPlayerNumber(e.target.value)} />
            </div>
            <div>
              <label>Active</label>
              <select value={newPlayerActive ? 'Yes' : 'No'} onChange={(e) => setNewPlayerActive(e.target.value === 'Yes')}>
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div className="align-end">
              <button onClick={addPlayer}>Add Player</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'name'))}>Name</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'jersey_number'))}>#</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'activeText'))}>Active</th>
                <th>Save</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.id}>
                  <td>
                    <input
                      value={player.name}
                      onChange={(e) => updatePlayerField(player.id, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      value={player.jersey_number || ''}
                      onChange={(e) => updatePlayerField(player.id, 'jersey_number', e.target.value)}
                    />
                  </td>
                  <td>
                    <select
                      value={player.active === false ? 'No' : 'Yes'}
                      onChange={(e) => updatePlayerField(player.id, 'active', e.target.value === 'Yes')}
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => savePlayer(player)}>Save</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderTargetsPage() {
    return (
      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Targets</h2>
        <table>
          <thead>
            <tr>
              <th onClick={() => setTargetSort(nextSort(targetSort, 'name'))}>Player</th>
              <th onClick={() => setTargetSort(nextSort(targetSort, 'number'))}>#</th>
              {targetColumns.map((col) => (
                <th key={col} onClick={() => setTargetSort(nextSort(targetSort, col))}>
                  {col}
                </th>
              ))}
              <th onClick={() => setTargetSort(nextSort(targetSort, 'subtotal'))}>Subtotal</th>
              <th>Save</th>
            </tr>
          </thead>
          <tbody>
            {targetRows.map((row) => (
              <tr key={row.playerId}>
                <td>{row.name}</td>
                <td>{row.number}</td>
                {targetColumns.map((col) => (
                  <td key={col}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={row[col]}
                      onChange={(e) => updateTargetField(row.playerId, col, e.target.value)}
                    />
                  </td>
                ))}
                <td>{row.subtotal}</td>
                <td>
                  <button onClick={() => saveTargets(row.playerId)}>Save</button>
                </td>
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
            <button onClick={loadAll}>Reload from Database</button>
          </div>

          {gamesError && <p style={{ color: '#b91c1c' }}>Error: {gamesError}</p>}
          {loading && <p>Loading...</p>}

          <div className="grid four-col">
            <div>
              <label>Date</label>
              <input type="date" value={newGameDate} onChange={(e) => setNewGameDate(e.target.value)} />
            </div>
            <div>
              <label>Opponent</label>
              <input value={newGameOpponent} onChange={(e) => setNewGameOpponent(e.target.value)} />
            </div>
            <div>
              <label>Info</label>
              <div className="summary-box">Innings set later</div>
            </div>
            <div className="align-end">
              <button onClick={() => addGame({ date: newGameDate, opponent: newGameOpponent })}>
                Add Game
              </button>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th onClick={() => setGameSort(nextSort(gameSort, 'date'))}>Date</th>
                <th onClick={() => setGameSort(nextSort(gameSort, 'opponent'))}>Opponent</th>
                <th onClick={() => setGameSort(nextSort(gameSort, 'innings'))}>Innings</th>
                <th onClick={() => setGameSort(nextSort(gameSort, 'status'))}>Status</th>
                <th onClick={() => setGameSort(nextSort(gameSort, 'hasLineup'))}>Lineup</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game) => (
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
                      value={game.opponent}
                      onChange={(e) => updateGameField(game.id, 'opponent', e.target.value)}
                    />
                  </td>
                  <td>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <button onClick={() => updateGameField(game.id, 'innings', Math.max(4, Number(game.innings) - 1))}>-</button>
                      <span>{game.innings}</span>
                      <button onClick={() => updateGameField(game.id, 'innings', Math.min(7, Number(game.innings) + 1))}>+</button>
                    </div>
                  </td>
                  <td>{game.status}</td>
                  <td>{game.hasLineup}</td>
                  <td>
                    <div className="button-row">
                      <button onClick={() => { setSelectedGameId(String(game.id)); setPage('game-detail') }}>
                        Open
                      </button>
                      <button onClick={() => deleteGame(game.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sortedGames.length && !loading && (
                <tr>
                  <td colSpan="6">No games yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderOptimizerPage() {
    const optimizerGame = games.find((g) => String(g.id) === String(optimizerGameId)) || null
    const gameLocks = locksByGame[String(optimizerGameId)] || []

    return (
      <div className="stack">
        <div className="card">
          <h2>Optimizer</h2>

          <div className="grid four-col">
            <div>
              <label>Existing Game</label>
              <select value={optimizerGameId} onChange={(e) => setOptimizerGameId(e.target.value)}>
                <option value="">Select game</option>
                {games.map((game) => (
                  <option key={game.id} value={String(game.id)}>
                    {(game.date || 'No Date')} vs {(game.opponent || 'Opponent')}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Or Create Date</label>
              <input type="date" value={optimizerNewDate} onChange={(e) => setOptimizerNewDate(e.target.value)} />
            </div>
            <div>
              <label>Create Opponent</label>
              <input value={optimizerNewOpponent} onChange={(e) => setOptimizerNewOpponent(e.target.value)} />
            </div>
            <div className="align-end">
              <button onClick={() => addGame({ date: optimizerNewDate, opponent: optimizerNewOpponent })}>
                Create New Game
              </button>
            </div>
          </div>
        </div>

        {optimizerGame && (
          <>
            <div className="card">
              <div className="grid four-col">
                <div>
                  <label>Date</label>
                  <input
                    type="date"
                    value={optimizerGame.date}
                    onChange={(e) => updateGameField(optimizerGame.id, 'date', e.target.value)}
                  />
                </div>
                <div>
                  <label>Opponent</label>
                  <input
                    value={optimizerGame.opponent}
                    onChange={(e) => updateGameField(optimizerGame.id, 'opponent', e.target.value)}
                  />
                </div>
                <div>
                  <label>Innings</label>
                  <select
                    value={optimizerGame.innings}
                    onChange={(e) => updateGameField(optimizerGame.id, 'innings', Number(e.target.value))}
                  >
                    {[4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Required Outs</label>
                  <div className="summary-box">
                    {requiredOutsForGame(optimizerAvailableIds.length, Number(optimizerGame.innings || 6))}
                  </div>
                </div>
              </div>

              <h3 style={{ marginTop: 16 }}>Available Players</h3>
              <div className="checkbox-grid">
                {players.map((player) => (
                  <label key={player.id} className="checkbox-item">
                    <input
                      type="checkbox"
                      checked={optimizerAvailableIds.includes(String(player.id))}
                      onChange={() => toggleAvailablePlayer(player.id)}
                    />
                    {player.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="card">
              <h3>Locks</h3>
              <div className="grid four-col">
                <div>
                  <label>Player</label>
                  <select value={lockPlayerId} onChange={(e) => setLockPlayerId(e.target.value)}>
                    <option value="">Select player</option>
                    {players.map((player) => (
                      <option key={player.id} value={String(player.id)}>
                        {player.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Position</label>
                  <select value={lockPosition} onChange={(e) => setLockPosition(e.target.value)}>
                    {['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out'].map((pos) => (
                      <option key={pos} value={pos}>
                        {pos}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>Start Inning</label>
                  <select value={lockStart} onChange={(e) => setLockStart(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label>End Inning</label>
                  <select value={lockEnd} onChange={(e) => setLockEnd(Number(e.target.value))}>
                    {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                      <option key={n} value={n}>
                        {n}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="button-row" style={{ marginTop: 12 }}>
                <button onClick={addLock}>Add Lock</button>
                <button onClick={buildOrRefreshPreview}>Optimize / Re-Optimize</button>
                <button onClick={() => saveOrOverwriteLineup(optimizerGame.id, optimizerPreview)}>
                  Save / Overwrite Lineup
                </button>
              </div>

              <div style={{ marginTop: 16, overflowX: 'auto' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th>Position</th>
                      <th>Range</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gameLocks.map((lock) => {
                      const player = players.find((p) => String(p.id) === String(lock.playerId))
                      return (
                        <tr key={lock.id}>
                          <td>{player?.name || lock.playerId}</td>
                          <td>{lock.position}</td>
                          <td>{lock.startInning}-{lock.endInning}</td>
                          <td>
                            <button onClick={() => removeLock(lock.id)}>Remove</button>
                          </td>
                        </tr>
                      )
                    })}
                    {!gameLocks.length && (
                      <tr>
                        <td colSpan="4">No locks yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {optimizerPreview && (
              <div className="card">
                <h3>Optimizer Grid</h3>
                {lineupGrid(optimizerPreview, updatePreviewCell, updatePreviewBatting, true)}
              </div>
            )}

            {renderSummaryCard('YTD Before', ytdBeforeTotals, trackingSort, setTrackingSort)}
            {renderSummaryCard('Current Plan', currentPlanTotals, trackingSort, setTrackingSort)}
            {renderSummaryCard('YTD After', ytdAfterTotals, trackingSort, setTrackingSort)}
          </>
        )}
      </div>
    )
  }

  function renderSummaryCard(title, totals, sortConfig, setSortConfig) {
    const rows = players.map((player) => ({
      playerId: String(player.id),
      name: player.name,
      jersey_number: player.jersey_number || '',
      fieldTotal: totals[String(player.id)]?.fieldTotal || 0,
      Out: totals[String(player.id)]?.Out || 0,
      expectedOuts: totals[String(player.id)]?.expectedOuts || 0,
      actualOuts: totals[String(player.id)]?.actualOuts || 0,
      delta: totals[String(player.id)]?.delta || 0,
      P: totals[String(player.id)]?.P || 0,
      C: totals[String(player.id)]?.C || 0,
      IF: totals[String(player.id)]?.IF || 0,
      OF: totals[String(player.id)]?.OF || 0,
      CF: totals[String(player.id)]?.CF || 0,
    }))

    const sorted = sortRows(rows, sortConfig)

    return (
      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>{title}</h3>
        <table>
          <thead>
            <tr>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'name'))}>Player</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'fieldTotal'))}>Fld</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'Out'))}>Out</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'expectedOuts'))}>Exp X</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'actualOuts'))}>Act X</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'delta'))}>Delta</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'P'))}>P</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'C'))}>C</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'IF'))}>IF</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'OF'))}>OF</th>
              <th onClick={() => setSortConfig(nextSort(sortConfig, 'CF'))}>CF</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr key={`${title}-${row.playerId}`}>
                <td>{row.name}</td>
                <td>{row.fieldTotal}</td>
                <td>{row.Out}</td>
                <td>{row.expectedOuts}</td>
                <td>{row.actualOuts}</td>
                <td>{row.delta}</td>
                <td>{row.P}</td>
                <td>{row.C}</td>
                <td>{row.IF}</td>
                <td>{row.OF}</td>
                <td>{row.CF}</td>
              </tr>
            ))}
          </tbody>
        </table>
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

    if (!selectedGameLineup) {
      return (
        <div className="card">
          <div className="row-between">
            <div>
              <h2>{selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}</h2>
              <p>Use Optimizer to create a lineup, then save it here.</p>
            </div>
            <button onClick={() => setPage('games')}>Back to Games</button>
          </div>
        </div>
      )
    }

    return (
      <div className="stack">
        <div className="card">
          <div className="row-between">
            <div>
              <h2>{selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}</h2>
              <p>By player, innings across. Batting order on the left.</p>
            </div>
            <div className="button-row">
              <button onClick={() => addInningToSavedLineup(selectedGame.id)}>Add Inning</button>
              <button onClick={() => saveOrOverwriteLineup(selectedGame.id, lineupsByGame[String(selectedGame.id)])}>
                Save Changes
              </button>
              <button onClick={() => clearSavedLineup(selectedGame.id)}>Clear Lineup</button>
              <button onClick={() => window.print()}>Print</button>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            {Array.from({ length: selectedGameLineup.innings }, (_, i) => i + 1).map((inning) => (
              <button key={inning} onClick={() => removeInningFromSavedLineup(selectedGame.id, inning)}>
                Remove {inning}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          {lineupGrid(
            selectedGameLineup,
            (playerId, inning, value) => updateSavedLineupCell(selectedGame.id, playerId, inning, value),
            (playerId, value) => updateSavedBatting(selectedGame.id, playerId, value),
            true
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <h1>Thunder Lineup Tool</h1>
        <div className="nav-stack">
          {renderNavButton(page, setPage, 'players', 'Players')}
          {renderNavButton(page, setPage, 'targets', 'Targets')}
          {renderNavButton(page, setPage, 'games', 'Games')}
          {renderNavButton(page, setPage, 'optimizer', 'Optimizer')}
          {renderNavButton(page, setPage, 'game-detail', 'Game Detail')}
          {renderNavButton(page, setPage, 'tracking', 'Tracking')}
        </div>
      </aside>

      <main className="main-content">
        {page === 'players' && renderPlayersPage()}
        {page === 'targets' && renderTargetsPage()}
        {page === 'games' && renderGamesPage()}
        {page === 'optimizer' && renderOptimizerPage()}
        {page === 'game-detail' && renderGameDetailPage()}
        {page === 'tracking' && renderSummaryCard('Tracking', computeLineupTotals(Object.values(lineupsByGame), players), trackingSort, setTrackingSort)}
      </main>
    </div>
  )
}

function renderNavButton(currentPage, setPage, key, label) {
  return (
    <button
      className={currentPage === key ? 'nav-button active' : 'nav-button'}
      onClick={() => setPage(key)}
    >
      {label}
    </button>
  )
}

function targetRowsPrepare(rows) {
  return rows.map((row) => ({
    ...row,
    subtotal: Number(row.subtotal || 0),
  }))
}

function trackingRowsPrepare(rows) {
  return rows.map((row) => ({
    ...row,
    delta: Number(row.delta || 0),
    expectedOuts: Number(row.expectedOuts || 0),
    actualOuts: Number(row.actualOuts || 0),
    fieldTotal: Number(row.fieldTotal || 0),
    Out: Number(row.Out || 0),
    P: Number(row.P || 0),
    C: Number(row.C || 0),
    IF: Number(row.IF || 0),
    OF: Number(row.OF || 0),
    CF: Number(row.CF || 0),
  }))
}
