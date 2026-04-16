  function autoSave(gameId, lineup) {
    supabase.from('game_lineups').upsert(
      {
        game_id: gameId,
        lineup_name: 'Main',
        lineup_data: lineup,
        optimizer_meta: {
          innings: lineup.innings,
          availablePlayerIds: lineup.availablePlayerIds,
        },
        lineup_locked: lineupLockedByGame[pk(gameId)] === true,
      },
      { onConflict: 'game_id,lineup_name' }
    )
  }

  useEffect(() => {
    loadAll()
  }, [])

const {
  activePlayers,
  activePlayerIds,
  selectedGame,
  selectedLineup,
  selectedLocked,
  sortedPlayers,
  sortedGames,
  orderedGamesAsc,
  activePriorityRows,
  allowedRows,
  priorityFooter,
  optimizerBatchGames,
  optimizerFocusGame,
  optimizerFocusLineup,
  lockedLineupsOnly,
  trackingLockedLineups,
  ytdBeforeTotals,
  currentBatchTotals,
  ytdAfterTotals,
  trackingTotals,
  battingRows,
  sitSummary,
  sitByPlayer,
  selectedPlayerPositions,
  trackingPriorityRows,
  filteredAttendanceEvents,
  attendanceTotals,
  attendanceBreakdownByPlayer,
} = useAppDerivedData({
  players,
  games,
  lineupsByGame,
  lineupLockedByGame,
  priorityByPlayer,
  fitByPlayer,
  optimizerBatchGameIds,
  optimizerFocusGameId,
  optimizerPreviewByGame,
  selectedGameId,
  playerSort,
  gameSort,
  prioritySort,
  allowedSort,
  trackingSort,
  attendanceEvents,
  attendanceSort,
  attendanceByEvent,
  trackingPlayerId,
})
  
  async function loadAll() {
    setLoading(true)
    setAppError('')

    try {
      if (!dbReady()) throw new Error('Supabase is not connected.')

      const playersRes = await supabase
        .from('players')
        .select('id, name, jersey_number, active')
        .eq('team_id', TEAM_ID)
        .order('name', { ascending: true })

      if (playersRes.error) throw playersRes.error
      const loadedPlayers = playersRes.data || []
      setPlayers(loadedPlayers)

      const gamesRes = await supabase
        .from('games')
        .select('id, game_date, opponent, innings, status, game_type, game_order')
        .eq('team_id', TEAM_ID)
        .order('game_date', { ascending: true, nullsFirst: false })
        .order('game_order', { ascending: true })

      if (gamesRes.error) throw gamesRes.error

      const loadedGames = (gamesRes.data || []).map((row) => ({
        id: row.id,
        date: row.game_date || '',
        opponent: row.opponent || '',
        innings: Number(row.innings || 6),
        status: row.status || 'Planned',
        game_type: row.game_type || GAME_TYPES[0],
        game_order: Number(row.game_order || null),
      }))

      setGames(loadedGames)

      const lineupRes = await supabase
        .from('game_lineups')
        .select('game_id, lineup_data, optimizer_meta, lineup_locked')
        .eq('lineup_name', 'Main')

      if (lineupRes.error) throw lineupRes.error

      const loadedLineups = {}
      const loadedLocked = {}

      ;(lineupRes.data || []).forEach((row) => {
        loadedLineups[pk(row.game_id)] = normalizeLineup(
          row.lineup_data || {},
          loadedPlayers,
          Number(row.optimizer_meta?.innings || 6),
          row.optimizer_meta?.availablePlayerIds ||
            loadedPlayers.filter((p) => p.active !== false).map((p) => p.id)
        )
        loadedLocked[pk(row.game_id)] = row.lineup_locked === true
      })

      setLineupsByGame(loadedLineups)
      setLineupLockedByGame(loadedLocked)

      const prefRes = await supabase
        .from('player_position_preferences')
        .select('player_id, position, priority_pct')

      if (prefRes.error) throw prefRes.error

      const allowedRes = await supabase
        .from('player_allowed_positions')
        .select('player_id, position, fit_tier')

      if (allowedRes.error) throw allowedRes.error

      const nextPriority = {}
      const nextFit = {}

      ;(prefRes.data || []).forEach((row) => {
        const playerId = pk(row.player_id)
        if (!nextPriority[playerId]) nextPriority[playerId] = {}
        nextPriority[playerId][row.position] = { priority_pct: row.priority_pct ?? '' }
      })

      ;(allowedRes.data || []).forEach((row) => {
        const playerId = pk(row.player_id)
        if (!nextFit[playerId]) nextFit[playerId] = {}
        nextFit[playerId][row.position] = row.fit_tier || 'secondary'
      })

      setPriorityByPlayer(nextPriority)
      setFitByPlayer(nextFit)

      const attendanceEventsRes = await supabase
        .from('attendance_events')
        .select('id, event_date, season_bucket, event_type, surface, title')
        .eq('team_id', TEAM_ID)
        .order('event_date', { ascending: true })

      if (attendanceEventsRes.error) throw attendanceEventsRes.error
      setAttendanceEvents(attendanceEventsRes.data || [])

      const attendanceRecordsRes = await supabase
        .from('attendance_records')
        .select('event_id, player_id, attended')

      if (attendanceRecordsRes.error) throw attendanceRecordsRes.error

      const byEvent = {}
      ;(attendanceRecordsRes.data || []).forEach((row) => {
        const eventId = pk(row.event_id)
        if (!byEvent[eventId]) byEvent[eventId] = {}
        byEvent[eventId][pk(row.player_id)] = row.attended === true
      })
      setAttendanceByEvent(byEvent)

      if (loadedGames[0]) {
        setSelectedGameId(pk(loadedGames[0].id))
        setOptimizerExistingGameId(pk(loadedGames[0].id))
      }

      setLoading(false)
    } catch (error) {
      setAppError(error.message || 'Failed to load data.')
      setLoading(false)
    }
  }

  
      function formatValue(actual, total) {
        if (!total) return ''
        return `${actual} (${Math.round((actual / total) * 100)}%)`
      }

      const inSeasonActual = countAttended((event) => event.season_bucket === 'In Season')
      const outSeasonActual = countAttended((event) => event.season_bucket === 'Out of Season')
      const pcActual = countAttended((event) => event.event_type === 'Pitchers/Catchers')
      const teamActual = countAttended((event) => event.event_type === 'Team Practice')
      const indoorActual = countAttended((event) => event.surface === 'Indoor')
      const outdoorActual = countAttended((event) => event.surface === 'Outdoor')

      return {
        playerId: id,
        name: player.name,
        inSeason: formatValue(inSeasonActual, attendanceTotals.inSeason),
        outSeason: formatValue(outSeasonActual, attendanceTotals.outSeason),
        pitchersCatchers: formatValue(pcActual, attendanceTotals.pitchersCatchers),
        teamPractice: formatValue(teamActual, attendanceTotals.teamPractice),
        indoor: formatValue(indoorActual, attendanceTotals.indoor),
        outdoor: formatValue(outdoorActual, attendanceTotals.outdoor),
      }
    })
  }, [activePlayers, filteredAttendanceEvents, attendanceByEvent, attendanceTotals])

  

  function addExistingGameToBatch() {
    if (!optimizerExistingGameId) return

    const gameId = pk(optimizerExistingGameId)
    const game = games.find((g) => pk(g.id) === gameId)
    if (!game) return

    const savedLineup =
      optimizerPreviewByGame[gameId] ||
      lineupsByGame[gameId] ||
      blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

    const normalized = normalizeLineup(
      savedLineup,
      players,
      Number(game.innings || 6),
      savedLineup.availablePlayerIds || activePlayerIds()
    )

    setOptimizerBatchGameIds((current) => [...new Set([...current, gameId])])
    setOptimizerFocusGameId(gameId)
    setOptimizerPreviewByGame((current) => ({
      ...current,
      [gameId]: normalized,
    }))
  }

  function removeBatchGame(gameId) {
    setOptimizerBatchGameIds((current) => current.filter((id) => pk(id) !== pk(gameId)))
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
  }

  function runOptimizeAll() {
    if (!optimizerBatchGames.length) {
      alert('No games in plan')
      return
    }

    let rollingTotals = JSON.parse(JSON.stringify(ytdBeforeTotals))
    const next = {}

    const orderedGames = [...optimizerBatchGames].sort((a, b) => {
      const aKey = `${a.date || ''}-${String(a.game_order || 0).padStart(2, '0')}-${a.id}`
      const bKey = `${b.date || ''}-${String(b.game_order || 0).padStart(2, '0')}-${b.id}`
      return aKey.localeCompare(bKey)
    })

    orderedGames.forEach((game) => {
      const source =
        optimizerPreviewByGame[pk(game.id)] ||
        lineupsByGame[pk(game.id)] ||
        blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

      const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
      if (!availableIds.length) return

      const optimized = buildOptimizedLineup({
        game: { ...game, innings: Number(source?.innings || game.innings || 6) },
        players,
        availablePlayerIds: availableIds,
        sourceLineup: source,
        totalsBefore: rollingTotals,
        priorityMap: priorityByPlayer,
        fitMap: fitByPlayer,
      })

      next[pk(game.id)] = optimized
      rollingTotals = addTotals(rollingTotals, computeTotals([optimized], players), players)
    })

    setOptimizerPreviewByGame((current) => ({ ...current, ...next }))
  }

  function runOptimizeCurrent() {
    if (!optimizerFocusGameId) return
    const confirmed = window.confirm('Optimize only the current selected game?')
    if (!confirmed) return

    const game = games.find((g) => pk(g.id) === pk(optimizerFocusGameId))
    if (!game) return

    const otherPreviewLineups = Object.entries(optimizerPreviewByGame)
      .filter(([gameId]) => pk(gameId) !== pk(optimizerFocusGameId))
      .map(([, lineup]) => lineup)

    const totalsBeforeThisGame = addTotals(
      ytdBeforeTotals,
      computeTotals(otherPreviewLineups, players),
      players
    )

    const source =
      optimizerPreviewByGame[pk(game.id)] ||
      lineupsByGame[pk(game.id)] ||
      blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

    const availableIds = (source.availablePlayerIds || activePlayerIds()).map(pk)
    if (!availableIds.length) return

    const rebuilt = buildOptimizedLineup({
      game: { ...game, innings: Number(source?.innings || game.innings || 6) },
      players,
      availablePlayerIds: availableIds,
      sourceLineup: source,
      totalsBefore: totalsBeforeThisGame,
      priorityMap: priorityByPlayer,
      fitMap: fitByPlayer,
    })

    setOptimizerPreviewByGame((current) => ({
      ...current,
      [pk(game.id)]: rebuilt,
    }))
  }

  function updatePreview(gameId, updater) {
    setOptimizerPreviewByGame((current) => {
      const baseGame = games.find((g) => pk(g.id) === pk(gameId))
      const base =
        current[pk(gameId)] ||
        lineupsByGame[pk(gameId)] ||
        blankLineup(players.map((p) => p.id), Number(baseGame?.innings || 6), activePlayerIds())

      const existing = normalizeLineup(
        base,
        players,
        base.innings || 6,
        base.availablePlayerIds || activePlayerIds()
      )

      const next = updater(JSON.parse(JSON.stringify(existing)))
      return { ...current, [pk(gameId)]: next }
    })
  }

  function togglePreviewAvailable(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      const id = pk(playerId)
      if (lineup.availablePlayerIds.includes(id)) {
        lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => x !== id)
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          lineup.cells[id][inning] = ''
          lineup.lockedCells[id][inning] = false
        }
        lineup.lockedRows[id] = false
        lineup.battingOrder[id] = ''
      } else {
        lineup.availablePlayerIds.push(id)
      }
      return lineup
    })
  }

  function updatePreviewCell(gameId, playerId, inning, value) {
    updatePreview(gameId, (lineup) => {
      lineup.cells[pk(playerId)][inning] = value
      return lineup
    })
  }

  function updatePreviewBatting(gameId, playerId, value) {
    updatePreview(gameId, (lineup) => {
      lineup.battingOrder[pk(playerId)] = value
      return lineup
    })
  }

  function togglePreviewCellLock(gameId, playerId, inning) {
    updatePreview(gameId, (lineup) => {
      lineup.lockedCells[pk(playerId)][inning] = !lineup.lockedCells[pk(playerId)][inning]
      return lineup
    })
  }

  function togglePreviewRowLock(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      lineup.lockedRows[pk(playerId)] = !lineup.lockedRows[pk(playerId)]
      return lineup
    })
  }

  function addPreviewInning(gameId) {
    updatePreview(gameId, (lineup) => {
      const newInning = Number(lineup.innings || 0) + 1
      lineup.innings = newInning

      Object.keys(lineup.cells || {}).forEach((id) => {
        if (!lineup.cells[id]) lineup.cells[id] = {}
        if (!lineup.lockedCells[id]) lineup.lockedCells[id] = {}
        lineup.cells[id][newInning] = ''
        lineup.lockedCells[id][newInning] = false
      })

      return lineup
    })
  }

  function removePreviewInning(gameId, inningToRemove) {
    const confirmed = window.confirm(`Remove inning ${inningToRemove}?`)
    if (!confirmed) return

    updatePreview(gameId, (lineup) => {
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

      lineup.innings = Number(lineup.innings || 0) - 1
      return lineup
    })
  }

  async function savePreview(gameId) {
    const lineup = optimizerPreviewByGame[pk(gameId)]
    if (!lineup) return

    const existing = await supabase
      .from('game_lineups')
      .select('id')
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')
      .maybeSingle()

    if (existing.error) {
      setAppError(existing.error.message)
      return
    }

    const payload = {
      lineup_data: lineup,
      optimizer_meta: {
        innings: lineup.innings,
        availablePlayerIds: lineup.availablePlayerIds,
      },
      lineup_locked: false,
    }

    if (existing.data?.id) {
      const updated = await supabase.from('game_lineups').update(payload).eq('id', existing.data.id)
      if (updated.error) {
        setAppError(updated.error.message)
        return
      }
    } else {
      const inserted = await supabase.from('game_lineups').insert({
        game_id: gameId,
        lineup_name: 'Main',
        ...payload,
      })
      if (inserted.error) {
        setAppError(inserted.error.message)
        return
      }
    }

    await updateGameField(gameId, 'innings', lineup.innings)
    setLineupsByGame((current) => ({ ...current, [pk(gameId)]: JSON.parse(JSON.stringify(lineup)) }))
    setLineupLockedByGame((current) => ({ ...current, [pk(gameId)]: false }))
  }

  function updateSavedLineup(gameId, updater) {
    setLineupsByGame((current) => {
      const existing = current[pk(gameId)]
      if (!existing) return current
      const next = updater(JSON.parse(JSON.stringify(existing)))
      return { ...current, [pk(gameId)]: next }
    })
  }

  function updateSavedCell(gameId, playerId, inning, value) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.cells[pk(playerId)][inning] = value
      autoSave(gameId, lineup)
      return lineup
    })
  }

  function updateSavedBatting(gameId, playerId, value) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.battingOrder[pk(playerId)] = value
      autoSave(gameId, lineup)
      return lineup
    })
  }

  function addSavedInning(gameId) {
    updateSavedLineup(gameId, (lineup) => {
      const newInning = lineup.innings + 1
      lineup.innings = newInning
      Object.keys(lineup.cells).forEach((id) => {
        lineup.cells[id][newInning] = ''
        lineup.lockedCells[id][newInning] = false
      })
      return lineup
    })
  }

  function removeSavedInning(gameId, inningToRemove) {
    const confirmed = window.confirm(`Remove inning ${inningToRemove}?`)
    if (!confirmed) return

    updateSavedLineup(gameId, (lineup) => {
      if (lineup.innings <= 1) return lineup

      Object.keys(lineup.cells).forEach((id) => {
        const newCells = {}
        const newLocks = {}
        let idx = 1

        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          if (inning === inningToRemove) continue
          newCells[idx] = lineup.cells[id][inning] || ''
          newLocks[idx] = lineup.lockedCells[id][inning] || false
          idx += 1
        }

        lineup.cells[id] = newCells
        lineup.lockedCells[id] = newLocks
      })

      lineup.innings -= 1
      return lineup
    })
  }

  async function saveSavedLineup(gameId) {
    const lineup = lineupsByGame[pk(gameId)]
    if (!lineup) return

    const existing = await supabase
      .from('game_lineups')
      .select('id, lineup_locked')
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')
      .maybeSingle()

    if (existing.error) {
      setAppError(existing.error.message)
      return
    }

    if (existing.data?.lineup_locked) {
      setAppError('Unlock the lineup before editing.')
      return
    }

    const payload = {
      lineup_data: lineup,
      optimizer_meta: {
        innings: lineup.innings,
        availablePlayerIds: lineup.availablePlayerIds,
      },
      lineup_locked: false,
    }

    if (existing.data?.id) {
      const updated = await supabase.from('game_lineups').update(payload).eq('id', existing.data.id)
      if (updated.error) {
        setAppError(updated.error.message)
        return
      }
    } else {
      const inserted = await supabase.from('game_lineups').insert({
        game_id: gameId,
        lineup_name: 'Main',
        ...payload,
      })
      if (inserted.error) {
        setAppError(inserted.error.message)
        return
      }
    }

    await updateGameField(gameId, 'innings', lineup.innings)
  }

  async function toggleLineupLocked(gameId, nextLocked) {
    const existing = await supabase
      .from('game_lineups')
      .select('id')
      .eq('game_id', gameId)
      .eq('lineup_name', 'Main')
      .maybeSingle()

    if (existing.error) {
      setAppError(existing.error.message)
      return
    }

    if (!existing.data?.id) {
      setAppError('Save the lineup before locking it.')
      return
    }

    const updated = await supabase
      .from('game_lineups')
      .update({ lineup_locked: nextLocked })
      .eq('id', existing.data.id)

    if (updated.error) {
      setAppError(updated.error.message)
      return
    }

    setLineupLockedByGame((current) => ({ ...current, [pk(gameId)]: nextLocked }))
  }

  function clearSavedLineup(gameId) {
    if (lineupLockedByGame[pk(gameId)]) {
      setAppError('Unlock the lineup before clearing it.')
      return
    }

    const confirmed = window.confirm('Clear the lineup for this game?')
    if (!confirmed) return

    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })
  }

  function toggleSavedAvailable(gameId, playerId) {
    updateSavedLineup(gameId, (lineup) => {
      const id = pk(playerId)
      if (lineup.availablePlayerIds.includes(id)) {
        lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => x !== id)
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          lineup.cells[id][inning] = ''
          lineup.lockedCells[id][inning] = false
        }
        lineup.lockedRows[id] = false
        lineup.battingOrder[id] = ''
      } else {
        lineup.availablePlayerIds.push(id)
      }
      return lineup
    })
  }

