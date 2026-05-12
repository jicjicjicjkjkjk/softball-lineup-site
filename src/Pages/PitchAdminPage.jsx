import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const CATEGORIES = [
  { value: 'pitch_type', label: 'Pitch Types' },
  { value: 'pitch_location', label: 'Locations' },
  { value: 'pitch_result', label: 'Pitch Results' },
  { value: 'at_bat_result', label: 'At-Bat Results' },
]

function byOrder(a, b) {
  return Number(a.sort_order || 0) - Number(b.sort_order || 0)
}

export default function PitchAdminPage({ players = [], setAppError }) {
  const [options, setOptions] = useState([])
  const [pitchers, setPitchers] = useState([])
  const [pitchPrefs, setPitchPrefs] = useState([])
  const [category, setCategory] = useState('pitch_type')
  const [label, setLabel] = useState('')
  const [loading, setLoading] = useState(false)

  const activePlayers = useMemo(
    () =>
      players
        .filter((p) => p.active !== false)
        .sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [players]
  )

  const pitchTypes = options
    .filter((o) => o.category === 'pitch_type' && o.is_active !== false)
    .sort(byOrder)

  async function loadAllPitchAdmin() {
    const optionRes = await supabase
      .from('pitch_options')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (optionRes.error) return setAppError(optionRes.error.message)
    setOptions(optionRes.data || [])

    const pitcherRes = await supabase.from('pitch_call_pitchers').select('*')

    if (pitcherRes.error) return setAppError(pitcherRes.error.message)
    setPitchers(pitcherRes.data || [])

    const prefRes = await supabase.from('pitcher_pitch_preferences').select('*')

    if (prefRes.error) return setAppError(prefRes.error.message)
    setPitchPrefs(prefRes.data || [])
  }

  useEffect(() => {
    loadAllPitchAdmin()
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
    loadAllPitchAdmin()
  }

  async function updateOption(id, field, value) {
    setLoading(true)

    const res = await supabase.from('pitch_options').update({ [field]: value }).eq('id', id)

    setLoading(false)

    if (res.error) return setAppError(res.error.message)
    loadAllPitchAdmin()
  }

  function pitcherRowForPlayer(playerId) {
    return pitchers.find((p) => String(p.player_id) === String(playerId))
  }

  function prefForPitcherPitch(playerId, pitchOptionId) {
    const pitcher = pitcherRowForPlayer(playerId)
    if (!pitcher) return null

    return pitchPrefs.find(
      (pref) =>
        String(pref.pitcher_id) === String(pitcher.id) &&
        String(pref.pitch_option_id) === String(pitchOptionId)
    )
  }

  async function togglePitcher(player, checked) {
    const existing = pitcherRowForPlayer(player.id)

    if (existing) {
      const res = await supabase
        .from('pitch_call_pitchers')
        .update({ is_active: checked })
        .eq('id', existing.id)

      if (res.error) return setAppError(res.error.message)
      return loadAllPitchAdmin()
    }

    const res = await supabase.from('pitch_call_pitchers').insert({
      player_id: player.id,
      display_number: player.jersey_number || player.number || '',
      is_active: checked,
    })

    if (res.error) return setAppError(res.error.message)
    loadAllPitchAdmin()
  }

  async function updatePitcherNumber(playerId, value) {
    const existing = pitcherRowForPlayer(playerId)
    if (!existing) return

    setPitchers((current) =>
      current.map((p) => (p.id === existing.id ? { ...p, display_number: value } : p))
    )

    const res = await supabase
      .from('pitch_call_pitchers')
      .update({ display_number: value })
      .eq('id', existing.id)

    if (res.error) setAppError(res.error.message)
  }

  async function togglePitchForPitcher(player, pitch, checked) {
    let pitcher = pitcherRowForPlayer(player.id)

    if (!pitcher) {
      const pitcherRes = await supabase
        .from('pitch_call_pitchers')
        .insert({
          player_id: player.id,
          display_number: player.jersey_number || player.number || '',
          is_active: true,
        })
        .select('*')
        .single()

      if (pitcherRes.error) return setAppError(pitcherRes.error.message)
      pitcher = pitcherRes.data
    }

    const existingPref = prefForPitcherPitch(player.id, pitch.id)

    if (existingPref) {
      const res = await supabase
        .from('pitcher_pitch_preferences')
        .update({ is_active: checked })
        .eq('id', existingPref.id)

      if (res.error) return setAppError(res.error.message)
      return loadAllPitchAdmin()
    }

    const existingOrders = pitchPrefs
      .filter((pref) => String(pref.pitcher_id) === String(pitcher.id))
      .map((pref) => Number(pref.preference_order || 0))

    const nextOrder = existingOrders.length ? Math.max(...existingOrders) + 1 : 1

    const res = await supabase.from('pitcher_pitch_preferences').insert({
      pitcher_id: pitcher.id,
      pitch_option_id: pitch.id,
      preference_order: nextOrder,
      is_active: checked,
    })

    if (res.error) return setAppError(res.error.message)
    loadAllPitchAdmin()
  }

  async function updatePitchPreferenceOrder(playerId, pitchId, value) {
    const existingPref = prefForPitcherPitch(playerId, pitchId)
    if (!existingPref) return

    const res = await supabase
      .from('pitcher_pitch_preferences')
      .update({ preference_order: Number(value || 0) })
      .eq('id', existingPref.id)

    if (res.error) return setAppError(res.error.message)
    loadAllPitchAdmin()
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pitch Calling Admin</h1>
          <p>Manage pitch types, locations, results, pitchers, and each pitcher’s pitch order.</p>
        </div>
      </div>

      <div className="card">
        <h2>Pitchers</h2>
        <p>Only active pitchers here will show in the Pitch Calling pitcher dropdown.</p>

        <table>
          <thead>
            <tr>
              <th>Pitcher?</th>
              <th>Player</th>
              <th>#</th>
              {pitchTypes.map((pitch) => (
                <th key={pitch.id}>{pitch.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {activePlayers.map((player) => {
              const pitcher = pitcherRowForPlayer(player.id)
              const isPitcher = pitcher?.is_active === true

              return (
                <tr key={player.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={isPitcher}
                      onChange={(e) => togglePitcher(player, e.target.checked)}
                    />
                  </td>
                  <td>{player.name}</td>
                  <td>
                    <input
                      value={pitcher?.display_number || player.jersey_number || player.number || ''}
                      disabled={!pitcher}
                      onChange={(e) => updatePitcherNumber(player.id, e.target.value)}
                      style={{ width: 70 }}
                    />
                  </td>

                  {pitchTypes.map((pitch) => {
                    const pref = prefForPitcherPitch(player.id, pitch.id)

                    return (
                      <td key={pitch.id}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <input
                            type="checkbox"
                            checked={pref?.is_active === true}
                            onChange={(e) => togglePitchForPitcher(player, pitch, e.target.checked)}
                          />
                          <input
                            type="number"
                            value={pref?.preference_order || ''}
                            disabled={!pref}
                            onChange={(e) =>
                              updatePitchPreferenceOrder(player.id, pitch.id, e.target.value)
                            }
                            placeholder="#"
                            style={{ width: 55 }}
                          />
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
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
