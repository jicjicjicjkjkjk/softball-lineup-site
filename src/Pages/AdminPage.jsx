// FILE: src/Pages/AdminPage.jsx

import { useMemo, useState } from 'react'

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

// 👉 NEW: Optimizer Profile blank
function blankProfileForm() {
  return {
    profile_name: '',
    profile_key: '',
    is_default: false,
  }
}

export default function AdminPage({
  appOptions,
  loadAppOptions,
  addAppOption,
  updateAppOption,

  // 👉 NEW PROPS
  optimizerProfiles,
  optimizerProfileRules,
  setOptimizerProfiles,
  setOptimizerProfileRules,
  supabase,
  TEAM_ID,
}) {
  const [seasonForm, setSeasonForm] = useState(blankForm('season'))
  const [gameTypeForm, setGameTypeForm] = useState(blankForm('game_type'))
  const [statusForm, setStatusForm] = useState(blankForm('status'))

  // 👉 NEW STATE
  const [profileForm, setProfileForm] = useState(blankProfileForm())
  const [selectedProfileId, setSelectedProfileId] = useState('')

  const seasonRows = useMemo(() => appOptions?.season || [], [appOptions])
  const gameTypeRows = useMemo(() => appOptions?.game_type || [], [appOptions])
  const statusRows = useMemo(() => appOptions?.status || [], [appOptions])

  // =========================
  // EXISTING FUNCTIONS (UNCHANGED)
  // =========================

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

  // =========================
  // 🚀 NEW: OPTIMIZER PROFILES
  // =========================

  async function addProfile() {
    if (!profileForm.profile_name) return

    const res = await supabase
      .from('optimizer_profiles')
      .insert({
        team_id: TEAM_ID,
        profile_name: profileForm.profile_name,
        profile_key:
          profileForm.profile_key ||
          normalizeValue(profileForm.profile_name),
        is_default: profileForm.is_default,
      })
      .select()

    if (res.error) return alert(res.error.message)

    setProfileForm(blankProfileForm())
    setOptimizerProfiles(res.data)
  }

  async function setDefaultProfile(profile) {
    for (const p of optimizerProfiles) {
      if (p.id !== profile.id && p.is_default) {
        await supabase
          .from('optimizer_profiles')
          .update({ is_default: false })
          .eq('id', p.id)
      }
    }

    await supabase
      .from('optimizer_profiles')
      .update({ is_default: !profile.is_default })
      .eq('id', profile.id)

    location.reload()
  }

  async function updateRule(profileId, position, field, value) {
    const existing =
      optimizerProfileRules?.[profileId]?.[position] || {}

    const res = await supabase
      .from('optimizer_profile_position_rules')
      .upsert(
        {
          profile_id: profileId,
          position,
          ...existing,
          [field]: Number(value),
        },
        { onConflict: 'profile_id,position' }
      )

    if (res.error) alert(res.error.message)
  }

  const POSITIONS = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF']

  // =========================
  // UI
  // =========================

  return (
    <div className="stack">
      <div className="card">
        <h2>Admin</h2>
      </div>

      {/* =========================
          🔥 OPTIMIZER PROFILES
      ========================= */}
      <div className="card">
        <h3>Optimizer Profiles</h3>

        <div className="row">
          <input
            placeholder="Profile Name"
            value={profileForm.profile_name}
            onChange={(e) =>
              setProfileForm((s) => ({ ...s, profile_name: e.target.value }))
            }
          />
          <button onClick={addProfile}>Add Profile</button>
        </div>

        <table className="table-center">
          <thead>
            <tr>
              <th>Name</th>
              <th>Default</th>
              <th>Set Default</th>
            </tr>
          </thead>
          <tbody>
            {(optimizerProfiles || []).map((p) => (
              <tr key={p.id}>
                <td>{p.profile_name}</td>
                <td>{p.is_default ? 'Yes' : 'No'}</td>
                <td>
                  <button onClick={() => setDefaultProfile(p)}>
                    Make Default
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* =========================
          🎯 PROFILE RULE EDITOR
      ========================= */}
      <div className="card">
        <h3>Profile Rules</h3>

        <select
          value={selectedProfileId}
          onChange={(e) => setSelectedProfileId(e.target.value)}
        >
          <option value="">Select Profile</option>
          {(optimizerProfiles || []).map((p) => (
            <option key={p.id} value={p.id}>
              {p.profile_name}
            </option>
          ))}
        </select>

        {selectedProfileId && (
          <table className="table-center">
            <thead>
              <tr>
                <th>Position</th>
                <th>Min %</th>
                <th>Max %</th>
              </tr>
            </thead>
            <tbody>
              {POSITIONS.map((pos) => {
                const rule =
                  optimizerProfileRules?.[selectedProfileId]?.[pos] || {}

                return (
                  <tr key={pos}>
                    <td>{pos}</td>
                    <td>
                      <input
                        type="number"
                        value={rule.min_pct || ''}
                        onChange={(e) =>
                          updateRule(
                            selectedProfileId,
                            pos,
                            'min_pct',
                            e.target.value
                          )
                        }
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        value={rule.max_pct || ''}
                        onChange={(e) =>
                          updateRule(
                            selectedProfileId,
                            pos,
                            'max_pct',
                            e.target.value
                          )
                        }
                      />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* =========================
          EXISTING SECTIONS (UNCHANGED)
      ========================= */}

      {/* KEEP your Season / Game Type / Status sections EXACTLY as before */}

    </div>
  )
}
