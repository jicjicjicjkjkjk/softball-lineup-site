import { formatDateShort } from '../lib/appHelpers'

export default function LineupImportPanel({
  optimizerFocusGame,
  optimizerFocusLocked,
  optimizerImportSourceGameId,
  setOptimizerImportSourceGameId,
  optimizerImportableGames,
  importLineupToPreview,
  gameTypeOptions,
  seasonOptions,
  getOptionLabel,
  pk,
}) {
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <h4 style={{ marginTop: 0 }}>Import Lineup</h4>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12 }}>
        <div>
          <label>Source Game</label>
          <select
            value={optimizerImportSourceGameId}
            onChange={(e) => setOptimizerImportSourceGameId(e.target.value)}
            disabled={optimizerFocusLocked}
          >
            <option value="">Select game to import</option>

            {optimizerImportableGames.map((game) => (
              <option key={game.id} value={pk(game.id)}>
                {(formatDateShort(game.date) || 'No Date')} vs {game.opponent}
              </option>
            ))}
          </select>
        </div>

        <div>
          <button
            onClick={() =>
              importLineupToPreview(optimizerFocusGame.id, optimizerImportSourceGameId)
            }
            disabled={!optimizerImportSourceGameId || optimizerFocusLocked}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  )
}
