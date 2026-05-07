// FILE: src/hooks/usePositionActions.js

import { supabase } from '../lib/supabase'
import { normalizePriorityValue } from '../lib/positionInputHelpers'
import { pk } from '../lib/lineupUtils'

export function usePositionActions({
  setAppError,
  setPriorityByPlayer,
  setFitByPlayer,
}) {
  function updatePriorityLocal(playerId, position, value) {
    setPriorityByPlayer((current) => ({
      ...current,
      [pk(playerId)]: {
        ...(current[pk(playerId)] || {}),
        [position]: { priority_pct: value },
      },
    }))
  }

  function updateFitLocal(playerId, position, tier) {
    setFitByPlayer((current) => ({
      ...current,
      [pk(playerId)]: {
        ...(current[pk(playerId)] || {}),
        [position]: tier,
      },
    }))
  }

  async function persistPriority(playerId, position, value) {
    const cleanedValue = normalizePriorityValue(value)

    if (cleanedValue === '') {
      const del = await supabase
        .from('player_position_preferences')
        .delete()
        .eq('player_id', playerId)
        .eq('position', position)

      if (del.error) return setAppError(del.error.message)

      updatePriorityLocal(playerId, position, '')
      return
    }

    const up = await supabase.from('player_position_preferences').upsert(
      {
        player_id: playerId,
        position,
        priority_pct: cleanedValue,
      },
      { onConflict: 'player_id,position' }
    )

    if (up.error) return setAppError(up.error.message)

    updatePriorityLocal(playerId, position, cleanedValue)
  }

  async function persistFitTier(playerId, position, tier) {
    const cleanedTier = tier || 'no'

    if (position === 'OF') {
      const results = await Promise.all(
        ['LF', 'CF', 'RF'].map((ofPos) =>
          supabase.from('player_allowed_positions').upsert(
            {
              player_id: playerId,
              position: ofPos,
              fit_tier: cleanedTier,
            },
            { onConflict: 'player_id,position' }
          )
        )
      )

      const error = results.find((res) => res.error)?.error

      if (error) return setAppError(error.message)

      setFitByPlayer((current) => ({
        ...current,
        [pk(playerId)]: {
          ...(current[pk(playerId)] || {}),
          LF: cleanedTier,
          CF: cleanedTier,
          RF: cleanedTier,
        },
      }))

      return
    }

    const up = await supabase.from('player_allowed_positions').upsert(
      {
        player_id: playerId,
        position,
        fit_tier: cleanedTier,
      },
      { onConflict: 'player_id,position' }
    )

    if (up.error) return setAppError(up.error.message)

    updateFitLocal(playerId, position, cleanedTier)
  }

  return {
    updatePriorityLocal,
    updateFitLocal,
    persistPriority,
    persistFitTier,
  }
}
