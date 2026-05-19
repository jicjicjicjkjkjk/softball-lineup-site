import { useMemo } from 'react'
import { PRIORITY_POSITIONS, pk, blankLineup, computeTotals, addTotals } from '../lib/lineupUtils'
import {
  sortRows,
  compareGamesAsc,
  buildBattingOrderMatrix,
  buildSitOutSummary,
  buildPlayerSitOuts,
  buildPositionByPlayer,
} from '../lib/appHelpers'
import { buildCumulativeSitOutRows } from '../lib/sitOutHelpers'
import { buildCurrentPlanLineupsByGame } from '../lib/optimizerPlanHelpers'
import {
  buildOptimizerImportableGames,
  buildGameDetailImportableGames,
  buildActiveOptimizerProfile,
  buildActiveOptimizerProfileRules,
} from '../lib/optimizerViewHelpers'
import {
  buildAttendanceTotals,
  buildAttendanceBreakdownByPlayer,
} from '../lib/attendanceHelpers'

function isCompleteLineup(lineup) {
  if (!lineup) return false

  for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
    const assigned = Object.values(lineup.cells || {}).filter((p) => p?.[inning])
    if (assigned.length === 0) return false
  }

  return true
}

function playersForGamesWithLineups({
  gamesWithLineups = [],
  lineupsByGame = {},
  players = [],
  fallbackPlayers = [],
}) {
  const ids = new Set()

  gamesWithLineups.forEach((game) => {
    const lineup = lineupsByGame[pk(game.id)]

    Object.values(lineup?.cells || {}).forEach((cell) => {
      Object.values(cell || {}).forEach((playerId) => {
        if (playerId) ids.add(pk(playerId))
      })
    })
  })

  const lineupPlayers = players.filter((player) => ids.has(pk(player.id)))

  return lineupPlayers.length ? lineupPlayers : fallbackPlayers
}

export function useAppViewData({
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
}) {
  const activePlayers = useMemo(
    () => players.filter((p) => p.active !== false),
    [players]
  )

  const getGameLineupState = (game) => {
    if (lineupLockedByGame[pk(game.id)]) return 'Locked'
    if (lineupsByGame[pk(game.id)]) return 'Saved'
    return 'Empty'
  }

  const gameMatchesFilters = (game, filters) => {
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
      footer[pos] = activePriorityRows.reduce(
        (sum, row) => sum + Number(row[pos] || 0),
        0
      )
    })

    footer.subtotal = PRIORITY_POSITIONS.reduce(
      (sum, pos) => sum + Number(footer[pos] || 0),
      0
    )

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
        ? blankLineup(
            players.map((p) => p.id),
            Number(game.innings || 6),
            activePlayers.map((p) => pk(p.id))
          )
        : null)
    )
  }, [optimizerPreviewByGame, lineupsByGame, optimizerFocusGameId, games, players, activePlayers])

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

  const lineupSetterFilteredPlayers = useMemo(
    () =>
      playersForGamesWithLineups({
        gamesWithLineups: lineupSetterFilteredGamesWithLineups,
        lineupsByGame,
        players,
        fallbackPlayers: activePlayers,
      }),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame, players, activePlayers]
  )

  const lineupSetterFilteredLineups = useMemo(
    () =>
      lineupSetterFilteredGamesWithLineups
        .map((game) => lineupsByGame[pk(game.id)])
        .filter(Boolean),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame]
  )

  const lineupSetterFilteredTotals = useMemo(
    () => computeTotals(lineupSetterFilteredLineups, players),
    [lineupSetterFilteredLineups, players]
  )

  const lineupSetterSitSummary = useMemo(
    () => buildSitOutSummary(lineupSetterFilteredGamesWithLineups, lineupsByGame, lineupSetterFilteredPlayers, pk),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame, lineupSetterFilteredPlayers]
  )

  const lineupSetterSitByPlayer = useMemo(
    () => buildPlayerSitOuts(lineupSetterFilteredGamesWithLineups, lineupsByGame, lineupSetterFilteredPlayers, pk),
    [lineupSetterFilteredGamesWithLineups, lineupsByGame, lineupSetterFilteredPlayers]
  )

  const lineupSetterComputedSitRows = useMemo(
    () => buildCumulativeSitOutRows(lineupSetterSitByPlayer, lineupSetterSitSummary),
    [lineupSetterSitByPlayer, lineupSetterSitSummary]
  )

  const currentPlanLineupsByGame = useMemo(
    () => buildCurrentPlanLineupsByGame(lineupsByGame, optimizerPreviewByGame),
    [lineupsByGame, optimizerPreviewByGame]
  )

  const currentPlanPlayers = useMemo(
    () =>
      playersForGamesWithLineups({
        gamesWithLineups: optimizerBatchGames,
        lineupsByGame: currentPlanLineupsByGame,
        players,
        fallbackPlayers: activePlayers,
      }),
    [optimizerBatchGames, currentPlanLineupsByGame, players, activePlayers]
  )

  const currentPlanSitOutRows = useMemo(
    () =>
      buildCumulativeSitOutRows(
        buildPlayerSitOuts(optimizerBatchGames, currentPlanLineupsByGame, currentPlanPlayers, pk),
        buildSitOutSummary(optimizerBatchGames, currentPlanLineupsByGame, currentPlanPlayers, pk)
      ),
    [optimizerBatchGames, currentPlanLineupsByGame, currentPlanPlayers]
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

  const lineupSetterFuturePlayers = useMemo(
    () =>
      playersForGamesWithLineups({
        gamesWithLineups: lineupSetterFutureGamesWithLineups,
        lineupsByGame: currentPlanLineupsByGame,
        players,
        fallbackPlayers: activePlayers,
      }),
    [lineupSetterFutureGamesWithLineups, currentPlanLineupsByGame, players, activePlayers]
  )

  const lineupSetterFutureSitSummary = useMemo(
    () => buildSitOutSummary(lineupSetterFutureGamesWithLineups, currentPlanLineupsByGame, lineupSetterFuturePlayers, pk),
    [lineupSetterFutureGamesWithLineups, currentPlanLineupsByGame, lineupSetterFuturePlayers]
  )

  const lineupSetterFutureSitByPlayer = useMemo(
    () => buildPlayerSitOuts(lineupSetterFutureGamesWithLineups, currentPlanLineupsByGame, lineupSetterFuturePlayers, pk),
    [lineupSetterFutureGamesWithLineups, currentPlanLineupsByGame, lineupSetterFuturePlayers]
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

  const filteredTrackingPlayers = useMemo(
    () =>
      playersForGamesWithLineups({
        gamesWithLineups: filteredTrackingGamesWithLineups,
        lineupsByGame,
        players,
        fallbackPlayers: activePlayers,
      }),
    [filteredTrackingGamesWithLineups, lineupsByGame, players, activePlayers]
  )

  const filteredTrackingLineups = useMemo(
    () =>
      filteredTrackingGamesWithLineups
        .map((game) => lineupsByGame[pk(game.id)])
        .filter(Boolean),
    [filteredTrackingGamesWithLineups, lineupsByGame]
  )

  const battingRows = useMemo(
    () => buildBattingOrderMatrix(filteredTrackingGamesWithLineups, lineupsByGame, filteredTrackingPlayers, pk),
    [filteredTrackingGamesWithLineups, lineupsByGame, filteredTrackingPlayers]
  )

  const sitSummary = useMemo(
    () => buildSitOutSummary(filteredTrackingGamesWithLineups, lineupsByGame, filteredTrackingPlayers, pk),
    [filteredTrackingGamesWithLineups, lineupsByGame, filteredTrackingPlayers]
  )

  const sitByPlayer = useMemo(
    () => buildPlayerSitOuts(filteredTrackingGamesWithLineups, lineupsByGame, filteredTrackingPlayers, pk),
    [filteredTrackingGamesWithLineups, lineupsByGame, filteredTrackingPlayers]
  )

  const trackingComputedSitRows = useMemo(
    () => buildCumulativeSitOutRows(sitByPlayer),
    [sitByPlayer]
  )

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
        filteredTrackingPlayers.map((player) => {
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
    [filteredTrackingPlayers, trackingTotals, priorityByPlayer, trackingSort]
  )

  const trackingPriorityByPositionRows = useMemo(() => {
    const positionTotals = {}

    ;['P', 'C', '1B', '2B', '3B', 'SS', 'OF'].forEach((pos) => {
      positionTotals[pos] = filteredTrackingPlayers.reduce(
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

    return filteredTrackingPlayers.map((player) => {
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
  }, [filteredTrackingPlayers, trackingTotals, priorityByPlayer])

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

  return {
    activePlayers,
    getGameLineupState,
    gameMatchesFilters,
    selectedGame,
    selectedLineup,
    selectedLocked,
    sortedPlayers,
    sortedGames,
    orderedGamesAsc,
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
  }
}
