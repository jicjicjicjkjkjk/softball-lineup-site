import { pk } from './lineupUtils'

export function buildBattingOrderMatrix(games, lineupsByGame, players) {
  const rows = players.map((p) => {
    const orders = []

    const perGame = games.map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      const value = lineup?.battingOrder?.[pk(p.id)] || ''
      if (value) orders.push(Number(value))
      return value
    })

    const avg =
      orders.length > 0
        ? (orders.reduce((a, b) => a + b, 0) / orders.length).toFixed(1)
        : ''

    return {
      playerId: pk(p.id),
      name: p.name,
      avg,
      perGame,
    }
  })

  return rows
}

export function buildSitOutSummary(games, lineupsByGame, players) {
  return games.map((game) => {
    const lineup = lineupsByGame[pk(game.id)]
    if (!lineup) return null

    const totalPlayers = lineup.availablePlayerIds.length
    const innings = lineup.innings

    let sitOuts = 0

    lineup.availablePlayerIds.forEach((pid) => {
      for (let i = 1; i <= innings; i++) {
        if (lineup.cells?.[pid]?.[i] === 'Out') sitOuts++
      }
    })

    return {
      gameId: pk(game.id),
      totalPlayers,
      innings,
      sitOuts,
      avgSit: totalPlayers ? (sitOuts / totalPlayers).toFixed(1) : 0,
    }
  }).filter(Boolean)
}

export function buildPlayerSitOuts(games, lineupsByGame, players) {
  return players.map((p) => {
    const perGame = games.map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      if (!lineup) return ''

      let count = 0
      for (let i = 1; i <= lineup.innings; i++) {
        if (lineup.cells?.[pk(p.id)]?.[i] === 'Out') count++
      }

      return count || ''
    })

    return {
      playerId: pk(p.id),
      name: p.name,
      perGame,
    }
  })
}

export function buildPositionByPlayer(games, lineupsByGame, playerId) {
  return games.map((game) => {
    const lineup = lineupsByGame[pk(game.id)]
    if (!lineup) return null

    const counts = {}

    for (let i = 1; i <= lineup.innings; i++) {
      const pos = lineup.cells?.[playerId]?.[i]
      if (!pos) continue
      counts[pos] = (counts[pos] || 0) + 1
    }

    return {
      gameId: pk(game.id),
      date: game.date,
      opponent: game.opponent,
      ...counts,
    }
  }).filter(Boolean)
}
