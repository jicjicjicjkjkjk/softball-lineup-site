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

const OUT = 'Out'
const INJURY = 'Injury'
const POSITION_BUCKETS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']

const HARD_FAIL = -1_000_000_000

function idOf(value) {
  return pk(value)
}

function idsOf(players = []) {
  return (players || []).map((player) => pk(player.id))
}

function numberOr(value, fallback = 0) {
  const n = Number(value)
  return Number.isNaN(n) ? fallback : n
}

function targetNumber(value) {
  if (value === '' || value === null || value === undefined) return null
  const n = Number(value)
  return Number.isNaN(n) ? null : n
}

function hasRealTarget(value) {
  return targetNumber(value) !== null
}

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

function fitPenalty(fit, allowed) {
  if (!allowed) return -2_500_000
  if (fit === 'primary') return 400_000
  if (fit === 'secondary') return 250_000
  if (fit === 'development') return 90_000
  return -750_000
}

function makePlayerNameMap(players = []) {
  const map = {}

  ;(players || []).forEach((player) => {
    map[pk(player.id)] = player.name || ''
  })

  return map
}

function ensureLineupCells(lineup, players) {
  if (!lineup.cells) lineup.cells = {}

  idsOf(players).forEach((id) => {
    if (!lineup.cells[id]) lineup.cells[id] = {}

    for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
      if (lineup.cells[id][inning] === undefined || lineup.cells[id][inning] === null) {
        lineup.cells[id][inning] = ''
      }
    }
  })

  return lineup
}

function allowedAt({ playerId, position, fitMap, optimizerProfileRules }) {
  const rule = getPositionRule(optimizerProfileRules, position)
  const fit = normalizeFit(fitTier(fitMap, playerId, position))
  return fitAllowedByRule(rule, fit)
}

function getEligiblePlayerIdsForInning(lineup, inning, players) {
  const availableSet = new Set((lineup?.availablePlayerIds || []).map(pk))

  return idsOf(players).filter((id) => {
    if (!availableSet.has(id)) return false
    return (lineup?.cells?.[id]?.[inning] || '') !== INJURY
  })
}

function getLockedAssignmentsForInning(lineup, inning, players) {
  const lockedFieldPlayers = new Set()
  const lockedOutPlayers = new Set()
  const assignedPositions = new Set()
  const lockedPlayerValues = {}

  idsOf(players).forEach((id) => {
    if (!lockedValue(lineup, id, inning)) return

    const value = lineup?.cells?.[id]?.[inning] || ''
    lockedPlayerValues[id] = value

    if (value === OUT) {
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
    lockedPlayerValues,
    lockedOuts: lockedOutPlayers.size,
  }
}

function expectedOutsForInning(lineup, inning, players) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  return Math.max(0, eligibleIds.length - Math.min(9, eligibleIds.length))
}

function countPlayerOuts(lineup, playerId) {
  const id = pk(playerId)
  let total = 0

  for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
    if (lineup?.cells?.[id]?.[inning] === OUT) total += 1
  }

  return total
}

function countLockedPlayerOuts(lineup, playerId) {
  const id = pk(playerId)
  let total = 0

  for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
    if (lockedValue(lineup, id, inning) && lineup?.cells?.[id]?.[inning] === OUT) {
      total += 1
    }
  }

  return total
}

function countPlanOuts(lineupsByGame, games, players) {
  const counts = {}

  idsOf(players).forEach((id) => {
    counts[id] = 0
  })

  ;(games || []).forEach((game) => {
    const lineup = lineupsByGame?.[pk(game.id)]
    if (!lineup) return

    idsOf(players).forEach((id) => {
      counts[id] += countPlayerOuts(lineup, id)
    })
  })

  return counts
}

function countLockedPlanOuts(lineupsByGame, games, players) {
  const counts = {}

  idsOf(players).forEach((id) => {
    counts[id] = 0
  })

  ;(games || []).forEach((game) => {
    const lineup = lineupsByGame?.[pk(game.id)]
    if (!lineup) return

    idsOf(players).forEach((id) => {
      counts[id] += countLockedPlayerOuts(lineup, id)
    })
  })

  return counts
}

function gameTargetFor(lineup, playerId) {
  return targetNumber(lineup?.gameSitOutTargets?.[pk(playerId)])
}

function planTargetFor(planSitOutTargets, playerId) {
  return targetNumber(planSitOutTargets?.[pk(playerId)])
}

function previousOutDistance(lineup, playerId, inning) {
  const id = pk(playerId)

  for (let prev = inning - 1; prev >= 1; prev -= 1) {
    if ((lineup?.cells?.[id]?.[prev] || '') === OUT) return inning - prev
  }

  return 999
}

function nextOutDistance(lineup, playerId, inning, innings) {
  const id = pk(playerId)

  for (let next = inning + 1; next <= innings; next += 1) {
    if ((lineup?.cells?.[id]?.[next] || '') === OUT) return next - inning
  }

  return 999
}

function violatesSitSpacing(lineup, playerId, inning, innings, minGap = 2) {
  const gap = Number(minGap || 0)
  if (gap <= 0) return false

  return (
    previousOutDistance(lineup, playerId, inning) <= gap ||
    nextOutDistance(lineup, playerId, inning, innings) <= gap
  )
}

function expectedFieldInningsForPlayer(lineup, playerId) {
  const id = pk(playerId)
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)

  if (!availableIds.includes(id)) return 0

  let expected = 0

  for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
    const eligibleIds = availableIds.filter(
      (pid) => (lineup?.cells?.[pk(pid)]?.[inning] || '') !== INJURY
    )

    if (!eligibleIds.includes(id)) continue

    expected += Math.min(9, eligibleIds.length) / Math.max(eligibleIds.length, 1)
  }

  return expected
}

function buildExpectedFieldTotalsForPlan(games, lineupsByGame, players) {
  const totals = {}

  idsOf(players).forEach((id) => {
    totals[id] = 0
  })

  ;(games || []).forEach((game) => {
    const lineup = lineupsByGame?.[pk(game.id)]
    if (!lineup) return

    idsOf(players).forEach((id) => {
      totals[id] += expectedFieldInningsForPlayer(lineup, id)
    })
  })

  return totals
}

function makeTargetCounts({ players, priorityMap, expectedFieldTotals }) {
  const targets = {}

  idsOf(players).forEach((id) => {
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

  idsOf(players).forEach((id) => {
    counts[id] = blankBucketCounts({ Out: 0, fieldTotal: 0 })
  })

  return counts
}

function addLockedCounts({ lineup, players, actualCounts }) {
  for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
    idsOf(players).forEach((id) => {
      if (!lockedValue(lineup, id, inning)) return

      const value = lineup?.cells?.[id]?.[inning] || ''

      if (value === OUT) {
        actualCounts[id].Out += 1
        return
      }

      if (FIELD_POSITIONS.includes(value)) {
        const bucket = positionBucket(value)
        actualCounts[id][bucket] += 1
        actualCounts[id].fieldTotal += 1
      }
    })
  }
}

function clearUnlockedGeneratedCells(lineup, players) {
  idsOf(players).forEach((id) => {
    for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
      if (lockedValue(lineup, id, inning)) continue

      const value = lineup?.cells?.[id]?.[inning] || ''

      if (value !== INJURY) {
        lineup.cells[id][inning] = ''
      }
    }
  })
}

function canFillAllPositions({
  lineup,
  inning,
  players,
  fitMap,
  optimizerProfileRules,
  candidateOuts,
  allowEmergencyFits = true,
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
    const strict = usableIds.filter((id) =>
      allowedAt({
        playerId: id,
        position,
        fitMap,
        optimizerProfileRules,
      })
    )

    candidatesByPosition[position] = strict.length || !allowEmergencyFits ? strict : usableIds
  })

  const orderedPositions = [...openPositions].sort(
    (a, b) => (candidatesByPosition[a]?.length || 0) - (candidatesByPosition[b]?.length || 0)
  )

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

function targetInfoForPlayer({
  lineup,
  playerId,
  planSitOutTargets,
  planCounts,
}) {
  const id = pk(playerId)
  const gameTarget = gameTargetFor(lineup, id)

  if (gameTarget !== null) {
    const current = countPlayerOuts(lineup, id)

    return {
      scope: 'game',
      hasTarget: true,
      target: gameTarget,
      current,
      need: gameTarget - current,
    }
  }

  const planTarget = planTargetFor(planSitOutTargets, id)

  if (planTarget !== null) {
    const current = Number(planCounts?.[id] || 0)

    return {
      scope: 'plan',
      hasTarget: true,
      target: planTarget,
      current,
      need: planTarget - current,
    }
  }

  return {
    scope: 'none',
    hasTarget: false,
    target: null,
    current: Number(planCounts?.[id] || 0),
    need: 0,
  }
}

function canAddOutByTarget({
  lineup,
  playerId,
  planSitOutTargets,
  planCounts,
  allowOverTarget = false,
}) {
  const id = pk(playerId)
  const gameTarget = gameTargetFor(lineup, id)

  if (gameTarget !== null) {
    if (countPlayerOuts(lineup, id) < gameTarget) return true
    return allowOverTarget
  }

  const planTarget = planTargetFor(planSitOutTargets, id)

  if (planTarget !== null) {
    if (Number(planCounts?.[id] || 0) < planTarget) return true
    return allowOverTarget
  }

  return true
}

function canRemoveOutByTarget({
  lineup,
  playerId,
  planSitOutTargets,
  planCounts,
}) {
  const id = pk(playerId)
  const gameTarget = gameTargetFor(lineup, id)

  if (gameTarget !== null) {
    return countPlayerOuts(lineup, id) > gameTarget
  }

  const planTarget = planTargetFor(planSitOutTargets, id)

  if (planTarget !== null) {
    return Number(planCounts?.[id] || 0) > planTarget
  }

  return true
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
  const allowed = allowedAt({ playerId: id, position, fitMap, optimizerProfileRules })
  const priorityPct = Number(priorityValue(priorityMap, id, bucket) || 0)
  const actual = Number(actualCounts?.[id]?.[bucket] || 0)
  const target = Number(targetCounts?.[id]?.[bucket] || 0)
  const remainingTarget = target - actual
  const importance = Number(positionImportance(optimizerProfileRules, position) || 1)
  const previous = inning > 1 ? lineup?.cells?.[id]?.[inning - 1] || '' : ''
  const mode = consecutiveMode(optimizerProfileRules, position)

  let score = 0

  score += remainingTarget > 0 ? remainingTarget * 600_000 : remainingTarget * 150_000
  score += fitQuality(fit) * 100_000 * importance
  score += fitPenalty(fit, allowed)
  score += priorityPct * 3_000

  if (previous === position) {
    score += mode === 'prefer' || mode === 'must_2' ? 60_000 : 10_000
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
    .sort(
      (a, b) =>
        positionFillRank(optimizerProfileRules, a) -
          positionFillRank(optimizerProfileRules, b) ||
        positionImportance(optimizerProfileRules, b) -
          positionImportance(optimizerProfileRules, a)
    )

  const candidateIds = eligibleIds.filter((id) => {
    if (lockedInfo.lockedFieldPlayers.has(id)) return false
    if (lockedInfo.lockedOutPlayers.has(id)) return false
    if ((lineup?.cells?.[id]?.[inning] || '') === OUT) return false
    return true
  })

  function buildCandidates(allowEmergencyFits) {
    const byPosition = {}

    openPositions.forEach((position) => {
      const strictIds = candidateIds.filter((id) =>
        allowedAt({
          playerId: id,
          position,
          fitMap,
          optimizerProfileRules,
        })
      )

      const idsToUse = strictIds.length || !allowEmergencyFits ? strictIds : candidateIds

      byPosition[position] = idsToUse
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
    })

    return byPosition
  }

  function solve(allowEmergencyFits) {
    const candidatesByPosition = buildCandidates(allowEmergencyFits)

    const orderedPositions = [...openPositions]
      .filter((position) => (candidatesByPosition[position]?.length || 0) > 0)
      .sort(
        (a, b) =>
          (candidatesByPosition[a]?.length || 0) -
            (candidatesByPosition[b]?.length || 0) ||
          positionFillRank(optimizerProfileRules, a) -
            positionFillRank(optimizerProfileRules, b)
      )

    let bestAssignment = {}
    let bestScore = -Infinity
    let bestFilledCount = -1
    let nodes = 0
    const nodeLimit = 50_000

    function remember(assignment, score) {
      const filledCount = Object.keys(assignment).length

      if (
        filledCount > bestFilledCount ||
        (filledCount === bestFilledCount && score > bestScore)
      ) {
        bestFilledCount = filledCount
        bestScore = score
        bestAssignment = { ...assignment }
      }
    }

    function search(index, usedIds, assignment, runningScore) {
      nodes += 1
      if (nodes > nodeLimit) return

      remember(assignment, runningScore)

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

      search(index + 1, usedIds, assignment, runningScore + HARD_FAIL)
    }

    search(0, new Set(), {}, 0)

    return {
      assignment: bestAssignment,
      filledCount: bestFilledCount,
      neededCount: openPositions.length,
      usedEmergency: allowEmergencyFits,
    }
  }

  const strictResult = solve(false)

  if (strictResult.filledCount >= strictResult.neededCount) {
    return strictResult
  }

  return solve(true)
}

function chooseOutsForInning({
  lineup,
  inning,
  players,
  fitMap,
  planSitOutTargets,
  planCounts,
  optimizerProfile,
  optimizerProfileRules,
}) {
  const innings = Number(lineup?.innings || 0)
  const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)
  const expectedOuts = expectedOutsForInning(lineup, inning, players)

  const chosen = new Set(lockedInfo.lockedOutPlayers)

  if (chosen.size >= expectedOuts) {
    return [...chosen]
  }

  const playerNameById = makePlayerNameMap(players)

  const rows = eligibleIds
    .filter((id) => !lockedInfo.lockedFieldPlayers.has(id))
    .filter((id) => !lockedInfo.lockedOutPlayers.has(id))
    .map((id) => {
      const info = targetInfoForPlayer({
        lineup,
        playerId: id,
        planSitOutTargets,
        planCounts,
      })

      return {
        id,
        ...info,
        spacingBad: violatesSitSpacing(lineup, id, inning, innings, minGap),
        planOuts: Number(planCounts?.[id] || 0),
        gameOuts: countPlayerOuts(lineup, id),
        name: playerNameById[id] || '',
      }
    })

  function addRows({
    filter,
    allowSpacing = false,
    allowOverTarget = false,
    allowEmergencyFits = false,
  }) {
    const sorted = rows
      .filter(filter)
      .filter((row) => allowSpacing || !row.spacingBad)
      .filter((row) =>
        canAddOutByTarget({
          lineup,
          playerId: row.id,
          planSitOutTargets,
          planCounts,
          allowOverTarget,
        })
      )
      .sort((a, b) => {
        if (a.scope !== b.scope) {
          if (a.scope === 'game') return -1
          if (b.scope === 'game') return 1
          if (a.scope === 'plan') return -1
          if (b.scope === 'plan') return 1
        }

        if (a.need !== b.need) return b.need - a.need
        if (a.planOuts !== b.planOuts) return a.planOuts - b.planOuts
        if (a.gameOuts !== b.gameOuts) return a.gameOuts - b.gameOuts
        return a.name.localeCompare(b.name)
      })

    for (const row of sorted) {
      if (chosen.size >= expectedOuts) break
      if (chosen.has(row.id)) continue

      const test = new Set(chosen)
      test.add(row.id)

      if (
        canFillAllPositions({
          lineup,
          inning,
          players,
          fitMap,
          optimizerProfileRules,
          candidateOuts: test,
          allowEmergencyFits,
        })
      ) {
        chosen.add(row.id)
      }
    }
  }

  const passes = [
    {
      filter: (row) => row.scope === 'game' && row.need > 0,
      allowSpacing: false,
      allowOverTarget: false,
      allowEmergencyFits: false,
    },
    {
      filter: (row) => row.scope === 'game' && row.need > 0,
      allowSpacing: true,
      allowOverTarget: false,
      allowEmergencyFits: false,
    },
    {
      filter: (row) => row.scope === 'plan' && row.need > 0,
      allowSpacing: false,
      allowOverTarget: false,
      allowEmergencyFits: false,
    },
    {
      filter: (row) => row.scope === 'plan' && row.need > 0,
      allowSpacing: true,
      allowOverTarget: false,
      allowEmergencyFits: false,
    },
    {
      filter: (row) => row.scope === 'none',
      allowSpacing: false,
      allowOverTarget: false,
      allowEmergencyFits: false,
    },
    {
      filter: (row) => row.scope === 'none',
      allowSpacing: true,
      allowOverTarget: false,
      allowEmergencyFits: false,
    },
    {
      filter: () => true,
      allowSpacing: true,
      allowOverTarget: true,
      allowEmergencyFits: true,
    },
  ]

  for (const pass of passes) {
    if (chosen.size >= expectedOuts) break
    addRows(pass)
  }

  return [...chosen]
}

function applyInning({
  lineup,
  inning,
  players,
  fitMap,
  priorityMap,
  targetCounts,
  actualCounts,
  planSitOutTargets,
  planCounts,
  optimizerProfile,
  optimizerProfileRules,
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const expectedOuts = expectedOutsForInning(lineup, inning, players)

  eligibleIds.forEach((id) => {
    if (lockedValue(lineup, id, inning)) return
    if ((lineup?.cells?.[id]?.[inning] || '') !== INJURY) {
      lineup.cells[id][inning] = ''
    }
  })

  const outIds = chooseOutsForInning({
    lineup,
    inning,
    players,
    fitMap,
    planSitOutTargets,
    planCounts,
    optimizerProfile,
    optimizerProfileRules,
  })

  outIds.forEach((id) => {
    if (!lockedValue(lineup, id, inning)) {
      lineup.cells[id][inning] = OUT
    }
  })

  const currentOutCount = eligibleIds.filter(
    (id) => lineup?.cells?.[id]?.[inning] === OUT
  ).length

  if (currentOutCount < expectedOuts) {
    const unlockedFieldCandidates = eligibleIds.filter((id) => {
      if (lockedValue(lineup, id, inning)) return false
      if ((lineup?.cells?.[id]?.[inning] || '') === OUT) return false
      return true
    })

    for (const id of unlockedFieldCandidates) {
      if (
        eligibleIds.filter((pid) => lineup?.cells?.[pid]?.[inning] === OUT).length >=
        expectedOuts
      ) {
        break
      }

      const test = new Set(
        eligibleIds.filter((pid) => lineup?.cells?.[pid]?.[inning] === OUT)
      )
      test.add(id)

      if (
        canFillAllPositions({
          lineup,
          inning,
          players,
          fitMap,
          optimizerProfileRules,
          candidateOuts: test,
          allowEmergencyFits: true,
        })
      ) {
        lineup.cells[id][inning] = OUT
      }
    }
  }

  const result = assignPositionsForInning({
    lineup,
    inning,
    players,
    fitMap,
    priorityMap,
    targetCounts,
    actualCounts,
    optimizerProfileRules,
  })

  Object.entries(result.assignment || {}).forEach(([id, position]) => {
    if (!lockedValue(lineup, id, inning)) {
      lineup.cells[id][inning] = position
    }
  })

  eligibleIds.forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''

    if (value === OUT) {
      actualCounts[id].Out += 1

      if (!lockedValue(lineup, id, inning)) {
        planCounts[id] = Number(planCounts[id] || 0) + 1
      }
    }

    if (FIELD_POSITIONS.includes(value)) {
      const bucket = positionBucket(value)
      actualCounts[id][bucket] += 1
      actualCounts[id].fieldTotal += 1
    }
  })
}

function rebuildUnlockedLineup({
  lineup,
  players,
  fitMap,
  priorityMap,
  planSitOutTargets = {},
  planCounts = {},
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  clearUnlockedGeneratedCells(lineup, players)

  const expectedFieldTotals = {}

  idsOf(players).forEach((id) => {
    expectedFieldTotals[id] = expectedFieldInningsForPlayer(lineup, id)
  })

  const targetCounts = makeTargetCounts({
    players,
    priorityMap,
    expectedFieldTotals,
  })

  const actualCounts = makeActualCounts(players)
  addLockedCounts({ lineup, players, actualCounts })

  for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
    applyInning({
      lineup,
      inning,
      players,
      fitMap,
      priorityMap,
      targetCounts,
      actualCounts,
      planSitOutTargets,
      planCounts,
      optimizerProfile,
      optimizerProfileRules,
    })
  }

  return lineup
}

function rebuildOneInning({
  lineup,
  inning,
  players,
  fitMap,
  priorityMap,
  planSitOutTargets = {},
  planCounts = {},
  forcedOutIds = [],
  protectedFieldIds = [],
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const snapshot = {}

  idsOf(players).forEach((id) => {
    snapshot[id] = lineup?.cells?.[id]?.[inning] || ''
  })

  const forcedSet = new Set(forcedOutIds.map(pk))
  const protectedSet = new Set(protectedFieldIds.map(pk))

  idsOf(players).forEach((id) => {
    if (lockedValue(lineup, id, inning)) return
    if ((lineup?.cells?.[id]?.[inning] || '') === INJURY) return

    lineup.cells[id][inning] = forcedSet.has(id) ? OUT : ''
  })

  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const expectedOuts = expectedOutsForInning(lineup, inning, players)

  let currentOutIds = new Set(
    eligibleIds.filter((id) => lineup?.cells?.[id]?.[inning] === OUT)
  )

  if (currentOutIds.size > expectedOuts) {
    Object.entries(snapshot).forEach(([id, value]) => {
      lineup.cells[id][inning] = value
    })
    return false
  }

  const expectedFieldTotals = {}
  idsOf(players).forEach((id) => {
    expectedFieldTotals[id] = expectedFieldInningsForPlayer(lineup, id)
  })

  const targetCounts = makeTargetCounts({
    players,
    priorityMap,
    expectedFieldTotals,
  })

  const actualCounts = makeActualCounts(players)
  const innings = Number(lineup?.innings || 0)
  const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)

  const fillRows = eligibleIds
    .filter((id) => !currentOutIds.has(id))
    .filter((id) => !forcedSet.has(id))
    .filter((id) => !protectedSet.has(id))
    .filter((id) => !lockedValue(lineup, id, inning))
    .map((id) => {
      const info = targetInfoForPlayer({
        lineup,
        playerId: id,
        planSitOutTargets,
        planCounts,
      })

      return {
        id,
        ...info,
        spacingBad: violatesSitSpacing(lineup, id, inning, innings, minGap),
        planOuts: Number(planCounts?.[id] || 0),
      }
    })

  for (const allowOverTarget of [false, true]) {
    for (const allowSpacing of [false, true]) {
      const rows = [...fillRows]
        .filter((row) => allowSpacing || !row.spacingBad)
        .filter((row) =>
          canAddOutByTarget({
            lineup,
            playerId: row.id,
            planSitOutTargets,
            planCounts,
            allowOverTarget,
          })
        )
        .sort((a, b) => b.need - a.need || a.planOuts - b.planOuts)

      for (const row of rows) {
        if (currentOutIds.size >= expectedOuts) break

        const test = new Set(currentOutIds)
        test.add(row.id)

        if (
          canFillAllPositions({
            lineup,
            inning,
            players,
            fitMap,
            optimizerProfileRules,
            candidateOuts: test,
            allowEmergencyFits: true,
          })
        ) {
          lineup.cells[row.id][inning] = OUT
          currentOutIds.add(row.id)
        }
      }

      if (currentOutIds.size >= expectedOuts) break
    }

    if (currentOutIds.size >= expectedOuts) break
  }

  if (currentOutIds.size !== expectedOuts) {
    Object.entries(snapshot).forEach(([id, value]) => {
      lineup.cells[id][inning] = value
    })
    return false
  }

  const result = assignPositionsForInning({
    lineup,
    inning,
    players,
    fitMap,
    priorityMap,
    targetCounts,
    actualCounts,
    optimizerProfileRules,
  })

  Object.entries(result.assignment || {}).forEach(([id, position]) => {
    if (!lockedValue(lineup, id, inning)) {
      lineup.cells[id][inning] = position
    }
  })

  const invalid = eligibleIds.some((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''
    return value !== OUT && !FIELD_POSITIONS.includes(value)
  })

  if (invalid) {
    Object.entries(snapshot).forEach(([id, value]) => {
      lineup.cells[id][inning] = value
    })
    return false
  }

  return true
}

function enforceConsecutivePositionRules({ lineup, players, fitMap, optimizerProfileRules }) {
  const innings = Number(lineup?.innings || 0)
  if (!innings) return lineup

  const playerIds = idsOf(players)

  function playerAt(position, inning) {
    return playerIds.find((id) => lineup?.cells?.[id]?.[inning] === position)
  }

  function canSwap(playerA, playerB, inning) {
    const aPos = lineup?.cells?.[playerA]?.[inning] || ''
    const bPos = lineup?.cells?.[playerB]?.[inning] || ''

    if (!FIELD_POSITIONS.includes(aPos) || !FIELD_POSITIONS.includes(bPos)) return false
    if (lockedValue(lineup, playerA, inning)) return false
    if (lockedValue(lineup, playerB, inning)) return false

    return (
      allowedAt({ playerId: playerA, position: bPos, fitMap, optimizerProfileRules }) &&
      allowedAt({ playerId: playerB, position: aPos, fitMap, optimizerProfileRules })
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

      for (const neighbor of [inning + 1, inning - 1]) {
        if (neighbor < 1 || neighbor > innings) continue

        const otherId = playerAt(position, neighbor)
        if (!otherId || otherId === playerId) continue

        if (canSwap(playerId, otherId, neighbor)) {
          const temp = lineup.cells[playerId][neighbor]
          lineup.cells[playerId][neighbor] = position
          lineup.cells[otherId][neighbor] = temp
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
  const minPositions = Number(optimizerProfile?.min_positions_per_player || 1)
  const minInningsPerUsedPosition = Number(
    optimizerProfile?.min_innings_per_used_position || 1
  )
  const mode = optimizerProfile?.min_positions_mode || 'nice'

  if (mode === 'off' || minPositions <= 1) return lineup

  const availableIds = new Set((lineup?.availablePlayerIds || []).map(pk))
  const innings = Number(lineup?.innings || 0)

  function fieldInnings(playerId) {
    const id = pk(playerId)
    const rows = []

    for (let inning = 1; inning <= innings; inning += 1) {
      const value = lineup?.cells?.[id]?.[inning] || ''
      if (FIELD_POSITIONS.includes(value)) rows.push({ inning, value })
    }

    return rows
  }

  function qualifiedPositions(playerId) {
    const counts = {}

    fieldInnings(playerId).forEach(({ value }) => {
      counts[value] = Number(counts[value] || 0) + 1
    })

    return new Set(
      Object.entries(counts)
        .filter(([, count]) => count >= minInningsPerUsedPosition)
        .map(([position]) => position)
    )
  }

  function playerAt(inning, position) {
    return idsOf(players).find((id) => lineup?.cells?.[id]?.[inning] === position)
  }

  function canSwap(playerA, playerB, inning) {
    const aPos = lineup?.cells?.[playerA]?.[inning] || ''
    const bPos = lineup?.cells?.[playerB]?.[inning] || ''

    if (!FIELD_POSITIONS.includes(aPos) || !FIELD_POSITIONS.includes(bPos)) return false
    if (lockedValue(lineup, playerA, inning)) return false
    if (lockedValue(lineup, playerB, inning)) return false

    return (
      allowedAt({ playerId: playerA, position: bPos, fitMap, optimizerProfileRules }) &&
      allowedAt({ playerId: playerB, position: aPos, fitMap, optimizerProfileRules })
    )
  }

  idsOf(players).forEach((playerId) => {
    if (!availableIds.has(playerId)) return

    if (qualifiedPositions(playerId).size >= minPositions) return

    const rows = fieldInnings(playerId).filter(
      ({ inning }) => !lockedValue(lineup, playerId, inning)
    )

    for (const { inning, value } of rows) {
      const alternatives = FIELD_POSITIONS
        .filter((position) => position !== value)
        .filter((position) =>
          allowedAt({ playerId, position, fitMap, optimizerProfileRules })
        )
        .sort(
          (a, b) =>
            Number(priorityValue(priorityMap, playerId, b) || 0) -
            Number(priorityValue(priorityMap, playerId, a) || 0)
        )

      for (const alt of alternatives) {
        const otherId = playerAt(inning, alt)
        if (!otherId || otherId === playerId) continue
        if (!canSwap(playerId, otherId, inning)) continue

        lineup.cells[playerId][inning] = alt
        lineup.cells[otherId][inning] = value

        if (qualifiedPositions(playerId).size >= minPositions) return
      }
    }
  })

  return lineup
}

function buildBalancedSitOutTargetsForPlan(games, lineupsByGame, players) {
  const rawTargets = {}
  const finalTargets = {}

  idsOf(players).forEach((id) => {
    rawTargets[id] = 0
    finalTargets[id] = 0
  })

  let totalNeeded = 0

  ;(games || []).forEach((game) => {
    const lineup = lineupsByGame?.[pk(game.id)]
    if (!lineup) return

    for (let inning = 1; inning <= Number(lineup?.innings || game?.innings || 0); inning += 1) {
      const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
      const outsNeeded = Math.max(0, eligibleIds.length - Math.min(9, eligibleIds.length))

      totalNeeded += outsNeeded

      eligibleIds.forEach((id) => {
        rawTargets[id] += outsNeeded / Math.max(eligibleIds.length, 1)
      })
    }
  })

  const rows = Object.entries(rawTargets)
    .map(([id, raw]) => ({
      id,
      floor: Math.floor(raw),
      remainder: raw - Math.floor(raw),
    }))
    .sort((a, b) => b.remainder - a.remainder)

  rows.forEach((row) => {
    finalTargets[row.id] = row.floor
  })

  let remaining = totalNeeded - rows.reduce((sum, row) => sum + row.floor, 0)

  for (const row of rows) {
    if (remaining <= 0) break

    finalTargets[row.id] += 1
    remaining -= 1
  }

  return finalTargets
}

function mergePlanTargets(autoTargets, userTargets) {
  const next = { ...(autoTargets || {}) }

  Object.entries(userTargets || {}).forEach(([playerId, value]) => {
    const target = targetNumber(value)
    if (target === null) return
    next[pk(playerId)] = target
  })

  return next
}

function enforceGameSitOutTargets({
  lineup,
  players,
  fitMap,
  priorityMap,
  planSitOutTargets,
  planCounts,
  optimizerProfile,
  optimizerProfileRules,
}) {
  let guard = 0

  while (guard < 100) {
    guard += 1

    const unders = idsOf(players)
      .map((id) => {
        const target = gameTargetFor(lineup, id)
        return {
          id,
          target,
          current: countPlayerOuts(lineup, id),
          need: target === null ? 0 : target - countPlayerOuts(lineup, id),
        }
      })
      .filter((row) => row.target !== null && row.need > 0)
      .sort((a, b) => b.need - a.need)

    if (!unders.length) break

    let changed = false

    for (const under of unders) {
      for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
        if (lockedValue(lineup, under.id, inning)) continue
        if ((lineup?.cells?.[under.id]?.[inning] || '') === OUT) continue

        const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
        if (!eligibleIds.includes(under.id)) continue

        const removableOuts = eligibleIds
          .filter((id) => id !== under.id)
          .filter((id) => (lineup?.cells?.[id]?.[inning] || '') === OUT)
          .filter((id) => !lockedValue(lineup, id, inning))
          .filter((id) =>
            canRemoveOutByTarget({
              lineup,
              playerId: id,
              planSitOutTargets,
              planCounts,
            })
          )
          .sort((a, b) => countPlayerOuts(lineup, b) - countPlayerOuts(lineup, a))

        for (const outId of removableOuts) {
          if (
            rebuildOneInning({
              lineup,
              inning,
              players,
              fitMap,
              priorityMap,
              planSitOutTargets,
              planCounts,
              forcedOutIds: [under.id],
              protectedFieldIds: [outId],
              optimizerProfile,
              optimizerProfileRules,
            })
          ) {
            changed = true
            break
          }
        }

        if (changed) break
      }

      if (changed) break
    }

    if (!changed) break
  }

  return lineup
}

function enforcePlanSitOutTargets({
  lineupsByGame,
  games,
  players,
  fitMap,
  priorityMap,
  planSitOutTargets,
  lineupLockedByGame,
  optimizerProfile,
  optimizerProfileRules,
}) {
  let guard = 0

  while (guard < 250) {
    guard += 1

    const counts = countPlanOuts(lineupsByGame, games, players)

    const unders = idsOf(players)
      .map((id) => {
        const target = planTargetFor(planSitOutTargets, id)
        return {
          id,
          target,
          current: Number(counts[id] || 0),
          need: target === null ? 0 : target - Number(counts[id] || 0),
        }
      })
      .filter((row) => row.target !== null && row.need > 0)
      .sort((a, b) => b.need - a.need || a.current - b.current)

    const overs = idsOf(players)
      .map((id) => {
        const target = planTargetFor(planSitOutTargets, id)
        return {
          id,
          target,
          current: Number(counts[id] || 0),
          over: target === null ? 0 : Number(counts[id] || 0) - target,
        }
      })
      .filter((row) => row.target !== null && row.over > 0)
      .sort((a, b) => b.over - a.over || b.current - a.current)

    if (!unders.length || !overs.length) break

    let changed = false

    for (const under of unders) {
      for (const over of overs) {
        if (under.id === over.id) continue

        for (const game of games || []) {
          const gameId = pk(game.id)
          const lineup = lineupsByGame?.[gameId]
          if (!lineup || lineupLockedByGame?.[gameId]) continue

          for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
            if (lockedValue(lineup, under.id, inning)) continue
            if (lockedValue(lineup, over.id, inning)) continue

            const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
            if (!eligibleIds.includes(under.id)) continue
            if (!eligibleIds.includes(over.id)) continue

            if ((lineup?.cells?.[under.id]?.[inning] || '') === OUT) continue
            if ((lineup?.cells?.[over.id]?.[inning] || '') !== OUT) continue

            if (
              !canAddOutByTarget({
                lineup,
                playerId: under.id,
                planSitOutTargets,
                planCounts: counts,
                allowOverTarget: false,
              })
            ) {
              continue
            }

            if (
              !canRemoveOutByTarget({
                lineup,
                playerId: over.id,
                planSitOutTargets,
                planCounts: counts,
              })
            ) {
              continue
            }

            if (
              rebuildOneInning({
                lineup,
                inning,
                players,
                fitMap,
                priorityMap,
                planSitOutTargets,
                planCounts: counts,
                forcedOutIds: [under.id],
                protectedFieldIds: [over.id],
                optimizerProfile,
                optimizerProfileRules,
              })
            ) {
              changed = true
              break
            }
          }

          if (changed) break
        }

        if (changed) break
      }

      if (changed) break
    }

    if (!changed) break
  }

  return lineupsByGame
}

function improveSitSpacing({
  lineupsByGame,
  games,
  players,
  fitMap,
  priorityMap,
  planSitOutTargets,
  lineupLockedByGame,
  optimizerProfile,
  optimizerProfileRules,
}) {
  const minGap = Number(optimizerProfile?.min_innings_between_sitouts ?? 2)
  if (minGap <= 0) return lineupsByGame

  let guard = 0

  while (guard < 100) {
    guard += 1

    const counts = countPlanOuts(lineupsByGame, games, players)
    let changed = false

    for (const game of games || []) {
      const gameId = pk(game.id)
      const lineup = lineupsByGame?.[gameId]
      if (!lineup || lineupLockedByGame?.[gameId]) continue

      for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
        const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)

        const sittingId = eligibleIds.find((id) => {
          if ((lineup?.cells?.[id]?.[inning] || '') !== OUT) return false
          if (lockedValue(lineup, id, inning)) return false
          return violatesSitSpacing(lineup, id, inning, Number(lineup?.innings || 0), minGap)
        })

        if (!sittingId) continue

        const replacementRows = eligibleIds
          .filter((id) => id !== sittingId)
          .filter((id) => !lockedValue(lineup, id, inning))
          .filter((id) => FIELD_POSITIONS.includes(lineup?.cells?.[id]?.[inning] || ''))
          .filter((id) =>
            canAddOutByTarget({
              lineup,
              playerId: id,
              planSitOutTargets,
              planCounts: counts,
              allowOverTarget: false,
            })
          )
          .filter((id) =>
            canRemoveOutByTarget({
              lineup,
              playerId: sittingId,
              planSitOutTargets,
              planCounts: counts,
            })
          )
          .filter(
            (id) =>
              !violatesSitSpacing(lineup, id, inning, Number(lineup?.innings || 0), minGap)
          )

        for (const replacementId of replacementRows) {
          if (
            rebuildOneInning({
              lineup,
              inning,
              players,
              fitMap,
              priorityMap,
              planSitOutTargets,
              planCounts: counts,
              forcedOutIds: [replacementId],
              protectedFieldIds: [sittingId],
              optimizerProfile,
              optimizerProfileRules,
            })
          ) {
            changed = true
            break
          }
        }

        if (changed) break
      }

      if (changed) break
    }

    if (!changed) break
  }

  return lineupsByGame
}

function reconcileExactTargets({
  lineupsByGame,
  games,
  players,
  fitMap,
  priorityMap,
  planSitOutTargets,
  lineupLockedByGame = {},
  optimizerProfile,
  optimizerProfileRules,
}) {
  function reconcileGameTargetsForLineup(lineup) {
    let guard = 0

    while (guard < 300) {
      guard += 1

      const unders = idsOf(players)
        .map((id) => {
          const target = gameTargetFor(lineup, id)
          const actual = countPlayerOuts(lineup, id)

          return {
            id,
            target,
            actual,
            need: target === null ? 0 : target - actual,
          }
        })
        .filter((row) => row.target !== null && row.need > 0)
        .sort((a, b) => b.need - a.need)

      if (!unders.length) break

      let changed = false

      for (const under of unders) {
        for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
          if (lockedValue(lineup, under.id, inning)) continue
          if ((lineup?.cells?.[under.id]?.[inning] || '') === OUT) continue

          const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
          if (!eligibleIds.includes(under.id)) continue

          const currentPlanCounts = countPlanOuts(lineupsByGame, games, players)

          const donors = eligibleIds
            .filter((id) => id !== under.id)
            .filter((id) => !lockedValue(lineup, id, inning))
            .filter((id) => (lineup?.cells?.[id]?.[inning] || '') === OUT)
            .map((id) => {
              const gTarget = gameTargetFor(lineup, id)
              const gActual = countPlayerOuts(lineup, id)
              const pTarget = planTargetFor(planSitOutTargets, id)
              const pActual = Number(currentPlanCounts?.[id] || 0)

              return {
                id,
                gameOver: gTarget === null ? 999 : gActual - gTarget,
                planOver: pTarget === null ? 999 : pActual - pTarget,
                totalOuts: pActual,
              }
            })
            .filter((row) => row.gameOver > 0 || row.planOver > 0 || row.gameOver === 999)
            .sort((a, b) => {
              if (a.gameOver !== b.gameOver) return b.gameOver - a.gameOver
              if (a.planOver !== b.planOver) return b.planOver - a.planOver
              return b.totalOuts - a.totalOuts
            })

          for (const donor of donors) {
            const planCounts = countPlanOuts(lineupsByGame, games, players)

            if (
              rebuildOneInning({
                lineup,
                inning,
                players,
                fitMap,
                priorityMap,
                planSitOutTargets,
                planCounts,
                forcedOutIds: [under.id],
                protectedFieldIds: [donor.id],
                optimizerProfile,
                optimizerProfileRules,
              })
            ) {
              changed = true
              break
            }
          }

          if (changed) break
        }

        if (changed) break
      }

      if (!changed) break
    }
  }

  function reconcilePlanTargets() {
    let guard = 0

    while (guard < 500) {
      guard += 1

      const counts = countPlanOuts(lineupsByGame, games, players)

      const unders = idsOf(players)
        .map((id) => {
          const target = planTargetFor(planSitOutTargets, id)
          const actual = Number(counts?.[id] || 0)

          return {
            id,
            target,
            actual,
            need: target === null ? 0 : target - actual,
          }
        })
        .filter((row) => row.target !== null && row.need > 0)
        .sort((a, b) => b.need - a.need)

      const overs = idsOf(players)
        .map((id) => {
          const target = planTargetFor(planSitOutTargets, id)
          const actual = Number(counts?.[id] || 0)

          return {
            id,
            target,
            actual,
            over: target === null ? 999 : actual - target,
          }
        })
        .filter((row) => row.target === null || row.over > 0)
        .sort((a, b) => b.over - a.over || b.actual - a.actual)

      if (!unders.length || !overs.length) break

      let changed = false

      for (const under of unders) {
        for (const over of overs) {
          if (under.id === over.id) continue

          for (const game of games || []) {
            const gameId = pk(game.id)
            const lineup = lineupsByGame?.[gameId]

            if (!lineup || lineupLockedByGame?.[gameId]) continue

            for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
              if (lockedValue(lineup, under.id, inning)) continue
              if (lockedValue(lineup, over.id, inning)) continue

              const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
              if (!eligibleIds.includes(under.id)) continue
              if (!eligibleIds.includes(over.id)) continue

              if ((lineup?.cells?.[under.id]?.[inning] || '') === OUT) continue
              if ((lineup?.cells?.[over.id]?.[inning] || '') !== OUT) continue

              const underGameTarget = gameTargetFor(lineup, under.id)
              if (
                underGameTarget !== null &&
                countPlayerOuts(lineup, under.id) >= underGameTarget
              ) {
                continue
              }

              const overGameTarget = gameTargetFor(lineup, over.id)
              if (
                overGameTarget !== null &&
                countPlayerOuts(lineup, over.id) <= overGameTarget
              ) {
                continue
              }

              const planCounts = countPlanOuts(lineupsByGame, games, players)

              if (
                rebuildOneInning({
                  lineup,
                  inning,
                  players,
                  fitMap,
                  priorityMap,
                  planSitOutTargets,
                  planCounts,
                  forcedOutIds: [under.id],
                  protectedFieldIds: [over.id],
                  optimizerProfile,
                  optimizerProfileRules,
                })
              ) {
                changed = true
                break
              }
            }

            if (changed) break
          }

          if (changed) break
        }

        if (changed) break
      }

      if (!changed) break
    }
  }

  ;(games || []).forEach((game) => {
    const gameId = pk(game.id)
    const lineup = lineupsByGame?.[gameId]

    if (!lineup || lineupLockedByGame?.[gameId]) return

    reconcileGameTargetsForLineup(lineup)
  })

  reconcilePlanTargets()

  ;(games || []).forEach((game) => {
    const gameId = pk(game.id)
    const lineup = lineupsByGame?.[gameId]

    if (!lineup || lineupLockedByGame?.[gameId]) return

    reconcileGameTargetsForLineup(lineup)
  })

  return lineupsByGame
}

function addOptimizerWarnings({
  lineup,
  players,
  planSitOutTargets = {},
  planCounts = {},
  fitMap,
  optimizerProfileRules,
}) {
  const warnings = []

  idsOf(players).forEach((id) => {
    const gameTarget = gameTargetFor(lineup, id)
    if (gameTarget !== null) {
      const actual = countPlayerOuts(lineup, id)
      if (actual !== gameTarget) {
        warnings.push({
          type: 'game_target_outs',
          playerId: id,
          target: gameTarget,
          actual,
          message: `Game Target Outs not met: ${id} has ${actual}, target ${gameTarget}.`,
        })
      }
    }
  })

  for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
    const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
    const outCount = eligibleIds.filter((id) => lineup?.cells?.[id]?.[inning] === OUT).length
    const expectedOuts = expectedOutsForInning(lineup, inning, players)

    if (outCount !== expectedOuts) {
      warnings.push({
        type: 'required_outs',
        inning,
        expected: expectedOuts,
        actual: outCount,
        message: `Inning ${inning}: expected ${expectedOuts} Outs, found ${outCount}.`,
      })
    }

    FIELD_POSITIONS.forEach((position) => {
      const holders = eligibleIds.filter((id) => lineup?.cells?.[id]?.[inning] === position)

      if (holders.length !== 1) {
        warnings.push({
          type: 'position_fill',
          inning,
          position,
          actual: holders.length,
          message: `Inning ${inning}: ${position} has ${holders.length} players assigned.`,
        })
      }

      holders.forEach((id) => {
        const fit = normalizeFit(fitTier(fitMap, id, position))
        const allowed = allowedAt({ playerId: id, position, fitMap, optimizerProfileRules })

        if (!allowed || fit === 'disallowed' || fit === 'none') {
          warnings.push({
            type: 'emergency_position',
            inning,
            playerId: id,
            position,
            fit,
            message: `Emergency position used: ${id} at ${position}.`,
          })
        }
      })
    })
  }

  lineup.optimizerWarnings = warnings
  return lineup
}

function prepareLineup({ game, players, sourceLineup, availablePlayerIds }) {
  const safeAvailable = (
    availablePlayerIds ||
    sourceLineup?.availablePlayerIds ||
    idsOf(players)
  ).map(pk)

  const lineup = normalizeLineup(
    sourceLineup,
    players,
    Number(sourceLineup?.innings || game?.innings || 6),
    safeAvailable.length ? safeAvailable : idsOf(players)
  )

  lineup.innings = Number(sourceLineup?.innings || game?.innings || lineup?.innings || 6)
  lineup.availablePlayerIds = safeAvailable.length ? safeAvailable : idsOf(players)

  lineup.gameSitOutTargets = {
    ...(sourceLineup?.gameSitOutTargets || lineup?.gameSitOutTargets || {}),
  }

  ensureLineupCells(lineup, players)

  return lineup
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
  const lineup = prepareLineup({
    game,
    players,
    sourceLineup,
    availablePlayerIds,
  })

  const planCounts = {}

  idsOf(players).forEach((id) => {
    planCounts[id] =
      Number(planTotalsBefore?.[id]?.Out || 0) + countLockedPlayerOuts(lineup, id)
  })

  rebuildUnlockedLineup({
    lineup,
    players,
    fitMap,
    priorityMap,
    planSitOutTargets,
    planCounts,
    optimizerProfile,
    optimizerProfileRules,
  })

    enforceGameSitOutTargets({
    lineup,
    players,
    fitMap,
    priorityMap,
    planSitOutTargets,
    planCounts,
    optimizerProfile,
    optimizerProfileRules,
  })

  reconcileExactTargets({
    lineupsByGame: { [pk(game.id)]: lineup },
    games: [game],
    players,
    fitMap,
    priorityMap,
    planSitOutTargets,
    lineupLockedByGame: {},
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

  lineup.validationIssues = validateLineup({
    lineup,
    players,
    fitMap,
    optimizerProfileRules,
  })

  addOptimizerWarnings({
    lineup,
    players,
    planSitOutTargets,
    planCounts,
    fitMap,
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
  const normalizedLineups = {}

  ;(games || []).forEach((game) => {
    const gameId = pk(game.id)
    const sourceLineup = sourceLineupsByGame?.[gameId]
    if (!sourceLineup) return

    normalizedLineups[gameId] = prepareLineup({
      game,
      players,
      sourceLineup,
      availablePlayerIds: availableIdsByGame?.[gameId],
    })
  })

  const effectivePlanTargets = {}

Object.entries(planSitOutTargets || {}).forEach(([playerId, value]) => {
  const target = targetNumber(value)
  if (target === null) return
  effectivePlanTargets[pk(playerId)] = target
})

  let rollingPlanTotals = {}
  const next = {}

  ;(games || []).forEach((game) => {
    const gameId = pk(game.id)
    const sourceLineup = normalizedLineups?.[gameId]
    if (!sourceLineup) return

    if (lineupLockedByGame?.[gameId]) {
      next[gameId] = clone(sourceLineup)
      rollingPlanTotals = addTotals(
        rollingPlanTotals,
        computeTotals([sourceLineup], players),
        players
      )
      return
    }

    const optimized = buildOptimizedLineup({
      game,
      players,
      availablePlayerIds: sourceLineup.availablePlayerIds,
      sourceLineup,
      totalsBefore,
      planTotalsBefore: rollingPlanTotals,
      priorityMap,
      fitMap,
      planSitOutTargets: effectivePlanTargets,
      optimizerProfile,
      optimizerProfileRules,
    })

      next[gameId] = optimized

      rollingPlanTotals = addTotals(
      rollingPlanTotals,
      computeTotals([optimized], players),
      players
    )
  })

  if (Object.keys(effectivePlanTargets || {}).length) {
    enforcePlanSitOutTargets({
      lineupsByGame: next,
      games,
      players,
      fitMap,
      priorityMap,
      planSitOutTargets: effectivePlanTargets,
      lineupLockedByGame,
      optimizerProfile,
      optimizerProfileRules,
    })
  }

  reconcileExactTargets({
    lineupsByGame: next,
    games,
    players,
    fitMap,
    priorityMap,
    planSitOutTargets: effectivePlanTargets,
    lineupLockedByGame,
    optimizerProfile,
    optimizerProfileRules,
  })

  improveSitSpacing({
    lineupsByGame: next,
    games,
    players,
    fitMap,
    priorityMap,
    planSitOutTargets: effectivePlanTargets,
    lineupLockedByGame,
    optimizerProfile,
    optimizerProfileRules,
  })

  reconcileExactTargets({
    lineupsByGame: next,
    games,
    players,
    fitMap,
    priorityMap,
    planSitOutTargets: effectivePlanTargets,
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

    addOptimizerWarnings({
      lineup,
      players,
      planSitOutTargets: effectivePlanTargets,
      planCounts: countPlanOuts(next, games, players),
      fitMap,
      optimizerProfileRules,
    })
  })

  return next
}

export function rebalanceTowardPriorityTargets({
  lineup,
  players,
  fitMap,
  priorityMap,
  totalsBefore = {},
  optimizerProfileRules = {},
}) {
  const planCounts = {}

  idsOf(players).forEach((id) => {
    planCounts[id] = Number(totalsBefore?.[id]?.Out || 0) + countLockedPlayerOuts(lineup, id)
  })

  rebuildUnlockedLineup({
    lineup,
    players,
    fitMap,
    priorityMap,
    planSitOutTargets: {},
    planCounts,
    optimizerProfile: null,
    optimizerProfileRules,
  })

  lineup.validationIssues = validateLineup({
    lineup,
    players,
    fitMap,
    optimizerProfileRules,
  })

  addOptimizerWarnings({
    lineup,
    players,
    planSitOutTargets: {},
    planCounts,
    fitMap,
    optimizerProfileRules,
  })

  return lineup
}
