// FILE: src/lib/optimizerViewHelpers.js

import { pk } from './lineupUtils'
import { getImportableGamesForGame as getImportableGamesForGameHelper } from './lineupEditHelpers'

export function buildOptimizerImportableGames({
  optimizerFocusGame,
  games,
  lineupsByGame,
  compareGamesAsc,
}) {
  if (!optimizerFocusGame) return []

  return getImportableGamesForGameHelper({
    games,
    currentGameId: optimizerFocusGame.id,
    lineupsByGame,
    compareGamesAsc,
  })
}

export function buildGameDetailImportableGames({
  selectedGame,
  games,
  lineupsByGame,
  compareGamesAsc,
}) {
  if (!selectedGame) return []

  return getImportableGamesForGameHelper({
    games,
    currentGameId: selectedGame.id,
    lineupsByGame,
    compareGamesAsc,
  })
}

export function buildActiveOptimizerProfile({
  optimizerProfiles,
  optimizerMode,
}) {
  return (
    optimizerProfiles.find(
      (profile) => profile.profile_key === optimizerMode
    ) ||
    optimizerProfiles.find((profile) => profile.is_default) ||
    null
  )
}

export function buildActiveOptimizerProfileRules({
  activeOptimizerProfile,
  optimizerProfileRules,
}) {
  if (!activeOptimizerProfile?.id) return {}

  return optimizerProfileRules?.[activeOptimizerProfile.id] || {}
}
