import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  PRIORITY_POSITIONS,
  ALLOWED_POSITIONS,
  GAME_TYPES,
  pk,
  blankLineup,
  normalizeLineup,
  requiredOutsForGame,
  computeTotals,
  addTotals,
  buildOptimizedLineup,
  inningStatus,
} from './lib/lineupUtils'

import GamesPage from './Pages/GamesPage'
import TrackingTable from './Components/TrackingTable'
import AttendancePage from './Pages/AttendancePage'
import {
  nextSort,
  sortRows,
  getNextGameOrder,
  compareGamesAsc,
  buildBattingOrderMatrix,
  buildSitOutSummary,
  buildPlayerSitOuts,
  buildPositionByPlayer,
} from './lib/appHelpers'
import PlayersPage from './Pages/PlayersPage'
import PositioningPriorityPage from './Pages/PositioningPriorityPage'
import GameDetailPage from './Pages/GameDetailPage'
import LineupSetterPage from './Pages/LineupSetterPage'
import TrackingPage from './Pages/TrackingPage'
import LineupGrid from './Components/LineupGrid'
import Sidebar from './Components/Sidebar'
import VerticalHeader from './Components/VerticalHeader'
import {
  TEAM_ID,
  ATTENDANCE_SEASON_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
  ATTENDANCE_SURFACE_OPTIONS,
} from './lib/constants'

function dbReady() {
  return Boolean(supabase)
}

function buildBatchOutTargets(batchGames, optimizerPreviewByGame, lineupsByGame, players, activePlayerIds, pk) {
  const expectedByPlayer = {}
  const availableGamesByPlayer = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    expectedByPlayer[id] = 0
    availableGamesByPlayer[id] = 0
  })

  ;(batchGames || []).forEach((game) => {
    const source =
      optimizerPreviewByGame[pk(game.id)] ||
      lineupsByGame[pk(game.id)] ||
      blankLineup(
        (players || []).map((p) => p.id),
        Number(game.innings || 6),
        activePlayerIds()
      )

    const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
    const innings = Number(source?.innings || game.innings || 6)
    const totalOuts = Math.max(0, availableIds.length - 9) * innings

    if (!availableIds.length || totalOuts <= 0) {
      availableIds.forEach((id) => {
        availableGamesByPlayer[id] = Number(availableGamesByPlayer[id] || 0) + 1
      })
      return
    }

    const share = totalOuts / availableIds.length

    availableIds.forEach((id) => {
      expectedByPlayer[id] = Number(expectedByPlayer[id] || 0) + share
      availableGamesByPlayer[id] = Number(availableGamesByPlayer[id] || 0) + 1
    })
  })

  const targets = {}
  const fractional = []

  Object.keys(expectedByPlayer).forEach((id) => {
    const expected = Number(expectedByPlayer[id] || 0)
    const floorTarget = Math.floor(expected)
    targets[id] = floorTarget

    fractional.push({
      id,
      remainder: expected - floorTarget,
      expected,
      availableGames: availableGamesByPlayer[id] || 0,
    })
  })

  const totalExpected = Object.values(expectedByPlayer).reduce((sum, n) => sum + Number(n || 0), 0)
  const totalIntegerTargets = Object.values(targets).reduce((sum, n) => sum + Number(n || 0), 0)
  let remaining = Math.round(totalExpected - totalIntegerTargets)

  fractional.sort((a, b) => {
    if (b.remainder !== a.remainder) return b.remainder - a.remainder
    if (b.availableGames !== a.availableGames) return b.availableGames - a.availableGames
    return String(a.id).localeCompare(String(b.id))
  })

  for (let i = 0; i < fractional.length && remaining > 0; i += 1) {
    targets[fractional[i].id] += 1
    remaining -= 1
  }

  return {
    expectedByPlayer,
    availableGamesByPlayer,
    targets,
  }
}

export default function App() {
  const [page, setPage] = useState('games')

  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [lineupsByGame, setLineupsByGame] = useState({})
  const [lineupLockedByGame, setLineupLockedByGame] = useState({})
  const [priorityByPlayer, setPriorityByPlayer] = useState({})
  const [fitByPlayer, setFitByPlayer] = useState({})
  const [attendanceEvents, setAttendanceEvents] = useState([])
  const [attendanceByEvent, setAttendanceByEvent] = useState({})

  const [loading, setLoading] = useState(true)
  const [appError, setAppError] = useState('')

  const [selectedGameId, setSelectedGameId] = useState('')
  const [optimizerExistingGameId, setOptimizerExistingGameId] = useState('')
  const [optimizerFocusGameId, setOptimizerFocusGameId] = useState('')
  const [optimizerBatchGameIds, setOptimizerBatchGameIds] = useState([])
  const [optimizerPreviewByGame, setOptimizerPreviewByGame] = useState({})
const optimizerFocusLocked = useMemo(
  () => (optimizerFocusGame ? lineupLockedByGame[pk(optimizerFocusGame.id)] === true : false),
  [optimizerFocusGame, lineupLockedByGame]
)
  
  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [newGameType, setNewGameType] = useState(GAME_TYPES[0])

  const [optimizerNewDate, setOptimizerNewDate] = useState('')
  const [optimizerNewOpponent, setOptimizerNewOpponent] = useState('')
  const [optimizerNewType, setOptimizerNewType] = useState(GAME_TYPES[0])

  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerNumber, setNewPlayerNumber] = useState('')
  const [newPlayerActive, setNewPlayerActive] = useState(true)

  const [playerSort, setPlayerSort] = useState({ key: 'name', direction: 'asc' })
  const [gameSort, setGameSort] = useState({ key: 'date', direction: 'asc' })
  const [prioritySort, setPrioritySort] = useState({ key: 'name', direction: 'asc' })
  const [allowedSort, setAllowedSort] = useState({ key: 'name', direction: 'asc' })
  const [trackingSort, setTrackingSort] = useState({ key: 'name', direction: 'asc' })
  const [attendanceSort, setAttendanceSort] = useState({ key: 'event_date', direction: 'asc' })

  const [trackingPlayerId, setTrackingPlayerId] = useState('')

  const [attendanceDate, setAttendanceDate] = useState('')
  const [attendanceSeason, setAttendanceSeason] = useState(ATTENDANCE_SEASON_OPTIONS[0])
  const [attendanceType, setAttendanceType] = useState(ATTENDANCE_TYPE_OPTIONS[0])
  const [attendanceSurface, setAttendanceSurface] = useState(ATTENDANCE_SURFACE_OPTIONS[0])
  const [attendanceTitle, setAttendanceTitle] = useState('')

async function persistLineup(gameId, lineup, nextLocked = null) {
  const existing = await supabase
    .from('game_lineups')
    .select('id, lineup_locked')
    .eq('game_id', gameId)
    .eq('lineup_name', 'Main')
    .maybeSingle()

  if (existing.error) {
    setAppError(existing.error.message)
    return false
  }

  const lockedValue =
    nextLocked === null
      ? existing.data?.lineup_locked === true || lineupLockedByGame[pk(gameId)] === true
      : nextLocked

  const payload = {
    lineup_data: lineup,
    optimizer_meta: {
      innings: lineup.innings,
      availablePlayerIds: lineup.availablePlayerIds,
    },
    lineup_locked: lockedValue,
  }

  if (existing.data?.id) {
    const updated = await supabase
      .from('game_lineups')
      .update(payload)
      .eq('id', existing.data.id)

    if (updated.error) {
      setAppError(updated.error.message)
      return false
    }
  } else {
    const inserted = await supabase.from('game_lineups').insert({
      game_id: gameId,
      lineup_name: 'Main',
      ...payload,
    })

    if (inserted.error) {
      setAppError(inserted.error.message)
      return false
    }
  }

  await updateGameField(gameId, 'innings', lineup.innings)
  setLineupsByGame((current) => ({
    ...current,
    [pk(gameId)]: JSON.parse(JSON.stringify(lineup)),
  }))
  setLineupLockedByGame((current) => ({
    ...current,
    [pk(gameId)]: lockedValue,
  }))

  return true
}
  
  function autoSave(gameId, lineup) {
    supabase.from('game_lineups').upsert(
      {
        game_id: gameId,
        lineup_name: 'Main',
        lineup_data: lineup,
        optimizer_meta: {
          innings: lineup.innings,
          availablePlayerIds: lineup.availablePlayerIds,
        },
        lineup_locked: lineupLockedByGame[pk(gameId)] === true,
      },
      { onConflict: 'game_id,lineup_name' }
    )
  }

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    setAppError('')

    try {
      if (!dbReady()) throw new Error('Supabase is not connected.')

      const playersRes = await supabase
        .from('players')
        .select('id, name, jersey_number, active')
        .eq('team_id', TEAM_ID)
        .order('name', { ascending: true })

      if (playersRes.error) throw playersRes.error
      const loadedPlayers = playersRes.data || []
      setPlayers(loadedPlayers)

      const gamesRes = await supabase
        .from('games')
        .select('id, game_date, opponent, innings, status, game_type, game_order')
        .eq('team_id', TEAM_ID)
        .order('game_date', { ascending: true, nullsFirst: false })
        .order('game_order', { ascending: true })

      if (gamesRes.error) throw gamesRes.error

      const loadedGames = (gamesRes.data || []).map((row) => ({
        id: row.id,
        date: row.game_date || '',
        opponent: row.opponent || '',
        innings: Number(row.innings || 6),
        status: row.status || 'Planned',
        game_type: row.game_type || GAME_TYPES[0],
        game_order: Number(row.game_order || null),
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
        loadedLineups[pk(row.game_id)] = normalizeLineup(
          row.lineup_data || {},
          loadedPlayers,
          Number(row.optimizer_meta?.innings || 6),
          row.optimizer_meta?.availablePlayerIds ||
            loadedPlayers.filter((p) => p.active !== false).map((p) => p.id)
        )
        loadedLocked[pk(row.game_id)] = row.lineup_locked === true
      })

      setLineupsByGame(loadedLineups)
      setLineupLockedByGame(loadedLocked)

      const prefRes = await supabase
        .from('player_position_preferences')
        .select('player_id, position, priority_pct')

      if (prefRes.error) throw prefRes.error

      const allowedRes = await supabase
        .from('player_allowed_positions')
        .select('player_id, position, fit_tier')

      if (allowedRes.error) throw allowedRes.error

      const nextPriority = {}
      const nextFit = {}

      ;(prefRes.data || []).forEach((row) => {
        const playerId = pk(row.player_id)
        if (!nextPriority[playerId]) nextPriority[playerId] = {}
        nextPriority[playerId][row.position] = { priority_pct: row.priority_pct ?? '' }
      })

      ;(allowedRes.data || []).forEach((row) => {
        const playerId = pk(row.player_id)
        if (!nextFit[playerId]) nextFit[playerId] = {}
        nextFit[playerId][row.position] = row.fit_tier || 'secondary'
      })

      setPriorityByPlayer(nextPriority)
      setFitByPlayer(nextFit)

      const attendanceEventsRes = await supabase
        .from('attendance_events')
        .select('id, event_date, season_bucket, event_type, surface, title')
        .eq('team_id', TEAM_ID)
        .order('event_date', { ascending: true })

      if (attendanceEventsRes.error) throw attendanceEventsRes.error
      setAttendanceEvents(attendanceEventsRes.data || [])

      const attendanceRecordsRes = await supabase
        .from('attendance_records')
        .select('event_id, player_id, attended')

      if (attendanceRecordsRes.error) throw attendanceRecordsRes.error

      const byEvent = {}
      ;(attendanceRecordsRes.data || []).forEach((row) => {
        const eventId = pk(row.event_id)
        if (!byEvent[eventId]) byEvent[eventId] = {}
        byEvent[eventId][pk(row.player_id)] = row.attended === true
      })
      setAttendanceByEvent(byEvent)

      if (loadedGames[0]) {
        setSelectedGameId(pk(loadedGames[0].id))
        setOptimizerExistingGameId(pk(loadedGames[0].id))
      }
    } catch (error) {
      setAppError(error.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  const activePlayers = useMemo(() => players.filter((p) => p.active !== false), [players])

  function activePlayerIds() {
    return activePlayers.map((p) => pk(p.id))
  }

  const selectedGame = useMemo(
    () => games.find((game) => pk(game.id) === pk(selectedGameId)) || null,
    [games, selectedGameId]
  )

  const selectedLineup = useMemo(
    () => (selectedGame ? lineupsByGame[pk(selectedGame.id)] || null : null),
    [selectedGame, lineupsByGame]
  )

  const selectedLocked = useMemo(
    () => (selectedGame ? lineupLockedByGame[pk(selectedGame.id)] === true : false),
    [selectedGame, lineupLockedByGame]
  )

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
        lineupState: lineupLockedByGame[pk(game.id)]
          ? 'Locked'
          : lineupsByGame[pk(game.id)]
          ? 'Saved'
          : 'Empty',
      })),
      gameSort
    )
  }, [games, lineupsByGame, lineupLockedByGame, gameSort])

  const orderedGamesAsc = useMemo(() => {
    return [...games].sort((a, b) => compareGamesAsc(a, b, pk))
  }, [games])

  const activePriorityRows = useMemo(() => {
    return sortRows(
      activePlayers.map((player) => {
        const pr = priorityByPlayer[pk(player.id)] || {}

        return {
          playerId: pk(player.id),
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

  const allowedRows = useMemo(() => {
    return sortRows(
      activePlayers.map((player) => {
        const fit = fitByPlayer[pk(player.id)] || {}
        return {
          playerId: pk(player.id),
          name: player.name,
          jersey_number: player.jersey_number || '',
          P: fit.P || '',
          C: fit.C || '',
          '1B': fit['1B'] || '',
          '2B': fit['2B'] || '',
          '3B': fit['3B'] || '',
          SS: fit.SS || '',
          LF: fit.LF || '',
          CF: fit.CF || '',
          RF: fit.RF || '',
        }
      }),
      allowedSort
    )
  }, [activePlayers, fitByPlayer, allowedSort])

  const priorityFooter = useMemo(() => {
    const footer = {}
    PRIORITY_POSITIONS.forEach((pos) => {
      footer[pos] = activePriorityRows.reduce((sum, row) => sum + Number(row[pos] || 0), 0)
    })
    footer.subtotal = PRIORITY_POSITIONS.reduce((sum, pos) => sum + Number(footer[pos] || 0), 0)
    return footer
  }, [activePriorityRows])

  const optimizerBatchGames = useMemo(
    () => games.filter((game) => optimizerBatchGameIds.includes(pk(game.id))),
    [games, optimizerBatchGameIds]
  )

  const optimizerFocusGame = useMemo(
    () => games.find((game) => pk(game.id) === pk(optimizerFocusGameId)) || null,
    [games, optimizerFocusGameId]
  )

  const optimizerFocusLineup = useMemo(
    () => optimizerPreviewByGame[pk(optimizerFocusGameId)] || null,
    [optimizerPreviewByGame, optimizerFocusGameId]
  )

  const lockedLineupsOnly = useMemo(() => {
    return Object.entries(lineupsByGame)
      .filter(([gameId]) => lineupLockedByGame[pk(gameId)] === true)
      .map(([, lineup]) => lineup)
  }, [lineupsByGame, lineupLockedByGame])

  const trackingLockedLineups = useMemo(() => {
    return orderedGamesAsc
      .filter((game) => lineupLockedByGame[pk(game.id)] === true)
      .map((game) => lineupsByGame[pk(game.id)])
      .filter(Boolean)
  }, [orderedGamesAsc, lineupLockedByGame, lineupsByGame])

  const ytdBeforeTotals = useMemo(
    () => computeTotals(lockedLineupsOnly, players),
    [lockedLineupsOnly, players]
  )

  const currentBatchTotals = useMemo(
    () => computeTotals(Object.values(optimizerPreviewByGame), players),
    [optimizerPreviewByGame, players]
  )

  const ytdAfterTotals = useMemo(
    () => addTotals(ytdBeforeTotals, currentBatchTotals, players),
    [ytdBeforeTotals, currentBatchTotals, players]
  )

  const trackingTotals = useMemo(
    () => computeTotals(trackingLockedLineups, players),
    [trackingLockedLineups, players]
  )

  const gamesWithLineups = useMemo(
    () => orderedGamesAsc.filter((g) => lineupsByGame[pk(g.id)]),
    [orderedGamesAsc, lineupsByGame]
  )

  const battingRows = useMemo(
    () => buildBattingOrderMatrix(gamesWithLineups, lineupsByGame, activePlayers, pk),
    [gamesWithLineups, lineupsByGame, activePlayers]
  )

  const sitSummary = useMemo(
    () => buildSitOutSummary(gamesWithLineups, lineupsByGame, activePlayers, pk),
    [gamesWithLineups, lineupsByGame, activePlayers]
  )

  const sitByPlayer = useMemo(
    () => buildPlayerSitOuts(gamesWithLineups, lineupsByGame, activePlayers, pk, requiredOutsForGame),
    [gamesWithLineups, lineupsByGame, activePlayers]
  )

  const selectedPlayerPositions = useMemo(() => {
    if (!trackingPlayerId) return []
    return buildPositionByPlayer(gamesWithLineups, lineupsByGame, pk(trackingPlayerId), pk)
  }, [trackingPlayerId, gamesWithLineups, lineupsByGame])

  const trackingPriorityRows = useMemo(() => {
    return sortRows(
      activePlayers.map((player) => {
        const totals = trackingTotals[pk(player.id)] || {}
        const priority = priorityByPlayer[pk(player.id)] || {}
        const fieldTotal = Math.max(totals.fieldTotal || 0, 1)

        const actPct = (n) => {
          const value = Number((((n || 0) / fieldTotal) * 100).toFixed(1))
          return value === 0 ? '' : value
        }

        return {
          playerId: pk(player.id),
          name: player.name,
          fieldTotal: totals.fieldTotal || 0,
          targP: priority.P?.priority_pct || '',
          targC: priority.C?.priority_pct || '',
          targ1B: priority['1B']?.priority_pct || '',
          targ2B: priority['2B']?.priority_pct || '',
          targ3B: priority['3B']?.priority_pct || '',
          targSS: priority.SS?.priority_pct || '',
          targOF: priority.OF?.priority_pct || '',
          actP: actPct(totals.P),
          actC: actPct(totals.C),
          act1B: actPct(totals['1B']),
          act2B: actPct(totals['2B']),
          act3B: actPct(totals['3B']),
          actSS: actPct(totals.SS),
          actOF: actPct(totals.OF),
        }
      }),
      trackingSort
    )
  }, [activePlayers, trackingTotals, priorityByPlayer, trackingSort])

  const filteredAttendanceEvents = useMemo(() => {
    return sortRows(attendanceEvents, attendanceSort)
  }, [attendanceEvents, attendanceSort])

  const attendanceTotals = useMemo(() => {
    const events = filteredAttendanceEvents
    return {
      inSeason: events.filter((e) => e.season_bucket === 'In Season').length,
      outSeason: events.filter((e) => e.season_bucket === 'Out of Season').length,
      pitchersCatchers: events.filter((e) => e.event_type === 'Pitchers/Catchers').length,
      teamPractice: events.filter((e) => e.event_type === 'Team Practice').length,
      indoor: events.filter((e) => e.surface === 'Indoor').length,
      outdoor: events.filter((e) => e.surface === 'Outdoor').length,
    }
  }, [filteredAttendanceEvents])

  const attendanceBreakdownByPlayer = useMemo(() => {
    return activePlayers.map((player) => {
      const id = pk(player.id)
      const eventRows = filteredAttendanceEvents

      function countAttended(predicate) {
        return eventRows
          .filter(predicate)
          .filter((event) => attendanceByEvent[pk(event.id)]?.[id] === true).length
      }

      function formatValue(actual, total) {
        if (!total) return ''
        return `${actual} (${Math.round((actual / total) * 100)}%)`
      }

      const inSeasonActual = countAttended((event) => event.season_bucket === 'In Season')
      const outSeasonActual = countAttended((event) => event.season_bucket === 'Out of Season')
      const pcActual = countAttended((event) => event.event_type === 'Pitchers/Catchers')
      const teamActual = countAttended((event) => event.event_type === 'Team Practice')
      const indoorActual = countAttended((event) => event.surface === 'Indoor')
      const outdoorActual = countAttended((event) => event.surface === 'Outdoor')

      return {
        playerId: id,
        name: player.name,
        inSeason: formatValue(inSeasonActual, attendanceTotals.inSeason),
        outSeason: formatValue(outSeasonActual, attendanceTotals.outSeason),
        pitchersCatchers: formatValue(pcActual, attendanceTotals.pitchersCatchers),
        teamPractice: formatValue(teamActual, attendanceTotals.teamPractice),
        indoor: formatValue(indoorActual, attendanceTotals.indoor),
        outdoor: formatValue(outdoorActual, attendanceTotals.outdoor),
      }
    })
  }, [activePlayers, filteredAttendanceEvents, attendanceByEvent, attendanceTotals])

  async function addGame(date, opponent, gameType) {
    const nextOrder = getNextGameOrder(games)

    const res = await supabase
      .from('games')
      .insert({
        team_id: TEAM_ID,
        game_date: date || null,
        opponent: opponent || null,
        innings: 6,
        status: 'Planned',
        game_type: gameType || GAME_TYPES[0],
        game_order: nextOrder,
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
      game_type: res.data.game_type || GAME_TYPES[0],
      game_order: Number(res.data.game_order || nextOrder),
    }

    setGames((current) => [...current, game])
    return game
  }

  async function addGameFromGames() {
    const game = await addGame(newGameDate, newGameOpponent, newGameType)
    if (game) {
      setNewGameDate('')
      setNewGameOpponent('')
      setNewGameType(GAME_TYPES[0])
      setSelectedGameId(pk(game.id))
    }
  }

  async function addGameFromOptimizer() {
    const game = await addGame(optimizerNewDate, optimizerNewOpponent, optimizerNewType)
    if (game) {
      setOptimizerNewDate('')
      setOptimizerNewOpponent('')
      setOptimizerNewType(GAME_TYPES[0])
      setOptimizerBatchGameIds((current) => [...new Set([...current, pk(game.id)])])
      setOptimizerFocusGameId(pk(game.id))
      setOptimizerExistingGameId(pk(game.id))
      setOptimizerPreviewByGame((current) => ({
        ...current,
        [pk(game.id)]: blankLineup(
          players.map((p) => p.id),
          Number(game.innings || 6),
          activePlayerIds()
        ),
      }))
    }
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((game) => (pk(game.id) === pk(gameId) ? { ...game, [field]: value } : game))
    )

    const updates = {}
    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'innings') updates.innings = Number(value)
    if (field === 'status') updates.status = value
    if (field === 'game_type') updates.game_type = value
    if (field === 'game_order') updates.game_order = value === '' ? null : Number(value)

    const res = await supabase.from('games').update(updates).eq('id', gameId)
    if (res.error) setAppError(res.error.message)
  }

  async function deleteGame(gameId) {
    if (lineupLockedByGame[pk(gameId)]) {
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

    setGames((current) => current.filter((game) => pk(game.id) !== pk(gameId)))
    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
    setLineupLockedByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
    setOptimizerBatchGameIds((current) => current.filter((id) => pk(id) !== pk(gameId)))
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
      current.map((player) => (pk(player.id) === pk(playerId) ? { ...player, [field]: value } : player))
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
    const confirmed = window.confirm('Delete this player?')
    if (!confirmed) return

    const del = await supabase.from('players').delete().eq('id', playerId)
    if (del.error) {
      setAppError(del.error.message)
      return
    }

    setPlayers((current) => current.filter((player) => pk(player.id) !== pk(playerId)))
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
    } else {
      const up = await supabase
        .from('player_position_preferences')
        .upsert(
          {
            player_id: playerId,
            position,
            priority_pct: Number(cleaned),
          },
          { onConflict: 'player_id,position' }
        )

      if (up.error) setAppError(up.error.message)
    }

    updatePriorityLocal(playerId, position, value)

    const numericValue = Number(cleaned || 0)
    if (numericValue > 0) {
      if (position === 'OF') {
        await Promise.all(
          ['LF', 'CF', 'RF'].map((ofPos) =>
            supabase.from('player_allowed_positions').upsert(
              { player_id: playerId, position: ofPos, fit_tier: 'primary' },
              { onConflict: 'player_id,position' }
            )
          )
        )
        setFitByPlayer((current) => ({
          ...current,
          [pk(playerId)]: {
            ...(current[pk(playerId)] || {}),
            LF: 'primary',
            CF: 'primary',
            RF: 'primary',
          },
        }))
      } else {
        await supabase.from('player_allowed_positions').upsert(
          { player_id: playerId, position, fit_tier: 'primary' },
          { onConflict: 'player_id,position' }
        )
        setFitByPlayer((current) => ({
          ...current,
          [pk(playerId)]: {
            ...(current[pk(playerId)] || {}),
            [position]: 'primary',
          },
        }))
      }
    }
  }

  async function persistFitTier(playerId, position, tier) {
    const primaryLocked =
      Number(priorityByPlayer[pk(playerId)]?.[position]?.priority_pct || 0) > 0 ||
      (['LF', 'RF'].includes(position) &&
        Number(priorityByPlayer[pk(playerId)]?.OF?.priority_pct || 0) > 0)

    if (primaryLocked) return

    const up = await supabase
      .from('player_allowed_positions')
      .upsert(
        {
          player_id: playerId,
          position,
          fit_tier: tier,
        },
        { onConflict: 'player_id,position' }
      )

    if (up.error) setAppError(up.error.message)
  }

  function updatePriorityLocal(playerId, position, value) {
    setPriorityByPlayer((current) => ({
      ...current,
      [pk(playerId)]: {
        ...(current[pk(playerId)] || {}),
        [position]: { priority_pct: value },
      },
    }))
  }

  function updateFitLocal(playerId, position, tier) {
    setFitByPlayer((current) => ({
      ...current,
      [pk(playerId)]: {
        ...(current[pk(playerId)] || {}),
        [position]: tier,
      },
    }))
  }

  function addExistingGameToBatch() {
    if (!optimizerExistingGameId) return

    const gameId = pk(optimizerExistingGameId)
    const game = games.find((g) => pk(g.id) === gameId)
    if (!game) return

    const savedLineup =
      optimizerPreviewByGame[gameId] ||
      lineupsByGame[gameId] ||
      blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

    const normalized = normalizeLineup(
      savedLineup,
      players,
      Number(game.innings || 6),
      savedLineup.availablePlayerIds || activePlayerIds()
    )

    setOptimizerBatchGameIds((current) => [...new Set([...current, gameId])])
    setOptimizerFocusGameId(gameId)
    setOptimizerPreviewByGame((current) => ({
      ...current,
      [gameId]: normalized,
    }))
  }

  function removeBatchGame(gameId) {
    setOptimizerBatchGameIds((current) => current.filter((id) => pk(id) !== pk(gameId)))
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
  }

  function runOptimizeAll() {
  if (!optimizerBatchGames.length) {
    alert('No games in plan')
    return
  }

  let rollingTotals = JSON.parse(JSON.stringify(ytdBeforeTotals))
  const next = {}

  const orderedGames = [...optimizerBatchGames].sort((a, b) => {
    const aKey = `${a.date || ''}-${String(a.game_order || 0).padStart(2, '0')}-${a.id}`
    const bKey = `${b.date || ''}-${String(b.game_order || 0).padStart(2, '0')}-${b.id}`
    return aKey.localeCompare(bKey)
  })

  orderedGames.forEach((game) => {
    const gameId = pk(game.id)

    if (lineupLockedByGame[gameId]) {
      const lockedLineup = lineupsByGame[gameId]
      if (lockedLineup) {
        next[gameId] = lockedLineup
        rollingTotals = addTotals(rollingTotals, computeTotals([lockedLineup], players), players)
      }
      return
    }

    const source =
      optimizerPreviewByGame[gameId] ||
      lineupsByGame[gameId] ||
      blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

    const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
    if (!availableIds.length) return

    const optimized = buildOptimizedLineup({
      game: { ...game, innings: Number(source?.innings || game.innings || 6) },
      players,
      availablePlayerIds: availableIds,
      sourceLineup: source,
      totalsBefore: rollingTotals,
      priorityMap: priorityByPlayer,
      fitMap: fitByPlayer,
    })

    next[gameId] = optimized
    persistLineup(gameId, optimized)
    rollingTotals = addTotals(rollingTotals, computeTotals([optimized], players), players)
  })

  setOptimizerPreviewByGame((current) => ({ ...current, ...next }))
}

  function runOptimizeCurrent() {
  if (!optimizerFocusGameId) return

  if (lineupLockedByGame[pk(optimizerFocusGameId)]) {
    setAppError('This lineup is locked. Unlock it before optimizing.')
    return
  }

  const game = games.find((g) => pk(g.id) === pk(optimizerFocusGameId))
  if (!game) return

  const otherPreviewLineups = Object.entries(optimizerPreviewByGame)
    .filter(([gameId]) => pk(gameId) !== pk(optimizerFocusGameId))
    .map(([, lineup]) => lineup)

  const totalsBeforeThisGame = addTotals(
    ytdBeforeTotals,
    computeTotals(otherPreviewLineups, players),
    players
  )

  const source =
    optimizerPreviewByGame[pk(game.id)] ||
    lineupsByGame[pk(game.id)] ||
    blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

  const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
  if (!availableIds.length) return

  const rebuilt = buildOptimizedLineup({
    game: { ...game, innings: Number(source?.innings || game.innings || 6) },
    players,
    availablePlayerIds: availableIds,
    sourceLineup: source,
    totalsBefore: totalsBeforeThisGame,
    priorityMap: priorityByPlayer,
    fitMap: fitByPlayer,
  })

  setOptimizerPreviewByGame((current) => ({
    ...current,
    [pk(game.id)]: rebuilt,
  }))

  persistLineup(game.id, rebuilt)
}

  function updatePreview(gameId, updater) {
  if (lineupLockedByGame[pk(gameId)]) {
    setAppError('This lineup is locked. Unlock it before editing.')
    return
  }

  setOptimizerPreviewByGame((current) => {
    const baseGame = games.find((g) => pk(g.id) === pk(gameId))
    const base =
      current[pk(gameId)] ||
      lineupsByGame[pk(gameId)] ||
      blankLineup(players.map((p) => p.id), Number(baseGame?.innings || 6), activePlayerIds())

    const existing = normalizeLineup(
      base,
      players,
      base.innings || 6,
      base.availablePlayerIds || activePlayerIds()
    )

    const next = updater(JSON.parse(JSON.stringify(existing)))

    // auto-save immediately
    persistLineup(gameId, next)

    return { ...current, [pk(gameId)]: next }
  })
}
  

  function togglePreviewAvailable(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      const id = pk(playerId)
      if (lineup.availablePlayerIds.includes(id)) {
        lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => x !== id)
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          lineup.cells[id][inning] = ''
          lineup.lockedCells[id][inning] = false
        }
        lineup.lockedRows[id] = false
        lineup.battingOrder[id] = ''
      } else {
        lineup.availablePlayerIds.push(id)
      }
      return lineup
    })
  }

  function updatePreviewCell(gameId, playerId, inning, value) {
    updatePreview(gameId, (lineup) => {
      lineup.cells[pk(playerId)][inning] = value
      return lineup
    })
  }

  function updatePreviewBatting(gameId, playerId, value) {
    updatePreview(gameId, (lineup) => {
      lineup.battingOrder[pk(playerId)] = value
      return lineup
    })
  }

  function togglePreviewCellLock(gameId, playerId, inning) {
    updatePreview(gameId, (lineup) => {
      lineup.lockedCells[pk(playerId)][inning] = !lineup.lockedCells[pk(playerId)][inning]
      return lineup
    })
  }

  function togglePreviewRowLock(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      lineup.lockedRows[pk(playerId)] = !lineup.lockedRows[pk(playerId)]
      return lineup
    })
  }

  function addPreviewInning(gameId) {
    updatePreview(gameId, (lineup) => {
      const newInning = Number(lineup.innings || 0) + 1
      lineup.innings = newInning

      Object.keys(lineup.cells || {}).forEach((id) => {
        if (!lineup.cells[id]) lineup.cells[id] = {}
        if (!lineup.lockedCells[id]) lineup.lockedCells[id] = {}
        lineup.cells[id][newInning] = ''
        lineup.lockedCells[id][newInning] = false
      })

      return lineup
    })
  }

  function removePreviewInning(gameId, inningToRemove) {
    const confirmed = window.confirm(`Remove inning ${inningToRemove}?`)
    if (!confirmed) return

    updatePreview(gameId, (lineup) => {
      if (Number(lineup.innings || 0) <= 1) return lineup

      Object.keys(lineup.cells || {}).forEach((id) => {
        const nextCells = {}
        const nextLocks = {}
        let nextInning = 1

        for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
          if (inning === inningToRemove) continue
          nextCells[nextInning] = lineup.cells?.[id]?.[inning] || ''
          nextLocks[nextInning] = lineup.lockedCells?.[id]?.[inning] || false
          nextInning += 1
        }

        lineup.cells[id] = nextCells
        lineup.lockedCells[id] = nextLocks
      })

      lineup.innings = Number(lineup.innings || 0) - 1
      return lineup
    })
  }

  async function savePreview() {
  return
}

  function updateSavedLineup(gameId, updater) {
    setLineupsByGame((current) => {
      const existing = current[pk(gameId)]
      if (!existing) return current
      const next = updater(JSON.parse(JSON.stringify(existing)))
      return { ...current, [pk(gameId)]: next }
    })
  }

  function updateSavedCell(gameId, playerId, inning, value) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.cells[pk(playerId)][inning] = value
      autoSave(gameId, lineup)
      return lineup
    })
  }

  function updateSavedBatting(gameId, playerId, value) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.battingOrder[pk(playerId)] = value
      autoSave(gameId, lineup)
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
    const confirmed = window.confirm(`Remove inning ${inningToRemove}?`)
    if (!confirmed) return

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

  async function saveSavedLineup() {
  return
}

  async function toggleLineupLocked(gameId, nextLocked) {
  const currentLineup =
    optimizerPreviewByGame[pk(gameId)] ||
    lineupsByGame[pk(gameId)] ||
    blankLineup(players.map((p) => p.id), 6, activePlayerIds())

  const ok = await persistLineup(gameId, currentLineup, nextLocked)
  if (!ok) return
}
  
  function clearSavedLineup(gameId) {
    if (lineupLockedByGame[pk(gameId)]) {
      setAppError('Unlock the lineup before clearing it.')
      return
    }

    const confirmed = window.confirm('Clear the lineup for this game?')
    if (!confirmed) return

    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
  }

  function toggleSavedAvailable(gameId, playerId) {
    updateSavedLineup(gameId, (lineup) => {
      const id = pk(playerId)
      if (lineup.availablePlayerIds.includes(id)) {
        lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => x !== id)
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          lineup.cells[id][inning] = ''
          lineup.lockedCells[id][inning] = false
        }
        lineup.lockedRows[id] = false
        lineup.battingOrder[id] = ''
      } else {
        lineup.availablePlayerIds.push(id)
      }
      return lineup
    })
  }

  async function addAttendanceEvent() {
    const res = await supabase
      .from('attendance_events')
      .insert({
        team_id: TEAM_ID,
        event_date: attendanceDate || null,
        season_bucket: attendanceSeason,
        event_type: attendanceType,
        surface: attendanceSurface,
        title: attendanceTitle || null,
      })
      .select()
      .single()

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    const newEvent = res.data
    setAttendanceEvents((current) =>
      [...current, newEvent].sort((a, b) => `${a.event_date || ''}`.localeCompare(`${b.event_date || ''}`))
    )

    const inserts = activePlayers.map((player) => ({
      event_id: newEvent.id,
      player_id: player.id,
      attended: false,
    }))

    const recRes = await supabase.from('attendance_records').upsert(inserts, {
      onConflict: 'event_id,player_id',
    })
    if (recRes.error) {
      setAppError(recRes.error.message)
      return
    }

    setAttendanceByEvent((current) => ({
      ...current,
      [pk(newEvent.id)]: Object.fromEntries(activePlayers.map((p) => [pk(p.id), false])),
    }))

    setAttendanceDate('')
    setAttendanceSeason(ATTENDANCE_SEASON_OPTIONS[0])
    setAttendanceType(ATTENDANCE_TYPE_OPTIONS[0])
    setAttendanceSurface(ATTENDANCE_SURFACE_OPTIONS[0])
    setAttendanceTitle('')
  }

  async function toggleAttendance(eventId, playerId, checked) {
    setAttendanceByEvent((current) => ({
      ...current,
      [pk(eventId)]: {
        ...(current[pk(eventId)] || {}),
        [pk(playerId)]: checked,
      },
    }))

    const res = await supabase.from('attendance_records').upsert(
      {
        event_id: eventId,
        player_id: playerId,
        attended: checked,
      },
      { onConflict: 'event_id,player_id' }
    )

    if (res.error) setAppError(res.error.message)
  }

  async function updateAttendanceEventField(eventId, field, value) {
    setAttendanceEvents((current) =>
      current.map((event) => (pk(event.id) === pk(eventId) ? { ...event, [field]: value } : event))
    )

    const updates = {}
    if (field === 'event_date') updates.event_date = value || null
    if (field === 'season_bucket') updates.season_bucket = value
    if (field === 'event_type') updates.event_type = value
    if (field === 'surface') updates.surface = value
    if (field === 'title') updates.title = value || null

    const res = await supabase.from('attendance_events').update(updates).eq('id', eventId)
    if (res.error) setAppError(res.error.message)
  }

  async function deleteAttendanceEvent(eventId) {
    const confirmed = window.confirm('Delete this attendance event?')
    if (!confirmed) return

    const recDel = await supabase.from('attendance_records').delete().eq('event_id', eventId)
    if (recDel.error) {
      setAppError(recDel.error.message)
      return
    }

    const eventDel = await supabase.from('attendance_events').delete().eq('id', eventId)
    if (eventDel.error) {
      setAppError(eventDel.error.message)
      return
    }

    setAttendanceEvents((current) => current.filter((event) => pk(event.id) !== pk(eventId)))
    setAttendanceByEvent((current) => {
      const next = { ...current }
      delete next[pk(eventId)]
      return next
    })
  }

  function renderAttendancePage() {
    return (
      <AttendancePage
        attendanceDate={attendanceDate}
        setAttendanceDate={setAttendanceDate}
        attendanceSeason={attendanceSeason}
        setAttendanceSeason={setAttendanceSeason}
        attendanceType={attendanceType}
        setAttendanceType={setAttendanceType}
        attendanceSurface={attendanceSurface}
        setAttendanceSurface={setAttendanceSurface}
        attendanceTitle={attendanceTitle}
        setAttendanceTitle={setAttendanceTitle}
        addAttendanceEvent={addAttendanceEvent}
        ATTENDANCE_SEASON_OPTIONS={ATTENDANCE_SEASON_OPTIONS}
        ATTENDANCE_TYPE_OPTIONS={ATTENDANCE_TYPE_OPTIONS}
        ATTENDANCE_SURFACE_OPTIONS={ATTENDANCE_SURFACE_OPTIONS}
        activePlayers={activePlayers}
        filteredAttendanceEvents={filteredAttendanceEvents}
        updateAttendanceEventField={updateAttendanceEventField}
        attendanceByEvent={attendanceByEvent}
        toggleAttendance={toggleAttendance}
        deleteAttendanceEvent={deleteAttendanceEvent}
        attendanceTotals={attendanceTotals}
        attendanceBreakdownByPlayer={attendanceBreakdownByPlayer}
      />
    )
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />

      <main className="main-content">
        {appError && page !== 'games' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ color: '#b91c1c', margin: 0 }}>Error: {appError}</p>
          </div>
        )}

        {page === 'players' && (
          <PlayersPage
            newPlayerName={newPlayerName}
            setNewPlayerName={setNewPlayerName}
            newPlayerNumber={newPlayerNumber}
            setNewPlayerNumber={setNewPlayerNumber}
            newPlayerActive={newPlayerActive}
            setNewPlayerActive={setNewPlayerActive}
            addPlayer={addPlayer}
            sortedPlayers={sortedPlayers}
            playerSort={playerSort}
            setPlayerSort={setPlayerSort}
            nextSort={nextSort}
            updatePlayerLocal={updatePlayerLocal}
            upsertPlayer={upsertPlayer}
            deletePlayer={deletePlayer}
          />
        )}

        {page === 'positioning-priority' && (
          <PositioningPriorityPage
            activePriorityRows={activePriorityRows}
            prioritySort={prioritySort}
            setPrioritySort={setPrioritySort}
            nextSort={nextSort}
            PRIORITY_POSITIONS={PRIORITY_POSITIONS}
            updatePriorityLocal={updatePriorityLocal}
            persistPriority={persistPriority}
            priorityFooter={priorityFooter}
            allowedRows={allowedRows}
            allowedSort={allowedSort}
            setAllowedSort={setAllowedSort}
            ALLOWED_POSITIONS={ALLOWED_POSITIONS}
            fitByPlayer={fitByPlayer}
            priorityByPlayer={priorityByPlayer}
            updateFitLocal={updateFitLocal}
            persistFitTier={persistFitTier}
          />
        )}

        {page === 'games' && (
          <GamesPage
            loadAll={loadAll}
            appError={appError}
            loading={loading}
            newGameDate={newGameDate}
            setNewGameDate={setNewGameDate}
            newGameOpponent={newGameOpponent}
            setNewGameOpponent={setNewGameOpponent}
            newGameType={newGameType}
            setNewGameType={setNewGameType}
            addGameFromGames={addGameFromGames}
            sortedGames={sortedGames}
            gameSort={gameSort}
            setGameSort={setGameSort}
            updateGameField={updateGameField}
            deleteGame={deleteGame}
            setSelectedGameId={setSelectedGameId}
            setPage={setPage}
          />
        )}

        {page === 'game-detail' && (
          <GameDetailPage
            selectedGame={selectedGame}
            selectedLineup={selectedLineup}
            selectedLocked={selectedLocked}
            activePlayers={activePlayers}
            activePlayerIds={activePlayerIds}
            games={games}
            selectedGameId={selectedGameId}
            setSelectedGameId={setSelectedGameId}
            setPage={setPage}
            saveSavedLineup={saveSavedLineup}
            toggleLineupLocked={toggleLineupLocked}
            clearSavedLineup={clearSavedLineup}
            addSavedInning={addSavedInning}
            removeSavedInning={removeSavedInning}
            toggleSavedAvailable={toggleSavedAvailable}
            fitByPlayer={fitByPlayer}
            LineupGrid={LineupGrid}
            updateSavedCell={updateSavedCell}
            updateSavedBatting={updateSavedBatting}
          />
        )}

        {page === 'lineup-setter' && (
  <LineupSetterPage
    optimizerFocusLineup={optimizerFocusLineup}
    optimizerFocusGame={optimizerFocusGame}
    optimizerFocusLocked={optimizerFocusLocked}
    toggleLineupLocked={toggleLineupLocked}
    optimizerExistingGameId={optimizerExistingGameId}
    setOptimizerExistingGameId={setOptimizerExistingGameId}
    games={games}
    addExistingGameToBatch={addExistingGameToBatch}
    optimizerNewDate={optimizerNewDate}
    setOptimizerNewDate={setOptimizerNewDate}
    optimizerNewOpponent={optimizerNewOpponent}
    setOptimizerNewOpponent={setOptimizerNewOpponent}
    optimizerNewType={optimizerNewType}
    setOptimizerNewType={setOptimizerNewType}
    GAME_TYPES={GAME_TYPES}
    addGameFromOptimizer={addGameFromOptimizer}
    runOptimizeCurrent={runOptimizeCurrent}
    optimizerFocusGameId={optimizerFocusGameId}
    runOptimizeAll={runOptimizeAll}
    optimizerBatchGames={optimizerBatchGames}
    optimizerPreviewByGame={optimizerPreviewByGame}
    lineupsByGame={lineupsByGame}
    activePlayers={activePlayers}
    activePlayerIds={activePlayerIds}
    requiredOutsForGame={requiredOutsForGame}
    setOptimizerFocusGameId={setOptimizerFocusGameId}
    savePreview={savePreview}
    removeBatchGame={removeBatchGame}
    addPreviewInning={addPreviewInning}
    removePreviewInning={removePreviewInning}
    togglePreviewAvailable={togglePreviewAvailable}
    LineupGrid={LineupGrid}
    fitByPlayer={fitByPlayer}
    updatePreviewCell={updatePreviewCell}
    updatePreviewBatting={updatePreviewBatting}
    togglePreviewCellLock={togglePreviewCellLock}
    togglePreviewRowLock={togglePreviewRowLock}
    lockedLineupsOnly={lockedLineupsOnly}
    ytdBeforeTotals={ytdBeforeTotals}
    currentBatchTotals={currentBatchTotals}
    ytdAfterTotals={ytdAfterTotals}
    trackingSort={trackingSort}
    setTrackingSort={setTrackingSort}
    TrackingTable={TrackingTable}
    blankLineup={blankLineup}
    pk={pk}
    inningStatus={inningStatus}
  />
)}

        {page === 'tracking' && (
          <TrackingPage
            trackingLockedLineups={trackingLockedLineups}
            trackingTotals={trackingTotals}
            activePlayers={activePlayers}
            trackingSort={trackingSort}
            setTrackingSort={setTrackingSort}
            TrackingTable={TrackingTable}
            battingRows={battingRows}
            sitSummary={sitSummary}
            sitByPlayer={sitByPlayer}
            gamesWithLineups={gamesWithLineups}
            VerticalHeader={VerticalHeader}
            trackingPlayerId={trackingPlayerId}
            setTrackingPlayerId={setTrackingPlayerId}
            selectedPlayerPositions={selectedPlayerPositions}
            trackingPriorityRows={trackingPriorityRows}
            pk={pk}
          />
        )}

        {page === 'attendance' && renderAttendancePage()}
      </main>
    </div>
  )
}
