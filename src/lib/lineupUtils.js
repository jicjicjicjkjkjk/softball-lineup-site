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

  if (position === 'LF' || position === 'RF' || position === 'CF') {
    return fitMap?.[id]?.[position] || fitMap?.[id]?.OF || 'secondary'
  }

  return fitMap?.[id]?.[position] || 'secondary'
}

export function priorityValue(priorityMap, playerId, position) {
  const id = pk(playerId)

  if (['LF', 'CF', 'RF'].includes(position)) {
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
      const eligible = availableIds.filter((id) => {
        const value = lineup.cells?.[id]?.[inning] || ''
        return value !== 'Injury'
      })

      const expected = eligible.length ? Math.max(0, eligible.length - 9) / eligible.length : 0

      availableIds.forEach((id) => {
        const row = totals[id]
        if (!row) return

        if (!countedGameForPlayer.has(id)) {
          row.games += 1
          countedGameForPlayer.add(id)
        }

        const value = lineup.cells?.[id]?.[inning] || ''

        if (value === 'Injury') {
          row.Injury += 1
          return
        }

        if (eligible.includes(id)) row.expectedOuts += expected

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

function getEligiblePlayersForInning(lineup, inning, players) {
  const availableSet = new Set((lineup?.availablePlayerIds || []).map(pk))
  return (players || []).filter((player) => {
    const id = pk(player.id)
    if (!availableSet.has(id)) return false
    return (lineup?.cells?.[id]?.[inning] || '') !== 'Injury'
  })
}

function getLockedAssignmentsForInning(lineup, inning, players) {
  const usedPlayers = new Set()
  const assignedPositions = new Set()
  let lockedOuts = 0

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    if (!lockedValue(lineup, id, inning)) return

    const value = lineup?.cells?.[id]?.[inning] || ''
    if (!value) return

    usedPlayers.add(id)

    if (value === 'Out') lockedOuts += 1
    if (FIELD_POSITIONS.includes(value)) assignedPositions.add(value)
  })

  return { usedPlayers, assignedPositions, lockedOuts }
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
    if (lockedValue(lineup, playerId, next) && (lineup?.cells?.[playerId]?.[next] || '') === 'Out') {
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

function buildSitPlan({ lineup, game, players, totalsBefore }) {
  const innings = Number(game?.innings || lineup?.innings || 6)
  const plannedOuts = initializePlannedOutSets(players)
  const availableSet = new Set((lineup?.availablePlayerIds || []).map(pk))

  const runningOutCounts = {}
  const runningDelta = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    runningOutCounts[id] = Number(totalsBefore?.[id]?.Out || 0)
    runningDelta[id] = Number(totalsBefore?.[id]?.delta || 0)
  })

  for (let inning = 1; inning <= innings; inning += 1) {
    const eligible = getEligiblePlayersForInning(lineup, inning, players)
    const { assignedPositions, lockedOuts } = getLockedAssignmentsForInning(lineup, inning, players)

    const spotsLeftToFill = Math.max(0, 9 - assignedPositions.size)
    const totalOutsNeeded = Math.max(0, eligible.length - spotsLeftToFill)
    const outsToChoose = Math.max(0, totalOutsNeeded - lockedOuts)

    const candidates = eligible.filter((player) => {
      const id = pk(player.id)
      if (!availableSet.has(id)) return false
      if (lockedValue(lineup, id, inning)) return false
      return true
    })

    for (let i = 0; i < outsToChoose; i += 1) {
      const ranked = candidates
        .filter((player) => !plannedOuts[pk(player.id)].has(inning))
        .map((player) => {
          const id = pk(player.id)

          const prevOutGap = previousOutDistance(lineup, id, inning, plannedOuts)

          return {
            id,
            player,
            outCount: runningOutCounts[id],
            delta: runningDelta[id],
            backToBackPenalty: prevOutGap === 1 ? 1000000 : 0,
            spacingPenalty: spacingPenalty(lineup, id, inning, innings, plannedOuts),
          }
        })
        .sort((a, b) => {
          // 1. NO DOUBLE SITS UNTIL ALL SIT
          if (a.outCount !== b.outCount) {
            return a.outCount - b.outCount
          }

          // 2. HARD STOP: NO BACK-TO-BACK
          if (a.backToBackPenalty !== b.backToBackPenalty) {
            return a.backToBackPenalty - b.backToBackPenalty
          }

          // 3. SPACING (spread sits out)
          if (a.spacingPenalty !== b.spacingPenalty) {
            return a.spacingPenalty - b.spacingPenalty
          }

          // 4. SEASON FAIRNESS
          if (a.delta !== b.delta) {
            return b.delta - a.delta
          }

          return String(a.player.name || '').localeCompare(String(b.player.name || ''))
        })

      const choice = ranked[0]
      if (!choice) break

      plannedOuts[choice.id].add(inning)
      runningOutCounts[choice.id] += 1
      runningDelta[choice.id] = Number((runningDelta[choice.id] + 1).toFixed(2))
    }
  }

  return plannedOuts
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
  const continuityBonus = prevValue === position ? 4 : 0

  return {
    player,
    id: playerId,
    fitScore,
    gap,
    continuityBonus,
  }
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
  const availableSet = new Set((availablePlayerIds || []).map(pk))
  const usedPlayers = new Set()
  const assignedPositions = new Set()

  const eligiblePlayers = (players || []).filter((p) => {
    const id = pk(p.id)
    if (!availableSet.has(id)) return false
    const val = lineup?.cells?.[id]?.[inning] || ''
    return val !== 'Injury'
  })

  // STEP 1: APPLY LOCKED + PLANNED OUTS FIRST
  eligiblePlayers.forEach((player) => {
    const id = pk(player.id)
    const locked = lockedValue(lineup, id, inning)

    if (locked) {
      const val = lineup.cells[id][inning]
      if (FIELD_POSITIONS.includes(val)) {
        assignedPositions.add(val)
        usedPlayers.add(id)
      }
      if (val === 'Out') {
        usedPlayers.add(id)
      }
      return
    }

    // APPLY SIT PLAN HERE
    if (plannedOutsByPlayer?.[id]?.has(inning)) {
      lineup.cells[id][inning] = 'Out'
      usedPlayers.add(id)
    } else {
      lineup.cells[id][inning] = ''
    }
  })

  // STEP 2: FILL POSITIONS (BEST FIT FIRST)
  FIELD_POSITIONS.forEach((position) => {
    if (assignedPositions.has(position)) return

    const candidates = eligiblePlayers
      .filter((player) => {
        const id = pk(player.id)
        if (usedPlayers.has(id)) return false
        if (fitTier(fitMap, id, position) === 'no') return false
        return true
      })
      .map((player) => {
        const id = pk(player.id)

        const fitScore = fitRank(fitTier(fitMap, id, position))
        const target = priorityValue(priorityMap, id, position)

        const actualCount = ['LF', 'CF', 'RF'].includes(position)
          ? Number(rollingTotals?.[id]?.OF || 0)
          : Number(rollingTotals?.[id]?.[position] || 0)

        const fieldTotal = Math.max(Number(rollingTotals?.[id]?.fieldTotal || 0), 1)
        const actualPct = (actualCount / fieldTotal) * 100
        const gap = target - actualPct

        const prev = inning > 1 ? lineup?.cells?.[id]?.[inning - 1] : ''
        const continuity = prev === position ? 5 : 0

        return {
          id,
          player,
          fitScore,
          gap,
          continuity,
        }
      })
      .sort((a, b) => {
        if (a.fitScore !== b.fitScore) return a.fitScore - b.fitScore
        if (a.gap !== b.gap) return b.gap - a.gap
        if (a.continuity !== b.continuity) return b.continuity - a.continuity
        return a.player.name.localeCompare(b.player.name)
      })

    const choice = candidates[0]
    if (!choice) return

    lineup.cells[choice.id][inning] = position
    usedPlayers.add(choice.id)
    assignedPositions.add(position)
  })

  // STEP 3: CLEANUP (anyone left = Out)
  eligiblePlayers.forEach((player) => {
    const id = pk(player.id)
    if (usedPlayers.has(id)) return

    lineup.cells[id][inning] = 'Out'
    usedPlayers.add(id)
  })
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
  lineup.availablePlayerIds = safeAvailable.length ? safeAvailable : (players || []).map((p) => pk(p.id))

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

  const plannedOuts = buildSitPlan({
    lineup,
    game,
    players,
    totalsBefore: rollingTotals,
  })

  for (let inning = 1; inning <= lineup.innings; inning += 1) {
    assignPositionsForInning({
      lineup,
      inning,
      players,
      plannedOuts,
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

export function playerGameTrackingRows(games, lineupsByGame, lineupLockedByGame, playerId, gameTypeFilter = 'All') {
  return (games || [])
    .filter((game) => {
      if (gameTypeFilter !== 'All' && game.game_type !== gameTypeFilter) return false
      return Boolean(lineupsByGame?.[pk(game.id)])
    })
    .sort((a, b) => {
      const aKey = `${a.date || ''}-${String(a.game_order || 1).padStart(3, '0')}`
      const bKey = `${b.date || ''}-${String(b.game_order || 1).padStart(3, '0')}`
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

        const eligible = available.filter((pid) => (lineup?.cells?.[pid]?.[inning] || '') !== 'Injury')
        const expected = eligible.length ? Math.max(0, eligible.length - 9) / eligible.length : 0

        if ((lineup?.cells?.[id]?.[inning] || '') !== 'Injury' && inGame) {
          expectedOuts += expected
        }

        if (value === 'Out') sitOuts += 1
      }

      return {
        gameId: pk(game.id),
        date: game.date || '',
        opponent: game.opponent || '',
        type: game.game_type || '',
        order: game.game_order || 1,
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
