import { GAME_TYPES } from './lineupUtils'

export function dbReady(supabase) {
  return Boolean(supabase)
}

export function buildDefaultOption(label, category, sortOrder = 999) {
  return {
    id: `${category}-${label}`,
    category,
    label,
    value: label,
    sort_order: sortOrder,
    is_active: true,
  }
}

export function buildSeasonOptions(appOptions) {
  const saved = (appOptions?.season || []).filter((x) => x.is_active)
  if (saved.length) return saved

  return [
    buildDefaultOption('Fall', 'season', 1),
    buildDefaultOption('Winter', 'season', 2),
    buildDefaultOption('Spring', 'season', 3),
  ]
}

export function buildGameTypeOptions(appOptions) {
  const saved = (appOptions?.game_type || []).filter((x) => x.is_active)
  if (saved.length) return saved

  return (GAME_TYPES || []).map((label, idx) =>
    buildDefaultOption(label, 'game_type', idx + 1)
  )
}

export function buildStatusOptions(appOptions) {
  const saved = (appOptions?.status || []).filter((x) => x.is_active)
  if (saved.length) return saved

  return [
    buildDefaultOption('Planned', 'status', 1),
    buildDefaultOption('Complete', 'status', 2),
    buildDefaultOption('Cancelled', 'status', 3),
  ]
}

export function getDefaultOption(options) {
  return (options || []).find((x) => x.is_default) || null
}

export function getOptionValue(option, fallback = '') {
  return option?.value || option?.label || fallback
}
