import React, { useEffect, useMemo, useState } from 'react'
import { formatDateShort } from '../lib/appHelpers'
import LineupFocusPanel from '../Components/LineupFocusPanel'
import { printCoachSummary } from '../lib/coachPrint'
import TrackingFilters from '../Components/TrackingFilters'

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

function displayPct(value) {
  if (value === '' || value === null || value === undefined) return ''
  const n = Number(value)
  return Number.isNaN(n) ? '' : Math.round(n)
}

class LineupSetterErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ borderColor: '#fecaca', background: '#fff7f7' }}>
          <h3 style={{ marginTop: 0, color: '#b91c1c' }}>Lineup focus panel failed to load</h3>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>
            {this.state.error?.message || String(this.state.error)}
          </pre>
        </div>
      )
    }

    return this.props.children
  }
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
  statusOptions = [],
  lineupLockedByGame,
  optimizerExistingGameId,
  setOptimizerExistingGameId,
  optimizerPlanSitOutTargets = {},
  setOptimizerPlanSitOutTargets,
  optimizerMode = 'standard',
  setOptimizerMode,
  optimizerProfiles = [],
  optimizerProfileRules = {},
  games = [],
  addExistingGameToBatch,
  runOptimizeCurrent,
  optimizerFocusGameId,
  runOptimizeAll,
  optimizerBatchGames = [],
  optimizerPreviewByGame = {},
  lineupsByGame = {},
  activePlayers = [],
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
  updatePreviewGameSitOutTarget,
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

const safeActivePlayers = Array.isArray(activePlayers) ? activePlayers : []

const activePlayerIdList = Array.isArray(activePlayerIds)
  ? activePlayerIds
  : safeActivePlayers.map((p) => pk(p.id))

const visibleIds = optimizerFocusLineup?.availablePlayerIds || activePlayerIdList

let focusStatuses = []

try {
  focusStatuses =
    optimizerFocusLineup && typeof inningStatus === 'function'
      ? Array.from({ length: Number(optimizerFocusLineup.innings || 0) }, (_, i) => i + 1).map(
          (inning) => ({
            inning,
            ...inningStatus(optimizerFocusLineup, inning, safeActivePlayers, fitByPlayer || {}),
          })
        )
      : []
} catch {
  focusStatuses = []
}

  const filterSummary =
    [
      trackingFilters?.seasons?.length
        ? `Season: ${trackingFilters.seasons.join(', ')}`
        : null,
            trackingFilters?.gameTypes?.length
        ? `Type: ${trackingFilters.gameTypes.join(', ')}`
        : null,
      trackingFilters?.gameStatuses?.length
        ? `Status: ${trackingFilters.gameStatuses.join(', ')}`
        : null,
      trackingFilters?.lineupStates?.length
        ? `State: ${trackingFilters.lineupStates.join(', ')}`
        : null,
      trackingFilters?.dateFrom ? `From: ${trackingFilters.dateFrom}` : null,
      trackingFilters?.dateTo ? `To: ${trackingFilters.dateTo}` : null,
    ]
      .filter(Boolean)
      .join(' | ') || 'All Games'


  const orderedPlanGames = [...(optimizerBatchGames || [])].sort((a, b) =>
    compareGamesAscLocal(a, b, pk)
  )

  const currentPlanLineupsOrdered = orderedPlanGames
    .map((game) => {
      return (
        optimizerPreviewByGame[pk(game.id)] ||
        lineupsByGame[pk(game.id)] ||
        blankLineup(
          safeActivePlayers.map((p) => p.id),
          Number(game.innings || 6),
          activePlayerIdList
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

    const [lineupSetterUniverse, setLineupSetterUniverse] = useState('currentPlan')

  const selectedUniverseTotals = useMemo(() => {
  if (lineupSetterUniverse === 'filtered') return filteredGamesBeforeTotalsWithRunning
  if (lineupSetterUniverse === 'filteredPlusPlan') return filteredPlusPlanTotalsWithRunning
  return currentPlanTotalsWithRunning
}, [
  lineupSetterUniverse,
  filteredGamesBeforeTotalsWithRunning,
  filteredPlusPlanTotalsWithRunning,
  currentPlanTotalsWithRunning,
])

const selectedUniverseSitOutRows = useMemo(() => {
  if (lineupSetterUniverse === 'filtered') return ytdBeforeSitOutRows
  if (lineupSetterUniverse === 'filteredPlusPlan') return ytdAfterSitOutRows
  return currentPlanSitOutRows
}, [
  lineupSetterUniverse,
  ytdBeforeSitOutRows,
  ytdAfterSitOutRows,
  currentPlanSitOutRows,
])

const selectedUniverseTitle =
  lineupSetterUniverse === 'filtered'
    ? 'Filtered Games Before Current Plan'
    : lineupSetterUniverse === 'filteredPlusPlan'
    ? 'Filtered Games + Current Plan'
    : 'Current Plan'

  const priorityTargetByPlayer = useMemo(() => {
    const next = {}

    ;(trackingPriorityRows || []).forEach((row) => {
      next[pk(row.playerId)] = row
    })

    return next
  }, [trackingPriorityRows, pk])

  const basePriorityPlayerRows = useMemo(() => {
    return safeActivePlayers.map((player) => {
      const playerId = pk(player.id)
      const totals = selectedUniverseTotals?.[playerId] || {}
      const target = priorityTargetByPlayer[playerId] || {}
      const fieldTotal = Math.max(Number(totals.fieldTotal || 0), 1)

      const actPct = (value) => {
        const pct = Number(((Number(value || 0) / fieldTotal) * 100).toFixed(1))
        return pct === 0 ? '' : pct
      }

      return {
        playerId,
        name: player.name,
        fieldTotal: Number(totals.fieldTotal || 0),

        targP: target.targP || '',
        targC: target.targC || '',
        targ1B: target.targ1B || '',
        targ2B: target.targ2B || '',
        targ3B: target.targ3B || '',
        targSS: target.targSS || '',
        targOF: target.targOF || '',

        actP: actPct(totals.P),
        actC: actPct(totals.C),
        act1B: actPct(totals['1B']),
        act2B: actPct(totals['2B']),
        act3B: actPct(totals['3B']),
        actSS: actPct(totals.SS),
        actOF: actPct(totals.OF),
      }
    })
  }, [safeActivePlayers, selectedUniverseTotals, priorityTargetByPlayer, pk])

  const basePriorityPositionRows = useMemo(() => {
    const positionTotals = {
  P: safeActivePlayers.reduce(
    (sum, player) => sum + Number(selectedUniverseTotals?.[pk(player.id)]?.P || 0),
    0
  ),
  C: safeActivePlayers.reduce(
    (sum, player) => sum + Number(selectedUniverseTotals?.[pk(player.id)]?.C || 0),
    0
  ),
  '1B': safeActivePlayers.reduce(
    (sum, player) => sum + Number(selectedUniverseTotals?.[pk(player.id)]?.['1B'] || 0),
    0
  ),
  '2B': safeActivePlayers.reduce(
    (sum, player) => sum + Number(selectedUniverseTotals?.[pk(player.id)]?.['2B'] || 0),
    0
  ),
  '3B': safeActivePlayers.reduce(
    (sum, player) => sum + Number(selectedUniverseTotals?.[pk(player.id)]?.['3B'] || 0),
    0
  ),
  SS: safeActivePlayers.reduce(
    (sum, player) => sum + Number(selectedUniverseTotals?.[pk(player.id)]?.SS || 0),
    0
  ),
  OF: safeActivePlayers.reduce(
    (sum, player) => sum + Number(selectedUniverseTotals?.[pk(player.id)]?.OF || 0),
    0
  ),
}

    const actPctByPosition = (playerTotal, positionKey) => {
      const numer = Number(playerTotal || 0)
      const denom = Number(positionTotals[positionKey] || 0)
      if (!numer || !denom) return ''
      return Number(((numer / denom) * 100).toFixed(1))
    }

    return safeActivePlayers.map((player) => {
      const playerId = pk(player.id)
      const totals = selectedUniverseTotals?.[playerId] || {}
      const target = priorityTargetByPlayer[playerId] || {}

      return {
        playerId,
        name: player.name,
        fieldTotal: Number(totals.fieldTotal || 0),

        targP: target.targP || '',
        targC: target.targC || '',
        targ1B: target.targ1B || '',
        targ2B: target.targ2B || '',
        targ3B: target.targ3B || '',
        targSS: target.targSS || '',
        targOF: target.targOF || '',

        actP: actPctByPosition(totals.P, 'P'),
        actC: actPctByPosition(totals.C, 'C'),
        act1B: actPctByPosition(totals['1B'], '1B'),
        act2B: actPctByPosition(totals['2B'], '2B'),
        act3B: actPctByPosition(totals['3B'], '3B'),
        actSS: actPctByPosition(totals.SS, 'SS'),
        actOF: actPctByPosition(totals.OF, 'OF'),
      }
    })
  }, [safeActivePlayers, selectedUniverseTotals, priorityTargetByPlayer, pk])

    const sortedCombinedPriorityRows = useMemo(() => {
    const byPosition = Object.fromEntries(
      (basePriorityPositionRows || []).map((row) => [pk(row.playerId), row])
    )

    const rows = (basePriorityPlayerRows || []).map((row) => {
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
  }, [basePriorityPlayerRows, basePriorityPositionRows, priorityPlayerSort, pk])
  
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

const selectedOptimizerProfile =
  optimizerProfiles.find((profile) => profile.profile_key === optimizerMode) ||
  optimizerProfiles.find((profile) => profile.id === optimizerMode) ||
  optimizerProfiles.find((profile) => profile.is_default) ||
  null

const optimizerModeDescription =
  selectedOptimizerProfile?.description ||
  'No description has been added for this optimizer mode yet.'
  
  return (
    <div className="stack">
      <div className="card">
        <h2>Lineup Setter</h2>

<div className="lineup-setter-top-grid">
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

        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
            <h3 style={{ margin: 0 }}>Games in Current Plan</h3>
            <button
  onClick={() =>
    printCoachSummary({
      orderedPlanGames,
      optimizerPreviewByGame,
      lineupsByGame,
      activePlayers,
      currentPlanTotalsWithRunning,
      currentBatchTotals,
      trackingPriorityRows,
      fitByPlayer,
      gameTypeOptions,
      seasonOptions,
      formatDateShort,
      getOptionLabel,
      pk,
    })
  }
>
  Print Coach Summary
</button>

          </div>

          <table className="table-center lineup-setter-current-plan-table" style={{ tableLayout: 'fixed' }}>
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
                <th>Game Target Outs</th>
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
                    safeActivePlayers.map((p) => p.id),
                    Number(game.innings || 6),
                    activePlayerIdList
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
                      {Object.values(lineup?.gameSitOutTargets || {})
                        .filter((v) => v !== '' && v !== null && v !== undefined)
                        .reduce((sum, v) => sum + Number(v || 0), 0)}
                    </td>
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
                <td colSpan="11">No games in current plan.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LineupSetterErrorBoundary>
      <LineupFocusPanel
        optimizerFocusGame={optimizerFocusGame}
        optimizerFocusLineup={optimizerFocusLineup}
        optimizerFocusLocked={optimizerFocusLocked}
        selectedOptimizerProfile={selectedOptimizerProfile}
        optimizerModeDescription={optimizerModeDescription}
        optimizerImportSourceGameId={optimizerImportSourceGameId}
        setOptimizerImportSourceGameId={setOptimizerImportSourceGameId}
        optimizerImportableGames={optimizerImportableGames}
        importLineupToPreview={importLineupToPreview}
        toggleLineupLocked={toggleLineupLocked}
        runOptimizeCurrent={runOptimizeCurrent}
        runOptimizeAll={runOptimizeAll}
        clearPreviewLineup={clearPreviewLineup}
        optimizerBatchGames={optimizerBatchGames}
        activePlayers={safeActivePlayers}
        activePlayerIds={activePlayerIdList}
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
        updatePreviewGameSitOutTarget={updatePreviewGameSitOutTarget}
        togglePreviewBattingLock={togglePreviewBattingLock}
        togglePreviewAllBattingLock={togglePreviewAllBattingLock}
        togglePreviewCellLock={togglePreviewCellLock}
        togglePreviewRowLock={togglePreviewRowLock}
        togglePreviewInningLock={togglePreviewInningLock}
        gameTypeOptions={gameTypeOptions}
        seasonOptions={seasonOptions}
        optimizerMode={optimizerMode}
        setOptimizerMode={setOptimizerMode}
        optimizerProfiles={optimizerProfiles}
        optimizerProfileRules={optimizerProfileRules}
        trackingPriorityByPositionRows={trackingPriorityByPositionRows}
        currentBatchTotals={currentBatchTotals}
        optimizerPlanSitOutTargets={optimizerPlanSitOutTargets}
            />
</LineupSetterErrorBoundary>

      <TrackingFilters
  trackingFilters={trackingFilters}
  setTrackingFilters={setTrackingFilters}
  seasonOptions={seasonOptions}
  gameTypeOptions={gameTypeOptions}
  statusOptions={statusOptions}
/>

            <div className="card">
  <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
  <div>
    <h3 style={{ marginTop: 0, marginBottom: 4 }}>Tracking View</h3>
    <div className="small-note">
      Use this data universe for the table below and priority tracking.
    </div>
  </div>
</div>

  <label>Use this data universe for the table below and priority tracking</label>
  <select
    value={lineupSetterUniverse}
    onChange={(e) => setLineupSetterUniverse(e.target.value)}
  >
    <option value="currentPlan">Current Plan</option>
    <option value="filtered">Filtered Games Before Current Plan</option>
    <option value="filteredPlusPlan">Filtered Games + Current Plan</option>
  </select>
</div>

{TrackingTable ? (
<TrackingTable
  title={selectedUniverseTitle}
  totals={selectedUniverseTotals}
  sitOutRows={selectedUniverseSitOutRows}
  players={safeActivePlayers}
  sortConfig={trackingSort}
  setSortConfig={setTrackingSort}
  sitOutTargets={optimizerPlanSitOutTargets}
  showSitOutTargets={lineupSetterUniverse === 'currentPlan'}
  editableSitOutTargets={lineupSetterUniverse === 'currentPlan'}
  setSitOutTargets={setOptimizerPlanSitOutTargets}
  fitByPlayer={fitByPlayer}
  enableFitColors={true}
  forceNotAllowedRed={true}
  planSitOutSummary={
    lineupSetterUniverse === 'currentPlan'
      ? {
          totalNeeded,
          totalAssigned,
        }
      : null
  }
  runningTotalLabel={`${selectedUniverseTitle} Sit Out Running Total`}
  extraRunningTotals={
    lineupSetterUniverse === 'currentPlan'
      ? [
          {
            key: 'filteredSitOutRunningTotal',
            label: 'Filtered Sit Out Running Total',
            totals: filteredGamesBeforeTotalsWithRunning,
          },
          {
            key: 'updatedSitOutRunningTotal',
            label: 'Updated Sit Out Running Total',
            totals: filteredPlusPlanTotalsWithRunning,
          },
        ]
      : []
  }/>
) : (
  <div className="card">Tracking table could not load.</div>
)}
      
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
                    {row.fieldTotal}
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
