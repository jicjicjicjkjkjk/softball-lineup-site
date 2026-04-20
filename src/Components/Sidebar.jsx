export default function Sidebar({ page, setPage }) {
  const navItems = [
    { key: 'games', label: 'Games' },
    { key: 'game-detail', label: 'Game Detail' },
    { key: 'lineup-setter', label: 'Lineup Setter' },
    { key: 'tracking', label: 'Tracking' },
    { key: 'players', label: 'Players' },
    { key: 'positioning-priority', label: 'Positioning Priority' },
    { key: 'attendance', label: 'Attendance' },
    { key: 'admin', label: 'Admin' },
  ]

  return (
    <aside className="sidebar">
      <div className="sidebar-title">Softball Lineups</div>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <button
            key={item.key}
            type="button"
            className={page === item.key ? 'sidebar-link active' : 'sidebar-link'}
            onClick={() => setPage(item.key)}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </aside>
  )
}
