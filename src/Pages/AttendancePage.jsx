import VerticalHeader from '../Components/VerticalHeader'
import { pk } from '../lib/lineupUtils'

export default function AttendancePage({
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
  addAttendanceEvent,
  ATTENDANCE_SEASON_OPTIONS,
  ATTENDANCE_TYPE_OPTIONS,
  ATTENDANCE_SURFACE_OPTIONS,
  activePlayers,
  filteredAttendanceEvents,
  updateAttendanceEventField,
  attendanceByEvent,
  toggleAttendance,
  deleteAttendanceEvent,
  attendanceTotals,
  attendanceBreakdownByPlayer,
}) {
  return (
    <div className="stack">
      <div className="card">
        <h2>Attendance Tracker</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr 1fr auto',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <div>
            <label>Date</label>
            <input
              type="date"
              value={attendanceDate}
              onChange={(e) => setAttendanceDate(e.target.value)}
            />
          </div>

          <div>
            <label>Season</label>
            <select
              value={attendanceSeason}
              onChange={(e) => setAttendanceSeason(e.target.value)}
            >
              {ATTENDANCE_SEASON_OPTIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Practice Type</label>
            <select
              value={attendanceType}
              onChange={(e) => setAttendanceType(e.target.value)}
            >
              {ATTENDANCE_TYPE_OPTIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <label>Surface</label>
            <select
              value={attendanceSurface}
              onChange={(e) => setAttendanceSurface(e.target.value)}
            >
              {ATTENDANCE_SURFACE_OPTIONS.map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>

          <div>
            <button onClick={addAttendanceEvent}>Add Event</button>
          </div>
        </div>

        <div style={{ marginTop: 12, maxWidth: 420 }}>
          <label>Title</label>
          <input
            value={attendanceTitle}
            onChange={(e) => setAttendanceTitle(e.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <h3>Attendance by Event</h3>

          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Season</th>
                <th>Type</th>
                <th>Surface</th>
                <th style={{ minWidth: 160 }}>Title</th>

                {activePlayers.map((player) => (
                  <VerticalHeader
                    key={player.id}
                    bottom={player.name}
                    minWidth={34}
                    height={145}
                  />
                ))}

                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {filteredAttendanceEvents.map((event) => (
                <tr key={event.id}>
                  <td style={{ minWidth: 140 }}>
                    <input
                      type="date"
                      value={event.event_date || ''}
                      onChange={(e) =>
                        updateAttendanceEventField(
                          event.id,
                          'event_date',
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td style={{ minWidth: 120 }}>
                    <select
                      value={
                        event.season_bucket || ATTENDANCE_SEASON_OPTIONS[0]
                      }
                      onChange={(e) =>
                        updateAttendanceEventField(
                          event.id,
                          'season_bucket',
                          e.target.value
                        )
                      }
                    >
                      {ATTENDANCE_SEASON_OPTIONS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>

                  <td style={{ minWidth: 150 }}>
                    <select
                      value={event.event_type || ATTENDANCE_TYPE_OPTIONS[0]}
                      onChange={(e) =>
                        updateAttendanceEventField(
                          event.id,
                          'event_type',
                          e.target.value
                        )
                      }
                    >
                      {ATTENDANCE_TYPE_OPTIONS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>

                  <td style={{ minWidth: 120 }}>
                    <select
                      value={event.surface || ATTENDANCE_SURFACE_OPTIONS[0]}
                      onChange={(e) =>
                        updateAttendanceEventField(
                          event.id,
                          'surface',
                          e.target.value
                        )
                      }
                    >
                      {ATTENDANCE_SURFACE_OPTIONS.map((x) => (
                        <option key={x}>{x}</option>
                      ))}
                    </select>
                  </td>

                  <td style={{ minWidth: 160 }}>
                    <input
                      value={event.title || ''}
                      onChange={(e) =>
                        updateAttendanceEventField(
                          event.id,
                          'title',
                          e.target.value
                        )
                      }
                    />
                  </td>

                  {activePlayers.map((player) => (
                    <td key={player.id}>
                      <input
                        type="checkbox"
                        checked={
                          attendanceByEvent[pk(event.id)]?.[pk(player.id)] ===
                          true
                        }
                        onChange={(e) =>
                          toggleAttendance(
                            event.id,
                            player.id,
                            e.target.checked
                          )
                        }
                      />
                    </td>
                  ))}

                  <td>
                    <button onClick={() => deleteAttendanceEvent(event.id)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <h3>Attendance Participation Breakdown</h3>

          <table className="table-center" style={{ tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th className="player-col">Player</th>
                <th>
                  In Season
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Total: {attendanceTotals.inSeason}
                  </span>
                </th>
                <th>
                  Out of Season
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Total: {attendanceTotals.outSeason}
                  </span>
                </th>
                <th>
                  P/C
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Total: {attendanceTotals.pitchersCatchers}
                  </span>
                </th>
                <th>
                  Team Practice
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Total: {attendanceTotals.teamPractice}
                  </span>
                </th>
                <th>
                  Indoor
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Total: {attendanceTotals.indoor}
                  </span>
                </th>
                <th>
                  Outdoor
                  <br />
                  <span style={{ fontSize: 12 }}>
                    Total: {attendanceTotals.outdoor}
                  </span>
                </th>
              </tr>
            </thead>

            <tbody>
              {attendanceBreakdownByPlayer.map((row) => (
                <tr key={row.playerId}>
                  <td className="player-col">{row.name}</td>
                  <td>{row.inSeason}</td>
                  <td>{row.outSeason}</td>
                  <td>{row.pitchersCatchers}</td>
                  <td>{row.teamPractice}</td>
                  <td>{row.indoor}</td>
                  <td>{row.outdoor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
