// FILE: src/app.jsx

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
import PositioningPriorityPage from './Pages/PositioningPriorityPage'
import GameDetailPage from './Pages/GameDetailPage'
import LineupSetterPage from './Pages/LineupSetterPage'
import TrackingPage from './Pages/TrackingPage'
import LineupGrid from './Components/LineupGrid'
import Sidebar from './Components/Sidebar'
import AdminPage from './Pages/AdminPage'
import OptimizerInputsPage from './Pages/OptimizerInputsPage'

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
import { buildCumulativeSitOutRows } from './lib/sitOutHelpers'
import {
  TEAM_ID,
  ATTENDANCE_SEASON_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
  ATTENDANCE_SURFACE_OPTIONS,
} from './lib/constants'
import {
  buildPriorityMap,
  buildFitMap,
  normalizePriorityValue,
} from './lib/positionInputHelpers'
import {
  buildCurrentPlanLineupsByGame,
  getActivePlayerIds,
  getNormalizedLineupForGame,
  getOrderedOptimizerGames,
  buildEmptyOutCounts,
  addLineupOutsToPlanCounts,
  buildBatchCurrentOutsFromLineups,
  getOtherPreviewLineups,
  calculateTotalsBeforeCurrentGame,
} from './lib/optimizerPlanHelpers'
import {
  copyLineupForGame,
  clearLineupContents,
  buildPreviewBaseLineup,
  getAvailabilityConfirmMessage,
  updateLineupAvailability,
  addInningToLineup,
  removeInningFromLineup,
  toggleBattingLockOnLineup,
  toggleAllBattingLocksOnLineup,
  toggleCellLockOnLineup,
  toggleRowLockOnLineup,
  toggleInningLockOnLineup,
  updateLineupCell,
  updateLineupBattingOrder,
  removeInningFromSavedLineup,
} from './lib/lineupEditHelpers'
import {
  buildOptimizerImportableGames,
  buildGameDetailImportableGames,
  buildActiveOptimizerProfile,
  buildActiveOptimizerProfileRules,
} from './lib/optimizerViewHelpers'
import {
  buildAttendanceTotals,
  buildAttendanceBreakdownByPlayer,
} from './lib/attendanceHelpers'

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

const defaultTrackingFilters = {
  seasons: [],
  gameTypes: [],
  gameStatuses: [],
  lineupStates: ['Locked'],
  dateFrom: '',
  dateTo: '',
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
  const [optimizerMode, setOptimizerMode] = useState('')
  const [optimizerProfiles, setOptimizerProfiles] = useState([])
  const [optimizerProfileRules, setOptimizerProfileRules] = useState({})
  const [lineupSetterStateLoaded, setLineupSetterStateLoaded] = useState(false)

  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [newGameType, setNewGameType] = useState('')
  const [newGameSeason, setNewGameSeason] = useState('')

  const [optimizerNewDate, setOptimizerNewDate] = useState('')
  const [optimizerNewOpponent, setOptimizerNewOpponent] = useState('')
  const [optimizerNewType, setOptimizerNewType] = useState('')
  const [optimizerNewSeason, setOptimizerNewSeason] = useState('')

  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerLastName, setNewPlayerLastName] = useState('')
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
  const [trackingPlayerId, setTrackingPlayerId] = useState('')

  const [appOptions, setAppOptions] = useState({
    season: [],
    game_type: [],
    status: [],
  })

  const [trackingFilters, setTrackingFilters] = useState(() => {
    try {
      const saved = sessionStorage.getItem('softball-lineup-tracking-filters')
      const parsed = saved ? JSON.parse(saved) : {}
      const savedLineupStates = Array.isArray(parsed?.lineupStates)
        ? parsed.lineupStates.filter((x) => ['Locked', 'Saved', 'Empty'].includes(x))
        : []

      return {
        ...defaultTrackingFilters,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        seasons: Array.isArray(parsed?.seasons) ? parsed.seasons : [],
        gameTypes: Array.isArray(parsed?.gameTypes) ? parsed.gameTypes : [],
        gameStatuses: Array.isArray(parsed?.gameStatuses) ? parsed.gameStatuses : [],
        lineupStates: savedLineupStates.length
          ? savedLineupStates
          : defaultTrackingFilters.lineupStates,
      }
    } catch {
      return defaultTrackingFilters
    }
  })

  const [attendanceDate, setAttendanceDate] = useState('')
  const [attendanceSeason, setAttendanceSeason] = useState(ATTENDANCE_SEASON_OPTIONS[0])
  const [attendanceType, setAttendanceType] = useState(ATTENDANCE_TYPE_OPTIONS[0])
  const [attendanceSurface, setAttendanceSurface] = useState(ATTENDANCE_SURFACE_OPTIONS[0])
  const [attendanceTitle, setAttendanceTitle] = useState('')

  const activePlayers = useMemo(() => players.filter((p) => p.active !== false), [players])

  function activePlayerIds() {
    return getActivePlayerIds(activePlayers)
  }

  function getGameLineupState(game) {
    if (lineupLockedByGame[pk(game.id)]) return 'Locked'
    if (lineupsByGame[pk(game.id)]) return 'Saved'
    return 'Empty'
  }

  function gameMatchesFilters(game, filters) {
    const seasons = filters?.seasons || []
    const gameTypes = filters?.gameTypes || []
    const gameStatuses = filters?.gameStatuses || []
    const lineupStates = filters?.lineupStates || []
    const dateFrom = filters?.dateFrom || ''
    const dateTo = filters?.dateTo || ''
    const gameDate = game?.date || ''

    return (
      (!seasons.length || seasons.includes(game.season || '')) &&
      (!gameTypes.length || gameTypes.includes(game.game_type || '')) &&
      (!gameStatuses.length || gameStatuses.includes(game.status || '')) &&
      (!lineupStates.length || lineupStates.includes(getGameLineupState(game))) &&
      (!dateFrom || (gameDate && gameDate >= dateFrom)) &&
      (!dateTo || (gameDate && gameDate <= dateTo))
    )
  }

  function isCompleteLineup(lineup) {
    if (!lineup) return false
    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      const assigned = Object.values(lineup.cells || {}).filter((p) => p?.[inning])
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
    if (res.error) return setAppError(res.error.message)
    await loadAppOptions()
  }

  async function updateAppOption(id, updates) {
    const res = await supabase.from('app_options').update(updates).eq('id', id)
    if (res.error) return setAppError(res.error.message)
    await loadAppOptions()
  }

  const seasonOptions = useMemo(() => {
    const saved = (appOptions.season || []).filter((x) => x.is_active)
    return saved.length
      ? saved
      : [
          buildDefaultOption('Fall', 'season', 1),
          buildDefaultOption('Winter', 'season', 2),
          buildDefaultOption('Spring', 'season', 3),
        ]
  }, [appOptions])

  const gameTypeOptions = useMemo(() => {
    const saved = (appOptions.game_type || []).filter((x) => x.is_active)
    return saved.length
      ? saved
      : (GAME_TYPES || []).map((label, idx) => buildDefaultOption(label, 'game_type', idx + 1))
  }, [appOptions])

  const statusOptions = useMemo(() => {
    const saved = (appOptions.status || []).filter((x) => x.is_active)
    return saved.length
      ? saved
      : [
          buildDefaultOption('Planned', 'status', 1),
          buildDefaultOption('Complete', 'status', 2),
          buildDefaultOption('Cancelled', 'status', 3),
        ]
  }, [appOptions])

  const defaultSeasonOption = useMemo(() => seasonOptions.find((x) => x.is_default), [seasonOptions])
  const defaultGameTypeOption = useMemo(() => gameTypeOptions.find((x) => x.is_default), [gameTypeOptions])
  const defaultStatusOption = useMemo(() => statusOptions.find((x) => x.is_default), [statusOptions])

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

    const res = existing.data?.id
      ? await supabase.from('game_lineups').update(payload).eq('id', existing.data.id)
      : await supabase.from('game_lineups').insert({
          game_id: gameId,
          lineup_name: 'Main',
          ...payload,
        })

    if (res.error) {
      setAppError(res.error.message)
      return false
    }

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
        .select('id, name, last_name, jersey_number, active')
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

      setPriorityByPlayer(buildPriorityMap(prefRes.data || []))
      setFitByPlayer(buildFitMap(allowedRes.data || []))

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

      const profilesRes = await supabase
        .from('optimizer_profiles')
        .select('*')
        .eq('team_id', TEAM_ID)
        .order('profile_name', { ascending: true })
      if (profilesRes.error) throw profilesRes.error

      const loadedProfiles = profilesRes.data || []
      setOptimizerProfiles(loadedProfiles)

      const profileIds = loadedProfiles.map((profile) => profile.id)
      const loadedRulesByProfile = {}

      if (profileIds.length) {
        const rulesRes = await supabase
          .from('optimizer_profile_position_rules')
          .select('*')
          .in('profile_id', profileIds)
        if (rulesRes.error) throw rulesRes.error

        ;(rulesRes.data || []).forEach((rule) => {
          if (!loadedRulesByProfile[rule.profile_id]) loadedRulesByProfile[rule.profile_id] = {}
          loadedRulesByProfile[rule.profile_id][rule.position] = rule
        })
      }

      setOptimizerProfileRules(loadedRulesByProfile)

      const defaultProfile =
        loadedProfiles.find((profile) => profile.is_default) || loadedProfiles[0] || null
      if (defaultProfile?.profile_key) setOptimizerMode(defaultProfile.profile_key)

      const stateRes = await supabase
        .from('lineup_setter_state')
        .select('batch_game_ids, focus_game_id')
        .eq('team_id', TEAM_ID)
        .maybeSingle()
      if (stateRes.error) throw stateRes.error

      const validGameIds = new Set(loadedGames.map((game) => pk(game.id)))
      const savedBatchIds = Array.isArray(stateRes.data?.batch_game_ids)
        ? stateRes.data.batch_game_ids.map(pk).filter((id) => validGameIds.has(id))
        : []

      const savedFocusId =
        stateRes.data?.focus_game_id && validGameIds.has(pk(stateRes.data.focus_game_id))
          ? pk(stateRes.data.focus_game_id)
          : savedBatchIds[0] || ''

      if (savedBatchIds.length) {
        setOptimizerBatchGameIds(savedBatchIds)
        setOptimizerFocusGameId(savedFocusId)
        setOptimizerExistingGameId(savedFocusId)
      } else if (loadedGames.length) {
        const latestGame = [...loadedGames].sort((a, b) => compareGamesAsc(a, b, pk)).at(-1)
        if (latestGame) {
          setSelectedGameId(pk(latestGame.id))
          setOptimizerExistingGameId(pk(latestGame.id))
          setOptimizerFocusGameId(pk(latestGame.id))
        }
      }

      setLineupSetterStateLoaded(true)
    } catch (error) {
      setAppError(error.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem('softball-lineup-tracking-filters', JSON.stringify(trackingFilters))
    } catch {}
  }, [trackingFilters])

  useEffect(() => {
    if (loading || !lineupSetterStateLoaded || !dbReady()) return

    async function saveLineupSetterState() {
      const { error } = await supabase.from('lineup_setter_state').upsert(
        {
          team_id: TEAM_ID,
          batch_game_ids: optimizerBatchGameIds.map(pk),
          focus_game_id: optimizerFocusGameId || null,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'team_id' }
      )

      if (error) console.warn('Failed to save lineup setter state', error)
    }

    saveLineupSetterState()
  }, [optimizerBatchGameIds, optimizerFocusGameId, loading, lineupSetterStateLoaded])

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
    if (!games.length || !lineupSetterStateLoaded) return
    const latestGame = [...games].sort((a, b) => compareGamesAsc(a, b, pk)).at(-1)
    if (!latestGame) return

    if (!selectedGameId) setSelectedGameId(pk(latestGame.id))
    if (!optimizerExistingGameId) setOptimizerExistingGameId(pk(latestGame.id))
    if (!optimizerFocusGameId && !optimizerBatchGameIds.length) {
      setOptimizerFocusGameId(pk(latestGame.id))
    }
  }, [
    games,
    selectedGameId,
    optimizerExistingGameId,
    optimizerFocusGameId,
    optimizerBatchGameIds,
    lineupSetterStateLoaded,
  ])

  const selectedGame = useMemo(
    () => games.find((game) => pk(game.id) === pk(selectedGameId)) || null,
    [games, selectedGameId]
  )

  const selectedLineup = useMemo(
    () => (selectedGame ? lineupsByGame[pk(selectedGame.id)] || null : null),
    [selectedGame, lineupsByGame]
  )

  const selectedLocked = useMemo(() => {
    if (!selectedGame) return false
    const id = pk(selectedGame.id)
    if (Object.prototype.hasOwnProperty.call(lineupLockedByGame, id)) {
      return lineupLockedByGame[id] === true
    }
    return Boolean(lineupsByGame[id])
  }, [selectedGame, lineupLockedByGame, lineupsByGame])

  const sortedPlayers = useMemo(
    () =>
      sortRows(
        players.map((player) => ({
          ...player,
          activeText: player.active === false ? 'No' : 'Yes',
        })),
        playerSort
      ),
    [players, playerSort]
  )

  const sortedGames = useMemo(
    () =>
      sortRows(
        games.map((game) => ({
          ...game,
          lineupState: getGameLineupState(game),
        })),
        gameSort
      ),
    [games, lineupsByGame, lineupLockedByGame, gameSort]
  )

  const orderedGamesAsc = useMemo(
    () => [...games].sort((a, b) => compareGamesAsc(a, b, pk)),
    [games]
  )

  const activePriorityRows = useMemo(
    () =>
      sortRows(
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
            subtotal: PRIORITY_POSITIONS.reduce(
              (sum, pos) => sum + Number(pr[pos]?.priority_pct || 0),
              0
            ),
          }
        }),
        prioritySort
      ),
    [activePlayers, priorityByPlayer, prioritySort]
  )

  const allowedRows = useMemo(
    () =>
      sortRows(
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
      ),
    [activePlayers, fitByPlayer, allowedSort]
  )

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

  const optimizerFocusLineup = useMemo(() => {
    if (!optimizerFocusGameId) return null
    const game = games.find((g) => pk(g.id) === pk(optimizerFocusGameId))

    return (
      optimizerPreviewByGame[pk(optimizerFocusGameId)] ||
      lineupsByGame[pk(optimizerFocusGameId)] ||
      (game
        ? blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())
        : null)
    )
  }, [optimizerPreviewByGame, lineupsByGame, optimizerFocusGameId, games, players])

  const optimizerImportableGames = useMemo(
    () =>
      buildOptimizerImportableGames({
        optimizerFocusGame,
        games,
        lineupsByGame,
        compareGamesAsc,
      }),
    [optimizerFocusGame, games, lineupsByGame]
  )

  const gameDetailImportableGames = useMemo(
    () =>
      buildGameDetailImportableGames({
        selectedGame,
        games,
        lineupsByGame,
        compareGamesAsc,
      }),
    [selectedGame, games, lineupsByGame]
  )

  const activeOptimizerProfile = useMemo(
    () => buildActiveOptimizerProfile({ optimizerProfiles, optimizerMode }),
    [optimizerProfiles, optimizerMode]
  )

  const activeOptimizerProfileRules = useMemo(
    () => buildActiveOptimizerProfileRules({ activeOptimizerProfile, optimizerProfileRules }),
    [activeOptimizerProfile, optimizerProfileRules]
  )

  const lineupSetterFilteredGames = useMemo(
    () => orderedGamesAsc.filter((game) => gameMatchesFilters(game, trackingFilters)),
    [orderedGamesAsc, trackingFilters, lineupsByGame, lineupLockedByGame]
  )

  const lineupSetterFilteredGamesWithLineups = useMemo(
    () =>
      lineupSetterFilteredGames
        .filter((game) => !optimizerBatchGameIds.includes(pk(game.id)))
        .filter((game) => lineupsByGame[pk(game.id)]),
    [lineupSetterFilteredGames, optimizerBatchGameIds, lineupsByGame]
  )

  const lineupSetterFilteredLineups = useMemo(
    () => lineupSetterFilteredGamesWithLineups.map((game) => lineupsByGame[pk(game.id)]).filter(Boolean),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame]
  )

  const lineupSetterFilteredTotals = useMemo(
    () => computeTotals(lineupSetterFilteredLineups, players),
    [lineupSetterFilteredLineups, players]
  )

  const lineupSetterSitSummary = useMemo(
    () => buildSitOutSummary(lineupSetterFilteredGamesWithLineups, lineupsByGame, activePlayers, pk),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame, activePlayers]
  )

  const lineupSetterSitByPlayer = useMemo(
    () => buildPlayerSitOuts(lineupSetterFilteredGamesWithLineups, lineupsByGame, activePlayers, pk),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame, activePlayers]
  )

  const lineupSetterComputedSitRows = useMemo(
    () => buildCumulativeSitOutRows(lineupSetterSitByPlayer, lineupSetterSitSummary),
    [lineupSetterSitByPlayer, lineupSetterSitSummary]
  )

  const currentPlanLineupsByGame = useMemo(
    () => buildCurrentPlanLineupsByGame(lineupsByGame, optimizerPreviewByGame),
    [lineupsByGame, optimizerPreviewByGame]
  )

  const currentPlanSitOutRows = useMemo(
    () =>
      buildCumulativeSitOutRows(
        buildPlayerSitOuts(optimizerBatchGames, currentPlanLineupsByGame, activePlayers, pk),
        buildSitOutSummary(optimizerBatchGames, currentPlanLineupsByGame, activePlayers, pk)
      ),
    [optimizerBatchGames, currentPlanLineupsByGame, activePlayers]
  )

  const currentBatchTotals = useMemo(
    () =>
      computeTotals(
        optimizerBatchGames
          .map((game) => currentPlanLineupsByGame[pk(game.id)])
          .filter(isCompleteLineup),
        players
      ),
    [optimizerBatchGames, currentPlanLineupsByGame, players]
  )

  const lineupSetterFutureTotals = useMemo(
    () => addTotals(lineupSetterFilteredTotals, currentBatchTotals, players),
    [lineupSetterFilteredTotals, currentBatchTotals, players]
  )

  const lineupSetterFutureGamesWithLineups = useMemo(
    () => [...lineupSetterFilteredGamesWithLineups, ...optimizerBatchGames],
    [lineupSetterFilteredGamesWithLineups, optimizerBatchGames]
  )

  const lineupSetterFutureSitSummary = useMemo(
    () =>
      buildSitOutSummary(
        lineupSetterFutureGamesWithLineups,
        currentPlanLineupsByGame,
        activePlayers,
        pk
      ),
    [lineupSetterFutureGamesWithLineups, currentPlanLineupsByGame, activePlayers]
  )

  const lineupSetterFutureSitByPlayer = useMemo(
    () =>
      buildPlayerSitOuts(
        lineupSetterFutureGamesWithLineups,
        currentPlanLineupsByGame,
        activePlayers,
        pk
      ),
    [lineupSetterFutureGamesWithLineups, currentPlanLineupsByGame, activePlayers]
  )

  const lineupSetterFutureComputedSitRows = useMemo(
    () => buildCumulativeSitOutRows(lineupSetterFutureSitByPlayer, lineupSetterFutureSitSummary),
    [lineupSetterFutureSitByPlayer, lineupSetterFutureSitSummary]
  )

  const filteredTrackingGames = useMemo(
    () => orderedGamesAsc.filter((game) => gameMatchesFilters(game, trackingFilters)),
    [orderedGamesAsc, trackingFilters, lineupsByGame, lineupLockedByGame]
  )

  const filteredTrackingGamesWithLineups = useMemo(
    () => filteredTrackingGames.filter((game) => lineupsByGame[pk(game.id)]),
    [filteredTrackingGames, lineupsByGame]
  )

  const filteredTrackingLineups = useMemo(
    () => filteredTrackingGamesWithLineups.map((game) => lineupsByGame[pk(game.id)]).filter(Boolean),
    [filteredTrackingGamesWithLineups, lineupsByGame]
  )

  const battingRows = useMemo(
    () => buildBattingOrderMatrix(filteredTrackingGamesWithLineups, lineupsByGame, activePlayers, pk),
    [filteredTrackingGamesWithLineups, lineupsByGame, activePlayers]
  )

  const sitSummary = useMemo(
    () => buildSitOutSummary(filteredTrackingGamesWithLineups, lineupsByGame, activePlayers, pk),
    [filteredTrackingGamesWithLineups, lineupsByGame, activePlayers]
  )

  const sitByPlayer = useMemo(
    () => buildPlayerSitOuts(filteredTrackingGamesWithLineups, lineupsByGame, activePlayers, pk),
    [filteredTrackingGamesWithLineups, lineupsByGame, activePlayers]
  )

  const trackingComputedSitRows = useMemo(() => buildCumulativeSitOutRows(sitByPlayer), [sitByPlayer])

  const trackingTotals = useMemo(
    () => computeTotals(filteredTrackingLineups, players),
    [filteredTrackingLineups, players]
  )

  const selectedPlayerPositions = useMemo(() => {
    if (!trackingPlayerId) return []
    return buildPositionByPlayer(filteredTrackingGamesWithLineups, lineupsByGame, pk(trackingPlayerId), pk)
  }, [trackingPlayerId, filteredTrackingGamesWithLineups, lineupsByGame])

  const trackingPriorityRows = useMemo(
    () =>
      sortRows(
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
      ),
    [activePlayers, trackingTotals, priorityByPlayer, trackingSort]
  )

  const trackingPriorityByPositionRows = useMemo(() => {
    const positionTotals = {}
    ;['P', 'C', '1B', '2B', '3B', 'SS', 'OF'].forEach((pos) => {
      positionTotals[pos] = activePlayers.reduce(
        (sum, player) => sum + Number(trackingTotals[pk(player.id)]?.[pos] || 0),
        0
      )
    })

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
  }, [activePlayers, trackingTotals, priorityByPlayer])

  const filteredAttendanceEvents = useMemo(
    () => sortRows(attendanceEvents, attendanceSort),
    [attendanceEvents, attendanceSort]
  )

  const attendanceTotals = useMemo(
    () => buildAttendanceTotals(filteredAttendanceEvents),
    [filteredAttendanceEvents]
  )

  const attendanceBreakdownByPlayer = useMemo(
    () =>
      buildAttendanceBreakdownByPlayer({
        activePlayers,
        filteredAttendanceEvents,
        attendanceByEvent,
        attendanceTotals,
        pk,
      }),
    [activePlayers, filteredAttendanceEvents, attendanceByEvent, attendanceTotals]
  )

  async function addGame(date, opponent, gameType, season) {
    const nextOrder = getNextGameOrder(games)

    const res = await supabase
      .from('games')
      .insert({
        team_id: TEAM_ID,
        game_date: date || null,
        opponent: opponent || null,
        innings: 6,
        status: defaultStatusOption?.value || defaultStatusOption?.label || 'Planned',
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
    if (!game) return
    setNewGameDate('')
    setNewGameOpponent('')
    setNewGameType('')
    setNewGameSeason('')
    setSelectedGameId(pk(game.id))
  }

  async function addGameFromOptimizer() {
    const game = await addGame(optimizerNewDate, optimizerNewOpponent, optimizerNewType, optimizerNewSeason)
    if (!game) return

    setOptimizerNewDate('')
    setOptimizerNewOpponent('')
    setOptimizerNewType('')
    setOptimizerNewSeason('')
    setOptimizerBatchGameIds((current) => [...new Set([...current, pk(game.id)])])
    setOptimizerFocusGameId(pk(game.id))
    setOptimizerExistingGameId(pk(game.id))
    setOptimizerPreviewByGame((current) => ({
      ...current,
      [pk(game.id)]: blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds()),
    }))
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
    if (res.error) return setAppError(res.error.message)

    if (field === 'status' && String(value).toLowerCase() === 'complete') {
      const game = games.find((g) => pk(g.id) === pk(gameId))
      const currentLineup =
        currentPlanLineupsByGame[pk(gameId)] ||
        blankLineup(players.map((p) => p.id), Number(game?.innings || 6), activePlayerIds())

      await persistLineup(gameId, currentLineup, true)
    }
  }

  async function deleteGame(gameId) {
    if (lineupLockedByGame[pk(gameId)]) return setAppError('Unlock the lineup before deleting the game.')
    if (!window.confirm('Are you sure you want to delete this game?')) return

    const deleteLineup = await supabase.from('game_lineups').delete().eq('game_id', gameId)
    if (deleteLineup.error) return setAppError(deleteLineup.error.message)

    const deleteGameRow = await supabase.from('games').delete().eq('id', gameId)
    if (deleteGameRow.error) return setAppError(deleteGameRow.error.message)

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

    const payload = {
      name: player.name,
      last_name: player.last_name || '',
      jersey_number: player.jersey_number,
      active: player.active,
    }

    if (player.id) {
      const updateRes = await supabase.from('players').update(payload).eq('id', player.id)
      if (updateRes.error) setAppError(updateRes.error.message)
      return
    }

    const insertRes = await supabase
      .from('players')
      .insert({ team_id: TEAM_ID, ...payload })
      .select('id, name, last_name, jersey_number, active')
      .single()

    if (insertRes.error) return setAppError(insertRes.error.message)
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
      last_name: newPlayerLastName,
      jersey_number: newPlayerNumber,
      active: newPlayerActive,
    })

    setNewPlayerName('')
    setNewPlayerLastName('')
    setNewPlayerNumber('')
    setNewPlayerActive(true)
    await loadAll()
  }

  async function deletePlayer(playerId) {
    if (!window.confirm('Delete this player?')) return
    const del = await supabase.from('players').delete().eq('id', playerId)
    if (del.error) return setAppError(del.error.message)
    setPlayers((current) => current.filter((player) => pk(player.id) !== pk(playerId)))
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

  async function persistPriority(playerId, position, value) {
    const cleanedValue = normalizePriorityValue(value)

    if (cleanedValue === '') {
      const del = await supabase
        .from('player_position_preferences')
        .delete()
        .eq('player_id', playerId)
        .eq('position', position)

      if (del.error) return setAppError(del.error.message)
      updatePriorityLocal(playerId, position, '')
      return
    }

    const up = await supabase.from('player_position_preferences').upsert(
      {
        player_id: playerId,
        position,
        priority_pct: cleanedValue,
      },
      { onConflict: 'player_id,position' }
    )

    if (up.error) return setAppError(up.error.message)
    updatePriorityLocal(playerId, position, cleanedValue)
  }

  async function persistFitTier(playerId, position, tier) {
    const cleanedTier = tier || 'no'

    if (position === 'OF') {
      const results = await Promise.all(
        ['LF', 'CF', 'RF'].map((ofPos) =>
          supabase.from('player_allowed_positions').upsert(
            {
              player_id: playerId,
              position: ofPos,
              fit_tier: cleanedTier,
            },
            { onConflict: 'player_id,position' }
          )
        )
      )

      const error = results.find((res) => res.error)?.error
      if (error) return setAppError(error.message)

      setFitByPlayer((current) => ({
        ...current,
        [pk(playerId)]: {
          ...(current[pk(playerId)] || {}),
          LF: cleanedTier,
          CF: cleanedTier,
          RF: cleanedTier,
        },
      }))
      return
    }

    const up = await supabase.from('player_allowed_positions').upsert(
      {
        player_id: playerId,
        position,
        fit_tier: cleanedTier,
      },
      { onConflict: 'player_id,position' }
    )

    if (up.error) return setAppError(up.error.message)
    updateFitLocal(playerId, position, cleanedTier)
  }

  function addExistingGameToBatch() {
    if (!optimizerExistingGameId) return
    const gameId = pk(optimizerExistingGameId)
    const game = games.find((g) => pk(g.id) === gameId)
    if (!game) return

    const normalized = getNormalizedLineupForGame({
      game,
      players,
      activePlayers,
      currentPlanLineupsByGame,
    })

    setOptimizerBatchGameIds((current) => [...new Set([...current, gameId])])
    setOptimizerFocusGameId(gameId)
    setOptimizerPreviewByGame((current) => ({ ...current, [gameId]: normalized }))
  }

  function removeBatchGame(gameId) {
    setOptimizerBatchGameIds((current) => current.filter((id) => pk(id) !== pk(gameId)))

    if (lineupsByGame[pk(gameId)]) return
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
  }

  function runOptimizeAll() {
    try {
      if (!optimizerBatchGames.length) return alert('No games in plan')

      let rollingTotals = JSON.parse(JSON.stringify(lineupSetterFilteredTotals))
      const next = {}
      const orderedGames = getOrderedOptimizerGames(optimizerBatchGames)
      const planAssignedOuts = buildEmptyOutCounts(players)

      orderedGames.forEach((game) => {
        const gameId = pk(game.id)

        if (lineupLockedByGame[gameId]) {
          const lockedLineup = currentPlanLineupsByGame[gameId]
          if (lockedLineup) {
            next[gameId] = lockedLineup
            rollingTotals = addTotals(rollingTotals, computeTotals([lockedLineup], players), players)
            addLineupOutsToPlanCounts(planAssignedOuts, lockedLineup, players)
          }
          return
        }

        const source = getNormalizedLineupForGame({
          game,
          players,
          activePlayers,
          currentPlanLineupsByGame,
        })

        const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
        if (!availableIds.length) return

        const optimized = buildOptimizedLineup({
          game: { ...game, innings: Number(source?.innings || game.innings || 6) },
          players,
          optimizerMode,
          optimizerProfile: activeOptimizerProfile,
          optimizerProfileRules: activeOptimizerProfileRules,
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
        addLineupOutsToPlanCounts(planAssignedOuts, optimized, players)
        persistLineup(gameId, optimized)
        rollingTotals = addTotals(rollingTotals, computeTotals([optimized], players), players)
      })

      setOptimizerPreviewByGame((current) => ({ ...current, ...next }))
    } catch (error) {
      setAppError(error?.message || 'Optimize all failed.')
    }
  }

  function runOptimizeCurrent() {
    try {
      if (!optimizerFocusGameId) return
      if (lineupLockedByGame[pk(optimizerFocusGameId)]) {
        return setAppError('This lineup is locked. Unlock it before optimizing.')
      }

      const game = games.find((g) => pk(g.id) === pk(optimizerFocusGameId))
      if (!game) return

      const gameId = pk(game.id)
      const otherPreviewLineups = getOtherPreviewLineups({
        optimizerBatchGames,
        currentPlanLineupsByGame,
        currentGameId: gameId,
      })

      const totalsBeforeThisGame = calculateTotalsBeforeCurrentGame({
        baseTotals: lineupSetterFilteredTotals,
        otherPreviewLineups,
        players,
      })

      const source = getNormalizedLineupForGame({
        game,
        players,
        activePlayers,
        currentPlanLineupsByGame,
      })

      const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
      if (!availableIds.length) return

      const rebuilt = buildOptimizedLineup({
        game: { ...game, innings: Number(source?.innings || game.innings || 6) },
        players,
        optimizerMode,
        optimizerProfile: activeOptimizerProfile,
        optimizerProfileRules: activeOptimizerProfileRules,
        availablePlayerIds: availableIds,
        sourceLineup: source,
        totalsBefore: totalsBeforeThisGame,
        priorityMap: priorityByPlayer,
        fitMap: fitByPlayer,
        planSitOutTargets: optimizerPlanSitOutTargets,
        batchCurrentOuts: buildBatchCurrentOutsFromLineups(otherPreviewLineups, players),
        existingPlanLineups: otherPreviewLineups,
      })

      setOptimizerPreviewByGame((current) => ({ ...current, [gameId]: rebuilt }))
      persistLineup(game.id, rebuilt)
    } catch (error) {
      setAppError(error?.message || 'Optimize current failed.')
    }
  }

  function updatePreview(gameId, updater) {
    if (lineupLockedByGame[pk(gameId)]) return setAppError('This lineup is locked. Unlock it before editing.')

    setOptimizerPreviewByGame((current) => {
      const existing = buildPreviewBaseLineup({
        gameId,
        games,
        players,
        activePlayerIds,
        optimizerPreviewByGame: current,
        lineupsByGame,
      })

      const next = updater(JSON.parse(JSON.stringify(existing)))
      persistLineup(gameId, next)
      return { ...current, [pk(gameId)]: next }
    })
  }

  function importLineupToPreview(targetGameId, sourceGameId) {
    if (!targetGameId || !sourceGameId) return

    const targetGame = games.find((game) => pk(game.id) === pk(targetGameId))
    const sourceLineup = optimizerPreviewByGame[pk(sourceGameId)] || lineupsByGame[pk(sourceGameId)]

    if (!sourceLineup) return setAppError('Selected source game does not have a lineup.')
    if (!window.confirm('Are you sure you want to import this lineup? This will overwrite the current game lineup.')) return

    const copied = copyLineupForGame({ sourceLineup, targetGame, players, activePlayerIds })
    setOptimizerPreviewByGame((current) => ({ ...current, [pk(targetGameId)]: copied }))
  }

  function importLineupToSaved(targetGameId, sourceGameId) {
    if (!targetGameId || !sourceGameId) return

    const targetGame = games.find((game) => pk(game.id) === pk(targetGameId))
    const sourceLineup = optimizerPreviewByGame[pk(sourceGameId)] || lineupsByGame[pk(sourceGameId)]

    if (!sourceLineup) return setAppError('Selected source game does not have a lineup.')
    if (!window.confirm('Are you sure you want to import this lineup? This will overwrite the current game lineup.')) return

    const copied = copyLineupForGame({ sourceLineup, targetGame, players, activePlayerIds })
    setLineupsByGame((current) => ({ ...current, [pk(targetGameId)]: copied }))
    autoSave(targetGameId, copied)
  }

  async function clearPreviewLineup(gameId) {
    if (!gameId) return
    if (lineupLockedByGame[pk(gameId)]) return setAppError('Unlock the lineup before clearing it.')
    if (!window.confirm('Clear the lineup for this game?')) return

    const source = optimizerPreviewByGame[pk(gameId)] || lineupsByGame[pk(gameId)]
    if (!source) return

    const cleared = clearLineupContents(source, players)
    setOptimizerPreviewByGame((current) => ({ ...current, [pk(gameId)]: cleared }))
    await persistLineup(gameId, cleared)
  }

  function togglePreviewAvailable(gameId, playerId) {
    const id = pk(playerId)
    const game = games.find((g) => pk(g.id) === pk(gameId))
    const player = players.find((p) => pk(p.id) === id)
    const currentLineup =
      optimizerPreviewByGame[pk(gameId)] ||
      lineupsByGame[pk(gameId)] ||
      blankLineup(players.map((p) => p.id), Number(game?.innings || 6), activePlayerIds())

    const currentlyAvailable = (currentLineup.availablePlayerIds || []).map(pk).includes(id)
    if (!window.confirm(getAvailabilityConfirmMessage({ currentlyAvailable, player, game }))) return

    updatePreview(gameId, (lineup) =>
      updateLineupAvailability({
        lineup,
        playerId,
        currentlyAvailable,
      })
    )
  }

  const savePreview = async () => {}
  const saveSavedLineup = async () => {}

  function updateSavedLineup(gameId, updater) {
    setLineupsByGame((current) => {
      const existing = current[pk(gameId)]
      if (!existing) return current
      const next = updater(JSON.parse(JSON.stringify(existing)))
      return { ...current, [pk(gameId)]: next }
    })
  }

  const togglePreviewBattingLock = (gameId, playerId) =>
    updatePreview(gameId, (lineup) => toggleBattingLockOnLineup(lineup, playerId))
  const togglePreviewAllBattingLock = (gameId) =>
    updatePreview(gameId, (lineup) => toggleAllBattingLocksOnLineup(lineup))
  const updatePreviewCell = (gameId, playerId, inning, value) =>
    updatePreview(gameId, (lineup) => updateLineupCell(lineup, playerId, inning, value))
  const updatePreviewBatting = (gameId, playerId, value) =>
    updatePreview(gameId, (lineup) => updateLineupBattingOrder(lineup, playerId, value))
  const togglePreviewCellLock = (gameId, playerId, inning) =>
    updatePreview(gameId, (lineup) => toggleCellLockOnLineup(lineup, playerId, inning))
  const togglePreviewRowLock = (gameId, playerId) =>
    updatePreview(gameId, (lineup) => toggleRowLockOnLineup(lineup, playerId))
  const togglePreviewInningLock = (gameId, inning) =>
    updatePreview(gameId, (lineup) => toggleInningLockOnLineup(lineup, inning))
  const addPreviewInning = (gameId) =>
    updatePreview(gameId, (lineup) => addInningToLineup(lineup))
  const removePreviewInning = (gameId, inningToRemove) => {
    if (!window.confirm(`Remove inning ${inningToRemove}?`)) return
    updatePreview(gameId, (lineup) => removeInningFromLineup(lineup, inningToRemove))
  }

  function updateSavedAndPersist(gameId, updater) {
    updateSavedLineup(gameId, (lineup) => {
      const next = updater(lineup)
      autoSave(gameId, next)
      return next
    })
  }

  const updateSavedCell = (gameId, playerId, inning, value) =>
    updateSavedAndPersist(gameId, (lineup) => updateLineupCell(lineup, playerId, inning, value))
  const updateSavedBatting = (gameId, playerId, value) =>
    updateSavedAndPersist(gameId, (lineup) => updateLineupBattingOrder(lineup, playerId, value))
  const toggleSavedBattingLock = (gameId, playerId) =>
    updateSavedAndPersist(gameId, (lineup) => toggleBattingLockOnLineup(lineup, playerId))
  const toggleSavedAllBattingLock = (gameId) =>
    updateSavedAndPersist(gameId, (lineup) => toggleAllBattingLocksOnLineup(lineup))
  const addSavedInning = (gameId) =>
    updateSavedAndPersist(gameId, (lineup) => addInningToLineup(lineup))
  const toggleSavedInningLock = (gameId, inning) =>
    updateSavedAndPersist(gameId, (lineup) => toggleInningLockOnLineup(lineup, inning))
  const toggleSavedCellLock = (gameId, playerId, inning) =>
    updateSavedAndPersist(gameId, (lineup) => toggleCellLockOnLineup(lineup, playerId, inning))
  const toggleSavedRowLock = (gameId, playerId) =>
    updateSavedAndPersist(gameId, (lineup) => toggleRowLockOnLineup(lineup, playerId))
  const toggleSavedAvailable = (gameId, playerId) =>
    updateSavedAndPersist(gameId, (lineup) => {
      const currentlyAvailable = (lineup.availablePlayerIds || []).map(pk).includes(pk(playerId))
      return updateLineupAvailability({ lineup, playerId, currentlyAvailable })
    })

  function removeSavedInning(gameId, inningToRemove) {
    if (!window.confirm(`Remove inning ${inningToRemove}?`)) return

    let lineupToSave = null
    setLineupsByGame((prev) => {
      const existing = prev[pk(gameId)]
      if (!existing) return prev

      const lineup = removeInningFromSavedLineup({
        existing,
        inningToRemove,
        players,
        activePlayerIds,
      })

      lineupToSave = lineup
      return { ...prev, [pk(gameId)]: lineup }
    })

    if (lineupToSave) persistLineup(gameId, lineupToSave)
  }

  async function toggleLineupLocked(gameId, nextLocked) {
    const game = games.find((g) => pk(g.id) === pk(gameId))
    const currentLineup =
      currentPlanLineupsByGame[pk(gameId)] ||
      lineupsByGame[pk(gameId)] ||
      optimizerPreviewByGame[pk(gameId)] ||
      blankLineup(players.map((p) => p.id), Number(game?.innings || 6), activePlayerIds())

    setLineupLockedByGame((current) => ({ ...current, [pk(gameId)]: nextLocked }))
    const ok = await persistLineup(gameId, currentLineup, nextLocked)

    if (!ok) {
      setLineupLockedByGame((current) => ({ ...current, [pk(gameId)]: !nextLocked }))
    }
  }

  async function clearSavedLineup(gameId) {
    if (lineupLockedByGame[pk(gameId)]) return setAppError('Unlock the lineup before clearing it.')
    if (!window.confirm('Clear the lineup for this game?')) return

    const res = await supabase
      .from('game_lineups')
      .delete()
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')

    if (res.error) return setAppError(res.error.message)

    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
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

    if (res.error) return setAppError(res.error.message)

    const newEvent = res.data
    setAttendanceEvents((current) =>
      [...current, newEvent].sort((a, b) => `${a.event_date || ''}`.localeCompare(`${b.event_date || ''}`))
    )

    const recRes = await supabase.from('attendance_records').upsert(
      activePlayers.map((player) => ({
        event_id: newEvent.id,
        player_id: player.id,
        attended: false,
      })),
      { onConflict: 'event_id,player_id' }
    )

    if (recRes.error) return setAppError(recRes.error.message)

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
    if (!window.confirm('Delete this attendance event?')) return

    const recDel = await supabase.from('attendance_records').delete().eq('event_id', eventId)
    if (recDel.error) return setAppError(recDel.error.message)

    const eventDel = await supabase.from('attendance_events').delete().eq('id', eventId)
    if (eventDel.error) return setAppError(eventDel.error.message)

    setAttendanceEvents((current) => current.filter((event) => pk(event.id) !== pk(eventId)))
    setAttendanceByEvent((current) => {
      const next = { ...current }
      delete next[pk(eventId)]
      return next
    })
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />

      <main className="main-content">
        {appError && (
          <div className="card" style={{ marginBottom: 16, borderColor: '#fecaca', background: '#fff7f7' }}>
            <div className="row-between wrap-row">
              <p style={{ color: '#b91c1c', margin: 0 }}>
                <strong>Error:</strong> {appError}
              </p>
              <button type="button" onClick={() => setAppError('')}>
                Dismiss
              </button>
            </div>
          </div>
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
            lineupsByGame={lineupsByGame}
            pk={pk}
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
            statusOptions={statusOptions}
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
            activePlayerIds={activePlayerIds()}
            requiredOutsForGame={requiredOutsForGame}
            setOptimizerFocusGameId={setOptimizerFocusGameId}
            savePreview={savePreview}
            removeBatchGame={removeBatchGame}
            addPreviewInning={addPreviewInning}
            removePreviewInning={removePreviewInning}
            togglePreviewAvailable={togglePreviewAvailable}
            LineupGrid={LineupGrid}
            togglePreviewBattingLock={togglePreviewBattingLock}
            togglePreviewAllBattingLock={togglePreviewAllBattingLock}
            fitByPlayer={fitByPlayer}
            updatePreviewCell={updatePreviewCell}
            updatePreviewBatting={updatePreviewBatting}
            togglePreviewCellLock={togglePreviewCellLock}
            togglePreviewRowLock={togglePreviewRowLock}
            filteredLineups={lineupSetterFilteredLineups}
            ytdBeforeTotals={lineupSetterFilteredTotals}
            currentBatchTotals={currentBatchTotals}
            currentPlanSitOutRows={currentPlanSitOutRows}
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
            optimizerMode={optimizerMode}
            setOptimizerMode={setOptimizerMode}
            optimizerProfiles={optimizerProfiles}
            optimizerProfileRules={optimizerProfileRules}
            inningStatus={inningStatus}
            trackingPriorityRows={trackingPriorityRows}
            optimizerImportSourceGameId={optimizerImportSourceGameId}
            setOptimizerImportSourceGameId={setOptimizerImportSourceGameId}
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
            trackingSitByPlayer={trackingComputedSitRows}
            trackingSitSummary={sitSummary}
            activePlayers={activePlayers}
            trackingSort={trackingSort}
            setTrackingSort={setTrackingSort}
            trackingFilters={trackingFilters}
            setTrackingFilters={setTrackingFilters}
            seasonOptions={seasonOptions}
            gameTypeOptions={gameTypeOptions}
            statusOptions={statusOptions}
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

        {page === 'attendance' && (
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
        )}

        {page === 'optimizer-inputs' && (
          <OptimizerInputsPage
            optimizerProfiles={optimizerProfiles}
            optimizerProfileRules={optimizerProfileRules}
            reloadAllData={loadAll}
            setAppError={setAppError}
          />
        )}

        {page === 'admin' && (
          <AdminPage
            appOptions={appOptions}
            loadAppOptions={loadAppOptions}
            addAppOption={addAppOption}
            updateAppOption={updateAppOption}
            reloadAllData={loadAll}
            players={players}
            sortedPlayers={sortedPlayers}
            playerSort={playerSort}
            setPlayerSort={setPlayerSort}
            nextSort={nextSort}
            updatePlayerLocal={updatePlayerLocal}
            upsertPlayer={upsertPlayer}
            deletePlayer={deletePlayer}
            addPlayer={addPlayer}
            newPlayerName={newPlayerName}
            setNewPlayerName={setNewPlayerName}
            newPlayerLastName={newPlayerLastName}
            setNewPlayerLastName={setNewPlayerLastName}
            newPlayerNumber={newPlayerNumber}
            setNewPlayerNumber={setNewPlayerNumber}
            newPlayerActive={newPlayerActive}
            setNewPlayerActive={setNewPlayerActive}
          />
        )}
      </main>
    </div>
  )
}
