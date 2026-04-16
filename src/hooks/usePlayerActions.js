
async function upsertPlayer(player) {
    if (!player.name?.trim()) return

    if (player.id) {
      const updateRes = await supabase
        .from('players')
        .update({
          name: player.name,
          jersey_number: player.jersey_number,
          active: player.active,
        })
        .eq('id', player.id)

      if (updateRes.error) setAppError(updateRes.error.message)
      return
    }

    const insertRes = await supabase
      .from('players')
      .insert({
        team_id: TEAM_ID,
        name: player.name,
        jersey_number: player.jersey_number,
        active: player.active,
      })
      .select('id, name, jersey_number, active')
      .single()

    if (insertRes.error) {
      setAppError(insertRes.error.message)
      return
    }

    setPlayers((current) => [...current, insertRes.data])
  }

  function updatePlayerLocal(playerId, field, value) {
    setPlayers((current) =>
      current.map((player) => (pk(player.id) === pk(playerId) ? { ...player, [field]: value } : player))
    )
  }

  async function addPlayer() {
    await upsertPlayer({
      name: newPlayerName,
      jersey_number: newPlayerNumber,
      active: newPlayerActive,
    })
    setNewPlayerName('')
    setNewPlayerNumber('')
    setNewPlayerActive(true)
    await loadAll()
  }

  async function deletePlayer(playerId) {
    const confirmed = window.confirm('Delete this player?')
    if (!confirmed) return

    const del = await supabase.from('players').delete().eq('id', playerId)
    if (del.error) {
      setAppError(del.error.message)
      return
    }

    setPlayers((current) => current.filter((player) => pk(player.id) !== pk(playerId)))
  }

  async function persistPriority(playerId, position, value) {
    const cleaned = String(value ?? '').trim()

    if (!cleaned) {
      const del = await supabase
        .from('player_position_preferences')
        .delete()
        .eq('player_id', playerId)
        .eq('position', position)

      if (del.error) setAppError(del.error.message)
    } else {
      const up = await supabase
        .from('player_position_preferences')
        .upsert(
          {
            player_id: playerId,
            position,
            priority_pct: Number(cleaned),
          },
          { onConflict: 'player_id,position' }
        )

      if (up.error) setAppError(up.error.message)
    }

    updatePriorityLocal(playerId, position, value)

    const numericValue = Number(cleaned || 0)
    if (numericValue > 0) {
      if (position === 'OF') {
        await Promise.all(
          ['LF', 'CF', 'RF'].map((ofPos) =>
            supabase.from('player_allowed_positions').upsert(
              { player_id: playerId, position: ofPos, fit_tier: 'primary' },
              { onConflict: 'player_id,position' }
            )
          )
        )
        setFitByPlayer((current) => ({
          ...current,
          [pk(playerId)]: {
            ...(current[pk(playerId)] || {}),
            LF: 'primary',
            CF: 'primary',
            RF: 'primary',
          },
        }))
      } else {
        await supabase.from('player_allowed_positions').upsert(
          { player_id: playerId, position, fit_tier: 'primary' },
          { onConflict: 'player_id,position' }
        )
        setFitByPlayer((current) => ({
          ...current,
          [pk(playerId)]: {
            ...(current[pk(playerId)] || {}),
            [position]: 'primary',
          },
        }))
      }
    }
  }

  async function persistFitTier(playerId, position, tier) {
    const primaryLocked =
      Number(priorityByPlayer[pk(playerId)]?.[position]?.priority_pct || 0) > 0 ||
      (['LF', 'RF'].includes(position) &&
        Number(priorityByPlayer[pk(playerId)]?.OF?.priority_pct || 0) > 0)

    if (primaryLocked) return

    const up = await supabase
      .from('player_allowed_positions')
      .upsert(
        {
          player_id: playerId,
          position,
          fit_tier: tier,
        },
        { onConflict: 'player_id,position' }
      )

    if (up.error) setAppError(up.error.message)
  }

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
