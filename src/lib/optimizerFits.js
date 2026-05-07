// src/lib/optimizerFits.js

import { FIELD_POSITIONS } from './lineupConstants'
import { pk } from './lineupCore'

export function getPositionRule(profileRules, position) {
  return profileRules?.[position] || null
}

export function getRuleNumber(rule, keys, fallback) {
  for (const key of keys) {
    if (rule?.[key] !== undefined && rule?.[key] !== null && rule?.[key] !== '') {
      const n = Number(rule[key])
      return Number.isNaN(n) ? fallback : n
    }
  }
  return fallback
}

export function getRuleBool(rule, keys, fallback) {
  for (const key of keys) {
    if (rule?.[key] !== undefined && rule?.[key] !== null) {
      return rule[key] === true
    }
  }
  return fallback
}

export function positionImportance(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return getRuleNumber(rule, ['importance', 'importance_score', 'hierarchy', 'fill_importance'], 1)
}

export function positionFillRank(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return getRuleNumber(rule, ['fill_rank', 'fill_order', 'rank'], 99)
}

export function consecutiveMode(profileRules, position) {
  const rule = getPositionRule(profileRules, position)
  return rule?.consecutive_mode || 'prefer'
}

export function normalizeFit(fit) {
  const value = String(fit || '')
    .trim()
    .toLowerCase()
    .replace(/[\u2010-\u2015\u2212\uFF0D]/g, '-')
    .replace(/\s+/g, ' ')

  if (value === 'a' || value === 'primary') return 'primary'
  if (
    value === 'b' ||
    value === 'c' ||
    value === 'nc' ||
    value === 'secondary' ||
    value === 'non-primary' ||
    value === 'non primary' ||
    value === 'non_primary' ||
    value === 'nonprimary' ||
    (value.includes('non') && value.includes('primary'))
  ) {
    return 'secondary'
  }
  if (value === 'd' || value === 'development') return 'development'
  if (value === 'e' || value === 'no' || value === 'not allowed') return 'no'

  return 'secondary'
}

export function fitAllowedByRule(rule, fit) {
  const normalized = normalizeFit(fit)

  if (normalized === 'primary') return getRuleBool(rule, ['allow_primary'], true)
  if (normalized === 'secondary') return getRuleBool(rule, ['allow_secondary', 'allow_non_primary'], true)
  if (normalized === 'development') return getRuleBool(rule, ['allow_development', 'allow_c_d'], true)
  if (normalized === 'no') return getRuleBool(rule, ['allow_disallowed', 'allow_not_allowed', 'allow_no'], false)

  return true
}

export function fitTier(fitMap, playerId, position) {
  const id = pk(playerId)

  if (position === 'LF' || position === 'RF') {
    return fitMap?.[id]?.[position] || fitMap?.[id]?.OF || 'no'
  }

  if (position === 'CF') {
    return fitMap?.[id]?.CF || fitMap?.[id]?.OF || 'no'
  }

  return fitMap?.[id]?.[position] || 'no'
}

export function priorityValue(priorityMap, playerId, position) {
  const id = pk(playerId)

  if (position === 'LF' || position === 'CF' || position === 'RF') {
    return Number(priorityMap?.[id]?.OF?.priority_pct || 0)
  }

  return Number(priorityMap?.[id]?.[position]?.priority_pct || 0)
}

export function positionBucket(position) {
  return ['LF', 'CF', 'RF'].includes(position) ? 'OF' : position
}

export function positionCountsForInning(lineup, inning, availableIds) {
  const counts = {}
  FIELD_POSITIONS.forEach((pos) => {
    counts[pos] = []
  })

  ;(availableIds || []).map(pk).forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (FIELD_POSITIONS.includes(value)) counts[value].push(id)
  })

  return counts
}
