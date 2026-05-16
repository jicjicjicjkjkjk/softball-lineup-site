export default function MiniDiamond({
  status,
  inning,
  lineup,
  players = [],
  lockedPositions = [],
}) {
  const posCoords = {
    P: { left: '46%', top: '60%' },
    C: { left: '46%', top: '83%' },
    '1B': { left: '70%', top: '63%' },
    '2B': { left: '61%', top: '37%' },
    '3B': { left: '22%', top: '63%' },
    SS: { left: '31%', top: '37%' },
    LF: { left: '10%', top: '18%' },
    CF: { left: '46%', top: '6%' },
    RF: { left: '82%', top: '18%' },
  }

  function fillFor(pos) {
    if (status?.duplicate?.includes(pos)) return '#ef4444'
    if (status?.missing?.includes(pos)) return '#e5e7eb'
    return '#22c55e'
  }

  function isPositionLocked(pos) {
    if (lockedPositions.includes(pos)) return true

    const player = (players || []).find((p) => {
      const id = String(p.id)
      return lineup?.cells?.[id]?.[inning] === pos
    })

    if (!player) return false

    const id = String(player.id)
    return lineup?.lockedCells?.[id]?.[inning] === true
  }

  return (
    <div style={{ position: 'relative', width: 82, height: 82, margin: '0 auto' }}>
      <div
        style={{
          position: 'absolute',
          left: '50%',
          top: '48%',
          width: 44,
          height: 44,
          transform: 'translate(-50%, -50%) rotate(45deg)',
          border: '1px solid #94a3b8',
          background: '#f8fafc',
        }}
      />

      {Object.entries(posCoords).map(([pos, coords]) => (
        <div
          key={pos}
          title={pos}
          style={{
            position: 'absolute',
            left: coords.left,
            top: coords.top,
            width: 12,
            height: 12,
            borderRadius: 999,
            background: fillFor(pos),
            border: '1px solid #64748b',
            transform: 'translate(-50%, -50%)',
          }}
        >
          {isPositionLocked(pos) && (
            <span
              style={{
                position: 'absolute',
                top: -12,
                right: -8,
                fontSize: 10,
                lineHeight: 1,
              }}
            >
              🔒
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
