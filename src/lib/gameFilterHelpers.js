// FILE: src/lib/gameHelpers.js

import { pk, blankLineup } from './lineupUtils'
import {
  compareGamesAsc,
  getNextGameOrder,
} from './appHelpers'

export function buildSortedGames({
  games,
  lineupsByGame,
  lineupLockedByGame,
  gameSort,
  sortRows,
}) {
  return sortRows(
    (games || []).map((game) => ({
      ...game,
      lineupState: lineupLockedByGame?.[pk(game.id)]
        ? 'Locked'
        : lineupsByGame?.[pk(game.id)]
        ? 'Saved'
        : 'Empty',
    })),
    gameSort
  )
}

export function buildOrderedGamesAsc(games) {
  return [...(games || [])].sort((a, b) => compareGamesAsc(a, b, pk))
}

export function buildOrderedGamesDesc(orderedGamesAsc) {
  return [...(orderedGamesAsc || [])].reverse()
}

export function buildSelectedGame({
  games,
  selectedGameId,
}) {
  return (
    (games || []).find((game) => pk(game.id) === pk(selectedGameId)) || null
  )
}

export function buildSelectedLineup({
  selectedGame,
  lineupsByGame,
}) {
  if (!selectedGame) return null
  return lineupsByGame?.[pk(selectedGame.id)] || null
}

export function buildSelectedLocked({
  selectedGame,
  lineupLockedByGame,
  lineupsByGame,
}) {
  if (!selectedGame) return false

  const id = pk(selectedGame.id)

  if (Object.prototype.hasOwnProperty.call(lineupLockedByGame || {}, id)) {
    return lineupLockedByGame[id] === true
  }

  if (lineupsByGame?.[id]) return true

  return false
}

export function buildOptimizerBatchGames({
  games,
  optimizerBatchGameIds,
}) {
  return (games || []).filter((game) =>
    (optimizerBatchGameIds || []).includes(pk(game.id))
  )
}

export function buildOptimizerFocusGame({
  games,
  optimizerFocusGameId,
}) {
  return (
    (games || []).find(
      (game) => pk(game.id) === pk(optimizerFocusGameId)
    ) || null
  )
}

export function buildOptimizerFocusLocked({
  optimizerFocusGame,
  lineupLockedByGame,
}) {
  if (!optimizerFocusGame) return false

  return lineupLockedByGame?.[pk(optimizerFocusGame.id)] === true
}

export function buildOptimizerFocusLineup({
  optimizerFocusGameId,
  games,
  optimizerPreviewByGame,
  lineupsByGame,
  players,
  activePlayerIds,
}) {
  if (!optimizerFocusGameId) return null

  const game = (games || []).find(
    (g) => pk(g.id) === pk(optimizerFocusGameId)
  )

  return (
    optimizerPreviewByGame?.[pk(optimizerFocusGameId)] ||
    lineupsByGame?.[pk(optimizerFocusGameId)] ||
    (game
      ? blankLineup(
          players.map((p) => p.id),
          Number(game.innings || 6),
          activePlayerIds()
        )
      : null)
  )
}

export function buildDefaultGamePayload({
  TEAM_ID,
  date,
  opponent,
  gameType,
  season,
  defaultStatusOption,
  games,
}) {
  return {
    team_id: TEAM_ID,
    game_date: date || null,
    opponent: opponent || null,
    innings: 6,
    status:
      defaultStatusOption?.value ||
      defaultStatusOption?.label ||
      'Planned',
    game_type: gameType || '',
    season: season || '',
    game_order: getNextGameOrder(games),
  }
}
