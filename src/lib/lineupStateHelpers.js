import { pk } from './lineupUtils'

export function isCompleteLineup(lineup) {
  if (!lineup) return false

  const innings = Number(lineup.innings || 0)

  for (let inning = 1; inning <= innings; inning += 1) {
    const assigned = Object.values(lineup.cells || {}).filter(
      (p) => p?.[inning]
    )

    if (assigned.length === 0) return false
  }

  return true
}

export function getSelectedLocked({
  selectedGame,
  lineupLockedByGame,
  lineupsByGame,
}) {
  if (!selectedGame) return false

  const id = pk(selectedGame.id)

  if (Object.prototype.hasOwnProperty.call(lineupLockedByGame, id)) {
    return lineupLockedByGame[id] === true
  }

  if (lineupsByGame[id]) return true

  return false
}

export function buildSortedGames({
  games,
  lineupsByGame,
  lineupLockedByGame,
  sortRows,
  gameSort,
}) {
  return sortRows(
    games.map((game) => ({
      ...game,
      lineupState: lineupLockedByGame[pk(game.id)]
        ? 'Locked'
        : lineupsByGame[pk(game.id)]
        ? 'Saved'
        : 'Empty',
    })),
    gameSort
  )
}
