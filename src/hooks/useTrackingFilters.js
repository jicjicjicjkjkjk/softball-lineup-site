import { useEffect, useState } from 'react'

export const defaultTrackingFilters = {
  seasons: [],
  gameTypes: [],
  gameStatuses: [],
  lineupStates: ['Locked'],
  dateFrom: '',
  dateTo: '',
}

export function useTrackingFilters() {
  const [trackingFilters, setTrackingFilters] = useState(() => {
    try {
      const saved = sessionStorage.getItem('softball-lineup-tracking-filters')
      const parsed = saved ? JSON.parse(saved) : {}

      const savedLineupStates = Array.isArray(parsed?.lineupStates)
        ? parsed.lineupStates.filter((x) => ['Locked', 'Saved', 'Empty'].includes(x))
        : []

      return {
        ...defaultTrackingFilters,
        ...(parsed && typeof parsed === 'object' ? parsed : {}),
        seasons: Array.isArray(parsed?.seasons) ? parsed.seasons : [],
        gameTypes: Array.isArray(parsed?.gameTypes) ? parsed.gameTypes : [],
        gameStatuses: Array.isArray(parsed?.gameStatuses) ? parsed.gameStatuses : [],
        lineupStates: savedLineupStates.length
          ? savedLineupStates
          : defaultTrackingFilters.lineupStates,
      }
    } catch (error) {
      console.error('Failed to load tracking filters from sessionStorage', error)
      return defaultTrackingFilters
    }
  })

  useEffect(() => {
    try {
      sessionStorage.setItem(
        'softball-lineup-tracking-filters',
        JSON.stringify(trackingFilters)
      )
    } catch (error) {
      console.error('Failed to save tracking filters to sessionStorage', error)
    }
  }, [trackingFilters])

  useEffect(() => {
    if (
      trackingFilters.lineupStates?.length === 1 &&
      trackingFilters.lineupStates[0] === 'Locked'
    ) {
      setTrackingFilters((current) => ({
        ...current,
        lineupStates: ['Locked'],
      }))
    }
  }, [])

  return {
    trackingFilters,
    setTrackingFilters,
  }
}
