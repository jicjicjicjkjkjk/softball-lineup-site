import { useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { GAME_TYPES } from '../lib/lineupUtils'

function buildDefaultOption(label, category, sortOrder = 999) {
  return {
    id: `${category}-${label}`,
    category,
    label,
    value: label,
    sort_order: sortOrder,
    is_active: true,
  }
}

export function useAppOptions({ appOptions, setAppOptions, setAppError }) {
  async function loadAppOptions() {
    const res = await supabase
      .from('app_options')
      .select('id, category, value, label, sort_order, is_active, is_default')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    const next = { season: [], game_type: [], status: [] }

    ;(res.data || []).forEach((row) => {
      if (!next[row.category]) next[row.category] = []
      next[row.category].push(row)
    })

    setAppOptions(next)
  }

  async function addAppOption(option) {
    const res = await supabase.from('app_options').insert(option)

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    await loadAppOptions()
  }

  async function updateAppOption(id, updates) {
    const res = await supabase.from('app_options').update(updates).eq('id', id)

    if (res.error) {
      setAppError(res.error.message)
      return
    }

    await loadAppOptions()
  }

  const seasonOptions = useMemo(() => {
    const saved = (appOptions.season || []).filter((x) => x.is_active)
    if (saved.length) return saved

    return [
      buildDefaultOption('Fall', 'season', 1),
      buildDefaultOption('Winter', 'season', 2),
      buildDefaultOption('Spring', 'season', 3),
    ]
  }, [appOptions])

  const gameTypeOptions = useMemo(() => {
    const saved = (appOptions.game_type || []).filter((x) => x.is_active)
    if (saved.length) return saved

    return (GAME_TYPES || []).map((label, idx) =>
      buildDefaultOption(label, 'game_type', idx + 1)
    )
  }, [appOptions])

  const statusOptions = useMemo(() => {
    const saved = (appOptions.status || []).filter((x) => x.is_active)
    if (saved.length) return saved

    return [
      buildDefaultOption('Planned', 'status', 1),
      buildDefaultOption('Complete', 'status', 2),
      buildDefaultOption('Cancelled', 'status', 3),
    ]
  }, [appOptions])

  const defaultSeasonOption = useMemo(
    () => (seasonOptions || []).find((x) => x.is_default),
    [seasonOptions]
  )

  const defaultGameTypeOption = useMemo(
    () => (gameTypeOptions || []).find((x) => x.is_default),
    [gameTypeOptions]
  )

  const defaultStatusOption = useMemo(
    () => (statusOptions || []).find((x) => x.is_default),
    [statusOptions]
  )

  return {
    loadAppOptions,
    addAppOption,
    updateAppOption,
    seasonOptions,
    gameTypeOptions,
    statusOptions,
    defaultSeasonOption,
    defaultGameTypeOption,
    defaultStatusOption,
  }
}
