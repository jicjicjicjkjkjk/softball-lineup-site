import React from 'react'

function cleanArray(value) {
  return Array.isArray(value) ? value : []
}

export default function TrackingFilters({
  trackingFilters = {},
  setTrackingFilters,
  seasonOptions = [],
  gameTypeOptions = [],
  statusOptions = [],
}) {
  const filters = {
    seasons: cleanArray(trackingFilters.seasons),
    gameTypes: cleanArray(trackingFilters.gameTypes),
    gameStatuses: cleanArray(trackingFilters.gameStatuses),
    lineupStates: cleanArray(trackingFilters.lineupStates),
    dateFrom: trackingFilters.dateFrom || '',
    dateTo: trackingFilters.dateTo || '',
  }

  function updateFilter(key, value) {
    setTrackingFilters((current) => ({
      ...current,
      [key]: value,
    }))
  }

  function selectedValues(e) {
    return Array.from(e.target.selectedOptions, (option) => option.value)
  }

  function clearFilters() {
    setTrackingFilters({
      seasons: [],
      gameTypes: [],
      gameStatuses: [],
      lineupStates: [],
      dateFrom: '',
      dateTo: '',
    })
  }

  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Filters</h3>

      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Season</div>
          <select
            multiple
            value={filters.seasons}
            onChange={(e) => updateFilter('seasons', selectedValues(e))}
          >
            {seasonOptions.map((opt) => (
              <option key={opt.value || opt.label} value={opt.value || opt.label}>
                {opt.label || opt.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Game Type</div>
          <select
            multiple
            value={filters.gameTypes}
            onChange={(e) => updateFilter('gameTypes', selectedValues(e))}
          >
            {gameTypeOptions.map((opt) => (
              <option key={opt.value || opt.label} value={opt.value || opt.label}>
                {opt.label || opt.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Game Status</div>
          <select
            multiple
            value={filters.gameStatuses}
            onChange={(e) => updateFilter('gameStatuses', selectedValues(e))}
          >
            {statusOptions.map((opt) => (
              <option key={opt.value || opt.label} value={opt.value || opt.label}>
                {opt.label || opt.value}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Lineup State</div>
          <select
            multiple
            value={filters.lineupStates}
            onChange={(e) => updateFilter('lineupStates', selectedValues(e))}
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
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
          />
        </div>

        <div>
          <div style={{ fontSize: 12, fontWeight: 600 }}>Date To</div>
          <input
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'flex-end' }}>
          <button type="button" onClick={clearFilters}>
            Clear Filters
          </button>
        </div>
      </div>
    </div>
  )
}
