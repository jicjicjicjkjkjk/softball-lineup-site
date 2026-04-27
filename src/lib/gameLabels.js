import { formatDateShort } from './appHelpers'

export function formatGameLabel(game) {
  if (!game) return 'this game'

  const date = formatDateShort(game.date) || game.date || 'No Date'
  const opponent = game.opponent || 'Opponent'

  return `${date} vs ${opponent}`
}
