export default function LineupAvailability({
  activePlayers,
  lineup,
  optimizerFocusLocked,
  togglePreviewAvailable,
  optimizerFocusGame,
  pk,
}) {
  return (
    <>
      <h4>Game Availability</h4>

      <div className="checkbox-grid">
        {activePlayers.map((player) => (
          <label key={player.id} className="checkbox-item">
            <input
              type="checkbox"
              checked={(lineup.availablePlayerIds || []).includes(pk(player.id))}
              disabled={optimizerFocusLocked}
              onChange={() =>
                togglePreviewAvailable(optimizerFocusGame.id, player.id)
              }
            />
            {player.name}
          </label>
        ))}
      </div>
    </>
  )
}
