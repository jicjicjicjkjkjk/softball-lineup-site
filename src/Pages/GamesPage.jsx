// FILE: src/Pages/GamesPage.jsx

import { useEffect } from 'react'

function renderOptionLabel(option) {
  if (!option) return ''
  if (typeof option === 'string') return option
  return option.label || option.value || ''
}

function renderOptionValue(option) {
  if (!option) return ''
  if (typeof option === 'string') return option
  return option.value || option.label || ''
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
  newGameSeason,
  setNewGameSeason,
  addGameFromGames,
  sortedGames,
  gameSort,
  setGameSort,
  updateGameField,
  deleteGame,
  setSelectedGameId,
  setPage,
  seasonOptions = [],
  gameTypeOptions = [],
  statusOptions = [],
}) {
  // ✅ DEFAULT SORT (highest game_order first)
  useEffect(() => {
    setGameSort({ key: 'game_order', direction: 'desc' })
  }, [])

  function nextSort(key) {
    if (gameSort.key !== key) {
      setGameSort({ key, direction: 'asc' })
      return
    }

    setGameSort({
      key,
      direction: gameSort.direction === 'asc' ? 'desc' : 'asc',
    })
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between wrap-row">
          <div>
            <h2 style={{ marginBottom: 8 }}>Games</h2>
            <div className="small-note">
              Create, edit, and manage scheduled games.
            </div>
          </div>

          <div className="button-row">
            <button onClick={loadAll}>Refresh</button>
          </div>
        </div>

        {appError ? (
          <div className="summary-box" style={{ marginTop: 16, color: '#b91c1c' }}>
            {appError}
          </div>
        ) : null}

        {loading ? (
          <div className="summary-box" style={{ marginTop: 16 }}>
            Loading…
          </div>
        ) : null}
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Add Game</h3>

        <div className="games-add-grid">
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
              placeholder="Opponent"
            />
          </div>

          <div>
            <label>Game Type</label>
            <select
              value={newGameType}
              onChange={(e) => setNewGameType(e.target.value)}
            >
              <option value="">Select type</option>
              {gameTypeOptions.map((option) => (
                <option
                  key={renderOptionValue(option)}
                  value={renderOptionValue(option)}
                >
                  {renderOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Season</label>
            <select
              value={newGameSeason}
              onChange={(e) => setNewGameSeason(e.target.value)}
            >
              <option value="">Select season</option>
              {seasonOptions.map((option) => (
                <option
                  key={renderOptionValue(option)}
                  value={renderOptionValue(option)}
                >
                  {renderOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div className="align-end">
            <button onClick={addGameFromGames}>Add Game</button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="row-between wrap-row" style={{ marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Game List</h3>
          <div className="small-note">{sortedGames.length} games</div>
        </div>

        <div className="table-scroll">
          <table className="table-center games-table">
            <thead>
  <tr>
    <th className="games-date-col" onClick={() => nextSort('date')}>Date</th>
    <th className="games-order-col" onClick={() => nextSort('game_order')}>Order</th>
    <th className="games-opponent-col" onClick={() => nextSort('opponent')}>
      Opponent
    </th>
    <th className="games-type-col" onClick={() => nextSort('game_type')}>Game Type</th>
    <th className="games-season-col" onClick={() => nextSort('season')}>Season</th>
    <th className="games-innings-col">Innings</th>
    <th className="games-status-col" onClick={() => nextSort('status')}>Status</th>
    <th className="games-lineup-col" onClick={() => nextSort('lineupState')}>Lineup</th>
    <th className="games-action-col">Open</th>
    <th className="games-action-col">Delete</th>
  </tr>
</thead>

            <tbody>
              {sortedGames.map((game) => (
                <tr key={game.id}>
                  <td>
                    <input
                      type="date"
                      value={game.date || ''}
                      onChange={(e) =>
                        updateGameField(game.id, 'date', e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={game.game_order ?? ''}
                      onChange={(e) =>
                        updateGameField(game.id, 'game_order', e.target.value)
                      }
                    />
                  </td>

                  <td style={{ textAlign: 'left' }}>
                    <input
                      value={game.opponent || ''}
                      onChange={(e) =>
                        updateGameField(game.id, 'opponent', e.target.value)
                      }
                    />
                  </td>

                  <td>
                    <select
                      value={game.game_type || ''}
                      onChange={(e) =>
                        updateGameField(game.id, 'game_type', e.target.value)
                      }
                    >
                      <option value="">Select type</option>
                      {gameTypeOptions.map((option) => (
                        <option
                          key={renderOptionValue(option)}
                          value={renderOptionValue(option)}
                        >
                          {renderOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>
                    <select
                      value={game.season || ''}
                      onChange={(e) =>
                        updateGameField(game.id, 'season', e.target.value)
                      }
                    >
                      <option value="">Select season</option>
                      {seasonOptions.map((option) => (
                        <option
                          key={renderOptionValue(option)}
                          value={renderOptionValue(option)}
                        >
                          {renderOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className="center-cell">
                    {game.innings ?? 6}
                  </td>

                  <td>
                    <select
                      value={game.status || ''}
                      onChange={(e) =>
                        updateGameField(game.id, 'status', e.target.value)
                      }
                    >
                      <option value="">Select status</option>
                      {statusOptions.map((option) => (
                        <option
                          key={renderOptionValue(option)}
                          value={renderOptionValue(option)}
                        >
                          {renderOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td>{game.lineupState || ''}</td>

                  <td>
                    <button
                      onClick={() => {
                        setSelectedGameId(String(game.id))
                        setPage('game-detail')
                      }}
                    >
                      Open
                    </button>
                  </td>

                  {/* ✅ DELETE CONFIRM */}
                  <td>
                    <button
                      onClick={() => {
                        if (window.confirm('Delete this game?')) {
                          deleteGame(game.id)
                        }
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}

              {!sortedGames.length && (
                <tr>
                  <td colSpan="10">No games yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
