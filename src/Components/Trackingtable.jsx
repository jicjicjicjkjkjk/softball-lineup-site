export default function TrackingTable({ title, rows }) {
  return (
    <div className="card" style={{ overflowX: 'auto' }}>
      <h3>{title}</h3>
      <table>
        <thead>
          <tr>
            <th>Player</th>
            <th>Games</th>
            <th>Fld</th>
            <th>Out</th>
            <th>Exp X</th>
            <th>Act X</th>
            <th>Delta</th>
            <th>P</th>
            <th>C</th>
            <th>1B</th>
            <th>2B</th>
            <th>3B</th>
            <th>SS</th>
            <th>LF</th>
            <th>CF</th>
            <th>RF</th>
            <th>IF</th>
            <th>OF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${title}-${row.playerId}`}>
              <td>{row.name}</td>
              <td>{row.games}</td>
              <td>{row.fieldTotal}</td>
              <td>{row.Out}</td>
              <td>{row.expectedOuts}</td>
              <td>{row.actualOuts}</td>
              <td>{row.delta}</td>
              <td>{row.P}</td>
              <td>{row.C}</td>
              <td>{row['1B']}</td>
              <td>{row['2B']}</td>
              <td>{row['3B']}</td>
              <td>{row.SS}</td>
              <td>{row.LF}</td>
              <td>{row.CF}</td>
              <td>{row.RF}</td>
              <td>{row.IF}</td>
              <td>{row.OF}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
