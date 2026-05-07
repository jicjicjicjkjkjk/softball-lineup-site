// src/lib/lineupCore.js

export function pk(id) {
  return String(id)
}

export function clone(obj) {
  return JSON.parse(JSON.stringify(obj || {}))
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

export function lockedValue(lineup, playerId, inning) {
  const id = pk(playerId)
  const rowLocked = lineup?.lockedRows?.[id] === true
  const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
  const inningLocked = lineup?.lockedInnings?.[inning] === true
  return rowLocked || cellLocked || inningLocked
}

export function setAllBattingLocks(lineup, value) {
  const next = clone(lineup)
  Object.keys(next.battingOrder || {}).forEach((id) => {
    next.lockedBattingOrder[id] = value
  })
  return next
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

export function formatDateMMDDYY(dateStr) {
  if (!dateStr) return ''
  const d = new Date(`${dateStr}T00:00:00`)
  if (Number.isNaN(d.getTime())) return dateStr
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const yy = String(d.getFullYear()).slice(-2)
  return `${mm}/${dd}/${yy}`
}
