export function buildAttendanceTotals(events) {
  return {
    inSeason: events.filter((e) => e.season_bucket === 'In Season').length,
    outSeason: events.filter((e) => e.season_bucket === 'Out of Season').length,
    pitchersCatchers: events.filter((e) => e.event_type === 'Pitchers/Catchers').length,
    teamPractice: events.filter((e) => e.event_type === 'Team Practice').length,
    indoor: events.filter((e) => e.surface === 'Indoor').length,
    outdoor: events.filter((e) => e.surface === 'Outdoor').length,
  }
}

export function buildAttendanceBreakdownByPlayer({
  activePlayers,
  filteredAttendanceEvents,
  attendanceByEvent,
  attendanceTotals,
  pk,
}) {
  return activePlayers.map((player) => {
    const id = pk(player.id)
    const eventRows = filteredAttendanceEvents

    function countAttended(predicate) {
      return eventRows
        .filter(predicate)
        .filter((event) => attendanceByEvent?.[pk(event.id)]?.[id] === true)
        .length
    }

    function formatValue(actual, total) {
      if (!total) return ''
      return `${actual} (${Math.round((actual / total) * 100)}%)`
    }

    const inSeasonActual = countAttended(
      (event) => event.season_bucket === 'In Season'
    )

    const outSeasonActual = countAttended(
      (event) => event.season_bucket === 'Out of Season'
    )

    const pcActual = countAttended(
      (event) => event.event_type === 'Pitchers/Catchers'
    )

    const teamActual = countAttended(
      (event) => event.event_type === 'Team Practice'
    )

    const indoorActual = countAttended(
      (event) => event.surface === 'Indoor'
    )

    const outdoorActual = countAttended(
      (event) => event.surface === 'Outdoor'
    )

    return {
      playerId: id,
      name: player.name,
      inSeason: formatValue(inSeasonActual, attendanceTotals.inSeason),
      outSeason: formatValue(outSeasonActual, attendanceTotals.outSeason),
      pitchersCatchers: formatValue(
        pcActual,
        attendanceTotals.pitchersCatchers
      ),
      teamPractice: formatValue(
        teamActual,
        attendanceTotals.teamPractice
      ),
      indoor: formatValue(indoorActual, attendanceTotals.indoor),
      outdoor: formatValue(outdoorActual, attendanceTotals.outdoor),
    }
  })
}
