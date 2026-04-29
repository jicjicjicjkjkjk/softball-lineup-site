import { useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TEAM_ID } from '../lib/constants'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

function normalizeValue(text = '') {
  return String(text || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
}

function blankProfileForm() {
  return {
    profile_name: '',
    is_default: false,
    min_positions_per_player: 2,
    min_positions_mode: 'nice',
    min_innings_between_sitouts: 2,
    sit_all_before_second: true,
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

export default function OptimizerInputsPage({
  optimizerProfiles = [],
  optimizerProfileRules = {},
  reloadAllData,
  setAppError,
}) {
  const [profileForm, setProfileForm] = useState(blankProfileForm())
  const [selectedProfileId, setSelectedProfileId] = useState(
    optimizerProfiles?.[0]?.id || ''
  )
  const [copySourceId, setCopySourceId] = useState('')

  const selectedProfile =
    optimizerProfiles.find((profile) => profile.id === selectedProfileId) ||
    optimizerProfiles[0] ||
    null

  const selectedRules = selectedProfile?.id
    ? optimizerProfileRules?.[selectedProfile.id] || {}
    : {}

  const otherProfiles = useMemo(
    () => optimizerProfiles.filter((profile) => profile.id !== selectedProfile?.id),
    [optimizerProfiles, selectedProfile]
  )

  async function refreshAll() {
    if (typeof reloadAllData === 'function') await reloadAllData()
  }

  function reportError(error) {
    const message = error?.message || String(error || 'Something went wrong.')
    if (setAppError) setAppError(message)
    else alert(message)
  }

  async function addOptimizerProfile() {
    const profileName = String(profileForm.profile_name || '').trim()
    if (!profileName) return

    const profileKey = normalizeValue(profileName)

    if (profileForm.is_default) {
      for (const profile of optimizerProfiles.filter((p) => p.is_default)) {
        const clearRes = await supabase
          .from('optimizer_profiles')
          .update({ is_default: false })
          .eq('id', profile.id)

        if (clearRes.error) {
          reportError(clearRes.error)
          return
        }
      }
    }

    const inserted = await supabase
      .from('optimizer_profiles')
      .insert({
        team_id: TEAM_ID,
        profile_name: profileName,
        profile_key: profileKey,
        is_default: profileForm.is_default === true,
        min_positions_per_player: Number(profileForm.min_positions_per_player || 0),
        min_positions_mode: profileForm.min_positions_mode || 'nice',
        min_innings_between_sitouts: Number(
          profileForm.min_innings_between_sitouts || 0
        ),
        sit_all_before_second: profileForm.sit_all_before_second === true,
      })
      .select()
      .single()

    if (inserted.error) {
      reportError(inserted.error)
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
      reportError(rulesRes.error)
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
        const clearRes = await supabase
          .from('optimizer_profiles')
          .update({ is_default: false })
          .eq('id', profile.id)

        if (clearRes.error) {
          reportError(clearRes.error)
          return
        }
      }
    }

    const res = await supabase
      .from('optimizer_profiles')
      .update(updates)
      .eq('id', profileId)

    if (res.error) {
      reportError(res.error)
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
      reportError(res.error)
      return
    }

    await refreshAll()
  }

  async function copyProfileFrom() {
    if (!selectedProfile?.id || !copySourceId) return

    const source = optimizerProfiles.find((profile) => profile.id === copySourceId)
    if (!source) return

    const confirmed = window.confirm(
      `Copy all optimizer inputs from "${source.profile_name}" into "${selectedProfile.profile_name}"? This will overwrite the current strategy.`
    )

    if (!confirmed) return

    await updateOptimizerProfile(selectedProfile.id, {
      min_positions_per_player: source.min_positions_per_player,
      min_positions_mode: source.min_positions_mode,
      min_innings_between_sitouts: source.min_innings_between_sitouts,
      sit_all_before_second: source.sit_all_before_second,
    })

    const sourceRules = optimizerProfileRules?.[source.id] || {}

    const rows = POSITIONS.map((position) => {
      const rule = sourceRules[position] || blankRule(position)

      return {
        profile_id: selectedProfile.id,
        position,
        fill_rank: Number(rule.fill_rank || 99),
        importance: Number(rule.importance || 1),
        allow_primary: rule.allow_primary !== false,
        allow_secondary: rule.allow_secondary !== false,
        allow_development: rule.allow_development !== false,
        allow_disallowed: rule.allow_disallowed === true,
      }
    })

    const res = await supabase
      .from('optimizer_profile_position_rules')
      .upsert(rows, { onConflict: 'profile_id,position' })

    if (res.error) {
      reportError(res.error)
      return
    }

    setCopySourceId('')
    await refreshAll()
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between wrap-row">
          <div>
            <h2 style={{ marginBottom: 8 }}>Optimizer Inputs</h2>
            <div className="small-note">
              These settings control how the lineup solver makes decisions.
            </div>
          </div>

          <button onClick={refreshAll}>Refresh Data</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Create Strategy</h3>

        <div className="grid-2">
          <div>
            <label>Strategy Name</label>
            <div className="small-note">Example: Balanced, Development, Tournament Strongest.</div>
            <input
              value={profileForm.profile_name}
              onChange={(e) =>
                setProfileForm((s) => ({ ...s, profile_name: e.target.value }))
              }
              placeholder="Balanced"
            />
          </div>

          <div>
            <label>Default Strategy</label>
            <div className="small-note">Used automatically when no strategy is selected.</div>
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
            <label>Minimum Positions per Player</label>
            <div className="small-note">Target number of different positions each player should play.</div>
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
            <label>Position Rule Mode</label>
            <div className="small-note">Nice = try to honor it. Must = enforce harder.</div>
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
            <div className="small-note">Minimum innings between sit-outs for the same player.</div>
            <input
              type="number"
              value={profileForm.min_innings_between_sitouts}
              onChange={(e) =>
                setProfileForm((s) => ({
                  ...s,
                  min_innings_between_sitouts: e.target.value,
                }))
              }
            />
          </div>

          <div>
            <label>Everyone Sits Once First</label>
            <div className="small-note">Prevents a second sit-out before everyone has sat once.</div>
            <select
              value={profileForm.sit_all_before_second ? 'yes' : 'no'}
              onChange={(e) =>
                setProfileForm((s) => ({
                  ...s,
                  sit_all_before_second: e.target.value === 'yes',
                }))
              }
            >
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </div>
        </div>

        <button onClick={addOptimizerProfile}>Create Strategy</button>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Edit Strategy</h3>

        <label>Select Strategy</label>
        <select
          value={selectedProfile?.id || ''}
          onChange={(e) => setSelectedProfileId(e.target.value)}
        >
          <option value="">Select strategy</option>
          {optimizerProfiles.map((profile) => (
            <option key={profile.id} value={profile.id}>
              {profile.profile_name}
              {profile.is_default ? ' (Default)' : ''}
            </option>
          ))}
        </select>

        {selectedProfile && (
          <>
            <div className="grid-2" style={{ marginTop: 18 }}>
              <div>
                <label>Strategy Name</label>
                <div className="small-note">Name shown when choosing optimizer logic.</div>
                <input
                  value={selectedProfile.profile_name || ''}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      profile_name: e.target.value,
                      profile_key: normalizeValue(e.target.value),
                    })
                  }
                />
              </div>

              <div>
                <label>Default Strategy</label>
                <div className="small-note">Only one strategy should be default.</div>
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
                <label>Minimum Positions per Player</label>
                <div className="small-note">Target number of different defensive spots.</div>
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
                <label>Position Rule Mode</label>
                <div className="small-note">Controls how hard the optimizer follows position variety.</div>
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
                <div className="small-note">Minimum innings between sit-outs.</div>
                <input
                  type="number"
                  value={selectedProfile.min_innings_between_sitouts ?? 2}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      min_innings_between_sitouts: Number(e.target.value || 0),
                    })
                  }
                />
              </div>

              <div>
                <label>Everyone Sits Once First</label>
                <div className="small-note">Balances sit-outs before repeat sit-outs.</div>
                <select
                  value={selectedProfile.sit_all_before_second ? 'yes' : 'no'}
                  onChange={(e) =>
                    updateOptimizerProfile(selectedProfile.id, {
                      sit_all_before_second: e.target.value === 'yes',
                    })
                  }
                >
                  <option value="yes">Yes</option>
                  <option value="no">No</option>
                </select>
              </div>
            </div>

            <div style={{ marginTop: 18 }}>
              <label>Copy From Another Strategy</label>
              <div className="small-note">
                Choose a strategy, then click the button. You will be asked to confirm before anything is overwritten.
              </div>

              <div className="row-between wrap-row" style={{ gap: 12 }}>
                <select value={copySourceId} onChange={(e) => setCopySourceId(e.target.value)}>
                  <option value="">Choose strategy to copy from</option>
                  {otherProfiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.profile_name}
                    </option>
                  ))}
                </select>

                <button type="button" onClick={copyProfileFrom} disabled={!copySourceId}>
                  Copy Settings
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {selectedProfile && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Position Rules</h3>
          <div className="small-note" style={{ marginBottom: 12 }}>
            These settings work together with the Positioning Priority page.
            Primary means the player is marked Primary for that position.
            Non-Primary means the player is allowed but not primary.
            No means the player is normally not allowed there.
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="table-center" style={{ minWidth: 860 }}>
              <thead>
                <tr>
                  <th>Position</th>
                  <th>Fill Order</th>
                  <th>Importance</th>
                  <th>Primary</th>
                  <th>Non-Primary</th>
                  <th>No</th>
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
                        <div className="small-note">Lower = earlier</div>
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
                        <div className="small-note">Higher = protect more</div>
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={rule.allow_primary !== false}
                          onChange={(e) =>
                            updateProfileRule(position, 'allow_primary', e.target.checked)
                          }
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={
                            rule.allow_secondary !== false ||
                            rule.allow_development !== false
                          }
                          onChange={(e) => {
                            updateProfileRule(position, 'allow_secondary', e.target.checked)
                            updateProfileRule(position, 'allow_development', e.target.checked)
                          }}
                        />
                      </td>

                      <td>
                        <input
                          type="checkbox"
                          checked={rule.allow_disallowed === true}
                          onChange={(e) =>
                            updateProfileRule(position, 'allow_disallowed', e.target.checked)
                          }
                        />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
