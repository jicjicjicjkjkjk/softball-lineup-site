export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GRID_OPTIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out', 'Injury']
export const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']
export const ALLOWED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GAME_TYPES = ['Friendly', 'Tournament Pool', 'Tournament Bracket', 'Doubleheader', 'Round Robin']
export const SEASON_BUCKETS = ['In Season', 'Out of Season']
export const PRACTICE_TYPES = ['Pitchers/Catchers', 'Team Practice', 'Indoor Work', 'Outdoor Practice']
export const SETTING_TYPES = ['Indoor', 'Outdoor']

export function pk(id) {
  return String(id)
}


export function blankLineup(playerIds, innings = 6, availablePlayerIds = playerIds) {
  const cells = {}
  const battingOrder = {}
  const lockedCells = {}
  const lockedRows = {}

  ;(playerIds || []).forEach((id) => {
    const key = pk(id)
    cells[key] = {}
    battingOrder[key] = ''
    lockedCells[key] = {}
    lockedRows[key] = false

    for (let inning = 1; inning <= Number(innings || 6); inning += 1) {
      cells[key][inning] = ''
      lockedCells[key][inning] = false
    }
  })

  return {
    innings: Number(innings || 6),
    availablePlayerIds: (availablePlayerIds || playerIds || []).map(pk),
    battingOrder,
    cells,
    lockedCells,
    lockedRows,
  }
}

export function normalizeLineup(lineup, playersOrIds, inningsFallback = 6, availableFallback = []) {
  const playerIds = (playersOrIds || []).map((item) =>
    typeof item === 'object' && item !== null ? item.id : item
  )

  const out = lineup
    ? JSON.parse(JSON.stringify(lineup))
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

  playerIds.forEach((id) => {
    const key = pk(id)
    if (!out.cells[key]) out.cells[key] = {}
    if (!out.lockedCells[key]) out.lockedCells[key] = {}
    if (out.battingOrder[key] === undefined) out.battingOrder[key] = ''
    if (out.lockedRows[key] === undefined) out.lockedRows[key] = false

    for (let inning = 1; inning <= out.innings; inning += 1) {
      if (out.cells[key][inning] === undefined) out.cells[key][inning] = ''
      if (out.lockedCells[key][inning] === undefined) out.lockedCells[key][inning] = false
    }
  })

  return out
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
    return fitMap?.[id]?.CF || 'secondary'
  }

  return fitMap?.[id]?.[position] || 'secondary'
}

export function priorityValue(priorityMap, playerId, position) {
  const id = pk(playerId)

  if (position === 'LF' || position === 'RF') {
    return Number(priorityMap?.[id]?.OF?.priority_pct || 0)
  }

  if (position === 'CF') {
    return Number(priorityMap?.[id]?.CF?.priority_pct || 0)
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

    if (fitTier(fitMap, id, value) === 'no') {
      const player = (players || []).find((p) => pk(p.id) === id)
      badFits.push(`${player?.name || id} @ ${value}`)
    }
  })

  return { missing, duplicate, badFits }
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

        // Injury lowers total sit-outs needed for everyone.
        // Expected sits are spread across the whole available roster.
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

function fitRank(tier) {
  if (tier === 'primary') return 0
  if (tier === 'secondary') return 1
  return 9
}

function lockedValue(lineup, playerId, inning) {
  const rowLocked = lineup?.lockedRows?.[playerId] === true
  const cellLocked = lineup?.lockedCells?.[playerId]?.[inning] === true
  return rowLocked || cellLocked
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

function previousOutDistance(lineup, playerId, inning, plannedOuts) {
  for (let prev = inning - 1; prev >= 1; prev -= 1) {
    const planned = plannedOuts?.[playerId]?.has(prev)
    const locked = (lineup?.cells?.[playerId]?.[prev] || '') === 'Out'
    if (planned || locked) return inning - prev
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

function spacingPenalty(lineup, playerId, inning, innings, plannedOuts) {
  const prev = previousOutDistance(lineup, playerId, inning, plannedOuts)
  const next = nextLockedOutDistance(lineup, playerId, inning, innings)
  const minGap = Math.min(prev, next)

  if (minGap <= 1) return 1000000
  if (minGap === 2) return 100000
  if (minGap === 3) return 10000
  return 0
}

function clearUnlockedCells(lineup, players) {
  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      if (!lockedValue(lineup, id, inning)) {
        const current = lineup?.cells?.[id]?.[inning] || ''
        if (current !== 'Injury') lineup.cells[id][inning] = ''
      }
    }
  })
}

function initializePlannedOutSets(players) {
  const out = {}
  ;(players || []).forEach((player) => {
    out[pk(player.id)] = new Set()
  })
  return out
}

function canPlayPosition(fitMap, playerId, position, strict = true) {
  if (!strict) return true
  return fitTier(fitMap, playerId, position) !== 'no'
}

function canCoverOpenPositions(playerIds, openPositions, fitMap, strict = true) {
  if (!openPositions.length) return true
  if (playerIds.length < openPositions.length) return false

  const candidatesByPosition = {}
  openPositions.forEach((position) => {
    candidatesByPosition[position] = playerIds.filter((playerId) =>
      canPlayPosition(fitMap, playerId, position, strict)
    )
  })

  if (strict) {
    const impossible = openPositions.some((position) => candidatesByPosition[position].length === 0)
    if (impossible) return false
  }

  const orderedPositions = [...openPositions].sort(
    (a, b) => candidatesByPosition[a].length - candidatesByPosition[b].length
  )

  const usedPlayers = new Set()

  function search(index) {
    if (index >= orderedPositions.length) return true

    const position = orderedPositions[index]
    const candidates = candidatesByPosition[position]

    for (const playerId of candidates) {
      if (usedPlayers.has(playerId)) continue
      usedPlayers.add(playerId)
      if (search(index + 1)) return true
      usedPlayers.delete(playerId)
    }

    return false
  }

  return search(0)
}

function futureLockedFieldCount(lineup, playerId, inning, innings) {
  let count = 0

  for (let next = inning + 1; next <= innings; next += 1) {
    if (!lockedValue(lineup, playerId, next)) continue
    const value = lineup?.cells?.[playerId]?.[next] || ''
    if (FIELD_POSITIONS.includes(value)) count += 1
  }

  return count
}

function totalLockedFieldCount(lineup, playerId, innings) {
  let count = 0

  for (let inning = 1; inning <= innings; inning += 1) {
    if (!lockedValue(lineup, playerId, inning)) continue
    const value = lineup?.cells?.[playerId]?.[inning] || ''
    if (FIELD_POSITIONS.includes(value)) count += 1
  }

  return count
}

function lockedHeavySitClumpPenalty(lineup, playerId, inning, innings, players, plannedOuts) {
  const currentLocked = futureLockedFieldCount(lineup, playerId, inning, innings)

  if (currentLocked <= 0) return 0

  let penalty = 0

  for (const player of players || []) {
    const otherId = pk(player.id)
    if (otherId === playerId) continue

    const otherLocked = futureLockedFieldCount(lineup, otherId, inning - 1, innings)
    const satPrev =
      plannedOuts?.[otherId]?.has(inning - 1) ||
      (inning > 1 && (lineup?.cells?.[otherId]?.[inning - 1] || '') === 'Out')

    if (satPrev && otherLocked >= 2) {
      penalty += 500
    }
  }

  return penalty
}

function buildSitPlan({
  lineup,
  game,
  players,
  totalsBefore,
  fitMap,
  batchTargetOuts = {},
  batchCurrentOuts = {},
}) {
  const innings = Number(game?.innings || lineup?.innings || 6)
  const plannedOuts = initializePlannedOutSets(players)

  const gameOutCounts = {}
  const seasonOuts = {}
  const seasonDelta = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)

    seasonOuts[id] = Number(totalsBefore?.[id]?.actualOuts || 0)
    seasonDelta[id] = Number(totalsBefore?.[id]?.delta || 0)
    gameOutCounts[id] = 0

    for (let inning = 1; inning <= innings; inning += 1) {
      if (
        lockedValue(lineup, id, inning) &&
        (lineup?.cells?.[id]?.[inning] || '') === 'Out'
      ) {
        plannedOuts[id].add(inning)
        gameOutCounts[id] += 1
        seasonOuts[id] += 1
        seasonDelta[id] = Number((seasonDelta[id] + 1).toFixed(2))
      }
    }
  })

  function projectedBatchOuts(id, extraOuts = 0) {
    return Number(batchCurrentOuts?.[id] || 0) + Number(gameOutCounts[id] || 0) + extraOuts
  }

  function targetGap(id, extraOuts = 0) {
    return Number(batchTargetOuts?.[id] || 0) - projectedBatchOuts(id, extraOuts)
  }

  for (let inning = 1; inning <= innings; inning += 1) {
    const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
    const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

    const openPositions = FIELD_POSITIONS.filter(
      (position) => !lockedInfo.assignedPositions.has(position)
    )

    const totalOutsNeeded = Math.max(0, eligibleIds.length - 9)
    const outsToChoose = Math.max(0, totalOutsNeeded - lockedInfo.lockedOuts)

    if (outsToChoose <= 0) continue

    const unlockedEligibleIds = eligibleIds.filter(
      (id) => !lockedInfo.lockedFieldPlayers.has(id) && !lockedInfo.lockedOutPlayers.has(id)
    )

    const chosenSits = new Set()

    for (let pick = 0; pick < outsToChoose; pick += 1) {
      const candidatePool = unlockedEligibleIds.filter((id) => !chosenSits.has(id))
      if (!candidatePool.length) break

      const ranked = candidatePool
        .map((id) => ({
          id,
          player: (players || []).find((p) => pk(p.id) === id),
          batchNow: projectedBatchOuts(id, 0),
          batchAfterPick: projectedBatchOuts(id, 1),
          batchTarget: Number(batchTargetOuts?.[id] || 0),
          batchGapAfterPick: targetGap(id, 1),
          gameOutCount: gameOutCounts[id],
          seasonOutCount: seasonOuts[id],
          delta: seasonDelta[id],
          spacing: spacingPenalty(lineup, id, inning, innings, plannedOuts),
        }))
        .sort((a, b) => {
          const aOverTarget = a.batchAfterPick > a.batchTarget ? 1 : 0
          const bOverTarget = b.batchAfterPick > b.batchTarget ? 1 : 0
          if (aOverTarget !== bOverTarget) return aOverTarget - bOverTarget

          if (a.batchGapAfterPick !== b.batchGapAfterPick) {
            return b.batchGapAfterPick - a.batchGapAfterPick
          }

          if (a.gameOutCount !== b.gameOutCount) return a.gameOutCount - b.gameOutCount
          if (a.spacing !== b.spacing) return a.spacing - b.spacing
          if (a.delta !== b.delta) return a.delta - b.delta
          if (a.seasonOutCount !== b.seasonOutCount) return a.seasonOutCount - b.seasonOutCount

          return String(a.player?.name || '').localeCompare(String(b.player?.name || ''))
        })

      let pickedId = null

      for (const candidate of ranked) {
        const remainingFielders = unlockedEligibleIds.filter(
          (id) => !chosenSits.has(id) && id !== candidate.id
        )

        const canCoverStrict = canCoverOpenPositions(remainingFielders, openPositions, fitMap, true)
        const canCoverLoose = canCoverOpenPositions(remainingFielders, openPositions, fitMap, false)

        if (canCoverStrict || canCoverLoose) {
          pickedId = candidate.id
          break
        }
      }

      if (!pickedId) {
        pickedId = ranked[0]?.id || null
      }

      if (!pickedId) break

      chosenSits.add(pickedId)
      plannedOuts[pickedId].add(inning)
      gameOutCounts[pickedId] += 1
      seasonOuts[pickedId] += 1
      seasonDelta[pickedId] = Number((seasonDelta[pickedId] + 1).toFixed(2))
    }
  }

  return plannedOuts
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

function countUnlockedFieldInningsRemaining(lineup, playerId, fromInning) {
  const id = pk(playerId)
  const innings = Number(lineup?.innings || 0)
  let count = 0

  for (let inning = fromInning; inning <= innings; inning += 1) {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (value === 'Injury') continue
    if (!lockedValue(lineup, id, inning)) count += 1
  }

  return count
}

function needsSecondPositionThisGame(lineup, playerId, inning) {
  const id = pk(playerId)
  const existingPositions = getPlayerFieldPositionsInGame(lineup, id, inning - 1)

  if (existingPositions.size >= 2) return false
  if (isRowFullyLockedForGame(lineup, id)) return false

  const remainingUnlocked = countUnlockedFieldInningsRemaining(lineup, id, inning)
  if (remainingUnlocked <= 0) return false

  return existingPositions.size === 1
}

function secondPositionBonus(lineup, playerId, position, inning) {
  const id = pk(playerId)
  const existingPositions = getPlayerFieldPositionsInGame(lineup, id, inning - 1)

  if (!needsSecondPositionThisGame(lineup, id, inning)) return 0
  if (existingPositions.size !== 1) return 0
  if (existingPositions.has(position)) return 0

  return 18
}

function continuityPreference(lineup, playerId, position, inning) {
  const id = pk(playerId)
  if (inning <= 1) return 0

  const prevValue = lineup?.cells?.[id]?.[inning - 1] || ''
  if (prevValue !== position) return 0

  const currentPositions = getPlayerFieldPositionsInGame(lineup, id, inning - 1)

  // Bigger reward if player still only has one position so far.
  if (currentPositions.size <= 1) return 10

  // Smaller reward once they already have variety.
  return 4
}

function playerGameOutCount(plannedOutsByPlayer, playerId, inning) {
  return Array.from(plannedOutsByPlayer?.[pk(playerId)] || []).filter((x) => x < inning).length
}

function scorePlayerForPosition({
  player,
  playerId,
  position,
  rollingTotals,
  priorityMap,
  fitMap,
  lineup,
  inning,
  plannedOutsByPlayer,
}) {
  const fit = fitTier(fitMap, playerId, position)
  const fitScore = fitRank(fit)
  const target = priorityValue(priorityMap, playerId, position)

  const actualCount = ['LF', 'CF', 'RF'].includes(position)
    ? Number(rollingTotals?.[playerId]?.OF || 0)
    : Number(rollingTotals?.[playerId]?.[position] || 0)

  const fieldTotal = Math.max(Number(rollingTotals?.[playerId]?.fieldTotal || 0), 1)
  const actualPct = (actualCount / fieldTotal) * 100
  const gap = target - actualPct

  const prevValue = inning > 1 ? lineup?.cells?.[playerId]?.[inning - 1] || '' : ''
  const continuityBonus = prevValue === position ? 18 : 0

  const playerGamePositions = getPlayerFieldPositionsInGame(lineup, playerId)
  const alreadyHasThisPosition = playerGamePositions.has(position)
  const diversityBonus =
    playerGamePositions.size <= 1 && !alreadyHasThisPosition ? 12 : 0

  const currentGameOuts = Array.from(plannedOutsByPlayer?.[playerId] || []).filter(
    (x) => x < inning
  ).length

  return {
    player,
    id: playerId,
    fitScore,
    gap,
    continuityBonus,
    diversityBonus,
    currentGameOuts,
  }
}

function findBestAssignment({
  positionList,
  candidateIds,
  players,
  lineup,
  inning,
  rollingTotals,
  priorityMap,
  fitMap,
  plannedOutsByPlayer,
  strict = true,
}) {
  const candidatesByPosition = {}

  positionList.forEach((position) => {
    candidatesByPosition[position] = candidateIds
      .filter((playerId) => canPlayPosition(fitMap, playerId, position, strict))
      .map((playerId) =>
        scorePlayerForPosition({
          player: (players || []).find((p) => pk(p.id) === pk(playerId)),
          playerId,
          position,
          rollingTotals,
          priorityMap,
          fitMap,
          lineup,
          inning,
          plannedOutsByPlayer,
        })
      )
      .map((candidate) => {
        const totalScore =
          (100 - candidate.fitScore * 20) +
          candidate.gap +
          candidate.continuityBonus +
          candidate.diversityBonus -
          candidate.currentGameOuts * 3

        return {
          ...candidate,
          totalScore,
        }
      })
      .sort((a, b) => {
        if (a.fitScore !== b.fitScore) return a.fitScore - b.fitScore
        if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore
        return String(a.player?.name || '').localeCompare(String(b.player?.name || ''))
      })
  })

  const impossible = positionList.some((position) => candidatesByPosition[position].length === 0)
  if (impossible) return null

  const orderedPositions = [...positionList].sort(
    (a, b) => candidatesByPosition[a].length - candidatesByPosition[b].length
  )

  const usedPlayers = new Set()
  const assignment = {}

  for (const position of orderedPositions) {
    const bestCandidate = candidatesByPosition[position].find(
      (candidate) => !usedPlayers.has(candidate.id)
    )

    if (!bestCandidate) return null

    usedPlayers.add(bestCandidate.id)
    assignment[position] = bestCandidate.id
  }

  return assignment
}

function assignPositionsForInning({
  lineup,
  inning,
  players,
  availablePlayerIds,
  plannedOutsByPlayer,
  rollingTotals,
  priorityMap,
  fitMap,
}) {
  const eligibleIds = getEligiblePlayerIdsForInning(lineup, inning, players)
  const eligibleSet = new Set(eligibleIds)
  const availableSet = new Set((availablePlayerIds || []).map(pk))
  const lockedInfo = getLockedAssignmentsForInning(lineup, inning, players)

  ;(players || []).forEach((player) => {
    const id = pk(player.id)

    if (!availableSet.has(id)) {
      lineup.cells[id][inning] = ''
      return
    }

    const current = lineup?.cells?.[id]?.[inning] || ''
    if (current === 'Injury') return

    if (!lockedValue(lineup, id, inning)) {
      lineup.cells[id][inning] = ''
    }
  })

  const openPositions = FIELD_POSITIONS.filter(
    (position) => !lockedInfo.assignedPositions.has(position)
  )

  const sitCandidateIds = eligibleIds.filter(
    (id) =>
      !lockedInfo.lockedFieldPlayers.has(id) &&
      !lockedInfo.lockedOutPlayers.has(id) &&
      plannedOutsByPlayer?.[id]?.has(inning)
  )

  const fieldCandidateIds = eligibleIds.filter(
    (id) =>
      !lockedInfo.lockedFieldPlayers.has(id) &&
      !lockedInfo.lockedOutPlayers.has(id) &&
      !sitCandidateIds.includes(id)
  )

  let assignment = findBestAssignment({
    positionList: openPositions,
    candidateIds: fieldCandidateIds,
    players,
    lineup,
    inning,
    rollingTotals,
    priorityMap,
    fitMap,
    plannedOutsByPlayer,
    strict: true,
  })

  if (!assignment) {
    const relaxedCandidates = eligibleIds.filter(
      (id) => !lockedInfo.lockedFieldPlayers.has(id) && !lockedInfo.lockedOutPlayers.has(id)
    )

    assignment = findBestAssignment({
      positionList: openPositions,
      candidateIds: relaxedCandidates,
      players,
      lineup,
      inning,
      rollingTotals,
      priorityMap,
      fitMap,
      plannedOutsByPlayer,
      strict: true,
    })
  }

  if (!assignment) {
    const allUnlockedEligible = eligibleIds.filter(
      (id) => !lockedInfo.lockedFieldPlayers.has(id) && !lockedInfo.lockedOutPlayers.has(id)
    )

    assignment = findBestAssignment({
      positionList: openPositions,
      candidateIds: allUnlockedEligible,
      players,
      lineup,
      inning,
      rollingTotals,
      priorityMap,
      fitMap,
      plannedOutsByPlayer,
      strict: false,
    })
  }

  const assignedPlayerIds = new Set()

  if (assignment) {
    Object.entries(assignment).forEach(([position, playerId]) => {
      lineup.cells[playerId][inning] = position
      assignedPlayerIds.add(playerId)
    })
  }

  eligibleIds.forEach((id) => {
    if (lockedInfo.lockedFieldPlayers.has(id)) return
    if (lockedInfo.lockedOutPlayers.has(id)) return
    if (assignedPlayerIds.has(id)) return

    if (!lockedValue(lineup, id, inning)) {
      lineup.cells[id][inning] = 'Out'
    }
  })

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    if (!eligibleSet.has(id)) return
    if (lockedValue(lineup, id, inning)) return

    const value = lineup?.cells?.[id]?.[inning] || ''
    if (!value) {
      lineup.cells[id][inning] = 'Out'
    }
  })
}


function getUnlockedFieldInningsForPlayer(lineup, playerId) {
  const id = pk(playerId)
  const innings = []

  for (let inning = 1; inning <= Number(lineup?.innings || 0); inning += 1) {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (!FIELD_POSITIONS.includes(value)) continue
    if (lockedValue(lineup, id, inning)) continue
    innings.push(inning)
  }

  return innings
}

function canPlayerTakePositionAtInning({
  lineup,
  playerId,
  inning,
  nextPosition,
  fitMap,
}) {
  if (!FIELD_POSITIONS.includes(nextPosition)) return false
  if (fitTier(fitMap, playerId, nextPosition) === 'no') return false

  for (const id of Object.keys(lineup?.cells || {})) {
    if (pk(id) === pk(playerId)) continue
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (value === nextPosition) return false
  }

  return true
}

function enforceMinimumTwoPositions({ lineup, players, fitMap, priorityMap }) {
  const availableIds = new Set((lineup?.availablePlayerIds || []).map(pk))
  const innings = Number(lineup?.innings || 0)

  if (!innings) return lineup

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

  function getUniqueFieldPositions(playerId) {
    return new Set(getFieldInnings(playerId).map((x) => x.value))
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
    if (fitTier(fitMap, playerA, bPos) === 'no') return false
    if (fitTier(fitMap, playerB, aPos) === 'no') return false

    return true
  }

  ;(players || []).forEach((player) => {
    const playerId = pk(player.id)

    if (!availableIds.has(playerId)) return
    if (isRowFullyLockedForGame(lineup, playerId)) return

    const fieldInnings = getFieldInnings(playerId)
    const uniquePositions = getUniqueFieldPositions(playerId)

    if (fieldInnings.length < 2) return
    if (uniquePositions.size >= 2) return

    const originalPos = fieldInnings[0]?.value
    if (!originalPos) return

    const unlockedFieldInnings = fieldInnings.filter(
      ({ inning }) => !lockedValue(lineup, playerId, inning)
    )

    for (const { inning } of unlockedFieldInnings) {
      const currentPos = lineup?.cells?.[playerId]?.[inning] || ''
      if (!FIELD_POSITIONS.includes(currentPos)) continue

      const alternativePositions = FIELD_POSITIONS
        .filter((pos) => pos !== currentPos)
        .filter((pos) => fitTier(fitMap, playerId, pos) !== 'no')
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

        const updated = getUniqueFieldPositions(playerId)
        if (updated.size >= 2) return
      }
    }
  })

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

  const rollingTotals = JSON.parse(JSON.stringify(totalsBefore || {}))

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
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

  const plannedOutsByPlayer = buildSitPlan({
    lineup,
    game,
    players,
    totalsBefore: rollingTotals,
    fitMap,
  })

  for (let inning = 1; inning <= lineup.innings; inning += 1) {
    assignPositionsForInning({
      lineup,
      inning,
      players,
      availablePlayerIds: lineup.availablePlayerIds,
      plannedOutsByPlayer,
      rollingTotals,
      priorityMap,
      fitMap,
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

    enforceMinimumTwoPositions({ lineup, players, fitMap, priorityMap })
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

        if (inGame) {
          expectedOuts += expected
        }

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
