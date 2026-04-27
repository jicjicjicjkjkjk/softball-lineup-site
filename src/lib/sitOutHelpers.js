export function buildCumulativeSitOutRows(sitByPlayer = [], sitSummary = []) {
  const avgByGame = (sitSummary || []).map((game) => {
    const value = Number(game?.avgSit)
    return Number.isNaN(value) ? null : value
  })

  return (sitByPlayer || []).map((row) => {
    let runningTotal = 0

    const deltaPerGame = (row.perGame || []).map((value, index) => {
      if (value === 'x' || value === '' || value === null || value === undefined) {
        return 'x'
      }

      const playerOuts = Number(value)
      const avgSit = avgByGame[index]

      if (Number.isNaN(playerOuts)) return 'x'

      // If no summary was passed, fall back to raw cumulative outs.
      if (avgSit === null || avgSit === undefined || Number.isNaN(avgSit)) {
        return playerOuts
      }

      return Number((avgSit - playerOuts).toFixed(2))
    })

    const running = deltaPerGame.map((value) => {
      if (value === 'x') return 'x'

      runningTotal = Number((runningTotal + Number(value)).toFixed(2))
      return runningTotal
    })

    return {
      ...row,
      deltaPerGame,
      running,
      sitOutRunningTotal: running.filter((value) => value !== 'x').at(-1) ?? 0,
    }
  })
}
