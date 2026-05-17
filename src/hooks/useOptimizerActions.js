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
  optimizerPreviewByGame,
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
    setOptimizerPreviewByGame((current) => ({
      ...current,
      [gameId]: {
        ...normalized,
        ...(current?.[gameId] || {}),
        gameSitOutTargets: {
          ...(normalized?.gameSitOutTargets || {}),
          ...(current?.[gameId]?.gameSitOutTargets || {}),
        },
      },
    }))
  }

  function removeBatchGame(gameId) {
    const safeGameId = pk(gameId)

    setOptimizerBatchGameIds((current) =>
      current.filter((id) => pk(id) !== safeGameId)
    )

    if (lineupsByGame?.[safeGameId]) return

    setOptimizerPreviewByGame((current) => {
      const next = { ...(current || {}) }
      delete next[safeGameId]
      return next
    })
  }

  function buildSourcePlan(planGames) {
    const sourceLineupsByGame = {}
    const availableIdsByGame = {}

    planGames.forEach((game) => {
      const gameId = pk(game.id)

      const normalized = getNormalizedLineupForGame({
        game,
        players,
        activePlayers,
        currentPlanLineupsByGame,
      })

      const preview =
        optimizerPreviewByGame?.[gameId] ||
        currentPlanLineupsByGame?.[gameId] ||
        lineupsByGame?.[gameId] ||
        normalized

      const source = {
        ...normalized,
        ...preview,
        cells: preview?.cells || normalized?.cells || {},
        availablePlayerIds:
          preview?.availablePlayerIds ||
          normalized?.availablePlayerIds ||
          activePlayerIds(),
        gameSitOutTargets: {
          ...(normalized?.gameSitOutTargets || {}),
          ...(preview?.gameSitOutTargets || {}),
        },
      }

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

      setOptimizerPreviewByGame((current) => ({
        ...(current || {}),
        ...optimizedPlan,
      }))
    } catch (error) {
      setAppError(error?.message || 'Optimize all failed.')
    }
  }

  function runOptimizeCurrent() {
    try {
      if (!optimizerFocusGameId) return

      const gameId = pk(optimizerFocusGameId)

      if (lineupLockedByGame?.[gameId]) {
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

      const rebuilt = optimizedPlan?.[gameId]
      if (!rebuilt) return

      setOptimizerPreviewByGame((current) => ({
        ...(current || {}),
        [gameId]: rebuilt,
      }))

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
