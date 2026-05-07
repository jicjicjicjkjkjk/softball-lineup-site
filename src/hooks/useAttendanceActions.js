import { supabase } from '../lib/supabase'
import { pk } from '../lib/lineupUtils'
import {
  TEAM_ID,
  ATTENDANCE_SEASON_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
  ATTENDANCE_SURFACE_OPTIONS,
} from '../lib/constants'

export function useAttendanceActions({
  setAppError,
  activePlayers,
  setAttendanceEvents,
  setAttendanceByEvent,
  attendanceDate,
  setAttendanceDate,
  attendanceSeason,
  setAttendanceSeason,
  attendanceType,
  setAttendanceType,
  attendanceSurface,
  setAttendanceSurface,
  attendanceTitle,
  setAttendanceTitle,
}) {
  async function addAttendanceEvent() {
    const res = await supabase
      .from('attendance_events')
      .insert({
        team_id: TEAM_ID,
        event_date: attendanceDate || null,
        season_bucket: attendanceSeason,
        event_type: attendanceType,
        surface: attendanceSurface,
        title: attendanceTitle || null,
      })
      .select()
      .single()

    if (res.error) return setAppError(res.error.message)

    const newEvent = res.data

    setAttendanceEvents((current) =>
      [...current, newEvent].sort((a, b) =>
        `${a.event_date || ''}`.localeCompare(`${b.event_date || ''}`)
      )
    )

    const recRes = await supabase.from('attendance_records').upsert(
      activePlayers.map((player) => ({
        event_id: newEvent.id,
        player_id: player.id,
        attended: false,
      })),
      { onConflict: 'event_id,player_id' }
    )

    if (recRes.error) return setAppError(recRes.error.message)

    setAttendanceByEvent((current) => ({
      ...current,
      [pk(newEvent.id)]: Object.fromEntries(activePlayers.map((p) => [pk(p.id), false])),
    }))

    setAttendanceDate('')
    setAttendanceSeason(ATTENDANCE_SEASON_OPTIONS[0])
    setAttendanceType(ATTENDANCE_TYPE_OPTIONS[0])
    setAttendanceSurface(ATTENDANCE_SURFACE_OPTIONS[0])
    setAttendanceTitle('')
  }

  async function toggleAttendance(eventId, playerId, checked) {
    setAttendanceByEvent((current) => ({
      ...current,
      [pk(eventId)]: {
        ...(current[pk(eventId)] || {}),
        [pk(playerId)]: checked,
      },
    }))

    const res = await supabase.from('attendance_records').upsert(
      {
        event_id: eventId,
        player_id: playerId,
        attended: checked,
      },
      { onConflict: 'event_id,player_id' }
    )

    if (res.error) setAppError(res.error.message)
  }

  async function updateAttendanceEventField(eventId, field, value) {
    setAttendanceEvents((current) =>
      current.map((event) => (pk(event.id) === pk(eventId) ? { ...event, [field]: value } : event))
    )

    const updates = {}
    if (field === 'event_date') updates.event_date = value || null
    if (field === 'season_bucket') updates.season_bucket = value
    if (field === 'event_type') updates.event_type = value
    if (field === 'surface') updates.surface = value
    if (field === 'title') updates.title = value || null

    const res = await supabase.from('attendance_events').update(updates).eq('id', eventId)
    if (res.error) setAppError(res.error.message)
  }

  async function deleteAttendanceEvent(eventId) {
    if (!window.confirm('Delete this attendance event?')) return

    const recDel = await supabase.from('attendance_records').delete().eq('event_id', eventId)
    if (recDel.error) return setAppError(recDel.error.message)

    const eventDel = await supabase.from('attendance_events').delete().eq('id', eventId)
    if (eventDel.error) return setAppError(eventDel.error.message)

    setAttendanceEvents((current) => current.filter((event) => pk(event.id) !== pk(eventId)))

    setAttendanceByEvent((current) => {
      const next = { ...current }
      delete next[pk(eventId)]
      return next
    })
  }

  return {
    addAttendanceEvent,
    toggleAttendance,
    updateAttendanceEventField,
    deleteAttendanceEvent,
  }
}
