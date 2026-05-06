import { pk, blankLineup, normalizeLineup, computeTotals, addTotals } from './lineupUtils'

export function getActivePlayerIds(activePlayers = []) {
  return activePlayers.map((player) => pk(player.id))
}

export function buildCurrentPlanLineupsByGame(lineupsByGame = {}, optimizerPreviewByGame = {}) {
  const merged = { ...lineupsByGame }

  Object.entries(optimizerPreviewByGame || {}).forEach(([gameId, lineup]) => {
    if (lineup) merged[pk(gameId)] = lineup
  })

  return merged
}

export function getLineupForGame({
  game,
  players,
  activePlayers,
  currentPlanLineupsByGame,
}) {
  const gameId = pk(game.id)

  return (
    currentPlanLineupsByGame?.[gameId] ||
    blankLineup(
      players.map((player) => player.id),
      Number(game.innings || 6),
      getActivePlayerIds(activePlayers)
    )
  )
}

export function getNormalizedLineupForGame({
  game,
  players,
  activePlayers,
  currentPlanLineupsByGame,
}) {
  const source = getLineupForGame({
    game,
    players,
    activePlayers,
    currentPlanLineupsByGame,
  })

  return normalizeLineup(
    source,
    players,
    Number(source?.innings || game?.innings || 6),
    source?.availablePlayerIds || getActivePlayerIds(activePlayers)
  )
}

export function getOrderedOptimizerGames(optimizerBatchGames = []) {
  return [...optimizerBatchGames].sort((a, b) => {
    const aKey = `${a.date || ''}-${String(a.game_order || 0).padStart(2, '0')}-${a.id}`
    const bKey = `${b.date || ''}-${String(b.game_order || 0).padStart(2, '0')}-${b.id}`
    return aKey.localeCompare(bKey)
  })
}

export function buildEmptyOutCounts(players = []) {
  const outCounts = {}

  players.forEach((player) => {
    outCounts[pk(player.id)] = 0
  })

  return outCounts
}

export function countOutsInLineup(lineup, playerId) {
  return Object.values(lineup?.cells?.[pk(playerId)] || {}).filter(
    (value) => value === 'Out'
  ).length
}

export function addLineupOutsToPlanCounts(planAssignedOuts, lineup, players = []) {
  players.forEach((player) => {
    const id = pk(player.id)
    planAssignedOuts[id] =
      Number(planAssignedOuts[id] || 0) + countOutsInLineup(lineup, id)
  })

  return planAssignedOuts
}

export function buildBatchCurrentOutsFromLineups(lineups = [], players = []) {
  const outCounts = buildEmptyOutCounts(players)

  lineups.forEach((lineup) => {
    addLineupOutsToPlanCounts(outCounts, lineup, players)
  })

  return outCounts
}

export function getOtherPreviewLineups({
  optimizerBatchGames = [],
  currentPlanLineupsByGame = {},
  focusGameId,
}) {
  return optimizerBatchGames
    .filter((batchGame) => pk(batchGame.id) !== pk(focusGameId))
    .map((batchGame) => currentPlanLineupsByGame[pk(batchGame.id)])
    .filter(Boolean)
}

export function calculateTotalsBeforeCurrentGame({
  lineupSetterFilteredTotals,
  otherPreviewLineups,
  players,
}) {
  return addTotals(
    lineupSetterFilteredTotals,
    computeTotals(otherPreviewLineups, players),
    players
  )
}
