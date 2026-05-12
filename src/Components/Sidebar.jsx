const NAV_ITEMS = [
  { key: 'games', label: 'Games' },
  { key: 'game-detail', label: 'Game Detail' },
  { key: 'lineup-setter', label: 'Lineup Setter' },
  { key: 'tracking', label: 'Tracking' },
  { key: 'positioning-priority', label: 'Positioning Priority' },
  { key: 'attendance', label: 'Attendance' },
  { key: 'pitch-calling', label: 'Pitch Calling' },
  { key: 'pitch-admin', label: 'Pitch Admin' },
  { key: 'optimizer-inputs', label: 'Optimizer Inputs' },
  { key: 'admin', label: 'Admin' },
]

export default function Sidebar({ page, setPage }) {
  const activeItem = NAV_ITEMS.find((item) => item.key === page)

  function handleNav(key) {
    setPage(key)
    document.body.classList.remove('mobile-nav-open')
  }

  return (
    <>
      <div className="mobile-top-nav">
        <button
          type="button"
          className="mobile-menu-button"
          onClick={() => document.body.classList.toggle('mobile-nav-open')}
        >
          ☰
        </button>

        <div>
          <strong>Softball Lineups</strong>
          <span>{activeItem?.label || 'Dashboard'}</span>
        </div>
      </div>

      <aside className="app-sidebar">
        <div className="sidebar-title">
          Softball
          <br />
          Lineups
        </div>

        <nav className="sidebar-nav">
          {NAV_ITEMS.map((item) => {
            const active = page === item.key

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => handleNav(item.key)}
                className={`sidebar-nav-button ${active ? 'is-active' : ''}`}
              >
                {item.label}
              </button>
            )
          })}
        </nav>
      </aside>

      <button
        type="button"
        className="mobile-nav-backdrop"
        onClick={() => document.body.classList.remove('mobile-nav-open')}
        aria-label="Close menu"
      />
    </>
  )
}
