export function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

export function abbreviateOpponentName(opponent) {
  const text = String(opponent || '').trim()
  if (!text) return ''

  const stopWords = new Set([
    'the',
    'a',
    'an',
    'vs',
    'versus',
    'at',
    'u',
    '12u',
    '11u',
    '10u',
    '13u',
    '14u',
    '15u',
    '16u',
    '18u',
    'gold',
    'silver',
    'black',
    'blue',
    'red',
    'white',
    'teal',
    'green',
    'gray',
    'grey',
    'orange',
    'purple',
    'pink',
    'elite',
    'premier',
    'national',
    'select',
    'team',
  ])

  const words = text
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)

  const usable = words.filter((word) => !stopWords.has(word.toLowerCase()))
  const source = usable.length ? usable : words

  if (!source.length) return text.slice(0, 3)
  if (source.length === 1) return source[0].slice(0, 3)
  if (source.length === 2) return `${source[0].slice(0, 3)} ${source[1].slice(0, 3)}`

  return source
    .slice(0, 2)
    .map((word) => word.slice(0, 3))
    .join(' ')
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

      const totalOpenSlots = Math.max(
        ((totalPlayers * innings) - injury) - (9 * innings),
        0
      )

      return {
        gameId: pk(game.id),
        totalPlayers,
        innings,
        sitOuts,
        injury,
        avgSit: totalPlayers ? (totalOpenSlots / totalPlayers).toFixed(2) : '',
      }
    })
    .filter(Boolean)
}

export function buildPlayerSitOuts(games, lineupsByGame, activePlayers, pk) {
  return (activePlayers || []).map((player) => {
    const playerId = pk(player.id)
    const perGame = []
    const deltaPerGame = []
    const running = []

    let runningTotal = 0

    ;(games || []).forEach((game) => {
      const lineup = lineupsByGame?.[pk(game.id)]

      if (!lineup) {
        perGame.push('x')
        deltaPerGame.push('x')
        running.push('x')
        return
      }

      const availableIds = (lineup.availablePlayerIds || []).map(pk)
      const playersInLineup = availableIds.length

      if (!availableIds.includes(playerId) || playersInLineup === 0) {
        perGame.push('x')
        deltaPerGame.push('x')
        running.push('x')
        return
      }

      const innings = Number(lineup.innings || 0)

      let playerOuts = 0
      let injuryInnings = 0

      availableIds.forEach((id) => {
        for (let inning = 1; inning <= innings; inning += 1) {
          const value = lineup?.cells?.[id]?.[inning] || ''

          if (value === 'Injury') injuryInnings += 1
          if (id === playerId && value === 'Out') playerOuts += 1
        }
      })

      const totalSitOuts = Math.max(
        ((playersInLineup * innings) - injuryInnings) - (9 * innings),
        0
      )

      const teamAverageSitOuts = totalSitOuts / playersInLineup

      // your spreadsheet logic:
      // 1 sit out vs 1.25 avg = +0.25
      // 2 sit outs vs 1.25 avg = -0.75
      const gameDelta = Number((teamAverageSitOuts - playerOuts).toFixed(2))

      runningTotal = Number((runningTotal + gameDelta).toFixed(2))

      perGame.push(playerOuts)
      deltaPerGame.push(gameDelta)
      running.push(runningTotal)
    })

    return {
      playerId,
      name: player.name,
      perGame,
      deltaPerGame,
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
