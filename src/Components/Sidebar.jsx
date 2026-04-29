const NAV_ITEMS = [
  { key: 'games', label: 'Games' },
  { key: 'game-detail', label: 'Game Detail' },
  { key: 'lineup-setter', label: 'Lineup Setter' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'players', label: 'Players' },
  { key: 'positioning-priority', label: 'Positioning Priority' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'admin', label: 'Admin' },
]

export default function Sidebar({ page, setPage }) {
  return (
    <aside
      style={{
        width: 240,
        minWidth: 240,
        background: '#123847',
        color: 'white',
        padding: 20,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.2, marginBottom: 20 }}>
        Softball
        <br />
        Lineups
      </div>

      <nav
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {NAV_ITEMS.map((item) => {
          const active = page === item.key

          return (
            <button
              key={item.key}
              onClick={() => setPage(item.key)}
              style={{
                width: '100%',
                textAlign: 'left',
                padding: '12px 14px',
                borderRadius: 10,
                border: 'none',
                cursor: 'pointer',
                fontSize: 16,
                fontWeight: active ? 700 : 500,
                background: active ? '#167c74' : '#1d5568',
                color: 'white',
              }}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
    </aside>
  )
}
