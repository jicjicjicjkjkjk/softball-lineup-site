import React from 'react'

export default function TrackingFilters({
  trackingFilters,
  setTrackingFilters,
  seasonOptions = [],
  gameTypeOptions = [],
  statusOptions = [],
}) {
  return (
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

        {/* Game Status */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Game Status</div>
          <select
            multiple
            value={trackingFilters.gameStatuses || []}
            onChange={(e) =>
              setTrackingFilters((f) => ({
                ...f,
                gameStatuses: Array.from(e.target.selectedOptions, (o) => o.value),
              }))
            }
          >
            {statusOptions.map((opt) => (
              <option key={opt.value || opt.label} value={opt.value || opt.label}>
                {opt.label || opt.value}
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

        {/* Clear */}
        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button
            type="button"
            onClick={() =>
              setTrackingFilters({
                seasons: [],
                gameTypes: [],
                gameStatuses: [],
                lineupStates: ['Locked'],
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
  )
}
