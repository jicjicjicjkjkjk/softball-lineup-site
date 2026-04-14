export default function Sidebar({ page, setPage }) {
  function navButton(key, label) {
    return (
      <button
        className={page === key ? 'nav-button active' : 'nav-button'}
        onClick={() => setPage(key)}
      >
        {label}
      </button>
    )
  }

  return (
    <aside className="sidebar no-print">
      <h1>Thunder Lineup Tool</h1>
      <div className="nav-stack">
        {navButton('players', 'Players')}
        {navButton('positioning-priority', 'Positioning Priority')}
        {navButton('games', 'Games')}
        {navButton('game-detail', 'Game Detail')}
        {navButton('optimizer', 'Optimizer')}
        {navButton('tracking', 'Tracking')}
      </div>
    </aside>
  )
}
