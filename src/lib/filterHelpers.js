export const defaultTrackingFilters = {
  seasons: [],
  gameTypes: [],
  gameStatuses: [],
  lineupStates: ['Locked'],
  dateFrom: '',
  dateTo: '',
}

export function loadTrackingFilters() {
  try {
    const saved = sessionStorage.getItem(
      'softball-lineup-tracking-filters'
    )

    const parsed = saved ? JSON.parse(saved) : {}

    const savedLineupStates = Array.isArray(parsed?.lineupStates)
      ? parsed.lineupStates.filter((x) =>
          ['Locked', 'Saved', 'Empty'].includes(x)
        )
      : []

    return {
      ...defaultTrackingFilters,
      ...(parsed && typeof parsed === 'object' ? parsed : {}),
      seasons: Array.isArray(parsed?.seasons)
        ? parsed.seasons
        : [],
      gameTypes: Array.isArray(parsed?.gameTypes)
        ? parsed.gameTypes
        : [],
      gameStatuses: Array.isArray(parsed?.gameStatuses)
        ? parsed.gameStatuses
        : [],
      lineupStates: savedLineupStates.length
        ? savedLineupStates
        : defaultTrackingFilters.lineupStates,
    }
  } catch (error) {
    console.error(
      'Failed to load tracking filters from sessionStorage',
      error
    )

    return defaultTrackingFilters
  }
}

export function saveTrackingFilters(filters) {
  try {
    sessionStorage.setItem(
      'softball-lineup-tracking-filters',
      JSON.stringify(filters)
    )
  } catch (error) {
    console.error(
      'Failed to save tracking filters to sessionStorage',
      error
    )
  }
}

export function getGameLineupState({
  game,
  lineupLockedByGame,
  lineupsByGame,
  pk,
}) {
  if (lineupLockedByGame[pk(game.id)]) return 'Locked'

  if (lineupsByGame[pk(game.id)]) return 'Saved'

  return 'Empty'
}

export function gameMatchesFilters({
  game,
  filters,
  lineupLockedByGame,
  lineupsByGame,
  pk,
}) {
  const seasons = filters?.seasons || []
  const gameTypes = filters?.gameTypes || []
  const gameStatuses = filters?.gameStatuses || []
  const lineupStates = filters?.lineupStates || []
  const dateFrom = filters?.dateFrom || ''
  const dateTo = filters?.dateTo || ''

  const gameDate = game?.date || ''

  const lineupState = getGameLineupState({
    game,
    lineupLockedByGame,
    lineupsByGame,
    pk,
  })

  const seasonMatch =
    !seasons.length || seasons.includes(game.season || '')

  const typeMatch =
    !gameTypes.length ||
    gameTypes.includes(game.game_type || '')

  const statusMatch =
    !gameStatuses.length ||
    gameStatuses.includes(game.status || '')

  const lineupStateMatch =
    !lineupStates.length ||
    lineupStates.includes(lineupState)

  const fromMatch =
    !dateFrom || (gameDate && gameDate >= dateFrom)

  const toMatch =
    !dateTo || (gameDate && gameDate <= dateTo)

  return (
    seasonMatch &&
    typeMatch &&
    statusMatch &&
    lineupStateMatch &&
    fromMatch &&
    toMatch
  )
}
