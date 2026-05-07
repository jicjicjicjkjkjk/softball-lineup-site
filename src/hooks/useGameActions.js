// FILE: src/hooks/useGameActions.js

import { supabase } from '../lib/supabase'
import { TEAM_ID } from '../lib/constants'
import { GAME_TYPES, pk, blankLineup } from '../lib/lineupUtils'
import { getNextGameOrder } from '../lib/appHelpers'

export function useGameActions({
  games,
  setGames,
  players,
  activePlayerIds,
  lineupsByGame,
  setLineupsByGame,
  lineupLockedByGame,
  setLineupLockedByGame,
  optimizerPreviewByGame,
  setOptimizerPreviewByGame,
  optimizerBatchGameIds,
  setOptimizerBatchGameIds,
  setOptimizerFocusGameId,
  setOptimizerExistingGameId,
  setSelectedGameId,
  currentPlanLineupsByGame,
  defaultStatusOption,
  newGameDate,
  setNewGameDate,
  newGameOpponent,
  setNewGameOpponent,
  newGameType,
  setNewGameType,
  newGameSeason,
  setNewGameSeason,
  optimizerNewDate,
  setOptimizerNewDate,
  optimizerNewOpponent,
  setOptimizerNewOpponent,
  optimizerNewType,
  setOptimizerNewType,
  optimizerNewSeason,
  setOptimizerNewSeason,
  persistLineup,
  setAppError,
}) {
  async function addGame(date, opponent, gameType, season) {
    const nextOrder = getNextGameOrder(games)

    const res = await supabase
      .from('games')
      .insert({
        team_id: TEAM_ID,
        game_date: date || null,
        opponent: opponent || null,
        innings: 6,
        status: defaultStatusOption?.value || defaultStatusOption?.label || 'Planned',
        game_type: gameType || GAME_TYPES[0],
        season: season || null,
        game_order: nextOrder,
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
      status: res.data.status || 'Planned',
      game_type: res.data.game_type || '',
      season: res.data.season || '',
      game_order: Number(res.data.game_order || nextOrder),
    }

    setGames((current) => [...current, game])
    return game
  }

  async function addGameFromGames() {
    const game = await addGame(
      newGameDate,
      newGameOpponent,
      newGameType,
      newGameSeason
    )

    if (!game) return

    setNewGameDate('')
    setNewGameOpponent('')
    setNewGameType('')
    setNewGameSeason('')
    setSelectedGameId(pk(game.id))
  }

  async function addGameFromOptimizer() {
    const game = await addGame(
      optimizerNewDate,
      optimizerNewOpponent,
      optimizerNewType,
      optimizerNewSeason
    )

    if (!game) return

    setOptimizerNewDate('')
    setOptimizerNewOpponent('')
    setOptimizerNewType('')
    setOptimizerNewSeason('')

    setOptimizerBatchGameIds((current) => [...new Set([...current, pk(game.id)])])
    setOptimizerFocusGameId(pk(game.id))
    setOptimizerExistingGameId(pk(game.id))

    setOptimizerPreviewByGame((current) => ({
      ...current,
      [pk(game.id)]: blankLineup(
        players.map((p) => p.id),
        Number(game.innings || 6),
        activePlayerIds()
      ),
    }))
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((game) =>
        pk(game.id) === pk(gameId) ? { ...game, [field]: value } : game
      )
    )

    const updates = {}
    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'innings') updates.innings = Number(value)
    if (field === 'status') updates.status = value
    if (field === 'game_type') updates.game_type = value || null
    if (field === 'season') updates.season = value || null
    if (field === 'game_order') updates.game_order = value === '' ? null : Number(value)

    const res = await supabase.from('games').update(updates).eq('id', gameId)

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    if (field === 'status' && String(value).toLowerCase() === 'complete') {
      const game = games.find((g) => pk(g.id) === pk(gameId))

      const currentLineup =
        currentPlanLineupsByGame[pk(gameId)] ||
        blankLineup(
          players.map((p) => p.id),
          Number(game?.innings || 6),
          activePlayerIds()
        )

      await persistLineup(gameId, currentLineup, true)
    }
  }

  async function deleteGame(gameId) {
    if (lineupLockedByGame[pk(gameId)]) {
      setAppError('Unlock the lineup before deleting the game.')
      return
    }

    if (!window.confirm('Are you sure you want to delete this game?')) return

    const deleteLineup = await supabase.from('game_lineups').delete().eq('game_id', gameId)
    if (deleteLineup.error) {
      setAppError(deleteLineup.error.message)
      return
    }

    const deleteGameRow = await supabase.from('games').delete().eq('id', gameId)
    if (deleteGameRow.error) {
      setAppError(deleteGameRow.error.message)
      return
    }

    setGames((current) => current.filter((game) => pk(game.id) !== pk(gameId)))

    setLineupsByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })

    setLineupLockedByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })

    setOptimizerPreviewByGame((current) => {
      const next = { ...current }
      delete next[pk(gameId)]
      return next
    })

    setOptimizerBatchGameIds((current) =>
      current.filter((id) => pk(id) !== pk(gameId))
    )
  }

  return {
    addGame,
    addGameFromGames,
    addGameFromOptimizer,
    updateGameField,
    deleteGame,
  }
}
