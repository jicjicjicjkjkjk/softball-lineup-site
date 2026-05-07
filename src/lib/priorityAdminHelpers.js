// FILE: src/lib/priorityAdminHelpers.js

import { pk, PRIORITY_POSITIONS } from './lineupUtils'
import { sortRows } from './appHelpers'

export function buildActivePriorityRows({
  activePlayers,
  priorityByPlayer,
  prioritySort,
}) {
  return sortRows(
    (activePlayers || []).map((player) => {
      const pr = priorityByPlayer?.[pk(player.id)] || {}

      return {
        playerId: pk(player.id),
        name: player.name,
        jersey_number: player.jersey_number || '',
        P: pr.P?.priority_pct || '',
        C: pr.C?.priority_pct || '',
        '1B': pr['1B']?.priority_pct || '',
        '2B': pr['2B']?.priority_pct || '',
        '3B': pr['3B']?.priority_pct || '',
        SS: pr.SS?.priority_pct || '',
        OF: pr.OF?.priority_pct || '',
        subtotal: PRIORITY_POSITIONS.reduce(
          (sum, pos) => sum + Number(pr[pos]?.priority_pct || 0),
          0
        ),
      }
    }),
    prioritySort
  )
}

export function buildAllowedRows({
  activePlayers,
  fitByPlayer,
  allowedSort,
}) {
  return sortRows(
    (activePlayers || []).map((player) => {
      const fit = fitByPlayer?.[pk(player.id)] || {}

      return {
        playerId: pk(player.id),
        name: player.name,
        jersey_number: player.jersey_number || '',
        P: fit.P || '',
        C: fit.C || '',
        '1B': fit['1B'] || '',
        '2B': fit['2B'] || '',
        '3B': fit['3B'] || '',
        SS: fit.SS || '',
        LF: fit.LF || '',
        CF: fit.CF || '',
        RF: fit.RF || '',
      }
    }),
    allowedSort
  )
}

export function buildPriorityFooter(activePriorityRows) {
  const footer = {}

  PRIORITY_POSITIONS.forEach((pos) => {
    footer[pos] = (activePriorityRows || []).reduce(
      (sum, row) => sum + Number(row[pos] || 0),
      0
    )
  })

  footer.subtotal = PRIORITY_POSITIONS.reduce(
    (sum, pos) => sum + Number(footer[pos] || 0),
    0
  )

  return footer
}

export function updatePriorityMapLocal({
  current,
  playerId,
  position,
  value,
}) {
  return {
    ...current,
    [pk(playerId)]: {
      ...(current?.[pk(playerId)] || {}),
      [position]: { priority_pct: value },
    },
  }
}

export function updateFitMapLocal({
  current,
  playerId,
  position,
  tier,
}) {
  return {
    ...current,
    [pk(playerId)]: {
      ...(current?.[pk(playerId)] || {}),
      [position]: tier,
    },
  }
}

export function updateOutfieldFitLocal({
  current,
  playerId,
  tier,
}) {
  return {
    ...current,
    [pk(playerId)]: {
      ...(current?.[pk(playerId)] || {}),
      LF: tier,
      CF: tier,
      RF: tier,
    },
  }
}
