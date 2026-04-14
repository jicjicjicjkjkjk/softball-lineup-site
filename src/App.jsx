import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const TEAM_ID = 'f76ea5a1-7c44-4789-bfbd-9771edd54f10'

const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
const GRID_OPTIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out', 'Injury']

const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']
const ALLOWED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

const DEFAULT_PLAYERS = [
  { name: 'Alanna', jersey_number: '25', active: true },
  { name: 'Maggie', jersey_number: '00', active: true },
  { name: 'Brooke', jersey_number: '13', active: true },
  { name: 'Emily', jersey_number: '4', active: true },
  { name: 'Josie', jersey_number: '7', active: true },
  { name: 'Lucie', jersey_number: '22', active: true },
  { name: 'Delaney', jersey_number: '9', active: true },
  { name: 'Bella', jersey_number: '12', active: true },
  { name: 'Bridget', jersey_number: '28', active: true },
  { name: 'Elena', jersey_number: '10', active: true },
  { name: 'Lilly', jersey_number: '14', active: true },
  { name: 'Molly', jersey_number: '15', active: true },
  { name: 'Sub 1', jersey_number: 'S1', active: false },
  { name: 'Sub 2', jersey_number: 'S2', active: false },
  { name: 'Sub 3', jersey_number: 'S3', active: false },
]

const DEFAULT_DEPTH = {
  P: ['Emily', 'Josie', 'Molly'],
  C: ['Lucie', 'Bella', 'Molly'],
  '1B': ['Alanna', 'Brooke', 'Molly'],
  '2B': ['Bridget', 'Delaney', 'Emily'],
  '3B': ['Bella', 'Lucie', 'Maggie'],
  SS: ['Elena', 'Maggie', 'Lilly'],
  LF: ['Lilly', 'Emily', 'Bella'],
  CF: ['Brooke', 'Bella', 'Lilly'],
  RF: ['Molly', 'Alanna', 'Bridget'],
}

function pk(id) {
  return String(id)
}

function sortRows(rows, sort) {
  if (!sort?.key) return rows
  const dir = sort.direction === 'desc' ? -1 : 1

  return [...rows].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    const an = Number(av)
    const bn = Number(bv)
    const aNum = !Number.isNaN(an) && String(av ?? '').trim() !== ''
    const bNum = !Number.isNaN(bn) && String(bv ?? '').trim() !== ''

    if (aNum && bNum) return (an - bn) * dir
    return String(av ?? '').localeCompare(String(bv ?? '')) * dir
  })
}

function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function blankLineup(playerIds, innings = 6, availablePlayerIds = playerIds) {
  const cells = {}
  const battingOrder = {}
  const lockedCells = {}
  const lockedRows = {}

  playerIds.forEach((id) => {
    const idKey = pk(id)
    cells[idKey] = {}
    battingOrder[idKey] = ''
    lockedCells[idKey] = {}
    lockedRows[idKey] = false
    for (let inning = 1; inning <= innings; inning += 1) {
      cells[idKey][inning] = ''
      lockedCells[idKey][inning] = false
    }
  })

  return {
    innings,
    availablePlayerIds: availablePlayerIds.map(pk),
    battingOrder,
    cells,
    lockedCells,
    lockedRows,
  }
}

function normalizeLineup(lineup, players, inningsFallback = 6, availableFallback = []) {
  const playerIds = players.map((p) => p.id)
  const out = lineup
    ? JSON.parse(JSON.stringify(lineup))
    : blankLineup(playerIds, inningsFallback, availableFallback.length ? availableFallback : playerIds)

  out.innings = Number(out.innings || inningsFallback)
  out.availablePlayerIds = (out.availablePlayerIds || availableFallback || playerIds).map(pk)
  out.cells = out.cells || {}
  out.battingOrder = out.battingOrder || {}
  out.lockedCells = out.lockedCells || {}
  out.lockedRows = out.lockedRows || {}

  playerIds.forEach((id) => {
    const idKey = pk(id)
    if (!out.cells[idKey]) out.cells[idKey] = {}
    if (!out.lockedCells[idKey]) out.lockedCells[idKey] = {}
    if (out.battingOrder[idKey] === undefined) out.battingOrder[idKey] = ''
    if (out.lockedRows[idKey] === undefined) out.lockedRows[idKey] = false
    for (let inning = 1; inning <= out.innings; inning += 1) {
      if (out.cells[idKey][inning] === undefined) out.cells[idKey][inning] = ''
      if (out.lockedCells[idKey][inning] === undefined) out.lockedCells[idKey][inning] = false
    }
  })

  return out
}

function rowSummary(lineup, playerId) {
  const result = { IF: 0, OF: 0, P: 0, C: 0, X: 0 }
  const row = lineup?.cells?.[playerId] || {}

  Object.values(row).forEach((value) => {
    if (['1B', '2B', '3B', 'SS'].includes(value)) result.IF += 1
    if (['LF', 'CF', 'RF'].includes(value)) result.OF += 1
    if (value === 'P') result.P += 1
    if (value === 'C') result.C += 1
    if (value === 'Out') result.X += 1
  })

  return result
}

function computeTotals(lineups, players) {
  const totals = {}

  players.forEach((player) => {
    totals[pk(player.id)] = {
      playerId: pk(player.id),
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
    const availableIds = (lineup.availablePlayerIds || []).map(pk)

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      const eligible = availableIds.filter((playerId) => {
        const value = lineup.cells?.[playerId]?.[inning] || ''
        return value !== 'Injury'
      })

      const expected = eligible.length ? Math.max(0, eligible.length - 9) / eligible.length : 0

      availableIds.forEach((playerId) => {
        const value = lineup.cells?.[playerId]?.[inning] || ''
        const row = totals[playerId]
        if (!row) return

        if (value === 'Injury') {
          row.Injury += 1
          return
        }

        if (eligible.includes(playerId)) row.expectedOuts += expected
        if (value === 'Out') {
          row.Out += 1
          row.actualOuts += 1
        }

        if (FIELD_POSITIONS.includes(value)) {
          row[value] += 1
          row.fieldTotal += 1
        }

        if (['1B', '2B', '3B', 'SS'].includes(value)) row.IF += 1
        if (['LF', 'CF', 'RF'].includes(value)) row.OF += 1
      })
    }
  })

  Object.values(totals).forEach((row) => {
    row.expectedOuts = Number(row.expectedOuts.toFixed(2))
    row.delta = Number((row.actualOuts - row.expectedOuts).toFixed(2))
  })

  return totals
}

function addTotals(a, b, players) {
  const merged = {}
  players.forEach((player) => {
    const id = pk(player.id)
    merged[id] = {
      playerId: id,
      name: player.name,
      jersey_number: player.jersey_number || '',
      P: (a[id]?.P || 0) + (b[id]?.P || 0),
      C: (a[id]?.C || 0) + (b[id]?.C || 0),
      '1B': (a[id]?.['1B'] || 0) + (b[id]?.['1B'] || 0),
      '2B': (a[id]?.['2B'] || 0) + (b[id]?.['2B'] || 0),
      '3B': (a[id]?.['3B'] || 0) + (b[id]?.['3B'] || 0),
      SS: (a[id]?.SS || 0) + (b[id]?.SS || 0),
      LF: (a[id]?.LF || 0) + (b[id]?.LF || 0),
      CF: (a[id]?.CF || 0) + (b[id]?.CF || 0),
      RF: (a[id]?.RF || 0) + (b[id]?.RF || 0),
      IF: (a[id]?.IF || 0) + (b[id]?.IF || 0),
      OF: (a[id]?.OF || 0) + (b[id]?.OF || 0),
      Out: (a[id]?.Out || 0) + (b[id]?.Out || 0),
      Injury: (a[id]?.Injury || 0) + (b[id]?.Injury || 0),
      fieldTotal: (a[id]?.fieldTotal || 0) + (b[id]?.fieldTotal || 0),
      expectedOuts: Number(((a[id]?.expectedOuts || 0) + (b[id]?.expectedOuts || 0)).toFixed(2)),
      actualOuts: (a[id]?.actualOuts || 0) + (b[id]?.actualOuts || 0),
      delta: Number(((a[id]?.delta || 0) + (b[id]?.delta || 0)).toFixed(2)),
    }
  })
  return merged
}

function priorityValue(priorityMap, playerId, position) {
  const id = pk(playerId)
  if (['LF', 'CF', 'RF'].includes(position)) {
    return Number(priorityMap[id]?.OF?.priority_pct || 0)
  }
  return Number(priorityMap[id]?.[position]?.priority_pct || 0)
}

function fitTier(fitMap, playerId, position) {
  const id = pk(playerId)
  return fitMap[id]?.[position] || 'secondary'
}

function fitRank(tier) {
  if (tier === 'primary') return 0
  if (tier === 'secondary') return 1
  return 2
}

function depthScore(name, position) {
  const list = DEFAULT_DEPTH[position] || []
  const idx = list.indexOf(name)
  return idx === -1 ? 999 : idx
}

function positionCountsForInning(lineup, inning, availableIds) {
  const counts = {}
  FIELD_POSITIONS.forEach((pos) => {
    counts[pos] = []
  })

  availableIds.forEach((id) => {
    const value = lineup.cells?.[id]?.[inning] || ''
    if (FIELD_POSITIONS.includes(value)) counts[value].push(id)
  })

  return counts
}

function inningStatus(lineup, inning, players, fitMap) {
  const availableIds = (lineup.availablePlayerIds || []).map(pk)
  const counts = positionCountsForInning(lineup, inning, availableIds)

  const missing = FIELD_POSITIONS.filter((pos) => counts[pos].length === 0)
  const duplicate = FIELD_POSITIONS.filter((pos) => counts[pos].length > 1)

  const badFits = []
  availableIds.forEach((id) => {
    const value = lineup.cells?.[id]?.[inning] || ''
    if (!FIELD_POSITIONS.includes(value)) return
    if (fitTier(fitMap, id, value) === 'no') {
      const player = players.find((p) => pk(p.id) === id)
      badFits.push(`${player?.name || id} @ ${value}`)
    }
  })

  return { missing, duplicate, badFits }
}

function lastOutDistance(lineup, playerId, inning) {
  let distance = 999
  for (let prev = inning - 1; prev >= 1; prev -= 1) {
    const value = lineup.cells?.[playerId]?.[prev] || ''
    if (value === 'Out') {
      distance = inning - prev
      break
    }
  }
  return distance
}

function optimizeGame({
  game,
  players,
  availablePlayerIds,
  sourceLineup,
  totalsBefore,
  priorityMap,
  fitMap,
}) {
  const lineup = normalizeLineup(
    sourceLineup,
    players,
    Number(game.innings || 6),
    availablePlayerIds
  )

  lineup.innings = Number(game.innings || 6)
  lineup.availablePlayerIds = availablePlayerIds.map(pk)

  const rollingTotals = JSON.parse(JSON.stringify(totalsBefore))

  players.forEach((player) => {
    const id = pk(player.id)
    for (let inning = 1; inning <= lineup.innings; inning += 1) {
      const rowLocked = lineup.lockedRows?.[id] || false
      const cellLocked = lineup.lockedCells?.[id]?.[inning] || false
      if (!rowLocked && !cellLocked) {
        lineup.cells[id][inning] = ''
      }
    }
  })

  for (let inning = 1; inning <= lineup.innings; inning += 1) {
    const usedPlayers = new Set()

    players.forEach((player) => {
      const id = pk(player.id)
      const value = lineup.cells?.[id]?.[inning] || ''
      const locked = lineup.lockedRows?.[id] || lineup.lockedCells?.[id]?.[inning] || false
      if (locked && value) usedPlayers.add(id)
    })

    FIELD_POSITIONS.forEach((position) => {
      const alreadyAssigned = players.some((player) => {
        const id = pk(player.id)
        return (lineup.cells?.[id]?.[inning] || '') === position
      })
      if (alreadyAssigned) return

      const candidates = players
        .filter((player) => availablePlayerIds.includes(pk(player.id)))
        .filter((player) => !usedPlayers.has(pk(player.id)))
        .filter((player) => fitTier(fitMap, player.id, position) !== 'no')
        .sort((a, b) => {
          const aId = pk(a.id)
          const bId = pk(b.id)

          const fitDiff = fitRank(fitTier(fitMap, a.id, position)) - fitRank(fitTier(fitMap, b.id, position))
          if (fitDiff !== 0) return fitDiff

          const aTarget = priorityValue(priorityMap, a.id, position)
          const bTarget = priorityValue(priorityMap, b.id, position)

          const aActualCount =
            ['LF', 'CF', 'RF'].includes(position)
              ? (rollingTotals[aId]?.OF || 0)
              : (rollingTotals[aId]?.[position] || 0)
          const bActualCount =
            ['LF', 'CF', 'RF'].includes(position)
              ? (rollingTotals[bId]?.OF || 0)
              : (rollingTotals[bId]?.[position] || 0)

          const aField = Math.max(rollingTotals[aId]?.fieldTotal || 0, 1)
          const bField = Math.max(rollingTotals[bId]?.fieldTotal || 0, 1)

          const aActualPct = (aActualCount / aField) * 100
          const bActualPct = (bActualCount / bField) * 100

          const aGap = aTarget - aActualPct
          const bGap = bTarget - bActualPct
          if (aGap !== bGap) return bGap - aGap

          const aDelta = rollingTotals[aId]?.delta || 0
          const bDelta = rollingTotals[bId]?.delta || 0
          if (aDelta !== bDelta) return bDelta - aDelta

          const aDepth = depthScore(a.name, position)
          const bDepth = depthScore(b.name, position)
          if (aDepth !== bDepth) return aDepth - bDepth

          return String(a.name || '').localeCompare(String(b.name || ''))
        })

      const selected = candidates[0]
      if (!selected) return

      lineup.cells[pk(selected.id)][inning] = position
      usedPlayers.add(pk(selected.id))
    })

    players
      .filter((player) => availablePlayerIds.includes(pk(player.id)))
      .filter((player) => !usedPlayers.has(pk(player.id)))
      .sort((a, b) => {
        const aId = pk(a.id)
        const bId = pk(b.id)

        const aDelta = rollingTotals[aId]?.delta || 0
        const bDelta = rollingTotals[bId]?.delta || 0
        if (aDelta !== bDelta) return aDelta - bDelta

        const aDistance = lastOutDistance(lineup, aId, inning)
        const bDistance = lastOutDistance(lineup, bId, inning)

        const aPenalty =
          aDistance === 1 ? 10000 :
          aDistance === 2 ? 3000 :
          aDistance === 3 ? 500 : 0

        const bPenalty =
          bDistance === 1 ? 10000 :
          bDistance === 2 ? 3000 :
          bDistance === 3 ? 500 : 0

        if (aPenalty !== bPenalty) return aPenalty - bPenalty

        return (rollingTotals[aId]?.Out || 0) - (rollingTotals[bId]?.Out || 0)
      })
      .forEach((player) => {
        lineup.cells[pk(player.id)][inning] = 'Out'
      })

    const inningTotals = computeTotals(
      [
        {
          innings: 1,
          availablePlayerIds,
          cells: Object.fromEntries(
            players.map((player) => [pk(player.id), { 1: lineup.cells[pk(player.id)][inning] || '' }])
          ),
        },
      ],
      players
    )

    Object.keys(rollingTotals).forEach((id) => {
      const current = rollingTotals[id]
      const add = inningTotals[id]
      if (!current || !add) return

      current.P += add.P
      current.C += add.C
      current['1B'] += add['1B']
      current['2B'] += add['2B']
      current['3B'] += add['3B']
      current.SS += add.SS
      current.LF += add.LF
      current.CF += add.CF
      current.RF += add.RF
      current.IF += add.IF
      current.OF += add.OF
      current.Out += add.Out
      current.Injury += add.Injury
      current.fieldTotal += add.fieldTotal
      current.expectedOuts += add.expectedOuts
      current.actualOuts += add.actualOuts
      current.delta = Number((current.actualOuts - current.expectedOuts).toFixed(2))
    })
  }

  return lineup
}

export default function App() {
  const [page, setPage] = useState('games')

  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [lineupsByGame, setLineupsByGame] = useState({})
  const [lineupLockedByGame, setLineupLockedByGame] = useState({})
  const [priorityByPlayer, setPriorityByPlayer] = useState({})
  const [fitByPlayer, setFitByPlayer] = useState({})

  const [loading, setLoading] = useState(true)
  const [appError, setAppError] = useState('')

  const [selectedGameId, setSelectedGameId] = useState('')
  const [optimizerExistingGameId, setOptimizerExistingGameId] = useState('')
  const [optimizerFocusGameId, setOptimizerFocusGameId] = useState('')
  const [optimizerBatchGameIds, setOptimizerBatchGameIds] = useState([])
  const [optimizerPreviewByGame, setOptimizerPreviewByGame] = useState({})

  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [optimizerNewDate, setOptimizerNewDate] = useState('')
  const [optimizerNewOpponent, setOptimizerNewOpponent] = useState('')

  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerNumber, setNewPlayerNumber] = useState('')
  const [newPlayerActive, setNewPlayerActive] = useState(true)

  const [playerSort, setPlayerSort] = useState({ key: 'name', direction: 'asc' })
  const [gameSort, setGameSort] = useState({ key: 'date', direction: 'asc' })
  const [prioritySort, setPrioritySort] = useState({ key: 'name', direction: 'asc' })
  const [trackingSort, setTrackingSort] = useState({ key: 'name', direction: 'asc' })

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setAppError('')

    try {
      if (!dbReady()) throw new Error('Supabase is not connected.')

      let playersRes = await supabase
        .from('players')
        .select('id, name, jersey_number, active')
        .eq('team_id', TEAM_ID)
        .order('name', { ascending: true })

      if (playersRes.error) throw playersRes.error

      if (!playersRes.data?.length) {
        const seeded = await supabase
          .from('players')
          .insert(
            DEFAULT_PLAYERS.map((row) => ({
              team_id: TEAM_ID,
              name: row.name,
              jersey_number: row.jersey_number,
              active: row.active,
            }))
          )
          .select('id, name, jersey_number, active')

        if (seeded.error) throw seeded.error
        playersRes = seeded
      }

      const loadedPlayers = playersRes.data || []
      setPlayers(loadedPlayers)

      const gamesRes = await supabase
        .from('games')
        .select('id, game_date, opponent, innings, status')
        .eq('team_id', TEAM_ID)
        .order('game_date', { ascending: true, nullsFirst: false })

      if (gamesRes.error) throw gamesRes.error

      const loadedGames = (gamesRes.data || []).map((row) => ({
        id: row.id,
        date: row.game_date || '',
        opponent: row.opponent || '',
        innings: Number(row.innings || 6),
        status: row.status || 'Planned',
      }))
      setGames(loadedGames)

      const lineupRes = await supabase
        .from('game_lineups')
        .select('game_id, lineup_data, optimizer_meta, lineup_locked')
        .eq('lineup_name', 'Main')

      if (lineupRes.error) throw lineupRes.error

      const loadedLineups = {}
      const loadedLocked = {}
      ;(lineupRes.data || []).forEach((row) => {
        loadedLineups[String(row.game_id)] = normalizeLineup(
          row.lineup_data || {},
          loadedPlayers,
          Number(row.optimizer_meta?.innings || 6),
          row.optimizer_meta?.availablePlayerIds || loadedPlayers.filter((p) => p.active !== false).map((p) => p.id)
        )
        loadedLocked[String(row.game_id)] = row.lineup_locked === true
      })
      setLineupsByGame(loadedLineups)
      setLineupLockedByGame(loadedLocked)

      const prefRes = await supabase
        .from('player_position_preferences')
        .select('player_id, position, priority_pct, fit_tier, is_allowed')

      if (prefRes.error) throw prefRes.error

      const priorityMap = {}
      const fitMap = {}

      ;(prefRes.data || []).forEach((row) => {
        const playerId = String(row.player_id)
        if (!priorityMap[playerId]) priorityMap[playerId] = {}
        if (!fitMap[playerId]) fitMap[playerId] = {}

        if (PRIORITY_POSITIONS.includes(row.position)) {
          priorityMap[playerId][row.position] = {
            priority_pct: row.priority_pct ?? '',
          }
        }

        if (ALLOWED_POSITIONS.includes(row.position)) {
          fitMap[playerId][row.position] = row.fit_tier || 'secondary'
        }
      })

      setPriorityByPlayer(priorityMap)
      setFitByPlayer(fitMap)

      if (loadedGames[0]) {
        setSelectedGameId(String(loadedGames[0].id))
        setOptimizerExistingGameId(String(loadedGames[0].id))
      }

      setLoading(false)
    } catch (error) {
      setAppError(error.message || 'Failed to load data.')
      setLoading(false)
    }
  }

  const activePlayers = useMemo(() => players.filter((p) => p.active !== false), [players])

  const sortedPlayers = useMemo(() => {
    return sortRows(
      players.map((player) => ({
        ...player,
        activeText: player.active === false ? 'No' : 'Yes',
      })),
      playerSort
    )
  }, [players, playerSort])

  const sortedGames = useMemo(() => {
    return sortRows(
      games.map((game) => ({
        ...game,
        lineupState: lineupLockedByGame[String(game.id)] ? 'Locked' : lineupsByGame[String(game.id)] ? 'Saved' : 'Empty',
      })),
      gameSort
    )
  }, [games, lineupsByGame, lineupLockedByGame, gameSort])

  const activePriorityRows = useMemo(() => {
    return sortRows(
      activePlayers.map((player) => {
        const pr = priorityByPlayer[String(player.id)] || {}
        return {
          playerId: String(player.id),
          name: player.name,
          jersey_number: player.jersey_number || '',
          P: pr.P?.priority_pct || '',
          C: pr.C?.priority_pct || '',
          '1B': pr['1B']?.priority_pct || '',
          '2B': pr['2B']?.priority_pct || '',
          '3B': pr['3B']?.priority_pct || '',
          SS: pr.SS?.priority_pct || '',
          OF: pr.OF?.priority_pct || '',
          subtotal:
            Number(pr.P?.priority_pct || 0) +
            Number(pr.C?.priority_pct || 0) +
            Number(pr['1B']?.priority_pct || 0) +
            Number(pr['2B']?.priority_pct || 0) +
            Number(pr['3B']?.priority_pct || 0) +
            Number(pr.SS?.priority_pct || 0) +
            Number(pr.OF?.priority_pct || 0),
        }
      }),
      prioritySort
    )
  }, [activePlayers, priorityByPlayer, prioritySort])

  const priorityFooter = useMemo(() => {
    const footer = {}
    PRIORITY_POSITIONS.forEach((pos) => {
      footer[pos] = activePriorityRows.reduce((sum, row) => sum + Number(row[pos] || 0), 0)
    })
    footer.subtotal = PRIORITY_POSITIONS.reduce((sum, pos) => sum + footer[pos], 0)
    return footer
  }, [activePriorityRows])

  const selectedGame = games.find((game) => String(game.id) === String(selectedGameId)) || null
  const selectedLineup = selectedGame ? lineupsByGame[String(selectedGame.id)] || null : null
  const selectedLocked = selectedGame ? lineupLockedByGame[String(selectedGame.id)] === true : false

  const optimizerBatchGames = games.filter((game) => optimizerBatchGameIds.includes(String(game.id)))
  const optimizerFocusGame = games.find((game) => String(game.id) === String(optimizerFocusGameId)) || null
  const optimizerFocusLineup = optimizerPreviewByGame[String(optimizerFocusGameId)] || null

  const ytdBeforeTotals = useMemo(() => {
    const lineups = Object.entries(lineupsByGame)
      .filter(([gameId]) => !optimizerBatchGameIds.includes(String(gameId)))
      .map(([, lineup]) => lineup)
    return computeTotals(lineups, players)
  }, [lineupsByGame, optimizerBatchGameIds, players])

  const currentBatchTotals = useMemo(() => {
    return computeTotals(Object.values(optimizerPreviewByGame), players)
  }, [optimizerPreviewByGame, players])

  const ytdAfterTotals = useMemo(() => {
    return addTotals(ytdBeforeTotals, currentBatchTotals, players)
  }, [ytdBeforeTotals, currentBatchTotals, players])

  function activePlayerIds() {
    return activePlayers.map((player) => String(player.id))
  }

  async function addGame(date, opponent) {
    const res = await supabase
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

    if (res.error) {
      setAppError(res.error.message)
      return null
    }

    const game = {
      id: res.data.id,
      date: res.data.game_date || '',
      opponent: res.data.opponent || '',
      innings: Number(res.data.innings || 6),
      status: res.data.status || 'Planned',
    }

    setGames((current) => [...current, game])
    return game
  }

  async function addGameFromGames() {
    const game = await addGame(newGameDate, newGameOpponent)
    if (game) {
      setNewGameDate('')
      setNewGameOpponent('')
      setSelectedGameId(String(game.id))
    }
  }

  async function addGameFromOptimizer() {
    const game = await addGame(optimizerNewDate, optimizerNewOpponent)
    if (game) {
      setOptimizerNewDate('')
      setOptimizerNewOpponent('')
      setOptimizerBatchGameIds((current) => [...new Set([...current, String(game.id)])])
      setOptimizerFocusGameId(String(game.id))
      setOptimizerExistingGameId(String(game.id))
    }
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((game) =>
        String(game.id) === String(gameId) ? { ...game, [field]: value } : game
      )
    )

    const updates = {}
    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'innings') updates.innings = Number(value)
    if (field === 'status') updates.status = value

    const res = await supabase.from('games').update(updates).eq('id', gameId)
    if (res.error) setAppError(res.error.message)
  }

  async function deleteGame(gameId) {
    if (lineupLockedByGame[String(gameId)]) {
      setAppError('Unlock the lineup before deleting the game.')
      return
    }

    const confirmed = window.confirm('Are you sure you want to delete this game?')
    if (!confirmed) return

    const deleteLineup = await supabase.from('game_lineups').delete().eq('game_id', gameId)
    if (deleteLineup.error) {
      setAppError(deleteLineup.error.message)
      return
    }

    const deleteGameRow = await supabase.from('games').delete().eq('id', gameId)
    if (deleteGameRow.error) {
      setAppError(deleteGameRow.error.message)
      return
    }

    setGames((current) => current.filter((game) => String(game.id) !== String(gameId)))
    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
    setLineupLockedByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
    setOptimizerBatchGameIds((current) => current.filter((id) => String(id) !== String(gameId)))
  }

  async function upsertPlayer(player) {
    if (!player.name?.trim()) return

    if (player.id) {
      const updateRes = await supabase
        .from('players')
        .update({
          name: player.name,
          jersey_number: player.jersey_number,
          active: player.active,
        })
        .eq('id', player.id)

      if (updateRes.error) setAppError(updateRes.error.message)
      return
    }

    const insertRes = await supabase
      .from('players')
      .insert({
        team_id: TEAM_ID,
        name: player.name,
        jersey_number: player.jersey_number,
        active: player.active,
      })
      .select('id, name, jersey_number, active')
      .single()

    if (insertRes.error) {
      setAppError(insertRes.error.message)
      return
    }

    setPlayers((current) => [...current, insertRes.data])
  }

  function updatePlayerLocal(playerId, field, value) {
    setPlayers((current) =>
      current.map((player) =>
        String(player.id) === String(playerId) ? { ...player, [field]: value } : player
      )
    )
  }

  async function addPlayer() {
    await upsertPlayer({
      name: newPlayerName,
      jersey_number: newPlayerNumber,
      active: newPlayerActive,
    })
    setNewPlayerName('')
    setNewPlayerNumber('')
    setNewPlayerActive(true)
    await loadAll()
  }

  async function deletePlayer(playerId) {
    const confirmed = window.confirm('Delete this player? Their saved preferences remain in the database only if you keep the row inactive instead.')
    if (!confirmed) return

    const del = await supabase.from('players').delete().eq('id', playerId)
    if (del.error) {
      setAppError(del.error.message)
      return
    }

    setPlayers((current) => current.filter((player) => String(player.id) !== String(playerId)))
  }

  async function persistPriority(playerId, position, value) {
    const cleaned = String(value ?? '').trim()

    if (!cleaned) {
      const del = await supabase
        .from('player_position_preferences')
        .delete()
        .eq('player_id', playerId)
        .eq('position', position)

      if (del.error) setAppError(del.error.message)
      return
    }

    const up = await supabase
      .from('player_position_preferences')
      .upsert(
        {
          player_id: playerId,
          position,
          priority_pct: Number(cleaned),
          fit_tier: null,
          is_allowed: true,
        },
        { onConflict: 'player_id,position' }
      )

    if (up.error) setAppError(up.error.message)
  }

  async function persistFitTier(playerId, position, tier) {
    const up = await supabase
      .from('player_position_preferences')
      .upsert(
        {
          player_id: playerId,
          position,
          priority_pct: null,
          fit_tier: tier,
          is_allowed: tier !== 'no',
        },
        { onConflict: 'player_id,position' }
      )

    if (up.error) setAppError(up.error.message)
  }

  function updatePriorityLocal(playerId, position, value) {
    setPriorityByPlayer((current) => ({
      ...current,
      [String(playerId)]: {
        ...(current[String(playerId)] || {}),
        [position]: { priority_pct: value },
      },
    }))
  }

  function updateFitLocal(playerId, position, tier) {
    setFitByPlayer((current) => ({
      ...current,
      [String(playerId)]: {
        ...(current[String(playerId)] || {}),
        [position]: tier,
      },
    }))
  }

  function addExistingGameToBatch() {
    if (!optimizerExistingGameId) return
    setOptimizerBatchGameIds((current) => [...new Set([...current, String(optimizerExistingGameId)])])
    setOptimizerFocusGameId(String(optimizerExistingGameId))
  }

  function removeBatchGame(gameId) {
    setOptimizerBatchGameIds((current) => current.filter((id) => String(id) !== String(gameId)))
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
  }

  function buildBatch() {
    let rollingTotals = JSON.parse(JSON.stringify(ytdBeforeTotals))
    const next = {}

    const orderedGames = [...optimizerBatchGames].sort((a, b) => {
      const aKey = `${a.date || ''}-${a.id}`
      const bKey = `${b.date || ''}-${b.id}`
      return aKey.localeCompare(bKey)
    })

    orderedGames.forEach((game) => {
      const saved = optimizerPreviewByGame[String(game.id)] ||
        lineupsByGame[String(game.id)] ||
        blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

      const availableIds = (saved.availablePlayerIds || activePlayerIds()).map(String)

      const optimized = optimizeGame({
        game,
        players,
        availablePlayerIds: availableIds,
        sourceLineup: saved,
        totalsBefore: rollingTotals,
        priorityMap: priorityByPlayer,
        fitMap: fitByPlayer,
      })

      next[String(game.id)] = optimized
      rollingTotals = addTotals(rollingTotals, computeTotals([optimized], players), players)
    })

    setOptimizerPreviewByGame(next)
  }

  function updatePreview(gameId, updater) {
    setOptimizerPreviewByGame((current) => {
      const base =
        current[String(gameId)] ||
        lineupsByGame[String(gameId)] ||
        blankLineup(players.map((p) => p.id), 6, activePlayerIds())

      const existing = normalizeLineup(base, players, base.innings || 6, base.availablePlayerIds || activePlayerIds())
      const next = updater(JSON.parse(JSON.stringify(existing)))
      return { ...current, [String(gameId)]: next }
    })
  }

  function togglePreviewAvailable(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      const id = String(playerId)
      if (lineup.availablePlayerIds.includes(id)) {
        lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => x !== id)
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          lineup.cells[id][inning] = ''
          lineup.lockedCells[id][inning] = false
        }
        lineup.lockedRows[id] = false
      } else {
        lineup.availablePlayerIds.push(id)
      }
      return lineup
    })
  }

  function updatePreviewCell(gameId, playerId, inning, value) {
    updatePreview(gameId, (lineup) => {
      lineup.cells[String(playerId)][inning] = value
      return lineup
    })
  }

  function updatePreviewBatting(gameId, playerId, value) {
    updatePreview(gameId, (lineup) => {
      lineup.battingOrder[String(playerId)] = value
      return lineup
    })
  }

  function togglePreviewCellLock(gameId, playerId, inning) {
    updatePreview(gameId, (lineup) => {
      lineup.lockedCells[String(playerId)][inning] = !lineup.lockedCells[String(playerId)][inning]
      return lineup
    })
  }

  function togglePreviewRowLock(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      lineup.lockedRows[String(playerId)] = !lineup.lockedRows[String(playerId)]
      return lineup
    })
  }

  async function savePreview(gameId) {
    const lineup = optimizerPreviewByGame[String(gameId)]
    if (!lineup) return

    const existing = await supabase
      .from('game_lineups')
      .select('id')
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')
      .maybeSingle()

    if (existing.error) {
      setAppError(existing.error.message)
      return
    }

    const payload = {
      lineup_data: lineup,
      optimizer_meta: {
        innings: lineup.innings,
        availablePlayerIds: lineup.availablePlayerIds,
      },
      lineup_locked: false,
    }

    if (existing.data?.id) {
      const updated = await supabase
        .from('game_lineups')
        .update(payload)
        .eq('id', existing.data.id)

      if (updated.error) {
        setAppError(updated.error.message)
        return
      }
    } else {
      const inserted = await supabase
        .from('game_lineups')
        .insert({
          game_id: gameId,
          lineup_name: 'Main',
          ...payload,
        })

      if (inserted.error) {
        setAppError(inserted.error.message)
        return
      }
    }

    await updateGameField(gameId, 'innings', lineup.innings)
    setLineupsByGame((current) => ({ ...current, [String(gameId)]: JSON.parse(JSON.stringify(lineup)) }))
    setLineupLockedByGame((current) => ({ ...current, [String(gameId)]: false }))
  }

  function updateSavedLineup(gameId, updater) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing) return current
      const next = updater(JSON.parse(JSON.stringify(existing)))
      return { ...current, [String(gameId)]: next }
    })
  }

  function updateSavedCell(gameId, playerId, inning, value) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.cells[String(playerId)][inning] = value
      return lineup
    })
  }

  function updateSavedBatting(gameId, playerId, value) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.battingOrder[String(playerId)] = value
      return lineup
    })
  }

  function addSavedInning(gameId) {
    updateSavedLineup(gameId, (lineup) => {
      const newInning = lineup.innings + 1
      lineup.innings = newInning
      Object.keys(lineup.cells).forEach((id) => {
        lineup.cells[id][newInning] = ''
        lineup.lockedCells[id][newInning] = false
      })
      return lineup
    })
  }

  function removeSavedInning(gameId, inningToRemove) {
    updateSavedLineup(gameId, (lineup) => {
      if (lineup.innings <= 1) return lineup

      Object.keys(lineup.cells).forEach((id) => {
        const newCells = {}
        const newLocks = {}
        let idx = 1
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          if (inning === inningToRemove) continue
          newCells[idx] = lineup.cells[id][inning] || ''
          newLocks[idx] = lineup.lockedCells[id][inning] || false
          idx += 1
        }
        lineup.cells[id] = newCells
        lineup.lockedCells[id] = newLocks
      })

      lineup.innings -= 1
      return lineup
    })
  }

  async function saveSavedLineup(gameId) {
    const lineup = lineupsByGame[String(gameId)]
    if (!lineup) return

    const existing = await supabase
      .from('game_lineups')
      .select('id, lineup_locked')
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')
      .maybeSingle()

    if (existing.error) {
      setAppError(existing.error.message)
      return
    }

    if (existing.data?.lineup_locked) {
      setAppError('Unlock the lineup before editing.')
      return
    }

    const payload = {
      lineup_data: lineup,
      optimizer_meta: {
        innings: lineup.innings,
        availablePlayerIds: lineup.availablePlayerIds,
      },
    }

    if (existing.data?.id) {
      const updated = await supabase
        .from('game_lineups')
        .update(payload)
        .eq('id', existing.data.id)

      if (updated.error) {
        setAppError(updated.error.message)
        return
      }
    } else {
      const inserted = await supabase
        .from('game_lineups')
        .insert({
          game_id: gameId,
          lineup_name: 'Main',
          lineup_locked: false,
          ...payload,
        })

      if (inserted.error) {
        setAppError(inserted.error.message)
        return
      }
    }

    await updateGameField(gameId, 'innings', lineup.innings)
  }

  async function toggleLineupLocked(gameId, nextLocked) {
    const existing = await supabase
      .from('game_lineups')
      .select('id')
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')
      .maybeSingle()

    if (existing.error) {
      setAppError(existing.error.message)
      return
    }

    if (!existing.data?.id) {
      setAppError('Save the lineup before locking it.')
      return
    }

    const updated = await supabase
      .from('game_lineups')
      .update({ lineup_locked: nextLocked })
      .eq('id', existing.data.id)

    if (updated.error) {
      setAppError(updated.error.message)
      return
    }

    setLineupLockedByGame((current) => ({
      ...current,
      [String(gameId)]: nextLocked,
    }))
  }

  function clearSavedLineup(gameId) {
    const locked = lineupLockedByGame[String(gameId)]
    if (locked) {
      setAppError('Unlock the lineup before clearing it.')
      return
    }

    const confirmed = window.confirm('Clear the lineup for this game?')
    if (!confirmed) return

    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
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
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'name'))}>Player</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'jersey_number'))}>#</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'activeText'))}>Active</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.id}>
                  <td>
                    <input
                      value={player.name}
                      onChange={(e) => updatePlayerLocal(player.id, 'name', e.target.value)}
                      onBlur={() => upsertPlayer(player)}
                    />
                  </td>
                  <td>
                    <input
                      value={player.jersey_number || ''}
                      onChange={(e) => updatePlayerLocal(player.id, 'jersey_number', e.target.value)}
                      onBlur={() => upsertPlayer(player)}
                    />
                  </td>
                  <td>
                    <select
                      value={player.active === false ? 'No' : 'Yes'}
                      onChange={(e) => {
                        const value = e.target.value === 'Yes'
                        updatePlayerLocal(player.id, 'active', value)
                        upsertPlayer({ ...player, active: value })
                      }}
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => deletePlayer(player.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderPositioningPriorityPage() {
    return (
      <div className="stack">
        <div className="card" style={{ overflowX: 'auto' }}>
          <h2>Positioning Priority</h2>
          <table>
            <thead>
              <tr>
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'name'))}>Player</th>
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'jersey_number'))}>#</th>
                {PRIORITY_POSITIONS.map((position) => (
                  <th key={position} onClick={() => setPrioritySort(nextSort(prioritySort, position))}>
                    {position}
                  </th>
                ))}
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'subtotal'))}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {activePriorityRows.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.name}</td>
                  <td>{row.jersey_number}</td>
                  {PRIORITY_POSITIONS.map((position) => (
                    <td key={position}>
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={row[position]}
                        onChange={(e) => updatePriorityLocal(row.playerId, position, e.target.value)}
                        onBlur={(e) => persistPriority(row.playerId, position, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>{row.subtotal}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="2">Subtotal</th>
                {PRIORITY_POSITIONS.map((position) => (
                  <th key={position}>{priorityFooter[position]}</th>
                ))}
                <th>{priorityFooter.subtotal}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Allowed Positions</h3>
          <table>
            <thead>
              <tr>
                <th>Player</th>
                <th>#</th>
                {ALLOWED_POSITIONS.map((position) => (
                  <th key={position}>{position}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activePlayers.map((player) => (
                <tr key={player.id}>
                  <td>{player.name}</td>
                  <td>{player.jersey_number || ''}</td>
                  {ALLOWED_POSITIONS.map((position) => {
                    const tier = fitByPlayer[String(player.id)]?.[position] || 'secondary'
                    const background =
                      tier === 'primary' ? '#dcfce7' :
                      tier === 'secondary' ? '#fef3c7' :
                      '#fee2e2'

                    return (
                      <td key={position}>
                        <select
                          value={tier}
                          style={{ background }}
                          onChange={(e) => {
                            updateFitLocal(player.id, position, e.target.value)
                            persistFitTier(player.id, position, e.target.value)
                          }}
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Non-Primary</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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

          {appError && <p style={{ color: '#b91c1c' }}>Error: {appError}</p>}
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
              <div className="summary-box">Innings are changed in optimizer or game detail only.</div>
            </div>
            <div className="align-end">
              <button onClick={addGameFromGames}>Add Game</button>
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
                <th onClick={() => setGameSort(nextSort(gameSort, 'lineupState'))}>Status</th>
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
                  <td>{game.innings}</td>
                  <td>{game.lineupState}</td>
                  <td>
                    <div className="button-row">
                      <button
                        onClick={() => {
                          setSelectedGameId(String(game.id))
                          setPage('game-detail')
                        }}
                      >
                        Open
                      </button>
                      <button onClick={() => deleteGame(game.id)}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))}
              {!sortedGames.length && !loading && (
                <tr>
                  <td colSpan="5">No games yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderOptimizerPage() {
    const focusStatuses = optimizerFocusLineup
      ? Array.from({ length: optimizerFocusLineup.innings }, (_, i) => i + 1).map((inning) => ({
          inning,
          ...inningStatus(optimizerFocusLineup, inning, players, fitByPlayer),
        }))
      : []

    return (
      <div className="stack">
        <div className="card">
          <h2>Optimizer</h2>

          <div className="grid four-col">
            <div>
              <label>Existing Game</label>
              <select value={optimizerExistingGameId} onChange={(e) => setOptimizerExistingGameId(e.target.value)}>
                <option value="">Select game</option>
                {games.map((game) => (
                  <option key={game.id} value={String(game.id)}>
                    {(game.date || 'No Date')} vs {(game.opponent || 'Opponent')}
                  </option>
                ))}
              </select>
            </div>
            <div className="align-end">
              <button onClick={addExistingGameToBatch}>Add Existing to Batch</button>
            </div>
            <div>
              <label>Create Date</label>
              <input type="date" value={optimizerNewDate} onChange={(e) => setOptimizerNewDate(e.target.value)} />
            </div>
            <div>
              <label>Create Opponent</label>
              <input value={optimizerNewOpponent} onChange={(e) => setOptimizerNewOpponent(e.target.value)} />
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <button onClick={addGameFromOptimizer}>Create New + Add to Batch</button>
            <button onClick={buildBatch}>Build / Rebuild Batch</button>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Current Batch</h3>
          <table>
            <thead>
              <tr>
                <th>Focus</th>
                <th>Date</th>
                <th>Opponent</th>
                <th>Innings</th>
                <th>Req. Outs</th>
                <th>Save</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {optimizerBatchGames.map((game) => {
                const lineup =
                  optimizerPreviewByGame[String(game.id)] ||
                  lineupsByGame[String(game.id)] ||
                  blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

                return (
                  <tr key={game.id}>
                    <td>
                      <button onClick={() => setOptimizerFocusGameId(String(game.id))}>
                        {String(optimizerFocusGameId) === String(game.id) ? 'Viewing' : 'Focus'}
                      </button>
                    </td>
                    <td>{game.date || 'No Date'}</td>
                    <td>{game.opponent || 'Opponent'}</td>
                    <td>
                      <select
                        value={game.innings}
                        onChange={(e) => updateGameField(game.id, 'innings', Number(e.target.value))}
                      >
                        {[4, 5, 6, 7].map((n) => (
                          <option key={n} value={n}>
                            {n}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>{requiredOutsForGame((lineup.availablePlayerIds || []).length, Number(game.innings || 6))}</td>
                    <td>
                      <button onClick={() => savePreview(game.id)}>Save</button>
                    </td>
                    <td>
                      <button onClick={() => removeBatchGame(game.id)}>Remove</button>
                    </td>
                  </tr>
                )
              })}
              {!optimizerBatchGames.length && (
                <tr>
                  <td colSpan="7">No games in batch.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {optimizerFocusGame && (
          <>
            <div className="card">
              <h3>
                Focus Game: {optimizerFocusGame.date || 'No Date'} vs {optimizerFocusGame.opponent || 'Opponent'}
              </h3>

              <div className="checkbox-grid">
                {activePlayers.map((player) => {
                  const lineup =
                    optimizerPreviewByGame[String(optimizerFocusGame.id)] ||
                    lineupsByGame[String(optimizerFocusGame.id)] ||
                    blankLineup(players.map((p) => p.id), Number(optimizerFocusGame.innings || 6), activePlayerIds())

                  return (
                    <label key={player.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={(lineup.availablePlayerIds || []).includes(String(player.id))}
                        onChange={() => togglePreviewAvailable(optimizerFocusGame.id, player.id)}
                      />
                      {player.name}
                    </label>
                  )
                })}
              </div>
            </div>

            {optimizerFocusLineup && (
              <>
                <div className="card">
                  <h3>Checks</h3>
                  <div className="stack">
                    {focusStatuses.map((status) => (
                      <div key={status.inning} className="summary-box">
                        <strong>Inning {status.inning}:</strong>{' '}
                        {status.duplicate.length ? `Duplicate ${status.duplicate.join(', ')}. ` : ''}
                        {status.missing.length ? `Missing ${status.missing.join(', ')}. ` : ''}
                        {status.badFits.length ? `Disallowed ${status.badFits.join('; ')}. ` : ''}
                        {!status.duplicate.length && !status.missing.length && !status.badFits.length ? 'Looks good.' : ''}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ overflowX: 'auto' }}>
                  <h3>Grid</h3>
                  {renderGrid({
                    players,
                    lineup: optimizerFocusLineup,
                    fitMap: fitByPlayer,
                    showLocks: true,
                    lockedLineup: false,
                    onCellChange: (playerId, inning, value) => updatePreviewCell(optimizerFocusGame.id, playerId, inning, value),
                    onBattingChange: (playerId, value) => updatePreviewBatting(optimizerFocusGame.id, playerId, value),
                    onCellLockToggle: (playerId, inning) => togglePreviewCellLock(optimizerFocusGame.id, playerId, inning),
                    onRowLockToggle: (playerId) => togglePreviewRowLock(optimizerFocusGame.id, playerId),
                  })}
                </div>
              </>
            )}

            {renderTrackingCard('YTD Before', ytdBeforeTotals, players, trackingSort, setTrackingSort)}
            {renderTrackingCard('Current Batch', currentBatchTotals, players, trackingSort, setTrackingSort)}
            {renderTrackingCard('YTD After', ytdAfterTotals, players, trackingSort, setTrackingSort)}
          </>
        )}
      </div>
    )
  }

  function renderGameDetailPage() {
    if (!selectedGame) {
      return (
        <div className="card">
          <h2>Game Detail</h2>
          <p>Select a game from Games.</p>
        </div>
      )
    }

    if (!selectedLineup) {
      return (
        <div className="card">
          <div className="row-between">
            <div>
              <h2>{selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}</h2>
              <p>No lineup saved yet.</p>
            </div>
            <button onClick={() => setPage('games')}>Back</button>
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
              <p>Status: <strong>{selectedLocked ? 'Locked' : 'Planned'}</strong></p>
            </div>

            <div className="button-row">
              <button onClick={() => addSavedInning(selectedGame.id)} disabled={selectedLocked}>
                Add Inning
              </button>
              <button onClick={() => saveSavedLineup(selectedGame.id)} disabled={selectedLocked}>
                Save Changes
              </button>
              <button
                onClick={() => toggleLineupLocked(selectedGame.id, !selectedLocked)}
              >
                {selectedLocked ? 'Unlock Lineup' : 'Lock Lineup'}
              </button>
              <button onClick={() => clearSavedLineup(selectedGame.id)} disabled={selectedLocked}>
                Clear Lineup
              </button>
              <button onClick={() => window.print()}>Print</button>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            {Array.from({ length: selectedLineup.innings }, (_, i) => i + 1).map((inning) => (
              <button
                key={inning}
                onClick={() => removeSavedInning(selectedGame.id, inning)}
                disabled={selectedLocked}
              >
                Remove {inning}
              </button>
            ))}
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          {renderGrid({
            players,
            lineup: selectedLineup,
            fitMap: fitByPlayer,
            showLocks: false,
            lockedLineup: selectedLocked,
            onCellChange: (playerId, inning, value) => updateSavedCell(selectedGame.id, playerId, inning, value),
            onBattingChange: (playerId, value) => updateSavedBatting(selectedGame.id, playerId, value),
            onCellLockToggle: () => {},
            onRowLockToggle: () => {},
          })}
        </div>
      </div>
    )
  }

  function renderTrackingPage() {
    const overallTotals = computeTotals(Object.values(lineupsByGame), players)

    const rows = sortRows(
      players.map((player) => {
        const totals = overallTotals[String(player.id)] || {}
        const priority = priorityByPlayer[String(player.id)] || {}
        const fieldTotal = Math.max(totals.fieldTotal || 0, 1)

        return {
          playerId: String(player.id),
          name: player.name,
          jersey_number: player.jersey_number || '',
          fieldTotal: totals.fieldTotal || 0,
          Out: totals.Out || 0,
          expectedOuts: totals.expectedOuts || 0,
          actualOuts: totals.actualOuts || 0,
          delta: totals.delta || 0,
          P: totals.P || 0,
          C: totals.C || 0,
          '1B': totals['1B'] || 0,
          '2B': totals['2B'] || 0,
          '3B': totals['3B'] || 0,
          SS: totals.SS || 0,
          LF: totals.LF || 0,
          CF: totals.CF || 0,
          RF: totals.RF || 0,
          OF: totals.OF || 0,
          targP: priority.P?.priority_pct || '',
          targC: priority.C?.priority_pct || '',
          targ1B: priority['1B']?.priority_pct || '',
          targ2B: priority['2B']?.priority_pct || '',
          targ3B: priority['3B']?.priority_pct || '',
          targSS: priority.SS?.priority_pct || '',
          targOF: priority.OF?.priority_pct || '',
          actP: Number((((totals.P || 0) / fieldTotal) * 100).toFixed(1)),
          actC: Number((((totals.C || 0) / fieldTotal) * 100).toFixed(1)),
          act1B: Number((((totals['1B'] || 0) / fieldTotal) * 100).toFixed(1)),
          act2B: Number((((totals['2B'] || 0) / fieldTotal) * 100).toFixed(1)),
          act3B: Number((((totals['3B'] || 0) / fieldTotal) * 100).toFixed(1)),
          actSS: Number((((totals.SS || 0) / fieldTotal) * 100).toFixed(1)),
          actOF: Number((((totals.OF || 0) / fieldTotal) * 100).toFixed(1)),
        }
      }),
      trackingSort
    )

    return (
      <div className="stack">
        {renderTrackingCard('Tracking Totals', overallTotals, players, trackingSort, setTrackingSort)}

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Tracking vs Positioning Priority</h3>
          <table>
            <thead>
              <tr>
                <th onClick={() => setTrackingSort(nextSort(trackingSort, 'name'))}>Player</th>
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

  return (
    <div className="app-shell">
      <aside className="sidebar no-print">
        <h1>Thunder Lineup Tool</h1>
        <div className="nav-stack">
          {renderNavButton('players', 'Players')}
          {renderNavButton('positioning-priority', 'Positioning Priority')}
          {renderNavButton('games', 'Games')}
          {renderNavButton('optimizer', 'Optimizer')}
          {renderNavButton('game-detail', 'Game Detail')}
          {renderNavButton('tracking', 'Tracking')}
        </div>
      </aside>

      <main className="main-content">
        {appError && page !== 'games' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ color: '#b91c1c', margin: 0 }}>Error: {appError}</p>
          </div>
        )}

        {page === 'players' && renderPlayersPage()}
        {page === 'positioning-priority' && renderPositioningPriorityPage()}
        {page === 'games' && renderGamesPage()}
        {page === 'optimizer' && renderOptimizerPage()}
        {page === 'game-detail' && renderGameDetailPage()}
        {page === 'tracking' && renderTrackingPage()}
      </main>
    </div>
  )

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
}
