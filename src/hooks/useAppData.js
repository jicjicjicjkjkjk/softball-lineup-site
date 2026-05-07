import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TEAM_ID } from '../lib/constants'
import { pk, normalizeLineup } from '../lib/lineupUtils'
import { compareGamesAsc } from '../lib/appHelpers'
import { buildPriorityMap, buildFitMap } from '../lib/positionInputHelpers'

function dbReady() {
  return Boolean(supabase)
}

export function useAppData({
  setAppError,
  setSelectedGameId,
  setOptimizerExistingGameId,
  setOptimizerFocusGameId,
  setOptimizerBatchGameIds,
  setOptimizerMode,
}) {
  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [lineupsByGame, setLineupsByGame] = useState({})
  const [lineupLockedByGame, setLineupLockedByGame] = useState({})
  const [priorityByPlayer, setPriorityByPlayer] = useState({})
  const [fitByPlayer, setFitByPlayer] = useState({})
  const [attendanceEvents, setAttendanceEvents] = useState([])
  const [attendanceByEvent, setAttendanceByEvent] = useState({})
  const [optimizerProfiles, setOptimizerProfiles] = useState([])
  const [optimizerProfileRules, setOptimizerProfileRules] = useState({})
  const [lineupSetterStateLoaded, setLineupSetterStateLoaded] = useState(false)
  const [loading, setLoading] = useState(true)

  async function loadAll() {
    setLoading(true)
    setAppError('')

    try {
      if (!dbReady()) throw new Error('Supabase is not connected.')

      const playersRes = await supabase
        .from('players')
        .select('id, name, last_name, jersey_number, active')
        .eq('team_id', TEAM_ID)
        .order('name', { ascending: true })

      if (playersRes.error) throw playersRes.error

      const loadedPlayers = playersRes.data || []
      setPlayers(loadedPlayers)

      const gamesRes = await supabase
        .from('games')
        .select('id, game_date, opponent, innings, status, game_type, game_order, season')
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
        game_type: row.game_type || '',
        season: row.season || '',
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

      setPriorityByPlayer(buildPriorityMap(prefRes.data || []))
      setFitByPlayer(buildFitMap(allowedRes.data || []))

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

      const profilesRes = await supabase
        .from('optimizer_profiles')
        .select('*')
        .eq('team_id', TEAM_ID)
        .order('profile_name', { ascending: true })

      if (profilesRes.error) throw profilesRes.error

      const loadedProfiles = profilesRes.data || []
      setOptimizerProfiles(loadedProfiles)

      const profileIds = loadedProfiles.map((profile) => profile.id)
      const loadedRulesByProfile = {}

      if (profileIds.length) {
        const rulesRes = await supabase
          .from('optimizer_profile_position_rules')
          .select('*')
          .in('profile_id', profileIds)

        if (rulesRes.error) throw rulesRes.error

        ;(rulesRes.data || []).forEach((rule) => {
          if (!loadedRulesByProfile[rule.profile_id]) {
            loadedRulesByProfile[rule.profile_id] = {}
          }

          loadedRulesByProfile[rule.profile_id][rule.position] = rule
        })
      }

      setOptimizerProfileRules(loadedRulesByProfile)

      const defaultProfile =
        loadedProfiles.find((profile) => profile.is_default) ||
        loadedProfiles[0] ||
        null

      if (defaultProfile?.profile_key) {
        setOptimizerMode(defaultProfile.profile_key)
      }

      setOptimizerBatchGameIds([])

if (loadedGames.length) {
  const latestGame = [...loadedGames]
    .sort((a, b) => compareGamesAsc(a, b, pk))
    .at(-1)

  if (latestGame) {
    const latestGameId = pk(latestGame.id)

    setSelectedGameId(latestGameId)
    setOptimizerExistingGameId(latestGameId)
    setOptimizerFocusGameId(latestGameId)
    setOptimizerBatchGameIds([latestGameId])
  }
}

      setLineupSetterStateLoaded(true)
    } catch (error) {
      setAppError(error.message || 'Failed to load data.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  return {
    players,
    setPlayers,
    games,
    setGames,
    lineupsByGame,
    setLineupsByGame,
    lineupLockedByGame,
    setLineupLockedByGame,
    priorityByPlayer,
    setPriorityByPlayer,
    fitByPlayer,
    setFitByPlayer,
    attendanceEvents,
    setAttendanceEvents,
    attendanceByEvent,
    setAttendanceByEvent,
    optimizerProfiles,
    setOptimizerProfiles,
    optimizerProfileRules,
    setOptimizerProfileRules,
    lineupSetterStateLoaded,
    setLineupSetterStateLoaded,
    loading,
    setLoading,
    loadAll,
  }
}
