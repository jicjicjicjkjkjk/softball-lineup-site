// src/hooks/useOptimizerActions.js

import {
  pk,
  optimizeLineupPlan,
} from '../lib/lineupUtils'
import {
  getNormalizedLineupForGame,
  getOrderedOptimizerGames,
} from '../lib/optimizerPlanHelpers'

export function useOptimizerActions({
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
}) {
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

  function buildSourcePlan(planGames) {
    const sourceLineupsByGame = {}
    const availableIdsByGame = {}

    planGames.forEach((game) => {
      const gameId = pk(game.id)

      const source = getNormalizedLineupForGame({
        game,
        players,
        activePlayers,
        currentPlanLineupsByGame,
      })

      sourceLineupsByGame[gameId] = source
      availableIdsByGame[gameId] = (source.availablePlayerIds || activePlayerIds()).map(pk)
    })

    return { sourceLineupsByGame, availableIdsByGame }
  }

  function runOptimizeAll() {
    try {
      if (!optimizerBatchGames.length) return alert('No games in plan')

      const orderedGames = getOrderedOptimizerGames(optimizerBatchGames)
      const { sourceLineupsByGame, availableIdsByGame } = buildSourcePlan(orderedGames)

      const optimizedPlan = optimizeLineupPlan({
        games: orderedGames,
        players,
        sourceLineupsByGame,
        availableIdsByGame,
        lineupLockedByGame,
        totalsBefore: lineupSetterFilteredTotals,
        priorityMap: priorityByPlayer,
        fitMap: fitByPlayer,
        planSitOutTargets: optimizerPlanSitOutTargets,
        optimizerProfile: activeOptimizerProfile,
        optimizerProfileRules: activeOptimizerProfileRules,
        optimizerMode,
      })

      Object.entries(optimizedPlan).forEach(([gameId, lineup]) => {
        persistLineup(gameId, lineup)
      })

      setOptimizerPreviewByGame((current) => ({ ...current, ...optimizedPlan }))
    } catch (error) {
      setAppError(error?.message || 'Optimize all failed.')
    }
  }

  function runOptimizeCurrent() {
    try {
      if (!optimizerFocusGameId) return

      const gameId = pk(optimizerFocusGameId)

      if (lineupLockedByGame[gameId]) {
        return setAppError('This lineup is locked. Unlock it before optimizing.')
      }

      const game = games.find((g) => pk(g.id) === gameId)
      if (!game) return

      const { sourceLineupsByGame, availableIdsByGame } = buildSourcePlan([game])

      const optimizedPlan = optimizeLineupPlan({
        games: [game],
        players,
        sourceLineupsByGame,
        availableIdsByGame,
        lineupLockedByGame,
        totalsBefore: lineupSetterFilteredTotals,
        priorityMap: priorityByPlayer,
        fitMap: fitByPlayer,
        planSitOutTargets: optimizerPlanSitOutTargets,
        optimizerProfile: activeOptimizerProfile,
        optimizerProfileRules: activeOptimizerProfileRules,
        optimizerMode,
      })

      const rebuilt = optimizedPlan[gameId]
      if (!rebuilt) return

      setOptimizerPreviewByGame((current) => ({ ...current, [gameId]: rebuilt }))
      persistLineup(gameId, rebuilt)
    } catch (error) {
      setAppError(error?.message || 'Optimize current failed.')
    }
  }

  return {
    addExistingGameToBatch,
    removeBatchGame,
    runOptimizeAll,
    runOptimizeCurrent,
  }
}
