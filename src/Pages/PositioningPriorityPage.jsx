import { PRIORITY_POSITIONS, ALLOWED_POSITIONS } from '../lib/lineupUtils'

export default function PositioningPriorityPage({
  activePlayers,
  priorityByPlayer,
  fitByPlayer,
  onPriorityLocal,
  onPrioritySave,
  onFitLocal,
  onFitSave,
}) {
  function subtotal(playerId) {
    const row = priorityByPlayer[String(playerId)] || {}
    return PRIORITY_POSITIONS.reduce((sum, pos) => sum + Number(row[pos]?.priority_pct || 0), 0)
  }

  function footer(position) {
    return activePlayers.reduce(
      (sum, player) => sum + Number(priorityByPlayer[String(player.id)]?.[position]?.priority_pct || 0),
      0
    )
  }

  return (
    <div className="stack">
      <div className="card" style={{ overflowX: 'auto' }}>
        <h2>Positioning Priority</h2>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>#</th>
              {PRIORITY_POSITIONS.map((position) => (
                <th key={position}>{position}</th>
              ))}
              <th>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>{player.jersey_number || ''}</td>
                {PRIORITY_POSITIONS.map((position) => (
                  <td key={position}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={priorityByPlayer[String(player.id)]?.[position]?.priority_pct || ''}
                      onChange={(e) => onPriorityLocal(player.id, position, e.target.value)}
                      onBlur={(e) => onPrioritySave(player.id, position, e.target.value)}
                    />
                  </td>
                ))}
                <td>{subtotal(player.id)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <th colSpan="2">Subtotal</th>
              {PRIORITY_POSITIONS.map((position) => (
                <th key={position}>{footer(position)}</th>
              ))}
              <th>{PRIORITY_POSITIONS.reduce((sum, pos) => sum + footer(pos), 0)}</th>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <h3>Allowed Positions</h3>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>#</th>
              {ALLOWED_POSITIONS.map((position) => (
                <th key={position}>{position}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((player) => (
              <tr key={player.id}>
                <td>{player.name}</td>
                <td>{player.jersey_number || ''}</td>
                {ALLOWED_POSITIONS.map((position) => {
                  const tier = fitByPlayer[String(player.id)]?.[position] || 'secondary'
                  const background =
                    tier === 'primary'
                      ? '#dcfce7'
                      : tier === 'secondary'
                      ? '#fef3c7'
                      : '#fee2e2'

                  return (
                    <td key={position}>
                      <select
                        value={tier}
                        style={{ background }}
                        onChange={(e) => {
                          onFitLocal(player.id, position, e.target.value)
                          onFitSave(player.id, position, e.target.value)
                        }}
                      >
                        <option value="primary">Primary</option>
                        <option value="secondary">Non-Primary</option>
                        <option value="no">No</option>
                      </select>
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
