import {
  FIELD_POSITIONS,
  pk,
  normalizeLineup,
  fitTier,
  priorityValue,
  computeTotals,
} from './lineupUtils'

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function lockedValue(lineup, playerId, inning) {
  return (
    lineup?.lockedRows?.[playerId] === true ||
    lineup?.lockedCells?.[playerId]?.[inning] === true ||
    lineup?.lockedInnings?.[inning] === true
  )
}

function normalizeFit(fit) {
  const value = String(fit || '').trim().toLowerCase()

  if (value === 'a' || value === 'primary') return 'primary'

  if (
    value === 'b' ||
    value === 'c' ||
    value === 'nc' ||
    value === 'secondary' ||
    value === 'non-primary' ||
    value === 'non primary' ||
    value === 'non_primary' ||
    value === 'nonprimary'
  ) {
    return 'secondary'
  }

  if (value === 'd' || value === 'development') return 'development'
  if (value === 'e' || value === 'no' || value === 'not allowed') return 'no'

  return 'secondary'
}

function getPositionRule(profileRules, position) {
  return profileRules?.[position] || null
}

function getRuleBool(rule, keys, fallback) {
  for (const key of keys) {
    if (rule?.[key] !== undefined && rule?.[key] !== null) {
      return rule[key] === true
    }
  }

  return fallback
}

function fitAllowedByRule(rule, fit) {
  const normalized = normalizeFit(fit)

  if (normalized === 'primary') {
    return getRuleBool(rule, ['allow_primary'], true)
  }

  if (normalized === 'secondary') {
    return getRuleBool(rule, ['allow_secondary', 'allow_non_primary'], true)
  }

  if (normalized === 'development') {
    return getRuleBool(rule, ['allow_development', 'allow_c_d'], true)
  }

  if (normalized === 'no') {
    return getRuleBool(rule, ['allow_disallowed', 'allow_not_allowed', 'allow_no'], false)
  }

  return true
}

function isFieldPosition(value) {
  return FIELD_POSITIONS.includes(value)
}

function eligibleIdsForInning(lineup, players, inning) {
  const available = new Set((lineup?.availablePlayerIds || []).map(pk))

  return (players || [])
    .map((player) => pk(player.id))
    .filter((id) => available.has(id))
    .filter((id) => (lineup?.cells?.[id]?.[inning] || '') !== 'Injury')
}

function allowedAt({ playerId, position, fitMap, optimizerProfileRules }) {
  const rule = getPositionRule(optimizerProfileRules, position)
  const fit = normalizeFit(fitTier(fitMap, playerId, position))
  return fitAllowedByRule(rule, fit)
}

function getLockedInfo(lineup, players, inning) {
  const lockedField = new Set()
  const lockedOut = new Set()
  const lockedPositions = new Set()

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    if (!lockedValue(lineup, id, inning)) return

    const value = lineup?.cells?.[id]?.[inning] || ''

    if (value === 'Out') {
      lockedOut.add(id)
      return
    }

    if (isFieldPosition(value)) {
      lockedField.add(id)
      lockedPositions.add(value)
    }
  })

  return {
    lockedField,
    lockedOut,
    lockedPositions,
  }
}

function canCoverAllPositions({
  lineup,
  players,
  inning,
  sitIds,
  fitMap,
  optimizerProfileRules,
}) {
  const eligible = eligibleIdsForInning(lineup, players, inning)
  const lockedInfo = getLockedInfo(lineup, players, inning)

  const fieldCandidates = eligible.filter((id) => {
    if (sitIds.has(id)) return false
    if (lockedInfo.lockedOut.has(id)) return false
    return true
  })

  if (fieldCandidates.length < 9) return false

  const openPositions = FIELD_POSITIONS.filter(
    (pos) => !lockedInfo.lockedPositions.has(pos)
  )

  const used = new Set([...lockedInfo.lockedField])
  const orderedPositions = [...openPositions].sort((a, b) => {
    const aCount = fieldCandidates.filter(
      (id) => !used.has(id) && allowedAt({ playerId: id, position: a, fitMap, optimizerProfileRules })
    ).length

    const bCount = fieldCandidates.filter(
      (id) => !used.has(id) && allowedAt({ playerId: id, position: b, fitMap, optimizerProfileRules })
    ).length

    return aCount - bCount
  })

  function search(index) {
    if (index >= orderedPositions.length) return true

    const position = orderedPositions[index]

    const candidates = fieldCandidates.filter((id) => {
      if (used.has(id)) return false
      return allowedAt({ playerId: id, position, fitMap, optimizerProfileRules })
    })

    for (const id of candidates) {
      used.add(id)
      if (search(index + 1)) return true
      used.delete(id)
    }

    return false
  }

  return search(0)
}

function previousOutGap(lineup, playerId, inning) {
  for (let i = inning - 1; i >= 1; i -= 1) {
    if ((lineup?.cells?.[playerId]?.[i] || '') === 'Out') return inning - i
  }

  return 999
}

function buildSitOutPlan({
  lineup,
  players,
  fitMap,
  optimizerProfile,
  optimizerProfileRules,
  planSitOutTargets,
  batchCurrentOuts,
}) {
  const innings = Number(lineup?.innings || 0)
  const outCounts = {}

  ;(players || []).forEach((player) => {
    outCounts[pk(player.id)] = Number(batchCurrentOuts?.[pk(player.id)] || 0)
  })

  for (let inning = 1; inning <= innings; inning += 1) {
    const eligible = eligibleIdsForInning(lineup, players, inning)
    const requiredOuts = Math.max(0, eligible.length - 9)
    const lockedInfo = getLockedInfo(lineup, players, inning)

    lockedInfo.lockedOut.forEach((id) => {
      outCounts[id] = Number(outCounts[id] || 0) + 1
    })

    const needed = Math.max(0, requiredOuts - lockedInfo.lockedOut.size)
    if (needed <= 0) continue

    const chosen = new Set()

    for (let pick = 0; pick < needed; pick += 1) {
      const candidates = eligible
        .filter((id) => !lockedInfo.lockedField.has(id))
        .filter((id) => !lockedInfo.lockedOut.has(id))
        .filter((id) => !chosen.has(id))
        .map((id) => {
          const targetRaw = planSitOutTargets?.[id]
          const hasTarget = targetRaw !== '' && targetRaw !== null && targetRaw !== undefined
          const target = hasTarget ? Number(targetRaw) : null
          const currentOuts = Number(outCounts[id] || 0)
          const gap = previousOutGap(lineup, id, inning)

          return {
            id,
            target,
            currentOuts,
            targetNeed: target === null ? 0 : target - currentOuts,
            spacingBad: gap <= Number(optimizerProfile?.min_innings_between_sitouts ?? 2),
            name: (players || []).find((p) => pk(p.id) === id)?.name || '',
          }
        })
        .sort((a, b) => {
          if (a.targetNeed !== b.targetNeed) return b.targetNeed - a.targetNeed
          if (a.currentOuts !== b.currentOuts) return a.currentOuts - b.currentOuts
          if (a.spacingBad !== b.spacingBad) return a.spacingBad ? 1 : -1
          return a.name.localeCompare(b.name)
        })

      const selected = candidates.find((candidate) => {
        const testSitIds = new Set([...lockedInfo.lockedOut, ...chosen, candidate.id])

        return canCoverAllPositions({
          lineup,
          players,
          inning,
          sitIds: testSitIds,
          fitMap,
          optimizerProfileRules,
        })
      })

      if (!selected) break

      chosen.add(selected.id)
      outCounts[selected.id] = Number(outCounts[selected.id] || 0) + 1
    }

    chosen.forEach((id) => {
      if (!lockedValue(lineup, id, inning)) {
        lineup.cells[id][inning] = 'Out'
      }
    })
  }

  return lineup
}

function playerPositionCount(planPositionCounts, playerId, position) {
  const bucket = ['LF', 'CF', 'RF'].includes(position) ? 'OF' : position
  return Number(planPositionCounts?.[playerId]?.[bucket] || 0)
}

function incrementPositionCount(planPositionCounts, playerId, position) {
  const id = pk(playerId)
  const bucket = ['LF', 'CF', 'RF'].includes(position) ? 'OF' : position

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

function playerPositionVariety(planPositionCounts, playerId) {
  return Object.values(planPositionCounts?.[playerId] || {}).filter((n) => Number(n || 0) > 0)
    .length
}

function assignmentScore({
  playerId,
  position,
  fitMap,
  priorityMap,
  optimizerProfile,
  optimizerProfileRules,
  planPositionCounts,
}) {
  const fit = normalizeFit(fitTier(fitMap, playerId, position))
  const priority = Number(priorityValue(priorityMap, playerId, position) || 0)

  let score = 0

  if (fit === 'primary') score += 100000
  else if (fit === 'secondary') score += 50000
  else if (fit === 'development') score += 10000
  else score -= 1000000

  score += priority * 1000

  const minPositions = Number(optimizerProfile?.min_positions_per_player || 1)
  const varietyMode = optimizerProfile?.min_positions_mode || 'nice'
  const currentVariety = playerPositionVariety(planPositionCounts, playerId)
  const alreadyHere = playerPositionCount(planPositionCounts, playerId, position) > 0

  if (varietyMode !== 'off' && minPositions > 1 && currentVariety < minPositions) {
    if (alreadyHere) score -= varietyMode === 'must' ? 30000 : 10000
    else score += varietyMode === 'must' ? 50000 : 15000
  }

  const usedHere = playerPositionCount(planPositionCounts, playerId, position)
  score -= usedHere * 5000

  return score
}

function assignFieldForInning({
  lineup,
  players,
  inning,
  fitMap,
  priorityMap,
  optimizerProfile,
  optimizerProfileRules,
  planPositionCounts,
}) {
  const eligible = eligibleIdsForInning(lineup, players, inning)
  const lockedInfo = getLockedInfo(lineup, players, inning)

  const openPositions = FIELD_POSITIONS.filter(
    (position) => !lockedInfo.lockedPositions.has(position)
  )

  const candidateIds = eligible.filter((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''

    if (value === 'Out') return false
    if (value === 'Injury') return false
    if (lockedInfo.lockedField.has(id)) return false
    if (lockedInfo.lockedOut.has(id)) return false

    return true
  })

  const candidatesByPosition = {}

  openPositions.forEach((position) => {
    candidatesByPosition[position] = candidateIds
      .filter((id) => allowedAt({ playerId: id, position, fitMap, optimizerProfileRules }))
      .map((id) => ({
        id,
        position,
        score: assignmentScore({
          playerId: id,
          position,
          fitMap,
          priorityMap,
          optimizerProfile,
          optimizerProfileRules,
          planPositionCounts,
        }),
      }))
      .sort((a, b) => b.score - a.score)
  })

  const orderedPositions = [...openPositions].sort((a, b) => {
    return candidatesByPosition[a].length - candidatesByPosition[b].length
  })

  let bestScore = -Infinity
  let best = null

  function search(index, used, assignment, score) {
    if (index >= orderedPositions.length) {
      if (score > bestScore) {
        bestScore = score
        best = { ...assignment }
      }

      return
    }

    const position = orderedPositions[index]
    const candidates = candidatesByPosition[position] || []

    for (const candidate of candidates) {
      if (used.has(candidate.id)) continue

      used.add(candidate.id)
      assignment[candidate.id] = position

      search(index + 1, used, assignment, score + candidate.score)

      delete assignment[candidate.id]
      used.delete(candidate.id)
    }
  }

  search(0, new Set(), {}, 0)

  if (!best) return lineup

  Object.entries(best).forEach(([playerId, position]) => {
    if (!lockedValue(lineup, playerId, inning)) {
      lineup.cells[playerId][inning] = position
    }
  })

  eligible.forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (isFieldPosition(value)) {
      incrementPositionCount(planPositionCounts, id, value)
    }
  })

  return lineup
}

export function buildOptimizedLineupV2({
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

  for (const player of players || []) {
    const id = pk(player.id)

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      if (lockedValue(lineup, id, inning)) continue

      const current = lineup?.cells?.[id]?.[inning] || ''
      if (current !== 'Injury') {
        lineup.cells[id][inning] = ''
      }
    }
  }

  buildSitOutPlan({
    lineup,
    players,
    fitMap,
    optimizerProfile,
    optimizerProfileRules,
    planSitOutTargets,
    batchCurrentOuts,
  })

  const planPositionCounts = {}

  ;(players || []).forEach((player) => {
    planPositionCounts[pk(player.id)] = {
      P: 0,
      C: 0,
      '1B': 0,
      '2B': 0,
      '3B': 0,
      SS: 0,
      OF: 0,
    }
  })

  for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
    assignFieldForInning({
      lineup,
      players,
      inning,
      fitMap,
      priorityMap,
      optimizerProfile,
      optimizerProfileRules,
      planPositionCounts,
    })
  }

  lineup.validationIssues = []

  const totals = computeTotals([lineup], players)
  lineup.optimizerDebug = {
    totals,
  }

  return lineup
}
