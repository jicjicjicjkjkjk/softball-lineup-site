import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'pitch_type', label: 'Pitch Types' },
  { value: 'pitch_location', label: 'Locations' },
  { value: 'pitch_result', label: 'Pitch Results' },
  { value: 'at_bat_result', label: 'At-Bat Results' },
]

export default function PitchAdminPage({ setAppError }) {
  const [options, setOptions] = useState([])
  const [category, setCategory] = useState('pitch_type')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)

  async function loadOptions() {
    const res = await supabase
      .from('pitch_options')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (res.error) return setAppError(res.error.message)
    setOptions(res.data || [])
  }

  useEffect(() => {
    loadOptions()
  }, [])

  async function addOption() {
    if (!label.trim()) return

    const sameCategory = options.filter((o) => o.category === category)
    const nextOrder = sameCategory.length + 1

    const res = await supabase.from('pitch_options').insert({
      category,
      label: label.trim(),
      sort_order: nextOrder,
      is_active: true,
    })

    if (res.error) return setAppError(res.error.message)

    setLabel('')
    loadOptions()
  }

  async function updateOption(id, field, value) {
    setLoading(true)

    const res = await supabase
      .from('pitch_options')
      .update({ [field]: value })
      .eq('id', id)

    setLoading(false)

    if (res.error) return setAppError(res.error.message)
    loadOptions()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pitch Calling Admin</h1>
          <p>Manage pitch types, locations, pitch results, and at-bat results.</p>
        </div>
      </div>

      <div className="card">
        <h2>Add Option</h2>

        <div className="grid-3">
          <label>
            Category
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Label
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="Example: Rise Ball"
            />
          </label>

          <div style={{ display: 'flex', alignItems: 'end' }}>
            <button type="button" onClick={addOption}>
              Add
            </button>
          </div>
        </div>
      </div>

      {CATEGORIES.map((cat) => {
        const rows = options.filter((o) => o.category === cat.value)

        return (
          <div className="card" key={cat.value}>
            <h2>{cat.label}</h2>

            <table>
              <thead>
                <tr>
                  <th>Active</th>
                  <th>Label</th>
                  <th>Order</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((option) => (
                  <tr key={option.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={option.is_active !== false}
                        onChange={(e) => updateOption(option.id, 'is_active', e.target.checked)}
                        disabled={loading}
                      />
                    </td>
                    <td>
                      <input
                        value={option.label || ''}
                        onChange={(e) => updateOption(option.id, 'label', e.target.value)}
                        disabled={loading}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={option.sort_order || 0}
                        onChange={(e) =>
                          updateOption(option.id, 'sort_order', Number(e.target.value || 0))
                        }
                        disabled={loading}
                        style={{ width: 90 }}
                      />
                    </td>
                  </tr>
                ))}

                {!rows.length && (
                  <tr>
                    <td colSpan="3">No options yet.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )
      })}
    </div>
  )
}
