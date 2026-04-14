import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import Sidebar from './components/Sidebar'
import PlayersPage from './pages/PlayersPage'
import PositioningPriorityPage from './pages/PositioningPriorityPage'
import GamesPage from './pages/GamesPage'
import OptimizerPage from './pages/OptimizerPage'
import GameDetailPage from './pages/GameDetailPage'
import TrackingPage from './pages/TrackingPage'
import {
  PRIORITY_POSITIONS,
  ALLOWED_POSITIONS,
  GAME_TYPES,
  pk,
  blankLineup,
  normalizeLineup,
  computeTotals,
  addTotals,
  buildOptimizedLineup,
} from './lib/lineupUtils'

const TEAM_ID = 'f76ea5a1-7c44-4789-bfbd-9771edd54f10'

function dbReady() {
  return Boolean(supabase)
}

export default function App() {
  const [page, setPage] = useState('games')
  const [loading, setLoading] = useState(true)
  const [appError, setAppError] = useState('')

  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [lineupsByGame, setLineupsByGame] = useState({})
  const [lineupLockedByGame, setLineupLockedByGame] = useState({})
  const [priorityByPlayer, setPriorityByPlayer] = useState({})
  const [fitByPlayer, setFitByPlayer] = useState({})

  const [selectedGameId, setSelectedGameId] = useState('')
  const [optimizerExistingGameId, setOptimizerExistingGameId] = useState('')
  const [optimizerFocusGameId, setOptimizerFocusGameId] = useState('')
  const [optimizerBatchGameIds, setOptimizerBatchGameIds] = useState([])
  const [optimizerPreviewByGame, setOptimizerPreviewByGame] = useState({})

  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [newGameType, setNewGameType] = useState('Friendly')

  const [optimizerNewDate, setOptimizerNewDate] = useState('')
  const [optimizerNewOpponent, setOptimizerNewOpponent] = useState('')
  const [optimizerNewType, setOptimizerNewType] = useState('Friendly')

  useEffect(() => {
    loadAll()
  }, [])

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
        .select('id, game_date, opponent, innings, status, game_type')
        .eq('team_id', TEAM_ID)
        .order('game_date', { ascending: true, nullsFirst: false })

      if (gamesRes.error) throw gamesRes.error

      const loadedGames = (gamesRes.data || []).map((row) => ({
        id: row.id,
        date: row.game_date || '',
        opponent: row.opponent || '',
        innings: Number(row.innings || 6),
        status: row.status || 'Empty',
        game_type: row.game_type || 'Friendly',
      }))
      setGames(loadedGames)

      const lineupRes = await supabase
        .from('game_lineups')
        .select('game_id, lineup_data, optimizer_meta, lineup_locked')
        .eq('lineup_name', 'Main')

      if (lineupRes.error) throw lineupRes.error

      const nextLineups = {}
      const nextLocked = {}

      ;(lineupRes.data || []).forEach((row) => {
        nextLineups[String(row.game_id)] = normalizeLineup(
          row.lineup_data || {},
          loadedPlayers,
          Number(row.optimizer_meta?.innings || 6),
          row.optimizer_meta?.availablePlayerIds ||
            loadedPlayers.filter((p) => p.active !== false).map((p) => p.id)
        )
        nextLocked[String(row.game_id)] = row.lineup_locked === true
      })

      setLineupsByGame(nextLineups)
      setLineupLockedByGame(nextLocked)

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
        const id = String(row.player_id)
        if (!nextPriority[id]) nextPriority[id] = {}
        if (PRIORITY_POSITIONS.includes(row.position)) {
          nextPriority[id][row.position] = {
            priority_pct: row.priority_pct ?? '',
          }
        }
      })

      ;(allowedRes.data || []).forEach((row) => {
        const id = String(row.player_id)
        if (!nextFit[id]) nextFit[id] = {}
        if (ALLOWED_POSITIONS.includes(row.position)) {
          nextFit[id][row.position] = row.fit_tier || 'secondary'
        }
      })

      setPriorityByPlayer(nextPriority)
      setFitByPlayer(nextFit)

      if (loadedGames[0]) {
        setSelectedGameId(String(loadedGames[0].id))
        setOptimizerExistingGameId(String(loadedGames[0].id))
      }

      setLoading(false)
    } catch (error) {
      setAppError(error.message || 'Failed to load app.')
      setLoading(false)
    }
  }

  const activePlayers = useMemo(() => players.filter((p) => p.active !== false), [players])

  const selectedGame = useMemo(
    () => games.find((g) => String(g.id) === String(selectedGameId)) || null,
    [games, selectedGameId]
  )

  const selectedLineup = useMemo(
    () => (selectedGame ? lineupsByGame[String(selectedGame.id)] || null : null),
    [selectedGame, lineupsByGame]
  )

  const selectedLocked = useMemo(
    () => (selectedGame ? lineupLockedByGame[String(selectedGame.id)] === true : false),
    [selectedGame, lineupLockedByGame]
  )

  const optimizerBatchGames = useMemo(
    () => games.filter((g) => optimizerBatchGameIds.includes(String(g.id))),
    [games, optimizerBatchGameIds]
  )

  const optimizerFocusGame = useMemo(
    () => games.find((g) => String(g.id) === String(optimizerFocusGameId)) || null,
    [games, optimizerFocusGameId]
  )

  const optimizerFocusLineup = useMemo(
    () => optimizerPreviewByGame[String(optimizerFocusGameId)] || null,
    [optimizerPreviewByGame, optimizerFocusGameId]
  )

  const ytdBeforeLockedGames = useMemo(() => {
    return games.filter(
      (g) =>
        lineupLockedByGame[String(g.id)] === true &&
        !optimizerBatchGameIds.includes(String(g.id)) &&
        lineupsByGame[String(g.id)]
    )
  }, [games, lineupLockedByGame, optimizerBatchGameIds, lineupsByGame])

  const ytdBeforeTotals = useMemo(() => {
    const lineups = ytdBeforeLockedGames.map((g) => lineupsByGame[String(g.id)])
    return computeTotals(lineups, players)
  }, [ytdBeforeLockedGames, lineupsByGame, players])

  const currentBatchTotals = useMemo(() => {
    return computeTotals(Object.values(optimizerPreviewByGame), players)
  }, [optimizerPreviewByGame, players])

  const ytdAfterTotals = useMemo(() => {
    return addTotals(ytdBeforeTotals, currentBatchTotals, players)
  }, [ytdBeforeTotals, currentBatchTotals, players])

  function activePlayerIds() {
    return activePlayers.map((p) => String(p.id))
  }

  async function addGame(date, opponent, gameType) {
    const res = await supabase
      .from('games')
      .insert({
        team_id: TEAM_ID,
        game_date: date || null,
        opponent: opponent || null,
        innings: 6,
        status: 'Empty',
        game_type: gameType || 'Friendly',
      })
      .select()
      .single()

    if (res.error) {
      setAppError(res.error.message)
      return null
    }

    const game = {
      id: res.data.id,
      date: res.data.game_date || '',
      opponent: res.data.opponent || '',
      innings: Number(res.data.innings || 6),
      status: res.data.status || 'Empty',
      game_type: res.data.game_type || 'Friendly',
    }

    setGames((current) => [...current, game])
    return game
  }

  async function addGameFromGames() {
    const game = await addGame(newGameDate, newGameOpponent, newGameType)
    if (game) {
      setNewGameDate('')
      setNewGameOpponent('')
      setNewGameType('Friendly')
      setSelectedGameId(String(game.id))
    }
  }

  async function addGameFromOptimizer() {
    const game = await addGame(optimizerNewDate, optimizerNewOpponent, optimizerNewType)
    if (game) {
      const id = String(game.id)
      setOptimizerBatchGameIds((current) => [...new Set([...current, id])])
      setOptimizerFocusGameId(id)
      setOptimizerExistingGameId(id)
      setOptimizerNewDate('')
      setOptimizerNewOpponent('')
      setOptimizerNewType('Friendly')
    }
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((g) => (String(g.id) === String(gameId) ? { ...g, [field]: value } : g))
    )

    const updates = {}
    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'innings') updates.innings = Number(value)
    if (field === 'status') updates.status = value
    if (field === 'game_type') updates.game_type = value

    const res = await supabase.from('games').update(updates).eq('id', gameId)
    if (res.error) setAppError(res.error.message)
  }

  async function deleteGame(gameId) {
    if (lineupLockedByGame[String(gameId)]) {
      setAppError('Unlock the lineup before deleting the game.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this game?')) return

    const delLineup = await supabase.from('game_lineups').delete().eq('game_id', gameId)
    if (delLineup.error) {
      setAppError(delLineup.error.message)
      return
    }

    const delGame = await supabase.from('games').delete().eq('id', gameId)
    if (delGame.error) {
      setAppError(delGame.error.message)
      return
    }

    setGames((current) => current.filter((g) => String(g.id) !== String(gameId)))
    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
    setLineupLockedByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
    setOptimizerBatchGameIds((current) => current.filter((id) => String(id) !== String(gameId)))
  }

  async function upsertPlayer(player) {
    if (!player.name?.trim()) return

    if (player.id) {
      const res = await supabase
        .from('players')
        .update({
          name: player.name,
          jersey_number: player.jersey_number || null,
          active: player.active,
        })
        .eq('id', player.id)

      if (res.error) setAppError(res.error.message)
      return
    }

    const res = await supabase
      .from('players')
      .insert({
        team_id: TEAM_ID,
        name: player.name,
        jersey_number: player.jersey_number || null,
        active: player.active,
      })
      .select('id, name, jersey_number, active')
      .single()

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    setPlayers((current) => [...current, res.data])
  }

  async function deletePlayer(playerId) {
    if (!window.confirm('Delete this player?')) return

    const res = await supabase.from('players').delete().eq('id', playerId)
    if (res.error) {
      setAppError(res.error.message)
      return
    }

    setPlayers((current) => current.filter((p) => String(p.id) !== String(playerId)))
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
      return
    }

    const res = await supabase
      .from('player_position_preferences')
      .upsert(
        {
          player_id: playerId,
          position,
          priority_pct: Number(cleaned),
        },
        { onConflict: 'player_id,position' }
      )

    if (res.error) setAppError(res.error.message)
  }

  async function persistFitTier(playerId, position, tier) {
    const res = await supabase
      .from('player_allowed_positions')
      .upsert(
        {
          player_id: playerId,
          position,
          fit_tier: tier,
        },
        { onConflict: 'player_id,position' }
      )

    if (res.error) setAppError(res.error.message)
  }

  function updatePriorityLocal(playerId, position, value) {
    setPriorityByPlayer((current) => ({
      ...current,
      [String(playerId)]: {
        ...(current[String(playerId)] || {}),
        [position]: { priority_pct: value },
      },
    }))
  }

  function updateFitLocal(playerId, position, tier) {
    setFitByPlayer((current) => ({
      ...current,
      [String(playerId)]: {
        ...(current[String(playerId)] || {}),
        [position]: tier,
      },
    }))
  }

  function addExistingGameToBatch() {
    if (!optimizerExistingGameId) return
    setOptimizerBatchGameIds((current) => [...new Set([...current, String(optimizerExistingGameId)])])
    setOptimizerFocusGameId(String(optimizerExistingGameId))
  }

  function removeBatchGame(gameId) {
    setOptimizerBatchGameIds((current) => current.filter((id) => String(id) !== String(gameId)))
    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })
  }

  function updatePreview(gameId, updater) {
    setOptimizerPreviewByGame((current) => {
      const game = games.find((g) => String(g.id) === String(gameId))
      const base =
        current[String(gameId)] ||
        lineupsByGame[String(gameId)] ||
        blankLineup(players.map((p) => p.id), Number(game?.innings || 6), activePlayerIds())

      const working = normalizeLineup(
        base,
        players,
        Number(game?.innings || 6),
        base.availablePlayerIds || activePlayerIds()
      )

      const next = updater(JSON.parse(JSON.stringify(working)))
      return { ...current, [String(gameId)]: next }
    })
  }

  function togglePreviewAvailable(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      const id = String(playerId)
      if (lineup.availablePlayerIds.includes(id)) {
        lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => x !== id)
        delete lineup.battingOrder[id]
        delete lineup.cells[id]
        delete lineup.lockedCells[id]
        delete lineup.lockedRows[id]
      } else {
        lineup.availablePlayerIds.push(id)
        lineup.battingOrder[id] = lineup.battingOrder[id] || ''
        lineup.cells[id] = lineup.cells[id] || {}
        lineup.lockedCells[id] = lineup.lockedCells[id] || {}
        lineup.lockedRows[id] = lineup.lockedRows[id] || false
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          if (lineup.cells[id][inning] === undefined) lineup.cells[id][inning] = ''
          if (lineup.lockedCells[id][inning] === undefined) lineup.lockedCells[id][inning] = false
        }
      }
      return lineup
    })
  }

  function updatePreviewCell(gameId, playerId, inning, value) {
    updatePreview(gameId, (lineup) => {
      if (!lineup.cells[String(playerId)]) return lineup
      lineup.cells[String(playerId)][inning] = value
      return lineup
    })
  }

  function updatePreviewBatting(gameId, playerId, value) {
    updatePreview(gameId, (lineup) => {
      lineup.battingOrder[String(playerId)] = value
      return lineup
    })
  }

  function togglePreviewCellLock(gameId, playerId, inning) {
    updatePreview(gameId, (lineup) => {
      if (!lineup.lockedCells[String(playerId)]) return lineup
      lineup.lockedCells[String(playerId)][inning] = !lineup.lockedCells[String(playerId)][inning]
      return lineup
    })
  }

  function togglePreviewRowLock(gameId, playerId) {
    updatePreview(gameId, (lineup) => {
      lineup.lockedRows[String(playerId)] = !lineup.lockedRows[String(playerId)]
      return lineup
    })
  }

  function buildBatch() {
    let rollingTotals = JSON.parse(JSON.stringify(ytdBeforeTotals))
    const next = {}

    const orderedGames = [...optimizerBatchGames].sort((a, b) => {
      const ak = `${a.date || ''}-${a.id}`
      const bk = `${b.date || ''}-${b.id}`
      return ak.localeCompare(bk)
    })

    orderedGames.forEach((game) => {
      const source =
        optimizerPreviewByGame[String(game.id)] ||
        lineupsByGame[String(game.id)] ||
        blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

      const optimized = buildOptimizedLineup({
        game,
        players,
        availableIds: (source.availablePlayerIds || activePlayerIds()).map(String),
        sourceLineup: source,
        totalsBefore: rollingTotals,
        priorityByPlayer,
        fitByPlayer,
      })

      next[String(game.id)] = optimized
      rollingTotals = addTotals(rollingTotals, computeTotals([optimized], players), players)
    })

    setOptimizerPreviewByGame(next)
  }

  async function savePreview(gameId) {
    const lineup = optimizerPreviewByGame[String(gameId)]
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
    await updateGameField(gameId, 'status', 'Saved')

    setLineupsByGame((current) => ({
      ...current,
      [String(gameId)]: JSON.parse(JSON.stringify(lineup)),
    }))
    setLineupLockedByGame((current) => ({ ...current, [String(gameId)]: false }))
  }

  function updateSavedLineup(gameId, updater) {
    setLineupsByGame((current) => {
      const existing = current[String(gameId)]
      if (!existing) return current
      const next = updater(JSON.parse(JSON.stringify(existing)))
      return { ...current, [String(gameId)]: next }
    })
  }

  function updateSavedCell(gameId, playerId, inning, value) {
    updateSavedLineup(gameId, (lineup) => {
      if (!lineup.cells[String(playerId)]) return lineup
      lineup.cells[String(playerId)][inning] = value
      return lineup
    })
  }

  function updateSavedBatting(gameId, playerId, value) {
    updateSavedLineup(gameId, (lineup) => {
      lineup.battingOrder[String(playerId)] = value
      return lineup
    })
  }

  function toggleSavedAvailability(gameId, playerId) {
    updateSavedLineup(gameId, (lineup) => {
      const id = String(playerId)
      if (lineup.availablePlayerIds.includes(id)) {
        if (!window.confirm('Remove this player from this game?')) return lineup
        lineup.availablePlayerIds = lineup.availablePlayerIds.filter((x) => x !== id)
        delete lineup.battingOrder[id]
        delete lineup.cells[id]
        delete lineup.lockedCells[id]
        delete lineup.lockedRows[id]
      } else {
        lineup.availablePlayerIds.push(id)
        lineup.battingOrder[id] = lineup.battingOrder[id] || ''
        lineup.cells[id] = lineup.cells[id] || {}
        lineup.lockedCells[id] = lineup.lockedCells[id] || {}
        lineup.lockedRows[id] = lineup.lockedRows[id] || false
        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          if (lineup.cells[id][inning] === undefined) lineup.cells[id][inning] = ''
          if (lineup.lockedCells[id][inning] === undefined) lineup.lockedCells[id][inning] = false
        }
      }
      return lineup
    })
  }

  function addSavedInning(gameId) {
    updateSavedLineup(gameId, (lineup) => {
      const nextInning = lineup.innings + 1
      lineup.innings = nextInning
      Object.keys(lineup.cells).forEach((id) => {
        lineup.cells[id][nextInning] = ''
        lineup.lockedCells[id][nextInning] = false
      })
      return lineup
    })
  }

  function removeSavedInning(gameId, inningToRemove) {
    if (!window.confirm(`Remove inning ${inningToRemove}?`)) return

    updateSavedLineup(gameId, (lineup) => {
      if (lineup.innings <= 1) return lineup

      Object.keys(lineup.cells).forEach((id) => {
        const newCells = {}
        const newLocks = {}
        let nextIdx = 1

        for (let inning = 1; inning <= lineup.innings; inning += 1) {
          if (inning === inningToRemove) continue
          newCells[nextIdx] = lineup.cells[id][inning] || ''
          newLocks[nextIdx] = lineup.lockedCells[id][inning] || false
          nextIdx += 1
        }

        lineup.cells[id] = newCells
        lineup.lockedCells[id] = newLocks
      })

      lineup.innings -= 1
      return lineup
    })
  }

  async function saveSavedLineup(gameId) {
    const lineup = lineupsByGame[String(gameId)]
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
        lineup_locked: false,
        ...payload,
      })
      if (inserted.error) {
        setAppError(inserted.error.message)
        return
      }
    }

    await updateGameField(gameId, 'innings', lineup.innings)
    await updateGameField(gameId, 'status', 'Saved')
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

    const res = await supabase
      .from('game_lineups')
      .update({ lineup_locked: nextLocked })
      .eq('id', existing.data.id)

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    setLineupLockedByGame((current) => ({
      ...current,
      [String(gameId)]: nextLocked,
    }))

    await updateGameField(gameId, 'status', nextLocked ? 'Locked' : 'Saved')
  }

  function clearSavedLineup(gameId) {
    if (lineupLockedByGame[String(gameId)]) {
      setAppError('Unlock the lineup before clearing it.')
      return
    }

    if (!window.confirm('Clear lineup for this game?')) return

    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[String(gameId)]
      return next
    })

    updateGameField(gameId, 'status', 'Empty')
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />

      <main className="main-content">
        {appError && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ color: '#b91c1c', margin: 0 }}>Error: {appError}</p>
          </div>
        )}

        {page === 'players' && (
          <PlayersPage
            players={players}
            loading={loading}
            onAddPlayer={upsertPlayer}
            onUpdatePlayer={upsertPlayer}
            onDeletePlayer={deletePlayer}
          />
        )}

        {page === 'positioning-priority' && (
          <PositioningPriorityPage
            players={players}
            activePlayers={activePlayers}
            priorityByPlayer={priorityByPlayer}
            fitByPlayer={fitByPlayer}
            onPriorityLocal={updatePriorityLocal}
            onPrioritySave={persistPriority}
            onFitLocal={updateFitLocal}
            onFitSave={persistFitTier}
          />
        )}

        {page === 'games' && (
          <GamesPage
            loading={loading}
            games={games}
            lineupsByGame={lineupsByGame}
            lineupLockedByGame={lineupLockedByGame}
            newGameDate={newGameDate}
            setNewGameDate={setNewGameDate}
            newGameOpponent={newGameOpponent}
            setNewGameOpponent={setNewGameOpponent}
            newGameType={newGameType}
            setNewGameType={setNewGameType}
            onAddGame={addGameFromGames}
            onReload={loadAll}
            onUpdateGameField={updateGameField}
            onDeleteGame={deleteGame}
            onOpenGame={(gameId) => {
              setSelectedGameId(String(gameId))
              setPage('game-detail')
            }}
          />
        )}

        {page === 'game-detail' && (
          <GameDetailPage
            games={games}
            selectedGame={selectedGame}
            selectedLineup={selectedLineup}
            selectedLocked={selectedLocked}
            players={players}
            fitByPlayer={fitByPlayer}
            onSelectGame={(gameId) => {
              setSelectedGameId(String(gameId))
            }}
            onAddInning={addSavedInning}
            onRemoveInning={removeSavedInning}
            onSaveLineup={saveSavedLineup}
            onToggleLocked={toggleLineupLocked}
            onClearLineup={clearSavedLineup}
            onCellChange={updateSavedCell}
            onBattingChange={updateSavedBatting}
            onToggleAvailability={toggleSavedAvailability}
          />
        )}

        {page === 'optimizer' && (
          <OptimizerPage
            games={games}
            players={players}
            activePlayers={activePlayers}
            fitByPlayer={fitByPlayer}
            lineupsByGame={lineupsByGame}
            optimizerExistingGameId={optimizerExistingGameId}
            setOptimizerExistingGameId={setOptimizerExistingGameId}
            optimizerFocusGameId={optimizerFocusGameId}
            setOptimizerFocusGameId={setOptimizerFocusGameId}
            optimizerBatchGameIds={optimizerBatchGameIds}
            optimizerPreviewByGame={optimizerPreviewByGame}
            optimizerBatchGames={optimizerBatchGames}
            optimizerFocusGame={optimizerFocusGame}
            optimizerFocusLineup={optimizerFocusLineup}
            optimizerNewDate={optimizerNewDate}
            setOptimizerNewDate={setOptimizerNewDate}
            optimizerNewOpponent={optimizerNewOpponent}
            setOptimizerNewOpponent={setOptimizerNewOpponent}
            optimizerNewType={optimizerNewType}
            setOptimizerNewType={setOptimizerNewType}
            ytdBeforeTotals={ytdBeforeTotals}
            currentBatchTotals={currentBatchTotals}
            ytdAfterTotals={ytdAfterTotals}
            ytdBeforeLockedGames={ytdBeforeLockedGames}
            onAddExistingGame={addExistingGameToBatch}
            onAddGame={addGameFromOptimizer}
            onRemoveBatchGame={removeBatchGame}
            onBuildBatch={buildBatch}
            onSavePreview={savePreview}
            onTogglePreviewAvailable={togglePreviewAvailable}
            onCellChange={updatePreviewCell}
            onBattingChange={updatePreviewBatting}
            onCellLockToggle={togglePreviewCellLock}
            onRowLockToggle={togglePreviewRowLock}
          />
        )}

        {page === 'tracking' && (
          <TrackingPage
            games={games}
            players={players}
            lineupsByGame={lineupsByGame}
            lineupLockedByGame={lineupLockedByGame}
            priorityByPlayer={priorityByPlayer}
          />
        )}
      </main>
    </div>
  )
}
