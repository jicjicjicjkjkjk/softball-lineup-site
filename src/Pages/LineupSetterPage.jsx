import { useEffect, useMemo, useState } from 'react'
import { formatDateShort } from '../lib/appHelpers'
import LineupFocusPanel from '../Components/LineupFocusPanel'

function renderOptionLabel(option) {
  if (!option) return ''
  if (typeof option === 'string') return option
  return option.label || option.value || ''
}

function renderOptionValue(option) {
  if (!option) return ''
  if (typeof option === 'string') return option
  return option.value || option.label || ''
}

function getOptionLabel(options, value) {
  if (!value) return ''
  const match = (options || []).find(
    (opt) => opt.value === value || opt.label === value
  )
  return match?.label || value
}

function compareGamesAscLocal(a, b, pk) {
  const aDate = a?.date || ''
  const bDate = b?.date || ''
  if (aDate !== bDate) return aDate.localeCompare(bDate)

  const aOrder = Number(a?.game_order ?? 0)
  const bOrder = Number(b?.game_order ?? 0)
  if (aOrder !== bOrder) return aOrder - bOrder

  return String(pk(a?.id)).localeCompare(String(pk(b?.id)))
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

export default function LineupSetterPage({
  optimizerFocusLineup,
  optimizerFocusGame,
  optimizerFocusLocked,
  optimizerImportSourceGameId,
  setOptimizerImportSourceGameId,
  optimizerImportableGames = [],
  importLineupToPreview,
    clearPreviewLineup,
  toggleLineupLocked,
  togglePreviewBattingLock,
  togglePreviewAllBattingLock,
  trackingFilters,
  setTrackingFilters,
  seasonOptions = [],
  gameTypeOptions = [],
  lineupLockedByGame,
  optimizerExistingGameId,
  setOptimizerExistingGameId,
  optimizerPlanSitOutTargets = {},
  setOptimizerPlanSitOutTargets,
  games,
  addExistingGameToBatch,
  optimizerNewDate,
  setOptimizerNewDate,
  optimizerNewOpponent,
  setOptimizerNewOpponent,
  optimizerNewType,
  setOptimizerNewType,
  optimizerNewSeason,
  setOptimizerNewSeason,
  addGameFromOptimizer,
  runOptimizeCurrent,
  optimizerFocusGameId,
  runOptimizeAll,
  optimizerBatchGames,
  optimizerPreviewByGame,
  lineupsByGame,
  activePlayers,
  activePlayerIds,
  requiredOutsForGame,
  setOptimizerFocusGameId,
  savePreview,
  removeBatchGame,
  addPreviewInning,
  removePreviewInning,
  togglePreviewAvailable,
  togglePreviewInningLock,
  LineupGrid,
  fitByPlayer,
  updatePreviewCell,
  updatePreviewBatting,
  togglePreviewCellLock,
  togglePreviewRowLock,
  filteredLineups = [],
  ytdBeforeTotals,
  currentBatchTotals,
  ytdAfterTotals,
  ytdBeforeSitOutRows = [],
  currentPlanSitOutRows = [],
  ytdAfterSitOutRows = [],
  trackingSort,
  setTrackingSort,
  TrackingTable,
  blankLineup,
  pk,
  inningStatus,
  trackingPriorityRows = [],
  trackingPriorityByPositionRows = [],
}) {
  const [printMode, setPrintMode] = useState(null)


  
useEffect(() => {
  const handler = () => setPrintMode(null)
  window.addEventListener('afterprint', handler)
  return () => window.removeEventListener('afterprint', handler)
}, [])
  
  const focusStatuses = optimizerFocusLineup
    ? Array.from({ length: optimizerFocusLineup.innings }, (_, i) => i + 1).map((inning) => ({
        inning,
        ...inningStatus(optimizerFocusLineup, inning, activePlayers, fitByPlayer),
      }))
    : []

  const filterSummary =
    [
      trackingFilters?.seasons?.length
        ? `Season: ${trackingFilters.seasons.join(', ')}`
        : null,
      trackingFilters?.gameTypes?.length
        ? `Type: ${trackingFilters.gameTypes.join(', ')}`
        : null,
      trackingFilters?.lineupStates?.length
        ? `State: ${trackingFilters.lineupStates.join(', ')}`
        : null,
      trackingFilters?.dateFrom ? `From: ${trackingFilters.dateFrom}` : null,
      trackingFilters?.dateTo ? `To: ${trackingFilters.dateTo}` : null,
    ]
      .filter(Boolean)
      .join(' | ') || 'All Games'

  const visibleIds = optimizerFocusLineup?.availablePlayerIds || []

  const orderedPlanGames = [...(optimizerBatchGames || [])].sort((a, b) =>
    compareGamesAscLocal(a, b, pk)
  )

  const currentPlanLineupsOrdered = orderedPlanGames
    .map((game) => {
      return (
        optimizerPreviewByGame[pk(game.id)] ||
        lineupsByGame[pk(game.id)] ||
        blankLineup(
          activePlayers.map((p) => p.id),
          Number(game.innings || 6),
          activePlayerIds()
        )
      )
    })
    .filter(Boolean)

  function addRunningTotalsToTotals(totals, sitOutRows) {
  const next = { ...(totals || {}) }

  ;(sitOutRows || []).forEach((row) => {
    const id = pk(row.playerId)

    const runningValues = (row.running || []).filter(
      (v) => v !== 'x' && v !== '' && v !== null && v !== undefined
    )

    const lastValue = runningValues.length
      ? Number(runningValues[runningValues.length - 1])
      : 0

    next[id] = {
      ...(next[id] || {}),
      sitOutRunningTotal: Number.isNaN(lastValue) ? 0 : lastValue,
    }
  })

  return next
}

const filteredGamesBeforeTotalsWithRunning = addRunningTotalsToTotals(
  ytdBeforeTotals,
  ytdBeforeSitOutRows
)

const currentPlanTotalsWithRunning = addRunningTotalsToTotals(
  currentBatchTotals,
  currentPlanSitOutRows
)

const filteredPlusPlanTotalsWithRunning = addRunningTotalsToTotals(
  ytdAfterTotals,
  ytdAfterSitOutRows
)

  const [priorityPlayerSort, setPriorityPlayerSort] = useState({
    key: 'name',
    direction: 'asc',
  })

  const [priorityPositionSort, setPriorityPositionSort] = useState({
    key: 'name',
    direction: 'asc',
  })

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

  const sortableHeaderStyle = {
    textAlign: 'center',
    verticalAlign: 'middle',
    cursor: 'pointer',
  }

const totalNeeded = currentPlanLineupsOrdered.reduce((sum, lineup) => {
  const players = lineup.availablePlayerIds?.length || 0
  const innings = lineup.innings || 0
  return sum + Math.max(players - 9, 0) * innings
}, 0)

const totalAssigned = Object.values(optimizerPlanSitOutTargets)
  .filter((v) => v !== '' && v != null)
  .reduce((sum, v) => sum + Number(v || 0), 0)
  
  return (
    <div className="stack">
      <div className="card">
        <h2>Lineup Setter</h2>

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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
              <div>
                <label>Existing Game</label>
                <select
                  value={optimizerExistingGameId}
                  onChange={(e) => setOptimizerExistingGameId(e.target.value)}
                >
                  <option value="">Select game</option>
                  {[...(games || [])]
  .sort((a, b) => -compareGamesAscLocal(a, b, pk))
  .map((game) => (
                    <option key={game.id} value={pk(game.id)}>
                      {(formatDateShort(game.date) || 'No Date')} vs {game.opponent || 'Opponent'}
                      {game.game_type ? ` • ${game.game_type}` : ''}
                      {game.season ? ` • ${game.season}` : ''}
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

            <div className="lineup-setter-new-game">
              <div
                className="lineup-setter-new-game-fields"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                }}
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
                    <option value="">Select type</option>
                    {gameTypeOptions.map((option) => (
                      <option
                        key={renderOptionValue(option)}
                        value={renderOptionValue(option)}
                      >
                        {renderOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label>Season</label>
                  <select
                    value={optimizerNewSeason}
                    onChange={(e) => setOptimizerNewSeason(e.target.value)}
                  >
                    <option value="">Select season</option>
                    {seasonOptions.map((option) => (
                      <option
                        key={renderOptionValue(option)}
                        value={renderOptionValue(option)}
                      >
                        {renderOptionLabel(option)}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="lineup-setter-new-game-action" style={{ marginTop: 12 }}>
                <button onClick={addGameFromOptimizer}>Add New Game</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Games in Current Plan</h3>
            <button
  onClick={() => {
    const n = (value) => Math.round(Number(value || 0))

    const lineupPages = orderedPlanGames
      .map((game) => {
        const lineup = optimizerPreviewByGame[pk(game.id)] || lineupsByGame[pk(game.id)]
        if (!lineup || !lineup.innings) return ''

        const playersInGame = activePlayers.filter((player) =>
          (lineup.availablePlayerIds || []).map(pk).includes(pk(player.id))
        )

        const sortedPlayers = [...playersInGame].sort((a, b) => {
          const aOrder = Number(lineup.battingOrder?.[pk(a.id)] ?? 999)
          const bOrder = Number(lineup.battingOrder?.[pk(b.id)] ?? 999)
          return aOrder - bOrder
        })

        const inningHeaders = Array.from({ length: Number(lineup.innings || 0) })
          .map((_, i) => `<th>${i + 1}</th>`)
          .join('')

        const playerRows = sortedPlayers
          .map((player) => {
            const id = pk(player.id)

            const cells = Array.from({ length: Number(lineup.innings || 0) })
  .map((_, i) => {
    const value = lineup.cells?.[id]?.[i + 1]

    let fitClass = ''
    if (value && value !== 'Out') {
      const fit =
        fitByPlayer?.[id]?.[value] ||
        (['LF', 'CF', 'RF'].includes(value) ? fitByPlayer?.[id]?.OF : '') ||
        ''

      if (fit === 'primary' || fit === 'A') fitClass = ' primary'
      else if (fit === 'secondary' || fit === 'B' || fit === 'C') fitClass = ' secondary'
      else fitClass = ' not-allowed'
    }

    return `<td class="${fitClass.trim()}">${value === 'Out' ? 'OUT' : value || '-'}</td>`
  })
  .join('')
            return `
              <tr>
                <td>${lineup.battingOrder?.[id] || ''}</td>
                <td class="name">${player.name}</td>
                <td>${player.jersey_number || ''}</td>
                ${cells}
              </tr>
            `
          })
          .join('')

        return `
          <section class="print-page">
            <h1>${formatDateShort(game.date) || 'No Date'} vs ${game.opponent || 'Opponent'}</h1>
            <div class="subtitle">
              ${getOptionLabel(gameTypeOptions, game.game_type) || ''} 
              ${getOptionLabel(seasonOptions, game.season) || ''}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Bat</th>
                  <th>Player</th>
                  <th>#</th>
                  ${inningHeaders}
                </tr>
              </thead>
              <tbody>${playerRows}</tbody>
            </table>
          </section>
        `
      })
      .join('')

    const currentPlanRows = activePlayers
  .map((player) => {
    const id = pk(player.id)
    const totals = currentPlanTotalsWithRunning?.[id] || {}

    const getFitClass = (pos) => {
      const fit =
        fitByPlayer?.[id]?.[pos] ||
        (['LF', 'CF', 'RF'].includes(pos) ? fitByPlayer?.[id]?.OF : '') ||
        ''

       if (fit === 'primary' || fit === 'A') return 'primary'
      if (fit === 'secondary' || fit === 'B' || fit === 'C') return 'secondary'
      return 'not-allowed'
    }

    const td = (value, pos) => {
      const v = n(value)

      if (!pos || v === 0 || pos === 'IF' || pos === 'OF') {
        return `<td>${v}</td>`
      }

      return `<td class="${getFitClass(pos)}">${v}</td>`
    }

    return `
      <tr>
        <td class="name">${player.name}</td>
        <td>${n(totals.games)}</td>
        <td>${n(totals.fieldTotal)}</td>
        <td>${n(totals.Out)}</td>
        ${td(totals.P, 'P')}
        ${td(totals.C, 'C')}
        ${td(totals['1B'], '1B')}
        ${td(totals['2B'], '2B')}
        ${td(totals['3B'], '3B')}
        ${td(totals.SS, 'SS')}
        ${td(totals.LF, 'LF')}
        ${td(totals.CF, 'CF')}
        ${td(totals.RF, 'RF')}
        ${td(totals.IF, 'IF')}
        ${td(totals.OF, 'OF')}
        <td>${Number(totals.sitOutRunningTotal || 0).toFixed(2)}</td>
      </tr>
    `
  })
  .join('')

    const html = `
      <html>
        <head>
          <title>Coach Lineup Packet</title>
          <style>
            @page { size: letter portrait; margin: 0.35in; }
            body { font-family: Arial, sans-serif; color: #1f2f46; }
            .print-page { page-break-after: always; }
            h1 { font-size: 18px; margin: 0 0 4px; }
            .subtitle { font-size: 12px; margin-bottom: 10px; font-weight: 700; }
            table { width: 100%; border-collapse: collapse; table-layout: fixed; }
            th, td { border: 1px solid #111; padding: 5px; text-align: center; font-size: 11px; }
            th { background: #e6f4f4; font-weight: 800; }
            td.primary { background: #dcfce7; }
            td.secondary { background: #fef9c3; }
            td.not-allowed { background: #fee2e2; }
            .name { text-align: left; width: 110px; }
            .plan-page { page-break-before: always; }
            .plan-table th, .plan-table td { font-size: 9.5px; padding: 4px 3px; }
            .plan-table td.primary { background: #dcfce7; font-weight: 700; }
            .plan-table td.secondary { background: #fef9c3; }
            .plan-table td.not-allowed { background: #fee2e2; }
          </style>
        </head>
        <body>
          ${lineupPages}

          <section class="plan-page">
            <h1>Current Plan</h1>
            <table class="plan-table">
              <thead>
                <tr>
                  <th>Player</th>
                  <th>Games</th>
                  <th>Fld</th>
                  <th>Out</th>
                  <th>P</th>
                  <th>C</th>
                  <th>1B</th>
                  <th>2B</th>
                  <th>3B</th>
                  <th>SS</th>
                  <th>LF</th>
                  <th>CF</th>
                  <th>RF</th>
                  <th>IF</th>
                  <th>OF</th>
                  <th>Sit Run</th>
                </tr>
              </thead>
              <tbody>${currentPlanRows}</tbody>
            </table>
          </section>
        </body>
      </html>
    `

    const printWindow = window.open('', '_blank')
    printWindow.document.write(html)
    printWindow.document.close()
    printWindow.focus()
    printWindow.print()
  }}
>
  Print Coach Summary
</button>
          </div>

          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Focus</th>
                <th>Date</th>
                <th>Order</th>
                <th>Opponent</th>
                <th>Type</th>
                <th>Season</th>
                <th>Innings</th>
                <th>Req. Outs</th>
                <th>Lock</th>
                <th>Remove</th>
              </tr>
            </thead>
            <tbody>
              {optimizerBatchGames.map((game) => {
                const lineup =
                  optimizerPreviewByGame[pk(game.id)] ||
                  lineupsByGame[pk(game.id)] ||
                  blankLineup(
                    activePlayers.map((p) => p.id),
                    Number(game.innings || 6),
                    activePlayerIds()
                  )

                const effectiveInnings = Number(lineup?.innings || game.innings || 6)
                const effectiveRequiredOuts = requiredOutsForGame(
                  (lineup.availablePlayerIds || []).length,
                  effectiveInnings
                )

                return (
                  <tr key={game.id}>
                    <td>
                      <button onClick={() => setOptimizerFocusGameId(pk(game.id))}>
                        {pk(optimizerFocusGameId) === pk(game.id) ? 'Viewing' : 'Open'}
                      </button>
                    </td>
                    <td>{formatDateShort(game.date)}</td>
                    <td>{game.game_order ?? ''}</td>
                    <td>{game.opponent || 'Opponent'}</td>
                    <td>{getOptionLabel(gameTypeOptions, game.game_type)}</td>
                    <td>{getOptionLabel(seasonOptions, game.season)}</td>
                    <td>{effectiveInnings}</td>
                    <td>{effectiveRequiredOuts}</td>
                    <td>
                      <button
                        onClick={() =>
                          toggleLineupLocked(game.id, !lineupLockedByGame?.[pk(game.id)])
                        }
                      >
                        {lineupLockedByGame?.[pk(game.id)] ? 'Unlock Lineup' : 'Lock Lineup'}
                      </button>
                    </td>
                    <td>
                      <button
  onClick={() => {
    const confirmed = window.confirm(
      `Remove ${formatDateShort(game.date) || 'No Date'} vs ${
        game.opponent || 'Opponent'
      } from the current plan?`
    )

    if (!confirmed) return
    removeBatchGame(game.id)
  }}
>
  Remove
</button>
                    </td>
                  </tr>
                )
              })}

              {!optimizerBatchGames.length && (
                <tr>
                  <td colSpan="10">No games in current plan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LineupFocusPanel
        optimizerFocusGame={optimizerFocusGame}
        optimizerFocusLineup={optimizerFocusLineup}
        optimizerFocusLocked={optimizerFocusLocked}
        optimizerImportSourceGameId={optimizerImportSourceGameId}
        setOptimizerImportSourceGameId={setOptimizerImportSourceGameId}
        optimizerImportableGames={optimizerImportableGames}
        importLineupToPreview={importLineupToPreview}
        toggleLineupLocked={toggleLineupLocked}
        runOptimizeCurrent={runOptimizeCurrent}
        runOptimizeAll={runOptimizeAll}
        clearPreviewLineup={clearPreviewLineup}
        optimizerBatchGames={optimizerBatchGames}
        activePlayers={activePlayers}
        activePlayerIds={activePlayerIds}
        togglePreviewAvailable={togglePreviewAvailable}
        pk={pk}
        blankLineup={blankLineup}
        optimizerPreviewByGame={optimizerPreviewByGame}
        lineupsByGame={lineupsByGame}
        fitByPlayer={fitByPlayer}
        focusStatuses={focusStatuses}
        addPreviewInning={addPreviewInning}
        removePreviewInning={removePreviewInning}
        LineupGrid={LineupGrid}
        visibleIds={visibleIds}
        updatePreviewCell={updatePreviewCell}
        updatePreviewBatting={updatePreviewBatting}
        togglePreviewBattingLock={togglePreviewBattingLock}
        togglePreviewAllBattingLock={togglePreviewAllBattingLock}
        togglePreviewCellLock={togglePreviewCellLock}
        togglePreviewRowLock={togglePreviewRowLock}
        togglePreviewInningLock={togglePreviewInningLock}
        gameTypeOptions={gameTypeOptions}
        seasonOptions={seasonOptions}
        trackingPriorityByPositionRows={trackingPriorityByPositionRows}
      />
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Filters</h3>

        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
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

      <TrackingTable
  title="Filtered Games Before Current Plan"
  universeLabel={`Filtered by: ${filterSummary} (${filteredLineups.length} games)`}
  totals={filteredGamesBeforeTotalsWithRunning}
  sitOutRows={ytdBeforeSitOutRows}
  players={activePlayers}
  enableFitColors={false}
  sortConfig={trackingSort}
  setSortConfig={setTrackingSort}
/>

          <TrackingTable
  title="Current Plan"
  totals={currentPlanTotalsWithRunning}
  sitOutRows={currentPlanSitOutRows}
  players={activePlayers}
  sortConfig={trackingSort}
  setSortConfig={setTrackingSort}
  sitOutTargets={optimizerPlanSitOutTargets}
  showSitOutTargets={true}
  editableSitOutTargets={true}
  setSitOutTargets={setOptimizerPlanSitOutTargets}
  fitByPlayer={fitByPlayer}
  enableFitColors={true}
  planSitOutSummary={{
    totalNeeded,
    totalAssigned,
  }}
  runningTotalLabel="Current Plan Sit Out Running Total"
/>


      <TrackingTable
  title="Filtered Games + Current Plan"
  universeLabel={`Filtered by: ${filterSummary} (${optimizerBatchGames.length} plan games)`}
  totals={filteredPlusPlanTotalsWithRunning}
  sitOutRows={ytdAfterSitOutRows}
  enableFitColors={false}
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

            <div className={`print-only coach-summary-print ${printMode === 'lineupSetter' ? 'show-print' : ''}`}>
  {orderedPlanGames.map((game) => {
    const lineup =
      optimizerPreviewByGame[pk(game.id)] ||
      lineupsByGame[pk(game.id)]

    if (!lineup || !lineup.innings) return null

    const playersInGame = activePlayers.filter((player) =>
      (lineup.availablePlayerIds || []).map(pk).includes(pk(player.id))
    )

    const sortedPlayers = [...playersInGame].sort((a, b) => {
      const aOrder = Number(lineup.battingOrder?.[pk(a.id)] ?? 999)
      const bOrder = Number(lineup.battingOrder?.[pk(b.id)] ?? 999)
      return aOrder - bOrder
    })

    return (
      <div key={game.id} className="print-game">
        <div className="print-title">
          <span>{formatDateShort(game.date) || 'No Date'}</span>
          <span>vs {game.opponent || 'Opponent'}</span>
          {game.game_type ? <span>{getOptionLabel(gameTypeOptions, game.game_type)}</span> : null}
          {game.season ? <span>{getOptionLabel(seasonOptions, game.season)}</span> : null}
        </div>

        <table className="coach-lineup-table">
          <thead>
            <tr>
              <th>Bat</th>
              <th>Player</th>
              <th>#</th>
              {Array.from({ length: Number(lineup.innings || 0) }).map((_, i) => (
                <th key={i}>{i + 1}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {sortedPlayers.map((player) => {
              const id = pk(player.id)

              return (
                <tr key={id}>
                  <td>{lineup.battingOrder?.[id] || ''}</td>
                  <td>{player.name}</td>
                  <td>{player.jersey_number || ''}</td>

                  {Array.from({ length: Number(lineup.innings || 0) }).map((_, i) => {
                    const inning = i + 1
                    const value = lineup.cells?.[id]?.[inning]

                    return (
                      <td key={inning}>
                        {value === 'Out' ? 'OUT' : value || '-'}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    )
  })}

  <div className="coach-plan-page">
    <div className="coach-plan-title">Current Plan</div>

    <table className="coach-plan-table">
      <thead>
        <tr>
          <th>Player</th>
          <th>Games</th>
          <th>Fld</th>
          <th>Out</th>
          <th>P</th>
          <th>C</th>
          <th>1B</th>
          <th>2B</th>
          <th>3B</th>
          <th>SS</th>
          <th>LF</th>
          <th>CF</th>
          <th>RF</th>
          <th>IF</th>
          <th>OF</th>
        </tr>
      </thead>

      <tbody>
        {activePlayers.map((player) => {
          const id = pk(player.id)
          const totals = currentBatchTotals?.[id] || {}
          const n = (value) => Math.round(Number(value || 0))

          return (
            <tr key={id}>
              <td>{player.name}</td>
              <td>{n(totals.games)}</td>
              <td>{n(totals.fieldTotal)}</td>
              <td>{n(totals.Out)}</td>
              <td>{n(totals.P)}</td>
              <td>{n(totals.C)}</td>
              <td>{n(totals['1B'])}</td>
              <td>{n(totals['2B'])}</td>
              <td>{n(totals['3B'])}</td>
              <td>{n(totals.SS)}</td>
              <td>{n(totals.LF)}</td>
              <td>{n(totals.CF)}</td>
              <td>{n(totals.RF)}</td>
              <td>{n(totals.IF)}</td>
              <td>{n(totals.OF)}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  </div>
</div>
    </div>
  )
}
