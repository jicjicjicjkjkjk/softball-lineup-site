import { useState } from 'react'

export default function PlayersPage({
  players,
  loading,
  onAddPlayer,
  onUpdatePlayer,
  onDeletePlayer,
}) {
  const [newName, setNewName] = useState('')
  const [newNumber, setNewNumber] = useState('')
  const [newActive, setNewActive] = useState(true)

  return (
    <div className="stack">
      <div className="card">
        <h2>Players</h2>
        {loading && <p>Loading...</p>}

        <div className="grid four-col">
          <div>
            <label>Name</label>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} />
          </div>
          <div>
            <label>Number</label>
            <input value={newNumber} onChange={(e) => setNewNumber(e.target.value)} />
          </div>
          <div>
            <label>Active</label>
            <select value={newActive ? 'Yes' : 'No'} onChange={(e) => setNewActive(e.target.value === 'Yes')}>
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
          <div className="align-end">
            <button
              onClick={async () => {
                await onAddPlayer({
                  name: newName,
                  jersey_number: newNumber,
                  active: newActive,
                })
                setNewName('')
                setNewNumber('')
                setNewActive(true)
              }}
            >
              Add Player
            </button>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Player</th>
              <th>#</th>
              <th>Active</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  <input
                    value={player.name}
                    onChange={(e) => onUpdatePlayer({ ...player, name: e.target.value })}
                    onBlur={(e) => onUpdatePlayer({ ...player, name: e.target.value })}
                  />
                </td>
                <td>
                  <input
                    value={player.jersey_number || ''}
                    onChange={(e) => onUpdatePlayer({ ...player, jersey_number: e.target.value })}
                    onBlur={(e) => onUpdatePlayer({ ...player, jersey_number: e.target.value })}
                  />
                </td>
                <td>
                  <select
                    value={player.active === false ? 'No' : 'Yes'}
                    onChange={(e) =>
                      onUpdatePlayer({
                        ...player,
                        active: e.target.value === 'Yes',
                      })
                    }
                  >
                    <option>Yes</option>
                    <option>No</option>
                  </select>
                </td>
                <td>
                  <button onClick={() => onDeletePlayer(player.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!players.length && !loading && (
              <tr>
                <td colSpan="4">No players yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
