export function isCompleteLineup(lineup) {
  if (!lineup) return false

  const innings = Number(lineup.innings || 0)

  for (let inning = 1; inning <= innings; inning += 1) {
    const assigned = Object.values(lineup.cells || {}).filter((p) => p?.[inning])
    if (assigned.length === 0) return false
  }

  return true
}

export function getLockedLineupsOnly({ lineupsByGame, lineupLockedByGame, pk }) {
  return Object.entries(lineupsByGame || {})
    .filter(([gameId]) => lineupLockedByGame?.[pk(gameId)] === true)
    .map(([, lineup]) => lineup)
}
