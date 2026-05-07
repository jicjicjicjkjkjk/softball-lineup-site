// src/lib/lineupTotals.js

import { FIELD_POSITIONS } from './lineupConstants'
import { pk } from './lineupCore'

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
      const eligibleIds = availableIds.filter((id) => {
        const value = lineup.cells?.[id]?.[inning] || ''
        return value !== 'Injury'
      })

      const requiredSits = Math.max(0, eligibleIds.length - 9)
      const expectedPerAvailablePlayer = availableIds.length
        ? requiredSits / availableIds.length
        : 0

      availableIds.forEach((id) => {
        const row = totals[id]
        if (!row) return

        if (!countedGameForPlayer.has(id)) {
          row.games += 1
          countedGameForPlayer.add(id)
        }

        const value = lineup.cells?.[id]?.[inning] || ''
        row.expectedOuts += expectedPerAvailablePlayer

        if (value === 'Injury') {
          row.Injury += 1
          return
        }

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

export function playerGameTrackingRows(
  games,
  lineupsByGame,
  lineupLockedByGame,
  playerId,
  gameTypeFilter = 'All'
) {
  return (games || [])
    .filter((game) => {
      if (gameTypeFilter !== 'All' && game.game_type !== gameTypeFilter) return false
      return Boolean(lineupsByGame?.[pk(game.id)])
    })
    .sort((a, b) => {
      const aKey = `${a.date || ''}-${String(a.game_order || '').padStart(3, '0')}`
      const bKey = `${b.date || ''}-${String(b.game_order || '').padStart(3, '0')}`
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

        const eligible = available.filter(
          (pid) => (lineup?.cells?.[pid]?.[inning] || '') !== 'Injury'
        )
        const expected = available.length
          ? Math.max(0, eligible.length - 9) / available.length
          : 0

        if (inGame) expectedOuts += expected
        if (value === 'Out') sitOuts += 1
      }

      return {
        gameId: pk(game.id),
        date: game.date || '',
        opponent: game.opponent || '',
        type: game.game_type || '',
        order: game.game_order || '',
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
