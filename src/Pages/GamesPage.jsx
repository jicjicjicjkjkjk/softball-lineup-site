
import { GAME_TYPES } from '../lib/lineupUtils'

export default function GamesPage({
  loading,
  games,
  lineupsByGame,
  lineupLockedByGame,
  newGameDate,
  setNewGameDate,
  newGameOpponent,
  setNewGameOpponent,
  newGameType,
  setNewGameType,
  onAddGame,
  onReload,
  onUpdateGameField,
  onDeleteGame,
  onOpenGame,
}) {
  function statusLabel(game) {
    if (lineupLockedByGame[String(game.id)]) return 'Locked'
    if (lineupsByGame[String(game.id)]) return 'Saved'
    return 'Empty'
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between">
          <h2>Games</h2>
          <button onClick={onReload}>Reload from Database</button>
        </div>

        {loading && <p>Loading...</p>}

        <div className="grid four-col">
          <div>
            <label>Date</label>
            <input type="date" value={newGameDate} onChange={(e) => setNewGameDate(e.target.value)} />
          </div>
          <div>
            <label>Opponent</label>
            <input value={newGameOpponent} onChange={(e) => setNewGameOpponent(e.target.value)} />
          </div>
          <div>
            <label>Type</label>
            <select value={newGameType} onChange={(e) => setNewGameType(e.target.value)}>
              {GAME_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>
          <div className="align-end">
            <button onClick={onAddGame}>Add Game</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table>
          <thead>
            <tr>
              <th>Date</th>
              <th>Opponent</th>
              <th>Type</th>
              <th>Innings</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {games.map((game) => (
              <tr key={game.id}>
                <td>
                  <input
                    type="date"
                    value={game.date}
                    onChange={(e) => onUpdateGameField(game.id, 'date', e.target.value)}
                  />
                </td>
                <td>
                  <input
                    value={game.opponent}
                    onChange={(e) => onUpdateGameField(game.id, 'opponent', e.target.value)}
                  />
                </td>
                <td>
                  <select
                    value={game.game_type || 'Friendly'}
                    onChange={(e) => onUpdateGameField(game.id, 'game_type', e.target.value)}
                  >
                    {GAME_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </td>
                <td>{game.innings}</td>
                <td>{statusLabel(game)}</td>
                <td>
                  <div className="button-row">
                    <button onClick={() => onOpenGame(game.id)}>Open</button>
                    <button onClick={() => onDeleteGame(game.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
            {!games.length && !loading && (
              <tr>
                <td colSpan="6">No games yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
