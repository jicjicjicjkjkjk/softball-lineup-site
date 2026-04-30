export default function LineupAvailability({
  activePlayers,
  lineup,
  optimizerFocusLocked,
  togglePreviewAvailable,
  optimizerFocusGame,
  pk,
}) {
  const availableSet = new Set((lineup.availablePlayerIds || []).map(pk))

  const sortedPlayers = [...(activePlayers || [])].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''))
  )

  const total = sortedPlayers.length
  const availableCount = sortedPlayers.filter((p) =>
    availableSet.has(pk(p.id))
  ).length

  return (
    <>
      <div className="row-between" style={{ marginBottom: 6 }}>
        <h4 style={{ margin: 0 }}>Game Availability</h4>

        <div className="small-note">
          {availableCount} / {total} available
        </div>
      </div>

      <div className="checkbox-grid">
        {sortedPlayers.map((player) => {
          const id = pk(player.id)
          const isAvailable = availableSet.has(id)

          return (
            <label
              key={player.id}
              className={`checkbox-item ${isAvailable ? 'available' : 'not-available'}`}
            >
              <input
                type="checkbox"
                checked={isAvailable}
                disabled={optimizerFocusLocked}
                onChange={() =>
                  togglePreviewAvailable(optimizerFocusGame.id, player.id)
                }
              />

              <span className="player-chip">
                {player.jersey_number ? `#${player.jersey_number} ` : ''}
                {player.name}
              </span>
            </label>
          )
        })}
      </div>
    </>
  )
}
