import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function byOrder(a, b) {
  return Number(a.sort_order || 0) - Number(b.sort_order || 0)
}

function shortLabel(label = '') {
  const map = {
    Fastball: 'FB',
    Changeup: 'CH',
    Drop: 'DROP',
    Curve: 'CURVE',
    Screw: 'SCREW',
    Ball: 'Ball',
    'Called Strike': 'Called',
    'Swing & Miss': 'Whiff',
    Foul: 'Foul',
    'In Play': 'In Play',
    Strikeout: 'K',
    Walk: 'BB',
    'Weak Hit': 'Weak Hit',
    'Big Hit': 'Big Hit',
  }

  return map[label] || label
}

const ZONES = [
  { number: 4, label: 'High Outside', className: 'zone-4' },
  { number: 3, label: 'High Inside', className: 'zone-3' },
  { number: 5, label: 'Middle', className: 'zone-5' },
  { number: 2, label: 'Low Outside', className: 'zone-2' },
  { number: 1, label: 'Low Inside', className: 'zone-1' },
]

function initials(name = '') {
  return String(name)
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
}

export default function PitchCallingPage({ games = [], players = [], setAppError }) {
  const [options, setOptions] = useState([])
  const [pitchers, setPitchers] = useState([])
  const [pitchPrefs, setPitchPrefs] = useState([])
  const [pitchGame, setPitchGame] = useState(null)

  const [selectedGameId, setSelectedGameId] = useState('')
  const [pitcherId, setPitcherId] = useState('')
  const [batters, setBatters] = useState([])
  const [currentSpot, setCurrentSpot] = useState(1)

  const [calledPitchId, setCalledPitchId] = useState('')
  const [intendedLocationId, setIntendedLocationId] = useState('')
  const [actualLocationId, setActualLocationId] = useState('')
  const [pitchResultId, setPitchResultId] = useState('')
  const [atBatResultId, setAtBatResultId] = useState('')
  const [coachNote, setCoachNote] = useState('')

  const [history, setHistory] = useState([])
  const [showLineup, setShowLineup] = useState(false)
  const [editingEventId, setEditingEventId] = useState('')

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => {
      const orderA = Number(a.game_order || 0)
      const orderB = Number(b.game_order || 0)
      if (orderA !== orderB) return orderB - orderA

      const dateA = new Date(a.game_date || a.date || 0).getTime()
      const dateB = new Date(b.game_date || b.date || 0).getTime()
      return dateB - dateA
    })
  }, [games])

  const pitcherRows = useMemo(() => {
    return pitchers
      .filter((p) => p.is_active === true)
      .map((pitcher) => {
        const player = players.find((p) => String(p.id) === String(pitcher.player_id))
        return { ...pitcher, player }
      })
      .filter((row) => row.player)
      .sort((a, b) => (a.player.name || '').localeCompare(b.player.name || ''))
  }, [pitchers, players])

  const selectedPitcherRow = pitcherRows.find((row) => String(row.player_id) === String(pitcherId))

  const locations = options
    .filter((o) => o.category === 'pitch_location' && o.is_active !== false)
    .sort(byOrder)

  const pitchResults = options
    .filter((o) => o.category === 'pitch_result' && o.is_active !== false)
    .sort(byOrder)

  const atBatResults = options
    .filter((o) => o.category === 'at_bat_result' && o.is_active !== false)
    .sort(byOrder)

  const pitchTypes = useMemo(() => {
    const allPitchTypes = options
      .filter((o) => o.category === 'pitch_type' && o.is_active !== false)
      .sort(byOrder)

    if (!selectedPitcherRow) return allPitchTypes

    return allPitchTypes
      .map((pitch) => {
        const pref = pitchPrefs.find(
          (p) =>
            String(p.pitcher_id) === String(selectedPitcherRow.id) &&
            String(p.pitch_option_id) === String(pitch.id) &&
            p.is_active === true
        )

        if (!pref) return null

        return {
          ...pitch,
          pitcher_order: Number(pref.preference_order || 999),
        }
      })
      .filter(Boolean)
      .sort((a, b) => Number(a.pitcher_order || 999) - Number(b.pitcher_order || 999))
  }, [options, pitchPrefs, selectedPitcherRow])

  const currentBatter = batters.find((b) => Number(b.batting_order) === Number(currentSpot))
  const maxSpot = Math.max(1, ...batters.map((b) => Number(b.batting_order || 1)))

  const batterHistory = history.filter((event) => String(event.batter_id) === String(currentBatter?.id))
  const lastBatterEvent = batterHistory[0]
  const lastEvent = history[0]

  useEffect(() => {
    loadSetup()
  }, [])

  useEffect(() => {
    if (pitchGame?.id) loadHistory()
  }, [pitchGame?.id])

  async function loadSetup() {
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

  function labelFor(id) {
    return options.find((o) => String(o.id) === String(id))?.label || ''
  }

  function pitcherTagFor(event) {
    const row = pitcherRows.find((p) => String(p.player_id) === String(event?.pitcher_id))
    if (!row?.player) return ''
    return `${initials(row.player.name)}${row.display_number || row.player.jersey_number || row.player.number || ''}`
  }

  function optionIdForLabel(label) {
    return locations.find((loc) => String(loc.label || '').toLowerCase() === label.toLowerCase())?.id || ''
  }

  function eventSummary(event) {
    if (!event) return 'No pitches yet'

    const tag = pitcherTagFor(event)
    const tagText = tag ? `${tag}: ` : ''

    if (event.event_type === 'catcher_other') {
      const result = shortLabel(labelFor(event.pitch_result_id) || labelFor(event.at_bat_result_id))
      return `${tagText}Catcher / Other${result ? ` / ${result}` : ''}`
    }

    if (event.event_type === 'missed' || event.skipped_reason === 'missed') {
      return `${tagText}Missed`
    }

    const parts = [
      shortLabel(labelFor(event.pitch_option_id)),
      shortLabel(labelFor(event.intended_location_id)),
      shortLabel(labelFor(event.pitch_result_id)),
      labelFor(event.at_bat_result_id) ? `Final: ${shortLabel(labelFor(event.at_bat_result_id))}` : '',
    ].filter(Boolean)

    return `${tagText}${parts.join(' / ') || 'Tracked pitch'}`
  }

  function buildBlankBatters() {
    return Array.from({ length: 12 }, (_, index) => ({
      batting_order: index + 1,
      player_number: '',
      batter_name: '',
      quick_note: '',
    }))
  }

  async function startPitchGame() {
    const linkedGame = games.find((g) => String(g.id) === String(selectedGameId))

    const res = await supabase
      .from('pitch_call_games')
      .insert({
        game_id: selectedGameId || null,
        opponent_name: linkedGame?.opponent || linkedGame?.opponent_name || 'Opponent',
        pitcher_id: null,
        current_batter_order: 1,
      })
      .select('*')
      .single()

    if (res.error) return setAppError(res.error.message)

    const batterRes = await supabase
      .from('pitch_call_batters')
      .insert(buildBlankBatters().map((b) => ({ ...b, pitch_call_game_id: res.data.id })))
      .select('*')

    if (batterRes.error) return setAppError(batterRes.error.message)

    setPitchGame(res.data)
    setBatters(batterRes.data || [])
    setCurrentSpot(1)
  }

  async function updateLivePitcher(nextPitcherId) {
    setPitcherId(nextPitcherId)
    resetEntry()

    if (!pitchGame?.id) return

    const res = await supabase
      .from('pitch_call_games')
      .update({ pitcher_id: nextPitcherId || null })
      .eq('id', pitchGame.id)

    if (res.error) setAppError(res.error.message)
  }

  async function updateBatter(id, field, value) {
    setBatters((current) => current.map((b) => (b.id === id ? { ...b, [field]: value } : b)))

    const res = await supabase.from('pitch_call_batters').update({ [field]: value }).eq('id', id)
    if (res.error) setAppError(res.error.message)
  }

  async function addBatter() {
    if (!pitchGame?.id) return

    const nextOrder = maxSpot + 1

    const res = await supabase
      .from('pitch_call_batters')
      .insert({
        pitch_call_game_id: pitchGame.id,
        batting_order: nextOrder,
        player_number: '',
        batter_name: '',
        quick_note: '',
      })
      .select('*')
      .single()

    if (res.error) return setAppError(res.error.message)

    setBatters((current) => [...current, res.data].sort((a, b) => Number(a.batting_order) - Number(b.batting_order)))
    setCurrentSpot(nextOrder)
  }

  async function removeLastBatter() {
    if (!batters.length) return

    const last = [...batters].sort((a, b) => Number(b.batting_order) - Number(a.batting_order))[0]
    if (!last?.id) return

    const res = await supabase.from('pitch_call_batters').delete().eq('id', last.id)
    if (res.error) return setAppError(res.error.message)

    setBatters((current) => current.filter((b) => b.id !== last.id))
    if (currentSpot >= Number(last.batting_order)) setCurrentSpot(Math.max(1, Number(last.batting_order) - 1))
  }

  async function loadHistory() {
    const res = await supabase
      .from('pitch_call_events')
      .select('*')
      .eq('pitch_call_game_id', pitchGame.id)
      .order('created_at', { ascending: false })

    if (res.error) return setAppError(res.error.message)
    setHistory(res.data || [])
  }

  function resetEntry() {
    setCalledPitchId('')
    setIntendedLocationId('')
    setActualLocationId('')
    setPitchResultId('')
    setAtBatResultId('')
    setCoachNote('')
    setEditingEventId('')
  }

  function loadEventForEdit(event) {
    setEditingEventId(event.id)
    setCalledPitchId(event.pitch_option_id || '')
    setIntendedLocationId(event.intended_location_id || '')
    setActualLocationId(event.actual_location_id || '')
    setPitchResultId(event.pitch_result_id || '')
    setAtBatResultId(event.at_bat_result_id || '')
    setCoachNote(event.coach_note || '')
  }

  async function saveEvent({ eventType = 'tracked', advance = false } = {}) {
    if (!pitchGame?.id || !currentBatter?.id) return

    const isCatcherOther = eventType === 'catcher_other'

    const payload = {
      pitch_call_game_id: pitchGame.id,
      batter_id: currentBatter.id,
      pitcher_id: pitcherId || null,
      pitch_option_id: isCatcherOther ? null : calledPitchId || null,
      intended_location_id: isCatcherOther ? null : intendedLocationId || null,
      actual_location_id: isCatcherOther ? null : actualLocationId || null,
      pitch_result_id: pitchResultId || null,
      at_bat_result_id: atBatResultId || null,
      coach_note: coachNote || null,
      skipped: false,
      skipped_reason: null,
      event_type: eventType,
      batter_order_snapshot: currentSpot,
    }

    let savedEvent = null

    if (editingEventId) {
      const res = await supabase
        .from('pitch_call_events')
        .update(payload)
        .eq('id', editingEventId)
        .select('*')
        .single()

      if (res.error) return setAppError(res.error.message)
      savedEvent = res.data
    } else {
      const res = await supabase.from('pitch_call_events').insert(payload).select('*').single()
      if (res.error) return setAppError(res.error.message)
      savedEvent = res.data
    }

    resetEntry()

    const historyRes = await supabase
      .from('pitch_call_events')
      .select('*')
      .eq('pitch_call_game_id', pitchGame.id)
      .order('created_at', { ascending: false })

    if (historyRes.error) return setAppError(historyRes.error.message)
    setHistory(historyRes.data || [])

    if (advance) {
      goNext()
    }

    return savedEvent
  }

  async function undoLast() {
    if (!lastEvent?.id) return

    const targetSpot = Number(lastEvent.batter_order_snapshot || currentSpot)

    const res = await supabase.from('pitch_call_events').delete().eq('id', lastEvent.id)
    if (res.error) return setAppError(res.error.message)

    setCurrentSpot(targetSpot)
    await loadHistory()
  }

  function goNext() {
    resetEntry()
    setCurrentSpot((current) => (current >= maxSpot ? 1 : current + 1))
  }

  function goPrevious() {
    resetEntry()
    setCurrentSpot((current) => (current <= 1 ? maxSpot : current - 1))
  }

  function PickButton({ item, selectedId, setSelectedId }) {
    const active = String(selectedId) === String(item.id)

    return (
      <button
        type="button"
        className={`pitch-app-btn ${active ? 'is-selected' : ''}`}
        onClick={() => setSelectedId(active ? '' : item.id)}
      >
        <strong>{shortLabel(item.label)}</strong>
        {item.label !== shortLabel(item.label) && <span>{item.label}</span>}
      </button>
    )
  }

  function LocationMap({ title, selectedId, setSelectedId }) {
    return (
      <div className="pitch-location-map-wrap">
        {title && <p className="pitch-map-help">{title}</p>}

        <div className="pitch-location-map">
          {ZONES.map((zone) => {
            const optionId = optionIdForLabel(zone.label)
            const active = String(selectedId) === String(optionId)

            return (
              <button
                key={zone.number}
                type="button"
                className={`pitch-map-zone ${zone.className} ${active ? 'is-selected' : ''}`}
                onClick={() => {
                  if (!optionId) {
                    setAppError(`Missing location option: ${zone.label}`)
                    return
                  }

                  setSelectedId(active ? '' : optionId)
                }}
              >
                <strong>{zone.number}</strong>
                <span>{zone.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  if (!pitchGame) {
    return (
      <div className="pitch-app-page">
        <div className="page-header">
          <div>
            <h1>Pitch Calling</h1>
            <p>Quick coach pitch-call tracker.</p>
          </div>
        </div>

        <div className="card">
          <h2>Start Pitch Tracking</h2>

          <label>
            Load Game
            <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
              <option value="">No linked game</option>

              {sortedGames.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.game_date || game.date} — {game.opponent || game.opponent_name || 'Opponent'}
                </option>
              ))}
            </select>
          </label>

          <button type="button" onClick={startPitchGame}>
            Start
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pitch-app-page">
      <div className="pitch-app-header">
        <div>
          <strong>{pitchGame.opponent_name || 'Opponent'}</strong>

          <label className="pitch-header-select-label">
            Pitcher:
            <select
              className="pitch-header-select"
              value={pitcherId}
              onChange={(e) => updateLivePitcher(e.target.value)}
            >
              <option value="">Select</option>
              {pitcherRows.map((row) => (
                <option key={row.id} value={row.player_id}>
                  #{row.display_number || row.player.jersey_number || row.player.number || ''} {row.player.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <button type="button" onClick={() => setShowLineup((v) => !v)}>
          Lineup
        </button>
      </div>

      <div className="pitch-app-grid">
        <div className="pitch-app-left">
          <div className="card pitch-batter-panel">
            <div className="pitch-batter-title-row">
              <div>
                <h2>
                  Batter {currentSpot}
                  {currentBatter?.player_number ? ` #${currentBatter.player_number}` : ''}
                  {currentBatter?.batter_name ? ` ${currentBatter.batter_name}` : ''}
                </h2>

                <p>
                  <strong>Note:</strong> {currentBatter?.quick_note || 'No note yet.'}
                </p>
              </div>

              <div className="pitch-nav-mini">
                <button type="button" onClick={goPrevious}>Prev</button>
                <button type="button" onClick={goNext}>Next</button>
              </div>
            </div>

            <div className="pitch-info-block">
              <small>LAST RESULT</small>
              <div>{eventSummary(lastBatterEvent)}</div>
            </div>

            <div className="pitch-info-block">
              <div className="row-between wrap-row">
                <small>THIS BATTER HISTORY</small>
                {editingEventId && <button type="button" onClick={resetEntry}>Go Current</button>}
              </div>

              <div className="pitch-pill-row">
                {batterHistory.length ? (
                  batterHistory.slice(0, 8).map((event, index) => (
                    <button
                      key={event.id || index}
                      type="button"
                      className={`pitch-pill pitch-pill-button ${editingEventId === event.id ? 'is-editing' : ''}`}
                      onClick={() => loadEventForEdit(event)}
                    >
                      {batterHistory.length - index}. {eventSummary(event)}
                    </button>
                  ))
                ) : (
                  <span className="pitch-muted">No pitches yet</span>
                )}
              </div>
            </div>
          </div>

          <div className="card pitch-call-panel">
            {editingEventId && (
              <div className="pitch-editing-banner">
                Editing saved pitch — tap Save Pitch to update, or Go Current to cancel.
              </div>
            )}

            <h3>1. Pitch Type</h3>
            <div className="pitch-app-button-grid">
              {pitchTypes.map((pitch) => (
                <PickButton key={pitch.id} item={pitch} selectedId={calledPitchId} setSelectedId={setCalledPitchId} />
              ))}
            </div>

            <h3>2. Called Location</h3>
            <LocationMap title="Tap one of the 5 zones." selectedId={intendedLocationId} setSelectedId={setIntendedLocationId} />

            <h3>3. Pitch Result</h3>
            <div className="pitch-app-button-grid tight">
              {pitchResults.map((result) => (
                <PickButton key={result.id} item={result} selectedId={pitchResultId} setSelectedId={setPitchResultId} />
              ))}
            </div>

            <h3>4. Final Result</h3>
            <div className="pitch-app-button-grid tight">
              {atBatResults.map((result) => (
                <PickButton key={result.id} item={result} selectedId={atBatResultId} setSelectedId={setAtBatResultId} />
              ))}
            </div>

            <details className="pitch-details">
              <summary>Optional: Actual Location + Coach Note</summary>

              <h3>Actual Location</h3>
              <LocationMap title="Tap where the pitch actually went." selectedId={actualLocationId} setSelectedId={setActualLocationId} />

              <label>
                Coach Note
                <input value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="Late on FB, chased outside, etc." />
              </label>
            </details>
          </div>
        </div>

        {showLineup && (
          <div className="card pitch-lineup-panel">
            <div className="pitch-lineup-header">
              <h2>Opponent Lineup</h2>
              <button type="button" onClick={() => setShowLineup(false)}>×</button>
            </div>

            <div className="pitch-lineup-actions">
              <button type="button" onClick={addBatter}>+ Add Batter</button>
              <button type="button" onClick={removeLastBatter}>Remove Last</button>
              <button type="button" onClick={() => setShowLineup(false)}>Done</button>
            </div>

            <div className="pitch-lineup-list">
              {batters.map((batter) => {
                const events = history.filter((event) => String(event.batter_id) === String(batter.id))
                const last = events[0]

                return (
                  <div key={batter.id} className={`pitch-lineup-card ${Number(batter.batting_order) === Number(currentSpot) ? 'is-current' : ''}`}>
                    <button
                      type="button"
                      className="pitch-lineup-jump"
                      onClick={() => {
                        setCurrentSpot(Number(batter.batting_order))
                        setShowLineup(false)
                        resetEntry()
                      }}
                    >
                      {batter.batting_order}
                    </button>

                    <div className="pitch-lineup-edit">
                      <div className="pitch-lineup-fields">
                        <input placeholder="#" value={batter.player_number || ''} onChange={(e) => updateBatter(batter.id, 'player_number', e.target.value)} />
                        <input placeholder="Batter name" value={batter.batter_name || ''} onChange={(e) => updateBatter(batter.id, 'batter_name', e.target.value)} />
                      </div>

                      <input placeholder="Note: fast, power hitter, swings early" value={batter.quick_note || ''} onChange={(e) => updateBatter(batter.id, 'quick_note', e.target.value)} />

                      <div className="pitch-lineup-last"><strong>Last:</strong> {eventSummary(last)}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      <div className="pitch-bottom-bar-v2 four-buttons">
        <button type="button" onClick={() => saveEvent({ eventType: 'tracked' })}>
          Save Pitch<span>{editingEventId ? 'Update' : 'Stay'}</span>
        </button>

        <button type="button" onClick={() => saveEvent({ eventType: 'tracked', advance: true })}>
          Save + Next<span>End AB</span>
        </button>

        <button type="button" className="purple" onClick={() => saveEvent({ eventType: 'catcher_other' })}>
          Catcher / Other<span>Stay</span>
        </button>

        <button type="button" className="dark" onClick={undoLast} disabled={!lastEvent}>
          Undo<span>Last</span>
        </button>
      </div>
    </div>
  )
}
