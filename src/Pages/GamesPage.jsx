import { formatDateShort } from '../lib/appHelpers'

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
            <div className="small-note">Create, edit, and manage scheduled games.</div>
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

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1.3fr 1fr 1fr auto',
            gap: 12,
            alignItems: 'end',
          }}
        >
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
            <select value={newGameType} onChange={(e) => setNewGameType(e.target.value)}>
              <option value="">Select type</option>
              {gameTypeOptions.map((option) => (
                <option key={renderOptionValue(option)} value={renderOptionValue(option)}>
                  {renderOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label>Season</label>
            <select value={newGameSeason} onChange={(e) => setNewGameSeason(e.target.value)}>
              <option value="">Select season</option>
              {seasonOptions.map((option) => (
                <option key={renderOptionValue(option)} value={renderOptionValue(option)}>
                  {renderOptionLabel(option)}
                </option>
              ))}
            </select>
          </div>

          <div>
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
          <table className="table-center" style={{ minWidth: 1125 }}>
            <thead>
              <tr>
                <th onClick={() => nextSort('date')} style={{ cursor: 'pointer' }}>
                  Date
                </th>
                <th onClick={() => nextSort('game_order')} style={{ cursor: 'pointer' }}>
                  Order
                </th>
                <th onClick={() => nextSort('opponent')} style={{ cursor: 'pointer', textAlign: 'left' }}>
                  Opponent
                </th>
                <th onClick={() => nextSort('game_type')} style={{ cursor: 'pointer' }}>
                  Game Type
                </th>
                <th onClick={() => nextSort('season')} style={{ cursor: 'pointer' }}>
                  Season
                </th>
                <th onClick={() => nextSort('innings')} style={{ cursor: 'pointer' }}>
                  Innings
                </th>
                <th onClick={() => nextSort('status')} style={{ cursor: 'pointer' }}>
                  Status
                </th>
                <th onClick={() => nextSort('lineupState')} style={{ cursor: 'pointer' }}>
                  Lineup
                </th>
                <th>Open</th>
                <th>Delete</th>
              </tr>
            </thead>

            <tbody>
              {sortedGames.map((game) => (
                <tr key={game.id}>
                  <td>
                    <input
                      type="date"
                      value={game.date || ''}
                      onChange={(e) => updateGameField(game.id, 'date', e.target.value)}
                    />
                  </td>

                  <td style={{ width: 90 }}>
                    <input
                      type="number"
                      value={game.game_order ?? ''}
                      onChange={(e) => updateGameField(game.id, 'game_order', e.target.value)}
                      style={{ width: 72 }}
                    />
                  </td>

                  <td style={{ textAlign: 'left', minWidth: 220 }}>
                    <input
                      value={game.opponent || ''}
                      onChange={(e) => updateGameField(game.id, 'opponent', e.target.value)}
                      placeholder="Opponent"
                    />
                  </td>

                  <td style={{ minWidth: 150 }}>
                    <select
                      value={game.game_type || ''}
                      onChange={(e) => updateGameField(game.id, 'game_type', e.target.value)}
                    >
                      <option value="">Select type</option>
                      {gameTypeOptions.map((option) => (
                        <option key={renderOptionValue(option)} value={renderOptionValue(option)}>
                          {renderOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ minWidth: 130 }}>
                    <select
                      value={game.season || ''}
                      onChange={(e) => updateGameField(game.id, 'season', e.target.value)}
                    >
                      <option value="">Select season</option>
                      {seasonOptions.map((option) => (
                        <option key={renderOptionValue(option)} value={renderOptionValue(option)}>
                          {renderOptionLabel(option)}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ width: 90 }}>
                    <input
                      type="number"
                      min="1"
                      value={game.innings ?? 6}
                      onChange={(e) => updateGameField(game.id, 'innings', e.target.value)}
                      style={{ width: 72 }}
                    />
                  </td>

                  <td style={{ minWidth: 140 }}>
                    <select
                      value={game.status || ''}
                      onChange={(e) => updateGameField(game.id, 'status', e.target.value)}
                    >
                      <option value="">Select status</option>
                      {statusOptions.map((option) => (
                        <option key={renderOptionValue(option)} value={renderOptionValue(option)}>
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

                  <td>
                    <button onClick={() => deleteGame(game.id)}>Delete</button>
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

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Quick View</h3>
        <div className="table-scroll">
          <table className="table-center" style={{ minWidth: 950 }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Order</th>
                <th style={{ textAlign: 'left' }}>Opponent</th>
                <th>Type</th>
                <th>Season</th>
                <th>Innings</th>
                <th>Status</th>
                <th>Lineup</th>
              </tr>
            </thead>
            <tbody>
              {sortedGames.map((game) => (
                <tr key={`${game.id}-summary`}>
                  <td>{formatDateShort(game.date)}</td>
                  <td>{game.game_order ?? ''}</td>
                  <td style={{ textAlign: 'left' }}>{game.opponent || ''}</td>
                  <td>{game.game_type || ''}</td>
                  <td>{game.season || ''}</td>
                  <td>{game.innings || ''}</td>
                  <td>{game.status || ''}</td>
                  <td>{game.lineupState || ''}</td>
                </tr>
              ))}

              {!sortedGames.length && (
                <tr>
                  <td colSpan="8">No games yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
