// =============================
// CONSTANTS (REQUIRED EXPORTS)
// =============================

export const FIELD_POSITIONS = ['P','C','1B','2B','3B','SS','LF','CF','RF']
export const PRIORITY_POSITIONS = ['P','C','1B','2B','3B','SS','OF']
export const ALLOWED_POSITIONS = [...FIELD_POSITIONS]
export const GAME_TYPES = ['Friendly','Tournament','League','Scrimmage']

// =============================
// BASIC HELPERS
// =============================

export function pk(id) {
  return String(id)
}

function clone(obj) {
  return JSON.parse(JSON.stringify(obj))
}

// =============================
// LINEUP HELPERS (REQUIRED)
// =============================

export function blankLineup(playerIds, innings, availableIds) {
  const cells = {}
  playerIds.forEach(id => {
    cells[pk(id)] = {}
    for (let i = 1; i <= innings; i++) {
      cells[pk(id)][i] = ''
    }
  })

  return {
    innings,
    cells,
    availablePlayerIds: availableIds.map(pk)
  }
}

export function normalizeLineup(l) {
  return l
}

export function requiredOutsForGame(playerCount, innings) {
  return Math.max(playerCount - 9, 0) * innings
}

// =============================
// TOTALS
// =============================

export function computeTotals(lineups, players) {
  const totals = {}

  players.forEach(p => {
    totals[pk(p.id)] = {
      fieldTotal: 0,
      Out: 0
    }
  })

  lineups.forEach(l => {
    for (let i = 1; i <= l.innings; i++) {
      Object.keys(l.cells || {}).forEach(pid => {
        const val = l.cells[pid]?.[i]
        if (val === 'Out') {
          totals[pid].Out++
        } else if (FIELD_POSITIONS.includes(val)) {
          totals[pid][val] = (totals[pid][val] || 0) + 1
          totals[pid].fieldTotal++
        }
      })
    }
  })

  return totals
}

export function addTotals(a, b) {
  const result = clone(a)
  Object.keys(b).forEach(pid => {
    result[pid] = result[pid] || {}
    Object.keys(b[pid]).forEach(k => {
      result[pid][k] = (result[pid][k] || 0) + b[pid][k]
    })
  })
  return result
}

// =============================
// INNING STATUS (MINIMAL SAFE)
// =============================

export function inningStatus() {
  return {}
}

// =============================
// FIT SCORING
// =============================

function fitScore(fit) {
  if (fit === 'A') return 100
  if (fit === 'B') return 60
  if (fit === 'C') return 25
  if (fit === 'D') return -40
  if (fit === 'E') return -999
  return 0
}

// =============================
// SIT-OUT FAIRNESS
// =============================

function pickSitOutsFair({
  playerIds,
  currentGameOuts,
  totalPlanOuts,
  outsNeeded
}) {
  const sorted = [...playerIds].sort((a, b) => {
    // PRIORITY 1: fewer total outs first
    if (totalPlanOuts[a] !== totalPlanOuts[b]) {
      return totalPlanOuts[a] - totalPlanOuts[b]
    }

    // PRIORITY 2: fewer outs THIS GAME
    return currentGameOuts[a] - currentGameOuts[b]
  })

  return sorted.slice(0, outsNeeded)
}

// =============================
// POSITION SCORING (TGT-BASED)
// =============================

function scorePosition({
  playerId,
  pos,
  priorities,
  fitByPlayer,
  totals
}) {
  const target = priorities[playerId]?.[pos] ??
    (pos === 'LF' || pos === 'CF' || pos === 'RF'
      ? priorities[playerId]?.['OF']
      : 0) ?? 0

  const actual = totals[playerId]?.[pos] || 0

  const gap = target - actual

  let score = 0

  // 🔥 KEY CHANGE: pure target gap, not % based
  score += gap * 100

  // discourage overload
  score -= actual * 10

  // fit weighting
  score += fitScore(fitByPlayer[playerId]?.[pos])

  return score
}

// =============================
// ASSIGN POSITIONS (GLOBAL BEST)
// =============================

function assignPositions({
  playerIds,
  priorities,
  fitByPlayer,
  totals
}) {
  const assignments = {}
  const usedPlayers = new Set()
  const usedPositions = new Set()

  const candidates = []

  playerIds.forEach(pid => {
    FIELD_POSITIONS.forEach(pos => {
      const fit = fitByPlayer[pid]?.[pos]
      if (fit === 'E') return

      candidates.push({
        pid,
        pos,
        score: scorePosition({
          playerId: pid,
          pos,
          priorities,
          fitByPlayer,
          totals
        })
      })
    })
  })

  candidates.sort((a, b) => b.score - a.score)

  for (const c of candidates) {
    if (usedPlayers.has(c.pid)) continue
    if (usedPositions.has(c.pos)) continue

    assignments[c.pid] = c.pos
    usedPlayers.add(c.pid)
    usedPositions.add(c.pos)

    if (usedPositions.size === 9) break
  }

  return assignments
}

// =============================
// MAIN OPTIMIZER (FIXED)
// =============================

export function buildOptimizedLineup({
  games,
  preview,
  saved,
  blankLineup,
  players,
  activePlayerIds,
  priorities,
  fitByPlayer
}) {
  const playerIds = players.map(p => pk(p.id))

  const totalPlanOuts = {}
  playerIds.forEach(id => totalPlanOuts[id] = 0)

  const result = {}

  games.forEach(game => {
    const gameId = pk(game.id)

    const lineup =
      preview?.[gameId] ||
      saved?.[gameId] ||
      blankLineup(
        playerIds,
        Number(game.innings || 6),
        activePlayerIds()
      )

    const next = clone(lineup)

    const currentGameOuts = {}
    playerIds.forEach(id => currentGameOuts[id] = 0)

    for (let inning = 1; inning <= next.innings; inning++) {
      const available = next.availablePlayerIds.map(pk)
      const outsNeeded = Math.max(available.length - 9, 0)

      // =============================
      // SIT OUTS (STRICT FAIRNESS)
      // =============================

      const sitOuts = pickSitOutsFair({
        playerIds: available,
        currentGameOuts,
        totalPlanOuts,
        outsNeeded
      })

      sitOuts.forEach(pid => {
        next.cells[pid][inning] = 'Out'
        currentGameOuts[pid]++
        totalPlanOuts[pid]++
      })

      const fieldPlayers = available.filter(p => !sitOuts.includes(p))

      // =============================
      // POSITIONS (TARGET DRIVEN)
      // =============================

      const totalsSoFar = computeTotals([next], players)

      const assigned = assignPositions({
        playerIds: fieldPlayers,
        priorities,
        fitByPlayer,
        totals: totalsSoFar
      })

      fieldPlayers.forEach(pid => {
        next.cells[pid][inning] = assigned[pid] || 'LF'
      })
    }

    result[gameId] = next
  })

  return result
}
