// FILE: src/lib/trackingSummaryHelpers.js

import { pk, computeTotals, addTotals } from './lineupUtils'
import {
  sortRows,
  buildBattingOrderMatrix,
  buildSitOutSummary,
  buildPlayerSitOuts,
  buildPositionByPlayer,
} from './appHelpers'
import { buildCumulativeSitOutRows } from './sitOutHelpers'

export function isCompleteLineup(lineup) {
  if (!lineup) return false

  const innings = lineup.innings || 0

  for (let inning = 1; inning <= innings; inning += 1) {
    const assigned = Object.values(lineup.cells || {}).filter((p) => p?.[inning])
    if (assigned.length === 0) return false
  }

  return true
}

export function buildFilteredGames({
  orderedGamesAsc,
  trackingFilters,
  gameMatchesFilters,
}) {
  return (orderedGamesAsc || []).filter((game) =>
    gameMatchesFilters(game, trackingFilters)
  )
}

export function buildGamesWithLineups({
  games,
  lineupsByGame,
}) {
  return (games || []).filter((game) => lineupsByGame?.[pk(game.id)])
}

export function buildLineupsFromGames({
  gamesWithLineups,
  lineupsByGame,
}) {
  return (gamesWithLineups || [])
    .map((game) => lineupsByGame?.[pk(game.id)])
    .filter(Boolean)
}

export function buildLineupSetterTrackingData({
  orderedGamesAsc,
  trackingFilters,
  gameMatchesFilters,
  optimizerBatchGameIds,
  lineupsByGame,
  currentPlanLineupsByGame,
  optimizerBatchGames,
  activePlayers,
  players,
}) {
  const filteredGames = buildFilteredGames({
    orderedGamesAsc,
    trackingFilters,
    gameMatchesFilters,
  })

  const filteredGamesExcludingBatch = filteredGames.filter(
    (game) => !(optimizerBatchGameIds || []).includes(pk(game.id))
  )

  const filteredGamesWithLineups = buildGamesWithLineups({
    games: filteredGamesExcludingBatch,
    lineupsByGame,
  })

  const filteredLineups = buildLineupsFromGames({
    gamesWithLineups: filteredGamesWithLineups,
    lineupsByGame,
  })

  const filteredTotals = computeTotals(filteredLineups, players)

  const sitSummary = buildSitOutSummary(
    filteredGamesWithLineups,
    lineupsByGame,
    activePlayers,
    pk
  )

  const sitByPlayer = buildPlayerSitOuts(
    filteredGamesWithLineups,
    lineupsByGame,
    activePlayers,
    pk
  )

  const computedSitRows = buildCumulativeSitOutRows(sitByPlayer, sitSummary)

  const currentPlanSitSummary = buildSitOutSummary(
    optimizerBatchGames,
    currentPlanLineupsByGame,
    activePlayers,
    pk
  )

  const currentPlanSitByPlayer = buildPlayerSitOuts(
    optimizerBatchGames,
    currentPlanLineupsByGame,
    activePlayers,
    pk
  )

  const currentPlanSitOutRows = buildCumulativeSitOutRows(
    currentPlanSitByPlayer,
    currentPlanSitSummary
  )

  const currentBatchTotals = computeTotals(
    (optimizerBatchGames || [])
      .map((game) => currentPlanLineupsByGame?.[pk(game.id)])
      .filter(isCompleteLineup),
    players
  )

  const futureTotals = addTotals(filteredTotals, currentBatchTotals, players)

  const futureGamesWithLineups = [
    ...filteredGamesWithLineups,
    ...(optimizerBatchGames || []),
  ]

  const futureSitSummary = buildSitOutSummary(
    futureGamesWithLineups,
    currentPlanLineupsByGame,
    activePlayers,
    pk
  )

  const futureSitByPlayer = buildPlayerSitOuts(
    futureGamesWithLineups,
    currentPlanLineupsByGame,
    activePlayers,
    pk
  )

  const futureComputedSitRows = buildCumulativeSitOutRows(
    futureSitByPlayer,
    futureSitSummary
  )

  return {
    filteredGames,
    filteredGamesExcludingBatch,
    filteredGamesWithLineups,
    filteredLineups,
    filteredTotals,
    sitSummary,
    sitByPlayer,
    computedSitRows,
    currentPlanSitOutRows,
    currentBatchTotals,
    futureTotals,
    futureGamesWithLineups,
    futureComputedSitRows,
  }
}

export function buildTrackingPageData({
  orderedGamesAsc,
  trackingFilters,
  gameMatchesFilters,
  lineupsByGame,
  activePlayers,
  players,
  trackingPlayerId,
}) {
  const filteredTrackingGames = buildFilteredGames({
    orderedGamesAsc,
    trackingFilters,
    gameMatchesFilters,
  })

  const filteredTrackingGamesWithLineups = buildGamesWithLineups({
    games: filteredTrackingGames,
    lineupsByGame,
  })

  const filteredTrackingLineups = buildLineupsFromGames({
    gamesWithLineups: filteredTrackingGamesWithLineups,
    lineupsByGame,
  })

  const battingRows = buildBattingOrderMatrix(
    filteredTrackingGamesWithLineups,
    lineupsByGame,
    activePlayers,
    pk
  )

  const sitSummary = buildSitOutSummary(
    filteredTrackingGamesWithLineups,
    lineupsByGame,
    activePlayers,
    pk
  )

  const sitByPlayer = buildPlayerSitOuts(
    filteredTrackingGamesWithLineups,
    lineupsByGame,
    activePlayers,
    pk
  )

  const trackingComputedSitRows = buildCumulativeSitOutRows(sitByPlayer)

  const trackingTotals = computeTotals(filteredTrackingLineups, players)

  const selectedPlayerPositions = trackingPlayerId
    ? buildPositionByPlayer(
        filteredTrackingGamesWithLineups,
        lineupsByGame,
        pk(trackingPlayerId),
        pk
      )
    : []

  return {
    filteredTrackingGames,
    filteredTrackingGamesWithLineups,
    filteredTrackingLineups,
    battingRows,
    sitSummary,
    sitByPlayer,
    trackingComputedSitRows,
    trackingTotals,
    selectedPlayerPositions,
  }
}

export function buildTrackingPriorityRows({
  activePlayers,
  trackingTotals,
  priorityByPlayer,
  trackingSort,
}) {
  return sortRows(
    (activePlayers || []).map((player) => {
      const totals = trackingTotals?.[pk(player.id)] || {}
      const priority = priorityByPlayer?.[pk(player.id)] || {}
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
}

export function buildTrackingPriorityByPositionRows({
  activePlayers,
  trackingTotals,
  priorityByPlayer,
}) {
  const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']

  const positionTotals = {}

  positions.forEach((pos) => {
    positionTotals[pos] = (activePlayers || []).reduce(
      (sum, player) => sum + Number(trackingTotals?.[pk(player.id)]?.[pos] || 0),
      0
    )
  })

  const actPctByPosition = (playerTotal, positionKey) => {
    const numer = Number(playerTotal || 0)
    const denom = Number(positionTotals[positionKey] || 0)
    if (!numer || !denom) return ''
    return Number(((numer / denom) * 100).toFixed(1))
  }

  return (activePlayers || []).map((player) => {
    const playerId = pk(player.id)
    const totals = trackingTotals?.[playerId] || {}
    const priority = priorityByPlayer?.[playerId] || {}

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
}
