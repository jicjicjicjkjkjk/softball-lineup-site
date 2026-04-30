// src/lib/lineupUtils.js

export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GRID_OPTIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out', 'Injury']
export const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']
export const ALLOWED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GAME_TYPES = ['Friendly', 'Tournament Pool', 'Tournament Bracket', 'Doubleheader', 'Round Robin']
export const SEASON_BUCKETS = ['In Season', 'Out of Season']
export const PRACTICE_TYPES = ['Pitchers/Catchers', 'Team Practice', 'Indoor Work', 'Outdoor Practice']
export const SETTING_TYPES = ['Indoor', 'Outdoor']

const DEFAULT_POSITION_IMPORTANCE = {
  P: 9,
  C: 8,
  SS: 7,
  '3B': 6,
  '1B': 5,
  CF: 4,
  '2B': 3,
  LF: 2,
  RF: 1,
}

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
  return getRuleNumber(rule, ['importance', 'importance_score', 'hierarchy', 'fill_importance'], DEFAULT_POSITION_IMPORTANCE[position] || 1)
}

function positionFillRank(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return getRuleNumber(rule, ['fill_rank', 'fill_order', 'rank'], 99)
}

function consecutiveMode(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return rule?.consecutive_mode || (['P', 'C'].includes(position) ? 'must_2' : 'prefer')
}

function normalizeFit(fit) {
  const value = String(fit || '').trim().toLowerCase()

  if (value === 'a' || value === 'primary') return 'primary'
  if (
    value === 'b' ||
    value === 'secondary' ||
    value === 'non-primary' ||
    value === 'nonprimary'
  ) {
    return 'secondary'
  }
  if (value === 'c' || value === 'd' || value === 'development') return 'development'
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
    return fitMap?.[id]?.[position] || fitMap?.[id]?.OF || 'secondary'
  }

  if (position === 'CF') {
    return fitMap?.[id]?.CF || fitMap?.[id]?.OF || 'secondary'
  }

  return fitMap?.[id]?.[position] || 'secondary'
}

export function priorityValue(priorityMap, playerId, position) {
  const id = pk(playerId)

  if (position === 'LF' || position === 'CF' || position === 'RF') {
    return Number(priorityMap?.[id]?.OF?.priority_pct || 0)
  }

  return Number(priorityMap?.[id]?.[position]?.priority_pct || 0)
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

export function inningStatus(lineup, inning, players, fitMap) {
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)
  const counts = positionCountsForInning(lineup, inning, availableIds)

  const missing = FIELD_POSITIONS.filter((pos) => counts[pos].length === 0)
  const duplicate = FIELD_POSITIONS.filter((pos) => counts[pos].length > 1)

  const badFits = []
  availableIds.forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (!FIELD_POSITIONS.includes(value)) return

    const tier = fitTier(fitMap, id, value)
    if (tier === 'no' || tier === 'E') {
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

      const fit = fitTier(fitMap, id, value)
      const rule = getPositionRule(optimizerProfileRules, value)

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

function chooseSitOutsForInning({
  lineup,
  inning,
  innings,
  players,
  totalsBefore,
  planSitOutTargets,
  cumulativePlanOutCounts,
  optimizerProfile = null,
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  const outsNeeded = Math.max(0, eligibleIds.length - 9)
  const additionalOutsNeeded = Math.max(0, outsNeeded - lockedInfo.lockedOuts)

  if (additionalOutsNeeded <= 0) return []

  const unlockedEligibleIds = eligibleIds.filter(
    (id) => !lockedInfo.lockedFieldPlayers.has(id) && !lockedInfo.lockedOutPlayers.has(id)
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
  optimizerProfile = null,
  optimizerProfileRules = {},
}) {
  const fit = normalizeFit(fitTier(fitMap, playerId, position))
  const target = Number(getPriorityTarget(priorityMap, playerId, position) || 0)
  const bucket = positionBucket(position)
  const rule = getPositionRule(optimizerProfileRules, position)
  const importance = positionImportance(optimizerProfileRules, position)

  const disallowed = fit === 'no'
  const primaryFit = fit === 'primary'
  const secondaryFit = fit === 'secondary'
  const developmentFit = fit === 'development'

  if (!fitAllowedByRule(rule, fit)) {
    return { playerId, position, totalScore: -100000000 }
  }

    const fitScore =
    primaryFit ? 12000 * importance :
    secondaryFit ? 4500 * importance :
    developmentFit ? 800 * importance :
    disallowed ? -75000 * importance :
    -100000000
  
  const targetPool = (candidateIds || [])
    .filter((id) => fitAllowedByRule(rule, fitTier(fitMap, id, position)))
    .map((id) => ({
      id,
      target: Number(getPriorityTarget(priorityMap, id, position) || 0),
    }))
    .filter((row) => row.target > 0)

  const targetTotal = targetPool.reduce((sum, row) => sum + row.target, 0)
  const currentPlayerCount = Number(planPositionCounts?.[playerId]?.[bucket] || 0)
  const currentPositionTotal = totalPlanPositionCount(planPositionCounts, position)

  let allocationScore = 0

  if (targetTotal > 0 && target > 0) {
    const expectedAfterThisAssignment =
      (currentPositionTotal + 1) * (target / targetTotal)

    const projectedPlayerCount = currentPlayerCount + 1
    const distanceFromTarget = Math.abs(projectedPlayerCount - expectedAfterThisAssignment)

        allocationScore = 5000 - distanceFromTarget * 2500 + target * 100 * importance
  } else if (targetTotal > 0 && target <= 0) {
    allocationScore = -5000 * importance
  }

  const prevValue = inning > 1 ? lineup?.cells?.[playerId]?.[inning - 1] || '' : ''
  const previousSamePositionCount = Object.entries(lineup?.cells?.[playerId] || {}).filter(
    ([inningNumber, value]) => Number(inningNumber) < inning && value === position
  ).length

  const minPositions = Number(optimizerProfile?.min_positions_per_player || 0)
const minInningsPerUsedPosition = Number(
  optimizerProfile?.min_innings_per_used_position || 1
)
const minPositionsMode = optimizerProfile?.min_positions_mode || 'nice'

const samePositionMode = consecutiveMode(optimizerProfileRules, position)

let rotationScore = 0

const playerPositionCounts = {}
Object.values(lineup?.cells?.[playerId] || {}).forEach((value) => {
  if (!FIELD_POSITIONS.includes(value)) return
  playerPositionCounts[value] = Number(playerPositionCounts[value] || 0) + 1
})

const qualifiedPositionCount = Object.values(playerPositionCounts).filter(
  (count) => count >= minInningsPerUsedPosition
).length

const currentPositionCount = Number(playerPositionCounts[position] || 0)
const needsMoreQualifiedPositions =
  minPositionsMode !== 'off' &&
  minPositions > 1 &&
  qualifiedPositionCount < minPositions

  if (samePositionMode === 'prefer' && prevValue === position) {
  rotationScore -= 1500
}

  if (samePositionMode === 'must_2' && prevValue === position) {
    rotationScore += 12000
  }


if (samePositionMode === 'must_2' && inning > 1 && prevValue !== position) {
  const previousPositionPlayer = Object.keys(lineup?.cells || {}).find(
    (id) => lineup?.cells?.[id]?.[inning - 1] === position
  )

  if (previousPositionPlayer && previousPositionPlayer !== playerId) {
    rotationScore -= 30000
  }
}

  if (needsMoreQualifiedPositions) {
  if (currentPositionCount > 0 && currentPositionCount < minInningsPerUsedPosition) {
    rotationScore += minPositionsMode === 'must' ? 9000 : 4500
  } else if (currentPositionCount === 0) {
    rotationScore += minPositionsMode === 'must' ? 5000 : 2500
  } else {
    rotationScore -= minPositionsMode === 'must' ? 2500 : 900
  }

  rotationScore -= currentPlayerCount * 300
}

  return {
    playerId,
    position,
    totalScore: fitScore + allocationScore + rotationScore,
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
    const aFitForBPos = fitTier(fitMap, playerA, bPos)
const bFitForAPos = fitTier(fitMap, playerB, aPos)
const bPosRule = getPositionRule(optimizerProfileRules, bPos)
const aPosRule = getPositionRule(optimizerProfileRules, aPos)

if (!fitAllowedByRule(bPosRule, aFitForBPos)) return false
if (!fitAllowedByRule(aPosRule, bFitForAPos)) return false

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
        .filter((pos) => !isDisallowedFit(fitTier(fitMap, playerId, pos)))
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

    const aFitForBPos = fitTier(fitMap, playerA, bPos)
    const bFitForAPos = fitTier(fitMap, playerB, aPos)

    const bPosRule = getPositionRule(optimizerProfileRules, bPos)
    const aPosRule = getPositionRule(optimizerProfileRules, aPos)

    if (!fitAllowedByRule(bPosRule, aFitForBPos)) return false
    if (!fitAllowedByRule(aPosRule, bFitForAPos)) return false

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

  for (let inning = 1; inning <= innings; inning += 1) {
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

    const duplicatePlayers = []

    FIELD_POSITIONS.forEach((pos) => {
      const ids = positionPlayers[pos] || []
      if (ids.length <= 1) return

      ids.slice(1).forEach((id) => {
        if (!lockedValue(lineup, id, inning)) {
          duplicatePlayers.push(id)
        }
      })
    })

    missingPositions.forEach((missingPos) => {
      const rule = getPositionRule(optimizerProfileRules, missingPos)

      const bestPlayer = duplicatePlayers
        .filter((id) => !lockedValue(lineup, id, inning))
        .filter((id) => fitAllowedByRule(rule, fitTier(fitMap, id, missingPos)))
        .sort((a, b) => {
          const aFit = normalizeFit(fitTier(fitMap, a, missingPos))
          const bFit = normalizeFit(fitTier(fitMap, b, missingPos))

          const fitScore = (fit) =>
            fit === 'primary' ? 3 :
            fit === 'secondary' ? 2 :
            fit === 'development' ? 1 :
            0

          return (
            fitScore(bFit) - fitScore(aFit) ||
            priorityValue(priorityMap, b, missingPos) - priorityValue(priorityMap, a, missingPos)
          )
        })[0]

      if (!bestPlayer) return

      lineup.cells[bestPlayer][inning] = missingPos

      const removeIndex = duplicatePlayers.indexOf(bestPlayer)
      if (removeIndex >= 0) duplicatePlayers.splice(removeIndex, 1)
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
    })

    sitOutIds.forEach((id) => {
      if (!lockedValue(lineup, id, inning)) {
        lineup.cells[id][inning] = 'Out'
        cumulativePlanOutCounts[id] = Number(cumulativePlanOutCounts[id] || 0) + 1
      }
    })

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
  eligibleIds.forEach((id) => {
  if (lockedValue(lineup, id, inning)) return

  const value = lineup.cells?.[id]?.[inning]

  // ONLY assign Out if still empty AFTER everything else
  if (!value || value === '') {
    lineup.cells[id][inning] = 'Out'
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

enforceConsecutivePositionRules({
  lineup,
  players,
  fitMap,
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
