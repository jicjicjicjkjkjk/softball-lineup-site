const activePlayers = useMemo(() => players.filter((p) => p.active !== false), [players])

  function activePlayerIds() {
    return activePlayers.map((p) => pk(p.id))
  }

  const selectedGame = useMemo(
    () => games.find((game) => pk(game.id) === pk(selectedGameId)) || null,
    [games, selectedGameId]
  )

  const selectedLineup = useMemo(
    () => (selectedGame ? lineupsByGame[pk(selectedGame.id)] || null : null),
    [selectedGame, lineupsByGame]
  )

  const selectedLocked = useMemo(
    () => (selectedGame ? lineupLockedByGame[pk(selectedGame.id)] === true : false),
    [selectedGame, lineupLockedByGame]
  )

  const sortedPlayers = useMemo(() => {
    return sortRows(
      players.map((player) => ({
        ...player,
        activeText: player.active === false ? 'No' : 'Yes',
      })),
      playerSort
    )
  }, [players, playerSort])

  const sortedGames = useMemo(() => {
    return sortRows(
      games.map((game) => ({
        ...game,
        lineupState: lineupLockedByGame[pk(game.id)] ? 'Locked' : lineupsByGame[pk(game.id)] ? 'Saved' : 'Empty',
      })),
      gameSort
    )
  }, [games, lineupsByGame, lineupLockedByGame, gameSort])

  const orderedGamesAsc = useMemo(() => {
  return [...games].sort((a, b) => compareGamesAsc(a, b, pk))
}, [games])

  const activePriorityRows = useMemo(() => {
    return sortRows(
      activePlayers.map((player) => {
        const pr = priorityByPlayer[pk(player.id)] || {}

        return {
          playerId: pk(player.id),
          name: player.name,
          jersey_number: player.jersey_number || '',
          P: pr.P?.priority_pct || '',
          C: pr.C?.priority_pct || '',
          '1B': pr['1B']?.priority_pct || '',
          '2B': pr['2B']?.priority_pct || '',
          '3B': pr['3B']?.priority_pct || '',
          SS: pr.SS?.priority_pct || '',
          OF: pr.OF?.priority_pct || '',
          subtotal:
            Number(pr.P?.priority_pct || 0) +
            Number(pr.C?.priority_pct || 0) +
            Number(pr['1B']?.priority_pct || 0) +
            Number(pr['2B']?.priority_pct || 0) +
            Number(pr['3B']?.priority_pct || 0) +
            Number(pr.SS?.priority_pct || 0) +
            Number(pr.OF?.priority_pct || 0),
        }
      }),
      prioritySort
    )
  }, [activePlayers, priorityByPlayer, prioritySort])

  const allowedRows = useMemo(() => {
    return sortRows(
      activePlayers.map((player) => {
        const fit = fitByPlayer[pk(player.id)] || {}
        return {
          playerId: pk(player.id),
          name: player.name,
          jersey_number: player.jersey_number || '',
          P: fit.P || '',
          C: fit.C || '',
          '1B': fit['1B'] || '',
          '2B': fit['2B'] || '',
          '3B': fit['3B'] || '',
          SS: fit.SS || '',
          LF: fit.LF || '',
          CF: fit.CF || '',
          RF: fit.RF || '',
        }
      }),
      allowedSort
    )
  }, [activePlayers, fitByPlayer, allowedSort])

  const priorityFooter = useMemo(() => {
    const footer = {}
    PRIORITY_POSITIONS.forEach((pos) => {
      footer[pos] = activePriorityRows.reduce((sum, row) => sum + Number(row[pos] || 0), 0)
    })
    footer.subtotal = PRIORITY_POSITIONS.reduce((sum, pos) => sum + Number(footer[pos] || 0), 0)
    return footer
  }, [activePriorityRows])

  const optimizerBatchGames = useMemo(
    () => games.filter((game) => optimizerBatchGameIds.includes(pk(game.id))),
    [games, optimizerBatchGameIds]
  )

  const optimizerFocusGame = useMemo(
    () => games.find((game) => pk(game.id) === pk(optimizerFocusGameId)) || null,
    [games, optimizerFocusGameId]
  )

  const optimizerFocusLineup = useMemo(
    () => optimizerPreviewByGame[pk(optimizerFocusGameId)] || null,
    [optimizerPreviewByGame, optimizerFocusGameId]
  )

  const lockedLineupsOnly = useMemo(() => {
    return Object.entries(lineupsByGame)
      .filter(([gameId]) => lineupLockedByGame[pk(gameId)] === true)
      .map(([, lineup]) => lineup)
  }, [lineupsByGame, lineupLockedByGame])

  const trackingLockedLineups = useMemo(() => {
    return orderedGamesAsc
      .filter((game) => lineupLockedByGame[pk(game.id)] === true)
      .map((game) => lineupsByGame[pk(game.id)])
      .filter(Boolean)
  }, [orderedGamesAsc, lineupLockedByGame, lineupsByGame])

  const ytdBeforeTotals = useMemo(() => computeTotals(lockedLineupsOnly, players), [lockedLineupsOnly, players])
  const currentBatchTotals = useMemo(() => computeTotals(Object.values(optimizerPreviewByGame), players), [optimizerPreviewByGame, players])
  const ytdAfterTotals = useMemo(() => addTotals(ytdBeforeTotals, currentBatchTotals, players), [ytdBeforeTotals, currentBatchTotals, players])

  const trackingTotals = useMemo(() => computeTotals(trackingLockedLineups, players), [trackingLockedLineups, players])

  const battingRows = useMemo(
  () =>
    buildBattingOrderMatrix(
      orderedGamesAsc.filter((g) => lineupsByGame[pk(g.id)]),
      lineupsByGame,
      activePlayers,
      pk
    ),
  [orderedGamesAsc, lineupsByGame, activePlayers]
)

  const sitSummary = useMemo(
  () =>
    buildSitOutSummary(
      orderedGamesAsc.filter((g) => lineupsByGame[pk(g.id)]),
      lineupsByGame,
      activePlayers,
      pk
    ),
  [orderedGamesAsc, lineupsByGame, activePlayers]
)

  const sitByPlayer = useMemo(
  () =>
    buildPlayerSitOuts(
      orderedGamesAsc.filter((g) => lineupsByGame[pk(g.id)]),
      lineupsByGame,
      activePlayers,
      pk,
      requiredOutsForGame
    ),
  [orderedGamesAsc, lineupsByGame, activePlayers]
)

 const selectedPlayerPositions = useMemo(() => {
  if (!trackingPlayerId) return []
  return buildPositionByPlayer(
    orderedGamesAsc.filter((g) => lineupsByGame[pk(g.id)]),
    lineupsByGame,
    pk(trackingPlayerId),
    pk
  )
}, [trackingPlayerId, orderedGamesAsc, lineupsByGame])

  const trackingPriorityRows = useMemo(() => {
    return sortRows(
      activePlayers.map((player) => {
        const totals = trackingTotals[pk(player.id)] || {}
        const priority = priorityByPlayer[pk(player.id)] || {}
        const fieldTotal = Math.max(totals.fieldTotal || 0, 1)

        const actPct = (n) => {
          const value = Number((((n || 0) / fieldTotal) * 100).toFixed(1))
          return value === 0 ? '' : value
        }

        return {
          playerId: pk(player.id),
          name: player.name,
          fieldTotal: totals.fieldTotal || 0,
          targP: priority.P?.priority_pct || '',
          targC: priority.C?.priority_pct || '',
          targ1B: priority['1B']?.priority_pct || '',
          targ2B: priority['2B']?.priority_pct || '',
          targ3B: priority['3B']?.priority_pct || '',
          targSS: priority.SS?.priority_pct || '',
          targOF: priority.OF?.priority_pct || '',
          actP: actPct(totals.P),
          actC: actPct(totals.C),
          act1B: actPct(totals['1B']),
          act2B: actPct(totals['2B']),
          act3B: actPct(totals['3B']),
          actSS: actPct(totals.SS),
          actOF: actPct(totals.OF),
        }
      }),
      trackingSort
    )
  }, [activePlayers, trackingTotals, priorityByPlayer, trackingSort])

  const filteredAttendanceEvents = useMemo(() => {
    return sortRows(attendanceEvents, attendanceSort)
  }, [attendanceEvents, attendanceSort])

  const attendanceTotals = useMemo(() => {
    const events = filteredAttendanceEvents
    return {
      inSeason: events.filter((e) => e.season_bucket === 'In Season').length,
      outSeason: events.filter((e) => e.season_bucket === 'Out of Season').length,
      pitchersCatchers: events.filter((e) => e.event_type === 'Pitchers/Catchers').length,
      teamPractice: events.filter((e) => e.event_type === 'Team Practice').length,
      indoor: events.filter((e) => e.surface === 'Indoor').length,
      outdoor: events.filter((e) => e.surface === 'Outdoor').length,
    }
  }, [filteredAttendanceEvents])

  const attendanceBreakdownByPlayer = useMemo(() => {
    return activePlayers.map((player) => {
      const id = pk(player.id)
      const eventRows = filteredAttendanceEvents

      function countAttended(predicate) {
        return eventRows.filter(predicate).filter((event) => attendanceByEvent[pk(event.id)]?.[id] === true).length
      }

