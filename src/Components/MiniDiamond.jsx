export default function MiniDiamond({ status, locked = false }) {
  let className = 'mini-diamond-dot'

  if (!status?.filled) {
    className += ' empty'
  } else if (status?.invalid || status?.duplicate?.length) {
    className += ' invalid'
  } else {
    className += ' valid'
  }

  return (
    <div className="mini-diamond-wrap">
      <div className={className} />
      {locked && <div className="mini-diamond-lock">✓</div>}
    </div>
  )
}
