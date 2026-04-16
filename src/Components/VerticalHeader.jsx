export function verticalHeaderStyle(minWidth = 34, height = 150) {
  return {
    minWidth,
    width: minWidth,
    padding: '4px 2px',
    verticalAlign: 'bottom',
  }
}

export default function VerticalHeader({
  top,
  bottom,
  minWidth = 34,
  height = 150,
}) {
  return (
    <th style={verticalHeaderStyle(minWidth, height)}>
      <div
        style={{
          height,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 4,
          overflow: 'hidden',
        }}
      >
        {top ? (
          <div style={{ fontWeight: 700, fontSize: 11, lineHeight: 1 }}>
            {top}
          </div>
        ) : null}

        <div
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            whiteSpace: 'nowrap',
            fontWeight: 700,
            fontSize: 11,
            lineHeight: 1,
            overflow: 'hidden',
            textOverflow: 'clip',
          }}
        >
          {bottom}
        </div>
      </div>
    </th>
  )
}
