// FILE: src/app.jsx

import { useEffect, useState } from 'react'
import { useTrackingFilters } from './hooks/useTrackingFilters'
import { useAppOptions } from './hooks/useAppOptions'
import { useAppData } from './hooks/useAppData'
import { usePlayerActions } from './hooks/usePlayerActions'
import { useGameActions } from './hooks/useGameActions'
import { usePositionActions } from './hooks/usePositionActions'
import { useAppViewData } from './hooks/useAppViewData'
import { useOptimizerActions } from './hooks/useOptimizerActions'
import { useAttendanceActions } from './hooks/useAttendanceActions'
import { supabase } from './lib/supabase'
import {
  PRIORITY_POSITIONS,
  ALLOWED_POSITIONS,
  pk,
  blankLineup,
  requiredOutsForGame,
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

import { nextSort } from './lib/appHelpers'
import {
  TEAM_ID,
  ATTENDANCE_SEASON_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
  ATTENDANCE_SURFACE_OPTIONS,
} from './lib/constants'
import { getActivePlayerIds } from './lib/optimizerPlanHelpers'
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

  const {
    updatePriorityLocal,
    updateFitLocal,
    persistPriority,
    persistFitTier,
  } = usePositionActions({
    setAppError,
    setPriorityByPlayer,
    setFitByPlayer,
  })

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

  const {
    addAttendanceEvent,
    toggleAttendance,
    updateAttendanceEventField,
    deleteAttendanceEvent,
  } = useAttendanceActions({
    setAppError,
    activePlayers,
    setAttendanceEvents,
    setAttendanceByEvent,
    attendanceDate,
    setAttendanceDate,
    attendanceSeason,
    setAttendanceSeason,
    attendanceType,
    setAttendanceType,
    attendanceSurface,
    setAttendanceSurface,
    attendanceTitle,
    setAttendanceTitle,
  })

const {
  addGameFromGames,
  addGameFromOptimizer,
  updateGameField,
  deleteGame,
} = useGameActions({
  games,
  setGames,
  setAppError,
  defaultStatusOption,
  players,
  activePlayerIds,
  currentPlanLineupsByGame,
  lineupLockedByGame,
  setLineupsByGame,
  setLineupLockedByGame,
  setOptimizerPreviewByGame,
  setOptimizerBatchGameIds,
  setSelectedGameId,
  setOptimizerFocusGameId,
  setOptimizerExistingGameId,
  persistLineup,
  newGameDate,
  setNewGameDate,
  newGameOpponent,
  setNewGameOpponent,
  newGameType,
  setNewGameType,
  newGameSeason,
  setNewGameSeason,
  optimizerNewDate,
  setOptimizerNewDate,
  optimizerNewOpponent,
  setOptimizerNewOpponent,
  optimizerNewType,
  setOptimizerNewType,
  optimizerNewSeason,
  setOptimizerNewSeason,
})
  
    const {
    addExistingGameToBatch,
    removeBatchGame,
    runOptimizeAll,
    runOptimizeCurrent,
  } = useOptimizerActions({
    games,
    players,
    activePlayers,
    activePlayerIds,
    optimizerExistingGameId,
    optimizerFocusGameId,
    optimizerBatchGames,
    currentPlanLineupsByGame,
    lineupLockedByGame,
    lineupsByGame,
    lineupSetterFilteredTotals,
    optimizerMode,
    activeOptimizerProfile,
    activeOptimizerProfileRules,
    priorityByPlayer,
    fitByPlayer,
    optimizerPlanSitOutTargets,
    setAppError,
    setOptimizerBatchGameIds,
    setOptimizerFocusGameId,
    setOptimizerPreviewByGame,
    persistLineup,
  })

useEffect(() => {
  if (!lineupSetterStateLoaded) return

  async function saveLineupSetterState() {
    try {
      const res = await supabase.from('lineup_setter_state').upsert(
        {
          team_id: TEAM_ID,
          batch_game_ids: optimizerBatchGameIds.map(pk),
          focus_game_id: optimizerFocusGameId || null,
        },
        { onConflict: 'team_id' }
      )

      if (res.error) setAppError(res.error.message)
    } catch (error) {
      setAppError(error?.message || String(error || 'Failed to save lineup setter state.'))
    }
  }

  saveLineupSetterState()
}, [lineupSetterStateLoaded, optimizerBatchGameIds, optimizerFocusGameId, setAppError])
  
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

  function getSavedLineupForGame(gameId) {
  const existing = lineupsByGame[pk(gameId)]
  if (existing) return JSON.parse(JSON.stringify(existing))

  const game = games.find((g) => pk(g.id) === pk(gameId))

  return blankLineup(
    players.map((p) => p.id),
    Number(game?.innings || 6),
    activePlayerIds()
  )
}

function updateSavedLineup(gameId, updater) {
  const base = getSavedLineupForGame(gameId)
  const next = updater(base)

  setLineupsByGame((current) => ({
    ...current,
    [pk(gameId)]: JSON.parse(JSON.stringify(next)),
  }))

  return next
}

async function updateSavedAndPersist(gameId, updater) {
  if (lineupLockedByGame[pk(gameId)]) {
    setAppError('This lineup is locked. Unlock it before editing.')
    return
  }

  const next = updateSavedLineup(gameId, updater)
  await persistLineup(gameId, next)
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
