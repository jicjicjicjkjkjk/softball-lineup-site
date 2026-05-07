import { supabase } from '../lib/supabase'
import { TEAM_ID } from '../lib/constants'
import { pk } from '../lib/lineupUtils'

export function usePlayerActions({
  setAppError,
  setPlayers,
  loadAll,
  newPlayerName,
  setNewPlayerName,
  newPlayerLastName,
  setNewPlayerLastName,
  newPlayerNumber,
  setNewPlayerNumber,
  newPlayerActive,
  setNewPlayerActive,
}) {
  async function upsertPlayer(player) {
    if (!player.name?.trim()) return

    const payload = {
      name: player.name,
      last_name: player.last_name || '',
      jersey_number: player.jersey_number,
      active: player.active,
    }

    if (player.id) {
      const updateRes = await supabase
        .from('players')
        .update(payload)
        .eq('id', player.id)

      if (updateRes.error) {
        setAppError(updateRes.error.message)
      }

      return
    }

    const insertRes = await supabase
      .from('players')
      .insert({ team_id: TEAM_ID, ...payload })
      .select('id, name, last_name, jersey_number, active')
      .single()

    if (insertRes.error) {
      setAppError(insertRes.error.message)
      return
    }

    setPlayers((current) => [...current, insertRes.data])
  }

  function updatePlayerLocal(playerId, field, value) {
    setPlayers((current) =>
      current.map((player) =>
        pk(player.id) === pk(playerId)
          ? { ...player, [field]: value }
          : player
      )
    )
  }

  async function addPlayer() {
    await upsertPlayer({
      name: newPlayerName,
      last_name: newPlayerLastName,
      jersey_number: newPlayerNumber,
      active: newPlayerActive,
    })

    setNewPlayerName('')
    setNewPlayerLastName('')
    setNewPlayerNumber('')
    setNewPlayerActive(true)
    await loadAll()
  }

  async function deletePlayer(playerId) {
    if (!window.confirm('Delete this player?')) return

    const del = await supabase.from('players').delete().eq('id', playerId)

    if (del.error) {
      setAppError(del.error.message)
      return
    }

    setPlayers((current) =>
      current.filter((player) => pk(player.id) !== pk(playerId))
    )
  }

  return {
    upsertPlayer,
    updatePlayerLocal,
    addPlayer,
    deletePlayer,
  }
}
