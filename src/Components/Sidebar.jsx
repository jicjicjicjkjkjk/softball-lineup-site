export default function Sidebar({ page, setPage }) {
  const items = [
    ['players', 'Players'],
    ['positioning-priority', 'Positioning Priority'],
    ['games', 'Games'],
    ['game-detail', 'Game Detail'],
    ['lineup-setter', 'Lineup Setter'],
    ['tracking', 'Tracking'],
    ['attendance', 'Attendance Tracker'],
  ]

  return (
    <aside className="sidebar no-print">
      <h1>Thunder Lineup Tool</h1>
      <div className="nav-stack">
        {items.map(([key, label]) => (
          <button
            key={key}
            className={page === key ? 'nav-button active' : 'nav-button'}
            onClick={() => setPage(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </aside>
  )
}
