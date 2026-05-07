// src/lib/lineupOptimizer.js

import { FIELD_POSITIONS, PRIORITY_POSITIONS } from './lineupConstants'
import { pk, clone, normalizeLineup, lockedValue } from './lineupCore'
import { computeTotals } from './lineupTotals'
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

function getGameOutCounts(lineup, players) {
  const outCounts = {}
  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    outCounts[id] = countPlayerOuts(lineup, id)
  })
  return outCounts
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

function initializePlanPositionCounts(players) {
  const counts = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    counts[id] = {
      P: 0,
      C: 0,
      '1B': 0,
      '2B': 0,
      '3B': 0,
      SS: 0,
      OF: 0,
    }
  })

  return counts
}

function incrementPlanPositionCount(planPositionCounts, playerId, position) {
  const id = pk(playerId)
  const bucket = positionBucket(position)

  if (!planPositionCounts[id]) {
    planPositionCounts[id] = {
      P: 0,
      C: 0,
      '1B': 0,
      '2B': 0,
      '3B': 0,
      SS: 0,
      OF: 0,
    }
  }

  planPositionCounts[id][bucket] = Number(planPositionCounts[id][bucket] || 0) + 1
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

    const expectedOuts = Math.max(0, eligibleIds.length - 9)
    const expectedFieldShare = 1 - expectedOuts / Math.max(eligibleIds.length, 1)

    expected += expectedFieldShare
  }

  return expected
}

function priorityTargetInnings(priorityMap, playerId, position, projectedFieldTotal) {
  const targetPct = Number(priorityValue(priorityMap, playerId, position) || 0)
  if (targetPct <= 0) return 0

  return Math.round((Number(projectedFieldTotal || 0) * targetPct) / 100)
}

function getRequiredPlayersByPosition(lineup, inning, players, fitMap, optimizerProfileRules = {}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const positionToPlayers = {}

  FIELD_POSITIONS.forEach((pos) => {
    const rule = getPositionRule(optimizerProfileRules, pos)

    positionToPlayers[pos] = eligibleIds.filter((id) => {
      const fit = normalizeFit(fitTier(fitMap, id, pos))
      return fitAllowedByRule(rule, fit)
    })
  })

  const criticalPlayers = new Set()

  Object.values(positionToPlayers).forEach((ids) => {
    if (ids.length === 1) criticalPlayers.add(ids[0])
  })

  return criticalPlayers
}

function chooseSitOutsForInning({
  lineup,
  inning,
  innings,
  players,
  totalsBefore,
  planSitOutTargets,
  cumulativePlanOutCounts,
  optimizerProfile = null,
  fitMap,
  optimizerProfileRules = {},
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  const outsNeeded = Math.max(0, eligibleIds.length - 9)
  const additionalOutsNeeded = Math.max(0, outsNeeded - lockedInfo.lockedOuts)

  if (additionalOutsNeeded <= 0) return []

  const criticalPlayers = getRequiredPlayersByPosition(
    lineup,
    inning,
    players,
    fitMap,
    optimizerProfileRules
  )

  const unlockedEligibleIds = eligibleIds.filter(
    (id) =>
      !lockedInfo.lockedFieldPlayers.has(id) &&
      !lockedInfo.lockedOutPlayers.has(id) &&
      !criticalPlayers.has(id)
  )

  if (!unlockedEligibleIds.length) return []

  const currentGameOutCounts = getGameOutCounts(lineup, players)
  const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)
  const sitAllBeforeSecond = optimizerProfile?.sit_all_before_second !== false

  const ranked = unlockedEligibleIds.map((id) => {
    const rawTarget = planSitOutTargets?.[id]
    const hasTarget = rawTarget !== '' && rawTarget != null
    const explicitTarget = hasTarget ? Number(rawTarget) : null

    const currentPlanOuts = Number(cumulativePlanOutCounts?.[id] || 0)
    const currentGameOuts = Number(currentGameOutCounts[id] || 0)
    const seasonOuts = Number(totalsBefore?.[id]?.Out || 0)

    const targetNeed = explicitTarget == null ? 0 : explicitTarget - currentPlanOuts
    const mustSit = explicitTarget != null && targetNeed > 0
    const atOrOverTarget = explicitTarget != null && currentPlanOuts >= explicitTarget
    const spacingBad = violatesSitSpacing(lineup, id, inning, innings, minGap)

    return {
      id,
      explicitTarget,
      targetNeed,
      mustSit,
      atOrOverTarget,
      currentPlanOuts,
      currentGameOuts,
      seasonOuts,
      spacingBad,
      name: (players || []).find((p) => pk(p.id) === id)?.name || '',
    }
  })

  ranked.sort((a, b) => {
    if (a.mustSit !== b.mustSit) return b.mustSit - a.mustSit
    if (a.atOrOverTarget !== b.atOrOverTarget) return a.atOrOverTarget ? 1 : -1
    if (a.spacingBad !== b.spacingBad) return a.spacingBad ? 1 : -1
    if (a.currentGameOuts !== b.currentGameOuts) return a.currentGameOuts - b.currentGameOuts
    if (a.currentPlanOuts !== b.currentPlanOuts) return a.currentPlanOuts - b.currentPlanOuts
    if (a.seasonOuts !== b.seasonOuts) return a.seasonOuts - b.seasonOuts
    return a.name.localeCompare(b.name)
  })

  const chosen = []

  function wouldStayFair(candidate) {
    if (!sitAllBeforeSecond) return true
    if (candidate.atOrOverTarget) return false

    const projected = {}

    ranked.forEach((row) => {
      projected[row.id] = Number(cumulativePlanOutCounts?.[row.id] || 0)
    })

    chosen.forEach((id) => {
      projected[id] = Number(projected[id] || 0) + 1
    })

    projected[candidate.id] = Number(projected[candidate.id] || 0) + 1

    const values = unlockedEligibleIds.map((id) => Number(projected[id] || 0))
    return Math.max(...values) - Math.min(...values) <= 1
  }

  for (const candidate of ranked) {
    if (chosen.length >= additionalOutsNeeded) break
    if (!candidate.mustSit) continue
    if (candidate.spacingBad) continue
    if (candidate.atOrOverTarget) continue
    chosen.push(candidate.id)
  }

  for (const candidate of ranked) {
    if (chosen.length >= additionalOutsNeeded) break
    if (chosen.includes(candidate.id)) continue

    if (candidate.spacingBad) {
      const nonSpacingOptionsLeft = ranked.some(
        (other) =>
          !chosen.includes(other.id) &&
          !other.spacingBad &&
          wouldStayFair(other)
      )

      if (nonSpacingOptionsLeft) continue
    }

    if (!wouldStayFair(candidate)) continue
    chosen.push(candidate.id)
  }

  for (const candidate of ranked) {
    if (chosen.length >= additionalOutsNeeded) break
    if (chosen.includes(candidate.id)) continue
    if (candidate.atOrOverTarget) continue
    chosen.push(candidate.id)
  }

  for (const candidate of ranked) {
    if (chosen.length >= additionalOutsNeeded) break
    if (chosen.includes(candidate.id)) continue
    chosen.push(candidate.id)
  }

  return chosen
}

function scorePlayerForPosition({
  playerId,
  position,
  priorityMap,
  fitMap,
  lineup,
  inning,
  planPositionCounts,
  rollingTotals = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const id = pk(playerId)
  const rule = getPositionRule(optimizerProfileRules, position)
  const rawFit = fitTier(fitMap, id, position)
  const fit = normalizeFit(rawFit)

  if (!fitAllowedByRule(rule, fit)) {
    return { playerId: id, position, totalScore: -100000000 }
  }

  const bucket = positionBucket(position)
  const importance = positionImportance(optimizerProfileRules, position)
  const targetPct = Number(priorityValue(priorityMap, id, position) || 0)

  const currentPositionInnings = Number(rollingTotals?.[id]?.[bucket] || 0)
  const currentFieldTotal = Number(rollingTotals?.[id]?.fieldTotal || 0)

  const planFieldTotal = Object.values(planPositionCounts?.[id] || {}).reduce(
    (sum, count) => sum + Number(count || 0),
    0
  )

  const fieldTotalBeforeThisPlan = Math.max(0, currentFieldTotal - planFieldTotal)
  const expectedFieldTotalForGame = expectedFieldInningsForPlayer(lineup, id)
  const targetFieldTotal = fieldTotalBeforeThisPlan + expectedFieldTotalForGame

  const targetInnings = priorityTargetInnings(priorityMap, id, position, targetFieldTotal)
  const projectedPositionInnings = currentPositionInnings + 1
  const overTargetInnings = projectedPositionInnings - targetInnings

  let fitScore = 0
  if (fit === 'primary') fitScore = 900 * importance
  else if (fit === 'secondary') fitScore = 550 * importance
  else if (fit === 'development') fitScore = 250 * importance
  else fitScore = 25 * importance

  let priorityScore = 0

  if (targetPct > 0) {
    const needBefore = targetInnings - currentPositionInnings
    const needAfter = targetInnings - projectedPositionInnings

    if (needBefore > 0) {
      priorityScore += needBefore * 900000
      priorityScore += 500000
    } else {
      priorityScore -= (Math.abs(needBefore) + 1) * 900000
    }

    priorityScore -= Math.abs(needAfter) * 75000

    if (overTargetInnings > 0) {
  priorityScore -= overTargetInnings * 3000000
  priorityScore -= overTargetInnings * overTargetInnings * 750000
}
  } else {
    priorityScore -= 400000
  }

  const alreadyPlayedThisPositionInPlan = Number(planPositionCounts?.[id]?.[bucket] || 0)

  if (alreadyPlayedThisPositionInPlan > 0 && consecutiveMode(optimizerProfileRules, position) !== 'must_2') {
  priorityScore -= alreadyPlayedThisPositionInPlan * 450000
  priorityScore -= alreadyPlayedThisPositionInPlan * alreadyPlayedThisPositionInPlan * 150000
}

  let varietyScore = 0
  const minPositions = Number(optimizerProfile?.min_positions_per_player || 1)
  const varietyMode = optimizerProfile?.min_positions_mode || 'nice'

  const playerPositionsSoFar = Object.entries(planPositionCounts?.[id] || {})
    .filter(([, count]) => Number(count || 0) > 0)
    .map(([pos]) => pos)

  const alreadyPlayedThisBucket = Number(planPositionCounts?.[id]?.[bucket] || 0) > 0

  const needsMoreVariety =
    varietyMode !== 'off' &&
    minPositions > 1 &&
    playerPositionsSoFar.length > 0 &&
    playerPositionsSoFar.length < minPositions

  if (needsMoreVariety && alreadyPlayedThisBucket) {
    varietyScore -= varietyMode === 'must' ? 30000 : 8000
  }

  if (needsMoreVariety && !alreadyPlayedThisBucket) {
    varietyScore += varietyMode === 'must' ? 35000 : 10000
  }

  const prevValue = inning > 1 ? lineup?.cells?.[id]?.[inning - 1] || '' : ''
  const samePositionMode = consecutiveMode(optimizerProfileRules, position)

  let rotationScore = 0

  if (samePositionMode === 'prefer' && prevValue === position) {
    rotationScore -= 25000
  }

  if (samePositionMode === 'must_2' && prevValue === position) {
    rotationScore += 12000
  }

  if (samePositionMode === 'must_2' && inning > 1 && prevValue !== position) {
    const previousPositionPlayer = Object.keys(lineup?.cells || {}).find(
      (otherId) => lineup?.cells?.[otherId]?.[inning - 1] === position
    )

    if (previousPositionPlayer && previousPositionPlayer !== id) {
      rotationScore -= 30000
    }
  }

  return {
    playerId: id,
    position,
    totalScore: fitScore + priorityScore + varietyScore + rotationScore,
  }
}

function assignPositionsForInning({
  lineup,
  inning,
  players,
  rollingTotals,
  priorityMap,
  fitMap,
  planPositionCounts,
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  const openPositions = FIELD_POSITIONS.filter(
    (position) => !lockedInfo.assignedPositions.has(position)
  )

  const candidateIds = eligibleIds.filter(
    (id) =>
      !lockedInfo.lockedFieldPlayers.has(id) &&
      !lockedInfo.lockedOutPlayers.has(id) &&
      lineup?.cells?.[id]?.[inning] !== 'Out'
  )

  const candidatesByPosition = {}

  openPositions.forEach((position) => {
    candidatesByPosition[position] = candidateIds
      .map((id) =>
        scorePlayerForPosition({
          playerId: id,
          position,
          priorityMap,
          fitMap,
          lineup,
          inning,
          planPositionCounts,
          rollingTotals,
          optimizerProfile,
          optimizerProfileRules,
        })
      )
      .filter((candidate) => candidate.totalScore > -50000000)
      .sort((a, b) => b.totalScore - a.totalScore)
  })

  const orderedPositions = [...openPositions].sort((a, b) => {
    return (
      positionFillRank(optimizerProfileRules, a) - positionFillRank(optimizerProfileRules, b) ||
      positionImportance(optimizerProfileRules, b) - positionImportance(optimizerProfileRules, a) ||
      candidatesByPosition[a].length - candidatesByPosition[b].length
    )
  })

  let bestScore = -Infinity
  let bestAssignment = {}

  function search(index, usedPlayers, currentAssignment, runningScore) {
    if (index >= orderedPositions.length) {
      if (runningScore > bestScore) {
        bestScore = runningScore
        bestAssignment = { ...currentAssignment }
      }
      return
    }

    const position = orderedPositions[index]
    const candidates = candidatesByPosition[position] || []

    for (const candidate of candidates) {
      if (usedPlayers.has(candidate.playerId)) continue

      usedPlayers.add(candidate.playerId)
      currentAssignment[candidate.playerId] = position

      search(
        index + 1,
        usedPlayers,
        currentAssignment,
        runningScore + candidate.totalScore
      )

      delete currentAssignment[candidate.playerId]
      usedPlayers.delete(candidate.playerId)
    }
  }

  search(0, new Set(), {}, 0)

  const assignedOpenPositions = new Set(Object.values(bestAssignment))
  const missingOpenPositions = openPositions.filter(
    (position) => !assignedOpenPositions.has(position)
  )

  if (missingOpenPositions.length > 0) {
    const fallback = { ...bestAssignment }
    const used = new Set(Object.keys(fallback))

    missingOpenPositions.forEach((position) => {
      const candidates = candidatesByPosition[position] || []

      const valid = candidates.find((candidate) => {
        if (used.has(candidate.playerId)) return false
        if (lockedInfo.lockedFieldPlayers.has(candidate.playerId)) return false
        if (lockedInfo.lockedOutPlayers.has(candidate.playerId)) return false
        if (lineup?.cells?.[candidate.playerId]?.[inning] === 'Out') return false
        return true
      })

      if (valid) {
        fallback[valid.playerId] = position
        used.add(valid.playerId)
      }
    })

    return fallback
  }

  return bestAssignment
}

function repairMissingAndDuplicatePositions({
  lineup,
  players,
  fitMap,
  priorityMap,
  optimizerProfileRules = {},
}) {
  const innings = Number(lineup?.innings || 0)
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)

  function isValidAt(id, position) {
    const rule = getPositionRule(optimizerProfileRules, position)
    const fit = normalizeFit(fitTier(fitMap, id, position))
    return fitAllowedByRule(rule, fit)
  }

  function fitScoreFor(id, position) {
    const rule = getPositionRule(optimizerProfileRules, position)
    const fit = normalizeFit(fitTier(fitMap, id, position))

    if (!fitAllowedByRule(rule, fit)) return -100000

    const importance = positionImportance(optimizerProfileRules, position)
    const priority = priorityValue(priorityMap, id, position)

    const fitRank =
      fit === 'primary' ? 4 :
      fit === 'secondary' ? 3 :
      fit === 'development' ? 2 :
      1

    return fitRank * importance * 100 + priority * importance
  }

  for (let inning = 1; inning <= innings; inning += 1) {
    let changed = true
    let guard = 0

    while (changed && guard < 20) {
      changed = false
      guard += 1

      const positionPlayers = {}
      FIELD_POSITIONS.forEach((pos) => {
        positionPlayers[pos] = []
      })

      availableIds.forEach((id) => {
        const value = lineup?.cells?.[id]?.[inning] || ''
        if (FIELD_POSITIONS.includes(value)) {
          positionPlayers[value].push(id)
        }
      })

      const missingPositions = FIELD_POSITIONS.filter(
        (pos) => positionPlayers[pos].length === 0
      )

      const problemPlayers = []

      availableIds.forEach((id) => {
        const value = lineup?.cells?.[id]?.[inning] || ''

        if (!FIELD_POSITIONS.includes(value)) return
        if (lockedValue(lineup, id, inning)) return

        const isDuplicate = (positionPlayers[value] || []).length > 1
        const isDisallowed = !isValidAt(id, value)

        if (isDuplicate || isDisallowed) {
          problemPlayers.push({
            id,
            currentPosition: value,
          })
        }
      })

      for (const missingPos of missingPositions) {
        const bestProblem = problemPlayers
          .filter((row) => !lockedValue(lineup, row.id, inning))
          .filter((row) => isValidAt(row.id, missingPos))
          .sort((a, b) => fitScoreFor(b.id, missingPos) - fitScoreFor(a.id, missingPos))[0]

        if (!bestProblem) continue

        lineup.cells[bestProblem.id][inning] = missingPos
        changed = true

        const removeIndex = problemPlayers.findIndex((row) => row.id === bestProblem.id)
        if (removeIndex >= 0) problemPlayers.splice(removeIndex, 1)
      }

      for (const id of availableIds) {
        const currentPos = lineup?.cells?.[id]?.[inning] || ''
        if (!FIELD_POSITIONS.includes(currentPos)) continue
        if (lockedValue(lineup, id, inning)) continue
        if (isValidAt(id, currentPos)) continue

        const swapCandidate = availableIds
          .filter((otherId) => otherId !== id)
          .filter((otherId) => !lockedValue(lineup, otherId, inning))
          .map((otherId) => {
            const otherPos = lineup?.cells?.[otherId]?.[inning] || ''
            return { otherId, otherPos }
          })
          .filter(({ otherPos }) => FIELD_POSITIONS.includes(otherPos))
          .filter(({ otherId, otherPos }) => {
            return isValidAt(id, otherPos) && isValidAt(otherId, currentPos)
          })
          .sort((a, b) => {
            const aScore = fitScoreFor(id, a.otherPos) + fitScoreFor(a.otherId, currentPos)
            const bScore = fitScoreFor(id, b.otherPos) + fitScoreFor(b.otherId, currentPos)
            return bScore - aScore
          })[0]

        if (swapCandidate) {
          lineup.cells[id][inning] = swapCandidate.otherPos
          lineup.cells[swapCandidate.otherId][inning] = currentPos
          changed = true
        }
      }
    }
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

    const aFitForBPos = normalizeFit(fitTier(fitMap, playerA, bPos))
    const bFitForAPos = normalizeFit(fitTier(fitMap, playerB, aPos))

    if (aFitForBPos !== 'primary') return false
    if (bFitForAPos !== 'primary') return false

    return true
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
        (n) => n >= 1 && n <= innings
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

    const aRuleForBPos = getPositionRule(optimizerProfileRules, bPos)
    const bRuleForAPos = getPositionRule(optimizerProfileRules, aPos)

    const aFitForBPos = normalizeFit(fitTier(fitMap, playerA, bPos))
    const bFitForAPos = normalizeFit(fitTier(fitMap, playerB, aPos))

    return fitAllowedByRule(aRuleForBPos, aFitForBPos) &&
      fitAllowedByRule(bRuleForAPos, bFitForAPos)
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

      const alternativePositions = FIELD_POSITIONS
        .filter((pos) => pos !== currentPos)
        .filter((pos) => {
          const rule = getPositionRule(optimizerProfileRules, pos)
          const fit = normalizeFit(fitTier(fitMap, playerId, pos))
          return fitAllowedByRule(rule, fit)
        })
        .sort((a, b) => {
          const aPriority = priorityValue(priorityMap, playerId, a)
          const bPriority = priorityValue(priorityMap, playerId, b)
          return bPriority - aPriority
        })

      for (const altPos of alternativePositions) {
        const otherId = findPlayerAtPosition(inning, altPos)
        if (!otherId || otherId === playerId) continue
        if (!canSwap(playerId, otherId, inning)) continue

        lineup.cells[playerId][inning] = altPos
        lineup.cells[otherId][inning] = currentPos

        const updated = getQualifiedFieldPositions(playerId)
        if (updated.size >= minPositions) return
      }
    }
  })

  return lineup
}

export function rebalanceTowardPriorityTargets({
  lineup,
  players,
  fitMap,
  priorityMap,
  totalsBefore = {},
  optimizerProfileRules = {},
}) {
  const innings = Number(lineup?.innings || 0)
  const availableSet = new Set((lineup?.availablePlayerIds || []).map(pk))
  const playerIds = (players || [])
    .map((player) => pk(player.id))
    .filter((id) => availableSet.has(id))

  const BUCKETS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']

  function allowedAt(playerId, position) {
    const rule = getPositionRule(optimizerProfileRules, position)
    const fit = normalizeFit(fitTier(fitMap, playerId, position))
    return fitAllowedByRule(rule, fit)
  }

  function buildCounts() {
    const counts = {}

    playerIds.forEach((id) => {
      counts[id] = {
        P: Number(totalsBefore?.[id]?.P || 0),
        C: Number(totalsBefore?.[id]?.C || 0),
        '1B': Number(totalsBefore?.[id]?.['1B'] || 0),
        '2B': Number(totalsBefore?.[id]?.['2B'] || 0),
        '3B': Number(totalsBefore?.[id]?.['3B'] || 0),
        SS: Number(totalsBefore?.[id]?.SS || 0),
        OF: Number(totalsBefore?.[id]?.OF || 0),
        fieldTotal: Number(totalsBefore?.[id]?.fieldTotal || 0),
      }
    })

    for (let inning = 1; inning <= innings; inning += 1) {
      playerIds.forEach((id) => {
        const position = lineup?.cells?.[id]?.[inning] || ''
        if (!FIELD_POSITIONS.includes(position)) return

        const bucket = positionBucket(position)
        counts[id][bucket] += 1
        counts[id].fieldTotal += 1
      })
    }

    return counts
  }

  function targetFor(counts, playerId, bucket) {
    const pct = Number(priorityValue(priorityMap, playerId, bucket) || 0)
    if (pct <= 0) return 0
    return Math.round((Number(counts?.[playerId]?.fieldTotal || 0) * pct) / 100)
  }

  function totalScore(counts) {
    let score = 0

    playerIds.forEach((id) => {
      BUCKETS.forEach((bucket) => {
        const pct = Number(priorityValue(priorityMap, id, bucket) || 0)
        const actual = Number(counts?.[id]?.[bucket] || 0)
        const target = targetFor(counts, id, bucket)

        if (pct <= 0) {
          score += actual * 900000
          return
        }

        const diff = actual - target
        score += Math.abs(diff) * 1000000
        if (diff > 0) score += diff * 350000
        if (diff < 0) score += Math.abs(diff) * 500000
      })
    })

    return score
  }

  let changed = true
  let guard = 0

  while (changed && guard < 250) {
    changed = false
    guard += 1

    const baseScore = totalScore(buildCounts())
    let bestSwap = null
    let bestScore = baseScore

    for (let inning = 1; inning <= innings; inning += 1) {
      for (let a = 0; a < playerIds.length; a += 1) {
        for (let b = a + 1; b < playerIds.length; b += 1) {
          const playerA = playerIds[a]
          const playerB = playerIds[b]

          if (lockedValue(lineup, playerA, inning)) continue
          if (lockedValue(lineup, playerB, inning)) continue

          const posA = lineup?.cells?.[playerA]?.[inning] || ''
          const posB = lineup?.cells?.[playerB]?.[inning] || ''

          if (!FIELD_POSITIONS.includes(posA)) continue
          if (!FIELD_POSITIONS.includes(posB)) continue
          if (positionBucket(posA) === positionBucket(posB)) continue
          if (!allowedAt(playerA, posB)) continue
          if (!allowedAt(playerB, posA)) continue

          lineup.cells[playerA][inning] = posB
          lineup.cells[playerB][inning] = posA

          const nextScore = totalScore(buildCounts())

          lineup.cells[playerA][inning] = posA
          lineup.cells[playerB][inning] = posB

          if (nextScore < bestScore) {
            bestScore = nextScore
            bestSwap = { inning, playerA, playerB, posA, posB }
          }
        }
      }
    }

    if (bestSwap) {
      lineup.cells[bestSwap.playerA][bestSwap.inning] = bestSwap.posB
      lineup.cells[bestSwap.playerB][bestSwap.inning] = bestSwap.posA
      changed = true
    }
  }

  return lineup
}

export function rebalancePlanTowardPriorityTargets({
  lineupsByGame,
  games,
  players,
  fitMap,
  priorityMap,
  totalsBefore = {},
  lineupLockedByGame = {},
  optimizerProfileRules = {},
}) {
  const next = clone(lineupsByGame || {})
  const playerIds = (players || []).map((player) => pk(player.id))
  const gameIds = (games || []).map((game) => pk(game.id))

  function allowedAt(playerId, position) {
    const rule = getPositionRule(optimizerProfileRules, position)
    const fit = normalizeFit(fitTier(fitMap, playerId, position))
    return fitAllowedByRule(rule, fit)
  }

  function buildCounts() {
    const counts = {}

    playerIds.forEach((id) => {
      counts[id] = {
        P: Number(totalsBefore?.[id]?.P || 0),
        C: Number(totalsBefore?.[id]?.C || 0),
        '1B': Number(totalsBefore?.[id]?.['1B'] || 0),
        '2B': Number(totalsBefore?.[id]?.['2B'] || 0),
        '3B': Number(totalsBefore?.[id]?.['3B'] || 0),
        SS: Number(totalsBefore?.[id]?.SS || 0),
        OF: Number(totalsBefore?.[id]?.OF || 0),
        fieldTotal: Number(totalsBefore?.[id]?.fieldTotal || 0),
      }
    })

    gameIds.forEach((gameId) => {
      const lineup = next[gameId]
      if (!lineup) return

      for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
        playerIds.forEach((id) => {
          const position = lineup?.cells?.[id]?.[inning] || ''
          if (!FIELD_POSITIONS.includes(position)) return

          const bucket = positionBucket(position)
          counts[id][bucket] = Number(counts[id][bucket] || 0) + 1
          counts[id].fieldTotal += 1
        })
      }
    })

    return counts
  }

  function bucketTarget(counts, playerId, bucket) {
    const targetPct = Number(priorityValue(priorityMap, playerId, bucket) || 0)
    if (targetPct <= 0) return 0
    return Math.round((Number(counts?.[playerId]?.fieldTotal || 0) * targetPct) / 100)
  }

  function bucketScore(counts, playerId, bucket) {
    const targetPct = Number(priorityValue(priorityMap, playerId, bucket) || 0)
    const actual = Number(counts?.[playerId]?.[bucket] || 0)
    const target = bucketTarget(counts, playerId, bucket)

    if (targetPct <= 0) return actual * 600000

    const shortfall = Math.max(0, target - actual)
    const overage = Math.max(0, actual - target)

    return shortfall * 1200000 + overage * 900000
  }

  function totalPlanScore(counts) {
    let score = 0
    playerIds.forEach((playerId) => {
      PRIORITY_POSITIONS.forEach((bucket) => {
        score += bucketScore(counts, playerId, bucket)
      })
    })
    return score
  }

  function moveCount(counts, playerId, bucket, amount) {
    counts[playerId][bucket] = Number(counts[playerId][bucket] || 0) + amount
  }

  let changed = true
  let guard = 0

  while (changed && guard < 250) {
    changed = false
    guard += 1

    const counts = buildCounts()
    const beforeScore = totalPlanScore(counts)

    let bestSwap = null
    let bestGain = 0

    gameIds.forEach((gameId) => {
      if (lineupLockedByGame?.[gameId]) return

      const lineup = next[gameId]
      if (!lineup) return

      for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
        for (let aIndex = 0; aIndex < playerIds.length; aIndex += 1) {
          for (let bIndex = aIndex + 1; bIndex < playerIds.length; bIndex += 1) {
            const playerA = playerIds[aIndex]
            const playerB = playerIds[bIndex]

            if (lockedValue(lineup, playerA, inning)) continue
            if (lockedValue(lineup, playerB, inning)) continue

            const posA = lineup?.cells?.[playerA]?.[inning] || ''
            const posB = lineup?.cells?.[playerB]?.[inning] || ''

            if (!FIELD_POSITIONS.includes(posA)) continue
            if (!FIELD_POSITIONS.includes(posB)) continue

            const bucketA = positionBucket(posA)
            const bucketB = positionBucket(posB)

            if (bucketA === bucketB) continue
            if (!allowedAt(playerA, posB)) continue
            if (!allowedAt(playerB, posA)) continue

            moveCount(counts, playerA, bucketA, -1)
            moveCount(counts, playerA, bucketB, 1)
            moveCount(counts, playerB, bucketB, -1)
            moveCount(counts, playerB, bucketA, 1)

            const afterScore = totalPlanScore(counts)
            const gain = beforeScore - afterScore

            moveCount(counts, playerA, bucketA, 1)
            moveCount(counts, playerA, bucketB, -1)
            moveCount(counts, playerB, bucketB, 1)
            moveCount(counts, playerB, bucketA, -1)

            if (gain > bestGain) {
              bestGain = gain
              bestSwap = { gameId, inning, playerA, playerB, posA, posB }
            }
          }
        }
      }
    })

    if (bestSwap) {
      const lineup = next[bestSwap.gameId]
      lineup.cells[bestSwap.playerA][bestSwap.inning] = bestSwap.posB
      lineup.cells[bestSwap.playerB][bestSwap.inning] = bestSwap.posA
      changed = true
    }
  }

  gameIds.forEach((gameId) => {
    const lineup = next[gameId]
    if (!lineup) return

    repairMissingAndDuplicatePositions({
      lineup,
      players,
      fitMap,
      priorityMap,
      optimizerProfileRules,
    })

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
  totalsBefore,
  priorityMap,
  fitMap,
  planSitOutTargets = {},
  batchCurrentOuts = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
  skipSingleGameRebalance = false,
}) {
  const safeAvailable = (availablePlayerIds || []).map(pk)

  const lineup = normalizeLineup(
    sourceLineup,
    players,
    Number(game?.innings || 6),
    safeAvailable.length ? safeAvailable : (players || []).map((p) => p.id)
  )

  lineup.innings = Number(game?.innings || lineup?.innings || 6)
  lineup.availablePlayerIds = safeAvailable.length
    ? safeAvailable
    : (players || []).map((p) => pk(p.id))

  clearUnlockedCells(lineup, players)

  const rollingTotals = clone(totalsBefore || {})
  const cumulativePlanOutCounts = {}
  const planPositionCounts = initializePlanPositionCounts(players)

  ;(players || []).forEach((player) => {
    const id = pk(player.id)

    cumulativePlanOutCounts[id] = Number(batchCurrentOuts?.[id] || 0)

    if (!rollingTotals[id]) {
      rollingTotals[id] = {
        playerId: id,
        name: player.name,
        jersey_number: player.jersey_number || '',
        games: 0,
        P: 0,
        C: 0,
        '1B': 0,
        '2B': 0,
        '3B': 0,
        SS: 0,
        LF: 0,
        CF: 0,
        RF: 0,
        IF: 0,
        OF: 0,
        Out: 0,
        Injury: 0,
        fieldTotal: 0,
        expectedOuts: 0,
        actualOuts: 0,
        delta: 0,
      }
    }
  })

  for (let inning = 1; inning <= lineup.innings; inning += 1) {
    const sitOutIds = chooseSitOutsForInning({
      lineup,
      inning,
      innings: lineup.innings,
      players,
      totalsBefore: rollingTotals,
      planSitOutTargets,
      cumulativePlanOutCounts,
      optimizerProfile,
      fitMap,
      optimizerProfileRules,
    })

    sitOutIds.forEach((id) => {
      if (!lockedValue(lineup, id, inning)) {
        lineup.cells[id][inning] = 'Out'
        cumulativePlanOutCounts[id] = Number(cumulativePlanOutCounts[id] || 0) + 1
      }
    })

    const eligibleAfterSits = getEligiblePlayerIdsForInning(lineup, inning, players)
    const fieldableAfterSits = eligibleAfterSits.filter(
      (id) => lineup.cells?.[id]?.[inning] !== 'Out'
    )

    const positionCoverageOk = FIELD_POSITIONS.every((pos) => {
      const rule = getPositionRule(optimizerProfileRules, pos)

      return fieldableAfterSits.some((id) => {
        const fit = normalizeFit(fitTier(fitMap, id, pos))
        return fitAllowedByRule(rule, fit)
      })
    })

    if (!positionCoverageOk) {
      sitOutIds.forEach((id) => {
        if (!lockedValue(lineup, id, inning)) {
          lineup.cells[id][inning] = ''
          cumulativePlanOutCounts[id] = Math.max(
            0,
            Number(cumulativePlanOutCounts[id] || 0) - 1
          )
        }
      })
    }

    const assigned = assignPositionsForInning({
      lineup,
      inning,
      players,
      rollingTotals,
      priorityMap,
      fitMap,
      planPositionCounts,
      optimizerProfile,
      optimizerProfileRules,
    })

    Object.entries(assigned).forEach(([playerId, position]) => {
      if (!lockedValue(lineup, playerId, inning)) {
        lineup.cells[playerId][inning] = position
      }
    })

    const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)

    eligibleIds.forEach((id) => {
      const value = lineup?.cells?.[id]?.[inning] || ''
      if (FIELD_POSITIONS.includes(value)) {
        incrementPlanPositionCount(planPositionCounts, id, value)
      }
    })

    const expectedOuts = Math.max(0, eligibleIds.length - 9)
    let currentOuts = eligibleIds.filter(
      (id) => lineup.cells?.[id]?.[inning] === 'Out'
    ).length

    eligibleIds.forEach((id) => {
      if (lockedValue(lineup, id, inning)) return

      const value = lineup.cells?.[id]?.[inning]

      if (!value || value === '') {
        if (currentOuts < expectedOuts) {
          lineup.cells[id][inning] = 'Out'
          currentOuts += 1
        } else {
          lineup.cells[id][inning] = ''
        }
      }
    })

    const inningTotals = computeTotals(
      [
        {
          innings: 1,
          availablePlayerIds: lineup.availablePlayerIds,
          battingOrder: lineup.battingOrder,
          cells: Object.fromEntries(
            (players || []).map((player) => [
              pk(player.id),
              { 1: lineup.cells?.[pk(player.id)]?.[inning] || '' },
            ])
          ),
        },
      ],
      players
    )

    Object.keys(rollingTotals).forEach((id) => {
      const current = rollingTotals[id]
      const add = inningTotals[id]
      if (!current || !add) return

      current.P += add.P
      current.C += add.C
      current['1B'] += add['1B']
      current['2B'] += add['2B']
      current['3B'] += add['3B']
      current.SS += add.SS
      current.LF += add.LF
      current.CF += add.CF
      current.RF += add.RF
      current.IF += add.IF
      current.OF += add.OF
      current.Out += add.Out
      current.Injury += add.Injury
      current.fieldTotal += add.fieldTotal
      current.expectedOuts += add.expectedOuts
      current.actualOuts += add.actualOuts
      current.delta = Number((current.actualOuts - current.expectedOuts).toFixed(2))
    })
  }

  repairMissingAndDuplicatePositions({
    lineup,
    players,
    fitMap,
    priorityMap,
    optimizerProfileRules,
  })

  enforceConsecutivePositionRules({
    lineup,
    players,
    fitMap,
    optimizerProfileRules,
  })

  repairMissingAndDuplicatePositions({
    lineup,
    players,
    fitMap,
    priorityMap,
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

    repairMissingAndDuplicatePositions({
      lineup,
      players,
      fitMap,
      priorityMap,
      optimizerProfileRules,
    })
  }

  if (!skipSingleGameRebalance) {
    rebalanceTowardPriorityTargets({
      lineup,
      players,
      fitMap,
      priorityMap,
      totalsBefore,
      optimizerProfileRules,
    })
  }

  repairMissingAndDuplicatePositions({
    lineup,
    players,
    fitMap,
    priorityMap,
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
