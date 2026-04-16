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
} from './lib/lineupUtils'

import GamesPage from './Pages/GamesPage'
import TrackingTable from './Components/TrackingTable'
import AttendancePage from './Pages/AttendancePage'
import {
  nextSort,
  sortRows,
  formatDateShort,
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
import {
  TEAM_ID,
  ATTENDANCE_SEASON_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
  ATTENDANCE_SURFACE_OPTIONS,
} from './lib/constants'

function dbReady() {
  return Boolean(supabase)
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

  const [trackingThroughDate, setTrackingThroughDate] = useState('')
  const [trackingGameType, setTrackingGameType] = useState('All')
  const [trackingPlayerId, setTrackingPlayerId] = useState('')

  const [attendanceDate, setAttendanceDate] = useState('')
  const [attendanceSeason, setAttendanceSeason] = useState(ATTENDANCE_SEASON_OPTIONS[0])
  const [attendanceType, setAttendanceType] = useState(ATTENDANCE_TYPE_OPTIONS[0])
  const [attendanceSurface, setAttendanceSurface] = useState(ATTENDANCE_SURFACE_OPTIONS[0])
  const [attendanceTitle, setAttendanceTitle] = useState('')


  

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
    gamesWithLineups={orderedGamesAsc.filter((g) => lineupsByGame[pk(g.id)])}
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
