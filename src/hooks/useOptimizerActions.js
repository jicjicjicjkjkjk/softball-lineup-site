// src/hooks/useOptimizerActions.js

import {
  pk,
  computeTotals,
  addTotals,
  buildOptimizedLineup,
  rebalancePlanTowardPriorityTargets,
} from '../lib/lineupUtils'
import {
  getNormalizedLineupForGame,
  getOrderedOptimizerGames,
  buildEmptyOutCounts,
  addLineupOutsToPlanCounts,
  buildBatchCurrentOutsFromLineups,
  getOtherPreviewLineups,
  calculateTotalsBeforeCurrentGame,
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
          skipSingleGameRebalance: true,
        })

        next[gameId] = optimized
        addLineupOutsToPlanCounts(planAssignedOuts, optimized, players)
        rollingTotals = addTotals(rollingTotals, computeTotals([optimized], players), players)
      })

      const rebalancedNext = rebalancePlanTowardPriorityTargets({
        lineupsByGame: next,
        games: orderedGames,
        players,
        fitMap: fitByPlayer,
        priorityMap: priorityByPlayer,
        totalsBefore: lineupSetterFilteredTotals,
        lineupLockedByGame,
        optimizerProfileRules: activeOptimizerProfileRules,
      })

      Object.entries(rebalancedNext).forEach(([gameId, lineup]) => {
        persistLineup(gameId, lineup)
      })

      setOptimizerPreviewByGame((current) => ({ ...current, ...rebalancedNext }))
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
        skipSingleGameRebalance: false,
      })

      setOptimizerPreviewByGame((current) => ({ ...current, [gameId]: rebuilt }))
      persistLineup(game.id, rebuilt)
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
