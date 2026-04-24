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
import AdminPage from './Pages/AdminPage'
import {
  TEAM_ID,
  ATTENDANCE_SEASON_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
  ATTENDANCE_SURFACE_OPTIONS,
} from './lib/constants'

function dbReady() {
  return Boolean(supabase)
}

function buildDefaultOption(label, category, sortOrder = 999) {
  return {
    id: `${category}-${label}`,
    category,
    label,
    value: label,
    sort_order: sortOrder,
    is_active: true,
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
  const [optimizerPlanSitOutTargets, setOptimizerPlanSitOutTargets] = useState({})

  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [newGameType, setNewGameType] = useState('')
  const [newGameSeason, setNewGameSeason] = useState('')

  const [optimizerNewDate, setOptimizerNewDate] = useState('')
  const [optimizerNewOpponent, setOptimizerNewOpponent] = useState('')
  const [optimizerNewType, setOptimizerNewType] = useState('')
  const [optimizerNewSeason, setOptimizerNewSeason] = useState('')

  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerNumber, setNewPlayerNumber] = useState('')
  const [newPlayerActive, setNewPlayerActive] = useState(true)

  const [playerSort, setPlayerSort] = useState({ key: 'name', direction: 'asc' })
  const [gameSort, setGameSort] = useState({ key: 'date', direction: 'desc' })
  const [prioritySort, setPrioritySort] = useState({ key: 'name', direction: 'asc' })
  const [allowedSort, setAllowedSort] = useState({ key: 'name', direction: 'asc' })
  const [trackingSort, setTrackingSort] = useState({ key: 'name', direction: 'asc' })
  const [attendanceSort, setAttendanceSort] = useState({ key: 'event_date', direction: 'asc' })

  const [optimizerImportSourceGameId, setOptimizerImportSourceGameId] = useState('')
  const [gameDetailImportSourceGameId, setGameDetailImportSourceGameId] = useState('')

  const [appOptions, setAppOptions] = useState({
    season: [],
    game_type: [],
    status: [],
  })

  const [trackingPlayerId, setTrackingPlayerId] = useState('')

const [trackingFilters, setTrackingFilters] = useState(() => {
  try {
    const saved = sessionStorage.getItem('softball-lineup-tracking-filters')
    if (saved) {
      return JSON.parse(saved)
    }
  } catch (error) {
    console.error('Failed to load tracking filters from sessionStorage', error)
  }

  return {
    seasons: [],
    gameTypes: [],
    lineupStates: [],
    dateFrom: '',
    dateTo: '',
  }
})
  
  const [attendanceDate, setAttendanceDate] = useState('')
  const [attendanceSeason, setAttendanceSeason] = useState(ATTENDANCE_SEASON_OPTIONS[0])
  const [attendanceType, setAttendanceType] = useState(ATTENDANCE_TYPE_OPTIONS[0])
  const [attendanceSurface, setAttendanceSurface] = useState(ATTENDANCE_SURFACE_OPTIONS[0])
  const [attendanceTitle, setAttendanceTitle] = useState('')

  const activePlayers = useMemo(() => players.filter((p) => p.active !== false), [players])

  function activePlayerIds() {
    return activePlayers.map((p) => pk(p.id))
  }

function getImportableGamesForGame(currentGameId) {
  return [...games]
    .filter((game) => pk(game.id) !== pk(currentGameId))
    .filter((game) => lineupsByGame[pk(game.id)])
    .sort((a, b) => compareGamesAsc(b, a, pk))
}

function toggleSavedBattingLock(gameId, playerId) {
  updateSavedLineup(gameId, (lineup) => {
    if (!lineup.lockedBattingOrder) lineup.lockedBattingOrder = {}
    lineup.lockedBattingOrder[pk(playerId)] =
      !lineup.lockedBattingOrder[pk(playerId)]

    autoSave(gameId, lineup)
    return lineup
  })
}

  function toggleSavedAllBattingLock(gameId) {
  updateSavedLineup(gameId, (lineup) => {
    const allLocked = Object.values(lineup.lockedBattingOrder || {}).every(Boolean)

    Object.keys(lineup.battingOrder || {}).forEach((id) => {
      lineup.lockedBattingOrder[id] = !allLocked
    })

    autoSave(gameId, lineup)
    return lineup
  })
}
  
function importLineupToPreview(targetGameId, sourceGameId) {
  if (!targetGameId || !sourceGameId) return

  const sourceLineup = lineupsByGame[pk(sourceGameId)] || optimizerPreviewByGame[pk(sourceGameId)]
  if (!sourceLineup) {
    setAppError('Selected source game does not have a lineup.')
    return
  }

  const confirmed = window.confirm(
    'Are you sure you want to import this lineup? This will overwrite the current game lineup.'
  )
  if (!confirmed) return

  const copied = JSON.parse(JSON.stringify(sourceLineup))

  setOptimizerPreviewByGame((current) => ({
    ...current,
    [pk(targetGameId)]: copied,
  }))

  persistLineup(targetGameId, copied)
}

function importLineupToSaved(targetGameId, sourceGameId) {
  if (!targetGameId || !sourceGameId) return

  const sourceLineup = lineupsByGame[pk(sourceGameId)] || optimizerPreviewByGame[pk(sourceGameId)]
  if (!sourceLineup) {
    setAppError('Selected source game does not have a lineup.')
    return
  }

  const confirmed = window.confirm(
    'Are you sure you want to import this lineup? This will overwrite the current game lineup.'
  )
  if (!confirmed) return

  const copied = JSON.parse(JSON.stringify(sourceLineup))

  setLineupsByGame((current) => ({
    ...current,
    [pk(targetGameId)]: copied,
  }))

  autoSave(targetGameId, copied)
}

function clearLineupContents(lineup) {
  const next = JSON.parse(JSON.stringify(lineup))

  Object.keys(next.cells || {}).forEach((playerId) => {
    for (let inning = 1; inning <= Number(next.innings || 0); inning += 1) {
      next.cells[playerId][inning] = ''
      if (!next.lockedCells[playerId]) next.lockedCells[playerId] = {}
      next.lockedCells[playerId][inning] = false
    }
  })

  Object.keys(next.battingOrder || {}).forEach((playerId) => {
    next.battingOrder[playerId] = ''
  })

  Object.keys(next.lockedRows || {}).forEach((playerId) => {
    next.lockedRows[playerId] = false
  })

  return next
}

async function clearPreviewLineup(gameId) {
  if (!gameId) return

  if (lineupLockedByGame[pk(gameId)]) {
    setAppError('Unlock the lineup before clearing it.')
    return
  }

  const confirmed = window.confirm('Clear the lineup for this game?')
  if (!confirmed) return

  const source =
    optimizerPreviewByGame[pk(gameId)] ||
    lineupsByGame[pk(gameId)]

  if (!source) return

  const cleared = clearLineupContents(source)

  setOptimizerPreviewByGame((current) => ({
    ...current,
    [pk(gameId)]: cleared,
  }))

  await persistLineup(gameId, cleared)
}
  
function isCompleteLineup(lineup) {
  if (!lineup) return false

  const innings = lineup.innings || 0

  for (let inning = 1; inning <= innings; inning++) {
    const assigned = Object.values(lineup.cells || {}).filter(
      (p) => p?.[inning]
    )
    if (assigned.length === 0) return false
  }

  return true
}
  
  async function loadAppOptions() {
    const res = await supabase
      .from('app_options')
      .select('id, category, value, label, sort_order, is_active, is_default')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    const next = { season: [], game_type: [], status: [] }

    ;(res.data || []).forEach((row) => {
      if (!next[row.category]) next[row.category] = []
      next[row.category].push(row)
    })

    setAppOptions(next)
  }

  async function addAppOption(option) {
    const res = await supabase.from('app_options').insert(option)
    if (res.error) {
      setAppError(res.error.message)
      return
    }
    await loadAppOptions()
  }

  async function updateAppOption(id, updates) {
    const res = await supabase.from('app_options').update(updates).eq('id', id)
    if (res.error) {
      setAppError(res.error.message)
      return
    }
    await loadAppOptions()
  }

  const seasonOptions = useMemo(() => {
    const saved = (appOptions.season || []).filter((x) => x.is_active)
    if (saved.length) return saved

    return [
      buildDefaultOption('Fall', 'season', 1),
      buildDefaultOption('Winter', 'season', 2),
      buildDefaultOption('Spring', 'season', 3),
    ]
  }, [appOptions])

  const gameTypeOptions = useMemo(() => {
    const saved = (appOptions.game_type || []).filter((x) => x.is_active)
    if (saved.length) return saved

    return (GAME_TYPES || []).map((label, idx) =>
      buildDefaultOption(label, 'game_type', idx + 1)
    )
  }, [appOptions])

  
  const statusOptions = useMemo(() => {
    const saved = (appOptions.status || []).filter((x) => x.is_active)
    if (saved.length) return saved

    return [
      buildDefaultOption('Planned', 'status', 1),
      buildDefaultOption('Complete', 'status', 2),
      buildDefaultOption('Cancelled', 'status', 3),
    ]
  }, [appOptions])

  const defaultSeasonOption = useMemo(
    () => (seasonOptions || []).find((x) => x.is_default),
    [seasonOptions]
  )

  const defaultGameTypeOption = useMemo(
    () => (gameTypeOptions || []).find((x) => x.is_default),
    [gameTypeOptions]
  )

  const defaultStatusOption = useMemo(
    () => (statusOptions || []).find((x) => x.is_default),
    [statusOptions]
  )


  function getGameLineupState(game) {
    if (lineupLockedByGame[pk(game.id)]) return 'Locked'
    if (lineupsByGame[pk(game.id)]) return 'Saved'
    return 'Empty'
  }

  function gameMatchesFilters(game, filters) {
  const seasons = filters?.seasons || []
  const gameTypes = filters?.gameTypes || []
  const lineupStates = filters?.lineupStates || []
  const dateFrom = filters?.dateFrom || ''
  const dateTo = filters?.dateTo || ''

  const gameDate = game?.date || ''

  const seasonMatch = !seasons.length || seasons.includes(game.season || '')
  const typeMatch = !gameTypes.length || gameTypes.includes(game.game_type || '')
  const lineupStateMatch =
    !lineupStates.length || lineupStates.includes(getGameLineupState(game))

  const fromMatch = !dateFrom || (gameDate && gameDate >= dateFrom)
  const toMatch = !dateTo || (gameDate && gameDate <= dateTo)

  return seasonMatch && typeMatch && lineupStateMatch && fromMatch && toMatch
}
  
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
    persistLineup(gameId, lineup)
  }

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
        .select('id, game_date, opponent, innings, status, game_type, game_order, season')
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
        game_type: row.game_type || '',
        season: row.season || '',
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

      await loadAppOptions()

      if (loadedGames.length) {
  const latestGame = [...loadedGames].sort((a, b) => compareGamesAsc(a, b, pk)).at(-1)

  if (latestGame) {
    setSelectedGameId(pk(latestGame.id))
    setOptimizerExistingGameId(pk(latestGame.id))
    setOptimizerFocusGameId(pk(latestGame.id))
  }
}
    } catch (error) {
      setAppError(error.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
  try {
    sessionStorage.setItem(
      'softball-lineup-tracking-filters',
      JSON.stringify(trackingFilters)
    )
  } catch (error) {
    console.error('Failed to save tracking filters to sessionStorage', error)
  }
}, [trackingFilters])

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    if (!newGameSeason && defaultSeasonOption) {
      setNewGameSeason(defaultSeasonOption.value || defaultSeasonOption.label || '')
    }
  }, [defaultSeasonOption, newGameSeason])

  useEffect(() => {
    if (!newGameType && defaultGameTypeOption) {
      setNewGameType(defaultGameTypeOption.value || defaultGameTypeOption.label || '')
    }
  }, [defaultGameTypeOption, newGameType])

  useEffect(() => {
    if (!optimizerNewSeason && defaultSeasonOption) {
      setOptimizerNewSeason(defaultSeasonOption.value || defaultSeasonOption.label || '')
    }
  }, [defaultSeasonOption, optimizerNewSeason])

  useEffect(() => {
    if (!optimizerNewType && defaultGameTypeOption) {
      setOptimizerNewType(defaultGameTypeOption.value || defaultGameTypeOption.label || '')
    }
  }, [defaultGameTypeOption, optimizerNewType])

useEffect(() => {
  if (!games.length) return

  const latestGame = [...games].sort((a, b) => compareGamesAsc(a, b, pk)).at(-1)
  if (!latestGame) return

  if (!selectedGameId) {
    setSelectedGameId(pk(latestGame.id))
  }

  if (!optimizerExistingGameId) {
    setOptimizerExistingGameId(pk(latestGame.id))
  }

  if (!optimizerFocusGameId) {
    setOptimizerFocusGameId(pk(latestGame.id))
  }
}, [games, selectedGameId, optimizerExistingGameId, optimizerFocusGameId])
  
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

  const orderedGamesDesc = useMemo(() => {
  return [...orderedGamesAsc].reverse()
  }, [orderedGamesAsc])
  
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

  const optimizerFocusLocked = useMemo(
    () => (optimizerFocusGame ? lineupLockedByGame[pk(optimizerFocusGame.id)] === true : false),
    [optimizerFocusGame, lineupLockedByGame]
  )

  const optimizerFocusLineup = useMemo(
    () => optimizerPreviewByGame[pk(optimizerFocusGameId)] || null,
    [optimizerPreviewByGame, optimizerFocusGameId]
  )

const optimizerImportableGames = useMemo(() => {
  return optimizerFocusGame ? getImportableGamesForGame(optimizerFocusGame.id) : []
}, [optimizerFocusGame, games, lineupsByGame])

const gameDetailImportableGames = useMemo(() => {
  return selectedGame ? getImportableGamesForGame(selectedGame.id) : []
}, [selectedGame, games, lineupsByGame])

  
  const lineupSetterFilteredGames = useMemo(() => {
  return orderedGamesAsc.filter((game) => gameMatchesFilters(game, trackingFilters))
}, [orderedGamesAsc, trackingFilters])

const lineupSetterFilteredGamesExcludingBatch = useMemo(() => {
  return lineupSetterFilteredGames.filter(
    (game) => !optimizerBatchGameIds.includes(pk(game.id))
  )
}, [lineupSetterFilteredGames, optimizerBatchGameIds])

const lineupSetterFilteredGamesWithLineups = useMemo(() => {
  return lineupSetterFilteredGamesExcludingBatch.filter(
    (game) => lineupsByGame[pk(game.id)]
  )
}, [lineupSetterFilteredGamesExcludingBatch, lineupsByGame])
  
  const lineupSetterFilteredLineups = useMemo(() => {
    return lineupSetterFilteredGamesWithLineups
      .map((game) => lineupsByGame[pk(game.id)])
      .filter(Boolean)
  }, [lineupSetterFilteredGamesWithLineups, lineupsByGame])

  const lineupSetterFilteredTotals = useMemo(
    () => computeTotals(lineupSetterFilteredLineups, players),
    [lineupSetterFilteredLineups, players]
  )

  const lineupSetterSitSummary = useMemo(
    () =>
      buildSitOutSummary(
        lineupSetterFilteredGamesWithLineups,
        lineupsByGame,
        activePlayers,
        pk
      ),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame, activePlayers]
  )

  const lineupSetterSitByPlayer = useMemo(
    () =>
      buildPlayerSitOuts(
        lineupSetterFilteredGamesWithLineups,
        lineupsByGame,
        activePlayers,
        pk
      ),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame, activePlayers]
  )

  const lineupSetterComputedSitRows = useMemo(() => {
    const avgByGame = (lineupSetterSitSummary || []).map((g) => {
      const value = Number(g?.avgSit)
      return Number.isNaN(value) ? null : value
    })

    return (lineupSetterSitByPlayer || []).map((row) => {
      let runningTotal = 0

      const deltaPerGame = (row.perGame || []).map((value, index) => {
        if (value === 'x' || value === '' || value === null || value === undefined) return 'x'

        const playerOuts = Number(value)
        const avgSit = avgByGame[index]

        if (Number.isNaN(playerOuts) || avgSit === null || Number.isNaN(avgSit)) return 'x'

        return Number((avgSit - playerOuts).toFixed(2))
      })

      const running = deltaPerGame.map((value) => {
        if (value === 'x') return 'x'
        runningTotal = Number((runningTotal + Number(value)).toFixed(2))
        return runningTotal
      })

      return {
        ...row,
        deltaPerGame,
        running,
        sitOutRunningTotal:
          running.length && running[running.length - 1] !== 'x'
            ? running[running.length - 1]
            : 0,
      }
    })
  }, [lineupSetterSitByPlayer, lineupSetterSitSummary])
  
  const currentBatchTotals = useMemo(
  () =>
    computeTotals(
      Object.values(optimizerPreviewByGame).filter(isCompleteLineup),
      players
    ),
  [optimizerPreviewByGame, players]
)

  const lineupSetterFutureTotals = useMemo(
    () => addTotals(lineupSetterFilteredTotals, currentBatchTotals, players),
    [lineupSetterFilteredTotals, currentBatchTotals, players]
  )

    const lineupSetterFutureGamesWithLineups = useMemo(() => {
    const previewGames = optimizerBatchGames.filter(
      (game) => optimizerPreviewByGame[pk(game.id)]
    )

    return [...lineupSetterFilteredGamesWithLineups, ...previewGames]
  }, [
    lineupSetterFilteredGamesWithLineups,
    optimizerBatchGames,
    optimizerPreviewByGame,
  ])

  const lineupSetterFutureLineupsByGame = useMemo(() => {
    const merged = { ...lineupsByGame }

    Object.entries(optimizerPreviewByGame || {}).forEach(([gameId, lineup]) => {
      if (lineup) merged[pk(gameId)] = lineup
    })

    return merged
  }, [lineupsByGame, optimizerPreviewByGame])

  const lineupSetterFutureSitSummary = useMemo(
    () =>
      buildSitOutSummary(
        lineupSetterFutureGamesWithLineups,
        lineupSetterFutureLineupsByGame,
        activePlayers,
        pk
      ),
    [
      lineupSetterFutureGamesWithLineups,
      lineupSetterFutureLineupsByGame,
      activePlayers,
    ]
  )

  const lineupSetterFutureSitByPlayer = useMemo(
    () =>
      buildPlayerSitOuts(
        lineupSetterFutureGamesWithLineups,
        lineupSetterFutureLineupsByGame,
        activePlayers,
        pk
      ),
    [
      lineupSetterFutureGamesWithLineups,
      lineupSetterFutureLineupsByGame,
      activePlayers,
    ]
  )

  const lineupSetterFutureComputedSitRows = useMemo(() => {
    const avgByGame = (lineupSetterFutureSitSummary || []).map((g) => {
      const value = Number(g?.avgSit)
      return Number.isNaN(value) ? null : value
    })

    return (lineupSetterFutureSitByPlayer || []).map((row) => {
      let runningTotal = 0

      const deltaPerGame = (row.perGame || []).map((value, index) => {
        if (value === 'x' || value === '' || value === null || value === undefined) return 'x'

        const playerOuts = Number(value)
        const avgSit = avgByGame[index]

        if (Number.isNaN(playerOuts) || avgSit === null || Number.isNaN(avgSit)) return 'x'

        return Number((avgSit - playerOuts).toFixed(2))
      })

      const running = deltaPerGame.map((value) => {
        if (value === 'x') return 'x'
        runningTotal = Number((runningTotal + Number(value)).toFixed(2))
        return runningTotal
      })

      return {
        ...row,
        deltaPerGame,
        running,
        sitOutRunningTotal:
          running.length && running[running.length - 1] !== 'x'
            ? running[running.length - 1]
            : 0,
      }
    })
  }, [lineupSetterFutureSitByPlayer, lineupSetterFutureSitSummary])
  
  const lockedLineupsOnly = useMemo(() => {
    return Object.entries(lineupsByGame)
      .filter(([gameId]) => lineupLockedByGame[pk(gameId)] === true)
      .map(([, lineup]) => lineup)
  }, [lineupsByGame, lineupLockedByGame])

  const ytdBeforeTotals = useMemo(
    () => computeTotals(lockedLineupsOnly, players),
    [lockedLineupsOnly, players]
  )

  const ytdAfterTotals = useMemo(
    () => addTotals(ytdBeforeTotals, currentBatchTotals, players),
    [ytdBeforeTotals, currentBatchTotals, players]
  )

  const filteredTrackingGames = useMemo(() => {
    return orderedGamesAsc.filter((game) => gameMatchesFilters(game, trackingFilters))
  }, [orderedGamesAsc, trackingFilters])

  const filteredTrackingGamesWithLineups = useMemo(() => {
    return filteredTrackingGames.filter((game) => lineupsByGame[pk(game.id)])
  }, [filteredTrackingGames, lineupsByGame])

  const filteredTrackingLineups = useMemo(() => {
    return filteredTrackingGamesWithLineups
      .map((game) => lineupsByGame[pk(game.id)])
      .filter(Boolean)
  }, [filteredTrackingGamesWithLineups, lineupsByGame])

  const battingRows = useMemo(
    () =>
      buildBattingOrderMatrix(
        filteredTrackingGamesWithLineups,
        lineupsByGame,
        activePlayers,
        pk
      ),
    [filteredTrackingGamesWithLineups, lineupsByGame, activePlayers]
  )

  const sitSummary = useMemo(
    () =>
      buildSitOutSummary(
        filteredTrackingGamesWithLineups,
        lineupsByGame,
        activePlayers,
        pk
      ),
    [filteredTrackingGamesWithLineups, lineupsByGame, activePlayers]
  )

  const sitByPlayer = useMemo(
    () =>
      buildPlayerSitOuts(
        filteredTrackingGamesWithLineups,
        lineupsByGame,
        activePlayers,
        pk
      ),
    [filteredTrackingGamesWithLineups, lineupsByGame, activePlayers]
  )

  const trackingTotals = useMemo(() => {
    return computeTotals(filteredTrackingLineups, players)
  }, [filteredTrackingLineups, players])

  const selectedPlayerPositions = useMemo(() => {
    if (!trackingPlayerId) return []
    return buildPositionByPlayer(
      filteredTrackingGamesWithLineups,
      lineupsByGame,
      pk(trackingPlayerId),
      pk
    )
  }, [trackingPlayerId, filteredTrackingGamesWithLineups, lineupsByGame])

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

    const trackingPriorityByPositionRows = useMemo(() => {
  const positionTotals = {
    P: activePlayers.reduce(
      (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.P || 0),
      0
    ),
    C: activePlayers.reduce(
      (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.C || 0),
      0
    ),
    '1B': activePlayers.reduce(
      (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.['1B'] || 0),
      0
    ),
    '2B': activePlayers.reduce(
      (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.['2B'] || 0),
      0
    ),
    '3B': activePlayers.reduce(
      (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.['3B'] || 0),
      0
    ),
    SS: activePlayers.reduce(
      (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.SS || 0),
      0
    ),
    OF: activePlayers.reduce(
      (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.OF || 0),
      0
    ),
  }

  const actPctByPosition = (playerTotal, positionKey) => {
    const numer = Number(playerTotal || 0)
    const denom = Number(positionTotals[positionKey] || 0)
    if (!numer || !denom) return ''
    return Number(((numer / denom) * 100).toFixed(1))
  }

  return activePlayers.map((player) => {
    const playerId = pk(player.id)
    const totals = trackingTotals[playerId] || {}
    const priority = priorityByPlayer[playerId] || {}

    return {
      playerId,
      name: player.name,
      fieldTotal: totals.fieldTotal || 0,

      targP: priority.P?.priority_pct || '',
      actP: actPctByPosition(totals.P, 'P'),

      targC: priority.C?.priority_pct || '',
      actC: actPctByPosition(totals.C, 'C'),

      targ1B: priority['1B']?.priority_pct || '',
      act1B: actPctByPosition(totals['1B'], '1B'),

      targ2B: priority['2B']?.priority_pct || '',
      act2B: actPctByPosition(totals['2B'], '2B'),

      targ3B: priority['3B']?.priority_pct || '',
      act3B: actPctByPosition(totals['3B'], '3B'),

      targSS: priority.SS?.priority_pct || '',
      actSS: actPctByPosition(totals.SS, 'SS'),

      targOF: priority.OF?.priority_pct || '',
      actOF: actPctByPosition(totals.OF, 'OF'),
    }
  })
}, [activePlayers, trackingTotals, priorityByPlayer, pk])

  
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

  async function addGame(date, opponent, gameType, season) {
    const nextOrder = getNextGameOrder(games)

    const res = await supabase
      .from('games')
      .insert({
        team_id: TEAM_ID,
        game_date: date || null,
        opponent: opponent || null,
        innings: 6,
        status:
  defaultStatusOption?.value ||
  defaultStatusOption?.label ||
  'Planned',
        game_type: gameType || GAME_TYPES[0],
        season: season || null,
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
      game_type: res.data.game_type || '',
      season: res.data.season || '',
      game_order: Number(res.data.game_order || nextOrder),
    }

    setGames((current) => [...current, game])
    return game
  }

  async function addGameFromGames() {
    const game = await addGame(newGameDate, newGameOpponent, newGameType, newGameSeason)
    if (game) {
      setNewGameDate('')
      setNewGameOpponent('')
      setNewGameType('')
      setNewGameSeason('')
      setSelectedGameId(pk(game.id))
    }
  }

  async function addGameFromOptimizer() {
    const game = await addGame(
      optimizerNewDate,
      optimizerNewOpponent,
      optimizerNewType,
      optimizerNewSeason
    )

    if (game) {
      setOptimizerNewDate('')
      setOptimizerNewOpponent('')
      setOptimizerNewType('')
      setOptimizerNewSeason('')
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
    if (field === 'game_type') updates.game_type = value || null
    if (field === 'season') updates.season = value || null
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

      if (updateRes.error) {
        setAppError(updateRes.error.message)
        return
      }

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
        pk(player.id) === pk(playerId) ? { ...player, [field]: value } : player
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

    let rollingTotals = JSON.parse(JSON.stringify(lineupSetterFilteredTotals))
    const next = {}

    const orderedGames = [...optimizerBatchGames].sort((a, b) => {
      const aKey = `${a.date || ''}-${String(a.game_order || 0).padStart(2, '0')}-${a.id}`
      const bKey = `${b.date || ''}-${String(b.game_order || 0).padStart(2, '0')}-${b.id}`
      return aKey.localeCompare(bKey)
    })

    const planAssignedOuts = {}
    players.forEach((player) => {
      planAssignedOuts[pk(player.id)] = 0
    })

    orderedGames.forEach((game) => {
      const gameId = pk(game.id)

      if (lineupLockedByGame[gameId]) {
        const lockedLineup = lineupsByGame[gameId]
        if (lockedLineup) {
          next[gameId] = lockedLineup
          rollingTotals = addTotals(
            rollingTotals,
            computeTotals([lockedLineup], players),
            players
          )

          players.forEach((player) => {
            const id = pk(player.id)
            const outCount = Object.values(lockedLineup?.cells?.[id] || {}).filter(
              (value) => value === 'Out'
            ).length
            planAssignedOuts[id] = Number(planAssignedOuts[id] || 0) + outCount
          })
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
        planSitOutTargets: optimizerPlanSitOutTargets,
        batchCurrentOuts: planAssignedOuts,
        existingPlanLineups: Object.values(next).filter(Boolean),
      })

      next[gameId] = optimized

      players.forEach((player) => {
        const id = pk(player.id)
        const outCount = Object.values(optimized?.cells?.[id] || {}).filter(
          (value) => value === 'Out'
        ).length
        planAssignedOuts[id] = Number(planAssignedOuts[id] || 0) + outCount
      })

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
  lineupSetterFilteredTotals,
  computeTotals(otherPreviewLineups, players),
  players
)

    const source =
      optimizerPreviewByGame[pk(game.id)] ||
      lineupsByGame[pk(game.id)] ||
      blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

    const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
    if (!availableIds.length) return

    const batchCurrentOuts = {}
    players.forEach((player) => {
      const id = pk(player.id)
      batchCurrentOuts[id] = 0
    })

    otherPreviewLineups.forEach((lineup) => {
      players.forEach((player) => {
        const id = pk(player.id)
        const outCount = Object.values(lineup?.cells?.[id] || {}).filter(
          (value) => value === 'Out'
        ).length
        batchCurrentOuts[id] = Number(batchCurrentOuts[id] || 0) + outCount
      })
    })
      
        const rebuilt = buildOptimizedLineup({
      game: { ...game, innings: Number(source?.innings || game.innings || 6) },
      players,
      availablePlayerIds: availableIds,
      sourceLineup: source,
      totalsBefore: totalsBeforeThisGame,
      priorityMap: priorityByPlayer,
      fitMap: fitByPlayer,
      planSitOutTargets: optimizerPlanSitOutTargets,
      batchCurrentOuts,
      existingPlanLineups: otherPreviewLineups.filter(Boolean),
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

function togglePreviewBattingLock(gameId, playerId) {
  updatePreview(gameId, (lineup) => {
    if (!lineup.lockedBattingOrder) lineup.lockedBattingOrder = {}
    lineup.lockedBattingOrder[pk(playerId)] = !lineup.lockedBattingOrder[pk(playerId)]
    return lineup
  })
}

  function togglePreviewAllBattingLock(gameId) {
  updatePreview(gameId, (lineup) => {
    if (!lineup.lockedBattingOrder) lineup.lockedBattingOrder = {}

    const ids = Object.keys(lineup.battingOrder || {})
    const allLocked = ids.length > 0 && ids.every((id) => lineup.lockedBattingOrder[id] === true)

    ids.forEach((id) => {
      lineup.lockedBattingOrder[id] = !allLocked
    })

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

  function togglePreviewInningLock(gameId, inning) {
  updatePreview(gameId, (lineup) => {
    if (!lineup.lockedInnings) lineup.lockedInnings = {}
    lineup.lockedInnings[inning] = !(lineup.lockedInnings[inning] === true)
    return lineup
  })
}
  
function toggleSavedInningLock(gameId, inning) {
  updateSavedLineup(gameId, (lineup) => {
    if (!lineup.lockedInnings) lineup.lockedInnings = {}
    lineup.lockedInnings[inning] = !(lineup.lockedInnings[inning] === true)

    autoSave(gameId, lineup)
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
      
      if (!lineup.lockedInnings) lineup.lockedInnings = {}
      lineup.lockedInnings[newInning] = false
      
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

const nextLockedInnings = {}
let nextInningIndex = 1

for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
  if (inning === inningToRemove) continue
  nextLockedInnings[nextInningIndex] = lineup.lockedInnings?.[inning] === true
  nextInningIndex += 1
}

lineup.lockedInnings = nextLockedInnings
      
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

    if (!lineup.lockedInnings) lineup.lockedInnings = {}
    lineup.lockedInnings[newInning] = false

    autoSave(gameId, lineup)
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

    const newLockedInnings = {}
    let idx = 1

    for (let inning = 1; inning <= lineup.innings; inning += 1) {
      if (inning === inningToRemove) continue
      newLockedInnings[idx] = lineup.lockedInnings?.[inning] === true
      idx += 1
    }

    lineup.lockedInnings = newLockedInnings
    lineup.innings -= 1

    autoSave(gameId, lineup)
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

  function toggleSavedCellLock(gameId, playerId, inning) {
    updateSavedLineup(gameId, (lineup) => {
      if (!lineup.lockedCells[pk(playerId)]) {
        lineup.lockedCells[pk(playerId)] = {}
      }
      lineup.lockedCells[pk(playerId)][inning] =
        !lineup.lockedCells[pk(playerId)][inning]
      autoSave(gameId, lineup)
      return lineup
    })
  }

  function toggleSavedRowLock(gameId, playerId) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.lockedRows[pk(playerId)] = !lineup.lockedRows[pk(playerId)]
      autoSave(gameId, lineup)
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
      [...current, newEvent].sort((a, b) =>
        `${a.event_date || ''}`.localeCompare(`${b.event_date || ''}`)
      )
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
            newGameSeason={newGameSeason}
            setNewGameSeason={setNewGameSeason}
            addGameFromGames={addGameFromGames}
            sortedGames={sortedGames}
            gameSort={gameSort}
            setGameSort={setGameSort}
            updateGameField={updateGameField}
            deleteGame={deleteGame}
            setSelectedGameId={setSelectedGameId}
            setPage={setPage}
            seasonOptions={seasonOptions}
            gameTypeOptions={gameTypeOptions}
            statusOptions={statusOptions}
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
            toggleSavedBattingLock={toggleSavedBattingLock}
            updateSavedCell={updateSavedCell}
            updateSavedBatting={updateSavedBatting}
            toggleSavedCellLock={toggleSavedCellLock}
            toggleSavedRowLock={toggleSavedRowLock}
            toggleSavedInningLock={toggleSavedInningLock}
            updateGameField={updateGameField}
            seasonOptions={seasonOptions}
            gameTypeOptions={gameTypeOptions}
            pk={pk}
            gameDetailImportSourceGameId={gameDetailImportSourceGameId}
            setGameDetailImportSourceGameId={setGameDetailImportSourceGameId}
            gameDetailImportableGames={gameDetailImportableGames}
            importLineupToSaved={importLineupToSaved}
            toggleSavedBattingLock={toggleSavedBattingLock}
            toggleSavedAllBattingLock={toggleSavedAllBattingLock}
          />
        )}

        {page === 'lineup-setter' && (
  <LineupSetterPage
    optimizerFocusLineup={optimizerFocusLineup}
    optimizerFocusGame={optimizerFocusGame}
    optimizerFocusLocked={optimizerFocusLocked}
    toggleLineupLocked={toggleLineupLocked}
    lineupLockedByGame={lineupLockedByGame}
    optimizerExistingGameId={optimizerExistingGameId}
    setOptimizerExistingGameId={setOptimizerExistingGameId}
    games={games}
    togglePreviewInningLock={togglePreviewInningLock}
    trackingPriorityByPositionRows={trackingPriorityByPositionRows}
    addExistingGameToBatch={addExistingGameToBatch}
    optimizerNewDate={optimizerNewDate}
    setOptimizerNewDate={setOptimizerNewDate}
    optimizerNewOpponent={optimizerNewOpponent}
    setOptimizerNewOpponent={setOptimizerNewOpponent}
    optimizerNewType={optimizerNewType}
    setOptimizerNewType={setOptimizerNewType}
    optimizerNewSeason={optimizerNewSeason}
    setOptimizerNewSeason={setOptimizerNewSeason}
    gameTypeOptions={gameTypeOptions}
    seasonOptions={seasonOptions}
    trackingFilters={trackingFilters}
    setTrackingFilters={setTrackingFilters}
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
    togglePreviewBattingLock={togglePreviewBattingLock}
    fitByPlayer={fitByPlayer}
    updatePreviewCell={updatePreviewCell}
    updatePreviewBatting={updatePreviewBatting}
    togglePreviewCellLock={togglePreviewCellLock}
    togglePreviewRowLock={togglePreviewRowLock}
    filteredLineups={lineupSetterFilteredLineups}
    ytdBeforeTotals={lineupSetterFilteredTotals}
    currentBatchTotals={currentBatchTotals}
    ytdAfterTotals={lineupSetterFutureTotals}
    ytdBeforeSitOutRows={lineupSetterComputedSitRows}
    ytdAfterSitOutRows={lineupSetterFutureComputedSitRows}
    trackingSort={trackingSort}
    setTrackingSort={setTrackingSort}
    TrackingTable={TrackingTable}
    blankLineup={blankLineup}
    pk={pk}
    optimizerPlanSitOutTargets={optimizerPlanSitOutTargets}
    setOptimizerPlanSitOutTargets={setOptimizerPlanSitOutTargets}
    inningStatus={inningStatus}
    trackingPriorityRows={trackingPriorityRows}
    optimizerImportSourceGameId={optimizerImportSourceGameId}
    setOptimizerImportSourceGameId={setOptimizerImportSourceGameId}
    togglePreviewAllBattingLock={togglePreviewAllBattingLock}
    optimizerImportableGames={optimizerImportableGames}
    importLineupToPreview={importLineupToPreview}
    clearPreviewLineup={clearPreviewLineup}
    toggleSavedBattingLock={toggleSavedBattingLock}
    toggleSavedAllBattingLock={toggleSavedAllBattingLock}
  />
)}
                {page === 'tracking' && (
  <TrackingPage
    trackingLockedLineups={filteredTrackingLineups}
    trackingTotals={trackingTotals}
    trackingSitByPlayer={sitByPlayer}
    trackingSitSummary={sitSummary}
    activePlayers={activePlayers}
    trackingSort={trackingSort}
    setTrackingSort={setTrackingSort}
    trackingFilters={trackingFilters}
    setTrackingFilters={setTrackingFilters}
    seasonOptions={seasonOptions}
    gameTypeOptions={gameTypeOptions}
    TrackingTable={TrackingTable}
    battingRows={battingRows}
    sitSummary={sitSummary}
    sitByPlayer={sitByPlayer}
    gamesWithLineups={filteredTrackingGamesWithLineups}
    trackingPlayerId={trackingPlayerId}
    setTrackingPlayerId={setTrackingPlayerId}
    selectedPlayerPositions={selectedPlayerPositions}
    trackingPriorityRows={trackingPriorityRows}
    trackingPriorityByPositionRows={trackingPriorityByPositionRows}
    pk={pk}
  />
)}
        
                {page === 'attendance' && renderAttendancePage()}

        {page === 'admin' && (
          <AdminPage
            appOptions={appOptions}
            loadAppOptions={loadAppOptions}
            addAppOption={addAppOption}
            updateAppOption={updateAppOption}
          />
        )}
      </main>
    </div>
  )
}
