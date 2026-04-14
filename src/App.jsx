import { useEffect, useMemo, useState } from 'react'
import { supabase } from './lib/supabase'

const TEAM_ID = 'f76ea5a1-7c44-4789-bfbd-9771edd54f10'

const FIELD_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']
const GRID_OPTIONS = ['', 'P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'Out', 'Injury']

const PRIORITY_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']
const ALLOWED_POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

const DEFAULT_PLAYER_ROWS = [
  { name: 'Alanna', jersey_number: '25', active: true },
  { name: 'Maggie', jersey_number: '00', active: true },
  { name: 'Brooke', jersey_number: '13', active: true },
  { name: 'Emily', jersey_number: '4', active: true },
  { name: 'Josie', jersey_number: '7', active: true },
  { name: 'Lucie', jersey_number: '22', active: true },
  { name: 'Delaney', jersey_number: '9', active: true },
  { name: 'Bella', jersey_number: '12', active: true },
  { name: 'Bridget', jersey_number: '28', active: true },
  { name: 'Elena', jersey_number: '10', active: true },
  { name: 'Lilly', jersey_number: '14', active: true },
  { name: 'Molly', jersey_number: '15', active: true },
  { name: 'Sub 1', jersey_number: 'S1', active: false },
  { name: 'Sub 2', jersey_number: 'S2', active: false },
  { name: 'Sub 3', jersey_number: 'S3', active: false },
]

const DEFAULT_DEPTH = {
  P: ['Emily', 'Josie', 'Molly'],
  C: ['Lucie', 'Bella', 'Molly'],
  '1B': ['Alanna', 'Brooke', 'Molly'],
  '2B': ['Bridget', 'Delaney', 'Emily'],
  '3B': ['Bella', 'Lucie', 'Maggie'],
  SS: ['Elena', 'Maggie', 'Lilly'],
  LF: ['Lilly', 'Emily', 'Bella'],
  CF: ['Brooke', 'Bella', 'Lilly'],
  RF: ['Molly', 'Alanna', 'Bridget'],
}

function dbReady() {
  return Boolean(supabase)
}

function playerKey(id) {
  return String(id)
}

function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function sortRows(rows, sortConfig) {
  if (!sortConfig?.key) return rows
  const factor = sortConfig.direction === 'desc' ? -1 : 1

  return [...rows].sort((a, b) => {
    const av = a[sortConfig.key]
    const bv = b[sortConfig.key]

    const an = Number(av)
    const bn = Number(bv)

    const aIsNum = !Number.isNaN(an) && String(av ?? '').trim() !== ''
    const bIsNum = !Number.isNaN(bn) && String(bv ?? '').trim() !== ''

    if (aIsNum && bIsNum) return (an - bn) * factor
    return String(av ?? '').localeCompare(String(bv ?? '')) * factor
  })
}

function blankLineup(playerIds, innings = 6, availablePlayerIds = playerIds) {
  const cells = {}
  const battingOrder = {}
  const lockedCells = {}
  const lockedRows = {}

  playerIds.forEach((id) => {
    const pid = playerKey(id)
    cells[pid] = {}
    battingOrder[pid] = ''
    lockedCells[pid] = {}
    lockedRows[pid] = false

    for (let inning = 1; inning <= innings; inning += 1) {
      cells[pid][inning] = ''
      lockedCells[pid][inning] = false
    }
  })

  return {
    innings,
    availablePlayerIds: availablePlayerIds.map(String),
    battingOrder,
    cells,
    lockedCells,
    lockedRows,
  }
}

function normalizeLineup(lineup, playerIds, innings = 6) {
  const working = lineup
    ? JSON.parse(JSON.stringify(lineup))
    : blankLineup(playerIds, innings, playerIds)

  working.innings = Number(working.innings || innings)
  working.availablePlayerIds = (working.availablePlayerIds || playerIds).map(String)
  working.battingOrder = working.battingOrder || {}
  working.cells = working.cells || {}
  working.lockedCells = working.lockedCells || {}
  working.lockedRows = working.lockedRows || {}

  playerIds.forEach((id) => {
    const pid = playerKey(id)
    if (!working.cells[pid]) working.cells[pid] = {}
    if (!working.lockedCells[pid]) working.lockedCells[pid] = {}
    if (working.battingOrder[pid] === undefined) working.battingOrder[pid] = ''
    if (working.lockedRows[pid] === undefined) working.lockedRows[pid] = false

    for (let inning = 1; inning <= working.innings; inning += 1) {
      if (working.cells[pid][inning] === undefined) working.cells[pid][inning] = ''
      if (working.lockedCells[pid][inning] === undefined) working.lockedCells[pid][inning] = false
    }
  })

  return working
}

function requiredOutsForGame(playerCount, innings) {
  return Math.max(0, playerCount - 9) * innings
}

function computeRowSummary(lineup, playerId) {
  const out = { IF: 0, OF: 0, P: 0, C: 0, X: 0 }
  const row = lineup?.cells?.[playerId] || {}

  Object.values(row).forEach((value) => {
    if (['1B', '2B', '3B', 'SS'].includes(value)) out.IF += 1
    if (['LF', 'RF', 'CF'].includes(value)) out.OF += 1
    if (value === 'P') out.P += 1
    if (value === 'C') out.C += 1
    if (value === 'Out') out.X += 1
  })

  return out
}

function getPriority(prefMap, playerId, position) {
  const pid = playerKey(playerId)
  if (['LF', 'RF', 'CF'].includes(position)) {
    return Number(prefMap?.[pid]?.OF?.priority_pct || 0)
  }
  return Number(prefMap?.[pid]?.[position]?.priority_pct || 0)
}

function getFitTier(fitMap, playerId, position) {
  const pid = playerKey(playerId)

  if (['LF', 'RF'].includes(position)) {
    return fitMap?.[pid]?.[position] || fitMap?.[pid]?.OF || 'secondary'
  }

  if (position === 'CF') {
    return fitMap?.[pid]?.CF || fitMap?.[pid]?.OF || 'secondary'
  }

  return fitMap?.[pid]?.[position] || 'secondary'
}

function fitTierRank(tier) {
  if (tier === 'primary') return 0
  if (tier === 'secondary') return 1
  return 2
}

function depthScore(name, position) {
  const list = DEFAULT_DEPTH[position] || []
  const idx = list.indexOf(name)
  return idx === -1 ? 999 : idx
}

function inningPositionCounts(lineup, inning, availableIds) {
  const counts = {}
  FIELD_POSITIONS.forEach((pos) => {
    counts[pos] = []
  })

  availableIds.forEach((pid) => {
    const value = lineup?.cells?.[pid]?.[inning] || ''
    if (FIELD_POSITIONS.includes(value)) counts[value].push(pid)
  })

  return counts
}

function computeInningStatus(lineup, inning, players, fitMap) {
  const availableIds = (lineup?.availablePlayerIds || []).map(String)
  const counts = inningPositionCounts(lineup, inning, availableIds)

  const missing = FIELD_POSITIONS.filter((pos) => counts[pos].length === 0)
  const duplicate = FIELD_POSITIONS.filter((pos) => counts[pos].length > 1)

  const disallowed = []
  availableIds.forEach((pid) => {
    const value = lineup?.cells?.[pid]?.[inning] || ''
    if (!FIELD_POSITIONS.includes(value)) return
    if (getFitTier(fitMap, pid, value) === 'no') {
      const player = players.find((p) => playerKey(p.id) === pid)
      disallowed.push(`${player?.name || pid} @ ${value}`)
    }
  })

  return { missing, duplicate, disallowed }
}

function computeTotalsFromLineups(lineups, players) {
  const totals = {}

  players.forEach((player) => {
    totals[playerKey(player.id)] = {
      playerId: playerKey(player.id),
      name: player.name,
      jersey_number: player.jersey_number || '',
      P: 0,
      C: 0,
      '1B': 0,
      '2B': 0,
      '3B': 0,
      SS: 0,
      LF: 0,
      CF: 0,
      RF: 0,
      IF: 0,
      OF: 0,
      Out: 0,
      Injury: 0,
      fieldTotal: 0,
      expectedOuts: 0,
      actualOuts: 0,
      delta: 0,
    }
  })

  lineups.forEach((lineup) => {
    if (!lineup) return

    const availableIds = (lineup.availablePlayerIds || []).map(String)

    for (let inning = 1; inning <= Number(lineup.innings || 0); inning += 1) {
      const eligibleIds = availableIds.filter((pid) => {
        const value = lineup.cells?.[pid]?.[inning] || ''
        return value !== 'Injury'
      })

      const expected = eligibleIds.length ? Math.max(0, eligibleIds.length - 9) / eligibleIds.length : 0

      availableIds.forEach((pid) => {
        const row = totals[pid]
        const value = lineup.cells?.[pid]?.[inning] || ''
        if (!row) return

        if (value === 'Injury') {
          row.Injury += 1
          return
        }

        if (eligibleIds.includes(pid)) row.expectedOuts += expected
        if (value === 'Out') {
          row.Out += 1
          row.actualOuts += 1
        }

        if (FIELD_POSITIONS.includes(value)) {
          row[value] += 1
          row.fieldTotal += 1
        }

        if (['1B', '2B', '3B', 'SS'].includes(value)) row.IF += 1
        if (['LF', 'RF', 'CF'].includes(value)) row.OF += 1
      })
    }
  })

  Object.values(totals).forEach((row) => {
    row.expectedOuts = Number(row.expectedOuts.toFixed(2))
    row.delta = Number((row.actualOuts - row.expectedOuts).toFixed(2))
  })

  return totals
}

function addTotals(a, b, players) {
  const merged = {}

  players.forEach((player) => {
    const pid = playerKey(player.id)
    merged[pid] = {
      playerId: pid,
      name: player.name,
      jersey_number: player.jersey_number || '',
      P: (a[pid]?.P || 0) + (b[pid]?.P || 0),
      C: (a[pid]?.C || 0) + (b[pid]?.C || 0),
      '1B': (a[pid]?.['1B'] || 0) + (b[pid]?.['1B'] || 0),
      '2B': (a[pid]?.['2B'] || 0) + (b[pid]?.['2B'] || 0),
      '3B': (a[pid]?.['3B'] || 0) + (b[pid]?.['3B'] || 0),
      SS: (a[pid]?.SS || 0) + (b[pid]?.SS || 0),
      LF: (a[pid]?.LF || 0) + (b[pid]?.LF || 0),
      CF: (a[pid]?.CF || 0) + (b[pid]?.CF || 0),
      RF: (a[pid]?.RF || 0) + (b[pid]?.RF || 0),
      IF: (a[pid]?.IF || 0) + (b[pid]?.IF || 0),
      OF: (a[pid]?.OF || 0) + (b[pid]?.OF || 0),
      Out: (a[pid]?.Out || 0) + (b[pid]?.Out || 0),
      Injury: (a[pid]?.Injury || 0) + (b[pid]?.Injury || 0),
      fieldTotal: (a[pid]?.fieldTotal || 0) + (b[pid]?.fieldTotal || 0),
      expectedOuts: Number(((a[pid]?.expectedOuts || 0) + (b[pid]?.expectedOuts || 0)).toFixed(2)),
      actualOuts: (a[pid]?.actualOuts || 0) + (b[pid]?.actualOuts || 0),
      delta: Number(((a[pid]?.delta || 0) + (b[pid]?.delta || 0)).toFixed(2)),
    }
  })

  return merged
}

function optimizeSingleGame({ game, players, availablePlayerIds, sourceLineup, totalsBefore, priorityMap, fitMap }) {
  const lineup = normalizeLineup(sourceLineup, players.map((p) => p.id), Number(game.innings || 6))
  lineup.innings = Number(game.innings || 6)
  lineup.availablePlayerIds = availablePlayerIds.map(String)

  const rolling = JSON.parse(JSON.stringify(totalsBefore))

  players.forEach((player) => {
    const pid = playerKey(player.id)
    for (let inning = 1; inning <= lineup.innings; inning += 1) {
      const rowLocked = lineup.lockedRows?.[pid] || false
      const cellLocked = lineup.lockedCells?.[pid]?.[inning] || false
      if (!rowLocked && !cellLocked) {
        lineup.cells[pid][inning] = ''
      }
    }
  })

  for (let inning = 1; inning <= lineup.innings; inning += 1) {
    const usedPlayers = new Set()

    players.forEach((player) => {
      const pid = playerKey(player.id)
      const value = lineup.cells?.[pid]?.[inning] || ''
      const locked = lineup.lockedRows?.[pid] || lineup.lockedCells?.[pid]?.[inning] || false
      if (locked && value) usedPlayers.add(pid)
    })

    FIELD_POSITIONS.forEach((position) => {
      const alreadyAssigned = players.some((player) => {
        const pid = playerKey(player.id)
        return (lineup.cells?.[pid]?.[inning] || '') === position
      })
      if (alreadyAssigned) return

      const candidates = players
        .filter((player) => availablePlayerIds.includes(playerKey(player.id)))
        .filter((player) => !usedPlayers.has(playerKey(player.id)))
        .filter((player) => getFitTier(fitMap, player.id, position) !== 'no')
        .sort((a, b) => {
          const aId = playerKey(a.id)
          const bId = playerKey(b.id)

          const fitDiff = fitTierRank(getFitTier(fitMap, a.id, position)) - fitTierRank(getFitTier(fitMap, b.id, position))
          if (fitDiff !== 0) return fitDiff

          const aTarget = getPriority(priorityMap, a.id, position)
          const bTarget = getPriority(priorityMap, b.id, position)

          const actualPosA =
            ['LF', 'RF', 'CF'].includes(position) ? (rolling[aId]?.OF || 0) : (rolling[aId]?.[position] || 0)
          const actualPosB =
            ['LF', 'RF', 'CF'].includes(position) ? (rolling[bId]?.OF || 0) : (rolling[bId]?.[position] || 0)

          const totalA = Math.max(rolling[aId]?.fieldTotal || 0, 1)
          const totalB = Math.max(rolling[bId]?.fieldTotal || 0, 1)

          const actualPctA = (actualPosA / totalA) * 100
          const actualPctB = (actualPosB / totalB) * 100

          const gapA = aTarget - actualPctA
          const gapB = bTarget - actualPctB
          if (gapA !== gapB) return gapB - gapA

          const outDeltaA = rolling[aId]?.delta || 0
          const outDeltaB = rolling[bId]?.delta || 0
          if (outDeltaA !== outDeltaB) return outDeltaB - outDeltaA

          const depthDiff = depthScore(a.name, position) - depthScore(b.name, position)
          if (depthDiff !== 0) return depthDiff

          return String(a.name || '').localeCompare(String(b.name || ''))
        })

      const selected = candidates[0]
      if (!selected) return

      lineup.cells[playerKey(selected.id)][inning] = position
      usedPlayers.add(playerKey(selected.id))
    })

    players
      .filter((player) => availablePlayerIds.includes(playerKey(player.id)))
      .filter((player) => !usedPlayers.has(playerKey(player.id)))
      .sort((a, b) => {
        const aId = playerKey(a.id)
        const bId = playerKey(b.id)
        const deltaDiff = (rolling[bId]?.delta || 0) - (rolling[aId]?.delta || 0)
        if (deltaDiff !== 0) return deltaDiff
        return (rolling[aId]?.Out || 0) - (rolling[bId]?.Out || 0)
      })
      .forEach((player) => {
        lineup.cells[playerKey(player.id)][inning] = 'Out'
      })

    const inningTotals = computeTotalsFromLineups(
      [
        {
          innings: 1,
          availablePlayerIds,
          cells: Object.fromEntries(
            players.map((player) => [playerKey(player.id), { 1: lineup.cells[playerKey(player.id)][inning] || '' }])
          ),
        },
      ],
      players
    )

    Object.keys(rolling).forEach((pid) => {
      const src = rolling[pid]
      const add = inningTotals[pid]
      if (!src || !add) return
      src.P += add.P
      src.C += add.C
      src['1B'] += add['1B']
      src['2B'] += add['2B']
      src['3B'] += add['3B']
      src.SS += add.SS
      src.LF += add.LF
      src.CF += add.CF
      src.RF += add.RF
      src.IF += add.IF
      src.OF += add.OF
      src.Out += add.Out
      src.Injury += add.Injury
      src.fieldTotal += add.fieldTotal
      src.expectedOuts += add.expectedOuts
      src.actualOuts += add.actualOuts
      src.delta = Number((src.actualOuts - src.expectedOuts).toFixed(2))
    })
  }

  return lineup
}

function renderTrackingCard(title, totals, players, sortConfig, setSortConfig) {
  const rows = sortRows(
    players.map((player) => ({
      playerId: String(player.id),
      name: player.name,
      jersey_number: player.jersey_number || '',
      fieldTotal: totals[String(player.id)]?.fieldTotal || 0,
      Out: totals[String(player.id)]?.Out || 0,
      expectedOuts: totals[String(player.id)]?.expectedOuts || 0,
      actualOuts: totals[String(player.id)]?.actualOuts || 0,
      delta: totals[String(player.id)]?.delta || 0,
      P: totals[String(player.id)]?.P || 0,
      C: totals[String(player.id)]?.C || 0,
      '1B': totals[String(player.id)]?.['1B'] || 0,
      '2B': totals[String(player.id)]?.['2B'] || 0,
      '3B': totals[String(player.id)]?.['3B'] || 0,
      SS: totals[String(player.id)]?.SS || 0,
      LF: totals[String(player.id)]?.LF || 0,
      CF: totals[String(player.id)]?.CF || 0,
      RF: totals[String(player.id)]?.RF || 0,
      IF: totals[String(player.id)]?.IF || 0,
      OF: totals[String(player.id)]?.OF || 0,
    })),
    sortConfig
  )

  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th onClick={() => setSortConfig(nextSort(sortConfig, 'name'))}>Player</th>
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

function renderGrid({
  players,
  lineup,
  fitMap,
  showLocks,
  lockedLineup,
  onCellChange,
  onBattingChange,
  onCellLockToggle,
  onRowLockToggle,
}) {
  const sortedRows = [...players].sort((a, b) => {
    const aOrder = Number(lineup.battingOrder[String(a.id)] || 999)
    const bOrder = Number(lineup.battingOrder[String(b.id)] || 999)
    if (aOrder !== bOrder) return aOrder - bOrder
    return a.name.localeCompare(b.name)
  })

  return (
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Player</th>
          <th>BO</th>
          {showLocks && <th>Row Lock</th>}
          {Array.from({ length: lineup.innings }, (_, i) => i + 1).map((inning) => (
            <th key={inning}>{inning}</th>
          ))}
          <th>IF</th>
          <th>OF</th>
          <th>P</th>
          <th>C</th>
          <th>X</th>
        </tr>
      </thead>
      <tbody>
        {sortedRows.map((player) => {
          const pid = String(player.id)
          const summary = computeRowSummary(lineup, pid)
          const rowLocked = lineup.lockedRows?.[pid] || false

          return (
            <tr key={pid}>
              <td>{player.jersey_number || ''}</td>
              <td>{player.name}</td>
              <td>
                <input
                  type="number"
                  value={lineup.battingOrder[pid] || ''}
                  disabled={lockedLineup}
                  onChange={(e) => onBattingChange(pid, e.target.value)}
                  style={{ width: 56 }}
                />
              </td>

              {showLocks && (
                <td>
                  <label style={{ display: 'flex', gap: 4, alignItems: 'center', margin: 0, fontWeight: 400 }}>
                    <input
                      type="checkbox"
                      checked={rowLocked}
                      onChange={() => onRowLockToggle(pid)}
                      disabled={lockedLineup}
                      style={{ width: 'auto' }}
                    />
                    All
                  </label>
                </td>
              )}

              {Array.from({ length: lineup.innings }, (_, i) => i + 1).map((inning) => {
                const value = lineup.cells?.[pid]?.[inning] || ''
                const cellLocked = lineup.lockedCells?.[pid]?.[inning] || false
                const effectiveLocked = lockedLineup || rowLocked || cellLocked

                let background = value ? '#eef6ff' : 'white'

                if (FIELD_POSITIONS.includes(value)) {
                  const counts = inningPositionCounts(lineup, inning, lineup.availablePlayerIds || [])
                  if ((counts[value] || []).length > 1) {
                    background = '#fee2e2'
                  } else {
                    const tier = getFitTier(fitMap, pid, value)
                    background = tier === 'primary' ? '#dcfce7' : tier === 'secondary' ? '#fef3c7' : '#fee2e2'
                  }
                }

                return (
                  <td key={inning}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <select
                        value={value}
                        disabled={effectiveLocked}
                        onChange={(e) => onCellChange(pid, inning, e.target.value)}
                        style={{ background }}
                      >
                        {GRID_OPTIONS.map((option) => (
                          <option key={option || 'blank'} value={option}>
                            {option || '--'}
                          </option>
                        ))}
                      </select>

                      {showLocks && (
                        <label style={{ display: 'flex', gap: 4, alignItems: 'center', margin: 0, fontWeight: 400 }}>
                          <input
                            type="checkbox"
                            checked={cellLocked}
                            disabled={lockedLineup || rowLocked}
                            onChange={() => onCellLockToggle(pid, inning)}
                            style={{ width: 'auto' }}
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
