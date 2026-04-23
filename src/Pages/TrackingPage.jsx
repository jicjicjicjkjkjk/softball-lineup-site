import { useMemo, useState } from 'react'
import { formatDateShort } from '../lib/appHelpers'

function shortenOpponent(name = '') {
  const cleaned = String(name || '')
    .replace(/\b(8u|9u|10u|11u|12u|13u|14u|15u|16u|18u)\b/gi, '')
    .replace(/\b(gold|silver|black|teal|blue|red|white)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned) return ''

  const words = cleaned.split(' ').filter(Boolean)
  if (words.length === 1) return words[0].slice(0, 6)
  return `${words[0].slice(0, 3)} ${words[1].slice(0, 3)}`
}

function RotatedGameHeader({ game, onClick }) {
  const shortName = shortenOpponent(game?.opponent || '')
  const shortDate = formatDateShort(game?.date || '')
  const label = [shortName, shortDate].filter(Boolean).join(' ')

  return (
    <th
      className="tracking-vertical"
      onClick={onClick}
      style={{
        width: 34,
        minWidth: 34,
        maxWidth: 34,
        height: 150,
        minHeight: 150,
        maxHeight: 150,
        padding: '4px 0',
        verticalAlign: 'bottom',
        textAlign: 'center',
        overflow: 'hidden',
        background: '#e6f4f4',
        cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <div
        style={{
          writingMode: 'vertical-rl',
          transform: 'rotate(180deg)',
          whiteSpace: 'nowrap',
          fontSize: 11,
          fontWeight: 700,
          lineHeight: 1,
          margin: '0 auto',
        }}
      >
        {label}
      </div>
    </th>
  )
}

function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return {
    key,
    direction: current.direction === 'asc' ? 'desc' : 'asc',
  }
}

function compareValues(a, b, direction = 'asc') {
  const aVal = a ?? ''
  const bVal = b ?? ''

  const aNum = Number(aVal)
  const bNum = Number(bVal)
  const aIsNum = aVal !== '' && !Number.isNaN(aNum)
  const bIsNum = bVal !== '' && !Number.isNaN(bNum)

  let result = 0

  if (aIsNum && bIsNum) {
    result = aNum - bNum
  } else {
    result = String(aVal).localeCompare(String(bVal))
  }

  return direction === 'asc' ? result : -result
}

function nextMatrixSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return {
    key,
    direction: current.direction === 'asc' ? 'desc' : 'asc',
  }
}

function compareMatrixValue(a, b, direction = 'asc') {
  const aBlank = a === '' || a === null || a === undefined
  const bBlank = b === '' || b === null || b === undefined

  if (aBlank && bBlank) return 0
  if (aBlank) return 1
  if (bBlank) return -1

  const aNum = Number(a)
  const bNum = Number(b)

  let result = 0

  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    result = aNum - bNum
  } else {
    result = String(a).localeCompare(String(b))
  }

  return direction === 'asc' ? result : -result
}

const centerCell = { textAlign: 'center', verticalAlign: 'middle' }
const centerHeader = { textAlign: 'center', verticalAlign: 'middle', cursor: 'pointer' }

const playerHeaderStyle = {
  width: 86,
  minWidth: 86,
  maxWidth: 86,
  textAlign: 'left',
  verticalAlign: 'middle',
  cursor: 'pointer',
}

const playerCellStyle = {
  width: 86,
  minWidth: 86,
  maxWidth: 86,
  textAlign: 'left',
}

const avgHeaderStyle = {
  width: 52,
  minWidth: 52,
  maxWidth: 52,
  textAlign: 'center',
  verticalAlign: 'middle',
  cursor: 'pointer',
}

const avgCellStyle = {
  width: 52,
  minWidth: 52,
  maxWidth: 52,
  textAlign: 'center',
  verticalAlign: 'middle',
}

const metricHeaderStyle = {
  width: 110,
  minWidth: 110,
  maxWidth: 110,
  textAlign: 'left',
  verticalAlign: 'middle',
}

const metricCellStyle = {
  width: 110,
  minWidth: 110,
  maxWidth: 110,
  textAlign: 'left',
}

export default function TrackingPage({
  trackingLockedLineups,
  trackingTotals,
  trackingSitByPlayer = [],
  trackingSitSummary = [],
  activePlayers,
  trackingSort,
  setTrackingSort,
  trackingFilters,
  setTrackingFilters,
  seasonOptions,
  gameTypeOptions,
  TrackingTable,
  battingRows,
  sitSummary,
  sitByPlayer,
  gamesWithLineups,
  trackingPlayerId,
  setTrackingPlayerId,
  selectedPlayerPositions,
  trackingPriorityRows = [],
  trackingPriorityByPositionRows = [],
  pk,
}) {
  
  const [battingSort, setBattingSort] = useState({ key: 'name', direction: 'asc' })
  const [sitOutSort, setSitOutSort] = useState({ key: 'name', direction: 'asc' })
  const [deltaSort, setDeltaSort] = useState({ key: 'name', direction: 'asc' })
  const [runningSort, setRunningSort] = useState({ key: 'name', direction: 'asc' })
  const [priorityPlayerSort, setPriorityPlayerSort] = useState({
    key: 'name',
    direction: 'asc',
  })

  const [priorityPositionSort, setPriorityPositionSort] = useState({
    key: 'name',
    direction: 'asc',
  })
  
  const trackingGameIds = useMemo(
    () => new Set((trackingSitSummary || []).map((g) => pk(g.gameId))),
    [trackingSitSummary, pk]
  )

  const trackingGames = useMemo(() => {
    return (gamesWithLineups || []).filter((g) => trackingGameIds.has(pk(g.id)))
  }, [gamesWithLineups, trackingGameIds, pk])

const filterSummary = useMemo(() => {
  const parts = []

  if (trackingFilters?.seasons?.length) {
    parts.push(`Season: ${trackingFilters.seasons.join(', ')}`)
  }

  if (trackingFilters?.gameTypes?.length) {
    parts.push(`Type: ${trackingFilters.gameTypes.join(', ')}`)
  }

  if (trackingFilters?.lineupStates?.length) {
    parts.push(`State: ${trackingFilters.lineupStates.join(', ')}`)
  }

  if (trackingFilters?.dateFrom) {
    parts.push(`From: ${trackingFilters.dateFrom}`)
  }

  if (trackingFilters?.dateTo) {
    parts.push(`To: ${trackingFilters.dateTo}`)
  }

  return parts.length ? parts.join(' | ') : 'All Games'
}, [trackingFilters])
  
  const sortedBattingRows = useMemo(() => {
    const rows = [...(battingRows || [])]
    return rows.sort((a, b) => {
      if (battingSort.key === 'name') return compareValues(a.name, b.name, battingSort.direction)
      if (battingSort.key === 'avg') return compareValues(a.avg, b.avg, battingSort.direction)

      const gameIndex = Number(String(battingSort.key).replace('game-', ''))
      return compareValues(a.perGame?.[gameIndex], b.perGame?.[gameIndex], battingSort.direction)
    })
  }, [battingRows, battingSort])

  const sortedSitByPlayerRows = useMemo(() => {
    const rows = [...(trackingSitByPlayer || [])]
    return rows.sort((a, b) => {
      if (sitOutSort.key === 'name') return compareValues(a.name, b.name, sitOutSort.direction)

      const gameIndex = Number(String(sitOutSort.key).replace('game-', ''))
      return compareValues(a.perGame?.[gameIndex], b.perGame?.[gameIndex], sitOutSort.direction)
    })
  }, [trackingSitByPlayer, sitOutSort])

  const computedSitRows = useMemo(() => {
    const avgByGame = (trackingSitSummary || []).map((g) => {
      const value = Number(g?.avgSit)
      return Number.isNaN(value) ? null : value
    })

    return (trackingSitByPlayer || []).map((row) => {
      let runningTotal = 0

      const deltaPerGame = (row.perGame || []).map((value, index) => {
        if (value === 'x' || value === '' || value === null || value === undefined) return 'x'

        const playerOuts = Number(value)
        const avgSit = avgByGame[index]

        if (Number.isNaN(playerOuts) || avgSit === null || Number.isNaN(avgSit)) return 'x'

        return Number((avgSit - playerOuts).toFixed(2))
      })

      const running = deltaPerGame.map((value) => {
        if (value === 'x') return 'x'
        runningTotal = Number((runningTotal + Number(value)).toFixed(2))
        return runningTotal
      })

      return {
        ...row,
        deltaPerGame,
        running,
      }
    })
  }, [trackingSitByPlayer, trackingSitSummary])

  const sortedDeltaRows = useMemo(() => {
    const rows = [...computedSitRows]
    return rows.sort((a, b) => {
      if (deltaSort.key === 'name') return compareValues(a.name, b.name, deltaSort.direction)

      const gameIndex = Number(String(deltaSort.key).replace('game-', ''))
      return compareValues(a.deltaPerGame?.[gameIndex], b.deltaPerGame?.[gameIndex], deltaSort.direction)
    })
  }, [computedSitRows, deltaSort])

  const sortedRunningRows = useMemo(() => {
    const rows = [...computedSitRows]
    return rows.sort((a, b) => {
      if (runningSort.key === 'name') return compareValues(a.name, b.name, runningSort.direction)

      const gameIndex = Number(String(runningSort.key).replace('game-', ''))
      return compareValues(a.running?.[gameIndex], b.running?.[gameIndex], runningSort.direction)
    })
  }, [computedSitRows, runningSort])

  const sortedPriorityPlayerRows = useMemo(() => {
    return [...(trackingPriorityRows || [])].sort((a, b) =>
      compareMatrixValue(
        a?.[priorityPlayerSort.key],
        b?.[priorityPlayerSort.key],
        priorityPlayerSort.direction
      )
    )
  }, [trackingPriorityRows, priorityPlayerSort])

  const sortedPriorityPositionRows = useMemo(() => {
    return [...(trackingPriorityByPositionRows || [])].sort((a, b) =>
      compareMatrixValue(
        a?.[priorityPositionSort.key],
        b?.[priorityPositionSort.key],
        priorityPositionSort.direction
      )
    )
  }, [trackingPriorityByPositionRows, priorityPositionSort])
  
  return (
    <div className="stack">
      <div className="card">
  <h3 style={{ marginTop: 0 }}>Filters</h3>

  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
    
    {/* Season */}
    <div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Season</div>
      <select
        multiple
        value={trackingFilters.seasons}
        onChange={(e) =>
          setTrackingFilters((f) => ({
            ...f,
            seasons: Array.from(e.target.selectedOptions, (o) => o.value),
          }))
        }
      >
        {seasonOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>

    {/* Game Type */}
    <div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Game Type</div>
      <select
        multiple
        value={trackingFilters.gameTypes}
        onChange={(e) =>
          setTrackingFilters((f) => ({
            ...f,
            gameTypes: Array.from(e.target.selectedOptions, (o) => o.value),
          }))
        }
      >
        {gameTypeOptions.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>

    {/* Lineup State */}
    <div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Lineup State</div>
      <select
        multiple
        value={trackingFilters.lineupStates}
        onChange={(e) =>
          setTrackingFilters((f) => ({
            ...f,
            lineupStates: Array.from(e.target.selectedOptions, (o) => o.value),
          }))
        }
      >
        <option value="Locked">Locked</option>
        <option value="Saved">Saved</option>
        <option value="Empty">Empty</option>
      </select>
    </div>
      {/* Date From */}
    <div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Date From</div>
      <input
        type="date"
        value={trackingFilters.dateFrom || ''}
        onChange={(e) =>
          setTrackingFilters((f) => ({
            ...f,
            dateFrom: e.target.value,
          }))
        }
      />
    </div>

    {/* Date To */}
    <div>
      <div style={{ fontSize: 12, fontWeight: 600 }}>Date To</div>
      <input
        type="date"
        value={trackingFilters.dateTo || ''}
        onChange={(e) =>
          setTrackingFilters((f) => ({
            ...f,
            dateTo: e.target.value,
          }))
        }
      />
    </div>

    {/* Clear Filters */}
    <div style={{ display: 'flex', alignItems: 'flex-end' }}>
      <button
        type="button"
        onClick={() =>
          setTrackingFilters({
            seasons: [],
            gameTypes: [],
            lineupStates: [],
            dateFrom: '',
            dateTo: '',
          })
        }
      >
        Clear Filters
      </button>
    </div>
  </div>
</div>
      <div className="card tracking-card">  
        <h3>Batting Order Tracking</h3>
        <div className="tracking-scroll">
          <table className="tracking-table">
            <thead>
              <tr>
                <th
                  className="sticky-col-1 col-player"
                  style={playerHeaderStyle}
                  onClick={() => setBattingSort((s) => nextSort(s, 'name'))}
                >
                  Player
                </th>
                <th
                  className="sticky-col-2 col-avg"
                  style={avgHeaderStyle}
                  onClick={() => setBattingSort((s) => nextSort(s, 'avg'))}
                >
                  Avg
                </th>
                {(gamesWithLineups || []).map((g, i) => (
                  <RotatedGameHeader
                    key={g.id}
                    game={g}
                    onClick={() => setBattingSort((s) => nextSort(s, `game-${i}`))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedBattingRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player" style={playerCellStyle}>
                    {row.name}
                  </td>
                  <td className="sticky-col-2 col-avg" style={avgCellStyle}>
                    {row.avg}
                  </td>
                  {(row.perGame || []).map((v, i) => (
                    <td key={i} className="col-small" style={centerCell}>
                      {v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <h3>Sitting Out Summary</h3>
        <div className="tracking-scroll">
          <table className="tracking-table">
            <thead>
              <tr>
                <th className="sticky-col-1 col-metric" style={metricHeaderStyle}>
                  Metric
                </th>
                {trackingGames.map((g) => (
                  <RotatedGameHeader key={g.id} game={g} />
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="sticky-col-1 col-metric" style={metricCellStyle}>
                  Total Players
                </td>
                {(trackingSitSummary || []).map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>
                    {g.totalPlayers}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={metricCellStyle}>
                  Innings
                </td>
                {(trackingSitSummary || []).map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>
                    {g.innings}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={metricCellStyle}>
                  # Sit Outs
                </td>
                {(trackingSitSummary || []).map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>
                    {g.sitOuts}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={metricCellStyle}>
                  Injury
                </td>
                {(trackingSitSummary || []).map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>
                    {g.injury}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="sticky-col-1 col-metric" style={metricCellStyle}>
                  Average Out
                </td>
                {(trackingSitSummary || []).map((g) => (
                  <td key={g.gameId} className="col-small" style={centerCell}>
                    {g.avgSit}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <h3>Sit Outs by Player</h3>
        <div className="tracking-scroll">
          <table className="tracking-table">
            <thead>
              <tr>
                <th
                  className="sticky-col-1 col-player"
                  style={playerHeaderStyle}
                  onClick={() => setSitOutSort((s) => nextSort(s, 'name'))}
                >
                  Player
                </th>
                {trackingGames.map((g, i) => (
                  <RotatedGameHeader
                    key={g.id}
                    game={g}
                    onClick={() => setSitOutSort((s) => nextSort(s, `game-${i}`))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedSitByPlayerRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player" style={playerCellStyle}>
                    {row.name}
                  </td>
                  {(row.perGame || []).map((v, i) => (
                    <td key={i} className="col-small" style={centerCell}>
                      {v === '' || v === null || v === undefined ? 'x' : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ height: 16 }} />

          <h3 style={{ marginTop: 0 }}>Sit Out vs Average Per Game</h3>
          <table className="tracking-table">
            <thead>
              <tr>
                <th
                  className="sticky-col-1 col-player"
                  style={playerHeaderStyle}
                  onClick={() => setDeltaSort((s) => nextSort(s, 'name'))}
                >
                  Player
                </th>
                {trackingGames.map((g, i) => (
                  <RotatedGameHeader
                    key={g.id}
                    game={g}
                    onClick={() => setDeltaSort((s) => nextSort(s, `game-${i}`))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedDeltaRows.map((row) => (
                <tr key={`${row.playerId}-delta`}>
                  <td className="sticky-col-1 col-player" style={playerCellStyle}>
                    {row.name}
                  </td>
                  {(row.deltaPerGame || []).map((v, i) => (
                    <td key={i} className="col-small" style={centerCell}>
                      {v === '' || v === null || v === undefined ? 'x' : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ height: 16 }} />

          <h3 style={{ marginTop: 0 }}>Sit Out Running Total</h3>
          <table className="tracking-table">
            <thead>
              <tr>
                <th
                  className="sticky-col-1 col-player"
                  style={playerHeaderStyle}
                  onClick={() => setRunningSort((s) => nextSort(s, 'name'))}
                >
                  Player
                </th>
                {trackingGames.map((g, i) => (
                  <RotatedGameHeader
                    key={g.id}
                    game={g}
                    onClick={() => setRunningSort((s) => nextSort(s, `game-${i}`))}
                  />
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRunningRows.map((row) => (
                <tr key={`${row.playerId}-running`}>
                  <td className="sticky-col-1 col-player" style={playerCellStyle}>
                    {row.name}
                  </td>
                  {(row.running || []).map((v, i) => (
                    <td key={i} className="col-small" style={centerCell}>
                      {v === '' || v === null || v === undefined ? 'x' : v}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card tracking-card">
        <div className="positioning-controls">
          <div>
  <h3 style={{ margin: 0 }}>Positioning by Player Per Game</h3>
  <div style={{ fontSize: 12, color: '#555', marginTop: 4 }}>
    Filtered by: {filterSummary} ({trackingGames.length} games)
  </div>
</div>
          <div className="positioning-player-select">
            <select value={trackingPlayerId} onChange={(e) => setTrackingPlayerId(e.target.value)}>
              <option value="">Select Player</option>
              {(activePlayers || []).map((p) => (
                <option key={p.id} value={pk(p.id)}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="tracking-scroll">
          {trackingPlayerId ? (
            <table className="tracking-table positioning-table">
              <thead>
                <tr>
                  <th className="sticky-col-1 col-game" style={centerHeader}>
                    Game #
                  </th>
                  <th
                    className="sticky-col-2 col-opponent"
                    style={{ textAlign: 'left', verticalAlign: 'middle' }}
                  >
                    Opponent
                  </th>
                  <th className="sticky-col-3 col-date" style={centerHeader}>
                    Date
                  </th>
                  <th className="col-act" style={centerHeader}>
                    Act
                  </th>
                  <th className="col-small" style={centerHeader}>
                    P
                  </th>
                  <th className="col-small" style={centerHeader}>
                    C
                  </th>
                  <th className="col-small" style={centerHeader}>
                    1B
                  </th>
                  <th className="col-small" style={centerHeader}>
                    2B
                  </th>
                  <th className="col-small" style={centerHeader}>
                    3B
                  </th>
                  <th className="col-small" style={centerHeader}>
                    SS
                  </th>
                  <th className="col-small" style={centerHeader}>
                    LF
                  </th>
                  <th className="col-small" style={centerHeader}>
                    CF
                  </th>
                  <th className="col-small" style={centerHeader}>
                    RF
                  </th>
                  <th className="col-small" style={centerHeader}>
                    Out
                  </th>
                  <th className="col-small" style={centerHeader}>
                    Injury
                  </th>
                </tr>
              </thead>
              <tbody>
                {(selectedPlayerPositions || []).map((row, idx) => (
                  <tr key={row.gameId}>
                    <td className="sticky-col-1 col-game" style={centerCell}>
                      {idx + 1}
                    </td>
                    <td className="sticky-col-2 col-opponent" style={{ textAlign: 'left' }}>
                      {row.opponent}
                    </td>
                    <td className="sticky-col-3 col-date" style={centerCell}>
                      {formatDateShort(row.date)}
                    </td>
                    <td className="col-act" style={centerCell}>
                      {row.active}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.P || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.C || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row['1B'] || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row['2B'] || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row['3B'] || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.SS || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.LF || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.CF || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.RF || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.Out || ''}
                    </td>
                    <td className="col-small" style={centerCell}>
                      {row.Injury || ''}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p>Select a player to view by-game positioning.</p>
          )}
        </div>
      </div>

      
      <TrackingTable
  title="Tracking Totals"
  universeLabel={`Filtered by: ${filterSummary} (${trackingGames.length} games)`}
  totals={trackingTotals}
  sitOutRows={computedSitRows}
  players={activePlayers}
  sortConfig={trackingSort}
  setSortConfig={setTrackingSort}
/>

                  <div className="card tracking-card">
        <h3>Tracking by Positioning by Priority - Player</h3>
        <div className="tracking-scroll">
          <table className="tracking-table priority-groups">
            <thead>
              <tr>
                <th
                  rowSpan="2"
                  className="sticky-col-1 col-player"
                  style={{ textAlign: 'left', verticalAlign: 'middle', cursor: 'pointer' }}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'name'))}
                >
                  Player
                </th>
                <th
                  rowSpan="2"
                  className="sticky-col-2 col-small"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'fieldTotal'))}
                >
                  Fld
                </th>

                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>
                  P
                </th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>
                  C
                </th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>
                  1B
                </th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>
                  2B
                </th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>
                  3B
                </th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>
                  SS
                </th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>
                  OF
                </th>
              </tr>
              <tr>
                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'targP'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'actP'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'targC'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'actC'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'targ1B'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'act1B'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'targ2B'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'act2B'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'targ3B'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'act3B'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'targSS'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'actSS'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'targOF'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, 'actOF'))}
                >
                  ACT
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPriorityPlayerRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player" style={{ textAlign: 'left' }}>
                    {row.name}
                  </td>
                  <td className="sticky-col-2 col-small" style={{ textAlign: 'center' }}>
                    {row.fieldTotal}
                  </td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targP}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actP}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targC}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actC}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targ1B}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.act1B}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targ2B}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.act2B}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targ3B}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.act3B}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targSS}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actSS}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targOF}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actOF}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
            <div className="card tracking-card">
              <div className="card tracking-card">
        <h3>Tracking by Positioning by Priority - Position</h3>
        <div className="tracking-scroll">
          <table className="tracking-table priority-groups">
            <thead>
              <tr>
                <th
                  rowSpan="2"
                  className="sticky-col-1 col-player"
                  style={{ textAlign: 'left', verticalAlign: 'middle', cursor: 'pointer' }}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'name'))}
                >
                  Player
                </th>
                <th
                  rowSpan="2"
                  className="sticky-col-2 col-small"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'fieldTotal'))}
                >
                  Fld
                </th>

                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>P</th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>C</th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>1B</th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>2B</th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>3B</th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>SS</th>
                <th colSpan="2" className="group-box" style={{ textAlign: 'center' }}>OF</th>
              </tr>
              <tr>
                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'targP'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'actP'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'targC'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'actC'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'targ1B'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'act1B'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'targ2B'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'act2B'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'targ3B'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'act3B'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'targSS'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'actSS'))}
                >
                  ACT
                </th>

                <th
                  className="col-small group-start"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'targOF'))}
                >
                  TGT
                </th>
                <th
                  className="col-small group-end"
                  style={sortableHeaderStyle}
                  onClick={() => setPriorityPositionSort((s) => nextMatrixSort(s, 'actOF'))}
                >
                  ACT
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedPriorityPositionRows.map((row) => (
                <tr key={row.playerId}>
                  <td className="sticky-col-1 col-player" style={{ textAlign: 'left' }}>
                    {row.name}
                  </td>
                  <td className="sticky-col-2 col-small" style={{ textAlign: 'center' }}>
                    {row.fieldTotal}
                  </td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targP}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actP}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targC}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actC}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targ1B}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.act1B}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targ2B}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.act2B}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targ3B}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.act3B}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targSS}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actSS}</td>

                  <td className="col-small group-start" style={{ textAlign: 'center' }}>{row.targOF}</td>
                  <td className="col-small group-end" style={{ textAlign: 'center' }}>{row.actOF}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
