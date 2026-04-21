import { useMemo, useState } from 'react'

function blankForm(category = 'season') {
  return {
    category,
    name: '',
    sort_order: '',
    is_active: true,
  }
}

function normalizeValue(text = '') {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

export default function AdminPage({
  appOptions,
  loadAppOptions,
  addAppOption,
  updateAppOption,
}) {
  const [seasonForm, setSeasonForm] = useState(blankForm('season'))
  const [gameTypeForm, setGameTypeForm] = useState(blankForm('game_type'))
  const [statusForm, setStatusForm] = useState(blankForm('status'))

  const seasonRows = useMemo(() => appOptions?.season || [], [appOptions])
  const gameTypeRows = useMemo(() => appOptions?.game_type || [], [appOptions])
  const statusRows = useMemo(() => appOptions?.status || [], [appOptions])

  async function submitForm(form, resetForm) {
    const name = String(form.name || '').trim()
    if (!name) return

    await addAppOption({
      category: form.category,
      label: name,
      value: normalizeValue(name),
      sort_order: form.sort_order === '' ? 999 : Number(form.sort_order),
      is_active: form.is_active !== false,
    })

    resetForm(blankForm(form.category))
    await loadAppOptions()
  }

  async function toggleActive(row) {
    await updateAppOption(row.id, { is_active: !row.is_active })
  }

  async function updateField(row, field, value) {
    if (field === 'name') {
      await updateAppOption(row.id, {
        label: value,
        value: normalizeValue(value),
      })
      return
    }

    await updateAppOption(row.id, {
      [field]:
        field === 'sort_order'
          ? value === ''
            ? 999
            : Number(value)
          : value,
    })
  }

  function renderSection(title, rows, form, setForm, itemLabel) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{title}</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 120px 120px auto',
            gap: 12,
            alignItems: 'end',
            marginBottom: 18,
          }}
        >
          <div>
            <label>Name</label>
            <input
              value={form.name}
              onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
              placeholder={`Add ${itemLabel}`}
            />
          </div>

          <div>
            <label>Sort</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={(e) => setForm((s) => ({ ...s, sort_order: e.target.value }))}
              placeholder="999"
            />
          </div>

          <div>
            <label>Active</label>
            <select
              value={form.is_active ? 'yes' : 'no'}
              onChange={(e) =>
                setForm((s) => ({ ...s, is_active: e.target.value === 'yes' }))
              }
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>

          <div>
            <button onClick={() => submitForm(form, setForm)}>Add</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-center" style={{ minWidth: 620 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th>Sort</th>
                <th>Active</th>
                <th>Toggle</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ textAlign: 'left' }}>
                    <input
                      value={row.label || ''}
                      onChange={(e) => updateField(row, 'name', e.target.value)}
                    />
                  </td>
                  <td>
                    <input
                      type="number"
                      value={row.sort_order ?? ''}
                      onChange={(e) => updateField(row, 'sort_order', e.target.value)}
                      style={{ width: 80 }}
                    />
                  </td>
                  <td>{row.is_active ? 'Yes' : 'No'}</td>
                  <td>
                    <button onClick={() => toggleActive(row)}>
                      {row.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan="4">No options yet.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: 12,
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div>
            <h2 style={{ marginBottom: 8 }}>Admin</h2>
            <div className="small-note">
              Manage reusable lists for Seasons, Game Types, and Game Status.
            </div>
          </div>

          <button onClick={loadAppOptions}>Refresh Options</button>
        </div>
      </div>

      {renderSection('Season Options', seasonRows, seasonForm, setSeasonForm, 'season')}
      {renderSection('Game Type Options', gameTypeRows, gameTypeForm, setGameTypeForm, 'game type')}
      {renderSection('Game Status Options', statusRows, statusForm, setStatusForm, 'status')}
    </div>
  )
}
