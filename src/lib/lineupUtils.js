
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
    const idKey = pk(id)
    cells[idKey] = {}
    battingOrder[idKey] = ''
    lockedCells[idKey] = {}
    lockedRows[idKey] = false

    for (let inning = 1; inning <= innings; inning += 1) {
      cells[idKey][inning] = ''
      lockedCells[idKey][inning] = false
    }
  })

  return {
    innings,
    availablePlayerIds: availablePlayerIds.map(pk),
    battingOrder,
    cells,
    lockedCells,
    lockedRows,
  }
}

export function normalizeLineup(lineup, players, inningsFallback = 6, availableFallback = []) {
  const playerIds = players.map((p) => p.id)

  const out = lineup
    ? JSON.parse(JSON.stringify(lineup))
    : blankLineup(playerIds, inningsFallback, availableFallback.length ? availableFallback : playerIds)

  out.innings = Number(out.innings || inningsFallback)
  out.availablePlayerIds = (out.availablePlayerIds || availableFallback || playerIds).map(pk)
  out.cells = out.cells || {}
  out.battingOrder = out.battingOrder || {}
  out.lockedCells = out.lockedCells || {}
  out.lockedRows = out.lockedRows || {}

  playerIds.forEach((id) => {
    const idKey = pk(id)
    if (!out.cells[idKey]) out.cells[idKey] = {}
    if (!out.lockedCells[idKey]) out.lockedCells[idKey] = {}
    if (out.battingOrder[idKey] === undefined) out.battingOrder[idKey] = ''
    if (out.lockedRows[idKey] === undefined) out.lockedRows[idKey] = false

    for (let inning = 1; inning <= out.innings; inning += 1) {
      if (out.cells[idKey][inning] === undefined) out.cells[idKey][inning] = ''
      if (out.lockedCells[idKey][inning] === undefined) out.lockedCells[idKey][inning] = false
    }
  })

  return out
}

export function rowSummary(lineup, playerId) {
  const result = { IF: 0, OF: 0, P: 0, C: 0, X: 0 }
  const row = lineup?.cells?.[playerId] || {}

  Object.values(row).forEach((value) => {
    if (['1B', '2B', '3B', 'SS'].includes(value)) result.IF += 1
    if (['LF', 'CF', 'RF'].includes(value)) result.OF += 1
    if (value === 'P') result.P += 1
    if (value === 'C') result.C += 1
    if (value === 'Out') result.X += 1
  })

  return result
}

export function positionCountsForInning(lineup, inning, availableIds) {
  const counts = {}
  FIELD_POSITIONS.forEach((pos) => {
    counts[pos] = []
  })

  availableIds.forEach((id) => {
    const value = lineup.cells?.[id]?.[inning] || ''
    if (FIELD_POSITIONS.includes(value)) counts[value].push(id)
  })

  return counts
}

export function inningStatus(lineup, inning, players, fitMap) {
  const availableIds = (lineup.availablePlayerIds || []).map(pk)
  const counts = positionCountsForInning(lineup, inning, availableIds)

  const missing = FIELD_POSITIONS.filter((pos) => counts[pos].length === 0)
  const duplicate = FIELD_POSITIONS.filter((pos) => counts[pos].length > 1)

  const badFits = []
  availableIds.forEach((id) => {
    const value = lineup.cells?.[id]?.[inning] || ''
    if (!FIELD_POSITIONS.includes(value)) return
    if (fitTier(fitMap, id, value) === 'no') {
      const player = players.find((p) => pk(p.id) === id)
      badFits.push(`${player?.name || id} @ ${value}`)
    }
  })

  return { missing, duplicate, badFits }
}

export function computeTotals(lineups, players) {
  const totals = {}

  players.forEach((player) => {
    totals[pk(player.id)] = {
      playerId: pk(player.id),
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

  lineups.forEach((lineup) => {
    if (!lineup) return
    const availableIds = (lineup.availablePlayerIds || []).map(pk)

    availableIds.forEach((id) => {
      if (totals[id]) totals[id].games += 1
    })

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      const eligible = availableIds.filter((playerId) => {
        const value = lineup.cells?.[playerId]?.[inning] || ''
        return value !== 'Injury'
      })

      const expected = eligible.length ? Math.max(0, eligible.length - 9) / eligible.length : 0

      availableIds.forEach((playerId) => {
        const value = lineup.cells?.[playerId]?.[inning] || ''
        const row = totals[playerId]
        if (!row) return

        if (value === 'Injury') {
          row.Injury += 1
          return
        }

        if (eligible.includes(playerId)) row.expectedOuts += expected
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
  const merged = {}
  players.forEach((player) => {
    const id = pk(player.id)
    merged[id] = {
      playerId: id,
      name: player.name,
      jersey_number: player.jersey_number || '',
      games: (a[id]?.games || 0) + (b[id]?.games || 0),
      P: (a[id]?.P || 0) + (b[id]?.P || 0),
      C: (a[id]?.C || 0) + (b[id]?.C || 0),
      '1B': (a[id]?.['1B'] || 0) + (b[id]?.['1B'] || 0),
      '2B': (a[id]?.['2B'] || 0) + (b[id]?.['2B'] || 0),
      '3B': (a[id]?.['3B'] || 0) + (b[id]?.['3B'] || 0),
      SS: (a[id]?.SS || 0) + (b[id]?.SS || 0),
      LF: (a[id]?.LF || 0) + (b[id]?.LF || 0),
      CF: (a[id]?.CF || 0) + (b[id]?.CF || 0),
      RF: (a[id]?.RF || 0) + (b[id]?.RF || 0),
      IF: (a[id]?.IF || 0) + (b[id]?.IF || 0),
      OF: (a[id]?.OF || 0) + (b[id]?.OF || 0),
      Out: (a[id]?.Out || 0) + (b[id]?.Out || 0),
      Injury: (a[id]?.Injury || 0) + (b[id]?.Injury || 0),
      fieldTotal: (a[id]?.fieldTotal || 0) + (b[id]?.fieldTotal || 0),
      expectedOuts: Number(((a[id]?.expectedOuts || 0) + (b[id]?.expectedOuts || 0)).toFixed(2)),
      actualOuts: (a[id]?.actualOuts || 0) + (b[id]?.actualOuts || 0),
      delta: Number(((a[id]?.delta || 0) + (b[id]?.delta || 0)).toFixed(2)),
    }
  })
  return merged
}

export function priorityValue(priorityMap, playerId, position) {
  const id = pk(playerId)
  if (['LF', 'CF', 'RF'].includes(position)) {
    return Number(priorityMap[id]?.OF?.priority_pct || 0)
  }
  return Number(priorityMap[id]?.[position]?.priority_pct || 0)
}

export function fitTier(fitMap, playerId, position) {
  const id = pk(playerId)
  return fitMap[id]?.[position] || 'secondary'
}

function fitRank(tier) {
  if (tier === 'primary') return 0
  if (tier === 'secondary') return 1
  return 2
}

function sitCountSoFar(lineup, playerId, throughInning) {
  let count = 0
  for (let i = 1; i <= throughInning; i += 1) {
    if (lineup.cells?.[playerId]?.[i] === 'Out') count += 1
  }
  return count
}

function sitOutDistance(lineup, playerId, inning) {
  let last = null
  for (let prev = inning - 1; prev >= 1; prev -= 1) {
    const value = lineup.cells?.[playerId]?.[prev] || ''
    if (value === 'Out') {
      last = prev
      break
    }
  }
  if (last === null) return 999
  return inning - last
}

function isSitAllowed(lineup, playerId, inning) {
  const distance = sitOutDistance(lineup, playerId, inning)
  return distance >= 3 || distance === 999
}

function rollingPositionPct(rolling, playerId, position) {
  const id = pk(playerId)
  const row = rolling[id] || {}
  const fieldTotal = Math.max(row.fieldTotal || 0, 1)

  if (['LF', 'CF', 'RF'].includes(position)) {
    return ((row.OF || 0) / fieldTotal) * 100
  }

  return ((row[position] || 0) / fieldTotal) * 100
}

export function buildOptimizedLineup({
  game,
  players,
  availableIds,
  sourceLineup,
  totalsBefore,
  priorityByPlayer,
  fitByPlayer,
}) {
  const lineup = normalizeLineup(sourceLineup, players, Number(game.innings || 6), availableIds)
  lineup.innings = Number(game.innings || 6)
  lineup.availablePlayerIds = availableIds.map(pk)

  const rolling = JSON.parse(JSON.stringify(totalsBefore))

  players.forEach((player) => {
    const id = pk(player.id)
    if (!lineup.availablePlayerIds.includes(id)) return

    if (!lineup.cells[id]) lineup.cells[id] = {}
    if (!lineup.lockedCells[id]) lineup.lockedCells[id] = {}
    if (lineup.lockedRows[id] === undefined) lineup.lockedRows[id] = false

    for (let inning = 1; inning <= lineup.innings; inning += 1) {
      const rowLocked = lineup.lockedRows?.[id] || false
      const cellLocked = lineup.lockedCells?.[id]?.[inning] || false
      if (!rowLocked && !cellLocked) {
        lineup.cells[id][inning] = ''
      }
    }
  })

  for (let inning = 1; inning <= lineup.innings; inning += 1) {
    const used = new Set()
    const lockedOut = []

    players.forEach((player) => {
      const id = pk(player.id)
      if (!lineup.availablePlayerIds.includes(id)) return
      const value = lineup.cells?.[id]?.[inning] || ''
      const locked = lineup.lockedRows?.[id] || lineup.lockedCells?.[id]?.[inning] || false
      if (!locked || !value) return

      used.add(id)
      if (value === 'Out') lockedOut.push(id)
    })

    const neededSitTotal = Math.max(0, lineup.availablePlayerIds.length - 9)
    const remainingSittersNeeded = Math.max(0, neededSitTotal - lockedOut.length)

    const sitCandidates = players
      .filter((player) => lineup.availablePlayerIds.includes(pk(player.id)))
      .filter((player) => !used.has(pk(player.id)))
      .filter((player) => isSitAllowed(lineup, pk(player.id), inning))
      .sort((a, b) => {
        const aId = pk(a.id)
        const bId = pk(b.id)

        const aCurrentSit = sitCountSoFar(lineup, aId, inning - 1)
        const bCurrentSit = sitCountSoFar(lineup, bId, inning - 1)
        if (aCurrentSit !== bCurrentSit) return aCurrentSit - bCurrentSit

        const aDelta = rolling[aId]?.delta || 0
        const bDelta = rolling[bId]?.delta || 0
        if (aDelta !== bDelta) return aDelta - bDelta

        return String(a.name || '').localeCompare(String(b.name || ''))
      })

    const sitters = sitCandidates.slice(0, remainingSittersNeeded)
    sitters.forEach((player) => {
      const id = pk(player.id)
      lineup.cells[id][inning] = 'Out'
      used.add(id)
    })

    const openPositions = [...FIELD_POSITIONS]

    players.forEach((player) => {
      const id = pk(player.id)
      const value = lineup.cells?.[id]?.[inning] || ''
      if (openPositions.includes(value)) {
        const idx = openPositions.indexOf(value)
        openPositions.splice(idx, 1)
      }
    })

    openPositions.forEach((position) => {
      const candidates = players
        .filter((player) => lineup.availablePlayerIds.includes(pk(player.id)))
        .filter((player) => !used.has(pk(player.id)))
        .filter((player) => fitTier(fitByPlayer, player.id, position) !== 'no')
        .sort((a, b) => {
          const aId = pk(a.id)
          const bId = pk(b.id)

          const fitDiff =
            fitRank(fitTier(fitByPlayer, a.id, position)) -
            fitRank(fitTier(fitByPlayer, b.id, position))
          if (fitDiff !== 0) return fitDiff

          const aTarget = priorityValue(priorityByPlayer, a.id, position)
          const bTarget = priorityValue(priorityByPlayer, b.id, position)

          const aGap = aTarget - rollingPositionPct(rolling, a.id, position)
          const bGap = bTarget - rollingPositionPct(rolling, b.id, position)
          if (aGap !== bGap) return bGap - aGap

          const aDelta = rolling[aId]?.delta || 0
          const bDelta = rolling[bId]?.delta || 0
          if (aDelta !== bDelta) return bDelta - aDelta

          return String(a.name || '').localeCompare(String(b.name || ''))
        })

      const selected = candidates[0]
      if (!selected) return

      const id = pk(selected.id)
      lineup.cells[id][inning] = position
      used.add(id)
    })

    lineup.availablePlayerIds.forEach((id) => {
      if (!used.has(id)) {
        lineup.cells[id][inning] = 'Out'
        used.add(id)
      }
    })

    const inningTotals = computeTotals(
      [
        {
          innings: 1,
          availablePlayerIds: lineup.availablePlayerIds,
          cells: Object.fromEntries(
            lineup.availablePlayerIds.map((id) => [
              id,
              { 1: lineup.cells[id]?.[inning] || '' },
            ])
          ),
        },
      ],
      players
    )

    Object.keys(rolling).forEach((id) => {
      const current = rolling[id]
      const add = inningTotals[id]
      if (!current || !add) return

      current.games += add.games
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
