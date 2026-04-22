import {
  FIELD_POSITIONS,
  GRID_OPTIONS,
  pk,
  rowSummary,
  fitTier,
  inningStatus,
} from '../lib/lineupUtils'
import MiniDiamond from './MiniDiamond'

export default function LineupGrid({
  players,
  lineup,
  fitMap,
  showLocks,
  lockedLineup,
  visiblePlayerIds,
  onRemoveInning,
  onCellChange,
  onBattingChange,
  onCellLockToggle,
  onRowLockToggle,
  onInningLockToggle,
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
          <th className="player-col">Player</th>
          <th>Batting Order</th>
          {showLocks && <th>Lock</th>}

          {Array.from({ length: Number(lineup?.innings || 0) }, (_, i) => i + 1).map((inning) => {
  const status = inningStatus(lineup, inning, players, fitMap)

  const inningLocked =
    sortedRows.length > 0 &&
    sortedRows.every((player) => {
      const id = pk(player.id)
      return lineup?.lockedCells?.[id]?.[inning] === true
    })

  function handleInningLockToggle() {
    if (lockedLineup) return

    const shouldLock = !inningLocked

    sortedRows.forEach((player) => {
      const id = pk(player.id)
      if (!lineup.lockedCells[id]) lineup.lockedCells[id] = {}
      lineup.lockedCells[id][inning] = shouldLock
    })

    onInningLockToggle?.(inning)
  }

  return (
    <th key={inning}>
      <div

  style={{

    display: 'grid',

    gap: 4,

    justifyItems: 'center',

    paddingBottom: 4,

  }}

>
        
        {/* REMOVE BUTTON (above inning) */}
        <button
  style={{
    fontSize: 10,
    padding: '2px 6px',
    lineHeight: 1,
    background: '#fee2e2',
    border: '1px solid #fca5a5',
    borderRadius: 4,
    cursor: 'pointer',
  }}
          disabled={lockedLineup}
          onClick={(e) => {
            e.stopPropagation()
            // handled in parent (already wired)
            document.querySelector(`[data-remove-inning="${inning}"]`)?.click()
          }}
        >
          ✕
        </button>

        <MiniDiamond status={status} inning={inning} lineup={lineup} players={players} />

        {showLocks && (
          <label className="checkbox-item" style={{ margin: 0, fontSize: 11 }}>
            <input
  type="checkbox"
  checked={inningLocked}
  disabled={lockedLineup}
  onChange={() => onInningLockToggle?.(inning)}
/>
            Inning
          </label>
        )}

        <div style={{ fontSize: 12 }}>{inning}</div>
      </div>
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
            <tr
  key={id}
  style={{
    opacity: rowLocked ? 0.6 : 1,
    background: rowLocked ? '#f8fafc' : 'white',
  }}
>
              <td>{player.jersey_number || ''}</td>
              <td>{player.name}</td>

              <td>
                <input
                  type="number"
                  value={lineup?.battingOrder?.[id] || ''}
                  disabled={lockedLineup}
                  onChange={(e) => onBattingChange(id, e.target.value)}
                  style={{
  width: 48,
  height: 28,
  textAlign: 'center',
  fontSize: 12,
}}
                />
              </td>

              {showLocks && (
                <td>
                  <label className="checkbox-item" style={{ margin: 0, fontSize: 10 }}>
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
  const status = inningStatus(lineup, inning, players, fitMap)

  const inningLocked =
    sortedRows.length > 0 &&
    sortedRows.every((player) => {
      const id = pk(player.id)
      return lineup?.lockedInnings?.[inning]?.includes?.(id) || false
    })

  return (
    <th key={inning}>
      <div style={{ display: 'grid', gap: 6, justifyItems: 'center' }}>
        {onRemoveInning ? (
          <button
            type="button"
            onClick={() => onRemoveInning(inning)}
            disabled={lockedLineup}
            style={{
              border: '1px solid #e5b4b4',
              background: '#fbe4e4',
              color: '#b42318',
              borderRadius: 6,
              width: 26,
              height: 22,
              lineHeight: '18px',
              padding: 0,
              fontWeight: 700,
              cursor: lockedLineup ? 'not-allowed' : 'pointer',
            }}
            title={`Remove inning ${inning}`}
          >
            ✕
          </button>
        ) : (
          <div style={{ height: 22 }} />
        )}

        <MiniDiamond status={status} inning={inning} lineup={lineup} players={players} />

        {showLocks && (
          <label className="checkbox-item" style={{ margin: 0, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={inningLocked}
              disabled={lockedLineup}
              onChange={() => onInningLockToggle?.(inning)}
            />
            Inning
          </label>
        )}

        <div style={{ marginTop: 2 }}>{inning}</div>
      </div>
    </th>
  )
})}
              
              {Array.from({ length: Number(lineup?.innings || 0) }, (_, i) => i + 1).map((inning) => {
                const value = lineup?.cells?.[id]?.[inning] || ''
                const cellLocked = lineup?.lockedCells?.[id]?.[inning] === true
                const inningLocked = (lineup?.lockedInnings?.[inning] || []).includes(id)
                const effectiveLocked = lockedLineup || rowLocked || inningLocked || cellLocked

                let background = value ? '#eef6ff' : 'white'

                if (FIELD_POSITIONS.includes(value)) {
                  const status = inningStatus(lineup, inning, players, fitMap)
                  if (status.duplicate.includes(value)) {
                    background = '#fee2e2'
                  } else {
                    const tier = fitTier(fitMap, id, value)
                    background =
  tier === 'primary'
    ? '#d1fae5'   // softer green
    : tier === 'secondary'
    ? '#fef9c3'   // softer yellow
    : '#fee2e2'   // keep red
                  }
                }

                return (
                  <td key={inning}>
                    <div style={{ display: 'grid', gap: 2 }}>
                      <select
                        value={value}
                        disabled={effectiveLocked}
                        onChange={(e) => onCellChange(id, inning, e.target.value)}
                        style={{
  background,
  height: 28,
  fontSize: 12,
  padding: '2px 4px',
}}
                      >
                        {GRID_OPTIONS.map((option) => (
                          <option key={option || 'blank'} value={option}>
                            {option || '--'}
                          </option>
                        ))}
                      </select>

                      {showLocks && (
                        <label className="checkbox-item" style={{ margin: 0, fontSize: 10 }}>
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
