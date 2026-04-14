import { FIELD_POSITIONS, positionCountsForInning } from '../lib/lineupUtils'

const coords = {
  P: { top: '58%', left: '50%' },
  C: { top: '85%', left: '50%' },
  '1B': { top: '58%', left: '72%' },
  '2B': { top: '38%', left: '62%' },
  '3B': { top: '58%', left: '28%' },
  SS: { top: '38%', left: '38%' },
  LF: { top: '18%', left: '18%' },
  CF: { top: '8%', left: '50%' },
  RF: { top: '18%', left: '82%' },
}

export default function MiniDiamond({ lineup, inning }) {
  const availableIds = (lineup?.availablePlayerIds || []).map(String)
  const counts = positionCountsForInning(lineup, inning, availableIds)

  function dotColor(position) {
    const count = counts[position]?.length || 0
    if (count === 0) return '#d1d5db'
    if (count === 1) return '#22c55e'
    return '#ef4444'
  }

  return (
    <div
      style={{
        width: 56,
        height: 56,
        position: 'relative',
        margin: '0 auto',
      }}
    >
      {FIELD_POSITIONS.map((position) => (
        <div
          key={position}
          title={position}
          style={{
            position: 'absolute',
            top: coords[position].top,
            left: coords[position].left,
            transform: 'translate(-50%, -50%)',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: dotColor(position),
            border: '1px solid white',
          }}
        />
      ))}
    </div>
  )
}
