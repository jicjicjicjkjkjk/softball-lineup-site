import React, { useMemo, useState } from 'react'
import { formatDateShort } from '../lib/appHelpers'
import TrackingFilters from '../Components/TrackingFilters'

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

function displayPct(value) {
  if (value === '' || value === null || value === undefined) return ''
  const n = Number(value)
  return Number.isNaN(n) ? '' : Math.round(n)
}

function printSelectedPlayerSummary({ playerName, filterSummary, rows = [] }) {
  const htmlEscape = (value) =>
    String(value ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;')

  const tableRows = rows
    .map(
      (row, index) => `
        <tr>
          <td>${index + 1}</td>
          <td>${htmlEscape(row.opponent || '')}</td>
          <td>${htmlEscape(formatDateShort(row.date) || '')}</td>
          <td>${htmlEscape(row.active || '')}</td>
          <td>${htmlEscape(row.P || '')}</td>
          <td>${htmlEscape(row.C || '')}</td>
          <td>${htmlEscape(row['1B'] || '')}</td>
          <td>${htmlEscape(row['2B'] || '')}</td>
          <td>${htmlEscape(row['3B'] || '')}</td>
          <td>${htmlEscape(row.SS || '')}</td>
          <td>${htmlEscape(row.LF || '')}</td>
          <td>${htmlEscape(row.CF || '')}</td>
          <td>${htmlEscape(row.RF || '')}</td>
          <td>${htmlEscape(row.Out || '')}</td>
          <td>${htmlEscape(row.Injury || '')}</td>
        </tr>
      `
    )
    .join('')

  const html = `
    <html>
      <head>
        <title>${htmlEscape(playerName)} Positioning Summary</title>
        <style>
          @page { size: landscape; margin: 0.35in; }
          body { font-family: Arial, sans-serif; padding: 18px; color: #111827; }
          h1 { margin: 0 0 4px; font-size: 22px; }
          .subtitle { margin-bottom: 14px; font-size: 12px; color: #4b5563; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; }
          th, td { border: 1px solid #cbd5e1; padding: 5px; font-size: 11px; text-align: center; }
          th { background: #e8f3f3; font-weight: 700; }
          td:nth-child(2), th:nth-child(2) { text-align: left; width: 150px; }
        </style>
      </head>
      <body>
        <h1>${htmlEscape(playerName)} Positioning by Game</h1>
        <div class="subtitle">${htmlEscape(filterSummary)}</div>

        <table>
          <thead>
            <tr>
              <th>Game #</th>
              <th>Opponent</th>
              <th>Date</th>
              <th>Act</th>
              <th>P</th>
              <th>C</th>
              <th>1B</th>
              <th>2B</th>
              <th>3B</th>
              <th>SS</th>
              <th>LF</th>
              <th>CF</th>
              <th>RF</th>
              <th>Out</th>
              <th>Injury</th>
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>

        <script>
          window.onload = function () {
            window.focus()
            window.print()
          }
        </script>
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow pop-ups so the player summary can print.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
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
const sortableHeaderStyle = {
  textAlign: 'center',
  verticalAlign: 'middle',
  cursor: 'pointer',
}

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

function printTrackingReport() {
  const cards = Array.from(document.querySelectorAll('.tracking-card'))

  const wantedTitles = [
    'Batting Order Tracking',
    'Sitting Out Summary',
    'Sit Outs by Player',
    'Tracking by Positioning by Priority',
  ]

  const selectedCards = cards.filter((card) => {
    const title = card.querySelector('h3')?.textContent?.trim()
    return wantedTitles.includes(title)
  })

  const html = `
    <html>
      <head>
        <title>Tracking Report</title>
        <style>
          @page { size: landscape; margin: 0.3in; }
          body { font-family: Arial, sans-serif; color: #1f2f46; padding: 12px; }
          h1 { margin: 0 0 12px; font-size: 22px; }
          h3 { margin: 14px 0 8px; font-size: 16px; }
          table { width: 100%; border-collapse: collapse; table-layout: fixed; margin-bottom: 18px; }
          th, td { border: 1px solid #cbd5e1; padding: 4px; font-size: 8.5px; text-align: center; }
          th { background: #e6f4f4; font-weight: 800; }
          .tracking-scroll { overflow: visible !important; }
          .sticky-col-1, .sticky-col-2, .sticky-col-3 { position: static !important; }
          .tracking-vertical { height: 105px !important; }
          button, select, input { display: none !important; }
          .card, .tracking-card { box-shadow: none !important; border: none !important; padding: 0 !important; }
          .page-break { page-break-before: always; }
        </style>
      </head>
      <body>
        <h1>Tracking Report</h1>
        ${selectedCards
          .map(
            (card, index) => `
              ${index > 0 ? '<div class="page-break"></div>' : ''}
              ${card.innerHTML}
            `
          )
          .join('')}
        <script>
          window.onload = function () {
            window.focus()
            window.print()
          }
        </script>
      </body>
    </html>
  `

  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    alert('Please allow pop-ups so the tracking report can print.')
    return
  }

  printWindow.document.open()
  printWindow.document.write(html)
  printWindow.document.close()
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
  statusOptions = [],
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

  if (trackingFilters?.gameStatuses?.length) {
    parts.push(`Status: ${trackingFilters.gameStatuses.join(', ')}`)
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

    const sortedCombinedPriorityRows = useMemo(() => {
    const byPosition = Object.fromEntries(
      (trackingPriorityByPositionRows || []).map((row) => [pk(row.playerId), row])
    )

    const rows = (trackingPriorityRows || []).map((row) => {
      const posRow = byPosition[pk(row.playerId)] || {}

      return {
        ...row,
        posActP: posRow.actP ?? '',
        posActC: posRow.actC ?? '',
        posAct1B: posRow.act1B ?? '',
        posAct2B: posRow.act2B ?? '',
        posAct3B: posRow.act3B ?? '',
        posActSS: posRow.actSS ?? '',
        posActOF: posRow.actOF ?? '',
      }
    })

    return rows.sort((a, b) =>
      compareMatrixValue(
        a?.[priorityPlayerSort.key],
        b?.[priorityPlayerSort.key],
        priorityPlayerSort.direction
      )
    )
  }, [
    trackingPriorityRows,
    trackingPriorityByPositionRows,
    priorityPlayerSort,
    pk,
  ])
  
  return (
  <div className="stack">
    <div className="row-between wrap-row">
      <h2 style={{ margin: 0 }}>Tracking</h2>
      <button type="button" onClick={printTrackingReport}>
        Print Tracking Report
      </button>
    </div>

<TrackingFilters
  trackingFilters={trackingFilters}
  setTrackingFilters={setTrackingFilters}
  seasonOptions={seasonOptions}
  gameTypeOptions={gameTypeOptions}
  statusOptions={statusOptions}
/>
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

            {trackingPlayerId && (
              <button
                type="button"
                onClick={() => {
                  const player = (activePlayers || []).find((p) => pk(p.id) === pk(trackingPlayerId))

                  printSelectedPlayerSummary({
                    playerName: player?.name || 'Player',
                    filterSummary: `${filterSummary} (${trackingGames.length} games)`,
                    rows: selectedPlayerPositions || [],
                  })
                }}
              >
                Print Player Summary
              </button>
            )}
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
  <h3>Tracking by Positioning by Priority</h3>

  <div className="tracking-scroll">
    <table className="tracking-table priority-groups priority-combined-table">
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
            Field
          </th>

          {['P', 'C', '1B', '2B', '3B', 'SS', 'OF'].map((pos) => (
            <th key={pos} colSpan="3" className="group-box priority-pos-heading">
              {pos}
            </th>
          ))}
        </tr>

        <tr>
          {[
            ['P', 'targP', 'actP', 'posActP'],
            ['C', 'targC', 'actC', 'posActC'],
            ['1B', 'targ1B', 'act1B', 'posAct1B'],
            ['2B', 'targ2B', 'act2B', 'posAct2B'],
            ['3B', 'targ3B', 'act3B', 'posAct3B'],
            ['SS', 'targSS', 'actSS', 'posActSS'],
            ['OF', 'targOF', 'actOF', 'posActOF'],
          ].map(([pos, targetKey, playerKey, positionKey]) => (
            <React.Fragment key={pos}>
              <th
                className="col-small group-start priority-wrap-header"
                style={sortableHeaderStyle}
                onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, targetKey))}
              >
                TGT %
              </th>

              <th
                className="col-small priority-wrap-header"
                style={sortableHeaderStyle}
                onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, playerKey))}
              >
                Act % Ply
              </th>

              <th
                className="col-small group-end priority-wrap-header"
                style={sortableHeaderStyle}
                onClick={() => setPriorityPlayerSort((s) => nextMatrixSort(s, positionKey))}
              >
                Act % Pos
              </th>
            </React.Fragment>
          ))}
        </tr>
      </thead>

      <tbody>
        {sortedCombinedPriorityRows.map((row) => (
          <tr key={row.playerId}>
            <td className="sticky-col-1 col-player" style={{ textAlign: 'left' }}>
              {row.name}
            </td>

            <td className="sticky-col-2 col-small" style={{ textAlign: 'center' }}>
              {displayPct(row.fieldTotal)}
            </td>

            <td className="col-small group-start">{displayPct(row.targP)}</td>
            <td className="col-small">{displayPct(row.actP)}</td>
            <td className="col-small group-end">{displayPct(row.posActP)}</td>

            <td className="col-small group-start">{displayPct(row.targC)}</td>
            <td className="col-small">{displayPct(row.actC)}</td>
            <td className="col-small group-end">{displayPct(row.posActC)}</td>

            <td className="col-small group-start">{displayPct(row.targ1B)}</td>
            <td className="col-small">{displayPct(row.act1B)}</td>
            <td className="col-small group-end">{displayPct(row.posAct1B)}</td>

            <td className="col-small group-start">{displayPct(row.targ2B)}</td>
            <td className="col-small">{displayPct(row.act2B)}</td>
            <td className="col-small group-end">{displayPct(row.posAct2B)}</td>

            <td className="col-small group-start">{displayPct(row.targ3B)}</td>
            <td className="col-small">{displayPct(row.act3B)}</td>
            <td className="col-small group-end">{displayPct(row.posAct3B)}</td>

            <td className="col-small group-start">{displayPct(row.targSS)}</td>
            <td className="col-small">{displayPct(row.actSS)}</td>
            <td className="col-small group-end">{displayPct(row.posActSS)}</td>

            <td className="col-small group-start">{displayPct(row.targOF)}</td>
            <td className="col-small">{displayPct(row.actOF)}</td>
            <td className="col-small group-end">{displayPct(row.posActOF)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
</div>
    </div>
  )
}
