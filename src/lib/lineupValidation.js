// src/lib/lineupValidation.js

import { FIELD_POSITIONS } from './lineupConstants'
import { pk } from './lineupCore'
import {
  fitTier,
  fitAllowedByRule,
  getPositionRule,
  normalizeFit,
  positionCountsForInning,
} from './optimizerFits'

export function inningStatus(lineup, inning, players, fitMap, optimizerProfileRules = {}) {
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)
  const counts = positionCountsForInning(lineup, inning, availableIds)

  const missing = FIELD_POSITIONS.filter((pos) => counts[pos].length === 0)
  const duplicate = FIELD_POSITIONS.filter((pos) => counts[pos].length > 1)

  const badFits = []
  availableIds.forEach((id) => {
    const value = lineup?.cells?.[id]?.[inning] || ''
    if (!FIELD_POSITIONS.includes(value)) return

    const rule = getPositionRule(optimizerProfileRules, value)
    const tier = normalizeFit(fitTier(fitMap, id, value))

    if (!fitAllowedByRule(rule, tier)) {
      const player = (players || []).find((p) => pk(p.id) === id)
      badFits.push(`${player?.name || id} @ ${value}`)
    }
  })

  return { missing, duplicate, badFits }
}

export function validateLineup({ lineup, players, fitMap, optimizerProfileRules = {} }) {
  const issues = []
  const availableIds = (lineup?.availablePlayerIds || []).map(pk)
  const innings = Number(lineup?.innings || 0)

  for (let inning = 1; inning <= innings; inning += 1) {
    const positionCounts = {}
    FIELD_POSITIONS.forEach((pos) => {
      positionCounts[pos] = []
    })

    let outCount = 0

    availableIds.forEach((id) => {
      const value = lineup?.cells?.[id]?.[inning] || ''
      const player = (players || []).find((p) => pk(p.id) === id)
      const playerName = player?.name || id

      if (value === 'Out') {
        outCount += 1
        return
      }

      if (!FIELD_POSITIONS.includes(value)) return

      positionCounts[value].push(playerName)

      const rule = getPositionRule(optimizerProfileRules, value)
      const fit = normalizeFit(fitTier(fitMap, id, value))

      if (!fitAllowedByRule(rule, fit)) {
        issues.push({
          inning,
          type: 'bad_fit',
          message: `Inning ${inning}: ${playerName} is not allowed at ${value}.`,
        })
      }
    })

    FIELD_POSITIONS.forEach((position) => {
      const playersAtPosition = positionCounts[position] || []

      if (playersAtPosition.length === 0) {
        issues.push({
          inning,
          type: 'missing_position',
          message: `Inning ${inning}: missing ${position}.`,
        })
      }

      if (playersAtPosition.length > 1) {
        issues.push({
          inning,
          type: 'duplicate_position',
          message: `Inning ${inning}: duplicate ${position} (${playersAtPosition.join(', ')}).`,
        })
      }
    })

    const eligibleCount = availableIds.filter(
      (id) => (lineup?.cells?.[id]?.[inning] || '') !== 'Injury'
    ).length

    const expectedOuts = Math.max(0, eligibleCount - 9)

    if (outCount !== expectedOuts) {
      issues.push({
        inning,
        type: 'wrong_out_count',
        message: `Inning ${inning}: expected ${expectedOuts} sit-out${expectedOuts === 1 ? '' : 's'}, found ${outCount}.`,
      })
    }
  }

  return issues
}
