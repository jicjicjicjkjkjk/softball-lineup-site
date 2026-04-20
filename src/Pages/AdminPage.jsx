import { useMemo, useState } from 'react'

export default function AdminPage({
  appOptions,
  loadAppOptions,
  addAppOption,
  updateAppOption,
}) {
  const [category, setCategory] = useState('season')
  const [value, setValue] = useState('')
  const [label, setLabel] = useState('')
  const [sortOrder, setSortOrder] = useState('')

  const rows = useMemo(() => {
    return (appOptions?.[category] || []).slice().sort((a, b) => {
      return Number(a.sort_order || 0) - Number(b.sort_order || 0)
    })
  }, [appOptions, category])

  async function handleAdd() {
    if (!value.trim() || !label.trim()) return
    await addAppOption({
      category,
      value: value.trim(),
      label: label.trim(),
      sort_order: Number(sortOrder || 0),
      is_active: true,
    })
    setValue('')
    setLabel('')
    setSortOrder('')
    await loadAppOptions()
  }

  return (
    <div className="stack">
      <div className="card">
        <h2>Admin</h2>

        <div className="grid two-col">
          <div>
            <label>Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              <option value="season">Season</option>
              <option value="game_type">Game Type</option>
            </select>
          </div>
        </div>

        <div style={{ height: 16 }} />

        <div className="grid three-col">
          <div>
            <label>Value</label>
            <input value={value} onChange={(e) => setValue(e.target.value)} />
          </div>

          <div>
            <label>Label</label>
            <input value={label} onChange={(e) => setLabel(e.target.value)} />
          </div>

          <div>
            <label>Sort Order</label>
            <input value={sortOrder} onChange={(e) => setSortOrder(e.target.value)} />
          </div>
        </div>

        <div style={{ height: 16 }} />
        <button onClick={handleAdd}>Add Option</button>
      </div>

      <div className="card">
        <h3>{category === 'season' ? 'Seasons' : 'Game Types'}</h3>

        <table className="table-center">
          <thead>
            <tr>
              <th>Value</th>
              <th>Label</th>
              <th>Sort</th>
              <th>Active</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td>{row.value}</td>
                <td>
                  <input
                    value={row.label || ''}
                    onChange={(e) =>
                      updateAppOption(row.id, { label: e.target.value })
                    }
                  />
                </td>
                <td>
                  <input
                    value={row.sort_order ?? ''}
                    onChange={(e) =>
                      updateAppOption(row.id, { sort_order: Number(e.target.value || 0) })
                    }
                  />
                </td>
                <td>
                  <input
                    type="checkbox"
                    checked={row.is_active === true}
                    onChange={(e) =>
                      updateAppOption(row.id, { is_active: e.target.checked })
                    }
                  />
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan="4">No options found.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
