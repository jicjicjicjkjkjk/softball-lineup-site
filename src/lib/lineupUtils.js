// lineupUtils.js

export function pk(id) {
  return String(id)
}

const POSITIONS = ['P','C','1B','2B','3B','SS','LF','CF','RF']
const OF_POS = ['LF','CF','RF']

// =============================
// HELPERS
// =============================

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

function getAllLineups(games, preview, saved, blankLineup, players, activeIds) {
  return games.map(g =>
    preview[pk(g.id)] ||
    saved[pk(g.id)] ||
    blankLineup(players.map(p => p.id), Number(g.innings || 6), activeIds())
  )
}

function countOuts(lineup, playerId) {
  let total = 0
  for (let i = 1; i <= lineup.innings; i++) {
    if (lineup.cells?.[playerId]?.[i] === 'Out') total++
  }
  return total
}

// =============================
// SIT-OUT PLANNING (PLAN-WIDE)
// =============================

function buildSitPlan(lineups, players, targets) {
  const remaining = {}
  const playerIds = players.map(p => pk(p.id))

  // Initialize targets
  playerIds.forEach(id => {
    const t = targets?.[id]
    remaining[id] = t !== '' && t != null ? Number(t) : 0
  })

  // Auto-balance players without targets
  const noTargetPlayers = playerIds.filter(id => targets?.[id] == null || targets?.[id] === '')
  if (noTargetPlayers.length) {
    let totalOuts = 0
    lineups.forEach(l => {
      const extra = Math.max((l.availablePlayerIds?.length || 0) - 9, 0)
      totalOuts += extra * l.innings
    })
    const avg = totalOuts / playerIds.length

    noTargetPlayers.forEach(id => {
      remaining[id] = avg
    })
  }

  return remaining
}

// =============================
// POSITION SCORING (PLAN-AWARE)
// =============================

function scorePosition({
  playerId,
  pos,
  totals,
  priorities,
  fit,
  remainingOpportunities
}) {
  const p = priorities[playerId] || {}
  const t = totals[playerId] || {}

  const target = p[pos] ?? p['OF'] ?? 0
  const actual = t[pos] || 0
  const total = t.fieldTotal || 1

  const actualPct = actual / total
  const gap = target - actualPct

  const remaining = remainingOpportunities[pos] || 1

  let score = 0

  // 🔥 CORE: prioritize deficit * remaining opportunity
  score += gap * 100
  score += gap * remaining * 20

  // Fit weighting
  if (fit === 'A') score += 50
  else if (fit === 'B') score += 25
  else if (fit === 'C') score += 5
  else if (fit === 'D') score -= 25
  else if (fit === 'E') score -= 200

  // discourage overload
  score -= actual * 2

  return score
}

// =============================
// ASSIGN POSITIONS (NON-GREEDY)
// =============================

function assignInning({
  inning,
  lineup,
  players,
  totals,
  priorities,
  fitByPlayer,
  remainingOpportunities
}) {
  const assigned = {}
  const used = new Set()

  const playerIds = lineup.availablePlayerIds.map(pk)

  const candidates = []

  playerIds.forEach(playerId => {
    POSITIONS.forEach(pos => {
      const fit = fitByPlayer[playerId]?.[pos] || 'C'
      if (fit === 'E') return

      candidates.push({
        playerId,
        pos,
        score: scorePosition({
          playerId,
          pos,
          totals,
          priorities,
          fit,
          remainingOpportunities
        })
      })
    })
  })

  // Sort globally (not per position)
  candidates.sort((a, b) => b.score - a.score)

  const takenPos = new Set()

  for (const c of candidates) {
    if (used.has(c.playerId)) continue
    if (takenPos.has(c.pos)) continue

    assigned[c.playerId] = c.pos
    used.add(c.playerId)
    takenPos.add(c.pos)

    if (takenPos.size === 9) break
  }

  return assigned
}

// =============================
// MAIN OPTIMIZER
// =============================

export function optimizePlan({
  games,
  preview,
  saved,
  blankLineup,
  players,
  activePlayerIds,
  priorities,
  fitByPlayer,
  sitOutTargets
}) {
  const lineups = getAllLineups(games, preview, saved, blankLineup, players, activePlayerIds)

  const totals = {}
  players.forEach(p => {
    totals[pk(p.id)] = {
      fieldTotal: 0,
      Out: 0
    }
  })

  const sitPlan = buildSitPlan(lineups, players, sitOutTargets)

  const remainingOpportunities = {}
  POSITIONS.forEach(p => remainingOpportunities[p] = 0)

  lineups.forEach(l => {
    l.innings && POSITIONS.forEach(p => {
      remainingOpportunities[p] += l.innings
    })
  })

  const result = {}

  lineups.forEach((lineup, gi) => {
    const gameId = pk(games[gi].id)
    const next = clone(lineup)

    for (let inning = 1; inning <= next.innings; inning++) {
      const playersAvailable = next.availablePlayerIds.map(pk)

      // Determine sit-outs
      const outsNeeded = Math.max(playersAvailable.length - 9, 0)

      const sitCandidates = [...playersAvailable]
        .sort((a, b) => (sitPlan[b] || 0) - (sitPlan[a] || 0))

      const sitThisInning = sitCandidates.slice(0, outsNeeded)

      sitThisInning.forEach(id => {
        next.cells[id][inning] = 'Out'
        sitPlan[id] = (sitPlan[id] || 0) - 1
        totals[id].Out += 1
      })

      const fieldPlayers = playersAvailable.filter(p => !sitThisInning.includes(p))

      const assigned = assignInning({
        inning,
        lineup: { ...next, availablePlayerIds: fieldPlayers },
        players,
        totals,
        priorities,
        fitByPlayer,
        remainingOpportunities
      })

      fieldPlayers.forEach(pid => {
        const pos = assigned[pid] || 'LF'
        next.cells[pid][inning] = pos

        totals[pid][pos] = (totals[pid][pos] || 0) + 1
        totals[pid].fieldTotal += 1
      })
    }

    result[gameId] = next
  })

  return result
}
