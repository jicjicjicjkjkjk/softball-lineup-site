// lineupUtils.js

export function pk(id) {
  return String(id)
}

const POSITIONS = ['P','C','1B','2B','3B','SS','LF','CF','RF']

// =============================
// HELPERS
// =============================

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

// =============================
// BUILD PLAN SIT QUOTAS (HARD CONSTRAINT)
// =============================

function buildPlanSitQuotas(lineups, players) {
  const playerIds = players.map(p => pk(p.id))

  let totalOuts = 0
  lineups.forEach(l => {
    const extra = Math.max((l.availablePlayerIds?.length || 0) - 9, 0)
    totalOuts += extra * l.innings
  })

  const base = Math.floor(totalOuts / playerIds.length)
  const remainder = totalOuts % playerIds.length

  const quotas = {}
  playerIds.forEach((id, i) => {
    quotas[id] = base + (i < remainder ? 1 : 0)
  })

  return quotas
}

// =============================
// BUILD GAME SIT QUOTAS
// =============================

function buildGameSitQuotas(lineup) {
  const players = lineup.availablePlayerIds.map(pk)
  const totalOuts = Math.max(players.length - 9, 0) * lineup.innings

  const base = Math.floor(totalOuts / players.length)
  const remainder = totalOuts % players.length

  const quotas = {}
  players.forEach((id, i) => {
    quotas[id] = base + (i < remainder ? 1 : 0)
  })

  return quotas
}

// =============================
// POSITION TARGET TOTALS (TGT-BASED)
// =============================

function buildPositionTargets(lineups, players, priorities) {
  const targets = {}

  players.forEach(p => {
    const id = pk(p.id)
    targets[id] = {}

    const totalInnings = lineups.reduce((sum, l) => sum + l.innings, 0)

    POSITIONS.forEach(pos => {
      const pct = priorities[id]?.[pos] ?? priorities[id]?.['OF'] ?? 0
      targets[id][pos] = pct * totalInnings
    })
  })

  return targets
}

// =============================
// POSITION SCORING (TGT-BASED)
// =============================

function scorePosition({
  playerId,
  pos,
  totals,
  targetTotals,
  fit
}) {
  const actual = totals[playerId]?.[pos] || 0
  const target = targetTotals[playerId]?.[pos] || 0

  const remainingNeed = target - actual

  let score = 0

  // 🔥 MAIN DRIVER: how far behind target total
  score += remainingNeed * 50

  // Fit weighting
  if (fit === 'A') score += 40
  else if (fit === 'B') score += 20
  else if (fit === 'C') score += 5
  else if (fit === 'D') score -= 30
  else if (fit === 'E') score -= 300

  return score
}

// =============================
// ASSIGN POSITIONS
// =============================

function assignInning({
  lineup,
  totals,
  targetTotals,
  fitByPlayer,
  fieldPlayers
}) {
  const assigned = {}
  const used = new Set()
  const takenPos = new Set()

  const candidates = []

  fieldPlayers.forEach(playerId => {
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
          targetTotals,
          fit
        })
      })
    })
  })

  candidates.sort((a, b) => b.score - a.score)

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
  fitByPlayer
}) {
  const lineups = games.map(g =>
    preview[pk(g.id)] ||
    saved[pk(g.id)] ||
    blankLineup(players.map(p => p.id), Number(g.innings || 6), activePlayerIds())
  )

  const totals = {}
  players.forEach(p => {
    totals[pk(p.id)] = { fieldTotal: 0, Out: 0 }
  })

  const planSitQuota = buildPlanSitQuotas(lineups, players)
  const targetTotals = buildPositionTargets(lineups, players, priorities)

  const result = {}

  lineups.forEach((lineup, gi) => {
    const gameId = pk(games[gi].id)
    const next = clone(lineup)

    const gameSitQuota = buildGameSitQuotas(next)
    const gameSitUsed = {}

    next.availablePlayerIds.forEach(id => {
      gameSitUsed[pk(id)] = 0
    })

    for (let inning = 1; inning <= next.innings; inning++) {
      const playersAvailable = next.availablePlayerIds.map(pk)
      const outsNeeded = Math.max(playersAvailable.length - 9, 0)

      // 🔥 SELECT SIT-OUTS WITH HARD LIMITS
      const sitCandidates = playersAvailable
        .filter(id => gameSitUsed[id] < gameSitQuota[id])
        .sort((a, b) => {
          const planRemainingA = planSitQuota[a] - totals[a].Out
          const planRemainingB = planSitQuota[b] - totals[b].Out
          return planRemainingB - planRemainingA
        })

      const sitThisInning = sitCandidates.slice(0, outsNeeded)

      sitThisInning.forEach(id => {
        next.cells[id][inning] = 'Out'
        totals[id].Out += 1
        gameSitUsed[id] += 1
      })

      const fieldPlayers = playersAvailable.filter(p => !sitThisInning.includes(p))

      const assigned = assignInning({
        lineup: next,
        totals,
        targetTotals,
        fitByPlayer,
        fieldPlayers
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
