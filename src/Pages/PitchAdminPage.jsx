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
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
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

  const pitcherPlayers = activePlayers.filter((player) => {
    const row = pitcherRowForPlayer(player.id)
    return row?.is_active === true
  })

  const selectedPlayer = activePlayers.find((p) => String(p.id) === String(selectedPlayerId))
  const selectedPitcher = selectedPlayer ? pitcherRowForPlayer(selectedPlayer.id) : null

  useEffect(() => {
    loadAllPitchAdmin()
  }, [])

  useEffect(() => {
    if (!selectedPlayerId && pitcherPlayers.length) {
      setSelectedPlayerId(pitcherPlayers[0].id)
    }
  }, [pitchers.length, players.length])

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

  async function togglePitcher(player, checked) {
    const existing = pitcherRowForPlayer(player.id)

    if (existing) {
      const res = await supabase
        .from('pitch_call_pitchers')
        .update({ is_active: checked })
        .eq('id', existing.id)

      if (res.error) return setAppError(res.error.message)

      if (checked) setSelectedPlayerId(player.id)
      if (!checked && String(selectedPlayerId) === String(player.id)) setSelectedPlayerId('')

      return loadAllPitchAdmin()
    }

    const res = await supabase
      .from('pitch_call_pitchers')
      .insert({
        player_id: player.id,
        display_number: player.jersey_number || player.number || '',
        is_active: checked,
      })
      .select('*')
      .single()

    if (res.error) return setAppError(res.error.message)

    if (checked) setSelectedPlayerId(player.id)
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

    setPitchPrefs((current) =>
      current.map((pref) =>
        pref.id === existingPref.id ? { ...pref, preference_order: Number(value || 0) } : pref
      )
    )

    const res = await supabase
      .from('pitcher_pitch_preferences')
      .update({ preference_order: Number(value || 0) })
      .eq('id', existingPref.id)

    if (res.error) return setAppError(res.error.message)
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
        <p>Choose which players are pitchers. Only checked pitchers show on the Pitch Calling page.</p>

        <div className="pitcher-admin-player-grid">
          {activePlayers.map((player) => {
            const pitcher = pitcherRowForPlayer(player.id)
            const isPitcher = pitcher?.is_active === true

            return (
              <button
                key={player.id}
                type="button"
                className={`pitcher-admin-player-card ${
                  isPitcher ? 'is-active' : ''
                } ${String(selectedPlayerId) === String(player.id) ? 'is-selected' : ''}`}
                onClick={() => {
                  if (isPitcher) setSelectedPlayerId(player.id)
                  else togglePitcher(player, true)
                }}
              >
                <span className="pitcher-admin-check">{isPitcher ? '✓' : '+'}</span>
                <span>
                  <strong>{player.name}</strong>
                  <small>#{pitcher?.display_number || player.jersey_number || player.number || '—'}</small>
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {selectedPlayer && (
        <div className="card">
          <div className="row-between wrap-row">
            <div>
              <h2>{selectedPlayer.name} Pitch Setup</h2>
              <p>Select pitches and set the order they should appear during games.</p>
            </div>

            <button type="button" onClick={() => togglePitcher(selectedPlayer, false)}>
              Remove as Pitcher
            </button>
          </div>

          <div className="grid-3">
            <label>
              Pitcher Number
              <input
                value={
                  selectedPitcher?.display_number ||
                  selectedPlayer.jersey_number ||
                  selectedPlayer.number ||
                  ''
                }
                onChange={(e) => updatePitcherNumber(selectedPlayer.id, e.target.value)}
              />
            </label>
          </div>

          <div className="pitcher-pitch-card-grid">
            {pitchTypes.map((pitch) => {
              const pref = prefForPitcherPitch(selectedPlayer.id, pitch.id)
              const enabled = pref?.is_active === true

              return (
                <div key={pitch.id} className={`pitcher-pitch-card ${enabled ? 'is-active' : ''}`}>
                  <label className="pitcher-pitch-toggle">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => togglePitchForPitcher(selectedPlayer, pitch, e.target.checked)}
                    />
                    <span>{pitch.label}</span>
                  </label>

                  <label>
                    Display Order
                    <input
                      type="number"
                      value={pref?.preference_order || ''}
                      disabled={!pref}
                      onChange={(e) =>
                        updatePitchPreferenceOrder(selectedPlayer.id, pitch.id, e.target.value)
                      }
                      placeholder="#"
                    />
                  </label>
                </div>
              )
            })}
          </div>
        </div>
      )}

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
