export function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

export function sortRows(rows, sort) {
  if (!sort?.key) return rows
  const dir = sort.direction === 'desc' ? -1 : 1

  return [...rows].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    const an = Number(av)
    const bn = Number(bv)
    const aNum = !Number.isNaN(an) && String(av ?? '').trim() !== ''
    const bNum = !Number.isNaN(bn) && String(bv ?? '').trim() !== ''

    if (aNum && bNum) return (an - bn) * dir
    return String(av ?? '').localeCompare(String(bv ?? '')) * dir
  })
}

export function formatDateShort(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${m}/${d}/${y.slice(2)}`
}

export function avg(numbers) {
  if (!numbers.length) return ''
  return (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(1)
}

export function getNextGameOrder(games) {
  const used = new Set(
    (games || [])
      .map((g) => Number(g.game_order))
      .filter((n) => Number.isFinite(n) && n > 0)
  )
  let next = 1
  while (used.has(next)) next += 1
  return next
}

export function compareGamesAsc(a, b, pk) {
  const aKey = `${a.date || ''}-${String(a.game_order || 999).padStart(3, '0')}-${pk(a.id)}`
  const bKey = `${b.date || ''}-${String(b.game_order || 999).padStart(3, '0')}-${pk(b.id)}`
  return aKey.localeCompare(bKey)
}

export function isPlayerAvailableForGame(lineup, playerId, pk) {
  return (lineup?.availablePlayerIds || []).includes(pk(playerId))
}

export function buildBattingOrderMatrix(games, lineupsByGame, players, pk) {
  return players.map((p) => {
    const orders = []
    const perGame = games.map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      if (!lineup || !isPlayerAvailableForGame(lineup, p.id, pk)) return ''
      const value = lineup?.battingOrder?.[pk(p.id)] || ''
      if (value !== '') orders.push(Number(value))
      return value
    })

    return {
      playerId: pk(p.id),
      name: p.name,
      avg: avg(orders),
      perGame,
    }
  })
}

export function buildSitOutSummary(games, lineupsByGame, players, pk) {
  return games
    .map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      if (!lineup) return null

      const availableIds = (lineup.availablePlayerIds || []).filter((id) =>
        players.some((p) => pk(p.id) === pk(id))
      )

      const totalPlayers = availableIds.length
      const innings = Number(lineup.innings || 0)

      let sitOuts = 0
      let injury = 0

      availableIds.forEach((pid) => {
        for (let i = 1; i <= innings; i += 1) {
          const value = lineup.cells?.[pid]?.[i]
          if (value === 'Out') sitOuts += 1
          if (value === 'Injury') injury += 1
        }
      })

      return {
        gameId: pk(game.id),
        totalPlayers,
        innings,
        sitOuts,
        injury,
        avgSit: totalPlayers ? (sitOuts / totalPlayers).toFixed(1) : '',
      }
    })
    .filter(Boolean)
}

export function buildPlayerSitOuts(games, lineupsByGame, players, pk, requiredOutsForGame) {
  return players.map((p) => {
    let runningActual = 0
    let runningExpected = 0

    const perGame = []
    const running = []

    games.forEach((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      if (!lineup || !isPlayerAvailableForGame(lineup, p.id, pk)) {
        perGame.push('')
        running.push('')
        return
      }

      let count = 0
      for (let i = 1; i <= Number(lineup.innings || 0); i += 1) {
        if (lineup.cells?.[pk(p.id)]?.[i] === 'Out') count += 1
      }

      const eligiblePlayers = (lineup.availablePlayerIds || []).filter((id) => {
        const playerRow = lineup.cells?.[pk(id)] || {}
        const everyInjury =
          Object.keys(playerRow).length > 0 &&
          Object.values(playerRow).every((v) => v === 'Injury')
        return !everyInjury && players.some((pl) => pk(pl.id) === pk(id))
      })

      const expectedPerPlayer = eligiblePlayers.length
        ? requiredOutsForGame(eligiblePlayers.length, Number(lineup.innings || 0)) / eligiblePlayers.length
        : 0

      runningActual += count
      runningExpected += expectedPerPlayer

      perGame.push(count === 0 ? 0 : count)
      running.push((runningActual - runningExpected).toFixed(1))
    })

    return {
      playerId: pk(p.id),
      name: p.name,
      perGame,
      running,
    }
  })
}

export function buildPositionByPlayer(games, lineupsByGame, playerId, pk) {
  return games
    .map((game) => {
      const lineup = lineupsByGame[pk(game.id)]
      if (!lineup || !isPlayerAvailableForGame(lineup, playerId, pk)) return null

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

      for (let i = 1; i <= Number(lineup.innings || 0); i += 1) {
        const pos = lineup.cells?.[pk(playerId)]?.[i]
        if (counts[pos] !== undefined) counts[pos] += 1
      }

      return {
        gameId: pk(game.id),
        date: game.date,
        opponent: game.opponent,
        order: game.game_order ?? '',
        active: 'Yes',
        ...counts,
      }
    })
    .filter(Boolean)
}
