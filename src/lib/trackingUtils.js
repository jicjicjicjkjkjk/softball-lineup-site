import { pk } from './lineupUtils'

function compareGamesAsc(a, b) {
  const aKey = `${a.date || ''}-${String(a.game_order || 999).padStart(3, '0')}-${pk(a.id)}`
  const bKey = `${b.date || ''}-${String(b.game_order || 999).padStart(3, '0')}-${pk(b.id)}`
  return aKey.localeCompare(bKey)
}

function getOrderedGames(games) {
  return [...(games || [])].sort(compareGamesAsc)
}

function getAvailableIds(lineup) {
  return (lineup?.availablePlayerIds || []).map((id) => pk(id))
}

export function buildBattingOrderMatrix(games, lineupsByGame, players) {
  const orderedGames = getOrderedGames(games)

  return players.map((p) => {
    const orders = []

    const perGame = orderedGames.map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      const availableIds = getAvailableIds(lineup)
      const isAvailable = availableIds.includes(pk(p.id))

      if (!lineup || !isAvailable) return ''

      const value = lineup?.battingOrder?.[pk(p.id)] || ''
      if (value !== '' && value !== null && value !== undefined) {
        orders.push(Number(value))
      }
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
}

export function buildSitOutSummary(games, lineupsByGame) {
  const orderedGames = getOrderedGames(games)

  return orderedGames
    .map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      if (!lineup) return null

      const availableIds = getAvailableIds(lineup)
      const totalPlayers = availableIds.length
      const innings = Number(lineup.innings || game.innings || 0)

      let sitOuts = 0
      let injuries = 0

      availableIds.forEach((pid) => {
        for (let i = 1; i <= innings; i += 1) {
          const value = lineup.cells?.[pid]?.[i]
          if (value === 'Out') sitOuts += 1
          if (value === 'Injury') injuries += 1
        }
      })

      return {
        gameId: pk(game.id),
        gameNumber: game.game_order ?? '',
        date: game.date || '',
        opponent: game.opponent || '',
        totalPlayers,
        innings,
        sitOuts,
        injuries,
        avgSit: totalPlayers ? (sitOuts / totalPlayers).toFixed(1) : '',
      }
    })
    .filter(Boolean)
}

export function buildPositionByPlayer(games, lineupsByGame, playerId) {
  const orderedGames = getOrderedGames(games)

  return orderedGames
    .map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      if (!lineup) return null

      const normalizedPlayerId = pk(playerId)
      const availableIds = getAvailableIds(lineup)
      const isAvailable = availableIds.includes(normalizedPlayerId)
      const innings = Number(lineup.innings || game.innings || 0)

      const counts = {
        P: 0,
        C: 0,
        '1B': 0,
        '2B': 0,
        '3B': 0,
        SS: 0,
        LF: 0,
        CF: 0,
        RF: 0,
        Out: 0,
        Injury: 0,
      }

      for (let i = 1; i <= innings; i += 1) {
        const pos = lineup.cells?.[normalizedPlayerId]?.[i]
        if (!pos) continue
        if (counts[pos] !== undefined) counts[pos] += 1
      }

      return {
        gameId: pk(game.id),
        gameNumber: game.game_order ?? '',
        opponent: game.opponent || '',
        date: game.date || '',
        active: isAvailable ? 'Yes' : 'No',
        ...counts,
      }
    })
    .filter(Boolean)
}
