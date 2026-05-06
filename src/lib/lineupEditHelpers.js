import { pk, blankLineup, normalizeLineup, clearUnlockedLineupCells } from './lineupUtils'
import { formatGameLabel } from './gameLabels'

export function getImportableGamesForGame({
  games,
  currentGameId,
  lineupsByGame,
  compareGamesAsc,
}) {
  return [...(games || [])]
    .filter((game) => pk(game.id) !== pk(currentGameId))
    .filter((game) => lineupsByGame[pk(game.id)])
    .sort((a, b) => compareGamesAsc(b, a, pk))
}

export function copyLineupForGame({
  sourceLineup,
  targetGame,
  players,
  activePlayerIds,
}) {
  return normalizeLineup(
    JSON.parse(JSON.stringify(sourceLineup)),
    players,
    Number(targetGame?.innings || sourceLineup?.innings || 6),
    sourceLineup?.availablePlayerIds || activePlayerIds()
  )
}

export function clearLineupContents(lineup, players) {
  return clearUnlockedLineupCells(lineup, players)
}

export function buildPreviewBaseLineup({
  gameId,
  games,
  players,
  activePlayerIds,
  optimizerPreviewByGame,
  lineupsByGame,
}) {
  const baseGame = games.find((g) => pk(g.id) === pk(gameId))

  const base =
    optimizerPreviewByGame[pk(gameId)] ||
    lineupsByGame[pk(gameId)] ||
    blankLineup(players.map((p) => p.id), Number(baseGame?.innings || 6), activePlayerIds())

  return normalizeLineup(
    base,
    players,
    base.innings || 6,
    base.availablePlayerIds || activePlayerIds()
  )
}

export function getAvailabilityConfirmMessage({
  currentlyAvailable,
  player,
  game,
}) {
  return currentlyAvailable
    ? `Remove ${player?.name || 'this player'} from availability for ${
        formatGameLabel(game)
      }? This will clear their positions and batting order for this game.`
    : `Add ${player?.name || 'this player'} to availability for ${formatGameLabel(game)}?`
}

export function updateLineupAvailability({
  lineup,
  playerId,
  currentlyAvailable,
}) {
  const id = pk(playerId)

  if (!lineup.availablePlayerIds) lineup.availablePlayerIds = []

  if (currentlyAvailable) {
    lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => pk(x) !== id)

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      if (!lineup.cells[id]) lineup.cells[id] = {}
      if (!lineup.lockedCells[id]) lineup.lockedCells[id] = {}

      lineup.cells[id][inning] = ''
      lineup.lockedCells[id][inning] = false
    }

    if (!lineup.lockedRows) lineup.lockedRows = {}
    if (!lineup.battingOrder) lineup.battingOrder = {}

    lineup.lockedRows[id] = false
    lineup.battingOrder[id] = ''
  } else {
    lineup.availablePlayerIds = [...new Set([...lineup.availablePlayerIds.map(pk), id])]
  }

  return lineup
}

export function addInningToLineup(lineup) {
  const newInning = Number(lineup.innings || 0) + 1
  lineup.innings = newInning

  Object.keys(lineup.cells || {}).forEach((id) => {
    if (!lineup.cells[id]) lineup.cells[id] = {}
    if (!lineup.lockedCells[id]) lineup.lockedCells[id] = {}
    lineup.cells[id][newInning] = ''
    lineup.lockedCells[id][newInning] = false
  })

  if (!lineup.lockedInnings) lineup.lockedInnings = {}
  lineup.lockedInnings[newInning] = false

  return lineup
}

export function removeInningFromLineup(lineup, inningToRemove) {
  if (Number(lineup.innings || 0) <= 1) return lineup

  Object.keys(lineup.cells || {}).forEach((id) => {
    const nextCells = {}
    const nextLocks = {}
    let nextInning = 1

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      if (inning === inningToRemove) continue

      nextCells[nextInning] = lineup.cells?.[id]?.[inning] || ''
      nextLocks[nextInning] = lineup.lockedCells?.[id]?.[inning] || false
      nextInning += 1
    }

    lineup.cells[id] = nextCells
    lineup.lockedCells[id] = nextLocks
  })

  const nextLockedInnings = {}
  let nextInningIndex = 1

  for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
    if (inning === inningToRemove) continue

    nextLockedInnings[nextInningIndex] = lineup.lockedInnings?.[inning] === true
    nextInningIndex += 1
  }

  lineup.lockedInnings = nextLockedInnings
  lineup.innings = Number(lineup.innings || 0) - 1

  return lineup
}

export function toggleBattingLockOnLineup(lineup, playerId) {
  const id = pk(playerId)

  if (!lineup.lockedBattingOrder) lineup.lockedBattingOrder = {}
  if (!lineup.battingOrder) lineup.battingOrder = {}

  lineup.lockedBattingOrder[id] = !(lineup.lockedBattingOrder[id] === true)

  return lineup
}

export function toggleAllBattingLocksOnLineup(lineup) {
  if (!lineup.lockedBattingOrder) lineup.lockedBattingOrder = {}

  const ids = Object.keys(lineup.battingOrder || {})
  const allLocked =
    ids.length > 0 && ids.every((id) => lineup.lockedBattingOrder[id] === true)

  ids.forEach((id) => {
    lineup.lockedBattingOrder[id] = !allLocked
  })

  return lineup
}

export function toggleCellLockOnLineup(lineup, playerId, inning) {
  const id = pk(playerId)

  if (!lineup.lockedCells) lineup.lockedCells = {}
  if (!lineup.lockedCells[id]) lineup.lockedCells[id] = {}

  lineup.lockedCells[id][inning] = !lineup.lockedCells[id][inning]

  return lineup
}

export function toggleRowLockOnLineup(lineup, playerId) {
  const id = pk(playerId)

  if (!lineup.lockedRows) lineup.lockedRows = {}

  lineup.lockedRows[id] = !lineup.lockedRows[id]

  return lineup
}

export function toggleInningLockOnLineup(lineup, inning) {
  if (!lineup.lockedInnings) lineup.lockedInnings = {}

  lineup.lockedInnings[inning] = !(lineup.lockedInnings[inning] === true)

  return lineup
}

export function updateLineupCell(lineup, playerId, inning, value) {
  const id = pk(playerId)

  if (!lineup.cells) lineup.cells = {}
  if (!lineup.cells[id]) lineup.cells[id] = {}

  lineup.cells[id][inning] = value

  return lineup
}

export function updateLineupBattingOrder(lineup, playerId, value) {
  const id = pk(playerId)

  if (!lineup.battingOrder) lineup.battingOrder = {}

  lineup.battingOrder[id] = value

  return lineup
}

export function removeInningFromSavedLineup({
  existing,
  inningToRemove,
  players,
  activePlayerIds,
}) {
  let lineup = normalizeLineup(
    JSON.parse(JSON.stringify(existing)),
    players,
    Number(existing.innings || 0),
    existing.availablePlayerIds || activePlayerIds()
  )

  return removeInningFromLineup(lineup, inningToRemove)
}
