export default function MiniDiamond({ status, locked = false }) {
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

  return (
    <div style={{ position: 'relative', width: 82, height: 82, margin: '0 auto' }}>
      
      {/* DIAMOND */}
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

      {/* POSITIONS */}
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
        />
      ))}

      {/* 🔒 LOCK INDICATOR (NEW) */}
      {locked && (
        <div
          style={{
            position: 'absolute',
            top: 2,
            right: 2,
            width: 16,
            height: 16,
            borderRadius: 999,
            background: '#0f172a',
            color: '#fff',
            fontSize: 10,
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          ✓
        </div>
      )}
    </div>
  )
}
