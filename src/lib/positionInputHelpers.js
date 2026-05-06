import { pk } from './lineupUtils'

export function buildPriorityMap(rows = []) {
  const next = {}

  rows.forEach((row) => {
    const playerId = pk(row.player_id)
    if (!next[playerId]) next[playerId] = {}

    next[playerId][row.position] = {
      priority_pct: row.priority_pct ?? '',
    }
  })

  return next
}

export function buildFitMap(rows = []) {
  const next = {}

  rows.forEach((row) => {
    const playerId = pk(row.player_id)
    if (!next[playerId]) next[playerId] = {}

    next[playerId][row.position] = row.fit_tier || 'no'
  })

  return next
}

export function getPriorityNumber(priorityByPlayer, playerId, position) {
  return Number(priorityByPlayer?.[pk(playerId)]?.[position]?.priority_pct || 0)
}

export function normalizePriorityValue(value) {
  const cleaned = String(value ?? '').trim()
  if (!cleaned) return ''
  const n = Number(cleaned)
  return Number.isNaN(n) ? '' : n
}
