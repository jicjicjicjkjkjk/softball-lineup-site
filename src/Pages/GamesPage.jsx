import { GAME_TYPES, pk } from '../lib/lineupUtils'

function nextSort(current, key) {
  if (current.key !== key) return { key, direction: 'asc' }
  return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
}

function formatDateShort(value) {
  if (!value) return ''
  const [y, m, d] = value.split('-')
  if (!y || !m || !d) return value
  return `${m}/${d}/${y.slice(2)}`
}

export default function GamesPage({
  loadAll,
  appError,
  loading,
  newGameDate,
  setNewGameDate,
  newGameOpponent,
  setNewGameOpponent,
  newGameType,
  setNewGameType,
  addGameFromGames,
  sortedGames,
  gameSort,
  setGameSort,
  updateGameField,
  deleteGame,
  setSelectedGameId,
  setPage,
}) {
  return (
    <div className="stack">
      <div className="card">
        <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
          <h2>Games</h2>
          <button onClick={loadAll}>Refresh from Database</button>
        </div>

        {appError && <p style={{ color: '#b91c1c' }}>Error: {appError}</p>}
        {loading && <p>Loading...</p>}

        <div className="game-add-row">
          <div>
            <label>Date</label>
            <input
              type="date"
              value={newGameDate}
              onChange={(e) => setNewGameDate(e.target.value)}
            />
          </div>

          <div>
            <label>Opponent</label>
            <input
              value={newGameOpponent}
              onChange={(e) => setNewGameOpponent(e.target.value)}
            />
          </div>

          <div>
            <label>Type</label>
            <select
              value={newGameType}
              onChange={(e) => setNewGameType(e.target.value)}
            >
              {GAME_TYPES.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </div>

          <div className="align-end">
            <button onClick={addGameFromGames}>Add Game</button>
          </div>
        </div>
      </div>

      <div className="card" style={{ overflowX: 'auto' }}>
        <table className="games-table">
          <thead>
            <tr>
              <th onClick={() => setGameSort(nextSort(gameSort, 'date'))}>Date</th>
              <th
                onClick={() => setGameSort(nextSort(gameSort, 'game_order'))}
                className="order-col"
              >
                Order
              </th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'opponent'))}>Opponent</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'game_type'))}>Type</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'innings'))}>Innings</th>
              <th onClick={() => setGameSort(nextSort(gameSort, 'lineupState'))}>Status</th>
              <th style={{ minWidth: 170 }}>Actions</th>
            </tr>
          </thead>

          <tbody>
            {sortedGames.map((game) => (
              <tr key={game.id}>
                <td>{formatDateShort(game.date)}</td>

                <td className="order-col">
                  <input
                    className="input-center small-input"
                    type="number"
                    value={game.game_order ?? ''}
                    onChange={(e) =>
                      updateGameField(game.id, 'game_order', e.target.value)
                    }
                  />
                </td>

                <td className="wide-text-cell">
                  <input
                    value={game.opponent}
                    onChange={(e) =>
                      updateGameField(game.id, 'opponent', e.target.value)
                    }
                  />
                </td>

                <td>
                  <select
                    value={game.game_type || GAME_TYPES[0]}
                    onChange={(e) =>
                      updateGameField(game.id, 'game_type', e.target.value)
                    }
                  >
                    {GAME_TYPES.map((type) => (
                      <option key={type}>{type}</option>
                    ))}
                  </select>
                </td>

                <td className="center-cell">{game.innings}</td>
                <td className="center-cell">{game.lineupState}</td>

                <td>
                  <div
                    style={{
                      display: 'flex',
                      gap: 8,
                      flexWrap: 'nowrap',
                      alignItems: 'center',
                    }}
                  >
                    <button
                      onClick={() => {
                        setSelectedGameId(pk(game.id))
                        setPage('game-detail')
                      }}
                    >
                      Open
                    </button>
                    <button onClick={() => deleteGame(game.id)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}

            {!sortedGames.length && !loading && (
              <tr>
                <td colSpan="7">No games yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
