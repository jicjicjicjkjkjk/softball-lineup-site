// src/lib/lineupUtils.js

export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GRID_OPTIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out', 'Injury']
export const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']
export const ALLOWED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GAME_TYPES = ['Friendly', 'Tournament Pool', 'Tournament Bracket', 'Doubleheader', 'Round Robin']
export const SEASON_BUCKETS = ['In Season', 'Out of Season']
export const PRACTICE_TYPES = ['Pitchers/Catchers', 'Team Practice', 'Indoor Work', 'Outdoor Practice']
export const SETTING_TYPES = ['Indoor', 'Outdoor']

function getPositionRule(profileRules, position) {
  return profileRules?.[position] || null
}

function getRuleNumber(rule, keys, fallback) {
  for (const key of keys) {
    if (rule?.[key] !== undefined && rule?.[key] !== null && rule?.[key] !== '') {
      const n = Number(rule[key])
      return Number.isNaN(n) ? fallback : n
    }
  }
  return fallback
}

function getRuleBool(rule, keys, fallback) {
  for (const key of keys) {
    if (rule?.[key] !== undefined && rule?.[key] !== null) {
      return rule[key] === true
    }
  }
  return fallback
}

function positionImportance(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return getRuleNumber(rule, ['importance', 'importance_score', 'hierarchy', 'fill_importance'], 1)
}

function positionFillRank(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return getRuleNumber(rule, ['fill_rank', 'fill_order', 'rank'], 99)
}

function consecutiveMode(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return rule?.consecutive_mode || 'prefer'
}

function normalizeFit(fit) {
  const value = String(fit || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFF0D]/g, '-')
    .replace(/\s+/g, ' ')

  if (value === 'a' || value === 'primary') return 'primary'
  if (
  value === 'b' ||
  value === 'c' ||
  value === 'nc' ||
  value === 'secondary' ||
  value === 'non-primary' ||
  value === 'non primary' ||
  value === 'non_primary' ||
  value === 'nonprimary' ||
  value.includes('non') && value.includes('primary')
) {
  return 'secondary'
}
  if (value === 'd' || value === 'development') return 'development'
  if (value === 'e' || value === 'no' || value === 'not allowed') return 'no'

  return 'secondary'
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

export function pk(id) {
  return String(id)
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}


export function blankLineup(playerIds, innings = 6, availablePlayerIds = playerIds) {
  const cells = {}
  const battingOrder = {}
  const lockedBattingOrder = {}
  const lockedCells = {}
  const lockedRows = {}
  const lockedInnings = {}

  ;(playerIds || []).forEach((id) => {
    const key = pk(id)
    cells[key] = {}
    battingOrder[key] = ''
    lockedBattingOrder[key] = false
    lockedCells[key] = {}
    lockedRows[key] = false

    for (let inning = 1; inning <= Number(innings || 6); inning += 1) {
      cells[key][inning] = ''
      lockedCells[key][inning] = false
      lockedInnings[inning] = false
    }
  })

  return {
    innings: Number(innings || 6),
    availablePlayerIds: (availablePlayerIds || playerIds || []).map(pk),
    battingOrder,
    cells,
    lockedCells,
    lockedRows,
    lockedBattingOrder,
    lockedInnings,
  }
}

export function normalizeLineup(lineup, playersOrIds, inningsFallback = 6, availableFallback = []) {
  const playerIds = (playersOrIds || []).map((item) =>
    typeof item === 'object' && item !== null ? item.id : item
  )

  const out = lineup
    ? clone(lineup)
    : blankLineup(
        playerIds,
        Number(inningsFallback || 6),
        (availableFallback || []).length ? availableFallback : playerIds
      )

  out.innings = Number(out.innings || inningsFallback || 6)
  out.availablePlayerIds = (out.availablePlayerIds || availableFallback || playerIds).map(pk)
  out.cells = out.cells || {}
  out.battingOrder = out.battingOrder || {}
  out.lockedCells = out.lockedCells || {}
  out.lockedRows = out.lockedRows || {}
  out.lockedBattingOrder = out.lockedBattingOrder || {}
  out.lockedInnings = out.lockedInnings || {}

  playerIds.forEach((id) => {
    const key = pk(id)
    if (!out.cells[key]) out.cells[key] = {}
    if (!out.lockedCells[key]) out.lockedCells[key] = {}
    if (out.battingOrder[key] === undefined) out.battingOrder[key] = ''
    if (out.lockedBattingOrder[key] === undefined) out.lockedBattingOrder[key] = false
      if (out.lockedRows[key] === undefined) out.lockedRows[key] = false

    for (let inning = 1; inning <= out.innings; inning += 1) {
      if (out.cells[key][inning] === undefined) out.cells[key][inning] = ''
      if (out.lockedCells[key][inning] === undefined) out.lockedCells[key][inning] = false
      if (out.lockedInnings[inning] === undefined) out.lockedInnings[inning] = false
    }
  })

  return out
}

export function setAllBattingLocks(lineup, value) {
  const next = clone(lineup)
  Object.keys(next.battingOrder || {}).forEach((id) => {
    next.lockedBattingOrder[id] = value
  })
  return next
}

export function rowSummary(lineup, playerId) {
  const result = { IF: 0, OF: 0, P: 0, C: 0, X: 0 }
  const row = lineup?.cells?.[pk(playerId)] || {}

  Object.values(row).forEach((value) => {
    if (['1B', '2B', '3B', 'SS'].includes(value)) result.IF += 1
    if (['LF', 'CF', 'RF'].includes(value)) result.OF += 1
    if (value === 'P') result.P += 1
    if (value === 'C') result.C += 1
    if (value === 'Out') result.X += 1
  })

  return result
}

export function requiredOutsForGame(playerCount, innings) {
  return Math.max(0, Number(playerCount || 0) - 9) * Number(innings || 0)
}

export function fitTier(fitMap, playerId, position) {
  const id = pk(playerId)

  if (position === 'LF' || position === 'RF') {
    return fitMap?.[id]?.[position] || fitMap?.[id]?.OF || 'no'
  }

  if (position === 'CF') {
    return fitMap?.[id]?.CF || fitMap?.[id]?.OF || 'no'
  }

  return fitMap?.[id]?.[position] || 'no'
}

export function priorityValue(priorityMap, playerId, position) {
  const id = pk(playerId)

  if (position === 'LF' || position === 'CF' || position === 'RF') {
    return Number(priorityMap?.[id]?.OF?.priority_pct || 0)
  }

  return Number(priorityMap?.[id]?.[position]?.priority_pct || 0)
}

function priorityTargetInnings(priorityMap, playerId, position, projectedFieldTotal) {
  const targetPct = Number(priorityValue(priorityMap, playerId, position) || 0)
  if (targetPct <= 0) return 0

  return Math.round((Number(projectedFieldTotal || 0) * targetPct) / 100)
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

export function positionCountsForInning(lineup, inning, availableIds) {
  const counts = {}
  FIELD_POSITIONS.forEach((pos) => {
    counts[pos] = []
  })

  ;(availableIds || []).map(pk).forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (FIELD_POSITIONS.includes(value)) counts[value].push(id)
  })

  return counts
}

export function inningStatus(lineup, inning, players, fitMap, optimizerProfileRules = {}) {
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)
  const counts = positionCountsForInning(lineup, inning, availableIds)

  const missing = FIELD_POSITIONS.filter((pos) => counts[pos].length === 0)
  const duplicate = FIELD_POSITIONS.filter((pos) => counts[pos].length > 1)

  const badFits = []
  availableIds.forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (!FIELD_POSITIONS.includes(value)) return

    const rule = getPositionRule(optimizerProfileRules, value)
const tier = normalizeFit(fitTier(fitMap, id, value))

if (!fitAllowedByRule(rule, tier)) {
  const player = (players || []).find((p) => pk(p.id) === id)
  badFits.push(`${player?.name || id} @ ${value}`)
}
  })

  return { missing, duplicate, badFits }
}

export function validateLineup({ lineup, players, fitMap, optimizerProfileRules = {} }) {
  const issues = []
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)
  const innings = Number(lineup?.innings || 0)

  for (let inning = 1; inning <= innings; inning += 1) {
    const positionCounts = {}
    FIELD_POSITIONS.forEach((pos) => {
      positionCounts[pos] = []
    })

    let outCount = 0

    availableIds.forEach((id) => {
      const value = lineup?.cells?.[id]?.[inning] || ''
      const player = (players || []).find((p) => pk(p.id) === id)
      const playerName = player?.name || id

      if (value === 'Out') {
        outCount += 1
        return
      }

      if (!FIELD_POSITIONS.includes(value)) return

      positionCounts[value].push(playerName)

            const rule = getPositionRule(optimizerProfileRules, value)
      const fit = normalizeFit(fitTier(fitMap, id, value))

      if (!fitAllowedByRule(rule, fit)) {
        issues.push({
          inning,
          type: 'bad_fit',
          message: `Inning ${inning}: ${playerName} is not allowed at ${value}.`,
        })
      }
    })

    FIELD_POSITIONS.forEach((position) => {
      const playersAtPosition = positionCounts[position] || []

      if (playersAtPosition.length === 0) {
        issues.push({
          inning,
          type: 'missing_position',
          message: `Inning ${inning}: missing ${position}.`,
        })
      }

      if (playersAtPosition.length > 1) {
        issues.push({
          inning,
          type: 'duplicate_position',
          message: `Inning ${inning}: duplicate ${position} (${playersAtPosition.join(', ')}).`,
        })
      }
    })

    const eligibleCount = availableIds.filter(
      (id) => (lineup?.cells?.[id]?.[inning] || '') !== 'Injury'
    ).length

    const expectedOuts = Math.max(0, eligibleCount - 9)

    if (outCount !== expectedOuts) {
      issues.push({
        inning,
        type: 'wrong_out_count',
        message: `Inning ${inning}: expected ${expectedOuts} sit-out${expectedOuts === 1 ? '' : 's'}, found ${outCount}.`,
      })
    }
  }

  return issues
}

export function computeTotals(lineups, players) {
  const totals = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    totals[id] = {
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
      battingOrderTotal: 0,
      battingOrderGames: 0,
    }
  })

  ;(lineups || []).forEach((lineup) => {
    if (!lineup) return

    const availableIds = (lineup.availablePlayerIds || []).map(pk)
    const countedGameForPlayer = new Set()

    availableIds.forEach((id) => {
      const bo = Number(lineup?.battingOrder?.[id] || 0)
      if (bo > 0 && totals[id]) {
        totals[id].battingOrderTotal += bo
        totals[id].battingOrderGames += 1
      }
    })

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      const eligibleIds = availableIds.filter((id) => {
        const value = lineup.cells?.[id]?.[inning] || ''
        return value !== 'Injury'
      })

      const requiredSits = Math.max(0, eligibleIds.length - 9)
      const expectedPerAvailablePlayer = availableIds.length
        ? requiredSits / availableIds.length
        : 0

      availableIds.forEach((id) => {
        const row = totals[id]
        if (!row) return

        if (!countedGameForPlayer.has(id)) {
          row.games += 1
          countedGameForPlayer.add(id)
        }

        const value = lineup.cells?.[id]?.[inning] || ''
        row.expectedOuts += expectedPerAvailablePlayer

        if (value === 'Injury') {
          row.Injury += 1
          return
        }

        if (value === 'Out') {
          row.Out += 1
          row.actualOuts += 1
        }

        if (FIELD_POSITIONS.includes(value)) {
          row[value] += 1
          row.fieldTotal += 1
        }

        if (['1B', '2B', '3B', 'SS'].includes(value)) row.IF += 1
        if (['LF', 'CF', 'RF'].includes(value)) row.OF += 1
      })
    }
  })

  Object.values(totals).forEach((row) => {
    row.expectedOuts = Number(row.expectedOuts.toFixed(2))
    row.delta = Number((row.actualOuts - row.expectedOuts).toFixed(2))
    row.avgBattingOrder = row.battingOrderGames
      ? Number((row.battingOrderTotal / row.battingOrderGames).toFixed(2))
      : null
  })

  return totals
}

export function addTotals(a, b, players) {
  const out = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    out[id] = {
      playerId: id,
      name: player.name,
      jersey_number: player.jersey_number || '',
      games: Number(a?.[id]?.games || 0) + Number(b?.[id]?.games || 0),
      P: Number(a?.[id]?.P || 0) + Number(b?.[id]?.P || 0),
      C: Number(a?.[id]?.C || 0) + Number(b?.[id]?.C || 0),
      '1B': Number(a?.[id]?.['1B'] || 0) + Number(b?.[id]?.['1B'] || 0),
      '2B': Number(a?.[id]?.['2B'] || 0) + Number(b?.[id]?.['2B'] || 0),
      '3B': Number(a?.[id]?.['3B'] || 0) + Number(b?.[id]?.['3B'] || 0),
      SS: Number(a?.[id]?.SS || 0) + Number(b?.[id]?.SS || 0),
      LF: Number(a?.[id]?.LF || 0) + Number(b?.[id]?.LF || 0),
      CF: Number(a?.[id]?.CF || 0) + Number(b?.[id]?.CF || 0),
      RF: Number(a?.[id]?.RF || 0) + Number(b?.[id]?.RF || 0),
      IF: Number(a?.[id]?.IF || 0) + Number(b?.[id]?.IF || 0),
      OF: Number(a?.[id]?.OF || 0) + Number(b?.[id]?.OF || 0),
      Out: Number(a?.[id]?.Out || 0) + Number(b?.[id]?.Out || 0),
      Injury: Number(a?.[id]?.Injury || 0) + Number(b?.[id]?.Injury || 0),
      fieldTotal: Number(a?.[id]?.fieldTotal || 0) + Number(b?.[id]?.fieldTotal || 0),
      expectedOuts: Number(
        (Number(a?.[id]?.expectedOuts || 0) + Number(b?.[id]?.expectedOuts || 0)).toFixed(2)
      ),
      actualOuts: Number(a?.[id]?.actualOuts || 0) + Number(b?.[id]?.actualOuts || 0),
      delta: 0,
      battingOrderTotal:
        Number(a?.[id]?.battingOrderTotal || 0) + Number(b?.[id]?.battingOrderTotal || 0),
      battingOrderGames:
        Number(a?.[id]?.battingOrderGames || 0) + Number(b?.[id]?.battingOrderGames || 0),
      avgBattingOrder: null,
    }

    out[id].delta = Number((out[id].actualOuts - out[id].expectedOuts).toFixed(2))
    out[id].avgBattingOrder = out[id].battingOrderGames
      ? Number((out[id].battingOrderTotal / out[id].battingOrderGames).toFixed(2))
      : null
  })

  return out
}

function lockedValue(lineup, playerId, inning) {
  const rowLocked = lineup?.lockedRows?.[playerId] === true
  const cellLocked = lineup?.lockedCells?.[playerId]?.[inning] === true
  const inningLocked = lineup?.lockedInnings?.[inning] === true
  return rowLocked || cellLocked || inningLocked
}

function isDisallowedFit(fit) {
  return normalizeFit(fit) === 'no'
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

function getCurrentAssignedOutsForPlayer(lineups, playerId) {
  return (lineups || []).reduce((sum, lineup) => sum + countPlayerOuts(lineup, playerId), 0)
}

function countPlayerOuts(lineup, playerId) {
  const innings = Number(lineup?.innings || 0)
  let total = 0

  for (let inning = 1; inning <= innings; inning += 1) {
    if (lineup?.cells?.[playerId]?.[inning] === 'Out') total += 1
  }

  return total
}

function getPlanOutCounts(existingPlanLineups, players) {
  const outCounts = {}
  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    outCounts[id] = getCurrentAssignedOutsForPlayer(existingPlanLineups, id)
  })
  return outCounts
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
  for (let prev = inning - 1; prev >= 1; prev -= 1) {
    if ((lineup?.cells?.[playerId]?.[prev] || '') === 'Out') return inning - prev
  }
  return 999
}

function nextLockedOutDistance(lineup, playerId, inning, innings) {
  for (let next = inning + 1; next <= innings; next += 1) {
    if (
      lockedValue(lineup, playerId, next) &&
      (lineup?.cells?.[playerId]?.[next] || '') === 'Out'
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

export function clearUnlockedLineupCells(lineup, players) {
  const next = clone(lineup)

  ;(players || []).forEach((player) => {
    const id = pk(player.id)

    for (let inning = 1; inning <= Number(next.innings || 0); inning += 1) {
      if (lockedValue(next, id, inning)) continue

      const current = next?.cells?.[id]?.[inning] || ''
      if (current !== 'Injury') {
        next.cells[id][inning] = ''
      }
    }
  })

  return next
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

function getPriorityTarget(priorityMap, playerId, position) {
  return priorityValue(priorityMap, playerId, position)
}

function getPositionActualCount(totals, playerId, position) {
  if (position === 'LF' || position === 'CF' || position === 'RF') {
    return Number(totals?.[playerId]?.OF || 0)
  }
  return Number(totals?.[playerId]?.[position] || 0)
}

function getFieldTotal(totals, playerId) {
  return Math.max(Number(totals?.[playerId]?.fieldTotal || 0), 1)
}

function positionBucket(position) {
  return ['LF', 'CF', 'RF'].includes(position) ? 'OF' : position
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

function totalPlanPositionCount(planPositionCounts, position) {
  const bucket = positionBucket(position)

  return Object.values(planPositionCounts || {}).reduce(
    (sum, row) => sum + Number(row?.[bucket] || 0),
    0
  )
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
    !criticalPlayers.has(id) // 🚨 DO NOT SIT THESE
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
  candidateIds,
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
const targetPct = Number(getPriorityTarget(priorityMap, id, position) || 0)

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
const currentTargetNeed = targetInnings - currentPositionInnings  
  
  let fitScore = 0
if (fit === 'primary') fitScore = 2500 * importance
else if (fit === 'secondary') fitScore = 900 * importance
else if (fit === 'development') fitScore = 300 * importance
else fitScore = 50 * importance

  let priorityScore = 0

if (targetPct > 0) {
  priorityScore += currentTargetNeed * 90000

  if (currentTargetNeed > 0) {
    priorityScore += 60000
  }

  if (overTargetInnings > 0) {
    priorityScore -= overTargetInnings * 160000
  }

  const projectedPositionCount = currentPositionInnings + 1
  const safeTargetFieldTotal = Math.max(targetFieldTotal, 1)
  const projectedPct = (projectedPositionCount / safeTargetFieldTotal) * 100
  const afterDistance = Math.abs(projectedPct - targetPct)

  priorityScore -= afterDistance * 1500
} else {
  priorityScore -= 200000
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
    rotationScore += 1000
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
  candidateIds,
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

function getPlayerFieldPositionsInGame(lineup, playerId, uptoInning = null) {
  const id = pk(playerId)
  const innings = Number(uptoInning || lineup?.innings || 0)
  const positions = new Set()

  for (let inning = 1; inning <= innings; inning += 1) {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (FIELD_POSITIONS.includes(value)) positions.add(value)
  }

  return positions
}

function isRowFullyLockedForGame(lineup, playerId) {
  const id = pk(playerId)
  const innings = Number(lineup?.innings || 0)

  if (lineup?.lockedRows?.[id] === true) return true

  for (let inning = 1; inning <= innings; inning += 1) {
    if (lineup?.lockedCells?.[id]?.[inning] !== true) return false
  }

  return innings > 0
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

if (!fitAllowedByRule(aRuleForBPos, aFitForBPos)) return false
if (!fitAllowedByRule(bRuleForAPos, bFitForAPos)) return false

    return true
  }

  ;(players || []).forEach((player) => {
    const playerId = pk(player.id)

    if (!availableIds.has(playerId)) return
    if (isRowFullyLockedForGame(lineup, playerId)) return

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

function enforcePositionVarietyHard({
  lineup,
  players,
  fitMap,
  priorityMap,
  optimizerProfile,
  optimizerProfileRules = {},
}) {
  const innings = Number(lineup?.innings || 0)
  const minPositions = Number(optimizerProfile?.min_positions_per_player || 1)
  const mode = optimizerProfile?.min_positions_mode || 'nice'

  if (!innings || mode === 'off' || minPositions <= 1) return lineup

  const availableIds = new Set((lineup?.availablePlayerIds || []).map(pk))

  function allowedAt(playerId, position) {
    const rule = getPositionRule(optimizerProfileRules, position)
    const fit = normalizeFit(fitTier(fitMap, playerId, position))
    return fitAllowedByRule(rule, fit)
  }

  function getFieldInnings(playerId) {
    const out = []

    for (let inning = 1; inning <= innings; inning += 1) {
      const value = lineup?.cells?.[playerId]?.[inning] || ''

      if (FIELD_POSITIONS.includes(value)) {
        out.push({ inning, position: value })
      }
    }

    return out
  }

  function getPositionCounts(playerId) {
    const counts = {}

    getFieldInnings(playerId).forEach(({ position }) => {
      counts[position] = Number(counts[position] || 0) + 1
    })

    return counts
  }

  function getQualifiedPositions(playerId) {
    return Object.keys(getPositionCounts(playerId))
  }

  function findPlayerAtPosition(inning, position) {
    return (players || [])
      .map((player) => pk(player.id))
      .find((id) => lineup?.cells?.[id]?.[inning] === position)
  }

  function canSwap(playerA, playerB, inning) {
    const aPos = lineup?.cells?.[playerA]?.[inning] || ''
    const bPos = lineup?.cells?.[playerB]?.[inning] || ''

    if (!FIELD_POSITIONS.includes(aPos) || !FIELD_POSITIONS.includes(bPos)) return false
    if (lockedValue(lineup, playerA, inning)) return false
    if (lockedValue(lineup, playerB, inning)) return false

    return allowedAt(playerA, bPos) && allowedAt(playerB, aPos)
  }

  let changed = true
  let guard = 0

  while (changed && guard < 40) {
    changed = false
    guard += 1

    for (const player of players || []) {
      const playerId = pk(player.id)
      if (!availableIds.has(playerId)) continue
      if (isRowFullyLockedForGame(lineup, playerId)) continue

      const qualified = getQualifiedPositions(playerId)
      if (qualified.length >= minPositions) continue

      const counts = getPositionCounts(playerId)

      const fieldInnings = getFieldInnings(playerId)
        .filter(({ inning }) => !lockedValue(lineup, playerId, inning))
        .sort((a, b) => {
          return (
            Number(counts[b.position] || 0) - Number(counts[a.position] || 0) ||
            a.inning - b.inning
          )
        })

      for (const { inning, position: currentPos } of fieldInnings) {
        const alternatives = FIELD_POSITIONS
          .filter((pos) => pos !== currentPos)
          .filter((pos) => allowedAt(playerId, pos))
          .sort((a, b) => {
            const aAlready = counts[a] ? 1 : 0
            const bAlready = counts[b] ? 1 : 0
            if (aAlready !== bAlready) return aAlready - bAlready

            return priorityValue(priorityMap, playerId, b) - priorityValue(priorityMap, playerId, a)
          })

        for (const altPos of alternatives) {
          const otherId = findPlayerAtPosition(inning, altPos)
          if (!otherId || otherId === playerId) continue
          if (!canSwap(playerId, otherId, inning)) continue

          lineup.cells[playerId][inning] = altPos
          lineup.cells[otherId][inning] = currentPos

          changed = true
          break
        }

        if (changed) break
      }

      if (changed) break
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

    const aFitForBPos = normalizeFit(fitMap?.[pk(playerA)]?.[bPos] || 'no')
const bFitForAPos = normalizeFit(fitMap?.[pk(playerB)]?.[aPos] || 'no')

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

function repairMissingAndDuplicatePositions({
  lineup,
  players,
  fitMap,
  priorityMap,
  optimizerProfileRules = {},
}) {
  const innings = Number(lineup?.innings || 0)
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)

  function playerName(id) {
    return (players || []).find((p) => pk(p.id) === pk(id))?.name || id
  }

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
            isDuplicate,
            isDisallowed,
          })
        }
      })

      for (const missingPos of missingPositions) {
        const bestProblem = problemPlayers
          .filter((row) => !lockedValue(lineup, row.id, inning))
          .filter((row) => isValidAt(row.id, missingPos))
          .sort((a, b) => {
            return (
              fitScoreFor(b.id, missingPos) - fitScoreFor(a.id, missingPos) ||
              playerName(a.id).localeCompare(playerName(b.id))
            )
          })[0]

        if (!bestProblem) continue

        lineup.cells[bestProblem.id][inning] = missingPos
        changed = true

        const removeIndex = problemPlayers.findIndex((row) => row.id === bestProblem.id)
        if (removeIndex >= 0) problemPlayers.splice(removeIndex, 1)
      }

      // If someone is still in a disallowed position, try a clean swap.
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

function forceFillAllPositions({
  lineup,
  players,
  fitMap,
  priorityMap,
  optimizerProfileRules = {},
}) {
  const innings = Number(lineup?.innings || 0)

  function fitScore(id, position) {
    const rule = getPositionRule(optimizerProfileRules, position)
    const fit = normalizeFit(fitTier(fitMap, id, position))
    const importance = positionImportance(optimizerProfileRules, position)
    const priority = priorityValue(priorityMap, id, position)

    if (!fitAllowedByRule(rule, fit)) return -100000
    if (fit === 'primary') return 100000 + importance * 1000 + priority * 100
    if (fit === 'secondary') return 10000 + importance * 500 + priority * 50
    if (fit === 'development') return 1000 + importance * 100 + priority * 10
    return 1
  }

  for (let inning = 1; inning <= innings; inning += 1) {
    const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
    if (eligibleIds.length < 9) continue

    const expectedOuts = Math.max(0, eligibleIds.length - 9)

    const usedPlayers = new Set()
    const filledPositions = new Set()

    const plannedOuts = eligibleIds.filter(
      (id) => lineup.cells?.[id]?.[inning] === 'Out'
    )

    const keepOuts = new Set(plannedOuts.slice(0, expectedOuts))

    eligibleIds.forEach((id) => {
      const value = lineup?.cells?.[id]?.[inning] || ''

      if (lockedValue(lineup, id, inning) && FIELD_POSITIONS.includes(value)) {
        usedPlayers.add(id)
        filledPositions.add(value)
      }

      if (lockedValue(lineup, id, inning) && value === 'Out') {
        keepOuts.add(id)
      }
    })

    const openPositions = FIELD_POSITIONS.filter((pos) => !filledPositions.has(pos))

    eligibleIds.forEach((id) => {
      if (lockedValue(lineup, id, inning)) return
      if (keepOuts.has(id)) {
        lineup.cells[id][inning] = 'Out'
      } else {
        lineup.cells[id][inning] = ''
      }
    })

    const orderedPositions = [...openPositions].sort((a, b) => {
      return (
        positionFillRank(optimizerProfileRules, a) - positionFillRank(optimizerProfileRules, b) ||
        positionImportance(optimizerProfileRules, b) - positionImportance(optimizerProfileRules, a)
      )
    })

    orderedPositions.forEach((position) => {
      const best = eligibleIds
        .filter((id) => !usedPlayers.has(id))
        .filter((id) => !keepOuts.has(id))
        .filter((id) => !lockedValue(lineup, id, inning))
        .sort((a, b) => fitScore(b, position) - fitScore(a, position))[0]

      if (!best) return

      lineup.cells[best][inning] = position
      usedPlayers.add(best)
    })

    let currentOuts = eligibleIds.filter(
      (id) => lineup.cells?.[id]?.[inning] === 'Out'
    ).length

    eligibleIds.forEach((id) => {
      if (lockedValue(lineup, id, inning)) return
      if (FIELD_POSITIONS.includes(lineup.cells?.[id]?.[inning])) return
      if (lineup.cells?.[id]?.[inning] === 'Out') return

      if (currentOuts < expectedOuts) {
        lineup.cells[id][inning] = 'Out'
        currentOuts += 1
      }
    })
  }

  return lineup
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

// 🚨 SAFETY: ensure all positions still have at least 1 primary candidate
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
  // rollback sits for this inning
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

  enforcePositionVarietyHard({
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

lineup.validationIssues = validateLineup({
  lineup,
  players,
  fitMap,
  optimizerProfileRules,
})

return lineup
}

export function formatDateMMDDYY(dateStr) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}

export function playerGameTrackingRows(
  games,
  lineupsByGame,
  lineupLockedByGame,
  playerId,
  gameTypeFilter = 'All'
) {
  return (games || [])
    .filter((game) => {
      if (gameTypeFilter !== 'All' && game.game_type !== gameTypeFilter) return false
      return Boolean(lineupsByGame?.[pk(game.id)])
    })
    .sort((a, b) => {
      const aKey = `${a.date || ''}-${String(a.game_order || '').padStart(3, '0')}`
      const bKey = `${b.date || ''}-${String(b.game_order || '').padStart(3, '0')}`
      return aKey.localeCompare(bKey)
    })
    .map((game) => {
      const lineup = lineupsByGame?.[pk(game.id)]
      if (!lineup) return null

      const id = pk(playerId)
      const innings = Number(lineup.innings || 0)
      const positions = []
      let sitOuts = 0
      let expectedOuts = 0
      const available = (lineup.availablePlayerIds || []).map(pk)
      const inGame = available.includes(id)
      const battingOrder = Number(lineup?.battingOrder?.[id] || 0) || ''

      for (let inning = 1; inning <= innings; inning += 1) {
        const value = lineup?.cells?.[id]?.[inning] || ''
        positions.push(value || '')

        const eligible = available.filter(
          (pid) => (lineup?.cells?.[pid]?.[inning] || '') !== 'Injury'
        )
        const expected = available.length
          ? Math.max(0, eligible.length - 9) / available.length
          : 0

        if (inGame) expectedOuts += expected
        if (value === 'Out') sitOuts += 1
      }

      return {
        gameId: pk(game.id),
        date: game.date || '',
        opponent: game.opponent || '',
        type: game.game_type || '',
        order: game.game_order || '',
        status: lineupLockedByGame?.[pk(game.id)] ? 'Locked' : 'Saved',
        battingOrder,
        positions,
        sitOuts,
        expectedOuts: Number(expectedOuts.toFixed(2)),
        sitDelta: Number((sitOuts - expectedOuts).toFixed(2)),
      }
    })
    .filter(Boolean)
}
