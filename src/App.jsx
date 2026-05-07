// FILE: src/app.jsx

import { useEffect, useMemo, useState } from 'react'
import { useTrackingFilters } from './hooks/useTrackingFilters'
import { useAppOptions } from './hooks/useAppOptions'
import { useAppData } from './hooks/useAppData'
import { usePlayerActions } from './hooks/usePlayerActions'
import { useAppViewData } from './hooks/useAppViewData'
import { supabase } from './lib/supabase'
import {
  PRIORITY_POSITIONS,
  ALLOWED_POSITIONS,
  GAME_TYPES,
  pk,
  blankLineup,
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
import { normalizePriorityValue } from './lib/positionInputHelpers'
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

export default function App() {
  const [page, setPage] = useState('games')
  const [appError, setAppError] = useState('')

  const [selectedGameId, setSelectedGameId] = useState('')
  const [optimizerExistingGameId, setOptimizerExistingGameId] = useState('')
  const [optimizerFocusGameId, setOptimizerFocusGameId] = useState('')
  const [optimizerBatchGameIds, setOptimizerBatchGameIds] = useState([])
  const [optimizerPreviewByGame, setOptimizerPreviewByGame] = useState({})
  const [optimizerPlanSitOutTargets, setOptimizerPlanSitOutTargets] = useState({})
  const [optimizerMode, setOptimizerMode] = useState('')

  const {
    players,
    setPlayers,
    games,
    setGames,
    lineupsByGame,
    setLineupsByGame,
    lineupLockedByGame,
    setLineupLockedByGame,
    priorityByPlayer,
    setPriorityByPlayer,
    fitByPlayer,
    setFitByPlayer,
    attendanceEvents,
    setAttendanceEvents,
    attendanceByEvent,
    setAttendanceByEvent,
    optimizerProfiles,
    optimizerProfileRules,
    lineupSetterStateLoaded,
    loading,
    loadAll,
  } = useAppData({
    setAppError,
    setSelectedGameId,
    setOptimizerExistingGameId,
    setOptimizerFocusGameId,
    setOptimizerBatchGameIds,
    setOptimizerMode,
  })

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

const {
  loadAppOptions,
  addAppOption,
  updateAppOption,
  seasonOptions,
  gameTypeOptions,
  statusOptions,
  defaultSeasonOption,
  defaultGameTypeOption,
  defaultStatusOption,
} = useAppOptions({
  appOptions,
  setAppOptions,
  setAppError,
})

useEffect(() => {
  loadAppOptions()
}, [])
  
  const {
  trackingFilters,
  setTrackingFilters,
} = useTrackingFilters()

  const [attendanceDate, setAttendanceDate] = useState('')
  const [attendanceSeason, setAttendanceSeason] = useState(ATTENDANCE_SEASON_OPTIONS[0])
  const [attendanceType, setAttendanceType] = useState(ATTENDANCE_TYPE_OPTIONS[0])
  const [attendanceSurface, setAttendanceSurface] = useState(ATTENDANCE_SURFACE_OPTIONS[0])
  const [attendanceTitle, setAttendanceTitle] = useState('')

  const {
  activePlayers,
  selectedGame,
  selectedLineup,
  selectedLocked,
  sortedPlayers,
  sortedGames,
  activePriorityRows,
  allowedRows,
  priorityFooter,
  optimizerBatchGames,
  optimizerFocusGame,
  optimizerFocusLocked,
  optimizerFocusLineup,
  optimizerImportableGames,
  gameDetailImportableGames,
  activeOptimizerProfile,
  activeOptimizerProfileRules,
  lineupSetterFilteredLineups,
  lineupSetterFilteredTotals,
  lineupSetterComputedSitRows,
  currentPlanLineupsByGame,
  currentPlanSitOutRows,
  currentBatchTotals,
  lineupSetterFutureTotals,
  lineupSetterFutureComputedSitRows,
  filteredTrackingLineups,
  filteredTrackingGamesWithLineups,
  battingRows,
  sitSummary,
  sitByPlayer,
  trackingComputedSitRows,
  trackingTotals,
  selectedPlayerPositions,
  trackingPriorityRows,
  trackingPriorityByPositionRows,
  filteredAttendanceEvents,
  attendanceTotals,
  attendanceBreakdownByPlayer,
} = useAppViewData({
  players,
  games,
  lineupsByGame,
  lineupLockedByGame,
  priorityByPlayer,
  fitByPlayer,
  attendanceEvents,
  attendanceByEvent,
  optimizerBatchGameIds,
  optimizerPreviewByGame,
  optimizerFocusGameId,
  selectedGameId,
  trackingPlayerId,
  optimizerProfiles,
  optimizerProfileRules,
  optimizerMode,
  trackingFilters,
  playerSort,
  gameSort,
  prioritySort,
  allowedSort,
  trackingSort,
  attendanceSort,
})

function activePlayerIds() {
  return getActivePlayerIds(activePlayers)
}

const {
  upsertPlayer,
  updatePlayerLocal,
  addPlayer,
  deletePlayer,
} = usePlayerActions({
  setAppError,
  setPlayers,
  loadAll,
  newPlayerName,
  setNewPlayerName,
  newPlayerLastName,
  setNewPlayerLastName,
  newPlayerNumber,
  setNewPlayerNumber,
  newPlayerActive,
  setNewPlayerActive,
})
  
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
