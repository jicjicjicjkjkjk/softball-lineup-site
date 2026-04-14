export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GRID_OPTIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out', 'Injury']
export const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']
export const ALLOWED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GAME_TYPES = ['Friendly', 'Tournament Pool', 'Tournament Bracket', 'Doubleheader', 'Round Robin']

export function pk(id) {
  return String(id)
}

export function blankLineup(playerIds, innings = 6, availablePlayerIds = playerIds) {
  const cells = {}
  const battingOrder = {}
  const lockedCells = {}
  const lockedRows = {}

  playerIds.forEach((id) => {
    const key = pk(id)
    cells[key] = {}
    battingOrder[key] = ''
    lockedCells[key] = {}
    lockedRows[key] = false

    for (let inning = 1; inning <= innings; inning += 1) {
      cells[key][inning] = ''
      lockedCells[key][inning] = false
    }
  })

  return {
    innings: Number(innings || 6),
    availablePlayerIds: (availablePlayerIds || playerIds).map(pk),
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
    return fitMap?.[id]?.CF || fitMap?.[id]?.OF || 'secondary'
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

export function depthScore() {
  return 999
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
    }
  })

  ;(lineups || []).forEach((lineup) => {
    if (!lineup) return

    const availableIds = (lineup.availablePlayerIds || []).map(pk)
    const gameCounted = new Set()

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      const eligible = availableIds.filter((id) => {
        const value = lineup.cells?.[id]?.[inning] || ''
        return value !== 'Injury'
      })

      const expected = eligible.length ? Math.max(0, eligible.length - 9) / eligible.length : 0

      availableIds.forEach((id) => {
        const row = totals[id]
        if (!row) return

        if (!gameCounted.has(id)) {
          row.games += 1
          gameCounted.add(id)
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
      delta: Number((Number(a?.[id]?.actualOuts || 0) + Number(b?.[id]?.actualOuts || 0) - Number(a?.[id]?.expectedOuts || 0) - Number(b?.[id]?.expectedOuts || 0)).toFixed(2)),
    }
  })

  return out
}

function fitRank(tier) {
  if (tier === 'primary') return 0
  if (tier === 'secondary') return 1
  return 9
}

function countLockedOutsForPlayer(lineup, playerId) {
  let total = 0
  const innings = Number(lineup?.innings || 0)

  for (let inning = 1; inning <= innings; inning += 1) {
    const rowLocked = lineup?.lockedRows?.[playerId] === true
    const cellLocked = lineup?.lockedCells?.[playerId]?.[inning] === true
    const value = lineup?.cells?.[playerId]?.[inning] || ''

    if ((rowLocked || cellLocked) && value === 'Out') total += 1
  }

  return total
}

function previousOutDistance(plannedOutsByPlayer, playerId, inning) {
  let distance = 999

  for (let prev = inning - 1; prev >= 1; prev -= 1) {
    if (plannedOutsByPlayer[playerId]?.has(prev)) {
      distance = inning - prev
      break
    }
  }

  return distance
}

function nextOutDistance(plannedOutsByPlayer, playerId, inning, innings) {
  let distance = 999

  for (let next = inning + 1; next <= innings; next += 1) {
    if (plannedOutsByPlayer[playerId]?.has(next)) {
      distance = next - inning
      break
    }
  }

  return distance
}

function spacingPenaltyForOut(plannedOutsByPlayer, playerId, inning, innings) {
  const prevDistance = previousOutDistance(plannedOutsByPlayer, playerId, inning)
  const nextDistance = nextOutDistance(plannedOutsByPlayer, playerId, inning, innings)
  const minDistance = Math.min(prevDistance, nextDistance)

  if (minDistance <= 1) return 1000000
  if (minDistance === 2) return 100000
  if (minDistance === 3) return 10000
  return 0
}

function inningLockedFieldAssignments(lineup, inning, players) {
  const assignedPositions = new Set()
  const usedPlayers = new Set()

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    const rowLocked = lineup?.lockedRows?.[id] === true
    const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
    const value = lineup?.cells?.[id]?.[inning] || ''

    if ((rowLocked || cellLocked) && value) {
      usedPlayers.add(id)
      if (FIELD_POSITIONS.includes(value)) assignedPositions.add(value)
    }
  })

  return { assignedPositions, usedPlayers }
}

function buildSitPlan({ lineup, game, players, availablePlayerIds, totalsBefore }) {
  const innings = Number(game?.innings || lineup?.innings || 6)
  const availableSet = new Set((availablePlayerIds || []).map(pk))

  const plannedOutsByPlayer = {}
  const plannedOutCounts = {}
  const currentDelta = {}

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    plannedOutsByPlayer[id] = new Set()
    plannedOutCounts[id] = countLockedOutsForPlayer(lineup, id)
    currentDelta[id] = Number(totalsBefore?.[id]?.delta || 0)
  })

  for (let inning = 1; inning <= innings; inning += 1) {
    const eligible = (players || []).filter((player) => {
      const id = pk(player.id)
      if (!availableSet.has(id)) return false
      const value = lineup?.cells?.[id]?.[inning] || ''
      return value !== 'Injury'
    })

    const { assignedPositions } = inningLockedFieldAssignments(lineup, inning, players)

    let lockedOutsThisInning = 0
    eligible.forEach((player) => {
      const id = pk(player.id)
      const rowLocked = lineup?.lockedRows?.[id] === true
      const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
      const value = lineup?.cells?.[id]?.[inning] || ''
      if ((rowLocked || cellLocked) && value === 'Out') {
        plannedOutsByPlayer[id].add(inning)
        lockedOutsThisInning += 1
      }
    })

    const fieldSpotsStillNeeded = Math.max(0, 9 - assignedPositions.size)
    const totalOutsNeeded = Math.max(0, eligible.length - fieldSpotsStillNeeded)
    const outsStillToAssign = Math.max(0, totalOutsNeeded - lockedOutsThisInning)

    const candidates = eligible.filter((player) => {
      const id = pk(player.id)
      const rowLocked = lineup?.lockedRows?.[id] === true
      const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
      return !(rowLocked || cellLocked)
    })

    for (let slot = 0; slot < outsStillToAssign; slot += 1) {
      const ranked = candidates
        .filter((player) => !plannedOutsByPlayer[pk(player.id)].has(inning))
        .map((player) => {
          const id = pk(player.id)
          return {
            player,
            id,
            plannedOutCount: plannedOutCounts[id],
            spacingPenalty: spacingPenaltyForOut(plannedOutsByPlayer, id, inning, innings),
            delta: currentDelta[id],
          }
        })
        .sort((a, b) => {
          if (a.spacingPenalty !== b.spacingPenalty) return a.spacingPenalty - b.spacingPenalty
          if (a.plannedOutCount !== b.plannedOutCount) return a.plannedOutCount - b.plannedOutCount
          if (a.delta !== b.delta) return b.delta - a.delta
          return String(a.player.name || '').localeCompare(String(b.player.name || ''))
        })

      const choice = ranked[0]
      if (!choice) break

      plannedOutsByPlayer[choice.id].add(inning)
      plannedOutCounts[choice.id] += 1
      currentDelta[choice.id] = Number((currentDelta[choice.id] + 1).toFixed(2))
    }
  }

  return plannedOutsByPlayer
}

function scorePlayerForPosition({ player, playerId, position, rollingTotals, priorityMap, fitMap }) {
  const fit = fitTier(fitMap, playerId, position)
  const fitScore = fitRank(fit)
  const target = priorityValue(priorityMap, playerId, position)

  const actualCount = ['LF', 'CF', 'RF'].includes(position)
    ? Number(rollingTotals?.[playerId]?.OF || 0)
    : Number(rollingTotals?.[playerId]?.[position] || 0)

  const fieldTotal = Math.max(Number(rollingTotals?.[playerId]?.fieldTotal || 0), 1)
  const actualPct = (actualCount / fieldTotal) * 100
  const gap = target - actualPct

  return {
    player,
    id: playerId,
    fitScore,
    gap,
    depth: depthScore(player.name, position),
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
  const { assignedPositions, usedPlayers } = inningLockedFieldAssignments(lineup, inning, players)

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    const value = lineup?.cells?.[id]?.[inning] || ''
    const rowLocked = lineup?.lockedRows?.[id] === true
    const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true

    if (!availableSet.has(id)) {
      lineup.cells[id][inning] = ''
      return
    }

    if (value === 'Injury') {
      usedPlayers.add(id)
      return
    }

    if (plannedOutsByPlayer[id]?.has(inning)) {
      if (!(rowLocked || cellLocked)) lineup.cells[id][inning] = 'Out'
      usedPlayers.add(id)
    } else if (!(rowLocked || cellLocked)) {
      lineup.cells[id][inning] = ''
    }
  })

  FIELD_POSITIONS.forEach((position) => {
    if (assignedPositions.has(position)) return

    const candidates = (players || [])
      .filter((player) => {
        const id = pk(player.id)
        if (!availableSet.has(id)) return false
        if (usedPlayers.has(id)) return false
        const current = lineup?.cells?.[id]?.[inning] || ''
        if (current === 'Out' || current === 'Injury') return false
        return fitTier(fitMap, id, position) !== 'no'
      })
      .map((player) =>
        scorePlayerForPosition({
          player,
          playerId: pk(player.id),
          position,
          rollingTotals,
          priorityMap,
          fitMap,
        })
      )
      .sort((a, b) => {
        if (a.fitScore !== b.fitScore) return a.fitScore - b.fitScore
        if (a.gap !== b.gap) return b.gap - a.gap
        if (a.depth !== b.depth) return a.depth - b.depth
        return String(a.player.name || '').localeCompare(String(b.player.name || ''))
      })

    const choice = candidates[0]
    if (!choice) return

    lineup.cells[choice.id][inning] = position
    usedPlayers.add(choice.id)
  })

  ;(players || []).forEach((player) => {
    const id = pk(player.id)
    if (!availableSet.has(id)) return
    if (usedPlayers.has(id)) return

    const rowLocked = lineup?.lockedRows?.[id] === true
    const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
    const current = lineup?.cells?.[id]?.[inning] || ''

    if (current === 'Injury') return
    if (!(rowLocked || cellLocked)) {
      lineup.cells[id][inning] = 'Out'
      usedPlayers.add(id)
    }
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
  const lineup = normalizeLineup(
    sourceLineup,
    players,
    Number(game?.innings || 6),
    availablePlayerIds
  )

  lineup.innings = Number(game?.innings || lineup?.innings || 6)
  lineup.availablePlayerIds = (availablePlayerIds || []).map(pk)

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
    availablePlayerIds: lineup.availablePlayerIds,
    totalsBefore: rollingTotals,
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

      current.games = Number(current.games || 0)
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
