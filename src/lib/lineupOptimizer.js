// src/lib/lineupOptimizer.js

import { FIELD_POSITIONS } from './lineupConstants'
import { pk, clone, normalizeLineup, lockedValue } from './lineupCore'
import { computeTotals, addTotals } from './lineupTotals'
import {
  fitTier,
  priorityValue,
  normalizeFit,
  fitAllowedByRule,
  getPositionRule,
  positionBucket,
  positionFillRank,
  positionImportance,
  consecutiveMode,
} from './optimizerFits'
import { validateLineup } from './lineupValidation'

const POSITION_BUCKETS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']

function blankBucketCounts(extra = {}) {
  return {
    P: 0,
    C: 0,
    '1B': 0,
    '2B': 0,
    '3B': 0,
    SS: 0,
    OF: 0,
    ...extra,
  }
}

function fitQuality(fit) {
  if (fit === 'primary') return 4
  if (fit === 'secondary') return 3
  if (fit === 'development') return 2
  return 1
}

function getEligiblePlayerIdsForInning(lineup, inning, players) {
  const availableSet = new Set((lineup?.availablePlayerIds || []).map(pk))

  return (players || [])
    .map((player) => pk(player.id))
    .filter((id) => {
      if (!availableSet.has(id)) return false
      return (lineup?.cells?.[id]?.[inning] || '') !== 'Injury'
    })
}

function getLockedAssignmentsForInning(lineup, inning, players) {
  const lockedFieldPlayers = new Set()
  const lockedOutPlayers = new Set()
  const assignedPositions = new Set()

  ;(players || []).forEach((player) => {
    const id = pk(player.id)

    if (!lockedValue(lineup, id, inning)) return

    const value = lineup?.cells?.[id]?.[inning] || ''
    if (!value) return

    if (value === 'Out') {
      lockedOutPlayers.add(id)
      return
    }

    if (FIELD_POSITIONS.includes(value)) {
      lockedFieldPlayers.add(id)
      assignedPositions.add(value)
    }
  })

  return {
    lockedFieldPlayers,
    lockedOutPlayers,
    assignedPositions,
    lockedOuts: lockedOutPlayers.size,
  }
}

function countPlayerOuts(lineup, playerId) {
  const id = pk(playerId)
  const innings = Number(lineup?.innings || 0)
  let total = 0

  for (let inning = 1; inning <= innings; inning += 1) {
    if (lineup?.cells?.[id]?.[inning] === 'Out') total += 1
  }

  return total
}

function previousOutDistance(lineup, playerId, inning) {
  const id = pk(playerId)

  for (let prev = inning - 1; prev >= 1; prev -= 1) {
    if ((lineup?.cells?.[id]?.[prev] || '') === 'Out') return inning - prev
  }

  return 999
}

function nextLockedOutDistance(lineup, playerId, inning, innings) {
  const id = pk(playerId)

  for (let next = inning + 1; next <= innings; next += 1) {
    if (
      lockedValue(lineup, id, next) &&
      (lineup?.cells?.[id]?.[next] || '') === 'Out'
    ) {
      return next - inning
    }
  }

  return 999
}

function violatesSitSpacing(lineup, playerId, inning, innings, minGap = 2) {
  const gap = Number(minGap || 0)
  if (gap <= 0) return false

  const prev = previousOutDistance(lineup, playerId, inning)
  const next = nextLockedOutDistance(lineup, playerId, inning, innings)

  return prev <= gap || next <= gap
}

function clearUnlockedCells(lineup, players) {
  ;(players || []).forEach((player) => {
    const id = pk(player.id)

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      if (lockedValue(lineup, id, inning)) continue

      const current = lineup?.cells?.[id]?.[inning] || ''
      if (current !== 'Injury') {
        lineup.cells[id][inning] = ''
      }
    }
  })
}

function expectedFieldInningsForPlayer(lineup, playerId) {
  const id = pk(playerId)
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)
  const innings = Number(lineup?.innings || 0)

  if (!availableIds.includes(id)) return 0

  let expected = 0

  for (let inning = 1; inning <= innings; inning += 1) {
    const eligibleIds = availableIds.filter(
      (pid) => (lineup?.cells?.[pid]?.[inning] || '') !== 'Injury'
    )

    if (!eligibleIds.includes(id)) continue

    const fieldersNeeded = Math.min(9, eligibleIds.length)
    expected += fieldersNeeded / Math.max(eligibleIds.length, 1)
  }

  return expected
}

function buildExpectedFieldTotalsForPlan(games, lineupsByGame, players) {
  const totals = {}

  ;(players || []).forEach((player) => {
    totals[pk(player.id)] = 0
  })

  ;(games || []).forEach((game) => {
    const gameId = pk(game.id)
    const lineup = lineupsByGame?.[gameId]
    if (!lineup) return

    ;(players || []).forEach((player) => {
      const id = pk(player.id)
      totals[id] += expectedFieldInningsForPlayer(lineup, id)
    })
  })

  return totals
}

function makeTargetCounts({ players, priorityMap, expectedFieldTotals }) {
  const targets = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    const expectedFieldTotal = Number(expectedFieldTotals?.[id] || 0)

    targets[id] = blankBucketCounts()

    POSITION_BUCKETS.forEach((bucket) => {
      const pct = Number(priorityValue(priorityMap, id, bucket) || 0)
      targets[id][bucket] = pct > 0 ? Math.round((expectedFieldTotal * pct) / 100) : 0
    })
  })

  return targets
}

function makeActualCounts(players) {
  const counts = {}

  ;(players || []).forEach((player) => {
    counts[pk(player.id)] = blankBucketCounts({ Out: 0, fieldTotal: 0 })
  })

  return counts
}

function addExistingLockedCounts({ lineup, players, actualCounts }) {
  const innings = Number(lineup?.innings || 0)

  for (let inning = 1; inning <= innings; inning += 1) {
    ;(players || []).forEach((player) => {
      const id = pk(player.id)
      const value = lineup?.cells?.[id]?.[inning] || ''

      if (!lockedValue(lineup, id, inning)) return

      if (FIELD_POSITIONS.includes(value)) {
        const bucket = positionBucket(value)
        actualCounts[id][bucket] += 1
        actualCounts[id].fieldTotal += 1
      }

      if (value === 'Out') {
        actualCounts[id].Out += 1
      }
    })
  }
}

function allowedAt({ playerId, position, fitMap, optimizerProfileRules }) {
  const rule = getPositionRule(optimizerProfileRules, position)
  const fit = normalizeFit(fitTier(fitMap, playerId, position))
  return fitAllowedByRule(rule, fit)
}

function canFillAllPositions({
  lineup,
  inning,
  players,
  fitMap,
  optimizerProfileRules,
  candidateOuts,
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  const openPositions = FIELD_POSITIONS.filter(
    (position) => !lockedInfo.assignedPositions.has(position)
  )

  const usableIds = eligibleIds.filter((id) => {
    if (candidateOuts.has(id)) return false
    if (lockedInfo.lockedFieldPlayers.has(id)) return false
    if (lockedInfo.lockedOutPlayers.has(id)) return false
    return true
  })

  const candidatesByPosition = {}

  openPositions.forEach((position) => {
    candidatesByPosition[position] = usableIds.filter((id) =>
      allowedAt({
        playerId: id,
        position,
        fitMap,
        optimizerProfileRules,
      })
    )
  })

  const orderedPositions = [...openPositions].sort((a, b) => {
    return (
      (candidatesByPosition[a]?.length || 0) -
      (candidatesByPosition[b]?.length || 0)
    )
  })

  function search(index, usedIds) {
    if (index >= orderedPositions.length) return true

    const position = orderedPositions[index]
    const candidates = candidatesByPosition[position] || []

    for (const id of candidates) {
      if (usedIds.has(id)) continue

      usedIds.add(id)

      if (search(index + 1, usedIds)) return true

      usedIds.delete(id)
    }

    return false
  }

  return search(0, new Set())
}

function chooseOutsForInning({
  lineup,
  inning,
  innings,
  players,
  fitMap,
  totalsBefore = {},
  planTotalsBefore = {},
  targetCounts = {},
  actualCounts = {},
  planSitOutTargets = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  const fieldersNeeded = Math.min(9, eligibleIds.length)
  const expectedOuts = Math.max(0, eligibleIds.length - fieldersNeeded)

  if (expectedOuts <= lockedInfo.lockedOuts) return []

  const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)

    const gameSitOutTargets = lineup?.gameSitOutTargets || {}

  function hasGameTarget(id) {
    const raw = gameSitOutTargets?.[id]
    return raw !== '' && raw !== null && raw !== undefined
  }

  function gameTargetFor(id) {
    return hasGameTarget(id) ? Number(gameSitOutTargets[id]) : null
  }

  function hasPlanTarget(id) {
    const raw = planSitOutTargets?.[id]
    return raw !== '' && raw !== null && raw !== undefined
  }

  function planTargetFor(id) {
    return hasPlanTarget(id) ? Number(planSitOutTargets[id]) : null
  }

    function targetInfoFor(id) {
    const gameTarget = gameTargetFor(id)
    const planTarget = planTargetFor(id)

    const validGameTarget = gameTarget !== null && !Number.isNaN(gameTarget)
    const validPlanTarget = planTarget !== null && !Number.isNaN(planTarget)

    const currentGameOuts = countPlayerOuts(lineup, id)
    const currentPlanOuts =
      Number(planTotalsBefore?.[id]?.Out || 0) + Number(actualCounts?.[id]?.Out || 0)

    const gameNeed = validGameTarget ? gameTarget - currentGameOuts : 0
    const planNeed = validPlanTarget ? planTarget - currentPlanOuts : 0

    return {
      hasGameTarget: validGameTarget,
      hasPlanTarget: validPlanTarget,
      hasAnyTarget: validGameTarget || validPlanTarget,
      gameNeed,
      planNeed,
      combinedNeed: Math.max(gameNeed, planNeed, 0),
      actualOutsForTarget: validGameTarget ? currentGameOuts : currentPlanOuts,
      displayTarget: validGameTarget ? gameTarget : validPlanTarget ? planTarget : null,
    }
  }

  function remainingEligibleChances(id) {
    let count = 0

    for (let next = inning; next <= innings; next += 1) {
      if (!getEligiblePlayerIdsForInning(lineup, next, players).includes(id)) continue
      if (lockedValue(lineup, id, next) && lineup?.cells?.[id]?.[next] !== 'Out') continue
      count += 1
    }

    return count
  }

  const candidates = eligibleIds
    .filter((id) => !lockedInfo.lockedFieldPlayers.has(id))
    .filter((id) => !lockedInfo.lockedOutPlayers.has(id))
        .map((id) => {
      const targetInfo = targetInfoFor(id)
       const actualOuts = Number(actualCounts?.[id]?.Out || 0)
      const planOutsSoFar =
        Number(planTotalsBefore?.[id]?.Out || 0) + Number(actualCounts?.[id]?.Out || 0)
      const spacingBad = violatesSitSpacing(lineup, id, inning, innings, minGap)
      const remainingChances = remainingEligibleChances(id)

      return {
        id,
        explicitTarget: targetInfo.displayTarget,
        hasExplicit: targetInfo.hasAnyTarget,
        explicitNeed: targetInfo.combinedNeed,
        actualOuts,
        planOutsSoFar,
        actualOutsForTarget: targetInfo.actualOutsForTarget,
        hasGameSpecificTarget: targetInfo.hasGameTarget,
        hasPlanTarget: targetInfo.hasPlanTarget,
        gameNeed: targetInfo.gameNeed,
        planNeed: targetInfo.planNeed,
        seasonOuts: 0,
        spacingBad,
        urgent: targetInfo.combinedNeed > 0 && targetInfo.combinedNeed >= remainingChances,
        name: (players || []).find((player) => pk(player.id) === id)?.name || '',
      }
    })

  const chosen = new Set(lockedInfo.lockedOutPlayers)

  function canChoose(row, allowSpacing = false, allowOverTarget = false) {
    if (chosen.size >= expectedOuts) return false
    if (chosen.has(row.id)) return false

    // HARD RULE: a player with a target cannot exceed that target unless there is literally no other legal way.
    if (row.hasExplicit && row.explicitNeed <= 0 && !allowOverTarget) return false

    // Sit gap is softer than target outs.
    if (row.spacingBad && !allowSpacing) return false

    const test = new Set(chosen)
    test.add(row.id)

    return canFillAllPositions({
      lineup,
      inning,
      players,
      fitMap,
      optimizerProfileRules,
      candidateOuts: test,
    })
  }

  function chooseFrom(rows, allowSpacing = false, allowOverTarget = false) {
    for (const row of rows) {
      if (chosen.size >= expectedOuts) break
      if (canChoose(row, allowSpacing, allowOverTarget)) {
        chosen.add(row.id)
      }
    }
  }

  const neededTargetRows = candidates
    .filter((row) => row.hasExplicit && row.explicitNeed > 0)
    .sort((a, b) => {
      if (a.urgent !== b.urgent) return a.urgent ? -1 : 1
      if (a.planNeed !== b.planNeed) return b.planNeed - a.planNeed
      if (a.gameNeed !== b.gameNeed) return b.gameNeed - a.gameNeed
      if (a.explicitNeed !== b.explicitNeed) return b.explicitNeed - a.explicitNeed
      if (a.spacingBad !== b.spacingBad) return a.spacingBad ? 1 : -1
      return a.name.localeCompare(b.name)
    })

  const noTargetRows = candidates
    .filter((row) => !row.hasExplicit)
    .sort((a, b) => {
      if (a.spacingBad !== b.spacingBad) return a.spacingBad ? 1 : -1
      if (a.planOutsSoFar !== b.planOutsSoFar) return a.planOutsSoFar - b.planOutsSoFar
      if (a.actualOuts !== b.actualOuts) return a.actualOuts - b.actualOuts
      return a.name.localeCompare(b.name)
    })

  const cappedTargetRows = candidates
    .filter((row) => row.hasExplicit && row.explicitNeed <= 0)
    .sort((a, b) => {
      if (a.planOutsSoFar !== b.planOutsSoFar) return a.planOutsSoFar - b.planOutsSoFar
      if (a.actualOuts !== b.actualOuts) return a.actualOuts - b.actualOuts
      return a.name.localeCompare(b.name)
    })
  
    // 1. First satisfy players who still need target outs, while respecting sit spacing.
  chooseFrom(neededTargetRows, false, false)

  // 2. Use players with no explicit target, while respecting sit spacing.
  chooseFrom(noTargetRows, false, false)

  // 3. If still short, allow capped target players, but still respect sit spacing.
  chooseFrom(cappedTargetRows, false, true)

  // 4. Do not break sit spacing just to hit targets.
// If targets cannot be met legally, leave the target short.
chooseFrom(cappedTargetRows, false, true)

  return [...chosen].filter((id) => !lockedInfo.lockedOutPlayers.has(id))
}

function scorePlayerForPosition({
  playerId,
  position,
  lineup,
  inning,
  fitMap,
  priorityMap,
  targetCounts,
  actualCounts,
  optimizerProfileRules,
}) {
  const id = pk(playerId)
  const bucket = positionBucket(position)
  const fit = normalizeFit(fitTier(fitMap, id, position))
  const quality = fitQuality(fit)
  const priorityPct = Number(priorityValue(priorityMap, id, bucket) || 0)
  const actual = Number(actualCounts?.[id]?.[bucket] || 0)
  const target = Number(targetCounts?.[id]?.[bucket] || 0)
  const remainingTarget = target - actual
  const importance = Number(positionImportance(optimizerProfileRules, position) || 1)
  const prevValue = inning > 1 ? lineup?.cells?.[id]?.[inning - 1] || '' : ''
  const mode = consecutiveMode(optimizerProfileRules, position)

  let score = 0

  score += remainingTarget > 0 ? remainingTarget * 1000000 : remainingTarget * 350000
  score += quality * 150000 * importance
  score += priorityPct * 5000

  if (prevValue === position) {
    score += mode === 'prefer' || mode === 'must_2' ? 50000 : 15000
  }

  if (mode === 'must_2' && inning > 1 && prevValue !== position) {
    const previousHolder = Object.keys(lineup?.cells || {}).find(
      (otherId) => lineup?.cells?.[otherId]?.[inning - 1] === position
    )

    if (previousHolder && previousHolder !== id) {
      score -= 40000
    }
  }

  return score
}

function assignPositionsForInning({
  lineup,
  inning,
  players,
  fitMap,
  priorityMap,
  targetCounts,
  actualCounts,
  optimizerProfileRules = {},
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  const openPositions = FIELD_POSITIONS
    .filter((position) => !lockedInfo.assignedPositions.has(position))
    .sort((a, b) => {
      return (
        positionFillRank(optimizerProfileRules, a) -
          positionFillRank(optimizerProfileRules, b) ||
        positionImportance(optimizerProfileRules, b) -
          positionImportance(optimizerProfileRules, a)
      )
    })

  const candidateIds = eligibleIds.filter((id) => {
    if (lockedInfo.lockedFieldPlayers.has(id)) return false
    if (lockedInfo.lockedOutPlayers.has(id)) return false
    if (lineup?.cells?.[id]?.[inning] === 'Out') return false
    return true
  })

  const candidatesByPosition = {}

  openPositions.forEach((position) => {
    const strictCandidates = candidateIds
      .filter((id) =>
        allowedAt({
          playerId: id,
          position,
          fitMap,
          optimizerProfileRules,
        })
      )
      .map((id) => ({
        id,
        score: scorePlayerForPosition({
          playerId: id,
          position,
          lineup,
          inning,
          fitMap,
          priorityMap,
          targetCounts,
          actualCounts,
          optimizerProfileRules,
        }),
      }))
      .sort((a, b) => b.score - a.score)

    const emergencyCandidates = candidateIds
      .filter((id) => !strictCandidates.some((row) => row.id === id))
      .map((id) => ({
        id,
        score:
          scorePlayerForPosition({
            playerId: id,
            position,
            lineup,
            inning,
            fitMap,
            priorityMap,
            targetCounts,
            actualCounts,
            optimizerProfileRules,
          }) - 2500000,
      }))
      .sort((a, b) => b.score - a.score)

        candidatesByPosition[position] = strictCandidates
  })

    const orderedPositions = [...openPositions]
    .filter((position) => (candidatesByPosition[position]?.length || 0) > 0)
    .sort((a, b) => {
      return (
        (candidatesByPosition[a]?.length || 0) -
          (candidatesByPosition[b]?.length || 0) ||
        positionFillRank(optimizerProfileRules, a) -
          positionFillRank(optimizerProfileRules, b)
      )
    })

    let bestScore = -Infinity
  let bestAssignment = {}
  let bestFilledCount = -1

  function rememberBest(assignment, runningScore) {
    const filledCount = Object.keys(assignment).length

    if (
      filledCount > bestFilledCount ||
      (filledCount === bestFilledCount && runningScore > bestScore)
    ) {
      bestFilledCount = filledCount
      bestScore = runningScore
      bestAssignment = { ...assignment }
    }
  }

  function search(index, usedIds, assignment, runningScore) {
    rememberBest(assignment, runningScore)

    if (index >= orderedPositions.length) return

    const position = orderedPositions[index]
    const candidates = candidatesByPosition[position] || []

    for (const candidate of candidates) {
      if (usedIds.has(candidate.id)) continue

      usedIds.add(candidate.id)
      assignment[candidate.id] = position

      search(index + 1, usedIds, assignment, runningScore + candidate.score)

      delete assignment[candidate.id]
      usedIds.delete(candidate.id)
    }

    // If this position cannot be filled legally, keep going and fill later positions.
    search(index + 1, usedIds, assignment, runningScore)
  }

  search(0, new Set(), {}, 0)

  return bestAssignment
}

function applyInningHardRules({
  lineup,
  inning,
  players,
  fitMap,
  priorityMap,
  targetCounts,
  actualCounts,
  totalsBefore,
  planTotalsBefore,
  planSitOutTargets,
  optimizerProfile,
  optimizerProfileRules,
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const innings = Number(lineup?.innings || 0)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  const fieldersNeeded = Math.min(9, eligibleIds.length)
  const expectedOuts = Math.max(0, eligibleIds.length - fieldersNeeded)

  eligibleIds.forEach((id) => {
    if (lockedValue(lineup, id, inning)) return
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (value !== 'Injury') lineup.cells[id][inning] = ''
  })

  const sitOutIds = chooseOutsForInning({
    lineup,
    inning,
    innings,
    players,
    fitMap,
    totalsBefore,
    planTotalsBefore,
    targetCounts,
    actualCounts,
    planSitOutTargets,
    optimizerProfile,
    optimizerProfileRules,
  })

  sitOutIds.forEach((id) => {
    if (!lockedValue(lineup, id, inning)) {
      lineup.cells[id][inning] = 'Out'
    }
  })

  let currentOuts = eligibleIds.filter(
    (id) => lineup?.cells?.[id]?.[inning] === 'Out'
  ).length

    if (currentOuts < expectedOuts) {
    const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)

    const buildExtraOutCandidates = (allowSpacing = false) =>
      eligibleIds
        .filter((id) => !lockedValue(lineup, id, inning))
        .filter((id) => (lineup?.cells?.[id]?.[inning] || '') === '')
        .filter((id) => allowSpacing || !violatesSitSpacing(lineup, id, inning, innings, minGap))
                .sort((a, b) => {
          const aPlanOuts =
            Number(planTotalsBefore?.[a]?.Out || 0) + Number(actualCounts?.[a]?.Out || 0)
          const bPlanOuts =
            Number(planTotalsBefore?.[b]?.Out || 0) + Number(actualCounts?.[b]?.Out || 0)

          return aPlanOuts - bPlanOuts
        })

    for (const allowSpacing of [false]) {
      const extraOutCandidates = buildExtraOutCandidates(allowSpacing)

      for (const id of extraOutCandidates) {
        if (currentOuts >= expectedOuts) break
        lineup.cells[id][inning] = 'Out'
        currentOuts += 1
      }

      if (currentOuts >= expectedOuts) break
    }
  }

  const assignment = assignPositionsForInning({
    lineup,
    inning,
    players,
    fitMap,
    priorityMap,
    targetCounts,
    actualCounts,
    optimizerProfileRules,
  })

  Object.entries(assignment).forEach(([id, position]) => {
    if (!lockedValue(lineup, id, inning)) {
      lineup.cells[id][inning] = position
    }
  })

  eligibleIds.forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''

    if (FIELD_POSITIONS.includes(value)) {
      const bucket = positionBucket(value)
      actualCounts[id][bucket] += 1
      actualCounts[id].fieldTotal += 1
    }

    if (value === 'Out') {
      actualCounts[id].Out += 1
    }
  })
}

function rebuildUnlockedLineup({
  lineup,
  players,
  fitMap,
  priorityMap,
  targetCounts,
  actualCounts,
  totalsBefore = {},
  planTotalsBefore = {},
  planSitOutTargets = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const innings = Number(lineup?.innings || 0)

  for (let inning = 1; inning <= innings; inning += 1) {
    applyInningHardRules({
      lineup,
      inning,
      players,
      fitMap,
      priorityMap,
      targetCounts,
      actualCounts,
      totalsBefore,
      planTotalsBefore,
      planSitOutTargets,
      optimizerProfile,
      optimizerProfileRules,
    })
  }

  return lineup
}

function enforceConsecutivePositionRules({ lineup, players, fitMap, optimizerProfileRules }) {
  const innings = Number(lineup?.innings || 0)
  if (!innings) return lineup

  const playerIds = (players || []).map((player) => pk(player.id))

  function playerAt(position, inning) {
    return playerIds.find((id) => lineup?.cells?.[id]?.[inning] === position)
  }

  function canSwapAtInning(playerA, playerB, inning) {
    const aPos = lineup?.cells?.[playerA]?.[inning] || ''
    const bPos = lineup?.cells?.[playerB]?.[inning] || ''

    if (!FIELD_POSITIONS.includes(aPos) || !FIELD_POSITIONS.includes(bPos)) return false
    if (lockedValue(lineup, playerA, inning)) return false
    if (lockedValue(lineup, playerB, inning)) return false

    return (
      allowedAt({
        playerId: playerA,
        position: bPos,
        fitMap,
        optimizerProfileRules,
      }) &&
      allowedAt({
        playerId: playerB,
        position: aPos,
        fitMap,
        optimizerProfileRules,
      })
    )
  }

  FIELD_POSITIONS.forEach((position) => {
    if (consecutiveMode(optimizerProfileRules, position) !== 'must_2') return

    for (let inning = 1; inning <= innings; inning += 1) {
      const playerId = playerAt(position, inning)
      if (!playerId) continue

      const prevSame = inning > 1 && lineup?.cells?.[playerId]?.[inning - 1] === position
      const nextSame = inning < innings && lineup?.cells?.[playerId]?.[inning + 1] === position

      if (prevSame || nextSame) continue

      const neighborInnings = [inning + 1, inning - 1].filter(
        (value) => value >= 1 && value <= innings
      )

      for (const neighbor of neighborInnings) {
        const currentHolderAtNeighbor = playerAt(position, neighbor)
        if (!currentHolderAtNeighbor) continue
        if (currentHolderAtNeighbor === playerId) break

        if (canSwapAtInning(playerId, currentHolderAtNeighbor, neighbor)) {
          const playerNeighborPos = lineup.cells[playerId][neighbor]
          lineup.cells[playerId][neighbor] = position
          lineup.cells[currentHolderAtNeighbor][neighbor] = playerNeighborPos
          break
        }
      }
    }
  })

  return lineup
}

function enforceMinimumPositions({
  lineup,
  players,
  fitMap,
  priorityMap,
  optimizerProfile,
  optimizerProfileRules = {},
}) {
  const availableIds = new Set((lineup?.availablePlayerIds || []).map(pk))
  const innings = Number(lineup?.innings || 0)

  if (!innings) return lineup

  const minPositions = Number(optimizerProfile?.min_positions_per_player || 1)
  const minInningsPerUsedPosition = Number(
    optimizerProfile?.min_innings_per_used_position || 1
  )
  const mode = optimizerProfile?.min_positions_mode || 'nice'

  if (mode === 'off' || minPositions <= 1) return lineup

  function getFieldInnings(playerId) {
    const out = []

    for (let inning = 1; inning <= innings; inning += 1) {
      const value = lineup?.cells?.[playerId]?.[inning] || ''
      if (FIELD_POSITIONS.includes(value)) {
        out.push({ inning, value })
      }
    }

    return out
  }

  function getQualifiedFieldPositions(playerId) {
    const counts = {}

    getFieldInnings(playerId).forEach(({ value }) => {
      counts[value] = Number(counts[value] || 0) + 1
    })

    return new Set(
      Object.entries(counts)
        .filter(([, count]) => count >= minInningsPerUsedPosition)
        .map(([position]) => position)
    )
  }

  function findPlayerAtPosition(inning, position) {
    for (const player of players || []) {
      const id = pk(player.id)
      if ((lineup?.cells?.[id]?.[inning] || '') === position) return id
    }

    return null
  }

  function canSwap(playerA, playerB, inning) {
    const aPos = lineup?.cells?.[playerA]?.[inning] || ''
    const bPos = lineup?.cells?.[playerB]?.[inning] || ''

    if (!FIELD_POSITIONS.includes(aPos) || !FIELD_POSITIONS.includes(bPos)) return false
    if (lockedValue(lineup, playerA, inning)) return false
    if (lockedValue(lineup, playerB, inning)) return false

    return (
      allowedAt({
        playerId: playerA,
        position: bPos,
        fitMap,
        optimizerProfileRules,
      }) &&
      allowedAt({
        playerId: playerB,
        position: aPos,
        fitMap,
        optimizerProfileRules,
      })
    )
  }

  ;(players || []).forEach((player) => {
    const playerId = pk(player.id)

    if (!availableIds.has(playerId)) return

    const fieldInnings = getFieldInnings(playerId)
    const qualifiedPositions = getQualifiedFieldPositions(playerId)

    if (fieldInnings.length < minPositions * minInningsPerUsedPosition) return
    if (qualifiedPositions.size >= minPositions) return

    const unlockedFieldInnings = fieldInnings.filter(
      ({ inning }) => !lockedValue(lineup, playerId, inning)
    )

    for (const { inning } of unlockedFieldInnings) {
      const currentPos = lineup?.cells?.[playerId]?.[inning] || ''
      if (!FIELD_POSITIONS.includes(currentPos)) continue

      const alternatives = FIELD_POSITIONS
        .filter((position) => position !== currentPos)
        .filter((position) =>
          allowedAt({
            playerId,
            position,
            fitMap,
            optimizerProfileRules,
          })
        )
        .sort((a, b) => {
          return (
            Number(priorityValue(priorityMap, playerId, b) || 0) -
            Number(priorityValue(priorityMap, playerId, a) || 0)
          )
        })

      for (const altPos of alternatives) {
        const otherId = findPlayerAtPosition(inning, altPos)
        if (!otherId || otherId === playerId) continue
        if (!canSwap(playerId, otherId, inning)) continue

        lineup.cells[playerId][inning] = altPos
        lineup.cells[otherId][inning] = currentPos

        if (getQualifiedFieldPositions(playerId).size >= minPositions) return
      }
    }
  })

  return lineup
}

function enforceGameSitOutTargets({
  lineup,
  players,
  fitMap,
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const targets = lineup?.gameSitOutTargets || {}
  const innings = Number(lineup?.innings || 0)
  const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)

  function targetFor(playerId) {
    const raw = targets?.[pk(playerId)]
    if (raw === '' || raw === null || raw === undefined) return null
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }

  function canRemoveOutFrom(playerId) {
    const target = targetFor(playerId)
    if (target === null) return true
    return countPlayerOuts(lineup, playerId) > target
  }

  function findSwap(playerId, allowSpacing) {
    for (let inning = 1; inning <= innings; inning += 1) {
      if (lockedValue(lineup, playerId, inning)) continue

      if (
        !allowSpacing &&
        violatesSitSpacing(lineup, playerId, inning, innings, minGap)
      ) {
        continue
      }

      const currentPosition = lineup?.cells?.[playerId]?.[inning] || ''
      if (!FIELD_POSITIONS.includes(currentPosition)) continue

      const replacement = (players || [])
        .map((p) => pk(p.id))
        .find((otherId) => {
          if (otherId === playerId) return false
          if (lockedValue(lineup, otherId, inning)) return false
          if ((lineup?.cells?.[otherId]?.[inning] || '') !== 'Out') return false
          if (!canRemoveOutFrom(otherId)) return false

          return allowedAt({
            playerId: otherId,
            position: currentPosition,
            fitMap,
            optimizerProfileRules,
          })
        })

      if (replacement) {
        return { inning, replacement, currentPosition }
      }
    }

    return null
  }

  ;(players || []).forEach((player) => {
    const playerId = pk(player.id)
    const target = targetFor(playerId)

    if (target === null) return

    let guard = 0

    while (countPlayerOuts(lineup, playerId) < target && guard < 20) {
      guard += 1

      const swap = findSwap(playerId, false)

      if (!swap) break

      lineup.cells[playerId][swap.inning] = 'Out'
      lineup.cells[swap.replacement][swap.inning] = swap.currentPosition
    }
  })

  return lineup
}

function enforcePlanSitOutTargets({
  lineupsByGame,
  games,
  players,
  fitMap,
  planSitOutTargets = {},
  lineupLockedByGame = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)

  function planTargetFor(playerId) {
    const raw = planSitOutTargets?.[pk(playerId)]
    if (raw === '' || raw === null || raw === undefined) return null
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }

  function gameTargetFor(lineup, playerId) {
    const raw = lineup?.gameSitOutTargets?.[pk(playerId)]
    if (raw === '' || raw === null || raw === undefined) return null
    const n = Number(raw)
    return Number.isNaN(n) ? null : n
  }

  function planOutCounts() {
    const counts = {}
    ;(players || []).forEach((player) => {
      counts[pk(player.id)] = 0
    })

    ;(games || []).forEach((game) => {
      const lineup = lineupsByGame?.[pk(game.id)]
      if (!lineup) return

      ;(players || []).forEach((player) => {
        counts[pk(player.id)] += countPlayerOuts(lineup, player.id)
      })
    })

    return counts
  }

  let guard = 0

  while (guard < 50) {
    guard += 1
    const counts = planOutCounts()
    let changed = false

    const underRows = (players || [])
      .map((player) => {
        const id = pk(player.id)
        const target = planTargetFor(id)

        return {
          id,
          name: player.name || '',
          target,
          current: Number(counts[id] || 0),
          need: target === null ? 0 : target - Number(counts[id] || 0),
        }
      })
      .filter((row) => row.target !== null && row.need > 0)
      .sort((a, b) => b.need - a.need || a.name.localeCompare(b.name))

    if (!underRows.length) break

    for (const under of underRows) {
      for (const game of games || []) {
        const gameId = pk(game.id)
        const lineup = lineupsByGame?.[gameId]

        if (!lineup || lineupLockedByGame?.[gameId]) continue

        const innings = Number(lineup?.innings || 0)

        for (let inning = 1; inning <= innings; inning += 1) {
          if (changed) break
          if (lockedValue(lineup, under.id, inning)) continue
          if (violatesSitSpacing(lineup, under.id, inning, innings, minGap)) continue

          const currentPosition = lineup?.cells?.[under.id]?.[inning] || ''
          if (!FIELD_POSITIONS.includes(currentPosition)) continue

          const replacement = (players || [])
            .map((p) => pk(p.id))
            .find((otherId) => {
              if (otherId === under.id) return false
              if (lockedValue(lineup, otherId, inning)) return false
              if ((lineup?.cells?.[otherId]?.[inning] || '') !== 'Out') return false

              const otherPlanTarget = planTargetFor(otherId)

// Do not steal an OUT from someone still below their plan target.
// But if they have no target, or are already at/above target, they can be used.
if (otherPlanTarget !== null && Number(counts[otherId] || 0) <= otherPlanTarget) {
  return false
}

              const otherGameTarget = gameTargetFor(lineup, otherId)
              if (otherGameTarget !== null && countPlayerOuts(lineup, otherId) <= otherGameTarget) {
                return false
              }

              return allowedAt({
                playerId: otherId,
                position: currentPosition,
                fitMap,
                optimizerProfileRules,
              })
            })

          if (!replacement) continue

          lineup.cells[under.id][inning] = 'Out'
          lineup.cells[replacement][inning] = currentPosition
          changed = true
        }

        if (changed) break
      }

      if (changed) break
    }

    if (!changed) break
  }

  return lineupsByGame
}

export function rebalanceTowardPriorityTargets({
  lineup,
  players,
  fitMap,
  priorityMap,
  totalsBefore = {},
  optimizerProfileRules = {},
}) {
  const expectedFieldTotals = {}

  ;(players || []).forEach((player) => {
    expectedFieldTotals[pk(player.id)] = expectedFieldInningsForPlayer(lineup, pk(player.id))
  })

  const targetCounts = makeTargetCounts({
    players,
    priorityMap,
    expectedFieldTotals,
  })

  const actualCounts = makeActualCounts(players)
  addExistingLockedCounts({ lineup, players, actualCounts })

  rebuildUnlockedLineup({
    lineup,
    players,
    fitMap,
    priorityMap,
    targetCounts,
    actualCounts,
    totalsBefore,
    optimizerProfileRules,
  })

  return lineup
}


export function optimizeLineupPlan({
  games,
  players,
  sourceLineupsByGame = {},
  availableIdsByGame = {},
  lineupLockedByGame = {},
  totalsBefore = {},
  priorityMap,
  fitMap,
  planSitOutTargets = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
    let rollingPlanTotals = {}
  const next = {}

  ;(games || []).forEach((game) => {
    const gameId = pk(game.id)
    const sourceLineup = sourceLineupsByGame[gameId]
    if (!sourceLineup) return

    if (lineupLockedByGame?.[gameId]) {
      next[gameId] = clone(sourceLineup)
            const lockedTotals = computeTotals([sourceLineup], players)
      rollingPlanTotals = addTotals(rollingPlanTotals, lockedTotals, players)
      return
    }

    const availablePlayerIds =
      availableIdsByGame[gameId] ||
      sourceLineup.availablePlayerIds ||
      (players || []).map((player) => pk(player.id))

    const optimized = buildOptimizedLineup({
      game: { ...game, innings: Number(sourceLineup?.innings || game.innings || 6) },
      players,
      availablePlayerIds,
      sourceLineup,
      totalsBefore: {},
      planTotalsBefore: rollingPlanTotals,
      priorityMap,
      fitMap,
      planSitOutTargets,
      optimizerProfile,
      optimizerProfileRules,
    })

    next[gameId] = optimized
        const optimizedTotals = computeTotals([optimized], players)
    rollingPlanTotals = addTotals(rollingPlanTotals, optimizedTotals, players)
  })
  
  enforcePlanSitOutTargets({
    lineupsByGame: next,
    games,
    players,
    fitMap,
    planSitOutTargets,
    lineupLockedByGame,
    optimizerProfile,
    optimizerProfileRules,
  })

  Object.entries(next).forEach(([gameId, lineup]) => {
  if (lineupLockedByGame?.[gameId]) return

  lineup.validationIssues = validateLineup({
    lineup,
    players,
    fitMap,
    optimizerProfileRules,
  })
})
  
  return next
}

export function buildOptimizedLineup({
  game,
  players,
  availablePlayerIds,
  sourceLineup,
  totalsBefore = {},
  planTotalsBefore = {},
  priorityMap,
  fitMap,
  planSitOutTargets = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const safeAvailable = (availablePlayerIds || []).map(pk)

  const lineup = normalizeLineup(
    sourceLineup,
    players,
    Number(game?.innings || 6),
    safeAvailable.length ? safeAvailable : (players || []).map((player) => pk(player.id))
  )

  lineup.innings = Number(game?.innings || lineup?.innings || 6)
  lineup.availablePlayerIds = safeAvailable.length
    ? safeAvailable
    : (players || []).map((player) => pk(player.id))

  clearUnlockedCells(lineup, players)

  const expectedFieldTotals = {}

  ;(players || []).forEach((player) => {
    expectedFieldTotals[pk(player.id)] = expectedFieldInningsForPlayer(
      lineup,
      pk(player.id)
    )
  })

  const targetCounts = makeTargetCounts({
    players,
    priorityMap,
    expectedFieldTotals,
  })

  const actualCounts = makeActualCounts(players)
  addExistingLockedCounts({ lineup, players, actualCounts })

  rebuildUnlockedLineup({
    lineup,
    players,
    fitMap,
    priorityMap,
    targetCounts,
    actualCounts,
    totalsBefore,
    planTotalsBefore,
    planSitOutTargets,
    optimizerProfile,
    optimizerProfileRules,
  })

  enforceConsecutivePositionRules({
    lineup,
    players,
    fitMap,
    optimizerProfileRules,
  })

  if (optimizerProfile?.min_positions_mode === 'must') {
    enforceMinimumPositions({
      lineup,
      players,
      fitMap,
      priorityMap,
      optimizerProfile,
      optimizerProfileRules,
    })
  }

  enforceGameSitOutTargets({
    lineup,
    players,
    fitMap,
    optimizerProfile,
    optimizerProfileRules,
  })
  
  lineup.validationIssues = validateLineup({
    lineup,
    players,
    fitMap,
    optimizerProfileRules,
  })

  return lineup
}
