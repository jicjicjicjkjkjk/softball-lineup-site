export function buildCumulativeSitOutRows(sitByPlayer = []) {
  return (sitByPlayer || []).map((row) => {
    let runningTotal = 0

    const running = (row.perGame || []).map((value) => {
      if (value === 'x' || value === '' || value === null || value === undefined) {
        return 'x'
      }

      const playerOuts = Number(value)
      if (Number.isNaN(playerOuts)) return 'x'

      runningTotal += playerOuts
      return Number(runningTotal.toFixed(2))
    })

    return {
      ...row,
      deltaPerGame: row.perGame,
      running,
      sitOutRunningTotal: running.filter((value) => value !== 'x').at(-1) ?? 0,
    }
  })
}
