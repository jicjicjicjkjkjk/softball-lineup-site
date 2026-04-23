// =========================
// CONSTANTS
// =========================
export const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
export const GRID_OPTIONS = ['', ...FIELD_POSITIONS, 'Out', 'Injury']
export const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']
export const ALLOWED_POSITIONS = FIELD_POSITIONS
export const GAME_TYPES = ['Friendly', 'Tournament', 'League']

export function pk(id) {
  return String(id)
}

// =========================
// LINEUP BUILDERS
// =========================
export function blankLineup(playerIds, innings = 6, availablePlayerIds = playerIds) {
  const cells = {}
  const lockedCells = {}
  const lockedRows = {}
  const lockedInnings = {}
  const battingOrder = {}

  playerIds.forEach((id) => {
    const key = pk(id)
    cells[key] = {}
    lockedCells[key] = {}
    lockedRows[key] = false
    battingOrder[key] = ''

    for (let i = 1; i <= innings; i++) {
      cells[key][i] = ''
      lockedCells[key][i] = false
      lockedInnings[i] = false
    }
  })

  return {
    innings,
    availablePlayerIds: availablePlayerIds.map(pk),
    cells,
    lockedCells,
    lockedRows,
    lockedInnings,
    battingOrder,
  }
}

export function normalizeLineup(lineup, players, inningsFallback = 6, availableFallback = []) {
  const playerIds = players.map((p) => pk(p.id))
  const out = JSON.parse(JSON.stringify(lineup || {}))

  out.innings = Number(out.innings || inningsFallback)
  out.availablePlayerIds = (out.availablePlayerIds || availableFallback || playerIds).map(pk)
  out.cells = out.cells || {}
  out.lockedCells = out.lockedCells || {}
  out.lockedRows = out.lockedRows || {}
  out.lockedInnings = out.lockedInnings || {}
  out.battingOrder = out.battingOrder || {}

  playerIds.forEach((id) => {
    if (!out.cells[id]) out.cells[id] = {}
    if (!out.lockedCells[id]) out.lockedCells[id] = {}

    for (let i = 1; i <= out.innings; i++) {
      if (out.cells[id][i] === undefined) out.cells[id][i] = ''
      if (out.lockedCells[id][i] === undefined) out.lockedCells[id][i] = false
      if (out.lockedInnings[i] === undefined) out.lockedInnings[i] = false
    }
  })

  return out
}

// =========================
// TOTALS
// =========================
export function computeTotals(lineups, players) {
  const totals = {}

  players.forEach((p) => {
    const id = pk(p.id)
    totals[id] = {
      playerId: id,
      name: p.name,
      games: 0,
      fieldTotal: 0,
      Out: 0,
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
    }
  })

  lineups.forEach((lineup) => {
    const ids = (lineup.availablePlayerIds || []).map(pk)

    ids.forEach((id) => {
      totals[id].games += 1

      for (let i = 1; i <= lineup.innings; i++) {
        const val = lineup.cells?.[id]?.[i]

        if (val === 'Out') totals[id].Out += 1
        if (FIELD_POSITIONS.includes(val)) {
          totals[id][val] += 1
          totals[id].fieldTotal += 1
        }
      }
    })
  })

  return totals
}

// =========================
// HELPERS
// =========================
function isLocked(lineup, playerId, inning) {
  return (
    lineup.lockedInnings?.[inning] ||
    lineup.lockedRows?.[playerId] ||
    lineup.lockedCells?.[playerId]?.[inning]
  )
}

function spacingPenalty(lineup, playerId, inning, planned) {
  for (let i = inning - 1; i >= 1; i--) {
    if (planned[playerId]?.has(i) || lineup.cells?.[playerId]?.[i] === 'Out') {
      const gap = inning - i
      if (gap <= 1) return 999999
      if (gap === 2) return 50000
      if (gap === 3) return 10000
      break
    }
  }
  return 0
}

// =========================
// SIT PLAN
// =========================
function buildSitPlan({
  lineup,
  players,
  totalsBefore,
  planTargets = {},
}) {
  const planned = {}
  players.forEach((p) => (planned[pk(p.id)] = new Set()))

  const currentOuts = {}
  players.forEach((p) => {
    const id = pk(p.id)
    currentOuts[id] = totalsBefore?.[id]?.Out || 0
  })

  for (let inning = 1; inning <= lineup.innings; inning++) {
    if (lineup.lockedInnings?.[inning]) continue

    const available = lineup.availablePlayerIds.map(pk)
    const outsNeeded = Math.max(0, available.length - 9)

    const candidates = available.filter(
      (id) => !isLocked(lineup, id, inning)
    )

    const ranked = candidates
      .map((id) => {
        const target = planTargets[id]
        const current = currentOuts[id]
        const gap = target != null ? target - current : 0

        return {
          id,
          gap,
          spacing: spacingPenalty(lineup, id, inning, planned),
          current,
        }
      })
      .sort((a, b) => {
        if (a.gap !== b.gap) return b.gap - a.gap
        if (a.spacing !== b.spacing) return a.spacing - b.spacing
        return a.current - b.current
      })

    for (let i = 0; i < outsNeeded; i++) {
      const pick = ranked[i]
      if (!pick) continue

      planned[pick.id].add(inning)
      currentOuts[pick.id] += 1
    }
  }

  return planned
}

// =========================
// POSITION ASSIGNMENT
// =========================
function assignPositions({
  lineup,
  players,
  plannedOuts,
}) {
  for (let inning = 1; inning <= lineup.innings; inning++) {
    if (lineup.lockedInnings?.[inning]) continue

    const available = lineup.availablePlayerIds.map(pk)

    const sitters = new Set(
      available.filter((id) => plannedOuts[id]?.has(inning))
    )

    const fielders = available.filter((id) => !sitters.has(id))

    const positions = [...FIELD_POSITIONS]

    fielders.forEach((id, idx) => {
      if (!isLocked(lineup, id, inning)) {
        lineup.cells[id][inning] = positions[idx] || 'Out'
      }
    })

    sitters.forEach((id) => {
      if (!isLocked(lineup, id, inning)) {
        lineup.cells[id][inning] = 'Out'
      }
    })
  }
}

// =========================
// MAIN OPTIMIZER
// =========================
export function buildOptimizedLineup({
  game,
  players,
  availablePlayerIds,
  sourceLineup,
  totalsBefore,
  planSitOutTargets = {},
}) {
  const lineup = normalizeLineup(
    sourceLineup,
    players,
    game.innings || 6,
    availablePlayerIds
  )

  const planned = buildSitPlan({
    lineup,
    players,
    totalsBefore,
    planTargets: planSitOutTargets,
  })

  assignPositions({
    lineup,
    players,
    plannedOuts: planned,
  })

  return lineup
}
