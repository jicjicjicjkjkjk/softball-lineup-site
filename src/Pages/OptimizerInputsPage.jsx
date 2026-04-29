import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TEAM_ID } from '../lib/constants'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

const FILL_ORDER_OPTIONS = [
  { value: 1, label: '1 - Fill First' },
  { value: 2, label: '2 - Very Early' },
  { value: 3, label: '3 - Early' },
  { value: 4, label: '4 - Middle' },
  { value: 5, label: '5 - Later' },
  { value: 6, label: '6 - Last' },
  { value: 99, label: 'Ignore / No Priority' },
]

const IMPORTANCE_OPTIONS = [
  { value: 10, label: 'Very High - protect strongly' },
  { value: 7, label: 'High' },
  { value: 5, label: 'Medium' },
  { value: 3, label: 'Low' },
  { value: 1, label: 'Very Low' },
]

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

function normalizeRule(rule, position) {
  const base = blankRule(position)
  return {
    ...base,
    ...(rule || {}),
    fill_rank: Number(rule?.fill_rank ?? base.fill_rank),
    importance: Number(rule?.importance ?? base.importance),
    allow_primary: rule?.allow_primary !== false,
    allow_secondary: rule?.allow_secondary !== false,
    allow_development: rule?.allow_development !== false,
    allow_disallowed: rule?.allow_disallowed === true,
  }
}

export default function OptimizerInputsPage({
  optimizerProfiles = [],
  optimizerProfileRules = {},
  reloadAllData,
  setAppError,
}) {
  const [mode, setMode] = useState('edit')
  const [profileForm, setProfileForm] = useState(blankProfileForm())
  const [selectedProfileId, setSelectedProfileId] = useState(
    optimizerProfiles?.[0]?.id || ''
  )
  const [copySourceId, setCopySourceId] = useState('')
  const [draftProfile, setDraftProfile] = useState(null)
  const [draftRules, setDraftRules] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  const selectedProfile =
    optimizerProfiles.find((profile) => profile.id === selectedProfileId) ||
    optimizerProfiles[0] ||
    null

  const otherProfiles = useMemo(
    () => optimizerProfiles.filter((profile) => profile.id !== selectedProfile?.id),
    [optimizerProfiles, selectedProfile]
  )

  useEffect(() => {
    if (!selectedProfile) {
      setDraftProfile(null)
      setDraftRules({})
      return
    }

    setDraftProfile({ ...selectedProfile })

    const sourceRules = optimizerProfileRules?.[selectedProfile.id] || {}
    const nextRules = {}

    POSITIONS.forEach((position) => {
      nextRules[position] = normalizeRule(sourceRules[position], position)
    })

    setDraftRules(nextRules)
    setDirty(false)
  }, [selectedProfileId, optimizerProfiles, optimizerProfileRules])

  async function refreshAll() {
    if (typeof reloadAllData === 'function') await reloadAllData()
  }

  function reportError(error) {
    const message = error?.message || String(error || 'Something went wrong.')
    if (setAppError) setAppError(message)
    else alert(message)
  }

  function updateDraftProfile(field, value) {
    setDraftProfile((current) => ({
      ...current,
      [field]: value,
    }))
    setDirty(true)
  }

  function updateDraftRule(position, field, value) {
    setDraftRules((current) => ({
      ...current,
      [position]: {
        ...normalizeRule(current[position], position),
        [field]: value,
      },
    }))
    setDirty(true)
  }

  async function createStrategy() {
    const profileName = String(profileForm.profile_name || '').trim()
    if (!profileName) {
      alert('Add a strategy name first.')
      return
    }

    setSaving(true)

    if (profileForm.is_default) {
      for (const profile of optimizerProfiles.filter((p) => p.is_default)) {
        const clearRes = await supabase
          .from('optimizer_profiles')
          .update({ is_default: false })
          .eq('id', profile.id)

        if (clearRes.error) {
          setSaving(false)
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
        profile_key: normalizeValue(profileName),
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
      setSaving(false)
      reportError(inserted.error)
      return
    }

    const defaultRules = POSITIONS.map((position, index) => ({
      profile_id: inserted.data.id,
      position,
      fill_rank: index + 1,
      importance: Math.max(10 - index, 1),
      allow_primary: true,
      allow_secondary: true,
      allow_development: true,
      allow_disallowed: false,
    }))

    const rulesRes = await supabase
      .from('optimizer_profile_position_rules')
      .upsert(defaultRules, { onConflict: 'profile_id,position' })

    if (rulesRes.error) {
      setSaving(false)
      reportError(rulesRes.error)
      return
    }

    setProfileForm(blankProfileForm())
    setSelectedProfileId(inserted.data.id)
    setMode('edit')
    setSaving(false)
    await refreshAll()
  }

  async function saveStrategyChanges() {
    if (!draftProfile?.id) return

    setSaving(true)

    if (draftProfile.is_default === true) {
      for (const profile of optimizerProfiles.filter(
        (p) => p.id !== draftProfile.id && p.is_default
      )) {
        const clearRes = await supabase
          .from('optimizer_profiles')
          .update({ is_default: false })
          .eq('id', profile.id)

        if (clearRes.error) {
          setSaving(false)
          reportError(clearRes.error)
          return
        }
      }
    }

    const profileRes = await supabase
      .from('optimizer_profiles')
      .update({
        profile_name: draftProfile.profile_name || '',
        profile_key: normalizeValue(draftProfile.profile_name || ''),
        is_default: draftProfile.is_default === true,
        min_positions_per_player: Number(draftProfile.min_positions_per_player || 0),
        min_positions_mode: draftProfile.min_positions_mode || 'nice',
        min_innings_between_sitouts: Number(
          draftProfile.min_innings_between_sitouts || 0
        ),
        sit_all_before_second: draftProfile.sit_all_before_second === true,
      })
      .eq('id', draftProfile.id)

    if (profileRes.error) {
      setSaving(false)
      reportError(profileRes.error)
      return
    }

    const ruleRows = POSITIONS.map((position) => {
      const rule = normalizeRule(draftRules[position], position)

      return {
        profile_id: draftProfile.id,
        position,
        fill_rank: Number(rule.fill_rank || 99),
        importance: Number(rule.importance || 1),
        allow_primary: rule.allow_primary === true,
        allow_secondary: rule.allow_secondary === true,
        allow_development: rule.allow_development === true,
        allow_disallowed: rule.allow_disallowed === true,
      }
    })

    const rulesRes = await supabase
      .from('optimizer_profile_position_rules')
      .upsert(ruleRows, { onConflict: 'profile_id,position' })

    if (rulesRes.error) {
      setSaving(false)
      reportError(rulesRes.error)
      return
    }

    setDirty(false)
    setSaving(false)
    await refreshAll()
  }

  async function deleteStrategy() {
    if (!selectedProfile?.id) return

    const confirmed = window.confirm(
      `Delete "${selectedProfile.profile_name}"? This cannot be undone.`
    )

    if (!confirmed) return

    const confirmedAgain = window.confirm(
      'Are you absolutely sure? This will delete the strategy and its position rules.'
    )

    if (!confirmedAgain) return

    setSaving(true)

    const rulesDelete = await supabase
      .from('optimizer_profile_position_rules')
      .delete()
      .eq('profile_id', selectedProfile.id)

    if (rulesDelete.error) {
      setSaving(false)
      reportError(rulesDelete.error)
      return
    }

    const profileDelete = await supabase
      .from('optimizer_profiles')
      .delete()
      .eq('id', selectedProfile.id)

    if (profileDelete.error) {
      setSaving(false)
      reportError(profileDelete.error)
      return
    }

    setSelectedProfileId('')
    setDraftProfile(null)
    setDraftRules({})
    setDirty(false)
    setSaving(false)
    await refreshAll()
  }

  async function copyProfileFrom() {
    if (!selectedProfile?.id || !copySourceId) return

    const source = optimizerProfiles.find((profile) => profile.id === copySourceId)
    if (!source) return

    const confirmed = window.confirm(
      `Copy all optimizer inputs from "${source.profile_name}" into "${selectedProfile.profile_name}"? This will overwrite the current local draft. You still must click Save Changes after copying.`
    )

    if (!confirmed) return

    const sourceRules = optimizerProfileRules?.[source.id] || {}
    const nextRules = {}

    POSITIONS.forEach((position) => {
      nextRules[position] = normalizeRule(sourceRules[position], position)
    })

    setDraftProfile((current) => ({
      ...current,
      min_positions_per_player: source.min_positions_per_player,
      min_positions_mode: source.min_positions_mode,
      min_innings_between_sitouts: source.min_innings_between_sitouts,
      sit_all_before_second: source.sit_all_before_second,
    }))

    setDraftRules(nextRules)
    setCopySourceId('')
    setDirty(true)
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between wrap-row">
          <div>
            <h2 style={{ marginBottom: 8 }}>Optimizer Inputs</h2>
            <div className="small-note">
              These are the if/then rules the solver uses when building lineups.
            </div>
          </div>

          <button onClick={refreshAll}>Refresh Data</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>What do you want to do?</h3>

        <div className="row-between wrap-row" style={{ gap: 12, justifyContent: 'flex-start' }}>
          <button
            type="button"
            onClick={() => setMode('create')}
            style={{ opacity: mode === 'create' ? 1 : 0.75 }}
          >
            Add / Create Strategy
          </button>

          <button
            type="button"
            onClick={() => setMode('edit')}
            style={{ opacity: mode === 'edit' ? 1 : 0.75 }}
          >
            Edit Existing Strategy
          </button>
        </div>
      </div>

      {mode === 'create' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add / Create Strategy</h3>
          <div className="small-note" style={{ marginBottom: 16 }}>
            Create a new solver strategy first. After it is created, edit its detailed position rules below.
          </div>

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
              <div className="small-note">If yes, this becomes the automatic strategy.</div>
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
              <div className="small-note">If possible, try to give each player this many different positions.</div>
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
              <div className="small-note">If Nice, try to honor it. If Must, enforce it harder.</div>
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
              <div className="small-note">If possible, keep this many innings between sit-outs for the same player.</div>
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
              <div className="small-note">If yes, do not give a second sit-out until everyone has sat once.</div>
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

          <button onClick={createStrategy} disabled={saving}>
            {saving ? 'Creating...' : 'Create Strategy'}
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Edit Existing Strategy</h3>

            <label>Select Strategy</label>
            <div className="small-note">
              Choose which solver strategy you want to edit.
            </div>

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

            {draftProfile && (
              <>
                <div
                  className="card"
                  style={{
                    marginTop: 18,
                    background: dirty ? '#fff7ed' : '#f8fafc',
                    borderColor: dirty ? '#fed7aa' : '#e5e7eb',
                  }}
                >
                  <strong>{dirty ? 'Unsaved changes' : 'No unsaved changes'}</strong>
                  <div className="small-note">
                    Changes on this page are local until you click Save Changes.
                  </div>

                  <div className="row-between wrap-row" style={{ marginTop: 12 }}>
                    <button onClick={saveStrategyChanges} disabled={!dirty || saving}>
                      {saving ? 'Saving...' : 'Save Changes'}
                    </button>

                    <button type="button" onClick={deleteStrategy} disabled={saving}>
                      Delete Strategy
                    </button>
                  </div>
                </div>

                <div className="grid-2" style={{ marginTop: 18 }}>
                  <div>
                    <label>Strategy Name</label>
                    <div className="small-note">If changed, this is what appears in optimizer strategy dropdowns.</div>
                    <input
                      value={draftProfile.profile_name || ''}
                      onChange={(e) => updateDraftProfile('profile_name', e.target.value)}
                    />
                  </div>

                  <div>
                    <label>Default Strategy</label>
                    <div className="small-note">If yes, this strategy is used unless another is selected.</div>
                    <select
                      value={draftProfile.is_default ? 'yes' : 'no'}
                      onChange={(e) =>
                        updateDraftProfile('is_default', e.target.value === 'yes')
                      }
                    >
                      <option value="no">No</option>
                      <option value="yes">Yes</option>
                    </select>
                  </div>

                  <div>
                    <label>Minimum Positions per Player</label>
                    <div className="small-note">If possible, each player gets this many different defensive spots.</div>
                    <input
                      type="number"
                      value={draftProfile.min_positions_per_player ?? 0}
                      onChange={(e) =>
                        updateDraftProfile(
                          'min_positions_per_player',
                          Number(e.target.value || 0)
                        )
                      }
                    />
                  </div>

                  <div>
                    <label>Position Rule Mode</label>
                    <div className="small-note">If Nice, flexible. If Must, force position variety harder.</div>
                    <select
                      value={draftProfile.min_positions_mode || 'nice'}
                      onChange={(e) =>
                        updateDraftProfile('min_positions_mode', e.target.value)
                      }
                    >
                      <option value="off">Off</option>
                      <option value="nice">Nice</option>
                      <option value="must">Must</option>
                    </select>
                  </div>

                  <div>
                    <label>Sit Gap</label>
                    <div className="small-note">If possible, leave this many innings between sit-outs.</div>
                    <input
                      type="number"
                      value={draftProfile.min_innings_between_sitouts ?? 2}
                      onChange={(e) =>
                        updateDraftProfile(
                          'min_innings_between_sitouts',
                          Number(e.target.value || 0)
                        )
                      }
                    />
                  </div>

                  <div>
                    <label>Everyone Sits Once First</label>
                    <div className="small-note">If yes, balance sit-outs before repeat sit-outs.</div>
                    <select
                      value={draftProfile.sit_all_before_second ? 'yes' : 'no'}
                      onChange={(e) =>
                        updateDraftProfile(
                          'sit_all_before_second',
                          e.target.value === 'yes'
                        )
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
                    Choose a source strategy, then click Copy Settings. This updates your local draft only.
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

          {draftProfile && (
            <div className="card">
              <h3 style={{ marginTop: 0 }}>Position Rules</h3>
              <div className="small-note" style={{ marginBottom: 12 }}>
                If a player is marked Primary / Non-Primary / No on the Positioning Priority page,
                these columns tell the solver whether that player can be used at that position.
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table-center" style={{ minWidth: 900 }}>
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
                      const rule = normalizeRule(draftRules[position], position)

                      return (
                        <tr key={position}>
                          <td>
                            <strong>{position}</strong>
                          </td>

                          <td>
                            <select
                              value={rule.fill_rank}
                              onChange={(e) =>
                                updateDraftRule(position, 'fill_rank', Number(e.target.value))
                              }
                            >
                              {FILL_ORDER_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <select
                              value={rule.importance}
                              onChange={(e) =>
                                updateDraftRule(position, 'importance', Number(e.target.value))
                              }
                            >
                              {IMPORTANCE_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                          </td>

                          <td>
                            <input
                              type="checkbox"
                              checked={rule.allow_primary !== false}
                              onChange={(e) =>
                                updateDraftRule(position, 'allow_primary', e.target.checked)
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
                                updateDraftRule(position, 'allow_secondary', e.target.checked)
                                updateDraftRule(position, 'allow_development', e.target.checked)
                              }}
                            />
                          </td>

                          <td>
                            <input
                              type="checkbox"
                              checked={rule.allow_disallowed === true}
                              onChange={(e) =>
                                updateDraftRule(position, 'allow_disallowed', e.target.checked)
                              }
                            />
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              <button
                onClick={saveStrategyChanges}
                disabled={!dirty || saving}
                style={{ marginTop: 16 }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
