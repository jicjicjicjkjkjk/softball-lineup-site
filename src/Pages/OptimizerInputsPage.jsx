import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { TEAM_ID } from '../lib/constants'

const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF']

const FILL_ORDER_OPTIONS = [
  { value: 1, label: '1 - Core first' },
  { value: 2, label: '2 - High priority' },
  { value: 3, label: '3 - Normal' },
  { value: 4, label: '4 - Lower priority' },
  { value: 5, label: '5 - Fill late' },
  { value: 99, label: 'Only if needed' },
]

const IMPORTANCE_OPTIONS = [
  { value: 10, label: 'Critical' },
  { value: 7, label: 'Important' },
  { value: 5, label: 'Normal' },
  { value: 3, label: 'Flexible' },
  { value: 1, label: 'Least important' },
]

const CONSECUTIVE_OPTIONS = [
  { value: 'none', label: 'No preference' },
  { value: 'prefer', label: 'Prefer same spot' },
  { value: 'must_2', label: 'Must 2+ if possible' },
]

const MIN_POSITION_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8, 9]
const SIT_GAP_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7]

function normalizeValue(text = '') {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, '_')
}

function blankProfileForm() {
  return {
    profile_name: '',
    description: '',
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
    consecutive_mode: ['P', 'C'].includes(position) ? 'must_2' : 'prefer',
    allow_primary: true,
    allow_secondary: true,
    allow_development: true,
  }
}

function normalizeRule(rule, position) {
  const base = blankRule(position)
  return {
    ...base,
    ...(rule || {}),
    fill_rank: Number(rule?.fill_rank ?? base.fill_rank),
    importance: Number(rule?.importance ?? base.importance),
    consecutive_mode: rule?.consecutive_mode || base.consecutive_mode,
    allow_primary: rule?.allow_primary !== false,
    allow_secondary: rule?.allow_secondary !== false,
    allow_development: rule?.allow_development !== false,
  }
}

function SortArrow({ active, direction }) {
  if (!active) return <span style={{ opacity: 0.35 }}> ↕</span>
  return <span>{direction === 'asc' ? ' ↑' : ' ↓'}</span>
}

export default function OptimizerInputsPage({
  optimizerProfiles = [],
  optimizerProfileRules = {},
  reloadAllData,
  setAppError,
}) {
  const [mode, setMode] = useState('edit')
  const [profileForm, setProfileForm] = useState(blankProfileForm())
  const [selectedProfileId, setSelectedProfileId] = useState(optimizerProfiles?.[0]?.id || '')
  const [copySourceId, setCopySourceId] = useState('')
  const [draftProfile, setDraftProfile] = useState(null)
  const [draftRules, setDraftRules] = useState({})
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [positionSort, setPositionSort] = useState({ key: 'position', direction: 'asc' })

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

  const sortedRules = useMemo(() => {
    return POSITIONS.map((position) => ({
      ...normalizeRule(draftRules[position], position),
      position,
    })).sort((a, b) => {
      const key = positionSort.key
      const direction = positionSort.direction

      let aVal = a[key]
      let bVal = b[key]

      if (key === 'position') {
        aVal = POSITIONS.indexOf(a.position)
        bVal = POSITIONS.indexOf(b.position)
      }

      if (aVal < bVal) return direction === 'asc' ? -1 : 1
      if (aVal > bVal) return direction === 'asc' ? 1 : -1
      return POSITIONS.indexOf(a.position) - POSITIONS.indexOf(b.position)
    })
  }, [draftRules, positionSort])

  function setSort(key) {
    setPositionSort((current) => ({
      key,
      direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  async function refreshAll() {
    if (typeof reloadAllData === 'function') await reloadAllData()
  }

  function reportError(error) {
    const message = error?.message || String(error || 'Something went wrong.')
    if (setAppError) setAppError(message)
    else alert(message)
  }

  function updateDraftProfile(field, value) {
    setDraftProfile((current) => ({ ...current, [field]: value }))
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
        description: profileForm.description || '',
        is_default: profileForm.is_default === true,
        min_positions_per_player: Number(profileForm.min_positions_per_player || 0),
        min_positions_mode: profileForm.min_positions_mode || 'nice',
        min_innings_between_sitouts: Number(profileForm.min_innings_between_sitouts || 0),
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
      emergency_rank: index + 1,
      importance: Math.max(10 - index, 1),
      consecutive_mode: ['P', 'C'].includes(position) ? 'must_2' : 'prefer',
      allow_primary: true,
      allow_secondary: true,
      allow_development: true,
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
        description: draftProfile.description || '',
        is_default: draftProfile.is_default === true,
        min_positions_per_player: Number(draftProfile.min_positions_per_player || 0),
        min_positions_mode: draftProfile.min_positions_mode || 'nice',
        min_innings_between_sitouts: Number(draftProfile.min_innings_between_sitouts || 0),
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
        emergency_rank: Number(rule.fill_rank || 99),
        importance: Number(rule.importance || 1),
        consecutive_mode: rule.consecutive_mode || 'prefer',
        allow_primary: rule.allow_primary === true,
        allow_secondary: rule.allow_secondary === true,
        allow_development: rule.allow_development === true,
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
      `Copy all optimizer inputs from "${source.profile_name}" into "${selectedProfile.profile_name}"? This updates your local draft only. You still must click Save Changes.`
    )

    if (!confirmed) return

    const sourceRules = optimizerProfileRules?.[source.id] || {}
    const nextRules = {}

    POSITIONS.forEach((position) => {
      nextRules[position] = normalizeRule(sourceRules[position], position)
    })

    setDraftProfile((current) => ({
      ...current,
      description: source.description || '',
      min_positions_per_player: source.min_positions_per_player,
      min_positions_mode: source.min_positions_mode,
      min_innings_between_sitouts: source.min_innings_between_sitouts,
      sit_all_before_second: source.sit_all_before_second,
    }))

    setDraftRules(nextRules)
    setCopySourceId('')
    setDirty(true)
  }

  function renderOptimizerLogicReference() {
    return (
      <div className="card">
        <h3 style={{ marginTop: 0 }}>Optimizer Logic Reference</h3>
        <div className="small-note" style={{ marginBottom: 12 }}>
          Current optimizer logic mapped to the website inputs and pages.
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table className="table-center" style={{ minWidth: 900, fontSize: 13 }}>
            <thead>
              <tr>
                <th>Step</th>
                <th>Rule / Constraint</th>
                <th>Where You Control It</th>
                <th>How the Website Uses It</th>
              </tr>
            </thead>
            <tbody>
              <tr><td>1</td><td>Respect locks first</td><td>Game grid locks</td><td>Locked values are not cleared or moved.</td></tr>
              <tr><td>2</td><td>Respect availability and injuries</td><td>Availability checkboxes + Injury</td><td>Unavailable or injured players are excluded.</td></tr>
              <tr><td>3</td><td>Choose required sit-outs</td><td>Automatic</td><td>Available players minus 9 fielding spots.</td></tr>
              <tr><td>4</td><td>Apply sit-out rules</td><td>Everyone Sits Once First, Sit Gap, manual targets</td><td>Balances sit-outs and spacing.</td></tr>
              <tr><td>5</td><td>Fill positions in order</td><td>When to Fill</td><td>Earlier positions are solved first.</td></tr>
              <tr><td>6</td><td>Score players by fit</td><td>Allowed Positions + Primary/Non-Primary/Avoid</td><td>Controls who can play each spot.</td></tr>
              <tr><td>7</td><td>Apply Protect weighting</td><td>Protect</td><td>Higher values protect important positions.</td></tr>
              <tr><td>8</td><td>Prefer consecutive positioning</td><td>Consecutive</td><td>Encourages back-to-back innings.</td></tr>
              <tr><td>9</td><td>Enforce consecutive minimum</td><td>Must 2+ if possible</td><td>Applies to any marked position.</td></tr>
              <tr><td>10</td><td>Apply position variety</td><td>Minimum Positions + Variety Mode</td><td>Tries to give players different positions.</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    )
  }
  
  function renderStrategyFields(source, updateFn) {
    return (
      <div className="grid-2" style={{ marginTop: 18 }}>
        <div>
          <label>1. Strategy Name</label>
          <input
            value={source.profile_name || ''}
            onChange={(e) => updateFn('profile_name', e.target.value)}
            placeholder="Balanced"
          />
        </div>

        <div>
          <label>2. Strategy Description</label>
          <input
            value={source.description || ''}
            onChange={(e) => updateFn('description', e.target.value)}
            placeholder="Balanced lineups with fair positions and sit-outs."
          />
        </div>

        <div>
          <label>3. Default Strategy</label>
          <select
            value={source.is_default ? 'yes' : 'no'}
            onChange={(e) => updateFn('is_default', e.target.value === 'yes')}
          >
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </div>

        <div>
          <label>4. Everyone Sits Once First</label>
          <select
            value={source.sit_all_before_second ? 'yes' : 'no'}
            onChange={(e) => updateFn('sit_all_before_second', e.target.value === 'yes')}
          >
            <option value="yes">Yes - balance sit-outs first</option>
            <option value="no">No - allow repeat sit-outs</option>
          </select>
        </div>

        <div>
          <label>5. Sit Gap</label>
          <select
            value={Number(source.min_innings_between_sitouts ?? 2)}
            onChange={(e) => updateFn('min_innings_between_sitouts', Number(e.target.value))}
          >
            {SIT_GAP_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} inning{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>6. Minimum Positions per Player</label>
          <select
            value={Number(source.min_positions_per_player ?? 2)}
            onChange={(e) => updateFn('min_positions_per_player', Number(e.target.value))}
          >
            {MIN_POSITION_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} position{n === 1 ? '' : 's'}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>7. Position Variety Mode</label>
          <select
            value={source.min_positions_mode || 'nice'}
            onChange={(e) => updateFn('min_positions_mode', e.target.value)}
          >
            <option value="off">Off - ignore position variety</option>
            <option value="nice">Nice - try when possible</option>
            <option value="must">Must - enforce harder</option>
          </select>
        </div>
      </div>
    )
  }

  return (
    <div className="stack">
      <div className="card">
        <div className="row-between wrap-row">
          <div>
            <h2 style={{ marginBottom: 8 }}>Optimizer Inputs</h2>
            <div className="small-note">
              Explanation of the order of operations and constraints included below.
            </div>
          </div>

          <button onClick={refreshAll}>Refresh Data</button>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>What do you want to do?</h3>
        <div className="row-between wrap-row" style={{ gap: 12, justifyContent: 'flex-start' }}>
          <button type="button" onClick={() => setMode('create')}>
            Add / Create Strategy
          </button>
          <button type="button" onClick={() => setMode('edit')}>
            Edit Existing Strategy
          </button>
        </div>
      </div>

      {mode === 'create' && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add / Create Strategy</h3>

          {renderStrategyFields(profileForm, (field, value) =>
            setProfileForm((s) => ({ ...s, [field]: value }))
          )}

          <button onClick={createStrategy} disabled={saving} style={{ marginTop: 16 }}>
            {saving ? 'Creating...' : 'Create Strategy'}
          </button>
        </div>
      )}

      {mode === 'edit' && (
        <>
          <div className="card">
            <h3 style={{ marginTop: 0 }}>Edit Existing Strategy</h3>

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
                    Changes are local until you click Save Changes.
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

                {renderStrategyFields(draftProfile, updateDraftProfile)}

                <div style={{ marginTop: 18 }}>
                  <label>Copy From Another Strategy</label>
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
                            <div className="small-note" style={{ marginBottom: 12, lineHeight: 1.5 }}>
                <strong>When to Fill:</strong> which positions get solved first. P/C/SS usually go earlier.
                <br />
                <strong>Protect:</strong> how strongly the optimizer saves better-fit players for that position.
                <br />
                <strong>Consecutive:</strong> whether the optimizer should keep a player at that position for back-to-back innings.
                <br />
                <strong>Primary / Non-Primary / Avoid:</strong> controls which player fit levels are allowed at that position.
              </div>

              <div style={{ overflowX: 'auto' }}>
                <table className="table-center" style={{ minWidth: 720, fontSize: 13 }}>
                  <thead>
                    <tr>
                      <th onClick={() => setSort('position')} style={{ cursor: 'pointer' }}>
                        Pos
                        <SortArrow active={positionSort.key === 'position'} direction={positionSort.direction} />
                      </th>
                      <th onClick={() => setSort('fill_rank')} style={{ cursor: 'pointer' }}>
                        When to Fill
                        <SortArrow active={positionSort.key === 'fill_rank'} direction={positionSort.direction} />
                      </th>
                      <th onClick={() => setSort('importance')} style={{ cursor: 'pointer' }}>
                        Protect
                        <SortArrow active={positionSort.key === 'importance'} direction={positionSort.direction} />
                      </th>
                      <th>Consecutive</th>
                      <th>Primary</th>
                      <th>Non-Primary</th>
                      <th>Avoid</th>
                    </tr>
                  </thead>

                  <tbody>
                    {sortedRules.map((rule) => {
                      const position = rule.position

                      return (
                        <tr key={position}>
                          <td><strong>{position}</strong></td>

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
                            <select
                              value={rule.consecutive_mode || 'prefer'}
                              onChange={(e) =>
                                updateDraftRule(position, 'consecutive_mode', e.target.value)
                              }
                            >
                              {CONSECUTIVE_OPTIONS.map((option) => (
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
                              checked={
                                rule.allow_primary === false &&
                                rule.allow_secondary === false &&
                                rule.allow_development === false
                              }
                              onChange={(e) => {
                                const checked = e.target.checked
                                updateDraftRule(position, 'allow_primary', !checked)
                                updateDraftRule(position, 'allow_secondary', !checked)
                                updateDraftRule(position, 'allow_development', !checked)
                              }}
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

      {renderOptimizerLogicReference()}
    </div>
  )
}
