import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function byOrder(a, b) {
  return Number(a.sort_order || 0) - Number(b.sort_order || 0)
}

export default function PitchCallingPage({ games = [], players = [], setAppError }) {
  const [options, setOptions] = useState([])
  const [pitchers, setPitchers] = useState([])
  const [pitchPrefs, setPitchPrefs] = useState([])
  const [pitchGame, setPitchGame] = useState(null)

  const [selectedGameId, setSelectedGameId] = useState('')
  const [opponentName, setOpponentName] = useState('')
  const [pitcherId, setPitcherId] = useState('')
  const [batters, setBatters] = useState([])
  const [currentSpot, setCurrentSpot] = useState(1)
  const [showLineup, setShowLineup] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState([])

  const [calledPitchId, setCalledPitchId] = useState('')
  const [intendedLocationId, setIntendedLocationId] = useState('')
  const [actualLocationId, setActualLocationId] = useState('')
  const [pitchResultId, setPitchResultId] = useState('')
  const [atBatResultId, setAtBatResultId] = useState('')
  const [coachNote, setCoachNote] = useState('')

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

  const selectedPitcherRow = pitcherRows.find((p) => String(p.player_id) === String(pitcherId))

  const pitchTypes = useMemo(() => {
    const allPitchTypes = options.filter(
      (o) => o.category === 'pitch_type' && o.is_active !== false
    )

    if (!selectedPitcherRow) return allPitchTypes.sort(byOrder)

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

  const locations = options
    .filter((o) => o.category === 'pitch_location' && o.is_active !== false)
    .sort(byOrder)

  const pitchResults = options
    .filter((o) => o.category === 'pitch_result' && o.is_active !== false)
    .sort(byOrder)

  const atBatResults = options
    .filter((o) => o.category === 'at_bat_result' && o.is_active !== false)
    .sort(byOrder)

  const currentBatter = batters.find((b) => Number(b.batting_order) === Number(currentSpot))
  const maxSpot = Math.max(1, ...batters.map((b) => Number(b.batting_order || 1)))
  const batterHistory = history.filter((event) => String(event.batter_id) === String(currentBatter?.id))
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
        opponent_name: opponentName || linkedGame?.opponent || linkedGame?.opponent_name || null,
        pitcher_id: pitcherId || null,
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

  async function updateBatter(id, field, value) {
    setBatters((current) => current.map((b) => (b.id === id ? { ...b, [field]: value } : b)))

    const res = await supabase.from('pitch_call_batters').update({ [field]: value }).eq('id', id)
    if (res.error) setAppError(res.error.message)
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

  function labelFor(id) {
    return options.find((o) => String(o.id) === String(id))?.label || ''
  }

  function resetEntry() {
    setCalledPitchId('')
    setIntendedLocationId('')
    setActualLocationId('')
    setPitchResultId('')
    setAtBatResultId('')
    setCoachNote('')
  }

  async function saveEvent({ eventType = 'tracked', skipped = false, skippedReason = '', advance = false } = {}) {
    if (!pitchGame?.id || !currentBatter?.id) return

    const res = await supabase.from('pitch_call_events').insert({
      pitch_call_game_id: pitchGame.id,
      batter_id: currentBatter.id,
      pitcher_id: pitcherId || null,
      pitch_option_id: calledPitchId || null,
      intended_location_id: intendedLocationId || null,
      actual_location_id: actualLocationId || null,
      pitch_result_id: pitchResultId || null,
      at_bat_result_id: atBatResultId || null,
      coach_note: coachNote || null,
      skipped,
      skipped_reason: skippedReason || null,
      event_type: eventType,
      batter_order_snapshot: currentSpot,
    })

    if (res.error) return setAppError(res.error.message)

    resetEntry()
    await loadHistory()

    if (advance || atBatResultId || skipped) goNext()
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
    setCurrentSpot((current) => (current >= maxSpot ? 1 : current + 1))
  }

  function goPrevious() {
    setCurrentSpot((current) => (current <= 1 ? maxSpot : current - 1))
  }

  function PickButton({ item, selectedId, setSelectedId, shortLabel }) {
    const active = String(selectedId) === String(item.id)

    return (
      <button
        type="button"
        className={`pitch-mobile-pick ${active ? 'is-selected' : ''}`}
        onClick={() => setSelectedId(active ? '' : item.id)}
      >
        {shortLabel || item.label}
      </button>
    )
  }

  function historyText(event) {
    if (!event) return 'No history yet.'

    const parts = []
    if (event.event_type === 'catcher_called') parts.push('Catcher called')
    else if (event.event_type === 'missed') parts.push('Missed pitch')
    else if (event.skipped) parts.push('Skipped')
    else parts.push(labelFor(event.pitch_option_id) || 'Tracked pitch')

    if (labelFor(event.pitch_result_id)) parts.push(labelFor(event.pitch_result_id))
    if (labelFor(event.at_bat_result_id)) parts.push(`Final: ${labelFor(event.at_bat_result_id)}`)
    if (event.coach_note) parts.push(event.coach_note)

    return parts.join(' — ')
  }

  if (!pitchGame) {
    return (
      <div className="pitch-mobile-page">
        <div className="page-header">
          <div>
            <h1>Pitch Calling</h1>
            <p>Simple coach tracker for pitch calls, results, and batter memory.</p>
          </div>
        </div>

        <div className="card">
          <h2>Start Pitch Tracking</h2>

          <div className="grid-3">
            <label>
              Existing Game
              <select value={selectedGameId} onChange={(e) => setSelectedGameId(e.target.value)}>
                <option value="">No linked game</option>
                {sortedGames.map((game) => (
                  <option key={game.id} value={game.id}>
                    {game.game_date || game.date} — {game.opponent || game.opponent_name || 'Opponent'}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Opponent Name
              <input
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="Opponent"
              />
            </label>

            <label>
              Pitcher
              <select value={pitcherId} onChange={(e) => setPitcherId(e.target.value)}>
                <option value="">Select pitcher</option>
                {pitcherRows.map((row) => (
                  <option key={row.id} value={row.player_id}>
                    #{row.display_number || row.player.jersey_number || row.player.number || ''} {row.player.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {!pitcherRows.length && (
            <p style={{ color: '#b91c1c' }}>
              No pitchers are set up yet. Go to Pitch Admin and mark active pitchers first.
            </p>
          )}

          <button type="button" onClick={startPitchGame} disabled={!pitcherId}>
            Start
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="pitch-mobile-page">
      <div className="pitch-mobile-topbar">
        <div>
          <strong>{opponentName || pitchGame.opponent_name || 'Opponent'}</strong>
          <span>
            Pitcher: {selectedPitcherRow?.player?.name || '—'} · Batter {currentSpot}
          </span>
        </div>

        <button type="button" onClick={() => setShowLineup((v) => !v)}>
          Lineup
        </button>
      </div>

      {showLineup && (
        <div className="card pitch-lineup-drawer">
          <div className="row-between">
            <h2>Opponent Lineup</h2>
            <button type="button" onClick={() => setShowLineup(false)}>
              Close
            </button>
          </div>

          <div className="pitch-lineup-list">
            {batters.map((batter) => {
              const miniHistory = history
                .filter((event) => String(event.batter_id) === String(batter.id))
                .slice(0, 3)
                .map((event) => labelFor(event.at_bat_result_id) || labelFor(event.pitch_result_id) || event.event_type || 'Tracked')
                .join(' / ')

              return (
                <button
                  key={batter.id}
                  type="button"
                  className={`pitch-lineup-row ${
                    Number(batter.batting_order) === Number(currentSpot) ? 'is-current' : ''
                  }`}
                  onClick={() => {
                    setCurrentSpot(Number(batter.batting_order))
                    setShowLineup(false)
                  }}
                >
                  <strong>{batter.batting_order}</strong>
                  <span>#{batter.player_number || '—'}</span>
                  <span>{batter.batter_name || 'Batter'}</span>
                  <small>{miniHistory || batter.quick_note || 'No notes'}</small>
                </button>
              )
            })}
          </div>
        </div>
      )}

      <div className="card pitch-batter-card" onClick={() => setShowHistory((v) => !v)}>
        <div className="row-between">
          <div>
            <h2>
              Batter {currentSpot}
              {currentBatter?.player_number ? ` — #${currentBatter.player_number}` : ''}
            </h2>
            <p>{currentBatter?.quick_note || 'Tap Lineup to add number/name/note.'}</p>
          </div>

          <div className="pitch-nav-buttons">
            <button type="button" onClick={(e) => { e.stopPropagation(); goPrevious() }}>
              Prev
            </button>
            <button type="button" onClick={(e) => { e.stopPropagation(); goNext() }}>
              Next
            </button>
          </div>
        </div>

        <div className="pitch-last-history">
          <strong>Last:</strong> {historyText(batterHistory[0])}
        </div>
      </div>

      {showHistory && (
        <div className="card">
          <h2>Batter Details</h2>

          <div className="grid-3">
            <label>
              Player #
              <input
                value={currentBatter?.player_number || ''}
                onChange={(e) => updateBatter(currentBatter.id, 'player_number', e.target.value)}
              />
            </label>

            <label>
              Name
              <input
                value={currentBatter?.batter_name || ''}
                onChange={(e) => updateBatter(currentBatter.id, 'batter_name', e.target.value)}
              />
            </label>

            <label>
              Quick Note
              <input
                value={currentBatter?.quick_note || ''}
                onChange={(e) => updateBatter(currentBatter.id, 'quick_note', e.target.value)}
                placeholder="Swings early, fast, power hitter"
              />
            </label>
          </div>

          {batterHistory.slice(0, 8).map((event) => (
            <div key={event.id} className="pitch-history-row">
              {historyText(event)}
            </div>
          ))}
        </div>
      )}

      <div className="card pitch-call-card">
        <h2>Call</h2>

        <h3>Pitch</h3>
        <div className="pitch-mobile-button-grid">
          {pitchTypes.map((pitch) => (
            <PickButton
              key={pitch.id}
              item={pitch}
              selectedId={calledPitchId}
              setSelectedId={setCalledPitchId}
            />
          ))}
        </div>

        <h3>Called Location</h3>
        <div className="pitch-mobile-button-grid compact">
          {locations.map((loc) => (
            <PickButton
              key={loc.id}
              item={loc}
              selectedId={intendedLocationId}
              setSelectedId={setIntendedLocationId}
            />
          ))}
        </div>

        <h3>Pitch Result</h3>
        <div className="pitch-mobile-button-grid">
          {pitchResults.map((result) => (
            <PickButton
              key={result.id}
              item={result}
              selectedId={pitchResultId}
              setSelectedId={setPitchResultId}
            />
          ))}
        </div>

        <h3>Final Result</h3>
        <div className="pitch-mobile-button-grid">
          {atBatResults.map((result) => (
            <PickButton
              key={result.id}
              item={result}
              selectedId={atBatResultId}
              setSelectedId={setAtBatResultId}
            />
          ))}
        </div>

        <details>
          <summary>Optional: actual location / note</summary>

          <h3>Actual Location</h3>
          <div className="pitch-mobile-button-grid compact">
            {locations.map((loc) => (
              <PickButton
                key={loc.id}
                item={loc}
                selectedId={actualLocationId}
                setSelectedId={setActualLocationId}
              />
            ))}
          </div>

          <label>
            Coach Note
            <input
              value={coachNote}
              onChange={(e) => setCoachNote(e.target.value)}
              placeholder="Late on FB, chased outside, etc."
            />
          </label>
        </details>
      </div>

      <div className="pitch-mobile-bottombar">
        <button type="button" onClick={() => saveEvent({ eventType: 'tracked' })}>
          Save Pitch
        </button>
        <button type="button" onClick={() => saveEvent({ eventType: 'tracked', advance: true })}>
          Save + Next
        </button>
        <button
          type="button"
          onClick={() => saveEvent({ eventType: 'catcher_called', skipped: true, skippedReason: 'Catcher called' })}
        >
          Catcher
        </button>
        <button
          type="button"
          onClick={() => saveEvent({ eventType: 'missed', skipped: true, skippedReason: 'Missed pitch' })}
        >
          Missed
        </button>
        <button type="button" onClick={undoLast} disabled={!lastEvent}>
          Undo
        </button>
      </div>
    </div>
  )
}
