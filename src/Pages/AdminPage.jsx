import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

function blankForm(category = 'season') {
  return {
    category,
    name: '',
    sort_order: '',
    is_active: true,
    is_default: false,
  }
}

function normalizeValue(text = '') {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function blankProfileForm() {
  return {
    profile_name: '',
    profile_key: '',
    is_default: false,
    min_positions_per_player: 2,
    min_positions_mode: 'nice',
    min_innings_between_sit_outs: 2,
    everyone_sits_before_repeat: true,
  }
}

function blankRule(position) {
  return {
    position,
    fill_rank: 99,
    importance: 1,
    allow_primary: true,
    allow_secondary: true,
    allow_development: true,
    allow_disallowed: false,
  }
}

export default function AdminPage({
  appOptions,
  loadAppOptions,
  addAppOption,
  updateAppOption,
  optimizerProfiles = [],
  optimizerProfileRules = {},
  reloadAllData,
}) {
  const [seasonForm, setSeasonForm] = useState(blankForm('season'))
  const [gameTypeForm, setGameTypeForm] = useState(blankForm('game_type'))
  const [statusForm, setStatusForm] = useState(blankForm('status'))

  const [profileForm, setProfileForm] = useState(blankProfileForm())
  const [selectedProfileId, setSelectedProfileId] = useState(
    optimizerProfiles?.[0]?.id || ''
  )

  const seasonRows = useMemo(() => appOptions?.season || [], [appOptions])
  const gameTypeRows = useMemo(() => appOptions?.game_type || [], [appOptions])
  const statusRows = useMemo(() => appOptions?.status || [], [appOptions])

  const selectedProfile =
    optimizerProfiles.find((profile) => profile.id === selectedProfileId) ||
    optimizerProfiles[0] ||
    null

  const selectedRules = selectedProfile?.id
    ? optimizerProfileRules?.[selectedProfile.id] || {}
    : {}

  async function refreshAll() {
    if (typeof reloadAllData === 'function') {
      await reloadAllData()
      return
    }

    if (typeof loadAppOptions === 'function') {
      await loadAppOptions()
    }
  }

  async function submitForm(form, resetForm) {
    const name = String(form.name || '').trim()
    if (!name) return

    if (form.is_default) {
      const rows = (appOptions?.[form.category] || []).filter((row) => row.is_default)
      for (const row of rows) {
        await updateAppOption(row.id, { is_default: false })
      }
    }

    await addAppOption({
      category: form.category,
      label: name,
      value: normalizeValue(name),
      sort_order: form.sort_order === '' ? 999 : Number(form.sort_order),
      is_active: form.is_active !== false,
      is_default: form.is_default === true,
    })

    resetForm(blankForm(form.category))
    await loadAppOptions()
  }

  async function toggleActive(row) {
    await updateAppOption(row.id, { is_active: !row.is_active })
    await loadAppOptions()
  }

  async function toggleDefault(row) {
    const rows = appOptions?.[row.category] || []

    for (const other of rows) {
      if (other.id !== row.id && other.is_default) {
        await updateAppOption(other.id, { is_default: false })
      }
    }

    await updateAppOption(row.id, { is_default: !row.is_default })
    await loadAppOptions()
  }

  async function updateField(row, field, value) {
    if (field === 'name') {
      await updateAppOption(row.id, {
        label: value,
        value: normalizeValue(value),
      })
      await loadAppOptions()
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

    await loadAppOptions()
  }

  async function addOptimizerProfile() {
    const profileName = String(profileForm.profile_name || '').trim()
    if (!profileName) return

    const profileKey =
      String(profileForm.profile_key || '').trim() || normalizeValue(profileName)

    if (profileForm.is_default) {
      for (const profile of optimizerProfiles.filter((p) => p.is_default)) {
        await supabase
          .from('optimizer_profiles')
          .update({ is_default: false })
          .eq('id', profile.id)
      }
    }

    const inserted = await supabase
      .from('optimizer_profiles')
      .insert({
        profile_name: profileName,
        profile_key: profileKey,
        is_default: profileForm.is_default === true,
        min_positions_per_player: Number(profileForm.min_positions_per_player || 0),
        min_positions_mode: profileForm.min_positions_mode || 'nice',
        min_innings_between_sit_outs: Number(
          profileForm.min_innings_between_sit_outs || 0
        ),
        everyone_sits_before_repeat:
          profileForm.everyone_sits_before_repeat === true,
      })
      .select()
      .single()

    if (inserted.error) {
      alert(inserted.error.message)
      return
    }

    const defaultRules = POSITIONS.map((position, index) => ({
      profile_id: inserted.data.id,
      position,
      fill_rank: index + 1,
      importance: POSITIONS.length - index,
      allow_primary: true,
      allow_secondary: true,
      allow_development: true,
      allow_disallowed: false,
    }))

    const rulesRes = await supabase
      .from('optimizer_profile_position_rules')
      .upsert(defaultRules, { onConflict: 'profile_id,position' })

    if (rulesRes.error) {
      alert(rulesRes.error.message)
      return
    }

    setProfileForm(blankProfileForm())
    setSelectedProfileId(inserted.data.id)
    await refreshAll()
  }

  async function updateOptimizerProfile(profileId, updates) {
    if (!profileId) return

    if (updates.is_default === true) {
      for (const profile of optimizerProfiles.filter(
        (p) => p.id !== profileId && p.is_default
      )) {
        await supabase
          .from('optimizer_profiles')
          .update({ is_default: false })
          .eq('id', profile.id)
      }
    }

    const res = await supabase
      .from('optimizer_profiles')
      .update(updates)
      .eq('id', profileId)

    if (res.error) {
      alert(res.error.message)
      return
    }

    await refreshAll()
  }

  async function copyProfileFrom(sourceProfileId) {
    if (!selectedProfile?.id || !sourceProfileId) return

    const source = optimizerProfiles.find((profile) => profile.id === sourceProfileId)
    if (!source) return

    const confirmed = window.confirm(
      `Copy rules and settings from "${source.profile_name}" into "${selectedProfile.profile_name}"? This will overwrite the current profile settings.`
    )

    if (!confirmed) return

    await updateOptimizerProfile(selectedProfile.id, {
      min_positions_per_player: source.min_positions_per_player,
      min_positions_mode: source.min_positions_mode,
      min_innings_between_sit_outs: source.min_innings_between_sit_outs,
      everyone_sits_before_repeat: source.everyone_sits_before_repeat,
    })

    const sourceRules = optimizerProfileRules?.[sourceProfileId] || {}

    const rows = POSITIONS.map((position) => {
      const rule = sourceRules[position] || blankRule(position)

      return {
        profile_id: selectedProfile.id,
        position,
        fill_rank: Number(rule.fill_rank || 99),
        importance: Number(rule.importance || 1),
        allow_primary: rule.allow_primary === true,
        allow_secondary: rule.allow_secondary === true,
        allow_development: rule.allow_development === true,
        allow_disallowed: rule.allow_disallowed === true,
      }
    })

    const res = await supabase
      .from('optimizer_profile_position_rules')
      .upsert(rows, { onConflict: 'profile_id,position' })

    if (res.error) {
      alert(res.error.message)
      return
    }

    await refreshAll()
  }

  async function updateProfileRule(position, field, value) {
    if (!selectedProfile?.id) return

    const existing = selectedRules?.[position] || blankRule(position)

    const next = {
      profile_id: selectedProfile.id,
      position,
      fill_rank: Number(existing.fill_rank || 99),
      importance: Number(existing.importance || 1),
      allow_primary: existing.allow_primary !== false,
      allow_secondary: existing.allow_secondary !== false,
      allow_development: existing.allow_development !== false,
      allow_disallowed: existing.allow_disallowed === true,
      [field]:
        field === 'fill_rank' || field === 'importance'
          ? value === ''
            ? 0
            : Number(value)
          : value,
    }

    const res = await supabase
      .from('optimizer_profile_position_rules')
      .upsert(next, { onConflict: 'profile_id,position' })

    if (res.error) {
      alert(res.error.message)
      return
    }

    await refreshAll()
  }

  function renderSection(title, rows, form, setForm, itemLabel) {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>{title}</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.6fr 120px 120px 120px auto',
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
            <label>Default</label>
            <select
              value={form.is_default ? 'yes' : 'no'}
              onChange={(e) =>
                setForm((s) => ({ ...s, is_default: e.target.value === 'yes' }))
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <button onClick={() => submitForm(form, setForm)}>Add</button>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-center" style={{ minWidth: 760 }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left' }}>Name</th>
                <th>Sort</th>
                <th>Active</th>
                <th>Default</th>
                <th>Toggle Active</th>
                <th>Toggle Default</th>
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
                      onChange={(e) =>
                        updateField(row, 'sort_order', e.target.value)
                      }
                      style={{ width: 80 }}
                    />
                  </td>
                  <td>{row.is_active ? 'Yes' : 'No'}</td>
                  <td>{row.is_default ? 'Yes' : 'No'}</td>
                  <td>
                    <button onClick={() => toggleActive(row)}>
                      {row.is_active ? 'Disable' : 'Enable'}
                    </button>
                  </td>
                  <td>
                    <button onClick={() => toggleDefault(row)}>
                      {row.is_default ? 'Clear Default' : 'Make Default'}
                    </button>
                  </td>
                </tr>
              ))}

              {!rows.length && (
                <tr>
                  <td colSpan="6">No options yet.</td>
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
              Manage reusable lists and optimizer logic profiles.
            </div>
          </div>

          <button onClick={refreshAll}>Refresh Admin Data</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Optimizer Profiles</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr 110px 120px 130px 150px auto',
            gap: 12,
            alignItems: 'end',
            marginBottom: 18,
          }}
        >
          <div>
            <label>Profile Name</label>
            <input
              value={profileForm.profile_name}
              onChange={(e) =>
                setProfileForm((s) => ({ ...s, profile_name: e.target.value }))
              }
              placeholder="Balanced Competitive"
            />
          </div>

          <div>
            <label>Profile Key</label>
            <input
              value={profileForm.profile_key}
              onChange={(e) =>
                setProfileForm((s) => ({ ...s, profile_key: e.target.value }))
              }
              placeholder="auto if blank"
            />
          </div>

          <div>
            <label>Default</label>
            <select
              value={profileForm.is_default ? 'yes' : 'no'}
              onChange={(e) =>
                setProfileForm((s) => ({
                  ...s,
                  is_default: e.target.value === 'yes',
                }))
              }
            >
              <option value="no">No</option>
              <option value="yes">Yes</option>
            </select>
          </div>

          <div>
            <label>Min Pos</label>
            <input
              type="number"
              value={profileForm.min_positions_per_player}
              onChange={(e) =>
                setProfileForm((s) => ({
                  ...s,
                  min_positions_per_player: e.target.value,
                }))
              }
            />
          </div>

          <div>
            <label>Min Pos Mode</label>
            <select
              value={profileForm.min_positions_mode}
              onChange={(e) =>
                setProfileForm((s) => ({
                  ...s,
                  min_positions_mode: e.target.value,
                }))
              }
            >
              <option value="off">Off</option>
              <option value="nice">Nice</option>
              <option value="must">Must</option>
            </select>
          </div>

          <div>
            <label>Sit Gap</label>
            <input
              type="number"
              value={profileForm.min_innings_between_sit_outs}
              onChange={(e) =>
                setProfileForm((s) => ({
                  ...s,
                  min_innings_between_sit_outs: e.target.value,
                }))
              }
            />
          </div>

          <button onClick={addOptimizerProfile}>Add Profile</button>
        </div>

        <div style={{ marginBottom: 18 }}>
          <label>Select Profile to Edit</label>
          <select
            value={selectedProfile?.id || ''}
            onChange={(e) => setSelectedProfileId(e.target.value)}
          >
            <option value="">Select profile</option>
            {optimizerProfiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.profile_name}
                {profile.is_default ? ' (Default)' : ''}
              </option>
            ))}
          </select>
        </div>

        {selectedProfile && (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.4fr 1fr 120px 120px 130px 150px 180px',
                gap: 12,
                alignItems: 'end',
                marginBottom: 18,
              }}
            >
              <div>
                <label>Name</label>
                <input
                  value={selectedProfile.profile_name || ''}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      profile_name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <label>Key</label>
                <input
                  value={selectedProfile.profile_key || ''}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      profile_key: normalizeValue(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <label>Default</label>
                <select
                  value={selectedProfile.is_default ? 'yes' : 'no'}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      is_default: e.target.value === 'yes',
                    })
                  }
                >
                  <option value="no">No</option>
                  <option value="yes">Yes</option>
                </select>
              </div>

              <div>
                <label>Min Pos</label>
                <input
                  type="number"
                  value={selectedProfile.min_positions_per_player ?? 0}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      min_positions_per_player: Number(e.target.value || 0),
                    })
                  }
                />
              </div>

              <div>
                <label>Mode</label>
                <select
                  value={selectedProfile.min_positions_mode || 'nice'}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      min_positions_mode: e.target.value,
                    })
                  }
                >
                  <option value="off">Off</option>
                  <option value="nice">Nice</option>
                  <option value="must">Must</option>
                </select>
              </div>

              <div>
                <label>Sit Gap</label>
                <input
                  type="number"
                  value={selectedProfile.min_innings_between_sit_outs ?? 2}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      min_innings_between_sit_outs: Number(e.target.value || 0),
                    })
                  }
                />
              </div>

              <div>
                <label>Everyone Sits First</label>
                <select
                  value={selectedProfile.everyone_sits_before_repeat ? 'yes' : 'no'}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      everyone_sits_before_repeat: e.target.value === 'yes',
                    })
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label>Copy From Another Profile</label>
              <select
                value=""
                onChange={(e) => copyProfileFrom(e.target.value)}
              >
                <option value="">Choose profile to copy from</option>
                {optimizerProfiles
                  .filter((profile) => profile.id !== selectedProfile.id)
                  .map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.profile_name}
                    </option>
                  ))}
              </select>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table className="table-center" style={{ minWidth: 980 }}>
                <thead>
                  <tr>
                    <th>Position</th>
                    <th>Fill Rank</th>
                    <th>Importance</th>
                    <th>Allow A / Primary</th>
                    <th>Allow B / Secondary</th>
                    <th>Allow C-D / Development</th>
                    <th>Allow E / No</th>
                  </tr>
                </thead>

                <tbody>
                  {POSITIONS.map((position) => {
                    const rule = selectedRules[position] || blankRule(position)

                    return (
                      <tr key={position}>
                        <td>
                          <strong>{position}</strong>
                        </td>

                        <td>
                          <input
                            type="number"
                            value={rule.fill_rank ?? 99}
                            onChange={(e) =>
                              updateProfileRule(position, 'fill_rank', e.target.value)
                            }
                            style={{ width: 90 }}
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            value={rule.importance ?? 1}
                            onChange={(e) =>
                              updateProfileRule(position, 'importance', e.target.value)
                            }
                            style={{ width: 90 }}
                          />
                        </td>

                        <td>
                          <input
                            type="checkbox"
                            checked={rule.allow_primary !== false}
                            onChange={(e) =>
                              updateProfileRule(
                                position,
                                'allow_primary',
                                e.target.checked
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="checkbox"
                            checked={rule.allow_secondary !== false}
                            onChange={(e) =>
                              updateProfileRule(
                                position,
                                'allow_secondary',
                                e.target.checked
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="checkbox"
                            checked={rule.allow_development !== false}
                            onChange={(e) =>
                              updateProfileRule(
                                position,
                                'allow_development',
                                e.target.checked
                              )
                            }
                          />
                        </td>

                        <td>
                          <input
                            type="checkbox"
                            checked={rule.allow_disallowed === true}
                            onChange={(e) =>
                              updateProfileRule(
                                position,
                                'allow_disallowed',
                                e.target.checked
                              )
                            }
                          />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {renderSection('Season Options', seasonRows, seasonForm, setSeasonForm, 'season')}
      {renderSection('Game Type Options', gameTypeRows, gameTypeForm, setGameTypeForm, 'game type')}
      {renderSection('Game Status Options', statusRows, statusForm, setStatusForm, 'status')}
    </div>
  )
}
