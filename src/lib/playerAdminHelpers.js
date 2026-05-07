// FILE: src/lib/playerAdminHelpers.js

import { pk } from './lineupUtils'
import { sortRows } from './appHelpers'

export function buildSortedPlayers({
  players,
  playerSort,
}) {
  return sortRows(
    (players || []).map((player) => ({
      ...player,
      activeText: player.active === false ? 'No' : 'Yes',
    })),
    playerSort
  )
}

export function updatePlayerInList({
  players,
  playerId,
  field,
  value,
}) {
  return (players || []).map((player) =>
    pk(player.id) === pk(playerId) ? { ...player, [field]: value } : player
  )
}

export function removePlayerFromList({
  players,
  playerId,
}) {
  return (players || []).filter((player) => pk(player.id) !== pk(playerId))
}

export function buildNewPlayerPayload({
  teamId,
  name,
  lastName,
  jerseyNumber,
  active,
}) {
  return {
    team_id: teamId,
    name,
    last_name: lastName || '',
    jersey_number: jerseyNumber,
    active,
  }
}

export function buildPlayerUpdatePayload(player) {
  return {
    name: player.name,
    last_name: player.last_name || '',
    jersey_number: player.jersey_number,
    active: player.active,
  }
}
