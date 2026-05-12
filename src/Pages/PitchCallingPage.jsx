import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'

function byOrder(a, b) {
  return Number(a.sort_order || 0) - Number(b.sort_order || 0)
}

export default function PitchCallingPage({ games, players, setAppError }) {
  const [options, setOptions] = useState([])
  const [pitchGame, setPitchGame] = useState(null)
  const [selectedGameId, setSelectedGameId] = useState('')
  const [opponentName, setOpponentName] = useState('')
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

  const activePlayers = useMemo(
    () => players.filter((p) => p.active !== false).sort((a, b) => (a.name || '').localeCompare(b.name || '')),
    [players]
  )

  const pitchTypes = options.filter((o) => o.category === 'pitch_type' && o.is_active !== false).sort(byOrder)
  const locations = options.filter((o) => o.category === 'pitch_location' && o.is_active !== false).sort(byOrder)
  const pitchResults = options.filter((o) => o.category === 'pitch_result' && o.is_active !== false).sort(byOrder)
  const atBatResults = options.filter((o) => o.category === 'at_bat_result' && o.is_active !== false).sort(byOrder)

  const currentBatter = batters.find((b) => Number(b.batting_order) === Number(currentSpot))
  const maxSpot = Math.max(1, ...batters.map((b) => Number(b.batting_order || 1)))

  useEffect(() => {
    loadOptions()
  }, [])

  useEffect(() => {
    if (pitchGame?.id) loadHistory()
  }, [pitchGame?.id])

  async function loadOptions() {
    const res = await supabase
      .from('pitch_options')
      .select('*')
      .order('category', { ascending: true })
      .order('sort_order', { ascending: true })

    if (res.error) return setAppError(res.error.message)
    setOptions(res.data || [])
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
    const res = await supabase
      .from('pitch_call_games')
      .insert({
        game_id: selectedGameId || null,
        opponent_name: opponentName || null,
        pitcher_id: pitcherId || null,
        current_batter_order: 1,
      })
      .select('*')
      .single()

    if (res.error) return setAppError(res.error.message)

    const nextBatters = buildBlankBatters()

    const batterRes = await supabase.from('pitch_call_batters').insert(
      nextBatters.map((b) => ({
        ...b,
        pitch_call_game_id: res.data.id,
      }))
    ).select('*')

    if (batterRes.error) return setAppError(batterRes.error.message)

    setPitchGame(res.data)
    setBatters(batterRes.data || [])
    setCurrentSpot(1)
  }

  async function updateBatter(id, field, value) {
    setBatters((current) =>
      current.map((b) => (b.id === id ? { ...b, [field]: value } : b))
    )

    const res = await supabase
      .from('pitch_call_batters')
      .update({ [field]: value })
      .eq('id', id)

    if (res.error) setAppError(res.error.message)
  }

  async function loadHistory() {
    const res = await supabase
      .from('pitch_call_events')
      .select(`
        *,
        pitch_option:pitch_option_id(label),
        intended_location:intended_location_id(label),
        actual_location:actual_location_id(label),
        pitch_result:pitch_result_id(label),
        at_bat_result:at_bat_result_id(label),
        batter:batter_id(batting_order, player_number, batter_name)
      `)
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
  }

  async function saveEvent({ skipped = false, skippedReason = '' } = {}) {
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
    })

    if (res.error) return setAppError(res.error.message)

    resetEntry()
    await loadHistory()

    if (atBatResultId || skipped) {
      goNext()
    }
  }

  function goNext() {
    setCurrentSpot((current) => (current >= maxSpot ? 1 : current + 1))
  }

  function goPrevious() {
    setCurrentSpot((current) => (current <= 1 ? maxSpot : current - 1))
  }

  const batterHistory = history.filter(
    (event) => Number(event.batter?.batting_order) === Number(currentSpot)
  )

  if (!pitchGame) {
    return (
      <div>
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
                {games.map((game) => (
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
                {activePlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <button type="button" onClick={startPitchGame}>
            Start
          </button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Pitch Calling</h1>
          <p>{opponentName || 'Opponent'} — simple pitch-call tracker</p>
        </div>
      </div>

      <div className="card">
        <div className="row-between wrap-row">
          <div>
            <h2>
              Batter {currentSpot}
              {currentBatter?.player_number ? ` — #${currentBatter.player_number}` : ''}
            </h2>
            <p>{currentBatter?.quick_note || 'No note yet.'}</p>
          </div>

          <div className="row gap">
            <button type="button" onClick={goPrevious}>Previous</button>
            <button type="button" onClick={goNext}>Next Batter</button>
            <select value={currentSpot} onChange={(e) => setCurrentSpot(Number(e.target.value))}>
              {batters.map((b) => (
                <option key={b.id} value={b.batting_order}>
                  Batter {b.batting_order}
                  {b.player_number ? ` — #${b.player_number}` : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid-4">
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

          <label style={{ gridColumn: 'span 2' }}>
            Quick Note
            <input
              value={currentBatter?.quick_note || ''}
              onChange={(e) => updateBatter(currentBatter.id, 'quick_note', e.target.value)}
              placeholder="Example: swings early, fast, power hitter"
            />
          </label>
        </div>
      </div>

      <div className="card">
        <h2>Call Pitch</h2>

        <div className="button-grid">
          {pitchTypes.map((pitch) => (
            <button
              key={pitch.id}
              type="button"
              className={calledPitchId === pitch.id ? 'primary' : ''}
              onClick={() => setCalledPitchId(pitch.id)}
            >
              {pitch.label}
            </button>
          ))}
        </div>

        <h3>Intended Location</h3>
        <div className="button-grid">
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className={intendedLocationId === loc.id ? 'primary' : ''}
              onClick={() => setIntendedLocationId(loc.id)}
            >
              {loc.label}
            </button>
          ))}
        </div>

        <h3>Pitch Result</h3>
        <div className="button-grid">
          {pitchResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className={pitchResultId === result.id ? 'primary' : ''}
              onClick={() => setPitchResultId(result.id)}
            >
              {result.label}
            </button>
          ))}
        </div>

        <h3>Actual Location Optional</h3>
        <div className="button-grid">
          {locations.map((loc) => (
            <button
              key={loc.id}
              type="button"
              className={actualLocationId === loc.id ? 'primary' : ''}
              onClick={() => setActualLocationId(loc.id)}
            >
              {loc.label}
            </button>
          ))}
        </div>

        <h3>Final At-Bat Result Optional</h3>
        <div className="button-grid">
          {atBatResults.map((result) => (
            <button
              key={result.id}
              type="button"
              className={atBatResultId === result.id ? 'primary' : ''}
              onClick={() => setAtBatResultId(result.id)}
            >
              {result.label}
            </button>
          ))}
        </div>

        <label>
          Coach Note Optional
          <input
            value={coachNote}
            onChange={(e) => setCoachNote(e.target.value)}
            placeholder="Example: late on fastball, chased outside"
          />
        </label>

        <div className="row gap wrap-row">
          <button type="button" onClick={() => saveEvent()}>
            Save Pitch / Result
          </button>
          <button type="button" onClick={() => saveEvent({ skipped: true, skippedReason: 'Catcher called' })}>
            Skip — Catcher Called
          </button>
          <button type="button" onClick={resetEntry}>
            Clear Entry
          </button>
        </div>
      </div>

      <div className="card">
        <h2>This Batter History</h2>

        {!batterHistory.length && <p>No tracked history for this batter yet.</p>}

        {batterHistory.slice(0, 6).map((event) => (
          <div key={event.id} style={{ borderBottom: '1px solid #e5e7eb', padding: '8px 0' }}>
            <strong>
              {event.skipped ? 'Skipped' : event.pitch_option?.label || 'No pitch'}
            </strong>
            {event.intended_location?.label ? ` / called ${event.intended_location.label}` : ''}
            {event.actual_location?.label ? ` / actual ${event.actual_location.label}` : ''}
            {event.pitch_result?.label ? ` — ${event.pitch_result.label}` : ''}
            {event.at_bat_result?.label ? ` — Final: ${event.at_bat_result.label}` : ''}
            {event.coach_note ? <div>Note: {event.coach_note}</div> : null}
          </div>
        ))}
      </div>
    </div>
  )
}
