import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'

function byOrder(a, b) {
  return Number(a.sort_order || 0) - Number(b.sort_order || 0)
}

function displayLabel(option) {
  return option?.short_label || option?.label || ''
}

const ZONES = [
  { number: 4, label: 'High Outside', className: 'zone-4' },
  { number: 3, label: 'High Inside', className: 'zone-3' },
  { number: 5, label: 'Middle', className: 'zone-5' },
  { number: 2, label: 'Low Outside', className: 'zone-2' },
  { number: 1, label: 'Low Inside', className: 'zone-1' },
]

const ACTUAL_ZONES = [
  { number: 4, label: 'High Outside', className: 'zone-4' },
  { number: 3, label: 'High Inside', className: 'zone-3' },
  { number: 5, label: 'Middle', className: 'zone-5' },
  { number: 2, label: 'Low Outside', className: 'zone-2' },
  { number: 1, label: 'Low Inside', className: 'zone-1' },
  { number: 'H', label: 'High', className: 'zone-extra' },
  { number: 'WO', label: 'Way Outside', className: 'zone-extra' },
  { number: 'WI', label: 'Way Inside', className: 'zone-extra' },
  { number: 'D', label: 'Dirt', className: 'zone-extra' },
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
  const [currentInning, setCurrentInning] = useState(1)

  const [calledPitchId, setCalledPitchId] = useState('')
  const [intendedLocationId, setIntendedLocationId] = useState('')
  const [actualLocationId, setActualLocationId] = useState('')
  const [pitchResultId, setPitchResultId] = useState('')
  const [atBatResultId, setAtBatResultId] = useState('')
  const [coachNote, setCoachNote] = useState('')

  const [history, setHistory] = useState([])
  const [showLineup, setShowLineup] = useState(false)
  const [showBatterHistory, setShowBatterHistory] = useState(false)
  const [editingEventId, setEditingEventId] = useState('')

  const lineupRef = useRef(null)
  
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

  const locations = options.filter((o) => o.category === 'pitch_location' && o.is_active !== false).sort(byOrder)
  const pitchResults = options.filter((o) => o.category === 'pitch_result' && o.is_active !== false).sort(byOrder)
  const atBatResults = options.filter((o) => o.category === 'at_bat_result' && o.is_active !== false).sort(byOrder)

  const pitchTypes = useMemo(() => {
    const allPitchTypes = options.filter((o) => o.category === 'pitch_type' && o.is_active !== false).sort(byOrder)

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

        return { ...pitch, pitcher_order: Number(pref.preference_order || 999) }
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
    if (pitchGame?.id) loadHistory(pitchGame.id)
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

  function optionFor(id) {
    return options.find((o) => String(o.id) === String(id))
  }

  function labelFor(id) {
    return displayLabel(optionFor(id))
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
    const inningText = event.inning_number ? `Inn ${event.inning_number} · ` : ''

    if (event.event_type === 'catcher_other') {
      const result = labelFor(event.pitch_result_id) || labelFor(event.at_bat_result_id)
      return `${inningText}${tagText}Catcher / Other${result ? ` / ${result}` : ''}`
    }

    const parts = [
      labelFor(event.pitch_option_id),
      labelFor(event.intended_location_id),
      labelFor(event.pitch_result_id),
      event.actual_location_id ? `Actual: ${labelFor(event.actual_location_id)}` : '',
      labelFor(event.at_bat_result_id) ? `Final: ${labelFor(event.at_bat_result_id)}` : '',
    ].filter(Boolean)

    return `${inningText}${tagText}${parts.join(' / ') || 'Tracked pitch'}`
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

    if (selectedGameId) {
      const existingRes = await supabase
        .from('pitch_call_games')
        .select('*')
        .eq('game_id', selectedGameId)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (existingRes.error) return setAppError(existingRes.error.message)

      if (existingRes.data) {
        await loadPitchGame(existingRes.data)
        return
      }
    }

    const res = await supabase
      .from('pitch_call_games')
      .insert({
        game_id: selectedGameId || null,
        opponent_name: linkedGame?.opponent || linkedGame?.opponent_name || 'Opponent',
        pitcher_id: null,
        current_batter_order: 1,
        current_inning: 1,
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
    setPitcherId(res.data.pitcher_id || '')
    setBatters((batterRes.data || []).sort((a, b) => Number(a.batting_order) - Number(b.batting_order)))
    setCurrentSpot(1)
    setCurrentInning(1)
    await loadHistory(res.data.id)
  }

  async function loadPitchGame(gameRow) {
    const batterRes = await supabase
      .from('pitch_call_batters')
      .select('*')
      .eq('pitch_call_game_id', gameRow.id)
      .order('batting_order', { ascending: true })

    if (batterRes.error) return setAppError(batterRes.error.message)

    let loadedBatters = batterRes.data || []

    if (!loadedBatters.length) {
      const createBatters = await supabase
        .from('pitch_call_batters')
        .insert(buildBlankBatters().map((b) => ({ ...b, pitch_call_game_id: gameRow.id })))
        .select('*')

      if (createBatters.error) return setAppError(createBatters.error.message)
      loadedBatters = createBatters.data || []
    }

    setPitchGame(gameRow)
    setPitcherId(gameRow.pitcher_id || '')
    setBatters(loadedBatters.sort((a, b) => Number(a.batting_order) - Number(b.batting_order)))
    setCurrentSpot(Number(gameRow.current_batter_order || 1))
    setCurrentInning(Number(gameRow.current_inning || 1))
    await loadHistory(gameRow.id)
  }

  async function clearGame() {
    if (!selectedGameId) return setAppError('Select a linked game first.')
    if (!window.confirm('Clear all pitch calling data for this game and start over?')) return

    const existingRes = await supabase
      .from('pitch_call_games')
      .select('id')
      .eq('game_id', selectedGameId)

    if (existingRes.error) return setAppError(existingRes.error.message)

    const ids = (existingRes.data || []).map((row) => row.id)
    if (!ids.length) return

    await supabase.from('pitch_call_events').delete().in('pitch_call_game_id', ids)
    await supabase.from('pitch_call_batters').delete().in('pitch_call_game_id', ids)
    const gameRes = await supabase.from('pitch_call_games').delete().in('id', ids)

    if (gameRes.error) return setAppError(gameRes.error.message)
    setAppError('Pitch calling data cleared for this game.')
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

  async function updateCurrentInning(nextInning) {
    const clean = Math.max(1, Number(nextInning || 1))
    setCurrentInning(clean)

    if (!pitchGame?.id) return

    const res = await supabase.from('pitch_call_games').update({ current_inning: clean }).eq('id', pitchGame.id)

    if (res.error) setAppError(res.error.message)
  }

  async function saveCurrentSpot(nextSpot) {
    setCurrentSpot(nextSpot)

    if (!pitchGame?.id) return

    const res = await supabase
      .from('pitch_call_games')
      .update({ current_batter_order: nextSpot })
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
    saveCurrentSpot(nextOrder)
  }

  async function clearBatter(batterId) {
    if (!batterId) return
    if (!window.confirm('Clear pitch history for this batter?')) return

    const res = await supabase.from('pitch_call_events').delete().eq('batter_id', batterId)

    if (res.error) return setAppError(res.error.message)
    await loadHistory()
  }

  async function removeLastBatter() {
    if (!batters.length) return

    const last = [...batters].sort((a, b) => Number(b.batting_order) - Number(a.batting_order))[0]
    if (!last?.id) return
    if (!window.confirm(`Remove batter ${last.batting_order}?`)) return

    await supabase.from('pitch_call_events').delete().eq('batter_id', last.id)
    const res = await supabase.from('pitch_call_batters').delete().eq('id', last.id)

    if (res.error) return setAppError(res.error.message)

    setBatters((current) => current.filter((b) => b.id !== last.id))
    if (currentSpot >= Number(last.batting_order)) saveCurrentSpot(Math.max(1, Number(last.batting_order) - 1))
    await loadHistory()
  }

  async function loadHistory(pitchGameId = pitchGame?.id) {
    if (!pitchGameId) return

    const res = await supabase
      .from('pitch_call_events')
      .select('*')
      .eq('pitch_call_game_id', pitchGameId)
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
    setCurrentInning(Number(event.inning_number || currentInning || 1))
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
      actual_location_id: actualLocationId || null,
      pitch_result_id: pitchResultId || null,
      at_bat_result_id: atBatResultId || null,
      coach_note: coachNote || null,
      skipped: false,
      skipped_reason: null,
      event_type: eventType,
      batter_order_snapshot: currentSpot,
      inning_number: currentInning,
    }

    if (editingEventId) {
      const res = await supabase
        .from('pitch_call_events')
        .update(payload)
        .eq('id', editingEventId)
        .select('*')
        .single()

      if (res.error) return setAppError(res.error.message)
    } else {
      const res = await supabase.from('pitch_call_events').insert(payload).select('*').single()
      if (res.error) return setAppError(res.error.message)
    }

    resetEntry()
    await loadHistory()

    if (advance) goNext()
  }

  async function undoLast() {
    if (!lastEvent?.id) return

    const targetSpot = Number(lastEvent.batter_order_snapshot || currentSpot)
    const targetInning = Number(lastEvent.inning_number || currentInning || 1)

    const res = await supabase.from('pitch_call_events').delete().eq('id', lastEvent.id)
    if (res.error) return setAppError(res.error.message)

    setCurrentInning(targetInning)
    saveCurrentSpot(targetSpot)
    await loadHistory()
  }

  function goNext() {
    resetEntry()
    const nextSpot = currentSpot >= maxSpot ? 1 : currentSpot + 1
    saveCurrentSpot(nextSpot)
  }

  function goPrevious() {
    resetEntry()
    const nextSpot = currentSpot <= 1 ? maxSpot : currentSpot - 1
    saveCurrentSpot(nextSpot)
  }

function goCurrentBatter() {
  const spot = Number(lastEvent?.batter_order_snapshot || pitchGame?.current_batter_order || currentSpot || 1)
  const inning = Number(lastEvent?.inning_number || pitchGame?.current_inning || currentInning || 1)

  setCurrentInning(inning)
  saveCurrentSpot(spot)
  resetEntry()
}

  function PickButton({ item, selectedId, setSelectedId }) {
    const active = String(selectedId) === String(item.id)

    return (
      <button
        type="button"
        className={`pitch-app-btn ${active ? 'is-selected' : ''}`}
        onClick={() => setSelectedId(active ? '' : item.id)}
      >
        <strong>{displayLabel(item)}</strong>
        {item.label !== displayLabel(item) && <span>{item.label}</span>}
      </button>
    )
  }

  function LocationMap({ title, selectedId, setSelectedId, actual = false }) {
  const zonesToUse = actual ? ACTUAL_ZONES : ZONES

  return (
    <div className={`pitch-location-map-wrap ${actual ? 'actual-map' : 'called-map'}`}>
      {title && <p className="pitch-map-help">{title}</p>}

      <div className={actual ? 'pitch-actual-map' : 'pitch-location-map'}>
        {zonesToUse.map((zone) => {
          const optionId = optionIdForLabel(zone.label)
          const active = String(selectedId) === String(optionId)

          return (
            <button
              key={`${zone.label}-${zone.number}`}
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

          <div className="row gap wrap-row" style={{ marginTop: 12 }}>
            <button type="button" onClick={startPitchGame}>Start / Resume</button>
            <button type="button" onClick={clearGame} disabled={!selectedGameId}>Clear Game</button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pitch-app-page">
                  <div className="pitch-app-header compact pitch-game-ribbon">
        <div className="pitch-header-main">
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

        <div className="pitch-inning-stepper">
          <span>Inn {currentInning}</span>
          <button type="button" onClick={() => updateCurrentInning(Number(currentInning) - 1)}>−</button>
          <button type="button" onClick={() => updateCurrentInning(Number(currentInning) + 1)}>+</button>
        </div>
      </div>

            <div className="pitch-app-grid">
        <div className="pitch-app-left">
          <div className="card pitch-batter-panel compact">
            <div className="pitch-batter-title-row">
              <div>
                <h2>
                  Batter {currentSpot}
                  {currentBatter?.player_number ? ` #${currentBatter.player_number}` : ''}
                  {currentBatter?.batter_name ? ` ${currentBatter.batter_name}` : ''}
                </h2>

                <p><strong>Note:</strong> {currentBatter?.quick_note || 'No note yet.'}</p>
              </div>

              <div className="pitch-nav-mini">
                <button type="button" onClick={goPrevious}>Prev</button>
                <button type="button" onClick={goNext}>Next</button>
              </div>
            </div>

            <details className="pitch-history-details" open={showBatterHistory} onToggle={(e) => setShowBatterHistory(e.currentTarget.open)}>
              <summary>
                History
                <span>{eventSummary(lastBatterEvent)}</span>
              </summary>

              <div className="pitch-pill-row">
                {batterHistory.length ? (
                  batterHistory.slice(0, 10).map((event, index) => (
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

              {editingEventId && <button type="button" onClick={resetEntry}>Go Current</button>}
            </details>
          </div>

          <div className="card pitch-call-panel compact">
            {editingEventId && (
              <div className="pitch-editing-banner">
                Editing saved pitch — tap Save Pitch to update, or Go Current to cancel.
              </div>
            )}

            <label className="pitch-note-compact">
              Coach Note
              <input value={coachNote} onChange={(e) => setCoachNote(e.target.value)} placeholder="Late on FB, chased outside, etc." />
            </label>

            <div className="pitch-compact-section">
              <h3>1. Pitch</h3>
              <div className="pitch-app-button-grid pitch-type-compact">
                {pitchTypes.map((pitch) => (
                  <PickButton key={pitch.id} item={pitch} selectedId={calledPitchId} setSelectedId={setCalledPitchId} />
                ))}
              </div>
            </div>

            <div className="pitch-map-pair">
              <div>
                <h3>2. Call</h3>
                <LocationMap title="" selectedId={intendedLocationId} setSelectedId={setIntendedLocationId} />
              </div>

              <div>
                <h3>3. Actual</h3>
                <LocationMap
                  title=""
                  selectedId={actualLocationId}
                  setSelectedId={setActualLocationId}
                  actual={true}
                />
              </div>
            </div>

            <div className="pitch-result-pair">
              <div>
                <h3>4. Pitch Result</h3>
                <div className="pitch-app-button-grid tight result-compact">
                  {pitchResults.map((result) => (
                    <PickButton
                      key={result.id}
                      item={result}
                      selectedId={pitchResultId}
                      setSelectedId={setPitchResultId}
                    />
                  ))}
                </div>
              </div>

              <div>
                <h3>5. Final</h3>
                <div className="pitch-app-button-grid tight final-compact">
                  {atBatResults.map((result) => (
                    <PickButton key={result.id} item={result} selectedId={atBatResultId} setSelectedId={setAtBatResultId} />
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="pitch-plays-strip">
  <div className="pitch-plays-header">
    <strong>Recent Plays</strong>

    <button type="button" onClick={goCurrentBatter} disabled={!lastEvent}>
      Current Batter
    </button>
  </div>

  <div className="pitch-plays-list">
    {history.slice(0, 8).map((event, index) => {
      const batter = batters.find((b) => String(b.id) === String(event.batter_id))
      const batterLabel = batter
        ? `Batter ${batter.batting_order}${batter.player_number ? ` #${batter.player_number}` : ''}`
        : `Batter ${event.batter_order_snapshot || ''}`

      return (
        <button key={event.id} type="button" onClick={() => loadEventForEdit(event)}>
          <span className="pitch-play-number">{index + 1}</span>
          <span>
            <strong>{batterLabel}</strong>
            <small>{eventSummary(event)}</small>
          </span>
        </button>
      )
    })}

    {!history.length && <span>No plays yet</span>}
  </div>
</div>

          <div className="pitch-section-jump-row">
            <button
              type="button"
              onClick={() => {
                setShowLineup(true)
                setTimeout(() => lineupRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
              }}
            >
              Edit / View Lineup ↓
            </button>
          </div>
        </div>

        {showLineup && (
  <div className="card pitch-lineup-panel" ref={lineupRef}>
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
                        saveCurrentSpot(Number(batter.batting_order))
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

                      <div className="row gap wrap-row" style={{ marginTop: 8 }}>
                        <button type="button" onClick={() => clearBatter(batter.id)}>Clear Batter</button>
                      </div>
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
