export default function PlayersPage({
  newPlayerName,
  setNewPlayerName,
  newPlayerNumber,
  setNewPlayerNumber,
  newPlayerActive,
  setNewPlayerActive,
  addPlayer,
  sortedPlayers,
  playerSort,
  setPlayerSort,
  nextSort,
  updatePlayerLocal,
  upsertPlayer,
  deletePlayer,
}) {
  return (
    <div className="stack">
      <div className="card">
        <h2>Players</h2>
        <div className="grid four-col compact-grid">
          <div>
            <label>Name</label>
            <input value={newPlayerName} onChange={(e) => setNewPlayerName(e.target.value)} />
          </div>
          <div>
            <label>Number</label>
            <input value={newPlayerNumber} onChange={(e) => setNewPlayerNumber(e.target.value)} />
          </div>
          <div>
            <label>Active</label>
            <select
              value={newPlayerActive ? 'Yes' : 'No'}
              onChange={(e) => setNewPlayerActive(e.target.value === 'Yes')}
            >
              <option>Yes</option>
              <option>No</option>
            </select>
          </div>
          <div className="align-end">
            <button onClick={addPlayer}>Add Player</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="table-scroll">
          <table className="games-table">
            <thead>
              <tr>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'name'))}>Player</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'jersey_number'))}>#</th>
                <th onClick={() => setPlayerSort(nextSort(playerSort, 'activeText'))}>Active</th>
                <th>Delete</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player) => (
                <tr key={player.id}>
                  <td>
                    <input
                      value={player.name}
                      onChange={(e) => updatePlayerLocal(player.id, 'name', e.target.value)}
                      onBlur={() => upsertPlayer(player)}
                    />
                  </td>
                  <td>
                    <input
                      value={player.jersey_number || ''}
                      onChange={(e) => updatePlayerLocal(player.id, 'jersey_number', e.target.value)}
                      onBlur={() => upsertPlayer(player)}
                    />
                  </td>
                  <td>
                    <select
                      value={player.active === false ? 'No' : 'Yes'}
                      onChange={(e) => {
                        const value = e.target.value === 'Yes'
                        updatePlayerLocal(player.id, 'active', value)
                        upsertPlayer({ ...player, active: value })
                      }}
                    >
                      <option>Yes</option>
                      <option>No</option>
                    </select>
                  </td>
                  <td>
                    <button onClick={() => deletePlayer(player.id)}>Delete</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
