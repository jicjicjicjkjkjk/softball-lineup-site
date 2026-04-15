import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'
import {
  FIELD_POSITIONS,
  GRID_OPTIONS,
  PRIORITY_POSITIONS,
  ALLOWED_POSITIONS,
  GAME_TYPES,
  pk,
  blankLineup,
  normalizeLineup,
  rowSummary,
  requiredOutsForGame,
  fitTier,
  computeTotals,
  addTotals,
  buildOptimizedLineup,
  inningStatus,
} from './lib/lineupUtils'


const TEAM_ID = 'f76ea5a1-7c44-4789-bfbd-9771edd54f10'

const ATTENDANCE_SEASON_OPTIONS = ['In Season', 'Out of Season']
const ATTENDANCE_TYPE_OPTIONS = ['Pitchers/Catchers', 'Team Practice', 'Indoor Work', 'Outdoor Practice']
const ATTENDANCE_SURFACE_OPTIONS = ['Indoor', 'Outdoor']



function dbReady() {
  return Boolean(supabase)
}

function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function sortRows(rows, sort) {
  if (!sort?.key) return rows
  const dir = sort.direction === 'desc' ? -1 : 1

  return [...rows].sort((a, b) => {
    const av = a[sort.key]
    const bv = b[sort.key]
    const an = Number(av)
    const bn = Number(bv)
    const aNum = !Number.isNaN(an) && String(av ?? '').trim() !== ''
    const bNum = !Number.isNaN(bn) && String(bv ?? '').trim() !== ''

    if (aNum && bNum) return (an - bn) * dir
    return String(av ?? '').localeCompare(String(bv ?? '')) * dir
  })
}

function formatDateShort(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${m}/${d}/${y.slice(2)}`
}

function avg(numbers) {
  if (!numbers.length) return ''
  return (numbers.reduce((a, b) => a + b, 0) / numbers.length).toFixed(2)
}

function MiniDiamond({ status }) {
  const posCoords = {
    P: { left: '46%', top: '60%' },
    C: { left: '46%', top: '83%' },
    '1B': { left: '70%', top: '63%' },
    '2B': { left: '61%', top: '37%' },
    '3B': { left: '22%', top: '63%' },
    SS: { left: '31%', top: '37%' },
    LF: { left: '10%', top: '18%' },
    CF: { left: '46%', top: '6%' },
    RF: { left: '82%', top: '18%' },
  }

  function fillFor(pos) {
    if (status?.duplicate?.includes(pos)) return '#ef4444'
    if (status?.missing?.includes(pos)) return '#e5e7eb'
    return '#22c55e'
  }

  return (
    <div style={{ position: 'relative', width: 82, height: 82, margin: '0 auto' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          width: 44,
          height: 44,
          transform: 'translate(-50%, -50%) rotate(45deg)',
          border: '1px solid #94a3b8',
          background: '#f8fafc',
        }}
      />
      {Object.entries(posCoords).map(([pos, coords]) => (
        <div
          key={pos}
          title={pos}
          style={{
            position: 'absolute',
            left: coords.left,
            top: coords.top,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: fillFor(pos),
            border: '1px solid #64748b',
            transform: 'translate(-50%, -50%)',
          }}
        />
      ))}
    </div>
  )
}

function TrackingTable({ title, totals, players, sortConfig, setSortConfig, universeLabel, center = true }) {
  const rows = sortRows(
    (players || []).map((player) => {
      const id = pk(player.id)
      return {
        playerId: id,
        name: player.name,
        games: totals?.[id]?.games || 0,
        fieldTotal: totals?.[id]?.fieldTotal || 0,
        Out: totals?.[id]?.Out || 0,
        expectedOuts: totals?.[id]?.expectedOuts || 0,
        actualOuts: totals?.[id]?.actualOuts || 0,
        delta: totals?.[id]?.delta || 0,
        P: totals?.[id]?.P || 0,
        C: totals?.[id]?.C || 0,
        '1B': totals?.[id]?.['1B'] || 0,
        '2B': totals?.[id]?.['2B'] || 0,
        '3B': totals?.[id]?.['3B'] || 0,
        SS: totals?.[id]?.SS || 0,
        LF: totals?.[id]?.LF || 0,
        CF: totals?.[id]?.CF || 0,
        RF: totals?.[id]?.RF || 0,
        IF: totals?.[id]?.IF || 0,
        OF: totals?.[id]?.OF || 0,
      }
    }),
    sortConfig
  )

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      {universeLabel ? (
        <>
          <div className="summary-box" style={{ marginBottom: 16 }}>
            <strong>{title} Universe:</strong> {universeLabel}
          </div>
          <h3>{title}</h3>
        </>
      ) : (
        <h3>{title}</h3>
      )}

      <table className={center ? 'table-center' : ''}>
        <thead>
          <tr>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'name'))}>Player</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'games'))}>Games</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'fieldTotal'))}>Fld</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'Out'))}>Out</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'expectedOuts'))}>Exp X</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'actualOuts'))}>Act X</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'delta'))}>Delta</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'P'))}>P</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'C'))}>C</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, '1B'))}>1B</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, '2B'))}>2B</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, '3B'))}>3B</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'SS'))}>SS</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'LF'))}>LF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'CF'))}>CF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'RF'))}>RF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'IF'))}>IF</th>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'OF'))}>OF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.playerId}`}>
              <td>{row.name}</td>
              <td>{row.games}</td>
              <td>{row.fieldTotal}</td>
              <td>{row.Out}</td>
              <td>{row.expectedOuts}</td>
              <td>{row.actualOuts}</td>
              <td>{row.delta}</td>
              <td>{row.P}</td>
              <td>{row.C}</td>
              <td>{row['1B']}</td>
              <td>{row['2B']}</td>
              <td>{row['3B']}</td>
              <td>{row.SS}</td>
              <td>{row.LF}</td>
              <td>{row.CF}</td>
              <td>{row.RF}</td>
              <td>{row.IF}</td>
              <td>{row.OF}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LineupGrid({
  players,
  lineup,
  fitMap,
  showLocks,
  lockedLineup,
  visiblePlayerIds,
  onCellChange,
  onBattingChange,
  onCellLockToggle,
  onRowLockToggle,
}) {
  const visibleSet = new Set((visiblePlayerIds || []).map(pk))

  const sortedRows = [...(players || [])]
    .filter((player) => visibleSet.has(pk(player.id)))
    .sort((a, b) => {
      const aOrder = Number(lineup?.battingOrder?.[pk(a.id)] || 999)
      const bOrder = Number(lineup?.battingOrder?.[pk(b.id)] || 999)
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })

  return (
    <table className="lineup-print-table">
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>Batting Order</th>
          {showLocks && <th>Lock</th>}
          {Array.from({ length: Number(lineup?.innings || 0) }, (_, i) => i + 1).map((inning) => {
            const status = inningStatus(lineup, inning, players, fitMap)
            return (
              <th key={inning}>
                <MiniDiamond status={status} />
                <div style={{ marginTop: 4 }}>{inning}</div>
              </th>
            )
          })}
          <th>IF</th>
          <th>OF</th>
          <th>P</th>
          <th>C</th>
          <th>X</th>
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((player) => {
          const id = pk(player.id)
          const summary = rowSummary(lineup, id)
          const rowLocked = lineup?.lockedRows?.[id] === true

          return (
            <tr key={id}>
              <td>{player.jersey_number || ''}</td>
              <td>{player.name}</td>
              <td>
                <input
                  type="number"
                  value={lineup?.battingOrder?.[id] || ''}
                  disabled={lockedLineup}
                  onChange={(e) => onBattingChange(id, e.target.value)}
                  style={{ width: 72, textAlign: 'center' }}
                />
              </td>

              {showLocks && (
                <td>
                  <label className="checkbox-item" style={{ margin: 0 }}>
                    <input
                      type="checkbox"
                      checked={rowLocked}
                      disabled={lockedLineup}
                      onChange={() => onRowLockToggle(id)}
                    />
                    All
                  </label>
                </td>
              )}

              {Array.from({ length: Number(lineup?.innings || 0) }, (_, i) => i + 1).map((inning) => {
                const value = lineup?.cells?.[id]?.[inning] || ''
                const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
                const effectiveLocked = lockedLineup || rowLocked || cellLocked

                let background = value ? '#eef6ff' : 'white'

                if (FIELD_POSITIONS.includes(value)) {
                  const status = inningStatus(lineup, inning, players, fitMap)
                  if (status.duplicate.includes(value)) {
                    background = '#fee2e2'
                  } else {
                    const tier = fitTier(fitMap, id, value)
                    background =
                      tier === 'primary'
                        ? '#dcfce7'
                        : tier === 'secondary'
                        ? '#fef3c7'
                        : '#fee2e2'
                  }
                }

                return (
                  <td key={inning}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <select
                        value={value}
                        disabled={effectiveLocked}
                        onChange={(e) => onCellChange(id, inning, e.target.value)}
                        style={{ background }}
                      >
                        {GRID_OPTIONS.map((option) => (
                          <option key={option || 'blank'} value={option}>
                            {option || '--'}
                          </option>
                        ))}
                      </select>

                      {showLocks && (
                        <label className="checkbox-item" style={{ margin: 0 }}>
                          <input
                            type="checkbox"
                            checked={cellLocked}
                            disabled={lockedLineup || rowLocked}
                            onChange={() => onCellLockToggle(id, inning)}
                          />
                          Lock
                        </label>
                      )}
                    </div>
                  </td>
                )
              })}

              <td>{summary.IF}</td>
              <td>{summary.OF}</td>
              <td>{summary.P}</td>
              <td>{summary.C}</td>
              <td>{summary.X}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function Sidebar({ page, setPage }) {
  const items = [
    ['players', 'Players'],
    ['positioning-priority', 'Positioning Priority'],
    ['games', 'Games'],
    ['game-detail', 'Game Detail'],
    ['lineup-setter', 'Lineup Setter'],
    ['tracking', 'Tracking'],
    ['attendance', 'Attendance Tracker'],
  ]

  return (
    <aside className="sidebar no-print">
      <h1>Thunder Lineup Tool</h1>
      <div className="nav-stack">
        {items.map(([key, label]) => (
          <button
            key={key}
            className={page === key ? 'nav-button active' : 'nav-button'}
            onClick={() => setPage(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </aside>
  )
}

export default function App() {
  const [page, setPage] = useState('games')

  const [players, setPlayers] = useState([])
  const [games, setGames] = useState([])
  const [lineupsByGame, setLineupsByGame] = useState({})
  const [lineupLockedByGame, setLineupLockedByGame] = useState({})
  const [priorityByPlayer, setPriorityByPlayer] = useState({})
  const [fitByPlayer, setFitByPlayer] = useState({})
  const [attendanceEvents, setAttendanceEvents] = useState([])
  const [attendanceByEvent, setAttendanceByEvent] = useState({})

  const [loading, setLoading] = useState(true)
  const [appError, setAppError] = useState('')

  const [selectedGameId, setSelectedGameId] = useState('')
  const [optimizerExistingGameId, setOptimizerExistingGameId] = useState('')
  const [optimizerFocusGameId, setOptimizerFocusGameId] = useState('')
  const [optimizerBatchGameIds, setOptimizerBatchGameIds] = useState([])
  const [optimizerPreviewByGame, setOptimizerPreviewByGame] = useState({})

  const [newGameDate, setNewGameDate] = useState('')
  const [newGameOpponent, setNewGameOpponent] = useState('')
  const [newGameType, setNewGameType] = useState(GAME_TYPES[0])

  const [optimizerNewDate, setOptimizerNewDate] = useState('')
  const [optimizerNewOpponent, setOptimizerNewOpponent] = useState('')
  const [optimizerNewType, setOptimizerNewType] = useState(GAME_TYPES[0])

  const [newPlayerName, setNewPlayerName] = useState('')
  const [newPlayerNumber, setNewPlayerNumber] = useState('')
  const [newPlayerActive, setNewPlayerActive] = useState(true)

  const [playerSort, setPlayerSort] = useState({ key: 'name', direction: 'asc' })
  const [gameSort, setGameSort] = useState({ key: 'date', direction: 'asc' })
  const [prioritySort, setPrioritySort] = useState({ key: 'name', direction: 'asc' })
  const [allowedSort, setAllowedSort] = useState({ key: 'name', direction: 'asc' })
  const [trackingSort, setTrackingSort] = useState({ key: 'name', direction: 'asc' })
  const [attendanceSort, setAttendanceSort] = useState({ key: 'event_date', direction: 'asc' })

  const [trackingThroughDate, setTrackingThroughDate] = useState('')
  const [trackingGameType, setTrackingGameType] = useState('All')
  const [trackingState, setTrackingState] = useState('All')
  const [trackingPlayerId, setTrackingPlayerId] = useState('')

  const [attendanceDate, setAttendanceDate] = useState('')
  const [attendanceSeason, setAttendanceSeason] = useState(ATTENDANCE_SEASON_OPTIONS[0])
  const [attendanceType, setAttendanceType] = useState(ATTENDANCE_TYPE_OPTIONS[0])
  const [attendanceSurface, setAttendanceSurface] = useState(ATTENDANCE_SURFACE_OPTIONS[0])
  const [attendanceTitle, setAttendanceTitle] = useState('')
  const [attendancePlayerFilter, setAttendancePlayerFilter] = useState('')
  const [attendanceTypeFilter, setAttendanceTypeFilter] = useState('All')

function autoSave(gameId, lineup) {
  supabase
    .from('game_lineups')
    .upsert({
      game_id: gameId,
      lineup_name: 'Main',
      lineup_data: lineup,
      optimizer_meta: {
        innings: lineup.innings,
        availablePlayerIds: lineup.availablePlayerIds,
      },
      lineup_locked: lineupLockedByGame[pk(gameId)] === true,
    }, { onConflict: 'game_id,lineup_name' })
}
  
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
        .order('event_date', { ascending: false })

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
        lineupState: lineupLockedByGame[pk(game.id)]
          ? 'Locked'
          : lineupsByGame[pk(game.id)]
          ? 'Saved'
          : 'Empty',
      })),
      gameSort
    )
  }, [games, lineupsByGame, lineupLockedByGame, gameSort])

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

  const ytdBeforeTotals = useMemo(() => {
    return computeTotals(lockedLineupsOnly, players)
  }, [lockedLineupsOnly, players])

  const currentBatchTotals = useMemo(() => {
    return computeTotals(Object.values(optimizerPreviewByGame), players)
  }, [optimizerPreviewByGame, players])

  const ytdAfterTotals = useMemo(() => {
    return addTotals(ytdBeforeTotals, currentBatchTotals, players)
  }, [ytdBeforeTotals, currentBatchTotals, players])

  const filteredTrackingLineups = useMemo(() => {
    return games
      .filter((game) => {
        const state = lineupLockedByGame[pk(game.id)]
          ? 'Locked'
          : lineupsByGame[pk(game.id)]
          ? 'Saved'
          : 'Empty'

        if (trackingState !== 'All' && state !== trackingState) return false
        if (trackingGameType !== 'All' && game.game_type !== trackingGameType) return false
        if (trackingThroughDate && game.date && game.date > trackingThroughDate) return false
        if (!lineupsByGame[pk(game.id)]) return false
        return true
      })
      .map((game) => lineupsByGame[pk(game.id)])
  }, [games, trackingState, trackingGameType, trackingThroughDate, lineupsByGame, lineupLockedByGame])

  const trackingTotals = useMemo(() => {
    return computeTotals(filteredTrackingLineups, players)
  }, [filteredTrackingLineups, players])

  const averageBattingOrderRows = useMemo(() => {
    return players.map((player) => {
      const orders = games
        .map((game) => lineupsByGame[pk(game.id)])
        .filter(Boolean)
        .map((lineup) => Number(lineup?.battingOrder?.[pk(player.id)] || 0))
        .filter((n) => n > 0)

      return {
        playerId: pk(player.id),
        name: player.name,
        averageBattingOrder: avg(orders),
        gamesWithBattingOrder: orders.length,
      }
    })
  }, [players, games, lineupsByGame])

  const perPlayerTrackingRows = useMemo(() => {
    if (!trackingPlayerId) return []

    return games
      .filter((game) => {
        if (trackingGameType !== 'All' && game.game_type !== trackingGameType) return false
        if (trackingThroughDate && game.date && game.date > trackingThroughDate) return false
        return Boolean(lineupsByGame[pk(game.id)])
      })
      .map((game) => {
        const lineup = lineupsByGame[pk(game.id)]
        if (!lineup) return null

        const playerId = pk(trackingPlayerId)
        const row = lineup.cells?.[playerId] || {}
        const values = Object.values(row)
        const outCount = values.filter((v) => v === 'Out').length
        const injuryCount = values.filter((v) => v === 'Injury').length
        const eligiblePlayers = (lineup.availablePlayerIds || []).filter((id) => {
          const playerRow = lineup.cells?.[id] || {}
          const hasInjuryEveryInning = Object.values(playerRow).every((v) => v === 'Injury')
          return !hasInjuryEveryInning
        })
        const expectedPerPlayer = eligiblePlayers.length
          ? Number((requiredOutsForGame(eligiblePlayers.length, lineup.innings) / eligiblePlayers.length).toFixed(2))
          : 0

        const summary = rowSummary(lineup, playerId)
        return {
          gameId: pk(game.id),
          date: game.date,
          dateText: formatDateShort(game.date),
          opponent: game.opponent || '',
          game_type: game.game_type || '',
          battingOrder: lineup.battingOrder?.[playerId] || '',
          outCount,
          expectedOuts: expectedPerPlayer,
          delta: Number((outCount - expectedPerPlayer).toFixed(2)),
          P: summary.P,
          C: summary.C,
          IF: summary.IF,
          OF: summary.OF,
          injuryCount,
        }
      })
      .filter(Boolean)
      .sort((a, b) => `${a.date}-${a.gameId}`.localeCompare(`${b.date}-${b.gameId}`))
  }, [trackingPlayerId, games, lineupsByGame, trackingGameType, trackingThroughDate])

  const filteredAttendanceEvents = useMemo(() => {
    return sortRows(
      attendanceEvents.filter((event) => {
        if (attendanceTypeFilter !== 'All' && event.event_type !== attendanceTypeFilter) return false
        return true
      }),
      attendanceSort
    )
  }, [attendanceEvents, attendanceTypeFilter, attendanceSort])

  const attendanceSummaryByPlayer = useMemo(() => {
    return players.map((player) => {
      const eventRows = filteredAttendanceEvents.filter((event) => {
        if (!attendancePlayerFilter) return true
        return pk(player.id) === pk(attendancePlayerFilter)
      })

      const total = eventRows.length
      const attended = eventRows.filter((event) => attendanceByEvent[pk(event.id)]?.[pk(player.id)] === true).length
      return {
        playerId: pk(player.id),
        name: player.name,
        attended,
        total,
        pct: total ? `${Math.round((attended / total) * 100)}%` : '',
      }
    })
  }, [players, filteredAttendanceEvents, attendanceByEvent, attendancePlayerFilter])

  async function addGame(date, opponent, gameType) {
    const res = await supabase
      .from('games')
      .insert({
        team_id: TEAM_ID,
        game_date: date || null,
        opponent: opponent || null,
        innings: 6,
        status: 'Planned',
        game_type: gameType || GAME_TYPES[0],
        game_order: null,
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
      game_type: res.data.game_type || GAME_TYPES[0],
      game_order: Number(res.data.game_order || null),
    }

    setGames((current) => [...current, game])
    return game
  }

  async function addGameFromGames() {
    const game = await addGame(newGameDate, newGameOpponent, newGameType)
    if (game) {
      setNewGameDate('')
      setNewGameOpponent('')
      setNewGameType(GAME_TYPES[0])
      setSelectedGameId(pk(game.id))
    }
  }

  async function addGameFromOptimizer() {
    const game = await addGame(optimizerNewDate, optimizerNewOpponent, optimizerNewType)
    if (game) {
      setOptimizerNewDate('')
      setOptimizerNewOpponent('')
      setOptimizerNewType(GAME_TYPES[0])
      setOptimizerBatchGameIds((current) => [...new Set([...current, pk(game.id)])])
      setOptimizerFocusGameId(pk(game.id))
      setOptimizerExistingGameId(pk(game.id))
      setOptimizerPreviewByGame((current) => ({
        ...current,
        [pk(game.id)]: blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds()),
      }))
    }
  }

  async function updateGameField(gameId, field, value) {
    setGames((current) =>
      current.map((game) => (pk(game.id) === pk(gameId) ? { ...game, [field]: value } : game))
    )

    const updates = {}
    if (field === 'date') updates.game_date = value || null
    if (field === 'opponent') updates.opponent = value || null
    if (field === 'innings') updates.innings = Number(value)
    if (field === 'status') updates.status = value
    if (field === 'game_type') updates.game_type = value
    if (field === 'game_order') updates.game_order = Number(value)

    const res = await supabase.from('games').update(updates).eq('id', gameId)
    if (res.error) setAppError(res.error.message)
  }

  async function deleteGame(gameId) {
    if (lineupLockedByGame[pk(gameId)]) {
      setAppError('Unlock the lineup before deleting the game.')
      return
    }

    const confirmed = window.confirm('Are you sure you want to delete this game?')
    if (!confirmed) return

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
    setOptimizerBatchGameIds((current) => current.filter((id) => pk(id) !== pk(gameId)))
  }

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
      current.map((player) =>
        pk(player.id) === pk(playerId) ? { ...player, [field]: value } : player
      )
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

    // auto-primary + locked behavior
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
 Number(priorityByPlayer[row.playerId]?.OF?.priority_pct || 0) > 0)

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
    alert("No games in plan")
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

    if (!availableIds.length) {
      console.log("❌ No available players for game", game.id)
      return
    }

    const optimized = buildOptimizedLineup({
      game,
      players,
      availablePlayerIds: availableIds,
      sourceLineup: source,
      totalsBefore: rollingTotals,
      priorityMap: priorityByPlayer,
      fitMap: fitByPlayer,
    })

    console.log("✅ Optimized game", game.id, optimized)

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
      game,
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
      const base =
        current[pk(gameId)] ||
        lineupsByGame[pk(gameId)] ||
        blankLineup(players.map((p) => p.id), 6, activePlayerIds())

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

    autoSave(gameId, lineup) // ✅ ADD THIS LINE

    return lineup
  })
}

  function updateSavedBatting(gameId, playerId, value) {
  updateSavedLineup(gameId, (lineup) => {
    lineup.battingOrder[pk(playerId)] = value

    autoSave(gameId, lineup) // ✅ ADD THIS LINE

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

  async function addAttendanceEvent() {
    const res = await supabase
      .from('attendance_events')
      .insert({
        team_id: TEAM_ID,
        event_date: attendanceDate || null,
        season_bucket: attendanceSeason,
        event_type: attendanceType,
        surface: attendanceSurface,
        title: attendanceTitle || null,
      })
      .select()
      .single()

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    const newEvent = res.data
    setAttendanceEvents((current) => [newEvent, ...current])

    const inserts = players.map((player) => ({
      event_id: newEvent.id,
      player_id: player.id,
      attended: false,
    }))

    const recRes = await supabase.from('attendance_records').upsert(inserts, {
      onConflict: 'event_id,player_id',
    })
    if (recRes.error) {
      setAppError(recRes.error.message)
      return
    }

    setAttendanceByEvent((current) => ({
      ...current,
      [pk(newEvent.id)]: Object.fromEntries(players.map((p) => [pk(p.id), false])),
    }))

    setAttendanceDate('')
    setAttendanceSeason(ATTENDANCE_SEASON_OPTIONS[0])
    setAttendanceType(ATTENDANCE_TYPE_OPTIONS[0])
    setAttendanceSurface(ATTENDANCE_SURFACE_OPTIONS[0])
    setAttendanceTitle('')
  }

  async function toggleAttendance(eventId, playerId, checked) {
    setAttendanceByEvent((current) => ({
      ...current,
      [pk(eventId)]: {
        ...(current[pk(eventId)] || {}),
        [pk(playerId)]: checked,
      },
    }))

    const res = await supabase.from('attendance_records').upsert(
      {
        event_id: eventId,
        player_id: playerId,
        attended: checked,
      },
      { onConflict: 'event_id,player_id' }
    )

    if (res.error) setAppError(res.error.message)
  }

  function renderPlayersPage() {
    return (
      <div className="stack">
        <div className="card">
          <h2>Players</h2>
          <div className="grid four-col compact-grid">
            <div>
              <label>Name</label>
              <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} />
            </div>
            <div>
              <label>Number</label>
              <input value={newPlayerNumber} onChange={(e) => setNewPlayerNumber(e.target.value)} />
            </div>
            <div>
              <label>Active</label>
              <select
                value={newPlayerActive ? 'Yes' : 'No'}
                onChange={(e) => setNewPlayerActive(e.target.value === 'Yes')}
              >
                <option>Yes</option>
                <option>No</option>
              </select>
            </div>
            <div className="align-end">
              <button onClick={addPlayer}>Add Player</button>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'name'))}>Player</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'jersey_number'))}>#</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'activeText'))}>Active</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.id}>
                  <td>
                    <input
                      value={player.name}
                      onChange={(e) => updatePlayerLocal(player.id, 'name', e.target.value)}
                      onBlur={() => upsertPlayer(player)}
                    />
                  </td>
                  <td>
                    <input
                      value={player.jersey_number || ''}
                      onChange={(e) => updatePlayerLocal(player.id, 'jersey_number', e.target.value)}
                      onBlur={() => upsertPlayer(player)}
                    />
                  </td>
                  <td>
                    <select
                      value={player.active === false ? 'No' : 'Yes'}
                      onChange={(e) => {
                        const value = e.target.value === 'Yes'
                        updatePlayerLocal(player.id, 'active', value)
                        upsertPlayer({ ...player, active: value })
                      }}
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => deletePlayer(player.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderPositioningPriorityPage() {
    return (
      <div className="stack">
        <div className="card" style={{ overflowX: 'auto' }}>
          <h2>Positioning Priority</h2>
          <table className="table-center">
            <thead>
              <tr>
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'name'))}>Player</th>
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'jersey_number'))}>#</th>
                {PRIORITY_POSITIONS.map((position) => (
                  <th key={position} onClick={() => setPrioritySort(nextSort(prioritySort, position))}>
                    {position}
                  </th>
                ))}
                <th onClick={() => setPrioritySort(nextSort(prioritySort, 'subtotal'))}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {activePriorityRows.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.name}</td>
                  <td>{row.jersey_number}</td>
                  {PRIORITY_POSITIONS.map((position) => (
                    <td key={position}>
                      <input
                        className="input-center"
                        type="number"
                        min="0"
                        max="100"
                        value={row[position]}
                        onChange={(e) => updatePriorityLocal(row.playerId, position, e.target.value)}
                        onBlur={(e) => persistPriority(row.playerId, position, e.target.value)}
                      />
                    </td>
                  ))}
                  <td>{row.subtotal}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th colSpan="2">Subtotal</th>
                {PRIORITY_POSITIONS.map((position) => (
                  <th key={position}>{priorityFooter[position]}</th>
                ))}
                <th>{priorityFooter.subtotal}</th>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Allowed Positions</h3>
          <table className="table-center">
            <thead>
              <tr>
                <th onClick={() => setAllowedSort(nextSort(allowedSort, 'name'))}>Player</th>
                <th onClick={() => setAllowedSort(nextSort(allowedSort, 'jersey_number'))}>#</th>
                {ALLOWED_POSITIONS.map((position) => (
                  <th key={position} onClick={() => setAllowedSort(nextSort(allowedSort, position))}>
                    {position}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allowedRows.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.name}</td>
                  <td>{row.jersey_number}</td>
                  {ALLOWED_POSITIONS.map((position) => {
                    const tier = fitByPlayer[row.playerId]?.[position] || 'secondary'
                    const lockedPrimary =
                      Number(priorityByPlayer[row.playerId]?.[position]?.priority_pct || 0) > 0 ||
(['LF', 'RF'].includes(position) &&
 Number(priorityByPlayer[row.playerId]?.OF?.priority_pct || 0) > 0)

                    const background =
                      tier === 'primary'
                        ? '#dcfce7'
                        : tier === 'secondary'
                        ? '#fef3c7'
                        : '#fee2e2'

                    return (
                      <td key={position}>
                        <select
                          value={lockedPrimary ? 'primary' : tier}
                          style={{ background }}
                          disabled={lockedPrimary}
                          onChange={(e) => {
                            updateFitLocal(row.playerId, position, e.target.value)
                            persistFitTier(row.playerId, position, e.target.value)
                          }}
                        >
                          <option value="primary">Primary</option>
                          <option value="secondary">Non-Primary</option>
                          <option value="no">No</option>
                        </select>
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

function renderGamesPage() {
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between wrap-row">
          <h2>Games</h2>
          <button onClick={loadAll}>Refresh from Database</button>
        </div>

        {appError && <p style={{ color: '#b91c1c' }}>Error: {appError}</p>}
        {loading && <p>Loading...</p>}

        <div className="grid four-col compact-grid">
          <div>
            <label>Date</label>
            <input
              type="date"
              value={newGameDate}
              onChange={(e) => setNewGameDate(e.target.value)}
            />
          </div>
          <div>
            <label>Opponent</label>
            <input
              value={newGameOpponent}
              onChange={(e) => setNewGameOpponent(e.target.value)}
            />
          </div>
          <div>
            <label>Type</label>
            <select
              value={newGameType}
              onChange={(e) => setNewGameType(e.target.value)}
            >
              {GAME_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="align-end">
            <button onClick={addGameFromGames}>Add Game</button>
          </div>
        </div>

        <p className="small-note">
          “Refresh from Database” reloads all players, games, lineups, priorities, and attendance.
        </p>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th onClick={() => setGameSort(nextSort(gameSort, 'date'))}>Date</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'game_order'))}>Order</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'opponent'))}>Opponent</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'game_type'))}>Type</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'innings'))}>Innings</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'lineupState'))}>Status</th>
              <th>Actions</th>
            </tr>
          </thead>

          <tbody>
            {sortedGames.map((game) => (
              <tr key={game.id}>
                <td>{formatDateShort(game.date)}</td>

                <td className="center-cell narrow-cell">
                  <input
                    className="input-center"
                    type="number"
                    value={game.game_order || null}
                    onChange={(e) =>
                      updateGameField(game.id, 'game_order', Number(e.target.value))
                    }
                  />
                </td>

                <td className="wide-text-cell">
                  <input
                    value={game.opponent}
                    onChange={(e) =>
                      updateGameField(game.id, 'opponent', e.target.value)
                    }
                  />
                </td>

                <td>
                  <select
                    value={game.game_type || GAME_TYPES[0]}
                    onChange={(e) =>
                      updateGameField(game.id, 'game_type', e.target.value)
                    }
                  >
                    {GAME_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </td>

                <td className="center-cell">{game.innings}</td>
                <td className="center-cell">{game.lineupState}</td>

                <td>
                  <div className="button-row">
                    <button
                      onClick={() => {
                        setSelectedGameId(pk(game.id))
                        setPage('game-detail')
                      }}
                    >
                      Open
                    </button>

                    <button onClick={() => deleteGame(game.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {!sortedGames.length && !loading && (
              <tr>
                <td colSpan="7">No games yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
  function renderGameDetailPage() {
    if (!selectedGame) {
      return (
        <div className="card">
          <h2>Game Detail</h2>
          <p style={{ color: '#16a34a', fontSize: 12 }}>Auto-saving changes</p>
          <p>Select a game from Games.</p>
        </div>
      )
    }

    if (!selectedLineup) {
      return (
        <div className="card">
          <div className="row-between wrap-row">
            <div>
              <h2>
                {selectedGame.date || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
              </h2>
              <p>No lineup saved yet.</p>
            </div>
            <div className="button-row">
              <button onClick={() => setPage('games')}>Back to Games</button>
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                style={{ maxWidth: 280 }}
              >
                {games.map((game) => (
                  <option key={game.id} value={pk(game.id)}>
                    {(formatDateShort(game.date) || 'No Date')} vs {(game.opponent || 'Opponent')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )
    }

    const visibleIds = selectedLineup.availablePlayerIds || activePlayerIds()

    return (
      <div className="stack">
        <div className="card no-print">
          <div className="row-between wrap-row">
            <div>
              <h2>
                {formatDateShort(selectedGame.date) || 'No Date'} vs {selectedGame.opponent || 'Opponent'}
              </h2>
              <p>
                Status: <strong>{selectedLocked ? 'Locked' : 'Saved'}</strong> | Type:{' '}
                <strong>{selectedGame.game_type || GAME_TYPES[0]}</strong>
              </p>
              <p className="small-note">
                Any grayed-out locked items are best adjusted from the <strong>Lineup Setter</strong>.
              </p>
            </div>

            <div className="button-row">
              <button onClick={() => setPage('games')}>Back to Games</button>
              <select
                value={selectedGameId}
                onChange={(e) => setSelectedGameId(e.target.value)}
                style={{ maxWidth: 280 }}
              >
                {games.map((game) => (
                  <option key={game.id} value={pk(game.id)}>
                    {(formatDateShort(game.date) || 'No Date')} vs {(game.opponent || 'Opponent')}
                  </option>
                ))}
              </select>
              <button onClick={() => addSavedInning(selectedGame.id)} disabled={selectedLocked}>
                Add Inning
              </button>
              <button onClick={() => saveSavedLineup(selectedGame.id)} disabled={selectedLocked}>
                Save Changes
              </button>
              <button onClick={() => toggleLineupLocked(selectedGame.id, !selectedLocked)}>
                {selectedLocked ? 'Unlock Lineup' : 'Lock Lineup'}
              </button>
              <button onClick={() => clearSavedLineup(selectedGame.id)} disabled={selectedLocked}>
                Clear Lineup
              </button>
              <button onClick={() => window.print()}>Print</button>
            </div>
          </div>

          <div className="button-row" style={{ marginTop: 12 }}>
            <span style={{ fontWeight: 700, alignSelf: 'center' }}>Remove Inning</span>
            {Array.from({ length: selectedLineup.innings }, (_, i) => i + 1).map((inning) => (
              <button
                key={inning}
                onClick={() => removeSavedInning(selectedGame.id, inning)}
                disabled={selectedLocked}
              >
                {inning}
              </button>
            ))}
          </div>
        </div>

        <div className="card no-print">
          <h3>Game Availability</h3>
          <div className="checkbox-grid">
            {players.map((player) => (
              <label key={player.id} className="checkbox-item">
                <input
                  type="checkbox"
                  checked={visibleIds.includes(pk(player.id))}
                  disabled={selectedLocked}
                  onChange={() => toggleSavedAvailable(selectedGame.id, player.id)}
                />
                {player.name}
              </label>
            ))}
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <LineupGrid
            players={players}
            lineup={selectedLineup}
            fitMap={fitByPlayer}
            showLocks={false}
            lockedLineup={selectedLocked}
            visiblePlayerIds={visibleIds}
            onCellChange={(playerId, inning, value) =>
              updateSavedCell(selectedGame.id, playerId, inning, value)
            }
            onBattingChange={(playerId, value) =>
              updateSavedBatting(selectedGame.id, playerId, value)
            }
            onCellLockToggle={() => {}}
            onRowLockToggle={() => {}}
          />
        </div>

        <div className="print-only">
          <div className="print-title">
            Thunder Lineup — {formatDateShort(selectedGame.date)} vs {selectedGame.opponent}
          </div>
          <table className="print-table-compact">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Batting Order</th>
                {Array.from({ length: selectedLineup.innings }, (_, i) => i + 1).map((inning) => (
                  <th key={inning}>{inning}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {(players || [])
                .filter((p) => visibleIds.includes(pk(p.id)))
                .sort((a, b) => {
                  const aOrder = Number(selectedLineup?.battingOrder?.[pk(a.id)] || 999)
                  const bOrder = Number(selectedLineup?.battingOrder?.[pk(b.id)] || 999)
                  if (aOrder !== bOrder) return aOrder - bOrder
                  return a.name.localeCompare(b.name)
                })
                .map((player) => (
                  <tr key={player.id}>
                    <td>{player.jersey_number || ''}</td>
                    <td>{player.name}</td>
                    <td>{selectedLineup?.battingOrder?.[pk(player.id)] || ''}</td>
                    {Array.from({ length: selectedLineup.innings }, (_, i) => i + 1).map((inning) => (
                      <td key={inning}>{selectedLineup?.cells?.[pk(player.id)]?.[inning] || ''}</td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  function renderLineupSetterPage() {
    const focusStatuses = optimizerFocusLineup
      ? Array.from({ length: optimizerFocusLineup.innings }, (_, i) => i + 1).map((inning) => ({
          inning,
          ...inningStatus(optimizerFocusLineup, inning, players, fitByPlayer),
        }))
      : []

    const visibleIds = optimizerFocusLineup?.availablePlayerIds || []

    return (
      <div className="stack">
        <div className="card">
          <h2>Lineup Setter</h2>
          <p className="small-note">
            Step 1: choose existing games or create a new one. Step 2: mark game availability. Step 3: click <strong>Optimize!</strong> to balance sit-outs and positions.
          </p>

          <div className="grid four-col compact-grid">
  <div>
    <label>Existing Game</label>
    <select
      value={optimizerExistingGameId}
      onChange={(e) => setOptimizerExistingGameId(e.target.value)}
    >
      <option value="">Select game</option>
      {games.map((game) => (
        <option key={game.id} value={pk(game.id)}>
          {(formatDateShort(game.date) || 'No Date')} vs {(game.opponent || 'Opponent')}
        </option>
      ))}
    </select>
  </div>

  <div className="align-end">
    <button onClick={addExistingGameToBatch}>Add Game to Plan</button>
  </div>

  <div>
    <label>Game Date</label>
    <input
      type="date"
      value={optimizerNewDate}
      onChange={(e) => setOptimizerNewDate(e.target.value)}
    />
  </div>

  <div>
    <label>Opponent</label>
    <input
      value={optimizerNewOpponent}
      onChange={(e) => setOptimizerNewOpponent(e.target.value)}
    /><div className="card">
  <h2>Lineup Setter</h2>
  <p className="small-note">
    Step 1: add an existing game to the plan, or create a new game and add it.
    Step 2: mark who is available for the selected game.
    Step 3: optimize from the plan table below.
  </p>

  <div
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr 1fr',
      gap: 24,
      alignItems: 'start',
    }}
  >
    <div>
      <h3 style={{ marginTop: 0 }}>Add Existing Game to Plan</h3>
      <div className="grid compact-grid" style={{ gridTemplateColumns: '1fr auto', gap: 12 }}>
        <div>
          <label>Existing Game</label>
          <select
            value={optimizerExistingGameId}
            onChange={(e) => setOptimizerExistingGameId(e.target.value)}
          >
            <option value="">Select game</option>
            {games.map((game) => (
              <option key={game.id} value={pk(game.id)}>
                {(formatDateShort(game.date) || 'No Date')} vs {(game.opponent || 'Opponent')}
              </option>
            ))}
          </select>
        </div>

        <div className="align-end">
          <button onClick={addExistingGameToBatch}>Add Existing Game</button>
        </div>
      </div>
    </div>

    <div>
      <h3 style={{ marginTop: 0 }}>Create New Game and Add to Plan</h3>
      <div
        className="grid compact-grid"
        style={{ gridTemplateColumns: '1fr 1fr 1fr auto', gap: 12 }}
      >
        <div>
          <label>Game Date</label>
          <input
            type="date"
            value={optimizerNewDate}
            onChange={(e) => setOptimizerNewDate(e.target.value)}
          />
        </div>

        <div>
          <label>Opponent</label>
          <input
            value={optimizerNewOpponent}
            onChange={(e) => setOptimizerNewOpponent(e.target.value)}
          />
        </div>

        <div>
          <label>Game Type</label>
          <select
            value={optimizerNewType}
            onChange={(e) => setOptimizerNewType(e.target.value)}
          >
            {GAME_TYPES.map((type) => (
              <option key={type}>{type}</option>
            ))}
          </select>
        </div>

        <div className="align-end">
          <button onClick={addGameFromOptimizer}>Add New Game to Plan</button>
        </div>
      </div>
    </div>
  </div>
</div>
    
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
  <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
    <h3 style={{ margin: 0 }}>Games in Current Plan</h3>
    <div className="button-row">
      <button onClick={runOptimizeCurrent} disabled={!optimizerFocusGameId}>
        Optimize Game Viewing
      </button>
      <button onClick={runOptimizeAll} disabled={!optimizerBatchGames.length}>
        Optimize All Games in Plan
      </button>
    </div>
  </div>
          <table className="table-center">
            <thead>
              <tr>
                <th>Focus</th>
                <th>Date</th>
                <th>Order</th>
                <th>Opponent</th>
                <th>Type</th>
                <th>Innings</th>
                <th>Req. Outs</th>
                <th>Save</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {optimizerBatchGames.map((game) => {
                const lineup =
                  optimizerPreviewByGame[pk(game.id)] ||
                  lineupsByGame[pk(game.id)] ||
                  blankLineup(players.map((p) => p.id), Number(game.innings || 6), activePlayerIds())

                return (
                  <tr key={game.id}>
                    <td>
                      <button onClick={() => setOptimizerFocusGameId(pk(game.id))}>
                        {pk(optimizerFocusGameId) === pk(game.id) ? 'Viewing' : 'Open'}
                      </button>
                    </td>
                    <td>{formatDateShort(game.date)}</td>
                    <td>{game.game_order || null}</td>
                    <td>{game.opponent || 'Opponent'}</td>
                    <td>{game.game_type || GAME_TYPES[0]}</td>
                    <td>{game.innings}</td>
                    <td>{requiredOutsForGame((lineup.availablePlayerIds || []).length, Number(game.innings || 6))}</td>
                    <td>
                      <button onClick={() => savePreview(game.id)}>Save</button>
                    </td>
                    <td>
                      <button onClick={() => removeBatchGame(game.id)}>Remove</button>
                    </td>
                  </tr>
                )
              })}
              {!optimizerBatchGames.length && (
                <tr>
                  <td colSpan="9">No games in current plan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {optimizerFocusGame && (
          <>
            <div className="card">
              <h3>
                Selected Game: {formatDateShort(optimizerFocusGame.date) || 'No Date'} vs{' '}
                {optimizerFocusGame.opponent || 'Opponent'}
              </h3>

              <h4>Game Availability</h4>
              <div className="checkbox-grid">
                {players.map((player) => {
                  const lineup =
                    optimizerPreviewByGame[pk(optimizerFocusGame.id)] ||
                    lineupsByGame[pk(optimizerFocusGame.id)] ||
                    blankLineup(players.map((p) => p.id), Number(optimizerFocusGame.innings || 6), activePlayerIds())

                  return (
                    <label key={player.id} className="checkbox-item">
                      <input
                        type="checkbox"
                        checked={(lineup.availablePlayerIds || []).includes(pk(player.id))}
                        onChange={() => togglePreviewAvailable(optimizerFocusGame.id, player.id)}
                      />
                      {player.name}
                    </label>
                  )
                })}
              </div>
            </div>

            {optimizerFocusLineup && (
              <>
                <div className="card">
                  <h3>Checks</h3>
                  <div className="stack">
                    {focusStatuses.map((status) => (
                      <div key={status.inning} className="summary-box">
                        <strong>Inning {status.inning}:</strong>{' '}
                        {status.duplicate.length ? `Duplicate ${status.duplicate.join(', ')}. ` : ''}
                        {status.missing.length ? `Missing ${status.missing.join(', ')}. ` : ''}
                        {status.badFits.length ? `Disallowed ${status.badFits.join('; ')}. ` : ''}
                        {!status.duplicate.length && !status.missing.length && !status.badFits.length
                          ? 'Looks good.'
                          : ''}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="card" style={{ overflowX: 'auto' }}>
                  <h3>Grid</h3>
                  <LineupGrid
                    players={players}
                    lineup={optimizerFocusLineup}
                    fitMap={fitByPlayer}
                    showLocks={true}
                    lockedLineup={false}
                    visiblePlayerIds={visibleIds}
                    onCellChange={(playerId, inning, value) =>
                      updatePreviewCell(optimizerFocusGame.id, playerId, inning, value)
                    }
                    onBattingChange={(playerId, value) =>
                      updatePreviewBatting(optimizerFocusGame.id, playerId, value)
                    }
                    onCellLockToggle={(playerId, inning) =>
                      togglePreviewCellLock(optimizerFocusGame.id, playerId, inning)
                    }
                    onRowLockToggle={(playerId) =>
                      togglePreviewRowLock(optimizerFocusGame.id, playerId)
                    }
                  />
                </div>
              </>
            )}

            <TrackingTable
              title="Locked Games Before Current Plan"
              universeLabel={`${lockedLineupsOnly.length} locked games`}
              totals={ytdBeforeTotals}
              players={players}
              sortConfig={trackingSort}
              setSortConfig={setTrackingSort}
            />
            <TrackingTable
              title="Current Plan"
              totals={currentBatchTotals}
              players={players}
              sortConfig={trackingSort}
              setSortConfig={setTrackingSort}
            />
            <TrackingTable
              title="Locked + Current Plan"
              totals={ytdAfterTotals}
              players={players}
              sortConfig={trackingSort}
              setSortConfig={setTrackingSort}
            />
          </>
        )}
      </div>
    )
  }

  function renderTrackingPage() {
    const rows = sortRows(
      players.map((player) => {
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

    return (
      <div className="stack">
        <div className="card">
          <h2>Tracking Filters</h2>
          <div className="grid four-col compact-grid">
            <div>
              <label>Through Date</label>
              <input
                type="date"
                value={trackingThroughDate}
                onChange={(e) => setTrackingThroughDate(e.target.value)}
              />
            </div>
            <div>
              <label>Game Type</label>
              <select value={trackingGameType} onChange={(e) => setTrackingGameType(e.target.value)}>
                <option value="All">All</option>
                {GAME_TYPES.map((type) => (
                  <option key={type}>{type}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Status</label>
              <select value={trackingState} onChange={(e) => setTrackingState(e.target.value)}>
                <option value="All">All</option>
                <option value="Saved">Saved</option>
                <option value="Locked">Locked</option>
              </select>
            </div>
            <div>
              <label>Player Detail</label>
              <select value={trackingPlayerId} onChange={(e) => setTrackingPlayerId(e.target.value)}>
                <option value="">All Players</option>
                {players.map((player) => (
                  <option key={player.id} value={pk(player.id)}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Average Batting Order</h3>
          <table className="table-center">
            <thead>
              <tr>
                <th>Player</th>
                <th>Avg Batting Order</th>
                <th>Games Counted</th>
              </tr>
            </thead>
            <tbody>
              {averageBattingOrderRows.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.name}</td>
                  <td>{row.averageBattingOrder}</td>
                  <td>{row.gamesWithBattingOrder}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <TrackingTable
          title="Tracking Totals"
          universeLabel={`${filteredTrackingLineups.length} saved/locked games in filter`}
          totals={trackingTotals}
          players={players}
          sortConfig={trackingSort}
          setSortConfig={setTrackingSort}
        />

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Tracking vs Positioning Priority</h3>
          <table className="table-center grouped-table">
            <thead>
              <tr>
                <th rowSpan="2">Player</th>
                <th rowSpan="2">Fld</th>
                <th colSpan="2" className="group-col">P</th>
                <th colSpan="2" className="group-col">C</th>
                <th colSpan="2" className="group-col">1B</th>
                <th colSpan="2" className="group-col">2B</th>
                <th colSpan="2" className="group-col">3B</th>
                <th colSpan="2" className="group-col">SS</th>
                <th colSpan="2" className="group-col">OF</th>
              </tr>
              <tr>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
                <th>TGT</th><th className="group-col">ACT</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.name}</td>
                  <td>{row.fieldTotal}</td>
                  <td>{row.targP}</td><td className="group-col">{row.actP}</td>
                  <td>{row.targC}</td><td className="group-col">{row.actC}</td>
                  <td>{row.targ1B}</td><td className="group-col">{row.act1B}</td>
                  <td>{row.targ2B}</td><td className="group-col">{row.act2B}</td>
                  <td>{row.targ3B}</td><td className="group-col">{row.act3B}</td>
                  <td>{row.targSS}</td><td className="group-col">{row.actSS}</td>
                  <td>{row.targOF}</td><td className="group-col">{row.actOF}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {trackingPlayerId && (
          <div className="card" style={{ overflowX: 'auto' }}>
            <h3>Player Game-by-Game Tracking</h3>
            <table className="table-center">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Opponent</th>
                  <th>Type</th>
                  <th>Batting Order</th>
                  <th>Sat Out</th>
                  <th>Expected Sit</th>
                  <th>Delta</th>
                  <th>P</th>
                  <th>C</th>
                  <th>IF</th>
                  <th>OF</th>
                  <th>Injury</th>
                </tr>
              </thead>
              <tbody>
                {perPlayerTrackingRows.map((row) => (
                  <tr key={row.gameId}>
                    <td>{row.dateText}</td>
                    <td>{row.opponent}</td>
                    <td>{row.game_type}</td>
                    <td>{row.battingOrder}</td>
                    <td>{row.outCount}</td>
                    <td>{row.expectedOuts}</td>
                    <td>{row.delta}</td>
                    <td>{row.P}</td>
                    <td>{row.C}</td>
                    <td>{row.IF}</td>
                    <td>{row.OF}</td>
                    <td>{row.injuryCount}</td>
                  </tr>
                ))}
                {!perPlayerTrackingRows.length && (
                  <tr>
                    <td colSpan="12">No games for the selected player/filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    )
  }

  function renderAttendancePage() {
    return (
      <div className="stack">
        <div className="card">
          <h2>Attendance Tracker</h2>
          <div className="grid four-col compact-grid">
            <div>
              <label>Date</label>
              <input type="date" value={attendanceDate} onChange={(e) => setAttendanceDate(e.target.value)} />
            </div>
            <div>
              <label>Season</label>
              <select value={attendanceSeason} onChange={(e) => setAttendanceSeason(e.target.value)}>
                {ATTENDANCE_SEASON_OPTIONS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Practice Type</label>
              <select value={attendanceType} onChange={(e) => setAttendanceType(e.target.value)}>
                {ATTENDANCE_TYPE_OPTIONS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
            <div>
              <label>Surface</label>
              <select value={attendanceSurface} onChange={(e) => setAttendanceSurface(e.target.value)}>
                {ATTENDANCE_SURFACE_OPTIONS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid four-col compact-grid" style={{ marginTop: 12 }}>
            <div>
              <label>Title</label>
              <input value={attendanceTitle} onChange={(e) => setAttendanceTitle(e.target.value)} />
            </div>
            <div className="align-end">
              <button onClick={addAttendanceEvent}>Add Practice / Event</button>
            </div>
          </div>
        </div>

        <div className="card">
          <h3>Attendance Filters</h3>
          <div className="grid four-col compact-grid">
            <div>
              <label>Player</label>
              <select value={attendancePlayerFilter} onChange={(e) => setAttendancePlayerFilter(e.target.value)}>
                <option value="">All Players</option>
                {players.map((player) => (
                  <option key={player.id} value={pk(player.id)}>
                    {player.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label>Practice Type</label>
              <select value={attendanceTypeFilter} onChange={(e) => setAttendanceTypeFilter(e.target.value)}>
                <option value="All">All</option>
                {ATTENDANCE_TYPE_OPTIONS.map((x) => (
                  <option key={x}>{x}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Attendance by Event</h3>
          <table className="table-center">
            <thead>
              <tr>
                <th onClick={() => setAttendanceSort(nextSort(attendanceSort, 'event_date'))}>Date</th>
                <th onClick={() => setAttendanceSort(nextSort(attendanceSort, 'season_bucket'))}>Season</th>
                <th onClick={() => setAttendanceSort(nextSort(attendanceSort, 'event_type'))}>Type</th>
                <th onClick={() => setAttendanceSort(nextSort(attendanceSort, 'surface'))}>Surface</th>
                <th>Title</th>
                {players
                  .filter((p) => !attendancePlayerFilter || pk(p.id) === pk(attendancePlayerFilter))
                  .map((player) => (
                    <th key={player.id}>{player.name}</th>
                  ))}
              </tr>
            </thead>
            <tbody>
              {filteredAttendanceEvents.map((event) => (
                <tr key={event.id}>
                  <td>{formatDateShort(event.event_date)}</td>
                  <td>{event.season_bucket}</td>
                  <td>{event.event_type}</td>
                  <td>{event.surface}</td>
                  <td>{event.title || ''}</td>
                  {players
                    .filter((p) => !attendancePlayerFilter || pk(p.id) === pk(attendancePlayerFilter))
                    .map((player) => (
                      <td key={player.id}>
                        <input
                          type="checkbox"
                          checked={attendanceByEvent[pk(event.id)]?.[pk(player.id)] === true}
                          onChange={(e) => toggleAttendance(event.id, player.id, e.target.checked)}
                        />
                      </td>
                    ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card" style={{ overflowX: 'auto' }}>
          <h3>Attendance Summary by Player</h3>
          <table className="table-center">
            <thead>
              <tr>
                <th>Player</th>
                <th>Attended</th>
                <th>Total</th>
                <th>%</th>
              </tr>
            </thead>
            <tbody>
              {attendanceSummaryByPlayer.map((row) => (
                <tr key={row.playerId}>
                  <td>{row.name}</td>
                  <td>{row.attended}</td>
                  <td>{row.total}</td>
                  <td>{row.pct}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="app-shell">
      <Sidebar page={page} setPage={setPage} />

      <main className="main-content">
        {appError && page !== 'games' && (
          <div className="card" style={{ marginBottom: 16 }}>
            <p style={{ color: '#b91c1c', margin: 0 }}>Error: {appError}</p>
          </div>
        )}

        {page === 'players' && renderPlayersPage()}
        {page === 'positioning-priority' && renderPositioningPriorityPage()}
        {page === 'games' && renderGamesPage()}
        {page === 'game-detail' && renderGameDetailPage()}
        {page === 'lineup-setter' && renderLineupSetterPage()}
        {page === 'tracking' && renderTrackingPage()}
        {page === 'attendance' && renderAttendancePage()}
      </main>
    </div>
  )
}
